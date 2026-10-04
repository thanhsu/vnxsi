import type { Hono } from "hono";
import { searchProducts } from "../db/catalog.ts";
import { parseCatalogQuery } from "../domain/catalog.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { CatalogPage } from "../views/CatalogPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerCatalogRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/products", async (c) => {
    const query = parseCatalogQuery(c.req.query());
    const result = await searchProducts(c.env.DB, query);
    // Pages past the end are not real pages (keeps crawlers out of an endless list).
    if (query.page > 1 && result.items.length === 0) return errorResponse(c, "notFound", 404);
    return page(c, <CatalogPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} result={result} signedIn={c.get("user") !== null} />);
  });
}
