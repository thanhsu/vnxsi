# ADR-002: Magic link + session cookie; client = user

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-03
- **Người quyết định:** Owner, Claude (Reviewer)

## Quyết định

Đăng nhập chỉ bằng magic link gửi qua email (token 32 byte, sống 15 phút, dùng một lần, DB lưu SHA-256). Session là cookie `__Host-vnx_session` sống 30 ngày, DB lưu hash. Mọi người dùng là một `users`; builder là bản ghi `builders` gắn với user; admin xác định qua `ADMIN_EMAILS`.

## Bối cảnh

Client non-tech cần gửi Inquiry mà không phải tạo mật khẩu. Builder cần tài khoản để tự sửa product.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Mật khẩu | Phải làm quên mật khẩu, băm, chính sách; tăng rủi ro |
| OAuth (Google/GitHub) | Thêm phụ thuộc bên thứ ba; một phần client Việt/Trung không dùng các nhà cung cấp này |
| Cloudflare Access | Dành cho nhân viên nội bộ, không hợp với người dùng công khai |

## Hệ quả

- Tích cực: một luồng cho cả client và builder; tài khoản ngầm cho client.
- Chấp nhận: phụ thuộc vào email đến được hộp thư (cần DKIM/SPF đúng).

## Được bảo đảm bởi

`apps/web/test/auth/*.test.ts` (token hết hạn, dùng lại, cookie flags, admin bootstrap).
