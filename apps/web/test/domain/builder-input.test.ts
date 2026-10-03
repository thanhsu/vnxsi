import { describe, expect, it } from "vitest";
import { formValuesFromBody, formValuesFromProfile, parseBuilderProfile } from "../../src/domain/builder-input.ts";
import { COUNTRY_CODES, isCountryCode } from "../../src/domain/countries.ts";
import { profileValues } from "../fixtures.ts";

const parse = (o: Parameters<typeof profileValues>[0] = {}) => parseBuilderProfile(profileValues(o));

describe("builder profile input", () => {
  it("normalizes a valid profile", () => {
    expect(parse({ handle: "  Lan-Dev ", skills: "Next.js, supabase , Next.js,,", websiteUrl: "", country: "vn", workLanguages: ["vi", "vi", "en"] })).toEqual({
      ok: true,
      profile: {
        handle: "lan-dev",
        name: "Lan Nguyen",
        kind: "individual",
        headline: "I build booking apps with AI",
        bio: "Ten years of web work.\n\n- Booking\n- CRM",
        country: "VN",
        websiteUrl: null,
        skills: ["Next.js", "supabase"],
        aiTools: ["Claude Code"],
        workLanguages: ["vi", "en"],
        availability: "open",
        hourlyRateCents: 4500,
      },
    });
  });

  it.each(["ab", "-lan", "lan-", "lan dev", "lân", "a".repeat(31), "lan_dev", "LAN!"])("rejects handle %j", (handle) => {
    expect(parse({ handle })).toEqual({ ok: false, errors: { handle: "invalid" } });
  });

  it.each(["admin", "hub", "api", "zh-hans"])("rejects reserved handle %s", (handle) => {
    expect(parse({ handle })).toEqual({ ok: false, errors: { handle: "reserved" } });
  });

  it("accepts only https website URLs", () => {
    for (const websiteUrl of ["http://lan.dev", "javascript:alert(1)", "lan.dev", "https://user:pw@lan.dev", "ftp://lan.dev"]) {
      expect(parse({ websiteUrl }), websiteUrl).toEqual({ ok: false, errors: { websiteUrl: "invalid" } });
    }
    expect(parse({ websiteUrl: "https://lan.dev/work" })).toMatchObject({ ok: true, profile: { websiteUrl: "https://lan.dev/work" } });
  });

  it("requires one skill and caps list sizes", () => {
    expect(parse({ skills: " , " })).toEqual({ ok: false, errors: { skills: "invalid" } });
    expect(parse({ skills: Array.from({ length: 16 }, (_, i) => `s${i}`).join(",") })).toEqual({ ok: false, errors: { skills: "invalid" } });
    expect(parse({ aiTools: "x".repeat(41) })).toEqual({ ok: false, errors: { aiTools: "invalid" } });
  });

  it("validates enums, country, rate and lengths together", () => {
    expect(
      parse({ kind: "agency", availability: "busy", country: "XX", hourlyRate: "0", name: "", headline: "h".repeat(121), bio: " ", workLanguages: ["fr"] }),
    ).toEqual({
      ok: false,
      errors: { kind: "invalid", availability: "invalid", country: "invalid", hourlyRate: "invalid", name: "invalid", headline: "invalid", bio: "invalid", workLanguages: "invalid" },
    });
    expect(parse({ hourlyRate: "10001" })).toEqual({ ok: false, errors: { hourlyRate: "invalid" } });
    expect(parse({ hourlyRate: "10000" })).toMatchObject({ ok: true, profile: { hourlyRateCents: 1_000_000 } });
    expect(parse({ hourlyRate: "" })).toMatchObject({ ok: true, profile: { hourlyRateCents: null } });
  });

  it("round-trips through form values", () => {
    const first = parse();
    if (!first.ok) throw new Error("fixture must be valid");
    expect(parseBuilderProfile(formValuesFromProfile(first.profile))).toEqual(first);
  });

  it("reads single checkboxes and missing fields from a form body", () => {
    expect(formValuesFromBody({ workLanguages: "vi" }).workLanguages).toEqual(["vi"]);
    expect(formValuesFromBody({})).toMatchObject({ handle: "", workLanguages: [], hourlyRate: "" });
  });

  it("counts and stores CRLF from a browser textarea as LF (2000 limit)", () => {
    // 1000 lines of one character: 1999 chars with LF, 2998 with CRLF.
    const bio = Array.from({ length: 1000 }, () => "a").join("\r\n");
    expect(bio.length).toBeGreaterThan(2000);
    const result = parseBuilderProfile(formValuesFromBody({ ...profileValues(), bio }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.bio).not.toContain("\r");
      expect(result.profile.bio.length).toBe(1999);
    }
  });

  it("knows the 249 ISO 3166-1 alpha-2 codes", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(isCountryCode("VN")).toBe(true);
    expect(isCountryCode("TW")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("vn")).toBe(false);
  });
});
