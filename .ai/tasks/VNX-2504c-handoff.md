# VNX-2504c — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2504 (phần cuối sau 2504a Builders, 2504a2 Products, 2504b Requests): **Inquiries + Invites**.
- **Khuôn có sẵn:** làm theo **đúng mẫu Builders/Products/Requests** (`src/routes/ops-marketplace.tsx`, `src/views/ops/{BuildersPages,ProductsPages,RequestsPages,parts}.tsx`, CSS `.ops-*`, `src/ops/menu.ts`, `src/routes/ops.tsx` MENU_COUNTS, `test/ops/marketplace-requests.test.ts`). Đọc `.ai/tasks/VNX-2504b-report.md` và `.ai/reviews/VNX-2504b-review.md`.
- **Spec:** spec Ops §2.2, §3.1 (Viewer đọc màn hình Marketplace, không thấy form), §7.3; spec Wave 1 §5.5 (Inquiry, invite code). Mockup: `docs/design/mockups/ops/OpsBuilders.dc.html` (phần danh sách).
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2504c-report.md`
- **Nhánh:** `feat/ops-o1`. Không push, không merge.

## Phạm vi đã duyệt

1. Route:

   | Route | Capability |
   |---|---|
   | `GET /ops/marketplace/inquiries` (`?status=<INQUIRY_STATUSES>`, `?view=overdue`, `?q=`) | `marketplace.view` |
   | `POST /ops/marketplace/inquiries/:id/remove` | `marketplace.act` |
   | `GET /ops/marketplace/invites` | `marketplace.view` |
   | `POST /ops/marketplace/invites` (tạo mã mời builder) | `marketplace.act` |

2. **Tách hàm dùng chung** khỏi `src/routes/admin-inquiries.tsx` (remove: `transition(…, "remove", "admin")`, batch đổi trạng thái + audit `inquiry.remove` có guard) và `src/routes/admin-invites.tsx` (schema `InviteForm`, `randomToken(16)`, `sha256Hex`, `createInvite`, audit `invite.create` với `entityId = codeHash` và `data {maxUses, expiresAt}`) theo mẫu kết quả có kiểu. `/admin/inquiries*`, `/admin/invites` giữ nguyên response.
3. **Inquiries (danh sách, không có trang chi tiết ở O1, giống admin):**
   - Tab trạng thái có số (đếm `GROUP BY status` trong `db/inquiries.ts`), tab mặc định là tất cả như admin (`status` null), thêm tab **Overdue** (`?view=overdue`) dùng **đúng luật** của thẻ Overview "Overdue inquiries" (hàm đếm VNX-2503 dựa trên `REMIND_AFTER_MS`/luật cron M5): thêm một hàm đọc cùng điều kiện WHERE, không tự đặt mốc mới. Giá trị lạ bị bỏ qua.
   - `?q=` (trim, 1–100, `instr(lower(…))`) trên tên product / tiêu đề request / handle builder: chọn trường có trong truy vấn `listInquiriesForAdmin`, ghi rõ trong báo cáo.
   - Cột như admin: ID, client (e-mail), builder, product hoặc request, trạng thái, thời điểm, đoạn tin nhắn ≤ 200 ký tự (như admin). Viewer thấy như admin (spec §3.1), không form.
   - Remove: mỗi dòng có `<details class="ops-confirm">` với nút xác nhận (chỉ `canAct`); xong 303 về danh sách giữ bộ lọc + `done=1`; 409 hiện lại danh sách với thông báo conflict.
4. **Invites:**
   - Form tạo (max uses 1–1000, days 1–90, note ≤ 200; mặc định như admin) chỉ khi `canAct`; 400 render lại với lỗi từng trường và giá trị đã nhập.
   - Sau tạo: render trang (200, không redirect) hiện **link `/join/<code>` một lần** trong ô readonly, như admin. Mã gốc **không** được lưu, ghi log, đưa vào URL redirect, query string hay audit. Response đã có `no-store` của Ops.
   - Danh sách: note, uses, expires, trạng thái (`inviteState`), như admin. Viewer chỉ thấy danh sách.
5. **Menu:** Marketplace › Inquiries (số = số quá hạn, dùng lại hàm đếm của Overview) và Marketplace › Invites (không số). Thẻ Overview "Overdue inquiries" link tới `/ops/marketplace/inquiries?view=overdue` (sửa `QUEUE_TARGETS` nếu cần để link có query).
6. CSS `.ops-*` bổ sung nếu cần; khóa `ops.*` chỉ ở `en.ts`.

## Ngoài phạm vi

Trang chi tiết Inquiry; thu hồi invite code (chưa có ở admin); Users, Feedback (2505); gỡ/chuyển hướng `/admin` (2508); đổi nghiệp vụ.

## Ràng buộc

CSP VNX-0803 (không style/script nội tuyến; mở rộng CSP scan sang 2 trang mới, gồm trang sau khi tạo invite), POST ≤ 64 KB, không `Referrer-Policy: no-referrer` trên trang có form, mọi route qua `requireOps`, `ops.*` chỉ ở `en.ts`, thứ tự middleware không đổi, `test/architecture.test.ts` xanh. Diff (không tính test, locale) vượt ~600 dòng thì dừng và báo.

## Môi trường máy

Máy dùng chung, RAM và đĩa sát giới hạn. `npm test` một lượt có thể hết bộ nhớ: chạy theo thư mục (`npx vitest run test/<dir>/ --maxWorkers=2` trong `apps/web`, cùng các file `test/*.test.ts`) và ghi kết quả từng nhóm. Timeout 5 s ngẫu nhiên: chạy riêng file, ghi cả hai kết quả. Không mở `wrangler dev`.

## Đọc trước

`CLAUDE.md`; plan O1; spec Ops; báo cáo + review 2504b; `src/routes/ops-marketplace.tsx`; `src/routes/admin-inquiries.tsx`, `src/routes/admin-invites.tsx`; `src/views/admin/{InquiriesPage,InvitesPage}.tsx`; `src/db/inquiries.ts`, `src/db/invites.ts`; hàm đếm Inquiry quá hạn của Overview (`src/routes/ops.tsx`, `src/views/ops/OverviewPage.tsx`); `test/admin/inquiries.test.ts`, `test/admin/invites.test.ts`; `test/ops/overview.test.ts`.

## Tiêu chí chấp nhận

- [ ] AC1: Owner/Operator remove Inquiry và tạo invite như admin cũ (dữ liệu, audit giống; mã gốc chỉ có trong body của response tạo, không có trong DB/audit/header `Location`) — `npm test -- test/ops/marketplace-inquiries-invites.test.ts`
- [ ] AC2: Viewer chỉ xem; POST Viewer/Content → 404 kín, không ghi gì — cùng file
- [ ] AC3: Content và người không vai trò → 404 kín cho cả 2 trang — cùng file
- [ ] AC4: Tab + `?view=overdue` (khớp số của thẻ Overview với cùng dữ liệu) + tìm kiếm qua URL; giá trị lạ bỏ qua — cùng file
- [ ] AC5: `/admin` cũ chạy y như trước — `npm test -- test/admin`
- [ ] AC6: Menu Inquiries, Invites (Owner/Operator/Viewer, không Content); thẻ Overview "Overdue inquiries" link tới `?view=overdue` — `test/ops/layout.test.ts`, `test/ops/overview.test.ts`
- [ ] AC7: CSP scan có trang mới; typecheck + toàn bộ test xanh — `npm run typecheck -w apps/web`, test theo thư mục như trên
- [ ] AC8: giống mẫu Builders/Products/Requests ở 1280 và 390 px — Reviewer xem

## Cấm

Không sửa ngoài phạm vi (ghi lý do nếu bắt buộc); không dependency mới; TDD (commit test trước); Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
