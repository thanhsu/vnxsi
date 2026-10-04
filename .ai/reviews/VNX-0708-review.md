# VNX-0708 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `.ai/plans/VNX-0708-plan.md`, handoff `.ai/tasks/VNX-0708-handoff.md`, báo cáo `.ai/tasks/VNX-0708-report.md`, toàn bộ diff `main (8cb653a)..095b510` trên nhánh `feat/vnx-0708-landing` (21 file, +974/−741).
- **Lệnh đã chạy lại:**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test` → 62 file, **400/400** xanh (trước task: 391; −10 test waitlist cũ, +19 test mới).
  - `git ls-files apps/web/public/index.html apps/web/src/waitlist.ts apps/web/src/routes/waitlist.ts` → rỗng.
  - `wrangler d1 migrations apply vnxsi --local` + `wrangler dev --port 8799`: `/`, `/vi`, `/vi/`, `/zh-hans`, `/zh-hant` → 200; `/index.html`, `/api/waitlist` → 404.
  - Thử tay `POST /vi/waitlist`: hợp lệ → `303 /vi/?joined=1#notify`, dòng D1 `personas = ["client"]`, `lang = vi`, `utm_source = x`, có `consent_at`; email sai → 400, giữ `value="bad"`, lỗi tiếng Việt; thiếu `Origin` → 403.
  - Chrome headless: `/vi` và `/` ở 1280 px sáng và tối; `/zh-hant` và `/vi?joined=1` ở 360 px (iframe 360 px, vì cửa sổ Chrome headless trên Windows không hẹp hơn ~500 px).

## Verdict

**APPROVE WITH CHANGES.** Code đúng phạm vi, đúng kiến trúc (domain không import Hono/D1, chỉ `db/waitlist.ts` ghi bảng, view không gọi DB), nội dung EN/VI khớp từng chữ với plan, không có số liệu hay nội dung bịa. Cần sửa F1–F3 trước khi merge; F1 là lỗi của plan (Reviewer), không phải của Implementer.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM | `apps/web/src/routes/landing.tsx:53` (`externalReferrerHost(c.req.header("referer"), …)` trong POST) | Plan yêu cầu đọc `Referer` ở POST, nhưng POST luôn đến từ chính trang landing nên `referrer` gần như luôn `null`. Nguồn giới thiệu thật chỉ thấy ở `GET /`. Dữ liệu attribution của waitlist mất. Implementer đã nêu (Q1). | Ở `GET /`: tính `externalReferrerHost` từ `Referer` và đưa vào input ẩn `ref` (như `utm_*`). Ở `POST`: nhận `ref` qua zod, chỉ chấp nhận hostname hợp lệ (`[a-z0-9.-]`, ≤ 200, không phải host của site), không hợp lệ → null. Test: GET với `Referer: https://news.ycombinator.com/item?id=1` → form có `ref=news.ycombinator.com`; POST mang `ref` đó → dòng D1 có `referrer = news.ycombinator.com`; `ref` có path/ký tự lạ → null. |
| F2 | LOW | `apps/web/src/views/LandingPage.tsx:138` (checkbox `consent`) | Sau lỗi email, form hiện lại nhưng ô đồng ý bị bỏ đánh dấu; người dùng phải đánh lại. Spec 8.9: "render lại form với giá trị đã nhập". Implementer đã nêu (Q4). | Thêm `consent?: boolean` vào `LandingForm`, đặt `checked` khi lần gửi trước có `consent = "on"`. Test: POST email sai + `consent=on` → HTML có `checked` ở `#waitlist-consent`. |
| F3 | LOW | `apps/web/src/routes/landing.tsx:45` (`siteHosts`) | `siteHosts` chỉ gồm host của request và của `APP_ORIGIN`. Production còn phục vụ `www.vnx.si` (tới khi có redirect ở VNX-0804), nên referrer từ `www.vnx.si` bị coi là bên ngoài. Có ý nghĩa sau khi sửa F1. | Coi là nội bộ mọi host bằng host của `APP_ORIGIN` hoặc `www.` + host đó. Test trong `externalReferrerHost` (unit). |
| F4 | SUGGESTION | `LandingPage.tsx` hero / `Layout.tsx` footer | `h1` EN trùng nguyên văn tagline ở footer. | Chấp nhận, không sửa trong task này (footer thuộc Layout, nội dung đã duyệt). |
| F5 | SUGGESTION | `apps/web/public/assets/app.css:96` | Hero sát header (8 px) trên desktop, trông hơi chật. | Tùy chọn: `padding-top: 24px`. Không bắt buộc. |

