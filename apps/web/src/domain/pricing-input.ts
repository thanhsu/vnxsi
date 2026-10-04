import { normalizeNewlines } from "./product-input.ts";
import { BILLINGS, MAX_TIERS, type Billing, type PricingTier } from "./product.ts";

export type TierInput = { name: string; billing: Billing; priceCents: number | null; description: string };
export type TierRowValues = { name: string; billing: string; price: string; description: string };
export type TierValues = TierRowValues[];
export type TierFieldError = "required" | "too_long" | "choice" | "price" | "contact";
export type TierErrors = Record<number, Partial<Record<keyof TierRowValues, TierFieldError>>>;

const MAX_PRICE_CENTS = 100_000 * 100;
const str = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

/** "49", "49.5" or "49.99" USD → cents; null when not a price between 0 and 100000. */
export function parseUsdCents(raw: string): number | null {
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function tierValuesFromBody(body: Record<string, unknown>): TierValues {
  return Array.from({ length: MAX_TIERS }, (_, i) => ({
    name: str(body[`tiers[${i}].name`]),
    billing: str(body[`tiers[${i}].billing`]),
    price: str(body[`tiers[${i}].price`]),
    description: str(body[`tiers[${i}].description`]),
  }));
}

export function tierValuesFromTiers(tiers: PricingTier[]): TierValues {
  return Array.from({ length: MAX_TIERS }, (_, i) => {
    const t = tiers[i];
    return t ? { name: t.name, billing: t.billing, price: centsToInput(t.priceCents), description: t.description } : { name: "", billing: "", price: "", description: "" };
  });
}

/** Rows with every field blank are skipped; any other row must be a complete tier. */
export function parseTiers(values: TierValues): { ok: true; tiers: TierInput[] } | { ok: false; errors: TierErrors } {
  const tiers: TierInput[] = [];
  const errors: TierErrors = {};
  values.slice(0, MAX_TIERS).forEach((row, i) => {
    const name = row.name.trim();
    // The select always posts a value; a missing one means the form default.
    const billing = row.billing.trim() || "one_time";
    const price = row.price.trim();
    const description = row.description.trim();
    if (!name && !price && !description && billing === "one_time") return;
    const rowErrors: Partial<Record<keyof TierRowValues, TierFieldError>> = {};
    if (!name) rowErrors.name = "required";
    else if (name.length > 40) rowErrors.name = "too_long";
    if (description.length > 300) rowErrors.description = "too_long";
    const validBilling = (BILLINGS as readonly string[]).includes(billing);
    if (!validBilling) rowErrors.billing = "choice";
    let priceCents: number | null = null;
    if (billing === "contact") {
      if (price !== "") rowErrors.price = "contact";
    } else {
      priceCents = parseUsdCents(price);
      if (priceCents === null) rowErrors.price = "price";
    }
    if (Object.keys(rowErrors).length > 0) errors[i] = rowErrors;
    else tiers.push({ name, billing: billing as Billing, priceCents, description });
  });
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, tiers };
}
