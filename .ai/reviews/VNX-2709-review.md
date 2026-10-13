# VNX-2709 — Review (cổng ra EPIC 27) và Merge readiness của nhánh

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-13
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` mục "Task VNX-2709", "Task VNX-2708", "Pháp lý", "Nghĩa vụ để lại cho Reviewer" và mục delta (theo quy ước EPIC 27, mục task của plan là handoff); `.ai/context/CURRENT-STATUS.md` (mọi nghĩa vụ "VNX-2709"); báo cáo `.ai/tasks/VNX-2709-report.md` (`a0f91fd`); toàn bộ diff `2f2020c..349c6ae` (`seo.ts`, `request-board-gate.test.ts`, `seo/request-board.test.ts`, `seo/robots.test.ts`, `e2e/README.md`, `scripts/smoke-checks.mjs`, `scripts/smoke.mjs`, `scripts/test/smoke-checks.test.mjs`); `docs/runbooks/deploy.md`; `apps/web/wrangler.jsonc`; các review `.ai/reviews/VNX-27*-review.md` và `EPIC27-plan-delta-review.md`.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `a0f91fd`):**
  - `npm run typecheck -w apps/web`: exit 0. `npm run e2e:typecheck`: exit 0.
  - `npm test -w apps/web -- test/public/request-board-gate.test.ts`: **12 / 12**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **211 file, 2737 passed**, exit 0 (khớp báo cáo).
  - `npm run test:scripts`: **58 / 58**.
  - `npm run e2e` (một lần, `workers: 1`): **85 passed (1,6 phút)**. Sau đó đã xóa `e2e/.state`, `playwright-report`, `test-results`; không còn `workerd`/`wrangler`.
  - **Đột biến smoke (bản sao trong scratchpad, không vào repo):** bỏ `/requests*` khỏi `isRateCovered` → 1 test đỏ; bỏ điều kiện "mỗi public id đúng 4 lần" trong `sitemapBoard` → 1 test đỏ. Test smoke không xanh rỗng.
  - **Probe HTTP (file tạm trong `apps/web/test/zzprobe/`, đã xóa ngay):** trạng thái production (`REQUEST_BOARD_GO_LIVE = ""`, cờ tắt), builder `approved` không có interest: `/hub/invitations` và `/vi/hub/invitations` 200 **có** `<section id="interests">` với tiêu đề và câu `hub.interests.empty`; `/request` không có `name="country"` và `name="publish"`. Xem M-1.
  - `git fetch origin`; `git merge-base --is-ancestor origin/main HEAD`; `git diff --stat origin/main...HEAD -- apps/web/migrations` (mục "Merge readiness").

## Verdict

**VNX-2709: APPROVE.** Test vòng đời đi thật qua route và middleware (`createApp().request`), đúng thứ tự, đếm chính xác trong DB riêng của file, phủ đủ 7 bước của plan và gần như mọi nghĩa vụ "VNX-2709" (bảng dưới). Smoke chỉ GET/HEAD, ngân sách đúng ở cả bốn tổ hợp chế độ, kiểm cấu trúc sitemap `--board` hợp lý. S-1/S-2 của 2705b gộp đúng. Các phát hiện LOW/SUGGESTION không chặn.

**Merge readiness: NOT READY**, vì một phát hiện MEDIUM (M-1) ở mã của VNX-2706a, tìm thấy khi kiểm "cờ tắt, ngày rỗng thì người dùng không thấy gì thay đổi": mọi builder `approved` sẽ thấy một mục mới nhắc tới "public request board" trên `/hub/invitations` ngay khi nhánh được deploy, trước ngày báo trước và trước khi tính năng tồn tại. Sửa rất nhỏ (một điều kiện và một test). Sau khi M-1 được sửa và re-review, mọi điều kiện merge khác đều đạt.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M-1 | MEDIUM | `apps/web/src/routes/hub-invitations.tsx:83`, `apps/web/src/views/hub/InvitationsPage.tsx:40-43, 98` | Route luôn truyền `interests={rows}` (mảng, kể cả rỗng) và view render `InterestsSection` khi `interests` truthy. Khi cổng tắt (production sau merge: ngày rỗng, cờ tắt), mọi builder `approved` mở `/hub/invitations` thấy mục "Requests you're interested in" với câu "No requests here yet. When you tell us you're interested in a request on the public request board, it appears here." (VI tương tự). Đây là thay đổi người dùng thấy được khi bảng tắt, nhắc tới một tính năng chưa có, trước thời gian báo trước của Privacy/Terms (B − 14), mâu thuẫn với tiền đề "cờ tắt, ngày rỗng: chưa có gì thay đổi với người dùng" của mọi task EPIC 27 và với bước 1 của VNX-2708. Phán quyết 6 của review 2706a ("Mục Hub không theo cổng: CHẤP NHẬN") chỉ xét trường hợp sau công tắc khẩn cấp (đã có interest), không xét lúc chưa từng bật. Probe HTTP xác nhận (EN và VI). Không có rủi ro riêng tư. | Chỉ render mục khi `boardOn` **hoặc** có ít nhất một dòng (`rows.length > 0`). Giữ nguyên S-2 của 2706a (cổng tắt mà có interest: vẫn hiện trạng thái, tiêu đề không link). Test trong `test/hub/interests.test.ts`: cổng tắt (cả ngày rỗng lẫn cờ tắt) + không có interest → trang 200 không chứa `id="interests"` và không chứa `hub.interests.title`/`empty` (EN, VI); cổng tắt + có interest → mục vẫn hiện (test S-2 hiện có); cổng bật + không có interest → mục và câu `empty` hiện (test hiện có). Đỏ khi thiếu code: có (probe ở trên là phiên bản đảo của test đó). Không đổi câu chữ. Task sửa riêng (đề xuất `VNX-2706c`), Implementer làm, Reviewer re-review. |
| L-1 | LOW | `apps/web/test/public/request-board-gate.test.ts:358-389, 425-496, 323-356` | Ba mục nghĩa vụ chỉ được phủ ngoài test vòng đời: (a) 2706a "request đóng → Hub 'Not invited' và trần 30 được giải phóng": lúc client chọn, A đã `invited`, B đã `dismissed`, không còn interest `pending` nào, nên bước 8 khẳng định "Not invited" của B là do Dismiss, không do đóng; (b) 2704b "edit vẫn chạy khi cổng tắt": bước 11 chỉ có reject và unpublish; (c) 2706b "History có dòng" sau Dismiss. Cả ba đã có test riêng: `test/hub/interests.test.ts:40-69` (closed → Not invited), `test/public/request-board-interest.test.ts:202` (trần, request đóng không giữ chỗ, ghi DB trực tiếp), `test/ops/marketplace-request-board.test.ts:897` (gate off: reject, edit, unpublish), `test/ops/interested-builders.test.ts:577` (History). | Không chặn. Nếu sửa M-1 thì có thể gộp: thêm builder C' có interest `pending` trên `main` trước bước 8 rồi khẳng định Hub "Not invited" và một interest mới được nhận sau khi đóng; thêm một POST `publication/edit` ở bước 11; khẳng định dòng History ở bước 7. Tùy chọn. |
| S-1 | SUGGESTION | `apps/web/test/public/request-board-gate.test.ts:299, 335, 348, 380, 450, 483` | Trang Hub được lấy bằng `html()`, không qua `pub()`, nên không vào bộ quét bước 12; báo cáo viết "every public/builder-facing page". Hub đã có test riêng "no request id, no client data" (`test/hub/interests.test.ts:75`). | Dùng `pub()` cho các lần lấy Hub để bộ quét phủ cả chúng. |
| S-2 | SUGGESTION | `scripts/smoke-checks.mjs` (`sitemapBoard`) | Ở `--board`, `/requests` (trang danh sách) không bị kiểm số lần xuất hiện (phải là 0 hoặc 4). | Thêm điều kiện 0 hoặc `LOCALE_PREFIXES.length` cho `/requests`, như cho từng public id. |

## Đối chiếu tiêu chí chấp nhận

### Plan VNX-2709, test vòng đời (7 bước)

| Bước plan | Đạt? | Bằng chứng |
|---|---|---|
| 1. Client gửi `/request` có ô và `country=VN` → `pending_review`, 404 công khai | ✓ | Bước 1 (client **chưa đăng nhập**, Turnstile giả, xác nhận qua magic link thật: mạnh hơn plan) và `optedInClient` (đã đăng nhập) ở bước 2 |
| 2. Ops sửa và publish → list/detail 200, HTML không có bản gốc/danh tính, sitemap, email "đã sửa" | ✓ | Bước 3 (email = `requestBoardPublishedEmail(edited: true)` từng chữ, link trong email mở 200 khi chưa đăng nhập), bước 4 (4 locale, canonical, hreflang, sitemap), bước 12 (quét) |
| 3. Builder `approved` "I'm interested" (ghi chú, product) → `pending`; client không thấy, không email; Ops thấy | ✓ | Bước 6 |
| 4. Ops mời (đường M6) → `invited`, `/hub/invitations`; đề xuất; client chọn → `builder_selected` | ✓ | Bước 7, 8 (đề xuất qua fixture M6 `proposeOn`, chấp nhận: sai khác ghi trong báo cáo) |
| 5. Closed, noindex, không canonical/hreflang, ngoài list và sitemap, không form; `closed_at + 30 ngày` → 404 | ✓ | Bước 8, 9 (`+30d − 1ms` 200, `+30d` 404) |
| 6. Client gỡ listing `published` → 404 ngay; cờ tắt → mọi bề mặt 404, ngoài sitemap; gỡ vẫn chạy khi cờ tắt | ✓ | Bước 10 (404 cho chưa đăng nhập, client, builder, Ops), bước 11 |
| 7. Audit đúng một dòng mỗi hành động, không câu chữ | ✓ | `actionsOf` so cả dãy ở mỗi bước; bước 12 quét `data` của mọi dòng `request_publication.*`/`request_interest.*` |

### Nghĩa vụ "VNX-2709" trong `CURRENT-STATUS.md`

| Nghĩa vụ (nguồn) | Đạt? | Ở đâu |
|---|---|---|
| (2704b) Ba email: publish có sửa và không sửa, reject hoặc unpublish kèm lý do | ✓ | Bước 3 (sửa / không sửa), bước 11 (reject và unpublish, so `.text` với template) |
| (2704b) Publish khi cổng tắt: không nút, POST 409, không audit, không email; reject/edit/unpublish vẫn chạy | ✓ một phần | Bước 11: không nút, 409, không ghi, không email, reject và unpublish chạy. **Edit** chỉ ở `test/ops/marketplace-request-board.test.ts:897` (L-1b) |
| (2705b a) Listing rời sitemap khi đóng, gỡ, tắt cờ; `/requests` rời sitemap và `noindex` khi dưới 5 (theo độ lệch) | ✓ | Bước 8 (đóng, 5 → 4), bước 10 (gỡ), bước 11 (cờ tắt) |
| (2705b b) Smoke mặc định kiểm `/` không có `href="/requests"` | ✓ | `noBoardLink` trên `/` × 4 và `/for-builders` × 4; test smoke "default (board off)" |
| (2705b c) `--board`: sitemap không có `<loc>` mang id request | ✓ (giới hạn đã nêu) | `sitemapBoard` chứng minh cấu trúc (chỉ `/requests` và id 26 ký tự, mỗi id 4 lần, không đường riêng tư, không `request_id`); hình dạng không phân biệt được public id với ULID, phần "là public id" do bước 4 Vitest khẳng định |
| (2705b d) Gộp S-1 (sitemap dùng `listings.length`) và S-2 (test robots "on", đếm truy vấn dưới ngưỡng) | ✓ | `seo.ts` bỏ `countOpenPublicationsAll` (đúng: `listSitemapRequests` chỉ trả listing `open`, cùng định nghĩa với ngưỡng, nên `listings.length` = số open; bước 4 và 8 khẳng định sitemap theo ngưỡng); `robots.test.ts` bật cờ cho lượt "on"; test 8 truy vấn đo hai phía ngưỡng |
| (2706a) Interest: gửi → Hub pending → mời → Hub invited + link; gửi → Dismiss → Hub "Not invited" | ✓ | Bước 6, 7 |
| (2706a) Request đóng → Hub "Not invited" và trần 30 được giải phóng | ✗ trong vòng đời | Chỉ ở test riêng (L-1a) |
| (2706a) Cổng tắt → POST interest/rút 404, Hub vẫn hiện trạng thái, tiêu đề không link | ✓ | Bước 11 |
| (2706b) ADR-004: gợi ý byte-identical khi có interest; `requestMatching().suggestions` = `suggestBuilders` | ✓ | Bước 6 (so HTML khối gợi ý trước/sau, so id + điểm, điểm của A) |
| (2706b) Thẻ "Interests waiting" → `?interests=pending` → request → Invite (một audit, Hub "Invited" + link) và Dismiss (Hub và trang "Not invited", History có dòng); Dismiss chạy khi cổng tắt | ✓ một phần | Bước 6, 7, 11. **History** chỉ ở `test/ops/interested-builders.test.ts:577` (L-1c) |
| (2707b) Vòng đời đi qua `/privacy`, `/terms` với câu chữ board thật | ✓ | Bước 5 (EN, VI, ranh giới `B − 14` từng mili-giây, "Last updated: B"); ranh giới với B production ở `legal/request-board-versions.test.ts` |
| (Reviewer) Runbook mục 9: sitemap trễ tới 1 giờ sau khi tắt cờ | ✓ | `4a20bb3` |

### Smoke (`scripts/smoke-checks.mjs`)

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Chỉ GET/HEAD, không cookie, không ghi | ✓ | Mọi check mới `method: "GET"`; test "both modes … send GET/HEAD only" |
| `isRateCovered` tính `/requests`, `/requests/*` (4 locale), cả hai chế độ | ✓ | `rest === "/requests" \|\| rest.startsWith("/requests/")`; test: `/requestsx` và `/me/requests/ABC` không bị tính |
| Số bị phủ mỗi chế độ, lịch chờ ≤ `WINDOW_MAX` trong `WINDOW_MS` | ✓ | Reviewer tự đếm `buildChecks`: mặc định 69 request / 11 phủ; `--slug` 71 / 13; `--board` 66 / 8; `--board --slug` 68 / 10, khớp test. `pace()` là cửa sổ trượt (bỏ dấu cũ ≥ 10 s, chờ khi đủ 10, cách ≥ 600 ms), retry 429 và retry FAIL cũng đi qua `pace()`; `assertWindow` chạy trên đồng hồ giả cho cả bốn tổ hợp. Kể cả khi `/requests*` dùng chung bộ đếm với `/p/*`, ≤ 10 / 10 s vẫn dưới một nửa ngưỡng 20 |
| Mặc định: `/requests` 404 (4 locale), `/requests/zz-…` 404, `/` không link, sitemap không `/requests` | ✓ | Cả 404 đều kèm `noindexAny`; route thật trả `errorResponse(c, "notFound", 404)` (trang 404 có meta noindex) |
| `--board`: 200 HTML, không `public`/`max-age`, Referrer-Policy không `no-referrer`, 404 + noindex, sitemap | ✓ | Route list chưa đăng nhập không gửi cache header (comment `request-board.tsx:46`), đã đăng nhập `no-store` |
| `parseArgs` có `board`, vẫn từ chối cờ lạ | ✓ | test `parseArgs` |
| Sai chế độ thì FAIL | ✓ | test "the wrong mode fails" (cả hai chiều) |

### Rà soát cuối (checklist plan)

| Mục | Đạt? | Bằng chứng |
|---|---|---|
| Không `featured\|boost\|urgent\|sponsored`, `dangerouslySetInnerHTML`, `style=`, `<script` mới | ✓ | Báo cáo; diff 2709 chỉ có test, script, `seo.ts` (2 dòng) |
| `REQUEST_BOARD_GO_LIVE` vẫn `""` | ✓ | `wrangler.jsonc:42` |
| `npm run e2e` toàn bộ xanh, `e2e:typecheck`, `test:scripts` | ✓ | 85 / 85, exit 0, 58 / 58 |
| CI job `e2e` xanh trên nhánh | — | Chưa push nên chưa có CI; kiểm khi mở PR |
| `e2e/README.md` | ✓ | Câu "Chưa kiểm" đã bỏ "request board", có con trỏ tới test vòng đời; bảng ngân sách POST đúng (2709 không thêm POST). Reviewer không cần sửa thêm |

### Tài liệu Reviewer (Phần B)

`docs/runbooks/deploy.md` cập nhật ở `4a20bb3`: mục 1 (bản chụp theo lần deploy 6: `b2d3c3c`, `bb832ca1`, `0017`, "Last updated" Terms `2026-10-11` / Privacy `2026-10-21`, `REQUEST_BOARD_GO_LIVE` chưa có trên production, rule chưa phủ `/requests*`); mục 2.4 (`0018` chịu được bởi mã đang chạy); mục 4 (luật B: chọn B, guard, đọc pháp lý trước khi commit B, chuyển bản Privacy/Terms ở B − 14 theo ngày, "Last updated" mong đợi, mọi deploy sau phải từ cây chứa commit B, thứ tự bật 6 bước); mục 5; mục 6 (rule `/requests*` trước khi bật cờ); mục 7 (mặc định giả định bảng tắt và FAIL trên bảng bật, `--board` sau go-live và mọi deploy sau đó, số request và số bị phủ chính xác, nội dung kiểm của hai chế độ, kiểm tay); mục 9 (rollback chỉ về version chứa commit B, công tắc khẩn cấp: 60 giây cache cờ, sitemap trễ tới 1 giờ, câu chữ pháp lý theo ngày không theo cờ, smoke sau khi tắt); mục 11, 12.

Một điểm thứ tự cần Owner biết: runbook đặt "đọc pháp lý Q16 xong" **trước** commit B (không chỉ trước khi bật cờ), theo nghĩa vụ của review 2707b, vì câu chữ bảng lên `/privacy`, `/terms` từ B − 14 chỉ theo ngày.

## Merge readiness (nhánh `feat/epic27-request-board` so với `origin/main`)

Kiểm chỉ đọc, sau `git fetch origin` (`origin/main` = `04b3bc9`, "docs: record production deploy 6").

| Điều kiện | Kết quả | Bằng chứng |
|---|---|---|
| Nhánh chứa `origin/main` | ✓ | `git merge-base --is-ancestor origin/main HEAD` đúng (merge `8165f1d`); `origin/main` không có commit mới nào chưa vào nhánh, nên không có xung đột |
| Migration chỉ có `0018_request_board.sql` | ✓ | `git diff --stat origin/main...HEAD -- apps/web/migrations`: 1 file, 42 dòng thêm; file không có `INSERT` (không bật cờ, không công khai hồi tố) |
| `REQUEST_BOARD_GO_LIVE = ""`, `PRIVACY_NOTICE_GO_LIVE = "2026-10-21"` | ✓ | `apps/web/wrangler.jsonc:34, 42`; guard `test/config/wrangler-guard.test.ts` xanh; dòng thứ tự deploy cho `0018` có ở comment (dòng 75-76) |
| Cờ `request_board` mặc định tắt | ✓ | Key thứ 11 trong `FLAG_KEYS`; không migration nào chèn `feature_flags`; chỉ seed e2e local (`e2e/seed/build-seed.mjs:176`) bật nó |
| Mọi review EPIC 27 kết thúc APPROVE | ✓ | 2702a, 2702b, 2703a, 2703b, 2704a, 2704b, 2705a, 2706a, 2706b: re-review APPROVE; 2702c, 2705b, 2707a, 2707b: APPROVE; plan delta: APPROVE_AFTER_FIXES, các sửa đã làm ở `ee7af8d`, không còn mục mở; 2709: APPROVE (review này) |
| `CURRENT-STATUS.md` phản ánh EPIC 27 xong trừ VNX-2708 | ✓ | Cập nhật cùng review này |
| Không có gì người dùng thấy thay đổi khi cờ tắt, ngày rỗng | ✗ | M-1 (Hub). Chi tiết dưới |

**Khi cờ tắt và ngày rỗng, những gì thay đổi ở production:**

- **Công khai (không đổi):** `/requests`, `/requests/:publicId`, POST interest/rút đều 404 (`test/http/request-board-gate.test.ts`, bước 11, ngày rỗng ở bước 11 cuối); `/request` không có ô quốc gia, không ô opt-in, `publish=1`/`country` gửi giả bị bỏ qua (`test/public/request-form.test.ts:257`, probe); footer và `/for-builders` không link (`test/legal/footer.test.ts`, `test/public/for-builders.test.ts`, bước 11); sitemap và robots như cũ; `/privacy`, `/terms` giữ bản hiện tại vì `selectLegal` cần B (Terms `2026-10-11`, Privacy M7 `2026-10-21`); không thông báo board; không email mới.
- **Client đã đăng nhập (không đổi):** `/me/requests/:id` không có khối nào cho request không có publication khi cổng tắt (`test/me/request-board.test.ts:156`); mọi request hiện có đều không có publication.
- **Builder đã đăng nhập (ĐỔI, M-1):** `/hub/invitations` có thêm mục "Requests you're interested in" với câu rỗng nhắc tới "public request board".
- **Chỉ staff (đổi, chấp nhận được, nội bộ):** `/ops` có hai thẻ mới "Public requests to review" và "Interests waiting" (số 0); danh sách Requests của Ops có cột "Public" và bộ lọc `?public=pending`, `?interests=pending`; khối "Public listing" và "Interested builders" không hiện khi request không có publication (`routes/ops-marketplace.tsx:186, 214`; `test/ops/marketplace-request-board.test.ts:163`), tức mọi request hiện có; `/admin/flags` có thêm dòng `request_board` (tắt).
- **D1:** cột `requests.country` (NULL) và hai bảng rỗng sau khi áp `0018`.

**Verdict merge: NOT READY.** Lý do duy nhất: M-1. Sau khi `VNX-2706c` (hoặc tên khác controller chọn) sửa M-1, Reviewer re-review và cập nhật verdict này thành READY. Nếu controller vnxsi-72 hoặc Owner quyết **chấp nhận** M-1 (hiện mục Hub trước go-live), verdict thành READY mà không cần sửa; quyết định đó phải ghi vào "Quyết định phát sinh". Merge, push và deploy vẫn chờ lệnh rõ ràng.

## Nghĩa vụ để lại cho task sau

- **VNX-2706c (mới, trước merge):** sửa M-1 như cột "Đề xuất"; có thể gộp L-1 và S-1 vào cùng task (tùy chọn). Không đổi câu chữ, không đổi route khác. Re-review chạy lại `test/hub`, test vòng đời, toàn bộ suite và `npm run e2e` (spec `request-board-interest.spec.ts` dùng Hub với cờ bật nên không đổi).
- **VNX-2708 (Owner):** theo `docs/runbooks/deploy.md` mục 4 "Thứ tự bật" (6 bước), mục 6 (rule `/requests*`), mục 7 (`--board` sau go-live). Khi commit B: Reviewer ghi SHA vào runbook mục 4 và mục 2 bước 2.
- **Khi mở PR:** kiểm CI job `e2e` xanh trên nhánh (plan 2709, chưa kiểm được vì chưa push).
- S-2 (smoke `/requests` 0 hoặc 4 lần): tùy chọn, có thể làm cùng task smoke sau.

## Re-review sau VNX-2706c (2026-10-13)

- **M-1:** **Đóng** ở `d519213` (review `.ai/reviews/VNX-2706c-review.md`: APPROVE). `/hub/invitations` chỉ có mục interest khi cổng bật hoặc builder có dòng interest; test mới cho cổng tắt (cờ tắt và ngày rỗng, EN và VI) xanh.
- **S-1:** **Đã làm** ở `d519213` (Hub qua `pub()`), kèm một LOW mới (L-1 của review 2706c: miễn trừ `main.title` áp cho mọi builder thay vì chỉ builder được mời sau khi mời; không chặn).
- **L-1, S-2 của review này:** giữ nguyên, không chặn.
- **Lệnh:** typecheck exit 0; `test/hub/interests.test.ts` + `test/public/request-board-gate.test.ts` 18/18; toàn bộ 211 file / 2739 passed. `npm run e2e` không chạy lại (D: dưới 300 MB); lần chạy 85/85 ở trên là trên `a0f91fd`.

### Verdict merge cuối

**READY để merge với bảng tắt** (`REQUEST_BOARD_GO_LIVE = ""`, cờ `request_board` tắt). Mọi điều kiện ở mục "Merge readiness" đạt; danh sách "những gì thay đổi khi cờ tắt" giờ không còn mục nào người dùng ngoài staff thấy được (Hub đã sửa). Điều kiện còn lại khi mở PR: CI job `e2e` xanh trên nhánh. Merge, push, deploy vẫn chờ lệnh rõ ràng; VNX-2708 là của Owner.
