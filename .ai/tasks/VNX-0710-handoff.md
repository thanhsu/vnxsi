# VNX-0710 — Handoff cho Implementer

- **Plan:** `.ai/plans/VNX-0710-plan.md` (nguồn chi tiết: dữ liệu, form, route, email, giao diện, nội dung EN/VI, câu Privacy, AC1–AC14).
- **Báo cáo phải nộp:** `.ai/tasks/VNX-0710-report.md`
- **Nhánh:** `feat/vnx-0709-ui` (tiếp tục trên nhánh này). Không push, không merge vào `main`.

## Mục tiêu

Trang `/contact`, form "Ask us" trên landing, email tới `contact@vnx.si`, trang `/admin/feedback`; trước đó đưa `origin/main` (M5, VNX-0508) vào nhánh.

## Phạm vi đã duyệt

Plan mục "Phạm vi → Trong phạm vi" 0–7 và "Thiết kế".

## Ngoài phạm vi (không làm)

Trả lời trong web, cron gửi lại email, AI chống spam, đính kèm file, deploy, mọi thứ thuộc M6.

## Đọc trước

- `CLAUDE.md`; plan; `docs/design/2026-10-04-ui-audit-and-redesign.md` mục 2.
- Sau bước 0: form Inquiry của M5 (Turnstile, honeypot, rate limit, render lỗi), `src/email/*` (Mailer, Resend, Fake), `src/views/Layout.tsx`, `src/views/LandingPage.tsx`, `src/views/admin/AdminLayout.tsx`, một trang admin mẫu (`routes/admin-users.tsx`), `src/routes/seo.ts`, `src/legal/content.ts`, `docs/legal/privacy.md`, `test/architecture.test.ts`.

## File dự kiến bị ảnh hưởng

- Bước 0: merge commit (gộp `apps/web/public/assets/app.css`, `apps/web/src/views/Layout.tsx`).
- Mới: `apps/web/migrations/0009_feedback.sql`, `src/domain/feedback.ts`, `src/db/feedback.ts`, `src/routes/contact.tsx`, `src/routes/admin-feedback.tsx`, `src/views/ContactPage.tsx`, `src/views/contact/ContactForm.tsx`, `src/views/admin/FeedbackPage.tsx`, `src/views/admin/FeedbackDetailPage.tsx`, `src/email/templates/feedback.ts`, test: `test/contact/page.test.ts`, `test/contact/submit.test.ts`, `test/admin/feedback.test.ts`, `test/db/feedback.test.ts`, `test/domain/feedback.test.ts`.
- Sửa: `src/app.ts`, `src/email/mailer.ts`, `src/email/resend.ts`, `src/email/fake.ts`, `src/views/Layout.tsx`, `src/views/LandingPage.tsx`, `src/routes/landing.tsx` (đọc `?asked=1`), `src/views/admin/AdminLayout.tsx`, `src/routes/seo.ts`, `src/i18n/messages/*.ts`, `public/assets/app.css`, `src/legal/content.ts`, **`docs/legal/privacy.md` (chỉ thêm/sửa đúng các câu ở mục "Privacy" của plan)**, `test/architecture.test.ts`, `test/design/layout.test.ts`, `test/landing/page.test.ts`, `test/seo/sitemap.test.ts`.

## Ảnh hưởng DB / API / UI

- DB: bảng mới `feedback` (migration `0009`).
- API: `GET/POST /contact`, `GET /admin/feedback`, `GET /admin/feedback/:id`, `POST /admin/feedback/:id/{handle,spam,reopen}` (×4 locale).
- UI: trang `/contact`, khối `#ask` trên landing, mục Contact ở header/footer, mục Feedback ở admin.

## Quy tắc nghiệp vụ

- Câu chữ EN/VI và câu Privacy đúng nguyên văn plan; zh tự dịch. Không thêm lời hứa thời gian trả lời cụ thể.
- Người gửi luôn thấy thành công khi tin đã lưu, kể cả khi email lỗi.
- Email admin chứa nội dung người dùng: escape trong HTML; reply-to là email người gửi.
- Turnstile: dùng đúng cơ chế đã có của M5, chỉ khi chưa đăng nhập.
- Rate limit `contact:ip:<ip>` 5 / 3600 giây; honeypot không tính.
- Mọi chuyển trạng thái admin qua hàm domain + `audit_log`.

## Tiêu chí chấp nhận

AC1–AC14 ở plan; lệnh ghi ở cột "Kiểm bằng". Tối thiểu:

- [ ] AC1: `git merge-base --is-ancestor origin/main HEAD && echo ok`
- [ ] AC2–AC12: `npm test -- test/contact test/admin/feedback.test.ts test/db/feedback.test.ts test/domain/feedback.test.ts test/design/layout.test.ts test/landing/page.test.ts test/seo/sitemap.test.ts test/legal/content.test.ts test/architecture.test.ts`
- [ ] AC13: `npm test` và `npm run typecheck -w apps/web`
- [ ] AC14: Reviewer kiểm tay

## Test bắt buộc

TDD (commit test trước code, sau bước 0). Mailer giả; Turnstile giả theo cách test của M5; mỗi AC ít nhất một test.

## Lệnh kiểm tra

```bash
npm run db:migrate:local -w apps/web
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; ghi lý do trong báo cáo.
- Không thêm dependency.
- Không sửa `docs/**` ngoài các câu Privacy đã cho.
- Không `dangerouslySetInnerHTML` ngoài chỗ có sẵn.
- Commit theo Conventional Commits, mỗi commit kèm dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
