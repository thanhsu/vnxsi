# Non-functional Requirements

Trạng thái: **PROPOSED**, chờ Owner ký. Mỗi dòng có giá trị, điểm đo và ngưỡng cảnh báo. Khi chưa ký, plan coi giá trị đề xuất là mục tiêu và ghi sai lệch vào báo cáo; không tự hạ.

## Hiệu năng

| Hạng mục | Mục tiêu | Điểm đo | Cửa sổ | Cảnh báo |
|---|---|---|---|---|
| TTFB trang SSR công khai | p95 ≤ 400 ms | Workers Analytics, `wall time` | 24 giờ | p95 > 800 ms trong 1 giờ |
| Số truy vấn D1 mỗi request trang | ≤ 8 | test tích hợp đếm `prepare` | mỗi PR | > 8 làm test fail |
| Trang công khai, trọng lượng JS | ≤ 30 KB nén (homepage ≤ 60 KB) | build artifact | mỗi PR | vượt → review chặn |
| LCP homepage trên 4G giả lập | ≤ 2,5 s | Lighthouse CI (M8) | mỗi release | > 3 s |
| Cron hằng giờ | xong ≤ 30 s | log job | mỗi lần chạy | > 60 s |

## Sẵn sàng và phục hồi

| Hạng mục | Mục tiêu |
|---|---|
| Availability trang công khai | 99,9%/tháng (phụ thuộc Cloudflare) |
| RPO dữ liệu D1 | ≤ 24 giờ (D1 Time Travel 30 ngày) |
| RTO | ≤ 1 giờ: rollback Worker bằng `wrangler rollback`, khôi phục D1 bằng Time Travel |
| Email đăng nhập | 99% tới hộp thư trong 60 s (Resend dashboard) |

## Bảo mật

- Mọi request đổi dữ liệu qua origin check; cookie `__Host-`; token/session chỉ lưu hash.
- Rate limit: đăng nhập 5/giờ/email, 20/giờ/IP; Inquiry 10/giờ/IP; request 3/ngày/email.
- Không bí mật trong repo; gitleaks trong CI; dependency-review chặn từ mức moderate.
- Upload: kiểm magic bytes, ≤ 2 MB, chỉ JPEG/PNG/WebP.
- Review bảo mật toàn nhánh trước mỗi lần deploy production lớn (VNX-0803).

## Riêng tư

- Builder không thấy email client. Request không có trang công khai.
- Số liệu công khai gộp nhóm < 3 vào "Other".
- Đếm lượt xem bằng cookie ngẫu nhiên, không gắn danh tính, không đếm bot/chủ product/admin.
- Không gửi PII vào model AI (Wave 2).

## Khả năng tiếp cận

- WCAG 2.2 AA cho mọi trang công khai và form.
- Vùng chạm ≥ 44 px; tương phản chữ ≥ 4,5:1; focus nhìn thấy; form có label.
- Tôn trọng `prefers-reduced-motion`.
- Kiểm tự động bằng axe trong Playwright (VNX-0802).

## i18n

- 4 locale, parity key bắt buộc (test).
- `hreflang` và canonical trên mọi trang công khai.
- Bản `zh-*` cần người bản xứ đọc trước khi quảng bá.

## Chi phí

| Hạng mục | Trần Wave 1 |
|---|---|
| Cloudflare (Workers, D1, R2) | gói Free/Paid $5/tháng |
| Resend | gói free (3.000 email/tháng); vượt → nâng gói |
| AI (Wave 2) | `AI_MONTHLY_BUDGET_USD`, Owner đặt khi duyệt ADR-005 |
