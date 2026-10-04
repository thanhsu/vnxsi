import type { Hono } from "hono";
import { listSitemapBuilders } from "../db/builders.ts";
import { listSitemapProducts } from "../db/products.ts";
import type { AppEnv } from "../env.ts";
import { siteOrigin } from "../http/origin.ts";
import { renderRobots, renderSitemap, type SitemapEntry } from "../views/seo.ts";

const CACHE = "public, max-age=3600";

export function registerSeoRoutes(app: Hono<AppEnv>) {
  app.get("/robots.txt", (c) => c.text(renderRobots(siteOrigin(c)), 200, { "cache-control": CACHE }));

  app.get("/sitemap.xml", async (c) => {
    const [products, builders] = await Promise.all([listSitemapProducts(c.env.DB), listSitemapBuilders(c.env.DB)]);
    const entries: SitemapEntry[] = [
      { rest: "/", localized: true },
      { rest: "/products", localized: true },
      { rest: "/builders", localized: true },
      ...products.map((p) => ({ rest: `/p/${p.slug}`, lastmod: p.updatedAt, localized: true })),
      ...builders.map((b) => ({ rest: `/b/${b.handle}`, lastmod: b.updatedAt, localized: true })),
    ];
    return c.body(renderSitemap(siteOrigin(c), entries), 200, { "content-type": "application/xml; charset=utf-8", "cache-control": CACHE });
  });
}
