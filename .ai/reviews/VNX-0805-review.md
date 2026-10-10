# VNX-0805 — Review

- **Reviewer:** Claude (subagent review độc lập, Opus), 2026-10-10
- **Ngày:** 2026-10-10
- **Đã đọc:** plan `.ai/plans/VNX-0805-plan.md` (APPROVED), báo cáo `.ai/tasks/VNX-0805-report.md`, toàn bộ diff `origin/main...HEAD` (`94206e2..05bf83d`: `scripts/smoke.mjs`, `scripts/smoke-checks.mjs`, `scripts/test/smoke-checks.test.mjs`, root `package.json`, `.github/workflows/web-ci.yml`, `docs/runbooks/deploy.md`), mã ứng dụng mà bảng kiểm dựa vào (`app.ts`, `auth/ops.ts`, `http/security-headers.ts`, `http/no-store.ts`, `routes/go.ts`, `routes/seo.ts`, `views/seo.ts`, `routes/auth.tsx`, `product-page.tsx`), `apps/web/wrangler.jsonc`, `apps/web/migrations/0006_catalog.sql`, `CURRENT-STATUS.md`, ADR-010, review VNX-2502, mã nguồn `wrangler` 4.147.0 trong `node_modules` (để kiểm các câu runbook về rollback, time travel và `d1 execute --file`).
- **Không có handoff** `.ai/tasks/VNX-0805-handoff.md` (xem F9).
- **Lệnh đã chạy lại:**
  - `npm run test:scripts`: 16 test, 16 pass, 0 fail.
  - `node --check scripts/smoke.mjs && node --check scripts/smoke-checks.mjs`: ok.
  - `node scripts/smoke.mjs --base ftp://x`: in usage, mã thoát `2`, không request.
  - `git diff --exit-code origin/main -- package-lock.json apps/web/package.json`: sạch; `git diff --stat origin/main -- apps/ package-lock.json`: rỗng.
  - `npm test -w apps/web -- --maxWorkers=2`: lần 1 thoát 1 với thông báo "hanging process" của Vitest (máy đang chạy nhiều workerd của phiên khác; `apps/` không đổi); lần 2: **164 file / 1913 test pass**. `npm run typecheck -w apps/web`: exit 0.
  - Grep AC10 (`POST|PUT|DELETE|Cookie|Authorization`): không có dòng nào; `process.env` chỉ một chỗ, `BASE_URL`, trong `smoke.mjs`. Grep AC14 (`[0-9a-f]{64}`): rỗng.
  - `npx wrangler <lệnh> --help` (4.147.0) cho mọi lệnh trong runbook: `deployments status|list`, `versions list`, `rollback [version-id] -m/--message`, `deploy --message`, `d1 time-travel info --timestamp`, `d1 time-travel restore --bookmark|--timestamp` ("within the last 30 days"), `d1 export --remote --output`, `d1 migrations list --remote`, `secret list|put`: đều có.
  - **AC6 (lần đầu chạy):** `npm run db:migrate:local -w apps/web` (0001–0016 ✅), `npx wrangler dev --port 8788 --ip 127.0.0.1` (cổng 8787 đang bị workerd của phiên khác chiếm), rồi `npm run smoke -- --base http://127.0.0.1:8788`: **64 pass, 0 pass-after-retry, 0 fail, mã thoát 0, ~12 s**, `Privacy: Last updated 2026-10-21`. Đã dừng đúng tiến trình dev của mình (wrangler PID 20864 và cây con), cổng 8788 trống lại.
  - **AC15:** `npm run smoke` (https://vnx.si), chạy **một lần**: **64 pass, 0 pass-after-retry, 0 fail, mã thoát 0**, `Privacy: Last updated 2026-10-21`. Thêm một `GET https://vnx.si/vi/ops` bằng curl (đường không thuộc rule rate limit) để xác minh F3.

## Verdict

**APPROVE WITH CHANGES.** Không có BLOCKER hay HIGH. Script đúng phạm vi: chỉ GET/HEAD, không cookie, không secret, nhịp request an toàn với rule Cloudflare, mã thoát đúng, test có ý nghĩa. Runbook đủ 12 mục, lệnh có thật, thứ tự deploy và luật `PRIVACY_NOTICE_GO_LIVE` khớp `wrangler.jsonc` và `CURRENT-STATUS.md`. Một MEDIUM ở runbook (F1, `d1 execute --file` đi đường import API) và vài LOW về độ chính xác phải sửa trước khi merge.

## Đã kiểm, đúng

- **Chỉ đọc.** Mọi dòng bảng là `GET` hoặc `HEAD` (test "every check is GET or HEAD" và test chạy bảng thật kiểm cả `redirect: "manual"`, header duy nhất `user-agent: vnxsi-smoke/1`). `fetch` của Node không có cookie jar. `--slug` dùng `HEAD`: `go.ts` (`respond`, `respondProduct`) và `product-page.tsx` chỉ ghi click/lượt xem khi `c.req.method === "GET"`, nên lệch #4 của báo cáo là đúng và an toàn hơn plan. `/auth/verify` GET không token chỉ đọc D1 (`peekLoginToken`, `describeToken`).
- **Ngân sách request so với rule (20 req / 10 s / IP, Block 10 s).** Bảng thật có 6 request bị rule phủ (8 với `--slug`). `pace()` được gọi trước **mọi** lần gửi, kể cả retry thường và retry sau 429: ≥ 600 ms giữa hai request bị phủ, cửa sổ trượt 10 s không quá 10. Trường hợp xấu nhất (429 lặp lại) là 4 request cho một check, vẫn bị cửa sổ chặn ở 10/10 s. Chờ 11 s sau 429 dài hơn Block 10 s. Test "30 covered checks" chứng minh limiter trên đồng hồ giả.
- **Mã thoát:** `0` / `1` / `2` đúng; `2` không gửi request (test và chạy thật). Lỗi mạng/timeout xử lý như FAIL có retry.
- **Từng assert so với mã:** CSP và header khớp `SECURITY_HEADERS`; 303 `Location` khớp `<prefix>/login?next=<encodeURIComponent>` (12 ca xanh trên production); `/ops`, `/ops/x` nhận `opsHeaders`; `/go/*` 404 có `NO_INDEX` (`no-store` + `X-Robots-Tag`) nhưng `Referrer-Policy` mặc định (chỉ `redirectTo` đặt `origin`), đúng lệch #2; `/p/<không có>` noindex qua `<meta>` (lệch #3); `robots.txt` khớp `renderRobots` (khối Managed của Cloudflare đứng trước được chịu nhờ so cả dòng); sitemap so `<loc>` theo đoạn đường dẫn (lệch #10); `/auth/verify` 400 + `same-origin` + `no-store` (lệch #5).
- **Test có ý nghĩa:** `fetch`/đồng hồ giả, kèm một server `node:http` thật (500 ⇒ 1, đúng ⇒ 0); phủ CSP `unsafe-inline`, `/ops` thiếu `no-store`, 303 sai `Location`, HSTS chỉ production, retry đúng một lần, lỗi mạng, 429, ngân sách, `parseArgs`.
- **CI:** bước `npm run test:scripts` sau `npm test` trong `web-ci.yml` (Node 22 hỗ trợ glob của `node --test`; workflow không lọc `paths` nên chạy cả khi chỉ đổi `scripts/`).
- **Runbook:** mọi `npm run X` có trong `package.json` (root hoặc `apps/web`); `npm run deploy -w apps/web -- --message` truyền xuống `wrangler deploy --message`. Thứ tự migrate → deploy ngay; bookmark Time Travel trước migrate. Luật `eb45c10` khớp chú thích (a)–(c) của `wrangler.jsonc`. Rollback: version lần 4 `8e1e141d` và lần 3 `411e3c9f` không chứa `eb45c10`, nên "không có đích trước `55e19e11` → roll-forward" đúng. `0006_catalog.sql` chỉ chứa `products_fts`, 3 trigger (tên khớp câu `DROP` ở mục 10) và backfill, nên chạy lại cả file sau khi bỏ là đúng về nội dung; `d1 execute` không ghi `d1_migrations` (đúng). Các dữ kiện bảng mục 1, 5, 6 (migration cao nhất `0016`, `MAIL_FROM` mặc định, `MAIL_DRIVER=console`, cron, R2, custom domain, `workers_dev`, Turnstile fail closed) khớp mã. Không có chỗ nào trái `CLAUDE.md`.
- **Sáu câu người viết runbook tự đánh dấu chưa kiểm:**
  1. Vị trí xem gói trên dashboard (mục 6): hedge chấp nhận được, giữ.
  2. Restore trả bookmark để hoàn tác: **đã xác minh** trong mã wrangler 4.147.0 ("To undo this operation, you can restore to the previous bookmark: …"). Giữ.
  3. Rollback và secret: **sửa câu chữ**, xem F2.
  4. Version đang chạy (`deployments status` vì `secret put` tạo version mới): hedge đúng (`ANALYTICS_SALT` đặt cùng ngày lần 5), giữ.
  5. `d1 execute --remote --file migrations/0006_catalog.sql`: nội dung an toàn, nhưng **đường thực thi khác** `migrations apply`, xem F1.
  6. `git worktree remove` và link `node_modules` trên Windows: chấp nhận được. Link workspace trỏ vào `apps/web` **của chính worktree đó** (đã thấy: `node_modules/@vnxsi/web -> /d/DOCS/SUPHAM/GIT/vnxsi-0805/apps/web`), vốn cũng bị xóa khi gỡ worktree; nguy hiểm chỉ là `rm -rf node_modules` riêng lẻ trong worktree còn dùng. Sửa nhỏ ở F6.
- **`/vi/ops` và dòng "Production lần 3":** không phải hồi quy. Ở `d447cf4` (lần 3) `app.ts` đã chỉ gắn `opsHeaders`/`opsNotFound` cho `/ops` và `/ops/*`, y như bây giờ. Việc `/{locale}/ops*` chưa trả 404 kín là phát hiện **F3 (LOW) của VNX-2502**, đã dời sang **VNX-2508** (chưa làm). ADR-010 chỉ cấm tạo route `/vi/ops`, và không có route đó. Câu "`/vi/ops` 404 kín có `no-store` + `X-Robots-Tag`" trong dòng lần 3 nói quá: thực tế có `no-store` (từ `noStorePrivate`), **không** có `X-Robots-Tag`, thân là trang 404 thường có `<meta name="robots" content="noindex">` (xem F3, F4).

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai sửa |
|---|---|---|---|---|---|
| F1 | MEDIUM | `docs/runbooks/deploy.md:229-233` | `wrangler d1 execute --remote --file` không đi đường query như `migrations apply` (đường đã tạo `products_fts` lần đầu) mà đi **import API** (`executeRemotely`: init → upload → ingest → poll). Wrangler cảnh báo DB "unavailable to serve queries" trong lúc chạy, và chưa ai thử import API với `CREATE VIRTUAL TABLE … fts5` + trigger. Runbook không nói hai điều này. | Đổi bước 3 thành đường giống `migrations apply`: `npx wrangler d1 execute vnxsi --remote --command "$(cat migrations/0006_catalog.sql)"` (Git Bash). Trong PowerShell: `--command (Get-Content -Raw migrations/0006_catalog.sql)`. File vẫn nguyên văn. Nếu giữ `--file`, ghi rõ: dùng import API, DB tạm không phục vụ, phải thử **đúng lệnh này** trên D1 nháp. Thêm một câu: `d1 export` cũng có thể chặn DB trong lúc chạy, nên làm giờ thấp điểm. | Reviewer-writer |
| F2 | LOW | `docs/runbooks/deploy.md:186` | "Version tạo trước một lần `secret put` có thể mang bộ secret cũ: sau rollback chạy `secret list`" chưa đúng. Wrangler 4.147 phát hiện secret đã đổi, **liệt kê chúng và hỏi xác nhận**; xác nhận nghĩa là chạy version đó với **giá trị secret cũ**. `secret list` chỉ in tên nên không phát hiện được. | Thay bằng: "`wrangler rollback` liệt kê secret đã đổi kể từ version đích và hỏi xác nhận. Xác nhận thì version đó chạy với giá trị cũ (khóa đã xoay sẽ quay về khóa cũ đã thu hồi; `ANALYTICS_SALT` đặt sau version đó sẽ mất). Sau rollback, `secret put` lại các secret được liệt kê (tạo version mới), rồi smoke." | Reviewer-writer |
| F3 | LOW | `scripts/smoke-checks.mjs:146-151`; `docs/runbooks/deploy.md:150,153`; báo cáo lệch #1 | Câu "`/vi/ops` không có `Cache-Control: no-store`" sai. `noStorePrivate` (`http/no-store.ts`, `PRIVATE` có `ops` trên đường đã bỏ tiền tố locale) gắn `no-store`. Đã thấy trên local và trên production (`GET https://vnx.si/vi/ops` → 404, `cache-control: no-store`, có meta noindex, không có `X-Robots-Tag`). Hệ quả: check yếu hơn mức có thể. | **Implementer:** check `ops-not-localized /vi/ops` assert thêm `headerIncludes("cache-control","no-store")` và `noindexAny`. Sửa chú thích: thiếu `X-Robots-Tag` là VNX-2502 F3, dời sang VNX-2508; khi 2508 xong thì assert như `/ops`. Thêm test tương ứng. **Reviewer-writer:** mục 7 dòng 150/153 ghi "`/vi/ops`: 404, `no-store`, noindex bằng meta; thiếu `X-Robots-Tag` là VNX-2502 F3, sẽ đóng ở VNX-2508". | Implementer + Reviewer-writer |
| F4 | LOW | `.ai/context/CURRENT-STATUS.md:17` | Dòng "Production lần 3" ghi "`/vi/ops` 404 kín có `no-store` + `X-Robots-Tag`". Thực tế (đã đúng như vậy từ `d447cf4`) có `no-store`, không có `X-Robots-Tag`, thân là trang 404 thường. | Không sửa lịch sử. Khi cập nhật `CURRENT-STATUS.md` cho VNX-0805, thêm một mục "Ghi nhận" đính chính và trỏ về VNX-2502 F3 / VNX-2508. Không phải hồi quy. | Reviewer-writer |
| F5 | LOW | `docs/runbooks/deploy.md:32` | Dẫn "quy tắc trong `.claude/settings.local.json`" làm nguồn. File này bị git-ignore (ignore toàn cục), chỉ có ở main checkout của một máy, không nằm trong repo. | Lấy nguồn là `CLAUDE.md` (Luật cứng: không deploy nếu Owner chưa nói rõ). Nếu cần, nhắc thêm "quyền cục bộ của máy Owner" là chi tiết môi trường. | Reviewer-writer |
| F6 | LOW | `docs/runbooks/deploy.md:64,252` | `cmd /c rmdir /s /q <thư mục>`: trong Git Bash, MSYS đổi `/c`, `/s`, `/q` thành đường dẫn, nên lệnh không chạy như mô tả. Câu về `git worktree remove` đúng nhưng thiếu lý do. | Ghi "chạy trong PowerShell hoặc cmd" (Git Bash thì `cmd //c rmdir //s //q`). Thêm lý do: link `node_modules/@vnxsi/web` trỏ vào `apps/web` của chính worktree đó, nên gỡ cả worktree là an toàn; nguy hiểm chỉ là `rm -rf node_modules` riêng lẻ trong worktree còn dùng. | Reviewer-writer |
| F7 | LOW | `scripts/smoke-checks.mjs:277-300` | Bảng chỉ in khi chạy xong. Khi site sập (timeout), trường hợp xấu nhất khoảng 64 × (10 + 3 + 10) s ≈ 25 phút không có dòng nào, đúng lúc sự cố. | In từng dòng ngay khi check xong (giữ dòng tóm tắt ở cuối). Hoặc dừng sớm với mã `1` sau N (ví dụ 3) lỗi mạng liên tiếp. Thêm test với fetch giả luôn ném lỗi. | Implementer |
| F8 | SUGGESTION | `docs/runbooks/deploy.md:99,243,254-261` | "Giá trị đúng là `2026-10-21`" sẽ lỗi thời. `legal/content.ts` dùng chung ngày "Last updated" cho Terms và Privacy, và task dọn Privacy hai bản sau D+31 cũng đổi nó. | Mục 12 thêm: "Task đổi văn bản Terms/Privacy cập nhật ngày mong đợi ở mục 4 và mục 11". | Reviewer-writer |
| F9 | LOW (quy trình) | `.ai/tasks/` | Không có `VNX-0805-handoff.md`, trong khi `CLAUDE.md` bước 4 và plan dòng 39 yêu cầu. Báo cáo có, AC trong plan kiểm được bằng lệnh, nên không ảnh hưởng chất lượng. | Ghi vào "Ghi nhận" của `CURRENT-STATUS.md`. Với mô hình subagent, lưu prompt giao việc thành handoff. | Reviewer-writer |
| F10 | SUGGESTION | plan mục 12 | Plan nói "REVIEW-TEMPLATE của task đó nhắc kiểm" bảng smoke, nhưng `.ai/templates/REVIEW-TEMPLATE.md` không đổi (cũng không có trong danh sách phạm vi 1–5). | Ghi "Ghi nhận"; nếu Owner đồng ý thì thêm một dòng vào template ở task tài liệu sau. | Reviewer-writer |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `git diff --exit-code origin/main -- package-lock.json apps/web/package.json` sạch |
| AC2 | ✓ | `node --check` cả hai file ok |
| AC3 | ✓ | `npm run test:scripts`: 16/16 |
| AC4 | ✓ | `apps/` không đổi; `npm test -w apps/web -- --maxWorkers=2`: 164 file / 1913 test (lần 2; lần 1 thoát vì Vitest báo hanging process, do môi trường); typecheck exit 0 |
| AC5 | ✓ | `node scripts/smoke.mjs --base ftp://x` → `2`, không request |
| AC6 | ✓ | Local `http://127.0.0.1:8788` (8787 bị phiên khác chiếm): 64 pass, mã thoát 0. Không kiểm khi base không phải production: HSTS (ở `headers /`, `headers 404 page`) và origin của dòng `Sitemap:`; chỉ kiểm đuôi `/sitemap.xml`. Không chạy `--slug` (D1 local trống). Kết quả hợp lý: `/vi/ops` local cũng có `no-store` (F3), `Privacy` local là `2026-10-21` vì `vars` có ngày và hôm nay ≥ D−14 |
| AC7 | ✓ | test "CSP with unsafe-inline fails", test server thật trả 500 ⇒ 1 |
| AC8 | ✓ | test "rate-limited paths <= 8, window <= 10" và test 30 check |
| AC9 | ✓ | test "retries once then PASS (retry); no third request" |
| AC10 | ✓ | test GET/HEAD; grep không có dòng; `process.env` chỉ có `BASE_URL` |
| AC11 | ✓ | `web-ci.yml`: `- run: npm run test:scripts` |
| AC12 | ✓ (sau F1, F2) | 12 mục `## `; mọi `npm run` có thật; mọi lệnh wrangler khớp `--help` 4.147.0 |
| AC13 | ✓ | `eb45c10`: 11 dòng; `PRIVACY_NOTICE_GO_LIVE`: 7 dòng |
| AC14 | ✓ (một phần) | Grep rỗng. Job `gitleaks` chưa chạy vì nhánh chưa push |
| AC15 | ✓ | Production 2026-10-10: 64 pass, 0 retry, 0 fail, mã thoát 0, Privacy `2026-10-21` |
| AC16 | ⏳ | Reviewer cập nhật `CURRENT-STATUS.md` sau verdict cuối, kèm F4, F9, F10 trong "Ghi nhận" |

## Nghĩa vụ để lại cho task sau

- **VNX-2508:** khi `/{locale}/ops*` thành 404 kín (`opsNotFound` + `opsHeaders`), siết check `/vi/ops` trong `scripts/smoke-checks.mjs` giống `/ops` (có `X-Robots-Tag`) và sửa mục 7 của runbook.
- **VNX-0804 (`www` → apex):** thêm check redirect `www.vnx.si` vào bảng smoke và bỏ dòng "chưa kiểm" ở mục 7.
- **Task dọn Privacy hai bản (sau 2026-11-21) và mọi task đổi Terms/Privacy:** cập nhật ngày "Last updated" mong đợi ở mục 4 và mục 11 của runbook.
- **Lần sao lưu FTS5 thật đầu tiên (Owner):** thử đúng lệnh ở mục 10 (sau F1) trên D1 nháp, rồi ghi kết quả vào runbook.

## Re-review (2026-10-10, controller Opus)

**Verdict cuối: APPROVE.** Vòng sửa 1: `6d9f0f3` (Implementer: F3 check `/vi/ops` có `no-store` + noindex, F7 in từng dòng và dừng sau 3 lỗi mạng liên tiếp) và `9e38683` (Reviewer-writer: F1, F2, F3, F5, F6, F8 trong runbook). Đã chạy lại: `npm run test:scripts` 20/20; `git diff --stat origin/main -- apps/ package-lock.json` rỗng; smoke production (Implementer, một lần) 64/64. F4, F9, F10 ghi vào `CURRENT-STATUS.md` mục Ghi nhận.
