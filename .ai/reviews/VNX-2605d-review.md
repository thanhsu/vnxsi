# VNX-2605d — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** ADR-013, plan Task 9d (sau review plan: MEDIUM-1, MEDIUM-2, LOW-1..3, S-1..3; câu chữ Owner duyệt 2026-10-10; plan do vnxsi-72 duyệt theo ủy quyền của Owner), báo cáo `.ai/tasks/VNX-2605d-report.md`, diff `dd39e18..6a8efe6`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 158 file / 1787 test xanh; trailer đúng dòng Opus.

## Verdict

APPROVE (không có phát hiện HIGH trở lên; lượt sửa R1 chỉ test, đã được vnxsi-72 duyệt trước cho mức MEDIUM trở xuống)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| LOW-1 | LOW | `src/db/identities.ts:71, 90` | Điều kiện `expires_at` của guard SQL chưa có test | Thêm ca session `magic_link` đúng user nhưng đã hết hạn → `session_ended`. **Làm ở R1** |
| S-1 | SUGGESTION | `test/auth/oauth-link-session.test.ts` | Chưa test `session_ended` thắng `already_linked` | Thêm một ca. **Làm ở R1** |
| S-2 | SUGGESTION | `docs/adr/ADR-013-link-requires-magic-link-session.md` | ADR ghi "trigger" trong khi test dùng spy (quyết định 7 của plan) | Đã thêm ghi chú giải thích vào ADR-013 |

## Đối chiếu tiêu chí chấp nhận (ADR-013 "Được bảo đảm bởi")

| AC | Đạt? | Bằng chứng |
|---|---|---|
| `POST …/link` từ session `oauth_*` bị từ chối, không cookie intent, 303 về `/me?link=needsEmailLink` theo locale; kiểm sau provider (lạ, cờ tắt vẫn 404); `magic_link` như cũ | ✓ | `src/routes/me.tsx:90-93`; `test/auth/oauth-link-session.test.ts` |
| `start`: session không phải `magic_link` coi như không có session để liên kết, rơi về đăng nhập thường | ✓ | `src/routes/oauth.tsx:115-116` |
| Callback: trước `exchange` đòi session `magic_link` + flow khớp (không gọi `exchange` khi từ chối); sau `exchange` INSERT có guard `EXISTS` session `magic_link` còn sống của đúng user; `session_ended` không ghi hàng, không audit, không email | ✓ | `src/routes/oauth.tsx:78, 97-98`; `src/db/identities.ts:71, 87-94`; `src/db/audit.ts:55-62` |
| Hai lớp ở callback, mỗi lớp có test fail khi thiếu nó (kể cả cookie flow tự dựng) | ✓ | test "session became oauth_*" (`exchange` không được gọi); test SQL-level; test race (`exchange` gọi đúng 1 lần, không ghi gì) |
| `/me`: session `oauth_*` không có nút Liên kết, có ghi chú; Hủy liên kết vẫn có; hủy liên kết từ `oauth_*` vẫn được phép | ✓ | `src/views/me/LinkedAccounts.tsx:7, 18-19, 40, 62` |
| Câu chữ 2 khóa khớp bản Owner duyệt ở 4 locale (8/8) | ✓ | so từng byte bằng script |

## Re-review R1 (controller, 2026-10-10)

Commit `430194b` (chỉ test): ca session `magic_link` đúng user nhưng hết hạn trả `session_ended`, không ghi identity hay audit; ca session đã chết cùng subject đã liên kết trả `session_ended` chứ không phải `already_linked`. Typecheck sạch; `npm test -- --maxWorkers=2` 158 file / 1787 test xanh (hai ca mới nằm trong test SQL-level có sẵn). **Verdict cuối: APPROVE.**
