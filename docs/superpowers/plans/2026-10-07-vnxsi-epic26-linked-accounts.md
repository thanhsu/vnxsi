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
   - (b) URL token endpoint là hằng số trong code (Google `https://oauth2.googleapis.com/token`, LinkedIn `https://www.linkedin.com/oauth/v2/accessToken`), không bao giờ từ input; `fetch` dùng `redirect: "error"`;
   - (c) `iss` khớp chính xác: Google `https://accounts.google.com` hoặc `accounts.google.com`; LinkedIn `https://www.linkedin.com/oauth`;
   - (d) `aud` bằng client ID, và `azp`, nếu có, cũng bằng client ID; `exp` còn hạn (dung sai 60 s); `nonce` khớp; có `sub`.
   Lợi: bỏ fetch/cache JWKS, code RS256, chế độ lỗi "JWKS không tải được thì không ai đăng nhập được". Mất: một lớp phòng thủ chiều sâu nếu có kẻ chen vào kênh TLS tới provider (không thực tế trong workerd). `verifyIdToken` là một bước có tên rõ để thêm kiểm chữ ký sau này mà không đổi chữ ký hàm.
4. **Một cookie `__Host-vnx_oauth`, không ký, mang `{ v:1, provider, intent, state, verifier, nonce, next, locale, sessionHash, exp }` (JSON → base64url).** Theo ADR-012 mục 1: HttpOnly, Secure, `SameSite=Lax` (callback là GET top-level từ provider, `Strict` sẽ làm cookie không được gửi), `Path=/`, 600 giây, xóa ngay khi callback chạy (dùng một lần; cũng xóa khi lỗi). Không ký vì `__Host-` chặn cookie tossing từ subdomain và kẻ giả mạo cookie của nạn nhân đã vượt qua mọi thứ khác; thêm khóa ký là thêm một secret phải quản lý. `state` kiểm bằng so sánh thời gian cố định với tham số `state` ở callback. Luồng liên kết: `POST …/link` (đã qua `originCheck`, cần session) ghi cookie `{ intent:"link", provider, sessionHash (S1, xem cuối mục), exp ≤ 120 giây }` rồi 303; `GET …/start` đọc cookie đó: nếu có intent `link` còn hạn, cùng provider và `sessionHash` khớp session hiện tại thì giữ intent `link`, ngược lại intent là `signin`; nó sinh `state`/PKCE/`nonce` và ghi lại cookie. Callback với intent `link` cần session hiện tại có `sessionHash` khớp, nếu không từ chối. `start` chỉ thấy intent `link` nếu POST đã ghi nó: không có tham số URL nào chọn intent. `sessionHash` = `sha256("oauth-link:" + raw session id)` (S1; không dùng `sessions.id_hash` nguyên văn). Callback từ chối khi `cookie.provider !== :provider` (F5).
5. **Provider giả qua port + `OAUTH_DRIVER`.** `OAuthProvider` là interface (`buildAuthorizeUrl`, `exchange(code, verifier, nonce) → ProviderIdentity`); `getOAuthProvider(env, provider)` trả adapter thật, hoặc `FakeOAuthProvider` khi `env.OAUTH_DRIVER === "fake"` (cùng cách `MAIL_DRIVER`, `TURNSTILE_DRIVER`; `vitest.config.ts` đặt `OAUTH_DRIVER: "fake"`; `wrangler.jsonc` không có biến này, có test cấm). Adapter thật nhận `fetch` tiêm vào, nên test adapter dùng `fetch` giả trả JSON dựng sẵn. Test không bao giờ gọi mạng.
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
- **LinkedIn:** `email` có thể thiếu (→ `label` là chữ "LinkedIn", quyết định 12). VNX-2601 phải xác nhận LinkedIn trả lại `nonce` trong ID token; kiểm `nonce` giữ fail closed, nếu LinkedIn không trả thì quay lại Reviewer, không bỏ kiểm tra.
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
- **Task 3 (VNX-2603b).** `auth/oauth/provider.ts` (interface và kiểu `ProviderIdentity = { subject, label }`), `auth/oauth/oidc.ts` (đổi `code`, gọi `verifyIdToken`, dùng chung Google và LinkedIn; cấu hình endpoint cố định theo provider), `auth/oauth/fake.ts` (`FakeOAuthProvider` với bảng `code → identity` do test đặt; mô phỏng `state`/PKCE/nonce đúng để bắt lỗi của lõi), `auth/oauth/index.ts` (`getOAuthProvider`, `isProviderConfigured`); `env.ts` thêm 6 secret tùy chọn và `OAUTH_DRIVER`; `vitest.config.ts` đặt `OAUTH_DRIVER: "fake"`. Test adapter bằng `fetch` giả: token endpoint trả ID token sai `aud` thì từ chối; không có chuỗi token nào xuất hiện trong log. `FakeOAuthProvider` từ chối `code` đã dùng (S2). Adapter kiểm điều kiện (a)–(b) của quyết định 3 (ID token chỉ từ JSON token endpoint, URL hằng số, `fetch` có `redirect: "error"`).
- **Task 4 (VNX-2603c).** `auth/oauth/github.ts`: đổi `code` (+ `code_verifier`) ở `https://github.com/login/oauth/access_token` với `Accept: application/json`, rồi `GET https://api.github.com/user` (có `User-Agent`, `Authorization: Bearer`), lấy `id` (số → chuỗi) và `login`; bỏ token ngay. Test với `fetch` giả: `id` số thành `subject`, `login` đổi nhưng `subject` giữ nguyên; lỗi HTTP và thiếu `id` bị từ chối; token không bị log.
- **Task 5 (VNX-2604a).** Sửa `auth/ops.ts` (`requireOps`) và `auth/middleware.ts` (`requireAdmin`) để từ chối `user.method !== "magic_link"` (quyết định 9); `resolveOpsRole` không đổi. Test: session `oauth_github` và `oauth_google` vào `/ops` nhận đúng bytes của `opsNotFound`; vào `/admin` nhận 403; `magic_link` không đổi; `resolveOpsRole` vẫn trả vai trò cho user có session OAuth. Quyết định rõ: kiểm vẫn ở `requireAdmin`, không chuyển vào `isAdminUser` sau khi rebase M7 (F7).
- **Task 6 (VNX-2604b).** `routes/oauth.tsx`: `GET /auth/oauth/:provider/start` (cờ, cấu hình, sinh state/PKCE/nonce, ghi cookie, 302), `GET /auth/oauth/:provider/callback` (cờ tắt → 404 trước mọi việc khác; rate limit; cookie + `state`; `provider.exchange`; tìm `findIdentityByProviderSubject`; user `suspended` → 403 như magic link; chưa liên kết → trang chung; tìm thấy → `createSession(…, sessionMethodFor(provider))`, `touchIdentityLogin`, audit `auth.login` có `data.method`, cookie session, redirect `safeNext`). Header theo quyết định 11. View trang "chưa liên kết" (câu VI của ADR-012 mục 3; EN, zh-Hans, zh-Hant do Owner duyệt). Test dùng `FakeOAuthProvider`. Callback từ chối khi `cookie.provider !== :provider` (F5, có test). Đăng nhập OAuth gọi `markLogin` (`src/db/users.ts:40`) đúng như `completeLogin` (`src/routes/auth.tsx:43`) (F10). Thêm: assertion kiến trúc rằng `routes/oauth.tsx` và các import của nó không import `db/ops-members.ts`, và test user có lời mời Ops `pending` đăng nhập bằng OAuth không có hàng `ops_members` (F3). Test quét `console.error` ở mọi đường lỗi (F5). Nếu ước tính > 600 dòng khi viết section, tách (ví dụ route start và route callback riêng) (F9).
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
