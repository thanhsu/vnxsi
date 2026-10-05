import { splitCsv } from "./builder-input.ts";
import { CATEGORIES, DELIVERY_MODELS, LICENSES, PRODUCT_LANGS, type Product, type ReadinessGap } from "./product.ts";
import { validatePublicUrl } from "./product-url.ts";
import { SLUG_RE } from "./slug.ts";

/** The 9 editor steps in display order (spec §5.3). */
export const PRODUCT_STEPS = ["product", "problem", "audience", "features", "demo", "pricing", "customization", "license", "support"] as const;
export type ProductStep = (typeof PRODUCT_STEPS)[number];
/** Steps whose form is generated from STEP_FIELDS (pricing has its own form). */
export const TEXT_STEPS = ["product", "problem", "audience", "features", "demo", "customization", "license", "support"] as const;
export type TextStep = (typeof TEXT_STEPS)[number];

export type ProductField =
  | "name"
  | "slug"
  | "tagline"
  | "category"
  | "deliveryModel"
  | "primaryLang"
  | "tags"
  | "description"
  | "problem"
  | "targetUsers"
  | "features"
  | "techStack"
  | "demoUrl"
  | "websiteUrl"
  | "customizable"
  | "customizationNotes"
  | "license"
  | "supportPolicy";
export type ProductFields = Pick<Product, ProductField>;

export type FieldKind = "text" | "slug" | "textarea" | "url" | "select" | "csv" | "lines" | "checkbox";
export interface FieldSpec {
  name: ProductField;
  kind: FieldKind;
  /** Max characters (per item for csv/lines). */
  max: number;
  maxItems?: number;
  options?: readonly string[];
  /** Must be non-empty even in a draft. */
  required?: boolean;
}

export const STEP_FIELDS: Record<TextStep, readonly FieldSpec[]> = {
  product: [
    { name: "name", kind: "text", max: 80, required: true },
    { name: "slug", kind: "slug", max: 60, required: true },
    { name: "tagline", kind: "text", max: 120 },
    { name: "category", kind: "select", max: 0, options: CATEGORIES },
    { name: "deliveryModel", kind: "select", max: 0, options: DELIVERY_MODELS },
    { name: "primaryLang", kind: "select", max: 0, options: PRODUCT_LANGS, required: true },
    { name: "tags", kind: "csv", max: 30, maxItems: 10 },
    { name: "description", kind: "textarea", max: 5000 },
  ],
  problem: [{ name: "problem", kind: "textarea", max: 2000 }],
  audience: [{ name: "targetUsers", kind: "textarea", max: 1000 }],
  features: [
    { name: "features", kind: "lines", max: 120, maxItems: 20 },
    { name: "techStack", kind: "csv", max: 40, maxItems: 20 },
  ],
  demo: [
    { name: "demoUrl", kind: "url", max: 500 },
    { name: "websiteUrl", kind: "url", max: 500 },
  ],
  customization: [
    { name: "customizable", kind: "checkbox", max: 0 },
    { name: "customizationNotes", kind: "textarea", max: 2000 },
  ],
  license: [{ name: "license", kind: "select", max: 0, options: LICENSES }],
  support: [{ name: "supportPolicy", kind: "textarea", max: 2000 }],
};

export type StepValues = Partial<Record<ProductField, string>>;
export type FieldErrorCode = "required" | "too_long" | "list" | "url" | "choice" | "slug" | "slug_taken";
export type StepErrors = Partial<Record<ProductField, FieldErrorCode>>;

export function isProductStep(value: unknown): value is ProductStep {
  return (PRODUCT_STEPS as readonly unknown[]).includes(value);
}

export function isTextStep(value: unknown): value is TextStep {
  return (TEXT_STEPS as readonly unknown[]).includes(value);
}

/** Browsers submit textarea newlines as CRLF; count and store LF only. */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

const str = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

export function stepValuesFromBody(step: TextStep, body: Record<string, unknown>): StepValues {
  const values: StepValues = {};
  for (const spec of STEP_FIELDS[step]) {
    values[spec.name] = spec.kind === "checkbox" ? (body[spec.name] === undefined ? "" : "on") : str(body[spec.name]);
  }
  return values;
}

export function stepValuesFromProduct(step: TextStep, product: Product): StepValues {
  const values: StepValues = {};
  for (const spec of STEP_FIELDS[step]) {
    const v = product[spec.name];
    if (spec.kind === "checkbox") values[spec.name] = v ? "on" : "";
    else if (Array.isArray(v)) values[spec.name] = v.join(spec.kind === "lines" ? "\n" : ", ");
    else values[spec.name] = v === null ? "" : String(v);
  }
  return values;
}

type FieldResult = { ok: true; value: unknown } | { ok: false; error: FieldErrorCode };

function parseField(spec: FieldSpec, raw: string): FieldResult {
  const v = normalizeNewlines(raw).trim();
  switch (spec.kind) {
    case "checkbox":
      return { ok: true, value: v === "on" || v === "true" || v === "1" };
    case "slug": {
      const slug = v.toLowerCase();
      return SLUG_RE.test(slug) ? { ok: true, value: slug } : { ok: false, error: "slug" };
    }
    case "url":
      if (v === "") return { ok: true, value: null };
      if (v.length > spec.max) return { ok: false, error: "too_long" };
      return validatePublicUrl(v).ok ? { ok: true, value: v } : { ok: false, error: "url" };
    case "select":
      if (v === "") return spec.required ? { ok: false, error: "choice" } : { ok: true, value: null };
      return spec.options?.includes(v) ? { ok: true, value: v } : { ok: false, error: "choice" };
    case "csv":
    case "lines": {
      const items = spec.kind === "csv" ? splitCsv(v) : v.split("\n").map((line) => line.trim()).filter(Boolean);
      const bad = items.length > (spec.maxItems ?? Infinity) || items.some((item) => item.length > spec.max);
      return bad ? { ok: false, error: "list" } : { ok: true, value: items };
    }
    default:
      if (spec.required && v === "") return { ok: false, error: "required" };
      return v.length > spec.max ? { ok: false, error: "too_long" } : { ok: true, value: v };
  }
}

export function parseStep(step: TextStep, values: StepValues): { ok: true; fields: Partial<ProductFields> } | { ok: false; errors: StepErrors } {
  const fields: Record<string, unknown> = {};
  const errors: StepErrors = {};
  for (const spec of STEP_FIELDS[step]) {
    const result = parseField(spec, values[spec.name] ?? "");
    if (result.ok) fields[spec.name] = result.value;
    else errors[spec.name] = result.error;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, fields: fields as Partial<ProductFields> };
}

/** Name for a new draft (same rule as the product step's name field). */
export function parseProductName(raw: unknown): { ok: true; name: string } | { ok: false; error: FieldErrorCode } {
  const result = parseField(STEP_FIELDS.product[0]!, str(raw));
  return result.ok ? { ok: true, name: result.value as string } : { ok: false, error: result.error };
}

/** Where the builder fixes each gap; null when it is not an editor step. */
export const GAP_STEP: Record<ReadinessGap, ProductStep | null> = {
  builder_not_approved: null,
  name: "product",
  tagline: "product",
  description: "product",
  category: "product",
  delivery_model: "product",
  problem: "problem",
  target_users: "audience",
  features: "features",
  media: "demo",
  pricing: "pricing",
  license: "license",
  support_policy: "support",
};
