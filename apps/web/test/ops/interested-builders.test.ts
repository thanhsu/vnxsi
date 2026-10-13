import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { optInStatement, findInterestById, returnedPublication } from "../../src/db/request-board.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { opsInterestActions } from "../../src/domain/request-board.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import type { Bindings } from "../../src/env.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { findClientRequest } from "../../src/db/requests.ts";
import { addLiveProduct, ensureUser, inviteBuilders, makeBuilder, makeRequest, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2706b: the "Interested builders" block of /ops/marketplace/requests/:id (addendum §3.3 steps 6-7, §5, §7.2). Owner and Operator
 * (marketplace.act) see it and may Dismiss or Invite; the invite is the existing POST :id/invite and flips the interest in the same batch.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT, REQUEST_BOARD_GO_LIVE: "2026-01-01" } as Bindings;
const BASE = "/ops/marketplace/requests";

async function boardFlag(enabled: boolean): Promise<void> {
  const admin = await ensureUser(ROOT);
  await setFlag(testEnv.DB, { key: "request_board", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}
beforeAll(() => boardFlag(true));
afterAll(() => boardFlag(false));
beforeEach(() => clearOutbox());

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}
const asRole = async (role: OpsRole) => (role === "owner" ? signIn(ROOT) : member(`ops-ib-${role}-${tag()}@vnx.si`, role));

function req(path: string, opts: { cookie?: string; form?: Record<string, string | string[]> } = {}) {
  const headers: Record<string, string> = { "cf-ray": `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (!opts.form) return new Request(`https://vnx.si${path}`, { headers });
  headers.origin = "https://vnx.si";
  headers["content-type"] = "application/x-www-form-urlencoded";
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.form)) for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
  return new Request(`https://vnx.si${path}`, { method: "POST", headers, body });
}
const send = (path: string, opts: Parameters<typeof req>[1] = {}, bindings: Bindings = env) => createApp().request(req(path, opts), undefined, bindings);
const get = async (path: string, cookie?: string) => {
  const res = await send(path, { cookie });
  return { res, html: await res.text() };
};
const post = (path: string, cookie: string | undefined, form: Record<string, string | string[]> = {}, bindings: Bindings = env) => send(path, { cookie, form }, bindings);
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
/** The block: from its section to the next Ops card (the error summary inside it is a <section> too). */
const blockOf = (html: string) => {
  const start = html.indexOf('<section id="ib-block"');
  if (start < 0) return "";
  const rest = html.slice(start);
  const end = rest.indexOf('<section class="ops-card', 20);
  return end < 0 ? rest : rest.slice(0, end);
};

type Listing = { requestId: string; publicId: string; clientId: string };

/** A confirmed request with a published listing (rows straight to the DB). */
async function listed(requestStatus = "submitted"): Promise<Listing> {
  const t = tag();
  const made = await makeRequest({ tag: `ops-ib-${t}`, title: `Interest board ${t}`, description: `We need online booking with reminders ${t}, for three salons.` });
  const now = new Date().toISOString();
  const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId: made.request.id, consentVersion: "2026-01-01", now, clientUserId: made.client.id })]);
  const publication = returnedPublication(res)!;
  await testEnv.DB.prepare("UPDATE request_publications SET status = 'published', public_title = ?2, public_description = ?3, published_at = ?4, updated_at = ?4 WHERE request_id = ?1").bind(made.request.id, `Public ${t}`, `Public wording ${t} for a booking app with reminders.`, now).run();
  if (requestStatus !== "submitted") await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(made.request.id, requestStatus).run();
  return { requestId: made.request.id, publicId: publication.publicId, clientId: made.client.id };
}

async function builderWithCookie(name = `Builder ${tag()}`) {
  const email = `ib-${tag()}@vnx.si`;
  const builder = await makeBuilder(email, `ib${tag()}`, "approved", { name });
  return { builder, cookie: (await signIn(email)).cookie };
}

