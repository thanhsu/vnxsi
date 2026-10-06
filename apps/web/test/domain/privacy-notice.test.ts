import { describe, expect, it } from "vitest";
import { formatPrivacyNoticeDate, parsePrivacyNoticeDate, shouldShowPrivacyNotice } from "../../src/domain/privacy-notice.ts";

const LIVE = "2026-10-20";
const at = (iso: string) => new Date(iso);

describe("parsePrivacyNoticeDate", () => {
  it.each([undefined, "", "2026-10-20T00:00:00Z", "2026-02-29", "2026-04-31", "20-10-2026"])("rejects %j", (raw) => {
    expect(parsePrivacyNoticeDate(raw)).toBeNull();
  });
  it("round-trips a valid ISO calendar date at UTC midnight", () => {
    expect(parsePrivacyNoticeDate(LIVE)?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});

describe("shouldShowPrivacyNotice", () => {
  it.each([
    ["before start", "2026-10-05T23:59:59.999Z", false],
    ["start inclusive", "2026-10-06T00:00:00.000Z", true],
    ["go-live midnight", "2026-10-20T00:00:00.000Z", true],
    ["last visible instant", "2026-11-19T23:59:59.999Z", true],
    ["after end", "2026-11-20T00:00:00.000Z", false],
  ] as const)("%s", (_label, iso, expected) => expect(shouldShowPrivacyNotice(LIVE, at(iso))).toBe(expected));
  it("hides unset, malformed and invalid now", () => {
    expect(shouldShowPrivacyNotice(undefined, at("2026-10-20T00:00:00Z"))).toBe(false);
    expect(shouldShowPrivacyNotice("2026-02-30", at("2026-10-20T00:00:00Z"))).toBe(false);
    expect(shouldShowPrivacyNotice(LIVE, new Date(Number.NaN))).toBe(false);
  });
});

describe("formatPrivacyNoticeDate", () => {
  it("pins EN exactly", () => expect(formatPrivacyNoticeDate(LIVE, "en")).toBe("October 20, 2026"));
  it.each(["vi", "zh-Hans", "zh-Hant"] as const)("%s keeps the UTC day and is not the raw ISO string", (locale) => {
    const out = formatPrivacyNoticeDate(LIVE, locale) ?? "";
    expect(out).toContain("2026");
    expect(out).toContain("20");
    expect(out).not.toBe(LIVE);
  });
  it("is null for a malformed date", () => expect(formatPrivacyNoticeDate("2026-02-30", "en")).toBeNull());
});
