# EPIC 21, lát mỏng partner (VNX-2101 … VNX-2104b): review toàn nhánh

- **Reviewer:** Claude (Opus, độc lập), review cuối toàn nhánh. Mỗi task đã qua review riêng của nó (Opus), xem `.superpowers/sdd/2026-10-05-vnxsi-epic21-partner-slice/`.
- **Ngày:** 2026-10-05
- **Phạm vi:** nhánh `feat/epic21-partner-slice`, dải `origin/main...HEAD` (merge-base `b60d8ed`, HEAD `e77c769`): VNX-2101, 2102a-1…4, 2102b-1/2, 2103-1/2, 2104a/b, và merge `origin/main` (PR #6 bật R2, PR #7 tài liệu deploy). Commit `703f5b3` (ADR-010 và spec Ops console, chỉ có tài liệu, từ phiên khác) nằm ngoài phạm vi; Owner đã chọn giữ commit này.
- **Đã đọc:** `CLAUDE.md`; header plan `docs/superpowers/plans/2026-10-05-vnxsi-epic21-partner-slice.md` (dòng 1–205: quyết định Owner, quyết định Reviewer 1–20, khối câu chữ A/B/C, Global Constraints, Review Focus 1–7, bảng task); phụ lục `docs/superpowers/specs/2026-10-04-vnxsi-monetization-addendum.md` §1–3, §8, §9 và các sửa đổi ngày 2026-10-05; ADR-007 (cả phần "Được bảo đảm bởi"), ADR-004, ADR-008; `final-review-inputs.md` (ruling và minor để lại); toàn bộ diff code `final-code.diff` (migration, src, wrangler, legal); diff test (đọc kỹ `test/monetization/go.test.ts`, `tools.test.ts`, `disclosure-page.test.ts`, `test/architecture.test.ts`, `test/db/{clicks,flags,partners-migration}.test.ts`, `test/legal/content.test.ts`, `test/seo/sitemap.test.ts`, `test/admin/{flags,merchants,merchant-offers}.test.ts`, `test/domain/{offer-url,outbound}.test.ts`). Đọc thêm `src/app.ts`, `http/origin.ts`, `http/no-store.ts`, `views/Layout.tsx` (noindex/canonical) để kiểm các lớp dùng chung.
- **Lệnh đã chạy lại (HEAD `e77c769`, máy đang tải nặng vì phiên khác cũng chạy test):**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test` → 123 file, **1190/1194 xanh, 4 đỏ**. Cả 4 đều là `Test timed out in 5000ms` ở file có sẵn từ trước, không thuộc EPIC 21: `test/admin/feedback.test.ts` ("pages 50 rows at a time"), `test/hub/invitations.test.ts` (2 test), `test/public/request-form.test.ts` ("limits a network to 10…").
  - Chạy riêng ba file đó: `npm test -w apps/web -- test/admin/feedback.test.ts test/hub/invitations.test.ts test/public/request-form.test.ts` → 3 file, **35/35 xanh**. Lỗi không lặp lại, nên đây là lỗi do tải máy, không phải hồi quy.
  - Chạy riêng các file rủi ro cao của EPIC 21 (`test/monetization`, `test/architecture.test.ts`, `test/legal`, `test/db/{clicks,flags}.test.ts`, `test/admin/{flags,merchants,merchant-offers}.test.ts`, `test/domain/{offer-url,offer}.test.ts`, `test/seo/sitemap.test.ts`) → 15 file, 305/306. Test đỏ duy nhất lại là timeout 5 s: `test/legal/footer.test.ts` "links Terms, Privacy and Media kit…". Test này có từ VNX-0705a, EPIC 21 chỉ thêm một dòng kiểm link `/disclosure`. Chạy riêng → 2/2 xanh. Xem F5.
- **Trạng thái nhánh:** `git ls-remote` cho thấy `main` trên remote đã ở `2ed46f4` (PR #8: ADR-010 và spec Ops console đã sửa, kèm `.ai/reviews/OPS-DESIGN-review.md`, 3 dòng `CURRENT-STATUS.md`). Phần `main` đi thêm chỉ có tài liệu. Ref `origin/main` ở máy vẫn là `b60d8ed`. Xem F3.

## Verdict

**APPROVE WITH CHANGES.**

Không có BLOCKER, không có HIGH, và không có lỗi code nào phải sửa trước khi merge. Trước khi merge còn hai việc quy trình: F1 (`CURRENT-STATUS.md`, Reviewer làm theo bước 11 của `CLAUDE.md`) và F3 (merge lại `main` vì `main` đã đi tiếp; xung đột chỉ nằm ở tài liệu Ops). F2 (MEDIUM) không chặn merge nhưng chặn việc **bật merchant `active` trên production**: Owner cần chọn biện pháp chống ghi D1 hàng loạt qua `/go/` trước bước đó. Các LOW và SUGGESTION còn lại không chặn.

Các task khớp nhau ở mọi đường đi đã kiểm. (1) Đích redirect chỉ đến từ DB, qua một cổng duy nhất `validateFinalUrl`. Cổng này chạy lúc admin lưu (giá trị mẫu) và chạy lại lúc redirect (giá trị thật), và `Location` luôn là `href` đã kiểm lại. (2) Mỗi bảng tiền có đúng một module ghi. Mọi mutation đều ghi audit trong cùng `db.batch`, có guard `write_id`. (3) Test kiến trúc có danh sách cho phép chính xác và không rỗng nghĩa. (4) Các khối A/B/C có mặt nguyên văn và đúng với code. (5) Trang và sitemap thống nhất về việc index.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM (tài liệu, Reviewer làm) | `.ai/context/CURRENT-STATUS.md:9`, `:157` | `CURRENT-STATUS.md` vẫn ghi EPIC 21 là "Tiếp theo". Còn thiếu: trạng thái và SHA của 11 task; quyết định Owner ngày 2026-10-05 (không index lúc ra mắt, nhãn `try_it`, fallback về `website_url`, fallback vẫn ghi click, giữ 13 tháng, giữ `703f5b3`, khối C không phải "thay đổi quan trọng" theo Privacy §10); các ruling của Controller (archived → 404, `direct` không `active` được, slug merchant bất biến, merchant mới mặc định `paused`, `archived`/`ended` là trạng thái cuối, luật `kind` của offer); các sai khác phụ lục đã duyệt; nghĩa vụ ở cuối review này; các minor để lại vào "Ghi nhận". Theo `CLAUDE.md`, task chưa xong khi `CURRENT-STATUS.md` chưa phản ánh nó. | Cập nhật trước khi merge, **sau** khi merge lại `main` (F3), vì `main` đã thêm 3 dòng về Ops vào file này. Commit SHA: `5524440`/`55d80ef` (2101), `c7d2478`/`30a41d0`/`2168d08` (2102a-1/2), `bd49f20` (2102a-3), `6a33015` (2102a-4), `9a3c4fc` (2102b-1), `488df8c` (2102b-2), `4d8e251`/`8a2013c`/`e4198cc` (2103), `f59c4b8`/`d83bb72` (2104a), `3fff6f5` (2104b); tài liệu `116f840`, `0d859c4`, `cd57462`. |
| F2 | MEDIUM (Owner quyết, chặn bước bật merchant trên production, không chặn merge) | `apps/web/src/routes/go.ts:72-89`, `apps/web/migrations/0012_outbound_clicks.sql:16-20` | Mỗi `GET /go/…` không cần đăng nhập ghi một dòng `outbound_clicks`. Theo Owner, fallback cũng ghi, nên điều này đúng ngay cả khi cờ `affiliate` tắt. Không có throttle, và M7 cũng không giảm số lần ghi: dedupe của M7 chỉ áp cho `product_daily_stats`, dòng click vẫn luôn được ghi (phụ lục §2.3). Bảng có 4 index, nên mỗi click tốn khoảng 5 dòng ghi D1 tính phí. Một script đơn giản có thể (a) đẩy chi phí ghi D1 lên, hoặc, nếu tài khoản còn ở gói Free (giới hạn 100k dòng ghi/ngày), làm mọi thao tác ghi khác của site (đăng nhập, Inquiry, request) lỗi tới hết ngày UTC; và (b) làm phồng số click. `is_bot` chỉ đánh dấu, không chặn. Rủi ro bắt đầu khi có merchant `active` có offer mặc định; trước đó `/go/<slug>` trả 404 mà không ghi gì. Phụ lục không có luật nào cho việc này. | Owner chọn trước khi chuyển ElevenLabs sang `active` trên production: (a) một rule Rate limiting của Cloudflare (WAF) cho `vnx.si/go/*`, ví dụ 30 request/phút/IP, không đụng code (khuyến nghị); hoặc (b) task code: không ghi dòng khi `is_bot` hoặc khi vượt ngưỡng theo IP. Phương án (b) phải sửa câu Privacy "We record the click…", nên cần Owner duyệt câu chữ. Đồng thời kiểm gói D1 của tài khoản. |
| F3 | LOW (quy trình) | nhánh / `main` `2ed46f4` | `main` đã đi tiếp từ `b60d8ed` tới `2ed46f4` (PR #8, chỉ có tài liệu). PR #8 thêm cùng các file của `703f5b3` (`docs/adr/ADR-010-ops-console.md`, `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md`) với nội dung đã sửa ở `619785b`, nên merge sẽ gặp xung đột add/add ở hai file đó. Không có file code nào trên `main` đổi, nên kết quả test ở trên vẫn đúng sau merge. | `git fetch` rồi merge `origin/main` vào nhánh, lấy bản của `main` cho hai file Ops (bản đã được review, ADR-010 Accepted). Sau đó chạy lại `npm run typecheck -w apps/web` và `npm test`, rồi mới làm F1. |
| F4 | LOW (tài liệu, Reviewer làm) | `docs/legal/privacy.md:9` | Dòng "Đối chiếu code EPIC 21" không có SHA và không nêu dữ kiện code như các dòng M5/M6. Thiếu: các cột lưu (`routes/go.ts`, `db/clicks.ts`: `offer_id`, `link_kind`, `src`, `locale`, `country`, `referrer_host`, `is_bot`, `created_at`); `visitor_hash` luôn null; `referrerHost` chỉ giữ tên miền và trả null cho IP literal, `localhost` (`domain/outbound.ts:47`); fallback cũng ghi; HEAD/404/405 không ghi; xóa sau 395 ngày (`jobs/daily.ts` bước `outbound_clicks`); không có cookie mới; `Referrer-Policy: origin` trên 302. | Viết lại dòng này với SHA sau merge và các dữ kiện trên, rồi chạy lại `npm test -w apps/web -- test/legal`. |
| F5 | LOW | `apps/web/test/monetization/tools.test.ts:163`, `apps/web/test/seo/sitemap.test.ts:100`, các test lặp theo locale trong `test/monetization/disclosure-page.test.ts`, `test/admin/merchants.test.ts:36`, `:59`; (có sẵn từ trước) `test/legal/footer.test.ts:12` | Global Constraint yêu cầu "test nặng timeout 30 s". Các test mới gửi 12–20 request HTTP trong một `it` (ví dụ 4 trường hợp × 4 locale ở `tools.test.ts:163`) nhưng vẫn dùng mặc định 5 s. Lần chạy này cho thấy rủi ro đó: `footer.test.ts:12`, cùng khuôn 12 request, bị timeout dưới tải. | Thêm `, 30_000` cho các test lặp nhiều request của EPIC 21. Ghi `footer.test.ts` và ba file đỏ ở trên vào "Ghi nhận" để sửa cùng (có sẵn từ trước, ngoài phạm vi). |
| F6 | SUGGESTION | `apps/web/test/architecture.test.ts:126-148` | Luật "ranking không đọc tiền" đúng, và không rỗng nghĩa: danh sách cho phép được so khớp chính xác (`:117`), và các file trong danh sách thật sự có import khớp regex (ví dụ `routes/go.ts` import `../db/offers.ts`). Nhưng test không tự chứng minh regex còn sống, và vẫn còn các điểm mù đã ghi ở Task 1 (SQL chữ thường, join bằng dấu phẩy, import động). | Thêm một đối chứng dương: mỗi file trong `MONEY_ALLOWED` phải khớp ít nhất một pattern (import db tiền hoặc SQL bảng tiền), và đổi regex SQL sang không phân biệt hoa thường. Nên làm trước M7, vì M7 thêm code xếp hạng/thống kê. |
| F7 | SUGGESTION | `apps/web/src/routes/seo.ts:10`, `:18` | `/sitemap.xml` có `Cache-Control: public, max-age=3600`. Sau khi Owner bật hoặc tắt `content_indexing`, sitemap có thể lệch với meta robots của trang tới 1 giờ (cộng 60 s cache cờ). Lúc ra mắt cờ tắt nên không có hậu quả gì. | Ghi vào "Ghi nhận". Khi bật index lần đầu, Owner chờ 1 giờ hoặc purge cache `/sitemap.xml` trước khi gửi sitemap cho Search Console. |

## Đối chiếu các mảng trọng tâm (toàn nhánh)

| Mảng | Đạt? | Bằng chứng |
|---|---|---|
| Open redirect / SSRF, đầu cuối | ✓ | **Admin nhập:** `parseMerchantForm` kiểm `website_url` với `allowed_hosts` mới; `parseOfferForm` kiểm `destination_url` và `parseTemplate` (placeholder chỉ sau host, `TEMPLATE_PREFIX_RE`, điền mẫu rồi `validateFinalUrl`); chương trình phải cùng merchant (domain và SQL `createOffer`/`updateOffer`); đổi host thì `offersBrokenByHosts` chặn lưu. **Lưu:** `allowed_hosts` đọc lại qua `parseStoredHosts`, nên dòng hỏng chỉ làm danh sách hẹp lại. **Redirect:** `resolveOfferRedirect` kiểm lại template đã lưu (`domain/offer.ts:415`), điền `{click_id}` (ULID sinh ở server), `{locale}` (enum từ `localeFromPath` của Referer cùng host) và `{src}` (enum `parseSrc`), rồi `fillAndValidate`. `Location` là `href` đã kiểm hai lần (`go.ts:91`). Request không có đường nào ảnh hưởng tới host: path chỉ là slug (`SLUG_RE`) hoặc ULID (`OFFER_ID_RE`) và bị kiểm trước khi đọc D1; query chỉ đọc `src`. **Fallback:** luôn là `merchants.website_url` + UTM, kiểm lại sau khi gắn UTM (`withUtm`); URL hỏng → 404 (`website_invalid`). **`archived`:** offer hoặc merchant `archived` → 404, không ghi click (`go.test.ts` "SILENT"). **SSRF:** Worker không bao giờ fetch đích, chỉ trả 302, nên rủi ro SSRF phía server không tồn tại; các luật IP/localhost chặn chuyển người dùng tới mạng nội bộ. Test: `go.test.ts:223-297` (URL trong path/query, `//`, `\`, CR/LF, header injection, 11 template độc, 9 URL độc ở cả `destination_url` lẫn `website_url`), `offer-url.test.ts:44-209` (chữ rộng, `。`, `%2e`, `HTTPS://`, `https:///`, userinfo, `:443`/`:8443`, IPv4 thập phân/hex/bát phân/gộp, IPv6 kể cả `::ffff:`, `localhost`). |
| Tiền không chạm xếp hạng | ✓ | `architecture.test.ts:88-153`: 12 file xếp hạng/gợi ý không import `db/{merchants,programs,offers,conversions,revenue,clicks}` và không có SQL tới 6 bảng tiền; mọi file ngoài danh sách cho phép (11 file, so khớp chính xác ở `:117`) cũng vậy; không file xếp hạng nào nằm trong danh sách cho phép; không có `elevenlabs`/`partnerstack` trong `src/**` (luật 4). Test không rỗng nghĩa (xem F6). Không có thay đổi nào ở `domain/catalog.ts`, `domain/directory.ts`, `db/catalog.ts`, `db/directory.ts`. `products` không thêm cột nào (luật 3). |
| Quyền riêng tư | ✓ | Khối C nguyên văn ở `privacy.md` và `content.ts` (EN và VI, 4 vị trí). Test `legal/content.test.ts:119-166` kiểm vị trí, từng dòng, và việc `LEGAL_UPDATED_AT` tăng. Khối C đúng với code: các cột đúng như liệt kê, không có cột IP/email/user (`clicks.test.ts:31` kiểm `PRAGMA table_info`); `visitor_hash: null` cố định ở `go.ts:83`; `referrerHost` chỉ giữ tên miền và trả null cho IP literal, `[::1]` (`outbound.test.ts:45`); `country` chỉ nhận mã 2 chữ; fallback ghi đúng một dòng và `Location` không chứa id dòng (`go.test.ts` "FALLBACKS"); 404/405/HEAD không ghi; log `go.corrupt_data` không chứa IP/UA/referrer (`go.test.ts` "CORRUPT"); xóa sau 395 ngày, giữ dòng nằm đúng ngưỡng, chạy lại không xóa thêm (`clicks.test.ts:63`, `daily.test.ts:172`); không có cookie mới; `Referrer-Policy: origin` khớp câu "partner thấy bạn đến từ VNX.SI". |
| Disclosure | ✓ | Khối A nguyên văn ở 4 locale (`tools.test.ts:200` so chuỗi nguyên văn). Khối B nguyên văn ở `disclosure.md` và `content.ts` (so từng dòng ở `legal/content.test.ts:64`). Câu disclosure hiện khi có ít nhất một offer **đang hiển thị** có `program_id`, bất kể cờ hay trạng thái chương trình (`tools.test.ts:130`); chỉ có offer không chương trình, hoặc offer chương trình bị ẩn → không có câu, không có `sponsored` (`:99`, `:139`). `rel="sponsored noopener"` / `rel="noopener"`, `target="_blank"`. Không lọc theo quốc gia (luật 8). `/disclosure` liệt kê merchant `active` có chương trình `active`, khi trống có đúng một dòng "none" (`disclosure-page.test.ts:37-91`). |
| Index | ✓ | Cờ tắt lúc ra mắt → `noindex`, không canonical, không hreflang (`Layout.tsx:142-153`). Trang mở index đúng khi `indexable = 1` **và** `content_indexing` bật; sitemap dùng cùng điều kiện cộng thêm `status = active` (`tools.test.ts:163` và `sitemap.test.ts:100` kiểm cả 4 tổ hợp). `/disclosure` luôn có trong sitemap. `robots.txt` có `Disallow: /go/`. Độ trễ do cache xem F7. |
| Bề mặt admin | ✓ | Cả 10 route dùng `requireAdmin`. POST đi qua `originCheck` toàn cục. `no-store` qua `noStorePrivate` cho `/admin*` ở mọi tiền tố locale. Test 403 cho user thường và builder trên mọi route POST, Origin lạ → 403, có `no-store` (`admin/merchants.test.ts:36-80`, `admin/flags.test.ts:18-56`, `merchant-offers.test.ts:218`). Mọi mutation ghi audit trong cùng `db.batch`, có guard `write_id` (`runAudited`, `auditStatement` nhánh `flagKey`/`partnerTable`): `flag.set` (không ghi khi đặt trùng giá trị), `merchant.create|update|status` (đổi offer mặc định ghi `merchant.update`), `program.create|update|status`, `offer.create|update|status`; compare-and-set trên trạng thái cho program, offer, merchant status. |
| Migration 0010–0012 | ✓ | Chỉ thêm bảng mới. CHECK đúng như đã duyệt, có chặt thêm `<> ''`: chương trình `active` cần terms và `type != 'direct'`; offer có chương trình cần template; nhãn có `try_it`. Không có DEFAULT ở 0011 (`partners-migration.test.ts:30`) và 0012. 0010 chỉ có `enabled DEFAULT 0`, đã duyệt ở quyết định Reviewer 2. `outbound_clicks` không có FK, Reviewer đã chấp nhận và có ghi chú trong file. Ghi chú deploy trong `wrangler.jsonc` liệt kê đúng thứ tự `0009`, `0010`, `0011`, `0012`, theo luật "migrate trước, deploy sau", và nói cron đọc 0012. Không có secret mới (`ANALYTICS_SALT` không dùng ở lát mỏng). |
| Merge với `main` (`e77c769`) | ✓ | `wrangler.jsonc` giữ `r2_buckets` MEDIA (`:22`) và `TURNSTILE_SITE_KEY` (`:28`); cron `0 1 * * *` giữ nguyên; `git diff origin/main HEAD -- apps/web/wrangler.jsonc` chỉ có 2 đoạn ghi chú của EPIC 21. Typecheck sinh đúng binding `MEDIA: R2Bucket`. `main` đã đi tiếp sau đó, xem F3. |

## Đối chiếu Review Focus 1–7 của plan

| Focus | Đạt? | Bằng chứng |
|---|---|---|
| 1. Open redirect | ✓ | `go.test.ts:223-297`; `go.test.ts:299-332` (ULID/slug sai → 404 trước khi đọc D1). |
| 2. Mánh URL kiểu SSRF | ✓ | `offer-url.test.ts` (tầng domain, đủ danh sách ở plan); `go.test.ts` BAD_TEMPLATES / BAD_URLS (tầng route). |
| 3. Cờ tắt | ✓ | `go.test.ts` "FALLBACKS" (7 lý do, đều có một dòng click và không có click id); `website_invalid` → 404; `archived` → 404, không ghi; cache 60 s kiểm cả hai phía bằng `now` tiêm vào (`db/flags.test.ts:61-99`, `go.test.ts:470`). |
| 4. Disclosure có / không | ✓ | `tools.test.ts:49`, `:99`, `:130`, `:139`; `domain/disclosure.test.ts`. |
| 5. Xếp hạng không đọc tiền | ✓ | `architecture.test.ts:88-153` (xem F6). |
| 6. Điều khoản mặc định | ✓ | `partners-migration.test.ts:30-77`; `admin/merchants.test.ts:260-287`; domain `programActivationError`. |
| 7. Quyền riêng tư | ✓ | `clicks.test.ts:31`; `go.test.ts:366-410` (bot vẫn ghi với `is_bot = 1`, mỗi GET một dòng). |

## ADR-007: đối chiếu "Được bảo đảm bởi"

| Mục | Trạng thái | Bằng chứng / hoãn |
|---|---|---|
| `test/architecture.test.ts`: bản đồ sở hữu bảng có `monetization` | ✓ (một phần là hoãn có ghi) | `:25-49`: `feature_flags`, `merchants`, `partner_programs`, `offers`, `outbound_clicks`. `conversions`, `revenue_entries` chưa có bảng (VNX-2105+). `content` (`articles`, `article_links`) chưa có bảng (EPIC 22). Plan dòng 6 và phụ lục §3.8 "Để sau". |
| `test/architecture.test.ts`: file xếp hạng/gợi ý không import `db/` tiền, không SQL tới bảng tiền | ✓ | `:88-153`, kèm danh sách cho phép chính xác và luật 4 (tên partner). |
| `go.test.ts`: URL trong query | ✓ | `:239` (`url=`, `next=`, `redirect=`, `src=` chứa URL). |
| `go.test.ts`: `//`, `\` | ✓ | `:223` (path), BAD_URLS (`//evil`, `https://example.com\@evil`). |
| `go.test.ts`: CR/LF | ✓ | path `%0d%0a`, query `\r\n` (không có header `X-Injected`), URL lưu có `\r\n`. |
| `go.test.ts`: host lạ, `http:`, IP literal, userinfo | ✓ | BAD_TEMPLATES (11 ca) và BAD_URLS (9 ca), ở cả template, `destination_url` và `website_url`. |
| `go.test.ts`: offer `paused` / hết hạn, cờ tắt | ✓ | "FALLBACKS": `offer_paused`, `offer_not_started`, `offer_ended`, `flag_off`, cộng `merchant_paused`, `program_not_active` (draft, paused). |
| `test/monetization/conversions.test.ts` | Hoãn (có ghi) | Conversion, `UNIQUE(program_id, external_ref)` và báo cáo thuộc VNX-2105–2107, ngoài lát mỏng (plan dòng 6; phụ lục §3.8). Lát mỏng không ghi conversion hay doanh thu nào, nên luật 6 đúng một cách hiển nhiên. |
| Review từ chối migration có giá trị mặc định cho điều khoản | ✓ | Review này đã kiểm: 0011 không có DEFAULT (có test), 0012 không có DEFAULT, 0010 chỉ có `enabled DEFAULT 0` (không phải điều khoản, quyết định Reviewer 2). |

Luật ADR-007 khác: 1 ✓ (một module ghi mỗi bảng); 3 ✓; 4 ✓; 5 ✓ (form admin để trống mọi điều khoản; chỉ `type`/`provider`/`status = draft` có giá trị khởi đầu, không phải điều khoản); 7 ✓; 8 ✓; 9 ✓ (`affiliate`, `partner_referral`; `direct` không có cờ nên không `active` được; mỗi lần đổi cờ ghi audit); 10: không có tracker bên thứ ba ✓, còn hàm event trung tâm để M7 làm; 11: không IP/email ✓, `visitor_hash` để M7 làm. ADR-008: offer `kind = sponsored` bị từ chối tới EPIC 23 (`offer.test.ts:526`), không có ô sponsored nào. ADR-004: không đổi code xếp hạng, test kiến trúc giữ.

## Phân loại các minor để lại

| Task | Minor | Phân loại | Lý do |
|---|---|---|---|
| 1 | Test race dùng chờ cố định 20 ms (có thể chập chờn) | Để sau được | Không đỏ trong các lần chạy dưới tải; sửa cùng F5 khi tiện. |
| 1 | Điểm mù regex kiến trúc (join bằng dấu phẩy, SQL chữ thường, import side-effect/động) | Để sau được | Không có khuôn đó trong `src` hiện tại; xem F6, nên làm trước M7. |
| 2 | Mã lỗi `userinfo`/`protocol` không tới được trong `check()` | Để sau được | Phòng thủ chiều sâu, không ảnh hưởng hành vi. |
| 2c | Test chuyển trạng thái dùng oracle sao chép từ code | Để sau được | Đã có test hành vi ở tầng route. |
| 2c | Terms chỉ có khoảng trắng qua được CHECK (domain trim) | Để sau được | Đường ghi duy nhất là domain, mà domain đã trim. |
| 2c | `toMerchant` được export | Để sau được | Chỉ là vệ sinh code. |
| 2c | `audit.ts` nằm trong `MONEY_ALLOWED`, file xếp hạng import được | Để sau được (đã chấp nhận) | `audit.ts` chỉ đọc `write_id` để guard dòng audit. |
| 3 | Bản xem trước "Right now" cho offer mặc định của merchant `paused` hiện kết quả `/go/o/` (fallback), trong khi `/go/:slug` trả 404 | Để sau được | Chỉ admin thấy; ghi nhãn rõ hơn sau. |
| 3 | Test route offer chỉ kiểm 403 cho user thường (không có builder, không chụp trạng thái "không ghi gì") | Để sau được | `merchants.test.ts:59` đã phủ builder cho các route POST còn lại; `requireAdmin` dùng chung. |
| 3 | Lựa chọn `sponsored` trong dropdown `kind` luôn lỗi | Để sau được | Vô hại; EPIC 23 mở lại. |
| 3 | `programId` lạ che lỗi của các trường khác | Để sau được | Chỉ là trải nghiệm admin. |
| 3 | Xác nhận archive dùng `expectedStatus` từ client | Để sau được | Compare-and-set trong SQL đã bảo vệ. |
| 3 | `aria-describedby` chưa trỏ tới hint | Để sau được | A11y của trang admin; gom vào đợt a11y. |
| 4 | Tham số `batch` chỉ dùng trong test của `purgeOldClicks`; cảnh báo sai khi đúng 50k dòng | Để sau được | Chỉ là log. |
| 4 | HEAD trên offer có tracking trả `click_id` mà không có dòng nào | Để sau được, **có nghĩa vụ** | Template của ElevenLabs không có placeholder nên hiện chưa phát sinh. VNX-2105+ phải xử lý khi ghép conversion (xem Nghĩa vụ). |
| 4 | Referrer có `_` hoặc dấu chấm cuối lưu thành NULL | Để sau được | Chỉ hụt số liệu, không ảnh hưởng quyền riêng tư (thà thiếu còn hơn sai). |
| 6 | Chú thích header `content.ts` (ngày duyệt) và chú thích `LEGAL_UPDATED_AT` đã cũ | Để sau được | Chỉ là chú thích; nên sửa cùng F4. |
| 6 | Kiểm thẻ của khối partner; `lang` trên `ul/li` chưa ghim; spy console không đặt trong `finally`; phạm vi `afterEach` và reset thừa | Để sau được | Chỉ là độ chặt của test. |

**Không có minor nào phải sửa trước khi merge.**

## Câu hỏi cho Owner

1. **F2:** trước khi chuyển ElevenLabs sang `active` trên production, chọn (a) rule Rate limiting Cloudflare cho `/go/*` (khuyến nghị, không cần code), hay (b) một task code giới hạn hoặc bỏ ghi dòng (phải sửa câu Privacy). Tài khoản đang ở gói D1 nào?
2. **Ngày "Last updated":** `LEGAL_UPDATED_AT = "2026-10-05"` dùng chung cho Terms, Privacy và Disclosure. `docs/legal/disclosure.md:6` ghi "Owner chốt khi deploy". Owner giữ 2026-10-05 hay đổi sang ngày go-live? Nếu đổi, cả ba trang cùng đổi; khi đó cần một commit nhỏ kèm test `legal/content`.
3. **Phụ lục §9:** câu "Builder tự gắn chương trình affiliate của chính họ: ai nhận hoa hồng" vẫn ghi "Chốt khi Plan EPIC 21". Lát mỏng không chạm tới câu này. Owner xác nhận để nó tới plan phần còn lại của EPIC 21 (Hub "Quản lý offer").

## Nghĩa vụ để lại

**Trước khi merge (Reviewer):**
- F3: merge lại `main` (`2ed46f4`), lấy bản của `main` cho hai file Ops, chạy lại typecheck và `npm test`.
- F1: cập nhật `CURRENT-STATUS.md` (trạng thái, SHA, quyết định, ruling, sai khác phụ lục, nghĩa vụ dưới đây, các minor vào "Ghi nhận"); F4: viết lại dòng đối chiếu code trong `privacy.md`.

**Owner, trước khi bật trên production (theo thứ tự):**
- `npm run db:migrate:remote -w apps/web` (áp 0010–0012) rồi `npm run deploy` (`wrangler.jsonc`).
- `VNX-0803-fix` (security headers, giới hạn body) nên vào trước khi `/go/` chạy thật trên production, theo `.ai/reviews/VNX-0803-security-review.md` (nhánh `fix/vnx-0803-security`). F3 của review đó (admin chỉ có một yếu tố, Cloudflare Access) cũng liên quan: chiếm được hộp thư admin là sửa được `allowed_hosts` và đích của `/go/`. Sau khi merge fix đó, kiểm lại rằng `/go/` vẫn trả `Referrer-Policy: origin` (`go.test.ts` `expectRedirectHeaders` sẽ bắt nếu sai).
- Quyết định F2 (rate limit `/go/*`).
- Admin nhập ElevenLabs: merchant (`paused`), mô tả tiếng Anh, chương trình `draft` → `active` khi đã có `terms_url` và `terms_verified_at`, offer `try_it` có `destination_url = https://elevenlabs.io` và template `https://try.elevenlabs.io/7fnly5cv33k3`, đặt làm mặc định, rồi merchant `active`; bật cờ `affiliate`. Giữ `content_indexing` tắt.
- Chốt ngày `LEGAL_UPDATED_AT` (câu hỏi 2).

**M7 (VNX-0707):**
- Thêm `/go/p/:slug/{demo,site}` vào `routes/go.ts` **trước** catch-all `app.get("/go/*")` (`go.ts:110`), nếu không catch-all sẽ che route mới. Sửa test `go.test.ts` đang chờ `/go/p/…` trả 404.
- Dùng lại `outbound_clicks` (không cần migration mới); thêm `visitor_hash` (HMAC, `ANALYTICS_SALT`) và **sửa câu Privacy** "for now we do not link it to any visitor identifier" (Owner duyệt câu chữ); thay `isBotRequest` bằng luật chung của spec 8.11; `product_daily_stats` và việc loại builder/admin; hàm event trung tâm (ADR-007 luật 10).
- Thêm file mới vào `RANKING_FILES`/`MONEY_ALLOWED` khi cần; làm F6 trước.
- Số dòng ghi D1 trên `/go/` tăng theo traffic (F2): giữ biện pháp đã chọn.

**Phần còn lại của EPIC 21 (VNX-2105+):**
- `test/monetization/conversions.test.ts` theo ADR-007; thêm `conversions`, `revenue_entries` vào `WRITERS`, `MONEY_TABLES` đã có; ledger không UPDATE/DELETE.
- `click_id` từ HEAD không có dòng nào: khi ghép conversion, coi `click_id` lạ là "không ghép được", hoặc ghi dòng cho HEAD. Owner chọn khi lập plan.
- Tham số sub-id của PartnerStack cho `{click_id}` (Owner đọc tài liệu, sửa template qua admin).
- Offer của product (`subject_type = product`, host khớp `website_url`/`demo_url` của product, phụ lục §3.3); Hub "Quản lý offer"; logo merchant (R2).
- Theo ADR-010 (Ops console): chuyển `/admin/flags`, `/admin/merchants` vào `/ops/monetization/*`, chỉ Owner được dùng.

**EPIC 22 / 23 / VNX-0801:** quyền sở hữu bảng `content` trong test kiến trúc; mô tả merchant dạng markdown; bài viết liên quan trên `/tools`; ô sponsored và cờ `sponsored_listings` theo ADR-008; bản dịch zh của `/disclosure` và Privacy.

**Ghi nhận (ngoài phạm vi):** các test HTTP nặng có sẵn từ trước bị timeout 5 s khi máy tải nặng (`test/legal/footer.test.ts:12`, `test/admin/feedback.test.ts:101`, `test/hub/invitations.test.ts:168`, `:193`, `test/public/request-form.test.ts:140`); chú thích ở `apps/web/vitest.config.ts` ("wrangler.jsonc has no R2 binding until R2 is enabled") đã cũ từ khi PR #6 bật R2.
