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

**Scope (Owner 2026-10-05: thay đổi quan trọng, báo trước khi cookie đếm ra mắt):** một thông báo có thể đóng, chỉ hiện cho người dùng đã đăng nhập, kèm link `/privacy`, trong một khoảng thời gian cố định. Tối thiểu: một banner trong `Layout` khi `user !== null` và `now < NOTICE_UNTIL`; đóng bằng nút (cookie hoặc cột `users`?) là câu hỏi kỹ thuật mở: cách ít xâm lấn nhất là `localStorage`/cookie phiên không định danh, không cột DB mới; Implementer nêu phương án và hỏi Reviewer nếu cần cột `users.privacy_notice_ack_at` (migration `0014`+ đánh số lại). Cửa sổ hiển thị (`NOTICE_UNTIL`) do Owner chọn. **Không tự viết câu pháp lý.** Bản nháp dưới đây chờ Owner duyệt câu chữ:

- **en (chờ Owner duyệt câu chữ):** "We are updating our Privacy Policy: from {date} we count visits to product pages using a cookie that expires at the end of each day. Read the changes."
- **vi (chờ Owner duyệt câu chữ):** "Chúng tôi cập nhật Chính sách quyền riêng tư: từ {date}, chúng tôi đếm lượt truy cập trang product bằng một cookie hết hạn vào cuối mỗi ngày. Xem thay đổi."
- zh-Hans, zh-Hant: bản dịch sau khi en/vi được duyệt.

Files, test, acceptance: viết chi tiết ngay trước khi làm, sau khi Owner duyệt câu chữ. Ràng buộc: thông báo chỉ hiện cho user đã đăng nhập, có link `/privacy`, đóng được, không hiện sau `NOTICE_UNTIL`, không đặt cookie theo dõi.

---

### Task 3: VNX-0701b — Cookie người xem và đếm lượt xem

**Scope:** (chặn bởi (b)). Migration `0015_view_dedupe.sql`: `product_view_dedupe (day TEXT NOT NULL, visitor_hash TEXT NOT NULL, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY (day, visitor_hash, product_id)) WITHOUT ROWID`. `db/stats.ts` thêm `recordProductView(db, { productId, visitorHash, now }): Promise<boolean>` (`INSERT OR IGNORE … RETURNING` → nếu có dòng thì `bumpProductStatStatement` `views: 1`, một `db.batch`; trả `true` khi cộng), `purgeViewDedupe(db, now)` (xóa `day < ngày − 2`) và bước `view_dedupe` trong `STEPS` của `jobs/daily.ts` (`counts: "deleted"`): bảng, retention và câu Privacy "xóa sau 2 ngày" đi cùng một task. Middleware/helper `http/visitor.ts` đọc cookie, sinh nếu thiếu (không cho bot, không khi thiếu salt, không khi GPC, không cho builder chủ/đội nội bộ, không cho `/admin`, `/ops`, `/hub`, `/me`; chỉ `GET /p/:slug` trả 200 mới đặt; `Max-Age` = `visitorCookieMaxAge`; phản hồi có `Set-Cookie` kèm `Cache-Control: private`), tính `visitorHash`. `routes/product-page.tsx` chỉ gọi sau khi biết product `published`, gói `waitUntil`, lỗi chỉ log; không đếm bot/builder chủ product/đội nội bộ/GPC (`shouldCount`). Privacy: chép nguyên văn câu (b) vào `docs/legal/privacy.md` (Reviewer) và `src/legal/content.ts` (Implementer), tăng `LEGAL_UPDATED_AT`, thêm dòng Cookie `__Host-vnx_vid` vào mục 5 và dòng dedupe vào mục 6; sửa câu "for now we do not link it…" của "Outbound clicks".

**Files:** Create `migrations/0015_view_dedupe.sql`; Modify `src/http/visitor.ts` (tạo bởi Task 4: `readVisitorCookie`, `warnNoSaltOnce`), `src/db/stats.ts`, `src/jobs/daily.ts`, `src/routes/product-page.tsx`, `src/legal/content.ts`, `docs/legal/privacy.md`, 4 file i18n nếu cần (cookie mục Privacy là văn bản `legal/`, không `t()`), `test/architecture.test.ts` (`WRITERS.product_view_dedupe`), `wrangler.jsonc` (ghi chú); Test `test/db/view-dedupe.test.ts`, `test/jobs/daily.test.ts` (bước `view_dedupe`), `test/product-page-views.test.ts`, `test/legal/content.test.ts`.

