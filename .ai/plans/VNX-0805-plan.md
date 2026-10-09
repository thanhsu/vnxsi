# VNX-0805 — Runbook deploy và script smoke · Plan

- **Trạng thái:** Draft (chờ Owner duyệt)
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M8, VNX-0805 (AGENT)
- **Spec:** spec Wave 1 §8.8 (robots, noindex) và phần header bảo mật; không thêm hành vi sản phẩm mới
- **ADR:** ADR-010 (Ops console kín, `/ops` 404), ADR-004 (không ảnh hưởng xếp hạng)
- **Phụ thuộc:** `origin/main` `94206e2`. Không phụ thuộc VNX-0802 (Playwright/axe) hay VNX-0804 (www → apex).
- **Implementer / Reviewer:** Implementer (subagent Sonnet, context mới) viết script và test của script; Reviewer (Claude) viết runbook và review cả hai.

## Vì sao làm bây giờ

Đã có ba lần deploy production (lần 3, 4, 5; 2026-10-06 và 2026-10-07), mỗi lần lặp lại cùng chuỗi bước tay (worktree sạch, migration, deploy, smoke bằng curl). Kiến thức đó nằm rải rác trong `CURRENT-STATUS.md` và chú thích `wrangler.jsonc`. M8 (ra mắt) cần một nguồn duy nhất cho thứ tự deploy, cách khôi phục và một smoke lặp lại được, nhất là vì luật `PRIVACY_NOTICE_GO_LIVE` dễ bị vi phạm khi deploy từ phiên khác.

## Phạm vi

**Trong phạm vi**

1. `docs/runbooks/deploy.md` (mới; tiếng Việt như các tài liệu vận hành khác, lệnh và tên khóa để nguyên).
2. `scripts/smoke.mjs` (I/O) và `scripts/smoke-checks.mjs` (bảng kiểm thuần, không I/O) cùng test `scripts/test/smoke-checks.test.mjs`.
3. Root `package.json`: script `smoke` và `test:scripts`.
4. `.github/workflows/web-ci.yml`: thêm bước `npm run test:scripts` (xem OQ-2).
5. Cập nhật `docs/blueprint/README.md` chỉ khi chỉ mục liệt kê thư mục `docs/` (Reviewer kiểm khi viết runbook).

**Ngoài phạm vi**

- Playwright, axe, kiểm trình duyệt thật: VNX-0802.
- `www.vnx.si` → `vnx.si`: VNX-0804. Runbook ghi `www` vào mục "chưa kiểm"; smoke không kiểm redirect.
- Workflow tự deploy, hoặc tự chạy smoke trên production (CLAUDE.md: không deploy khi Owner chưa nói).
- Smoke có xác thực (đăng nhập, nội dung `/hub`, `/me`), mọi POST và ghi dữ liệu. Smoke chỉ GET/HEAD, không cookie, không secret.
- Các bước "sau D" của M7 cần D1 (dòng `product_daily_stats`, log `public_stats`): vẫn là bước tay của Owner, runbook liệt kê kèm câu `wrangler d1 execute ... --remote` chỉ đọc.
- Sửa mã ứng dụng. Thấy lệch giữa tài liệu và code thì ghi "Ghi nhận" trong `CURRENT-STATUS.md`.
- Chạy thật `d1 time-travel restore` trên production. Runbook chỉ mô tả.
- Sửa `apps/web/wrangler.jsonc` (có test bảo vệ `test/config/wrangler-guard.test.ts`; không cần đổi).

## Phân vai (CLAUDE.md: thứ chạy được do Implementer viết, thứ chỉ mô tả do Reviewer viết)

| Sản phẩm | Ai viết | Ghi chú |
|---|---|---|
| `scripts/smoke*.mjs`, test, `package.json`, `web-ci.yml` | Implementer | Chạy được, có test; handoff `.ai/tasks/VNX-0805-handoff.md`, mọi yêu cầu kiểm bằng một lệnh. |
| `docs/runbooks/deploy.md` | Reviewer (Claude phiên chính) | Tài liệu mô tả. Viết **sau** khi script xong để trích đúng tên script, tham số, mã thoát. |
| Dòng "Production lần N" trong `CURRENT-STATUS.md` | Reviewer | Sau mỗi deploy, theo mẫu trong runbook. |

