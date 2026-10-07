# VNX.SI M7 — Số liệu và homepage mới Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** Approved. Owner đã trả lời (a)–(d), (f) và (b) ngày 2026-10-05 (xem "Quyết định của Owner (2026-10-05)"); Opus đã duyệt header và Task 1 theo ủy quyền của Owner. Task 2–10 (và 0701c) được viết chi tiết ngay trước khi làm.
- **Roadmap / Backlog:** `docs/roadmap/WAVE1-ROADMAP.md` → M7: VNX-0701, 0702, 0703, 0704, 0705 (phần còn lại), 0706, 0707. **Đã xong, không làm lại:** VNX-0708 (landing định vị ở `/`), VNX-0705a (Terms, Privacy, Media Kit, cron dọn dữ liệu).
- **Nhánh:** `feat/m7-metrics` (tách từ `main` `12902b2`, đã có M0–M6, EPIC 21, PR #4, VNX-0705a, VNX-0708).

**Goal:** Có số liệu thật và đúng ngưỡng. Lượt xem, click ra ngoài và Inquiry của từng product được đếm vào `product_daily_stats` (lọc bot, builder của product, admin; mỗi trình duyệt một lần mỗi product mỗi ngày); `/go/p/:slug/{demo,site}` chuyển hướng và ghi `outbound_clicks`; cron hằng giờ tính `public_stats` theo spec 8.11; homepage dữ liệu thật hiện từng khối chỉ khi qua ngưỡng (nếu Owner chọn thay landing, câu hỏi (a)); `/for-builders` có trang. Không có con số nào không truy được về dữ liệu.

**Architecture:**
- Module `insights` (ADR-007 luật 1, phụ lục 2.3): `domain/{stats,bot,visitor,public-stats}.ts` thuần; `db/stats.ts` là module DUY NHẤT ghi `product_daily_stats` (và bảng dedupe lượt xem), `db/public-stats.ts` là module duy nhất ghi `public_stats` và chứa các truy vấn đọc của cron. `routes/go.ts` và `routes/product-page.tsx` chỉ ghép; route `/go/` gọi hàm của `db/stats.ts`, không ghi bảng của module khác (phụ lục 2.3).
- Dùng lại bảng, module và route của EPIC 21: `outbound_clicks` (migration `0012`, KHÔNG thêm migration thứ hai cho bảng này), `db/clicks.ts`, `domain/outbound.ts`, `routes/go.ts`. Route `/go/p/:slug/{demo,site}` đăng ký TRƯỚC `app.get("/go/*")` catch-all.
- Nhận diện người xem: cookie ngẫu nhiên `__Host-vnx_vid` (16 byte hex, không gắn danh tính). `visitor_hash = HMAC-SHA256(cookie, dayKey)` với `dayKey = HMAC-SHA256(ANALYTICS_SALT, ngày UTC)` (phụ lục 2.2): băm khác nhau mỗi ngày nên không nối được giữa các ngày. Thiếu `ANALYTICS_SALT` thì `visitor_hash = null`, không dedupe, không lỗi trang (phụ lục 2.5).
- Cron hằng giờ `5 * * * *` ghi `public_stats` (key + JSON + `computed_at`); homepage chỉ đọc bảng này, không truy vấn nặng lúc request (spec 8.11). Mọi ngưỡng áp ở domain thuần lúc TÍNH và lúc ĐỌC (đọc lại kiểm `computed_at` còn mới; quá cũ thì khối ẩn).
- Admin: M7 KHÔNG xây màn thước đo mới. Ops O2 (`/ops`, "tổng quan + sức khỏe") sở hữu toàn bộ KPI và sức khỏe hệ thống; M7 chỉ để lại các hàm đọc thuần ở `db/public-stats.ts` mà O2 có thể dùng. Bảng thước đo §3 hiện có ở `/admin` giữ nguyên.

**Tech Stack:** như M0–M6, không thêm dependency. WebCrypto (`crypto.subtle`) cho HMAC. Migration mới: **bắt đầu từ `0014`**, vì phiên Ops O1 giữ `0013_ops_members` (plan `2026-10-05-vnxsi-ops-o1.md`). `0014_product_stats` (Task 1), `0015_view_dedupe` (Task 3), `0016_public_stats` (Task 5). Chỉ thêm. Nếu `0013` chưa có trên `main` lúc merge thì cứ giữ số `0014`+ (khoảng trống số không hỏng `wrangler d1 migrations`); nếu Ops đổi số, đánh số lại theo thứ tự. Không chạy migration remote, không deploy.

**Spec:** Wave 1 §5.2 (`/for-builders`), §5.8–5.9 (homepage, khối, ngưỡng, animation, chart), §6 (`product_daily_stats`, `public_stats`), §8.4 (cron), §8.8 (SEO), §8.11 (số liệu), §9 (test `public_stats`, reduced-motion, hreflang), §10 (cron `5 * * * *`). Phụ lục monetization §2 (`/go/p/`, `outbound_clicks`, `visitor_hash`, `ANALYTICS_SALT`, cột `outbound_clicks`/`demo_clicks`). **ADR:** ADR-004 (không vị trí trả tiền), ADR-007 (luật 1, 2: ranking không đọc tiền; test kiến trúc), ADR-010 (Ops).

## Trạng thái đối chiếu với code (2026-10-05, `12902b2`)

- `product_daily_stats`, `public_stats`, `db/stats.ts`: chưa có. `outbound_clicks` có đủ cột (kể cả `visitor_hash` luôn null).
- `routes/go.ts`: `app.get("/go/*")` catch-all trả 404 (cả `/go/p/…`); `test/monetization/go.test.ts:326` đang khẳng định `/go/p/some-product/{demo,site}` là 404 và dòng ~338 dùng `/go/p/x/demo`: sửa ở Task 4.
- `index.ts#scheduled`: chỉ `0 1 * * *`; `wrangler.jsonc` `triggers.crons = ["0 1 * * *"]`.
- `domain/outbound.ts#isBotRequest(userAgent, cf)`: UA rỗng, regex UA, hoặc `cf.botManagement.verifiedBot === true`. Chỉ `routes/go.ts` gọi.
- `/` là landing VNX-0708 (`routes/landing.tsx`, `views/LandingPage.tsx`, `views/landing/Deck.tsx`); `public/index.html` và `/api/waitlist` đã gỡ (không còn `public/index.html`, không còn route). VNX-0706 vì vậy chỉ còn việc "thay landing 0708 bằng homepage dữ liệu" (câu hỏi (a)).
- `/for-builders` đã nằm trong danh sách handle dành riêng (`domain/builder-input.ts`) nhưng chưa có route. `/`, `/terms`, `/privacy`, `/disclosure`, `/media-kit`, `/contact` đã có trong sitemap; thiếu `/for-builders`.
- Test kiến trúc (`test/architecture.test.ts`): `WRITERS` chưa có `product_daily_stats`; `RANKING_FILES` chưa có file Trending/Top; còn treo review F6 của EPIC 21 (đối chứng dương, regex SQL không phân biệt hoa thường).
- Ops O1 (đang làm ở phiên khác) chỉ có khung, vai trò, audit, chuyển `/admin`; "Overview" O1 không có KPI. O2 sở hữu metric. M7 vì vậy không thêm màn admin thước đo.

## Quyết định của Owner đã có (ràng buộc)

- **2026-10-04:** bỏ homepage M7 sớm; làm landing định vị VNX-0708 (đã xong). `/go/p/:slug/{demo,site}` thay `/p/:slug/demo` (Q3).
- **2026-10-05:** `outbound_clicks` giữ 13 tháng (`OUTBOUND_CLICK_RETENTION_DAYS = 395`, cron ngày đã xóa). Privacy hiện câu "for now we do not link it to any visitor identifier" phải được sửa khi `visitor_hash` có hiệu lực, **chỉ bằng câu chữ Owner duyệt** (câu hỏi (b)).
- Mọi task thêm cookie hoặc dữ liệu cá nhân sửa `docs/legal/privacy.md` và `src/legal/content.ts` trong cùng task (CURRENT-STATUS).

## Quyết định của Owner (2026-10-05)

- **(a) A2:** các khối dữ liệu hiện DƯỚI landing VNX-0708 ở `/`; landing được thay sau, khi dữ liệu qua ngưỡng. VNX-0706 thành "không có cutover" (chỉ ghi nhận, cộng phần a11y). Đây là lệch roadmap đã được duyệt; cổng ra M7 "thay landing cũ" được đọc lại thành "các khối dữ liệu ẩn đúng khi dưới ngưỡng, landing 0708 giữ nguyên".
- **(b) B1:** không banner; cookie `__Host-vnx_vid` hết hạn cuối ngày UTC; tôn trọng GPC; căn cứ lợi ích chính đáng. Câu chữ EN/VI ở mục (b) bên dưới **ĐÃ DUYỆT NGUYÊN VĂN**.
- **(b, mục 10 của Privacy):** CÓ, đây là thay đổi quan trọng. Người dùng đã đăng nhập phải được báo trước khi cookie đếm lượt truy cập ra mắt: thêm task VNX-0701c ngay trước Task 3 (câu chữ thông báo chờ Owner duyệt).
- **(c) C1:** cron hằng giờ `5 * * * *`. Owner kiểm còn chỗ cho trigger trên tài khoản dùng chung trước khi deploy.
- **(d) D2:** `/for-builders` tối thiểu, dựng từ chữ landing đã duyệt, không tuyên bố mới.
- **(f) F1:** chấp nhận; Owner thêm rate limit Cloudflare cho `/p/*` và `/go/p/*`.

Phán quyết của Controller: **(e) E2:** job giờ loại Inquiry `removed` khỏi `inquiries_7d` (Trending tính từ bảng `inquiries`, không chỉ cột đếm; Task 5). **(g) G2:** số liệu Hub của builder làm sau M7 (ghi nhận).

## Quyết định thiết kế của Reviewer (cần Opus review)

1. **Không đụng `0013`.** Migration M7 từ `0014`. Không FK từ `product_daily_stats` ngược vào module khác ngoài `products` (`ON DELETE CASCADE`). Bảng `public_stats` không có FK.
2. **`product_daily_stats` dùng UPSERT cộng dồn** (`ON CONFLICT (product_id, day) DO UPDATE SET col = col + excluded.col`), một câu lệnh một dòng, tên cột chỉ lấy từ một map cố định trong code (không nối chuỗi từ đầu vào). Ngày = ngày UTC (`substr(iso, 1, 10)`).
3. **Đếm Inquiry** ở `db/stats.ts#inquiryOpenedStatement`, nối vào cùng `db.batch` với lần Inquiry vào `open` (`createInquiry` khi đã đăng nhập; `openPendingInquiry` khi xác nhận). Chỉ cộng khi dòng inquiry có `product_id`, `status = 'open'` và `opened_at` đúng bằng thời điểm của lần chuyển này, nên mở lại (`answered` → `open`, `opened_at` giữ nguyên) không cộng lần hai; Inquiry loại `request` (không có `product_id`) không cộng. Hai lần xác nhận trùng cùng một mili giây là sai số chấp nhận (ghi chú, không khóa).
4. **Cookie người xem thiếu thì vẫn đếm lượt đầu:** `GET /p/:slug` 200 không có cookie hợp lệ → sinh cookie mới (hết hạn cuối ngày UTC), đếm một lượt (đây chắc chắn là lượt đầu của trình duyệt đó hôm nay). Trình duyệt chặn cookie, và script không giữ cookie, bị đếm MỖI lần gọi (đếm thừa, không đếm thiếu): ghi trong câu hỏi (b) cho trình duyệt chặn cookie và trong câu hỏi (f) cho script; Owner quyết định (f). Phương án thay thế (chỉ đếm khi có cookie) đếm thiếu mọi khách mới nên bị loại. Bot không nhận cookie. Cookie chỉ do `GET /p/:slug` đặt; `/go/p/` chỉ đọc.
5. **Dedupe lượt xem:** bảng `product_view_dedupe (day, visitor_hash, product_id)` PK ba cột, `INSERT OR IGNORE … RETURNING` quyết định có cộng `views` hay không (`RETURNING` thay `meta.changes`); dọn ở cron ngày sau 2 ngày. Dedupe click dùng lại chỉ mục `idx_clicks_visitor` trên `outbound_clicks` (không bảng mới): "đã có dòng cùng `visitor_hash`, `product_id`, `link_kind` trong ngày UTC, không phải bot" → không cộng.
6. **Luật bot chung** `domain/bot.ts#isBotRequest(userAgent, cf)` thay hàm của `domain/outbound.ts` (giữ re-export cho test cũ). Giữ đúng luật hiện tại (UA rỗng, regex UA, `verifiedBot === true`); spec 8.11 nói "theo User-Agent và `cf.botManagement` nếu có" mà không có ngưỡng điểm, nên KHÔNG dùng `botManagement.score` (không bịa ngưỡng). Một luật cho view, click, dedupe.
7. **Chủ product và admin không được đếm:** so `session.user.id` với `builder.userId` của product và dùng vị từ "đội nội bộ" chung với guard `/admin` và `/ops` (không đọc `is_admin` trực tiếp) ngay trong route (domain nhận `{ isBot, isOwnBuilder, isAdmin }`, thuần). Click `/go/p/` vẫn ghi `outbound_clicks` kể cả khi không cộng thống kê (phụ lục 2.3).
8. **Cron hằng giờ** là một trigger thứ hai `5 * * * *` (spec §10 đã ghi sẵn); `scheduled` rẽ theo `controller.cron`. Job hằng giờ chỉ ghi `public_stats`; không gửi mail. Bước dọn dedupe nằm ở job ngày.
9. **Không có số liệu mà không truy được:** mỗi key `public_stats` có hàm tính thuần có test với dữ liệu mẫu theo từng ngưỡng. Khi dưới ngưỡng, hàm trả `null` và cron GHI `null`; homepage không bao giờ tự tính. Làm tròn xuống, không bao giờ lên.
10. **Test kiến trúc:** `product_daily_stats`, `product_view_dedupe`, `public_stats` vào `WRITERS`; mọi file Trending/Top mới vào `RANKING_FILES` kèm đối chứng dương (một file giả lập có import `db/offers.ts` phải làm test đỏ) và regex SQL không phân biệt hoa thường (review F6) trước khi thêm file đầu tiên (Task 5). Mỗi file xếp hạng mới vào `RANKING_FILES` đúng lúc được tạo: `domain/public-stats.ts`, `db/public-stats.ts` (Task 5), `jobs/hourly.ts` (Task 6), `routes/home.tsx`, `views/home/{Trending,TopBuilders,TopProducts}.tsx` (Task 7).
11. **`db/stats.ts` là hàm sự kiện trung tâm (ADR-007 luật 10):** mọi nơi đếm số liệu sản phẩm (Inquiry, view, click) gọi các hàm của `db/stats.ts`; không module nào khác ghi `product_daily_stats` hay `product_view_dedupe`. Click offer (`/go/o/`, `/go/:merchant`) không bao giờ đi qua đây.
12. **Lệch phụ lục 2.5 khi thiếu salt:** xem Global Constraints "Thiếu `ANALYTICS_SALT`". Ghi nhận như một lệch cần duyệt.
13. **Triển khai:** `0014` phải được áp trước khi deploy code M7 (ghi ở `wrangler.jsonc` và mục "Sau M7"). `0014`–`0016` dành cho M7; Ops O2 bắt đầu từ `0017`.

## Câu hỏi cho Owner

Chỉ các quyết định nghiệp vụ. Mọi thứ khác là quyết định kỹ thuật ở trên.

### (a) Homepage dữ liệu thật có THAY landing VNX-0708 ở `/` không? (chặn Task 7, 8, 10)

Spec Wave 1 §5.2/5.9 mô tả `/` là homepage động (hero, con số, Live, Trending, Market pulse, Top builders, ...). Ngày 2026-10-04 Owner bỏ homepage sớm để làm landing định vị; landing đó hiện ở `/`. VNX-0706 trong roadmap là "thay landing cũ", nhưng landing cũ đã gỡ ở 0708.

- **A1. Thay hẳn:** `/` thành homepage động; landing 0708 (định vị, waitlist client) bị gỡ hoặc dời. Đúng spec, nhưng homepage rỗng khi dưới ngưỡng gần như toàn bộ khối (chưa có ~100 product).
- **A2. Giữ landing 0708, thêm khối dữ liệu bên dưới:** các khối dữ liệu hiện ở `/` dưới phần định vị, mỗi khối ẩn khi dưới ngưỡng; CTA waitlist giữ nguyên. Không thay spec, nhưng thêm một khoản lệch.
- **A3. Dữ liệu ở `/explore` (hoặc `/market`), `/` giữ landing:** không lẫn hai mục đích.
- **A4. Hoãn Task 7, 8, 10 sau khi có dữ liệu:** M7 chỉ làm số liệu (Task 1–6, 9); homepage động làm khi qua ngưỡng.
- **Khuyến nghị: A2 trong M7, rồi A1 khi có đủ dữ liệu.** Lý do: với dữ liệu hiện tại hầu hết khối bị ẩn; A2 cho Task 7, 8 giá trị thật khi dữ liệu tới mà không phải gỡ landing đã duyệt, và VNX-0706 trở thành "đổi `/` sang homepage động" quyết định sau, bằng một thay đổi nhỏ. Nếu Owner chọn A2/A3, plan này sửa VNX-0706 thành "không có cutover, chỉ ghi nhận" và cổng ra M7 "thay landing cũ" được đối chiếu lại.

### (b) Câu chữ Privacy cho `visitor_hash` và cookie ẩn danh (chặn Task 3, 4)

Cần duyệt nguyên văn trước khi Task 3 chạy (Reviewer chép vào `docs/legal/privacy.md`, Task 3 chép vào `src/legal/content.ts`, test `legal/content` so từng dòng). Đây có phải "thay đổi quan trọng" theo mục 10 của Privacy (cần báo trước người dùng, đổi ngày hiệu lực) hay không là quyết định của Owner; Reviewer đề nghị coi là quan trọng vì thêm một cookie và một mục đích mới.

Sự thật kỹ thuật làm nền: `visitor_hash` đã đổi mỗi 00:00 UTC (khóa ngày), nên cookie sống lâu hơn một ngày UTC không đem lại lợi ích đếm nào và chỉ biến nó thành mã nhận diện thiết bị dài hạn. Vì vậy cookie hết hạn đúng cuối ngày UTC.

Các điểm nghiệp vụ trong câu chữ: (1) cookie hết hạn cuối ngày UTC; (2) mở đầu mục 5 (Cookie) phải sửa vì hiện nói chỉ dùng cookie cần thiết cho site hoạt động; (3) mục 3 (mục đích) thêm đếm lượt truy cập để hiện thống kê công khai; (4) căn cứ: lợi ích chính đáng khi đo lường khán giả (đoạn "We rely on…"); (5) cơ chế phản đối: tín hiệu `Sec-GPC: 1` thì không đặt cookie và không đếm gì, và chính sách nói rõ; (6) chỉ trang product, không áp cho builder của product hay đội của chúng tôi; (7) mỗi trang product và mỗi link demo/website của nó được đếm tối đa một lần mỗi người mỗi ngày.

EN, mục 5 (mở đầu, thay câu "We use only cookies that the site needs to work"):

> We use only cookies that the site needs to work, and one cookie to count visits.

EN, mục 5 (thêm một dòng):

> - `__Host-vnx_vid`: a random code, not linked to your name, e-mail address or account, used only to count visits to product pages. It expires at the end of the current day (UTC). We do not set it if your browser sends the Global Privacy Control signal (`Sec-GPC: 1`).

EN, mục 3 (thêm một dòng mục đích):

> - To count visits to product pages and clicks on a product's demo and website links, so that we can show public statistics (for example which products are trending).

EN, đoạn "We rely on…" (thêm vào cuối đoạn, theo cấu trúc hiện có của file):

> For counting visits we rely on our legitimate interest in measuring how the site is used. You can object at any time by turning on the Global Privacy Control signal in your browser: we then set no cookie and count nothing.

EN, mục 2 (thêm sau gạch đầu dòng "Outbound clicks"):

> - **Visit counting:** when you open a product page, we store the random code above in a cookie. We combine it with a secret that changes every day, so each product page, and each of its demo or website links, is counted at most once per visitor per day, and the result cannot be matched from one day to the next. We do not count visits that look like automated bots, visits by the product's own builder, or visits by our team. If your browser blocks the cookie, the page works the same, but each visit may be counted.

EN, thay câu cuối của gạch đầu dòng "Outbound clicks" ("…and for now we do not link it to any visitor identifier.") bằng:

> We do not store your IP address, your email address or your account with that record. The record may hold the day-specific code described under "Visit counting", which cannot be matched across days.

EN, mục 6: giữ "Outbound click records: deleted after 13 months" và thêm "Daily de-duplication records: deleted after 2 days."

VI, vị trí tương ứng:

> Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động, và một cookie để đếm lượt truy cập.

> - `__Host-vnx_vid`: một mã ngẫu nhiên, không gắn với tên, email hay tài khoản của bạn, chỉ dùng để đếm lượt truy cập trang product. Cookie hết hạn vào cuối ngày hiện tại (UTC). Chúng tôi không đặt cookie này nếu trình duyệt của bạn gửi tín hiệu Global Privacy Control (`Sec-GPC: 1`).

> - Đếm lượt truy cập trang product và lượt bấm link demo, website của product, để hiện thống kê công khai (ví dụ product nào đang trending).

> Với việc đếm lượt truy cập, chúng tôi dựa trên lợi ích chính đáng trong việc đo lường cách trang được sử dụng. Bạn có thể phản đối bất cứ lúc nào bằng cách bật tín hiệu Global Privacy Control trong trình duyệt: khi đó chúng tôi không đặt cookie và không đếm gì.

> - **Đếm lượt truy cập:** khi bạn mở trang một product, chúng tôi lưu mã ngẫu nhiên nói trên trong cookie. Chúng tôi kết hợp mã đó với một khóa bí mật đổi mỗi ngày, nên mỗi trang product, và mỗi link demo hay website của nó, được đếm tối đa một lần cho mỗi người mỗi ngày, và kết quả không thể đối chiếu từ ngày này sang ngày khác. Chúng tôi không đếm lượt truy cập giống bot tự động, lượt của chính builder của product, hay của đội ngũ chúng tôi. Nếu trình duyệt chặn cookie, trang vẫn hoạt động như cũ, nhưng mỗi lượt truy cập có thể bị đếm.

> Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó. Bản ghi có thể chứa mã theo ngày nêu ở "Đếm lượt truy cập", mã này không thể đối chiếu giữa các ngày.

VI mục 6: giữ dòng 13 tháng, thêm "Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày."

Lựa chọn:

- **B1. Không banner, cookie hết hạn cuối ngày UTC, tôn trọng GPC, căn cứ lợi ích chính đáng, nêu cơ chế phản đối trong chính sách** (khuyến nghị): nhẹ nhất, đúng dữ liệu thực tế (không gắn danh tính, không bên thứ ba, không quảng cáo).
- **B2. Banner đồng ý trước:** thêm một task trước Task 3; cookie chỉ đặt sau khi đồng ý. An toàn pháp lý nhất ở EU, nhưng làm giảm số lượt đếm và thêm giao diện.
- **B3. Luật sư xem trước:** Task 3, 4 chờ; sau đó theo B1 hoặc B2.
- Phương án phụ (không khuyến nghị): cookie 30 ngày. Không có lợi ích đếm nào (băm đã đổi theo ngày) và trở thành mã nhận diện thiết bị 30 ngày; nếu chọn, phải sửa câu chữ trên (hết hạn sau 30 ngày) và cân nhắc lại căn cứ pháp lý.
- Khuyến nghị B1, kèm quyết định "đây là thay đổi quan trọng" (báo trước, cập nhật ngày hiệu lực).

### (c) Cron hằng giờ thứ hai có chấp nhận không? (chặn deploy Task 6, không chặn viết code)

Hiện chỉ có `0 1 * * *`. Spec §10 ghi sẵn `["0 1 * * *", "5 * * * *"]`. Mỗi lần chạy là một lượt đọc D1 (~10 truy vấn, vài trăm row) ghi `public_stats`.

- **C1. Có, trigger `5 * * * *`** (khuyến nghị): đúng spec, "cập nhật mỗi giờ" trên homepage đúng thật.
- **C2. Không thêm trigger:** tính `public_stats` trong cron ngày (số liệu cũ tối đa 24 giờ; nhãn homepage phải đổi thành "cập nhật hằng ngày"), hoặc tính lười lúc request (trái spec 8.11).
- Khuyến nghị C1. Lưu ý: giới hạn cron trigger tính theo TÀI KHOẢN Cloudflare, và tài khoản này dùng chung với vsnstock; Owner kiểm số trigger còn lại của tài khoản trước khi deploy (không chỉ của Worker `vnxsi-web`).

### (d) `/for-builders` có cần làm ngay không, và ai viết nội dung? (chặn Task 9)

Spec §5.2: "trang kêu gọi builder + nút đăng ký"; CTA "Become a builder" đã trỏ tới `/login` (VNX-0708) và khối builder của landing đã có chữ. Không có copy nào được duyệt cho trang riêng; không có tuyên bố, con số hay testimonial nào được tự nghĩ ra.

- **D1. Làm trang, Owner viết (hoặc duyệt) copy 4 locale** (khuyến nghị cho nội dung): cấu trúc do Implementer dựng từ spec (vì sao bán product trên VNX.SI theo các điều đã khóa: ranking không bán, builder không giới hạn quốc tịch, Inquiry qua platform; quy trình Invite → Apply → Submit for review); mọi câu chữ do Owner duyệt trước Task 9.
- **D2. Trang tối thiểu, tái dùng chữ landing 0708 đã duyệt:** chỉ ghép lại các khối đã có của landing (không viết mới) + nút.
- **D3. Hoãn:** giữ CTA hiện tại, đưa `/for-builders` sang sau M7 (và gỡ khỏi M7; sitemap không đổi).
- **Khuyến nghị D2 ngay, D1 khi Owner có copy.** D2 không cần quyết định nghiệp vụ mới và không rủi ro "bịa".

### (e) Inquiry bị gỡ vì spam (`removed`) có tính vào điểm Trending không? (chặn Task 5)

Spec 8.11: `inquiries` tăng khi Inquiry vào `open`; không nói về việc trừ khi sau đó bị admin `removed`. Hiện đếm một chiều, không trừ.

- **E1. Giữ nguyên spec:** đếm lúc vào `open`, không trừ (khuyến nghị cho M7: đơn giản, truy được, không sửa số cũ).
- **E2. Job giờ loại Inquiry `removed`:** tính `inquiries` của Trending từ bảng `inquiries` (bỏ `removed`) thay vì cột đếm; chính xác hơn khi có spam, nhưng Trending không còn đọc thuần `product_daily_stats` và lệch spec.
- Khuyến nghị E1; làm E2 nếu thấy spam lọt Trending.

### (f) Lượt xem và click bị thổi phồng bằng script không cookie (chặn Task 3, 4)

Script không giữ cookie bị đếm mỗi lần gọi (quyết định 4; bot khai báo UA đúng thì được lọc, bot giả UA thì không). Đây ảnh hưởng điểm Trending, mà Trending không được để ai mua hoặc gian lận được.

- **F1. Chấp nhận, thêm rate limit của Cloudflare trên `/p/*` và `/go/p/*`** (khuyến nghị): không đổi code đếm, chặn ở rìa.
- **F2. Chỉ đếm bằng beacon có cookie quay lại:** trang gửi một request nhỏ thứ hai kèm cookie; cần JS client và đếm thiếu khách chặn JS.
- **F3. Trần theo product mỗi ngày:** quá N lượt không cookie/ngày thì không cộng; cần Owner chọn N (không đoán).
- Khuyến nghị F1.

### (g) Số liệu của chính builder trong Builder Hub (không chặn M7)

Spec §5.3 "Tổng quan" Hub chưa nói builder thấy lượt xem/click của product mình.

- **G1. Làm ngay trong M7:** thêm khối trong `/hub` đọc `product_daily_stats` của product của mình.
- **G2. Sau M7** (khuyến nghị): M7 giữ phạm vi; Ops O2 và Hub cùng đọc `product_daily_stats` sau khi dữ liệu đã đủ tin cậy.

## Global Constraints

- Mọi ràng buộc của plan M0–M6 và EPIC 21 vẫn áp dụng (không thêm dependency, ranh giới module, Origin check cho POST, test sở hữu bảng, `RETURNING` thay `meta.changes` cho bảng có trigger, chuỗi giao diện qua `t()` đủ 4 locale, test nặng timeout 30 s, `Cache-Control: no-store` cho `/admin*`, `/go/*`).
- **Ngưỡng hiển thị (spec 8.11, chính xác):** Product published (của builder `approved`) ≥ 10; Builder approved ≥ 10; Request 30 ngày (`requests.submitted_at`) ≥ 10; Quốc gia builder (distinct `country` của builder `approved`) ≥ 3; Điểm trending `inquiries_7d × 5 + demo_clicks_7d × 2 + views_7d`, product cần điểm ≥ 20; % đổi so với 7 ngày trước đó; sparkline 14 ngày; Request theo category: tổng ≥ 10, category có < 3 request gộp vào "Other"; Category thiếu supply: category có tỷ lệ request/product cao nhất, cần ≥ 3 request; Tăng trưởng: ≥ 4 tuần ISO; Top builder "được chọn" (`request_invites.status = 'selected'` + Inquiry `answered` trong 90 ngày): builder cần ≥ 2; "trả lời nhanh" (trung vị `invited_at → responded_at` hoặc `opened_at →` tin trả lời đầu tiên, 90 ngày): builder cần ≥ 5 lượt; "xác minh" (product có `demo_verified` hoặc `in_production`): builder cần ≥ 1; Top product theo category: huy hiệu cao nhất, rồi `inquiries` 30 ngày, rồi `published_at`. Sự kiện Live: tối đa 20 dòng, ẩn khi < 5 sự kiện trong 7 ngày. Hero: dưới 3 product published → thẻ "Your product here". Con số: ẩn ô dưới ngưỡng, ẩn cả hàng nếu còn < 2 ô. Trending: < 6 product đủ điểm → ẩn, thay bằng "Founding products". Market pulse: chart 1 cần ≥ 10 request/30 ngày, chart 2 cần ≥ 4 tuần.
- **Bot:** `isBotRequest(ua, cf)` = UA rỗng/khoảng trắng, hoặc khớp `/bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i`, hoặc `cf.botManagement.verifiedBot === true`. Không ngưỡng điểm.
- **Không đếm khi:** bot, builder của chính product, đội của chúng tôi (dùng cùng vị từ quyền đang bảo vệ `/admin` và `/ops`, không đọc `is_admin` trực tiếp, vì Ops O1 đổi cách cấp quyền), hoặc request mang `Sec-GPC: 1`. Dòng `outbound_clicks` vẫn ghi (kể cả khi GPC, với `visitor_hash = null`).
- **GPC:** `Sec-GPC: 1` → không đặt cookie, không đếm `views`/`demo_clicks`/`outbound_clicks` vào `product_daily_stats`, không ghi `product_view_dedupe`; trang vẫn 200 và redirect vẫn chạy. Đây là cơ chế phản đối nêu trong Privacy (câu hỏi (b)).
- **Dedupe:** một lần mỗi (`visitor_hash`, product, loại) mỗi ngày UTC; loại = `views`, `demo`, `site`. Click ra từ `/go/o/` và `/go/:merchant` (offer) KHÔNG BAO GIỜ cộng `product_daily_stats`; chỉ `demo` và `site` cộng.
- **Thiếu `ANALYTICS_SALT` (một luật duy nhất):** không cộng gì vào `product_daily_stats` (không views, không clicks; Inquiry không cần salt nên vẫn đếm), không cookie, `visitor_hash = null`; dòng `outbound_clicks` VẪN ghi; `console.warn` một lần mỗi isolate. Lệch phụ lục 2.5 ("không dedupe", ngụ ý vẫn cộng): thiếu salt thì cộng không dedupe sẽ thổi phồng Trending nên không cộng; đây là lệch được ghi nhận, cần Opus/Owner chấp thuận.
- **Click `/go/p/` (Reviewer ruling 2026-10-05, Owner FYI):** không có cookie hợp lệ → `visitor_hash = null` → không cộng `product_daily_stats` (dòng `outbound_clicks` vẫn ghi). **`ANALYTICS_SALT` là công tắc bật đếm trên production: Owner KHÔNG đặt `ANALYTICS_SALT` trên production cho tới ngày Task 3 + Privacy cùng lên (Task 4 được phép deploy trước Task 3). Trong khoảng đó mỗi isolate ghi một dòng log `visitor.no_salt`: bình thường, không phải lỗi.**
- **Cookie:** tên `__Host-vnx_vid`; giá trị `^[0-9a-f]{32}$`; `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`; `Max-Age` = số giây tới 00:00 UTC kế tiếp (không sàn: luôn ≥ 1; khuyến nghị (b), vì băm đã đổi theo ngày; 30 ngày chỉ là phương án phụ, không có lợi ích đếm). CHỈ đặt trên `GET /p/:slug` trả 200 cho một khách được đếm (không bot, không builder của product, không đội của chúng tôi, không GPC, có `ANALYTICS_SALT`). `/go/p/` chỉ ĐỌC cookie, không bao giờ đặt. Không đặt trên `/admin`, `/ops`, `/hub`, `/me`. Phản hồi có `Set-Cookie` kèm `Cache-Control: private`.
- **Salt:** `ANALYTICS_SALT` là `wrangler secret`, `.dev.vars` ở local, KHÔNG trong repo, KHÔNG trong `wrangler.jsonc` `vars`; thêm `ANALYTICS_SALT?: string` vào `Bindings`.
- **Tải ghi D1:** mỗi lượt xem được đếm là một `db.batch` (dedupe + upsert) qua `waitUntil`, tức tối đa 2 lần ghi mỗi lượt; bot, GPC, builder chủ, đội nội bộ không ghi. Mức này chấp nhận được ở quy mô Wave 1; nếu vượt, gom theo isolate (ngoài phạm vi).
- **`/go/p/:slug/{demo,site}`:** chỉ GET/HEAD (HEAD không ghi), không tiền tố locale, đọc duy nhất `src` ∈ `product_page|builder_page|catalog|home|article|tools` (khác → `unknown`), đích chỉ lấy từ `products.demo_url` / `products.website_url` trong DB (không bao giờ từ query); chuẩn hóa bằng `new URL(raw).href` rồi chạy kiểm URL công khai `validatePublicUrl` (thuần, không allowlist: `https:`, không userinfo, `isPublicHostname` đúng, `port` rỗng; `Location` luôn là `href` đã chuẩn hóa); CÙNG hàm được dùng ở editor product khi lưu `demo_url`/`website_url`; trước khi deploy Owner chạy một truy vấn SQL kiểm toàn bộ `demo_url`/`website_url` hiện có (liệt kê giá trị không qua hàm; Task 4 ghi truy vấn vào báo cáo); diễn giải ADR-007 luật 7 cho product: host đã đăng ký là host đang lưu của product, kiểm lúc lưu và lúc redirect; gắn `utm_source=vnx.si&utm_medium=referral` trừ khi URL đã có tham số `utm_*`; `302` + `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin`; product không `published` hoặc builder không `approved` hoặc thiếu URL → 404 theo locale mặc định, không ghi click; URL hỏng trong DB → 404 + `console.error`.
- **Cron:** ngày `0 1 * * *` (giữ nguyên); giờ `5 * * * *`. `scheduled` rẽ theo `controller.cron` (giá trị lạ → bỏ qua, ghi log). Job giờ idempotent (chạy hai lần cùng giờ cho cùng kết quả), một bước hỏng không dừng bước sau (như `runDaily`).
- **`public_stats`:** `key TEXT PRIMARY KEY`, `value TEXT NOT NULL` (JSON), `computed_at TEXT NOT NULL`. Homepage đọc ≤ 1 truy vấn; `computed_at` quá 3 giờ → khối ẩn (stale).
- **Retention:** `product_daily_stats` giữ vĩnh viễn (không dữ liệu cá nhân); `product_view_dedupe` xóa sau 2 ngày; `outbound_clicks` 395 ngày (đã có).
- **Không bịa:** không số liệu mẫu trên giao diện production; dữ liệu mẫu chỉ ở test; "cập nhật mỗi giờ" chỉ hiện khi cron giờ có `computed_at` thật.
- **A11y đi kèm (CURRENT-STATUS):** `.error-msg` đạt tương phản AA ở dark mode; vùng chạm ≥ 44 px cho brand và sign-in; skip link "Skip to content" ở Layout (Task 10).
- Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.

## Review Focus

1. **Không đếm sai:** bot, builder chủ product, admin không tăng `views`/`demo_clicks`/`outbound_clicks`; dedupe đúng theo ngày UTC và theo (visitor, product, loại); qua nửa đêm UTC đếm lại. Test ở Task 3, 4.
2. **Riêng tư:** `visitor_hash` khác nhau giữa hai ngày cho cùng cookie; không IP/email/user id trong `outbound_clicks`, `product_view_dedupe`, `product_daily_stats`; thiếu `ANALYTICS_SALT` thì null và không cookie; bot không nhận cookie. Test ở Task 2, 3, 4.
3. **Open redirect `/go/p/`:** đích chỉ từ DB; `//evil.com`, `\`, CR/LF, `%0d%0a`, `javascript:`, `http:`, IP, userinfo trong `demo_url` đều → 404. Route đứng trước catch-all. Test ở Task 4.
4. **Ngưỡng:** từng key `public_stats` ở sát ngưỡng (n−1 → null/ẩn, n → hiện); "Other" gộp category < 3; trending đúng công thức và ngưỡng 20; Top builder ngưỡng 2/5/1. Test ở Task 5, 7.
5. **Xếp hạng không đọc tiền:** file Trending/Top vào `RANKING_FILES`; không import `db/{merchants,programs,offers,conversions,revenue,clicks}.ts`, không SQL bảng tiền (kể cả đối chứng dương và regex không phân biệt hoa thường). `outbound_clicks` chỉ vào thống kê qua `db/stats.ts` bằng `demo_clicks`/`outbound_clicks` (đếm click, không phải tiền). Test ở Task 5.
6. **Cron:** hai trigger đúng; `scheduled` rẽ đúng; job giờ idempotent; không đổi hành vi job ngày. Test ở Task 6.
7. **Không bịa số:** mọi con số trên homepage truy được về một key `public_stats` có `computed_at`; không có số hard-code trong view. Test ở Task 7.
8. **Privacy khớp code:** `legal/content` so từng dòng với `docs/legal/privacy.md`; câu "for now we do not link it…" đã thay. Test ở Task 3.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc | Chặn bởi |
|---|---|---|---|---|
| 1 | VNX-0701a | Migration `0014_product_stats`, `domain/stats.ts`, `db/stats.ts`, đếm Inquiry khi vào `open`, test sở hữu bảng | — | — |
| 2 | VNX-0707a | `domain/bot.ts` (luật bot chung, thay `isBotRequest`), `domain/visitor.ts` (HMAC, `dayKey`, `parseVisitorCookie`, hết hạn cuối ngày UTC, `hasGpc`), `auth/staff.ts#isStaff`, `ANALYTICS_SALT` vào `Bindings`/`wrangler.jsonc` ghi chú | 1 | — |
| 3c | VNX-0701c | Thông báo cho người dùng đã đăng nhập về thay đổi Privacy (câu chữ chờ Owner duyệt) | 1 | câu chữ thông báo |
| 3 | VNX-0701b | Cookie `__Host-vnx_vid` (chỉ `GET /p/:slug` 200), GPC, migration `0015_view_dedupe`, đếm `views`, dọn `product_view_dedupe` (bảng + retention + Privacy "xóa sau 2 ngày" cùng một chỗ), Privacy (câu chữ (b)) | 1, 2 | (b), (f) |
| 4 | VNX-0707b | `/go/p/:slug/{demo,site}` trước catch-all, ghi `outbound_clicks` kèm `visitor_hash`, cộng `demo_clicks`/`outbound_clicks`, `ProductPage` đổi link, sửa `go.test.ts` | 1, 2 | — (Privacy do Task 3; nếu Task 3 chưa chạy thì `visitor_hash` giữ null, xem Task 4) |
| 5 | VNX-0702a | Migration `0016_public_stats`, `domain/public-stats.ts` (mọi công thức và ngưỡng), `db/public-stats.ts` (truy vấn + ghi), test kiến trúc (F6, ranking, WRITERS) | 1 | — |
| 6 | VNX-0702b | `jobs/hourly.ts`, `scheduled` rẽ cron, `wrangler.jsonc` trigger `5 * * * *`, gọi bước dọn dedupe của Task 3 trong job ngày (không viết lại) | 5 | (c) khi deploy |
| 7 | VNX-0703 | Homepage SSR: các khối kèm ngưỡng (đọc `public_stats`) | 5, 6 | (a) |
| 8 | VNX-0704 | Animation, chart, tooltip, bảng dữ liệu, `prefers-reduced-motion`, JS client nhỏ | 7 | (a) |
| 9 | VNX-0705b | `/for-builders` (4 locale), link nav, sitemap | — | (d) |
| 10 | VNX-0706 | Cutover (theo (a)): đổi `/`, cập nhật hreflang/sitemap/test, skip link, `.error-msg`, 44 px, cổng ra M7 | 7, 8, 9 | (a) |

Thứ tự thực thi: 1 → 2 → 5 → 4 → 6 → 3c → 3 → 7 → 8 → 9 → 10. Mỗi task ≤ 1 ngày, diff ≲ 600 dòng (không tính locale). Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Task 4 trước Task 3 là có chủ ý: `/go/p/` ghi `visitor_hash` chỉ khi có cookie, và cookie chỉ do Task 3 đặt; cho tới khi Task 3 xong (chờ Owner (b)) `visitor_hash` là null và click không dedupe (đúng "null khi không có cookie", phụ lục 2.2). Không cần câu Privacy mới cho tới lúc đó, nên "for now we do not link it…" vẫn đúng.

---

### Task 1: VNX-0701a — `product_daily_stats` và đếm Inquiry

**Files:**
- Create: `apps/web/migrations/0014_product_stats.sql`
- Create: `apps/web/src/domain/stats.ts`, `apps/web/src/db/stats.ts`
- Modify: `apps/web/src/db/inquiries.ts` (`createInquiry` nối thêm câu đếm vào batch khi `status = 'open'` và có `productId`)
- Modify: `apps/web/src/routes/inquiry-confirm.ts` (`openPendingInquiry`: thêm câu đếm vào batch)
- Modify: `apps/web/test/architecture.test.ts` (`WRITERS.product_daily_stats`)
- Modify: `apps/web/wrangler.jsonc` (ghi chú thứ tự deploy `0014_product_stats`)
- Test: `apps/web/test/domain/stats.test.ts`, `apps/web/test/db/stats.test.ts`, `apps/web/test/db/inquiry-stats.test.ts`, thêm ca xác nhận vào `apps/web/test/inquiry-gate.test.ts` (đường link email) và `apps/web/test/me/inquiries.test.ts` (đường "Send now" ở `/me`), cả hai đi qua `openPendingInquiry`

Ngoài phạm vi: đếm `views` (Task 3), `demo_clicks`/`outbound_clicks` (Task 4), đọc/tổng hợp (Task 5). Task này chỉ tạo bảng, hàm ghi chung và hành vi Inquiry.

**Interfaces:**
- Consumes: `createInquiryStatements`, `setInquiryStatusStatement`, `returnedInquiry` (`db/inquiries.ts`), `openPendingInquiry` (`routes/inquiry-confirm.ts`), `makeInquiry`, `ensureUser`, `makeBuilder`, `addLiveProduct`, `testEnv`.
- Produces:
  - `domain/stats.ts`: `STAT_FIELDS = ["views", "demo_clicks", "outbound_clicks", "inquiries"] as const`, `type StatField`, `type StatDelta = Partial<Record<StatField, number>>`, `utcDay(at: string | Date): string` (`YYYY-MM-DD`, UTC).
  - `db/stats.ts`: `bumpProductStatStatement(db, { productId, day, delta }): D1PreparedStatement`, `bumpProductStat(db, input): Promise<void>`, `inquiryOpenedStatement(db, { inquiryId, openedAt }): D1PreparedStatement`.

**Quyết định kỹ thuật:** xem "Quyết định thiết kế của Reviewer" mục 2, 3. Thêm: `delta` chỉ nhận số nguyên ≥ 0 (ném lỗi nếu không); `bumpProductStat` không nuốt lỗi (caller `/go/` và `/p/` tự bọc `waitUntil` + log). `inquiryOpenedStatement` KHÔNG ném khi inquiry không hợp lệ: câu `INSERT … SELECT … WHERE` không chèn dòng nào.

- [ ] **Step 1: Migration**

`apps/web/migrations/0014_product_stats.sql`:

```sql
-- M7 VNX-0701 (spec §8.11): per-product daily counters. Additive only.
-- `day` is the UTC date. No personal data: counters only. Written only by src/db/stats.ts.
-- 0013 belongs to Ops O1 (ops_members); M7 numbering starts at 0014.
CREATE TABLE product_daily_stats (
  product_id      TEXT    NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  day             TEXT    NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  views           INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  demo_clicks     INTEGER NOT NULL DEFAULT 0 CHECK (demo_clicks >= 0),
  outbound_clicks INTEGER NOT NULL DEFAULT 0 CHECK (outbound_clicks >= 0),
  inquiries       INTEGER NOT NULL DEFAULT 0 CHECK (inquiries >= 0),
  PRIMARY KEY (product_id, day)
) WITHOUT ROWID;
CREATE INDEX idx_product_daily_stats_day ON product_daily_stats (day);
```

Thêm vào `apps/web/wrangler.jsonc`, sau dòng ghi chú migration mới nhất của `main` (`0012_outbound_clicks`) và thêm `0014_product_stats` vào dòng `1. npm run db:migrate:remote …`:

```jsonc
  // 0014_product_stats (M7) ships with its code the same way: migrate first, then deploy.
```

- [ ] **Step 2: Test domain (fail)**

`apps/web/test/domain/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STAT_FIELDS, utcDay } from "../../src/domain/stats.ts";

describe("product stats (spec §8.11)", () => {
  it("counts exactly the four fields of product_daily_stats", () => {
    expect([...STAT_FIELDS]).toEqual(["views", "demo_clicks", "outbound_clicks", "inquiries"]);
  });

  it("takes the day in UTC from an ISO string or a Date", () => {
    expect(utcDay("2026-10-05T23:59:59.999Z")).toBe("2026-10-05");
    expect(utcDay("2026-10-06T00:00:00.000Z")).toBe("2026-10-06");
    expect(utcDay(new Date("2026-10-05T17:30:00.000-07:00"))).toBe("2026-10-06");
  });

  it("rejects anything that is not a date", () => {
    expect(() => utcDay("not a date")).toThrow();
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/stats.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 3: Domain**

`apps/web/src/domain/stats.ts`:

```ts
/** Per-product daily counters (spec §8.11). Pure: no Hono, no D1. */

/** The columns of `product_daily_stats` that are counters, in table order. */
export const STAT_FIELDS = ["views", "demo_clicks", "outbound_clicks", "inquiries"] as const;
export type StatField = (typeof STAT_FIELDS)[number];
export type StatDelta = Partial<Record<StatField, number>>;

/** The UTC date `YYYY-MM-DD` of an instant. Throws on anything that is not a valid date. */
export function utcDay(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${String(at)}`);
  return d.toISOString().slice(0, 10);
}
```

Chạy lại test domain → PASS.

- [ ] **Step 4: Test db (fail)**

`apps/web/test/db/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bumpProductStat, bumpProductStatStatement } from "../../src/db/stats.ts";
import { makeBuilder, addLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const row = (productId: string, day: string) =>
  testEnv.DB.prepare("SELECT views, demo_clicks, outbound_clicks, inquiries FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<Record<string, number>>();

async function product(tag: string) {
  const builder = await makeBuilder(`${tag}@vnx.si`, tag, "approved");
  return addLiveProduct(builder, `${tag} product`);
}

describe("db/stats (VNX-0701a)", () => {
  it("creates the day row on the first bump and adds to it after", async () => {
    const p = await product("stats-a");
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    expect(await row(p.id, "2026-10-05")).toEqual({ views: 1, demo_clicks: 0, outbound_clicks: 0, inquiries: 0 });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 2, demo_clicks: 1, outbound_clicks: 1 } });
    expect(await row(p.id, "2026-10-05")).toEqual({ views: 3, demo_clicks: 1, outbound_clicks: 1, inquiries: 0 });
  });

  it("keeps one row per product and day", async () => {
    const p = await product("stats-b");
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-06", delta: { views: 1 } });
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM product_daily_stats WHERE product_id = ?1").bind(p.id).first<{ n: number }>())?.n).toBe(2);
  });

  it("is additive under concurrency", async () => {
    const p = await product("stats-c");
    await Promise.all(Array.from({ length: 5 }, () => bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } })));
    expect((await row(p.id, "2026-10-05"))?.views).toBe(5);
  });

  it("refuses a negative, fractional or unknown delta and a bad day", async () => {
    const p = await product("stats-d");
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: -1 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1.5 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { bogus: 1 } as never })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "05/10/2026", delta: { views: 1 } })).toThrow();
  });

  it("the table holds counters only: no column that could identify a visitor", async () => {
    const { results } = await testEnv.DB.prepare("PRAGMA table_info(product_daily_stats)").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["product_id", "day", "views", "demo_clicks", "outbound_clicks", "inquiries"]);
  });

  it("is removed with its product", async () => {
    // A bare draft: addLiveProduct creates children (pricing, media, badges) whose FKs have no cascade and would block the DELETE.
    const builder = await makeBuilder("stats-e@vnx.si", "stats-e", "approved");
    const p = await createProductDraft(testEnv.DB, { builderId: builder.userId, name: "stats-e product", now: "2026-10-05T00:00:00.000Z" });
    await bumpProductStat(testEnv.DB, { productId: p.id, day: "2026-10-05", delta: { views: 1 } });
    await testEnv.DB.prepare("DELETE FROM products WHERE id = ?1").bind(p.id).run();
    expect(await row(p.id, "2026-10-05")).toBeNull();
  });

  it("refuses a day that is not a real date", async () => {
    const p = await product("stats-f");
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-13-45", delta: { views: 1 } })).toThrow();
    expect(() => bumpProductStatStatement(testEnv.DB, { productId: p.id, day: "2026-02-30", delta: { views: 1 } })).toThrow();
  });
});
```

Thêm `import { createProductDraft } from "../../src/db/products.ts";` ở đầu file. Test sở hữu bảng: raw SQL `DELETE FROM products` trong test không vi phạm (chỉ quét `src/**`).

Chạy: `npm test -w apps/web -- test/db/stats.test.ts` → FAIL (thiếu `db/stats.ts`).

- [ ] **Step 5: Db**

`apps/web/src/db/stats.ts` (module duy nhất ghi `product_daily_stats`):

```ts
import { STAT_FIELDS, type StatDelta } from "../domain/stats.ts";

/** `YYYY-MM-DD` that is a real calendar date (rejects 2026-13-45 and 2026-02-30). */
function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/**
 * Adds `delta` to the (product, day) row, creating it when missing, as one statement for db.batch (spec §8.11).
 * Column names come only from STAT_FIELDS, never from the caller's strings. Throws on a bad day or a delta that is
 * not a non-negative integer or names an unknown field.
 */
export function bumpProductStatStatement(db: D1Database, input: { productId: string; day: string; delta: StatDelta }): D1PreparedStatement {
  if (!isRealDay(input.day)) throw new Error(`invalid day: ${input.day}`);
  for (const [key, value] of Object.entries(input.delta)) {
    if (!(STAT_FIELDS as readonly string[]).includes(key)) throw new Error(`unknown stat field: ${key}`);
    if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`invalid delta for ${key}: ${String(value)}`);
  }
  const n = (field: (typeof STAT_FIELDS)[number]) => input.delta[field] ?? 0;
  return db
    .prepare(
      `INSERT INTO product_daily_stats (product_id, day, views, demo_clicks, outbound_clicks, inquiries)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (product_id, day) DO UPDATE SET
         views = views + excluded.views,
         demo_clicks = demo_clicks + excluded.demo_clicks,
         outbound_clicks = outbound_clicks + excluded.outbound_clicks,
         inquiries = inquiries + excluded.inquiries`,
    )
    .bind(input.productId, input.day, n("views"), n("demo_clicks"), n("outbound_clicks"), n("inquiries"));
}

export async function bumpProductStat(db: D1Database, input: { productId: string; day: string; delta: StatDelta }): Promise<void> {
  await bumpProductStatStatement(db, input).run();
}

/**
 * Counts an inquiry for its product on the UTC day it opened (spec §8.11: "inquiries tăng khi Inquiry vào open"), as a statement for
 * the SAME db.batch that opens it. It inserts nothing unless the row is a product inquiry that is `open` and whose `opened_at` is exactly
 * `openedAt`: a stale `openedAt`, a `pending_verification` row, request inquiries (no product) and a lost compare-and-set
 * (the winner stamped an earlier opened_at) count nothing. Two confirmations in the same millisecond may count twice; accepted for a statistic.
 */
export function inquiryOpenedStatement(db: D1Database, input: { inquiryId: string; openedAt: string }): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO product_daily_stats (product_id, day, views, demo_clicks, outbound_clicks, inquiries)
       SELECT product_id, substr(opened_at, 1, 10), 0, 0, 0, 1 FROM inquiries
       WHERE id = ?1 AND product_id IS NOT NULL AND status = 'open' AND opened_at = ?2
       ON CONFLICT (product_id, day) DO UPDATE SET inquiries = inquiries + excluded.inquiries`,
    )
    .bind(input.inquiryId, input.openedAt);
}
```

Chạy lại test db → PASS.

- [ ] **Step 6: Test đếm Inquiry (fail)**

`apps/web/test/db/inquiry-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { setInquiryStatus } from "../../src/db/inquiries.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T10:00:00.000Z";
const inquiriesOn = async (productId: string, day: string) =>
  (await testEnv.DB.prepare("SELECT inquiries FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ inquiries: number }>())?.inquiries ?? 0;

describe("inquiries are counted when they open (spec §8.11)", () => {
  it("counts a signed-in inquiry for its product on the UTC day it opened", async () => {
    const { product } = await makeInquiry({ tag: "istat-open", status: "open", now: NOW });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(1);
  });

  it("does not count an unconfirmed (pending_verification) inquiry", async () => {
    const { product } = await makeInquiry({ tag: "istat-pending", status: "pending_verification", now: NOW });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(0);
  });

  it("does not count an inquiry that has no product (a request inquiry)", async () => {
    const sum = async () => (await testEnv.DB.prepare("SELECT COALESCE(SUM(inquiries), 0) AS n FROM product_daily_stats").first<{ n: number }>())?.n ?? 0;
    const before = await sum();
    await makeInquiry({ tag: "istat-noprod", status: "open", withProduct: false, type: "hire", now: NOW });
    expect(await sum()).toBe(before);
  });

  it("a later status change does not count again and does not move the count to another day", async () => {
    const { inquiry, product } = await makeInquiry({ tag: "istat-later", status: "open", now: NOW });
    await setInquiryStatus(testEnv.DB, { id: inquiry.id, from: "open", to: "answered", now: "2026-10-06T10:00:00.000Z" });
    expect(await inquiriesOn(product!.id, "2026-10-05")).toBe(1);
    expect(await inquiriesOn(product!.id, "2026-10-06")).toBe(0);
  });

  it("inquiryOpenedStatement alone inserts nothing for a stale openedAt or for a pending_verification row", async () => {
    const open = await makeInquiry({ tag: "istat-stale", status: "open", now: NOW });
    await inquiryOpenedStatement(testEnv.DB, { inquiryId: open.inquiry.id, openedAt: "2026-10-04T10:00:00.000Z" }).run();
    expect(await inquiriesOn(open.product!.id, "2026-10-04")).toBe(0);
    expect(await inquiriesOn(open.product!.id, "2026-10-05")).toBe(1);

    const pending = await makeInquiry({ tag: "istat-pend2", status: "pending_verification", now: NOW });
    await inquiryOpenedStatement(testEnv.DB, { inquiryId: pending.inquiry.id, openedAt: NOW }).run();
    expect(await inquiriesOn(pending.product!.id, "2026-10-05")).toBe(0);
  });
});
```

(Thêm `import { inquiryOpenedStatement } from "../../src/db/stats.ts";` ở đầu file.)

Chạy: `npm test -w apps/web -- test/db/inquiry-stats.test.ts` → FAIL (`createInquiry` chưa đếm).

- [ ] **Step 7: Nối vào `createInquiry` và `openPendingInquiry`**

`apps/web/src/db/inquiries.ts`: thêm `import { inquiryOpenedStatement } from "./stats.ts";` và sửa `createInquiry`:

```ts
export async function createInquiry(db: D1Database, input: NewInquiry): Promise<{ inquiry: Inquiry; firstMessageId: string }> {
  const { id, statements, firstMessageId } = createInquiryStatements(db, input);
  // M7: a signed-in inquiry opens here, so it counts here (spec §8.11); `createInquiryStatements` stays unchanged for M6's request flow.
  const counted = input.status === "open" && input.productId ? [inquiryOpenedStatement(db, { inquiryId: id, openedAt: input.now })] : [];
  const [rows] = await db.batch([...statements, ...counted]);
  const row = rows?.results[0] as Row | undefined;
  if (!row) throw new Error("inquiry insert failed");
  return { inquiry: toInquiry(row), firstMessageId };
}
```

(`createInquiryStatements` đã trả `id`; không đổi chữ ký.)

`apps/web/src/routes/inquiry-confirm.ts`, trong `openPendingInquiry`, thêm vào mảng `db.batch` sau câu audit, giữ nguyên chỉ số `[moved]`:

```ts
    inquiryOpenedStatement(c.env.DB, { inquiryId: inquiry.id, openedAt: iso }),
```

và `import { inquiryOpenedStatement } from "../db/stats.ts";`. Trong `test/inquiry-gate.test.ts` và `test/me/inquiries.test.ts` (cả hai đường đi qua `openPendingInquiry`) thêm ca: xác nhận inquiry pending qua đường hiện có rồi đọc `product_daily_stats.inquiries` của product = 1; xác nhận lần hai (CAS thua) vẫn là 1.

Chạy: `npm test -w apps/web -- test/db/inquiry-stats.test.ts test/db/inquiries.test.ts` + `test/inquiry-gate.test.ts test/me/inquiries.test.ts` → PASS.

- [ ] **Step 8: Test kiến trúc**

Trong `apps/web/test/architecture.test.ts` thêm vào `WRITERS`:

```ts
  product_daily_stats: "../src/db/stats.ts",
```

Chạy: `npm test -w apps/web -- test/architecture.test.ts` → PASS (câu `INSERT INTO product_daily_stats` chỉ có trong `db/stats.ts`; `db/inquiries.ts` chỉ import hàm, không viết SQL của bảng này).

- [ ] **Step 9: Kiểm tra toàn bộ, commit**

```
npm run typecheck -w apps/web
npm test
git add apps/web/migrations/0014_product_stats.sql apps/web/src/domain/stats.ts apps/web/src/db/stats.ts apps/web/src/db/inquiries.ts apps/web/src/routes/inquiry-confirm.ts apps/web/test/architecture.test.ts apps/web/wrangler.jsonc apps/web/test/domain/stats.test.ts apps/web/test/db/stats.test.ts apps/web/test/db/inquiry-stats.test.ts apps/web/test/inquiry-gate.test.ts apps/web/test/me/inquiries.test.ts
git commit -m "feat(web): product_daily_stats and inquiry counting (VNX-0701a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Bảng đúng 6 cột, không cột nhận diện, PK (product, day), xóa theo product | `npm test -w apps/web -- test/db/stats.test.ts` |
| AC2 | Cộng dồn đúng, an toàn khi song song, từ chối delta/ngày sai | cùng file |
| AC3 | Inquiry mở khi đã đăng nhập, hoặc khi xác nhận, cộng đúng một lần ở ngày UTC; pending, không product, CAS thua không cộng | `npm test -w apps/web -- test/db/inquiry-stats.test.ts` và các ca mới ở `test/inquiry-gate.test.ts`, `test/me/inquiries.test.ts` |
| AC4 | Chỉ `db/stats.ts` ghi `product_daily_stats` | `npm test -w apps/web -- test/architecture.test.ts` |
| AC5 | Không đổi hành vi sẵn có của `createInquiry`/`createInquiryStatements` (M6 `me-requests` vẫn xanh) | `npm test` toàn bộ |
| AC6 | Typecheck sạch | `npm run typecheck -w apps/web` |

Diff ước tính ~330 dòng (gồm test). Không có chuỗi giao diện, không locale.

---

### Task 2: VNX-0707a — Luật bot chung và nhận diện người xem

**Scope:** thuần domain, chưa nối vào route (Task 3, 4 nối). Làm ba việc: (1) luật bot chung `domain/bot.ts`; (2) `domain/visitor.ts` (nhận diện người xem, thuần, WebCrypto); (3) vị từ "đội nội bộ" dùng chung: `isAdminUser` (sync, `auth/admin.ts`, chính biểu thức của guard `/admin`) và `isStaff` (async, file mới `auth/staff.ts`), cùng `ANALYTICS_SALT` vào `Bindings`. Không route nào đổi hành vi; `/go/` vẫn ghi `visitor_hash: null`.

**Files:**
- Create: `apps/web/src/domain/bot.ts`, `apps/web/src/domain/visitor.ts`, `apps/web/src/auth/staff.ts`
- Modify: `apps/web/src/domain/outbound.ts` (xóa `BOT_UA`, `CfLike`, `isBotRequest`; BẮT BUỘC thêm `import type { CfLike } from "./bot.ts";` (`countryOf` còn dùng) và giữ `export { isBotRequest, type CfLike } from "./bot.ts"` để test cũ và import cũ không vỡ)
- Modify: `apps/web/src/routes/go.ts` (import `isBotRequest`, `CfLike` từ `../domain/bot.ts`)
- Modify: `apps/web/src/auth/admin.ts` (thêm `isAdminUser`, sync), `apps/web/src/auth/middleware.ts` (`requireAdmin` gọi `isAdminUser`, hành vi y hệt)
- Modify: `apps/web/src/env.ts` (`ANALYTICS_SALT?: string`), `apps/web/wrangler.jsonc` (chỉ chú thích)
- Test: Create `apps/web/test/domain/bot.test.ts`, `apps/web/test/domain/visitor.test.ts`, `apps/web/test/auth/staff.test.ts` (cho `isAdminUser` và `isStaff`); giữ nguyên `test/domain/outbound.test.ts` (khối `isBotRequest` cũ vẫn chạy qua re-export và là bằng chứng "không vỡ")

**Interfaces:**
- Consumes: `isBotRequest(userAgent, cf)`/`CfLike` hiện ở `domain/outbound.ts`; `adminEmails(env)` (`auth/admin.ts`); `SessionUser` (`auth/sessions.ts`: `id`, `email`, `locale`, `isAdmin`); `Bindings` (`env.ts`).
- Produces:
  - `domain/bot.ts`: `type CfLike`, `BOT_UA: RegExp`, `isBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean`.
  - `domain/visitor.ts`: `VISITOR_COOKIE = "__Host-vnx_vid"`, `VISITOR_ID_RE`, `visitorCookieMaxAge(now: Date): number` (= `ceil((00:00 UTC kế − now)/1000)`, luôn ≥ 1, không sàn), `usableSalt(salt: string | undefined): string | null`, `parseVisitorCookie(value: string | null | undefined): string | null`, `newVisitorId(): string`, `hasGpc(headers: { get(name: string): string | null }): boolean`, `visitorHash(salt: string | undefined, day: string, visitorId: string): Promise<string | null>`, `type CountContext`, `shouldCount(ctx: CountContext): boolean`.
  - `auth/admin.ts`: `isAdminUser(user: Pick<SessionUser, "email" | "isAdmin"> | null | undefined, env: Pick<Bindings, "ADMIN_EMAILS">): boolean` (sync; đúng biểu thức hiện tại của `requireAdmin`).
  - `auth/staff.ts`: `isStaff(env: Pick<Bindings, "DB" | "ADMIN_EMAILS">, user: Pick<SessionUser, "email" | "isAdmin"> | null | undefined): Promise<boolean>` (hiện trả `isAdminUser(user, env)`; async ngay từ bây giờ để chỗ gọi của Task 3, 4 đã `await`).
  - `Bindings.ANALYTICS_SALT?: string`.

**Quyết định kỹ thuật** (Reviewer kiểm):
1. **Hai vị từ, hai file, không ai đọc `users.is_admin` trực tiếp.** `requireAdmin` có biểu thức inline `user.isAdmin && adminEmails(env).has(user.email)`. Rút nguyên văn ra `isAdminUser` (sync, `auth/admin.ts`); `requireAdmin` gọi nó, hành vi y hệt (`test/admin/*`, `test/auth/admin-sync.test.ts` làm bằng chứng). `isStaff` ở file MỚI `auth/staff.ts`, async, hiện chỉ trả `isAdminUser(user, env)`; Task 3, 4 gọi `await isStaff(c.env, user)`. Domain KHÔNG import `auth/`: `shouldCount` nhận boolean.
   **Hợp đồng merge với Ops O1** (nhánh `feat/ops-o1` thêm `auth/ops.ts` với `resolveOpsRole(env: Pick<Bindings,"DB"|"ADMIN_EMAILS">, user): Promise<OpsRole|null>`, import `adminEmails` từ `auth/admin.ts`, không sửa `admin.ts` lẫn `middleware.ts`): khi merge O1, `isStaff` trở thành `isAdminUser(user, env) || (await resolveOpsRole(env, user)) !== null`, kèm một test rằng thành viên `ops_members` (viewer) KHÔNG được đếm. KHÔNG bao giờ nới `requireAdmin`. Controller ghi điều này vào nghĩa vụ của CURRENT-STATUS.
   **Cho Task 3, 4:** chỉ gọi `isStaff` khi có người dùng đăng nhập, và chỉ sau các kiểm tra rẻ (bot, GPC, salt).
   **Cho Task 3:** không bao giờ phát lại hay gia hạn một id hợp lệ đã gửi tới; chỉ gửi `Set-Cookie` khi KHÔNG có cookie hợp lệ.
2. **Luật bot giữ nguyên:** UA rỗng/khoảng trắng, `BOT_UA`, `cf.botManagement.verifiedBot === true`. Không dùng `botManagement.score` (không bịa ngưỡng). Chỉ chuyển chỗ; câu chú thích cũ "M7 may replace this" đổi thành "the one bot rule (spec 8.11)".
3. **`visitorHash(salt, day, visitorId)`:** `dayKey = HMAC-SHA256(key = salt, msg = day)`; `hash = hex(HMAC-SHA256(key = dayKey, msg = visitorId))`, với `day` đã ghép tiền tố như trên. `dayKey` có tách miền: thông điệp là `vnx.si/visitor/v1|${day}`. `usableSalt(salt)` trả salt khi không rỗng/không toàn khoảng trắng, ngược lại `null`; `visitorHash` và `hasSalt` ở caller đều dùng nó, nên salt trắng không bao giờ cho `shouldCount = true`. Salt thiếu (`undefined`, rỗng, toàn khoảng trắng) hoặc `visitorId` sai định dạng → `null` ("không có salt/không có id", caller bỏ qua đếm; salt rỗng sẽ làm `importKey` ném, nên chặn trước). `day` sai định dạng `YYYY-MM-DD` → ném (lỗi lập trình; caller lấy `day` từ `utcDay`).
4. **`hasGpc` nhận `headers` (có `get`)** để tránh caller phải tự đọc tên header; `Headers.get` không phân biệt hoa thường. Chỉ một thành viên đúng `1` (sau `trim`, tách theo dấu phẩy, vì nhiều header `Sec-GPC` bị gộp thành một giá trị phân tách bằng dấu phẩy; phán quyết của Controller) mới là GPC (spec GPC: giá trị `1`); `0`, `true`, rỗng, thiếu → false.
5. **`ANALYTICS_SALT` không vào `vitest.config.ts` bindings.** Test của Task 2 truyền salt tường minh; Task 3, 4 tự tiêm `{ ...testEnv, ANALYTICS_SALT: "…" }` cho từng ca để ca "thiếu salt" dùng `testEnv` nguyên bản (đúng luật "thiếu salt → không đếm"). Đặt salt toàn cục sẽ khiến mọi test hiện có chạm vào luật đếm.
6. Không có `.dev.vars.example` trong repo (`.dev.vars` bị `.gitignore`); ghi chú đặt trong `wrangler.jsonc` cạnh ghi chú `MAIL_DRIVER`, KHÔNG tạo file mới, KHÔNG đưa salt vào `vars`.
7. Cảnh báo "một lần mỗi isolate" khi thiếu salt là việc của helper route (Task 3, `http/visitor.ts`), không phải domain thuần.

- [ ] **Step 1: Test luật bot (fail)**

`apps/web/test/domain/bot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOT_UA, isBotRequest, type CfLike } from "../../src/domain/bot.ts";
import * as outbound from "../../src/domain/outbound.ts";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** The EPIC 21 rule, frozen here as the reference: Task 2 only MOVES it, so the new function must agree with it on every row. */
function legacyIsBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i.test(userAgent) || cf?.botManagement?.verifiedBot === true;
}

const UAS: (string | null | undefined)[] = [
  undefined, null, "", "   ", "\t",
  "Googlebot/2.1 (+http://www.google.com/bot.html)", "Bingbot/2.0", "AhrefsBot", "Mozilla/5.0 (compatible; Yahoo! Slurp)", "Baiduspider/2.0", "Mozilla/5.0 (compatible; Crawler/1.0)",
  "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "WhatsApp Link Preview", "UptimeMonitor/1.0",
  "curl/8.5.0", "Wget/1.21", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120.0",
  CHROME, SAFARI, "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0", "Opera/9.80", "robot-free browser without the keyword",
];
const CFS: CfLike[] = [undefined, null, {}, { botManagement: {} }, { botManagement: { verifiedBot: false } }, { botManagement: { verifiedBot: true } }, { botManagement: { verifiedBot: "true" } }, { country: "VN" }];

describe("the one bot rule (spec 8.11, Reviewer decision 6)", () => {
  it("agrees with the EPIC 21 isBotRequest on every (user agent, cf) pair of the table", () => {
    for (const ua of UAS) for (const cf of CFS) expect(isBotRequest(ua, cf), `${JSON.stringify(ua)} ${JSON.stringify(cf)}`).toBe(legacyIsBotRequest(ua, cf));
  });

  it.each([
    [undefined, undefined, true],
    ["", undefined, true],
    ["   ", undefined, true],
    ["Googlebot/2.1", undefined, true],
    ["curl/8.5.0", undefined, true],
    [CHROME, undefined, false],
    [SAFARI, null, false],
    [CHROME, { botManagement: { verifiedBot: false } }, false],
    [CHROME, { botManagement: { verifiedBot: true } }, true],
    [CHROME, { botManagement: { verifiedBot: "true" } }, false],
  ] as [string | undefined, CfLike, boolean][])("UA %j with cf %j gives %s", (ua, cf, expected) => {
    expect(isBotRequest(ua, cf)).toBe(expected);
  });

  it("does not read a bot score: a high score alone never makes a browser a bot, a low one never clears a bot UA", () => {
    expect(isBotRequest(CHROME, { botManagement: { score: 1 } } as unknown as CfLike)).toBe(false);
    expect(isBotRequest("curl/8.5.0", { botManagement: { score: 99 } } as unknown as CfLike)).toBe(true);
  });

  it("matches the keyword list of Global Constraints and no other", () => {
    expect(BOT_UA.source).toBe("bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome");
    expect(BOT_UA.flags).toBe("i");
  });

  it("domain/outbound.ts re-exports the same function (callers and old tests keep working)", () => {
    expect(outbound.isBotRequest).toBe(isBotRequest);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/bot.test.ts` → FAIL (`domain/bot.ts` không tồn tại).

- [ ] **Step 2: Luật bot (impl)**

`apps/web/src/domain/bot.ts`:

```ts
/** The one bot rule (spec 8.11) for views, clicks and de-duplication. Pure: no Hono, no D1. */

/** The two fields of `request.cf` that the rule reads. */
export type CfLike = { country?: unknown; botManagement?: { verifiedBot?: unknown } } | null | undefined;

export const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests|headlesschrome/i;

/**
 * Empty or blank User-Agent, a User-Agent matching BOT_UA, or Cloudflare's `verifiedBot`. Spec 8.11 also says "cf.botManagement if
 * present" but gives no score threshold, so the score is NOT read (no invented number). Never blocks a request: callers only skip counting.
 */
export function isBotRequest(userAgent: string | null | undefined, cf: CfLike): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA.test(userAgent) || cf?.botManagement?.verifiedBot === true;
}
```

`apps/web/src/domain/outbound.ts`: xóa dòng `export type CfLike = …`, hằng `BOT_UA` và hàm `isBotRequest` (cùng chú thích), thêm sau dòng import:

```ts
export { isBotRequest, type CfLike } from "./bot.ts";
```

`apps/web/src/routes/go.ts`: bỏ `isBotRequest` và `type CfLike` khỏi import `../domain/outbound.ts` và thêm `import { isBotRequest, type CfLike } from "../domain/bot.ts";`. (Nếu `outbound.ts` còn dùng `CfLike` cho `countryOf`, thêm `import type { CfLike } from "./bot.ts";` ở đầu file và giữ dòng re-export.)

Chạy: `npm test -w apps/web -- test/domain/bot.test.ts test/domain/outbound.test.ts test/monetization/go.test.ts` → PASS (khối `isBotRequest` cũ trong `outbound.test.ts` xanh qua re-export).

- [ ] **Step 3: Test `visitor` (fail)**

`apps/web/test/domain/visitor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VISITOR_COOKIE, VISITOR_ID_RE, hasGpc, newVisitorId, usableSalt, parseVisitorCookie, shouldCount, visitorCookieMaxAge, visitorHash } from "../../src/domain/visitor.ts";

const ID = "0123456789abcdef0123456789abcdef";
const ID2 = "fedcba9876543210fedcba9876543210";
const SALT = "test-salt-not-a-secret-0000000000";

describe("cookie name and Max-Age (Owner (b): expires at the end of the UTC day)", () => {
  it("names the cookie with the __Host- prefix", () => {
    expect(VISITOR_COOKIE).toBe("__Host-vnx_vid");
  });

  it.each([
    ["2026-10-05T00:00:00.000Z", 86_400],
    ["2026-10-05T00:00:00.001Z", 86_400],
    ["2026-10-05T12:00:00.000Z", 43_200],
    ["2026-10-05T23:00:00.000Z", 3_600],
    ["2026-10-05T23:58:00.000Z", 120],
    ["2026-10-05T23:58:59.500Z", 61],
    ["2026-10-05T23:59:00.000Z", 60],
    ["2026-10-05T23:59:30.000Z", 30],
    ["2026-10-05T23:59:59.999Z", 1],
    ["2026-12-31T23:59:59.999Z", 1],
    ["2026-12-31T12:00:00.000Z", 43_200],
    ["2028-02-28T18:00:00.000Z", 21_600],
  ])("at %s the Max-Age is %i seconds", (iso, expected) => {
    expect(visitorCookieMaxAge(new Date(iso))).toBe(expected);
  });

  it("is always between 1 second and one day (no floor: the cookie ends with the UTC day)", () => {
    for (let s = 0; s < 86_400; s += 997) {
      const age = visitorCookieMaxAge(new Date(Date.UTC(2026, 9, 5, 0, 0, 0) + s * 1000));
      expect(age).toBeGreaterThanOrEqual(1);
      expect(age).toBeLessThanOrEqual(86_400);
    }
  });
  // The Date is read with getUTC* only, so the machine time zone cannot change the result.
});

describe("parseVisitorCookie", () => {
  it("accepts exactly 32 lower-case hex characters", () => {
    expect(parseVisitorCookie(ID)).toBe(ID);
    expect(parseVisitorCookie("0".repeat(32))).toBe("0".repeat(32));
    expect(parseVisitorCookie("f".repeat(32))).toBe("f".repeat(32));
  });

  it.each([
    [undefined], [null], [""], [" "], [ID.toUpperCase()], [`${ID}0`], [ID.slice(1)], [` ${ID}`], [`${ID} `], [`${ID}\n`], [`${ID.slice(0, 31)}g`], [`${ID.slice(0, 31)}-`],
    ["a=b"], ["../../etc/passwd"], ["0x" + "a".repeat(30)], ["é".repeat(32)], ["'; DROP TABLE x;--"],
  ] as (string | null | undefined)[][])("rejects %j", (value) => {
    expect(parseVisitorCookie(value as string | null | undefined)).toBeNull();
  });
});

describe("newVisitorId", () => {
  it("always matches the cookie format and does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newVisitorId();
      expect(id).toMatch(VISITOR_ID_RE);
      expect(parseVisitorCookie(id)).toBe(id);
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });
});

describe("hasGpc (Sec-GPC: 1 is the opt-out)", () => {
  const h = (value?: string) => new Headers(value === undefined ? {} : { "Sec-GPC": value });
  it("is true only for the value 1", () => {
    expect(hasGpc(h("1"))).toBe(true);
    expect(hasGpc(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(hasGpc(new Headers([["SEC-GPC", " 1 "]]))).toBe(true);
    // Several Sec-GPC headers are folded into one comma-separated value: any member equal to 1 counts.
    expect(hasGpc(new Headers({ "Sec-GPC": "1, 1" }))).toBe(true);
    expect(hasGpc(new Headers({ "Sec-GPC": "0, 1" }))).toBe(true);
  });
  it.each([["0"], ["true"], ["yes"], ["11"], ["on"], [""]])("is false for %j", (value) => {
    expect(hasGpc(h(value))).toBe(false);
  });
  it("is false when the header is absent or only a lookalike is sent", () => {
    expect(hasGpc(h())).toBe(false);
    expect(hasGpc(new Headers({ DNT: "1" }))).toBe(false);
    expect(hasGpc(new Headers({ "Sec-GPC-Extra": "1" }))).toBe(false);
  });
});

describe("visitorHash (addendum 2.2: dayKey = HMAC(salt, day), hash = HMAC(dayKey, visitor id))", () => {
  it("is deterministic within a day: 64 hex characters", async () => {
    const a = await visitorHash(SALT, "2026-10-05", ID);
    const b = await visitorHash(SALT, "2026-10-05", ID);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toBe(a);
  });

  it("changes every day, so one cookie cannot be followed across days", async () => {
    const d1 = await visitorHash(SALT, "2026-10-05", ID);
    const d2 = await visitorHash(SALT, "2026-10-06", ID);
    const d3 = await visitorHash(SALT, "2026-11-05", ID);
    expect(new Set([d1, d2, d3]).size).toBe(3);
    // No shared prefix or suffix between days that would let two hashes be matched by eye or by LIKE.
    expect(d1!.slice(0, 8)).not.toBe(d2!.slice(0, 8));
    expect(d1!.slice(-8)).not.toBe(d2!.slice(-8));
  });

  it("differs per visitor and per salt", async () => {
    const base = await visitorHash(SALT, "2026-10-05", ID);
    expect(await visitorHash(SALT, "2026-10-05", ID2)).not.toBe(base);
    expect(await visitorHash(`${SALT}x`, "2026-10-05", ID)).not.toBe(base);
  });

  it("equals an independent HMAC-SHA256 chain (key chain order matters)", async () => {
    const enc = new TextEncoder();
    const hmac = async (key: ArrayBuffer | Uint8Array, msg: string) =>
      crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(msg));
    const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const dayKey = await hmac(enc.encode(SALT), "vnx.si/visitor/v1|2026-10-05");
    expect(await visitorHash(SALT, "2026-10-05", ID)).toBe(hex(await hmac(dayKey, ID)));
    // Swapped roles must not give the same value.
    const swapped = await hmac(enc.encode(ID), "vnx.si/visitor/v1|2026-10-05");
    expect(await visitorHash(SALT, "2026-10-05", ID)).not.toBe(hex(swapped));
  });

  it("returns null without a usable salt (the caller then skips counting)", async () => {
    for (const salt of [undefined, "", "   "]) expect(await visitorHash(salt, "2026-10-05", ID)).toBeNull();
  });

  it("returns null for an id that is not a valid cookie value", async () => {
    for (const bad of ["", ID.toUpperCase(), "short", `${ID}0`]) expect(await visitorHash(SALT, "2026-10-05", bad)).toBeNull();
  });

  it("throws on a day that is not YYYY-MM-DD (a programming error, callers use utcDay)", async () => {
    await expect(visitorHash(SALT, "2026-10-05T00:00:00Z", ID)).rejects.toThrow();
    await expect(visitorHash(SALT, "", ID)).rejects.toThrow();
  });
});

describe("usableSalt", () => {
  it("returns a real salt and null for unset, empty or blank, so a blank salt never lets shouldCount be true", () => {
    expect(usableSalt(SALT)).toBe(SALT);
    for (const salt of [undefined, "", " ", "\t\n"]) expect(usableSalt(salt)).toBeNull();
  });
});

describe("shouldCount (Global Constraints: not counted when …)", () => {
  const ok = { isBot: false, isStaff: false, isOwnBuilder: false, isGpc: false, hasSalt: true };

  it("counts an ordinary visitor with a salt", () => {
    expect(shouldCount(ok)).toBe(true);
  });

  it.each([["isBot"], ["isStaff"], ["isOwnBuilder"], ["isGpc"]] as const)("does not count when %s", (flag) => {
    expect(shouldCount({ ...ok, [flag]: true })).toBe(false);
  });

  it("does not count without a salt", () => {
    expect(shouldCount({ ...ok, hasSalt: false })).toBe(false);
  });

  it("truth table: exactly one of the 32 combinations counts", () => {
    let counted = 0;
    for (let n = 0; n < 32; n++) {
      const ctx = { isBot: !!(n & 1), isStaff: !!(n & 2), isOwnBuilder: !!(n & 4), isGpc: !!(n & 8), hasSalt: !!(n & 16) };
      const result = shouldCount(ctx);
      if (result) {
        counted++;
        expect(ctx).toEqual(ok);
      }
    }
    expect(counted).toBe(1);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/visitor.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 4: Domain `visitor` (impl)**

`apps/web/src/domain/visitor.ts`:

```ts
/**
 * Anonymous visitor identity for product statistics (addendum 2.2, spec 8.11; Owner (b) 2026-10-05). Pure: no Hono, no D1.
 * The cookie value is a random id with no link to a person. `visitorHash` mixes it with a secret that changes every UTC day, so
 * two days cannot be joined. Web Crypto only (`crypto.subtle`, `crypto.getRandomValues`).
 */

export const VISITOR_COOKIE = "__Host-vnx_vid";
export const VISITOR_ID_RE = /^[0-9a-f]{32}$/;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const encoder = new TextEncoder();
/** Domain separation for the day key. */
const DAY_KEY_PREFIX = "vnx.si/visitor/v1|";

/** Seconds until the next 00:00 UTC (86400 at exactly 00:00:00); always >= 1, so the cookie ends with the UTC day. */
export function visitorCookieMaxAge(now: Date): number {
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((nextMidnight - now.getTime()) / 1000);
}

/** The id when it has exactly the shape newVisitorId makes, else null (never trust a cookie). */
export function parseVisitorCookie(value: string | null | undefined): string | null {
  return typeof value === "string" && VISITOR_ID_RE.test(value) ? value : null;
}

/** 16 random bytes as 32 lower-case hex characters. */
export function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** True when any comma-separated member of `Sec-GPC` is `1` (Global Privacy Control; repeated headers are folded by the runtime). */
export function hasGpc(headers: { get(name: string): string | null }): boolean {
  return (headers.get("Sec-GPC") ?? "").split(",").some((v) => v.trim() === "1");
}

async function hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, encoder.encode(message));
}

/** The salt when it is set and not blank, else null. Use it for `hasSalt` too. */
export function usableSalt(salt: string | undefined): string | null {
  return typeof salt === "string" && salt.trim() !== "" ? salt : null;
}

/**
 * `hex(HMAC-SHA256(dayKey, visitorId))` with `dayKey = HMAC-SHA256(salt, "vnx.si/visitor/v1|" + day)`; `day` is the UTC date `YYYY-MM-DD` (see `utcDay`).
 * Null when there is no salt (unset, empty or blank) or the id is not a valid cookie value: the caller then does not count.
 * Throws on a malformed `day`.
 */
export async function visitorHash(salt: string | undefined, day: string, visitorId: string): Promise<string | null> {
  if (!DAY_RE.test(day)) throw new Error(`invalid day: ${day}`);
  const key = usableSalt(salt);
  if (key === null || !VISITOR_ID_RE.test(visitorId)) return null;
  const dayKey = await hmac(encoder.encode(key), DAY_KEY_PREFIX + day);
  return [...new Uint8Array(await hmac(dayKey, visitorId))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CountContext {
  isBot: boolean;
  /** Our team: the same predicate as the /admin guard (`isStaff`). */
  isStaff: boolean;
  /** The signed-in user is the builder of this product. */
  isOwnBuilder: boolean;
  /** The request carries `Sec-GPC: 1`. */
  isGpc: boolean;
  /** `usableSalt(env.ANALYTICS_SALT) !== null`. */
  hasSalt: boolean;
}

/** One rule for views and clicks: count only a real, non-opted-out visitor who is neither the product's builder nor our team, and only with a salt. */
export function shouldCount(ctx: CountContext): boolean {
  return ctx.hasSalt && !ctx.isBot && !ctx.isStaff && !ctx.isOwnBuilder && !ctx.isGpc;
}
```

Chạy: `npm test -w apps/web -- test/domain/visitor.test.ts` → PASS.

- [ ] **Step 5: Test `isAdminUser` và `isStaff` (fail)**

`apps/web/test/auth/staff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAdminUser } from "../../src/auth/admin.ts";
import { isStaff } from "../../src/auth/staff.ts";
import { testEnv } from "../helpers.ts";

const admins = { ADMIN_EMAILS: "owner@vnx.si, Second@VNX.si" };
const envWith = (ADMIN_EMAILS: string | undefined) => ({ DB: testEnv.DB, ADMIN_EMAILS });

describe("isAdminUser: exactly the /admin guard expression (requireAdmin calls it)", () => {
  it("is true for an admin user whose e-mail is in ADMIN_EMAILS", () => {
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, admins)).toBe(true);
    expect(isAdminUser({ email: "second@vnx.si", isAdmin: true }, admins)).toBe(true);
  });
  it("is false without the is_admin flag, even when the e-mail is listed", () => {
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: false }, admins)).toBe(false);
  });
  it("is false when the e-mail is no longer listed (revocation), or the list is unset or empty", () => {
    expect(isAdminUser({ email: "gone@vnx.si", isAdmin: true }, admins)).toBe(false);
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, {})).toBe(false);
    expect(isAdminUser({ email: "owner@vnx.si", isAdmin: true }, { ADMIN_EMAILS: "" })).toBe(false);
  });
  it("is false for a visitor who is not signed in", () => {
    expect(isAdminUser(null, admins)).toBe(false);
    expect(isAdminUser(undefined, admins)).toBe(false);
  });
});

describe("isStaff (async; today the same answer as isAdminUser, Ops O1 widens it at merge)", () => {
  it("is true for an admin user in ADMIN_EMAILS", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "owner@vnx.si", isAdmin: true })).toBe(true);
  });
  it("is false for a flag-less user, a revoked e-mail, an unset list or no user", async () => {
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "owner@vnx.si", isAdmin: false })).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), { email: "gone@vnx.si", isAdmin: true })).toBe(false);
    expect(await isStaff(envWith(undefined), { email: "owner@vnx.si", isAdmin: true })).toBe(false);
    expect(await isStaff(envWith(admins.ADMIN_EMAILS), null)).toBe(false);
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/staff.test.ts` → FAIL (`isAdminUser`, `auth/staff.ts` chưa có).

- [ ] **Step 6: `isAdminUser`, `isStaff`, `Bindings`, ghi chú triển khai (impl)**

`apps/web/src/auth/admin.ts` (thêm; giữ `adminEmails` nguyên):

```ts
import type { Bindings } from "../env.ts";
import type { SessionUser } from "./sessions.ts";

// … adminEmails unchanged …

/** The /admin guard predicate. ADMIN_EMAILS is the source of truth (removing an e-mail revokes access on the next request). Never widened. */
export function isAdminUser(user: Pick<SessionUser, "email" | "isAdmin"> | null | undefined, env: Pick<Bindings, "ADMIN_EMAILS">): boolean {
  return !!user && user.isAdmin && adminEmails(env).has(user.email);
}
```

`apps/web/src/auth/staff.ts` (mới):

```ts
import type { Bindings } from "../env.ts";
import { isAdminUser } from "./admin.ts";
import type { SessionUser } from "./sessions.ts";

/**
 * "Our team" for product statistics: such visitors are never counted. Async so call sites already await it. Today it equals the /admin
 * guard. At the Ops O1 merge it becomes `isAdminUser(user, env) || (await resolveOpsRole(env, user)) !== null`, with a test that an
 * `ops_members` viewer is not counted. Do not widen `requireAdmin`. Call it only for a signed-in user and after the cheap checks (bot, GPC, salt).
 */
export async function isStaff(env: Pick<Bindings, "DB" | "ADMIN_EMAILS">, user: Pick<SessionUser, "email" | "isAdmin"> | null | undefined): Promise<boolean> {
  return isAdminUser(user, env);
}
```

`apps/web/src/auth/middleware.ts` `requireAdmin`: đổi điều kiện thành `if (!isAdminUser(user, c.env)) return errorResponse(c, "forbidden", 403);` (giữ chú thích; import `isAdminUser` thay `adminEmails` nếu `adminEmails` không còn dùng ở file này).

`apps/web/src/env.ts`, trong `Bindings` sau `TURNSTILE_DRIVER`:

```ts
  /** Secret for the daily visitor hash (VNX-0707a). Unset: no views or clicks are counted and no visitor cookie is set. `wrangler secret put ANALYTICS_SALT`; `.dev.vars` locally; never in the repo. */
  ANALYTICS_SALT?: string;
```

`apps/web/wrangler.jsonc`: thay dòng `// Secrets (wrangler secret put …): TURNSTILE_SECRET, RESEND_API_KEY, ADMIN_EMAILS.` bằng `… TURNSTILE_SECRET, RESEND_API_KEY, ADMIN_EMAILS, ANALYTICS_SALT.`; thêm sau dòng `MAIL_DRIVER` cuối file:

```jsonc
  // ANALYTICS_SALT (M7): `wrangler secret put ANALYTICS_SALT` with a random value of 32+ characters (e.g. `openssl rand -hex 32`). Local dev:
  // add ANALYTICS_SALT=<any random string> to apps/web/.dev.vars (git-ignored). Never put it in "vars". While it is unset the Worker counts
  // no views or clicks and sets no visitor cookie. Rotating it only restarts de-duplication for that day.
```

Chạy: `npm test -w apps/web -- test/auth test/admin test/domain test/architecture.test.ts` → PASS (`requireAdmin` không đổi hành vi).

- [ ] **Step 7: Kiểm tra cuối, commit**

```
npm run typecheck -w apps/web
npm test
grep -n "ANALYTICS_SALT" apps/web/wrangler.jsonc
git add apps/web/src/domain/bot.ts apps/web/src/domain/visitor.ts apps/web/src/domain/outbound.ts apps/web/src/routes/go.ts apps/web/src/auth/admin.ts apps/web/src/auth/staff.ts apps/web/src/auth/middleware.ts apps/web/src/env.ts apps/web/wrangler.jsonc apps/web/test/domain/bot.test.ts apps/web/test/domain/visitor.test.ts apps/web/test/auth/staff.test.ts
git commit -m "feat(web): shared bot rule, visitor hash and staff predicate (VNX-0707a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Kết quả `grep` phải chỉ là dòng chú thích (bắt đầu bằng `//`), không có `ANALYTICS_SALT` trong khối `"vars"`.

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Luật bot cùng kết quả với `isBotRequest` cũ trên bảng UA x `cf`; không đọc điểm bot; `outbound.ts` re-export cùng hàm | `npm test -w apps/web -- test/domain/bot.test.ts` |
| AC2 | Test `isBotRequest` cũ và `/go/` (EPIC 21) vẫn xanh, không sửa | `npm test -w apps/web -- test/domain/outbound.test.ts test/monetization/go.test.ts` |
| AC3 | `Max-Age` đúng biên 00:00 UTC (86400, giữa ngày, 30 s, 1 s ở 23:59:59.999, cuối năm; không sàn) | `npm test -w apps/web -- test/domain/visitor.test.ts` |
| AC4 | `parseVisitorCookie`, `newVisitorId` (1000 lần không trùng), `hasGpc` (`1`, `0`, `true`, rỗng, thiếu, không phân biệt hoa thường tên header) | cùng file |
| AC5 | `usableSalt`; `visitorHash` (tiền tố `vnx.si/visitor/v1|`): xác định trong ngày, khác giữa các ngày/visitor/salt, khớp chuỗi HMAC độc lập, `null` khi thiếu salt hoặc id sai, ném khi `day` sai | cùng file |
| AC6 | `shouldCount`: đúng 1 trong 32 tổ hợp được đếm | cùng file |
| AC7 | `isAdminUser` là biểu thức guard `/admin`, `isStaff` (async) hiện trùng nó; `requireAdmin` không đổi hành vi | `npm test -w apps/web -- test/auth test/admin` |
| AC8 | `domain/` không import Hono/db; mọi bảng vẫn có đúng một writer | `npm test -w apps/web -- test/architecture.test.ts` |
| AC9 | `ANALYTICS_SALT` có trong `Bindings`, chỉ nằm trong chú thích `wrangler.jsonc`, không có file bí mật nào trong diff | `grep -n "ANALYTICS_SALT" apps/web/wrangler.jsonc apps/web/src/env.ts` và `git diff --stat` |
| AC10 | Typecheck sạch, toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

Diff ước tính ~430 dòng (gồm test; code sản xuất ~110). Không có chuỗi giao diện, không locale. Không đụng migration.

---

### Task 3c: VNX-0701c — Thông báo thay đổi Privacy cho người dùng đã đăng nhập

**Scope (chặn bởi (b), M7 Review Focus 4, 7, 8):** Thêm một thông báo SSR trong `Layout` cho mọi response được render qua `views/render.ts#page` mà `Layout` có `signedIn` (trang public khi signed-in, `/hub`, `/me`, `/admin`). `/ops` (Ops O1 `OpsLayout`, trên `origin/main`, không dùng `Layout`) nằm ngoài phạm vi: đây là lựa chọn kỹ thuật. Thông báo chỉ tồn tại trong cửa sổ UTC đã chốt, có link `/privacy` theo locale, đóng được bằng `<details>` native cộng một cờ `localStorage` thuần chức năng. Không thêm migration, cột D1, cookie mới, tracking, IP/email/user id, legal copy, hay inline script/style. Cả bốn locale dưới đây là câu chữ Owner đã duyệt nguyên văn (zh được duyệt 2026-10-06).

**Cách truyền dữ liệu (thay thế prop theo route/view):** `page()` là điểm render duy nhất (`c.html(` chỉ xuất hiện trong `render.ts`). `page()` bọc node vào một `hono/jsx` context mang `{ goLive, now }`; `Layout` đọc context đó. Không có prop `privacyNotice`, không sửa route hay view nào, không sửa `HubLayout`/`AdminLayout`.

**Files:**

- Create: `apps/web/src/domain/privacy-notice.ts`; `apps/web/src/views/privacy-notice.tsx` (`.tsx` vì có JSX; chứa context, `PrivacyNotice`, hằng script); `apps/web/public/assets/privacy-notice.js`; `apps/web/test/domain/privacy-notice.test.ts`; `apps/web/test/design/privacy-notice.test.ts`.
- Modify: `apps/web/src/env.ts` (`Bindings.PRIVACY_NOTICE_GO_LIVE?: string`); `apps/web/wrangler.jsonc` (thêm var `PRIVACY_NOTICE_GO_LIVE: ""`, giữ nguyên `triggers` của Task 6); `apps/web/src/views/render.ts`; `apps/web/src/views/Layout.tsx`; `apps/web/public/assets/app.css`; `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (ba key `privacyNotice.*`; `test/i18n/parity.test.ts` chạy lại, không sửa); `apps/web/test/design/assets.test.ts`; `apps/web/test/design/layout.test.ts`; `apps/web/test/architecture.test.ts`.
- Không đụng: route, view khác, `HubLayout`, `AdminLayout`, `src/legal/content.ts`, `docs/legal/privacy.md`, migration, `src/db`, `src/jobs`.

**Interfaces (đã đối chiếu code thật):** `Translate` (`src/i18n/t.ts`, `ReturnType<typeof translator>`), `Locale` và `localizedPath(locale, path)` (`src/i18n/locales.ts`), `createContext`/`useContext`/`Child`/`FC` (xuất từ `hono/jsx`; `Context.Provider` có sẵn), `page(c, node, status)` (`views/render.ts`, chữ ký giữ nguyên), `LayoutProps.signedIn?: boolean` (cổng hiện có).

- `Bindings.PRIVACY_NOTICE_GO_LIVE?: string`: biến non-secret, trong `vars` của `wrangler.jsonc` giá trị mặc định `""` (ẩn thông báo). Ngày production được COMMIT vào đúng chỗ này (xem "Ghi chú deploy cho Owner"); không dùng `wrangler secret`, `--var` hay dashboard.
- `src/domain/privacy-notice.ts` (không import Hono/D1/env; chỉ `type Locale`):

  ```ts
  export function parsePrivacyNoticeDate(raw: string | undefined): Date | null;
  export function shouldShowPrivacyNotice(goLive: string | undefined, now: Date): boolean;
  export function formatPrivacyNoticeDate(goLive: string | undefined, locale: Locale): string | null;
  ```

- `src/views/privacy-notice.tsx` produces `PrivacyNoticeRequest`, `withPrivacyNoticeRequest`, `privacyNoticeDate`, `PRIVACY_NOTICE_SCRIPT`, `PrivacyNotice` (mã đầy đủ ở Step 4).
- i18n dùng đúng ba key `privacyNotice.message`, `privacyNotice.readChanges`, `privacyNotice.dismiss`; mọi chữ hiển thị (kể cả nút đóng) qua `tr()`.
- Asset `/assets/privacy-notice.js`: chỉ được nạp khi SSR đã render thông báo, `defer`, same-origin, không import, không fetch/XHR/beacon, không inline code. `app.css` giữ toàn bộ style.

**Quyết định kỹ thuật (Reviewer kiểm):**

1. **Binding và dữ liệu không hợp lệ.** `PRIVACY_NOTICE_GO_LIVE` tùy chọn, đúng `YYYY-MM-DD`, không tự trim. `parsePrivacyNoticeDate` từ chối unset, rỗng, có giờ/offset, không phải chữ số, ngày không tồn tại (round-trip UTC phải trả đúng chuỗi gốc). Malformed hoặc unset: không có markup lẫn script.
2. **Cửa sổ UTC, biên rõ ràng.** Ngày go-live hiểu là `00:00:00.000Z`. Khoảng nửa mở `[goLive − 14 ngày, goLive + 31 ngày)`: ngày go-live và ngày thứ +30 (đến `23:59:59.999Z`) còn hiện, đúng `+31 ngày` thì ẩn. `now` không hữu hạn thì ẩn.
3. **Domain thuần.** Không Hono, D1, binding, đồng hồ toàn cục, DOM hay storage. `formatPrivacyNoticeDate` dùng `Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })`.
4. **Dữ liệu request tới `Layout` qua `hono/jsx` context đặt trong `page()`.** `page()` `await node` trước, rồi bọc `withPrivacyNoticeRequest({ goLive: c.env.PRIVACY_NOTICE_GO_LIVE, now: new Date() }, resolved)`. `now` lấy một lần mỗi request. Context mặc định là `null`: `Layout` render ngoài `page()` (test đơn vị, đường đi tương lai) không bao giờ hiện thông báo. Phương án không chọn: (a) `contextStorage()` cần `node:async_hooks`, trong khi pool test ghim `compatibilityDate` 2026-08-01, trước khi `nodejs_compat` bật mặc định; (c) HTML rewriting vì mong manh. Không cần ADR: dùng API có sẵn của stack đã khóa, không thêm dependency hay flag.
5. **Cổng hiển thị = `signedIn` hiện có.** `Layout` tính `noticeDate = privacyNoticeDate(locale, isSignedIn)`; `null` thì không có markup, không có script. Thông báo là con đầu tiên của `<main>`. Khi `fullWidth` (landing, `main.page-full { padding: 0 }`) thông báo được bọc `<div class="container">` để có lề ngang 24px; `main.container` vốn đã có padding nên không bọc, tránh double padding.
6. **Chữ và link.** Câu EN/VI là đúng chuỗi đã duyệt; `{date}` là ngày go-live định dạng theo locale; link chỉ dùng `localizedPath(locale, "/privacy")`.
7. **Đóng thông báo không cần cookie mới.** `<details class="privacy-notice" open>` với `<summary>` là nút đóng. Khi đóng, CSS `.privacy-notice:not([open]) { display: none; }` ẩn cả khối (không để lại chữ "Dismiss" lẻ loi). Có JS: đóng lưu `localStorage` key `vnxsi:privacy-notice-dismissed:v1` = `1`; trang sau script đóng thông báo nếu cờ tồn tại. Không có JS: đóng native chỉ có hiệu lực trên trang đó. Cả hai lời gọi storage nằm trong `try/catch`. Không có cookie nên không đổi Privacy §5. Quyết định của Owner 2026-10-06: cờ localStorage này KHÔNG cần thêm câu nào vào Privacy §5.
8. **CSP.** Không có `<script>`/`<style>` inline mới; script là file tĩnh same-origin, CSS ở `app.css`. SSR không đọc được localStorage nên người đã đóng có thể nhận HTML thông báo thêm một lần rồi script đóng lại (ranh giới SSR/client có chủ đích).
9. **Không tác dụng phụ pháp lý/dữ liệu.** Thông báo mô tả cookie người xem mà Task 3 sẽ làm; Task 3 giữ cookie, dedupe và thay đổi legal. Task 3c không cookie, không event, không ghi DB, không migration.
10. **Script trang.** `pageScripts` = `scripts` đã khử trùng cộng `PRIVACY_NOTICE_SCRIPT` chỉ khi `noticeDate !== null`. Landing vẫn có `landing.js` đúng một lần.
11. **Rủi ro đã chặn.** Một `c.html(` ngoài `render.ts` sẽ âm thầm làm mất thông báo; test kiến trúc ở Step 1 khóa việc này.

**Approved copy (chép đúng; cả 4 locale đã duyệt):**

| key | en — **APPROVED VERBATIM** | vi — **ĐÃ DUYỆT NGUYÊN VĂN** | zh-Hans — **ĐÃ DUYỆT NGUYÊN VĂN (Owner 2026-10-06)** | zh-Hant — **ĐÃ DUYỆT NGUYÊN VĂN (Owner 2026-10-06)** |
|---|---|---|---|---|
| `privacyNotice.message` | `We are updating our Privacy Policy: from {date} we count visits to product pages using a cookie that expires at the end of each day.` | `Chúng tôi cập nhật Chính sách quyền riêng tư: từ {date}, chúng tôi đếm lượt truy cập trang product bằng một cookie hết hạn vào cuối mỗi ngày.` | `我们正在更新隐私政策：从 {date} 起，我们会使用一个在每天结束时到期的 Cookie 来统计产品页面访问量。` | `我們正在更新隱私權政策：自 {date} 起，我們會使用一個在每天結束時到期的 Cookie 來統計產品頁面瀏覽次數。` |
| `privacyNotice.readChanges` | `Read the changes.` | `Xem thay đổi.` | `查看更改。` | `查看變更。` |
| `privacyNotice.dismiss` | `Dismiss` | `Đóng` | `关闭` | `關閉` |

Owner 2026-10-06: ba key zh-Hans và zh-Hant được duyệt nguyên văn đúng như bảng.

**Mã tĩnh (chép nguyên):**

`apps/web/public/assets/privacy-notice.js`:

```js
(() => {
  const KEY = "vnxsi:privacy-notice-dismissed:v1";
  const read = () => {
    try {
      return window.localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  };
  const remember = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Storage denied: the native <details> close still works for this page.
    }
  };
  document.querySelectorAll('details[data-privacy-notice="true"]').forEach((notice) => {
    if (read()) notice.open = false;
    notice.addEventListener("toggle", () => {
      if (!notice.open) remember();
    });
  });
})();
```

`apps/web/public/assets/app.css` (thêm, không animation mới):

```css
.privacy-notice { position: relative; margin: 0 0 24px; padding: 16px 96px 16px 18px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
.privacy-notice:not([open]) { display: none; }
.privacy-notice p { margin: 0; }
.privacy-notice-close { position: absolute; top: 8px; right: 10px; min-height: 44px; padding: 8px; color: var(--primary); cursor: pointer; font-weight: 600; }
.privacy-notice-close:hover { color: var(--primary-hover); }
.privacy-notice-close:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.page-full > .container > .privacy-notice { margin-top: 16px; }
```

**TDD steps:**

- [ ] **Step 1: Test domain và khóa kiến trúc (RED).** Tạo `apps/web/test/domain/privacy-notice.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { formatPrivacyNoticeDate, parsePrivacyNoticeDate, shouldShowPrivacyNotice } from "../../src/domain/privacy-notice.ts";

  const LIVE = "2026-10-20";
  const at = (iso: string) => new Date(iso);

  describe("parsePrivacyNoticeDate", () => {
    it.each([undefined, "", "2026-10-20T00:00:00Z", "2026-02-29", "2026-04-31", "20-10-2026"])("rejects %j", (raw) => {
      expect(parsePrivacyNoticeDate(raw)).toBeNull();
    });
    it("round-trips a valid ISO calendar date at UTC midnight", () => {
      expect(parsePrivacyNoticeDate(LIVE)?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    });
  });

  describe("shouldShowPrivacyNotice", () => {
    it.each([
      ["before start", "2026-10-05T23:59:59.999Z", false],
      ["start inclusive", "2026-10-06T00:00:00.000Z", true],
      ["go-live midnight", "2026-10-20T00:00:00.000Z", true],
      ["last visible instant", "2026-11-19T23:59:59.999Z", true],
      ["after end", "2026-11-20T00:00:00.000Z", false],
    ] as const)("%s", (_label, iso, expected) => expect(shouldShowPrivacyNotice(LIVE, at(iso))).toBe(expected));
    it("hides unset, malformed and invalid now", () => {
      expect(shouldShowPrivacyNotice(undefined, at("2026-10-20T00:00:00Z"))).toBe(false);
      expect(shouldShowPrivacyNotice("2026-02-30", at("2026-10-20T00:00:00Z"))).toBe(false);
      expect(shouldShowPrivacyNotice(LIVE, new Date(Number.NaN))).toBe(false);
    });
  });

  describe("formatPrivacyNoticeDate", () => {
    it("pins EN exactly", () => expect(formatPrivacyNoticeDate(LIVE, "en")).toBe("October 20, 2026"));
    it.each(["vi", "zh-Hans", "zh-Hant"] as const)("%s keeps the UTC day and is not the raw ISO string", (locale) => {
      const out = formatPrivacyNoticeDate(LIVE, locale) ?? "";
      expect(out).toContain("2026");
      expect(out).toContain("20");
      expect(out).not.toBe(LIVE);
    });
    it("is null for a malformed date", () => expect(formatPrivacyNoticeDate("2026-02-30", "en")).toBeNull());
  });
  ```

  Thêm vào `apps/web/test/architecture.test.ts`, sau khai báo `const sources = import.meta.glob("../src/**/*.{ts,tsx}", ...)` đã có (cùng kiểu quét nguồn `?raw`):

  ```ts
  describe("single render choke point (VNX-0701c)", () => {
    it("only views/render.ts calls c.html( — a direct call would silently drop the privacy notice", () => {
      for (const [file, src] of Object.entries(sources)) {
        if (file === "../src/views/render.ts") continue;
        expect(src, file).not.toMatch(/\bc\.html\(/);
      }
    });
  });
  ```

  Chạy `npm test -w apps/web -- test/domain/privacy-notice.test.ts test/architecture.test.ts` → domain RED (module chưa có); khối kiến trúc xanh ngay (khóa trạng thái hiện có; đã kiểm: chỉ `render.ts:8` có `c.html(`).

- [ ] **Step 2: Domain module (GREEN).** Tạo `apps/web/src/domain/privacy-notice.ts`:

  ```ts
  import type { Locale } from "../i18n/locales.ts";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  export function parsePrivacyNoticeDate(raw: string | undefined): Date | null {
    if (!raw || !DATE.test(raw)) return null;
    const time = Date.parse(`${raw}T00:00:00.000Z`);
    if (!Number.isFinite(time)) return null;
    const date = new Date(time);
    return date.toISOString().slice(0, 10) === raw ? date : null;
  }

  export function shouldShowPrivacyNotice(goLive: string | undefined, now: Date): boolean {
    const date = parsePrivacyNoticeDate(goLive);
    const at = now.getTime();
    if (!date || !Number.isFinite(at)) return false;
    return at >= date.getTime() - 14 * DAY_MS && at < date.getTime() + 31 * DAY_MS;
  }

  export function formatPrivacyNoticeDate(goLive: string | undefined, locale: Locale): string | null {
    const date = parsePrivacyNoticeDate(goLive);
    return date
      ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date)
      : null;
  }
  ```

  Chạy lệnh Step 1 → GREEN.

- [ ] **Step 3: Test SSR (RED).** Tạo `apps/web/test/design/privacy-notice.test.ts`. Đồng hồ chỉ fake `Date` (`toFake: ["Date"]`) để không làm treo timer của workerd/D1:

  ```ts
  import { jsx } from "hono/jsx";
  import { afterEach, describe, expect, it, vi } from "vitest";
  import { createApp } from "../../src/app.ts";
  import type { Bindings } from "../../src/env.ts";
  import { localizedPath } from "../../src/i18n/locales.ts";
  import { Layout } from "../../src/views/Layout.tsx";
  import { withPrivacyNoticeRequest } from "../../src/views/privacy-notice.tsx";
  import { makeBuilder, signIn } from "../fixtures.ts";
  import { getReq, testEnv } from "../helpers.ts";

  const app = createApp();
  const LIVE_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
  const get = (path: string, cookie?: string, env: Bindings = LIVE_ENV) => app.request(getReq(path, cookie), undefined, env);
  const page = async (path: string, cookie?: string, env: Bindings = LIVE_ENV) => (await get(path, cookie, env)).text();
  const NOTICE = 'data-privacy-notice="true"';
  const NOTICE_SCRIPT = '<script src="/assets/privacy-notice.js" defer=""></script>'; // hono renders boolean attributes as defer="" (re-review M1)
  const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
  const freeze = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };

  afterEach(() => vi.useRealTimers());

  describe("SSR visibility", () => {
    it("shows the notice only for signed-in pages in the inclusive window", async () => {
      freeze("2026-10-20T00:00:00Z");
      const { cookie } = await signIn("privacy-notice-layout@vnx.si");
      const signedOut = await page("/products");
      const signedIn = await page("/vi/products", cookie);
      expect(signedOut).not.toContain(NOTICE);
      expect(signedOut).not.toContain("privacy-notice.js");
      expect(signedIn).toContain(NOTICE);
      expect(signedIn).toContain(`href="${localizedPath("vi", "/privacy")}"`);
      expect(count(signedIn, NOTICE_SCRIPT)).toBe(1);
    });

    it.each(["2026-10-05T23:59:59.999Z", "2026-11-20T00:00:00Z"])("hides outside the window at %s", async (iso) => {
      freeze(iso);
      const { cookie } = await signIn(`privacy-notice-edge-${iso.replace(/\D/g, "")}@vnx.si`);
      const html = await page("/products", cookie);
      expect(html).not.toContain(NOTICE);
      expect(html).not.toContain("privacy-notice.js");
    });

    it("covers /me, /hub, /admin through the one choke point and hides for unset/malformed bindings", async () => {
      freeze("2026-10-20T00:00:00Z");
      await makeBuilder("privacy-notice-builder@vnx.si", "privacy-notice-builder");
      const { cookie } = await signIn("privacy-notice-builder@vnx.si");
      const { cookie: adminCookie } = await signIn("privacy-notice-admin@vnx.si", { admin: true });
      expect(await page("/me", cookie)).toContain(NOTICE);
      expect(await page("/hub", cookie)).toContain(NOTICE);
      expect(await page("/admin/builders", adminCookie)).toContain(NOTICE);
      const bad = { ...LIVE_ENV, PRIVACY_NOTICE_GO_LIVE: "2026-02-30" } as Bindings;
      expect(await page("/products", cookie, bad)).not.toContain(NOTICE);
      expect(await page("/products", cookie, { ...LIVE_ENV, PRIVACY_NOTICE_GO_LIVE: undefined } as Bindings)).not.toContain(NOTICE);
    });

    it("landing keeps landing.js once, adds the notice script once, and wraps the notice in .container", async () => {
      freeze("2026-10-20T00:00:00Z");
      const { cookie } = await signIn("privacy-notice-landing@vnx.si");
      const html = await page("/", cookie);
      expect(count(html, '<script src="/assets/landing.js" defer=""></script>')).toBe(1);
      expect(count(html, NOTICE_SCRIPT)).toBe(1);
      expect(html).toMatch(/<main id="main" class="page-full"><div class="container"><details class="privacy-notice"/);
    });

    it("keeps the SSR notice open, first in <main>, with a native close and a locale link", async () => {
      freeze("2026-10-20T00:00:00Z");
      const { cookie } = await signIn("privacy-notice-no-js@vnx.si");
      const html = await page("/products", cookie);
      expect(html).toMatch(/<main id="main" class="container"><details class="privacy-notice"[^>]*\bopen\b/);
      expect(html).toContain("privacy-notice-close");
      expect(html).toContain(localizedPath("en", "/privacy"));
    });
  });

  describe("request context default", () => {
    const props = { locale: "en", title: "t", origin: "https://vnx.si", rest: "/", signedIn: true, children: null } as const;

    it("a Layout rendered outside page() never shows the notice, even inside the window", () => {
      freeze("2026-10-20T00:00:00Z");
      expect(String(jsx(Layout, props))).not.toContain("data-privacy-notice");
    });

    it("the same Layout does show it once the request context is provided (the gate is the context)", () => {
      const html = String(withPrivacyNoticeRequest({ goLive: "2026-10-20", now: new Date("2026-10-20T00:00:00Z") }, jsx(Layout, props)));
      expect(html).toContain(NOTICE);
    });
  });
  ```

  Chạy `npm test -w apps/web -- test/design/privacy-notice.test.ts` → RED (module `views/privacy-notice.tsx` chưa có).

- [ ] **Step 4: Binding, context, `page()`, `Layout` (GREEN).**

  `apps/web/src/env.ts`: thêm `PRIVACY_NOTICE_GO_LIVE?: string;` vào `Bindings`. `apps/web/wrangler.jsonc`: thêm vào `vars` (sau `TURNSTILE_SITE_KEY`, nhớ dấu phẩy):

  ```jsonc
  // Privacy notice go-live (YYYY-MM-DD, UTC). Empty hides the notice. The production date is committed here in a chore: commit before the VNX-0701c deploy; never via --var or the dashboard.
  "PRIVACY_NOTICE_GO_LIVE": ""
  ```

  Tạo `apps/web/src/views/privacy-notice.tsx`:

  ```tsx
  import { createContext, useContext, type Child, type FC } from "hono/jsx";
  import { localizedPath, type Locale } from "../i18n/locales.ts";
  import type { Translate } from "../i18n/t.ts";
  import { formatPrivacyNoticeDate, shouldShowPrivacyNotice } from "../domain/privacy-notice.ts";

  export type PrivacyNoticeRequest = { goLive: string | undefined; now: Date };

  /** Default null: a Layout rendered outside page() (unit tests, any future path) never shows the notice. */
  const PrivacyNoticeRequestContext = createContext<PrivacyNoticeRequest | null>(null);

  export function withPrivacyNoticeRequest(value: PrivacyNoticeRequest, node: Child) {
    return <PrivacyNoticeRequestContext.Provider value={value}>{node}</PrivacyNoticeRequestContext.Provider>;
  }

  /** The localized go-live date when the notice must render, else null. Call during render (reads the context). */
  export function privacyNoticeDate(locale: Locale, signedIn: boolean): string | null {
    const req = useContext(PrivacyNoticeRequestContext);
    if (!signedIn || !req || !shouldShowPrivacyNotice(req.goLive, req.now)) return null;
    return formatPrivacyNoticeDate(req.goLive, locale);
  }

  export const PRIVACY_NOTICE_SCRIPT = "/assets/privacy-notice.js";

  export const PrivacyNotice: FC<{ locale: Locale; date: string; tr: Translate }> = ({ locale, date, tr }) => (
    <details class="privacy-notice" data-privacy-notice="true" open>
      <summary class="privacy-notice-close">{tr("privacyNotice.dismiss")}</summary>
      <p>
        {tr("privacyNotice.message", { date })}{" "}
        <a href={localizedPath(locale, "/privacy")}>{tr("privacyNotice.readChanges")}</a>
      </p>
    </details>
  );
  ```

  `apps/web/src/views/render.ts` (chữ ký giữ nguyên):

  ```ts
  import type { Context } from "hono";
  import type { Child } from "hono/jsx";
  import type { ContentfulStatusCode } from "hono/utils/http-status";
  import type { AppEnv } from "../env.ts";
  import { withPrivacyNoticeRequest } from "./privacy-notice.tsx";

  /** Renders a JSX page with a doctype. The single render choke point: it also hands Layout the request's privacy-notice data. */
  export async function page(c: Context<AppEnv>, node: unknown, status: ContentfulStatusCode = 200): Promise<Response> {
    const resolved = await node;
    const html = String(withPrivacyNoticeRequest({ goLive: c.env.PRIVACY_NOTICE_GO_LIVE, now: new Date() }, resolved as Child));
    return c.html("<!DOCTYPE html>" + html, status);
  }
  ```

  `apps/web/src/views/Layout.tsx`: import `{ PRIVACY_NOTICE_SCRIPT, PrivacyNotice, privacyNoticeDate } from "./privacy-notice.tsx"`; không đổi `LayoutProps`. Sau `const isSignedIn = signedIn === true;` thêm:

  ```tsx
  const noticeDate = privacyNoticeDate(locale, isSignedIn);
  const pageScripts = [...new Set([...(scripts ?? []), ...(noticeDate !== null ? [PRIVACY_NOTICE_SCRIPT] : [])])];
  const notice = noticeDate !== null ? <PrivacyNotice locale={locale} date={noticeDate} tr={tr} /> : null;
  ```

  Trong `<head>` thay `(scripts ?? []).map(...)` bằng `pageScripts.map((src) => (<script src={src} defer></script>))`; trong `<main>`:

  ```tsx
  <main id="main" class={fullWidth ? "page-full" : "container"}>
    {notice !== null && fullWidth ? <div class="container">{notice}</div> : notice}
    {children}
  </main>
  ```

  Chạy `npm test -w apps/web -- test/design/privacy-notice.test.ts test/design/layout.test.ts`: vẫn RED cho tới Step 6 (re-review L2): thiếu key locale thì `t()` gọi `.replace` trên `undefined` → trang trong cửa sổ trả 500 và typecheck báo `MessageKey` lạ; chỉ test default-null và test guard `c.html(` có thể xanh ở bước này. Nếu `jsx(Layout, props)` báo lỗi kiểu, ép `props as never`; không đổi `Layout`.

- [ ] **Step 5: Test locale, asset, layout (RED).** `test/design/assets.test.ts`: `/assets/privacy-notice.js` trả 200, ≤ 2048 byte, không chứa `import`, `require`, `fetch`, `XMLHttpRequest`, `sendBeacon`, `http://`, `https://`, `document.cookie`; chứa đúng key `vnxsi:privacy-notice-dismissed:v1`; có ít nhất hai `try {` và hai `catch` (cả `getItem` và `setItem` được bọc); `app.css` chứa `.privacy-notice:not([open])` với `display: none`. Cùng việc kiểm tra bằng mắt rằng hai lời gọi storage nằm trong `try/catch`, đây là cách kiểm nhánh localStorage bị chặn (không có integration test trình duyệt). `test/design/layout.test.ts`: với mỗi `LOCALES`, trang signed-in trong cửa sổ có link `localizedPath(locale, "/privacy")` bên trong `<details class="privacy-notice"`, và chữ EN/VI khớp chuỗi đã duyệt với `{date}` thay bằng ngày định dạng. Chạy:

  ```
  npm test -w apps/web -- test/i18n/parity.test.ts test/design/assets.test.ts test/design/layout.test.ts
  ```

  Expected RED: thiếu key locale, asset và CSS.

- [ ] **Step 6: Locale, asset, CSS (GREEN).** Thêm đúng giá trị bảng trên vào bốn file messages (giữ parity key và tham số `{date}`); tạo `public/assets/privacy-notice.js` và thêm khối CSS ở trên vào `app.css`. Chạy lệnh Step 5 rồi `npm test -w apps/web -- test/design/privacy-notice.test.ts` → GREEN.

- [ ] **Step 7: Hồi quy biên và kiểm tra bằng mắt.** Chạy `npm test -w apps/web -- test/domain/privacy-notice.test.ts test/design/privacy-notice.test.ts test/design/layout.test.ts test/design/assets.test.ts test/i18n/parity.test.ts test/architecture.test.ts` → GREEN. Kiểm bằng mắt: `src/domain/privacy-notice.ts` không import Hono/D1; `Layout` không có script/style inline; `privacy-notice.js` gọi `getItem` và `setItem` đều trong `try/catch` (đường localStorage bị chặn được kiểm bằng cách này cộng các khẳng định nội dung ở `assets.test.ts`); `git status` chỉ có các file trong danh sách Files.

- [ ] **Step 8: Typecheck, test đầy đủ, commit.** Từ thư mục gốc repo:

  ```
  npm run typecheck -w apps/web
  npm test
  git add apps/web/src/domain/privacy-notice.ts apps/web/src/views/privacy-notice.tsx apps/web/src/views/render.ts apps/web/src/views/Layout.tsx apps/web/src/env.ts apps/web/wrangler.jsonc apps/web/public/assets/privacy-notice.js apps/web/public/assets/app.css apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/domain/privacy-notice.test.ts apps/web/test/design/privacy-notice.test.ts apps/web/test/design/layout.test.ts apps/web/test/design/assets.test.ts apps/web/test/architecture.test.ts
  git commit -m "feat(web): notify signed-in users of the Privacy change (VNX-0701c)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  Commit không chứa `.ai/tasks/*-report.md`. Diff ước tính ~300-350 dòng, không kể locale (ba key × bốn file).

**Ghi chú deploy cho Owner:** ngày production nằm trong `apps/web/wrangler.jsonc` `vars.PRIVACY_NOTICE_GO_LIVE`, được commit bằng một commit `chore:` riêng trước lần deploy 3c. Không đặt qua `--var` hay dashboard vì một lần deploy thường sau đó sẽ đặt lại thành `""`. (1) Mọi lần deploy cho đến go-live + 31 ngày đều mang giá trị này. (2) Nếu Task 3 trễ, cập nhật ngày và deploy lại trước ngày cũ, vì thông báo nêu ngày đó. (3) `ANALYTICS_SALT` được đặt ở production đúng vào ngày go-live này. Deploy 3c ít nhất 14 ngày UTC trước ngày go-live.

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `PRIVACY_NOTICE_GO_LIVE` tùy chọn trong `Bindings`, non-secret trong `wrangler.jsonc`; unset/rỗng/malformed/ngày không tồn tại thì ẩn cả thông báo lẫn script | `npm test -w apps/web -- test/domain/privacy-notice.test.ts test/design/privacy-notice.test.ts`; `grep -n "PRIVACY_NOTICE_GO_LIVE" apps/web/src/env.ts apps/web/wrangler.jsonc` |
| AC2 | Cửa sổ UTC: đầu bao gồm, ngày go-live có, ngày +30 có, đúng +31 ẩn; đủ các ca trước/đầu/go-live/cuối/sau | `npm test -w apps/web -- test/domain/privacy-notice.test.ts` |
| AC3 | Ngày định dạng bằng `Intl.DateTimeFormat` UTC (EN đúng `October 20, 2026`); ba key có cùng tham số `{date}` ở bốn locale | `npm test -w apps/web -- test/domain/privacy-notice.test.ts test/i18n/parity.test.ts` |
| AC4 | HTML signed-out không có thông báo; signed-in public, `/me`, `/hub`, `/admin` (mọi trang qua `page()` có `Layout` signed-in) có thông báo chỉ trong cửa sổ; landing có `landing.js` và script thông báo mỗi cái đúng một lần | `npm test -w apps/web -- test/design/privacy-notice.test.ts test/design/layout.test.ts` |
| AC5 | Link "Read the changes" có tiền tố locale; EN/VI đúng văn bản đã duyệt | `npm test -w apps/web -- test/design/privacy-notice.test.ts test/design/layout.test.ts` |
| AC6 | Đóng chỉ bằng `<details>` native và `localStorage` key `vnxsi:privacy-notice-dismissed:v1`; không cookie, cột DB, tracking, `Set-Cookie` | `npm test -w apps/web -- test/design/assets.test.ts`; `grep -nE "Set-Cookie\|document\.cookie\|fetch\(\|sendBeacon" apps/web/public/assets/privacy-notice.js apps/web/src/views/privacy-notice.tsx` (không khớp) |
| AC7 | Không JS: thông báo SSR mở, link Privacy dùng được, đóng native ẩn cả khối (`.privacy-notice:not([open]) { display: none; }`, không còn "Dismiss" lẻ). Storage bị chặn: kiểm bằng mắt hai lời gọi storage trong `try/catch` cộng khẳng định nội dung ở `assets.test.ts` (không có integration test) | `npm test -w apps/web -- test/design/privacy-notice.test.ts test/design/assets.test.ts`; kiểm bằng mắt `privacy-notice.js` |
| AC8 | JS mới same-origin, `defer` chỉ khi cần, không import/network/inline, sống chung với `landing.js` | `npm test -w apps/web -- test/design/assets.test.ts test/design/layout.test.ts test/design/privacy-notice.test.ts` |
| AC9 | `Layout` render ngoài `page()` không bao giờ hiện thông báo; chỉ `render.ts` gọi `c.html(`; domain không import Hono/D1; không legal/DB mới | `npm test -w apps/web -- test/design/privacy-notice.test.ts test/architecture.test.ts` và `git diff --name-only -- docs/legal/privacy.md apps/web/src/legal/content.ts apps/web/migrations` (rỗng) |
| AC10 | Typecheck sạch, toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |
| AC11 | Diff trong ngân sách và không có chữ đánh dấu dành riêng | sau `git add` ở Step 8: `git diff --cached --stat` (~300-350 dòng không kể locale); `grep -nE "[T][O][D][O]\|[T][B][D]\|[P][L][A][C][E][H][O][L][D][E][R]" apps/web/src/domain/privacy-notice.ts apps/web/src/views/privacy-notice.tsx apps/web/public/assets/privacy-notice.js apps/web/test/domain/privacy-notice.test.ts apps/web/test/design/privacy-notice.test.ts` (không khớp) |

**Câu hỏi mở cho Owner:** không còn. Quyết định Owner 2026-10-06: (1) copy zh-Hans/zh-Hant đã duyệt nguyên văn; (2) cờ localStorage `vnxsi:privacy-notice-dismissed:v1` không cần wording Privacy §5.

**Quyết định kỹ thuật cần Reviewer kiểm:** dữ liệu request tới `Layout` qua `hono/jsx` context trong `page()` (mặc định null); `page()` `await node` rồi mới bọc (một node đã stringify trước đó sẽ không thấy context, hiện không route nào làm vậy); biên nửa mở `+31`; `.privacy-notice:not([open])` ẩn cả khối; bọc `.container` khi `fullWidth`; `/ops` ngoài phạm vi; ngày production commit trong `wrangler.jsonc`; Task 3 giữ cookie và legal.

---

### Task 3p: VNX-0701b — Privacy theo phiên bản (câu chữ (b), cổng `PRIVACY_NOTICE_GO_LIVE`)

**Thứ tự: Task 3p chạy TRƯỚC Task 3** (chính sách có trước khi bật đếm). Hai task tách để mỗi commit xanh và ≲ 600 dòng không kể văn bản pháp lý. Task 3p độc lập với việc đếm: không cookie, không migration, không `db/`.

**Scope (Review Focus 8; Owner 2026-10-06 phương án (i) và (C)).** Trang `/privacy` có HAI phiên bản; phiên bản chọn theo `PRIVACY_NOTICE_GO_LIVE` (biến của Task 3c).
- `docs/legal/privacy.md` và `LEGAL_UPDATED_AT = "2026-10-05"` giữ NGUYÊN: đó vẫn là văn bản đang chạy cho tới khi cửa sổ thông báo mở, và là ngày của Terms và Disclosure.
- Thêm `docs/legal/privacy-m7.md` (toàn văn EN và VI mới = văn bản cũ + các dòng Owner đã duyệt) và `privacyEnM7`, `privacyViM7` trong `src/legal/content.ts`.
- `privacyVersion(goLive, now)` (hàm thuần, thêm vào `domain/privacy-notice.ts` của 3c) trả `"m7"` từ ĐẦU cửa sổ thông báo (`goLive − 14 ngày UTC`, tính cả mốc đó) và mãi mãi sau đó; trước mốc, hoặc khi biến rỗng/sai dạng, trả `"current"`.
- `routes/legal.tsx` và `LegalPage` nhận bộ văn bản và ngày cập nhật đã chọn. Khi phiên bản mới hiện, ngày của Privacy là ngày go-live (dùng lại nhãn có sẵn `legal.updated` = "Last updated", KHÔNG thêm nhãn mới); Terms và Disclosure vẫn hiện `LEGAL_UPDATED_AT`.

**Ngoại lệ tài liệu pháp lý (Controller cấp cho TASK NÀY).** Implementer được tạo `docs/legal/privacy-m7.md` bằng cách chép CHỈ phần thân EN và VI mà plan cho nguyên văn bên dưới (copy hai mục `## EN`, `## VI` của `privacy.md` rồi áp đúng danh sách sửa). Phần đầu tệp ("Trạng thái", "Đối chiếu code M7") do Reviewer thêm sau. `privacy.md` KHÔNG được sửa. Hai tệp `privacy-m7.md` và `content.ts` đổi trong CÙNG commit.

**Files:**
- Create: `docs/legal/privacy-m7.md`; `apps/web/test/legal/privacy-version.test.ts`
- Modify: `apps/web/src/domain/privacy-notice.ts` (`privacyVersion`); `apps/web/src/legal/content.ts` (`privacyEnM7`, `privacyViM7`, `PRIVACY_M7`); `apps/web/src/routes/legal.tsx`; `apps/web/src/views/LegalPage.tsx`; `apps/web/wrangler.jsonc` (chỉ chú thích `PRIVACY_NOTICE_GO_LIVE`); `apps/web/test/legal/content.test.ts`; `apps/web/test/domain/privacy-notice.test.ts`
- Không đổi: `docs/legal/privacy.md`, `LEGAL_UPDATED_AT`, 4 file i18n, `Layout`, `render.ts`.

**Interfaces:**
- Consumes: `parsePrivacyNoticeDate` (`domain/privacy-notice.ts`, 3c); `LEGAL`, `LEGAL_UPDATED_AT`, `LegalDoc` (`legal/content.ts`); `LegalPage` props (`locale, origin, signedIn, id, extras`); `c.env.PRIVACY_NOTICE_GO_LIVE`.
- Produces: `type PrivacyVersion = "current" | "m7"`; `privacyVersion(goLive: string | undefined, now: Date): PrivacyVersion`; `PRIVACY_M7: { en: LegalDoc; vi: LegalDoc }`; `LegalPage` props thêm `docs?: { en: LegalDoc; vi: LegalDoc }` và `updatedAt?: string`.

**Quyết định kỹ thuật** (Reviewer kiểm):
1. **Mốc bắt đầu = mốc bắt đầu cửa sổ thông báo** (`goLive − 14 ngày`, nửa mở bên trái đóng), cùng công thức `shouldShowPrivacyNotice`; mốc kết thúc không có: `privacyVersion` không bao giờ quay về `"current"` sau go-live. Vì vậy `PRIVACY_NOTICE_GO_LIVE` KHÔNG BAO GIỜ được xóa sau go-live (nó chọn phiên bản Privacy VÀ bật đếm ở Task 3). Một task dọn dẹp sau này gấp phiên bản cũ vào `privacy.md`.
2. **Route tự lấy `now = new Date()`** (không dùng context của `page()`; `LegalPage` chỉ nhận kết quả). Privacy là trang public, không cache riêng người dùng.
3. **Ngày hiện trên trang** là chuỗi ISO `YYYY-MM-DD` của go-live (cùng dạng `LEGAL_UPDATED_AT`), qua nhãn sẵn `legal.updated`. Hệ quả cần Owner biết (không phải câu hỏi mới): trong khoảng từ đầu cửa sổ tới ngày go-live, nhãn "Last updated" của Privacy hiện một ngày TƯƠNG LAI (ngày hiệu lực). Không thêm nhãn "Effective" vì không có chuỗi giao diện được duyệt.
4. **Hai bản văn song song, không dẫn xuất.** `privacyEnM7`/`privacyViM7` là bản sao của `privacyEn`/`privacyVi` đã áp danh sách sửa (nhân đôi có chủ ý để xóa bản cũ về sau chỉ là xóa một hằng). zh-Hans/zh-Hant tiếp tục hiện văn bản EN của phiên bản được chọn.
5. **Con trỏ trong dòng "Visit counting" (Owner C)** đã được sửa so với câu duyệt gốc: "the random code above" → "the random code described in section 5 (Cookies)"; "mã ngẫu nhiên nói trên" → "mã ngẫu nhiên nêu ở mục 5 (Cookie)". Mọi dòng khác nguyên văn như đã duyệt.

- [ ] **Step 1: `privacyVersion` (RED → GREEN).** Trong `apps/web/test/domain/privacy-notice.test.ts` thêm `privacyVersion` vào import và khối:

  ```ts
  describe("privacyVersion", () => {
    it.each([
      ["before the window", "2026-10-05T23:59:59.999Z", "current"],
      ["start of the window (go-live - 14 days), inclusive", "2026-10-06T00:00:00.000Z", "m7"],
      ["go-live", "2026-10-20T00:00:00.000Z", "m7"],
      ["long after the notice window ends", "2027-03-01T00:00:00.000Z", "m7"],
    ] as const)("%s", (_label, iso, expected) => expect(privacyVersion(LIVE, at(iso))).toBe(expected));
    it("is current for an unset, empty or malformed go-live and for an invalid now", () => {
      for (const bad of [undefined, "", "2026-02-30", "20-10-2026", "2026-10-20T00:00:00Z"]) expect(privacyVersion(bad, at("2026-10-20T00:00:00Z"))).toBe("current");
      expect(privacyVersion(LIVE, new Date(Number.NaN))).toBe("current");
    });
    it("starts exactly when the notice starts", () => {
      for (const iso of ["2026-10-05T23:59:59.999Z", "2026-10-06T00:00:00.000Z"]) expect(privacyVersion(LIVE, at(iso)) === "m7").toBe(shouldShowPrivacyNotice(LIVE, at(iso)));
    });
  });
  ```

  `npm test -w apps/web -- test/domain/privacy-notice.test.ts` → FAIL. Thêm vào `apps/web/src/domain/privacy-notice.ts`:

  ```ts
  export type PrivacyVersion = "current" | "m7";

  /** `"m7"` from the start of the notice window (go-live - 14 UTC days, inclusive) for ever after; `"current"` before it, or for an unset or malformed value. Never go back: the value is not cleared after go-live. */
  export function privacyVersion(goLive: string | undefined, now: Date): PrivacyVersion {
    const date = parsePrivacyNoticeDate(goLive);
    const at = now.getTime();
    if (!date || !Number.isFinite(at)) return "current";
    return at >= date.getTime() - 14 * DAY_MS ? "m7" : "current";
  }
  ```

  Chạy lại → PASS.

- [ ] **Step 2: Test trang và so khớp từng dòng (RED).**

  Sửa `apps/web/test/legal/content.test.ts`: (a) `import type { Bindings } from "../../src/env.ts";`; (b) `expectedLines(part: string, date: string = LEGAL_UPDATED_AT)` và `.replace("{date}", date)` thay `.replace("{date}", LEGAL_UPDATED_AT)`; (c) `const get = (path: string, env: Bindings = testEnv) => createApp().request(new Request(\`https://vnx.si${path}\`), undefined, env);`; (d) trước `CASES`:

  ```ts
  // privacy-m7.md is what /privacy shows once the notice window has opened (go-live minus 14 days = 2026-10-06; the real clock is past it).
  const M7_GO_LIVE = "2026-10-20"; // pinned, same as privacy-version.test.ts; the real clock is already past 2026-10-06, so the M7 text shows
  const M7_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: M7_GO_LIVE } as Bindings;
  ```

  (e) mỗi phần tử `CASES` thêm `env: testEnv, date: LEGAL_UPDATED_AT`, và thêm `{ name: "privacy-m7", path: "/privacy", min: 11, env: M7_ENV, date: M7_GO_LIVE }`; (g) ca "leaves out the notes for the Owner and the draft header": bọc vòng trong thêm lượt chạy với `M7_ENV` (`for (const env of [testEnv, M7_ENV])`, `get(prefix + path, env)`) cho `/privacy` và `/vi/privacy`; (f) trong vòng `for (const { name, path, min } of CASES)` đổi thành `{ name, path, min, env, date }`, dùng `expectedLines(partOf(sourceOf(name), lang), date)` và `get(prefix + path, env)`.

  Tạo `apps/web/test/legal/privacy-version.test.ts`:

  ```ts
  import { afterEach, describe, expect, it, vi } from "vitest";
  import { createApp } from "../../src/app.ts";
  import { LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
  import type { Bindings } from "../../src/env.ts";
  import { testEnv } from "../helpers.ts";

  const GO_LIVE = "2026-10-20";
  const ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: GO_LIVE } as Bindings;
  const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = async (path: string, env: Bindings = ENV) =>
    decode(/<main[^>]*>([\s\S]*)<\/main>/.exec(await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, env)).text())?.[1] ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  const freeze = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };
  const OLD_EN = "for now we do not link it to any visitor identifier";
  const OLD_VI = "hiện chưa gắn nó với bất kỳ mã nhận diện người xem nào";

  afterEach(() => vi.useRealTimers());

  describe("/privacy version (Owner 2026-10-06 (i); Review Focus 8)", { timeout: 30_000 }, () => {
    it("before the notice window: the old text and the old date", async () => {
      freeze("2026-10-05T23:59:59.999Z");
      const en = await text("/privacy");
      expect(en).toContain(OLD_EN);
      expect(en).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
      expect(en).not.toContain("Visit counting");
      expect(en).not.toContain("__Host-vnx_vid");
      expect(await text("/vi/privacy")).toContain(OLD_VI);
    });

    it("from the first instant of the window: the new text with the go-live date, in EN, VI and the EN-only locales", async () => {
      freeze("2026-10-06T00:00:00.000Z");
      const en = await text("/privacy");
      for (const must of ["Visit counting", "__Host-vnx_vid", "Daily de-duplication records: deleted after 2 days.", "the random code described in section 5 (Cookies)", `Last updated: ${GO_LIVE}`]) expect(en, must).toContain(must);
      for (const gone of [OLD_EN, "the random code above", "We use only cookies that the site needs to work:"]) expect(en, gone).not.toContain(gone);
      const vi_ = await text("/vi/privacy");
      for (const must of ["Đếm lượt truy cập", "__Host-vnx_vid", "Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày.", "mã ngẫu nhiên nêu ở mục 5 (Cookie)", GO_LIVE]) expect(vi_, must).toContain(must);
      expect(vi_).not.toContain(OLD_VI);
      for (const path of ["/zh-hans/privacy", "/zh-hant/privacy"]) expect(await text(path), path).toContain("Visit counting");
    });

    it("stays on the new text long after go-live (the value is never cleared)", async () => {
      freeze("2027-06-01T00:00:00.000Z");
      expect(await text("/privacy")).toContain("Visit counting");
    });

    it("an unset, empty or malformed PRIVACY_NOTICE_GO_LIVE (and testEnv) keeps the old text", async () => {
      freeze("2026-10-20T00:00:00.000Z");
      for (const value of [undefined, "", "2026-02-30", "soon"]) {
        const out = await text("/privacy", { ...testEnv, PRIVACY_NOTICE_GO_LIVE: value } as Bindings);
        expect(out, String(value)).toContain(OLD_EN);
        expect(out, String(value)).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
      }
      expect(await text("/privacy", testEnv)).toContain(OLD_EN);
    });

    it("Terms and Disclosure keep LEGAL_UPDATED_AT while the new Privacy shows", async () => {
      freeze("2026-10-20T00:00:00.000Z");
      for (const path of ["/terms", "/disclosure", "/vi/terms"]) expect(await text(path), path).toContain(LEGAL_UPDATED_AT);
      expect(LEGAL_UPDATED_AT).toBe("2026-10-05");
    });

    it("docs/legal/privacy.md is the live text and still has the old sentence; privacy-m7.md has the new one and not the old", () => {
      const file = (name: string) => Object.entries(SOURCES).find(([f]) => f.endsWith(`/docs/legal/${name}.md`))?.[1] ?? "";
      expect(file("privacy")).toContain(OLD_EN);
      expect(file("privacy")).not.toContain("Visit counting");
      expect(file("privacy-m7")).toContain("Visit counting");
      expect(file("privacy-m7")).not.toContain(OLD_EN);
      expect(file("privacy-m7")).not.toContain(OLD_VI);
    });
  });
  ```

  `npm test -w apps/web -- test/legal` → FAIL (chưa có tệp m7, route, phiên bản).

- [ ] **Step 3: Văn bản, route, view (GREEN).**

  *`docs/legal/privacy-m7.md`:* tạo với đúng khung sau, trong đó phần thân EN và VI là bản chép NGUYÊN VĂN hai mục `## EN` và `## VI` hiện có của `docs/legal/privacy.md` (từ `### Privacy Policy` / `### Chính sách quyền riêng tư` tới trước `---`) rồi áp danh sách sửa dưới đây:

  ```
  # Privacy Policy — phiên bản M7 (câu chữ Owner đã duyệt 2026-10-05, câu hỏi (b) B1; con trỏ "Visit counting" sửa theo Owner 2026-10-06)

  Hiện thay cho `privacy.md` từ đầu cửa sổ thông báo (`PRIVACY_NOTICE_GO_LIVE` − 14 ngày UTC). Phần đầu tệp (Trạng thái, Đối chiếu code) do Reviewer thêm sau.

  ---

  ## EN

  (thân EN)

  ---

  ## VI

  (thân VI)
  ```

  *Danh sách sửa EN (chỉ các dòng này khác `privacy.md`):*

  - Mục 2, dòng "Outbound clicks" thành dòng dưới, rồi THÊM dòng "Visit counting" ngay sau nó:

    ```
    - **Outbound clicks:** when you follow a button or link that goes to another company's website through our `/go/` address, we record the time, which link it was, which kind of page it was on, the language of the page you were on, your country (detected by our hosting provider), the website you came from (domain only) and whether the visit looks like an automated bot. We record the click even when the link carries no tracking code. We do not store your IP address, your email address or your account with that record. The record may hold the day-specific code described under "Visit counting", which cannot be matched across days.
    - **Visit counting:** when you open a product page, we store the random code described in section 5 (Cookies) in a cookie. We combine it with a secret that changes every day, so each product page, and each of its demo or website links, is counted at most once per visitor per day, and the result cannot be matched from one day to the next. We do not count visits that look like automated bots, visits by the product's own builder, or visits by our team. If your browser blocks the cookie, the page works the same, but each visit may be counted.
    ```

  - Mục 3: THÊM sau dòng "To count how often links to other companies are followed …":

    ```
    - To count visits to product pages and clicks on a product's demo and website links, so that we can show public statistics (for example which products are trending).
    ```

  - Mục 3, đoạn "We rely on your consent …": giữ câu hiện có, NỐI vào cuối đoạn (cùng đoạn, cách một dấu cách):

    ```
    For counting visits we rely on our legitimate interest in measuring how the site is used. You can object at any time by turning on the Global Privacy Control signal in your browser: we then set no cookie and count nothing.
    ```

  - Mục 5:

    ```
    We use only cookies that the site needs to work, and one cookie to count visits.
    - `__Host-vnx_session`: keeps you signed in, for up to 30 days.
    - `__Host-vnx_invite`: remembers a builder invite link for 1 hour.
    - `__Host-vnx_vid`: a random code, not linked to your name, e-mail address or account, used only to count visits to product pages. It expires at the end of the current day (UTC). We do not set it if your browser sends the Global Privacy Control signal (`Sec-GPC: 1`).
    ```

  - Mục 6: THÊM ngay dưới "Outbound click records: deleted after 13 months.":

    ```
    - Daily de-duplication records: deleted after 2 days.
    ```

  *Danh sách sửa VI:*

  - Mục 2, dòng "Lượt bấm link ra ngoài" thành dòng dưới, rồi THÊM dòng "Đếm lượt truy cập" ngay sau nó:

    ```
    - **Lượt bấm link ra ngoài:** khi bạn bấm một nút hoặc link dẫn tới website của công ty khác qua địa chỉ `/go/` của chúng tôi, chúng tôi ghi lại thời điểm, đó là link nào, nằm trên loại trang nào, ngôn ngữ của trang bạn đang xem, quốc gia của bạn (do nhà cung cấp hosting nhận diện), trang web bạn đến từ đó (chỉ tên miền) và việc lượt truy cập có giống bot tự động không. Chúng tôi ghi lượt bấm cả khi link không mang mã theo dõi nào. Chúng tôi không lưu địa chỉ IP, email hay tài khoản của bạn cùng bản ghi đó. Bản ghi có thể chứa mã theo ngày nêu ở "Đếm lượt truy cập", mã này không thể đối chiếu giữa các ngày.
    - **Đếm lượt truy cập:** khi bạn mở trang một product, chúng tôi lưu mã ngẫu nhiên nêu ở mục 5 (Cookie) trong cookie. Chúng tôi kết hợp mã đó với một khóa bí mật đổi mỗi ngày, nên mỗi trang product, và mỗi link demo hay website của nó, được đếm tối đa một lần cho mỗi người mỗi ngày, và kết quả không thể đối chiếu từ ngày này sang ngày khác. Chúng tôi không đếm lượt truy cập giống bot tự động, lượt của chính builder của product, hay của đội ngũ chúng tôi. Nếu trình duyệt chặn cookie, trang vẫn hoạt động như cũ, nhưng mỗi lượt truy cập có thể bị đếm.
    ```

  - Mục 3: THÊM sau dòng "Đếm số lần các link tới công ty khác được bấm …":

    ```
    - Đếm lượt truy cập trang product và lượt bấm link demo, website của product, để hiện thống kê công khai (ví dụ product nào đang trending).
    ```

  - Mục 3, đoạn "Căn cứ của chúng tôi …": NỐI vào cuối đoạn:

    ```
    Với việc đếm lượt truy cập, chúng tôi dựa trên lợi ích chính đáng trong việc đo lường cách trang được sử dụng. Bạn có thể phản đối bất cứ lúc nào bằng cách bật tín hiệu Global Privacy Control trong trình duyệt: khi đó chúng tôi không đặt cookie và không đếm gì.
    ```

  - Mục 5:

    ```
    Chúng tôi chỉ dùng cookie cần thiết để trang hoạt động, và một cookie để đếm lượt truy cập.
    - `__Host-vnx_session`: giữ bạn đăng nhập, tối đa 30 ngày.
    - `__Host-vnx_invite`: ghi nhớ link mời builder trong 1 giờ.
    - `__Host-vnx_vid`: một mã ngẫu nhiên, không gắn với tên, email hay tài khoản của bạn, chỉ dùng để đếm lượt truy cập trang product. Cookie hết hạn vào cuối ngày hiện tại (UTC). Chúng tôi không đặt cookie này nếu trình duyệt của bạn gửi tín hiệu Global Privacy Control (`Sec-GPC: 1`).
    ```

  - Mục 6: THÊM ngay dưới "Bản ghi lượt bấm link ra ngoài: xóa sau 13 tháng.":

    ```
    - Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày.
    ```

  *`apps/web/src/legal/content.ts`:* sao chép hằng `privacyEn` thành `const privacyEnM7: LegalDoc` và `privacyVi` thành `privacyViM7` (ngay sau chúng), áp CÙNG danh sách sửa (EN: mục 2 `ul` hai chuỗi, mục 3 `ul` một chuỗi và đoạn `p`, mục 5 `p` và `ul`, mục 6 `ul`; VI tương ứng; chuỗi TS bỏ tiền tố `- `, dấu `"` thành `\"`), rồi thêm sau `LEGAL`: `export const PRIVACY_M7: { en: LegalDoc; vi: LegalDoc } = { en: privacyEnM7, vi: privacyViM7 };`. Không đổi `LEGAL`, `LEGAL_UPDATED_AT`, `privacyEn`, `privacyVi`.

  *`apps/web/src/views/LegalPage.tsx`:* import `type LegalDoc`; `Props` thêm `docs?: { en: LegalDoc; vi: LegalDoc }; updatedAt?: string;`; trong thân: `const source = docs ?? page;` `const doc = locale === "vi" ? source.vi : source.en;` và `tr("legal.updated", { date: updatedAt ?? LEGAL_UPDATED_AT })`.

  *`apps/web/src/routes/legal.tsx`:* import `privacyVersion` (`../domain/privacy-notice.ts`) và `PRIVACY_M7`; trong handler:

  ```tsx
  const goLive = c.env.PRIVACY_NOTICE_GO_LIVE;
  const m7 = id === "privacy" && privacyVersion(goLive, new Date()) === "m7";
  return page(c, <LegalPage locale={locale} origin={siteOrigin(c)} signedIn={c.get("user") !== null} id={id} extras={extras} docs={m7 ? PRIVACY_M7 : undefined} updatedAt={m7 ? goLive : undefined} />);
  ```

  *`apps/web/wrangler.jsonc`:* thay chú thích ngay trên `PRIVACY_NOTICE_GO_LIVE` bằng: "Privacy go-live (YYYY-MM-DD, UTC). Empty = the old Privacy text, no notice, and (Task VNX-0701b) no view counting. From go-live minus 14 days /privacy shows the M7 text and the notice appears; counting starts at go-live 00:00 UTC. NEVER clear it after go-live: it selects the Privacy version and enables counting. The production date is committed here in a chore: commit before the VNX-0701c deploy; never via --var or the dashboard."

  Chạy `npm test -w apps/web -- test/legal test/domain/privacy-notice.test.ts test/design` → PASS.

- [ ] **Step 4: Typecheck, test đầy đủ, commit.**

  ```
  npm run typecheck -w apps/web
  npm test
  git add docs/legal/privacy-m7.md apps/web/src/domain/privacy-notice.ts apps/web/src/legal/content.ts apps/web/src/routes/legal.tsx apps/web/src/views/LegalPage.tsx apps/web/wrangler.jsonc apps/web/test/legal/content.test.ts apps/web/test/legal/privacy-version.test.ts apps/web/test/domain/privacy-notice.test.ts
  git commit -m "feat(web): versioned Privacy text gated on PRIVACY_NOTICE_GO_LIVE (VNX-0701b)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  Diff ước tính ~200 dòng mã và test, cộng bản văn pháp lý (excluded).

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| P1 | `privacy.md` và `LEGAL_UPDATED_AT` không đổi; `git diff` rỗng cho chúng | `git diff --name-only -- docs/legal/privacy.md`; `grep -n 'LEGAL_UPDATED_AT = "2026-10-05"' apps/web/src/legal/content.ts` |
| P2 | Trước đầu cửa sổ, hoặc biến rỗng/sai dạng/`testEnv`: văn bản cũ và ngày cũ; từ đầu cửa sổ (kể cả sau go-live rất lâu): văn bản mới và ngày go-live; Terms và Disclosure giữ ngày cũ | `npm test -w apps/web -- test/legal/privacy-version.test.ts test/domain/privacy-notice.test.ts` |
| P3 | `privacy-m7.md` so từng dòng với `/privacy` EN và VI; câu cũ "for now we do not link it…" biến mất khỏi bản mới; con trỏ mục 5 đã sửa | `npm test -w apps/web -- test/legal` ; `grep -n "random code above\|nói trên" docs/legal/privacy-m7.md` (không khớp) |
| P4 | Một commit chứa cả `privacy-m7.md` và `content.ts` | `git diff --cached --name-only` ở Step 4 |
| P5 | Typecheck sạch, toàn bộ test xanh | `npm run typecheck -w apps/web`; `npm test` |

**Câu hỏi mở cho Owner:** không. (Nhãn ngày dùng lại "Last updated"; Privacy hiện ngày go-live tương lai trong khoảng 14 ngày trước go-live: ghi nhận ở quyết định 3.)

---

### Task 3: VNX-0701b — Cookie người xem và đếm lượt xem

**Điều kiện đầu vào:** Task 1, 2, 4, 5, 6, 3c và 3p đã commit (thứ tự thực thi 1 → 2 → 5 → 4 → 6 → 3c → 3p → 3).

**Scope (Review Focus 1, 2; Owner (b) B1; (f) F1).** `GET /p/:slug` (và bốn tiền tố locale) đếm `views` mỗi trình duyệt một lần mỗi product mỗi ngày UTC và là NƠI DUY NHẤT đặt cookie `__Host-vnx_vid`. Gồm: migration `0015_view_dedupe`; `recordProductView` và `purgeViewDedupe` trong `db/stats.ts`; bước `view_dedupe` trong `STEPS` của `jobs/daily.ts`; `http/visitor.ts` mở rộng (`decideViewVisit`, `setVisitorCookie`); `http/defer.ts`; nối vào `routes/product-page.tsx`; **cổng đếm `isCountingLive`** (chỉ đếm khi `PRIVACY_NOTICE_GO_LIVE` hợp lệ và `now ≥ go-live 00:00Z`). Privacy (văn bản) đã xong ở Task 3p; Task này không đụng `docs/legal/*` hay `content.ts`. Không có chuỗi giao diện mới.

**Files:**
- Create: `apps/web/migrations/0015_view_dedupe.sql`; `apps/web/src/http/defer.ts`; `apps/web/test/db/view-dedupe.test.ts`; `apps/web/test/product-page-views.test.ts`
- Modify: `apps/web/src/domain/privacy-notice.ts` (`isCountingLive`); `apps/web/src/db/stats.ts` (`recordProductView`, `purgeViewDedupe`); `apps/web/src/jobs/daily.ts` (bước `view_dedupe`); `apps/web/src/http/visitor.ts` (mở rộng file Task 4); `apps/web/src/routes/go.ts` (bỏ hàm `defer` cục bộ và import từ `http/defer.ts`; thêm cổng `isCountingLive` vào `trackProductClick`, xem Step 4); `apps/web/src/routes/product-page.tsx`; `apps/web/wrangler.jsonc` (chú thích ANALYTICS_SALT và danh sách migration); `apps/web/test/architecture.test.ts`; `apps/web/test/domain/privacy-notice.test.ts`; `apps/web/test/jobs/daily.test.ts`; `apps/web/test/monetization/go-product.test.ts` (chỉ `ENV` thêm `PRIVACY_NOTICE_GO_LIVE: "2026-01-01"`, vì click giờ cũng qua cổng)
- Không đổi: `domain/visitor.ts`, `domain/bot.ts`, `domain/stats.ts`, `auth/staff.ts` (chỉ GỌI `isStaff`), `db/clicks.ts`, `db/products.ts`, `views/ProductPage.tsx`, `docs/legal/*`, `src/legal/content.ts`, 4 file i18n, `src/index.ts`.
- Ngoài phạm vi: click (Task 4), số liệu đọc (Task 5/6), commit `chore:` đặt `PRIVACY_NOTICE_GO_LIVE`, `/admin`, `/ops`, `/hub`, `/me`.

**Interfaces:**
- Consumes (tên thật): `findPublicProductBySlug`, `onLocalized`, `page`; `VISITOR_COOKIE`, `newVisitorId`, `hasGpc`, `usableSalt`, `visitorHash`, `visitorCookieMaxAge`, `shouldCount` (`domain/visitor.ts`); `isBotRequest`, `CfLike` (`domain/bot.ts`); `isStaff(env, user)`; `readVisitorCookie`, `warnNoSaltOnce`, `resetNoSaltWarning` (`http/visitor.ts`); `parsePrivacyNoticeDate` (`domain/privacy-notice.ts`); `utcDay` (`domain/stats.ts`); `c.get("user")`; `makeLiveProduct`, `makeBuilder`, `makeDraft`, `signIn`, `setCookieValue`.
- Produces:
  - `domain/privacy-notice.ts`: `isCountingLive(goLive: string | undefined, now: Date): boolean`.
  - `db/stats.ts`: `recordProductView(db, { productId; visitorHash; now: Date }): Promise<boolean>`; `purgeViewDedupe(db, now: Date): Promise<number>`.
  - `http/defer.ts`: `defer(c, work): Promise<void>`.
  - `http/visitor.ts`: `type ViewVisit`; `decideViewVisit(c, builderId: string, now: Date): Promise<ViewVisit>`; `setVisitorCookie(c, visitorId, now): void`.

**Quyết định kỹ thuật** (Reviewer kiểm):
1. **Cổng đếm đứng ĐẦU `decideViewVisit`.** `isCountingLive(c.env.PRIVACY_NOTICE_GO_LIVE, now)` sai (biến rỗng, sai dạng, hoặc `now` trước 00:00Z ngày go-live) → `{ count: false }`: không cookie, không đếm, và KHÔNG cảnh báo thiếu salt (cổng đóng là trạng thái bình thường). Lý do: câu Privacy mô tả cookie hiện từ `goLive − 14 ngày`, nhưng cookie và đếm chỉ bắt đầu đúng ngày go-live (người đã đăng nhập được báo trước, đúng mục 10 của Privacy). Click `/go/p/` (Task 4) CŨNG qua cổng: trong `routes/go.ts` `trackProductClick` chỉ tính `visitor_hash` khi `isCountingLive(env.PRIVACY_NOTICE_GO_LIVE, t.now)` đúng; nếu không thì `visitor_hash = null` và không cộng gì (dòng `outbound_clicks` vẫn ghi). Lý do: một cookie có sẵn (hoặc do người dùng tự gửi) cùng salt đã đặt trước go-live không được làm click có hash hay được đếm.
2. **Một `db.batch` hai câu, đúng thứ tự, không dùng `changes()`.** Câu 1 cộng `views` bằng `INSERT … SELECT … WHERE NOT EXISTS (dòng dedupe) ON CONFLICT DO UPDATE`; câu 2 là `INSERT INTO product_view_dedupe … ON CONFLICT (day, visitor_hash, product_id) DO NOTHING RETURNING 1`. `db.batch` chạy tuần tự trong một giao dịch nên câu 1 đọc trạng thái TRƯỚC câu 2. Lượt đầu: câu 1 cộng, câu 2 chèn (`RETURNING` ra một dòng). Lượt lặp: câu 1 không cộng, câu 2 không làm gì (`RETURNING` rỗng). Trả về `results[1].results.length === 1`. D1 tuần tự hóa hai batch đồng thời nên không đếm đôi (test 5 lời gọi song song). Không dùng `INSERT OR IGNORE`.
3. **Quyết định đếm TRƯỚC render, ghi SAU qua `waitUntil`** (chỉ log lỗi: `product.view_failed`). Nếu `page()` ném lỗi sau đó (500) lượt xem vẫn có thể được ghi: hiếm, ghi nhận.
4. **Cookie chỉ đặt khi chưa có cookie hợp lệ**; `Cache-Control: private` chỉ khi đang đặt. Không bao giờ xóa cookie (kể cả khi GPC bật sau đó).
5. **Thứ tự kiểm rẻ → đắt:** cổng go-live; thiếu salt (cảnh báo một lần); bot, GPC; builder chủ; `isStaff` chỉ cho người đăng nhập không phải chủ. Toàn bộ trong `try/catch`: lỗi → `product.view_decide_failed` và `{ count: false }`.
6. **Chỉ `GET`.** HEAD không gọi `decideViewVisit`. Bốn locale cùng một khóa dedupe. 404 và 301 (slug hoa) xảy ra trước điểm đếm.
7. **Dọn dedupe: xóa mọi dòng có `day` < ngày UTC của `now`** (`DELETE … WHERE day < utcDay(now)`). Hash đổi theo ngày nên dòng của ngày trước vô dụng; job chạy 01:00 UTC nên mỗi dòng sống tối đa khoảng 25 giờ, và "2 ngày" trong Privacy là cận trên đúng. Không có hằng retention. `day` là cột đầu PK nên truy vấn dùng PK. Không giới hạn lô (vài nghìn dòng mỗi ngày); đếm bằng `meta.changes` (bảng không có trigger).
8. **Bước `view_dedupe` cuối `STEPS`.** 9. **`defer` chuyển sang `http/defer.ts`** (test Task 4 là rào chắn). 10. **Test kiến trúc:** regex quét ghi SQL mở rộng để thấy `INSERT OR … INTO` và `REPLACE INTO` (đã kiểm: `src/` không có), kèm đối chứng dương. 11. **Hợp đồng Ops:** chỉ gọi `isStaff`; task merge Ops thêm test `ops_members` không được đếm.
12. **D1 dùng chung giữa mọi test và file:** test chỉ khẳng định THEO product, không đếm cả bảng. Mọi test purge dùng một mốc `NOW = 2026-10-04T01:00:00Z` (cutoff `2026-10-04`) và đặt dòng riêng ở các ngày < `2026-10-04`, dưới mọi ngày mà file khác khẳng định (≥ `2026-10-06`).

**Câu hỏi mở cho Owner:** không. **Ghi nhận (ngoài phạm vi, đưa vào mục "Ghi nhận" của `CURRENT-STATUS.md`):** `test/monetization/go-product.test.ts:180` so sánh `count("product_daily_stats")` của CẢ bảng nên mong manh khi test khác ghi cùng lúc (sửa ở task riêng thành so theo product); thông báo Privacy của 3c không phủ `/ops`; `product_view_dedupe` không dọn theo lô nếu vượt vài nghìn dòng mỗi ngày.

**TDD steps:**

- [ ] **Step 1: Cổng đếm (RED → GREEN).** Trong `apps/web/test/domain/privacy-notice.test.ts` thêm `isCountingLive` vào import và:

  ```ts
  describe("isCountingLive (counting gate)", () => {
    it.each([
      ["before go-live", "2026-10-19T23:59:59.999Z", false],
      ["go-live 00:00Z", "2026-10-20T00:00:00.000Z", true],
      ["long after go-live (never switches off)", "2027-06-01T00:00:00.000Z", true],
    ] as const)("%s", (_l, iso, expected) => expect(isCountingLive(LIVE, at(iso))).toBe(expected));
    it("is false for an unset, empty or malformed go-live and for an invalid now", () => {
      for (const bad of [undefined, "", "2026-02-30", "20-10-2026"]) expect(isCountingLive(bad, at("2026-10-21T00:00:00Z"))).toBe(false);
      expect(isCountingLive(LIVE, new Date(Number.NaN))).toBe(false);
    });
  });
  ```

  → FAIL. Thêm vào `domain/privacy-notice.ts`:

  ```ts
  /** The counting gate (Owner 2026-10-06): view counting and the visitor cookie start at go-live 00:00 UTC and never switch off. False for an unset or malformed value. */
  export function isCountingLive(goLive: string | undefined, now: Date): boolean {
    const date = parsePrivacyNoticeDate(goLive);
    const at = now.getTime();
    return date !== null && Number.isFinite(at) && at >= date.getTime();
  }
  ```

  → PASS.

- [ ] **Step 2: Migration và `db/stats.ts` (RED → GREEN).** Tạo `apps/web/test/db/view-dedupe.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { purgeViewDedupe, recordProductView } from "../../src/db/stats.ts";
  import { addLiveProduct, makeBuilder } from "../fixtures.ts";
  import { testEnv } from "../helpers.ts";

  const H1 = "a".repeat(64);
  const H2 = "b".repeat(64);
  const AT = new Date("2026-10-06T10:00:00Z");

  const views = async (productId: string, day: string) =>
    (await testEnv.DB.prepare("SELECT views FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ views: number }>())?.views ?? 0;
  const dedupe = async (productId: string) =>
    (await testEnv.DB.prepare("SELECT day, visitor_hash, product_id FROM product_view_dedupe WHERE product_id = ?1 ORDER BY day, visitor_hash").bind(productId).all<Record<string, string>>()).results;

  async function product(tag: string) {
    return addLiveProduct(await makeBuilder(`${tag}@vnx.si`, tag, "approved"), `${tag} product`);
  }

  describe("recordProductView (VNX-0701b)", () => {
    it("counts a visitor once per product per day: first true, repeat false, views stays 1", async () => {
      const p = await product("vd-once");
      expect(await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: AT })).toBe(true);
      expect(await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: new Date("2026-10-06T23:59:59Z") })).toBe(false);
      expect(await views(p.id, "2026-10-06")).toBe(1);
      expect(await dedupe(p.id)).toEqual([{ day: "2026-10-06", visitor_hash: H1, product_id: p.id }]);
    });

    it("counts another visitor, another day and another product separately", async () => {
      const a = await product("vd-a");
      const b = await product("vd-b");
      expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H1, now: AT })).toBe(true);
      expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H2, now: AT })).toBe(true);
      expect(await recordProductView(testEnv.DB, { productId: a.id, visitorHash: H1, now: new Date("2026-10-07T00:00:00Z") })).toBe(true);
      expect(await recordProductView(testEnv.DB, { productId: b.id, visitorHash: H1, now: AT })).toBe(true);
      expect(await views(a.id, "2026-10-06")).toBe(2);
      expect(await views(a.id, "2026-10-07")).toBe(1);
      expect(await views(b.id, "2026-10-06")).toBe(1);
    });

    it("never double counts under concurrency", async () => {
      const p = await product("vd-race");
      const results = await Promise.all(Array.from({ length: 5 }, () => recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: AT })));
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await views(p.id, "2026-10-06")).toBe(1);
      expect(await dedupe(p.id)).toHaveLength(1);
    });

    it("refuses a hash that is not 64 lower-case hex characters and writes nothing", async () => {
      const p = await product("vd-bad");
      for (const bad of ["", "x", "A".repeat(64), "a".repeat(63), "a".repeat(65), "visitor@example.com", "203.0.113.9"]) {
        await expect(recordProductView(testEnv.DB, { productId: p.id, visitorHash: bad, now: AT })).rejects.toThrow();
      }
      expect(await views(p.id, "2026-10-06")).toBe(0);
      expect(await dedupe(p.id)).toHaveLength(0);
    });
  });

  describe("product_view_dedupe schema (Review Focus 2)", () => {
    it("has exactly day, visitor_hash, product_id: no IP, e-mail or user id", async () => {
      const cols = (await testEnv.DB.prepare("PRAGMA table_info(product_view_dedupe)").all<{ name: string }>()).results.map((r) => r.name);
      expect(cols).toEqual(["day", "visitor_hash", "product_id"]);
    });

    it("cascades with the product and the table itself rejects a non-hash value", async () => {
      const fks = (await testEnv.DB.prepare("PRAGMA foreign_key_list(product_view_dedupe)").all<{ table: string; on_delete: string }>()).results;
      expect(fks).toEqual([expect.objectContaining({ table: "products", on_delete: "CASCADE" })]);
      const p = await product("vd-check");
      await expect(testEnv.DB.prepare("INSERT INTO product_view_dedupe (day, visitor_hash, product_id) VALUES ('2026-10-06', 'someone@example.com', ?1)").bind(p.id).run()).rejects.toThrow();
      await expect(testEnv.DB.prepare("INSERT INTO product_view_dedupe (day, visitor_hash, product_id) VALUES ('yesterday', ?1, ?2)").bind(H1, p.id).run()).rejects.toThrow();
    });
  });

  describe("purgeViewDedupe (VNX-0701b)", () => {
    it("deletes every row of an earlier UTC day, keeps today's, and a rerun changes nothing", async () => {
      const p = await product("vd-purge");
      for (const day of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]) await recordProductView(testEnv.DB, { productId: p.id, visitorHash: H1, now: new Date(`${day}T12:00:00Z`) });
      const now = new Date("2026-10-04T01:00:00Z"); // the one purge clock of the suite: cutoff day 2026-10-04
      expect(await purgeViewDedupe(testEnv.DB, now)).toEqual(expect.any(Number)); // D1 is shared: rely on the per-product rows below, not the count
      expect((await dedupe(p.id)).map((r) => r.day)).toEqual(["2026-10-04"]);
      await purgeViewDedupe(testEnv.DB, now);
      expect((await dedupe(p.id)).map((r) => r.day)).toEqual(["2026-10-04"]);
      expect(await views(p.id, "2026-10-01")).toBe(1); // the counters are never purged
    });
  });
  ```

  → FAIL. Tạo `apps/web/migrations/0015_view_dedupe.sql`:

  ```sql
  -- M7 VNX-0701b (spec §8.11): one row per (UTC day, day-specific visitor hash, product) so a product view counts once per visitor per day.
  -- visitor_hash = HMAC(dayKey, cookie id): it changes every UTC day, cannot be joined across days, and holds no IP, e-mail or user id.
  -- The daily job deletes every row of an earlier UTC day (so "deleted after 2 days" in the Privacy text is an upper bound). Written only by
  -- src/db/stats.ts. Additive only; 0016 is public_stats.
  CREATE TABLE product_view_dedupe (
    day          TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    visitor_hash TEXT NOT NULL CHECK (length(visitor_hash) = 64 AND visitor_hash NOT GLOB '*[^0-9a-f]*'),
    product_id   TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    PRIMARY KEY (day, visitor_hash, product_id)
  ) WITHOUT ROWID;
  ```

  Thêm vào `apps/web/src/db/stats.ts` (import `utcDay` từ `../domain/stats.ts`):

  ```ts
  /**
   * Counts a product view once per (visitor hash, product, UTC day) and says whether this call counted. One db.batch, run in order inside
   * one transaction: statement 1 adds the view only when no dedupe row exists yet (it reads the state BEFORE statement 2 inserts), statement 2
   * inserts the row and RETURNING tells a fresh row from a duplicate. Two simultaneous calls are serialized by D1, so they cannot both count.
   * The hash must be the 64 lower-case hex of `visitorHash()`; anything else throws (the table also CHECKs it). Callers run this in waitUntil.
   */
  export async function recordProductView(db: D1Database, input: { productId: string; visitorHash: string; now: Date }): Promise<boolean> {
    if (!/^[0-9a-f]{64}$/.test(input.visitorHash)) throw new Error("invalid visitor hash");
    const day = utcDay(input.now);
    const [, inserted] = await db.batch([
      db
        .prepare(
          `INSERT INTO product_daily_stats (product_id, day, views, demo_clicks, outbound_clicks, inquiries)
           SELECT ?1, ?2, 1, 0, 0, 0
           WHERE NOT EXISTS (SELECT 1 FROM product_view_dedupe WHERE day = ?2 AND visitor_hash = ?3 AND product_id = ?1)
           ON CONFLICT (product_id, day) DO UPDATE SET views = views + excluded.views`,
        )
        .bind(input.productId, day, input.visitorHash),
      db
        .prepare("INSERT INTO product_view_dedupe (day, visitor_hash, product_id) VALUES (?1, ?2, ?3) ON CONFLICT (day, visitor_hash, product_id) DO NOTHING RETURNING 1 AS counted")
        .bind(day, input.visitorHash, input.productId),
    ]);
    return (inserted?.results.length ?? 0) === 1;
  }

  /** Daily retention: deletes every dedupe row of an earlier UTC day (the hash changes daily, so they are useless). Idempotent. Returns the rows deleted. */
  export async function purgeViewDedupe(db: D1Database, now: Date): Promise<number> {
    const result = await db.prepare("DELETE FROM product_view_dedupe WHERE day < ?1").bind(utcDay(now)).run();
    return result.meta.changes;
  }
  ```

  → PASS. Nếu D1 báo lỗi cú pháp ở câu 1 (`ON CONFLICT` sau `SELECT … WHERE`), đổi thành `SELECT ?1, ?2, 1, 0, 0, 0 WHERE true AND NOT EXISTS (…)` (cách chống nhập nhằng của SQLite), không đổi thứ tự hai câu.

- [ ] **Step 3: Bước `view_dedupe` của job ngày (RED → GREEN).** Sửa `apps/web/test/jobs/daily.test.ts`:
  1. Sau `const CLICK_STEP = …` thêm `const VIEW_STEP = { job: "daily", step: "view_dedupe", deleted: expect.any(Number) };` (D1 dùng chung, số dòng bị xóa phụ thuộc file khác).
  2. Ba mảng `toEqual` có `CLICK_STEP` ở cuối: thêm `VIEW_STEP,` sau `CLICK_STEP,`.
  3. `toHaveLength(IDLE_ACTIVITY_STEPS.length + 4)` → `+ 5`.
  4. Ca "keeps going when one step fails": thêm `expect(results[at + 4]).toEqual(VIEW_STEP);`.
  5. Ca scheduled: danh sách tên bước thêm `"view_dedupe"` ở cuối.
  6. Thêm import `recordProductView`, `addLiveProduct`, `makeBuilder`; thêm khối cuối file:

  ```ts
  describe("view dedupe step (VNX-0701b: Privacy says 2 days)", () => {
    const dedupeDays = async (productId: string) =>
      (await testEnv.DB.prepare("SELECT day FROM product_view_dedupe WHERE product_id = ?1 ORDER BY day").bind(productId).all<{ day: string }>()).results.map((r) => r.day);

    it("deletes every earlier UTC day, keeps today, and a second run changes nothing for this product", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const p = await addLiveProduct(await makeBuilder("daily-vd@vnx.si", "daily-vd", "approved"), "daily-vd product");
      // NOW is 2026-10-04 (the one purge clock): the cutoff day is 2026-10-04; these rows sit below every day other files assert on.
      for (const day of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]) await recordProductView(testEnv.DB, { productId: p.id, visitorHash: "c".repeat(64), now: new Date(`${day}T12:00:00Z`) });
      const step = (await runDaily(testEnv, NOW)).find((r) => r.step === "view_dedupe");
      expect(step).toEqual({ job: "daily", step: "view_dedupe", deleted: expect.any(Number) });
      expect(await dedupeDays(p.id)).toEqual(["2026-10-04"]);
      await runDaily(testEnv, NOW);
      expect(await dedupeDays(p.id)).toEqual(["2026-10-04"]);
    });

    it("is the last step, and a failing dedupe purge is logged without touching the earlier steps", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const results = await runDaily({ ...testEnv, DB: brokenOn("product_view_dedupe") } as Bindings, NOW);
      expect(results.at(-1)).toEqual({ job: "daily", step: "view_dedupe", error: "Error: boom on product_view_dedupe" });
      expect(results.at(-2)).toEqual(CLICK_STEP);
      expect(error).toHaveBeenCalledTimes(1);
    });
  });
  ```

  → FAIL. Trong `apps/web/src/jobs/daily.ts`: import `purgeViewDedupe` từ `../db/stats.ts`; thêm cuối `STEPS`:

  ```ts
  // M7: de-duplication rows for product views of an earlier UTC day are useless (the visitor hash changes daily); Privacy says "deleted after 2 days".
  { step: "view_dedupe", counts: "deleted", run: (env, now) => purgeViewDedupe(env.DB, now) },
  ```

  và thêm vào chú thích đầu file một dòng "VNX-0701b (M7): deletes product-view de-duplication rows of earlier UTC days." → PASS.

- [ ] **Step 4: Cookie, `decideViewVisit`, route (RED → GREEN).** Tạo `apps/web/test/product-page-views.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { createApp } from "../src/app.ts";
  import { setBuilderStatus } from "../src/db/builders.ts";
  import { visitorCookieMaxAge, visitorHash } from "../src/domain/visitor.ts";
  import type { Bindings } from "../src/env.ts";
  import { resetNoSaltWarning } from "../src/http/visitor.ts";
  import { makeBuilder, makeDraft, makeLiveProduct, signIn } from "./fixtures.ts";
  import { setCookieValue, testEnv } from "./helpers.ts";

  const SALT = "product-views-test-salt-0000000000";
  // The counting gate (Owner 2026-10-06): a valid go-live in the past. Every counting test needs it.
  const ENV = { ...testEnv, ANALYTICS_SALT: SALT, PRIVACY_NOTICE_GO_LIVE: "2026-10-01" } as Bindings;
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const VID = "0123456789abcdef0123456789abcdef";
  const COOKIE = "__Host-vnx_vid";

  type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings };
  async function call(path: string, o: Call = {}): Promise<Response> {
    const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
    if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
    return await createApp().request(req, undefined, o.env ?? ENV);
  }
  const browser = (extra: Record<string, string> = {}) => ({ "user-agent": CHROME, ...extra });
  const withVid = (vid = VID, extra: Record<string, string> = {}) => browser({ cookie: `${COOKIE}=${vid}`, ...extra });
  const vidLine = (res: Response) => res.headers.getSetCookie().find((l) => l.startsWith(`${COOKIE}=`));
  const hasVid = (res: Response) => vidLine(res) !== undefined;

  let seq = 0;
  /** The demo URL lets the /go/p/ test redirect (as go-product.test.ts does). */
  async function live() {
    const n = ++seq;
    const email = `pv${n}@vnx.si`;
    const { builder, product } = await makeLiveProduct(email, `pv${n}`, `pv${n} product`, { fields: { demoUrl: "https://demo.example.com/" } });
    return { email, builder, product, slug: product.slug };
  }
  const views = async (productId: string) =>
    (await testEnv.DB.prepare("SELECT COALESCE(SUM(views), 0) AS n FROM product_daily_stats WHERE product_id = ?1").bind(productId).first<{ n: number }>())?.n ?? 0;
  const viewsOn = async (productId: string, day: string) =>
    (await testEnv.DB.prepare("SELECT views FROM product_daily_stats WHERE product_id = ?1 AND day = ?2").bind(productId, day).first<{ views: number }>())?.views ?? 0;
  const dedupeRows = async (productId: string) => (await testEnv.DB.prepare("SELECT day, visitor_hash, product_id FROM product_view_dedupe WHERE product_id = ?1 ORDER BY day").bind(productId).all<Record<string, string>>()).results;

  beforeEach(() => resetNoSaltWarning());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("first view sets the cookie and counts (Review Focus 1, 2)", { timeout: 30_000 }, () => {
    it("200, views = 1, one dedupe row with the day hash, and a __Host- cookie that ends at 00:00 UTC", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-06T10:30:00Z"));
      const { product, slug } = await live();
      const res = await call(`/p/${slug}`, { headers: browser() });
      expect(res.status).toBe(200);
      const line = vidLine(res) ?? "";
      const id = setCookieValue(res, COOKIE) ?? "";
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      expect(line).toContain("; Max-Age=48600"); // 13.5 h to 00:00 UTC
      expect(visitorCookieMaxAge(new Date("2026-10-06T10:30:00Z"))).toBe(48600);
      expect(line).toMatch(/; Path=\/(;|$)/);
      expect(line).toMatch(/; HttpOnly(;|$)/);
      expect(line).toMatch(/; Secure(;|$)/);
      expect(line).toMatch(/; SameSite=Lax(;|$)/);
      expect(line).not.toMatch(/Domain=/i);
      expect(res.headers.get("cache-control")).toBe("private");
      expect(await views(product.id)).toBe(1);
      expect(await dedupeRows(product.id)).toEqual([{ day: "2026-10-06", visitor_hash: (await visitorHash(SALT, "2026-10-06", id))!, product_id: product.id }]);
    });

    it("a second view with the cookie the same day: still 1, no new Set-Cookie", async () => {
      const { product, slug } = await live();
      const first = await call(`/p/${slug}`, { headers: browser() });
      const id = setCookieValue(first, COOKIE) ?? "";
      const second = await call(`/p/${slug}`, { headers: withVid(id) });
      expect(second.status).toBe(200);
      expect(hasVid(second)).toBe(false);
      expect(await views(product.id)).toBe(1);
      expect(await dedupeRows(product.id)).toHaveLength(1);
    });

    it("counts again after 00:00 UTC for the same cookie, with a different hash", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-06T23:59:58Z"));
      const { product, slug } = await live();
      const first = await call(`/p/${slug}`, { headers: browser() });
      const id = setCookieValue(first, COOKIE) ?? "";
      expect(vidLine(first)).toContain("; Max-Age=2");
      vi.setSystemTime(new Date("2026-10-06T23:59:59.500Z"));
      await call(`/p/${slug}`, { headers: withVid(id) });
      expect(await viewsOn(product.id, "2026-10-06")).toBe(1);
      vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
      const next = await call(`/p/${slug}`, { headers: withVid(id) });
      expect(hasVid(next)).toBe(false);
      expect(await viewsOn(product.id, "2026-10-06")).toBe(1);
      expect(await viewsOn(product.id, "2026-10-07")).toBe(1);
      const rows = await dedupeRows(product.id);
      expect(rows.map((r) => r.day)).toEqual(["2026-10-06", "2026-10-07"]);
      expect(rows[0]?.visitor_hash).not.toBe(rows[1]?.visitor_hash);
    });

    it("two products with the same cookie count once each", async () => {
      const a = await live();
      const b = await live();
      const first = await call(`/p/${a.slug}`, { headers: browser() });
      const id = setCookieValue(first, COOKIE) ?? "";
      await call(`/p/${b.slug}`, { headers: withVid(id) });
      await call(`/p/${a.slug}`, { headers: withVid(id) });
      expect(await views(a.product.id)).toBe(1);
      expect(await views(b.product.id)).toBe(1);
    });

    it("another visitor counts separately; a locale prefix shares the same daily count", async () => {
      const { product, slug } = await live();
      await call(`/p/${slug}`, { headers: withVid(VID) });
      await call(`/vi/p/${slug}`, { headers: withVid(VID) });
      expect(await views(product.id)).toBe(1);
      await call(`/zh-hans/p/${slug}`, { headers: withVid("fedcba9876543210fedcba9876543210") });
      expect(await views(product.id)).toBe(2);
    });

    it("a malformed cookie value is ignored: a fresh cookie is set and one view counted", async () => {
      const { product, slug } = await live();
      for (const bad of ["x", "0123456789ABCDEF0123456789ABCDEF", "0123456789abcdef0123456789abcde"]) {
        const res = await call(`/p/${slug}`, { headers: withVid(bad) });
        expect(setCookieValue(res, COOKIE)).toMatch(/^[0-9a-f]{32}$/);
      }
      expect(await views(product.id)).toBe(3);
    });
  });

  describe("the counting gate: PRIVACY_NOTICE_GO_LIVE (Owner 2026-10-06)", { timeout: 30_000 }, () => {
    it.each([undefined, "", "2026-02-30", "20-10-2026"])("go-live %j: page 200, no cookie, no rows, no warning, even with a salt", async (goLive) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { product, slug } = await live();
      const res = await call(`/p/${slug}`, { headers: browser(), env: { ...ENV, PRIVACY_NOTICE_GO_LIVE: goLive } as Bindings });
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(false);
      expect(await views(product.id)).toBe(0);
      expect(await dedupeRows(product.id)).toHaveLength(0);
      expect(warn).not.toHaveBeenCalled();
    });

    it("nothing counts before go-live 00:00Z, and counting starts at that instant", async () => {
      const env = { ...ENV, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
      const { product, slug } = await live();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-19T23:59:59.999Z"));
      const before = await call(`/p/${slug}`, { headers: browser(), env });
      expect([before.status, hasVid(before)]).toEqual([200, false]);
      expect(await views(product.id)).toBe(0);
      vi.setSystemTime(new Date("2026-10-20T00:00:00.000Z"));
      const at = await call(`/p/${slug}`, { headers: browser(), env });
      expect([at.status, hasVid(at)]).toEqual([200, true]);
      expect(await viewsOn(product.id, "2026-10-20")).toBe(1);
    });

    it("a /go/p/ click with a valid cookie and a salt, before go-live: visitor_hash null and no stats (N1)", async () => {
      const env = { ...ENV, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings;
      const { product, slug } = await live();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-19T23:59:59.999Z"));
      const res = await call(`/go/p/${slug}/demo`, { headers: withVid(), env });
      expect(res.status).toBe(302);
      const rows = (await testEnv.DB.prepare("SELECT visitor_hash FROM outbound_clicks WHERE product_id = ?1").bind(product.id).all<{ visitor_hash: string | null }>()).results;
      expect(rows.map((r) => r.visitor_hash)).toEqual([null]);
      expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM product_daily_stats WHERE product_id = ?1").bind(product.id).first<{ n: number }>())?.n).toBe(0);
    });
  });

  describe("who is never counted: no row, no dedupe, no cookie", { timeout: 30_000 }, () => {
    const cases: [string, Call][] = [
      ["curl user agent", { headers: { "user-agent": "curl/8.4.0" } }],
      ["Googlebot", { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } }],
      ["empty user agent", { headers: { "user-agent": "" } }],
      ["Cloudflare verified bot", { headers: browser(), cf: { botManagement: { verifiedBot: true } } }],
      ["Sec-GPC: 1", { headers: browser({ "sec-gpc": "1" }) }],
      ["Sec-GPC: 1 with an existing valid cookie", { headers: withVid(VID, { "sec-gpc": "1" }) }],
    ];
    it.each(cases)("%s", async (_name, o) => {
      const { product, slug } = await live();
      const res = await call(`/p/${slug}`, o);
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(false);
      expect(res.headers.get("cache-control") ?? "").not.toContain("private");
      expect(await views(product.id)).toBe(0);
      expect(await dedupeRows(product.id)).toHaveLength(0);
    });

    it("the product's own builder, and staff (admin in ADMIN_EMAILS), are not counted; an ordinary signed-in user is", async () => {
      const { product, slug, email } = await live();
      const own = await signIn(email);
      const ownRes = await call(`/p/${slug}`, { headers: browser({ cookie: own.cookie }) });
      expect([ownRes.status, hasVid(ownRes)]).toEqual([200, false]);
      const admin = await signIn("owner@vnx.si", { admin: true });
      const staffRes = await call(`/p/${slug}`, { headers: browser({ cookie: `${admin.cookie}; ${COOKIE}=${VID}` }) });
      expect([staffRes.status, hasVid(staffRes)]).toEqual([200, false]);
      expect(await views(product.id)).toBe(0);
      const plain = await signIn("pv-plain@vnx.si");
      const plainRes = await call(`/p/${slug}`, { headers: browser({ cookie: plain.cookie }) });
      expect(hasVid(plainRes)).toBe(true);
      expect(await views(product.id)).toBe(1);
    });

    it("HEAD neither counts nor sets a cookie", async () => {
      const { product, slug } = await live();
      const res = await call(`/p/${slug}`, { method: "HEAD", headers: browser() });
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(false);
      expect(await views(product.id)).toBe(0);
    });
  });

  describe("no salt: nothing is counted and no cookie is set (Global Constraints, Review Focus 2)", { timeout: 30_000 }, () => {
    it.each([undefined, "", "   "])("ANALYTICS_SALT %j: page 200, no cookie, no rows, one warning per isolate", async (salt) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { product, slug } = await live();
      const env = { ...ENV, ANALYTICS_SALT: salt } as Bindings;
      for (let i = 0; i < 2; i++) {
        const res = await call(`/p/${slug}`, { headers: browser(), env });
        expect(res.status).toBe(200);
        expect(hasVid(res)).toBe(false);
      }
      expect(await views(product.id)).toBe(0);
      expect(await dedupeRows(product.id)).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.parse(warn.mock.calls[0]?.[0] as string).event).toBe("visitor.no_salt");
    });
  });

  describe("the cookie exists only on GET /p/:slug 200", { timeout: 30_000 }, () => {
    it("404 (unknown, malformed, draft, builder not approved) and the 301 for an upper-case slug set nothing", async () => {
      const { slug, builder, product } = await live();
      const draft = await makeDraft("pv-draft@vnx.si", "pv-draft", "pv draft");
      for (const path of ["/p/does-not-exist", "/p/-x-", `/p/${draft.product.slug}`]) {
        const res = await call(path, { headers: browser() });
        expect([path, res.status]).toEqual([path, 404]);
        expect(hasVid(res)).toBe(false);
      }
      const upper = await call(`/p/${slug.toUpperCase()}`, { headers: browser() });
      expect(upper.status).toBe(301);
      expect(hasVid(upper)).toBe(false);
      await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
      const suspended = await call(`/p/${slug}`, { headers: browser() });
      expect([suspended.status, hasVid(suspended)]).toEqual([404, false]);
      expect(await dedupeRows(product.id)).toHaveLength(0);
      expect(await dedupeRows(draft.product.id)).toHaveLength(0);
    });

    it("/go/p/, /admin, /hub and /me never set it, even for a counted visitor", async () => {
      const { slug } = await live();
      await makeBuilder("pv-hub@vnx.si", "pv-hub", "approved");
      const user = await signIn("pv-hub@vnx.si");
      const admin = await signIn("owner@vnx.si", { admin: true });
      const go = await call(`/go/p/${slug}/demo`, { headers: browser() });
      expect([go.status, hasVid(go)]).toEqual([302, false]);
      for (const [path, cookie] of [["/hub", user.cookie], ["/me", user.cookie], ["/admin", admin.cookie]] as const) {
        const res = await call(path, { headers: browser({ cookie }) });
        expect([path, hasVid(res)]).toEqual([path, false]);
      }
    });
  });

  describe("privacy and failure", { timeout: 30_000 }, () => {
    it("a signed-in visitor leaves no IP, e-mail or user id in this product's dedupe or stats rows", async () => {
      const { product, slug } = await live();
      const user = await signIn("pv-privacy@vnx.si");
      await call(`/p/${slug}`, { headers: browser({ cookie: user.cookie, "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9" }) });
      expect(await views(product.id)).toBe(1);
      const dump = JSON.stringify([
        ...(await testEnv.DB.prepare("SELECT * FROM product_view_dedupe WHERE product_id = ?1").bind(product.id).all()).results,
        ...(await testEnv.DB.prepare("SELECT * FROM product_daily_stats WHERE product_id = ?1").bind(product.id).all()).results,
      ]);
      for (const secret of ["203.0.113.9", "pv-privacy@vnx.si", user.user.id]) expect(dump).not.toContain(secret);
    });

    it("a failing write is logged and never breaks the page (the cookie is still set)", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { slug } = await live();
      const db = new Proxy(testEnv.DB, {
        get(target, prop) {
          if (prop === "prepare") return (sql: string) => (sql.includes("product_view_dedupe") ? (() => { throw new Error("boom"); })() : target.prepare(sql));
          const value = Reflect.get(target, prop) as unknown;
          return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      });
      const res = await call(`/p/${slug}`, { headers: browser(), env: { ...ENV, DB: db } as Bindings });
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(true);
      expect(error.mock.calls.map((c) => JSON.parse(c[0] as string).event)).toContain("product.view_failed");
    });

    it("a throwing staff lookup is logged and the page still renders without a cookie", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { slug } = await live();
      const admin = await signIn("pv-staff-throws@vnx.si", { admin: true });
      const env = { ...ENV };
      Object.defineProperty(env, "ADMIN_EMAILS", { get() { throw new Error("staff lookup failed"); } });
      const res = await call(`/p/${slug}`, { headers: browser({ cookie: admin.cookie }), env: env as Bindings });
      expect(res.status).toBe(200);
      expect(hasVid(res)).toBe(false);
      expect(error.mock.calls.map((c) => JSON.parse(c[0] as string).event)).toContain("product.view_decide_failed");
    });
  });
  ```

  → FAIL. Tạo `apps/web/src/http/defer.ts` (chuyển NGUYÊN VĂN từ `routes/go.ts`):

  ```ts
  import type { Context } from "hono";
  import type { AppEnv } from "../env.ts";

  /** waitUntil when the runtime has an ExecutionContext (Hono throws when it has none: tests, local), else wait for the write. */
  export async function defer(c: Context<AppEnv>, work: Promise<void>): Promise<void> {
    let ctx: { waitUntil(promise: Promise<unknown>): void } | null = null;
    try {
      ctx = c.executionCtx;
    } catch {
      ctx = null;
    }
    if (ctx) ctx.waitUntil(work);
    else await work;
  }
  ```

  Trong `routes/go.ts`: xóa hàm `defer` cục bộ (và chú thích trên nó), thêm `import { defer } from "../http/defer.ts";` và `import { isCountingLive } from "../domain/privacy-notice.ts";`. Trong `trackProductClick` đổi điều kiện tính hash thành `hash = salt !== null && !t.isBot && !t.isGpc && t.visitorId !== null && isCountingLive(env.PRIVACY_NOTICE_GO_LIVE, t.now) ? await visitorHash(salt, day, t.visitorId) : null;` (cổng đóng thì `hash = null`: dòng click vẫn ghi, không cộng thống kê). Trong `test/monetization/go-product.test.ts` đổi `const ENV = { ...testEnv, ANALYTICS_SALT: SALT } as Bindings;` thành `{ ...testEnv, ANALYTICS_SALT: SALT, PRIVACY_NOTICE_GO_LIVE: "2026-01-01" } as Bindings;` (nếu một ca dùng đồng hồ giả trước ngày đó, đổi ngày về trước nó).

  Mở rộng `apps/web/src/http/visitor.ts` (giữ `readVisitorCookie`, `warnNoSaltOnce`, `resetNoSaltWarning`; thêm import `setCookie` từ `hono/cookie`, `isStaff` từ `../auth/staff.ts`, `isBotRequest`/`CfLike` từ `../domain/bot.ts`, `isCountingLive` từ `../domain/privacy-notice.ts`, và các tên còn thiếu từ `../domain/visitor.ts`):

  ```ts
  export type ViewVisit = { count: false } | { count: true; visitorId: string; isNew: boolean };

  /**
   * Whether this `GET /p/:slug` counts as a product view, and under which visitor id (a fresh one when the cookie is missing or malformed).
   * The go-live gate first (Owner 2026-10-06), then the cheap checks (no salt, bot, GPC), then the product's own builder, and `isStaff` last,
   * only for a signed-in non-owner. Never rejects: on any error it logs and says "do not count". It does NOT touch the response.
   */
  export async function decideViewVisit(c: Context<AppEnv>, builderId: string, now: Date): Promise<ViewVisit> {
    try {
      if (!isCountingLive(c.env.PRIVACY_NOTICE_GO_LIVE, now)) return { count: false };
      if (usableSalt(c.env.ANALYTICS_SALT) === null) {
        warnNoSaltOnce();
        return { count: false };
      }
      const cf = c.req.raw.cf as CfLike;
      const isBot = isBotRequest(c.req.header("user-agent"), cf);
      const isGpc = hasGpc(c.req.raw.headers);
      if (isBot || isGpc) return { count: false };
      const user = c.get("user");
      const own = user?.id === builderId;
      const staff = !own && user ? await isStaff(c.env, user) : false;
      if (!shouldCount({ isBot, isStaff: staff, isOwnBuilder: own, isGpc, hasSalt: true })) return { count: false };
      const existing = readVisitorCookie(c);
      return existing !== null ? { count: true, visitorId: existing, isNew: false } : { count: true, visitorId: newVisitorId(), isNew: true };
    } catch (err) {
      console.error(JSON.stringify({ event: "product.view_decide_failed", error: String(err) }));
      return { count: false };
    }
  }

  /** `__Host-vnx_vid`: random id, ends at the next 00:00 UTC. `private` keeps a shared cache from handing one visitor's Set-Cookie to another. */
  export function setVisitorCookie(c: Context<AppEnv>, visitorId: string, now: Date): void {
    setCookie(c, VISITOR_COOKIE, visitorId, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: visitorCookieMaxAge(now) });
    c.header("Cache-Control", "private");
  }
  ```

  Sửa `apps/web/src/routes/product-page.tsx`: thêm import `recordProductView` (`../db/stats.ts`), `utcDay` (`../domain/stats.ts`), `visitorHash` (`../domain/visitor.ts`), `Bindings` (`../env.ts`), `defer` (`../http/defer.ts`), `decideViewVisit`, `setVisitorCookie` (`../http/visitor.ts`). Thêm trên `registerProductPageRoutes`:

  ```ts
  /** Never rejects: a failed write is logged and must not touch the page. The hash is computed here, off the request path. */
  async function countView(env: Bindings, input: { productId: string; visitorId: string; now: Date }): Promise<void> {
    try {
      const hash = await visitorHash(env.ANALYTICS_SALT, utcDay(input.now), input.visitorId);
      if (hash === null) return;
      await recordProductView(env.DB, { productId: input.productId, visitorHash: hash, now: input.now });
    } catch (err) {
      console.error(JSON.stringify({ event: "product.view_failed", productId: input.productId, error: String(err) }));
    }
  }
  ```

  và trong handler, ngay trước `return page(c, <ProductPage … />)`:

  ```tsx
    // M7 (Owner (b) B1): one view per visitor per product per UTC day. Only GET (HEAD is answered by this handler and must not count).
    if (c.req.method === "GET") {
      const now = new Date();
      const visit = await decideViewVisit(c, item.product.builderId, now);
      if (visit.count) {
        if (visit.isNew) setVisitorCookie(c, visit.visitorId, now);
        await defer(c, countView(c.env, { productId: item.product.id, visitorId: visit.visitorId, now }));
      }
    }
  ```

  → `npm test -w apps/web -- test/product-page-views.test.ts test/monetization test/public/product-page.test.ts` PASS.

- [ ] **Step 5: Test kiến trúc và ghi chú triển khai.** Trong `apps/web/test/architecture.test.ts`: thêm `product_view_dedupe: "../src/db/stats.ts",` vào `WRITERS` (sau `product_daily_stats`); thay regex ghi SQL bằng hằng dùng chung và đối chứng dương:

  ```ts
  /** Table names behind a write: INSERT, INSERT OR IGNORE/REPLACE, REPLACE INTO, UPDATE, DELETE (VNX-0701b). */
  const WRITE_SQL = /\b(?:INSERT(?: OR [A-Z]+)? INTO|REPLACE INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/g;
  ```

  (ca `table ownership` dùng `src.matchAll(WRITE_SQL)`), và trong cùng `describe`:

  ```ts
  it("sees INSERT OR IGNORE/REPLACE and REPLACE INTO, so product_view_dedupe cannot be written from another file unnoticed", () => {
    for (const sql of ["INSERT OR IGNORE INTO product_view_dedupe (day) VALUES (1)", "INSERT OR REPLACE INTO product_view_dedupe (day) VALUES (1)", "REPLACE INTO product_view_dedupe (day) VALUES (1)"]) {
      expect([...sql.matchAll(WRITE_SQL)][0]?.[1], sql).toBe("product_view_dedupe");
    }
    expect(WRITERS.product_view_dedupe).toBe("../src/db/stats.ts");
  });
  ```

  Trong `apps/web/wrangler.jsonc`: (a) thêm `, 0015_view_dedupe` vào danh sách migration của bước 1 ("applies … 0014_product_stats, 0015_view_dedupe, 0016_public_stats"); (b) thêm dòng `// 0015_view_dedupe (M7) ships with its code the same way: migrate first, then deploy.` sau dòng 0014; (c) trong chú thích ANALYTICS_SALT thay câu "do NOT set it in production until Task 3 and the Privacy update go live (until then each isolate logs visitor.no_salt once, which is expected)" bằng: "set it in production any time after PRIVACY_NOTICE_GO_LIVE is committed and deployed: counting of both views and clicks starts only at go-live 00:00 UTC (and PRIVACY_NOTICE_GO_LIVE must NEVER be cleared afterwards). Until the salt is set each isolate logs visitor.no_salt once, which is expected." → `npm test -w apps/web -- test/architecture.test.ts` PASS.

- [ ] **Step 6: Typecheck, test đầy đủ, commit.**

  ```
  npm run typecheck -w apps/web
  npm test
  git add apps/web/migrations/0015_view_dedupe.sql apps/web/src/domain/privacy-notice.ts apps/web/src/db/stats.ts apps/web/src/jobs/daily.ts apps/web/src/http/defer.ts apps/web/src/http/visitor.ts apps/web/src/routes/go.ts apps/web/src/routes/product-page.tsx apps/web/wrangler.jsonc apps/web/test/architecture.test.ts apps/web/test/domain/privacy-notice.test.ts apps/web/test/db/view-dedupe.test.ts apps/web/test/jobs/daily.test.ts apps/web/test/product-page-views.test.ts
  git commit -m "feat(web): count product views with a daily visitor cookie behind the go-live gate (VNX-0701b)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  Không chứa `.ai/tasks/*-report.md`. Diff ước tính ~430 dòng (mã ~110, test ~320), không có văn bản pháp lý.

**Ghi chú triển khai cho Owner:**
1. Áp migration `0014`, `0015`, `0016` trên D1 production TRƯỚC khi deploy code M7.
2. Chuỗi go-live: (a) commit `chore:` đặt `PRIVACY_NOTICE_GO_LIVE` (3c) và deploy 3c ít nhất 14 ngày trước go-live; (b) từ `go-live − 14 ngày`, `/privacy` hiện văn bản M7 và thông báo xuất hiện (3p, 3c); (c) từ `go-live 00:00Z`, cookie và đếm bật (Task này) NẾU `ANALYTICS_SALT` đã đặt (`wrangler secret put`, 32+ ký tự). Thiếu salt thì không đếm dù qua go-live.
3. **KHÔNG BAO GIỜ xóa `PRIVACY_NOTICE_GO_LIVE` sau go-live:** nó chọn phiên bản Privacy và bật đếm; xóa là tắt đếm và đưa văn bản cũ trở lại. Một task dọn dẹp sau này gấp phiên bản cũ vào `privacy.md`.
4. Rate limit Cloudflare cho `/p/*` và `/go/p/*` (Owner (f) F1): cấu hình ở dashboard.

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Lượt xem đầu: 200, `views = 1`, một dòng dedupe có hash đúng của ngày, `Set-Cookie` `__Host-vnx_vid` đủ `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, không `Domain`, `Max-Age` tới 00:00 UTC (48600 lúc 10:30Z), `Cache-Control: private` | `npm test -w apps/web -- test/product-page-views.test.ts` |
| AC2 | Lượt hai cùng cookie cùng ngày: vẫn 1, không `Set-Cookie`; sang 00:00 UTC: đếm lại hash khác; hai product cùng cookie: mỗi cái 1; các locale chung một lần; cookie sai dạng bị bỏ qua; 5 lời gọi song song chỉ đếm 1 | `npm test -w apps/web -- test/product-page-views.test.ts test/db/view-dedupe.test.ts` |
| AC3 | Không đếm, không dedupe, không cookie: bot (UA `curl`, `Googlebot`, rỗng, `verifiedBot`), `Sec-GPC: 1` (kể cả khi đã có cookie), builder chủ, staff; người dùng thường vẫn được đếm | `npm test -w apps/web -- test/product-page-views.test.ts` (nhóm "who is never counted") |
| AC4 | HEAD, 404, 301 slug hoa không cookie; `/go/p/`, `/admin`, `/hub`, `/me` không đặt cookie | `npm test -w apps/web -- test/product-page-views.test.ts` (nhóm "only on GET /p/:slug 200") |
| AC5 | Thiếu/rỗng/trắng salt: 200, không cookie, không dòng, đúng một `console.warn` `visitor.no_salt` | `npm test -w apps/web -- test/product-page-views.test.ts` (nhóm "no salt") |
| AC6 | **Cổng đếm:** go-live rỗng/sai dạng, hoặc `now` < go-live 00:00Z: không cookie, không đếm, không cảnh báo, click `/go/p/` có cookie hợp lệ ghi `visitor_hash` null và không cộng; từ 00:00Z đếm; `isCountingLive` đúng biên | `npm test -w apps/web -- test/product-page-views.test.ts test/domain/privacy-notice.test.ts` (nhóm "counting gate") |
| AC7 | Riêng tư: bảng chỉ có `day`, `visitor_hash`, `product_id`; từ chối giá trị không phải hash 64 hex; không IP/email/user id trong dedupe và stats của product; hash khác nhau giữa hai ngày | `npm test -w apps/web -- test/db/view-dedupe.test.ts test/product-page-views.test.ts` |
| AC8 | Lỗi ghi hoặc lỗi kiểm staff chỉ log, trang vẫn 200 | `npm test -w apps/web -- test/product-page-views.test.ts` (nhóm "privacy and failure") |
| AC9 | `purgeViewDedupe` xóa mọi dòng của ngày UTC trước, giữ hôm nay, chạy lại không đổi; là bước cuối của `STEPS`; bước lỗi không dừng bước khác; counters không bị dọn | `npm test -w apps/web -- test/db/view-dedupe.test.ts test/jobs/daily.test.ts` |
| AC10 | Chỉ `db/stats.ts` ghi `product_view_dedupe` (kể cả `INSERT OR …`, `REPLACE INTO`); `db/stats.ts` không import `db/clicks.ts` | `npm test -w apps/web -- test/architecture.test.ts` |
| AC11 | Không đổi hành vi click sau khi chuyển `defer` | `npm test -w apps/web -- test/monetization` |
| AC12 | Task không chạm `docs/legal/*`, `legal/content.ts`; `0015_view_dedupe` có trong danh sách migration của `wrangler.jsonc` | `git diff --cached --name-only` (không có hai tệp đó); `grep -n "0015_view_dedupe" apps/web/wrangler.jsonc` |
| AC13 | Typecheck sạch, toàn bộ test xanh, diff trong ngân sách | `npm run typecheck -w apps/web`; `npm test`; `git diff --cached --stat` |

**Nghĩa vụ để lại:** (1) Task merge Ops: mở rộng `isStaff` và thêm test `ops_members` không được đếm ở `/p/:slug` và `/go/p/`. (2) Sau khi Task 3 lên production và qua go-live, click của khách có cookie bắt đầu được cộng thống kê (Task 4). (3) Task dọn dẹp sau go-live: gấp `privacy-m7.md` vào `privacy.md`, bỏ `privacyEn`/`privacyVi` cũ và `privacyVersion`. 

**Quyết định kỹ thuật cần Reviewer kiểm:** cổng đếm đứng đầu và khóa luôn click `/go/p/` gián tiếp (1); batch `NOT EXISTS` + `ON CONFLICT DO NOTHING RETURNING` (2); đếm trước render, ghi sau qua `waitUntil` (3); cookie chỉ đặt khi chưa có (4); dọn mọi `day` < hôm nay (7); `defer` chuyển sang `http/defer.ts` (9); regex quét ghi SQL mở rộng (10); test chỉ khẳng định theo product, một mốc purge chung (12).

---

### Task 4: VNX-0707b — `/go/p/:slug/{demo,site}`

**Scope (HIGH-RISK, như EPIC 21 Task 4: open redirect; Review Focus 1, 2, 3).** Hai route `GET /go/p/:slug/demo` và `/site` đăng ký TRƯỚC `app.get("/go/*")`, dùng lại `outbound_clicks`, `db/clicks.ts`, và `saveClick`/`defer`/`notFound`/`redirectTo` của `routes/go.ts` (không bảng, không migration). Thêm: `validatePublicUrl` dùng CHUNG cho editor product (lúc lưu) và redirect (M4); cộng `product_daily_stats` qua `db/stats.ts` (Task 1) theo luật đếm của Task 2; dedupe click bằng `idx_clicks_visitor`; `ProductPage` đổi link sang `/go/p/…`; sửa hai kỳ vọng của `go.test.ts`. KHÔNG đặt cookie ở route `/go/` (M2: chỉ đọc). Click offer (`/go/o/`, `/go/:merchant`) giữ nguyên và không bao giờ chạm `product_daily_stats` (L4).

**Files:**
- Create: `apps/web/src/domain/product-url.ts` (re-export `validatePublicUrl`; `resolveProductLink`)
- Modify: `apps/web/src/domain/offer-url.ts` (R2: export `validatePublicUrl`; `check` = lõi + allowlist; không đổi hành vi)
- Modify: `apps/web/wrangler.jsonc` (chỉ chú thích ANALYTICS_SALT: công tắc bật đếm, R1)
- Create: `apps/web/src/http/visitor.ts` (chỉ `readVisitorCookie`, `warnNoSaltOnce`, `resetNoSaltWarning`; Task 3 MỞ RỘNG file này thay vì tạo mới, xem "Nghĩa vụ")
- Modify: `apps/web/src/db/clicks.ts` (thêm `hasClickToday`; sửa chú thích `ClickInput.visitorHash`)
- Modify: `apps/web/src/routes/go.ts` (hai route, `respondProduct`, `trackProductClick`)
- Modify: `apps/web/src/domain/product-input.ts` (trường `url` dùng `validatePublicUrl`)
- Modify: `apps/web/src/views/ProductPage.tsx` (hai `href`)
- Test: Create `apps/web/test/domain/product-url.test.ts`, `apps/web/test/monetization/go-product.test.ts`, `apps/web/test/product-page-links.test.ts`; Modify `apps/web/test/monetization/go.test.ts` (2 chỗ), `apps/web/test/db/clicks.test.ts`, `apps/web/test/domain/product-input.test.ts`, `apps/web/test/hub/products.test.ts` (một ca)
- Không đổi: `db/products.ts` (dùng `findPublicProductBySlug`: đã lọc `published` + builder `approved` + user `active`, trả `product.builderId`), `db/stats.ts`, migration, `robots.txt` (đã `Disallow: /go/`), `test/architecture.test.ts` (`routes/go.ts` và `db/clicks.ts` đã nằm trong `MONEY_ALLOWED`; `db/stats.ts` KHÔNG import `db/clicks.ts`, nếu import thì test "only allowlisted files" đỏ; chính `go.ts` ghép hai module).

**Interfaces:**
- Consumes (tên thật): `findPublicProductBySlug(db, slug): Promise<ProductWithBuilder | null>` (`.product.{id,builderId,slug,status,demoUrl,websiteUrl}`, `.builderStatus`); `appendUtm`, `isPublicHostname`, `isPrintableAscii`, `hasHttpsPrefix`, `authorityOf`, `isAuthorityClean`, `originError`, `MAX_URL_LENGTH`, `validateFinalUrl` (`domain/offer-url.ts`); `parseSrc`, `localeFromReferer`, `countryOf`, `referrerHost` (`domain/outbound.ts`); `isBotRequest`, `CfLike` (`domain/bot.ts`); `VISITOR_COOKIE`, `parseVisitorCookie`, `hasGpc`, `usableSalt`, `visitorHash`, `shouldCount` (`domain/visitor.ts`); `utcDay` (`domain/stats.ts`); `isStaff(env, user)` (`auth/staff.ts`); `bumpProductStat(db, { productId, day, delta })` (`db/stats.ts`); `recordClick`, `ClickInput` (`db/clicks.ts`); `c.get("user"): SessionUser | null` (đã nạp bởi `sessionMiddleware` cho mọi đường, kể cả `/go/`).
- Produces:
  - `domain/product-url.ts`: `type PublicUrlError = "length" | "chars" | "scheme" | "authority" | "parse" | "userinfo" | "port" | "host"`; `type PublicUrlResult = { ok: true; url: string } | { ok: false; error: PublicUrlError }`; `validatePublicUrl(raw: string): PublicUrlResult`; `PRODUCT_LINK_KINDS = ["demo", "site"] as const`; `type ProductLinkKind`; `type ProductLinkResult = { kind: "redirect"; url: string } | { kind: "not_found"; reason: "not_public" | "missing_url" | "invalid_url" }`; `resolveProductLink(p: { status: string; builderStatus: string; demoUrl: string | null; websiteUrl: string | null }, kind: ProductLinkKind): ProductLinkResult`.
  - `db/clicks.ts`: `hasClickToday(db, { visitorHash: string; productId: string; linkKind: "demo" | "site"; day: string }): Promise<boolean>`.
  - `http/visitor.ts`: `readVisitorCookie(c: Context<AppEnv>): string | null`, `warnNoSaltOnce(): void`, `resetNoSaltWarning(): void` (chỉ cho test).

**Quyết định kỹ thuật** (Reviewer kiểm):
1. **Thứ tự route.** Hono khớp theo thứ tự đăng ký. `/go/p/:slug/demo` có 4 đoạn nên `/go/:merchantSlug` (2 đoạn) không nuốt nó, nhưng catch-all `/go/*` sẽ trả 404 nếu route mới đứng sau. Đặt hai route ngay sau `/go/o/:offerId`. Test thứ tự khẳng định: `/go/p/<slug>/demo` hợp lệ → 302; `/go/p`, `/go/p/`, `/go/p/<slug>`, `/go/p/<slug>/other`, `/go/p/<slug>/demo/extra` → 404 (catch-all); `/go/:merchantSlug` với slug `p` giữ chỗ (`RESERVED_MERCHANT_SLUGS` có `p`).
2. **Chỉ GET ghi.** HEAD vẫn đọc D1 và trả đúng 302/404 nhưng không ghi, không cộng. POST/PUT/DELETE → 405 `Allow: GET, HEAD` do `app.all("/go/*")` có sẵn; POST khác Origin vẫn 403 do `originCheck` chạy trước.
3. **Không tin gì từ query ngoài `src`.** Đích chỉ từ `products.demo_url`/`website_url`; `Location` = `appendUtm(validatePublicUrl(raw).url)`, tức `new URL(raw).href` đã kiểm hai lượt rồi thêm `utm_source=vnx.si&utm_medium=referral` (không thêm nếu đã có `utm_*` ở bất kỳ chữ hoa/thường, như `appendUtm` của EPIC 21).
4. **`validatePublicUrl` (M4)** = phần lõi của `check` trừ bước allowlist (R2). Refactor `domain/offer-url.ts`, KHÔNG đổi hành vi: export `validatePublicUrl(raw): { ok: true; url } | { ok: false; error: Exclude<UrlError, "not_allowed"> }` (cùng hai lượt kiểm); `check(raw, allowed)` = lõi đó + `hostAllowed`. `domain/product-url.ts` re-export `validatePublicUrl` và giữ `resolveProductLink`. Test EPIC 21 (`offer-url`, `go`) bảo vệ refactor; test "đồng ý với `validateFinalUrl` trên cả bộ dữ liệu" giữ làm kiểm hồi quy. Click `/go/p/` không cookie hợp lệ → `visitor_hash = null` → không đếm (Reviewer ruling 2026-10-05, Owner FYI). Luật: ≤ 2048 ký tự; chỉ ASCII in được, không `\`, không khoảng trắng/CR/LF; tiền tố đúng `https://` chữ thường; authority sạch (không `@`, `%`, `{}`); `new URL` phân tích được; không userinfo; cổng rỗng (`:443` bị parser bỏ, `:8443` bị từ chối); `isPublicHostname` (từ chối IPv4 mọi dạng, IPv6, `localhost`, tên một nhãn, dấu chấm cuối); `href` kiểm lại lần hai phải y hệt. Hệ quả: tên miền Unicode phải nhập dạng punycode (`xn--…`), giống offer ở EPIC 21.
5. **Editor lưu chữ đã cắt khoảng trắng như cũ (`v`), chỉ KIỂM bằng `validatePublicUrl`; không ghi `href` vào DB.** Ghi `href` thêm dấu `/` cuối (`https://x.example` → `https://x.example/`), khiến so sánh `demoUrl !== product.demoUrl` ở `routes/hub-products.tsx:117` thu hồi nhầm huy hiệu `demo_verified` khi builder lưu lại cùng một link (và làm lệch dữ liệu đã có). Redirect luôn dùng `href` đã chuẩn hóa nên "host đang lưu là host được redirect" (ADR-007 luật 7) vẫn đúng. Chuỗi lỗi `product.error.url` giữ nguyên, không khóa i18n mới.
6. **Dedupe click, race nêu rõ.** Một lần mỗi (`visitor_hash`, `product_id`, `link_kind`) mỗi ngày UTC. Truy vấn chạy TRƯỚC khi ghi dòng click mới (ghi trước thì dòng vừa ghi tự biến lượt này thành "trùng") và dùng đủ 4 cột của `idx_clicks_visitor (visitor_hash, product_id, link_kind, created_at)`:
   `SELECT 1 FROM outbound_clicks WHERE visitor_hash = ?1 AND product_id = ?2 AND link_kind = ?3 AND created_at >= ?4 AND created_at < ?5 LIMIT 1`, với `?4 = day` (`YYYY-MM-DD` luôn nhỏ hơn mọi `YYYY-MM-DDT…` cùng ngày) và `?5` = ngày kế tiếp. **Sai số chấp nhận:** hai request đồng thời của cùng một người, product, loại (bấm đúp, hai tab) đều thấy "chưa có" và cùng cộng, tức đếm thừa tối đa 1 mỗi cú bấm đồng thời; không khóa. Không thể làm nguyên tử trong một `db.batch` mà giữ đúng ranh giới: câu "đã có chưa" phải đọc `outbound_clicks` (bảng tiền: cấm với `db/stats.ts` theo test kiến trúc) hoặc câu cộng phải ghi `product_daily_stats` từ `db/clicks.ts` (sai chủ sở hữu bảng). Không thêm bảng dedupe thứ hai cho click (quyết định thiết kế 5).
   Dòng của bot/GPC/không cookie/không salt có `visitor_hash = null` nên không bao giờ khớp. Dòng của builder chủ và đội nội bộ CÓ hash (nếu có cookie) và sẽ chặn lượt đếm sau của chính người đó trong ngày kể cả khi họ đăng xuất: hiếm, đúng hướng (đếm thiếu), ghi nhận.
7. **Luật đếm (M2, M3, L4, câu hỏi (f)).** `visitor_hash` chỉ có khi: không bot, không GPC, có `ANALYTICS_SALT` dùng được, và cookie `__Host-vnx_vid` hợp lệ; ngược lại `null` (dòng click vẫn ghi). Cộng `product_daily_stats` khi và chỉ khi `hash !== null` VÀ `shouldCount(...)` VÀ lượt đầu của ngày. `isStaff` chỉ gọi khi đã có `hash` và có người dùng đăng nhập (sau mọi kiểm tra rẻ). Bảng sự thật:

   | Tình huống | Dòng `outbound_clicks` | `visitor_hash` | `product_daily_stats` |
   |---|---|---|---|
   | Bot (UA hoặc `verifiedBot`) | có, `is_bot = 1` | null | không |
   | `Sec-GPC: 1` | có | null | không |
   | Thiếu/trắng `ANALYTICS_SALT` (M3) | có | null | không; `console.warn` MỘT lần mỗi isolate |
   | Có salt, KHÔNG có cookie hợp lệ | có | null | không |
   | Builder chủ product, hoặc `isStaff` | có | có (nếu có cookie) | không |
   | Khách thường, cookie hợp lệ, lần đầu trong ngày | có | có | `demo`: `demo_clicks + 1` và `outbound_clicks + 1`; `site`: `outbound_clicks + 1` |
   | Lặp lại cùng (khách, product, loại) cùng ngày UTC | có | có | không |
   | Sang ngày UTC mới | có | có (hash mới) | cộng lại |
   | Click offer (`/go/o/`, `/go/:merchant`) | có (`link_kind = offer`) | null | KHÔNG BAO GIỜ |

   **Đã quyết (Reviewer ruling 2026-10-05, Owner FYI; không còn là câu hỏi mở).** Bản nháp cũ của Task 4 (và quyết định 4) viết "có salt nhưng không cookie → cộng mọi lần không-bot". Task này theo chỉ dẫn mới của Controller: KHÔNG cộng khi thiếu cookie. Lý do: `/go/p/` không đặt cookie (M2) nên không biết được lượt đầu, và đếm mọi lần cho phép một vòng lặp `curl` giả UA trình duyệt thổi phồng `demo_clicks` (trọng số ×2 trong điểm Trending, câu hỏi (f)); khách thật đến từ `/p/:slug` luôn đã có cookie sau Task 3. Hệ quả: (a) trình duyệt chặn cookie không bao giờ được đếm click (đếm thiếu; khác `views`, nơi quyết định 4 đếm thừa); (b) TRƯỚC khi Task 3 chạy không ai có cookie nên `visitor_hash` luôn null, không click nào cộng thống kê, và câu Privacy "for now we do not link it…" vẫn đúng, không đổi Privacy ở task này. **Triển khai (R1): `ANALYTICS_SALT` là công tắc bật đếm trên production. Task 4 được phép deploy trước Task 3, nhưng Owner KHÔNG được đặt `ANALYTICS_SALT` trên production cho tới ngày Task 3 + Privacy cùng lên.** Không salt thì `visitor_hash` luôn null kể cả với cookie do người dùng tự gửi, nên Privacy không bị vi phạm. Trong khoảng đó mỗi isolate ghi một dòng `visitor.no_salt` (đã dự kiến, không phải lỗi). Câu này lặp lại ở "Nghĩa vụ để lại", "Sau M7" và ghi chú `wrangler.jsonc`.
8. **Ghi click không bao giờ làm hỏng redirect.** Toàn bộ phần ghi (kiểm dedupe, dòng click, cộng thống kê) nằm trong `trackProductClick`, chạy qua `defer` (`waitUntil`; không có ExecutionContext thì chờ, như EPIC 21). Mỗi bước tự `try/catch` và `console.error` (`go.click_failed` có sẵn, `go.stat_failed`, `go.dedupe_failed`). Lỗi kiểm dedupe → coi như trùng (đếm thiếu, không thừa). Dòng click được ghi TRƯỚC khi cộng thống kê và không phụ thuộc nó (migration `0014` chưa áp chỉ làm mất số đếm, không mất dòng click).
9. **Dữ liệu hỏng và đầu vào sai.** `demo_url` = `http://…`, `//evil.com`, IP, userinfo, có `\`/CR/LF → 404 + `console.error` `{ event: "go.corrupt_data", reason: "product_url_invalid", productId, linkKind, requestId }`, không ghi click. Product không public hoặc thiếu URL → 404 im lặng, không ghi click. Slug sai dạng hoặc có chữ hoa → 404 TRƯỚC khi đọc D1 (không chuyển hướng về chữ thường: đường này không phải trang và không có locale).
10. **Truy vấn kiểm toán dữ liệu hiện có (M4)** ở Step 11; task chỉ chạy trên D1 local để kiểm cú pháp, và dán nguyên văn vào `.ai/tasks/VNX-0707b-report.md` để Owner chạy trước deploy.

- [ ] **Step 1: Test `product-url` (fail)**

`apps/web/test/domain/product-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateFinalUrl } from "../../src/domain/offer-url.ts";
import { PRODUCT_LINK_KINDS, resolveProductLink, validatePublicUrl, type PublicUrlError } from "../../src/domain/product-url.ts";

const GOOD = ["https://demo.example", "https://www.example.com/app?x=1#top", "https://sub.example.co.uk/a/b/", "https://EXAMPLE.com/Path", "https://example.com:443/", "https://xn--bcher-kva.example/", "https://demo.example/%0d%0a"];
const BAD: [string, PublicUrlError][] = [
  ["", "chars"], ["http://demo.example", "scheme"], ["//evil.com", "scheme"], ["HTTPS://demo.example", "scheme"], ["https:evil.com", "scheme"], ["javascript:alert(1)", "scheme"], ["ftp://demo.example", "scheme"],
  ["https://127.0.0.1/", "host"], ["https://2130706433/", "host"], ["https://0x7f.1/", "host"], ["https://[::1]/", "host"], ["https://localhost/", "host"], ["https://a.localhost/", "host"], ["https://intranet/", "host"], ["https://demo.example./", "host"],
  ["https://u@evil.com/", "authority"], ["https://u:p@evil.com/", "authority"], ["https://demo.example:8443/", "port"], ["https://demo.example:80/", "port"],
  ["https://evil.com\\@demo.example/", "chars"], ["https://demo.example/\r\nSet-Cookie: a=b", "chars"], ["https://demo.example/a b", "chars"], ["https://demo.example/\u0000", "chars"], ["https://bücher.example/", "chars"], ["https://demo.example。evil.com/", "chars"],
  ["https://demo%2eexample/", "authority"], ["https://{x}.example/", "authority"], [`https://demo.example/${"a".repeat(2100)}`, "length"],
];

describe("validatePublicUrl (M4): https only, no userinfo, public host, empty port", () => {
  it.each(GOOD)("accepts %s and returns new URL(raw).href", (raw) => {
    expect(validatePublicUrl(raw)).toEqual({ ok: true, url: new URL(raw).href });
  });
  it.each(BAD)("rejects %j", (raw, error) => {
    expect(validatePublicUrl(raw)).toEqual({ ok: false, error });
  });
  it("is idempotent: the href validates to itself", () => {
    for (const raw of GOOD) {
      const first = validatePublicUrl(raw);
      expect(first.ok && validatePublicUrl(first.url)).toEqual(first);
    }
  });
  it("agrees with validateFinalUrl (EPIC 21) on every row once that host is allowed", () => {
    for (const raw of [...GOOD, ...BAD.map(([r]) => r)]) {
      let hosts: string[] = [];
      try { hosts = [new URL(raw).hostname]; } catch { hosts = []; }
      expect(validatePublicUrl(raw).ok, raw).toBe(validateFinalUrl(raw, hosts).ok);
    }
  });
});

describe("resolveProductLink", () => {
  const p = { status: "published", builderStatus: "approved", demoUrl: "https://demo.example/app", websiteUrl: "https://www.example.com/?ref=1" };
  it("lists exactly demo and site", () => expect(PRODUCT_LINK_KINDS).toEqual(["demo", "site"]));
  it("redirects to the normalized URL plus UTM", () => {
    expect(resolveProductLink(p, "demo")).toEqual({ kind: "redirect", url: "https://demo.example/app?utm_source=vnx.si&utm_medium=referral" });
    expect(resolveProductLink(p, "site")).toEqual({ kind: "redirect", url: "https://www.example.com/?ref=1&utm_source=vnx.si&utm_medium=referral" });
  });
  it("does not add UTM when any utm_* is already present", () => {
    expect(resolveProductLink({ ...p, demoUrl: "https://demo.example/?UTM_Campaign=x" }, "demo")).toEqual({ kind: "redirect", url: "https://demo.example/?UTM_Campaign=x" });
  });
  it("is not_found unless the product is published and its builder approved", () => {
    for (const status of ["draft", "in_review", "changes_requested", "unlisted", "suspended", "archived"]) expect(resolveProductLink({ ...p, status }, "demo")).toEqual({ kind: "not_found", reason: "not_public" });
    for (const builderStatus of ["pending", "rejected", "suspended"]) expect(resolveProductLink({ ...p, builderStatus }, "demo")).toEqual({ kind: "not_found", reason: "not_public" });
  });
  it("is missing_url for null or empty, invalid_url for a corrupt value", () => {
    expect(resolveProductLink({ ...p, demoUrl: null }, "demo")).toEqual({ kind: "not_found", reason: "missing_url" });
    expect(resolveProductLink({ ...p, websiteUrl: "" }, "site")).toEqual({ kind: "not_found", reason: "missing_url" });
    for (const bad of ["http://demo.example", "//evil.com", "https://127.0.0.1/", "https://u@evil.com/", "https://demo.example/\r\nX: y"]) {
      expect(resolveProductLink({ ...p, demoUrl: bad }, "demo")).toEqual({ kind: "not_found", reason: "invalid_url" });
    }
  });
  it("reads demo from demoUrl and site from websiteUrl, never the other", () => {
    expect(resolveProductLink({ ...p, demoUrl: null }, "site").kind).toBe("redirect");
    expect(resolveProductLink({ ...p, websiteUrl: null }, "demo").kind).toBe("redirect");
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/product-url.test.ts` → FAIL (`domain/product-url.ts` chưa có). Nếu một mã lỗi trong `BAD` khác hành vi thật của `validateFinalUrl` (cùng thứ tự kiểm), sửa MÃ trong bảng; điều kiện cứng là `ok: false`, KHÔNG nới luật.

- [ ] **Step 2: `validatePublicUrl` trong `offer-url.ts` (refactor, R2) và `domain/product-url.ts` (impl)**

`apps/web/src/domain/offer-url.ts`: thay hàm `check` hiện có bằng lõi dùng chung, rồi `check` gọi lõi. KHÔNG đổi hành vi của `validateFinalUrl`, `fillAndValidate`, `parseTemplate` (test `offer-url`, `offer`, `merchant`, `go` của EPIC 21 là rào chắn). Tìm `function check(raw: string, allowed: readonly string[]): UrlResult {` và thay cả hàm bằng:

```ts
export type PublicUrlError = Exclude<UrlError, "not_allowed">;
export type PublicUrlResult = { ok: true; url: string } | { ok: false; error: PublicUrlError };

/** One pass of every rule except the host allowlist. */
function checkPublic(raw: string): PublicUrlResult {
  const fail = (error: PublicUrlError): PublicUrlResult => ({ ok: false, error });
  if (raw.length > MAX_URL_LENGTH) return fail("length");
  if (!isPrintableAscii(raw)) return fail("chars");
  if (!hasHttpsPrefix(raw)) return fail("scheme");
  if (!isAuthorityClean(authorityOf(raw))) return fail("authority");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("parse");
  }
  if (url.protocol !== "https:") return fail("parse");
  const origin = originError(url);
  if (origin) return fail(origin);
  if (!isPublicHostname(url.hostname)) return fail("host");
  return { ok: true, url: url.href };
}

/**
 * The gate for a product's demo and website URL (M7 ruling M4): every rule of `validateFinalUrl` except the allowlist, with the same double
 * pass. On success `url` is `new URL(raw).href`, checked again.
 */
export function validatePublicUrl(raw: string): PublicUrlResult {
  const first = checkPublic(raw);
  if (!first.ok) return first;
  const second = checkPublic(first.url);
  if (!second.ok) return second;
  return second.url === first.url ? second : { ok: false, error: "parse" };
}

function check(raw: string, allowed: readonly string[]): UrlResult {
  const core = checkPublic(raw);
  if (!core.ok) return core;
  return hostAllowed(new URL(core.url).hostname, allowed) ? core : { ok: false, error: "not_allowed" };
}
```

(`validateFinalUrl` no longer needs changing: it still calls `check` twice and compares.) `apps/web/src/domain/product-url.ts`:

```ts
import { appendUtm, validatePublicUrl } from "./offer-url.ts";

export { validatePublicUrl, type PublicUrlError, type PublicUrlResult } from "./offer-url.ts";

export const PRODUCT_LINK_KINDS = ["demo", "site"] as const;
export type ProductLinkKind = (typeof PRODUCT_LINK_KINDS)[number];
export type ProductLinkResult = { kind: "redirect"; url: string } | { kind: "not_found"; reason: "not_public" | "missing_url" | "invalid_url" };

/** Where /go/p/:slug/{demo,site} goes. The destination comes only from the stored URL, never from the request. Pure: no Hono, no D1. */
export function resolveProductLink(p: { status: string; builderStatus: string; demoUrl: string | null; websiteUrl: string | null }, kind: ProductLinkKind): ProductLinkResult {
  if (p.status !== "published" || p.builderStatus !== "approved") return { kind: "not_found", reason: "not_public" };
  const raw = kind === "demo" ? p.demoUrl : p.websiteUrl;
  if (raw === null || raw === "") return { kind: "not_found", reason: "missing_url" };
  const valid = validatePublicUrl(raw);
  return valid.ok ? { kind: "redirect", url: appendUtm(valid.url) } : { kind: "not_found", reason: "invalid_url" };
}
```

Chạy lại Step 1 → PASS, rồi `npm test -w apps/web -- test/domain/offer-url.test.ts test/domain/offer.test.ts test/domain/merchant.test.ts test/monetization/go.test.ts` → PASS (refactor không đổi hành vi).

- [ ] **Step 3: Test `hasClickToday` (fail)**

Thêm vào `apps/web/test/db/clicks.test.ts` (dùng `click()`, `NOW`, `testEnv` sẵn có; thêm `hasClickToday, CLICK_TODAY_SQL` vào import):

```ts
describe("hasClickToday (VNX-0707b: one count per visitor, product, kind, UTC day)", () => {
  const H = (c: string) => c.repeat(64);
  const key = { visitorHash: H("a"), productId: "clicks-prod-a", linkKind: "demo" as const, day: "2026-10-05" };
  const seed = (o: Partial<ClickInput>) => recordClick(testEnv.DB, click({ offerId: null, productId: key.productId, linkKind: "demo", visitorHash: key.visitorHash, ...o }));

  it("is false with no row, true with a row that day, false for the day before and after", async () => {
    expect(await hasClickToday(testEnv.DB, key)).toBe(false);
    await seed({ createdAt: "2026-10-05T00:00:00.000Z" });
    expect(await hasClickToday(testEnv.DB, key)).toBe(true);
    expect(await hasClickToday(testEnv.DB, { ...key, day: "2026-10-04" })).toBe(false);
    expect(await hasClickToday(testEnv.DB, { ...key, day: "2026-10-06" })).toBe(false);
  });
  it("includes the last millisecond of the day and excludes the first of the next", async () => {
    await seed({ visitorHash: H("b"), createdAt: "2026-10-05T23:59:59.999Z" });
    expect(await hasClickToday(testEnv.DB, { ...key, visitorHash: H("b") })).toBe(true);
    await seed({ visitorHash: H("c"), createdAt: "2026-10-06T00:00:00.000Z" });
    expect(await hasClickToday(testEnv.DB, { ...key, visitorHash: H("c") })).toBe(false);
  });
  it("is keyed by visitor, product and link kind", async () => {
    await seed({ visitorHash: H("d"), createdAt: "2026-10-05T10:00:00.000Z" });
    const k = { ...key, visitorHash: H("d") };
    expect(await hasClickToday(testEnv.DB, k)).toBe(true);
    expect(await hasClickToday(testEnv.DB, { ...k, linkKind: "site" })).toBe(false);
    expect(await hasClickToday(testEnv.DB, { ...k, productId: "other" })).toBe(false);
    expect(await hasClickToday(testEnv.DB, { ...k, visitorHash: H("e") })).toBe(false);
  });
  it("uses idx_clicks_visitor", async () => {
    const plan = await testEnv.DB.prepare(`EXPLAIN QUERY PLAN ${CLICK_TODAY_SQL}`)
      .bind("x", "y", "demo", "2026-10-05", "2026-10-06").all<{ detail: string }>();
    expect(plan.results.map((r) => r.detail).join(" ")).toContain("idx_clicks_visitor");
  });
});
```

Chạy `npm test -w apps/web -- test/db/clicks.test.ts` → FAIL.

- [ ] **Step 4: `hasClickToday` (impl)**

`apps/web/src/db/clicks.ts`, sau `recordClick`; đổi chú thích `ClickInput.visitorHash` thành "Null unless a visitor cookie, a usable salt, no GPC and no bot (VNX-0707b); never set for offers.":

```ts
/**
 * "This visitor already clicked this product link today (UTC)": the de-duplication read behind product_daily_stats (routes/go.ts joins
 * it to db/stats.ts; this file owns the table). Run it BEFORE recording the new click. The hash must be non-null. It uses all four columns
 * of idx_clicks_visitor. Two simultaneous clicks of one visitor may both see "no": routes/go.ts collapses those within one isolate.
 */

/** The dedupe query, exported so the index test can EXPLAIN exactly this text. */
export const CLICK_TODAY_SQL = "SELECT 1 AS hit FROM outbound_clicks WHERE visitor_hash = ?1 AND product_id = ?2 AND link_kind = ?3 AND created_at >= ?4 AND created_at < ?5 LIMIT 1";

export async function hasClickToday(db: D1Database, input: { visitorHash: string; productId: string; linkKind: "demo" | "site"; day: string }): Promise<boolean> {
  const next = new Date(Date.parse(`${input.day}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
  const row = await db
    .prepare(CLICK_TODAY_SQL)
    .bind(input.visitorHash, input.productId, input.linkKind, input.day, next)
    .first<{ hit: number }>();
  return row !== null;
}
```

Chạy lại → PASS.

- [ ] **Step 5: Test `/go/p/` (fail)**

`apps/web/test/monetization/go-product.test.ts` (khung `call` sao chép từ `go.test.ts`, không export từ đó). Salt và cookie tiêm tường minh: `testEnv` không có salt (ca "thiếu salt" dùng nó). Ca ở sát nửa đêm UTC có thể chớp (hash tính theo `new Date()` của test và của route); chấp nhận.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { recordClick } from "../../src/db/clicks.ts";
import { utcDay } from "../../src/domain/stats.ts";
import { visitorHash } from "../../src/domain/visitor.ts";
import type { Bindings } from "../../src/env.ts";
import { resetNoSaltWarning } from "../../src/http/visitor.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeLiveProduct, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const UTM = "utm_source=vnx.si&utm_medium=referral";
const SALT = "go-product-test-salt-00000000000000";
const ENV = { ...testEnv, ANALYTICS_SALT: SALT } as Bindings;
const VID = "0123456789abcdef0123456789abcdef";
const VID2 = "fedcba9876543210fedcba9876543210";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const EVIL = "evil.example.net";
const DEMO = "https://demo.example/app";
const SITE = "https://www.example.com/?ref=1";
const ZERO = { views: 0, demo_clicks: 0, outbound_clicks: 0, inquiries: 0 };

type Call = { method?: string; headers?: Record<string, string>; cf?: Record<string, unknown>; env?: Bindings };
async function call(path: string, o: Call = {}): Promise<Response> {
  const req = new Request(`https://vnx.si${path}`, { method: o.method ?? "GET", headers: o.headers });
  if (o.cf) Object.defineProperty(req, "cf", { value: o.cf });
  return await createApp().request(req, undefined, o.env ?? ENV);
}
/** A real browser carrying the visitor cookie (what Task 3 will set); `cookie` replaces the whole Cookie header. */
const visitor = (vid = VID, extra: Record<string, string> = {}) => ({ "user-agent": CHROME, cookie: `__Host-vnx_vid=${vid}`, ...extra });

let seq = 0;
async function live(fields: { demoUrl?: string | null; websiteUrl?: string | null } = { demoUrl: DEMO, websiteUrl: SITE }) {
  const email = `gp${++seq}@vnx.si`;
  const { builder, product } = await makeLiveProduct(email, `gp${seq}`, `gp${seq} product`, { fields });
  return { email, builder, product, slug: product.slug };
}
const clicks = async (productId: string) => (await testEnv.DB.prepare("SELECT * FROM outbound_clicks WHERE product_id = ?1 ORDER BY id").bind(productId).all<Record<string, unknown>>()).results;
const stat = async (productId: string) => (await testEnv.DB.prepare("SELECT views, demo_clicks, outbound_clicks, inquiries FROM product_daily_stats WHERE product_id = ?1").bind(productId).first<Record<string, number>>()) ?? ZERO;
const count = async (table: string) => (await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? 0;

beforeEach(() => resetNoSaltWarning());
afterEach(() => vi.restoreAllMocks());

describe("route order (the /go/* catch-all stays last)", { timeout: 30_000 }, () => {
  it("a valid /go/p/<slug>/{demo,site} is a 302, not swallowed by the catch-all", async () => {
    const { slug } = await live();
    expect((await call(`/go/p/${slug}/demo`)).status).toBe(302);
    expect((await call(`/go/p/${slug}/site`)).status).toBe(302);
  });
  it.each(["/go/p", "/go/p/", "/go/p/some-product", "/go/p/some-product/other", "/go/p/some-product/demo/extra", "/go/p//demo"])("%s stays a 404 from the catch-all", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("404 cases write nothing", { timeout: 30_000 }, () => {
  it("unknown, malformed and upper-case slugs", async () => {
    const { slug } = await live();
    const before = await count("outbound_clicks");
    for (const path of ["/go/p/does-not-exist/demo", "/go/p/-x-/demo", "/go/p/a/demo", `/go/p/${slug.toUpperCase()}/demo`, "/go/p/%00/demo", "/go/p/..%2f/demo"]) {
      const res = await call(path, { headers: visitor() });
      expect(res.status, path).toBe(404);
      expect(res.headers.get("location"), path).toBeNull();
    }
    expect(await count("outbound_clicks")).toBe(before);
  });
  it("a product that is not published, or whose builder is not approved", async () => {
    const { product, slug, builder } = await live();
    for (const status of ["draft", "in_review", "changes_requested", "unlisted", "suspended", "archived"]) {
      await testEnv.DB.prepare("UPDATE products SET status = ?2 WHERE id = ?1").bind(product.id, status).run();
      expect((await call(`/go/p/${slug}/demo`, { headers: visitor() })).status, status).toBe(404);
    }
    await testEnv.DB.prepare("UPDATE products SET status = 'published' WHERE id = ?1").bind(product.id).run();
    for (const status of ["pending", "rejected", "suspended"]) {
      await testEnv.DB.prepare("UPDATE builders SET status = ?2 WHERE user_id = ?1").bind(builder.userId, status).run();
      expect((await call(`/go/p/${slug}/demo`, { headers: visitor() })).status, status).toBe(404);
    }
    expect(await clicks(product.id)).toHaveLength(0);
  });
  it("a missing URL is a 404 for that kind only", async () => {
    const { product, slug } = await live({ demoUrl: null, websiteUrl: SITE });
    expect((await call(`/go/p/${slug}/demo`)).status).toBe(404);
    expect((await call(`/go/p/${slug}/site`)).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
  });
  it.each(["http://demo.example/", "//evil.com", "https://127.0.0.1/", "https://u@evil.com/", "https://demo.example:8443/", "https://demo.example/a\\b", "https://demo.example/a\r\nSet-Cookie: x=y"])("a corrupt stored URL %j is a 404 with console.error and no click", async (bad) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    await testEnv.DB.prepare("UPDATE products SET demo_url = ?2 WHERE id = ?1").bind(product.id, bad).run();
    const res = await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(spy.mock.calls.map((c) => String(c[0])).some((l) => l.includes("go.corrupt_data") && l.includes("product_url_invalid"))).toBe(true);
    expect(await clicks(product.id)).toHaveLength(0);
  });
});

describe("the redirect", { timeout: 30_000 }, () => {
  it("302 to the normalized URL plus UTM, with the headers", async () => {
    const { slug } = await live();
    const demo = await call(`/go/p/${slug}/demo?src=product_page`);
    expect(demo.status).toBe(302);
    expect(demo.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    expect(demo.headers.get("cache-control")).toBe("no-store");
    expect(demo.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(demo.headers.get("referrer-policy")).toBe("origin");
    expect((await call(`/go/p/${slug}/site`)).headers.get("location")).toBe(`https://www.example.com/?ref=1&${UTM}`);
  });
  it("adds no UTM when the stored URL already has any utm_*", async () => {
    const { product, slug } = await live();
    await testEnv.DB.prepare("UPDATE products SET demo_url = 'https://demo.example/?UTM_Campaign=x' WHERE id = ?1").bind(product.id).run();
    expect((await call(`/go/p/${slug}/demo`)).headers.get("location")).toBe("https://demo.example/?UTM_Campaign=x");
  });
  it("Location comes from the database only: ?url=, ?src=<url>, ?to=//host change nothing", async () => {
    const { product, slug } = await live();
    const res = await call(`/go/p/${slug}/demo?url=https://${EVIL}/&src=https://${EVIL}/&to=//${EVIL}`);
    expect(res.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    expect((await clicks(product.id))[0]?.src).toBe("unknown");
  });
  it("stores src from the enum, the locale of the Referer page, and no IP, e-mail or user id", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo?src=product_page`, { headers: { "user-agent": CHROME, referer: `https://vnx.si/vi/p/${slug}` }, cf: { country: "VN" } });
    const [row] = await clicks(product.id);
    expect(row).toMatchObject({ link_kind: "demo", src: "product_page", locale: "vi", offer_id: null, country: "VN", referrer_host: "vnx.si", is_bot: 0, visitor_hash: null });
    expect(Object.keys(row!).sort()).toEqual(["country", "created_at", "id", "is_bot", "link_kind", "locale", "offer_id", "product_id", "referrer_host", "src", "visitor_hash"]);
  });
  it("HEAD redirects and records nothing; POST/PUT/DELETE are 405 with Allow: GET, HEAD; a foreign Origin is 403", async () => {
    const { product, slug } = await live();
    const head = await call(`/go/p/${slug}/demo`, { method: "HEAD", headers: visitor() });
    expect(head.status).toBe(302);
    expect(head.headers.get("location")).toBe(`${DEMO}?${UTM}`);
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await call(`/go/p/${slug}/demo`, { method, headers: { origin: "https://vnx.si" } });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
    }
    expect((await call(`/go/p/${slug}/demo`, { method: "POST", headers: { origin: `https://${EVIL}` } })).status).toBe(403);
    expect(await clicks(product.id)).toHaveLength(0);
    expect(await stat(product.id)).toEqual(ZERO);
  });
  it("sets no cookie (M2: /go/p/ only reads it)", async () => {
    const { slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: { "user-agent": CHROME } })).headers.get("set-cookie")).toBeNull();
  });
});

describe("counting truth table (spec 8.11, M3, L4)", { timeout: 30_000 }, () => {
  it("a normal visitor with the cookie: demo adds demo_clicks and outbound_clicks, site adds outbound_clicks; the row carries the day hash", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
    await call(`/go/p/${slug}/site`, { headers: visitor() });
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 2 });
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.visitor_hash).toBe(await visitorHash(SALT, utcDay(new Date()), VID));
    expect(rows[0]?.visitor_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["a bot user agent", { headers: { "user-agent": "curl/8.5.0", cookie: `__Host-vnx_vid=${VID}` } }],
    ["an empty user agent", { headers: { "user-agent": "", cookie: `__Host-vnx_vid=${VID}` } }],
    ["a Cloudflare verified bot", { headers: visitor(), cf: { botManagement: { verifiedBot: true } } }],
    ["Sec-GPC: 1", { headers: visitor(VID, { "sec-gpc": "1" }) }],
    ["no ANALYTICS_SALT", { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: undefined } as Bindings }],
    ["a blank ANALYTICS_SALT", { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: "   " } as Bindings }],
    ["no cookie", { headers: { "user-agent": CHROME } }],
    ["a malformed cookie", { headers: { "user-agent": CHROME, cookie: "__Host-vnx_vid=not-hex" } }],
  ] as [string, Call][])("%s: the click row is written with a null hash, product_daily_stats is untouched", async (_name, o) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { product, slug } = await live();
    const before = await count("product_daily_stats");
    expect((await call(`/go/p/${slug}/demo`, o)).status).toBe(302);
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visitor_hash).toBeNull();
    expect(await stat(product.id)).toEqual(ZERO);
    expect(await count("product_daily_stats")).toBe(before);
    // M3: a missing or blank salt warns exactly once per isolate (the warning is reset in beforeEach).
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("visitor.no_salt"))).toHaveLength(_name.includes("ANALYTICS_SALT") ? 1 : 0);
  });

  it("marks bot rows is_bot = 1", async () => {
    const { product, slug } = await live();
    await call(`/go/p/${slug}/demo`, { headers: { "user-agent": "Googlebot/2.1", cookie: `__Host-vnx_vid=${VID}` } });
    expect((await clicks(product.id))[0]?.is_bot).toBe(1);
  });

  it("the product's own builder is not counted (row written)", async () => {
    const { product, slug, email } = await live();
    const { cookie } = await signIn(email);
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(VID, { cookie: `${cookie}; __Host-vnx_vid=${VID}` }) })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(await stat(product.id)).toEqual(ZERO);
  });

  it("staff (admin listed in ADMIN_EMAILS) is not counted; a signed-in ordinary user is", async () => {
    const a = await live();
    const admin = await signIn("owner@vnx.si", { admin: true });
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID, { cookie: `${admin.cookie}; __Host-vnx_vid=${VID}` }) });
    expect(await stat(a.product.id)).toEqual(ZERO);
    const user = await signIn("gp-plain@vnx.si");
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID2, { cookie: `${user.cookie}; __Host-vnx_vid=${VID2}` }) });
    expect(await stat(a.product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
  });

  it("the same visitor, product and kind counts once per UTC day; another visitor, kind or product counts separately", async () => {
    const a = await live();
    const b = await live();
    for (let i = 0; i < 3; i++) await call(`/go/p/${a.slug}/demo`, { headers: visitor() });
    expect(await stat(a.product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
    expect(await clicks(a.product.id)).toHaveLength(3);
    await call(`/go/p/${a.slug}/demo`, { headers: visitor(VID2) });
    await call(`/go/p/${b.slug}/demo`, { headers: visitor() });
    expect((await stat(a.product.id)).demo_clicks).toBe(2);
    expect((await stat(b.product.id)).demo_clicks).toBe(1);
  });

  it("counts again on a new UTC day (a row from yesterday does not dedupe today)", async () => {
    const { product, slug } = await live();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await recordClick(testEnv.DB, { id: ulid(Date.parse(yesterday)), productId: product.id, offerId: null, linkKind: "demo", src: "unknown", locale: "en", visitorHash: await visitorHash(SALT, utcDay(new Date()), VID), country: null, referrerHost: null, isBot: false, createdAt: yesterday });
    await call(`/go/p/${slug}/demo`, { headers: visitor() });
    expect((await stat(product.id)).demo_clicks).toBe(1);
  });

  it("warns once per isolate when ANALYTICS_SALT is missing, and still redirects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { slug } = await live();
    for (let i = 0; i < 3; i++) expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...testEnv, ANALYTICS_SALT: undefined } as Bindings })).status).toBe(302);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("visitor.no_salt"))).toHaveLength(1);
  });

  /** The real D1 except that `prepare` throws for any SQL containing `match`. */
  const breakDb = (match: string) =>
    new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare") return (sql: string) => { if (sql.includes(match)) throw new Error(`${match} unavailable`); return target.prepare(sql); };
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  const logged = (spy: { mock: { calls: unknown[][] } }, event: string) => spy.mock.calls.some((c) => String(c[0]).includes(event));

  it("a failing stats write never breaks the redirect or loses the click row", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...ENV, DB: breakDb("product_daily_stats") } as Bindings })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(logged(error, "go.stat_failed")).toBe(true);
  });

  it("a failing dedupe read: 302, one click row, stats untouched, go.dedupe_failed logged (L6)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    expect((await call(`/go/p/${slug}/demo`, { headers: visitor(), env: { ...ENV, DB: breakDb("SELECT 1 AS hit") } as Bindings })).status).toBe(302);
    expect(await clicks(product.id)).toHaveLength(1);
    expect(await stat(product.id)).toEqual(ZERO);
    expect(logged(error, "go.dedupe_failed")).toBe(true);
  });

  it("a throwing staff check never rejects the tracker (M2): 302, one row with the hash, stats untouched, go.count_failed logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { product, slug } = await live();
    const admin = await signIn("owner@vnx.si", { admin: true });
    const env = { ...ENV } as Bindings;
    Object.defineProperty(env, "ADMIN_EMAILS", { get() { throw new Error("staff lookup failed"); } });
    const res = await call(`/go/p/${slug}/demo`, { headers: visitor(VID, { cookie: `${admin.cookie}; __Host-vnx_vid=${VID}` }), env });
    expect(res.status).toBe(302);
    const rows = await clicks(product.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visitor_hash).toBe(await visitorHash(SALT, utcDay(new Date()), VID));
    expect(await stat(product.id)).toEqual(ZERO);
    expect(logged(error, "go.count_failed")).toBe(true);
  });

  it("two simultaneous first clicks of one visitor count once (S12: in-flight set), three rows are not needed: two rows, one count", async () => {
    const { product, slug } = await live();
    const [a, b] = await Promise.all([call(`/go/p/${slug}/demo`, { headers: visitor() }), call(`/go/p/${slug}/demo`, { headers: visitor() })]);
    expect([a.status, b.status]).toEqual([302, 302]);
    expect(await clicks(product.id)).toHaveLength(2);
    expect(await stat(product.id)).toEqual({ ...ZERO, demo_clicks: 1, outbound_clicks: 1 });
  });
});
describe("offer clicks never touch product_daily_stats (L4)", { timeout: 30_000 }, () => {
  it("/go/o/:id and /go/:merchant, even with a valid visitor cookie, add no product_daily_stats row and keep a null hash", async () => {
    const merchant = await makeMerchant();
    const offer = await makeOffer(merchant, await makeProgram(merchant));
    const before = await count("product_daily_stats");
    expect((await call(`/go/o/${offer.id}`, { headers: visitor() })).status).toBe(302);
    await call(`/go/${merchant.slug}`, { headers: visitor() });
    expect(await count("product_daily_stats")).toBe(before);
    const rows = (await testEnv.DB.prepare("SELECT link_kind, visitor_hash, product_id FROM outbound_clicks WHERE offer_id = ?1").bind(offer.id).all<Record<string, unknown>>()).results;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.link_kind === "offer" && r.visitor_hash === null && r.product_id === null)).toBe(true);
  });
});
```

Ghi chú: `go.test.ts` bật cờ `affiliate` trong `beforeEach` cho ca offer; ca L4 ở trên chỉ cần redirect (cờ tắt vẫn 302 qua nhánh dự phòng của offer). Nếu `/go/${merchant.slug}` cần `setDefaultOffer` mới 302, bỏ lời gọi đó và giữ `/go/o/`. Nếu `UPDATE builders SET status` bị ràng buộc/trigger chặn, dùng `setBuilderStatus` của fixtures. Nếu `signIn(email)` cho builder không khớp `builder.userId` vì `makeBuilder` đã tạo user bằng cùng email, thì chúng khớp (`ensureUser` tái dùng).

Chạy: `npm test -w apps/web -- test/monetization/go-product.test.ts` → FAIL (route chưa có; `http/visitor.ts` chưa có).

- [ ] **Step 6: `http/visitor.ts`**

```ts
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { VISITOR_COOKIE, parseVisitorCookie } from "../domain/visitor.ts";
import type { AppEnv } from "../env.ts";

/** The visitor id from the cookie when it has the exact shape, else null. Reads only: the /go/ routes never set the cookie (M2). */
export function readVisitorCookie(c: Context<AppEnv>): string | null {
  return parseVisitorCookie(getCookie(c, VISITOR_COOKIE) ?? null);
}

let warned = false;
/** One warning per isolate when ANALYTICS_SALT is unset or blank (M3): product views and clicks are then not counted. */
export function warnNoSaltOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(JSON.stringify({ event: "visitor.no_salt", note: "ANALYTICS_SALT is not set: product views and clicks are not counted" }));
}

/** For tests only. */
export function resetNoSaltWarning(): void {
  warned = false;
}
```

- [ ] **Step 7: Routes trong `routes/go.ts` (impl)**

Thêm import: `hasClickToday` (cùng dòng `recordClick`); `findPublicProductBySlug` (`../db/products.ts`); `bumpProductStat` (`../db/stats.ts`); `resolveProductLink`, `type ProductLinkKind` (`../domain/product-url.ts`); `utcDay` (`../domain/stats.ts`); `hasGpc`, `shouldCount`, `usableSalt`, `visitorHash` (`../domain/visitor.ts`); `type OutboundSrc` (từ `../domain/outbound.ts`, cùng dòng import cũ); `isStaff` (`../auth/staff.ts`); `type SessionUser` (`../auth/sessions.ts`); `type Bindings`, (`../env.ts`, cùng dòng `AppEnv`); `type Locale` (`../i18n/locales.ts`); `readVisitorCookie`, `warnNoSaltOnce` (`../http/visitor.ts`). Thêm trước `registerGoRoutes`:

```ts
type ProductClick = {
  now: Date;
  clickId: string;
  productId: string;
  builderId: string;
  kind: ProductLinkKind;
  src: OutboundSrc;
  locale: Locale;
  referer: string | undefined;
  cf: CfLike;
  isBot: boolean;
  isGpc: boolean;
  visitorId: string | null;
  user: SessionUser | null;
};

/** Per isolate: keys (`hash|product|kind`) whose first click is still being recorded. Collapses a double click that lands in the same isolate. */
const inFlight = new Set<string>();

/**
 * The click row first and always; then, only for a counted first click of the day, the product counters. NEVER rejects (M2): everything
 * that decides "count or not" (hash, owner, staff, in-flight, dedupe) sits in one try/catch; on any error it logs `go.count_failed`,
 * counts nothing and still records the click (with the hash if it was computed, null if hashing failed). A redirect never waits on or
 * fails because of statistics (addendum 2.3). `isStaff` runs last, only for a signed-in visitor who is not the product's builder and
 * who already passed every cheap check (a hash exists only without bot, GPC, missing salt or missing cookie).
 */
async function trackProductClick(env: Bindings, t: ProductClick): Promise<void> {
  const day = utcDay(t.now);
  let hash: string | null = null;
  let first = false;
  let key: string | null = null;
  try {
    const salt = usableSalt(env.ANALYTICS_SALT);
    hash = salt !== null && !t.isBot && !t.isGpc && t.visitorId !== null ? await visitorHash(salt, day, t.visitorId) : null;
    if (hash !== null) {
      const own = t.user?.id === t.builderId;
      const staff = !own && t.user ? await isStaff(env, t.user) : false;
      if (shouldCount({ isBot: t.isBot, isStaff: staff, isOwnBuilder: own, isGpc: t.isGpc, hasSalt: true })) {
        const k = `${hash}|${t.productId}|${t.kind}`;
        // Check and add with no await between them, so two requests of one isolate cannot both pass.
        if (!inFlight.has(k)) {
          inFlight.add(k);
          key = k;
          try {
            first = !(await hasClickToday(env.DB, { visitorHash: hash, productId: t.productId, linkKind: t.kind, day }));
          } catch (err) {
            console.error(JSON.stringify({ event: "go.dedupe_failed", productId: t.productId, error: String(err) }));
          }
        }
      }
    }
  } catch (err) {
    first = false;
    console.error(JSON.stringify({ event: "go.count_failed", productId: t.productId, error: String(err) }));
  }
  try {
    await saveClick(env.DB, {
      id: t.clickId,
      productId: t.productId,
      offerId: null,
      linkKind: t.kind,
      src: t.src,
      locale: t.locale,
      visitorHash: hash,
      country: countryOf(t.cf),
      referrerHost: referrerHost(t.referer),
      isBot: t.isBot,
      createdAt: t.now.toISOString(),
    });
    if (!first) return;
    try {
      await bumpProductStat(env.DB, { productId: t.productId, day, delta: t.kind === "demo" ? { demo_clicks: 1, outbound_clicks: 1 } : { outbound_clicks: 1 } });
    } catch (err) {
      console.error(JSON.stringify({ event: "go.stat_failed", productId: t.productId, error: String(err) }));
    }
  } finally {
    if (key !== null) inFlight.delete(key);
  }
}

async function respondProduct(c: Context<AppEnv>, kind: ProductLinkKind): Promise<Response> {
  const slug = c.req.param("slug") ?? "";
  if (!SLUG_RE.test(slug)) return notFound(c);
  const item = await findPublicProductBySlug(c.env.DB, slug);
  if (!item) return notFound(c);
  const result = resolveProductLink({ status: item.product.status, builderStatus: item.builderStatus, demoUrl: item.product.demoUrl, websiteUrl: item.product.websiteUrl }, kind);
  if (result.kind === "not_found") {
    if (result.reason === "invalid_url") {
      console.error(JSON.stringify({ event: "go.corrupt_data", reason: "product_url_invalid", productId: item.product.id, linkKind: kind, requestId: c.get("requestId") }));
    }
    return notFound(c);
  }
  // HEAD is answered by the GET handler (Hono); it must not record or count.
  if (c.req.method === "GET") {
    const now = new Date();
    const url = new URL(c.req.url);
    const referer = c.req.header("referer");
    const cf = c.req.raw.cf as CfLike;
    if (usableSalt(c.env.ANALYTICS_SALT) === null) warnNoSaltOnce();
    await defer(
      c,
      trackProductClick(c.env, {
        now,
        clickId: ulid(now.getTime()),
        productId: item.product.id,
        builderId: item.product.builderId,
        kind,
        src: parseSrc(url.searchParams.get("src")),
        locale: localeFromReferer(referer, url.host),
        referer,
        cf,
        isBot: isBotRequest(c.req.header("user-agent"), cf),
        isGpc: hasGpc(c.req.raw.headers),
        visitorId: readVisitorCookie(c),
        user: c.get("user"),
      }),
    );
  }
  return redirectTo(result.url);
}
```

Trong `registerGoRoutes`, ngay sau `app.get("/go/o/:offerId", …)` và trước `app.get("/go/:merchantSlug", …)`:

```ts
  // M7 (addendum 2.1): product links. Registered before the /go/* catch-all below, which would otherwise 404 them.
  app.get("/go/p/:slug/demo", (c) => respondProduct(c, "demo"));
  app.get("/go/p/:slug/site", (c) => respondProduct(c, "site"));
```

Sửa chú thích catch-all cuối file: bỏ cụm "(including /go/p/…, which is M7's)". Chạy `npm test -w apps/web -- test/monetization/go-product.test.ts test/db/clicks.test.ts` → PASS.

- [ ] **Step 8: Sửa `test/monetization/go.test.ts`**

Tìm bằng `grep -n "go/p/" apps/web/test/monetization/go.test.ts`. Ba chỗ: (1) danh sách "404 before any D1 read" bỏ `"/go/p/some-product/demo"` và `"/go/p/some-product/site"` (giờ phải đọc D1 mới biết product có không; ca tương đương nằm ở `go-product.test.ts`), đổi tên ca thành "(reserved or malformed slug)"; (2) cùng danh sách THÊM `"/go/p/-x-/demo"` và `"/go/p/UPPER-x/demo"` (slug sai dạng/chữ hoa: 404 trước mọi lần đọc D1, `untouchableDb`); (3) ca 405: `"/go/p/x/demo"` → `"/go/p/does-not-exist/demo"` (405 trả trước khi đọc D1 vì chỉ GET có route). Chạy `npm test -w apps/web -- test/monetization/go.test.ts` → PASS.

- [ ] **Step 9: Editor từ chối URL không công khai (test fail, rồi impl)**

`apps/web/test/domain/product-input.test.ts`, thêm trong khối "product step input":

```ts
  it("the demo step accepts only a public https URL, as the redirect does (M4)", () => {
    for (const bad of ["http://spa.example", "//evil.com", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://u@evil.com/", "https://spa.example:8443/", "https://spa.example/a\\b", "javascript:alert(1)", "https://intranet/"]) {
      expect(parseStep("demo", { demoUrl: bad, websiteUrl: "" }), bad).toEqual({ ok: false, errors: { demoUrl: "url" } });
      expect(parseStep("demo", { demoUrl: "", websiteUrl: bad }), bad).toEqual({ ok: false, errors: { websiteUrl: "url" } });
    }
  });
  it("keeps the trimmed text, not the normalized href (a re-save must not look like a change)", () => {
    expect(parseStep("demo", { demoUrl: "  https://spa.example  ", websiteUrl: "https://www.example.com/a?b=1" })).toEqual({ ok: true, fields: { demoUrl: "https://spa.example", websiteUrl: "https://www.example.com/a?b=1" } });
  });
  it("every URL the editor accepts the redirect accepts too", () => {
    for (const ok of ["https://spa.example", "https://spa.example/", "https://a.b.example/x?y=1#z", "https://spa.example:443/"]) {
      expect(parseStep("demo", { demoUrl: ok, websiteUrl: "" }).ok, ok).toBe(true);
      expect(validatePublicUrl(ok).ok, ok).toBe(true);
    }
  });
```

(thêm `import { validatePublicUrl } from "../../src/domain/product-url.ts";`). Trong `test/hub/products.test.ts` cạnh ca dòng ~84 thêm hai khẳng định `expect((await post("demo", { demoUrl: "https://127.0.0.1/", websiteUrl: "" })).status).toBe(400);` và cùng với `"https://u@evil.com/"` ở `websiteUrl`. Chạy → FAIL. Rồi `apps/web/src/domain/product-input.ts`: `import { splitCsv } from "./builder-input.ts";`, `import { validatePublicUrl } from "./product-url.ts";`, và trong `parseField`:

```ts
    case "url":
      if (v === "") return { ok: true, value: null };
      if (v.length > spec.max) return { ok: false, error: "too_long" };
      return validatePublicUrl(v).ok ? { ok: true, value: v } : { ok: false, error: "url" };
```

(`isHttpsUrl` vẫn dùng ở builder-input, portfolio, offer: KHÔNG xóa.) Chạy `npm test -w apps/web -- test/domain/product-input.test.ts test/hub/products.test.ts` → PASS. Các ca hiện có (`https://demo.example`, `https://spa.example`, `https://one.example`, `https://new-demo.example`) là host công khai hợp lệ nên không đổi.

- [ ] **Step 10: `ProductPage` đổi link (test fail, rồi impl)**

`apps/web/test/product-page-links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { makeLiveProduct } from "./fixtures.ts";
import { testEnv } from "./helpers.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const anchors = (html: string) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);

describe("ProductPage outbound links (VNX-0707b)", () => {
  it("Demo and Website point at /go/p/<slug>/…?src=product_page with rel nofollow ugc noopener and target _blank, in every locale, and never at the stored URL", async () => {
    const { product } = await makeLiveProduct("ppl-a@vnx.si", "ppl-a", "Ppl A", { fields: { demoUrl: "https://demo.example/app", websiteUrl: "https://www.example.com/" } });
    for (const prefix of ["", "/vi", "/zh-hans", "/zh-hant"]) {
      const html = await (await get(`${prefix}/p/${product.slug}`)).text();
      const tags = anchors(html);
      for (const kind of ["demo", "site"]) {
        const tag = tags.find((t) => t.includes(`href="/go/p/${product.slug}/${kind}?src=product_page"`));
        expect(tag, `${prefix} ${kind}`).toBeDefined();
        expect(tag).toContain('rel="nofollow ugc noopener"');
        expect(tag).toContain('target="_blank"');
      }
      expect(html).not.toContain("https://demo.example/app");
      expect(html).not.toContain('href="https://www.example.com/"');
    }
  });
  it("renders no link for a URL the product does not have", async () => {
    const { product } = await makeLiveProduct("ppl-b@vnx.si", "ppl-b", "Ppl B", { fields: { demoUrl: null, websiteUrl: null } });
    const html = await (await get(`/p/${product.slug}`)).text();
    expect(html).not.toContain(`/go/p/${product.slug}/demo`);
    expect(html).not.toContain(`/go/p/${product.slug}/site`);
  });
});
```

Chạy → FAIL. Sửa `apps/web/src/views/ProductPage.tsx` (khối `row-actions`): `href={`/go/p/${p.slug}/demo?src=product_page`}` và `href={`/go/p/${p.slug}/site?src=product_page`}`; giữ `rel={EXTERNAL}`, `target="_blank"`, `class="btn"` và điều kiện `p.demoUrl ?` / `p.websiteUrl ?`. Chạy → PASS. Kiểm không còn view công khai nào tự dựng link tới URL của product: `grep -n "demoUrl\|websiteUrl" apps/web/src/views/*.tsx apps/web/src/views/json-ld.ts` (trang admin `ProductDetailPage.tsx` cố ý giữ link thật; nếu `json-ld.ts` đưa `websiteUrl` vào `sameAs`/`url`, ghi vào "Ghi nhận" của `CURRENT-STATUS`, không đổi trong task này).

- [ ] **Step 11: Truy vấn kiểm toán dữ liệu hiện có (M4), chạy thử local, dán vào báo cáo**

Dán nguyên văn vào `.ai/tasks/VNX-0707b-report.md`, mục "Việc Owner chạy trước deploy". Danh sách MỌI `demo_url`/`website_url` khác null kèm cờ `suspect` (heuristic gần đúng của `validatePublicUrl`; giá trị lọt qua ở đây vẫn bị redirect từ chối an toàn bằng 404 + `go.corrupt_data`, nên truy vấn dùng để PHÁT HIỆN builder cần sửa, không phải để bảo đảm):

```sql
WITH u AS (
  SELECT id, slug, status, 'demo_url' AS col, demo_url AS url FROM products WHERE demo_url IS NOT NULL AND demo_url <> ''
  UNION ALL
  SELECT id, slug, status, 'website_url', website_url FROM products WHERE website_url IS NOT NULL AND website_url <> ''
), r AS (
  SELECT *, substr(url, 9) AS rest FROM u
), a0 AS (
  SELECT *, substr(rest, 1, min(instr(rest || '/', '/'), instr(rest || '?', '?'), instr(rest || '#', '#')) - 1) AS raw_authority FROM r
), a AS (
  SELECT *, CASE WHEN raw_authority LIKE '%:443' AND instr(raw_authority, '[') = 0 THEN substr(raw_authority, 1, length(raw_authority) - 4) ELSE raw_authority END AS authority FROM a0
)
SELECT id, slug, status, col, url,
  CASE
    WHEN length(url) > 2048 THEN 'length'
    WHEN url GLOB '*[^!-~]*' OR instr(url, char(92)) > 0 THEN 'chars'
    WHEN substr(url, 1, 8) <> 'https://' THEN 'scheme'
    WHEN authority = '' OR instr(authority, '@') > 0 OR instr(authority, '%') > 0 OR instr(authority, '{') > 0 OR instr(authority, '}') > 0 THEN 'authority'
    WHEN instr(authority, ':') > 0 THEN 'port_or_ipv6'
    WHEN instr(authority, '.') = 0 OR substr(authority, -1) = '.' THEN 'host'
    WHEN lower(authority) = 'localhost' OR lower(authority) LIKE '%.localhost' THEN 'host'
    WHEN authority GLOB '*[0-9]' THEN 'maybe_ipv4'
    ELSE NULL
  END AS suspect
FROM a
ORDER BY (suspect IS NULL), status, slug, col;
```

Lưu truy vấn thành một file trong scratchpad (ví dụ `audit-product-urls.sql`) và chạy thử cú pháp trên D1 local: `npx wrangler d1 execute vnxsi --local --file <đường dẫn file>` từ `apps/web` (kết quả rỗng là bình thường). Lệnh cho Owner: cùng câu với `--remote --file …`; mọi dòng có `suspect` khác `NULL` sẽ trả 404 sau deploy (riêng `maybe_ipv4` cần mắt người xem). **Ghi trong báo cáo:** giá trị là tên miền Unicode (IDN) hoặc có tiền tố `HTTPS://` chữ hoa sẽ 404 sau deploy cho tới khi builder lưu lại (editor giờ từ chối chính các giá trị đó); không tự sửa dữ liệu production.

- [ ] **Step 11b: Ghi chú `wrangler.jsonc` (R1)**

Trong chú thích `ANALYTICS_SALT (M7)` thêm một câu: `ANALYTICS_SALT is the production on-switch for counting: do NOT set it in production until Task 3 and the Privacy update go live (until then each isolate logs visitor.no_salt once, which is expected).` Chỉ chú thích, không đổi giá trị.

- [ ] **Step 12: Toàn bộ, typecheck, commit**

```
npm run typecheck -w apps/web
npm test
git add apps/web/src/domain/offer-url.ts apps/web/wrangler.jsonc apps/web/src/domain/product-url.ts apps/web/src/http/visitor.ts apps/web/src/db/clicks.ts apps/web/src/routes/go.ts apps/web/src/domain/product-input.ts apps/web/src/views/ProductPage.tsx apps/web/test/domain/product-url.test.ts apps/web/test/monetization/go-product.test.ts apps/web/test/monetization/go.test.ts apps/web/test/product-page-links.test.ts apps/web/test/db/clicks.test.ts apps/web/test/domain/product-input.test.ts apps/web/test/hub/products.test.ts
git commit -m "feat(web): /go/p/:slug/{demo,site} with click counting and public URL check (VNX-0707b)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí chấp nhận → cách kiểm:**

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `validatePublicUrl` từ chối `http:`, `//evil.com`, IP mọi dạng, userinfo, cổng, `\`, CR/LF, không ASCII, quá dài; trả `href`; đồng ý với `validateFinalUrl` | `npm test -w apps/web -- test/domain/product-url.test.ts` |
| AC2 | Editor và redirect từ chối cùng tập URL; editor lưu chữ đã cắt khoảng trắng, không phải `href` | `npm test -w apps/web -- test/domain/product-input.test.ts test/hub/products.test.ts` |
| AC3 | Hai route đứng trước catch-all; `/go/p`, `/go/p/x`, `/go/p/x/y`, `/go/p/x/demo/z` 404; slug `p` vẫn bị giữ chỗ | `npm test -w apps/web -- test/monetization/go-product.test.ts` (khối "route order") |
| AC4 | Mọi 404 (slug lạ/sai dạng/chữ hoa, product chưa `published`, builder không `approved`, thiếu URL, URL hỏng kèm `console.error`) không ghi click | cùng file, khối "404 cases" |
| AC5 | 302 đủ `Location` (UTM trừ khi có `utm_*`), `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin`; `?url=`/`?src=<url>` bị bỏ qua; HEAD không ghi; 405 `Allow: GET, HEAD`; không `Set-Cookie` | cùng file, khối "the redirect" |
| AC6 | Bảng sự thật (bot, GPC, thiếu/trắng salt, thiếu/sai cookie, builder chủ, staff, khách thường, trùng trong ngày, ngày mới, `console.warn` một lần, lỗi ghi thống kê không làm hỏng redirect) | cùng file, khối "counting truth table" |
| AC7 | Click offer không đổi `product_daily_stats`, hash null | cùng file, khối "offer clicks" |
| AC8 | `hasClickToday` đúng biên ngày, đúng khóa, dùng `idx_clicks_visitor` | `npm test -w apps/web -- test/db/clicks.test.ts` |
| AC9 | `ProductPage` trỏ `/go/p/<slug>/{demo,site}?src=product_page`, `rel="nofollow ugc noopener"`, `target="_blank"`, không lộ URL gốc, 4 locale | `npm test -w apps/web -- test/product-page-links.test.ts` |
| AC10 | EPIC 21 `go.test.ts` xanh sau hai chỉnh sửa; chủ sở hữu bảng không đổi | `npm test -w apps/web -- test/monetization test/architecture.test.ts` |
| AC11 | Truy vấn kiểm toán chạy được trên D1 local và nằm trong báo cáo | `npx wrangler d1 execute vnxsi --local --command "…"` (từ `apps/web`) |
| AC12 | Typecheck sạch, toàn bộ test xanh | `npm run typecheck -w apps/web` và `npm test` |

**Nghĩa vụ để lại.** (Task 3) `http/visitor.ts` đã có `readVisitorCookie`, `warnNoSaltOnce`, `resetNoSaltWarning` (tạo bởi Task 4): Task 3 SỬA file này, không tạo lại, và dùng lại `warnNoSaltOnce` cho `GET /p/:slug`; câu Privacy mới của Task 3 nêu "the record may hold the day-specific code", đúng với dòng click của task này. (Deploy, R1) áp `0014` trước; **`ANALYTICS_SALT` là công tắc bật đếm trên production: Task 4 được deploy trước Task 3, nhưng Owner KHÔNG đặt `ANALYTICS_SALT` trên production cho tới ngày Task 3 + Privacy cùng lên**; trong khoảng đó mỗi isolate log một dòng `visitor.no_salt` (bình thường); Owner chạy truy vấn Step 11 trước deploy (giá trị IDN hoặc `HTTPS://` chữ hoa sẽ 404 sau deploy cho tới khi builder lưu lại). (CURRENT-STATUS) click không cookie không được đếm (Reviewer ruling 2026-10-05, Owner FYI); sai số đồng thời của dedupe chỉ còn khi hai request rơi vào hai isolate khác nhau (trong cùng isolate đã gộp bằng `inFlight`); tên miền Unicode phải nhập punycode. **Ghi nhận (L10):** chuỗi `product.error.url` ("Enter a full https:// address, or leave it empty.") cần một lượt rà 4 locale để nói rõ "công khai, không IP/cổng/tên nội bộ". (Rate limit) Owner thêm rule Cloudflare cho `/go/p/*` (câu hỏi (f), F1).

Diff ước tính ~600 dòng gồm test (mã sản xuất ~200: `product-url.ts` ~55, `go.ts` ~115, `clicks.ts` ~15, `visitor.ts` ~22, nhỏ lẻ ~10; test ~400). Sát giới hạn: nếu vượt 600, tách 4a (Step 1–2, 9: `product-url.ts` + editor, không đổi route) rồi 4b (Step 3–8, 10–12: route, dedupe, `ProductPage`). Không chuỗi giao diện, không locale, không migration.

---

### Task 5: VNX-0702a — Công thức `public_stats`

**Tách đôi (diff ước tính ~1100 dòng, vượt 600): làm theo hai commit, 5a rồi 5b. Hai phần dùng chung một heading, một danh sách "Quyết định" và một checklist.** 5a = domain thuần + test + test kiến trúc F6 (đối chứng dương, regex `/i`) + `domain/public-stats.ts` vào `RANKING_FILES` (~560 dòng). 5b = migration `0016`, `db/public-stats.ts`, `WRITERS`, `db/public-stats.ts` vào `RANKING_FILES` (~540 dòng). Task 6 phụ thuộc cả hai.

**Scope:** (E2, Controller) `inquiries` của Trending và của "Top product" tính từ bảng `inquiries` loại `removed` theo ngày `opened_at`, KHÔNG từ cột `product_daily_stats.inquiries` (cột đó giữ nguyên là bản ghi thô). Trending chỉ đọc `product_daily_stats` (`views`, `demo_clicks`), `inquiries` và các bảng danh mục (ADR-007 luật 2): KHÔNG đọc `outbound_clicks` (đó là bảng tiền trong test kiến trúc; `product_daily_stats.demo_clicks` đã là đếm click sạch của Task 4), không có tham số trả tiền nào (ADR-004). Task này KHÔNG có cron (Task 6), KHÔNG có homepage (Task 7), KHÔNG chọn "thẻ hero" hay "Founding products" (spec không nêu tiêu chí chọn: câu hỏi mở Q1; chặn Task 7, không chặn Task 5).

**Files:**
- Create: `apps/web/src/domain/public-stats.ts` (5a), `apps/web/migrations/0016_public_stats.sql` (5b), `apps/web/src/db/public-stats.ts` (5b)
- Modify: `apps/web/test/architecture.test.ts` (5a: F6, đối chứng, `RANKING_FILES` + `domain/public-stats.ts`; 5b: `WRITERS.public_stats`, `RANKING_FILES` + `db/public-stats.ts`), `apps/web/src/db/catalog.ts` (5b: `export` cho `BADGE_SCORE_SQL`, một chữ `export`, không đổi hành vi), `apps/web/wrangler.jsonc` (5b: ghi chú `0016_public_stats` vào thứ tự deploy)
- Test: `apps/web/test/domain/public-stats.test.ts` (5a), `apps/web/test/db/public-stats.test.ts` (5b), `apps/web/test/architecture.test.ts`

**Interfaces:**
- Consumes (thật, từ code): `utcDay` (`domain/stats.ts`); `CATEGORIES`, `PRODUCT_LANGS`, `Category`, `ProductLang`, `BadgeKind` (`domain/product.ts`); `BADGE_SCORE` (`domain/catalog.ts`); `PUBLIC_PRODUCT` (`db/products.ts`, `p.status = 'published' AND b.status = 'approved' AND u.status = 'active'`, alias `p`, `b`, `u`); `BADGE_SCORE_SQL` (`db/catalog.ts`, được export ở 5b); `bumpProductStat` (`db/stats.ts`, chỉ trong test); fixtures `makeBuilder`, `addLiveProduct`, `makeInquiry`, `makeRequest`, `inviteBuilders`, `ensureUser`, `testEnv`. Hành động audit THẬT: `product.approve` (xuất bản; KHÔNG có `product.publish`, lệch so với bản nháp plan), `badge.grant` (`data.kind`), `builder.approve`, `request.verify` (`data.category`, `data.languages`). Huy hiệu `listed` do hệ thống cấp cùng lần approve và không có dòng `badge.grant`.
- Produces `domain/public-stats.ts` (thuần): `PUBLIC_STAT_KEYS`, `PublicStatKey`, `MIN`, `WEIGHT`, `STALE_AFTER_MS`, `TOP_PRODUCTS_PER_CATEGORY`, `TOP_BUILDERS_LIMIT`, `GROWTH_MAX_WEEKS`, `LIVE_MAX`, các cửa sổ ngày (`TREND_DAYS`, `SPARK_DAYS`, `REQUEST_DAYS`, `BUILDER_DAYS`, `LIVE_DAYS`); `addDays`, `lastDays`, `daysBefore`, `isoWeekStart`, `isoWeek`, `median`; `countStat`, `trendingScore`, `changePercent`, `rankTrending`, `requestByCategory`, `scarcestCategory`, `weeklyGrowth`, `topBuilders`, `topProductsByCategory`, `liveEvents`, `isFresh`, `pickFresh`; các kiểu `TrendingCandidate`, `TrendingItem`, `CategoryCounts`, `CategoryRow`, `ScarcestCategory`, `GrowthPoint`, `BuilderTally`, `TopBuilders`, `ProductCandidate`, `TopProduct`, `LiveEvent`, `PublicStatValues`, `PublicSnapshot`.
- Produces `db/public-stats.ts`: `writePublicStat(db, key, value, now): Promise<void>`, `readPublicStats(db, now): Promise<PublicSnapshot>`; các hàm đọc cho cron `loadCounts`, `loadCategoryCounts`, `loadGrowthDays`, `loadTrendingCandidates`, `loadProductCandidates`, `loadBuilderTallies`, `loadLiveEvents` (mỗi hàm `(db, now: string)`).

**Bảng công thức (nguồn: spec §5.9, §8.11; mọi ngưỡng là hằng trong `MIN`, không số ma thuật nằm rải rác):**

| Key `public_stats` | Công thức | Ngưỡng (n−1 → `null`, n → có) |
|---|---|---|
| `count_products` | product `published` của builder `approved` (và user `active`, đúng `PUBLIC_PRODUCT`) | ≥ 10 |
| `count_builders` | builder `approved` (user `active`) | ≥ 10 |
| `count_requests_30d` | request có `submitted_at` ≥ now − 30 ngày, `status <> 'removed'` | ≥ 10 |
| `count_countries` | `COUNT(DISTINCT country)` của builder `approved` | ≥ 3 |
| `trending` | điểm 7 ngày = `inquiries×5 + demo_clicks×2 + views`; `changePct` so với 7 ngày liền trước; sparkline 14 điểm; 6 điểm cao nhất | điểm ≥ 20; cần ≥ 6 product đủ điểm, ít hơn → `null` |
| `request_by_category` | request 30 ngày theo category; category < 3 request (và `other`) gộp vào "other" cùng số product của chúng | tổng request ≥ 10 |
| `scarcest_category` | category có request/product cao nhất (product 0 = vô cực), KHÔNG chọn `other` | tổng request 30 ngày ≥ 10 và category ≥ 3 request |
| `growth` | product published và builder approved cộng dồn theo tuần ISO | ≥ 4 tuần |
| `top_builders.selected` | lời mời `selected` (request không `removed`) + Inquiry đã trả lời (không `removed` và có tin `message` của builder, bất kể trạng thái hiện tại), 90 ngày lịch | builder ≥ 2; tab cần ≥ 3 builder |
| `top_builders.fast` | trung vị thời gian từ `opened_at`/`invited_at` đến tin trả lời đầu tiên, 90 ngày (phút, làm tròn xuống) | builder ≥ 5 lượt; tab cần ≥ 3 builder |
| `top_builders.verified` | số product `published` có huy hiệu `demo_verified`/`in_production` còn hiệu lực | builder ≥ 1; tab cần ≥ 3 builder |
| `top_products` | theo category: `BADGE_SCORE` giảm dần, rồi Inquiry 30 ngày giảm dần, rồi `published_at` mới nhất, rồi `id`; 3 product | category có ≥ 1 product |
| `live` | sự kiện công khai từ `audit_log` (`product.approve`, `badge.grant`, `builder.approve` hoặc `builder.apply` có `status = approved`, `request.verify` hoặc `request.submit`) trong 7 ngày lịch, mới nhất trước, tối đa 20, không có id | ≥ 5 sự kiện trong 7 ngày |

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Cửa sổ ngày:** 7 ngày = 7 ngày UTC kết thúc ở HÔM NAY (gồm ngày hôm nay chưa trọn); 7 ngày trước đó là 7 ngày liền kề; sparkline = 14 ngày, 7 điểm cuối là kỳ hiện tại. Job chạy `:05` mỗi giờ nên số hôm nay tăng dần trong ngày: chấp nhận (ghi Q2).
2. **Làm tròn:** mọi số làm tròn xuống (`Math.floor`), kể cả % âm (-33,3 → -34): không bao giờ làm đẹp lên. Kỳ trước = 0 → `changePct = null` (không chia 0, giao diện hiện "mới").
3. **Dưới ngưỡng hàm trả `null`; cron ghi `null`** (Task 6); `pickFresh` bỏ khóa `null` và khóa quá 3 giờ. Quá hạn = `now − computed_at > 3 giờ` (đúng 3 giờ vẫn còn mới); `computed_at` không đọc được hoặc ở tương lai vẫn tính là mới nếu hiệu ≤ 3 giờ, không đọc được thì bỏ.
4. **Danh sách hiện công khai chỉ gồm thứ đang công khai:** mọi truy vấn dùng `PUBLIC_PRODUCT` hoặc `b.status = 'approved' AND u.status = 'active'`; sự kiện Live của một product/builder đã bị gỡ khỏi công khai biến mất; huy hiệu đã thu hồi không có trong Live. Request `removed` không đếm ở bất kỳ số liệu nào (cùng tinh thần E2; Q3).
5. **Gộp "other":** category `other` thật cũng gộp vào dòng "other". Dòng "other" xuất hiện khi có request hoặc product bị gộp, luôn đứng cuối; nó chỉ chứa số tổng, không tên category nên không lộ ai cần gì.
6. **Tăng trưởng:** product theo `first_published_at` (chỉ product đang công khai), builder theo `approved_at` (đang `approved`), gom theo ngày ở SQL, tuần ISO ở domain. "Tuần dữ liệu" = số tuần ISO từ tuần của sự kiện đầu tiên đến tuần hiện tại, gồm cả tuần hiện tại chưa trọn (Q4); cộng dồn tính từ đầu, chỉ cắt 52 tuần cuối khi trả (kích thước snapshot).
7. **Top builders:** cửa sổ 90 ngày neo vào mốc BẮT ĐẦU của bản ghi (`inquiries.opened_at`, `request_invites.invited_at`) vì không có thời điểm "answered"/"selected" riêng (Q5). Mẫu "trả lời nhanh": Inquiry có tin đầu tiên của chính builder (kể cả tin `decline`), và lời mời có `responded_at`. Trung vị chẵn = `floor` của trung bình hai số giữa. Mỗi tab giữ tối đa `TOP_BUILDERS_LIMIT = 10`, hòa thì `handle` tăng dần (Q6).
8. **Top product:** hòa cuối cùng theo `id` tăng dần (xác định, không dùng bất kỳ thứ gì có tiền). Product không có category bị bỏ khỏi chip.
9. **Live không đọc nội dung:** SQL chỉ chọn `name`/`slug`/`handle`/`kind`/`category`/`languages`; KHÔNG chọn `audit_log.data` còn lại (có `evidence` của huy hiệu, `note`), tiêu đề, mô tả hay tên khách. `languages` và `category` được lọc lại theo `PRODUCT_LANGS`/`CATEGORIES` trước khi đưa vào snapshot.
10. **Snapshot tin dữ liệu của chính mình:** `pickFresh` chỉ kiểm khóa, JSON hợp lệ và hạn; không kiểm hình dạng từng giá trị (chỉ job của ta ghi, bảng chỉ do `db/public-stats.ts` ghi). Hỏng JSON → khóa bị bỏ.
11. **E2 cho Top product (mở rộng chưa được Controller xác nhận):** dùng cùng truy vấn Inquiry (loại `removed`) cho `inquiries30d` để một Inquiry spam không đẩy xếp hạng ở chỗ nào (Q3).

**Phán quyết của Controller sau review Opus (ràng buộc, thay mặc định cũ):** Q2 hôm nay được tính; MỌI cửa sổ N ngày (7, 14, 30, 90) là N ngày lịch UTC gồm hôm nay, bắt đầu 00:00 UTC (`windowStart`). Q3 `removed` bị loại khỏi MỌI số công khai. Q4 giữ mặc định. Q5 giữ mặc định, cộng đúng chữ spec. Q6 `TOP_BUILDERS_LIMIT = 10`, `published_at` mới nhất trước, `other` không bao giờ là category thiếu supply; `scarcest_category` là `null` khi tổng request 30 ngày < 10. Q1 do Owner, chỉ chặn Task 7. Ngôn ngữ của request là `WORK_LANGUAGES` (`en`, `vi`, `zh`), không phải `PRODUCT_LANGS`. Snapshot `live` không chứa id audit. Tie-break dùng so sánh `<`/`>`, không `localeCompare`. `computed_at` ở tương lai quá 5 phút là cũ. Badge-grant Live khớp `product_verifications.verified_at = audit.created_at`.

**Ghi nhận:** kiểm tra import tiền chỉ theo đường dẫn trực tiếp; import gián tiếp qua `db/products.ts` không được kiểm.

**Câu hỏi mở (đã phán quyết ở trên, giữ để truy vết; dùng mặc định ghi trên, không chặn Task 5):** Q1 tiêu chí chọn 3 thẻ hero và "Founding products" (số lượng, thứ tự): spec không nêu, Task 5 KHÔNG tạo key nào cho hai khối này (chặn Task 7). Q2 cửa sổ 7/14 ngày có gồm hôm nay không. Q3 `removed` có loại ở Request 30 ngày và Top product (E2 chỉ nói `inquiries_7d`). Q4 "≥ 4 tuần dữ liệu" tính từ sự kiện đầu hay tuần lịch gần nhất, và có gồm tuần chưa trọn. Q5 mốc 90 ngày của "được chọn"/"trả lời nhanh" và việc `selected` + `answered` có thể đếm đôi (lời mời được chọn tạo Inquiry `request` rồi trả lời) vì spec cộng thẳng. Q6 số dòng tối đa mỗi tab Top builders (spec không nêu), hướng sắp `published_at` (mặc định mới nhất trước), category `other` có được là "thiếu supply" không (mặc định có, theo chữ spec).

---

#### Phần 5a: domain thuần, test kiến trúc F6

- [ ] **Step 1: Test kiến trúc đỏ trước (F6 + đối chứng dương)**

Trong `apps/web/test/architecture.test.ts` thay hai bài kiểm "ranking files import no monetization db module" và "ranking files have no SQL on a money table" và phần quét toàn `src` ("only allowlisted files…") bằng các hàm dùng chung, rồi thêm đối chứng. Chèn ngay trước `describe("ranking never reads money…")`:

```ts
/** Resolves a relative import specifier against the importing file's key (both in the `../src/...` form of import.meta.glob). */
function resolveSpec(file: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const parts = file.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === ".." && parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
/**
 * True when `src` (the file `file`) imports the monetization db module `name` (ADR-007 rule 2): `import … from`, side-effect `import "x"`,
 * `export … from` and dynamic `import("x")`, with the path resolved relative to `file` so a sibling `./offers.ts` from a db file is caught.
 * Indirect imports (through db/products.ts, say) are not followed; see "Ghi nhận".
 */
function importsMoneyDb(file: string, src: string, name: string): boolean {
  const target = `../src/db/${name}.ts`;
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) if (resolveSpec(file, m[1] ?? "") === target) return true;
  return false;
}
/** True when `src` runs SQL on money table `table`. Case-insensitive: lower-case SQL must not slip past (review F6). */
const touchesMoneyTable = (src: string, table: string) => new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, "i").test(src);
```

Trong các bài kiểm hiện có đổi `.not.toMatch(new RegExp(...))` thành `expect(importsMoneyDb(file, sources[file]!, name), \`${file} imports db/${name}\`).toBe(false)` và `expect(touchesMoneyTable(sources[file]!, table), \`${file} reads ${table}\`).toBe(false)` (cả ba nơi, kể cả vòng `Object.entries(sources)` ngoài danh sách cho phép). Thêm bài mới trong cùng `describe`:

```ts
it("the detectors catch what they are meant to catch (positive control, review F6)", () => {
  expect(importsMoneyDb("../src/domain/x.ts", `import { listOffers } from "../db/offers.ts";`, "offers")).toBe(true);
  expect(importsMoneyDb("../src/db/x.ts", `import { y } from "./offers.ts";`, "offers")).toBe(true); // sibling import inside src/db
  expect(importsMoneyDb("../src/db/x.ts", `import "./offers.ts";`, "offers")).toBe(true); // side-effect import
  expect(importsMoneyDb("../src/db/x.ts", `export * from './clicks.ts'`, "clicks")).toBe(true);
  expect(importsMoneyDb("../src/db/x.ts", `export { y } from "./clicks.ts";`, "clicks")).toBe(true);
  expect(importsMoneyDb("../src/routes/x.ts", `const m = await import("../db/merchants.ts");`, "merchants")).toBe(true);
  expect(importsMoneyDb("../src/db/x.ts", `import { y } from "./stats.ts";`, "offers")).toBe(false);
  expect(importsMoneyDb("../src/db/x.ts", `import { y } from "../domain/offers.ts";`, "offers")).toBe(false);
  for (const sql of ["SELECT * FROM offers", "select * from offers", "select 1 join OUTBOUND_CLICKS c", "insert into Merchants (id) values (1)", "update partner_programs set x = 1"]) {
    expect(MONEY_TABLES.some((t) => touchesMoneyTable(sql, t)), sql).toBe(true);
  }
  expect(MONEY_TABLES.some((t) => touchesMoneyTable("SELECT * FROM product_daily_stats JOIN products", t))).toBe(false);
});

it("a ranking file that imports db/offers.ts would fail the ranking check (simulated)", () => {
  const fake = { ...sources, "../src/domain/public-stats.ts": `${sources["../src/domain/public-stats.ts"] ?? ""}\nimport { x } from "../db/offers.ts";` };
  expect(MONEY_DB.some((name) => importsMoneyDb("../src/domain/public-stats.ts", fake["../src/domain/public-stats.ts"]!, name))).toBe(true);
  expect(MONEY_DB.some((name) => importsMoneyDb("../src/domain/public-stats.ts", sources["../src/domain/public-stats.ts"] ?? "", name))).toBe(false);
});

it("the public statistics files are ranking files and mention no money (ADR-004, review L3)", () => {
  for (const file of ["../src/domain/public-stats.ts"]) {
    expect(RANKING_FILES, file).toContain(file);
    expect(sources[file] ?? "", file).not.toMatch(/sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|price|outbound_clicks/i);
  }
});
```

Thêm `"../src/domain/public-stats.ts"` vào cuối `RANKING_FILES` (kèm chú thích: Task 5a). Chạy: `npm test -w apps/web -- test/architecture.test.ts` → FAIL: `lists only files that exist` (file chưa có) và `MONEY_TABLES.some` có thể đỏ nếu comment nào trong `src/` có chữ thường kiểu `from offers`: nếu có, SỬA CÂU CHỮ của comment đó (không nới regex), ghi vào báo cáo.

- [ ] **Step 2: Test domain đỏ**

`apps/web/test/domain/public-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MIN, STALE_AFTER_MS, FUTURE_SKEW_MS, addDays, changePercent, countStat, isFresh, isoWeek, isoWeekStart, lastDays, liveEvents, median, pickFresh,
  rankTrending, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, trendingScore, weeklyGrowth,
  type BuilderTally, type LiveEvent, type ProductCandidate, type TrendingCandidate,
} from "../../src/domain/public-stats.ts";

const NOW = "2026-10-05T12:05:00.000Z";

describe("thresholds are the spec's (spec §8.11)", () => {
  it("MIN holds exactly the spec numbers", () => {
    expect(MIN).toEqual({ products: 10, builders: 10, requests30d: 10, countries: 3, trendingScore: 20, trendingItems: 6, categoryTotal: 10, categoryRequests: 3, scarcestRequests: 3, growthWeeks: 4, selected: 2, fastSamples: 5, verified: 1, tabBuilders: 3, liveEvents: 5 });
  });
});

describe("countStat: below n → null, at n and above → the number", () => {
  it.each([[9, null], [10, 10], [11, 11]])("products %i", (n, want) => expect(countStat(n, MIN.products)).toBe(want));
  it.each([[2, null], [3, 3], [4, 4]])("countries %i", (n, want) => expect(countStat(n, MIN.countries)).toBe(want));
  it("0 is below any threshold", () => expect(countStat(0, 10)).toBeNull());
});

describe("trending", () => {
  it("scores inquiries × 5 + demo_clicks × 2 + views (hand example: 2, 3, 4 → 20)", () => {
    expect(trendingScore({ inquiries: 2, demoClicks: 3, views: 4 })).toBe(20);
    expect(trendingScore({ inquiries: 0, demoClicks: 0, views: 0 })).toBe(0);
    expect(trendingScore({ inquiries: 1, demoClicks: 0, views: 0 })).toBe(5);
    expect(trendingScore({ inquiries: 0, demoClicks: 1, views: 0 })).toBe(2);
  });

  it("percent change rounds down, never up, and is null when the previous 7 days are 0", () => {
    expect(changePercent(0, 10)).toBeNull();
    expect(changePercent(3, 4)).toBe(33); // 33.33 → 33
    expect(changePercent(3, 5)).toBe(66); // 66.67 → 66, not 67
    expect(changePercent(10, 10)).toBe(0);
    expect(changePercent(3, 2)).toBe(-34); // -33.33 → -34 (floor)
    expect(changePercent(4, 0)).toBe(-100);
  });

  const day = (n: number) => addDays("2026-10-05", -n);
  const cand = (id: string, daily: TrendingCandidate["daily"]): TrendingCandidate => ({ productId: id, slug: id, name: id, tagline: "t", category: "booking", builderHandle: "h", builderName: "H", daily });
  // `views` on today only: the score of the current 7 days is `views`.
  const scored = (id: string, views: number, prevViews = 0) => cand(id, { [day(0)]: { views }, [day(7)]: { views: prevViews } });

  it("a product needs 20 points: 19 is out, 20 and 21 are in; fewer than 6 in → null", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) => scored(id, 100));
    expect(rankTrending([...five, scored("f", 19)], NOW)).toBeNull();
    expect(rankTrending([...five, scored("f", 20)], NOW)?.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(rankTrending([...five, scored("f", 21)], NOW)).toHaveLength(6);
    expect(rankTrending(five, NOW)).toBeNull(); // 5 eligible < 6
  });

  it("keeps the top 6 by score, ties by product id, with sparkline and change", () => {
    const list = ["g", "f", "e", "d", "c", "b", "a"].map((id, i) => scored(id, 30 + i, 10));
    const top = rankTrending(list, NOW)!;
    expect(top).toHaveLength(6);
    expect(top.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]); // views 36 … 31; "g" (30) is cut
    expect(top[0]!.score).toBeGreaterThanOrEqual(top[5]!.score);
    const tie = rankTrending(["b", "a", "d", "c", "f", "e"].map((id) => scored(id, 25)), NOW)!;
    expect(tie.map((i) => i.productId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    const one = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => scored(id, 25, 20)), NOW)![0]!;
    expect(one.score).toBe(25);
    expect(one.previousScore).toBe(20);
    expect(one.changePct).toBe(25);
    expect(one.sparkline).toHaveLength(14);
    expect(one.sparkline[13]).toBe(25); // today is the last point
    expect(one.sparkline[6]).toBe(20); // 7 days ago
    expect(one).not.toHaveProperty("daily");
  });

  it("day 6 is the oldest day of the current window and day 7 the newest of the previous one", () => {
    const [it0] = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => cand(id, { [day(6)]: { views: 20 }, [day(7)]: { views: 5 } })), NOW)!;
    expect(it0!.score).toBe(20);
    expect(it0!.previousScore).toBe(5);
  });

  it("days outside the 14 are ignored; a missing day counts as 0", () => {
    const [it0] = rankTrending(["a", "b", "c", "d", "e", "f"].map((id) => cand(id, { [day(0)]: { views: 20 }, [day(14)]: { views: 999 } })), NOW)!;
    expect(it0!.score).toBe(20);
    expect(it0!.previousScore).toBe(0);
  });
});

describe("requestByCategory", () => {
  it("is null below 10 requests in total, shown at 10", () => {
    expect(requestByCategory({ booking: 9 }, {})).toBeNull();
    expect(requestByCategory({ booking: 10 }, { booking: 2 })).toEqual([{ category: "booking", requests: 10, products: 2 }]);
  });
  it("a category with 2 requests folds into other; with 3 it keeps its name", () => {
    expect(requestByCategory({ booking: 8, crm: 2 }, { booking: 1, crm: 4 })).toEqual([
      { category: "booking", requests: 8, products: 1 },
      { category: "other", requests: 2, products: 4 },
    ]);
    expect(requestByCategory({ booking: 7, crm: 3 }, {})!.map((r) => r.category)).toEqual(["booking", "crm"]);
  });
  it("folds the real other category and categories that only have products, and never names a small one", () => {
    const rows = requestByCategory({ booking: 6, other: 3, hr: 1, finance: 2 }, { hr: 1, education: 5 })!;
    expect(rows).toEqual([{ category: "booking", requests: 6, products: 0 }, { category: "other", requests: 6, products: 6 }]);
    expect(JSON.stringify(rows)).not.toMatch(/hr|finance|education/);
  });
  it("orders by requests then category order, other last; no empty other row", () => {
    const rows = requestByCategory({ crm: 4, booking: 4, finance: 4 }, {})!;
    expect(rows.map((r) => r.category)).toEqual(["booking", "crm", "finance"]);
  });
});

describe("scarcestCategory", () => {
  it("is null when the 30-day request total is under 10, even if a category has 3 requests", () => {
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 3 }, {})).toBeNull(); // total 9
    expect(scarcestCategory({ booking: 4, crm: 3, hr: 3 }, { booking: 1, crm: 1, hr: 1 })).toEqual({ category: "booking", requests: 4, products: 1 }); // total 10
  });
  it("needs 3 requests in the category: 2 never wins, even with no product at all", () => {
    expect(scarcestCategory({ booking: 2, crm: 8 }, { crm: 4 })).toEqual({ category: "crm", requests: 8, products: 4 });
  });
  it("highest requests per product wins; zero products beats any ratio; ties by requests then category order", () => {
    expect(scarcestCategory({ booking: 6, crm: 6 }, { booking: 3, crm: 2 })!.category).toBe("crm"); // 2 vs 3 per product
    expect(scarcestCategory({ booking: 30, crm: 3 }, { booking: 1, crm: 0 })!.category).toBe("crm");
    expect(scarcestCategory({ booking: 6, crm: 3, hr: 1 }, { booking: 2, crm: 1 })!.category).toBe("booking"); // 3 vs 3: more requests
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 4 }, { booking: 1, crm: 1, hr: 100 })!.category).toBe("booking"); // full tie: category order
    expect(scarcestCategory({ booking: 3, crm: 3, hr: 4 }, {})!.category).toBe("hr"); // all infinite: more requests
    expect(scarcestCategory({ booking: 4, crm: 4, hr: 2 }, {})!.category).toBe("booking");
  });
  it("never chooses the other category", () => {
    expect(scarcestCategory({ other: 9, booking: 3 }, {})!.category).toBe("booking");
    expect(scarcestCategory({ other: 12 }, {})).toBeNull();
  });
});

describe("ISO weeks", () => {
  it.each([
    ["2026-01-01", "2026-W01"], ["2025-12-29", "2026-W01"], ["2027-01-01", "2026-W53"], ["2020-12-31", "2020-W53"],
    ["2021-01-03", "2020-W53"], ["2021-01-04", "2021-W01"], ["2024-12-30", "2025-W01"], ["2026-10-05", "2026-W41"], ["2026-10-11", "2026-W41"], ["2026-10-12", "2026-W42"],
  ])("%s is %s", (day, want) => expect(isoWeek(day)).toBe(want));
  it("the week starts on Monday", () => {
    expect(isoWeekStart("2026-10-05")).toBe("2026-10-05");
    expect(isoWeekStart("2026-10-11")).toBe("2026-10-05");
    expect(isoWeekStart("2026-01-01")).toBe("2025-12-29");
  });
  it("lastDays ends today (UTC) and has n days", () => {
    expect(lastDays("2026-10-05T23:59:59.999Z", 3)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(lastDays("2026-03-01T00:00:00.000Z", 2)).toEqual(["2026-02-28", "2026-03-01"]);
  });
});

describe("weeklyGrowth", () => {
  it("needs 4 ISO weeks: first event in week W-2 (3 weeks incl. current) → null; W-3 → 4 points", () => {
    expect(weeklyGrowth({ products: { "2026-09-21": 1 }, builders: {} }, NOW)).toBeNull(); // W39, W40, W41
    const g = weeklyGrowth({ products: { "2026-09-14": 1 }, builders: {} }, NOW)!; // W38 .. W41
    expect(g.map((p) => p.week)).toEqual(["2026-W38", "2026-W39", "2026-W40", "2026-W41"]);
  });
  it("is null with no data at all", () => expect(weeklyGrowth({ products: {}, builders: {} }, NOW)).toBeNull());
  it("accumulates both series from the first week, empty weeks keep the total", () => {
    const g = weeklyGrowth({ products: { "2026-09-14": 2, "2026-09-30": 1 }, builders: { "2026-09-21": 3 } }, NOW)!;
    expect(g).toEqual([
      { week: "2026-W38", products: 2, builders: 0 },
      { week: "2026-W39", products: 2, builders: 3 },
      { week: "2026-W40", products: 3, builders: 3 },
      { week: "2026-W41", products: 3, builders: 3 },
    ]);
  });
  it("crosses the year boundary by ISO week and keeps at most 52 weeks while still counting older ones", () => {
    const g = weeklyGrowth({ products: { "2025-12-29": 1, "2024-01-01": 5 }, builders: {} }, "2026-01-12T00:00:00.000Z")!;
    expect(g).toHaveLength(52);
    expect(g.at(-1)).toEqual({ week: "2026-W03", products: 6, builders: 0 });
    const small = weeklyGrowth({ products: { "2025-12-22": 1 }, builders: {} }, "2026-01-12T00:00:00.000Z")!;
    expect(small.map((p) => p.week)).toEqual(["2025-W52", "2026-W01", "2026-W02", "2026-W03"]);
  });
  it("ignores events dated after now", () => {
    expect(weeklyGrowth({ products: { "2026-09-14": 1, "2026-11-01": 9 }, builders: {} }, NOW)!.at(-1)!.products).toBe(1);
  });
});

describe("median", () => {
  it("odd, even (floor of the mean of the middle two), single, unsorted", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2])).toBe(1);
    expect(median([1, 4, 2, 3])).toBe(2);
    expect(median([7])).toBe(7);
  });
});

describe("topBuilders (spec §8.11): tab thresholds 2 / 5 / 1 and 3 builders per tab", () => {
  const b = (handle: string, o: Partial<BuilderTally> = {}): BuilderTally => ({ userId: handle, handle, name: handle.toUpperCase(), selected: 0, answered: 0, replyMinutes: [], verified: 0, ...o });
  const many = (n: number, o: (i: number) => Partial<BuilderTally>) => Array.from({ length: n }, (_, i) => b(`b${i}`, o(i)));

  it("selected: a builder needs selected + answered ≥ 2 (1 out, 2 in); the tab needs 3 builders", () => {
    const three = (v: number) => many(3, () => ({ selected: v }));
    expect(topBuilders(three(1))).toBeNull();
    expect(topBuilders(three(2))!.selected).toHaveLength(3);
    expect(topBuilders([...many(2, () => ({ selected: 5 })), b("x", { selected: 1 })])).toBeNull(); // only 2 eligible
    expect(topBuilders([b("a", { selected: 1, answered: 1 }), b("b", { answered: 2 }), b("c", { selected: 2 })])!.selected!.map((e) => e.value)).toEqual([2, 2, 2]);
  });
  it("fast: a builder needs 5 samples (4 out, 5 in); median ascending; the tab needs 3 builders", () => {
    const three = (n: number) => many(3, (i) => ({ replyMinutes: Array.from({ length: n }, () => 10 + i) }));
    expect(topBuilders(three(4))).toBeNull();
    const fast = topBuilders(three(5))!.fast!;
    expect(fast.map((e) => [e.handle, e.value])).toEqual([["b0", 10], ["b1", 11], ["b2", 12]]);
  });
  it("verified: a builder needs 1 verified product (0 out, 1 in); the tab needs 3 builders", () => {
    expect(topBuilders(many(3, () => ({ verified: 0 })))).toBeNull();
    expect(topBuilders(many(2, () => ({ verified: 1 })))).toBeNull();
    expect(topBuilders(many(3, (i) => ({ verified: 1 + i })))!.verified!.map((e) => e.value)).toEqual([3, 2, 1]);
  });
  it("hides only the tabs that fail; shows the rest; ties by handle; at most 10 rows", () => {
    const list = [...many(11, () => ({ verified: 2 })), b("zed", { selected: 2 })];
    const out = topBuilders(list)!;
    expect(out.selected).toBeNull();
    expect(out.fast).toBeNull();
    expect(out.verified).toHaveLength(10);
    expect(out.verified!.map((e) => e.handle)).toEqual(["b0", "b1", "b10", "b2", "b3", "b4", "b5", "b6", "b7", "b8"]);
  });
  it("exposes only handle, name and value", () => {
    expect(Object.keys(topBuilders(many(3, () => ({ verified: 1 })))!.verified![0]!).sort()).toEqual(["handle", "name", "value"]);
  });
});

describe("topProductsByCategory", () => {
  const p = (id: string, o: Partial<ProductCandidate> = {}): ProductCandidate => ({ id, slug: id, name: id, category: "booking", builderHandle: "h", builderName: "H", badgeScore: 1, inquiries30d: 0, publishedAt: "2026-09-01T00:00:00.000Z", ...o });
  it("orders by badge, then 30-day inquiries, then newest published, then id; 3 per category", () => {
    const out = topProductsByCategory([
      p("old", { publishedAt: "2026-08-01T00:00:00.000Z" }), p("new"), p("insured", { inquiries30d: 1 }), p("gold", { badgeScore: 3 }), p("silver", { badgeScore: 2 }),
    ])!;
    expect(out.booking!.map((x) => x.id)).toEqual(["gold", "silver", "insured"]);
    expect(topProductsByCategory([p("b"), p("a")])!.booking!.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("only categories with a product; uncategorised are skipped; none → null", () => {
    expect(Object.keys(topProductsByCategory([p("a"), p("b", { category: "crm" })])!)).toEqual(["booking", "crm"]);
    expect(topProductsByCategory([p("a", { category: null })])).toBeNull();
    expect(topProductsByCategory([])).toBeNull();
  });
});

describe("liveEvents: 7 calendar days, newest first, at most 20, hidden under 5", () => {
  const ev = (n: number, ageMs: number): LiveEvent => ({ id: String(n).padStart(4, "0"), kind: "builder_approved", at: new Date(Date.parse(NOW) - ageMs).toISOString(), builderName: `B${n}`, handle: `b${n}` });
  const START = Date.parse("2026-09-29T00:00:00.000Z"); // first of the 7 days ending 2026-10-05
  const atMs = (n: number, ms: number): LiveEvent => ({ ...ev(n, 0), at: new Date(ms).toISOString() });
  it("4 events in 7 days → null; 5 → shown", () => {
    expect(liveEvents([1, 2, 3, 4].map((n) => ev(n, n * 1000)), NOW)).toBeNull();
    expect(liveEvents([1, 2, 3, 4, 5].map((n) => ev(n, n * 1000)), NOW)).toHaveLength(5);
  });
  it("00:00 UTC of the 7th day counts, one millisecond earlier does not", () => {
    const four = [1, 2, 3, 4].map((n) => ev(n, n * 1000));
    expect(liveEvents([...four, atMs(9, START)], NOW)).toHaveLength(5);
    expect(liveEvents([...four, atMs(9, START - 1)], NOW)).toBeNull();
  });
  it("caps at 20, newest first, ignores events after now, and carries no id", () => {
    const out = liveEvents([...Array.from({ length: 25 }, (_, n) => ev(n, (n + 1) * 1000)), ev(99, -1000)], NOW)!;
    expect(out).toHaveLength(20);
    expect(out[0]).toMatchObject({ builderName: "B0" });
    for (const e of out) expect(e).not.toHaveProperty("id");
  });
  it("ties on time go by id descending", () => {
    expect(liveEvents([1, 2, 3, 4, 5].map((n) => ev(n, 1000)), NOW)!.map((e) => (e as { builderName: string }).builderName)).toEqual(["B5", "B4", "B3", "B2", "B1"]);
  });
});

describe("snapshot freshness (stale after 3 hours)", () => {
  const at = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();
  it("exactly 3 hours old is still fresh, 1 ms more is stale", () => {
    expect(STALE_AFTER_MS).toBe(3 * 60 * 60 * 1000);
    expect(isFresh(at(STALE_AFTER_MS), NOW)).toBe(true);
    expect(isFresh(at(STALE_AFTER_MS + 1), NOW)).toBe(false);
    expect(isFresh(at(0), NOW)).toBe(true);
    expect(isFresh("garbage", NOW)).toBe(false);
  });
  it("a time more than 5 minutes ahead of now is not trusted", () => {
    expect(isFresh(at(-FUTURE_SKEW_MS), NOW)).toBe(true);
    expect(isFresh(at(-FUTURE_SKEW_MS - 1), NOW)).toBe(false);
  });
  it("keeps fresh non-null keys, drops stale, null, unknown and corrupt ones", () => {
    const snap = pickFresh(
      [
        { key: "count_products", value: "12", computedAt: at(60_000) },
        { key: "count_builders", value: "11", computedAt: at(STALE_AFTER_MS + 1) },
        { key: "count_countries", value: "null", computedAt: at(60_000) },
        { key: "count_requests_30d", value: "{oops", computedAt: at(60_000) },
        { key: "not_a_key", value: "1", computedAt: at(60_000) },
      ],
      NOW,
    );
    expect(snap).toEqual({ count_products: { value: 12, computedAt: at(60_000) } });
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/public-stats.test.ts` → FAIL (module không tồn tại).

- [ ] **Step 3: Domain**

`apps/web/src/domain/public-stats.ts`:

```ts
import type { WorkLanguage } from "./builder.ts";
import { CATEGORIES, type BadgeKind, type Category } from "./product.ts";
import { utcDay } from "./stats.ts";

/** Public statistics of the homepage (spec §8.11): every formula and threshold. Pure: no Hono, no D1. Nothing here reads money (ADR-004, ADR-007 rule 2). */

export const PUBLIC_STAT_KEYS = ["count_products", "count_builders", "count_requests_30d", "count_countries", "trending", "request_by_category", "scarcest_category", "growth", "top_builders", "top_products", "live"] as const;
export type PublicStatKey = (typeof PUBLIC_STAT_KEYS)[number];

/** Spec §8.11 thresholds. A value below its threshold is `null`, never a smaller number. */
export const MIN = {
  products: 10, builders: 10, requests30d: 10, countries: 3,
  trendingScore: 20, trendingItems: 6,
  categoryTotal: 10, categoryRequests: 3, scarcestRequests: 3,
  growthWeeks: 4,
  selected: 2, fastSamples: 5, verified: 1, tabBuilders: 3,
  liveEvents: 5,
} as const;
/** Trending score weights. */
export const WEIGHT = { inquiries: 5, demoClicks: 2, views: 1 } as const;
export const TREND_DAYS = 7;
export const SPARK_DAYS = 14;
export const REQUEST_DAYS = 30;
export const BUILDER_DAYS = 90;
export const LIVE_DAYS = 7;
export const LIVE_MAX = 20;
export const TOP_PRODUCTS_PER_CATEGORY = 3;
/** Not in the spec (question Q6). */
export const TOP_BUILDERS_LIMIT = 10;
/** Size bound of the stored growth series, not a spec number. */
export const GROWTH_MAX_WEEKS = 52;
/** Spec plan: a block hides when its snapshot is older than 3 hours. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
/** A snapshot time more than this ahead of `now` is not trusted (clock skew only). */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 86_400_000;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const at = (when: string | Date) => (typeof when === "string" ? Date.parse(when) : when.getTime());

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
/** The `n` UTC days ending today, oldest first. */
export function lastDays(now: string | Date, n: number): string[] {
  const end = utcDay(now);
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}
/** 00:00 UTC of the first of the `n` calendar days ending today: every N-day window includes today (controller ruling). */
export function windowStart(now: string | Date, n: number): string {
  return `${lastDays(now, n)[0]}T00:00:00.000Z`;
}
export function isoWeekStart(day: string): string {
  return addDays(day, -((new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7));
}
/** ISO 8601 week, `YYYY-Www` (the year of the week's Thursday). */
export function isoWeek(day: string): string {
  const thursday = addDays(isoWeekStart(day), 3);
  const year = Number(thursday.slice(0, 4));
  const n = Math.floor((Date.parse(`${thursday}T00:00:00.000Z`) - Date.parse(`${year}-01-01T00:00:00.000Z`)) / DAY_MS / 7) + 1;
  return `${year}-W${String(n).padStart(2, "0")}`;
}
/** Median of whole numbers; for an even count the floor of the mean of the middle two. */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : Math.floor(((s[m - 1] as number) + (s[m] as number)) / 2);
}

/** `n` when it reaches `min`, else null. */
export const countStat = (n: number, min: number): number | null => (n >= min ? n : null);

// ---- Trending ----
export type DayCounts = { views: number; demoClicks: number; inquiries: number };
export const trendingScore = (c: DayCounts): number => c.inquiries * WEIGHT.inquiries + c.demoClicks * WEIGHT.demoClicks + c.views * WEIGHT.views;
/** Percent change, rounded down; null when there is nothing before to compare with. */
export const changePercent = (previous: number, current: number): number | null => (previous <= 0 ? null : Math.floor(((current - previous) * 100) / previous));

export type TrendingCandidate = { productId: string; slug: string; name: string; tagline: string; category: Category | null; builderHandle: string; builderName: string; daily: Record<string, Partial<DayCounts>> };
export type TrendingItem = Omit<TrendingCandidate, "daily"> & { score: number; previousScore: number; changePct: number | null; sparkline: number[] };

/** The 6 highest scores of the last 7 days, each ≥ 20; fewer than 6 products qualify → null (Founding products). */
export function rankTrending(candidates: TrendingCandidate[], now: string | Date): TrendingItem[] | null {
  const days = lastDays(now, SPARK_DAYS);
  const items = candidates.map((c): TrendingItem => {
    const { daily, ...meta } = c;
    const sparkline = days.map((d) => trendingScore({ views: daily[d]?.views ?? 0, demoClicks: daily[d]?.demoClicks ?? 0, inquiries: daily[d]?.inquiries ?? 0 }));
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const previousScore = sum(sparkline.slice(0, TREND_DAYS));
    const score = sum(sparkline.slice(TREND_DAYS));
    return { ...meta, score, previousScore, changePct: changePercent(previousScore, score), sparkline };
  });
  const eligible = items.filter((i) => i.score >= MIN.trendingScore).sort((a, b) => b.score - a.score || cmp(a.productId, b.productId));
  return eligible.length >= MIN.trendingItems ? eligible.slice(0, MIN.trendingItems) : null;
}

// ---- Market pulse ----
export type CategoryCounts = Partial<Record<Category, number>>;
export type CategoryRow = { category: Category; requests: number; products: number };
export type ScarcestCategory = CategoryRow;

/** 30-day requests by category beside listed products; categories under 3 requests (and `other`) fold into one "other" row. */
export function requestByCategory(requests: CategoryCounts, products: CategoryCounts): CategoryRow[] | null {
  const total = CATEGORIES.reduce((n, c) => n + (requests[c] ?? 0), 0);
  if (total < MIN.categoryTotal) return null;
  const named: CategoryRow[] = [];
  const other: CategoryRow = { category: "other", requests: 0, products: 0 };
  for (const c of CATEGORIES) {
    const r = requests[c] ?? 0;
    const p = products[c] ?? 0;
    if (c !== "other" && r >= MIN.categoryRequests) named.push({ category: c, requests: r, products: p });
    else {
      other.requests += r;
      other.products += p;
    }
  }
  named.sort((a, b) => b.requests - a.requests || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return other.requests > 0 || other.products > 0 ? [...named, other] : named;
}

/**
 * The category with the highest requests-per-product (no product = infinite), among those with ≥ 3 requests. Null when the 30-day total
 * is under 10 (it sits in the same chart as requestByCategory) and `other` is never chosen (it is not a market segment).
 */
export function scarcestCategory(requests: CategoryCounts, products: CategoryCounts): ScarcestCategory | null {
  if (CATEGORIES.reduce((n, c) => n + (requests[c] ?? 0), 0) < MIN.categoryTotal) return null;
  const rows = CATEGORIES.filter((c) => c !== "other" && (requests[c] ?? 0) >= MIN.scarcestRequests).map((c): CategoryRow => ({ category: c, requests: requests[c] ?? 0, products: products[c] ?? 0 }));
  const ratioOrder = (a: CategoryRow, b: CategoryRow): number => {
    if (a.products === 0 && b.products === 0) return 0;
    if (a.products === 0) return -1;
    if (b.products === 0) return 1;
    return b.requests * a.products - a.requests * b.products; // a first when a.requests/a.products is larger
  };
  rows.sort((a, b) => ratioOrder(a, b) || b.requests - a.requests || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return rows[0] ?? null;
}

// ---- Growth ----
export type GrowthPoint = { week: string; products: number; builders: number };

/** Cumulative published products and approved builders per ISO week, from the first event to this week; under 4 weeks → null. */
export function weeklyGrowth(days: { products: Record<string, number>; builders: Record<string, number> }, now: string | Date): GrowthPoint[] | null {
  const today = utcDay(now);
  const entries = [...Object.entries(days.products), ...Object.entries(days.builders)].filter(([d]) => d <= today).sort(([a], [b]) => cmp(a, b));
  if (entries.length === 0) return null;
  const weeks: string[] = [];
  for (let w = isoWeekStart(entries[0]![0]); w <= isoWeekStart(today); w = addDays(w, 7)) weeks.push(w);
  if (weeks.length < MIN.growthWeeks) return null;
  let products = 0;
  let builders = 0;
  const points = weeks.map((w): GrowthPoint => {
    for (const [d, n] of Object.entries(days.products)) if (d <= today && isoWeekStart(d) === w) products += n;
    for (const [d, n] of Object.entries(days.builders)) if (d <= today && isoWeekStart(d) === w) builders += n;
    return { week: isoWeek(w), products, builders };
  });
  return points.slice(-GROWTH_MAX_WEEKS);
}

// ---- Top builders ----
export type BuilderTally = { userId: string; handle: string; name: string; selected: number; answered: number; replyMinutes: number[]; verified: number };
export type TopBuilderEntry = { handle: string; name: string; value: number };
/** A tab is null when fewer than 3 builders qualify. `value`: count, median minutes, count. */
export type TopBuilders = { selected: TopBuilderEntry[] | null; fast: TopBuilderEntry[] | null; verified: TopBuilderEntry[] | null };

export function topBuilders(tallies: BuilderTally[]): TopBuilders | null {
  const tab = (value: (t: BuilderTally) => number | null, ascending: boolean): TopBuilderEntry[] | null => {
    const rows = tallies.flatMap((t) => {
      const v = value(t);
      return v === null ? [] : [{ handle: t.handle, name: t.name, value: v }];
    });
    if (rows.length < MIN.tabBuilders) return null;
    rows.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value) || cmp(a.handle, b.handle));
    return rows.slice(0, TOP_BUILDERS_LIMIT);
  };
  const out: TopBuilders = {
    selected: tab((t) => (t.selected + t.answered >= MIN.selected ? t.selected + t.answered : null), false),
    fast: tab((t) => (t.replyMinutes.length >= MIN.fastSamples ? median(t.replyMinutes) : null), true),
    verified: tab((t) => (t.verified >= MIN.verified ? t.verified : null), false),
  };
  return out.selected || out.fast || out.verified ? out : null;
}

// ---- Top products ----
export type ProductCandidate = { id: string; slug: string; name: string; category: Category | null; builderHandle: string; builderName: string; badgeScore: number; inquiries30d: number; publishedAt: string | null };
export type TopProduct = Omit<ProductCandidate, "category">;
export type TopProductsByCategory = Partial<Record<Category, TopProduct[]>>;

/** Per category: highest badge, then 30-day inquiries, then newest `published_at`, then id. Money never enters. */
export function topProductsByCategory(candidates: ProductCandidate[]): TopProductsByCategory | null {
  const out: TopProductsByCategory = {};
  for (const c of CATEGORIES) {
    const rows = candidates
      .filter((p) => p.category === c)
      .sort((a, b) => b.badgeScore - a.badgeScore || b.inquiries30d - a.inquiries30d || cmp(b.publishedAt ?? "", a.publishedAt ?? "") || cmp(a.id, b.id))
      .slice(0, TOP_PRODUCTS_PER_CATEGORY);
    if (rows.length > 0) out[c] = rows.map(({ category: _category, ...rest }) => rest);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ---- Live ----
type LiveBase = { id: string; at: string };
export type LiveEvent =
  | (LiveBase & { kind: "product_published"; productName: string; slug: string })
  | (LiveBase & { kind: "badge_granted"; productName: string; slug: string; badge: BadgeKind })
  | (LiveBase & { kind: "builder_approved"; builderName: string; handle: string })
  | (LiveBase & { kind: "request_new"; category: Category; languages: WorkLanguage[] });
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What the snapshot stores: no audit id (an internal ordering key only). */
export type PublicLiveEvent = DistributiveOmit<LiveEvent, "id">;

/** Public events of the last 7 calendar days (today included), newest first (ties by id), at most 20, ids dropped; under 5 events → null. */
export function liveEvents(events: LiveEvent[], now: string | Date): PublicLiveEvent[] | null {
  const from = Date.parse(windowStart(now, LIVE_DAYS));
  const to = at(now);
  const recent = events.filter((e) => at(e.at) >= from && at(e.at) <= to).sort((a, b) => cmp(b.at, a.at) || cmp(b.id, a.id));
  if (recent.length < MIN.liveEvents) return null;
  return recent.slice(0, LIVE_MAX).map(({ id: _id, ...rest }) => rest as PublicLiveEvent);
}

// ---- Snapshot ----
export type PublicStatValues = {
  count_products: number; count_builders: number; count_requests_30d: number; count_countries: number;
  trending: TrendingItem[]; request_by_category: CategoryRow[]; scarcest_category: ScarcestCategory; growth: GrowthPoint[];
  top_builders: TopBuilders; top_products: TopProductsByCategory; live: PublicLiveEvent[];
};
export type PublicSnapshot = { [K in PublicStatKey]?: { value: PublicStatValues[K]; computedAt: string } };
export type StatRow = { key: string; value: string; computedAt: string };

/** Fresh = computed at most 3 hours ago (exactly 3 hours is fresh) and at most 5 minutes ahead of `now`; an unreadable time is stale. */
export function isFresh(computedAt: string, now: string | Date): boolean {
  const t = Date.parse(computedAt);
  if (Number.isNaN(t)) return false;
  const age = at(now) - t;
  return age <= STALE_AFTER_MS && age >= -FUTURE_SKEW_MS;
}

/** The snapshot homepage blocks read: only known keys that are fresh, valid JSON and not null. Absent = hide the block. */
export function pickFresh(rows: StatRow[], now: string | Date): PublicSnapshot {
  const out: Record<string, { value: unknown; computedAt: string }> = {};
  for (const r of rows) {
    if (!(PUBLIC_STAT_KEYS as readonly string[]).includes(r.key) || !isFresh(r.computedAt, now)) continue;
    let value: unknown;
    try {
      value = JSON.parse(r.value);
    } catch {
      continue;
    }
    if (value !== null && value !== undefined) out[r.key] = { value, computedAt: r.computedAt };
  }
  return out as PublicSnapshot;
}
```

Ghi chú: lọc `languages` làm ở `db/public-stats.ts` (5b); test "mention no money" ở Step 1 cũng cấm các chữ đó trong comment của file domain.

Chạy: `npm test -w apps/web -- test/domain/public-stats.test.ts test/architecture.test.ts` → PASS; `grep -n "public-stats" apps/web/test/architecture.test.ts` thấy `RANKING_FILES`.

- [ ] **Step 4: Typecheck, test, commit 5a**

```
npm run typecheck -w apps/web && npm test
git add apps/web/src/domain/public-stats.ts apps/web/test/domain/public-stats.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): public stats formulas and thresholds (VNX-0702a)

Pure trending score, category, growth, top builder/product and live rules with
exhaustive threshold tests; architecture test gets a positive control and a
case-insensitive money-table check (review F6) and covers the new ranking file.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

#### Phần 5b: migration, lưu và đọc snapshot, truy vấn đầu vào

- [ ] **Step 5: Migration `0016`**

`apps/web/migrations/0016_public_stats.sql`:

```sql
-- M7 VNX-0702 (spec §8.11): hourly snapshot of the public homepage numbers. Additive only.
-- One row per key; `value` is JSON (the JSON null when the number is under its threshold); `computed_at` is the
-- ISO time the cron wrote it. Written only by src/db/public-stats.ts. No FKs, no personal data.
CREATE TABLE public_stats (
  key         TEXT NOT NULL PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 64),
  value       TEXT NOT NULL CHECK (json_valid(value)),
  computed_at TEXT NOT NULL CHECK (computed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*')
) WITHOUT ROWID;
```

Thêm vào `apps/web/wrangler.jsonc` ghi chú `0016_public_stats` cạnh ghi chú `0014`, và vào dòng `1. npm run db:migrate:remote …` nếu dòng đó liệt kê tên migration.

- [ ] **Step 6: Test db đỏ**

`apps/web/test/db/public-stats.test.ts`. Dữ liệu dùng chung một DB trong file nên: số đếm so sánh `after − before`, danh sách tìm theo id của chính test, tag/handle duy nhất cho mỗi test.

```ts
import { describe, expect, it } from "vitest";
import {
  loadBuilderTallies, loadCategoryCounts, loadCounts, loadGrowthDays, loadLiveEvents, loadProductCandidates, loadTrendingCandidates, readPublicStats, writePublicStat,
} from "../../src/db/public-stats.ts";
import { bumpProductStat } from "../../src/db/stats.ts";
import { addDays, STALE_AFTER_MS } from "../../src/domain/public-stats.ts";
import { addLiveProduct, ensureUser, inviteBuilders, makeBuilder, makeInquiry, makeRequest } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T12:05:00.000Z";
const TODAY = "2026-10-05";
const DB = testEnv.DB;
const daysBefore = (now: string, n: number) => new Date(Date.parse(now) - n * 86_400_000).toISOString();
const run = (sql: string, ...args: (string | number | null)[]) => DB.prepare(sql).bind(...args).run();

describe("snapshot storage", () => {
  it("round-trips a value with its computed_at and upserts one row per key", async () => {
    await writePublicStat(DB, "count_products", 12, "2026-10-05T11:05:00.000Z");
    await writePublicStat(DB, "count_products", 14, NOW);
    const snap = await readPublicStats(DB, NOW);
    expect(snap.count_products).toEqual({ value: 14, computedAt: NOW });
    expect((await DB.prepare("SELECT COUNT(*) AS n FROM public_stats WHERE key = 'count_products'").first<{ n: number }>())?.n).toBe(1);
  });

  it("is idempotent: writing the same value at the same time changes nothing", async () => {
    await writePublicStat(DB, "count_builders", 11, NOW);
    await writePublicStat(DB, "count_builders", 11, NOW);
    expect((await readPublicStats(DB, NOW)).count_builders).toEqual({ value: 11, computedAt: NOW });
  });

  it("a block is stale after 3 hours: exactly 3 hours is read, 1 ms more is not", async () => {
    await writePublicStat(DB, "count_countries", 4, new Date(Date.parse(NOW) - STALE_AFTER_MS).toISOString());
    expect((await readPublicStats(DB, NOW)).count_countries?.value).toBe(4);
    await writePublicStat(DB, "count_countries", 4, new Date(Date.parse(NOW) - STALE_AFTER_MS - 1).toISOString());
    expect((await readPublicStats(DB, NOW)).count_countries).toBeUndefined();
  });

  it("a null value (under threshold) is not returned, but the row exists", async () => {
    await writePublicStat(DB, "count_requests_30d", null, NOW);
    expect((await readPublicStats(DB, NOW)).count_requests_30d).toBeUndefined();
    expect((await DB.prepare("SELECT value FROM public_stats WHERE key = 'count_requests_30d'").first<{ value: string }>())?.value).toBe("null");
  });

  it("rejects an unknown key and a bad time; the table refuses non-JSON", async () => {
    await expect(writePublicStat(DB, "nope" as never, 1 as never, NOW)).rejects.toThrow();
    await expect(writePublicStat(DB, "count_products", 1, "yesterday")).rejects.toThrow();
    await expect(run("INSERT INTO public_stats (key, value, computed_at) VALUES ('k', '{oops', ?1)", NOW)).rejects.toThrow();
  });

  it("reads with one query", async () => {
    const prepared: string[] = [];
    const spy = { prepare: (sql: string) => (prepared.push(sql), DB.prepare(sql)), batch: (s: D1PreparedStatement[]) => DB.batch(s) } as unknown as D1Database;
    await readPublicStats(spy, NOW);
    expect(prepared).toHaveLength(1);
  });
});

describe("counts", () => {
  it("count only public products, approved active builders, 30-day submitted requests that are not removed, distinct countries", async () => {
    const before = await loadCounts(DB, NOW);
    const ok = await makeBuilder("cnt-ok@vnx.si", "cnt-ok", "approved", { country: "NZ" });
    await addLiveProduct(ok, "Cnt live");
    const pending = await makeBuilder("cnt-pend@vnx.si", "cnt-pend", "pending", { country: "IS" });
    await addLiveProduct(pending, "Cnt pending builder"); // published, builder not approved
    await makeBuilder("cnt-ok2@vnx.si", "cnt-ok2", "approved", { country: "NZ" }); // same country again
    const { request } = await makeRequest({ tag: "cnt-r-ok", now: daysBefore(NOW, 29) });
    await makeRequest({ tag: "cnt-r-old", now: daysBefore(NOW, 31) });
    await makeRequest({ tag: "cnt-r-pend", status: "pending_verification", now: daysBefore(NOW, 1) });
    const { request: gone } = await makeRequest({ tag: "cnt-r-gone", now: daysBefore(NOW, 1) });
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", gone.id);
    const after = await loadCounts(DB, NOW);
    expect(request.id).toBeTruthy();
    expect(after.products - before.products).toBe(1);
    expect(after.builders - before.builders).toBe(2);
    expect(after.requests30d - before.requests30d).toBe(1);
    expect(after.countries - before.countries).toBe(1);
  });
});

describe("trending inputs (E2: removed inquiries do not count)", () => {
  it("takes views and demo clicks from product_daily_stats and inquiries from the inquiries table without removed ones", async () => {
    const a = await makeInquiry({ tag: "tr-a", status: "open", now: "2026-10-05T10:00:00.000Z" });
    const b = await makeInquiry({ tag: "tr-b", status: "open", now: "2026-10-05T10:00:00.000Z" });
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", b.inquiry.id); // spam, removed by an admin
    for (const p of [a.product!, b.product!]) await bumpProductStat(DB, { productId: p.id, day: TODAY, delta: { views: 4, demo_clicks: 3 } });
    const list = await loadTrendingCandidates(DB, NOW);
    const get = (id: string) => list.find((c) => c.productId === id)!;
    expect(get(a.product!.id).daily[TODAY]).toEqual({ views: 4, demoClicks: 3, inquiries: 1 });
    expect(get(b.product!.id).daily[TODAY]).toEqual({ views: 4, demoClicks: 3 }); // the removed inquiry adds nothing
    // the raw record is untouched: the counter still says 1 for both
    expect((await DB.prepare("SELECT inquiries FROM product_daily_stats WHERE product_id = ?1").bind(b.product!.id).first<{ inquiries: number }>())?.inquiries).toBe(1);
  });

  it("lists only public products and nothing outside the 14 days", async () => {
    const draft = await makeBuilder("tr-d@vnx.si", "tr-d", "pending");
    const live = await addLiveProduct(await makeBuilder("tr-l@vnx.si", "tr-l", "approved"), "Tr live");
    await bumpProductStat(DB, { productId: live.id, day: addDays(TODAY, -14), delta: { views: 99 } }); // day 15: outside
    await bumpProductStat(DB, { productId: live.id, day: addDays(TODAY, -13), delta: { views: 1 } });
    const hidden = await addLiveProduct(draft, "Tr hidden");
    const list = await loadTrendingCandidates(DB, NOW);
    expect(list.find((c) => c.productId === hidden.id)).toBeUndefined();
    const mine = list.find((c) => c.productId === live.id)!;
    expect(Object.keys(mine.daily)).toEqual([addDays(TODAY, -13)]);
  });

  it("does not read outbound_clicks (a money table) at all", async () => {
    const seen: string[] = [];
    const spy = { prepare: (sql: string) => (seen.push(sql), DB.prepare(sql)), batch: (s: D1PreparedStatement[]) => DB.batch(s) } as unknown as D1Database;
    await loadTrendingCandidates(spy, NOW);
    await loadProductCandidates(spy, NOW);
    expect(seen.length).toBeGreaterThan(0);
    for (const sql of seen) expect(sql).not.toMatch(/outbound_clicks|offers|merchants|partner_programs/i);
  });
});

describe("category and growth inputs", () => {
  it("counts 30-day requests by category (not removed, not pending) and public products by category", async () => {
    const before = await loadCategoryCounts(DB, NOW);
    await makeRequest({ tag: "cat-1", category: "hr", now: daysBefore(NOW, 2) });
    await makeRequest({ tag: "cat-2", category: "hr", now: daysBefore(NOW, 2) });
    await makeRequest({ tag: "cat-3", category: "hr", status: "pending_verification", now: daysBefore(NOW, 2) });
    await addLiveProduct(await makeBuilder("cat-b@vnx.si", "cat-b", "approved"), "Cat hr", { fields: { category: "hr" } });
    const after = await loadCategoryCounts(DB, NOW);
    expect((after.requests.hr ?? 0) - (before.requests.hr ?? 0)).toBe(2);
    expect((after.products.hr ?? 0) - (before.products.hr ?? 0)).toBe(1);
  });

  it("groups first publications and approvals by UTC day", async () => {
    const before = await loadGrowthDays(DB);
    const b = await makeBuilder("gr-b@vnx.si", "gr-b", "approved");
    await addLiveProduct(b, "Gr live", { at: "2026-09-14T23:59:59.000Z" });
    const after = await loadGrowthDays(DB);
    expect((after.products["2026-09-14"] ?? 0) - (before.products["2026-09-14"] ?? 0)).toBe(1);
    expect(Object.values(after.builders).reduce((a, n) => a + n, 0)).toBeGreaterThan(Object.values(before.builders).reduce((a, n) => a + n, 0));
  });
});

describe("top builder inputs", () => {
  it("tallies selected invitations, answered inquiries, reply minutes and verified products for a public builder only", async () => {
    const { builder, inquiry } = await makeInquiry({ tag: "tb-1", status: "answered", now: "2026-10-01T10:00:00.000Z" });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-1', ?1, ?2, 'message', 'Hello', '2026-10-01T10:30:00.000Z')", inquiry.id, builder.userId);
    const { request } = await makeRequest({ tag: "tb-req", now: "2026-09-20T10:00:00.000Z" });
    const [invite] = await inviteBuilders(request, [builder], "2026-09-21T10:00:00.000Z");
    await run("UPDATE request_invites SET status = 'selected', responded_at = '2026-09-21T11:00:00.000Z' WHERE id = ?1", invite!.id);
    const verified = await addLiveProduct(builder, "Tb verified", { badges: ["demo_verified"] });
    const revoked = await addLiveProduct(builder, "Tb revoked", { badges: ["in_production"] });
    await run("UPDATE product_verifications SET revoked_at = ?2 WHERE product_id = ?1 AND kind = 'in_production'", revoked.id, NOW);
    const mine = (await loadBuilderTallies(DB, NOW)).find((t) => t.userId === builder.userId)!;
    expect(mine).toMatchObject({ handle: "tb-1-b", selected: 1, answered: 1, verified: 1 });
    expect([...mine.replyMinutes].sort((a, b) => a - b)).toEqual([30, 60]); // inquiry 30 min, invitation 60 min
    expect(verified.id).toBeTruthy();
  });

  it("leaves out suspended builders and anything older than 90 days", async () => {
    const old = await makeInquiry({ tag: "tb-old", status: "answered", now: daysBefore(NOW, 91) });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-old', ?1, ?2, 'message', 'Hi', ?3)", old.inquiry.id, old.builder.userId, daysBefore(NOW, 91));
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === old.builder.userId)?.answered).toBe(0); // answered, but outside the window
    const edge = await makeInquiry({ tag: "tb-edge", status: "answered", now: daysBefore(NOW, 89) });
    await run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('tb-msg-edge', ?1, ?2, 'message', 'Hi', ?3)", edge.inquiry.id, edge.builder.userId, daysBefore(NOW, 89));
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === edge.builder.userId)?.answered).toBe(1);
    const sus = await makeInquiry({ tag: "tb-sus", status: "answered", now: daysBefore(NOW, 1) });
    await run("UPDATE builders SET status = 'suspended' WHERE user_id = ?1", sus.builder.userId);
    expect((await loadBuilderTallies(DB, NOW)).find((t) => t.userId === sus.builder.userId)).toBeUndefined();
  });
});

describe("answered inquiries (selected tab)", () => {
  const reply = (id: string, inquiryId: string, builderId: string, kind: string) =>
    run("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES (?1, ?2, ?3, ?4, 'x', ?5)", id, inquiryId, builderId, kind, daysBefore(NOW, 1));
  const answered = async (tag: string) => (await loadBuilderTallies(DB, NOW)).find((t) => t.handle === `${tag}-b`)!.answered;

  it("an inquiry answered and then closed still counts", async () => {
    const x = await makeInquiry({ tag: "an-closed", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m1", x.inquiry.id, x.builder.userId, "message");
    await run("UPDATE inquiries SET status = 'closed' WHERE id = ?1", x.inquiry.id);
    expect(await answered("an-closed")).toBe(1);
  });
  it("does not count a decline, a removed inquiry, or one the builder never wrote to", async () => {
    const d = await makeInquiry({ tag: "an-decl", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m2", d.inquiry.id, d.builder.userId, "decline");
    expect(await answered("an-decl")).toBe(0);
    const r = await makeInquiry({ tag: "an-rem", status: "open", now: daysBefore(NOW, 2) });
    await reply("an-m3", r.inquiry.id, r.builder.userId, "message");
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", r.inquiry.id);
    expect(await answered("an-rem")).toBe(0);
    await makeInquiry({ tag: "an-none", status: "answered", now: daysBefore(NOW, 2) }); // status says answered, no builder message
    expect(await answered("an-none")).toBe(0);
  });
  it("does not count invitations of a removed request toward selected or fast reply", async () => {
    const x = await makeInquiry({ tag: "an-inv", status: "open", now: daysBefore(NOW, 2) });
    const { request } = await makeRequest({ tag: "an-inv-req", now: daysBefore(NOW, 2) });
    const [invite] = await inviteBuilders(request, [x.builder], daysBefore(NOW, 2));
    await run("UPDATE request_invites SET status = 'selected', responded_at = ?2 WHERE id = ?1", invite!.id, daysBefore(NOW, 1));
    const mine = async () => (await loadBuilderTallies(DB, NOW)).find((t) => t.userId === x.builder.userId)!;
    expect((await mine()).selected).toBe(1);
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", request.id);
    expect(await mine()).toMatchObject({ selected: 0, replyMinutes: [] });
  });
});

describe("top product inputs", () => {
  it("gives the active badge score, 30-day inquiries without removed ones, and only public products", async () => {
    const gold = await makeInquiry({ tag: "tp-gold", status: "open", now: daysBefore(NOW, 3) });
    const spam = await makeInquiry({ tag: "tp-spam", status: "open", now: daysBefore(NOW, 3) });
    await run("UPDATE inquiries SET status = 'removed' WHERE id = ?1", spam.inquiry.id);
    const hiddenB = await makeBuilder("tp-h@vnx.si", "tp-h", "pending");
    const hidden = await addLiveProduct(hiddenB, "Tp hidden");
    const list = await loadProductCandidates(DB, NOW);
    expect(list.find((p) => p.id === gold.product!.id)).toMatchObject({ badgeScore: 1, inquiries30d: 1, category: "booking" });
    expect(list.find((p) => p.id === spam.product!.id)?.inquiries30d).toBe(0);
    expect(list.find((p) => p.id === hidden.id)).toBeUndefined();
  });
});

describe("live events", () => {
  const audit = (id: string, action: string, entity: string, entityId: string, data: object, at = daysBefore(NOW, 1)) =>
    run("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6)", id, action, entity, entityId, JSON.stringify(data), at);

  it("returns public events with their time and nothing private", async () => {
    const b = await makeBuilder("lv-b@vnx.si", "lv-b", "approved", { name: "Live Builder" });
    const A = daysBefore(NOW, 1); // the badge is granted at A, so its audit row carries the same time
    const p = await addLiveProduct(b, "Live product", { at: A, badges: ["demo_verified"] });
    const { request } = await makeRequest({ tag: "lv-req", title: "SECRET TITLE", description: "SECRET BODY", category: "crm", languages: ["vi", "en"] });
    const signed = await makeRequest({ tag: "lv-sign", category: "finance", languages: ["zh", "en"] });
    const invited = await makeBuilder("lv-inv@vnx.si", "lv-inv", "approved", { name: "Invited Builder" });
    const pendingData = await makeBuilder("lv-pd@vnx.si", "lv-pd", "approved");
    await audit("lv-01", "product.approve", "product", p.id, { note: "SECRET NOTE" }, A);
    await audit("lv-02", "badge.grant", "product", p.id, { kind: "demo_verified", evidence: "SECRET EVIDENCE" }, A);
    await audit("lv-03", "builder.approve", "builder", b.userId, { note: "SECRET NOTE" });
    await audit("lv-04", "request.verify", "request", request.id, { via: "link", category: "crm", languages: ["vi", "en", "xx"] });
    await audit("lv-05", "request.submit", "request", signed.request.id, { category: "finance", languages: ["zh", "en", "fr"] }); // a signed-in client
    await audit("lv-06", "builder.apply", "builder", invited.userId, { status: "approved", invited: true }); // approved through an invite
    await audit("lv-07", "builder.apply", "builder", pendingData.userId, { status: "pending", invited: false }); // not approved by that apply
    const events = (await loadLiveEvents(DB, NOW)).filter((e) => e.id.startsWith("lv-0"));
    expect(events.map((e) => e.id).sort()).toEqual(["lv-01", "lv-02", "lv-03", "lv-04", "lv-05", "lv-06"]);
    expect(events.find((e) => e.id === "lv-04")).toMatchObject({ kind: "request_new", category: "crm", languages: ["vi", "en"] }); // unknown language dropped
    expect(events.find((e) => e.id === "lv-05")).toMatchObject({ kind: "request_new", category: "finance", languages: ["zh", "en"] }); // zh is a work language
    expect(events.find((e) => e.id === "lv-06")).toMatchObject({ kind: "builder_approved", handle: "lv-inv" });
    expect(JSON.stringify(events)).not.toMatch(/SECRET|Minh Tran|@vnx\.si/);
  });

  it("drops events of things that are no longer public, revoked badges, events older than 7 days and removed requests", async () => {
    const b = await makeBuilder("lv2-b@vnx.si", "lv2-b", "approved");
    const BADGE_AT = daysBefore(NOW, 1);
    const p = await addLiveProduct(b, "Lv2 product", { at: BADGE_AT, badges: ["demo_verified"] });
    await audit("lv-11", "product.approve", "product", p.id, {}, daysBefore(NOW, 8));
    await audit("lv-12", "badge.grant", "product", p.id, { kind: "demo_verified" }, BADGE_AT);
    await run("UPDATE product_verifications SET revoked_at = ?2 WHERE product_id = ?1 AND kind = 'demo_verified'", p.id, NOW);
    const { request } = await makeRequest({ tag: "lv2-req" });
    await audit("lv-13", "request.verify", "request", request.id, { category: "booking", languages: ["en"] });
    await run("UPDATE requests SET status = 'removed' WHERE id = ?1", request.id);
    await run("UPDATE products SET status = 'suspended' WHERE id = ?1", p.id);
    await audit("lv-14", "product.approve", "product", p.id, {});
    const ids = (await loadLiveEvents(DB, NOW)).map((e) => e.id);
    for (const id of ["lv-11", "lv-12", "lv-13", "lv-14"]) expect(ids).not.toContain(id);
    // a badge audit row whose time differs from the badge's own verified_at is not that badge's event
    const q = await addLiveProduct(await makeBuilder("lv3-b@vnx.si", "lv3-b", "approved"), "Lv3 product", { at: BADGE_AT, badges: ["demo_verified"] });
    await audit("lv-15", "badge.grant", "product", q.id, { kind: "demo_verified" }, daysBefore(NOW, 2));
    expect((await loadLiveEvents(DB, NOW)).map((e) => e.id)).not.toContain("lv-15");
  });
});
```

Chạy: `npm test -w apps/web -- test/db/public-stats.test.ts` → FAIL (module/bảng không tồn tại).

Lưu ý cho Implementer: `createRequest` (qua `makeRequest`) phải đặt `submitted_at` = `now` khi status `submitted`; nếu fixture không làm vậy, thêm `UPDATE requests SET submitted_at = …` trong test. `ensureUser` được import nhưng chỉ cần khi thật sự dùng (bỏ nếu `typecheck` báo thừa). Nếu `makeBuilder` không nhận `country`/`name` qua `overrides` đúng khóa `BuilderFormValues` (`country`, `name`), dùng đúng khóa của `profileValues`. Nếu `makeInquiry(…now…)` đặt `opened_at` khác `now` (xem fixture), điều chỉnh các `UPDATE inquiries SET opened_at` trong test cho khớp, KHÔNG sửa code sản xuất để vừa test.

- [ ] **Step 7: `db/public-stats.ts`**

Trước hết `apps/web/src/db/catalog.ts`: đổi `const BADGE_SCORE_SQL` thành `export const BADGE_SCORE_SQL` (một từ).

`apps/web/src/db/public-stats.ts`:

```ts
import { WORK_LANGUAGES, type WorkLanguage } from "../domain/builder.ts";
import { CATEGORIES, type BadgeKind, type Category } from "../domain/product.ts";
import {
  BUILDER_DAYS, LIVE_DAYS, PUBLIC_STAT_KEYS, REQUEST_DAYS, SPARK_DAYS, lastDays, pickFresh, windowStart,
  type BuilderTally, type CategoryCounts, type LiveEvent, type ProductCandidate, type PublicSnapshot, type PublicStatKey, type PublicStatValues, type TrendingCandidate,
} from "../domain/public-stats.ts";
import { BADGE_SCORE_SQL } from "./catalog.ts";
import { PUBLIC_PRODUCT } from "./products.ts";

/**
 * The only writer of `public_stats` and the read side of the hourly job (module `insights`, ADR-007 rule 10).
 * Ranking code: it reads `product_daily_stats`, `inquiries` and catalogue tables, never a table of money (ADR-004, ADR-007 rule 2).
 */

const PUBLIC_JOIN = "JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id";
const APPROVED_BUILDER = "b.status = 'approved' AND u.status = 'active'";
/** An inquiry that really opened and was not removed as spam (E2). */
const COUNTED_INQUIRY = "i.opened_at IS NOT NULL AND i.status <> 'removed'";

/** Stores one number (the JSON null when under its threshold) with its computation time. One row per key. */
export async function writePublicStat<K extends PublicStatKey>(db: D1Database, key: K, value: PublicStatValues[K] | null, now: string): Promise<void> {
  if (!(PUBLIC_STAT_KEYS as readonly string[]).includes(key)) throw new Error(`unknown public stat key: ${key}`);
  if (Number.isNaN(Date.parse(now))) throw new Error(`invalid time: ${now}`);
  await db
    .prepare("INSERT INTO public_stats (key, value, computed_at) VALUES (?1, ?2, ?3) ON CONFLICT (key) DO UPDATE SET value = excluded.value, computed_at = excluded.computed_at")
    .bind(key, JSON.stringify(value), now)
    .run();
}

/** All fresh, non-null numbers in ONE query. A key older than 3 hours or holding null is absent: the block hides. */
export async function readPublicStats(db: D1Database, now: string | Date): Promise<PublicSnapshot> {
  const { results } = await db.prepare("SELECT key, value, computed_at FROM public_stats").all<{ key: string; value: string; computed_at: string }>();
  return pickFresh(results.map((r) => ({ key: r.key, value: r.value, computedAt: r.computed_at })), now);
}

export async function loadCounts(db: D1Database, now: string): Promise<{ products: number; builders: number; requests30d: number; countries: number }> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}) AS products,
         (SELECT COUNT(*) FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}) AS builders,
         (SELECT COUNT(*) FROM requests WHERE submitted_at IS NOT NULL AND submitted_at >= ?1 AND status <> 'removed') AS requests30d,
         (SELECT COUNT(DISTINCT b.country) FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}) AS countries`,
    )
    .bind(windowStart(now, REQUEST_DAYS))
    .first<{ products: number; builders: number; requests30d: number; countries: number }>();
  return row ?? { products: 0, builders: 0, requests30d: 0, countries: 0 };
}

export async function loadCategoryCounts(db: D1Database, now: string): Promise<{ requests: CategoryCounts; products: CategoryCounts }> {
  const [requests, products] = await db.batch<{ category: Category; n: number }>([
    db.prepare("SELECT category, COUNT(*) AS n FROM requests WHERE submitted_at IS NOT NULL AND submitted_at >= ?1 AND status <> 'removed' GROUP BY category").bind(windowStart(now, REQUEST_DAYS)),
    db.prepare(`SELECT p.category AS category, COUNT(*) AS n FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT} AND p.category IS NOT NULL GROUP BY p.category`),
  ]);
  const toCounts = (rows: { category: Category; n: number }[]): CategoryCounts => Object.fromEntries(rows.filter((r) => (CATEGORIES as readonly string[]).includes(r.category)).map((r) => [r.category, r.n]));
  return { requests: toCounts(requests!.results), products: toCounts(products!.results) };
}

/** Product first publications and builder approvals per UTC day (public ones only), for the weekly growth chart. */
export async function loadGrowthDays(db: D1Database): Promise<{ products: Record<string, number>; builders: Record<string, number> }> {
  const [products, builders] = await db.batch<{ day: string; n: number }>([
    db.prepare(`SELECT substr(p.first_published_at, 1, 10) AS day, COUNT(*) AS n FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT} AND p.first_published_at IS NOT NULL GROUP BY day`),
    db.prepare(`SELECT substr(b.approved_at, 1, 10) AS day, COUNT(*) AS n FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER} AND b.approved_at IS NOT NULL GROUP BY day`),
  ]);
  const toMap = (rows: { day: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.day, r.n]));
  return { products: toMap(products!.results), builders: toMap(builders!.results) };
}

/** Inquiries that opened on or after `from` and were not removed, per product and UTC day (E2). */
async function inquiriesByProductDay(db: D1Database, from: string): Promise<{ product_id: string; day: string; n: number }[]> {
  const { results } = await db
    .prepare(`SELECT i.product_id AS product_id, substr(i.opened_at, 1, 10) AS day, COUNT(*) AS n FROM inquiries i WHERE i.product_id IS NOT NULL AND ${COUNTED_INQUIRY} AND i.opened_at >= ?1 GROUP BY i.product_id, day`)
    .bind(`${from}T00:00:00.000Z`)
    .all<{ product_id: string; day: string; n: number }>();
  return results;
}

/** Every public product with its last 14 days of views, demo clicks and (non-removed) inquiries. */
export async function loadTrendingCandidates(db: D1Database, now: string): Promise<TrendingCandidate[]> {
  const days = lastDays(now, SPARK_DAYS);
  const from = days[0] as string;
  const [products, stats] = await db.batch<Record<string, string | number | null>>([
    db.prepare(`SELECT p.id, p.slug, p.name, p.tagline, p.category, b.handle AS builder_handle, b.name AS builder_name FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}`),
    db.prepare("SELECT product_id, day, views, demo_clicks FROM product_daily_stats WHERE day >= ?1").bind(from),
  ]);
  const byId = new Map<string, TrendingCandidate>();
  for (const r of products!.results) {
    byId.set(r.id as string, { productId: r.id as string, slug: r.slug as string, name: r.name as string, tagline: r.tagline as string, category: (r.category as Category | null) ?? null, builderHandle: r.builder_handle as string, builderName: r.builder_name as string, daily: {} });
  }
  for (const r of stats!.results) {
    const c = byId.get(r.product_id as string);
    if (c) c.daily[r.day as string] = { views: r.views as number, demoClicks: r.demo_clicks as number };
  }
  for (const r of await inquiriesByProductDay(db, from)) {
    const c = byId.get(r.product_id);
    if (c) c.daily[r.day] = { ...c.daily[r.day], inquiries: r.n };
  }
  return [...byId.values()];
}

/** Every public product with its active top badge score, 30-day inquiries (not removed) and `published_at`. */
export async function loadProductCandidates(db: D1Database, now: string): Promise<ProductCandidate[]> {
  const { results } = await db
    .prepare(`SELECT p.id, p.slug, p.name, p.category, p.published_at, b.handle AS builder_handle, b.name AS builder_name, ${BADGE_SCORE_SQL} AS badge_score FROM products p ${PUBLIC_JOIN} WHERE ${PUBLIC_PRODUCT}`)
    .all<{ id: string; slug: string; name: string; category: Category | null; published_at: string | null; builder_handle: string; builder_name: string; badge_score: number }>();
  const inquiries = new Map<string, number>();
  for (const r of await inquiriesByProductDay(db, lastDays(now, REQUEST_DAYS)[0] as string)) inquiries.set(r.product_id, (inquiries.get(r.product_id) ?? 0) + r.n);
  return results.map((r) => ({ id: r.id, slug: r.slug, name: r.name, category: r.category, builderHandle: r.builder_handle, builderName: r.builder_name, badgeScore: r.badge_score, inquiries30d: inquiries.get(r.id) ?? 0, publishedAt: r.published_at }));
}

const minutes = (from: string, to: string): number | null => {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isNaN(ms) || ms < 0 ? null : Math.floor(ms / 60_000);
};

/**
 * One tally per public builder: selected invitations, answered inquiries (not removed, with a builder message of kind `message`, whatever the status is now),
 * first-reply minutes (90 calendar days, anchored on the start of the record) and verified products. Invitations of removed requests are left out.
 */
export async function loadBuilderTallies(db: D1Database, now: string): Promise<BuilderTally[]> {
  const from = windowStart(now, BUILDER_DAYS);
  const [builders, invites, inquiries] = await db.batch<Record<string, string | number | null>>([
    db.prepare(
      `SELECT b.user_id, b.handle, b.name,
         (SELECT COUNT(*) FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published'
            AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind IN ('demo_verified', 'in_production') AND v.revoked_at IS NULL)) AS verified
       FROM builders b JOIN users u ON u.id = b.user_id WHERE ${APPROVED_BUILDER}`,
    ),
    db.prepare("SELECT ri.builder_id, ri.status, ri.invited_at, ri.responded_at FROM request_invites ri JOIN requests r ON r.id = ri.request_id WHERE r.status <> 'removed' AND ri.invited_at >= ?1").bind(from),
    db.prepare(
      `SELECT i.builder_id, i.opened_at,
         EXISTS (SELECT 1 FROM inquiry_messages m WHERE m.inquiry_id = i.id AND m.sender_user_id = i.builder_id AND m.kind = 'message') AS answered,
         (SELECT MIN(m.created_at) FROM inquiry_messages m WHERE m.inquiry_id = i.id AND m.sender_user_id = i.builder_id) AS first_reply
       FROM inquiries i WHERE ${COUNTED_INQUIRY} AND i.opened_at >= ?1`,
    ).bind(from),
  ]);
  const tallies = new Map<string, BuilderTally>();
  for (const r of builders!.results) tallies.set(r.user_id as string, { userId: r.user_id as string, handle: r.handle as string, name: r.name as string, selected: 0, answered: 0, replyMinutes: [], verified: r.verified as number });
  for (const r of invites!.results) {
    const t = tallies.get(r.builder_id as string);
    if (!t) continue;
    if (r.status === "selected") t.selected++;
    const m = r.responded_at ? minutes(r.invited_at as string, r.responded_at as string) : null;
    if (m !== null) t.replyMinutes.push(m);
  }
  for (const r of inquiries!.results) {
    const t = tallies.get(r.builder_id as string);
    if (!t) continue;
    if (r.answered === 1) t.answered++;
    const m = r.first_reply ? minutes(r.opened_at as string, r.first_reply as string) : null;
    if (m !== null) t.replyMinutes.push(m);
  }
  return [...tallies.values()];
}

/**
 * Public events of the last 7 calendar days from `audit_log` (spec §8.11). Selects only names, slugs, a badge kind, a category, languages and, for `builder.apply`, only `status`:
 * never the rest of `audit_log.data` (evidence, notes), a request's title or text, or any client. Only things that are public NOW.
 */
export async function loadLiveEvents(db: D1Database, now: string): Promise<LiveEvent[]> {
  const from = windowStart(now, LIVE_DAYS);
  const [published, badges, approved, requests] = await db.batch<Record<string, string | null>>([
    db.prepare(`SELECT a.id, a.created_at AS at, p.name AS product_name, p.slug FROM audit_log a JOIN products p ON p.id = a.entity_id ${PUBLIC_JOIN} WHERE a.action = 'product.approve' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC_PRODUCT}`).bind(from),
    db.prepare(
      `SELECT a.id, a.created_at AS at, p.name AS product_name, p.slug, json_extract(a.data, '$.kind') AS kind
       FROM audit_log a JOIN products p ON p.id = a.entity_id ${PUBLIC_JOIN}
       WHERE a.action = 'badge.grant' AND a.entity = 'product' AND a.created_at >= ?1 AND ${PUBLIC_PRODUCT}
         AND json_extract(a.data, '$.kind') IN ('demo_verified', 'in_production')
         AND EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind = json_extract(a.data, '$.kind') AND v.verified_at = a.created_at AND v.revoked_at IS NULL)`,
    ).bind(from),
    db.prepare(`SELECT a.id, a.created_at AS at, b.name AS builder_name, b.handle FROM audit_log a JOIN builders b ON b.user_id = a.entity_id JOIN users u ON u.id = b.user_id WHERE (a.action = 'builder.approve' OR (a.action = 'builder.apply' AND json_extract(a.data, '$.status') = 'approved')) AND a.entity = 'builder' AND a.created_at >= ?1 AND ${APPROVED_BUILDER}`).bind(from),
    db.prepare("SELECT a.id, a.created_at AS at, json_extract(a.data, '$.category') AS category, json_extract(a.data, '$.languages') AS languages FROM audit_log a JOIN requests r ON r.id = a.entity_id WHERE a.action IN ('request.verify', 'request.submit') AND a.entity = 'request' AND a.created_at >= ?1 AND r.status <> 'removed'").bind(from),
  ]);
  const events: LiveEvent[] = [];
  for (const r of published!.results) events.push({ id: r.id as string, at: r.at as string, kind: "product_published", productName: r.product_name as string, slug: r.slug as string });
  for (const r of badges!.results) events.push({ id: r.id as string, at: r.at as string, kind: "badge_granted", productName: r.product_name as string, slug: r.slug as string, badge: r.kind as BadgeKind });
  for (const r of approved!.results) events.push({ id: r.id as string, at: r.at as string, kind: "builder_approved", builderName: r.builder_name as string, handle: r.handle as string });
  for (const r of requests!.results) {
    if (!(CATEGORIES as readonly string[]).includes(r.category as string)) continue;
    let languages: WorkLanguage[] = [];
    try {
      const parsed: unknown = JSON.parse((r.languages as string | null) ?? "[]");
      if (Array.isArray(parsed)) languages = parsed.filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l as string));
    } catch {
      // unreadable languages: show the event without them
    }
    events.push({ id: r.id as string, at: r.at as string, kind: "request_new", category: r.category as Category, languages });
  }
  return events;
}
```

Ghi chú: `addDays` import chỉ dùng nếu cần, bỏ khi `typecheck` báo thừa. `db.batch<T>` của D1 trả mảng `D1Result<T>`. Cột `PUBLIC_PRODUCT` đã gồm `p.`/`b.`/`u.` nên mọi truy vấn có `PUBLIC_JOIN` đều hợp lệ; truy vấn `loadBuilderTallies`/`loadCounts` (không có `p`) dùng `APPROVED_BUILDER`. Chữ "offer"/"price"/"paid"... KHÔNG được xuất hiện trong file này kể cả comment (test kiến trúc ở Step 8 quét).

Chạy: `npm test -w apps/web -- test/db/public-stats.test.ts` → PASS.

- [ ] **Step 8: Test kiến trúc cho 5b**

Trong `apps/web/test/architecture.test.ts`: thêm `public_stats: "../src/db/public-stats.ts",` vào `WRITERS`; thêm `"../src/db/public-stats.ts"` vào `RANKING_FILES`; đổi vòng trong bài "the public statistics files…" thành `for (const file of ["../src/domain/public-stats.ts", "../src/db/public-stats.ts"])`. Thêm bài:

```ts
it("the public statistics files read only allowed tables (no money table, no outbound_clicks)", () => {
  for (const file of ["../src/domain/public-stats.ts", "../src/db/public-stats.ts"]) {
    for (const table of MONEY_TABLES) expect(touchesMoneyTable(sources[file] ?? "", table), `${file} reads ${table}`).toBe(false);
    expect(MONEY_ALLOWED.has(file), file).toBe(false);
  }
});
```

Chạy: `npm test -w apps/web -- test/architecture.test.ts test/db/public-stats.test.ts test/domain/public-stats.test.ts` → PASS. Kiểm đỏ thật một lần (không commit): thêm tạm `import { x } from "./offers.ts";` (anh em trong `src/db/`) vào `db/public-stats.ts` → `npm test -w apps/web -- test/architecture.test.ts` phải ĐỎ (đây là ca bộ kiểm cũ bỏ sót); gỡ ra. Nếu vòng quét toàn `src` báo một file `db/` hiện có import anh em trong MONEY_DB mà chưa nằm trong `MONEY_ALLOWED`, ghi vào báo cáo và hỏi, đừng nới bộ kiểm.

- [ ] **Step 9: Typecheck, test toàn bộ, commit 5b**

```
npm run typecheck -w apps/web && npm test
git add apps/web/migrations/0016_public_stats.sql apps/web/src/db/public-stats.ts apps/web/src/db/catalog.ts apps/web/wrangler.jsonc apps/web/test/db/public-stats.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): public_stats snapshot table and homepage stat queries (VNX-0702a)

Migration 0016, db/public-stats.ts (sole writer; reads for the hourly job; stale
after 3 hours), inquiries without removed ones feed trending (E2). Ranking files
and WRITERS cover the new module.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Acceptance (mỗi dòng kiểm được bằng một lệnh):**
- Mỗi số liệu §8.11 có test n−1 / n: `npm test -w apps/web -- test/domain/public-stats.test.ts` (ngưỡng 10/10/10/3, trending 20 và 6 product, category 10 và 3, thiếu supply 3, tăng trưởng 4 tuần, Top 2/5/1 và 3 builder mỗi tab, Live 5 và 20, ranh giới 7 ngày và 3 giờ).
- Trending đúng công thức `2×5 + 3×2 + 4 = 20` và làm tròn xuống: cùng lệnh.
- E2: Inquiry `removed` không vào điểm Trending và Top product, cột `product_daily_stats.inquiries` giữ nguyên: `npm test -w apps/web -- test/db/public-stats.test.ts`.
- `request_by_category` không bao giờ có tên category < 3 request (kể cả `other` thật): test "folds the real other category…".
- Live không có `evidence`, ghi chú, tiêu đề request, tên khách, email: test "returns public events with their time and nothing private".
- Snapshot: một truy vấn khi đọc, quá 3 giờ và `null` bị ẩn, ghi lặp không đổi: `test/db/public-stats.test.ts`.
- Xếp hạng không đọc tiền: `npm test -w apps/web -- test/architecture.test.ts` xanh trên repo và có đối chứng dương (đỏ khi giả lập `import … /db/offers.ts`, SQL chữ thường); `grep -n "public-stats" apps/web/test/architecture.test.ts` thấy `RANKING_FILES` đủ hai file và `WRITERS.public_stats`.
- Không hard-code: `grep -nE "public_stats" apps/web/src --include=*.tsx -r` rỗng ở Task này (không view nào); migration chỉ thêm: `git diff --stat -- apps/web/migrations` chỉ có `0016_public_stats.sql`.
- `npm run typecheck -w apps/web` và `npm test` xanh.

Không có chuỗi giao diện, không locale. Diff ~1100 dòng gồm test (5a ~560, 5b ~540; mã sản xuất ~190 + ~160).

---

### Task 6: VNX-0702b — Cron hằng giờ

**Scope:** Tạo `apps/web/src/jobs/hourly.ts` với `runHourly(env, now: Date): Promise<HourlyResult[]>`, đúng một bước cho mỗi phần tử của `PUBLIC_STAT_KEYS`. Mỗi bước gọi truy vấn `db/public-stats.ts`, tính bằng hàm thuần của `domain/public-stats.ts`, rồi mới gọi `writePublicStat`; `try/catch` từng bước theo mẫu `runDaily`, ghi JSON `{ job: "hourly", step, ... }`, lỗi một bước không chặn bước sau. `apps/web/src/index.ts#scheduled` rẽ theo `controller.cron`: `"0 1 * * *"` → `runDaily`, `"5 * * * *"` → `runHourly`, giá trị khác → `console.warn` rồi bỏ qua. Thêm `5 * * * *` cạnh `0 1 * * *`; không thêm bước Live/event ngoài key `live` mà Task 5 đã tính, không đổi `runDaily` (dọn view-dedupe là Task 3).

**Files:**
- Create: `apps/web/src/jobs/hourly.ts`, `apps/web/test/jobs/hourly.test.ts`, `apps/web/test/jobs/scheduled.test.ts`.
- Modify: `apps/web/src/index.ts`, `apps/web/wrangler.jsonc`, `apps/web/test/architecture.test.ts`, `apps/web/test/db/public-stats.test.ts` (chỉ các test deferred của Task 5).
- Rerun only: `apps/web/test/jobs/daily.test.ts` and the existing daily inquiry/request tests; do not edit `apps/web/src/jobs/daily.ts`.
- No README/runbook change: repository inspection found no suitable cron runbook (only index READMEs under `docs/adr/` and `docs/blueprint/`). No i18n keys or locale changes.

**Interfaces:**
- Consumes real exports: `PUBLIC_STAT_KEYS`, `MIN`, `countStat`, `rankTrending`, `requestByCategory`, `scarcestCategory`, `weeklyGrowth`, `topBuilders`, `topProductsByCategory`, `liveEvents`, `type PublicStatKey`, `type PublicStatValues` (`domain/public-stats.ts`); `loadCounts`, `loadCategoryCounts`, `loadGrowthDays`, `loadTrendingCandidates`, `loadProductCandidates`, `loadBuilderTallies`, `loadLiveEvents`, `writePublicStat` (`db/public-stats.ts`); `Bindings` (`env.ts`); `runDaily` (`jobs/daily.ts`).
- Produces: `HourlyResult`; `runHourly(env: Bindings, now: Date): Promise<HourlyResult[]>`; `scheduled` dispatch for the two exact cron strings; `wrangler.jsonc.triggers.crons = ["0 1 * * *", "5 * * * *"]`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. Keep the key order exactly `PUBLIC_STAT_KEYS`; the eleven steps are `count_products`, `count_builders`, `count_requests_30d`, `count_countries`, `trending`, `request_by_category`, `scarcest_category`, `growth`, `top_builders`, `top_products`, `live`—no separate Live step. Count/category loaders are intentionally called inside each relevant key step so query failure and write failure are isolated per key; do not memoize a shared query result across steps.
2. A successful result is `{ job: "hourly", step, value, computedAt: iso }`; a failed result is `{ job: "hourly", step, error: String(err) }`. `writePublicStat` runs only after that step's query and pure computation succeed, so a failed query leaves the previous JSON value and `computed_at` untouched. A computed value below threshold is `null` and is still written.
3. Unknown cron warning is one JSON line `{"job":"scheduler","event":"unknown_cron","cron":controller.cron}`; it does not call `waitUntil`. `MONEY_ALLOWED` remains unchanged; `jobs/hourly.ts` is added to `RANKING_FILES` only and never imports or reads a money table.

- [ ] **Step 1: Pin the deferred Task 5 calendar-window tests before adding the job**

In `apps/web/test/db/public-stats.test.ts`, remove the unused `ensureUser` import. Replace both truthiness-only checks with exact stable fixture-value assertions (`submitted` status and the explicit product name), and add the two exact UTC boundary pairs. Keep the file's `after − before` style because its D1 rows are shared:

```ts
// The fixtures have stable exact values: makeRequest defaults to `submitted`, and this product is named explicitly below.
expect(request.status).toBe("submitted");
expect(verified.name).toBe("Tb verified");

it("uses 30 UTC calendar days including today", async () => {
  const countsBefore = await loadCounts(DB, NOW);
  const categoriesBefore = await loadCategoryCounts(DB, NOW);
  await makeRequest({ tag: "win30-old", category: "crm", now: "2026-09-05T00:00:00.000Z" }); // today − 30: excluded
  await makeRequest({ tag: "win30-edge", category: "crm", now: "2026-09-06T00:00:00.000Z" }); // today − 29 at midnight: included
  const countsAfter = await loadCounts(DB, NOW);
  const categoriesAfter = await loadCategoryCounts(DB, NOW);
  expect(countsAfter.requests30d - countsBefore.requests30d).toBe(1);
  expect((categoriesAfter.requests.crm ?? 0) - (categoriesBefore.requests.crm ?? 0)).toBe(1);
  const old = await makeInquiry({ tag: "win30i-old", status: "open", now: "2026-09-05T00:00:00.000Z" });
  const edge = await makeInquiry({ tag: "win30i-edge", status: "open", now: "2026-09-06T00:00:00.000Z" });
  const products = await loadProductCandidates(DB, NOW);
  expect(products.find((p) => p.id === old.product!.id)?.inquiries30d).toBe(0);
  expect(products.find((p) => p.id === edge.product!.id)?.inquiries30d).toBe(1);
});

it("uses 90 UTC calendar days including today for inquiries and invitations", async () => {
  const old = await makeInquiry({ tag: "win90-old", status: "answered", now: "2026-07-07T00:00:00.000Z" }); // today − 90: excluded
  const edge = await makeInquiry({ tag: "win90-edge", status: "answered", now: "2026-07-08T00:00:00.000Z" }); // today − 89 at midnight: included
  for (const [tag, row, at] of [["old", old, "2026-07-07T00:00:00.000Z"], ["edge", edge, "2026-07-08T00:00:00.000Z"]] as const)
    await run(`INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES ('win90-${tag}-msg', ?1, ?2, 'message', 'Hi', ?3)`, row.inquiry.id, row.builder.userId, at);
  const tallies = await loadBuilderTallies(DB, NOW);
  expect(tallies.find((t) => t.userId === old.builder.userId)?.answered).toBe(0);
  expect(tallies.find((t) => t.userId === edge.builder.userId)?.answered).toBe(1);
  const inviteAt = async (tag: string, at: string) => {
    const builder = await makeBuilder(`win90-${tag}@vnx.si`, `win90-${tag}`, "approved");
    const { request } = await makeRequest({ tag: `win90-${tag}-request`, now: at });
    const [invite] = await inviteBuilders(request, [builder], at);
    await run("UPDATE request_invites SET status = 'selected', responded_at = ?2 WHERE id = ?1", invite!.id, at);
    return builder;
  };
  const oldInvite = await inviteAt("old-invite", "2026-07-07T00:00:00.000Z");
  const edgeInvite = await inviteAt("edge-invite", "2026-07-08T00:00:00.000Z");
  const withInvites = await loadBuilderTallies(DB, NOW);
  expect(withInvites.find((t) => t.userId === oldInvite.userId)?.selected).toBe(0);
  expect(withInvites.find((t) => t.userId === edgeInvite.userId)?.selected).toBe(1);
});
```

Run `npm test -w apps/web -- test/db/public-stats.test.ts` → expected GREEN (these are deferred regression guards against the already-implemented `windowStart`; if a fixture timestamp is normalized, set that row's `submitted_at`/`opened_at` explicitly in this test, never change production code).

- [ ] **Step 2: Add hourly tests first (RED)**

Create `apps/web/test/jobs/hourly.test.ts`. It must cover all eleven keys, JSON `null` below threshold, repeat writes with a new timestamp, and query failure preservation/continuation:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_STAT_KEYS } from "../../src/domain/public-stats.ts";
import { runHourly } from "../../src/jobs/hourly.ts";
import { testEnv } from "../helpers.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";

const NOW = new Date("2026-10-05T12:05:00.000Z");
const LATER = new Date("2026-10-05T13:05:00.000Z");
const brokenOn = (fragment: string): D1Database => new Proxy(testEnv.DB, { get(db, prop) {
  if (prop === "prepare") return (sql: string) => sql.includes(fragment) ? (() => { throw new Error(`boom on ${fragment}`); })() : db.prepare(sql);
  const value = Reflect.get(db, prop) as unknown; return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(db) : value;
} }) as D1Database;
afterEach(() => vi.restoreAllMocks());
describe("hourly public-stat job", () => {
it("writes exactly PUBLIC_STAT_KEYS, including null below thresholds", async () => {
  await testEnv.DB.prepare("DELETE FROM public_stats").run();
  const results = await runHourly(testEnv, NOW);
  expect(results.map((r) => r.step)).toEqual([...PUBLIC_STAT_KEYS]);
  expect((await testEnv.DB.prepare("SELECT key, value FROM public_stats ORDER BY key").all()).results).toHaveLength(PUBLIC_STAT_KEYS.length);
  expect((await testEnv.DB.prepare("SELECT value FROM public_stats WHERE key = 'count_products'").first<{ value: string }>())?.value).toBe("null");
});

it("is idempotent for values while computed_at advances", async () => {
  await runHourly(testEnv, NOW); const before = await testEnv.DB.prepare("SELECT value FROM public_stats WHERE key = 'count_products'").first<{ value: string }>();
  await runHourly(testEnv, LATER); const after = await testEnv.DB.prepare("SELECT value, computed_at FROM public_stats WHERE key = 'count_products'").first<{ value: string; computed_at: string }>();
  expect(after?.value).toBe(before?.value); expect(after?.computed_at).toBe(LATER.toISOString());
});

it("keeps a prior row when one query fails and continues later keys", async () => {
  const oldAt = "2026-10-05T11:05:00.000Z";
  await writePublicStat(testEnv.DB, "growth", [{ week: "2026-W40", products: 1, builders: 1 }], oldAt);
  const results = await runHourly({ ...testEnv, DB: brokenOn("first_published_at") }, NOW);
  expect(results.find((r) => r.step === "growth")).toEqual({ job: "hourly", step: "growth", error: "Error: boom on first_published_at" });
  expect(await testEnv.DB.prepare("SELECT value, computed_at FROM public_stats WHERE key = 'growth'").first()).toEqual({ value: JSON.stringify([{ week: "2026-W40", products: 1, builders: 1 }]), computed_at: oldAt });
  expect(results.find((r) => r.step === "top_builders")).toHaveProperty("value");
});
});
```

Run `npm test -w apps/web -- test/jobs/hourly.test.ts` → expected RED because `src/jobs/hourly.ts` does not exist. Do not weaken the failure by mocking the public-stats loaders in this file; the D1 query/write boundary is the acceptance target.

- [ ] **Step 3: Add scheduler dispatch tests (RED)**

Create `apps/web/test/jobs/scheduled.test.ts` with hoisted module mocks so the test spies on dispatch without running either job:

```ts
import { expect, it, vi } from "vitest";
import { testEnv } from "../helpers.ts";
const daily = vi.hoisted(() => ({ runDaily: vi.fn(async () => []) }));
const hourly = vi.hoisted(() => ({ runHourly: vi.fn(async () => []) }));
vi.mock("../../src/jobs/daily.ts", () => daily);
vi.mock("../../src/jobs/hourly.ts", () => hourly);
import worker from "../../src/index.ts";

const call = async (cron: string) => {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
  await worker.scheduled?.({ cron, scheduledTime: Date.parse("2026-10-05T12:05:00.000Z"), noRetry() {} } as ScheduledController, testEnv, ctx);
  await Promise.all(pending); return pending;
};
it.each([["0 1 * * *", daily.runDaily], ["5 * * * *", hourly.runHourly]])("dispatches %s", async (cron, job) => { vi.clearAllMocks(); await call(cron); expect(job).toHaveBeenCalledWith(testEnv, new Date("2026-10-05T12:05:00.000Z")); });
it("warns and skips an unknown cron", async () => { vi.clearAllMocks(); const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); expect(await call("17 * * * *")).toHaveLength(0); expect(daily.runDaily).not.toHaveBeenCalled(); expect(hourly.runHourly).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledWith(JSON.stringify({ job: "scheduler", event: "unknown_cron", cron: "17 * * * *" })); });
```

Each test clears the hoisted mocks first (plan review M1: the dispatch cases leave call history that would break the unknown-cron `not.toHaveBeenCalled()` checks). Run `npm test -w apps/web -- test/jobs/scheduled.test.ts` → expected RED because the current handler only recognizes the daily cron and does not import `runHourly`.

- [ ] **Step 4: Implement `jobs/hourly.ts` minimally, then turn the hourly RED test GREEN**

Use this step table; do not add a Live/event job or a second writer:

```ts
import {
  MIN, PUBLIC_STAT_KEYS, countStat, liveEvents, rankTrending, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, weeklyGrowth,
  type PublicStatKey, type PublicStatValues,
} from "../domain/public-stats.ts";
import {
  loadBuilderTallies, loadCategoryCounts, loadCounts, loadGrowthDays, loadLiveEvents, loadProductCandidates, loadTrendingCandidates, writePublicStat,
} from "../db/public-stats.ts";
import type { Bindings } from "../env.ts";

type HourlyStep = { step: PublicStatKey; run: (env: Bindings, now: string) => Promise<PublicStatValues[PublicStatKey] | null> };
const STEPS: HourlyStep[] = [
  { step: "count_products", run: async (e, n) => countStat((await loadCounts(e.DB, n)).products, MIN.products) },
  { step: "count_builders", run: async (e, n) => countStat((await loadCounts(e.DB, n)).builders, MIN.builders) },
  { step: "count_requests_30d", run: async (e, n) => countStat((await loadCounts(e.DB, n)).requests30d, MIN.requests30d) },
  { step: "count_countries", run: async (e, n) => countStat((await loadCounts(e.DB, n)).countries, MIN.countries) },
  { step: "trending", run: async (e, n) => rankTrending(await loadTrendingCandidates(e.DB, n), n) },
  { step: "request_by_category", run: async (e, n) => { const x = await loadCategoryCounts(e.DB, n); return requestByCategory(x.requests, x.products); } },
  { step: "scarcest_category", run: async (e, n) => { const x = await loadCategoryCounts(e.DB, n); return scarcestCategory(x.requests, x.products); } },
  { step: "growth", run: async (e, n) => weeklyGrowth(await loadGrowthDays(e.DB), n) },
  { step: "top_builders", run: async (e, n) => topBuilders(await loadBuilderTallies(e.DB, n)) },
  { step: "top_products", run: async (e, n) => topProductsByCategory(await loadProductCandidates(e.DB, n)) },
  { step: "live", run: async (e, n) => liveEvents(await loadLiveEvents(e.DB, n), n) },
];

export type HourlyResult =
  | { job: "hourly"; step: PublicStatKey; value: PublicStatValues[PublicStatKey] | null; computedAt: string }
  | { job: "hourly"; step: PublicStatKey; error: string };
export async function runHourly(env: Bindings, now: Date): Promise<HourlyResult[]> {
  const iso = now.toISOString(); const results: HourlyResult[] = [];
  for (const { step, run } of STEPS) try {
    const value = await run(env, iso); await writePublicStat(env.DB, step, value, iso);
    const result: HourlyResult = { job: "hourly", step, value, computedAt: iso }; console.log(JSON.stringify(result)); results.push(result);
  } catch (err) { const result: HourlyResult = { job: "hourly", step, error: String(err) }; console.error(JSON.stringify(result)); results.push(result); }
  return results;
}
```

Run `npm test -w apps/web -- test/jobs/hourly.test.ts` → expected GREEN. Confirm the old `growth` row is unchanged after the forced query error; only a successful step may call `writePublicStat`.

- [ ] **Step 5: Wire dispatch, triggers, and architecture guard**

In `apps/web/src/index.ts`, import `runHourly` and replace the one-branch handler with:

```ts
scheduled(controller, env, ctx) {
  const now = new Date(controller.scheduledTime);
  if (controller.cron === "0 1 * * *") ctx.waitUntil(runDaily(env, now));
  else if (controller.cron === "5 * * * *") ctx.waitUntil(runHourly(env, now));
  else console.warn(JSON.stringify({ job: "scheduler", event: "unknown_cron", cron: controller.cron }));
},
```

In `apps/web/wrangler.jsonc`, set exactly `"triggers": { "crons": ["0 1 * * *", "5 * * * *"] }` and update the adjacent deploy comments to say daily clean-up runs at 01:00 UTC and the hourly `public_stats` snapshot runs at minute 05; retain the existing `0014`/`0016` migration order. In `apps/web/test/architecture.test.ts`, add `"../src/jobs/hourly.ts"` to `RANKING_FILES` and assert it is not in `MONEY_ALLOWED`; leave the allowlist contents unchanged. Run `npm test -w apps/web -- test/jobs/scheduled.test.ts test/architecture.test.ts` → expected GREEN.

- [ ] **Step 6: Focused acceptance and unchanged daily job**

Run `npm test -w apps/web -- test/jobs test/db/public-stats.test.ts test/architecture.test.ts` → expected GREEN. This must prove: both exact cron branches and unknown-cron skip; eleven rows/keys including `live` exactly once; below-threshold JSON `null`; same value is idempotent while `computed_at` advances; a failed query preserves its old row and later steps run; ranking code has no money access; and `runDaily` still has its prior steps and no view-dedupe purge. Re-run `npm test -w apps/web -- test/jobs/daily.test.ts test/jobs/daily-inquiries.test.ts test/jobs/daily-requests.test.ts` → expected GREEN. Do not add README/runbook files and do not deploy; Owner must verify the shared-account cron slot.

- [ ] **Step 7: Typecheck, full test, and commit instructions**

```text
npm run typecheck -w apps/web && npm test
git add apps/web/src/jobs/hourly.ts apps/web/src/index.ts apps/web/wrangler.jsonc apps/web/test/jobs/hourly.test.ts apps/web/test/jobs/scheduled.test.ts apps/web/test/db/public-stats.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): add hourly public stats cron (VNX-0702b)

Dispatch the daily and hourly triggers explicitly, isolate one snapshot write
per public stat key, and preserve prior snapshots when a query fails.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: typecheck and full `npm test` pass; `rg -n '"crons"' apps/web/wrangler.jsonc` shows both exact triggers; `git diff --stat` is about 300 lines and ≤600 lines excluding locale (none). Production migration/deploy and `ANALYTICS_SALT` remain Owner-controlled.

---

### Task 7a: VNX-0703a — Khối dữ liệu homepage (Con số, Trending hoặc Founding products)

**Trạng thái:** đã review (Opus), Owner duyệt câu chữ 2026-10-06.

**Tách 7a / 7b:** một Task 7 ước ~1100 dòng (mã ~650 + test ~450) vượt trần 600. 7a làm đường ống (route, `LandingPage` nhận khối dưới, `HomeBlocks`, helper định dạng, CSS nền, test chung) và hai khối đầu (Con số, Trending/Founding); 7b (Task 7b ngay sau) thêm Live, Market pulse bảng-trước, Top builders, Top products. (Live đã được chuyển sang 7b để 7a vừa trần 600; `homeView` vẫn trả `live` nhưng `HomeBlocks` của 7a chưa in nó.) Mỗi bên ≲ 600 dòng không tính locale.

**Scope:** (A2, Owner 2026-10-05) các khối dữ liệu nằm DƯỚI landing VNX-0708 ở `/`, landing giữ nguyên chữ và thứ tự. `routes/home.tsx#loadHomeData` đọc đúng MỘT truy vấn `readPublicStats`, `domain/public-stats.ts#homeView` chọn dữ liệu của từng khối (dữ liệu hoặc `null`), `views/home/HomeBlocks.tsx` chỉ ánh xạ từng trường sang `HomeSection`; mỗi khối chỉ hiện khi key của nó còn tươi (≤ 3 giờ) và khác `null`; không khối nào hiện thì không in ra gì (landing y nguyên từng byte của phần `<main>`). 7a có hai khối:
- **Con số** (4 ô theo `NUMBER_KEYS`, ẩn ô dưới ngưỡng, ẩn cả hàng nếu còn < 2 ô, nhãn "cập nhật mỗi giờ" chỉ khi hàng hiện, tức có `computed_at` thật).
- **Trending this week** (6 thẻ: số thứ hạng bằng CSS counter, sparkline SVG 14 ngày, % thay đổi) hoặc, khi Trending ẩn, **Founding products** (6 product có `first_published_at` mới nhất, mới trước).

**Hero và 4 khối tĩnh (4 ways, huy hiệu, khối builder, CTA cuối): KHÔNG làm gì.** Landing 0708 đã có đủ và Owner chọn A2. Hero của landing đã là "3 product nổi bật theo thứ tự mặc định của catalogue" (`firstPublicProducts` = `searchProducts(parseCatalogQuery({}))`, huy hiệu cao nhất rồi mới nhất, spec §8.7), đúng Owner Q1; test ở 7a chỉ KHÓA hành vi đó (không viết lại, không nhân đôi truy vấn). Thẻ "Your product here" của spec §5.9 vẫn là thẻ category của deck (đã duyệt ở 0708).

**Files:**
- Create: `apps/web/src/routes/home.tsx`, `apps/web/src/views/home/HomeSection.tsx`, `apps/web/src/views/home/HomeBlocks.tsx`, `apps/web/src/views/home/Numbers.tsx`, `apps/web/src/views/home/Trending.tsx` (Trending và Founding).
- Modify: `apps/web/src/domain/public-stats.ts` (thêm `NUMBER_KEYS`, `MIN_NUMBER_TILES`, `FOUNDING_LIMIT`, `FOUNDING_MIN`, `numberTiles`, `homeView`), `apps/web/src/db/catalog.ts` (`ITEM_COLUMNS`, `foundingProducts`), `apps/web/src/views/format.ts` (`formatCount`, `formatChange`, `SPARK_VIEWBOX`, `sparkPoints`), `apps/web/src/views/labels.ts` (`NUMBER_LABEL`), `apps/web/src/views/LandingPage.tsx` (prop `below`), `apps/web/src/routes/landing.tsx` (gọi `homeBlocks` ở GET), `apps/web/public/assets/app.css`, 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `apps/web/test/architecture.test.ts`, `apps/web/test/domain/public-stats.test.ts`.
- Test (create): `apps/web/test/home/blocks.ts` (helper dùng chung, 7b mở rộng), `apps/web/test/home/home.test.ts`, `apps/web/test/home/founding.test.ts`, `apps/web/test/home/separable.test.tsx`.
- Rerun only (không sửa): `test/landing/*` (gồm `test/landing/deck.test.ts`), `test/catalog/*`, `test/design/assets.test.ts`, `test/i18n/parity.test.ts`.

**Interfaces:**
- Consumes (thật): `readPublicStats(db, now): Promise<PublicSnapshot>`, `PublicSnapshot`, `MIN`, `REQUEST_DAYS`, `SPARK_DAYS`, `STALE_AFTER_MS`, `TrendingItem`, `writePublicStat`, `countStat`, `rankTrending` (`domain|db/public-stats.ts`); `CatalogItem`, `topBadge`, `BADGE_SCORE` (`domain/catalog.ts`); `PUBLIC_PRODUCT`, `JOINS`, `COVER_SQL`, `MIN_PRICE_SQL`, `BADGE_SCORE_SQL`, `ItemRow`, `toItem` (`db/catalog.ts`, nội bộ); `BADGE_KEY`, `CATEGORY_KEY` (`views/labels.ts`); `page`, `localizedPath`, `translator`; `makeLiveProduct`, `testEnv`.
- Produces: `NUMBER_KEYS`, `type NumberKey`, `MIN_NUMBER_TILES`, `FOUNDING_LIMIT = 6`, `FOUNDING_MIN = FOUNDING_LIMIT`, `type NumberTile`, `numberTiles(snapshot): NumberTile[] | null`; `foundingProducts(db, limit): Promise<CatalogItem[]>`; `homeView(snapshot, founding): HomeView`, `type HomeView`; `loadHomeData(db, now): Promise<HomeData | null>`, `renderHome(locale, data): Promise<Child | null>`, `homeBlocks(c): Promise<Child | null>`; `HomeSection`, `HomeBlocks`, `Numbers`, `Trending`, `Founding`; `formatCount`, `formatChange`, `SPARK_VIEWBOX`, `sparkPoints`; section ids `home-numbers`, `home-trending`, `home-founding`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Ngưỡng chỉ áp ở domain, view không tự quyết.** View chỉ hỏi "key còn trong snapshot không". Mọi con số đến từ `public_stats` (hoặc `MIN`/`*_DAYS` của domain, chỉ để điền tham số nhãn); view không có chữ số nào. Test grep mã `views/home/*.tsx` (không chữ số trừ thẻ `h1`–`h6`; tên khóa i18n, class và id không có chữ số; chú thích bị loại trước khi grep nên không cần tránh chữ số trong chú thích). Sparkline, tỉ lệ phần trăm và định dạng số nằm trong `views/format.ts`; ánh xạ khóa thống kê sang nhãn (`count_requests_30d` có chữ số) nằm ở `views/labels.ts#NUMBER_LABEL`. Cả hai ngoài thư mục `home/`, nơi chữ số được phép. Không viết chú thích `//` cuối dòng trong `views/home/*.tsx` (grep chỉ bỏ chú thích đứng riêng một dòng và `/* */`).
2. **Founding products là truy vấn trực tiếp, không phải key `public_stats`** (Task 5 không tạo key; spec §8.11 không có). Nó chỉ chạy khi Trending ẩn, `LIMIT 6`, trên `PUBLIC_PRODUCT` đã có chỉ mục; không có tham số trả tiền, không đọc bảng tiền (file `db/catalog.ts` đã nằm trong `RANKING_FILES`). Số `public_stats` vẫn đọc đúng một lần.
3. **Trending cũ (stale) cũng nhường chỗ cho Founding** (key vắng thì cùng nhánh với "dưới 6 product đủ điểm"). Giá trị "trending chỉ ẩn khi stale" không có truy vấn tự tính lại.
4. **Founding chỉ hiện khi có đủ `FOUNDING_MIN = FOUNDING_LIMIT` (6) product** (Owner 2026-10-06). 5 product thì ẩn, 6 thì hiện; test biên ở `founding.test.ts`.
5. **Lỗi thống kê không làm sập landing, cả lúc đọc lẫn lúc dựng:** `loadHomeData` có `try/catch` (đọc lỗi thì log `home_blocks_failed` và trả `null`); `renderHome` dựng HTML THÀNH CHUỖI ngay trong `try` (`await (<HomeBlocks/>).toString()` rồi `raw(...)`), nên một giá trị snapshot đúng JSON nhưng sai hình cũng chỉ log và bỏ khối, không 500 (hono dựng JSX lười; nếu không thì lỗi thoát khỏi `try`). Test: proxy ném lỗi khi `prepare` chứa `public_stats`; và một `trending` tươi nhưng sai hình.
6. **`LandingPage` nhận `below?: Child | null`** và in nó sau khối `#ask`, trong cùng `<main class="page-full">`; chỉ `GET /` truyền `below` (POST `/waitlist` lỗi vẫn dựng lại landing không có khối dữ liệu, tránh thêm truy vấn ở đường POST).
7. **Không `<script>`, không `style=`, không `on*=`** (CSP; Task 8 mới có JS). Thứ hạng là `<ol>` + CSS counter; sparkline là `<svg role="img">` với `<polyline points>`; nét vẽ nằm trong CSS.
8. **Khối không biết chỗ đặt (Owner: homepage ba cột sẽ dùng lại sau M7).** `HomeSection` là nơi DUY NHẤT có `<section class="lp-section home-block">`, `container`, `section-head`, `h2` và `aria-labelledby`; chỉ `HomeBlocks` gọi nó và giữ các id `home-*`. Mỗi khối (`Numbers`, `Trending`, `Founding`, và ở 7b `Live`, `MarketPulse`, `TopBuildersBlock`, `TopProductsBlock`) chỉ trả phần thân: props là dữ liệu, `locale`, và `now` (chỉ `Live`, ở 7b; `HomeBlocks` và `renderHome` của 7a chưa có `now`); ghi chú của khối đi cùng thân ("updated hourly", noPay và tiêu chí, dòng thứ tự). Việc chọn khối nào hiện là hàm thuần `homeView` ở domain; `HomeBlocks` trả `null` khi mọi trường là `null`. Test `separable.test.tsx`: dựng riêng từng thân, không có `<section`, `container`, lớp `lp-`.
9. **Tải song song:** ở `GET /`, `homeBlocks(c)` bắt đầu cùng lúc với truy vấn deck (`Promise.all` trong `renderLanding`); `homeBlocks` không bao giờ reject.

**Câu hỏi mở cho Owner (7a):** không còn. Owner 2026-10-06: `FOUNDING_MIN = 6`; tiêu đề Live, Top builders và Top products theo bảng ở 7b.

**Nhãn mới (nhãn dữ liệu trung tính, không có câu quảng bá):** 10 khóa `home.*` ở Step 3; "Updated hourly" là chữ spec §5.9 ("cập nhật mỗi giờ"), các tiêu đề là tên khối spec §5.9.

- [ ] **Step 1: Failing tests first (domain, helpers, route)**

Append to `apps/web/test/domain/public-stats.test.ts` (add `numberTiles`, `homeView`, `FOUNDING_MIN`, `type NumberKey`, `type PublicSnapshot` to its import from `domain/public-stats.ts`):

```ts
describe("numberTiles (spec §5.9): the numbers row needs two tiles", () => {
  const snap = (keys: NumberKey[]): PublicSnapshot => Object.fromEntries(keys.map((k) => [k, { value: 12, computedAt: NOW }]));
  it("is null under MIN_NUMBER_TILES tiles; otherwise the tiles in NUMBER_KEYS order", () => {
    expect(numberTiles(snap([]))).toBeNull();
    expect(numberTiles(snap(["count_countries"]))).toBeNull();
    expect(numberTiles(snap(["count_countries", "count_products"]))?.map((x) => x.key)).toEqual(["count_products", "count_countries"]);
  });
});

describe("homeView: what each homepage block gets, data or null", () => {
  const some = (n: number) => Array.from({ length: n }, (_, i) => i);
  it("founding needs FOUNDING_MIN items and only while Trending is absent", () => {
    expect(homeView({}, some(FOUNDING_MIN - 1)).founding).toBeNull();
    expect(homeView({}, some(FOUNDING_MIN)).founding).toHaveLength(FOUNDING_MIN);
    const trending = { trending: { value: [], computedAt: NOW } } as unknown as PublicSnapshot;
    expect(homeView(trending, some(FOUNDING_MIN)).founding).toBeNull();
  });
  it("every field is null for an empty snapshot; pulse needs chart 1 or chart 2", () => {
    expect(Object.values(homeView({}, [])).every((v) => v === null)).toBe(true);
    const growth = { growth: { value: [{ week: "w", products: 1, builders: 1 }], computedAt: NOW } } as PublicSnapshot;
    expect(homeView(growth, []).pulse).toEqual({ categories: null, scarcest: null, growth: [{ week: "w", products: 1, builders: 1 }] });
  });
});
```

Create `apps/web/test/home/blocks.ts` (shared with 7b, which extends `seedSnapshot`):

```ts
import { createApp } from "../../src/app.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { MIN, NUMBER_KEYS, rankTrending, type NumberKey, type TrendingCandidate } from "../../src/domain/public-stats.ts";
import { utcDay } from "../../src/domain/stats.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

export const DB = testEnv.DB;
/** A snapshot time that is fresh now (the route reads the real clock). */
export const fresh = (minutesAgo = 1): string => new Date(Date.now() - minutesAgo * 60_000).toISOString();
export const clearStats = () => DB.prepare("DELETE FROM public_stats").run();
export const getHome = async (path = "/", env: Bindings = testEnv, cookie?: string): Promise<string> =>
  (await createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, env)).text();
/** One block: the whole <section id="…">…</section>, or "" when it is not on the page. */
export const block = (html: string, id: string): string => new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? "";

export const COUNT_MIN: Record<NumberKey, number> = { count_products: MIN.products, count_builders: MIN.builders, count_requests_30d: MIN.requests30d, count_countries: MIN.countries };
export const trendingCandidates = (n: number, views: number = MIN.trendingScore): TrendingCandidate[] =>
  Array.from({ length: n }, (_, i) => ({ productId: `t${i}`, slug: `trend-${i}`, name: `Trend ${i}`, tagline: "Tagline", category: "crm" as const, builderHandle: `tb${i}`, builderName: `TB ${i}`, daily: { [utcDay(new Date())]: { views } } }));

/** Every key written exactly at its threshold: all blocks shown. 7b adds the remaining keys. */
export async function seedSnapshot(at = fresh()): Promise<void> {
  await clearStats();
  for (const key of NUMBER_KEYS) await writePublicStat(DB, key, COUNT_MIN[key], at);
  await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), new Date()), at);
}

/** A D1 that records every prepared SQL, and throws on a statement containing `failOn`. */
export function spyDb(sink: string[], failOn?: string): D1Database {
  return new Proxy(DB, {
    get(db, prop) {
      if (prop === "prepare") return (sql: string) => { if (failOn && sql.includes(failOn)) throw new Error(`boom on ${failOn}`); sink.push(sql); return db.prepare(sql); };
      const value = Reflect.get(db, prop) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(db) : value;
    },
  }) as D1Database;
}
```

Create `apps/web/test/home/home.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { testEnv } from "../helpers.ts";
import { MIN, NUMBER_KEYS, STALE_AFTER_MS, countStat, rankTrending } from "../../src/domain/public-stats.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { en, type MessageKey } from "../../src/i18n/messages/en.ts";
import { vi as viMessages } from "../../src/i18n/messages/vi.ts";
import { zhHans } from "../../src/i18n/messages/zh-hans.ts";
import { zhHant } from "../../src/i18n/messages/zh-hant.ts";
import { createApp } from "../../src/app.ts";
import { signIn } from "../fixtures.ts";
import { t } from "../../src/i18n/t.ts";
import { formatChange, sparkPoints, SPARK_VIEWBOX } from "../../src/views/format.ts";
import { COUNT_MIN, DB, block, clearStats, fresh, getHome, seedSnapshot, spyDb, trendingCandidates } from "./blocks.ts";

afterEach(() => vi.restoreAllMocks());
const tile = (key: string) => `data-stat="${key}"`;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("format helpers", () => {
  it("formatChange signs; sparkPoints is one point per value", () => {
    expect(formatChange("en", 25)).toBe("+25%");
    expect(formatChange("en", -10)).toMatch(/^[-−]10%$/);
    const points = sparkPoints([0, 5, 10]).split(" ");
    expect(points).toHaveLength(3);
    const ys = (s: string) => s.split(" ").map((p) => p.split(",")[1]);
    expect(new Set(ys(sparkPoints([0, 0, 0]))).size).toBe(1); // a flat series is one horizontal line
    expect(ys(sparkPoints([0, 5, 10]))[2]).not.toBe(ys(sparkPoints([0, 5, 10]))[0]);
    expect(SPARK_VIEWBOX).toMatch(/^0 0 \d+ \d+$/);
  });
});

describe("homepage blocks under the landing (VNX-0703a)", () => {
  it("prints nothing of its own when no snapshot is fresh, and the landing is intact", async () => {
    await clearStats();
    const html = await getHome();
    expect(html).not.toContain("home-block");
    expect(html).toContain('<section id="ask"');
  });

  it("puts the data blocks after the #ask block, inside <main>", async () => {
    await seedSnapshot();
    const html = await getHome();
    expect(html.indexOf('<section id="ask"')).toBeGreaterThan(0);
    expect(html.indexOf('id="home-numbers"')).toBeGreaterThan(html.indexOf('<section id="ask"'));
    expect(html.indexOf("</main>")).toBeGreaterThan(html.indexOf('id="home-trending"'));
  });

  it("Numbers: each tile hides at n-1 and shows at n; the others stay", async () => {
    for (const key of NUMBER_KEYS) {
      await seedSnapshot();
      await writePublicStat(DB, key, countStat(COUNT_MIN[key] - 1, COUNT_MIN[key]), fresh());
      const under = await getHome();
      expect(under, key).not.toContain(tile(key));
      for (const other of NUMBER_KEYS.filter((k) => k !== key)) expect(under, `${key}/${other}`).toContain(tile(other));
      await writePublicStat(DB, key, countStat(COUNT_MIN[key], COUNT_MIN[key]), fresh());
      expect(await getHome(), key).toContain(tile(key));
    }
  });

  it("Numbers: one tile left hides the row, two tiles show it; 'Updated hourly' only with the row", async () => {
    const at = fresh();
    await clearStats();
    await writePublicStat(DB, "count_products", MIN.products, at);
    let html = await getHome();
    expect(block(html, "home-numbers")).toBe("");
    expect(html).not.toContain(t("en", "home.updatedHourly"));
    await writePublicStat(DB, "count_countries", MIN.countries, at);
    html = await getHome();
    expect(count(block(html, "home-numbers"), "data-stat=")).toBe(2);
    expect(block(html, "home-numbers")).toContain(t("en", "home.updatedHourly"));
  });

  it("Trending: 5 products at the score threshold hide it, 6 show it; one point under the score hides it", async () => {
    const now = new Date();
    await clearStats();
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems - 1), now), fresh());
    expect(block(await getHome(), "home-trending")).toBe("");
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems, MIN.trendingScore - 1), now), fresh());
    expect(block(await getHome(), "home-trending")).toBe("");
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(MIN.trendingItems), now), fresh());
    const html = block(await getHome(), "home-trending");
    expect(count(html, '<li class="home-tile"')).toBe(MIN.trendingItems);
    expect(count(html, "<polyline")).toBe(MIN.trendingItems);
    expect(html).toContain("<ol");
  });

  it("a snapshot older than 3 hours hides every block; a fresh one shows them", async () => {
    await seedSnapshot(new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString());
    let html = await getHome();
    expect(html).not.toContain("home-block");
    expect(html).not.toContain(t("en", "home.updatedHourly"));
    await seedSnapshot();
    html = await getHome();
    for (const id of ["home-numbers", "home-trending"]) expect(block(html, id), id).not.toBe("");
  });

  it("reads public_stats exactly once per request, signed in, with and without Trending, in at most 8 statements", async () => {
    const { cookie } = await signIn("home-reader@vnx.si");
    for (const seed of [true, false]) {
      if (seed) await seedSnapshot(); else await clearStats();
      const sql: string[] = [];
      await getHome("/", { ...testEnv, DB: spyDb(sql) }, cookie);
      expect(sql.filter((s) => /\bpublic_stats\b/.test(s))).toHaveLength(1);
      expect(sql.length).toBeLessThanOrEqual(8);
    }
  });

  it("a failing public_stats read never breaks the landing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await getHome("/", { ...testEnv, DB: spyDb([], "public_stats") });
    expect(html).toContain('<section id="ask"');
    expect(html).not.toContain("home-block");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("home_blocks_failed"));
  });

  it("a fresh but malformed value drops the blocks, logs, and still returns the landing with 200", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seedSnapshot();
    await writePublicStat(DB, "trending", { bad: true } as never, fresh()); // valid JSON, wrong shape: the view throws while rendering
    const res = await createApp().request(new Request("https://vnx.si/"), undefined, testEnv);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<section id="ask"');
    expect(html).not.toContain("home-block");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("home_blocks_failed"));
  });

  it("no home.* value in any locale holds a digit (numbers come from data or parameters)", () => {
    for (const [name, messages] of Object.entries({ en, vi: viMessages, zhHans, zhHant })) {
      for (const [key, value] of Object.entries(messages)) if (key.startsWith("home.")) expect(value, `${name} ${key}`).not.toMatch(/\d/);
    }
  });

  it("adds no <script>, no inline style and no inline handler (CSP; scripts are Task 8)", async () => {
    await clearStats();
    const scripts = (h: string) => h.match(/<script\b/g)?.length ?? 0;
    const empty = await getHome();
    await seedSnapshot();
    const full = await getHome();
    expect(scripts(full)).toBe(scripts(empty));
    const region = full.slice(full.indexOf('class="lp-section home-block'), full.indexOf("</main>"));
    expect(region).not.toMatch(/<script|\sstyle=|\son[a-z]+=/i);
  });

  it("has no sponsored or paid wording in any locale", async () => {
    await seedSnapshot();
    for (const locale of LOCALES) {
      const html = await getHome(localizedPath(locale, "/"));
      const region = html.slice(html.indexOf('class="lp-section home-block'), html.indexOf("</main>")).replace(/<[^>]*>/g, " ").replace(String(t(locale, "home.builders.noPay" as MessageKey)), "");
      expect(region.length, locale).toBeGreaterThan(0);
      expect(region, locale).not.toMatch(/sponsor|advert|promot|paid|quảng cáo|trả tiền|赞助|贊助|广告|廣告|付费|付費/i);
    }
  });

  it("every home.* key is used by a view, and the home views hold no digit (no invented number)", () => {
    const views = import.meta.glob("../../src/views/home/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const files = Object.entries(views);
    expect(files.length).toBeGreaterThanOrEqual(4);
    const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<\/?h[1-6]\b/g, "");
    for (const [file, src] of files) expect(code(src), file).not.toMatch(/\d/);
    const shared = import.meta.glob("../../src/views/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const all = Object.values(shared).join("\n");
    for (const key of Object.keys(en).filter((k) => k.startsWith("home."))) expect(all, key).toContain(`"${key}"`);
  });
});
```

(`home.builders.noPay` arrives in 7b: until then `t` returns `undefined` for it and `String(...)` makes the `replace` a no-op; 7b Step 1 turns the cast into a plain typed call. The "no sponsored or paid wording" rule is not weakened for the rest of the region.)

Create `apps/web/test/home/founding.test.ts` (its tests share one D1 and run in this order):

```ts
import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { FOUNDING_LIMIT, FOUNDING_MIN, STALE_AFTER_MS, rankTrending } from "../../src/domain/public-stats.ts";
import { DECK_SIZE } from "../../src/views/landing/Deck.tsx";
import { makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { DB, block, clearStats, getHome, seedSnapshot, spyDb, trendingCandidates } from "./blocks.ts";

const at = (i: number) => new Date(Date.UTC(2026, 9, 1, i)).toISOString();
// p0 is the OLDEST and carries a badge: a badge must not lift it into Founding.
const add = (i: number) => makeLiveProduct(`fnd${i}@vnx.si`, `fnd-${i}`, `Founding p${i}`, { at: at(i), badges: i === 0 ? ["demo_verified"] : [] });
const names = (html: string) => [...new Set([...html.matchAll(/Founding p(\d)/g)].map((m) => Number(m[1])))];

describe("Founding products and the hero (Owner Q1 2026-10-05, minimum 2026-10-06)", () => {
  it("boundary: FOUNDING_MIN - 1 published products show no Founding block, FOUNDING_MIN show it", async () => {
    await clearStats();
    for (let i = 0; i < FOUNDING_MIN - 1; i++) await add(i);
    expect(block(await getHome(), "home-founding")).toBe("");
    await add(FOUNDING_MIN - 1);
    expect(names(block(await getHome(), "home-founding"))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("with one more, Founding keeps the FOUNDING_LIMIT newest first publications, newest first", async () => {
    await add(FOUNDING_LIMIT);
    const html = await getHome();
    const founding = block(html, "home-founding");
    expect(names(founding)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(founding).not.toContain("Founding p0");
    expect(block(html, "home-trending")).toBe("");
  });

  it("a product that is no longer published leaves Founding", async () => {
    await DB.prepare("UPDATE products SET status = 'unlisted' WHERE name = 'Founding p6'").run();
    expect(block(await getHome(), "home-founding")).not.toContain("Founding p6");
  });

  it("a fresh Trending runs no newest-products query and shows no Founding", async () => {
    await seedSnapshot();
    const sql: string[] = [];
    const html = await getHome("/", { ...testEnv, DB: spyDb(sql) });
    expect(sql.filter((s) => s.includes("first_published_at DESC"))).toHaveLength(0);
    expect(block(html, "home-founding")).toBe("");
    expect(block(html, "home-trending")).not.toBe("");
  });

  it("a stale Trending with enough published products shows Founding", async () => {
    await seedSnapshot();
    const old = new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString();
    await writePublicStat(DB, "trending", rankTrending(trendingCandidates(6), new Date()), old);
    const html = await getHome();
    expect(block(html, "home-trending")).toBe("");
    expect(block(html, "home-founding")).not.toBe("");
  });

  it("the landing hero keeps the catalogue default order (badge first, then newest) and Task 7 adds no hero", async () => {
    const expected = (await searchProducts(DB, parseCatalogQuery({}))).items.slice(0, DECK_SIZE).map((i) => i.slug);
    const html = await getHome();
    const hero = html.slice(html.indexOf('<section class="lp-hero"'), html.indexOf('<section class="lp-principles"'));
    const slugs = [...new Set([...hero.matchAll(/href="\/p\/([^"]+)"/g)].map((m) => m[1]))];
    expect(slugs).toEqual(expected);
    expect(html.match(/<section class="lp-hero"/g)).toHaveLength(1);
  });
});
```

(The hero test keeps its assertion; only the slug extraction may change to match the Deck markup.)

Create `apps/web/test/home/separable.test.tsx` (each body renders alone, with no wrapper, no container and no `lp-` class, so a later three-column homepage can reuse it; 7b adds its three bodies):

```tsx
import { describe, expect, it } from "vitest";
import { readPublicStats } from "../../src/db/public-stats.ts";
import { homeView } from "../../src/domain/public-stats.ts";
import { Numbers } from "../../src/views/home/Numbers.tsx";
import { Founding, Trending } from "../../src/views/home/Trending.tsx";
import { DB, seedSnapshot } from "./blocks.ts";

const item = { id: "i", slug: "s", name: "Item", tagline: "Tag", category: "crm" as const, builderHandle: "b", builderName: "B", coverKey: null, minPriceCents: null, badgeScore: 0 };

describe("blocks do not know where they sit", () => {
  it("each body renders alone with no section, container or lp- class", async () => {
    await seedSnapshot();
    const view = homeView(await readPublicStats(DB, new Date()), [item]);
    const bodies = {
      numbers: <Numbers locale="en" tiles={view.numbers!} />,
      trending: <Trending locale="en" items={view.trending!} />,
      founding: <Founding locale="en" items={[item]} />,
    };
    for (const [name, node] of Object.entries(bodies)) {
      const html = String(await node);
      expect(html.length, name).toBeGreaterThan(0);
      expect(html, name).not.toMatch(/<section\b|class="[^"]*\bcontainer\b|class="[^"]*\blp-/);
    }
  });
});
```

Run `npm test -w apps/web -- test/domain/public-stats.test.ts test/home` → expected RED: `numberTiles`, `views/format.ts` exports, `FOUNDING_LIMIT` and `home.*` keys do not exist, no `home-*` sections on `GET /`.

- [ ] **Step 2: Domain and catalogue query**

In `apps/web/src/domain/public-stats.ts`, after `countStat`, add:

```ts
// ---- Homepage "Numbers" and "Founding products" (VNX-0703) ----
export const NUMBER_KEYS = ["count_products", "count_builders", "count_requests_30d", "count_countries"] as const satisfies readonly PublicStatKey[];
export type NumberKey = (typeof NUMBER_KEYS)[number];
/** Spec §5.9: the numbers row hides when fewer than two tiles are left. */
export const MIN_NUMBER_TILES = 2;
/** Owner Q1 (2026-10-05): the Founding products block shows the 6 newest first publications. */
export const FOUNDING_LIMIT = 6;
/** Owner 2026-10-06: the Founding products block waits until there are as many products as it shows. */
export const FOUNDING_MIN = FOUNDING_LIMIT;
export type NumberTile = { key: NumberKey; value: number; computedAt: string };

/** The tiles whose key is fresh and not null, in NUMBER_KEYS order; null when fewer than MIN_NUMBER_TILES. */
export function numberTiles(snapshot: PublicSnapshot): NumberTile[] | null {
  const tiles = NUMBER_KEYS.flatMap((key): NumberTile[] => {
    const hit = snapshot[key];
    return hit ? [{ key, value: hit.value, computedAt: hit.computedAt }] : [];
  });
  return tiles.length >= MIN_NUMBER_TILES ? tiles : null;
}

/** What each homepage block gets: its data, or null (hide). Pure; `HomeBlocks` only maps fields to wrappers. */
export type HomeView<F> = {
  numbers: NumberTile[] | null;
  live: PublicLiveEvent[] | null;
  trending: TrendingItem[] | null;
  founding: readonly F[] | null;
  pulse: { categories: CategoryRow[] | null; scarcest: ScarcestCategory | null; growth: GrowthPoint[] | null } | null;
  builders: TopBuilders | null;
  products: TopProductsByCategory | null;
};
export function homeView<F>(snapshot: PublicSnapshot, founding: readonly F[]): HomeView<F> {
  const trending = snapshot.trending?.value ?? null;
  const categories = snapshot.request_by_category?.value ?? null;
  const growth = snapshot.growth?.value ?? null;
  return {
    numbers: numberTiles(snapshot),
    live: snapshot.live?.value ?? null,
    trending,
    founding: trending === null && founding.length >= FOUNDING_MIN ? founding : null,
    pulse: categories || growth ? { categories, scarcest: snapshot.scarcest_category?.value ?? null, growth } : null,
    builders: snapshot.top_builders?.value ?? null,
    products: snapshot.top_products?.value ?? null,
  };
}
```
(`PublicSnapshot` is declared further down the file; a type reference before its declaration is fine in TypeScript.)

In `apps/web/src/db/catalog.ts`, extract the select list shared by the browse query and the new one (a 4-line, behaviour-preserving change guarded by `test/catalog/*`):

```ts
const ITEM_COLUMNS = `p.id, p.slug, p.name, p.tagline, p.category, b.handle AS builder_handle, b.name AS builder_name,
  ${COVER_SQL} AS cover_key, ${MIN_PRICE_SQL} AS min_price_cents, ${BADGE_SCORE_SQL} AS badge_score`;
```
In `searchProducts` replace the inline column list with `SELECT ${ITEM_COLUMNS}`. Then add, after `searchProducts`:

```ts
/**
 * Homepage "Founding products" (Owner Q1): the newest first publications, newest first. Not a ranking: no badge, view or
 * inquiry count reaches the order (ADR-004).
 */
export async function foundingProducts(db: D1Database, limit: number): Promise<CatalogItem[]> {
  const { results } = await db
    .prepare(`SELECT ${ITEM_COLUMNS} FROM products p ${JOINS} WHERE ${PUBLIC_PRODUCT} ORDER BY p.first_published_at DESC, p.id DESC LIMIT ?1`)
    .bind(limit)
    .all<ItemRow>();
  return results.map(toItem);
}
```

Run `npm test -w apps/web -- test/domain/public-stats.test.ts test/catalog` → expected GREEN.

- [ ] **Step 3: Locale keys (10, all four locales)**

Append before the closing brace of each of `en.ts`, `vi.ts`, `zh-hans.ts`, `zh-hant.ts` (placeholders `{days}` are identical in every locale; no apostrophes, quotes or `&` in any value):

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `home.updatedHourly` | Updated hourly | Cập nhật mỗi giờ | 每小时更新 | 每小時更新 |
| `home.numbers.title` | Numbers | Con số | 数据 | 數據 |
| `home.numbers.products` | Products published | Sản phẩm đã đăng | 已发布的产品 | 已發佈的產品 |
| `home.numbers.builders` | Builders approved | Builder đã được duyệt | 已通过审核的 Builder | 已通過審核的 Builder |
| `home.numbers.requests` | Requests in the last {days} days | Nhu cầu trong {days} ngày qua | 过去 {days} 天的需求 | 過去 {days} 天的需求 |
| `home.numbers.countries` | Builder countries | Quốc gia của builder | Builder 所在国家 | Builder 所在國家 |
| `home.trending.title` | Trending this week | Thịnh hành tuần này | 本周热门 | 本週熱門 |
| `home.trending.vsPrevious` | vs previous week | so với tuần trước | 较上周 | 較上週 |
| `home.trending.spark` | Activity, last {days} days | Hoạt động {days} ngày qua | 过去 {days} 天的活跃度 | 過去 {days} 天的活躍度 |
| `home.founding.title` | Founding products | Sản phẩm sáng lập | 创始产品 | 創始產品 |

Run `npm test -w apps/web -- test/i18n/parity.test.ts` → GREEN (the `home.*` "used by a view" check in `home.test.ts` stays red until Step 5).

- [ ] **Step 4: Format helpers**

Append to `apps/web/src/views/labels.ts` (add `import type { NumberKey } from "../domain/public-stats.ts";`):

```ts
export const NUMBER_LABEL: Record<NumberKey, MessageKey> = {
  count_products: "home.numbers.products",
  count_builders: "home.numbers.builders",
  count_requests_30d: "home.numbers.requests",
  count_countries: "home.numbers.countries",
};
```

Append to `apps/web/src/views/format.ts` (this file, not `views/home/`, may hold digits):

```ts
const PERCENT = 100;
const round = (n: number): number => Math.round(n * 10) / 10;

export const formatCount = (locale: Locale, n: number): string => new Intl.NumberFormat(locale).format(n);
/** A whole percent change with its sign ("+25%"); zero has none. */
export const formatChange = (locale: Locale, pct: number): string => new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero" }).format(pct / PERCENT);

/** A 14-day sparkline drawn as one polyline in a fixed box; the stroke lives in CSS. */
const SPARK = { width: 112, height: 32, pad: 2 } as const;
export const SPARK_VIEWBOX = `0 0 ${SPARK.width} ${SPARK.height}`;
export function sparkPoints(values: readonly number[]): string {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (SPARK.width - 2 * SPARK.pad) / (values.length - 1) : 0;
  return values.map((v, i) => `${round(SPARK.pad + i * step)},${round(SPARK.height - SPARK.pad - (v / max) * (SPARK.height - 2 * SPARK.pad))}`).join(" ");
}
```

- [ ] **Step 5: Views, route, landing wiring, CSS**

`apps/web/src/views/home/HomeSection.tsx` (the ONLY place that knows how a block sits on the page):

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";

export const HomeSection: FC<PropsWithChildren<{ id: string; title: string }>> = ({ id, title, children }) => (
  <section id={id} class="lp-section home-block" aria-labelledby={`${id}-title`}>
    <div class="container">
      <div class="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </div>
  </section>
);
```

`apps/web/src/views/home/HomeBlocks.tsx` (the only caller of `HomeSection`; `view.live` is not rendered until 7b; 7b adds four entries and `now`):

```tsx
import type { FC } from "hono/jsx";
import type { CatalogItem } from "../../domain/catalog.ts";
import type { HomeView } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { HomeSection } from "./HomeSection.tsx";
import { Numbers } from "./Numbers.tsx";
import { Founding, Trending } from "./Trending.tsx";

export type HomeBlocksProps = { locale: Locale; view: HomeView<CatalogItem> };

/** The data blocks under the landing (Owner A2). Which blocks show was decided by `homeView`; with none, nothing prints. */
export const HomeBlocks: FC<HomeBlocksProps> = ({ locale, view }) => {
  const tr = translator(locale);
  const blocks = [
    view.numbers ? <HomeSection id="home-numbers" title={tr("home.numbers.title")}><Numbers locale={locale} tiles={view.numbers} /></HomeSection> : null,
    view.trending ? <HomeSection id="home-trending" title={tr("home.trending.title")}><Trending locale={locale} items={view.trending} /></HomeSection> : null,
    view.founding ? <HomeSection id="home-founding" title={tr("home.founding.title")}><Founding locale={locale} items={view.founding} /></HomeSection> : null,
  ].filter((b) => b !== null);
  return blocks.length === 0 ? null : <>{blocks}</>;
};
```

`apps/web/src/views/home/Numbers.tsx` (body only; the "updated hourly" note travels with it and is true because the tiles are fresh and at least two):

```tsx
import type { FC } from "hono/jsx";
import { REQUEST_DAYS, type NumberTile } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount } from "../format.ts";
import { NUMBER_LABEL } from "../labels.ts";

export const Numbers: FC<{ locale: Locale; tiles: readonly NumberTile[] }> = ({ locale, tiles }) => {
  const tr = translator(locale);
  return (
    <>
      <p class="home-note">{tr("home.updatedHourly")}</p>
      <ul class="home-numbers">
        {tiles.map((tile) => (
          <li data-stat={tile.key}>
            <strong>{formatCount(locale, tile.value)}</strong>
            <span>{tr(NUMBER_LABEL[tile.key], { days: REQUEST_DAYS })}</span>
          </li>
        ))}
      </ul>
    </>
  );
};
```

`apps/web/src/views/home/Trending.tsx` (bodies only; ranking file, so its comments must not contain the words listed in the architecture test of Step 6):

```tsx
import type { FC } from "hono/jsx";
import { topBadge, type CatalogItem } from "../../domain/catalog.ts";
import { SPARK_DAYS, type TrendingItem } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatChange, SPARK_VIEWBOX, sparkPoints } from "../format.ts";
import { BADGE_KEY, CATEGORY_KEY } from "../labels.ts";

type TileMeta = { slug: string; name: string; tagline: string; category: CatalogItem["category"]; builderName: string };

const Meta: FC<{ locale: Locale; item: TileMeta }> = ({ locale, item }) => {
  const tr = translator(locale);
  return (
    <>
      <h3><a href={localizedPath(locale, `/p/${item.slug}`)}>{item.name}</a></h3>
      <p>{item.tagline}</p>
      <p class="muted">
        {item.category ? `${tr(CATEGORY_KEY[item.category])} · ` : null}
        {tr("catalog.by", { name: item.builderName })}
      </p>
    </>
  );
};

/** Rank = CSS counter on the ordered list; the score itself is not shown, only its 14-day shape and the change on the week before. */
export const Trending: FC<{ locale: Locale; items: readonly TrendingItem[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  return (
    <ol class="home-tiles home-ranked">
      {items.map((item) => (
        <li class="home-tile">
          <Meta locale={locale} item={item} />
          <p class="home-trend">
            <svg class="home-spark" viewBox={SPARK_VIEWBOX} role="img" aria-label={tr("home.trending.spark", { days: SPARK_DAYS })}>
              <polyline points={sparkPoints(item.sparkline)} />
            </svg>
            {item.changePct !== null ? (
              <span>
                <strong>{formatChange(locale, item.changePct)}</strong> <span class="muted">{tr("home.trending.vsPrevious")}</span>
              </span>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
};

/** Shown in place of Trending: the newest first publications, newest first. */
export const Founding: FC<{ locale: Locale; items: readonly CatalogItem[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  return (
    <ul class="home-tiles">
      {items.map((item) => {
        const badge = topBadge(item.badgeScore);
        return (
          <li class="home-tile">
            <Meta locale={locale} item={item} />
            {badge ? <p><span class={`chip chip-${badge}`}>{tr(BADGE_KEY[badge])}</span></p> : null}
          </li>
        );
      })}
    </ul>
  );
};
```

`apps/web/src/routes/home.tsx` (loading and rendering are separate; no word from the architecture test's money list in comments):

```tsx
import type { Context } from "hono";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { foundingProducts } from "../db/catalog.ts";
import { readPublicStats } from "../db/public-stats.ts";
import type { CatalogItem } from "../domain/catalog.ts";
import { FOUNDING_LIMIT, homeView, type PublicSnapshot } from "../domain/public-stats.ts";
import type { AppEnv } from "../env.ts";
import type { Locale } from "../i18n/locales.ts";
import { HomeBlocks } from "../views/home/HomeBlocks.tsx";

export type HomeData = { snapshot: PublicSnapshot; founding: CatalogItem[] };
const fail = (err: unknown) => console.error(JSON.stringify({ event: "home_blocks_failed", error: String(err) }));

/** One public_stats read; the newest-products query runs only while Trending is absent. A failure here never takes the landing down. */
export async function loadHomeData(db: D1Database, now: Date): Promise<HomeData | null> {
  try {
    const snapshot = await readPublicStats(db, now);
    return { snapshot, founding: snapshot.trending ? [] : await foundingProducts(db, FOUNDING_LIMIT) };
  } catch (err) {
    fail(err);
    return null;
  }
}

/** Renders to a string INSIDE the try: hono builds JSX lazily, so a malformed snapshot value would otherwise throw after the try. */
export async function renderHome(locale: Locale, data: HomeData | null): Promise<Child | null> {
  if (data === null) return null;
  try {
    return raw(await (<HomeBlocks locale={locale} view={homeView(data.snapshot, data.founding)} />).toString());
  } catch (err) {
    fail(err);
    return null;
  }
}

/** The data blocks under the landing at `/` (Owner A2). Never rejects. */
export async function homeBlocks(c: Context<AppEnv>): Promise<Child | null> {
  const now = new Date();
  return renderHome(c.get("locale"), await loadHomeData(c.env.DB, now));
}
```

`apps/web/src/views/LandingPage.tsx`: add `import type { Child } from "hono/jsx";` (merge with the existing `FC` import), the prop `/** The data blocks under the landing (VNX-0703, Owner A2); null/absent prints nothing. */ below?: Child | null;`, destructure `below`, and render `{below}` right after the `#ask` `</section>`, before `</Layout>`.

`apps/web/src/routes/landing.tsx`: import `homeBlocks` from `./home.tsx` and `type { Child } from "hono/jsx"`; add `below?: Promise<Child | null>` to `RenderOpts`; in `renderLanding` replace the deck await with `const [deck, below] = await Promise.all([firstPublicProducts(c.env.DB, DECK_SIZE), opts.below ?? null]);` (deck and blocks load in parallel) and pass `below={below}` to `<LandingPage>`; the GET handler passes `below: homeBlocks(c)` WITHOUT awaiting it (it never rejects). The POST `/waitlist` renders stay without `below`.

Append to `apps/web/public/assets/app.css` (tokens only, so dark mode follows; no animation, Task 8 adds it):

```css
/* VNX-0703: data blocks under the landing (public_stats). */
.home-block { padding: 56px 0; background: var(--bg); border-top: 1px solid var(--border); }
.home-block + .home-block { background: var(--surface); }
.home-note { margin: 0 0 24px; color: var(--text-2); font-size: 17px; }
.home-numbers { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 16px; }
.home-numbers li { display: flex; flex-direction: column; gap: 4px; padding: 20px 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
.home-numbers strong { font: 700 clamp(32px, 4vw, 44px)/1.1 var(--font-display); }
.home-numbers span { color: var(--text-2); }
.home-tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; counter-reset: rank; }
.home-tile { display: flex; flex-direction: column; gap: 8px; padding: 20px 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
.home-tile h3, .home-tile h4 { margin: 0; font-size: 18px; }
.home-tile p { margin: 0; }
.home-ranked > .home-tile { counter-increment: rank; }
.home-ranked > .home-tile::before { content: counter(rank); color: var(--muted); font: 400 13px/1.4 var(--font-mono); }
.home-trend { display: flex; align-items: center; gap: 12px; }
.home-spark { width: 112px; height: 32px; flex: none; color: var(--primary); }
.home-spark polyline { fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
```

Run `npm test -w apps/web -- test/home test/domain/public-stats.test.ts test/landing test/design test/i18n` → expected GREEN (including `test/landing/deck.test.ts`, unedited). If `test/home/home.test.ts` "every home.* key is used" or the digits grep fails, fix the VIEW (move the digit into `views/format.ts` or a domain constant), never weaken the grep.

- [ ] **Step 6: Architecture guard**

In `apps/web/test/architecture.test.ts` add to `RANKING_FILES` (after the `jobs/hourly.ts` line):

```ts
  // VNX-0703a: homepage data blocks (Trending, Founding products).
  "../src/routes/home.tsx",
  "../src/views/home/Trending.tsx",
```
and, after the "public statistics files are ranking files and mention no money" test, add:

```ts
  it("the homepage ranking files are listed and mention no money (VNX-0703)", () => {
    for (const file of ["../src/routes/home.tsx", "../src/views/home/Trending.tsx"]) {
      expect(RANKING_FILES, file).toContain(file);
      expect(sources[file] ?? "", file).not.toMatch(/sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|outbound_clicks/i);
    }
  });
```
Run `npm test -w apps/web -- test/architecture.test.ts` → GREEN (the existing "lists only files that exist", import and SQL checks now cover both files). Keep those words out of the two files' comments too.

- [ ] **Step 7: Focused acceptance, typecheck, full test, commit**

`npm test -w apps/web -- test/home test/domain test/catalog test/landing test/design test/i18n test/architecture.test.ts`, then:

```text
npm run typecheck -w apps/web && npm test
git add apps/web/src/domain/public-stats.ts apps/web/src/db/catalog.ts apps/web/src/views/format.ts apps/web/src/views/LandingPage.tsx apps/web/src/views/home/HomeSection.tsx apps/web/src/views/home/HomeBlocks.tsx apps/web/src/views/home/Numbers.tsx apps/web/src/views/home/Trending.tsx apps/web/src/routes/home.tsx apps/web/src/routes/landing.tsx apps/web/public/assets/app.css apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/home/blocks.ts apps/web/test/home/home.test.ts apps/web/test/home/founding.test.ts apps/web/test/home/separable.test.tsx apps/web/test/domain/public-stats.test.ts apps/web/test/architecture.test.ts
git commit -m "feat(web): add Numbers and Trending blocks under the landing (VNX-0703a)

Read one public_stats snapshot per request and show each block only when its
fresh value exists; Founding products (newest first publications) replaces a
hidden Trending. The landing and its hero are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Acceptance (mỗi dòng kiểm được bằng một lệnh):**
- Con số: từng ô ẩn ở n−1 và hiện ở n; ẩn hàng khi còn 1 ô; "Updated hourly" chỉ khi có hàng: `npm test -w apps/web -- test/home/home.test.ts -t "Numbers"`; `numberTiles`: `test/domain/public-stats.test.ts`.
- Trending ẩn ở 5 product và ở điểm 19, hiện ở 6: `-t "Trending"`. Quá 3 giờ ẩn hết: `-t "older than 3 hours"`.
- Founding: 5 product thì không có `home-founding`, 6 thì hiện; 6 mới nhất trước, không bị huy hiệu đẩy lên, product bỏ published thì rời; Trending tươi thì không chạy truy vấn `first_published_at DESC`, Trending cũ thì Founding hiện: `test/home/founding.test.ts`. Hero của landing giữ thứ tự catalogue mặc định, không có hero thứ hai: cùng file.
- Đúng một truy vấn `public_stats` mỗi request (đã đăng nhập, ≤ 8 câu lệnh), lỗi đọc và giá trị sai hình không làm sập landing: `-t "exactly once"`, `-t "never breaks the landing"`, `-t "malformed"`. Khối không biết chỗ đặt: `npm test -w apps/web -- test/home/separable.test.tsx`. Không chữ số trong `home.*` ở 4 locale: `-t "holds a digit"`.
- Không `<script>`/`style=`/`on*=` thêm, không chữ "Sponsored"/trả tiền ở 4 locale: `-t "adds no <script>"`, `-t "sponsored or paid"`.
- Không chữ số cứng trong `views/home/*.tsx`, mọi khóa `home.*` được dùng: `-t "no invented number"`; `grep -nE "[0-9]" apps/web/src/views/home/*.tsx` chỉ còn thẻ `h1`-`h6` và chú thích.
- Xếp hạng không đọc tiền: `npm test -w apps/web -- test/architecture.test.ts` xanh; `grep -n "views/home/Trending\|routes/home" apps/web/test/architecture.test.ts` thấy cả hai trong `RANKING_FILES`.
- Landing nguyên vẹn khi không có dữ liệu: `npm test -w apps/web -- test/landing` xanh không sửa test; `git diff --stat -- apps/web/migrations` rỗng; `git diff package.json` rỗng.
- `npm run typecheck -w apps/web` và `npm test` xanh.

Diff ước ~600 dòng không tính locale (mã ~300, test ~300; locale +40 dòng). Live đã nằm ở 7b; nếu vẫn vượt trần khi làm, báo Controller, không cắt test.

---

### Task 7b: VNX-0703b — Live, Market pulse (bảng), Top builders, Top products

**Trạng thái:** đã review (Opus), Owner duyệt câu chữ 2026-10-06.

**Scope:** thêm bốn khối vào `HomeBlocks` của 7a (Live chuyển từ 7a sang để 7a vừa trần), cùng quy tắc: hiện chỉ khi key còn tươi và khác `null`, không chữ số cứng, không JS. Phụ thuộc: Task 7a đã commit.
- **Live** (khối thứ hai của trang, sau Con số): danh sách tĩnh các sự kiện công khai (tối đa 20, ẩn khi < 5 trong 7 ngày, domain đã quyết) kèm thời gian tương đối; tiêu đề "Recent activity". Dải chạy ngang là Task 8. `HomeBlocks` và `renderHome` nhận thêm `now`.
- **Market pulse:** chart 1 thay bằng bảng "request và product đang listed theo category" (category dưới 3 request đã gộp "Other" ở domain), kèm một dòng nhãn+giá trị "category thiếu supply nhất"; chart 2 thay bằng bảng product và builder cộng dồn theo tuần ISO. Mỗi bảng ẩn riêng khi key của nó vắng; cả khối ẩn khi cả hai vắng. (Task 8 thêm chart SVG, legend, tooltip; bảng trở thành `<details>` tương đương.)
- **Top builders:** ba bảng (được chọn, trả lời nhanh, nhiều product được xác minh), mỗi bảng chỉ hiện khi tab có ≥ 3 builder đủ điều kiện (domain đã trả `null` cho tab đó); mỗi bảng ghi tiêu chí của nó, và cả khối ghi "no one pays to appear here". Không còn tab nào thì ẩn khối. (Chuyển tab bằng JS là Task 8; ở 7b ba bảng xếp dọc.)
- **Top products theo category:** hàng nút neo category (chỉ category có ≥ 1 product) và, mỗi category, tối đa 3 product theo huy hiệu rồi Inquiry 30 ngày rồi mới nhất (đã xếp ở domain; view chỉ in đúng thứ tự đó).

**Files:**
- Create: `apps/web/src/views/home/Live.tsx`, `apps/web/src/views/home/MarketPulse.tsx`, `apps/web/src/views/home/TopBuilders.tsx` (xuất `TopBuildersBlock`), `apps/web/src/views/home/TopProducts.tsx` (xuất `TopProductsBlock`), `apps/web/test/home/blocks-b.test.ts`.
- Modify: `apps/web/test/home/separable.test.tsx` (thêm bốn thân), `apps/web/src/views/home/HomeBlocks.tsx`, `apps/web/src/routes/home.tsx` (`now` vào `renderHome`), `apps/web/src/views/format.ts` (`MS`, `relativeTime`, `formatDuration`), `apps/web/public/assets/app.css`, 4 file i18n, `apps/web/test/home/blocks.ts` (`seedSnapshot` ghi nốt 5 key), `apps/web/test/home/home.test.ts` (đổi ba chỗ, xem Step 1), `apps/web/test/architecture.test.ts`.
- Rerun only: `test/home/*`, `test/landing/*`, `test/design/assets.test.ts`, `test/i18n/parity.test.ts`.

**Interfaces:**
- Consumes (thật): `PublicLiveEvent`, `LIVE_MAX`, `liveEvents`, `LiveEvent`, `BADGE_KEY`, `LANGUAGE_KEY`, `CategoryRow`, `ScarcestCategory`, `GrowthPoint`, `TopBuilders` (type), `TopProductsByCategory`, `MIN`, `BUILDER_DAYS`, `REQUEST_DAYS`, `requestByCategory`, `scarcestCategory`, `weeklyGrowth`, `topBuilders`, `topProductsByCategory`, `type BuilderTally`, `type ProductCandidate` (`domain/public-stats.ts`); `CATEGORIES` (`domain/product.ts`); `topBadge`, `BADGE_SCORE` (`domain/catalog.ts`); `formatCount`, `HomeBlocks`, `block`, `fresh`, `DB`, `getHome`, `seedSnapshot` (7a).
- Produces: `Live`, `MarketPulse`, `TopBuildersBlock`, `TopProductsBlock`, `relativeTime`, `formatDuration`, `eventList` (test helper); section ids `home-live`, `home-pulse`, `home-builders`, `home-products`; `data-tab="selected|fast|verified"`; chip anchors `#home-top-<category>`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Live chuyển từ 7a sang 7b** (trần 600 dòng). `homeView` của 7a đã trả `live`; 7a không in nó. 7b thêm `now` cho `HomeBlocks` và `renderHome`. Thời gian tương đối tính ở server theo `now` của request (`Intl.RelativeTimeFormat`); `<time datetime>` giữ thời điểm thật; chữ số trong nhãn đến từ `Intl`, là định dạng (`relativeTime` nằm ở `views/format.ts`).
2. **Tab Top builders là ba bảng, không tab giả bằng CSS.** Không JS thì mọi tiêu chí hiện cùng lúc, đúng "ghi rõ tiêu chí". Task 8 có thể bọc thành tab.
3. **Tiêu chí lấy tham số từ domain** (`BUILDER_DAYS`, `MIN.selected|fastSamples|verified`), không viết số vào chuỗi hay view: đổi ngưỡng ở domain thì chữ đổi theo.
4. **"Category thiếu supply" nằm trong khung của bảng 1** (cùng điều kiện tổng ≥ 10 ở domain, nên không bao giờ hiện khi bảng 1 ẩn).
5. **Tên category "Other" dùng nhãn category sẵn có** (`product.category.other`); view không biết "Other" là gộp hay thật (domain đã gộp).
6. **`MarketPulse` nhận `categories`, `scarcest`, `growth` dạng `null` được**, vì chúng là ba key độc lập; `homeView` đã quyết `pulse` là `null` khi cả `categories` và `growth` vắng.
7. **Thân thuần, không biết chỗ đặt** (quyết định 8 của 7a): `Live`, `MarketPulse`, `TopBuildersBlock`, `TopProductsBlock` không có `<section>`, `container` hay `h2`; `HomeBlocks` bọc từng khối bằng `HomeSection`. noPay, tiêu chí và dòng thứ tự nằm TRONG thân.
8. **Mọi chuỗi mới tránh dấu nháy đơn, `&`, `<`** (để test so chuỗi với HTML đã escape).

**Câu chữ đã duyệt:** năm câu `home.builders.noPay`, `home.builders.criteria.selected|fast|verified`, `home.products.order` được Owner duyệt NGUYÊN VĂN ở cả 4 locale (2026-10-06), đúng bảng Step 2; tiêu đề Top builders và Top products theo bảng Step 2 (Owner 2026-10-06). Không còn câu hỏi mở.

- [ ] **Step 1: Failing tests first**

Extend `apps/web/test/home/blocks.ts` `seedSnapshot` (add imports `liveEvents`, `requestByCategory`, `scarcestCategory`, `weeklyGrowth`, `topBuilders`, `topProductsByCategory`, `type LiveEvent`, `type BuilderTally`, `type ProductCandidate` from `domain/public-stats.ts`) and export the builders the tests use:

```ts
export const eventList = (n: number): LiveEvent[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}`, at: new Date(Date.now() - (i + 1) * 60_000).toISOString(), kind: "product_published" as const, productName: `Live product ${i}`, slug: `live-${i}` }));
export const tally = (i: number, over: Partial<BuilderTally> = {}): BuilderTally => ({ userId: `u${i}`, handle: `tb-${i}`, name: `Top builder ${i}`, selected: 0, answered: 0, replyMinutes: [], verified: 0, ...over });
export const candidate = (i: number, over: Partial<ProductCandidate> = {}): ProductCandidate => ({ id: `p${i}`, slug: `tp-${i}`, name: `Top product ${i}`, category: "crm", builderHandle: "tb", builderName: "TB", badgeScore: 1, inquiries30d: 0, publishedAt: `2026-10-0${i + 1}T00:00:00.000Z`, ...over });
const WEEKS = { products: { "2026-09-14": 1, "2026-09-21": 1, "2026-09-28": 1, "2026-10-05": 1 }, builders: {} };
```
and, at the end of `seedSnapshot`, write: `live` from `liveEvents(eventList(MIN.liveEvents), new Date())`, `request_by_category` from `requestByCategory({ crm: 4, ecommerce: 3, booking: 3 }, { crm: 1 })`, `scarcest_category` from `scarcestCategory(same)`, `growth` from `weeklyGrowth(WEEKS, new Date("2026-10-05T12:05:00.000Z"))`, `top_builders` from `topBuilders([0, 1, 2].map((i) => tally(i, { selected: MIN.selected, replyMinutes: Array(MIN.fastSamples).fill(10), verified: MIN.verified })))`, `top_products` from `topProductsByCategory([candidate(0)])`. In `home.test.ts`: (a) the stale/fresh test lists `["home-numbers", "home-live", "home-trending", "home-pulse", "home-builders", "home-products"]` (7a lists the two it has); (b) the "sponsored or paid" strip becomes the typed `.replace(t(locale, "home.builders.noPay"), "")`; (c) the digit grep expects `files.length` ≥ 8 (the four files of 7a: `HomeSection`, `HomeBlocks`, `Numbers`, `Trending`; plus `Live`, `MarketPulse`, `TopBuilders`, `TopProducts` = 8 files). In `separable.test.tsx` add `import { Live } from "../../src/views/home/Live.tsx";` and the four bodies: `<Live locale="en" events={view.live!} now={new Date()} />`, `<MarketPulse locale="en" {...view.pulse!} />`, `<TopBuildersBlock locale="en" data={view.builders!} />`, `<TopProductsBlock locale="en" data={view.products!} />`.

Create `apps/web/test/home/blocks-b.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { writePublicStat } from "../../src/db/public-stats.ts";
import { BADGE_SCORE } from "../../src/domain/catalog.ts";
import { BUILDER_DAYS, LIVE_MAX, MIN, REQUEST_DAYS, liveEvents, requestByCategory, scarcestCategory, topBuilders, topProductsByCategory, weeklyGrowth } from "../../src/domain/public-stats.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { formatDuration, relativeTime } from "../../src/views/format.ts";
import { CATEGORY_KEY } from "../../src/views/labels.ts";
import { DB, block, candidate, clearStats, eventList, fresh, getHome, tally } from "./blocks.ts";

const count = (html: string, needle: string) => html.split(needle).length - 1;

const label = (c: keyof typeof CATEGORY_KEY) => t("en", CATEGORY_KEY[c]);
const rowsOf = (html: string) => [...html.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
const NOW = new Date("2026-10-05T12:05:00.000Z");
// total = 2 * categoryRequests + (categoryRequests - 1) + finance; finance = REST at the threshold, REST - 1 one under
const REST = MIN.categoryTotal - 3 * MIN.categoryRequests + 1;
const requests = (finance: number) => ({ crm: MIN.categoryRequests, ecommerce: MIN.categoryRequests, booking: MIN.categoryRequests - 1, finance });

describe("Live (VNX-0703b, moved from 7a)", () => {
  it("4 events hide it, 5 show it, and it never lists more than LIVE_MAX", async () => {
    const now = new Date();
    await clearStats();
    await writePublicStat(DB, "live", liveEvents(eventList(MIN.liveEvents - 1), now), fresh());
    expect(block(await getHome(), "home-live")).toBe("");
    await writePublicStat(DB, "live", liveEvents(eventList(MIN.liveEvents), now), fresh());
    expect(count(block(await getHome(), "home-live"), 'class="home-live-item"')).toBe(MIN.liveEvents);
    await writePublicStat(DB, "live", liveEvents(eventList(LIVE_MAX + 1), now), fresh());
    expect(count(block(await getHome(), "home-live"), 'class="home-live-item"')).toBe(LIVE_MAX);
  });

  it("a new request shows its category and languages, nothing else of it", async () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    const events = [...eventList(MIN.liveEvents - 1), { id: "r", at, kind: "request_new" as const, category: "crm" as const, languages: ["vi" as const] }];
    await clearStats();
    await writePublicStat(DB, "live", liveEvents(events, new Date()), fresh());
    const live = block(await getHome(), "home-live");
    expect(live).toContain(t("en", "home.live.requestNew"));
    expect(live).toContain(t("en", "product.category.crm"));
    expect(live).toContain(t("en", "builder.lang.vi"));
  });

  it("relativeTime picks the largest whole unit", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    expect(relativeTime("en", "2026-10-05T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(relativeTime("en", "2026-10-02T12:00:00.000Z", now)).toBe("3 days ago");
  });
});

describe("Market pulse (VNX-0703b)", () => {
  it("chart 1 hides under the request total and folds categories under the minimum into Other", async () => {
    await clearStats();
    await writePublicStat(DB, "request_by_category", requestByCategory(requests(REST - 1), { crm: 1 }), fresh());
    expect(block(await getHome(), "home-pulse")).toBe("");
    await writePublicStat(DB, "request_by_category", requestByCategory(requests(REST), { crm: 1 }), fresh());
    expect(rowsOf(block(await getHome(), "home-pulse"))).toEqual([label("crm"), label("ecommerce"), label("other")]);
  });

  it("the scarcest line needs a category at the request minimum; a table without it still shows", async () => {
    const flat = { crm: 2, ecommerce: 2, booking: 2, finance: 2, hr: 2 }; // total at the threshold, nobody at the minimum
    await clearStats();
    await writePublicStat(DB, "request_by_category", requestByCategory(flat, {}), fresh());
    await writePublicStat(DB, "scarcest_category", scarcestCategory(flat, {}), fresh());
    let html = block(await getHome(), "home-pulse");
    expect(html).not.toBe("");
    expect(html).not.toContain(t("en", "home.pulse.scarcest"));
    const some = requests(REST);
    await writePublicStat(DB, "scarcest_category", scarcestCategory(some, { crm: 1 }), fresh());
    html = block(await getHome(), "home-pulse");
    expect(html).toContain(t("en", "home.pulse.scarcest"));
    expect(html).toContain(`<strong>${label("ecommerce")}</strong>`); // 3 requests and no product beat 3 requests and one product
  });

  it("chart 2 needs the minimum number of ISO weeks", async () => {
    const weeks = (n: number) => ({ products: Object.fromEntries(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"].slice(4 - n).map((d) => [d, 1])), builders: {} });
    await clearStats();
    await writePublicStat(DB, "growth", weeklyGrowth(weeks(MIN.growthWeeks - 1), NOW), fresh());
    expect(block(await getHome(), "home-pulse")).toBe("");
    await writePublicStat(DB, "growth", weeklyGrowth(weeks(MIN.growthWeeks), NOW), fresh());
    expect(rowsOf(block(await getHome(), "home-pulse"))).toHaveLength(MIN.growthWeeks);
  });
});

describe("Top builders (VNX-0703b)", () => {
  const qualifies = { selected: { selected: MIN.selected }, fast: { replyMinutes: Array<number>(MIN.fastSamples).fill(10) }, verified: { verified: MIN.verified } } as const;
  const under = { selected: { selected: MIN.selected - 1 }, fast: { replyMinutes: Array<number>(MIN.fastSamples - 1).fill(10) }, verified: { verified: MIN.verified - 1 } } as const;

  for (const tab of ["selected", "fast", "verified"] as const) {
    it(`${tab}: two qualifying builders hide it, three show it (builder under the minimum does not count)`, async () => {
      await clearStats();
      const two = [tally(0, qualifies[tab]), tally(1, qualifies[tab]), tally(2, under[tab])];
      await writePublicStat(DB, "top_builders", topBuilders(two), fresh());
      expect(block(await getHome(), "home-builders"), tab).toBe("");
      const three = [...two.slice(0, 2), tally(2, qualifies[tab])];
      await writePublicStat(DB, "top_builders", topBuilders(three), fresh());
      const html = block(await getHome(), "home-builders");
      expect(html, tab).toContain(`data-tab="${tab}"`);
      for (const other of (["selected", "fast", "verified"] as const).filter((x) => x !== tab)) expect(html, `${tab}/${other}`).not.toContain(`data-tab="${other}"`);
    });
  }

  it("shows each tab criteria and 'no one pays to appear here' in every locale; the fastest tab shows a duration", async () => {
    await clearStats();
    const all = [0, 1, 2].map((i) => tally(i, { ...qualifies.selected, ...qualifies.fast, ...qualifies.verified }));
    await writePublicStat(DB, "top_builders", topBuilders(all), fresh());
    for (const locale of LOCALES) {
      const html = block(await getHome(localizedPath(locale, "/")), "home-builders");
      expect(html, locale).toContain(t(locale, "home.builders.noPay"));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.selected", { days: BUILDER_DAYS, min: MIN.selected }));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.fast", { days: BUILDER_DAYS, min: MIN.fastSamples }));
      expect(html, locale).toContain(t(locale, "home.builders.criteria.verified", { min: MIN.verified }));
    }
    expect(block(await getHome(), "home-builders")).toContain(formatDuration("en", 10));
    expect(formatDuration("en", 90)).not.toBe(formatDuration("en", 30)); // 90 minutes is shown in hours
  });
});

describe("Top products by category (VNX-0703b)", () => {
  it("hides with no product, shows a chip only for a category that has one, and lists at most three in the domain order", async () => {
    await clearStats();
    await writePublicStat(DB, "top_products", topProductsByCategory([]), fresh());
    expect(block(await getHome(), "home-products")).toBe("");
    const four = [candidate(0), candidate(1, { badgeScore: BADGE_SCORE.in_production }), candidate(2, { badgeScore: BADGE_SCORE.demo_verified }), candidate(3)];
    await writePublicStat(DB, "top_products", topProductsByCategory(four), fresh());
    const html = block(await getHome(), "home-products");
    expect(html).toContain('href="#home-top-crm"');
    expect(html).not.toContain('href="#home-top-ecommerce"');
    const names = [...html.matchAll(/Top product (\d)/g)].map((m) => Number(m[1]));
    expect([...new Set(names)]).toEqual([1, 2, 3]); // in production, demo verified, then the newer of the two listed
    expect(html).toContain(t("en", "home.products.order", { days: REQUEST_DAYS }));
  });
});
```

Run `npm test -w apps/web -- test/home` → expected RED (no `home-pulse|builders|products`, no `formatDuration`, no new keys).

- [ ] **Step 2: Locale keys (27, all four locales)**

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `home.live.title` | Recent activity | Hoạt động gần đây | 近期动态 | 近期動態 |
| `home.live.productPublished` | Product published | Sản phẩm mới đăng | 产品已发布 | 產品已發佈 |
| `home.live.badgeGranted` | Badge granted | Huy hiệu mới | 已授予徽章 | 已授予徽章 |
| `home.live.builderApproved` | Builder approved | Builder được duyệt | Builder 已通过审核 | Builder 已通過審核 |
| `home.live.requestNew` | New request | Nhu cầu mới | 新需求 | 新需求 |
| `home.pulse.title` | Market pulse | Nhịp thị trường | 市场脉搏 | 市場脈搏 |
| `home.pulse.requestsTitle` | Requests and listed products by category | Nhu cầu và sản phẩm đang đăng theo danh mục | 按类别统计的需求与已上架产品 | 按類別統計的需求與已上架產品 |
| `home.pulse.category` | Category | Danh mục | 类别 | 類別 |
| `home.pulse.requests` | Requests (last {days} days) | Nhu cầu ({days} ngày qua) | 需求（过去 {days} 天） | 需求（過去 {days} 天） |
| `home.pulse.products` | Listed products | Sản phẩm đang đăng | 已上架产品 | 已上架產品 |
| `home.pulse.scarcest` | Most requests per listed product | Nhiều nhu cầu nhất trên mỗi sản phẩm đang đăng | 每个已上架产品对应需求最多 | 每個已上架產品對應需求最多 |
| `home.pulse.growthTitle` | Products and builders, cumulative by week | Sản phẩm và builder, cộng dồn theo tuần | 产品与 Builder，按周累计 | 產品與 Builder，按週累計 |
| `home.pulse.week` | Week | Tuần | 周 | 週 |
| `home.builders.title` | Top builders | Builder hàng đầu | Builder 排行 | Builder 排行 |
| `home.builders.noPay` | No one pays to appear here. | Không ai trả tiền để có mặt ở đây. | 没有人能付钱出现在这里。 | 沒有人能付錢出現在這裡。 |
| `home.builders.name` | Builder | Builder | Builder | Builder |
| `home.builders.selected` | Most selected | Được chọn nhiều nhất | 入选最多 | 入選最多 |
| `home.builders.fast` | Fastest to reply | Trả lời nhanh nhất | 回复最快 | 回覆最快 |
| `home.builders.verified` | Most verified products | Nhiều sản phẩm được xác minh nhất | 已验证产品最多 | 已驗證產品最多 |
| `home.builders.value.selected` | Chosen + answered | Được chọn + đã trả lời | 入选 + 已回复 | 入選 + 已回覆 |
| `home.builders.value.fast` | Median first reply | Trung vị lần trả lời đầu | 首次回复中位时间 | 首次回覆中位時間 |
| `home.builders.value.verified` | Verified products | Sản phẩm đã xác minh | 已验证产品 | 已驗證產品 |
| `home.builders.criteria.selected` | Proposals chosen by clients plus inquiries answered, last {days} days. At least {min} to qualify. | Đề xuất được khách chọn cộng số yêu cầu đã trả lời trong {days} ngày qua. Cần ít nhất {min} để đủ điều kiện. | 客户选中的提案加上已回复的咨询，过去 {days} 天。至少 {min} 才符合资格。 | 客戶選中的提案加上已回覆的詢問，過去 {days} 天。至少 {min} 才符合資格。 |
| `home.builders.criteria.fast` | Median time to a first reply, last {days} days. At least {min} replies to qualify. | Trung vị thời gian đến lần trả lời đầu tiên trong {days} ngày qua. Cần ít nhất {min} lượt trả lời để đủ điều kiện. | 首次回复所需时间的中位数，过去 {days} 天。至少 {min} 次回复才符合资格。 | 首次回覆所需時間的中位數，過去 {days} 天。至少 {min} 次回覆才符合資格。 |
| `home.builders.criteria.verified` | Products with a Demo verified or In production badge. At least {min} to qualify. | Sản phẩm có huy hiệu Demo verified hoặc In production. Cần ít nhất {min} để đủ điều kiện. | 拥有 Demo verified 或 In production 徽章的产品。至少 {min} 个才符合资格。 | 擁有 Demo verified 或 In production 徽章的產品。至少 {min} 個才符合資格。 |
| `home.products.title` | Top products by category | Sản phẩm hàng đầu theo danh mục | 各类别排行靠前的产品 | 各類別排行靠前的產品 |
| `home.products.order` | Ordered by badge, then inquiries in the last {days} days, then newest. | Xếp theo huy hiệu, rồi số yêu cầu trong {days} ngày qua, rồi mới nhất. | 按徽章排序，其次为过去 {days} 天的咨询数，再其次为最新。 | 按徽章排序，其次為過去 {days} 天的詢問數，再其次為最新。 |

(`{min}` and `{days}` are the only placeholders; vi uses "yêu cầu" for inquiry and "nhu cầu" for request, as elsewhere.) Run `npm test -w apps/web -- test/i18n/parity.test.ts` → GREEN.

- [ ] **Step 3: `relativeTime` and `formatDuration`**

Append to `apps/web/src/views/format.ts`:

```ts
const MS = { day: 86_400_000, hour: 3_600_000, minute: 60_000 } as const;

/** "2 hours ago": the largest whole unit between `iso` and `now` (the viewer's locale). */
export function relativeTime(locale: Locale, iso: string, now: Date): string {
  const diff = Date.parse(iso) - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const unit of ["day", "hour", "minute"] as const) if (Math.abs(diff) >= MS[unit]) return rtf.format(Math.trunc(diff / MS[unit]), unit);
  return rtf.format(0, "minute");
}

/** A median reply time given in minutes, shown in the largest whole unit ("10 min", "2 hr", "3 days"). */
export function formatDuration(locale: Locale, minutes: number): string {
  const unit = minutes * MS.minute >= MS.day ? "day" : minutes * MS.minute >= MS.hour ? "hour" : "minute";
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short" }).format(Math.floor((minutes * MS.minute) / MS[unit]));
}
```

- [ ] **Step 4: Views, wiring, CSS**

`apps/web/src/views/home/Live.tsx` (body only):

```tsx
import type { FC } from "hono/jsx";
import type { PublicLiveEvent } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { relativeTime } from "../format.ts";
import { BADGE_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";

const LiveItem: FC<{ locale: Locale; e: PublicLiveEvent }> = ({ locale, e }) => {
  const tr = translator(locale);
  switch (e.kind) {
    case "product_published":
      return <><strong>{tr("home.live.productPublished")}</strong> <a href={localizedPath(locale, `/p/${e.slug}`)}>{e.productName}</a></>;
    case "badge_granted":
      return <><strong>{tr("home.live.badgeGranted")}</strong> <span class={`chip chip-${e.badge}`}>{tr(BADGE_KEY[e.badge])}</span> <a href={localizedPath(locale, `/p/${e.slug}`)}>{e.productName}</a></>;
    case "builder_approved":
      return <><strong>{tr("home.live.builderApproved")}</strong> <a href={localizedPath(locale, `/b/${e.handle}`)}>{e.builderName}</a></>;
    case "request_new":
      return <><strong>{tr("home.live.requestNew")}</strong> <span>{tr(CATEGORY_KEY[e.category])}</span> <span class="muted">{e.languages.map((l) => tr(LANGUAGE_KEY[l])).join(" · ")}</span></>;
  }
};

/** A static list for now (the marquee is Task 8). Only what the snapshot holds: no request title, no client, no e-mail. */
export const Live: FC<{ locale: Locale; events: readonly PublicLiveEvent[]; now: Date }> = ({ locale, events, now }) => (
  <ul class="home-live">
    {events.map((e) => (
      <li class="home-live-item">
        <time datetime={e.at}>{relativeTime(locale, e.at, now)}</time>
        <LiveItem locale={locale} e={e} />
      </li>
    ))}
  </ul>
);
```

`apps/web/src/views/home/MarketPulse.tsx` (body only):

```tsx
import type { FC } from "hono/jsx";
import { REQUEST_DAYS, type CategoryRow, type GrowthPoint } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount } from "../format.ts";
import { CATEGORY_KEY } from "../labels.ts";

type Props = { locale: Locale; categories: readonly CategoryRow[] | null; scarcest: CategoryRow | null; growth: readonly GrowthPoint[] | null };

/** Tables for now (Task 8 draws the charts and keeps these as the equivalent data). */
export const MarketPulse: FC<Props> = ({ locale, categories, scarcest, growth }) => {
  const tr = translator(locale);
  return (
    <div class="home-pulse-grid">
      {categories ? (
        <div class="table-wrap">
          <table class="data" data-chart="requests-by-category">
            <caption>{tr("home.pulse.requestsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{tr("home.pulse.category")}</th>
                <th scope="col">{tr("home.pulse.requests", { days: REQUEST_DAYS })}</th>
                <th scope="col">{tr("home.pulse.products")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr>
                  <th scope="row">{tr(CATEGORY_KEY[row.category])}</th>
                  <td>{formatCount(locale, row.requests)}</td>
                  <td>{formatCount(locale, row.products)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scarcest ? (
            <p class="home-scarcest">
              <span class="muted">{tr("home.pulse.scarcest")}</span> <strong>{tr(CATEGORY_KEY[scarcest.category])}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
      {growth ? (
        <div class="table-wrap">
          <table class="data" data-chart="growth">
            <caption>{tr("home.pulse.growthTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{tr("home.pulse.week")}</th>
                <th scope="col">{tr("home.numbers.products")}</th>
                <th scope="col">{tr("home.numbers.builders")}</th>
              </tr>
            </thead>
            <tbody>
              {growth.map((point) => (
                <tr>
                  <th scope="row">{point.week}</th>
                  <td>{formatCount(locale, point.products)}</td>
                  <td>{formatCount(locale, point.builders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
```
(The growth test counts `<th scope="row">` rows: the week cells; the category test counts category names. Both tables never appear together in those two tests.)

`apps/web/src/views/home/TopBuilders.tsx` (body only; ranking file, no word from the architecture money list in comments):

```tsx
import type { FC } from "hono/jsx";
import { BUILDER_DAYS, MIN, type TopBuilders } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount, formatDuration } from "../format.ts";

const TABS = [
  { key: "selected", title: "home.builders.selected", value: "home.builders.value.selected", criteria: "home.builders.criteria.selected", min: MIN.selected },
  { key: "fast", title: "home.builders.fast", value: "home.builders.value.fast", criteria: "home.builders.criteria.fast", min: MIN.fastSamples },
  { key: "verified", title: "home.builders.verified", value: "home.builders.value.verified", criteria: "home.builders.criteria.verified", min: MIN.verified },
] as const satisfies readonly { key: keyof TopBuilders; title: MessageKey; value: MessageKey; criteria: MessageKey; min: number }[];

/** One table per tab that has enough builders (the domain returns null for the others); each states its own criteria, and the note travels with the body. */
export const TopBuildersBlock: FC<{ locale: Locale; data: TopBuilders }> = ({ locale, data }) => {
  const tr = translator(locale);
  return (
    <>
      <p class="home-note">{tr("home.builders.noPay")}</p>
      {TABS.map((tab) => {
        const rows = data[tab.key];
        return rows ? (
          <div class="table-wrap home-group" data-tab={tab.key}>
            <h3>{tr(tab.title)}</h3>
            <p class="home-criteria">{tr(tab.criteria, { days: BUILDER_DAYS, min: tab.min })}</p>
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">{tr("home.builders.name")}</th>
                  <th scope="col">{tr(tab.value)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr>
                    <th scope="row"><a href={localizedPath(locale, `/b/${row.handle}`)}>{row.name}</a></th>
                    <td>{tab.key === "fast" ? formatDuration(locale, row.value) : formatCount(locale, row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null;
      })}
    </>
  );
};
```

`apps/web/src/views/home/TopProducts.tsx` (body only; ranking file):

```tsx
import type { FC } from "hono/jsx";
import { topBadge } from "../../domain/catalog.ts";
import { CATEGORIES } from "../../domain/product.ts";
import { REQUEST_DAYS, type TopProductsByCategory } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BADGE_KEY, CATEGORY_KEY } from "../labels.ts";

/** Per category, in the order the domain already fixed (badge, then recent inquiries, then newest); only categories with a product. */
export const TopProductsBlock: FC<{ locale: Locale; data: TopProductsByCategory }> = ({ locale, data }) => {
  const tr = translator(locale);
  const present = CATEGORIES.filter((c) => (data[c]?.length ?? 0) > 0);
  return (
    <>
      <p class="home-note">{tr("home.products.order", { days: REQUEST_DAYS })}</p>
      <ul class="home-chips" aria-label={tr("home.products.title")}>
        {present.map((c) => (
          <li><a class="btn btn-ghost btn-sm" href={`#home-top-${c}`}>{tr(CATEGORY_KEY[c])}</a></li>
        ))}
      </ul>
      {present.map((c) => (
        <div class="home-group" id={`home-top-${c}`}>
          <h3>{tr(CATEGORY_KEY[c])}</h3>
          <ul class="home-tiles">
            {(data[c] ?? []).map((p) => {
              const badge = topBadge(p.badgeScore);
              return (
                <li class="home-tile">
                  <h4><a href={localizedPath(locale, `/p/${p.slug}`)}>{p.name}</a></h4>
                  <p class="muted">{tr("catalog.by", { name: p.builderName })}</p>
                  {badge ? <p><span class={`chip chip-${badge}`}>{tr(BADGE_KEY[badge])}</span></p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
};
```

`HomeBlocks.tsx`: import `Live`, `MarketPulse`, `TopBuildersBlock`, `TopProductsBlock`; add `now: Date` to `HomeBlocksProps` and to the destructuring; add the Live entry between the Numbers and Trending entries:

```tsx
    view.live ? <HomeSection id="home-live" title={tr("home.live.title")}><Live locale={locale} events={view.live} now={now} /></HomeSection> : null,
```
In `routes/home.tsx` give `renderHome` the parameter `now: Date`, pass `now={now}` to `<HomeBlocks>`, and call `renderHome(c.get("locale"), await loadHomeData(c.env.DB, now), now)`. Then add after the Trending/Founding entries of `blocks`:

```tsx
    view.pulse ? <HomeSection id="home-pulse" title={tr("home.pulse.title")}><MarketPulse locale={locale} {...view.pulse} /></HomeSection> : null,
    view.builders ? <HomeSection id="home-builders" title={tr("home.builders.title")}><TopBuildersBlock locale={locale} data={view.builders} /></HomeSection> : null,
    view.products ? <HomeSection id="home-products" title={tr("home.products.title")}><TopProductsBlock locale={locale} data={view.products} /></HomeSection> : null,
```

Append to `apps/web/public/assets/app.css`:

```css
.home-live { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.home-live-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); }
.home-live-item time { color: var(--muted); font: 400 13px/1.4 var(--font-mono); }
.home-pulse-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 24px; align-items: start; }
.home-pulse-grid caption { caption-side: top; text-align: left; font-weight: 600; padding: 0 0 8px; }
.home-scarcest { margin: 12px 0 0; }
.home-criteria { margin: 0 0 8px; color: var(--muted); font-size: 14px; }
.home-group + .home-group { margin-top: 32px; }
.home-group h3 { margin: 0 0 8px; }
.home-chips { list-style: none; margin: 0 0 24px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
```

Run `npm test -w apps/web -- test/home test/landing test/design test/i18n` → GREEN.

- [ ] **Step 5: Architecture guard**

In `apps/web/test/architecture.test.ts` add to `RANKING_FILES`:

```ts
  // VNX-0703b: Top builders and Top products.
  "../src/views/home/TopBuilders.tsx",
  "../src/views/home/TopProducts.tsx",
```
and extend the 7a test's file list to `["../src/routes/home.tsx", "../src/views/home/Trending.tsx", "../src/views/home/TopBuilders.tsx", "../src/views/home/TopProducts.tsx"]`. Run `npm test -w apps/web -- test/architecture.test.ts` → GREEN. Check by hand that the three view files and their comments avoid `sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|outbound_clicks` (the criteria wording lives in the locale files, which are not ranking files).

- [ ] **Step 6: Focused acceptance, typecheck, full test, commit**

`npm test -w apps/web -- test/home test/domain test/landing test/design test/i18n test/architecture.test.ts`, then:

```text
npm run typecheck -w apps/web && npm test
git add apps/web/src/views/home/Live.tsx apps/web/src/views/home/MarketPulse.tsx apps/web/src/views/home/TopBuilders.tsx apps/web/src/views/home/TopProducts.tsx apps/web/src/views/home/HomeBlocks.tsx apps/web/src/views/format.ts apps/web/public/assets/app.css apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/home/blocks.ts apps/web/test/home/blocks-b.test.ts apps/web/test/home/home.test.ts apps/web/test/home/separable.test.tsx apps/web/test/architecture.test.ts apps/web/src/routes/home.tsx
git commit -m "feat(web): add Live, Market pulse tables, Top builders and Top products (VNX-0703b)

Each block reads a fresh public_stats value and hides under its threshold;
Top builders states its criteria and that no one pays to appear.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Acceptance (mỗi dòng kiểm được bằng một lệnh):**
- Live: ẩn ở 4 sự kiện, hiện ở 5, tối đa `LIVE_MAX`, request chỉ category và ngôn ngữ, thời gian tương đối: `npm test -w apps/web -- test/home/blocks-b.test.ts -t "Live"`.
- Market pulse: bảng 1 ẩn ở tổng n−1 và hiện ở n với category dưới 3 request gộp "Other"; dòng thiếu supply cần ≥ 3 request; bảng 2 ẩn ở 3 tuần, hiện ở 4: `npm test -w apps/web -- test/home/blocks-b.test.ts -t "Market pulse"`.
- Top builders: mỗi tab ẩn với 2 builder đủ điều kiện (kể cả một builder dưới ngưỡng 2/5/1) và hiện với 3; ghi tiêu chí và "no one pays to appear here" ở 4 locale; thời gian hiện bằng đơn vị: `-t "Top builders"`.
- Top products: ẩn khi không có product, chip chỉ cho category có product, tối đa 3 theo thứ tự huy hiệu rồi mới nhất: `-t "Top products"`.
- Toàn trang: stale ẩn cả 6 khối, một truy vấn `public_stats`, không `<script>`, không chữ trả tiền/Sponsored, không chữ số cứng trong 8 file `views/home/*.tsx` (`HomeSection`, `HomeBlocks`, `Numbers`, `Trending`, `Live`, `MarketPulse`, `TopBuilders`, `TopProducts`): `npm test -w apps/web -- test/home/home.test.ts`.
- `RANKING_FILES` có đủ `routes/home.tsx`, `views/home/{Trending,TopBuilders,TopProducts}.tsx` và không file nào trong đó đọc bảng tiền: `npm test -w apps/web -- test/architecture.test.ts`.
- `git diff --stat -- apps/web/migrations apps/web/package.json` rỗng; `npm run typecheck -w apps/web` và `npm test` xanh.

Diff ước ~360 dòng không tính locale (mã ~215, test ~145; locale +115 dòng).

---

### Task 8a: VNX-0704a — Chart SVG, legend, bảng dữ liệu và bảng màu có validator

Đã đối chiếu code `8d6237c` (2026-10-07). Task 8 cũ vượt ~600 dòng nên tách: **8a** (chart tĩnh, dùng được khi không JS) và **8b** (animation, JS, tooltip, reduced-motion). Bảng "Thứ tự task" ở header giữ một dòng "8"; thực thi 8a rồi 8b, cả hai phụ thuộc Task 7 và chạy trước Task 10.

**Files:**
- Create: `apps/web/src/views/chart-geometry.ts` (hình học thuần: `barLayout`, `lineLayout`, `linePoints`, `MARKER_MIN_STEP`). Tên khác `Chart.tsx` hẳn để hệ file không phân biệt hoa thường không nhầm. Nằm ngoài `views/home/` vì chứa số; test "home views hold no digit" chỉ quét `views/home/*.tsx`.
- Create: `apps/web/src/views/Chart.tsx` (`BarChart`, `LineChart`, `ChartData`)
- Modify: `apps/web/src/views/home/MarketPulse.tsx` (bọc hai bảng bằng chart + `<details>`; nhãn tuần theo locale)
- Modify: `apps/web/src/views/home/Trending.tsx` (thêm `pathLength` cho polyline sparkline)
- Modify: `apps/web/src/views/format.ts` (`PATH_LENGTH`, `weekStart`, `formatWeek`)
- Modify: `apps/web/public/assets/app.css` (token `--chart-blue`/`--chart-orange` ở light và CẢ HAI khối dark; luật `.chart*`)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (1 key)
- Test: `apps/web/test/home/chart.test.ts`, `apps/web/test/home/chart-colours.test.ts`; giữ xanh `test/home/{home,blocks-b,separable}`, `test/design/assets.test.ts`.

Ngoài phạm vi (8b): mọi animation, `home.js`, tooltip, đếm số, dải Live chạy ngang, `prefers-reduced-motion` cho chart. Không thêm `<script>` ở task này.

**Về "thẻ hero tự xoay ~4 giây" trong stub:** KHÔNG làm. Deck hero của landing đã xoay mỗi 4 giây, dừng khi hover/focus, tắt khi reduced-motion trong `public/assets/landing.js` (VNX-0709, có test `assets.test.ts` AC10/AC11). Làm lại sẽ thành hai bộ hẹn giờ. 8b chỉ thêm test khẳng định `home.js` không có `setInterval`.

**Interfaces:**
- Consumes (code thật): `MarketPulse` props `{ locale, categories: CategoryRow[] | null, scarcest, growth: GrowthPoint[] | null }`; `REQUEST_DAYS`; `CATEGORY_KEY`; `formatCount`, `SPARK_VIEWBOX`, `sparkPoints` (`views/format.ts`); `translator`; hai bảng `table.data[data-chart="requests-by-category"|"growth"]` hiện có (giữ nguyên làm bảng tương đương); `seedSnapshot`, `getHome`, `block` (`test/home/blocks.ts`).
- Produces:
  - `format.ts`: `PATH_LENGTH = 100`; `weekStart(week: string): Date | null` (thứ Hai UTC của tuần ISO `YYYY-Www`); `formatWeek(locale, week, year = false): string` (ngày bắt đầu tuần theo locale, vd en "Sep 28"; chuỗi không phải tuần ISO thì trả nguyên); `formatWeeks(locale, weeks): string[]` (thêm năm vào mọi nhãn khi dãy tuần qua hai năm).
  - `chart-geometry.ts`: `CHART_WIDTH`, `BAR_HEIGHT`, `MARKER_MIN_STEP`, `barLayout(values)`, `lineLayout(series)`, `linePoints(points)`.
  - `Chart.tsx`: `type Tone = "blue" | "orange"`, `type Series = { tone: Tone; label: string; mark?: "circle" | "square" }`, `BarChart`, `LineChart`, `ChartData`.
  - Móc cho 8b (không đổi sau này): `[data-tip]` trên `<g class="chart-group">`, class `chart-bar`, `chart-line`, `chart-dot`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Chart tĩnh render phía server, không JS.** Hình học ở `chart-geometry.ts` thuần (có test số); màu ở CSS qua class tone; không `style=`; không `fill=`/`stroke=` trên `<text>` (chữ luôn `fill: var(--text)`).
2. **Bar ngang nhóm**, nhãn category nằm TRÊN từng nhóm (không cột nhãn trái) để nhãn dài của vi/zh không bị cắt ở 320 px. Trục dọc bên trái là baseline; 8b làm bar mọc từ trục này (`scaleX`).
3. **Hai màu cố định** `--chart-blue: #2a78d6` (request), `--chart-orange: #eb6834` (product) ở light; dark có bước riêng `#5b9bf0` và `#f58a5c`, đặt ở cả `@media (prefers-color-scheme: dark)` lẫn `:root[data-theme="dark"]`. Chart nằm trong `.chart` có `background: var(--surface)` vì tương phản `#eb6834` trên `--bg` (#f4f5f7) chỉ ~2.9:1 (dưới 3:1), còn trên `--surface` ~3.2:1. Validator (test) tính tương phản đồ họa ≥ 3:1 với `--surface` ở cả 3 khối token và khoảng cách màu ≥ 100 (thang 0–255) dưới mô phỏng deuteranopia/protanopia (ma trận Machado, mức 1.0). Giá trị dark là ước tính (~6:1 và ~7:1 trên `#111827`); nếu validator đỏ, chỉnh bước dark, không hạ ngưỡng.
4. **Chart tăng trưởng có hai chuỗi products/builders nhưng bảng màu chỉ gán request=xanh, product=cam.** Chọn: products = cam, builders = xanh, phân biệt thêm bằng hình dấu (products vuông, builders tròn) và legend. Xanh nghĩa "request" ở chart 1 và "builders" ở chart 2; mỗi chart có legend riêng nên không nhập nhằng. Reviewer duyệt.
5. **Legend chỉ khi ≥ 2 chuỗi** (cả hai chart đều có). Nhãn legend tái dùng key sẵn có (`home.pulse.requests`, `home.pulse.products`, `home.numbers.products`, `home.numbers.builders`): nhãn dữ liệu, không câu mới.
6. **Bảng dữ liệu là `<details>` đóng**, chứa đúng bảng 7b (giữ `data-chart`, `caption`, `th scope`). Tooltip (8b) chỉ dành cho con trỏ/chạm; bàn phím và trình đọc màn hình dùng bảng, nên SVG là `role="img"` có `aria-label` = tiêu đề chart và KHÔNG có phần tử focus được bên trong.
7. **Nhãn tuần (theo yêu cầu review 7b):** bảng và trục x không in `2026-W40` thô mà in ngày bắt đầu tuần theo locale qua `formatWeeks` (Intl, `timeZone: "UTC"`); khi dãy tuần qua hai năm, mọi nhãn kèm năm. Không key mới, không câu mới; tiêu đề cột vẫn là `home.pulse.week` có sẵn. `GrowthPoint.week` ở domain giữ nguyên `YYYY-Www` (khóa dữ liệu).
8. **Sparkline** ở Trending chỉ thêm `pathLength={PATH_LENGTH}` để 8b vẽ dần bằng `stroke-dasharray`, không cần JS đo. `PATH_LENGTH` ở `format.ts` để file `home/*.tsx` không chứa chữ số.
9. **Chart không biết khối cha:** không class `lp-`/`container`; kích thước theo `width: 100%` của khung chứa (homepage ba cột dùng lại được).

**i18n (1 key mới, nhãn nút, không chữ số):**

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `home.chart.table` | Show data as a table | Xem dữ liệu dạng bảng | 以表格显示数据 | 以表格顯示資料 |

Thêm sau `"home.pulse.week"` ở cả 4 file. Nhãn trục, legend, tuần là nhãn dữ liệu (key sẵn có hoặc Intl).

- [ ] **Step 1: Viết test hình học, nhãn tuần, chart (đỏ)**

`apps/web/test/home/chart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LOCALES } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { BAR_HEIGHT, CHART_WIDTH, MARKER_MIN_STEP, barLayout, lineLayout } from "../../src/views/chart-geometry.ts";
import { PATH_LENGTH, formatWeek, formatWeeks, weekStart } from "../../src/views/format.ts";
import { CATEGORY_KEY } from "../../src/views/labels.ts";
import { block, getHome, seedSnapshot } from "./blocks.ts";

describe("barLayout", () => {
  it("scales every bar to the largest value, keeps zero at width 0, and never overlaps groups", () => {
    const g = barLayout([[4, 1], [2, 0]]);
    const full = g.rows[0]!.bars[0]!.width;
    expect(full).toBeGreaterThan(0);
    expect(full).toBeLessThan(CHART_WIDTH);
    expect(g.rows[1]!.bars[0]!.width).toBeCloseTo(full / 2, 0);
    expect(g.rows[1]!.bars[1]!.width).toBe(0);
    expect(g.rows[1]!.top).toBeGreaterThanOrEqual(g.rows[0]!.top + g.rows[0]!.height);
    expect(g.rows[0]!.bars[1]!.y).toBeGreaterThanOrEqual(g.rows[0]!.bars[0]!.y + BAR_HEIGHT);
    const last = g.rows[1]!;
    expect(g.height).toBeGreaterThan(last.top + last.height);
  });
  it("an all-zero or empty input does not divide by zero", () => {
    expect(barLayout([[0, 0]]).rows[0]!.bars.map((b) => b.width)).toEqual([0, 0]);
    expect(barLayout([]).rows).toEqual([]);
  });
});

describe("lineLayout", () => {
  it("puts the maximum on the top tick and zero on the baseline, x evenly spaced", () => {
    const g = lineLayout([[1, 2, 4, 8], [0, 1, 1, 2]]);
    const [zero, max] = g.ticks;
    expect(zero!.value).toBe(0);
    expect(max!.value).toBe(8);
    expect(g.lines[0]![3]!.y).toBe(max!.y);
    expect(g.lines[1]![0]!.y).toBe(zero!.y);
    expect(g.lines[0]).toHaveLength(4);
    g.x.slice(1).forEach((x, i) => expect(Math.abs(x - g.x[i]! - g.step)).toBeLessThanOrEqual(0.1));
  });
  it("a dense series is below the marker step, so only the endpoints get a marker", () => {
    expect(lineLayout([Array<number>(40).fill(1)]).step).toBeLessThan(MARKER_MIN_STEP);
    expect(lineLayout([[1, 2, 3, 4]]).step).toBeGreaterThanOrEqual(MARKER_MIN_STEP);
  });
  it("a single point does not divide by zero", () => {
    expect(Number.isFinite(lineLayout([[3]]).lines[0]![0]!.x)).toBe(true);
  });
});

describe("week labels", () => {
  it("weekStart is the Monday of the ISO week, including a week that starts in the previous year", () => {
    expect(weekStart("2026-W40")!.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(weekStart("2026-W01")!.toISOString().slice(0, 10)).toBe("2025-12-29");
    expect(weekStart("2027-W01")!.toISOString().slice(0, 10)).toBe("2027-01-04");
    expect(weekStart("nonsense")).toBeNull();
  });
  it("formatWeek prints a locale date, never the raw key, and falls back to the input", () => {
    expect(formatWeek("en", "2026-W40")).toBe("Sep 28");
    for (const l of LOCALES) expect(formatWeek(l, "2026-W40"), l).not.toContain("W40");
    expect(formatWeek("en", "bad")).toBe("bad");
  });
  it("formatWeeks adds the year to every label only when the weeks span two years", () => {
    expect(formatWeeks("en", ["2026-W40", "2026-W41"])).toEqual(["Sep 28", "Oct 5"]);
    const across = formatWeeks("en", ["2026-W52", "2027-W01"]);
    expect(across[0]).toContain("2026");
    expect(across[1]).toContain("2027");
    expect(formatWeeks("en", [])).toEqual([]);
  });
});

describe("Market pulse charts on /", () => {
  const svgs = (html: string) => html.match(/<svg class="chart-svg"[\s\S]*?<\/svg>/g)!;
  const rowsOf = (html: string, kind: string) => html.match(new RegExp(`data-chart="${kind}"[\\s\\S]*?</table>`))![0].match(/<th scope="row">/g)!.length;

  it("draws two SVG charts, each with a legend and its table inside a closed <details>", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    expect(svgs(html)).toHaveLength(2);
    expect(html.match(/<ul class="chart-legend">/g)).toHaveLength(2);
    for (const kind of ["requests-by-category", "growth"]) {
      expect(html).toMatch(new RegExp(`<details class="chart-data">\\s*<summary>[^<]+</summary>[\\s\\S]*?<table class="data" data-chart="${kind}"`));
    }
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });
  it("each svg is role=img with a label, holds no focusable element, no style=, and no colour on <text>", async () => {
    await seedSnapshot();
    for (const svg of svgs(block(await getHome(), "home-pulse"))) {
      expect(svg).toMatch(/aria-label="[^"]+"/);
      expect(svg).toContain('role="img"');
      expect(svg).not.toMatch(/tabindex|\sstyle=|<a\b|<button/);
      expect(svg).not.toMatch(/<text[^>]*\s(fill|stroke)=/);
    }
  });
  it("the bar chart has one group per category; the growth chart two lines and one dot per week and series", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    const [bars, line] = svgs(html);
    expect(bars!.match(/class="chart-group"/g)).toHaveLength(rowsOf(html, "requests-by-category"));
    for (const key of ["crm", "ecommerce", "other"] as const) expect(bars).toContain(t("en", CATEGORY_KEY[key]));
    expect(line!.match(/class="chart-cross"/g)).toHaveLength(rowsOf(html, "growth"));
    expect(line!.match(/class="chart-line /g)).toHaveLength(2);
    expect(line!.match(/class="chart-dot /g)).toHaveLength(rowsOf(html, "growth") * 2); // 4 weeks: step is above MARKER_MIN_STEP, so every point has a marker
    expect(line).toContain(`pathLength="${PATH_LENGTH}"`);
  });
  it("the growth table and axis show a localised week start, not the ISO key", async () => {
    await seedSnapshot();
    const html = block(await getHome(), "home-pulse");
    expect(html).not.toMatch(/\d{4}-W\d{2}/);
    expect(html).toContain("Sep 28");
  });
  it("the Trending sparkline carries pathLength", async () => {
    await seedSnapshot();
    expect(block(await getHome(), "home-trending")).toMatch(new RegExp(`<polyline[^>]*pathLength="${PATH_LENGTH}"`));
  });
});
```

(`seedSnapshot` có tuần bắt đầu `2026-09-14 … 2026-10-05`, nên tuần ISO `2026-W40` bắt đầu 28/9 nằm trong bảng.)

`apps/web/test/home/chart-colours.test.ts` (validator màu):

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

const css = await (await createApp().request(new Request("https://vnx.si/assets/app.css"), undefined, testEnv)).text();
const light = /:root\s*\{([^}]*)\}/.exec(css)![1]!;
const darkMedia = /prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css)![1]!;
const darkAttr = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)![1]!;
const tok = (block: string, name: string): string => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(block)![1]!.toLowerCase();

const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p); return (hi! + 0.05) / (lo! + 0.05); };
const SIM = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
} as const;
// Machado et al. define the matrices on LINEAR light, so the product is taken on linear values and compared there (scaled to 0-255,
// not gamma-encoded). Absolute values differ from what a screen shows; the 100 threshold is calibrated for this linear scale.
const simulate = (hex: string, m: readonly (readonly number[])[]) => {
  const l = rgb(hex).map(lin);
  return m.map((row) => Math.min(255, Math.max(0, 255 * (row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!))));
};
const distance = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe("chart series colours (VNX-0704a validator)", () => {
  it("light keeps the approved #2a78d6 request and #eb6834 product", () => {
    expect(tok(light, "--chart-blue")).toBe("#2a78d6");
    expect(tok(light, "--chart-orange")).toBe("#eb6834");
  });
  it("dark has its own steps, identical in the media query and the data-theme block, different from light", () => {
    for (const name of ["--chart-blue", "--chart-orange"]) {
      expect(tok(darkMedia, name), name).toBe(tok(darkAttr, name));
      expect(tok(darkAttr, name), name).not.toBe(tok(light, name));
    }
  });
  it("every series colour is at least 3:1 against --surface in all three token blocks (WCAG 1.4.11)", () => {
    for (const [name, block] of [["light", light], ["dark-media", darkMedia], ["dark-attr", darkAttr]] as const) {
      for (const series of ["--chart-blue", "--chart-orange"]) expect(ratio(tok(block, series), tok(block, "--surface")), `${name} ${series}`).toBeGreaterThanOrEqual(3);
    }
  });
  it("the two series stay apart under deuteranopia and protanopia", () => {
    for (const [name, block] of [["light", light], ["dark", darkAttr]] as const) {
      for (const [kind, m] of Object.entries(SIM)) {
        expect(distance(simulate(tok(block, "--chart-blue"), m), simulate(tok(block, "--chart-orange"), m)), `${name} ${kind}`).toBeGreaterThanOrEqual(100);
      }
    }
  });
  it("chart text uses the text colour, never a series colour, and the chart sits on --surface", () => {
    expect(css).toMatch(/\.chart-label[^{]*\{[^}]*fill:\s*var\(--text\)/);
    expect(css).toMatch(/\.chart-value[^{]*\{[^}]*fill:\s*var\(--text\)/);
    expect(css).toMatch(/\.chart\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(css).not.toMatch(/\.chart-(label|value|axis-label)[^{]*\{[^}]*fill:\s*var\(--chart-/);
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

`npm test -w apps/web -- test/home/chart.test.ts test/home/chart-colours.test.ts` → FAIL (thiếu `chart-geometry.ts`, `formatWeek`, token).

- [ ] **Step 3: `views/format.ts`**

Thêm ngay sau `const MS = …`:

```ts
/** Normalised path length of the sparkline and chart lines: CSS draws them with one dash of this length (Task 8b). */
export const PATH_LENGTH = 100;

const ISO_WEEK = /^(\d{4})-W(\d{2})$/;
/** The Monday (UTC) of an ISO week key `YYYY-Www`; null for anything else. Week 1 is the week that holds 4 January. */
export function weekStart(week: string): Date | null {
  const m = ISO_WEEK.exec(week);
  if (!m) return null;
  const jan4 = Date.UTC(Number(m[1]), 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * MS.day;
  return new Date(monday + (Number(m[2]) - 1) * 7 * MS.day);
}
/** The week as its first day in the viewer's locale ("Sep 28"; with the year when `year`); the raw key only when it is not an ISO week. */
export function formatWeek(locale: Locale, week: string, year = false): string {
  const start = weekStart(week);
  return start ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(start) : week;
}
/** Labels for a run of weeks; the year goes on every label when the run crosses a year boundary. */
export function formatWeeks(locale: Locale, weeks: readonly string[]): string[] {
  const years = new Set(weeks.map((w) => weekStart(w)?.getUTCFullYear()));
  return weeks.map((w) => formatWeek(locale, w, years.size > 1));
}
```

- [ ] **Step 4: `views/chart-geometry.ts`**

```ts
/** Pure geometry for the hand-built SVG charts (VNX-0704a). No DOM, no colour: colour lives in CSS classes. */
export const CHART_WIDTH = 320;
const PAD = 4;
const BAR = { label: 16, height: 10, gap: 4, group: 14, value: 40 } as const;
export const BAR_HEIGHT = BAR.height;
/** Below this x step (px in the viewBox) markers crowd the line: only the two endpoints keep one. */
export const MARKER_MIN_STEP = 12;
const round = (n: number): number => Math.round(n * 10) / 10;

export type BarRowLayout = { top: number; height: number; labelY: number; bars: { y: number; width: number; textX: number; textY: number }[] };
export type BarLayout = { width: number; height: number; left: number; rows: BarRowLayout[] };

/** Horizontal grouped bars: one group per row, its label above it, one bar per series; every bar scaled to the largest value. */
export function barLayout(values: readonly (readonly number[])[]): BarLayout {
  const series = Math.max(1, ...values.map((v) => v.length));
  const max = Math.max(1, ...values.flat());
  const span = CHART_WIDTH - 2 * PAD - BAR.value;
  const groupH = BAR.label + series * BAR.height + (series - 1) * BAR.gap;
  const rows = values.map((row, i): BarRowLayout => {
    const top = PAD + i * (groupH + BAR.group);
    return {
      top,
      height: groupH,
      labelY: top + BAR.label - 4,
      bars: row.map((v, j) => {
        const y = top + BAR.label + j * (BAR.height + BAR.gap);
        const width = round((v / max) * span);
        return { y, width, textX: PAD + width + 4, textY: y + BAR.height - 1 };
      }),
    };
  });
  return { width: CHART_WIDTH, height: 2 * PAD + Math.max(0, values.length * (groupH + BAR.group) - BAR.group), left: PAD, rows };
}

const LINE = { height: 180, left: 36, right: 10, top: 10, bottom: 24 } as const;
export type Point = { x: number; y: number };
export type LineLayout = { width: number; height: number; left: number; right: number; top: number; baseline: number; step: number; x: number[]; ticks: { value: number; y: number }[]; lines: Point[][] };

/** Lines over a shared category axis; y runs from zero to the largest value, with a tick at each end. */
export function lineLayout(series: readonly (readonly number[])[]): LineLayout {
  const n = Math.max(0, ...series.map((s) => s.length));
  const max = Math.max(1, ...series.flat());
  const plotW = CHART_WIDTH - LINE.left - LINE.right;
  const plotH = LINE.height - LINE.top - LINE.bottom;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const yOf = (v: number) => round(LINE.top + plotH - (v / max) * plotH);
  const x = Array.from({ length: n }, (_, i) => round(LINE.left + i * step));
  return {
    width: CHART_WIDTH,
    height: LINE.height,
    left: LINE.left,
    right: CHART_WIDTH - LINE.right,
    top: LINE.top,
    baseline: LINE.top + plotH,
    step,
    x,
    ticks: [{ value: 0, y: yOf(0) }, { value: max, y: yOf(max) }],
    lines: series.map((s) => s.map((v, i) => ({ x: x[i]!, y: yOf(v) }))),
  };
}
export const linePoints = (pts: readonly Point[]): string => pts.map((p) => `${p.x},${p.y}`).join(" ");
```

- [ ] **Step 5: `views/Chart.tsx`**

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import type { Locale } from "../i18n/locales.ts";
import { BAR_HEIGHT, MARKER_MIN_STEP, barLayout, lineLayout, linePoints } from "./chart-geometry.ts";
import { formatCount, PATH_LENGTH } from "./format.ts";

export type Tone = "blue" | "orange";
export type Series = { tone: Tone; label: string; mark?: "circle" | "square" };

/** The tooltip text of one group (Task 8b shows it): "Label: Series 4 · Series 1". Also what a screen reader never needs: the table has it all. */
const tip = (locale: Locale, head: string, series: readonly Series[], values: readonly number[]): string =>
  `${head}: ${series.map((s, i) => `${s.label} ${formatCount(locale, values[i] ?? 0)}`).join(" · ")}`;

const Legend: FC<{ series: readonly Series[] }> = ({ series }) =>
  series.length > 1 ? (
    <ul class="chart-legend">
      {series.map((s) => (
        <li>
          <span class={`chart-swatch chart-tone-${s.tone}${s.mark === "circle" ? " chart-mark-circle" : ""}`} aria-hidden="true"></span>
          {s.label}
        </li>
      ))}
    </ul>
  ) : null;

/** A chart's equivalent table, closed by default; the table itself is the child. */
export const ChartData: FC<PropsWithChildren<{ summary: string }>> = ({ summary, children }) => (
  <details class="chart-data">
    <summary>{summary}</summary>
    {children}
  </details>
);

type BarProps = { locale: Locale; title: string; series: readonly Series[]; rows: readonly { label: string; values: readonly number[] }[] };
export const BarChart: FC<PropsWithChildren<BarProps>> = ({ locale, title, series, rows, children }) => {
  const g = barLayout(rows.map((r) => r.values));
  return (
    <figure class="chart" data-chart-kind="bars">
      <Legend series={series} />
      <svg class="chart-svg" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={title}>
        <line class="chart-axis" x1={g.left} y1="0" x2={g.left} y2={g.height} />
        {rows.map((row, i) => {
          const r = g.rows[i]!;
          return (
            <g class="chart-group" data-tip={tip(locale, row.label, series, row.values)}>
              <rect class="chart-hit" x="0" y={r.top} width={g.width} height={r.height} />
              <text class="chart-label" x={g.left} y={r.labelY}>{row.label}</text>
              {r.bars.map((b, j) => (
                <>
                  <rect class={`chart-bar chart-tone-${series[j]!.tone}`} x={g.left} y={b.y} width={b.width} height={BAR_HEIGHT} rx="2" />
                  <text class="chart-value" x={b.textX} y={b.textY}>{formatCount(locale, row.values[j] ?? 0)}</text>
                </>
              ))}
            </g>
          );
        })}
      </svg>
      {children}
    </figure>
  );
};

type LineProps = { locale: Locale; title: string; series: readonly Series[]; labels: readonly string[]; values: readonly (readonly number[])[] };
/** `values[s][i]` is series s at label i. `mark: "square"` draws squares; anything else, circles. */
export const LineChart: FC<PropsWithChildren<LineProps>> = ({ locale, title, series, labels, values, children }) => {
  const g = lineLayout(values);
  const last = labels.length - 1;
  const ends = last > 0 ? [0, last] : [0];
  return (
    <figure class="chart" data-chart-kind="lines">
      <Legend series={series} />
      <svg class="chart-svg" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={title}>
        {g.ticks.map((tick) => (
          <>
            <line class="chart-grid" x1={g.left} y1={tick.y} x2={g.right} y2={tick.y} />
            <text class="chart-axis-label" x={g.left - 6} y={tick.y + 4} text-anchor="end">{formatCount(locale, tick.value)}</text>
          </>
        ))}
        {ends.map((i) => (
          <text class="chart-axis-label" x={g.x[i]} y={g.height - 6} text-anchor={i === 0 ? "start" : "end"}>{labels[i]}</text>
        ))}
        {labels.map((label, i) => (
          <g class="chart-group" data-tip={tip(locale, label, series, values.map((s) => s[i] ?? 0))}>
            <rect class="chart-hit" x={(g.x[i] ?? 0) - g.step / 2} y={g.top} width={g.step || g.width} height={g.baseline - g.top} />
            <line class="chart-cross" x1={g.x[i]} y1={g.top} x2={g.x[i]} y2={g.baseline} />
          </g>
        ))}
        {series.map((s, k) => (
          <>
            <polyline class={`chart-line chart-tone-${s.tone}`} points={linePoints(g.lines[k]!)} pathLength={PATH_LENGTH} />
            {g.lines[k]!.filter((_, i) => g.step >= MARKER_MIN_STEP || i === 0 || i === last).map((p) =>
              s.mark === "square" ? (
                <rect class={`chart-dot chart-tone-${s.tone}`} x={p.x - 3} y={p.y - 3} width="6" height="6" />
              ) : (
                <circle class={`chart-dot chart-tone-${s.tone}`} cx={p.x} cy={p.y} r="3" />
              ),
            )}
          </>
        ))}
      </svg>
      {children}
    </figure>
  );
};
```

Vùng hit nằm trong `<g class="chart-group">` và vẽ trước đường/marker; `.chart-line, .chart-dot { pointer-events: none }` để mọi con trỏ trên chart rơi vào `.chart-hit` (không có vùng chết quanh marker). `.chart-cross` là đường dọc chỉ hiện khi hover nhóm (CSS thuần, spec §5.9 chart 2).

- [ ] **Step 6: `MarketPulse.tsx` và `Trending.tsx`**

`MarketPulse.tsx`: giữ `home-pulse-grid`. Nhánh categories:

```tsx
<div class="home-pulse-item">
  <BarChart
    locale={locale}
    title={tr("home.pulse.requestsTitle")}
    series={[
      { tone: "blue", label: tr("home.pulse.requests", { days: REQUEST_DAYS }) },
      { tone: "orange", label: tr("home.pulse.products") },
    ]}
    rows={categories.map((row) => ({ label: tr(CATEGORY_KEY[row.category]), values: [row.requests, row.products] }))}
  >
    <ChartData summary={tr("home.chart.table")}>
      <div class="table-wrap">{/* bảng requests-by-category của 7b, không đổi */}</div>
    </ChartData>
  </BarChart>
  {scarcest ? <p class="home-scarcest">{/* không đổi */}</p> : null}
</div>
```

Nhánh growth: `LineChart` với `title={tr("home.pulse.growthTitle")}`, `series={[{ tone: "orange", label: tr("home.numbers.products"), mark: "square" }, { tone: "blue", label: tr("home.numbers.builders"), mark: "circle" }]}`, `labels={weekLabels}` với `const weekLabels = formatWeeks(locale, growth.map((p) => p.week))`, `values={[growth.map((p) => p.products), growth.map((p) => p.builders)]}`, và bảng growth của 7b trong `<ChartData>`; ô `<th scope="row">` đổi `{point.week}` thành `{weekLabels[i]}` (map có chỉ số `i`; bảng và trục dùng cùng nhãn). Import `BarChart`, `ChartData`, `LineChart` từ `../Chart.tsx`, `formatWeeks` từ `../format.ts`. Không dùng `slice`/số trong file này (test không chữ số). Xóa comment "Tables for now".

`Trending.tsx`: `<polyline points={sparkPoints(item.sparkline)} pathLength={PATH_LENGTH} />`; import `PATH_LENGTH`.

- [ ] **Step 7: CSS và i18n**

`app.css`: thêm `--chart-blue: #2a78d6; --chart-orange: #eb6834;` vào `:root`; `--chart-blue: #5b9bf0; --chart-orange: #f58a5c;` vào CẢ HAI khối dark (cuối mỗi khối, sau `--shadow-…`). Thêm ở cuối file:

```css
/* VNX-0704a: charts. Series colours are checked by test/home/chart-colours.test.ts; text is never a series colour. */
.chart { margin: 0 0 16px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
.chart-svg { display: block; width: 100%; height: auto; }
.chart-tone-blue { --chart-ink: var(--chart-blue); }
.chart-tone-orange { --chart-ink: var(--chart-orange); }
.chart-bar, .chart-dot { fill: var(--chart-ink); }
.chart-line { fill: none; stroke: var(--chart-ink); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart-label, .chart-value, .chart-axis-label { fill: var(--text); font: 400 12px var(--font); }
.chart-value, .chart-axis-label { font-family: var(--font-mono); }
.chart-axis { stroke: var(--border-strong); stroke-width: 1; }
.chart-grid { stroke: var(--border); stroke-width: 1; }
.chart-hit { fill: transparent; pointer-events: all; }
.chart-line, .chart-dot { pointer-events: none; }
.chart-cross { stroke: transparent; stroke-width: 1; pointer-events: none; }
.chart-group:hover .chart-cross { stroke: var(--text-2); }
.chart-legend { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; color: var(--text); font-size: 14px; }
.chart-swatch { display: inline-block; width: 12px; height: 12px; margin-right: 8px; vertical-align: -1px; border-radius: 2px; background: var(--chart-ink); }
.chart-swatch.chart-mark-circle { border-radius: 50%; }
.chart-data { margin-top: 12px; }
.chart-data summary { display: inline-flex; align-items: center; min-height: 44px; color: var(--primary); font-weight: 600; cursor: pointer; }
.chart-data summary::after { content: ""; width: 8px; height: 8px; margin-left: 10px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); transition: transform var(--dur-1) ease; }
.chart-data[open] summary::after { transform: rotate(-135deg); }
.chart-data summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.home-pulse-item { min-width: 0; }
```

Thêm key `"home.chart.table"` vào 4 file locale theo bảng trên.

- [ ] **Step 8: Chạy xanh và kiểm tác động**

`npm test -w apps/web -- test/home test/design/assets.test.ts` → PASS. Các test cũ phải xanh không sửa: `blocks-b` (`<th scope="row">` vẫn chỉ nằm trong bảng; chart không dùng `<th>`), `home.test.ts:84` (`count(...,"<polyline")` đã giới hạn trong khối `home-trending`, nên 2 `<polyline>` mới của chart đường ở `home-pulse` không ảnh hưởng: KHÔNG sửa test nào), `separable.test.tsx` (marker `data-chart="requests-by-category"`, không `<section>`/`lp-`), `home.test.ts:156` (không chữ số trong `views/home/*.tsx`; `home.chart.table` được dùng trong `MarketPulse.tsx`).

- [ ] **Step 9: Kiểm tra cuối, commit**

```bash
npm run typecheck -w apps/web
npm test
git diff --stat -- package.json package-lock.json apps/web/package.json   # rỗng
git add apps/web/src/views/chart-geometry.ts apps/web/src/views/Chart.tsx apps/web/src/views/format.ts apps/web/src/views/home/MarketPulse.tsx apps/web/src/views/home/Trending.tsx apps/web/public/assets/app.css apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/home/chart.test.ts apps/web/test/home/chart-colours.test.ts
git commit -m "feat(web): add SVG charts with legend, data table and colour validator (VNX-0704a)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


**Acceptance (mỗi mục một lệnh):**
1. `npm test -w apps/web -- test/home/chart.test.ts` xanh: hình học, hai chart SVG, legend ở cả hai, `<details>` đóng chứa bảng, không `style=`/focus/màu trên `<text>`, nhãn tuần không còn `YYYY-Www`.
2. `npm test -w apps/web -- test/home/chart-colours.test.ts` xanh: `#2a78d6`/`#eb6834` ở light, bước dark riêng ở cả hai khối dark, tương phản ≥ 3:1 trên `--surface`, khoảng cách CVD ≥ 100.
3. `npm test -w apps/web -- test/home test/design/assets.test.ts` xanh.
4. `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng; `grep -rn "<script" apps/web/src/views/Chart.tsx apps/web/src/views/home` rỗng.
5. `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ~320 dòng mã chạy không tính locale và test (chart-geometry.ts ~55, Chart.tsx ~100, format.ts ~20, MarketPulse/Trending ~45, CSS ~25 và token ~4); test ~190 dòng. Cộng test ~490, dưới 600.

---

### Task 8b: VNX-0704b — Animation cuộn, đếm số, dải Live, tooltip, reduced-motion

Phụ thuộc 8a (class `chart-bar`, `chart-line`, `[data-tip]`, `PATH_LENGTH`). Chặn bởi (a) như Task 7.

**Files:**
- Create: `apps/web/public/assets/home.js` (một IIFE, không thư viện)
- Modify: `apps/web/src/views/LandingPage.tsx` (dòng 116: `scripts={["/assets/landing.js", "/assets/home.js"]}`)
- Modify: `apps/web/src/views/home/Numbers.tsx` (giá trị thật trong `.visually-hidden`, chữ số động `aria-hidden` mang `data-count`)
- Modify: `apps/web/src/views/home/HomeSection.tsx` (`reveal-scroll` ở `section-head`), `Trending.tsx` và `TopProducts.tsx` (`lift` ở `.home-tile`)
- Modify: `apps/web/test/home/home.test.ts` (một dòng: chuỗi đếm `'<li class="home-tile"'` thành `'<li class="home-tile lift"'`)
- Modify: `apps/web/src/views/home/Live.tsx` (móc `data-marquee` và nút tạm dừng ẩn sẵn)
- Modify: `apps/web/public/assets/app.css`
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (1 key)
- Test: `apps/web/test/home/motion.test.ts`; giữ xanh `test/design/assets.test.ts`, `test/home/*`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Chọn theo `data-*`, không theo cấu trúc landing.** JS dùng `[data-count]`, `[data-marquee]`, `[data-motion-toggle]`, `[data-tip]`; test cấm selector `#home-`, `.lp-`, `.home-block`, `section`, `.container`. Homepage ba cột sau M7 dùng lại khối thì JS chạy y nguyên (Owner 2026-10-06).
2. **Nạp ở `/` bằng `scripts` của Layout** (khử trùng như script privacy-notice), có `defer`, luôn nạp trên `/` kể cả khi mọi khối ẩn (file nhỏ; giữ nguyên test hiện có "số `<script>` giữa trang đầy và rỗng bằng nhau"). Không nạp ở trang khác. Trang ba cột sau này thêm đúng một dòng vào `scripts`.
3. **Fallback tức thì:** không JS, hoặc thiếu IntersectionObserver, thì số hiện giá trị cuối (HTML đã chứa), Live là danh sách dọc như 7b, chart đã vẽ xong. Animation cuộn chỉ nằm TRONG khối `@supports (animation-timeline: view())` ĐÃ CÓ trong `app.css` (test cũ buộc đúng một khối và cấm `animation-timeline` ngoài nó), nên trình duyệt thiếu hỗ trợ không thấy hiệu ứng và không bị ẩn nội dung.
4. **Reduced motion:** CSS thêm `.chart-bar, .chart-line, .home-spark polyline, .home-marquee-track { animation: none !important; }` và `stroke-dasharray: none` vào khối `@media (prefers-reduced-motion: reduce)` hiện có. JS: `matchMedia("(prefers-reduced-motion: reduce)")` thoát sớm trước đếm số và dải Live, nên số hiện giá trị cuối và Live không cuộn. Tooltip vẫn chạy (không phải animation).
5. **Dải Live** là nâng cấp bằng JS: bọc `ul[data-marquee]` vào `.home-marquee > .home-marquee-track`, nhân bản danh sách một lần (`aria-hidden="true"`, `inert`) để vòng lặp liền mạch, dùng lại `@keyframes belt` đã có (`-50%`). Không JS thì danh sách dọc 7b không đổi. Thời lượng = số sự kiện x 4 giây, đặt bằng `style.setProperty("--marquee-s", …)` (CSSOM, không vi phạm CSP, không `style=` trong HTML).
6. **WCAG 2.2.2:** dải tự chạy dừng được bằng hover hoặc focus bên trong, bằng nút bật tắt `aria-pressed` (JS bỏ `hidden`), và bằng reduced motion. Nút render sẵn trong `Live`: `<button type="button" hidden data-motion-toggle aria-pressed="false">`.
7. **Đếm số:** mỗi `[data-count]` chạy 0 tới giá trị trong 1200 ms (ease-out) khi khối cuộn vào khung nhìn (IntersectionObserver, ngưỡng 0.4). Đây là cách đọc "khi tải trang" của spec: khối nằm DƯới landing nên đếm lúc tải trang thì không ai thấy, định dạng bằng `Intl.NumberFormat(document.documentElement.lang)`, kết thúc LUÔN đặt đúng giá trị cuối. Giá trị cuối do server in sẵn; JS không tự tính con số nào. **Trình đọc màn hình (Controller chọn phương án a):** SSR in giá trị thật trong `<span class="visually-hidden">` (class đã có ở `app.css:111`, không thêm trùng) và chữ số động trong `<span aria-hidden="true" data-count="…">`; nên người đọc màn hình luôn nghe số cuối, không nghe số đang nhảy.
8. **Tooltip:** một `div.chart-tip` (`aria-hidden="true"`, `pointer-events: none`) tạo bằng JS, nội dung bằng `textContent` từ `data-tip` (không `innerHTML`), đặt vị trí bằng `style.left/top` (CSSOM), ẩn khi rời, cuộn, hoặc nhấn Escape (WCAG 1.4.13). Chỉ cho con trỏ và chạm; bàn phím và trình đọc màn hình dùng bảng `<details>` của 8a.
9. **Hero:** không có mã xoay thẻ (xem 8a). Test cấm `setInterval` trong `home.js`.
10. **Ngân sách:** `home.js` ≤ 6 KB; tổng JS cùng gốc tải ở `/` ≤ 60 KB (NFR homepage; không tính script Turnstile, vốn không đổi và chỉ nạp ở trang có form); các trang công khai khác không nạp (≤ 30 KB giữ nguyên). `landing.js` giữ ≤ 2 KB (test cũ).
11. **Phủ spec §5.9 (Controller):** `HomeSection` thêm `reveal-scroll` vào `section-head`; `.home-tile` thêm `lift`. Hai class đã có (`app.css:545` và `:413`), đã nằm trong khối reduce. Mỗi chart khai `view-timeline: --chart-in` (trên `.chart`, HTML) và sparkline `--spark-in` (trên `.home-spark`), CHỈ trong khối `@supports` duy nhất; thanh và đường dùng `animation-timeline: --chart-in`/`--spark-in` thay vì `view()` trên chính phần tử SVG (hộp của phần tử con SVG co lại theo transform nên khó đoán).
12. **Focus không bị dải che:** `.home-marquee:focus-within .home-marquee-track { animation: none; }` (không chỉ tạm dừng) để trình duyệt cuộn được tới liên kết đang focus.
13. **Hành vi JS không có test tự động** (Vitest chạy trong workerd, không DOM, không `eval`): test khẳng định nội dung và cấu trúc; kiểm tay ở Step 8.

**i18n (1 key, nhãn nút, không chữ số):**

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `home.motion.pause` | Pause scrolling | Tạm dừng cuộn | 暂停滚动 | 暫停捲動 |

Đặt cạnh `"home.live.requestNew"` ở cả 4 file.

- [ ] **Step 1: Viết test (đỏ)**

`apps/web/test/home/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { formatCount } from "../../src/views/format.ts";
import { testEnv } from "../helpers.ts";
import { block, getHome, seedSnapshot } from "./blocks.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const text = async (path: string) => (await get(path)).text();
const atBlocks = (css: string, rule: string) => {
  const out: { prelude: string; body: string }[] = [];
  const re = new RegExp(`@${rule}\\b([^{]*)\\{`, "g");
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
    out.push({ prelude: (m[1] ?? "").trim(), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
};

describe("home.js (VNX-0704b)", () => {
  it("is at most 6 KB, same-origin, no network, no import, no innerHTML, no timer that rotates cards", async () => {
    const res = await get("/assets/home.js");
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBeLessThanOrEqual(6 * 1024);
    const js = await text("/assets/home.js");
    expect(js).not.toMatch(/\bimport\b|\brequire\(|\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\/|document\.cookie|localStorage|innerHTML|\beval\(|new Function/);
    expect(js).not.toContain("setInterval");
    expect(js).toMatch(/matchMedia\(\s*["']\(prefers-reduced-motion: reduce\)["']\s*\)/);
  });
  it("selects only by data-* hooks, never by where a block sits", async () => {
    const js = await text("/assets/home.js");
    for (const hook of ["[data-count]", "[data-marquee]", "[data-motion-toggle]", "[data-tip]"]) expect(js).toContain(hook);
    expect(js).not.toMatch(/["'][^"']*(#home-|\.lp-|\.home-block|\bsection\b|\.container)[^"']*["']/);
  });
  it("is loaded with defer on / in every locale, once, and on no other page", async () => {
    for (const path of ["/", "/vi/", "/zh-hans/", "/zh-hant/"]) {
      const html = await text(path);
      expect(html.match(/<script[^>]*src="\/assets\/home\.js"[^>]*>/g), path).toEqual([expect.stringMatching(/\sdefer(=|>|\s)/)]);
      expect(html, path).toContain("/assets/landing.js");
    }
    for (const path of ["/products", "/builders", "/vi/terms", "/login", "/for-builders"]) expect(await text(path), path).not.toContain("home.js");
  });
  it("keeps the JS of / under 60 KB in total", async () => {
    const srcs = [...(await text("/")).matchAll(/<script[^>]*\ssrc="(\/[^"]+)"/g)].map((m) => m[1]!);
    expect(srcs).toContain("/assets/home.js");
    let total = 0;
    for (const src of srcs) total += (await (await get(src)).arrayBuffer()).byteLength;
    expect(total).toBeLessThanOrEqual(60 * 1024);
  });
});

describe("markup hooks", () => {
  it("every Numbers tile prints its final value (visually hidden for screen readers) and animates an aria-hidden copy carrying data-count", async () => {
    await seedSnapshot();
    const tiles = [...block(await getHome(), "home-numbers").matchAll(/<strong><span class="visually-hidden">([^<]*)<\/span><span aria-hidden="true" data-count="(\d+)">([^<]*)<\/span><\/strong>/g)];
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    for (const [, real, value, shown] of tiles) {
      expect(shown).toBe(formatCount("en", Number(value)));
      expect(real, "the real value is what a screen reader gets").toBe(shown);
    }
  });
  it("Live keeps the static list, marks it for the strip, and holds a hidden pause button in every locale", async () => {
    await seedSnapshot();
    for (const locale of LOCALES) {
      const html = block(await getHome(localizedPath(locale, "/")), "home-live");
      expect(html, locale).toMatch(/<ul[^>]*data-marquee/);
      expect(html, locale).toMatch(/<button[^>]*type="button"[^>]*data-motion-toggle[^>]*>/);
      expect(html, locale).toMatch(/<button[^>]*\shidden/);
      expect(html, locale).toContain('aria-pressed="false"');
      expect(html, locale).toContain(t(locale, "home.motion.pause"));
      expect(html, locale).not.toMatch(/\sstyle=|\son[a-z]+=/i);
    }
  });
  it("section heads reveal on scroll and tiles lift, using the classes the reduced-motion block already covers", async () => {
    await seedSnapshot();
    const html = await getHome();
    for (const id of ["home-numbers", "home-trending", "home-pulse"]) expect(block(html, id), id).toContain('class="section-head reveal-scroll"');
    expect(block(html, "home-trending")).toMatch(/<li class="home-tile lift"/);
    expect(block(html, "home-products")).toMatch(/<li class="home-tile lift"/);
  });
  it("chart groups carry data-tip text with the label and every series value", async () => {
    await seedSnapshot();
    const tips = [...block(await getHome(), "home-pulse").matchAll(/data-tip="([^"]+)"/g)].map((m) => m[1]!);
    expect(tips.length).toBeGreaterThan(0);
    for (const tipText of tips) expect(tipText).toMatch(/: .+ \d+ · .+ \d+/);
  });
});

describe("CSS motion (spec §9: reduced motion has no animation)", () => {
  it("runs chart and sparkline animation only inside the one @supports (animation-timeline: view()) block", async () => {
    const css = await text("/assets/app.css");
    const supports = atBlocks(css, "supports").filter((b) => /animation-timeline:\s*view\(\)/.test(b.prelude));
    expect(supports).toHaveLength(1);
    for (const selector of [".chart-bar", ".chart-line", ".home-spark polyline"]) expect(supports[0]!.body, selector).toContain(selector);
    expect(supports[0]!.body).toMatch(/\.chart\s*\{[^}]*view-timeline:\s*--chart-in/);
    expect(supports[0]!.body).toMatch(/\.home-spark\s*\{[^}]*view-timeline:\s*--spark-in/);
    expect(supports[0]!.body).toMatch(/\.chart-bar[^{]*\{[^}]*animation-timeline:\s*--chart-in/);
    expect(supports[0]!.body).toMatch(/\.home-spark polyline[^{]*\{[^}]*animation-timeline:\s*--spark-in/);
    // Outside @supports (and outside the reduced-motion blocks, whose `animation: none` is the point) nothing animates a chart.
    let plain = css.replace(supports[0]!.body, "");
    for (const m of atBlocks(css, "media").filter((x) => /prefers-reduced-motion/.test(x.prelude))) plain = plain.replace(m.body, "");
    expect(plain).not.toMatch(/\.chart-(bar|line)[^{]*\{[^}]*animation\s*:/);
  });
  it("turns off every home animation under prefers-reduced-motion: reduce", async () => {
    const css = await text("/assets/app.css");
    const reduce = atBlocks(css, "media").filter((b) => /prefers-reduced-motion:\s*reduce/.test(b.prelude)).map((b) => b.body).join("\n");
    for (const selector of [".chart-bar", ".chart-line", ".home-spark polyline", ".home-marquee-track"]) expect(reduce, selector).toContain(selector);
    expect(reduce).toMatch(/animation:\s*none\s*!important/);
    expect(reduce).toMatch(/stroke-dasharray:\s*none/);
    // The strip stands still like the landing belt: wrapped, copy hidden.
    expect(reduce).toMatch(/\.home-marquee \.home-live\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(reduce).toMatch(/\.home-marquee-track\s*\{[^}]*width:\s*auto/);
    expect(reduce).toMatch(/\.home-marquee-track > \[aria-hidden="true"\]\s*\{[^}]*display:\s*none/);
  });
  it("pauses the strip on hover and the toggle, stops it on focus, and the tooltip ignores the pointer", async () => {
    const css = await text("/assets/app.css");
    expect(css).toMatch(/\.home-marquee:hover[^{]*\{[^}]*animation-play-state:\s*paused/);
    // Focus stops the strip dead (animation: none), so the browser can scroll the focused link into view.
    expect(css).toMatch(/\.home-marquee:focus-within \.home-marquee-track\s*\{[^}]*animation:\s*none/);
    expect(css).toMatch(/\.home-marquee\.is-paused[^{]*\{[^}]*animation-play-state:\s*paused/);
    expect(css).toMatch(/\.chart-tip\s*\{[^}]*pointer-events:\s*none/);
  });
  it("never hides a chart or number in a plain rule (no opacity 0, hidden or scale(0))", async () => {
    const css = await text("/assets/app.css");
    for (const m of css.matchAll(/([^{}]*\.(?:chart-bar|chart-line|home-numbers)[^{}]*)\{([^}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/opacity\s*:\s*0\b|visibility\s*:\s*hidden|scale\(0/);
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

`npm test -w apps/web -- test/home/motion.test.ts` → FAIL (chưa có `home.js`, `data-count`, `data-marquee`, CSS).

- [ ] **Step 3: Markup và script loader**

`Numbers.tsx`:

```tsx
<strong>
  <span class="visually-hidden">{formatCount(locale, tile.value)}</span>
  <span aria-hidden="true" data-count={tile.value}>{formatCount(locale, tile.value)}</span>
</strong>
```

(`.visually-hidden` có sẵn ở `app.css:111`.) `HomeSection.tsx`: `<div class="section-head reveal-scroll">`. `Trending.tsx` (hai `<li class="home-tile">`) và `TopProducts.tsx` (một) thành `class="home-tile lift"`. `test/home/home.test.ts:83` đếm `'<li class="home-tile"'`: đổi chuỗi thành `'<li class="home-tile lift"'` (sửa test duy nhất, ghi vào báo cáo).

`Live.tsx`:

```tsx
export const Live: FC<{ locale: Locale; events: readonly PublicLiveEvent[]; now: Date }> = ({ locale, events, now }) => {
  const tr = translator(locale);
  return (
    <div class="home-live-wrap">
      <button type="button" class="home-motion-toggle" data-motion-toggle hidden aria-pressed="false">{tr("home.motion.pause")}</button>
      <ul class="home-live" data-marquee>
        {events.map((e) => (
          <li class="home-live-item">
            <time datetime={e.at}>{relativeTime(locale, e.at, now)}</time>
            <LiveItem locale={locale} e={e} />
          </li>
        ))}
      </ul>
    </div>
  );
};
```

Cập nhật comment đầu `Live` (bỏ "the marquee is Task 8"). `LandingPage.tsx`: `scripts={["/assets/landing.js", "/assets/home.js"]}`. Thêm `home.motion.pause` vào 4 locale.

- [ ] **Step 4: `public/assets/home.js`**

```js
// VNX-0704b: count-up, the Live strip and the chart tooltip. No library, no network, no cookies.
// Picks everything by data-* hooks, so a block works wherever the page puts it. Without this file every block shows its final state.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nf;
  try {
    nf = new Intl.NumberFormat(document.documentElement.lang || undefined);
  } catch (e) {
    nf = new Intl.NumberFormat();
  }

  function run(el) {
    var target = Number(el.getAttribute("data-count"));
    if (!isFinite(target)) return;
    var start = null;
    function step(now) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / 1200);
      el.textContent = nf.format(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = nf.format(target);
    }
    requestAnimationFrame(step);
  }

  function countUp() {
    var els = document.querySelectorAll("[data-count]");
    if (reduce || !els.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          run(en.target);
        });
      },
      { threshold: 0.4 },
    );
    Array.prototype.forEach.call(els, function (el) {
      el.textContent = nf.format(0);
      io.observe(el);
    });
  }

  function marquees() {
    if (reduce) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-marquee]"), function (list) {
      var n = list.children.length;
      if (n < 2) return;
      var host = list.parentNode;
      var toggle = host.querySelector("[data-motion-toggle]");
      var wrap = document.createElement("div");
      var track = document.createElement("div");
      var copy = list.cloneNode(true);
      wrap.className = "home-marquee";
      track.className = "home-marquee-track";
      track.style.setProperty("--marquee-s", n * 4 + "s");
      copy.removeAttribute("data-marquee");
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      host.insertBefore(wrap, list);
      wrap.appendChild(track);
      track.appendChild(list);
      track.appendChild(copy);
      if (!toggle) return;
      toggle.hidden = false;
      toggle.addEventListener("click", function () {
        var paused = wrap.classList.toggle("is-paused");
        toggle.setAttribute("aria-pressed", paused ? "true" : "false");
      });
    });
  }

  function tooltips() {
    var tip = null;
    function hide() {
      if (tip) tip.hidden = true;
    }
    function place(e) {
      tip.style.left = Math.max(8, Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8)) + "px";
      tip.style.top = e.clientY + 16 + "px";
    }
    document.addEventListener("pointerover", function (e) {
      var g = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!g) return hide();
      if (!tip) {
        tip = document.createElement("div");
        tip.className = "chart-tip";
        tip.setAttribute("aria-hidden", "true");
        document.body.appendChild(tip);
      }
      tip.textContent = g.getAttribute("data-tip");
      tip.hidden = false;
      place(e);
    });
    document.addEventListener("pointermove", function (e) {
      if (tip && !tip.hidden) place(e);
    });
    document.addEventListener("pointerout", function (e) {
      if (!e.relatedTarget) hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });
  }

  countUp();
  marquees();
  tooltips();
})();
```

- [ ] **Step 5: CSS**

Trong khối `@supports (animation-timeline: view())` ĐÃ CÓ (không tạo khối thứ hai) thêm:

```css
  .chart { view-timeline: --chart-in block; }
  .home-spark { view-timeline: --spark-in block; }
  .chart-bar { transform-box: fill-box; transform-origin: 0 50%; animation: chart-grow linear both; animation-timeline: --chart-in; animation-range: entry 0% cover 40%; }
  .chart-line { stroke-dasharray: 100; animation: chart-draw linear both; animation-timeline: --chart-in; animation-range: entry 0% cover 40%; }
  .home-spark polyline { stroke-dasharray: 100; animation: chart-draw linear both; animation-timeline: --spark-in; animation-range: entry 0% cover 40%; }
```

Cạnh các `@keyframes` hiện có (NGOÀI khối `@supports`):

```css
@keyframes chart-grow { from { transform: scaleX(0); } to { transform: none; } }
@keyframes chart-draw { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
```

Trong khối `@media (prefers-reduced-motion: reduce)` hiện có thêm:

```css
  .chart-bar, .chart-line, .home-spark polyline, .home-marquee-track { animation: none !important; }
  .chart-line, .home-spark polyline { stroke-dasharray: none; }
  /* The strip stands still like the landing belt: wrapped, the copy hidden. */
  .home-marquee .home-live { flex-wrap: wrap; }
  .home-marquee-track { width: auto; }
  .home-marquee-track > [aria-hidden="true"] { display: none; }
```

Sau khối `/* VNX-0704a */` thêm:

```css
/* VNX-0704b: Live strip (JS adds .home-marquee), pause button, tooltip. Numbers keep a steady width while counting. */
.home-numbers strong { font-variant-numeric: tabular-nums; }
.home-motion-toggle { min-height: 44px; margin: 0 0 8px; padding: 8px 14px; color: var(--primary); background: transparent; border: 1px solid var(--border-strong); border-radius: var(--r-md); font-weight: 600; cursor: pointer; }
.home-motion-toggle[aria-pressed="true"] { background: var(--surface-2); }
.home-motion-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.home-marquee { overflow: hidden; }
.home-marquee-track { display: flex; width: max-content; animation: belt var(--marquee-s, 60s) linear infinite; }
.home-marquee .home-live { flex-direction: row; flex-wrap: nowrap; gap: 12px; padding-right: 12px; }
.home-marquee .home-live-item { flex: none; white-space: nowrap; }
.home-marquee:hover .home-marquee-track { animation-play-state: paused; }
.home-marquee:focus-within .home-marquee-track { animation: none; }
.home-marquee.is-paused .home-marquee-track { animation-play-state: paused; }
.chart-tip { position: fixed; z-index: 40; max-width: 280px; padding: 8px 12px; color: var(--text); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-md); box-shadow: var(--shadow-2); font-size: 13px; pointer-events: none; }
.chart-tip[hidden] { display: none; }
```

`@keyframes belt` đã có, dải Live dùng lại.

- [ ] **Step 6: Chạy xanh**

`npm test -w apps/web -- test/home test/design/assets.test.ts` → PASS. Test cũ giữ xanh: `assets.test.ts` "scroll reveal inside @supports" (đúng một khối, không `animation-timeline` ngoài nó) và "turns off every animation under reduced motion" (khối reduce chỉ được thêm); `home.test.ts` "adds no <script>…" (hai trang đều có `home.js` nên số `<script>` bằng nhau; vùng khối không có `<script>`, `style=`, `on…=`). Có thể sửa chữ mô tả "(CSP; scripts are Task 8)" trong test đó, tùy chọn.

- [ ] **Step 7: Kiểm tra cuối, commit**

```bash
npm run typecheck -w apps/web
npm test
git diff --stat -- package.json package-lock.json apps/web/package.json   # rỗng: không thêm dependency
git add apps/web/public/assets/home.js apps/web/public/assets/app.css apps/web/src/views/LandingPage.tsx apps/web/src/views/home/Numbers.tsx apps/web/src/views/home/Live.tsx apps/web/src/views/home/HomeSection.tsx apps/web/src/views/home/Trending.tsx apps/web/src/views/home/TopProducts.tsx apps/web/test/home/home.test.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/home/motion.test.ts
git commit -m "feat(web): add scroll-driven chart motion, count-up, Live strip and chart tooltip (VNX-0704b)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Kiểm tay trong trình duyệt (BẮT BUỘC ghi vào báo cáo: tối thiểu mục 3, 5, 6 và ca focus; thiếu bản ghi là một phát hiện review)**

`npm run dev`, mở `/` với snapshot đủ ngưỡng: (1) bar mọc từ trục trái (xác nhận bar THỰC SỰ mọc trong Chromium với `view-timeline` đặt trên `.chart`), đường chart và sparkline vẽ dần khi cuộn tới, tiêu đề khối hiện dần; trình duyệt khác thấy chart đầy đủ ngay; (2) số đếm lên một lần khi vào khung nhìn, kết thúc đúng số in sẵn; (3) dải Live cuộn ngang, dừng khi hover và khi bấm nút; Tab vào một liên kết trong dải thì dải dừng hẳn và liên kết hiện trong khung (ca focus); (4) rê chuột lên nhóm chart ra tooltip, Escape ẩn nó; (5) DevTools Rendering bật "prefers-reduced-motion: reduce": số hiện giá trị cuối ngay, Live không cuộn, chart đầy đủ không chuyển động; (6) tắt JS: mọi khối vẫn đọc được, Live là danh sách dọc.

**Acceptance (mỗi mục một lệnh):**
1. `npm test -w apps/web -- test/home/motion.test.ts` xanh: `home.js` ≤ 6 KB, không mạng/`innerHTML`/`setInterval`, chọn theo `data-*`, nạp `defer` chỉ ở `/`, tổng JS của `/` ≤ 60 KB.
2. Cùng file: hiệu ứng chỉ trong `@supports (animation-timeline: view())` duy nhất; khối `prefers-reduced-motion: reduce` tắt chart, sparkline, dải Live (spec §9 "Homepage với `prefers-reduced-motion` không có animation").
3. `npm test -w apps/web -- test/design/assets.test.ts test/home` xanh (test cũ không sửa, trừ chữ mô tả tùy chọn).
4. `git diff --stat -- package.json package-lock.json apps/web/package.json` rỗng; `grep -rn "<script" apps/web/src/views/home` rỗng.
5. `npm run typecheck -w apps/web` và `npm test` xanh. Diff ước tính ~210 dòng mã chạy không tính locale (home.js ~95, CSS ~45, TSX ~30, LandingPage 1) và ~150 dòng test.

**Câu hỏi cho Owner (không chặn viết code):**
- (i) **ĐÃ GIẢI QUYẾT (Controller: nhãn UI thuần, đã duyệt):** `home.chart.table` ("Show data as a table", 8a) và `home.motion.pause` ("Pause scrolling", 8b) ở 4 locale. Không có câu mô tả mới nào khác; trục, legend, nhãn tuần là nhãn dữ liệu.
- (ii) Hero auto-rotate không làm lại vì deck landing đã có; nếu Owner muốn bộ xoay riêng cho hero của homepage ba cột thì là task sau M7.

---

### Task 9: VNX-0705b — `/for-builders`

**Scope:** Owner (d) D2: trang tối thiểu, dựng CHỈ từ chữ landing đã duyệt (`landing.builders.*`). Một khối "For builders" (eyebrow, tiêu đề H1, câu phụ, 3 lợi ích, nút, 3 bước), không viết câu mới, không số, testimonial, logo, không chip công cụ AI, không JS. Nút trỏ cùng đích với CTA landing (`builderCtaHref`: chưa đăng nhập → `/login?next=/hub/apply`, đã đăng nhập → `/hub`), không đổi auth. Thêm vào sitemap (kèm alternate) và đổi mục "For builders" trên header từ `/#builders` sang `/for-builders`. Landing giữ nguyên khối `#builders` của nó. Marketing plan (CTA "List what you built") là hướng tương lai, KHÔNG làm ở đây.

**Files:**
- Create: `apps/web/src/views/landing/Icon.tsx` (chuyển `Icon` và `CHECK` ra khỏi `LandingPage.tsx`, không đổi hành vi), `apps/web/src/views/ForBuildersPage.tsx`, `apps/web/src/routes/for-builders.tsx`, `apps/web/test/public/for-builders.test.ts`.
- Modify: `apps/web/src/views/LandingPage.tsx` (import `Icon`, `CHECK` thay định nghĩa cục bộ; `ARROW` ở lại), `apps/web/src/views/Layout.tsx` (mục nav), `apps/web/src/app.ts` (đăng ký route), `apps/web/src/routes/seo.ts` (một dòng `entries`), `apps/web/public/assets/app.css` (một selector), `apps/web/test/design/layout.test.ts` (dòng NAV), `apps/web/test/seo/sitemap.test.ts` (thêm `/for-builders` vào danh sách).
- i18n: KHÔNG có key mới, không đụng 4 file locale. Mọi chữ lấy từ `landing.builders.*` và `nav.forBuilders` (đủ 4 locale, test parity hiện có). Tiêu đề tab = `${nav.forBuilders} · VNX.SI`; description = `landing.builders.sub`. Không phải key mới vì ghép chuỗi bằng mã.

**Interfaces:**
- Consumes (thật): `Layout`, `builderCtaHref` (`views/Layout.tsx`); `translator` (`i18n/t.ts`); `onLocalized` (`http/localized.ts`); `siteOrigin` (`http/origin.ts`); `page` (`views/render.ts`); `MessageKey` (`i18n/messages/en.ts`); class CSS có sẵn `lp-builders`, `lp-builders-inner`, `lp-split`, `section-head`, `eyebrow`, `section-sub`, `lp-perks`, `lp-builders-cta`, `btn btn-light btn-lg`, `lp-steps`, `lp-step`, `lp-step-num`, `lp-step-body`; `c.get("user")`, `c.get("locale")`.
- Produces: `Icon`, `CHECK` (`views/landing/Icon.tsx`); `ForBuildersPage: FC<{ locale: Locale; origin: string; signedIn: boolean }>`; `registerForBuildersRoutes(app: Hono<AppEnv>)`; route `GET /for-builders` và `/{vi,zh-hans,zh-hant}/for-builders`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. Dùng lại markup và class của khối `#builders` landing (băng tối) thay vì CSS mới, để trang đúng "chữ và dáng đã duyệt". Chỉ thêm `h1` vào đúng phạm vi `.lp-builders`, KHÔNG mở rộng `.section-head h2` (sẽ đổi kiểu `h1` của `/contact`): `app.css:391` thành `.section-head h2, .lp-builders h1 {` và `app.css:427` thành `.lp-builders :is(h1, h2) {`, vì trang cần đúng một `<h1>`. Không dùng `reveal-scroll` (không cần animation, tránh phụ thuộc `landing.js`).
2. Header: `/#builders` → `/for-builders`, `current: rest === "/for-builders"`. Footer GIỮ NGUYÊN (test footer ghim đúng href; footer đã có "Become a builder"). Câu hỏi Owner bên dưới nếu muốn thêm vào footer.
3. Route đăng ký trong file riêng, KHÔNG gọi `c.html(` (guard kiến trúc), đi qua `page()`. `Cache-Control` mặc định như landing (không đặt gì), vì trang tĩnh theo locale và có nút phụ thuộc đăng nhập (giống `/`).
4. Chống "bịa" bằng test: văn bản của `<main>` phải BẰNG ĐÚNG nối các key đã duyệt, theo thứ tự, ở cả 4 locale; không chữ số, không `<img`, không `<script`. Thêm một câu hay một con số là test đỏ.

- [ ] **Step 1: Tách `Icon` và `CHECK` (refactor giữ nguyên hành vi)**

Create `apps/web/src/views/landing/Icon.tsx`: chuyển nguyên văn từ `LandingPage.tsx` (dòng 35–54 và `const CHECK`), thêm `export`:

```tsx
import type { FC } from "hono/jsx";

/** Stroke icons, one set (audit §2.7). Decorative: the text next to them carries the meaning. */
export const Icon: FC<{ d: readonly string[]; size?: number; width?: number; circles?: readonly (readonly [number, number, number])[]; rects?: readonly (readonly [number, number, number, number, number])[] }> = ({
  d, size = 22, width = 1.6, circles = [], rects = [],
}) => (
  <svg class="icon" viewBox="0 0 24 24" width={size} height={size} stroke-width={width} aria-hidden="true" focusable="false">
    {rects.map(([x, y, w, h, r]) => (<rect x={x} y={y} width={w} height={h} rx={r} />))}
    {circles.map(([cx, cy, r]) => (<circle cx={cx} cy={cy} r={r} />))}
    {d.map((path) => (<path d={path} />))}
  </svg>
);

export const CHECK = ["M5 12l5 5L20 7"];
```

(Giữ định dạng nhiều dòng của bản gốc khi chép; ở trên chỉ nén cho gọn.) Trong `LandingPage.tsx`: xóa khối `const Icon …` và `const CHECK …`, thêm `import { CHECK, Icon } from "./landing/Icon.tsx";`, giữ `const ARROW`. Run `npm test -w apps/web -- test/landing` → GREEN (không đổi HTML).

- [ ] **Step 2: Viết test trước (RED)**

Create `apps/web/test/public/for-builders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import type { MessageKey } from "../../src/i18n/messages/en.ts";
import { t } from "../../src/i18n/t.ts";
import { builderCtaHref } from "../../src/views/Layout.tsx";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0705b (Owner D2): the page is built only from the approved landing copy.
const get = (path: string, cookie?: string) =>
  createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const PATH = (l: Locale) => localizedPath(l, "/for-builders");

/** Exactly these keys, in this order. Nothing else may appear in <main>. */
const APPROVED: MessageKey[] = [
  "landing.builders.eyebrow", "landing.builders.title", "landing.builders.sub",
  "landing.builders.perk.free", "landing.builders.perk.tools", "landing.builders.perk.requests",
  "landing.builders.apply",
  "landing.builders.step.apply.title", "landing.builders.step.apply.body",
  "landing.builders.step.list.title", "landing.builders.step.list.body",
  "landing.builders.step.requests.title", "landing.builders.step.requests.body",
];

describe("/for-builders (VNX-0705b)", () => {
  for (const locale of LOCALES) {
    it(`${locale}: 200, canonical, hreflang, one h1, no script`, async () => {
      const res = await get(PATH(locale));
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(`<link rel="canonical" href="https://vnx.si${PATH(locale)}"`);
      for (const [hreflang, href] of [["en", "/for-builders"], ["vi", "/vi/for-builders"], ["zh-Hans", "/zh-hans/for-builders"], ["zh-Hant", "/zh-hant/for-builders"], ["x-default", "/for-builders"]]) {
        expect(html, hreflang).toContain(`<link rel="alternate" hreflang="${hreflang}" href="https://vnx.si${href}"`);
      }
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(norm(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]!)).toBe(t(locale, "landing.builders.title"));
      expect(html).toContain(`<title>${t(locale, "nav.forBuilders")} · VNX.SI</title>`);
      expect(html).not.toContain("<script");
    });

    it(`${locale}: <main> is exactly the approved landing copy, nothing invented`, async () => {
      const main = mainOf(await (await get(PATH(locale))).text());
      expect(norm(main)).toBe(norm(APPROVED.map((k) => t(locale, k)).join(" ")));
      expect(norm(main)).not.toMatch(/\d/);
      expect(main).not.toMatch(/<img|<script|<form|<input/);
    });
  }

  it("the only link in <main> is the builder CTA, same target as the landing page", async () => {
    for (const locale of LOCALES) {
      const main = mainOf(await (await get(PATH(locale))).text());
      const links = [...main.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/g)].map((m) => decode(m[1]!));
      expect(links, locale).toEqual([builderCtaHref(locale, false)]);
    }
    const { cookie } = await signIn("for-builders-in@vnx.si");
    const env = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: "" } as Bindings; // a production go-live date would add a /vi/privacy notice link to <main>
    const res = await createApp().request(new Request("https://vnx.si/vi/for-builders", { headers: { cookie } }), undefined, env);
    const main = mainOf(await res.text());
    expect([...main.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/vi/hub"]);
  });

  it("is in the header nav (replacing /#builders), marked current on its own page", async () => {
    for (const locale of LOCALES) {
      const html = await (await get(PATH(locale))).text();
      const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)![1]!;
      expect(header).toContain(`href="${PATH(locale)}" aria-current="page"`);
      expect(header).not.toMatch(/href="[^"]*#builders"/);
    }
    const other = await (await get("/products")).text();
    expect(other).toContain('<a href="/for-builders">');
  });
});
```

Run `npm test -w apps/web -- test/public/for-builders.test.ts` → FAIL (404 ở mọi `/for-builders`).

- [ ] **Step 3: View, route, đăng ký, nav, sitemap, CSS**

`apps/web/src/views/ForBuildersPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { Locale } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator } from "../i18n/t.ts";
import { builderCtaHref, Layout } from "./Layout.tsx";
import { CHECK, Icon } from "./landing/Icon.tsx";

// Owner D2 (2026-10-05): only the approved landing copy. Adding a sentence here is a business decision, not an edit.
const PERKS = ["landing.builders.perk.free", "landing.builders.perk.tools", "landing.builders.perk.requests"] as const satisfies readonly MessageKey[];
const STEPS = [
  ["landing.builders.step.apply.title", "landing.builders.step.apply.body"],
  ["landing.builders.step.list.title", "landing.builders.step.list.body"],
  ["landing.builders.step.requests.title", "landing.builders.step.requests.body"],
] as const satisfies readonly (readonly [MessageKey, MessageKey])[];

export const ForBuildersPage: FC<{ locale: Locale; origin: string; signedIn: boolean }> = ({ locale, origin, signedIn }) => {
  const tr = translator(locale);
  return (
    <Layout locale={locale} title={`${tr("nav.forBuilders")} · VNX.SI`} description={tr("landing.builders.sub")} origin={origin} rest="/for-builders" signedIn={signedIn} fullWidth>
      <section class="lp-builders" aria-labelledby="builders-title">
        <div class="container lp-split lp-builders-inner">
          <div class="section-head">
            <p class="eyebrow">{tr("landing.builders.eyebrow")}</p>
            <h1 id="builders-title">{tr("landing.builders.title")}</h1>
            <p class="section-sub">{tr("landing.builders.sub")}</p>
            <ul class="lp-perks">
              {PERKS.map((perk) => (
                <li>
                  <Icon d={CHECK} size={20} width={2.5} />
                  <span>{tr(perk)}</span>
                </li>
              ))}
            </ul>
            <p class="lp-builders-cta">
              <a class="btn btn-light btn-lg" href={builderCtaHref(locale, signedIn)}>
                {tr("landing.builders.apply")}
              </a>
            </p>
          </div>
          <ol class="lp-steps">
            {STEPS.map(([title, body]) => (
              <li class="lp-step">
                <span class="lp-step-num" aria-hidden="true"></span>
                <span class="lp-step-body">
                  <strong>{tr(title)}</strong>
                  <span>{tr(body)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Layout>
  );
};
```

`apps/web/src/routes/for-builders.tsx`:

```tsx
import type { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { ForBuildersPage } from "../views/ForBuildersPage.tsx";
import { page } from "../views/render.ts";

/** /for-builders (VNX-0705b): static copy, no database read. */
export function registerForBuildersRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/for-builders", (c) => page(c, <ForBuildersPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} />));
}
```

`app.ts`: `import { registerForBuildersRoutes } from "./routes/for-builders.tsx";` và `registerForBuildersRoutes(app);` ngay sau `registerLandingRoutes(app);` (trước `/b/:handle`; không xung đột vì `for-builders` là handle dành riêng).
`seo.ts`: thêm `{ rest: "/for-builders", localized: true },` sau `/request`.
`Layout.tsx#mainNav`: thay dòng `forBuilders` bằng `{ href: localizedPath(locale, "/for-builders"), key: "nav.forBuilders", current: rest === "/for-builders" },`.
`app.css`: dòng 391 `.section-head h2 {` → `.section-head h2, .lp-builders h1 {`; dòng 427 `.lp-builders h2 {` → `.lp-builders :is(h1, h2) {` (giữ nguyên khai báo; không đổi `/contact`).
Tests cũ: `layout.test.ts` dòng NAV `["/#builders", "nav.forBuilders"]` → `["/for-builders", "nav.forBuilders"]`; `sitemap.test.ts` dòng `for (const rest of ["/terms", …, "/disclosure"])` thêm `"/for-builders"` và thêm "/for-builders" vào tên test.

Run `npm test -w apps/web -- test/public/for-builders.test.ts test/design/layout.test.ts test/seo test/landing test/i18n` → GREEN.

- [ ] **Step 4: Typecheck, full test, commit**

```text
npm run typecheck -w apps/web && npm test
git add apps/web/src/views/landing/Icon.tsx apps/web/src/views/ForBuildersPage.tsx apps/web/src/routes/for-builders.tsx apps/web/src/views/LandingPage.tsx apps/web/src/views/Layout.tsx apps/web/src/app.ts apps/web/src/routes/seo.ts apps/web/public/assets/app.css apps/web/test/public/for-builders.test.ts apps/web/test/design/layout.test.ts apps/web/test/seo/sitemap.test.ts
git commit -m "feat(web): add /for-builders from the approved landing copy (VNX-0705b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Acceptance (mỗi mục một lệnh):**
- `/for-builders` và `/vi|zh-hans|zh-hant/for-builders` 200, canonical, 4 hreflang + x-default, một `<h1>`, không `<script>`: `npm test -w apps/web -- test/public/for-builders.test.ts`.
- `<main>` chứa đúng 13 chuỗi đã duyệt, không chữ số, không hình, không form: cùng file test.
- Nút tới `/login?next=…/hub/apply` (chưa đăng nhập) hoặc `/hub` (đã đăng nhập), không link nào khác: cùng file test.
- Header nav trỏ `/for-builders`, không còn `#builders`: `npm test -w apps/web -- test/design/layout.test.ts test/public/for-builders.test.ts`.
- Sitemap có `/for-builders` đủ 4 locale + alternate, mỗi `loc` một lần: `npm test -w apps/web -- test/seo/sitemap.test.ts`.
- Landing không đổi HTML: `npm test -w apps/web -- test/landing`. Không locale mới: `git show --stat --format= HEAD -- apps/web/src/i18n` rỗng. Không dependency/migration: `git show --stat --format= HEAD -- apps/web/package.json apps/web/migrations` rỗng.
- `npm run typecheck -w apps/web` và `npm test` xanh.

**Câu hỏi mở cho Owner: RESOLVED (phán quyết của Controller).** (1) Footer giữ nguyên, không thêm link "For builders". (2) `/for-builders` chỉ có một khối đã duyệt.

**Lệch spec có chủ ý (Reviewer ghi vào CURRENT-STATUS):** spec §5.2 nói "Become a builder" trỏ tới `/for-builders`; plan giữ đích VNX-0708 `/login?next=/hub/apply` (nút của trang này dùng `builderCtaHref`).

Diff ước ~240 dòng không tính locale (mã ~110 gồm chuyển `Icon` ~±25, test ~130; locale 0).

---

### Task 10: VNX-0706 — Cutover và vá a11y

**Scope:** Owner A2 (xác nhận lại 2026-10-06): KHÔNG có cutover. `/` giữ landing VNX-0708; không đổi route, redirect, sitemap, hreflang hay `test/landing`; bảng `waitlist` giữ nguyên. Việc ghi nhận "không cutover, cổng ra M7 đọc lại theo A2" là việc của Reviewer trong `.ai/context/CURRENT-STATUS.md`; Implementer KHÔNG sửa file đó. Phần Implementer chỉ là ba mục a11y dưới đây, đều thuần HTML/CSS (không JS, không inline script/style):

1. **Skip link** "Skip to content" là phần tử đầu tiên của `<body>`, `href="#main"`. Đã kiểm code: `Layout.tsx` ĐÃ có `<main id="main">` (dòng 206, cả `container` lẫn `page-full`), và Task 3c đặt thông báo Privacy bên TRONG `<main id="main">`, nên đích tồn tại trên mọi trang dùng `Layout`; chưa có skip link nào.
2. **`.error-msg` đạt AA ở dark mode**, kiểm bằng hàm tính tương phản trong test. Đã tính trước: dark `--error` `#ff8a80` trên `--bg`/`--surface`/`--surface-2` ≈ 7–8:1, light `#b42318` ≈ 5.80–6.57:1, tức token ĐÃ đạt (từ VNX-0709); test này là hồi quy và chốt `.error-msg` dùng `var(--error)`. Nếu test đỏ ở một nền nào thì sửa giá trị `--error` trong CẢ HAI khối dark của `app.css`, không sửa test.
3. **Vùng chạm ≥ 44 × 44 px cho brand và sign-in.** Chiều cao đã 44 px (`min-height`), CHIỀU RỘNG chưa bảo đảm: `.nav-account` chỉ có `padding: 0 4px`, "登录"/"登入" ~38 px < 44. Thêm `min-width: 44px` cho `.brand`, `.site-nav a, .nav-account` và `.site-footer .footer-nav a, .footer-lang a`.

**Files:**
- Modify: `apps/web/src/views/Layout.tsx` (skip link), `apps/web/public/assets/app.css`, 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`.
- Create: `apps/web/test/design/a11y.test.ts`.
- Không đụng: `routes/landing.tsx`, `app.ts`, `routes/seo.ts`, `test/landing/*`, `CURRENT-STATUS.md`.

**Interfaces:**
- Consumes: `Layout` (`<body>`, `<main id="main">`); `t(locale, key)` (`i18n/t.ts`); `createApp`, `testEnv`, `signIn`; tokens CSS `--error`, `--bg`, `--surface`, `--surface-2`, `--primary`, `--on-primary` (đọc từ `public/assets/app.css` bằng `import.meta.glob(..., { query: "?raw" })`, cùng cách `test/design/assets.test.ts`).
- Produces: key i18n `a11y.skipToContent`; class `.skip-link`; test helper cục bộ `luminance`, `contrast` (WCAG 2.x) trong `a11y.test.ts`.

**i18n (key mới, đủ 4 locale, thêm ngay sau `nav.menu`):**

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `a11y.skipToContent` | Skip to content | Chuyển đến nội dung | 跳到主要内容 | 跳到主要內容 |

**Quyết định kỹ thuật (Reviewer kiểm):**
1. Skip link nằm TRƯỚC `<header>`, là `<a class="skip-link" href="#main">`; ẩn bằng `top: -80px` (vẫn focus được, KHÔNG `display:none`), hiện khi `:focus`. Màu `var(--on-primary)` trên `var(--primary)`; `:hover` ghi đè màu vì `a:hover` toàn cục đổi sang `--primary-hover` sẽ mất tương phản.
2. KHÔNG thêm `tabindex="-1"` vào `<main>`: test hiện có (`test/design/privacy-notice.test.ts` dòng 65, 72) khớp đúng `<main id="main" class="…">` liền sau là nội dung; trình duyệt hiện hành đặt điểm bắt đầu focus tuần tự tại đích của anchor nên không cần.
3. Tương phản kiểm bằng công thức WCAG (luminance tương đối) trên giá trị hex đọc từ `app.css`, KHÔNG hard-code số trong test, ở ba bộ token: light (`:root`), dark theo media (`:root:not([data-theme="light"])`), dark thủ công (`:root[data-theme="dark"]`). Nền kiểm: `--bg`, `--surface`, `--surface-2` (nơi `.error-msg` xuất hiện: form trên trang, thẻ, `lp-final`).
4. Vùng chạm kiểm trên CSS: mọi rule có selector `.brand`, `.nav-account`, `.site-nav a`, `.site-footer .footer-nav a` không được khai `min-height`/`min-width` < 44 ở bất cứ đâu (kể cả trong `@media`), và phải có cả hai thuộc tính ≥ 44. Chiều rộng thực của brand luôn lớn hơn 44 (logo 30 px + chữ), nhưng khai tường minh để test kiểm được.

- [ ] **Step 1: Viết test trước (RED)**

Create `apps/web/test/design/a11y.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0706 (Owner A2: no cutover): skip link, .error-msg contrast in dark mode, 44 px targets.
const CSS = Object.values(import.meta.glob("../../public/assets/app.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>)[0]!;
const get = (path: string, cookie?: string) =>
  createApp().request(new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} }), undefined, testEnv);

/** WCAG 2.x relative luminance and contrast ratio of two #rrggbb colours. */
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };

/** Hex tokens of the first rule block whose header matches. */
function tokens(header: RegExp): Record<string, string> {
  const m = header.exec(CSS);
  if (!m) throw new Error(`no CSS block for ${header}`);
  const start = m.index + m[0].length;
  const body = CSS.slice(start, CSS.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((x) => [x[1]!, x[2]!]));
}
const THEMES = {
  light: tokens(/^:root \{/m),
  "dark (prefers-color-scheme)": tokens(/:root:not\(\[data-theme="light"\]\) \{/),
  "dark (data-theme)": tokens(/:root\[data-theme="dark"\] \{/),
};

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe(".error-msg contrast (VNX-0706)", () => {
  it("uses the --error token", () => {
    expect(CSS).toMatch(/\.error-msg\s*\{[^}]*\bcolor:\s*var\(--error\)/);
  });
  for (const [name, tk] of Object.entries(THEMES)) {
    it(`${name}: --error is at least 4.5:1 on --bg, --surface and --surface-2`, () => {
      for (const bg of ["bg", "surface", "surface-2"]) {
        expect(tk[bg], `${name} --${bg}`).toBeDefined();
        expect(contrast(tk.error!, tk[bg]!), `${name} error on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${name}: the skip link (--on-primary on --primary) is at least 4.5:1`, () => {
      expect(contrast(tk["on-primary"]!, tk.primary!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("hit areas (VNX-0706)", () => {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1]!.split(",").map((s) => s.trim()), body: m[2]! }));
  const px = (body: string, prop: string) => [...body.matchAll(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`, "g"))].map((m) => Number(m[1]));
  for (const selector of [".brand", ".nav-account", ".site-nav a", ".site-footer .footer-nav a"]) {
    it(`${selector} declares min-height and min-width of at least 44px and never less`, () => {
      const own = rules.filter((r) => r.selectors.includes(selector));
      expect(own.length, selector).toBeGreaterThan(0);
      for (const prop of ["min-height", "min-width"]) {
        const values = own.flatMap((r) => px(r.body, prop));
        expect(values.length, `${selector} ${prop}`).toBeGreaterThan(0);
        expect(Math.min(...values), `${selector} ${prop}`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  it("renders the brand and the sign-in link in the header of every locale", async () => {
    for (const locale of LOCALES) {
      const html = await (await get(localizedPath(locale, "/products"))).text();
      const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)![1]!;
      expect(header, locale).toContain('class="brand"');
      expect(header, locale).toContain(`class="nav-account" href="${localizedPath(locale, "/login")}"`);
    }
  });
});

describe("skip link (VNX-0706)", () => {
  const PAGES = ["/", "/vi/products", "/zh-hans/builders", "/zh-hant/terms", "/login", "/vi/no-such-page"];
  const localeOf = (path: string): Locale => (path.startsWith("/vi") ? "vi" : path.startsWith("/zh-hans") ? "zh-Hans" : path.startsWith("/zh-hant") ? "zh-Hant" : "en");

  it("is the first element of <body> and points at #main, in every locale", async () => {
    for (const path of PAGES) {
      const html = await (await get(path)).text();
      const m = /<body>\s*<a class="skip-link" href="#main">([^<]*)<\/a>\s*<header class="site-header">/.exec(html);
      expect(m, path).not.toBeNull();
      expect(m![1], path).toBe(t(localeOf(path), "a11y.skipToContent"));
    }
  });

  it("has its target: exactly one id=\"main\", and the skip link comes before every other link", async () => {
    for (const path of PAGES) {
      const html = await (await get(path)).text();
      expect(html.match(/\bid="main"/g), path).toHaveLength(1);
      const body = html.slice(html.indexOf("<body>"));
      expect(body.indexOf("<a "), path).toBe(body.indexOf('<a class="skip-link"'));
    }
  });

  it("also leads when signed in", async () => {
    const { cookie } = await signIn("a11y-skip@vnx.si");
    expect(await (await get("/me", cookie)).text()).toMatch(/<body>\s*<a class="skip-link" href="#main">/);
  });

  it("is hidden off-screen until focused, without display:none", () => {
    const rule = /\.skip-link\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*-\d+px/);
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(CSS).toMatch(/\.skip-link:focus\s*\{[^}]*top:\s*\d+px/);
  });
});
```

Run `npm test -w apps/web -- test/design/a11y.test.ts` → FAIL: skip link (không có `.skip-link` trong HTML và CSS), và hit-area (`min-width` thiếu ở `.brand`, `.nav-account`, `.site-nav a`, footer). Các test tương phản `.error-msg` PASS ngay (token đã đạt, xem Scope mục 2); đó là hồi quy, không phải lỗi cần sửa.

- [ ] **Step 2: Skip link trong `Layout.tsx`**

Ngay sau `<body>`, trước `<header class="site-header">`:

```tsx
<a class="skip-link" href="#main">
  {tr("a11y.skipToContent")}
</a>
```

Thêm key `a11y.skipToContent` vào 4 file locale ngay sau `"nav.menu"` (xem bảng i18n): `"a11y.skipToContent": "Skip to content",`, `"Chuyển đến nội dung"`, `"跳到主要内容"`, `"跳到主要內容"`.

- [ ] **Step 3: CSS**

Trong `apps/web/public/assets/app.css`:
- Dòng `.brand { … min-height: 44px; … }`: thêm `min-width: 44px;`.
- Dòng `.site-nav a, .nav-account { … min-height: 44px; … }`: thêm `min-width: 44px; justify-content: center;`.
- Dòng `.site-footer .footer-nav a, .footer-lang a { … min-height: 44px; … }`: thêm `min-width: 44px;`.
- Thêm `main { scroll-margin-top: 68px; }` (header dính cao 68 px không che đích skip link).
- Thêm ngay sau `.visually-hidden { … }`:

```css
/* Skip link (VNX-0706): first focusable element, off-screen until it has focus. */
.skip-link { position: absolute; left: 8px; top: -80px; z-index: 100; display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: var(--r-md); background: var(--primary); color: var(--on-primary); font-weight: 600; text-decoration: none; }
.skip-link:hover, .skip-link:focus { color: var(--on-primary); }
.skip-link:focus { top: 8px; }
```

Run `npm test -w apps/web -- test/design/a11y.test.ts test/design test/i18n test/landing` → GREEN. Nếu một test tương phản đỏ, sửa `--error` trong cả hai khối dark (không sửa test), rồi chạy lại.

- [ ] **Step 4: Không cutover (kiểm âm)**

Không viết code. Chạy `npm test -w apps/web -- test/landing test/seo` → GREEN không sửa file nào trong hai thư mục này (chứng minh `/`, sitemap, hreflang không đổi). `git show --stat --format= HEAD -- apps/web/src/routes apps/web/src/app.ts apps/web/test/landing apps/web/test/seo` phải rỗng trong commit của Task 10.

- [ ] **Step 5: Typecheck, full test, commit**

```text
npm run typecheck -w apps/web && npm test
git add apps/web/src/views/Layout.tsx apps/web/public/assets/app.css apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/design/a11y.test.ts
git commit -m "feat(web): skip link, 44px hit areas and a dark-mode contrast guard (VNX-0706)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Việc của Reviewer sau verdict (không phải Implementer):** ghi vào `CURRENT-STATUS.md` rằng VNX-0706 không có cutover theo A2 (đã xác nhận 2026-10-06), cổng ra M7 "thay landing cũ" đọc lại thành "các khối dữ liệu ẩn đúng khi dưới ngưỡng, landing 0708 giữ nguyên", đóng mục "Ghi nhận" a11y của M7 (độ tương phản `.error-msg`, vùng chạm 44 px, skip link), kèm SHA commit.

**Acceptance (mỗi mục một lệnh):**
- Skip link đầu `<body>`, `href="#main"`, đúng chữ 4 locale, có đích `id="main"` đúng một lần trên mọi trang kiểm: `npm test -w apps/web -- test/design/a11y.test.ts`.
- `.error-msg` ≥ 4.5:1 trên `--bg`/`--surface`/`--surface-2` ở light và cả hai dark: cùng file test.
- `.brand`, `.nav-account`, `.site-nav a`, `.site-footer .footer-nav a` có `min-height` và `min-width` ≥ 44 px, không rule nào nhỏ hơn: cùng file test.
- 4 locale đủ key mới: `npm test -w apps/web -- test/i18n/parity.test.ts`.
- Không cutover: `git show --stat --format= HEAD -- apps/web/src/routes apps/web/src/app.ts apps/web/test/landing apps/web/test/seo` rỗng; `/robots.txt` còn `Disallow: /go/` (`npm test -w apps/web -- test/seo/robots.test.ts`); không `<script>`/`style=` mới: `git show -U0 HEAD -- apps/web/src/views/Layout.tsx | grep -E '^\+.*(<script|style=)'` không in gì.
- Không migration/dependency: `git show --stat --format= HEAD -- apps/web/migrations apps/web/package.json` rỗng; `npm run typecheck -w apps/web` và `npm test` xanh.

**Câu hỏi mở cho Owner:** không có (A2 đã xác nhận; ba mục a11y là kỹ thuật).

Diff ước ~165 dòng không tính locale (mã ~12, CSS ~6, test ~145; locale +4 dòng).

---

## Sau M7 (không thuộc plan này)

- Ops O2 đọc `public_stats`, `product_daily_stats` cho Overview; M7 không dựng màn nào trùng với O2.
- **`ANALYTICS_SALT` là công tắc bật đếm trên production: Owner KHÔNG đặt nó cho tới ngày Task 3 + Privacy cùng lên** (Task 4 được deploy trước; trong khoảng đó mỗi isolate log `visitor.no_salt`, bình thường).
- Sau khi merge (và, riêng `wrangler secret put ANALYTICS_SALT`, chỉ vào ngày go-live nói trên): Owner chạy `npx wrangler secret put ANALYTICS_SALT` (trong `apps/web`), `npm run db:migrate:remote -w apps/web` (áp `0014`–`0016`; `0014` phải áp TRƯỚC khi deploy code M7; sau `0013` của Ops nếu nó đã lên), rồi `npm run deploy` (đăng ký cron `5 * * * *` nếu (c) = C1).
