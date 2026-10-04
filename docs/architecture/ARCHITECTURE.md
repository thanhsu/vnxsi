# VNX.SI — System Architecture v1.0

- **Ngày:** 2026-10-03
- **Phạm vi:** Wave 1 (Supply). Lớp AI cho Wave 2 ở `AI-ARCHITECTURE.md`.
- **Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`

## 1. Bối cảnh

```
 Client / Builder / Admin (trình duyệt)
            │ HTTPS (vnx.si, 4 locale theo tiền tố URL)
            ▼
 ┌─────────────────────────── Cloudflare ───────────────────────────┐
 │  Worker `vnxsi-web`                                               │
 │   ├─ fetch   → Hono app (SSR JSX, form POST, /media, /api/health) │
 │   └─ scheduled → cron hằng ngày 01:00 UTC, hằng giờ phút 5        │
 │        │            │              │                              │
 │        ▼            ▼              ▼                              │
 │      D1 `vnxsi`   R2 `vnxsi-media`  Static assets (CSS/JS/ảnh)    │
 └────────┬──────────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
   Resend (gửi email)        Turnstile (chống bot)       [Wave 2: Anthropic API]
```

Một Worker duy nhất, không có server khác, không có bước build ngoài bundling của wrangler.

## 2. Bản đồ module (`apps/web/src/`)

| Module | Trách nhiệm | Được import |
|---|---|---|
| `index.ts` | Tạo app, gắn middleware và routes, `scheduled` handler | mọi module |
| `app.ts` | `createApp()`: Hono instance + middleware chung + error handlers | routes, http |
| `routes/` | Mỗi file một nhóm URL; đọc input, gọi domain/db, render view | domain, db, auth, email, views, i18n, http |
| `views/` | JSX thuần trình bày; nhận props đã chuẩn bị, không truy vấn DB | i18n, domain (kiểu) |
| `domain/` | State machine, validation (zod), quy tắc thuần; **không import Hono hay D1** | — |
| `db/` | Truy vấn D1 theo bảng; trả kiểu domain; **không quyết định chuyển trạng thái** | domain (kiểu) |
| `auth/` | Token magic link, session, middleware `requireUser`/`requireBuilder`/`requireAdmin` | db, http |
| `http/` | Middleware chung: request id, locale, origin check, rate limit, cookie helpers | db |
| `email/` | Interface `Mailer`, bản Resend, bản giả cho test, template theo locale | i18n; `domain` chỉ để lấy kiểu (`import type`) |
| `i18n/` | 4 file locale, `t()`, tiện ích URL theo locale, hreflang | — |
| `media/` | Upload/đọc R2, kiểm tra loại file | — |
| `stats/` | Tính `public_stats`, ghi `product_daily_stats` (M7) | db |
| `notify/` | Thông báo theo sự kiện (M5): đọc db, dựng template, gửi qua `Mailer`, ghi `notified_at` / số lần thử; dùng chung cho routes và jobs | db, domain, email, i18n |
| `jobs/` | Các job cron, gọi từ `scheduled` | db, domain, email, i18n, notify, stats; `auth/` và `http/rate-limit` cho hàm dọn bảng do chúng sở hữu |
| `monetization/` | Route `/go/`, cờ tính năng, provider port partner (`generic_template`, `manual`), disclosure (ADR-007). Bảng qua `db/clicks.ts`, `db/flags.ts`, `db/merchants.ts`, `db/programs.ts`, `db/offers.ts`, `db/conversions.ts`, `db/revenue.ts` | db, domain, views, i18n |
| `content/` | Renderer markdown giới hạn, ngưỡng index (phụ lục monetization mục 4). Bảng qua `db/articles.ts` | db, domain |

**Luật ranking không đọc tiền (ADR-007):** file xếp hạng/gợi ý (`db/catalog.ts`, `db/directory.ts`, `stats/`, matching, `ai/`) không import `db/` của monetization và không có SQL tới bảng tiền; kiểm bằng test kiến trúc.

**Luật phụ thuộc:** `domain` không phụ thuộc gì. `db` chỉ phụ thuộc kiểu của `domain`. `views` không gọi `db`. Luật này được kiểm bằng test kiến trúc (`test/architecture.test.ts`, task VNX-0003).

## 3. Vòng đời một request

```
request
 → requestId (cf-ray hoặc ULID)                         http/request-id.ts
 → locale từ tiền tố URL (/, /vi, /zh-hans, /zh-hant)   i18n/middleware.ts
 → session từ cookie __Host-vnx_session (nếu có)        auth/session-middleware.ts
 → origin check cho POST/PUT/PATCH/DELETE               http/origin.ts
 → route handler
     → zod validate input                               domain/validation/*
     → rate limit (nếu route yêu cầu)                   http/rate-limit.ts
     → domain transition (hàm thuần)                    domain/*
     → db write + audit_log                             db/*
     → thông báo (Mailer; lỗi thì để notified_at = null cho cron gửi lại)
     → render JSX hoặc redirect (POST → 303)
 → onError: log JSON {requestId, path, error} → trang lỗi theo locale
```

## 4. Dữ liệu

- D1 là nguồn sự thật duy nhất. Migration đánh số `NNNN_<tên>.sql` trong `apps/web/migrations/`, chỉ thêm, không sửa migration đã chạy production.
- Nhóm bảng: danh tính (`users`, `login_tokens`, `sessions`, `invites`, `rate_limits`), supply (`builders`, `portfolio_items`, `products`, `pricing_tiers`, `product_media`, `product_verifications`, `products_fts`), kết nối (`inquiries`, `inquiry_messages`, `requests`, `request_invites`), số liệu (`product_daily_stats`, `public_stats`), monetization (`outbound_clicks` ở M7; `feature_flags`, `merchants`, `partner_programs`, `offers`, `conversions`, `revenue_entries` ở EPIC 21), nội dung (`articles`, `article_links` ở EPIC 22), vận hành (`audit_log`), cũ (`waitlist`).
- ID là ULID; tiền là cent USD; thời gian ISO-8601 UTC.
- Ảnh trong R2, key không đoán được; DB chỉ lưu key.

## 5. Công việc nền (cron)

| Lịch | Job | Module |
|---|---|---|
| `5 * * * *` (mỗi giờ) | Tính `public_stats`, điểm trending | `jobs/hourly.ts` (M7) |
| `0 1 * * *` (mỗi ngày) | Nhắc builder, hết hạn lời mời/request, dọn token/session/rate_limits, gửi lại thông báo lỗi | `jobs/daily.ts` (M5–M6) |

Mỗi job idempotent: chạy hai lần liên tiếp không gây gửi trùng hay đổi trạng thái hai lần.

## 6. Bảo mật

- Cookie session `__Host-`, HttpOnly, Secure, SameSite=Lax; DB lưu hash.
- Origin check cho mọi request thay đổi dữ liệu.
- Rate limit bằng bảng D1 `rate_limits` (cửa sổ cố định).
- Nội dung người dùng: văn bản thuần, JSX tự escape, cấm `dangerouslySetInnerHTML` với dữ liệu người dùng.
- Turnstile + honeypot cho form công khai.
- Link ra ngoài qua `/go/`: đích tra theo id trong DB, không bao giờ lấy từ query; chỉ `https:`; host phải khớp danh sách đã đăng ký; `302` + `no-store` + `noindex` (ADR-007).
- Click không lưu IP; `visitor_hash` = HMAC với khóa xoay theo ngày từ secret `ANALYTICS_SALT`.
- Bí mật: `wrangler secret` (production), `.dev.vars` (local, đã gitignore).
- CI quét bí mật bằng gitleaks; dependency-review chặn lỗ hổng từ mức moderate.

## 7. Quan sát

- Log JSON một dòng mỗi lỗi: `requestId`, `path`, `status`, `error`. Bật Workers Logs.
- `audit_log` ghi mọi hành động quản trị và chuyển trạng thái.
- `/admin` có bảng thước đo (spec mục 3).

## 8. Test

| Tầng | Công cụ | Ví dụ |
|---|---|---|
| Unit | Vitest | state machine, zod schema, text render, ULID, i18n parity |
| Integration | Vitest + `@cloudflare/vitest-pool-workers` (workerd, D1 thật local, R2 local, Mailer giả) | luồng đăng nhập, submit → duyệt product, Inquiry, request |
| Kiến trúc | Vitest đọc import graph | `domain/` không import `hono`/`db` |
| E2E + a11y | Playwright + axe (M8) | homepage, form Inquiry, editor |

## 9. Môi trường và triển khai

| Môi trường | Cách chạy | Dữ liệu |
|---|---|---|
| Local | `npm run dev` (wrangler dev) | D1/R2 local, Mailer ghi ra console |
| Production | `npm run deploy` sau khi CI xanh và Owner duyệt | D1 `vnxsi`, R2 `vnxsi-media` |

Runbook triển khai và rollback: `docs/runbooks/deploy.md` (task VNX-0805).
