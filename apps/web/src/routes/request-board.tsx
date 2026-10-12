import type { Context, Hono } from "hono";
import { auditStatement } from "../db/audit.ts";
import {
  countOpenPublications,
  createInterestStatement,
  diagnoseInterestRefusal,
  findInterestById,
  findPublicListing,
  findViewerRelation,
  interestAuditGuard,
  listOpenPublications,
  returnedInterest,
  withdrawInterestStatement,
  type BoardFilter,
  type PublicListing,
  type ViewerRelation,
} from "../db/request-board.ts";
import {
  BOARD_PAGE_SIZE,
  INTEREST_DAILY_LIMIT,
  INTEREST_PENDING_CAP,
  interestTransition,
  isBoardIndexable,
  isPublicIdShape,
  parseBoardQuery,
  parseInterestForm,
  requestVisibility,
  type Visibility,
} from "../domain/request-board.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { localizedPath } from "../i18n/locales.ts";
import { ulid } from "../lib/ulid.ts";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";
import { BoardPage } from "../views/requests/BoardPage.tsx";
import type { Cta, InterestProblem, InterestValues } from "../views/requests/InterestBlock.tsx";
import type { BoardItem } from "../views/requests/RequestCard.tsx";
import { RequestDetail } from "../views/requests/RequestDetail.tsx";

/**
 * EPIC 27 (VNX-2705a, addendum §4.1, §4.2, §7.3): the public request board. Both routes read through `findPublicListing` / `listOpenPublications` only
 * (never the publication row, which has the request id) and decide visibility with `requestVisibility`; hidden is a plain 404, the same as "no such listing".
 * Gate off: 404. A signed-out response carries no cache header (the signed-in one is no-store from the site middleware). ADR-004: one order, no paid position.
 * VNX-2706a adds the builder's "I'm interested" (POST) and its withdrawal.
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
    // Q13: index the list only with at least 5 open listings, and never a filtered view (a thin duplicate of the list). Unfiltered, `total` already is
    // countOpenPublicationsAll (same query), so the decision costs no extra D1 read.
    const filtered = filter.category !== undefined || filter.budget !== undefined || filter.lang !== undefined;
    const indexable = !filtered && isBoardIndexable(total);
    return page(c, <BoardPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} items={items.map(toBoardItem)} total={total} indexable={indexable} signedIn={c.get("user") !== null} />);
  });

  onLocalized(app, "get", "/requests/:publicId", async (c) => {
    if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
    const publicId = c.req.param("publicId") ?? "";
    if (!isPublicIdShape(publicId)) return errorResponse(c, "notFound", 404);
    const listing = await findPublicListing(c.env.DB, publicId);
    const visibility = listing ? requestVisibility(listing.requestStatus, listing.publicationStatus, listing.closedAt, new Date()) : "hidden";
    if (!listing || visibility === "hidden" || listing.publicTitle === null || listing.publicDescription === null) return errorResponse(c, "notFound", 404);
    const cta = await callToAction(c, publicId, visibility === "closed", localizedPath(c.get("locale"), `/requests/${publicId}`));
    return detailPage(c, listing, visibility, cta);
  });

  // VNX-2706a (addendum 3.3, 4.2, 9.1): a builder tells the VNX.SI team they are interested. It creates no invitation, sends no e-mail, changes no request.
  onLocalized(app, "post", "/requests/:publicId/interest", (c) => postInterest(c));
  onLocalized(app, "post", "/requests/:publicId/interest/withdraw", (c) => postWithdraw(c));
}

/**
 * S-1: the one place a listing becomes what a view may see. Explicit keys, so a field added to PublicListing later (and `requestStatus` above all,
 * which would tell a page how a request ended) cannot reach a card or the detail page by spreading.
 */
function toBoardItem(l: PublicListing): BoardItem {
  return {
    publicId: l.publicId,
    publicTitle: l.publicTitle,
    publicDescription: l.publicDescription,
    publishedAt: l.publishedAt,
    category: l.category,
    budgetBand: l.budgetBand,
    country: l.country,
    deadline: l.deadline,
    languages: l.languages,
  };
}

type DetailStatus = 200 | 400 | 409 | 429;

