import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { grantBadge, listActiveBadges, revokeBadge } from "../../src/db/verifications.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2504a2: the Products queue under /ops/marketplace/products (spec §2.2, §3.1, §7.3; mockup OpsBuilders). The same
 * decisions as /admin/products (state machine, listed badge, badges, e-mail, audit, compare-and-set), in OpsLayout,
 * English, by capability: marketplace.view for the pages, marketplace.act for every POST. Anyone else gets the sealed
 * 404 of requireOps.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const BASE = "/ops/marketplace/products";

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-mp-${role}-${tag()}@vnx.si`, role);
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
/** Every POST form in the page's <main> (the shell's sign-out form sits outside it). */
const actionForms = (main: string) => [...main.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]).filter((f) => f.includes('method="post"'));
const auditCount = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1").bind(entityId).first<{ n: number }>())!.n;
const statusCount = async (status: string) => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM products WHERE status = ?1").bind(status).first<{ n: number }>())!.n;
const kinds = async (id: string) => (await listActiveBadges(testEnv.DB, id)).map((b) => b.kind).sort();
const submit = (id: string) => setProductStatus(testEnv.DB, { id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });

/** A ready product in the given status (draft → in_review → published → suspended as needed). */
async function productIn(status: "draft" | "in_review" | "published" | "suspended", name: string) {
  const t = tag();
  const { builder, product } = await makeReadyProduct(`ops-mp-${t}@vnx.si`, `mp-${t}`, `${name} ${t}`);
  if (status === "in_review") await submit(product.id);
  if (status === "published" || status === "suspended") await publishProduct(product.id);
  if (status === "suspended") await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "suspended", reviewNote: null, now: new Date().toISOString() });
  return { builder, product: (await findProductById(testEnv.DB, product.id))!, t };
}

describe("who may open the Products queue (AC2, AC3)", () => {
  it("answers 200 to the Owner, an Operator and a Viewer, list and detail, in OpsLayout", async () => {
    const { product } = await productIn("in_review", "Who Kit");
    for (const role of ["owner", "operator", "viewer"] as const) {
      const { cookie } = await asRole(role);
      for (const path of [BASE, `${BASE}/${product.id}`]) {
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
    const { product } = await productIn("in_review", "Seal Kit");
    const sealed = async (path: string, opts: { cookie?: string; form?: Record<string, string> } = {}) => {
      const ray = `ray-${tag()}`;
      const res = await send(path, { ...opts, ray });
      return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
    };
    const reference = await sealed("/ops/khong-ton-tai");
    const content = await asRole("content");
    const plain = await signIn(`ops-mp-plain-${tag()}@vnx.si`);
    const cases = {
      contentList: await sealed(BASE, { cookie: content.cookie }),
      contentDetail: await sealed(`${BASE}/${product.id}`, { cookie: content.cookie }),
      contentEdited: await sealed(`${BASE}?view=edited`, { cookie: content.cookie }),
      anonymousList: await sealed(BASE),
      anonymousDetail: await sealed(`${BASE}/${product.id}`),
      noRoleDetail: await sealed(`${BASE}/${product.id}`, { cookie: plain.cookie }),
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
        ["in_review", "approve", {}],
        ["in_review", "request_changes", { note: "Add a screenshot" }],
        ["published", "suspend", { note: "Broken" }],
        ["suspended", "unsuspend", {}],
        ["published", "badges", { kind: "demo_verified", evidence: "Tried it" }],
        ["published", "badges/in_production/revoke", { reason: "Stopped" }],
      ] as const) {
        const { product } = await productIn(status, `RO ${role} ${action}`);
        if (action.startsWith("badges/")) await grantBadge(testEnv.DB, { productId: product.id, kind: "in_production", verifiedBy: null, evidence: "Live", now: new Date().toISOString() });
        const before = await kinds(product.id);
        clearOutbox();
        const res = await post(`${BASE}/${product.id}/${action}`, cookie, form);
        expect(res.status, `${role} ${action}`).toBe(404);
        expect(await res.text(), `${role} ${action}`).not.toContain(product.id);
        expect((await findProductById(testEnv.DB, product.id))?.status, `${role} ${action}`).toBe(status);
        expect(await kinds(product.id), `${role} ${action}`).toEqual(before);
        expect(await auditCount(product.id), `${role} ${action}`).toBe(0);
        expect(outbox, `${role} ${action}`).toHaveLength(0);
      }
    }
  });

  it("answers the sealed 404 for an unknown product, on GET and POST", async () => {
    const { cookie } = await asRole("owner");
    const reference = await (await send("/ops/khong-ton-tai")).text();
    const strip = (html: string) => html.replace(/ray-[0-9a-f]{8}|[0-9a-f-]{36}/g, "");
    const detail = await send(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ`, { cookie });
    expect(detail.status).toBe(404);
    expect(strip(await detail.text())).toBe(strip(reference));
    for (const [action, form] of [
      ["approve", {}],
      ["request_changes", { note: "x" }],
      ["badges", { kind: "demo_verified", evidence: "x" }],
      ["badges/demo_verified/revoke", { reason: "x" }],
    ] as const) {
      expect((await post(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ/${action}`, cookie, form)).status, action).toBe(404);
    }
    // A badge kind that cannot be revoked is not a route either.
    const { product } = await productIn("published", "Listed Kit");
    expect((await post(`${BASE}/${product.id}/badges/listed/revoke`, cookie, { reason: "x" })).status).toBe(404);
    expect(await kinds(product.id)).toEqual(["listed"]);
  });
});

describe("list: status tabs and search in the URL (AC4)", () => {
  it("opens on In review, with a count on every status tab and a Recently edited tab", async () => {
    const { t } = await productIn("in_review", "Waiting Kit");
    await productIn("draft", `Drafted Kit ${t}`);
    const { cookie } = await asRole("operator");
    const main = mainOf((await get(BASE, cookie)).html);
    expect(main).toContain("<h1>Products</h1>");
    expect(main).toContain(`Waiting Kit ${t}`);
    expect(main).not.toContain(`Drafted Kit ${t}`);
    const tabs = /<nav class="ops-tabs"[^>]*>([\s\S]*?)<\/nav>/.exec(main)?.[1] ?? "";
    for (const [status, label] of [
      ["draft", "Draft"],
      ["in_review", "In review"],
      ["changes_requested", "Changes requested"],
      ["published", "Published"],
      ["unlisted", "Hidden"],
      ["suspended", "Suspended"],
      ["archived", "Archived"],
    ] as const) {
      const n = await statusCount(status);
      expect(tabs, status).toMatch(new RegExp(`<a class="ops-tab" href="${BASE}\\?status=${status}"[^>]*>${label} <span class="ops-tab-n">${n}</span></a>`));
    }
    expect(tabs).toMatch(new RegExp(`href="${BASE}\\?status=in_review" aria-current="page"`));
    expect(tabs).toMatch(new RegExp(`<a class="ops-tab" href="${BASE}\\?view=edited">Recently edited <span class="ops-tab-n">\\d+</span></a>`));
  });

  it("filters by ?status= and ignores a value outside the list", async () => {
    const { t } = await productIn("suspended", "Suspended Kit");
    await productIn("in_review", `Reviewed Kit ${t}`);
    const { cookie } = await asRole("owner");
    const suspended = mainOf((await get(`${BASE}?status=suspended`, cookie)).html);
    expect(suspended).toContain(`Suspended Kit ${t}`);
    expect(suspended).not.toContain(`Reviewed Kit ${t}`);
    for (const odd of ["deleted", "IN_REVIEW", ""]) {
      const main = mainOf((await get(`${BASE}?status=${odd}&view=nope`, cookie)).html);
      expect(main, odd).toContain(`Reviewed Kit ${t}`);
      expect(main, odd).toMatch(new RegExp(`href="${BASE}\\?status=in_review" aria-current="page"`));
    }
  });

  it("lists published products edited in the last 14 days on ?view=edited, as the admin queue did", async () => {
    const fresh = await productIn("published", "Fresh Edit Kit");
    const old = await productIn("published", "Old Edit Kit");
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(fresh.product.id, new Date().toISOString()).run();
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(old.product.id, new Date(Date.now() - 15 * 86_400_000).toISOString()).run();
    const { cookie } = await asRole("viewer");
    const main = mainOf((await get(`${BASE}?view=edited`, cookie)).html);
    expect(main).toContain(`Fresh Edit Kit ${fresh.t}`);
    expect(main).not.toContain(`Old Edit Kit ${old.t}`);
    expect(main).toMatch(new RegExp(`href="${BASE}\\?view=edited" aria-current="page"`));
    expect(main).toContain('<th scope="col">Edited</th>');
    expect(main).toContain(`href="${BASE}/${fresh.product.id}?view=edited"`);
    // The search narrows this view too.
    expect(mainOf((await get(`${BASE}?view=edited&q=nothing-${fresh.t}`, cookie)).html)).toContain("No products match this search.");
  });

  it("searches name and slug, case-insensitive, and keeps the search in the tabs and row links", async () => {
    const hit = await productIn("in_review", "Searchable Kit");
    const other = await productIn("in_review", "Unrelated Kit");
    const { cookie } = await asRole("viewer");
    for (const q of [`SEARCHABLE KIT ${hit.t}`, hit.product.slug]) {
      const main = mainOf((await get(`${BASE}?q=${encodeURIComponent(q)}`, cookie)).html);
      expect(main, q).toContain(`Searchable Kit ${hit.t}`);
      expect(main, q).not.toContain(`Unrelated Kit ${other.t}`);
    }
    const q = hit.product.slug;
    const main = mainOf((await get(`${BASE}?status=in_review&q=${q}`, cookie)).html);
    expect(main).toContain(`value="${q}"`);
    expect(main).toContain(`href="${BASE}?status=published&amp;q=${q}"`);
    expect(main).toContain(`href="${BASE}?view=edited&amp;q=${q}"`);
    expect(main).toContain(`href="${BASE}/${hit.product.id}?status=in_review&amp;q=${q}"`);
    expect(main).toContain("1 shown");
  });

  it("treats LIKE wildcards as plain text and ignores a search longer than 100 characters", async () => {
    const { t } = await productIn("in_review", "Wildcard Kit");
    const { cookie } = await asRole("owner");
    const percent = mainOf((await get(`${BASE}?q=%25`, cookie)).html);
    expect(percent).not.toContain(`Wildcard Kit ${t}`);
    expect(percent).toContain("No products match this search.");
    const long = mainOf((await get(`${BASE}?q=${"x".repeat(101)}`, cookie)).html);
    expect(long).toContain(`Wildcard Kit ${t}`);
    expect(long).not.toContain('value="xxxx');
  });

  it("shows the product, status, builder, slug, category and last change columns", async () => {
    const { product, t } = await productIn("in_review", "Columns Kit");
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}?q=${product.slug}`, cookie)).html);
    for (const text of ["Product", "Status", "Handle", "Slug", "Category", "Last change"]) expect(main, text).toContain(`<th scope="col">${text}</th>`);
    for (const text of [`Columns Kit ${t}`, `mp-${t}`, product.slug, "Booking", "In review"]) expect(main, text).toContain(text);
  });
});

