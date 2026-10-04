import type { Hono } from "hono";
import { listDirectoryCountries, searchBuilders } from "../db/directory.ts";
import { parseDirectoryQuery } from "../domain/directory.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { DirectoryPage } from "../views/DirectoryPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerDirectoryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/builders", async (c) => {
    const query = parseDirectoryQuery(c.req.query());
    const [result, countries] = await Promise.all([searchBuilders(c.env.DB, query), listDirectoryCountries(c.env.DB)]);
    if (query.page > 1 && result.items.length === 0) return errorResponse(c, "notFound", 404);
    return page(
      c,
      <DirectoryPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} result={result} countries={countries} signedIn={c.get("user") !== null} />,
    );
  });
}