Thứ tự: Owner duyệt plan → Implementer làm script và test → Reviewer viết runbook → Reviewer review script → Owner duyệt. Nếu Owner muốn giao cả runbook cho Implementer thì phải nói rõ là ngoại lệ.

## Thiết kế

### 1. Runbook `docs/runbooks/deploy.md`

Nguồn: `CURRENT-STATUS.md` (Production lần 3/4/5, "Việc của Owner khi deploy M7", "Việc của Owner trước khi bật ElevenLabs", Nghĩa vụ), chú thích `wrangler.jsonc` (a)–(g), `.ai/reviews/M7-review.md`. Mục lục cố định:

1. **Trạng thái production** (bảng, cập nhật mỗi deploy): commit `main`, version Worker, migration cao nhất đã áp, `PRIVACY_NOTICE_GO_LIVE` hiện hành, tên secret đã đặt (không giá trị), cờ bật/tắt, rule rate limit. Ghi rõ đây là bản chụp ngày X; nguồn sự thật là dòng "Production lần N" mới nhất ở `CURRENT-STATUS.md`.
2. **Trước deploy:** Owner nói rõ "deploy"; cây sạch từ `origin/main` trong worktree riêng (main checkout thuộc phiên khác); không `rm -rf node_modules` (workspace link trỏ vào `apps/web`); `git merge-base --is-ancestor eb45c10 HEAD` phải thành công; `npm ci`; `npm run typecheck -w apps/web`; `npm test`; `npx wrangler d1 migrations list vnxsi --remote` (so với `apps/web/migrations/`).
3. **Thứ tự deploy:** `npm run db:migrate:remote -w apps/web` rồi **ngay sau đó** `npm run deploy -w apps/web` (mã mới có thể cần bảng mới, ví dụ `0014` cho Inquiry; `0006` + mã M4 về `meta.changes`). Mỗi lần: ghi bookmark Time Travel trước khi migrate; xác nhận migration tương thích ngược với mã cũ (có/không).
4. **Luật `PRIVACY_NOTICE_GO_LIVE`:** chỉ commit trên `main` bằng `chore:`; không `--var`, không dashboard; không bao giờ xóa; cách lần deploy mang nó ≥ 14 ngày; mọi deploy sau phải chứa `eb45c10`; Vitest ghim rỗng; phiên bản Privacy xem ở "Last updated" của `/privacy` (smoke in ra); thông báo chỉ hiện cho người đã đăng nhập nên smoke không thấy. Mốc đang chờ: D = 2026-10-21, D+31 = 2026-11-21 (task dọn Privacy hai bản).
5. **Secret và biến:** `TURNSTILE_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `ANALYTICS_SALT` bằng `wrangler secret put`, không bao giờ trong repo; `.dev.vars` chỉ local; `MAIL_FROM` tùy chọn; đếm bắt đầu D 00:00 UTC. Secret chưa đặt (6 secret OAuth của EPIC 26) ghi là "chưa đặt".
6. **Cloudflare ngoài repo (Owner):** rule rate limit (một rule: `/p/*` 4 locale + `/go/*`, 20 request / 10 giây / IP, Block 10 giây); quota cron trigger của tài khoản dùng chung với vsnstock (cần 2: `0 1 * * *`, `5 * * * *`, kiểm slot **trước** lần deploy đầu có cron mới); R2 bucket `vnxsi-media`; Resend sending domain; Turnstile widget; Rocket Loader, Web Analytics, Bot Fight Mode phải tắt (CSP).
7. **Smoke sau deploy:** `npm run smoke`, cách đọc bảng, ngân sách request và lý do (rate limit), 404 thoáng qua do lan truyền (script tự thử lại một lần; vẫn FAIL thì chờ rồi chạy lại một lần trước khi tính rollback), phần kiểm tay còn lại (magic link, form có Turnstile, bước sau D của M7, trình duyệt).
8. **Ghi sổ:** mẫu dòng "Production lần N" (commit, version Worker, migration đã áp, kết quả smoke, lệnh Owner nào cho phép). Task chưa xong khi chưa ghi.
9. **Rollback:**
   - Mã: `npx wrangler deployments list` rồi `npx wrangler rollback <version-id>` (chạy trong `apps/web`). Rollback không đổi D1, secret hay dữ liệu. Chỉ rollback về version đã chứa `eb45c10`; nếu không, roll-forward bằng deploy mới từ cây sửa (rollback về version có `PRIVACY_NOTICE_GO_LIVE` rỗng khi đã có hash là vi phạm luật mục 4).
   - Bảng quyết định ngắn: khi nào rollback, khi nào roll-forward.
   - Migration chỉ đi tới (forward-only), không có "down". Phục hồi dữ liệu bằng D1 Time Travel: `npx wrangler d1 time-travel info vnxsi` (xem mốc), `npx wrangler d1 time-travel restore vnxsi --timestamp=<ISO>` hoặc `--bookmark=<id>`. Restore ghi đè DB hiện tại và mất mọi ghi sau mốc. Cửa sổ lưu: xem OQ-1. Migration thêm bảng/cột vô hại thì roll-forward bằng migration mới, không restore.
   - Mã cũ trên schema mới: thường chịu được bảng/cột thêm, trừ trường hợp đã biết (sau `0006_catalog`, mã trước M4 trả 409 vì trigger FTS làm `meta.changes` khác 1).
10. **Sao lưu D1 khi có bảng ảo FTS5:** `wrangler d1 export` không xuất được DB có bảng ảo (`products_fts`). (a) Ưu tiên Time Travel, không cần export. (b) Export tay: bỏ trigger đồng bộ và `products_fts` → `wrangler d1 export vnxsi --remote --output <file>` → tạo lại bảng ảo, trigger, backfill từ `products`; câu lệnh trích nguyên văn từ `apps/web/migrations/0006_catalog.sql`, không viết lại; thử trên D1 nháp trước (như ghi chú "Deploy sau khi merge M4"); trong lúc đó tìm kiếm catalog trống. File export chứa dữ liệu cá nhân, không vào repo.
11. **Sự cố thường gặp:** `PRIVACY_NOTICE_GO_LIVE` bị mất (deploy từ cây thiếu `eb45c10`); thiếu `0014` làm mọi Inquiry lỗi; cron không đăng ký vì hết quota; 429 khi chạy smoke dày; 403 Origin do `Referrer-Policy: no-referrer` trên trang có form POST.
12. **Bảo trì:** thêm route công khai hay đổi CSP/header thì cập nhật bảng kiểm `scripts/smoke-checks.mjs`; REVIEW-TEMPLATE của task đó nhắc kiểm.

### 2. Vị trí script: root

`scripts/smoke.mjs` ở gốc repo, script npm `smoke` ở root `package.json`. Lý do: (1) không import mã `apps/web`, không cần cấu hình Cloudflare, chỉ cần `fetch` toàn cục của Node; (2) chạy được trên mọi `BASE_URL`, không gắn với workspace; (3) `apps/web/vitest.config.ts` chạy test trong workerd (không có `process`, `node:http`, `node:fs`) và `include` chỉ `test/**/*.test.{ts,tsx}`, nên mã CLI không nên nằm trong cây Vitest. Root `deploy`/`dev` ủy quyền xuống workspace; `smoke` là ngoại lệ vì không cần workspace (ghi lý do trong runbook). Node `>=22.18` (root `engines`) đủ cho `fetch`, `AbortSignal.timeout`, `node:util parseArgs`, `node:test`. Không thêm phụ thuộc, `package-lock.json` không đổi.

### 3. Hành vi `scripts/smoke.mjs`

- Dùng: `npm run smoke -- [--base <url>] [--slug <product-slug>]`; `BASE_URL` env hoặc `--base`; mặc định `https://vnx.si`; bỏ `/` cuối; chỉ nhận `https:` hoặc `http://localhost|127.0.0.1` (chống gõ nhầm sang host lạ). `--slug` tùy chọn (xem OQ-3).
- Mọi request: `GET` hoặc `HEAD`, `redirect: "manual"`, `User-Agent: vnxsi-smoke/1`, timeout 10 s, không cookie, không header xác thực. Script chỉ đọc biến môi trường `BASE_URL`.
- **Bảng kiểm** (dữ liệu thuần trong `smoke-checks.mjs`; mỗi dòng: `id`, `path`, `method`, `expectStatus`, danh sách assert trên `{status, headers, body}`, cờ `prodOnly`). Danh sách route chốt lúc implement bằng đối chiếu `apps/web/src/app.ts`, `routes/`, sitemap; không bịa route.
  1. Trang công khai ở 4 locale (`/`, `/vi`, `/zh-hans`, `/zh-hant` và `/products`, `/builders`, `/request`, `/for-builders`, `/privacy`, `/terms`, `/contact`, `/login`): 200, `content-type` HTML.
  2. Chuyển hướng xác thực: `/admin`, `/hub`, `/me` (cả bản có tiền tố locale): 303, `Location` về `/login` (có tiền tố locale tương ứng).
  3. `/ops`, `/ops/x`, `/vi/ops`: 404, `Cache-Control` có `no-store`, `X-Robots-Tag` có `noindex`.
  4. `/p/<slug-không-có>` (4 locale), `/go/p/<không-có>/demo`, `/go/<không-có>`: 404 và noindex (header `X-Robots-Tag` hoặc `<meta name="robots">`). Implementer đối chiếu code thực tế; nếu một route 404 hiện chưa có noindex thì **không** viết assert sai, báo Reviewer.
  5. `robots.txt`: 200, `text/plain`, có `Disallow: /ops`, `Disallow: /go/`, `Disallow: /hub`, `Disallow: /vi/hub`, `Allow: /media/products/`, dòng `Sitemap:` kết thúc `/sitemap.xml` (sitemap dùng `APP_ORIGIN`, nên so đúng origin chỉ khi `prodOnly`).
  6. `sitemap.xml`: 200, `application/xml`, có `<urlset`, có `/privacy` và `/for-builders`, không chứa `/ops`, `/go/`, `/hub`, `/admin`, `/me`.
  7. Header bảo mật trên `/` và trên một trang 404: CSP có `default-src 'self'`, `frame-ancestors 'none'`, **không** có `unsafe-inline`/`unsafe-eval`; `X-Content-Type-Options: nosniff`; `X-Frame-Options: DENY`; `Strict-Transport-Security` có `max-age=31536000` (`prodOnly`); `Referrer-Policy: strict-origin-when-cross-origin` ở trang thường; `Referrer-Policy: origin` trên `/go/...` (kể cả 404 của `/go/`, vì `NO_INDEX` trong `go.ts` chỉ gắn `origin` ở 302: Implementer đối chiếu thực tế, và dùng 302 thật khi có `--slug`). `/auth/verify` `same-origin`: chỉ kiểm nếu GET trả được mà không cần token.
  8. `/privacy` (en): trích `Last updated: YYYY-MM-DD` bằng regex và **in ra** (không PASS/FAIL theo giá trị vì đổi theo giai đoạn); FAIL chỉ khi thiếu hẳn dòng này.
  9. `GET /api/health` → 200, `{"ok":true}`.
