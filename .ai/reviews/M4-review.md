# M4 (VNX-0401 … VNX-0404) — Review

- **Reviewer:** Claude (điều phối) + reviewer độc lập cho từng task (Sonnet) và review toàn nhánh (Opus)
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `docs/superpowers/plans/2026-10-04-vnxsi-m4-catalogue.md`, báo cáo của Implementer từng task, diff `921cf99..93f6f08`
- **Lệnh đã chạy lại (review toàn nhánh):** `npm run typecheck -w apps/web` → exit 0; `npm test` → 61 file, 390/390 test xanh (~47 s); test tập trung catalog/seo/public/db/products → 72/72
- **Lệnh đã chạy lại (sau lượt sửa, Reviewer):** `npm run typecheck -w apps/web` → exit 0; `npm test` → 61 file, 391/391 test xanh

## Verdict

APPROVE. Review toàn nhánh trả "With fixes" (0 BLOCKER, 2 MEDIUM, còn lại LOW). Owner duyệt sửa F1–F4 (2026-10-04); lượt sửa ở `bcb76d6` đã được re-review: cả 4 phát hiện đã xử lý, không có lỗi mới. F5, F7 để sau; F6 Reviewer sửa trong plan; F8 Owner giữ nguyên ("From $19").

## Phát hiện của review toàn nhánh

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM | `apps/web/wrangler.jsonc:39` | Comment thứ tự deploy chưa có `0006_catalog` (nghĩa vụ trong plan). Code trước M4 kiểm `meta.changes === 1`; sau khi áp 0006, trigger FTS làm số đó lớn hơn 1 → mọi lần sửa product đang publish trả 409. Migration 0006 và code M4 phải lên cùng lúc. | Thêm `0006_catalog` vào danh sách migration và một dòng "chạy migration rồi `npm run deploy` ngay sau đó" |
| F2 | MEDIUM | `apps/web/test/catalog/search.test.ts` ("pages 24 at a time"), `test/catalog/ranking.test.ts` (2 test dựng dữ liệu) | Không có timeout riêng; một lần chạy toàn bộ đã gặp timeout 5 s dưới tải. Task 3, 4, 5 đã dùng 30 s cho test tương tự. | Thêm `30_000` cho các test dựng ≥ 5 product |
| F3 | LOW | `apps/web/src/routes/hub-products.tsx:104-105` | Comment còn ghi "results[0] changed 0 rows" sau khi đổi sang `RETURNING id` | Sửa thành "returned no row" |
| F4 | LOW | `apps/web/test/catalog/ranking.test.ts` | Kiểm "không có cột trả tiền" chỉ quét thân `CREATE TABLE`; `ALTER TABLE products ADD COLUMN boost_…` lọt qua | Quét thêm `ALTER TABLE <bảng> ADD [COLUMN] <tên>` cho cùng danh sách bảng |
| F5 | LOW | `apps/web/src/db/directory.ts` (`boundedLikePattern`) | D1 từ chối mẫu `LIKE` > 50 byte; Implementer cắt từ khóa dài còn ≤ 48 byte, nên từ khóa > ~46 byte khớp theo tiền tố (kết quả rộng hơn một chút) | Theo sau (không chặn merge): dùng `instr(lower(cột), lower(?)) > 0` |
| F6 | LOW | plan, mục "Nghĩa vụ để lại sau M4" (M8) | Ghi "`wrangler d1 export` không xuất được bảng ảo"; theo tài liệu D1, export có thể từ chối cả database có bảng ảo (chưa kiểm được offline) | Reviewer sửa câu chữ nghĩa vụ M8; thử 0006 trên một D1 remote nháp trước lần `db:migrate:remote` đầu tiên |
| F7 | LOW | `apps/web/migrations/0006_catalog.sql` | Xóa theo `product_id` UNINDEXED quét bảng FTS mỗi lần ghi product đang publish | Sau Wave 1: khóa dòng FTS theo `products.rowid` |
| F8 | LOW (UX, cho Owner) | `apps/web/src/views/ProductCard.tsx` | "From $19" không ghi chu kỳ; $19/tháng trông như giá một lần. Đúng quyết định Owner (giá khởi điểm bỏ qua `billing`) | Owner quyết có thêm chu kỳ vào thẻ hay không |

