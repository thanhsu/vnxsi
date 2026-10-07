# VNX-2604a — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-07
- **Đã đọc:** plan Task 5 (sau review plan: source scan an toàn với CRLF, mục tiêu ghi thật, assert thứ tự, chú thích tripwire, nghĩa vụ rebase M7), báo cáo `.ai/tasks/VNX-2604a-report.md`, diff `2243e85..c1aa5bf`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 144 file / 1561 test xanh; trailer đúng dòng Opus.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1, chỉ test)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/staff-session.test.ts:268-269` | Quét phủ định `requireUser` và `auth/admin.ts` phân biệt hoa thường, khác `resolveOpsRole` (`/i`) | Dùng `/i` cho cả ba. **Làm ở R1** |
| M2 | SUGGESTION | `test/auth/staff-session.test.ts:265` | "Không đọc D1 khi từ chối" chỉ được giữ bằng thứ tự trong mã nguồn | Chấp nhận |
| M3 | SUGGESTION | `test/auth/staff-session.test.ts:221` | Test POST không ghi chỉ dùng `oauth_github` | Chấp nhận (`isStaffSession` không phân biệt giữa các `oauth_*`) |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Session `oauth_*` trên mọi route `/ops` nhận 404 kín giống hệt khách (trừ request id), no-store, noindex; kiểm trước `resolveOpsRole` | ✓ | `src/auth/ops.ts:104-107`; `test/ops/guard.test.ts:398-452` |
| Admin `oauth_*` trên `/admin` GET/POST nhận 403 giống non-admin; POST không ghi gì (user thật vẫn `active`, cờ vẫn tắt, audit theo actor không đổi) | ✓ | `src/auth/middleware.ts:49-50`; `test/auth/staff-session.test.ts:205-233` |
| `resolveOpsRole`, `auth/admin.ts`, `requireUser`, `requireBuilder` không đổi; `oauth_*` vẫn dùng được `/me`, `/hub`, `/`, `/login` | ✓ | diff; `staff-session.test.ts:237-247`; `guard.test.ts:447-451` |
| Quét mã nguồn an toàn CRLF, báo lỗi khi thiếu file hay điểm kết thúc, các kiểm phủ định có khả năng fail | ✓ | `staff-session.test.ts:181, 255, 258, 265-276` |
| `isStaffSession` thuần, chỉ `magic_link` là true | ✓ | `src/domain/identity.ts:145-147` |

## Nghĩa vụ để lại

- **Rebase lên M7 (`feat/m7-metrics`), từ plan Task 5:** (a) `requireAdmin` thành `if (!isAdminUser(user, c.env) || !isStaffSession(user.method)) return errorResponse(c, "forbidden", 403);`, kiểm `method` không bao giờ chuyển vào `isAdminUser`; (b) sửa docstring `auth/admin.ts`, tiêu đề `test/auth/staff.test.ts:12` và chú thích `domain/visitor.ts:62` để nói guard `/admin` còn đòi session magic link (viết "magic-link session", không dùng chữ "method", vì test quét `auth/admin.ts` tìm `method`); (c) thêm test `isStaff` trả `true` cho owner và thành viên Ops có session `oauth_*`.

## Re-review R1 (controller, 2026-10-07)

Commit `d8bc5e1` (chỉ test): quét phủ định `requireUser` và `auth/admin.ts` dùng `/method|isStaffSession/i`, thống nhất với `resolveOpsRole`. Typecheck sạch; `npm test` 144 file / 1561 test xanh. **Verdict cuối: APPROVE.**
