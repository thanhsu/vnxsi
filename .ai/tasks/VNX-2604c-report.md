# VNX-2604c report: provider sign-in buttons on /login (text only)

## Implemented
Plain `<a class="btn btn-ghost">` links to `/auth/oauth/:provider/start?lang=<Locale>&next=<safeNext>` under the e-mail form, shown only when the provider flag is on AND `isProviderConfigured`. No img/svg/logo (VNX-2604d), no inline style/script, no form. With flags off the page is byte-identical (test compares page minus block).
Code copied from the amended plan: `oauthStartPath`, `LoginPage.providers`, `loginProviders(c)`, local `retry` helper for 400/429/502 (GET passes providers too), CSS after `.field [aria-invalid="true"]`, img-src reminder comment in the test, i18n verbatim (Owner-approved) in 4 locales.

Files: apps/web/src/views/auth.tsx, src/routes/auth.tsx, public/assets/app.css, src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts, test/auth/login-oauth-buttons.test.ts (new, 15 tests incl. 429).

## TDD
RED: `npm test -w apps/web -- test/auth/login-oauth-buttons.test.ts` before code: 14 failed, 1 passed (the flags-off regression guard).
GREEN: same command after code: 15 passed.

## Verification
- `npm test -w apps/web -- --maxWorkers=1 --no-file-parallelism test/auth/ test/i18n/parity.test.ts test/design/assets.test.ts`: 18 files, 172 tests passed.
- `npm run typecheck -w apps/web`: exit 0.
- Full suite not run (controller runs it).

## Decisions / notes
- No plan code needed fixing.
- Running several test files in one vitest invocation crashed with a V8 "heap out of memory" in this environment (4 GB free disk, D: 99% full); `--maxWorkers=1 --no-file-parallelism` works. Environmental, not caused by this change.
- `docs/blueprint/07-MASTER-BACKLOG.md` and `docs/roadmap/WAVE1-ROADMAP.md` were already modified in the worktree before this task; not touched or staged.

## Ghi nhan
- Disk D: is 99% full (4.1 GB free); risk of "No space left" for later tasks.
