import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, getSessionUser } from "../../src/auth/sessions.ts";
import { consumeLoginToken, createLoginToken, LOGIN_TOKEN_TTL_MS } from "../../src/auth/tokens.ts";
import { createUser } from "../../src/db/users.ts";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import worker from "../../src/index.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR = 3600;
// The job always gets its clock from the caller; nothing here depends on the machine's time.
const NOW = new Date("2026-10-04T01:00:00Z");

const count = async (sql: string, ...params: unknown[]) =>
  (await testEnv.DB.prepare(sql).bind(...params).first<{ n: number }>())?.n ?? 0;
const rateWindow = (key: string) => count("SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?1", key);
// The M5 inquiry steps and the VNX-0606 (M6) request steps run before the clean-up steps (test/jobs/daily-inquiries.test.ts,
// daily-requests.test.ts cover them). This file creates no inquiries, requests or ghost accounts, so they find nothing to do.
const IDLE_ACTIVITY_STEPS = [
  { job: "daily", step: "remind", sent: 0 },
  { job: "daily", step: "alert", sent: 0 },
  { job: "daily", step: "resend", sent: 0 },
  { job: "daily", step: "invites_expire", expired: 0 },
  { job: "daily", step: "requests_expire", expired: 0 },
  { job: "daily", step: "invite_remind", sent: 0 },
  { job: "daily", step: "pending_inquiries", deleted: 0 },
  { job: "daily", step: "pending_requests", deleted: 0 },
  { job: "daily", step: "ghost_users", deleted: 0 },
];

