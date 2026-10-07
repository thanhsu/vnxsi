# VNX-2504a — Review (Builders)

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** handoff `.ai/tasks/VNX-2504a-handoff.md`, báo cáo `.ai/tasks/VNX-2504a-report.md`, diff `49da061..e4b3f09` (`src` + `public`: 13 file, +665/−37); ảnh `b2504a-list-1280.png`, `b2504a-list-390.png`, `b2504a-detail-1280-reject.png` so với mockup `OpsBuilders.dc.html`.
- **Lệnh đã chạy lại:** typecheck exit 0; `npm test -- test/ops test/admin test/http/security-headers.test.ts test/i18n` → 19 file, 183/183. Toàn bộ của Implementer: 132 file, 1364/1364.

## Verdict

**APPROVE** cho phạm vi Builders. **Tách phạm vi (Reviewer duyệt):** Products chuyển sang task **VNX-2504a2** (diff Builders + phần dùng chung đã ~626 dòng, giới hạn ~600).

## Đối chiếu

- Route `/ops/marketplace/builders` (+ chi tiết, 4 POST) qua `requireOps`; builder không tồn tại → 404 kín (GET và POST).
- `decideBuilder` tách khỏi `admin.tsx`: state machine, compare-and-set, audit, email giữ nguyên; test `/admin` không đổi, xanh.
- Danh sách: thẻ trạng thái có số, tìm theo tên/handle/email (`%`, `_` coi là chữ), bộ lọc trong URL, không phân trang giả.
- Chi tiết theo khung phải của mockup; Reject/Suspend có xác nhận `<details>`; Viewer không thấy form; History theo projection an toàn.
- Menu Marketplace › Builders có số chờ; thẻ Overview có link; CSP scan có các trang mới; 390 px bảng cuộn ngang, cột Status đặt thứ hai để luôn thấy.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | LOW | Tìm không phân biệt hoa thường chỉ với chữ ASCII (SQLite `lower()`): "MÂY" không ra "Mây" | Chấp nhận ở O1; ghi nhận |
| F2 | LOW (ngoài phạm vi) | Nhãn admin cũ "Reason (optional, admins only)" sai: Hub của builder hiển thị review note ở mọi trạng thái | Ghi nhận; trang admin cũ bị gỡ ở VNX-2508, nhãn Ops đã đúng |
| F3 | SUGGESTION | Overview đọc số builder 2 lần (thẻ + menu) | Chấp nhận (COUNT có index) |

Sai khác do Implementer báo (cột Status thứ hai; thêm cột Email; không lọc Kind / link xem trước / nhãn SAMPLE; History hiện mã hành động + actor; ngày tuyệt đối UTC; nhãn trạng thái riêng cho Ops; sửa 4 file test ngoài danh sách cho route mới): đã xem, chấp nhận.
