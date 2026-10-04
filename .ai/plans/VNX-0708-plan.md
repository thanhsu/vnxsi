# VNX-0708 — Landing định vị · Plan

- **Trạng thái:** APPROVED bởi Owner 2026-10-04
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M7, task mới VNX-0708 (kéo lên làm ngay sau khi merge M4; Owner duyệt thiết kế 2026-10-04)
- **Spec:** Wave 1 mục 1 (định vị), 5.8 (landing cũ), 5.9 khối 8–11 (4 ways, huy hiệu, khối builder, CTA), 8.2 (rate limit), 8.8 (SEO)
- **ADR:** ADR-001 (SSR trên Worker), ADR-003 (4 locale), ADR-004 (không bịa số, xếp hạng không bán)
- **Phụ thuộc:** M4 đã merge vào `main` (`d297c72`; sitemap ở `src/routes/seo.ts`, nav ở `Layout.tsx`)
- **Implementer / Reviewer:** agent riêng / Claude

## Vì sao làm bây giờ

Production `vnx.si` vẫn là landing trước pivot ("VNX — Something new is coming", hướng agent platform cũ). Owner muốn một landing nói rõ định vị marketplace, với hai lối vào: builder đăng ký thật và client để lại email. Homepage đầy đủ (VNX-0703/0704) để sau.

## Phạm vi

**Trong phạm vi**
- Trang `/` render server cho 4 locale (`/`, `/vi`, `/zh-hans`, `/zh-hant`), thay `public/index.html`.
- Form waitlist cho client (HTML POST, không JS), lưu vào bảng `waitlist` có sẵn.
- Gỡ endpoint JSON `/api/waitlist` và code chỉ phục vụ nó.
- SEO cho `/`: title, description, canonical, hreflang, Open Graph, JSON-LD `Organization`; sitemap liệt kê `/` theo 4 locale.
- Chuỗi giao diện ở 4 file locale.

**Ngoài phạm vi**
- Homepage có số liệu (VNX-0703/0704), `/for-builders`, `/terms`, `/privacy` (VNX-0705).
- Turnstile cho form (làm cùng VNX-0502; form này có honeypot + rate limit).
- Gửi email cho người trong waitlist; trang hủy đăng ký.
- Ảnh Open Graph.
- Xóa `apps/web/drafts/` và bảng `waitlist` (giữ nguyên).
- Deploy production (xem "Điều kiện go-live").

## Thiết kế

### Route

| Route | Handler | Ghi chú |
|---|---|---|
| `GET /` ×4 locale | `src/routes/landing.tsx` | `onLocalized(app, "get", "/", …)` (helper đã xử lý `/vi` và `/vi/`). Đọc `?joined=1` để hiện thông báo thành công |
| `POST /waitlist` ×4 locale | `src/routes/landing.tsx` | Kiểm form → rate limit → lưu → `303` về `localizedPath(locale, "/") + "?joined=1#notify"`. Lỗi → render lại trang, giữ email đã nhập, lỗi ở ô, status 400 (429 khi vượt rate limit) |

- Xóa `public/index.html`. `app.notFound` vẫn chuyển các path EN không khớp route sang `ASSETS` (giữ `/assets/app.css`).
- Xóa dòng `app.all("/api/waitlist", …)` trong `src/app.ts`; `/api/*` còn lại vẫn trả 404 JSON.
- Origin check có sẵn áp dụng cho `POST /waitlist`.

### Dữ liệu (không có migration)

- Bảng `waitlist` (0001, 0002) không có CHECK ở `personas` và `lang`.
- Dòng mới: `personas = '["client"]'`, `lang` = mã locale (`en`, `vi`, `zh-Hans`, `zh-Hant`), `consent_at = now`, `country = request.cf.country`, `referrer` = host của header `Referer` nếu khác host site (không lưu path), `utm_*` từ query của trang `/` lúc render (truyền qua input ẩn, mỗi giá trị ≤ 200 ký tự). `message`, `spend_band` = null.
- Email đã có trong bảng: **thêm** `client` vào `personas` nếu chưa có (giữ các vai cũ như `developer`), cập nhật `consent_at`, `lang`, `updated_at`. Không báo lỗi trùng; người dùng thấy cùng thông báo thành công (không lộ email nào đã đăng ký).

### Module và file

