import { ulid } from "../lib/ulid.ts";
import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { createInquiryStatements } from "../db/inquiries.ts";
import { findPublicationByRequestId, optInStatement, publicationAuditGuard, reOptInStatement, returnedPublication, withdrawStatement } from "../db/request-board.ts";
import { endRequestBatch, findClientRequest, listRequestInvites, markInviteSelectedStatement } from "../db/requests.ts";
import { clientBoardActions, requestVisibility } from "../domain/request-board.ts";
import { inviteTransition, requestTransition, type ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { notifyInviteExpired, notifyNotSelected } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { Proposals } from "../views/me/Proposals.tsx";
import type { ListingView } from "../views/me/PublicListingBlock.tsx";
import { RequestPage } from "../views/me/RequestPage.tsx";
import { requestFirstMessage } from "../views/proposal.ts";
import { page } from "../views/render.ts";
import { openPendingRequest } from "./request-confirm.ts";

/**
 * The client's request page with its proposals and its "Public listing" block. `findClientRequest` already limits it to the owner and hides `removed`.
 * `conflict` is a refused opt-in or withdrawal (409): the same page, current state, under the shared error summary (VNX-0807).
 */
export async function requestPage(c: Context<AppEnv>, request: ClientRequest, status: 200 | 400 | 409 = 200, conflict = false) {
  const locale = c.get("locale");
  const [proposals, publication] = await Promise.all([listRequestInvites(c.env.DB, request.id), findPublicationByRequestId(c.env.DB, request.id)]);
  const gate = c.get("requestBoard");
  const visible = publication !== null && gate && requestVisibility(request.status, publication.status, request.closedAt, new Date()) !== "hidden";
  // A projection: the public wording only while published, the public id only while the page can be opened, the Ops note only on an ended listing.
  const listing: ListingView | null = publication && {
    status: publication.status,
    publicId: visible ? publication.publicId : null,
    publicTitle: publication.status === "published" ? publication.publicTitle : null,
    publicDescription: publication.status === "published" ? publication.publicDescription : null,
    reviewNote: publication.status === "rejected" || publication.status === "unpublished" ? publication.reviewNote : null,
  };
  return page(
    c,
    <RequestPage locale={locale} origin={requestOrigin(c)} request={request} sent={c.req.query("sent") === "1"} listing={listing} boardActions={clientBoardActions(publication?.status ?? null, request.status, gate)} conflict={conflict}>
      <Proposals locale={locale} request={request} proposals={proposals} />
    </RequestPage>,
    status,
  );
}

async function load(c: Context<AppEnv>): Promise<ClientRequest | null> {
  return findClientRequest(c.env.DB, c.get("user")!.id, c.req.param("id") ?? "");
}

/** A refused opt-in or withdrawal: nothing was written; the page is the state as it is now (never the click that lost). */
async function boardConflict(c: Context<AppEnv>) {
  // Reloaded: a request removed in the gap is a 404 like everywhere else on /me (findClientRequest hides it).
  const current = await load(c);
  return current ? requestPage(c, current, 409, true) : errorResponse(c, "notFound", 404);
}

export function registerMeRequestRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me/requests/:id", requireUser, async (c) => {
    const request = await load(c);
    return request ? requestPage(c, request) : errorResponse(c, "notFound", 404);
  });

  /**
   * VNX-2703b (addendum 4.3, Q2, Q6): the client opts in later, or opts in again after withdrawing. ONE batch: the publication write (INSERT or
   * compare-and-set, owner enforced in the SQL) and its audit row, which is written only when that write returned a row. The gate must be on (404 otherwise);
   * the request must be open and the publication none or withdrawn (clientBoardActions); anything else, or a lost race, is a 409 that writes nothing.
   * Not a staff action: an OAuth session of the owner may do it (ADR-012).
   */
  onLocalized(app, "post", "/me/requests/:id/publication/opt-in", requireUser, async (c) => {
    if (!c.get("requestBoard")) return errorResponse(c, "notFound", 404);
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    const user = c.get("user")!;
    const publication = await findPublicationByRequestId(c.env.DB, request.id);
    const action = clientBoardActions(publication?.status ?? null, request.status, true).find((a) => a === "opt_in" || a === "re_opt_in");
    if (!action) return boardConflict(c);
    const now = new Date().toISOString();
    const consentVersion = c.env.REQUEST_BOARD_GO_LIVE ?? "";
    const writeId = ulid();
    const change =
      action === "opt_in"
        ? optInStatement(c.env.DB, { requestId: request.id, consentVersion, now, clientUserId: user.id, writeId })
        : reOptInStatement(c.env.DB, { requestId: request.id, expectedUpdatedAt: publication!.updatedAt, consentVersion, now, clientUserId: user.id, writeId });
    const results = await c.env.DB.batch([
      change,
      auditStatement(
        c.env.DB,
        { actorUserId: user.id, action: action === "opt_in" ? "request_publication.opt_in" : "request_publication.re_opt_in", entity: "request_publication", entityId: request.id, data: { consentVersion }, now },
        publicationAuditGuard({ requestId: request.id, writeId }),
      ),
    ]);
    // 0 rows: the request or the publication changed since the page was read. Nothing was written, not even the audit row.
    if (!returnedPublication(results[0])) return boardConflict(c);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });

  /**
   * VNX-2703b (Q5, addendum 7.1): the client withdraws consent, pending_review or published -> withdrawn, effective at once. It never reads the flag
   * and never looks at the request's status (withdrawing consent always works); the owner is enforced in the SQL. The expected `updated_at` is the
   * publication as read now, not a token from the page: the client's intent (take it down) holds whatever Ops did in between. One batch with the guarded audit row.
   */
  onLocalized(app, "post", "/me/requests/:id/publication/withdraw", requireUser, async (c) => {
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    const user = c.get("user")!;
    const publication = await findPublicationByRequestId(c.env.DB, request.id);
    if (!publication || !clientBoardActions(publication.status, request.status, c.get("requestBoard")).includes("withdraw")) return boardConflict(c);
    const now = new Date().toISOString();
    const writeId = ulid();
    const results = await c.env.DB.batch([
      withdrawStatement(c.env.DB, { requestId: request.id, expectedUpdatedAt: publication.updatedAt, now, clientUserId: user.id, writeId }),
      auditStatement(
        c.env.DB,
        { actorUserId: user.id, action: "request_publication.withdraw", entity: "request_publication", entityId: request.id, data: { from: publication.status }, now },
        publicationAuditGuard({ requestId: request.id, writeId }),
      ),
    ]);
    if (!returnedPublication(results[0])) return boardConflict(c);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });

  // "Send now": the session proves the e-mail, same rule as the link (domain "verify"). openPendingRequest does not check
  // who owns the request (Task 2 review), so it is checked here first: someone else's, removed or missing = 404, nothing written.
  onLocalized(app, "post", "/me/requests/:id/confirm", requireUser, async (c) => {
    const user = c.get("user")!;
    const request = await load(c);
    if (!request || request.clientUserId !== user.id) return errorResponse(c, "notFound", 404);
    if (request.status !== "pending_verification") return errorResponse(c, "conflict", 409);
    if (!(await openPendingRequest(c, request, user, new Date(), "me"))) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });

  // Spec §7.5: the client closes a submitted or matching request; invitations settle in the same batch.
  onLocalized(app, "post", "/me/requests/:id/close", requireUser, async (c) => {
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    if (!requestTransition(request.status, "close", "client").ok) return errorResponse(c, "conflict", 409);
    const iso = new Date().toISOString();
    const end = endRequestBatch(c.env.DB, { id: request.id, from: request.status, to: "closed", now: iso });
    const results = await c.env.DB.batch([
      ...end.statements,
      auditStatement(c.env.DB, { actorUserId: c.get("user")!.id, action: "request.close", entity: "request", entityId: request.id, data: { from: request.status }, now: iso }, { requestId: request.id, status: "closed", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) return errorResponse(c, "conflict", 409);
    // Proposals that were not selected and invitations that lapsed each get their own neutral e-mail.
    await notifyNotSelected(c.env, outcome.notSelected);
    await notifyInviteExpired(c.env, outcome.expired);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });

  /**
   * Spec §5.7 step 4 / §7.5 / §7.6, ONE batch: request matching -> builder_selected (compare-and-set), the inquiry and its
   * first message (guarded on that), the chosen invitation -> selected, the rest settled, the audit row (guarded on the
   * inquiry this batch made). A lost race writes nothing. After the commit the builder's "chosen" e-mail goes out as the
   * inquiry's first notification (the M5 daily job retries it) and the other builders are told.
   */
  onLocalized(app, "post", "/me/requests/:id/select", requireUser, async (c) => {
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const inviteId = typeof body.invite === "string" ? body.invite : "";
    // Looked up among THIS request's invitations: another request's id reads as missing (Review Focus 2).
    const chosen = (await listRequestInvites(c.env.DB, request.id)).find((x) => x.invite.id === inviteId);
    if (!chosen) return errorResponse(c, "notFound", 404);
    if (!requestTransition(request.status, "select", "client").ok || !inviteTransition(chosen.invite.status, "select", "client").ok || !chosen.builderPublic) {
      return errorResponse(c, "conflict", 409);
    }
    const user = c.get("user")!;
    const now = new Date();
    const iso = now.toISOString();
    const inquiry = createInquiryStatements(
      c.env.DB,
      { clientUserId: user.id, clientName: request.clientName, builderId: chosen.invite.builderId, productId: null, requestId: request.id, type: "request", message: requestFirstMessage(request, chosen.invite), budgetBand: request.budgetBand, deadline: request.deadline, status: "open", locale: request.locale, now: iso },
      { requestId: request.id, inviteId: chosen.invite.id, updatedAt: iso },
    );
    const end = endRequestBatch(c.env.DB, { id: request.id, from: request.status, to: "builder_selected", now: iso, selectedInviteId: chosen.invite.id }, [
      ...inquiry.statements,
      markInviteSelectedStatement(c.env.DB, { inviteId: chosen.invite.id, requestId: request.id, inquiryId: inquiry.id, now: iso }),
    ]);
    const results = await c.env.DB.batch([
      ...end.statements,
      auditStatement(c.env.DB, { actorUserId: user.id, action: "request.select", entity: "request", entityId: request.id, data: { inviteId: chosen.invite.id, inquiryId: inquiry.id }, now: iso }, { inquiryId: inquiry.id, status: "open", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) return errorResponse(c, "conflict", 409);
    await notifyInquiryMessage(c.env, inquiry.firstMessageId, now);
    await notifyNotSelected(c.env, outcome.notSelected);
    await notifyInviteExpired(c.env, outcome.expired);
    return c.redirect(localizedPath(c.get("locale"), `/me/inquiries/${inquiry.id}`), 303);
  });
}
