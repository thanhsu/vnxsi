# VNX-2702c — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-11
- **Căn cứ:** phán quyết guard audit trong re-review `.ai/reviews/VNX-2703b-review.md` (cột `write_id`, guard theo `write_id`, sửa thẳng `0018` khi còn chưa merge, không `changes()`) và nghĩa vụ "VNX-2702c" trong `.ai/context/CURRENT-STATUS.md`. Theo quy ước EPIC 27 (L-6), phán quyết + nghĩa vụ là handoff.
- **Đã đọc:** báo cáo `.ai/tasks/VNX-2702c-report.md`; toàn bộ diff `7111236..0671db0` (12 file, +302/−106; code `56758f2`, báo cáo `0671db0`): `migrations/0018_request_board.sql`, `db/audit.ts`, `db/request-board.ts`, `routes/{me-requests,ops-request-board,request-form}.tsx`, `e2e/seed/build-seed.mjs`, các test `db/request-board*.test.ts`, `me/request-board.test.ts`, `ops/marketplace-request-board.test.ts`; `lib/ulid.ts` (80 bit ngẫu nhiên mỗi id).
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `0671db0`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- test/db/request-board.test.ts test/db/request-board-migration.test.ts test/me/request-board.test.ts test/ops/marketplace-request-board.test.ts test/public/request-form.test.ts test/architecture.test.ts --maxWorkers=2 --testTimeout=60000`: **6 file, 191 test xanh**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: lần đầu **dừng giữa chừng vì máy hết chỗ** (`workerd … database or disk is full: SQLITE_FULL`; ổ C còn 0,27 GB, các phiên khác cũng dùng ổ này). Đây là lỗi môi trường, không phải lỗi test. Lần chạy lại (ổ C 0,56 GB): **196 file, 2491 passed + 2 skipped**, không có test lỗi lẻ nào. Bốn lỗi do tải máy mà Implementer gặp (`admin/merchants`, `http/turnstile`, `views/plain-text`) **không tái hiện**.
  - `npm run e2e` (một lần, `workers: 1`): **65 passed, 1.5 phút, không retry**. Sau khi chạy không còn tiến trình `workerd`/`node` nào của worktree.
  - Worktree không có `.wrangler/state` của `npm run dev`. Vì thế việc sửa `0018` tại chỗ không để lại DB local nào đã chạy bản cũ (trạng thái e2e được dựng lại mỗi lần chạy).

## Verdict

**APPROVE.**

Đối chiếu từng điểm của phán quyết:

- **Migration.** `0018` được sửa tại chỗ: thêm `write_id TEXT NOT NULL`, không có default, cho **cả** `request_publications` lẫn `request_interests`. Chú thích nêu lý do. Lựa chọn này đúng: hai bảng đều mới, migration không chèn dòng nào, và thiếu `write_id` là lỗi phải lộ ra, không được im lặng thành NULL (không guard nào khớp được). Đúng mẫu của `merchants`/`offers`/`partner_programs` (0011). `0018` chưa merge và chưa chạy ở môi trường remote nào (CURRENT-STATUS: "không chạy migration remote"). Test migration kiểm danh sách cột và `NOT NULL` trên cả hai bảng.
- **Mọi lần ghi đặt `write_id`.** Có đủ 11 câu ghi: `optIn`, `reOptIn`, `publish`, `editPublic`, `reject`, `unpublish`, `withdraw`, `createInterest`, `withdrawInterest`, `dismissInterest`, `markInterestsInvited`. `writeId` là input **bắt buộc** về kiểu, nên không dựng được câu ghi nào thiếu nó (typecheck sạch). Không còn câu `INSERT`/`UPDATE` nào của hai bảng ngoài `db/request-board.ts`, và test `WRITERS` vẫn xanh.
- **Guard.** `AuditPublicationGuard` khớp `request_id = ? AND write_id = ?`; `AuditInterestGuard` khớp `id = ? AND write_id = ?`. Cùng dạng với `AuditFlagGuard`/`AuditPartnerGuard`, không dùng `changes()`. Có thêm `interestAuditGuard` cho 2706a/b.
- **CAS giữ nguyên.** Mọi điều kiện `status = … AND updated_at = ?` và `RETURNING *` đều như cũ; chỉ thêm `write_id = ?n` vào `SET`. `updated_at` vẫn là token của form Ops.
- **Nơi gọi.** Ba nơi gọi, mỗi lần ghi sinh **một** `ulid()` và truyền **cùng** giá trị đó cho câu ghi và guard:
  - `request-form.tsx`: tạo request kèm opt-in;
  - `me-requests.tsx`: opt-in, opt-in lại, gỡ;
  - `ops-request-board.tsx`: publish, edit, reject, unpublish.

  Nếu một route lỡ truyền hai id khác nhau thì các test thành công đã có sẽ đỏ, vì chúng khẳng định đúng một dòng audit ở 2703a, `/me` và Ops. Vì vậy test route không cần ca trùng mili-giây riêng.
- **`createInterestStatement` nhận `id` từ nơi gọi.** Cần thiết, vì guard cần biết id trước khi batch chạy. Câu `INSERT … SELECT` vẫn giữ mọi cổng.
- **`markInterestsInvitedStatements`.** Một `writeId` cho cả batch là đủ, vì khóa của guard gồm danh tính từng interest. Hiện chưa có guard audit nào cho bước này: đó là nghĩa vụ của 2706b, xem dưới.
- **E2E seed.** Ba publication seed có `write_id: id("W", n)`, tất định. Không còn chỗ seed nào khác chèn vào hai bảng.

**Bằng chứng red-first: chấp nhận.** Implementer viết guard mới trước, nên "đỏ" được chứng minh bằng cách tạm cho guard chạy như guard cũ (`updated_at = now`, bỏ qua `write_id`). Với guard đó, 10/10 ca race đỏ đúng ở assertion "no audit row for an action that did not happen"; khi khôi phục guard thật thì 11/11 xanh. Đây là kiểm thử đột biến đúng chỗ. Reviewer kiểm lại bằng lập luận trên chính test: bên thắng và bên thua chạy ở **cùng** `now`, tới **cùng** trạng thái đích, mỗi bên có actor riêng. Vì vậy với guard cũ, `EXISTS (status = đích AND updated_at = now)` của bên thua chắc chắn đúng, và có một dòng audit thừa mang actor của bên thua. Với guard mới, dòng chỉ mang `write_id` của bên thắng. Ca `edit` (`published` → `published`) là ca mà guard cũ không bao giờ phân biệt được, và đã được phủ. Test có sức nặng. Reviewer không chạy lại đột biến vì đây là review chỉ đọc, không sửa code.

**Test route 2703b vẫn dùng `now + 1s`: chấp nhận.** Test đó kiểm nhánh "batch trả 0 dòng → 409" ở tầng route, không kiểm guard. Bằng chứng cho trường hợp trùng mili-giây nằm ở tầng DB, nơi hai lần ghi bị ép cùng `now`, và đó là chỗ đúng (nghĩa vụ "thêm lại một ca trùng ms" trong re-review 2703b được đáp ứng ở tầng DB). Đổi test route về cùng `now` giờ cũng sẽ xanh, nhưng không thêm bảo đảm nào.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| S-1 | SUGGESTION | `src/routes/{me-requests,ops-request-board,request-form}.tsx:1`; `test/me/request-board.test.ts:1`; `test/ops/marketplace-request-board.test.ts:1` | `import { ulid }` được chèn **trước** `import type { Context, Hono } from "hono"`, lệch thứ tự import của các tệp này (thư viện trước, mã nội bộ sau). Không ảnh hưởng chạy. | Dời khi chạm tệp lần sau. | Implementer (tùy chọn) |

Không có BLOCKER, HIGH, MEDIUM hay LOW.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| `0018` sửa tại chỗ: `write_id TEXT NOT NULL` không default, hai bảng | ✓ | diff migration; test "requires write_id on both tables" |
| Mọi `INSERT`/`UPDATE` trong `db/request-board.ts` đặt `write_id`; `writeId` bắt buộc | ✓ | 11 câu ghi; kiểu input; typecheck |
| Guard khớp `request_id`/`id` + `write_id`, không `changes()` | ✓ | `db/audit.ts:60-77` |
| CAS trên `updated_at` không đổi | ✓ | diff chỉ thêm vào `SET` |
| Nơi gọi: một ULID mỗi lần ghi, cùng giá trị cho câu ghi và guard | ✓ | `request-form.tsx`, `me-requests.tsx`, `ops-request-board.tsx`; test thành công khẳng định 1 dòng audit |
| `createInterestStatement` nhận `id`; `markInterestsInvited` một `writeId`/batch | ✓ | diff `db/request-board.ts` |
| Test race trùng mili-giây cho opt-in, opt-in lại, gỡ, publish, edit, reject, unpublish, interest create/withdraw/dismiss | ✓ | `describe("…audit guards match a per-write id (VNX-2702c)")`, 11 ca |
| E2E seed có `write_id` | ✓ | `build-seed.mjs`; `npm run e2e` 65/65 |
| Bộ đầy đủ xanh | ✓ | 196 / 2491 + 2 skipped (sau lần đầu hết chỗ đĩa, lỗi môi trường) |

## Nghĩa vụ để lại cho task sau

- **VNX-2706a:** route interest sinh `id` (ULID) và `writeId` **mỗi lần ghi**, truyền cùng `writeId` cho `createInterestStatement`/`withdrawInterestStatement` và `auditStatement(…, interestAuditGuard({ interestId, writeId }))`. Không có guard theo trạng thái.
- **VNX-2706b:**
  - Dismiss dùng `interestAuditGuard` như trên.
  - Đường mời: `markInterestsInvitedStatements` chưa có audit guard. Nếu ghi audit `request_interest.invite` cho từng interest, guard phải khóa theo **danh tính interest + `write_id` của batch**. Có hai cách: đọc id interest `pending` của các builder trước batch rồi dùng `interestAuditGuard`, hoặc thêm một biến thể guard `(request_id, builder_id, write_id)`. Không dùng `status = 'invited'` + `updated_at`. Phải có test: lời mời thua cổng 5 thì không có dòng audit invite cho interest đó.
- **Ngoài EPIC 27 (Ghi nhận):** các guard cũ dùng trạng thái + `updated_at` (`AuditRequestGuard`, `AuditInviteGuard`, `AuditInquiryGuard`, `AuditFeedbackGuard`, `AuditUserGuard`, `AuditProductGuard`) có cùng điểm yếu lý thuyết khi hai lần ghi trùng mili-giây. Không sửa trong epic này. Nếu sửa, làm theo cùng mẫu `write_id`, ở một task riêng.
- **Môi trường:** ổ C gần đầy (0,27–0,56 GB) làm bộ test đầy đủ dừng vì `SQLITE_FULL`. Owner nên dọn chỗ trước các lượt chạy dài tiếp theo (2704b trở đi).
