import { parsePrivacyNoticeDate } from "./privacy-notice.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrivacyLegalVersion = "current" | "m7" | "board";
export type TermsLegalVersion = "current" | "board";

/** True from `goLive - 14 UTC days` (inclusive) for ever after. False for an unset or malformed date and for an invalid `now`: a bad value never enters a version. */
function reached(goLive: string | undefined, now: Date): boolean {
  const date = parsePrivacyNoticeDate(goLive);
  const at = now.getTime();
  return date !== null && Number.isFinite(at) && at >= date.getTime() - 14 * DAY_MS;
}

/**
 * Which Privacy text is live (EPIC 27, addendum Q15): `current`, then `m7` from PRIVACY_NOTICE_GO_LIVE - 14 days, then `board` from
 * REQUEST_BOARD_GO_LIVE - 14 days; the board outranks m7. Never goes back: neither value may be cleared after go-live. Fails closed
 * (an empty or malformed date never reaches its version).
 */
export function privacyVersionOf(goLive: { m7?: string | undefined; board?: string | undefined }, now: Date): PrivacyLegalVersion {
  if (reached(goLive.board, now)) return "board";
  return reached(goLive.m7, now) ? "m7" : "current";
}

/** Which Terms text is live: `board` from REQUEST_BOARD_GO_LIVE - 14 days, else `current`. */
export function termsVersionOf(board: string | undefined, now: Date): TermsLegalVersion {
  return reached(board, now) ? "board" : "current";
}
