# VNX-2705b — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-12
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (header, Changelog delta, "Trạng thái đối chiếu", Quyết định thiết kế, Global Constraints, Review Focus 1/2/6/7, mục Task VNX-2705b, VNX-2709, VNX-2708, "Cần Owner/Reviewer lưu ý"); `.ai/context/CURRENT-STATUS.md` (nghĩa vụ VNX-2705b từ review 2705a); `.ai/reviews/VNX-2705a-review.md` (cả re-review); phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §4.1, §7.3, §8, §10, Q13, Q14; code SEO có sẵn (`views/Layout.tsx` canonical/hreflang/noindex, `routes/seo.ts`, `views/CatalogPage.tsx` / `DirectoryPage.tsx` (`noindex={filtered}`), test `test/public/products-page.test.ts` "canonicalises page 2 to itself", `test/architecture.test.ts` `RANKING_FILES` / `MONEY_ALLOWED` / "views/ never import db"); `db/request-board.ts` (`openWhere`, `countOpenPublications*`, `listSitemapRequests`), migration `0018` (CHECK `published` ⇒ `public_title`/`public_description` khác null); `scripts/smoke-checks.mjs` (`SITEMAP_PRIVATE`); `apps/web/vitest.config.ts` và `@cloudflare/vitest-pool-workers` 0.22.0 (`CloudflarePoolWorker.start` tạo `new Miniflare` cho mỗi pool worker); báo cáo `.ai/tasks/VNX-2705b-report.md`; toàn bộ diff `5cc29b0..3d46ee3` (19 file, +408/−17; code `ffd00f4`, báo cáo `3d46ee3`). Theo quy ước EPIC 27, mục task của plan là handoff.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `3d46ee3`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/seo test/public/for-builders.test.ts test/legal/footer.test.ts test/public/request-board-list.test.ts test/public/request-board-detail.test.ts test/views/request-board-copy.test.tsx test/architecture.test.ts test/i18n/parity.test.ts test/domain/request-board.test.ts`: **13 file, 165 test xanh**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **203 file, 2578 passed + 2 skipped** (325 s), exit 0. Khớp báo cáo.
  - `npm run e2e` (một lần, `workers: 1`): **80 passed, 1.4 phút**, exit 0. Sau khi chạy không còn tiến trình `wrangler`/`workerd` nào; cây làm việc sạch.

## Verdict

**APPROVE.**

Task làm đúng phụ lục §8, Q13 và mục VNX-2705b của plan, đủ mọi nghĩa vụ 2705b mà review 2705a để lại:

- **`/requests`.** Trang được index khi và chỉ khi `isBoardIndexable(total)` (≥ 5) **và** không có bộ lọc nào. Khi không lọc, `total` chính là `countOpenPublications(db, {})` = `countOpenPublicationsAll` (cùng hàm, cùng `openWhere`), nên quyết định index không tốn thêm truy vấn D1. Route không có nhánh nào thêm truy vấn theo ngưỡng; test ≤ 8 truy vấn chạy cả không lọc, có lọc và `?page=1`. Khi không đủ điều kiện: `noindex`, không canonical, không hreflang, vẫn trả 200. Quyết định đặt ở route, view chỉ nhận prop `indexable`. Tham số lạ hay giá trị lọc sai bị `parseBoardQuery` bỏ, nên canonical luôn là URL sạch (`boardParams`).
- **Chi tiết `open`.** `publicMetaDescription` chỉ đọc `item.publicDescription` (bản công khai từ `findPublicListing`, không bao giờ bản gốc). Hàm gộp khoảng trắng thành một dòng, cắt ở ranh giới grapheme, tổng ≤ 160 code point **kể cả** dấu "…". `publicExcerpt` (200) chuyển sang dùng `cutOneLine` nhưng hành vi giữ nguyên. hono/jsx escape thuộc tính. Canonical, 4 hreflang + `x-default` và `og:type=website` đến từ `Layout`. Không JSON-LD, không `JobPosting` (test HTTP và e2e đều kiểm).
- **Chi tiết `closed`.** Trả 200, có `noindex`, không canonical, không hreflang, không JSON-LD, đủ 4 locale.
- **Sitemap.** Dùng cổng đầy đủ `c.get("requestBoard")` (cờ **và** ngày, L7); cổng tắt thì không chạy truy vấn nào và không có mục nào. Chỉ liệt kê listing `open` (`p.status='published' AND r.status IN ('submitted','matching')`, khớp nhánh `open` của `requestVisibility`; CHECK của `0018` bảo đảm listing `published` luôn có câu chữ công khai, nên không có URL nào dẫn tới 404). Mỗi listing có 4 locale + hreflang, `lastmod = updated_at`. `/requests` chỉ có trong sitemap khi đủ ngưỡng. Test chặn rò rỉ cho closed, `pending_review`, `rejected`, `withdrawn`, `unpublished`, `removed` và quá 30 ngày; sitemap không chứa `request_id`, id client, email, tiêu đề, bản gốc hay ghi chú. Truy vấn nằm trong `db/request-board.ts` (file xếp hạng). `seo.ts` (thuộc `MONEY_ALLOWED`) import file đó là đúng chiều; test kiến trúc xanh.
- **`robots.txt`** không đổi; có test mới khẳng định không có dòng nào chứa `requests`.
- **Link lối vào.** Footer (nhóm Marketplace) và `<main>` của `/for-builders` có link `/requests` **chỉ khi** cổng bật; header không có. Test đủ 4 locale, cả ca cờ tắt, ngày rỗng và ngày tương lai. Giá trị cổng đi qua ngữ cảnh hono/jsx do `page()` đặt (`views/request-board-nav.tsx`, mặc định `false`). Views không import `db/` hay `http/`; test kiến trúc "views/ never import db" xanh.
- **CSS:** chỉ thêm hai rule ở `app.css`, không `style=`/`<script>` inline. `#9db7ff` trên nền `#0d1526` có tương phản cao, lượt axe e2e cho `/for-builders` xanh.
- **E2E:** thêm 4 test, đều chỉ GET nên không tốn ngân sách POST. Các test không giả định gì về `Q2008–Q2010` (do `request-board-forms.spec.ts` chạy trước thay đổi) và không giả định thẻ đầu tiên. `request-board-forms.spec.ts` không gỡ hay đóng `Q1–Q8`, nên ngưỡng ≥ 5 open (seed 8) đúng bất kể thứ tự chạy.

