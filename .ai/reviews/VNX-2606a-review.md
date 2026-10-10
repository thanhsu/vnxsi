# VNX-2606a — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** plan Task 10 (sau review plan: M1–M3, L1–L3, S1; Owner E1 tắt cờ thì ẩn công tắc; builder bị khóa vẫn bật/tắt được), báo cáo `.ai/tasks/VNX-2606a-report.md`, diff `958f721..bdc2860`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 152 file / 1711 test xanh; trailer đúng dòng Opus.

## Verdict

APPROVE (M1, M3, M4 làm thành commit test riêng trước Task 11)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/hub/badge-toggle.test.ts` (diff 833-851) | Quyết định bỏ qua kiểm cờ ở POST chưa được test ghim | Khi cờ tắt, `show=0` vẫn 303 và giá trị lưu thành 0. **Làm trước Task 11** |
| M2 | SUGGESTION | `src/views/hub/ProfilePage.tsx` (diff 502-511) | Thông báo có thể không hiện khi không còn hàng nào (chỉ qua tab cũ hoặc POST tự dựng) | Ghi nhận UX |
| M3 | LOW | `test/hub/badge-toggle.test.ts` (diff 903) | Test non-builder tạo hàng GitHub của user khác nhưng không assert gì | Assert cờ hàng đó vẫn 0. **Làm trước Task 11** |
| M4 | SUGGESTION | `test/hub/badge-toggle.test.ts` (diff 841) | Test E1 chưa ghim tiêu đề hàng `<strong>GitHub</strong>` | Thêm assert. **Làm trước Task 11** |
| M5 | SUGGESTION | `test/architecture.test.ts:557` | Allowlist theo file: `routes/hub.tsx` chạy được mọi SQL trên `user_identities` | Ghi nhận; hôm nay chỉ gọi hai hàm với `builder.userId` |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| `POST /hub/identities/:provider/badge`: `requireBuilder` + Origin check; chỉ github/linkedin (google, lạ → 404); `show` sai → 409; cố ý bỏ `canEditProfile` và kiểm cờ (có chú thích); 303 cùng site | ✓ | `src/routes/hub.tsx` (diff 432-443) |
| Chỉ sửa hàng của chính builder (`c.get("builder").userId`, lọc `user_id`), ghi qua `db/identities.ts` | ✓ | `src/db/identities.ts` (diff 91-102); test IDOR (diff 870-880) |
| Audit `badge_show`/`badge_hide` chỉ `{provider}`, cùng batch, có guard; giá trị không đổi thì không ghi; không email | ✓ | `src/db/identities.ts` (diff 94-102) |
| Công tắc chỉ hiện cho github/linkedin đã liên kết và provider đang dùng được; cờ không đổi `show_on_profile`; hiện cho mọi trạng thái builder | ✓ | `src/routes/hub.tsx` (diff 397); `src/views/hub/ProfilePage.tsx` (diff 502-518) |
| Câu chữ 12 khóa khớp bản Owner duyệt, không chú thích nháp | ✓ | so từng byte bằng script, 0 lệch |

## Nghĩa vụ để lại

- Task 11: `listPublicBadges` nhận danh sách provider đang dùng được (Owner E1), để giá trị lưu khi cờ tắt không có hiệu lực công khai.
