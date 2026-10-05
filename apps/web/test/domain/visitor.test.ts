import { describe, expect, it } from "vitest";
import { VISITOR_COOKIE, VISITOR_ID_RE, hasGpc, newVisitorId, usableSalt, parseVisitorCookie, shouldCount, visitorCookieMaxAge, visitorHash } from "../../src/domain/visitor.ts";

const ID = "0123456789abcdef0123456789abcdef";
const ID2 = "fedcba9876543210fedcba9876543210";
const SALT = "test-salt-not-a-secret-0000000000";

describe("cookie name and Max-Age (Owner (b): expires at the end of the UTC day)", () => {
  it("names the cookie with the __Host- prefix", () => {
    expect(VISITOR_COOKIE).toBe("__Host-vnx_vid");
  });

  it.each([
    ["2026-10-05T00:00:00.000Z", 86_400],
    ["2026-10-05T00:00:00.001Z", 86_400],
    ["2026-10-05T12:00:00.000Z", 43_200],
    ["2026-10-05T23:00:00.000Z", 3_600],
    ["2026-10-05T23:58:00.000Z", 120],
    ["2026-10-05T23:58:59.500Z", 61],
    ["2026-10-05T23:59:00.000Z", 60],
    ["2026-10-05T23:59:30.000Z", 30],
    ["2026-10-05T23:59:59.999Z", 1],
    ["2026-12-31T23:59:59.999Z", 1],
    ["2026-12-31T12:00:00.000Z", 43_200],
    ["2028-02-28T18:00:00.000Z", 21_600],
  ])("at %s the Max-Age is %i seconds", (iso, expected) => {
    expect(visitorCookieMaxAge(new Date(iso))).toBe(expected);
  });

  it("is always between 1 second and one day (no floor: the cookie ends with the UTC day)", () => {
    for (let s = 0; s < 86_400; s += 997) {
      const age = visitorCookieMaxAge(new Date(Date.UTC(2026, 9, 5, 0, 0, 0) + s * 1000));
      expect(age).toBeGreaterThanOrEqual(1);
      expect(age).toBeLessThanOrEqual(86_400);
    }
  });
  // The Date is read with getUTC* only, so the machine time zone cannot change the result.
});

describe("parseVisitorCookie", () => {
  it("accepts exactly 32 lower-case hex characters", () => {
    expect(parseVisitorCookie(ID)).toBe(ID);
    expect(parseVisitorCookie("0".repeat(32))).toBe("0".repeat(32));
    expect(parseVisitorCookie("f".repeat(32))).toBe("f".repeat(32));
  });

  it.each([
    [undefined], [null], [""], [" "], [ID.toUpperCase()], [`${ID}0`], [ID.slice(1)], [` ${ID}`], [`${ID} `], [`${ID}\n`], [`${ID.slice(0, 31)}g`], [`${ID.slice(0, 31)}-`],
    ["a=b"], ["../../etc/passwd"], ["0x" + "a".repeat(30)], ["é".repeat(32)], ["'; DROP TABLE x;--"],
  ] as (string | null | undefined)[][])("rejects %j", (value) => {
    expect(parseVisitorCookie(value as string | null | undefined)).toBeNull();
  });
});

describe("newVisitorId", () => {
  it("always matches the cookie format and does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newVisitorId();
      expect(id).toMatch(VISITOR_ID_RE);
      expect(parseVisitorCookie(id)).toBe(id);
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });
});

