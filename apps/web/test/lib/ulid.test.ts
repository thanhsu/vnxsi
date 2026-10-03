import { describe, expect, it } from "vitest";
import { ulid } from "../../src/lib/ulid.ts";

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
