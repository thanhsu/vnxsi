# VNX-0710 — Feedback & liên hệ (`/contact`, form trên landing, `/admin/feedback`) · Plan

- **Trạng thái:** Draft (thiết kế Owner duyệt trong chat 2026-10-04)
- **Roadmap:** M7, task mới VNX-0710 (Owner yêu cầu 2026-10-04, dùng lâu dài trên production).
- **Spec:** chưa có trong spec Wave 1; plan này là nguồn. Áp quy tắc chung: spec 8.2 (rate limit, origin), 8.3 (email qua `Mailer`), 8.6 (văn bản thuần), 8.9 (lỗi theo ô); ADR-001, ADR-002, ADR-003.
- **Phụ thuộc:** nhánh `feat/vnx-0709-ui` (landing, header, footer mới) + `origin/main` mới (M5: Turnstile, cron; VNX-0508: Privacy).
- **Implementer / Reviewer:** subagent / Claude

## Vì sao làm bây giờ

Owner muốn builder và client gửi được câu hỏi, góp ý, đề nghị hợp tác cho VNX.SI ngay từ go-live, qua một trang liên hệ cố định và một ô trên landing.

## Phạm vi

**Trong phạm vi**
0. Đưa `origin/main` vào `feat/vnx-0709-ui` (merge), gộp 2 xung đột dự kiến `apps/web/public/assets/app.css`, `apps/web/src/views/Layout.tsx`: giữ thiết kế VNX-0709, mang sang mọi phần M5/VNX-0508 thêm (ví dụ script Turnstile, link, class mới). Toàn bộ test của cả hai phía phải xanh sau merge. Commit merge riêng.
1. Bảng `feedback` + module `contact`.
2. Trang `/contact` ×4 locale + `POST /contact`.
3. Khối "Ask us" trên landing dùng cùng form.
4. Email thông báo tới `contact@vnx.si`, reply-to là email người gửi.
5. `/admin/feedback`: danh sách, chi tiết, đánh dấu đã xử lý / spam.
6. Header (mục Contact), footer (Company → Contact), sitemap.
7. Privacy: thêm đúng các câu ở mục "Privacy" (vào `docs/legal/privacy.md` và `src/legal/content.ts`).
8. `apps/web/wrangler.jsonc`: đặt `"TURNSTILE_SITE_KEY": "0x4AAAAAAFNhEcGnR8e56X8X"` (site key công khai của widget `vnx.si`, Owner tạo 2026-10-04). Secret `TURNSTILE_SECRET` do Owner đặt bằng `wrangler secret put`, không nằm trong repo.

**Ngoài phạm vi**
- Trả lời trong web (Owner trả lời bằng email).
- Gửi lại email lỗi qua cron (admin thấy cờ "chưa gửi mail" và đọc trên trang admin).
- Tự động phân loại spam bằng AI.
- Đính kèm file.

## Thiết kế

### Dữ liệu (`migrations/0009_feedback.sql`; `0008` đã thuộc `requests` của nhánh M6)

```sql
CREATE TABLE feedback (
  id          TEXT PRIMARY KEY,                -- ULID
  role        TEXT NOT NULL CHECK (role IN ('builder', 'client', 'other')),
  kind        TEXT NOT NULL CHECK (kind IN ('question', 'suggestion', 'partnership', 'other')),
  name        TEXT,                            -- tùy chọn, ≤ 100
  email       TEXT NOT NULL CHECK (email = lower(email)),
  message     TEXT NOT NULL,                   -- 20–2000 ký tự sau khi chuẩn hóa CRLF → LF
  locale      TEXT NOT NULL,
  user_id     TEXT REFERENCES users (id),      -- khi đã đăng nhập
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled', 'spam')),
  notified_at TEXT,                            -- null = email tới contact@vnx.si chưa gửi được
  handled_at  TEXT,
  handled_by  TEXT REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_feedback_status_created ON feedback (status, created_at);
```

- Module mới **`contact`** sở hữu `feedback`; ghi chỉ từ `src/db/feedback.ts` (thêm vào bảng `WRITERS` của test kiến trúc).
- `src/domain/feedback.ts`: zod schema form, enum role/kind, chuyển trạng thái (`new → handled`, `new → spam`, `handled → new`, `spam → new`; hàm thuần).

### Form (dùng chung cho `/contact` và landing)

