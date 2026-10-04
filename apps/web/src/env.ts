import type { Locale } from "./i18n/locales.ts";
import type { Builder } from "./domain/builder.ts";
import type { SessionUser } from "./auth/sessions.ts";

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  APP_ORIGIN: string;
  ADMIN_EMAILS?: string;
  MAIL_DRIVER?: string;
  MAIL_FROM?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_DRIVER?: string;
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