### Sai khác do Implementer báo — đã xem, chấp nhận

1. `app.test.ts`: giữ test JSON 500 cho `/api/*` bằng cách gây lỗi trong origin check. Hợp lý: giữ được bảo đảm "500 ở `/api` không có chuỗi lỗi tiếng Anh".
2. `sitemap.test.ts`: bỏ assertion "`/` không có bản locale", vì mâu thuẫn AC13. Đúng.
3. Redirect `/vi/?joined=1#notify`, form action có `#notify`. Đúng ý plan.
4. `utm_*` > 200 ký tự bị cắt, không bị từ chối. Giữ hành vi cũ, chấp nhận.
5. Bài gửi không hợp lệ hoặc dính honeypot không tính vào rate limit. Chấp nhận: các bài đó không ghi DB; bài hợp lệ vẫn bị giới hạn 10/giờ/IP.
6. `personas` không phải mảng JSON hợp lệ → đặt lại `["client"]`. Chấp nhận (dữ liệu hiện có đều là mảng).

Q2 (honeypot không có label): chấp nhận. Ô nằm ngoài màn hình, `aria-hidden`, `tabindex=-1`.
Q3 (h1 trùng tagline): xem F4.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `test/landing/page.test.ts` "AC1…" (4 locale + `/vi/`); thử tay 200 |
| AC2 | ✓ | `page.test.ts` "AC2…": canonical/hreflang theo `APP_ORIGIN` dù request từ `preview.workers.dev`; JSON-LD đúng dạng |
| AC3 | ✓ | `page.test.ts` "AC3…" (chưa và đã đăng nhập) |
| AC4 | ✓ | `page.test.ts` "AC4…": regex `\d` trên text `<main>`, cả khi `?joined=1`; không link `/products`, `/builders` trong `<main>` |
| AC5 | ✓ | `test/landing/waitlist.test.ts`; thử tay D1 |
| AC6 | ✓ | `waitlist.test.ts` (gộp `["developer","client"]`, không nhân đôi) |
| AC7 | ✓ | `waitlist.test.ts`; thử tay 400 giữ email |
| AC8 | ✓ | `waitlist.test.ts` (honeypot → 303, không ghi) |
| AC9 | ✓ | `waitlist.test.ts` (lần 11 → 429) |
| AC10 | ✓ | `waitlist.test.ts`; thử tay 403 |
| AC11 | ✓ | `page.test.ts` (`?joined=1` → `role="status"`); ảnh 360 px `/vi?joined=1` |
| AC12 | ✓ | `test/app.test.ts`; `git ls-files` rỗng |
| AC13 | ✓ | `test/seo/sitemap.test.ts` |
| AC14 | ✓ | `architecture.test.ts`, `parity.test.ts` trong 400/400 |
| AC15 | ✓ | typecheck exit 0, 400/400 |
| AC16 | ✓ | Reviewer xem ảnh headless: 1280 px sáng/tối, 360 px sáng (`zh-hant`, `vi`): một cột, không tràn ngang, nút CTA rộng toàn hàng, màu huy hiệu đúng 05-UI-SCOPE, dark mode đọc được. Chưa đo tỷ lệ tương phản bằng công cụ (để VNX-0802 Playwright + axe) |

## Nghĩa vụ để lại cho task sau

- **Trước go-live:** OQ-1 của plan (trang `/privacy`) vẫn mở.
- **VNX-0502:** `TURNSTILE_SECRET` hiện không còn chỗ dùng; khi làm Turnstile cho Inquiry thì cân nhắc áp cho form waitlist.
- **VNX-0801:** người bản xứ đọc lại chuỗi `landing.*` ở `zh-Hans`, `zh-Hant`.
- **VNX-0802:** đo tương phản (axe) cho landing ở cả hai chế độ màu.
- **VNX-0804:** redirect `www.vnx.si` → `vnx.si` (liên quan F3).
- Ghi nhận (ngoài phạm vi): ở 360 px header xuống 2 dòng (nav + chọn ngôn ngữ + đăng nhập); có từ M4, không do task này.
