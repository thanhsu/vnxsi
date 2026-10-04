import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { createProductDraft, setProductStatus, updateProductFields } from "../../src/db/products.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { addLiveProduct, makeBuilder, makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const search = (params: Record<string, string>) => searchProducts(testEnv.DB, parseCatalogQuery(params));
const ids = async (params: Record<string, string>) => (await search(params)).items.map((i) => i.id);
const now = () => new Date().toISOString();

describe("searchProducts: matching (spec §8.7)", () => {
  it("finds Vietnamese with diacritics in any case, and Chinese with 2 and 4 characters", async () => {
    const { product: vi } = await makeLiveProduct("s-vi@vnx.si", "s-vi", "Phần mềm đặt lịch spa");
    const { product: zh } = await makeLiveProduct("s-zh@vnx.si", "s-zh", "美容院预约系统");
    expect(await ids({ q: "đặt lịch" })).toEqual([vi.id]);
    expect(await ids({ q: "ĐẶT LỊCH" })).toEqual([vi.id]);
    expect(await ids({ q: "预约" })).toEqual([zh.id]);
    expect(await ids({ q: "预约系统" })).toEqual([zh.id]);
  });

  it("searches tagline, description and tags, not other fields", async () => {
    const { product } = await makeLiveProduct("s-fields@vnx.si", "s-fields", "Fieldcheck", {
      fields: { tagline: "Tagzephyr helper", description: "Long text about quorvane flows.", tags: ["plinthwork"], problem: "problemonly-xyzzy" },
    });
    for (const q of ["tagzephyr", "quorvane", "plinthwork"]) expect(await ids({ q }), q).toEqual([product.id]);
    expect(await ids({ q: "problemonly-xyzzy" })).toEqual([]);
  });

  it("combines an FTS term with a short LIKE term", async () => {
    const { product: hit } = await makeLiveProduct("s-mix1@vnx.si", "s-mix1", "Mixcheck 客户", { fields: { tagline: "one" } });
    await makeLiveProduct("s-mix2@vnx.si", "s-mix2", "Mixcheck other", { fields: { tagline: "two" } });
    expect(await ids({ q: "mixcheck 客户" })).toEqual([hit.id]);
  });

  it("never treats user text as FTS syntax or LIKE wildcards", async () => {
    await makeLiveProduct("s-hostile@vnx.si", "s-hostile", "Hostilecheck");
    for (const q of ['"', 'foo"', "foo AND", "NEAR(a b)", "name:x", "*", "^x", "a OR b", "\\", "😀😀😀", "x".repeat(500), "a\u0000b"]) {
      await expect(search({ q }), q).resolves.toBeDefined();
    }
    expect((await search({ q: "%" })).total).toBe(0);
    expect((await search({ q: "_" })).total).toBe(0);
    expect((await search({ q: "%%%" })).total).toBe(0);
    // Tags are matched per element, not as raw JSON text, so a quote matches nothing.
    expect((await search({ q: '"' })).total).toBe(0);
  });
});

describe("searchProducts: only public products (spec §7.1, §7.2)", () => {
  it("follows unlist, relist, edit while published and archive", async () => {
    const { builder, product } = await makeLiveProduct("s-sync@vnx.si", "s-sync", "Syncwombat", { fields: { tagline: "Plain line" } });
    expect(await ids({ q: "syncwombat" })).toEqual([product.id]);

    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "unlisted", reviewNote: null, now: now() });
    expect(await ids({ q: "syncwombat" })).toEqual([]);
    await setProductStatus(testEnv.DB, { id: product.id, from: "unlisted", to: "published", reviewNote: null, now: now() });
    expect(await ids({ q: "syncwombat" })).toEqual([product.id]);

    await updateProductFields(testEnv.DB, { productId: product.id, builderId: builder.userId, expectedStatus: "published", markEdited: true, now: now(), fields: { name: "Renamedotter" } });
    expect(await ids({ q: "syncwombat" })).toEqual([]);
    expect(await ids({ q: "renamedotter" })).toEqual([product.id]);

    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "archived", reviewNote: null, now: now() });
    expect(await ids({ q: "renamedotter" })).toEqual([]);
  });

  it("hides suspended products and products of suspended builders or users", async () => {
    const a = await makeLiveProduct("s-hide1@vnx.si", "s-hide1", "Hidecheck one");
    const b = await makeLiveProduct("s-hide2@vnx.si", "s-hide2", "Hidecheck two");
    const c = await makeLiveProduct("s-hide3@vnx.si", "s-hide3", "Hidecheck three");
    expect((await ids({ q: "hidecheck" })).sort()).toEqual([a.product.id, b.product.id, c.product.id].sort());

    await setProductStatus(testEnv.DB, { id: a.product.id, from: "published", to: "suspended", reviewNote: "spam", now: now() });
    await setBuilderStatus(testEnv.DB, { userId: b.builder.userId, from: "approved", to: "suspended", reviewNote: null, now: now() });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(c.builder.userId).run();
    expect(await ids({ q: "hidecheck" })).toEqual([]);
    expect(await ids({ q: "hid" })).toEqual([]);
  });

  it("never lists drafts or products in review", async () => {
    const builder = await makeBuilder("s-draft@vnx.si", "s-draft", "approved");
    const live = await addLiveProduct(builder, "Draftcheck live");
    const draft = await createProductDraft(testEnv.DB, { builderId: builder.userId, name: "Draftcheck draft", now: now() });
    await setProductStatus(testEnv.DB, { id: draft.id, from: "draft", to: "in_review", reviewNote: null, now: now() });
    expect(await ids({ q: "draftcheck" })).toEqual([live.id]);
  });
});

