# ADR-001: Hono JSX SSR trên một Cloudflare Worker, D1, R2, Resend

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-03
- **Người quyết định:** Owner, Claude (Reviewer)

## Quyết định

Toàn bộ Wave 1 chạy trong Worker `vnxsi-web`: Hono render JSX phía server, dữ liệu ở D1, ảnh ở R2, email gửi qua Resend, JS phía client ở mức tối thiểu.

## Bối cảnh

Wave 1 chủ yếu là CRUD, form, SSR cho SEO và một ít tương tác. Worker, D1 và domain vnx.si đã chạy production.

## Động lực

- Chi phí gần như bằng 0 ở quy mô Wave 1.
- SEO cần HTML render phía server cho 4 locale.
- Một người vận hành: càng ít thành phần càng tốt.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Next.js qua OpenNext | Nặng, build phức tạp, nhiều chỗ vướng trên Workers; không cần React phía client |
| Astro SSR | Hợp nội dung tĩnh, nhưng phần form và auth vẫn phải tự làm; thêm một framework |
| Backend riêng (Node/Java) + Postgres | Thêm server phải vận hành; không cần ở quy mô này |

## Hệ quả

- Tích cực: một lệnh deploy; test chạy trong workerd giống production.
- Chấp nhận: editor phức tạp phải tự viết với JS nhỏ; D1 có giới hạn kích thước và tốc độ ghi (đủ cho Wave 1).

## Được bảo đảm bởi

`apps/web/wrangler.jsonc`; test kiến trúc `apps/web/test/architecture.test.ts` (không import `hono` hay `db` từ `domain/`).
