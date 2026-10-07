# ADR-012: Tài khoản liên kết Google, GitHub, LinkedIn (đăng nhập phụ và huy hiệu xác minh)

- **Trạng thái:** Accepted (Owner duyệt 2026-10-07, gồm câu chữ bổ sung Privacy và Terms).
- **Ngày:** 2026-10-06
- **Người quyết định:** Owner (4 quyết định nghiệp vụ chốt ngày 2026-10-06, 3 quyết định triển khai ngày 2026-10-07); bản nháp do Claude (Reviewer) soạn
- **Thay một phần:** ADR-002 (phương thức đăng nhập). **Bổ sung:** ADR-010 (điều kiện session vào `/ops`).

## Quyết định

Người dùng đã có tài khoản có thể liên kết Google, GitHub và LinkedIn từ trang tài khoản, rồi dùng tài khoản liên kết để đăng nhập. Magic link vẫn là cách duy nhất để tạo tài khoản và để vào Ops. Builder có thể chọn hiện huy hiệu xác minh GitHub hoặc LinkedIn trên profile công khai.

## Bối cảnh

ADR-002 chỉ cho đăng nhập bằng magic link. Builder và client quen dùng Google/GitHub muốn đăng nhập nhanh hơn, không phải chờ email. Builder còn cần một tín hiệu tin cậy rằng họ thật sự sở hữu tài khoản GitHub hay LinkedIn mà họ nêu, thay vì chỉ dán URL tự khai.

Lý do ADR-002 không chọn OAuth vẫn đúng: thêm phụ thuộc bên thứ ba, và một phần client Việt Nam/Trung Quốc không dùng các nhà cung cấp này. Vì vậy OAuth chỉ là phương thức **phụ**, không thay magic link.

## Quyết định của Owner (2026-10-06)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Liên kết để làm gì | Đăng nhập **và** huy hiệu xác minh trên builder profile (builder tự bật). Liên kết của client không bao giờ hiện công khai |
| 2 | Email nhà cung cấp trùng email tài khoản có sẵn | **Chỉ liên kết chủ động.** Không tự liên kết theo email |
| 3 | Tạo tài khoản mới bằng OAuth | **Không.** Chỉ tài khoản đã có mới dùng được |
| 4 | Ops dùng session OAuth | **Không.** `/ops` vẫn cần session tạo bằng magic link |

## Chi tiết

### 1. Nhà cung cấp và giao thức

| Provider | Giao thức | Định danh lưu (`provider_subject`) | Dữ liệu dùng |
|---|---|---|---|
| Google | OpenID Connect, Authorization Code + PKCE | claim `sub` | `email` (chỉ để chủ tài khoản thấy mình đã liên kết tài khoản nào) |
| GitHub | OAuth 2.0 Authorization Code + PKCE | `id` dạng số từ `GET /user` (không dùng `login`, vì login đổi được) | `login` để hiện handle |
| LinkedIn | OpenID Connect ("Sign In with LinkedIn using OpenID Connect") | claim `sub` | `name`, `email`. **API không trả URL profile công khai**, nên huy hiệu LinkedIn không có link |

- Bắt buộc `state` và PKCE `S256` cho cả ba; OIDC thêm `nonce` và kiểm `iss`, `aud`, `exp` của ID token.
- `state`, PKCE verifier, `nonce`, intent (`signin` hoặc `link`), locale và `next` nằm trong một cookie `__Host-vnx_oauth` (HttpOnly, Secure, SameSite=Lax, sống 10 phút, dùng một lần). Callback từ chối nếu cookie thiếu, hết hạn hoặc `state` không khớp.
- Scope tối thiểu: Google `openid email`; GitHub không xin scope (chỉ đọc profile công khai); LinkedIn `openid profile email`.
- **Không lưu access token hay refresh token.** Token chỉ dùng trong request callback để đọc định danh, rồi bỏ.
- Callback URI cố định, không có tiền tố locale: `/auth/oauth/:provider/callback`. Locale đi trong cookie state.
- Client ID/secret qua `wrangler secret` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, …). Không SDK Node; code phải chạy trong workerd (ADR-001).
- Mỗi provider có một feature flag riêng (`feature_flags`). Flag tắt thì ẩn nút và callback trả 404.

### 2. Dữ liệu

Bảng mới `user_identities` (migration additive):

| Cột | Ghi chú |
|---|---|
| `id` | khóa chính |
| `user_id` | `REFERENCES users (id)` |
| `provider` | `CHECK (provider IN ('google', 'github', 'linkedin'))` |
| `provider_subject` | định danh bất biến ở bảng mục 1 |
| `label` | email (Google, LinkedIn) hoặc login (GitHub). Chỉ chủ tài khoản thấy, trừ trường hợp ở mục 5 |
| `show_on_profile` | 0/1, mặc định 0. Chỉ có tác dụng với builder |
| `linked_at`, `last_used_at`, `updated_at` | |

