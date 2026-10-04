import { raw } from "hono/html";
import type { PricingTier, Product } from "../domain/product.ts";

const UNSAFE: Record<string, string> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" };

/**
 * The only raw insertion of user content (plan M3 Global Constraints): JSON is escaped so that no character can
 * close the script element or break the line, and JSON.parse returns the original value.
 */
export function jsonLdScript(data: unknown) {
  const json = JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (ch) => UNSAFE[ch] ?? ch);
  return raw(`<script type="application/ld+json">${json}</script>`);
}

/** schema.org SoftwareApplication (spec §8.8): offers only for tiers with a price; no aggregateRating. */
export function productJsonLd(input: { product: Product; tiers: PricingTier[]; url: string; image: string | null }) {
  const offers = input.tiers
    .filter((t) => t.priceCents !== null)
    .map((t) => ({ "@type": "Offer", name: t.name, price: (t.priceCents! / 100).toFixed(2), priceCurrency: "USD" }));
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.product.name,
    description: input.product.tagline,
    url: input.url,
    applicationCategory: "BusinessApplication",
    ...(input.image ? { image: input.image } : {}),
    ...(offers.length > 0 ? { offers } : {}),
  };
}
