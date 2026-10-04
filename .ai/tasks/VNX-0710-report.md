# VNX-0710 — Báo cáo Implementer

- **Task:** VNX-0710 (feedback và liên hệ: `/contact`, khối "Ask us" trên landing, email tới `contact@vnx.si`, `/admin/feedback`)
- **Plan:** `.ai/plans/VNX-0710-plan.md` (APPROVED 2026-10-04) · **Handoff:** `.ai/tasks/VNX-0710-handoff.md`
- **Nhánh:** `feat/vnx-0709-ui` (worktree `.claude/worktrees/agent-a26fce7bca484621a`). Không push, không merge vào `main`, không deploy.
- **Implementer:** subagent Claude (context mới)

## 1. Bước 0: merge `origin/main`

Commit `b236b70` (`chore: merge origin/main (M5, VNX-0508) into feat/vnx-0709-ui`), merge `--no-ff`, commit riêng.

| File xung đột | Cách gộp |
|---|---|
| `apps/web/src/views/Layout.tsx` | Giữ header VNX-0709. Thứ duy nhất `main` thêm vào Layout là link "My inquiries" (`/me`, `nav.me`) khi đã đăng nhập; link này nằm trong component `Account` (class `nav-account`), nên có cả trên desktop lẫn trong menu điện thoại. Script Turnstile của M5 không nằm trong Layout: nó ở `InquiryFormPage.tsx` (merge tự động, giữ nguyên). |
| `apps/web/public/assets/app.css` | Giữ stylesheet VNX-0709. Mang sang các rule M5 thêm (`.ask`, `.messages`, `.messages > li`, `.from-builder`, `.badge-inquiry-open/answered`), viết lại trên token mới (`--border`, `--r-lg`, `--primary`, `--success`). `.hp` đã có sẵn bên VNX-0709 nên không lặp lại. Phần CSS landing VNX-0708 cũ ở phía `main` không lấy lại vì VNX-0709 đã thay thế. |
| `.ai/context/CURRENT-STATUS.md` | Giữ cả hai phía. Dòng Go-live của nhánh đã chứa trọn dòng của `main`; dòng M5 dùng bản gạch bỏ của `main` ("Đã gộp ở `482ef50`…"). Không bỏ nội dung nào. |
| `apps/web/test/me/inquiries.test.ts` (không xung đột, nhưng đỏ sau merge) | Test của `main` chờ `<a href="/zh-hant/me">我的詢問</a>`; header VNX-0709 đặt `class="nav-account"` trên link tài khoản. Chỉ sửa chuỗi mong đợi thành `<a class="nav-account" href="/zh-hant/me">我的詢問</a>`, giữ nguyên ý test. |

Không có dependency mới (không đổi `package*.json`), nên không cần `npm ci`. Sau merge: `db:migrate:local` áp `0007_inquiries.sql`; typecheck exit 0; `npm test` cho **82 file / 570 test xanh**.

## 2. Commit

| SHA | Nội dung |
|---|---|
| `b236b70` | chore: merge origin/main (M5, VNX-0508) into feat/vnx-0709-ui |
| `df893a0` | test(web): contact page, feedback storage and admin review (VNX-0710), test viết trước, đã chạy và thấy đỏ (47 test hỏng, 3 file không import được) |
| `48eaae7` | feat(web): feedback table, contact form rules and status changes (VNX-0710) |
| `36e503d` | feat(web): reply-to on e-mails and the contact notice template (VNX-0710) |
| `8793649` | feat(web): /contact, landing Ask us block and /admin/feedback (VNX-0710) |
| `f771d83` | docs(legal): privacy covers the contact form (VNX-0710, Owner approved text) |
| `42af4e3` | test(web): fit VNX-0710 tests to hoisted scripts, shared D1 rows and the landing form |
| (commit này) | docs: VNX-0710 implementer report |

## 3. File

