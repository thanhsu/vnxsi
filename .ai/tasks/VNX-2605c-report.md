# VNX-2605c report (Implementer)

## Implemented
- `auth/sessions.ts`: `endProviderSessionsStatement` (single writer of `sessions`).
- `db/identities.ts`: `unlinkIdentity` takes required `endSessions`; one batch `[audit (guarded), endSessions, DELETE identity RETURNING]`; `touchIdentityLogin` now takes `userId`, returns boolean. `db/` does not import `auth/`.
- `routes/me.tsx`: unlink passes the statement; clears the cookie when caller's method is `oauth_<P>` (E1 = b1); 303 `/me?link=unlinked`.
- `routes/oauth.tsx` callback (MEDIUM-1): markLogin, createSession, touchIdentityLogin; if false, deleteSession and the not-linked page, no cookie; `auth.login` audit moved after the check.
- E3: `email.identityUnlinked.sessions` copied word for word into en/vi/zh-hans/zh-hant (after `.body`, no draft comment); template adds it for `unlinked` only (text and html).
- Tests: new `test/auth/end-provider-sessions.test.ts`, `test/me/identity-unlink-sessions.test.ts`, `test/auth/oauth-unlink-race.test.ts`; updated `test/db/identities.test.ts` (3 unlink calls, touch calls, new false-case test), `test/email/identity-templates.test.ts`, `test/me/identity-unlink.test.ts` (sentence in sent mail), `test/architecture.test.ts` (2 assertions).

## TDD
- RED: `npx vitest run test/auth/oauth-unlink-race.test.ts test/me/identity-unlink-sessions.test.ts test/auth/end-provider-sessions.test.ts --maxWorkers=1 --no-file-parallelism`: 9 failed (`endProviderSessionsStatement is not a function`, session GitHub still alive 200 vs 303, cookie not cleared); race file alone: 2 failed (`expected 303 to be 200`).
- GREEN: `npx vitest run test/auth test/me test/db/identities.test.ts test/email test/i18n test/architecture.test.ts --maxWorkers=1 --no-file-parallelism`: 39 files, 357 tests passed.
- `npm run typecheck -w apps/web`: exit 0.
- Full suite: left to the controller.

## Decisions / fixes
- Plan Step 1 snippet lacked its closing code fence; plan Step 5b gave only the cases loop, so I wrote the file header and `sameAsNotLinkedPage` (a real not-linked callback, ids normalized, compared byte for byte).
- Architecture block placed before the `the identity badge...` describe (after the constants), not literally after the `linked identities` block, to keep it adjacent; same content.
- No Task 6 test needed changes for the `auth.login` reorder (oauth-routes/oauth-link pass).
- Source files with CRLF working copies were rewritten with LF (git autocrlf warns only).

## Ghi nhan
- Triggers in the new tests are dropped in `finally`.