## Phát hiện

Không có BLOCKER, HIGH hay MEDIUM. Ba SUGGESTION dưới đây không chặn merge. Không cần vòng sửa: ghi vào "Ghi nhận", và 2709 (rà soát cuối) có thể gộp nếu muốn.

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| S-1 | SUGGESTION | `apps/web/src/routes/seo.ts:23` | Sitemap gọi thêm `countOpenPublicationsAll` trong khi `listSitemapRequests` có cùng điều kiện `open` và `LIMIT 2000` (≥ 5), nên `listings.length >= MIN_OPEN_FOR_INDEX` cho cùng kết quả. Mỗi lần tải sitemap khi cổng bật tốn thêm một truy vấn. Sitemap không có NFR số truy vấn và được cache 1 giờ. | Dùng `isBoardIndexable(listings.length)` rồi bỏ import `countOpenPublicationsAll` khỏi `seo.ts`. Không bắt buộc. | Implementer (tùy chọn, 2709) |
| S-2 | SUGGESTION | `apps/web/test/seo/robots.test.ts:24`, `apps/web/test/seo/request-board.test.ts:511` | Tên test nói nhiều hơn những gì test kiểm. Test robots "with the board on or off" không bật cờ `request_board`, nên cả hai lượt chạy đều ở cổng tắt. Test "within 8 D1 queries over and under the threshold" chỉ đo khi đã vượt ngưỡng. Hành vi đúng: robots không đọc cổng, và route không có truy vấn nào phụ thuộc ngưỡng. Thiếu sót chỉ nằm ở tên test và độ phủ. | Thêm `boardFlag(true)` cho ca "on" và một lượt đếm truy vấn trước `openUpTo`, hoặc sửa tên test cho khớp. | Implementer (tùy chọn, 2709) |
| S-3 | SUGGESTION | `apps/web/test/seo/request-board.test.ts:477-480` | Ca "fewer than 5 open" giả định file bắt đầu với D1 trống (`expect(count).toBeLessThan(5)` ở đầu file). Điều này lệch với Global Constraint của plan ("không giả định 0"). Reviewer đã kiểm: `vitest-pool-workers` 0.22 tạo `new Miniflare` cho mỗi pool worker, Vitest 4 mặc định `isolate: true` (một worker cho mỗi file), và `test/ops/overview.test.ts` đã dựa vào cùng tiền đề "test storage is per file". Khẳng định của báo cáo ("each test file gets its own database") vì vậy **đúng**, và nếu tiền đề hỏng thì test đỏ ngay chứ không xanh giả. | Chấp nhận. Ghi vào "Ghi nhận": nếu cấu hình pool đổi (`isolate: false`, worker dùng chung) thì test này và `overview.test.ts` cần chuyển sang kiểm bằng độ lệch. | — |