describe("detail and actions (AC1, AC2)", () => {
  beforeEach(() => clearOutbox());

  it("shows what the admin page showed and, for a Viewer, no form and no action button", async () => {
    const { product, t } = await productIn("published", "Viewed Kit");
    await grantBadge(testEnv.DB, { productId: product.id, kind: "in_production", verifiedBy: null, evidence: "Live at a clinic", now: new Date().toISOString() });
    const { cookie } = await asRole("viewer");
    const main = mainOf((await get(`${BASE}/${product.id}?status=published&q=Viewed`, cookie)).html);
    for (const text of [
      `Viewed Kit ${t}`,
      `Viewed Kit ${t} in one line`,
      `mp-${t}`,
      `ops-mp-${t}@vnx.si`,
      `/p/${product.slug}`,
      "Booking",
      "Bookings get lost",
      "Spa owners",
      "Calendar",
      "Hono",
      "Starter",
      "$19",
      "One location",
      "Email within 48h",
      "Listed",
      "In production",
      "Live at a clinic",
    ]) {
      expect(main, text).toContain(text);
    }
    expect(main).toMatch(/<a href="https:\/\/demo\.example" rel="nofollow ugc noopener"/);
    expect(main).toContain(`src="/media/products/${product.id}/`);
    expect(main).toContain('alt="Cover"');
    expect(main).toContain(`href="/ops/marketplace/builders/${product.builderId}"`);
    expect(main).toContain(`href="${BASE}?status=published&amp;q=Viewed"`);
    expect(actionForms(main)).toEqual([]);
    expect(main).not.toContain("<button");
    expect(main).not.toContain("<textarea");
    expect(main).not.toContain("<select");
  });

  it("lets the Owner approve: published, listed badge, e-mail and audit as /admin, then 303 back with the filter", async () => {
    const t = tag();
    const email = `ops-mp-ok-${t}@vnx.si`;
    await ensureUser(email, "vi");
    const { product } = await makeReadyProduct(email, `mp-ok-${t}`, `Approve Kit ${t}`);
    await submit(product.id);
    const { user, cookie } = await asRole("owner");
    const detail = mainOf((await get(`${BASE}/${product.id}?status=in_review`, cookie)).html);
    expect(actionForms(detail)).toContain(`<form method="post" action="${BASE}/${product.id}/approve?status=in_review">`);

    const res = await post(`${BASE}/${product.id}/approve?status=in_review&q=zz`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${product.id}?status=in_review&q=zz&done=1`);
    const after = await findProductById(testEnv.DB, product.id);
    expect(after).toMatchObject({ status: "published", reviewNote: null });
    expect(after?.firstPublishedAt).not.toBeNull();
    expect((await listActiveBadges(testEnv.DB, product.id)).map((b) => [b.kind, b.verifiedBy])).toEqual([["listed", null]]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: email, subject: "Sản phẩm của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/p/${after!.slug}`);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'product.approve' AND entity_id = ?1").bind(product.id).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ from: "in_review", to: "published", note: null });

    const page = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(page).toMatch(/<p class="ops-notice ops-notice-ok" role="status">[\s\S]*Saved\.[\s\S]*<\/p>/);
    expect(page).toContain("Published");
  });

  it("lets an Operator request changes behind a confirmation, with a required note sent to the builder", async () => {
    const { product } = await productIn("in_review", "Changes Kit");
    const { cookie } = await asRole("operator");
    const detail = mainOf((await get(`${BASE}/${product.id}`, cookie)).html);
    expect(detail).toMatch(
      new RegExp(`<details class="ops-confirm"><summary class="ops-btn ops-btn-danger">Request changes…</summary>[\\s\\S]*?<form method="post" action="${BASE}/${product.id}/request_changes">`),
    );

    const missing = await post(`${BASE}/${product.id}/request_changes`, cookie, { note: "  " });
    expect(missing.status).toBe(400);
    const html = await missing.text();
    expect(html).toContain("Enter a note (up to 1000 characters).");
    expect(html).toContain('<details class="ops-confirm" open="">');
    expect(html).toContain('<html lang="en">');
    expect(outbox).toHaveLength(0);
    expect(await auditCount(product.id)).toBe(0);
    expect((await findProductById(testEnv.DB, product.id))?.status).toBe("in_review");

    const res = await post(`${BASE}/${product.id}/request_changes`, cookie, { note: "Add a real screenshot\r\nplease" });
    expect(res.headers.get("location")).toBe(`${BASE}/${product.id}?done=1`);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "changes_requested", reviewNote: "Add a real screenshot\nplease" });
    expect(outbox[0]!.text).toContain("Add a real screenshot");
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'product.request_changes' AND entity_id = ?1").bind(product.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ from: "in_review", to: "changes_requested", note: "Add a real screenshot\nplease" });
  });

  it("suspends with an optional note behind a confirmation and unsuspends, repairing the listed badge, no e-mail", async () => {
    const { product } = await productIn("published", "Suspend Kit");
    const { cookie } = await asRole("owner");
    expect(mainOf((await get(`${BASE}/${product.id}`, cookie)).html)).toMatch(/<summary class="ops-btn ops-btn-danger">Suspend…<\/summary>/);
    expect((await post(`${BASE}/${product.id}/suspend`, cookie, { note: "Broken demo" })).status).toBe(303);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "suspended", reviewNote: "Broken demo" });
    await revokeBadge(testEnv.DB, { productId: product.id, kind: "listed", reason: "test", now: new Date().toISOString() });
    const unsuspend = mainOf((await get(`${BASE}/${product.id}`, cookie)).html);
    expect(actionForms(unsuspend)).toContain(`<form method="post" action="${BASE}/${product.id}/unsuspend">`);
    expect((await post(`${BASE}/${product.id}/unsuspend`, cookie)).status).toBe(303);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "published", reviewNote: null });
    expect((await listActiveBadges(testEnv.DB, product.id)).map((b) => [b.kind, b.verifiedBy])).toEqual([["listed", null]]);
    const actions = await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(product.id).all<{ action: string }>();
    expect(actions.results.map((r) => r.action)).toEqual(["product.suspend", "product.unsuspend"]);
    expect(outbox).toHaveLength(0);
  });

  it("answers 409 for a move the state machine does not allow, and changes nothing", async () => {
    const { product } = await productIn("published", "Conflict Kit");
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${product.id}/approve`, cookie);
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("The status changed before your action, so nothing was saved.");
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "published" });
    expect(await auditCount(product.id)).toBe(0);
  });

  it("keeps the approval and says so when the e-mail fails", async () => {
    const { product } = await productIn("in_review", "No Mail Kit");
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${product.id}/approve`, cookie, {}, { ...env, MAIL_DRIVER: undefined } as Bindings);
    expect(res.headers.get("location")).toBe(`${BASE}/${product.id}?done=mail_failed`);
    expect((await findProductById(testEnv.DB, product.id))?.status).toBe("published");
    const main = mainOf((await get(res.headers.get("location")!, cookie)).html);
    expect(main).toMatch(/<p class="ops-notice ops-notice-warn" role="alert">[\s\S]*couldn&#39;t be sent[\s\S]*<\/p>/);
  });

  it("grants a badge with evidence, once, writing the same audit row as /admin", async () => {
    const { product } = await productIn("published", "Grant Kit");
    const { user, cookie } = await asRole("operator");
    const detail = mainOf((await get(`${BASE}/${product.id}?status=published`, cookie)).html);
    expect(actionForms(detail)).toContain(`<form method="post" action="${BASE}/${product.id}/badges?status=published">`);

    const noEvidence = await post(`${BASE}/${product.id}/badges`, cookie, { kind: "in_production", evidence: " " });
    expect(noEvidence.status).toBe(400);
    const html = await noEvidence.text();
    expect(html).toContain("Describe the evidence (up to 500 characters).");
    expect(html).toContain('<html lang="en">');
    const badKind = await post(`${BASE}/${product.id}/badges`, cookie, { kind: "listed", evidence: "x" });
    expect(badKind.status).toBe(400);
    expect(await badKind.text()).toContain("Choose a badge.");
    expect(await kinds(product.id)).toEqual(["listed"]);
    expect(await auditCount(product.id)).toBe(0);

    const res = await post(`${BASE}/${product.id}/badges?status=published`, cookie, { kind: "demo_verified", evidence: "Booked a slot on the demo" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${product.id}?status=published&done=1`);
    expect((await listActiveBadges(testEnv.DB, product.id)).find((b) => b.kind === "demo_verified")).toMatchObject({ verifiedBy: user.id, evidence: "Booked a slot on the demo" });
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'badge.grant' AND entity_id = ?1").bind(product.id).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ kind: "demo_verified", evidence: "Booked a slot on the demo" });

    const again = await post(`${BASE}/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Again" });
    expect(again.status).toBe(409);
    expect(await auditCount(product.id)).toBe(1);
    // Both grantable badges active: no grant form any more.
    await post(`${BASE}/${product.id}/badges`, cookie, { kind: "in_production", evidence: "Live at a client" });
    expect(actionForms(mainOf((await get(`${BASE}/${product.id}`, cookie)).html))).not.toContain(`<form method="post" action="${BASE}/${product.id}/badges">`);
  });

  it("revokes a badge behind a confirmation with a required reason", async () => {
    const { product } = await productIn("published", "Revoke Kit");
    const { user, cookie } = await asRole("owner");
    await post(`${BASE}/${product.id}/badges`, cookie, { kind: "in_production", evidence: "Live at a client" });
    const detail = mainOf((await get(`${BASE}/${product.id}`, cookie)).html);
    expect(detail).toMatch(
      new RegExp(`<details class="ops-confirm"><summary class="ops-btn ops-btn-danger">Revoke…</summary>[\\s\\S]*?<form method="post" action="${BASE}/${product.id}/badges/in_production/revoke">`),
    );
    // The system "listed" badge has no revoke form.
    expect(detail).not.toContain(`/badges/listed/revoke`);

    const missing = await post(`${BASE}/${product.id}/badges/in_production/revoke`, cookie, { reason: "" });
    expect(missing.status).toBe(400);
    const html = await missing.text();
    expect(html).toContain("Enter a reason (up to 300 characters).");
    expect(html).toContain('<details class="ops-confirm" open="">');
    expect(await kinds(product.id)).toEqual(["in_production", "listed"]);

    const res = await post(`${BASE}/${product.id}/badges/in_production/revoke`, cookie, { reason: "Client stopped using it" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${product.id}?done=1`);
    expect(await kinds(product.id)).toEqual(["listed"]);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'badge.revoke' AND entity_id = ?1").bind(product.id).first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit!.data)).toEqual({ kind: "in_production", reason: "Client stopped using it" });
    expect((await post(`${BASE}/${product.id}/badges/in_production/revoke`, cookie, { reason: "Again" })).status).toBe(409);
  });

  it("refuses a cross-site POST (Origin check) before anything changes", async () => {
    const { product } = await productIn("in_review", "Origin Kit");
    const { cookie } = await asRole("owner");
    const request = new Request(`https://vnx.si${BASE}/${product.id}/approve`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: "x=1",
    });
    const res = await createApp().request(request, undefined, env);
    expect(res.status).toBe(403);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "in_review" });
  });
});

