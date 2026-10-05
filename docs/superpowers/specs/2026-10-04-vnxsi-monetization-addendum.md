# VNX.SI — Phụ lục spec: Monetization, Partner, Nội dung

- **Ngày:** 2026-10-04
- **Trạng thái:** Approved bởi Owner 2026-10-04 (cùng ADR-007/008/009)
- **Bổ sung cho:** [spec Wave 1](2026-10-03-vnxsi-marketplace-wave1-design.md). Phụ lục có cùng cấp với spec. Chỗ nào phụ lục ghi "thay mục X" thì phụ lục thắng.
- **Căn cứ:** [audit](../../strategy/2026-10-04-monetization-audit.md) (quyết định Owner Q1–Q9), [ADR-007](../../adr/ADR-007-monetization.md), [ADR-008](../../adr/ADR-008-sponsored-placement.md), [ADR-009](../../adr/ADR-009-advertising.md). Khi phụ lục khác đề xuất trong audit, phụ lục thắng.

---

## 1. Phạm vi và thứ tự

| Phần | Nội dung | Làm ở | Mục |
|---|---|---|---|
| A. Outbound | `/go/` cho link demo/website của product, `outbound_clicks` | **M7** (VNX-0707, thay `/p/:slug/demo`) | 2 |
| B. Partner | cờ tính năng, merchant, chương trình, offer, `/tools/:merchant`, disclosure, conversion, ledger, báo cáo | EPIC 21. **Lát mỏng** (mục 3.8) làm ngay sau VNX-0708 cho partner đầu tiên (ElevenLabs, Owner 2026-10-04); phần còn lại sau | 3 |
| C. Nội dung | bài biên tập, trang category SEO, liên kết nội bộ | EPIC 22 (Wave 2, gộp EPIC 13) | 4 |
| D. Sponsored | ô tách riêng | EPIC 23, sau cổng ra Wave 1 | 5 |
| E. Quảng cáo | chỉ thiết kế | EPIC 24, chưa lên lịch | 6 |
| F. Lead | dùng lại M6, không phí | — | 7 |

Thay đổi so với audit: `offers` và `feature_flags` dời sang phần B, vì phần A chỉ phục vụ link của product (đích lấy từ `products`, không cần bảng offer).

## 2. Phần A — Outbound tracking (M7)

**Thay spec Wave 1 mục 8.11** ở dòng "`demo_clicks` đếm qua route chuyển hướng `/p/:slug/demo`".

### 2.1 Route

| Route | Đích |
|---|---|
| `GET /go/p/:slug/demo` | `products.demo_url` |
| `GET /go/p/:slug/site` | `products.website_url` |

- Không có tiền tố locale. Chỉ nhận GET/HEAD.
- Query duy nhất được đọc là `src` (nơi đặt link), thuộc enum `product_page` / `builder_page` / `catalog` / `home` / `article` / `tools`. Giá trị khác thì ghi `unknown`. **Không có tham số nào chứa URL.**
- Product không công khai (không `published`, hoặc builder không `approved`), hoặc thiếu URL tương ứng → trang 404 theo locale mặc định.
- Đích phải parse được và là `https:`; sai thì 404 và ghi log lỗi (dữ liệu hỏng, vì editor đã ép `https`).
- Gắn `utm_source=vnx.si&utm_medium=referral` vào đích, **trừ khi** URL đã có một tham số `utm_*` bất kỳ.
- Phản hồi `302`, kèm `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: origin`.
- `robots.txt` (VNX-0404) thêm `Disallow: /go/`.

### 2.2 Ghi nhận

Bảng mới `outbound_clicks` (module `monetization`), ghi bằng `executionCtx.waitUntil` để không làm chậm redirect:

| Cột | Ghi chú |
|---|---|
| `id` | ULID; ở phần B cũng là `click_id` gửi cho partner |
| `product_id` | nullable |
| `offer_id` | nullable; phần A luôn null (chưa có FK vì bảng `offers` ra đời ở phần B) |
| `link_kind` | `demo` / `site` / `offer` |
| `src` | enum ở 2.1 |
| `locale` | locale của trang gửi click, đọc từ cookie/Referer; không rõ thì `en` |
| `visitor_hash` | HMAC-SHA256(cookie ẩn danh của M7, khóa ngày = HMAC(`ANALYTICS_SALT`, ngày UTC)); null khi không có cookie |
| `country` | `request.cf.country` |
| `referrer_host` | chỉ host, không lưu path |
| `is_bot` | theo cùng luật lọc bot của view (spec 8.11) |
| `created_at` | |

