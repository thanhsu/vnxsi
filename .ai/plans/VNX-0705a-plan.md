# VNX-0705a — Terms, Privacy, Media Kit + dọn dữ liệu hết hạn · Plan

- **Trạng thái:** APPROVED bởi Owner 2026-10-04
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M7. Tách VNX-0705 thành **0705a** (`/terms`, `/privacy`, `/media-kit`, làm ngay để go-live) và **0705b** (`/for-builders`, để sau). Phần dọn `rate_limits` / `login_tokens` / `sessions` hết hạn kéo từ VNX-0505 (M5) lên đây; VNX-0505 còn lại phần nhắc builder, báo admin, xóa Inquiry `pending_verification`.
- **Spec:** Wave 1 mục 5.2 (`/terms`, `/privacy`), 8.4 (cron 01:00 UTC), 8.8 (SEO); phụ lục monetization (disclosure, ADR-007 luật 8).
- **ADR:** ADR-001, ADR-003, ADR-004, ADR-007.
- **Nội dung nguồn:** `docs/legal/terms.md`, `docs/legal/privacy.md`, `docs/legal/media-kit.md` (Reviewer soạn; Owner chốt 2026-10-04: bên vận hành "VNX.SI" + `contact@vnx.si`, luật Việt Nam, 16+ waitlist / 18+ builder, giữ waitlist tới khi chợ mở + 12 tháng, trả lời yêu cầu trong 30 ngày; Media Kit cho partner + báo chí).
- **Phụ thuộc:** `main` có VNX-0708 (`ade9f4f`).
- **Implementer / Reviewer:** subagent / Claude

## Vì sao làm bây giờ

Owner muốn go-live landing (VNX-0708). Landing thu email nên cần Privacy; Terms và Media Kit Owner yêu cầu cùng lúc (Media Kit dùng khi nộp hồ sơ partner như PartnerStack). Privacy nói IP trong bộ đếm rate limit được xóa định kỳ, nên cần job dọn dữ liệu hết hạn trước go-live.

## Phạm vi

**Trong phạm vi**
- 3 trang SSR ×4 locale: `/terms`, `/privacy`, `/media-kit`.
- Footer mọi trang: link Terms · Privacy · Media kit.
- Sitemap: thêm 3 trang (localized).
- Cron hằng ngày `0 1 * * *`: xóa cửa sổ `rate_limits` cũ, `login_tokens` hết hạn, `sessions` hết hạn.

**Ngoài phạm vi**
- `/for-builders` (0705b), `/disclosure` (EPIC 21), trang hủy đăng ký.
- Nhắc builder, báo admin, xóa Inquiry chờ xác nhận (VNX-0505, M5).
- Logo, file brand tải về; nạp font Space Grotesk.
- Bản dịch `zh-Hans`/`zh-Hant` cho thân văn bản (VNX-0801).
- Deploy.

## Thiết kế

### Nội dung

- `apps/web/src/legal/content.ts` (mới, dữ liệu thuần, không import Hono/D1): với mỗi trang `terms` / `privacy` / `mediaKit`, bản `en` và `vi` theo kiểu:
  ```ts
  type Inline = string;                         // có thể chứa `code` và **đậm**
  type Block = { p: Inline } | { ul: Inline[] };
  type Section = { heading: string; blocks: Block[] };
  type LegalDoc = { title: string; sections: Section[] };
  ```
  Chép **nguyên văn** từ mục `## EN` và `## VI` của 3 file `docs/legal/*.md` (bỏ phần đầu "Trạng thái…" và "Ghi chú cho Owner"). `{date}` thay bằng hằng `LEGAL_UPDATED_AT = "2026-10-04"`.
- Inline chỉ có 2 dấu: `` `x` `` → `<code>x</code>`, `**x**` → `<strong>x</strong>`. Hàm tách trong view, trả JSX (JSX tự escape). Không HTML, không link nội dòng; email `contact@vnx.si` render thành `<a href="mailto:contact@vnx.si">` bằng cách nhận diện đúng chuỗi đó.
- `zh-Hans`, `zh-Hant`: dùng bản `en`, kèm một đoạn trên cùng từ key i18n `legal.englishOnly` (dịch sẵn: "本页面目前仅提供英文版本，以英文版本为准。" / "本頁面目前僅提供英文版本，以英文版本為準。"; en: "This page is available in English only."; vi: không dùng) và `<html lang>` vẫn là locale của URL, còn khối nội dung có `lang="en"`.

### Route và view

| File | Thay đổi |
|---|---|
| `src/routes/legal.tsx` (mới) | `onLocalized` GET `/terms`, `/privacy`, `/media-kit` → `LegalPage` |
| `src/views/LegalPage.tsx` (mới) | `Layout` + `<article class="legal">`: `h1`, dòng "Last updated" (trừ Media Kit), các `h2` + đoạn/danh sách. Media Kit: 3 ô màu (swatch) cạnh mã màu ở mục Brand |
| `src/views/Layout.tsx` | Footer: thêm `<nav aria-label>` với 3 link theo locale, dưới tagline |
| `src/routes/seo.ts` | Thêm `/terms`, `/privacy`, `/media-kit` (`localized: true`) |
| `src/app.ts` | Đăng ký `registerLegalRoutes` |
| `src/i18n/messages/*.ts` | Key: `footer.mediaKit`, `footer.nav`, `legal.updated` ("Last updated: {date}" / "Cập nhật lần cuối: {date}" / zh), `legal.englishOnly`, title/description meta cho 3 trang |
| `public/assets/app.css` | Style `.legal` (độ rộng đọc ~70ch, khoảng cách heading), footer nav, swatch |

