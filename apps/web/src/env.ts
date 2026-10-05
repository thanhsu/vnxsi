import type { Locale } from "./i18n/locales.ts";
import type { Builder } from "./domain/builder.ts";
import type { SessionUser } from "./auth/sessions.ts";

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Product images (spec §8.5). Absent until R2 is enabled (VNX-0711): /media/* is 404 and uploads answer 503. */
  MEDIA?: R2Bucket;
  APP_ORIGIN: string;
  ADMIN_EMAILS?: string;
  MAIL_DRIVER?: string;
  MAIL_FROM?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_DRIVER?: string;
  /** Secret for the daily visitor hash (VNX-0707a). Unset: no views or clicks are counted and no visitor cookie is set. `wrangler secret put ANALYTICS_SALT`; `.dev.vars` locally; never in the repo. */
  ANALYTICS_SALT?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    locale: Locale;
    user: SessionUser | null;
    /** Only set after `requireBuilder`. */
    builder: Builder;
  };
};