**Mới:** `apps/web/migrations/0009_feedback.sql`, `src/domain/feedback.ts`, `src/db/feedback.ts`, `src/routes/contact.tsx`, `src/routes/admin-feedback.tsx`, `src/views/ContactPage.tsx`, `src/views/contact/ContactForm.tsx`, `src/views/admin/FeedbackPage.tsx`, `src/views/admin/FeedbackDetailPage.tsx`, `src/email/templates/feedback.ts`, `test/contact/page.test.ts`, `test/contact/submit.test.ts`, `test/admin/feedback.test.ts`, `test/db/feedback.test.ts`, `test/domain/feedback.test.ts`.

**Sửa (trong danh sách handoff):** `src/app.ts`, `src/email/mailer.ts`, `src/email/resend.ts`, `src/email/fake.ts` (chỉ comment: outbox vốn lưu cả message nên đã giữ `replyTo`), `src/views/Layout.tsx`, `src/views/LandingPage.tsx`, `src/routes/landing.tsx`, `src/views/admin/AdminLayout.tsx`, `src/routes/seo.ts`, `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `public/assets/app.css`, `src/legal/content.ts`, `docs/legal/privacy.md` (chỉ các câu ở mục "Privacy" của plan), `test/architecture.test.ts`, `test/design/layout.test.ts`, `test/landing/page.test.ts`, `test/seo/sitemap.test.ts`, `test/legal/content.test.ts`, `apps/web/wrangler.jsonc` (chỉ `TURNSTILE_SITE_KEY` và comment ngay trên nó).

**Sửa ngoài danh sách (lý do):**
- `src/db/audit.ts`: thêm guard `feedbackId` cho `auditStatement`, theo đúng mẫu `inquiryId`/`userId`/`productId` có sẵn. Nhờ vậy việc đổi trạng thái và dòng `audit_log` nằm trong một `db.batch`, và một compare-and-set thua sẽ không ghi audit. Không có guard thì không làm được điều này.
- `test/landing/deck.test.ts`: test "không có chữ số trong `<main>`" (VNX-0709) nay bỏ qua khối `#ask`, vì form có gợi ý độ dài "20 to 2000 characters" (copy đã duyệt). Đây là quy tắc độ dài, không phải số liệu thống kê. `test/landing/page.test.ts` dùng cùng cách loại trừ.
- `test/email/resend.test.ts`: thêm test `reply_to` (AC4, "ResendMailer gửi `reply_to`").
- `test/me/inquiries.test.ts`: bước 0, xem mục 1.