| File | Thay đổi |
|---|---|
| `src/domain/waitlist-input.ts` (mới) | zod schema form: `email` (trim, lowercase, ≤254, cùng regex email đang dùng), `consent` phải là `"on"`, `website` (honeypot), `utm_source`/`utm_medium`/`utm_campaign` (tùy chọn, ≤200). Trả `{ ok, entry }` hoặc lỗi theo field. Không import Hono/D1 |
| `src/db/waitlist.ts` (mới) | `addClientSignup(db, entry, now)`: một câu `INSERT … ON CONFLICT(email) DO UPDATE` gộp persona như trên |
| `src/routes/landing.tsx` (mới) | 2 handler ở bảng Route; rate limit `hitRateLimit(db, "waitlist:ip:<ip>", 10, 3600, now)` (mức Inquiry, spec 8.2); honeypot có giá trị → `303` thành công giả, không lưu |
| `src/views/LandingPage.tsx` (mới) | JSX thuần, nhận props `{ locale, origin, signedIn, joined, form?: { email, error? }, utm }` |
| `src/app.ts` | Đăng ký `registerLandingRoutes`; gỡ `/api/waitlist` |
| `src/routes/seo.ts` | `{ rest: "/", localized: true }` |
| `src/views/Layout.tsx` | Không đổi, trừ khi cần class cho `<main>` toàn chiều rộng (chỉ thêm prop tùy chọn, không đổi hành vi trang khác) |
| `public/assets/app.css` | Style cho landing, dùng token có sẵn (sáng/tối), không thêm font hay thư viện |
| `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` | Key `landing.*` (bảng nội dung bên dưới) |
| Xóa | `public/index.html`, `src/waitlist.ts`, `src/routes/waitlist.ts`, `test/waitlist.test.ts`, 2 ca `/api/waitlist` trong `test/app.test.ts` |
| `test/architecture.test.ts` | Bảng ghi: `waitlist` → `../src/db/waitlist.ts` |

### Trang

Thứ tự khối (mỗi khối một `<section>` có heading):
1. **Hero:** `h1` = câu định vị; 2 dòng phụ cho client và builder; 2 nút: **Become a builder** → nếu chưa đăng nhập: `localizedPath(locale, "/login") + "?next=" + encodeURIComponent(localizedPath(locale, "/hub/apply"))`; nếu đã đăng nhập: `localizedPath(locale, "/hub")`. **Get notified** → `#notify`.
2. **4 ways:** Buy / Customize / Hire the builder / Build similar, mỗi mục một câu.
3. **Huy hiệu:** Listed / Demo verified / In production, mỗi mục một câu nói đã kiểm gì; màu theo `05-UI-SCOPE.md`.
4. **For builders:** đoạn ngắn + nút giống hero + dòng về invite link.
5. **For clients** (`id="notify"`): đoạn ngắn + form (email, checkbox đồng ý, honeypot ẩn khỏi người dùng và trình đọc màn hình, nút gửi). Khi `joined=1`: thay form bằng thông báo thành công (`role="status"`).
6. **Principle:** "Rankings are never for sale." + một câu giải thích.

Không có con số, thẻ product mẫu, testimonial, logo hay ảnh minh họa có người. Thân trang không link tới `/products`, `/builders` (nav ở header giữ nguyên như M4).

Hợp lệ a11y: một `h1`; label cho mọi input; lỗi gắn `aria-describedby`; vùng chạm ≥ 44 px; bố cục 1 cột ≤ 640 px; tôn trọng `prefers-reduced-motion` (nếu có hiệu ứng).

### Nội dung (EN là chuẩn; VI do Reviewer viết; `zh-Hans`/`zh-Hant` Implementer dịch từ EN, người bản xứ đọc lại ở VNX-0801)