describe("history (AC5)", () => {
  it("lists this product's audit rows in the safe projection, newest first, never the data", async () => {
    const { product, t } = await productIn("in_review", "History Kit");
    const other = await productIn("in_review", "Other History Kit");
    const { cookie } = await asRole("owner");
    await post(`${BASE}/${product.id}/request_changes`, cookie, { note: `Secret note ${t}` });
    const outsider = await ensureUser(`ops-mp-outsider-${t}@vnx.si`);
    const insert = testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, 'product', ?4, ?5, ?6)");
    await testEnv.DB.batch([
      insert.bind(`01PHISTA${t}`, outsider.id, "product.submit", product.id, `{"note":"private ${t}"}`, "2030-01-01T10:00:00.000Z"),
      insert.bind(`01PHISTB${t}`, null, "product.other", other.product.id, "{}", "2030-01-01T11:00:00.000Z"),
    ]);
    const main = mainOf((await get(`${BASE}/${product.id}`, cookie)).html);
    const history = /<section class="ops-card ops-history"[^>]*>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? "";
    expect(history).toContain("<h2");
    const rows = [...history.matchAll(/<li data-audit="([^"]+)"/g)].map((m) => m[1]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(`01PHISTA${t}`);
    expect(history).toContain("product.submit");
    expect(history).toContain("product.request_changes");
    expect(history).toContain(ROOT);
    expect(history).not.toContain(`ops-mp-outsider-${t}@vnx.si`);
    expect(history).toContain(outsider.id);
    expect(history).not.toContain("product.other");
    expect(history).not.toContain(`private ${t}`);
    // The note is shown once, as the product's review note, never from the audit data.
    expect(main.split(`Secret note ${t}`).length - 1).toBe(1);
  });

  it("says so when there is no history", async () => {
    const { product } = await productIn("in_review", "No History Kit");
    const { cookie } = await asRole("viewer");
    expect(mainOf((await get(`${BASE}/${product.id}`, cookie)).html)).toContain("No audit entries for this product yet.");
  });
});

