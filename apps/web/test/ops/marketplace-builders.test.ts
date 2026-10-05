import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2504a: the Builders queue under /ops/marketplace/builders (spec §2.2, §3.1, §7.3; mockup OpsBuilders). The same
 * decisions as /admin/builders (state machine, e-mail, audit, compare-and-set), in OpsLayout, English, by capability:
 * marketplace.view for the pages, marketplace.act for every POST. Anyone else gets the sealed 404 of requireOps.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const BASE = "/ops/marketplace/builders";

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-mb-${role}-${tag()}@vnx.si`, role);
}

function req(path: string, opts: { cookie?: string; form?: Record<string, string>; ray?: string } = {}) {
  const headers: Record<string, string> = { "cf-ray": opts.ray ?? `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.form) {
    headers.origin = "https://vnx.si";
    headers["content-type"] = "application/x-www-form-urlencoded";
    return new Request(`https://vnx.si${path}`, { method: "POST", headers, body: new URLSearchParams(opts.form) });
  }
  return new Request(`https://vnx.si${path}`, { headers });
}

const send = (path: string, opts: Parameters<typeof req>[1] = {}, bindings: Bindings = env) => createApp().request(req(path, opts), undefined, bindings);
const get = async (path: string, cookie: string) => {
  const res = await send(path, { cookie });
  return { res, html: await res.text() };
};
const post = (path: string, cookie: string, form: Record<string, string> = {}, bindings: Bindings = env) => send(path, { cookie, form }, bindings);

const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** Every form in the page except the sign-out form of the shell. */
const actionForms = (html: string) => [...mainOf(html).matchAll(/<form\b[^>]*>/g)].map((m) => m[0]).filter((f) => f.includes('method="post"'));
const auditCount = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1").bind(entityId).first<{ n: number }>())!.n;
const statusCount = async (status: string) => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM builders WHERE status = ?1").bind(status).first<{ n: number }>())!.n;

describe("who may open the Builders queue (AC2, AC3)", () => {
  it("answers 200 to the Owner, an Operator and a Viewer, list and detail, in OpsLayout", async () => {
    const b = await makeBuilder(`ops-mb-who-${tag()}@vnx.si`, `mb-who-${tag()}`);
    for (const role of ["owner", "operator", "viewer"] as const) {
      const { cookie } = await asRole(role);
      for (const path of [BASE, `${BASE}/${b.userId}`]) {
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
    const b = await makeBuilder(`ops-mb-seal-${tag()}@vnx.si`, `mb-seal-${tag()}`);
    const sealed = async (path: string, opts: { cookie?: string; form?: Record<string, string> } = {}) => {
      const ray = `ray-${tag()}`;
      const res = await send(path, { ...opts, ray });
      return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
    };
    const reference = await sealed("/ops/khong-ton-tai");
    const content = await asRole("content");
    const plain = await signIn(`ops-mb-plain-${tag()}@vnx.si`);
    const cases = {
      contentList: await sealed(BASE, { cookie: content.cookie }),
      contentDetail: await sealed(`${BASE}/${b.userId}`, { cookie: content.cookie }),
      anonymousList: await sealed(BASE),
      noRoleDetail: await sealed(`${BASE}/${b.userId}`, { cookie: plain.cookie }),
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
      for (const [status, action, form] of [
        ["pending", "approve", {}],
        ["pending", "reject", { reason: "No portfolio" }],
        ["approved", "suspend", { reason: "Spam" }],
        ["suspended", "unsuspend", {}],
      ] as const) {
        const b = await makeBuilder(`ops-mb-ro-${role}-${action}-${tag()}@vnx.si`, `mb-ro-${tag()}`, status);
        clearOutbox();
        const res = await post(`${BASE}/${b.userId}/${action}`, cookie, form);
        expect(res.status, `${role} ${action}`).toBe(404);
        expect(await res.text(), `${role} ${action}`).not.toContain(b.userId);
        expect((await findBuilderByUserId(testEnv.DB, b.userId))?.status, `${role} ${action}`).toBe(status);
        expect(await auditCount(b.userId), `${role} ${action}`).toBe(0);
        expect(outbox, `${role} ${action}`).toHaveLength(0);
      }
    }
  });

  it("answers the sealed 404 for an unknown builder, on GET and POST", async () => {
    const { cookie } = await asRole("owner");
    const reference = await (await send("/ops/khong-ton-tai")).text();
    const strip = (html: string) => html.replace(/ray-[0-9a-f]{8}|[0-9a-f-]{36}/g, "");
    const detail = await send(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ`, { cookie });
    expect(detail.status).toBe(404);
    expect(strip(await detail.text())).toBe(strip(reference));
    expect((await post(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ/approve`, cookie)).status).toBe(404);
  });
});

