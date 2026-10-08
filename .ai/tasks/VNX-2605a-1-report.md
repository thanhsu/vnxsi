# VNX-2605a-1 report: Sign-in & linked accounts on /me, POST link, interstitial at start

Status: DONE_WITH_CONCERNS (full suite left to the controller; Step 9 manual 3-browser check not run, an agent cannot).

## Implemented
- `/me`: `<section id="identities">` via `LinkedAccounts` (only when a provider is available or the user has an identity; label only on the owner's page; no unlink, Task 9).
- `POST /me/identities/:provider/link` (4 locales, `requireUser`, global Origin check): 120 s intent cookie bound to the live session hash, 303 same-site to `/auth/oauth/:p/start?lang=<locale>`.
- `start`: link intent or a live link flow of the same session (`intent === "link" && flowMatchesSession`) always answers 200 with `OAuthLinkPage` (one `<a>`, only `/logout` forms, no-store, `same-origin`); new flow cookie with fresh state, `next: null`. Sign-in path unchanged (302). Callback untouched (`link_unsupported` stays for 8a-2).
- `availableProviders(c)` and exported `enabledProvider` in `routes/oauth.tsx`; `routes/auth.tsx` calls it, `loginProviders` and its 3 now-unused imports removed (LOW-1).
- i18n: 7 new keys and the replaced `oauth.notLinked.body` in en, vi, zh-hans, zh-hant, copied verbatim from the plan.
- Tests: new `test/me/identities.test.ts`, `test/auth/oauth-link-start.test.ts`; helpers `linkViaStart`, `externalLinks` in `test/oauth-flow.ts`; `test/architecture.test.ts` allowlist adds `routes/me.tsx`; `oauth-routes.test.ts` start test renamed to "a live link intent gets the intermediate page" (200) and the vi sentence updated (entities decoded).

## Plan-code fixes (minimal, recorded)
1. Plan's `identities.test.ts` had a bare `, () => {` where the second `describe(...)` header belongs; added `describe("POST /me/identities/:provider/link (VNX-2605a-1)", ...)`.
2. Dropped unused import `OAUTH_PROVIDERS, PROVIDER_NAME` in `identities.test.ts`.
3. Test "every flag off and one linked account" asserted the whole section lacks "GitHub", but the approved intro names Google, GitHub and LinkedIn; the assertion now looks at the row (`rows[0]`) only.
4. Plan's `LinkedAccounts.tsx` block was complete; no change.

## TDD evidence
- RED: `npx vitest run --maxWorkers=1 --no-file-parallelism test/me/identities.test.ts test/auth/oauth-link-start.test.ts` (in apps/web) before any src change: `Test Files 2 failed (2), Tests 18 failed | 9 passed (27)` (POST link 404, no section, start 400/302).
- GREEN: `npx vitest run --maxWorkers=1 --no-file-parallelism test/me test/auth test/i18n test/architecture.test.ts test/http` -> `Test Files 34 passed (34), Tests 277 passed (277)`.
- `npm run typecheck -w apps/web` -> 0 `error TS`.
- Full `npm test` not run by me (memory); controller runs it.

## Ghi nhan
- Working copies are CRLF while blobs are LF (autocrlf); edits preserved CRLF. Git warns only.
- `npm run typecheck` runs `wrangler types`; it left no tracked change.
- Step 9 (manual Chrome/Firefox/Safari check of the interstitial, reload and Back) is not done; to repeat with real providers in VNX-2608.
