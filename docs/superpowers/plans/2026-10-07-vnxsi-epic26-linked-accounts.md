# VNX.SI EPIC 26 — Tài khoản liên kết Google, GitHub, LinkedIn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** Approved. Header và Task 1: Opus (Reviewer) APPROVE_WITH_CHANGES 2026-10-07, đã sửa theo F1–F10, S1, S2; Owner trả lời 2 câu hỏi mở ngày 2026-10-07. Task 2–12 chỉ có phạm vi ở bảng và đoạn "Phạm vi các task sau"; mỗi task được viết chi tiết ngay trước khi làm, từ code thật của nhánh.
- **Roadmap / Backlog:** `docs/roadmap/WAVE1-ROADMAP.md` → EPIC 26; `docs/blueprint/07-MASTER-BACKLOG.md` → EPIC 26, VNX-2601…2608 (tách VNX-2603 thành 2603a/b/c, VNX-2604 thành 2604a/b/c, VNX-2605 và VNX-2606 mỗi cái thành a/b; xem bảng thứ tự).
- **Nhánh:** `feat/epic26-linked-accounts`, tách từ `main`, trong worktree riêng (checkout chính của repo thuộc phiên khác). Nhánh tài liệu của plan này: `docs/epic26-plan`.
- **Thứ tự so với M8 (ra mắt):** Owner 2026-10-07: làm ngay trên nhánh, merge khi xong với cả ba cờ **tắt**; M8 không chờ EPIC 26; VNX-2608 (bật cờ) chỉ sau khi ra mắt ổn định.

**Goal:** Người dùng đã có tài khoản (đã đăng nhập bằng magic link ít nhất một lần) liên kết Google, GitHub hoặc LinkedIn từ `/me`, rồi đăng nhập bằng tài khoản đó ở `/login`. Magic link vẫn là cách duy nhất để tạo tài khoản và để có session vào `/ops`. Builder `approved` tự bật huy hiệu xác minh GitHub hoặc LinkedIn trên `/b/:handle`. Không tạo tài khoản bằng OAuth, không tự liên kết theo email, không lưu access/refresh token, không huy hiệu nào vào xếp hạng.

**Architecture:**
- Module mới `identity` (ADR-007 kiểu "một module sở hữu bảng"): `domain/identity.ts` thuần (provider, phương thức session, cờ theo provider, kiểu `UserIdentity`, tên action audit); `db/identities.ts` là nơi duy nhất ghi `user_identities`; `auth/sessions.ts` vẫn là nơi duy nhất ghi `sessions` (thêm cột `method`).
- Lõi OAuth tách ba lớp để test không cần mạng: `domain/oauth.ts` thuần (PKCE S256, `state`, `nonce`, dựng authorize URL, kiểm claim của ID token, payload cookie); `auth/oauth-cookie.ts` (cookie `__Host-vnx_oauth`); `auth/oauth/*` (port `OAuthProvider`, adapter Google / LinkedIn (OIDC) và GitHub (OAuth 2.0 + `GET /user`), nhận `fetch` tiêm vào) cùng `FakeOAuthProvider` cho test, chọn qua `getOAuthProvider(env, provider)` như `getMailer`.
- Đường HTTP không có tiền tố locale (như `/auth/verify`): `GET /auth/oauth/:provider/start`, `GET /auth/oauth/:provider/callback`. Liên kết đi qua `POST /me/identities/:provider/link` (Origin check, ghi intent vào cookie `__Host-vnx_oauth` gắn với session hiện tại) → 303 về cùng site `GET /auth/oauth/:provider/start` → trang trung gian 200 có một link sang provider (quyết định 14). Đăng nhập (`signin`) thì `start` 302 thẳng sang provider. Hủy liên kết là `POST /me/identities/:provider/unlink`.
- Session OAuth dùng lại `createSession` và cookie `__Host-vnx_session`; `sessions.method` mặc định `magic_link`. `requireOps` và `requireAdmin` chỉ nhận `magic_link` (quyết định 9).
- Cờ: ba khóa mới `oauth_google`, `oauth_github`, `oauth_linkedin` thêm vào `FLAG_KEYS` (không cần migration, xem EPIC 21 mục 2). Cờ tắt hoặc thiếu secret thì nút ẩn và callback 404.

**Tech Stack:** như M0–EPIC 21. **Không thêm dependency** (quyết định 2). Migration mới: `0017_user_identities.sql` (Task 1), chỉ thêm. Không chạy migration remote, không deploy, không đặt secret thật.

**Spec / ADR:** `docs/adr/ADR-012-oauth-linked-identities.md` (Accepted 2026-10-07; mục "Được bảo đảm bởi" là danh sách test bắt buộc). Spec Wave 1 `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`: 5.3 (`/hub`), 5.4 (`/me`), 8.2 (auth, Origin, rate limit), 8.3 (email), 8.7 (xếp hạng). ADR liên quan: ADR-002 (bị thay một phần), ADR-010 (bổ sung điều kiện session), ADR-004 (không vị trí trả tiền, huy hiệu không vào ranking), ADR-003 (parity i18n), ADR-001 (workerd, không SDK Node).

## Quyết định của Owner (2026-10-06 và 2026-10-07; ràng buộc)

- Bốn quyết định nghiệp vụ của ADR-012 (ngày 2026-10-06): liên kết để đăng nhập **và** huy hiệu (builder tự bật; liên kết của client không bao giờ hiện công khai); chỉ liên kết chủ động, không tự liên kết theo email; không tạo tài khoản mới bằng OAuth; session OAuth không vào `/ops`.
- Ba quyết định triển khai (2026-10-07): làm trong **Wave 1** thành EPIC 26; **bật cả ba provider cùng lúc** (mỗi provider vẫn có cờ riêng để tắt khẩn cấp); câu chữ Privacy và Terms đã duyệt (cuối `docs/legal/privacy.md` và `terms.md`, mục "Bổ sung ADR-012"), chỉ chép vào trang đang hiệu lực ở VNX-2607, và VNX-2607 phải merge trước khi bật bất kỳ cờ provider nào trên production.
- **(2026-10-07) Thứ tự so với M8:** làm ngay, merge với cờ tắt, bật (VNX-2608) sau khi ra mắt ổn định.
- **(2026-10-07) Email báo liên kết/hủy liên kết** gồm: tên provider, `label`, thời điểm (UTC), và câu "Không phải bạn? Đăng nhập bằng link qua email, hủy liên kết ở `/me` và viết cho contact@vnx.si". Email chỉ gửi tới `users.email` của chính chủ.

## Quyết định thiết kế của Reviewer (Opus đã duyệt có chỉnh, 2026-10-07)

Lựa chọn kỹ thuật của Planner ở chỗ ADR-012 im lặng hoặc roadmap mơ hồ. Mục 3 lệch roadmap, mục 9 và 10 mở rộng ADR về phía chặt hơn; Reviewer quyết.

1. **Số migration `0017_user_identities.sql`, và luật merge.** `main` có tới `0013_ops_members.sql`; nhánh `feat/m7-metrics` (chưa merge) giữ `0014_product_stats`, `0015_view_dedupe`, `0016_public_stats`. EPIC 26 lấy `0017` để không trùng số với M7 bất kể ai merge trước. Luật: (a) M7 merge trước → không đổi gì; (b) EPIC 26 merge trước → vẫn dùng `0017`, M7 merge sau và D1 áp `0014`–`0016` khi chạy `db:migrate:remote` (wrangler áp mọi file chưa áp, không đòi liền số; hai bên không có phụ thuộc dữ liệu); (c) nếu `main` lúc merge đã có số ≥ `0017`, đổi tên file thành số kế tiếp và sửa mọi chỗ nhắc tên file trong plan, ghi vào báo cáo. Rebase lên `main` ngay trước merge; xung đột dự kiến chỉ ở `test/architecture.test.ts` (M7 sửa ~120 dòng) và dòng ghi chú migration trong `wrangler.jsonc`.
2. **Không thêm dependency: tự viết PKCE/OAuth bằng `fetch` + WebCrypto**, không dùng `arctic` hay thư viện tương tự. Lý do: Global Constraints của M0–EPIC 21 cấm dependency mới; phần cần viết nhỏ (S256 là một lần `crypto.subtle.digest`, đổi code lấy token là một `POST` form, GitHub `GET /user`, tất cả đã có trong runtime workerd); một thư viện vẫn bắt ta tự kiểm `iss`/`aud`/`exp`/`nonce` (arctic chỉ cung cấp `decodeIdToken` không kiểm gì), nên không tiết kiệm phần khó nhất; thêm một gói vào chuỗi cung ứng của luồng đăng nhập là rủi ro lớn hơn ~250 dòng code có test. ADR-012 cho phép thư viện nhỏ nhưng không bắt buộc. Quyết định đã duyệt R2 (Reviewer 2026-10-07). So sánh hằng thời gian (Task 2) dùng `crypto.subtle.timingSafeEqual` của workerd trên hai mảng byte cùng độ dài (hiện `src/` chưa có helper nào; viết một hàm nhỏ trong `domain/oauth.ts` hoặc `auth/crypto.ts`).
3. **ID token: KHÔNG kiểm chữ ký bằng JWKS (lệch dòng roadmap VNX-2603 "kiểm ID token (JWKS, …)", đã được Reviewer duyệt ngày 2026-10-07, quyết định R1).** Căn cứ OIDC Core §3.1.3.7 mục 6: ID token nhận **trực tiếp từ token endpoint qua TLS** thì kiểm chữ ký là tùy chọn (MAY); Google ghi như vậy. Điều kiện bắt buộc, mỗi điều có test (Task 2, 3):
   - (a) ID token chỉ lấy từ JSON trả về của token endpoint, không bao giờ từ query, fragment hay authorize response;
   - (b) URL token endpoint là hằng số trong code (Google `https://oauth2.googleapis.com/token`, LinkedIn `https://www.linkedin.com/oauth/v2/accessToken`), không bao giờ từ input; `fetch` dùng `redirect: "manual"` và mọi 3xx bị từ chối (workerd không hỗ trợ `"error"`: "error won't be implemented since it does not make sense at the edge"; 3xx không phải `res.ok` nên thành `token_request`);
   - (c) `iss` khớp chính xác: Google `https://accounts.google.com` hoặc `accounts.google.com`; LinkedIn `https://www.linkedin.com/oauth`;
   - (d) `aud` bằng client ID, và `azp`, nếu có, cũng bằng client ID; `exp` còn hạn (dung sai 60 s); `nonce` khớp; có `sub`.
   Lợi: bỏ fetch/cache JWKS, code RS256, chế độ lỗi "JWKS không tải được thì không ai đăng nhập được". Mất: một lớp phòng thủ chiều sâu nếu có kẻ chen vào kênh TLS tới provider (không thực tế trong workerd). `verifyIdToken` là một bước có tên rõ để thêm kiểm chữ ký sau này (khi đó hàm thành async; chấp nhận đổi chữ ký nếu có ngày cần JWKS).
4. **Một cookie `__Host-vnx_oauth`, không ký, mang `{ v:1, provider, intent, state, verifier, nonce, next, locale, sessionHash, exp }` (JSON → base64url).** Theo ADR-012 mục 1: HttpOnly, Secure, `SameSite=Lax` (callback là GET top-level từ provider, `Strict` sẽ làm cookie không được gửi), `Path=/`, 600 giây, xóa ngay khi callback chạy (dùng một lần; cũng xóa khi lỗi). Không ký vì `__Host-` chặn cookie tossing từ subdomain và kẻ giả mạo cookie của nạn nhân đã vượt qua mọi thứ khác; thêm khóa ký là thêm một secret phải quản lý. `state` kiểm bằng so sánh thời gian cố định với tham số `state` ở callback. Luồng liên kết: `POST …/link` (đã qua `originCheck`, cần session) ghi cookie `{ intent:"link", provider, sessionHash (S1, xem cuối mục), exp ≤ 120 giây }` rồi 303; `GET …/start` đọc cookie đó: nếu có intent `link` còn hạn, cùng provider và `sessionHash` khớp session hiện tại thì giữ intent `link`, ngược lại intent là `signin`; nó sinh `state`/PKCE/`nonce` và ghi lại cookie. Callback với intent `link` cần session hiện tại có `sessionHash` khớp, nếu không từ chối. `start` chỉ thấy intent `link` nếu POST đã ghi nó: không có tham số URL nào chọn intent. `sessionHash` = `sha256("oauth-link:" + raw session id)` (S1; không dùng `sessions.id_hash` nguyên văn). Callback từ chối khi `cookie.provider !== :provider` (F5).
5. **Provider giả qua port + `OAUTH_DRIVER`.** `OAuthProvider` là interface (`buildAuthorizeUrl`, `exchange(code, verifier, nonce) → ProviderIdentity`); `getOAuthProvider(env, provider)` trả adapter thật, hoặc `FakeOAuthProvider` khi `env.OAUTH_DRIVER === "fake"` **và** `isFakeMail(env)` (tức `MAIL_DRIVER=fake` không có `RESEND_API_KEY` thật, theo VNX-0803 F6) (cùng cách `MAIL_DRIVER`, `TURNSTILE_DRIVER`; `vitest.config.ts` đặt `OAUTH_DRIVER: "fake"`; `wrangler.jsonc` không có biến này, có test cấm). Adapter thật nhận `fetch` tiêm vào, nên test adapter dùng `fetch` giả trả JSON dựng sẵn. Test không bao giờ gọi mạng.
6. **Ba khóa cờ `oauth_google`, `oauth_github`, `oauth_linkedin`, nối vào cuối `FLAG_KEYS`** (thứ tự quan trọng với test và với `/admin/flags`). `key` không có CHECK trong SQL nên không cần migration. Cờ chỉ là "được dùng"; provider chưa cấu hình (thiếu `<PROVIDER>_CLIENT_ID` hoặc `_SECRET`) cũng coi như tắt: nút ẩn, callback 404 (fail closed), kể cả khi cờ bật.
7. **Audit chỉ ghi `{ provider }`**, không ghi `label` (là email của tài khoản provider, dữ liệu cá nhân), không `provider_subject`, không token. `entity = "user"`, `entityId = userId` (cùng `auth.login`). Link và unlink ghi cùng `db.batch` với thay đổi, bằng guard mới `AuditIdentityGuard` (Task 1); `auth.login` qua OAuth dùng `writeAudit` như đường magic link (`data: { method }`).
8. **`SessionUser.method: SessionMethod` bắt buộc, `getSessionUser` fail closed:** hàng `sessions` có `method` ngoài danh sách (không thể có vì CHECK) thì coi như không có session. Không bao giờ trả về giá trị mặc định `magic_link` cho dữ liệu lạ, vì đó sẽ mở cửa vào `/ops`.
9. **Kiểm `method` đặt trong `requireOps` và `requireAdmin`, không đặt trong `resolveOpsRole`** (ADR-012 mục 6 nói "resolver"; kết quả truy cập giống hệt: session `oauth_*` vào `/ops` nhận `opsNotFound`). Lý do: nhánh M7 có `isStaff()` gọi `resolveOpsRole` để **loại nhân viên khỏi thống kê**; nếu resolver từ chối session OAuth thì nhân viên đăng nhập bằng OAuth bị đếm như khách. Mở rộng so với ADR: **`requireAdmin` (legacy `/admin/*`, vẫn đăng ký trong `app.ts` cho tới VNX-2508 hoàn tất) cũng chỉ nhận `magic_link`**, nếu không một session OAuth của email trong `ADMIN_EMAILS` vào được toàn bộ `/admin` và ADR-012 mục 6 thành vô nghĩa. Session OAuth vào `/admin` nhận cùng 403 như mọi từ chối khác của `requireAdmin`. Việc này làm ở VNX-2604a, trước khi có route nào tạo được session OAuth. Sau khi rebase M7, kiểm `method` vẫn nằm trong `requireAdmin` và **không bao giờ** chuyển vào `isAdminUser` (`feat/m7-metrics:apps/web/src/auth/admin.ts`), vì `isStaff` dùng chung hàm đó (R4, F7). Quy tắc chỉ-magic-link áp cho `requireAdmin` cũng như `requireOps` (R4): đây là siết quyền nhân viên, không phải vi phạm ADR.
10. **Rate limit callback:** `hitRateLimit` khóa `oauth:ip:<ip>`, 20 lần/giờ, đúng bằng ngưỡng IP của `/login` (ADR-012 mục 3.4 "như `/login`"). Không có giới hạn theo email (không có email nhập từ người dùng).
11. **Trang "chưa liên kết" và mọi lỗi OAuth trả tại chỗ, không redirect kèm `code`:** URL callback chứa `code` và `state`; mọi response của callback có `Cache-Control: no-store` và `Referrer-Policy: same-origin` (không `no-referrer`: trang có form POST sau Origin check, xem VNX-0803 review F1; `same-origin` đủ vì trang không tải tài nguyên ngoài site). Một trang lỗi chung cho state sai / hết hạn / provider lỗi; trang "chưa liên kết" riêng, giống hệt từng byte dù email provider có khớp tài khoản nào hay không (test so byte, trừ request id).
12. **Email provider chỉ là `label`.** Không bao giờ so khớp với `users.email` ở bất kỳ nhánh nào (test: email provider trùng `users.email` vẫn "chưa liên kết"). `label` rỗng (Google/LinkedIn không trả email) → adapter dùng thẳng tên hiển thị cố định của provider ("Google", "LinkedIn"); **không bao giờ lưu `name`** (addendum Privacy đã duyệt chỉ liệt kê email và username). `label` luôn 1–254 ký tự (CHECK).
13. **Logo và nút:** SVG tự host dưới `apps/web/public/assets/brand/oauth/` (CSP `img-src 'self'`), không style/script nội tuyến. Bản logo chính thức lấy ở bước vận hành VNX-2601; Implementer không tự vẽ logo của bên thứ ba.
14. **Luồng liên kết (R3, Reviewer 2026-10-07; lệch chữ ADR-012 §4 "GET này redirect sang provider").** Với intent `link`, `GET /auth/oauth/:provider/start` **luôn trả 200** một trang trung gian có đúng một `<a href="{authorize URL}">` "Tiếp tục tới {provider}", `Cache-Control: no-store`, không script hay style nội tuyến, Referrer-Policy không phải `no-referrer`; **không bao giờ 302**. Intent `signin` vẫn 302. Lý do: `form-action 'self'` áp lên cả chuỗi redirect của một form submission trong Chrome (`http/security-headers.ts:7-8`); cú bấm vào `<a>` là một navigation mới. Phương án thêm origin provider vào `form-action` bị loại. Bất biến "POST không bao giờ redirect ra ngoài site" vẫn đúng (`POST …/link` chỉ 303 về cùng site).

## Câu hỏi mở cho Owner

Không chặn Task 1. Đây là các quy tắc nghiệp vụ hoặc nội dung mà ADR-012 và các quyết định Owner đang im lặng; Planner không tự đặt giá trị.

1. ~~Thứ tự EPIC 26 so với M8~~ **Đã chốt (Owner 2026-10-07):** làm ngay, merge với cờ tắt, bật sau ra mắt.
2. **Câu chữ giao diện và email, nguyên văn 4 locale.** Nội dung email đã chốt (xem Quyết định của Owner); câu chữ nguyên văn vẫn chờ Owner duyệt theo từng task. ADR chỉ cho câu tiếng Việt của trang "chưa liên kết". Cần duyệt: nhãn nút, mục "Đăng nhập & tài khoản liên kết" ở `/me`, trang trung gian "Tiếp tục tới {provider}", thông báo xung đột, nhãn huy hiệu, nội dung email báo liên kết/hủy liên kết (có kèm `label` hay chỉ tên provider và thời điểm; địa chỉ liên hệ nào). Reviewer soạn bản nháp trong phần của task tương ứng, Owner duyệt nguyên văn trước khi task bắt đầu (tiền lệ EPIC 21).

**Đã chốt (không còn là câu hỏi):** (a) bộ logo/nút chính thức là một bước vận hành của VNX-2601; (b) công tắc `show_on_profile` hiện với mọi builder nhưng không có tác dụng công khai cho tới khi builder `approved` (ADR-012 §5); (c) builder rời trạng thái `approved` giữ nguyên các hàng `user_identities` và `show_on_profile`, truy vấn huy hiệu lọc theo `approved` (ADR-012 §5 và dòng lưu giữ "until you unlink them or your account is deleted" của addendum Privacy).

## Rủi ro đã biết

