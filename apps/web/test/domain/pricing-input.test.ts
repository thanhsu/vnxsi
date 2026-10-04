import { describe, expect, it } from "vitest";
import { centsToInput, parseTiers, parseUsdCents, tierValuesFromBody, tierValuesFromTiers } from "../../src/domain/pricing-input.ts";

describe("pricing input", () => {
  it.each([
    ["49", 4900],
    ["49.5", 4950],
    ["49.99", 4999],
    [" 0 ", 0],
    ["100000", 10_000_000],
  ])("parseUsdCents(%j) = %j", (raw, cents) => {
    expect(parseUsdCents(raw)).toBe(cents);
  });

  it.each(["", "-1", "1.999", "100000.01", "1e3", "abc", "1,000"])("parseUsdCents(%j) is null", (raw) => {
    expect(parseUsdCents(raw)).toBeNull();
  });

  it("formats cents back for the form", () => {
    expect(centsToInput(4900)).toBe("49");
    expect(centsToInput(4950)).toBe("49.50");
    expect(centsToInput(null)).toBe("");
  });

  it("drops blank rows and keeps order", () => {
    const values = tierValuesFromBody({
      "tiers[0].name": "Starter",
      "tiers[0].billing": "monthly",
      "tiers[0].price": "19",
      "tiers[0].description": "One location\r\n",
      "tiers[2].name": "Enterprise",
      "tiers[2].billing": "contact",
      "tiers[2].price": "",
    });
    expect(parseTiers(values)).toEqual({
      ok: true,
      tiers: [
        { name: "Starter", billing: "monthly", priceCents: 1900, description: "One location" },
        { name: "Enterprise", billing: "contact", priceCents: null, description: "" },
      ],
    });
  });

  it("reports errors per row", () => {
    const values = tierValuesFromBody({
      "tiers[0].name": "",
      "tiers[0].price": "10",
      "tiers[1].name": "Pro",
      "tiers[1].billing": "weekly",
      "tiers[1].price": "x",
      "tiers[2].name": "Ask",
      "tiers[2].billing": "contact",
      "tiers[2].price": "5",
      "tiers[3].name": "n".repeat(41),
      "tiers[3].billing": "one_time",
      "tiers[3].price": "1",
      "tiers[3].description": "d".repeat(301),
    });
    expect(parseTiers(values)).toEqual({
      ok: false,
      errors: { 0: { name: "required" }, 1: { billing: "choice", price: "price" }, 2: { price: "contact" }, 3: { name: "too_long", description: "too_long" } },
    });
  });

  it("round-trips stored tiers", () => {
    const stored = [
      { id: "a", productId: "p", name: "Starter", billing: "one_time" as const, priceCents: 4950, description: "x", sort: 1 },
      { id: "b", productId: "p", name: "Ask", billing: "contact" as const, priceCents: null, description: "", sort: 2 },
    ];
    expect(parseTiers(tierValuesFromTiers(stored))).toEqual({
      ok: true,
      tiers: [
        { name: "Starter", billing: "one_time", priceCents: 4950, description: "x" },
        { name: "Ask", billing: "contact", priceCents: null, description: "" },
      ],
    });
  });
});