**Acceptance:** lượt xem đầu → `views = 1` và `Set-Cookie` đủ thuộc tính (`__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Max-Age` = giây tới 00:00 UTC kế tiếp, `Cache-Control: private`); lượt hai cùng cookie cùng ngày → vẫn 1; qua 00:00 UTC → 2; hai product khác nhau cùng cookie → mỗi cái 1; bot (UA `curl`, `Googlebot`, UA rỗng), builder chủ product, đội nội bộ, request `Sec-GPC: 1` → 0, không `Set-Cookie`, không dòng dedupe; `Set-Cookie` chỉ có trên `GET /p/:slug` 200 (không trên 404, không trên `/go/p/`); thiếu `ANALYTICS_SALT` → 0 views, không cookie, trang 200, `console.warn` một lần; product `draft`, builder bị khóa → 404, không đếm; `HEAD` không đếm; không có `Set-Cookie` trên `/admin`, `/hub`, `/me`; test `legal/content` so từng dòng xanh và câu cũ biến mất (`grep -n "for now we do not link" apps/web/src/legal/content.ts` rỗng); `product_view_dedupe` không có IP/email/user id; `purgeViewDedupe` xóa đúng dòng cũ hơn 2 ngày và chạy lại không đổi gì. Diff ~420 dòng (không tính văn bản pháp lý).

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

### Task 7: VNX-0703 — Homepage SSR các khối kèm ngưỡng

**Scope:** (A2, Owner 2026-10-05: các khối nằm DƯỚI landing 0708 ở `/`, landing giữ nguyên.) `views/home/*.tsx` cho từng khối (Hero, Con số, Live, Trending hoặc "Founding products", Market pulse bảng-trước, Top builders, Top products theo category, "4 ways", huy hiệu, khối builder, CTA cuối), `routes/home.tsx` (hoặc mở rộng `routes/landing.tsx` nếu A2) đọc MỘT truy vấn `readPublicStats`, truyền xuống; khối ẩn khi `null` hoặc stale. Chuỗi qua `t()` 4 locale; ghi nhãn "cập nhật mỗi giờ" chỉ khi có `computed_at`. Không số nào hard-code; tên builder/product chỉ từ dữ liệu; Top builders ghi tiêu chí và "không ai trả tiền để có mặt ở đây". Thẻ hero, sparkline, bảng thay cho chart ở bước này (không JS). hreflang cho 4 locale; sitemap giữ `/`.

**Files (dự kiến):** Create `src/views/home/{Hero,Numbers,Live,Trending,MarketPulse,TopBuilders,TopProducts}.tsx`, `src/routes/home.tsx`; Modify `test/architecture.test.ts` (thêm `jobs/hourly.ts`, `routes/home.tsx`, `views/home/{Trending,TopBuilders,TopProducts}.tsx` vào `RANKING_FILES`); Modify `src/app.ts`, `src/routes/landing.tsx` (theo (a)), 4 file i18n; Test `test/home/home.test.tsx` (mọi khối ẩn ở ngưỡng n−1, hiện ở n; chỉ một truy vấn `public_stats`; stale ẩn; không `<script>` ở bước này; không chữ "Sponsored"/giá trị trả tiền; 4 locale đủ key; hreflang).

**Acceptance:** cổng ra M7 "mọi khối homepage ẩn đúng khi dưới ngưỡng" bằng test từng khối; "không có số liệu nào không truy được": test grep view không chứa chữ số hard-code ngoài ngưỡng/định dạng; `GET /` p95 chỉ đọc `public_stats` (đếm số `prepare` bằng spy). Diff ~600 dòng; tách 7a (Hero, Con số, Live, Trending) / 7b (Market pulse, Top builders, Top products, khối tĩnh) nếu vượt.

---

### Task 8: VNX-0704 — Animation, chart, tooltip, bảng dữ liệu, reduced-motion

**Scope:** (chặn bởi (a), sau Task 7.) CSS scroll-driven animation với fallback hiện ngay; cột chart mọc từ baseline, đường chart/sparkline vẽ dần; con số đếm lên, dải Live chạy ngang, thẻ hero tự xoay ~4 giây, dừng khi hover/focus; JS client nhỏ (đếm số, xoay thẻ, tooltip) không thêm thư viện, đi qua `public/assets` hiện có (cùng cách `Deck.tsx`/script của landing); chart SVG tự dựng (bảng màu `#2a78d6` request, `#eb6834` product, dark mode bước màu riêng chạy lại validator; chữ luôn màu chữ), legend cho chart 2 chuỗi, `<details>` bảng dữ liệu tương đương cho mọi chart; `@media (prefers-reduced-motion: reduce)` tắt toàn bộ animation, số hiện giá trị cuối, thẻ không tự xoay.

**Files (dự kiến):** Modify `public/assets/app.css` (hoặc file CSS hiện hành của design system), Create `public/assets/home.js`, `src/views/home/Chart.tsx`; Test `test/home/motion.test.ts` (CSS có `prefers-reduced-motion`; không `autoplay` khi reduced; chart có `<details>` bảng; mọi chart có legend khi 2 chuỗi), `test/design/assets.test.ts` (giữ xanh).

