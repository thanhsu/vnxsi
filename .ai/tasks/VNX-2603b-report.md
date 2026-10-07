# VNX-2603b report (EPIC 26 Task 3)

Status: DONE. Worktree `vnxsi-epic26`, base HEAD `4a936e5`.

## Implemented
Port `ProviderClient` (`auth/oauth/provider.ts`), `OidcClient` for Google and LinkedIn (`auth/oauth/oidc.ts`, `redirect: "manual"`, constant token URLs, 8 s timeout), `FakeOAuthProvider` with `issueFakeCode(provider, identity, expect)` (expect required: verifier, nonce, redirectUri) (`fake.ts`), `getOAuthProvider` / `isProviderConfigured` / `oauthCredentials` / `isFakeOAuth` (`index.ts`); `PROVIDER_NAME` in `domain/identity.ts`; five optional bindings in `env.ts`; `OAUTH_DRIVER: "fake"` and empty credential pins in `vitest.config.ts`; `test/env.d.ts`; note-only block in `wrangler.jsonc`; label CHECK test owed from VNX-2602 in `test/db/identities.test.ts`; `PROVIDER_NAME` test. Tests: `oauth-oidc.test.ts` (includes the `new Request(url, init)` workerd test), `oauth-providers.test.ts`.
All code and tests copied from the amended plan; no deviations.

## Evidence
- Focused: `npm test -- test/auth/oauth-oidc.test.ts test/auth/oauth-providers.test.ts test/domain/identity.test.ts test/db/identities.test.ts test/architecture.test.ts` (apps/web): 5 files, 62 tests passed.
- `npm run typecheck -w apps/web`: no errors.
- Full suite not run (controller does).
- RED: tests were put in place together with the code; the only failures seen were from my own extraction slip (a markdown fence line copied into four source files), fixed before the green run. A separate RED run was not recorded.
- No dependency change (package.json / lock untouched).

## Ghi nhận
None.

## Fix round R1
- M1: the S1 scan in `test/auth/oauth-providers.test.ts` now uses `FAKE_SPECIFIER = /["'][^"']*\boauth\/fake(?:\.ts)?["']/` for every file in `src/` except `auth/oauth/index.ts` (static and dynamic specifiers, any relative path), plus `FAKE_SIBLING = /["']\.\/fake(?:\.ts)?["']/` for files inside `src/auth/oauth/`. A new in-test assertion shows the patterns hit synthetic strings for each blind spot (`from "../oauth/fake.ts"`, `import("./oauth/fake")`, `import("../auth/oauth/fake.ts")`, `import("./fake")`) and miss `from "../email/fake.ts"` and `"./fake-mailer.ts"`. The real scan stays green (no false positive on email/fake).
- M2: `test/auth/oauth-oidc.test.ts` also asserts `new Request(call.url, call.init).redirect` is `"manual"`.
- Run: focused oidc and providers tests: 2 files, 29 tests passed; typecheck no errors. Full suite not run. No source changes.