| Key | EN | VI |
|---|---|---|
| `landing.meta.title` | VNX.SI — The marketplace for AI-built products | VNX.SI — Chợ sản phẩm xây bằng AI |
| `landing.meta.description` | Find software built with AI, customize it, or hire the builder who made it. Builders list for free. | Tìm phần mềm được xây bằng AI, tùy chỉnh nó, hoặc thuê chính người đã xây. Builder đăng sản phẩm miễn phí. |
| `landing.hero.title` | The marketplace for AI-built products and the people who build them. | Chợ cho sản phẩm xây bằng AI và những người xây chúng. |
| `landing.hero.client` | Have an idea? Find a product, customize one, or build your own. | Có ý tưởng? Tìm sản phẩm có sẵn, tùy chỉnh, hoặc xây mới. |
| `landing.hero.builder` | Build once. Sell many times. Get hired to customize. | Xây một lần. Bán nhiều lần. Được thuê để tùy chỉnh. |
| `landing.cta.builder` | Become a builder | Trở thành builder |
| `landing.cta.notify` | Get notified | Nhận thông báo |
| `landing.ways.title` | Every product opens four ways to work together | Mỗi sản phẩm mở ra bốn cách hợp tác |
| `landing.ways.buy.title` / `.body` | Buy / Use the product as it is. | Mua / Dùng ngay sản phẩm như hiện có. |
| `landing.ways.customize.title` / `.body` | Customize / Like it but need changes? Ask the builder to adapt it. | Tùy chỉnh / Thích nhưng cần sửa? Nhờ builder điều chỉnh. |
| `landing.ways.hire.title` / `.body` | Hire the builder / Work with the person who built it on your own project. | Thuê builder / Làm việc với chính người đã xây nó cho dự án của bạn. |
| `landing.ways.similar.title` / `.body` | Build similar / Get a product like this one, made for your business. | Xây tương tự / Có một sản phẩm giống vậy, làm riêng cho doanh nghiệp của bạn. |
| `landing.badges.title` | Verification you can read | Xác minh đọc được |
| `landing.badges.intro` | Each badge says what was checked. No stars, no made-up scores. | Mỗi huy hiệu nói rõ đã kiểm gì. Không chấm sao, không điểm số bịa. |
| `landing.badges.listed` | Listed: reviewed by our team before going public. | Listed: đội ngũ VNX.SI đã duyệt trước khi công khai. |
| `landing.badges.demo` | Demo verified: we opened the demo and it works. Changing the demo link removes the badge. | Demo verified: chúng tôi đã mở demo và nó chạy. Đổi link demo thì mất huy hiệu. |
| `landing.badges.production` | In production: real customers use it, and we checked the evidence. | In production: có khách hàng thật đang dùng, và chúng tôi đã kiểm bằng chứng. |
| `landing.builders.title` | For builders | Dành cho builder |
| `landing.builders.body` | AI made building software faster. VNX.SI helps you sell what you build: list your product for free, get a public product page, and meet clients who want it customized. | AI giúp xây phần mềm nhanh hơn. VNX.SI giúp bạn bán thứ mình xây: đăng sản phẩm miễn phí, có trang sản phẩm công khai, gặp khách cần tùy chỉnh. |
| `landing.builders.invite` | Got an invite link? Open it first and you're approved right away. | Có link mời? Mở link đó trước, bạn được duyệt ngay. |
| `landing.clients.title` | Looking for software? | Bạn đang tìm phần mềm? |
| `landing.clients.body` | The marketplace opens to clients once enough verified products are listed. Leave your email and we'll tell you when. | Chợ sẽ mở cho khách khi đã có đủ sản phẩm được kiểm duyệt. Để lại email, chúng tôi báo bạn khi mở. |
| `landing.form.email` | Email | Email |
| `landing.form.consent` | VNX.SI may store my email to tell me when the marketplace opens. | VNX.SI được lưu email của tôi để báo khi chợ mở. |
| `landing.form.submit` | Notify me | Báo cho tôi |
| `landing.form.joined` | Thanks. We'll email you when the marketplace opens. | Cảm ơn bạn. Chúng tôi sẽ email khi chợ mở. |
| `landing.form.error.email` | That email address doesn't look right. | Email chưa đúng định dạng. |
| `landing.form.error.consent` | Please tick the box so we can store your email. | Bạn cần đánh dấu ô đồng ý để chúng tôi lưu email. |
| `landing.form.error.rateLimited` | Too many attempts. Please try again in an hour. | Thử quá nhiều lần. Vui lòng thử lại sau một giờ. |
| `landing.principle.title` | Rankings are never for sale. | Thứ hạng không bao giờ được bán. |
| `landing.principle.body` | Products are ordered by what we can verify, not by who pays. | Sản phẩm được xếp theo những gì chúng tôi kiểm được, không theo ai trả tiền. |

Implementer không thêm câu quảng cáo nào ngoài bảng này. Cần câu mới thì hỏi Reviewer.

### JSON-LD

`{"@context":"https://schema.org","@type":"Organization","name":"VNX.SI","url":"<APP_ORIGIN>/"}`. Không `logo`, không `sameAs`, không `aggregateRating`.

