# VNX-2707a report: versioned legal framework and second advance notice

Branch `feat/epic27-request-board`. Implementer: Claude Sonnet. Scope: framework only; no board legal text (that is VNX-2707b).

## What was built
- `domain/legal-versions.ts` (new, pure): `privacyVersionOf({ m7, board }, now)` returns `current | m7 | board` (board from `REQUEST_BOARD_GO_LIVE - 14 days`, inclusive; board outranks m7; empty/malformed/invalid-now never enters a version; never goes back). `termsVersionOf(board, now)` returns `current | board`. Legacy `privacyVersion(goLive, now)` in `privacy-notice.ts` is untouched (same signature and results; its tests unchanged and green).
- `legal/select.ts` (new): `selectLegal(id, { m7, board }, now, boardTable = BOARD_LEGAL)` returns `{ docs, updatedAt }` for `routes/legal.tsx`. "Last updated" = go-live date of the version shown.
- `legal/content.ts`: `BOARD_LEGAL = { privacy: null, terms: null }`, registered by 2707b. **Choice for the "no text yet" case:** the selector is wired, but while the board text is `null` it falls back to the next version down (Privacy -> m7 if its date is reached, else current; Terms -> current), with that version's date. A board date set early therefore can never serve an empty page, a board date, or board wording. Proven by `test/legal/select.test.ts` (routes `/privacy`, `/vi/privacy`, `/zh-*`, `/terms`... with `REQUEST_BOARD_GO_LIVE` set and now far past: > 2000 chars, none of "public request board" / "bảng nhu cầu công khai" / "Public requests", no board date) and by the same selector tested with a fake registered table (what 2707b turns on).
- `routes/legal.tsx` uses `selectLegal`.
- Notices: `views/privacy-notice.tsx` context now carries `{ goLive, boardGoLive?, now }`; `activeNotices(locale, signedIn)` returns the M7 and board notices in that order, each over `[goLive - 14d, goLive + 31d)`, signed-in only. `PrivacyNotice` takes `id` (`data-notice-id="m7|board"`). `Layout.tsx` renders all active notices (one script). `render.ts` passes `boardGoLive: c.env.REQUEST_BOARD_GO_LIVE` and **keeps `withBoardOpen(c.get("requestBoard") === true, ...)`** (2705b obligation; `footer.test.ts`, `for-builders.test.ts` green).
- `public/assets/privacy-notice.js`: one `localStorage` key per notice (`vnxsi:privacy-notice-dismissed:v1` for M7, unchanged; `vnxsi:board-notice-dismissed:v1` for board); still static, same-origin, no inline script, < 2 KB.
- i18n: `privacyNotice.boardMessage`. EN and VI are the OP-2a sentences verbatim (Owner 2026-10-07). zh-Hans/zh-Hant are AI translations addressing the reader as 你, marked with a source comment, pending Owner approval like the M7 notice.
- Guard test: `REQUEST_BOARD_GO_LIVE` empty or >= 2026-10-21 (plus the existing >= `PRIVACY_NOTICE_GO_LIVE` check); Vitest pins both go-live dates to "" (asserted). `wrangler.jsonc` unchanged (`REQUEST_BOARD_GO_LIVE` stays "").

## Overlap decision (plan was explicit)
Plan says both notices may show at once, stacked, with independent keys. Done that way: M7 first, board second. If the Reviewer prefers one at a time, it is a one-line change in `activeNotices`.

## TDD evidence
Red first: `legal-versions.test.ts` failed with a missing module before `legal-versions.ts` existed; `design/board-notice.test.ts` failed 11 tests (no board notice, no `data-notice-id`, no message key, context ignored `boardGoLive`) before the view change. Then green. `select.test.ts` was written after `select.ts` (not red-first; it still tests behaviour listed in the plan).

## Tests
- New: `test/domain/legal-versions.test.ts` (24), `test/legal/select.test.ts` (8), `test/design/board-notice.test.ts` (new notice window edges, both-notices overlap, M7-only unchanged, board-only after M7 window, context default, EN/VI wording, links), plus assertions in `design/assets.test.ts` and `config/wrangler-guard.test.ts`.
- The two `skipIf` superset checks in `wrangler-guard.test.ts` are untouched (to un-skip in 2707b).
- `npm run typecheck -w apps/web` clean. Full suite: 209 files / 2691 passed + 2 skipped. `npm run e2e:typecheck` clean. `npm run test:scripts` 53 pass / 0 fail. `npm run e2e`: 84 passed + 1 failure `ERR_NO_BUFFER_SPACE` on `page.goto` (Windows socket buffer exhaustion on the shared machine, unrelated to this change); rerun of `request-board-public` 10/10 green. e2e artefacts deleted; no wrangler/workerd left.

## Items for the Reviewer
1. Fallback-until-2707b (above) rather than placeholders that are "never served".
2. zh board-notice sentences are mine; need the same Owner approval as the M7 zh sentence.
3. The board notice links to `/privacy` only (same as M7); Terms has no separate link.
4. `privacyVersionOf` with a board date but no M7 date goes current -> board (m7 skipped); with 2707b the board text then shows for a deployment without the M7 date. Production has the M7 date set, so this is only a test/dev case.
5. 2707b must set `BOARD_LEGAL` and add the board branch tests (EN/VI/zh, Last updated = board date) and un-skip the superset checks.
