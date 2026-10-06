# VNX-2508a — Báo cáo Implementer

- **Nhánh / worktree:** `feat/vnx-2105-2508a`, `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`. Không push, không merge, không chạm production.
- **Commit (sau VNX-2105 `b69c6b3`):**
  - `cc0c089` test: VNX-2508a Merchants under /ops/monetization (red)
  - `4d89c98` refactor(web): share merchant actions and view bodies between /admin and /ops
  - `39e1f96` feat(web): Merchants in Ops under /ops/monetization/merchants
  - commit báo cáo này: `docs: VNX-2508a report`

## Đã làm

- **Tách dùng chung (refactor):** `routes/admin-merchants.tsx` giờ export các action (`createMerchantAction`, `updateMerchantAction`, `setMerchantStatusAction`, `createProgramAction`, `updateProgramAction`, `createOfferAction`, `updateOfferAction`, `setDefaultOfferAction`) nhận một `MerchantSurface` (`list`, `detail`, `notFound`, `conflict`, `badRequest`, `done`). Luật, ghi db, audit giữ nguyên một chỗ. `/admin` dùng `adminSurface` (AdminLayout, `errorResponse`, `c.text("Bad request", 400)`, redirect có locale). Thêm các hàm đọc dùng chung `loadMerchantDetail`, `loadMerchants`, `merchantOfRequest`.
- **View:** `MerchantsPage`, `MerchantDetailPage`, `OfferSection` tách phần thân (`MerchantsBody`, `MerchantDetailBody`) nhận hàm `link(sub)` thay cho đường dẫn `/admin/...` cố định; trang admin bọc thân bằng `AdminLayout`. `views/ops/MerchantsPages.tsx` bọc cùng thân bằng `OpsLayout` (locale `en`), thêm History (`parts.tsx`) và thông báo 409 / 400.
- **Route Ops:** `routes/ops-monetization.tsx` (đăng ký trong `app.ts` ngay sau `registerOpsMarketplaceRoutes`, trước catch-all). GET dùng `monetization.view`, mọi POST dùng `monetization.act`. Id lạ, chương trình/offer của merchant khác: `opsNotFound`. 409: dựng lại trang chi tiết với trạng thái hiện tại (`ops.notice.conflict`). Thành công: 303 về `/ops/monetization/merchants/:id?done=1`.
- **Menu:** mục Monetization › Merchants (`ops.nav.merchants`, icon `merchants`, `monetization.view`); path SVG cho icon trong `OpsLayout.tsx`.
- **Khóa `ops.*` mới (chỉ `en.ts`):** `ops.nav.merchants`, `ops.merchants.noHistory`, `ops.merchants.badRequest`.
- **CSS:** khối `.ops-legacy` / `.ops-legacy-after` ở cuối `app.css` (7 dòng, chỉ thêm).
- `historyOf` trong `ops-marketplace.tsx` đổi từ `async function` sang `export async function` (1 từ), để dùng lại.

## Tệp thay đổi

Mới: `src/routes/ops-monetization.tsx`, `src/views/ops/MerchantsPages.tsx`, `test/ops/monetization-merchants.test.ts`.
Sửa: `src/routes/admin-merchants.tsx`, `src/routes/ops-marketplace.tsx` (+`export`), `src/app.ts` (+2 dòng), `src/ops/menu.ts` (+1 mục, +1 kiểu icon), `src/views/ops/OpsLayout.tsx` (+1 dòng), `src/views/admin/{MerchantsPage,MerchantDetailPage,OfferSection}.tsx`, `src/i18n/messages/en.ts` (+3 dòng), `public/assets/app.css` (+7 dòng), `test/ops/layout.test.ts`, `test/http/security-headers.test.ts`.

**Kích thước diff (không tính test, locale):** 343 dòng thêm, 137 dòng xóa (khoảng 480 dòng đổi), dưới ngưỡng 600.

## Tiêu chí chấp nhận

Chạy trong `apps/web` của worktree.