describe("list: status tabs and search in the URL (AC4)", () => {
  it("opens on Pending, with a count on every status tab", async () => {
    const t = tag();
    await makeBuilder(`ops-mb-l1-${t}@vnx.si`, `mb-l1-${t}`, "pending", { name: `Pending Person ${t}` });
    await makeBuilder(`ops-mb-l2-${t}@vnx.si`, `mb-l2-${t}`, "approved", { name: `Approved Person ${t}` });
    const { cookie } = await asRole("operator");
    const main = mainOf((await get(BASE, cookie)).html);
    expect(main).toContain("<h1>Builders</h1>");
    expect(main).toContain(`Pending Person ${t}`);
    expect(main).not.toContain(`Approved Person ${t}`);
    const tabs = /<nav class="ops-tabs"[^>]*>([\s\S]*?)<\/nav>/.exec(main)?.[1] ?? "";
    for (const [status, label] of [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["suspended", "Suspended"]] as const) {
      const n = await statusCount(status);
      expect(tabs, status).toMatch(new RegExp(`<a class="ops-tab" href="${BASE}\\?status=${status}"[^>]*>${label} <span class="ops-tab-n">${n}</span></a>`));
    }
    expect(tabs).toMatch(new RegExp(`href="${BASE}\\?status=pending" aria-current="page"`));
  });

  it("filters by ?status= and ignores a value outside the list", async () => {
    const t = tag();
    await makeBuilder(`ops-mb-f1-${t}@vnx.si`, `mb-f1-${t}`, "suspended", { name: `Suspended Person ${t}` });
    await makeBuilder(`ops-mb-f2-${t}@vnx.si`, `mb-f2-${t}`, "pending", { name: `Waiting Person ${t}` });
    const { cookie } = await asRole("owner");
    const suspended = mainOf((await get(`${BASE}?status=suspended`, cookie)).html);
    expect(suspended).toContain(`Suspended Person ${t}`);
    expect(suspended).not.toContain(`Waiting Person ${t}`);
    const odd = mainOf((await get(`${BASE}?status=deleted`, cookie)).html);
    expect(odd).toContain(`Waiting Person ${t}`);
    expect(odd).toMatch(new RegExp(`href="${BASE}\\?status=pending" aria-current="page"`));
  });

  it("searches name, handle and e-mail, case-insensitive, and keeps the search in the tabs and row links", async () => {
    const t = tag();
    const hit = await makeBuilder(`ops-mb-mail-${t}@vnx.si`, `mb-handle-${t}`, "pending", { name: `Searchable ${t}` });
    await makeBuilder(`ops-mb-other-${t}@vnx.si`, `mb-other-${t}`, "pending", { name: `Unrelated ${t}` });
    const { cookie } = await asRole("viewer");
    for (const q of [`SEARCHABLE ${t}`, `mb-handle-${t}`, `ops-mb-mail-${t}`]) {
      const main = mainOf((await get(`${BASE}?q=${encodeURIComponent(q)}`, cookie)).html);
      expect(main, q).toContain(`Searchable ${t}`);
      expect(main, q).not.toContain(`Unrelated ${t}`);
    }
    const main = mainOf((await get(`${BASE}?status=pending&q=mb-handle-${t}`, cookie)).html);
    expect(main).toContain(`value="mb-handle-${t}"`);
    expect(main).toContain(`href="${BASE}?status=approved&amp;q=mb-handle-${t}"`);
    expect(main).toContain(`href="${BASE}/${hit.userId}?status=pending&amp;q=mb-handle-${t}"`);
  });

  it("treats LIKE wildcards as plain text and ignores a search longer than 100 characters", async () => {
    const t = tag();
    await makeBuilder(`ops-mb-w-${t}@vnx.si`, `mb-w-${t}`, "pending", { name: `Wildcard ${t}` });
    const { cookie } = await asRole("owner");
    const percent = mainOf((await get(`${BASE}?q=%25`, cookie)).html);
    expect(percent).not.toContain(`Wildcard ${t}`);
    expect(percent).toContain("No builders match this search.");
    const long = mainOf((await get(`${BASE}?q=${"x".repeat(101)}`, cookie)).html);
    expect(long).toContain(`Wildcard ${t}`);
    expect(long).not.toContain('value="xxxx');
  });

  it("shows the e-mail, handle, country and invite columns as the admin list did", async () => {
    const t = tag();
    await makeBuilder(`ops-mb-cols-${t}@vnx.si`, `mb-cols-${t}`, "pending", { name: `Columns ${t}`, country: "TW" });
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}?q=mb-cols-${t}`, cookie)).html);
    for (const text of ["Builder", "Handle", "Email", "Country", "Applied", "Invite", "Status"]) expect(main, text).toContain(`<th scope="col">${text}</th>`);
    for (const text of [`Columns ${t}`, `mb-cols-${t}`, `ops-mb-cols-${t}@vnx.si`, "Taiwan", "No", "Pending"]) expect(main, text).toContain(text);
  });
});

describe("detail and actions (AC1, AC2)", () => {
  beforeEach(() => clearOutbox());

  it("shows the profile and, for a Viewer, no form and no action button", async () => {
    const t = tag();
    const b = await makeBuilder(`ops-mb-view-${t}@vnx.si`, `mb-view-${t}`, "pending", { name: `Viewed ${t}`, headline: "Booking tools for small clinics" });
    const { cookie } = await asRole("viewer");
    const main = mainOf((await get(`${BASE}/${b.userId}?status=pending&q=Viewed`, cookie)).html);
    for (const text of [`Viewed ${t}`, `mb-view-${t}`, `ops-mb-view-${t}@vnx.si`, "Booking tools for small clinics", "Vietnam", "Ten years of web work."]) {
      expect(main, text).toContain(text);
    }
    expect(main).toContain(`href="${BASE}?status=pending&amp;q=Viewed"`);
    expect(actionForms(main)).toEqual([]);
    expect(main).not.toContain("<button");
    expect(main).not.toContain("<textarea");
  });

  it("lets the Owner approve: same data, e-mail and audit as /admin, then 303 back to the detail with the filter", async () => {
    const t = tag();
    const email = `ops-mb-ok-${t}@vnx.si`;
    await ensureUser(email, "vi");
    const b = await makeBuilder(email, `mb-ok-${t}`);
    const { user, cookie } = await asRole("owner");
    const detail = mainOf((await get(`${BASE}/${b.userId}?status=pending`, cookie)).html);
    expect(actionForms(detail)).toContain(`<form method="post" action="${BASE}/${b.userId}/approve?status=pending">`);

    const res = await post(`${BASE}/${b.userId}/approve?status=pending&q=zz`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${b.userId}?status=pending&q=zz&done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: email, subject: "Hồ sơ builder của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/b/mb-ok-${t}`);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'builder.approve' AND entity_id = ?1").bind(b.userId).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ from: "pending", to: "approved", reason: null });

    const after = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(after).toMatch(/<p class="ops-notice ops-notice-ok" role="status">[\s\S]*Saved\.[\s\S]*<\/p>/);
    expect(after).toContain("Approved");
  });

  it("lets an Operator reject behind a confirmation, with a required reason sent to the builder", async () => {
    const t = tag();
    const b = await makeBuilder(`ops-mb-rej-${t}@vnx.si`, `mb-rej-${t}`);
    const { cookie } = await asRole("operator");
    const detail = mainOf((await get(`${BASE}/${b.userId}`, cookie)).html);
    // No-JS confirmation: the reject form sits inside a closed <details>.
    expect(detail).toMatch(new RegExp(`<details class="ops-confirm"><summary class="ops-btn ops-btn-danger">Reject…</summary>[\\s\\S]*?<form method="post" action="${BASE}/${b.userId}/reject">`));

    const missing = await post(`${BASE}/${b.userId}/reject`, cookie, { reason: "  " });
    expect(missing.status).toBe(400);
    const html = await missing.text();
    expect(html).toContain("Enter a reason (up to 500 characters).");
    expect(html).toContain('<details class="ops-confirm" open="">');
    expect(html).toContain('<html lang="en">');
    expect(outbox).toHaveLength(0);
    expect(await auditCount(b.userId)).toBe(0);

    const res = await post(`${BASE}/${b.userId}/reject`, cookie, { reason: "Add real projects" });
    expect(res.headers.get("location")).toBe(`${BASE}/${b.userId}?done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "rejected", reviewNote: "Add real projects" });
    expect(outbox[0]!.text).toContain("Add real projects");
  });

  it("suspends with an optional reason and unsuspends, writing the same audit rows, no e-mail", async () => {
    const t = tag();
    const b = await makeBuilder(`ops-mb-sus-${t}@vnx.si`, `mb-sus-${t}`, "approved");
    const { cookie } = await asRole("owner");
    expect(mainOf((await get(`${BASE}/${b.userId}`, cookie)).html)).toMatch(/<summary class="ops-btn ops-btn-danger">Suspend…<\/summary>/);
    expect((await post(`${BASE}/${b.userId}/suspend`, cookie, { reason: "" })).status).toBe(303);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "suspended" });
    expect((await post(`${BASE}/${b.userId}/unsuspend`, cookie)).status).toBe(303);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    const actions = await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(b.userId).all<{ action: string }>();
    expect(actions.results.map((r) => r.action)).toEqual(["builder.suspend", "builder.unsuspend"]);
    expect(outbox).toHaveLength(0);
  });

  it("answers 409 for a move the state machine does not allow, and changes nothing", async () => {
    const b = await makeBuilder(`ops-mb-409-${tag()}@vnx.si`, `mb-409-${tag()}`, "approved");
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${b.userId}/approve`, cookie);
    expect(res.status).toBe(409);
    expect(await res.text()).toContain('<html lang="en">');
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    expect(await auditCount(b.userId)).toBe(0);
  });

  it("keeps the decision and says so when the e-mail fails", async () => {
    const b = await makeBuilder(`ops-mb-nomail-${tag()}@vnx.si`, `mb-nomail-${tag()}`);
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${b.userId}/approve`, cookie, {}, { ...env, MAIL_DRIVER: undefined } as Bindings);
    expect(res.headers.get("location")).toBe(`${BASE}/${b.userId}?done=mail_failed`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    const main = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(main).toMatch(/<p class="ops-notice ops-notice-warn" role="alert">[\s\S]*couldn&#39;t be sent[\s\S]*<\/p>/);
  });

  it("refuses a cross-site POST (Origin check) before anything changes", async () => {
    const b = await makeBuilder(`ops-mb-origin-${tag()}@vnx.si`, `mb-origin-${tag()}`);
    const { cookie } = await asRole("owner");
    const request = new Request(`https://vnx.si${BASE}/${b.userId}/approve`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: "x=1",
    });
    const res = await createApp().request(request, undefined, env);
    expect(res.status).toBe(403);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "pending" });
  });
});

