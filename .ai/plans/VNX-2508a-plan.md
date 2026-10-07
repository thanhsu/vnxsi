# VNX-2508a — Merchants trong Ops (`/ops/monetization/merchants`) · Plan

- **Trạng thái:** APPROVED. Owner duyệt hướng ngày 2026-10-06 ("thêm tab merchants quản lý vào page OPS", "approve"); Reviewer duyệt chi tiết theo ủy quyền điều phối.
- **Roadmap:** EPIC 25 (Ops console), đợt O1. Đây là phần Merchants của **VNX-2508**, tách ra làm trước theo yêu cầu Owner.
- **Spec:** spec Ops `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md` §2 (nhóm Monetization, bảng legacy `/admin/merchants` → `/ops/monetization/merchants`), §3 (Monetization chỉ Owner), §7; phụ lục monetization §3.6.
- **ADR:** ADR-010 (Ops console), ADR-007 (partner, link kiếm tiền), ADR-004 (xếp hạng không bị tiền chi phối).
- **Phụ thuộc:** `main` `f155765` (đã có shell Ops, `requireOps`, `monetization.view`/`monetization.act`, nhóm menu `monetization`, Marketplace 2504a/a2/b).
- **Implementer / Reviewer:** subagent Claude (context mới) / Claude (phiên chính, review độc lập bằng subagent riêng).

## Vì sao làm bây giờ

ElevenLabs đã chạy thật trên `/tools/elevenlabs` (merchant `active`). Owner muốn quản lý merchant từ Ops thay vì `/admin`. Phần còn lại của VNX-2508 (chuyển hướng `/admin/*`, đổi link trong e-mail) phụ thuộc 2504c–2507, nên không làm chung được.

## Phạm vi

**Trong phạm vi**

- Các route sau, mỗi route qua `requireOps(capability)`. Người không có quyền nhận 404 kín. Route chỉ có tiếng Anh, không có tiền tố locale.

  | Route | Capability |
  |---|---|
  | `GET /ops/monetization/merchants` (danh sách + form tạo) | `monetization.view` |
  | `POST /ops/monetization/merchants` (tạo) | `monetization.act` |
  | `GET /ops/monetization/merchants/:id` (chi tiết) | `monetization.view` |
  | `POST /ops/monetization/merchants/:id` (sửa merchant) | `monetization.act` |
  | `POST /ops/monetization/merchants/:id/status` | `monetization.act` |
  | `POST /ops/monetization/merchants/:id/programs`, `…/programs/:programId` | `monetization.act` |
  | `POST /ops/monetization/merchants/:id/offers`, `…/offers/:offerId` | `monetization.act` |
  | `POST /ops/monetization/merchants/:id/default-offer` | `monetization.act` |

- Hai trang đặt trong `OpsLayout`:
  - **Danh sách:** bảng merchant (tên, slug, trạng thái, link chi tiết) và form tạo, giống `/admin/merchants`.
  - **Chi tiết:** form merchant, đổi trạng thái, chương trình, offer, offer mặc định, xem trước URL cuối, cảnh báo host dùng chung và offer bị hỏng do đổi host, giống `/admin/merchants/:id`. Thêm khối **History**: audit của entity `merchant` theo projection an toàn, giống trang chi tiết Builders/Products trong Ops.
- Menu: thêm mục **Monetization › Merchants** (`monetization.view`, icon mới `merchants`, khóa `ops.nav.merchants` chỉ ở `en.ts`). Mục chỉ hiện với Owner, theo `can()`.
- `/admin/merchants*` **giữ nguyên** response và hành vi.

**Ngoài phạm vi**

- Chuyển hướng `/admin/merchants` → Ops và gỡ route admin (phần còn lại của VNX-2508).
- Feature flags trong Ops (`/ops/settings/feature-flags`): ghi vào "Ghi nhận". Owner chỉ yêu cầu Merchants.
- Đổi nghiệp vụ merchant, chương trình, offer, luật URL, audit, migration.
- Logo merchant, conversion, `/admin/revenue`.

## Thiết kế

**Không nhân đôi logic.** Mọi thao tác ghi đi qua đúng các hàm có sẵn: `createMerchant`, `updateMerchant`, `setMerchantStatus`, `createProgram`, `updateProgram`, `createOffer`, `updateOffer`, `setDefaultOffer`, cùng các luật domain `parseMerchantForm`, `hostsChanged`, `offersBrokenByHosts`, `merchantTransitionAllowed`, `programTransitionAllowed`, `offerTransitionAllowed`, `offerPreview`. Audit, compare-and-set và guard `write_id` giữ nguyên.