/** A DB whose statements on one table throw, to show one failing step does not stop the others. */
function brokenOn(table: string): D1Database {
  const db = testEnv.DB;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") {
        return (sql: string) => {
          if (sql.includes(table)) throw new Error(`boom on ${table}`);
          return target.prepare(sql);
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("daily clean-up job (VNX-0705a AC8)", () => {
  it("deletes rate-limit windows older than 2 days and expired login tokens and sessions, keeping the rest", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Rate-limit windows: 3 days old (gone), 2 days minus an hour (kept), last hour (kept).
    await hitRateLimit(testEnv.DB, "daily:old", 10, HOUR, NOW.getTime() - 3 * DAY_MS);
    await hitRateLimit(testEnv.DB, "daily:edge", 10, HOUR, NOW.getTime() - 2 * DAY_MS + HOUR * 1000);
    await hitRateLimit(testEnv.DB, "daily:new", 10, HOUR, NOW.getTime() - 60_000);

    // Login tokens: one expired an hour ago (gone), one still valid (kept).
    const oldToken = await createLoginToken(testEnv.DB, { email: "daily-old@vnx.si", purpose: "login", locale: "en" }, new Date(NOW.getTime() - LOGIN_TOKEN_TTL_MS - HOUR * 1000));
    const liveToken = await createLoginToken(testEnv.DB, { email: "daily-live@vnx.si", purpose: "login", locale: "en" }, new Date(NOW.getTime() - 60_000));

    // Sessions: one expired yesterday (gone), one created today (kept).
    const user = await createUser(testEnv.DB, { email: "daily-session@vnx.si", locale: "en", now: new Date(NOW.getTime() - 40 * DAY_MS).toISOString() });
    const oldSession = await createSession(testEnv.DB, user.id, new Date(NOW.getTime() - 31 * DAY_MS));
    const liveSession = await createSession(testEnv.DB, user.id, new Date(NOW.getTime() - 60_000));

    const expected = {
      rate_limits: await count("SELECT COUNT(*) AS n FROM rate_limits WHERE window_start < ?1", Math.floor(NOW.getTime() / 1000) - 2 * 86400),
      login_tokens: await count("SELECT COUNT(*) AS n FROM login_tokens WHERE expires_at < ?1", NOW.toISOString()),
      sessions: await count("SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?1", NOW.toISOString()),
    };
    expect(Object.values(expected).every((n) => n >= 1)).toBe(true);

    const results = await runDaily(testEnv, NOW);
    expect(results).toEqual([
      ...IDLE_ACTIVITY_STEPS,
      { job: "daily", step: "rate_limits", deleted: expected.rate_limits },
      { job: "daily", step: "login_tokens", deleted: expected.login_tokens },
      { job: "daily", step: "sessions", deleted: expected.sessions },
    ]);

    expect(await rateWindow("daily:old")).toBe(0);
    expect(await rateWindow("daily:edge")).toBe(1);
    expect(await rateWindow("daily:new")).toBe(1);

    // The expired token row is gone (unknown, not "expired"); the live one still works.
    expect(await consumeLoginToken(testEnv.DB, oldToken, NOW, "login")).toEqual({ ok: false, reason: "invalid" });
    expect((await consumeLoginToken(testEnv.DB, liveToken, NOW, "login")).ok).toBe(true);

    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1", user.id)).toBe(1);
    expect(await getSessionUser(testEnv.DB, liveSession, NOW)).not.toBeNull();
    expect(await getSessionUser(testEnv.DB, oldSession, NOW)).toBeNull();
  });

  it("is idempotent: a second run deletes nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await hitRateLimit(testEnv.DB, "daily:again", 10, HOUR, NOW.getTime() - 5 * DAY_MS);
    await runDaily(testEnv, NOW);
    const second = await runDaily(testEnv, NOW);
    expect(second).toEqual([
      ...IDLE_ACTIVITY_STEPS,
      { job: "daily", step: "rate_limits", deleted: 0 },
      { job: "daily", step: "login_tokens", deleted: 0 },
      { job: "daily", step: "sessions", deleted: 0 },
    ]);
  });

  it("logs one JSON line per step", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runDaily(testEnv, NOW);
    const lines = log.mock.calls.map((call) => call[0] as string);
    expect(lines).toHaveLength(IDLE_ACTIVITY_STEPS.length + 3);
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      ...IDLE_ACTIVITY_STEPS,
      { job: "daily", step: "rate_limits", deleted: 0 },
      { job: "daily", step: "login_tokens", deleted: 0 },
      { job: "daily", step: "sessions", deleted: 0 },
    ]);
    for (const line of lines) expect(line).not.toContain("\n");
  });

  it("keeps going when one step fails, and logs the error", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await createLoginToken(testEnv.DB, { email: "daily-after-fail@vnx.si", purpose: "login", locale: "en" }, new Date(NOW.getTime() - DAY_MS));
    const env = { ...testEnv, DB: brokenOn("rate_limits") } as Bindings;
    const results = await runDaily(env, NOW);
    const at = IDLE_ACTIVITY_STEPS.length;
    expect(results.slice(0, at)).toEqual(IDLE_ACTIVITY_STEPS);
    expect(results[at]).toEqual({ job: "daily", step: "rate_limits", error: "Error: boom on rate_limits" });
    expect(results[at + 1]).toEqual({ job: "daily", step: "login_tokens", deleted: 1 });
    expect(results[at + 2]).toEqual({ job: "daily", step: "sessions", deleted: 0 });
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toEqual({ job: "daily", step: "rate_limits", error: "Error: boom on rate_limits" });
  });
});

describe("scheduled handler (VNX-0705a AC9)", () => {
  it("the Worker exports scheduled and runs the job at the trigger's time", async () => {
    expect(typeof worker.scheduled).toBe("function");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await hitRateLimit(testEnv.DB, "daily:scheduled", 10, HOUR, NOW.getTime() - 3 * DAY_MS);
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
    const controller = { scheduledTime: NOW.getTime(), cron: "0 1 * * *", noRetry: () => {} } as ScheduledController;
    await worker.scheduled?.(controller, testEnv, ctx);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(await rateWindow("daily:scheduled")).toBe(0);
    expect(log.mock.calls.map((c) => JSON.parse(c[0] as string).step)).toEqual([...IDLE_ACTIVITY_STEPS.map((r) => r.step), "rate_limits", "login_tokens", "sessions"]);
  });
});
