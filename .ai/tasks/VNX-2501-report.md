# VNX-2501 — Báo cáo Implementer

- **Task:** Dữ liệu và luật quyền Ops (migration, ma trận capability, hàm D1)
- **Handoff:** `.ai/tasks/VNX-2501-handoff.md`
- **Plan:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md` (APPROVED 2026-10-05)
- **Spec / ADR:** `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md` §3; ADR-010
- **Nhánh:** `feat/ops-o1` (worktree riêng), cắt từ `main` `12902b2` + commit handoff `2da1b5e`. Không push, không merge.
- **Implementer:** subagent Claude (context mới)

## 1. Commit

| SHA | Tiêu đề |
|---|---|
| `14e1d2d` | `test: VNX-2501 ops roles, capability matrix and membership data (failing)` |
| `3dd0c96` | `feat: VNX-2501 ops membership tables, capability matrix and member data access` |
| (commit này) | `docs: VNX-2501 implementer report` |

TDD: commit test trước; chạy lại ba file test ngay sau commit đó thì hai file mới đỏ (`Cannot find module '../../src/domain/ops.ts'`, `'../../src/db/ops-members.ts'`), test kiến trúc vẫn xanh (11/11, vì chưa có file nào ghi hai bảng mới).

## 2. File

Mới:

- `apps/web/migrations/0013_ops_members.sql`: đúng SQL trong plan (`ops_members`, `ops_member_invites`, `uq_ops_invite_pending`), thêm chú thích.
- `apps/web/src/domain/ops.ts`: `OPS_ROLES`, `GRANTABLE_ROLES`, `OPS_CAPABILITIES` (15), `can()`, `resolveRole()`, kiểu `OpsMember`, `OpsMemberListing`, `OpsInvite`, `INVITE_TTL_MS`, `OPS_INVITE_STATUSES`, `opsInviteExpiresAt()`, `opsInviteTransition()`, `isExpired()`. Chỉ import kiểu `UserStatus` từ `domain/user.ts`.
- `apps/web/src/db/ops-members.ts`: đọc `findOpsMember`, `listOpsMembers` (kèm email), `findOpsInviteById`, `findPendingOpsInvite`, `listOpsInvites(status)`; ghi (đều trả statement) `createOpsInviteStatement`, `cancelOpsInviteStatement`, `acceptOpsInviteStatements` (2 statement), `setOpsMemberRoleStatement`, `deleteOpsMemberStatement`, `expireOpsInvitesStatement`.
- `apps/web/test/domain/ops.test.ts` (73 test), `apps/web/test/db/ops-members.test.ts` (12 test).

Sửa: `apps/web/test/architecture.test.ts` (+2 dòng: `ops_members`, `ops_member_invites` → `../src/db/ops-members.ts`).

Không đụng file nào khác. Không thêm dependency.

## 3. Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 migration áp được, schema đúng plan | Đạt | `npm run db:migrate:local -w apps/web` exit 0, `0013_ops_members.sql ✅` (mục 4). `test/db/ops-members.test.ts` kiểm cột/PK/NOT NULL/default `'pending'`, `uq_ops_invite_pending` có `unique = 1, partial = 1` trên cột `email`; `role = 'owner'` bị từ chối ở cả hai bảng; email viết hoa và status lạ bị từ chối; lời mời `pending` thứ hai cùng email bị index chặn, `cancelled`/`expired` thì không. |
| AC2 `can()` cho 4 × 15 | Đạt | Bảng `EXPECTED` trong `test/domain/ops.test.ts` viết tường minh từng ô (60 ô), mỗi ô một test; thêm test bảng phủ đủ mọi vai trò × capability và test chỉ Owner có `team.manage`, `settings.act`, `monetization.*`. |
| AC3 `resolveRole` | Đạt | suspended → null kể cả email trong `ADMIN_EMAILS` và kể cả có member; root → `owner` kể cả có dòng member; member → vai trò (3 vai trò); không gì → null. |
| AC4 chuyển trạng thái lời mời, `isExpired` | Đạt | `accept`/`cancel`/`expire` chỉ từ `pending`, mọi trạng thái khác → `{ ok: false, error: "invalid_transition" }`; `opsInviteExpiresAt("2026-10-05T08:00:00.000Z") = "2026-10-12T08:00:00.000Z"`; `isExpired` false tại 0 và `TTL − 1 ms`, true tại đúng `TTL` và `TTL + 1 ms`. |
| AC5 hàm db | Đạt | Tạo lời mời: `expires_at = created_at + 7 ngày`, email chuẩn hóa; lời mời `pending` thứ hai cùng email không ghi gì (statement trả null, bảng còn 1 dòng), được tạo lại sau khi hủy; nhận lời mời: một `db.batch` của 2 statement → `changes = [1, 1]`, member tạo mới / member có sẵn đổi sang vai trò được mời, lời mời `accepted` + `accepted_by`; nhận lần hai, sai người, đúng mốc hết hạn, hoặc lời mời đã hủy → `[0, 0]`; quét hết hạn chỉ đổi `pending` quá hạn, không đụng lời mời còn hạn/đã nhận, số dòng `ops_members` và dòng member giữ nguyên. |
| AC6 test kiến trúc | Đạt | `test/architecture.test.ts` xanh với hai bảng mới. |
| AC7 toàn bộ test + typecheck | Đạt (có ghi chú về timeout, mục 4) | `npm run typecheck -w apps/web` exit 0; `npm test` exit 0, 1279/1279. |

## 4. Kiểm tra

### Migration local

```text
$ npm run db:migrate:local -w apps/web
...
🌀 Executing on local database vnxsi (40caf091-7723-4278-9f46-c07069440e73) from .wrangler\state\v3\d1:
🚣 4 commands executed successfully.
┌──────────────────────────┬────────┐
│ name                     │ status │
├──────────────────────────┼────────┤
│ 0008_requests.sql        │ ✅     │
├──────────────────────────┼────────┤
│ 0010_feature_flags.sql   │ ✅     │
├──────────────────────────┼────────┤
│ 0011_partners.sql        │ ✅     │
├──────────────────────────┼────────┤
│ 0012_outbound_clicks.sql │ ✅     │
├──────────────────────────┼────────┤
│ 0013_ops_members.sql     │ ✅     │
└──────────────────────────┴────────┘
(exit 0)
```

Ghi chú: D1 local của worktree này (`apps/web/.wrangler`, đã gitignore) còn thiếu sẵn `0008`, `0010`–`0012` từ trước, nên lệnh áp luôn các migration đó cùng `0013`.

### Typecheck

```text
$ npm run typecheck -w apps/web
> typecheck
> wrangler types --strict-vars=false && tsc --noEmit
...
📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.
(exit 0; tsc không báo lỗi)
```

### Test

Baseline (trước khi sửa, `12902b2` + handoff):

```text
$ npm test
 Test Files  6 failed | 117 passed (123)
      Tests  6 failed | 1188 passed (1194)
