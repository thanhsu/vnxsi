# M3 (VNX-0301 … VNX-0306) — Review

- **Reviewer:** Claude (điều phối) + reviewer độc lập cho từng task (Sonnet) và review toàn nhánh (Opus)
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `docs/superpowers/plans/2026-10-04-vnxsi-m3-product.md`, báo cáo của Implementer từng task, diff `4f26ba4..45b07a1`
- **Lệnh đã chạy lại:** `npm run typecheck -w apps/web` → exit 0; `npm test` → 51 file, 323/323 test xanh

## Verdict

APPROVE. Review toàn nhánh trả "With fixes" (0 BLOCKER, 5 HIGH, 7 LOW). Lượt sửa F1–F12 ở `45b07a1` đã được re-review: cả 12 phát hiện đều đã xử lý.

## Phát hiện của review toàn nhánh

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | HIGH | Đổi demo URL và thu hồi Demo verified là các lệnh rời; lỗi giữa chừng để lại huy hiệu cho URL chưa kiểm | Đã sửa: một `db.batch` với điều kiện bảo vệ; mất compare-and-set thì không thu hồi gì |
| F2 | HIGH | Duyệt product và gắn `listed` là các lệnh rời; lỗi giữa chừng không sửa được qua giao diện | Đã sửa: một `db.batch`; mở khóa cũng gắn lại `listed` nếu thiếu |
| F3 | HIGH | Admin không thấy hết trường sẽ công khai (website, tag, tech stack, tùy chỉnh, mô tả tier, alt ảnh) | Đã sửa |
| F4 | HIGH | Mô tả product nằm dưới tiêu đề "Dành cho ai" trên `/p/:slug` | Đã sửa: mục "Giới thiệu sản phẩm" riêng |
| F5 | HIGH | Để trống tier chỉ xóa được với tier "một lần" | Đã sửa: hàng trống bị bỏ với mọi cách tính |
| F6–F12 | LOW | Builder không thấy lý do khóa; thông báo sai cho product đang ẩn; thiếu link tới trang công khai; test escape HTML chưa đủ; upload lớn bị đọc hết trước khi kiểm; câu chữ alt; form gắn huy hiệu trống | Đã sửa |

## Đối chiếu cổng ra M3

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Product đi đủ vòng draft → in_review → published và hiện ở `/p/:slug` | ✓ | `test/public/product-page.test.ts` "M3 exit gate" (toàn bộ qua HTTP, có upload ảnh thật) |
| Đổi demo URL thì mất huy hiệu Demo verified | ✓ | `test/admin/badges.test.ts` "M3 exit gate"; `test/hub/products.test.ts` (lý do `demo_url_changed`, mất compare-and-set thì không thu hồi) |

## Quyết định của Reviewer trong lúc thực thi

- Task 2: `parseField` tự chuẩn hóa CRLF (test của plan gọi thẳng `parseStep`).
- Task 8: handle test bỏ dấu gạch dưới; đổi thứ tự thuộc tính link demo cho khớp test; U+2028/2029 viết dạng escape.
- Ba câu hỏi nghiệp vụ chuyển cho Owner (xem `CURRENT-STATUS.md`): product công khai rơi dưới điều kiện submit; `published_at` khi hiện lại / mở khóa; `robots.txt` và og:image.

## Minor để lại (không chặn merge, theo phân loại của review toàn nhánh)

- Ghi không nguyên tử ở các bước văn bản khác Demo và ở Pricing; object R2 mồ côi khi D1 lỗi; `Object.hasOwn` thay cho `in`; ghi chú admin mất khi lỗi 400; lỗi lý do thu hồi chưa gắn với form; prop `status` giữ chỗ ở trang "mới chỉnh sửa".
- Bản dịch: mẫu "your-address" trong zh, dấu ngoặc ASCII ở zh-Hans, "License" trong vi.
- Test nhánh phụ còn thiếu: stale 409 qua HTTP, product `unlisted`, giới hạn độ dài biên, audit của một số hành động, lỗi alt / thiếu file.

## Nghĩa vụ để lại cho task sau

- Owner bật R2; Claude tạo bucket `vnxsi-media` (VNX-0307) trước lần deploy có M3.
- Deploy sau khi merge: migration `0005_products`.
- M4: quyết định `published_at` trước khi xếp hạng; `robots.txt` và `/media/products/`; FTS đồng bộ khi duyệt / sửa product đang publish.
