import type { Context } from "hono";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { foundingProducts } from "../db/catalog.ts";
import { readPublicStats } from "../db/public-stats.ts";
import type { CatalogItem } from "../domain/catalog.ts";
import { FOUNDING_LIMIT, homeView, type PublicSnapshot } from "../domain/public-stats.ts";
import type { AppEnv } from "../env.ts";
import type { Locale } from "../i18n/locales.ts";
import { HomeBlocks } from "../views/home/HomeBlocks.tsx";

export type HomeData = { snapshot: PublicSnapshot; founding: CatalogItem[] };
const fail = (err: unknown) => console.error(JSON.stringify({ event: "home_blocks_failed", error: String(err) }));

/** One public_stats read; the newest-products query runs only while Trending is absent. A failure here never takes the landing down. */
export async function loadHomeData(db: D1Database, now: Date): Promise<HomeData | null> {
  try {
    const snapshot = await readPublicStats(db, now);
    return { snapshot, founding: snapshot.trending ? [] : await foundingProducts(db, FOUNDING_LIMIT) };
  } catch (err) {
    fail(err);
    return null;
  }
}

/** Renders to a string INSIDE the try: hono builds JSX lazily, so a malformed snapshot value would otherwise throw after the try. */
export async function renderHome(locale: Locale, data: HomeData | null, now: Date): Promise<Child | null> {
  if (data === null) return null;
  try {
    return raw(await (<HomeBlocks locale={locale} view={homeView(data.snapshot, data.founding)} now={now} />).toString());
  } catch (err) {
    fail(err);
    return null;
  }
}

/** The data blocks under the landing at `/` (Owner A2). Never rejects. */
export async function homeBlocks(c: Context<AppEnv>): Promise<Child | null> {
  const now = new Date();
  return renderHome(c.get("locale"), await loadHomeData(c.env.DB, now), now);
}
