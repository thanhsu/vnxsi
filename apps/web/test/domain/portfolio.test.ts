import { describe, expect, it } from "vitest";
import { parsePortfolioItem, portfolioValuesFromBody } from "../../src/domain/portfolio.ts";

describe("portfolio input newlines", () => {
  it("counts and stores CRLF from a browser textarea as LF (500 limit)", () => {
    // 250 lines of one character: 499 chars with LF, 749 with CRLF.
    const description = Array.from({ length: 250 }, () => "a").join("\r\n");
    expect(description.length).toBeGreaterThan(500);
    const parsed = parsePortfolioItem(portfolioValuesFromBody({ title: "T", url: "", description }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.item.description).not.toContain("\r");
      expect(parsed.item.description.length).toBe(499);
    }
  });

  it("turns a lone CR into LF too", () => {
    expect(portfolioValuesFromBody({ title: "a\rb" }).title).toBe("a\nb");
  });
});
