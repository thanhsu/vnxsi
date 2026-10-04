import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { declineInviteStatement, findBuilderInvitation, listBuilderInvitations, proposeStatement, returnedInvite } from "../db/requests.ts";
import { parseDeclineReason } from "../domain/inquiry.ts";
import { inviteTransition, parseProposal, proposalValuesFromBody, type Invitation } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyProposal } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InvitationListPage, InvitationPage } from "../views/hub/InvitationsPage.tsx";
import { page } from "../views/render.ts";

type Extra = Omit<Parameters<typeof InvitationPage>[0], "locale" | "origin" | "item" | "approved">;

function invitationPage(c: Context<AppEnv>, item: Invitation, extra: Extra = {}, status: 200 | 400 = 200) {
  return page(c, <InvitationPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} approved={c.get("builder").status === "approved"} {...extra} />, status);
}

/**
 * Spec §5.7 step 3 / §7.6: propose or decline. The route reads first (404 for anything that is not this builder's
 * invitation, 409 unless invited + matching + approved); the compare-and-set repeats those checks in SQL and the audit
 * row is guarded by it, in one batch: a lost race writes nothing, sends nothing and is a 409.
 */
async function respond(c: Context<AppEnv>, action: "propose" | "decline") {
  const builder = c.get("builder");
  const item = await findBuilderInvitation(c.env.DB, builder.userId, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);
  const next = inviteTransition(item.invite.status, action, "builder");
  if (builder.status !== "approved" || !next.ok || item.request.status !== "matching") return errorResponse(c, "conflict", 409);

  const body = await c.req.parseBody();
  const now = new Date().toISOString();
  let statement: D1PreparedStatement;
  if (action === "propose") {
    const values = proposalValuesFromBody(body);
    const parsed = parseProposal(values);
    if (!parsed.ok) return invitationPage(c, item, { values, errors: parsed.errors }, 400);
    statement = proposeStatement(c.env.DB, { inviteId: item.invite.id, builderId: builder.userId, proposal: parsed.input, now });
  } else {
    const reason = parseDeclineReason(body.reason);
    if (!reason.ok) return invitationPage(c, item, { reason: typeof body.reason === "string" ? body.reason : "", reasonError: true }, 400);
    statement = declineInviteStatement(c.env.DB, { inviteId: item.invite.id, builderId: builder.userId, reason: reason.reason, now });
  }
  const [moved] = await c.env.DB.batch([
    statement,
    auditStatement(c.env.DB, { actorUserId: builder.userId, action: `request_invite.${action}`, entity: "request_invite", entityId: item.invite.id, data: { requestId: item.request.id }, now }, { inviteId: item.invite.id, status: next.status, updatedAt: now }),
  ]);
  if (!returnedInvite(moved)) return errorResponse(c, "conflict", 409);
  // Declining sends nothing to the client (plan M6). A proposal tells the client; notifyProposal never throws.
  if (action === "propose") await notifyProposal(c.env, item.invite.id);
  return c.redirect(localizedPath(c.get("locale"), `/hub/invitations/${item.invite.id}`), 303);
}

export function registerHubInvitationRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/invitations", requireBuilder, async (c) => {
    const items = await listBuilderInvitations(c.env.DB, c.get("builder").userId);
    return page(c, <InvitationListPage locale={c.get("locale")} origin={requestOrigin(c)} items={items} />);
  });

  onLocalized(app, "get", "/hub/invitations/:id", requireBuilder, async (c) => {
    const item = await findBuilderInvitation(c.env.DB, c.get("builder").userId, c.req.param("id") ?? "");
    return item ? invitationPage(c, item) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/hub/invitations/:id/propose", requireBuilder, (c) => respond(c, "propose"));
  onLocalized(app, "post", "/hub/invitations/:id/decline", requireBuilder, (c) => respond(c, "decline"));
}
