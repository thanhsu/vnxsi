import { describe, expect, it } from "vitest";
import { privacyVersion } from "../../src/domain/privacy-notice.ts";
import { privacyVersionOf, termsVersionOf } from "../../src/domain/legal-versions.ts";

const M7 = "2026-10-21"; // M7 notice window starts 2026-10-07
const BOARD = "2026-11-10"; // board notice window starts 2026-10-27
const at = (iso: string) => new Date(iso);

describe("privacyVersionOf (EPIC 27: current -> m7 -> board, dated, never back)", () => {
  it.each([
    ["before the M7 window", "2026-10-06T23:59:59.999Z", "current"],
    ["M7 window start, inclusive", "2026-10-07T00:00:00.000Z", "m7"],
    ["one ms before board - 14 days", "2026-10-26T23:59:59.999Z", "m7"],
    ["exactly board - 14 days", "2026-10-27T00:00:00.000Z", "board"],
    ["board go-live", "2026-11-10T00:00:00.000Z", "board"],
    ["long after both windows", "2027-06-01T00:00:00.000Z", "board"],
  ] as const)("%s", (_label, iso, expected) => expect(privacyVersionOf({ m7: M7, board: BOARD }, at(iso))).toBe(expected));

  it("the board outranks m7 when both are due", () => {
    expect(privacyVersionOf({ m7: "2026-10-21", board: "2026-10-21" }, at("2026-10-07T00:00:00Z"))).toBe("board");
  });

  it.each([undefined, "", "2026-02-30", "soon", "2026-11-10T00:00:00Z"])("an unset or malformed board (%j) behaves as if there were no board", (bad) => {
    for (const iso of ["2026-10-06T00:00:00Z", "2026-10-20T00:00:00Z", "2030-01-01T00:00:00Z"]) {
      expect(privacyVersionOf({ m7: M7, board: bad }, at(iso))).toBe(privacyVersion(M7, at(iso)));
    }
  });

  it("a board date with an empty m7 never throws and never reaches m7", () => {
    expect(privacyVersionOf({ m7: "", board: BOARD }, at("2026-10-20T00:00:00Z"))).toBe("current");
    expect(privacyVersionOf({ m7: undefined, board: BOARD }, at("2026-10-27T00:00:00Z"))).toBe("board");
  });

  it("with no board it equals the legacy privacyVersion for every input", () => {
    for (const goLive of [undefined, "", "2026-02-30", M7]) {
      for (const iso of ["2026-10-06T23:59:59.999Z", "2026-10-07T00:00:00.000Z", "2027-01-01T00:00:00Z"]) {
        expect(privacyVersionOf({ m7: goLive }, at(iso))).toBe(privacyVersion(goLive, at(iso)));
      }
    }
  });

  it("never goes back: once at a version, every later instant is at least that version", () => {
    const rank = { current: 0, m7: 1, board: 2 } as const;
    let prev = 0;
    for (let day = 0; day < 400; day += 1) {
      const now = new Date(Date.UTC(2026, 8, 1) + day * 86_400_000);
      const r = rank[privacyVersionOf({ m7: M7, board: BOARD }, now)];
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(prev).toBe(2);
  });

  it("an invalid now is current", () => {
    expect(privacyVersionOf({ m7: M7, board: BOARD }, new Date(Number.NaN))).toBe("current");
  });
});

describe("termsVersionOf", () => {
  it.each([
    ["before board - 14 days", "2026-10-26T23:59:59.999Z", "current"],
    ["exactly board - 14 days", "2026-10-27T00:00:00.000Z", "board"],
    ["long after", "2027-06-01T00:00:00Z", "board"],
  ] as const)("%s", (_label, iso, expected) => expect(termsVersionOf(BOARD, at(iso))).toBe(expected));

  it.each([undefined, "", "2026-02-30", "soon"])("unset or malformed (%j) is current for ever", (bad) => {
    expect(termsVersionOf(bad, at("2030-01-01T00:00:00Z"))).toBe("current");
  });
  it("an invalid now is current", () => expect(termsVersionOf(BOARD, new Date(Number.NaN))).toBe("current"));
});