describe("menu and breadcrumb (AC7)", () => {
  it("marks Products current with its in-review count on the list and the detail page", async () => {
    const { product } = await productIn("in_review", "Menu Kit");
    const n = await statusCount("in_review");
    const { cookie } = await asRole("viewer");
    for (const path of [BASE, `${BASE}/${product.id}`]) {
      const html = (await get(path, cookie)).html;
      expect(html, path).toMatch(new RegExp(`<a class="ops-nav-link" href="${BASE}" aria-current="page">[\\s\\S]*?Products<span class="ops-nav-n"><span class="visually-hidden">waiting:</span>${n}</span></a>`));
      expect(html, path).toMatch(/<nav class="ops-crumb" aria-label="Breadcrumb">[\s\S]*?Ops[\s\S]*?Marketplace[\s\S]*?<span aria-current="page">/);
    }
  });
});

describe("CSP and headers on the new pages (AC8)", () => {
  it("has nothing inline and no no-referrer policy on pages with POST forms", async () => {
    const { product } = await productIn("published", "CSP Kit");
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}?view=edited`, `${BASE}/${product.id}`]) {
      const { res, html } = await get(path, cookie);
      expect(html, path).not.toMatch(/\sstyle=/);
      expect(html, path).not.toMatch(/<style\b/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      expect(html, path).not.toMatch(/<script\b/);
      expect(res.headers.get("referrer-policy"), path).not.toBe("no-referrer");
    }
  });
});
