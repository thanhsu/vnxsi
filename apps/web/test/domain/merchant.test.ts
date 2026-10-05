import { describe, expect, it } from "vitest";
import {
  MERCHANT_DESCRIPTION_MAX,
  MERCHANT_NAME_MAX,
  MERCHANT_STATUSES,
  merchantSlugError,
  parseAllowedHosts,
  parseMerchantForm,
  RESERVED_MERCHANT_SLUGS,
  type MerchantFormValues,
} from "../../src/domain/merchant.ts";
import { MAX_ALLOWED_HOSTS } from "../../src/domain/offer-url.ts";
import { SLUG_RE } from "../../src/domain/slug.ts";

describe("merchant slug (same rule as a product slug, plus reserved words)", () => {
  it("reserves p and o for /go/p/… and /go/o/…", () => {
    expect([...RESERVED_MERCHANT_SLUGS].sort()).toEqual(["o", "p"]);
    expect(merchantSlugError("p")).toBe("reserved");
    expect(merchantSlugError("o")).toBe("reserved");
  });

  it("accepts and rejects exactly what SLUG_RE accepts and rejects", () => {
    for (const slug of ["elevenlabs", "eleven-labs", "abc", "a1b", "x".repeat(60)]) {
      expect(SLUG_RE.test(slug)).toBe(true);
      expect(merchantSlugError(slug), slug).toBeNull();
    }
    for (const slug of ["", "ab", "-abc", "abc-", "a_b", "a b", "ABC", "x".repeat(61), "ab/c"]) {
      expect(SLUG_RE.test(slug)).toBe(false);
      expect(merchantSlugError(slug), slug).toBe("format");
    }
  });

  it("has the three statuses", () => {
    expect([...MERCHANT_STATUSES]).toEqual(["active", "paused", "archived"]);
  });
});

describe("allowed_hosts", () => {
  it("accepts a comma or line separated list and lower-cases it", () => {
    expect(parseAllowedHosts("try.elevenlabs.io, elevenlabs.io")).toEqual({ ok: true, hosts: ["try.elevenlabs.io", "elevenlabs.io"] });
    expect(parseAllowedHosts("A.Example.COM\r\nb.example.com\n")).toEqual({ ok: true, hosts: ["a.example.com", "b.example.com"] });
  });

  it("rejects an empty list", () => {
    for (const raw of ["", "  ", ",\n,"]) expect(parseAllowedHosts(raw), JSON.stringify(raw)).toEqual({ ok: false, error: "empty" });
  });

  it("rejects scheme, path, port, wildcard, IP, single label, localhost, trailing dot, non-ASCII", () => {
    for (const raw of ["https://elevenlabs.io", "elevenlabs.io/x", "elevenlabs.io:443", "*.elevenlabs.io", "127.0.0.1", "0x7f.1", "elevenlabs", "localhost", "a.localhost", "elevenlabs.io.", "elevenlabs。io", "élevenlabs.io", "a_b.io"]) {
      expect(parseAllowedHosts(raw), raw).toEqual({ ok: false, error: "format" });
    }
  });

  it("rejects a duplicate and more than 20 entries", () => {
    expect(parseAllowedHosts("a.io, A.io")).toEqual({ ok: false, error: "duplicate" });
    const ok = Array.from({ length: MAX_ALLOWED_HOSTS }, (_, i) => `h${i}.example.com`);
    expect(parseAllowedHosts(ok.join(",")).ok).toBe(true);
    expect(parseAllowedHosts([...ok, "extra.example.com"].join(","))).toEqual({ ok: false, error: "too_many" });
  });
});

const values = (o: Partial<MerchantFormValues> = {}): MerchantFormValues => ({
  name: "ElevenLabs",
  slug: "elevenlabs",
  websiteUrl: "https://elevenlabs.io",
  allowedHosts: "try.elevenlabs.io, elevenlabs.io",
  description: "Voice AI.\r\n\r\n- Text to speech",
  indexable: false,
  ...o,
});

describe("parseMerchantForm", () => {
  it("accepts the first partner and normalises", () => {
    expect(parseMerchantForm(values({ slug: "  ElevenLabs " }))).toEqual({
      ok: true,
      merchant: {
        name: "ElevenLabs",
        slug: "elevenlabs",
        websiteUrl: "https://elevenlabs.io/",
        allowedHosts: ["try.elevenlabs.io", "elevenlabs.io"],
        description: "Voice AI.\n\n- Text to speech",
        indexable: false,
      },
    });
  });

  it("rejects the reserved slugs p and o, and a bad slug", () => {
    expect(parseMerchantForm(values({ slug: "p" }))).toEqual({ ok: false, errors: { slug: "reserved" } });
    expect(parseMerchantForm(values({ slug: " O " }))).toEqual({ ok: false, errors: { slug: "reserved" } });
    expect(parseMerchantForm(values({ slug: "a_b" }))).toEqual({ ok: false, errors: { slug: "format" } });
  });

  it("requires a name of at most 80 characters and a description of at most 2000", () => {
    expect(parseMerchantForm(values({ name: "  " }))).toEqual({ ok: false, errors: { name: "required" } });
    expect(parseMerchantForm(values({ name: "x".repeat(MERCHANT_NAME_MAX + 1) }))).toEqual({ ok: false, errors: { name: "too_long" } });
    expect(parseMerchantForm(values({ description: "x".repeat(MERCHANT_DESCRIPTION_MAX + 1) }))).toEqual({ ok: false, errors: { description: "too_long" } });
    expect(parseMerchantForm(values({ description: "x".repeat(MERCHANT_DESCRIPTION_MAX) })).ok).toBe(true);
  });

  it("checks website_url with every URL rule against the merchant's own allowed_hosts", () => {
    expect(parseMerchantForm(values({ websiteUrl: "" }))).toEqual({ ok: false, errors: { websiteUrl: "required" } });
    expect(parseMerchantForm(values({ websiteUrl: "http://elevenlabs.io" }))).toEqual({ ok: false, errors: { websiteUrl: "url_scheme" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://evil.com" }))).toEqual({ ok: false, errors: { websiteUrl: "url_not_allowed" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://elevenlabs.io@evil.com" }))).toEqual({ ok: false, errors: { websiteUrl: "url_authority" } });
    expect(parseMerchantForm(values({ websiteUrl: "https://127.0.0.1" }))).toEqual({ ok: false, errors: { websiteUrl: "url_host" } });
  });

  it("reports allowed_hosts errors and skips the website_url check then", () => {
    expect(parseMerchantForm(values({ allowedHosts: "https://elevenlabs.io" }))).toEqual({ ok: false, errors: { allowedHosts: "format" } });
    expect(parseMerchantForm(values({ allowedHosts: "" }))).toEqual({ ok: false, errors: { allowedHosts: "empty" } });
  });

  it("keeps indexable as given", () => {
    const r = parseMerchantForm(values({ indexable: true }));
    expect(r.ok && r.merchant.indexable).toBe(true);
  });
});
