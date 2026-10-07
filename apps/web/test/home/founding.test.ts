import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { FOUNDING_LIMIT, FOUNDING_MIN, MIN, STALE_AFTER_MS, rankTrending } from "../../src/domain/public-stats.ts";
import { DECK_SIZE } from "../../src/views/landing/Deck.tsx";
import { makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { DB, block, clearStats, getHome, seedSnapshot, spyDb, trendingCandidates } from "./blocks.ts";

const at = (i: number) => new Date(Date.UTC(2026, 9, 1, i)).toISOString();
// p0 is the OLDEST and carries a badge: a badge must not lift it into Founding.
const add = (i: number) => makeLiveProduct(`fnd${i}@vnx.si`, `fnd-${i}`, `Founding p${i}`, { at: at(i), badges: i === 0 ? ["demo_verified"] : [] });
const names = (html: string) => [...new Set([...html.matchAll(/Founding p(\d)/g)].map((m) => Number(m[1])))];

describe("Founding products and the hero (Owner Q1 2026-10-05, minimum 2026-10-06)", () => {
  it("boundary: FOUNDING_MIN - 1 published products show no Founding block, FOUNDING_MIN show it", async () => {
    await clearStats();
    for (let i = 0; i < FOUNDING_MIN - 1; i++) await add(i);
    expect(block(await getHome(), "home-founding")).toBe("");
    await add(FOUNDING_MIN - 1);
    expect(names(block(await getHome(), "home-founding"))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("with one more, Founding keeps the FOUNDING_LIMIT newest first publications, newest first", async () => {
    await add(FOUNDING_LIMIT);
    const html = await getHome();
    const founding = block(html, "home-founding");
    expect(names(founding)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(founding).not.toContain("Founding p0");
    expect(block(html, "home-trending")).toBe("");
  });

  it("a product that is no longer published leaves Founding", async () => {
    await DB.prepare("UPDATE products SET status = 'unlisted' WHERE name = 'Founding p6'").run();
    expect(block(await getHome(), "home-founding")).not.toContain("Founding p6");
  });

  it("a fresh Trending runs no newest-products query and shows no Founding", async () => {
    await seedSnapshot();
    const sql: string[] = [];
    const html = await getHome("/", { ...testEnv, DB: spyDb(sql) });
    expect(sql.filter((s) => s.includes("first_published_at DESC"))).toHaveLength(0);
    expect(block(html, "home-founding")).toBe("");
    expect(block(html, "home-trending")).not.toBe("");
  });

  it("a stale Trending with enough published products shows Founding", async () => {
    await seedSnapshot();
    const old = new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString();
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), new Date()), old);
    const html = await getHome();
    expect(block(html, "home-trending")).toBe("");
    expect(block(html, "home-founding")).not.toBe("");
  });

  it("the landing hero keeps the catalogue default order (badge first, then newest) and Task 7 adds no hero", async () => {
    const expected = (await searchProducts(DB, parseCatalogQuery({}))).items.slice(0, DECK_SIZE).map((i) => i.slug);
    const html = await getHome();
    const hero = html.slice(html.indexOf('<section class="lp-hero"'), html.indexOf('<section class="lp-principles"'));
    const slugs = [...new Set([...hero.matchAll(/href="\/p\/([^"]+)"/g)].map((m) => m[1]))];
    expect(slugs).toEqual(expected);
    expect(html.match(/<section class="lp-hero"/g)).toHaveLength(1);
  });
});
