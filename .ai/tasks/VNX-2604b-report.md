# VNX-2604b report (Implementer)

## Implemented
OAuth `GET /auth/oauth/:provider/start` and `/callback` (intent `signin`), `OAuthNotLinkedPage`, `OAuthErrorPage`, 5 `oauth.*` i18n keys in 4 locales (Owner-approved text, copied verbatim), architecture tests (allowlist + "OAuth callback never touches Ops invites"), test helper `test/oauth-flow.ts`, `test/auth/oauth-routes.test.ts`.

Files: `apps/web/src/routes/oauth.tsx` (new), `src/app.ts`, `src/views/auth.tsx`, 4 locale files, `test/oauth-flow.ts` (new), `test/auth/oauth-routes.test.ts` (new), `test/architecture.test.ts`. Code and tests copied from the amended plan (current section), no deviations in code.

Diff (excluding locales): 636 lines (< 700 limit).

## Evidence
- GREEN: `npm test -w apps/web -- test/auth/oauth-routes.test.ts test/architecture.test.ts test/i18n/parity.test.ts` -> 3 files, 60 tests passed.
- `npm test -w apps/web -- test/auth` -> 15 files, 134 tests passed.
- `npm run typecheck -w apps/web` -> 0 errors.
- Full suite: not run (controller runs it).
- RED: not observed separately; tests and code were placed together from the plan, then run green.

## Decisions / notes
- Line endings: repo files are CRLF (autocrlf); new files normalized to CRLF.
- Process slip: I ran `git add -N .` then `git reset -q` once to measure the diff; index only, no working-tree change (index was clean before).

## Ghi nhan
- None beyond the plan's listed obligations (Task 7 `lang` casing, Task 8 link branches, VNX-2608 429 monitoring).

## Fix round R1
- M1: new fixed code `user_inactive`; `logFailure()` extracted from `failed()` and used for the suspended/missing-user 403, which keeps its `errorResponse(c, "forbidden", 403)` response. The suspended-user test now uses `expectOneLog("user_inactive", ...)`.
- M2: the "not.toContain(known)" assertion now checks `lookalike.html` (the stranger one was replaced, since `known` was never in that page for a meaningful reason).
- Tests: `npm test -w apps/web -- test/auth/oauth-routes.test.ts test/architecture.test.ts` -> 2 files, 52 passed. `npm run typecheck -w apps/web` -> 0 errors.
- Corrections to the earlier report: the new files are LF in git; CRLF exists only in the working tree via autocrlf. Also, no RED run was observed for the original task.
