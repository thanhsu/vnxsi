import { Hono } from "hono";
import { sessionMiddleware } from "./auth/middleware.ts";
import type { AppEnv } from "./env.ts";
import { originCheck } from "./http/origin.ts";
import { requestId } from "./http/request-id.ts";
import { localeFromPath } from "./i18n/locales.ts";
import { localeMiddleware } from "./i18n/middleware.ts";
import { registerAuthRoutes } from "./routes/auth.tsx";
import { registerApplyRoutes } from "./routes/hub-apply.tsx";
import { registerHubRoutes } from "./routes/hub.tsx";
import { registerPortfolioRoutes } from "./routes/hub-portfolio.tsx";
import { registerProductMediaRoutes } from "./routes/hub-media.tsx";
import { registerProductEditorRoutes } from "./routes/hub-products.tsx";
import { registerMediaRoutes } from "./routes/media.ts";
import { registerBuilderProfileRoutes } from "./routes/builder-profile.tsx";
import { registerAdminProductRoutes } from "./routes/admin-products.tsx";
import { registerAdminRoutes } from "./routes/admin.tsx";
import { registerInviteAdminRoutes } from "./routes/admin-invites.tsx";
import { registerUserAdminRoutes } from "./routes/admin-users.tsx";
import { registerJoinRoutes } from "./routes/join.ts";
import { handleWaitlist } from "./routes/waitlist.ts";
import { errorResponse } from "./views/error-response.tsx";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.use("*", localeMiddleware);
  app.use("*", originCheck);
  app.use("*", sessionMiddleware);

  registerAuthRoutes(app);
  registerJoinRoutes(app);
  registerApplyRoutes(app);
  registerHubRoutes(app);
  registerPortfolioRoutes(app);
  registerProductMediaRoutes(app);
  registerProductEditorRoutes(app);
  registerMediaRoutes(app);
  registerBuilderProfileRoutes(app);
  registerAdminRoutes(app);
  registerAdminProductRoutes(app);
  registerInviteAdminRoutes(app);
  registerUserAdminRoutes(app);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("/api/waitlist", (c) => handleWaitlist(c.req.raw, c.env));
  app.all("/api/*", (c) => c.json({ ok: false, error: "Not found" }, 404));

  app.onError((err, c) => {
    const id = c.get("requestId");
    console.error(JSON.stringify({ requestId: id, path: c.req.path, error: String(err) }));
    if (c.req.path.startsWith("/api/")) return c.json({ ok: false, requestId: id }, 500);
    return errorResponse(c, "server", 500);
  });

  app.notFound((c) => {
    // Non-English prefixes never map to static assets; render a localized 404.
    if (localeFromPath(c.req.path).locale !== "en") return errorResponse(c, "notFound", 404);
    return c.env.ASSETS.fetch(c.req.raw);
  });
  return app;
}