| Trường | Ràng buộc |
|---|---|
| `role` | radio: builder / client / other (bắt buộc) |
| `kind` | select: question / suggestion / partnership / other (bắt buộc) |
| `name` | tùy chọn, trim, ≤ 100 |
| `email` | bắt buộc, cùng regex email đang dùng ở waitlist, ≤ 254, lowercase; đã đăng nhập thì điền sẵn email tài khoản (vẫn sửa được) |
| `message` | bắt buộc, 20–2000 ký tự sau chuẩn hóa CRLF → LF; văn bản thuần |
| `consent` | checkbox bắt buộc |
| `website` | honeypot |
| `from` | ẩn: `contact` hoặc `landing` (enum; giá trị khác → `contact`) |
| Turnstile | chỉ khi chưa đăng nhập, dùng lại đúng cơ chế xác minh của form Inquiry (M5); thiếu `TURNSTILE_SECRET` thì xử lý giống form Inquiry |

### Route

| Route | Hành vi |
|---|---|
| `GET /contact` ×4 | Trang: tiêu đề, đoạn giới thiệu, form; `?sent=1` → thông báo thành công thay form. `noindex` không đặt (trang công khai, có trong sitemap) |
| `POST /contact` ×4 | Origin check (middleware có sẵn) → honeypot (303 thành công giả, không lưu) → zod (lỗi: render lại **trang `/contact`** với giá trị đã nhập, lỗi theo ô, 400) → Turnstile (nếu chưa đăng nhập; sai → 400 với lỗi) → rate limit `contact:ip:<ip>` 5 / 3600 giây (vượt → 429) → lưu (`status = new`) → gửi email → 303 tới `/contact?sent=1`, hoặc `/?asked=1#ask` khi `from = landing` |
| `GET /admin/feedback` ×4 | `requireAdmin`; lọc `?status=new|handled|spam` (mặc định `new`), mới nhất trước, 50 dòng/trang; cột: thời gian, role, kind, email, 120 ký tự đầu, cờ "chưa gửi mail" |
| `GET /admin/feedback/:id` ×4 | chi tiết đầy đủ (văn bản thuần qua `PlainText`), link `mailto:` với subject "Re: …" |
| `POST /admin/feedback/:id/{handle,spam,reopen}` ×4 | `requireAdmin`, chuyển trạng thái qua domain (409 nếu không hợp lệ), ghi `audit_log`, 303 về chi tiết |

### Email

- Mở rộng `EmailMessage` với `replyTo?: string`; `ResendMailer` gửi `reply_to`; `FakeMailer` lưu lại để test.
- Người nhận: hằng `CONTACT_EMAIL = "contact@vnx.si"` (một chỗ trong code; dùng lại cho footer/legal nếu tiện).
- Tiêu đề: `[VNX.SI contact] {kind} from {role}`; nội dung (text + html đã escape): role, kind, name, email, locale, đường dẫn admin chi tiết (`APP_ORIGIN` + `/admin/feedback/:id`), toàn văn message. Tiếng Anh (chỉ admin đọc).
- Gửi thành công → đặt `notified_at`. Lỗi → giữ `null`, log JSON, **người gửi vẫn thấy thành công** (tin đã lưu).

### Giao diện

- `/contact`: bố cục theo design system VNX-0709 (eyebrow, tiêu đề display, cột form ≤ 640 px; bên cạnh trên desktop: khối nhỏ "Prefer email? contact@vnx.si" + câu "We usually reply within a few working days." — **không** hứa con số cụ thể).
- Landing: khối `#ask` ngay sau khối "Already have an idea?" (trước footer): eyebrow, tiêu đề, đoạn ngắn, form (cùng component); `?asked=1` → thông báo thành công tại chỗ.
- Header: thêm mục nav **Contact** (`/contact`) sau "For builders"; menu điện thoại cũng có.
- Footer: nhóm Company thêm "Contact" (`/contact`) trước dòng email.
- Admin: thêm mục "Feedback" vào `AdminLayout` nav, kèm số tin `new` nếu > 0 (đếm thật).
- Sitemap: thêm `/contact` (localized).

### Nội dung (i18n; EN chuẩn, VI dưới đây, zh Implementer dịch)