describe("searchProducts: filters and pages", () => {
  it("filters by category, delivery model, language and badge", async () => {
    const builder = await makeBuilder("s-filter@vnx.si", "s-filter", "approved");
    const crm = await addLiveProduct(builder, "Filtercheck crm", { fields: { category: "crm" } });
    const src = await addLiveProduct(builder, "Filtercheck source", { fields: { deliveryModel: "source", license: "extended" } });
    const zh = await addLiveProduct(builder, "Filtercheck zh", { fields: { primaryLang: "zh-Hant" } });
    const prod = await addLiveProduct(builder, "Filtercheck prod", { badges: ["in_production"] });
    expect(await ids({ q: "filtercheck", category: "crm" })).toEqual([crm.id]);
    expect(await ids({ q: "filtercheck", delivery: "source" })).toEqual([src.id]);
    expect(await ids({ q: "filtercheck", lang: "zh-Hant" })).toEqual([zh.id]);
    expect(await ids({ q: "filtercheck", badge: "in_production" })).toEqual([prod.id]);
    expect(await ids({ q: "filtercheck", badge: "demo_verified" })).toEqual([]);
  });

  it("filters on the cheapest priced tier, whatever its billing (Owner decision 2026-10-04)", async () => {
    const builder = await makeBuilder("s-price@vnx.si", "s-price", "approved");
    const monthly = await addLiveProduct(builder, "Pricecheck monthly", { tiers: [{ name: "M", billing: "monthly", priceCents: 1900, description: "" }, { name: "C", billing: "contact", priceCents: null, description: "" }] });
    const oneTime = await addLiveProduct(builder, "Pricecheck onetime", { tiers: [{ name: "O", billing: "one_time", priceCents: 50000, description: "" }, { name: "Y", billing: "yearly", priceCents: 90000, description: "" }] });
    await addLiveProduct(builder, "Pricecheck contact", { tiers: [{ name: "C", billing: "contact", priceCents: null, description: "" }] });
    const free = await addLiveProduct(builder, "Pricecheck free", { tiers: [{ name: "F", billing: "one_time", priceCents: 0, description: "" }] });
    const sorted = async (params: Record<string, string>) => (await ids({ q: "pricecheck", ...params })).sort();

    expect(await sorted({ min: "0", max: "19" })).toEqual([monthly.id, free.id].sort());
    expect(await sorted({ min: "19.01" })).toEqual([oneTime.id]);
    expect(await sorted({ min: "0" })).toEqual([monthly.id, oneTime.id, free.id].sort());
    expect(await sorted({ max: "0" })).toEqual([free.id]);
    expect(await sorted({ min: "500", max: "19" })).toEqual([monthly.id, oneTime.id].sort());
    expect(await sorted({})).toHaveLength(4);
  });

  it("returns cover, starting price, builder and badge score on each item", async () => {
    const { builder, product } = await makeLiveProduct("s-item@vnx.si", "s-item", "Itemcheck", { badges: ["demo_verified"] });
    const [item] = (await search({ q: "itemcheck" })).items;
    expect(item).toEqual({
      id: product.id,
      slug: product.slug,
      name: "Itemcheck",
      tagline: "Itemcheck in one line",
      category: "booking",
      builderHandle: builder.handle,
      builderName: builder.name,
      coverKey: `products/${product.id}/01J0000000000000000000000C.png`,
      minPriceCents: 1900,
      badgeScore: 2,
    });
  });

  it("pages 24 at a time and counts every match", async () => {
    const builder = await makeBuilder("s-page@vnx.si", "s-page", "approved");
    for (let i = 0; i < 25; i++) await addLiveProduct(builder, `Pagecheck ${i}`);
    const first = await search({ q: "pagecheck" });
    const second = await search({ q: "pagecheck", page: "2" });
    expect(first.total).toBe(25);
    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(25);
    expect((await search({ q: "pagecheck", page: "3" })).items).toEqual([]);
  });
});
