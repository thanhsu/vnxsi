import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { addPortfolioItem, deletePortfolioItem, findPortfolioItem, listPortfolio, movePortfolioItem, updatePortfolioItem } from "../db/portfolio.ts";
import { canEditProfile } from "../domain/builder.ts";
import { parsePortfolioItem, portfolioValuesFromBody, portfolioValuesFromItem, type PortfolioErrors, type PortfolioFormValues } from "../domain/portfolio.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { PortfolioEditPage, PortfolioPage } from "../views/hub/PortfolioPage.tsx";
import { page } from "../views/render.ts";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EMPTY: PortfolioFormValues = { title: "", url: "", description: "" };

async function listPage(c: Context<AppEnv>, values: PortfolioFormValues, errors: PortfolioErrors, status: 200 | 400 = 200) {
  const builder = c.get("builder");
  const items = await listPortfolio(c.env.DB, builder.userId);
  return page(
    c,
    <PortfolioPage locale={c.get("locale")} origin={requestOrigin(c)} items={items} values={values} errors={errors} editable={canEditProfile(builder.status)} />,
    status,
  );
}

/** The item only if it belongs to the signed-in builder; anything else reads as missing. */
async function ownedItem(c: Context<AppEnv>) {
  const id = c.req.param("id") ?? "";
  return ULID.test(id) ? findPortfolioItem(c.env.DB, c.get("builder").userId, id) : null;
}

const back = (c: Context<AppEnv>) => c.redirect(localizedPath(c.get("locale"), "/hub/portfolio"), 303);

export function registerPortfolioRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/portfolio", requireBuilder, (c) => listPage(c, EMPTY, {}));

  onLocalized(app, "post", "/hub/portfolio", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const values = portfolioValuesFromBody(await c.req.parseBody());
    const parsed = parsePortfolioItem(values);
    if (!parsed.ok) return listPage(c, values, parsed.errors, 400);
    const added = await addPortfolioItem(c.env.DB, { builderId: builder.userId, item: parsed.item, now: new Date().toISOString() });
    if (!added) return errorResponse(c, "conflict", 409);
    return back(c);
  });

  onLocalized(app, "get", "/hub/portfolio/:id", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    return page(c, <PortfolioEditPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} values={portfolioValuesFromItem(item)} errors={{}} />);
  });

  onLocalized(app, "post", "/hub/portfolio/:id", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const values = portfolioValuesFromBody(await c.req.parseBody());
    const parsed = parsePortfolioItem(values);
    if (!parsed.ok) return page(c, <PortfolioEditPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} values={values} errors={parsed.errors} />, 400);
    await updatePortfolioItem(c.env.DB, { builderId: item.builderId, id: item.id, item: parsed.item, now: new Date().toISOString() });
    return back(c);
  });

  onLocalized(app, "post", "/hub/portfolio/:id/delete", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    await deletePortfolioItem(c.env.DB, item.builderId, item.id);
    return back(c);
  });

  onLocalized(app, "post", "/hub/portfolio/:id/move", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const direction = (await c.req.parseBody()).direction;
    // An unknown direction or a move past the edge is a no-op.
    if (direction === "up" || direction === "down") {
      await movePortfolioItem(c.env.DB, { builderId: item.builderId, id: item.id, direction, now: new Date().toISOString() });
    }
    return back(c);
  });
}
