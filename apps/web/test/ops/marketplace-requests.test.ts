import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { addLiveProduct, ensureUser, inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2504b: the Requests queue under /ops/marketplace/requests (spec §2.2, §3.1, §7.3; mockup OpsBuilders). The same
 * decisions as /admin/requests (invite with the cap and eligibility in the INSERT, return with a note e-mailed to the
 * client, remove as spam without telling the client, audit, compare-and-set), in OpsLayout, English, by capability:
 * marketplace.view for the pages, marketplace.act for every POST. Anyone else gets the sealed 404 of requireOps.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const noMail = { ...env, MAIL_DRIVER: undefined } as Bindings;
const BASE = "/ops/marketplace/requests";

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-rq-${role}-${tag()}@vnx.si`, role);
}

function req(path: string, opts: { cookie?: string; form?: Record<string, string | string[]>; ray?: string } = {}) {
  const headers: Record<string, string> = { "cf-ray": opts.ray ?? `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.form) {
    headers.origin = "https://vnx.si";
    headers["content-type"] = "application/x-www-form-urlencoded";
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(opts.form)) for (const v of Array.isArray(value) ? value : [value]) body.append(name, v);
    return new Request(`https://vnx.si${path}`, { method: "POST", headers, body });
  }
  return new Request(`https://vnx.si${path}`, { headers });
}

const send = (path: string, opts: Parameters<typeof req>[1] = {}, bindings: Bindings = env) => createApp().request(req(path, opts), undefined, bindings);
const get = async (path: string, cookie: string) => {
  const res = await send(path, { cookie });
  return { res, html: await res.text() };
};
const post = (path: string, cookie: string, form: Record<string, string | string[]> = {}, bindings: Bindings = env) => send(path, { cookie, form }, bindings);

const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** Every POST form in the page's <main> (the shell's sign-out form sits outside it). */
const actionForms = (main: string) => [...main.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]).filter((f) => f.includes('method="post"'));
const auditCount = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1").bind(entityId).first<{ n: number }>())!.n;
const statusCount = async (status: string | null) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE ?1 IS NULL OR status = ?1").bind(status).first<{ n: number }>())!.n;
const invitesOf = async (requestId: string) => (await listRequestInvites(testEnv.DB, requestId)).map((x) => x.invite);
const builders = (t: string, n: number) => Promise.all(Array.from({ length: n }, (_, i) => makeBuilder(`ops-rq-${t}-${i}@vnx.si`, `rq-${t}-${i}`, "approved")));
const setStatus = (id: string, status: string) => testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(id, status).run();

