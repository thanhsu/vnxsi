# VNX-0803 — Review bảo mật toàn nhánh

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Phạm vi:** toàn bộ `apps/web` trên nhánh `feat/epic21-partner-slice` tại `488df8c` (kèm working tree Task 2d của EPIC 21), `wrangler.jsonc`, `.github/workflows/*`, `.gitignore`, tài liệu vận hành (`CURRENT-STATUS.md`, `privacy.md`). Đối chiếu spec Wave 1 §8.2, §8.5, §8.6, NFR §Bảo mật, ADR-002, ADR-007.
- **Đã đọc:** `index.ts`, `app.ts`, `env.ts`, toàn bộ `auth/`, `http/`, `routes/` (auth, join, hub*, me*, admin*, inquiry/request form + confirm, contact, landing, catalog, directory, media, seo, product/builder page), `db/` (sessions, tokens, users, catalog, directory, offers, merchants, flags, audit, verifications, waitlist), `domain/` (offer-url, offer, catalog, builder-input, inquiry, request, image, text), `email/*`, `notify/*`, `jobs/daily.ts`, `views/` (Layout, render, json-ld, auth, PlainText, các link ngoài), `public/assets/landing.js`, migrations `0003`, `0011`.
- **Lệnh đã chạy lại:**
  - `npm audit --omit=dev` → `found 0 vulnerabilities`
  - `npm run typecheck -w apps/web` → sạch
  - `npm test` → `Test Files 116 passed (116)`, `Tests 1019 passed (1019)`

## Verdict

**APPROVE WITH CHANGES** — không có BLOCKER trong code. Một phát hiện HIGH là nghĩa vụ vận hành còn treo (xoay secret), ba MEDIUM nên làm trước khi M7 đưa `/go/` lên production, còn lại LOW / SUGGESTION.

## Những gì đã kiểm và đạt

