import type { BuilderStatus } from "./builder.ts";

export const PRODUCT_STATUSES = ["draft", "in_review", "changes_requested", "published", "unlisted", "suspended", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const CATEGORIES = ["booking", "crm", "ecommerce", "finance", "hr", "education", "internal_tools", "ai_agents", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const DELIVERY_MODELS = ["saas", "source", "service"] as const;
export type DeliveryModel = (typeof DELIVERY_MODELS)[number];
export const LICENSES = ["single_use", "extended", "open_source"] as const;
export type License = (typeof LICENSES)[number];
export const BILLINGS = ["one_time", "monthly", "yearly", "contact"] as const;
export type Billing = (typeof BILLINGS)[number];
/** Owner decision 2026-10-04: Chinese content is split into Simplified and Traditional. */
export const PRODUCT_LANGS = ["en", "vi", "zh-Hans", "zh-Hant"] as const;
export type ProductLang = (typeof PRODUCT_LANGS)[number];
export const BADGE_KINDS = ["listed", "demo_verified", "in_production"] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

export const MAX_TIERS = 5;
export const MAX_MEDIA = 8;
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const RECENTLY_EDITED_DAYS = 14;

export interface Product {
  id: string;
  builderId: string;
  slug: string;
  status: ProductStatus;
  primaryLang: ProductLang;
  name: string;
  tagline: string;
  problem: string;
  targetUsers: string;
  description: string;
  category: Category | null;
  tags: string[];
  features: string[];
  techStack: string[];
  deliveryModel: DeliveryModel | null;
  license: License | null;
  demoUrl: string | null;
  websiteUrl: string | null;
  customizable: boolean;
  customizationNotes: string;
  supportPolicy: string;
  reviewNote: string | null;
  firstPublishedAt: string | null;
  publishedAt: string | null;
  editedAfterPublishAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingTier {
  id: string;
  productId: string;
  name: string;
  priceCents: number | null;
  billing: Billing;
  description: string;
  sort: number;
}

export interface ProductMedia {
  id: string;
  productId: string;
  r2Key: string;
  alt: string;
  sort: number;
}

export interface Badge {
  id: string;
  productId: string;
  kind: BadgeKind;
  verifiedBy: string | null;
  evidence: string;
  verifiedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export type ProductAction = "submit" | "withdraw" | "approve" | "request_changes" | "unlist" | "relist" | "suspend" | "unsuspend" | "archive";
export type ProductActor = "owner" | "admin";
export type ProductTransition = { ok: true; status: ProductStatus } | { ok: false; error: "invalid_transition" };

const RULES: Record<ProductAction, { from: readonly ProductStatus[]; to: ProductStatus; actor: ProductActor }> = {
  submit: { from: ["draft", "changes_requested"], to: "in_review", actor: "owner" },
  // Owner decision 2026-10-04: in_review is read-only; withdrawing returns it to draft for editing.
  withdraw: { from: ["in_review"], to: "draft", actor: "owner" },
  approve: { from: ["in_review"], to: "published", actor: "admin" },
  request_changes: { from: ["in_review"], to: "changes_requested", actor: "admin" },
  unlist: { from: ["published"], to: "unlisted", actor: "owner" },
  relist: { from: ["unlisted"], to: "published", actor: "owner" },
  suspend: { from: ["published"], to: "suspended", actor: "admin" },
  unsuspend: { from: ["suspended"], to: "published", actor: "admin" },
  archive: { from: ["draft", "changes_requested", "published", "unlisted"], to: "archived", actor: "owner" },
};

/** Spec §7.2. Submit conditions are checked separately with `submitGaps`. */
export function transition(status: ProductStatus, action: ProductAction, actor: ProductActor): ProductTransition {
  const rule = RULES[action];
  if (!rule.from.includes(status) || rule.actor !== actor) return { ok: false, error: "invalid_transition" };
  return { ok: true, status: rule.to };
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly unknown[]).includes(value);
}

export function canEditProduct(status: ProductStatus): boolean {
  return status === "draft" || status === "changes_requested" || status === "published" || status === "unlisted";
}

/** The slug is editable until the first publish, then locked (spec §6.1). */
export function canChangeSlug(product: Pick<Product, "firstPublishedAt">): boolean {
  return product.firstPublishedAt === null;
}

export type ReadinessGap =
  | "builder_not_approved"
  | "name"
  | "tagline"
  | "problem"
  | "target_users"
  | "description"
  | "category"
  | "delivery_model"
  | "support_policy"
  | "features"
  | "pricing"
  | "media"
  | "license";

/** Everything spec §7.2 requires before submit, in display order. Empty = ready. */
export function submitGaps(input: { product: Product; builderStatus: BuilderStatus; tierCount: number; mediaCount: number }): ReadinessGap[] {
  const p = input.product;
  const blank = (s: string) => s.trim() === "";
  const gaps: ReadinessGap[] = [];
  if (input.builderStatus !== "approved") gaps.push("builder_not_approved");
  if (blank(p.name)) gaps.push("name");
  if (blank(p.tagline)) gaps.push("tagline");
  if (blank(p.problem)) gaps.push("problem");
  if (blank(p.targetUsers)) gaps.push("target_users");
  if (blank(p.description)) gaps.push("description");
  if (!p.category) gaps.push("category");
  if (!p.deliveryModel) gaps.push("delivery_model");
  if (blank(p.supportPolicy)) gaps.push("support_policy");
  if (p.features.length === 0) gaps.push("features");
  if (input.tierCount === 0) gaps.push("pricing");
  if (input.mediaCount === 0) gaps.push("media");
  if (p.deliveryModel === "source" && !p.license) gaps.push("license");
  return gaps;
}

export type EditLock = "in_review" | "suspended" | "builder_suspended";

/** Why the editor is read-only, or null when the builder may edit (Owner decision 2026-10-04: in_review is locked). */
export function editLock(status: ProductStatus, builderStatus: BuilderStatus): EditLock | null {
  if (builderStatus === "suspended") return "builder_suspended";
  if (status === "in_review") return "in_review";
  if (status === "suspended") return "suspended";
  return null;
}
