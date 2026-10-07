# VNX-2504b — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2504. Đã tách theo rủi ro của plan ("tách nhỏ thêm nếu diff > ~600 dòng"): 2504a Builders, 2504a2 Products (xong); **2504b Requests** (task này); 2504c Inquiries + Invites (sau). Lý do tách: `admin-requests.tsx` (142 dòng) + `RequestDetailPage.tsx` (206 dòng) là màn hình lớn nhất của Marketplace.
- **Khuôn có sẵn:** làm theo **đúng mẫu Builders/Products** (`src/routes/ops-marketplace.tsx`, `src/views/ops/{BuildersPages,ProductsPages,parts}.tsx`, CSS `.ops-*`, `src/ops/menu.ts`, `test/ops/marketplace-{builders,products}.test.ts`). Đọc `.ai/tasks/VNX-2504a2-report.md` và `.ai/reviews/VNX-2504a2-review.md`.
- **Spec:** spec Ops §2.2, §3.1 (đoạn "Viewer được đọc các màn hình Marketplace… nhưng không thấy form"), §7.3; spec Wave 1 §5.5, §8.10 (luồng request M6). Mockup: `docs/design/mockups/ops/OpsBuilders.dc.html`.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2504b-report.md`
- **Nhánh:** `feat/ops-o1`. Không push, không merge.

## Phạm vi đã duyệt

1. Route:

   | Route | Capability |
   |---|---|
   | `GET /ops/marketplace/requests` (bộ lọc trạng thái như admin: mặc định `submitted`, `?status=<REQUEST_STATUSES>` hoặc `all`; `?q=` tiêu đề) | `marketplace.view` |
   | `GET /ops/marketplace/requests/:id` | `marketplace.view` |
   | `POST /ops/marketplace/requests/:id/{invite,reject,remove}` | `marketplace.act` |

2. Tách hàm dùng chung khỏi `src/routes/admin-requests.tsx` theo mẫu `decideProduct` (kết quả có kiểu, caller tự render): `invite`, `reject`, `remove`. `/admin/requests*` giữ nguyên response. Không đổi: `requestTransition`, `inviteBuildersBatch` (cap `MAX_ACTIVE_INVITES`, trùng, client, eligibility), `endRequestBatch`, audit `request.invite|reject|remove` với guard, `parseAdminNote`, các e-mail `notifyInvited`, `notifyNotSelected`, `notifyInviteExpired`, `notifyRequestRejected` và luật "remove không báo client".
3. **Danh sách:** tab trạng thái có số (thêm hàm đếm `GROUP BY status` trong module sở hữu bảng `requests`, chỉ đọc), tab `all`, tìm `?q=` (trim, 1–100, `instr(lower(…))`), cột theo dữ liệu `listRequestsForAdmin` đang có. Giá trị lạ bị bỏ qua.
4. **Chi tiết:** đúng các trường admin hiện có (client name, client e-mail, tiêu đề, mô tả, ngân sách/thời hạn nếu có, admin note, danh sách invitation và trạng thái, gợi ý builder kèm lý do). Hành động: chọn builder để invite (khi `canInvite`), Reject với note bắt buộc trong `<details>` xác nhận, Remove trong `<details>` xác nhận nói rõ "client is not told". Sau remove: 303 về danh sách giữ bộ lọc. 400 render lại chi tiết với `<details>` mở. 409 đọc lại request và hiện trạng thái hiện tại. History audit theo projection an toàn.
5. **Viewer:** thấy danh sách và chi tiết (gồm e-mail client, như admin; spec §3.1), không form, không checkbox gợi ý, không nút. Content và người không vai trò → 404 kín.
6. Menu Marketplace › Requests (`marketplace.view`) với số `submitted` dùng lại hàm đếm của thẻ Overview "Requests to match"; thẻ Overview tự có link.
7. CSS `.ops-*` bổ sung nếu cần, khóa `ops.*` chỉ ở `en.ts`.

## Ngoài phạm vi

Inquiries, Invites (2504c); Users, Feedback (2505); gỡ/chuyển hướng `/admin` và đổi link trong e-mail (2508); đổi nghiệp vụ request.

## Ràng buộc

CSP VNX-0803 (không style/script nội tuyến; mở rộng CSP scan sang các trang mới), POST ≤ 64 KB, không `Referrer-Policy: no-referrer` trên trang có form, mọi route qua `requireOps`, `ops.*` chỉ ở `en.ts`, thứ tự middleware không đổi, `test/architecture.test.ts` xanh. Diff (không tính test, locale) vượt ~600 dòng thì dừng và báo.

## Môi trường máy

Máy dùng chung, RAM và đĩa sát giới hạn. `npm test` một lượt có thể hết bộ nhớ: khi đó chạy theo thư mục (`npx vitest run test/<dir>/ --maxWorkers=2` trong `apps/web`) và ghi kết quả từng nhóm. Timeout 5 s ngẫu nhiên: chạy riêng file, ghi cả hai kết quả. Không mở `wrangler dev` (Reviewer chụp ảnh).

## Đọc trước

`CLAUDE.md`; plan O1; spec Ops; báo cáo + review 2504a2; `src/routes/ops-marketplace.tsx`; `src/routes/admin-requests.tsx`; `src/views/admin/{RequestsPage,RequestDetailPage}.tsx`; `src/db/requests.ts`; `src/notify/request.ts`; `test/admin/requests.test.ts`, `test/admin/suspend-requests.test.ts`; `test/ops/marketplace-products.test.ts` (mẫu test).

## Tiêu chí chấp nhận

- [ ] AC1: Owner/Operator invite / reject / remove như admin cũ (dữ liệu, invitation, e-mail, audit giống; remove không e-mail client) — `npm test -- test/ops/marketplace-requests.test.ts`
- [ ] AC2: Viewer chỉ xem; POST Viewer/Content → 404 kín, không ghi gì (request, invitation, audit, outbox) — cùng file
- [ ] AC3: Content và người không vai trò → 404 kín cho danh sách và chi tiết — cùng file
- [ ] AC4: Bộ lọc + tìm kiếm qua URL, giá trị lạ bỏ qua, số trên tab đúng — cùng file
- [ ] AC5: History theo projection an toàn — cùng file
- [ ] AC6: `/admin` cũ chạy y như trước — `npm test -- test/admin`
- [ ] AC7: Menu Requests (Owner/Operator/Viewer, không Content), thẻ Overview có link — `test/ops/layout.test.ts`, `test/ops/overview.test.ts`
- [ ] AC8: CSP scan có trang mới; typecheck + toàn bộ test xanh — `npm run typecheck -w apps/web`, `npm test` (hoặc theo thư mục như trên)
- [ ] AC9: giống mẫu Builders/Products ở 1280 và 390 px — Reviewer xem

## Cấm

Không sửa ngoài phạm vi (ghi lý do nếu bắt buộc); không dependency mới; TDD (commit test trước); Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