## Phán quyết các sai khác

| # | Sai khác | Phán quyết |
|---|---|---|
| D1 | Không thêm khóa i18n mới (`board.nav.footer`, `board.nav.forBuilders` trong plan). Cả hai link dùng `board.title` ("Public request board" / "Bảng nhu cầu công khai" / zh). | **Chấp nhận.** Đây là câu chữ Owner đã duyệt nguyên văn 2026-10-12, đã ghim ở `request-board-copy.test.tsx`. Tên khóa trong plan chỉ là chỗ giữ, không phải câu chữ đã duyệt. Dùng lại khóa tránh phải xin Owner duyệt câu chữ mới; parity không đổi. Không có câu chữ mới nào cần Owner duyệt. |
| D2 | `/requests` có bộ lọc luôn `noindex`, kể cả khi ≥ 5 open (plan không nói). | **Chấp nhận, nhất quán với catalogue.** `CatalogPage` và `DirectoryPage` đều `noindex={filtered}` (spec §8.8 "indexable only without search or filters"). Trang lọc là bản trùng mỏng của danh sách. Q13 ("từ 5 index bình thường") vẫn đúng cho danh sách không lọc. |
| D3 | Trang 2 trở đi (không lọc) vẫn index được, canonical trỏ về chính nó (`/requests?page=2`), hreflang theo cùng `rest`. | **Chấp nhận, nhất quán với catalogue.** `/products?page=2` có canonical trỏ về chính nó (`test/public/products-page.test.ts` "canonicalises page 2 to itself"); `Layout` dựng canonical/hreflang từ `rest` có `?page=`. Trang > 1 chỉ tồn tại khi total > 24, tức luôn trên ngưỡng; trang quá cuối trả 404. |
| D4 (báo cáo #3) | `publicMetaDescription` tính dấu "…" vào trong 160. | **Chấp nhận.** Plan nói "160 ký tự đầu"; giữ tổng ≤ 160 chặt hơn và an toàn hơn cho đoạn trích của máy tìm kiếm. |
| D5 (báo cáo #4) | Cổng đọc qua ngữ cảnh hono/jsx (`boardOpen()`), không truyền prop qua `Layout`; `routes/for-builders.tsx` không phải sửa. | **Chấp nhận.** Đây đúng là cách plan chỉ định ("ngữ cảnh `hono/jsx` cùng ngữ cảnh thông báo"). `page()` là điểm render duy nhất (grep: không có `c.html(` nào khác, `errorResponse` cũng đi qua `page()`). Mặc định `false` là fail closed. Hai provider lồng nhau cùng cơ chế với thông báo Privacy M7 đã chạy thật. Việc `Layout` đọc cổng từ ngữ cảnh chấp nhận được: `Layout` không biết `db/`, chỉ biết một boolean. |
| D6 (báo cáo #5) | Link ở `/for-builders` đặt trong `<main>`, sau CTA apply. | **Chấp nhận.** Q13 chỉ nói "link từ `/for-builders`". Test "chỉ câu chữ đã duyệt trong `<main>`" vẫn đúng khi cổng tắt; khi cổng bật, test mới khẳng định chính xác hai link (apply + board). |
| Cache sitemap | Sitemap giữ `Cache-Control: public, max-age=3600`, trong khi gỡ (withdraw) phải có hiệu lực ngay. | **Chấp nhận.** Phụ lục §8 và mục Architecture của plan đã chấp nhận rõ ("request vừa đóng còn trong sitemap tối đa 1 giờ"). Sitemap chỉ là gợi ý cho crawler: trang `/requests/:publicId` không có `Cache-Control: public` (đã kiểm ở 2705a), nên sau khi gỡ, đóng hay tắt cờ khẩn cấp, URL trả 404 hoặc `noindex` ngay; crawler đọc sitemap cũ chỉ gặp 404. Sitemap không chứa dữ liệu riêng (chỉ `public_id` và ngày), nên một bản cũ không làm lộ thêm gì. Reviewer ghi chú điều này vào runbook (công tắc khẩn cấp) khi cập nhật ở 2709/2708. |

## Đối chiếu tiêu chí chấp nhận

| AC (plan VNX-2705b) | Đạt? | Bằng chứng |
|---|---|---|
| Sitemap: listing `open` có `<loc>` × 4 locale kèm hreflang, theo `publicId` của test | ✓ | `request-board-sitemap.test.ts` ca 1 (so nguyên khối `<url>` gồm `lastmod` và 5 alternates) |
| Không có closed, `pending_review`, `withdrawn`, `removed`, hết hạn 30 ngày (thêm `rejected`, `unpublished`) | ✓ | ca 2 |
| `/requests` có trong sitemap khi `isBoardIndexable`, kiểm theo độ lệch | ✓ | ca 3 (khẳng định theo quy tắc, không theo con số) |
| Cổng đầy đủ (L7): cờ tắt, ngày rỗng, ngày tương lai → không mục `/requests*` | ✓ | ca 4; `seo.ts` không truy vấn khi cổng tắt |
| `lastmod = updated_at`; không `request_id`, tiêu đề, email | ✓ | ca 1, e2e sitemap |
| `robots.txt` không đổi, không `Disallow: /requests` | ✓ | `robots.test.ts` (test cũ + mới), e2e |
| Trang `open`: canonical, 4 hreflang + `x-default`, `og:type`, description ≤ 160 từ bản công khai, không `ld+json` | ✓ | `request-board.test.ts` "open detail page" (4 locale, chuỗi nhận diện), e2e Q1 |
| Trang `closed`: `noindex`, không canonical, không hreflang, 200 | ✓ | "closed detail page" (4 locale), e2e Q2001 |
| `/requests` ≥ 5 → index + canonical + hreflang; dưới ngưỡng → `noindex`, không canonical | ✓ | 2 ca HTTP + `isBoardIndexable` ở 2702b; e2e (seed 8 open) |
| ≤ 8 truy vấn D1 | ✓ | ca đếm (không lọc, có lọc, `?page=1`); 2705a "at most 8" cho người đã và chưa đăng nhập; không có truy vấn mới trong route (xem S-2) |
| Footer và `/for-builders` có link khi bật, không khi tắt; header không; 4 locale | ✓ | `footer.test.ts`, `for-builders.test.ts`, e2e |
| Không chuỗi nhận diện trong HTML | ✓ | test chi tiết, test sitemap, e2e |
| E2E theo plan (`/requests` index, link footer/`/for-builders`, không header, Q1/Q2001, sitemap, robots) | ✓ | 4 test mới, 80/80 xanh |
| Kiến trúc: views không import db; truy vấn sitemap ở `db/request-board.ts`; `RANKING_FILES` | ✓ | `architecture.test.ts` xanh. `views/request-board-nav.tsx` chỉ chứa một boolean ngữ cảnh, không xếp hạng hay truy vấn gì, nên không cần vào `RANKING_FILES` |
| CSP: không inline | ✓ | diff `app.css`; e2e `watchCsp` xanh |

## Nghĩa vụ để lại cho task sau

- **VNX-2706a:** form interest trên `/requests/:publicId` không được làm hỏng SEO của trang: trang re-render 4xx giữ cùng `Layout` (canonical/hreflang khi `open`), và tổng truy vấn vẫn ≤ 8 (chỉ `findViewerRelation`). Không thêm `JobPosting` hay JSON-LD. Link "Interests" trong Hub (nếu có) đi qua `localizedPath`.
- **VNX-2707a (L8):** khi tổng quát hóa ngữ cảnh thông báo trong `views/render.ts`/`Layout.tsx`, giữ nguyên `withBoardOpen(c.get("requestBoard") === true, …)` bọc ngoài và giữ test `footer.test.ts`/`for-builders.test.ts` xanh.
- **VNX-2709:** (a) kịch bản vòng đời kiểm thêm ở bước 5 và 6: listing rời sitemap khi đóng, gỡ, hoặc tắt cờ; `/requests` rời sitemap và chuyển `noindex` khi tụt dưới 5 (kiểm theo độ lệch); (b) smoke chế độ mặc định kiểm `/` không có `href="/requests"`: đó chính là link footer của task này, nên kiểm theo đúng chuỗi `href="/requests"` (và `href="/vi/requests"` nếu kiểm `/vi/`); (c) `--board`: sitemap không có `<loc>` mang id request; (d) có thể gộp S-1, S-2.
- **Reviewer (tài liệu, 2709/2708):** runbook `docs/runbooks/deploy.md` mục 9 (công tắc khẩn cấp): sitemap có thể còn liệt kê URL bảng tối đa 1 giờ sau khi tắt cờ (cache `max-age=3600`), trong khi trang trả 404 ngay. Không cần hành động gì.
