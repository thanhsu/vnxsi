import { privacyVersionOf, termsVersionOf } from "../domain/legal-versions.ts";
import { BOARD_LEGAL, PRIVACY_M7, type LegalDoc, type LegalPageId } from "./content.ts";

type Docs = { en: LegalDoc; vi: LegalDoc };
export type LegalSelection = { docs: Docs | undefined; updatedAt: string | undefined };
export type BoardLegal = { privacy: Docs | null; terms: Docs | null };

/**
 * Which text and "Last updated" date /privacy and /terms show now (EPIC 27). `undefined` = the page's own text and LEGAL_UPDATED_AT.
 * Privacy: board (REQUEST_BOARD_GO_LIVE) > m7 (PRIVACY_NOTICE_GO_LIVE) > current; Terms: board > current. The date is the go-live date of the version shown.
 * A version whose text is not registered yet (`board` is null until VNX-2707b) falls back to the next one down, never to an empty page.
 */
export function selectLegal(
  id: LegalPageId,
  goLive: { m7?: string | undefined; board?: string | undefined },
  now: Date,
  board: BoardLegal = BOARD_LEGAL,
): LegalSelection {
  if (id === "privacy") {
    const version = privacyVersionOf(goLive, now);
    if (version === "board" && board.privacy) return { docs: board.privacy, updatedAt: goLive.board };
    if (version === "board" ? privacyVersionOf({ m7: goLive.m7 }, now) === "m7" : version === "m7") return { docs: PRIVACY_M7, updatedAt: goLive.m7 };
  } else if (id === "terms" && termsVersionOf(goLive.board, now) === "board" && board.terms) {
    return { docs: board.terms, updatedAt: goLive.board };
  }
  return { docs: undefined, updatedAt: undefined };
}