- **Ngân sách request.** Rule Cloudflare: 20 request / 10 s / IP trên `/p/*` (4 locale) và `/go/*`. Request vào đường bị phủ: `/p/<x>` × 4, `/go/p/<x>/demo`, `/go/<x>`, cộng `--slug` tối đa 2: tổng ≤ 8. Quy tắc: (a) chạy tuần tự; (b) nghỉ ≥ 600 ms giữa hai request tới đường bị phủ; (c) bộ đếm cửa sổ trượt 10 s trong script không bao giờ phát quá **10** request bị phủ/cửa sổ (chờ cho đến khi có chỗ), kể cả retry; (d) gặp 429 thì không FAIL ngay: chờ 11 s, thử lại một lần, in cảnh báo "bị rate limit". Đường khác nghỉ 100 ms. Tổng khoảng 60 request, dưới 30 giây.
- **Thử lại:** check FAIL được thử lại đúng một lần sau 3 s (404 thoáng qua do lan truyền ngay sau deploy). Kết quả: `PASS`, `PASS (retry)` hoặc `FAIL`; tóm tắt đếm riêng `PASS (retry)` để Owner thấy lan truyền chậm. Lỗi mạng/timeout xử lý như FAIL có retry.
- **Đầu ra:** bảng `STATUS | check | detail` bằng `console.log` thuần (không thư viện, màu không bắt buộc), dòng tóm tắt `N pass, M pass-after-retry, K fail`, dòng "Privacy: Last updated ...". Mã thoát: `0` không FAIL; `1` có FAIL; `2` tham số sai (không gửi request nào). Thư viện `smoke-checks.mjs` không gọi `process.exit`; `smoke.mjs` là lớp mỏng gọi `run()` rồi thoát.

