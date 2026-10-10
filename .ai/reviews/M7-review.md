# M7 (VNX-0701 … VNX-0707) — Review

- **Reviewer:** Claude Opus điều phối. Mỗi task có reviewer độc lập riêng, cộng một lượt review toàn nhánh (Opus). Riêng Task 6 viết code bằng `gpt-5.6-sol` (Codex); Opus review.
- **Ngày:** 2026-10-07
- **Đã đọc:**
  - `CLAUDE.md`.
  - Header plan `docs/superpowers/plans/2026-10-05-vnxsi-m7-metrics.md` (dòng 1–232): Owner (a)–(f), Q1, Global Constraints, Review Focus 1–8.
  - Spec Wave 1 §5.2, §5.8–5.9, §6, §8.4, §8.8, §8.11, §9, §10; phụ lục monetization §2.
  - ADR-004, ADR-007, ADR-010.
  - Sổ điều phối `.superpowers/sdd/2026-10-05-vnxsi-m7-metrics/progress.md`: mọi ruling, quyết định Owner, minor để lại.
  - Diff `origin/main...f811e60 -- apps/web` (105 file, +5985/−125) và báo cáo merge.
- **Lệnh đã chạy lại:**
  - Lượt review toàn nhánh tại `f811e60`: `npm run typecheck -w apps/web` → exit 0; `npm test` → 163 file, 1907/1907.
  - Sau lượt sửa, tại `37f86bc`: 164 file, 1913/1913.
- **Trạng thái nhánh:** đã gộp `origin/main` hai lần, `35e4c91` ở `f811e60` và `d35264f` ở `0e44251`. Merge vào `main` được, chưa push.

## Verdict

**APPROVE**, với một điều kiện còn mở trước khi merge vào `main`: Owner chạy checklist trình duyệt của Task 8b.

Lượt review toàn nhánh trả **READY_AFTER_FIXES**. Không có Critical, không có lỗi code runtime. Bốn phát hiện Important (I1–I4) đều thuộc tài liệu và quy trình, và đã sửa ở `37f86bc` cùng commit tài liệu đi kèm review này. Phần hành vi chạy trên trình duyệt (`home.js`, CSS scroll-driven, reduced-motion, cảm ứng, trình đọc màn hình) không test được trong workerd. Phần này Owner kiểm bằng tay theo `CHECKLIST.md` mà controller đã gửi.

## Phát hiện của review toàn nhánh và cách xử lý

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| I1 | Important (tài liệu) | `CURRENT-STATUS.md` (lấy bản của `main` khi gộp) không có trạng thái M7. Dòng 14 còn gọi `ANALYTICS_SALT` là công tắc. | Đã viết lại: dòng tóm tắt, bảng task, mục "Việc của Owner khi deploy M7", quyết định Owner/Reviewer, đóng các nghĩa vụ M7 cũ, Ghi nhận. |
| I2 | Important (tài liệu) | Addendum Privacy của ADR-012 (`d35264f`) chỉ nằm trong `privacy.md`. Từ D−14, `/privacy` hiện `privacy-m7.md`, nên VNX-2607 sẽ "mất" câu chữ nếu chỉ sửa `privacy.md`. | Đã gộp `main` (`0e44251`). Đã ghi nghĩa vụ "sửa cả hai phiên bản" ở `privacy.md` (mục ADR-012, "Cách áp dụng"), ở phần đầu `privacy-m7.md` và trong `CURRENT-STATUS.md`. |
| I3 | Important (tài liệu) | Phần đầu `privacy-m7.md` còn để trống: không có trạng thái, không có đối chiếu code. | Đã điền: trạng thái, khi nào hiện, quy tắc hai phiên bản, đối chiếu code M7 (`37f86bc`). `test/legal` 37/37 xanh. |
| I4 | Important (quy trình deploy) | Chú thích `wrangler.jsonc` thiếu ba điều: luật "D cách lần deploy chứa nó ≥ 14 ngày"; click cũng bị chặn khi biến rỗng; mọi lần deploy sau phải chứa commit ngày. | `37f86bc`: chú thích (a)–(g). |
| M1 | Minor | Chưa có test bảo vệ cấu hình (cron, ngày, salt không nằm trong `vars`). | `37f86bc`: `test/config/wrangler-guard.test.ts`. |
| M2 | Minor | Job giờ đọc thừa khoảng 5 lần mỗi lượt. | Ghi nhận. |
| M3 | Minor | `/p/:slug` thêm một lần đọc D1 cho người đã đăng nhập sau go-live (`findOpsAccess`). | Ghi nhận. |

Lượt sửa `37f86bc` còn gộp thêm các minor loại (b) của từng task:
- Task 1: nhánh xung đột của `inquiryOpenedStatement`.
- Task 2: tên test cũ.
- Task 3c: guard `.html(` có đối chứng dương.
- Task 3: docstring `trackProductClick`; regex quét SQL ghi có `\s+` và mẫu `ON CONFLICT DO UPDATE`.
- Task 10: thụt dòng locale, căn giữa link ngôn ngữ ở footer, assert status 200.
- Task 7b: marker tách khối, `formatDuration`, `relativeTime`.

