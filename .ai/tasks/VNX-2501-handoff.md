# VNX-2501 — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md` (APPROVED 2026-10-05), task VNX-2501 và mục "Thiết kế chính → Dữ liệu", "Ma trận capability".
- **Spec / ADR:** `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md` §3; ADR-010.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2501-report.md`
- **Nhánh:** `feat/ops-o1` (cắt từ `main` `12902b2`, đã có EPIC 21). Không push, không merge.

## Mục tiêu

Nền dữ liệu và luật quyền của Ops: hai bảng mới, ma trận capability dạng hàm thuần, các hàm đọc/ghi D1. **Chưa có route, giao diện hay middleware** (thuộc VNX-2502 trở đi).

## Phạm vi đã duyệt

1. `apps/web/migrations/0013_ops_members.sql`: đúng schema ở plan (`ops_members`, `ops_member_invites`, index duy nhất lời mời `pending` theo email). Không có giá trị `owner` trong cột `role`.
2. `apps/web/src/domain/ops.ts` (thuần, không import Hono/D1):
   - `OPS_ROLES = ["owner","operator","content","viewer"]`, `GRANTABLE_ROLES = ["operator","content","viewer"]`.
   - `OpsCapability` gồm đúng: `overview.view`, `overview.detail`, `audit.view`, `marketplace.view`, `marketplace.act`, `users.view`, `users.act`, `feedback.view`, `feedback.act`, `team.manage`, `settings.act`, `monetization.view`, `monetization.act`, `content.view`, `content.act`.
   - `can(role, capability): boolean` theo spec §3.1 và các quyết định trong plan: Owner có mọi capability; Operator: overview.*, audit.view, marketplace.*, users.*, feedback.*; Content: overview.view (không `overview.detail`), audit.view, content.*; Viewer: overview.*, audit.view, marketplace.view, users.view, feedback.view, content.view. Không ai ngoài Owner có `team.manage`, `settings.act`, `monetization.*`.
   - `resolveRole(input: { userStatus, email, adminEmails: Set<string>, memberRole: GrantableRole | null }): OpsRole | null`: user không `active` → null; email trong `adminEmails` → `owner`; có `memberRole` → vai trò đó; còn lại → null.
   - `INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000`; trạng thái lời mời `pending|accepted|cancelled|expired` với hàm chuyển thuần (`accept`, `cancel`, `expire`: chỉ từ `pending`; khác → lỗi); `isExpired(invite, now)`.
3. `apps/web/src/db/ops-members.ts` (module mới `ops` sở hữu `ops_members`, `ops_member_invites`): đọc thành viên theo `user_id`; liệt kê thành viên + lời mời; tạo lời mời (`expires_at = created_at + INVITE_TTL_MS`); đổi vai trò; xóa thành viên; hủy lời mời; nhận lời mời (tạo/cập nhật `ops_members` + đánh dấu `accepted` **trả về statement** để route gói cùng audit trong một `db.batch`, theo mẫu `deleteUserSessionsStatement` hiện có); đánh dấu hết hạn hàng loạt (`expired` cho `pending` quá hạn, không đụng `ops_members`).
4. `apps/web/test/architecture.test.ts`: thêm `ops_members`, `ops_member_invites` → `../src/db/ops-members.ts`.

## Ngoài phạm vi (không làm)

Middleware, guard 404, route `/ops`, giao diện, i18n, sửa luồng đăng nhập, cron, chuyển trang admin.

## Đọc trước

`CLAUDE.md`; plan O1; spec §3; ADR-010; `src/domain/feedback.ts` (mẫu domain + chuyển trạng thái), `src/db/feedback.ts`, `src/db/users.ts`, `src/auth/sessions.ts` (`deleteUserSessionsStatement`), `src/auth/admin.ts` (`adminEmails`), `test/architecture.test.ts`, `test/domain/feedback.test.ts`, `test/db/feedback.test.ts`.

## File dự kiến bị ảnh hưởng

Mới: `apps/web/migrations/0013_ops_members.sql`, `apps/web/src/domain/ops.ts`, `apps/web/src/db/ops-members.ts`, `apps/web/test/domain/ops.test.ts`, `apps/web/test/db/ops-members.test.ts`. Sửa: `apps/web/test/architecture.test.ts`.

## Tiêu chí chấp nhận

- [ ] AC1: migration áp được local, schema đúng plan (CHECK role không có `owner`, index duy nhất `pending` theo email) — `npm run db:migrate:local -w apps/web` và `test/db/ops-members.test.ts`
- [ ] AC2: `can()` đúng cho **mọi** cặp 4 vai trò × 15 capability (bảng kỳ vọng viết tường minh trong test) — `npm test -- test/domain/ops.test.ts`
- [ ] AC3: `resolveRole` đúng: suspended → null kể cả email trong `ADMIN_EMAILS`; root → owner kể cả khi có dòng member; member → vai trò; không gì → null — `test/domain/ops.test.ts`
- [ ] AC4: chuyển trạng thái lời mời và `isExpired` đúng (mốc đúng 7 ngày) — `test/domain/ops.test.ts`
- [ ] AC5: hàm db: tạo lời mời đặt `expires_at` đúng; lời mời `pending` thứ hai cùng email bị chặn; nhận lời mời tạo/cập nhật member + `accepted` trong một batch; hết hạn hàng loạt không xóa member đã có — `npm test -- test/db/ops-members.test.ts`
- [ ] AC6: test kiến trúc xanh với bảng sở hữu mới — `npm test -- test/architecture.test.ts`
- [ ] AC7: toàn bộ test + typecheck xanh — `npm test`, `npm run typecheck -w apps/web`

## Cấm

Không sửa ngoài danh sách file; không thêm dependency; không route/UI; TDD (commit test trước); Conventional Commits, mỗi commit kèm dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
