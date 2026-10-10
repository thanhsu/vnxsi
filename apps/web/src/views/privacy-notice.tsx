import { createContext, useContext, type Child, type FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import type { Translate } from "../i18n/t.ts";
import { formatPrivacyNoticeDate, shouldShowPrivacyNotice } from "../domain/privacy-notice.ts";

export type PrivacyNoticeRequest = { goLive: string | undefined; now: Date };

/** Default null: a Layout rendered outside page() (unit tests, any future path) never shows the notice. */
const PrivacyNoticeRequestContext = createContext<PrivacyNoticeRequest | null>(null);

export function withPrivacyNoticeRequest(value: PrivacyNoticeRequest, node: Child) {
  return <PrivacyNoticeRequestContext.Provider value={value}>{node}</PrivacyNoticeRequestContext.Provider>;
}

/** The localized go-live date when the notice must render, else null. Call during render (reads the context). */
export function privacyNoticeDate(locale: Locale, signedIn: boolean): string | null {
  const req = useContext(PrivacyNoticeRequestContext);
  if (!signedIn || !req || !shouldShowPrivacyNotice(req.goLive, req.now)) return null;
  return formatPrivacyNoticeDate(req.goLive, locale);
}

export const PRIVACY_NOTICE_SCRIPT = "/assets/privacy-notice.js";

export const PrivacyNotice: FC<{ locale: Locale; date: string; tr: Translate }> = ({ locale, date, tr }) => (
  <details class="privacy-notice" data-privacy-notice="true" open>
    <summary class="privacy-notice-close">{tr("privacyNotice.dismiss")}</summary>
    <p>
      {tr("privacyNotice.message", { date })}{" "}
      <a href={localizedPath(locale, "/privacy")}>{tr("privacyNotice.readChanges")}</a>
    </p>
  </details>
);
