import { ulid } from "../../src/lib/ulid.ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { createApp } from "../../src/app.ts";
import { countPublicationReviewQueue, findPublicationByRequestId, findPublicListing, optInStatement, rejectStatement, returnedPublication, type Publication } from "../../src/db/request-board.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import { opsBoardActions, PUBLIC_DESCRIPTION_MAX, wordingEdited } from "../../src/domain/request-board.ts";
import type { Bindings } from "../../src/env.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import { ensureUser, makeRequest, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2704a: the "Public listing" block of /ops/marketplace/requests/:id (addendum §3.2, §5, §7.1). Publish, edit, reject and unpublish
 * are Owner and Operator only (marketplace.act); every write is one batch with its compare-and-set and a guarded audit row.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const BASE = "/ops/marketplace/requests";
const DESC = "We need online booking with SMS reminders for three salons in Hanoi.";
const ORIGINAL = "ORIGINAL-SECRET-TITLE";
const ORIGINAL_DESC = "ORIGINAL-SECRET-DESCRIPTION for the salons, with many details that should never be public.";
const ACTIONS = ["publish", "edit", "reject", "unpublish"] as const;

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-bd-${role}-${tag()}@vnx.si`, role);
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
const get = async (path: string, cookie?: string) => {
  const res = await send(path, { cookie });
  return { res, html: await res.text() };
};
const post = (path: string, cookie: string | undefined, form: Record<string, string>, bindings: Bindings = env) => send(path, { cookie, form }, bindings);

const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";

type Fixture = { requestId: string; clientId: string; publication: Publication; text: string };

async function listing(opts: { state?: "pending_review" | "published"; requestStatus?: string; title?: string; description?: string } = {}): Promise<Fixture> {
  const text = tag();
  const made = await makeRequest({ tag: `ops-bd-${text}`, title: opts.title ?? `${ORIGINAL} ${text}`, description: opts.description ?? ORIGINAL_DESC });
  const now = new Date().toISOString();
  const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId: made.request.id, consentVersion: "2026-01-01", now, clientUserId: made.client.id })]);
  const publication = returnedPublication(res);
  if (!publication) throw new Error("opt-in failed");
  if (opts.requestStatus && opts.requestStatus !== "submitted") await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(made.request.id, opts.requestStatus).run();
  const fixture: Fixture = { requestId: made.request.id, clientId: made.client.id, publication, text };
  if (opts.state === "published") {
    const ops = await ensureUser(`ops-bd-pre-${text}@vnx.si`);
    const later = new Date(Date.now() + 5).toISOString();
    const [p] = await testEnv.DB.batch([
      testEnv.DB
        .prepare(
          `UPDATE request_publications SET status = 'published', public_title = ?2, public_description = ?3, published_at = ?4, reviewed_by = ?5, reviewed_at = ?4, updated_at = ?4
           WHERE request_id = ?1 RETURNING *`,
        )
        .bind(made.request.id, `E2E board ${text}`, `Public wording ${text}. ${DESC}`, later, ops.id),
    ]);
    fixture.publication = returnedPublication(p)!;
  }
  return fixture;
}

const pubOf = async (id: string) => (await findPublicationByRequestId(testEnv.DB, id))!;
const auditRows = (entityId: string) =>
  testEnv.DB.prepare("SELECT action, entity, entity_id, actor_user_id, data FROM audit_log WHERE entity = 'request_publication' AND entity_id = ?1 ORDER BY id").bind(entityId).all<{ action: string; entity: string; entity_id: string; actor_user_id: string | null; data: string }>().then((r) => r.results);
const auditCount = async (id: string) => (await auditRows(id)).length;

const wording = (text: string) => ({ public_title: `E2E board edited ${text}`, public_description: `Edited public wording ${text}. ${DESC}` });
const formFor = (f: Fixture, extra: Record<string, string> = {}, updatedAt = f.publication.updatedAt) => ({ updated_at: updatedAt, ...extra });
const url = (id: string, action: string) => `${BASE}/${id}/publication/${action}`;

describe("who sees the Public listing block", () => {
  it("shows Owner and Operator the original, the editable wording, the read-only structured fields and the allowed buttons", async () => {
    const f = await listing({ title: `${ORIGINAL} one`, description: ORIGINAL_DESC });
    for (const role of ["owner", "operator"] as const) {
      const { cookie } = await asRole(role);
      const { res, html } = await get(`${BASE}/${f.requestId}`, cookie);
      expect(res.status, role).toBe(200);
      const main = mainOf(html);
      expect(main, role).toContain('id="pl-block"');
      expect(main, role).toContain("Public listing");
      expect(main, role).toContain(ORIGINAL_DESC);
      // Pre-filled from the original when no public wording exists yet.
      expect(main, role).toMatch(/<input[^>]*id="pl-public-title"[^>]*value="ORIGINAL-SECRET-TITLE one"/);
      expect(main, role).toMatch(/<textarea[^>]*id="pl-public-description"[^>]*>\s*ORIGINAL-SECRET-DESCRIPTION/);
      expect(main, role).toContain(`action="${url(f.requestId, "publish")}"`);
      expect(main, role).toContain(`action="${url(f.requestId, "reject")}"`);
      expect(main, role).not.toContain(`action="${url(f.requestId, "edit")}"`);
      expect(main, role).not.toContain(`action="${url(f.requestId, "unpublish")}"`);
      expect(main, role).toContain(`name="updated_at" value="${f.publication.updatedAt}"`);
      // Structured fields are read-only text, not inputs (Q4), and the moderation checklist is in the block.
      expect(main, role).not.toMatch(/name="(category|budget_band|country|deadline|languages)"/);
      expect(main, role).toContain("pl-checklist");
      // No action carries a fragment.
      for (const m of main.matchAll(/<form\b[^>]*action="([^"]*)"/g)) expect(m[1], role).not.toContain("#");
    }
  });

  it("offers Edit and Unpublish (not Publish and Reject) on a published listing, with the status and dates", async () => {
    const f = await listing({ state: "published" });
    const { cookie } = await asRole("operator");
    const { html } = await get(`${BASE}/${f.requestId}`, cookie);
    const main = mainOf(html);
    expect(main).toContain(`action="${url(f.requestId, "edit")}"`);
    expect(main).toContain(`action="${url(f.requestId, "unpublish")}"`);
    expect(main).not.toContain(`action="${url(f.requestId, "publish")}"`);
    expect(main).not.toContain(`action="${url(f.requestId, "reject")}"`);
    expect(main).toContain(`E2E board ${f.text}`);
    expect(main).toContain("published");
  });

  it("hides the block, the public wording and its History from a Viewer (200 as before) and from Content (404)", async () => {
    const f = await listing({ state: "published" });
    const viewer = await asRole("viewer");
    const { res, html } = await get(`${BASE}/${f.requestId}`, viewer.cookie);
    expect(res.status).toBe(200);
    expect(html).not.toContain("pl-block");
    expect(html).not.toContain("Public listing");
    expect(html).not.toContain(`E2E board ${f.text}`);
    expect(html).not.toContain("request_publication");
    const content = await asRole("content");
    expect((await get(`${BASE}/${f.requestId}`, content.cookie)).res.status).toBe(404);
  });

  it("shows no block when the request has no publication, and keeps the existing detail page working", async () => {
    const { request } = await makeRequest({ tag: `ops-bd-none-${tag()}` });
    const { cookie } = await asRole("owner");
    const { res, html } = await get(`${BASE}/${request.id}`, cookie);
    expect(res.status).toBe(200);
    expect(html).not.toContain("pl-block");
  });

  it("never offers Publish for a request that is pending_verification, and counts it in no queue until the client confirms (by id, with the real queue query)", async () => {
    const f = await listing({ requestStatus: "pending_verification" });
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}/${f.requestId}`, cookie)).html);
    expect(main).toContain("pl-block");
    expect(main).not.toContain(`action="${url(f.requestId, "publish")}"`);
    expect(main).not.toContain(`action="${url(f.requestId, "reject")}"`);
    expect(main).toContain("confirm");
    // The forged POSTs are refused and write nothing.
    for (const action of ["publish", "reject"] as const) {
      const res = await post(url(f.requestId, action), cookie, formFor(f, { ...wording(f.text), review_note: "no" }));
      expect(res.status, action).toBe(409);
    }
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
    expect(await auditCount(f.requestId)).toBe(0);
    // The real queue count (countPublicationReviewQueue) does not include it, and includes it once the request is submitted.
    const before = await countPublicationReviewQueue(testEnv.DB);
    await testEnv.DB.prepare("UPDATE requests SET status = 'submitted' WHERE id = ?1").bind(f.requestId).run();
    expect(await countPublicationReviewQueue(testEnv.DB)).toBe(before + 1);
    const after = mainOf((await get(`${BASE}/${f.requestId}`, cookie)).html);
    expect(after).toContain(`action="${url(f.requestId, "publish")}"`);
  });
});