describe("who may open the Requests queue (AC2, AC3)", () => {
  it("answers 200 to the Owner, an Operator and a Viewer, list and detail, in OpsLayout", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-who-${tag()}` });
    for (const role of ["owner", "operator", "viewer"] as const) {
      const { cookie } = await asRole(role);
      for (const path of [BASE, `${BASE}?status=all`, `${BASE}/${request.id}`]) {
        const { res, html } = await get(path, cookie);
        expect(res.status, `${role} ${path}`).toBe(200);
        expect(res.headers.get("cache-control"), role).toBe("no-store");
        expect(res.headers.get("x-robots-tag"), role).toBe("noindex, nofollow");
        expect(html, role).toContain('<html lang="en">');
        expect(html, role).toMatch(/<aside class="ops-side">/);
      }
    }
  });

  it("gives Content, the anonymous and a role-less user the sealed 404 of an unknown /ops path", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-seal-${tag()}` });
    const sealed = async (path: string, opts: { cookie?: string } = {}) => {
      const ray = `ray-${tag()}`;
      const res = await send(path, { ...opts, ray });
      return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
    };
    const reference = await sealed("/ops/khong-ton-tai");
    const content = await asRole("content");
    const plain = await signIn(`ops-rq-plain-${tag()}@vnx.si`);
    const cases = {
      contentList: await sealed(BASE, { cookie: content.cookie }),
      contentAll: await sealed(`${BASE}?status=all`, { cookie: content.cookie }),
      contentDetail: await sealed(`${BASE}/${request.id}`, { cookie: content.cookie }),
      anonymousList: await sealed(BASE),
      anonymousDetail: await sealed(`${BASE}/${request.id}`),
      noRoleList: await sealed(BASE, { cookie: plain.cookie }),
      noRoleDetail: await sealed(`${BASE}/${request.id}`, { cookie: plain.cookie }),
    };
    for (const [name, got] of Object.entries(cases)) {
      expect(got.status, name).toBe(404);
      expect(got.body, name).toBe(reference.body);
      expect(got.headers, name).toEqual(reference.headers);
    }
  });

  it("refuses every POST from a Viewer or Content with the sealed 404 and writes nothing", async () => {
    for (const role of ["viewer", "content"] as const) {
      const { cookie } = await asRole(role);
      for (const [action, form] of [
        ["invite", "builder"],
        ["reject", { note: "Try the catalogue" }],
        ["remove", {}],
      ] as const) {
        const t = tag();
        const { request } = await makeRequest({ tag: `ops-rq-ro-${t}` });
        const [b] = await builders(`ro-${t}`, 1);
        clearOutbox();
        const res = await post(`${BASE}/${request.id}/${action}`, cookie, form === "builder" ? { builder: b!.userId } : form);
        expect(res.status, `${role} ${action}`).toBe(404);
        expect(await res.text(), `${role} ${action}`).not.toContain(request.id);
        expect(await findRequestById(testEnv.DB, request.id), `${role} ${action}`).toMatchObject({ status: "submitted", adminNote: null });
        expect(await invitesOf(request.id), `${role} ${action}`).toHaveLength(0);
        expect(await auditCount(request.id), `${role} ${action}`).toBe(0);
        expect(outbox, `${role} ${action}`).toHaveLength(0);
      }
    }
  });

  it("answers the sealed 404 for an unknown request, on GET and POST", async () => {
    const { cookie } = await asRole("owner");
    const reference = await (await send("/ops/khong-ton-tai")).text();
    const strip = (html: string) => html.replace(/ray-[0-9a-f]{8}|[0-9a-f-]{36}/g, "");
    const detail = await send(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ`, { cookie });
    expect(detail.status).toBe(404);
    expect(strip(await detail.text())).toBe(strip(reference));
    for (const [action, form] of [
      ["invite", { handle: "nobody" }],
      ["reject", { note: "x" }],
      ["remove", {}],
    ] as const) {
      expect((await post(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ/${action}`, cookie, form)).status, action).toBe(404);
    }
  });
});

