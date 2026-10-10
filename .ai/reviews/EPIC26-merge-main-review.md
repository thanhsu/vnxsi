# EPIC 26 — Review merge `origin/main` (`e78c1c5`)

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận); vnxsi-72 yêu cầu review độc lập vì merge chạm đường phân quyền admin/staff
- **Ngày:** 2026-10-10
- **Đã đọc:** nghĩa vụ rebase trong `.ai/reviews/VNX-2604a-review.md`, `.ai/reviews/VNX-2606b-review.md`, quyết định 1, 8, 9 của plan; báo cáo `.ai/tasks/EPIC26-merge-main-report.md`; `0701acb` (merge, cha `c2dfdbd` và `e78c1c5`) và `1a5388a` (nghĩa vụ)
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 186 file / 2255 test xanh; `git diff --stat origin/main...HEAD -- apps/web/migrations` chỉ `0017_user_identities.sql`. Implementer: `npm run e2e` 49 passed, `npm run test:scripts` 52/52, `npm run e2e:typecheck` sạch. vnxsi-72: `package.json` và lockfile không khác `origin/main`.

## Verdict

APPROVE (không có BLOCKER, HIGH, MEDIUM; LOW-1 và hai đề xuất làm ở lượt sửa R1)

## Điểm truy cập admin/staff sau merge

Review liệt kê 32 chỗ gọi `isAdminUser`, `isStaff`, `isStaffSession`, `requireAdmin`, `requireOps`, `resolveOpsRole`, `adminEmails`, `is_admin`, `isLinkCapableSession`. Kết luận:

- Mọi route `/admin/*` (kể cả `admin-merchants.tsx` của VNX-2508a) đi qua `requireAdmin` = `isAdminUser` **và** `isStaffSession` (`src/auth/middleware.ts:43`).
- Mọi route `/ops/*` (kể cả `/ops/monetization/*`) đi qua `requireOps`, kiểm `method` trước `resolveOpsRole` (`src/auth/ops.ts:42-43`).
- `isStaff` chỉ quyết định có đếm lượt xem hay lượt bấm không (`src/http/visitor.ts:47-48`, `src/routes/go.ts:130-131`), không cấp quyền gì. Coi admin hoặc thành viên Ops đăng nhập bằng `oauth_*` là staff chỉ làm thống kê không bị thổi phồng; đúng hướng.
- `markLogin` đồng bộ lại `is_admin` khi đăng nhập OAuth là an toàn vì nơi duy nhất dùng `isAdmin` để cấp quyền là `requireAdmin`, vốn đòi `magic_link`.
- `/tools/:slug` không có logic admin hay staff.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| LOW-1 | LOW | `src/auth/staff.ts:7-8` | Docstring `isStaff` vẫn gọi `isAdminUser` là "guard /admin" | Sửa câu: guard `/admin` còn đòi session magic link. **Làm ở R1** |
| S-1 | SUGGESTION | `test/public/builder-badges.test.ts:296-301` | Kết quả `optIn` không được assert | Assert huy hiệu đã bật. **Làm ở R1** |
| S-2 | SUGGESTION | `test/architecture.test.ts` | Hai hàm phân giải import gần trùng (của EPIC 26 và của main) | Gộp sau; không làm bây giờ |
| S-3 | SUGGESTION | `test/ops/guard.test.ts` | Chưa có test session `oauth_*` vào đường `/ops/monetization/*` thật | Thêm một ca. **Làm ở R1** |

## Đối chiếu nghĩa vụ rebase

| Nghĩa vụ | Đạt? | Bằng chứng |
|---|---|---|
| `requireAdmin` = `isAdminUser` và `isStaffSession`; kiểm `method` không nằm trong `isAdminUser` | ✓ | `src/auth/middleware.ts:43`; `src/auth/admin.ts:14-16` |
| Ba đoạn chú thích M7 nói guard `/admin` còn đòi session magic link; `auth/admin.ts` không có chữ "method" | ✓ | `src/auth/admin.ts:13`; `src/domain/visitor.ts:62`; `test/auth/staff.test.ts:12, 31` |
| Test `isStaff` trả `true` cho owner và thành viên Ops với session `oauth_*` | ✓ | `test/auth/staff.test.ts:41-49` |
| Giữ 7 mục `RANKING_FILES` của M7; mọi kiểm EPIC 26 còn nguyên | ✓ | `test/architecture.test.ts:127-137, 297, 418` |
| Test huy hiệu không đổi thứ tự Top builders (D1 thật, điều kiện độ dài) | ✓ | `test/public/builder-badges.test.ts:284-306` |
| Config: không có credential OAuth trong `vars`; vitest ghim `""`; fake driver không với tới production | ✓ | `wrangler.jsonc:23-35, 77-79`; `vitest.config.ts`; `src/auth/oauth/index.ts:21-22` |
| `app.ts`: route mới của main không đè route EPIC 26 | ✓ | `src/app.ts` |

## Re-review R1 (controller, 2026-10-10)

Commit `4f1d72b`: docstring `isStaff` nói rõ `isAdminUser` chỉ là kiểm email và cờ admin, guard `/admin` còn đòi session magic link; test Top builders assert `optIn(...) === "changed"`; test mới cho ba session `oauth_*` của Owner gốc vào `/ops/monetization/merchants` nhận 404 kín và `no-store`. Implementer: 3 file / 58 test xanh, typecheck sạch. **Verdict cuối: APPROVE.**