- **CSP `form-action 'self'` và chuỗi redirect sau POST:** đã xử lý bằng quyết định 14 (R3): `start` với intent `link` trả trang trung gian 200, không redirect. Còn lại: bước kiểm tay ở VNX-2605a trên Chrome, Firefox, Safari là **xác nhận**, không còn là quyết định. Nút ở `/login` là `<a>`, không bao giờ form (form GET cũng bị chặn).
- **GitHub và PKCE:** ADR yêu cầu PKCE S256 cho cả ba. GitHub OAuth App hỗ trợ `code_challenge` từ 2025; nếu một ứng dụng cũ bỏ qua tham số này thì luồng vẫn chạy (GitHub không ép), nhưng ta không dựa vào nó để chống chặn code: `state` + client secret vẫn là lớp chính. VNX-2601 ghi lại kết quả thử.
- **LinkedIn:** `email` có thể thiếu (→ `label` là chữ "LinkedIn", quyết định 12). VNX-2601 phải xác nhận LinkedIn nhận `scope=openid+profile+email` (dấu cách mã hóa thành `+` bởi `URLSearchParams`) và trả lại `nonce` trong ID token; kiểm `nonce` giữ fail closed, nếu LinkedIn không trả thì quay lại Reviewer, không bỏ kiểm tra.
- **LinkedIn và PKCE:** LinkedIn ghi tài liệu PKCE chủ yếu cho ứng dụng native (bật theo yêu cầu), nên với ứng dụng web confidential `code_challenge` có thể bị bỏ qua hoặc `code_verifier` bị từ chối. VNX-2601 phải thử với ứng dụng thật. Nếu LinkedIn từ chối `code_verifier`, KHÔNG bỏ PKCE trong code: đó là lệch ADR-012 §1, quay lại Reviewer và Owner.
- **Hàng `user_identities` và `deleteGhostUsers`:** user có identity luôn đã đăng nhập (`last_login_at` khác null) nên `deleteGhostUsers` không chọn họ; không sửa hàm đó. Ghi vào "Ghi nhận" nếu về sau có luồng xóa tài khoản.

## Global Constraints

- Mọi ràng buộc của plan M0–EPIC 21 vẫn áp dụng (không thêm dependency, ranh giới module và test sở hữu bảng, Origin check cho POST, `RETURNING` thay `meta.changes` cho bảng có trigger, chuỗi giao diện qua `t()` đủ 4 locale, test nặng timeout 30 s, `Cache-Control: no-store` cho `/hub`, `/me`, `/admin`, `/ops`).
- **CSP (VNX-0803):** không `style=` hay script nội tuyến; logo OAuth tự host; không tải gì từ bên ngoài. Thân POST không upload ≤ 64 KB. **Handler POST không bao giờ redirect ra ngoài site** (`form-action 'self'`): `POST …/link` chỉ 303 về `GET /auth/oauth/:provider/start` cùng site. Trang có form POST không dùng `Referrer-Policy: no-referrer` (làm `Origin: null` và `originCheck` từ chối); dùng `same-origin`.
- **Provider và scope (đúng ADR-012):** Google `openid email`; GitHub không xin scope (chỉ hồ sơ công khai); LinkedIn `openid profile email`. Luôn `state`, PKCE `S256`; OIDC thêm `nonce`. `provider_subject`: Google và LinkedIn `sub`, GitHub `id` số (không dùng `login`). Callback URI cố định `/auth/oauth/:provider/callback`, không tiền tố locale.
- **Bí mật:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` chỉ trong `wrangler secret` và `.dev.vars`; trong repo chỉ có tên (kiểu `env.ts`, ghi chú `wrangler.jsonc`).
- **Không lưu, không log access token, refresh token, ID token, `code`, `code_verifier`:** bảng không có cột token (test cột), audit chỉ `{ provider }`, log chỉ mã lỗi.
- **Không tạo tài khoản, không tạo session cho identity chưa liên kết, không tự liên kết theo email** ở bất kỳ nhánh nào.
- **Session:** dùng lại `createSession` và `__Host-vnx_session` (30 ngày). `/ops` và `/admin` chỉ nhận `method = magic_link`.
- **Quyền riêng tư:** identity của client không xuất hiện trong bất kỳ response nào gửi cho builder hay công khai; Google không bao giờ hiện công khai; LinkedIn chỉ nhãn, không link, không email; GitHub `@login` link tới `https://github.com/<login>`. Huy hiệu không vào xếp hạng (ADR-004).
- **Test:** không có mạng; mọi provider qua `FakeOAuthProvider` hoặc `fetch` giả. Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.
- **i18n:** mọi khóa mới có đủ `en`, `vi`, `zh-Hans`, `zh-Hant` (ADR-003). Tên provider (Google, GitHub, LinkedIn) không dịch.
- **Cỡ task:** mỗi task ≤ 1 ngày, diff ≲ 600 dòng không tính file locale.
- Mọi commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Callback OAuth không bao giờ nhận hay tra lời mời Ops** (ADR-012 §6: kích hoạt lời mời Ops chỉ qua magic link). `routes/oauth.tsx` và mọi import của nó không import `db/ops-members.ts`.
- **Callback chỉ ghi log mã lỗi cố định**, không bao giờ `String(err)` hay nội dung phản hồi của provider.

## Review Focus

1. **`state`, PKCE, `nonce`, ID token (Task 2, 3, 6):** `state` sai, thiếu, hết hạn hoặc dùng lại bị từ chối; `code_challenge` đúng S256 của `verifier`; `nonce` khớp; `iss`/`aud`/`exp` sai bị từ chối; cookie xóa sau callback kể cả khi lỗi.
2. **Không tạo tài khoản, không tự liên kết (Task 6, 8):** identity chưa liên kết thì không có user mới và không có session; trang trả về giống hệt từng byte dù email provider có trùng `users.email` hay không.
3. **User `suspended` không đăng nhập được bằng OAuth (Task 6).**
4. **Duy nhất (Task 1, 8):** một tài khoản provider không gắn được với hai user; mỗi user tối đa một identity mỗi provider; thông báo xung đột không nói là user nào.
5. **Liên kết (Task 8):** POST có Origin check, 303 chỉ về cùng site, callback `link` cần đúng session; không có tham số URL nào chọn intent.
6. **Audit và email (Task 1, 9):** link/unlink ghi audit không có token; email báo tới `users.email` ở 4 locale.
7. **`/ops` và `/admin` (Task 5):** session `oauth_*` nhận 404 kín ở `/ops` (byte-by-byte như các từ chối khác) và 403 ở `/admin`; session `magic_link` không đổi hành vi; `isStaff` (M7) vẫn nhận ra nhân viên đăng nhập bằng OAuth.
8. **Huy hiệu (Task 10, 11):** chỉ builder `approved` có `show_on_profile = 1`; Google không bao giờ; identity client không lộ; thứ tự catalogue và Top builders không đổi.
9. **Không token trong DB và log (Task 1, 3, 4):** cột của `user_identities` đúng danh sách; test quét `console.error` của callback không chứa token hay `code`. Task 6: quét `console.error` ở mọi đường lỗi của callback, chỉ có mã lỗi cố định.
10. **Cờ (Task 1, 6, 7):** cờ tắt hoặc thiếu secret → nút ẩn, callback 404; cờ nằm trong `/admin/flags`.
11. **i18n parity (mọi task có chuỗi):** `test/i18n/parity.test.ts` xanh.
12. **CSP và Referrer-Policy (Task 6, 7, 8):** không inline; không `no-referrer` trên trang có form POST; `POST …/link` 303 về cùng site và `start` intent `link` trả 200, không bao giờ 3xx ra ngoài (quyết định 14); `/login` không có `<form>` nào trỏ `/auth/oauth/`.
13. **Migration chỉ thêm (Task 1):** không đổi bảng cũ ngoài một cột có mặc định; không chạy remote.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc | Review Focus |
|---|---|---|---|---|
| — | VNX-2601 | **HUMAN, HIGH-RISK.** Owner tạo 3 ứng dụng OAuth (Google Cloud consent screen, GitHub OAuth App, LinkedIn app gắn Company Page), callback `/auth/oauth/:provider/callback` cho prod và local, đặt 6 secret bằng `wrangler secret`, tải logo/nút chính thức. Cần trước khi thử trên môi trường thật, không chặn code. | — | — |
| 1 | VNX-2602 | Migration `0017_user_identities` (bảng `user_identities` + 2 UNIQUE; `sessions.method` mặc định `magic_link`); `domain/identity.ts`; `db/identities.ts` (link/unlink có audit cùng batch); `createSession(…, method)` và `SessionUser.method`; 3 cờ provider; test kiến trúc | — | 4, 6, 9, 10, 13 |
| 2 | VNX-2603a | `domain/oauth.ts` thuần (PKCE S256, `state`, `nonce`, authorize URL, `verifyIdToken`/kiểm claim, payload cookie) + `auth/oauth-cookie.ts` (`__Host-vnx_oauth`) | 1 | 1, 9 |
| 3 | VNX-2603b | Port `OAuthProvider`, adapter Google và LinkedIn (OIDC chung), `FakeOAuthProvider`, `getOAuthProvider`, biến env | 2 | 1, 9 |
| 4 | VNX-2603c | Adapter GitHub (`access_token` + `GET /user`, `id` số, `login`), ghi chú `wrangler.jsonc` về 6 secret | 3 | 9 |
| 5 | VNX-2604a | `requireOps` và `requireAdmin` chỉ nhận `magic_link`; test 404 kín và `isStaff` | 1 | 7 |
| 6 | VNX-2604b | `GET /auth/oauth/:provider/start`, `GET …/callback` (intent `signin`): cờ, rate limit, state, user `suspended`, trang "chưa liên kết", session `oauth_*`, audit `auth.login` có `method`, `touchIdentityLogin` | 3, 4, 5 | 1, 2, 3, 10, 12 |
| 7 | VNX-2604c | Nút provider ở `/login` (theo cờ + cấu hình), logo tự host, CSS | 6 | 10, 12 |
| 8 | VNX-2605a | `/me` mục "Đăng nhập & tài khoản liên kết" (liệt kê), `POST …/link` (Origin, intent vào cookie, 303), nhánh `link` ở callback, xung đột identity; kiểm tay chuỗi redirect | 6 | 4, 5, 12 |
| 9 | VNX-2605b | `POST …/unlink`; email báo liên kết và hủy liên kết 4 locale (`email/templates/identity.ts`) | 8 | 6 |
| 10 | VNX-2606a | `setShowOnProfile` và công tắc ở `/hub/profile` (theo câu hỏi mở 5) | 1 | 8 |
| 11 | VNX-2606b | Huy hiệu trên `/b/:handle` (GitHub link, LinkedIn nhãn, Google không); test không lộ client và không vào xếp hạng | 10, 8 | 8 |
| 12 | VNX-2607 | Chép bổ sung ADR-012 vào `## EN`/`## VI` của `docs/legal/privacy.md`, `terms.md` và `src/legal/content.ts`, đối chiếu code thật (tên cột, cookie, thời hạn); merge trước khi bật cờ | 9, 11 | — |
| — | VNX-2608 | **HUMAN, HIGH-RISK.** Owner bật 3 cờ trên production, thử đăng nhập và liên kết bằng tài khoản thật | 2601, 12 | — |

Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit.

**Cổng ra EPIC 26** (roadmap): toàn bộ test ở mục "Được bảo đảm bởi" của ADR-012 xanh; `/privacy` và `/terms` trên production đã có bổ sung ADR-012 trước khi cờ provider nào được bật.

## Phạm vi các task sau (viết chi tiết ngay trước khi làm)

- **Task 2 (VNX-2603a).** `domain/oauth.ts`: `generateState()`, `generateNonce()`, `generateVerifier()` (43–128 ký tự theo RFC 7636), `codeChallengeS256(verifier)`, `buildAuthorizeUrl(config, params)` (chỉ ghép tham số đã biết, `redirect_uri` từ `APP_ORIGIN`), `verifyIdToken(idToken, expected)` (giải base64url + JSON, kiểm `iss`, `aud`/`azp`, `exp` có dung sai 60 s, `nonce`, có `sub`; không kiểm chữ ký, quyết định 3), kiểu `OAuthCookie` và `parseOAuthCookie` (từ chối sai hình dạng, quá hạn). `auth/oauth-cookie.ts`: `OAUTH_COOKIE`, `readOAuthCookie`, `writeOAuthCookie`, `clearOAuthCookie` (Lax, 600 s). Test: vector RFC 7636 phụ lục B cho S256; mọi kiểu claim sai. Test thêm: `parseOAuthCookie` và nơi gọi nó từ chối khi `provider` trong cookie khác `:provider` (F5); `sessionHash = sha256("oauth-link:" + raw session id)` (S1); so sánh `state` bằng `crypto.subtle.timingSafeEqual` trên mảng byte cùng độ dài (R2); `verifyIdToken` thực thi điều kiện (c) và (d) của quyết định 3.
- **Task 3 (VNX-2603b).** `auth/oauth/provider.ts` (interface và kiểu `ProviderIdentity = { subject, label }`), `auth/oauth/oidc.ts` (đổi `code`, gọi `verifyIdToken`, dùng chung Google và LinkedIn; cấu hình endpoint cố định theo provider), `auth/oauth/fake.ts` (`FakeOAuthProvider` với bảng `code → identity` do test đặt; mô phỏng `state`/PKCE/nonce đúng để bắt lỗi của lõi), `auth/oauth/index.ts` (`getOAuthProvider`, `isProviderConfigured`); `env.ts` thêm 6 secret tùy chọn và `OAUTH_DRIVER`; `vitest.config.ts` đặt `OAUTH_DRIVER: "fake"`. Test adapter bằng `fetch` giả: token endpoint trả ID token sai `aud` thì từ chối; không có chuỗi token nào xuất hiện trong log. `FakeOAuthProvider` từ chối `code` đã dùng (S2). Adapter kiểm điều kiện (a)–(b) của quyết định 3 (ID token chỉ từ JSON token endpoint, URL hằng số, `fetch` có `redirect: "manual"`, mọi 3xx bị từ chối).
- **Task 4 (VNX-2603c).** `auth/oauth/github.ts`: đổi `code` (+ `code_verifier`) ở `https://github.com/login/oauth/access_token` với `Accept: application/json`, rồi `GET https://api.github.com/user` (có `User-Agent`, `Authorization: Bearer`), lấy `id` (số → chuỗi) và `login`; bỏ token ngay. Test với `fetch` giả: `id` số thành `subject`, `login` đổi nhưng `subject` giữ nguyên; lỗi HTTP và thiếu `id` bị từ chối; token không bị log. Hai `fetch` của GitHub (đổi `code` và `GET /user`) cũng dùng `redirect: "manual"`, mọi 3xx bị từ chối, và có test `new Request(url, init)` không ném lỗi (F1). Thêm `GITHUB_CLIENT_ID` và `GITHUB_CLIENT_SECRET` (tùy chọn ở `env.ts`, nhánh github của `oauthCredentials`), ghim `""` trong `vitest.config.ts` và mở rộng test "không có credential nào trong `testEnv`" ở `oauth-providers.test.ts` cho hai khóa này.
- **Task 5 (VNX-2604a).** Sửa `auth/ops.ts` (`requireOps`) và `auth/middleware.ts` (`requireAdmin`) để từ chối `user.method !== "magic_link"` (quyết định 9); `resolveOpsRole` không đổi. Test: session `oauth_github` và `oauth_google` vào `/ops` nhận đúng bytes của `opsNotFound`; vào `/admin` nhận 403; `magic_link` không đổi; `resolveOpsRole` vẫn trả vai trò cho user có session OAuth. Quyết định rõ: kiểm vẫn ở `requireAdmin`, không chuyển vào `isAdminUser` sau khi rebase M7 (F7).
- **Task 6 (VNX-2604b).** `routes/oauth.tsx`: `GET /auth/oauth/:provider/start` (cờ, cấu hình, sinh state/PKCE/nonce, ghi cookie, 302), `GET /auth/oauth/:provider/callback` (cờ tắt → 404 trước mọi việc khác; rate limit; cookie + `state`; `provider.exchange`; tìm `findIdentityByProviderSubject`; user `suspended` → 403 như magic link; chưa liên kết → trang chung; tìm thấy → `createSession(…, sessionMethodFor(provider))`, `touchIdentityLogin`, audit `auth.login` có `data.method`, cookie session, redirect `safeNext`). Header theo quyết định 11. View trang "chưa liên kết" (câu VI của ADR-012 mục 3; EN, zh-Hans, zh-Hant do Owner duyệt). Test dùng `FakeOAuthProvider`. Callback từ chối khi `cookie.provider !== :provider` (F5, có test). Đăng nhập OAuth gọi `markLogin` (`src/db/users.ts:40`) đúng như `completeLogin` (`src/routes/auth.tsx:43`) (F10). Thêm: assertion kiến trúc rằng `routes/oauth.tsx` và các import của nó không import `db/ops-members.ts`, và test user có lời mời Ops `pending` đăng nhập bằng OAuth không có hàng `ops_members` (F3). Test quét `console.error` ở mọi đường lỗi (F5). Test helper đọc flow cookie do `/start` đặt và luôn gọi `issueFakeCode` với đủ `verifier`, `nonce`, `redirectUri` (F3); `redirectUri` tính một lần bằng `oauthRedirectUri(env.APP_ORIGIN, provider)` và dùng cho cả authorize lẫn exchange, không bao giờ từ URL của request. Nếu ước tính > 600 dòng khi viết section, tách (ví dụ route start và route callback riêng) (F9).
- **Task 7 (VNX-2604c).** `LoginPage` thêm nút cho provider có cờ bật và có cấu hình, dưới form email; logo SVG tự host, CSS class `oauth-*` (không inline); khóa i18n nhãn nút. Test: cờ tắt → không có nút; không `style=`/script nội tuyến (CSP). Nút ở `/login` là `<a href="/auth/oauth/:provider/start?next=…">`, không bao giờ form (form GET cũng bị `form-action` chặn); test `/login` không có `<form>` nào có action dưới `/auth/oauth/` (F1).
- **Task 8 (VNX-2605a).** Mục trong `/me` liệt kê provider đã liên kết (kèm `label`) và chưa; `POST /me/identities/:provider/link` (cần session, ghi cookie intent `link`, 303 `/auth/oauth/:provider/start`); callback nhánh `link` (cần `sessionHash` khớp, `linkIdentity`, xung đột → thông báo chung, `already_linked` coi như thành công không gửi email); kiểm tay chuỗi redirect trên Chrome/Firefox/Safari, chọn trang trung gian nếu cần (quyết định 14). `db/identities.ts` thêm hàm đọc cho `/me` nếu `listIdentitiesForUser` chưa đủ; allowlist test kiến trúc thêm các file mới. Sửa so với bản nháp: không còn "chọn trang trung gian nếu cần". Theo quyết định 14 (R3), `start` với intent `link` luôn trả trang 200 có một `<a>`; test: `POST …/link` trả 303 với `Location` cùng site, `GET /start` với intent `link` trả 200 và không bao giờ 3xx ra ngoài; kiểm tay trên trình duyệt là xác nhận. Nếu ước tính > 600 dòng, tách nhánh `link` của callback thành task riêng (F9).
- **Task 9 (VNX-2605b).** `POST /me/identities/:provider/unlink` (Origin, `unlinkIdentity`, luôn được phép); `email/templates/identity.ts` (`identityLinkedEmail`, `identityUnlinkedEmail`, 4 locale, escape HTML như `loginEmail`); gửi sau khi batch thành công tới `users.email` qua `getMailer`; cách xử lý lỗi gửi mail (ghi log, không hoàn tác; có dùng lại cơ chế gửi lại của `notify` hay không) quyết định khi viết section từ code thật. Test: email tới đúng `users.email` (không phải `label`), đúng locale, không chứa token.
- **Task 10 (VNX-2606a).** `setShowOnProfile` trong `db/identities.ts`; công tắc trong `/hub/profile` cho identity GitHub và LinkedIn (Google không có công tắc); audit; theo câu trả lời cho câu hỏi mở 5.
- **Task 11 (VNX-2606b).** `listPublicBadges(db, builderUserId)` trong `db/identities.ts` (chỉ builder `approved`, `show_on_profile = 1`, provider GitHub hoặc LinkedIn); khối huy hiệu trong `BuilderProfilePage`; test: Google không bao giờ, client không bao giờ, builder không `approved` không hiện, hủy liên kết thì biến mất ngay, thứ tự catalogue và Top builders không đổi khi bật/tắt, `RANKING_FILES` không chạm `user_identities`. Thêm test riêng tư: dựng trang hub inquiry hoặc invitation (builder-facing) cho một client có identity liên kết (chèn thô, `show_on_profile = 1`) và khẳng định `label` không xuất hiện.
- **Task 12 (VNX-2607).** Chép các khối "Bổ sung ADR-012" đã duyệt vào đúng chỗ của `privacy.md`, `terms.md`, `src/legal/content.ts`; đối chiếu từng mệnh đề với code (tên cookie `__Host-vnx_oauth`, 10 phút, cột lưu, email báo); test `legal/content` so từng dòng như các trang pháp lý khác.