CHECK: `product_id` hoặc `offer_id` khác null. Index: `(product_id, created_at)`, `(offer_id, created_at)`, `(visitor_hash, product_id, link_kind, created_at)`.

Không lưu IP, email, user id.

### 2.3 Số liệu

- `product_daily_stats` có thêm cột `outbound_clicks` (gồm cả `demo` và `site`); `demo_clicks` giữ nguyên ý nghĩa (chỉ `demo`), công thức trending không đổi.
- Chỉ cộng vào `product_daily_stats` khi: không phải bot, không phải builder của product, không phải admin, và là lượt đầu tiên của `visitor_hash` cho cặp (product, `link_kind`) trong ngày UTC. Dòng `outbound_clicks` luôn được ghi, kể cả khi không cộng.
- Route `/go/` gọi hàm của module `insights` để cộng (`db/stats.ts`), không ghi trực tiếp vào bảng của module khác.

### 2.4 Giao diện

- `ProductPage`: nút Demo và link Website trỏ tới `/go/p/:slug/demo?src=product_page` và `/go/p/:slug/site?src=product_page`; giữ `rel="nofollow ugc noopener"` và `target="_blank"`.
- Link website/portfolio của builder trên `/b/:handle` **không** đổi ở M7 (không có product id). Xem lại ở EPIC 21 nếu cần đo.

### 2.5 Secret mới

`ANALYTICS_SALT` (`wrangler secret`, `.dev.vars` ở local). Thiếu secret thì `visitor_hash = null`, không dedupe; không lỗi trang.

## 3. Phần B — Partner và affiliate (EPIC 21)

### 3.1 Cờ tính năng

Bảng `feature_flags` (`key` PK, `enabled` 0/1, `updated_by`, `updated_at`). Key hợp lệ (enum trong code): `affiliate`, `partner_referral`, `sponsored_listings`, `ads`, `lead_generation`, `ai_content`, `content_indexing`. Không có dòng = tắt. `/admin/flags` bật/tắt, ghi `audit_log`. Đọc qua hàm có cache trong isolate 60 giây.

### 3.2 Dữ liệu

**`merchants`**: `id`, `slug` (unique, cùng luật slug product), `name`, `website_url` (https), `allowed_hosts` (JSON, host đích hợp lệ cho mọi offer của merchant; khớp chính xác hoặc là subdomain của một mục), `logo_key` (R2, nullable), `description` (markdown giới hạn, mục 4.3; ở lát mỏng là văn bản thuần theo spec Wave 1 mục 8.6), `default_offer_id` (nullable, offer mà `/go/:merchantSlug` trỏ tới), `indexable` (0/1), `status` (`active`/`paused`/`archived`). Slug merchant không được là `p` hoặc `o` (đã dùng cho `/go/p/…`, `/go/o/…`); danh sách từ dành riêng nằm trong domain, giống handle builder.

**`partner_programs`**: `id`, `merchant_id`, `name`, `type` (`affiliate`/`referral`/`revenue_share`/`direct`), `network` (văn bản tự do), `provider` (`generic_template`/`manual`), `commission_model` (`percent`/`flat`/`tiered`/`custom`, nullable), `commission_rate_bps`, `commission_flat_minor`, `currency`, `cookie_days` (đều nullable, **không có mặc định**), `attribution_notes`, `terms_url`, `terms_verified_at`, `status` (`draft`/`active`/`paused`/`ended`). Chỉ chuyển `active` khi có `terms_url` và `terms_verified_at`.

**`offers`**: `id`, `program_id` (nullable: null = offer không kiếm tiền, ví dụ link chính thức của merchant), `subject_type` (`product`/`merchant`/`article`), `subject_id`, `kind` (`official`/`trial`/`affiliate`/`referral`/`sponsored`), `label` (enum key i18n: `learn_more`, `get_started`, `start_trial`, `visit_site`, `try_it` — "Try {name}", Owner 2026-10-05), `destination_url`, `tracking_template` (nullable), `status` (`active`/`paused`/`archived`), `starts_at`, `ends_at`. Một subject có nhiều offer.

**`conversions`**: `id`, `program_id`, `click_id` (nullable, FK `outbound_clicks`), `external_ref`, `order_amount_minor` (nullable), `commission_minor`, `currency`, `status`, `source` (`manual`/`csv`/`postback`), `occurred_on`, `confirmed_at`. `UNIQUE(program_id, external_ref)`.