## Tiêu chí chấp nhận → cách kiểm

Mọi lệnh chạy từ gốc repo.

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `GET /`, `/vi`, `/vi/`, `/zh-hans`, `/zh-hant` trả 200 HTML do Hono render (có `lang` đúng locale), không phải `public/index.html` | `test/landing/page.test.ts` |
| AC2 | Trang có canonical theo `APP_ORIGIN`, 4 hreflang + `x-default`, `og:title`, `og:description`, JSON-LD `Organization` đúng dạng | `test/landing/page.test.ts` |
| AC3 | Nút builder: chưa đăng nhập → `/vi/login?next=%2Fvi%2Fhub%2Fapply` (ở `/vi`); đã đăng nhập → `/vi/hub` | `test/landing/page.test.ts` |
| AC4 | Trang không chứa chữ số nào trong thân `<main>` (không số liệu) | `test/landing/page.test.ts` (regex `\d` trên nội dung `<main>` đã bỏ thẻ) |
| AC5 | POST hợp lệ → 303 về `/<prefix>?joined=1#notify`; có dòng `waitlist` với `personas = ["client"]`, `lang` đúng locale, `consent_at` có giá trị | `test/landing/waitlist.test.ts` |
| AC6 | Email đã có với `["developer"]` → sau POST là `["developer","client"]`; POST lần hai không nhân đôi `client` | `test/landing/waitlist.test.ts` |
| AC7 | Email sai / thiếu đồng ý → 400, trang hiện lại email đã nhập và lỗi theo locale; không có dòng mới | `test/landing/waitlist.test.ts` |
| AC8 | Honeypot có giá trị → 303 thành công, không có dòng | `test/landing/waitlist.test.ts` |
| AC9 | Lần POST thứ 11 trong một giờ từ cùng IP → 429 với lỗi rate limit | `test/landing/waitlist.test.ts` |
| AC10 | POST thiếu `Origin` khớp → 403 | `test/landing/waitlist.test.ts` |
| AC11 | `?joined=1` → hiện thông báo thành công thay cho form | `test/landing/page.test.ts` |
| AC12 | `/api/waitlist` → 404 JSON; `public/index.html`, `src/waitlist.ts`, `src/routes/waitlist.ts` không còn | `test/app.test.ts`; `git ls-files apps/web/public/index.html apps/web/src/waitlist.ts apps/web/src/routes/waitlist.ts` trả rỗng |
| AC13 | Sitemap có `/`, `/vi/`, `/zh-hans/`, `/zh-hant/` kèm hreflang | `test/seo/sitemap.test.ts` |
| AC14 | Test kiến trúc xanh với bảng ghi mới; parity i18n xanh | `npm test` |
| AC15 | Toàn bộ test và typecheck xanh | `npm test` và `npm run typecheck -w apps/web` |
| AC16 | Dark mode và mobile 360 px dùng được (không tràn ngang, tương phản đủ) | Reviewer mở `npm run dev`, xem `/` và `/vi` ở 360 px và 1280 px, sáng và tối |

## Điều kiện go-live (không thuộc task này)

Landing có nút builder dẫn tới `/login`, nên chỉ lên production khi `main` deploy được đầy đủ, theo thứ tự trong `apps/web/wrangler.jsonc`: Owner bật R2 → tạo bucket `vnxsi-media` → `db:migrate:remote` → xác minh domain Resend, đặt `RESEND_API_KEY` và `ADMIN_EMAILS` → `npm run deploy`. Trước đó chỉ chạy ở local.

## Sai khác roadmap / spec (Owner duyệt cùng plan)

- Thêm task VNX-0708 vào M7, làm trước M5–M6.
- Spec 5.8 ghi "gỡ `/api/waitlist`, `src/waitlist.ts`": vẫn gỡ, nhưng **giữ waitlist cho client** qua form mới ghi vào bảng cũ.
- VNX-0703/0704 (homepage có số liệu), khi làm, sẽ thay landing này ở `/`; VNX-0706 (cutover) chỉ còn phần chưa làm ở đây.

## Câu hỏi mở

- OQ-1 (không chặn task này, chặn go-live): Production thu email khi chưa có trang `/privacy`. Landing cũ cũng vậy. Chấp nhận tới VNX-0705, hay làm `/privacy` tối thiểu trước khi go-live? (Reviewer khuyên: làm `/privacy` trước go-live, có thể gộp vào lượt deploy.)
