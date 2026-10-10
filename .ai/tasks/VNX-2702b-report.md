# VNX-2702b report: pure domain, request_board flag, REQUEST_BOARD_GO_LIVE gate

Implementer: Claude. Branch `feat/epic27-request-board`. Base `ebc597b`.

## What was done
- `src/domain/request-board.ts` (pure): constants; `publicationTransition(status|null, action, actor, requestStatus)` (7.1) and `canEditPublication`; `interestTransition` (7.2); `requestVisibility` (7.3, fail closed on missing/unreadable `closedAt`, `[closedAt, closedAt+30d)` is `closed`); `parsePublicListing`, `parseReviewNote`, `parseInterestForm` (lengths in code points, L1); `publicExcerpt` (code points, line breaks to spaces); `parseBoardQuery` (no `sort`); `isBoardIndexable`; `parseBoardGoLive`, `isBoardLive`, `boardEnabled`.
- `src/http/request-board.ts`: `isRequestBoardEnabled(env, now = new Date())` checks the DATE first, then `isFlagEnabled(db, "request_board")` (F13/M1: no D1 read before go-live; D1 failure is fail closed through `isFlagEnabled`).
- `FLAG_KEYS`: `request_board` is the 11th key; `FlagsPage` DESC entry plus `flags.desc.request_board` in en, vi, zh-hans, zh-hant.
- `env.ts`: `Bindings.REQUEST_BOARD_GO_LIVE?`, `Variables.requestBoard`; `app.ts` middleware after `sessionMiddleware` sets it.
- `wrangler.jsonc`: `vars.REQUEST_BOARD_GO_LIVE: ""` with comments (a)-(c); `vitest.config.ts` pins it `""`.
- `RANKING_FILES` gains `domain/request-board.ts`.

## Tests
- `test/domain/request-board.test.ts` (new): all 7.1/7.2 transitions, every §7.3 cell (8 statuses x published/other/null) and the +30d edges, parsers at 0/1/120/121, 39/40/4000/4001, 500/501, L1 emoji, excerpt (CJK, emoji, newlines), query (`sort=paid` ignored), indexable 4/5, gate edges (`goLive-1ms`, `goLive`, empty, `2026-02-30`, `2026-10-20T00:00`).
- `test/http/request-board-gate.test.ts` (new): flag x date matrix (M2 pattern: `setFlag` + per-request env + `afterEach` flag off and `resetFlagCache`), fake-timer clock (`toFake: ["Date"]`), M3a fail closed with a rejecting DB proxy, F13 zero-query check with `countD1Queries`, middleware query count via `/api/health`.
- `test/domain/flags.test.ts` updated (11 keys, `slice(0,10)` unchanged); `test/db/flags.test.ts` and `test/admin/flags.test.ts` unchanged and green.
- `test/config/wrangler-guard.test.ts`: `REQUEST_BOARD_GO_LIVE` in vars (empty or valid date, not before a non-empty `PRIVACY_NOTICE_GO_LIVE`), no secret in vars, M7 superset checks for `privacy-board.md` and `terms-board.md` (skipped with `skipIf` until VNX-2707b creates the files; `REPLACED_PRIVACY`/`REPLACED_TERMS` start empty and 2707b fills them; date lines are exempt).
- `test/db/request-board-migration.test.ts` +1 (S-1): SQL `length()` counts code points (120 emoji title accepted, 20-emoji description refused) and `parsePublicListing` agrees.

## Commands and results
- `npm run typecheck -w apps/web`: 0 errors.
- Acceptance set (`test/domain/request-board.test.ts test/http/request-board-gate.test.ts test/domain/flags.test.ts test/db/flags.test.ts test/admin/flags.test.ts test/config/wrangler-guard.test.ts test/architecture.test.ts test/i18n/parity.test.ts` + migration test): 9 files, 122 passed, 2 skipped (the board-superset checks).
- Full `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: 193 files, 2384 passed, 2 skipped.
- `npm run e2e`: 59 passed (flag off, nothing visible changed).

## Deviations / notes for the Reviewer
1. `publicationTransition` takes `requestStatus` as a required 4th parameter (plan: "qua tham số `requestStatus`"); opt-in accepts `pending_verification|submitted|matching`.
2. `isBoardLive(goLive, now)` takes the raw string (like `isCountingLive`), not a parsed Date.
3. `parseInterestForm` validates `productId` as a ULID (invalid -> `invalid`); description/notes reject control and format characters except line breaks and tabs.
4. Review-note and interest-note lengths are also in code points.
5. The M7 superset checks have empty replaced-lines lists on purpose; they cannot be filled before the board texts exist (2707b). A third test asserts the source files and the OAuth sentence exist so the checks cannot become silent no-ops.
6. FlagsPage text and the vi/zh descriptions are my wording (AI translation, native review before promotion as for other strings).
7. No `request_board` read happens before go-live (middleware calls the gate; date first). After go-live every request reads the flag through the 60 s cache.