describe("who may act (marketplace.act, sealed 404)", () => {
  it("lets the Owner and an Operator publish, edit, unpublish and reject", async () => {
    const operator = await asRole("operator");
    const owner = await asRole("owner");
    const f = await listing();
    const wo = wording(f.text);
    let r = await post(url(f.requestId, "publish"), operator.cookie, formFor(f, wo));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`${BASE}/${f.requestId}?done=1`);
    let p = await pubOf(f.requestId);
    expect(p.status).toBe("published");
    expect(p.reviewedBy).toBe(operator.user.id);
    r = await post(url(f.requestId, "edit"), owner.cookie, formFor(f, { public_title: "E2E board second", public_description: `Second wording ${DESC}` }, p.updatedAt));
    expect(r.status).toBe(303);
    p = await pubOf(f.requestId);
    expect(p).toMatchObject({ status: "published", publicTitle: "E2E board second", reviewedBy: owner.user.id });
    r = await post(url(f.requestId, "unpublish"), operator.cookie, formFor(f, { review_note: "No longer fits the board." }, p.updatedAt));
    expect(r.status).toBe(303);
    expect(await pubOf(f.requestId)).toMatchObject({ status: "unpublished", reviewNote: "No longer fits the board." });
    const g = await listing();
    r = await post(url(g.requestId, "reject"), owner.cookie, formFor(g, { review_note: "Contains a company name." }));
    expect(r.status).toBe(303);
    expect(await pubOf(g.requestId)).toMatchObject({ status: "rejected", reviewNote: "Contains a company name." });
    expect((await auditRows(f.requestId)).map((a) => a.action)).toEqual(["request_publication.publish", "request_publication.edit", "request_publication.unpublish"]);
    expect((await auditRows(g.requestId)).map((a) => a.action)).toEqual(["request_publication.reject"]);
  });

  it("answers Content, Viewer, the anonymous and a suspended Owner-less user with a sealed 404 on every POST, writing nothing", async () => {
    const f = await listing({ state: "published" });
    const pending = await listing();
    const reference = async (path: string) => {
      const ray = `ray-${tag()}`;
      const res = await send(path, { ray, form: { updated_at: "x" } });
      return { status: res.status, body: (await res.text()).replaceAll(ray, "") };
    };
    const callers: Array<[string, string | undefined]> = [
      ["anonymous", undefined],
      ["content", (await asRole("content")).cookie],
      ["viewer", (await asRole("viewer")).cookie],
    ];
    const suspended = await asRole("operator");
    await setUserStatusStatement(testEnv.DB, { id: suspended.user.id, from: "active", to: "suspended", now: new Date().toISOString() }).run();
    callers.push(["suspended operator", suspended.cookie]);
    const before = { f: await pubOf(f.requestId), p: await pubOf(pending.requestId) };
    for (const [who, cookie] of callers) {
      for (const action of ACTIONS) {
        const target = action === "publish" || action === "reject" ? pending : f;
        const ray = `ray-${tag()}`;
        const res = await send(url(target.requestId, action), { cookie, ray, form: { updated_at: target.publication.updatedAt, ...wording("x"), review_note: "reason" } });
        const body = (await res.text()).replaceAll(ray, "");
        expect(res.status, `${who} ${action}`).toBe(404);
        expect(res.headers.get("location"), `${who} ${action}`).toBeNull();
        expect({ status: res.status, body }, `${who} ${action}`).toEqual(await reference(url(target.requestId, action)));
      }
    }
    expect(await pubOf(f.requestId)).toEqual(before.f);
    expect(await pubOf(pending.requestId)).toEqual(before.p);
    expect(await auditCount(f.requestId)).toBe(0);
    expect(await auditCount(pending.requestId)).toBe(0);
  });

  it("refuses an OAuth session of an Operator and of the root Owner (sealed 404, nothing written); the same person by magic link can act", async () => {
    const op = await member(`ops-bd-oauth-${tag()}@vnx.si`, "operator");
    const f = await listing();
    for (const method of ["oauth_google", "oauth_github", "oauth_linkedin"] as const) {
      for (const email of [op.user.email, ROOT]) {
        const oauth = await signIn(email, { method });
        const { res } = await get(`${BASE}/${f.requestId}`, oauth.cookie);
        expect(res.status, `${method} get`).toBe(404);
        for (const action of ACTIONS) {
          const r = await post(url(f.requestId, action), oauth.cookie, formFor(f, { ...wording(f.text), review_note: "reason" }));
          expect(r.status, `${method} ${email} ${action}`).toBe(404);
        }
      }
    }
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
    expect(await auditCount(f.requestId)).toBe(0);
    expect((await post(url(f.requestId, "publish"), op.cookie, formFor(f, wording(f.text)))).status).toBe(303);
  });

  it("answers an unknown request or a request without a publication with the sealed 404", async () => {
    const { cookie } = await asRole("owner");
    const { request } = await makeRequest({ tag: `ops-bd-no-${tag()}` });
    expect((await post(url("01ZZZZZZZZZZZZZZZZZZZZZZZZ", "publish"), cookie, { updated_at: "x", ...wording("x") })).status).toBe(404);
    expect((await post(url(request.id, "publish"), cookie, { updated_at: "x", ...wording("x") })).status).toBe(404);
  });
});

