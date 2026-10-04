import { describe, expect, it } from "vitest";
import { createProductDraft, findOwnedProduct, listBuilderProducts, setProductStatus, updateProductFields } from "../../src/db/products.ts";
import { grantBadge, listActiveBadges, revokeBadge } from "../../src/db/verifications.ts";
import { ensureUser, makeBuilder, makeDraft } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-04T10:00:00.000Z";
const LATER = "2026-10-05T10:00:00.000Z";
const db = () => testEnv.DB;

describe("db/products", () => {
  it("creates a draft with a slug from the name and a suffix on collision", async () => {
    const b = await makeBuilder("pdb-slug@vnx.si", "pdb-slug");
    const first = await createProductDraft(db(), { builderId: b.userId, name: "Spa Booking Kit", now: NOW });
    expect(first).toMatchObject({ status: "draft", slug: "spa-booking-kit", name: "Spa Booking Kit", primaryLang: "en", tags: [], customizable: false, license: null });
    const second = await createProductDraft(db(), { builderId: b.userId, name: "Spa booking kit", now: NOW });
    expect(second.slug).toMatch(/^spa-booking-kit-[a-z0-9]{4}$/);
  });

  it("finds products only for their owner and lists them without archived ones", async () => {
    const { builder, product } = await makeDraft("pdb-own@vnx.si", "pdb-own", "Owned thing");
    const other = await makeBuilder("pdb-other@vnx.si", "pdb-other");
    expect(await findOwnedProduct(db(), builder.userId, product.id)).toMatchObject({ id: product.id });
    expect(await findOwnedProduct(db(), other.userId, product.id)).toBeNull();
    await setProductStatus(db(), { id: product.id, from: "draft", to: "archived", reviewNote: null, now: LATER });
    expect(await listBuilderProducts(db(), builder.userId)).toEqual([]);
  });

  it("changes status atomically and keeps the first publish time", async () => {
    const { product } = await makeDraft("pdb-status@vnx.si", "pdb-status", "Status thing");
    await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW });
    expect(await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW })).toBeNull();
    const published = await setProductStatus(db(), { id: product.id, from: "in_review", to: "published", reviewNote: null, now: NOW });
    expect(published).toMatchObject({ status: "published", publishedAt: NOW, firstPublishedAt: NOW });
    await setProductStatus(db(), { id: product.id, from: "published", to: "suspended", reviewNote: "spam", now: LATER });
    const again = await setProductStatus(db(), { id: product.id, from: "suspended", to: "published", reviewNote: null, now: LATER });
    expect(again).toMatchObject({ publishedAt: NOW, firstPublishedAt: NOW, reviewNote: null });
  });

  it("keeps published_at when a product is shown again (Owner decision 2026-10-04)", async () => {
    const { product } = await makeDraft("pdb-relist@vnx.si", "pdb-relist", "Relist thing");
    await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW });
    await setProductStatus(db(), { id: product.id, from: "in_review", to: "published", reviewNote: null, now: NOW });
    await setProductStatus(db(), { id: product.id, from: "published", to: "unlisted", reviewNote: null, now: LATER });
    expect(await setProductStatus(db(), { id: product.id, from: "unlisted", to: "published", reviewNote: null, now: LATER })).toMatchObject({ publishedAt: NOW, firstPublishedAt: NOW });
  });
});

describe("db/products: updateProductFields on an indexed product", () => {
  it("reports ok or stale from the returned row, not from meta.changes (products_fts triggers inflate it)", async () => {
    const { builder, product } = await makeDraft("pdb-fts@vnx.si", "pdb-fts", "Indexed thing");
    await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW });
    await setProductStatus(db(), { id: product.id, from: "in_review", to: "published", reviewNote: null, now: NOW });
    const input = { productId: product.id, builderId: builder.userId, markEdited: true, now: LATER, fields: { name: "Indexed thing 2", tagline: "New line" } };
    expect(await updateProductFields(db(), { ...input, expectedStatus: "published" })).toBe("ok");
    expect(await updateProductFields(db(), { ...input, expectedStatus: "draft" })).toBe("stale");
  });
});

describe("db/verifications", () => {
  it("keeps one active badge per kind and revokes it", async () => {
    const { product } = await makeDraft("pdb-badge@vnx.si", "pdb-badge", "Badge thing");
    const admin = await ensureUser("owner@vnx.si");
    expect(await grantBadge(db(), { productId: product.id, kind: "listed", verifiedBy: null, evidence: "", now: NOW })).toBe(true);
    expect(await grantBadge(db(), { productId: product.id, kind: "listed", verifiedBy: null, evidence: "", now: NOW })).toBe(false);
    expect(await grantBadge(db(), { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "Tried the demo", now: NOW })).toBe(true);
    expect((await listActiveBadges(db(), product.id)).map((b) => b.kind).sort()).toEqual(["demo_verified", "listed"]);

    expect(await revokeBadge(db(), { productId: product.id, kind: "demo_verified", reason: "demo_url_changed", now: LATER })).toBe(true);
    expect(await revokeBadge(db(), { productId: product.id, kind: "demo_verified", reason: "again", now: LATER })).toBe(false);
    expect((await listActiveBadges(db(), product.id)).map((b) => b.kind)).toEqual(["listed"]);
    // A revoked badge can be granted again.
    expect(await grantBadge(db(), { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "Re-checked", now: LATER })).toBe(true);
  });
});