- `UNIQUE (provider, provider_subject)`: một tài khoản provider chỉ gắn với một user.
- `UNIQUE (user_id, provider)`: mỗi user tối đa một tài khoản cho mỗi provider.
- `sessions` thêm cột `method` (`magic_link` | `oauth_google` | `oauth_github` | `oauth_linkedin`), mặc định `magic_link` để session cũ giữ nguyên ý nghĩa.

### 3. Đăng nhập bằng tài khoản liên kết

1. Trang login hiện nút provider (theo flag) bên dưới form email. Form email giữ vị trí chính.
2. Callback tìm `user_identities` theo `(provider, provider_subject)`.
   - Tìm thấy, user `active` → tạo session như magic link (cùng cookie `__Host-vnx_session`, cùng 30 ngày), `method = oauth_<provider>`, cập nhật `last_used_at` và `label`, ghi audit `auth.login` với `data.method`.
   - Tìm thấy nhưng user `suspended` → từ chối giống magic link.
   - Không tìm thấy → **không tạo tài khoản, không tự liên kết.** Hiện một trang chung: "Tài khoản này chưa được liên kết. Đăng nhập bằng link qua email, rồi liên kết từ trang tài khoản." Trang này giống hệt nhau dù email provider có trùng tài khoản nào hay không (không lộ email nào đã đăng ký).
3. Email của provider không cần trùng `users.email`, vì việc liên kết chủ động đã chứng minh người dùng sở hữu cả hai.
4. Rate limit callback theo IP như `/login`.

### 4. Liên kết và hủy liên kết

- Trang tài khoản (`/me`, mục "Đăng nhập & tài khoản liên kết", cho mọi user) liệt kê provider: đã liên kết (kèm `label`) hoặc chưa.
- **Liên kết:** nút là form POST có Origin check. POST tạo intent `link` gắn với session hiện tại, rồi 303 về `GET /auth/oauth/:provider/start` trong cùng site. GET này mới redirect sang provider. Như vậy POST không bao giờ redirect ra ngoài site (ràng buộc VNX-0803). Callback chỉ liên kết khi intent `link` khớp session đang đăng nhập.
- Nếu tài khoản provider đã gắn với user khác → từ chối bằng thông báo chung, không nói là user nào.
- **Hủy liên kết:** POST có Origin check, luôn được phép, vì magic link qua `users.email` vẫn còn.
- Mỗi lần liên kết hoặc hủy: ghi audit (`auth.identity.link`, `auth.identity.unlink`, có provider, không có token) **và gửi email báo cho `users.email`**. Nếu session bị đánh cắp và kẻ gian gắn tài khoản của họ để giữ quyền truy cập lâu dài, chủ tài khoản sẽ biết.

### 5. Huy hiệu xác minh trên builder profile

- Chỉ builder `approved`, và chỉ khi builder tự bật `show_on_profile` trong `/hub/profile`.
- GitHub: hiện `@login` kèm link `https://github.com/<login>`, nhãn "đã xác minh qua GitHub". `login` được làm mới mỗi lần builder đăng nhập bằng GitHub.
- LinkedIn: chỉ hiện nhãn "đã xác minh qua LinkedIn", không có link, không có email.
- Google: không bao giờ hiện công khai.
- Liên kết của client không bao giờ hiện cho builder hay ở bất kỳ trang công khai nào (luật cứng về dữ liệu cá nhân).
- **Huy hiệu danh tính không vào xếp hạng** (ADR-004). Muốn dùng nó trong ranking phải có ADR mới.
- Hủy liên kết thì huy hiệu biến mất ngay.

### 6. Ops (bổ sung ADR-010)

Resolver quyền Ops chỉ chấp nhận session có `method = magic_link`. User đăng nhập bằng OAuth mà vào `/ops` nhận 404 kín như mọi trường hợp bị từ chối. Kích hoạt lời mời Ops vẫn bắt buộc magic link khớp email, như ADR-010 §3.

## Phạm vi thay thế các ADR trước