describe("publish", () => {
  it("saves the edited wording, sets published_at once, and the public query sees the edited text and never the original", async () => {
    const { cookie, user } = await asRole("operator");
    const f = await listing();
    const w = wording(f.text);
    const r = await post(url(f.requestId, "publish"), cookie, formFor(f, w));
    expect(r.status).toBe(303);
    const p = await pubOf(f.requestId);
    expect(p).toMatchObject({ status: "published", publicTitle: w.public_title, publicDescription: w.public_description, reviewedBy: user.id });
    expect(p.publishedAt).toBeTruthy();
    expect(p.endedAt).toBeNull();
    const pub = await findPublicListing(testEnv.DB, p.publicId);
    expect(pub?.publicTitle).toBe(w.public_title);
    expect(JSON.stringify(pub)).not.toContain(ORIGINAL);
    expect(JSON.stringify(pub)).not.toContain("ORIGINAL-SECRET-DESCRIPTION");
    expect(JSON.stringify(pub)).not.toContain(f.requestId);
  });

  it("keeps the original published_at when a re-opted-in listing is published again", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text)));
    const first = await pubOf(f.requestId);
    await testEnv.DB.prepare("UPDATE request_publications SET status = 'pending_review', updated_at = ?2 WHERE request_id = ?1").bind(f.requestId, new Date(Date.now() + 10).toISOString()).run();
    const again = await pubOf(f.requestId);
    expect((await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text), again.updatedAt))).status).toBe(303);
    expect((await pubOf(f.requestId)).publishedAt).toBe(first.publishedAt);
  });

  it("refuses with 409 and writes nothing when the request is builder_selected, removed or pending_verification, or the listing is not pending", async () => {
    const { cookie } = await asRole("owner");
    for (const requestStatus of ["builder_selected", "removed", "pending_verification"]) {
      const f = await listing({ requestStatus });
      const r = await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text)));
      expect(r.status, requestStatus).toBe(409);
      expect(await pubOf(f.requestId), requestStatus).toEqual(f.publication);
      expect(await auditCount(f.requestId), requestStatus).toBe(0);
    }
    const published = await listing({ state: "published" });
    expect((await post(url(published.requestId, "publish"), cookie, formFor(published, wording("x")))).status).toBe(409);
    expect(await auditCount(published.requestId)).toBe(0);
  });

  it("is 409 with no audit for a stale updated_at, and the second of two publishes is 409", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const stale = await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text), "2020-01-01T00:00:00.000Z"));
    expect(stale.status).toBe(409);
    expect(await auditCount(f.requestId)).toBe(0);
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
    expect((await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text)))).status).toBe(303);
    expect((await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text)))).status).toBe(409);
    expect(await auditCount(f.requestId)).toBe(1);
  });

  it("a rejected listing cannot be published (409)", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "Too vague." }));
    const rejected = await pubOf(f.requestId);
    const r = await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text), rejected.updatedAt));
    expect(r.status).toBe(409);
    expect((await pubOf(f.requestId)).status).toBe("rejected");
  });
});

describe("edit", () => {
  it("changes the wording only: status and published_at stay, one .edit audit row", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing({ state: "published" });
    const before = await pubOf(f.requestId);
    const r = await post(url(f.requestId, "edit"), cookie, formFor(f, { public_title: "E2E board changed", public_description: `Changed wording. ${DESC}` }, before.updatedAt));
    expect(r.status).toBe(303);
    const after = await pubOf(f.requestId);
    expect(after).toMatchObject({ status: "published", publicTitle: "E2E board changed", publishedAt: before.publishedAt });
    const rows = await auditRows(f.requestId);
    expect(rows.map((a) => a.action)).toEqual(["request_publication.edit"]);
  });

  it("is 409 on a listing that is pending_review", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    expect((await post(url(f.requestId, "edit"), cookie, formFor(f, wording(f.text)))).status).toBe(409);
    expect(await auditCount(f.requestId)).toBe(0);
  });
});

