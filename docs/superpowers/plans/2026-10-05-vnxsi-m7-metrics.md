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
4. **`hasGpc` nhận `headers` (có `get`)** để tránh caller phải tự đọc tên header; `Headers.get` không phân biệt hoa thường. Chỉ đúng `1` (sau `trim`) mới là GPC (spec GPC: giá trị `1`); `0`, `true`, rỗng, thiếu → false.
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
  });
  it.each([["0"], ["true"], ["yes"], ["11"], ["1, 1"], ["on"], [""]])("is false for %j", (value) => {
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

/** True for `Sec-GPC: 1` only (Global Privacy Control). */
export function hasGpc(headers: { get(name: string): string | null }): boolean {
  return headers.get("Sec-GPC")?.trim() === "1";
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

**Files:** Create `migrations/0015_view_dedupe.sql`, `src/http/visitor.ts`; Modify `src/db/stats.ts`, `src/jobs/daily.ts`, `src/routes/product-page.tsx`, `src/legal/content.ts`, `docs/legal/privacy.md`, 4 file i18n nếu cần (cookie mục Privacy là văn bản `legal/`, không `t()`), `test/architecture.test.ts` (`WRITERS.product_view_dedupe`), `wrangler.jsonc` (ghi chú); Test `test/db/view-dedupe.test.ts`, `test/jobs/daily.test.ts` (bước `view_dedupe`), `test/product-page-views.test.ts`, `test/legal/content.test.ts`.

**Acceptance:** lượt xem đầu → `views = 1` và `Set-Cookie` đủ thuộc tính (`__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Max-Age` = giây tới 00:00 UTC kế tiếp, `Cache-Control: private`); lượt hai cùng cookie cùng ngày → vẫn 1; qua 00:00 UTC → 2; hai product khác nhau cùng cookie → mỗi cái 1; bot (UA `curl`, `Googlebot`, UA rỗng), builder chủ product, đội nội bộ, request `Sec-GPC: 1` → 0, không `Set-Cookie`, không dòng dedupe; `Set-Cookie` chỉ có trên `GET /p/:slug` 200 (không trên 404, không trên `/go/p/`); thiếu `ANALYTICS_SALT` → 0 views, không cookie, trang 200, `console.warn` một lần; product `draft`, builder bị khóa → 404, không đếm; `HEAD` không đếm; không có `Set-Cookie` trên `/admin`, `/hub`, `/me`; test `legal/content` so từng dòng xanh và câu cũ biến mất (`grep -n "for now we do not link" apps/web/src/legal/content.ts` rỗng); `product_view_dedupe` không có IP/email/user id; `purgeViewDedupe` xóa đúng dòng cũ hơn 2 ngày và chạy lại không đổi gì. Diff ~420 dòng (không tính văn bản pháp lý).

---

### Task 4: VNX-0707b — `/go/p/:slug/{demo,site}`

**Scope:** (HIGH-RISK, như EPIC 21 Task 4: open redirect.) Domain thuần `domain/outbound.ts` thêm `PRODUCT_LINKS = { demo: "demo_url", site: "website_url" }`, `appendUtm(url)` (đã có từ EPIC 21: dùng lại, không viết lại), `resolveProductRedirect(product, builder, kind): { kind: "redirect"; url } | { kind: "not_found"; reason }` (thuần, nhận `demoUrl`/`websiteUrl`, `status`, `builderStatus`). `db/products.ts` (hoặc `db/catalog.ts` nếu module đọc product công khai nằm ở đó) thêm đọc `findProductLinkBySlug(db, slug)` trả `{ id, builderUserId, demoUrl, websiteUrl }` chỉ cho product `published` của builder `approved`. `routes/go.ts` thêm hai route `app.get("/go/p/:slug/demo")` và `.../site` **trước** `app.get("/go/*")`; ghi `outbound_clicks` (`linkKind: "demo" | "site"`, `productId`, `offerId: null`) bằng `defer`/`saveClick` hiện có, kèm `visitorHash` (từ cookie của Task 3 nếu có, null nếu chưa); cộng `bumpProductStatStatement` `demo_clicks`+`outbound_clicks` (demo) hoặc `outbound_clicks` (site) khi `shouldCount` (kể cả `Sec-GPC: 1` thì không cộng và `visitor_hash` null) và là lượt đầu của (`visitor_hash`, product, `link_kind`) trong ngày UTC (kiểm bằng truy vấn trên `idx_clicks_visitor` TRƯỚC khi ghi click mới). Luật thiếu salt (Global Constraints): thiếu `ANALYTICS_SALT` → không cộng gì, vẫn ghi dòng; có salt nhưng không có cookie → `visitor_hash` null, không dedupe, cộng mọi lần không-bot (cùng quyết định 4, câu hỏi (f)). URL đích: chuẩn hóa `new URL(raw).href` rồi `validatePublicUrl` (thuần, ở `domain/offer-url.ts` hoặc `domain/product-url.ts`: `https:`, không userinfo, `isPublicHostname`, port rỗng); CÙNG hàm được gọi ở editor product khi lưu `demo_url`/`website_url` (`domain/product-input.ts`), và lúc redirect. Báo cáo ghi một truy vấn SQL kiểm toàn bộ `demo_url`/`website_url` hiện có để Owner chạy trước khi deploy. Dùng `isBotRequest` của Task 2. `views/ProductPage.tsx` đổi `href` của nút Demo và link Website sang `/go/p/:slug/demo?src=product_page` và `/go/p/:slug/site?src=product_page`, giữ `rel="nofollow ugc noopener"`, `target="_blank"`. Cập nhật `test/monetization/go.test.ts` (dòng ~326 bỏ `/go/p/some-product/{demo,site}` khỏi danh sách 404-trước-khi-đọc-D1; dòng ~338 đổi `/go/p/x/demo` sang `/go/p/does-not-exist/demo`) và `robots.txt` giữ `Disallow: /go/`. Cho bước nối `visitor_hash`: nếu Task 3 chưa xong, đọc cookie bằng helper của Task 2 (không đặt cookie ở route `/go/`).

**Files:** Modify `src/domain/outbound.ts`, `src/domain/product-input.ts` (gọi `validatePublicUrl` khi lưu), `src/db/products.ts` (hoặc nơi đọc product công khai), `src/db/clicks.ts` (thêm `hasClickToday(db, { visitorHash, productId, linkKind, day }): Promise<boolean>`), `src/routes/go.ts`, `src/views/ProductPage.tsx`, `test/monetization/go.test.ts`, `test/architecture.test.ts` (`MONEY_ALLOWED` giữ nguyên: `routes/go.ts` đã có; `db/stats.ts` KHÔNG import `db/clicks.ts`, `go.ts` ghép hai module); Test `test/monetization/go-product.test.ts`, `test/domain/outbound.test.ts`, `test/domain/product-input.test.ts` (editor từ chối cùng các URL hỏng), `test/views/product-page.test.tsx` (link mới).

**Acceptance:** thêm: click offer (`/go/o/`, `/go/:merchant`) không đổi `product_daily_stats`; editor và redirect từ chối cùng tập URL (`http:`, `//evil.com`, IP, userinfo, cổng 8443, ``). `/go/p/<slug>/demo` và `/site` → `302` với `Location` = URL đã chuẩn hóa + `utm_source=vnx.si&utm_medium=referral` (không thêm khi đã có `utm_*`), đủ 4 header (`Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin`, `Location`); product `draft`/`pending`/builder không `approved`/thiếu URL/slug lạ/slug hoa → 404 và không ghi click; `src` lạ → `unknown`; `HEAD` redirect không ghi; `POST` → 405 `Allow: GET, HEAD`; `/go/p/…` hợp lệ KHÔNG rơi vào catch-all (test thứ tự); dữ liệu hỏng (`demo_url` = `http://…`, `//evil.com`, `https://127.0.0.1`, `https://u@evil.com`, có `\`/CR/LF) → 404 + `console.error`; `Location` không bao giờ lấy từ query (`?url=`, `?src=https://evil.com` bị bỏ qua); mỗi GET ghi đúng một dòng `outbound_clicks` kể cả khi không cộng; `demo_clicks`/`outbound_clicks` cộng đúng một lần mỗi (visitor, product, loại, ngày UTC), `site` chỉ tăng `outbound_clicks`, bot/chủ product/admin không cộng nhưng vẫn ghi dòng; `/p/:slug` render link `/go/p/…`. Kiểm: `npm test -w apps/web -- test/monetization test/domain/outbound.test.ts test/views`. Diff ~500 dòng; nếu vượt, tách 4a (route + ghi click) / 4b (cộng thống kê + dedupe + ProductPage).

---

### Task 5: VNX-0702a — Công thức `public_stats`

**Scope (E2, Controller): `inquiries_7d` của Trending tính từ bảng `inquiries` bỏ `removed`, không từ cột đếm.** `0016_public_stats.sql` (`public_stats (key TEXT PRIMARY KEY, value TEXT NOT NULL, computed_at TEXT NOT NULL)`). `domain/public-stats.ts` thuần: hằng ngưỡng (đúng bảng ở Global Constraints), kiểu `PublicStatKey`, và hàm cho từng số liệu nhận số liệu thô, trả giá trị hoặc `null` dưới ngưỡng: `countStat`, `trendingScore(7d)`, `trendingChange(prev7, cur7)` (làm tròn xuống, không chia 0), `sparkline14`, `bucketCategories` (gộp category < 3 vào "Other", tổng ≥ 10), `scarcestCategory` (cần ≥ 3 request), `weeklyGrowth` (tuần ISO, ≥ 4 tuần), `topBuilders` (ba tab với ngưỡng 2/5/1, tab < 3 builder bị ẩn), `topProductsByCategory`, `liveEvents` (tối đa 20; < 5 trong 7 ngày → rỗng). `db/public-stats.ts`: các truy vấn đọc (product published của builder approved, builder approved, request theo `submitted_at`, quốc gia, `product_daily_stats` 14 ngày, audit `product.publish`, `badge.grant`, `builder.approve`, `request.submit`, `request.verify` chỉ lấy `category` và `languages`), `writePublicStat(db, key, value, now)`, `readPublicStats(db, now)` (kiểm `computed_at` ≤ 3 giờ, quá hạn → khóa bị bỏ). Test kiến trúc: thêm `public_stats` vào `WRITERS`; làm review F6 (đối chứng dương: tạo chuỗi giả lập `import … /db/offers.ts` và khẳng định bộ kiểm bắt được; regex SQL `/i`); thêm file Trending/Top (`domain/public-stats.ts`, `db/public-stats.ts`) vào `RANKING_FILES`.

**Files:** Create `migrations/0016_public_stats.sql`, `src/domain/public-stats.ts`, `src/db/public-stats.ts`; Modify `test/architecture.test.ts`; Test `test/domain/public-stats.test.ts` (mỗi ngưỡng n−1 / n, "Other", công thức trending với ví dụ tính tay, tuần ISO qua ranh giới năm), `test/db/public-stats.test.ts` (truy vấn trên dữ liệu thật dựng bằng fixture; builder bị khóa và product không published không được đếm; lượt xem của chính builder và của bot không có trong `views` vì Task 3/4 đã lọc).

**Acceptance:** mỗi số liệu ở spec 8.11 có test cạnh ngưỡng; `request_by_category` không bao giờ lộ category < 3 (kể cả "Other" khi tổng ≥ 10 nhưng Other < 3 thì Other vẫn gộp, không tên); trending công thức đúng trên ví dụ `inquiries=2, demo=3, views=4 → 20`; `public_stats` không có số hard-code; test kiến trúc đỏ khi một file ranking import `db/offers.ts` (đối chứng dương) và xanh trên repo. Kiểm: `npm test -w apps/web -- test/domain/public-stats.test.ts test/db/public-stats.test.ts test/architecture.test.ts`. Diff ~560 dòng; nếu vượt, tách 5a (domain thuần + test) / 5b (db + migration + kiến trúc).

---

### Task 6: VNX-0702b — Cron hằng giờ

**Scope:** `jobs/hourly.ts` (`runHourly(env, now): Promise<HourlyResult[]>`: một bước cho mỗi key của Task 5, mỗi bước bọc try/catch như `runDaily`, ghi log JSON `{ job: "hourly", step, ... }`), `index.ts#scheduled` rẽ theo `controller.cron`: `"0 1 * * *"` → `runDaily`, `"5 * * * *"` → `runHourly`, giá trị khác → `console.warn` và bỏ qua; `wrangler.jsonc` `triggers.crons = ["0 1 * * *", "5 * * * *"]` và cập nhật ghi chú deploy; `README`/runbook ghi hai cron. Không đổi hành vi các bước cũ của job ngày.

**Files:** Create `src/jobs/hourly.ts`; Modify `src/index.ts`, `wrangler.jsonc`, `test/architecture.test.ts` (thêm `jobs/hourly.ts` vào `RANKING_FILES`; `MONEY_ALLOWED` KHÔNG thêm `jobs/hourly.ts` vì job giờ không đọc bảng tiền; nếu đọc `outbound_clicks` thì chỉ qua `db/stats.ts`); Test `test/jobs/hourly.test.ts`, `test/jobs/scheduled.test.ts`, `test/jobs/daily.test.ts` chỉ chạy lại.

**Acceptance:** `scheduled` gọi đúng job cho từng cron (spy) và bỏ qua cron lạ; `runHourly` ghi mọi key, chạy hai lần liên tiếp cho cùng `public_stats.value` (idempotent) và `computed_at` cập nhật; một bước ném lỗi không dừng các bước sau; dưới ngưỡng ghi `null`, không xóa dòng cũ khi truy vấn lỗi; `grep -n '"crons"' apps/web/wrangler.jsonc` = hai trigger đúng; `runDaily` không đổi (bước dọn dedupe thuộc Task 3); không còn bước/sự kiện Live nào ở Task này (Live do Task 5 tính, Task 7 hiện). Kiểm: `npm test -w apps/web -- test/jobs`. Triển khai thật chờ Owner (c). Diff ~300 dòng.

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
- Sau khi merge: Owner chạy `npx wrangler secret put ANALYTICS_SALT` (trong `apps/web`), `npm run db:migrate:remote -w apps/web` (áp `0014`–`0016`; `0014` phải áp TRƯỚC khi deploy code M7; sau `0013` của Ops nếu nó đã lên), rồi `npm run deploy` (đăng ký cron `5 * * * *` nếu (c) = C1).