describe("list: status tabs and search in the URL (AC4)", () => {
  it("opens on Submitted, with a count on every status tab and an All tab", async () => {
    const t = tag();
    await makeRequest({ tag: `ops-rq-open-${t}`, title: `Waiting app ${t}` });
    await makeRequest({ tag: `ops-rq-open-p-${t}`, title: `Unconfirmed app ${t}`, status: "pending_verification" });
    const { cookie } = await asRole("operator");
    const main = mainOf((await get(BASE, cookie)).html);
    expect(main).toContain("<h1>Requests</h1>");
    expect(main).toContain(`Waiting app ${t}`);
    expect(main).not.toContain(`Unconfirmed app ${t}`);
    const tabs = /<nav class="ops-tabs"[^>]*>([\s\S]*?)<\/nav>/.exec(main)?.[1] ?? "";
    for (const [status, label] of [
      ["pending_verification", "Unconfirmed"],
      ["submitted", "Submitted"],
      ["matching", "Matching"],
      ["builder_selected", "Builder selected"],
      ["rejected", "Returned"],
      ["expired", "Expired"],
      ["closed", "Closed"],
      ["removed", "Removed"],
    ] as const) {
      const n = await statusCount(status);
      expect(tabs, status).toMatch(new RegExp(`<a class="ops-tab" href="${BASE}\\?status=${status}"[^>]*>${label} <span class="ops-tab-n">${n}</span></a>`));
    }
    expect(tabs).toMatch(new RegExp(`href="${BASE}\\?status=submitted" aria-current="page"`));
    expect(tabs).toMatch(new RegExp(`<a class="ops-tab" href="${BASE}\\?status=all">All <span class="ops-tab-n">${await statusCount(null)}</span></a>`));
  });

  it("filters by ?status=, lists every status on ?status=all, and ignores a value outside the list", async () => {
    const t = tag();
    const matching = await makeRequest({ tag: `ops-rq-f-${t}`, title: `Matching app ${t}` });
    await setStatus(matching.request.id, "matching");
    await makeRequest({ tag: `ops-rq-f2-${t}`, title: `Queued app ${t}` });
    await makeRequest({ tag: `ops-rq-f3-${t}`, title: `Unverified app ${t}`, status: "pending_verification" });
    const { cookie } = await asRole("owner");
    const only = mainOf((await get(`${BASE}?status=matching`, cookie)).html);
    expect(only).toContain(`Matching app ${t}`);
    expect(only).not.toContain(`Queued app ${t}`);
    const all = mainOf((await get(`${BASE}?status=all&q=${t}`, cookie)).html);
    for (const title of [`Matching app ${t}`, `Queued app ${t}`, `Unverified app ${t}`]) expect(all, title).toContain(title);
    expect(all).toMatch(new RegExp(`href="${BASE}\\?status=all&amp;q=${t}" aria-current="page"`));
    for (const odd of ["deleted", "SUBMITTED", "ALL", ""]) {
      const main = mainOf((await get(`${BASE}?status=${odd}`, cookie)).html);
      expect(main, odd).toContain(`Queued app ${t}`);
      expect(main, odd).not.toContain(`Matching app ${t}`);
      expect(main, odd).toMatch(new RegExp(`href="${BASE}\\?status=submitted" aria-current="page"`));
    }
  });

  it("searches the title, case-insensitive, and keeps the search in the tabs, the form and the row links", async () => {
    const t = tag();
    const hit = await makeRequest({ tag: `ops-rq-s-${t}`, title: `Findable clinic portal ${t}` });
    await makeRequest({ tag: `ops-rq-s2-${t}`, title: `Unrelated shop ${t}` });
    const { cookie } = await asRole("viewer");
    const q = `FINDABLE CLINIC PORTAL ${t}`;
    const main = mainOf((await get(`${BASE}?q=${encodeURIComponent(q)}`, cookie)).html);
    expect(main).toContain(`Findable clinic portal ${t}`);
    expect(main).not.toContain(`Unrelated shop ${t}`);
    expect(main).toContain("1 shown");
    const keep = mainOf((await get(`${BASE}?status=submitted&q=findable-${t}`, cookie)).html);
    expect(keep).toContain(`value="findable-${t}"`);
    expect(keep).toContain('<input type="hidden" name="status" value="submitted"/>');
    expect(keep).toContain(`href="${BASE}?status=matching&amp;q=findable-${t}"`);
    expect(keep).toContain(`href="${BASE}?status=all&amp;q=findable-${t}"`);
    const linked = mainOf((await get(`${BASE}?status=submitted&q=${t}`, cookie)).html);
    expect(linked).toContain(`href="${BASE}/${hit.request.id}?status=submitted&amp;q=${t}"`);
  });

  it("treats LIKE wildcards as plain text and ignores a search longer than 100 characters", async () => {
    const t = tag();
    await makeRequest({ tag: `ops-rq-w-${t}`, title: `Wildcard app ${t}` });
    const { cookie } = await asRole("owner");
    const percent = mainOf((await get(`${BASE}?q=%25`, cookie)).html);
    expect(percent).not.toContain(`Wildcard app ${t}`);
    expect(percent).toContain("No requests match this search.");
    const long = mainOf((await get(`${BASE}?q=${"x".repeat(101)}`, cookie)).html);
    expect(long).toContain(`Wildcard app ${t}`);
    expect(long).not.toContain('value="xxxx');
  });

  it("shows the request, status, client name and e-mail, category, invitations, proposals and submitted columns", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-c-${t}`, title: `Columns app ${t}` });
    const [a, b] = await builders(`c-${t}`, 2);
    const [first] = await inviteBuilders(request, [a!, b!]);
    await proposeOn(first!);
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}?status=matching&q=${t}`, cookie)).html);
    for (const text of ["Request", "Status", "Client", "Category", "Invitations", "Proposals", "Submitted"]) expect(main, text).toContain(`<th scope="col">${text}</th>`);
    for (const text of [`Columns app ${t}`, "Minh Tran", `ops-rq-c-${t}-c@vnx.si`, "Booking", "Matching", "2 active · 2 in all", request.submittedAt!.slice(0, 10)]) {
      expect(main, text).toContain(text);
    }
    expect(main).toMatch(/<td class="ops-mono">1<\/td>/);
  });
});