### 4. Kiểm thử script

- Tách phần thuần (`smoke-checks.mjs`: bảng kiểm, `evaluate(check, response)`, `buildBudgetPlan`, `parseArgs`, `extractLastUpdated`, `run({fetch, sleep, now})` nhận `fetch`/đồng hồ giả) khỏi lớp I/O mỏng `smoke.mjs`.
- Test bằng **`node:test` + `node:assert`** có sẵn trong Node, tệp `scripts/test/smoke-checks.test.mjs`, chạy bằng `node --test scripts/test/` qua script root `test:scripts`. Không thêm gói nào.
- Vì sao không Vitest: pool của `apps/web` chạy trong workerd, thiếu `process`/`node:*`, `include` chỉ trong `apps/web/test`; kéo `.mjs` ngoài workspace vào pool dễ vỡ và làm `npm test` chậm. `npm test` root giữ nguyên (`npm run test --workspaces --if-present`); `test:scripts` chạy riêng, và (OQ-2) thêm vào `web-ci.yml`.
- Phủ test: (1) `evaluate`: CSP có `unsafe-inline` ⇒ FAIL; `/ops` thiếu `no-store` ⇒ FAIL; 303 sai `Location` ⇒ FAIL; (2) retry: lần 1 trả 404, lần 2 trả 200 ⇒ `PASS (retry)`, không có lần 3; (3) ngân sách: với bảng thật, số request bị rule phủ ≤ 8, và với đồng hồ giả không có cửa sổ 10 s nào chứa > 10 request bị phủ; (4) mọi dòng bảng có `method` thuộc {GET, HEAD}; (5) mã thoát 0/1/2 từ `run`; (6) `BASE_URL` không phải https/localhost bị từ chối; (7) chạy chống một `node:http` server giả trong test (trả 500 ⇒ mã 1; trả đáp án đúng ⇒ mã 0).
- Chạy khô với local: `npm run dev` + `npm run smoke -- --base http://localhost:8787` (sau `npm run db:migrate:local -w apps/web`); Implementer dán đầu ra vào báo cáo. Bảng chỉ dùng slug không tồn tại nên PASS cả khi D1 local trống.

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Không thêm phụ thuộc | `git diff --exit-code origin/main -- package-lock.json apps/web/package.json` |
| AC2 | Cú pháp hợp lệ | `node --check scripts/smoke.mjs && node --check scripts/smoke-checks.mjs` |
| AC3 | Test script xanh | `npm run test:scripts` |
| AC4 | Bộ test và typecheck cũ không đổi | `npm test` ; `npm run typecheck -w apps/web` |
| AC5 | Tham số sai: mã thoát 2, không gửi request | `node scripts/smoke.mjs --base ftp://x; echo $?` in `2` |
| AC6 | Chạy local PASS hết, mã thoát 0 | `npm run dev` (nền) rồi `npm run smoke -- --base http://localhost:8787; echo $?` in `0` |
| AC7 | Smoke bắt được lỗi thật | test "CSP unsafe-inline fails" và test server giả trả 500 ⇒ mã 1 |
| AC8 | Ngân sách không vượt rule | test "rate-limited paths <= 8, window <= 10" |
| AC9 | Retry đúng một lần | test "retries once then PASS (retry)" |
| AC10 | Chỉ đọc, không secret | test "all checks are GET or HEAD"; `grep -nE "POST|PUT|DELETE|Cookie|Authorization" scripts/smoke.mjs scripts/smoke-checks.mjs` chỉ ra các dòng cấm/chú thích đã duyệt, và `grep -n "process.env" scripts/*.mjs` chỉ có `BASE_URL` |
| AC11 | CI chạy test script | `grep -n "test:scripts" .github/workflows/web-ci.yml` (nếu OQ-2 = có) |
| AC12 | Runbook đủ 12 mục, lệnh có thật | `grep -c "^## " docs/runbooks/deploy.md` ≥ 12; Reviewer rà mỗi `npm run X` có trong `package.json` và mỗi lệnh wrangler khớp `npx wrangler d1 time-travel --help`, `npx wrangler rollback --help`, `npx wrangler deployments list --help` |
| AC13 | Runbook nêu luật Privacy | `grep -n "eb45c10" docs/runbooks/deploy.md` và `grep -n "PRIVACY_NOTICE_GO_LIVE" docs/runbooks/deploy.md` đều có kết quả |
| AC14 | Không có bí mật | `grep -nE "[0-9a-f]{64}" docs/runbooks/deploy.md scripts -r` rỗng; job `gitleaks` xanh |
| AC15 | Smoke production khớp lần 4/5 (Owner/Reviewer chạy khi được phép, chỉ GET, **không** thuộc Implementer) | `npm run smoke` mã thoát 0 |
| AC16 | `CURRENT-STATUS.md` phản ánh task; đóng nghĩa vụ "M8 (runbook)" | Reviewer cập nhật sau verdict |