describe("reject", () => {
  it("needs a reason (400, nothing written); with one the listing is rejected and the request keeps its status", async () => {
    const { cookie } = await asRole("operator");
    for (const requestStatus of ["submitted", "matching"]) {
      const f = await listing({ requestStatus });
      const bad = await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "   " }));
      expect(bad.status).toBe(400);
      expect(await pubOf(f.requestId)).toEqual(f.publication);
      expect(await auditCount(f.requestId)).toBe(0);
      const ok = await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "Please remove the names." }));
      expect(ok.status).toBe(303);
      const p = await pubOf(f.requestId);
      expect(p).toMatchObject({ status: "rejected", reviewNote: "Please remove the names." });
      expect(p.endedAt).toBeTruthy();
      const row = await testEnv.DB.prepare("SELECT status FROM requests WHERE id = ?1").bind(f.requestId).first<{ status: string }>();
      expect(row?.status).toBe(requestStatus);
    }
  });

  it("is 400 for a reason over 1000 characters", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    expect((await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "x".repeat(1001) }))).status).toBe(400);
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
  });
});

describe("unpublish", () => {
  it("needs a reason (400); with one the listing is unpublished, ended, and the public query no longer finds it", async () => {
    const { cookie } = await asRole("operator");
    const f = await listing({ state: "published" });
    expect((await post(url(f.requestId, "unpublish"), cookie, formFor(f, { review_note: "" }))).status).toBe(400);
    expect((await pubOf(f.requestId)).status).toBe("published");
    expect((await post(url(f.requestId, "unpublish"), cookie, formFor(f, { review_note: "Duplicate of another request." }))).status).toBe(303);
    const p = await pubOf(f.requestId);
    expect(p).toMatchObject({ status: "unpublished", reviewNote: "Duplicate of another request." });
    expect(p.endedAt).toBeTruthy();
    expect(await findPublicListing(testEnv.DB, p.publicId)).toBeNull();
  });
});

describe("audit in the same batch", () => {
  it("writes exactly one request_publication row on success, with only { requestId, from, to } in data", async () => {
    const { cookie, user } = await asRole("owner");
    const f = await listing();
    const w = { public_title: `E2E board IDENT-${f.text}`, public_description: `IDENT-DESC-${f.text} ${DESC}` };
    await post(url(f.requestId, "publish"), cookie, formFor(f, w));
    const rows = await auditRows(f.requestId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "request_publication.publish", entity: "request_publication", entity_id: f.requestId, actor_user_id: user.id });
    expect(JSON.parse(rows[0]!.data)).toEqual({ requestId: f.requestId, from: "pending_review", to: "published" });
    expect(rows[0]!.data).not.toContain("IDENT");
    const g = await listing();
    await post(url(g.requestId, "reject"), cookie, formFor(g, { review_note: `NOTE-IDENT-${g.text}` }));
    const rejected = await auditRows(g.requestId);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.data).not.toContain("NOTE-IDENT");
    expect(rejected[0]!.data).not.toContain(user.email);
    expect(rejected[0]!.data).not.toContain("Minh Tran");
  });

  it("writes no audit row when the batch loses the compare-and-set after the page was read (a concurrent change)", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const racing = {
      ...testEnv,
      ADMIN_EMAILS: ROOT,
      DB: new Proxy(testEnv.DB, {
        get(target, key) {
          const value = (target as unknown as Record<string | symbol, unknown>)[key];
          if (key === "batch") {
            return async (statements: D1PreparedStatement[]) => {
              await target.prepare("UPDATE request_publications SET updated_at = ?2 WHERE request_id = ?1").bind(f.requestId, new Date(Date.now() + 50).toISOString()).run();
              return target.batch(statements);
            };
          }
          return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      }),
    } as unknown as Bindings;
    const r = await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text)), racing);
    expect(r.status).toBe(409);
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
    expect(await auditCount(f.requestId)).toBe(0);
  });

  it("shows the block's History with action and entity but no wording", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const w = { public_title: `E2E board HIST-${f.text}`, public_description: `HIST-DESC-${f.text} ${DESC}` };
    await post(url(f.requestId, "publish"), cookie, formFor(f, w));
    const after = await pubOf(f.requestId);
    await post(url(f.requestId, "unpublish"), cookie, formFor(f, { review_note: `HIST-NOTE-${f.text}` }, after.updatedAt));
    const { html } = await get(`${BASE}/${f.requestId}`, cookie);
    const history = /<section[^>]*ops-history[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(history).toContain("request_publication.publish");
    expect(history).toContain("request_publication.unpublish");
    expect(history).not.toContain("HIST-");
    expect(html.match(/id="ops-history-h"/g)).toHaveLength(1);
  });
});

