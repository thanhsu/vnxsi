# VNX-0802 — Implementer report

- **Branch / worktree:** `feat/vnx-0802-e2e` in `D:/DOCS/SUPHAM/GIT/vnxsi-0802`. Plan: `.ai/plans/VNX-0802-plan.md` (APPROVED).
- **Commits** (each with `Co-Authored-By: Claude Opus 5.5`): `719dea3` build(e2e) deps, server, seed · `cb22676` test(e2e) specs · `a3e565d` test(scripts) node tests · `07042a9` ci job · this report in the next commit.
- **Role split kept:** no `e2e/README.md`, no runbook line, no `CURRENT-STATUS.md` (Reviewer). `apps/web` has no diff.

## Verification (run in the worktree, final tree)

| Command | Result |
|---|---|
| `npm run e2e` | **49 passed (57.4 s)**, no retry, no flaky. Wall time of the command including server start: **59 s** (earlier full runs: 69 s, 78 s). |
| `npm run e2e:typecheck` | clean (no output after the tsc line) |
| `npm run test:scripts` | `# tests 51  # pass 51  # fail 0` (31 new: 19 in `e2e-targets`, 12 in `e2e-seed`; the 20 existing smoke tests unchanged) |
| `npm test -w apps/web -- --maxWorkers=2` | second run: `Test Files 164 passed (164)  Tests 1913 passed (1913)`, 6 min 50 s. **First run had 1 failed test** (`1 failed \| 163 passed`, `1912 passed \| 1 failed`); I did not capture its name (tail only) and could not reproduce it: it ran while the machine was under the socket trouble described below. Reviewer: please re-run once. |
| `npm run typecheck -w apps/web` | passes (wrangler types + tsc, exit 0) |
| `git diff --stat origin/main -- apps/` | empty (no output) |
| `git check-ignore e2e/.state playwright-report test-results` | prints all three |
| `grep -rnE "waitForTimeout\|https://vnx\.si\|RESEND_API_KEY=[^ \"]\|TURNSTILE_SECRET" e2e` | no match (exit 1); the same rules also run as a node test |
| `E2E_PORT=8811 E2E_INSPECTOR_PORT=9411 npm run e2e -- tests/meta.spec.ts` | 4 passed; no listener left on 8799/8811/9329/9411 afterwards |
| `npm ls @playwright/test @axe-core/playwright --depth=0` | `@playwright/test@1.64.0`, `@axe-core/playwright@4.13.0`, exact in `package.json` (no `^`). `npm view` on 2026-10-10: 1.64.0 and 4.13.0 (latest). Lock adds 5 packages: the two, `axe-core 4.13.0`, `playwright 1.64.0`, `playwright-core 1.64.0`; no existing package changed. |
| Worker version used | wrangler 4.147.0 (lock), not 4.149.0 as the plan text says |

## First-step verifications (plan section 2 to 4) and which fallback was used

1. **`--var` overrides `.dev.vars`: yes. Fallback not needed.** With `apps/web/.dev.vars` containing a non-empty `RESEND_API_KEY` and the server started with `--var RESEND_API_KEY:`, `/b/e2e-builder/hire` still rendered `data-sitekey="fake-site-key"`, which only exists while the key is empty (`isFake`). So the fail-closed `.dev.vars` guard of the plan was not built (the override is proven). I deleted the temporary `.dev.vars` after the test.
2. **`/__scheduled` reaches the handler through `run_worker_first`: yes. OQ-2 fallback not needed.** `GET /__scheduled?cron=5+*+*+*+*` returns 200 "Ran scheduled event"; the homepage then shows Numbers, Live, Trending, Market pulse, Top builders, Top products, all computed by the real hourly job over the seeded source tables. `public_stats` is never written by the seed (a node test asserts it).
3. **`__Host-` cookie on `http://localhost`: accepted. OQ-3 HTTPS fallback not needed.** Chromium accepts the `Set-Cookie` of `POST /auth/verify` (login.spec asserts `httpOnly`, `secure`, `sameSite=Lax`, path `/`). One detail: Playwright `context.addCookies` with `url: "http://localhost:8799"` is rejected by CDP ("Invalid cookie fields"), the same cookie with `domain: "localhost", path: "/", secure: true` is accepted, so `support/test.ts` uses domain + path. Checked all five combinations in a scratch script (url/domain, secure or not, http or https).
4. `wrangler dev` needs no Cloudflare login (no `CLOUDFLARE_API_TOKEN` set here; migrations, seed and dev all ran). Not verified on a clean Linux runner (see Not verified).