| Key (gợi ý) | EN | VI |
|---|---|---|
| nav / footer | Contact | Liên hệ |
| page title | Questions, suggestions, partnerships | Câu hỏi, góp ý, hợp tác |
| page lead | Ask us anything about VNX.SI, tell us what to build next, or propose working together. We read every message. | Hỏi bất cứ điều gì về VNX.SI, góp ý điều chúng tôi nên làm tiếp, hoặc đề nghị hợp tác. Chúng tôi đọc mọi tin nhắn. |
| side note | Prefer email? Write to contact@vnx.si. We usually reply within a few working days. | Thích email hơn? Gửi tới contact@vnx.si. Chúng tôi thường trả lời trong vài ngày làm việc. |
| landing eyebrow / h2 | Ask us / Have a question or a suggestion? | Hỏi chúng tôi / Bạn có câu hỏi hay góp ý? |
| landing lead | Builders and clients alike: tell us what you need, what is missing, or what we should do better. | Dù là builder hay client: hãy cho chúng tôi biết bạn cần gì, còn thiếu gì, hay chúng tôi nên làm tốt hơn ở đâu. |
| role label + options | I am a… · Builder · Client · Other | Tôi là… · Builder · Client · Khác |
| kind label + options | About · Question · Suggestion · Partnership or press · Other | Về · Câu hỏi · Góp ý · Hợp tác hoặc báo chí · Khác |
| name | Name (optional) | Tên (không bắt buộc) |
| email | Email (so we can reply) | Email (để chúng tôi trả lời) |
| message | Your message · 20 to 2000 characters | Nội dung · 20 đến 2000 ký tự |
| consent | VNX.SI may store this message and my email to answer me. | VNX.SI được lưu tin nhắn và email của tôi để trả lời. |
| submit | Send message | Gửi tin nhắn |
| sent | Thanks. We'll reply by email. | Cảm ơn bạn. Chúng tôi sẽ trả lời qua email. |
| errors | Please choose one. · That email address doesn't look right. · Please write between 20 and 2000 characters. · Please tick the box so we can store your message. · Please confirm you are a person. · Too many messages. Please try again in an hour. | Vui lòng chọn một mục. · Email chưa đúng định dạng. · Vui lòng viết từ 20 đến 2000 ký tự. · Bạn cần đánh dấu ô đồng ý để chúng tôi lưu tin nhắn. · Vui lòng xác nhận bạn là người thật. · Gửi quá nhiều tin. Vui lòng thử lại sau một giờ. |
| admin | Feedback · New · Handled · Spam · Mark handled · Mark as spam · Reopen · Email not sent yet · Reply by email | (giữ EN như các trang admin khác hoặc dịch theo mẫu admin hiện có) |

### Privacy (thêm nguyên văn; Implementer sửa `docs/legal/privacy.md` đúng các câu này rồi `src/legal/content.ts` cho khớp — ngoại lệ được Reviewer cho phép trong task này)

EN, mục 2 "What we collect", thêm sau dòng **Waitlist**:
- **Questions and feedback:** when you use our contact form, your email, the name you give (optional), whether you are a builder or a client, what your message is about, the message itself, the language of the page, and your account if you are signed in.

EN, mục 2, dòng **Bot check**: đổi "when you send an inquiry without signing in" thành "when you send an inquiry or a contact message without signing in".

EN, mục 3 "Why we use it", thêm dòng: "- To read and answer the questions and feedback you send us."
EN, mục 3, câu căn cứ: đổi "We rely on your consent (waitlist)," thành "We rely on your consent (waitlist, contact form),".

EN, mục 4 "Who can see it", thêm dòng: "- Messages sent through the contact form are read only by the VNX.SI team; a copy is delivered to our mailbox through Resend."

EN, mục 6 "How long we keep it", thêm dòng: "- Questions and feedback: until we have answered and dealt with them, plus 12 months, or until you ask us to delete them."