describe("the VNX-0807 error pattern on the block", () => {
  it("a 400 re-renders with the error summary, the Error: title prefix, the typed values, aria-invalid and no fragment in any action", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing({ state: "published" });
    const short = "x".repeat(39);
    const r = await post(url(f.requestId, "edit"), cookie, formFor(f, { public_title: "E2E board kept title", public_description: short }));
    const html = await r.text();
    expect(r.status).toBe(400);
    expect(html).toContain('id="form-errors"');
    expect(titleOf(html).startsWith("Error: ")).toBe(true);
    expect(html).toContain('href="#pl-public-description"');
    expect(html).toContain('id="pl-public-description"');
    expect(html).toMatch(/<textarea[^>]*id="pl-public-description"[^>]*aria-invalid="true"[^>]*aria-describedby="pl-public-description-error"/);
    expect(html).toContain('id="pl-public-description-error"');
    expect(html).toContain('value="E2E board kept title"');
    expect(html).toContain(short);
    expect(html).not.toContain('role="alert"');
    for (const m of mainOf(html).matchAll(/<form\b[^>]*action="([^"]*)"/g)) expect(m[1]).not.toContain("#");
    expect((await pubOf(f.requestId)).publicTitle).toBe(f.publication.publicTitle);
  });

  it("reject without a reason: same pattern, with the field id pl-review-note, and the details open", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const r = await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "" }));
    const html = await r.text();
    expect(r.status).toBe(400);
    expect(html).toContain('id="form-errors"');
    expect(titleOf(html).startsWith("Error: ")).toBe(true);
    expect(html).toContain('href="#pl-review-note"');
    expect(html).toMatch(/<textarea[^>]*id="pl-review-note"[^>]*aria-invalid="true"/);
    expect(html).toMatch(/<details[^>]*open[^>]*>[\s\S]*pl-review-note/);
    expect(html).not.toContain('role="alert"');
  });

  it("a lost compare-and-set is a 409 whose summary has an item without a link", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const r = await post(url(f.requestId, "publish"), cookie, formFor(f, wording(f.text), "2020-01-01T00:00:00.000Z"));
    const html = await r.text();
    expect(r.status).toBe(409);
    expect(html).toContain('id="form-errors"');
    expect(titleOf(html).startsWith("Error: ")).toBe(true);
    const items = [...(/<section id="form-errors"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]!);
    expect(items).toHaveLength(1);
    expect(items[0]).not.toContain("<a");
    expect(html).not.toContain('role="alert"');
  });

  it("keeps every existing Ops title byte for byte when `invalid` is not passed", async () => {
    const { request } = await makeRequest({ tag: `ops-bd-title-${tag()}`, title: "Plain Title" });
    const { cookie } = await asRole("owner");
    expect(titleOf((await get(`${BASE}/${request.id}`, cookie)).html)).toBe("Plain Title · VNX.SI Ops");
    expect(titleOf((await get(BASE, cookie)).html)).toBe("Requests · VNX.SI Ops");
    expect(titleOf((await get("/ops", cookie)).html)).toBe("Overview · VNX.SI Ops");
  });
});

describe("body", () => {
  it("accepts a 4000-character CJK description (12 KB) and refuses a body over 64 KB with 413", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const cjk = "需".repeat(PUBLIC_DESCRIPTION_MAX);
    const ok = await post(url(f.requestId, "publish"), cookie, formFor(f, { public_title: "E2E board 需求", public_description: cjk }));
    expect(ok.status).toBe(303);
    expect((await pubOf(f.requestId)).publicDescription).toBe(cjk);
    const g = await listing();
    const big = await post(url(g.requestId, "publish"), cookie, formFor(g, { public_title: "E2E board big", public_description: "x".repeat(70 * 1024) }));
    expect(big.status).toBe(413);
  });

  it("is 400 for a 4001-character description and a 121-character title", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    expect((await post(url(f.requestId, "publish"), cookie, formFor(f, { public_title: "t", public_description: "x".repeat(4001) }))).status).toBe(400);
    expect((await post(url(f.requestId, "publish"), cookie, formFor(f, { public_title: "t".repeat(121), public_description: `${DESC}` }))).status).toBe(400);
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
  });
});