## Quyết định của Reviewer trong lúc thực thi (review toàn nhánh đã xác nhận cả 7)

- **Task 1:** D1 cộng cả các dòng trigger ghi vào `meta.changes`. `updateProductFieldsStatement` trả `RETURNING id`, nơi gọi đếm số dòng trả về; đã rà mọi `meta.changes` còn lại (chỉ bảng `products` có trigger). Đây là lỗi thiết kế của plan, Implementer phát hiện.
- **Task 1:** test "không có cột trả tiền" thu hẹp về các bảng mà truy vấn xếp hạng đọc (ADR-008 sẽ thêm bảng chiến dịch riêng).
- **Task 1:** lọc huy hiệu khớp đúng loại (`in_production` không kéo theo `demo_verified`), vì spec 6.1 coi các huy hiệu là các lần xác minh độc lập.
- **Task 3–5:** test nặng có timeout riêng 30 s.
- **Task 4:** chấp nhận `boundedLikePattern` (xem F5).
- **Task 5:** `robots.txt` thêm `Disallow: /go/` theo spec 8.8 đã sửa (phụ lục monetization, 2026-10-04).

## Đối chiếu cổng ra M4

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Tìm được bằng tiếng Việt có dấu | ✓ | `test/public/products-page.test.ts` "M4 exit gate" (tạo → submit → duyệt qua HTTP → `/vi/products?q=đặt lịch`); `test/catalog/search.test.ts` |
| Tìm được bằng tiếng Trung 2 ký tự | ✓ | cùng test cổng ra (`/zh-hans/products?q=预约`); `test/catalog/search.test.ts` |
| Không có tham số xếp hạng trả tiền (test) | ✓ | `test/catalog/ranking.test.ts`; `test/domain/catalog.test.ts`, `test/domain/directory.test.ts` (đúng tập khóa đầu vào); `test/public/products-page.test.ts`, `test/public/builders-page.test.ts` (tham số lạ qua HTTP) |

## Minor để lại (không chặn merge, theo phân loại của review toàn nhánh)

- `LIKE` cho từ 1–2 ký tự chỉ không phân biệt hoa thường với ASCII; tìm tiếng Việt không dấu không hỗ trợ (quyết định Owner).
- Không có test cho fallback của `siteOrigin` khi thiếu `APP_ORIGIN`; regex JSON-LD trong test giả định thẻ script không có thuộc tính khác.
- Link Products / Find builders ở header chưa nằm trong `<nav>` (làm cùng header ở M7).
- Chưa có test > 24 builder (OFFSET dùng chung code với `/products`); `robots.txt` chặn theo tiền tố trần (`/me`, `/auth`) đúng câu chữ spec.

## Nghĩa vụ để lại cho task sau

- **Deploy:** `db:migrate:remote` phải áp `0006_catalog` cùng lúc với code M4 (F1).
- **Trước lần migrate remote đầu tiên:** thử `0006_catalog` trên một D1 remote nháp (trigram, trigger, `json_each` trong trigger, hành vi `wrangler d1 export`).
- **M6:** nút "Post a request" ở `/builders` và ở trạng thái rỗng của `/products`; thêm `/request` vào sitemap.
- **M7:** `/`, `/for-builders`, `/terms`, `/privacy` vào sitemap kèm alternate; header vào `<nav>`; nếu `/go/` có tiền tố locale thì `robots.txt` phải chặn cả các tiền tố đó.
- **M8 (runbook):** backup D1 khi có bảng ảo FTS5 (bỏ bảng và trigger → export → tạo lại và backfill, hoặc chỉ dùng Time Travel).
- **Sau Wave 1:** FTS khóa theo `rowid`; sitemap index khi vượt 10 000 product; cân nhắc lưu sẵn `badge_score` / giá khởi điểm nếu catalogue vượt khoảng 10 000.
