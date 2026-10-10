import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findClientRequest, listClientRequests } from "../../src/db/requests.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../../src/http/turnstile.ts";
import { createPendingRequestAndMail } from "../../src/routes/request-form.tsx";
import { ensureUser, signIn } from "../fixtures.ts";
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
    const input = { title: "T", description: "d".repeat(40), category: "booking" as const, budgetBand: "unsure" as const, deadline: null, languages: ["en" as const], name: "N", email: "fail@request.example" };
    const before = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(await createPendingRequestAndMail(testEnv, { client, input, locale: "en", now: new Date() }, broken)).toBe("send_failed");
    expect(await listClientRequests(testEnv.DB, client.id)).toEqual([]);
    const after = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(after?.n).toBe(before?.n); // the audit row is written only after the e-mail went out
  });
});
