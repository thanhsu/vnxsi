import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { findClientRequest, listClientRequests } from "../../src/db/requests.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../../src/http/turnstile.ts";
import { createPendingRequestAndMail } from "../../src/routes/request-form.tsx";
import { ensureUser, makeRequest, signIn } from "../fixtures.ts";
import { expectErrorSummary, followMagicLink, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
let ipSeq = 0;
/** A fresh client IP per call keeps the per-IP limit out of the way unless a test means to hit it. */
const freshIp = () => `198.51.100.${(ipSeq++ % 250) + 1}`;
const post = (path: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}, env: Bindings = testEnv) =>
  app().request(formPost(path, fields, { "cf-connecting-ip": freshIp(), ...headers }), undefined, env);
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);

const valid = (overrides: Record<string, string | string[]> = {}) => ({
  title: "Booking app for three salons",
  description: "We need online booking with SMS reminders for three salons in Hanoi.",
  category: "booking",
  budgetBand: "2k-10k",
  deadline: "",
  languages: ["vi", "en"],
  name: "Minh Tran",
  ...overrides,
});
const signedOut = (email: string, overrides: Record<string, string | string[]> = {}) => valid({ email, [TURNSTILE_FIELD]: FAKE_TURNSTILE_PASS, ...overrides });
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];

