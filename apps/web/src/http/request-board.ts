import { isFlagEnabled } from "../db/flags.ts";
import { isBoardLive } from "../domain/request-board.ts";
import type { Bindings } from "../env.ts";

/**
 * Whether the public request board is on (addendum Q15): the date committed in `REQUEST_BOARD_GO_LIVE` has come AND the
 * `request_board` flag is on. The date is checked first, so before go-live (or with an empty or malformed value) there is no
 * D1 read at all. isFlagEnabled reads through a 60 s cache and answers false when D1 cannot be read (fail closed).
 */
export async function isRequestBoardEnabled(env: Pick<Bindings, "DB" | "REQUEST_BOARD_GO_LIVE">, now: Date = new Date()): Promise<boolean> {
  if (!isBoardLive(env.REQUEST_BOARD_GO_LIVE, now)) return false;
  return isFlagEnabled(env.DB, "request_board");
}
