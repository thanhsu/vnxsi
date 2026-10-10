# VNX-2605d report: linking a new provider needs a magic-link session (ADR-013)

Implementer: Claude Opus 5.5 (worktree `vnxsi-epic26`, branch `feat/epic26-linked-accounts`, base `dd39e18`).

## Implemented
- `domain/identity.ts`: `LINK_SESSION_METHOD`, `isLinkCapableSession` (separate from `isStaffSession`), `LinkRefusal` + `"session_ended"`.
- `db/identities.ts` `linkIdentity`: optional `requireSession: { idHash }`; INSERT is now `SELECT ... WHERE (?7 IS NULL OR EXISTS (live magic_link session of this user))`; no row means no audit (guarded) and `session_ended` is returned before the conflict answers.
- `routes/me.tsx`: POST link from a non-`magic_link` session answers 303 `/me?link=needsEmailLink` (localized), no cookie, after the provider check (404 unchanged); `canLink` passed to the view.
- `routes/oauth.tsx`: `start` computes `sessionHash` only for a link-capable session (otherwise plain sign-in); `finishLink` checks `isLinkCapableSession` before `exchange` and passes `requireSession: { idHash: await sha256Hex(raw) }`; `session_ended` -> generic error page (400, `session_mismatch` log), no identity, audit or e-mail.
- `views/me/LinkedAccounts.tsx`: `needsEmailLink` notice (status role), `canLink` prop hides Link forms and shows the `emailToLink` note (not when the needsEmailLink notice is shown); Unlink unchanged.
- 4 locale files: the two Owner-approved strings word for word, after `me.identities.notice.notLinked`, no draft comments.
- Tests: new `test/auth/oauth-link-session.test.ts` (17 tests, from the plan); MEDIUM-1 rewrites in `test/auth/oauth-link.test.ts` and `test/me/identities.test.ts`; M1 assertion in `test/auth/oauth-unlink-race.test.ts`; architecture assertion. MEDIUM-2 `exchange` spy assertions are in the new file.

## Deliberate deviation (plan decision 7)
ADR-013 "Duoc bao dam boi" says the race is tested with a trigger "as in VNX-2605c". It is NOT: between `exchange` and the INSERT no D1 statement runs, so a trigger would test an interleaving D1 cannot produce. The race test uses a test-only `vi.spyOn(FakeOAuthProvider.prototype, "exchange")` (calls the original, then deletes the session row; restored in `afterEach`), with no production hook. A second test calls `linkIdentity` directly with a dead / `oauth_*` / other user's `requireSession` to prove the guard is in the SQL.

## TDD evidence
- RED: `npx vitest run test/auth/oauth-link-session.test.ts --maxWorkers=1 --no-file-parallelism` before any src change: `Tests 10 failed | 7 passed (17)` (e.g. `/me` lacked the note; POST from oauth_* went to start).
- GREEN: `npx vitest run test/auth test/me test/db/identities.test.ts test/i18n test/architecture.test.ts --maxWorkers=1 --no-file-parallelism`: `Test Files 32 passed (32), Tests 334 passed (334)`.
- `npm run typecheck -w apps/web`: exit 0, no errors.
- Full suite not run (controller runs it).

## Decisions / notes
- Plan code was used as written; no plan code failed typecheck. Line endings kept CRLF in every touched file (edits via a script that preserves CRLF).
- The architecture test regex `\b` was briefly mangled by shell quoting while writing it; fixed, verified green.
- Unlink from `oauth_*` unchanged (test in new file).

## Ghi nhan (out of scope)
- `needsEmailLink` tells the user to sign out but `/me` has no sign-out button (already recorded in the plan).

## Fix round R1

Test-only, no source change. In the SQL-level test of `apps/web/test/auth/oauth-link-session.test.ts`:
- LOW-1: a fresh `magic_link` session of the right user with `expires_at` set 1 s before `now` gives `session_ended`, no identity row, no audit row (differs from the passing case only in `expires_at`).
- SUGGESTION-1: a dead session plus a subject already linked to this user gives `session_ended`, not `already_linked`; the existing identity and its one audit row are untouched.

Run: `npx vitest run test/auth/oauth-link-session.test.ts --maxWorkers=1 --no-file-parallelism`: 17 passed (17). `npm run typecheck -w apps/web`: no errors.