| # | Lệnh | Kết quả thực tế |
|---|---|---|
| AC1 | `npx vitest run test/ops/monetization-merchants.test.ts` | 1 file, 21 test xanh. Gồm test so sánh cùng một chuỗi thao tác qua `/admin` và `/ops`: cùng bảng, cùng `audit_log` (action, entity, actor). |
| AC2 | cùng file | xanh. Operator, Content, Viewer, người không vai trò, ẩn danh: mọi GET và POST của 8 route trả đúng thân và header của 404 `/ops` lạ (so byte), snapshot số dòng `merchants`, `partner_programs`, `offers`, `audit_log` không đổi. Owner với id lạ: 404 kín trên mọi route. POST chéo site 403, body > 64 KB 413. |
| AC3 | cùng file | xanh. 400 trong OpsLayout kèm giá trị đã nhập (slug trùng/sai, host sai, tên rỗng); đổi host làm hỏng offer bị chặn (`data-broken`, không ghi); 409 trong OpsLayout cho `expectedStatus` cũ và chuyển trạng thái sai (archived là cuối); program/offer/offer mặc định của merchant khác: 404 kín, offer với program lạ: 400. |
| AC4 | cùng file | xanh. History lấy audit `merchant` theo projection an toàn (không in `data`); lỗi đọc audit (DB proxy ném lỗi) hiện "Could not read the history.", không hiện danh sách rỗng; không có audit hiện "No audit entries for this merchant yet.". |
| AC5 | `npx vitest run test/ops/layout.test.ts` | 12 test xanh. Chỉ Owner thấy nhóm Monetization › Merchants; Operator, Content, Viewer không thấy tiêu đề nhóm; nav và danh sách link khớp. Registry menu có mục mới. |
| AC6 | `npx vitest run test/admin/merchants.test.ts test/admin/merchant-offers.test.ts` | 2 file, 34 test xanh. Ngoài ra, trước khi commit refactor tôi băm SHA-256 HTML của 6 phản hồi `/admin` (list, detail, `/vi` `?done=1`, `/zh-hans`, 400 form, 400 status, 409) trước và sau: các giá trị băm khớp nhau (script tạm, đã xóa, không commit). |
| AC7 | `npx vitest run test/http/security-headers.test.ts test/architecture.test.ts` | 2 file, 18 test xanh. CSP scan thêm `/ops/monetization/merchants` và `/ops/monetization/merchants/:id`. |
| AC8 | `npm run typecheck -w apps/web`; `npm test` | typecheck 0 lỗi. `npm test` một lượt: 136 file, 1442 test xanh, 113.9 s. Không gặp hết bộ nhớ hay timeout ngẫu nhiên. |
| AC9 | Reviewer xem | Chưa kiểm bằng mắt (không mở `wrangler dev`). Xem mục sai khác. |

## Bảng `MONEY_ALLOWED`

**Không đổi.** `routes/ops-monetization.tsx` và `views/ops/MerchantsPages.tsx` không import `db/merchants|programs|offers`: mọi đọc/ghi đi qua các hàm export từ `routes/admin-merchants.tsx` (đã nằm trong bảng ghim), kể cả kiểu `Merchant` (re-export). Vì vậy không thêm file nào vào bảng.

## Sai khác và ghi chú

1. **Commit red `cc0c089` không qua typecheck** (test `layout.test.ts` dùng biến `merchants` chưa khai báo do sửa lệch CRLF). Đã sửa trong commit `39e1f96`, cùng với assertion registry menu mới. Chạy red lúc đó: 17 test fail, đúng kỳ vọng.
2. **AC9 chưa được kiểm trực quan.** Thân form dùng lớp site (`.card`, `.field`, `.btn`, `table.data`) trong `.ops-page`, thêm khung `.ops-legacy` max-width 880 px và định dạng h1/h2. Chưa chụp ở 1280 và 390 px; Reviewer cần xem, có thể cần chỉnh CSS.
3. **Với Ops, `badRequest` (đổi trạng thái thiếu xác nhận archive, `to` lạ, `expectedStatus` lạ)** hiển thị lại trang chi tiết trong OpsLayout, mã 400, kèm `ops.merchants.badRequest`, thay vì chuỗi `Bad request` trần như `/admin`. Đúng yêu cầu plan "lỗi 400 render trong OpsLayout".
4. Thông báo thành công dùng "Saved." của thân dùng chung (`partner.saved`), không dùng `Notice` của Ops.
5. File làm việc ở worktree: `.ai/reviews/VNX-2105-review.md` chưa theo dõi là của Reviewer, tôi không đụng và không commit.
6. Máy hiển thị cảnh báo LF/CRLF khi `git add` (autocrlf); nội dung commit chuẩn hóa, không ảnh hưởng.

## Ngoài phạm vi, để ghi vào "Ghi nhận"

- Feature flags trong Ops (`/ops/settings/feature-flags`) chưa có, đúng như plan.
- `/admin/merchants*` vẫn chạy song song, chưa chuyển hướng (phần còn lại của VNX-2508).
- Nhánh `feat/ops-o1` cũng sửa `ops/menu.ts`, `OpsLayout.tsx`, `en.ts`, `app.css`, `app.ts`; các thay đổi của tôi ở những file này chỉ thêm dòng (menu: 1 mục + 1 kiểu icon trong union, nên có thể xung đột nhỏ khi gộp).