VI tương ứng:
- Mục 2: "- **Câu hỏi và góp ý:** khi bạn dùng form liên hệ, email của bạn, tên bạn cung cấp (không bắt buộc), bạn là builder hay client, tin nhắn nói về điều gì, nội dung tin nhắn, ngôn ngữ của trang, và tài khoản của bạn nếu đã đăng nhập."
- Mục 2, dòng Kiểm tra bot: "khi bạn gửi Inquiry mà chưa đăng nhập" → "khi bạn gửi Inquiry hoặc tin nhắn liên hệ mà chưa đăng nhập" (khớp câu VI hiện có trên `main`; nếu câu VI hiện có khác chữ, giữ nghĩa này và ghi trong báo cáo).
- Mục 3: "- Đọc và trả lời các câu hỏi, góp ý bạn gửi cho chúng tôi."; căn cứ: "(danh sách chờ)" → "(danh sách chờ, form liên hệ)".
- Mục 4: "- Tin nhắn gửi qua form liên hệ chỉ đội ngũ VNX.SI đọc; một bản được chuyển tới hộp thư của chúng tôi qua Resend."
- Mục 6: "- Câu hỏi và góp ý: tới khi chúng tôi đã trả lời và xử lý xong, cộng 12 tháng, hoặc tới khi bạn yêu cầu xóa."

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Nhánh chứa `origin/main` (M5, VNX-0508); 2 xung đột gộp, giữ thiết kế VNX-0709 và mọi thứ M5 thêm; toàn bộ test hai phía xanh | `git merge-base --is-ancestor origin/main HEAD`; `npm test` |
| AC2 | Migration `0009_feedback.sql` đúng schema; chỉ `src/db/feedback.ts` ghi bảng | `test/architecture.test.ts`; `test/db/feedback.test.ts` |
| AC3 | `GET /contact` ×4 trả 200, có form đủ trường, canonical/hreflang; có trong sitemap | `test/contact/page.test.ts`; `test/seo/sitemap.test.ts` |
| AC4 | POST hợp lệ (chưa đăng nhập, Turnstile giả hợp lệ) → 1 dòng `feedback` đúng dữ liệu, `status = new`, 1 email tới `contact@vnx.si` có `replyTo` = email người gửi, `notified_at` đặt; 303 `/contact?sent=1` | `test/contact/submit.test.ts` |
| AC5 | `from=landing` → 303 `/?asked=1#ask` (theo locale); landing `?asked=1` hiện thông báo | `submit.test.ts`; `test/landing/page.test.ts` |
| AC6 | Lỗi từng trường (role, kind, email, message ngắn/dài, consent) → 400, giữ giá trị, lỗi đúng ô theo locale; không có dòng mới | `submit.test.ts` |
| AC7 | Honeypot → 303 thành công, không lưu, không email; thiếu Origin → 403; Turnstile sai → 400; lần thứ 6 trong giờ cùng IP → 429 | `submit.test.ts` |
| AC8 | Đã đăng nhập: email điền sẵn; không cần Turnstile; `user_id` lưu | `submit.test.ts` |
| AC9 | Mailer lỗi → dòng vẫn lưu, `notified_at = null`, người gửi vẫn 303 thành công; admin thấy cờ "Email not sent yet" | `submit.test.ts`; `test/admin/feedback.test.ts` |
| AC10 | `/admin/feedback`: non-admin 403; lọc trạng thái; chi tiết escape nội dung (chuỗi `<script>` hiện dạng chữ); handle/spam/reopen chuyển đúng, ghi `audit_log`, chuyển không hợp lệ 409 | `test/admin/feedback.test.ts`; `test/domain/feedback.test.ts` |
| AC11 | Header có Contact (desktop + menu di động), footer Company có Contact, admin nav có Feedback | `test/design/layout.test.ts` |
| AC12 | Privacy EN/VI có đúng các câu mục "Privacy"; trang `/privacy` khớp | `test/legal/content.test.ts` |
| AC13 | Parity i18n, kiến trúc, toàn bộ test, typecheck xanh | `npm test`; `npm run typecheck -w apps/web` |
| AC14 | `/contact` và khối `#ask` đúng design system ở 1280/390 px, sáng/tối | Reviewer xem |

## Rủi ro

- **Merge với `main`** (bước 0) đụng `Layout.tsx` và `app.css`: thiết kế VNX-0709 là chuẩn; mọi script/link M5 thêm vào `<head>` (Turnstile) phải còn.
- **Nhánh M6** đang mở (`feat/m6-request`) cũng sửa i18n, Layout, Privacy: số migration đã tránh (`0009`); khi M6 merge, phiên M6 gộp phần còn lại.
- **Spam:** honeypot + Turnstile (chưa đăng nhập) + rate limit + nút Spam ở admin.

## Câu hỏi mở

Không có.
