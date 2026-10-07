import { Hono } from "hono";
import { sessionMiddleware } from "./auth/middleware.ts";
import { opsHeaders, opsNotFound } from "./auth/ops.ts";
import type { AppEnv } from "./env.ts";
import { noStorePrivate } from "./http/no-store.ts";
import { requestBodyLimit } from "./http/body-limit.ts";
import { originCheck } from "./http/origin.ts";
import { requestId } from "./http/request-id.ts";
import { securityHeaders } from "./http/security-headers.ts";
import { localeFromPath } from "./i18n/locales.ts";
import { localeMiddleware } from "./i18n/middleware.ts";
import { registerAuthRoutes } from "./routes/auth.tsx";
import { registerApplyRoutes } from "./routes/hub-apply.tsx";
import { registerHubRoutes } from "./routes/hub.tsx";
import { registerHubInquiryRoutes } from "./routes/hub-inquiries.tsx";
import { registerHubInvitationRoutes } from "./routes/hub-invitations.tsx";
import { registerMeRoutes } from "./routes/me.tsx";
import { registerMeRequestRoutes } from "./routes/me-requests.tsx";
import { registerRequestFormRoutes } from "./routes/request-form.tsx";
import { registerPortfolioRoutes } from "./routes/hub-portfolio.tsx";
import { registerProductMediaRoutes } from "./routes/hub-media.tsx";
import { registerProductEditorRoutes } from "./routes/hub-products.tsx";
import { registerMediaRoutes } from "./routes/media.ts";
import { registerBuilderProfileRoutes } from "./routes/builder-profile.tsx";
import { registerCatalogRoutes } from "./routes/catalog.tsx";
import { registerDirectoryRoutes } from "./routes/directory.tsx";
import { registerGoRoutes } from "./routes/go.ts";
import { registerSeoRoutes } from "./routes/seo.ts";
import { registerProductPageRoutes } from "./routes/product-page.tsx";
import { registerToolsRoutes } from "./routes/tools.tsx";
import { registerInquiryFormRoutes } from "./routes/inquiry-form.tsx";
import { registerAdminProductRoutes } from "./routes/admin-products.tsx";
import { registerAdminInquiryRoutes } from "./routes/admin-inquiries.tsx";
import { registerAdminRequestRoutes } from "./routes/admin-requests.tsx";
import { registerAdminFeedbackRoutes } from "./routes/admin-feedback.tsx";
import { registerAdminRoutes } from "./routes/admin.tsx";
import { registerInviteAdminRoutes } from "./routes/admin-invites.tsx";
import { registerUserAdminRoutes } from "./routes/admin-users.tsx";
import { registerAdminFlagRoutes } from "./routes/admin-flags.tsx";
import { registerAdminMerchantRoutes } from "./routes/admin-merchants.tsx";
import { registerJoinRoutes } from "./routes/join.ts";
import { registerForBuildersRoutes } from "./routes/for-builders.tsx";
import { registerLandingRoutes } from "./routes/landing.tsx";
import { registerLegalRoutes } from "./routes/legal.tsx";
import { registerContactRoutes } from "./routes/contact.tsx";
import { registerOpsRoutes } from "./routes/ops.tsx";
import { registerOpsMarketplaceRoutes } from "./routes/ops-marketplace.tsx";
import { registerOpsMonetizationRoutes } from "./routes/ops-monetization.tsx";
import { errorResponse } from "./views/error-response.tsx";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.use("*", securityHeaders);
  // Ops console (VNX-2502, spec §5): wraps everything after it, so every /ops response, the Origin and body-size
  // refusals included, is no-store + noindex. Only /ops paths; the order of the site-wide middleware is unchanged.
  app.use("/ops", opsHeaders);
  app.use("/ops/*", opsHeaders);
  app.use("*", localeMiddleware);
  app.use("*", originCheck);
  app.use("*", requestBodyLimit);
  app.use("*", sessionMiddleware);
  app.use("*", noStorePrivate);

  registerLandingRoutes(app);
  registerForBuildersRoutes(app);
  registerLegalRoutes(app);
  registerContactRoutes(app);
  registerAuthRoutes(app);
  registerJoinRoutes(app);
  registerApplyRoutes(app);
  registerHubRoutes(app);
  registerHubInquiryRoutes(app);
  registerHubInvitationRoutes(app);
  registerMeRoutes(app);
  registerMeRequestRoutes(app);
  registerPortfolioRoutes(app);
  registerProductMediaRoutes(app);
  registerProductEditorRoutes(app);
  registerMediaRoutes(app);
  registerBuilderProfileRoutes(app);
  registerCatalogRoutes(app);
  registerDirectoryRoutes(app);
  registerGoRoutes(app);
  registerSeoRoutes(app);
  registerInquiryFormRoutes(app);
  registerRequestFormRoutes(app);
  registerProductPageRoutes(app);
  registerToolsRoutes(app);
  registerAdminRoutes(app);
  registerAdminProductRoutes(app);
  registerAdminInquiryRoutes(app);
  registerAdminRequestRoutes(app);
  registerAdminFeedbackRoutes(app);
  registerInviteAdminRoutes(app);
  registerUserAdminRoutes(app);
  registerAdminFlagRoutes(app);
  registerAdminMerchantRoutes(app);
  // Ops console pages (VNX-2503), each behind requireOps(capability); before the /ops catch-all below.
  registerOpsRoutes(app);
  registerOpsMarketplaceRoutes(app);
  registerOpsMonetizationRoutes(app);
  // Last in the Ops group: an unknown /ops path gets the same sealed 404 as a refused one (plan O1).
  app.all("/ops", opsNotFound);
  app.all("/ops/*", opsNotFound);

  app.get("/api/health", (c) => c.json({ ok: true }));
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