## 4. Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 | Đạt | `git merge-base --is-ancestor origin/main HEAD && echo ancestor-ok` in ra `ancestor-ok`. Sau merge: 570/570 xanh. |
| AC2 | Đạt | `0009_feedback.sql` đúng schema của plan. `test/db/feedback.test.ts` kiểm cột, NOT NULL, default `'new'`, index `(status, created_at)`, CHECK role/kind/status/email lowercase. `WRITERS.feedback = "../src/db/feedback.ts"` trong `test/architecture.test.ts`. |
| AC3 | Đạt | `test/contact/page.test.ts`: ×4 locale trả 200, đủ trường (3 radio role, 4 option kind, name ≤ 100, email, textarea 20–2000, consent, honeypot, `from=contact`, Turnstile), canonical + hreflang ×4 + x-default, không có `noindex`, label cho mọi ô. `test/seo/sitemap.test.ts`: `/contact` ×4 kèm alternates. |
| AC4 | Đạt | `submit.test.ts`: đúng 1 dòng (`status=new`, email lowercase, CRLF thành LF, `locale`); 1 email tới `contact@vnx.si`, `replyTo` = email người gửi, tiêu đề `[VNX.SI contact] question from builder`; HTML đã escape `<script>`; có link admin; `notified_at` được đặt; 303 về `/vi/contact?sent=1`. |
| AC5 | Đạt | `from=landing` cho 303 về `/?asked=1#ask` và `/zh-hant/?asked=1#ask`; `from` lạ quy về `contact`. Landing `?asked=1` hiện thông báo trong `#ask` và form waitlist vẫn còn (`test/landing/page.test.ts`). |
| AC6 | Đạt | role, kind, email, message ngắn, message dài, consent: mỗi trường cho 400, render lại trang `/contact` với giá trị đã nhập, lỗi đúng ô (`ct-<field>-error`, `aria-describedby`) bằng tiếng Việt, không có dòng mới, không email. Giá trị nhập vào được escape khi trả lại. |
| AC7 | Đạt | Honeypot cho 303 thành công, không lưu, không email; thiếu Origin cho 403; Turnstile sai cho 400 kèm "Vui lòng xác nhận bạn là người thật."; lần thứ 6 trong giờ cùng IP cho 429 kèm thông báo; honeypot và form sai không bị tính vào giới hạn; Turnstile chưa cấu hình cho 503 (giống form Inquiry). |
| AC8 | Đạt | Đã đăng nhập: email điền sẵn bằng email tài khoản (vẫn sửa được), không có Turnstile ở cả `/contact` lẫn landing; POST không có token vẫn 303; lưu `user_id`. |
| AC9 | Đạt | Cho `FakeMailer.send` ném lỗi: dòng vẫn lưu với `notified_at = null`, 303 thành công, log JSON `contact.notify_failed` có `feedbackId` nhưng không chứa email. Admin: danh sách và chi tiết hiện cờ "Email not sent yet" / "Chưa gửi được email". |
| AC10 | Đạt | `test/admin/feedback.test.ts`: non-admin nhận 403 (GET list, GET detail, 3 POST); khách chưa đăng nhập được chuyển sang login; lọc `new`/`handled`/`spam`, mặc định `new`, giá trị lạ quy về `new`; mới nhất trước; 120 ký tự đầu; 50 dòng/trang kèm link trang 2. Chi tiết escape `<script>` và tên, `PlainText` (gạch đầu dòng thành `<li>`), `mailto:` có `subject=Re%3A%20…`. Chuỗi handle → reopen → spam → reopen đều 303 và có `audit_log` (`feedback.handle`, `feedback.spam`, `feedback.reopen` với `{from,to}` và actor); chuyển không hợp lệ cho 409; id lạ cho 404. `test/domain/feedback.test.ts` phủ đủ 4 chuyển hợp lệ và các chuyển bị từ chối. |
| AC11 | Đạt | `test/design/layout.test.ts`: header có Contact (desktop + menu điện thoại, `aria-current` trên `/contact`), footer Company theo thứ tự Media kit, Contact, `mailto:`, Terms, Privacy; admin nav có Feedback ở cả 4 locale. |
| AC12 | Đạt | `test/legal/content.test.ts`: `docs/legal/privacy.md` EN/VI chứa nguyên văn các câu của plan, dòng mới nằm ngay sau dòng Waitlist, câu cũ không còn; `/privacy` và `/vi/privacy` hiện đúng các câu đó. Test so khớp từng dòng có sẵn (VNX-0705a) vẫn xanh. |
| AC13 | Đạt | `npm test`: 87 file / 634 test xanh. `npm run typecheck -w apps/web`: exit 0, `tsc` không báo lỗi. Parity i18n xanh. |
| AC14 | Chờ Reviewer | Implementer đã tự xem bằng headless Chrome (mục 6). |

## 5. Kết quả lệnh (đoạn cuối output thật)

```
$ git merge-base --is-ancestor origin/main HEAD && echo ancestor-ok
ancestor-ok

$ npm run typecheck -w apps/web     # wrangler types && tsc --noEmit
...
📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.
(tsc không in gì; exit code 0)

$ npm test
 Test Files  87 passed (87)
      Tests  634 passed (634)

$ npm test -- test/contact test/admin/feedback.test.ts test/db/feedback.test.ts test/domain/feedback.test.ts test/design/layout.test.ts test/landing/page.test.ts test/seo/sitemap.test.ts test/legal/content.test.ts test/architecture.test.ts
 Test Files  10 passed (10)
      Tests  107 passed (107)

$ npm run db:migrate:local -w apps/web
│ 0009_feedback.sql │ ✅ │
```

Số test: **570** (ngay sau merge) → **634** (sau VNX-0710), tức thêm 64 test.

## 6. Kiểm tra giao diện (tự kiểm, không thay AC14)

