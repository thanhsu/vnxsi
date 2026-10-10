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
- **(2026-10-08) Câu chữ Task 6** (trang "chưa liên kết", trang lỗi, nút đăng nhập bằng email) duyệt nguyên văn 4 locale; zh-Hant dùng 連結 cho liên kết tài khoản; giữ "trang tài khoản" tới Task 8.
- **(2026-10-08) Task 8:** mục `/me` "Đăng nhập & tài khoản liên kết" chỉ hiện khi có ít nhất một provider khả dụng (cờ bật và đã cấu hình) hoặc user có ít nhất một identity; hàng đã liên kết vẫn hiện khi cờ của nó tắt (để còn hủy liên kết), lệch ADR-012 §4 "cho mọi user"; câu chữ `/me`, trang trung gian, thông báo (kể cả `taken` nói "đã liên kết với tài khoản VNX.SI khác" kèm contact@vnx.si) và câu `oauth.notLinked.body` mới Owner duyệt nguyên văn 4 locale.
- **(2026-10-07) Email báo liên kết/hủy liên kết** gồm: tên provider, `label`, thời điểm (UTC), và câu "Không phải bạn? Đăng nhập bằng link qua email, hủy liên kết ở `/me` và viết cho contact@vnx.si". Email chỉ gửi tới `users.email` của chính chủ.
- **(2026-10-10) Task 9:** câu chữ nút hủy liên kết, hai thông báo, hai email (gồm dòng link `/me` trơn) duyệt nguyên văn 4 locale; câu "Không phải bạn?" của email hủy liên kết là "kiểm tra các tài khoản liên kết ở /me"; mục `/me` chỉ-thông-báo chỉ cho `unlinked`/`notLinked`; thêm task VNX-2605c (kết thúc session `oauth_<provider>` khi hủy liên kết), bắt buộc trước VNX-2608.
- **(2026-10-10) Task 10-11:** (E1) cờ của một provider **tắt thì huy hiệu công khai của provider đó biến mất khỏi `/b/:handle` và công tắc của nó biến mất khỏi `/hub/profile`**; route truyền danh sách provider khả dụng (cờ bật VÀ đã cấu hình, quy tắc `availableProviders`) vào `listPublicBadges` và view hub; `show_on_profile` đã lưu KHÔNG bị đổi bởi cờ, bật lại cờ thì huy hiệu hiện lại. (E2) tài khoản EMU: giữ link như ADR-012 §5; xem lại bằng tài khoản thật ở VNX-2608. (E3) câu chữ hai task duyệt nguyên văn 4 locale. Link GitHub đi thẳng, không qua `/go/` (xem "Ghi nhận" của Task 11).
- **(2026-10-10) Task 9c (VNX-2605c) và Task 12:** (E1 = b1) hủy liên kết P kết thúc MỌI session `oauth_<P>` của user, kể cả của người bấm khi session đó là `oauth_<P>` (route xóa cookie, 303 `/me?link=unlinked`, `/login?next=…` rồi thông báo "unlinked" có sẵn; không chuỗi mới); (E2) "đăng xuất các phiên khác" vào backlog sau VNX-2608, rủi ro còn lại ghi ở "Ghi nhận" của Task 9c; (E3) email hủy liên kết thêm `email.identityUnlinked.sessions`, duyệt nguyên văn 4 locale; (E4) bổ sung pháp lý tài khoản liên kết không phải "thay đổi quan trọng", không báo trước. Task 12 chờ rebase lên `main` (bản M7 của Privacy). Thứ tự: 9c, rebase, 12, 2604d, 2608.
- **(2026-10-10) Task 9d (VNX-2605d, ADR-013):** bắt đầu liên kết (`POST …/link`), `start` nhánh link và callback nhánh `link` chỉ với session `magic_link`; session `oauth_*` vẫn đăng nhập, xem `/me` và hủy liên kết; callback kiểm lại session còn sống và vẫn là `magic_link` NGAY TRONG câu INSERT ghi liên kết; `/me` giải thích thay cho nút "Liên kết" (câu chữ chờ Owner duyệt). Bắt buộc trước VNX-2608; thứ tự mới: 9c, 9d, rebase, 12, 2604d, 2608.

## Quyết định thiết kế của Reviewer (Opus đã duyệt có chỉnh, 2026-10-07)

Lựa chọn kỹ thuật của Planner ở chỗ ADR-012 im lặng hoặc roadmap mơ hồ. Mục 3 lệch roadmap, mục 9 và 10 mở rộng ADR về phía chặt hơn; Reviewer quyết.

1. **Số migration `0017_user_identities.sql`, và luật merge.** `main` có tới `0013_ops_members.sql`; nhánh `feat/m7-metrics` (chưa merge) giữ `0014_product_stats`, `0015_view_dedupe`, `0016_public_stats`. EPIC 26 lấy `0017` để không trùng số với M7 bất kể ai merge trước. Luật: (a) M7 merge trước → không đổi gì; (b) EPIC 26 merge trước → vẫn dùng `0017`, M7 merge sau và D1 áp `0014`–`0016` khi chạy `db:migrate:remote` (wrangler áp mọi file chưa áp, không đòi liền số; hai bên không có phụ thuộc dữ liệu); (c) nếu `main` lúc merge đã có số ≥ `0017`, đổi tên file thành số kế tiếp và sửa mọi chỗ nhắc tên file trong plan, ghi vào báo cáo. Rebase lên `main` ngay trước merge; xung đột dự kiến chỉ ở `test/architecture.test.ts` (M7 sửa ~120 dòng), dòng ghi chú migration trong `wrangler.jsonc` và `auth/middleware.ts` (`requireAdmin`, Task 5; xem nghĩa vụ rebase cuối Task 5).
2. **Không thêm dependency: tự viết PKCE/OAuth bằng `fetch` + WebCrypto**, không dùng `arctic` hay thư viện tương tự. Lý do: Global Constraints của M0–EPIC 21 cấm dependency mới; phần cần viết nhỏ (S256 là một lần `crypto.subtle.digest`, đổi code lấy token là một `POST` form, GitHub `GET /user`, tất cả đã có trong runtime workerd); một thư viện vẫn bắt ta tự kiểm `iss`/`aud`/`exp`/`nonce` (arctic chỉ cung cấp `decodeIdToken` không kiểm gì), nên không tiết kiệm phần khó nhất; thêm một gói vào chuỗi cung ứng của luồng đăng nhập là rủi ro lớn hơn ~250 dòng code có test. ADR-012 cho phép thư viện nhỏ nhưng không bắt buộc. Quyết định đã duyệt R2 (Reviewer 2026-10-07). So sánh hằng thời gian (Task 2) dùng `crypto.subtle.timingSafeEqual` của workerd trên hai mảng byte cùng độ dài (hiện `src/` chưa có helper nào; viết một hàm nhỏ trong `domain/oauth.ts` hoặc `auth/crypto.ts`).
3. **ID token: KHÔNG kiểm chữ ký bằng JWKS (lệch dòng roadmap VNX-2603 "kiểm ID token (JWKS, …)", đã được Reviewer duyệt ngày 2026-10-07, quyết định R1).** Căn cứ OIDC Core §3.1.3.7 mục 6: ID token nhận **trực tiếp từ token endpoint qua TLS** thì kiểm chữ ký là tùy chọn (MAY); Google ghi như vậy. Điều kiện bắt buộc, mỗi điều có test (Task 2, 3):
   - (a) ID token chỉ lấy từ JSON trả về của token endpoint, không bao giờ từ query, fragment hay authorize response;
   - (b) URL token endpoint là hằng số trong code (Google `https://oauth2.googleapis.com/token`, LinkedIn `https://www.linkedin.com/oauth/v2/accessToken`), không bao giờ từ input; `fetch` dùng `redirect: "manual"` và mọi 3xx bị từ chối (workerd không hỗ trợ `"error"`: "error won't be implemented since it does not make sense at the edge"; 3xx không phải `res.ok` nên thành `token_request`);
   - (c) `iss` khớp chính xác: Google `https://accounts.google.com` hoặc `accounts.google.com`; LinkedIn `https://www.linkedin.com/oauth`;
   - (d) `aud` bằng client ID, và `azp`, nếu có, cũng bằng client ID; `exp` còn hạn (dung sai 60 s); `nonce` khớp; có `sub`.
   Lợi: bỏ fetch/cache JWKS, code RS256, chế độ lỗi "JWKS không tải được thì không ai đăng nhập được". Mất: một lớp phòng thủ chiều sâu nếu có kẻ chen vào kênh TLS tới provider (không thực tế trong workerd). `verifyIdToken` là một bước có tên rõ để thêm kiểm chữ ký sau này (khi đó hàm thành async; chấp nhận đổi chữ ký nếu có ngày cần JWKS).
4. **Một cookie `__Host-vnx_oauth`, không ký, mang `{ v:1, provider, intent, state, verifier, nonce, next, locale, sessionHash, exp }` (JSON → base64url).** Theo ADR-012 mục 1: HttpOnly, Secure, `SameSite=Lax` (callback là GET top-level từ provider, `Strict` sẽ làm cookie không được gửi), `Path=/`, 600 giây, xóa ngay khi callback chạy (dùng một lần; cũng xóa khi lỗi). Không ký vì `__Host-` chặn cookie tossing từ subdomain và kẻ giả mạo cookie của nạn nhân đã vượt qua mọi thứ khác; thêm khóa ký là thêm một secret phải quản lý. `state` kiểm bằng so sánh thời gian cố định với tham số `state` ở callback. Luồng liên kết: `POST …/link` (đã qua `originCheck`, cần session) ghi cookie `{ intent:"link", provider, sessionHash (S1, xem cuối mục), exp ≤ 120 giây }` rồi 303; `GET …/start` đọc cookie đó: nếu có intent `link` còn hạn, cùng provider và `sessionHash` khớp session hiện tại thì giữ intent `link`, ngược lại intent là `signin`; nó sinh `state`/PKCE/`nonce` và ghi lại cookie. Callback với intent `link` cần session hiện tại có `sessionHash` khớp, nếu không từ chối. `start` chỉ thấy intent `link` nếu POST đã ghi nó: không có tham số URL nào chọn intent. `sessionHash` = `sha256("oauth-link:" + raw session id)` (S1; không dùng `sessions.id_hash` nguyên văn). Callback từ chối khi `cookie.provider !== :provider` (F5). **Mở rộng (Task 8, review MEDIUM-2, Owner 2026-10-08):** `start` cũng coi một flow cookie `intent: "link"` còn hạn, cùng provider và gắn với đúng session đang sống, như một intent: nó hiện lại trang trung gian với `state` mới (tải lại trang không rơi về `signin`); flow cookie `signin`, flow `link` của session khác, hoặc session đã hết hạn vẫn là `signin`. `resolveStartIntent` không đổi; điều kiện thêm nằm ở route.
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
| 7 | VNX-2604c | Nút provider ở `/login` (theo cờ + cấu hình), CSS; **chỉ chữ, logo tách sang VNX-2604d** (lệch "logo tự host" của dòng này, Reviewer duyệt 2026-10-08) | 6 | 10, 12 |
| 8 | VNX-2605a | `/me` mục "Đăng nhập & tài khoản liên kết" (liệt kê), `POST …/link` (Origin, intent vào cookie, 303), nhánh `link` ở callback, xung đột identity; kiểm tay chuỗi redirect | 6 | 4, 5, 12 |
| 9 | VNX-2605b | `POST …/unlink`; email báo liên kết và hủy liên kết 4 locale (`email/templates/identity.ts`) | 8 | 6 |
| — | VNX-2605c | Kết thúc các session `oauth_<provider>` khi hủy liên kết provider đó (trừ session đang thực hiện), và/hoặc "đăng xuất các phiên khác"; **điều kiện bắt buộc trước VNX-2608**; plan chi tiết sau | 9 | 6 |
| — | VNX-2605d | Chỉ liên kết provider mới từ session `magic_link` (ADR-013): `POST …/link`, `start` và callback nhánh `link` từ chối session `oauth_*`; callback kiểm lại session ngay trong câu INSERT ghi liên kết; `/me` giải thích thay cho nút "Liên kết"; **điều kiện bắt buộc trước VNX-2608** | 9c | 5, 4, 7 |
| 10 | VNX-2606a | `setShowOnProfile` và công tắc ở `/hub/profile` (theo câu hỏi mở 5) | 1 | 8 |
| 11 | VNX-2606b | Huy hiệu trên `/b/:handle` (GitHub link, LinkedIn nhãn, Google không); test không lộ client và không vào xếp hạng | 10, 8 | 8 |
| 12 | VNX-2607 | Chép bổ sung ADR-012 vào `## EN`/`## VI` của `docs/legal/privacy.md`, `terms.md` và `src/legal/content.ts`, đối chiếu code thật (tên cột, cookie, thời hạn); merge trước khi bật cờ | 9, 11 | — |
| — | VNX-2604d | Logo chính thức trong nút `/login` (file do Owner giao ở VNX-2601), CSS `.oauth-logo`, test file tồn tại. Phải xong **trước** VNX-2608 (Owner 2026-10-08, ADR-012 "Hệ quả": nút theo guideline thương hiệu của từng provider) | 2601, 7 | 10, 12 |
| — | VNX-2608 | **HUMAN, HIGH-RISK.** Owner bật 3 cờ trên production, thử đăng nhập và liên kết bằng tài khoản thật | 2601, 12, 2604d, 2605c, 2605d | — |

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

---

### Task 4: VNX-2603c — Adapter GitHub (OAuth 2.0, `GET /user`)

**Files:**
- Create: `apps/web/src/auth/oauth/github.ts`
- Modify: `apps/web/src/auth/oauth/provider.ts` (thêm hai mã lỗi vào `ExchangeFailure`)
- Modify: `apps/web/src/auth/oauth/index.ts` (nhánh github của `oauthCredentials`, `getOAuthProvider` dựng `GithubClient`)
- Modify: `apps/web/src/env.ts` (`GITHUB_CLIENT_ID?`, `GITHUB_CLIENT_SECRET?`)
- Modify: `apps/web/vitest.config.ts` (ghim `GITHUB_CLIENT_ID` và `GITHUB_CLIENT_SECRET` là `""`)
- Modify: `apps/web/wrangler.jsonc` (chỉ sửa ghi chú: bỏ "GitHub's two join with its adapter", liệt kê đủ sáu secret)
- Modify (test có sẵn): `apps/web/test/auth/oauth-providers.test.ts`
- Test (mới): `apps/web/test/auth/oauth-github.test.ts`
- Không có route, không khóa i18n, không migration, không dependency mới.

**Interfaces:**
- Consumes: `ProviderClient`, `ExchangeInput`, `ExchangeResult`, `ExchangeFailure` (`auth/oauth/provider.ts`); `OAUTH_PROVIDER_SPECS.github` (`domain/oauth.ts`: không issuer, không nonce, không scope); `PROVIDER_NAME` (`domain/identity.ts`); `linkIdentity` (`db/identities.ts`, test); `getOAuthProvider`, `oauthCredentials` (`auth/oauth/index.ts`).
- Produces:
  - `auth/oauth/github.ts`: `GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"`, `GITHUB_USER_URL = "https://api.github.com/user"`, `class GithubClient implements ProviderClient` (`new GithubClient(clientId, clientSecret, fetchFn)`, `provider = "github"`).
  - `ExchangeFailure` thêm `"profile_request" | "profile_response"` (lỗi của lần gọi `GET /user`, cùng ý nghĩa với `token_request` / `token_response`).
  - `oauthCredentials(env, "github")` đọc `GITHUB_CLIENT_ID` và `GITHUB_CLIENT_SECRET`; `getOAuthProvider(env, "github")` trả `GithubClient` khi cả hai có.

**Quyết định kỹ thuật:**
- **Hai lần `fetch`, hai URL hằng số (quyết định 3 (b)):** (1) `POST GITHUB_TOKEN_URL` với `Accept: application/json` (không có thì GitHub trả dạng form), thân form `client_id`, `client_secret`, `code`, `redirect_uri`, `code_verifier` (PKCE S256 được gửi; GitHub không bắt buộc, nên `state` và client secret vẫn là lớp chính, xem Rủi ro; không có `grant_type`, GitHub không dùng); (2) `GET GITHUB_USER_URL` với `Authorization: Bearer <access_token>`, `Accept: application/vnd.github+json`, `User-Agent: vnx.si` (api.github.com từ chối request không có User-Agent), `X-GitHub-Api-Version: 2022-11-28`. Cả hai: `redirect: "manual"` (workerd không hỗ trợ `"error"`; một 3xx không phải `res.ok` nên thành `token_request` hoặc `profile_request`), `AbortSignal.timeout(8000)`. Không đọc `scope`, `token_type` hay `refresh_token`.
- **Access token chỉ sống trong một biến cục bộ** giữa hai lần gọi: nằm trong header `Authorization` của đúng lần gọi thứ hai, không nằm trong kết quả, không trong log (không `console.*` nào), không trong DB. Hết hàm là bỏ. Review Focus 9.
- **`subject` là `id` số dạng chuỗi (ADR-012 §1), không bao giờ `login`:** `id` phải là `number`, nguyên, an toàn (`Number.isSafeInteger`) và > 0; chuỗi `"583231"`, `0`, số âm, số thập phân, số vượt 2^53 hay thiếu thì `profile_response`. Chỉ chấp nhận kiểu `number` vì GitHub luôn trả số; không nới sang chuỗi để không làm hai biểu diễn của cùng một tài khoản thành hai `subject` khác nhau.
- **`label` là `login`, và `login` không hợp lệ thì TỪ CHỐI (`profile_response`), không rơi về `PROVIDER_NAME.github` như Google/LinkedIn rơi về tên provider.** Lý do: ở Google và LinkedIn `label` chỉ để chủ tài khoản nhận ra; ở GitHub `label` còn là nguồn của huy hiệu công khai `@login` và link `https://github.com/<login>` (Task 11). Nếu fallback là chữ "GitHub" thì Task 11 không phân biệt được nó với một login thật và có thể dựng link sai; từ chối giữ bất biến "label của identity GitHub luôn là một login hợp lệ". Hợp lệ = khớp `^[A-Za-z0-9][A-Za-z0-9-]{0,38}$` (GitHub: chữ số, chữ cái, gạch ngang, tối đa 39 ký tự). Quy tắc này chặt hơn CHECK `length(label) BETWEEN 1 AND 254` nên mọi `label` hợp lệ đều qua CHECK (test đi qua `linkIdentity`); đồng thời chặn `/`, `?`, `#`, khoảng trắng trong login trước khi chúng vào link. GitHub không bao giờ trả login thiếu hoặc rỗng cho một người dùng thật, nên việc từ chối chỉ xảy ra khi API đổi; khi đó đăng nhập thất bại với mã cố định thay vì ghi dữ liệu xấu.
- **Không đọc `name`, `email`, `avatar_url`, hay bất kỳ trường nào khác** của `/user` (addendum Privacy đã duyệt chỉ liệt kê tên người dùng cho GitHub; F2).
- **Phản hồi 200 mang `error` của token endpoint** (GitHub trả 200 kèm `{"error":"bad_verification_code"}`) thành `token_response`, vì thiếu `access_token`; non-2xx hoặc lỗi mạng là `token_request`. Lần gọi `/user` chỉ xảy ra khi có `access_token`.
- **Adapter vẫn không import Hono, DB, không log** (test quét tĩnh của Task 3 tự bao `github.ts`: nó dò mọi file `src/auth/oauth/*.ts`).

- [ ] **Step 1: Test adapter GitHub (fail)**

`apps/web/test/auth/oauth-github.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { GITHUB_TOKEN_URL, GITHUB_USER_URL, GithubClient } from "../../src/auth/oauth/github.ts";
import { getOAuthProvider } from "../../src/auth/oauth/index.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = Date.parse("2026-10-07T10:00:00.000Z");
const INPUT = { code: "auth-code", verifier: "v".repeat(43), nonce: "n".repeat(43), redirectUri: "https://vnx.si/auth/oauth/github/callback", now: NOW };
const ACCESS = "gho_SECRET-ACCESS-TOKEN";
const PROFILE = { id: 583231, login: "octocat", name: "The Octocat", email: "octocat@github.example", avatar_url: "https://avatars.example/u/583231" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tokenOk = () => json({ access_token: ACCESS, token_type: "bearer", scope: "", refresh_token: "ghr_SECRET-REFRESH" });
const redirect = (status = 302) => new Response(null, { status, headers: { location: "https://evil.example/x" } });

type Call = { url: string; init: RequestInit };
/** Answers the n-th fetch with the n-th responder; a call beyond the list fails the test. */
function stubFetch(...responders: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const respond = responders[calls.length - 1];
    if (!respond) throw new Error(`unexpected fetch #${calls.length}`);
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}
const client = (fn: typeof fetch) => new GithubClient("client-id", "client-secret", fn);
const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>;
const run = (profile: unknown) => {
  const { fn, calls } = stubFetch(tokenOk, () => json(profile));
  return client(fn).exchange(INPUT).then((result) => ({ result, calls }));
};

describe("GithubClient requests (decision 3 (b), F1)", () => {
  it("exchanges the code at the constant token URL, then reads the profile once at the constant user URL", async () => {
    expect([GITHUB_TOKEN_URL, GITHUB_USER_URL]).toEqual(["https://github.com/login/oauth/access_token", "https://api.github.com/user"]);
    const { calls } = await run(PROFILE);
    expect(calls).toHaveLength(2);
    const [token, user] = calls;

    expect(token?.url).toBe(GITHUB_TOKEN_URL);
    expect(token?.init.method).toBe("POST");
    expect(token?.init.redirect).toBe("manual");
    expect(token?.init.signal).toBeInstanceOf(AbortSignal);
    expect(headersOf(token)).toMatchObject({ accept: "application/json", "content-type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(String(token?.init.body)))).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      code: "auth-code",
      redirect_uri: INPUT.redirectUri,
      code_verifier: INPUT.verifier,
    });

    expect(user?.url).toBe(GITHUB_USER_URL);
    expect(user?.init.method).toBe("GET");
    expect(user?.init.redirect).toBe("manual");
    expect(user?.init.signal).toBeInstanceOf(AbortSignal);
    expect(user?.init.body).toBeUndefined();
    expect(headersOf(user)).toEqual({ authorization: `Bearer ${ACCESS}`, accept: "application/vnd.github+json", "user-agent": "vnx.si", "x-github-api-version": "2022-11-28" });
  });

  it("sends the access token only in the Authorization header of the profile call, nowhere in the token call", async () => {
    const { calls } = await run(PROFILE);
    const [token, user] = calls;
    expect(JSON.stringify({ url: token?.url, init: { ...token?.init, body: String(token?.init.body), signal: undefined } })).not.toContain(ACCESS);
    expect(user?.url).not.toContain(ACCESS);
    expect(JSON.stringify(headersOf(user)).split(ACCESS)).toHaveLength(2);
  });

  it("builds options the workerd runtime accepts for both calls: a Request made from each captured call does not throw", async () => {
    const { calls } = await run(PROFILE);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(() => new Request(call.url, call.init), call.url).not.toThrow();
  });

  it("treats any redirect on either call as a failure and goes no further", async () => {
    for (const status of [301, 302, 307]) {
      const first = stubFetch(() => redirect(status));
      expect(await client(first.fn).exchange(INPUT), `token ${status}`).toEqual({ ok: false, reason: "token_request" });
      expect(first.calls, `token ${status}`).toHaveLength(1);
      const second = stubFetch(tokenOk, () => redirect(status));
      expect(await client(second.fn).exchange(INPUT), `user ${status}`).toEqual({ ok: false, reason: "profile_request" });
      expect(second.calls, `user ${status}`).toHaveLength(2);
    }
  });

  it("passes the injected fetch through getOAuthProvider", async () => {
    const env = { ...testEnv, OAUTH_DRIVER: undefined, GITHUB_CLIENT_ID: "hid", GITHUB_CLIENT_SECRET: "hsecret" } as Bindings;
    const { fn, calls } = stubFetch(() => json({}, 500));
    const provider = getOAuthProvider(env, "github", fn);
    expect(provider).toBeInstanceOf(GithubClient);
    expect(await provider?.exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
    expect(calls.map((c) => c.url)).toEqual([GITHUB_TOKEN_URL]);
  });
});

describe("GithubClient result (ADR-012 §1, decision 12, F2, Review Focus 9)", () => {
  it("returns the numeric id as the subject and the login as the label, and nothing else", async () => {
    const { result } = await run(PROFILE);
    expect(result).toEqual({ ok: true, identity: { subject: "583231", label: "octocat" } });
    const text = JSON.stringify(result);
    for (const secret of [ACCESS, "ghr_SECRET-REFRESH", "client-secret", "auth-code", "The Octocat", "octocat@github.example", "avatars.example"]) expect(text, secret).not.toContain(secret);
  });

  it("keys the account on the id: a renamed login keeps the subject and changes only the label", async () => {
    const before = await run(PROFILE);
    const after = await run({ ...PROFILE, login: "renamed-cat" });
    expect(before.result).toEqual({ ok: true, identity: { subject: "583231", label: "octocat" } });
    expect(after.result).toEqual({ ok: true, identity: { subject: "583231", label: "renamed-cat" } });
  });

  it("accepts the largest safe id, and a 39-character login", async () => {
    const login = `a${"b".repeat(38)}`;
    expect((await run({ id: Number.MAX_SAFE_INTEGER, login })).result).toEqual({ ok: true, identity: { subject: "9007199254740991", label: login } });
  });

  it("refuses a missing, non-numeric or unsafe id (profile_response), and never falls back to the login", async () => {
    for (const id of [undefined, null, "583231", "octocat", 0, -5, 1.5, 9007199254740993, Number.NaN, true, [583231]]) {
      const { result } = await run({ ...PROFILE, id });
      expect(result, String(id)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("refuses a login that is missing, empty, too long or not a plain GitHub login (profile_response)", async () => {
    for (const login of [undefined, null, 42, "", " ", "a".repeat(40), "octo cat", "octo/cat", "octo?x=1", "octo#", "-octocat", "octo\ncat", "@octocat", "octocat[bot]", "é"]) {
      const { result } = await run({ ...PROFILE, login });
      expect(result, JSON.stringify(login)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("always gives a label the database accepts (1-254 characters)", async () => {
    const user = await ensureUser("github-label@vnx.si");
    const { result } = await run({ id: 7001, login: "x".repeat(39) });
    if (!result.ok) throw new Error(result.reason);
    expect(result.identity.label.length).toBeGreaterThanOrEqual(1);
    expect(result.identity.label.length).toBeLessThanOrEqual(254);
    expect((await linkIdentity(testEnv.DB, { userId: user.id, provider: "github", subject: result.identity.subject, label: result.identity.label, now: "2026-10-07T10:00:00.000Z" })).ok).toBe(true);
  });
});

describe("GithubClient failures give fixed codes", () => {
  it("maps a failed or non-2xx token request to token_request, without calling /user", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ error: "server" }, 500), () => json({}, 401), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_request" });
      expect(calls).toHaveLength(1);
    }
  });

  it("maps an unreadable token response, or a 200 that carries an error or no access token, to token_response, without calling /user", async () => {
    const cases: Array<() => Response> = [
      () => new Response("access_token=abc&token_type=bearer", { status: 200 }),
      () => json([1, 2]),
      () => json({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }),
      () => json({ access_token: "" }),
      () => json({ access_token: 5 }),
      () => json({ token_type: "bearer" }),
    ];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "token_response" });
      expect(calls).toHaveLength(1);
    }
  });

  it("maps a failed or non-2xx profile request to profile_request", async () => {
    const cases: Array<() => Response | Promise<Response>> = [() => json({ message: "Bad credentials" }, 401), () => json({}, 500), () => { throw new TypeError("network failure"); }];
    for (const respond of cases) {
      const { fn, calls } = stubFetch(tokenOk, respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "profile_request" });
      expect(calls).toHaveLength(2);
    }
  });

  it("maps an unreadable or non-object profile to profile_response", async () => {
    for (const respond of [() => new Response("<html>", { status: 200 }), () => json([PROFILE]), () => json("octocat"), () => json(null)]) {
      const { fn } = stubFetch(tokenOk, respond);
      expect(await client(fn).exchange(INPUT)).toEqual({ ok: false, reason: "profile_response" });
    }
  });

  it("logs nothing on success or failure, and no failure text carries a token (Review Focus 9)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      const runs: Array<Array<() => Response>> = [[tokenOk, () => json(PROFILE)], [() => json({}, 500)], [() => json({ error: "bad_verification_code" })], [tokenOk, () => json({}, 401)], [tokenOk, () => json({ id: "x", login: "y" })]];
      for (const responders of runs) {
        const { fn } = stubFetch(...responders);
        const result = await client(fn).exchange(INPUT);
        expect(JSON.stringify(result)).not.toContain(ACCESS);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/oauth-github.test.ts` → FAIL (`auth/oauth/github.ts` chưa có).

- [ ] **Step 2: Mã lỗi và adapter**

`apps/web/src/auth/oauth/provider.ts`: đổi dòng `ExchangeFailure` thành

```ts
export type ExchangeFailure = "token_request" | "token_response" | "profile_request" | "profile_response" | `id_token_${IdTokenFailure}`;
```

và thêm vào comment ngay trên đó: "`profile_*` is GitHub's `GET /user` (plain OAuth 2.0 has no ID token)".

`apps/web/src/auth/oauth/github.ts`:

```ts
import type { ExchangeFailure, ExchangeInput, ExchangeResult, ProviderClient } from "./provider.ts";

/** Constants, never built from input (decision 3 (b)). */
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";

const TIMEOUT_MS = 8000;
/** A GitHub login: letters, digits and hyphens, at most 39 characters. Stricter than the label CHECK, so it can never put `/`, `?` or `#` in a profile link. */
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * GitHub: OAuth 2.0 authorization code, then one `GET /user`. The account is the numeric `id` (never `login`, which can change);
 * the label is the `login`, refreshed at every sign-in (ADR-012 §1, §5). The access token lives in one local variable between the
 * two calls, goes only into the second call's Authorization header, and is never returned, stored or logged. Nothing else of
 * the profile (name, e-mail, avatar) is read. No logging here: callers log the fixed failure code.
 */
export class GithubClient implements ProviderClient {
  readonly provider = "github" as const;

  constructor(
    readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: typeof fetch,
  ) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const fail = (reason: ExchangeFailure): ExchangeResult => ({ ok: false, reason });
    const fetchFn = this.fetchFn;

    let accessToken: string;
    try {
      const res = await fetchFn(GITHUB_TOKEN_URL, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: input.code,
          redirect_uri: input.redirectUri,
          code_verifier: input.verifier,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("token_request");
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return fail("token_response");
      }
      // GitHub answers 200 with {"error": …} for a bad code: no access_token, so token_response.
      const token = isRecord(body) ? body.access_token : undefined;
      if (typeof token !== "string" || token === "") return fail("token_response");
      accessToken = token;
    } catch {
      return fail("token_request");
    }

    let profile: unknown;
    try {
      const res = await fetchFn(GITHUB_USER_URL, {
        method: "GET",
        redirect: "manual",
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json", "user-agent": "vnx.si", "x-github-api-version": "2022-11-28" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("profile_request");
      try {
        profile = await res.json();
      } catch {
        return fail("profile_response");
      }
    } catch {
      return fail("profile_request");
    }

    if (!isRecord(profile)) return fail("profile_response");
    const { id, login } = profile;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return fail("profile_response");
    if (typeof login !== "string" || !LOGIN.test(login)) return fail("profile_response");
    return { ok: true, identity: { subject: String(id), label: login } };
  }
}
```

Chạy: `npm test -w apps/web -- test/auth/oauth-github.test.ts` → các test thuần adapter PASS; test "passes the injected fetch through getOAuthProvider" còn FAIL (factory chưa nối, Step 3–4).

- [ ] **Step 3: Test cấu hình (fail)**

Sửa `apps/web/test/auth/oauth-providers.test.ts`:
- thêm `import { GithubClient } from "../../src/auth/oauth/github.ts";`;
- `REAL` thêm `GITHUB_CLIENT_ID: "hid", GITHUB_CLIENT_SECRET: "hsecret"`;
- test "runs with the fake driver and no client credentials" lặp thêm hai khóa:

```ts
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const) expect(testEnv[key] ?? "", key).toBe("");
```

- thay test "has no GitHub adapter yet (Task 4) …" bằng:

```ts
  it("returns the GitHub adapter when both credentials exist, and nothing when either is missing or blank", () => {
    const env = withEnv(REAL);
    expect(getOAuthProvider(env, "github")).toBeInstanceOf(GithubClient);
    expect(getOAuthProvider(env, "github")).toMatchObject({ provider: "github", clientId: "hid" });
    expect(isProviderConfigured(env, "github")).toBe(true);
    for (const over of [{ GITHUB_CLIENT_ID: undefined }, { GITHUB_CLIENT_ID: "" }, { GITHUB_CLIENT_ID: "  " }, { GITHUB_CLIENT_SECRET: undefined }, { GITHUB_CLIENT_SECRET: " " }]) {
      const broken = withEnv({ ...REAL, ...over });
      expect(oauthCredentials(broken, "github"), JSON.stringify(over)).toBeNull();
      expect(getOAuthProvider(broken, "github")).toBeNull();
      expect(isProviderConfigured(broken, "github")).toBe(false);
      expect(isProviderConfigured(broken, "google")).toBe(true);
    }
  });
```

Chạy: `npm test -w apps/web -- test/auth/oauth-providers.test.ts test/auth/oauth-github.test.ts` → FAIL (`GITHUB_CLIENT_*` chưa có trong `env.ts`/factory; kiểu chưa có).

- [ ] **Step 4: Nối factory, env, vitest, ghi chú**

`apps/web/src/env.ts`: thêm sau `GOOGLE_CLIENT_SECRET?: string;`

```ts
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
```

`apps/web/src/auth/oauth/index.ts`:
- thêm `import { GithubClient } from "./github.ts";`;
- `OAuthEnv` thêm `| "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET"`;
- sửa comment của `oauthCredentials` thành `/** The provider's client id and secret, or null when either is missing or blank (decision 6). */` và thân:

```ts
  const [id, secret] =
    provider === "google"
      ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET]
      : provider === "github"
        ? [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET]
        : [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET];
```

- `getOAuthProvider`: thay hai dòng cuối bằng

```ts
  const credentials = oauthCredentials(env, provider);
  if (!credentials) return null;
  if (provider === "github") return new GithubClient(credentials.clientId, credentials.clientSecret, fetchFn);
  return new OidcClient(provider, credentials.clientId, credentials.clientSecret, fetchFn);
```

`apps/web/vitest.config.ts`: trong khối ghim rỗng, thêm giữa Google và LinkedIn

```ts
            GITHUB_CLIENT_ID: "",
            GITHUB_CLIENT_SECRET: "",
```

`apps/web/wrangler.jsonc`: ghi chú OAuth đổi thành (vẫn không chứa chuỗi `OAUTH_DRIVER`, không có biến nào):

```jsonc
  // OAuth sign-in (EPIC 26, ADR-012): the client ids and secrets are wrangler secrets, never vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  // GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET. Local dev: apps/web/.dev.vars. A provider missing
  // either of its two is off whatever its feature flag says. The test driver for OAuth is a vitest binding only and never appears here.
```

Chạy: `npm test -w apps/web -- test/auth/oauth-github.test.ts test/auth/oauth-providers.test.ts test/auth/oauth-oidc.test.ts` → PASS.

- [ ] **Step 5: Kiểm toàn bộ và commit**

```
npm run typecheck -w apps/web
npm test
```

Kỳ vọng: typecheck sạch (`ExchangeFailure` thêm hai mã không làm gãy nơi nào, vì chưa có route nào `switch` trên nó); toàn bộ test xanh, gồm test quét tĩnh của Task 3 (`src/auth/oauth/*.ts` không `console.`, Hono, `db/`; chỉ `index.ts` import `fake.ts`), `test/architecture.test.ts` và `test/i18n/parity.test.ts` (không khóa mới). `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng.

```
git add apps/web/src/auth/oauth/github.ts apps/web/src/auth/oauth/provider.ts apps/web/src/auth/oauth/index.ts apps/web/src/env.ts apps/web/vitest.config.ts apps/web/wrangler.jsonc apps/web/test/auth/oauth-github.test.ts apps/web/test/auth/oauth-providers.test.ts
git commit -m "feat(web): GitHub OAuth adapter (VNX-2603c)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận của task (mỗi dòng một lệnh):**

| # | Tiêu chí | Lệnh |
|---|---|---|
| 1 | Hai lần gọi, hai URL hằng số; token call đúng năm trường form có `code_verifier`, `Accept: application/json`; user call có `Authorization: Bearer`, `User-Agent`, không thân; cả hai `redirect: "manual"` và timeout | `npm test -w apps/web -- test/auth/oauth-github.test.ts` |
| 2 | Mọi 3xx ở một trong hai lần gọi là thất bại và dừng (đếm số `fetch`); `new Request(url, init)` không ném lỗi cho cả hai | `npm test -w apps/web -- test/auth/oauth-github.test.ts` |
| 3 | `subject` là `id` số dạng chuỗi, đổi `login` không đổi `subject`; `id` thiếu, chuỗi, 0, âm, thập phân, không an toàn bị từ chối | `npm test -w apps/web -- test/auth/oauth-github.test.ts` |
| 4 | `label` là `login`; `login` thiếu, rỗng, quá 39 ký tự hoặc có ký tự ngoài `[A-Za-z0-9-]` bị từ chối; `label` hợp lệ qua `linkIdentity` | `npm test -w apps/web -- test/auth/oauth-github.test.ts` |
| 5 | Kết quả không chứa access token, refresh token, `name`, `email`, avatar; token chỉ ở header của lần gọi thứ hai; không `console.*`; lỗi là mã cố định (`token_*`, `profile_*`) | `npm test -w apps/web -- test/auth/oauth-github.test.ts` |
| 6 | `getOAuthProvider(env, "github")` trả `GithubClient` khi đủ hai secret, `null` khi thiếu hoặc trống; `testEnv` không có credential nào, kể cả GitHub | `npm test -w apps/web -- test/auth/oauth-providers.test.ts` |
| 7 | Không dependency mới | `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng |
| 8 | Typecheck và toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

**Kích cỡ ước tính:** mã nguồn ~110 dòng (`github.ts` ~85, `index.ts`/`env.ts`/`provider.ts`/vitest/wrangler ~25), test ~270 dòng, không có locale. Dưới 600 dòng, không cần tách.

**Nghĩa vụ cho Task 11:** `label` của identity GitHub luôn là một login hợp lệ (bất biến do Task này giữ), nên huy hiệu có thể dựng `https://github.com/<label>` mà không cần kiểm lại; Task 11 vẫn mã hóa an toàn khi render.

#### Kết quả review Task 4 (2026-10-07): Owner duyệt trực tiếp ("approve"); lượt review plan của Opus bị ngắt khi phiên khởi động lại. Các câu hỏi cấp plan (regex `login` so với luật username GitHub, GitHub có nhận `code_verifier` không, giá trị `X-GitHub-Api-Version`) chuyển sang review code của Task 4.

---

### Task 5: VNX-2604a — `requireOps` và `requireAdmin` chỉ nhận session `magic_link`

**Files:**
- Modify: `apps/web/src/domain/identity.ts` (thêm `isStaffSession`)
- Modify: `apps/web/src/auth/ops.ts` (`requireOps`), `apps/web/src/auth/middleware.ts` (`requireAdmin`)
- Modify: `apps/web/test/fixtures.ts` (`signIn` nhận `method`)
- Modify (test): `apps/web/test/ops/guard.test.ts` (nhóm test mới "OAuth sessions never reach /ops")
- Test (mới): `apps/web/test/auth/staff-session.test.ts` (`/admin`, `/me`, `/hub`, trang công khai, assertion nguồn)

**Interfaces:**
- Consumes: `SessionMethod`, `SESSION_METHODS` (`domain/identity.ts`); `SessionUser.method`, `createSession(db, userId, now, method)` (`auth/sessions.ts`, Task 1); `opsNotFound`, `resolveOpsRole`, `requireOps` (`auth/ops.ts`); `requireAdmin`, `requireUser` (`auth/middleware.ts`); `errorResponse(c, "forbidden", 403)`; `adminEmails` (`auth/admin.ts`); fixtures `signIn`, `makeBuilder`, `ensureUser`; helpers `getReq`, `formPost`, `testEnv`.
- Produces: `isStaffSession(method: SessionMethod): boolean` trong `domain/identity.ts` (`method === "magic_link"`); `signIn(email, { admin?, locale?, method? })` trong fixtures.

**Quyết định kỹ thuật:**
- Hai guard gọi `isStaffSession`; `resolveOpsRole` và `adminEmails` (`auth/admin.ts`) **không** đụng `method` (quyết định 9, R4, F7). Header plan nhắc `isAdminUser`, nhưng hàm đó chưa có trên nhánh này (chỉ có ở `feat/m7-metrics`, `auth/admin.ts`); trên nhánh này `auth/admin.ts` chỉ có `adminEmails`. Test kiến trúc cấm `method` trong `auth/admin.ts` nên sau rebase M7 `isAdminUser` vẫn được bảo vệ.
- Hành vi từ chối **đọc từ code thật**: `/ops/*` → `opsNotFound` (404 kín; `opsHeaders` thêm `no-store` và `noindex`); `/admin/*` → `errorResponse(c, "forbidden", 403)` (không redirect `/login`; redirect chỉ dành cho người chưa đăng nhập). Session OAuth là "đã đăng nhập" nên nhận đúng 403 như người đăng nhập không phải admin.
- `requireOps` kiểm `method` **trước** `resolveOpsRole` (không đọc D1 khi đã biết từ chối). Phản hồi không phụ thuộc thứ tự vì mọi đường từ chối cùng trả `opsNotFound`.
- Task này đứng trước mọi route tạo session OAuth, nên test tạo session thật bằng `createSession(db, userId, now, "oauth_github")` (qua `signIn(…, { method })`), không insert thô. Vòng lặp trên ba `oauth_*` lấy từ `SESSION_METHODS.filter((m) => m !== "magic_link")` để provider thêm sau tự được phủ.
- `requireUser`, `requireBuilder` và mọi route không phải nhân viên không đổi.

- [ ] **Step 1: Fixture và test thất bại**

`apps/web/test/fixtures.ts`: thêm `import type { SessionMethod } from "../src/domain/identity.ts";` và sửa `signIn`:

```ts
export async function signIn(email: string, opts: { admin?: boolean; locale?: string; method?: SessionMethod } = {}): Promise<{ user: UserRow; cookie: string }> {
  const user = await ensureUser(email, opts.locale);
  if (opts.admin) await testEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?1").bind(user.id).run();
  return { user, cookie: `__Host-vnx_session=${await createSession(testEnv.DB, user.id, new Date(), opts.method)}` };
}
```

`apps/web/test/ops/guard.test.ts`: thêm import `SESSION_METHODS` từ `../../src/domain/identity.ts` và `resolveOpsRole` vào import `../../src/auth/ops.ts`; thêm cuối file:

```ts
const OAUTH_METHODS = SESSION_METHODS.filter((m) => m !== "magic_link");

describe("OAuth sessions never reach /ops (ADR-012 §6, decision 9)", () => {
  it("has three OAuth methods to cover", () => {
    expect(OAUTH_METHODS).toEqual(["oauth_google", "oauth_github", "oauth_linkedin"]);
  });

  it("gives an ADMIN_EMAILS owner with an oauth_* session the same sealed 404 as an anonymous visitor, on GET and POST", async () => {
    const real = createApp();
    const fake = opsApp();
    // Control: the same user through a magic link still gets in.
    const magic = await signIn(ROOT);
    expect((await send(real, "/ops", { cookie: magic.cookie })).res.status).toBe(200);
    expect((await send(fake, "/ops/fake", { cookie: magic.cookie })).body).toBe("view:owner");
    expect((await send(fake, "/ops/fake", { cookie: magic.cookie, method: "POST" })).body).toBe("act:owner");

    const cases: Array<[string, Opts]> = [
      ["/ops", {}],
      ["/ops/marketplace/builders", {}],
      ["/ops/marketplace/builders/x/approve", { method: "POST" }],
    ];
    for (const method of OAUTH_METHODS) {
      const oauth = await signIn(ROOT, { method });
      for (const [path, opts] of cases) {
        const anonymous = await denial(real, path, opts);
        const got = await denial(real, path, { ...opts, cookie: oauth.cookie });
        expect(anonymous.status, `${method} ${path}`).toBe(404);
        expect(got, `${method} ${path}`).toEqual(anonymous);
        expect(got.headers, `${method} ${path}`).toContainEqual(["cache-control", "no-store"]);
        expect(got.headers, `${method} ${path}`).toContainEqual(["x-robots-tag", "noindex, nofollow"]);
      }
      // The guarded fake routes (view, team.manage, act) refuse too.
      const fakes: Array<[string, Opts]> = [["/ops/fake", {}], ["/ops/fake/team", {}], ["/ops/fake", { method: "POST" }]];
      for (const [path, opts] of fakes) {
        expect(await denial(fake, path, { ...opts, cookie: oauth.cookie }), `${method} ${path}`).toEqual(await denial(fake, path, opts));
      }
    }
  });

  it("refuses an oauth_* session of an Ops member too, and a stale session naming the owner", async () => {
    const operator = await member(`ops-guard-oauth-${tag()}@vnx.si`, "operator");
    const oauth = await signIn(operator.user.email, { method: "oauth_google" });
    const reference = await denial(opsApp(), "/ops/fake");
    expect(await denial(opsApp(), "/ops/fake", { cookie: oauth.cookie })).toEqual(reference);
    expect((await send(opsApp(), "/ops/fake", { cookie: operator.cookie })).body).toBe("view:operator");
    const root = await ensureUser(ROOT);
    expect(await denial(opsApp({ ...sessionUser(root), method: "oauth_linkedin" }), "/ops/fake")).toEqual(reference);
  });

  it("leaves the resolver alone: resolveOpsRole still names the role of a user whose session came from OAuth (M7 isStaff relies on it)", async () => {
    const root = await ensureUser(ROOT);
    expect(await resolveOpsRole(env, { ...sessionUser(root), method: "oauth_github" })).toBe("owner");
    expect(await resolveOpsRole(env, sessionUser(root))).toBe("owner");
  });
});
```

`apps/web/test/auth/staff-session.test.ts` (mới):

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { readFlags, resetFlagCache } from "../../src/db/flags.ts";
import { isStaffSession, SESSION_METHODS } from "../../src/domain/identity.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
/** A source file with LF endings: src/auth/*.ts are CRLF on disk (core.autocrlf) and ?raw keeps the bytes (cf. test/legal/content.test.ts). */
function source(path: string): string {
  const raw = SOURCES[`../../src/${path}`];
  expect(raw, path).toBeDefined();
  return (raw as string).replace(/\r\n/g, "\n");
}
const OAUTH_METHODS = SESSION_METHODS.filter((m) => m !== "magic_link");
const tag = () => crypto.randomUUID().slice(0, 8);

const app = () => createApp();
/** Status, headers and body with the request id (cf-ray) removed. */
async function seen(req: (ray: string) => Request) {
  const ray = `ray-${tag()}`;
  const res = await app().request(req(ray), undefined, testEnv);
  return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
}
const get = (path: string, cookie: string) => (ray: string) => new Request(`https://vnx.si${path}`, { headers: { cookie, "cf-ray": ray } });
const post = (path: string, cookie: string) => (ray: string) => formPost(path, { enabled: "1" }, { cookie, "cf-ray": ray });

describe("isStaffSession", () => {
  it("accepts magic_link and nothing else", () => {
    expect(isStaffSession("magic_link")).toBe(true);
    for (const method of OAUTH_METHODS) expect(isStaffSession(method), method).toBe(false);
  });
});

describe("/admin refuses oauth_* sessions (decision 9)", () => {
  it("denies an ADMIN_EMAILS admin with an oauth_* session exactly like a signed-in non-admin: 403, same bytes", async () => {
    const plain = await signIn(`staff-plain-${tag()}@vnx.si`);
    const magic = await signIn("owner@vnx.si", { admin: true });
    // Control: the same admin through a magic link is let in (GET /admin redirects to /admin/builders).
    expect((await app().request(getReq("/admin", magic.cookie), undefined, testEnv)).status).toBe(303);
    for (const path of ["/admin", "/admin/flags", "/admin/builders"]) {
      const reference = await seen(get(path, plain.cookie));
      expect(reference.status, path).toBe(403);
      for (const method of OAUTH_METHODS) {
        const oauth = await signIn("owner@vnx.si", { admin: true, method });
        expect(await seen(get(path, oauth.cookie)), `${method} ${path}`).toEqual(reference);
      }
    }
  });

  it("refuses an admin POST with an oauth_* session and changes nothing", async () => {
    const oauth = await signIn("owner@vnx.si", { admin: true, method: "oauth_github" });
    const target = await signIn(`staff-target-${tag()}@vnx.si`);
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
    const audits = () => testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE actor_user_id = ?1").bind(oauth.user.id).first<{ n: number }>();
    const before = await audits();
    expect((await seen(post("/admin/flags/affiliate", oauth.cookie))).status).toBe(403);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);
    expect((await seen(post(`/admin/users/${target.user.id}/suspend`, oauth.cookie))).status).toBe(403);
    const row = await testEnv.DB.prepare("SELECT status FROM users WHERE id = ?1").bind(target.user.id).first<{ status: string }>();
    expect(row?.status).toBe("active");
    expect((await audits())?.n).toBe(before?.n);
  });
});

describe("non-staff routes are unchanged for oauth_* sessions", () => {
  it("serves /me, /hub and public pages", async () => {
    const email = `staff-user-${tag()}@vnx.si`;
    await makeBuilder(email, `staff-${tag()}`, "approved");
    for (const method of OAUTH_METHODS) {
      const { cookie } = await signIn(email, { method });
      for (const path of ["/me", "/hub", "/", "/login"]) {
        const res = await app().request(getReq(path, cookie), undefined, testEnv);
        expect(res.status, `${method} ${path}`).toBe(200);
      }
    }
  });
});

describe("where the method check lives (decision 9, R4, F7)", () => {
  /** The text of a top-level function or const, from its start to the first line that is just `}` or `};`. */
  function block(file: string, start: RegExp): string {
    const src = source(file);
    const at = src.search(start);
    expect(at, `${file} ${start}`).toBeGreaterThanOrEqual(0);
    const rest = src.slice(at);
    const end = rest.search(/\n\};?\n/);
    expect(end, `${file} ${start}: terminator not found`).toBeGreaterThan(0);
    return rest.slice(0, end + 3);
  }

  it("the two guards call isStaffSession; the resolver, the admin e-mail helper and requireUser never read the method", () => {
    const ops = block("auth/ops.ts", /export function requireOps/);
    expect(ops).toContain("isStaffSession(");
    expect(ops.indexOf("isStaffSession(")).toBeLessThan(ops.indexOf("resolveOpsRole("));
    expect(block("auth/middleware.ts", /export const requireAdmin/)).toContain("isStaffSession(");
    expect(block("auth/ops.ts", /export async function resolveOpsRole/)).not.toMatch(/method/i);
    expect(block("auth/middleware.ts", /export const requireUser/)).not.toMatch(/method|isStaffSession/);
    expect(source("auth/admin.ts")).not.toMatch(/method|isStaffSession/);
  });

  // Tripwire: a new legitimate caller of isStaffSession needs Reviewer sign-off (it changes who counts as staff).
  it("no other file decides staff access from the session method", () => {
    const users = Object.entries(SOURCES).filter(([, src]) => src.includes("isStaffSession"));
    expect(users.map(([f]) => f.replace("../../src/", "")).sort()).toEqual(["auth/middleware.ts", "auth/ops.ts", "domain/identity.ts"]);
  });
});
```

(Đích ghi của POST là user thật (`signIn` mới) và cờ `affiliate` thật, nên nếu guard hở thì test thấy thay đổi thật. Nếu `/hub` của builder `approved` không trả 200 với fixture này, Implementer đối chiếu với `test/hub/*` và chọn fixture đúng, không đổi khẳng định.)

- [ ] **Step 2: Chạy, thấy thất bại**

Run: `npm test -w apps/web -- test/ops/guard.test.ts test/auth/staff-session.test.ts`
Expected: FAIL. `isStaffSession` chưa có (import lỗi ở `staff-session.test.ts`); trong `guard.test.ts` các case `oauth_*` nhận 200 thay vì 404.

- [ ] **Step 3: Cài đặt**

`apps/web/src/domain/identity.ts`, ngay dưới `sessionMethodFor`:

```ts
/**
 * Only a magic-link session reaches /ops and /admin (ADR-012 §6, plan decision 9). Called by the two guards, requireOps
 * and requireAdmin, and nowhere else: never from resolveOpsRole or the admin e-mail helper, which M7's isStaff also uses
 * to keep staff out of the statistics whatever way they signed in.
 */
export function isStaffSession(method: SessionMethod): boolean {
  return method === "magic_link";
}
```

`apps/web/src/auth/ops.ts`: thêm `import { isStaffSession } from "../domain/identity.ts";` và đổi thân `requireOps`:

```ts
export function requireOps(capability: OpsCapability): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    // An OAuth session is never staff (ADR-012 §6): the same sealed 404 as every other denial. Checked here, not in resolveOpsRole.
    if (!user || !isStaffSession(user.method)) return opsNotFound(c);
    const role = await resolveOpsRole(c.env, user);
    if (!role || !can(role, capability)) return opsNotFound(c);
    c.set("opsRole", role);
    await next();
  };
}
```

`apps/web/src/auth/middleware.ts`: thêm `import { isStaffSession } from "../domain/identity.ts";` và đổi điều kiện của `requireAdmin`:

```ts
  // ADMIN_EMAILS is the source of truth: removing an e-mail revokes access on the next request.
  // A session that did not come from a magic link gets the same 403 as any other non-admin (ADR-012 §6, decision 9).
  if (!user.isAdmin || !isStaffSession(user.method) || !adminEmails(c.env).has(user.email)) return errorResponse(c, "forbidden", 403);
```

- [ ] **Step 4: Chạy, thấy pass**

Run: `npm test -w apps/web -- test/ops/guard.test.ts test/auth/staff-session.test.ts test/auth/sessions.test.ts test/admin/flags.test.ts`
Expected: PASS (các test `magic_link` cũ không đổi).

- [ ] **Step 5: Kiểm toàn bộ, commit**

Run: `npm run typecheck -w apps/web` rồi `npm test`. Expected: xanh. `git diff --stat` chỉ gồm các file ở mục Files.

```bash
git add apps/web/src/domain/identity.ts apps/web/src/auth/ops.ts apps/web/src/auth/middleware.ts apps/web/test/fixtures.ts apps/web/test/ops/guard.test.ts apps/web/test/auth/staff-session.test.ts
git commit -m "feat(web): /ops and /admin accept only magic-link sessions (VNX-2604a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận (mỗi cái một lệnh):**
- Session `oauth_*` của owner `ADMIN_EMAILS` nhận 404 byte-giống người chưa đăng nhập (trừ request id) trên `/ops`, GET và POST `/ops/*`; cùng user với `magic_link` vẫn 200: `npm test -w apps/web -- test/ops/guard.test.ts -t "OAuth sessions never reach"`.
- `/admin` với `oauth_*` của admin nhận 403 như user thường; `/me`, `/hub`, `/`, `/login` vẫn 200; `isStaffSession` đúng: `npm test -w apps/web -- test/auth/staff-session.test.ts`.
- `resolveOpsRole`, `auth/admin.ts`, `requireUser` không tham chiếu `method`: test "where the method check lives" trong cùng file.

**Kích cỡ ước tính:** mã nguồn ~20 dòng (identity 8, ops 6, middleware 4, fixtures 2), test ~160 dòng (guard ~55, staff-session ~105), không có locale. Dưới 600 dòng, không cần tách.

**Nghĩa vụ cho task sau:** Task 6 chỉ tạo session `oauth_*` qua `sessionMethodFor(provider)`; không route nào được cho `method` khác `magic_link` truy cập `/ops` hoặc `/admin`. Khi rebase M7 (`feat/m7-metrics`):
- (a) `requireAdmin` thành `if (!isAdminUser(user, c.env) || !isStaffSession(user.method)) return errorResponse(c, "forbidden", 403);`; kiểm `method` không bao giờ vào `isAdminUser`.
- (b) Sửa các văn bản trên M7 gọi `isAdminUser` là "predicate của guard /admin": docstring `auth/admin.ts`, tiêu đề `test/auth/staff.test.ts:12`, comment `domain/visitor.ts:62`. Chúng phải nói guard CÒN đòi session `magic_link`, để không ai chuyển kiểm đó vào `isAdminUser` (F7).
- (c) Thêm test: `isStaff(env, { ...ownerSessionUser, method: "oauth_github" })` và session `oauth_*` của một thành viên Ops đều trả `true`.

#### Kết quả review Task 5 (Opus, 2026-10-07): APPROVE_WITH_CHANGES, đã sửa 1–5

---

### Task 6: VNX-2604b — Route `start` và `callback` (intent `signin`), trang "chưa liên kết", trang lỗi OAuth chung

**Phạm vi:** `GET /auth/oauth/:provider/start` và `GET /auth/oauth/:provider/callback` cho intent `signin`. Không có route `link`, không có nút ở `/login` (Task 7), không có `/me` (Task 8). Đường nào chưa thuộc Task 6 thì bị từ chối rõ ràng (xem "Quyết định kỹ thuật" 1).

**Files:**
- Create: `apps/web/src/routes/oauth.tsx`
- Modify: `apps/web/src/app.ts` (import và `registerOAuthRoutes(app)` ngay trước `registerAuthRoutes(app)`)
- Modify: `apps/web/src/views/auth.tsx` (thêm `OAuthNotLinkedPage`, `OAuthErrorPage`)
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (5 khóa `oauth.*`, ngay sau `auth.invalidLink.requestHint`)
- Modify: `apps/web/test/architecture.test.ts` (`IDENTITY_ALLOWED` thêm `../src/routes/oauth.tsx`; nhóm test "OAuth callback never touches Ops invites")
- Create (test): `apps/web/test/oauth-flow.ts` (helper dùng chung với Task 8), `apps/web/test/auth/oauth-routes.test.ts`

**Interfaces:**
- Consumes (tên thật trong code):
  - `domain/identity.ts`: `isOAuthProvider`, `PROVIDER_FLAG`, `sessionMethodFor`, `OAUTH_PROVIDERS`, `type OAuthProvider`.
  - `domain/oauth.ts`: `buildAuthorizeUrl({ provider, clientId, redirectUri, state, challenge, nonce })`, `codeChallengeS256`, `generateState/Verifier/Nonce`, `newFlowCookie`, `newLinkIntent`, `encodeOAuthCookie`, `parseOAuthCookie`, `oauthRedirectUri(appOrigin, provider)`, `resolveStartIntent(cookie, sessionHash, now)`, `checkCallbackState(cookie, stateParam)`.
  - `auth/oauth-cookie.ts`: `readOAuthCookie(c, provider, now)`, `writeOAuthCookie(c, cookie, now)`, `clearOAuthCookie(c)`, `linkSessionHash(raw)`, `OAUTH_COOKIE`.
  - `auth/oauth/index.ts`: `getOAuthProvider(env, provider)` → `ProviderClient | null` (`.clientId`, `.exchange({ code, verifier, nonce, redirectUri, now })` → `{ ok: true, identity: { subject, label } } | { ok: false, reason: ExchangeFailure }`); `auth/oauth/fake.ts`: `issueFakeCode(provider, identity, { verifier, nonce, redirectUri })`, `resetFakeOAuth`.
  - `db/flags.ts`: `isFlagEnabled(db, key)`, `setFlag`; `db/identities.ts`: `findIdentityByProviderSubject`, `linkIdentity`, `touchIdentityLogin(db, { id, label, now })`; `db/users.ts`: `findUserById`, `markLogin(db, id, { now, isAdmin })`, `setUserStatusStatement`; `db/audit.ts`: `writeAudit`; `db/ops-members.ts` (chỉ trong test): `createOpsInviteStatement`, `findPendingOpsInvite`; `auth/sessions.ts`: `createSession(db, userId, now, method)`; `auth/cookies.ts`: `readSessionCookie`, `writeSessionCookie`; `auth/admin.ts`: `adminEmails`; `http/rate-limit.ts`: `hitRateLimit(db, key, limit, windowSeconds, nowMs)`; `http/next.ts`: `safeNext`; `views/error-response.tsx`: `errorResponse`; `views/render.ts`: `page`; fixtures `ensureUser`, `signIn`.
- Produces:
  - `routes/oauth.tsx`: `registerOAuthRoutes(app: Hono<AppEnv>): void`; kiểu nội bộ `OAuthFailure` (union mã lỗi cố định, là thứ duy nhất được log).
  - `views/auth.tsx`: `OAuthNotLinkedPage: FC<{ locale; origin }>`, `OAuthErrorPage: FC<{ locale; origin }>`.
  - `test/oauth-flow.ts`: `enableProvider(provider)`, `linkedUser(email, provider, identity)`, `startOAuth(provider, query?, cookie?)` → `{ res, cookie, flow, authorize }`, `issueCodeFor(provider, started, identity)` (luôn truyền đủ `verifier`, `nonce`, `redirectUri`), `callbackReq(provider, params, cookie?, headers?, env?)`, `clearedOAuthCookie(res)`.

**Quyết định kỹ thuật (Planner; Reviewer kiểm):**
1. **Intent `link` chưa thuộc Task 6, từ chối rõ ràng, không bỏ trống.** (a) `start` vẫn gọi `resolveStartIntent`, truyền `linkSessionHash(raw)` chỉ khi `c.get("user")` khác null, còn lại `null` (nghĩa vụ Task 2 LOW-2). Nếu kết quả là `link` (chỉ xảy ra sau khi Task 8 có `POST …/link`), Task 6 xóa cookie và trả trang lỗi chung 400 với mã `link_unsupported`; Task 8 thay đúng nhánh này bằng trang trung gian 200 (quyết định 14). (b) `callback` thấy flow cookie có `intent !== "signin"` thì cũng `link_unsupported` trước mọi việc khác, không gọi `exchange`; Task 8 thay bằng nhánh `link`. Cả hai nhánh có test.
2. **Thứ tự callback (cookie `__Host-vnx_oauth` bị xóa ngay đầu handler, nên mọi đường, 404 cũng vậy, đều xóa nó):** header (`no-store`, `same-origin`) → xóa cookie → provider hợp lệ + cờ bật + có cấu hình, ngược lại `errorResponse 404` (trước rate limit, trước mọi việc khác) → rate limit `oauth:ip:<ip>` 20/giờ (429) → cookie + `state` (`checkCallbackState`; cookie sai provider đã bị `parseOAuthCookie` trả `null`, F5) → intent → tham số `error` của provider (người dùng bấm từ chối) hoặc thiếu `code` → `exchange` → tra identity → user. `state` kiểm **trước** `error`, nên request không có cookie hợp lệ không nhận gì khác trang lỗi chung.
3. **Chỉ một trang lỗi chung** (state sai, thiếu, hết hạn, cookie sai provider, người dùng từ chối, provider lỗi, hết lượt, `link_unsupported`, lỗi nội bộ), status 400 (429 khi hết lượt), render tại chỗ, không redirect, không echo tham số nào của request. Mã lỗi chỉ ra log (`console.error` JSON `{ requestId, event, provider, code }`; `event` là `oauth.callback_failed`, hoặc `oauth.start_failed` cho `start`), `code` thuộc union cố định (gồm `ExchangeFailure`); code của callback không bao giờ log `String(err)`, URL, `code`, `state`, nhãn hay phản hồi của provider. Lỗi bất ngờ trong `try`: `try/catch` ngoài cùng (không bind lỗi) trả trang lỗi với mã `internal`, nên `app.onError` (vốn log `String(err)`) không chạy cho lỗi đó. **Giới hạn đúng của khẳng định này:** việc đọc cờ nằm *trước* `try`, và `isFlagEnabled` tự log `flags.read_failed` kèm `String(err)` (chữ lỗi của D1, không có dữ liệu request) rồi trả `false`, tức 404. Đó là dòng log duy nhất ngoài mã cố định mà đường callback có thể sinh ra; không sửa `db/flags.ts` trong task này.
4. **Trang "chưa liên kết": status 200, giống hệt từng byte.** Trang chỉ nhận `locale` (từ flow cookie) và `origin`; không nhận email, `label`, `subject` hay mã request. Email của provider không bao giờ được so với `users.email`: `routes/oauth.tsx` không gọi `findUserByEmail`/`createUser` (test đọc nguồn). Chọn 200 vì đây là trạng thái thông tin, không phải lỗi hệ thống; đổi sang 4xx chỉ cần đổi một hằng, byte-giống vẫn giữ.
5. **User `suspended` hoặc hàng `users` của identity không còn: `errorResponse(c, "forbidden", 403)`** như `POST /auth/verify` (khóa `error.forbidden.*` có sẵn; không thêm chuỗi). Chỉ ai đã chứng minh sở hữu một identity đã liên kết mới thấy trang này.
6. **Đăng nhập thành công (F10):** `markLogin(db, user.id, { now, isAdmin: adminEmails(env).has(user.email) })` đúng như `completeLogin`; `writeAudit` `auth.login`, `entity "user"`, `entityId user.id`, `actorUserId user.id`, `data: { method }` (không `purpose`, không `label`); `touchIdentityLogin`; `createSession(db, user.id, now, sessionMethodFor(provider))`; `writeSessionCookie`; `303` tới `safeNext(flow.next) ?? localizedPath(flow.locale, "/")`. `safeNext` chạy lại dù cookie đã lọc `next` (nhiều lớp; test `"/%2F%2Fevil.example"` qua được lọc cookie vì nó không giải mã, nhưng không qua `safeNext`). Không lời mời Ops, không invite cookie (đó là magic link).
7. **Locale của `start`:** `start` không có tiền tố locale nên `c.get("locale")` luôn là `en`. Locale của luồng = tham số `lang` nếu `isLocale`, ngược lại `localeFromPath(next).locale`, ngược lại `en`; đi vào flow cookie và là locale duy nhất callback dùng (không có cookie hợp lệ thì trang lỗi bằng `en`). `lang` chỉ chọn ngôn ngữ trang, không chọn intent hay đích. **Nghĩa vụ Task 7:** nút ở `/login` là `/auth/oauth/:provider/start?lang=<locale>&next=<safe next>`, với `<locale>` là id của `Locale` (`en`, `vi`, `zh-Hans`, `zh-Hant`), vì `isLocale` phân biệt hoa thường (`zh-hans` bị bỏ qua).
8. **`start` không có rate limit** (không ghi DB, không gọi provider; chỉ sinh cookie và redirect). Callback mới có (Decision 10). `start` cũng có `Cache-Control: no-store` và `Referrer-Policy: same-origin` (URL redirect mang `state`).
9. **Provider giả:** `getOAuthProvider` trả `FakeOAuthProvider` khi `OAUTH_DRIVER=fake`, bất kể credential; nên test "thiếu credential → 404" dùng env `{ ...testEnv, OAUTH_DRIVER: undefined }` (`testEnv` không có `GOOGLE_CLIENT_ID`…, đã có test khóa điều đó). Cờ mặc định **tắt** trong test; mỗi test tự gọi `enableProvider` (dùng `setFlag`, đã reset cache cờ).

**Câu chữ giao diện (Owner duyệt nguyên văn 2026-10-08):**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `oauth.notLinked.title` | Account not linked | Tài khoản chưa được liên kết | 账号尚未关联 | 帳號尚未連結 |
| `oauth.notLinked.body` | This account isn't linked to VNX.SI yet. Sign in with an email link, then link it from your account page. | Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết từ trang tài khoản. | 此账号尚未关联。请先用邮箱登录，再在账户页面关联此账号。 | 此帳號尚未連結。請先用電子郵件登入，再到帳戶頁面連結此帳號。 |
| `oauth.error.title` | We couldn't sign you in | Không đăng nhập được | 无法登录 | 無法登入 |
| `oauth.error.body` | That sign-in didn't work. Please try again, or sign in with an email link. | Lượt đăng nhập này không thành công. Hãy thử lại, hoặc đăng nhập bằng link qua email. | 此次登录未成功。请重试，或改用邮箱登录。 | 此次登入未成功。請再試一次，或改用電子郵件登入。 |
| `oauth.cta.emailLink` | Sign in with an email link | Đăng nhập bằng link qua email | 用邮箱登录 | 用電子郵件登入 |

Trạng thái: **Owner duyệt nguyên văn 2026-10-08** (4 locale). zh-Hant dùng 連結 cho "liên kết tài khoản" (khớp `flags.desc.oauth_*`; Task 8 `/me` phải dùng cùng từ). "trang tài khoản" giữ theo ADR-012, xem lại khi Task 8 đặt tên mục ở `/me`. Câu VI của `oauth.notLinked.body` là nguyên văn ADR-012 §3. Hai trang không nhắc email, không nhắc "đã đăng ký", không phân biệt nguyên nhân (ADR-012 §3.2). Thuật ngữ "liên kết / 关联 / 連結" cần Owner xác nhận cho nhất quán với `/me` (Task 8). Bản này là bản Reviewer đề xuất (Opus, 2026-10-07), đã thay bản nháp đầu của Planner.

- [ ] **Step 1: Khóa i18n (4 locale), để parity xanh trước khi viết view**

Thêm vào mỗi file, ngay sau `auth.invalidLink.requestHint`, đúng bảng trên (sau khi Owner duyệt). Ví dụ `en.ts`:

```ts
  "oauth.notLinked.title": "Account not linked",
  "oauth.notLinked.body": "This account isn't linked to VNX.SI yet. Sign in with an email link, then link it from your account page.",
  "oauth.error.title": "We couldn't sign you in",
  "oauth.error.body": "That sign-in didn't work. Please try again, or sign in with an email link.",
  "oauth.cta.emailLink": "Sign in with an email link",
```

`en.ts` định nghĩa `MessageKey` và `Messages`, nên ba file còn lại lỗi typecheck cho tới khi đủ khóa. Chạy: `npm test -w apps/web -- test/i18n/parity.test.ts` → PASS; `npm run typecheck -w apps/web` → 0 lỗi.

- [ ] **Step 2: Helper test (`apps/web/test/oauth-flow.ts`)**

```ts
import { createApp } from "../src/app.ts";
import { OAUTH_COOKIE } from "../src/auth/oauth-cookie.ts";
import { issueFakeCode } from "../src/auth/oauth/fake.ts";
import { setFlag } from "../src/db/flags.ts";
import { linkIdentity } from "../src/db/identities.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../src/domain/identity.ts";
import { type FlowCookie, oauthRedirectUri, parseOAuthCookie } from "../src/domain/oauth.ts";
import type { Bindings } from "../src/env.ts";
import { ensureUser } from "./fixtures.ts";
import { getReq, setCookieValue, testEnv } from "./helpers.ts";

export async function enableProvider(provider: OAuthProvider) {
  const admin = await ensureUser("oauth-flags@example.com");
  await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled: true, actorUserId: admin.id, now: new Date().toISOString() });
}

export async function linkedUser(email: string, provider: OAuthProvider, identity: { subject: string; label: string }) {
  const user = await ensureUser(email);
  const linked = await linkIdentity(testEnv.DB, { userId: user.id, provider, subject: identity.subject, label: identity.label, now: new Date().toISOString() });
  if (!linked.ok) throw new Error(`link failed: ${linked.reason}`);
  return { user, identity: linked.identity };
}

export interface StartedFlow {
  res: Response;
  /** `Cookie` header value carrying the flow cookie, as the browser sends it back to the callback. */
  cookie: string;
  flow: FlowCookie;
  authorize: URL;
}

/** Calls `/start` the way a browser does and reads back the flow cookie it set. Throws unless start answered 302 with a flow cookie. */
export async function startOAuth(provider: OAuthProvider, query = "", cookie?: string): Promise<StartedFlow> {
  const res = await createApp().request(getReq(`/auth/oauth/${provider}/start${query}`, cookie), undefined, testEnv);
  const raw = setCookieValue(res, OAUTH_COOKIE) ?? "";
  const flow = parseOAuthCookie(raw, { provider, now: Date.now() });
  if (res.status !== 302 || !flow || flow.phase !== "flow") throw new Error(`start answered ${res.status}`);
  return { res, cookie: `${OAUTH_COOKIE}=${raw}`, flow, authorize: new URL(res.headers.get("location") ?? "") };
}

/** F3: the fake provider needs verifier, nonce AND redirect URI. The redirect URI comes from APP_ORIGIN, never from a request. */
export function issueCodeFor(provider: OAuthProvider, started: StartedFlow, identity: { subject: string; label: string }, override: Partial<{ verifier: string; nonce: string; redirectUri: string }> = {}): string {
  return issueFakeCode(provider, identity, { verifier: started.flow.verifier, nonce: started.flow.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, provider), ...override });
}

// D1 is shared across tests, and the callback is rate limited per IP: each request gets its own address unless the caller sets one.
let nextIp = 0;
const freshIp = () => `198.51.${(++nextIp >> 8) & 255}.${nextIp & 255}`;

export function callbackReq(provider: string, params: Record<string, string>, cookie?: string, headers: Record<string, string> = {}, env: Bindings = testEnv) {
  const url = new URL(`https://vnx.si/auth/oauth/${provider}/callback`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return createApp().request(new Request(url, { headers: { "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}), ...headers } }), undefined, env);
}

/** The Set-Cookie line that deletes the OAuth cookie, or null. */
export function clearedOAuthCookie(res: Response): string | null {
  return res.headers.getSetCookie().find((line) => line.startsWith(`${OAUTH_COOKIE}=`) && /Max-Age=0/i.test(line)) ?? null;
}
```

- [ ] **Step 3: Test kiến trúc (viết trước, đỏ vì file chưa có)**

Trong `apps/web/test/architecture.test.ts`: thêm `"../src/routes/oauth.tsx"` vào `IDENTITY_ALLOWED` (file duy nhất ngoài `db/` được import `db/identities.ts`; không file xếp hạng nào bị đụng), và thêm sau nhóm "linked identities stay in their module":

```ts
// ADR-012 §6, F3: the OAuth callback never looks up or accepts an Ops invitation (that stays a magic-link act, ADR-010 §3).
const OAUTH_ROUTE = "../src/routes/oauth.tsx";

/** Files reachable from `entry` through value imports (`import type` is erased, so it is not a dependency). */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = sources[file] ?? "";
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^"';]*?from\s+["'](\.[^"']+)["']/gm)) {
      const parts = file.slice(0, file.lastIndexOf("/")).split("/");
      for (const seg of (m[1] ?? "").split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      const target = parts.join("/");
      if (sources[target]) queue.push(target);
    }
  }
  return seen;
}

describe("OAuth callback never touches Ops invites (ADR-012 §6, F3)", () => {
  it("routes/oauth.tsx exists and reaches neither db/ops-members.ts nor auth/ops.ts", () => {
    expect(sources[OAUTH_ROUTE]).toBeDefined();
    const reached = reachableFrom(OAUTH_ROUTE);
    expect(reached.has("../src/db/identities.ts")).toBe(true); // the walk really follows imports
    // Positive control (L6): the same walk does find ops-members.ts from the Ops console route, so a `false` above means something.
    expect(reachableFrom("../src/routes/ops.tsx").has("../src/db/ops-members.ts")).toBe(true);
    expect(reached.has("../src/db/ops-members.ts")).toBe(false);
    expect(reached.has("../src/auth/ops.ts")).toBe(false);
  });

  it("routes/oauth.tsx never reads an e-mail to find a user, nor mentions Ops invites", () => {
    expect(sources[OAUTH_ROUTE] ?? "").not.toMatch(/findUserByEmail|createUser|ops_member|OpsInvite/);
  });
});
```

Đường dẫn được nối thủ công (tách theo `/`, `..` bỏ một đoạn, `.` bỏ qua) vì `new URL` chuẩn hóa sai các đường dẫn bắt đầu bằng `../`.

Chạy: `npm test -w apps/web -- test/architecture.test.ts` → FAIL (`routes/oauth.tsx` chưa có; allowlist trỏ vào file không tồn tại).

- [ ] **Step 4: Test route (viết trước, đỏ)**

`apps/web/test/auth/oauth-routes.test.ts`. D1 là chung cho cả file (không rollback giữa các test; tiền lệ `test/db/identities.test.ts:20-21`, `test/admin/merchant-offers.test.ts:28-30`, `test/public/request-form.test.ts:17`), nên: `beforeEach` dọn cờ OAuth và cache cờ; mỗi test dùng email và subject riêng (bộ đếm `tag()`); không đếm toàn bảng mà đếm theo `user_id` / `provider_subject` hoặc delta trước-sau; mỗi request callback có IP riêng (`callbackReq` tự đặt `cf-connecting-ip` mới, test rate limit ghi đè).

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { createOpsInviteStatement, findPendingOpsInvite } from "../../src/db/ops-members.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import { OAUTH_PROVIDERS, type OAuthProvider } from "../../src/domain/identity.ts";
import { codeChallengeS256, encodeOAuthCookie, newFlowCookie, newLinkIntent, oauthRedirectUri } from "../../src/domain/oauth.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { getReq, setCookieValue, testEnv } from "../helpers.ts";
import { callbackReq, clearedOAuthCookie, enableProvider, issueCodeFor, linkedUser, startOAuth, type StartedFlow } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const identityOf = () => ({ subject: `sub-${tag()}`, label: `login-${tag()}` });
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const countWhere = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const sessionsOf = (userId: string) => countWhere("SELECT count(*) AS n FROM sessions WHERE user_id = ?1", userId);
const allSessions = () => countWhere("SELECT count(*) AS n FROM sessions");
const identitiesWithSubject = (...subjects: string[]) => countWhere(`SELECT count(*) AS n FROM user_identities WHERE provider_subject IN (${subjects.map((_, i) => `?${i + 1}`).join(",")})`, ...subjects);
const normalize = (html: string) => html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>");
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;

// Every console method is spied for the whole file: any log line a request produces is checked (Review Focus 9).
const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const method of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
});
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const logged = () => spies.flatMap((spy) => spy.mock.calls).map((args) => args.map(String).join(" "));
const forgetLogs = () => spies.forEach((spy) => spy.mockClear());

/** Exactly one log line, with exactly these keys, the expected code, and none of the secrets (F5, Review Focus 9). */
function expectOneLog(code: string, secrets: string[], event = "oauth.callback_failed", provider = "github") {
  const lines = logged();
  expect(lines, `log lines: ${lines.join(" | ")}`).toHaveLength(1);
  const entry = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  expect(Object.keys(entry).sort()).toEqual(["code", "event", "provider", "requestId"]);
  expect(entry).toMatchObject({ event, provider, code });
  for (const secret of [...secrets, "fake-code-"]) expect(lines[0]).not.toContain(secret);
}

/** L3: every non-redirect response of the routes carries both headers, 404, 403 and 429 included. */
function expectHardened(res: Response) {
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("referrer-policy")).toBe("same-origin");
}

async function linkIntentCookie(sessionCookie: string, provider: OAuthProvider) {
  const raw = sessionCookie.split("=")[1] ?? "";
  return `${OAUTH_COOKIE}=${encodeOAuthCookie(newLinkIntent({ provider, sessionHash: await linkSessionHash(raw) }, Date.now()))}`;
}

describe("start (ADR-012 §1, §3)", () => {
  it.each(OAUTH_PROVIDERS)("%s: 302 to the provider with state, PKCE S256 and the fixed redirect URI", async (provider) => {
    await enableProvider(provider);
    const started = await startOAuth(provider, "?next=/vi/me&lang=vi");
    const url = started.authorize;
    expect(started.res.headers.get("cache-control")).toBe("no-store");
    expect(started.res.headers.get("referrer-policy")).toBe("same-origin");
    expect(url.searchParams.get("state")).toBe(started.flow.state);
    // Task 4: all three providers, GitHub included, carry the S256 challenge of the cookie's verifier.
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await codeChallengeS256(started.flow.verifier));
    expect(url.searchParams.get("redirect_uri")).toBe(oauthRedirectUri(testEnv.APP_ORIGIN, provider));
    expect(url.searchParams.has("nonce")).toBe(provider !== "github");
    expect(started.flow).toMatchObject({ intent: "signin", sessionHash: null, next: "/vi/me", locale: "vi" });
    const line = started.res.headers.getSetCookie().find((l) => l.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
    expect(line).toMatch(/HttpOnly/);
    expect(line).toMatch(/Secure/);
    expect(line).toMatch(/SameSite=Lax/);
  });

  it("takes the locale from next when lang is absent, and drops an unsafe next", async () => {
    await enableProvider("google");
    expect((await startOAuth("google", "?next=/zh-hant/hub")).flow.locale).toBe("zh-Hant");
    expect((await startOAuth("google", "?lang=zh-Hans")).flow.locale).toBe("zh-Hans");
    const unsafe = await startOAuth("google", `?next=${encodeURIComponent("//evil.example")}&lang=klingon`);
    expect(unsafe.flow).toMatchObject({ next: null, locale: "en" });
  });

  it("answers 404 for an unknown provider, an off flag and a missing credential, on start and callback", async () => {
    for (const provider of OAUTH_PROVIDERS) {
      const start = await createApp().request(getReq(`/auth/oauth/${provider}/start`), undefined, testEnv);
      expect(start.status, `${provider} off`).toBe(404);
      expectHardened(start);
      expect((await callbackReq(provider, { state: "x", code: "y" })).status, `${provider} off`).toBe(404);
    }
    expect((await createApp().request(getReq("/auth/oauth/facebook/start"), undefined, testEnv)).status).toBe(404);
    expect((await callbackReq("facebook", { state: "x", code: "y" })).status).toBe(404);
    await enableProvider("github");
    expect((await createApp().request(getReq("/auth/oauth/github/start"), undefined, withoutCredentials)).status, "flag on, no credentials").toBe(404);
    expect((await callbackReq("github", { state: "x", code: "y" }, undefined, {}, withoutCredentials)).status, "flag on, no credentials").toBe(404);
    expect((await createApp().request(getReq("/auth/oauth/google/start"), undefined, testEnv)).status, "another provider's flag stays off").toBe(404);
  });

  it("clears the OAuth cookie on a 404 callback too, and the 404 is hardened", async () => {
    const res = await callbackReq("google", { state: "x" });
    expect(res.status).toBe(404);
    expectHardened(res);
    expect(clearedOAuthCookie(res)).not.toBeNull();
  });

  // Task 2 LOW-2: the session hash is passed only for a live session.
  it("ignores a link-intent cookie whose session has expired: plain sign-in", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const intent = await linkIntentCookie(cookie, "github");
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(user.id, "2020-01-01T00:00:00.000Z").run();
    const started = await startOAuth("github", "", `${cookie}; ${intent}`);
    expect(started.flow.intent).toBe("signin");
  });

  it("refuses a live link intent until Task 8 (link_unsupported), clears the cookie, logs one fixed code", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const intent = await linkIntentCookie(cookie, "github");
    forgetLogs();
    const res = await createApp().request(getReq("/auth/oauth/github/start", `${cookie}; ${intent}`), undefined, testEnv);
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expectHardened(res);
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expectOneLog("link_unsupported", [], "oauth.start_failed");
  });
});

describe("callback: sign in (ADR-012 §3)", () => {
  it.each(OAUTH_PROVIDERS)("%s: a linked user gets an oauth session, an audit row and a redirect to next", async (provider) => {
    await enableProvider(provider);
    const subject = `sub-${tag()}`;
    const { user, identity } = await linkedUser(emailOf(`lan-${provider}`), provider, { subject, label: "old-label" });
    const started = await startOAuth(provider, "?next=/me&lang=en");
    const code = issueCodeFor(provider, started, { subject, label: "new-label" });
    const res = await callbackReq(provider, { code, state: started.flow.state }, started.cookie);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expectHardened(res);
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(setCookieValue(res, "__Host-vnx_session")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const session = await testEnv.DB.prepare("SELECT method FROM sessions WHERE user_id = ?1").bind(user.id).first<{ method: string }>();
    expect(session?.method).toBe(`oauth_${provider}`);
    // F10: the same bookkeeping as completeLogin.
    const login = await testEnv.DB.prepare("SELECT last_login_at FROM users WHERE id = ?1").bind(user.id).first<{ last_login_at: string | null }>();
    expect(login?.last_login_at).not.toBeNull();
    const audit = await testEnv.DB.prepare("SELECT actor_user_id, entity, data FROM audit_log WHERE action = 'auth.login' AND entity_id = ?1").bind(user.id).all<{ actor_user_id: string; entity: string; data: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]).toMatchObject({ actor_user_id: user.id, entity: "user" });
    expect(JSON.parse(audit.results[0]?.data ?? "{}")).toEqual({ method: `oauth_${provider}` });
    const touched = await testEnv.DB.prepare("SELECT label, last_used_at FROM user_identities WHERE id = ?1").bind(identity.id).first<{ label: string; last_used_at: string | null }>();
    expect(touched?.label).toBe("new-label");
    expect(touched?.last_used_at).not.toBeNull();
    expect(logged()).toEqual([]); // a successful sign-in logs nothing
  });

  it("passes next through safeNext on redirect and falls back to the locale home", async () => {
    await enableProvider("github");
    const id = identityOf();
    await linkedUser(emailOf("lan"), "github", id);
    // The cookie layer lets this one through (it does not decode); safeNext does not.
    const crafted = newFlowCookie({ provider: "github", intent: "signin", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: "/%2F%2Fevil.example", locale: "vi", sessionHash: null }, Date.now());
    const code = issueFakeCode("github", id, { verifier: crafted.verifier, nonce: crafted.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, "github") });
    const res = await callbackReq("github", { code, state: crafted.state }, `${OAUTH_COOKIE}=${encodeOAuthCookie(crafted)}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/");
  });

  it("a replayed callback fails and creates no second session", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("lan"), "github", id);
    const started = await startOAuth("github");
    const code = issueCodeFor("github", started, id);
    expect((await callbackReq("github", { code, state: started.flow.state }, started.cookie)).status).toBe(303);
    expect(await sessionsOf(user.id)).toBe(1);
    // The browser dropped the cookie (the response deleted it): no cookie, no state, 400.
    expect((await callbackReq("github", { code, state: started.flow.state })).status).toBe(400);
    // A replay WITH the old cookie is stopped only by the provider's single-use code (the fake burns it, S2), not by us.
    expect((await callbackReq("github", { code, state: started.flow.state }, started.cookie)).status).toBe(400);
    expect(await sessionsOf(user.id)).toBe(1);
  });

  it("a suspended user is refused like a magic link: 403, no session, hardened", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("lan"), "github", id);
    await setUserStatusStatement(testEnv.DB, { id: user.id, from: "active", to: "suspended", now: new Date().toISOString() }).run();
    const started = await startOAuth("github");
    const res = await callbackReq("github", { code: issueCodeFor("github", started, id), state: started.flow.state }, started.cookie);
    expect(res.status).toBe(403);
    expectHardened(res);
    expect(setCookieValue(res, "__Host-vnx_session")).toBeNull();
    expect(await sessionsOf(user.id)).toBe(0);
    expect(clearedOAuthCookie(res)).not.toBeNull();
  });

  // F3
  it("a user with a pending Ops invite who signs in by OAuth gets no ops_members row; the invite stays pending", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { user } = await linkedUser(emailOf("ops-candidate"), "github", id);
    const owner = await ensureUser(emailOf("owner"));
    await createOpsInviteStatement(testEnv.DB, { email: user.email, role: "operator", createdBy: owner.id, now: new Date().toISOString() }).statement.run();
    const started = await startOAuth("github");
    const res = await callbackReq("github", { code: issueCodeFor("github", started, id), state: started.flow.state }, started.cookie);
    expect(res.status).toBe(303);
    expect(await countWhere("SELECT count(*) AS n FROM ops_members WHERE user_id = ?1", user.id)).toBe(0);
    expect((await findPendingOpsInvite(testEnv.DB, user.email))?.status).toBe("pending");
  });

  it("refuses a flow cookie whose intent is link until Task 8, without calling the provider, logging link_unsupported", async () => {
    await enableProvider("github");
    const id = identityOf();
    const { cookie: session } = await signIn(emailOf("lan"));
    const raw = session.split("=")[1] ?? "";
    const link = newFlowCookie({ provider: "github", intent: "link", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: await linkSessionHash(raw) }, Date.now());
    const code = issueFakeCode("github", id, { verifier: link.verifier, nonce: link.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, "github") });
    forgetLogs();
    const res = await callbackReq("github", { code, state: link.state }, `${session}; ${OAUTH_COOKIE}=${encodeOAuthCookie(link)}`);
    expect(res.status).toBe(400);
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(await identitiesWithSubject(id.subject)).toBe(0);
    expectOneLog("link_unsupported", [link.state, link.verifier, link.nonce, id.subject]);
  });
});

describe("callback: not linked (ADR-012 §3.2; Review Focus 2)", () => {
  async function notLinked(provider: OAuthProvider, identity: { subject: string; label: string }, lang = "en") {
    const started = await startOAuth(provider, `?lang=${lang}`);
    const res = await callbackReq(provider, { code: issueCodeFor(provider, started, identity), state: started.flow.state }, started.cookie);
    return { res, html: await res.text() };
  }

  it("creates no user, session or identity, and is byte-identical whether or not the provider e-mail matches an account", async () => {
    await enableProvider("google");
    const known = emailOf("known");
    await ensureUser(known);
    const strangerId = { subject: `g-${tag()}`, label: `stranger-${tag()}@example.org` };
    // The provider e-mail equals an existing account's address: still "not linked", still the same bytes (decision 12).
    const lookalikeId = { subject: `g-${tag()}`, label: known };
    const [users, sessions] = [await countWhere("SELECT count(*) AS n FROM users"), await allSessions()];
    const stranger = await notLinked("google", strangerId);
    const lookalike = await notLinked("google", lookalikeId);
    for (const r of [stranger, lookalike]) {
      expect(r.res.status).toBe(200);
      expectHardened(r.res);
      expect(r.res.headers.get("location")).toBeNull();
      expect(setCookieValue(r.res, "__Host-vnx_session")).toBeNull();
      expect(clearedOAuthCookie(r.res)).not.toBeNull();
      expect(r.html).toContain("Sign in with an email link");
    }
    expect(normalize(stranger.html)).toBe(normalize(lookalike.html));
    expect(stranger.html).not.toContain(known);
    expect(stranger.html).not.toContain(strangerId.label);
    expect(await countWhere("SELECT count(*) AS n FROM users")).toBe(users);
    expect(await allSessions()).toBe(sessions);
    expect(await identitiesWithSubject(strangerId.subject, lookalikeId.subject)).toBe(0);
  });

  it("is in the visitor's language from the flow cookie, with the approved Vietnamese sentence", async () => {
    await enableProvider("google");
    const { html } = await notLinked("google", identityOf(), "vi");
    expect(html).toContain("Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết từ trang tài khoản.");
  });

  it("loads nothing inline (CSP)", async () => {
    await enableProvider("google");
    const { html } = await notLinked("google", identityOf());
    expect(html).not.toMatch(/\sstyle=|<script/i);
  });
});

describe("callback: every failure is the same generic page (Review Focus 1)", () => {
  type Id = { subject: string; label: string };
  type Case = [name: string, code: string, run: (s: StartedFlow, id: Id) => Promise<Response>];
  const cases: Case[] = [
    ["no cookie", "no_cookie", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id), state: s.flow.state })],
    ["state missing", "state_mismatch", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id) }, s.cookie)],
    ["state wrong", "state_mismatch", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id), state: "x".repeat(43) }, s.cookie)],
    ["code missing", "missing_code", async (s) => callbackReq("github", { state: s.flow.state }, s.cookie)],
    ["code over-length", "missing_code", async (s) => callbackReq("github", { code: "a".repeat(2049), state: s.flow.state }, s.cookie)],
    ["user denied at the provider", "provider_denied", async (s) => callbackReq("github", { error: "access_denied", error_description: "secret-desc", state: s.flow.state }, s.cookie)],
    ["code never issued", "token_request", async (s) => callbackReq("github", { code: "unknown-code", state: s.flow.state }, s.cookie)],
    ["wrong verifier", "token_request", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id, { verifier: "w".repeat(43) }), state: s.flow.state }, s.cookie)],
    ["wrong redirect URI", "token_request", async (s, id) => callbackReq("github", { code: issueCodeFor("github", s, id, { redirectUri: "https://evil.example/cb" }), state: s.flow.state }, s.cookie)],
    ["cookie of another provider (F5)", "no_cookie", async (s, id) => {
      await enableProvider("google");
      const other = await startOAuth("google");
      // The state and the cookie belong to Google; the URL says GitHub.
      return callbackReq("github", { code: issueCodeFor("github", s, id), state: other.flow.state }, other.cookie);
    }],
    ["expired cookie", "no_cookie", async (s, id) => {
      const expired = { ...s.flow, exp: Date.now() - 1000 };
      return callbackReq("github", { code: issueCodeFor("github", s, id), state: s.flow.state }, `${OAUTH_COOKIE}=${encodeOAuthCookie(expired)}`);
    }],
    ["link-intent cookie at the callback", "wrong_phase", async (_s, id) => {
      const { cookie: session } = await signIn(emailOf("lan"));
      return callbackReq("github", { code: "whatever", state: "x".repeat(43) }, `${OAUTH_COOKIE}=${(await linkIntentCookie(session, "github")).split("=")[1]}`);
    }],
  ];

  it.each(cases)("%s: 400, no session, no redirect, cookie cleared, one fixed log code, same page", async (_name, expectedCode, run) => {
    await enableProvider("github");
    const id = identityOf();
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", id);
    const started = await startOAuth("github");
    forgetLogs();
    const res = await run(started, id);
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expectHardened(res);
    expect(setCookieValue(res, "__Host-vnx_session")).toBeNull();
    expect(clearedOAuthCookie(res)).not.toBeNull();
    const html = await res.text();
    expect(html).toContain("We couldn&#39;t sign you in");
    expect(html).not.toContain(started.flow.state);
    expect(await sessionsOf(user.id)).toBe(0);
    expectOneLog(expectedCode, [started.flow.state, started.flow.verifier, started.flow.nonce, id.subject, id.label, email, "secret-desc"]);
  });

  it("rejects a Google-written cookie at the GitHub callback even when its state matches (F5)", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const google = await startOAuth("google");
    forgetLogs();
    const res = await callbackReq("github", { code: "whatever", state: google.flow.state }, google.cookie);
    expect(res.status).toBe(400);
    expectOneLog("no_cookie", [google.flow.state]);
  });
});

describe("callback: rate limit (Decision 10)", () => {
  it("allows 20 callbacks per hour per IP under oauth:ip:<ip>, then answers 429 with one fixed log code", async () => {
    await enableProvider("github");
    const ip = `203.0.113.${100 + (counter % 100)}`;
    const headers = { "cf-connecting-ip": ip };
    for (let i = 0; i < 20; i++) expect((await callbackReq("github", { state: "x" }, undefined, headers)).status, `call ${i + 1}`).toBe(400);
    forgetLogs();
    const blocked = await callbackReq("github", { state: "x" }, undefined, headers);
    expect(blocked.status).toBe(429);
    expectHardened(blocked);
    expect(clearedOAuthCookie(blocked)).not.toBeNull();
    expectOneLog("rate_limited", []);
    expect((await callbackReq("github", { state: "x" }, undefined, { "cf-connecting-ip": "203.0.114.1" })).status).toBe(400);
    const row = await testEnv.DB.prepare("SELECT count FROM rate_limits WHERE key = ?1").bind(`oauth:ip:${ip}`).first<{ count: number }>();
    expect(row?.count).toBe(21);
  });
});

describe("callback: an unexpected error (F5)", () => {
  it("becomes the code `internal`: the error text is never logged", async () => {
    await enableProvider("github");
    await startOAuth("github"); // warms the flag cache, so only the rate-limit query reaches the broken database
    forgetLogs();
    const broken = {
      ...testEnv,
      DB: new Proxy(testEnv.DB, {
        get: (target, prop) =>
          prop === "prepare"
            ? () => {
                throw new Error("secret-db-failure-42");
              }
            : Reflect.get(target, prop),
      }),
    } as Bindings;
    const res = await callbackReq("github", { state: "x" }, undefined, {}, broken);
    expect(res.status).toBe(400);
    expectOneLog("internal", ["secret-db-failure-42"]);
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/oauth-routes.test.ts test/architecture.test.ts` → FAIL (route chưa có: mọi request 404; `oauth.tsx` không tồn tại).

- [ ] **Step 5: View (`apps/web/src/views/auth.tsx`, thêm cuối file)**

```tsx
/** ADR-012 §3.2: the same bytes for every unlinked provider account. Takes no e-mail, label, id or request reference, so it cannot differ. */
export const OAuthNotLinkedPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("oauth.notLinked.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("oauth.notLinked.title")}</h1>
        <p>{tr("oauth.notLinked.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("oauth.cta.emailLink")}
        </a>
      </section>
    </Layout>
  );
};

/** One page for every other failure (bad state, denied, provider error, rate limit): it never says which. */
export const OAuthErrorPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("oauth.error.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("oauth.error.title")}</h1>
        <p>{tr("oauth.error.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("oauth.cta.emailLink")}
        </a>
      </section>
    </Layout>
  );
};
```

- [ ] **Step 6: Route (`apps/web/src/routes/oauth.tsx`)**

```tsx
import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { readSessionCookie, writeSessionCookie } from "../auth/cookies.ts";
import { getOAuthProvider } from "../auth/oauth/index.ts";
import type { ExchangeFailure, ProviderClient } from "../auth/oauth/provider.ts";
import { clearOAuthCookie, linkSessionHash, readOAuthCookie, writeOAuthCookie } from "../auth/oauth-cookie.ts";
import { createSession } from "../auth/sessions.ts";
import { writeAudit } from "../db/audit.ts";
import { isFlagEnabled } from "../db/flags.ts";
import { findIdentityByProviderSubject, touchIdentityLogin } from "../db/identities.ts";
import { findUserById, markLogin } from "../db/users.ts";
import { isOAuthProvider, type OAuthProvider, PROVIDER_FLAG, sessionMethodFor } from "../domain/identity.ts";
import { buildAuthorizeUrl, checkCallbackState, codeChallengeS256, generateNonce, generateState, generateVerifier, newFlowCookie, oauthRedirectUri, resolveStartIntent } from "../domain/oauth.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, type Locale, localeFromPath, localizedPath } from "../i18n/locales.ts";
import { safeNext } from "../http/next.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { OAuthErrorPage, OAuthNotLinkedPage } from "../views/auth.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;
const MAX_CODE_CHARS = 2048;

/** The only things the callback ever logs (Review Focus 9): fixed codes, never a message, a URL or a provider reply. */
type OAuthFailure = "no_cookie" | "wrong_phase" | "state_mismatch" | "provider_denied" | "missing_code" | "link_unsupported" | "rate_limited" | "internal" | ExchangeFailure;

/**
 * The URL of start and callback carries `state` and (callback) the one-time `code`, and the callback decides who is signed in.
 * Nothing may be cached or sent in a Referer. `same-origin`, not `no-referrer` (VNX-0803 review F1).
 */
function harden(c: Context<AppEnv>) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "same-origin");
}

/** The provider, when it exists, its flag is on and its credentials are set (decision 6); otherwise null and the caller answers 404. */
async function enabledProvider(c: Context<AppEnv>): Promise<{ provider: OAuthProvider; client: ProviderClient } | null> {
  const name = c.req.param("provider");
  if (!isOAuthProvider(name) || !(await isFlagEnabled(c.env.DB, PROVIDER_FLAG[name]))) return null;
  const client = getOAuthProvider(c.env, name);
  return client ? { provider: name, client } : null;
}

function failed(c: Context<AppEnv>, provider: OAuthProvider, code: OAuthFailure, locale: Locale = "en", status: 400 | 429 = 400, event: "oauth.callback_failed" | "oauth.start_failed" = "oauth.callback_failed") {
  console.error(JSON.stringify({ requestId: c.get("requestId"), event, provider, code }));
  return page(c, <OAuthErrorPage locale={locale} origin={new URL(c.req.url).origin} />, status);
}

export function registerOAuthRoutes(app: Hono<AppEnv>) {
  app.get("/auth/oauth/:provider/start", async (c) => {
    harden(c);
    const found = await enabledProvider(c);
    if (!found) return errorResponse(c, "notFound", 404);
    const { provider, client } = found;
    const now = Date.now();
    // Task 2 LOW-2: a link intent counts only for a session that is alive now (`user` is null for an expired or suspended one).
    const raw = readSessionCookie(c);
    const sessionHash = c.get("user") && raw ? await linkSessionHash(raw) : null;
    if (resolveStartIntent(readOAuthCookie(c, provider, now), sessionHash, now) === "link") {
      // Task 8 replaces this branch with the intermediate page (decision 14).
      clearOAuthCookie(c);
      return failed(c, provider, "link_unsupported", "en", 400, "oauth.start_failed");
    }
    const next = safeNext(c.req.query("next"));
    const lang = c.req.query("lang");
    const locale = isLocale(lang) ? lang : localeFromPath(next ?? "/").locale;
    const state = generateState();
    const verifier = generateVerifier();
    const nonce = generateNonce();
    writeOAuthCookie(c, newFlowCookie({ provider, intent: "signin", state, verifier, nonce, next, locale, sessionHash: null }, now), now);
    const url = buildAuthorizeUrl({ provider, clientId: client.clientId, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), state, challenge: await codeChallengeS256(verifier), nonce });
    return c.redirect(url, 302);
  });

  app.get("/auth/oauth/:provider/callback", async (c) => {
    harden(c);
    // Used once, on every path (Review Focus 1): the request still carries the cookie; only the response deletes it.
    clearOAuthCookie(c);
    const found = await enabledProvider(c);
    if (!found) return errorResponse(c, "notFound", 404);
    const { provider, client } = found;
    const nowMs = Date.now();
    try {
      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      if (!(await hitRateLimit(c.env.DB, `oauth:ip:${ip}`, 20, HOUR, nowMs)).allowed) return await failed(c, provider, "rate_limited", "en", 429);

      // `readOAuthCookie` returns null for a cookie written for another provider (F5).
      const check = checkCallbackState(readOAuthCookie(c, provider, nowMs), c.req.query("state"));
      if (!check.ok) return await failed(c, provider, check.reason);
      const { flow } = check;
      // Task 8 adds the link branch; until then nothing but a sign-in is accepted.
      if (flow.intent !== "signin") return await failed(c, provider, "link_unsupported", flow.locale);

      const code = c.req.query("code");
      if (c.req.query("error") !== undefined) return await failed(c, provider, "provider_denied", flow.locale);
      if (!code || code.length > MAX_CODE_CHARS) return await failed(c, provider, "missing_code", flow.locale);

      // One redirect URI, from APP_ORIGIN, for authorize (start) and for exchange: never from this request's URL.
      const result = await client.exchange({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), now: nowMs });
      if (!result.ok) return await failed(c, provider, result.reason, flow.locale);

      // Not linked: no account, no session, no look at any e-mail (ADR-012 §3.2, decision 12). The same page for every case.
      const identity = await findIdentityByProviderSubject(c.env.DB, provider, result.identity.subject);
      if (!identity) return await page(c, <OAuthNotLinkedPage locale={flow.locale} origin={new URL(c.req.url).origin} />);
      const user = await findUserById(c.env.DB, identity.userId);
      if (!user || user.status !== "active") return await errorResponse(c, "forbidden", 403);

      const now = new Date(nowMs);
      const iso = now.toISOString();
      const method = sessionMethodFor(provider);
      await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(user.email) });
      await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { method }, now: iso });
      await touchIdentityLogin(c.env.DB, { id: identity.id, label: result.identity.label, now: iso });
      writeSessionCookie(c, await createSession(c.env.DB, user.id, now, method));
      return c.redirect(safeNext(flow.next) ?? localizedPath(flow.locale, "/"), 303);
    } catch {
      // No `err` is bound on purpose: nothing about it can reach a log (F5).
      return await failed(c, provider, "internal");
    }
  });
}
```

`app.ts`: `import { registerOAuthRoutes } from "./routes/oauth.tsx";` và `registerOAuthRoutes(app);` ngay trước `registerAuthRoutes(app);`.

Lưu ý khi chép: các `return await` trong `try` là bắt buộc (nếu không, lỗi render hoặc DB thoát khỏi `catch`); `errorResponse` dùng khóa `error.forbidden.*`, `error.notFound.*` có sẵn.

- [ ] **Step 7: Xanh từng file**

Chạy: `npm test -w apps/web -- test/auth/oauth-routes.test.ts` → PASS; `npm test -w apps/web -- test/architecture.test.ts test/i18n/parity.test.ts` → PASS. Nếu `reachableFrom` chạm `db/ops-members.ts` qua một chuỗi import giá trị hợp lệ, **dừng và báo Planner** (không nới test, không sửa `auth/*` ngoài phạm vi).

- [ ] **Step 8: Tiêu chí chấp nhận (mỗi cái một lệnh; mọi lệnh `-t` chạy trong `apps/web/test/auth/oauth-routes.test.ts`)**

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | `start` 302 sang provider; state, S256, redirect URI đúng cho cả ba provider (GitHub gồm `code_challenge` và `S256`); cookie HttpOnly Secure Lax; `no-store` + `same-origin` | `npm test -w apps/web -- test/auth/oauth-routes.test.ts -t "302 to the provider"` |
| 2 | Cờ tắt, thiếu credential, provider lạ: 404 ở start và callback; callback 404 vẫn xóa cookie | `-t "answers 404"` và `-t "404 callback too"` |
| 3 | LOW-2: cookie intent + session hết hạn → `signin`; intent `link` còn sống bị từ chối rõ ràng ở start (và ở callback) | `-t "link"` |
| 4 | Đăng nhập thành công: session `oauth_<provider>`, `markLogin`, audit `auth.login` `{ method }`, `touchIdentityLogin`, `303 next` qua `safeNext`, cookie OAuth xóa | `-t "callback: sign in"` |
| 5 | Chưa liên kết: 200, không user/session/identity mới, giống hệt từng byte dù email provider trùng `users.email`; câu VI đúng ADR; không inline | `-t "not linked"` |
| 6 | `suspended` → 403 như magic link, không session | `-t "suspended"` |
| 7 | F3: lời mời Ops `pending` vẫn `pending`, không hàng `ops_members`; `routes/oauth.tsx` không với tới `db/ops-members.ts` và `auth/ops.ts` | `-t "pending Ops invite"` và `npm test -w apps/web -- test/architecture.test.ts -t "OAuth callback never touches Ops invites"` |
| 8 | F5: cookie của provider khác bị từ chối; mười đường lỗi cùng một trang 400, cookie xóa, không session | `-t "same generic page"` và `-t "Google-written cookie"` |
| 9 | Mỗi request lỗi (mười hai trường hợp bảng chung, `rate_limited`, `missing_code` kể cả code quá dài, `link_unsupported` ở start và callback, `wrong_phase`, `internal`) ghi đúng một dòng log có đúng bốn khóa `{code,event,provider,requestId}`, đúng mã, không chứa bí mật | `-t "same generic page"`, `-t "rate limit"`, `-t "link_unsupported"`, `-t "unexpected error"` |
| 10 | Decision 10: 20/giờ rồi 429, khóa `oauth:ip:<ip>` | `-t "rate limit"` |
| 11 | i18n 4 locale đủ, parity xanh | `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 12 | Typecheck và toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

- [ ] **Step 9: Typecheck, toàn bộ test, commit**

Chạy `npm run typecheck -w apps/web` (0 lỗi) và `npm test` (xanh), rồi:

```bash
git add apps/web/src/routes/oauth.tsx apps/web/src/app.ts apps/web/src/views/auth.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/oauth-flow.ts apps/web/test/auth/oauth-routes.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): OAuth start and callback for sign-in, not-linked page (VNX-2604b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã nguồn ~170 dòng (`routes/oauth.tsx` ~105, views ~30, `app.ts` 2, nhánh kiến trúc ~35 tính vào test), test ~480 dòng (`oauth-routes.test.ts` ~360, `oauth-flow.ts` ~55, architecture ~40), locale 5 khóa × 4 file. Tổng ~650 dòng không tính locale, trong đó mã chạy ~170: **không tách**, vì route, helper và test dùng chung một luồng và tách ra buộc 2604b-1 đưa vào helper chưa có người dùng. Nếu Implementer thấy diff vượt ~700 dòng, tách thành 2604b-1 (Steps 1-3, `start`, cờ, test start và kiến trúc) và 2604b-2 (callback, hai trang, các test còn lại) và báo lại.

**Nghĩa vụ cho task sau:**
- **Task 7:** nút ở `/login` là `<a href="/auth/oauth/:provider/start?lang=<locale>&next=<safeNext>">` (quyết định kỹ thuật 7); `lang` phải là id `Locale` đúng hoa thường (`zh-Hans`, `zh-Hant`), không phải tiền tố URL (`zh-hans`).
- **Task 8:** thay hai nhánh `link_unsupported` (start: trang trung gian 200; callback: nhánh `link` với `flowMatchesSession` và `linkIdentity`); thêm `routes/me.tsx` vào `IDENTITY_ALLOWED`; dùng lại `test/oauth-flow.ts`. Nhánh `link` cũng phải đi qua `harden`, xóa cookie và log mã cố định.
- **VNX-2608 (bật cờ):** 20 callback mỗi giờ mỗi IP bị chia chung sau NAT của nhà mạng (phổ biến với mạng di động ở Việt Nam). Theo dõi tỷ lệ 429 của callback sau khi bật; nếu cần, nâng ngưỡng bằng quyết định của Owner (không tự đổi).
- **Task 12 (VNX-2607):** đối chiếu cookie `__Host-vnx_oauth` 10 phút và audit `auth.login` chỉ `{ method }` với addendum Privacy.

#### Kết quả review Task 6 (Opus, 2026-10-07): APPROVE_WITH_CHANGES, đã sửa H1, M1, M2, L1–L6, S1, S4; câu chữ Owner duyệt 2026-10-08

### Task 7: VNX-2604c — Nút đăng nhập Google, GitHub, LinkedIn ở `/login`

**Phạm vi:** `LoginPage` hiện nút của provider có cờ bật **và** có credential, dưới form email. Nút là `<a>` tới `GET /auth/oauth/:provider/start?lang=<Locale>&next=<safeNext>` (Task 6). Không route mới, không migration, không logo bên thứ ba (xem "Quyết định kỹ thuật" 1). Trang `/login` khi cả ba cờ tắt giữ nguyên từng byte.

**Files:**
- Modify: `apps/web/src/views/auth.tsx` (hàm `oauthStartPath`, prop `providers` của `LoginPage`, khối nút)
- Modify: `apps/web/src/routes/auth.tsx` (hàm `loginProviders(c)`; truyền `providers` ở 4 chỗ render `LoginPage`: GET `/login` và 3 nhánh lỗi của POST `/login`)
- Modify: `apps/web/public/assets/app.css` (3 dòng `.oauth*`, sau `.field [aria-invalid="true"]`, trong khối "Forms, cards, notices")
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (2 khóa, ngay sau `oauth.cta.emailLink`)
- Create (test): `apps/web/test/auth/login-oauth-buttons.test.ts`

**Interfaces:**
- Consumes (tên thật trong code):
  - `domain/identity.ts`: `OAUTH_PROVIDERS` (thứ tự `google`, `github`, `linkedin`), `PROVIDER_FLAG`, `PROVIDER_NAME`, `type OAuthProvider`.
  - `db/flags.ts`: `isFlagEnabled(db, key)` (cache 60 s, fail closed), `resetFlagCache`; `auth/oauth/index.ts`: `isProviderConfigured(env, provider)` (cùng quy tắc "đã cấu hình" mà `getOAuthProvider` và `enabledProvider` của `routes/oauth.tsx` dùng, quyết định 6).
  - `http/next.ts`: `safeNext`; `i18n/locales.ts`: `type Locale`; `i18n/t.ts`: `translator` (tham số `{provider}`).
  - Test: `test/oauth-flow.ts` (`enableProvider`, `startOAuth`), `test/helpers.ts` (`getReq`, `formPost`, `testEnv`).
- Produces:
  - `views/auth.tsx`: `oauthStartPath(provider: OAuthProvider, locale: Locale, next: string | null): string`; `LoginPage` nhận thêm `providers?: readonly OAuthProvider[]` (mặc định không có nút).
  - `routes/auth.tsx` (không export): `loginProviders(c: Context<AppEnv>): Promise<OAuthProvider[]>`.
  - CSS: `.oauth`, `.oauth-or` (không class nào khác).
  - Khóa i18n: `oauth.or`, `oauth.signInWith`.

**Quyết định kỹ thuật (Planner; Reviewer kiểm):**
1. **Logo: nút chỉ có chữ ở task này; logo là một việc nhỏ riêng sau khi Owner giao file (khuyến nghị).** Quyết định 13 cấm Implementer tự vẽ logo; file chính thức chỉ có sau VNX-2601 (Owner). Hai phương án: (A) chữ trước, logo thêm sau; (B) `<img>` trỏ file Owner sẽ thả vào, kèm test file tồn tại. (B) làm task đỏ cho tới khi Owner giao và buộc một sự kiện vận hành vào đường code; còn `<img>` trỏ file thiếu mà không có test thì ra ảnh vỡ trên production. Chọn (A): nút `<a class="btn btn-ghost">` có chữ "Sign in with {provider}" đã đủ dùng, có tên truy cập được; không thêm file nào dưới `public/assets/brand/oauth/` (thư mục chưa tồn tại, task này không tạo). **Lệch so với bảng thứ tự dòng 7 ("logo tự host"): phạm vi chỉ-chữ này do Reviewer duyệt 2026-10-08; VNX-2604d là điều kiện tiên quyết của VNX-2608 (Owner 2026-10-08, xem "Nghĩa vụ").** Việc theo sau (VNX-2604d, ước lượng ≈ 40 dòng là **tạm thời**, ước lượng lại khi có file chính thức và yêu cầu guideline của Google về màu và padding): Owner bỏ 3 SVG vào `public/assets/brand/oauth/{google,github,linkedin}.svg`; thêm `<img class="oauth-logo" src="/assets/brand/oauth/<provider>.svg" alt="" width="20" height="20">` vào nút (logo trang trí, `alt=""` vì chữ đã nêu tên), một dòng CSS `.oauth-logo`, và test file tồn tại; CSP `img-src 'self'` đã đủ. Task này không để sẵn móc nào cho logo (không `PROVIDER_LOGO`, không class `oauth-logo`) để tránh code chết.
2. **Nhãn nút: một khóa `oauth.signInWith` "Sign in with {provider}", không "Continue with".** Lý do: nút chỉ đăng nhập vào tài khoản đã liên kết, không bao giờ tạo tài khoản (ADR-012 §3); "Continue with" gợi ý đăng ký. Khớp thuật ngữ Owner đã duyệt ở Task 6 (vi "Đăng nhập bằng …", zh-Hans 登录, zh-Hant 登入). Tên provider lấy từ `PROVIDER_NAME` (không dịch) qua tham số `{provider}`: một khóa thay vì ba. Dải phân cách "hoặc" là khóa `oauth.or`.
3. **Nút là `<a>`, không bao giờ `<form>`** (Review Focus 12, Rủi ro đã biết): `form-action 'self'` chặn cả form GET qua chuỗi redirect. Test khẳng định `/login` có đúng một `<form>` và nó không trỏ `/auth/oauth/`.
4. **Cờ và cấu hình đọc ở route, không ở view.** `loginProviders(c)` giữ thứ tự `OAUTH_PROVIDERS`, lọc `isFlagEnabled(db, PROVIDER_FLAG[p]) && isProviderConfigured(c.env, p)`. View thuần: nhận danh sách, không biết gì về cờ. D1 lỗi → cờ tắt → không nút (fail closed), `/login` vẫn dùng được bằng email.
5. **Cả ba nhánh lỗi của `POST /login` (400, 429, 502) cũng truyền `providers`**, vì người nhập sai email phải còn thấy nút; nếu không trang đổi hình giữa GET và POST lỗi. `LoginSentPage` (200 sau khi gửi email) không có nút.
6. **`next`:** lấy từ prop `next` của `LoginPage` (route đã `safeNext(c.req.query("next"))` hoặc `safeNext(form.next)`); `oauthStartPath` chạy `safeNext` lần nữa (nhiều lớp), rồi `URLSearchParams` mã hóa. `next` rỗng hoặc không hợp lệ: bỏ hẳn tham số. `lang` luôn có và là **id `Locale`** (`en`, `vi`, `zh-Hans`, `zh-Hant`), không phải tiền tố URL (`zh-hans`): `isLocale` ở `start` phân biệt hoa thường (nghĩa vụ Task 6). Thứ tự tham số cố định: `lang` rồi `next`. Hono escape `&` thành `&amp;` trong thuộc tính; trình duyệt giải lại, nên test cũng phải giải trước khi `new URL`.
7. **Khối nút là một `<div class="oauth">` không lồng `<div>`** (dải "hoặc" là `<p class="oauth-or">`, các nút là `<a>` con trực tiếp), để test cắt khối bằng một regex và so phần còn lại với trang khi cờ tắt. Khối chỉ render khi có ít nhất một provider; ngược lại là `null`, không để lại khoảng trắng, nên trang cờ tắt giống hệt trang hiện tại từng byte. `Layout` không chứa request id nên không cần chuẩn hóa gì khi so.
8. **CSS dùng lại `.btn btn-ghost`** (đã có `min-height: 44px` của VNX-0706, viền rõ trên nền thẻ, hover) và vòng focus chung `:focus-visible { outline: 3px solid var(--primary) }` (`app.css:105`): không thêm quy tắc focus, kích thước hay màu cho nút. Chỉ thêm `.oauth` (cột, khoảng cách) và `.oauth-or` (đường kẻ hai bên bằng `::before/::after`). Không `style=`.
9. **Test dùng `OAUTH_DRIVER: "fake"` của `testEnv`** (mọi provider "đã cấu hình" khi dùng provider giả), nên cờ là thứ đổi kết quả; ca "cờ bật mà thiếu credential" dùng `{ ...testEnv, OAUTH_DRIVER: undefined }` như Task 6. Mỗi test xóa cờ `oauth_%` và gọi `resetFlagCache()`.

**Câu chữ giao diện (Owner duyệt nguyên văn 2026-10-08):**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `oauth.or` | or | hoặc | 或 | 或 |
| `oauth.signInWith` | Sign in with {provider} | Đăng nhập bằng {provider} | 使用 {provider} 账号登录 | 使用 {provider} 帳號登入 |

Tên provider (Google, GitHub, LinkedIn) không dịch. `{provider}` là chỗ thay thế của `t()`; có dấu cách giữa chữ Hán và tên Latin.

- [ ] **Step 1: Test hỏng trước (`apps/web/test/auth/login-oauth-buttons.test.ts`)**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { OAUTH_PROVIDERS, PROVIDER_NAME, type OAuthProvider } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { enableProvider, startOAuth } from "../oauth-flow.ts";

const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;
const BLOCK = /<div class="oauth">.*?<\/div>/s;
const LINK = /<a [^>]*href="(\/auth\/oauth\/[^"]+)"[^>]*>([^<]*)<\/a>/g;

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
});

async function loginHtml(path = "/login", env: Bindings = testEnv): Promise<{ res: Response; html: string }> {
  const res = await createApp().request(getReq(path), undefined, env);
  return { res, html: await res.text() };
}

/** Every link to /auth/oauth/ on the page: its URL (entities decoded, as a browser does) and its text. */
function oauthLinks(html: string) {
  return [...html.matchAll(LINK)].map((m) => ({ href: (m[1] ?? "").replaceAll("&amp;", "&"), text: m[2] ?? "" }));
}

async function enableAll() {
  for (const p of OAUTH_PROVIDERS) await enableProvider(p);
  resetFlagCache();
}

describe("/login provider buttons (VNX-2604c)", () => {
  it("shows no button, and the same bytes, while the three flags are off", async () => {
    for (const path of ["/login", "/vi/login", "/zh-hans/login", "/zh-hant/login"]) {
      const { res, html } = await loginHtml(path);
      expect(res.status).toBe(200);
      expect(html, path).not.toContain("/auth/oauth/");
      expect(html, path).not.toContain("oauth");
      // Nothing between the form and the end of the card: the page is the one VNX-0506 shipped.
      expect(html, path).toMatch(/<\/button><\/form><\/section>/);
    }
  });

  it("with every flag on, the page minus the block is the flags-off page", async () => {
    const off = (await loginHtml("/vi/login?next=/hub")).html;
    await enableAll();
    const on = (await loginHtml("/vi/login?next=/hub")).html;
    expect(on).toMatch(BLOCK);
    expect(on.replace(BLOCK, "")).toBe(off);
  });

  it.each(OAUTH_PROVIDERS)("%s: button only when its own flag is on", async (provider: OAuthProvider) => {
    expect(oauthLinks((await loginHtml()).html)).toEqual([]);
    await enableProvider(provider);
    resetFlagCache();
    const links = oauthLinks((await loginHtml()).html);
    expect(links).toHaveLength(1);
    expect(links[0]?.href.startsWith(`/auth/oauth/${provider}/start?`)).toBe(true);
    expect(links[0]?.text).toBe(`Sign in with ${PROVIDER_NAME[provider]}`);
  });

  it.each(OAUTH_PROVIDERS)("%s: flag on but no credentials means no button (decision 6)", async (provider: OAuthProvider) => {
    await enableProvider(provider);
    resetFlagCache();
    expect(oauthLinks((await loginHtml("/login", withoutCredentials)).html)).toEqual([]);
    expect(oauthLinks((await loginHtml("/login", testEnv)).html)).toHaveLength(1);
  });

  it("all on: three plain links in catalogue order, below the e-mail form, and no form posts to /auth/oauth/", async () => {
    await enableAll();
    const { html } = await loginHtml();
    expect(oauthLinks(html).map((l) => l.text)).toEqual(["Sign in with Google", "Sign in with GitHub", "Sign in with LinkedIn"]);
    expect(html.indexOf("</form>")).toBeLessThan(html.indexOf('class="oauth"'));
    const forms = [...html.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
    expect(forms).toHaveLength(1);
    expect(forms[0]).toContain('action="/login"');
    expect(forms.some((f) => f.includes("/auth/oauth/"))).toBe(false);
    expect(html).toContain('<p class="oauth-or">or</p>');
  });

  it("sends the Locale id as lang, and start reads it back, in all four locales", async () => {
    await enableProvider("github");
    resetFlagCache();
    const cases = [["/login", "en"], ["/vi/login", "vi"], ["/zh-hans/login", "zh-Hans"], ["/zh-hant/login", "zh-Hant"]] as const;
    for (const [path, lang] of cases) {
      const link = oauthLinks((await loginHtml(path)).html)[0];
      const url = new URL(link?.href ?? "", "https://vnx.si");
      expect(url.searchParams.get("lang"), path).toBe(lang);
      expect((await startOAuth("github", url.search)).flow.locale, path).toBe(lang);
    }
  });

  it("passes a safe next, URL-encoded, through to the flow; drops an unsafe one", async () => {
    await enableProvider("google");
    resetFlagCache();
    const next = "/hub?a=1&b=2";
    const link = oauthLinks((await loginHtml(`/login?next=${encodeURIComponent(next)}`)).html)[0];
    expect(link?.href).toBe(`/auth/oauth/google/start?lang=en&next=${encodeURIComponent(next)}`);
    expect((await startOAuth("google", new URL(link?.href ?? "", "https://vnx.si").search)).flow.next).toBe(next);

    for (const bad of ["//evil.example", "https://evil.example/x", "/\\evil", "javascript:alert(1)"]) {
      const l = oauthLinks((await loginHtml(`/login?next=${encodeURIComponent(bad)}`)).html)[0];
      expect(l?.href, bad).toBe("/auth/oauth/google/start?lang=en");
    }
  });

  it("keeps the buttons on the error page of a bad e-mail (POST /login, 400)", async () => {
    await enableProvider("linkedin");
    resetFlagCache();
    const res = await createApp().request(formPost("/vi/login", { email: "not-an-email", next: "/hub" }), undefined, testEnv);
    expect(res.status).toBe(400);
    const links = oauthLinks(await res.text());
    expect(links).toHaveLength(1);
    expect(links[0]?.text).toBe("Đăng nhập bằng LinkedIn");
    expect(links[0]?.href).toBe("/auth/oauth/linkedin/start?lang=vi&next=%2Fhub");
  });

  it("keeps the buttons on the rate-limited page (POST /login, 429)", async () => {
    await enableProvider("github");
    resetFlagCache();
    const statuses: number[] = [];
    let last = "";
    for (let i = 0; i < 6; i++) {
      const res = await createApp().request(formPost("/login", { email: "flood-oauth@vnx.si" }), undefined, testEnv);
      statuses.push(res.status);
      last = await res.text();
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(oauthLinks(last)).toHaveLength(1);
  });

  it("is accessible and CSP-clean: button class, provider in the name, no inline style, script, image or svg", async () => {
    await enableAll();
    const { res, html } = await loginHtml();
    const block = BLOCK.exec(html)?.[0] ?? "";
    expect(block).toContain('class="btn btn-ghost"');
    for (const p of OAUTH_PROVIDERS) expect(block).toContain(PROVIDER_NAME[p]);
    expect(block).not.toMatch(/style=|<script|<img|<svg|\son\w+=|<form|<button/i);
    const csp = res.headers.get("content-security-policy") ?? "";
    // A reminder for VNX-2604d: official logos are self-hosted <img>, so img-src must stay 'self'.
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("states the text in all four locales", async () => {
    await enableProvider("github");
    resetFlagCache();
    const expected = { "/login": ["Sign in with GitHub", "or"], "/vi/login": ["Đăng nhập bằng GitHub", "hoặc"], "/zh-hans/login": ["使用 GitHub 账号登录", "或"], "/zh-hant/login": ["使用 GitHub 帳號登入", "或"] } as const;
    for (const [path, [label, or]] of Object.entries(expected)) {
      const { html } = await loginHtml(path);
      expect(oauthLinks(html)[0]?.text, path).toBe(label);
      expect(html, path).toContain(`<p class="oauth-or">${or}</p>`);
    }
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/login-oauth-buttons.test.ts`. Kỳ vọng: đỏ ở mọi ca có nút (không có `<a>` tới `/auth/oauth/`, thiếu `oauth.or`/`oauth.signInWith`). Ca "cờ tắt" có thể đã xanh vì chưa có nút: đó là hàng rào chống hồi quy, đúng.

- [ ] **Step 2: Khóa i18n (4 locale)**

Thêm vào mỗi file, ngay sau `"oauth.cta.emailLink"`, đúng bảng trên (Owner đã duyệt). `en.ts`:

```ts
  "oauth.or": "or",
  "oauth.signInWith": "Sign in with {provider}",
```

`vi.ts`: `"oauth.or": "hoặc"`, `"oauth.signInWith": "Đăng nhập bằng {provider}"`. `zh-hans.ts`: `"oauth.or": "或"`, `"oauth.signInWith": "使用 {provider} 账号登录"`. `zh-hant.ts`: `"oauth.or": "或"`, `"oauth.signInWith": "使用 {provider} 帳號登入"`.

Chạy: `npm test -w apps/web -- test/i18n/parity.test.ts` → PASS.

- [ ] **Step 3: `views/auth.tsx`**

Thêm import và hàm, rồi sửa `LoginPage`:

```tsx
import { type OAuthProvider, PROVIDER_NAME } from "../domain/identity.ts";
import { safeNext } from "../http/next.ts";

/** Where a provider button goes. `lang` is the Locale id (case matters to `start`); `next` is re-checked and URL-encoded (VNX-2604c). */
export function oauthStartPath(provider: OAuthProvider, locale: Locale, next: string | null): string {
  const query = new URLSearchParams({ lang: locale });
  const safe = safeNext(next);
  if (safe) query.set("next", safe);
  return `/auth/oauth/${provider}/start?${query.toString()}`;
}
```

`LoginPage`: kiểu prop thành `FC<Base & { email?: string; next?: string | null; error?: string; providers?: readonly OAuthProvider[] }>`, và ngay sau `</form>` (trước `</section>`):

```tsx
        {props.providers?.length ? (
          <div class="oauth">
            <p class="oauth-or">{tr("oauth.or")}</p>
            {props.providers.map((provider) => (
              <a class="btn btn-ghost" href={oauthStartPath(provider, props.locale, props.next ?? null)}>
                {tr("oauth.signInWith", { provider: PROVIDER_NAME[provider] })}
              </a>
            ))}
          </div>
        ) : null}
```

`<a>` là con trực tiếp của `.oauth`, không bọc `<div>` hay `<ul>` (quyết định 7). Không `rel`/`target`: điều hướng cùng site.

- [ ] **Step 4: `routes/auth.tsx`**

Thêm import (`isFlagEnabled` từ `../db/flags.ts`, `isProviderConfigured` từ `../auth/oauth/index.ts`, `OAUTH_PROVIDERS`, `PROVIDER_FLAG`, `type OAuthProvider` từ `../domain/identity.ts`) và hàm cạnh `origin`:

```ts
/** The providers whose button `/login` shows: flag on AND configured, the rule `routes/oauth.tsx` applies to start and callback (decision 6). */
async function loginProviders(c: Context<AppEnv>): Promise<OAuthProvider[]> {
  const shown: OAuthProvider[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    if ((await isFlagEnabled(c.env.DB, PROVIDER_FLAG[provider])) && isProviderConfigured(c.env, provider)) shown.push(provider);
  }
  return shown;
}
```

Sửa 4 chỗ gọi `LoginPage` thành có `providers`. GET `/login` thành `async (c) => page(c, <LoginPage … providers={await loginProviders(c)} />)`. Ở POST `/login` KHÔNG tính `providers` trước khi kiểm hợp lệ (request thành công không cần đọc cờ). Thêm hàm cục bộ cạnh `tr`:

```tsx
    const retry = async (status: 400 | 429 | 502, email: string, error: string) =>
      page(c, <LoginPage locale={locale} origin={origin(c)} email={email} next={next} error={error} providers={await loginProviders(c)} />, status);
```

và dùng `retry` cho ba nhánh lỗi (400 với `typed`, 429, 502) thay cho ba lời gọi `page(c, <LoginPage …/>, status)` hiện có; `LoginSentPage` không có nút.

- [ ] **Step 5: CSS (`public/assets/app.css`)**

Thêm ngay sau quy tắc `.field` cuối cùng (`.field [aria-invalid="true"] { … }`), vẫn trong khối "Forms, cards, notices":

```css
.oauth { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
.oauth-or { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--muted); font-size: 14px; }
.oauth-or::before, .oauth-or::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--border); }
```

Không thêm quy tắc focus, kích thước hay màu cho nút (quyết định 8).

- [ ] **Step 6: Xanh từng file**

`npm test -w apps/web -- test/auth/login-oauth-buttons.test.ts` → PASS; rồi `npm test -w apps/web -- test/auth test/i18n test/architecture.test.ts` (login-flow, oauth-routes không đổi hành vi) → PASS.

- [ ] **Step 7: Tiêu chí chấp nhận (mỗi cái một lệnh; ký hiệu `T` = `test/auth/login-oauth-buttons.test.ts`)**

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Cờ tắt: không nút, `/login` giống hệt từng byte (4 locale) | `npm test -w apps/web -- T -t "no button, and the same bytes"` và `-t "minus the block"` |
| 2 | Mỗi provider bật/tắt riêng; cờ bật mà thiếu credential thì ẩn | `-t "button only when its own flag"` và `-t "no credentials"` |
| 3 | `<a>` thuần, không `<form>` nào trỏ `/auth/oauth/`, nằm dưới form email, thứ tự cố định | `-t "three plain links"` |
| 4 | `lang` đúng id `Locale` ở 4 locale và `start` đọc lại đúng | `-t "Locale id as lang"` |
| 5 | `next` qua `safeNext`, mã hóa, tới được flow cookie; next xấu bị bỏ | `-t "safe next"` |
| 6 | Trang lỗi của POST `/login` (400 và 429) vẫn có nút | `-t "error page of a bad e-mail"` và `-t "rate-limited page"` |
| 7 | CSP và a11y: không inline/ảnh/svg, tên có provider, lớp `btn btn-ghost` (44 px, focus chung) | `-t "accessible and CSP-clean"` |
| 8 | Câu chữ 4 locale; parity | `-t "all four locales"` và `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 9 | Không đổi hành vi magic link và route OAuth | `npm test -w apps/web -- test/auth/login-flow.test.ts test/auth/oauth-routes.test.ts` |
| 10 | Typecheck và toàn bộ test | `npm run typecheck -w apps/web` và `npm test` |

(Thay `T` bằng đường dẫn đầy đủ khi chạy.)

- [ ] **Step 8: Typecheck, toàn bộ test, commit**

Chạy `npm run typecheck -w apps/web` (0 lỗi) và `npm test` (xanh), rồi:

```bash
git add apps/web/src/views/auth.tsx apps/web/src/routes/auth.tsx apps/web/public/assets/app.css \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/auth/login-oauth-buttons.test.ts
git commit -m "feat(web): provider sign-in buttons on /login behind flags (VNX-2604c)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã nguồn ~45 dòng (`views/auth.tsx` ~22, `routes/auth.tsx` ~20, CSS 3), test ~150 dòng, locale 2 khóa × 4 file. Tổng ~200 dòng không tính locale: **không tách**.

**Nghĩa vụ cho task sau:**
- **VNX-2604d là điều kiện tiên quyết của VNX-2608 (Owner 2026-10-08):** không bật cờ nào trên production khi nút chưa có logo chính thức theo guideline của từng provider (ADR-012 "Hệ quả"). Việc: sau khi Owner giao logo ở VNX-2601, thêm 3 SVG chính thức vào `public/assets/brand/oauth/`, `<img alt="" width height>` trong nút, `.oauth-logo`, test file tồn tại. Implementer không tự vẽ logo.
- **Task 8:** `/me` không dùng lại `oauthStartPath`: liên kết đi qua `POST /me/identities/:provider/link`, không qua nút này.
- **VNX-2608:** thử tay các nút trên Chrome, Firefox, Safari (điều hướng `<a>` tới `start`, rồi 302 sang provider).

#### Kết quả review Task 7 (Opus, 2026-10-08): APPROVE_WITH_CHANGES, đã sửa MEDIUM-1, LOW-1, LOW-2, S1, S2; câu chữ Owner duyệt 2026-10-08

### Task 8 (tách đôi, F9): VNX-2605a-1 và VNX-2605a-2 — Liên kết tài khoản từ `/me`

**Vì sao tách (F9).** Ước tính gộp ≈ 500 dòng cho 2605a-1 cộng ≈ 340 cho 2605a-2, tổng ≈ 840 (mã và test, không tính locale), vượt ngưỡng ~600. Cắt theo đường nối tự nhiên: **2605a-1** = mục ở `/me`, `POST …/link`, trang trung gian ở `start` (mọi thứ trước khi người dùng rời site); **2605a-2** = nhánh `link` của callback, xung đột, thông báo ở `/me` (mọi thứ sau khi provider trả về). Mỗi nửa tự xanh và commit riêng; giữa hai commit luồng chưa chạy hết (callback còn `link_unsupported`), nhưng cả ba cờ tắt nên không ai thấy, và hai commit merge cùng nhau (Owner 2026-10-07: merge khi xong, cờ tắt).

**Quyết định kỹ thuật chung (Planner; Reviewer kiểm):**
1. **Nút hủy liên kết ở Task 9, không ở đây.** `POST …/unlink` thuộc VNX-2605b; một nút không có route là mã chết. 8a-1 hiện hàng đã liên kết kèm `label` và **không có hành động**; Task 9 thêm `<form>` vào ô hành động của đúng hàng đó (cột đã có trong `LinkedAccounts`). Hệ quả có chủ ý: giữa 8a-1 và Task 9, người dùng đã liên kết chưa gỡ được qua UI; chấp nhận vì cờ tắt và các task merge cùng nhánh.
2. **Khi nào hiện mục và nút (Owner 2026-10-08, lệch ADR-012 §4 "cho mọi user").** Mục hiện CHỈ khi có ít nhất một provider khả dụng (cờ bật và đã cấu hình, cùng quy tắc `/login` và `start`, quyết định 6) HOẶC user có ít nhất một identity; ngược lại không có `<section id="identities">`. Hàng chỉ gồm provider đã liên kết hoặc khả dụng. Hàng đã liên kết hiện kể cả khi cờ tắt (để còn hủy liên kết sau một lần tắt khẩn cấp, Task 9). Nút "Liên kết" chỉ ở hàng khả dụng và chưa liên kết. Logic khả dụng nằm một chỗ là `availableProviders(c)` trong `routes/oauth.tsx` (chuyển từ `loginProviders` của `routes/auth.tsx`, Task 7; `auth.tsx` gọi hàm mới, `/login` không đổi hành vi).
3. **`label` chỉ hiện ở `/me` của chính chủ** (Hono escape HTML). `routes/me.tsx` vào allowlist kiến trúc `IDENTITY_ALLOWED` (dòng chú thích của test đã ghi "2605a: routes/me.tsx").
4. **Các hàng theo thứ tự `OAUTH_PROVIDERS` (`google`, `github`, `linkedin`)**, chỉ hàng đã liên kết hoặc khả dụng; hàng khả dụng chưa liên kết hiện "Chưa liên kết" và nút. `LinkedAccounts` trả `null` khi không có hàng nào. Dùng `<table class="data">` như `RequestList`: không CSS mới.
5. **Locale đi qua `?lang=<Locale id>` của `start`** (đã có từ Task 6/7). `POST /me/identities/:provider/link` đăng ký bằng `onLocalized`, form trỏ `localizedPath(locale, …)`, 303 về `/auth/oauth/:provider/start?lang=<locale>`. Cookie intent không mang locale. `lang` chỉ chọn ngôn ngữ, **không bao giờ** chọn intent (Review Focus 5).
6. **Với intent `link`, `next` bị bỏ** (đích luôn là `/me`): flow cookie `link` có `next: null`.
7. **Tải lại trang trung gian hiện lại trang với `state` mới (review MEDIUM-2).** Flow cookie `link` còn hạn, gắn với đúng session đang sống, được `start` coi như intent (điều kiện kiểm tường minh `cookie.phase === "flow" && cookie.intent === "link" && flowMatchesSession(cookie, sessionHash)`; phải kiểm `intent === "link"` vì `flowMatchesSession` đúng với mọi flow `signin`). Nhờ vậy nút Back hay tải lại không biến luồng liên kết thành `signin` 302; mỗi lần hiện lại là một flow mới, flow cũ bị ghi đè. `resolveStartIntent` không đổi. Có test (hiện lại 200 với `state` mới; flow `signin` 302; flow `link` của session khác hoặc session hết hạn 302).
8. **Trang trung gian truyền `signedIn` cho `Layout`** (review MEDIUM-1): người dùng luôn đang đăng nhập ở đây, nên thanh điều hướng đúng. Hệ quả: trang có `<form method="post" action="/logout">` của `Layout`. Test không cấm mọi `<form>` mà khẳng định mọi `<form` đều có `action="/logout"` (không action nào bắt đầu bằng `http`, `//` hay `/auth/oauth/`), cộng "đúng một link ra ngoài site".
9. **Câu `oauth.notLinked.body` của Task 6 đổi, Owner duyệt nguyên văn 2026-10-08** (bảng ở 8a-1): gọi trang bằng tên menu thật (`nav.me`: "Inquiries & requests", "Yêu cầu và nhu cầu", 咨询与需求, 詢問與需求; đã đối chiếu với 4 file locale, khớp) và gọi đúng tên mục.

#### Task 8a-1: VNX-2605a-1 — Mục "Đăng nhập & tài khoản liên kết" ở `/me`, `POST …/link`, trang trung gian ở `start`

**Phạm vi:** (1) `/me` có `<section id="identities">` khi có provider khả dụng hoặc identity đã liên kết (Owner 2026-10-08); (2) `POST /me/identities/:provider/link` (bốn locale) ghi cookie intent rồi 303 về `start` cùng site; (3) `start` với intent `link` hợp lệ cho phiên đang sống **luôn** trả 200 một trang có đúng một `<a>` sang provider (quyết định 14, R3); (4) `availableProviders(c)` dùng chung; (5) đổi câu `oauth.notLinked.body` ở 4 locale (Owner đã duyệt). Không migration, không dependency. `callback` giữ nguyên (`link_unsupported`, bỏ ở 8a-2).

**Files:**
- Create: `apps/web/src/views/me/LinkedAccounts.tsx`
- Modify: `apps/web/src/routes/oauth.tsx` (export `enabledProvider`, thêm `availableProviders`; nhánh `link` của `start`; không động vào `callback`)
- Modify: `apps/web/src/routes/auth.tsx` (bỏ `loginProviders`, gọi `availableProviders`; xóa import không còn dùng)
- Modify: `apps/web/src/routes/me.tsx` (đọc danh tính và provider khả dụng, `<LinkedAccounts>`, `POST …/link`)
- Modify: `apps/web/src/views/auth.tsx` (thêm `OAuthLinkPage`)
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (7 khóa mới + 1 khóa đổi câu)
- Modify (test): `apps/web/test/architecture.test.ts` (`IDENTITY_ALLOWED` thêm `../src/routes/me.tsx`), `apps/web/test/oauth-flow.ts` (helper `linkViaStart`, `externalLinks`), `apps/web/test/auth/oauth-routes.test.ts` (đổi một test `start`, đổi một chuỗi vi)
- Create (test): `apps/web/test/me/identities.test.ts`, `apps/web/test/auth/oauth-link-start.test.ts`

**Interfaces:**
- Consumes (tên thật):
  - `domain/identity.ts`: `OAUTH_PROVIDERS`, `PROVIDER_FLAG`, `PROVIDER_NAME`, `isOAuthProvider`, `type OAuthProvider`, `type UserIdentity`.
  - `db/identities.ts`: `listIdentitiesForUser(db, userId)`; `db/flags.ts`: `isFlagEnabled`, `resetFlagCache`; `auth/oauth/index.ts`: `isProviderConfigured`.
  - `domain/oauth.ts`: `newLinkIntent({ provider, sessionHash }, now)` (hạn 120 s, `LINK_INTENT_TTL_MS`), `resolveStartIntent`, `newFlowCookie` (đã bắt buộc `sessionHash` cho `link`, cấm cho `signin`), `parseOAuthCookie`, `OAUTH_PROVIDER_SPECS`.
  - `auth/oauth-cookie.ts`: `writeOAuthCookie`, `readOAuthCookie`, `linkSessionHash(raw)`; `auth/cookies.ts`: `readSessionCookie`; `auth/middleware.ts`: `requireUser`.
  - `http/localized.ts`: `onLocalized`; `originCheck` và `requestBodyLimit` (64 KB) đã gắn toàn cục ở `app.ts`, không gắn lại.
  - `views/error-response.tsx`: `errorResponse(c, "notFound", 404)`; `views/render.ts`: `page`; `views/Layout.tsx`.
  - Test: `signIn(email, { method })` (`test/fixtures.ts`), `enableProvider`, `linkedUser`, `startOAuth` (`test/oauth-flow.ts`), `formPost`, `getReq`, `setCookieValue`, `testEnv` (`test/helpers.ts`).
- Produces:
  - `routes/oauth.tsx`: `export async function enabledProvider(c)` (đã có, thêm `export`); `export async function availableProviders(c: Context<AppEnv>): Promise<OAuthProvider[]>`.
  - `views/me/LinkedAccounts.tsx`: `LinkedAccounts: FC<{ locale: Locale; identities: readonly UserIdentity[]; linkable: readonly OAuthProvider[] }>`.
  - `views/auth.tsx`: `OAuthLinkPage: FC<{ locale: Locale; origin: string; provider: OAuthProvider; authorizeUrl: string }>`.
  - `test/oauth-flow.ts`: `linkViaStart(provider, sessionCookie, extraQuery?): Promise<LinkedStart>`, `externalLinks(html): URL[]`.
  - Khóa i18n mới (7): `me.identities.title`, `.intro`, `.linked`, `.notLinked`, `.link`, `oauth.link.body`, `oauth.link.cta`. Khóa đổi câu: `oauth.notLinked.body`.

**Câu chữ giao diện: Owner duyệt nguyên văn 2026-10-08** (thuật ngữ: vi "liên kết", "hủy liên kết", "Đăng nhập bằng …"; zh-Hans 关联, 取消关联, 登录, 账号 cho tài khoản của provider, 账户 cho VNX.SI; zh-Hant 連結, 取消連結, 登入, 帳號, 帳戶; tên provider không dịch):

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `me.identities.title` | Sign-in & linked accounts | Đăng nhập & tài khoản liên kết | 登录与关联账号 | 登入與連結帳號 |
| `me.identities.intro` | Link Google, GitHub or LinkedIn to sign in with it. You can always still sign in with an email link. | Liên kết Google, GitHub hoặc LinkedIn để đăng nhập bằng tài khoản đó. Đăng nhập bằng link qua email vẫn luôn dùng được. | 关联 Google、GitHub 或 LinkedIn 账号后，即可用它登录。邮箱登录始终可用。 | 連結 Google、GitHub 或 LinkedIn 帳號後，即可用它登入。電子郵件登入始終可用。 |
| `me.identities.linked` | Linked | Đã liên kết | 已关联 | 已連結 |
| `me.identities.notLinked` | Not linked | Chưa liên kết | 未关联 | 未連結 |
| `me.identities.link` | Link {provider} | Liên kết {provider} | 关联 {provider} 账号 | 連結 {provider} 帳號 |
| `oauth.link.body` | Next, {provider} will ask you to sign in and allow VNX.SI. You'll then come back to VNX.SI, and that {provider} account will be linked to your VNX.SI account. | Tiếp theo, {provider} sẽ yêu cầu bạn đăng nhập và cho phép VNX.SI. Sau đó bạn quay lại VNX.SI, và tài khoản {provider} đó sẽ được liên kết với tài khoản VNX.SI của bạn. | 接下来，{provider} 会请你登录并授权 VNX.SI。之后你将回到 VNX.SI，该 {provider} 账号会关联到你的 VNX.SI 账户。 | 接下來，{provider} 會請你登入並授權 VNX.SI。之後你將回到 VNX.SI，該 {provider} 帳號會連結到你的 VNX.SI 帳戶。 |
| `oauth.link.cta` | Continue to {provider} | Tiếp tục tới {provider} | 继续前往 {provider} | 繼續前往 {provider} |

Trang trung gian dùng `me.identities.link` làm `<h1>` và tiêu đề, `oauth.link.body` làm đoạn giải thích, `oauth.link.cta` làm chữ của link duy nhất. `label` ở hàng đã liên kết hiện sau chữ "Đã liên kết" chỉ khi khác tên provider (Google, LinkedIn không có email thì `label` bằng tên provider, quyết định 12).

**Thay câu Task 6 `oauth.notLinked.body` (Owner duyệt nguyên văn 2026-10-08; nháy kiểu chữ “ ”):**

| | Cũ | Mới |
|---|---|---|
| en | This account isn't linked to VNX.SI yet. Sign in with an email link, then link it from your account page. | This account isn't linked to VNX.SI yet. Sign in with an email link, then link it under “Sign-in & linked accounts” on your Inquiries & requests page. |
| vi | Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết từ trang tài khoản. | Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết ở mục “Đăng nhập & tài khoản liên kết” trong trang Yêu cầu và nhu cầu. |
| zh-Hans | 此账号尚未关联。请先用邮箱登录，再在账户页面关联此账号。 | 此账号尚未关联。请先用邮箱登录，再到“咨询与需求”页面的“登录与关联账号”中关联此账号。 |
| zh-Hant | 此帳號尚未連結。請先用電子郵件登入，再到帳戶頁面連結此帳號。 | 此帳號尚未連結。請先用電子郵件登入，再到「詢問與需求」頁面的「登入與連結帳號」中連結此帳號。 |

- [ ] **Step 1: Helper test (`apps/web/test/oauth-flow.ts`, thêm cuối file; thêm `formPost` vào import từ `./helpers.ts`)**

```ts
export interface LinkedStart {
  /** The `POST /me/identities/:provider/link` response. */
  post: Response;
  /** The `GET /auth/oauth/:provider/start` the browser makes after the 303, carrying the session and the intent cookie. */
  start: Response;
  html: string;
  /** `Cookie` header value for the flow cookie `start` wrote, or "" when it wrote none. */
  flowCookie: string;
  flow: FlowCookie | null;
}

/** Off-site `<a href>` of a page, entities decoded as a browser does. */
export function externalLinks(html: string): URL[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)].map((m) => new URL((m[1] ?? "").replaceAll("&amp;", "&")));
}

/** The whole link start the way a browser does it: press "Link" (POST), follow the 303 to the same-site start. */
/** `postPrefix` picks the locale the way a browser does: the form posts to `/vi/me/…`. Never append a second `lang` to the start URL: Hono reads the FIRST value. */
export async function linkViaStart(provider: OAuthProvider, session: string, opts: { postPrefix?: string; extraQuery?: string } = {}): Promise<LinkedStart> {
  const post = await createApp().request(formPost(`${opts.postPrefix ?? ""}/me/identities/${provider}/link`, {}, { cookie: session }), undefined, testEnv);
  const intent = setCookieValue(post, OAUTH_COOKIE) ?? "";
  const target = new URL(post.headers.get("location") ?? "/", "https://vnx.si");
  const start = await createApp().request(getReq(`${target.pathname}${target.search}${opts.extraQuery ?? ""}`, `${session}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
  const raw = setCookieValue(start, OAUTH_COOKIE) ?? "";
  const flow = parseOAuthCookie(raw, { provider, now: Date.now() });
  return { post, start, html: await start.clone().text(), flowCookie: raw ? `${OAUTH_COOKIE}=${raw}` : "", flow: flow && flow.phase === "flow" ? flow : null };
}
```

- [ ] **Step 2: Test hỏng trước, mục `/me` và `POST …/link` (`apps/web/test/me/identities.test.ts`)**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { OAUTH_PROVIDERS, PROVIDER_NAME } from "../../src/domain/identity.ts";
import { parseOAuthCookie } from "../../src/domain/oauth.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";
import { enableProvider, linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;
/** Hono escapes & ' " < >; a browser shows the characters (pattern of test/landing/page.test.ts). */
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
});

async function meHtml(cookie: string, path = "/me", env: Bindings = testEnv) {
  const res = await createApp().request(getReq(path, cookie), undefined, env);
  return { res, html: decode(await res.text()) };
}
const sectionOf = (html: string) => html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";
const rowsOf = (html: string) => sectionOf(html).match(/<tr>.*?<\/tr>/gs) ?? [];
const postLink = (provider: string, cookie: string, path = `/me/identities/${provider}/link`, headers: Record<string, string> = {}) =>
  createApp().request(formPost(path, {}, { cookie, ...headers }), undefined, testEnv);

describe("/me: Sign-in & linked accounts (VNX-2605a-1; visibility decided by the Owner 2026-10-08)", () => {
  it("is absent while every flag is off and the user has no linked account", async () => {
    for (const method of ["magic_link", "oauth_github"] as const) {
      const { cookie } = await signIn(emailOf("lan"), { method });
      const { res, html } = await meHtml(cookie);
      expect(res.status).toBe(200);
      expect(html).not.toContain('id="identities"');
      expect(html).not.toContain("Sign-in & linked accounts");
      expect(html).not.toContain("/identities/");
    }
  });

  it("one flag on: the section shows only that provider, with its Link button (every signed-in user)", async () => {
    await enableProvider("github");
    resetFlagCache();
    for (const method of ["magic_link", "oauth_google"] as const) {
      const { cookie } = await signIn(emailOf("lan"), { method });
      const html = (await meHtml(cookie)).html;
      expect(sectionOf(html)).toContain("Sign-in & linked accounts");
      const rows = rowsOf(html);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain("GitHub");
      expect(rows[0]).toContain("Not linked");
      expect(rows[0]).toContain('action="/me/identities/github/link"');
      expect(rows[0]).toContain('method="post"');
      expect(rows[0]).toContain("Link GitHub");
    }
  });

  it("a flag on but the provider not configured: not available, so no section", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = (await meHtml(cookie, "/me", withoutCredentials)).html;
    expect(html).not.toContain('id="identities"');
  });

  it("every flag off and one linked account: the section shows only that row, with the label and no Link button", async () => {
    const label = `lan-${tag()}@gmail.example`;
    const email = emailOf("lan");
    await linkedUser(email, "google", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    const html = (await meHtml(cookie)).html;
    const rows = rowsOf(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Google");
    expect(rows[0]).toContain("Linked");
    expect(rows[0]).toContain(label);
    expect(sectionOf(html)).not.toContain("<form");
    expect(sectionOf(html)).not.toContain("GitHub");
    const { cookie: other } = await signIn(emailOf("minh"));
    expect((await meHtml(other)).html).not.toContain(label);
  });

  it("a linked provider whose flag is off stays visible next to a linkable one, in catalogue order", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(email);
    const rows = rowsOf((await meHtml(cookie)).html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("GitHub");
    expect(rows[0]).toContain("Link GitHub");
    expect(rows[1]).toContain("LinkedIn");
    expect(rows[1]).toContain("Linked");
    expect(rows[1]).not.toContain("<form");
  });

  it("a label equal to the provider name is not repeated, and unlink is Task 9's: nothing mentions it", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    const { cookie } = await signIn(email);
    const html = (await meHtml(cookie)).html;
    expect((rowsOf(html)[0] ?? "").match(/LinkedIn/g)).toHaveLength(1);
    expect(sectionOf(html)).not.toContain("unlink");
  });

  it("is localized in all four locales, and /me is not no-referrer", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const titles: Array<[string, string]> = [["/me", "Sign-in & linked accounts"], ["/vi/me", "Đăng nhập & tài khoản liên kết"], ["/zh-hans/me", "登录与关联账号"], ["/zh-hant/me", "登入與連結帳號"]];
    for (const [path, title] of titles) {
      const { res, html } = await meHtml(cookie, path);
      expect(sectionOf(html), path).toContain(title);
      expect(res.headers.get("referrer-policy")).not.toBe("no-referrer");
    }
  });
});

, () => {
  it("303 to the same-site start, with an intent cookie bound to this session and living at most 120 s", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("github", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/oauth/github/start?lang=en");
    const raw = setCookieValue(res, OAUTH_COOKIE) ?? "";
    const intent = parseOAuthCookie(raw, { provider: "github", now: Date.now() });
    if (intent?.phase !== "intent") throw new Error("no intent cookie");
    expect(intent.intent).toBe("link");
    expect(intent.sessionHash).toBe(await linkSessionHash(cookie.split("=")[1] ?? ""));
    expect(intent.exp - Date.now()).toBeLessThanOrEqual(120_000);
    const line = res.headers.getSetCookie().find((l) => l.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Path=\//);
    expect(Number(/Max-Age=(\d+)/i.exec(line)?.[1])).toBeLessThanOrEqual(120);
  });

  it.each([["/vi/me", "vi"], ["/zh-hans/me", "zh-Hans"], ["/zh-hant/me", "zh-Hant"]])("%s: lang is the Locale id", async (prefix, lang) => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("google", cookie, `${prefix}/identities/google/link`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/auth/oauth/google/start?lang=${lang}`);
  });

  it("never redirects off-site: the Location is a path on this site, whatever the request", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const res = await postLink("github", cookie, "/me/identities/github/link?next=https://evil.example&redirect=//evil.example");
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/auth/oauth/github/start")).toBe(true);
    expect(location.startsWith("//")).toBe(false);
    expect(location).not.toContain("evil");
  });

  it("refuses a missing or foreign Origin (403) and writes no cookie", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }]) {
      const res = await postLink("github", cookie, "/me/identities/github/link", headers);
      expect(res.status).toBe(403);
      expect(setCookieValue(res, OAUTH_COOKIE)).toBeNull();
    }
    const noOrigin = await createApp().request(new Request("https://vnx.si/me/identities/github/link", { method: "POST", headers: { cookie } }), undefined, testEnv);
    expect(noOrigin.status).toBe(403);
    expect(setCookieValue(noOrigin, OAUTH_COOKIE)).toBeNull();
  });

  it("is 404 with no cookie when the flag is off, the provider is not configured, or the name is not a provider", async () => {
    const { cookie } = await signIn(emailOf("lan"));
    expect((await postLink("github", cookie)).status).toBe(404);
    await enableProvider("github");
    resetFlagCache();
    const unconfigured = await createApp().request(formPost("/me/identities/github/link", {}, { cookie }), undefined, withoutCredentials);
    expect(unconfigured.status).toBe(404);
    expect(setCookieValue(unconfigured, OAUTH_COOKIE)).toBeNull();
    expect((await postLink("facebook", cookie)).status).toBe(404);
    expect((await postLink("google", cookie)).status).toBe(404);
  });

  it("needs a session: signed out goes to /login and no OAuth cookie is written", async () => {
    await enableProvider("github");
    const res = await createApp().request(formPost("/me/identities/github/link", {}), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(setCookieValue(res, OAUTH_COOKIE)).toBeNull();
  });

  it("keeps the 64 KB body limit", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const big = new Request("https://vnx.si/me/identities/github/link", {
      method: "POST",
      headers: { origin: "https://vnx.si", cookie, "content-type": "application/x-www-form-urlencoded" },
      body: `x=${"a".repeat(70 * 1024)}`,
    });
    expect((await createApp().request(big, undefined, testEnv)).status).toBe(413);
  });
});
```

- [ ] **Step 3: Test hỏng trước, trang trung gian (`apps/web/test/auth/oauth-link-start.test.ts`)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { OAUTH_PROVIDERS, PROVIDER_NAME } from "../../src/domain/identity.ts";
import { OAUTH_PROVIDER_SPECS, parseOAuthCookie } from "../../src/domain/oauth.ts";
import { signIn } from "../fixtures.ts";
import { getReq, setCookieValue, testEnv } from "../helpers.ts";
import { enableProvider, externalLinks, linkViaStart, startOAuth } from "../oauth-flow.ts";

let counter = 0;
const emailOf = (who: string) => `${who}-${++counter}-${Math.random().toString(36).slice(2, 8)}@example.com`;

beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("start with a link intent: the intermediate page (decision 14, R3; Review Focus 12)", () => {
  it.each(OAUTH_PROVIDERS)("%s: POST answers 303, then start answers 200, never a 3xx, with one plain link to the provider and no form but the logout one", async (provider) => {
    await enableProvider(provider);
    const { cookie } = await signIn(emailOf("lan"));
    const linked = await linkViaStart(provider, cookie);
    expect(linked.post.status).toBe(303);
    expect(linked.start.status).toBe(200);
    expect(linked.start.headers.get("location")).toBeNull();
    const links = externalLinks(linked.html);
    expect(links).toHaveLength(1);
    expect(links[0]?.origin).toBe(new URL(OAUTH_PROVIDER_SPECS[provider].authorizeUrl).origin);
    expect(links[0]?.searchParams.get("state")).toBe(linked.flow?.state);
    expect(links[0]?.searchParams.get("redirect_uri")).toBe(`${testEnv.APP_ORIGIN}/auth/oauth/${provider}/callback`);
    // The page is signed in, so Layout adds its logout form; no other form, none off-site, none towards /auth/oauth/.
    const actions = [...linked.html.matchAll(/<form\b[^>]*\baction="([^"]*)"/g)].map((m) => m[1] ?? "");
    expect((linked.html.match(/<form\b/g) ?? []).length).toBe(actions.length);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a === "/logout")).toBe(true);
    expect(linked.html).toContain('action="/logout"');
    expect(linked.html).toContain(`Link ${PROVIDER_NAME[provider]}`);
    expect(linked.html).toContain(`Continue to ${PROVIDER_NAME[provider]}`);
  });

  it("is hardened: no-store, Referrer-Policy same-origin, no inline script or style", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const { start, html } = await linkViaStart("github", cookie);
    expect(start.headers.get("cache-control")).toBe("no-store");
    expect(start.headers.get("referrer-policy")).toBe("same-origin");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/http-equiv="refresh"/i);
  });

  it("writes a link flow cookie bound to this session, with no next, and the locale of lang", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const linked = await linkViaStart("github", cookie, { extraQuery: "&next=/hub" });
    expect(linked.flow).toMatchObject({ phase: "flow", intent: "link", provider: "github", next: null, locale: "en" });
    expect(linked.flow?.sessionHash).toBe(await linkSessionHash(cookie.split("=")[1] ?? ""));
    expect(linked.flow?.state).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it("is localized, and the provider name is not translated", async () => {
    await enableProvider("linkedin");
    const { cookie } = await signIn(emailOf("lan"));
    const expected: Array<[string, string, string]> = [["/vi/me", "Tiếp tục tới LinkedIn", "Liên kết LinkedIn"], ["/zh-hans/me", "继续前往 LinkedIn", "关联 LinkedIn 账号"], ["/zh-hant/me", "繼續前往 LinkedIn", "連結 LinkedIn 帳號"]];
    for (const [prefix, cta, title] of expected) {
      const post = await createApp().request(new Request(`https://vnx.si${prefix}/identities/linkedin/link`, { method: "POST", headers: { origin: "https://vnx.si", cookie } }), undefined, testEnv);
      const intent = setCookieValue(post, OAUTH_COOKIE) ?? "";
      const res = await createApp().request(getReq(post.headers.get("location") ?? "", `${cookie}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
      const html = await res.text();
      expect(html, prefix).toContain(cta);
      expect(html, prefix).toContain(title);
    }
  });

  it("no URL parameter chooses the intent: no intent cookie means a 302 sign-in, whatever the query", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    for (const query of ["?intent=link", "?link=1", "?mode=link&lang=en"]) {
      const res = await createApp().request(getReq(`/auth/oauth/github/start${query}`, cookie), undefined, testEnv);
      expect(res.status, query).toBe(302);
    }
    expect((await startOAuth("github", "?intent=link", cookie)).flow.intent).toBe("signin");
  });

  it("a link intent counts only for the session that asked, only for its provider, and only while the session lives", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const raw = setCookieValue((await linkViaStart("github", lan.cookie)).post, OAUTH_COOKIE) ?? "";
    // Another user's session carrying Lan's intent cookie.
    const other = await createApp().request(getReq("/auth/oauth/github/start", `${minh.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(other.status).toBe(302);
    // The right session, but a start for another provider.
    const wrongProvider = await createApp().request(getReq("/auth/oauth/google/start", `${lan.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(wrongProvider.status).toBe(302);
    // The right session after it expired (Task 2 LOW-2).
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(lan.user.id, "2020-01-01T00:00:00.000Z").run();
    const expired = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${OAUTH_COOKIE}=${raw}`), undefined, testEnv);
    expect(expired.status).toBe(302);
  });

  it("signing in is unchanged: no session and no cookie still gets a 302 to the provider", async () => {
    await enableProvider("github");
    const started = await startOAuth("github");
    expect(started.res.status).toBe(302);
    expect(started.flow.intent).toBe("signin");
    expect(started.authorize.origin).toBe("https://github.com");
  });

  it("reloading the page (Back, refresh) shows it again with a fresh state: a live link flow of this session counts like an intent", async () => {
    await enableProvider("github");
    const { cookie } = await signIn(emailOf("lan"));
    const first = await linkViaStart("github", cookie);
    const reload = await createApp().request(getReq("/auth/oauth/github/start?lang=en", `${cookie}; ${first.flowCookie}`), undefined, testEnv);
    expect(reload.status).toBe(200);
    expect(reload.headers.get("location")).toBeNull();
    const raw = setCookieValue(reload, OAUTH_COOKIE) ?? "";
    const flow = parseOAuthCookie(raw, { provider: "github", now: Date.now() });
    if (flow?.phase !== "flow") throw new Error("no flow cookie");
    expect(flow).toMatchObject({ intent: "link", sessionHash: first.flow?.sessionHash });
    expect(flow.state).not.toBe(first.flow?.state);
    const links = externalLinks(await reload.text());
    expect(links).toHaveLength(1);
    expect(links[0]?.searchParams.get("state")).toBe(flow.state);
  });

  it("a sign-in flow cookie, another session's link flow, or an expired session is a 302 sign-in", async () => {
    await enableProvider("github");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const signinFlow = await startOAuth("github");
    const signedIn = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${signinFlow.cookie}`), undefined, testEnv);
    expect(signedIn.status, "signin flow cookie").toBe(302);
    const lansFlow = await linkViaStart("github", lan.cookie);
    const other = await createApp().request(getReq("/auth/oauth/github/start", `${minh.cookie}; ${lansFlow.flowCookie}`), undefined, testEnv);
    expect(other.status, "another session's link flow").toBe(302);
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(lan.user.id, "2020-01-01T00:00:00.000Z").run();
    const expired = await createApp().request(getReq("/auth/oauth/github/start", `${lan.cookie}; ${lansFlow.flowCookie}`), undefined, testEnv);
    expect(expired.status, "expired session").toBe(302);
  });
});
```

- [ ] **Step 4: Chạy, thấy đỏ**

`npm test -w apps/web -- test/me/identities.test.ts test/auth/oauth-link-start.test.ts` → FAIL (không có `<section id="identities">`; `POST /me/identities/…` 404; `start` với intent `link` trả 400, không phải 200).

- [ ] **Step 5: Mã**

`apps/web/src/routes/oauth.tsx`: (a) đổi `async function enabledProvider` thành `export async function enabledProvider`; (b) thêm ngay sau nó (import thêm `OAUTH_PROVIDERS` từ `../domain/identity.ts`, `isProviderConfigured` từ `../auth/oauth/index.ts`, `OAuthLinkPage` từ `../views/auth.tsx`):

```ts
/** The providers a person may use right now: flag on AND configured (decision 6). `/login` and `/me` both ask this. */
export async function availableProviders(c: Context<AppEnv>): Promise<OAuthProvider[]> {
  const shown: OAuthProvider[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    if ((await isFlagEnabled(c.env.DB, PROVIDER_FLAG[provider])) && isProviderConfigured(c.env, provider)) shown.push(provider);
  }
  return shown;
}
```
(c) Trong `start`, thay khối từ `const raw = readSessionCookie(c);` đến `return c.redirect(url, 302);` bằng:

```ts
    // Task 2 LOW-2: a link intent counts only for a session that is alive now (`user` is null for an expired or suspended one).
    const raw = readSessionCookie(c);
    const sessionHash = c.get("user") && raw ? await linkSessionHash(raw) : null;
    // An intent from POST …/link, or (MEDIUM-2) a live LINK flow of this very session (Back, refresh). Check `intent === "link"`
    // explicitly: `flowMatchesSession` is true for every signin flow. Import `flowMatchesSession` from ../domain/oauth.ts.
    const cookie = readOAuthCookie(c, provider, now);
    const linking = sessionHash !== null && (resolveStartIntent(cookie, sessionHash, now) === "link" || (cookie?.phase === "flow" && cookie.intent === "link" && flowMatchesSession(cookie, sessionHash)));
    const next = linking ? null : safeNext(c.req.query("next"));
    const lang = c.req.query("lang");
    const locale = isLocale(lang) ? lang : localeFromPath(next ?? "/").locale;
    const state = generateState();
    const verifier = generateVerifier();
    const nonce = generateNonce();
    writeOAuthCookie(c, newFlowCookie({ provider, intent: linking ? "link" : "signin", state, verifier, nonce, next, locale, sessionHash: linking ? sessionHash : null }, now), now);
    const url = buildAuthorizeUrl({ provider, clientId: client.clientId, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), state, challenge: await codeChallengeS256(verifier), nonce });
    // Decision 14 (R3): a link NEVER redirects. `form-action 'self'` covers the redirect chain of the POST that led here in Chrome;
    // clicking this link is a new navigation. The flow cookie replaces the intent cookie (one use).
    if (linking) return page(c, <OAuthLinkPage locale={locale} origin={new URL(c.req.url).origin} provider={provider} authorizeUrl={url} />);
    return c.redirect(url, 302);
```
`callback`, `OAuthFailure` không đổi trong 8a-1.

`apps/web/src/routes/auth.tsx`: xóa hàm `loginProviders`; mọi chỗ gọi `loginProviders(c)` đổi thành `availableProviders(c)` (`import { availableProviders } from "./oauth.tsx";`); xóa các import chỉ `loginProviders` dùng: `isProviderConfigured`, `isFlagEnabled`, `OAUTH_PROVIDERS`, `type OAuthProvider`, `PROVIDER_FLAG` (kiểm từng tên bằng `grep -n` trong file; repo không bật `noUnusedLocals` nên typecheck KHÔNG báo import thừa, phải tự dọn). Test Task 7 không đổi.

`apps/web/src/views/auth.tsx` (thêm cuối file):

```tsx
/** Decision 14 (R3): the one step between the "Link" button and the provider. One plain link, no form, no script, no refresh. */
export const OAuthLinkPage: FC<Base & { provider: OAuthProvider; authorizeUrl: string }> = (props) => {
  const tr = translator(props.locale);
  const provider = PROVIDER_NAME[props.provider];
  return (
    <Layout locale={props.locale} title={tr("me.identities.link", { provider })} origin={props.origin} rest="/me" noindex signedIn>
      <section class="card">
        <h1>{tr("me.identities.link", { provider })}</h1>
        <p>{tr("oauth.link.body", { provider })}</p>
        <a class="btn" href={props.authorizeUrl}>
          {tr("oauth.link.cta", { provider })}
        </a>
      </section>
    </Layout>
  );
};
```

`apps/web/src/views/me/LinkedAccounts.tsx` (tạo mới):

```tsx
import type { FC } from "hono/jsx";
import { OAUTH_PROVIDERS, type OAuthProvider, PROVIDER_NAME, type UserIdentity } from "../../domain/identity.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";

/**
 * The owner's own page (ADR-012 §4): the providers that are linked or linkable (Owner 2026-10-08), nothing at all when there are none.
 * `label` is shown here and nowhere else. `linkable` is the flag-and-credentials rule decided by the route; a linked row shows whatever the flag says. Unlink is VNX-2605b: it adds a form to the last cell.
 */
export const LinkedAccounts: FC<{ locale: Locale; identities: readonly UserIdentity[]; linkable: readonly OAuthProvider[] }> = ({ locale, identities, linkable }) => {
  const tr = translator(locale);
  const rows = OAUTH_PROVIDERS.filter((p) => identities.some((i) => i.provider === p) || linkable.includes(p));
  if (rows.length === 0) return null;
  return (
    <section id="identities">
      <h2>{tr("me.identities.title")}</h2>
      <p class="muted">{tr("me.identities.intro")}</p>
      <div class="table-wrap">
        <table class="data">
          <tbody>
            {rows.map((provider) => {
              const name = PROVIDER_NAME[provider];
              const linked = identities.find((i) => i.provider === provider);
              return (
                <tr>
                  <td>{name}</td>
                  <td>
                    {linked ? tr("me.identities.linked") : tr("me.identities.notLinked")}
                    {linked && linked.label !== name ? <span class="muted"> · {linked.label}</span> : null}
                  </td>
                  <td>
                    {!linked && linkable.includes(provider) ? (
                      <form method="post" action={localizedPath(locale, `/me/identities/${provider}/link`)}>
                        <button class="btn btn-ghost" type="submit">
                          {tr("me.identities.link", { provider: name })}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
```

`apps/web/src/routes/me.tsx`: thêm import (`listIdentitiesForUser`, `readSessionCookie`, `linkSessionHash`, `writeOAuthCookie`, `newLinkIntent`, `availableProviders`, `enabledProvider`, `LinkedAccounts`); trong `GET /me` thêm hai phần tử vào `Promise.all` (`listIdentitiesForUser(c.env.DB, user.id)`, `availableProviders(c)`) và, sau `<section>` inquiries, `<LinkedAccounts locale={locale} identities={identities} linkable={linkable} />`. Thêm route trong `registerMeRoutes`, sau `GET /me`:

```ts
  // ADR-012 §4: "Link" is a POST (the Origin check is global). It writes one 120 s cookie for THIS session and sends the browser to the
  // same-site start. It never redirects off-site (`form-action 'self'`); start shows the page with the link to the provider.
  onLocalized(app, "post", "/me/identities/:provider/link", requireUser, async (c) => {
    const found = await enabledProvider(c);
    const raw = readSessionCookie(c);
    if (!found || !raw) return errorResponse(c, "notFound", 404);
    const now = Date.now();
    writeOAuthCookie(c, newLinkIntent({ provider: found.provider, sessionHash: await linkSessionHash(raw) }, now), now);
    return c.redirect(`/auth/oauth/${found.provider}/start?lang=${c.get("locale")}`, 303);
  });
```

- [ ] **Step 6: Khóa i18n.** Thêm 7 khóa của bảng vào 4 file (`me.identities.*` ngay sau `me.requests.empty`; `oauth.link.*` ngay sau `oauth.signInWith`). Đổi `oauth.notLinked.body` theo cột "Mới" (đã duyệt).

- [ ] **Step 7: Sửa test cũ và allowlist.** (a) `test/architecture.test.ts`: `IDENTITY_ALLOWED` thêm `"../src/routes/me.tsx"`. (b) `test/auth/oauth-routes.test.ts`: test "refuses a live link intent until Task 8 (link_unsupported) …" (≈ dòng 121) đổi tên thành "a live link intent gets the intermediate page" và thân: `status` 200, `location` null, `expectHardened(res)`, `setCookieValue(res, OAUTH_COOKIE)` khác null, `expect(logged()).toHaveLength(0)` (không còn `expectOneLog`). Test callback "refuses a flow cookie whose intent is link until Task 8" giữ nguyên (đổi ở 8a-2). (c) dòng ≈ 271 đổi chuỗi vi thành câu mới: `Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết ở mục “Đăng nhập & tài khoản liên kết” trong trang Yêu cầu và nhu cầu.`; HTML escape `&` thành `&amp;`, nên giải entity (`&#39; &quot; &lt; &gt; &amp;`) trước khi `toContain`.

- [ ] **Step 8: Xanh**

`npm test -w apps/web -- test/me test/auth test/i18n test/architecture.test.ts test/http` → PASS (login-oauth-buttons, login-flow, oauth-routes không đổi hành vi).

- [ ] **Step 9: Kiểm tay (xác nhận quyết định 14; không thay test)**

`npm run dev` với `.dev.vars` có `MAIL_DRIVER=fake`, `OAUTH_DRIVER=fake`; bật `oauth_github` ở `/admin/flags`; đăng nhập bằng magic link; trên Chrome, Firefox và Safari: ở `/me` bấm "Link GitHub" → thấy trang "Link GitHub / Continue to GitHub" (không bị chặn, không có lỗi CSP trong console) → bấm "Continue to GitHub" → trình duyệt tới `github.com/login/oauth/authorize?...` (chưa có client thật nên GitHub báo lỗi ứng dụng là bình thường; cần xác nhận điều hướng xảy ra). Tải lại trang trung gian và nút Back: xác nhận hiện lại trang với `state` mới, không rơi về `signin` (quyết định 7). Ghi kết quả 3 trình duyệt vào báo cáo.

- [ ] **Step 10: Tiêu chí chấp nhận (`ID` = `test/me/identities.test.ts`, `LS` = `test/auth/oauth-link-start.test.ts`)**

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Cờ tắt và không identity: không có mục; một cờ bật: chỉ hàng đó, có nút; hàng đã liên kết hiện một mình khi cờ tắt | `npm test -w apps/web -- ID -t "is absent while every flag is off"`, `-t "one flag on"`, `-t "every flag off and one linked account"` |
| 2 | Cờ bật nhưng chưa cấu hình: không mục; hàng đã liên kết (cờ tắt) cạnh hàng khả dụng, đúng thứ tự | `-t "not configured"` và `-t "stays visible next to a linkable one"` |
| 3 | `label` chỉ của chủ, không nút khi đã liên kết, không `unlink` | `-t "every flag off and one linked account"` và `-t "not repeated"` |
| 4 | `POST …/link`: 303 cùng site, cookie 120 s gắn session, không off-site | `-t "303 to the same-site start"` và `-t "never redirects off-site"` |
| 5 | Origin, 404 (cờ, cấu hình, tên lạ), cần session, body 64 KB | `-t "refuses a missing or foreign Origin"`, `-t "is 404"`, `-t "needs a session"`, `-t "64 KB"` |
| 6 | `start` + intent `link`: 200, không 3xx, đúng một `<a>` ra ngoài, mọi `<form>` đều `action="/logout"` | `npm test -w apps/web -- LS -t "answers 303, then start answers 200"` |
| 7 | no-store, `same-origin`, không script/style/handler nội tuyến | `-t "is hardened"` |
| 8 | Không tham số URL nào chọn intent; intent chỉ cho đúng session, provider, còn sống; tải lại hiện lại trang với state mới; flow `signin`, flow session khác, session hết hạn: 302 | `-t "no URL parameter"`, `-t "counts only for the session"`, `-t "reloading the page"`, `-t "sign-in flow cookie, another session"` |
| 9 | `signin` không đổi | `-t "signing in is unchanged"` và `npm test -w apps/web -- test/auth/oauth-routes.test.ts test/auth/login-oauth-buttons.test.ts` |
| 10 | 4 locale và parity | `-t "localized"` và `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 11 | Ranh giới module | `npm test -w apps/web -- test/architecture.test.ts` |
| 12 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test` |

(Thay `ID`, `LS` bằng đường dẫn đầy đủ khi chạy.)

- [ ] **Step 11: Typecheck, toàn bộ test, commit**

```bash
git add apps/web/src/views/me/LinkedAccounts.tsx apps/web/src/views/auth.tsx apps/web/src/routes/oauth.tsx apps/web/src/routes/auth.tsx apps/web/src/routes/me.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/architecture.test.ts apps/web/test/oauth-flow.ts apps/web/test/auth/oauth-routes.test.ts \
  apps/web/test/me/identities.test.ts apps/web/test/auth/oauth-link-start.test.ts
git commit -m "feat(web): linked accounts section on /me, link POST and interstitial (VNX-2605a-1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã ≈ 135 dòng (`LinkedAccounts` 50, `me.tsx` 25, `oauth.tsx` 30, `views/auth.tsx` 20, `auth.tsx` −8/+3), test ≈ 360 dòng (hai file mới ≈ 320, helper ≈ 30, sửa ≈ 15), locale 7 khóa × 4 file (+ 1 câu đổi). Tổng ≈ 500 không tính locale: không tách thêm.

**Nghĩa vụ cho 8a-2 và Task 9:**
- **8a-2:** thay nhánh `link_unsupported` của `callback`; `/me` đọc `?link=` và hiện thông báo; flow cookie `link` đã đúng hình (`sessionHash` có, `next: null`).
- **Task 9:** thêm form `POST …/unlink` vào ô thứ ba của hàng đã liên kết trong `LinkedAccounts` (hàng này hiện kể cả khi cờ tắt); test "nothing mentions it" của 8a-1 đổi theo. Thuật ngữ hủy liên kết: vi "hủy liên kết", zh-Hans 取消关联, zh-Hant 取消連結.
- **Kiểm tay (Step 9) và tải lại trang trung gian (quyết định 7)** ghi vào báo cáo; VNX-2608 lặp lại với provider thật.

#### Task 8b: VNX-2605a-2 — Nhánh `link` của callback, xung đột, thông báo ở `/me`

**Phạm vi:** (1) `callback` với flow cookie `intent: "link"` thay `link_unsupported`: cần phiên đang sống khớp `sessionHash` (`flowMatchesSession`), đổi `code`, gọi `linkIdentity` (Task 1), 303 về `/me` kèm `?link=<kết quả>`; (2) `/me` hiện thông báo theo `?link=`; (3) xung đột trả thông báo chung không nói ai sở hữu. **Không** tạo session, **không** đổi `sessions.method`, **không** gửi email (Task 9). Không migration, không dependency.

**Files:**
- Modify: `apps/web/src/routes/oauth.tsx` (hàm `finishLink`, nhánh trong `callback`, `OAuthFailure`)
- Modify: `apps/web/src/routes/me.tsx` (đọc `?link=`, truyền `notice`)
- Modify: `apps/web/src/views/me/LinkedAccounts.tsx` (prop `notice`, khối thông báo)
- Modify: 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (4 khóa)
- Modify (test): `apps/web/test/auth/oauth-routes.test.ts` (xóa test callback "refuses a flow cookie whose intent is link until Task 8")
- Create (test): `apps/web/test/auth/oauth-link.test.ts`

**Interfaces:**
- Consumes (tên thật):
  - `db/identities.ts`: `linkIdentity(db, { userId, provider, subject, label, now }): Promise<LinkResult>`, `LinkResult = { ok: true; identity } | { ok: false; reason: "already_linked" | "provider_account_taken" | "user_has_provider" }`. Khi `ok`, audit `auth.identity.link` `{ provider }` đã ghi cùng `db.batch`; khi từ chối không ghi gì.
  - `domain/oauth.ts`: `flowMatchesSession(flow, sessionHash)`, `type FlowCookie`; `auth/oauth-cookie.ts`: `linkSessionHash`; `auth/cookies.ts`: `readSessionCookie`; `c.get("user")` (null cho phiên hết hạn hoặc user không `active`, nghĩa vụ Task 2 LOW-2).
  - `routes/oauth.tsx`: `failed`, `logFailure`, `harden`, `MAX_CODE_CHARS`; `i18n/locales.ts`: `localizedPath`.
  - Test (từ 8a-1): `linkViaStart`; `issueCodeFor`, `callbackReq`, `clearedOAuthCookie`, `linkedUser`, `enableProvider`; `signIn`, `ensureUser`; `issueFakeCode`, `resetFakeOAuth`.
- Produces:
  - `routes/oauth.tsx` (không export): `finishLink(c, { provider, client, flow, nowMs })`, `backToMe`; `OAuthFailure` bỏ `"link_unsupported"`, thêm `"session_mismatch"` và `"link_conflict"`.
  - `views/me/LinkedAccounts.tsx`: `export type LinkNotice = "ok" | "taken" | "hasProvider" | "failed"`; prop `notice?: LinkNotice`.
  - `?link=` là tập đóng bốn giá trị; giá trị khác bị bỏ.
  - Khóa i18n mới (4): `me.identities.notice.ok`, `.taken`, `.hasProvider`, `.failed`.

**Quyết định kỹ thuật (Planner; Reviewer kiểm):**
1. **Kết quả đi qua `?link=<ok|taken|hasProvider|failed>` trên 303 về `/me`, không qua cookie hay session.** Chỉ một từ cố định trong whitelist, không phản chiếu input. Ai gửi nạn nhân link `/me?link=ok` chỉ làm hiện câu "đã liên kết" ở trang của nạn nhân: không đổi dữ liệu, không lộ gì. Chấp nhận.
2. **Callback `link` kiểm phiên TRƯỚC khi đổi `code`.** Phiên không khớp (hết hạn, đăng xuất, đổi người, user bị khóa) → trang lỗi chung 400 (`OAuthErrorPage`), mã log `session_mismatch`, không gọi `exchange`, cookie xóa. Lý do: không tiêu `code` và không hỏi provider khi không có ai để gắn. Trang "We couldn't sign you in" hơi lệch chữ cho luồng liên kết, nhưng phiên đã mất thì "đăng nhập lại" là lời khuyên đúng.
3. **Provider từ chối và lỗi `exchange` trong luồng `link`** (người dùng bấm "Cancel" ở provider, `code` hỏng) → 303 `/me?link=failed` (người dùng còn đăng nhập, về lại trang của họ), log đúng mã cố định như Task 6 (`provider_denied`, `missing_code`, `ExchangeFailure`). `state` sai, không cookie, hết hạn, rate limit vẫn là trang lỗi chung của Task 6: lúc đó chưa biết đó là luồng nào.
4. **Ba kết quả của `linkIdentity`:** `ok` và `already_linked` → `link=ok` (cùng người, cùng tài khoản: thành công, idempotent, không audit thứ hai; Task 9 không gửi email cho `already_linked`); `provider_account_taken` → `link=taken`, câu (Owner 2026-10-08) nói tài khoản đó đã liên kết với một tài khoản VNX.SI khác và kèm contact@vnx.si, **không nói là tài khoản nào hay của ai**; `user_has_provider` → `link=hasProvider` (nói về chính tài khoản của người dùng: họ đã có một tài khoản của provider đó, hãy gỡ rồi liên kết lại; không rò gì về người khác). Cả hai xung đột log mã `link_conflict` (không subject, không label, không user id).
5. **Callback `link` không đụng `sessions`:** không `markLogin`, `writeSessionCookie`, `createSession`, không audit `auth.login`. Test đếm hàng `sessions` trước và sau, khẳng định không có `Set-Cookie` của `__Host-vnx_session`, và `sessions.method` không đổi. Luồng `link` không bao giờ đăng nhập ai: nếu `subject` đã thuộc user khác, kết quả là `taken`, không bao giờ có session của user kia.
6. **`label` lấy từ `result.identity.label`** (adapter đã chuẩn hóa 1–254 ký tự, quyết định 12); không so với `users.email`.
7. **Móc cho Task 9:** `finishLink` giữ một chỗ duy nhất sau `linkIdentity`, có chú thích `VNX-2605b: the "account linked" e-mail goes here, only when linked.ok`. Task 9 thêm đúng một lời gọi `await notifyIdentityLinked(...)` ở đó (lỗi gửi mail được ghi log, không hoàn tác liên kết, không đổi `?link=`). 8b không để hàm rỗng.
8. **Thông báo là `<p class="notice" role="alert">`** (thành công: `class="notice good" role="status"`; lớp `.good` đã có ở `app.css`) ngay dưới `<h2>` của mục `identities`; không hộp thoại hay trang riêng.

**Câu chữ giao diện: Owner duyệt nguyên văn 2026-10-08:**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `me.identities.notice.ok` | Account linked. You can now sign in with it. | Đã liên kết tài khoản. Từ giờ bạn có thể đăng nhập bằng tài khoản này. | 账号已关联，现在可以用它登录。 | 帳號已連結，現在可以用它登入。 |
| `me.identities.notice.taken` | That account is already linked to another VNX.SI account, so it can't be linked here. Link a different account, or write to contact@vnx.si if you need help. | Tài khoản đó đã được liên kết với một tài khoản VNX.SI khác nên không thể liên kết ở đây. Hãy liên kết một tài khoản khác, hoặc viết cho contact@vnx.si nếu bạn cần hỗ trợ. | 该账号已关联到另一个 VNX.SI 账户，无法在此关联。请关联其他账号；如需帮助，请发邮件至 contact@vnx.si。 | 該帳號已連結到另一個 VNX.SI 帳戶，無法在此連結。請連結其他帳號；如需協助，請寄信至 contact@vnx.si。 |
| `me.identities.notice.hasProvider` | Your VNX.SI account already has a different account from that provider linked. To switch, unlink that one first, then link the new one. | Tài khoản VNX.SI của bạn đã liên kết một tài khoản khác của nhà cung cấp này. Muốn đổi, hãy hủy liên kết tài khoản đó trước, rồi liên kết tài khoản mới. | 你的 VNX.SI 账户已关联该平台的另一个账号。如需更换，请先取消关联原账号，再关联新账号。 | 你的 VNX.SI 帳戶已連結該平台的另一個帳號。如需更換，請先取消連結原帳號，再連結新帳號。 |
| `me.identities.notice.failed` | We couldn't link that account. Please try again. | Không liên kết được tài khoản đó. Hãy thử lại. | 无法关联该账号，请重试。 | 無法連結該帳號，請再試一次。 |

`.hasProvider` nhắc "hủy liên kết", nút chỉ có từ Task 9 (cùng nhánh, merge cùng nhau). Thông báo hiện trong mục `identities`, mà mục chỉ hiện khi có provider khả dụng hoặc identity (quyết định của Owner ở 8a-1); sau một lượt liên kết thành công user luôn có identity, nên thông báo luôn thấy được.

- [ ] **Step 1: Test hỏng trước (`apps/web/test/auth/oauth-link.test.ts`)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import type { OAuthProvider } from "../../src/domain/identity.ts";
import { encodeOAuthCookie, newFlowCookie, oauthRedirectUri } from "../../src/domain/oauth.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";
import { callbackReq, clearedOAuthCookie, enableProvider, linkedUser, linkViaStart } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const identityOf = () => ({ subject: `sub-${tag()}`, label: `login-${tag()}` });
const count = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const sessionsOf = (userId: string) => count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1", userId);
const linkAudits = (userId: string) => count("SELECT count(*) AS n FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'", userId);
const identitiesOf = (userId: string) => count("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1", userId);
const redirectUri = (provider: OAuthProvider) => oauthRedirectUri(testEnv.APP_ORIGIN, provider);

const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const method of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
});
afterEach(() => spies.splice(0).forEach((spy) => spy.mockRestore()));
const logged = () => spies.flatMap((spy) => spy.mock.calls).map((args) => args.map(String).join(" "));
const loggedCodes = () => logged().map((line) => (JSON.parse(line) as { code: string }).code);

/** The user is signed in (magic link), presses Link, comes back from the provider with a code for `identity`. */
async function comeBack(provider: OAuthProvider, session: string, identity: { subject: string; label: string }, postPrefix = "") {
  const link = await linkViaStart(provider, session, { postPrefix });
  if (!link.flow) throw new Error("no link flow");
  const code = issueFakeCode(provider, identity, { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri(provider) });
  return { link, code, res: await callbackReq(provider, { code, state: link.flow.state }, `${session}; ${link.flowCookie}`) };
}
/** Hono escapes & ' " < >; a browser shows the characters (pattern of test/landing/page.test.ts:15). */
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const meHtml = async (path: string, cookie: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
/** The 303 back to /me is hardened and clears the OAuth cookie, whatever the outcome (LOW-2). */
function expectBack(res: Response, location: string) {
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(location);
  expect(clearedOAuthCookie(res)).not.toBeNull();
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("referrer-policy")).toBe("same-origin");
}

describe("callback with a link flow (ADR-012 §4)", () => {
  it("links the account to the signed-in user, audits, and redirects to /me with a success notice", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const id = identityOf();
    const before = await sessionsOf(user.id);
    const { res } = await comeBack("github", cookie, id);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    const row = await testEnv.DB.prepare("SELECT provider, provider_subject, label, show_on_profile FROM user_identities WHERE user_id = ?1").bind(user.id).first();
    expect(row).toEqual({ provider: "github", provider_subject: id.subject, label: id.label, show_on_profile: 0 });
    expect(await linkAudits(user.id)).toBe(1);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'").bind(user.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ provider: "github" });
    expect(clearedOAuthCookie(res)).not.toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
    // No sign-in: no new session, no session cookie, the method is the one it was.
    expect(await sessionsOf(user.id)).toBe(before);
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
    expect(await count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method <> 'magic_link'", user.id)).toBe(0);
    expect(logged()).toHaveLength(0);
  });

  it.each([["", "/me?link=ok"], ["/vi", "/vi/me?link=ok"], ["/zh-hans", "/zh-hans/me?link=ok"], ["/zh-hant", "/zh-hant/me?link=ok"]])("redirects to the locale of the flow (POST prefix %j)", async (prefix, location) => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"));
    const { res } = await comeBack("google", cookie, identityOf(), prefix);
    expect(res.headers.get("location")).toBe(location);
  });

  it("works from an OAuth session too, and keeps its method", async () => {
    await enableProvider("google");
    const { user, cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const { res } = await comeBack("google", cookie, identityOf());
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await count("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(1);
    expect(await sessionsOf(user.id)).toBe(1);
  });

  it("the same account again is a success without a second audit row", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const id = identityOf();
    const { user } = await linkedUser(email, "github", id);
    const { cookie } = await signIn(email);
    const audits = await linkAudits(user.id);
    const { res } = await comeBack("github", cookie, id);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await linkAudits(user.id)).toBe(audits);
  });

  it("an account another user holds: 'taken', nothing changes, nobody is signed in, the owner is never named", async () => {
    await enableProvider("github");
    const id = identityOf();
    const owner = await linkedUser(emailOf("owner"), "github", id);
    const { user, cookie } = await signIn(emailOf("lan"));
    const ownerSessions = await sessionsOf(owner.user.id);
    const { res } = await comeBack("github", cookie, id);
    expectBack(res, "/me?link=taken");
    expect(await identitiesOf(user.id)).toBe(0);
    expect(await linkAudits(user.id)).toBe(0);
    expect(await sessionsOf(owner.user.id)).toBe(ownerSessions);
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
    const page = await meHtml("/me?link=taken", cookie);
    expect(page).toContain("That account is already linked to another VNX.SI account");
    expect(page).toContain("contact@vnx.si");
    for (const secret of [owner.user.email, owner.user.id, id.subject, id.label]) {
      expect(page).not.toContain(secret);
      expect(logged().join("\n")).not.toContain(secret);
    }
    expect(loggedCodes()).toEqual(["link_conflict"]);
  });

  it("the 'taken' answer is the same whoever holds the account", async () => {
    await enableProvider("github");
    const a = identityOf();
    const b = identityOf();
    await linkedUser(emailOf("alice"), "github", a);
    await linkedUser(emailOf("bob"), "github", b);
    const { cookie } = await signIn(emailOf("lan"));
    const first = (await comeBack("github", cookie, a)).res;
    const second = (await comeBack("github", cookie, b)).res;
    expect(first.headers.get("location")).toBe(second.headers.get("location"));
  });

  it("a user who already has another account of that provider gets 'hasProvider' and keeps the old one", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const old = identityOf();
    const { user } = await linkedUser(email, "github", old);
    const { cookie } = await signIn(email);
    const { res } = await comeBack("github", cookie, identityOf());
    expectBack(res, "/me?link=hasProvider");
    expect(await identitiesOf(user.id)).toBe(1);
    expect((await testEnv.DB.prepare("SELECT provider_subject AS s FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ s: string }>())?.s).toBe(old.subject);
  });

  it("refuses when the session is not the one that asked: no exchange, no link, generic error page, cookie cleared", async () => {
    await enableProvider("github");
    const lan = await signIn(emailOf("lan"));
    const minh = await signIn(emailOf("minh"));
    const link = await linkViaStart("github", lan.cookie);
    if (!link.flow) throw new Error("no link flow");
    const code = issueFakeCode("github", identityOf(), { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri("github") });
    spies.forEach((s) => s.mockClear());
    for (const session of [`${minh.cookie}; `, ""]) {
      const res = await callbackReq("github", { code, state: link.flow.state }, `${session}${link.flowCookie}`);
      expect(res.status).toBe(400);
      expect(res.headers.get("location")).toBeNull();
      expect(clearedOAuthCookie(res)).not.toBeNull();
    }
    expect(await identitiesOf(lan.user.id)).toBe(0);
    expect(await identitiesOf(minh.user.id)).toBe(0);
    expect(loggedCodes()).toEqual(["session_mismatch", "session_mismatch"]);
    // The code was never spent: the right session can still use it.
    const again = await callbackReq("github", { code, state: link.flow.state }, `${lan.cookie}; ${link.flowCookie}`);
    expect(again.headers.get("location")).toBe("/me?link=ok");
  });

  it("refuses when the session expired between start and callback", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const link = await linkViaStart("github", cookie);
    if (!link.flow) throw new Error("no link flow");
    await testEnv.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE user_id = ?1").bind(user.id, "2020-01-01T00:00:00.000Z").run();
    const code = issueFakeCode("github", identityOf(), { verifier: link.flow.verifier, nonce: link.flow.nonce, redirectUri: redirectUri("github") });
    const res = await callbackReq("github", { code, state: link.flow.state }, `${cookie}; ${link.flowCookie}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("a link flow whose hash is for another session is not accepted even with a valid state", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const flow = newFlowCookie({ provider: "github", intent: "link", state: "s".repeat(43), verifier: "v".repeat(43), nonce: "n".repeat(43), next: null, locale: "en", sessionHash: await linkSessionHash("another-session") }, Date.now());
    const code = issueFakeCode("github", identityOf(), { verifier: flow.verifier, nonce: flow.nonce, redirectUri: redirectUri("github") });
    const res = await callbackReq("github", { code, state: flow.state }, `${cookie}; ${OAUTH_COOKIE}=${encodeOAuthCookie(flow)}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("the provider's refusal and a bad code come back to /me with 'failed', one fixed log code each, cookie cleared", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const denied = await linkViaStart("github", cookie);
    spies.forEach((s) => s.mockClear());
    const res = await callbackReq("github", { error: "access_denied", state: denied.flow?.state ?? "" }, `${cookie}; ${denied.flowCookie}`);
    expectBack(res, "/me?link=failed");
    const bad = await linkViaStart("github", cookie);
    const res2 = await callbackReq("github", { code: "no-such-code", state: bad.flow?.state ?? "" }, `${cookie}; ${bad.flowCookie}`);
    expectBack(res2, "/me?link=failed");
    expect(loggedCodes()).toEqual(["provider_denied", "token_request"]);
    expect(logged().join("\n")).not.toContain("no-such-code");
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("a wrong state is the generic page (it is not known to be a link yet) and links nothing", async () => {
    await enableProvider("github");
    const { user, cookie } = await signIn(emailOf("lan"));
    const link = await linkViaStart("github", cookie);
    const res = await callbackReq("github", { code: "x", state: "y".repeat(43) }, `${cookie}; ${link.flowCookie}`);
    expect(res.status).toBe(400);
    expect(await identitiesOf(user.id)).toBe(0);
  });

  it("does not look at the e-mail of the provider account: a matching users.email still links only the signed-in user", async () => {
    await enableProvider("google");
    const victim = await ensureUser(emailOf("victim"));
    const { user, cookie } = await signIn(emailOf("lan"));
    const { res } = await comeBack("google", cookie, { subject: `sub-${tag()}`, label: victim.email });
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await identitiesOf(victim.id)).toBe(0);
  });
});

describe("/me notices for ?link= (VNX-2605a-2)", () => {
  it.each([
    ["/me", "ok", "Account linked. You can now sign in with it."],
    ["/vi/me", "taken", "Tài khoản đó đã được liên kết với một tài khoản VNX.SI khác nên không thể liên kết ở đây."],
    ["/zh-hans/me", "hasProvider", "你的 VNX.SI 账户已关联该平台的另一个账号。"],
    ["/zh-hant/me", "failed", "無法連結該帳號，請再試一次。"],
  ])("%s?link=%s shows its message in the identities section", async (path, value, text) => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = await meHtml(`${path}?link=${value}`, cookie);
    expect(html.match(/<section id="identities">.*?<\/section>/s)?.[0]).toContain(text);
  });

  it("shows nothing for an unknown value and reflects nothing", async () => {
    await enableProvider("github");
    resetFlagCache();
    const { cookie } = await signIn(emailOf("lan"));
    const html = await meHtml("/me?link=%3Cb%3Eevil%3C/b%3E", cookie);
    expect(html).not.toContain("evil");
    expect(html).not.toContain('class="notice');
    expect(await meHtml("/me", cookie)).not.toContain('role="status"');
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

`npm test -w apps/web -- test/auth/oauth-link.test.ts` → FAIL (callback trả 400 `link_unsupported`; `/me` chưa hiện thông báo).

- [ ] **Step 3: Mã**

`apps/web/src/routes/oauth.tsx`. Đổi kiểu (import thêm `flowMatchesSession` và `type FlowCookie` từ `../domain/oauth.ts`, `linkIdentity` từ `../db/identities.ts`, `type LinkNotice` không cần ở đây):

```ts
type OAuthFailure = "no_cookie" | "wrong_phase" | "state_mismatch" | "provider_denied" | "missing_code" | "session_mismatch" | "link_conflict" | "rate_limited" | "user_inactive" | "internal" | ExchangeFailure;
```
Thêm trước `registerOAuthRoutes`:

```ts
type LinkNotice = "ok" | "taken" | "hasProvider" | "failed";

/** Back to the owner's page with one fixed word; `/me` shows the message for it. The URL carries no code, state or id. */
const backToMe = (c: Context<AppEnv>, locale: Locale, notice: LinkNotice) => c.redirect(`${localizedPath(locale, "/me")}?link=${notice}`, 303);

/**
 * The `link` flow of the callback (ADR-012 §4). It needs the session that asked, checked BEFORE the code is spent, and attaches the
 * provider account to THAT user and nothing else: no session is created or changed, no one is signed in, no e-mail is compared.
 */
async function finishLink(c: Context<AppEnv>, input: { provider: OAuthProvider; client: ProviderClient; flow: FlowCookie; nowMs: number }) {
  const { provider, client, flow, nowMs } = input;
  const user = c.get("user");
  const raw = readSessionCookie(c);
  // `user` is null for an expired or suspended session (Task 2 LOW-2).
  if (!user || !raw || !flowMatchesSession(flow, await linkSessionHash(raw))) return failed(c, provider, "session_mismatch", flow.locale);

  const code = c.req.query("code");
  if (c.req.query("error") !== undefined) {
    logFailure(c, provider, "provider_denied");
    return backToMe(c, flow.locale, "failed");
  }
  if (!code || code.length > MAX_CODE_CHARS) {
    logFailure(c, provider, "missing_code");
    return backToMe(c, flow.locale, "failed");
  }
  const result = await client.exchange({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(c.env.APP_ORIGIN, provider), now: nowMs });
  if (!result.ok) {
    logFailure(c, provider, result.reason);
    return backToMe(c, flow.locale, "failed");
  }

  const linked = await linkIdentity(c.env.DB, { userId: user.id, provider, subject: result.identity.subject, label: result.identity.label, now: new Date(nowMs).toISOString() });
  // VNX-2605b: the "account linked" e-mail goes here, only when linked.ok (not for already_linked).
  if (linked.ok || linked.reason === "already_linked") return backToMe(c, flow.locale, "ok");
  logFailure(c, provider, "link_conflict");
  return backToMe(c, flow.locale, linked.reason === "user_has_provider" ? "hasProvider" : "taken");
}
```
Trong `callback`, thay hai dòng "Task 8 adds the link branch … `link_unsupported`" bằng:

```ts
      if (flow.intent === "link") return await finishLink(c, { provider, client, flow, nowMs });
```
Nhánh `signin` phía sau không đổi.

`apps/web/src/views/me/LinkedAccounts.tsx`: thêm `export type LinkNotice = "ok" | "taken" | "hasProvider" | "failed";`, prop `notice?: LinkNotice`, bảng khóa và khối ngay dưới `<h2>`:

```tsx
const NOTICE_KEY = {
  ok: "me.identities.notice.ok",
  taken: "me.identities.notice.taken",
  hasProvider: "me.identities.notice.hasProvider",
  failed: "me.identities.notice.failed",
} as const;
```
```tsx
      {notice ? (
        <p class={notice === "ok" ? "notice good" : "notice"} role={notice === "ok" ? "status" : "alert"}>
          {tr(NOTICE_KEY[notice])}
        </p>
      ) : null}
```
`apps/web/src/routes/me.tsx`: `const notice = (["ok", "taken", "hasProvider", "failed"] as const).find((v) => v === c.req.query("link"));` rồi `<LinkedAccounts locale={locale} identities={identities} linkable={linkable} notice={notice} />`.

- [ ] **Step 4: Sửa test cũ và khóa i18n.** `test/auth/oauth-routes.test.ts`: xóa test "refuses a flow cookie whose intent is link until Task 8 …" (đã thay bằng khối trên); bỏ import hết dùng (`linkSessionHash`, `newFlowCookie`… nếu typecheck báo). Thêm 4 khóa vào 4 file, ngay sau `me.identities.link`.

- [ ] **Step 5: Xanh**

`npm test -w apps/web -- test/auth test/me test/i18n test/architecture.test.ts` → PASS. Kiểm tay: lặp lại Step 9 của 8a-1 (chuỗi đủ chạy ở VNX-2608; với provider giả chỉ tới bước "Continue").

- [ ] **Step 6: Tiêu chí chấp nhận (`LK` = `test/auth/oauth-link.test.ts`)**

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Liên kết đúng user, audit `{ provider }`, 303 `/me?link=ok`, cookie xóa, header | `npm test -w apps/web -- LK -t "links the account to the signed-in user"` |
| 2 | Locale của flow quyết định đích; phiên OAuth giữ method | `-t "locale of the flow"` và `-t "keeps its method"` |
| 3 | Không tạo session, không đăng nhập ai (kể cả chủ tài khoản bị xung đột) | các test trên cộng `-t "taken"` |
| 4 | Xung đột: thông báo chung, không lộ chủ, cùng kết quả cho mọi chủ; `hasProvider` giữ cái cũ | `-t "taken"` và `-t "hasProvider"` |
| 5 | `already_linked` thành công, không audit thứ hai | `-t "same account again"` |
| 6 | Phiên sai hoặc mất: kiểm trước `exchange`, `code` không bị tiêu | `-t "session is not the one that asked"`, `-t "session expired"`, `-t "hash is for another session"` |
| 7 | Provider từ chối, `code` hỏng: về `/me?link=failed`, mã log cố định, không rò | `-t "provider's refusal"` |
| 8 | Không so email provider với `users.email` | `-t "does not look at the e-mail"` |
| 9 | Thông báo `/me` 4 locale, tập đóng, không phản chiếu | `-t "notices for ?link="` |
| 10 | Callback `signin` và mọi lỗi Task 6 không đổi | `npm test -w apps/web -- test/auth/oauth-routes.test.ts` |
| 11 | Parity và ranh giới module | `npm test -w apps/web -- test/i18n/parity.test.ts test/architecture.test.ts` |
| 12 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test` |

(Thay `LK` bằng đường dẫn đầy đủ khi chạy.)

- [ ] **Step 7: Typecheck, toàn bộ test, commit**

```bash
git add apps/web/src/routes/oauth.tsx apps/web/src/routes/me.tsx apps/web/src/views/me/LinkedAccounts.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/auth/oauth-routes.test.ts apps/web/test/auth/oauth-link.test.ts
git commit -m "feat(web): link branch of the OAuth callback with generic conflict notice (VNX-2605a-2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã ≈ 80 dòng (`oauth.tsx` 50, `me.tsx` 3, `LinkedAccounts` 20, bỏ ≈ 8), test ≈ 260 dòng, locale 4 khóa × 4 file. Tổng ≈ 340 không tính locale: không tách.

**Nghĩa vụ cho Task 9:**
- **Móc email:** một lời gọi trong `finishLink`, đúng chỗ chú thích `VNX-2605b`, chỉ khi `linked.ok`; lỗi gửi mail ghi log, không hoàn tác, không đổi `?link=`. Route `unlink` gọi email gỡ liên kết tương tự.
- **Form `POST …/unlink`** vào ô thứ ba của hàng đã liên kết trong `LinkedAccounts`; hàng đã liên kết với cờ tắt vẫn gỡ được. Thông báo sau khi gỡ: mở rộng tập đóng của `?link=` (cập nhật test "unknown value") hoặc tham số riêng.
- **VNX-2608:** thử luồng đủ với tài khoản thật cho ba provider trên Chrome, Firefox, Safari; xác nhận `taken` bằng hai tài khoản VNX.SI.
- **Ghi nhận / kiểm tay VNX-2608 (LOW-3, review):** (a) sau một lượt liên kết xong, Back hai lần tới `start` mà không còn cookie: kết quả là 302 `signin` (đúng thiết kế, flow cookie đã xóa). (b) Nếu provider tự động chấp thuận, lượt `signin` ấy tạo session `oauth_*` mới thay session magic link, nên nhân viên mất quyền vào `/ops` cho tới lần magic link kế tiếp (đúng quyết định 9, nhưng gây bất ngờ; ghi vào "Ghi nhận" của `CURRENT-STATUS.md`). (c) `POST …/link` khi chưa đăng nhập được chuyển tới `/login?next=…`; sau khi đăng nhập `next` là một GET tới đường dẫn POST nên trả 404 (cùng hành vi mọi POST khác sau `requireUser`; không sửa ở đây).
- **Thuật ngữ cho Task 9 (hủy liên kết):** vi "hủy liên kết", zh-Hans 取消关联, zh-Hant 取消連結.

#### Kết quả review Task 8 (Opus, 2026-10-08): APPROVE_WITH_CHANGES (a-1, a-2), đã sửa MEDIUM-1..4, LOW-1..3; câu chữ và hiển thị mục /me do Owner duyệt 2026-10-08

### Task 9: VNX-2605b — Hủy liên kết từ `/me`, email báo liên kết và hủy liên kết

**Phụ thuộc:** Task 8 (a-1 và a-2, đã APPROVE). **Review Focus:** 6 (audit và email 4 locale, không token), 4, 11.

**Mục tiêu.** `POST /me/identities/:provider/unlink` (luôn được phép, kể cả khi cờ của provider tắt); nút "Hủy liên kết" trong ô hành động của hàng đã liên kết; hai email báo (liên kết, hủy liên kết) gửi tới `users.email` của chính chủ, nội dung theo quyết định Owner 2026-10-07: tên provider, `label`, thời điểm UTC, câu "Không phải bạn? …". Không đổi schema, không đổi `db/identities.ts` (hàm `unlinkIdentity` của Task 1 đã ghi audit `auth.identity.unlink` với `{ provider }` cùng batch).

**Quyết định kỹ thuật** (từ code thật; Reviewer kiểm):
1. **Chữ ký thật của Task 1:** `unlinkIdentity(db, { userId, provider, now }) → Promise<UserIdentity | null>`: null và không audit khi user không có identity của provider đó; luôn lọc theo `user_id` nên không bao giờ chạm hàng của người khác. Route chỉ cần phân biệt `null` và khác `null`.
2. **Tên provider lạ → 404** (`isOAuthProvider`, như `POST …/link`); provider hợp lệ nhưng chưa liên kết → 303 `?link=notLinked`, không lỗi, không audit, không email. Unlink không kiểm cờ và không kiểm cấu hình (`enabledProvider` KHÔNG được gọi): magic link luôn còn nên không bao giờ khóa người dùng ngoài.
3. **`already_linked` không gửi email.** Lý do: không có gì thay đổi (không hàng mới, không audit mới); gửi lại cho mỗi lần quay lại từ provider sẽ cho phép ai đó có phiên đang mở bắn email lặp tới chủ hộp thư bằng cách lặp luồng. Email chỉ đi cùng một sự kiện đã audit. (Khớp dòng của Task 8 "already_linked coi như thành công không gửi email".)
4. **Locale của email = `users.locale` của chính chủ** (`SessionUser.locale`, rơi về `en` nếu không phải `Locale`), không phải locale của request: đúng mẫu `notify()` của `routes/admin.tsx` (`userLocale`) và `notify/request.ts` (`party.locale`). Redirect về `/me` thì theo locale của request (người đang xem), như `POST …/link`.
5. **`await` tại chỗ trong try/catch, không `waitUntil`.** Mẫu hiện có: `routes/admin.tsx` `notify()` và `notify/*` đều `await getMailer(env).send` rồi nuốt lỗi; `waitUntil` chỉ có ở `routes/go.ts` (đếm click, cần `ExecutionContext` mà test không có). Chờ gửi xong cho bằng chứng xác định trong test (outbox đầy đủ khi response về) và không thêm đường chạy mới; độ trễ một lần gửi Resend chấp nhận được cho thao tác hiếm này. Lỗi gửi **không hoàn tác** liên kết hay hủy liên kết (đã commit ở D1) và không đổi `?link=` mà người dùng thấy.
6. **Log lỗi gửi là mã cố định:** `{ requestId, event: "identity.mail_failed", kind, provider, code: "notify_failed" }`. Lệch có chủ ý khỏi `notify()` cũ (log `error: String(err)`): lỗi Resend có thể chứa địa chỉ nhận, còn email này mang `label`. Không log địa chỉ, `label`, nội dung hay `err`.
7. **Một module `notify/identity.ts`** (cùng chỗ với `notify/inquiry.ts`, `notify/request.ts`) giữ việc dựng URL, chọn locale, gửi, bắt lỗi; hai nơi gọi (callback `link`, route `unlink`) chỉ một dòng. Template ở `email/templates/identity.ts` theo mẫu `builder-decision.ts` (khóa `t()`, `parts.ts` cho HTML đã escape).
8. **Email không có hành động nào:** không token, `code`, `state`, không link đăng nhập; chỉ một URL trơn tới `/me` (trang cần đăng nhập, GET, không tham số). Thời điểm là chính `now` đã ghi vào audit và `linked_at` (ISO cắt thành `YYYY-MM-DD HH:mm UTC`).
9. **`label` chỉ có trong email gửi chủ** và trong ô `/me` của chủ; không vào audit, URL redirect, log. `label` được `escapeHtml` ở phần HTML.
10. **Thông báo sau hủy:** mở rộng tập đóng `LINK_NOTICES` thêm `unlinked`, `notLinked` (một nguồn duy nhất; `me.tsx` và `LinkedAccounts` đã dùng nó, không sửa chỗ nào khác). Khi người dùng vừa hủy hàng cuối cùng và mọi cờ tắt, `LinkedAccounts` sẽ trả `null` (quyết định Owner 2026-10-08) và thông báo biến mất; sửa nhỏ, Owner duyệt 2026-10-10 và thu hẹp: chỉ khi `notice` là `unlinked` hoặc `notLinked` (không phải `ok`, `failed`, …) mà không còn hàng thì vẫn vẽ `<section id="identities">` chỉ gồm tiêu đề và thông báo (không bảng, không form).
11. **Cỡ:** ≈ 120 dòng mã, ≈ 330 dòng test: dưới 600, không tách.

**Đã chốt (Owner 2026-10-10; không còn câu hỏi mở):** (a) câu "Không phải bạn?" của email hủy liên kết dùng "kiểm tra các tài khoản liên kết ở /me", email liên kết giữ "hủy liên kết ở /me"; (b) mục chỉ-thông-báo chỉ cho `unlinked` và `notLinked` (quyết định kỹ thuật 10); (c) giữ dòng link `/me` trơn trong email. Toàn bộ câu chữ ở bảng dưới được duyệt nguyên văn.

**Files:**
- Create: `apps/web/src/email/templates/identity.ts`, `apps/web/src/notify/identity.ts`, `apps/web/test/email/identity-templates.test.ts`, `apps/web/test/me/identity-unlink.test.ts`.
- Modify: `apps/web/src/routes/me.tsx` (route unlink), `apps/web/src/routes/oauth.tsx` (móc email trong `finishLink`), `apps/web/src/views/me/LinkedAccounts.tsx` (nút, hai thông báo, mục khi chỉ có thông báo), 4 file `apps/web/src/i18n/messages/*.ts`.
- Test (sửa): `apps/web/test/me/identities.test.ts` (ba assertion của 8a-1 nói "unlink là của Task 9"), `apps/web/test/auth/oauth-link.test.ts` (thêm khối email, hai dòng thông báo).

**Interfaces:**
- Consumes: `unlinkIdentity`, `LinkResult` (`db/identities.ts`); `isOAuthProvider`, `PROVIDER_NAME`, `OAuthProvider` (`domain/identity.ts`); `requireUser`; `getMailer` (`email/index.ts`); `FakeMailer`, `outbox`, `clearOutbox` (`email/fake.ts`); `p`, `link`, `wrap` (`email/parts.ts`); `translator`; `isLocale`, `localizedPath`; `NotifyOutcome` (kiểu, `notify/request.ts`); `SessionUser.email/locale`.
- Produces: `identityLinkedEmail(locale, input)`, `identityUnlinkedEmail(locale, input)`, `formatUtc(iso)` (`email/templates/identity.ts`); `notifyIdentityChange(env, input) → Promise<NotifyOutcome>` (`notify/identity.ts`); `LINK_NOTICES` thêm `"unlinked" | "notLinked"`; route `POST /me/identities/:provider/unlink` (4 tiền tố locale).

**Khóa i18n mới (Owner duyệt nguyên văn 2026-10-10, gồm dòng link `/me` trơn; thêm ngay sau `me.identities.notice.failed` của từng file, KHÔNG có chú thích "BẢN NHÁP" trong file locale; `{provider}`, `{label}`, `{time}` là tham số). Dòng `email.identity.account` bị bỏ khỏi email khi `label` bằng tên provider (không lặp "GitHub … Account: GitHub").**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `me.identities.unlink` | Unlink {provider} | Hủy liên kết {provider} | 取消关联 {provider} 账号 | 取消連結 {provider} 帳號 |
| `me.identities.notice.unlinked` | Account unlinked. You can still sign in with an email link. | Đã hủy liên kết tài khoản. Bạn vẫn đăng nhập được bằng link qua email. | 已取消关联该账号。你仍可用邮箱登录。 | 已取消連結該帳號。你仍可用電子郵件登入。 |
| `me.identities.notice.notLinked` | That account wasn't linked, so nothing changed. | Tài khoản đó chưa được liên kết nên không có gì thay đổi. | 该账号并未关联，未作任何更改。 | 該帳號並未連結，未作任何更改。 |
| `email.identityLinked.subject` | {provider} was linked to your VNX.SI account | Đã liên kết {provider} với tài khoản VNX.SI của bạn | {provider} 已关联到你的 VNX.SI 账户 | {provider} 已連結到你的 VNX.SI 帳戶 |
| `email.identityLinked.body` | A {provider} account was linked to your VNX.SI account on {time}. It can now be used to sign in. | Một tài khoản {provider} đã được liên kết với tài khoản VNX.SI của bạn lúc {time}. Từ giờ tài khoản đó dùng được để đăng nhập. | 一个 {provider} 账号已于 {time} 关联到你的 VNX.SI 账户，现在可以用它登录。 | 一個 {provider} 帳號已於 {time} 連結到你的 VNX.SI 帳戶，現在可以用它登入。 |
| `email.identityLinked.notYou` | Not you? Sign in with an email link, unlink it at /me and write to contact@vnx.si. | Không phải bạn? Hãy đăng nhập bằng link qua email, hủy liên kết ở /me và viết cho contact@vnx.si. | 不是你本人操作？请用邮箱登录，在 /me 取消关联，并发邮件至 contact@vnx.si。 | 不是你本人操作？請用電子郵件登入，在 /me 取消連結，並寄信至 contact@vnx.si。 |
| `email.identityUnlinked.subject` | {provider} was unlinked from your VNX.SI account | Đã hủy liên kết {provider} khỏi tài khoản VNX.SI của bạn | {provider} 已从你的 VNX.SI 账户取消关联 | {provider} 已從你的 VNX.SI 帳戶取消連結 |
| `email.identityUnlinked.body` | The {provider} account was unlinked from your VNX.SI account on {time}. It can no longer be used to sign in. | Tài khoản {provider} đã được hủy liên kết khỏi tài khoản VNX.SI của bạn lúc {time}. Tài khoản đó không còn dùng để đăng nhập được nữa. | {provider} 账号已于 {time} 从你的 VNX.SI 账户取消关联，不能再用它登录。 | {provider} 帳號已於 {time} 從你的 VNX.SI 帳戶取消連結，無法再用它登入。 |
| `email.identityUnlinked.notYou` | Not you? Sign in with an email link, check your linked accounts at /me and write to contact@vnx.si. | Không phải bạn? Hãy đăng nhập bằng link qua email, kiểm tra các tài khoản liên kết ở /me và viết cho contact@vnx.si. | 不是你本人操作？请用邮箱登录，在 /me 查看关联账号，并发邮件至 contact@vnx.si。 | 不是你本人操作？請用電子郵件登入，在 /me 查看連結帳號，並寄信至 contact@vnx.si。 |
| `email.identity.account` | Account: {label} | Tài khoản: {label} | 账号：{label} | 帳號：{label} |
| `email.identity.manage` | Your linked accounts: | Tài khoản liên kết của bạn: | 你的关联账号： | 你的連結帳號： |

- [ ] **Step 1: Test template (đỏ).** Tạo `apps/web/test/email/identity-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Locale } from "../../src/i18n/locales.ts";
import { formatUtc, identityLinkedEmail, identityUnlinkedEmail } from "../../src/email/templates/identity.ts";

const AT = "2026-10-09T07:05:33.123Z";
const input = { provider: "github", label: "lan-nguyen", at: AT, manageUrl: "https://vnx.si/me" } as const;
const SUBJECTS: Record<Locale, [string, string]> = {
  en: ["GitHub was linked to your VNX.SI account", "GitHub was unlinked from your VNX.SI account"],
  vi: ["Đã liên kết GitHub với tài khoản VNX.SI của bạn", "Đã hủy liên kết GitHub khỏi tài khoản VNX.SI của bạn"],
  "zh-Hans": ["GitHub 已关联到你的 VNX.SI 账户", "GitHub 已从你的 VNX.SI 账户取消关联"],
  "zh-Hant": ["GitHub 已連結到你的 VNX.SI 帳戶", "GitHub 已從你的 VNX.SI 帳戶取消連結"],
};
const UNLINK_WORD: Record<Locale, string> = { en: "unlink", vi: "hủy liên kết", "zh-Hans": "取消关联", "zh-Hant": "取消連結" };

describe("formatUtc", () => {
  it("is the ISO instant to the minute, in UTC", () => {
    expect(formatUtc(AT)).toBe("2026-10-09 07:05 UTC");
  });
});

describe("identity e-mails (VNX-2605b)", () => {
  for (const [locale, [linked, unlinked]] of Object.entries(SUBJECTS) as Array<[Locale, [string, string]]>) {
    it(`${locale}: subject, provider, label, UTC time, the Not-you line and contact@vnx.si`, () => {
      const a = identityLinkedEmail(locale, input);
      const b = identityUnlinkedEmail(locale, input);
      expect(a.subject).toBe(linked);
      expect(b.subject).toBe(unlinked);
      for (const mail of [a, b]) {
        expect(mail.text).toContain("GitHub");
        expect(mail.text).toContain("lan-nguyen");
        expect(mail.text).toContain("2026-10-09 07:05 UTC");
        expect(mail.text).toContain("contact@vnx.si");
        expect(mail.text).toContain("/me");
        expect(mail.html).toContain(`lang="${locale}"`);
        expect(mail.html).toContain("contact@vnx.si");
      }
      expect(a.text.toLowerCase()).toContain(UNLINK_WORD[locale]); // the linked mail tells the owner how to undo it
    });
  }

  it("leaves out the Account line when the label is just the provider name", () => {
    const mail = identityLinkedEmail("en", { ...input, label: "GitHub" });
    expect(mail.text).not.toContain("Account:");
    expect(mail.html).not.toContain("Account:");
    expect(identityLinkedEmail("en", input).text).toContain("Account: lan-nguyen");
  });

  it("escapes the label in html and keeps it verbatim in text", () => {
    const mail = identityLinkedEmail("en", { ...input, label: '<script>x</script>"&' });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;x&lt;/script&gt;&quot;&amp;");
    expect(mail.text).toContain('<script>x</script>"&');
  });

  it("carries no action: the only URL is the plain /me link, with no query or fragment", () => {
    for (const mail of [identityLinkedEmail("vi", input), identityUnlinkedEmail("zh-Hant", input)]) {
      const urls = `${mail.text} ${mail.html}`.match(/https?:\/\/[^\s"<]+/g) ?? [];
      expect([...new Set(urls)]).toEqual(["https://vnx.si/me"]);
      expect(`${mail.text}${mail.html}`).not.toMatch(/[?&]t=|token|code=|state=|verify/i);
    }
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ.** `npm test -w apps/web -- test/email/identity-templates.test.ts` → FAIL (không tìm thấy module `email/templates/identity.ts`).

- [ ] **Step 3: Khóa i18n, template, `notify/identity.ts`.** Thêm 11 khóa ở bảng trên vào `en.ts`, `vi.ts`, `zh-hans.ts`, `zh-hant.ts`. `apps/web/src/email/templates/identity.ts`:

```ts
import { type OAuthProvider, PROVIDER_NAME } from "../../domain/identity.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { link, p, wrap } from "../parts.ts";

export interface IdentityEmailInput {
  provider: OAuthProvider;
  /** E-mail or login of the provider account. Goes only to the account's owner. */
  label: string;
  /** ISO instant of the audited change. */
  at: string;
  /** Absolute, plain (no query): the owner's /me. */
  manageUrl: string;
}

/** `2026-10-09T07:05:33.123Z` → `2026-10-09 07:05 UTC`. */
export const formatUtc = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

const KEYS = {
  linked: { subject: "email.identityLinked.subject", body: "email.identityLinked.body", notYou: "email.identityLinked.notYou" },
  unlinked: { subject: "email.identityUnlinked.subject", body: "email.identityUnlinked.body", notYou: "email.identityUnlinked.notYou" },
} as const;

function compose(kind: keyof typeof KEYS, locale: Locale, input: IdentityEmailInput) {
  const tr = translator(locale);
  const k = KEYS[kind];
  const provider = PROVIDER_NAME[input.provider];
  const body = tr(k.body, { provider, time: formatUtc(input.at) });
  // The label repeats the provider name when the provider gave no e-mail (decision 12): then the line says nothing.
  const account = input.label === provider ? null : tr("email.identity.account", { label: input.label });
  const notYou = tr(k.notYou);
  const manage = tr("email.identity.manage");
  return {
    subject: tr(k.subject, { provider }),
    text: [body, ...(account ? [account] : []), "", notYou, "", manage, input.manageUrl].join("\n"),
    html: wrap(locale, [p(body), ...(account ? [p(account)] : []), p(notYou), p(manage), link(input.manageUrl)]),
  };
}

export const identityLinkedEmail = (locale: Locale, input: IdentityEmailInput) => compose("linked", locale, input);
export const identityUnlinkedEmail = (locale: Locale, input: IdentityEmailInput) => compose("unlinked", locale, input);
```
`apps/web/src/notify/identity.ts`:

```ts
import type { OAuthProvider } from "../domain/identity.ts";
import { getMailer } from "../email/index.ts";
import { identityLinkedEmail, identityUnlinkedEmail } from "../email/templates/identity.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import type { NotifyOutcome } from "./request.ts";

export interface IdentityChange {
  kind: "linked" | "unlinked";
  /** `users.email` of the account owner: the only address these e-mails ever go to. */
  to: string;
  /** `users.locale`. */
  locale: string;
  provider: OAuthProvider;
  label: string;
  at: string;
  requestId?: string;
}

/**
 * Tells the owner that a sign-in account was linked or unlinked (ADR-012 §4, Owner 2026-10-07). Awaited by the caller, never throws:
 * the change is already committed, so a failed send is one log line with fixed words (no address, no label, no error text) and "failed".
 */
export async function notifyIdentityChange(env: Bindings, change: IdentityChange): Promise<NotifyOutcome> {
  try {
    const locale = isLocale(change.locale) ? change.locale : "en";
    const manageUrl = new URL(localizedPath(locale, "/me"), env.APP_ORIGIN).toString();
    const build = change.kind === "linked" ? identityLinkedEmail : identityUnlinkedEmail;
    await getMailer(env).send({ to: change.to, ...build(locale, { provider: change.provider, label: change.label, at: change.at, manageUrl }) });
    return "sent";
  } catch {
    console.error(JSON.stringify({ requestId: change.requestId, event: "identity.mail_failed", kind: change.kind, provider: change.provider, code: "notify_failed" }));
    return "failed";
  }
}
```
Chạy lại Step 1 → PASS; `npm test -w apps/web -- test/i18n` → PASS (parity).

- [ ] **Step 4: Test route, nút, email (đỏ).** Tạo `apps/web/test/me/identity-unlink.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import { formatUtc } from "../../src/email/templates/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { enableProvider, linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`; // per-test addresses: no global counts, D1 is shared
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const rowsOf = (userId: string, provider: string) => n("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1 AND provider = ?2", userId, provider);
const audits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink' ORDER BY id").bind(userId).all<{ data: string }>()).results.map((r) => r.data);
const mailTo = (address: string) => outbox.filter((m) => m.to === address);
const unlink = (provider: string, cookie: string, path = `/me/identities/${provider}/unlink`, headers: Record<string, string> = {}, env: Bindings = testEnv) =>
  createApp().request(formPost(path, {}, { cookie, ...headers }), undefined, env);
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;

const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  clearOutbox();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  spies.splice(0).forEach((s) => s.mockRestore());
  vi.restoreAllMocks();
});
const logged = () => spies.flatMap((s) => s.mock.calls).map((args) => args.map(String).join(" "));

describe("POST /me/identities/:provider/unlink (VNX-2605b)", () => {
  it("removes the row, audits {provider} only, mails the owner once, and 303s to /me with the notice", async () => {
    const email = emailOf("lan");
    const label = `l-${tag()}@gmail.example`; // e-mail-shaped, as Google and LinkedIn labels are
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    const res = await unlink("github", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await rowsOf(user.id, "github")).toBe(0);
    expect(await audits(user.id)).toEqual(['{"provider":"github"}']);
    const mails = mailTo(email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.to).toBe(email);
    expect(mails[0]?.subject).toBe("GitHub was unlinked from your VNX.SI account");
    expect(mails[0]?.text).toContain("GitHub");
    expect(mails[0]?.text).toContain(label);
    const audit = await testEnv.DB.prepare("SELECT created_at FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink'").bind(user.id).first<{ created_at: string }>();
    expect(mails[0]?.text).toContain(formatUtc(audit?.created_at ?? "")); // the audited instant, in UTC
    expect(mails[0]?.text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
    expect(mails[0]?.text).toContain("contact@vnx.si");
    expect(outbox).toHaveLength(1); // never to the label or anyone else
    expect(res.headers.get("location")).not.toContain(label);
  });

  it("the e-mail is in users.locale, not in the request locale; the redirect follows the request", async () => {
    const email = emailOf("lan");
    const { cookie } = await signIn(email, { locale: "vi" }); // first: `linkedUser` reuses this user, and `ensureUser` alone would make it "en"
    await linkedUser(email, "google", { subject: `sub-${tag()}`, label: `g-${tag()}@gmail.example` });
    const res = await unlink("google", cookie, "/zh-hant/me/identities/google/unlink");
    expect(res.headers.get("location")).toBe("/zh-hant/me?link=unlinked");
    expect(mailTo(email)).toHaveLength(1);
    expect(mailTo(email)[0]?.subject).toBe("Đã hủy liên kết Google khỏi tài khoản VNX.SI của bạn");
  });

  it("works whether the provider's flag is off, on, or its credentials are missing", async () => {
    for (const mode of ["off", "on", "unconfigured"] as const) {
      if (mode === "on") {
        await enableProvider("github");
        resetFlagCache();
      }
      const email = emailOf(`lan-${mode}`);
      const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
      const { cookie } = await signIn(email);
      const res = await unlink("github", cookie, undefined, {}, mode === "unconfigured" ? withoutCredentials : testEnv);
      expect(res.headers.get("location"), mode).toBe("/me?link=unlinked");
      expect(await rowsOf(user.id, "github"), mode).toBe(0);
      expect(mailTo(email), mode).toHaveLength(1);
    }
  });

  it("a provider the user has not linked: notLinked, nothing changes, no audit, no e-mail; the other provider stays", async () => {
    const lan = emailOf("lan");
    const { user } = await linkedUser(lan, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(lan);
    const res = await unlink("linkedin", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await rowsOf(user.id, "github")).toBe(1);
    expect(await audits(user.id)).toEqual([]);
    expect(mailTo(lan)).toHaveLength(0);
  });

  it("never touches another user's row: B posting unlink for a provider only A holds changes nothing", async () => {
    const a = emailOf("a");
    const b = emailOf("b");
    const { user: userA } = await linkedUser(a, "github", { subject: `sub-${tag()}`, label: `a-${tag()}` });
    const { user: userB } = await linkedUser(b, "google", { subject: `sub-${tag()}`, label: `b-${tag()}@gmail.example` });
    const { cookie } = await signIn(b);
    const res = await unlink("github", cookie);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await rowsOf(userA.id, "github")).toBe(1);
    expect(await rowsOf(userB.id, "google")).toBe(1);
    expect(await audits(userA.id)).toEqual([]);
    expect(await audits(userB.id)).toEqual([]);
    expect(mailTo(a)).toHaveLength(0);
    expect(mailTo(b)).toHaveLength(0);
  });

  it("a second press is notLinked: one audit row, one e-mail", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    expect((await unlink("github", cookie)).headers.get("location")).toBe("/me?link=unlinked");
    expect((await unlink("github", cookie)).headers.get("location")).toBe("/me?link=notLinked");
    expect(await audits(user.id)).toHaveLength(1);
    expect(mailTo(email)).toHaveLength(1);
  });

  it("refuses a missing or foreign Origin (403) and changes nothing", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }]) expect((await unlink("github", cookie, undefined, headers)).status).toBe(403);
    const noOrigin = new Request("https://vnx.si/me/identities/github/unlink", { method: "POST", headers: { cookie } });
    expect((await createApp().request(noOrigin, undefined, testEnv)).status).toBe(403);
    expect(await rowsOf(user.id, "github")).toBe(1);
    expect(mailTo(email)).toHaveLength(0);
  });

  it("signed out goes to /login and changes nothing", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(await rowsOf(user.id, "github")).toBe(1);
  });

  it("an unknown provider is 404; the body limit is 64 KB; the redirect never leaves the site", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    expect((await unlink("facebook", cookie)).status).toBe(404);
    const big = new Request("https://vnx.si/me/identities/github/unlink", {
      method: "POST",
      headers: { origin: "https://vnx.si", cookie, "content-type": "application/x-www-form-urlencoded" },
      body: `x=${"a".repeat(70 * 1024)}`,
    });
    expect((await createApp().request(big, undefined, testEnv)).status).toBe(413);
    const res = await unlink("github", cookie, "/me/identities/github/unlink?next=https://evil.example&redirect=//evil.example");
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
  });

  it("a failing mailer keeps the unlink and logs one fixed code: no address, label, error text or secret", async () => {
    const email = emailOf("lan");
    const label = `secret-label-${tag()}`;
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error(`boom to ${email} ${label} token=SECRET`)); // restored by afterEach
    const res = await unlink("github", cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await rowsOf(user.id, "github")).toBe(0);
    expect(await audits(user.id)).toHaveLength(1);
    const lines = logged();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ event: "identity.mail_failed", kind: "unlinked", provider: "github", code: "notify_failed" });
    for (const secret of [email, label, "boom", "SECRET"]) expect(lines[0]).not.toContain(secret);
  });

  it("the e-mail carries no session id, code or action link; its only URL is the plain /me", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    const { cookie } = await signIn(email);
    await unlink("linkedin", cookie);
    const mail = mailTo(email)[0];
    const body = `${mail?.text}\n${mail?.html}`;
    expect(body).not.toContain(cookie.split("=")[1] ?? "x");
    expect(body).not.toMatch(/[?&]t=|token=|code=|state=|\/auth\//i);
    expect([...new Set(body.match(/https?:\/\/[^\s"<]+/g) ?? [])]).toEqual([`${testEnv.APP_ORIGIN}/me`]);
  });
});

describe("the Unlink button on /me (VNX-2605b)", () => {
  const meHtml = async (path: string, cookie: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
  const section = (html: string) => html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";

  it("a linked row has a post form to unlink in every locale, even with the flag off; an unlinked row has none", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    const cases: Array<[string, string, string]> = [
      ["/me", "/me/identities/github/unlink", "Unlink GitHub"],
      ["/vi/me", "/vi/me/identities/github/unlink", "Hủy liên kết GitHub"],
      ["/zh-hans/me", "/zh-hans/me/identities/github/unlink", "取消关联 GitHub 账号"],
      ["/zh-hant/me", "/zh-hant/me/identities/github/unlink", "取消連結 GitHub 帳號"],
    ];
    for (const [path, action, text] of cases) {
      const html = section(await meHtml(path, cookie));
      expect(html, path).toContain(`<form method="post" action="${action}">`);
      expect(html, path).toContain(text);
      expect(html, path).not.toContain('/link"'); // flags are off: nothing is linkable
    }
    await enableProvider("google");
    resetFlagCache();
    const rows = section(await meHtml("/me", cookie)).match(/<tr>.*?<\/tr>/gs) ?? [];
    const google = rows.find((r) => r.includes("Google")) ?? "";
    expect(google).toContain("/me/identities/google/link");
    expect(google).not.toContain("unlink");
  });

  it("with no rows and every flag off, ?link=ok and ?link=failed render no section at all", async () => {
    const { cookie } = await signIn(emailOf("lan"));
    for (const value of ["ok", "failed"]) expect(await meHtml(`/me?link=${value}`, cookie), value).not.toContain('id="identities"');
    const html = await meHtml("/me?link=notLinked", cookie);
    expect(section(html)).toContain("That account wasn't linked, so nothing changed.");
    expect(section(html)).toContain('role="status"');
  });

  it("after the last row is unlinked with every flag off, the notice is still shown (no rows, no form)", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    const res = await unlink("github", cookie);
    const html = section(await meHtml(res.headers.get("location") ?? "/me", cookie));
    expect(html).toContain("Account unlinked. You can still sign in with an email link.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<tr>");
    expect(await meHtml("/me", cookie)).not.toContain('id="identities"');
  });
});
```
Sửa `apps/web/test/me/identities.test.ts` (ba chỗ của 8a-1 chốt "unlink là của Task 9"): (1) test "every flag off and one linked account": đổi `expect(sectionOf(html)).not.toContain("<form")` thành `expect(sectionOf(html)).toContain('action="/me/identities/google/unlink"'); expect(sectionOf(html)).not.toContain('/link"');`; (2) test "a linked provider whose flag is off stays visible…": đổi `expect(rows[1]).not.toContain("<form")` thành `expect(rows[1]).toContain("/me/identities/linkedin/unlink")`; (3) test "a label equal to the provider name…": bỏ ý "unlink là của Task 9" khỏi tên, thay `expect((rowsOf(html)[0] ?? "").match(/LinkedIn/g)).toHaveLength(1)` bằng `expect(rowsOf(html)[0]).not.toContain('class="muted"')` và bỏ dòng `not.toContain("unlink")`. Thêm hai dòng vào `it.each` của "/me notices for ?link=" trong `test/auth/oauth-link.test.ts`: `["/me", "unlinked", "Account unlinked. You can still sign in with an email link."]`, `["/vi/me", "notLinked", "Tài khoản đó chưa được liên kết nên không có gì thay đổi."]`.

- [ ] **Step 5: Chạy, thấy đỏ.** `npm test -w apps/web -- test/me/identity-unlink.test.ts test/me/identities.test.ts` → FAIL (route chưa có: 404; nút chưa có).

- [ ] **Step 6: Cài đặt `LinkedAccounts`, route (xanh).**

`apps/web/src/views/me/LinkedAccounts.tsx`: đổi tập thông báo và bảng khóa:

```tsx
export const LINK_NOTICES = ["ok", "taken", "hasProvider", "failed", "unlinked", "notLinked"] as const;
const NOTICE_KEY = {
  ok: "me.identities.notice.ok",
  taken: "me.identities.notice.taken",
  hasProvider: "me.identities.notice.hasProvider",
  failed: "me.identities.notice.failed",
  unlinked: "me.identities.notice.unlinked",
  notLinked: "me.identities.notice.notLinked",
} as const;
const STATUS: readonly LinkNotice[] = ["ok", "unlinked", "notLinked"]; // told, not warned: only failed, taken, hasProvider are alerts
```
Cập nhật docstring (bỏ câu "Unlink is VNX-2605b…"). Thân component: `if (rows.length === 0 && notice !== "unlinked" && notice !== "notLinked") return null;` (Owner 2026-10-10: chỉ hai thông báo của unlink mới giữ mục khi không còn hàng); khối thông báo: `class={notice === "ok" ? "notice good" : "notice"}` và `role={STATUS.includes(notice) ? "status" : "alert"}` (`unlinked`, `notLinked` là `role="status"` với `class="notice"` trơn); bọc `<p class="muted">{intro}</p>` và `<div class="table-wrap">…</div>` trong `{rows.length > 0 ? (<>…</>) : null}`; ô thứ ba của hàng:

```tsx
                  <td>
                    {linked ? (
                      <form method="post" action={localizedPath(locale, `/me/identities/${provider}/unlink`)}>
                        <button class="btn btn-ghost" type="submit">
                          {tr("me.identities.unlink", { provider: name })}
                        </button>
                      </form>
                    ) : linkable.includes(provider) ? (
                      <form method="post" action={localizedPath(locale, `/me/identities/${provider}/link`)}>
                        <button class="btn btn-ghost" type="submit">
                          {tr("me.identities.link", { provider: name })}
                        </button>
                      </form>
                    ) : null}
                  </td>
```
`apps/web/src/routes/me.tsx`: thêm `unlinkIdentity` vào dòng import `../db/identities.ts`, import `isOAuthProvider` từ `../domain/identity.ts` và `notifyIdentityChange` từ `../notify/identity.ts`; đặt ngay sau route `…/link`:

```ts
  // ADR-012 §4: unlink is always allowed, flag on or off, configured or not (the e-mail link always remains). A POST that answers
  // 303 to the same site only. `unlinkIdentity` filters by this user, audits `{ provider }` in its batch, and returns null (no audit) when nothing was linked.
  onLocalized(app, "post", "/me/identities/:provider/unlink", requireUser, async (c) => {
    const provider = c.req.param("provider");
    if (!isOAuthProvider(provider)) return errorResponse(c, "notFound", 404);
    const user = c.get("user")!;
    const now = new Date().toISOString();
    const removed = await unlinkIdentity(c.env.DB, { userId: user.id, provider, now });
    if (removed) await notifyIdentityChange(c.env, { kind: "unlinked", to: user.email, locale: user.locale, provider, label: removed.label, at: now, requestId: c.get("requestId") });
    return c.redirect(`${localizedPath(c.get("locale"), "/me")}?link=${removed ? "unlinked" : "notLinked"}`, 303);
  });
```
Chạy lại Step 5 → PASS.

- [ ] **Step 7: Test email báo liên kết (đỏ).** Trong `apps/web/test/auth/oauth-link.test.ts`: import thêm `clearOutbox, FakeMailer, outbox` (`../../src/email/fake.ts`) và `formatUtc` (`../../src/email/templates/identity.ts`); trong `beforeEach` hiện có thêm `clearOutbox();`; thêm cuối file (dùng lại `comeBack`, `loggedCodes`, `logged`, `expectBack`, `identitiesOf`, `linkAudits`, `emailOf`, `identityOf`; nếu `logged` chưa export trong file thì nó đã là hàm cục bộ cùng file):

```ts
describe("the 'account linked' e-mail (VNX-2605b)", () => {
  const mailTo = (address: string) => outbox.filter((m) => m.to === address);

  it("a new link sends exactly one e-mail, to users.email, with provider, label and the audited UTC time", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { user, cookie } = await signIn(email);
    const identity = { subject: `sub-${tag()}`, label: `l-${tag()}@gmail.example` }; // e-mail-shaped label
    const { res } = await comeBack("github", cookie, identity);
    expectBack(res, "/me?link=ok");
    const mails = mailTo(email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.to).toBe(email);
    expect(outbox).toHaveLength(1); // nothing to the label or anyone else
    expect(mails[0]?.subject).toBe("GitHub was linked to your VNX.SI account");
    expect(mails[0]?.text).toContain(identity.label);
    const row = await testEnv.DB.prepare("SELECT linked_at FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ linked_at: string }>();
    expect(mails[0]?.text).toContain(formatUtc(row?.linked_at ?? ""));
    expect(mails[0]?.text).toContain("contact@vnx.si");
  });

  it("is in users.locale", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { cookie } = await signIn(email, { locale: "zh-Hant" });
    await comeBack("github", cookie, identityOf(), "/vi");
    expect(mailTo(email)[0]?.subject).toBe("GitHub 已連結到你的 VNX.SI 帳戶");
  });

  it("the same account again sends nothing (already_linked changes nothing)", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { cookie } = await signIn(email);
    const identity = identityOf();
    await comeBack("github", cookie, identity);
    await comeBack("github", cookie, identity);
    expect(mailTo(email)).toHaveLength(1);
  });

  it("a conflict ('taken', 'hasProvider') sends nothing to anyone", async () => {
    await enableProvider("github");
    const shared = identityOf();
    await linkedUser(emailOf("holder"), "github", shared);
    const { cookie } = await signIn(emailOf("lan"));
    expectBack((await comeBack("github", cookie, shared)).res, "/me?link=taken");
    const mine = emailOf("mine");
    await linkedUser(mine, "github", identityOf());
    const { cookie: mineCookie } = await signIn(mine);
    expectBack((await comeBack("github", mineCookie, identityOf())).res, "/me?link=hasProvider");
    expect(outbox).toHaveLength(0);
  });

  it("a failing mailer keeps the link and the audit; one fixed log code, nothing else", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { user, cookie } = await signIn(email);
    const identity = identityOf();
    const send = vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error(`boom ${email} ${identity.label} token=SECRET`));
    const { res } = await comeBack("github", cookie, identity);
    send.mockRestore(); // only this spy: `vi.restoreAllMocks()` would also drop the console spies the log assertions need
    expectBack(res, "/me?link=ok");
    expect(await identitiesOf(user.id)).toBe(1);
    expect(await linkAudits(user.id)).toBe(1);
    expect(loggedCodes()).toEqual(["notify_failed"]);
    for (const line of logged()) for (const secret of [email, identity.label, "boom", "SECRET"]) expect(line).not.toContain(secret);
  });

  it("carries no state, verifier, nonce, code or session id, and no action link", async () => {
    await enableProvider("github");
    const email = emailOf("lan");
    const { cookie } = await signIn(email);
    const { link, code } = await comeBack("github", cookie, identityOf());
    const mail = mailTo(email)[0];
    const body = `${mail?.text}\n${mail?.html}`;
    for (const secret of [link.flow?.state, link.flow?.verifier, link.flow?.nonce, code, cookie.split("=")[1]]) expect(body).not.toContain(secret ?? "x");
    expect(body).not.toMatch(/[?&]t=|token=|code=|state=|\/auth\//i);
    expect([...new Set(body.match(/https?:\/\/[^\s"<]+/g) ?? [])]).toEqual([`${testEnv.APP_ORIGIN}/me`]);
  });
});
```
Trong `apps/web/test/auth/oauth-link.test.ts` cần thêm hàm cục bộ `const logged = () => …` nếu chưa có (file đã có `loggedCodes` dựng từ `spies`; xuất `logged` bằng cách tách dòng `spies.flatMap(...)` thành hàm `logged` rồi `loggedCodes` gọi nó). Trong `identity-unlink.test.ts` `afterEach` gọi `vi.restoreAllMocks()` sau khi đã `mockRestore` các spy console.

Chạy `npm test -w apps/web -- test/auth/oauth-link.test.ts` → FAIL ở "sends exactly one", "is in users.locale", "failing mailer" (chưa có email); các test "sends nothing" đã xanh, đúng.

- [ ] **Step 8: Móc email trong `finishLink` (xanh).** `apps/web/src/routes/oauth.tsx`: import `notifyIdentityChange` từ `../notify/identity.ts` (không import thêm gì từ `db/`). Thay dòng chú thích `VNX-2605b` và dòng `if (linked.ok || …)` ngay sau `linkIdentity` bằng:

```ts
  // Only a real new link is told to the owner (not `already_linked`: nothing changed, and a replayed callback must not mail). The send never undoes the link.
  if (linked.ok) await notifyIdentityChange(c.env, { kind: "linked", to: user.email, locale: user.locale, provider, label: linked.identity.label, at: linked.identity.linkedAt, requestId: c.get("requestId") });
  if (linked.ok || linked.reason === "already_linked") return backToMe(c, flow.locale, "ok");
```
Chạy lại Step 7 → PASS.

- [ ] **Step 9: Tiêu chí chấp nhận.** (`UN` = `apps/web/test/me/identity-unlink.test.ts`, `LK` = `apps/web/test/auth/oauth-link.test.ts`; chạy `npm test -w apps/web -- <đường dẫn> -t "<tên>"`)

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Hủy: hàng mất, audit `{provider}` duy nhất, một email tới đúng `users.email` có provider + `label` + giờ UTC, 303 `/me?link=unlinked` | `UN -t "removes the row"` |
| 2 | Email theo `users.locale`; redirect theo locale của request | `UN -t "users.locale"` |
| 3 | Cờ tắt, bật, thiếu cấu hình: vẫn hủy được | `UN -t "works whether"` |
| 4 | Chưa liên kết, hoặc hàng của người khác: không đổi gì, không audit, không email, không lỗi to | `UN -t "has not linked"` và `UN -t "never touches another user"` |
| 5 | Bấm hai lần: một audit, một email | `UN -t "second press"` |
| 6 | Origin ngoài 403; chưa đăng nhập về `/login`; 404 tên lạ; 413; không redirect ra ngoài | `UN -t "foreign Origin"`, `UN -t "signed out"`, `UN -t "unknown provider"` |
| 7 | Lỗi gửi mail không hoàn tác, log đúng một mã cố định, không địa chỉ/label/lỗi (hủy và liên kết) | `UN -t "failing mailer"` và `LK -t "failing mailer"` |
| 8 | Email liên kết: đúng một lần khi liên kết mới, không gửi khi `already_linked` hay xung đột | `LK -t "account linked"` |
| 9 | Không token/`code`/`state`/session trong email nào; URL duy nhất là `/me` trơn | `UN -t "carries no session id"`, `LK -t "no state"`, `npm test -w apps/web -- test/email/identity-templates.test.ts` |
| 10 | Nút hủy 4 locale, kể cả cờ tắt; thông báo vẫn hiện sau hủy hàng cuối | `UN -t "Unlink button"` |
| 11 | 4 locale đủ khóa | `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 12 | Ranh giới module (`me.tsx`, `oauth.tsx` đã trong allowlist; `notify/identity.ts` và template không import `db/identities`) | `npm test -w apps/web -- test/architecture.test.ts` |
| 13 | Không hồi quy Task 8 | `npm test -w apps/web -- test/me test/auth` |
| 14 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test` |

- [ ] **Step 10: Typecheck, toàn bộ test, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/email/templates/identity.ts apps/web/src/notify/identity.ts apps/web/src/routes/me.tsx apps/web/src/routes/oauth.tsx apps/web/src/views/me/LinkedAccounts.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/email/identity-templates.test.ts apps/web/test/me/identity-unlink.test.ts apps/web/test/me/identities.test.ts apps/web/test/auth/oauth-link.test.ts
git commit -m "feat(web): unlink a linked account from /me and e-mail the owner on link and unlink (VNX-2605b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã ≈ 120 dòng (template 40, notify 30, route 12, `LinkedAccounts` 25, `oauth.tsx` 4, `me.tsx` imports 4), test ≈ 330 dòng (templates 50, unlink 190, link-mail 80, sửa cũ 10), locale 11 khóa × 4 file. Dưới 600 không tính locale: không tách.

**Nghĩa vụ cho task sau:**
- **Task 12 (VNX-2607):** câu Privacy "We email you whenever an account is linked to or unlinked from yours" nay đúng với code (hai email, tới `users.email`, chứa `label`); đối chiếu khi chép: email không chứa token và không gửi cho `already_linked`.
- **VNX-2608:** thử bằng provider thật: email tới hộp thư thật cho cả hai sự kiện, đúng giờ UTC, hiển thị ổn ở Gmail; xác nhận Resend không từ chối `label` lạ (GitHub login, email).
- **VNX-2605c (bắt buộc trước VNX-2608, Owner 2026-10-10):** hủy liên kết hiện không kết thúc session `oauth_<provider>` đang sống; kẻ đã liên kết tài khoản của mình rồi đăng nhập bằng nó vẫn giữ phiên tới 30 ngày sau khi bị hủy liên kết. Task 9 giữ nguyên phạm vi; khoảng hở này ghi ở đây và xử lý ở VNX-2605c.
- **Ghi nhận:** lỗi gửi mail chỉ có một dòng log, không có hàng đợi gửi lại (như M6: "không có cột retry"); nếu Owner muốn bảo đảm giao, đó là task riêng.

#### Kết quả review Task 9 (Opus, 2026-10-10): APPROVE_WITH_CHANGES, đã sửa MEDIUM-1, MEDIUM-2, LOW-1..3, S1, S2; câu chữ và các quyết định do Owner duyệt 2026-10-10

---

### Task 10: VNX-2606a — Công tắc `show_on_profile` ở `/hub/profile`

**Phụ thuộc:** Task 1 (cột `user_identities.show_on_profile`, `listIdentitiesForUser`, `IDENTITY_AUDIT`, `AuditIdentityGuard`), Task 8-9 (hàng đã liên kết có thật). **Review Focus:** 8 (một nửa: bật/tắt; nửa còn lại là Task 11), 6 (audit `{provider}`), 11.

**Mục tiêu.** Builder tự bật hoặc tắt việc hiện tài khoản GitHub hoặc LinkedIn **đã liên kết** của mình trên trang công khai. Task này chỉ ghi cờ; **không có gì hiện công khai** (huy hiệu là Task 11). Công tắc hiện với mọi builder có identity GitHub hoặc LinkedIn, kể cả chưa `approved` (header, câu hỏi mở đã chốt (b)): lúc đó có dòng nói "chưa hiện công khai cho tới khi hồ sơ được duyệt". Không có công tắc cho Google. Hủy liên kết xóa hàng nên công tắc biến mất cùng nó (không cần code, có test).

**Quyết định kỹ thuật** (từ code thật; Reviewer kiểm):
1. **POST riêng, không dùng `POST /hub/profile`:** `POST /hub/identities/:provider/badge`, thân `show=1|0`, mỗi provider một form nhỏ. Lý do: `POST /hub/profile` bị `canEditProfile(status)` chặn (builder `suspended` nhận 409) và validate cả form hồ sơ; công tắc không liên quan cả hai, và một form một provider tránh "lưu cả hồ sơ" khi chỉ muốn đổi huy hiệu. Không dùng JS: mỗi form là một nút gửi (CSP không script nội tuyến).
2. **Cổng:** `requireBuilder` (có session, có hàng `builders`, mọi `status`), `originCheck` toàn cục (403 khi Origin sai hoặc thiếu) và `requestBodyLimit` 64 KB toàn cục (`app.ts`); không thêm middleware. `:provider` phải là `github` hoặc `linkedin` (`isBadgeProvider`); `google` và tên lạ → 404 (Google không bao giờ có công tắc, kể cả khi ai đó POST thẳng). `show` ngoài `"1"`/`"0"` → 409 `conflict` (`ErrorKind` không có `badRequest`; không đoán giá trị).
3. **Chỉ ghi hàng của chính builder:** `setShowOnProfile(db, { userId, provider, show, now })` lọc `user_id` và `provider`; `userId` luôn là `c.get("builder").userId`, không bao giờ từ thân hay URL (URL không có id hàng nên không có IDOR). Hàm nằm trong `db/identities.ts`, nơi duy nhất ghi `user_identities`.
4. **Audit: CÓ, chỉ `{ provider }`.** Lý do: đây là quyết định làm lộ dữ liệu ra công khai (GitHub login, hay sự thật "có LinkedIn"), cùng loại với link/unlink đã audit, và giúp trả lời "huy hiệu này bật từ khi nào" khi có khiếu nại. Hai action `auth.identity.badge_show` và `auth.identity.badge_hide` (thêm vào `IDENTITY_AUDIT`), `entity = "user"`, `entityId = userId`, cùng `db.batch` với UPDATE, guard `AuditIdentityGuard` đã có (audit chỉ ghi khi hàng còn tồn tại cho user đó). Không ghi `label`, không ghi giá trị cũ (action đã nói giá trị mới). Đặt lại đúng giá trị hiện có (`unchanged`) **không ghi gì**: đọc trước, trả về mà không chạm DB. Hai request song song đúng cùng lúc có thể ghi hai dòng audit cho một thay đổi (UPDATE thứ hai không khớp hàng nhưng guard "hàng tồn tại" vẫn đúng); chấp nhận, dữ liệu không sai.
5. **Không email báo** (khác link/unlink: không đổi quyền đăng nhập; chính builder bấm nút). Không đổi `/me`.
6. **Hiển thị:** `ProfilePage` nhận `badges: BadgeRow[]` (`Pick<UserIdentity, "provider" | "label" | "showOnProfile">`, chỉ github/linkedin, đã lọc ở route) và `badgeNotice`. Mục `<section id="badges">` nằm dưới form hồ sơ, hiện kể cả khi `canEditProfile` sai (builder `suspended` vẫn thấy và chỉnh được; không có tác dụng công khai vì `findPublicBuilderByHandle` lọc `approved`). Không có hàng nào → không có mục. GitHub: nói khách sẽ thấy `@{label}` kèm link; LinkedIn: khách chỉ thấy nhãn đã xác minh, không tên, không email, không link (`label` LinkedIn thường là email nên KHÔNG in ra ở đây).
7. **`GET /hub/profile?badge=shown|hidden|notLinked`** là thông báo sau POST (tập đóng `BADGE_NOTICES`, giá trị lạ bị bỏ qua), cùng kiểu `?link=` của `/me`; `Location` kết thúc bằng `#badges` để trình duyệt cuộn tới mục (S1). 303 luôn về cùng site, `Location` không chứa `label`. Trang `/hub/*` đã `no-store` (`noStorePrivate`).
8. **Cờ provider tắt thì công tắc biến mất (Owner E1, 2026-10-10).** `profilePage` lấy `availableProviders(c)` (`routes/oauth.tsx`: cờ bật VÀ đã cấu hình, cùng quy tắc `/me` và `/login`) và chỉ đưa vào view các hàng có provider trong danh sách đó. Cờ không đụng tới `show_on_profile` đã lưu; bật lại cờ thì công tắc (và huy hiệu, Task 11) trở lại. `POST …/badge` **không** kiểm cờ: đó là cài đặt đồng ý của chính builder, bật hay tắt đều vô hại, và cho phép tắt huy hiệu khi cờ đang tắt.
9. **Builder `suspended` được bật/tắt cả hai chiều (Reviewer đã phán, L2).** Route cố ý không gọi `canEditProfile`: đây là cài đặt đồng ý chứ không phải sửa hồ sơ; không có tác dụng công khai khi chưa `approved`.
10. **Cỡ:** ≈ 120 dòng mã, ≈ 330 dòng test: dưới 600, không tách.

**Câu hỏi mở cho Owner:** không còn. Câu chữ ở bảng i18n đã được Owner duyệt nguyên văn 2026-10-10.

**Files:**
- Create: `apps/web/test/hub/badge-toggle.test.ts`.
- Modify: `apps/web/src/domain/identity.ts` (`BADGE_PROVIDERS`, `isBadgeProvider`, hai action audit), `apps/web/src/db/identities.ts` (`setShowOnProfile`), `apps/web/src/routes/hub.tsx` (nạp danh sách, route POST), `apps/web/src/views/hub/ProfilePage.tsx` (mục `#badges`), 4 file `apps/web/src/i18n/messages/*.ts`.
- Test (sửa): `apps/web/test/domain/identity.test.ts` (dòng ≈ 40 ghim `IDENTITY_AUDIT` là `{link, unlink}`: sửa thành bốn action; thêm test `BADGE_PROVIDERS`/`isBadgeProvider`), `apps/web/test/db/identities.test.ts` (khối `setShowOnProfile`), `apps/web/test/architecture.test.ts` (allowlist thêm `routes/hub.tsx`).

**Interfaces:**
- Consumes: `availableProviders` (`routes/oauth.tsx`); `listIdentitiesForUser`, `UserIdentity` (`db/identities.ts`, `domain/identity.ts`); `auditStatement`, `AuditIdentityGuard` (`db/audit.ts`); `requireBuilder`; `onLocalized`; `errorResponse`; `localizedPath`; `translator`; `HubLayout`; `PROVIDER_NAME`; test: `makeBuilder`, `signIn` (`test/fixtures.ts`), `linkedUser` (`test/oauth-flow.ts`), `formPost`, `getReq`, `testEnv`.
- Produces: `BADGE_PROVIDERS = ["github", "linkedin"] as const`, `BadgeProvider`, `isBadgeProvider(v): v is BadgeProvider` (`domain/identity.ts`); `IDENTITY_AUDIT.show = "auth.identity.badge_show"` và `.hide = "auth.identity.badge_hide"`; `type BadgeResult = "changed" | "unchanged" | "not_linked"` và `setShowOnProfile(db, { userId, provider: BadgeProvider, show: boolean, now }): Promise<BadgeResult>` (`db/identities.ts`); `BADGE_NOTICES = ["shown", "hidden", "notLinked"] as const` (`views/hub/ProfilePage.tsx`, một nguồn cho route và view); route `POST /hub/identities/:provider/badge` (4 tiền tố locale).

**Khóa i18n mới (Owner duyệt nguyên văn 2026-10-10; thêm sau `profile.saved` của từng file). GitHub, LinkedIn, Google không dịch. `{provider}`, `{label}` là tham số.**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `hub.badges.title` | Verified accounts on your public profile | Tài khoản đã xác minh trên hồ sơ công khai | 公开资料上的已验证账号 | 公開資料上的已驗證帳號 |
| `hub.badges.intro` | Choose whether visitors can see that you own a linked GitHub or LinkedIn account. Each one stays off until you turn it on. Google accounts are never shown. | Chọn có cho khách thấy bạn sở hữu tài khoản GitHub hoặc LinkedIn đã liên kết hay không. Mỗi tài khoản đều tắt cho tới khi bạn tự bật. Tài khoản Google không bao giờ được hiện. | 选择是否让访客看到你拥有已关联的 GitHub 或 LinkedIn 账号。每个账号在你开启之前都保持关闭。Google 账号永远不会公开显示。 | 選擇是否讓訪客看到你擁有已連結的 GitHub 或 LinkedIn 帳號。每個帳號在你開啟之前都保持關閉。Google 帳號永遠不會公開顯示。 |
| `hub.badges.notApproved` | Visitors see nothing while your profile is not public. | Khi hồ sơ của bạn chưa công khai, khách sẽ không thấy gì. | 你的资料未公开期间，访客看不到任何内容。 | 你的資料未公開期間，訪客看不到任何內容。 |
| `hub.badges.detail.github` | Visitors see @{label}, linked to your GitHub profile, with “verified via GitHub”. | Khách sẽ thấy @{label}, có link tới trang GitHub của bạn, kèm dòng “đã xác minh qua GitHub”. | 访客会看到 @{label}（链接到你的 GitHub 主页）以及“已通过 GitHub 验证”。 | 訪客會看到 @{label}（連結到你的 GitHub 主頁）以及「已透過 GitHub 驗證」。 |
| `hub.badges.detail.linkedin` | Visitors see only “verified via LinkedIn”: no name, no email, no link. | Khách chỉ thấy dòng “đã xác minh qua LinkedIn”: không tên, không email, không link. | 访客只会看到“已通过 LinkedIn 验证”：没有姓名、邮箱或链接。 | 訪客只會看到「已透過 LinkedIn 驗證」：沒有姓名、電子郵件或連結。 |
| `hub.badges.on` | On | Đang bật | 已开启 | 已開啟 |
| `hub.badges.off` | Off | Đang tắt | 已关闭 | 已關閉 |
| `hub.badges.show` | Show {provider} on my public profile | Hiện {provider} trên hồ sơ công khai của tôi | 在我的公开资料中显示 {provider} | 在我的公開資料中顯示 {provider} |
| `hub.badges.hide` | Hide {provider} from my public profile | Ẩn {provider} khỏi hồ sơ công khai của tôi | 从我的公开资料中隐藏 {provider} | 從我的公開資料中隱藏 {provider} |
| `hub.badges.notice.shown` | Badge turned on. | Đã bật huy hiệu. | 已开启徽章。 | 已開啟徽章。 |
| `hub.badges.notice.hidden` | Badge turned off. | Đã tắt huy hiệu. | 已关闭徽章。 | 已關閉徽章。 |
| `hub.badges.notice.notLinked` | That account isn't linked, so nothing changed. | Tài khoản đó chưa được liên kết nên không có gì thay đổi. | 该账号并未关联，未作任何更改。 | 該帳號並未連結，未作任何更改。 |

- [ ] **Step 1: Test miền và db (đỏ).** (a) Trong `apps/web/test/domain/identity.test.ts`: sửa test "identity audit actions" (dòng ≈ 40) thành `expect(IDENTITY_AUDIT).toEqual({ link: "auth.identity.link", unlink: "auth.identity.unlink", show: "auth.identity.badge_show", hide: "auth.identity.badge_hide" })` và thêm (import `BADGE_PROVIDERS`, `isBadgeProvider` từ `../../src/domain/identity.ts`):

```ts
describe("badge providers (VNX-2606a)", () => {
  it("are exactly github and linkedin: google never", () => {
    expect([...BADGE_PROVIDERS]).toEqual(["github", "linkedin"]);
    expect(isBadgeProvider("github")).toBe(true);
    expect(isBadgeProvider("linkedin")).toBe(true);
    for (const v of ["google", "GitHub", "", null, 3]) expect(isBadgeProvider(v)).toBe(false);
  });
});
```

  (b) Trong `apps/web/test/db/identities.test.ts` KHÔNG có `tag` và `linkedUser`: thêm `import { linkedUser } from "../oauth-flow.ts";` và `setShowOnProfile` vào import từ `../../src/db/identities.ts`; email duy nhất tạo như `newUser()` đã làm, bằng bộ đếm `seq` của file (``ident-bt-${++seq}@vnx.si``; subject ``s-${++seq}``). Dùng `audits`, `ensureUser` có sẵn. Lưu ý `beforeEach` của file xóa mọi hàng `user_identities`, nên đặt khối mới trong cùng `describe` hoặc tự cô lập theo `user_id` như dưới:

```ts
describe("setShowOnProfile (VNX-2606a)", () => {
  it("turns the flag on and off, audits {provider} only, and writes nothing when the value is unchanged", async () => {
    const { user } = await linkedUser(`ident-bt-${++seq}@vnx.si`, "github", { subject: `s-${++seq}`, label: "mona-cat_octo" });
    const flag = async () => (await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1 AND provider = 'github'").bind(user.id).first<{ v: number }>())?.v;
    expect(await flag()).toBe(0); // positive precondition: linking never opts in
    expect(await setShowOnProfile(testEnv.DB, { userId: user.id, provider: "github", show: true, now: new Date().toISOString() })).toBe("changed");
    expect(await flag()).toBe(1);
    expect(await audits(user.id, "auth.identity.badge_show")).toEqual(['{"provider":"github"}']);
    expect(await setShowOnProfile(testEnv.DB, { userId: user.id, provider: "github", show: true, now: new Date().toISOString() })).toBe("unchanged");
    expect(await audits(user.id, "auth.identity.badge_show")).toHaveLength(1); // no second row
    expect(await setShowOnProfile(testEnv.DB, { userId: user.id, provider: "github", show: false, now: new Date().toISOString() })).toBe("changed");
    expect(await flag()).toBe(0);
    expect(await audits(user.id, "auth.identity.badge_hide")).toEqual(['{"provider":"github"}']);
  });

  it("not_linked when the user has no such identity, and it never touches another user's row", async () => {
    const a = await linkedUser(`ident-bt-${++seq}@vnx.si`, "linkedin", { subject: `s-${++seq}`, label: "a@example.com" });
    const b = await newUser();
    expect(await setShowOnProfile(testEnv.DB, { userId: b.id, provider: "linkedin", show: true, now: new Date().toISOString() })).toBe("not_linked");
    const row = await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE id = ?1").bind(a.identity.id).first<{ v: number }>();
    expect(row?.v).toBe(0);
    expect(await audits(b.id, "auth.identity.badge_show")).toEqual([]);
  });
});
```
  Chạy `npm test -w apps/web -- test/domain/identity.test.ts test/db/identities.test.ts`. Mong đợi: FAIL, `BADGE_PROVIDERS` và `setShowOnProfile` chưa có.

- [ ] **Step 2: Miền và db.** Trong `src/domain/identity.ts`, sau `OAUTH_PROVIDERS`:

```ts
/** The providers whose account a builder may show on the public profile (ADR-012 §5). Google never has a switch. */
export const BADGE_PROVIDERS = ["github", "linkedin"] as const;
export type BadgeProvider = (typeof BADGE_PROVIDERS)[number];
export function isBadgeProvider(value: unknown): value is BadgeProvider {
  return typeof value === "string" && (BADGE_PROVIDERS as readonly string[]).includes(value);
}
```
  và đổi dòng `IDENTITY_AUDIT` thành:

```ts
export const IDENTITY_AUDIT = { link: "auth.identity.link", unlink: "auth.identity.unlink", show: "auth.identity.badge_show", hide: "auth.identity.badge_hide" } as const;
```
  Trong `src/db/identities.ts` (thêm `BadgeProvider` vào import từ `../domain/identity.ts`):

```ts
export type BadgeResult = "changed" | "unchanged" | "not_linked";

/**
 * The builder's opt-in for the public badge (ADR-012 §5): turns `show_on_profile` on or off for that user's own account of that provider and audits
 * it ({ provider } only) in the same batch. The write is filtered by `user_id`, so another user's row is never reached. Nothing is written
 * (and nothing audited) when the value already is what was asked. The flag has no public effect by itself: the badge query also needs an approved builder (Task 11).
 */
export async function setShowOnProfile(db: D1Database, input: { userId: string; provider: BadgeProvider; show: boolean; now: string }): Promise<BadgeResult> {
  const existing = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(input.userId, input.provider).first<Row>();
  if (!existing) return "not_linked";
  const next = input.show ? 1 : 0;
  if (existing.show_on_profile === next) return "unchanged";
  const [update] = await db.batch<{ id: string }>([
    db.prepare("UPDATE user_identities SET show_on_profile = ?3, updated_at = ?4 WHERE id = ?1 AND user_id = ?2 AND show_on_profile != ?3 RETURNING id").bind(existing.id, input.userId, next, input.now),
    auditStatement(
      db,
      { actorUserId: input.userId, action: input.show ? IDENTITY_AUDIT.show : IDENTITY_AUDIT.hide, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: existing.id, userId: input.userId },
    ),
  ]);
  return update?.results.length ? "changed" : "unchanged";
}
```
  Chạy lại `npm test -w apps/web -- test/domain/identity.test.ts test/db/identities.test.ts`: PASS.

- [ ] **Step 3: Test route (đỏ).** Tạo `apps/web/test/hub/badge-toggle.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { linkIdentity, listIdentitiesForUser } from "../../src/db/identities.ts";
import type { BuilderStatus } from "../../src/domain/builder.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import { ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
/** A provider flag on or off (the badge switch follows the flag: Owner E1). The cache is reset so the change is seen at once. */
const setProvider = async (provider: OAuthProvider, enabled: boolean) => {
  const admin = await ensureUser("oauth-flags@example.com");
  await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
};
beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  await setProvider("github", true);
  await setProvider("linkedin", true);
});
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A builder with a session; each test its own e-mail and handle (no shared rows, no global counts). */
async function builderOf(status: BuilderStatus = "approved") {
  const t = tag();
  const email = `bt-${t}@vnx.si`;
  const builder = await makeBuilder(email, `bt-${t}`, status);
  const { cookie } = await signIn(email);
  return { builder, cookie, email };
}
const link = (userId: string, provider: OAuthProvider, label: string) =>
  linkIdentity(testEnv.DB, { userId, provider, subject: `s-${tag()}`, label, now: new Date().toISOString() });
const flagOf = async (userId: string, provider: string) =>
  (await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(userId, provider).first<{ v: number }>())?.v;
const badgeAudits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE actor_user_id = ?1 AND action LIKE 'auth.identity.badge_%' ORDER BY action").bind(userId).all<{ action: string; data: string }>()).results;
const profileHtml = async (cookie: string, path = "/hub/profile") => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
const sectionOf = (html: string) => html.match(/<section class="card wide" id="badges">.*?<\/section>/s)?.[0] ?? "";
const post = (provider: string, fields: Record<string, string>, cookie: string, headers: Record<string, string> = {}, path = `/hub/identities/${provider}/badge`) =>
  createApp().request(formPost(path, fields, { cookie, ...headers }), undefined, testEnv);

describe("/hub/profile: public badge switch (VNX-2606a)", () => {
  it("shows a switch for each linked GitHub and LinkedIn account, off by default, and never one for Google", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "mona-cat_octo");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    const googleLabel = `g-${tag()}@example.com`;
    await link(builder.userId, "google", googleLabel);
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Verified accounts on your public profile");
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).toContain("Show LinkedIn on my public profile");
    expect(section).toContain("@mona-cat_octo");
    expect(section).toContain("</strong> · Off");
    expect(section).not.toContain("Show Google"); // the intro says "Google accounts are never shown": the word alone is allowed
    expect(section).not.toContain("Hide Google");
    expect(section).not.toContain(googleLabel);
    expect(section).not.toMatch(/@example\.com/); // the LinkedIn and Google labels (e-mails) are not printed here
    expect(section).toContain('action="/hub/identities/github/badge"');
    expect(section).not.toContain("/hub/identities/google/");
    expect(section).not.toMatch(/style=|<script/);
  });

  it("has no badge section when the builder has no GitHub or LinkedIn account (Google alone does not count)", async () => {
    const { builder, cookie } = await builderOf();
    expect(await profileHtml(cookie)).not.toContain('id="badges"');
    await link(builder.userId, "google", `g-${tag()}@example.com`);
    const html = await profileHtml(cookie);
    expect(html).toContain("Edit profile"); // positive: the page renders
    expect(html).not.toContain('id="badges"');
  });

  it("turns the badge on and off: 303 to /hub/profile with a notice, one audit row of {provider} each, flag flips", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octocat");
    expect(await flagOf(builder.userId, "github")).toBe(0);
    const on = await post("github", { show: "1" }, cookie);
    expect(on.status).toBe(303);
    expect(on.headers.get("location")).toBe("/hub/profile?badge=shown#badges");
    expect(await flagOf(builder.userId, "github")).toBe(1);
    const html = await profileHtml(cookie, "/hub/profile?badge=shown");
    expect(sectionOf(html)).toContain("</strong> · On");
    expect(sectionOf(html)).toContain("Hide GitHub from my public profile");
    expect(html).toContain("Badge turned on.");
    const off = await post("github", { show: "0" }, cookie, {}, "/vi/hub/identities/github/badge");
    expect(off.headers.get("location")).toBe("/vi/hub/profile?badge=hidden#badges"); // the redirect follows the request locale
    expect(await flagOf(builder.userId, "github")).toBe(0);
    expect(await badgeAudits(builder.userId)).toEqual([
      { action: "auth.identity.badge_hide", data: '{"provider":"github"}' }, // ORDER BY action: ULIDs of one millisecond have no reliable order
      { action: "auth.identity.badge_show", data: '{"provider":"github"}' },
    ]);
  });

  it("the same value twice writes one audit row; the second still answers 'shown'", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "linkedin", "x@example.com");
    await post("linkedin", { show: "1" }, cookie);
    const again = await post("linkedin", { show: "1" }, cookie);
    expect(again.headers.get("location")).toBe("/hub/profile?badge=shown#badges");
    expect(await badgeAudits(builder.userId)).toHaveLength(1);
  });

  it.each(["pending", "rejected", "suspended"] as const)("a %s builder sees and can use the switch; it has no public effect yet", async (status) => {
    const { builder, cookie } = await builderOf(status);
    await link(builder.userId, "github", "octo-pending");
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).toContain("Visitors see nothing while your profile is not public.");
    expect((await post("github", { show: "1" }, cookie)).status).toBe(303);
    expect(await flagOf(builder.userId, "github")).toBe(1);
    expect((await post("github", { show: "0" }, cookie)).status).toBe(303); // a consent setting, not a profile edit: both ways, even suspended
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("an approved builder does not get the 'until approved' line", async () => {
    const { builder, cookie } = await builderOf("approved");
    await link(builder.userId, "github", "octo-ok");
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).not.toContain("while your profile is not public");
  });

  it("a provider whose flag is off has no switch; the other provider is unaffected; the stored value is kept and returns with the flag (Owner E1)", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-flag");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await post("github", { show: "1" }, cookie);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile"); // positive precondition: flag on
    await setProvider("github", false);
    const off = sectionOf(await profileHtml(cookie));
    expect(off).not.toContain("GitHub");
    expect(off).not.toContain("/hub/identities/github/");
    expect(off).toContain("Show LinkedIn on my public profile"); // linkedin is independent
    expect(await flagOf(builder.userId, "github")).toBe(1); // the flag does not change the stored choice
    await setProvider("github", true);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile");
    await setProvider("github", false);
    await setProvider("linkedin", false);
    expect(await profileHtml(cookie)).not.toContain('id="badges"'); // both off: no section
  });

  it("google is 404 even when posted by hand (its flag stays 0); an unknown provider is 404", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "google", `g-${tag()}@example.com`);
    expect((await post("google", { show: "1" }, cookie)).status).toBe(404);
    expect((await post("myspace", { show: "1" }, cookie)).status).toBe(404);
    expect(await flagOf(builder.userId, "google")).toBe(0);
  });

  it("a provider the builder has not linked: notLinked, no audit, no row created", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "linkedin", "y@example.com"); // positive: has an identity, just not this one
    const res = await post("github", { show: "1" }, cookie);
    expect(res.headers.get("location")).toBe("/hub/profile?badge=notLinked#badges");
    expect(await flagOf(builder.userId, "github")).toBeUndefined();
    expect(await badgeAudits(builder.userId)).toEqual([]);
  });

  it("never reaches another builder's row: B posting for a provider only A has linked changes nothing of A's", async () => {
    const a = await builderOf();
    const b = await builderOf();
    await link(a.builder.userId, "github", "octo-a");
    await link(b.builder.userId, "linkedin", "b@example.com");
    const res = await post("github", { show: "1" }, b.cookie);
    expect(res.headers.get("location")).toBe("/hub/profile?badge=notLinked#badges");
    expect(await flagOf(a.builder.userId, "github")).toBe(0);
    expect((await listIdentitiesForUser(testEnv.DB, a.builder.userId))[0]?.showOnProfile).toBe(false);
    expect(await badgeAudits(a.builder.userId)).toEqual([]);
  });

  it("a body that is not exactly show=1 or show=0 is refused (409) and changes nothing", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-bad");
    for (const fields of [{}, { show: "" }, { show: "true" }, { show: "2" }]) expect((await post("github", fields, cookie)).status).toBe(409);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("refuses a missing or foreign Origin (403) and changes nothing", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-origin");
    expect((await post("github", { show: "1" }, cookie, { origin: "https://evil.example" })).status).toBe(403);
    const noOrigin = new Request("https://vnx.si/hub/identities/github/badge", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: "show=1" });
    expect((await createApp().request(noOrigin, undefined, testEnv)).status).toBe(403);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("signed out goes to /login, a signed-in non-builder goes to /hub/apply; neither writes", async () => {
    const out = await createApp().request(formPost("/hub/identities/github/badge", { show: "1" }), undefined, testEnv);
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toMatch(/^\/login/);
    const { cookie, user } = await signIn(`bt-nb-${tag()}@vnx.si`);
    await linkedUser(`bt-nb2-${tag()}@vnx.si`, "github", { subject: `s-${tag()}`, label: "octo-nb" });
    const res = await post("github", { show: "1" }, cookie);
    expect(res.headers.get("location")).toBe("/hub/apply");
    expect(await flagOf(user.id, "github")).toBeUndefined();
  });

  it("the body limit is 64 KB", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-big");
    expect((await post("github", { show: "1", pad: "x".repeat(70 * 1024) }, cookie)).status).toBe(413);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("unlinking removes the switch and the row (so no badge can remain)", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-gone");
    await post("github", { show: "1" }, cookie);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile"); // positive precondition
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await flagOf(builder.userId, "github")).toBeUndefined();
    expect(await profileHtml(cookie)).not.toContain('id="badges"');
  });

  it("renders in vi, zh-Hans and zh-Hant", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-i18n");
    expect(sectionOf(await profileHtml(cookie, "/vi/hub/profile"))).toContain("Hiện GitHub trên hồ sơ công khai của tôi");
    expect(sectionOf(await profileHtml(cookie, "/zh-hans/hub/profile"))).toContain("在我的公开资料中显示 GitHub");
    expect(sectionOf(await profileHtml(cookie, "/zh-hant/hub/profile"))).toContain("在我的公開資料中顯示 GitHub");
  });
});
```
  Ghi chú cho Implementer: `sectionOf` khớp đúng chuỗi mở thẻ của view ở Step 5 (`<section class="card wide" id="badges">`), nếu JSX in thuộc tính khác thứ tự thì đổi regex thành `/<section[^>]*id="badges".*?<\/section>/s`. Chạy `npm test -w apps/web -- test/hub/badge-toggle.test.ts`. Mong đợi: FAIL (route 404, mục `#badges` chưa có).

- [ ] **Step 4: Route.** Trong `src/routes/hub.tsx`: thêm import `availableProviders` (`./oauth.tsx`, như `me.tsx`), `listIdentitiesForUser, setShowOnProfile` (`../db/identities.ts`), `isBadgeProvider` (`../domain/identity.ts`), `BADGE_NOTICES` (`../views/hub/ProfilePage.tsx`). Đổi `profilePage` thành async và nạp danh sách (ba nơi gọi hiện đều `return profilePage(...)`, nên không cần sửa; handler `GET /hub/profile` là `(c) => profilePage(...)` nay trả Promise, Hono chấp nhận):

```tsx
async function profilePage(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200, saved = false) {
  const builder = c.get("builder");
  // Owner E1: a provider whose flag is off (or that is not configured) has no switch; the stored choice is untouched.
  const available = await availableProviders(c);
  const badges = (await listIdentitiesForUser(c.env.DB, builder.userId)).filter((i) => isBadgeProvider(i.provider) && available.includes(i.provider));
  const raw = c.req.query("badge");
  const badgeNotice = BADGE_NOTICES.find((n) => n === raw) ?? null;
  return page(c, <ProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} values={values} errors={errors} saved={saved} badges={badges} badgeNotice={badgeNotice} />, status);
}
```
  Thêm route sau `POST /hub/profile`:

```tsx
  // VNX-2606a. The builder's opt-in for the public badge (ADR-012 §5). Deliberately NO canEditProfile and NO provider-flag check: a consent setting, not a profile edit;
  // any builder status may switch it both ways (Reviewer ruling), and it has no public effect until `approved`.
  // `google` is 404 (it never has a switch). Only the caller's own row is touched; the answer is a 303 to the same site and never carries the label.
  onLocalized(app, "post", "/hub/identities/:provider/badge", requireBuilder, async (c) => {
    const provider = c.req.param("provider");
    if (!isBadgeProvider(provider)) return errorResponse(c, "notFound", 404);
    const show = (await c.req.parseBody())["show"];
    if (show !== "1" && show !== "0") return errorResponse(c, "conflict", 409);
    const result = await setShowOnProfile(c.env.DB, { userId: c.get("builder").userId, provider, show: show === "1", now: new Date().toISOString() });
    const notice = result === "not_linked" ? "notLinked" : show === "1" ? "shown" : "hidden";
    return c.redirect(`${localizedPath(c.get("locale"), "/hub/profile")}?badge=${notice}#badges`, 303);
  });
```
  Trong `test/architecture.test.ts` thêm `"../src/routes/hub.tsx"` vào `IDENTITY_ALLOWED` và nối vào chú thích "2606a: routes/hub.tsx (the builder's own switch)". `RANKING_FILES` không đổi.

- [ ] **Step 5: View và i18n.** `src/views/hub/ProfilePage.tsx`: thêm `import { PROVIDER_NAME } from "../../domain/identity.ts"`, `import type { UserIdentity } ...`, `export const BADGE_NOTICES = ["shown", "hidden", "notLinked"] as const; export type BadgeNotice = (typeof BADGE_NOTICES)[number];`, `type BadgeRow = Pick<UserIdentity, "provider" | "label" | "showOnProfile">`, hai prop `badges: BadgeRow[]` và `badgeNotice: BadgeNotice | null`, `const NOTICE_KEY = { shown: "hub.badges.notice.shown", hidden: "hub.badges.notice.hidden", notLinked: "hub.badges.notice.notLinked" } as const;` và, ngay sau `</section>` của form hồ sơ (trong `HubLayout`):

```tsx
      {p.badges.length > 0 ? (
        <section class="card wide" id="badges">
          <h2>{tr("hub.badges.title")}</h2>
          <p>{tr("hub.badges.intro")}</p>
          {p.badgeNotice ? (
            <p class={p.badgeNotice === "notLinked" ? "notice" : "notice good"} role="status">
              {tr(NOTICE_KEY[p.badgeNotice])}
            </p>
          ) : null}
          {p.builder.status !== "approved" ? <p class="notice">{tr("hub.badges.notApproved")}</p> : null}
          <ul>
            {p.badges.map((b) => {
              const name = PROVIDER_NAME[b.provider];
              return (
                <li>
                  <strong>{name}</strong> · {tr(b.showOnProfile ? "hub.badges.on" : "hub.badges.off")}
                  <p class="muted">{b.provider === "github" ? tr("hub.badges.detail.github", { label: b.label }) : tr("hub.badges.detail.linkedin")}</p>
                  <form method="post" action={localizedPath(p.locale, `/hub/identities/${b.provider}/badge`)}>
                    <input type="hidden" name="show" value={b.showOnProfile ? "0" : "1"} />
                    <button type="submit" class="btn">
                      {tr(b.showOnProfile ? "hub.badges.hide" : "hub.badges.show", { provider: name })}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
```
  (Dùng đúng tên class có thật trong `public/assets/app.css`, `grep -n "\.btn\|\.muted" public/assets/app.css`; task này KHÔNG thêm CSS.) Thêm 12 khóa vào 4 file `src/i18n/messages/*.ts` theo bảng (en là nguồn của kiểu `MessageKey`). Chạy `npm test -w apps/web -- test/hub/badge-toggle.test.ts test/i18n/parity.test.ts test/architecture.test.ts test/db/identities.test.ts`. Mong đợi: PASS.

- [ ] **Step 6: Hồi quy.** `npm test -w apps/web -- test/hub test/me test/http`: các test hub hiện có phải vẫn xanh (trang hồ sơ nay thêm một truy vấn `user_identities`).

- [ ] **Step 7: Kiểm toàn bộ và commit.**
```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/domain/identity.ts apps/web/src/db/identities.ts apps/web/src/routes/hub.tsx apps/web/src/views/hub/ProfilePage.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/hub/badge-toggle.test.ts apps/web/test/domain/identity.test.ts apps/web/test/db/identities.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): builder opt-in switch for the public GitHub and LinkedIn badge at /hub/profile (VNX-2606a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** mã ≈ 120 dòng (domain 8, db 25, route 18, view 45, hub.tsx imports 6, test kiến trúc 2), test ≈ 300 dòng (route 190, db 55, kiến trúc 2), locale 12 khóa × 4 file. Dưới 600 không tính locale: không tách.

**Nghĩa vụ cho task sau:**
- **Task 11 (VNX-2606b):** truy vấn huy hiệu lọc `approved` và `show_on_profile = 1`; cờ do task này ghi là đầu vào duy nhất.
- **Task 12 (VNX-2607):** câu Privacy "A builder can choose to show their GitHub username, or the fact that their LinkedIn account is verified" đúng với code (mặc định tắt, builder tự bật từng provider, có audit).
- **Ghi nhận:** không có "bật mặc định khi duyệt" hay "bật cả hai một lần": mỗi provider một cú bấm, theo ADR-012 §5 ("builder tự bật").

---

### Task 11: VNX-2606b — Huy hiệu xác minh trên `/b/:handle`

**Phụ thuộc:** Task 10 (cờ `show_on_profile` có người ghi, `BadgeProvider`), Task 4 (regex `login` GitHub), Task 8-9 (hủy liên kết xóa hàng). **Review Focus:** 8 (đủ: chỉ `approved` + `show_on_profile = 1`, Google không bao giờ, client không lộ, thứ tự không đổi), 11, và nghĩa vụ riêng tư của header (identity client không tới builder hay công khai).

**Mục tiêu.** Trang công khai `/b/:handle` của builder `approved` hiện huy hiệu cho từng identity GitHub hoặc LinkedIn có `show_on_profile = 1`: GitHub là `@login` link tới `https://github.com/<login>` kèm "verified via GitHub"; LinkedIn chỉ là nhãn "verified via LinkedIn" (không link, không email, không tên). Google không bao giờ. Huy hiệu **không vào xếp hạng** (ADR-004): không file xếp hạng, catalogue hay danh bạ nào đọc `user_identities` hay `show_on_profile`, có test nguồn.

**Quyết định kỹ thuật** (từ code thật; Reviewer kiểm):
1. **Link GitHub đi THẲNG, không qua `/go/` (phán quyết theo ADR-007 §7).** Lý do: (a) `/go/` là cơ chế **offer**: `/go/:merchantSlug` và `/go/o/:offerId` tra đích theo id trong `offers` của DB, kiểm host đã đăng ký, đếm click vào `outbound_clicks`, và chỉ dùng cho link kiếm tiền (`rel="sponsored"`); một link tới hồ sơ GitHub của builder không phải offer, không có merchant, không kiếm tiền, nên ép qua `/go/` buộc phải bịa một merchant "github.com" và ghi click vào bảng tiền; (b) code hiện hành đã làm đúng như vậy cho mọi link ngoài do builder cung cấp: `websiteUrl` và `item.url` của portfolio trong chính `BuilderProfilePage` là `<a href rel="nofollow ugc noopener" target="_blank">` trực tiếp (test `builder-profile.test.ts` ghim điều đó); (c) đếm click vào danh tính builder là dữ liệu cá nhân thừa (ADR-007 §11, "Click không lưu IP hay email"; ở đây còn kèm danh tính). Câu "Mọi link ra ngoài đi qua /go/" được đọc là mọi link **kiếm tiền hoặc theo dõi**. Không cần Owner quyết (xem "Ghi nhận" cuối task: chữ của ADR-007 §7 rộng hơn cách nó được áp dụng). Giá trị `rel`: `nofollow noopener noreferrer` (hằng `BADGE_REL`; không `ugc` vì `login` do GitHub cấp chứ không phải nội dung người dùng gõ; thêm `noreferrer` để GitHub không thấy trang VNX.SI nào dẫn tới), cùng `target="_blank"` như các link ngoài khác của trang.
2. **URL dựng an toàn, fail closed.** Regex `login` hiện là hằng riêng trong `auth/oauth/github.ts` (Task 4). Chuyển nó sang `domain/identity.ts` thành `GITHUB_LOGIN_RE` (một nguồn; `github.ts` import lại, hành vi không đổi, test `github` hiện có giữ nguyên) và thêm `githubProfileUrl(login): string | null` = `https://github.com/${login}` chỉ khi `GITHUB_LOGIN_RE.test(login)`, ngược lại `null`. `label` trong DB đã qua regex này lúc lưu (adapter) nhưng cột chỉ có CHECK 1-254 ký tự, nên ở chỗ vẽ **kiểm lại**: `login` không hợp lệ (dữ liệu cũ, chèn thô) thì **bỏ cả huy hiệu GitHub đó**, không vẽ nửa vời. Chữ `@login` do JSX escape; `href` là chuỗi do hàm trên dựng, không bao giờ nối từ `label` ngoài hàm.
3. **LinkedIn không bao giờ ra khỏi tầng db kèm `label`.** `label` của LinkedIn thường là email. `listPublicBadges` chỉ chọn `label` khi `provider = 'github'` (`CASE WHEN`), nên view và route không có cách nào vô tình in email LinkedIn. Kiểu trả về `PublicBadge = { provider: "github"; login: string; url: string } | { provider: "linkedin" }`.
4. **Điều kiện công khai nằm trong SQL, không dựa vào route:** `listPublicBadges(db, builderUserId, providers)` join `builders` (`status = 'approved'`) và `users` (`status = 'active'`), lọc `show_on_profile = 1` và `provider IN (<providers>)` với `providers` là danh sách provider khả dụng do route truyền vào (quyết định 9; danh sách rỗng thì trả `[]` không chạm DB). Route `findPublicBuilderByHandle` đã lọc cùng điều kiện, nhưng hàm này tự đứng vững (phòng ngừa chiều sâu, đúng câu hỏi mở (c): builder rời `approved` giữ nguyên hàng và cờ, huy hiệu biến mất; khi được `approved` lại thì hiện lại, có test).
5. **Cache: `/b/:handle` không có `Cache-Control` do ứng dụng đặt.** Đã đọc `src`: `Cache-Control` chỉ có ở `/media/*` (immutable), `robots.txt`, `sitemap` (`public, max-age=3600`), `no-store` ở vùng riêng và mọi HTML cho người đã đăng nhập (`noStorePrivate`). `/b/:handle` cho khách ẩn danh trả HTML không header cache: Workers không tự cache phản hồi động, trình duyệt không có validator nên không dùng bản cũ không hỏi lại; vậy tắt huy hiệu hoặc hủy liên kết có hiệu lực **ngay ở lần tải kế tiếp**, không có độ trễ do cache. Task này **không** thêm `Cache-Control` cho `/b/:handle`, và thêm test ghim hành vi (khách: không `public`/`max-age`/`s-maxage`; đã đăng nhập: `no-store`; bật/tắt/hủy liên kết thấy ngay). Phản hồi của Worker hiện không bị cache ở edge. Nghĩa vụ: nếu sau này code thêm Cache API hoặc `Cache-Control: public`/`s-maxage` cho `/b/*`, TTL phải ngắn và cache phải được xóa khi tắt huy hiệu, hủy liên kết và đổi trạng thái builder; ghi ở VNX-2608.
6. **Chỉ vẽ trong khối đầu trang, không đưa vào chỗ khác:** không vào JSON-LD (`sameAs`), meta description, OG, sitemap, `BuilderCard`, danh bạ hay catalogue (test: JSON-LD của trang không chứa `github.com` khi huy hiệu bật). Lý do: huy hiệu là tín hiệu tin cậy trên trang chi tiết, không phải dữ liệu xếp hạng hay có cấu trúc cho máy.
7. **Không thêm kiểm "link có sống không".** Hồ sơ GitHub của tài khoản Enterprise Managed Users (login dạng `name_SHORTCODE`) không công khai, nên link có thể 404 với khách (nghĩa vụ của review VNX-2603c). Không có cách hợp lệ để biết từ phía ta (gọi GitHub từ trang công khai là chặn request và rò dữ liệu). Task này chỉ bảo đảm login dạng EMU (`mona-cat_octo`) được vẽ và link đúng; Owner đã quyết giữ link như ADR-012 §5 (E2), xem lại bằng tài khoản thật ở VNX-2608.
8. **CSS:** một quy tắc nhỏ `.verified-list` / `.verified` cạnh `.chips` trong `public/assets/app.css` (không `style=` nội tuyến; test ghim).
9. **Cờ provider tắt thì huy hiệu của provider đó biến mất (Owner E1, 2026-10-10).** `routes/builder-profile.tsx` gọi `availableProviders(c)` (`routes/oauth.tsx`: cờ bật VÀ đã cấu hình), lọc bằng `isBadgeProvider` và truyền vào `listPublicBadges`. Cờ không đổi `show_on_profile` đã lưu: bật lại cờ thì huy hiệu hiện lại. Hai provider độc lập. Thêm một lần đọc cờ (đã cache) cho mỗi lần tải `/b/:handle`.
10. **Thứ tự không đổi, cả catalogue và danh bạ (ADR-012 "Được bảo đảm bởi", H1).** Test dựng sản phẩm/builder thật, bật huy hiệu, và so thứ tự `searchProducts` và `searchBuilders` trước và sau; cộng thêm assertion nguồn. **Top builders (`topBuilders`, `loadBuilderTallies`) chỉ có sau khi rebase lên `main` (M7 đã ở `main`, `38bf414`)**: xem nghĩa vụ BẮT BUỘC cuối task.
11. **Cỡ:** ≈ 130 dòng mã, ≈ 450 dòng test, ≈ 50 dòng test kiến trúc: dưới 600 không tính locale, không tách.

**Câu hỏi mở cho Owner:** không còn. Owner đã quyết 2026-10-10: (E1) cờ tắt thì huy hiệu ẩn; (E2) giữ link cho login EMU; (E3) câu chữ i18n duyệt nguyên văn.

**Files:**
- Create: `apps/web/test/public/builder-badges.test.ts`, `apps/web/test/hub/client-identity-privacy.test.ts`.
- Modify: `apps/web/src/domain/identity.ts` (`GITHUB_LOGIN_RE`, `githubProfileUrl`, `PublicBadge`), `apps/web/src/auth/oauth/github.ts` (dùng `GITHUB_LOGIN_RE`, xóa hằng `LOGIN` cục bộ), `apps/web/src/db/identities.ts` (`listPublicBadges`), `apps/web/src/routes/builder-profile.tsx`, `apps/web/src/views/BuilderProfilePage.tsx`, `apps/web/public/assets/app.css`, 4 file `apps/web/src/i18n/messages/*.ts`.
- Test (sửa): `apps/web/test/architecture.test.ts` (allowlist, khối ADR-004 và client), `apps/web/test/db/identities.test.ts` hoặc test `github` hiện có chỉ khi `GITHUB_LOGIN_RE` cần kiểm lại (xem Step 1).

**Interfaces:**
- Consumes: `availableProviders` (`routes/oauth.tsx`); `isBadgeProvider`, `BadgeProvider` (Task 10); `findPublicBuilderByHandle` (`db/builders.ts`); `listPortfolio`, `listPublicProductsByBuilder`; `setShowOnProfile`, `linkIdentity`, `unlinkIdentity` (`db/identities.ts`); `PROVIDER_NAME`; `BuilderProfilePage` (`views/BuilderProfilePage.tsx`, hằng `EXTERNAL` hiện có); `translator`; `searchBuilders` (`db/directory.ts`), `searchProducts` (`db/catalog.ts`), `parseCatalogQuery` (`domain/catalog.ts`) cho test thứ tự; test: `makeBuilder`, `addLiveProduct`, `makeInquiry`, `makeRequest`, `inviteBuilders`, `signIn` (`test/fixtures.ts`), `linkedUser` (`test/oauth-flow.ts`), `setBuilderStatus` (`db/builders.ts`).
- Produces: `GITHUB_LOGIN_RE`, `githubProfileUrl(login: string): string | null`, `type PublicBadge = { provider: "github"; login: string; url: string } | { provider: "linkedin" }` (`domain/identity.ts`); `listPublicBadges(db: D1Database, builderUserId: string, providers: readonly BadgeProvider[]): Promise<PublicBadge[]>` (`db/identities.ts`, thứ tự `github` rồi `linkedin`); prop `badges: PublicBadge[]` của `BuilderProfilePage`; hằng `BADGE_REL = "nofollow noopener noreferrer"` (trong `BuilderProfilePage.tsx`).

**Khóa i18n mới (Owner duyệt nguyên văn 2026-10-10; thêm sau `bprofile.website` của từng file; brand không dịch):**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `bprofile.verifiedVia` | verified via {provider} | đã xác minh qua {provider} | 已通过 {provider} 验证 | 已透過 {provider} 驗證 |
| `bprofile.verified.heading` | Verified accounts | Tài khoản đã xác minh | 已验证账号 | 已驗證帳號 |

- [ ] **Step 1: Test miền (đỏ).** Thêm vào `apps/web/test/db/identities.test.ts` (hoặc file test miền của `identity` nếu đã có):

```ts
import { GITHUB_LOGIN_RE, githubProfileUrl } from "../../src/domain/identity.ts";

describe("githubProfileUrl (VNX-2606b)", () => {
  it("builds https://github.com/<login> for a valid login, EMU underscore included", () => {
    expect(githubProfileUrl("octocat")).toBe("https://github.com/octocat");
    expect(githubProfileUrl("mona-cat_octo")).toBe("https://github.com/mona-cat_octo");
    expect(githubProfileUrl("a".repeat(39))).toBe(`https://github.com/${"a".repeat(39)}`);
  });
  it("is null for anything that could change the URL", () => {
    for (const bad of ["", "-octo", "_octo", "octo/cat", "octo%2Fcat", "octo.cat", "octo cat", "octo?x=1", "octo#x", "<script>", "a".repeat(40), "octo\n"]) {
      expect(githubProfileUrl(bad), bad).toBeNull();
    }
    expect(GITHUB_LOGIN_RE.test("octo\n")).toBe(false); // no multiline match slipping a newline through
  });
});
```
  Chạy `npm test -w apps/web -- test/db/identities.test.ts`. Mong đợi: FAIL (chưa có export). Lưu ý: `$` không có cờ `m` trong JS khớp trước một `\n` cuối? Không: JS `$` không cờ `m` chỉ khớp cuối chuỗi, nên `"octo\n"` bị từ chối; test ghim điều đó.

- [ ] **Step 2: Miền.** `src/domain/identity.ts`:

```ts
/** A GitHub login: letters, digits, hyphens and (Enterprise Managed Users, `name_SHORTCODE`) underscores, at most 39 characters. Stricter than the label CHECK, so it can never put `/`, `?` or `#` in a profile link. The one source: the GitHub adapter and the public badge both use it. */
export const GITHUB_LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$/;

/** The public profile link of a GitHub login, or null when the login is not a plain login (then no link and no badge is drawn). */
export function githubProfileUrl(login: string): string | null {
  return GITHUB_LOGIN_RE.test(login) ? `https://github.com/${login}` : null;
}

/** What the public profile may show of a linked account (ADR-012 §5). LinkedIn carries no label: it is often an e-mail. */
export type PublicBadge = { provider: "github"; login: string; url: string } | { provider: "linkedin" };
```
  Trong `src/auth/oauth/github.ts`: xóa hằng `LOGIN` và dòng chú thích của nó, `import { GITHUB_LOGIN_RE } from "../../domain/identity.ts"`, và đổi `LOGIN.test(login)` thành `GITHUB_LOGIN_RE.test(login)` (một chỗ, dòng ≈ 83). Chạy `npm test -w apps/web -- test/db/identities.test.ts test/auth/oauth-github.test.ts` (tên file thật: `grep -rln "github" apps/web/test/auth`). Mong đợi: PASS, test GitHub hiện có không đổi.

- [ ] **Step 3: Test db và trang (đỏ).** Tạo `apps/web/test/public/builder-badges.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { searchProducts } from "../../src/db/catalog.ts";
import { searchBuilders } from "../../src/db/directory.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { linkIdentity, listPublicBadges, setShowOnProfile } from "../../src/db/identities.ts";
import type { BuilderStatus } from "../../src/domain/builder.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { addLiveProduct, ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
const ALL = ["github", "linkedin"] as const;
/** A provider flag on or off (Owner E1: a badge follows its provider's flag). The cache is reset so the change is seen at once. */
const setProvider = async (provider: OAuthProvider, enabled: boolean) => {
  const admin = await ensureUser("oauth-flags@example.com");
  await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
};
beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  await setProvider("github", true);
  await setProvider("linkedin", true);
});
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const get = (path: string, cookie?: string) => createApp().request(getReq(path, cookie), undefined, testEnv);
const pageOf = async (handle: string, path = "/b/") => decode(await (await get(`${path}${handle}`)).text());
const blockOf = (html: string) => html.match(/<ul class="verified-list"[^>]*>.*?<\/ul>/s)?.[0] ?? "";

/** An approved (default) builder; every test its own e-mail and handle. */
async function builderOf(status: BuilderStatus = "approved") {
  const t = tag();
  const builder = await makeBuilder(`bb-${t}@vnx.si`, `bb-${t}`, status);
  return { builder, handle: builder.handle, email: `bb-${t}@vnx.si` };
}
const link = async (userId: string, provider: OAuthProvider, label: string) => {
  const r = await linkIdentity(testEnv.DB, { userId, provider, subject: `s-${tag()}`, label, now: new Date().toISOString() });
  if (!r.ok) throw new Error(r.reason);
  return r.identity;
};
/** Straight into the row, the way a legacy or hostile row could look: bypasses every route and every type. */
const rawFlag = (userId: string, provider: string, value = 1) =>
  testEnv.DB.prepare("UPDATE user_identities SET show_on_profile = ?3 WHERE user_id = ?1 AND provider = ?2").bind(userId, provider, value).run();
const rawIdentity = (userId: string, provider: string, label: string) =>
  testEnv.DB.prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)")
    .bind(`id-${tag()}`, userId, provider, `s-${tag()}`, label, new Date().toISOString()).run();
const optIn = (userId: string, provider: "github" | "linkedin") => setShowOnProfile(testEnv.DB, { userId, provider, show: true, now: new Date().toISOString() });

describe("/b/:handle verified badge (VNX-2606b)", () => {
  it("GitHub: @login linked to github.com, 'verified via GitHub', safe rel and target", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octocat");
    await optIn(builder.userId, "github");
    const html = await pageOf(handle);
    expect(html).toContain("Lan Nguyen"); // positive: the profile renders
    expect(blockOf(html)).toContain('<a href="https://github.com/octocat" rel="nofollow noopener noreferrer" target="_blank">@octocat</a>');
    expect(blockOf(html)).toContain("verified via GitHub");
    expect(blockOf(html)).toContain('aria-label="Verified accounts"');
  });

  it("an Enterprise Managed Users login (underscore) renders and links correctly", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "mona-cat_octo");
    await optIn(builder.userId, "github");
    expect(blockOf(await pageOf(handle))).toContain('<a href="https://github.com/mona-cat_octo" rel="nofollow noopener noreferrer" target="_blank">@mona-cat_octo</a>');
  });

  it("LinkedIn: only the label, no link, no e-mail, no name", async () => {
    const { builder, handle } = await builderOf();
    const email = `li-${tag()}@example.com`;
    await link(builder.userId, "linkedin", email);
    await optIn(builder.userId, "linkedin");
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("verified via LinkedIn");
    expect(blockOf(html)).not.toMatch(/<a |href=/);
    expect(html).not.toContain(email);
    expect(html).not.toContain("linkedin.com");
  });

  it("both badges: GitHub first, then LinkedIn", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await link(builder.userId, "github", "octo-both");
    await optIn(builder.userId, "linkedin");
    await optIn(builder.userId, "github");
    const block = blockOf(await pageOf(handle));
    expect(block.indexOf("GitHub")).toBeGreaterThan(-1);
    expect(block.indexOf("GitHub")).toBeLessThan(block.indexOf("LinkedIn"));
  });

  it("Google is never shown, even when its row somehow has show_on_profile = 1", async () => {
    const { builder, handle } = await builderOf();
    const email = `g-${tag()}@example.com`;
    await link(builder.userId, "google", email);
    await link(builder.userId, "github", "octo-plus-google");
    await optIn(builder.userId, "github"); // positive: a badge block exists
    await rawFlag(builder.userId, "google", 1);
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("verified via GitHub");
    expect(html).not.toContain("Google");
    expect(html).not.toContain(email);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([{ provider: "github", login: "octo-plus-google", url: "https://github.com/octo-plus-google" }]);
  });

  it("linked but not opted in: nothing is shown", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-quiet");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    const html = await pageOf(handle);
    expect(html).toContain("Lan Nguyen"); // positive
    expect(html).not.toContain("verified via");
    expect(html).not.toContain('class="verified-list"');
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
  });

  it("a provider whose flag is off (or not configured) shows no badge; the other is independent; the stored choice is kept and the badge returns with the flag (Owner E1)", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-flag");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await optIn(builder.userId, "github");
    await optIn(builder.userId, "linkedin");
    expect(blockOf(await pageOf(handle))).toContain("verified via GitHub"); // positive precondition: both flags on
    expect(blockOf(await pageOf(handle))).toContain("verified via LinkedIn");
    await setProvider("github", false);
    const off = await pageOf(handle);
    expect(off).not.toContain("octo-flag");
    expect(off).not.toContain("verified via GitHub");
    expect(blockOf(off)).toContain("verified via LinkedIn");
    const kept = await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1 AND provider = 'github'").bind(builder.userId).first<{ v: number }>();
    expect(kept?.v).toBe(1); // the flag never rewrites the stored choice
    await setProvider("linkedin", false);
    expect(await pageOf(handle)).not.toContain('class="verified-list"');
    expect(await listPublicBadges(testEnv.DB, builder.userId, [])).toEqual([]);
    await setProvider("github", true);
    expect(blockOf(await pageOf(handle))).toContain("verified via GitHub");
    const unconfigured = await createApp().request(getReq(`/b/${handle}`), undefined, { ...testEnv, OAUTH_DRIVER: undefined } as Bindings); // flag on, no credentials
    expect(await unconfigured.text()).not.toContain("verified via GitHub");
  });

  it("toggle on, off and unlink take effect on the very next anonymous load (no cache)", async () => {
    const { builder, handle, email } = await builderOf();
    await link(builder.userId, "github", "octo-live");
    const { cookie } = await signIn(email);
    const toggle = (show: "0" | "1") => createApp().request(formPost("/hub/identities/github/badge", { show }, { cookie }), undefined, testEnv);
    expect(await pageOf(handle)).not.toContain("verified via");
    await toggle("1");
    expect(await pageOf(handle)).toContain("verified via GitHub");
    await toggle("0");
    expect(await pageOf(handle)).not.toContain("verified via");
    await toggle("1");
    expect(await pageOf(handle)).toContain("verified via GitHub"); // positive precondition for the unlink step
    const unlinked = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(unlinked.status).toBe(303);
    expect(await pageOf(handle)).not.toContain("verified via");
    expect(await pageOf(handle)).not.toContain("octo-live");
  });

  it.each(["pending", "rejected", "suspended"] as const)("a %s builder: the page is 404, the query is empty, the row and flag stay; approved again, the badge returns", async (status) => {
    const { builder, handle } = await builderOf("approved");
    await link(builder.userId, "github", `octo-${status}`);
    await optIn(builder.userId, "github");
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toHaveLength(1); // positive precondition
    const now = new Date().toISOString();
    expect(await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: status === "suspended" ? "suspended" : "pending", reviewNote: null, now })).not.toBeNull();
    if (status === "rejected") await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "pending", to: "rejected", reviewNote: "x", now });
    expect((await get(`/b/${handle}`)).status).toBe(404);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
    const row = await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1").bind(builder.userId).first<{ v: number }>();
    expect(row?.v).toBe(1); // kept (ADR-012 §5, decision (c))
    expect(await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: status, to: "approved", reviewNote: null, now })).not.toBeNull();
    expect(await pageOf(handle)).toContain(`octo-${status}`);
  });

  it("a suspended account hides the badge too", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-acct");
    await optIn(builder.userId, "github");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(builder.userId).run();
    expect((await get(`/b/${handle}`)).status).toBe(404);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
  });

  it("another builder's opt-in never shows on this profile", async () => {
    const a = await builderOf();
    const b = await builderOf();
    await link(a.builder.userId, "github", "octo-of-a");
    await optIn(a.builder.userId, "github");
    expect(await pageOf(a.handle)).toContain("octo-of-a"); // positive
    const html = await pageOf(b.handle);
    expect(html).not.toContain("octo-of-a");
    expect(html).not.toContain("verified via");
  });

  it.each(["<script>alert(1)</script>", "octo/cat", "octo%2Fcat", "octo cat", "octo.cat", "_octo", "-octo", "a".repeat(40), "octo?x=1", "octo#x"])(
    "a stored GitHub label that is not a plain login (%s) draws no badge and no link",
    async (label) => {
      const { builder, handle } = await builderOf();
      await rawIdentity(builder.userId, "github", label);
      const html = await pageOf(handle);
      expect(html).toContain("Lan Nguyen"); // positive: the page renders, the row is opted in
      expect(await testEnv.DB.prepare("SELECT 1 AS n FROM user_identities WHERE user_id = ?1 AND show_on_profile = 1").bind(builder.userId).first()).not.toBeNull();
      expect(html).not.toContain("verified via");
      expect(html).not.toContain("github.com/octo");
      expect(html).not.toContain("<script>alert(1)");
      expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
    },
  );

  it("the badge markup has no inline style, script or handler, and no external resource", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-csp");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await optIn(builder.userId, "github");
    await optIn(builder.userId, "linkedin");
    const block = blockOf(await pageOf(handle));
    expect(block).toContain("verified via LinkedIn"); // positive: both are drawn
    expect(block).not.toMatch(/style=|<script|\son\w+=|<img|<iframe|src=/i);
    expect((block.match(/href=/g) ?? []).length).toBe(1); // only the GitHub link
  });

  it("the badge is not in JSON-LD, the meta description or the sitemap", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-meta");
    await optIn(builder.userId, "github");
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("octo-meta"); // positive
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) expect(m[1]).not.toContain("github.com");
    expect(html.match(/<meta name="description" content="[^"]*"/)?.[0] ?? "").not.toContain("octo-meta");
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("octo-meta");
  });

  it("renders its label in vi, zh-Hans and zh-Hant; the brand is not translated", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-i18n");
    await optIn(builder.userId, "github");
    expect(blockOf(await pageOf(handle, "/vi/b/"))).toContain("đã xác minh qua GitHub");
    expect(blockOf(await pageOf(handle, "/zh-hans/b/"))).toContain("已通过 GitHub 验证");
    expect(blockOf(await pageOf(handle, "/zh-hant/b/"))).toContain("已透過 GitHub 驗證");
  });

  it("cache: an anonymous load sets no public caching header; a signed-in one is no-store", async () => {
    const { builder, handle, email } = await builderOf();
    await link(builder.userId, "github", "octo-cache");
    await optIn(builder.userId, "github");
    const anon = await get(`/b/${handle}`);
    expect(anon.status).toBe(200);
    expect(anon.headers.get("cache-control") ?? "").not.toMatch(/public|max-age|s-maxage|immutable/i);
    const { cookie } = await signIn(email);
    expect((await get(`/b/${handle}`, cookie)).headers.get("cache-control")).toBe("no-store");
  });
});

describe("the badge never changes the order of builders (ADR-004)", () => {
  it("the catalogue order (searchProducts) is identical before and after badges are opted in for the builders of live products", async () => {
    const t = tag();
    const word = `zq${t}`;
    const owners = [];
    for (const n of ["one", "two", "three"]) {
      const b = await makeBuilder(`oc-${n}-${t}@vnx.si`, `oc-${n}-${t}`, "approved");
      await addLiveProduct(b, `${word} ${n}`);
      owners.push(b);
    }
    const order = async () => (await searchProducts(testEnv.DB, parseCatalogQuery({ q: word }))).items.map((i) => i.name);
    const before = await order();
    expect(before).toHaveLength(3); // positive: a real order to protect
    for (const b of owners.slice(1)) { // the lower-ranked ones, to catch any lift
      await link(b.userId, "github", `oc-${b.handle}`);
      await optIn(b.userId, "github");
    }
    expect(await order()).toEqual(before);
    await link(owners[0]!.userId, "linkedin", `oc-${t}@example.com`);
    await optIn(owners[0]!.userId, "linkedin");
    expect(await order()).toEqual(before);
  });

  it("the directory order is identical with no badges, with badges on the others, and with all badges on", async () => {
    const t = tag();
    const word = `Zq${t}`;
    const a = await makeBuilder(`or-a-${t}@vnx.si`, `or-a-${t}`, "approved", { name: `${word} Alpha` });
    const b = await makeBuilder(`or-b-${t}@vnx.si`, `or-b-${t}`, "approved", { name: `${word} Beta` });
    const c = await makeBuilder(`or-c-${t}@vnx.si`, `or-c-${t}`, "approved", { name: `${word} Gamma` });
    await addLiveProduct(a, `or-product-${t}`); // a ranks first on published products: a non-trivial order
    const query = { q: word, category: null, lang: null, country: null, availability: null, page: 1 } as const;
    const order = async () => (await searchBuilders(testEnv.DB, query)).items.map((e) => e.handle);
    const before = await order();
    expect(before).toHaveLength(3);
    expect(before[0]).toBe(a.handle);
    for (const x of [b, c]) {
      await link(x.userId, "github", `or-${x.handle}`);
      await optIn(x.userId, "github");
    }
    expect(await order()).toEqual(before); // badges on the two lower ones: no lift
    await link(a.userId, "linkedin", `or-${t}@example.com`);
    await optIn(a.userId, "linkedin");
    expect(await order()).toEqual(before);
    expect(await (await get(`/builders?q=${word}`)).text()).not.toContain("verified via"); // not on the directory card either
  });
});
```
  Sự kiện đã kiểm trong code (không còn là phỏng đoán): `setBuilderStatus` (`db/builders.ts:163-177`) là compare-and-set theo `from`, không có quy tắc chuyển trạng thái, nên mọi bước chuyển trong test (`approved → pending/suspended → rejected`, rồi `status → approved`) đều chạy được. `searchBuilders` khớp tên bằng `LIKE … ESCAPE` (không phân biệt hoa thường với ASCII) và không gọi `normalizeQuery`, nên `Zq<tag>` khớp `b.name`. `searchProducts` dùng FTS5 trigram cho từ ≥ 3 ký tự: từ `zq<tag>` đủ dài. Chạy `npm test -w apps/web -- test/public/builder-badges.test.ts`. Mong đợi: FAIL (`listPublicBadges` chưa có, trang chưa vẽ khối).

- [ ] **Step 4: Truy vấn.** `src/db/identities.ts`, thêm `githubProfileUrl`, `BadgeProvider` và `PublicBadge` vào import từ `../domain/identity.ts`:

```ts
/**
 * What `/b/:handle` may show (ADR-012 §5): the builder's GitHub and LinkedIn accounts that the builder opted into, only while the builder is
 * approved on an active account. Google never. The conditions live here, not in the route, so the query stands on its own: a builder who leaves
 * `approved` keeps the rows and the flag, and the badge simply stops being returned. `providers` are the ones whose flag is on and that are configured (Owner E1): another provider's row is not returned. LinkedIn's label (often an e-mail) is never selected;
 * a GitHub label that is not a plain login yields no badge (no half-drawn link). Not read by ranking, catalogue or directory code (ADR-004).
 */
export async function listPublicBadges(db: D1Database, builderUserId: string, providers: readonly BadgeProvider[]): Promise<PublicBadge[]> {
  if (providers.length === 0) return [];
  const marks = providers.map((_, i) => `?${i + 2}`).join(", "); // placeholders only: the values are bound, never interpolated
  const { results } = await db
    .prepare(
      `SELECT i.provider AS provider, CASE WHEN i.provider = 'github' THEN i.label END AS login
       FROM user_identities i
       JOIN builders b ON b.user_id = i.user_id
       JOIN users u ON u.id = i.user_id
       WHERE i.user_id = ?1 AND i.show_on_profile = 1 AND i.provider IN (${marks})
         AND b.status = 'approved' AND u.status = 'active'
       ORDER BY i.provider`,
    )
    .bind(builderUserId, ...providers)
    .all<{ provider: "github" | "linkedin"; login: string | null }>();
  const badges: PublicBadge[] = [];
  for (const r of results) {
    if (r.provider === "linkedin") badges.push({ provider: "linkedin" });
    else {
      const url = r.login === null ? null : githubProfileUrl(r.login);
      if (r.login !== null && url !== null) badges.push({ provider: "github", login: r.login, url });
    }
  }
  return badges;
}
```
  (`i.provider` thứ tự chữ cái: `github` < `linkedin`.) Chạy `npm test -w apps/web -- test/public/builder-badges.test.ts -t "Google|not opted|hostile|stored GitHub label"` hoặc cả file: các test dựa vào truy vấn (không cần view) phải xanh; test render còn đỏ.

- [ ] **Step 5: Route, view, CSS, i18n.** `src/routes/builder-profile.tsx`: import `listPublicBadges` (`../db/identities.ts`), `isBadgeProvider` (`../domain/identity.ts`), `availableProviders` (`./oauth.tsx`) và đổi:

```tsx
    const providers = (await availableProviders(c)).filter(isBadgeProvider); // Owner E1: flag off (or unconfigured) hides that provider's badge
    const [portfolio, products, badges] = await Promise.all([
      listPortfolio(c.env.DB, builder.userId),
      listPublicProductsByBuilder(c.env.DB, builder.userId),
      listPublicBadges(c.env.DB, builder.userId, providers),
    ]);
    return page(c, <BuilderProfilePage locale={c.get("locale")} origin={siteOrigin(c)} builder={builder} portfolio={portfolio} products={products} badges={badges} signedIn={c.get("user") !== null} />);
```
  `src/views/BuilderProfilePage.tsx`: import `type PublicBadge` và `PROVIDER_NAME` từ `../domain/identity.ts`; thêm `const BADGE_REL = "nofollow noopener noreferrer";`, prop `badges: PublicBadge[]` (bắt buộc; `grep -rn "BuilderProfilePage" apps/web/src apps/web/test` để sửa mọi nơi gọi khác), và trong `<header>`, ngay sau `<p class="muted">@{handle} · …</p>`:

```tsx
          {badges.length > 0 ? (
            <ul class="verified-list" aria-label={tr("bprofile.verified.heading")}>
              {badges.map((b) =>
                b.provider === "github" ? (
                  <li class="verified">
                    <a href={b.url} rel={BADGE_REL} target="_blank">
                      @{b.login}
                    </a>{" "}
                    <span>{tr("bprofile.verifiedVia", { provider: PROVIDER_NAME.github })}</span>
                  </li>
                ) : (
                  <li class="verified">
                    <span>{tr("bprofile.verifiedVia", { provider: PROVIDER_NAME.linkedin })}</span>
                  </li>
                ),
              )}
            </ul>
          ) : null}
```
  `public/assets/app.css`, ngay sau dòng `.chips li { … }`:

```css
.verified-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 8px 0; }
.verified { padding: 2px 10px; border: 1px solid var(--success); border-radius: 999px; font-size: 14px; }
```
  (kiểm `--success` là token có thật trong `:root`; nếu không, dùng `--border`.) Thêm 2 khóa vào 4 file `src/i18n/messages/*.ts` theo bảng. Chạy `npm test -w apps/web -- test/public test/i18n/parity.test.ts`. Mong đợi: PASS (kể cả `test/public/builder-profile.test.ts` cũ: không builder nào có cờ, nên không có khối mới).

- [ ] **Step 6: Test riêng tư: identity client không tới builder hay công khai (đỏ rồi xanh).** Tạo `apps/web/test/hub/client-identity-privacy.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeInquiry, makeRequest, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
/** Both badge providers ON, so a leak would show (the strictest setting). Same helper as builder-badges.test.ts. */
beforeEach(async () => {
  const admin = await ensureUser("oauth-flags@example.com");
  for (const provider of ["github", "linkedin"] as OAuthProvider[]) await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled: true, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
});
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const get = async (path: string, cookie?: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
/** A linked account of a CLIENT, straight into the table with show_on_profile = 1: the worst case the pages must still hide. */
const rawIdentity = (userId: string, provider: string, label: string) =>
  testEnv.DB.prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)")
    .bind(`id-${tag()}`, userId, provider, `s-${tag()}`, label, new Date().toISOString()).run();

/** Nothing of the client's linked accounts: no label, no 'verified via', no GitHub link, no linked-account section. */
function expectNoIdentity(html: string, labels: string[]) {
  for (const label of labels) expect(html, label).not.toContain(label);
  expect(html).not.toContain("verified via");
  expect(html).not.toContain("github.com/");
  expect(html).not.toContain('class="verified-list"');
  expect(html).not.toContain("/identities/");
}

describe("a client's linked accounts never reach a builder or the public (ADR-012 §5; VNX-2606b)", () => {
  it("builder-facing inquiry pages (overview, inbox, thread) show the client's name but none of their linked accounts", async () => {
    const t = tag();
    const { client, inquiry, builder } = await makeInquiry({ tag: `pv${t}`, status: "open" });
    const gh = `client-gh-${t}`;
    const li = `client-li-${t}@example.com`;
    await rawIdentity(client.id, "github", gh);
    await rawIdentity(client.id, "linkedin", li);
    await rawIdentity(client.id, "google", `client-g-${t}@example.com`);
    const { cookie } = await signIn(`pv${t}-b@vnx.si`);
    for (const path of ["/hub/inquiries", `/hub/inquiries/${inquiry.id}`]) {
      const html = await get(path, cookie);
      expect(html, path).toContain("Minh Tran"); // positive: the page shows the client
      expectNoIdentity(html, [gh, li, `client-g-${t}@example.com`]);
    }
    expectNoIdentity(await get("/hub", cookie), [gh, li]);
    expect(builder.handle).toBeTruthy();
  });

  it("builder-facing invitation pages (list, detail) show the request but none of the client's linked accounts", async () => {
    const t = tag();
    const { client, request } = await makeRequest({ tag: `pw${t}` });
    const builder = await makeBuilder(`pw${t}-b@vnx.si`, `pw${t}-b`, "approved");
    const [invite] = await inviteBuilders(request, [builder]);
    const gh = `client-gh-${t}`;
    await rawIdentity(client.id, "github", gh);
    await rawIdentity(client.id, "linkedin", `client-li-${t}@example.com`);
    const { cookie } = await signIn(`pw${t}-b@vnx.si`);
    for (const path of ["/hub/invitations", `/hub/invitations/${invite!.id}`]) {
      const html = await get(path, cookie);
      expect(html, path).toContain(`pw${t} booking app`); // positive: the request is shown
      expectNoIdentity(html, [gh, `client-li-${t}@example.com`]);
    }
  });

  it("the public pages of the builder who got the inquiry show nothing of the client's accounts", async () => {
    const t = tag();
    const { client, builder } = await makeInquiry({ tag: `px${t}`, status: "open" });
    await rawIdentity(client.id, "github", `client-gh-${t}`);
    for (const [path, shown] of [[`/b/${builder.handle}`, `px${t} builder`], [`/builders?q=px${t}`, `px${t} builder`]] as const) {
      const html = await get(path);
      expect(html, path).toContain(shown); // positive: the real builder name (makeInquiry names it "<tag> builder")
      expectNoIdentity(html, [`client-gh-${t}`]);
    }
  });

  it("a pending builder with an opted-in GitHub row: their /b/ page is 404 and the directory shows nothing of it", async () => {
    const t = tag();
    const b = await makeBuilder(`py${t}@vnx.si`, `py${t}`, "pending");
    await rawIdentity(b.userId, "github", `pending-gh-${t}`);
    expect((await createApp().request(getReq(`/b/py${t}`), undefined, testEnv)).status).toBe(404);
    expectNoIdentity(await get("/builders"), [`pending-gh-${t}`]);
  });
});
```


- [ ] **Step 7: Test kiến trúc (đỏ rồi xanh).** Trong `apps/web/test/architecture.test.ts`: (1) thêm `"../src/routes/builder-profile.tsx"` vào `IDENTITY_ALLOWED` (cùng `routes/hub.tsx` của Task 10) và sửa chú thích dòng trên; (2) thêm khối sau ngay dưới khối `describe("linked identities stay in their module …")`:

```ts
// VNX-2606b (ADR-004, ADR-012 §5): the identity badge is never an input to ranking, and a client's linked accounts never reach builder-facing or public code.
const SHOW_FLAG_FILES = new Set(["../src/domain/identity.ts", "../src/db/identities.ts", "../src/views/hub/ProfilePage.tsx"]);
const IDENTITY_WORDS = /user_identities|show_on_profile|showOnProfile|listPublicBadges|PublicBadge|githubProfileUrl|domain\/identity|db\/identities/;

describe("the identity badge stays out of ranking and builder-facing code (ADR-004, ADR-012 §5)", () => {
  it("the identities allowlist is exactly the files that read or write the table", () => {
    expect([...IDENTITY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/identities.ts", "../src/routes/builder-profile.tsx", "../src/routes/hub.tsx", "../src/routes/me.tsx", "../src/routes/oauth.tsx"]);
  });

  it("no ranking, catalogue, directory or suggestion file mentions identities, the badge flag or the badge query", () => {
    for (const file of RANKING_FILES) expect(sources[file], `${file} touches identities`).not.toMatch(IDENTITY_WORDS);
  });

  it("only the identity module and the builder's own switch view mention show_on_profile", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (SHOW_FLAG_FILES.has(file)) continue;
      expect(src, `${file} reads the badge flag`).not.toMatch(/show_on_profile|showOnProfile/);
    }
  });

  it("builder-facing client code (inbox, thread, invitations, notices) does not touch identities", () => {
    for (const file of [...BUILDER_FACING_FILES, "../src/routes/hub-invitations.tsx", "../src/views/ProposalView.tsx"]) {
      expect(sources[file], file).toBeDefined();
      expect(sources[file], `${file} touches identities`).not.toMatch(IDENTITY_WORDS);
    }
  });

  it("the public profile route reads identities only through listPublicBadges, and the hub only its own builder's rows", () => {
    const profile = sources["../src/routes/builder-profile.tsx"] ?? "";
    const calls = (src: string, name: string) => (src.match(new RegExp(`${name}\\(`, "g")) ?? []).length;
    const exact = (src: string, re: RegExp) => (src.match(re) ?? []).length;
    expect(calls(profile, "listPublicBadges")).toBeGreaterThan(0);
    expect(calls(profile, "listPublicBadges")).toBe(exact(profile, /listPublicBadges\(c\.env\.DB, builder\.userId, providers\)/g)); // every call is for the builder shown
    for (const name of ["listIdentitiesForUser", "findIdentityByProviderSubject", "linkIdentity", "unlinkIdentity", "setShowOnProfile"]) expect(profile, name).not.toContain(name);
    const hub = sources["../src/routes/hub.tsx"] ?? "";
    expect(calls(hub, "listIdentitiesForUser")).toBeGreaterThan(0);
    expect(calls(hub, "listIdentitiesForUser")).toBe(exact(hub, /listIdentitiesForUser\(c\.env\.DB, builder\.userId\)/g)); // every call is for the signed-in builder
    expect(calls(hub, "setShowOnProfile")).toBeGreaterThan(0);
    expect(calls(hub, "setShowOnProfile")).toBe(exact(hub, /setShowOnProfile\(c\.env\.DB, \{ userId: c\.get\("builder"\)\.userId,/g));
    for (const name of ["findIdentityByProviderSubject", "linkIdentity", "unlinkIdentity", "listPublicBadges"]) expect(hub, name).not.toContain(name);
  });

  it("views import no db module (the badge reaches the page as a plain prop)", () => {
    for (const file of ["../src/views/BuilderProfilePage.tsx", "../src/views/hub/ProfilePage.tsx", "../src/views/BuilderCard.tsx"]) {
      expect(sources[file], file).toBeDefined();
      expect(sources[file], `${file} imports db`).not.toMatch(/from\s+["'][^"']*\/db\//);
    }
  });
});
```
  Kiểm tay trước khi chạy: (a) `BUILDER_FACING_FILES` đứng ở dòng ≈ 70 và đã khai báo trước khối này (khối mới nằm sau, nên dùng được); (b) `grep -rn "ORDER BY" apps/web/src/db` và nếu có file nào khác xếp hạng builder hay product (ví dụ landing, Trending, Top) chưa có trong `RANKING_FILES`, thêm nó vào danh sách đó (một dòng) và ghi vào báo cáo; (c) `views/BuilderCard.tsx` có thật; (d) `views/hub/ProfilePage.tsx` mention `showOnProfile` là hợp lệ (đã có trong `SHOW_FLAG_FILES`), và `src/domain/identity.ts` không bị `IDENTITY_WORDS` quét vì nó không nằm trong `RANKING_FILES` hay `BUILDER_FACING_FILES`. Chạy `npm test -w apps/web -- test/architecture.test.ts`. Mong đợi: PASS. Làm một lần thử "có răng": thêm tạm `import "../db/identities.ts"` vào `src/db/directory.ts`, xác nhận hai test đỏ, rồi bỏ.

- [ ] **Step 8: Kiểm toàn bộ và commit.**
```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/domain/identity.ts apps/web/src/auth/oauth/github.ts apps/web/src/db/identities.ts apps/web/src/routes/builder-profile.tsx apps/web/src/views/BuilderProfilePage.tsx apps/web/public/assets/app.css \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/public/builder-badges.test.ts apps/web/test/hub/client-identity-privacy.test.ts apps/web/test/db/identities.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): verified GitHub and LinkedIn badge on the public builder profile (VNX-2606b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
  (nếu Step 7 thêm file vào `RANKING_FILES` thì không có file src nào khác cần `git add`; nếu `BuilderProfilePage` có nơi gọi khác phải sửa, thêm file đó vào lệnh `git add`.)

**Kích cỡ ước tính:** mã ≈ 130 dòng (domain 14, github.ts -3 +2, db 35, route 8, view 25, css 2, locale ngoài), test ≈ 450 dòng (badges 320, privacy 90, domain 25, db/ordering 15), kiến trúc ≈ 50 dòng. Dưới 600 không tính locale: không tách.

**Nghĩa vụ cho task sau:**
- **BẮT BUỘC khi rebase lên `main` (M7 đã ở `main`, `38bf414`; H1, Owner 2026-10-10):** (1) mở rộng test thứ tự thêm `topBuilders(loadBuilderTallies(db, now))`: dựng builder có tally, bật huy hiệu cho các builder xếp thấp, thứ tự không đổi; (2) khi giải xung đột `test/architecture.test.ts`, GIỮ 7 mục `RANKING_FILES` mà `main` thêm (`domain/public-stats.ts`, `db/public-stats.ts`, `jobs/hourly.ts`, `routes/home.tsx`, `views/home/Trending.tsx`, `views/home/TopBuilders.tsx`, `views/home/TopProducts.tsx`) cùng các mục của nhánh này; (3) xác nhận các assertion identity (không import `db/identities`, không có SQL/từ khóa `IDENTITY_WORDS`) chạy trên danh sách đã gộp và xanh. Task chưa xong cho tới khi (1)-(3) làm xong; ghi vào báo cáo rebase.
- **Task 12 (VNX-2607):** chép câu Privacy "A builder can choose to show their GitHub username, or the fact that their LinkedIn account is verified … Google accounts are never shown, and builders never see a client's linked accounts"; nay đúng với code và có test (`builder-badges`, `client-identity-privacy`, kiến trúc). Câu lưu giữ "until you unlink them or your account is deleted" khớp quyết định 4 (rời `approved` giữ hàng và cờ).
- **VNX-2608 (HUMAN):** thử bằng tài khoản thật: (a) tài khoản GitHub thường: link mở đúng hồ sơ; (b) tài khoản EMU (nếu có): ghi lại link có 404 với khách không, để Owner xem lại quyết định E2 (giữ link) bằng dữ liệu thật; (c) tắt cờ một provider thì huy hiệu của nó biến mất khỏi `/b/` và công tắc khỏi `/hub/profile`, bật lại thì trở lại; (d) nếu code đã thêm Cache API hoặc `Cache-Control: public`/`s-maxage` cho `/b/*` thì TTL phải ngắn và cache được xóa khi tắt huy hiệu, hủy liên kết và đổi trạng thái builder (quyết định 5).
- **Ghi nhận (link `/go/`, L6):** link GitHub của badge đi thẳng, như link website và portfolio của builder (ADR-007 addendum, và test `builder-profile.test.ts`); không cần Owner quyết. Chữ của ADR-007 §7 ("Mọi link ra ngoài đi qua /go/") rộng hơn cách nó được áp dụng: `/go/` chỉ phục vụ offer/affiliate. Nếu Owner muốn câu chữ khớp thực tế, sửa ADR-007 §7 là việc riêng.
- **Ghi nhận:** `login` GitHub đổi tên thì `label` chỉ được làm mới ở lần đăng nhập kế (ADR-012 §5, `touchIdentityLogin`); trước đó huy hiệu link tới login cũ (có thể 404 hoặc sang người khác). Chấp nhận theo ADR; nếu Owner thấy là rủi ro mạo danh, đó là quyết định mới (làm mới định kỳ cần gọi GitHub, cần ADR).

#### Kết quả review Task 10–11 (Opus, 2026-10-10): APPROVE_WITH_CHANGES, đã sửa M1–M5, L1–L6, S1–S3, H1; câu chữ và E1/E2 do Owner duyệt 2026-10-10

---

### Task 9c: VNX-2605c — Hủy liên kết kết thúc các session `oauth_<provider>` (bảng thứ tự để "—" cho dòng này nên không chiếm số 12; số 12 là VNX-2607)

**Phụ thuộc:** Task 9 (APPROVE). **Review Focus:** 6 (audit cùng batch, không token), 4, 7. **Bắt buộc trước VNX-2608** (Owner 2026-10-10).

**Mục tiêu.** Lý do của Owner: kẻ đã liên kết tài khoản provider của mình vào tài khoản nạn nhân (cần một session sống của nạn nhân) rồi đăng nhập bằng nó giữ được phiên `oauth_<provider>` tới 30 ngày sau khi nạn nhân hủy liên kết. Sau task này: `POST /me/identities/:provider/unlink` xóa các session của chính user đó có `method = oauth_<provider>`, **trong cùng `db.batch`** với việc xóa hàng `user_identities` và dòng audit. Không đổi schema. Thêm một câu vào email hủy liên kết (E3) và đóng race ở callback đăng nhập (quyết định 10). Các quyết định E1–E4 của Owner 2026-10-10 nằm trong mục "Đã chốt".

**Quyết định kỹ thuật** (từ code thật; Reviewer kiểm):
1. **Hàm ghi `sessions` nằm ở `auth/sessions.ts`** (người ghi duy nhất; `WRITERS.sessions` ở `test/architecture.test.ts:27` bắt mọi `DELETE FROM sessions` ngoài file này). Thêm `endProviderSessionsStatement(db, { userId, provider }) → D1PreparedStatement`, cùng kiểu với `deleteUserSessionsStatement` (route `admin-users.tsx` đã ghép nó vào batch của route).
2. **Ghép vào batch: tham số bắt buộc `endSessions` của `unlinkIdentity`; `db/identities.ts` KHÔNG import `auth/`.** `ARCHITECTURE.md` §2: `db/` chỉ phụ thuộc domain, `auth/` phụ thuộc db; import `db → auth` đảo chiều và dễ tạo vòng. `unlinkIdentity` vẫn sở hữu `db.batch` (một chỗ duy nhất xóa `user_identities` và ghi audit), nhận một statement dựng sẵn và chạy nó giữa audit và DELETE. Tham số **bắt buộc** (kiểu `D1PreparedStatement`) nên người gọi sau này không quên kết thúc session. Không thêm `user_identities` vào SQL của `sessions.ts` (allowlist `IDENTITY_ALLOWED` chặn `FROM user_identities` ngoài 6 file; không nới).
3. **Thứ tự batch:** `[audit (guard: hàng identity còn), endSessions, DELETE user_identities … RETURNING]`. D1 chạy batch như một transaction: statement nào lỗi thì cả batch hoàn tác (test nguyên tử ở Step 1 chứng minh bằng trigger thật). `endSessions` không có guard riêng (không đọc `user_identities`): hai lần bấm đồng thời thì lần sau xóa 0 hàng, vô hại; trường hợp `existing` null thì `unlinkIdentity` thoát sớm trước batch nên **không xóa gì** (`notLinked`).
4. **Chỉ đúng `user_id` và `method`:** `DELETE FROM sessions WHERE user_id = ?1 AND method = ?2`; `?2 = sessionMethodFor(provider)` (`domain/identity.ts`). Session `magic_link`, session của provider khác, session của user khác không bao giờ khớp. Dùng `idx_sessions_user` (migration 0003). **Bất biến (Owner E1 = b1, 2026-10-10): không còn session `oauth_<P>` nào của user này sau một lần hủy liên kết P.**
5. **Session của người bấm (Owner E1 = b1):** nếu session đang bấm có `method = oauth_<P>` thì nó cũng bị xóa bởi cùng câu DELETE; route chỉ cần xóa cookie: `if (removed && user.method === sessionMethodFor(provider)) clearSessionCookie(c)`, rồi 303 về `/me?link=unlinked` như thường. `requireUser` đưa người dùng tới `/login?next=…`, đăng nhập xong họ thấy thông báo "unlinked" có sẵn. Không có hằng số chính sách, không băm cookie, không chuỗi giao diện mới. Người bấm từ session `magic_link` hay provider khác thì giữ nguyên session.
6. **(đã bỏ, thuộc phương án giữ session người bấm)**
7. **Audit giữ `{ provider }`** (quyết định 7 của Reviewer). Không ghi số session đã kết thúc: `unlinkIdentity` phải đếm trước khi xóa rồi nhét số vào dữ liệu audit bằng subquery, thêm phụ thuộc giữa hai bảng cho một con số mà luật tất định ("mọi session `oauth_<provider>` của user này") đã nói đủ; không có lý do mạnh để đổi.
8. **Không backfill.** Cờ provider đang tắt trên production nên chưa có session `oauth_*` thật; không cần SQL dọn một lần cho các lần hủy trước task này.
9. **Email hủy liên kết thêm một câu (Owner E3, duyệt nguyên văn 2026-10-10):** khóa `email.identityUnlinked.sessions` đặt sau `email.identityUnlinked.body` trong email hủy liên kết. Gửi mail vẫn sau batch; mail lỗi không hoàn tác việc kết thúc session (có test).
10. **Race ở callback đăng nhập (`routes/oauth.tsx:157-171`, review MEDIUM-1).** Hiện callback: tìm identity, `markLogin`, `writeAudit`, `touchIdentityLogin`, `createSession`. Nếu hủy liên kết chen vào sau `findIdentityByProviderSubject` thì `createSession` vẫn tạo session `oauth_<P>` sau khi batch hủy đã xóa, và session đó sống 30 ngày: đúng lỗ hổng task này đóng. Sửa: **tạo session trước, rồi xác nhận identity còn**: `touchIdentityLogin` đổi thành `UPDATE user_identities SET … WHERE id = ?1 AND user_id = ?4 RETURNING id` và trả `boolean`; nếu hàng đã mất thì `deleteSession(db, raw)`, trả trang "chưa liên kết" có sẵn (cùng byte với mọi trường hợp chưa liên kết) và **không đặt cookie session**. Quyết định: chuyển `writeAudit` `auth.login` xuống **sau** bước xác nhận này để một lần đăng nhập bị từ chối không để lại dòng `auth.login`; `markLogin` (cập nhật `last_login_at`) giữ trước vì nó là thao tác trên `users` và đã là hành vi hiện có. Ghi lại: lần chen vào giữa `touchIdentityLogin` và việc đặt cookie không còn nguy hiểm, vì session đã tạo sau lần xác nhận cuối chỉ bị xóa bởi lần hủy nếu hủy chạy sau (batch xóa mọi `oauth_<P>` của user).
11. **Cỡ:** ≈ 70 dòng mã, ≈ 330 dòng test; dưới 600, không tách.

**Đã chốt (Owner 2026-10-10; không còn câu hỏi mở):**
- **E1 = (b1):** hủy liên kết P cũng kết thúc session của chính người bấm khi session đó có `method = oauth_<P>`; route xóa cookie và 303 về `/me?link=unlinked` đã bản địa hóa; `requireUser` đưa tới `/login?next=…`, đăng nhập xong người dùng thấy thông báo "unlinked" có sẵn. Không chuỗi mới.
- **E2:** "đăng xuất các phiên khác" như hành động chung đưa vào backlog sau VNX-2608 (xem "Ghi nhận").
- **E3:** email hủy liên kết thêm một câu, duyệt nguyên văn 4 locale (bảng dưới).
- **E4:** phần bổ sung pháp lý về tài khoản liên kết KHÔNG phải "thay đổi quan trọng": không báo trước (Task 12).

| Khóa (thêm ngay sau `email.identityUnlinked.body` của từng file locale; KHÔNG có chú thích "BẢN NHÁP") | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `email.identityUnlinked.sessions` | Every device that was signed in with it has been signed out. | Mọi thiết bị đang đăng nhập bằng tài khoản đó đã được đăng xuất. | 所有用该账号登录的设备都已退出登录。 | 所有用該帳號登入的裝置都已登出。 |

Trong `email/templates/identity.ts` (`compose`): khi `kind === "unlinked"`, chèn `p(tr("email.identityUnlinked.sessions"))` ngay sau `p(body)` (HTML) và một dòng tương ứng sau `body` trong `text`; email liên kết không đổi. Test: `identity-templates.test.ts` (mỗi locale email hủy chứa câu, email liên kết không chứa) và `identity-unlink.test.ts` (email gửi thật chứa câu).

**Files:**
- Modify: `apps/web/src/auth/sessions.ts`, `apps/web/src/db/identities.ts` (`unlinkIdentity`, `touchIdentityLogin`), `apps/web/src/routes/me.tsx`, `apps/web/src/routes/oauth.tsx`, `apps/web/src/email/templates/identity.ts`, 4 file `apps/web/src/i18n/messages/*.ts`, `apps/web/test/db/identities.test.ts` (3 lời gọi `unlinkIdentity`, lời gọi `touchIdentityLogin`), `apps/web/test/email/identity-templates.test.ts`, `apps/web/test/me/identity-unlink.test.ts`, `apps/web/test/architecture.test.ts` (hai assertion).
- Create: `apps/web/test/auth/end-provider-sessions.test.ts`, `apps/web/test/me/identity-unlink-sessions.test.ts`, `apps/web/test/auth/oauth-unlink-race.test.ts`.

**Interfaces:**
- Consumes: `unlinkIdentity`, `touchIdentityLogin`, `UserIdentity` (`db/identities.ts`); `sessionMethodFor`, `OAuthProvider`, `SessionMethod` (`domain/identity.ts`); `clearSessionCookie` (`auth/cookies.ts`); `deleteSession`, `createSession` (`auth/sessions.ts`); `signIn(email, { method })`, `ensureUser` (`test/fixtures.ts`); `linkedUser`, `enableProvider`, `startOAuth`, `issueCodeFor`, `callbackReq` (`test/oauth-flow.ts`); `formPost`, `getReq`, `testEnv` (`test/helpers.ts`).
- Produces: `endProviderSessionsStatement(db, { userId, provider })` (`auth/sessions.ts`); `unlinkIdentity(db, { userId, provider, now, endSessions })` với `endSessions: D1PreparedStatement` bắt buộc; `touchIdentityLogin(db, { id, userId, label, now }) → Promise<boolean>` (`db/identities.ts`).

- [ ] **Step 1: Test mức DB (đỏ).** Tạo `apps/web/test/auth/end-provider-sessions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { endProviderSessionsStatement } from "../../src/auth/sessions.ts";
import { unlinkIdentity } from "../../src/db/identities.ts";
import type { OAuthProvider, SessionMethod } from "../../src/domain/identity.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`; // D1 is shared: per-test addresses, no global counts
const NOW = "2026-10-10T09:00:00.000Z";
const methodsOf = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT method FROM sessions WHERE user_id = ?1 ORDER BY method, id_hash").bind(userId).all<{ method: string }>()).results.map((r) => r.method);
const audits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink'").bind(userId).all<{ data: string }>()).results.map((r) => r.data);
const unlink = (userId: string, provider: OAuthProvider) =>
  unlinkIdentity(testEnv.DB, { userId, provider, now: NOW, endSessions: endProviderSessionsStatement(testEnv.DB, { userId, provider }) });
const sessionFor = (email: string, method: SessionMethod) => signIn(email, { method });

describe("unlinkIdentity ends the provider's sessions in its own batch (VNX-2605c)", () => {
  it("ends the user's sessions of that provider and only those; the audit row stays { provider }", async () => {
    const email = `lan-${tag()}@example.com`;
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    for (const m of ["magic_link", "oauth_github", "oauth_github", "oauth_google", "oauth_linkedin"] as const) await sessionFor(email, m);
    expect(await unlink(user.id, "github")).toMatchObject({ provider: "github" });
    expect(await methodsOf(user.id)).toEqual(["magic_link", "oauth_google", "oauth_linkedin"]);
    expect(await audits(user.id)).toEqual(['{"provider":"github"}']); // no session count, no hash
  });

  it("never touches another user's sessions, even of the same provider", async () => {
    const a = await linkedUser(`a-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `a-${tag()}` });
    const b = await linkedUser(`b-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `b-${tag()}` });
    await sessionFor(a.user.email, "oauth_github");
    await sessionFor(b.user.email, "oauth_github");
    await unlink(a.user.id, "github");
    expect(await methodsOf(a.user.id)).toEqual([]);
    expect(await methodsOf(b.user.id)).toEqual(["oauth_github"]);
    expect(await audits(b.user.id)).toEqual([]);
  });

  it("an unlink that does not happen (notLinked) deletes nothing and audits nothing", async () => {
    const email = `lan-${tag()}@example.com`;
    const { user } = await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    await sessionFor(email, "oauth_github"); // a session of a provider the user has no identity for
    await sessionFor(email, "oauth_google");
    expect(await unlink(user.id, "github")).toBeNull();
    expect(await methodsOf(user.id)).toEqual(["oauth_github", "oauth_google"]);
    expect(await audits(user.id)).toEqual([]);
  });

  it("a user who does not hold the identity cannot end the holder's sessions", async () => {
    const holder = await linkedUser(`h-${tag()}@example.com`, "github", { subject: `s-${tag()}`, label: `h-${tag()}` });
    const other = await linkedUser(`o-${tag()}@example.com`, "google", { subject: `s-${tag()}`, label: `o-${tag()}@gmail.example` });
    await sessionFor(holder.user.email, "oauth_github");
    expect(await unlink(other.user.id, "github")).toBeNull();
    expect(await methodsOf(holder.user.id)).toEqual(["oauth_github"]);
  });

  it("is atomic: when the identity DELETE fails, the sessions, the row and the audit are all untouched", async () => {
    const email = `lan-${tag()}@example.com`;
    const label = `boom-${tag()}`;
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label });
    await sessionFor(email, "oauth_github");
    await sessionFor(email, "oauth_github");
    // A trigger that aborts only the DELETE of this row: the batch is one transaction, so nothing before it may stick.
    await testEnv.DB.prepare(`CREATE TRIGGER vnx_test_unlink_boom BEFORE DELETE ON user_identities WHEN OLD.label = '${label}' BEGIN SELECT RAISE(ABORT, 'boom'); END`).run();
    try {
      await expect(unlink(user.id, "github")).rejects.toThrow();
      expect(await methodsOf(user.id)).toEqual(["oauth_github", "oauth_github"]);
      expect((await testEnv.DB.prepare("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1").bind(user.id).first<{ n: number }>())?.n).toBe(1);
      expect(await audits(user.id)).toEqual([]);
    } finally {
      await testEnv.DB.prepare("DROP TRIGGER IF EXISTS vnx_test_unlink_boom").run();
    }
    expect(await unlink(user.id, "github")).not.toBeNull(); // without the trigger the same call goes through
    expect(await methodsOf(user.id)).toEqual([]);
  });
});


- [ ] **Step 2: Chạy, thấy đỏ.** `npm test -w apps/web -- test/auth/end-provider-sessions.test.ts` → FAIL (chưa có `endProviderSessionsStatement`; chữ ký `unlinkIdentity` chưa có `endSessions`).

- [ ] **Step 3: Cài đặt lõi (xanh).**

`apps/web/src/auth/sessions.ts`: thêm dòng import `sessionMethodFor` và `type OAuthProvider` từ `../domain/identity.ts` (file đã import `isSessionMethod, SessionMethod` từ đó); thêm cuối file:

```ts
/**
 * Ends this user's sessions that were created by signing in with that provider (VNX-2605c). Built for the unlink batch: it runs in the same
 * db.batch as the identity DELETE and its audit row, so all three commit or none do. Another user's sessions and this user's other methods never match.
 * All of them, the caller's own included (Owner E1 = b1): no session made through that provider survives an unlink. It reads no other table; with the
 * identity already gone (a double press) it can only end sessions of that provider created since, so it signs the user out and never grants access.
 */
export function endProviderSessionsStatement(db: D1Database, input: { userId: string; provider: OAuthProvider }): D1PreparedStatement {
  return db.prepare("DELETE FROM sessions WHERE user_id = ?1 AND method = ?2").bind(input.userId, sessionMethodFor(input.provider));
}
```

`apps/web/src/db/identities.ts`: thay docstring và hàm `unlinkIdentity`:

```ts
/**
 * Removes the user's account of that provider and audits it, atomically, together with `endSessions`: the statement that ends the sessions
 * made through that provider (`endProviderSessionsStatement`; the caller builds it because `auth/` owns `sessions` and `db/` does not import `auth/`).
 * Required, so no caller can unlink without ending them. The audit statement runs first: it is guarded on the row existing for that user,
 * which is no longer true after the DELETE. Null (no audit row, nothing deleted, `endSessions` never run) when the user has none.
 */
export async function unlinkIdentity(
  db: D1Database,
  input: { userId: string; provider: OAuthProvider; now: string; endSessions: D1PreparedStatement },
): Promise<UserIdentity | null> {
  const existing = await db.prepare("SELECT * FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(input.userId, input.provider).first<Row>();
  if (!existing) return null;
  const results = await db.batch<{ id: string }>([
    auditStatement(
      db,
      { actorUserId: input.userId, action: IDENTITY_AUDIT.unlink, entity: "user", entityId: input.userId, data: { provider: input.provider }, now: input.now },
      { identityId: existing.id, userId: input.userId },
    ),
    input.endSessions,
    db.prepare("DELETE FROM user_identities WHERE id = ?1 AND user_id = ?2 RETURNING id").bind(existing.id, input.userId),
  ]);
  return results[2]?.results.length ? toIdentity(existing) : null;
}
```

`apps/web/test/db/identities.test.ts`: import `endProviderSessionsStatement` từ `../../src/auth/sessions.ts`; thêm `const end = (userId: string, provider: "google" | "github" | "linkedin") => endProviderSessionsStatement(testEnv.DB, { userId, provider });` và thêm `endSessions: end(<userId>, <provider>)` vào ba lời gọi `unlinkIdentity` (và thêm `userId` vào lời gọi `touchIdentityLogin`, xem Step 5b) (dòng 72, 76: `end(user.id, "linkedin")`; dòng 85: `end(other.id, "github")`).

Chạy lại Step 1 và `npm test -w apps/web -- test/db/identities.test.ts` → PASS.

- [ ] **Step 4: Test route (đỏ).** Tạo `apps/web/test/me/identity-unlink-sessions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { SessionMethod } from "../../src/domain/identity.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const unlink = (provider: string, cookie: string, headers: Record<string, string> = {}) =>
  createApp().request(formPost(`/me/identities/${provider}/unlink`, {}, { cookie, ...headers }), undefined, testEnv);
const meRes = (cookie: string) => createApp().request(getReq("/me", cookie), undefined, testEnv);
const meStatus = async (cookie: string) => (await meRes(cookie)).status;
const sessionFor = (email: string, method: SessionMethod) => signIn(email, { method });
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;

beforeEach(() => {
  clearOutbox();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("unlinking ends the provider's sessions (VNX-2605c)", () => {
  it("from a magic-link session: every GitHub session of the user is signed out on its next request; the others carry on", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const caller = await sessionFor(email, "magic_link");
    const github1 = await sessionFor(email, "oauth_github");
    const github2 = await sessionFor(email, "oauth_github");
    const other = await sessionFor(email, "magic_link"); // another device, e-mail link
    const google = await sessionFor(email, "oauth_google");
    expect(await meStatus(github1.cookie)).toBe(200); // alive before
    const res = await unlink("github", caller.cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    for (const ended of [github1, github2]) {
      const after = await meRes(ended.cookie);
      expect(after.status).toBe(303); // requireUser: no session any more
      expect(after.headers.get("location")).toContain("/login");
    }
    for (const alive of [caller, other, google]) expect(await meStatus(alive.cookie)).toBe(200);
  });

  it("the caller's own session (Owner E1 = b1): a GitHub session that unlinks GitHub is signed out too, its row is gone, the cookie is cleared", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const mine = await sessionFor(email, "oauth_github");
    const elsewhere = await sessionFor(email, "oauth_github");
    const res = await unlink("github", mine.cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session=") && /Max-Age=0/i.test(l))).toBe(true); // cookie cleared
    expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
    for (const ended of [mine, elsewhere]) {
      const next = await meRes(ended.cookie); // the next request to /me
      expect(next.status).toBe(303);
      expect(next.headers.get("location")).toContain("/login");
    }
  });

  it("a caller on an oauth_google session who unlinks GitHub stays signed in (and the GitHub sessions end)", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const google = await sessionFor(email, "oauth_google");
    const github = await sessionFor(email, "oauth_github");
    const res = await unlink("github", google.cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false); // not cleared
    expect(await meStatus(google.cookie)).toBe(200);
    expect(await meStatus(github.cookie)).toBe(303);
  });

  it("another user's sessions (even their GitHub ones) are untouched", async () => {
    const a = emailOf("a");
    const b = emailOf("b");
    await linkedUser(a, "github", { subject: `s-${tag()}`, label: `a-${tag()}` });
    await linkedUser(b, "github", { subject: `s-${tag()}`, label: `b-${tag()}` });
    const aSession = await sessionFor(a, "magic_link");
    const bGithub = await sessionFor(b, "oauth_github");
    await unlink("github", aSession.cookie);
    expect(await meStatus(bGithub.cookie)).toBe(200);
  });

  it("an unlink that does not happen (notLinked) ends nothing", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const caller = await sessionFor(email, "magic_link");
    const github = await sessionFor(email, "oauth_github"); // a session with no identity behind it
    const res = await unlink("github", caller.cookie);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await meStatus(github.cookie)).toBe(200);
  });

  it("a refused request (foreign Origin, signed out) ends nothing", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const caller = await sessionFor(email, "magic_link");
    const github = await sessionFor(email, "oauth_github");
    expect((await unlink("github", caller.cookie, { origin: "https://evil.example" })).status).toBe(403);
    expect((await createApp().request(formPost("/me/identities/github/unlink", {}), undefined, testEnv)).status).toBe(303); // to /login
    expect(await meStatus(github.cookie)).toBe(200);
  });

  it("a failing mailer does not bring the sessions back; the sent e-mail carries the sessions sentence", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const caller = await sessionFor(email, "magic_link");
    await sessionFor(email, "oauth_github");
    const send = vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error("boom"));
    await unlink("github", caller.cookie);
    send.mockRestore();
    expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
    const again = emailOf("lan2");
    await linkedUser(again, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await unlink("github", (await sessionFor(again, "magic_link")).cookie);
    const mails = outbox.filter((m) => m.to === again);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Every device that was signed in with it has been signed out.");
  });
});
```
Chạy `npm test -w apps/web -- test/me/identity-unlink-sessions.test.ts` → FAIL ở "from a magic-link session" (session GitHub còn sống; TypeScript cũng đỏ vì route chưa truyền `endSessions`).

- [ ] **Step 5: Route (xanh).** `apps/web/src/routes/me.tsx`: import `clearSessionCookie` từ `../auth/cookies.ts` (dòng `readSessionCookie` hiện có vẫn dùng cho route link), `endProviderSessionsStatement` từ `../auth/sessions.ts`; mở rộng dòng import `isOAuthProvider` từ `../domain/identity.ts` thêm `sessionMethodFor`. Thay thân route unlink:

```ts
  onLocalized(app, "post", "/me/identities/:provider/unlink", requireUser, async (c) => {
    const provider = c.req.param("provider");
    if (!isOAuthProvider(provider)) return errorResponse(c, "notFound", 404);
    const user = c.get("user")!;
    const now = new Date().toISOString();
    // VNX-2605c: the same batch ends EVERY session of this user made through `provider`, the caller's own included (Owner E1 = b1).
    const removed = await unlinkIdentity(c.env.DB, { userId: user.id, provider, now, endSessions: endProviderSessionsStatement(c.env.DB, { userId: user.id, provider }) });
    if (removed) await notifyIdentityChange(c.env, { kind: "unlinked", to: user.email, locale: user.locale, provider, label: removed.label, at: now, requestId: c.get("requestId") });
    // The caller's own session was deleted too when it came in through this provider: clear its cookie. The redirect is unchanged; `requireUser` then sends them to /login?next=…
    if (removed && user.method === sessionMethodFor(provider)) clearSessionCookie(c);
    return c.redirect(`${localizedPath(c.get("locale"), "/me")}?link=${removed ? "unlinked" : "notLinked"}`, 303);
  });
```
Sửa dòng chú thích phía trên route: thêm "and ends every session of this user made through that provider". Chạy lại Step 4 → PASS.

**Email (E3):** thêm khóa `email.identityUnlinked.sessions` vào 4 file locale và vào `compose` của `email/templates/identity.ts` như mục "Đã chốt"; chạy `npm test -w apps/web -- test/email/identity-templates.test.ts test/me/identity-unlink.test.ts test/i18n`.

- [ ] **Step 5b: Race ở callback đăng nhập (đỏ rồi xanh; quyết định 10).** Tạo `apps/web/test/auth/oauth-unlink-race.test.ts`. Dùng helper của `test/oauth-flow.ts` (`enableProvider`, `startOAuth`, `issueCodeFor`, `callbackReq`, `linkedUser`) và so trang "chưa liên kết" với trang của một callback bằng identity chưa liên kết đúng cách test byte-identity của Task 6 (`test/auth/oauth-routes.test.ts`; tái dùng helper so byte trừ request id của nó, bọc thành `sameAsNotLinkedPage(res)`). Hai trigger mô phỏng "hủy liên kết chen vào": (i) `AFTER UPDATE ON users` (chạy trong `markLogin`), (ii) `AFTER INSERT ON sessions` (chạy khi tạo session); cả hai xóa identity của user như một lần hủy đồng thời.

```ts
const cases = [
  { name: "vnx_test_race_users", event: "AFTER UPDATE ON users", cond: (id: string) => `NEW.id = '${id}'` },
  { name: "vnx_test_race_sessions", event: "AFTER INSERT ON sessions", cond: (id: string) => `NEW.user_id = '${id}'` },
];
for (const c of cases) {
  it(`unlinked mid sign-in (${c.name}): the not-linked page, no session cookie, no oauth_github session, no auth.login audit`, async () => {
    await enableProvider("github");
    const email = `lan-${tag()}@example.com`;
    const identity = { subject: `s-${tag()}`, label: `l-${tag()}` };
    const { user } = await linkedUser(email, "github", identity);
    const started = await startOAuth("github");
    const code = issueCodeFor("github", started, identity);
    await testEnv.DB.prepare(`CREATE TRIGGER ${c.name} ${c.event} WHEN ${c.cond(user.id)} BEGIN DELETE FROM user_identities WHERE user_id = '${user.id}'; END`).run();
    try {
      const res = await callbackReq("github", { code, state: started.flow.state }, started.cookie);
      expect(res.status).toBe(200); // the same page as for an unlinked account (Task 6)
      expect(await sameAsNotLinkedPage(res)).toBe(true);
      expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
    } finally {
      await testEnv.DB.prepare(`DROP TRIGGER IF EXISTS ${c.name}`).run(); // always dropped
    }
    expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
    expect(await n("SELECT count(*) AS n FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.login'", user.id)).toBe(0);
  });
}
```
(`n`, `tag` như các file test khác.) Chạy `npm test -w apps/web -- test/auth/oauth-unlink-race.test.ts` → FAIL (session `oauth_github` còn sống, cookie được đặt). Cài đặt:

`apps/web/src/db/identities.ts`:

```ts
/** A sign-in with this identity: records the time and refreshes the label (the GitHub login can change; ADR-012 §5). False when the row is gone (unlinked meanwhile): the caller must then end the session it just made. */
export async function touchIdentityLogin(db: D1Database, input: { id: string; userId: string; label: string; now: string }): Promise<boolean> {
  const { results } = await db
    .prepare("UPDATE user_identities SET label = ?2, last_used_at = ?3, updated_at = ?3 WHERE id = ?1 AND user_id = ?4 RETURNING id")
    .bind(input.id, input.label, input.now, input.userId)
    .all<{ id: string }>();
  return results.length === 1;
}
```
`apps/web/src/routes/oauth.tsx` (callback: thay các dòng từ `await markLogin` tới `writeSessionCookie`; thêm `deleteSession` vào import từ `../auth/sessions.ts`):

```ts
      await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(user.email) });
      // Session first, then confirm the identity still exists: an unlink that slipped in after the lookup above has already deleted the
      // `oauth_<provider>` sessions that existed (VNX-2605c), so a session made now must not outlive it.
      const raw = await createSession(c.env.DB, user.id, now, method);
      if (!(await touchIdentityLogin(c.env.DB, { id: identity.id, userId: user.id, label: result.identity.label, now: iso }))) {
        await deleteSession(c.env.DB, raw);
        return await page(c, <OAuthNotLinkedPage locale={flow.locale} origin={new URL(c.req.url).origin} />);
      }
      // The audit row comes after the check (decision 10): a refused sign-in leaves no `auth.login`.
      await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { method }, now: iso });
      writeSessionCookie(c, raw);
      return c.redirect(safeNext(flow.next) ?? localizedPath(flow.locale, "/"), 303);
```
Cập nhật `test/db/identities.test.ts`: lời gọi `touchIdentityLogin` thêm `userId`; thêm một test "returns false and changes nothing when the row is gone or belongs to another user". Chạy lại file race → PASS; `npm test -w apps/web -- test/auth/oauth-routes.test.ts test/auth/oauth-link.test.ts test/db/identities.test.ts` → PASS (byte-identity và log-shape của Task 6 giữ xanh; nếu một test Task 6 kiểm thứ tự `auth.login` trước `createSession`, sửa theo thứ tự mới và ghi vào báo cáo).

- [ ] **Step 6: Test kiến trúc.** Thêm vào `apps/web/test/architecture.test.ts`, sau khối `linked identities stay in their module`:

```ts
describe("unlinking ends the provider's sessions (VNX-2605c)", () => {
  it("db/ imports nothing from auth/ (ARCHITECTURE.md §2): the unlink batch receives its sessions statement", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (!file.startsWith("../src/db/")) continue;
      expect(src, `${file} imports auth/`).not.toMatch(/from\s+["']\.\.\/auth\//);
    }
  });

  it("the only caller of unlinkIdentity passes it endProviderSessionsStatement, and only auth/sessions.ts deletes sessions", () => {
    const callers = Object.entries(sources).filter(([file, src]) => /\bunlinkIdentity\(/.test(src) && file !== "../src/db/identities.ts");
    expect(callers.map(([file]) => file)).toEqual(["../src/routes/me.tsx"]);
    expect(callers[0]?.[1]).toContain("endProviderSessionsStatement(");
    for (const [file, src] of Object.entries(sources)) if (/DELETE FROM sessions/.test(src)) expect(file).toBe("../src/auth/sessions.ts");
  });
});
```
(`sources` chỉ gom `../src/**`, nên các file test không ảnh hưởng.)

- [ ] **Step 7: Tiêu chí chấp nhận.** (`EP` = `apps/web/test/auth/end-provider-sessions.test.ts`, `US` = `apps/web/test/me/identity-unlink-sessions.test.ts`; `npm test -w apps/web -- <đường dẫn> -t "<tên>"`)

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Session của provider P kết thúc; `magic_link` và provider khác còn; audit chỉ `{provider}` | `EP -t "ends the user's sessions of that provider"` |
| 2 | Session của user khác không bị chạm, kể cả cùng provider | `EP -t "another user's sessions"` và `US -t "another user's sessions"` |
| 3 | Session của người bấm: `oauth_<P>` bị đăng xuất, cookie xóa, hàng mất; `oauth_google` bấm hủy GitHub thì còn | `US -t "the caller's own session"` và `US -t "oauth_google session"` |
| 4 | Session đã kết thúc bị đăng xuất ở request kế tiếp (303 `/login`) | `US -t "from a magic-link session"` |
| 5 | `notLinked` và người không giữ identity: không xóa gì, không audit | `EP -t "does not happen"`, `EP -t "does not hold"`, `US -t "notLinked"` |
| 6 | Batch nguyên tử (trigger làm DELETE identity lỗi: session, hàng, audit còn nguyên) | `EP -t "is atomic"` |
| 7 | Request bị từ chối (Origin ngoài, chưa đăng nhập) không kết thúc gì | `US -t "refused request"` |
| 8 | Mail lỗi không hoàn tác việc kết thúc session; email hủy có câu "Every device…" 4 locale | `US -t "failing mailer"`, `npm test -w apps/web -- test/email/identity-templates.test.ts test/i18n` |
| 8b | Hủy chen vào giữa lúc đăng nhập: trang chưa liên kết, không cookie, không session, không audit `auth.login` | `npm test -w apps/web -- test/auth/oauth-unlink-race.test.ts` |
| 9 | Ranh giới: `db/` không import `auth/`; chỉ `me.tsx` gọi `unlinkIdentity` kèm statement; chỉ `sessions.ts` xóa `sessions` | `npm test -w apps/web -- test/architecture.test.ts` |
| 10 | Không hồi quy Task 1, 9 | `npm test -w apps/web -- test/db test/me test/auth` |
| 11 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test -- --maxWorkers=2` |

- [ ] **Step 8: Typecheck, toàn bộ test, commit**

```bash
npm run typecheck -w apps/web
npm test -- --maxWorkers=2
git add apps/web/src/auth/sessions.ts apps/web/src/db/identities.ts apps/web/src/routes/me.tsx apps/web/src/routes/oauth.tsx apps/web/src/email/templates/identity.ts \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/auth/end-provider-sessions.test.ts apps/web/test/me/identity-unlink-sessions.test.ts apps/web/test/auth/oauth-unlink-race.test.ts \
  apps/web/test/db/identities.test.ts apps/web/test/email/identity-templates.test.ts apps/web/test/me/identity-unlink.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): unlinking a provider ends the sessions made through it, in the same batch (VNX-2605c)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Kích cỡ ước tính:** mã ≈ 70 dòng (sessions 6, identities 14, me.tsx 8, oauth.tsx 12, template 6), test ≈ 330 dòng (DB 100, route 110, race 60, email 20, kiến trúc 20, sửa cũ 20); locale riêng. Dưới 600 không tính locale: không tách.

**Nghĩa vụ cho task sau:**
- **VNX-2608:** thử bằng provider thật: đăng nhập GitHub ở hai trình duyệt, hủy liên kết ở trình duyệt thứ ba (magic link), xác nhận hai phiên GitHub bị đăng xuất ở lần tải kế tiếp. Task này đóng điều kiện bắt buộc 2605c trước VNX-2608.
- **Task 12 (VNX-2607):** dòng Privacy "Sessions: up to 30 days, or until you sign out" vẫn đúng.
- **Ghi nhận (E2, Owner 2026-10-10):** "đăng xuất các phiên khác" như hành động chung đi vào backlog sau VNX-2608. **Rủi ro còn lại:** một bản sao bị đánh cắp của session `magic_link` vẫn sống tới 30 ngày sau khi hủy liên kết (hủy chỉ kết thúc session `oauth_<P>`); khoảng hở này có từ trước EPIC 26, không do task này tạo ra.
- **Thứ tự:** 9c, rồi rebase EPIC 26 lên `main`, rồi Task 12 (viết lại), rồi VNX-2604d, rồi VNX-2608.

---

### Task 12: VNX-2607 — Áp dụng câu chữ Privacy và Terms đã duyệt (bổ sung ADR-012) (CHỜ REBASE, viết lại sau khi rebase EPIC 26 lên `main`)

> **TRẠNG THÁI: CHỜ REBASE, viết lại sau khi rebase EPIC 26 lên `main`.** Plan review 2026-10-10: REJECT cho tới khi rebase. Phần bên dưới là bản nháp cũ viết trên nhánh chưa có phần M7 của Privacy; KHÔNG implement nó. Thứ tự: 9c, rebase lên `main`, Task 12 (viết lại), VNX-2604d, VNX-2608. Owner 2026-10-10: E4 = phần bổ sung pháp lý về tài khoản liên kết KHÔNG phải "thay đổi quan trọng" (Terms §12), không báo trước (trả lời câu hỏi mở 7).
>
> **Nghĩa vụ cho bản viết lại:**
> - **BLOCKER-1.** `main` có `docs/legal/privacy-m7.md` và bốn hằng `privacyEn`, `privacyVi`, `privacyEnM7`, `privacyViM7`; `/privacy` hiện bản M7 từ `PRIVACY_NOTICE_GO_LIVE` − 14 ngày (xem `main:.ai/context/CURRENT-STATUS.md:301-302`). Bản viết lại phải: áp bổ sung cho CẢ `privacy.md` VÀ `privacy-m7.md` và cả bốn hằng; đặt `__Host-vnx_oauth` ngay sau `__Host-vnx_invite` ở cả hai phiên bản; mỗi phiên bản có bảng neo riêng; chạy mọi kiểm tra của `linked-accounts.test.ts` cho cả hai phiên bản (trang M7 live với `{ ...testEnv, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" }`); cập nhật phần đầu `privacy-m7.md`.
> - **MEDIUM-2 / E5 (việc Owner lúc deploy):** ngày hiển thị của bản M7 cố định là D. Deploy VNX-2607 trước D−14 nếu được và đặt `LEGAL_UPDATED_AT` bằng ngày deploy 2607; nếu không, một follow-up cho bản M7 hằng "last updated" riêng.
> - **LOW-2:** không hard-code câu §8 trong test; suy ra từ mục "Bổ sung" hoặc bỏ.
> - **LOW-4:** thêm khóa rate limit `oauth:ip:*` (IP thô) vào bảng đối chiếu code.
> - **E6 (Ghi nhận cho lượt pháp lý kế tiếp, không đổi bây giờ):** đổi §2 Security thành "a record of security-relevant actions (admin actions, sign-ins, linking and unlinking accounts)".
> - Các lệch 1, 2, 3, 5, 6 giữ nguyên chữ. Ghi chú vận hành: xóa theo yêu cầu phải xóa hàng `user_identities` trước (không có `ON DELETE CASCADE`).


**Phụ thuộc:** Task 9, 11 (và Task 9c nếu đã xong, để câu về session đúng). **Cổng:** VNX-2607 phải merge **trước** khi bật bất kỳ cờ provider nào trên production (Owner 2026-10-07; cổng ra EPIC 26). Không có Review Focus riêng; kiểm bằng test câu chữ.

**Mục tiêu.** Chép nguyên văn các khối "Bổ sung ADR-012" (Owner APPROVED 2026-10-07) vào đúng chỗ của `## EN` và `## VI` trong `docs/legal/privacy.md` và `docs/legal/terms.md`, rồi vào `apps/web/src/legal/content.ts`, để `/privacy` và `/terms` (4 locale) hiện chúng. **Không đổi chữ nào của câu đã duyệt.** Đối chiếu từng mệnh đề với code thật (bảng dưới); mọi lệch được liệt kê thành câu hỏi mở kèm đề xuất sửa chính xác, không tự sửa.

**Quyết định kỹ thuật** (Reviewer kiểm):
1. **Quy ước của file:** các bổ sung M5, M6, EPIC 21 đã được chép thẳng vào `## EN`/`## VI` và ghi vào dòng "Trạng thái" cùng dòng "Đối chiếu code …" ở đầu file, không để lại mục riêng. Với ADR-012, Owner viết sẵn mục "Bổ sung ADR-012" ở cuối file (sau `---`, nên `partOf` của `content.test.ts` không đọc nó). Quyết định: **giữ mục đó làm bản gốc đã duyệt, đổi tiêu đề và dòng trạng thái thành "ĐÃ ÁP DỤNG"** (không xóa: bản gốc Owner duyệt là chứng cứ), và thêm test so từng dòng của nó với `## EN`/`## VI` (Step 1) để hai bản không lệch nhau.
2. **Test lấy câu chữ từ chính mục "Bổ sung"** (không chép câu vào test): nguồn sự thật duy nhất là văn bản Owner duyệt. Kèm bảng neo (câu đứng ngay sau câu nào) để kiểm vị trí "thêm sau gạch …" và hai chỗ "sửa/thay".
3. **zh-Hans, zh-Hant:** `views/LegalPage.tsx:82-96` hiện `doc = page.en` kèm `<p class="notice">{tr("legal.englishOnly")}</p>` (đã dịch, ví dụ zh-Hans "本页面目前仅提供英文版本，以英文版本为准。") và `lang="en"` cho thân. Nên không cần sửa `content.ts` riêng cho zh; chỉ cần test bốn trang zh hiện bản EN mới kèm câu "English version applies" đã dịch.
4. **`LEGAL_UPDATED_AT` không đổi trong task này.** Hằng số dùng chung cho Terms và Privacy (`legal/content.ts:10`, hiện `"2026-10-05"`), Owner chốt khi deploy (dòng "Ngày cập nhật hiển thị" của `terms.md`). Ghi vào "Việc của Owner lúc deploy" và câu hỏi mở 4; `content.test.ts:167` chỉ kiểm `>= "2026-10-05"` nên xanh dù đổi hay không.
5. **Test ràng buộc câu chữ với code thật** (không chỉ so chữ): tên cookie `__Host-vnx_oauth` bằng `OAUTH_COOKIE`, "up to 10 minutes" bằng `OAUTH_FLOW_TTL_MS` (600 s) và `LINK_INTENT_TTL_MS` ≤ nó, "30 days" bằng `SESSION_TTL_MS`, và tập cột của `user_identities` ghim cứng để một cột mới buộc người sửa đọc lại Privacy §2.
6. **Cỡ:** không có mã chạy được ngoài chuỗi trong `content.ts`; ≈ 40 dòng `content.ts`, ≈ 80 dòng markdown, ≈ 150 dòng test.

**Đối chiếu từng mệnh đề với code thật (Task 1-11 đã build, nhánh tại `b27fc27`):**

| Mệnh đề đã duyệt | Code thật | Kết quả |
|---|---|---|
| Cookie `__Host-vnx_oauth`, "up to 10 minutes" | `auth/oauth-cookie.ts:12` (tên); `domain/oauth.ts:13-14` (luồng 600 s, intent liên kết 120 s); `writeOAuthCookie` đặt `maxAge ≤ 600` | Khớp |
| Lưu: dịch vụ nào, mã định danh, nhãn (email Google/LinkedIn, username GitHub), thời điểm liên kết, lần đăng nhập gần nhất | `migrations/0017_user_identities.sql`: `provider`, `provider_subject`, `label`, `linked_at`, `last_used_at` (+ `id`, `user_id`, `updated_at`, `show_on_profile`) | Khớp, hai lưu ý nhỏ: câu hỏi mở 1 và 2 |
| "never receive or store the password … do not keep the access keys" | không cột token (test cột Task 1); `auth/oauth/oidc.ts`, `github.ts` dùng token trong một lần `exchange` rồi bỏ; callback chỉ log mã lỗi cố định | Khớp |
| Sign-in: "session records … including whether … email link or linked account" | `sessions.method` (`magic_link` / `oauth_*`) | Khớp |
| Builder hiện GitHub username hoặc "LinkedIn verified"; Google không bao giờ; builder không thấy tài khoản liên kết của client | `listPublicBadges` (Task 11): GitHub `login` + link, LinkedIn chỉ `{ provider }`, không Google; test riêng tư Task 11 | Khớp |
| "Your linked accounts are shown only to you" | `/me` (`listIdentitiesForUser` theo user) và `/hub/profile` (chỉ hàng của builder đó) | Khớp |
| Dịch vụ đăng nhập biết bạn đăng nhập VNX.SI | luồng OAuth chuyển hướng sang provider | Khớp |
| "We email you whenever an account is linked to or unlinked from yours" (Privacy §8, Terms §4) | `notify/identity.ts`: hai email tới `users.email`; không gửi khi `already_linked`; gửi lỗi chỉ log, không thử lại | Khớp, một lưu ý: câu hỏi mở 3 |
| "Linked accounts: until you unlink them or your account is deleted" | `unlinkIdentity` xóa hàng; chưa có luồng xóa tài khoản (`deleteGhostUsers` không chọn user có identity); cột `user_id` không có `ON DELETE CASCADE` | Khớp với chính sách; lưu ý vận hành: câu hỏi mở 6 |

**Câu hỏi mở cho Owner (đều là lệch nhỏ hoặc quyết định chữ; Planner KHÔNG sửa câu đã duyệt):**
1. **Nhãn "the email address for Google and LinkedIn".** Khi provider không trả email, `label` là chữ "Google"/"LinkedIn" (quyết định 12), không phải email. Chữ duyệt đúng với trường hợp thường. **Đề xuất: không sửa.** (Nếu muốn chính xác tuyệt đối: "(the email address for Google and LinkedIn when they give one, the username for GitHub)".)
2. **Cột `show_on_profile` và `updated_at` không được liệt kê** trong câu "we store …". `show_on_profile` là lựa chọn "hiện huy hiệu" của builder, đã được nói ở Mục 3 và 4; `updated_at` là dấu thời gian kỹ thuật. **Đề xuất: không sửa.**
3. **"We email you whenever …" và gửi thất bại.** Email gửi ngay sau khi lưu, không có hàng đợi gửi lại (Task 9 "Ghi nhận"). **Đề xuất: giữ câu.** Nếu Owner muốn tuyệt đối: đổi "We email you" thành "We try to email you" ở Privacy §8 và Terms §4, VI "Chúng tôi cố gắng gửi email cho bạn"; cần Owner duyệt.
4. **`LEGAL_UPDATED_AT`.** Terms và Privacy dùng chung một ngày. **Đề xuất: đổi thành ngày deploy của VNX-2607 lên production, trong commit deploy hoặc Owner báo ngày.** Việc của Owner lúc deploy; test không chặn.
5. **Thêm "or until you unlink the account you signed in with" vào dòng session ở Privacy §6?** Chỉ liên quan nếu Task 9c đã merge. Dòng hiện tại "Sessions: up to 30 days, or until you sign out" vẫn đúng. **Đề xuất: không thêm** (không bắt buộc, tránh sửa câu đã duyệt).
6. **Xóa tài khoản và `user_identities`.** Câu "until … your account is deleted" đúng về chính sách nhưng chưa có luồng xóa; cột `user_id` không có `ON DELETE CASCADE`, nên xóa tay một dòng `users` đang có identity sẽ lỗi khóa ngoại cho tới khi xóa hàng `user_identities` trước. **Đề xuất: ghi vào quy trình xóa theo yêu cầu (Privacy §7) khi có**; không ảnh hưởng câu chữ.
7. **Terms §12 hứa báo người dùng đã đăng nhập về thay đổi quan trọng.** Thay đổi ở Terms §4 có tính là quan trọng không? Chưa có cơ chế báo (ghi chú Owner trong `terms.md`). **Đề xuất: không tính là quan trọng** (bổ sung phương thức đăng nhập, không đổi nghĩa vụ); Owner quyết.

**Files:**
- Modify: `docs/legal/privacy.md`, `docs/legal/terms.md`, `apps/web/src/legal/content.ts`.
- Create: `apps/web/test/legal/linked-accounts.test.ts`.
- Không sửa: `apps/web/src/views/LegalPage.tsx`, `apps/web/src/routes/legal.tsx`, file locale (không chuỗi giao diện mới), `LEGAL_UPDATED_AT`.

**Interfaces:**
- Consumes: `LEGAL`, `LEGAL_UPDATED_AT` (`legal/content.ts`); `OAUTH_COOKIE` (`auth/oauth-cookie.ts`); `OAUTH_FLOW_TTL_MS`, `LINK_INTENT_TTL_MS` (`domain/oauth.ts`); `SESSION_TTL_MS` (`auth/sessions.ts`); `t` (`i18n/t.ts`); `createApp`, `testEnv`.
- Produces: không export mới.

- [ ] **Step 1: Test (đỏ).** Tạo `apps/web/test/legal/linked-accounts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { SESSION_TTL_MS } from "../../src/auth/sessions.ts";
import { LINK_INTENT_TTL_MS, OAUTH_FLOW_TTL_MS } from "../../src/domain/oauth.ts";
import { t } from "../../src/i18n/t.ts";
import { testEnv } from "../helpers.ts";

// The Owner-approved ADR-012 addendum (2026-10-07) at the foot of docs/legal/*.md is the single source of the wording: the live `## EN`/`## VI`
// parts must contain every line of it, in the places it names (VNX-2607).
const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const sourceOf = (name: string): string => {
  const entry = Object.entries(SOURCES).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  if (!entry) throw new Error(`docs/legal/${name}.md not found`);
  return entry[1].replace(/\r\n/g, "\n");
};
const partOf = (md: string, lang: "EN" | "VI"): string => {
  const start = md.indexOf(`\n## ${lang}\n`);
  if (start < 0) throw new Error(`missing ## ${lang}`);
  const body = md.slice(start + `\n## ${lang}\n`.length);
  const end = body.indexOf("\n---");
  return end < 0 ? body : body.slice(0, end);
};
/** The wording lines of the addendum's `### EN` or `### VI` block (not the bold "Mục …" instruction lines). */
const addendumLines = (md: string, lang: "EN" | "VI"): string[] => {
  const section = md.slice(md.indexOf("\n## Bổ sung ADR-012"));
  const from = section.indexOf(`\n### ${lang}\n`);
  if (from < 0) throw new Error(`missing addendum ### ${lang}`);
  const rest = section.slice(from + `\n### ${lang}\n`.length);
  const to = rest.indexOf("\n### ");
  return (to < 0 ? rest : rest.slice(0, to)).split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("**Mục "));
};
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<\/?(?:strong|code|a|span)\b[^>]*>/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
const live = async (path: string) => textOf(mainOf(await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv)).text()));

// Where each added line goes: `after` is the line it must directly follow (a prefix of that line), `first` starts the added line, `added` is how many lines go there.
const PRIVACY_PLACES = {
  EN: [
    { after: "- **Sign-in:**", first: "- **Linked accounts:**", added: 1 },
    { after: "- To sign you in and keep you signed in.", first: "- To let you sign in with an account you have linked", added: 1 },
    { after: "- Builder profiles and approved products are public.", first: "- Your linked accounts are shown only to you.", added: 2 },
    { after: "- `__Host-vnx_invite`:", first: "- `__Host-vnx_oauth`:", added: 1 },
    { after: "- Sign-in links:", first: "- Linked accounts: until you unlink them", added: 1 },
  ],
  VI: [
    { after: "- **Đăng nhập:**", first: "- **Tài khoản liên kết:**", added: 1 },
    { after: "- Đăng nhập và giữ bạn đăng nhập.", first: "- Cho bạn đăng nhập bằng tài khoản đã liên kết", added: 1 },
    { after: "- Hồ sơ builder và sản phẩm đã duyệt là công khai.", first: "- Tài khoản liên kết của bạn chỉ hiện cho chính bạn.", added: 2 },
    { after: "- `__Host-vnx_invite`:", first: "- `__Host-vnx_oauth`:", added: 1 },
    { after: "- Link đăng nhập:", first: "- Tài khoản liên kết: tới khi bạn hủy liên kết", added: 1 },
  ],
} as const;

describe("the ADR-012 addendum is applied to the live Privacy and Terms text (VNX-2607)", () => {
  for (const lang of ["EN", "VI"] as const) {
    it(`privacy ${lang}: every addendum line is in the ${lang} part, in the places it names`, () => {
      const md = sourceOf("privacy");
      const part = partOf(md, lang);
      const lines = part.split("\n");
      for (const line of addendumLines(md, lang)) expect(part, line.slice(0, 60)).toContain(line);
      for (const place of PRIVACY_PLACES[lang]) {
        const at = lines.findIndex((l) => l.startsWith(place.after));
        expect(at, place.after).toBeGreaterThanOrEqual(0);
        expect(lines[at + 1]?.startsWith(place.first), `${place.after} is followed by ${place.first}`).toBe(true);
        expect(lines.slice(at + 1, at + 1 + place.added).every((l) => l.startsWith("- ")), place.first).toBe(true);
      }
      expect(lines.filter((l) => l.startsWith(lang === "EN" ? "- **Sign-in:**" : "- **Đăng nhập:**"))).toHaveLength(1); // replaced, not duplicated
    });

    it(`terms ${lang}: section 4 is the addendum paragraph, once`, () => {
      const md = sourceOf("terms");
      const part = partOf(md, lang);
      const [paragraph] = addendumLines(md, lang);
      expect(paragraph).toBeDefined();
      expect(part).toContain(paragraph ?? "");
      expect(part.split(paragraph ?? "")).toHaveLength(2);
      expect(part).not.toContain(lang === "EN" ? "Keep your email account secure; anyone who can read it" : "Hãy giữ an toàn hộp thư của bạn; ai đọc được");
    });
  }

  it("privacy section 8 says we e-mail on link and unlink, in the replaced paragraph, in both languages", () => {
    expect(partOf(sourceOf("privacy"), "EN")).toContain("We email you whenever an account is linked to or unlinked from yours.");
    expect(partOf(sourceOf("privacy"), "VI")).toContain("Chúng tôi gửi email cho bạn mỗi khi có tài khoản được liên kết hoặc hủy liên kết với tài khoản của bạn.");
  });

  it("the live pages show them: EN and VI privacy carry the new cookie and the linked-accounts sentence", async () => {
    const en = await live("/privacy");
    expect(en).toContain("__Host-vnx_oauth");
    expect(en).toContain("up to 10 minutes");
    expect(en).toContain("Linked accounts: if you link a Google, GitHub or LinkedIn account to your VNX.SI account");
    expect(en).toContain("Linked accounts: until you unlink them or your account is deleted.");
    const vi = await live("/vi/privacy");
    expect(vi).toContain("__Host-vnx_oauth");
    expect(vi).toContain("tối đa 10 phút");
    expect(vi).toContain("Tài khoản liên kết: nếu bạn liên kết tài khoản Google, GitHub hoặc LinkedIn với tài khoản VNX.SI");
    expect(vi).toContain("Tài khoản liên kết: tới khi bạn hủy liên kết hoặc tài khoản của bạn bị xóa.");
  });

  it("every addendum line is on the live privacy page and the live terms page, word for word", async () => {
    for (const [lang, prefix] of [["EN", ""], ["VI", "/vi"]] as const) {
      const privacy = await live(`${prefix}/privacy`);
      for (const line of addendumLines(sourceOf("privacy"), lang)) expect(privacy, `${lang} ${line.slice(0, 50)}`).toContain(plain(line.replace(/^- /, "")));
      const terms = await live(`${prefix}/terms`);
      for (const line of addendumLines(sourceOf("terms"), lang)) expect(terms, `${lang} terms`).toContain(plain(line));
    }
    expect(await live("/terms")).toContain("you can link a Google, GitHub or LinkedIn account and use it to sign in too");
    expect(await live("/vi/terms")).toContain("bạn có thể liên kết tài khoản Google, GitHub hoặc LinkedIn và dùng nó để đăng nhập");
  });

  it("zh-Hans and zh-Hant show the same English text with their translated 'English version applies' line", async () => {
    for (const [locale, prefix] of [["zh-Hans", "/zh-hans"], ["zh-Hant", "/zh-hant"]] as const) {
      const privacy = await live(`${prefix}/privacy`);
      expect(privacy, locale).toContain(t(locale, "legal.englishOnly"));
      expect(privacy, locale).toContain("__Host-vnx_oauth");
      expect(privacy, locale).toContain("Linked accounts: if you link a Google, GitHub or LinkedIn account");
      const terms = await live(`${prefix}/terms`);
      expect(terms, locale).toContain(t(locale, "legal.englishOnly"));
      expect(terms, locale).toContain("link a Google, GitHub or LinkedIn account");
    }
  });

  it("the live page does not show the draft header or the instruction lines", async () => {
    for (const path of ["/privacy", "/vi/privacy", "/terms", "/vi/terms"]) {
      const text = await live(path);
      for (const word of ["Bổ sung ADR-012", "ĐÃ ÁP DỤNG", "bản nháp", "**"]) expect(text, `${path} ${word}`).not.toContain(word);
    }
  });
});

describe("the sentences match the code (VNX-2607 cross-check)", () => {
  it("the cookie name and lifetimes named in Privacy sections 5 and 6", () => {
    expect(OAUTH_COOKIE).toBe("__Host-vnx_oauth");
    expect(OAUTH_FLOW_TTL_MS).toBe(10 * 60 * 1000); // "up to 10 minutes"
    expect(LINK_INTENT_TTL_MS).toBeLessThanOrEqual(OAUTH_FLOW_TTL_MS);
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000); // "up to 30 days"
  });

  it("user_identities stores exactly the fields Privacy section 2 lists, and no token", async () => {
    const { results } = await testEnv.DB.prepare("SELECT name FROM pragma_table_info('user_identities') ORDER BY cid").all<{ name: string }>();
    // service (provider), its ID (provider_subject), a label, when linked, when last used; plus show_on_profile (covered by section 3) and updated_at.
    // A new column must be matched by a Privacy change first: edit this list only together with docs/legal/privacy.md.
    expect(results.map((r) => r.name)).toEqual(["id", "user_id", "provider", "provider_subject", "label", "show_on_profile", "linked_at", "last_used_at", "updated_at"]);
    for (const r of results) expect(r.name).not.toMatch(/token|secret|password|access|refresh|code|verifier/i);
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ.** `npm test -w apps/web -- test/legal/linked-accounts.test.ts` → FAIL (mọi dòng bổ sung chưa có trong `## EN`/`## VI`; `/privacy` chưa có `__Host-vnx_oauth`). Hai test "match the code" xanh sẵn (chúng ghim code, không phụ thuộc chữ).

- [ ] **Step 3: Chép vào markdown (phần md của `linked-accounts` xanh; `content.test.ts` đỏ vì md đã đổi mà trang chưa: đúng, Step 4 sửa).** Trong `docs/legal/privacy.md`, phần `## EN` rồi `## VI`, áp **nguyên văn** từng khối của mục "Bổ sung ADR-012" (copy từ chính file, không gõ lại):

| Chỗ | Việc | Nguồn trong mục "Bổ sung" |
|---|---|---|
| Mục 2, gạch "Sign-in" / "Đăng nhập" | **thay** gạch cũ bằng bản "sửa gạch … thành", rồi **thêm** gạch "Linked accounts" / "Tài khoản liên kết" ngay sau | hai khối "Mục 2" |
| Mục 3, sau "To sign you in and keep you signed in." / "Đăng nhập và giữ bạn đăng nhập." | thêm 1 gạch | "Mục 3" |
| Mục 4, sau "Builder profiles and approved products are public." / "Hồ sơ builder và sản phẩm đã duyệt là công khai." | thêm 2 gạch | "Mục 4" |
| Mục 5, sau gạch `__Host-vnx_invite` (cuối danh sách) | thêm 1 gạch `__Host-vnx_oauth` | "Mục 5" |
| Mục 6, sau gạch "Sign-in links …" / "Link đăng nhập …" | thêm 1 gạch | "Mục 6" |
| Mục 8, đoạn "Sessions and sign-in links …" / "Phiên và link đăng nhập …" | **thay** cả đoạn | "Mục 8" |

Trong `docs/legal/terms.md`: **thay** đoạn văn của "4. Your account" (`## EN`) và "4. Tài khoản của bạn" (`## VI`, `terms.md:87-88`) bằng đoạn của khối "Mục 4"; mục 3 giữ nguyên. Không có dòng `---` nào trong chữ chép vào (`partOf` cắt ở `\n---`).

Cập nhật đầu hai file (quy ước của file):
- `privacy.md`, dòng "Trạng thái": thêm ngay sau "**Bổ sung EPIC 21 … 2026-10-05.**": ` **Bổ sung ADR-012 (tài khoản liên kết): APPROVED bởi Owner 2026-10-07, ĐÃ ÁP DỤNG ở VNX-2607.**`; thêm bullet **"Đối chiếu code ADR-012 (`feat/epic26-linked-accounts` tại `<SHA>`):"** (SHA từ `git rev-parse --short HEAD` lúc commit) gồm: cookie `__Host-vnx_oauth` 600 s luồng / 120 s intent liên kết (`auth/oauth-cookie.ts`, `domain/oauth.ts`); bảng `user_identities`: `provider`, `provider_subject`, `label`, `linked_at`, `last_used_at` (+ `show_on_profile`, `updated_at`), không cột token (`migrations/0017_user_identities.sql`); `sessions.method` (`auth/sessions.ts`); hai email báo tới `users.email`, không gửi khi `already_linked`, lỗi gửi chỉ log (`notify/identity.ts`); huy hiệu: GitHub `@login` + link, LinkedIn chỉ nhãn "verified", Google không bao giờ, danh tính client không bao giờ tới builder (`db/identities.ts` `listPublicBadges`); lưu giữ: hàng bị xóa khi hủy liên kết, chưa có luồng xóa tài khoản.
- `terms.md`, dòng "Trạng thái": thêm ` **Bổ sung ADR-012 (mục 4): APPROVED bởi Owner 2026-10-07, ĐÃ ÁP DỤNG ở VNX-2607.**`.
- Mục cuối của cả hai file: đổi tiêu đề thành `## Bổ sung ADR-012 (tài khoản liên kết): ĐÃ ÁP DỤNG (VNX-2607), giữ làm bản gốc đã duyệt`; dòng "Trạng thái" của mục đó thành: ``câu chữ APPROVED bởi Owner 2026-10-07 (cùng ADR-012). **Đã áp dụng** ở VNX-2607: các đoạn dưới đây đã nằm trong `## EN` và `## VI`; `test/legal/linked-accounts.test.ts` kiểm từng dòng còn khớp. Khi đổi câu chữ sau này, sửa cả hai chỗ (hoặc xóa mục này cùng test đó) và hỏi Owner.``; dòng "Cách áp dụng": đổi sang quá khứ ("VNX-2607 đã chép … vào `src/legal/content.ts`"). Không đổi dòng nào trong hai khối `### EN`/`### VI`.

Chạy: `npm test -w apps/web -- test/legal/linked-accounts.test.ts -t "applied"` → test md ("every addendum line is in the … part", "section 4", "section 8") PASS; các test trang trực tiếp còn đỏ.

- [ ] **Step 4: Chép vào `content.ts` (xanh).** `apps/web/src/legal/content.ts` (không đổi kiểu `LegalDoc`; mỗi dòng gạch là một chuỗi trong `ul`, dấu `` ` `` và `**` giữ như các dòng hiện có; copy từ markdown đã áp ở Step 3). Chỗ sửa:

| Đối tượng (dòng hiện tại) | Sửa |
|---|---|
| `termsEn` mục "4. Your account", khối `p` (≈ 49-52) | thay chuỗi bằng đoạn EN của Terms "Mục 4" |
| `termsVi` mục "4. Tài khoản của bạn" (≈ 161-164) | thay bằng đoạn VI |
| `privacyEn` mục 2, gạch `**Sign-in:**` (260) | thay bằng bản "sửa gạch thành"; thêm ngay sau một mục `**Linked accounts:** …` |
| `privacyEn` mục 3, sau `To sign you in and keep you signed in.` (280) | thêm `To let you sign in with an account you have linked and, …` |
| `privacyEn` mục 4, sau `Builder profiles and approved products are public.` (298) | thêm hai mục `Your linked accounts are shown only to you. …` và `When you sign in with Google, GitHub or LinkedIn, …` |
| `privacyEn` mục 5, sau `` `__Host-vnx_invite`… `` (315) | thêm `` `__Host-vnx_oauth`: keeps a sign-in … for up to 10 minutes. `` |
| `privacyEn` mục 6, sau `Sign-in links: 15 minutes. …` (325) | thêm `Linked accounts: until you unlink them or your account is deleted.` |
| `privacyEn` mục 8, khối `p` (346) | thay bằng đoạn đã duyệt ("… admin actions are logged. We email you whenever an account is linked to or unlinked from yours. No system is perfectly secure; …") |
| `privacyVi`: sáu chỗ tương ứng (385, 405, 423, 440, 450, 471) | như trên, bản VI |

Ví dụ một chỗ (mục 5 EN; các chỗ khác cùng cách, nguyên văn từ markdown):

```ts
            "`__Host-vnx_invite`: remembers a builder invite link for 1 hour.",
            "`__Host-vnx_oauth`: keeps a sign-in with Google, GitHub or LinkedIn secure while you go to that service and back, for up to 10 minutes.",
```
Chú thích đầu `content.ts` (dòng 3-6): thêm "…and, for the linked-accounts text, 2026-10-07 (VNX-2607)" sau "approved by the Owner 2026-10-04". Không đổi `LEGAL_UPDATED_AT`. Chạy: `npm test -w apps/web -- test/legal` → PASS (`content.test.ts`, `pages.test.ts`, `linked-accounts.test.ts`).

- [ ] **Step 5: Tiêu chí chấp nhận.** (`LA` = `apps/web/test/legal/linked-accounts.test.ts`; `npm test -w apps/web -- <đường dẫn> -t "<tên>"`)

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | Mọi dòng bổ sung Privacy có trong `## EN` và `## VI`, đúng chỗ, gạch Sign-in được thay chứ không nhân đôi | `LA -t "privacy EN"` và `LA -t "privacy VI"` |
| 2 | Terms mục 4 là đoạn mới, đúng một lần, câu cũ biến mất | `LA -t "terms EN"` và `LA -t "terms VI"` |
| 3 | `/privacy` EN và VI có cookie `__Host-vnx_oauth` và câu "Linked accounts" / "Tài khoản liên kết" | `LA -t "live pages show them"` |
| 4 | Mọi dòng bổ sung hiện nguyên văn trên `/privacy` và `/terms` (EN, VI) | `LA -t "every addendum line is on the live"` |
| 5 | zh-Hans, zh-Hant hiện bản EN kèm câu "English version applies" đã dịch | `LA -t "zh-Hans and zh-Hant"` |
| 6 | Không lộ tiêu đề nháp, "ĐÃ ÁP DỤNG", dòng chỉ dẫn | `LA -t "does not show the draft header"` |
| 7 | Câu chữ khớp code: tên và thời hạn cookie, 30 ngày, cột `user_identities` không token | `LA -t "match the code"` |
| 8 | `content.test.ts` (so từng dòng md với trang) và `pages.test.ts` xanh | `npm test -w apps/web -- test/legal` |
| 9 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test -- --maxWorkers=2` |

- [ ] **Step 6: Typecheck, toàn bộ test, commit**

```bash
npm run typecheck -w apps/web
npm test -- --maxWorkers=2
git add docs/legal/privacy.md docs/legal/terms.md apps/web/src/legal/content.ts apps/web/test/legal/linked-accounts.test.ts
git commit -m "docs(legal): apply the approved linked-accounts text to Privacy and Terms (VNX-2607)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Kích cỡ ước tính:** `content.ts` ≈ 40 dòng (chuỗi), markdown ≈ 80 dòng, test ≈ 150 dòng; không có locale. Dưới 600: không tách.

**Việc của Owner lúc deploy (không phải của Implementer):**
- **Merge VNX-2607 và deploy trước khi bật cờ provider nào** (VNX-2608); kiểm `https://vnx.si/privacy`, `/vi/privacy`, `/terms` đã có cookie `__Host-vnx_oauth` và mục "Linked accounts" trên production.
- Chốt `LEGAL_UPDATED_AT` (câu hỏi mở 4); hằng số này đổi ngày hiển thị của cả Terms lẫn Privacy.
- Trả lời các câu hỏi mở 1-7 ở trên (không câu nào chặn merge nếu Owner chọn "không sửa").

**Nghĩa vụ cho task sau:**
- **VNX-2608:** `GET /privacy` và `/terms` trên production có bổ sung ADR-012 (cổng ra EPIC 26) trước khi bật cờ đầu tiên.
- **Ghi nhận:** nếu về sau thêm cột vào `user_identities` hoặc thêm provider, test "stores exactly the fields" và Privacy §2 phải đổi cùng lúc; chưa có quy trình xóa tài khoản tự động (câu hỏi mở 6).

#### Kết quả review Task 12: chưa review (Planner đã viết, chờ Opus review plan)

#### Kết quả review Task 9c và 12 (Opus, 2026-10-10): 9c APPROVE_WITH_CHANGES đã sửa HIGH-1, MEDIUM-1, LOW-1, LOW-3, S1; 12 REJECT, viết lại sau rebase; E1–E4 do Owner duyệt 2026-10-10

---

### Task 9d: VNX-2605d — Chỉ liên kết provider mới từ session `magic_link` (ADR-013)

**Phụ thuộc:** Task 9c (đã implement, `94cf5d8`, APPROVE). **Review Focus:** 5 (liên kết cần đúng session), 4, 7. **Bắt buộc trước VNX-2608** (Owner 2026-10-10, ADR-013).

**Mục tiêu.** Đóng hai đường mà review VNX-2605c tìm ra: (1) nhảy sang provider thứ hai (từ session `oauth_P` liên kết P2 rồi đăng nhập bằng P2); (2) `finishLink` kiểm session trước khi đổi code nhưng không kiểm lại trước khi ghi liên kết. Sau task này: bắt đầu liên kết (`POST …/link`), `start` nhánh link và callback nhánh link chỉ chạy với session `method = magic_link`; callback kiểm lại, **trong chính câu INSERT ghi liên kết**, rằng đúng session đó còn sống và vẫn là `magic_link`. Session `oauth_*` vẫn đăng nhập, xem `/me`, hủy liên kết như trước. Không đổi schema.

**Quyết định kỹ thuật** (từ code thật tại `6dc9ea0`; Reviewer kiểm):
1. **Tên hàm: thêm `isLinkCapableSession(method)` ở `domain/identity.ts`, KHÔNG dùng lại `isStaffSession`.** Cả hai hôm nay đều `method === "magic_link"`, nhưng `isStaffSession` có docstring "chỉ gọi từ `requireOps` và `requireAdmin`" (quyết định 9, test `staff-session.test.ts`); một quy tắc liên kết dùng tên "staff" sẽ làm người đọc tin rằng liên kết là quyền nhân viên, và sửa một quy tắc sẽ vô tình đổi quy tắc kia. Hằng `LINK_SESSION_METHOD: SessionMethod = "magic_link"` là nguồn chung cho predicate và cho câu SQL guard (db/ chỉ nhận giá trị bind, không hard-code chữ).
2. **`POST …/link` từ session không đủ điều kiện: 303 về `/me?link=needsEmailLink`** (notice mới, một nguồn `LINK_NOTICES`). Không ghi cookie intent, không redirect tới `start`. Kiểm đặt SAU `enabledProvider` (provider lạ hoặc cờ tắt vẫn 404, như hôm nay) và TRƯỚC `writeOAuthCookie`. Chọn notice mới thay vì dùng lại `failed` vì người dùng cần biết phải làm gì (đăng nhập bằng link qua email); đây là một chuỗi giao diện (chờ Owner duyệt).
3. **`start`: session không đủ điều kiện thì coi như không có session cho việc liên kết, tức rơi về hành vi `signin`** (không lỗi mới, không trang mới). Cụ thể `sessionHash` chỉ được tính khi `isLinkCapableSession(user.method)`; mọi nhánh sau đó (intent cookie, flow cookie `link` của chính session) đều thấy `sessionHash === null` nên `linking = false` và `start` 302 sang provider với flow `signin` (không mang session). Lý do: đúng nguyên tắc có sẵn "mọi thứ khác là đăng nhập thường" của `resolveStartIntent`; cho một người cầm cookie intent cũ (hoặc kẻ gian có cookie) kết cục vô hại: lần cùng lắm là đăng nhập bằng identity đã liên kết, hoặc trang "chưa liên kết". Test 8a-1 (trang trung gian 200 cho session `magic_link`) không đổi vì chúng đi bằng `signIn(email)` mặc định `magic_link`.
4. **Callback `finishLink`, hai lớp:**
   - **Trước `exchange`:** thêm điều kiện `isLinkCapableSession(user.method)` vào cổng `session_mismatch` hiện có (trang lỗi chung, mã log `session_mismatch`; không đổi hình dạng log). Code của provider không bị tiêu.
   - **Sau `exchange`, trong `linkIdentity`:** tham số tùy chọn mới `requireSession?: { idHash: string }` (thời điểm lấy từ `input.now`, không thêm trường `now`; S-2). Câu INSERT chuyển từ `VALUES (…)` sang `SELECT … WHERE (?7 IS NULL OR EXISTS (SELECT 1 FROM sessions WHERE id_hash = ?7 AND user_id = ?2 AND method = ?8 AND expires_at > ?6))`, vẫn `ON CONFLICT DO NOTHING RETURNING id`. Vì audit trong batch có guard "hàng identity tồn tại", session đã mất thì **không có hàng, không audit**; email chỉ gửi khi `linked.ok` nên **không email**. `db/identities.ts` chỉ ĐỌC `sessions` (bảng chỉ ghi ở `auth/sessions.ts`; `WRITERS` chỉ cấm ghi; không import `auth/`); `id_hash` do route tính bằng `sha256Hex(raw)` (cùng cách `getSessionUser`; KHÔNG phải `linkSessionHash`, hàm đó là hash cho cookie intent). Khi INSERT không ra hàng và `requireSession` có mặt, `linkIdentity` đọc lại session: không còn thì trả `{ ok: false, reason: "session_ended" }` (giá trị mới của `LinkRefusal`), trước khi xét `already_linked`/`taken`/`user_has_provider`.
   - **Kết quả khi session mất sau `exchange`:** `failed(c, provider, "session_mismatch", flow.locale)`: trang lỗi chung 400, **không** `/me?link=failed` (người dùng không còn session nên `/me` sẽ bật về `/login` và mất thông báo). Cookie OAuth đã bị xóa ở đầu callback.
   - **Cửa sổ còn lại:** không có giữa kiểm session và ghi (cùng một câu lệnh, D1 tuần tự hóa ghi). Phần còn lại là thứ tự tự nhiên: session có thể bị kết thúc NGAY SAU khi INSERT xong; khi đó liên kết đã hợp lệ vào lúc ghi, và email báo liên kết (ADR-012 §4) cùng nút hủy liên kết của chủ tài khoản là đường xử lý; hủy liên kết một provider P2 chỉ kết thúc session `oauth_P2` (kẻ gian không có, vì liên kết bắt đầu từ `magic_link`).
5. **`/me`:** `LinkedAccounts` nhận prop `canLink: boolean` (route truyền `isLinkCapableSession(user.method)`). Khi `canLink` sai: không form "Liên kết {provider}"; nếu còn provider khả dụng chưa liên kết thì hiện một ghi chú `<p class="muted">` (khóa `me.identities.emailToLink`). Nút hủy liên kết giữ nguyên. Khi `?link=needsEmailLink` đang hiện, bỏ ghi chú (không lặp hai câu). Các dòng provider vẫn hiện (cột hành động trống) để người dùng thấy cái gì chưa liên kết.
6. **Hủy liên kết không đổi** (ADR-013 "Không đổi"): không kiểm `method`; test khẳng định.
7. **Mô phỏng race bằng spy, KHÔNG bằng trigger (đổi có chủ ý so với chữ "trigger" của ADR-013 "Được bảo đảm bởi"):** giữa `exchange` và INSERT không có câu lệnh D1 nào chạy, nên một trigger `BEFORE INSERT` chỉ kiểm một thứ tự xen kẽ mà D1 không tạo ra được. Test bọc `FakeOAuthProvider.prototype.exchange` (gọi hàm gốc rồi `DELETE FROM sessions` của chính session đó) để mô phỏng "session bị kết thúc trong lúc đổi code" một cách xác định; test thứ hai gọi thẳng `linkIdentity` với `requireSession` trỏ tới session đã xóa, chứng minh guard nằm trong SQL, không nằm ở route. Spy phục hồi bằng `afterEach`. Báo cáo của Implementer phải ghi sự thay đổi này.
8. **Review 9c M1** (làm ở đây): mỗi test race trong `test/auth/oauth-unlink-race.test.ts` assert hàng identity đã mất sau callback (chứng minh trigger đã chạy).
9. **Cỡ:** ≈ 60 dòng mã, ≈ 330 dòng test; dưới 600, không tách.

**Chuỗi giao diện mới (Owner duyệt nguyên văn 2026-10-10, phương án A; thêm vào 4 file locale ngay sau `me.identities.notice.notLinked`, KHÔNG có chú thích "BẢN NHÁP" trong file locale):**

| Khóa | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `me.identities.emailToLink` | To link another account, sign out, then sign in with an email link. You can still unlink accounts here. | Muốn liên kết thêm tài khoản, hãy đăng xuất rồi đăng nhập bằng link qua email. Bạn vẫn hủy liên kết được ở đây. | 要关联其他账号，请先退出登录，再用邮箱登录。你仍可在此取消关联。 | 要連結其他帳號，請先登出，再用電子郵件登入。你仍可在此取消連結。 |
| `me.identities.notice.needsEmailLink` | To link a new account, you need to be signed in with an email link. Sign out, sign in with an email link, then try again. | Muốn liên kết tài khoản mới, bạn cần đăng nhập bằng link qua email. Hãy đăng xuất, đăng nhập bằng link qua email rồi thử lại. | 关联新账号需要用邮箱登录。请退出登录，再用邮箱登录后重试。 | 連結新帳號需要用電子郵件登入。請登出，再用電子郵件登入後再試一次。 |

`LINK_NOTICES` thêm `"needsEmailLink"` (một nguồn duy nhất; `NOTICE_KEY` thêm khóa; `STATUS` thêm nó: thông tin, không phải cảnh báo).

**Đã chốt (Owner 2026-10-10):** câu chữ hai chuỗi trên (phương án A). Hệ quả ADR-013 đã chấp nhận: người chỉ đăng nhập bằng provider vẫn cần hộp thư để liên kết thêm. Không còn câu hỏi mở; không thêm nút "Đăng xuất" mới trong task này.

**Files:**
- Modify: `apps/web/src/domain/identity.ts`, `apps/web/src/db/identities.ts` (`linkIdentity`), `apps/web/src/routes/me.tsx` (link POST, truyền `canLink`), `apps/web/src/routes/oauth.tsx` (`start`, `finishLink`), `apps/web/src/views/me/LinkedAccounts.tsx`, 4 file `apps/web/src/i18n/messages/*.ts` (sau khi duyệt), `apps/web/test/auth/oauth-unlink-race.test.ts` (M1), `apps/web/test/architecture.test.ts` (một assertion).
- Create: `apps/web/test/auth/oauth-link-session.test.ts`.
- Test (sửa, CHẮC CHẮN đỏ nếu không sửa; Implementer sửa trong Step 4):
  - `apps/web/test/auth/oauth-link.test.ts:87-94` ("works from an OAuth session too…") thành test chỉ cho `magic_link`: liên kết giữ `method` của session, số session vẫn 1; bỏ nửa `oauth_*` (nửa đó nay phải bị từ chối, đã có test mới).
  - `apps/web/test/me/identities.test.ts:44-58`: giữ các assertion form Link chỉ cho `magic_link`; với `oauth_google`: hàng hiện "Not linked", không có `/github/link`, và có ghi chú `me.identities.emailToLink`.
  - `apps/web/test/auth/oauth-link-start.test.ts`: chạy lại, dự kiến không đổi (dùng `signIn` mặc định `magic_link`).

**Interfaces:**
- Consumes: `linkIdentity`, `LinkResult`, `LinkRefusal` (`db/identities.ts`, `domain/identity.ts`); `flowMatchesSession`, `resolveStartIntent`, `newLinkIntent`, `encodeOAuthCookie` (`domain/oauth.ts`); `linkSessionHash`, `OAUTH_COOKIE` (`auth/oauth-cookie.ts`); `sha256Hex` (`auth/crypto.ts`); `readSessionCookie`; `FakeOAuthProvider`, `issueFakeCode` (`auth/oauth/fake.ts`); `signIn(email, { method })`, `linkedUser`, `enableProvider`, `linkViaStart`, `callbackReq` (`test/oauth-flow.ts`); `clearOutbox`, `outbox`.
- Produces: `LINK_SESSION_METHOD`, `isLinkCapableSession(method)` (`domain/identity.ts`); `LinkRefusal` thêm `"session_ended"`; `linkIdentity(db, { …, requireSession? })`; `LINK_NOTICES` thêm `"needsEmailLink"`; prop `canLink` của `LinkedAccounts`.

- [ ] **Step 1: Test (đỏ).** Tạo `apps/web/test/auth/oauth-link-session.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { linkSessionHash, OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { FakeOAuthProvider, issueFakeCode, resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { linkIdentity } from "../../src/db/identities.ts";
import { isLinkCapableSession, isStaffSession, SESSION_METHODS, type OAuthProvider, type SessionMethod } from "../../src/domain/identity.ts";
import { encodeOAuthCookie, newLinkIntent, oauthRedirectUri, parseOAuthCookie } from "../../src/domain/oauth.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";
import { callbackReq, enableProvider, linkedUser, linkViaStart } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`; // D1 is shared: per-test addresses, no global counts
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const identities = (userId: string) => n("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1", userId);
const linkAudits = (userId: string) => n("SELECT count(*) AS n FROM audit_log WHERE actor_user_id = ?1 AND action = 'auth.identity.link'", userId);
const rawOf = (cookie: string) => cookie.split("=")[1] ?? "";
const codeFor = (provider: OAuthProvider, flow: { verifier: string; nonce: string }, identity: { subject: string; label: string }) =>
  issueFakeCode(provider, identity, { verifier: flow.verifier, nonce: flow.nonce, redirectUri: oauthRedirectUri(testEnv.APP_ORIGIN, provider) });
const postLink = (provider: string, cookie: string) => createApp().request(formPost(`/me/identities/${provider}/link`, {}, { cookie }), undefined, testEnv);

beforeEach(async () => {
  resetFakeOAuth();
  clearOutbox();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("isLinkCapableSession (ADR-013)", () => {
  it("only magic_link; its own predicate, not the staff one", () => {
    for (const m of SESSION_METHODS) expect(isLinkCapableSession(m), m).toBe(m === "magic_link");
    // Delete this line the day the two rules diverge (it only records that they are equal today; they are separate predicates on purpose).
    for (const m of SESSION_METHODS) expect(isLinkCapableSession(m)).toBe(isStaffSession(m));
  });
});

describe("POST /me/identities/:provider/link needs a magic-link session (VNX-2605d)", () => {
  it("from an oauth_* session: 303 to /me?link=needsEmailLink, no intent cookie, no redirect to start", async () => {
    await enableProvider("github");
    await enableProvider("google");
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    for (const method of ["oauth_github", "oauth_google", "oauth_linkedin"] as const) {
      const { cookie } = await signIn(email, { method });
      const res = await postLink("google", cookie);
      expect(res.status, method).toBe(303);
      expect(res.headers.get("location"), method).toBe("/me?link=needsEmailLink");
      expect(setCookieValue(res, OAUTH_COOKIE), method).toBeNull(); // no intent cookie
      expect(res.headers.get("location")).not.toContain("/auth/oauth/");
    }
  });

  it("the redirect keeps the request locale: /vi/me/identities/google/link from an oauth_* session goes to /vi/me?link=needsEmailLink", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const res = await createApp().request(formPost("/vi/me/identities/google/link", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/me?link=needsEmailLink");
  });

  it("from a magic_link session: unchanged, 303 to the same-site start with the intent cookie", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const res = await postLink("google", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/oauth/google/start?lang=en");
    expect(setCookieValue(res, OAUTH_COOKIE)).not.toBeNull();
  });

  it("an unknown provider is still 404 and a flag-off provider 404, whatever the session", async () => {
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    expect((await postLink("facebook", cookie)).status).toBe(404);
    expect((await postLink("google", cookie)).status).toBe(404); // flag off
  });
});

describe("start with a link intent needs a magic-link session (VNX-2605d)", () => {
  it("an intent cookie bound to an oauth_* session gives a plain sign-in: 302, a signin flow, no link page", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_github" });
    const intent = encodeOAuthCookie(newLinkIntent({ provider: "google", sessionHash: await linkSessionHash(rawOf(cookie)) }, Date.now()));
    const res = await createApp().request(getReq("/auth/oauth/google/start", `${cookie}; ${OAUTH_COOKIE}=${intent}`), undefined, testEnv);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location") ?? "").hostname).toBe("accounts.google.com");
    const flow = parseOAuthCookie(setCookieValue(res, OAUTH_COOKIE) ?? "", { provider: "google", now: Date.now() });
    expect(flow?.phase === "flow" && flow.intent).toBe("signin");
  });

  it("the same bound to a magic_link session still gives the 200 link page (positive control)", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const link = await linkViaStart("google", cookie);
    expect(link.start.status).toBe(200);
    expect(link.flow?.intent).toBe("link");
  });

  it("a live link flow of a session that has since become oauth_* is not shown again as a link page", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const link = await linkViaStart("google", cookie);
    expect(link.start.status).toBe(200); // positive preconditions: the link flow really is live
    expect(link.flow?.intent).toBe("link");
    await testEnv.DB.prepare("UPDATE sessions SET method = 'oauth_github' WHERE id_hash = ?1").bind(await sha256Hex(rawOf(cookie))).run();
    const again = await createApp().request(getReq("/auth/oauth/google/start", `${cookie}; ${link.flowCookie}`), undefined, testEnv);
    expect(again.status).toBe(302);
    expect(new URL(again.headers.get("location") ?? "").hostname).toBe("accounts.google.com");
    const next = parseOAuthCookie(setCookieValue(again, OAUTH_COOKIE) ?? "", { provider: "google", now: Date.now() });
    expect(next?.phase === "flow" && next.intent).toBe("signin");
  });
});

describe("the callback's link branch (VNX-2605d)", () => {
  async function started(email: string, provider: OAuthProvider = "github") {
    await enableProvider(provider);
    const { user, cookie } = await signIn(email, { method: "magic_link" });
    const link = await linkViaStart(provider, cookie);
    if (!link.flow) throw new Error("no link flow"); // positive precondition: the flow really started on the magic_link session
    const identity = { subject: `s-${tag()}`, label: `l-${tag()}` };
    return { user, cookie, link, identity, flow: link.flow, code: codeFor(provider, link.flow, identity) };
  }
  const callback = (provider: OAuthProvider, s: Awaited<ReturnType<typeof started>>, session: string) =>
    callbackReq(provider, { code: s.code, state: s.flow.state }, `${session}; ${s.link.flowCookie}`);
  const nothingHappened = async (userId: string, email: string) => {
    expect(await identities(userId)).toBe(0);
    expect(await linkAudits(userId)).toBe(0);
    expect(outbox.filter((m) => m.to === email)).toHaveLength(0);
  };

  it("positive control: the same flow on the unchanged magic_link session links, audits and e-mails once", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const res = await callback("github", s, s.cookie);
    expect(res.headers.get("location")).toBe("/me?link=ok");
    expect(await identities(s.user.id)).toBe(1);
    expect(await linkAudits(s.user.id)).toBe(1);
    expect(outbox.filter((m) => m.to === email)).toHaveLength(1);
  });

  it("the session became oauth_* after the flow started: no link, no audit, no e-mail; the code is not spent (error page)", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    await testEnv.DB.prepare("UPDATE sessions SET method = 'oauth_google' WHERE id_hash = ?1").bind(await sha256Hex(rawOf(s.cookie))).run();
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange"); // pass-through: counts calls
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled(); // the check BEFORE the exchange: the code is not spent (fails without it)
    await nothingHappened(s.user.id, email);
  });

  it("the session was deleted after the flow started: no link (and no session to come back to)", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256Hex(rawOf(s.cookie))).run();
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange");
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled();
    await nothingHappened(s.user.id, email);
  });

  it("another session of the same user (oauth_*) presenting the flow cookie: no link", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const other = await signIn(email, { method: "oauth_github" });
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange");
    const res = await callback("github", s, other.cookie);
    expect(res.status).toBe(400);
    expect(exchange).not.toHaveBeenCalled();
    await nothingHappened(s.user.id, email);
  });

  it("RACE: the session is ended while the code is exchanged: no link, no audit, no e-mail, the error page", async () => {
    const email = emailOf("lan");
    const s = await started(email);
    const hash = await sha256Hex(rawOf(s.cookie));
    const real = FakeOAuthProvider.prototype.exchange;
    const exchange = vi.spyOn(FakeOAuthProvider.prototype, "exchange").mockImplementation(async function (this: FakeOAuthProvider, input) {
      const result = await real.call(this, input); // the exchange succeeds…
      await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(hash).run(); // …and the session ends right after it (restored by afterEach)
      return result;
    });
    const res = await callback("github", s, s.cookie);
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expect(exchange).toHaveBeenCalledTimes(1); // the exchange DID run (the pre-exchange check passed), so only the in-SQL guard stopped the link
    expect(await n("SELECT count(*) AS n FROM sessions WHERE id_hash = ?1", hash)).toBe(0); // positive precondition: the session row really is gone
    await nothingHappened(s.user.id, email);
  });

  it("RACE at the SQL level: linkIdentity with a session that no longer exists writes nothing, not even an audit row", async () => {
    const { user, cookie } = await signIn(emailOf("lan"), { method: "magic_link" });
    const idHash = await sha256Hex(rawOf(cookie));
    const now = new Date().toISOString();
    const args = { userId: user.id, provider: "github" as const, subject: `s-${tag()}`, label: `l-${tag()}`, now };
    await testEnv.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(idHash).run();
    expect(await linkIdentity(testEnv.DB, { ...args, requireSession: { idHash } })).toEqual({ ok: false, reason: "session_ended" });
    expect(await identities(user.id)).toBe(0);
    expect(await linkAudits(user.id)).toBe(0);
    // an oauth_* row with that hash is refused the same way, a live magic_link one passes
    const alive = await signIn(emailOf("lan"), { method: "oauth_github" });
    const oauthHash = await sha256Hex(rawOf(alive.cookie));
    expect(await linkIdentity(testEnv.DB, { ...args, userId: alive.user.id, requireSession: { idHash: oauthHash } })).toEqual({ ok: false, reason: "session_ended" });
    const good = await signIn(emailOf("lan"), { method: "magic_link" });
    expect((await linkIdentity(testEnv.DB, { ...args, userId: good.user.id, requireSession: { idHash: await sha256Hex(rawOf(good.cookie)) } })).ok).toBe(true);
    // another user's session id does not count for this user
    const victim = await signIn(emailOf("victim"), { method: "magic_link" });
    const stranger = await signIn(emailOf("stranger"), { method: "magic_link" });
    expect(await linkIdentity(testEnv.DB, { ...args, subject: `s-${tag()}`, userId: victim.user.id, requireSession: { idHash: await sha256Hex(rawOf(stranger.cookie)) } })).toEqual({ ok: false, reason: "session_ended" });
  });
});

describe("unlinking stays allowed from any session (VNX-2605d, ADR-013)", () => {
  it("an oauth_* session can unlink", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email, { method: "oauth_linkedin" });
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await identities(user.id)).toBe(0);
  });
});

describe("/me for a session that cannot link (VNX-2605d)", () => {
  const section = async (path: string, cookie: string) => {
    const html = await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text();
    return html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";
  };
  const NOTE: Array<[string, string]> = [
    ["/me", "To link another account, sign out, then sign in with an email link."],
    ["/vi/me", "Muốn liên kết thêm tài khoản, hãy đăng xuất rồi đăng nhập bằng link qua email."],
    ["/zh-hans/me", "要关联其他账号，请先退出登录，再用邮箱登录。"],
    ["/zh-hant/me", "要連結其他帳號，請先登出，再用電子郵件登入。"],
  ];

  it("an oauth_* session sees the note, no Link form, and still the Unlink form; a magic_link session sees the Link form and no note", async () => {
    await enableProvider("google");
    await enableProvider("github");
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const oauth = await signIn(email, { method: "oauth_github" });
    const magic = await signIn(email, { method: "magic_link" });
    for (const [path, text] of NOTE) {
      const html = (await section(path, oauth.cookie)).replace(/&#39;/g, "'");
      expect(html, path).toContain(text);
      expect(html, path).not.toContain("/google/link");
      expect(html, path).toContain("/github/unlink");
    }
    const withLink = await section("/me", magic.cookie);
    expect(withLink).toContain("/me/identities/google/link");
    expect(withLink).not.toContain("To link another account, sign out");
  });

  it("?link=needsEmailLink shows its message once and not the note as well", async () => {
    await enableProvider("google");
    const { cookie } = await signIn(emailOf("lan"), { method: "oauth_google" });
    const html = await section("/me?link=needsEmailLink", cookie);
    expect(html).toContain("To link a new account, you need to be signed in with an email link.");
    expect(html).not.toContain("To link another account, sign out");
    expect(html).toContain('role="status"');
  });
});
```
Ghi chú implementer: tên helper `setCookieValue`, `getReq`, `formPost` ở `test/helpers.ts` và `linkViaStart`, `callbackReq` ở `test/oauth-flow.ts` đã có; trả `string | null` của `setCookieValue` cần khớp chữ ký thật (đổi `toBeNull()` cho khớp nếu nó trả `undefined`). `encodeOAuthCookie` export từ `domain/oauth.ts`.

- [ ] **Step 2: Chạy, thấy đỏ.** `npm test -w apps/web -- test/auth/oauth-link-session.test.ts` → FAIL (không có `isLinkCapableSession`, `requireSession`, notice `needsEmailLink`; POST từ `oauth_*` đang 303 tới `start`; RACE ghi liên kết).

- [ ] **Step 3: Domain và DB (xanh một phần).**

`apps/web/src/domain/identity.ts`, sau `isStaffSession`:

```ts
/**
 * Only a magic-link session may start or finish linking a NEW provider account (ADR-013): adding a way to sign in must prove the mailbox.
 * Its own name and constant on purpose: today it equals `isStaffSession`, but that one is the /ops and /admin rule (decision 9) and the two may diverge.
 * Unlinking is allowed for every session and does not call this.
 */
export const LINK_SESSION_METHOD: SessionMethod = "magic_link";
export function isLinkCapableSession(method: SessionMethod): boolean {
  return method === LINK_SESSION_METHOD;
}
```
Cũng thêm `"session_ended"` vào `LinkRefusal` (docstring: "the session that asked to link is gone or is not a magic-link session").

`apps/web/src/db/identities.ts`: import `LINK_SESSION_METHOD`; thay `linkIdentity`:

```ts
export async function linkIdentity(
  db: D1Database,
  input: { userId: string; provider: OAuthProvider; subject: string; label: string; now: string; /** The session that asked (ADR-013): the row is written only while it is alive and a magic-link session of this user. */ requireSession?: { idHash: string } },
): Promise<LinkResult> {
  const id = ulid(Date.parse(input.now));
  const [insert] = await db.batch<{ id: string }>([
    db
      .prepare(
        `INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, last_used_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, 0, ?6, NULL, ?6
         WHERE (?7 IS NULL OR EXISTS (SELECT 1 FROM sessions WHERE id_hash = ?7 AND user_id = ?2 AND method = ?8 AND expires_at > ?6))
         ON CONFLICT DO NOTHING
         RETURNING id`,
      )
      .bind(id, input.userId, input.provider, input.subject, input.label, input.now, input.requireSession?.idHash ?? null, LINK_SESSION_METHOD),
    auditStatement(/* unchanged: guarded on the identity row existing */),
  ]);
  if (insert?.results.length) { /* unchanged */ }
  if (input.requireSession) {
    // Nothing was inserted: if the session is the reason, say so before any conflict answer.
    const alive = await db
      .prepare("SELECT 1 AS ok FROM sessions WHERE id_hash = ?1 AND user_id = ?2 AND method = ?3 AND expires_at > ?4")
      .bind(input.requireSession.idHash, input.userId, LINK_SESSION_METHOD, input.now)
      .first<{ ok: number }>();
    if (!alive) return { ok: false, reason: "session_ended" };
  }
  /* holder lookup unchanged */
}
```
(Giữ nguyên phần còn lại của hàm; `ON CONFLICT` sau `SELECT … WHERE` hợp lệ trong SQLite. Cập nhật docstring: "`requireSession`…")

Chạy: `npm test -w apps/web -- test/auth/oauth-link-session.test.ts -t "RACE at the SQL level"` và `-t "isLinkCapableSession"` → PASS; `npm test -w apps/web -- test/db/identities.test.ts` → PASS (không truyền `requireSession` thì hành vi cũ).

- [ ] **Step 4: Routes và view (xanh).**

`apps/web/src/routes/me.tsx` (import `isLinkCapableSession` từ `../domain/identity.ts`):

```ts
  onLocalized(app, "get", "/me", requireUser, async (c) => {
    // … as before …
        <LinkedAccounts locale={locale} identities={identities} linkable={linkable} notice={notice} canLink={isLinkCapableSession(user.method)} />
```
```ts
  onLocalized(app, "post", "/me/identities/:provider/link", requireUser, async (c) => {
    const found = await enabledProvider(c);
    const raw = readSessionCookie(c);
    if (!found || !raw) return errorResponse(c, "notFound", 404);
    // ADR-013: only a magic-link session starts a link. Nothing is written and nothing redirects to `start`; the owner is told what to do.
    const refused: LinkNotice = "needsEmailLink"; // typed against the one LINK_NOTICES source
    if (!isLinkCapableSession(c.get("user")!.method)) return c.redirect(`${localizedPath(c.get("locale"), "/me")}?link=${refused}`, 303);
    const now = Date.now();
    writeOAuthCookie(c, newLinkIntent({ provider: found.provider, sessionHash: await linkSessionHash(raw) }, now), now);
    return c.redirect(`/auth/oauth/${found.provider}/start?lang=${c.get("locale")}`, 303);
  });
```
`apps/web/src/routes/oauth.tsx`: import `isLinkCapableSession` và `sha256Hex` (`../auth/crypto.ts`). `start`:

```ts
    const user = c.get("user");
    const sessionHash = user && raw && isLinkCapableSession(user.method) ? await linkSessionHash(raw) : null; // ADR-013: any other session is, for linking, no session: a plain sign-in follows
```
`finishLink`:

```ts
  // ADR-013, before the code is spent: a live magic-link session, and the one that asked.
  if (!user || !raw || !isLinkCapableSession(user.method) || !flowMatchesSession(flow, await linkSessionHash(raw))) return failed(c, provider, "session_mismatch", flow.locale);
  …
  // After the exchange, the same check INSIDE the write (a session ended meanwhile writes nothing): `requireSession`.
  const nowIso = new Date(nowMs).toISOString();
  const linked = await linkIdentity(c.env.DB, { userId: user.id, provider, subject: result.identity.subject, label: result.identity.label, now: nowIso, requireSession: { idHash: await sha256Hex(raw) } });
  if (!linked.ok && linked.reason === "session_ended") return failed(c, provider, "session_mismatch", flow.locale); // not /me?link=failed: with no session /me would bounce to /login and lose the message
```
(đặt dòng `session_ended` ngay sau `linkIdentity`, trước `if (linked.ok) await notifyIdentityChange`; `linked.reason === "user_has_provider" ? …` giữ nguyên.) Cập nhật docstring `finishLink`: "checked BEFORE the code is spent and again inside the write".

`apps/web/src/views/me/LinkedAccounts.tsx`: `LINK_NOTICES` thêm `"needsEmailLink"`; `NOTICE_KEY.needsEmailLink = "me.identities.notice.needsEmailLink"`; `STATUS` thêm `"needsEmailLink"`; prop `canLink: boolean`; trong ô hành động đổi `linkable.includes(provider)` thành `canLink && linkable.includes(provider)`; sau `<p class="muted">{intro}</p>` thêm:

```tsx
      {!canLink && notice !== "needsEmailLink" && rows.some((p) => linkable.includes(p) && !identities.some((i) => i.provider === p)) ? <p class="muted">{tr("me.identities.emailToLink")}</p> : null}
```
Thêm hai khóa vào 4 file locale (bảng trên, sau Owner duyệt; trước đó test chuỗi sẽ đỏ, nên Implementer chờ duyệt rồi mới chạy Step 5). Chạy `npm test -w apps/web -- test/auth/oauth-link-session.test.ts` → PASS.

- [ ] **Step 5: M1 của review 9c.** Trong `apps/web/test/auth/oauth-unlink-race.test.ts`, test `unlinked mid sign-in (…)`: sau khối `finally` thêm `expect(await n("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1", user.id)).toBe(0); // the trigger ran: the identity is gone` (chứng minh trigger đã bắn; trước dòng assert `oauth_github` session). Chạy `npm test -w apps/web -- test/auth/oauth-unlink-race.test.ts` → PASS.

- [ ] **Step 6: Test kiến trúc.** Thêm vào `apps/web/test/architecture.test.ts`:

```ts
describe("linking needs a magic-link session (VNX-2605d, ADR-013)", () => {
  it("the only caller of linkIdentity passes requireSession, and linking code never uses the staff predicate", () => {
    const callers = Object.entries(sources).filter(([file, src]) => /\blinkIdentity\(/.test(src) && file !== "../src/db/identities.ts");
    expect(callers.map(([file]) => file)).toEqual(["../src/routes/oauth.tsx"]);
    expect(callers[0]?.[1]).toMatch(/requireSession: \{ idHash: await sha256Hex\(raw\)/);
    for (const file of ["../src/routes/oauth.tsx", "../src/routes/me.tsx", "../src/views/me/LinkedAccounts.tsx"]) expect(sources[file], file).not.toContain("isStaffSession");
  });
});
```

- [ ] **Step 7: Tiêu chí chấp nhận.** (`LS` = `apps/web/test/auth/oauth-link-session.test.ts`; `npm test -w apps/web -- <đường dẫn> -t "<tên>"`)

| # | Điều kiện | Lệnh |
|---|---|---|
| 1 | `POST …/link` từ `oauth_*`: 303 `/me?link=needsEmailLink`, không cookie intent; từ `magic_link`: như cũ; provider lạ/cờ tắt vẫn 404 | `LS -t "needs a magic-link session"` |
| 2 | `start` với intent/flow của session `oauth_*`: 302 signin, không trang link; đối chứng `magic_link` vẫn 200 | `LS -t "start with a link intent"` |
| 3 | Callback: flow bắt đầu ở `magic_link` nhưng session nay `oauth_*`, đã xóa, hoặc là session khác: không liên kết, không audit, không email, trang lỗi | `LS -t "callback's link branch"` |
| 4 | Race: session mất giữa `exchange` và ghi: không liên kết, không audit, không email | `LS -t "RACE"` |
| 5 | Guard nằm trong SQL (`session_ended`; session `oauth_*` hay của người khác cũng bị từ chối; `magic_link` hợp lệ qua) | `LS -t "RACE at the SQL level"` |
| 6 | Hủy liên kết vẫn được từ session `oauth_*` | `LS -t "unlinking stays allowed"` |
| 7 | `/me`: session `oauth_*` thấy ghi chú, không form Link, còn form Unlink, 4 locale; `magic_link` thấy form Link | `LS -t "/me for a session"` |
| 8 | M1: trigger đã chạy ở mọi test race của 9c | `npm test -w apps/web -- test/auth/oauth-unlink-race.test.ts` |
| 9 | Ranh giới: chỉ `oauth.tsx` gọi `linkIdentity` và truyền `requireSession`; không dùng `isStaffSession` cho liên kết | `npm test -w apps/web -- test/architecture.test.ts` |
| 10 | 4 locale đủ khóa | `npm test -w apps/web -- test/i18n/parity.test.ts` |
| 11 | Không hồi quy 8a, 8b, 9, 9c | `npm test -w apps/web -- test/me test/auth test/db` |
| 12 | Typecheck, toàn bộ test | `npm run typecheck -w apps/web` và `npm test -- --maxWorkers=2` |

- [ ] **Step 8: Typecheck, toàn bộ test, commit**

```bash
npm run typecheck -w apps/web
npm test -- --maxWorkers=2
git add apps/web/src/domain/identity.ts apps/web/src/db/identities.ts apps/web/src/routes/me.tsx apps/web/src/routes/oauth.tsx apps/web/src/views/me/LinkedAccounts.tsx \
  apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts \
  apps/web/test/auth/oauth-link-session.test.ts apps/web/test/auth/oauth-unlink-race.test.ts apps/web/test/auth/oauth-link.test.ts apps/web/test/me/identities.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): linking a new provider needs a magic-link session, re-checked inside the write (VNX-2605d)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(`git add` đã gồm hai test cũ phải sửa; thêm file nào khác Step 4 buộc phải sửa.)

**Kích cỡ ước tính:** mã ≈ 60 dòng (domain 10, identities 22, me.tsx 6, oauth.tsx 8, view 10, locale riêng), test ≈ 330 dòng (mới 290, M1 2, kiến trúc 10, sửa cũ ≈ 20). Dưới 600 không tính locale: không tách.

**Nghĩa vụ cho task sau:**
- **VNX-2608:** thử bằng provider thật: đăng nhập bằng GitHub, vào `/me`, xác nhận không có nút Link mà có ghi chú; đăng nhập bằng link qua email rồi liên kết thêm Google thành công.
- **Task 12 (VNX-2607, viết lại sau rebase):** Terms §4 / Privacy không nói rằng liên kết đòi session magic link; câu đã duyệt vẫn đúng ("Once signed in, you can link…"); không cần đổi chữ, ghi vào bảng đối chiếu code.
- **Ghi nhận:** thông báo `needsEmailLink` dẫn người dùng tới "đăng xuất"; chưa có nút đăng xuất ngay trên `/me`. Nếu Owner muốn, task riêng.

#### Kết quả review Task 9d (Opus, 2026-10-10): APPROVE_WITH_CHANGES, đã sửa MEDIUM-1, MEDIUM-2, LOW-1..3, S-1..3; câu chữ Owner duyệt 2026-10-10
