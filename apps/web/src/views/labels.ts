import type { Availability, BuilderKind, BuilderStatus, WorkLanguage } from "../domain/builder.ts";
import type { BudgetBand, InquiryStatus, InquiryType } from "../domain/inquiry.ts";
import type { RequestStatus } from "../domain/request.ts";
import type { UserStatus } from "../domain/user.ts";
import type { Badge, Billing, Category, DeliveryModel, License, ProductLang, ProductStatus } from "../domain/product.ts";
import type { ProductStep } from "../domain/product-input.ts";
import type { MessageKey } from "../i18n/messages/en.ts";

export const KIND_KEY: Record<BuilderKind, MessageKey> = {
  individual: "builder.kind.individual",
  team: "builder.kind.team",
  company: "builder.kind.company",
};

export const AVAILABILITY_KEY: Record<Availability, MessageKey> = {
  open: "builder.availability.open",
  limited: "builder.availability.limited",
  closed: "builder.availability.closed",
};

export const LANGUAGE_KEY: Record<WorkLanguage, MessageKey> = {
  en: "builder.lang.en",
  vi: "builder.lang.vi",
  zh: "builder.lang.zh",
};

export const STATUS_KEY: Record<BuilderStatus, MessageKey> = {
  pending: "hub.status.pending",
  approved: "hub.status.approved",
  rejected: "hub.status.rejected",
  suspended: "hub.status.suspended",
};

export const STATUS_BODY_KEY: Record<BuilderStatus, MessageKey> = {
  pending: "hub.status.pending.body",
  approved: "hub.status.approved.body",
  rejected: "hub.status.rejected.body",
  suspended: "hub.status.suspended.body",
};

export const USER_STATUS_KEY: Record<UserStatus, MessageKey> = {
  active: "users.status.active",
  suspended: "users.status.suspended",
};

export const PRODUCT_STATUS_KEY: Record<ProductStatus, MessageKey> = {
  draft: "product.status.draft",
  in_review: "product.status.in_review",
  changes_requested: "product.status.changes_requested",
  published: "product.status.published",
  unlisted: "product.status.unlisted",
  suspended: "product.status.suspended",
  archived: "product.status.archived",
};

export const CATEGORY_KEY: Record<Category, MessageKey> = {
  booking: "product.category.booking",
  crm: "product.category.crm",
  ecommerce: "product.category.ecommerce",
  finance: "product.category.finance",
  hr: "product.category.hr",
  education: "product.category.education",
  internal_tools: "product.category.internal_tools",
  ai_agents: "product.category.ai_agents",
  other: "product.category.other",
};

export const DELIVERY_KEY: Record<DeliveryModel, MessageKey> = {
  saas: "product.delivery.saas",
  source: "product.delivery.source",
  service: "product.delivery.service",
};

export const LICENSE_KEY: Record<License, MessageKey> = {
  single_use: "product.license.single_use",
  extended: "product.license.extended",
  open_source: "product.license.open_source",
};

export const PRODUCT_LANG_KEY: Record<ProductLang, MessageKey> = {
  en: "product.lang.en",
  vi: "product.lang.vi",
  "zh-Hans": "product.lang.zh-Hans",
  "zh-Hant": "product.lang.zh-Hant",
};

export const STEP_KEY: Record<ProductStep, MessageKey> = {
  product: "product.step.product",
  problem: "product.step.problem",
  audience: "product.step.audience",
  features: "product.step.features",
  demo: "product.step.demo",
  pricing: "product.step.pricing",
  customization: "product.step.customization",
  license: "product.step.license",
  support: "product.step.support",
};

export const BILLING_KEY: Record<Billing, MessageKey> = {
  one_time: "pricing.billing.one_time",
  monthly: "pricing.billing.monthly",
  yearly: "pricing.billing.yearly",
  contact: "pricing.billing.contact",
};

export const BADGE_KEY: Record<Badge["kind"], MessageKey> = {
  listed: "badge.listed",
  demo_verified: "badge.demo_verified",
  in_production: "badge.in_production",
};

export const INQUIRY_TYPE_KEY: Record<InquiryType, MessageKey> = {
  buy: "inquiry.type.buy",
  customize: "inquiry.type.customize",
  hire: "inquiry.type.hire",
  build_similar: "inquiry.type.build_similar",
  request: "inquiry.type.request",
};

export const BUDGET_KEY: Record<BudgetBand, MessageKey> = {
  "<500": "inquiry.budget.lt500",
  "500-2k": "inquiry.budget.500-2k",
  "2k-10k": "inquiry.budget.2k-10k",
  ">10k": "inquiry.budget.gt10k",
  unsure: "inquiry.budget.unsure",
};

export const INQUIRY_STATUS_KEY: Record<InquiryStatus, MessageKey> = {
  pending_verification: "inquiry.status.pending_verification",
  open: "inquiry.status.open",
  answered: "inquiry.status.answered",
  declined: "inquiry.status.declined",
  closed: "inquiry.status.closed",
  removed: "inquiry.status.removed",
};

export const REQUEST_STATUS_KEY: Record<RequestStatus, MessageKey> = {
  pending_verification: "request.status.pending_verification",
  submitted: "request.status.submitted",
  matching: "request.status.matching",
  builder_selected: "request.status.builder_selected",
  rejected: "request.status.rejected",
  expired: "request.status.expired",
  closed: "request.status.closed",
  removed: "request.status.removed",
};
