import { describe, expect, it } from "vitest";
import { validatePublicUrl } from "../../src/domain/product-url.ts";
import { parseProductName, parseStep, stepValuesFromBody, stepValuesFromProduct, STEP_FIELDS, TEXT_STEPS } from "../../src/domain/product-input.ts";
import type { Product } from "../../src/domain/product.ts";

describe("product step input", () => {
  it("parses the product step and normalizes values", () => {
    const r = parseStep("product", {
      name: "  Spa Booking ",
      slug: " Spa-Booking ",
      tagline: "Bookings for spas",
      category: "booking",
      deliveryModel: "saas",
      primaryLang: "vi",
      tags: "spa, booking, Spa",
      description: "Line one\r\n\r\n- point",
    });
    expect(r).toEqual({
      ok: true,
      fields: {
        name: "Spa Booking",
        slug: "spa-booking",
        tagline: "Bookings for spas",
        category: "booking",
        deliveryModel: "saas",
        primaryLang: "vi",
        tags: ["spa", "booking"],
        description: "Line one\n\n- point",
      },
    });
  });

  it("allows empty optional fields in a draft but not an empty name", () => {
    expect(parseStep("product", { name: "", slug: "abc", tagline: "", category: "", deliveryModel: "", primaryLang: "en", tags: "", description: "" })).toEqual({
      ok: false,
      errors: { name: "required" },
    });
    expect(parseStep("product", { name: "X", slug: "abc", tagline: "", category: "", deliveryModel: "", primaryLang: "en", tags: "", description: "" })).toMatchObject({
      ok: true,
      fields: { category: null, deliveryModel: null, tags: [] },
    });
  });

  it("reports one code per bad field", () => {
    expect(
      parseStep("product", { name: "x".repeat(81), slug: "Bad Slug", tagline: "t".repeat(121), category: "games", deliveryModel: "boxed", primaryLang: "fr", tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(","), description: "" }),
    ).toEqual({
      ok: false,
      errors: { name: "too_long", slug: "slug", tagline: "too_long", category: "choice", deliveryModel: "choice", primaryLang: "choice", tags: "list" },
    });
  });

  it("splits features by line and tech stack by comma", () => {
    expect(parseStep("features", { features: "Calendar\r\n\r\n  Reminders  \nPayments", techStack: "Next.js, Supabase" })).toEqual({
      ok: true,
      fields: { features: ["Calendar", "Reminders", "Payments"], techStack: ["Next.js", "Supabase"] },
    });
    expect(parseStep("features", { features: Array.from({ length: 21 }, (_, i) => `f${i}`).join("\n"), techStack: "" })).toEqual({ ok: false, errors: { features: "list" } });
    expect(parseStep("features", { features: "x".repeat(121), techStack: "" })).toEqual({ ok: false, errors: { features: "list" } });
  });

  it("accepts only https URLs and empty values", () => {
    expect(parseStep("demo", { demoUrl: "", websiteUrl: "https://spa.example" })).toEqual({ ok: true, fields: { demoUrl: null, websiteUrl: "https://spa.example" } });
    expect(parseStep("demo", { demoUrl: "http://spa.example", websiteUrl: "javascript:alert(1)" })).toEqual({ ok: false, errors: { demoUrl: "url", websiteUrl: "url" } });
  });

  it("reads checkboxes from the body", () => {
    expect(stepValuesFromBody("customization", { customizable: "on", customizationNotes: "a\r\nb" })).toEqual({ customizable: "on", customizationNotes: "a\nb" });
    expect(parseStep("customization", stepValuesFromBody("customization", { customizationNotes: "" }))).toEqual({ ok: true, fields: { customizable: false, customizationNotes: "" } });
  });

  it("round-trips every text step through form values", () => {
    const product = {
      name: "Spa Booking",
      slug: "spa-booking",
      tagline: "Bookings",
      category: "booking",
      deliveryModel: "source",
      primaryLang: "zh-Hant",
      tags: ["spa"],
      description: "Desc",
      problem: "Problem",
      targetUsers: "Owners",
      features: ["A", "B"],
      techStack: ["Hono"],
      demoUrl: "https://demo.example",
      websiteUrl: null,
      customizable: true,
      customizationNotes: "Notes",
      license: "extended",
      supportPolicy: "Email",
    } as unknown as Product;
    for (const step of TEXT_STEPS) {
      const parsed = parseStep(step, stepValuesFromProduct(step, product));
      expect(parsed.ok, step).toBe(true);
      if (parsed.ok) for (const spec of STEP_FIELDS[step]) expect(parsed.fields[spec.name], `${step}.${spec.name}`).toEqual(product[spec.name as keyof Product]);
    }
  });

  it("validates a new product name", () => {
    expect(parseProductName("  Kit ")).toEqual({ ok: true, name: "Kit" });
    expect(parseProductName(" ")).toEqual({ ok: false, error: "required" });
    expect(parseProductName("x".repeat(81))).toEqual({ ok: false, error: "too_long" });
  });
});

describe("product URL fields (VNX-0707b)", () => {
  it("the demo step accepts only a public https URL, as the redirect does (M4)", () => {
    for (const bad of ["http://spa.example", "//evil.com", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://u@evil.com/", "https://spa.example:8443/", "https://spa.example/a\\b", "javascript:alert(1)", "https://intranet/"]) {
      expect(parseStep("demo", { demoUrl: bad, websiteUrl: "" }), bad).toEqual({ ok: false, errors: { demoUrl: "url" } });
      expect(parseStep("demo", { demoUrl: "", websiteUrl: bad }), bad).toEqual({ ok: false, errors: { websiteUrl: "url" } });
    }
  });
  it("keeps the trimmed text, not the normalized href (a re-save must not look like a change)", () => {
    expect(parseStep("demo", { demoUrl: "  https://spa.example  ", websiteUrl: "https://www.example.com/a?b=1" })).toEqual({ ok: true, fields: { demoUrl: "https://spa.example", websiteUrl: "https://www.example.com/a?b=1" } });
  });
  it("every URL the editor accepts the redirect accepts too", () => {
    for (const ok of ["https://spa.example", "https://spa.example/", "https://a.b.example/x?y=1#z", "https://spa.example:443/"]) {
      expect(parseStep("demo", { demoUrl: ok, websiteUrl: "" }).ok, ok).toBe(true);
      expect(validatePublicUrl(ok).ok, ok).toBe(true);
    }
  });
});
