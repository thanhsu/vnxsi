# VNX-2504b — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** handoff `.ai/tasks/VNX-2504b-handoff.md`, báo cáo `.ai/tasks/VNX-2504b-report.md`, diff `99fe2c2..9cd0e32` (`659ce10` test, `a327a6c` feat, `9cd0e32` báo cáo). Diff `src` + `public`: 10 file, +576/−47 (không tính locale: +541/−47, dưới ngưỡng ~600).
- **Lệnh đã chạy lại (Reviewer):**
  - `npm run typecheck -w apps/web` → exit 0.
  - Toàn bộ test theo thư mục (`npx vitest run <group> --maxWorkers=2` trong `apps/web`, vì `npm test` một lượt hết bộ nhớ trên máy này): **134 file, 1410/1410 xanh**, không timeout. Trong đó `test/ops` 6 file 103/103, `test/admin` 12 file 105/105, `test/http` 41/41, `test/db` 133/133, `test/notify` 19/19, `test/architecture.test.ts` 11/11.
  - Chụp màn hình local (`wrangler dev` cổng 8795, dữ liệu mẫu `shot2504b-seed.sql`, Owner local): danh sách 1280/390, chi tiết 1280/390, chi tiết với `<details>` Return mở, dark 1280.

## Verdict

**APPROVE.** Không có phát hiện cần khắc phục trước khi sang VNX-2504c.

## Đối chiếu

- **Quyền:** 2 GET qua `requireOps("marketplace.view")`; 3 POST (`invite`, `reject`, `remove`) qua `requireOps("marketplace.act")`. Request không có → `opsNotFound`. Test: Viewer/Content × 3 POST → 404, không đổi request, invitation, audit, outbox; Content/không vai trò GET → 404 kín.
- **Tách logic:** `inviteToRequest`, `rejectRequest`, `removeRequest` trả `RequestDecision`; thân hàm giữ nguyên thứ tự kiểm tra, `inviteBuildersBatch` + audit với guard, `end()`/`endRequestBatch`, `parseAdminNote`, các e-mail notify. `/admin` ánh xạ về đúng response cũ: invite/reject 303 `?done=1|mail_failed` (cùng điều kiện `failed === 0` / `sent && !mailFailed`), remove 303 `/admin/requests` không thông báo, 404/409 `errorResponse`, 400 trang admin giữ giá trị. `test/admin` không sửa test, xanh. Remove vẫn không e-mail client.
- **`db/requests.ts`:** `searchRequestsForAdmin` (`instr(lower(title))`, cùng thứ tự và giới hạn 200), `countRequestsByStatus` (`GROUP BY status`), chỉ đọc; `adminOrder()` tách ra nhưng `listRequestsForAdmin` giữ nguyên câu truy vấn.
- **Ops:** 400 render lại chi tiết giữ nội dung đã nhập (`ReasonField` thêm `value` tùy chọn, Builders/Products không đổi), `<details>` Return mở khi note lỗi; 409 đọc lại request; remove về danh sách giữ bộ lọc + thông báo.
- **Giao diện:** 8 tab trạng thái + All có số; chi tiết: Request (đủ trường admin, mô tả qua `PlainText`), Invitations, Suggested builders (luật xếp hạng hiện rõ "Nobody pays to appear here", ADR-004), Decision + History bên phải; 390 px về một cột. Viewer: đủ trường gồm e-mail client (spec §3.1), không checkbox/input/nút.
- **CSP:** scan VNX-0803 có danh sách, `?status=all`, chi tiết; không inline.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | SUGGESTION | Thẻ Invitations khi chưa có lời mời có khoảng trống thừa giữa dòng "0 active · 0 in all" và "No builder invited yet." | Xem lại ở VNX-2509 |
| F2 | Ghi nhận | Invite không mời được ai (trùng, chính client, builder không đủ điều kiện) hiện thông báo 409 chung "The status changed…" vì `inviteBuildersBatch` không trả lý do | Chấp nhận cho O1 (admin cũ cũng chỉ trả 409) |
| F3 | Ghi nhận | Overview/menu đọc `countRequestsToMatch` hai lần mỗi request; tìm kiếm không phân biệt hoa thường chỉ ASCII | Như 2504a/2504a2 |
| F4 | Ghi nhận | 390 px: 9 tab cuộn ngang | Giống mẫu Tabs của Builders/Products |

Sai khác do Implementer báo (nhãn trạng thái `ops.requests.status.*` ngắn cho tab; Ops remove có thông báo và tính lỗi e-mail builder, `/admin` giữ như cũ; 409 chung cho invite; `ReasonField.value`; link builder sang trang Ops; gợi ý builder ở cột trái): đã xem, chấp nhận.