| Mảng | Kết luận | Bằng chứng |
|---|---|---|
| Magic link, session | Token 32 byte ngẫu nhiên, DB chỉ lưu SHA-256, 15 phút, dùng một lần bằng một câu `UPDATE … RETURNING` (không race); GET `/auth/verify` chỉ xem, POST mới tiêu token; cookie `__Host-vnx_session` HttpOnly, Secure, SameSite=Lax, 30 ngày, DB lưu hash; user `suspended` bị từ chối ở mỗi request và mất session khi bị khóa | `auth/tokens.ts:58-86`, `auth/cookies.ts:13`, `auth/sessions.ts:21-30`, `routes/auth.tsx:118-138`, `routes/admin-users.tsx:46` |
| Admin | `requireAdmin` kiểm cả `is_admin` lẫn `ADMIN_EMAILS` ở mỗi request; mọi route `/admin/*` (builders, products, badges, inquiries, requests, feedback, invites, users, flags, merchants/programs/offers) đều qua `requireAdmin`; admin không tự khóa mình | `auth/middleware.ts:37-43`, `routes/admin-*.tsx` |
| CSRF | Mọi method không an toàn phải có `Origin` khớp request hoặc `APP_ORIGIN`, 403 nếu không | `http/origin.ts:16-23`, `app.ts:46` |
| Open redirect | `next` chỉ nhận đường dẫn cùng site; chặn `//`, `\`, control char, decode hai lớp | `http/next.ts` |
| SQL | Mọi giá trị người dùng đều bind; fragment động chỉ ghép từ hằng số; `LIKE` có `ESCAPE '\'` và escape `% _ \`; FTS5 chỉ nhận phrase đã quote; `LIMIT/OFFSET` từ số nguyên đã kiểm | `db/catalog.ts:31-84`, `db/directory.ts:47-77`, `db/users.ts:53-63`, `domain/catalog.ts:73-88` |
| XSS | JSX của Hono escape toàn bộ; `raw()` duy nhất là JSON-LD với escape `< > & U+2028 U+2029`; không `innerHTML`/`eval` ở client; email escape mọi giá trị; nội dung người dùng là văn bản thuần | `views/json-ld.ts`, `email/escape.ts`, `email/parts.ts`, `views/PlainText.tsx` |
| Authz / IDOR | `/hub/*` lấy dữ liệu theo `builder.userId` (`findOwnedProduct`, `findPortfolioItem`, `findBuilderInquiry`, `findBuilderInvitation`); `/me/*` theo `user.id` (`findClientInquiry`, `findClientRequest`); chọn đề xuất chỉ trong lời mời của chính request; offer/program luôn kiểm thuộc merchant trong cả route lẫn câu SQL | `routes/hub-products.tsx:27-32`, `routes/hub-portfolio.tsx:25-28`, `routes/hub-inquiries.tsx:27-30`, `routes/me-requests.tsx:85`, `db/offers.ts:73-77,99-104` |
| Upload ảnh | Magic bytes, ≤ 2 MB (kiểm Content-Length trước khi buffer), ≤ 8 ảnh, key ULID, `nosniff`, chỉ JPEG/PNG/WebP (không SVG) | `domain/image.ts`, `routes/hub-media.tsx:36-50`, `routes/media.ts:9-21` |
| URL ra ngoài | Builder/product/portfolio: chỉ `https://`, không userinfo, `rel="nofollow ugc noopener"`. Partner `/go/`: `https://` thường, host trong allow-list (match đúng hoặc subdomain), không IP/userinfo/port/`localhost`, placeholder chỉ sau host, validate hai lần, re-validate sau khi gắn UTM | `domain/builder-input.ts:66-73`, `domain/offer-url.ts`, `domain/offer.ts:329-332,378-418` |
| Rate limit, bot | Đúng số của spec §8.2 (đăng nhập 5/giờ/email, 20/giờ/IP; Inquiry 10/giờ/IP + 5/giờ/email; request 3/ngày/email, 10/giờ/IP; contact và waitlist 10/giờ/IP); Turnstile fail closed, driver giả chỉ khi `MAIL_DRIVER=fake`; honeypot; không lộ trạng thái tài khoản | `routes/auth.tsx:98-99`, `routes/inquiry-form.tsx:105-130`, `routes/request-form.tsx:78-100`, `http/turnstile.ts:12-25` |
| Secret, CI | Không secret trong repo; `.dev.vars`, `worker-configuration.d.ts` bị ignore; `gitleaks` + `dependency-review` trong CI; `npm audit` 0 | `.gitignore`, `.github/workflows/security-ci.yml` |
| Log, riêng tư | Log không ghi email (hash hoặc id); cron xóa token/session hết hạn, bộ đếm > 2 ngày, Inquiry/request/tài khoản ngầm chưa xác nhận > 48 giờ đúng như Privacy page; builder không thấy email client | `routes/inquiry-form.tsx:140`, `notify/*.ts`, `jobs/daily.ts:160-174` |

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | HIGH (vận hành) | `.ai/context/CURRENT-STATUS.md:164` | `RESEND_API_KEY` và `TURNSTILE_SECRET` đã dán vào hội thoại 2026-10-04; production chạy từ 2026-10-05; chưa thấy ghi nhận đã xoay. Ai đọc được transcript gửi được email từ `noreply@vnx.si` và qua mặt Turnstile. | Owner xoay ngay: Resend tạo key mới rồi thu hồi key cũ; Turnstile "Rotate secret key" ở widget `vnx.si`; `npx wrangler secret put` cả hai (trong `apps/web`); ghi ngày xoay vào `CURRENT-STATUS.md`. Cùng lúc làm mục PAT GitHub ở dòng 187. |
| F2 | MEDIUM | `apps/web/src/app.ts:44-48` | Không có header bảo mật toàn app: thiếu `Content-Security-Policy`, `frame-ancestors`/`X-Frame-Options` (clickjacking các form POST ở `/admin`, `/hub`, `/me`: Origin check không chặn vì request từ iframe vẫn same-origin), `Referrer-Policy` (chỉ `/join` có; token `?t=` nằm trên URL GET `/auth/verify`), `X-Content-Type-Options` cho HTML, `Permissions-Policy`. HSTS không đặt từ app, chưa kiểm được ở zone. | Thêm middleware `securityHeaders` ngay sau `requestId`. CSP khả thi vì không có script inline (JSON-LD là data block) và chỉ một `style=` inline ở `views/LegalPage.tsx:41` (đổi swatch sang class / custom property để không cần `'unsafe-inline'`): `default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Thêm `Referrer-Policy: strict-origin-when-cross-origin` (riêng `/auth/verify`: `no-referrer`), `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. HSTS bật ở Cloudflare zone (Owner kiểm Dashboard → SSL/TLS → Edge Certificates). Test: một test route kiểm đủ header trên `/`, `/login`, `/auth/verify`, `/vi/products`. |
| F3 | MEDIUM | `apps/web/src/auth/middleware.ts:37-43`, `auth/sessions.ts:3` | Admin chỉ dựa một yếu tố (hộp thư nhận magic link), session 30 ngày như người dùng thường, không hỏi lại trước hành động nhạy cảm, không có "đăng xuất mọi thiết bị". Hộp thư admin bị chiếm = toàn quyền duyệt builder, cấp huy hiệu, đổi đích redirect `/go/`. ADR-002 chấp nhận magic link cho người dùng; chưa nói gì về admin. | Owner chọn một: (a) Cloudflare Access (Zero Trust) chặn `/admin/*` và `/{vi,zh-hans,zh-hant}/admin/*` trước Worker, không đụng code, cần ghi ADR bổ sung; hoặc (b) session admin ngắn hơn (ví dụ 12 giờ: khi `isAdmin` thì kiểm `sessions.created_at`), audit `auth.login` của admin kèm IP, nút "đăng xuất mọi thiết bị" ở `/admin`. Khuyến nghị (a). |
| F4 | MEDIUM | mọi `c.req.parseBody()` ngoài media, ví dụ `routes/auth.tsx:88`, `routes/contact.tsx:77`, `routes/request-form.tsx:68`, `routes/hub-apply.tsx:34` | Không giới hạn kích thước body; chỉ `routes/hub-media.tsx:37` kiểm `Content-Length`. Một POST multipart ~100 MB tới `/contact` (không cần đăng nhập, chỉ cần header `Origin`) được buffer toàn bộ trong isolate (giới hạn 128 MB) → 500/OOM cho các request khác đang chạy cùng isolate; chi phí tấn công thấp. | Middleware chung sau `originCheck`: với method không an toàn, nếu `content-length` thiếu hoặc > 64 KB (trừ `/hub/products/:id/media`, đã có ngưỡng riêng) → 413. Lớp hai: WAF rule ở zone giới hạn body cho `vnx.si` ngoài đường upload. |
| F5 | LOW | `apps/web/wrangler.jsonc:24` | `workers_dev: true`: app công khai thêm ở `vnxsi-web.<account>.workers.dev`, né mọi rule WAF / HSTS / rate-limit đặt ở zone `vnx.si`. Cookie `__Host-` tách theo host nên không lẫn phiên; canonical vẫn `APP_ORIGIN`. | `workers_dev: false` khi custom domain đã ổn; preview dùng `wrangler dev` / versions. |
| F6 | LOW | `apps/web/src/email/console.ts:5`, `email/index.ts:12` | Driver `console` in cả nội dung email (link đăng nhập, link xác nhận) ra Workers Logs (observability đang bật). Không có chốt như Turnstile fake (ràng buộc `MAIL_DRIVER=fake`); đặt nhầm `MAIL_DRIVER=console` ở production là mọi magic link vào log. | Chỉ chấp nhận `console` khi không có `RESEND_API_KEY`, hoặc log `to` đã hash + subject, không log `text`. |
| F7 | LOW | `apps/web/src/media/r2.ts:8`, `routes/media.ts:17` | Ảnh giữ nguyên EXIF (có thể chứa GPS) vì không re-encode; `Cache-Control: immutable` 1 năm nên ảnh đã xóa còn trong cache trình duyệt / shared cache. Spec §8.5 chấp nhận "đọc được theo key". | Ghi vào Privacy ("ảnh tải lên giữ metadata của file") hoặc strip EXIF khi thêm resize ở wave sau. |
| F8 | LOW | `apps/web/src/http/no-store.ts:5`, `routes/contact.tsx:69`, `routes/request-form.tsx:110`, `routes/landing.tsx:33` | Trang công khai điền sẵn email / tên người đăng nhập nhưng không `no-store` (`noStorePrivate` chỉ phủ `/hub`, `/me`, `/admin`). Máy dùng chung, nút Back / bfcache có thể hiện lại. `CURRENT-STATUS` mới ghi nhận cho `/request`. | Trong `noStorePrivate`: thêm điều kiện `c.get("user") !== null` → `no-store` cho mọi trang khi đã đăng nhập. |
| F9 | LOW | `.gitignore` | `.claude/worktrees/` (worktree của agent, bản sao repo) không bị ignore; `git add -A` sẽ commit cả bản sao. | Thêm `.claude/worktrees/` vào `.gitignore`. |
| F10 | LOW | `.ai/context/CURRENT-STATUS.md:9,167` | Gmail cá nhân của Owner (giá trị `ADMIN_EMAILS`) nằm trong repo. Chấp nhận được khi repo private; nếu public hóa phải xóa khỏi lịch sử. | Thay bằng "(xem secret)"; từ nay không ghi giá trị secret / email cá nhân vào docs. |
| F11 | SUGGESTION | `apps/web/src/routes/auth.tsx:75-78`, `auth/tokens.ts:88-95` | Trang link hỏng phân biệt `used` / `expired` / `invalid` theo hash token. Token 256-bit nên không khai thác được; ghi để biết đây là chủ ý (UX VNX-0506). | Giữ. |
| F12 | SUGGESTION | `apps/web/src/auth/sessions.ts` | Người dùng không có "đăng xuất mọi thiết bị"; chỉ admin khóa user mới xóa hết session. | Để wave sau (cùng F3b nếu chọn). |
| F13 | SUGGESTION | `.github/workflows/security-ci.yml` | `dependency-review` chỉ chạy trên PR và chưa chạy được (Dependency graph chưa bật, `CURRENT-STATUS.md:186`); không có SAST. | Owner bật Dependency graph; thêm CodeQL `javascript-typescript` hoặc bước `npm audit --omit=dev --audit-level=moderate` trên push. |

