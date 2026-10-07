import type { Locale } from "./i18n/locales.ts";
import type { Builder } from "./domain/builder.ts";
import type { SessionUser } from "./auth/sessions.ts";
import type { OpsRole } from "./domain/ops.ts";

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
  /** EPIC 26 (ADR-012): "fake" swaps in the test provider, and only next to the fake mailer (auth/oauth/index.ts). Never set in wrangler.jsonc. */
  OAUTH_DRIVER?: string;
  /** OAuth client credentials: `wrangler secret put …` and apps/web/.dev.vars only. A provider missing either of its two is off. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    locale: Locale;
    user: SessionUser | null;
    /** Only set after `requireBuilder`. */
    builder: Builder;
    /** Only set after `requireOps` (auth/ops.ts): the role resolved for this request. */
    opsRole: OpsRole;
  };
};