describe("hasGpc (Sec-GPC: 1 is the opt-out)", () => {
  const h = (value?: string) => new Headers(value === undefined ? {} : { "Sec-GPC": value });
  it("is true only for the value 1", () => {
    expect(hasGpc(h("1"))).toBe(true);
    expect(hasGpc(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(hasGpc(new Headers([["SEC-GPC", " 1 "]]))).toBe(true);
    // Several Sec-GPC headers are folded into one comma-separated value: any member equal to 1 counts.
    expect(hasGpc(new Headers({ "Sec-GPC": "1, 1" }))).toBe(true);
    expect(hasGpc(new Headers({ "Sec-GPC": "0, 1" }))).toBe(true);
  });
  it.each([["0"], ["true"], ["yes"], ["11"], ["on"], [""]])("is false for %j", (value) => {
    expect(hasGpc(h(value))).toBe(false);
  });
  it("is false when the header is absent or only a lookalike is sent", () => {
    expect(hasGpc(h())).toBe(false);
    expect(hasGpc(new Headers({ DNT: "1" }))).toBe(false);
    expect(hasGpc(new Headers({ "Sec-GPC-Extra": "1" }))).toBe(false);
  });
});

describe("visitorHash (addendum 2.2: dayKey = HMAC(salt, day), hash = HMAC(dayKey, visitor id))", () => {
  it("is deterministic within a day: 64 hex characters", async () => {
    const a = await visitorHash(SALT, "2026-10-05", ID);
    const b = await visitorHash(SALT, "2026-10-05", ID);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toBe(a);
  });

  it("changes every day, so one cookie cannot be followed across days", async () => {
    const d1 = await visitorHash(SALT, "2026-10-05", ID);
    const d2 = await visitorHash(SALT, "2026-10-06", ID);
    const d3 = await visitorHash(SALT, "2026-11-05", ID);
    expect(new Set([d1, d2, d3]).size).toBe(3);
    // No shared prefix or suffix between days that would let two hashes be matched by eye or by LIKE.
    expect(d1!.slice(0, 8)).not.toBe(d2!.slice(0, 8));
    expect(d1!.slice(-8)).not.toBe(d2!.slice(-8));
  });

  it("differs per visitor and per salt", async () => {
    const base = await visitorHash(SALT, "2026-10-05", ID);
    expect(await visitorHash(SALT, "2026-10-05", ID2)).not.toBe(base);
    expect(await visitorHash(`${SALT}x`, "2026-10-05", ID)).not.toBe(base);
  });

  it("equals an independent HMAC-SHA256 chain (key chain order matters)", async () => {
    const enc = new TextEncoder();
    const hmac = async (key: ArrayBuffer | Uint8Array, msg: string) =>
      crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(msg));
    const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const dayKey = await hmac(enc.encode(SALT), "vnx.si/visitor/v1|2026-10-05");
    expect(await visitorHash(SALT, "2026-10-05", ID)).toBe(hex(await hmac(dayKey, ID)));
    // Swapped roles must not give the same value.
    const swapped = await hmac(enc.encode(ID), "vnx.si/visitor/v1|2026-10-05");
    expect(await visitorHash(SALT, "2026-10-05", ID)).not.toBe(hex(swapped));
  });

  it("returns null without a usable salt (the caller then skips counting)", async () => {
    for (const salt of [undefined, "", "   "]) expect(await visitorHash(salt, "2026-10-05", ID)).toBeNull();
  });

  it("returns null for an id that is not a valid cookie value", async () => {
    for (const bad of ["", ID.toUpperCase(), "short", `${ID}0`]) expect(await visitorHash(SALT, "2026-10-05", bad)).toBeNull();
  });

  it("throws on a day that is not YYYY-MM-DD (a programming error, callers use utcDay)", async () => {
    await expect(visitorHash(SALT, "2026-10-05T00:00:00Z", ID)).rejects.toThrow();
    await expect(visitorHash(SALT, "", ID)).rejects.toThrow();
  });
});

describe("usableSalt", () => {
  it("returns a real salt and null for unset, empty or blank, so a blank salt never lets shouldCount be true", () => {
    expect(usableSalt(SALT)).toBe(SALT);
    for (const salt of [undefined, "", " ", "\t\n"]) expect(usableSalt(salt)).toBeNull();
  });
});

describe("shouldCount (Global Constraints: not counted when …)", () => {
  const ok = { isBot: false, isStaff: false, isOwnBuilder: false, isGpc: false, hasSalt: true };

  it("counts an ordinary visitor with a salt", () => {
    expect(shouldCount(ok)).toBe(true);
  });

  it.each([["isBot"], ["isStaff"], ["isOwnBuilder"], ["isGpc"]] as const)("does not count when %s", (flag) => {
    expect(shouldCount({ ...ok, [flag]: true })).toBe(false);
  });

  it("does not count without a salt", () => {
    expect(shouldCount({ ...ok, hasSalt: false })).toBe(false);
  });

  it("truth table: exactly one of the 32 combinations counts", () => {
    let counted = 0;
    for (let n = 0; n < 32; n++) {
      const ctx = { isBot: !!(n & 1), isStaff: !!(n & 2), isOwnBuilder: !!(n & 4), isGpc: !!(n & 8), hasSalt: !!(n & 16) };
      const result = shouldCount(ctx);
      if (result) {
        counted++;
        expect(ctx).toEqual(ok);
      }
    }
    expect(counted).toBe(1);
  });
});
