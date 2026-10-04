# VNX-0708 — Báo cáo Implementer

- **Plan:** `.ai/plans/VNX-0708-plan.md` (APPROVED 2026-10-04) · **Handoff:** `.ai/tasks/VNX-0708-handoff.md`
- **Nhánh:** `feat/vnx-0708-landing`, tạo từ `main` @ `8cb653a` (có M4 merge `d297c72`). Chưa merge, chưa push, chưa deploy.
- **Implementer:** subagent Claude (context riêng), 2026-10-04

## Commit

| SHA | Nội dung |
|---|---|
| `2b78709` | `test: landing page and client waitlist acceptance tests (VNX-0708)`: test đỏ trước (TDD) |
| `fb2ac44` | `feat(web): positioning landing at / in 4 locales with client waitlist (VNX-0708)` |
| (commit này) | `docs: VNX-0708 implementer report` |

## File

**Mới**
- `apps/web/src/domain/waitlist-input.ts`: zod schema form (`email` trim + lowercase + ≤254 + đúng regex email cũ `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, `consent` phải là `"on"`, `utm_*` cắt ≤200), honeypot `website`, `utmFrom()`, `externalReferrerHost()`. Không import Hono/D1.
- `apps/web/src/db/waitlist.ts`: `addClientSignup(db, entry, now)`, một câu `INSERT … ON CONFLICT(email) DO UPDATE`. Đây là nơi duy nhất ghi bảng `waitlist`.
- `apps/web/src/routes/landing.tsx`: `GET /` và `POST /waitlist` cho 4 locale, đăng ký qua `onLocalized`.
- `apps/web/src/views/LandingPage.tsx`: 6 khối theo plan, `organizationJsonLd()`, `builderCtaHref()`.
- `apps/web/test/landing/page.test.ts` (9 test), `apps/web/test/landing/waitlist.test.ts` (9 test).

**Sửa**
- `apps/web/src/app.ts`: gọi `registerLandingRoutes`, gỡ `app.all("/api/waitlist", …)` và import cũ.
- `apps/web/src/routes/seo.ts`: `{ rest: "/", localized: true }`.
- `apps/web/public/assets/app.css`: thêm style landing, chỉ dùng token có sẵn.
- `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`: thêm 35 key `landing.*`.
- `apps/web/test/architecture.test.ts`: `waitlist` → `../src/db/waitlist.ts`.
- `apps/web/test/app.test.ts`, `apps/web/test/seo/sitemap.test.ts` (xem "Sai khác").

**Xóa:** `apps/web/public/index.html`, `apps/web/src/waitlist.ts`, `apps/web/src/routes/waitlist.ts`, `apps/web/test/waitlist.test.ts`.

**Không đổi:** `Layout.tsx` (không cần prop mới), `wrangler.jsonc`, migration, dependency.

**Sửa ngoài danh sách:** không có.

## Tiêu chí chấp nhận

| # | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 | Đạt | `page.test.ts` › "AC1: renders the server landing in every locale…" (gồm `/`, `/vi`, `/vi/`, `/zh-hans`, `/zh-hant`: status 200, `text/html`, `<html lang>` đúng, đúng một `h1`, không còn "Something new"); "AC1: uses the approved EN and VI copy" |
| AC2 | Đạt | "AC2: has canonical on APP_ORIGIN…": gọi từ host preview, canonical/hreflang ×4 + `x-default` trỏ `https://vnx.si`, `og:title`, `og:description`, `meta description`, JSON-LD bằng đúng `{"@context","@type":"Organization","name":"VNX.SI","url":"https://vnx.si/"}` |
| AC3 | Đạt | "AC3 … signed out": `/vi/login?next=%2Fvi%2Fhub%2Fapply` xuất hiện 2 lần trong `<main>` (hero và khối builder); kiểm cả EN và zh-hant. "AC3 … signed in": `/vi/hub` và `/hub` |
| AC4 | Đạt | "AC4: shows no numbers…": regex `\d` chạy trên phần chữ của `<main>` đã bỏ thẻ, 5 path × (thường, `?joined=1`); không có `href` tới `/products` hay `/builders` |
| AC5 | Đạt | `waitlist.test.ts` › "AC5: stores a client signup…" (303 → `/vi/?joined=1#notify`, `personas = ["client"]`, `lang = vi`, có `consent_at`, `message`/`spend_band` null); "AC5: records the locale code…" (`en`, `zh-Hans`, `zh-Hant`) |
| AC6 | Đạt | "AC6: adds client to an existing entry…": `["developer"]` → `["developer","client"]`; POST lần hai không nhân đôi; `created_at` giữ nguyên; email cũ và email mới nhận phản hồi giống hệt nhau (status, `Location`, body) |
| AC7 | Đạt | Hai test "AC7": email sai → 400, `value="not-an-email"`, lỗi tiếng Việt gắn `aria-describedby="waitlist-email-error"`; thiếu đồng ý hoặc `consent=yes` → 400, lỗi EN/zh-Hant; không ghi dòng nào |
| AC8 | Đạt | "AC8: a filled honeypot…": 303 về trang thành công, không ghi dòng nào |
| AC9 | Đạt | "AC9: the 11th POST…": 10 lần 303, lần 11 → 429 với `landing.form.error.rateLimited` (vi), email vẫn được giữ, không ghi; IP khác vẫn qua |
| AC10 | Đạt | "AC10: … Origin …": thiếu `Origin` → 403; Origin lạ → 403; không ghi. (Test này xanh ngay từ đầu vì middleware `originCheck` đã có sẵn.) |
| AC11 | Đạt | `page.test.ts` › "AC11: ?joined=1 shows the success message…": `role="status"` cùng chuỗi theo locale, không có `<form>` |
| AC12 | Đạt | `app.test.ts` › "no longer serves the JSON /api/waitlist endpoint" (GET và POST → 404 `{ok:false,error:"Not found"}`); `git ls-files …` trả rỗng (bên dưới) |
| AC13 | Đạt | `sitemap.test.ts` › "lists the home page once per locale with hreflang alternates" (`/`, `/vi/`, `/zh-hans/`, `/zh-hant/`, mỗi URL có đủ 5 alternate) |
| AC14 | Đạt | `test/architecture.test.ts` và `test/i18n/parity.test.ts` xanh trong lượt `npm test` đầy đủ |
| AC15 | Đạt | `npm test`: 62 file / 400 test xanh; `npm run typecheck -w apps/web`: exit 0 |
| AC16 | Implementer đã tự xem, Reviewer vẫn phải kiểm tay | Xem mục "AC16" |

## Kết quả lệnh

Trước khi sửa (baseline trên `8cb653a`): `npm test` → **61 file, 391 test xanh**; typecheck exit 0.

Sau khi sửa:

```
> npm run typecheck -w apps/web
...
📣 Remember to rerun 'wrangler types' after you change your wrangler.jsonc file.
typecheck exit=0

> npm test
 Test Files  62 passed (62)
      Tests  400 passed (400)
   Duration  58.33s
test exit=0

> git ls-files apps/web/public/index.html apps/web/src/waitlist.ts apps/web/src/routes/waitlist.ts
(không in gì)
```

Số test: 391 − 10 (`test/waitlist.test.ts` đã xóa) + 1 (sitemap) + 9 (page) + 9 (waitlist) = 400. Ở `app.test.ts`, bỏ 1 ca và thêm 1 ca nên tổng không đổi.

## AC16 (kiểm bằng mắt)

Đã chạy `npx wrangler dev --port 8799` (local), rồi `GET` `/`, `/vi`, `/vi/`, `/zh-hans`, `/zh-hant?joined=1`, `/assets/app.css`: tất cả trả 200. Ảnh chụp lấy bằng Chrome headless, không mở trình duyệt có giao diện:
- 1280 px: `/vi` nền sáng, `/` nền tối (`--blink-settings=preferredColorScheme`).
- 360 px: `/` sáng, `/vi` tối, `/zh-hant` sáng. Chrome trên Windows không cho cửa sổ hẹp hơn khoảng 500 px, nên trang được nhúng vào một `iframe` rộng 360 px; media query chạy theo khung này.

Đã thấy: không tràn ngang ở 360 px; 4 thẻ "ways" về 1 cột; nút CTA chiếm cả chiều ngang; màu viền huy hiệu đúng xám / xanh dương / xanh lá ở cả nền sáng và tối; chữ đọc được ở nền tối. Chưa đo tỷ lệ tương phản bằng công cụ, cũng chưa thử trên thiết bị thật. **Reviewer vẫn cần kiểm AC16 theo plan.**

## Sai khác so với plan / handoff

1. **`test/app.test.ts`:** plan ghi "xóa 2 ca `/api/waitlist`". Ca "keeps /api/waitlist validation behaviour" đã xóa. Ca "returns a JSON 500 … for /api failures" được **viết lại, không xóa**, để giữ test cho nhánh JSON 500 của `app.onError`. Ca mới làm hỏng getter `APP_ORIGIN` để `originCheck` ném lỗi trên `POST /api/nope`, vì không còn route `/api` nào đọc binding. Ca "falls back to static assets" đổi từ `/` sang `/assets/app.css`, vì `/` giờ do Hono render. Thêm ca AC12.
2. **`test/seo/sitemap.test.ts`:** bỏ assertion cũ `not.toContain("<loc>https://vnx.si/vi/</loc>")` và bỏ `https://vnx.si/` khỏi danh sách loc không có alternate. Hai assertion này mâu thuẫn với AC13 và đã được thay bằng test AC13.
3. **Redirect thành công:** `Location` là `localizedPath(locale, "/") + "?joined=1#notify"`, tức `/vi/?joined=1#notify` (theo bảng Route của plan). Bảng AC5 viết `/<prefix>?joined=1#notify`, cách viết này không rõ có dấu `/` cuối hay không. Tôi theo bảng Route.
4. **`action` của form** là `/<prefix>/waitlist#notify`, để khi trang lỗi (400/429) được render lại thì trình duyệt cuộn tới form.
5. **`utm_*` dài hơn 200 ký tự được cắt, không bị từ chối.** Đây là input ẩn, nên báo lỗi cho người dùng là vô nghĩa. Code cũ cũng cắt như vậy.
6. **Thứ tự xử lý POST:** honeypot → kiểm form → rate limit → lưu. POST honeypot và POST không hợp lệ (400) không bị tính vào rate limit, vì không ghi gì.
7. **Dữ liệu `personas` hỏng:** nếu dòng cũ có `personas` không phải mảng JSON hợp lệ, upsert ghi lại thành `["client"]` thay vì trả 500. Mọi writer trước đây đều ghi mảng JSON, nên trường hợp này không xảy ra với dữ liệu hiện có.

## Câu hỏi mở (Reviewer / Owner)

- **Q1: `referrer` gần như luôn null.** Code làm đúng chữ của plan: lấy host của header `Referer` **của request POST**, và chỉ lưu khi khác host site. Nhưng POST luôn được gửi từ chính trang `/` của mình, nên `Referer` là `vnx.si` và giá trị lưu gần như luôn null. Nguồn ngoài thật chỉ thấy được ở `GET /`. Nếu muốn ghi nguồn thật: lúc render `GET /`, lấy host `Referer` ngoài rồi chuyển qua input ẩn giống `utm_*`. Cách này thêm một field form ngoài schema của plan, nên tôi không làm.
- **Q2:** Honeypot (`website`) không có `<label>`. Nó nằm trong `<div class="hp" aria-hidden="true">`, ở ngoài màn hình, `tabindex="-1"`. Muốn thêm label thì cần một chuỗi giao diện mới, không có trong bảng nội dung, nên tôi không thêm.
- **Q3:** `landing.hero.title` (EN) trùng chữ với `site.tagline`, nên footer lặp lại câu `h1`. Ở zh-Hans/zh-Hant, `landing.hero.title` dùng lại đúng bản dịch `site.tagline` đang có ("开发者"/"開發者") cho thống nhất. Các chỗ khác giữ "Builder" bằng chữ Latin như `apply.title`/`hub.title`. Bản dịch zh cần người bản xứ đọc lại ở VNX-0801, như plan đã ghi.
- **Q4:** Khi form bị render lại vì lỗi email hoặc rate limit, ô đồng ý không được tick sẵn; người dùng phải tick lại. Tôi chọn vậy để thận trọng về consent.

Ngoài các mục trên, tôi không thêm câu quảng cáo, con số, thẻ product mẫu, testimonial hay logo nào. EN/VI lấy nguyên văn từ bảng "Nội dung" của plan.

## Ghi nhận (ngoài phạm vi, không sửa)

- `TURNSTILE_SECRET` trong `src/env.ts` và comment trong `wrangler.jsonc` giờ không còn code nào dùng. Sẽ có lại khi làm VNX-0502.
- `apps/web/drafts/` vẫn còn các bản HTML landing cũ, giữ theo plan.
- `npm ci` báo một số lỗ hổng `npm audit` có sẵn từ trước; không xử lý.