describe("/request form (spec §5.7 step 1)", () => {
  beforeEach(() => clearOutbox());

  it("renders the form in each locale with the language checkboxes and Turnstile when signed out", async () => {
    const res = await get("/vi/request");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Đăng nhu cầu");
    expect(html).toContain('name="languages" value="zh"');
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/vi/request"');
  });

  it("prefills the name and hides e-mail and Turnstile when signed in", async () => {
    const { user, cookie } = await signIn("rf-in@vnx.si");
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Lan' WHERE id = ?1").bind(user.id).run();
    const html = await (await get("/request", cookie)).text();
    expect(html).toContain('value="Lan"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain("cf-turnstile");
  });

  it("submits straight away when signed in, tells the admins and lands on the request", async () => {
    const { user, cookie } = await signIn("rf-sub@vnx.si");
    const res = await post("/request", valid(), { cookie });
    expect(res.status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(res.headers.get("location")).toBe(`/me/requests/${request!.id}?sent=1`);
    expect(request).toMatchObject({ status: "submitted", languages: ["en", "vi"], category: "booking", clientName: "Minh Tran", locale: "en" });
    expect(outbox.map((m) => m.to)).toEqual(["owner@vnx.si"]);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'request.submit' AND entity_id = ?1").bind(request!.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ category: "booking", languages: ["en", "vi"] });
  });

  it("creates an implicit account and a pending request when signed out; the link submits it", async () => {
    const res = await post("/zh-hans/request", signedOut(" New@Request.Example "));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("new@request.example");
    const user = await findUserByEmail(testEnv.DB, "new@request.example");
    expect(user).toMatchObject({ locale: "zh-Hans", last_login_at: null, display_name: null });
    const [pending] = await listClientRequests(testEnv.DB, user!.id);
    expect(pending?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("new@request.example");
    const done = await followMagicLink(app(), linkFrom(outbox[0]!.text));
    expect(done.headers.get("location")).toBe(`/zh-hans/me/requests/${pending!.id}`);
    expect((await findClientRequest(testEnv.DB, user!.id, pending!.id))?.status).toBe("submitted");
  });

  it("re-renders with errors and keeps what was typed", async () => {
    const res = await post("/request", signedOut("x@request.example", { title: "", description: "short", languages: ["vi"] }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("This field is required.");
    expect(html).toContain("Please write at least 40 characters.");
    expect(html).toContain(">short</textarea>");
    expect(html).toMatch(/name="languages" value="vi"[^>]*checked/);
    // VNX-0807: shared error pattern; the title error is first in page order, descriptions follow, no role="alert".
    const body = expectErrorSummary(html, ["rq-title", "rq-description"]);
    expect(body).toContain("Please write at least 40 characters.");
    expect(html).toContain('aria-describedby="rq-title-error"');
    // The languages group error links to its first checkbox.
    const noLang = await (await post("/request", signedOut("nl@request.example", { languages: [] }))).text();
    expectErrorSummary(noLang, ["rq-languages"]);
    expect(noLang).toMatch(/<input type="checkbox" id="rq-languages" name="languages"/);
    expect(await (await post("/vi/request", signedOut("nl2@request.example", { title: "" }))).text()).toContain("Có lỗi cần sửa");
    expect(await findUserByEmail(testEnv.DB, "x@request.example")).toBeNull();
  });

  it("treats a filled honeypot as success and creates nothing", async () => {
    const res = await post("/request", signedOut("bot@request.example", { website: "http://spam" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to bot@request.example"); // same page as success
    expect(await findUserByEmail(testEnv.DB, "bot@request.example")).toBeNull();
    expect(outbox).toEqual([]);
  });

  it("signed-in honeypot: redirects to /me and creates nothing", async () => {
    const { user, cookie } = await signIn("rf-hp@vnx.si");
    const res = await post("/request", valid({ website: "http://spam" }), { cookie });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toEqual([]);
  });

  it("refuses a failed Turnstile, and fails closed when Turnstile is not configured", async () => {
    expect((await post("/request", signedOut("t1@request.example", { [TURNSTILE_FIELD]: "nope" }))).status).toBe(400);
    expect((await post("/request", valid({ email: "t3@request.example" }))).status).toBe(400); // no token at all
    const unconfigured = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET: undefined } as Bindings;
    const res = await post("/request", signedOut("t2@request.example"), {}, unconfigured);
    expect(res.status).toBe(503);
    expect(((await res.text()).match(/Posting without an account is temporarily unavailable/g) ?? []).length).toBe(1);
    expect(await findUserByEmail(testEnv.DB, "t1@request.example")).toBeNull();
    expect(await findUserByEmail(testEnv.DB, "t2@request.example")).toBeNull();
    expect(await findUserByEmail(testEnv.DB, "t3@request.example")).toBeNull();
  });

  it("allows 3 requests a day per e-mail: signed in gets 429, signed out gets the same page and nothing new", async () => {
    const { user, cookie } = await signIn("rf-day@vnx.si");
    for (let i = 0; i < 3; i++) expect((await post("/request", valid(), { cookie })).status).toBe(303);
    const fourth = await post("/request", valid(), { cookie });
    expect(fourth.status).toBe(429);
    expect(await fourth.text()).toContain("You can post up to 3 requests a day.");
    expect(await listClientRequests(testEnv.DB, user.id)).toHaveLength(3);

    for (let i = 0; i < 3; i++) await post("/request", signedOut("day@request.example"));
    clearOutbox();
    const res = await post("/request", signedOut("day@request.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to day@request.example");
    expect(outbox).toEqual([]);
    const owner = await findUserByEmail(testEnv.DB, "day@request.example");
    expect(await listClientRequests(testEnv.DB, owner!.id)).toHaveLength(3);
  });

  it("limits a network to 10 well-formed requests an hour", async () => {
    const { cookie } = await signIn("rf-ip@vnx.si");
    const ip = { "cf-connecting-ip": "203.0.113.77" };
    for (let i = 0; i < 10; i++) await post("/request", valid({ title: "" }), { cookie, ...ip }); // invalid forms do not count
    const accounts = await Promise.all([0, 1, 2, 3].map((i) => signIn(`rf-ip-${i}@vnx.si`)));
    for (let i = 0; i < 10; i++) expect((await post("/request", valid(), { cookie: accounts[i % 4]!.cookie, ...ip })).status, `post ${i + 1}`).toBe(303);
    const last = await post("/request", valid(), { cookie: accounts[2]!.cookie, ...ip });
    expect(last.status).toBe(429);
    expect(await last.text()).toContain("Too many requests from your network");
  });

  it("answers a suspended account's e-mail like success, creating and sending nothing", async () => {
    const user = await ensureUser("susp@request.example");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(user.id).run();
    const res = await post("/request", signedOut("susp@request.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to susp@request.example");
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toEqual([]);
  });

  // Turnstile's fake driver only works next to the fake mailer (M5), so no env both passes Turnstile and fails mail.
  // The signed-out tail is a separate exported function that takes the Mailer; break that one.
  it("deletes the pending request when the confirmation e-mail fails", async () => {
    const broken = {
      send: async () => {
        throw new Error("down");
      },
    };
    const client = await ensureUser("fail@request.example");
    const input = { title: "T", description: "d".repeat(40), category: "booking" as const, budgetBand: "unsure" as const, deadline: null, languages: ["en" as const], name: "N", email: "fail@request.example", country: null };
    const before = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(await createPendingRequestAndMail(testEnv, { client, input, locale: "en", now: new Date() }, broken)).toBe("send_failed");
    expect(await listClientRequests(testEnv.DB, client.id)).toEqual([]);
    const after = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(after?.n).toBe(before?.n); // the audit row is written only after the e-mail went out
  });
});

// EPIC 27 VNX-2703a (addendum 3.1, 12.4, 12.6): `country` and the per-request opt-in.
const GO_LIVE = "2026-01-01";
const boardEnv: Bindings = { ...testEnv, REQUEST_BOARD_GO_LIVE: GO_LIVE };
async function boardFlag(enabled: boolean): Promise<void> {
  const admin = await ensureUser("rf-board-admin@vnx.si");
  await setFlag(testEnv.DB, { key: "request_board", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}
const publicationOf = (requestId: string) => testEnv.DB.prepare("SELECT * FROM request_publications WHERE request_id = ?1").bind(requestId).all<Record<string, unknown>>().then((r) => r.results);
const auditRows = (action: string, entityId: string) =>
  testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, entityId).all<{ actor_user_id: string | null; entity: string; data: string }>().then((r) => r.results);
const countOf = (sql: string) => testEnv.DB.prepare(sql).first<{ n: number }>().then((r) => r!.n);
const bound = (t: object, k: string | symbol) => {
  const v = (t as Record<string | symbol, unknown>)[k];
  return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
};

// Approved copy: addendum 12.4 (EN) and 12.6 (VI), verbatim.
const EN_LABEL = "Show this request on the public request board";
const EN_HINT =
  "Our team reviews it first and may edit it to remove details that could identify you. Your name and email are never shown. You can remove it at any time from your account. Don't include names, company names, contact details or confidential information. Country, budget and a very specific niche together can sometimes identify a business.";
const VI_LABEL = "Hiện nhu cầu này trên bảng nhu cầu công khai";
const VI_HINT =
  "Đội ngũ của chúng tôi xem trước và có thể sửa để bỏ những chi tiết có thể nhận ra bạn. Tên và email của bạn không bao giờ được hiện. Bạn có thể gỡ bất cứ lúc nào từ tài khoản của mình. Đừng ghi tên người, tên công ty, thông tin liên lạc hay thông tin mật. Quốc gia, ngân sách và một ngách quá cụ thể đôi khi gộp lại có thể nhận ra một doanh nghiệp.";
const esc = (t: string) => t.replace(/'/g, "&#39;");

describe("/request form: country and the public-board opt-in (EPIC 27, VNX-2703a)", () => {
  beforeEach(async () => {
    clearOutbox();
    await boardFlag(false);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await boardFlag(false);
  });

  it("always offers an optional country select (empty first option, not prefilled from the network)", async () => {
    const req = new Request("https://vnx.si/request", { headers: { "cf-ipcountry": "VN" } });
    const html = await (await app().request(req, undefined, testEnv)).text();
    expect(html).toMatch(/<select id="rq-country" name="country">\s*<option value="">Not specified<\/option>/);
    expect(html).toContain('<option value="VN">Vietnam</option>');
    expect(html).not.toMatch(/<option value="[A-Z]{2}" selected/);
  });

  it("gate off: no opt-in box in the page, and a posted publish=1 is ignored (request created, no publication, no error)", async () => {
    const html = await (await get("/request")).text();
    expect(html).not.toContain('name="publish"');
    expect(html).not.toContain("rq-publish");
    const { user, cookie } = await signIn("rf-off@vnx.si");
    const res = await post("/request", valid({ publish: "1", country: "VN" }), { cookie }, boardEnv); // date reached, flag off: still closed
    expect(res.status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(request?.country).toBe("VN"); // the country is saved whatever the gate says
    expect(await publicationOf(request!.id)).toEqual([]);
    expect(await auditRows("request_publication.opt_in", request!.id)).toEqual([]);
  });

  it("gate on: the box is there, unchecked, with the approved EN and VI copy verbatim", async () => {
    await boardFlag(true);
    const en = await (await app().request(getReq("/request"), undefined, boardEnv)).text();
    expect(en).toMatch(/<input type="checkbox" id="rq-publish" name="publish" value="1" aria-describedby="rq-publish-hint"\/?>/);
    expect(en).not.toMatch(/name="publish"[^>]*checked/);
    expect(en).toContain(EN_LABEL);
    expect(en).toContain(esc(EN_HINT));
    const vi_ = await (await app().request(getReq("/vi/request"), undefined, boardEnv)).text();
    expect(vi_).toContain(VI_LABEL);
    expect(vi_).toContain(VI_HINT);
    // The page says nothing about other people (privacy): only the approved copy and the form itself.
    expect(en).not.toContain("client_name");
  });

  it("signed in + box: one batch, 303, a pending_review publication with the consent version, the country and the audit rows", async () => {
    await boardFlag(true);
    const { user, cookie } = await signIn("rf-opt@vnx.si");
    const res = await post("/request", valid({ publish: "1", country: "VN" }), { cookie }, boardEnv);
    expect(res.status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(res.headers.get("location")).toBe(`/me/requests/${request!.id}?sent=1`);
    expect(request).toMatchObject({ status: "submitted", country: "VN" });
    const rows = await publicationOf(request!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending_review", consent_version: GO_LIVE, public_title: null, public_description: null });
    const optIn = await auditRows("request_publication.opt_in", request!.id);
    expect(optIn).toHaveLength(1);
    expect(optIn[0]).toMatchObject({ actor_user_id: user.id, entity: "request_publication" });
    expect(JSON.parse(optIn[0]!.data)).toEqual({ consentVersion: GO_LIVE });
    const submit = await auditRows("request.submit", request!.id);
    expect(submit).toHaveLength(1);
    expect(JSON.parse(submit[0]!.data)).toEqual({ category: "booking", languages: ["en", "vi"] });
    expect(outbox.map((m) => m.to)).toEqual(["owner@vnx.si"]);
  });

  it("an OAuth session can opt in (the opt-in is not a staff action)", async () => {
    await boardFlag(true);
    const { user, cookie } = await signIn("rf-oauth@vnx.si", { method: "oauth_google" });
    const res = await post("/request", valid({ publish: "1" }), { cookie }, boardEnv);
    expect(res.status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(await publicationOf(request!.id)).toHaveLength(1);
  });

  it("signed in without the box: no publication and no opt-in audit row, the request as before", async () => {
    await boardFlag(true);
    const { user, cookie } = await signIn("rf-nobox@vnx.si");
    expect((await post("/request", valid({ country: "" }), { cookie }, boardEnv)).status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(request?.country).toBeNull();
    expect(await publicationOf(request!.id)).toEqual([]);
    expect(await auditRows("request_publication.opt_in", request!.id)).toEqual([]);
    expect(await auditRows("request.submit", request!.id)).toHaveLength(1);
  });

  it("signed out + box: a pending_verification request with a pending_review publication; the link submits the request and keeps the publication", async () => {
    await boardFlag(true);
    const res = await post("/request", signedOut("rf-so@request.example", { publish: "1", country: "US" }), {}, boardEnv);
    expect(res.status).toBe(200);
    const client = (await findUserByEmail(testEnv.DB, "rf-so@request.example"))!;
    const [pending] = await listClientRequests(testEnv.DB, client.id);
    expect(pending).toMatchObject({ status: "pending_verification", country: "US" });
    expect((await publicationOf(pending!.id))[0]).toMatchObject({ status: "pending_review", consent_version: GO_LIVE });
    expect(await auditRows("request.create", pending!.id)).toHaveLength(1);
    expect(await auditRows("request_publication.opt_in", pending!.id)).toHaveLength(1);
    // Not yet confirmed: no staff e-mail, and the request is not submitted, so the publication is not for the moderation queue.
    expect(outbox.map((m) => m.to)).toEqual(["rf-so@request.example"]);
    const done = await followMagicLink(app(), linkFrom(outbox[0]!.text));
    expect(done.status).toBe(303);
    expect((await findClientRequest(testEnv.DB, client.id, pending!.id))?.status).toBe("submitted");
    expect((await publicationOf(pending!.id))[0]).toMatchObject({ status: "pending_review" });
  });

  it("signed out + box + the e-mail fails: request and publication are gone (by id); the audit rows stay and carry no personal data (L3)", async () => {
    const broken = {
      send: async () => {
        throw new Error("down");
      },
    };
    const client = await ensureUser("rf-l3@request.example");
    const input = { title: "L3 secret title", description: "d".repeat(40), category: "booking" as const, budgetBand: "unsure" as const, deadline: null, languages: ["en" as const], name: "L3 Secret Name", email: "rf-l3@request.example", country: "VN" };
    expect(await createPendingRequestAndMail(boardEnv, { client, input, locale: "en", now: new Date(), publish: { consentVersion: GO_LIVE } }, broken)).toBe("send_failed");
    expect(await listClientRequests(testEnv.DB, client.id)).toEqual([]);
    const optIn = await testEnv.DB.prepare("SELECT entity_id FROM audit_log WHERE action = 'request_publication.opt_in' AND actor_user_id = ?1").bind(client.id).all<{ entity_id: string }>();
    expect(optIn.results).toHaveLength(1);
    const requestId = optIn.results[0]!.entity_id;
    expect(await publicationOf(requestId)).toEqual([]);
    expect(await testEnv.DB.prepare("SELECT id FROM requests WHERE id = ?1").bind(requestId).first()).toBeNull();
    // What is left: ids, the consent version and the request status. No e-mail, name, title or wording.
    const left = await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE entity_id = ?1").bind(requestId).all<{ action: string; data: string }>();
    expect(left.results.map((r) => r.action).sort()).toEqual(["request.create", "request_publication.opt_in"]);
    expect(left.results.map((r) => JSON.parse(r.data))).toEqual(expect.arrayContaining([{ consentVersion: GO_LIVE }, { status: "pending_verification" }]));
    for (const r of left.results) for (const secret of ["rf-l3@request.example", "L3 Secret Name", "L3 secret title", "Show this request"]) expect(r.data).not.toContain(secret);
  });

  it("without the box the signed-out path is unchanged (the request.create audit row comes after the e-mail)", async () => {
    const client = await ensureUser("rf-same@request.example");
    const input = { title: "T", description: "d".repeat(40), category: "booking" as const, budgetBand: "unsure" as const, deadline: null, languages: ["en" as const], name: "N", email: "rf-same@request.example", country: null };
    expect(await createPendingRequestAndMail(testEnv, { client, input, locale: "en", now: new Date() }, { send: async () => {} })).toBe("sent");
    const [pending] = await listClientRequests(testEnv.DB, client.id);
    expect(await publicationOf(pending!.id)).toEqual([]);
    expect(await auditRows("request.create", pending!.id)).toHaveLength(1);
    expect(await auditRows("request_publication.opt_in", pending!.id)).toEqual([]);
  });

  it("an unknown country is a 400 with the shared error pattern; nothing is created and the other values (and the box) are kept", async () => {
    await boardFlag(true);
    const { user, cookie } = await signIn("rf-badcountry@vnx.si");
    const res = await post("/request", valid({ country: "XX", publish: "1", title: "Kept title" }), { cookie }, boardEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expectErrorSummary(html, ["rq-country"]);
    expect(html).toContain('aria-describedby="rq-country-error"');
    expect(html).toContain('id="rq-country-error"');
    expect(html).toContain("Choose a country from the list.");
    expect(html).toContain('value="Kept title"');
    expect(html).toMatch(/name="publish"[^>]*checked/);
    expect(html).toContain('action="/request"');
    expect(html).not.toMatch(/action="[^"]*#/);
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
  });

  it("a 400 for another field keeps the checked box and the selected country", async () => {
    await boardFlag(true);
    const res = await post("/request", signedOut("rf-keep@request.example", { title: "", publish: "1", country: "VN" }), {}, boardEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expectErrorSummary(html, ["rq-title"]);
    expect(html).toMatch(/<input type="checkbox" id="rq-publish" name="publish" value="1" checked/);
    expect(html).toContain('<option value="VN" selected="">');
    expect(html).not.toContain("rq-country-error");
    const vi_ = await (await post("/vi/request", signedOut("rf-keep2@request.example", { title: "", publish: "1" }), {}, boardEnv)).text();
    expect(vi_).toContain("Lỗi:");
  });

  it("the batch loses (throws): no request, no publication, no audit row, a 500", async () => {
    await boardFlag(true);
    const { user, cookie } = await signIn("rf-lose@vnx.si");
    const before = await countOf("SELECT COUNT(*) AS n FROM audit_log");
    const flaky = new Proxy(testEnv.DB, {
      get: (t, k) =>
        k === "batch"
          ? async () => {
              throw new Error("D1 down");
            }
          : bound(t, k),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("/request", valid({ publish: "1" }), { cookie }, { ...boardEnv, DB: flaky } as Bindings);
    expect(res.status).toBe(500);
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
    expect(await countOf("SELECT COUNT(*) AS n FROM audit_log")).toBe(before);
  });

  it("a publication that did not insert on the create path is a 500 with a log, never silent (2702a obligation)", async () => {
    await boardFlag(true);
    const { cookie } = await signIn("rf-zero@vnx.si");
    // The real batch runs; the answer for the publication INSERT (statement 2) is emptied, as if it had inserted 0 rows.
    const zero = new Proxy(testEnv.DB, {
      get: (t, k) =>
        k === "batch"
          ? async (stmts: D1PreparedStatement[]) => (await t.batch(stmts)).map((r, i) => (i === 1 ? { ...r, results: [] } : r))
          : bound(t, k),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("/request", valid({ publish: "1" }), { cookie }, { ...boardEnv, DB: zero } as Bindings);
    expect(res.status).toBe(500);
    expect(log.mock.calls.some((c) => String(c[0]).includes("request.opt_in_not_inserted"))).toBe(true);
  });

  it("no retroactive publication: an older request has no row and no public page", async () => {
    const { request } = await makeRequest({ tag: "rf-old" });
    expect(await publicationOf(request.id)).toEqual([]);
    expect((await get(`/requests/${request.id}`)).status).toBe(404);
  });

  it("the body limit still holds with the publish field: 70 KB is a 413", async () => {
    const { cookie } = await signIn("rf-big@vnx.si");
    const res = await post("/request", valid({ publish: "1", description: "x".repeat(70 * 1024) }), { cookie }, boardEnv);
    expect(res.status).toBe(413);
  });
});