describe("VNX-2704a review fixes (round 1)", () => {
  it("M-1: a 409 shows the CURRENT wording and a fresh token, not what was typed, so a second click cannot overwrite the other change", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing({ state: "published" });
    const other = new Date(Date.now() + 100).toISOString();
    await testEnv.DB.prepare("UPDATE request_publications SET public_title = 'E2E board CURRENT-TITLE', public_description = ?2, updated_at = ?3 WHERE request_id = ?1").bind(f.requestId, `CURRENT-WORDING ${DESC}`, other).run();
    const r = await post(url(f.requestId, "edit"), cookie, formFor(f, { public_title: "E2E board TYPED-TITLE", public_description: `TYPED-WORDING ${DESC}` }));
    const html = await r.text();
    expect(r.status).toBe(409);
    expect(html).toContain("CURRENT-TITLE");
    expect(html).toContain("CURRENT-WORDING");
    expect(html).not.toContain("TYPED-TITLE");
    expect(html).not.toContain("TYPED-WORDING");
    expect(html).toContain(`name="updated_at" value="${other}"`);
  });

  it("M-1: Reject losing to Publish shows the published state, with the Unpublish box closed and empty", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    await testEnv.DB.prepare("UPDATE request_publications SET status = 'published', public_title = 'E2E board won', public_description = ?2, published_at = ?3, updated_at = ?3 WHERE request_id = ?1").bind(f.requestId, `Won ${DESC}`, new Date(Date.now() + 100).toISOString()).run();
    const r = await post(url(f.requestId, "reject"), cookie, formFor(f, { review_note: "TYPED-NOTE" }));
    const html = await r.text();
    expect(r.status).toBe(409);
    expect(html).not.toContain("TYPED-NOTE");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/<textarea[^>]*id="pl-review-note"[^>]*>\s*<\/textarea>/);
    expect(mainOf(html)).toContain(`action="${url(f.requestId, "unpublish")}"`);
  });

  it("M-2: the checklist has the four bullets of addendum 3.2, and shows whenever the block has an action (Reject only too)", async () => {
    const { cookie } = await asRole("owner");
    const closed = await listing({ requestStatus: "builder_selected" });
    for (const f of [await listing(), await listing({ state: "published" }), closed]) {
      const main = mainOf((await get(`${BASE}/${f.requestId}`, cookie)).html);
      expect(main).toContain("pl-checklist");
      for (const word of ["postal addresses", "tax or registration numbers", "customers", "marked confidential", "identify the business", "Terms §7", "remove the whole request"]) expect(main, word).toContain(word);
    }
    const waiting = await listing({ requestStatus: "pending_verification" });
    expect(mainOf((await get(`${BASE}/${waiting.requestId}`, cookie)).html)).not.toContain("pl-checklist");
  });

  it("L-1: the intro does not claim the original is never shown", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const main = mainOf((await get(`${BASE}/${f.requestId}`, cookie)).html);
    expect(main).not.toContain("never shown");
    expect(main).toContain("The public sees only the wording you publish here");
  });

  it("L-2: rejectStatement itself refuses a pending_verification request, and route and view share one rule", async () => {
    const f = await listing({ requestStatus: "pending_verification" });
    const ops = await ensureUser(`ops-bd-l2-${tag()}@vnx.si`);
    const [res] = await testEnv.DB.batch([rejectStatement(testEnv.DB, { writeId: ulid(), requestId: f.requestId, expectedUpdatedAt: f.publication.updatedAt, reviewNote: "nope", reviewedBy: ops.id, now: new Date().toISOString() })]);
    expect(returnedPublication(res)).toBeNull();
    expect((await pubOf(f.requestId)).status).toBe("pending_review");
    const g = await listing();
    const [ok] = await testEnv.DB.batch([rejectStatement(testEnv.DB, { writeId: ulid(), requestId: g.requestId, expectedUpdatedAt: g.publication.updatedAt, reviewNote: "fine", reviewedBy: ops.id, now: new Date().toISOString() })]);
    expect(returnedPublication(ok)?.status).toBe("rejected");
    expect(opsBoardActions("pending_review", "pending_verification")).toEqual([]);
    expect(opsBoardActions("pending_review", "submitted")).toEqual(["publish", "reject"]);
    expect(opsBoardActions("pending_review", "builder_selected")).toEqual(["reject"]);
    expect(opsBoardActions("published", "removed")).toEqual(["edit", "unpublish"]);
    expect(opsBoardActions("rejected", "submitted")).toEqual([]);
  });

  it("L-4a: a wrong-state action with an invalid text is a 409, not a 400 (state is checked first)", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    expect((await post(url(f.requestId, "edit"), cookie, formFor(f, { public_title: "t", public_description: "x".repeat(39) }))).status).toBe(409);
    const g = await listing({ state: "published" });
    expect((await post(url(g.requestId, "reject"), cookie, formFor(g, { review_note: "" }))).status).toBe(409);
  });

  it("L-4b: the exact audit data of edit, reject and unpublish, with nothing of the CLIENT in it", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing({ state: "published" });
    await post(url(f.requestId, "edit"), cookie, formFor(f, { public_title: "E2E board EDIT-IDENT", public_description: `EDIT-IDENT ${DESC}` }));
    const p = await pubOf(f.requestId);
    await post(url(f.requestId, "unpublish"), cookie, formFor(f, { review_note: "UNPUB-IDENT" }, p.updatedAt));
    const g = await listing();
    await post(url(g.requestId, "reject"), cookie, formFor(g, { review_note: "REJ-IDENT" }));
    const client = await testEnv.DB.prepare("SELECT email FROM users WHERE id = ?1").bind(f.clientId).first<{ email: string }>();
    const rows = [...(await auditRows(f.requestId)), ...(await auditRows(g.requestId))];
    expect(rows.map((a) => [a.action, JSON.parse(a.data)])).toEqual([
      ["request_publication.edit", { requestId: f.requestId, from: "published", to: "published" }],
      ["request_publication.unpublish", { requestId: f.requestId, from: "published", to: "unpublished" }],
      ["request_publication.reject", { requestId: g.requestId, from: "pending_review", to: "rejected" }],
    ]);
    for (const a of rows) {
      expect(a.data).not.toContain("IDENT");
      expect(a.data).not.toContain(client!.email);
      expect(a.data).not.toContain("Minh Tran");
    }
  });

  it("L-4c and S-1: the merged History is newest first across both entities and holds at most 50 rows", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing();
    const base = Date.parse("2026-03-01T00:00:00.000Z");
    const run = tag().toUpperCase().replace(/[^0-9A-Z]/g, "0");
    const statements: D1PreparedStatement[] = [];
    for (let n = 0; n < 60; n++) {
      const even = n % 2 === 0;
      statements.push(
        testEnv.DB
          .prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, NULL, ?2, ?3, ?4, '{}', ?5)")
          .bind(`01HIST${run}${String(n).padStart(12, "0")}`.slice(0, 26), even ? "request.note" : "request_publication.edit", even ? "request" : "request_publication", f.requestId, new Date(base + n * 1000).toISOString()),
      );
    }
    await testEnv.DB.batch(statements);
    const html = (await get(`${BASE}/${f.requestId}`, cookie)).html;
    const section = /<section[^>]*ops-history[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    const times = [...section.matchAll(/datetime="([^"]+)"/g)].map((m) => m[1]!);
    expect(times).toHaveLength(50);
    expect([...times].sort().reverse()).toEqual(times);
    const actions = [...section.matchAll(/<span class="ops-mono">([a-z_.]+)<\/span>/g)].map((m) => m[1]);
    expect(actions.slice(0, 2)).toEqual(["request_publication.edit", "request.note"]);
  });
});

