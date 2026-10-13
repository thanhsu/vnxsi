import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { BOARD_LEGAL, LEGAL_UPDATED_AT, PRIVACY_M7, type LegalDoc } from "../../src/legal/content.ts";
import { selectLegal } from "../../src/legal/select.ts";
import { testEnv } from "../helpers.ts";

const M7 = "2026-10-21";
const BOARD = "2026-11-10";
const at = (iso: string) => new Date(iso);
const fakeDoc = (title: string): { en: LegalDoc; vi: LegalDoc } => ({ en: { title, sections: [] }, vi: { title, sections: [] } });
const REGISTERED = { privacy: fakeDoc("PB"), terms: fakeDoc("TB") };

describe("selectLegal with no board text registered (VNX-2707a: the framework never serves what is not there)", () => {
  it("BOARD_LEGAL is empty until VNX-2707b", () => {
    expect(BOARD_LEGAL).toEqual({ privacy: null, terms: null });
  });

  it("Privacy past the board date serves m7 with the M7 date; Terms keep the page text and LEGAL_UPDATED_AT", () => {
    const now = at("2027-01-01T00:00:00Z");
    expect(selectLegal("privacy", { m7: M7, board: BOARD }, now)).toEqual({ docs: PRIVACY_M7, updatedAt: M7 });
    expect(selectLegal("terms", { m7: M7, board: BOARD }, now)).toEqual({ docs: undefined, updatedAt: undefined });
  });

  it("Privacy with the board date set but no M7 date serves the current text", () => {
    expect(selectLegal("privacy", { m7: "", board: BOARD }, at("2027-01-01T00:00:00Z"))).toEqual({ docs: undefined, updatedAt: undefined });
  });

  it("the other pages are never touched", () => {
    for (const id of ["mediaKit", "disclosure"] as const) expect(selectLegal(id, { m7: M7, board: BOARD }, at("2027-01-01T00:00:00Z"))).toEqual({ docs: undefined, updatedAt: undefined });
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

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = async (path: string, env: Bindings) =>
  decode(/<main[^>]*>([\s\S]*)<\/main>/.exec(await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, env)).text())?.[1] ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
afterEach(() => vi.useRealTimers());

describe("/privacy and /terms with REQUEST_BOARD_GO_LIVE set, before the board text exists", { timeout: 30_000 }, () => {
  const env = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: M7, REQUEST_BOARD_GO_LIVE: BOARD } as Bindings;
  it("never serve board wording, an empty page or a board date; Privacy stays m7, Terms stay current", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    for (const path of ["/privacy", "/vi/privacy", "/zh-hans/privacy", "/terms", "/vi/terms", "/zh-hant/terms"]) {
      const out = await text(path, env);
      expect(out.length, path).toBeGreaterThan(2000);
      expect(out, path).not.toMatch(/public request board|bảng nhu cầu công khai|Public requests/i);
      expect(out, path).not.toContain(BOARD);
    }
    expect(await text("/privacy", env)).toContain(`Last updated: ${M7}`);
    expect(await text("/terms", env)).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
  });
});
