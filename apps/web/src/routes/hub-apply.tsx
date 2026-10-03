import type { Context, Hono } from "hono";
import { clearInviteCookie, readInviteCookie } from "../auth/invite-cookie.ts";
import { requireUser } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { createBuilder, findBuilderByUserId } from "../db/builders.ts";
import { findInvite } from "../db/invites.ts";
import { formValuesFromBody, parseBuilderProfile, type BuilderFormValues, type FieldErrors } from "../domain/builder-input.ts";
import { inviteState } from "../domain/invite.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { ApplyPage, type InviteNotice } from "../views/hub/ApplyPage.tsx";
import { page } from "../views/render.ts";

async function inviteNotice(c: Context<AppEnv>): Promise<InviteNotice> {
  const hash = readInviteCookie(c);
  if (!hash) return null;
  const invite = await findInvite(c.env.DB, hash);
  return invite && inviteState(invite, new Date()) === "active" ? "valid" : "invalid";
}

async function render(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200) {
  const invite = await inviteNotice(c);
  return page(c, <ApplyPage locale={c.get("locale")} origin={requestOrigin(c)} values={values} errors={errors} invite={invite} />, status);
}

export function registerApplyRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/apply", requireUser, async (c) => {
    if (await findBuilderByUserId(c.env.DB, c.get("user")!.id)) return c.redirect(localizedPath(c.get("locale"), "/hub"), 303);
    return render(c, formValuesFromBody({}), {});
  });

  onLocalized(app, "post", "/hub/apply", requireUser, async (c) => {
    const user = c.get("user")!;
    const hub = localizedPath(c.get("locale"), "/hub");
    if (await findBuilderByUserId(c.env.DB, user.id)) return c.redirect(hub, 303);

    const values = formValuesFromBody(await c.req.parseBody({ all: true }));
    const parsed = parseBuilderProfile(values);
    if (!parsed.ok) return render(c, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const result = await createBuilder(c.env.DB, { userId: user.id, profile: parsed.profile, inviteCodeHash: readInviteCookie(c), now });
    if (!result.ok) {
      if (result.reason === "already_builder") return c.redirect(hub, 303);
      return render(c, values, { handle: "taken" }, 409);
    }
    await writeAudit(c.env.DB, {
      actorUserId: user.id,
      action: "builder.apply",
      entity: "builder",
      entityId: user.id,
      data: { status: result.builder.status, invited: result.builder.inviteCodeHash !== null },
      now,
    });
    clearInviteCookie(c);
    return c.redirect(hub, 303);
  });
}
