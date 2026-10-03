import type { Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { writeInviteCookie } from "../auth/invite-cookie.ts";
import { INVITE_CODE_RE } from "../domain/invite.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { errorResponse } from "../views/error-response.tsx";

export function registerJoinRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/join/:code", async (c) => {
    const code = c.req.param("code") ?? "";
    if (!INVITE_CODE_RE.test(code)) return errorResponse(c, "notFound", 404);
    // Validity (uses, expiry) is checked when the builder row is created, not here.
    writeInviteCookie(c, await sha256Hex(code));
    c.header("Referrer-Policy", "no-referrer");
    const locale = c.get("locale");
    const apply = localizedPath(locale, "/hub/apply");
    if (c.get("user")) return c.redirect(apply, 303);
    return c.redirect(localizedPath(locale, `/login?next=${encodeURIComponent(apply)}`), 303);
  });
}
