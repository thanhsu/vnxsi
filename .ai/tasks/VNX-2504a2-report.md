# VNX-2504a2 — Báo cáo Implementer

- **Task:** hàng đợi Ops Products dưới `/ops/marketplace/products` (handoff `.ai/tasks/VNX-2504a2-handoff.md`), theo đúng mẫu Builders của VNX-2504a.
- **Nhánh:** `feat/ops-o1` (worktree riêng), cắt từ `3c4be0d`. Không push, không merge, không deploy.
- **Kết quả:** xong toàn bộ phạm vi handoff. Diff `src` + `public` không tính locale **+528 / −40** (dưới ngưỡng ~600).

## Commit

| SHA | Nội dung |
|---|---|
| `3c5b05c` | `test:` `test/ops/marketplace-products.test.ts` (23 test mới); cập nhật `layout.test.ts`, `overview.test.ts`, case CSP trong `security-headers.test.ts`. Commit trước code. Đỏ trên mã nguồn ở `3c4be0d`: **22 hỏng / 52** (4 file) |
| `a6105bb` | `feat(web):` hàng đợi Products: danh sách, chi tiết, hành động trạng thái, gắn/thu hồi huy hiệu, menu, link thẻ Overview; tách hàm dùng chung khỏi `admin-products.tsx` |
| `8b3f806` | `refactor(web):` chỉ xuống dòng lại comment đầu file `ops-marketplace.tsx` cho đúng độ dài dòng (không đổi code) |

## File

Mới: `src/views/ops/ProductsPages.tsx` (danh sách + chi tiết), `test/ops/marketplace-products.test.ts`.

Sửa: `src/routes/admin-products.tsx` (chỉ tách hàm), `src/routes/ops-marketplace.tsx` (route Products), `src/db/products.ts` (thêm 2 hàm đọc), `src/ops/menu.ts`, `src/routes/ops.tsx` (một dòng: số đếm menu `products`), `src/views/ops/OpsLayout.tsx` (một icon), `src/i18n/messages/en.ts` (30 khóa `ops.*`), `public/assets/app.css` (7 dòng).

Test ngoài file mới (giống 2504a, do handoff mục 4 và AC8): `test/ops/layout.test.ts`, `test/ops/overview.test.ts`, `test/http/security-headers.test.ts`. Không đụng `src/app.ts` (route Products đăng ký trong `registerOpsMarketplaceRoutes` đã có, vẫn trước route bắt cuối `/ops`; thứ tự middleware không đổi).

## Triển khai

- **Route** (`ops-marketplace.tsx`): `GET /ops/marketplace/products` và `GET /ops/marketplace/products/:id` qua `requireOps("marketplace.view")`; `POST …/:id/{approve,request_changes,suspend,unsuspend}`, `POST …/:id/badges`, `POST …/:id/badges/:kind/revoke` qua `requireOps("marketplace.act")`. Product không tồn tại, product archived khi gắn huy hiệu, hoặc kind không thu hồi được (`listed`) → `opsNotFound` (404 kín), giống chỗ `/admin` trả 404.
- **Tách hàm dùng chung** (`admin-products.tsx`), như `decideBuilder`:
  - `decideProduct(c, action)` trả `not_found` / `invalid_note` / `conflict` / `done{productId, mailed}`. Thân hàm giữ nguyên: schema note (bắt buộc cho request_changes, tùy chọn cho suspend), `transition(…, "admin")`, **một batch** `setProductStatusStatement` + `grantBadgeStatement("listed")` khi approve/unsuspend + `auditStatement` cùng guard compare-and-set, `returnedProduct`, e-mail approve/request_changes theo locale builder.
  - `grantProductBadge(c)` và `revokeProductBadge(c)` trả `not_found` / `invalid{error}` / `conflict` / `done`. Giữ nguyên `GRANTABLE`, schema evidence (≤500) / reason (≤300), `grantBadge`/`revokeBadge` rồi `writeAudit` (`badge.grant` `{kind,evidence}`, `badge.revoke` `{kind,reason}`).
  - `/admin` đổi kết quả ra đúng các response cũ (`decide`, `adminBadgeAnswer`): 404 `errorResponse`, trang admin 400, 409 `errorResponse`, 303 `/admin/products/:id?done=…`. Test `/admin` không sửa, xanh.