**`revenue_entries`** (ledger, không UPDATE, không DELETE): `id`, `entry_kind` (`confirmed`/`received`/`reversal`), `source_type` (`affiliate`/`referral`/`sponsored`/`ads`/`lead`), `source_id`, `merchant_id`, `product_id`, `amount_minor` (âm với `reversal`), `currency`, `occurred_on`, `note`, `created_by`, `created_at`.

### 3.3 Offer và `/go/o/:offerId`

- Template chỉ chấp nhận placeholder `{click_id}`, `{locale}`, `{src}`; giá trị được `encodeURIComponent`. Placeholder lạ → lỗi khi lưu.
- Khi lưu (admin) và khi redirect: URL cuối (sau khi điền template, hoặc `destination_url` nếu không có template) phải là `https:`, không có userinfo, không phải IP literal hay `localhost`, và host thuộc `merchants.allowed_hosts` của merchant tương ứng. Với offer của product mà không có chương trình, host phải khớp host `website_url`/`demo_url` của product.
- Redirect chỉ khi: offer `active`, trong khoảng `starts_at`/`ends_at`, chương trình (nếu có) `active`, merchant `active`, và cờ của loại tương ứng đang bật (`affiliate` cho `type = affiliate`, `partner_referral` cho `referral`/`revenue_share`). Thiếu điều kiện nào → chuyển tới `destination_url` không có tracking nếu host hợp lệ; không thì 404.
- Header và ghi click như mục 2.1–2.2, `link_kind = 'offer'`.
- **Sửa đổi (Owner 2026-10-05, thay câu fallback ở trên):** khi không được tracking (cờ tắt, chương trình chưa `active`, offer ngoài khoảng thời gian), `/go/` chuyển tới `merchants.website_url` của merchant (theo 3.8), không tới `destination_url`; đích vẫn phải qua luật URL và `allowed_hosts`. Lượt fallback vẫn ghi một dòng `outbound_clicks` (không gửi `click_id`). Offer/merchant `archived` → 404.
- **`GET /go/:merchantSlug`** (Owner 2026-10-04): tra merchant theo slug, dùng `default_offer_id`, rồi xử lý y như `/go/o/:offerId`. Merchant không `active`, không có offer mặc định, hoặc slug không tồn tại → 404. Đây là URL dùng cho nút trên `/tools/:merchant` và để chia sẻ.

### 3.4 Hiển thị

- **`/tools/:merchantSlug`** (4 locale, theo Q1): tên, logo, mô tả, các offer (nút theo `label`), bài viết liên quan (phần C), disclosure. `noindex` khi `indexable = 0` hoặc khi cờ `content_indexing` tắt. Không có Buy / Customize / Hire.
- **Khối offer trên trang product:** chỉ hiện offer `kind ∈ {trial, affiliate, referral}` mà builder của product **tự gắn** (EPIC 21, task Hub "Quản lý offer"). Platform không gắn offer bên thứ ba lên trang product của builder.
- **Disclosure:** trang render ít nhất một offer có `program_id` thì hiện câu disclosure ngay trên khối offer và link `/disclosure`. Link kiếm tiền: `rel="sponsored noopener"`. Bản EN (Owner duyệt câu chữ trước khi làm): *"VNX.SI may earn a commission when you sign up or buy through some links on this page. This never changes how products are ranked."*
- **`/disclosure`** (4 locale): quan hệ partner, cách xếp hạng không bị ảnh hưởng (ADR-004, ADR-008), danh sách merchant đang có chương trình `active`.

### 3.5 Conversion

- Trạng thái: `pending → approved → paid`; `pending → reversed`; `approved → reversed`. Hàm thuần trong `domain/conversion.ts`.
- Nguồn giai đoạn đầu: admin nhập tay, hoặc import CSV theo **định dạng của VNX.SI**: `external_ref, click_id, occurred_on, order_amount, commission, currency, status`. Admin chuyển báo cáo partner sang định dạng này. Dòng trùng `external_ref` → cập nhật trạng thái nếu là chuyển hợp lệ, không thì báo lỗi dòng. Số tiền chỉ nhận số thập phân hợp lệ, đổi sang minor unit theo `currency`.
- Postback/webhook: **không làm trong EPIC 21 cơ bản.** Chỉ thêm task khi một partner thật hỗ trợ, theo giao thức của mạng đó, với secret trong `wrangler secret` và cửa sổ thời gian chống replay.
- Ledger: conversion sang `approved` → một dòng `confirmed`; sang `reversed` sau `approved` → một dòng `reversal`; admin ghi `received` khi tiền về tài khoản (Q4: tài khoản cá nhân Owner).

### 3.6 Admin

