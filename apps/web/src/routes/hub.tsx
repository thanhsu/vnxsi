import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { countOpenInquiries } from "../db/inquiries.ts";
import { writeAudit } from "../db/audit.ts";
import { setBuilderStatus, updateBuilderProfile } from "../db/builders.ts";
import { listIdentitiesForUser, setShowOnProfile } from "../db/identities.ts";
import { countBuilderProductsByStatus } from "../db/products.ts";
import { countPendingInvitations } from "../db/requests.ts";
import { canChangeHandle, canEditProfile, transition } from "../domain/builder.ts";
import { isBadgeProvider } from "../domain/identity.ts";
import { formValuesFromBody, formValuesFromProfile, parseBuilderProfile, type BuilderFormValues, type FieldErrors } from "../domain/builder-input.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { OverviewPage } from "../views/hub/OverviewPage.tsx";
import { BADGE_NOTICES, ProfilePage } from "../views/hub/ProfilePage.tsx";
import { page } from "../views/render.ts";
import { availableProviders } from "./oauth.tsx";

async function profilePage(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200, saved = false) {
  const builder = c.get("builder");
  // Owner E1: a provider whose flag is off (or that is not configured) has no switch; the stored choice is untouched.
  const available = await availableProviders(c);
  const badges = (await listIdentitiesForUser(c.env.DB, builder.userId)).filter((i) => isBadgeProvider(i.provider) && available.includes(i.provider));
  const raw = c.req.query("badge");
  const badgeNotice = BADGE_NOTICES.find((n) => n === raw) ?? null;
  return page(c, <ProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} values={values} errors={errors} saved={saved} badges={badges} badgeNotice={badgeNotice} />, status);
}

export function registerHubRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub", requireBuilder, async (c) => {
    const builder = c.get("builder");
    const [productCounts, openInquiries, pendingInvitations] = await Promise.all([
      countBuilderProductsByStatus(c.env.DB, builder.userId),
      countOpenInquiries(c.env.DB, builder.userId),
      countPendingInvitations(c.env.DB, builder.userId),
    ]);
    return page(c, <OverviewPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} productCounts={productCounts} openInquiries={openInquiries} pendingInvitations={pendingInvitations} />);
  });

  onLocalized(app, "get", "/hub/profile", requireBuilder, (c) =>
    profilePage(c, formValuesFromProfile(c.get("builder")), {}, 200, c.req.query("saved") === "1"),
  );

  onLocalized(app, "post", "/hub/profile", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const values = formValuesFromBody(await c.req.parseBody({ all: true }));
    // Owner decision 2026-10-03: the handle is locked once approved; ignore whatever was posted.
    if (!canChangeHandle(builder.status)) values.handle = builder.handle;
    const parsed = parseBuilderProfile(values);
    if (!parsed.ok) return profilePage(c, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const result = await updateBuilderProfile(c.env.DB, { userId: builder.userId, expectedStatus: builder.status, profile: parsed.profile, now });
    if (result === "handle_taken") return profilePage(c, values, { handle: "taken" }, 409);
    if (result === "stale") return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "builder.profile_update", entity: "builder", entityId: builder.userId, now });
    return c.redirect(localizedPath(c.get("locale"), "/hub/profile?saved=1"), 303);
  });

  // VNX-2606a. The builder's opt-in for the public badge (ADR-012 §5). Deliberately NO canEditProfile and NO provider-flag check: a consent setting, not a profile edit;
  // any builder status may switch it both ways (Reviewer ruling), and it has no public effect until `approved`.
  // `google` is 404 (it never has a switch). Only the caller's own row is touched; the answer is a 303 to the same site and never carries the label.
  onLocalized(app, "post", "/hub/identities/:provider/badge", requireBuilder, async (c) => {
    const provider = c.req.param("provider");
    if (!isBadgeProvider(provider)) return errorResponse(c, "notFound", 404);
    const show = (await c.req.parseBody())["show"];
    if (show !== "1" && show !== "0") return errorResponse(c, "conflict", 409);
    const result = await setShowOnProfile(c.env.DB, { userId: c.get("builder").userId, provider, show: show === "1", now: new Date().toISOString() });
    const notice = result === "not_linked" ? "notLinked" : show === "1" ? "shown" : "hidden";
    return c.redirect(`${localizedPath(c.get("locale"), "/hub/profile")}?badge=${notice}#badges`, 303);
  });

  onLocalized(app, "post", "/hub/resubmit", requireBuilder, async (c) => {
    const builder = c.get("builder");
    const next = transition(builder.status, "resubmit", "owner");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    const now = new Date().toISOString();
    const updated = await setBuilderStatus(c.env.DB, { userId: builder.userId, from: builder.status, to: next.status, reviewNote: null, now });
    if (!updated) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "builder.resubmit", entity: "builder", entityId: builder.userId, data: { from: builder.status, to: next.status }, now });
    return c.redirect(localizedPath(c.get("locale"), "/hub"), 303);
  });
}
