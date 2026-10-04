import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { endRequestBatch, findClientRequest } from "../db/requests.ts";
import { requestTransition, type ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInviteExpired, notifyNotSelected } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { RequestPage } from "../views/me/RequestPage.tsx";
import { page } from "../views/render.ts";
import { openPendingRequest } from "./request-confirm.ts";

/** The client's request page. Task 6 adds the proposals. `findClientRequest` already limits it to the owner and hides `removed`. */
export async function requestPage(c: Context<AppEnv>, request: ClientRequest, status: 200 | 400 = 200) {
  return page(c, <RequestPage locale={c.get("locale")} origin={requestOrigin(c)} request={request} sent={c.req.query("sent") === "1"} />, status);
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
}
