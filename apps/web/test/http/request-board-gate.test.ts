import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import type { Bindings } from "../../src/env.ts";
import { isRequestBoardEnabled } from "../../src/http/request-board.ts";
import { ensureUser } from "../fixtures.ts";
import { countD1Queries, getReq, testEnv } from "../helpers.ts";

const PAST = "2026-01-01";
const FUTURE = "2999-01-01";
const withDate = (goLive: string | undefined): Bindings => ({ ...testEnv, REQUEST_BOARD_GO_LIVE: goLive });

async function flag(enabled: boolean): Promise<void> {
  const admin = await ensureUser("rbg-admin@vnx.si");
  await setFlag(testEnv.DB, { key: "request_board", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}

// M2: a test never assumes the flag is off; it leaves it off and the cache empty.
afterEach(async () => {
  vi.useRealTimers();
  await flag(false);
});

describe("isRequestBoardEnabled (addendum Q15; plan M1, M2, M3a)", () => {
  it("is off by default: no flag row, even with a past date", async () => {
    await flag(false);
    expect(await isRequestBoardEnabled(withDate(PAST))).toBe(false);
  });

  it("flag on and date not reached: off", async () => {
    await flag(true);
    expect(await isRequestBoardEnabled(withDate(FUTURE))).toBe(false);
  });

  it("flag off and date reached: off", async () => {
    await flag(false);
    expect(await isRequestBoardEnabled(withDate(PAST))).toBe(false);
  });

  it("flag on and date reached: on", async () => {
    await flag(true);
    expect(await isRequestBoardEnabled(withDate(PAST))).toBe(true);
  });

  it("an empty, missing or malformed date is off even with the flag on", async () => {
    await flag(true);
    for (const bad of ["", undefined, "2026-02-30", "2026-10-20T00:00", "soon"]) expect(await isRequestBoardEnabled(withDate(bad)), String(bad)).toBe(false);
  });

  it("follows the clock at go-live 00:00 UTC (Date faked), and stays on afterwards", async () => {
    await flag(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    const env = withDate("2026-12-01");
    vi.setSystemTime(new Date("2026-11-30T23:59:59.999Z"));
    expect(await isRequestBoardEnabled(env)).toBe(false);
    vi.setSystemTime(new Date("2026-12-01T00:00:00.000Z"));
    expect(await isRequestBoardEnabled(env)).toBe(true);
    vi.setSystemTime(new Date("2027-06-01T00:00:00.000Z"));
    expect(await isRequestBoardEnabled(env)).toBe(true);
  });

  it("takes the time as a parameter too", async () => {
    await flag(true);
    expect(await isRequestBoardEnabled(withDate("2026-12-01"), new Date("2026-11-30T23:59:59.999Z"))).toBe(false);
    expect(await isRequestBoardEnabled(withDate("2026-12-01"), new Date("2026-12-01T00:00:00.000Z"))).toBe(true);
  });

  it("M3a fail closed: when D1 rejects the flag read, the board is off", async () => {
    await flag(true);
    resetFlagCache();
    const broken = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare") return () => ({ all: () => Promise.reject(new Error("D1 down")), first: () => Promise.reject(new Error("D1 down")), bind() { return this; } });
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    }) as D1Database;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(await isRequestBoardEnabled({ DB: broken, REQUEST_BOARD_GO_LIVE: PAST })).toBe(false);
    } finally {
      quiet.mockRestore();
    }
  });

  it("F13: before go-live there is no D1 read at all; from go-live the flag is read", async () => {
    await flag(true);
    for (const goLive of ["", FUTURE]) {
      const { env, queries } = countD1Queries(withDate(goLive));
      expect(await isRequestBoardEnabled(env)).toBe(false);
      expect(queries(), goLive).toBe(0);
    }
    const live = countD1Queries(withDate(PAST));
    expect(await isRequestBoardEnabled(live.env)).toBe(true);
    expect(live.queries()).toBe(1);
  });
});

describe("the app middleware (M1)", () => {
  it("makes no D1 query for a signed-out request before go-live, and reads the flag once the date has come", async () => {
    await flag(true);
    const before = countD1Queries(withDate(""));
    expect((await createApp().request(getReq("/api/health"), undefined, before.env)).status).toBe(200);
    expect(before.queries()).toBe(0);
    const after = countD1Queries(withDate(PAST));
    expect((await createApp().request(getReq("/api/health"), undefined, after.env)).status).toBe(200);
    expect(after.queries()).toBe(1);
  });
});
