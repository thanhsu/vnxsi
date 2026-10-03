import type { Locale } from "./i18n/locales.ts";
import type { SessionUser } from "./auth/sessions.ts";

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  ADMIN_EMAILS?: string;
  MAIL_DRIVER?: string;
  MAIL_FROM?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    locale: Locale;
    user: SessionUser | null;
  };
};
