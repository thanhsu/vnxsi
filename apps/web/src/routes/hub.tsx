import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { setBuilderStatus, updateBuilderProfile } from "../db/builders.ts";
import { countBuilderProductsByStatus } from "../db/products.ts";
import { canChangeHandle, canEditProfile, transition } from "../domain/builder.ts";
import { formValuesFromBody, formValuesFromProfile, parseBuilderProfile, type BuilderFormValues, type FieldErrors } from "../domain/builder-input.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { OverviewPage } from "../views/hub/OverviewPage.tsx";
import { ProfilePage } from "../views/hub/ProfilePage.tsx";
import { page } from "../views/render.ts";

function profilePage(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200, saved = false) {
  return page(c, <ProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={c.get("builder")} values={values} errors={errors} saved={saved} />, status);
}

export function registerHubRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub", requireBuilder, async (c) => {
    const builder = c.get("builder");
    const productCounts = await countBuilderProductsByStatus(c.env.DB, builder.userId);
    return page(c, <OverviewPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} productCounts={productCounts} />);
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
