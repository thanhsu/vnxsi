import { describe, expect, it } from "vitest";
import { canChangeSlug, canEditProduct, editLock, PRODUCT_STATUSES, submitGaps, transition, type Product, type ProductAction } from "../../src/domain/product.ts";
import { slugify, slugWithSuffix, SLUG_RE } from "../../src/domain/slug.ts";

const VALID: [string, ProductAction, "owner" | "admin", string][] = [
  ["draft", "submit", "owner", "in_review"],
  ["changes_requested", "submit", "owner", "in_review"],
  ["in_review", "withdraw", "owner", "draft"],
  ["in_review", "approve", "admin", "published"],
  ["in_review", "request_changes", "admin", "changes_requested"],
  ["published", "unlist", "owner", "unlisted"],
  ["unlisted", "relist", "owner", "published"],
  ["published", "suspend", "admin", "suspended"],
  ["suspended", "unsuspend", "admin", "published"],
  ["draft", "archive", "owner", "archived"],
  ["changes_requested", "archive", "owner", "archived"],
  ["published", "archive", "owner", "archived"],
  ["unlisted", "archive", "owner", "archived"],
];

describe("product state machine (spec §7.2)", () => {
  it.each(VALID)("%s --%s by %s--> %s", (from, action, actor, to) => {
    expect(transition(from as Product["status"], action, actor)).toEqual({ ok: true, status: to });
  });

  it("rejects every other combination", () => {
    const valid = new Set(VALID.map(([from, action, actor]) => `${from}:${action}:${actor}`));
    const actions: ProductAction[] = ["submit", "withdraw", "approve", "request_changes", "unlist", "relist", "suspend", "unsuspend", "archive"];
    for (const status of PRODUCT_STATUSES) {
      for (const action of actions) {
        for (const actor of ["owner", "admin"] as const) {
          if (valid.has(`${status}:${action}:${actor}`)) continue;
          expect(transition(status, action, actor), `${status}:${action}:${actor}`).toEqual({ ok: false, error: "invalid_transition" });
        }
      }
    }
  });

  it("allows editing only in draft, changes_requested, published and unlisted", () => {
    expect(PRODUCT_STATUSES.filter((s) => canEditProduct(s))).toEqual(["draft", "changes_requested", "published", "unlisted"]);
  });

  it("locks the slug after the first publish", () => {
    expect(canChangeSlug({ firstPublishedAt: null })).toBe(true);
    expect(canChangeSlug({ firstPublishedAt: "2026-10-04T00:00:00.000Z" })).toBe(false);
  });
});

const complete: Product = {
  id: "01J0000000000000000000000A",
  builderId: "u1",
  slug: "booking-app",
  status: "draft",
  primaryLang: "en",
  name: "Booking app",
  tagline: "Bookings for spas",
  problem: "Phone bookings get lost",
  targetUsers: "Spa owners",
  description: "Online booking.",
  category: "booking",
  tags: [],
  features: ["Calendar"],
  techStack: [],
  deliveryModel: "saas",
  license: null,
  demoUrl: null,
  websiteUrl: null,
  customizable: false,
  customizationNotes: "",
  supportPolicy: "Email, 48h",
  reviewNote: null,
  firstPublishedAt: null,
  publishedAt: null,
  editedAfterPublishAt: null,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};

describe("submit conditions (spec §7.2)", () => {
  it("passes a complete product", () => {
    expect(submitGaps({ product: complete, builderStatus: "approved", tierCount: 1, mediaCount: 1 })).toEqual([]);
  });

  it("lists every gap in a fixed order", () => {
    const empty: Product = { ...complete, tagline: "", problem: " ", targetUsers: "", description: "", category: null, deliveryModel: "source", license: null, supportPolicy: "", features: [] };
    expect(submitGaps({ product: empty, builderStatus: "pending", tierCount: 0, mediaCount: 0 })).toEqual([
      "builder_not_approved",
      "tagline",
      "problem",
      "target_users",
      "description",
      "category",
      "support_policy",
      "features",
      "pricing",
      "media",
      "license",
    ]);
    expect(submitGaps({ product: { ...complete, deliveryModel: null }, builderStatus: "approved", tierCount: 1, mediaCount: 1 })).toEqual(["delivery_model"]);
  });
});

describe("slugs", () => {
  it.each([
    ["Booking App", "booking-app"],
    ["  Đặt lịch Spa!! ", "dat-lich-spa"],
    ["CRM / Sales -- Pro", "crm-sales-pro"],
    ["预约系统", "product"],
    ["AB", "product"],
    ["x".repeat(80), "x".repeat(60)],
  ])("slugify(%j) = %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(SLUG_RE.test(slugify(name))).toBe(true);
  });

  it("appends a suffix within 60 characters", () => {
    expect(slugWithSuffix("booking-app", "a1b2")).toBe("booking-app-a1b2");
    const long = slugWithSuffix("x".repeat(60), "a1b2");
    expect(long).toHaveLength(60);
    expect(long.endsWith("-a1b2")).toBe(true);
    expect(SLUG_RE.test(long)).toBe(true);
  });

  it.each(["ab", "-abc", "abc-", "Abc", "a_bc", "a".repeat(61)])("rejects slug %j", (slug) => {
    expect(SLUG_RE.test(slug)).toBe(false);
  });
});

describe("editLock", () => {
  it("explains why the editor is read-only", () => {
    expect(editLock("draft", "approved")).toBeNull();
    expect(editLock("published", "pending")).toBeNull();
    expect(editLock("in_review", "approved")).toBe("in_review");
    expect(editLock("suspended", "approved")).toBe("suspended");
    expect(editLock("draft", "suspended")).toBe("builder_suspended");
  });
});
