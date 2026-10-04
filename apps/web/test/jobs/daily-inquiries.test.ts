import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "../../src/auth/sessions.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { writeAudit } from "../../src/db/audit.ts";
import { createInvite } from "../../src/db/invites.ts";
import { grantBadge } from "../../src/db/verifications.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { createUser, findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import { runDaily, type DailyResult } from "../../src/jobs/daily.ts";
import { makeBuilder, makeInquiry, makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-10T01:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const sentTo = (to: string) => outbox.filter((m) => m.to === to);
/** The `sent` or `deleted` count a named step reported; fails the test if the step errored or is missing. */
function stepCount(results: DailyResult[], step: string, key: "sent" | "deleted"): number {
  const result = results.find((r) => r.step === step);
  expect(result, step).toBeDefined();
  expect(result, step).toHaveProperty(key);
  return (result as unknown as Record<typeof key, number>)[key];
}

describe("daily job, inquiry steps (spec §8.4, VNX-0505)", () => {
  beforeEach(() => clearOutbox());

  it("reminds the builder once after 3 days without a reply", async () => {
    const due = await makeInquiry({ tag: "dj-rem", status: "open", now: daysAgo(4), builderLocale: "vi" });
    const fresh = await makeInquiry({ tag: "dj-rem2", status: "open", now: daysAgo(1) });
    const answered = await makeInquiry({ tag: "dj-rem3", status: "answered", now: daysAgo(5) });
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-rem-b@vnx.si").map((m) => m.subject)).toContain("Minh Tran đang chờ bạn trả lời");
    expect(sentTo("dj-rem2-b@vnx.si").filter((m) => m.subject.includes("waiting"))).toEqual([]);
    expect(sentTo("dj-rem3-b@vnx.si").filter((m) => m.subject.includes("waiting"))).toEqual([]);
    expect((await findInquiryById(testEnv.DB, due.inquiry.id))?.builderRemindedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-rem-b@vnx.si").filter((m) => m.subject.includes("chờ"))).toEqual([]);
    expect(fresh.inquiry.id && answered.inquiry.id).toBeTruthy();
  });

  it("tells the admins once about inquiries open for 7 days", async () => {
    const late = await makeInquiry({ tag: "dj-alert", status: "open", now: daysAgo(8) });
    await runDaily(testEnv, NOW);
    const alert = sentTo("owner@vnx.si").find((m) => m.subject.includes("unanswered for 7 days"));
    expect(alert?.text).toContain(late.inquiry.id);
    expect((await findInquiryById(testEnv.DB, late.inquiry.id))?.adminAlertedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("owner@vnx.si").filter((m) => m.text.includes(late.inquiry.id))).toEqual([]);
  });

  it("resends due notifications once, and skips them after a success", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "dj-resend", status: "open", now: daysAgo(0) });
    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "resend", "sent")).toBeGreaterThanOrEqual(1);
    expect(sentTo("dj-resend-b@vnx.si")).toHaveLength(1);
    expect((await listMessages(testEnv.DB, inquiry.id))[0]?.id).toBe(firstMessageId);
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-resend-b@vnx.si")).toHaveLength(0);
  });

  it("stops after three failed attempts in all", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "dj-fail", status: "open", now: daysAgo(0) });
    const noMail = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
    for (let i = 0; i < 4; i++) await runDaily(noMail, NOW);
    const [message] = await listMessages(testEnv.DB, inquiry.id);
    expect(message).toMatchObject({ id: firstMessageId, notifyAttempts: 3, notifiedAt: null });
  });

  it("deletes unconfirmed inquiries after 48 hours and the ghost accounts behind them", async () => {
    const old = await makeInquiry({ tag: "dj-ghost", status: "pending_verification", now: daysAgo(3) });
    // Make the client a never-signed-in implicit account created 3 days ago.
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(old.client.id, daysAgo(3)).run();
    const recent = await makeInquiry({ tag: "dj-ghost2", status: "pending_verification", now: daysAgo(1) });
    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "pending_inquiries", "deleted")).toBeGreaterThanOrEqual(1);
    expect(await findInquiryById(testEnv.DB, old.inquiry.id)).toBeNull();
    expect(await findInquiryById(testEnv.DB, recent.inquiry.id)).not.toBeNull();
    expect(await findUserByEmail(testEnv.DB, old.client.email)).toBeNull();
  });

  it("deletes a never-confirmed inquiry an admin moved to removed, and its ghost account; keeps a removed one that was confirmed (M6 review F4)", async () => {
    const never = await makeInquiry({ tag: "dj-rm1", status: "pending_verification", now: daysAgo(3) });
    const confirmed = await makeInquiry({ tag: "dj-rm2", status: "open", now: daysAgo(3) });
    for (const x of [never, confirmed]) await testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(x.client.id, daysAgo(3)).run();
    await testEnv.DB.prepare("UPDATE inquiries SET status = 'removed' WHERE id IN (?1, ?2)").bind(never.inquiry.id, confirmed.inquiry.id).run();
    const results = await runDaily(testEnv, NOW);
    expect(results.filter((r) => "error" in r)).toEqual([]);
    expect(await findInquiryById(testEnv.DB, never.inquiry.id)).toBeNull();
    expect(await findUserByEmail(testEnv.DB, never.client.email)).toBeNull();
    expect((await findInquiryById(testEnv.DB, confirmed.inquiry.id))?.status).toBe("removed");
    expect(await findUserByEmail(testEnv.DB, confirmed.client.email)).not.toBeNull();
  });

  it("keeps accounts that signed in, have a session, a builder row, an inquiry or are recent", async () => {
    const iso = daysAgo(5);
    const signedIn = await createUser(testEnv.DB, { email: "dj-keep1@vnx.si", locale: "en", now: iso });
    await testEnv.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(signedIn.id, iso).run();
    const withSession = await createUser(testEnv.DB, { email: "dj-keep2@vnx.si", locale: "en", now: iso });
    await createSession(testEnv.DB, withSession.id, NOW);
    const withInquiry = await makeInquiry({ tag: "dj-keep3", status: "open", now: iso });
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(withInquiry.client.id, iso).run();
    const recent = await createUser(testEnv.DB, { email: "dj-keep4@vnx.si", locale: "en", now: daysAgo(1) });
    const ghost = await createUser(testEnv.DB, { email: "dj-ghost3@vnx.si", locale: "en", now: iso });
    await runDaily(testEnv, NOW);
    for (const email of ["dj-keep1@vnx.si", "dj-keep2@vnx.si", withInquiry.client.email, "dj-keep4@vnx.si"]) expect(await findUserByEmail(testEnv.DB, email), email).not.toBeNull();
    expect(await findUserByEmail(testEnv.DB, "dj-ghost3@vnx.si")).toBeNull();
    expect(recent.id && ghost.id).toBeTruthy();
  });

  it("does not remind a suspended builder", async () => {
    const due = await makeInquiry({ tag: "dj-susp", status: "open", now: daysAgo(4) });
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(due.builder.userId).run();
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-susp-b@vnx.si").filter((m) => m.subject.includes("waiting"))).toEqual([]);
    expect((await findInquiryById(testEnv.DB, due.inquiry.id))?.builderRemindedAt).toBeNull();
  });

  it("warns (without addresses) when inquiries are overdue and no admin e-mail is configured", async () => {
    await makeInquiry({ tag: "dj-noadm", status: "open", now: daysAgo(9) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await runDaily({ ...testEnv, ADMIN_EMAILS: "" } as Bindings, NOW);
      const line = warn.mock.calls.map((c) => String(c[0])).find((l) => l.includes("jobs.daily.no_admins"));
      expect(line).toBeDefined();
      const parsed = JSON.parse(line!) as { event: string; overdue: number };
      expect(parsed.event).toBe("jobs.daily.no_admins");
      expect(parsed.overdue).toBeGreaterThanOrEqual(1);
      expect(line).not.toContain("@");
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps a suspended never-signed-in account", async () => {
    const spam = await createUser(testEnv.DB, { email: "dj-suspended-ghost@vnx.si", locale: "en", now: daysAgo(5) });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(spam.id).run();
    await runDaily(testEnv, NOW);
    expect(await findUserByEmail(testEnv.DB, "dj-suspended-ghost@vnx.si")).not.toBeNull();
  });

  it("keeps old never-signed-in accounts that are a builder, an invite creator, a badge verifier or an audit actor", async () => {
    const iso = daysAgo(5);
    const age = (id: string) => testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(id, iso).run();
    const builder = await makeBuilder("dj-k-builder@vnx.si", "dj-k-builder", "approved");
    const inviter = await createUser(testEnv.DB, { email: "dj-k-inviter@vnx.si", locale: "en", now: iso });
    await createInvite(testEnv.DB, { codeHash: await sha256Hex("dj-k-invite"), createdBy: inviter.id, maxUses: 1, expiresAt: daysAgo(-30), note: null, now: iso });
    const verifier = await createUser(testEnv.DB, { email: "dj-k-verifier@vnx.si", locale: "en", now: iso });
    const { product } = await makeLiveProduct("dj-k-owner@vnx.si", "dj-k-owner", "Dj Keep Kit");
    await grantBadge(testEnv.DB, { productId: product.id, kind: "demo_verified", verifiedBy: verifier.id, evidence: "checked", now: iso });
    const actor = await createUser(testEnv.DB, { email: "dj-k-actor@vnx.si", locale: "en", now: iso });
    await writeAudit(testEnv.DB, { actorUserId: actor.id, action: "test.keep", entity: "user", entityId: actor.id, now: iso });
    for (const id of [builder.userId, inviter.id, verifier.id, actor.id]) await age(id);
    await runDaily(testEnv, NOW);
    for (const email of ["dj-k-builder@vnx.si", "dj-k-inviter@vnx.si", "dj-k-verifier@vnx.si", "dj-k-actor@vnx.si"]) expect(await findUserByEmail(testEnv.DB, email), email).not.toBeNull();
  });

  it("cleans expired tokens, sessions and old rate-limit windows", async () => {
    await createLoginToken(testEnv.DB, { email: "dj-tok@vnx.si", purpose: "login", locale: "en" }, new Date(daysAgo(3)));
    const user = await createUser(testEnv.DB, { email: "dj-sess@vnx.si", locale: "en", now: daysAgo(40) });
    await testEnv.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(user.id, daysAgo(40)).run();
    await createSession(testEnv.DB, user.id, new Date(daysAgo(40)));
    await hitRateLimit(testEnv.DB, "dj:test", 5, 3600, NOW.getTime() - 3 * 24 * 3600 * 1000);
    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "login_tokens", "deleted")).toBeGreaterThanOrEqual(1);
    expect(stepCount(results, "sessions", "deleted")).toBeGreaterThanOrEqual(1);
    expect(stepCount(results, "rate_limits", "deleted")).toBeGreaterThanOrEqual(1);
    const left = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = 'dj:test'").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
