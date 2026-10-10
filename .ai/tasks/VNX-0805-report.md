# VNX-0805 — Implementer report

Implementer: Claude subagent. Plan: `.ai/plans/VNX-0805-plan.md` (APPROVED). Runbook and CURRENT-STATUS left to the Reviewer.

## Done

- `scripts/smoke-checks.mjs`: pure check table (`buildChecks`), assertions, `evaluate`, `parseArgs`, `buildBudgetPlan`, `extractLastUpdated`, `run({argv, env, fetch, sleep, now, log})`. No `process.exit`.
- `scripts/smoke.mjs`: thin shell (reads only `BASE_URL`), exits with the code `run` returns.
- `scripts/test/smoke-checks.test.mjs`: 16 `node:test` tests.
- Root `package.json`: `smoke` = `node scripts/smoke.mjs`; `test:scripts` = `node --test "scripts/test/**/*.test.mjs"`.
- `.github/workflows/web-ci.yml`: step `npm run test:scripts` after `npm test`.
- No dependency change; `package-lock.json` and `apps/` untouched.

## Verification

- `npm run test:scripts`: 16 tests, 16 pass, 0 fail.
- `npm test`: 164 files, 1913 tests passed. `npm run typecheck -w apps/web`: exit 0. (`npm ci` was needed: the worktree had no node_modules.)
- `node --check` on both scripts: ok. `node scripts/smoke.mjs --base ftp://x`: prints usage, exit 2, no request sent.
- `git diff --stat origin/main -- package-lock.json apps/`: empty.
- AC10 grep for POST|PUT|DELETE|Cookie|Authorization: no hits; `process.env` appears once, `BASE_URL`, in `smoke.mjs`.
- Production run `npm run smoke` (https://vnx.si, 14 s, exit 0): 64 pass, 0 pass-after-retry, 0 fail; "Privacy: Last updated 2026-10-21". 6 requests hit the rate-limited paths. Table below.
- Not run: AC6 local dry run (`npm run dev` + `--base http://localhost:8787`). Not exercised against the local Worker.

## Deviations from the plan (verified against `apps/web/src` and real responses)

1. `/vi/ops` (any prefixed ops path) is a plain localized 404 with NO `Cache-Control: no-store` and NO `X-Robots-Tag`: `app.ts` mounts `opsHeaders` only on `/ops` and `/ops/*`. The check asserts only the 404 status for `/vi/ops`, and no-store+noindex for `/ops` and `/ops/x`. Not asserted either way as an app defect; the page body still carries `<meta name="robots" content="noindex">` (error pages are `noindex`). Reviewer to judge whether prefixed `/vi/ops` should be sealed too (ADR-010 says canonical English, no prefix).
2. `/go/...` 404s carry the default `Referrer-Policy: strict-origin-when-cross-origin` (only the 302 sets `origin`, `go.ts` `redirectTo`). So `origin` is asserted only on the `--slug` 302; 404s are asserted noindex + no-store.
3. `/p/<missing>` 404: noindex comes from `<meta name="robots">` (no `X-Robots-Tag` header, no `Cache-Control: no-store`). Assert accepts either header or meta.
4. `--slug` checks use HEAD (not GET) for `/p/<slug>` and `/go/p/<slug>/demo`: both handlers answer HEAD without recording a view or click, so the stats-noise risk in the plan's OQ-3 does not arise. The 302 `Location` must be https; no cookie check (HEAD carries no state).
5. `/auth/verify` with no token returns 400 (invalid-link page) with `Referrer-Policy: same-origin` and `no-store`; asserted as such (status 400 is the observed behaviour, not documented in the plan).
6. Auth redirect check expects exact `Location` `"<prefix>/login?next=<encodeURIComponent(prefix+path)>"` (matches production for all 12 cases).
7. `robots.txt` on production is prefixed by a Cloudflare Managed block (content signals, bot Disallow lists); the app's own lines follow. Asserts match whole lines so this is tolerated. The Sitemap line is exact-origin only on `vnx.si`.
8. `node --test` on Node 22 does not accept a bare directory (`scripts/test/` => MODULE_NOT_FOUND); the script uses the quoted glob `"scripts/test/**/*.test.mjs"` (Node expands it; works on Linux CI).
9. Table size: 64 requests (9 public pages x 4 locales, 12 redirects, ...), not ~60: 36 pages. Duration about 14 s.
10. Sitemap private-path check compares `<loc>` paths by segment (so `/media-kit` is not mistaken for `/me`).

## Open items for the Reviewer

- Item 1 above (`/vi/ops` unsealed) and item 3 (`/p` 404 without `no-store`; likely intended since public pages are cacheable).
- `www.vnx.si` not checked (out of scope, VNX-0804).
- AC6 local dry run was not executed by the Implementer.

## Production smoke result (https://vnx.si, exit 0, 14 s)

All 64 rows PASS (0 retry, 0 FAIL), grouped:

| Group | Checks | Result |
|---|---|---|
| page (9 paths x 4 locales: /, /products, /builders, /request, /for-builders, /privacy, /terms, /contact, /login) | 36 | PASS (200) |
| login-redirect (/admin, /hub, /me x 4 locales) | 12 | PASS (303, exact Location) |
| ops-sealed /ops, /ops/x; ops-not-localized /vi/ops | 3 | PASS (404) |
| product-404 /p/<none> x 4 locales | 4 | PASS (404, noindex) |
| go-404 /go/p/<none>/demo, /go/<none> | 2 | PASS (404, noindex, no-store) |
| robots.txt, sitemap.xml | 2 | PASS |
| headers / , headers 404 page, headers /auth/verify | 3 | PASS |
| privacy last-updated (2026-10-21), api/health | 2 | PASS |

Summary line: `64 pass, 0 pass-after-retry, 0 fail`. Re-verified after resume: `npm run test:scripts` 16/16 pass; `npm test` 164 files / 1913 tests and typecheck exit 0 (run before the interruption).

## Vòng sửa 1 (review F3, F7)

- F3: check `ops-not-localized /vi/ops` giờ assert 404 + `Cache-Control: no-store` + noindex (header hoặc meta). Chú thích nêu thiếu `X-Robots-Tag` là VNX-2502 F3, dời sang VNX-2508. Test mới: pass với no-store + meta noindex; fail khi thiếu no-store hoặc noindex. Mô hình app giả trong test cho `/vi/ops` có `no-store`.
- F7: mỗi dòng kết quả in ngay khi check xong (tiêu đề in trước, tóm tắt ở cuối). Hằng `MAX_CONSECUTIVE_NETWORK_ERRORS = 3`: sau 3 check liên tiếp lỗi mạng ở cả hai lần thử thì in `ABORT`, bỏ phần còn lại, mã thoát 1 (tóm tắt ghi "aborted early"). Check thành công hoặc lỗi không phải mạng thì đặt lại bộ đếm. Test mới: streaming (dòng đầu in trước request cuối), dừng sớm (6 request, mã 1), bộ đếm được đặt lại.
- Kiểm: `npm run test:scripts` 20/20 pass. `npm run smoke` production một lần: 64 pass, 0 pass-after-retry, 0 fail, mã thoát 0, Privacy 2026-10-21.