async function interestOf(l: Listing, builderId: string, o: { status?: string; note?: string | null; productId?: string | null } = {}): Promise<string> {
  const id = ulid();
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO request_interests (id, request_id, builder_id, note, product_id, status, created_at, updated_at, write_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)")
    .bind(id, l.requestId, builderId, o.note ?? null, o.productId ?? null, o.status ?? "pending", now, ulid())
    .run();
  return id;
}

const interestAudit = (interestId: string) =>
  testEnv.DB.prepare("SELECT action, entity, entity_id, actor_user_id, data FROM audit_log WHERE entity = 'request_interest' AND entity_id = ?1 ORDER BY id").bind(interestId).all<{ action: string; entity_id: string; actor_user_id: string | null; data: string }>().then((r) => r.results);
const invitesOf = (requestId: string) => testEnv.DB.prepare("SELECT builder_id FROM request_invites WHERE request_id = ?1").bind(requestId).all<{ builder_id: string }>().then((r) => r.results.map((x) => x.builder_id));
const dismissUrl = (l: Listing, interestId: string) => `${BASE}/${l.requestId}/interests/${interestId}/dismiss`;

/** The 2704a M-1 / 2706a rule: a refused form shows the current state; the 409 page carries the VNX-0807 summary. */
function expectConflictPage(html: string) {
  expect(html).toContain('id="form-errors"');
  expect(titleOf(html).startsWith("Error: ")).toBe(true);
  const items = [...(/<section id="form-errors"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]!);
  expect(items).toHaveLength(1);
  expect(items[0]).not.toContain("<a");
  expect(html).not.toContain('role="alert"');
}

