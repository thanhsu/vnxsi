# VNX-2603c report: GitHub OAuth adapter

## Implemented
- `apps/web/src/auth/oauth/github.ts` (new): `GithubClient`, `GITHUB_TOKEN_URL`, `GITHUB_USER_URL`; both fetches `redirect: "manual"`, 8s timeout; subject = numeric id, label = validated login; access token only in the second call's Authorization header.
- `provider.ts`: `ExchangeFailure` gains `profile_request | profile_response`.
- `index.ts`: github branch in `oauthCredentials`, `getOAuthProvider` builds `GithubClient`.
- `env.ts`, `vitest.config.ts` (pinned empty), `wrangler.jsonc` (comment only).
- Tests: new `test/auth/oauth-github.test.ts` (includes the workerd `new Request(url, init)` + `.redirect` check per captured call, copied from the plan); `oauth-providers.test.ts` updated.

## TDD evidence
- RED: the plan's test file was copied first, but my only RED run failed on a wrong cwd (`npm error No workspaces found`), so no genuine RED assertion output was captured. Honest gap. The adapter was then written from the plan.
- GREEN: `npm test -w apps/web -- test/auth/oauth-github.test.ts test/auth/oauth-providers.test.ts test/auth/oauth-oidc.test.ts test/auth/oauth-cookie.test.ts` -> 4 files, 51 tests passed.
- `npm run typecheck -w apps/web` -> exit 0.
- Full suite not run (controller does). `git diff --stat -- package.json package-lock.json apps/web/package.json` empty.

## Deviations
- None to plan code. The plan's `oauth-providers` test text was applied as written (the plan's `oauthCredentials` body was formatted to match the plan's nested ternary).

## Ghi nhan
- The `redirect: "manual"` test in the plan checks `.redirect` indirectly through `new Request`; it does not assert `.redirect` on the Request object itself. The brief asked for an assertion that `.redirect === "manual"`; the plan's test asserts `init.redirect` and non-throwing construction. Not extended (out of the plan text); reviewer may want a one-line add.

## Fix round R1
- M1: workerd loop now also asserts `new Request(call.url, call.init).redirect === "manual"`.
- M2: login regex widened to `^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$` (EMU logins); comment updated. Accepted cases added: `mona-cat_octo`, `a--b-`. Rejected cases added: `_octocat`, `octo%2Fcat`, `octo.cat`, 39-char-plus-underscore overflow (40 chars); existing cases cover leading `-`, `/ ? #  @`, space.
- M3: `oauthCredentials` is an exhaustive `switch` on the provider union with a `never` default.
- Tests: `npm test -w apps/web -- test/auth/oauth-github.test.ts test/auth/oauth-providers.test.ts test/auth/oauth-oidc.test.ts` -> 3 files, 46 tests passed. `npm run typecheck -w apps/web` exit 0.
