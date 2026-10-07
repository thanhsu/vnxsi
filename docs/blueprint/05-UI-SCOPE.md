# UI Scope

Prototype tham chiếu: https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm (riêng tư; dữ liệu mẫu). Prototype là hướng thiết kế, spec mới là yêu cầu.

## Hệ thiết kế

- Nền `#F4F5F7`, chữ `#0D1526`, nhấn `#1D4ED8`; huy hiệu: Listed xám, Demo verified xanh dương, In production xanh lá.
- Font: Space Grotesk (tiêu đề), Be Vietnam Pro (nội dung), JetBrains Mono (nhãn, số), Noto Sans SC/TC (tiếng Trung).
- Chart: chuỗi `#2a78d6` (request) và `#eb6834` (product), đã qua validator CVD; chữ luôn dùng màu chữ.
- Dark mode qua token CSS (`public/assets/app.css`).

## Màn hình Wave 1

| Màn hình | Route | Epic | Artboard prototype | Đối tượng |
|---|---|---|---|---|
| Homepage | `/` | E7 | Homepage | công khai |
| Catalogue | `/products` | E4 | Catalogue | công khai |
| Product detail + form Inquiry | `/p/:slug` | E3, E5 | Product detail + Inquiry | công khai |
| Builder profile | `/b/:handle` | E2 | Builder profile | công khai |
| Danh bạ builder | `/builders` | E4 | Find builders | công khai |
| Post a request | `/request` | E6 | Post a request | công khai |
| Bảng request công khai | `/requests` (+ tiền tố locale, ví dụ `/vi/requests`) | E27 | (chưa có artboard) | công khai |
| Chi tiết request công khai + nút interest | `/requests/:publicId` (+ tiền tố locale) | E27 | (chưa có artboard) | công khai; interest: builder |
| Trang cho builder | `/for-builders` | E7 | (khối builder trên Homepage) | công khai |
| Đăng nhập | `/login` | E1 | — | công khai |
| Builder Hub: tổng quan, products, inquiries, invitations (kèm mục "Requests you're interested in"), hồ sơ | `/hub/*` | E2, E3, E5, E6, E27 | Builder Hub | builder |
| Product editor 9 bước | `/hub/products/:id/edit` | E3 | Product editor | builder |
| Client: request và đề xuất; opt-in và gỡ khỏi bảng công khai | `/me`, `/me/requests/:id` | E5, E6, E27 | Client: proposals | user |
| Ops: khối "Public listing" và "Interested builders" ở chi tiết request; thẻ Overview | `/ops`, `/ops/marketplace/requests/:id` | E25, E27 | (xem spec Ops console §2) | Owner, Operator |
| Admin: request, product, builder, mới sửa, inquiry, invite, thước đo | `/admin/*` | E2–E7 | Admin review | admin |
| Lỗi 403 / 404 / 500 | — | E1 | — | mọi người |
| Terms, Privacy | `/terms`, `/privacy` | E7 | — | công khai |

Mọi route công khai có 4 bản theo tiền tố locale (ADR-003).

## Màn hình Wave 2–3 (dự kiến)

| Màn hình | Epic |
|---|---|
| "Describe your idea" + 3 phương án | E10 |
| Gợi ý AI trong hàng chờ request (shadow) | E11 |
| Trợ lý viết listing trong editor | E12 |
| Checkout, order, license delivery | E16 |
| Project workspace: milestone, trạng thái rút gọn cho client | E15 |
| Review và hồ sơ uy tín | E17 |