Dev server riêng ở cổng 8796 (`wrangler dev --var MAIL_DRIVER:fake --var TURNSTILE_DRIVER:fake`), đã tắt sau khi kiểm. Không đụng server ở cổng 8787. Chụp bằng headless Chrome:
- `/contact` và `/vi/contact` ở 1280 px, sáng và tối: eyebrow, h1, lead, thẻ form ≤ 640 px, khối email bên phải, nút role dạng chip. Ô trắng "Troubleshoot" là widget Turnstile thật đang từ chối site key giả `fake-site-key` của môi trường local.
- `/vi/contact` trong iframe 390 px (tối): một cột, khối email nằm dưới form, nút gửi rộng hết thẻ.
- Landing `/` và `/vi/` ở 1280 px (sáng, tối) và 390 px (sáng): khối `#ask` nằm sau "Already have an idea?", trước footer; tiêu đề ở cột trái, form ở cột phải (1280) hoặc xếp chồng (390).
- Header ở 920, 1100, 1160, 1200 px, bản VI: với 5 mục, nhãn tiếng Việt xuống dòng ở 920–1100 px, nên breakpoint chuyển sang menu được nâng lên (xem sai khác D3). Ở 1160 px header nằm gọn một dòng; ở 1100 px là menu.
- Không kiểm: trang `/admin/feedback` bằng mắt (cần phiên admin; test đã phủ markup); axe/contrast (để VNX-0802).

## 7. Sai khác so với plan, kèm lý do

- **D1 (cần Reviewer/Owner quyết):** khối `#ask` trên landing **không hiện widget Turnstile.** VNX-0709 AC2 (`test/design/assets.test.ts`: landing không có request bên thứ ba) và design doc §2.6 ("JS duy nhất…") không cho phép tải `challenges.cloudflare.com/turnstile/v0/api.js` trên landing. Lấy widget ra là cách duy nhất giữ được AC đó mà không thêm JS. Cách hoạt động hiện tại: khách chưa đăng nhập bấm gửi từ landing thì đi theo đúng nhánh Turnstile sai của plan (400, render lại `/contact` với giá trị đã nhập, câu "Please confirm you are a person." và widget), rồi gửi lại từ `/contact`. Người đã đăng nhập gửi thẳng từ landing (303 `/?asked=1#ask`). Có test cho cả hai luồng. Hai cách khác nếu Owner muốn một bước: (a) cho phép `challenges.cloudflare.com` trên landing (sửa test AC2 của VNX-0709, chỉ cần bỏ prop `widget={false}` trong `LandingPage.tsx`), hoặc (b) thêm một script cùng origin để tải Turnstile khi người dùng bắt đầu điền form (thêm JS, trái design doc §2.6).
- **D2:** số tin `new` cạnh mục "Feedback" trong admin nav chỉ hiện trên các trang `/admin/feedback` và `/admin/feedback/:id` (đếm thật qua `countFeedback`). Các trang admin khác vẫn có mục Feedback nhưng không có số, vì `AdminLayout` là view (không đọc DB) và có 21 chỗ gọi. Muốn có số ở mọi trang admin thì phải truyền prop qua toàn bộ các trang đó hoặc thêm một cơ chế context; phần này để Reviewer quyết.
- **D3:** breakpoint chuyển header sang menu được nâng từ `899px` lên `1159px`, và thêm `white-space: nowrap` cho mục nav và nút trong header. Lý do: thêm mục thứ 5 (Contact) làm nhãn tiếng Việt xuống dòng ở 900–1150 px. Đây là CSS của VNX-0709; không test nào ghim breakpoint.
- **D4:** câu Privacy VI, dòng Kiểm tra bot: trên `main` câu đang là "khi bạn gửi **yêu cầu** mà chưa đăng nhập" (không phải "Inquiry" như plan ghi). Đã sửa thành "khi bạn gửi yêu cầu hoặc tin nhắn liên hệ mà chưa đăng nhập", giữ đúng nghĩa như plan cho phép.
- **D5 (copy chưa có trong plan):** cần câu cho trạng thái "Turnstile chưa cấu hình" (form không hiện, POST trả 503). Đã thêm key `contact.form.unavailable`: EN "The form can't be sent without an account right now. Sign in, or write to us by email.", VI "Hiện chưa gửi được form khi chưa đăng nhập. Hãy đăng nhập, hoặc gửi email cho chúng tôi.", kèm bản zh. Lỗi tên quá 100 ký tự hoặc có ký tự điều khiển dùng lại key đã duyệt `inquiry.error.too_long` / `inquiry.error.invalid`. Nhãn admin (Feedback, New, Handled, Spam, Mark handled, Mark as spam, Reopen, Email not sent yet, Reply by email) được dịch theo mẫu admin hiện có; thêm vài nhãn cột (Received, Sender, Message, Status, Page language, All messages) và câu khi danh sách rỗng.
- **D6:** nhãn message: plan ghi "Your message · 20 to 2000 characters". Đã tách thành label "Your message" và gợi ý "20 to 2000 characters" bên dưới ô; nghĩa không đổi. Câu ghi chú bên cạnh tách thành `contact.side.email` ("Prefer email? Write to {email}.") và `contact.side.reply`; ghép lại đúng nguyên văn plan, địa chỉ email là link `mailto:`.
- **D7:** trong `test/contact/page.test.ts`, helper `textOf` bỏ thẻ `<a>` mà không chèn khoảng trắng. Lý do: địa chỉ email là link nằm giữa câu. Ngoài ra, script Turnstile được `hono/jsx` đưa lên `<head>` (giống form Inquiry M5), nên test kiểm nó trong `<head>` và chỉ xuất hiện một lần.
- **D8:** ô kind là `<select>` không có option rỗng (mặc định "Question"), để không phải tự đặt thêm copy cho option trống. Server vẫn kiểm giá trị (có test). Ô role là radio, không có giá trị mặc định nên bắt buộc chọn.
- Email tới `contact@vnx.si` được viết bằng tiếng Anh, có thêm câu mở đầu "New message from the contact form. Reply to this e-mail to answer the sender." Câu này chỉ admin đọc.

