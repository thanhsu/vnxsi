import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { createInquiryStatements } from "../db/inquiries.ts";
import { endRequestBatch, findClientRequest, listRequestInvites, markInviteSelectedStatement } from "../db/requests.ts";
import { inviteTransition, requestTransition, type ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { notifyInviteExpired, notifyNotSelected } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { Proposals } from "../views/me/Proposals.tsx";
import { RequestPage } from "../views/me/RequestPage.tsx";
import { requestFirstMessage } from "../views/proposal.ts";
import { page } from "../views/render.ts";
import { openPendingRequest } from "./request-confirm.ts";

/** The client's request page with its proposals. `findClientRequest` already limits it to the owner and hides `removed`. */
export async function requestPage(c: Context<AppEnv>, request: ClientRequest, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const proposals = await listRequestInvites(c.env.DB, request.id);
  return page(
    c,
    <RequestPage locale={locale} origin={requestOrigin(c)} request={request} sent={c.req.query("sent") === "1"}>
      <Proposals locale={locale} request={request} proposals={proposals} />
    </RequestPage>,
    status,
  );
}

async function load(c: Context<AppEnv>): Promise<ClientRequest | null> {
  return findClientRequest(c.env.DB, c.get("user")!.id, c.req.param("id") ?? "");
}

export function registerMeRequestRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me/requests/:id", requireUser, async (c) => {
    const request = await load(c);
    return request ? requestPage(c, request) : errorResponse(c, "notFound", 404);
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