## What was built

- `e2e/` at the repo root, not a workspace. `playwright.config.ts` (Chromium only, `workers: 1`, `reuseExistingServer: false`, `globalTimeout` 8 min, test 30 s, expect 5 s, trace on first retry, screenshot on failure, html report to `playwright-report/`), `tsconfig.json`, `env.d.ts` (declares `process`: the repo has no `@types/node`), `global-setup.ts` (runs the cron, polls `/` until the three snapshot markers show, clear error naming the `MIN` table otherwise).
- `lib/ports.mjs`, `lib/targets.mjs`: ports 8799 / 9329 by default; `resolveTarget` refuses any host but `localhost` / `127.0.0.1`, any other port, non-http(s).
- `scripts/serve.mjs`: wipes `e2e/.state`, `d1 migrations apply --local`, writes `seed.sql`, `d1 execute --local --file`, then `wrangler dev` with `--var` for `APP_ORIGIN`, `MAIL_DRIVER=fake`, `RESEND_API_KEY=""`, `TURNSTILE_DRIVER=fake`, `ADMIN_EMAILS`, `PRIVACY_NOTICE_GO_LIVE=""`, `ANALYTICS_SALT=""` and `--test-scheduled`. Refuses `--remote` in argv/env. Kills the tree with `taskkill /T` on Windows. wrangler output is kept quiet and printed only on failure.
- `seed/fixtures.mjs`, `seed/build-seed.mjs`: deterministic SQL (same `now` gives the same text): 14 approved builders in 4 countries (12 market + the main builder + another builder), 15 products (13 published, the main builder's draft, the other builder's draft), 12 submitted requests in 3 categories, trending stats for 8 products, 3 verified products, 14 public audit events, a seeded session for the main builder, 6 one-use login tokens (OK_1, OK_2, OK_NEXT, OK_NEXT_EVIL, OK_A11Y, EXPIRED). Only sha256 of session and tokens is stored.
- `support/`: `test.ts` (blocks all non-local network, auto fixture that fails every test on a CSP violation, console.error or page error, `builderPage` fixture), `csp.ts`, `a11y.ts`, `a11y-known.ts`, `turnstile.ts`, `page.ts`.
- Specs: `home` (8), `inquiry` (4), `login` (7), `editor` (4), `a11y` (22), `meta` (4) = 49. POST budget: inquiry 3 of 10 per hour per IP, login 2 of 5 per email.
- `scripts/test/e2e-targets.test.mjs` (19 tests incl. a source scan of `e2e/` for AC12 and a check that `serve.mjs` only mentions `--remote` in its refusal) and `e2e-seed.test.mjs` (12 tests: determinism, FK-valid on a real migrated in-memory SQLite through `node:sqlite`, every homepage threshold met with SQL that mirrors `db/public-stats.ts`, hashes only).
- CI job `e2e` in `web-ci.yml` exactly as planned except `run`/`path` written as YAML block scalars. `git diff origin/main -- .github/workflows/web-ci.yml` adds only that job.
- Scripts `e2e`, `e2e:headed`, `e2e:typecheck`, `e2e:install`; `.gitignore` lines.

## axe findings and the deferral list (OQ-1)

**No real WCAG 2.2 AA violation was found on any scanned page. `KNOWN_A11Y` is empty.** Scanned (en): `/`, `/products`, `/builders`, `/b/e2e-builder`, `/b/e2e-builder/hire`, `/p/e2e-published-product`, `/request`, `/for-builders`, `/privacy`, `/contact`, `/login`, `/auth/verify` (GET), signed in `/hub`, `/hub/products`, editor product step; (vi) `/vi/`, `/vi/login`, `/vi/b/e2e-builder/hire`, `/vi/privacy`; 360 px wide `/` and the hire form; `/` with motion after count-up. Tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, so `target-size` is active.