---

### Task 1: VNX-2602 — Bảng `user_identities`, `sessions.method`, `db/identities`, ba cờ provider

**Files:**
- Create: `apps/web/migrations/0017_user_identities.sql`
- Create: `apps/web/src/domain/identity.ts`, `apps/web/src/db/identities.ts`
- Modify: `apps/web/src/domain/flags.ts` (ba khóa mới cuối `FLAG_KEYS`)
- Modify: `apps/web/src/auth/sessions.ts` (`SessionUser.method`, `createSession(…, method)`, `getSessionUser` đọc `method`)
- Modify: `apps/web/src/db/audit.ts` (guard `AuditIdentityGuard`, nhánh `identityId` **đặt trước nhánh `userId`**)
- Modify: `apps/web/src/views/admin/FlagsPage.tsx` (`DESC` thêm ba khóa)
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (ba khóa `flags.desc.oauth_*`, ngay sau `flags.desc.content_indexing`; và sửa `flags.intro` cho cả bốn locale, F8)
- Modify: `apps/web/wrangler.jsonc` (ghi chú thứ tự deploy cho `0017`)
- Modify: `apps/web/test/architecture.test.ts` (`WRITERS.user_identities`; nhóm test "linked identities stay in their module")
- Modify: `apps/web/test/domain/flags.test.ts` (mười khóa), `apps/web/test/auth/sessions.test.ts` (`method`), `apps/web/test/ops/guard.test.ts` (literal `SessionUser` có `method`)
- Test (mới): `apps/web/test/domain/identity.test.ts`, `apps/web/test/db/identities.test.ts`

**Interfaces:**
- Consumes: `auditStatement`, `writeAudit` (`db/audit.ts`); `ulid` (`lib/ulid.ts`); `createSession`, `getSessionUser` (`auth/sessions.ts`); `FLAG_KEYS`, `FlagKey` (`domain/flags.ts`); fixtures `ensureUser`; `testEnv`.
- Produces:
  - `domain/identity.ts`: `OAUTH_PROVIDERS` (tuple `["google","github","linkedin"]`), `type OAuthProvider`, `isOAuthProvider(value: unknown): value is OAuthProvider`; `SESSION_METHODS` (tuple `["magic_link","oauth_google","oauth_github","oauth_linkedin"]`), `type SessionMethod`, `isSessionMethod(value: unknown): value is SessionMethod`, `sessionMethodFor(provider: OAuthProvider): SessionMethod`; `PROVIDER_FLAG: Record<OAuthProvider, FlagKey>`; `IDENTITY_AUDIT = { link: "auth.identity.link", unlink: "auth.identity.unlink" } as const`; `interface UserIdentity { id; userId; provider; subject; label; showOnProfile: boolean; linkedAt; lastUsedAt: string | null; updatedAt }`; `type LinkRefusal = "already_linked" | "provider_account_taken" | "user_has_provider"`.
  - `db/identities.ts`: `findIdentityByProviderSubject(db, provider, subject): Promise<UserIdentity | null>`, `listIdentitiesForUser(db, userId): Promise<UserIdentity[]>` (sắp theo `provider`), `linkIdentity(db, { userId, provider, subject, label, now }): Promise<LinkResult>` với `LinkResult = { ok: true; identity: UserIdentity } | { ok: false; reason: LinkRefusal }`, `unlinkIdentity(db, { userId, provider, now }): Promise<UserIdentity | null>`, `touchIdentityLogin(db, { id, label, now }): Promise<void>`.
  - `auth/sessions.ts`: `SessionUser.method: SessionMethod`; `createSession(db, userId, now, method = "magic_link")`.
  - `db/audit.ts`: `AuditIdentityGuard = { identityId: string; userId: string }`.
  - `domain/flags.ts`: `FLAG_KEYS` có mười khóa; ba khóa mới là `oauth_google`, `oauth_github`, `oauth_linkedin`.

**Quyết định kỹ thuật:**
- `linkIdentity` và `unlinkIdentity` ghi audit cùng `db.batch` với thay đổi (quyết định 7). Guard `AuditIdentityGuard`: "ghi chỉ khi hàng `user_identities` đó đang tồn tại và thuộc user đó". Link: câu `INSERT` đứng trước, `id` là ULID mới nên chỉ tồn tại nếu chính câu `INSERT` này thành công. Unlink: câu audit đứng **trước** câu `DELETE` trong batch (sau khi xóa thì không còn hàng để kiểm), cùng một transaction.
- Link bị từ chối được phân loại **sau** khi `INSERT … ON CONFLICT DO NOTHING` không chèn được (`already_linked`: chính user này đã có đúng tài khoản đó, idempotent, không audit; `provider_account_taken`: tài khoản provider thuộc user khác, **không trả user nào**; `user_has_provider`: user đã có tài khoản khác của provider này). Phân loại là một lần đọc phụ, không cần chính xác tuyệt đối dưới race: dữ liệu luôn được hai UNIQUE bảo vệ.
- `label` được kẹp bởi CHECK 1–254 ký tự; adapter (Task 3) chịu trách nhiệm đưa vào giá trị hợp lệ. `last_used_at` rỗng cho tới lần đăng nhập đầu bằng identity đó.
- `touchIdentityLogin` làm mới `label` (để `@login` GitHub mới nhất cho huy hiệu, ADR-012 mục 5) cùng `last_used_at` và `updated_at`.
- `getSessionUser` fail closed (quyết định 8). `SessionUser.method` bắt buộc nên mọi literal `SessionUser` trong test phải thêm `method` (hiện có `test/ops/guard.test.ts` và `test/auth/sessions.test.ts`); nhánh M7 có thể thêm literal khác, typecheck sau rebase sẽ chỉ ra.
- Test kiến trúc mới: file duy nhất được chạm `user_identities` (SQL hoặc import `db/identities.ts`) là `db/identities.ts` và `db/audit.ts` (đọc để kiểm guard); mỗi task sau thêm file nó tạo vào allowlist (cùng cách allowlist tiền của EPIC 21). Không file xếp hạng nào được trên allowlist.

- [ ] **Step 1: Migration**

`apps/web/migrations/0017_user_identities.sql`:

```sql
-- EPIC 26 linked accounts (ADR-012 §2). Additive only. Module `identity` (src/db/identities.ts) owns user_identities.
-- No token column on purpose: access and refresh tokens are used inside one callback request and never stored (ADR-012 §1).
CREATE TABLE user_identities (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id),
  provider         TEXT NOT NULL CHECK (provider IN ('google', 'github', 'linkedin')),
  -- Immutable provider id: `sub` for Google and LinkedIn, the numeric `id` for GitHub (never `login`, which can change).
  provider_subject TEXT NOT NULL CHECK (length(provider_subject) BETWEEN 1 AND 255),
  -- E-mail (Google, LinkedIn) or login (GitHub). Shown only to the account owner, except a GitHub login on an opted-in badge.
  label            TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 254),
  show_on_profile  INTEGER NOT NULL DEFAULT 0 CHECK (show_on_profile IN (0, 1)),
  linked_at        TEXT NOT NULL,
  last_used_at     TEXT,
  updated_at       TEXT NOT NULL,
  -- One provider account belongs to one user; one user has at most one account per provider.
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

-- How a session was created. Existing sessions keep their meaning (they all came from a magic link). /ops and /admin accept only 'magic_link'.
ALTER TABLE sessions ADD COLUMN method TEXT NOT NULL DEFAULT 'magic_link'
  CHECK (method IN ('magic_link', 'oauth_google', 'oauth_github', 'oauth_linkedin'));
```

Thêm vào `apps/web/wrangler.jsonc`, ngay sau dòng ghi chú `0010_feature_flags, 0011_partners and 0012_outbound_clicks …` và dòng "The daily cron also deletes outbound clicks …":

```jsonc
  // 0017_user_identities (EPIC 26) ships with its code the same way: migrate first, then deploy. It also adds sessions.method (default 'magic_link'),
  // which the new createSession writes, so the old code keeps working after the migration but the new code does not work before it.
  // The three OAuth flags (oauth_google, oauth_github, oauth_linkedin) stay off until the Owner turns them on (VNX-2608).
```

- [ ] **Step 2: Test domain (fail)**

`apps/web/test/domain/identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { IDENTITY_AUDIT, isOAuthProvider, isSessionMethod, OAUTH_PROVIDERS, PROVIDER_FLAG, SESSION_METHODS, sessionMethodFor } from "../../src/domain/identity.ts";

describe("OAuth providers (ADR-012 §1)", () => {
  it("are google, github and linkedin, in that order", () => {
    expect([...OAUTH_PROVIDERS]).toEqual(["google", "github", "linkedin"]);
  });

  it("recognises only those", () => {
    for (const p of OAUTH_PROVIDERS) expect(isOAuthProvider(p)).toBe(true);
    for (const bad of ["Google", "google ", "", "twitter", "magic_link", "__proto__", "constructor", 1, null, undefined]) expect(isOAuthProvider(bad), String(bad)).toBe(false);
  });

  it("each has its own feature flag, and that flag is a real one", () => {
    expect(Object.keys(PROVIDER_FLAG)).toEqual([...OAUTH_PROVIDERS]);
    expect(PROVIDER_FLAG).toEqual({ google: "oauth_google", github: "oauth_github", linkedin: "oauth_linkedin" });
    for (const flag of Object.values(PROVIDER_FLAG)) expect(FLAG_KEYS).toContain(flag);
    expect(new Set(Object.values(PROVIDER_FLAG)).size).toBe(3);
  });
});

describe("session methods (ADR-012 §2)", () => {
  it("are magic_link plus one per provider", () => {
    expect([...SESSION_METHODS]).toEqual(["magic_link", "oauth_google", "oauth_github", "oauth_linkedin"]);
  });

  it("maps a provider to its method, and never to magic_link", () => {
    expect(OAUTH_PROVIDERS.map(sessionMethodFor)).toEqual(["oauth_google", "oauth_github", "oauth_linkedin"]);
  });

  it("recognises only those", () => {
    for (const m of SESSION_METHODS) expect(isSessionMethod(m)).toBe(true);
    for (const bad of ["oauth", "oauth_twitter", "MAGIC_LINK", "", "__proto__", 0, null, undefined]) expect(isSessionMethod(bad), String(bad)).toBe(false);
  });
});

describe("identity audit actions (ADR-012 §4)", () => {
  it("are fixed", () => {
    expect(IDENTITY_AUDIT).toEqual({ link: "auth.identity.link", unlink: "auth.identity.unlink" });
  });
});
```

Cập nhật `apps/web/test/domain/flags.test.ts`: đổi tên test và danh sách khóa:

```ts
  it("are the seven keys of the addendum, then one per OAuth provider (ADR-012), in order", () => {
    expect([...FLAG_KEYS]).toEqual([
      "affiliate", "partner_referral", "sponsored_listings", "ads", "lead_generation", "ai_content", "content_indexing",
      "oauth_google", "oauth_github", "oauth_linkedin",
    ]);
  });
```

Chạy: `npm test -w apps/web -- test/domain/identity.test.ts test/domain/flags.test.ts` → FAIL (`domain/identity.ts` chưa có; danh sách khóa cờ chưa đủ).

- [ ] **Step 3: Domain và cờ**

`apps/web/src/domain/identity.ts`:

```ts
import type { FlagKey } from "./flags.ts";

/** Linked accounts and how a session was created (ADR-012). Pure: no Hono, no D1. */

export const OAUTH_PROVIDERS = ["google", "github", "linkedin"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** `sessions.method`: how the session was created. /ops and /admin accept only "magic_link" (ADR-012 §6). */
export const SESSION_METHODS = ["magic_link", "oauth_google", "oauth_github", "oauth_linkedin"] as const;
export type SessionMethod = (typeof SESSION_METHODS)[number];

export function isSessionMethod(value: unknown): value is SessionMethod {
  return typeof value === "string" && (SESSION_METHODS as readonly string[]).includes(value);
}

export function sessionMethodFor(provider: OAuthProvider): SessionMethod {
  return `oauth_${provider}`;
}

/** Each provider has its own feature flag: off hides the button and makes the callback 404 (ADR-012 §1). */
export const PROVIDER_FLAG: Record<OAuthProvider, FlagKey> = {
  google: "oauth_google",
  github: "oauth_github",
  linkedin: "oauth_linkedin",
};

/** Audit actions of a link and an unlink. The row carries the provider only: no label, no subject, no token. */
export const IDENTITY_AUDIT = { link: "auth.identity.link", unlink: "auth.identity.unlink" } as const;

export interface UserIdentity {
  id: string;
  userId: string;
  provider: OAuthProvider;
  /** The provider's immutable id for the account. Never shown. */
  subject: string;
  /** E-mail (Google, LinkedIn) or login (GitHub). */
  label: string;
  showOnProfile: boolean;
  linkedAt: string;
  /** Null until the first sign-in with this identity. */
  lastUsedAt: string | null;
  updatedAt: string;
}

/** Why a link was refused. `already_linked` is the same user and the same provider account (nothing to do). */
export type LinkRefusal = "already_linked" | "provider_account_taken" | "user_has_provider";
```

`apps/web/src/domain/flags.ts`: thay dòng `FLAG_KEYS` bằng

```ts
export const FLAG_KEYS = [
  "affiliate",
  "partner_referral",
  "sponsored_listings",
  "ads",
  "lead_generation",
  "ai_content",
  "content_indexing",
  // ADR-012 (EPIC 26): one per OAuth provider; off hides the button and makes the callback 404.
  "oauth_google",
  "oauth_github",
  "oauth_linkedin",
] as const;
```

và sửa comment đầu file cho khớp ("Every valid flag"). `apps/web/src/views/admin/FlagsPage.tsx`: thêm vào `DESC`

```ts
  oauth_google: "flags.desc.oauth_google",
  oauth_github: "flags.desc.oauth_github",
  oauth_linkedin: "flags.desc.oauth_linkedin",
```

i18n (chèn ngay sau `flags.desc.content_indexing` trong mỗi file):

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `flags.desc.oauth_google` | Sign-in and linking with Google. Off hides the button and the callback answers 404. | Đăng nhập và liên kết bằng Google. Tắt thì ẩn nút và callback trả 404. | 使用 Google 登录和关联账号。关闭后隐藏按钮，回调返回 404。 | 使用 Google 登入和連結帳號。關閉後隱藏按鈕，回呼回傳 404。 |
| `flags.desc.oauth_github` | Sign-in and linking with GitHub. Off hides the button and the callback answers 404. | Đăng nhập và liên kết bằng GitHub. Tắt thì ẩn nút và callback trả 404. | 使用 GitHub 登录和关联账号。关闭后隐藏按钮，回调返回 404。 | 使用 GitHub 登入和連結帳號。關閉後隱藏按鈕，回呼回傳 404。 |
| `flags.desc.oauth_linkedin` | Sign-in and linking with LinkedIn. Off hides the button and the callback answers 404. | Đăng nhập và liên kết bằng LinkedIn. Tắt thì ẩn nút và callback trả 404. | 使用 LinkedIn 登录和关联账号。关闭后隐藏按钮，回调返回 404。 | 使用 LinkedIn 登入和連結帳號。關閉後隱藏按鈕，回呼回傳 404。 |

Sửa thêm `flags.intro` (F8; văn bản chỉ admin thấy) để bao cả provider đăng nhập:

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `flags.intro` | Each revenue source, the content index and each sign-in provider has a switch. A flag with no setting is off. | Mỗi nguồn doanh thu, việc index nội dung và mỗi nhà cung cấp đăng nhập có một công tắc. Cờ chưa đặt là tắt. | 每个收入来源、内容收录和每个登录提供方都有一个开关。未设置的开关为关闭。 | 每個收入來源、內容收錄和每個登入提供方都有一個開關。未設定的開關為關閉。 |

Chạy lại: `npm test -w apps/web -- test/domain/identity.test.ts test/domain/flags.test.ts test/admin/flags.test.ts test/i18n/parity.test.ts` → PASS (`test/admin/flags.test.ts` lặp theo `FLAG_KEYS` nên tự bao ba khóa mới: mỗi khóa có form và `data-state="off"`).

- [ ] **Step 4: Test sessions và literal `SessionUser` (fail)**

Sửa `apps/web/test/auth/sessions.test.ts`: dòng `toEqual` đầu thành

```ts
    expect(await getSessionUser(testEnv.DB, sid, now)).toEqual({ id: u.id, email: "s@vnx.si", locale: "en", isAdmin: false, method: "magic_link" });
```

và thêm vào cuối `describe`:

```ts
  it("records how a session was created: magic_link by default, the OAuth method when given (ADR-012 §2)", async () => {
    const u = await createUser(testEnv.DB, { email: "method@vnx.si", locale: "en", now: now.toISOString() });
    const byDefault = await createSession(testEnv.DB, u.id, now);
    const viaGithub = await createSession(testEnv.DB, u.id, now, "oauth_github");
    expect((await getSessionUser(testEnv.DB, byDefault, now))?.method).toBe("magic_link");
    expect((await getSessionUser(testEnv.DB, viaGithub, now))?.method).toBe("oauth_github");
  });

  it("gives a row inserted without a method the magic_link default, and refuses a method outside the list", async () => {
    const u = await createUser(testEnv.DB, { email: "legacy@vnx.si", locale: "en", now: now.toISOString() });
    await testEnv.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES ('legacy-hash', ?1, '2099-01-01T00:00:00.000Z', ?2)").bind(u.id, now.toISOString()).run();
    const row = await testEnv.DB.prepare("SELECT method FROM sessions WHERE id_hash = 'legacy-hash'").first<{ method: string }>();
    expect(row?.method).toBe("magic_link");
    await expect(
      testEnv.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at, method) VALUES ('bad-hash', ?1, '2099-01-01T00:00:00.000Z', ?2, 'oauth_twitter')").bind(u.id, now.toISOString()).run(),
    ).rejects.toThrow();
  });
```

Sửa `apps/web/test/ops/guard.test.ts` dòng 106:

```ts
const sessionUser = (u: { id: string; email: string }): SessionUser => ({ id: u.id, email: u.email, locale: "en", isAdmin: false, method: "magic_link" });
```

Chạy: `npm test -w apps/web -- test/auth/sessions.test.ts` → FAIL (chưa có cột `method`, `createSession` chưa nhận tham số thứ tư).

- [ ] **Step 5: Sessions**

`apps/web/src/auth/sessions.ts` (thay các phần liên quan):

```ts
import { isSessionMethod, type SessionMethod } from "../domain/identity.ts";
import { randomToken, sha256Hex } from "./crypto.ts";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  locale: string;
  isAdmin: boolean;
  /** How the session was created (ADR-012 §2). /ops and /admin accept only "magic_link". */
  method: SessionMethod;
}

export async function createSession(db: D1Database, userId: string, now: Date, method: SessionMethod = "magic_link"): Promise<string> {
  const raw = randomToken();
  await db
    .prepare("INSERT INTO sessions (id_hash, user_id, expires_at, created_at, method) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(await sha256Hex(raw), userId, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), now.toISOString(), method)
    .run();
  return raw;
}

export async function getSessionUser(db: D1Database, raw: string, now: Date): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.locale, u.is_admin, s.method FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ?1 AND s.expires_at > ?2 AND u.status = 'active'`,
    )
    .bind(await sha256Hex(raw), now.toISOString())
    .first<{ id: string; email: string; locale: string; is_admin: number; method: string }>();
  // Fail closed: a method this code does not know (the CHECK makes that impossible) is no session, never a default one.
  if (!row || !isSessionMethod(row.method)) return null;
  return { id: row.id, email: row.email, locale: row.locale, isAdmin: row.is_admin === 1, method: row.method };
}
```

Các hàm `deleteSession`, `deleteExpiredSessions`, `deleteUserSessionsStatement` giữ nguyên.

Chạy: `npm test -w apps/web -- test/auth/sessions.test.ts test/ops/guard.test.ts test/auth/session-middleware.test.ts` → PASS.

- [ ] **Step 6: Test db và kiến trúc (fail)**

`apps/web/test/db/identities.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { findIdentityByProviderSubject, linkIdentity, listIdentitiesForUser, touchIdentityLogin, unlinkIdentity } from "../../src/db/identities.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-07T09:00:00.000Z";
const LATER = "2026-10-08T09:00:00.000Z";