## 8. Ghi chú kỹ thuật

- Thứ tự xử lý POST đúng plan: Origin (middleware) → honeypot → zod → Turnstile (chỉ khi chưa đăng nhập) → rate limit `contact:ip:<ip>` 5/3600 s → lưu → email → 303. Lỗi được render lại trên `/contact` với `from=contact`.
- Kiểm tra email dùng `WAITLIST_EMAIL_RE`, tối đa 254 ký tự, chuyển về lowercase. Message được trim sau khi đổi CRLF thành LF.
- Đổi trạng thái: `feedbackTransition` (domain), sau đó `db.batch([compare-and-set …, auditStatement(… guard feedbackId)])`. Handle và spam đặt `handled_at`/`handled_by`; reopen xóa hai cột này.
- Test chạy chung storage D1 giữa các file và các lần chạy, nên test DB dùng mốc thời gian ở tương lai xa và kiểm theo id.
- Thứ tự deploy: `0009_feedback.sql` phải được migrate trước khi deploy code (`/contact` và `/admin/feedback` đọc/ghi bảng `feedback`). Không sửa comment thứ tự deploy trong `wrangler.jsonc` vì nằm ngoài phạm vi (handoff chỉ cho sửa `TURNSTILE_SITE_KEY`). Đề nghị Reviewer ghi vào nghĩa vụ go-live.

## 9. Câu hỏi mở

1. D1: giữ landing không có widget Turnstile (gửi từ landing khi chưa đăng nhập cần thêm một bước trên `/contact`), hay cho phép tải Turnstile trên landing (sửa VNX-0709 AC2)?
2. D2: có cần số tin `new` ở mục Feedback trên mọi trang admin không?
3. D5: Owner duyệt câu `contact.form.unavailable` và các nhãn admin mới.

---

## Lượt sửa F1 (2026-10-05)

- **Phát hiện:** F1 (MEDIUM) trong `.ai/reviews/VNX-0710-0711-review.md`. Owner chọn cách sửa: tải Turnstile trên landing cho form `#ask`. Chỉ sửa F1; F2–F4 giữ nguyên.
- **Commit:**
  - `204eb13` test(web): Turnstile on the landing Ask us form, one allowed external origin (VNX-0710 F1). Test viết trước.
  - `c6fcf8b` fix(web): Turnstile on the landing Ask us form so a signed-out send succeeds first time (VNX-0710 F1)
  - (commit này) docs: VNX-0710 report, fix round F1

### Thay đổi