| Trang | Nội dung |
|---|---|
| `/admin/flags` | Bật/tắt cờ |
| `/admin/merchants`, `/admin/merchants/:id` | CRUD merchant, chương trình, offer; kiểm host; xem trước URL cuối |
| `/admin/conversions` | Danh sách, nhập tay, import CSV, chuyển trạng thái |
| `/admin/revenue` | Tổng theo `source_type`, merchant, product, category, ngày/tháng; **mỗi loại tiền một cột**, không quy đổi. Theo offer: click (không bot), conversion `approved`+`paid`, hoa hồng. Không hiện số ước tính |

Mọi thao tác ghi `audit_log`.

### 3.7 Builder

- Hub "Quản lý offer" cho product của mình: thêm offer `trial` (không chương trình) hoặc offer gắn chương trình affiliate do **builder tự có** thì để sau, cần quyết riêng (ai nhận hoa hồng). Bản đầu chỉ `trial`.
- `/hub/products/:id/stats` (sau M7): view, demo click, outbound click, Inquiry theo ngày, 30 ngày. Builder không thấy doanh thu, hoa hồng, hay số của product khác.

### 3.8 Lát mỏng cho partner đầu tiên (Owner 2026-10-04)

Đủ để chạy luồng: `/tools/elevenlabs` → nút **Try ElevenLabs** → `/go/elevenlabs` → link tracking PartnerStack → ElevenLabs.

| Có trong lát mỏng | Để sau |
|---|---|
| `feature_flags` + `/admin/flags` (cờ `affiliate`) | Conversion, import CSV, ledger `revenue_entries`, `/admin/revenue` (doanh thu xem tạm trên dashboard PartnerStack) |
| `merchants`, `partner_programs`, `offers` + admin nhập/sửa (kiểm host, xem trước URL cuối) | Offer gắn với product hoặc bài viết; offer `trial` trong Hub |
| `/go/:merchantSlug`, `/go/o/:offerId`; `outbound_clicks` (tạo ở đây nếu VNX-0707 chưa làm) | Postback/webhook |
| `/tools/:merchantSlug` (4 locale, mô tả văn bản thuần), disclosure, `/disclosure` | Markdown cho mô tả merchant (đi cùng VNX-2202) |
| Sitemap: `/tools/:slug` khi `indexable = 1` và cờ `content_indexing` bật | Logo merchant (R2) |

Dữ liệu ElevenLabs lấy từ `docs/partners/registry.md`, admin nhập qua giao diện; không seed bằng migration. Chương trình chỉ `active` khi Owner đã điền `terms_url` và `terms_verified_at`, nên nút chỉ dẫn tới link tracking sau bước đó (trước đó `/go/` chuyển về `website_url` không có tracking, theo mục 3.3).

## 4. Phần C — Nội dung biên tập (EPIC 22)

### 4.1 Dữ liệu

**`articles`**: `id`, `type` (`guide`/`review`/`comparison`/`alternatives`/`best_list`/`category_guide`), `locale`, `translation_group` (ULID chung cho các bản dịch của một bài), `slug`, `title`, `summary` (≤ 300), `body` (markdown giới hạn), `seo_title`, `seo_description`, `category` (cho `category_guide`), `status` (`draft`/`in_review`/`published`/`archived`), `indexable` (0/1, admin đánh dấu), `author_user_id`, `reviewed_by`, `ai_assisted` (0/1), `published_at`, `updated_at`. `UNIQUE(locale, type, slug)`.

**`article_links`**: `article_id`, `target_type` (`product`/`merchant`/`article`), `target_id`, `role` (`subject`/`compared`/`alternative`/`listed`/`mentioned`), `sort`.

### 4.2 Quy trình

`draft → in_review → published → archived`; `in_review → draft` khi người duyệt trả lại. Chỉ admin tạo và sửa. Người duyệt có thể là chính admin đó trong giai đoạn một người vận hành, nhưng phải bấm duyệt riêng, có ghi `audit_log`. AI viết nháp chỉ khi ADR-005/006 `Accepted` và cờ `ai_content` bật; bài `ai_assisted = 1` vẫn phải qua `in_review`.

### 4.3 Markdown giới hạn (Q8)

- Hỗ trợ: đoạn, heading `##`–`####`, **đậm**, *nghiêng*, `code` nội dòng, danh sách có/không thứ tự, link, bảng, ảnh.
- Mọi HTML thô bị escape. Link: `https://` hoặc đường dẫn nội bộ bắt đầu bằng `/`; link ngoài có `rel="nofollow noopener"`; link kiếm tiền phải là link tới `/go/o/:offerId` (renderer tự thêm `rel="sponsored noopener"`). Ảnh chỉ từ `/media/articles/…`.
- Tự viết hay dùng thư viện: quyết trong plan EPIC 22 (spec Wave 1 ưu tiên ít dependency). Bắt buộc có bộ test XSS.

