import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listCandidates, listRequestInvites, findRequestById, proposeStatement, returnedInvite } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { runDaily, type DailyResult } from "../../src/jobs/daily.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-10T01:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3600 * 1000).toISOString();
const sentTo = (to: string) => outbox.filter((m) => m.to === to);
const subjectsTo = (to: string) => sentTo(to).map((m) => m.subject);
const inviteOf = async (requestId: string, inviteId: string) => (await listRequestInvites(testEnv.DB, requestId)).find((x) => x.invite.id === inviteId)!.invite;
const builders = (tag: string, keys: string[]) => Promise.all(keys.map((k) => makeBuilder(`${tag}-${k}@vnx.si`, `${tag}-${k}`, "approved")));
const adminCookie = async () => (await signIn("owner@vnx.si", { admin: true })).cookie;
/** runDaily, failing the test when any step reported an error. */
async function runClean(now: Date): Promise<DailyResult[]> {
  const results = await runDaily(testEnv, now);
  expect(results.filter((r) => "error" in r)).toEqual([]);
  return results;
}
function stepCount(results: DailyResult[], step: string, key: "sent" | "deleted" | "expired"): number {
  const result = results.find((r) => r.step === step);
  expect(result, step).toBeDefined();
  expect(result, step).toHaveProperty(key);
  return (result as unknown as Record<typeof key, number>)[key];
}