## Rủi ro

- **Rule rate limit:** smoke chạm ngưỡng cho 429 giả. Giảm bằng ngân sách, cửa sổ trượt và cảnh báo riêng.
- **Lệch giữa smoke và code:** thêm route hay đổi header mà không sửa bảng. Giảm bằng mục bảo trì (runbook mục 12) và assert theo mẫu chuỗi.
- **Nhiễu thống kê:** `--slug` thật làm tăng một lượt xem hoặc click sau D (script không có cookie để khử trùng). Vì vậy mặc định tắt, `User-Agent` nhận diện; xem OQ-3.
- **Runbook lỗi thời:** bảng trạng thái ghi "bản chụp ngày" và trỏ về `CURRENT-STATUS.md`.
- **Lệnh wrangler phụ thuộc phiên bản (`^4.147`):** chỉ ghi lệnh đã xác nhận bằng `--help`, không chạy `--remote`.
- **Sửa CI:** thêm một bước vào `web-ci.yml`; rủi ro thấp, Owner duyệt cùng plan.

## Câu hỏi mở

- OQ-1: Gói D1 của tài khoản và cửa sổ Time Travel thực tế (số ngày) là bao nhiêu? Runbook cần con số để nêu hạn phục hồi, plan không đoán. Owner xác nhận trên dashboard; nếu không, runbook chỉ ghi "tra `wrangler d1 time-travel info`".
- OQ-2: Thêm bước `npm run test:scripts` vào `.github/workflows/web-ci.yml`? (Mặc định: có.)
- OQ-3: Giữ `--slug` (kiểm 302 `/go/p/<slug>/demo` và cookie nhưng tạo một lượt xem hoặc click nhiễu sau D), tắt mặc định? Hay bỏ khỏi phạm vi? (Mặc định: giữ.)
- OQ-4: Runbook tiếng Việt (như `CURRENT-STATUS.md`) hay tiếng Anh? (Mặc định: tiếng Việt, lệnh để nguyên.)