**Acceptance:** spec §9 "Homepage với `prefers-reduced-motion` không có animation" kiểm bằng test CSS; `grep -rn "<script" apps/web/src/views/home` chỉ trỏ một file asset cùng gốc; kích thước JS ≤ ngân sách của `test/design/assets.test.ts`; không thêm dependency (`git diff package.json` rỗng). Diff ~450 dòng.

---

### Task 9: VNX-0705b — `/for-builders`

**Scope:** (chặn bởi (d).) Trang `/for-builders` (4 locale) với nút "Become a builder" → `/login` (cùng luồng 0708, không đổi auth), nội dung theo lựa chọn D1/D2. Mọi khối chữ tái dùng chữ landing đã duyệt hoặc chữ Owner duyệt; không tuyên bố, số liệu, testimonial, logo tự nghĩ. Thêm `/for-builders` vào sitemap (`routes/seo.ts` danh sách `entries`, `localized: true`), link vào nav/footer (`Layout.tsx`, theo CURRENT-STATUS "link header vào `<nav>`"), `domain/builder-input.ts` giữ handle dành riêng. Có JSON-LD không cần.

**Files:** Create `src/routes/for-builders.tsx`, `src/views/ForBuildersPage.tsx`; Modify `src/app.ts`, `src/routes/seo.ts`, `src/views/Layout.tsx`, 4 file i18n; Test `test/public/for-builders.test.tsx` (200 ở 4 locale, hreflang, CTA tới `/login`, có trong sitemap với alternate, không có chữ số tự nghĩ: test chặn `\d` trong view trừ định dạng, i18n đủ key).

**Acceptance:** `GET /for-builders` và `/vi/for-builders`… 200; sitemap có `/for-builders` + 3 alternate; `GET /sitemap.xml` test hiện có xanh. Diff ~260 dòng (không tính copy).

---

### Task 10: VNX-0706 — Cutover và vá a11y

**Scope:** (A2: KHÔNG có cutover; chỉ ghi nhận trong CURRENT-STATUS, cộng phần a11y; đoạn sau áp dụng khi Owner sau này chọn A1.) Theo A1: đổi `/` sang homepage dữ liệu, dời landing 0708 (gợi ý: `/about` hoặc bỏ) kèm 301 và cập nhật sitemap, hreflang, test `test/landing`; theo A2: không có cutover, ghi nhận trong CURRENT-STATUS; theo A3/A4: chỉ ghi nhận. Giữ bảng `waitlist` (không xóa). Phần a11y đi kèm milestone (CURRENT-STATUS "M7: độ tương phản `.error-msg` ở dark mode, vùng chạm 44 px, skip link"): `.error-msg` đạt AA ở dark mode (kiểm bằng hàm tính tương phản trong test), brand và nút sign-in ≥ 44 × 44 px, skip link "Skip to content" là phần tử đầu của `<body>` trong `Layout.tsx` (chuỗi `t()` 4 locale; `id="main"` ở vùng nội dung), và cập nhật `CURRENT-STATUS.md` (Reviewer, không phải Implementer).

**Files (dự kiến):** Modify `src/views/Layout.tsx`, `public/assets/app.css`, `src/routes/landing.tsx` / `src/app.ts` (tùy (a)), 4 file i18n; Test `test/design/a11y.test.tsx` (skip link đầu tiên và trỏ đúng `#main`; tương phản `.error-msg` ≥ 4.5:1 sáng/tối; kích thước 44 px trong CSS), `test/landing/*` (theo (a)).

**Acceptance:** cổng ra M7: (1) mọi khối homepage ẩn đúng khi dưới ngưỡng (Task 7); (2) không số liệu nào không truy được (Task 5, 7); `grep -rn "api/waitlist" apps/web/src` rỗng; `npm test` và `npm run typecheck -w apps/web` xanh; `/robots.txt` còn `Disallow: /go/`. Diff ~250 dòng.

---

## Sau M7 (không thuộc plan này)

- Ops O2 đọc `public_stats`, `product_daily_stats` cho Overview; M7 không dựng màn nào trùng với O2.
- **`ANALYTICS_SALT` là công tắc bật đếm trên production: Owner KHÔNG đặt nó cho tới ngày Task 3 + Privacy cùng lên** (Task 4 được deploy trước; trong khoảng đó mỗi isolate log `visitor.no_salt`, bình thường).
- Sau khi merge (và, riêng `wrangler secret put ANALYTICS_SALT`, chỉ vào ngày go-live nói trên): Owner chạy `npx wrangler secret put ANALYTICS_SALT` (trong `apps/web`), `npm run db:migrate:remote -w apps/web` (áp `0014`–`0016`; `0014` phải áp TRƯỚC khi deploy code M7; sau `0013` của Ops nếu nó đã lên), rồi `npm run deploy` (đăng ký cron `5 * * * *` nếu (c) = C1).