### 4.4 URL và điều kiện index (Q9)

Mỗi bài chỉ tồn tại ở URL của locale của nó; locale khác → 404. hreflang chỉ liệt kê các bài cùng `translation_group`.

| Loại | URL | Được index khi |
|---|---|---|
| `category_guide` | `/products/c/:category` (trang có phần giới thiệu + danh sách product theo thứ tự organic) | ≥ **5** product published trong category |
| `best_list` | `/best/:slug` | ≥ **5** product (`role = listed`) đang công khai |
| `alternatives` | `/alternatives/:productSlug` | ≥ **3** product đang công khai cùng category, khác product chủ đề |
| `comparison` | `/compare/:slug` | ≥ **2** product (`role = compared`) đang công khai |
| `guide`, `review` | `/guides/:slug`, `/reviews/:slug` | admin đánh dấu `indexable` |

Với mọi loại: cần thêm `indexable = 1` và cờ `content_indexing` bật. Điều kiện được tính lại mỗi lần render và mỗi lần tạo sitemap; khi product bị gỡ làm bài tụt dưới ngưỡng thì bài tự `noindex` và ra khỏi sitemap. Product không còn công khai thì không hiện trong bài.

### 4.5 SEO và liên kết

- JSON-LD: `Article` + `BreadcrumbList`. Không `Review`, không `aggregateRating`, không sao.
- `og:type = article`.
- Trang product hiện "Được nhắc trong" (tối đa 5 bài `published`, cùng locale, `role ≠ mentioned` ưu tiên trước).
- Thứ tự product trong `category_guide` là thứ tự organic của ADR-004; trong `best_list`/`comparison` là thứ tự biên tập (`sort`), do admin chọn, không bán.

## 5. Phần D — Sponsored (EPIC 23)

Theo [ADR-008](../../adr/ADR-008-sponsored-placement.md). Khi lập plan EPIC 23, Owner chốt: số ô mỗi trang, giá và thời hạn chiến dịch, cách thu tiền trước EPIC 14.

## 6. Phần E — Quảng cáo (EPIC 24)

Theo [ADR-009](../../adr/ADR-009-advertising.md). Chưa code.

## 7. Phần F — Lead

Dùng lại luồng Post a request (spec Wave 1 mục 5.7, M6). Không bảng mới, không phí (Q7). Cờ `lead_generation` không chặn M6; dành cho tính năng lead trả phí sau này.

## 8. Test bắt buộc

- `/go/`: mọi ca ở ADR-007 "Được bảo đảm bởi"; product không công khai → 404; header `no-store`/`noindex`; UTM không bị gắn khi URL đã có `utm_*`; click của bot/chủ product/admin không cộng vào `product_daily_stats` nhưng vẫn có dòng `outbound_clicks`; dedupe theo ngày.
- Test kiến trúc: sở hữu bảng mới; luật "ranking không đọc tiền".
- Offer: placeholder lạ bị từ chối; host ngoài `allowed_hosts` bị từ chối lúc lưu và lúc redirect; cờ tắt → không tracking.
- Conversion: chuyển trạng thái hợp lệ/không hợp lệ; CSV trùng `external_ref`; ledger không có UPDATE/DELETE.
- Disclosure: có offer kiếm tiền → có câu disclosure và `rel="sponsored"`; không có → không hiện.
- Nội dung: ngưỡng index ở 4.4 (ngay dưới và ngay tại ngưỡng); bài tụt ngưỡng tự `noindex`; locale khác → 404; XSS corpus cho markdown.
- Builder chỉ thấy số liệu product của mình (403/404 chéo).

## 9. Còn mở (chốt khi lập plan của phần tương ứng)

| Câu hỏi | Chốt khi |
|---|---|
| ~~Thời gian giữ `outbound_clicks`~~ **Chốt 13 tháng, cron xóa (Owner 2026-10-05, plan EPIC 21)** | — |
| ~~Câu chữ disclosure ở 4 locale~~ **Owner duyệt 2026-10-05** (plan EPIC 21, khối A) | — |
| Builder tự gắn chương trình affiliate của chính họ: ai nhận hoa hồng | Plan EPIC 21 |
| Số ô sponsored, giá, thời hạn | Plan EPIC 23 |
| Ngưỡng traffic để bắt đầu quảng cáo | Lên lịch EPIC 24 |
