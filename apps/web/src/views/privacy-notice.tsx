import { createContext, useContext, type Child, type FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import type { Translate } from "../i18n/t.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { formatPrivacyNoticeDate, shouldShowPrivacyNotice } from "../domain/privacy-notice.ts";

/** `goLive` is PRIVACY_NOTICE_GO_LIVE (M7 notice); `boardGoLive` is REQUEST_BOARD_GO_LIVE (EPIC 27 board notice). Each opens its own window. */
export type PrivacyNoticeRequest = { goLive: string | undefined; boardGoLive?: string | undefined; now: Date };
export type NoticeId = "m7" | "board";
export type ActiveNotice = { id: NoticeId; date: string };

/** Default null: a Layout rendered outside page() (unit tests, any future path) never shows a notice. */
const PrivacyNoticeRequestContext = createContext<PrivacyNoticeRequest | null>(null);

export function withPrivacyNoticeRequest(value: PrivacyNoticeRequest, node: Child) {
  return <PrivacyNoticeRequestContext.Provider value={value}>{node}</PrivacyNoticeRequestContext.Provider>;
}

/** The notices to render now, M7 first, each with its localized go-live date; both may show at once (plan VNX-2707a). Call during render (reads the context). */
export function activeNotices(locale: Locale, signedIn: boolean): ActiveNotice[] {
  const req = useContext(PrivacyNoticeRequestContext);
  if (!signedIn || !req) return [];
  const out: ActiveNotice[] = [];
  for (const [id, goLive] of [["m7", req.goLive], ["board", req.boardGoLive]] as const) {
    if (!shouldShowPrivacyNotice(goLive, req.now)) continue;
    const date = formatPrivacyNoticeDate(goLive, locale);
    if (date !== null) out.push({ id, date });
  }
  return out;
}

export const PRIVACY_NOTICE_SCRIPT = "/assets/privacy-notice.js";

const MESSAGE: Record<NoticeId, MessageKey> = { m7: "privacyNotice.message", board: "privacyNotice.boardMessage" };

/** `data-notice-id` picks the localStorage key in privacy-notice.js (one key per notice, so closing one never closes the other). */
export const PrivacyNotice: FC<{ locale: Locale; id: NoticeId; date: string; tr: Translate }> = ({ locale, id, date, tr }) => (
  <details class="privacy-notice" data-privacy-notice="true" data-notice-id={id} open>
    <summary class="privacy-notice-close">{tr("privacyNotice.dismiss")}</summary>
    <p>
      {tr(MESSAGE[id], { date })}{" "}
      <a href={localizedPath(locale, "/privacy")}>{tr("privacyNotice.readChanges")}</a>
    </p>
  </details>
);