- `src/views/contact/ContactForm.tsx`: bỏ prop `widget`. Form render widget và script Turnstile y như trên `/contact` khi chưa đăng nhập và có site key. Khi Turnstile chưa cấu hình (không có site key hoặc secret), form hiện thông báo fail-closed (`contact.form.unavailable`, link Đăng nhập, `mailto:contact@vnx.si`) thay cho form. Hành vi này có sẵn trong component nên áp cho cả landing.
- `src/views/LandingPage.tsx`: bỏ `widget={false}`.
- `test/design/assets.test.ts` (VNX-0709 AC2): gom phần kiểm vào hàm `thirdPartyRequests(html)`. Ngoại lệ duy nhất là một `<script>` có `src` đúng bằng `https://challenges.cloudflare.com/turnstile/v0/api.js`. Thêm `/contact` vào danh sách trang được kiểm. Thêm test trên HTML mẫu cho thấy các trường hợp khác vẫn bị bắt: script reCAPTCHA; host giả `challenges.cloudflare.com.evil.example`; script khác trên `challenges.cloudflare.com`; stylesheet hoặc preconnect ra ngoài; `og:image` ở CDN ngoài; `<img>` tracker; `<iframe>` tới `challenges.cloudflare.com`.
- `test/landing/page.test.ts`:
  - chưa đăng nhập: `#ask` có widget, và script nằm trong `<head>` đúng một lần (×4 locale);
  - đã đăng nhập: không có widget, không có `challenges.cloudflare.com`;
  - không cấu hình Turnstile: `#ask` không có `<form>`, có thông báo và `mailto:`, không có script, còn form waitlist vẫn hiện (×4 locale).
- `test/contact/submit.test.ts`: với mỗi locale, landing có widget, và POST từ landing (`from=landing`) kèm token giả hợp lệ trả 303 về `/?asked=1#ask`, `/vi/?asked=1#ask`, `/zh-hans/?asked=1#ask` hoặc `/zh-hant/?asked=1#ask` ngay lần đầu; mỗi lần đúng 1 dòng `feedback`, tổng 4 email. Test "không có token → 400 trên `/contact`" vẫn giữ.

### Test đỏ trước khi sửa (sau `204eb13`)

```
$ npx vitest run test/design/assets.test.ts test/landing test/contact
     × the landing form carries the widget, and a valid token gets 303 to the landing #ask on the first send, in each locale
     × VNX-0710 AC5: the #ask block has the eyebrow, title, lead and the contact form posting to /contact with from=landing
     × VNX-0710 F1: signed out, the landing loads the Turnstile script once, in <head>
 Test Files  2 failed | 4 passed (6)
      Tests  3 failed | 79 passed (82)
```

Hai nhóm test xanh ngay từ đầu:
- Test "không cấu hình Turnstile → thông báo trong `#ask`": `ContactForm` đã fail-closed trước khi xét prop `widget`, nên landing vốn đã đúng; test giữ lại hành vi này.
- Các test của `assets.test.ts`: landing lúc đó chưa tải script ngoài nào, và bộ kiểm mới phải từ chối mọi host khác ngay từ đầu.

### Kết quả sau khi sửa

```
$ git merge-base --is-ancestor origin/main HEAD && echo ancestor-ok
ancestor-ok

$ npm run typecheck -w apps/web
📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.
exit=0   (tsc không in lỗi)

$ npm test
 Test Files  88 passed (88)
      Tests  644 passed (644)

$ vitest run test/design/assets.test.ts test/landing/page.test.ts test/contact
 Test Files  4 passed (4)
      Tests  65 passed (65)
```

Số test: 640 → 644.

### Ghi chú

- Mục 7 D1 của báo cáo đã đóng theo lựa chọn của Owner. Landing nay có đúng một request bên thứ ba (script Turnstile, chỉ khi chưa đăng nhập và có site key). Mọi trang khác không đổi.
- Lượt này không chụp lại ảnh giao diện. Khối `#ask` nay hiện ô widget Turnstile giữa ô đồng ý và nút gửi, giống thẻ form trên `/contact` (đã có trong ảnh của Reviewer). AC14 cho `#ask` vẫn chờ Reviewer xem lại.
