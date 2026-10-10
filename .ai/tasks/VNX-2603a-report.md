# VNX-2603a report (EPIC 26 Task 2)

Status: DONE. Worktree `vnxsi-epic26`, base HEAD `5a56e6c`.

## Implemented
`src/domain/oauth.ts` (PKCE S256, state/nonce/verifier, authorize URL, `verifyIdToken` claims check, cookie types/parse, start/callback decisions), `src/auth/oauth-cookie.ts` (`__Host-vnx_oauth` read/write/clear, `linkSessionHash`), tests `test/domain/oauth.test.ts`, `test/auth/oauth-cookie.test.ts`. Code and tests copied from the plan's Task 2 section.

## Review block LOW-1 (included)
`parseOAuthCookie` returns null when `next` does not start with `/`, or starts with `//` or `/\`. Tests added: `next: "//evil.example"`, `"https://evil.example"`, `"/\evil.example"`. LOW-2 is not in this task (left for Tasks 6 and 8).

## Evidence
- Focused: `npm test -- test/domain/oauth.test.ts test/auth/oauth-cookie.test.ts test/architecture.test.ts` (apps/web): 3 files, 50 tests passed.
- `npm run typecheck -w apps/web`: exit 0.
- Full suite NOT run (per coordinator; controller re-runs).
- RED: tests and code were written together from the plan, so a clean "module missing" RED was not recorded separately. During the work, one run failed on the LOW-1 backslash case (`next: "/evil.example"` was parsed non-null) because of a shell-escaping slip in my own test literal (`"/\e"` is `/e`); fixed the test literal to `"/\evil.example"`, then green.

## Deviations
None from the plan beyond adding LOW-1 (code line + 3 test cases). Files are CRLF in the working tree; new files written LF (git normalises).

## Ghi nhận
None.

## Fix round R1
- M1: new `isSafeCookieNext(next)` in `domain/oauth.ts` (printable ASCII, starts with `/`, not `//` or `/\`, within 512 chars), used by both `newFlowCookie` (invalid `next` becomes `null`) and `parseOAuthCookie`. New test: `//evil.example`, `https://evil.example`, `/\evil.example`, non-ASCII, newline, empty all give `next: null` and the cookie round-trips through `parseOAuthCookie`; a valid `/hub?x=1` is kept.
- M3: test pins the `exp` boundary: `exp = now - 60 s` is `expired`, `now - 59 s` is `ok`. `<=` unchanged.
- Run: `npm test -- test/domain/oauth.test.ts test/auth/oauth-cookie.test.ts test/architecture.test.ts` (apps/web): 3 files, 51 tests passed; `npm run typecheck -w apps/web` exit 0. Full suite not run.