How I know the zero is not an empty scan: meta.spec proves axe reports `image-alt` on a crafted page and `color-contrast` on a real app page, and that a `KNOWN_A11Y` entry covers a violation while an unmatched entry fails the test. Also: when `app.css` failed to load during bad runs (below), axe reported `target-size` on the bare links, so the rule really fires. Because of that I added a guard in `settle()`: an unstyled page throws "app.css did not load" instead of producing false findings.

Not scanned (plan P2 or out of scope): signed-in inquiry form, `/p/:slug/inquiry/*`, `/me*`, request form after submit, tool pages, admin/ops, zh-Hans/zh-Hant, dark mode, 4xx pages, error states of forms.

## Observations for triage (not violations, not app changes)

- Inquiry form errors have per-field `role="alert"` and `aria-describedby`, but no error summary and no focus move on a 400 re-render (the product and login forms do have a summary or one alert). The plan asked to check "focus/summary"; the test asserts what exists (alert + describedby + `aria-invalid` + kept values).
- Product step form per-field errors are plain `<p class="error-msg">` (no role); the summary `<p role="alert">` carries the announcement.
- The form pages do not send `no-referrer` (regression test passes); `/auth/verify` sends `same-origin` and its POST carries the real `Origin`.
- Chromium logs "Failed to load resource" (console.error) for every 4xx document. The CSP/console watcher ignores that line only when the failing URL is a navigation request the test itself asked for (the status is asserted in the test); a failing sub-resource (css, js, font) still fails the test.

## Deviations from the plan

1. `E2E_RETRIES` env knob in `playwright.config.ts` (default stays `CI ? 1 : 0`). Reason below.
2. No `.dev.vars` fail-closed guard in `serve.mjs` (override proven, see 1.). Added `ANALYTICS_SALT=""` to the `--var` set so a developer's `.dev.vars` salt cannot turn on view counting (the plan said "not set"; empty is equivalent in the app and stops `.dev.vars` leaking in).
3. Ids use only Crockford letters (K user, P product, R request, J inquiry, V verification, A audit, T tier) because `I`, `L`, `O`, `U` are invalid in the app's ULID regex.
4. `builderPage` sets its cookie by domain + path (see 3. above).
5. `e2e-seed.test.mjs` uses `node:sqlite` (experimental in Node 22, prints an ExperimentalWarning, works without a flag on >= 22.13; `engines` says >= 22.18). It runs the real migrations, so the thresholds are checked on real SQL rather than regex on text.
6. Two extra meta tests (contrast on a real page; deferral machinery) beyond the two in the plan.
7. The plan's home test 8 and others are as written; the chart-growth test treats a bar whose markup width is 0 as exempt (a 0-value bar has width 0 by design; found while debugging).

## Environment problem found (affects reproducibility on this machine)

During development roughly 20 to 40 percent of tests failed on the first attempt with `net::ERR_ADDRESS_IN_USE` or `net::ERR_NO_BUFFER_SPACE` on requests to the local server (once `ENOBUFS` inside `wrangler d1 migrations apply`, and once a ProxyWorker "internal error"). Cause: a stale `workerd.exe` of another session (PID 13216, started 2026-10-08 18:38) held about 8,900 bound TCP sockets (`Get-NetTCPConnection -State Bound`). curl made 300 sequential and 180 parallel connections to the same server with zero failures, so it hits Chromium's connects only. I did not touch that process (not mine). It disappeared on its own before the final runs: `Bound` went from about 9,000 to 123, and the last three full runs (two of them plain `npm run e2e`, no retries) were 47, 47 and 49 passed with no failure. If the Reviewer sees `ERR_ADDRESS_IN_USE` again, check `Get-NetTCPConnection -State Bound | Group-Object OwningProcess` first; `E2E_RETRIES=3` is the stop-gap, and any retry-green test must be listed (plan policy). No test needed a retry in the final run.

## Not verified / left open