describe("history (AC5)", () => {
  it("lists this builder's audit rows in the safe projection, newest first, never the data", async () => {
    const t = tag();
    const b = await makeBuilder(`ops-mb-hist-${t}@vnx.si`, `mb-hist-${t}`);
    const { cookie } = await asRole("owner");
    await post(`${BASE}/${b.userId}/reject`, cookie, { reason: `Secret reason ${t}` });
    const outsider = await ensureUser(`ops-mb-outsider-${t}@vnx.si`);
    const other = await makeBuilder(`ops-mb-hist2-${t}@vnx.si`, `mb-hist2-${t}`);
    const insert = testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, 'builder', ?4, ?5, ?6)");
    await testEnv.DB.batch([
      insert.bind(`01HISTA${t}`, outsider.id, "builder.resubmit", b.userId, `{"note":"private ${t}"}`, "2030-01-01T10:00:00.000Z"),
      insert.bind(`01HISTB${t}`, null, "builder.other", other.userId, "{}", "2030-01-01T11:00:00.000Z"),
    ]);
    const main = mainOf((await get(`${BASE}/${b.userId}`, cookie)).html);
    const history = /<section class="ops-card ops-history"[^>]*>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? "";
    expect(history).toContain("<h2");
    const rows = [...history.matchAll(/<li data-audit="([^"]+)"/g)].map((m) => m[1]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(`01HISTA${t}`);
    expect(history).toContain("builder.resubmit");
    expect(history).toContain("builder.reject");
    // The root Owner by e-mail; a user who is not in Ops by ID only.
    expect(history).toContain(ROOT);
    expect(history).not.toContain(`ops-mb-outsider-${t}@vnx.si`);
    expect(history).toContain(outsider.id);
    expect(history).not.toContain("builder.other");
    expect(history).not.toContain(`private ${t}`);
    // The reason is shown once, as the builder's review note, never from the audit data.
    expect(main.split(`Secret reason ${t}`).length - 1).toBe(1);
  });

  it("says so when there is no history", async () => {
    const b = await makeBuilder(`ops-mb-nohist-${tag()}@vnx.si`, `mb-nohist-${tag()}`);
    const { cookie } = await asRole("viewer");
    expect(mainOf((await get(`${BASE}/${b.userId}`, cookie)).html)).toContain("No audit entries for this builder yet.");
  });
});