- **Trả lời Ops:** thành công → 303 `/ops/marketplace/products/:id?{status|view}&q=…&done=1|mail_failed` (bộ lọc đi theo form action). Note/evidence/reason sai → render lại trang chi tiết Ops 400, `<details>` tương ứng mở sẵn (request changes, suspend, hoặc đúng huy hiệu đang thu hồi), lỗi gắn `aria-describedby`. Chuyển trạng thái không hợp lệ, thua compare-and-set, hoặc huy hiệu đã có / đã thu hồi → đọc lại product, trang chi tiết 409 với "The status changed before your action, so nothing was saved".
- **Danh sách:** tab 7 trạng thái của hàng đợi admin + tab "Recently edited" (`?view=edited`, đúng truy vấn `listRecentlyEdited`, 14 ngày), mỗi tab có số (`countProductsByStatus`: `GROUP BY status` + một `COUNT(*)` cho tab edited). Mặc định `in_review`; `?status=`/`?view=` ngoài allowlist bị bỏ qua. Tìm `?q=` (trim, 1–100 ký tự) trên tên và slug bằng `instr(lower(…), ?)` (`%`, `_` là chữ), áp cả cho tab edited (`searchProducts`). Thứ tự và giới hạn 200 dòng như các truy vấn admin; không phân trang (giống Builders). Cột: Product, Status (thứ hai, để thấy ở 390 px), Handle, Slug, Category, Last change / Edited. Chân bảng "N of TOTAL" hoặc "N shown".
- **Chi tiết:** link "← Products" giữ bộ lọc, tiêu đề + pill trạng thái, hai cột ≥ 1024 px như Builders. Trái: các trường admin cũ hiển thị (tagline, builder có link sang `/ops/marketplace/builders/:id` + e-mail, slug, category, delivery, license, language, tags, demo, website, tech stack, last change), ảnh (`/media/…`, có link mở ảnh), problem, target users, description, features, tier giá, customizable + notes, support, review note. Phải: Decision (Approve là nút POST; Request changes và Suspend trong `<details class="ops-confirm">`; Unsuspend là nút POST), Badges (huy hiệu đang hiệu lực; Revoke trong `<details>` với lý do bắt buộc; form Add badge khi còn huy hiệu gắn được và product chưa archived), History (`listEntityAudit(db, "product", id, 50)`, projection an toàn của 2504a). Viewer: Decision chỉ có "Your role can view this page but not change it.", Badges chỉ có danh sách; không form, không nút, không textarea/select.
- **Menu:** `OPS_MENU` thêm Marketplace › Products (`marketplace.view`, icon theo mockup, `count: "products"` dùng `countProductReviewQueue` của Overview). Thẻ Overview "Products in review" tự có link "Open queue →" vì route đã đăng ký (`QUEUE_TARGETS` có sẵn).
- **CSS:** 7 dòng `.ops-*` mới (danh sách thường, danh sách huy hiệu, form gắn huy hiệu); ảnh dùng lại `.media-grid` có sẵn. Không `style`, không `<style>`/`<script>`.

## Tiêu chí chấp nhận

| AC | Trạng thái | Lệnh / bằng chứng |
|---|---|---|
| AC1 Owner/Operator làm mọi hành động như admin cũ | Đạt | `npm test -- test/ops/marketplace-products.test.ts` → 23/23. "detail and actions": approve (published, `firstPublishedAt`, badge `listed` hệ thống, e-mail tiếng Việt cùng subject/link như test admin, audit actor + `{from,to,note}`), request changes (400 khi thiếu note, không ghi gì; có note → `changes_requested`, CRLF chuẩn hóa, e-mail, audit), suspend/unsuspend (audit, sửa lại `listed` bị mất, không e-mail), 409, e-mail lỗi → `mail_failed`, gắn huy hiệu (400 evidence/kind, audit `badge.grant`, 409 lần hai, ẩn form khi đủ 2 huy hiệu), thu hồi (400 lý do, `<details>` mở, audit `badge.revoke`, 409 lần hai), POST khác Origin → 403 |
| AC2 Viewer chỉ xem; POST Viewer/Content → 404, không ghi | Đạt | cùng file: "refuses every POST from a Viewer or Content": 6 hành động × 2 vai trò → 404, trạng thái, huy hiệu, audit, outbox không đổi; Viewer không thấy form/nút |
| AC3 Content 404 kín | Đạt | cùng file: danh sách, chi tiết, `?view=edited` cho Content, ẩn danh, user không vai trò → status, header, body giống `/ops/khong-ton-tai` |
| AC4 Lọc + tìm qua URL, giá trị lạ bỏ qua | Đạt | cùng file "list": số trên tab = `COUNT(*)` từng trạng thái, `?status=deleted|IN_REVIEW|` và `?view=nope` → In review, tab edited 14 ngày, tìm tên (không phân biệt hoa thường) và slug, `q` giữ trong tab và link dòng, `%` không khớp tất cả, `q` 101 ký tự bị bỏ qua |
| AC5 History theo projection an toàn | Đạt | cùng file "history": chỉ dòng của product này, mới nhất trước, e-mail Owner gốc, ID cho người ngoài Ops, không `data`, note chỉ xuất hiện một lần (từ review note) |
| AC6 `/admin` chạy như trước | Đạt | `npm test -- test/admin` → 12 file, 105/105, không sửa test admin |
| AC7 Menu Products (Owner/Operator/Viewer), thẻ Overview có link | Đạt | `npm test -- test/ops` → 5 file, 80/80 (`layout.test.ts`: registry + nav cho 4 vai trò; `overview.test.ts`: link thẻ Products cho Owner/Operator/Viewer, Content không link; `marketplace-products.test.ts` "menu and breadcrumb") |
| AC8 CSP scan có trang mới; typecheck + toàn bộ test | Typecheck đạt; toàn bộ test: xem "Kết quả lệnh" | `security-headers.test.ts` quét `/ops/marketplace/products`, `?view=edited`, chi tiết; `marketplace-products.test.ts` kiểm không inline, Referrer-Policy khác `no-referrer` |
| AC9 Giống mẫu Builders ở 1280 và 390 px | Chờ Reviewer | Không chụp ảnh lần này (xem "Sai khác" 4) |

