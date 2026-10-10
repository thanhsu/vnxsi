# VNX.SI — Wave 1 Roadmap

- **Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`
- **Kiến trúc:** `docs/architecture/ARCHITECTURE.md`, `docs/architecture/AI-ARCHITECTURE.md`
- **Cập nhật:** 2026-10-03

## Quy ước

- **ID task:** `VNX-MMNN` (MM = milestone, NN = số thứ tự). Task khắc phục thêm hậu tố `-F1`, `-F2`; task tách nhỏ thêm `a`/`b`.
- **Kích thước:** mỗi task ≤ 1 ngày. Diff dự kiến > ~600 dòng (không tính lockfile, file locale) thì tách trước khi làm.
- **Tag:**
  - `FOUNDATION`: các task sau phụ thuộc vào nó.
  - `QUICK-WIN`: nhỏ, giá trị thấy ngay.
  - `HIGH-RISK`: đụng production, dữ liệu, bảo mật.
  - `AGENT`: Implementer làm.
  - `HUMAN`: Owner làm.
- **Plan:**
  - Mỗi milestone có một plan ở `docs/superpowers/plans/`, viết ngay trước khi bắt đầu milestone đó, dựa trên code thật của milestone trước.
  - Task phức tạp có thể có plan riêng ở `.ai/plans/`.
- **Cổng ra:** milestone chỉ đóng khi mọi tiêu chí cổng ra đều đạt và `CURRENT-STATUS.md` đã cập nhật.

## M0 — Nền tảng công cụ

Plan: `docs/superpowers/plans/2026-10-03-vnxsi-m0-m1-foundation.md`

| Task | Nội dung | Tag | Phụ thuộc |
|---|---|---|---|
| VNX-0001 | Commit nền cho repo (trạng thái hiện tại + tài liệu) | HUMAN, HIGH-RISK | — |
| VNX-0002 | TypeScript, Hono, Vitest + workers pool; chuyển test waitlist sang Vitest | AGENT, FOUNDATION | 0001 |
| VNX-0003 | Khung app Hono (`createApp`, request id, error handler, fallback assets) + test kiến trúc | AGENT, FOUNDATION | 0002 |
| VNX-0004 | CI: typecheck + test; security CI (gitleaks, dependency-review) | AGENT | 0002 |

**Cổng ra M0:**
- `npm test` xanh, gồm toàn bộ test waitlist cũ.
- CI xanh trên nhánh chính.
- Production không đổi: `/` vẫn là landing cũ, `/api/waitlist` vẫn chạy.

## M1 — Nền tảng sản phẩm (i18n, giao diện, danh tính)

Plan: cùng file với M0.

| Task | Nội dung | Tag | Phụ thuộc |
|---|---|---|---|
| VNX-0101 | ULID, render văn bản thuần (domain) | AGENT, FOUNDATION | 0003 |
| VNX-0102 | i18n: 4 locale, `t()`, middleware locale, route theo locale, hreflang, test parity | AGENT, FOUNDATION | 0003 |
| VNX-0103 | Layout JSX, CSS token (sáng/tối), trang lỗi theo locale, component PlainText | AGENT, FOUNDATION | 0101, 0102 |
| VNX-0104 | Migration `0003_identity`, `db/users`, `db/audit`, rate limit D1 | AGENT, FOUNDATION | 0101 |
| VNX-0105 | Port `Mailer` + Resend + Fake + Console, template email đăng nhập | AGENT | 0102 |
| VNX-0106 | Token magic link, session, cookie, middleware user/admin, origin check | AGENT, HIGH-RISK | 0104 |
| VNX-0107 | Route `/login`, `/auth/verify`, `/logout`; admin bootstrap; test luồng đầy đủ | AGENT, HIGH-RISK | 0103, 0105, 0106 |

**Cổng ra M1:**
- Ở máy local, đăng nhập bằng magic link chạy hết vòng ở cả 4 locale, dùng Mailer giả.
- Test parity i18n xanh.
- Test kiến trúc xanh.
- Chưa deploy route mới lên production.

## M2 — Builder

Plan: `docs/superpowers/plans/2026-10-04-vnxsi-m2-builder.md` (task 0202, 0203, 0205 tách nhỏ cho vừa ≤ 1 ngày).

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0201 | Migration `0004_builders` (`builders`, `portfolio_items`, `invites`); state machine builder; test sở hữu bảng | AGENT, FOUNDATION |
| VNX-0202a | `/join/:code`, gắn invite vào magic link; `requireUser` giữ query | AGENT |
| VNX-0202b | `/hub/apply`, `requireBuilder` | AGENT |
| VNX-0203a | Khung Builder Hub, tổng quan, sửa hồ sơ, gửi duyệt lại | AGENT |
| VNX-0203b | Portfolio (≤12) | AGENT |
| VNX-0204 | Trang công khai `/b/:handle` | AGENT |
| VNX-0205a | Admin: hàng chờ builder, duyệt / từ chối, email | AGENT, HIGH-RISK |
| VNX-0205b | Admin: invite link | AGENT, HIGH-RISK |
| VNX-0205c | Admin: khóa / mở khóa builder và user; `ADMIN_EMAILS` cấp và thu quyền | AGENT, HIGH-RISK |

**Cổng ra M2:**
- Builder có invite đăng ký và được duyệt ngay; builder không có invite vào `pending`, admin duyệt được.
- `/b/:handle` chỉ hiện builder `approved`.

## M3 — Product

Plan: `docs/superpowers/plans/2026-10-04-vnxsi-m3-product.md`. Editor sinh form từ bảng đặc tả field, nên không chia theo "bước 1–5 / 6–9" mà theo: 8 bước văn bản (0303), Pricing (0304a), điều kiện submit + vòng đời (0304b).

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0301 | Migration `0005_products` (product, pricing tier, media, verification); state machine product; slug | AGENT, FOUNDATION |
| VNX-0303 | Product trong Hub, tạo nháp, editor 8 bước văn bản, tự thu hồi `demo_verified` khi đổi demo URL | AGENT |
| VNX-0302 | R2: upload (kiểm magic bytes, ≤2MB, ≤8 ảnh), `/media/*` | AGENT, HIGH-RISK |
| VNX-0304a | Bước Pricing (≤ 5 tier) | AGENT |
| VNX-0304b | Điều kiện submit, submit / rút lại / ẩn / hiện / lưu trữ; đếm product ở Hub | AGENT |
| VNX-0305a | Admin: duyệt / yêu cầu sửa / khóa product, huy hiệu `listed`, email | AGENT |
| VNX-0305b | Admin: gắn / thu hồi huy hiệu, mục "mới chỉnh sửa" | AGENT |
| VNX-0306 | Trang `/p/:slug`, JSON-LD, Open Graph; product trên `/b/:handle` | AGENT |
| VNX-0307 | Owner bật R2 trên tài khoản; Claude tạo bucket `vnxsi-media` | HUMAN |

**Cổng ra M3:**
- Product đi đủ vòng `draft` → `in_review` → `published` và hiện ở `/p/:slug`.
- Đổi demo URL thì mất huy hiệu Demo verified.

## M4 — Catalogue và danh bạ

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0401 | FTS5 trigram + truy vấn xếp hạng (ADR-004), fallback `LIKE` cho từ khóa 1–2 ký tự | AGENT, FOUNDATION |
| VNX-0402 | Trang `/products` với bộ lọc, phân trang | AGENT |
| VNX-0403 | Trang `/builders` (danh bạ) | AGENT |
| VNX-0404 | `sitemap.xml`, `robots.txt` (gồm `Allow: /media/products/`, `Disallow: /go/`), canonical, hreflang toàn site | AGENT, QUICK-WIN |

**Cổng ra M4:**
- Tìm được bằng tiếng Việt có dấu và bằng tiếng Trung 2 ký tự.
- Không có tham số xếp hạng trả tiền (test).

## M5 — Inquiry

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0501 | Migration `inquiries`, `inquiry_messages`; state machine | AGENT, FOUNDATION |
| VNX-0502 | Form Inquiry (4 loại + Hire), xác nhận email, Turnstile, honeypot, rate limit | AGENT, HIGH-RISK |
| VNX-0503 | Hộp thư trong Hub; `/me` cho client | AGENT |
| VNX-0504 | Email thông báo theo locale, cơ chế gửi lại qua `notified_at` | AGENT |
| VNX-0505 | Cron hằng ngày: nhắc 3 ngày, báo admin 7 ngày, dọn token/session/rate limit | AGENT |
| VNX-0506 | Trang trung gian `/auth/verify` với nút POST xác nhận (chống trình quét link email tiêu token) | AGENT, HIGH-RISK |

**Cổng ra M5:**
- Inquiry từ client chưa đăng nhập đi hết vòng: xác nhận email → builder trả lời → client thấy trong `/me`.
- Builder không thấy email của client.

## M6 — Post a request

Plan: `docs/superpowers/plans/2026-10-04-vnxsi-m6-request.md` (Owner duyệt 2026-10-04; VNX-0602 tách 0602a / 0602b cho vừa ≤ 1 ngày).

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0601 | Migration `requests`, `request_invites`; 2 state machine | AGENT, FOUNDATION |
| VNX-0602a | Email request, thông báo, `request_verify` ở `/auth/verify` | AGENT |
| VNX-0602b | Form `/request`, `/me` (request), lối vào, sitemap, Privacy | AGENT |
| VNX-0603 | Admin: hàng chờ request, gợi ý builder theo luật (spec mục 8.10), mời ≤5 | AGENT |
| VNX-0604 | Hub: tab Invitations, gửi đề xuất / từ chối | AGENT |
| VNX-0605 | `/me`: xem đề xuất, chọn → tạo Inquiry `type = request` | AGENT |
| VNX-0606 | Cron: nhắc / hết hạn lời mời, hết hạn request | AGENT |

**Cổng ra M6:** test tích hợp ở spec mục 9 phần Request xanh.

## M7 — Số liệu và homepage mới

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0701 | `product_daily_stats`: đếm view (lọc bot, chủ product, admin) | AGENT |
| VNX-0707 | `/go/p/:slug/{demo,site}`, bảng `outbound_clicks`, cột `outbound_clicks`/`demo_clicks`, secret `ANALYTICS_SALT` (phụ lục monetization mục 2; thay `/p/:slug/demo`, Owner duyệt 2026-10-04 Q3) | AGENT, HIGH-RISK |
| VNX-0708 | Landing định vị ở `/` (4 locale), CTA builder qua `/login`, waitlist client; gỡ `/api/waitlist` JSON và `public/index.html` (plan `.ai/plans/VNX-0708-plan.md`; Owner duyệt 2026-10-04, làm trước M5) | AGENT |
| VNX-0702 | Cron hằng giờ tính `public_stats` theo spec mục 8.11 | AGENT |
| VNX-0703 | Homepage SSR: các khối kèm ngưỡng | AGENT |
| VNX-0704 | Homepage: animation, chart, tooltip, bảng dữ liệu, reduced-motion | AGENT |
| VNX-0705 | `/for-builders`, `/terms`, `/privacy` | AGENT |
| VNX-0706 | Cutover: thay landing cũ, gỡ `/api/waitlist` (giữ bảng) | AGENT, HIGH-RISK |

**Cổng ra M7:**
- Mọi khối homepage ẩn đúng khi dưới ngưỡng.
- Không có số liệu nào không truy được về dữ liệu.

## M8 — Ra mắt

| Task | Nội dung | Tag |
|---|---|---|
| VNX-0801 | Hoàn thiện bản dịch, người bản xứ đọc lại `zh-Hans`/`zh-Hant` | HUMAN |
| VNX-0802 | Playwright + axe: homepage, form Inquiry, editor, login | AGENT |
| VNX-0803 | Review bảo mật toàn nhánh | AGENT (review) |
| VNX-0804 | Production: Resend domain, secrets, R2, migration remote | HUMAN, HIGH-RISK |
| VNX-0805 | Runbook `docs/runbooks/deploy.md` (trạng thái prod, rollback), script smoke | AGENT |
| VNX-0806 | Mời 20 builder sáng lập đầu tiên | HUMAN |

**Cổng ra Wave 1:** đạt điều kiện sang Wave 2 ở spec mục 2 (~100 product published).

## EPIC 26 — Tài khoản liên kết Google, GitHub, LinkedIn (ADR-012)

Owner xếp vào Wave 1 ngày 2026-10-07, bật cả ba provider cùng lúc. ADR-012 Accepted 2026-10-07. Plan riêng ở `docs/superpowers/plans/`, viết trước khi bắt đầu epic. Plan `docs/superpowers/plans/2026-10-07-vnxsi-epic26-linked-accounts.md` (Approved 2026-10-07; VNX-2603…2606 tách a/b/c). **Thứ tự so với M8 (Owner 2026-10-07):** làm ngay, merge với cả ba cờ tắt, M8 không chờ; VNX-2608 chỉ sau khi ra mắt ổn định. **Lệch dòng VNX-2603 (Reviewer duyệt 2026-10-07):** không kiểm chữ ký ID token bằng JWKS (OIDC Core §3.1.3.7), vẫn kiểm `iss`/`aud`/`azp`/`exp`/`nonce`. Phụ thuộc: VNX-2602 → 2603 → 2604, 2605 → 2606; VNX-2601 trước khi thử trên môi trường thật; VNX-2607 trước VNX-2608.

| Task | Nội dung | Tag |
|---|---|---|
| VNX-2601 | Owner tạo 3 ứng dụng OAuth (Google Cloud consent screen, GitHub OAuth App, LinkedIn app gắn Company Page), callback `/auth/oauth/:provider/callback` cho prod và local, đặt 6 secret bằng `wrangler secret` | HUMAN, HIGH-RISK |
| VNX-2602 | Migration kế tiếp: bảng `user_identities` (2 ràng buộc UNIQUE), cột `sessions.method` mặc định `magic_link`; `db/identities`; 3 flag provider | AGENT, FOUNDATION, HIGH-RISK |
| VNX-2603 | Lõi OAuth: cookie `__Host-vnx_oauth`, `state`, PKCE S256, `nonce`, kiểm ID token (JWKS, `iss`/`aud`/`exp`); port provider với adapter Google, GitHub, LinkedIn và provider giả cho test; không lưu token | AGENT, FOUNDATION, HIGH-RISK |
| VNX-2604 | Đăng nhập: nút provider ở `/login`, start/callback intent `signin`, trang "chưa liên kết" chung, chặn user `suspended`, rate limit, audit `auth.login` có `method`; resolver Ops chỉ nhận session `magic_link` | AGENT, HIGH-RISK |
| VNX-2605 | `/me` mục "Đăng nhập & tài khoản liên kết": liên kết (POST có Origin check → 303 → GET start), hủy liên kết, xung đột identity, audit, email báo 4 locale | AGENT, HIGH-RISK |
| VNX-2606 | Huy hiệu: bật/tắt `show_on_profile` ở `/hub/profile`, hiện trên `/b/:handle` (GitHub có link, LinkedIn không link, Google không bao giờ); không vào xếp hạng | AGENT |
| VNX-2604d | Logo chính thức của Google, GitHub, LinkedIn trong nút `/login` (file SVG do Owner giao ở VNX-2601, theo brand guideline từng provider); **điều kiện bắt buộc trước VNX-2608** (Owner 2026-10-08) | AGENT |
| VNX-2605c | Kết thúc các session `oauth_<provider>` khi hủy liên kết provider đó (trừ session đang thực hiện) và/hoặc "đăng xuất các phiên khác"; **điều kiện bắt buộc trước VNX-2608** (Owner 2026-10-10: kẻ chiếm phiên đã liên kết tài khoản của họ còn giữ session tới 30 ngày sau khi bị hủy liên kết) | AGENT, HIGH-RISK |
| VNX-2607 | Chép bổ sung ADR-012 vào phần `## EN`/`## VI` của `docs/legal/privacy.md`, `terms.md` và `src/legal/content.ts`, đối chiếu code; merge trước khi bật flag | AGENT |
| VNX-2608 | Owner bật 3 flag trên production, thử đăng nhập và liên kết với tài khoản thật | HUMAN, HIGH-RISK |

**Cổng ra EPIC 26:**
- Toàn bộ test ở mục "Được bảo đảm bởi" của ADR-012 xanh.
- `/privacy` và `/terms` trên production đã có bổ sung ADR-012 trước khi flag provider nào được bật.

## Wave 2 (chưa lên lịch)

AI Discovery, solution options, AI builder matching (shadow → assisted → auto), estimate, listing assistant, moderation. Tất cả theo `docs/architecture/AI-ARCHITECTURE.md`; quyết định ADR-005/006 khi brainstorm Wave 2.