describe("daily job, request steps (spec §8.4, VNX-0606)", () => {
  // The fixture admin invites builders; a real admin has signed in, so (unlike a bare fixture user) is not a ghost account.
  beforeEach(async () => {
    clearOutbox();
    await adminCookie();
  });

  it("reminds a builder once after 3 days, in their language, without the client's e-mail", async () => {
    const { client, request } = await makeRequest({ tag: "dr-rem", now: daysAgo(4) });
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run(); // the client typed their e-mail as their name
    const [b] = await builders("dr-rem", ["b"]);
    await testEnv.DB.prepare("UPDATE users SET locale = 'vi' WHERE id = ?1").bind(b!.userId).run();
    const [invite] = await inviteBuilders(request, [b!], daysAgo(4));
    const fresh = await makeRequest({ tag: "dr-rem2", now: daysAgo(1) });
    await inviteBuilders(fresh.request, await builders("dr-rem2", ["b"]), daysAgo(1));

    const results = await runClean(NOW);
    expect(stepCount(results, "invite_remind", "sent")).toBeGreaterThanOrEqual(1);
    expect(subjectsTo("dr-rem-b@vnx.si")).toEqual([`Nhắc: hãy phản hồi “${request.title}”`]);
    expect(sentTo("dr-rem-b@vnx.si").every((m) => ![m.subject, m.text, m.html].some((part) => part.includes(client.email)))).toBe(true);
    expect(sentTo("dr-rem2-b@vnx.si")).toEqual([]);
    expect((await inviteOf(request.id, invite!.id)).remindedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runClean(NOW);
    expect(sentTo("dr-rem-b@vnx.si")).toEqual([]);
  });

  it("lapses an invitation after 7 days with one 'ended' e-mail; a late answer before the cron still counts (soft deadline)", async () => {
    const { request } = await makeRequest({ tag: "dr-exp", now: daysAgo(8) });
    const [a, b, d] = await builders("dr-exp", ["a", "b", "d"]);
    const [ia, ib] = await inviteBuilders(request, [a!, b!], daysAgo(8));
    const [id] = await inviteBuilders(request, [d!], daysAgo(6));
    // Day 8, the cron has not run yet: b still answers, and it is accepted.
    const answered = await testEnv.DB.batch([
      proposeStatement(testEnv.DB, { inviteId: ib!.id, builderId: b!.userId, proposal: { approach: "Next.js", priceCents: 450000, priceMaxCents: null, priceNote: "", timelineDays: 30 }, now: NOW.toISOString() }),
    ]);
    expect(returnedInvite(answered[0])?.status).toBe("proposed");

    const results = await runClean(NOW);
    expect(stepCount(results, "invites_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect((await inviteOf(request.id, ia!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, ib!.id)).status).toBe("proposed");
    expect((await inviteOf(request.id, id!.id)).status).toBe("invited");
    // a lapsed: the "ended" e-mail only (expired before the reminder step); d is 6 days old: reminded, not expired; b answered: nothing.
    expect(subjectsTo("dr-exp-a@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
    expect(subjectsTo("dr-exp-d@vnx.si")).toEqual([`Reminder: respond to “${request.title}”`]);
    expect(sentTo("dr-exp-b@vnx.si")).toEqual([]);
    clearOutbox();
    await runClean(NOW);
    expect(outbox).toEqual([]);
  });

  it("expires a matching request 30 days after matched_at: client told, proposals not selected and told, stale invitations told once", async () => {
    const { request } = await makeRequest({ tag: "dr-req", now: daysAgo(31) });
    const [a, b, d] = await builders("dr-req", ["a", "b", "d"]);
    const [ia, ib] = await inviteBuilders(request, [a!, b!], daysAgo(31));
    const [id] = await inviteBuilders(request, [d!], daysAgo(4)); // matched_at stays at the first invitation; 4 days old would be reminded, but the request ends first
    await proposeOn(ia!, daysAgo(30));

    const results = await runClean(NOW);
    expect(stepCount(results, "requests_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "expired", closedAt: NOW.toISOString() });
    expect((await inviteOf(request.id, ia!.id)).status).toBe("not_selected");
    expect((await inviteOf(request.id, ib!.id)).status).toBe("expired"); // lapsed at 7 days
    expect((await inviteOf(request.id, id!.id)).status).toBe("expired"); // settled by the request ending
    expect(subjectsTo("dr-req-c@vnx.si")).toEqual([`Your request has expired: ${request.title}`]);
    expect(subjectsTo("dr-req-a@vnx.si")).toEqual([`Update on your proposal: ${request.title}`]);
    expect(subjectsTo("dr-req-b@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
    expect(subjectsTo("dr-req-d@vnx.si")).toEqual([`Invitation ended: ${request.title}`]); // exactly one: no reminder before it (step order)
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.expire' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    clearOutbox();
    await runClean(NOW);
    expect(outbox).toEqual([]);
  });

  it("counts the 30 days from matched_at, not from creation; a submitted request never expires", async () => {
    const { request } = await makeRequest({ tag: "dr-keep", now: daysAgo(45) });
    await inviteBuilders(request, await builders("dr-keep", ["b"]), daysAgo(29));
    const idle = await makeRequest({ tag: "dr-keep2", now: daysAgo(40) }); // submitted, never invited
    await runClean(NOW);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
    expect((await findRequestById(testEnv.DB, idle.request.id))?.status).toBe("submitted");
  });

  it("deletes unconfirmed requests after 48 hours, then their implicit accounts", async () => {
    const old = await makeRequest({ tag: "dr-pend", status: "pending_verification", now: hoursAgo(49) });
    const young = await makeRequest({ tag: "dr-pend2", status: "pending_verification", now: hoursAgo(47) });
    const confirmed = await makeRequest({ tag: "dr-pend3", now: hoursAgo(49) }); // submitted: the clean-up never touches it
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(old.client.id, hoursAgo(49)).run();
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(young.client.id, hoursAgo(47)).run();
    const results = await runClean(NOW);
    expect(stepCount(results, "pending_requests", "deleted")).toBeGreaterThanOrEqual(1);
    expect(await findRequestById(testEnv.DB, old.request.id)).toBeNull();
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(old.client.id).first()).toBeNull();
    expect((await findRequestById(testEnv.DB, young.request.id))?.status).toBe("pending_verification");
    expect((await findRequestById(testEnv.DB, confirmed.request.id))?.status).toBe("submitted");
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(young.client.id).first()).not.toBeNull();
  });

  it("also deletes a never-confirmed request an admin moved to removed, and its ghost account; keeps a removed one that was confirmed (M6 review F4)", async () => {
    const never = await makeRequest({ tag: "dr-rm1", status: "pending_verification", now: hoursAgo(49) });
    const confirmed = await makeRequest({ tag: "dr-rm2", now: hoursAgo(49) });
    for (const x of [never, confirmed]) await testEnv.DB.prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(x.client.id, hoursAgo(49)).run();
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id IN (?1, ?2)").bind(never.request.id, confirmed.request.id).run();
    const results = await runClean(NOW);
    expect(results.filter((r) => "error" in r)).toEqual([]);
    expect(await findRequestById(testEnv.DB, never.request.id)).toBeNull();
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(never.client.id).first()).toBeNull();
    expect((await findRequestById(testEnv.DB, confirmed.request.id))?.status).toBe("removed");
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(confirmed.client.id).first()).not.toBeNull();
  });

  it("is idempotent: a second run sends nothing and changes no row", async () => {
    const lapse = await makeRequest({ tag: "dr-idem1", now: daysAgo(8) });
    await inviteBuilders(lapse.request, await builders("dr-idem1", ["b"]), daysAgo(8));
    const remind = await makeRequest({ tag: "dr-idem2", now: daysAgo(4) });
    await inviteBuilders(remind.request, await builders("dr-idem2", ["b"]), daysAgo(4));
    const old = await makeRequest({ tag: "dr-idem3", now: daysAgo(31) });
    const [x, y] = await builders("dr-idem3", ["x", "y"]);
    const [ix] = await inviteBuilders(old.request, [x!, y!], daysAgo(31));
    await proposeOn(ix!, daysAgo(30));
    await makeRequest({ tag: "dr-idem4", status: "pending_verification", now: hoursAgo(49) });

    await runClean(NOW);
    expect(outbox.length).toBeGreaterThanOrEqual(5);
    const snapshot = async () =>
      JSON.stringify([
        (await testEnv.DB.prepare("SELECT id, status, updated_at, reminded_at FROM request_invites ORDER BY id").all()).results,
        (await testEnv.DB.prepare("SELECT id, status, updated_at, closed_at FROM requests ORDER BY id").all()).results,
        (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first()),
      ]);
    const before = await snapshot();
    clearOutbox();
    const second = await runClean(NOW);
    expect(outbox).toEqual([]);
    expect(await snapshot()).toBe(before);
    expect(second.filter((r) => "error" in r)).toEqual([]);
    expect(stepCount(second, "invites_expire", "expired")).toBe(0);
    expect(stepCount(second, "invite_remind", "sent")).toBe(0);
    expect(stepCount(second, "requests_expire", "expired")).toBe(0);
    expect(stepCount(second, "pending_requests", "deleted")).toBe(0);
  });
});

describe("suspension expires invitations at once and silently (spec §7.6, Owner 2026-10-04)", () => {
  beforeEach(() => clearOutbox());

  it("admin suspends the builder: expired now, no e-mail; the client closing the request later still tells nobody who was suspended", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { client, request } = await makeRequest({ tag: "ds-bld" });
    const [x, y] = await builders("ds-bld", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    expect((await app.request(formPost(`/admin/builders/${x!.userId}/suspend`, { reason: "" }, { cookie }), undefined, testEnv)).status).toBe(303);
    expect((await inviteOf(request.id, ix!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, iy!.id)).status).toBe("invited");
    expect(outbox).toEqual([]);

    const own = await signIn(client.email);
    expect((await app.request(formPost(`/me/requests/${request.id}/close`, {}, { cookie: own.cookie }), undefined, testEnv)).status).toBe(303);
    expect(sentTo("ds-bld-x@vnx.si")).toEqual([]);
    expect(subjectsTo("ds-bld-y@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
  });

  it("even when the suspended builder's invitation is still invited (suspended behind the route's back), closing sends them nothing", async () => {
    const app = createApp();
    const { client, request } = await makeRequest({ tag: "ds-raw" });
    const [x, y] = await builders("ds-raw", ["x", "y"]);
    await inviteBuilders(request, [x!, y!]);
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(x!.userId).run();
    const own = await signIn(client.email);
    expect((await app.request(formPost(`/me/requests/${request.id}/close`, {}, { cookie: own.cookie }), undefined, testEnv)).status).toBe(303);
    expect(sentTo("ds-raw-x@vnx.si")).toEqual([]);
    expect(subjectsTo("ds-raw-y@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
  });

  it("admin suspends the user: expired in the same transaction as the status and the audit row; unsuspending does not revive it", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { request } = await makeRequest({ tag: "ds-usr" });
    const [x, y] = await builders("ds-usr", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    expect((await app.request(formPost(`/admin/users/${y!.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(303);
    expect((await inviteOf(request.id, iy!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, ix!.id)).status).toBe("invited");
    expect(outbox).toEqual([]);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'user.suspend' AND entity_id = ?1").bind(y!.userId).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    await app.request(formPost(`/admin/users/${y!.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect((await inviteOf(request.id, iy!.id)).status).toBe("expired");
  });

  it("the daily job sweeps what the route missed, silently", async () => {
    await adminCookie(); // the inviting admin has signed in, so it is not a ghost account
    const { request } = await makeRequest({ tag: "ds-cron", now: daysAgo(1) });
    const [x] = await builders("ds-cron", ["x"]);
    const [ix] = await inviteBuilders(request, [x!], daysAgo(1));
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(x!.userId).run();
    const results = await runClean(NOW);
    expect(stepCount(results, "invites_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect((await inviteOf(request.id, ix!.id)).status).toBe("expired");
    expect(sentTo("ds-cron-x@vnx.si")).toEqual([]);
  });

  // Spec §8.10 counts only lapses (julianday(updated_at) - julianday(invited_at) >= 7).
  it("a suspension on day 0 is not a lapse for the §8.10 penalty; the cron's 7-day lapse is", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const early = await makeRequest({ tag: "ds-pen1" });
    const [p] = await builders("ds-pen1", ["p"]);
    await inviteBuilders(early.request, [p!]); // invited now
    await app.request(formPost(`/admin/builders/${p!.userId}/suspend`, { reason: "" }, { cookie }), undefined, testEnv);
    await app.request(formPost(`/admin/builders/${p!.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);

    const late = await makeRequest({ tag: "ds-pen2", now: daysAgo(8) });
    const [q] = await builders("ds-pen2", ["q"]);
    await inviteBuilders(late.request, [q!], daysAgo(8));
    await runClean(NOW);

    const other = await makeRequest({ tag: "ds-pen3" });
    const candidates = await listCandidates(testEnv.DB, other.request, daysAgo(60));
    expect(candidates.find((c) => c.userId === p!.userId)?.expiredInvites).toBe(0);
    expect(candidates.find((c) => c.userId === q!.userId)?.expiredInvites).toBe(1);
  });
});

describe("every system-driven invitation expiry is audited (M6 review F3)", () => {
  it("a failing audit batch never costs the lapse e-mails", async () => {
    clearOutbox();
    await adminCookie();
    const { request } = await makeRequest({ tag: "au-fail", now: daysAgo(8) });
    const [a] = await builders("au-fail", ["a"]);
    const [ia] = await inviteBuilders(request, [a!], daysAgo(8));
    // Only the audit batch (the lone lapse here) is rejected; D1 methods are bound to the real binding.
    const failing = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "batch") return (statements: D1PreparedStatement[]) => (statements.length === 1 ? Promise.reject(new Error("audit down")) : target.batch(statements));
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const results = await runDaily({ ...testEnv, DB: failing } as typeof testEnv, NOW);
    expect(results.find((r) => r.step === "invites_expire")).toHaveProperty("expired");
    expect((await inviteOf(request.id, ia!.id)).status).toBe("expired");
    expect(subjectsTo("au-fail-a@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
  });

  beforeEach(async () => {
    clearOutbox();
    await adminCookie();
  });
  const expireAudits = async (inviteId: string) =>
    (await testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = 'request_invite.expire' AND entity_id = ?1").bind(inviteId).all<{ actor_user_id: string | null; entity: string; data: string }>()).results;

  it("the cron lapse and the cron re-sweep each write one row (no actor), and a second run writes none", async () => {
    const { request } = await makeRequest({ tag: "au-cron", now: daysAgo(8) });
    const [a, b] = await builders("au-cron", ["a", "b"]);
    const [ia, ib] = await inviteBuilders(request, [a!, b!], daysAgo(8));
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(b!.userId).run();
    const first = await runClean(NOW);
    expect(first.filter((r) => "error" in r)).toEqual([]);
    const lapsed = await expireAudits(ia!.id);
    expect(lapsed).toHaveLength(1);
    expect(lapsed[0]).toMatchObject({ actor_user_id: null, entity: "request_invite" });
    expect(JSON.parse(lapsed[0]!.data)).toMatchObject({ requestId: request.id, reason: "lapsed" });
    expect(JSON.parse((await expireAudits(ib!.id))[0]!.data)).toMatchObject({ reason: "builder_inactive" });
    const total = async () => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request_invite.expire'").first<{ n: number }>())!.n;
    const n = await total();
    await runClean(NOW);
    await runClean(new Date(NOW.getTime() + 3600_000));
    expect(await total()).toBe(n);
  });

  it("the admin suspending a builder writes a row naming the admin", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { request } = await makeRequest({ tag: "au-bld" });
    const [x, y] = await builders("au-bld", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    await app.request(formPost(`/admin/builders/${x!.userId}/suspend`, { reason: "" }, { cookie }), undefined, testEnv);
    const rows = await expireAudits(ix!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_user_id).not.toBeNull();
    expect(await expireAudits(iy!.id)).toEqual([]);
  });

  it("the admin suspending a user writes a row for the user's builder invitations; a lost suspend (409) writes none", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { request } = await makeRequest({ tag: "au-usr" });
    const [x, y] = await builders("au-usr", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    expect((await app.request(formPost(`/admin/users/${y!.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(303);
    expect(await expireAudits(iy!.id)).toHaveLength(1);
    expect(await expireAudits(ix!.id)).toEqual([]);
    expect((await app.request(formPost(`/admin/users/${y!.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
    expect(await expireAudits(iy!.id)).toHaveLength(1);
  });
});