describe("the Interested builders block", () => {
  it("shows Owner and Operator each public builder's name, handle, date, note (escaped), product link and the two actions", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie("Alice Interested");
    const product = await addLiveProduct(builder, `Salon Booker ${tag()}`);
    const iid = await interestOf(l, builder.userId, { note: `<script>alert(1)</script> I built this\nsecond line`, productId: product.id });
    for (const role of ["owner", "operator"] as const) {
      const { cookie } = await asRole(role);
      const { res, html } = await get(`${BASE}/${l.requestId}`, cookie);
      expect(res.status, role).toBe(200);
      const block = blockOf(mainOf(html));
      expect(block, role).toContain(en["ops.interests.title"]);
      expect(block, role).toContain("Alice Interested");
      expect(block, role).toContain(`@${builder.handle}`);
      expect(block, role).toContain(`href="/ops/marketplace/builders/${builder.userId}"`);
      expect(block, role).toContain(`href="/p/${product.slug}"`);
      expect(block, role).toContain("&lt;script&gt;alert(1)&lt;/script&gt; I built this");
      expect(block, role).not.toContain("<script>");
      expect(block, role).toContain(`action="${dismissUrl(l, iid)}"`);
      expect(block, role).toMatch(new RegExp(`<form[^>]*action="${BASE}/${l.requestId}/invite"[^>]*>[\\s\\S]*?name="builder" value="${builder.userId}"`));
      for (const m of block.matchAll(/<form\b[^>]*action="([^"]*)"/g)) expect(m[1], role).not.toContain("#");
    }
  });

  it("is not in the HTML of a Viewer, and Content gets the sealed 404 of the page", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie("Hidden From Viewer");
    await interestOf(l, builder.userId, { note: "VIEWER-MUST-NOT-SEE" });
    const viewer = await asRole("viewer");
    const { res, html } = await get(`${BASE}/${l.requestId}`, viewer.cookie);
    expect(res.status).toBe(200);
    expect(html).not.toContain("ib-block");
    expect(html).not.toContain("VIEWER-MUST-NOT-SEE");
    expect((await get(`${BASE}/${l.requestId}`, (await asRole("content")).cookie)).res.status).toBe(404);
  });

  it("hides the interest of a suspended builder and of a builder on a suspended account (L9), and shows it again when active", async () => {
    const l = await listed();
    const a = await builderWithCookie("Visible Vera");
    const b = await builderWithCookie("Suspended Sam");
    const c = await builderWithCookie("Locked Lou");
    for (const x of [a, b, c]) await interestOf(l, x.builder.userId);
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(b.builder.userId).run();
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(c.builder.userId).run();
    const { cookie } = await asRole("owner");
    const block = blockOf((await get(`${BASE}/${l.requestId}`, cookie)).html);
    expect(block).toContain("Visible Vera");
    expect(block).not.toContain("Suspended Sam");
    expect(block).not.toContain("Locked Lou");
  });

  it("shows the §8.10 score as a reference only: the suggestions table is byte-identical before and after an interest, and the score matches", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie("Score Sue");
    const { cookie } = await asRole("owner");
    const suggestionsOf = (html: string) => /<section[^>]*aria-labelledby="ops-suggestions-h"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    const before = suggestionsOf((await get(`${BASE}/${l.requestId}`, cookie)).html);
    await interestOf(l, builder.userId);
    const html = (await get(`${BASE}/${l.requestId}`, cookie)).html;
    expect(suggestionsOf(html)).toBe(before);
    const row = new RegExp(`<tr[^>]*data-builder="${builder.userId}"[\\s\\S]*?</tr>`).exec(blockOf(html))?.[0] ?? "";
    const score = /data-score="(\d+)"/.exec(row)?.[1];
    expect(score).toBeDefined();
    // The same number the suggestion table gives that builder, when it lists them (it lists the ten best).
    const inTable = new RegExp(`for="sg-${builder.userId}"[\\s\\S]*?<td class="ops-mono">(\\d+)</td>`).exec(before)?.[1];
    if (inTable !== undefined) expect(score).toBe(inTable);
  });

  it("shows a dash for a builder who is not a candidate (availability closed)", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie("Closed Cleo");
    await testEnv.DB.prepare("UPDATE builders SET availability = 'closed' WHERE user_id = ?1").bind(builder.userId).run();
    await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    const row = new RegExp(`<tr[^>]*data-builder="${builder.userId}"[\\s\\S]*?</tr>`).exec(blockOf((await get(`${BASE}/${l.requestId}`, cookie)).html))?.[0] ?? "";
    expect(row).toContain('data-score="—"');
  });

  it("offers Invite only on a pending interest of a request that can take another invitation, and Dismiss only on a pending one", () => {
    expect(opsInterestActions({ status: "pending", builderPublic: true, invitable: true })).toEqual(["invite", "dismiss"]);
    expect(opsInterestActions({ status: "pending", builderPublic: true, invitable: false })).toEqual(["dismiss"]);
    for (const status of ["invited", "dismissed", "withdrawn"] as const) expect(opsInterestActions({ status, builderPublic: true, invitable: true })).toEqual([]);
    expect(opsInterestActions({ status: "pending", builderPublic: false, invitable: true })).toEqual([]);
  });

  it("shows no Invite button on a closed request or when five invitations are active, but keeps Dismiss", async () => {
    const closed = await listed("builder_selected");
    const x = await builderWithCookie("Closed Request Carl");
    const ix = await interestOf(closed, x.builder.userId);
    const { cookie } = await asRole("owner");
    let block = blockOf((await get(`${BASE}/${closed.requestId}`, cookie)).html);
    expect(block).toContain("Closed Request Carl");
    expect(block).toContain(`action="${dismissUrl(closed, ix)}"`);
    expect(block).not.toContain(`action="${BASE}/${closed.requestId}/invite"`);

    const full = await listed();
    const five = await Promise.all(Array.from({ length: 5 }, (_, i) => makeBuilder(`ib-full-${tag()}-${i}@vnx.si`, `ibfull${tag()}`, "approved")));
    await inviteBuilders((await findClientRequest(testEnv.DB, full.clientId, full.requestId))!, five);
    const y = await builderWithCookie("Sixth Sid");
    const iy = await interestOf(full, y.builder.userId);
    block = blockOf((await get(`${BASE}/${full.requestId}`, cookie)).html);
    expect(block).toContain("Sixth Sid");
    expect(block).toContain(`action="${dismissUrl(full, iy)}"`);
    expect(block).not.toContain(`action="${BASE}/${full.requestId}/invite"`);
  });
});

