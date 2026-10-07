# VNX-2501 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** plan O1 (task VNX-2501), handoff, báo cáo `.ai/tasks/VNX-2501-report.md`, diff `2da1b5e..7e9e5f2` (6 file, +730, chỉ thêm file mới + 2 dòng test kiến trúc).
- **Lệnh đã chạy lại:**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test -- test/domain/ops.test.ts test/db/ops-members.test.ts test/architecture.test.ts test/i18n/parity.test.ts` → 4 file, 99/99.
  - `npm test` (toàn bộ) → 22 lỗi ở 7 file không liên quan (admin, hub, auth, db/builders); chạy riêng 7 file đó → 65/65. Lỗi là timeout 5 s khi máy tải nặng (nhiều phiên chạy test song song), không do task này.

## Verdict

**APPROVE.**

## Đối chiếu

- Migration đúng plan: không có `owner` trong `role`; index duy nhất một phần cho lời mời `pending` theo email.
- `can()`: Owner mọi capability; Operator overview.*, audit.view, marketplace.*, users.*, feedback.*; Content overview.view, audit.view, content.*; Viewer overview.*, audit.view, *.view (marketplace, users, feedback, content). Chỉ Owner có `team.manage`, `settings.act`, `monetization.*`. Test liệt kê đủ 60 ô.
- `resolveRole`: không `active` → null (kể cả Owner gốc); `ADMIN_EMAILS` → owner (email chuẩn hóa); member → vai trò.
- Nhận lời mời: một batch 2 câu, kiểm `pending`, chưa hết hạn, email của chính user trong `users`; nhận lại / sai user / đúng mốc hết hạn / sau khi hủy không đổi gì. Quét hết hạn không đụng `ops_members`.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | LOW | Lời mời `pending` đã quá hạn nhưng cron chưa quét vẫn chặn mời lại cùng email | Quyết định cho VNX-2506: route mời gói "đánh dấu `expired` lời mời quá hạn của email đó" + audit + tạo lời mời mới trong **một** batch |
| F2 | LOW | `INVITE_TTL_MS` trùng tên với `src/domain/request.ts` | Chấp nhận; import kèm alias khi cần |
| F3 | Ghi nhận | Test toàn bộ có timeout ngẫu nhiên khi máy tải nặng | Ghi vào CURRENT-STATUS "Ghi nhận"; không sửa trong O1 |

Sai khác do Implementer báo (mọi hàm ghi trả statement để gói cùng audit; lời mời trùng không ghi gì thay vì ném lỗi; `opsInviteTransition` trả lỗi có kiểu; hết hạn tính từ đúng mốc `expires_at`; cập nhật `granted_by/granted_at` khi đổi vai trò; export thêm vài tên): đã xem, chấp nhận.

## Nghĩa vụ cho VNX-2506

- F1 như trên.
- Thêm guard audit cho `ops_members`, `ops_member_invites` trong `db/audit.ts` (theo mẫu inquiries/users).
- Luật route: không mời email của Owner gốc; không mời người đã là thành viên (đổi vai trò thay vì mời); user `suspended` không nhận được lời mời.