describe("menu and breadcrumb (AC7)", () => {
  it("marks Builders current with its pending count on the list and the detail page", async () => {
    const b = await makeBuilder(`ops-mb-menu-${tag()}@vnx.si`, `mb-menu-${tag()}`);
    const n = await statusCount("pending");
    const { cookie } = await asRole("viewer");
    for (const path of [BASE, `${BASE}/${b.userId}`]) {
      const html = (await get(path, cookie)).html;
      expect(html, path).toMatch(new RegExp(`<a class="ops-nav-link" href="${BASE}" aria-current="page">[\\s\\S]*?Builders<span class="ops-nav-n"><span class="visually-hidden">waiting:</span>${n}</span></a>`));
      expect(html, path).toMatch(/<nav class="ops-crumb" aria-label="Breadcrumb">[\s\S]*?Ops[\s\S]*?Marketplace[\s\S]*?<span aria-current="page">/);
    }
  });
});

describe("CSP and headers on the new pages (AC8)", () => {
  it("has nothing inline and no no-referrer policy on pages with POST forms", async () => {
    const b = await makeBuilder(`ops-mb-csp-${tag()}@vnx.si`, `mb-csp-${tag()}`);
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}/${b.userId}`]) {
      const { res, html } = await get(path, cookie);
      expect(html, path).not.toMatch(/\sstyle=/);
      expect(html, path).not.toMatch(/<style\b/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      expect(html, path).not.toMatch(/<script\b/);
      expect(res.headers.get("referrer-policy"), path).not.toBe("no-referrer");
    }
  });
});
