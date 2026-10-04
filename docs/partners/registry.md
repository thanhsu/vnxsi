# Sổ partner

Danh sách chương trình affiliate / partner mà Owner đã đăng ký. Đây là nguồn dữ liệu tạm cho tới khi có các bảng `merchants`, `partner_programs`, `offers` (EPIC 21, phụ lục monetization mục 3). Khi làm EPIC 21, mỗi mục ở đây được nạp thành một merchant + một chương trình + các offer.

Luật (ADR-007):
- Chỉ ghi điều khoản đã đọc từ trang điều khoản hoặc hợp đồng thật. Không biết thì để trống, **không đoán**.
- Chương trình chỉ chuyển `active` khi có `terms_url` và `terms_verified_at`.
- Link affiliate chưa được đặt lên trang nào cho tới khi có `/go/o/:offerId`, disclosure và `rel="sponsored"` (EPIC 21).
- Link chứa mã giới thiệu không phải bí mật. Mật khẩu, API key của tài khoản partner không bao giờ ghi ở đây.

## ElevenLabs

| Trường | Giá trị |
|---|---|
| Merchant | ElevenLabs |
| Website | https://elevenlabs.io |
| Host đích hợp lệ (`allowed_hosts`) | `try.elevenlabs.io`, `elevenlabs.io` |
| Loại chương trình | `affiliate` |
| Mạng | PartnerStack (Owner, 2026-10-04) |
| Link affiliate | https://try.elevenlabs.io/7fnly5cv33k3 |
| Tham số sub-id cho `{click_id}` | — (chưa biết; xem tài liệu chương trình) |
| Mô hình hoa hồng | — |
| Tỷ lệ / mức | — |
| Tiền tệ | — |
| Thời hạn cookie | — |
| Trang điều khoản (`terms_url`) | — |
| Ngày Owner kiểm điều khoản (`terms_verified_at`) | — |
| Bên nhận hoa hồng | Owner, cá nhân (quyết định Q4, 2026-10-04) |
| Trạng thái | `draft` |
| Ngày thêm | 2026-10-04 |
| Trang trên VNX.SI | `/tools/elevenlabs`, nút **Try ElevenLabs** → `/go/elevenlabs` (offer mặc định) |
| Ghi chú | Lát mỏng EPIC 21 (phụ lục mục 3.8). Sau này: bài guide/so sánh công cụ giọng nói AI ở EPIC 22 |
