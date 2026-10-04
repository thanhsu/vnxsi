import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const migrations = import.meta.glob("../../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const order = async (params: Record<string, string>) => (await searchProducts(testEnv.DB, parseCatalogQuery(params))).items.map((i) => i.name);

describe("catalogue ranking (spec §8.7, ADR-004)", () => {
  it("without a query: highest badge first, then newest approval", async () => {
    const b = await makeBuilder("r-browse@vnx.si", "r-browse", "approved");
    // A filter combination no other test in this file uses keeps the list to these four.
    const fields = { category: "hr", primaryLang: "zh-Hant", deliveryModel: "service" } as const;
    await addLiveProduct(b, "Old listed", { fields, at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "New listed", { fields, at: "2026-03-01T00:00:00.000Z" });
    await addLiveProduct(b, "Old prod", { fields, at: "2026-01-02T00:00:00.000Z", badges: ["demo_verified", "in_production"] });
    await addLiveProduct(b, "Mid demo", { fields, at: "2026-02-01T00:00:00.000Z", badges: ["demo_verified"] });
    expect(await order({ category: "hr", lang: "zh-Hant", delivery: "service" })).toEqual(["Old prod", "Mid demo", "New listed", "Old listed"]);
  });

  it("with a query: relevance first, then badge, then newest", async () => {
    const b = await makeBuilder("r-fts@vnx.si", "r-fts", "approved");
    // Strong match: the term in name, tagline and tags of a short document.
    await addLiveProduct(b, "Zorblax", { fields: { tagline: "Zorblax zorblax", tags: ["zorblax"], description: "Short." }, at: "2026-01-01T00:00:00.000Z" });
    // Weak match with the best badge: one mention deep in a long description.
    await addLiveProduct(b, "Weak match", {
      fields: { tagline: "Something else", description: `${"Lorem ipsum dolor sit amet. ".repeat(40)}zorblax.` },
      at: "2026-05-01T00:00:00.000Z",
      badges: ["in_production"],
    });
    expect(await order({ q: "zorblax" })).toEqual(["Zorblax", "Weak match"]);

    // Identical text ties on bm25, so the badge and then the approval date decide.
    const same = { tagline: "Quillbeam desk", description: "Quillbeam." };
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-02-01T00:00:00.000Z" });
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-01-15T00:00:00.000Z", badges: ["demo_verified"] });
    const items = (await searchProducts(testEnv.DB, parseCatalogQuery({ q: "quillbeam" }))).items;
    expect(items.map((i) => i.badgeScore)).toEqual([2, 1, 1]);
    const dates = await Promise.all(items.map(async (i) => (await testEnv.DB.prepare("SELECT published_at AS d FROM products WHERE id = ?1").bind(i.id).first<{ d: string }>())!.d));
    expect(dates).toEqual(["2026-01-15T00:00:00.000Z", "2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]);
  });

  it("ignores any parameter outside the spec's filters", async () => {
    const b = await makeBuilder("r-params@vnx.si", "r-params", "approved");
    await addLiveProduct(b, "Paramcheck a", { at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "Paramcheck b", { at: "2026-02-01T00:00:00.000Z", badges: ["demo_verified"] });
    const plain = await order({ q: "paramcheck" });
    const paid = await order({ q: "paramcheck", sort: "oldest", boost: "Paramcheck a", sponsored: "1", featured: "1", promoted: "1", priority: "9", paid: "1", order: "asc" });
    expect(paid).toEqual(plain);
  });

  it("has no paid, sponsored or boosted column in the tables ranking reads", () => {
    const sql = Object.values(migrations).join("\n");
    const READ_BY_RANKING = ["products", "builders", "users", "product_verifications", "pricing_tiers", "product_media", "products_fts"];
    for (const table of READ_BY_RANKING) {
      const m = new RegExp(String.raw`CREATE (?:VIRTUAL )?TABLE (?:IF NOT EXISTS )?${table}\s*(?:USING \w+\s*)?\(([\s\S]*?)\r?\n\);`).exec(sql);
      expect(m, `${table} definition found`).not.toBeNull();
      expect(m![1], table).not.toMatch(/(sponsor|boost|promot|featured|paid|priority)/i);
    }
  });
});