```

Cả 6 lỗi đều là `Test timed out in 5000ms` (hub, jobs, public); chạy riêng 6 file đó: `Test Files 6 passed (6)`, `Tests 76 passed (76)`.

Sau khi làm, lần chạy đầu: 8 lỗi, cả 8 đều `Test timed out in 5000ms`, ở các file không liên quan (admin/feedback, db/inquiries, hub/inquiries, landing/deck, notify/inquiry, public/inquiry-form, public/product-page); chạy riêng 7 file đó: `Tests 72 passed (72)`. Lần chạy toàn bộ thứ hai:

```text
$ npm test
 Test Files  125 passed (125)
      Tests  1279 passed (1279)
   Duration  252.19s (transform 81.27s, setup 1644.15s, import 57.24s, tests 324.00s, environment 13ms)
(exit 0)
```

Trước / sau: 1194 → 1279 test (+85 = 73 domain + 12 db), 123 → 125 file. Ba file của task chạy riêng: `Tests 96 passed (96)`.

Timeout 5 s xuất hiện ở cả baseline và không lặp lại theo file: do máy tải nặng (nhiều phiên dùng chung), không do thay đổi này.

## 5. Sai khác và lựa chọn thiết kế (kèm lý do)

1. **Mọi hàm ghi trả statement, không chỉ "nhận lời mời".** Handoff chỉ yêu cầu bắt buộc với nhận lời mời; spec §3.4 yêu cầu mọi thay đổi membership nguyên tử cùng audit, nên tạo/hủy lời mời, đổi vai trò, xóa member và quét hết hạn cũng là statement (theo mẫu `setFeedbackStatusStatement`, `setUserStatusStatement`) để VNX-2506 gói vào `db.batch` mà không phải viết lại. Chạy riêng bằng `.run()`/`.first()` vẫn được. `createOpsInviteStatement` trả `{ id, statement }` để route biết id cho audit.
2. **Chặn lời mời `pending` thứ hai bằng `INSERT … SELECT … WHERE NOT EXISTS`**, trả không dòng thay vì ném lỗi; index duy nhất là lớp chặn khi có race (lúc đó statement ném lỗi và cả batch rollback).
3. **Chuyển trạng thái lời mời là một hàm `opsInviteTransition(status, action)` với `action ∈ accept | cancel | expire`, trả `{ ok: false, error: "invalid_transition" }`** thay vì ba hàm ném lỗi: theo mẫu `feedbackTransition`/`userTransition` đã có.
4. **Mốc hết hạn:** hết hạn từ đúng thời điểm `expires_at` (`expires_at <= now`), giống `inviteState` (mã mời builder) và `login_tokens`. Nhận lời mời dùng `expires_at > now`, quét dùng `expires_at <= now`: hai điều kiện bù nhau.
5. **Nhận lời mời ràng email theo `users.email` của `userId`** (không nhận email từ tham số): người khác không thể nhận lời mời dù biết id. Member có sẵn được cập nhật `role`, `granted_by` (= người tạo lời mời), `granted_at`, `updated_at` = thời điểm nhận (spec §3.3: `granted_at` là thời điểm cấp vai trò hiện tại).
6. **Đổi vai trò là compare-and-set theo `from`** và ghi lại `granted_by`, `granted_at` (spec §3.3: "User Owner đã cấp hoặc thay đổi membership").
7. **`resolveRole` chuẩn hóa email (`trim().toLowerCase()`)** trước khi so với `adminEmails` (đã lower-case ở `auth/admin.ts`).
8. **Export thêm** ngoài danh sách handoff: `OPS_CAPABILITIES`, `OPS_INVITE_STATUSES`, `opsInviteExpiresAt`, các kiểu `OpsMember`/`OpsMemberListing`/`OpsInvite`, `findOpsInviteById`, `findPendingOpsInvite`: cần cho test và cho luồng verify ở VNX-2506.
9. **Trùng tên `INVITE_TTL_MS`:** `src/domain/request.ts` đã export một `INVITE_TTL_MS` (lời mời builder vào request, cũng 7 ngày). Giữ tên theo handoff; file nào cần cả hai phải dùng alias khi import.

## 6. Câu hỏi mở / việc để lại cho task sau

- **VNX-2506 — lời mời quá hạn chưa quét chặn lời mời mới:** lời mời `pending` đã qua `expires_at` nhưng cron chưa chạy vẫn giữ chỗ trong `uq_ops_invite_pending`, nên `createOpsInviteStatement` cho cùng email sẽ không ghi gì. Route nên chạy `expireOpsInvitesStatement` (kèm audit hết hạn) trong cùng batch trước khi tạo, hoặc báo cho Owner hủy lời mời cũ. Cần Reviewer/Owner chốt.
- **VNX-2506 — guard audit cho hai bảng mới chưa có** trong `db/audit.ts` (ngoài phạm vi). Gợi ý: lời mời theo `id + status + updated_at`; member theo `user_id + role + updated_at`; xóa member theo `NOT EXISTS`.
- **VNX-2506 — luật route chưa nằm ở tầng db:** mời email của Owner gốc, mời người đã là member, nhận lời mời khi user `suspended` (luồng verify đã yêu cầu `active`; `resolveRole` cũng trả null cho suspended).

## 7. Ghi nhận

- Thư mục `.claude/` untracked trong checkout chính không thuộc worktree này; không đụng.
- Không có route, middleware, UI, i18n hay cron trong task này.