describe("Dismiss", () => {
  it("lets Owner and Operator dismiss a pending interest: dismissed, decided_by, one audit row with no note and no name, no e-mail, and the builder sees Not invited on the Hub", async () => {
    for (const role of ["owner", "operator"] as const) {
      const l = await listed();
      const { builder, cookie: builderCookie } = await builderWithCookie(`Dismissed Dan ${tag()}`);
      const iid = await interestOf(l, builder.userId, { note: "PRIVATE-NOTE-TEXT" });
      const actor = await asRole(role);
      const before = (await findInterestById(testEnv.DB, iid))!;
      clearOutbox();
      const r = await post(dismissUrl(l, iid), actor.cookie, { updated_at: before.updatedAt });
      expect(r.status, role).toBe(303);
      expect(r.headers.get("location"), role).toBe(`${BASE}/${l.requestId}?done=1`);
      const after = (await findInterestById(testEnv.DB, iid))!;
      expect(after).toMatchObject({ status: "dismissed", decidedBy: actor.user.id });
      expect(after.decidedAt).not.toBeNull();
      const rows = await interestAudit(iid);
      expect(rows, role).toHaveLength(1);
      expect(rows[0]).toMatchObject({ action: "request_interest.dismiss", actor_user_id: actor.user.id });
      expect(JSON.parse(rows[0]!.data)).toEqual({ requestId: l.requestId });
      expect(rows[0]!.data).not.toContain("PRIVATE-NOTE-TEXT");
      expect(rows[0]!.data).not.toContain("Dismissed Dan");
      expect(outbox, role).toEqual([]);
      const hub = await (await createApp().request(req("/hub/invitations", { cookie: builderCookie }), undefined, env)).text();
      expect(hub, role).toContain(en["hub.interests.notInvited"]);
    }
  });

  it("answers Content, Viewer, the anonymous and OAuth sessions with the sealed 404 and writes nothing", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const before = (await findInterestById(testEnv.DB, iid))!;
    const op = await member(`ops-ib-oauth-${tag()}@vnx.si`, "operator");
    const callers: Array<[string, string | undefined]> = [
      ["anonymous", undefined],
      ["content", (await asRole("content")).cookie],
      ["viewer", (await asRole("viewer")).cookie],
      ["oauth operator", (await signIn(op.user.email, { method: "oauth_google" })).cookie],
      ["oauth root", (await signIn(ROOT, { method: "oauth_github" })).cookie],
    ];
    for (const [who, cookie] of callers) {
      const r = await post(dismissUrl(l, iid), cookie, { updated_at: before.updatedAt });
      expect(r.status, who).toBe(404);
    }
    expect(await findInterestById(testEnv.DB, iid)).toEqual(before);
    expect(await interestAudit(iid)).toEqual([]);
    expect((await post(dismissUrl(l, iid), op.cookie, { updated_at: before.updatedAt })).status).toBe(303);
  });

  it("answers a request, an interest or a pair that do not belong together with the sealed 404", async () => {
    const l = await listed();
    const other = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    expect((await post(dismissUrl(other, iid), cookie, { updated_at: "x" })).status).toBe(404);
    expect((await post(dismissUrl(l, "01ZZZZZZZZZZZZZZZZZZZZZZZZ"), cookie, { updated_at: "x" })).status).toBe(404);
    expect((await post(`${BASE}/01ZZZZZZZZZZZZZZZZZZZZZZZZ/interests/${iid}/dismiss`, cookie, { updated_at: "x" })).status).toBe(404);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("pending");
  });

  it("is 409 the second time, with the current state shown and the VNX-0807 summary; nothing more is written", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie("Twice Tom");
    const iid = await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    const token = (await findInterestById(testEnv.DB, iid))!.updatedAt;
    expect((await post(dismissUrl(l, iid), cookie, { updated_at: token })).status).toBe(303);
    const again = await post(dismissUrl(l, iid), cookie, { updated_at: token });
    const html = await again.text();
    expect(again.status).toBe(409);
    expectConflictPage(html);
    expect(blockOf(html)).toContain("Twice Tom");
    expect(blockOf(html)).not.toContain(`action="${dismissUrl(l, iid)}"`);
    expect(await interestAudit(iid)).toHaveLength(1);
  });

  it("is 409 for an invited interest, and for a stale token the page shows the current row, not typed values", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const invited = await interestOf(l, builder.userId, { status: "invited" });
    const { cookie } = await asRole("owner");
    const r = await post(dismissUrl(l, invited), cookie, { updated_at: (await findInterestById(testEnv.DB, invited))!.updatedAt });
    expect(r.status).toBe(409);
    expectConflictPage(await r.text());
    expect((await findInterestById(testEnv.DB, invited))!.status).toBe("invited");
    expect(await interestAudit(invited)).toEqual([]);

    const l2 = await listed();
    const b2 = await builderWithCookie();
    const pending = await interestOf(l2, b2.builder.userId);
    const stale = await post(dismissUrl(l2, pending), cookie, { updated_at: "2020-01-01T00:00:00.000Z", note: "TYPED-VALUE" });
    const html = await stale.text();
    expect(stale.status).toBe(409);
    expect(html).not.toContain("TYPED-VALUE");
    expect((await findInterestById(testEnv.DB, pending))!.status).toBe("pending");
    expect(await interestAudit(pending)).toEqual([]);
  });

  it("keeps the list filter in the action and the redirect, and is not gated by the board gate", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    const html = (await get(`${BASE}/${l.requestId}?status=all&q=zz`, cookie)).html;
    expect(blockOf(html)).toContain(`action="${dismissUrl(l, iid)}?status=all&amp;q=zz"`);
    await boardFlag(false);
    try {
      const r = await post(`${dismissUrl(l, iid)}?status=all&q=zz`, cookie, { updated_at: (await findInterestById(testEnv.DB, iid))!.updatedAt });
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe(`${BASE}/${l.requestId}?status=all&q=zz&done=1`);
      expect((await findInterestById(testEnv.DB, iid))!.status).toBe("dismissed");
    } finally {
      await boardFlag(true);
    }
  });

  it("writes no audit row when the compare-and-set loses between the read and the batch (guard on write_id, not on status)", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    const token = (await findInterestById(testEnv.DB, iid))!.updatedAt;
    // Another Ops member dismisses first, at the very same instant text: status is dismissed already, but with ANOTHER write id.
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'dismissed', write_id = ?2 WHERE id = ?1").bind(iid, ulid()).run();
    const r = await post(dismissUrl(l, iid), cookie, { updated_at: token });
    expect(r.status).toBe(409);
    expect(await interestAudit(iid)).toEqual([]);
  });
});