describe("VNX-2704b: the Public column and the public=pending filter of the Requests list", () => {
  const listUrl = (query: string) => `${BASE}${query}`;
  const rowOf = (html: string, id: string) => new RegExp(`<tr>(?:(?!</tr>)[\\s\\S])*?href="${BASE}/${id}[?"](?:(?!</tr>)[\\s\\S])*?</tr>`).exec(html)?.[0] ?? "";
  const hasRow = (html: string, id: string) => rowOf(html, id) !== "";
  const setStatus = (id: string, status: string) => testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(id, status).run();

  it("has a Public column: a dash without a listing, and the listing's status with one", async () => {
    const { cookie } = await asRole("owner");
    const none = await makeRequest({ tag: `ops-pc-none-${tag()}` });
    const pending = await listing();
    const published = await listing({ state: "published" });
    const html = mainOf((await get(listUrl("?status=all"), cookie)).html);
    expect(html).toMatch(/<th scope="col">Public<\/th>/);
    expect(rowOf(html, none.request.id)).toMatch(/<td[^>]*>—<\/td>/);
    expect(rowOf(html, pending.requestId)).toContain("Review");
    expect(rowOf(html, published.requestId)).toContain("Published");
    for (const [state, label] of [["rejected", "Rejected"], ["withdrawn", "Withdrawn"], ["unpublished", "Unpublished"]] as const) {
      const f = await listing();
      await testEnv.DB.prepare("UPDATE request_publications SET status = ?2, ended_at = '2026-01-01T00:00:00.000Z', review_note = 'n', published_at = NULL WHERE request_id = ?1").bind(f.requestId, state).run();
      expect(rowOf(mainOf((await get(listUrl("?status=all"), cookie)).html), f.requestId), state).toContain(label);
    }
  });

  it("?public=pending lists only requests that are open and have a listing waiting, whatever the default tab is (L6)", async () => {
    const { cookie } = await asRole("owner");
    const submitted = await listing();
    const matching = await listing({ requestStatus: "matching" });
    const published = await listing({ state: "published" });
    const closed = await listing({ requestStatus: "builder_selected" });
    const unconfirmed = await listing({ requestStatus: "pending_verification" });
    const withoutListing = await makeRequest({ tag: `ops-pc-nl-${tag()}` });
    const html = mainOf((await get(listUrl("?public=pending"), cookie)).html);
    expect(hasRow(html, submitted.requestId)).toBe(true);
    expect(hasRow(html, matching.requestId)).toBe(true);
    for (const f of [published, closed, unconfirmed]) expect(hasRow(html, f.requestId), f.requestId).toBe(false);
    expect(hasRow(html, withoutListing.request.id)).toBe(false);
    // Without the filter the default tab is Submitted: the matching request is not there.
    const plain = mainOf((await get(listUrl(""), cookie)).html);
    expect(hasRow(plain, matching.requestId)).toBe(false);
    expect(hasRow(plain, submitted.requestId)).toBe(true);
    // A rejected listing leaves the filter.
    await post(url(submitted.requestId, "reject"), cookie, formFor(submitted, { review_note: "Too vague." }));
    expect(hasRow(mainOf((await get(listUrl("?public=pending"), cookie)).html), submitted.requestId)).toBe(false);
  });

  it("keeps the search with the filter, drops any other value of public, and adds no tab", async () => {
    const { cookie } = await asRole("owner");
    const a = await listing({ title: `Zeta needle ${tag()}` });
    const b = await listing({ title: `Other thing ${tag()}` });
    const tabsOf = (h: string) => /<nav class="ops-tabs"[^>]*>([\s\S]*?)<\/nav>/.exec(h)?.[1] ?? "";
    const filtered = mainOf((await get(listUrl("?public=pending&q=zeta%20needle"), cookie)).html);
    expect(hasRow(filtered, a.requestId)).toBe(true);
    expect(hasRow(filtered, b.requestId)).toBe(false);
    expect(rowOf(filtered, a.requestId)).toContain("public=pending");
    expect(filtered).toMatch(/<input type="hidden" name="public" value="pending"/);
    const hacked = mainOf((await get(listUrl("?public=hacked"), cookie)).html);
    const plain = mainOf((await get(listUrl(""), cookie)).html);
    expect(hasRow(hacked, a.requestId)).toBe(hasRow(plain, a.requestId));
    expect(rowOf(hacked, a.requestId)).not.toContain("public=");
    const tabs = (h: string) => [...tabsOf(h).matchAll(/<a class="ops-tab"/g)].length;
    expect(tabs(filtered)).toBe(tabs(plain));
    expect(tabsOf(filtered)).not.toContain("public=");
  });

  it("R1-S1, by id with the real list and filter: a pending_verification request is in neither, and enters both after the client confirms", async () => {
    const { cookie } = await asRole("owner");
    const f = await listing({ requestStatus: "pending_verification" });
    const filterBefore = mainOf((await get(listUrl("?public=pending"), cookie)).html);
    const submittedBefore = mainOf((await get(listUrl("?status=submitted"), cookie)).html);
    expect(hasRow(filterBefore, f.requestId)).toBe(false);
    expect(hasRow(submittedBefore, f.requestId)).toBe(false);
    // The tab of its own status shows it, with its listing marked as waiting.
    expect(rowOf(mainOf((await get(listUrl("?status=pending_verification"), cookie)).html), f.requestId)).toContain("Review");
    await setStatus(f.requestId, "submitted");
    expect(hasRow(mainOf((await get(listUrl("?public=pending"), cookie)).html), f.requestId)).toBe(true);
  });

  it("S-2: the Public listing forms and the redirect keep the list filter, so Ops can go on down the queue", async () => {
    const { cookie } = await asRole("operator");
    const f = await listing();
    const filter = "?public=pending&q=ONLYONE";
    const main = mainOf((await get(`${BASE}/${f.requestId}${filter}`, cookie)).html);
    const actions = [...main.matchAll(/<form\b[^>]*action="([^"]*)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&")).filter((a) => a.includes("/publication/"));
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      const query = new URL(a, "https://vnx.si").searchParams;
      expect(query.get("public"), a).toBe("pending");
      expect(query.get("q"), a).toBe("ONLYONE");
      expect(a).not.toContain("#");
    }
    expect(main).toContain(`href="${BASE}?public=pending&amp;q=ONLYONE"`);
    // The refused form (a 400) renders the page again with the filter still in its actions.
    const bad = await post(`${url(f.requestId, "publish")}${filter}`, cookie, formFor(f, { public_title: "", public_description: "" }));
    expect(bad.status).toBe(400);
    expect(mainOf(await bad.text())).toContain("public=pending");
    // A success goes back to the same page with the filter and the outcome.
    const ok = await post(`${url(f.requestId, "publish")}${filter}`, cookie, formFor(f, wording(f.text)));
    expect(ok.status).toBe(303);
    const location = new URL(ok.headers.get("location")!, "https://vnx.si");
    expect(location.pathname).toBe(`${BASE}/${f.requestId}`);
    expect(Object.fromEntries(location.searchParams)).toEqual({ public: "pending", q: "ONLYONE", done: "1" });
  });
});

