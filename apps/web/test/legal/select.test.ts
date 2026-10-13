import { describe, expect, it } from "vitest";
import { BOARD_LEGAL, LEGAL_UPDATED_AT, PRIVACY_M7, type LegalDoc } from "../../src/legal/content.ts";
import { selectLegal } from "../../src/legal/select.ts";

const M7 = "2026-10-21";
const BOARD = "2026-11-10";
const at = (iso: string) => new Date(iso);
const fakeDoc = (title: string): { en: LegalDoc; vi: LegalDoc } => ({ en: { title, sections: [] }, vi: { title, sections: [] } });
const REGISTERED = { privacy: fakeDoc("PB"), terms: fakeDoc("TB") };

const EMPTY = { privacy: null, terms: null };

describe("selectLegal with no board text registered (VNX-2707a: the framework never serves what is not there)", () => {
  it("BOARD_LEGAL carries the approved texts since VNX-2707b (so the shipped app serves them, not the fallback)", () => {
    expect(BOARD_LEGAL.privacy).not.toBeNull();
    expect(BOARD_LEGAL.terms).not.toBeNull();
    expect(selectLegal("privacy", { m7: M7, board: BOARD }, at("2027-01-01T00:00:00Z")).docs).toBe(BOARD_LEGAL.privacy);
    expect(selectLegal("terms", { m7: M7, board: BOARD }, at("2027-01-01T00:00:00Z")).docs).toBe(BOARD_LEGAL.terms);
  });

  it("Privacy past the board date serves m7 with the M7 date; Terms keep the page text and LEGAL_UPDATED_AT", () => {
    const now = at("2027-01-01T00:00:00Z");
    expect(selectLegal("privacy", { m7: M7, board: BOARD }, now, EMPTY)).toEqual({ docs: PRIVACY_M7, updatedAt: M7 });
    expect(selectLegal("terms", { m7: M7, board: BOARD }, now, EMPTY)).toEqual({ docs: undefined, updatedAt: undefined });
  });

  it("Privacy with the board date set but no M7 date serves the current text", () => {
    expect(selectLegal("privacy", { m7: "", board: BOARD }, at("2027-01-01T00:00:00Z"), EMPTY)).toEqual({ docs: undefined, updatedAt: undefined });
  });

  it("the other pages are never touched", () => {
    for (const id of ["mediaKit", "disclosure"] as const) expect(selectLegal(id, { m7: M7, board: BOARD }, at("2027-01-01T00:00:00Z"), EMPTY)).toEqual({ docs: undefined, updatedAt: undefined });
  });
});

describe("selectLegal once the board text is registered (what VNX-2707b turns on)", () => {
  it("Privacy: current, m7, then the board text from board - 14 days with the board date; never back", () => {
    const pick = (iso: string) => selectLegal("privacy", { m7: M7, board: BOARD }, at(iso), REGISTERED);
    expect(pick("2026-10-06T23:59:59.999Z")).toEqual({ docs: undefined, updatedAt: undefined });
    expect(pick("2026-10-07T00:00:00Z")).toEqual({ docs: PRIVACY_M7, updatedAt: M7 });
    expect(pick("2026-10-26T23:59:59.999Z")).toEqual({ docs: PRIVACY_M7, updatedAt: M7 });
    expect(pick("2026-10-27T00:00:00Z")).toEqual({ docs: REGISTERED.privacy, updatedAt: BOARD });
    expect(pick("2030-01-01T00:00:00Z")).toEqual({ docs: REGISTERED.privacy, updatedAt: BOARD });
  });

  it("Terms: the page text until board - 14 days, then the board text dated with the board date", () => {
    expect(selectLegal("terms", { board: BOARD }, at("2026-10-26T23:59:59.999Z"), REGISTERED)).toEqual({ docs: undefined, updatedAt: undefined });
    expect(selectLegal("terms", { board: BOARD }, at("2026-10-27T00:00:00Z"), REGISTERED)).toEqual({ docs: REGISTERED.terms, updatedAt: BOARD });
  });

  it("an empty or malformed board date selects no board text", () => {
    for (const bad of ["", undefined, "2026-02-30"]) {
      expect(selectLegal("terms", { board: bad }, at("2030-01-01T00:00:00Z"), REGISTERED).docs).toBeUndefined();
      expect(selectLegal("privacy", { m7: M7, board: bad }, at("2030-01-01T00:00:00Z"), REGISTERED).docs).toBe(PRIVACY_M7);
    }
  });
});