/** A DB whose batch first runs `before`, to play a competing write between the route's reads and its batch. */
function racing(before: string, ...binds: unknown[]): D1Database {
  return new Proxy(testEnv.DB, {
    get(target, prop) {
      if (prop === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare(before).bind(...binds).run();
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("Invite from the block (the existing invite route)", () => {
  it("flips a pending interest to invited in the same batch, with the invitation, the request.invite audit and one request_interest.invite audit row (no note, no name)", async () => {
    const l = await listed();
    const { builder, cookie: builderCookie } = await builderWithCookie("Invited Ivy");
    const iid = await interestOf(l, builder.userId, { note: "INVITE-PRIVATE-NOTE" });
    const actor = await asRole("operator");
    clearOutbox();
    const r = await post(`${BASE}/${l.requestId}/invite`, actor.cookie, { builder: builder.userId });
    expect(r.status).toBe(303);
    expect(await invitesOf(l.requestId)).toEqual([builder.userId]);
    const after = (await findInterestById(testEnv.DB, iid))!;
    expect(after).toMatchObject({ status: "invited", decidedBy: actor.user.id });
    const rows = await interestAudit(iid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "request_interest.invite", actor_user_id: actor.user.id });
    const data = JSON.parse(rows[0]!.data) as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(["inviteId", "requestId"]);
    expect(rows[0]!.data).not.toContain("INVITE-PRIVATE-NOTE");
    expect(rows[0]!.data).not.toContain("Invited Ivy");
    const requestAudit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'request' AND entity_id = ?1 AND action = 'request.invite'").bind(l.requestId).first<{ n: number }>();
    expect(requestAudit!.n).toBe(1);
    // The block shows the invited state, and the builder sees Invited on the Hub and the invitation link on the public page.
    const block = blockOf((await get(`${BASE}/${l.requestId}`, actor.cookie)).html);
    expect(block).toContain(en["ops.interests.status.invited"]);
    const hub = await (await createApp().request(req("/hub/invitations", { cookie: builderCookie }), undefined, env)).text();
    const inviteId = (await testEnv.DB.prepare("SELECT id FROM request_invites WHERE request_id = ?1").bind(l.requestId).first<{ id: string }>())!.id;
    expect(hub).toContain(en["hub.interests.invited"]);
    expect(hub).toContain(`href="/hub/invitations/${inviteId}"`);
    const pub = await (await createApp().request(req(`/requests/${l.publicId}`, { cookie: builderCookie }), undefined, env)).text();
    expect(pub).toContain(en["board.interest.invited"]);
    expect(pub).toContain(`href="/hub/invitations/${inviteId}"`);
  });

  it("changes nothing for a builder without an interest, and leaves a dismissed or withdrawn interest as it is", async () => {
    const l = await listed();
    const none = await builderWithCookie();
    const dismissed = await builderWithCookie();
    const withdrawn = await builderWithCookie();
    const di = await interestOf(l, dismissed.builder.userId, { status: "dismissed" });
    const wi = await interestOf(l, withdrawn.builder.userId, { status: "withdrawn" });
    const { cookie } = await asRole("owner");
    const r = await post(`${BASE}/${l.requestId}/invite`, cookie, { builder: [none.builder.userId, dismissed.builder.userId, withdrawn.builder.userId] });
    expect(r.status).toBe(303);
    expect((await invitesOf(l.requestId)).sort()).toEqual([none.builder.userId, dismissed.builder.userId, withdrawn.builder.userId].sort());
    expect((await findInterestById(testEnv.DB, di))!.status).toBe("dismissed");
    expect((await findInterestById(testEnv.DB, wi))!.status).toBe("withdrawn");
    for (const id of [di, wi]) expect(await interestAudit(id)).toEqual([]);
    const any = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM request_interests WHERE request_id = ?1 AND builder_id = ?2").bind(l.requestId, none.builder.userId).first<{ n: number }>();
    expect(any!.n).toBe(0);
  });

  it("an invite that loses the 5-invite cap in the batch gets no interest audit row and does not flip the interest", async () => {
    const l = await listed();
    const four = await Promise.all(Array.from({ length: 4 }, (_, i) => makeBuilder(`ib-cap-${tag()}-${i}@vnx.si`, `ibcap${tag()}`, "approved")));
    await inviteBuilders((await findClientRequest(testEnv.DB, l.clientId, l.requestId))!, four);
    const loser = await builderWithCookie();
    const iid = await interestOf(l, loser.builder.userId);
    const rival = await makeBuilder(`ib-rival-${tag()}@vnx.si`, `ibrival${tag()}`, "approved");
    const { cookie } = await asRole("owner");
    // After the route's reads (four active, so one more passes its quick check) a rival takes the fifth place.
    const db = racing(
      `INSERT INTO request_invites (id, request_id, builder_id, invited_by, status, invited_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'invited', ?5, ?5, ?5)`,
      ulid(),
      l.requestId,
      rival.userId,
      (await ensureUser(ROOT)).id,
      new Date().toISOString(),
    );
    const r = await post(`${BASE}/${l.requestId}/invite`, cookie, { builder: loser.builder.userId }, { ...env, DB: db } as Bindings);
    expect(r.status).toBe(409);
    expect((await invitesOf(l.requestId)).includes(loser.builder.userId)).toBe(false);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("pending");
    expect(await interestAudit(iid)).toEqual([]);
  });

  it("an invite that cannot insert because the builder was locked between the read and the batch does not flip the interest either", async () => {
    const l = await listed();
    const locked = await builderWithCookie();
    const iid = await interestOf(l, locked.builder.userId);
    const { cookie } = await asRole("owner");
    const db = racing("UPDATE users SET status = 'suspended' WHERE id = ?1", locked.builder.userId);
    const r = await post(`${BASE}/${l.requestId}/invite`, cookie, { builder: locked.builder.userId }, { ...env, DB: db } as Bindings);
    expect(r.status).toBe(409);
    expect(await invitesOf(l.requestId)).toEqual([]);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("pending");
    expect(await interestAudit(iid)).toEqual([]);
  });

  it("keeps the 5-invite cap: a sixth builder with an interest is refused, no invitation, interest still pending, no interest audit", async () => {
    const l = await listed();
    const five = await Promise.all(Array.from({ length: 5 }, (_, i) => makeBuilder(`ib-six-${tag()}-${i}@vnx.si`, `ibsix${tag()}`, "approved")));
    await inviteBuilders((await findClientRequest(testEnv.DB, l.clientId, l.requestId))!, five);
    const sixth = await builderWithCookie();
    const iid = await interestOf(l, sixth.builder.userId);
    const { cookie } = await asRole("owner");
    const r = await post(`${BASE}/${l.requestId}/invite`, cookie, { builder: sixth.builder.userId });
    expect([400, 409]).toContain(r.status);
    expect((await invitesOf(l.requestId)).includes(sixth.builder.userId)).toBe(false);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("pending");
    expect(await interestAudit(iid)).toEqual([]);
  });

  it("an OAuth session cannot invite from Ops (404) or from /admin (403): the interest and the invitations do not change; by magic link both work", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const op = await member(`ops-ib-inv-${tag()}@vnx.si`, "operator");
    const oauthOp = await signIn(op.user.email, { method: "oauth_google" });
    const oauthRoot = await signIn(ROOT, { method: "oauth_github", admin: true });
    expect((await post(`${BASE}/${l.requestId}/invite`, oauthOp.cookie, { builder: builder.userId })).status).toBe(404);
    expect((await post(`/admin/requests/${l.requestId}/invite`, oauthRoot.cookie, { builder: builder.userId })).status).toBe(403);
    expect(await invitesOf(l.requestId)).toEqual([]);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("pending");
    expect((await post(`${BASE}/${l.requestId}/invite`, op.cookie, { builder: builder.userId })).status).toBe(303);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("invited");
  });

  it("an interest dismissed in a competing request is not flipped by an invite that read it as pending (the audit follows the batch's own write)", async () => {
    const l = await listed();
    const { builder } = await builderWithCookie();
    const iid = await interestOf(l, builder.userId);
    const { cookie } = await asRole("owner");
    // Between the route's read and its batch the interest is dismissed by someone else.
    const db = racing("UPDATE request_interests SET status = 'dismissed', write_id = ?2 WHERE id = ?1", iid, ulid());
    const r = await post(`${BASE}/${l.requestId}/invite`, cookie, { builder: builder.userId }, { ...env, DB: db } as Bindings);
    expect(r.status).toBe(303);
    expect(await invitesOf(l.requestId)).toEqual([builder.userId]);
    expect((await findInterestById(testEnv.DB, iid))!.status).toBe("dismissed");
    expect(await interestAudit(iid)).toEqual([]);
  });
});
