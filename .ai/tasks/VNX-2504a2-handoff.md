# VNX-2504a2 — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2504 (tách: 2504a Builders đã xong; **2504a2 Products**; 2504b Inquiries + Requests + Invites). Reviewer duyệt việc tách trong `.ai/reviews/VNX-2504a-review.md`.
- **Khuôn có sẵn:** làm Products theo **đúng mẫu Builders** của VNX-2504a (`src/routes/ops-marketplace.tsx`, view, CSS `.ops-*`, menu, test). Đọc `.ai/tasks/VNX-2504a-report.md` và `.ai/reviews/VNX-2504a-review.md`.
- **Spec:** spec Ops §2.2, §3.1, §7.3. Mockup: `docs/design/mockups/ops/OpsBuilders.dc.html` (dùng chung bố cục danh sách + khung chi tiết).
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2504a2-report.md`
- **Nhánh:** `feat/ops-o1`. Không push, không merge.

## Phạm vi đã duyệt

1. Route (capability như 2504a):

   | Route | Capability |
   |---|---|
   | `GET /ops/marketplace/products` (bộ lọc trạng thái của hàng đợi admin hiện có + `?q=` tên/slug) | `marketplace.view` |
   | `GET /ops/marketplace/products/:id` | `marketplace.view` |
   | Mọi POST hành động product hiện có trong `src/routes/admin-products.tsx` (duyệt, yêu cầu sửa, khóa/mở, gắn/thu hồi huy hiệu, mục "mới chỉnh sửa" nếu có thao tác) dưới `/ops/marketplace/products/:id/...` | `marketplace.act` |

2. Tách hàm dùng chung khỏi `src/routes/admin-products.tsx` (như `decideBuilder`); `/admin` giữ nguyên hành vi; state machine, huy hiệu, email, audit, compare-and-set, batch nguyên tử (thu hồi Demo verified + duyệt) không đổi.
3. Danh sách và chi tiết theo mẫu Builders: thẻ trạng thái có số, tìm kiếm, bảng; chi tiết có các trường công khai mà admin hiện thấy, ảnh (link `/media`), tier giá, huy hiệu đang hiệu lực, lý do bắt buộc khi nghiệp vụ yêu cầu, xác nhận `<details>` cho yêu cầu sửa / khóa / thu hồi huy hiệu, History audit của product. Viewer không thấy form; POST Viewer/Content → 404 kín.
4. Menu Marketplace › Products có số `in_review`; thẻ Overview "Products in review" có link.
5. CSS và khóa `ops.*` bổ sung (chỉ `en.ts`).

## Ngoài phạm vi

Inquiries, Requests, Invites (2504b); Users, Feedback (2505); gỡ/chuyển hướng `/admin` (2508); đổi nghiệp vụ.

## Ràng buộc

Như VNX-2504a: CSP (không style/script nội tuyến; mở rộng CSP scan sang trang mới), POST ≤ 64 KB, không `Referrer-Policy: no-referrer` trên trang có form, mọi route qua `requireOps`, `ops.*` chỉ ở `en.ts`, thứ tự middleware không đổi; diff (không tính test, locale) vượt ~600 dòng thì dừng và báo.

## Đọc trước

`CLAUDE.md`; plan O1; báo cáo + review 2504a; `src/routes/ops-marketplace.tsx`; `src/routes/admin-products.tsx`; `src/views/admin/{ProductsQueuePage,ProductDetailPage}.tsx`; `test/admin/products.test.ts`, `test/admin/badges.test.ts`; `test/ops/marketplace-builders.test.ts` (mẫu test).

## Tiêu chí chấp nhận

- [ ] AC1: Owner/Operator làm được mọi hành động product như admin cũ (dữ liệu, huy hiệu, email, audit giống) — `npm test -- test/ops/marketplace-products.test.ts`
- [ ] AC2: Viewer chỉ xem; POST Viewer/Content → 404 kín, không ghi gì — cùng file
- [ ] AC3: Content không vào được (404 kín) — cùng file
- [ ] AC4: Bộ lọc + tìm kiếm qua URL, giá trị lạ bỏ qua — cùng file
- [ ] AC5: History audit theo projection an toàn — cùng file
- [ ] AC6: `/admin` cũ chạy y như trước — `npm test -- test/admin`
- [ ] AC7: Menu Products (Owner/Operator/Viewer), thẻ Overview có link — `test/ops/layout.test.ts`, `test/ops/overview.test.ts`
- [ ] AC8: CSP scan có trang mới; typecheck + toàn bộ test xanh — `npm run typecheck -w apps/web`, `npm test`
- [ ] AC9: giống mẫu Builders ở 1280 và 390 px — Reviewer xem

## Cấm

Không sửa ngoài phạm vi trên (ghi lý do nếu bắt buộc); không dependency mới; TDD; Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