## Đối chiếu NFR §Bảo mật (`docs/blueprint/02-NFR.md`)

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Mọi request đổi dữ liệu qua origin check; cookie `__Host-`; token/session chỉ lưu hash | ✓ | `http/origin.ts`, `auth/cookies.ts`, `auth/invite-cookie.ts`, `auth/sessions.ts`, `auth/tokens.ts` |
| Rate limit: đăng nhập 5/giờ/email, 20/giờ/IP; Inquiry 10/giờ/IP; request 3/ngày/email | ✓ | `routes/auth.tsx:98-99`, `routes/inquiry-form.tsx:105`, `routes/request-form.tsx:84,97` |
| Không bí mật trong repo; gitleaks trong CI; dependency-review chặn từ mức moderate | ✓ (một phần) | grep secret sạch, `.gitignore`; `security-ci.yml`; dependency-review chưa chạy được (F13) |
| Upload: magic bytes, ≤ 2 MB, chỉ JPEG/PNG/WebP | ✓ | `domain/image.ts`, `routes/hub-media.tsx` |
| Review bảo mật toàn nhánh trước deploy production lớn | ✓ | tài liệu này |

## Nghĩa vụ để lại cho task sau

- **Owner, ngay:** F1 (xoay Resend + Turnstile + PAT GitHub). Chỉ Owner làm được.
- **Task khắc phục nhỏ trước khi M7 đưa `/go/` lên production (đề xuất ID `VNX-0803-fix`, Implementer làm theo handoff):** F2 (security headers + test), F4 (giới hạn body), F8 (no-store khi đã đăng nhập), F6 (chốt driver console), F9 (`.gitignore`). Mỗi mục kiểm được bằng một test route hoặc `git check-ignore`.
- **Owner quyết:** F3 (Cloudflare Access cho `/admin` hay session admin ngắn), F5 (`workers_dev`), F7 (câu chữ Privacy về EXIF). F3 nếu chọn Access cần ADR bổ sung ADR-002.
- **Không đổi kiến trúc đã khóa:** mọi đề xuất trên nằm trong Worker + cấu hình Cloudflare, không chạm ADR-001/002/007.
