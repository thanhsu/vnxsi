# VNX-2602 — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-07
- **Đã đọc:** plan `docs/superpowers/plans/2026-10-07-vnxsi-epic26-linked-accounts.md` (header + Task 1), báo cáo `.ai/tasks/VNX-2602-report.md`, diff `9cb2020..635f9cc`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 138 file / 1468 test xanh (lần chạy đầu có 9 timeout vì chồng với lần chạy của Implementer; chạy lại sạch, file `test/ops/monetization-merchants.test.ts` chạy riêng 21/21 xanh).

## Verdict

APPROVE

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | LOW | commit `635f9cc` | Trailer là `Co-Authored-By: Claude Sonnet 5.5`, plan yêu cầu dòng của cấu hình phiên (`Claude Opus 5.5 <noreply@anthropic.com>`) | Không sửa lịch sử (không ảnh hưởng chức năng). Từ Task 2, brief Implementer nhắc dùng đúng dòng trailer của plan |
| F2 | LOW | `migrations/0017_user_identities.sql:10` | CHECK độ dài `label` 1–254 chưa có test | Thêm hai test `rejects.toThrow()` (rỗng, 255 ký tự) ở Task 3 (VNX-2603b), nơi adapter dựa vào giới hạn này |
| F3 | SUGGESTION | `src/auth/sessions.ts:33` | Nhánh `!isSessionMethod` không chạy được qua DB vì CHECK chặn | Giữ làm phòng thủ chiều sâu |
| F4 | SUGGESTION | `src/db/identities.ts:80` | Đọc lại identity sau batch thay vì `RETURNING *` | Giữ theo plan |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Migration additive, `sessions.method` NOT NULL DEFAULT `magic_link` + CHECK | ✓ | `0017_user_identities.sql:21-22`; `test/auth/sessions.test.ts:36-44` |
| `getSessionUser` fail closed với method lạ | ✓ | `src/auth/sessions.ts:33` |
| `user_identities` không có cột token hay `name`; 2 ràng buộc UNIQUE | ✓ | `test/db/identities.test.ts:97-112` |
| Audit link/unlink chỉ `{provider}`, cùng `db.batch` | ✓ | `src/db/identities.ts:64-78, 96-103`; `test/db/identities.test.ts:33, 73` |
| 3 cờ `oauth_*` cuối `FLAG_KEYS`; `flags.intro` + mô tả cờ đủ 4 locale | ✓ | `src/domain/flags.ts`; `en.ts:778`, `vi.ts:781`, `zh-hans.ts:780`, `zh-hant.ts:780` |
| `user_identities` chỉ do `db/identities.ts` ghi | ✓ | `test/architecture.test.ts` (`WRITERS.user_identities`) |

## Nghĩa vụ để lại cho task sau

- Task 3 (VNX-2603b): test CHECK độ dài `label` (F2); kiểm fallback `label` email → tên provider cố định, không lưu `name` (Reviewer decision 12).
- Mọi task sau: trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