function detailPage(c: Context<AppEnv>, listing: PublicListing, visibility: Visibility, cta: Cta, problems: readonly InterestProblem[] = [], status: DetailStatus = 200) {
  return page(c, <RequestDetail locale={c.get("locale")} origin={siteOrigin(c)} item={toBoardItem(listing)} closed={visibility === "closed"} cta={cta} problems={problems} signedIn={c.get("user") !== null} />, status);
}

const EMPTY_VALUES: InterestValues = { note: "", productId: "" };

/** §4.2 for a signed-in viewer, from the one viewer relation. `values` are what the builder typed (kept when the form comes back with an error). */
function ctaFromRelation(c: Context<AppEnv>, relation: ViewerRelation, values: InterestValues = EMPTY_VALUES): Cta {
  const locale = c.get("locale");
  if (relation.ownRequestId) return { kind: "own", href: localizedPath(locale, `/me/requests/${relation.ownRequestId}`) };
  if (relation.builder === "none") return { kind: "not_builder" };
  if (relation.builder !== "approved") return { kind: "pending_builder" };
  if (relation.inviteId) return { kind: "approved", state: "invited", href: localizedPath(locale, `/hub/invitations/${relation.inviteId}`) };
  const status = relation.interest?.status;
  if (status === "pending") return { kind: "approved", state: "pending" };
  if (status === "dismissed" || status === "withdrawn") return { kind: "approved", state: status };
  // `invited` without an invitation row cannot happen (one batch writes both); the Hub list is the honest place to send them.
  if (status === "invited") return { kind: "approved", state: "invited", href: localizedPath(locale, "/hub/invitations") };
  return { kind: "approved", state: "form", products: relation.products, values };
}

/** §4.2. The viewer relation (H2) is read only for a signed-in viewer and only when the listing is open: a closed page has the one fixed message. */
async function callToAction(c: Context<AppEnv>, publicId: string, closed: boolean, here: string): Promise<Cta> {
  if (closed) return { kind: "closed" };
  const user = c.get("user");
  if (!user) return { kind: "signed_out", next: here };
  return ctaFromRelation(c, await findViewerRelation(c.env.DB, publicId, user.id));
}

const loginRedirect = (c: Context<AppEnv>, here: string) => c.redirect(`${localizedPath(c.get("locale"), "/login")}?next=${encodeURIComponent(here)}`, 303);

/**
 * POST /requests/:publicId/interest. Order (plan 2706a): gate, listing (hidden 404, closed 409), signed out to /login, eligibility (409), form (400),
 * the day's limit (429, only for a valid form), then ONE batch: the INSERT (every gate again, in SQL, by public id) and its audit row guarded by this write's id.
 */
