import { describe, expect, it } from "vitest";
import { proposalPrice } from "../../src/views/proposal.ts";

describe("proposalPrice (spec §5.7 step 3)", () => {
  it("shows an amount, a range or 'to discuss'", () => {
    expect(proposalPrice("en", { priceCents: 450000, priceMaxCents: null })).toBe("$4,500");
    expect(proposalPrice("en", { priceCents: 300000, priceMaxCents: 500000 })).toBe("$3,000 – $5,000");
    expect(proposalPrice("en", { priceCents: null, priceMaxCents: null })).toBe("To discuss");
  });
});