describe("VNX-2704b: the e-mails to the client after Ops moderates", () => {
  afterEach(() => clearOutbox());
  const failing = { ...env, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;

  async function fresh(opts: Parameters<typeof listing>[0] = {}, locale = "en") {
    const f = await listing(opts);
    await testEnv.DB.prepare("UPDATE users SET locale = ?2 WHERE id = ?1").bind(f.clientId, locale).run();
    const client = (await testEnv.DB.prepare("SELECT email FROM users WHERE id = ?1").bind(f.clientId).first<{ email: string }>())!;
    clearOutbox();
    return { ...f, email: client.email };
  }

  it("publish: e-mails the client once, in their locale, with the public page; says 'edited' only when the wording changed", async () => {
    const { cookie } = await asRole("operator");
    const edited = await fresh({ title: `Quiet title ${tag()}`, description: ORIGINAL_DESC }, "vi");
    expect((await post(url(edited.requestId, "publish"), cookie, formFor(edited, wording(edited.text)))).status).toBe(303);
    expect(outbox).toHaveLength(1);
    const publicId = (await pubOf(edited.requestId)).publicId;
    expect(outbox[0]).toMatchObject({ to: edited.email });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/requests/${publicId}`);
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/me/requests/${edited.requestId}`);
    expect(outbox[0]!.text).toContain("chỉnh sửa câu chữ");
    // Published exactly as the client wrote it: nothing to say about an edit.
    const description = "A description that is exactly as the client wrote it, long enough to publish as it is.";
    const same = await fresh({ title: `Same title ${tag()}`, description });
    const row = await testEnv.DB.prepare("SELECT title FROM requests WHERE id = ?1").bind(same.requestId).first<{ title: string }>();
    expect((await post(url(same.requestId, "publish"), cookie, formFor(same, { public_title: row!.title, public_description: description }))).status).toBe(303);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.text).not.toContain("edited");
  });

  it("reject and unpublish: e-mail the client the Ops reason, never the admin note", async () => {
    const { cookie } = await asRole("owner");
    const r = await fresh({}, "zh-Hant");
    await testEnv.DB.prepare("UPDATE requests SET admin_note = 'ADMIN-ONLY' WHERE id = ?1").bind(r.requestId).run();
    expect((await post(url(r.requestId, "reject"), cookie, formFor(r, { review_note: "Contains a company name." }))).status).toBe(303);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: r.email });
    expect(outbox[0]!.text).toContain("Contains a company name.");
    expect(outbox[0]!.text).toContain("公開需求板");
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain("ADMIN-ONLY");
    const u = await fresh({ state: "published" });
    expect((await post(url(u.requestId, "unpublish"), cookie, formFor(u, { review_note: "No longer fits the board." }))).status).toBe(303);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: u.email });
    expect(outbox[0]!.text).toContain("No longer fits the board.");
  });

  it("sends nothing for edit, for a refused move (409), or for a bad form (400)", async () => {
    const { cookie } = await asRole("owner");
    const p = await fresh({ state: "published" });
    expect((await post(url(p.requestId, "edit"), cookie, formFor(p, { public_title: "E2E board retitled", public_description: `Retitled wording. ${DESC}` }))).status).toBe(303);
    expect((await post(url(p.requestId, "publish"), cookie, formFor(p, wording("x")))).status).toBe(409);
    const g = await fresh();
    expect((await post(url(g.requestId, "publish"), cookie, formFor(g, { public_title: "", public_description: "" }))).status).toBe(400);
    expect((await post(url(g.requestId, "publish"), cookie, formFor(g, wording("x"), "2020-01-01T00:00:00.000Z"))).status).toBe(409);
    expect(outbox).toHaveLength(0);
  });

  it("a mail failure does not undo the moderation: it is logged once without the address and Ops sees the mail_failed notice, with the filter kept", async () => {
    const { cookie } = await asRole("owner");
    const f = await fresh();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post(`${url(f.requestId, "reject")}?public=pending`, cookie, formFor(f, { review_note: "Too vague." }), failing);
      expect(res.status).toBe(303);
      const location = new URL(res.headers.get("location")!, "https://vnx.si");
      expect(Object.fromEntries(location.searchParams)).toEqual({ public: "pending", done: "mail_failed" });
      expect(await pubOf(f.requestId)).toMatchObject({ status: "rejected", reviewNote: "Too vague." });
      expect(await auditCount(f.requestId)).toBe(1);
      const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("request_board.notify_failed"));
      expect(lines).toHaveLength(1);
      expect(lines[0]).not.toContain(f.email);
      const shown = await get(`${location.pathname}${location.search}`, cookie);
      expect(mainOf(shown.html)).toContain("couldn&#39;t be sent");
    } finally {
      log.mockRestore();
    }
  });

  it("wordingEdited compares after normalising line endings and surrounding space", () => {
    expect(wordingEdited({ title: "A", description: "x\r\ny" }, { title: "A", description: "x\ny" })).toBe(false);
    expect(wordingEdited({ title: "A ", description: "x\ny" }, { title: "A", description: "x\ny\n" })).toBe(false);
    expect(wordingEdited({ title: "A", description: "x\ny" }, { title: "B", description: "x\ny" })).toBe(true);
    expect(wordingEdited({ title: "A", description: "x\ny" }, { title: "A", description: "x\nz" })).toBe(true);
  });
});