describe("detail and actions (AC1, AC2)", () => {
  beforeEach(() => clearOutbox());

  it("shows what the admin page showed and, for a Viewer, no form, checkbox, input or button", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-v-${t}`, title: `Viewed app ${t} qzv${t}a qzv${t}b qzv${t}c`, category: "hr", languages: ["zh"] });
    await testEnv.DB.prepare("UPDATE requests SET deadline = '2026-12-31' WHERE id = ?1").bind(request.id).run();
    const invited = await makeBuilder(`ops-rq-v-inv-${t}@vnx.si`, `rq-v-inv-${t}`, "approved");
    const [invite] = await inviteBuilders(request, [invited]);
    await proposeOn(invite!);
    const suggested = await makeBuilder(`ops-rq-v-sug-${t}@vnx.si`, `rq-v-sug-${t}`, "approved", { availability: "open", workLanguages: ["zh"], skills: `qzv${t}a, qzv${t}b, qzv${t}c` });
    await addLiveProduct(suggested, `rq-v ${t}`, { fields: { category: "hr" } });
    const { cookie } = await asRole("viewer");
    const main = mainOf((await get(`${BASE}/${request.id}?status=matching&q=Viewed`, cookie)).html);
    for (const text of [
      `Viewed app ${t}`,
      "Minh Tran",
      `ops-rq-v-${t}-c@vnx.si`,
      "We need online booking with SMS reminders",
      "HR",
      "$2,000 – $10,000",
      "2026-12-31",
      "Chinese",
      "Matching",
      "Invitations",
      "1 active · 1 in all",
      `rq-v-inv-${t}`,
      "Proposal sent",
      "$4,500 · 30 days",
      "Suggested builders",
      `rq-v-sug-${t}`,
      "product in this category +3",
      `skill “qzv${t}a” +1`,
      "4 of 5 invitation slots free.",
    ]) {
      expect(main, text).toContain(text);
    }
    expect(main).toContain(`href="/ops/marketplace/builders/${invited.userId}"`);
    expect(main).toContain(`href="${BASE}?status=matching&amp;q=Viewed"`);
    expect(main).toContain("Your role can view this page but not change it.");
    expect(actionForms(main)).toEqual([]);
    expect(main).not.toContain("<form");
    expect(main).not.toContain("<button");
    expect(main).not.toContain("<input");
    expect(main).not.toContain("<textarea");
  });

  it("lets the Owner invite suggested builders and one by handle, as /admin, then 303 back with the filter", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-inv-${t}` });
    const [a, b] = await builders(`inv-${t}`, 2);
    const closed = await makeBuilder(`ops-rq-inv-cl-${t}@vnx.si`, `rq-inv-cl-${t}`, "approved", { availability: "closed" });
    const { user, cookie } = await asRole("owner");
    const detail = mainOf((await get(`${BASE}/${request.id}?status=submitted`, cookie)).html);
    expect(actionForms(detail)).toContain(`<form method="post" action="${BASE}/${request.id}/invite?status=submitted">`);
    expect(detail).toMatch(/<input type="checkbox" id="sg-[^"]+" name="builder" value="[^"]+"/);

    const res = await post(`${BASE}/${request.id}/invite?status=submitted&q=zz`, cookie, { builder: [a!.userId, b!.userId], handle: closed.handle });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${request.id}?status=submitted&q=zz&done=1`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
    expect((await listRequestInvites(testEnv.DB, request.id)).map((x) => [x.builderHandle, x.invite.status, x.invite.invitedBy])).toEqual([
      [a!.handle, "invited", user.id],
      [b!.handle, "invited", user.id],
      [closed.handle, "invited", user.id],
    ]);
    expect(outbox.map((m) => m.to).sort()).toEqual([`ops-rq-inv-${t}-0@vnx.si`, `ops-rq-inv-${t}-1@vnx.si`, `ops-rq-inv-cl-${t}@vnx.si`].sort());
    for (const m of outbox) expect(`${m.text}${m.html}`).not.toContain(`ops-rq-inv-${t}-c@vnx.si`);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).all<{ actor_user_id: string; data: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]!.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit.results[0]!.data)).toEqual({ from: "submitted", requested: [a!.userId, b!.userId, closed.userId] });

    const page = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(page).toMatch(/<p class="ops-notice ops-notice-ok" role="status">[\s\S]*Saved\.[\s\S]*<\/p>/);
    expect(page).toContain("3 active · 3 in all");
    expect(page).toContain("2 of 5 invitation slots free.");
  });

  it("refuses no choice, an unknown handle and more builders than free slots with a 400 that writes nothing", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-bad-${t}` });
    await inviteBuilders(request, await builders(`bad-${t}`, 4));
    const [x, y] = await builders(`bad-xy-${t}`, 2);
    const { cookie } = await asRole("operator");
    for (const [form, message] of [
      [{}, "Choose at least one builder."],
      [{ handle: "no-such-builder" }, "No public builder has that handle."],
      [{ builder: [x!.userId, y!.userId] }, "That is more builders than the free slots."],
    ] as const) {
      const res = await post(`${BASE}/${request.id}/invite`, cookie, form);
      expect(res.status, message).toBe(400);
      const html = await res.text();
      expect(html, message).toContain('<html lang="en">');
      expect(html, message).toContain(message);
      expect(html, message).toMatch(/<aside class="ops-side">/);
    }
    // The typed handle is kept for the next try.
    expect(await (await post(`${BASE}/${request.id}/invite`, cookie, { handle: "no-such-builder" })).text()).toContain('value="no-such-builder"');
    expect(await invitesOf(request.id)).toHaveLength(4);
    expect(await auditCount(request.id)).toBe(0);
    expect(outbox).toHaveLength(0);
  });

  it("answers 409 with the current state when nobody could be invited, and when the request has ended", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-dup-${t}` });
    const [a] = await builders(`dup-${t}`, 1);
    await inviteBuilders(request, [a!]);
    const { cookie } = await asRole("owner");
    const dup = await post(`${BASE}/${request.id}/invite`, cookie, { builder: a!.userId });
    expect(dup.status).toBe(409);
    const html = await dup.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("The status changed before your action, so nothing was saved.");
    expect(html).toContain("1 active · 1 in all");
    expect(await invitesOf(request.id)).toHaveLength(1);

    const ended = await makeRequest({ tag: `ops-rq-end-${t}` });
    await setStatus(ended.request.id, "closed");
    const res = await post(`${BASE}/${ended.request.id}/invite`, cookie, { builder: a!.userId });
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("Closed");
    expect(await invitesOf(ended.request.id)).toHaveLength(0);
    expect(await auditCount(request.id)).toBe(0);
    expect(await auditCount(ended.request.id)).toBe(0);
    expect(outbox).toHaveLength(0);
  });

  it("keeps the invitations and says so when an e-mail could not be sent", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-mf-${t}` });
    const [a] = await builders(`mf-${t}`, 1);
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${request.id}/invite`, cookie, { builder: a!.userId }, noMail);
    expect(res.headers.get("location")).toBe(`${BASE}/${request.id}?done=mail_failed`);
    expect(await invitesOf(request.id)).toHaveLength(1);
    const main = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(main).toMatch(/<p class="ops-notice ops-notice-warn" role="alert">[\s\S]*couldn&#39;t be sent[\s\S]*<\/p>/);
  });

  it("offers no invite form once 5 invitations are active", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-full-${t}` });
    await inviteBuilders(request, await builders(`full-${t}`, 5));
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}/${request.id}`, cookie)).html);
    expect(main).toContain("All 5 invitation slots are in use.");
    expect(actionForms(main)).not.toContain(`<form method="post" action="${BASE}/${request.id}/invite">`);
    const [sixth] = await builders(`full-x-${t}`, 1);
    expect((await post(`${BASE}/${request.id}/invite`, cookie, { builder: sixth!.userId })).status).toBe(400);
    expect(await invitesOf(request.id)).toHaveLength(5);
  });

  it("lets an Operator return a submitted request behind a confirmation, with a required note e-mailed to the client", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-rej-${t}` });
    const { user, cookie } = await asRole("operator");
    const detail = mainOf((await get(`${BASE}/${request.id}`, cookie)).html);
    expect(detail).toMatch(
      new RegExp(`<details class="ops-confirm"><summary class="ops-btn ops-btn-danger">Return to client…</summary>[\\s\\S]*?<form method="post" action="${BASE}/${request.id}/reject">`),
    );

    for (const note of [" ", "x".repeat(1001)]) {
      const bad = await post(`${BASE}/${request.id}/reject`, cookie, { note });
      expect(bad.status).toBe(400);
      const html = await bad.text();
      expect(html).toContain("Write a reason of 1–1000 characters.");
      expect(html).toMatch(/<details class="ops-confirm" open="">\s*<summary class="ops-btn ops-btn-danger">Return to client…/);
      expect(html).toContain('<html lang="en">');
    }
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "submitted", adminNote: null });
    expect(await auditCount(request.id)).toBe(0);
    expect(outbox).toHaveLength(0);

    const res = await post(`${BASE}/${request.id}/reject?status=submitted`, cookie, { note: "Please try the catalogue first." });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${request.id}?status=submitted&done=1`);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "rejected", adminNote: "Please try the catalogue first." });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: `ops-rq-rej-${t}-c@vnx.si` });
    expect(outbox[0]!.text).toContain("Please try the catalogue first.");
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'request.reject' AND entity_id = ?1").bind(request.id).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ from: "submitted" });
    const page = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(page).toContain("Please try the catalogue first.");
    expect(page).toContain("Returned");

    const again = await post(`${BASE}/${request.id}/reject`, cookie, { note: "again" });
    expect(again.status).toBe(409);
    expect(await again.text()).toContain("The status changed before your action, so nothing was saved.");
    expect(await auditCount(request.id)).toBe(1);
    expect(outbox).toHaveLength(1);
  });

  it("reports a failed e-mail to the client but keeps the return", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-rf-${tag()}` });
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${request.id}/reject`, cookie, { note: "Not a fit." }, noMail);
    expect(res.headers.get("location")).toBe(`${BASE}/${request.id}?done=mail_failed`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("rejected");
  });

  it("removes spam behind a confirmation: builders are told, the client is not, then 303 to the list with the filter", async () => {
    const t = tag();
    const { client, request } = await makeRequest({ tag: `ops-rq-spam-${t}` });
    const [proposer, waiting] = await builders(`spam-${t}`, 2);
    const [first] = await inviteBuilders(request, [proposer!, waiting!]);
    await proposeOn(first!);
    const { user, cookie } = await asRole("owner");
    const detail = mainOf((await get(`${BASE}/${request.id}`, cookie)).html);
    expect(detail).toMatch(
      new RegExp(`<details class="ops-confirm"><summary class="ops-btn ops-btn-danger">Remove as spam…</summary>[\\s\\S]*?The client is not told[\\s\\S]*?</details>`),
    );
    expect(detail).toMatch(new RegExp(`<form method="post" action="${BASE}/${request.id}/remove">`));
    // Matching: no return form any more.
    expect(detail).not.toContain(`${BASE}/${request.id}/reject`);

    const res = await post(`${BASE}/${request.id}/remove?status=matching&q=spam`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}?status=matching&q=spam&done=1`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect((await invitesOf(request.id)).map((i) => i.status)).toEqual(["not_selected", "expired"]);
    expect(outbox.map((m) => m.to).sort()).toEqual([`ops-rq-spam-${t}-0@vnx.si`, `ops-rq-spam-${t}-1@vnx.si`]);
    expect(outbox.map((m) => m.to)).not.toContain(client.email);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'request.remove' AND entity_id = ?1").bind(request.id).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ from: "matching" });
    const list = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(list).toMatch(/<p class="ops-notice ops-notice-ok" role="status">[\s\S]*Saved\.[\s\S]*<\/p>/);

    const removed = mainOf((await get(`${BASE}/${request.id}`, cookie)).html);
    expect(actionForms(removed)).toEqual([]);
    expect(removed).toContain("No action applies in this status.");
    const again = await post(`${BASE}/${request.id}/remove`, cookie);
    expect(again.status).toBe(409);
    expect(outbox).toHaveLength(2);
    expect(await auditCount(request.id)).toBe(1);
  });

  it("refuses a cross-site POST (Origin check) before anything changes", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-origin-${tag()}` });
    const { cookie } = await asRole("owner");
    const request2 = new Request(`https://vnx.si${BASE}/${request.id}/remove`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: "x=1",
    });
    const res = await createApp().request(request2, undefined, env);
    expect(res.status).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
  });
});