1. **Route.** Tách phần thân các handler trong `src/routes/admin-merchants.tsx` thành các hàm dùng chung, nhận một "bề mặt" gồm: đường dẫn gốc của trang, hàm render danh sách, hàm render chi tiết, và hàm dựng URL quay về sau khi lưu. Theo cách VNX-2504 đã tách `decideProduct` và `inviteToRequest`: kết quả có kiểu, caller tự render.
   - `/admin` dùng `onLocalized` + `requireAdmin` + `localizedPath`.
   - Ops dùng `app.get`/`app.post` + `requireOps`, đặt trong file mới `src/routes/ops-monetization.tsx`, đăng ký trong `app.ts` cạnh `registerOpsMarketplaceRoutes` (trước catch-all `/ops`).
   - Mọi lỗi 400, 404, 409 của Ops render trong `OpsLayout`, hoặc dùng `opsNotFound` cho 404, theo đúng cách `ops-marketplace.tsx` đang làm. Không render trang lỗi của site công khai trong Ops.
   - Sau khi lưu: 303 về `/ops/monetization/merchants/:id?done=1`.
2. **View.** Tách phần thân của `MerchantsPage`, `MerchantDetailPage` và `OfferSection` (các form, bảng, cảnh báo) ra khỏi `AdminLayout`. Phần thân nhận hàm `href(path)`, nên `action` của form và link trỏ đúng `/admin/...` có locale, hoặc `/ops/monetization/merchants/...`.
   - `views/admin/*` bọc phần thân bằng `AdminLayout`. HTML của `/admin` phải giữ nguyên.
   - `views/ops/MerchantsPages.tsx` bọc bằng `OpsLayout` (trail: Monetization › Merchants › tên), locale `en`.
   - Nếu tách phần thân làm diff vượt ngưỡng ở mục "Rủi ro", Implementer dừng và báo, không tự viết lại view.
3. **Menu và icon:**
   - `src/ops/menu.ts`: thêm mục và kiểu `OpsIcon` `merchants`.
   - `OpsLayout.tsx`: thêm path SVG cho icon. Nét `stroke`, cùng kiểu các icon có sẵn, không inline style.
4. **CSS:** tái dùng `.ops-*`. Nếu thiếu thì bổ sung trong `public/assets/app.css`. Không có `style=` hay script inline (CSP VNX-0803).
5. **Test:**
   - File mới `test/ops/monetization-merchants.test.ts`.
   - Ma trận quyền 4 vai trò (owner, operator, content, viewer) cùng người không có vai trò, cho mọi GET và POST.
   - Luồng tạo, sửa, đổi trạng thái, chương trình, offer, offer mặc định, kiểm cả bảng và `audit_log`.
   - Thêm trang Ops mới vào CSP scan.
   - Thêm assertion menu vào `test/ops/layout.test.ts`.

## Tiêu chí chấp nhận → cách kiểm

Mọi lệnh chạy trong `apps/web` của worktree `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`.

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Owner tạo, sửa, đổi trạng thái merchant, tạo/sửa chương trình và offer, đặt/bỏ offer mặc định qua `/ops/monetization/merchants*`. Bảng và `audit_log` giống hệt khi làm qua `/admin` (cùng action, entity, guard). | `npx vitest run test/ops/monetization-merchants.test.ts` |
| AC2 | Operator, Content, Viewer và người không có vai trò: mọi GET và POST nhận 404 kín (`no-store`, `X-Robots-Tag`), không ghi gì vào `merchants`, `partner_programs`, `offers`, `audit_log`. | cùng file |
| AC3 | Lỗi form (400) render lại trong `OpsLayout` với giá trị đã nhập. Offer hỏng do đổi host bị chặn như admin. Chuyển trạng thái sai trả 409. Id lạ trả 404 kín. | cùng file |
| AC4 | Trang chi tiết có History (audit `merchant` theo projection an toàn, không render `data`). Lỗi đọc audit hiện trạng thái lỗi, không hiện danh sách rỗng. | cùng file |
| AC5 | Menu Monetization › Merchants chỉ hiện với Owner. Vai trò khác không thấy nhóm Monetization. | `npx vitest run test/ops/layout.test.ts` |
| AC6 | `/admin/merchants*` chạy y như trước. | `npx vitest run test/admin/merchants.test.ts test/admin/merchant-offers.test.ts` |
| AC7 | CSP scan có hai trang Ops mới. Test kiến trúc xanh (không có tên partner trong `src`, bảng `MONEY_ALLOWED` ghim đúng; nếu thêm file mới đọc bảng tiền thì cập nhật bảng ghim và ghi lý do). | `npx vitest run test/http/security-headers.test.ts test/architecture.test.ts` |
| AC8 | Typecheck sạch, toàn bộ test xanh. | `npm run typecheck -w apps/web`; `npm test` (hoặc chạy theo thư mục, xem handoff) |
| AC9 | Giao diện khớp các trang Ops có sẵn ở 1280 px và 390 px. | Reviewer xem |

## Rủi ro

- **Xung đột với `feat/ops-o1`:** 2504c đang dở trên nhánh đó, sửa `ops/menu.ts`, `OpsLayout.tsx`, `en.ts`, `app.css`, `app.ts`. Giữ thay đổi ở các file dùng chung thật nhỏ, chỉ thêm dòng. Ai merge sau thì gộp; ghi vào `CURRENT-STATUS.md`.
- **Diff lớn:** ba view admin có tổng khoảng 670 dòng. Ngưỡng là ~600 dòng diff, không tính test và locale. Vượt ngưỡng thì Implementer dừng và báo trước khi làm tiếp.

## Câu hỏi mở

Không có.