Meta description (EN; VI dịch tương ứng):
- Terms: "The rules for using VNX.SI, the marketplace for AI-built products."
- Privacy: "What personal data VNX.SI collects, why, who sees it, and your rights."
- Media kit: "About VNX.SI, who it is for, how we work with partners, and brand guidelines."

### Job dọn dữ liệu

| File | Thay đổi |
|---|---|
| `wrangler.jsonc` | `"triggers": { "crons": ["0 1 * * *"] }` |
| `src/index.ts` | Export thêm `scheduled(controller, env, ctx)` → `ctx.waitUntil(runDaily(env, new Date(controller.scheduledTime)))` |
| `src/jobs/daily.ts` (mới) | `runDaily(env, now)`: gọi 3 hàm dưới, log JSON một dòng số dòng đã xóa; lỗi một bước không chặn bước sau (log lỗi) |
| `src/http/rate-limit.ts` | `deleteOldRateLimitWindows(db, nowMs)`: `DELETE FROM rate_limits WHERE window_start < ?` với mốc `now − 2 ngày` (cửa sổ dài nhất đang dùng là 1 giờ; spec có giới hạn theo ngày, nên giữ 2 ngày cho an toàn) |
| `src/auth/tokens.ts` | `deleteExpiredLoginTokens(db, now)`: xóa dòng `expires_at < now` |
| `src/auth/sessions.ts` | `deleteExpiredSessions(db, now)`: xóa dòng `expires_at < now` |

Mỗi bảng chỉ bị xóa từ module sở hữu (bảng `WRITERS` của test kiến trúc không đổi). Job idempotent: chạy hai lần liền không lỗi, lần hai xóa 0 dòng.

**Phối hợp với M5:** nhánh `feat/m5-inquiry` chưa có `scheduled`. Khi M5 làm VNX-0505, phiên đó thêm bước vào `runDaily` thay vì tạo handler mới. Ghi vào `CURRENT-STATUS.md`.

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `/terms`, `/privacy`, `/media-kit` ở 4 locale (`/`, `/vi/`, `/zh-hans/`, `/zh-hant/`) trả 200, có `h1`, canonical theo `APP_ORIGIN`, hreflang 4 + `x-default`, meta description | `test/legal/pages.test.ts` |
| AC2 | Nội dung EN và VI khớp `docs/legal/*.md`: mỗi `h2` và mỗi đoạn/mục của file nguồn có mặt trong HTML (sau khi bỏ thẻ) | `test/legal/content.test.ts` đọc `docs/legal/*.md` bằng `?raw` và so |
| AC3 | `zh-Hans`, `zh-Hant`: có câu `legal.englishOnly` đúng locale và thân văn bản EN với `lang="en"` | `test/legal/pages.test.ts` |
| AC4 | `` `x` `` và `**x**` render thành `<code>`, `<strong>`; `contact@vnx.si` là link `mailto:`; không có HTML thô từ nội dung | `test/legal/pages.test.ts` (+ unit cho hàm tách inline) |
| AC5 | Media Kit không có chữ số nào ngoài mã màu hex và không nhắc tên partner | `test/legal/pages.test.ts` |
| AC6 | Footer của `/`, `/products`, `/p/:slug` có 3 link đúng locale | `test/legal/footer.test.ts` |
| AC7 | Sitemap có 3 trang × 4 locale kèm hreflang | `test/seo/sitemap.test.ts` |
| AC8 | `runDaily`: xóa cửa sổ `rate_limits` cũ hơn 2 ngày và giữ cửa sổ mới; xóa `login_tokens`, `sessions` hết hạn và giữ dòng còn hạn; chạy lần hai xóa 0 dòng | `test/jobs/daily.test.ts` |
| AC9 | `index.ts` export `scheduled`; `wrangler.jsonc` có cron `0 1 * * *` | `test/jobs/daily.test.ts` (import default, kiểm có `scheduled`); `grep -n '"0 1 \* \* \*"' apps/web/wrangler.jsonc` |
| AC10 | Test kiến trúc, parity i18n, toàn bộ test, typecheck xanh | `npm test`, `npm run typecheck -w apps/web` |
| AC11 | Dễ đọc ở 360 px và 1280 px, sáng và tối | Reviewer xem bằng `npm run dev` |

## Điều kiện go-live (cập nhật)

1. ✅ Email Routing `contact@vnx.si` (Owner, 2026-10-04).
2. Merge VNX-0705a.
3. Owner bật R2 → `npx wrangler r2 bucket create vnxsi-media`.
4. `npm run db:migrate:remote -w apps/web` (0003–0006).
5. Xác minh domain gửi mail trên Resend; `wrangler secret put RESEND_API_KEY`, `wrangler secret put ADMIN_EMAILS`.
6. `npm run deploy` (lần deploy này đăng ký cron).
7. Smoke: `/`, `/vi`, `/terms`, `/privacy`, `/media-kit`, `/login` (gửi link thật tới email Owner), `/robots.txt`, `/sitemap.xml`.

## Nghĩa vụ để lại

- M5, M6, M7, EPIC 21: mỗi task thêm loại dữ liệu cá nhân hoặc cookie mới phải sửa `docs/legal/privacy.md` và `src/legal/content.ts` trong cùng task.
- VNX-0801: dịch thân văn bản 3 trang sang `zh-Hans`/`zh-Hant`, người bản xứ đọc lại.
- Người có chuyên môn pháp lý đọc lại Terms mục 5, 11 và Privacy mục 6, 7 (ghi chú trong file nguồn).

## Câu hỏi mở

Không có.
