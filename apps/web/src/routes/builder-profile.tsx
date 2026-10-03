import type { Hono } from "hono";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { listPortfolio } from "../db/portfolio.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { BuilderProfilePage } from "../views/BuilderProfilePage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerBuilderProfileRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/b/:handle", async (c) => {
    const raw = c.req.param("handle") ?? "";
    const handle = raw.toLowerCase();
    if (!HANDLE_RE.test(handle)) return errorResponse(c, "notFound", 404);
    if (raw !== handle) return c.redirect(localizedPath(c.get("locale"), `/b/${handle}`), 301);
    const builder = await findPublicBuilderByHandle(c.env.DB, handle);
    if (!builder) return errorResponse(c, "notFound", 404);
    const portfolio = await listPortfolio(c.env.DB, builder.userId);
    return page(c, <BuilderProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} portfolio={portfolio} signedIn={c.get("user") !== null} />);
  });
}