- **ADR-002:** câu "Đăng nhập chỉ bằng magic link" đổi thành: magic link là phương thức chính, là cách duy nhất để tạo tài khoản và để có session Ops; Google/GitHub/LinkedIn là phương thức phụ cho tài khoản đã liên kết. Token magic link, session cookie, tài khoản ngầm cho client, admin qua `ADMIN_EMAILS` giữ nguyên.
- **ADR-010:** thêm điều kiện `sessions.method = magic_link` cho `/ops`. Role, 404 kín và audit không đổi.
- ADR-003: các khóa i18n mới vẫn theo parity bốn locale. Tên provider giữ nguyên, không dịch.
- ADR-004: không đổi (xem mục 5).

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Tự liên kết khi email provider đã xác minh và trùng email tài khoản | Khi đó an toàn tài khoản phụ thuộc vào cách từng provider xác minh email; có đường chiếm tài khoản nếu provider xác minh sai. Owner chọn chỉ liên kết chủ động |
| Cho tạo tài khoản mới bằng OAuth | Thêm một đường tạo tài khoản ngoài magic link, inquiry và request. Owner chọn chỉ dùng cho tài khoản đã có |
| Thay hẳn magic link bằng OAuth | Một phần client không dùng các provider này (lý do của ADR-002 vẫn đúng) |
| Session OAuth vào được Ops | Mở rộng bề mặt tấn công vào console nội bộ; ADR-010 xây quanh việc xác minh bằng magic link |
| Lưu access/refresh token để đồng bộ profile | Không cần cho đăng nhập hay huy hiệu; lưu token là thêm bí mật phải bảo vệ |
| Huy hiệu LinkedIn có link profile | API OIDC của LinkedIn không trả URL profile; dán URL tự khai thì không còn là "xác minh" |
| Dùng thư viện auth lớn (Auth.js, Lucia, …) | Kéo theo mô hình session riêng, chồng lên session của ADR-002. Plan được phép dùng thư viện OAuth client nhỏ chạy trên workerd |

## Hệ quả

- Tích cực: đăng nhập nhanh hơn cho người đã liên kết; builder có tín hiệu tin cậy kiểm được; không đổi mô hình user/session.
- Tích cực: không tạo tài khoản mới và không tự liên kết theo email, nên không có đường chiếm tài khoản qua provider.
- Chấp nhận: phải đăng ký ba ứng dụng OAuth (Google Cloud, GitHub OAuth App, LinkedIn Developer app gắn với một Company Page), quản lý 6 secret và theo dõi khi provider đổi API.
- Chấp nhận: người dùng phải đăng nhập bằng magic link ít nhất một lần trước khi dùng được OAuth.
- Chấp nhận: thêm email thông báo liên kết/hủy liên kết (template trong bốn locale).
- Chấp nhận: nút provider phải theo brand guideline của từng provider; logo tự host dưới `public/assets` (CSP không cho tải từ bên ngoài).

## Triển khai (Owner trả lời 2026-10-07)

1. **Wave 1**, làm thành EPIC 26 trong `WAVE1-ROADMAP.md` và `07-MASTER-BACKLOG.md`.
2. **Bật cả ba provider cùng lúc.** Flag riêng từng provider vẫn giữ để tắt khẩn cấp từng cái.
3. **`/privacy` và `/terms`:** bản nháp câu chữ EN/VI nằm ở cuối `docs/legal/privacy.md` và `docs/legal/terms.md`, mục "Bổ sung ADR-012". Chỉ chuyển vào phần `## EN`/`## VI` và `src/legal/content.ts` trong task VNX-2607, và task đó phải merge trước khi bật bất kỳ flag provider nào trên production.

## Được bảo đảm bởi

Plan triển khai phải thêm test cho:

- `state` sai, thiếu, hết hạn hoặc dùng lại bị từ chối; PKCE và `nonce` được kiểm; ID token sai `iss`/`aud`/`exp` bị từ chối;
- identity chưa liên kết thì không tạo user và không tạo session; trang trả về giống nhau dù email provider có trùng tài khoản hay không;
- email provider trùng `users.email` vẫn không tự liên kết;
- user `suspended` không đăng nhập được bằng OAuth;
- một tài khoản provider không gắn được với hai user; mỗi user tối đa một identity cho mỗi provider;
- start liên kết là POST có Origin check, không redirect ra ngoài site; callback `link` cần đúng session;
- liên kết/hủy liên kết ghi audit (không có token) và gửi email báo;
- session `oauth_*` vào `/ops` nhận 404 kín; session `magic_link` không đổi hành vi;
- huy hiệu chỉ hiện cho builder `approved` có `show_on_profile = 1`; Google không bao giờ hiện; identity của client không xuất hiện trong bất kỳ response nào gửi cho builder hay trang công khai;
- huy hiệu danh tính không ảnh hưởng thứ tự catalogue và Top builders;
- không có access/refresh token trong DB hay log;
- flag provider tắt thì nút ẩn và callback 404;
- parity i18n cho khóa mới.
