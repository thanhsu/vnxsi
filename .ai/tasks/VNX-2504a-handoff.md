# VNX-2504a — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2504 (tách theo quy ước roadmap: **2504a** Builders + Products; 2504b Inquiries + Requests + Invites).
- **Spec:** spec Ops §2.2, §3.1, §7.3. **Mockup đã duyệt:** `docs/design/mockups/ops/OpsBuilders.dc.html`.
- **Review trước:** `.ai/reviews/VNX-2503-review.md`.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2504a-report.md`
- **Nhánh:** `feat/ops-o1` (có VNX-2501…2503). Không push, không merge.

## Mục tiêu

Hàng đợi **Builders** và **Products** chạy trong Ops tại `/ops/marketplace/builders` và `/ops/marketplace/products`, tiếng Anh, trong `OpsLayout`, theo quyền vai trò; logic nghiệp vụ và audit giữ nguyên.

## Phạm vi đã duyệt

1. **Route mới** (`src/routes/ops-marketplace.tsx` hoặc tách 2 file):

   | Route | Capability |
   |---|---|
   | `GET /ops/marketplace/builders` (`?status=pending|approved|rejected|suspended`, `?q=`) | `marketplace.view` |
   | `GET /ops/marketplace/builders/:userId` | `marketplace.view` |
   | `POST /ops/marketplace/builders/:userId/{approve,reject,suspend,unsuspend}` | `marketplace.act` |
   | `GET /ops/marketplace/products` (theo các bộ lọc trạng thái hàng đợi hiện có, `?q=`) | `marketplace.view` |
   | `GET /ops/marketplace/products/:id` | `marketplace.view` |
   | Mọi POST hành động product hiện có (duyệt, yêu cầu sửa, khóa/mở, gắn/thu hồi huy hiệu) dưới `/ops/marketplace/products/:id/...` | `marketplace.act` |

2. **Dùng lại logic:** tách phần xử lý dùng chung khỏi `src/routes/admin.tsx`, `src/routes/admin-products.tsx` thành hàm được cả route `/admin` cũ và route `/ops` mới gọi (route `/admin` **giữ nguyên hành vi** tới VNX-2508). Không đổi state machine, email, audit, compare-and-set.
3. **Giao diện** (`src/views/ops/…`), tiếng Anh với khóa `ops.*` trong `en.ts`:
   - **Danh sách:** thẻ trạng thái có số lượng, ô tìm kiếm (builder: tên, handle, email; product: tên, slug), bảng dày theo mockup, phân trang nếu truy vấn hiện có hỗ trợ (không làm phân trang giả). Bộ lọc nằm trong URL, giá trị allowlist.
   - **Chi tiết:** theo khung bên phải của mockup (danh sách thông tin, ô lý do khi cần, nút hành động, "History" = các dòng audit của đối tượng theo projection an toàn của VNX-2503). Mockup đặt danh sách và chi tiết cạnh nhau; ở task này **chi tiết là trang riêng** cùng bố cục khung phải (chấp nhận), có link quay lại giữ bộ lọc.
   - Hành động nguy hiểm (reject, suspend, request changes, revoke badge) cần bước xác nhận không dùng JS (ví dụ `<details>` mở form xác nhận, hoặc trang xác nhận) và lý do bắt buộc khi nghiệp vụ hiện có yêu cầu.
   - Sau POST thành công/lỗi: 303 về trang chi tiết với thông báo kết quả (giống mẫu admin hiện có); 409 khi chuyển trạng thái không hợp lệ.
   - **Viewer:** thấy danh sách và chi tiết, **không** thấy form hay nút hành động; POST của Viewer (và Content) → 404 kín qua `requireOps`.
4. **Menu:** thêm nhóm Marketplace với Builders và Products vào registry `src/ops/menu.ts`; số lượng chờ cạnh mục nếu đã có hàm đếm (dùng lại của Overview). Thẻ Overview "Builders to review" và "Products in review" tự có link khi route tồn tại.
5. **CSS:** lớp `.ops-*` bổ sung (tabs, bảng, ô tìm kiếm, danh sách mô tả, lịch sử, xác nhận), không style nội tuyến.

## Ngoài phạm vi (không làm)

Inquiries, Requests, Invites (2504b); Users, Feedback (2505); xóa hay chuyển hướng `/admin` (2508); thay đổi nghiệp vụ duyệt; bố cục danh sách + chi tiết cạnh nhau trên cùng một trang.

## Ràng buộc

CSP VNX-0803 (không style/script nội tuyến); POST ≤ 64 KB; không `Referrer-Policy: no-referrer` trên trang có form; mọi route qua `requireOps`; `ops.*` chỉ ở `en.ts`; thứ tự middleware không đổi.

## Đọc trước

`CLAUDE.md`; plan O1; spec §2.2, §3.1, §7.3; mockup `OpsBuilders.dc.html`; `src/routes/admin.tsx`, `src/routes/admin-products.tsx`, `src/views/admin/{BuildersPage,BuilderDetailPage,ProductsQueuePage,ProductDetailPage}.tsx`, `src/auth/ops.ts`, `src/ops/menu.ts`, `src/views/ops/*`, `src/routes/ops.tsx`, test admin hiện có (`test/admin/builders.test.ts`, `test/admin/products.test.ts`, `test/admin/badges.test.ts`).

## File dự kiến bị ảnh hưởng

Mới: route/view Ops cho builders và products, `test/ops/marketplace-builders.test.ts`, `test/ops/marketplace-products.test.ts`. Sửa: `src/routes/admin.tsx`, `src/routes/admin-products.tsx` (chỉ tách hàm dùng chung), `src/app.ts`, `src/ops/menu.ts`, `src/i18n/messages/en.ts`, `public/assets/app.css`, các `src/db/*.ts` nếu cần hàm tìm kiếm (chỉ đọc).

## Tiêu chí chấp nhận

- [ ] AC1: Owner/Operator thao tác được đủ hành động builder và product như admin cũ (dữ liệu, email, audit giống) — `npm test -- test/ops/marketplace-builders.test.ts test/ops/marketplace-products.test.ts`
- [ ] AC2: Viewer xem được danh sách và chi tiết, không có form; POST của Viewer/Content → 404 kín, không ghi gì — cùng file test
- [ ] AC3: Content không vào được danh sách/chi tiết (404 kín) — cùng file test
- [ ] AC4: Bộ lọc trạng thái và tìm kiếm qua URL, giá trị lạ bị bỏ qua — cùng file test
- [ ] AC5: History hiện audit của đối tượng theo projection an toàn — cùng file test
- [ ] AC6: Route `/admin` cũ vẫn chạy y như trước (test admin hiện có xanh) — `npm test -- test/admin`
- [ ] AC7: Menu có Builders, Products cho Owner/Operator/Viewer, không cho Content; thẻ Overview có link — `test/ops/layout.test.ts`, `test/ops/overview.test.ts`
- [ ] AC8: không style/script nội tuyến (CSP scan có các trang mới); typecheck + toàn bộ test xanh (timeout ngẫu nhiên: chạy riêng, ghi lại) — `npm run typecheck -w apps/web`, `npm test`
- [ ] AC9: giống mockup (danh sách + khung chi tiết) ở 1280 và 390 px — Reviewer xem

## Cấm

Không sửa ngoài danh sách (ghi lý do nếu bắt buộc); không dependency mới; TDD (commit test trước); diff dự kiến > ~600 dòng (không tính file test, locale) thì dừng và báo để tách tiếp; Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