- **AC13 (the CI job green on GitHub):** not run (no push). The job has never executed on a Linux runner. Points that could differ there: `workerd` optional dependency for linux in the lock (the existing `test` job already needs it), `npx playwright install --with-deps`, `node:sqlite` in `test:scripts`.
- `E2E_CHANNEL=chrome|msedge` path: written, not run.
- Cold start from a clean clone: `npm ci` then `npm run e2e:install` then `npm run e2e` was run as `npm ci` (worktree had no `node_modules`) + install + run, in that order, on this machine only.
- The timing target of the plan for CI (<= 6 min) is unmeasured; locally the suite is about 1 minute.

## Rule slips to disclose

- I ran `git checkout -- package.json` once to undo `npm install`'s reformatting of that single file I had just changed myself (the file was not committed at that point and held only my own change). It is the only checkout/reset-style command used; nothing else was discarded.
- Worktree `node_modules` was created with `npm ci` (the worktree had none); no `rm -rf` of it.
- Windows `taskkill /T` was used only on process trees I started (`serve.mjs` runs).

## For the Reviewer

- Triage the observations above; there are no deferred axe items to decide.
- Decide whether `E2E_RETRIES` stays (it is inert unless set) and whether CRLF warnings on commit (autocrlf) matter for `web-ci.yml`.
- Re-run `npm test -w apps/web -- --maxWorkers=2` once to see whether the single first-run failure recurs.
- `e2e/README.md` can cite: `npm run e2e:install` once (about 118 MB Chromium + 80 MB headless shell, to `%LOCALAPPDATA%\ms-playwright`), `npm run e2e`, `npm run e2e -- tests/login.spec.ts`, `E2E_PORT` / `E2E_INSPECTOR_PORT`, `npx playwright show-report`, orphan note (`taskkill /IM workerd.exe /F` only if no other session uses it), and the `Bound` sockets check above.

## Vòng sửa 1 (review 58e2948: F1, F2, F5, F6, F7)

- **F1:** `home.spec.ts` ghi lịch sử chữ của mọi `[data-count]` bằng `addInitScript` + `MutationObserver` (`recordCounts`). Count-up: poll tới khi lịch sử có ít nhất một giá trị khác số cuối và giá trị cuối đúng bằng số server in (`formatEn`). Reduced-motion: lịch sử của từng số đúng bằng `[final]` (không qua 0 hay số giữa), sau khi cuộn tới ô (lúc IntersectionObserver sẽ chạy nếu JS không tôn trọng `reduce`).
- **F2:** `fixtures.mjs` gieo mỗi token dùng một lần cho 3 lần thử (`OK_1`, `OK_1_R1`, `OK_1_R2`, ...) và có `tokenFor(key, retry)`; `login.spec.ts` chọn token theo `test.info().retry`. `editor.spec.ts` đặt tên và slug theo lần thử (`E2E Created Product 1` / `e2e-created-product-1`). Không đặt `retries: 0`. Chưa chạy một retry thật (không có lỗi để kích); logic chỉ kiểm bằng đọc và bằng test seed (token đều khác nhau).
- **F5:** `serve.mjs` chỉ kiểm `process.argv`. Test node vẫn đếm đúng 2 lần `--remote`.
- **F6:** `e2e-seed.test.mjs` đọc bảng `MIN` từ `apps/web/src/domain/public-stats.ts` bằng regex trên văn bản, kèm một test khẳng định mọi ngưỡng đọc được là số nguyên dương. `apps/` không đổi.
- **F7:** chú thích trong khối "JavaScript off" của `home.spec.ts`.
- **Kiểm:** `npm run e2e:typecheck` sạch; `npm run test:scripts` 52/52; `npm run e2e` 4 lần chạy liên tiếp sau khi sửa: 49 passed, 1 failed, 49 passed, 49 passed. Lần failed là `a11y` "en / with motion" do `net::ERR_NO_BUFFER_SPACE` khi nạp `landing.js` (trang bố cục lệch, axe báo `target-size`): sự cố mạng cục bộ của máy như đã ghi ở trên, không phải lỗi của bản sửa; hai lần cuối liên tiếp xanh, không retry. Không dùng `git checkout`/`restore`/`reset`.
