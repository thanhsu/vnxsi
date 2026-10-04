# M5 (VNX-0501 … VNX-0506) — Review

- **Reviewer:** Claude (điều phối) + reviewer độc lập cho từng task (Sonnet; Task 4 bằng Opus) và review toàn nhánh (Opus)
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `docs/superpowers/plans/2026-10-04-vnxsi-m5-inquiry.md`, báo cáo của Implementer từng task, diff `5363766..1f5ddc7` (đã gộp `main` có VNX-0708 vào nhánh ở `1f5ddc7`)
- **Lệnh đã chạy lại (review toàn nhánh):** `npm run typecheck -w apps/web` → exit 0; `npm test` → 75 file, 497/497 test xanh

## Verdict

APPROVE. Review toàn nhánh trả "With fixes" (0 BLOCKER, 1 HIGH do plan, còn lại LOW). Owner duyệt sửa F1–F8 (2026-10-04, F1 chọn nút "Gửi ngay", F2 chọn 5/giờ mỗi email); lượt sửa ở `86653c1..2174baa` đã re-review: cả 8 ADDRESSED, không có lỗi mới. F9 (ARCHITECTURE) Reviewer sửa.

Sau đó `main` có thêm VNX-0705a (trang pháp lý và một cron riêng). Gộp ở `482ef50`: một cron duy nhất theo khung của VNX-0705a, thêm các bước M5; review riêng phần gộp: Approved. **Lệnh đã chạy lại (Reviewer, `482ef50`):** `npm run typecheck -w apps/web` → exit 0; `npm test` → 79 file, 534/534 test xanh.

## Lượt sửa trong lúc thực thi (đã re-review, đều ADDRESSED)

| Task | Phát hiện | Commit sửa |
|---|---|---|
| 1 | Test "mất compare-and-set" chưa chứng minh audit cũng không được ghi | `d0a1d82` |
| 2 | `notifyInquiryMessage` có thể ném lỗi D1 dù ghi "never throws"; route gọi sau khi đã ghi DB → 500 | `a7e0db8` |
| 4 | Form chưa đăng nhập báo "không gửi cho chính mình" khi gõ email của builder → lộ email đăng nhập của builder | `12fc174` |

## Phát hiện của review toàn nhánh

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | HIGH (lỗi plan) | `routes/me.tsx:30`, `me.pending` (4 locale), `routes/auth.tsx:112,122` | Inquiry chưa xác nhận là ngõ cụt: link 15 phút hết hạn → trang "link không dùng được" luôn tiếng Anh, `/me` bảo "kiểm tra hộp thư" (link đã chết), không gửi lại được, 48 giờ sau bị xóa; builder không bao giờ nhận | Sửa câu chữ 4 locale; trang link hết hạn theo locale của token; **Owner chọn:** nút "Gửi ngay" ở `/me` cho client đã đăng nhập (phiên đăng nhập đã chứng minh email) |
| F2 | LOW | `routes/inquiry-form.tsx:101` | Chỉ giới hạn 10/giờ/IP; đổi IP thì một địa chỉ có thể bị dội email xác nhận, hại uy tín gửi của Resend | **Owner chọn:** thêm 5/giờ mỗi email (đường chưa đăng nhập), quá hạn thì trả trang "kiểm tra email" như thường |
| F3 | LOW | `http/turnstile.ts:12,19` | `TURNSTILE_DRIVER=fake` nếu lỡ đặt ở production sẽ nhận token `test-pass` | Bỏ qua `fake` khi `APP_ORIGIN` là `https://vnx.si` |
| F4 | LOW | `routes/inquiry-form.tsx:101,104` | Rate limit bị tiêu trước khi kiểm form; gõ sai vài lần là hết lượt (NAT nhà mạng di động) | Đếm rate limit sau khi form hợp lệ |
| F5 | LOW | `wrangler.jsonc:42` | Comment thứ tự deploy chưa có `0007_inquiries`; deploy code M5 trước migration → `/hub`, `/me` 500 | Thêm vào comment |
| F6 | LOW | `jobs/daily.ts:44`, `db/users.ts` (`deleteGhostUsers`) | Nhắc cả builder bị khóa; xóa cả user ngầm bị admin khóa (mất dấu khóa spam); thiếu admin thì bỏ qua cảnh báo trong im lặng | Bỏ builder không `approved` khỏi nhắc; `AND status = 'active'` khi xóa; log cảnh báo khi `ADMIN_EMAILS` trống |
| F7 | LOW | `public/assets/app.css:93,124` | Sau khi gộp `main`: `.hp` định nghĩa hai lần; `.btn.secondary` (M5) trùng `.btn-secondary` (landing) | Giữ một |
| F8 | LOW | `test/jobs/daily.test.ts` | Test giữ tài khoản chưa có ca builder / invite / huy hiệu / audit; M6 sẽ sửa câu này | Thêm các ca đó |
| F9 | LOW (tài liệu) | `docs/architecture/ARCHITECTURE.md` §2 | Dòng `jobs/` thiếu notify, auth, http, domain, i18n; `email/` import kiểu từ `domain/` | Reviewer sửa |

## Quyết định của Reviewer trong lúc thực thi (review toàn nhánh đã xác nhận cả 6)

- View không import `http/` (bỏ `data-response-field-name`, dùng tên trường mặc định của Turnstile).
- Bổ sung test audit khi mất compare-and-set (Task 1).
- `notifyInquiryMessage` không bao giờ ném lỗi (Task 2); đổi lại có thể gửi trùng một email khi đánh dấu "đã gửi" lỗi, có log.
- Không lộ email đăng nhập của builder ở form chưa đăng nhập (Task 4); khi đã đăng nhập vẫn báo lỗi rõ.
- Gộp `main` (VNX-0708) vào nhánh trước review toàn nhánh (`1f5ddc7`, không xung đột ngữ nghĩa).

## Đối chiếu cổng ra M5

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Inquiry từ client chưa đăng nhập đi hết vòng: xác nhận email → builder trả lời → client thấy trong `/me` | ✓ | `test/inquiry-gate.test.ts` (toàn bộ qua HTTP, có trang xác nhận + nút POST) |
| Builder không thấy email của client | ✓ | cùng test (Hub list, Hub thread, email gửi builder: subject, text, html); `test/notify/inquiry.test.ts`; `test/hub/inquiries.test.ts` |

## Minor để lại (không chặn merge)

- Câu chữ / a11y: thông báo "tạm không dùng được" lặp ở 503; lỗi lý do từ chối chưa gắn `aria-describedby`; key `inbox.lastActivity` chưa dùng.
- Tên client: regex ký tự điều khiển từ chối ZWJ (emoji ghép) và không bắt U+2028/2029.
- Test nhánh phụ: route-level mất compare-and-set, client khác POST reply/close, escape ở trang admin, ranh giới 2000 ký tự, test rate limit dùng đồng hồ thật (có thể lệch khi qua đầu giờ).
- Cron: cảnh báo admin gửi lại cho admin đầu danh sách nếu mailer lỗi giữa chừng; `findUserById` nằm ngoài try của từng mục nhắc.
- Mở Inquiry khi product / builder đã thôi công khai trong 15 phút chờ xác nhận; có thể "gài" Inquiry chờ vào tài khoản người khác (Turnstile + rate limit + xóa sau 48 giờ giảm thiểu); khác biệt thời gian phản hồi giữa các nhánh "không tạo gì".