describe("history (AC5)", () => {
  it("lists this request's audit rows in the safe projection, newest first, never the data", async () => {
    const t = tag();
    const { request } = await makeRequest({ tag: `ops-rq-h-${t}` });
    const other = await makeRequest({ tag: `ops-rq-h2-${t}` });
    const { cookie } = await asRole("owner");
    await post(`${BASE}/${request.id}/reject`, cookie, { note: `Secret note ${t}` });
    const outsider = await ensureUser(`ops-rq-outsider-${t}@vnx.si`);
    const insert = testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, 'request', ?4, ?5, ?6)");
    await testEnv.DB.batch([
      insert.bind(`01RHISTA${t}`, outsider.id, "request.other", request.id, `{"note":"private ${t}"}`, "2030-01-01T10:00:00.000Z"),
      insert.bind(`01RHISTB${t}`, null, "request.elsewhere", other.request.id, "{}", "2030-01-01T11:00:00.000Z"),
    ]);
    const main = mainOf((await get(`${BASE}/${request.id}`, cookie)).html);
    const history = /<section class="ops-card ops-history"[^>]*>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? "";
    expect(history).toContain("<h2");
    const rows = [...history.matchAll(/<li data-audit="([^"]+)"/g)].map((m) => m[1]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(`01RHISTA${t}`);
    expect(history).toContain("request.other");
    expect(history).toContain("request.reject");
    expect(history).toContain(ROOT);
    expect(history).not.toContain(`ops-rq-outsider-${t}@vnx.si`);
    expect(history).toContain(outsider.id);
    expect(history).not.toContain("request.elsewhere");
    expect(history).not.toContain(`private ${t}`);
    // The note is shown once, as the reason sent to the client, never from the audit data.
    expect(main.split(`Secret note ${t}`).length - 1).toBe(1);
  });

  it("says so when there is no history", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-nh-${tag()}` });
    const { cookie } = await asRole("viewer");
    expect(mainOf((await get(`${BASE}/${request.id}`, cookie)).html)).toContain("No audit entries for this request yet.");
  });
});

describe("menu and breadcrumb (AC7)", () => {
  it("marks Requests current with its submitted count on the list and the detail page", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-menu-${tag()}` });
    const n = await statusCount("submitted");
    const { cookie } = await asRole("viewer");
    for (const path of [BASE, `${BASE}/${request.id}`]) {
      const html = (await get(path, cookie)).html;
      expect(html, path).toMatch(new RegExp(`<a class="ops-nav-link" href="${BASE}" aria-current="page">[\\s\\S]*?Requests<span class="ops-nav-n"><span class="visually-hidden">waiting:</span>${n}</span></a>`));
      expect(html, path).toMatch(/<nav class="ops-crumb" aria-label="Breadcrumb">[\s\S]*?Ops[\s\S]*?Marketplace[\s\S]*?<span aria-current="page">/);
    }
  });
});

describe("CSP and headers on the new pages (AC8)", () => {
  it("has nothing inline and no no-referrer policy on pages with POST forms", async () => {
    const { request } = await makeRequest({ tag: `ops-rq-csp-${tag()}` });
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}?status=all`, `${BASE}/${request.id}`]) {
      const { res, html } = await get(path, cookie);
      expect(html, path).not.toMatch(/\sstyle=/);
      expect(html, path).not.toMatch(/<style\b/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      expect(html, path).not.toMatch(/<script\b/);
      expect(res.headers.get("referrer-policy"), path).not.toBe("no-referrer");
    }
  });
});