async function postInterest(c: Context<AppEnv>) {
  if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
  const publicId = c.req.param("publicId") ?? "";
  if (!isPublicIdShape(publicId)) return errorResponse(c, "notFound", 404);
  const listing = await findPublicListing(c.env.DB, publicId);
  const visibility = listing ? requestVisibility(listing.requestStatus, listing.publicationStatus, listing.closedAt, new Date()) : "hidden";
  if (!listing || visibility === "hidden" || listing.publicTitle === null || listing.publicDescription === null) return errorResponse(c, "notFound", 404);
  const here = localizedPath(c.get("locale"), `/requests/${publicId}`);
  const user = c.get("user");
  if (visibility === "closed") return detailPage(c, listing, visibility, { kind: "closed" }, [{ field: null, key: "board.interest.closed" }], 409);
  if (!user) return loginRedirect(c, here);

  const relation = await findViewerRelation(c.env.DB, publicId, user.id);
  const refuse = (status: 400 | 409 | 429, problems: InterestProblem[], values?: InterestValues, from: ViewerRelation = relation) =>
    detailPage(c, listing, visibility, ctaFromRelation(c, from, values), problems, status);
  if (relation.ownRequestId || relation.builder !== "approved") return refuse(409, [{ field: null, key: "board.interest.notEligible" }]);
  if (relation.inviteId) return refuse(409, [{ field: null, key: "board.interest.alreadyInvited" }]);
  if (relation.interest) return refuse(409, [{ field: null, key: "board.interest.already" }]);

  const body = await c.req.parseBody();
  const values: InterestValues = { note: typeof body.note === "string" ? body.note : "", productId: typeof body.productId === "string" ? body.productId : "" };
  const parsed = parseInterestForm(values);
  if (!parsed.ok) {
    const problems: InterestProblem[] = [];
    if (parsed.errors.note) problems.push({ field: "note", key: parsed.errors.note === "too_long" ? "board.interest.error.noteTooLong" : "board.interest.error.noteInvalid" });
    if (parsed.errors.productId) problems.push({ field: "product", key: "board.interest.error.product" });
    return refuse(400, problems, values);
  }
  // Only a valid form counts against the day.
  const hit = await hitRateLimit(c.env.DB, `interest:builder:${user.id}`, INTEREST_DAILY_LIMIT, 86400, Date.now());
  if (!hit.allowed) return refuse(429, [{ field: null, key: "board.interest.rateLimited", n: INTEREST_DAILY_LIMIT }], values);

  // A fresh id and write id for THIS write (VNX-2702c): the audit row exists only if this batch's INSERT went through.
  const interestId = ulid();
  const writeId = ulid();
  const now = new Date().toISOString();
  const [created] = await c.env.DB.batch([
    createInterestStatement(c.env.DB, { id: interestId, writeId, publicId, builderId: user.id, note: parsed.input.note, productId: parsed.input.productId, now, pendingCap: INTEREST_PENDING_CAP }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "request_interest.create", entity: "request_interest", entityId: interestId, data: { publicId }, now }, interestAuditGuard({ interestId, writeId })),
  ]);
  if (returnedInterest(created)) return c.redirect(here, 303);

  // Refused in SQL: say why as far as the message needs it. The INSERT alone decided.
  const [fresh, why] = await Promise.all([
    findViewerRelation(c.env.DB, publicId, user.id),
    diagnoseInterestRefusal(c.env.DB, { builderId: user.id, productId: parsed.input.productId, pendingCap: INTEREST_PENDING_CAP }),
  ]);
  if (fresh.inviteId) return refuse(409, [{ field: null, key: "board.interest.alreadyInvited" }], values, fresh);
  if (fresh.interest) return refuse(409, [{ field: null, key: "board.interest.already" }], values, fresh);
  if (why.badProduct) return refuse(409, [{ field: "product", key: "board.interest.error.product" }], values, fresh);
  if (why.capped) return refuse(409, [{ field: null, key: "board.interest.capReached", n: INTEREST_PENDING_CAP }], values, fresh);
  return refuse(409, [{ field: null, key: "board.interest.conflict" }], values, fresh);
}

/**
 * POST /requests/:publicId/interest/withdraw. pending -> withdrawn, only the signed-in builder's own interest (none of theirs: 404).
 * L4: allowed whatever the request's state, closed or no longer public (there the answer goes to the Hub, the page being gone).
 */
async function postWithdraw(c: Context<AppEnv>) {
  if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
  const publicId = c.req.param("publicId") ?? "";
  if (!isPublicIdShape(publicId)) return errorResponse(c, "notFound", 404);
  const locale = c.get("locale");
  const here = localizedPath(locale, `/requests/${publicId}`);
  const user = c.get("user");
  if (!user) return loginRedirect(c, here);
  const relation = await findViewerRelation(c.env.DB, publicId, user.id);
  const mine = relation.interest ? await findInterestById(c.env.DB, relation.interest.id) : null;
  if (!mine || mine.builderId !== user.id) return errorResponse(c, "notFound", 404);
  const listing = await findPublicListing(c.env.DB, publicId);
  const visibility = listing ? requestVisibility(listing.requestStatus, listing.publicationStatus, listing.closedAt, new Date()) : "hidden";
  const shown = listing !== null && visibility !== "hidden" && listing.publicTitle !== null && listing.publicDescription !== null;
  const conflict = () => (shown ? detailPage(c, listing, visibility, ctaFromRelation(c, relation), [{ field: null, key: "board.interest.conflict" }], 409) : errorResponse(c, "conflict", 409));
  if (!interestTransition(mine.status, "withdraw", "builder").ok) return conflict();
  const writeId = ulid();
  const now = new Date().toISOString();
  const [moved] = await c.env.DB.batch([
    withdrawInterestStatement(c.env.DB, { interestId: mine.id, builderId: user.id, expectedUpdatedAt: mine.updatedAt, now, writeId }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "request_interest.withdraw", entity: "request_interest", entityId: mine.id, data: { publicId }, now }, interestAuditGuard({ interestId: mine.id, writeId })),
  ]);
  if (!returnedInterest(moved)) return conflict();
  return c.redirect(shown ? here : localizedPath(locale, "/hub/invitations"), 303);
}
