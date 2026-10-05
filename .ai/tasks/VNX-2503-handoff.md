# VNX-2503 — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2503 và mục "Overview (O1)".
- **Spec:** spec Ops §2 (menu), §7 (quality bar UI). **Mockup đã duyệt:** `docs/design/mockups/ops/OpsOverview.dc.html`, `docs/design/mockups/ops/OpsOverviewMobile.dc.html` (đọc để lấy bố cục và giá trị; code thật bằng Hono JSX + CSS, không chép cú pháp `.dc.html`).
- **Review trước:** `.ai/reviews/VNX-2502-review.md` (F1 thuộc task này).
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2503-report.md`
- **Nhánh:** `feat/ops-o1` (HEAD có VNX-2501, VNX-2502). Không push, không merge.

## Mục tiêu

Khung Ops dùng chung cho mọi trang `/ops/*` (thanh bên theo vai trò, thanh trên) và trang `/ops` Overview gồm 5 hàng chờ + hoạt động gần đây, đúng mockup, không style/script nội tuyến.

## Phạm vi đã duyệt

1. **i18n (F1 review VNX-2502):** khóa `ops.*` chỉ ở `en.ts`. Đổi kiểu để file vi/zh-hans/zh-hant **không** phải (và không được) có khóa `` `ops.${string}` ``: ví dụ `Messages = Record<Exclude<MessageKey, `ops.${string}`>, string>` cho các file không phải EN; `t()` với khóa `ops.*` luôn đọc từ `en`. Trang Ops gọi `t("en", …)`.
2. **Registry menu** (`src/ops/menu.ts`, thuần): danh sách mục (nhóm, nhãn khóa i18n, đường dẫn, capability). Thanh bên chỉ render mục mà (a) route đã được đăng ký và (b) `can(role, capability)`. Ở task này chỉ có **Overview**; các task sau tự thêm mục của mình. Nhóm không còn mục nào thì không render heading.
3. **`OpsLayout`** (`src/views/ops/OpsLayout.tsx`): `<html lang="en">`, `meta robots noindex,nofollow`, title `"{page} · VNX.SI Ops"`, không link hreflang/canonical, không header/footer công khai. Thanh bên 240 px (logo B + nhãn OPS, các nhóm), thanh trên (đường dẫn trang, nhãn môi trường, vai trò, email người đang đăng nhập, form POST `/logout`). Nhãn môi trường: `PRODUCTION` khi host của `APP_ORIGIN` là `vnx.si`, ngược lại `LOCAL` (không đoán thêm môi trường khác). Dưới 1024 px thanh bên thu vào một nút menu `<details>` (không JS). Skip link tới nội dung chính.
4. **CSS** (`public/assets/app.css`, tiền tố `.ops-*`): theo mockup và token VNX hiện có (màu, font tự host, radius, spacing); trạng thái hover/focus-visible; vùng chạm ≥ 44 px trên mobile; dark mode qua token có sẵn (đọc được, không cần tinh chỉnh). **Không** thuộc tính `style` trong HTML, không `<style>`/`<script>` nội tuyến.
5. **`/ops` Overview** (`src/routes/ops.tsx`, `src/views/ops/OverviewPage.tsx`), capability `overview.view`:
   - 5 hàng chờ, mỗi hàng: nhãn, số, tuổi việc chờ lâu nhất (khi > 0), link tới hàng đợi (link chỉ khi route đích đã có; ở task này chưa có → không link, không link chết):
     1. Builder chờ duyệt: `builders.status = 'pending'`.
     2. Product đang review: `products.status = 'in_review'`.
     3. Feedback mới: `feedback.status = 'new'`, kèm "N e-mail not sent yet" khi `notified_at IS NULL`.
     4. Request chờ ghép: `requests.status = 'submitted'`.
     5. Inquiry quá hạn: Inquiry `open` chưa có trả lời của builder quá `REMIND_AFTER_MS` (dùng đúng luật/hàm M5 đang dùng cho cron nhắc; không tự đặt mốc mới).
   - Số = 0 hiển thị "Nothing waiting" (không chỉ số 0). Truy vấn lỗi → hàng đó hiện trạng thái lỗi, **không** hiện 0.
   - Dòng "Counts read at HH:MM UTC".
   - **Content** (`overview.detail` = false): chỉ số và nhãn; không tuổi, không link, không hoạt động gần đây.
   - **Recent activity** (khi có `overview.detail`): 10 dòng audit mới nhất, projection an toàn: thời điểm, actor, action, entity, entity ID. Actor hiển thị **email chỉ khi** actor là Owner gốc hoặc thành viên Ops; người khác hiển thị ID; actor null → `system`. Không render `audit_log.data`. Không link tới chi tiết ở task này.
   - Truy vấn đếm đặt trong module sở hữu bảng (đọc được phép join; không ghi). Mỗi hàng một truy vấn `COUNT(*)` + `MIN(...)`; gom bằng `db.batch` nếu tiện.
6. **Đăng ký route** trong `src/app.ts` trước route bắt cuối `/ops` của VNX-2502; mọi route Ops dùng `requireOps(...)`.

## Ngoài phạm vi (không làm)

Thước đo, chart, sức khỏe hệ thống (O2); trang Marketplace/People/Team/Audit; chuyển hướng `/admin`; đổi luồng đăng nhập.

## Ràng buộc

- CSP VNX-0803: không style/script nội tuyến (test quét trang của VNX-0803 phải xanh với `/ops`).
- Không `Referrer-Policy: no-referrer` trên trang có form POST.
- Thứ tự middleware hiện có không đổi.

## Đọc trước

`CLAUDE.md`; plan O1; spec §2, §7; ADR-010; 2 mockup; `.ai/reviews/VNX-2502-review.md`; `src/auth/ops.ts`, `src/domain/ops.ts`, `src/db/ops-members.ts`, `src/views/Layout.tsx`, `src/views/LandingPage.tsx` (logo, token), `public/assets/app.css`, `src/i18n/messages/en.ts`, `src/i18n/t.ts`, `src/domain/inquiry.ts` + `src/jobs/daily.ts` (luật Inquiry quá hạn), `src/db/audit.ts`, test CSP của VNX-0803.

## File dự kiến bị ảnh hưởng

Mới: `src/ops/menu.ts`, `src/routes/ops.tsx`, `src/views/ops/OpsLayout.tsx`, `src/views/ops/OverviewPage.tsx`, `test/ops/layout.test.ts`, `test/ops/overview.test.ts`. Sửa: `src/app.ts`, `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (chỉ kiểu và khóa `ops.*` ở EN), `src/i18n/t.ts`, `public/assets/app.css`, các `src/db/*.ts` sở hữu bảng cần đếm (chỉ thêm hàm đọc), `test/i18n/parity.test.ts` nếu cần.

## Tiêu chí chấp nhận

- [ ] AC1: `ops.*` chỉ ở `en.ts`, typecheck không đòi vi/zh có `ops.*` — `npm run typecheck -w apps/web`; `npm test -- test/i18n/parity.test.ts`
- [ ] AC2: Thanh bên chỉ có mục có route + quyền (Owner/Operator/Viewer thấy Overview; không link chết) — `npm test -- test/ops/layout.test.ts`
- [ ] AC3: `/ops` cho 4 vai trò: 200; chưa đăng nhập / không vai trò → 404 kín (VNX-2502) — `test/ops/overview.test.ts`
- [ ] AC4: 5 hàng chờ đếm đúng với dữ liệu tạo trong test; 0 → "Nothing waiting"; lỗi truy vấn → trạng thái lỗi, không số 0 — `test/ops/overview.test.ts`
- [ ] AC5: Content chỉ thấy số và nhãn (không tuổi, link, hoạt động gần đây) — `test/ops/overview.test.ts`
- [ ] AC6: Recent activity: projection an toàn, email chỉ cho actor là Owner gốc/thành viên Ops, không render `data` — `test/ops/overview.test.ts`
- [ ] AC7: HTML `/ops` không có thuộc tính `style`, `<style>`, `<script>` nội tuyến; có `noindex` meta; `lang="en"` — `test/ops/layout.test.ts` + test CSP hiện có
- [ ] AC8: toàn bộ test + typecheck xanh (timeout ngẫu nhiên do máy tải: chạy riêng file lỗi, ghi kết quả) — `npm test`, `npm run typecheck -w apps/web`
- [ ] AC9: giống mockup ở 1280/1440 và 390 px — Reviewer xem

## Cấm

Không sửa ngoài danh sách (ghi lý do nếu bắt buộc); không dependency mới; TDD (commit test trước); Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