let seq = 0;
const newUser = () => ensureUser(`ident-${++seq}@vnx.si`);
const audits = async (userId: string, action: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = ?2 ORDER BY id").bind(userId, action).all<{ data: string }>()).results.map((r) => r.data);
const rawInsert = (id: string, userId: string, provider: string, subject: string, show = 0) =>
  testEnv.DB
    .prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'x', ?5, ?6, ?6)")
    .bind(id, userId, provider, subject, show, NOW)
    .run();

describe("user_identities (ADR-012 §2, §4)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM user_identities").run();
  });

  it("links an account the user does not have and audits it with the provider only", async () => {
    const user = await newUser();
    const result = await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "1234567", label: "octocat", now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity).toMatchObject({ userId: user.id, provider: "github", subject: "1234567", label: "octocat", showOnProfile: false, linkedAt: NOW, lastUsedAt: null, updatedAt: NOW });
    expect(await findIdentityByProviderSubject(testEnv.DB, "github", "1234567")).toEqual(result.identity);
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toEqual([result.identity]);
    // No label (an e-mail for Google and LinkedIn), no subject, no token.
    expect(await audits(user.id, "auth.identity.link")).toEqual(['{"provider":"github"}']);
  });

  it("treats the same user linking the same account again as already linked, without a second audit row", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "a@example.com", now: NOW });
    const again = await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "changed@example.com", now: LATER });
    expect(again).toEqual({ ok: false, reason: "already_linked" });
    expect(await audits(user.id, "auth.identity.link")).toHaveLength(1);
    expect((await findIdentityByProviderSubject(testEnv.DB, "google", "g-1"))?.label).toBe("a@example.com");
  });

  it("refuses a provider account that belongs to another user, and links nothing for the second user", async () => {
    const first = await newUser();
    const second = await newUser();
    await linkIdentity(testEnv.DB, { userId: first.id, provider: "google", subject: "g-shared", label: "owner@example.com", now: NOW });
    // The label equal to the second user's own e-mail changes nothing: e-mails never link accounts (ADR-012 decision 2).
    const refused = await linkIdentity(testEnv.DB, { userId: second.id, provider: "google", subject: "g-shared", label: second.email, now: LATER });
    expect(refused).toEqual({ ok: false, reason: "provider_account_taken" });
    expect(await listIdentitiesForUser(testEnv.DB, second.id)).toEqual([]);
    expect((await findIdentityByProviderSubject(testEnv.DB, "google", "g-shared"))?.userId).toBe(first.id);
    expect(await audits(second.id, "auth.identity.link")).toEqual([]);
  });

  it("allows one account per provider per user, and one of each provider", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-1", label: "a@example.com", now: NOW });
    expect(await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-2", label: "b@example.com", now: NOW })).toEqual({ ok: false, reason: "user_has_provider" });
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "42", label: "octocat", now: NOW })).ok).toBe(true);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: NOW })).ok).toBe(true);
    expect((await listIdentitiesForUser(testEnv.DB, user.id)).map((i) => i.provider)).toEqual(["github", "google", "linkedin"]);
    expect(await audits(user.id, "auth.identity.link")).toHaveLength(3);
  });

  it("unlinks an account the user holds, audits it, and lets the account be linked again", async () => {
    const user = await newUser();
    await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: NOW });
    const removed = await unlinkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", now: LATER });
    expect(removed).toMatchObject({ provider: "linkedin", subject: "li-1" });
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toEqual([]);
    expect(await audits(user.id, "auth.identity.unlink")).toEqual(['{"provider":"linkedin"}']);
    expect(await unlinkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", now: LATER })).toBeNull();
    expect(await audits(user.id, "auth.identity.unlink")).toHaveLength(1);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "linkedin", subject: "li-1", label: "lan@example.com", now: LATER })).ok).toBe(true);
  });

  it("never unlinks another user's account", async () => {
    const owner = await newUser();
    const other = await newUser();
    await linkIdentity(testEnv.DB, { userId: owner.id, provider: "github", subject: "77", label: "octocat", now: NOW });
    expect(await unlinkIdentity(testEnv.DB, { userId: other.id, provider: "github", now: LATER })).toBeNull();
    expect(await listIdentitiesForUser(testEnv.DB, owner.id)).toHaveLength(1);
    expect(await audits(other.id, "auth.identity.unlink")).toEqual([]);
  });

  it("refreshes the label and the last-used time on a sign-in", async () => {
    const user = await newUser();
    const linked = await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: "9", label: "old-login", now: NOW });
    if (!linked.ok) throw new Error("link failed");
    await touchIdentityLogin(testEnv.DB, { id: linked.identity.id, label: "new-login", now: LATER });
    const [identity] = await listIdentitiesForUser(testEnv.DB, user.id);
    expect(identity).toMatchObject({ label: "new-login", lastUsedAt: LATER, updatedAt: LATER, linkedAt: NOW, subject: "9" });
  });

  it("enforces the rules in SQL as well: provider list, 0/1 flag, one account per provider, one user per account", async () => {
    const a = await newUser();
    const b = await newUser();
    await expect(rawInsert("i-twitter", a.id, "twitter", "t-1")).rejects.toThrow();
    await expect(rawInsert("i-flag", a.id, "google", "g-flag", 2)).rejects.toThrow();
    await expect(rawInsert("i-empty", a.id, "google", "")).rejects.toThrow();
    await rawInsert("i-1", a.id, "google", "g-1");
    await expect(rawInsert("i-2", b.id, "google", "g-1")).rejects.toThrow(); // same provider account, other user
    await expect(rawInsert("i-3", a.id, "google", "g-2")).rejects.toThrow(); // same user, same provider, other account
    await rawInsert("i-4", b.id, "github", "g-1"); // the same subject at another provider is a different account
  });

  it("has no column that could hold a token (ADR-012 §1)", async () => {
    const { results } = await testEnv.DB.prepare("PRAGMA table_info(user_identities)").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["id", "user_id", "provider", "provider_subject", "label", "show_on_profile", "linked_at", "last_used_at", "updated_at"]);
  });
});
```

Sửa `apps/web/test/architecture.test.ts`: thêm vào `WRITERS` (sau `ops_member_invites`)

```ts
  user_identities: "../src/db/identities.ts",
```

và thêm cuối file:

```ts
// ADR-012 §5, ADR-004: linked identities are read and written only by their module. Ranking, public and builder-facing code
// never touch the table. Each task adds the files it creates (2604b: routes/oauth.tsx; 2605a: routes/me.tsx; 2606b: routes/builder-profile.tsx, ...).
// db/audit.ts is on the list only because the identity audit guard reads `id` and `user_id` of the row; it reads nothing else.
const IDENTITY_ALLOWED = new Set<string>(["../src/db/identities.ts", "../src/db/audit.ts"]);

describe("linked identities stay in their module (ADR-012 §5, ADR-004)", () => {
  it("the allowlist holds only files that exist, and no ranking file is on it", () => {
    for (const file of IDENTITY_ALLOWED) expect(sources[file], file).toBeDefined();
    for (const file of RANKING_FILES) expect(IDENTITY_ALLOWED.has(file), file).toBe(false);
  });

  it("ranking files import no identities module and run no SQL on user_identities", () => {
    for (const file of RANKING_FILES) {
      expect(sources[file], `${file} imports db/identities`).not.toMatch(/from\s+["'][^"']*\/db\/identities\.ts["']/);
      expect(sources[file], `${file} reads user_identities`).not.toMatch(/\b(?:FROM|JOIN|INTO|UPDATE)\s+user_identities\b/);
    }
  });

  it("only allowlisted files import db/identities.ts or run SQL on user_identities", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (IDENTITY_ALLOWED.has(file)) continue;
      expect(src, `${file} imports db/identities`).not.toMatch(/from\s+["'][^"']*\/db\/identities\.ts["']/);
      expect(src, `${file} touches user_identities`).not.toMatch(/\b(?:FROM|JOIN|INTO|UPDATE)\s+user_identities\b/);
    }
  });
});
```

Chạy: `npm test -w apps/web -- test/db/identities.test.ts test/architecture.test.ts` → FAIL (`db/identities.ts` chưa có; bảng `user_identities` chưa có trong `WRITERS` thì test sở hữu bảng sẽ báo khi file mới xuất hiện).

- [ ] **Step 7: Audit guard và `db/identities.ts`**

`apps/web/src/db/audit.ts`: thêm kiểu (cạnh `AuditFlagGuard`)

```ts
/**
 * Written only when that `user_identities` row exists now and belongs to that user (ADR-012 §4). Link: after the batch's INSERT
 * (the id is a fresh ULID, so the row exists only if that INSERT went through). Unlink: before the batch's DELETE, since the row is gone after it.
 */
export type AuditIdentityGuard = { identityId: string; userId: string };
```

thêm `| AuditIdentityGuard` vào union tham số `onlyIf` của `auditStatement`, và chèn nhánh này **ngay sau** `if (!onlyIf) { … }` và **trước** `if ("userId" in onlyIf)` (guard này cũng có khóa `userId`; đặt sau thì `AuditUserGuard` nuốt nó):

```ts
  if ("identityId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM user_identities WHERE id = ?8 AND user_id = ?9)`,
      )
      .bind(...values, onlyIf.identityId, onlyIf.userId);
  }
```

Cập nhật đoạn JSDoc của `auditStatement` thêm: "`identityId` + `userId` on the identity row existing for that user".

`apps/web/src/db/identities.ts`:

```ts
import { IDENTITY_AUDIT, type LinkRefusal, type OAuthProvider, type UserIdentity } from "../domain/identity.ts";
import { ulid } from "../lib/ulid.ts";
import { auditStatement } from "./audit.ts";

/**
 * The only writer of `user_identities` (module `identity`, EPIC 26, VNX-2602). Linked accounts of one user: provider, the provider's
 * immutable subject, a label for the owner to recognise it, the opt-in badge flag. No token is ever stored (ADR-012 §1).
 * Link and unlink write their audit row in the same db.batch (the row carries the provider only).
 */

type Row = {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_subject: string;
  label: string;
  show_on_profile: number;
  linked_at: string;
  last_used_at: string | null;
  updated_at: string;
};

const toIdentity = (r: Row): UserIdentity => ({
  id: r.id,
  userId: r.user_id,
  provider: r.provider,
  subject: r.provider_subject,
  label: r.label,
  showOnProfile: r.show_on_profile === 1,
  linkedAt: r.linked_at,
  lastUsedAt: r.last_used_at,
  updatedAt: r.updated_at,
});

export type LinkResult = { ok: true; identity: UserIdentity } | { ok: false; reason: LinkRefusal };

async function findIdentityById(db: D1Database, id: string): Promise<UserIdentity | null> {
  const row = await db.prepare("SELECT * FROM user_identities WHERE id = ?1").bind(id).first<Row>();
  return row ? toIdentity(row) : null;
}

/** The sign-in lookup: who, if anyone, has linked this provider account. */
export async function findIdentityByProviderSubject(db: D1Database, provider: OAuthProvider, subject: string): Promise<UserIdentity | null> {
  const row = await db.prepare("SELECT * FROM user_identities WHERE provider = ?1 AND provider_subject = ?2").bind(provider, subject).first<Row>();
  return row ? toIdentity(row) : null;
}

/** One user's linked accounts, ordered by provider. For that user's own account page only. */
export async function listIdentitiesForUser(db: D1Database, userId: string): Promise<UserIdentity[]> {
  const { results } = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 ORDER BY provider").bind(userId).all<Row>();
  return results.map(toIdentity);
}

/**
 * Links a provider account to a user and audits it, atomically. `ON CONFLICT DO NOTHING` covers both UNIQUE constraints; when nothing
 * was inserted, one read says why: the same user already holds this account (`already_linked`, nothing changes), another user holds it
 * (`provider_account_taken`, who is never returned), or this user holds a different account of that provider (`user_has_provider`).
 */