## Đối chiếu Review Focus 1–8 (toàn nhánh)

| Focus | Đạt? | Bằng chứng |
|---|---|---|
| 1. Không đếm sai | ✓ | Thứ tự kiểm: cổng go-live → salt → bot → GPC → builder chủ → `isStaff` (admin hoặc thành viên Ops, có test Viewer). HEAD không đếm. Trước go-live, lượt xem không đếm và `/go/p/` lưu hash null. Dedupe theo ngày UTC, product, loại. |
| 2. Riêng tư | ✓ | `0014`/`0015` không có IP, email, user id. CHECK 64 ký tự hex ở `product_view_dedupe`. Hash theo khóa ngày có tiền tố. Cookie `__Host-`, `HttpOnly`, `Lax`, hết hạn nửa đêm UTC, chỉ đặt ở `GET /p/:slug` được đếm, kèm `Cache-Control: private`. |
| 3. Open redirect `/go/p/` | ✓ | Đích chỉ lấy từ DB; `validatePublicUrl` kiểm hai lượt; editor dùng cùng hàm. Route đứng trước catch-all; trả 302 với `no-store`, `noindex`, `Referrer-Policy: origin`. |
| 4. Ngưỡng | ✓ | Mọi key `public_stats` có test n−1/n, qua domain và qua route (7a/7b). Founding cần 6. |
| 5. Xếp hạng không đọc tiền | ✓ | `RANKING_FILES` có `db/catalog.ts`, `jobs/hourly.ts`, `routes/home.tsx`, `views/home/{Trending,TopBuilders,TopProducts}.tsx`. Có test từ tiền tệ. `MONEY_ALLOWED` chỉ thêm `ops-monetization.tsx` (từ `main`). |
| 6. Cron | ✓ | Hai trigger, có test cấu hình. `scheduled` rẽ theo cron; cron lạ thì log và bỏ qua. Job giờ upsert theo key; bước hỏng giữ dòng cũ. |
| 7. Không bịa số | ✓ | Homepage đọc `public_stats` đúng một lần, ≤ 8 câu D1. Không có chữ số trong `views/home/*.tsx` và trong giá trị `home.*` của locale. Số thật nằm trong HTML SSR. |
| 8. Privacy khớp code | ✓ | `privacy-m7.md` so từng dòng với `PRIVACY_M7`. Cửa sổ go-live là một hệ thống: thông báo D−14 → D+31; Privacy M7 từ D−14; đếm từ D 00:00 UTC; salt là điều kiện thứ hai. Không đường nào đếm, đặt cookie hay hiện chữ M7 ngoài cửa sổ. |

## Review từng task

Chi tiết nằm trong sổ điều phối, mỗi task có dòng "review (opus) … Approved":

| Task | Commit | Kết quả |
|---|---|---|
| 1 | 961adff | Approved. |
| 2 | d18614a, 45a894e | Approved sau vòng sửa 1. Báo cáo lần đầu khai sai, vì implementer dùng bản plan cũ. |
| 5 | 39176a9, c079871 | Approved. |
| 4 | 8efb41b, 842a819 | Approved sau vòng sửa 1: test link product, SQL `:443`. |
| 6 | 32af9b3 | Approved. |
| 3c | c1ec708 | Approved. Plan được thiết kế lại để khỏi truyền prop qua khoảng 70 file. |
| 3p | 4572243 | Approved. Văn bản pháp lý khớp từng byte với danh sách sửa. |
| 3 | 960b8b9 | Approved. |
| 9 | 26272e6 | Approved. |
| 10 | 61fa123 | Approved. |
| 7a | 43907d7 | Approved. |
| 7b | 8d6237c | Approved. |
| 8a | b767b2e | Approved. |
| 8b | 5c3d740, 458d87f | Approved sau vòng sửa 1: cascade reduced-motion, màu chữ số, count-up, tooltip cảm ứng. |

## Lệch roadmap và spec đã duyệt

- **VNX-0706 không cutover.** Theo A2, landing VNX-0708 giữ nguyên, các khối dữ liệu nằm bên dưới. Cổng ra M7 được đọc lại thành "các khối ẩn đúng khi dưới ngưỡng".
- **Spec §5.2:** CTA "Become a builder" vẫn dẫn tới `/login?next=/hub/apply`, không tới `/for-builders`.
- **Phụ lục 2.5:** thiếu salt thì không cộng gì.
- **Privacy:** có hai phiên bản, chọn theo ngày (Owner 2026-10-06); việc đếm có cổng ngày riêng.
- **Hero:** không dựng lại. Deck của landing đã theo Q1.

## Nghĩa vụ để lại

Danh sách đầy đủ ở `CURRENT-STATUS.md`. Chính:
- Owner kiểm trình duyệt Task 8b trước khi merge.
- Thứ tự deploy M7 (mục "Việc của Owner khi deploy M7").
- Mỗi thay đổi Privacy sửa cả hai phiên bản cho tới task dọn. VNX-2607 cũng vậy.
- Task dọn sau D + 31 ngày.
- Execution plan marketing/designer (spec addendum / ADR sau M7, gồm bảng request công khai).
