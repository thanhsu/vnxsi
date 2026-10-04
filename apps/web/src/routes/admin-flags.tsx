import type { Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { readFlags, setFlag } from "../db/flags.ts";
import { isFlagKey } from "../domain/flags.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { FlagsPage } from "../views/admin/FlagsPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerAdminFlagRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/flags", requireAdmin, async (c) =>
    page(c, <FlagsPage locale={c.get("locale")} origin={requestOrigin(c)} flags={await readFlags(c.env.DB)} done={c.req.query("done") === "1"} />),
  );

  onLocalized(app, "post", "/admin/flags/:key", requireAdmin, async (c) => {
    const key = c.req.param("key") ?? "";
    if (!isFlagKey(key)) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const enabled = body.enabled === "1" ? true : body.enabled === "0" ? false : null;
    if (enabled === null) return c.text("Bad request", 400);
    await setFlag(c.env.DB, { key, enabled, actorUserId: c.get("user")!.id, now: new Date().toISOString() });
    return c.redirect(localizedPath(c.get("locale"), "/admin/flags?done=1"), 303);
  });
}
