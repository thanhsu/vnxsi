import { describe, expect, it } from "vitest";
import { addPortfolioItem, deletePortfolioItem, listPortfolio, movePortfolioItem } from "../../src/db/portfolio.ts";
import { MAX_PORTFOLIO_ITEMS } from "../../src/domain/portfolio.ts";
import { makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const item = (title: string) => ({ title, url: null, description: "" });
const now = () => new Date().toISOString();

describe("db/portfolio", () => {
  it("appends in order and refuses the 13th item in the same statement", async () => {
    const b = await makeBuilder("pdb-cap@vnx.si", "pdb-cap");
    for (let i = 1; i <= MAX_PORTFOLIO_ITEMS; i++) expect(await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item(`P${i}`), now: now() })).not.toBeNull();
    expect(await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("P13"), now: now() })).toBeNull();
    const list = await listPortfolio(testEnv.DB, b.userId);
    expect(list.map((x) => x.title)).toEqual(Array.from({ length: 12 }, (_, i) => `P${i + 1}`));
    expect(list.map((x) => x.sort)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("moves within bounds and only touches the owner's items", async () => {
    const b = await makeBuilder("pdb-move@vnx.si", "pdb-move");
    const other = await makeBuilder("pdb-other@vnx.si", "pdb-other");
    const a = await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("A"), now: now() });
    await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("B"), now: now() });
    expect(await movePortfolioItem(testEnv.DB, { builderId: b.userId, id: a!.id, direction: "up", now: now() })).toBe(false);
    expect(await movePortfolioItem(testEnv.DB, { builderId: b.userId, id: a!.id, direction: "down", now: now() })).toBe(true);
    expect((await listPortfolio(testEnv.DB, b.userId)).map((x) => x.title)).toEqual(["B", "A"]);
    expect(await deletePortfolioItem(testEnv.DB, other.userId, a!.id)).toBe(false);
    expect(await deletePortfolioItem(testEnv.DB, b.userId, a!.id)).toBe(true);
  });
});
