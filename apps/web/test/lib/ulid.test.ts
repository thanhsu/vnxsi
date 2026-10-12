import { describe, expect, it } from "vitest";
import { publicId, ulid } from "../../src/lib/ulid.ts";

const zeros = (n: number) => new Uint8Array(n);

describe("ulid", () => {
  it("is 26 Crockford base32 characters", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("sorts by time", () => {
    expect(ulid(1_000, zeros) < ulid(2_000, zeros)).toBe(true);
    expect(ulid(1_700_000_000_000, zeros).slice(0, 10)).toBe("01HF7YAT00");
  });

  it("differs between calls in the same millisecond", () => {
    expect(ulid(5)).not.toBe(ulid(5));
  });
});

describe("publicId", () => {
  it("has the ULID shape and alphabet but no time component (S-3)", () => {
    const now = 1_700_000_000_000;
    const timePrefix = ulid(now).slice(0, 10);
    const ids = Array.from({ length: 200 }, () => publicId());
    for (const id of ids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Set(ids).size).toBe(200);
    // Nothing sorts by time: the first ten characters are not a timestamp, so they are not the same across calls.
    expect(new Set(ids.map((i) => i.slice(0, 10))).size).toBeGreaterThan(190);
    expect(ids.some((i) => i.startsWith(timePrefix))).toBe(false);
  });

  it("uses all 26 characters from the random source", () => {
    expect(publicId((n) => new Uint8Array(n).fill(33))).toBe("1".repeat(26));
  });
});
