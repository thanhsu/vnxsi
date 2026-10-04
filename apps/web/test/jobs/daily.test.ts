import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../../src/auth/sessions.ts";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { createUser, findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-10T01:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const sentTo = (to: string) => outbox.filter((m) => m.to === to);

describe("daily job (spec §8.4)", () => {
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
    const summary = await runDaily(testEnv, NOW);
    expect(summary.resent).toBeGreaterThanOrEqual(1);
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
    const summary = await runDaily(testEnv, NOW);
    expect(summary.pendingDeleted).toBeGreaterThanOrEqual(1);
    expect(await findInquiryById(testEnv.DB, old.inquiry.id)).toBeNull();
    expect(await findInquiryById(testEnv.DB, recent.inquiry.id)).not.toBeNull();
    expect(await findUserByEmail(testEnv.DB, old.client.email)).toBeNull();
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

  it("cleans expired tokens, sessions and old rate-limit windows", async () => {
    await createLoginToken(testEnv.DB, { email: "dj-tok@vnx.si", purpose: "login", locale: "en" }, new Date(daysAgo(3)));
    const user = await createUser(testEnv.DB, { email: "dj-sess@vnx.si", locale: "en", now: daysAgo(40) });
    await testEnv.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(user.id, daysAgo(40)).run();
    await createSession(testEnv.DB, user.id, new Date(daysAgo(40)));
    await hitRateLimit(testEnv.DB, "dj:test", 5, 3600, NOW.getTime() - 3 * 24 * 3600 * 1000);
    const summary = await runDaily(testEnv, NOW);
    expect(summary.tokensDeleted).toBeGreaterThanOrEqual(1);
    expect(summary.sessionsDeleted).toBeGreaterThanOrEqual(1);
    expect(summary.rateLimitRowsDeleted).toBeGreaterThanOrEqual(1);
    const left = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = 'dj:test'").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
