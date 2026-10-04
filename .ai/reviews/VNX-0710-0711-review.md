# VNX-0710 + VNX-0711 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** plan VNX-0710, VNX-0711; handoff VNX-0710; báo cáo `.ai/tasks/VNX-0710-report.md`, `.ai/tasks/VNX-0711-report.md`; diff `12856b1..af38216` (merge `b236b70` + 11 commit); trọng tâm `src/routes/contact.tsx`, `src/email/templates/feedback.ts`, `migrations/0009_feedback.sql`, `src/routes/admin-feedback.tsx`, phần không-R2.
- **Lệnh đã chạy lại:**
  - `git merge-base --is-ancestor origin/main HEAD` → ancestor-ok.
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test` → 88 file, **640/640** xanh.
  - `npx wrangler deploy --dry-run` (trong `apps/web`) → binding: DB, ASSETS, `APP_ORIGIN`, `TURNSTILE_SITE_KEY` = `0x4AAAAAAFNhEcGnR8e56X8X`; không còn R2.
  - `wrangler dev` 8787: `/contact`, `/vi/contact` → 200; ảnh `/vi/contact` 1280 px sáng: đúng design system, mục Liên hệ trên header/footer; khi thiếu Turnstile secret ở local, form hiện thông báo fail-closed (đúng cơ chế M5).

## Verdict

**APPROVE WITH CHANGES** — sửa F1 (Owner đã chọn hướng sửa 2026-10-05). Còn lại đạt.

## Phát hiện

| # | Mức | File | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM | `src/views/LandingPage.tsx` (`widget={false}`), `test/design/assets.test.ts` | Form "Ask us" trên landing không có Turnstile; khách chưa đăng nhập gửi lần đầu luôn bị trả 400 sang `/contact` và phải gửi lại | **Owner chọn:** tải Turnstile trên landing cho form `#ask` (khi chưa đăng nhập và có site key), giống form `/contact`. Nới test AC2 của VNX-0709 để cho phép **đúng một** origin `https://challenges.cloudflare.com` (script Turnstile), mọi host ngoài khác vẫn bị cấm. Test: landing chưa đăng nhập có widget + script; đã đăng nhập không có; POST từ landing kèm token hợp lệ (fake) → 303 `/?asked=1#ask` ngay lần đầu |
| F2 | LOW | `src/views/admin/AdminLayout.tsx` | Số tin `new` chỉ hiện trên các trang feedback (view không đọc DB) | Chấp nhận |
| F3 | LOW | `apps/web/wrangler.jsonc` (comment thứ tự deploy) | Chưa nhắc `0009_feedback` | Reviewer xử lý khi deploy (`db:migrate:remote` áp mọi migration chưa chạy) |
| F4 | SUGGESTION | `src/routes/contact.tsx` (`notifyTeam`) | Gửi mail đồng bộ trước redirect (thêm vài trăm ms) | Chấp nhận; có thể chuyển sang `waitUntil` sau |

### Sai khác do Implementer báo — đã xem, chấp nhận

- Merge: giữ header VNX-0709, link "My inquiries" của M5 vào nhóm tài khoản; CSS M5 chuyển sang token mới; `CURRENT-STATUS.md` giữ cả hai phía.
- Breakpoint header 1159 px để nhãn tiếng Việt không xuống dòng.
- Câu Privacy VI dùng "yêu cầu" theo bản trên `main` (đúng nghĩa plan).
- Nhãn message tách thành nhãn + gợi ý; dropdown "Về" mặc định "Câu hỏi".
- Chuỗi mới ngoài plan: `contact.form.unavailable` và nhãn admin (Received, Sender, Message, Status, Page language, All messages, danh sách rỗng): chấp nhận, mô tả trung tính, không hứa hẹn.
- `src/db/audit.ts`: audit gắn với chuyển trạng thái trong cùng batch (giống mẫu inquiries).
- Test "không chữ số trên landing" bỏ qua khối `#ask` (quy tắc độ dài, không phải số liệu).
- VNX-0711: `vitest.config.ts` cấp `MEDIA` riêng cho test; `MEDIA!` trong `test/hub/media.test.ts`.

## Đối chiếu tiêu chí chấp nhận

VNX-0710 AC1–AC13 ✓ theo bảng bằng chứng trong báo cáo, đã chạy lại 640/640; AC14 ✓ cho `/contact` (ảnh Reviewer), khối `#ask` xem lại sau F1. VNX-0711 AC1–AC5 ✓ (dry-run không binding R2; `r2_buckets` chỉ còn trong comment).

## Nghĩa vụ để lại

- Deploy: `npm run db:migrate:remote -w apps/web` (áp `0003`–`0007`, `0009`) trước `npm run deploy`.
- Khi Owner bật R2: `npx wrangler r2 bucket create vnxsi-media`, bỏ comment `r2_buckets`, deploy.
- Nhánh M6 (`feat/m6-request`) khi merge: gộp i18n, Layout (mục Contact, tài khoản), Privacy (mục contact form đã thêm).

## Re-review lượt sửa F1 (2026-10-05)

- **Diff:** `37fe64f..76f965e` (`204eb13` test, `c6fcf8b` fix, `76f965e` báo cáo). Chỉ bỏ `widget={false}` ở landing; `ContactForm` render widget giống `/contact`; test `assets` chỉ cho phép đúng `https://challenges.cloudflare.com/turnstile/v0/api.js`, mọi host khác (kể cả host giả `challenges.cloudflare.com.evil.example`, iframe/stylesheet/preconnect ngoài) vẫn bị từ chối. F2–F4 không đổi.
- **Lệnh chạy lại:** typecheck exit 0; `npm test` → 88 file, **644/644**.
- **Xem tay:** `wrangler dev` với cặp key thử của Turnstile: landing chưa đăng nhập có đúng 1 script Turnstile và widget nằm giữa ô đồng ý và nút gửi trong khối `#ask` (ảnh 1280 px), bố cục đúng design system.

| # | Kết quả |
|---|---|
| F1 | ✓ Đã sửa |

## Verdict cuối

**APPROVE** cho VNX-0709 (đã duyệt trước), VNX-0710, VNX-0711. Sẵn sàng merge và deploy theo quyết định Owner (deploy khi chưa có R2).