export async function linkIdentity(
  db: D1Database,
  input: { userId: string; provider: OAuthProvider; subject: string; label: string; now: string },
): Promise<LinkResult> {
  const id = ulid(Date.parse(input.now));
  const [insert] = await db.batch<{ id: string }>([
    db
      .prepare(
        `INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, last_used_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, NULL, ?6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
      )
      .bind(id, input.userId, input.provider, input.subject, input.label, input.now),
    auditStatement(
      db,
      { actorUserId: input.userId, action: IDENTITY_AUDIT.link, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: id, userId: input.userId },
    ),
  ]);
  if (insert?.results.length) {
    const identity = await findIdentityById(db, id);
    if (!identity) throw new Error("identity insert failed");
    return { ok: true, identity };
  }
  const holder = await findIdentityByProviderSubject(db, input.provider, input.subject);
  if (holder) return { ok: false, reason: holder.userId === input.userId ? "already_linked" : "provider_account_taken" };
  return { ok: false, reason: "user_has_provider" };
}

/**
 * Removes the user's account of that provider and audits it, atomically. The audit statement runs first: it is guarded on the row
 * existing for that user, which is no longer true after the DELETE. Null (and no audit row) when the user has none.
 */
export async function unlinkIdentity(db: D1Database, input: { userId: string; provider: OAuthProvider; now: string }): Promise<UserIdentity | null> {
  const existing = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(input.userId, input.provider).first<Row>();
  if (!existing) return null;
  const [, removed] = await db.batch<{ id: string }>([
    auditStatement(
      db,
      { actorUserId: input.userId, action: IDENTITY_AUDIT.unlink, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: existing.id, userId: input.userId },
    ),
    db.prepare("DELETE FROM user_identities WHERE id = ?1 AND user_id = ?2 RETURNING id").bind(existing.id, input.userId),
  ]);
  return removed?.results.length ? toIdentity(existing) : null;
}

/** A sign-in with this identity: records the time and refreshes the label (the GitHub login can change; ADR-012 §5). */
export async function touchIdentityLogin(db: D1Database, input: { id: string; label: string; now: string }): Promise<void> {
  await db.prepare("UPDATE user_identities SET label = ?2, last_used_at = ?3, updated_at = ?3 WHERE id = ?1").bind(input.id, input.label, input.now).run();
}
```

Chạy: `npm test -w apps/web -- test/db/identities.test.ts test/architecture.test.ts` → PASS.

- [ ] **Step 8: Kiểm migration trên D1 local (tùy chọn nhưng nên làm một lần)**

```
npm run db:migrate:local -w apps/web
```

Kỳ vọng: áp `0017_user_identities.sql` không lỗi (`ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT … CHECK` hợp lệ trong SQLite của D1). Nếu `0014`–`0016` chưa có trong nhánh này, thấy bình thường; không đổi số.

- [ ] **Step 9: Kiểm toàn bộ và commit**

```
npm run typecheck -w apps/web
npm test
```

Kỳ vọng: typecheck sạch (mọi literal `SessionUser` đã có `method`; `FlagsPage` `DESC` đủ mười khóa); toàn bộ test xanh, gồm `test/i18n/parity.test.ts` và `test/admin/flags.test.ts`.

Kiểm không có bí mật hay token trong diff, rồi commit:

```
git add apps/web/migrations/0017_user_identities.sql apps/web/src/domain/identity.ts apps/web/src/db/identities.ts apps/web/src/domain/flags.ts apps/web/src/auth/sessions.ts apps/web/src/db/audit.ts apps/web/src/views/admin/FlagsPage.tsx apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/wrangler.jsonc apps/web/test/architecture.test.ts apps/web/test/domain/flags.test.ts apps/web/test/domain/identity.test.ts apps/web/test/db/identities.test.ts apps/web/test/auth/sessions.test.ts apps/web/test/ops/guard.test.ts
git commit -m "feat(web): linked identities table, session method and OAuth flags (VNX-2602)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận của task (mỗi dòng một lệnh):**

| # | Tiêu chí | Lệnh |
|---|---|---|
| 1 | Provider, phương thức session, cờ theo provider, action audit đúng ADR-012 | `npm test -w apps/web -- test/domain/identity.test.ts` |
| 2 | `FLAG_KEYS` có đúng mười khóa theo thứ tự; `/admin/flags` hiện cả ba cờ mới, mặc định tắt | `npm test -w apps/web -- test/domain/flags.test.ts test/admin/flags.test.ts` |
| 3 | Hai UNIQUE, CHECK provider và cờ 0/1 chặn ở SQL; một tài khoản provider không gắn được với hai user; mỗi user một identity mỗi provider | `npm test -w apps/web -- test/db/identities.test.ts` |
| 4 | Link/unlink ghi audit cùng batch, chỉ `{ provider }`, không audit khi không đổi gì; không unlink được identity của người khác | `npm test -w apps/web -- test/db/identities.test.ts` |
| 5 | Bảng không có cột token | `npm test -w apps/web -- test/db/identities.test.ts` |
| 6 | `sessions.method` mặc định `magic_link`, `createSession` ghi phương thức, giá trị lạ bị từ chối, `getSessionUser` trả `method` | `npm test -w apps/web -- test/auth/sessions.test.ts` |
| 7 | Chỉ `db/identities.ts` (và guard trong `db/audit.ts`) chạm `user_identities`; file xếp hạng không bao giờ | `npm test -w apps/web -- test/architecture.test.ts` |
| 8 | Parity i18n bốn locale cho ba khóa mới | `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 9 | Migration áp được trên D1 local | `npm run db:migrate:local -w apps/web` |
| 10 | Typecheck và toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

**Kích cỡ ước tính:** mã nguồn ~230 dòng (migration 25, `domain/identity.ts` 60, `db/identities.ts` 110, `sessions.ts` +15, `audit.ts` +15, cờ và `FlagsPage` +20), test ~300 dòng, locale 12 dòng. Dưới 600 dòng không tính locale.

---

### Task 2: VNX-2603a — Lõi OAuth: PKCE, `state`, kiểm claim ID token, cookie `__Host-vnx_oauth`

**Files:**
- Create: `apps/web/src/domain/oauth.ts` (thuần: không Hono, không D1; chỉ dùng WebCrypto toàn cục)
- Create: `apps/web/src/auth/oauth-cookie.ts`
- Test: `apps/web/test/domain/oauth.test.ts`, `apps/web/test/auth/oauth-cookie.test.ts`
- Không sửa file có sẵn nào. Không có chuỗi giao diện (không khóa i18n). Không có route, không đụng DB.

**Interfaces:**
- Consumes: `OAuthProvider` (`domain/identity.ts`); `isLocale`, `Locale` (`i18n/locales.ts`); `sha256Hex` (`auth/crypto.ts`); `AppEnv` (`env.ts`); `getCookie`, `setCookie`, `deleteCookie` (`hono/cookie`, cùng kiểu `auth/invite-cookie.ts`).
- Produces, `domain/oauth.ts`:
  - `type OAuthIntent = "signin" | "link"`; `OAUTH_FLOW_TTL_MS = 600_000`, `LINK_INTENT_TTL_MS = 120_000`.
  - `interface OAuthProviderSpec { authorizeUrl; scope; oidc; issuers }` và `OAUTH_PROVIDER_SPECS: Record<OAuthProvider, OAuthProviderSpec>` (URL authorize, scope và `iss` hợp lệ của từng provider; URL token endpoint KHÔNG ở đây, thuộc adapter Task 3).
  - `base64UrlEncode(bytes): string`, `base64UrlDecode(text): Uint8Array | null`, `timingSafeEqualText(a, b): boolean` (R2).
  - `generateState()`, `generateNonce()`, `generateVerifier()` (mỗi hàm 32 byte ngẫu nhiên thành 43 ký tự base64url), `codeChallengeS256(verifier): Promise<string>`.
  - `oauthRedirectUri(appOrigin, provider): string`, `buildAuthorizeUrl({ provider, clientId, redirectUri, state, challenge, nonce }): string`.
  - `verifyIdToken(idToken, { issuers, audience, nonce, now }): IdTokenResult` với `IdTokenResult = { ok: true; claims: { subject: string; email: string | null } } | { ok: false; reason: IdTokenFailure }`, `IdTokenFailure = "malformed" | "issuer" | "audience" | "azp" | "expired" | "nonce" | "subject"`.
  - Cookie: `LinkIntentCookie`, `FlowCookie`, `type OAuthCookie = LinkIntentCookie | FlowCookie`; `newLinkIntent({ provider, sessionHash }, now)`, `newFlowCookie({ provider, intent, state, verifier, nonce, next, locale, sessionHash }, now)`, `encodeOAuthCookie(cookie): string`, `parseOAuthCookie(raw, { provider, now }): OAuthCookie | null`.
  - Quyết định thuần cho route: `resolveStartIntent(cookie, sessionHash, now): OAuthIntent`, `checkCallbackState(cookie, stateParam): CallbackCheck` với `CallbackCheck = { ok: true; flow: FlowCookie } | { ok: false; reason: "no_cookie" | "wrong_phase" | "state_mismatch" }`, `flowMatchesSession(flow, sessionHash): boolean`.
- Produces, `auth/oauth-cookie.ts`: `OAUTH_COOKIE = "__Host-vnx_oauth"`, `readOAuthCookie(c, provider, now?)`, `writeOAuthCookie(c, cookie, now?)`, `clearOAuthCookie(c)`, `linkSessionHash(rawSessionId): Promise<string>`.

**Quyết định kỹ thuật:**
- **Hai pha trong một cookie (quyết định 4).** Pha `intent` do `POST …/link` ghi (chỉ `provider`, `intent: "link"`, `sessionHash`, hạn 120 s). Pha `flow` do `GET …/start` ghi (đủ `state`, `verifier`, `nonce`, `intent`, `next`, `locale`, `sessionHash`, hạn 600 s). Cả hai cùng tên cookie `__Host-vnx_oauth`, nên `start` ghi đè intent bằng flow; callback chỉ chấp nhận pha `flow`.
- **F5 nằm trong `parseOAuthCookie`:** nhận `provider` mong đợi (từ `:provider` của URL) và trả `null` nếu cookie thuộc provider khác. Mọi lý do hỏng (thiếu, sai provider, quá hạn, sai hình dạng) cùng trả `null`; callback chỉ phân biệt `no_cookie`, `wrong_phase`, `state_mismatch` để đặt mã log cố định.
- **`exp` do server đặt, nhưng cookie không ký, nên parse cũng chặn `exp` quá xa:** `exp - now` không được vượt TTL của pha đó. Các kiểm tra hình dạng (regex `state`/`verifier`/`nonce` 43–128 ký tự `[A-Za-z0-9_-]`, `sessionHash` 64 hex thường, `next` ≤ 512 ký tự, `locale` thuộc `LOCALES`, nhất quán `intent` và `sessionHash`) chặn cookie dị dạng trước khi route dùng.
- **`next` chỉ là chuỗi ≤ 512 ký tự trong cookie;** route (Task 6) vẫn gọi `safeNext` lúc dùng. `newFlowCookie` đổi `next` quá dài thành `null` thay vì ném lỗi; nhưng ném lỗi khi `intent` và `sessionHash` không nhất quán (lỗi lập trình).
- **`sessionHash` (S1):** `sha256("oauth-link:" + raw session id)` qua `linkSessionHash` (ở `auth/`, vì cần `sha256Hex`; domain không import `auth/`), không bao giờ là `sessions.id_hash`. `signin` luôn `sessionHash: null`.
- **So sánh hằng thời gian (R2):** `timingSafeEqualText` mã hóa hai chuỗi UTF-8; khác độ dài thì trả `false` ngay (`crypto.subtle.timingSafeEqual` của workerd ném lỗi khi độ dài khác nhau; độ dài của `state`/`nonce`/hash là công khai nên không lộ gì), cùng độ dài thì gọi `crypto.subtle.timingSafeEqual`. Dùng cho `state`, `nonce`, `sessionHash`.
- **`verifyIdToken` đúng quyết định 3:** không kiểm chữ ký; kiểm (c) `iss` khớp chính xác một giá trị trong `issuers` (không so tiền tố, dấu `/` cuối là sai), (d) `aud` chứa client ID (chuỗi hoặc mảng), `azp` nếu có thì bằng client ID, `aud` nhiều phần tử mà thiếu `azp` thì từ chối (OIDC Core §2), `exp + 60 s` còn trong tương lai, `nonce` khớp, `sub` là chuỗi 1–255 ký tự (khớp CHECK của `provider_subject`). Điều kiện (a) và (b) thuộc adapter (Task 3). `audience` hoặc `nonce` mong đợi rỗng thì `malformed` (fail closed: client ID chưa cấu hình không bao giờ khớp `aud` rỗng).
- **Kết quả không bao gồm `name`** (F2): chỉ `subject` và `email` (hoặc `null` khi thiếu hay dài hơn 254 ký tự); adapter ở Task 3 tự quyết `label` (và test CHECK `label` thuộc Task 3).
- **Không log gì** trong module này; không module nào của task này chạm token, `code` hay secret (cookie chứa `verifier`, `state`, `nonce`: HttpOnly, 10 phút, xóa sau callback).
- Task này không có route, nên Review Focus 1 và 9 được bao ở tầng đơn vị; route nối vào ở Task 6. Quyết định 11 (header của response callback) thuộc Task 6.

- [ ] **Step 1: Test domain (fail)**

`apps/web/test/domain/oauth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  base64UrlDecode,
  base64UrlEncode,
  buildAuthorizeUrl,
  checkCallbackState,
  codeChallengeS256,
  encodeOAuthCookie,
  flowMatchesSession,
  generateNonce,
  generateState,
  generateVerifier,
  LINK_INTENT_TTL_MS,
  newFlowCookie,
  newLinkIntent,
  OAUTH_FLOW_TTL_MS,
  OAUTH_PROVIDER_SPECS,
  oauthRedirectUri,
  parseOAuthCookie,
  resolveStartIntent,
  timingSafeEqualText,
  verifyIdToken,
} from "../../src/domain/oauth.ts";
import type { OAuthProvider } from "../../src/domain/identity.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

describe("PKCE and random values (RFC 7636, ADR-012 §1)", () => {
  it("derives the S256 challenge of the RFC 7636 appendix B verifier", async () => {
    expect(await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates 43-character URL-safe values that never repeat", async () => {
    const seen = new Set<string>();
    for (const make of [generateState, generateNonce, generateVerifier, generateState, generateNonce, generateVerifier]) {
      const value = make();
      expect(value).toMatch(TOKEN);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
    expect(await codeChallengeS256(generateVerifier())).toMatch(TOKEN);
  });

  it("round-trips base64url and refuses text outside the alphabet", () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255]);
    expect([...(base64UrlDecode(base64UrlEncode(bytes)) ?? [])]).toEqual([...bytes]);
    for (const bad of ["a+b", "a/b", "a=b", "a b", "a", "é"]) expect(base64UrlDecode(bad), bad).toBeNull();
  });
});

describe("timingSafeEqualText (decision 2, R2)", () => {
  it("is true only for identical text, and false for any difference in content or length", () => {
    expect(timingSafeEqualText("abc", "abc")).toBe(true);
    expect(timingSafeEqualText("", "")).toBe(true);
    for (const [a, b] of [["abc", "abd"], ["abc", "ab"], ["ab", "abc"], ["abc", ""], ["é", "e"]] as const) expect(timingSafeEqualText(a, b), `${a}|${b}`).toBe(false);
  });
});

describe("providers and the authorize URL (ADR-012 §1)", () => {
  it("fixes scopes and issuers per provider", () => {
    expect(OAUTH_PROVIDER_SPECS.google).toMatchObject({ scope: "openid email", oidc: true, issuers: ["https://accounts.google.com", "accounts.google.com"] });
    expect(OAUTH_PROVIDER_SPECS.linkedin).toMatchObject({ scope: "openid profile email", oidc: true, issuers: ["https://www.linkedin.com/oauth"] });
    expect(OAUTH_PROVIDER_SPECS.github).toMatchObject({ scope: "", oidc: false, issuers: [] });
  });

  it("builds the callback URI from APP_ORIGIN only, with no locale prefix", () => {
    expect(oauthRedirectUri("https://vnx.si", "google")).toBe("https://vnx.si/auth/oauth/google/callback");
    expect(oauthRedirectUri("https://vnx.si/some/path?x=1", "github")).toBe("https://vnx.si/auth/oauth/github/callback");
  });

  const input = { clientId: "client-1", redirectUri: "https://vnx.si/auth/oauth/google/callback", state: "s".repeat(43), challenge: "c".repeat(43), nonce: "n".repeat(43) };

  it("builds a Google URL with PKCE S256, state, nonce and exactly the known parameters", () => {
    const url = new URL(buildAuthorizeUrl({ provider: "google", ...input }));
    expect(`${url.origin}${url.pathname}`).toBe(OAUTH_PROVIDER_SPECS.google.authorizeUrl);
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "code_challenge", "code_challenge_method", "nonce", "redirect_uri", "response_type", "scope", "state"]);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "client-1",
      redirect_uri: input.redirectUri,
      scope: "openid email",
      state: input.state,
      code_challenge: input.challenge,
      code_challenge_method: "S256",
      nonce: input.nonce,
    });
  });

  it("asks GitHub for no scope and no nonce, and LinkedIn for openid profile email", () => {
    const github = new URL(buildAuthorizeUrl({ provider: "github", ...input }));
    expect(github.searchParams.has("scope")).toBe(false);
    expect(github.searchParams.has("nonce")).toBe(false);
    expect(github.searchParams.get("code_challenge_method")).toBe("S256");
    const linkedin = new URL(buildAuthorizeUrl({ provider: "linkedin", ...input }));
    expect(linkedin.searchParams.get("scope")).toBe("openid profile email");
    expect(linkedin.searchParams.get("nonce")).toBe(input.nonce);
  });
});

const enc = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const idToken = (claims: unknown, signature = "c2ln") => `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.${signature}`;
const NONCE = "n".repeat(43);
const GOOD = { iss: "https://accounts.google.com", aud: "client-1", azp: "client-1", sub: "1122334455", exp: NOW / 1000 + 600, nonce: NONCE, email: "lan@example.com", name: "Lan Nguyen" };
const EXPECTED = { issuers: OAUTH_PROVIDER_SPECS.google.issuers, audience: "client-1", nonce: NONCE, now: NOW };
const reason = (claims: unknown, expected = EXPECTED) => {
  const result = verifyIdToken(idToken(claims), expected);
  return result.ok ? "ok" : result.reason;
};

describe("verifyIdToken (ADR-012 §1, decision 3 (c) and (d))", () => {
  it("returns only the subject and the e-mail, never the name", () => {
    expect(verifyIdToken(idToken(GOOD), EXPECTED)).toEqual({ ok: true, claims: { subject: "1122334455", email: "lan@example.com" } });
  });

  it("accepts both Google issuer spellings and a token with no azp and a single audience", () => {
    expect(reason({ ...GOOD, iss: "accounts.google.com" })).toBe("ok");
    const { azp: _azp, ...noAzp } = GOOD;
    expect(reason(noAzp)).toBe("ok");
    expect(reason({ ...GOOD, aud: ["client-1"] })).toBe("ok");
  });

  it("gives a missing, empty or over-long e-mail as null instead of failing", () => {
    for (const email of [undefined, "", "x".repeat(255), 42]) {
      const result = verifyIdToken(idToken({ ...GOOD, email }), EXPECTED);
      expect(result, String(email)).toEqual({ ok: true, claims: { subject: "1122334455", email: null } });
    }
  });

  it("refuses any issuer that is not exactly listed", () => {
    for (const iss of ["https://evil.example", "https://accounts.google.com/", "https://accounts.google.com.evil.example", "http://accounts.google.com", "ACCOUNTS.GOOGLE.COM", "", 7, undefined]) {
      expect(reason({ ...GOOD, iss }), String(iss)).toBe("issuer");
    }
    // LinkedIn's issuer is not Google's, and GitHub (no issuers) accepts nothing.
    expect(reason(GOOD, { ...EXPECTED, issuers: OAUTH_PROVIDER_SPECS.linkedin.issuers })).toBe("issuer");
    expect(reason(GOOD, { ...EXPECTED, issuers: OAUTH_PROVIDER_SPECS.github.issuers })).toBe("issuer");
  });

  it("requires aud to contain the client id, and azp, when present, to equal it", () => {
    expect(reason({ ...GOOD, aud: "other-client" })).toBe("audience");
    expect(reason({ ...GOOD, aud: ["other-client", "third"] })).toBe("audience");
    expect(reason({ ...GOOD, aud: undefined })).toBe("audience");
    expect(reason({ ...GOOD, azp: "other-client" })).toBe("azp");
    expect(reason({ ...GOOD, azp: 5 })).toBe("azp");
    const { azp: _azp, ...noAzp } = GOOD;
    expect(reason({ ...noAzp, aud: ["client-1", "other-client"] })).toBe("azp");
    expect(reason({ ...GOOD, aud: ["client-1", "other-client"] })).toBe("ok");
  });

  it("refuses an expired token with 60 seconds of clock tolerance", () => {
    expect(reason({ ...GOOD, exp: NOW / 1000 - 30 })).toBe("ok");
    expect(reason({ ...GOOD, exp: NOW / 1000 - 61 })).toBe("expired");
    for (const exp of [undefined, "9999999999", null]) expect(reason({ ...GOOD, exp }), String(exp)).toBe("expired");
  });

  it("refuses a missing or different nonce", () => {
    expect(reason({ ...GOOD, nonce: "m".repeat(43) })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: NONCE.slice(1) })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: undefined })).toBe("nonce");
    expect(reason({ ...GOOD, nonce: 123 })).toBe("nonce");
  });

  it("refuses a missing, empty or over-long subject", () => {
    for (const sub of [undefined, "", "s".repeat(256), 12345, null]) expect(reason({ ...GOOD, sub }), String(sub)).toBe("subject");
    expect(reason({ ...GOOD, sub: "s".repeat(255) })).toBe("ok");
  });

  it("refuses text that is not a three-part token with a JSON object payload", () => {
    const notJson = base64UrlEncode(new TextEncoder().encode("not json"));
    for (const bad of ["", "a.b", "a.b.c.d", `${enc({})}.!!!.sig`, `${enc({})}.${notJson}.sig`, `${enc({})}.${enc([1, 2])}.sig`, `${enc({})}.${enc("text")}.sig`]) {
      expect(verifyIdToken(bad, EXPECTED), bad).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("fails closed when the expected client id or nonce is empty", () => {
    expect(reason({ ...GOOD, aud: "" }, { ...EXPECTED, audience: "" })).toBe("malformed");
    expect(reason({ ...GOOD, nonce: "" }, { ...EXPECTED, nonce: "" })).toBe("malformed");
  });

  it("does not check the signature (decision 3, approved deviation R1): the token comes from the token endpoint over TLS", () => {
    expect(verifyIdToken(idToken(GOOD, "AAAA"), EXPECTED).ok).toBe(true);
  });
});

describe("the state cookie (ADR-012 §1, decision 4)", () => {
  const flow = (over: Partial<Parameters<typeof newFlowCookie>[0]> = {}) =>
    newFlowCookie(
      { provider: "google", intent: "signin", state: generateState(), verifier: generateVerifier(), nonce: generateNonce(), next: "/hub", locale: "vi", sessionHash: null, ...over },
      NOW,
    );
  const parse = (raw: string, provider: OAuthProvider = "google", now = NOW) => parseOAuthCookie(raw, { provider, now });

  it("sets the lifetimes: 10 minutes for a flow, 2 minutes for a link intent", () => {
    expect(OAUTH_FLOW_TTL_MS).toBe(600_000);
    expect(LINK_INTENT_TTL_MS).toBe(120_000);
    expect(flow().exp).toBe(NOW + 600_000);
    expect(newLinkIntent({ provider: "github", sessionHash: HASH_A }, NOW).exp).toBe(NOW + 120_000);
  });

  it("round-trips a signin flow, a link flow and a link intent", () => {
    const signin = flow();
    expect(parse(encodeOAuthCookie(signin))).toEqual(signin);
    const link = flow({ intent: "link", sessionHash: HASH_A, next: null, locale: "zh-Hant" });
    expect(parse(encodeOAuthCookie(link))).toEqual(link);
    const intent = newLinkIntent({ provider: "linkedin", sessionHash: HASH_B }, NOW);
    expect(parse(encodeOAuthCookie(intent), "linkedin")).toEqual(intent);
  });

  it("refuses a cookie written for another provider (F5)", () => {
    expect(parse(encodeOAuthCookie(flow()), "github")).toBeNull();
    expect(parse(encodeOAuthCookie(newLinkIntent({ provider: "github", sessionHash: HASH_A }, NOW)))).toBeNull();
  });

  it("refuses an expired cookie, and one whose exp is further away than its lifetime allows", () => {
    expect(parse(encodeOAuthCookie(flow()), "google", NOW + 600_000)).toBeNull();
    expect(parse(encodeOAuthCookie(flow()), "google", NOW + 599_999)).not.toBeNull();
    expect(parse(enc({ ...flow(), exp: NOW + 600_001 }))).toBeNull();
    const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
    expect(parse(enc({ ...intent, exp: NOW + 120_001 }))).toBeNull();
    expect(parse(enc({ ...flow(), exp: "soon" }))).toBeNull();
  });

  it("refuses anything that is not a well-shaped cookie", () => {
    const good = { ...flow() };
    const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
    const bad: unknown[] = [
      { ...good, v: 2 },
      { ...good, phase: "other" },
      { ...good, state: "short" },
      { ...good, state: `${"s".repeat(42)}+` },
      { ...good, verifier: "v".repeat(129) },
      { ...good, nonce: undefined },
      { ...good, intent: "admin" },
      { ...good, locale: "fr" },
      { ...good, next: 5 },
      { ...good, next: `/${"x".repeat(512)}` },
      { ...good, sessionHash: HASH_A }, // a signin flow carries no session
      { ...good, intent: "link", sessionHash: null }, // a link flow needs one
      { ...good, intent: "link", sessionHash: "not-a-hash" },
      { ...intent, intent: "signin" },
      { ...intent, sessionHash: "A".repeat(64) },
      [],
      "text",
      5,
    ];
    for (const value of bad) expect(parse(enc(value)), JSON.stringify(value)).toBeNull();
    for (const raw of [undefined, null, "", "not base64 !", "e30", base64UrlEncode(new TextEncoder().encode("{bad json")), "A".repeat(2049)]) {
      expect(parseOAuthCookie(raw, { provider: "google", now: NOW }), String(raw)).toBeNull();
    }
  });

  it("drops a next that is too long instead of storing it, and refuses to build an inconsistent flow", () => {
    expect(flow({ next: `/${"x".repeat(600)}` }).next).toBeNull();
    expect(() => flow({ intent: "link", sessionHash: null })).toThrow();
    expect(() => flow({ intent: "signin", sessionHash: HASH_A })).toThrow();
  });
});

describe("start and callback decisions (ADR-012 §3, §4)", () => {
  const intent = newLinkIntent({ provider: "google", sessionHash: HASH_A }, NOW);
  const make = (kind: "signin" | "link") =>
    newFlowCookie({ provider: "google", intent: kind, state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: kind === "link" ? HASH_A : null }, NOW);
  const flow = make("signin");
  const linkFlow = make("link");

  it("starts a link only for a live intent cookie whose session hash matches the current session", () => {
    expect(resolveStartIntent(intent, HASH_A, NOW)).toBe("link");
    expect(resolveStartIntent(intent, HASH_B, NOW)).toBe("signin");
    expect(resolveStartIntent(intent, null, NOW)).toBe("signin");
    expect(resolveStartIntent(intent, HASH_A, NOW + LINK_INTENT_TTL_MS)).toBe("signin");
    expect(resolveStartIntent(null, HASH_A, NOW)).toBe("signin");
    // A flow cookie (a start that already ran) never turns into a link by itself.
    expect(resolveStartIntent(linkFlow, HASH_A, NOW)).toBe("signin");
  });

  it("accepts a callback only for a flow cookie whose state equals the state parameter", () => {
    expect(checkCallbackState(flow, "s".repeat(43))).toEqual({ ok: true, flow });
    expect(checkCallbackState(flow, "t".repeat(43))).toEqual({ ok: false, reason: "state_mismatch" });
    for (const state of [null, undefined, "", "s".repeat(42), "s".repeat(44)]) expect(checkCallbackState(flow, state), String(state)).toEqual({ ok: false, reason: "state_mismatch" });
    expect(checkCallbackState(null, "s".repeat(43))).toEqual({ ok: false, reason: "no_cookie" });
    expect(checkCallbackState(intent, "s".repeat(43))).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("lets a signin flow through and a link flow only for the same session", () => {
    expect(flowMatchesSession(flow, null)).toBe(true);
    expect(flowMatchesSession(linkFlow, HASH_A)).toBe(true);
    expect(flowMatchesSession(linkFlow, HASH_B)).toBe(false);
    expect(flowMatchesSession(linkFlow, null)).toBe(false);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/oauth.test.ts` → FAIL (`domain/oauth.ts` chưa có).

- [ ] **Step 2: `domain/oauth.ts`**

`apps/web/src/domain/oauth.ts`:

```ts
import { isLocale, type Locale } from "../i18n/locales.ts";
import type { OAuthProvider } from "./identity.ts";

/**
 * The OAuth core (ADR-012 §1; VNX-2603a). Pure: no Hono, no database, no I/O; WebCrypto only. It never sees a token endpoint,
 * a secret or an access token: the ID token claims it checks come from the adapter (Task 3), which got them from the
 * token endpoint over TLS (decision 3).
 */

export type OAuthIntent = "signin" | "link";

/** Lifetime of the sign-in cookie (ADR-012 §1) and of the short "link" intent a POST leaves for the start route (decision 4). */
export const OAUTH_FLOW_TTL_MS = 600_000;
export const LINK_INTENT_TTL_MS = 120_000;
/** Clock tolerance on `exp` (decision 3 (d)). */
const EXP_SKEW_SECONDS = 60;
const MAX_COOKIE_CHARS = 2048;
const MAX_NEXT_CHARS = 512;

export interface OAuthProviderSpec {
  authorizeUrl: string;
  /** Space-separated; empty means the parameter is left out (GitHub asks for no scope). */
  scope: string;
  /** OpenID Connect: adds `nonce` and an ID token to check. GitHub is plain OAuth 2.0. */
  oidc: boolean;
  /** Exact `iss` values accepted (decision 3 (c)). */
  issuers: readonly string[];
}

export const OAUTH_PROVIDER_SPECS: Record<OAuthProvider, OAuthProviderSpec> = {
  google: { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", scope: "openid email", oidc: true, issuers: ["https://accounts.google.com", "accounts.google.com"] },
  github: { authorizeUrl: "https://github.com/login/oauth/authorize", scope: "", oidc: false, issuers: [] },
  linkedin: { authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization", scope: "openid profile email", oidc: true, issuers: ["https://www.linkedin.com/oauth"] },
};

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null for anything outside the base64url alphabet or of an impossible length. */
export function base64UrlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "="));
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Constant-time equality of two strings (decision 2, R2). workerd's `timingSafeEqual` throws on different lengths; the
 * lengths of state, nonce and hashes are public, so a length mismatch returns false without comparing.
 */
export function timingSafeEqualText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y);
}

/** 32 random bytes as 43 base64url characters: a valid RFC 7636 verifier and a state or nonce with 256 bits of entropy. */
function randomValue(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}
export const generateState = randomValue;
export const generateNonce = randomValue;
export const generateVerifier = randomValue;

/** RFC 7636 §4.2 `S256`: BASE64URL(SHA-256(verifier)). */
export async function codeChallengeS256(verifier: string): Promise<string> {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

/** The fixed callback address (ADR-012 §1): no locale prefix, built from APP_ORIGIN and the provider only. */
export function oauthRedirectUri(appOrigin: string, provider: OAuthProvider): string {
  return new URL(`/auth/oauth/${provider}/callback`, appOrigin).toString();
}

/** Joins only the known parameters; nothing from a request reaches it except the values the caller generated. */
export function buildAuthorizeUrl(input: { provider: OAuthProvider; clientId: string; redirectUri: string; state: string; challenge: string; nonce: string }): string {
  const spec = OAUTH_PROVIDER_SPECS[input.provider];
  const url = new URL(spec.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  if (spec.scope) url.searchParams.set("scope", spec.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (spec.oidc) url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

export type IdTokenFailure = "malformed" | "issuer" | "audience" | "azp" | "expired" | "nonce" | "subject";
export type IdTokenResult = { ok: true; claims: { subject: string; email: string | null } } | { ok: false; reason: IdTokenFailure };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks the claims of an ID token the adapter received from the token endpoint (decision 3 (c), (d)). It does NOT verify the
 * signature: OIDC Core §3.1.3.7 item 6 allows that for a token received directly from the token endpoint over TLS (approved
 * roadmap deviation R1). Fails closed: an empty expected client id or nonce is `malformed`. Returns the subject and the e-mail
 * only: the name is never read (F2).
 */
export function verifyIdToken(idToken: string, expected: { issuers: readonly string[]; audience: string; nonce: string; now: number }): IdTokenResult {
  const fail = (reason: IdTokenFailure): IdTokenResult => ({ ok: false, reason });
  if (!expected.audience || !expected.nonce) return fail("malformed");
  const parts = idToken.split(".");
  if (parts.length !== 3) return fail("malformed");
  const bytes = base64UrlDecode(parts[1] ?? "");
  if (!bytes) return fail("malformed");
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return fail("malformed");
  }
  if (!isRecord(claims)) return fail("malformed");

  if (typeof claims.iss !== "string" || !expected.issuers.includes(claims.iss)) return fail("issuer");
  const audiences = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  if (!audiences.includes(expected.audience)) return fail("audience");
  // OIDC Core §2: with several audiences azp is required; whenever it is present it must be this client.
  if (claims.azp !== undefined ? claims.azp !== expected.audience : audiences.length > 1) return fail("azp");
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp + EXP_SKEW_SECONDS <= expected.now / 1000) return fail("expired");
  if (typeof claims.nonce !== "string" || !timingSafeEqualText(claims.nonce, expected.nonce)) return fail("nonce");
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) return fail("subject");
  const email = typeof claims.email === "string" && claims.email.length >= 1 && claims.email.length <= 254 ? claims.email : null;
  return { ok: true, claims: { subject: claims.sub, email } };
}

/** Left by `POST …/link` for the start route: "this signed-in session asked to link this provider". */
export interface LinkIntentCookie {
  v: 1;
  phase: "intent";
  provider: OAuthProvider;
  intent: "link";
  /** `sha256("oauth-link:" + raw session id)`, never the session's own `id_hash` (S1). */
  sessionHash: string;
  /** Epoch milliseconds. */
  exp: number;
}

/** Written by the start route; the callback accepts only this phase. */
export interface FlowCookie {
  v: 1;
  phase: "flow";
  provider: OAuthProvider;
  intent: OAuthIntent;
  state: string;
  verifier: string;
  nonce: string;
  /** A same-site path the route already ran through `safeNext`, or null. */
  next: string | null;
  locale: Locale;
  /** Set for `link` (the session that asked), null for `signin`. */
  sessionHash: string | null;
  exp: number;
}

export type OAuthCookie = LinkIntentCookie | FlowCookie;

export function newLinkIntent(input: { provider: OAuthProvider; sessionHash: string }, now: number): LinkIntentCookie {
  return { v: 1, phase: "intent", provider: input.provider, intent: "link", sessionHash: input.sessionHash, exp: now + LINK_INTENT_TTL_MS };
}

export function newFlowCookie(
  input: { provider: OAuthProvider; intent: OAuthIntent; state: string; verifier: string; nonce: string; next: string | null; locale: Locale; sessionHash: string | null },
  now: number,
): FlowCookie {
  if ((input.intent === "link") !== (input.sessionHash !== null)) throw new Error("a link flow needs a session hash, a signin flow must not have one");
  const next = input.next !== null && input.next.length <= MAX_NEXT_CHARS ? input.next : null;
  return { v: 1, phase: "flow", ...input, next, exp: now + OAUTH_FLOW_TTL_MS };
}

export function encodeOAuthCookie(cookie: OAuthCookie): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(cookie)));
}

const TOKEN = /^[A-Za-z0-9_-]{43,128}$/;
const HASH = /^[0-9a-f]{64}$/;

/**
 * The cookie is not signed (decision 4), so everything is checked: shape, lengths, the provider it was written for (F5: the
 * callback passes the `:provider` of its URL), expiry, and that `exp` is no further away than the phase's lifetime. Every defect
 * gives the same null.
 */
export function parseOAuthCookie(raw: string | null | undefined, expected: { provider: OAuthProvider; now: number }): OAuthCookie | null {
  if (!raw || raw.length > MAX_COOKIE_CHARS) return null;
  const bytes = base64UrlDecode(raw);
  if (!bytes) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== 1 || value.provider !== expected.provider) return null;
  const exp = value.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= expected.now) return null;

  if (value.phase === "intent") {
    if (value.intent !== "link" || typeof value.sessionHash !== "string" || !HASH.test(value.sessionHash) || exp - expected.now > LINK_INTENT_TTL_MS) return null;
    return { v: 1, phase: "intent", provider: expected.provider, intent: "link", sessionHash: value.sessionHash, exp };
  }
  if (value.phase !== "flow" || exp - expected.now > OAUTH_FLOW_TTL_MS) return null;
  const { intent, state, verifier, nonce, next, locale, sessionHash } = value;
  if (intent !== "signin" && intent !== "link") return null;
  if (typeof state !== "string" || !TOKEN.test(state) || typeof verifier !== "string" || !TOKEN.test(verifier) || typeof nonce !== "string" || !TOKEN.test(nonce)) return null;
  if (next !== null && (typeof next !== "string" || next.length > MAX_NEXT_CHARS)) return null;
  if (!isLocale(locale)) return null;
  if (intent === "link" ? typeof sessionHash !== "string" || !HASH.test(sessionHash) : sessionHash !== null) return null;
  return { v: 1, phase: "flow", provider: expected.provider, intent, state, verifier, nonce, next, locale, sessionHash: sessionHash as string | null, exp };
}

/**
 * The start route's choice (decision 4): "link" only for a live intent cookie whose session hash equals the hash of the session
 * making this request; anything else, a flow cookie included, is a plain sign-in. No URL parameter ever chooses the intent.
 */
export function resolveStartIntent(cookie: OAuthCookie | null, sessionHash: string | null, now: number): OAuthIntent {
  if (!cookie || cookie.phase !== "intent" || sessionHash === null || cookie.exp <= now) return "signin";
  return timingSafeEqualText(cookie.sessionHash, sessionHash) ? "link" : "signin";
}

export type CallbackCheck = { ok: true; flow: FlowCookie } | { ok: false; reason: "no_cookie" | "wrong_phase" | "state_mismatch" };

/** The callback's first gate: a flow cookie (already matched to `:provider` and unexpired by the parser) and the same `state`. */
export function checkCallbackState(cookie: OAuthCookie | null, stateParam: string | null | undefined): CallbackCheck {
  if (!cookie) return { ok: false, reason: "no_cookie" };
  if (cookie.phase !== "flow") return { ok: false, reason: "wrong_phase" };
  if (!stateParam || !timingSafeEqualText(cookie.state, stateParam)) return { ok: false, reason: "state_mismatch" };
  return { ok: true, flow: cookie };
}

/** A signin flow needs no session; a link flow is valid only for the session that asked for it. */
export function flowMatchesSession(flow: FlowCookie, sessionHash: string | null): boolean {
  return flow.intent === "signin" || (flow.sessionHash !== null && sessionHash !== null && timingSafeEqualText(flow.sessionHash, sessionHash));
}
```

Chạy: `npm test -w apps/web -- test/domain/oauth.test.ts test/architecture.test.ts` → PASS (domain không import Hono hay db, không nhắc kiểu D1).

- [ ] **Step 3: Test cookie HTTP (fail)**

`apps/web/test/auth/oauth-cookie.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOAuthCookie, linkSessionHash, OAUTH_COOKIE, readOAuthCookie, writeOAuthCookie } from "../../src/auth/oauth-cookie.ts";
import { generateNonce, generateState, generateVerifier, newFlowCookie, newLinkIntent } from "../../src/domain/oauth.ts";
import type { AppEnv } from "../../src/env.ts";

const flow = () =>
  newFlowCookie({ provider: "github", intent: "signin", state: generateState(), verifier: generateVerifier(), nonce: generateNonce(), next: "/me", locale: "vi", sessionHash: null }, Date.now());

const app = new Hono<AppEnv>();
app.get("/write-flow", (c) => {
  writeOAuthCookie(c, flow());
  return c.text("ok");
});
app.get("/write-intent", async (c) => {
  writeOAuthCookie(c, newLinkIntent({ provider: "github", sessionHash: await linkSessionHash("raw-session") }, Date.now()));
  return c.text("ok");
});
app.get("/clear", (c) => {
  clearOAuthCookie(c);
  return c.text("ok");
});
app.get("/read/:provider", (c) => c.json(readOAuthCookie(c, c.req.param("provider") as "google" | "github" | "linkedin")));

const setCookieOf = (res: Response) => res.headers.getSetCookie().find((line) => line.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
const valueOf = (line: string) => line.slice(OAUTH_COOKIE.length + 1).split(";")[0] ?? "";
const maxAgeOf = (line: string) => Number(/Max-Age=(\d+)/.exec(line)?.[1]);

describe("__Host-vnx_oauth (ADR-012 §1)", () => {
  it("is host-only, HttpOnly, Secure, Lax, for 10 minutes", async () => {
    const line = setCookieOf(await app.request("/write-flow"));
    expect(OAUTH_COOKIE).toBe("__Host-vnx_oauth");
    expect(line).toContain("Path=/");
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Secure");
    expect(line).toContain("SameSite=Lax");
    expect(line).not.toMatch(/Domain=/i);
    expect(maxAgeOf(line)).toBeGreaterThanOrEqual(599);
    expect(maxAgeOf(line)).toBeLessThanOrEqual(600);
  });

  it("keeps a link intent for no more than 2 minutes", async () => {
    const line = setCookieOf(await app.request("/write-intent"));
    expect(maxAgeOf(line)).toBeGreaterThanOrEqual(119);
    expect(maxAgeOf(line)).toBeLessThanOrEqual(120);
  });

  it("reads back what it wrote, for the same provider only (F5)", async () => {
    const value = valueOf(setCookieOf(await app.request("/write-flow")));
    const same = await app.request("/read/github", { headers: { cookie: `${OAUTH_COOKIE}=${value}` } });
    expect(await same.json()).toMatchObject({ phase: "flow", provider: "github", intent: "signin", next: "/me", locale: "vi" });
    const other = await app.request("/read/google", { headers: { cookie: `${OAUTH_COOKIE}=${value}` } });
    expect(await other.json()).toBeNull();
  });

  it("reads null for a missing or tampered cookie", async () => {
    expect(await (await app.request("/read/github")).json()).toBeNull();
    expect(await (await app.request("/read/github", { headers: { cookie: `${OAUTH_COOKIE}=garbage` } })).json()).toBeNull();
  });

  it("is cleared with Max-Age=0 on the same path", async () => {
    const line = setCookieOf(await app.request("/clear"));
    expect(line).toContain("Max-Age=0");
    expect(line).toContain("Path=/");
    expect(line).toContain("Secure");
  });

  it("hashes the session for a link intent with a fixed prefix, never as the session's own id_hash (S1)", async () => {
    const hash = await linkSessionHash("raw-session");
    expect(hash).toBe(await sha256Hex("oauth-link:raw-session"));
    expect(hash).not.toBe(await sha256Hex("raw-session"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/oauth-cookie.test.ts` → FAIL (`auth/oauth-cookie.ts` chưa có).

- [ ] **Step 4: `auth/oauth-cookie.ts`**

`apps/web/src/auth/oauth-cookie.ts`:

```ts
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { OAuthProvider } from "../domain/identity.ts";
import { encodeOAuthCookie, OAUTH_FLOW_TTL_MS, parseOAuthCookie, type OAuthCookie } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { sha256Hex } from "./crypto.ts";

/**
 * Carries one OAuth round trip: state, PKCE verifier, nonce, intent, next, locale (ADR-012 §1). SameSite=Lax, not Strict: the
 * callback is a top-level GET from the provider and a Strict cookie would not be sent. Used once: the callback clears it.
 */
export const OAUTH_COOKIE = "__Host-vnx_oauth";

/** The cookie as written for `provider`, or null (missing, for another provider, expired, malformed: all the same). */
export function readOAuthCookie(c: Context<AppEnv>, provider: OAuthProvider, now: number = Date.now()): OAuthCookie | null {
  return parseOAuthCookie(getCookie(c, OAUTH_COOKIE), { provider, now });
}

export function writeOAuthCookie(c: Context<AppEnv>, cookie: OAuthCookie, now: number = Date.now()) {
  const maxAge = Math.min(OAUTH_FLOW_TTL_MS / 1000, Math.max(1, Math.ceil((cookie.exp - now) / 1000)));
  setCookie(c, OAUTH_COOKIE, encodeOAuthCookie(cookie), { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge });
}

export function clearOAuthCookie(c: Context<AppEnv>) {
  deleteCookie(c, OAUTH_COOKIE, { path: "/", secure: true });
}

/** What a link intent and a link flow store in place of the session id: `sha256("oauth-link:" + raw session id)` (S1). */
export function linkSessionHash(rawSessionId: string): Promise<string> {
  return sha256Hex(`oauth-link:${rawSessionId}`);
}
```

Chạy: `npm test -w apps/web -- test/auth/oauth-cookie.test.ts test/domain/oauth.test.ts` → PASS.

- [ ] **Step 5: Kiểm toàn bộ và commit**

```
npm run typecheck -w apps/web
npm test
```

Kỳ vọng: typecheck sạch (`crypto.subtle.timingSafeEqual` có kiểu trong `worker-configuration.d.ts`); toàn bộ test xanh, gồm `test/architecture.test.ts` (domain thuần, không SQL mới) và `test/i18n/parity.test.ts` (không có khóa mới).

```
git add apps/web/src/domain/oauth.ts apps/web/src/auth/oauth-cookie.ts apps/web/test/domain/oauth.test.ts apps/web/test/auth/oauth-cookie.test.ts
git commit -m "feat(web): OAuth core, PKCE, ID token claim checks and state cookie (VNX-2603a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận của task (mỗi dòng một lệnh):**

| # | Tiêu chí | Lệnh |
|---|---|---|
| 1 | S256 đúng vector RFC 7636 phụ lục B; `state`/`nonce`/`verifier` 43 ký tự ngẫu nhiên | `npm test -w apps/web -- test/domain/oauth.test.ts` |
| 2 | URL authorize chỉ có đúng các tham số đã biết, đúng scope từng provider, GitHub không scope không nonce, redirect URI từ `APP_ORIGIN` | `npm test -w apps/web -- test/domain/oauth.test.ts` |
| 3 | `iss`, `aud`, `azp`, `exp` (dung sai 60 s), `nonce`, `sub` sai đều bị từ chối; kết quả không có `name`; tham số mong đợi rỗng thì fail closed | `npm test -w apps/web -- test/domain/oauth.test.ts` |
| 4 | Cookie: sai hình dạng, quá hạn, `exp` quá xa, sai provider (F5), thiếu hoặc thừa `sessionHash` đều ra `null`; `state` sai, thiếu bị từ chối ở `checkCallbackState` | `npm test -w apps/web -- test/domain/oauth.test.ts` |
| 5 | Link chỉ khi cookie intent còn hạn và `sessionHash` khớp session hiện tại | `npm test -w apps/web -- test/domain/oauth.test.ts` |
| 6 | Thuộc tính cookie HTTP: `__Host-`, `Path=/`, `HttpOnly`, `Secure`, `Lax`, không `Domain`, 600 s (intent 120 s), xóa bằng `Max-Age=0`; `sessionHash` có tiền tố cố định | `npm test -w apps/web -- test/auth/oauth-cookie.test.ts` |
| 7 | Domain thuần, không dependency mới | `npm test -w apps/web -- test/architecture.test.ts` và `git diff --stat main -- apps/web/package.json package-lock.json` rỗng |
| 8 | Typecheck và toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

**Kích cỡ ước tính:** mã nguồn ~215 dòng (`domain/oauth.ts` ~185, `auth/oauth-cookie.ts` ~30), test ~300 dòng, không có locale. Dưới 600 dòng, không cần tách.

#### Kết quả review Task 2 (Opus, 2026-10-07): APPROVE

Reviewer typecheck bản code của plan với types của nhánh (0 lỗi) và chạy hai file test trong Node với hàm thay `timingSafeEqual` (34/34). Bổ sung bắt buộc khi làm Task 2:

- **LOW-1 (làm trong Task 2):** `parseOAuthCookie` trả `null` khi `next` không bắt đầu bằng `/` hoặc bắt đầu bằng `//` hay `/\`. Thêm test: cookie flow tự dựng với `next: "//evil.example"` và `next: "https://evil.example"` → `null`. Lớp `safeNext` ở Task 6 vẫn giữ.

Nghĩa vụ cho task sau:

- **LOW-2 (Task 6 và Task 8):** chỉ truyền `linkSessionHash(raw)` vào `resolveStartIntent` / `flowMatchesSession` khi `c.get("user")` khác null (session còn sống, user `active`); ngược lại truyền `null`. Test: cookie intent + session hết hạn → `signin`.

---

### Task 3: VNX-2603b — Port nhà cung cấp, adapter Google và LinkedIn (OIDC), provider giả, `getOAuthProvider`

**Files:**
- Create: `apps/web/src/auth/oauth/provider.ts` (port và kiểu), `apps/web/src/auth/oauth/oidc.ts` (adapter Google, LinkedIn), `apps/web/src/auth/oauth/fake.ts` (`FakeOAuthProvider`), `apps/web/src/auth/oauth/index.ts` (`getOAuthProvider`, cấu hình)
- Modify: `apps/web/src/domain/identity.ts` (thêm `PROVIDER_NAME`)
- Modify: `apps/web/src/env.ts` (5 binding tùy chọn)
- Modify: `apps/web/vitest.config.ts` (`OAUTH_DRIVER: "fake"` và ghim rỗng các client ID/secret)
- Modify: `apps/web/test/env.d.ts` (khai báo `OAUTH_DRIVER`)
- Modify: `apps/web/wrangler.jsonc` (chỉ ghi chú; không biến, không `OAUTH_DRIVER`)
- Modify (test có sẵn): `apps/web/test/domain/identity.test.ts` (`PROVIDER_NAME`), `apps/web/test/db/identities.test.ts` (nghĩa vụ review VNX-2602: CHECK của `label`)
- Test (mới): `apps/web/test/auth/oauth-oidc.test.ts`, `apps/web/test/auth/oauth-providers.test.ts`
- Không có route, không khóa i18n, không migration.

**Interfaces:**
- Consumes: `OAuthProvider` (union tên provider), `PROVIDER_FLAG` (`domain/identity.ts`); `OAUTH_PROVIDER_SPECS`, `verifyIdToken`, `IdTokenFailure` (`domain/oauth.ts`); `isFakeMail` (`email/index.ts`); `Bindings` (`env.ts`); `testEnv`, `ensureUser`, `linkIdentity` (test).
- Produces:
  - `domain/identity.ts`: `PROVIDER_NAME: Record<OAuthProvider, string>` = `{ google: "Google", github: "GitHub", linkedin: "LinkedIn" }` (tên hiển thị cố định, không dịch).
  - `auth/oauth/provider.ts`: `ProviderIdentity = { subject: string; label: string }`; `ExchangeInput = { code; verifier; nonce; redirectUri; now: number }`; `ExchangeFailure = "token_request" | "token_response" | \`id_token_${IdTokenFailure}\``; `ExchangeResult = { ok: true; identity: ProviderIdentity } | { ok: false; reason: ExchangeFailure }`; `interface ProviderClient { readonly provider: OAuthProvider; readonly clientId: string; exchange(input: ExchangeInput): Promise<ExchangeResult> }`.
  - `auth/oauth/oidc.ts`: `OIDC_TOKEN_URLS`, `class OidcClient implements ProviderClient` (`new OidcClient(provider, clientId, clientSecret, fetchFn)`), `type OidcProvider = "google" | "linkedin"`.
  - `auth/oauth/fake.ts`: `FAKE_CLIENT_ID`, `issueFakeCode(provider, identity, expect): string`, `resetFakeOAuth(): void`, `class FakeOAuthProvider implements ProviderClient`.
  - `auth/oauth/index.ts`: `isFakeOAuth(env)`, `oauthCredentials(env, provider)`, `isProviderConfigured(env, provider): boolean`, `getOAuthProvider(env, provider, fetchFn?): ProviderClient | null` (null = chưa cấu hình, route trả 404).
  - `env.ts` `Bindings`: `OAUTH_DRIVER?`, `GOOGLE_CLIENT_ID?`, `GOOGLE_CLIENT_SECRET?`, `LINKEDIN_CLIENT_ID?`, `LINKEDIN_CLIENT_SECRET?` (cả `string`).

**Quyết định kỹ thuật:**
- **Tên port: `ProviderClient`, không phải `OAuthProvider`** như header nói, vì `OAuthProvider` đã là kiểu union tên provider ở `domain/identity.ts` (Task 1). Chỉ đổi tên, không đổi vai trò.
- **Adapter chỉ làm một việc:** đổi `code` lấy ID token và rút `{ subject, label }` ra. Nó **không đọc `access_token` hay `refresh_token`** trong JSON trả về, không có trường nào của kết quả chứa token, không `console.*` (test quét tĩnh `src/auth/oauth/*.ts` không có `console.`), không import `hono` hay `db/`. Lỗi trả về là mã cố định (`ExchangeFailure`), không bao giờ `String(err)` hay nội dung phản hồi của provider (Review Focus 9, F5).
- **Quyết định 3 (a) và (b):** ID token chỉ lấy từ trường `id_token` của JSON do token endpoint trả; `ExchangeInput` không có trường nào để truyền ID token vào. URL token endpoint là hằng số `OIDC_TOKEN_URLS` (Google `https://oauth2.googleapis.com/token`, LinkedIn `https://www.linkedin.com/oauth/v2/accessToken`); `fetch` luôn `method: "POST"`, `redirect: "manual"` (workerd không hỗ trợ `"error"`, mọi lời gọi sẽ ném lỗi; với `"manual"` một 3xx trả về nguyên trạng, không phải `res.ok`, nên thành `token_request` và `fetch` chỉ được gọi một lần), `AbortSignal.timeout(8000)`. Client secret chỉ nằm trong thân form gửi tới đúng URL đó.
- **`label` (quyết định 12, F2):** `claims.email` nếu có, không thì `PROVIDER_NAME[provider]` ("Google", "LinkedIn"); không bao giờ `name`. `verifyIdToken` đã bảo đảm email dài 1–254 nên `label` luôn thỏa CHECK `length(label) BETWEEN 1 AND 254`; test đi qua `linkIdentity` để chứng minh điều đó.
- **Chọn driver theo tiền lệ VNX-0803 F6 (chặt hơn lời header):** `OAUTH_DRIVER=fake` chỉ có hiệu lực khi `isFakeMail(env)` đúng (tức là `MAIL_DRIVER=fake` **và** không có `RESEND_API_KEY` thật), cùng cách `TURNSTILE_DRIVER`. Production luôn có `RESEND_API_KEY`, nên một biến `OAUTH_DRIVER` lọt vào cũng không bật được provider giả, thứ chấp nhận mọi `code` đã phát. Ngoài ra `wrangler.jsonc` không bao giờ chứa `OAUTH_DRIVER` (test chặn), và `vitest.config.ts` đặt nó.
- **Cấu hình thiếu = provider tắt (quyết định 6):** `oauthCredentials` trả `null` nếu thiếu hoặc rỗng (sau `trim`) client ID hoặc secret; `getOAuthProvider` trả `null`; `isProviderConfigured` là bản boolean cho view và route. GitHub chưa có adapter ở task này nên `getOAuthProvider(env, "github")` trả `null` (Task 4 thêm); riêng driver giả phục vụ cả ba provider.
- **`fetch` mặc định phải được bọc** (`const defaultFetch: typeof fetch = (input, init) => fetch(input, init)`): giữ tham chiếu `fetch` trần rồi gọi như phương thức của đối tượng khác làm workerd ném "Illegal invocation".
- **`FakeOAuthProvider` (S2):** `getOAuthProvider` tạo client mới cho mỗi request, nên bảng `code` là biến cấp module trong isolate (như `outbox` của `FakeMailer`). `issueFakeCode(provider, identity, expect)` phát một `code`, với `expect` BẮT BUỘC và đủ ba trường (F3); `exchange` xóa `code` **trước khi** kiểm gì khác (một `code` chỉ dùng được một lần, kể cả khi lần đó sai), từ chối `code` lạ, `code` của provider khác, `verifier` hoặc `redirectUri` không như `expect` (`token_request`) và `nonce` không như `expect` (`id_token_nonce`). Nhờ `expect`, test route ở Task 6 bắt được lỗi PKCE hoặc `nonce` của lõi mà provider giả không tự biết.
- **`worker-configuration.d.ts` không đổi:** file đó bị `.gitignore`, do `wrangler types --strict-vars=false` sinh từ `vars` của `wrangler.jsonc`, mà secret không nằm trong `vars`; kiểu của secret là `Bindings` viết tay ở `env.ts`. Việc duy nhất kiểu cần là thêm năm trường tùy chọn ở `env.ts` và `OAUTH_DRIVER` ở `test/env.d.ts` (cho `cloudflare:workers` env trong test).
- **Ghim rỗng trong `vitest.config.ts`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` đặt `""` để `.dev.vars` của lập trình viên không bao giờ biến bộ test thành gọi provider thật (cùng ý với `RESEND_API_KEY: ""`).

- [ ] **Step 1: `PROVIDER_NAME` (test fail rồi pass)**

Thêm vào cuối `apps/web/test/domain/identity.test.ts` (cập nhật dòng import, thêm `PROVIDER_NAME`):

```ts
describe("provider display names (ADR-012 decision 12, F2)", () => {
  it("are fixed and never translated", () => {
    expect(PROVIDER_NAME).toEqual({ google: "Google", github: "GitHub", linkedin: "LinkedIn" });
    expect(Object.keys(PROVIDER_NAME)).toEqual([...OAUTH_PROVIDERS]);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/identity.test.ts` → FAIL (`PROVIDER_NAME` chưa có). Thêm vào `apps/web/src/domain/identity.ts`, sau `PROVIDER_FLAG`:

```ts
/** Fixed display names; brand names are not translated (ADR-012, ADR-003). Also the `label` of an identity whose provider gave no e-mail (decision 12). */
export const PROVIDER_NAME: Record<OAuthProvider, string> = { google: "Google", github: "GitHub", linkedin: "LinkedIn" };
```

Chạy lại → PASS.

- [ ] **Step 2: Nghĩa vụ review VNX-2602: CHECK của `label` (test)**

Thêm vào `describe("user_identities …")` của `apps/web/test/db/identities.test.ts`, sau `it` cuối (dùng `newUser`, `NOW`, `testEnv`, `linkIdentity` đã có trong file):

```ts
  it("refuses an empty label and one of 255 characters, in SQL and through linkIdentity, and accepts 254 (CHECK 1-254)", async () => {
    const user = await newUser();
    const insertLabel = (id: string, label: string) =>
      testEnv.DB
        .prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, linked_at, updated_at) VALUES (?1, ?2, 'google', ?1, ?3, ?4, ?4)")
        .bind(id, user.id, label, NOW)
        .run();
    await expect(insertLabel("label-empty", "")).rejects.toThrow();
    await expect(insertLabel("label-long", "x".repeat(255))).rejects.toThrow();
    await expect(linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-empty", label: "", now: NOW })).rejects.toThrow();
    await expect(linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-long", label: "x".repeat(255), now: NOW })).rejects.toThrow();
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "google", subject: "g-max", label: "x".repeat(254), now: NOW })).ok).toBe(true);
    expect(await listIdentitiesForUser(testEnv.DB, user.id)).toHaveLength(1);
  });
```

Chạy: `npm test -w apps/web -- test/db/identities.test.ts` → PASS ngay (migration đã có CHECK; test này chốt hành vi, không cần code mới).

- [ ] **Step 3: Test adapter OIDC (fail)**

`apps/web/test/auth/oauth-oidc.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { OIDC_TOKEN_URLS, OidcClient, type OidcProvider } from "../../src/auth/oauth/oidc.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import { PROVIDER_NAME } from "../../src/domain/identity.ts";
import { base64UrlEncode, OAUTH_PROVIDER_SPECS } from "../../src/domain/oauth.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const NONCE = "n".repeat(43);
const PROVIDERS: OidcProvider[] = ["google", "linkedin"];
const INPUT = { code: "auth-code", verifier: "v".repeat(43), nonce: NONCE, redirectUri: "https://vnx.si/auth/oauth/google/callback", now: NOW };

const enc = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const claimsFor = (provider: OidcProvider, over: Record<string, unknown> = {}) => ({
  iss: OAUTH_PROVIDER_SPECS[provider].issuers[0],
  aud: "client-id",
  sub: "sub-1",
  exp: NOW / 1000 + 600,
  nonce: NONCE,
  email: "lan@example.com",
  name: "Lan Nguyen",
  ...over,
});
const idToken = (claims: unknown) => `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.c2ln`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenJson = (claims: unknown) => ({ access_token: "ya29.SECRET-ACCESS", refresh_token: "1//SECRET-REFRESH", token_type: "Bearer", expires_in: 3599, id_token: idToken(claims) });

type Call = { url: string; init: RequestInit };
function stubFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}
const client = (provider: OidcProvider, fn: typeof fetch) => new OidcClient(provider, "client-id", "client-secret", fn);

describe("OidcClient token request (decision 3 (a), (b))", () => {
  it("posts the code exchange to the constant token URL, without following redirects", async () => {
    expect(OIDC_TOKEN_URLS).toEqual({ google: "https://oauth2.googleapis.com/token", linkedin: "https://www.linkedin.com/oauth/v2/accessToken" });
    for (const provider of PROVIDERS) {
      const { fn, calls } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      await client(provider, fn).exchange(INPUT);
      expect(calls, provider).toHaveLength(1);
      const [call] = calls;
      expect(call?.url).toBe(OIDC_TOKEN_URLS[provider]);
      expect(call?.init.method).toBe("POST");
      expect(call?.init.redirect).toBe("manual");
      expect(call?.init.signal).toBeInstanceOf(AbortSignal);
      expect(Object.fromEntries(new URLSearchParams(String(call?.init.body)))).toEqual({
        grant_type: "authorization_code",
        code: "auth-code",
        redirect_uri: INPUT.redirectUri,
        client_id: "client-id",
        client_secret: "client-secret",
        code_verifier: INPUT.verifier,
      });
    }
  });

  it("takes the ID token only from the token endpoint JSON, whatever else the input carries", async () => {
    const forged = idToken(claimsFor("google"));
    const { fn } = stubFetch(() => json({ access_token: "a", token_type: "Bearer" }));
    const result = await client("google", fn).exchange({ ...INPUT, idToken: forged } as never);
    expect(result).toEqual({ ok: false, reason: "token_response" });
  });
});

describe("OidcClient redirects and runtime options (F1)", () => {
  it("treats any redirect from the token endpoint as a failed request, and calls fetch once (workerd supports manual, not error)", async () => {
    for (const status of [301, 302, 307]) {
      const { fn, calls } = stubFetch(() => new Response(null, { status, headers: { location: "https://evil.example/token" } }));
      expect(await client("google", fn).exchange(INPUT), String(status)).toEqual({ ok: false, reason: "token_request" });
      expect(calls, String(status)).toHaveLength(1);
    }
  });

  it("builds options the workerd runtime accepts: a Request made from the captured call does not throw", async () => {
    for (const provider of PROVIDERS) {
      const { fn, calls } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      await client(provider, fn).exchange(INPUT);
      const call = calls[0];
      expect(call, provider).toBeDefined();
      expect(() => new Request(call?.url ?? "", call?.init), provider).not.toThrow();
    }
  });
});

describe("OidcClient result (ADR-012 §1, decision 12, F2)", () => {
  it("returns the subject and the e-mail as label, and nothing else: no token, no name", async () => {
    for (const provider of PROVIDERS) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider))));
      const result = await client(provider, fn).exchange(INPUT);
      expect(result, provider).toEqual({ ok: true, identity: { subject: "sub-1", label: "lan@example.com" } });
      const text = JSON.stringify(result);
      for (const secret of ["SECRET", "Lan Nguyen", "auth-code", "client-secret"]) expect(text, `${provider} ${secret}`).not.toContain(secret);
    }
  });

  it("falls back to the fixed provider name when there is no e-mail, never to the name claim", async () => {
    for (const provider of PROVIDERS) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, { email: undefined }))));
      const result = await client(provider, fn).exchange(INPUT);
      expect(result, provider).toEqual({ ok: true, identity: { subject: "sub-1", label: PROVIDER_NAME[provider] } });
    }
  });

  it("always gives a label the database accepts (1-254 characters)", async () => {
    const user = await ensureUser("oidc-label@vnx.si");
    for (const [provider, email] of [["google", "x".repeat(254)], ["linkedin", undefined]] as const) {
      const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, { email, sub: `label-${provider}` }))));
      const result = await client(provider, fn).exchange(INPUT);
      if (!result.ok) throw new Error(result.reason);
      expect(result.identity.label.length).toBeGreaterThanOrEqual(1);
      expect(result.identity.label.length).toBeLessThanOrEqual(254);
      expect((await linkIdentity(testEnv.DB, { userId: user.id, provider, subject: result.identity.subject, label: result.identity.label, now: "2026-10-07T10:00:00.000Z" })).ok).toBe(true);
    }
  });
});