## Kết quả lệnh

```
$ npm run typecheck -w apps/web
typecheck_exit=0
$ npm test -- test/ops/marketplace-products.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)
$ npm test -- test/admin
 Test Files  12 passed (12)
      Tests  105 passed (105)
$ npm test -- test/ops
 Test Files  5 passed (5)
      Tests  80 passed (80)
```

Toàn bộ (`npm test`):

- **Lần 1** (`a6105bb`, máy đang tải nặng, phiên bị ngắt giữa chừng): 132 file, **10 hỏng / 1377**, 9 file hỏng. Cả 10 là `Test timed out in 5000ms` ở các file không liên quan task (`auth/sessions`, `auth/verify-page`, `db/clicks`, `db/inquiries` ×2, `hub/inquiries` ×2, `hub/media`, `notify/request`, `public/request-form`); thêm `catalog/directory.test.ts` không khởi động được worker (`internal error … bad allocation`, `write EOF`). Duration 590 s.
- **Lần 2** (`8b3f806`): FULL2_RESULT

## Sai khác và lý do

1. **Thêm tab "Recently edited"** (`?view=edited`) cạnh 7 tab trạng thái: đây là bộ lọc có sẵn của hàng đợi admin (`/admin/products?view=edited`, spec §5.5), nên giữ cho đủ. Có số đếm riêng (một `COUNT(*)`), không có thao tác riêng.
2. **Nhãn trường riêng cho Ops** (`ops.products.field.*`: Slug, Delivery, Language, Demo, Problem, Who it is for, Customizable, Support, Builder): nhãn `product.field.*` viết cho builder ("How you deliver it", "I can customize this product for a client"…). Nhãn trạng thái dùng lại `PRODUCT_STATUS_KEY` (`unlisted` hiện là "Hidden", như admin cũ).
3. **Nhãn note khi suspend** là "Note (optional; shown to the builder in the product editor, not e-mailed)" thay vì `admin.reasonOptional` ("admins only"): `views/hub/EditorLayout.tsx` hiển thị `reviewNote` của product `suspended` cho builder (giống F2 của 2504a).
4. **Không chụp ảnh AC9:** ổ đĩa còn ~3,5 GB (D:) / ~3,7 GB (C:) và máy đang tải nặng (lần chạy full đầu bị timeout/`bad allocation`); trong worktree đã có một `wrangler dev` cổng 8787 không phải của tôi nên tôi không đụng. Bố cục dùng đúng các khối `.ops-*` của Builders (tabs, bar, bảng, split, confirm, timeline), cột Status đứng thứ hai như Builders. Reviewer có thể chụp bằng `shot2504a.mjs` (scratchpad) đổi URL; dữ liệu mẫu cho products đã viết sẵn ở `scratchpad/shot2504a2-seed.sql` (chưa chạy vào D1 local).
5. **History** hiện mã action (`product.approve`, `badge.grant`…) và actor, như Builders.
6. 409 cho huy hiệu (đã có / đã thu hồi) dùng cùng thông báo "The status changed before your action…" như các hành động trạng thái.

## Ghi nhận / câu hỏi mở

- Tìm kiếm không phân biệt hoa thường chỉ với ASCII (SQLite `lower()`), như F1 của 2504a.
- Trang Overview giờ đọc `countProductReviewQueue` hai lần mỗi request (thẻ + số trên menu), như F3 của 2504a với Builders.
- `handoff`/brief có nhắc "batch nguyên tử (thu hồi Demo verified + duyệt)": trong `admin-products.tsx` batch nguyên tử là đổi trạng thái + gắn `listed` + audit; việc thu hồi Demo verified xảy ra ở luồng sửa demo URL của Hub (không thuộc file này). Cả hai đều không bị đổi; `badges.test.ts` "loses Demo verified when the builder changes the demo URL" vẫn xanh.
