import type { Context, Hono } from "hono";
import { findPublicListing, findViewerRelation, listOpenPublications, countOpenPublications, type BoardFilter } from "../db/request-board.ts";
import { BOARD_PAGE_SIZE, isPublicIdShape, parseBoardQuery, requestVisibility } from "../domain/request-board.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";
import { BoardPage } from "../views/requests/BoardPage.tsx";
import type { Cta } from "../views/requests/InterestBlock.tsx";
import { RequestDetail } from "../views/requests/RequestDetail.tsx";

/**
 * EPIC 27 (VNX-2705a, addendum §4.1, §4.2, §7.3): the public request board. Both routes read through `findPublicListing` / `listOpenPublications` only
 * (never the publication row, which has the request id) and decide visibility with `requestVisibility`; hidden is a plain 404, the same as "no such listing".
 * Gate off: 404. A signed-out response carries no cache header (the signed-in one is no-store from the site middleware). ADR-004: one order, no paid position.
 */
export function registerRequestBoardRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/requests", async (c) => {
    if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
    const query = parseBoardQuery(c.req.query());
    const filter: BoardFilter = { category: query.category ?? undefined, budget: query.budget ?? undefined, lang: query.lang ?? undefined };
    const now = new Date();
    const [listed, total] = await Promise.all([listOpenPublications(c.env.DB, filter, BOARD_PAGE_SIZE, (query.page - 1) * BOARD_PAGE_SIZE), countOpenPublications(c.env.DB, filter)]);
    // The SQL already limits to open; the one visibility function has the last word.
    const items = listed.filter((l) => l.publicTitle !== null && l.publicDescription !== null && requestVisibility(l.requestStatus, l.publicationStatus, l.closedAt, now) === "open");
    if (query.page > 1 && items.length === 0) return errorResponse(c, "notFound", 404);
    return page(c, <BoardPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} items={items} total={total} signedIn={c.get("user") !== null} />);
  });

  onLocalized(app, "get", "/requests/:publicId", async (c) => {
    if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
    const publicId = c.req.param("publicId") ?? "";
    if (!isPublicIdShape(publicId)) return errorResponse(c, "notFound", 404);
    const listing = await findPublicListing(c.env.DB, publicId);
    const visibility = listing ? requestVisibility(listing.requestStatus, listing.publicationStatus, listing.closedAt, new Date()) : "hidden";
    if (!listing || visibility === "hidden" || listing.publicTitle === null || listing.publicDescription === null) return errorResponse(c, "notFound", 404);
    const locale = c.get("locale");
    const cta = await callToAction(c, publicId, visibility === "closed", localizedPath(locale, `/requests/${publicId}`));
    return page(c, <RequestDetail locale={locale} origin={siteOrigin(c)} item={listing} closed={visibility === "closed"} cta={cta} signedIn={c.get("user") !== null} />);
  });
}

/** §4.2. The viewer relation (H2) is read only for a signed-in viewer and only when the listing is open: a closed page has the one fixed message. */
async function callToAction(c: Context<AppEnv>, publicId: string, closed: boolean, here: string): Promise<Cta> {
  if (closed) return { kind: "closed" };
  const user = c.get("user");
  if (!user) return { kind: "signed_out", next: here };
  const relation = await findViewerRelation(c.env.DB, publicId, user.id);
  if (relation.ownRequestId) return { kind: "own", href: localizedPath(c.get("locale"), `/me/requests/${relation.ownRequestId}`) };
  if (relation.builder === "approved") return { kind: "approved" };
  return relation.builder === "none" ? { kind: "not_builder" } : { kind: "pending_builder" };
}