describe("OidcClient failures give fixed codes", () => {
  it("maps a failed or non-2xx token request to token_request", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ error: "invalid_grant" }, 400), () => json({}, 500), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn } = stubFetch(respond);
      expect(await client("google", fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
    }
  });

  it("maps an unreadable or incomplete token response to token_response", async () => {
    const cases: Array<() => Response> = [
      () => new Response("not json", { status: 200 }),
      () => json([1, 2]),
      () => json({ id_token: 5 }),
      () => json({ access_token: "a" }),
    ];
    for (const respond of cases) {
      const { fn } = stubFetch(respond);
      expect(await client("linkedin", fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_response" });
    }
  });

  it("maps every claim defect to id_token_<reason>, for each provider", async () => {
    const table: Array<[Record<string, unknown>, string]> = [
      [{ iss: "https://evil.example" }, "id_token_issuer"],
      [{ aud: "other-client" }, "id_token_audience"],
      [{ azp: "other-client" }, "id_token_azp"],
      [{ exp: NOW / 1000 - 120 }, "id_token_expired"],
      [{ nonce: "m".repeat(43) }, "id_token_nonce"],
      [{ sub: "" }, "id_token_subject"],
    ];
    for (const provider of PROVIDERS) {
      for (const [over, reason] of table) {
        const { fn } = stubFetch(() => json(tokenJson(claimsFor(provider, over))));
        expect(await client(provider, fn).exchange(INPUT), `${provider} ${reason}`).toEqual({ ok: false, reason });
      }
    }
  });

  it("accepts only the issuer of its own provider", async () => {
    const google = stubFetch(() => json(tokenJson(claimsFor("linkedin"))));
    expect(await client("google", google.fn).exchange(INPUT)).toEqual({ ok: false, reason: "id_token_issuer" });
    const linkedin = stubFetch(() => json(tokenJson(claimsFor("google"))));
    expect(await client("linkedin", linkedin.fn).exchange(INPUT)).toEqual({ ok: false, reason: "id_token_issuer" });
    const alt = stubFetch(() => json(tokenJson(claimsFor("google", { iss: "accounts.google.com" }))));
    expect((await client("google", alt.fn).exchange(INPUT)).ok).toBe(true);
  });

  it("logs nothing on success or failure (Review Focus 9)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      for (const respond of [() => json(tokenJson(claimsFor("google"))), () => json({}, 500), () => new Response("x"), () => json(tokenJson(claimsFor("google", { nonce: "bad" })))]) {
        await client("google", stubFetch(respond).fn).exchange(INPUT);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/oauth-oidc.test.ts` → FAIL (module chưa có).

- [ ] **Step 4: Port, adapter, env**

`apps/web/src/auth/oauth/provider.ts`:

```ts
import type { OAuthProvider } from "../../domain/identity.ts";
import type { IdTokenFailure } from "../../domain/oauth.ts";

/**
 * What the sign-in routes need from a provider (ADR-012 §1): trade the one-time `code` for the account's identity. Nothing
 * else leaves an adapter: no access token, no refresh token, no ID token, no profile name (Review Focus 9, F2). Named
 * ProviderClient because `OAuthProvider` is already the union of provider names (domain/identity.ts).
 */
export interface ProviderIdentity {
  /** The provider's immutable account id (`sub`, or GitHub's numeric id as text). */
  subject: string;
  /** The e-mail, or the fixed provider name when there is none (Google, LinkedIn); the login for GitHub. Always 1-254 characters. */
  label: string;
}

export interface ExchangeInput {
  code: string;
  verifier: string;
  nonce: string;
  redirectUri: string;
  /** Epoch milliseconds; the caller's clock, so tests control `exp`. */
  now: number;
}

/** Fixed codes for logs and branching; never an error message or a provider response. */
export type ExchangeFailure = "token_request" | "token_response" | `id_token_${IdTokenFailure}`;
export type ExchangeResult = { ok: true; identity: ProviderIdentity } | { ok: false; reason: ExchangeFailure };

export interface ProviderClient {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  exchange(input: ExchangeInput): Promise<ExchangeResult>;
}
```

`apps/web/src/auth/oauth/oidc.ts`:

```ts
import { PROVIDER_NAME } from "../../domain/identity.ts";
import { OAUTH_PROVIDER_SPECS, verifyIdToken } from "../../domain/oauth.ts";
import type { ExchangeFailure, ExchangeInput, ExchangeResult, ProviderClient } from "./provider.ts";

export type OidcProvider = "google" | "linkedin";

/** Constants, never built from input (decision 3 (b)). */
export const OIDC_TOKEN_URLS: Record<OidcProvider, string> = {
  google: "https://oauth2.googleapis.com/token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
};

const TIMEOUT_MS = 8000;

/**
 * Google and LinkedIn: OpenID Connect authorization-code exchange. The ID token is read only from the token endpoint's JSON
 * (decision 3 (a)); its claims are checked by `verifyIdToken` and its signature is not (approved deviation R1). The access
 * and refresh tokens in the same JSON are never read. No logging here: callers log the fixed failure code.
 */
export class OidcClient implements ProviderClient {
  constructor(
    readonly provider: OidcProvider,
    readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: typeof fetch,
  ) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const fail = (reason: ExchangeFailure): ExchangeResult => ({ ok: false, reason });
    let body: unknown;
    try {
      const fetchFn = this.fetchFn;
      const res = await fetchFn(OIDC_TOKEN_URLS[this.provider], {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: input.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code_verifier: input.verifier,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("token_request");
      try {
        body = await res.json();
      } catch {
        return fail("token_response");
      }
    } catch {
      return fail("token_request");
    }
    const idToken = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).id_token : undefined;
    if (typeof idToken !== "string" || idToken === "") return fail("token_response");

    const verified = verifyIdToken(idToken, { issuers: OAUTH_PROVIDER_SPECS[this.provider].issuers, audience: this.clientId, nonce: input.nonce, now: input.now });
    if (!verified.ok) return fail(`id_token_${verified.reason}`);
    // F2: the e-mail, else the fixed provider name; the `name` claim is never read.
    return { ok: true, identity: { subject: verified.claims.subject, label: verified.claims.email ?? PROVIDER_NAME[this.provider] } };
  }
}
```

`apps/web/src/env.ts`: thêm vào `Bindings`, sau `TURNSTILE_DRIVER?: string;`:

```ts
  /** EPIC 26 (ADR-012): "fake" swaps in the test provider, and only next to the fake mailer (auth/oauth/index.ts). Never set in wrangler.jsonc. */
  OAUTH_DRIVER?: string;
  /** OAuth client credentials: `wrangler secret put …` and apps/web/.dev.vars only. A provider missing either of its two is off. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
```

Chạy: `npm test -w apps/web -- test/auth/oauth-oidc.test.ts` → PASS.

- [ ] **Step 5: Test provider giả, factory, cấu hình (fail)**

`apps/web/test/auth/oauth-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { FakeOAuthProvider, FAKE_CLIENT_ID, issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { getOAuthProvider, isFakeOAuth, isProviderConfigured, oauthCredentials } from "../../src/auth/oauth/index.ts";
import { OidcClient } from "../../src/auth/oauth/oidc.ts";
import { OAUTH_PROVIDERS } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

const WRANGLER = import.meta.glob("../../wrangler.jsonc", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ADAPTERS = import.meta.glob("../../src/auth/oauth/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const INPUT = { code: "", verifier: "v".repeat(43), nonce: "n".repeat(43), redirectUri: "https://vnx.si/auth/oauth/google/callback", now: NOW };
const withEnv = (over: Partial<Bindings>) => ({ ...testEnv, ...over }) as Bindings;
const REAL = { OAUTH_DRIVER: undefined, GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret", LINKEDIN_CLIENT_ID: "lid", LINKEDIN_CLIENT_SECRET: "lsecret" };

describe("test environment (decision 5)", () => {
  it("runs with the fake driver and no client credentials, so .dev.vars can never reach a real provider", () => {
    expect(testEnv.OAUTH_DRIVER).toBe("fake");
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const) expect(testEnv[key] ?? "", key).toBe("");
    expect(isFakeOAuth(testEnv)).toBe(true);
  });

  it("keeps the fake driver and every credential out of wrangler.jsonc", () => {
    const raw = WRANGLER["../../wrangler.jsonc"] ?? "";
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toContain("OAUTH_DRIVER");
    expect(raw).not.toMatch(/"(?:GOOGLE|GITHUB|LINKEDIN)_CLIENT_(?:ID|SECRET)"\s*:/);
  });

  it("lets only auth/oauth/index.ts import the fake provider (S1)", () => {
    const sources = import.meta.glob("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    for (const [file, src] of Object.entries(sources)) {
      if (file === "../../src/auth/oauth/index.ts") continue;
      const pattern = file.startsWith("../../src/auth/oauth/") ? /from\s+["']\.\/fake(?:\.ts)?["']/ : /from\s+["'][^"']*\/oauth\/fake(?:\.ts)?["']/;
      expect(src, file).not.toMatch(pattern);
    }
  });

  it("keeps adapters free of logging, Hono and the database (Review Focus 9)", () => {
    const files = Object.entries(ADAPTERS);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const [file, src] of files) {
      expect(src, `${file} logs`).not.toMatch(/\bconsole\./);
      expect(src, `${file} imports hono`).not.toMatch(/from\s+["']hono/);
      expect(src, `${file} imports db`).not.toMatch(/from\s+["'][^"']*\/db\//);
    }
  });
});

describe("getOAuthProvider (decisions 5 and 6)", () => {
  it("returns the fake provider for every provider when the fake driver counts", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const client = getOAuthProvider(testEnv, provider);
      expect(client, provider).toBeInstanceOf(FakeOAuthProvider);
      expect(client?.provider).toBe(provider);
      expect(client?.clientId).toBe(FAKE_CLIENT_ID);
      expect(isProviderConfigured(testEnv, provider)).toBe(true);
    }
  });

  it("ignores the fake driver once a real mail key exists (VNX-0803 F6), so production never gets the fake provider", () => {
    const env = withEnv({ ...REAL, OAUTH_DRIVER: "fake", RESEND_API_KEY: "re_live_key" });
    expect(isFakeOAuth(env)).toBe(false);
    expect(getOAuthProvider(env, "google")).toBeInstanceOf(OidcClient);
    const bare = withEnv({ OAUTH_DRIVER: "fake", RESEND_API_KEY: "re_live_key", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    expect(getOAuthProvider(bare, "google")).toBeNull();
  });

  it("returns the real adapter for Google and LinkedIn when both credentials exist", () => {
    const env = withEnv(REAL);
    expect(getOAuthProvider(env, "google")).toMatchObject({ provider: "google", clientId: "gid" });
    expect(getOAuthProvider(env, "google")).toBeInstanceOf(OidcClient);
    expect(getOAuthProvider(env, "linkedin")).toMatchObject({ provider: "linkedin", clientId: "lid" });
    expect(isProviderConfigured(env, "google")).toBe(true);
  });

  it("treats a missing, empty or blank client id or secret as the provider being off", () => {
    for (const over of [{ GOOGLE_CLIENT_ID: undefined }, { GOOGLE_CLIENT_ID: "" }, { GOOGLE_CLIENT_ID: "   " }, { GOOGLE_CLIENT_SECRET: undefined }, { GOOGLE_CLIENT_SECRET: " " }]) {
      const env = withEnv({ ...REAL, ...over });
      expect(oauthCredentials(env, "google"), JSON.stringify(over)).toBeNull();
      expect(getOAuthProvider(env, "google")).toBeNull();
      expect(isProviderConfigured(env, "google")).toBe(false);
      expect(isProviderConfigured(env, "linkedin")).toBe(true);
    }
  });

  it("has no GitHub adapter yet (Task 4): GitHub is off outside the fake driver", () => {
    expect(getOAuthProvider(withEnv(REAL), "github")).toBeNull();
    expect(isProviderConfigured(withEnv(REAL), "github")).toBe(false);
  });

  it("passes the injected fetch to the real adapter", async () => {
    const calls: string[] = [];
    const fn = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    const client = getOAuthProvider(withEnv(REAL), "google", fn);
    expect(await client?.exchange({ ...INPUT, code: "c" })).toEqual({ ok: false, reason: "token_request" });
    expect(calls).toEqual(["https://oauth2.googleapis.com/token"]);
  });
});

describe("FakeOAuthProvider (decision 5, S2)", () => {
  beforeEach(() => resetFakeOAuth());
  const identity = { subject: "fake-sub", label: "lan@example.com" };
  const EXPECT = { verifier: INPUT.verifier, nonce: INPUT.nonce, redirectUri: INPUT.redirectUri };

  it("trades an issued code for the identity it was issued for", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    const result = await new FakeOAuthProvider("google").exchange({ ...INPUT, code });
    expect(result).toEqual({ ok: true, identity });
  });

  it("works across new client instances in the same isolate, like one request after another", async () => {
    const code = issueFakeCode("linkedin", identity, EXPECT);
    expect((await getOAuthProvider(testEnv, "linkedin")?.exchange({ ...INPUT, code }))?.ok).toBe(true);
  });

  it("rejects a reused code (S2), and an unknown one", async () => {
    const code = issueFakeCode("github", identity, EXPECT);
    const fake = new FakeOAuthProvider("github");
    expect((await fake.exchange({ ...INPUT, code })).ok).toBe(true);
    expect(await fake.exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
    expect(await fake.exchange({ ...INPUT, code: "fake-code-unknown" })).toEqual({ ok: false, reason: "token_request" });
  });

  it("burns a code even when the attempt was wrong, and refuses another provider's code", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("github").exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code })).toEqual({ ok: false, reason: "token_request" });
  });

  it("enforces the verifier, redirect URI and nonce a test says the flow must present", async () => {
    const ok = issueFakeCode("google", identity, EXPECT);
    expect((await new FakeOAuthProvider("google").exchange({ ...INPUT, code: ok })).ok).toBe(true);
    const badVerifier = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badVerifier, verifier: "w".repeat(43) })).toEqual({ ok: false, reason: "token_request" });
    const badRedirect = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badRedirect, redirectUri: "https://evil.example/cb" })).toEqual({ ok: false, reason: "token_request" });
    const badNonce = issueFakeCode("google", identity, EXPECT);
    expect(await new FakeOAuthProvider("google").exchange({ ...INPUT, code: badNonce, nonce: "m".repeat(43) })).toEqual({ ok: false, reason: "id_token_nonce" });
  });

  it("returns a copy of the identity and nothing that looks like a token", async () => {
    const code = issueFakeCode("google", identity, EXPECT);
    const result = await new FakeOAuthProvider("google").exchange({ ...INPUT, code });
    if (!result.ok) throw new Error(result.reason);
    expect(Object.keys(result.identity).sort()).toEqual(["label", "subject"]);
    result.identity.label = "changed";
    expect(identity.label).toBe("lan@example.com");
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/oauth-providers.test.ts` → FAIL (module và cấu hình chưa có).

- [ ] **Step 6: Provider giả, factory, cấu hình test**

`apps/web/src/auth/oauth/fake.ts`:

```ts
import type { OAuthProvider } from "../../domain/identity.ts";
import type { ExchangeInput, ExchangeResult, ProviderClient, ProviderIdentity } from "./provider.ts";

/** The provider for tests (decision 5): no network, one-time codes the test issues. Only reachable through `getOAuthProvider` when `isFakeOAuth` holds. */
export const FAKE_CLIENT_ID = "fake-client-id";

/**
 * What the flow under test must present for the code to be accepted. All three are required (F3): a test that cannot say what
 * the core should send is not testing the core.
 */
export interface FakeExpect {
  verifier: string;
  nonce: string;
  redirectUri: string;
}

type Issued = { provider: OAuthProvider; identity: ProviderIdentity; expect: FakeExpect };

// One table per isolate, like the fake mailer's outbox: `getOAuthProvider` builds a new client on every request.
const issued = new Map<string, Issued>();

export function issueFakeCode(provider: OAuthProvider, identity: ProviderIdentity, expect: FakeExpect): string {
  const code = `fake-code-${crypto.randomUUID()}`;
  issued.set(code, { provider, identity: { ...identity }, expect });
  return code;
}

export function resetFakeOAuth(): void {
  issued.clear();
}

export class FakeOAuthProvider implements ProviderClient {
  readonly clientId = FAKE_CLIENT_ID;
  constructor(readonly provider: OAuthProvider) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const entry = issued.get(input.code);
    // S2: a code works once, even when this attempt turns out wrong (a real provider burns it too).
    issued.delete(input.code);
    if (!entry || entry.provider !== this.provider) return { ok: false, reason: "token_request" };
    const { verifier, nonce, redirectUri } = entry.expect;
    if (verifier !== input.verifier || redirectUri !== input.redirectUri) return { ok: false, reason: "token_request" };
    if (nonce !== input.nonce) return { ok: false, reason: "id_token_nonce" };
    return { ok: true, identity: { ...entry.identity } };
  }
}
```

`apps/web/src/auth/oauth/index.ts`:

```ts
import { isFakeMail } from "../../email/index.ts";
import type { OAuthProvider } from "../../domain/identity.ts";
import type { Bindings } from "../../env.ts";
import { FakeOAuthProvider } from "./fake.ts";
import { OidcClient } from "./oidc.ts";
import type { ProviderClient } from "./provider.ts";

type OAuthEnv = Pick<
  Bindings,
  "OAUTH_DRIVER" | "MAIL_DRIVER" | "RESEND_API_KEY" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "LINKEDIN_CLIENT_ID" | "LINKEDIN_CLIENT_SECRET"
>;

// A bare `fetch` kept in a field and called as a method of another object makes workerd throw "Illegal invocation".
const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

/**
 * The fake provider counts only next to the fake mailer, which itself only counts without a real mail key (VNX-0803 F6):
 * production always has RESEND_API_KEY, so a stray OAUTH_DRIVER cannot switch it on. The fake accepts any code it issued.
 */
export function isFakeOAuth(env: Pick<Bindings, "OAUTH_DRIVER" | "MAIL_DRIVER" | "RESEND_API_KEY">): boolean {
  return env.OAUTH_DRIVER === "fake" && isFakeMail(env);
}

/** The provider's client id and secret, or null when either is missing or blank (decision 6). GitHub's join in Task 4. */
export function oauthCredentials(env: OAuthEnv, provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const [id, secret] =
    provider === "google" ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET] : provider === "linkedin" ? [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET] : [undefined, undefined];
  const clientId = id?.trim();
  const clientSecret = secret?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** False means the provider is off whatever its feature flag says: no button, callback 404. */
export function isProviderConfigured(env: OAuthEnv, provider: OAuthProvider): boolean {
  return getOAuthProvider(env, provider) !== null;
}

/** The client for `provider`, or null when it is not configured. `fetchFn` is for tests of the real adapters. */
export function getOAuthProvider(env: OAuthEnv, provider: OAuthProvider, fetchFn: typeof fetch = defaultFetch): ProviderClient | null {
  if (isFakeOAuth(env)) return new FakeOAuthProvider(provider);
  const credentials = oauthCredentials(env, provider);
  if (!credentials || provider === "github") return null;
  return new OidcClient(provider, credentials.clientId, credentials.clientSecret, fetchFn);
}
```

`apps/web/vitest.config.ts`, trong `bindings`, sau `TURNSTILE_DRIVER: "fake",`:

```ts
            OAUTH_DRIVER: "fake",
            // Pinned empty, like RESEND_API_KEY: a developer's .dev.vars credentials must never make the suite reach a real provider.
            GOOGLE_CLIENT_ID: "",
            GOOGLE_CLIENT_SECRET: "",
            LINKEDIN_CLIENT_ID: "",
            LINKEDIN_CLIENT_SECRET: "",
```

`apps/web/test/env.d.ts`: thêm `OAUTH_DRIVER: string;` sau `TURNSTILE_DRIVER: string;`.

`apps/web/wrangler.jsonc`: thêm vào cuối khối ghi chú, ngay trước dấu `}` đóng (sau dòng `// Tests use "fake". Production leaves it unset and sends through RESEND_API_KEY.`), không thêm biến nào:

```jsonc
  //
  // OAuth sign-in (EPIC 26, ADR-012): the client ids and secrets are wrangler secrets, never vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  // LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (GitHub's two join with its adapter). Local dev: apps/web/.dev.vars. A provider missing
  // either of its two is off whatever its feature flag says. The test driver for OAuth is a vitest binding only and never appears here.
```

Chú ý: ghi chú này **không được chứa** chuỗi `OAUTH_DRIVER` (test chặn toàn file).

Chạy: `npm test -w apps/web -- test/auth/oauth-providers.test.ts test/auth/oauth-oidc.test.ts test/domain/identity.test.ts test/db/identities.test.ts` → PASS.

- [ ] **Step 7: Kiểm toàn bộ và commit**

```
npm run typecheck -w apps/web
npm test
```

Kỳ vọng: typecheck sạch (`typeof fetch`, `AbortSignal.timeout`, kiểu template literal `id_token_${IdTokenFailure}`); toàn bộ test xanh, gồm `test/architecture.test.ts` (không SQL mới; `src/auth/oauth/*` không chạm bảng) và `test/i18n/parity.test.ts` (không có khóa mới). `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng (không dependency mới).

```
git add apps/web/src/auth/oauth/provider.ts apps/web/src/auth/oauth/oidc.ts apps/web/src/auth/oauth/fake.ts apps/web/src/auth/oauth/index.ts apps/web/src/domain/identity.ts apps/web/src/env.ts apps/web/vitest.config.ts apps/web/test/env.d.ts apps/web/wrangler.jsonc apps/web/test/domain/identity.test.ts apps/web/test/db/identities.test.ts apps/web/test/auth/oauth-oidc.test.ts apps/web/test/auth/oauth-providers.test.ts
git commit -m "feat(web): OAuth provider port, Google and LinkedIn adapters, fake provider (VNX-2603b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận của task (mỗi dòng một lệnh):**

| # | Tiêu chí | Lệnh |
|---|---|---|
| 1 | Token request: URL hằng số, `POST`, `redirect: "manual"` và mọi 3xx bị từ chối (`fetch` gọi đúng một lần), timeout, đúng sáu trường form, `new Request(url, init)` không ném lỗi trong workerd; ID token chỉ từ JSON token endpoint | `npm test -w apps/web -- test/auth/oauth-oidc.test.ts` |
| 2 | Kết quả chỉ `{ subject, label }`; không token, không `name`; `label` = email, không thì "Google"/"LinkedIn"; luôn thỏa CHECK 1–254 (đi qua `linkIdentity`) | `npm test -w apps/web -- test/auth/oauth-oidc.test.ts` |
| 3 | Mọi lỗi là mã cố định; mọi lỗi claim ra `id_token_<reason>`; mỗi adapter chỉ nhận `iss` của provider mình; không `console.*` nào | `npm test -w apps/web -- test/auth/oauth-oidc.test.ts test/auth/oauth-providers.test.ts` |
| 4 | Provider giả chỉ bật khi `OAUTH_DRIVER=fake` và `MAIL_DRIVER=fake` không có `RESEND_API_KEY` thật; `wrangler.jsonc` không có `OAUTH_DRIVER` và không có client ID/secret | `npm test -w apps/web -- test/auth/oauth-providers.test.ts` |
| 5 | Thiếu hoặc rỗng client ID hoặc secret thì `getOAuthProvider` là `null` (provider tắt); GitHub `null` ngoài driver giả cho tới Task 4 | `npm test -w apps/web -- test/auth/oauth-providers.test.ts` |
| 6 | Provider giả từ chối `code` dùng lại hoặc lạ hoặc của provider khác (S2), và kiểm `verifier`/`redirectUri`/`nonce` (cả ba bắt buộc ở `issueFakeCode`) | `npm test -w apps/web -- test/auth/oauth-providers.test.ts` |
| 7 | `label` rỗng và 255 ký tự bị CHECK từ chối, 254 được (nghĩa vụ review VNX-2602) | `npm test -w apps/web -- test/db/identities.test.ts` |
| 8 | Không dependency mới | `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng |
| 9 | Typecheck và toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

**Kích cỡ ước tính:** mã nguồn ~240 dòng (`provider.ts` 40, `oidc.ts` 75, `fake.ts` 45, `index.ts` 55, `env.ts`/`identity.ts`/vitest/wrangler ~25), test ~330 dòng, không có locale. Dưới 600 dòng, không cần tách.

#### Kết quả review Task 3 (Opus, 2026-10-07): APPROVE_WITH_CHANGES, đã sửa F1–F4, S1
