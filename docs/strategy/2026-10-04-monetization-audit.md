# VNX.SI — Audit repo và đề xuất Monetization Engine

- **Ngày:** 2026-10-04
- **Người viết:** Claude (Reviewer)
- **Trạng thái:** Owner đã trả lời Q1–Q9 (2026-10-04, xem "Quyết định của Owner" ở mục 0). Chưa sửa code.
- **Nguồn yêu cầu:** prompt "VNX.SI — Marketplace + Affiliate + Ads + Monetization Expansion" (Owner, 2026-10-04)
- **Kết quả:** ADR-007/008/009 và [phụ lục spec](../superpowers/specs/2026-10-04-vnxsi-monetization-addendum.md). Chỗ nào phụ lục khác đề xuất ở đây (ví dụ `offers`, `feature_flags` dời sang EPIC 21), phụ lục thắng.
- **Căn cứ:** spec Wave 1, ADR-001…006, `ARCHITECTURE.md`, `AI-ARCHITECTURE.md`, `WAVE1-ROADMAP.md`, `07-MASTER-BACKLOG.md`, migration `0001`–`0005`, code `apps/web/src` tại `921cf99`.

---

## 0. Kết luận chính và câu hỏi cho Owner

Kiến trúc hiện tại thêm được một lớp monetization mà không đụng lõi marketplace. Một Worker, D1, module sở hữu bảng và test kiến trúc đều hợp với việc này. Nhưng prompt có **hai điểm mâu thuẫn với quyết định đã khóa**, và vài điểm cần Owner chốt trước khi viết plan.

### Mâu thuẫn với quyết định đã khóa

| # | Prompt yêu cầu | Đang khóa ở | Vì sao không làm thẳng được |
|---|---|---|---|
| M1 | Featured / Sponsored listing; `FinalDisplay = OrganicRanking + ValidPromotionBoost` | **ADR-004 (Accepted)**: "không có tham số, cột hay đường code nào cho phép trả tiền để thay đổi thứ tự…"; Charter: sponsored ngoài phạm vi, nếu có thì "tách nhãn và cần ADR mới"; spec §8.7, §8.11 | Công thức boost vi phạm trực tiếp ADR-004. Muốn có thì phải viết ADR mới thay thế một phần ADR-004. Kể cả có ADR mới, Reviewer khuyên **không boost** mà chỉ cho phép ô sponsored tách riêng (mục 7.5). |
| M2 | Catalog gồm app, AI tool, SaaS, dev tool của bên thứ ba (Cloudflare, AWS, DigitalOcean…) | Charter + spec §1: "marketplace for **AI-built products** and the people who build them"; `products.builder_id NOT NULL`; mỗi product có 4 nút Buy / Customize / Hire Builder / Build Similar | Cloudflare không phải builder, không ai "Hire" hay "Customize" Cloudflare được. Đưa Cloudflare vào bảng `products` là đổi định vị sản phẩm và phá state machine product, trust badge và luồng Inquiry. |

### Câu hỏi Owner cần quyết (chưa quyết thì Reviewer không viết plan)

| # | Câu hỏi | Các lựa chọn | Reviewer khuyên |
|---|---|---|---|
| Q1 | Listing bên thứ ba (Cloudflare…) nằm ở đâu? | (a) Không có; affiliate chỉ xuất hiện trong nội dung biên tập. (b) Một khu **Tools / Infrastructure** riêng (`/tools/:merchant`) do platform biên tập, tách khỏi `/products`. (c) Trộn vào `products` | **(b)**. Giữ `/products` là chợ của builder. |
| Q2 | Paid placement (M1) | (a) Giữ ADR-004 nguyên vẹn. (b) ADR-007: ô sponsored tách riêng, có nhãn, nằm ngoài danh sách xếp hạng, không boost. (c) Boost như prompt | **(b)**, và chỉ sau cổng ra Wave 1. Thu tiền cần cổng thanh toán (EPIC 14). |
| Q3 | Làm khi nào so với Wave 1 (đang ở M4, production vẫn là landing cũ)? | (a) Dừng Wave 1 để làm monetization. (b) Chốt kiến trúc ngay (ADR + spec phụ lục), gộp `/go/` vào M7 thay cho `/p/:slug/demo`, phần affiliate làm khi có hợp đồng partner thật đầu tiên. (c) Để sau Wave 1 | **(b)**. Đúng ý "có Monetization Engine từ kiến trúc ban đầu" mà không trễ cổng ra Wave 1. |
| Q4 | Pháp nhân nào nhận hoa hồng, payout về tài khoản nào? | Liên quan VNX-1401 (nghiên cứu pháp nhân) | Phải có câu trả lời trước khi bật bất kỳ chương trình partner nào trên production. |
| Q5 | Analytics bên ngoài (GA…) | (a) Chỉ analytics nội bộ (backlog VNX-1303 ghi "không dùng tracker bên thứ ba"). (b) Thêm GA, kèm banner đồng ý cookie | **(a)**. Event vẫn qua một port để sau này nối ra ngoài được. |
| Q6 | Quảng cáo (AdSense…) | (a) Chỉ viết ADR, không code tới khi có traffic. (b) Code abstraction ngay, cờ tắt | **(a)**. Code không dùng tới chỉ thêm việc bảo trì (YAGNI). |
| Q7 | Lead generation | Gần trùng luồng Post a request (M6). Có thu phí lead không? | Dùng lại M6, chưa thu phí (Charter: "không thu listing fee giai đoạn đầu"). |
| Q8 | Nội dung biên tập (guide, review…) | Định dạng: văn bản thuần như spec §8.6, hay markdown giới hạn? Ai viết: Owner, AI nháp rồi người duyệt? | Markdown giới hạn, chỉ admin viết, render bằng whitelist. AI nháp chờ Wave 2 (ADR-005/006 còn Proposed). |
| Q9 | Ngưỡng index | Số product tối thiểu để một trang category/best-list được index; độ dài và số product tối thiểu của một bài | Owner chốt con số. Reviewer không tự đặt mặc định. |

### Quyết định của Owner (2026-10-04)

| # | Quyết định | Hệ quả cần ghi vào tài liệu |
|---|---|---|
| Q1 | Khu **`/tools/:merchant`** riêng do platform biên tập; `/products` chỉ gồm product của builder | `products` giữ `builder_id NOT NULL`; trang tools thuộc module `monetization` (Phase 2) |
| Q2 | **Ô Sponsored tách riêng**, có nhãn, ngoài danh sách xếp hạng, không cộng điểm; làm sau cổng ra Wave 1 | ADR-008 thay một phần ADR-004; test "thứ tự organic không đổi khi bật/tắt sponsored" |
| Q3 | **Chốt kiến trúc ngay**; gộp `/go/` + outbound click vào M7 (thay `/p/:slug/demo`); affiliate làm khi có hợp đồng partner thật | ADR-007 + phụ lục spec trước M4; sửa roadmap M7 (VNX-0701) là sai khác roadmap đã được duyệt |
| Q4 | **Cá nhân Owner** đăng ký chương trình partner và nhận payout | Không chặn Phase 2. Ghi rủi ro: thuế thu nhập cá nhân, mẫu thuế partner yêu cầu, điều khoản partner có thể không cho cá nhân hoặc có hạn chế; khi lập pháp nhân (VNX-1401) phải chuyển hợp đồng. Disclosure ghi "VNX.SI" là bên nhận hoa hồng; Owner tự kiểm điều khoản từng partner |
| Q5 | **Chỉ analytics nội bộ** (D1, tổng theo ngày), không script bên thứ ba; event qua port | Không cần banner cookie; cập nhật `/privacy` về cookie ẩn danh |
| Q6 | **Quảng cáo: chỉ viết ADR**, chưa code | Phase 4 hoãn tới khi có traffic |
| Q7 | **Lead dùng lại M6, chưa thu phí** | Không bảng mới; mô hình phí quyết ở Wave 3 |
| Q8 | **Markdown giới hạn, chỉ admin viết**, render bằng whitelist; AI nháp chờ Wave 2 | Renderer markdown whitelist là thành phần mới, cần review bảo mật (XSS) |
| Q9 | Ngưỡng index: **category ≥ 5, best list ≥ 5, alternatives ≥ 3** product cùng category, **so sánh ≥ 2**; guide/review index khi admin đánh dấu `indexable` | Ghi vào phụ lục spec; test ngưỡng |

---

## 1. Kiến trúc hiện tại

| Lớp | Hiện trạng |
|---|---|
| Runtime | Một Cloudflare Worker `vnxsi-web` (ADR-001), `run_worker_first: true`, static assets fallback |
| Framework | Hono 4 + JSX SSR. Không có SPA, không có JS phía client, CSS thuần có token sáng/tối |
| Routing | `onLocalized()` đăng ký mỗi route cho 4 tiền tố locale (`/`, `/vi`, `/zh-hans`, `/zh-hant`, ADR-003) |
| Kiến trúc trong code | `routes/` → `domain/` (hàm thuần, state machine) + `db/` (SQL theo bảng) → `views/` (JSX, không gọi DB). Luật phụ thuộc và **luật sở hữu bảng** được kiểm bằng `test/architecture.test.ts` |
| Xác thực | Magic link + cookie `__Host-vnx_session` (ADR-002); `requireUser` / `requireBuilder` / `requireAdmin`; admin theo `ADMIN_EMAILS` |
| Bảo vệ | Origin check cho mọi request thay đổi dữ liệu; rate limit bằng bảng D1; `safeNext` chặn open redirect; link ra ngoài `rel="nofollow ugc noopener"` |
| Dữ liệu | D1 (SQLite), SQL thuần, không ORM, zod ở biên. R2 `vnxsi-media` cho ảnh (bucket chưa tạo, VNX-0307) |
| Email | Port `Mailer`: Resend / fake / console |
| Background job | **Chưa có**. `index.ts` chỉ export `fetch`; cron dự kiến ở M5 (hằng ngày) và M7 (hằng giờ) |
| Test | Vitest trong workerd, D1 thật ở local; 323 test (M3) |
| Quan sát | Workers observability, log JSON khi lỗi, `audit_log` |

## 2. Tính năng marketplace đã có

| Tính năng | Trạng thái | Ở đâu |
|---|---|---|
| Đăng nhập magic link, session, khóa user | ✅ M1 | `routes/auth.tsx`, `auth/*` |
| Builder: đăng ký, invite, hồ sơ, portfolio, trang `/b/:handle` | ✅ M2 | `routes/hub*.tsx`, `routes/builder-profile.tsx` |
| Product: editor 8 bước, pricing ≤ 5 tier, ảnh R2, vòng đời, huy hiệu | ✅ M3 | `routes/hub-products.tsx`, `domain/product.ts` |
| Trang product `/p/:slug` | ✅ M3 | `routes/product-page.tsx`, `views/ProductPage.tsx` |
| Admin: duyệt builder/product, invite, khóa, huy hiệu | ✅ M2–M3 | `routes/admin*.tsx` |
| Tìm kiếm, catalogue `/products`, danh bạ `/builders` | ⏳ M4 | — |
| Inquiry (Buy / Customize / Hire / Build Similar) | ⏳ M5 | — |
| Post a request + admin ghép builder | ⏳ M6 | — |
| Lượt xem, demo click, trending, homepage mới | ⏳ M7 | — |
| Thanh toán, order, review | 💤 Wave 3 | — |

Category hiện là danh sách cố định theo **ngành** (`booking`, `crm`, `ecommerce`, `finance`, `hr`, `education`, `internal_tools`, `ai_agents`, `other`), không phải theo loại công cụ như prompt (`ai-tools/writing`, `developer-tools`…).

## 3. SEO hiện có

| Hạng mục | Trạng thái |
|---|---|
| `<title>`, meta description, canonical | ✅ `views/Layout.tsx` |
| hreflang 4 locale + `x-default` | ✅ mọi trang dùng Layout |
| Open Graph (title, url, description, image) | ✅; `og:type` luôn là `website` |
| JSON-LD `SoftwareApplication` (offers từ tier có giá, không `aggregateRating`) | ✅ `views/json-ld.ts`, đã escape |
| `noindex` cho Hub/Admin | ✅ |
| `sitemap.xml`, `robots.txt` | ❌ chưa có (VNX-0404, M4). Owner đã quyết `Allow: /media/products/` |
| Canonical theo `APP_ORIGIN` | ❌ đang lấy origin từ request (nghĩa vụ M4) |
| BreadcrumbList, Article | ❌ |

Ghi nhận cho M4: nội dung product chỉ có một ngôn ngữ (`primary_lang`), nhưng trang được render ở cả 4 locale với hreflang. Bốn URL gần như trùng nội dung. Rủi ro này có sẵn, không do monetization gây ra; xem thêm mục 16.

## 4. Analytics hiện có

- **Không có** analytics trong code, không có script bên thứ ba (landing cũ cũng không có).
- Đã thiết kế nhưng chưa làm (M7): `product_daily_stats` (`views`, `demo_clicks`, `inquiries` theo ngày, lọc bot / chủ product / admin, cookie ẩn danh), `public_stats` tính mỗi giờ, route chuyển hướng `/p/:slug/demo`.
- Backlog VNX-1303 (Wave 2): đo phễu, **"không dùng tracker bên thứ ba"**.

## 5. Thanh toán và doanh thu hiện có

- **Không có gì trong code.** Spec §4: "Thanh toán: không có ở dự án 1".
- Đã thiết kế cho Wave 3, chưa tạo bảng: `orders`, `payments` / `payouts` (ledger, ghi rõ phí platform), `projects`, `proposals`, `milestones`, `reviews`.
- Chiến lược mục 16: commission theo giao dịch (khoảng 15%), "không thu listing fee giai đoạn đầu".
- Blocker đã ghi: pháp nhân và cổng thanh toán (EPIC 14, VNX-1401/1402).

## 6. Thực thể database hiện có

| Nhóm | Bảng (migration) | Module sở hữu |
|---|---|---|
| Cũ | `waitlist` (0001, 0002) | — |
| Danh tính | `users`, `login_tokens`, `sessions`, `rate_limits`, `audit_log` (0003) | identity |
| Builder | `builders`, `portfolio_items`, `invites` (0004) | builder |
| Catalog | `products`, `pricing_tiers`, `product_media`, `product_verifications` (0005) | catalog |
| Đã thiết kế, chưa tạo | `products_fts` (M4), `inquiries`, `inquiry_messages` (M5), `requests`, `request_invites` (M6), `product_daily_stats`, `public_stats` (M7) | catalog, engagement, matching, insights |

**Đối chiếu thực thể trong prompt với hiện trạng:**

| Prompt | Đã có / sẽ có | Đề xuất |
|---|---|---|
| Product / App / AI Tool / SaaS | `products` (của builder) | Giữ nguyên. Listing bên thứ ba theo Q1 |
| Category | hằng trong code | Giữ; trang SEO category dùng lại (mục 11) |
| User / Builder | `users`, `builders` | Giữ |
| Lead, LeadRequest, LeadAssignment | `requests`, `request_invites` (M6) | Dùng lại, không tạo bảng mới (mục 7.6) |
| Review (đánh giá của người dùng) | `reviews` (Wave 3) | Không đụng. Bài review biên tập là `articles.type = 'review'` |
| Event analytics | `product_daily_stats` (M7) | Mở rộng (mục 12) |
| Merchant, Program, Offer, Link, Click, Conversion, Commission, Revenue | không có | Bảng mới, gộp bớt (mục 12) |
| AdProvider, AdPlacement, AdCampaign… | không có | Chưa tạo (Q6) |

---

## 7. Kiến trúc Monetization đề xuất

### 7.1 Vị trí trong module map

Thêm hai module, theo đúng luật "module sở hữu bảng" của `02-MODULE-MAP.md`:

```
 catalog ──(chỉ đọc product)──► monetization ──► insights (đọc click, conversion để báo cáo)
    ▲                              │
    │       KHÔNG BAO GIỜ          │  merchants, partner_programs, offers,
    └──── catalog đọc ngược ───────┘  outbound_clicks, conversions, revenue_entries, feature_flags
 content ──(chỉ đọc product, offer)──► articles, article_links
```

| Module | Trách nhiệm | Sở hữu bảng |
|---|---|---|
| `monetization` | Merchant, chương trình partner, offer, `/go/`, click, conversion, ledger doanh thu, cờ tính năng | `merchants`, `partner_programs`, `offers`, `outbound_clicks`, `conversions`, `revenue_entries`, `feature_flags` |
| `content` | Bài biên tập, liên kết nội bộ, quy trình duyệt | `articles`, `article_links` |

### 7.2 Luật bất biến (đưa vào ADR-007, kiểm bằng test kiến trúc)

1. **Ranking không đọc tiền.** Code xếp hạng (`catalog` search, danh bạ, trending, top, matching, đầu vào AI) không import `db/offers`, `db/conversions`, `db/revenue` và không có SQL tham chiếu các bảng đó. Mở rộng `test/architecture.test.ts`.
2. **Product độc lập với monetization.** `products` không thêm cột nào về tiền. Offer trỏ tới product, product không biết offer.
3. **Không có tên partner trong code.** Không có `if (merchant === 'cloudflare')`. Mọi khác biệt giữa các partner nằm ở dữ liệu (`partner_programs`, `offers.tracking_template`) hoặc trong một adapter chung.
4. **Không có số hoa hồng mặc định.** Mọi điều khoản do admin nhập từ hợp đồng thật, cột cho phép `NULL`, kèm `terms_url` và `terms_verified_at`.
5. **Không có conversion nếu partner chưa xác nhận.** Click không bao giờ được tính là doanh thu. Báo cáo chỉ cộng conversion `approved` trở lên.
6. **Công khai quan hệ.** Trang nào có offer kiếm tiền thì phải có disclosure, link dùng `rel="sponsored"`.

### 7.3 Port provider

```ts
// monetization/providers/port.ts
interface PartnerProvider {
  kind: "generic_template" | "manual";        // không có "cloudflare"
  buildDestination(offer, click): URL;         // điền {click_id}, {utm_*} vào template, đã validate
  verifyPostback?(req, program, secret): Promise<ConversionInput | null>; // HMAC + cửa sổ thời gian
  parseReport?(csv, program): ConversionInput[];                          // nhập báo cáo
}
```

Một adapter `generic_template` đủ cho phần lớn mạng affiliate (tracking URL + sub-id). Adapter riêng chỉ thêm khi một mạng có định dạng postback riêng, và đặt tên theo **mạng** (giao thức), không theo merchant.

### 7.4 Cờ tính năng

Bảng `feature_flags` (`key`, `enabled`, `updated_by`, `updated_at`), admin bật/tắt ở `/admin/flags`, mỗi lần đổi ghi `audit_log`. Không có dòng thì coi là **tắt**. Các key: `affiliate`, `partner_referral`, `ads`, `featured_listings`, `sponsored_listings`, `lead_generation`, `ai_content`, `content_indexing`. Đọc qua một hàm có cache trong isolate khoảng 60 giây.

### 7.5 Paid placement (chỉ khi Owner chọn Q2-b)

- Ô **"Sponsored"** là một khối riêng, nằm ngoài danh sách xếp hạng: tối đa N ô (Owner chốt), có nhãn rõ ở 4 locale, có link giải thích.
- Danh sách organic giữ nguyên thứ tự ADR-004. Product được tài trợ vẫn xuất hiện ở vị trí organic của nó; không ẩn, không đẩy lên.
- Không có `PromotionScore` trong truy vấn xếp hạng. Test khẳng định thứ tự organic không đổi khi bật hoặc tắt sponsored.
- Builder xin tài trợ, admin duyệt (có từ chối được), có ngày bắt đầu và kết thúc. Thu tiền cần cổng thanh toán (Wave 3); trước đó chỉ có thể là hợp đồng thủ công, ghi vào `revenue_entries` với `source_type = 'sponsored'`.
- "Featured" do platform chọn theo tiêu chí công bố (ví dụ "huy hiệu mới được xác minh") **không phải** paid placement. Đặt tên khác đi để không lẫn với gói trả tiền.

### 7.6 Lead generation

Dùng lại luồng M6: `requests` = LeadRequest, `request_invites` = LeadAssignment. Trạng thái prompt đề xuất ánh xạ như sau: NEW → `submitted`, MATCHED → `matching`, CONTACTED → invite `proposed`, CONVERTED → `builder_selected`, CLOSED → `closed` / `expired`. Riêng QUALIFIED là bước admin đọc request, đã nằm trong hàng chờ. Không có bảng mới. Thu phí lead (nếu có) là quyết định Wave 3.

## 8. Kiến trúc Affiliate / Partner đề xuất

```
merchants (Cloudflare, công ty SaaS…)
   └── partner_programs (1..n / merchant)   type: affiliate | referral | revenue_share | direct
          └── offers (1..n)                  trỏ tới: product | merchant | article
                 └── outbound_clicks          mỗi lượt qua /go/
                        └── conversions        chỉ khi partner xác nhận (manual / CSV / postback)
                               └── revenue_entries (ledger, append-only)
```

- **Affiliate truyền thống và partner referral dùng chung mô hình**, phân biệt bằng `partner_programs.type` và `commission_model`. Không giả định mọi partner trả theo % đơn hàng.
- **Một product có nhiều offer**: `official` (website), `demo`, `trial`, `affiliate`, `referral`, `sponsored`. Offer `official` và `demo` không kiếm tiền nhưng vẫn đi qua `/go/` để đo outbound click. Khi đó số liệu của builder (M7) và của affiliate dùng cùng một đường đo.
- **Conversion ở giai đoạn đầu:** admin nhập tay hoặc import CSV báo cáo của partner. Postback/webhook chỉ làm khi partner thật hỗ trợ và có secret riêng.
- **Disclosure:** trang nào render ít nhất một offer có `program_id` (offer kiếm tiền) thì hiện câu disclosure cạnh khối offer, cộng link tới `/disclosure` (4 locale). Prompt muốn cấu hình disclosure theo quốc gia / merchant / loại trang. Reviewer khuyên **luôn hiện** ở mọi quốc gia: đơn giản hơn và an toàn pháp lý hơn. Chỉ cấu hình nội dung câu theo locale.

## 9. Điểm tích hợp Cloudflare

Cloudflare chỉ là **dữ liệu**: 1 dòng `merchants`, 1+ dòng `partner_programs`, n dòng `offers`. Không có code riêng cho Cloudflare.

Chỗ hiển thị tự nhiên, không làm hỏng UX marketplace:

| Vị trí | Đối tượng xem | Ghi chú |
|---|---|---|
| `/tools/cloudflare` (nếu Q1-b) | Client, builder | Trang biên tập: Cloudflare dùng để làm gì, VNX.SI chạy trên Cloudflare (sự thật, nói được). Nút **Learn more** (official) và **Get started** (offer partner nếu có) |
| Guide "Deploy your AI-built app" | Builder, client tự host | Nội dung thật, so sánh nhiều nhà cung cấp, không chỉ một |
| Builder Hub, gợi ý hạ tầng | Builder | Không ảnh hưởng xếp hạng product |
| Chip tech stack trên `/p/:slug` | Client | Tùy chọn. Chỉ là link tới `/tools/cloudflare`, không phải link affiliate trực tiếp |

Luồng: `GET /go/<offerId>` → tra offer → kiểm `active`, cờ `affiliate`/`partner_referral`, host đích → tạo `click_id` → ghi click (`waitUntil`) → điền template → `302` tới URL referral của Cloudflare.

**Owner cần tự xác minh**: Cloudflare hiện có chương trình partner/referral nào mà VNX.SI tham gia được, điều khoản thực tế, cách báo conversion và cách payout. Reviewer không giả định bất kỳ con số hay cơ chế nào.

## 10. Kiến trúc quảng cáo

Khuyên **chỉ viết ADR, chưa code** (Q6). Khi có traffic thì làm:

- Registry vị trí đặt trong code (`article_inline`, `article_sidebar`, `guide_footer`, `comparison_footer`…), mỗi vị trí gắn với **loại trang**. Mặc định không có vị trí nào trên `/p/:slug`, kết quả tìm kiếm, Hub, `/me`, form Inquiry/request, trang admin.
- Port `AdProvider` (`renderSlot(placement) → HTML`, `scriptOrigins()` để dựng CSP). Có hai bản cài: `direct` (creative do admin tải lên, render như ảnh tĩnh) và `adsense`.
- Lazy-load qua `IntersectionObserver`, chiếm chỗ cố định để tránh CLS.
- AdSense kéo theo: script bên thứ ba, cookie, **banner đồng ý** cho người dùng EU/UK, CSP nới ra. Trái với "không tracker bên thứ ba" (Q5). Cần Owner chấp nhận đánh đổi này trong ADR.

## 11. Kiến trúc nội dung

| Loại | URL (mọi locale có tiền tố) | Điều kiện được index (Owner chốt ngưỡng, Q9) |
|---|---|---|
| `guide` | `/guides/:slug` | Do người viết hoặc duyệt, đủ độ dài |
| `review` | `/reviews/:slug` | Có tác giả thật đã dùng thử; **không** `aggregateRating`, không sao |
| `comparison` | `/compare/:slug` | ≥ 2 product, có bảng so sánh lấy từ dữ liệu thật |
| `alternatives` | `/alternatives/:productSlug` | Đủ số product thay thế cùng category |
| `best_list` | `/best/:slug` | Đủ số product |
| `category_guide` | `/products/c/:category` (trang SEO category) | Đủ số product published trong category |

- Bảng `articles` có state machine `draft → in_review → published → archived`. Thêm cờ `indexable` riêng: một bài có thể đã publish nhưng vẫn `noindex` khi chưa đạt ngưỡng.
- `article_links` (`article_id`, `target_type` product/merchant/article, `target_id`, `role` subject/compared/alternative/mentioned, `sort`) tạo **đồ thị liên kết nội bộ**: trang product hiện "Được nhắc trong", trang bài hiện product liên quan.
- Mỗi bài có **một locale**. Bài chỉ được phát ở URL của locale đó; hreflang chỉ liệt kê bản dịch thật sự tồn tại. Layout hiện tại luôn phát 4 alternate, nên cần một tham số cho việc này.
- Pipeline AI (prompt mục 19) là Wave 2: AI nháp → kiểm chất lượng → admin duyệt → publish. Phụ thuộc ADR-005/006 (đang Proposed). Không bao giờ tự publish.

## 12. Thay đổi database đề xuất

Một migration cho mỗi phase, chỉ thêm bảng, không sửa bảng cũ. Số migration tùy thứ tự so với M5–M7 (dự kiến sau `0005`).

**Phase 1 (`00NN_monetization_foundation.sql`)**

```sql
CREATE TABLE feature_flags (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  updated_by TEXT REFERENCES users (id), updated_at TEXT NOT NULL);

CREATE TABLE offers (
  id                TEXT PRIMARY KEY,                       -- ULID, cũng là khóa trong /go/:id
  program_id        TEXT REFERENCES partner_programs (id),  -- NULL = không kiếm tiền (official/demo)
  subject_type      TEXT NOT NULL CHECK (subject_type IN ('product','merchant','article')),
  subject_id        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('official','demo','trial','affiliate','referral','sponsored')),
  destination_url   TEXT NOT NULL,                          -- https, đã validate lúc ghi
  tracking_template TEXT,                                   -- chỉ chấp nhận placeholder trong whitelist
  allowed_host      TEXT NOT NULL,                          -- host đích phải khớp lúc redirect
  status            TEXT NOT NULL CHECK (status IN ('active','paused','archived')),
  starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX idx_offers_subject ON offers (subject_type, subject_id, status);

CREATE TABLE outbound_clicks (
  id            TEXT PRIMARY KEY,          -- click_id gửi cho partner
  offer_id      TEXT NOT NULL REFERENCES offers (id),
  placement     TEXT NOT NULL,             -- enum trong code
  page_type     TEXT NOT NULL,
  locale        TEXT NOT NULL,
  visitor_hash  TEXT,                      -- HMAC(cookie ẩn danh, salt xoay theo ngày); không lưu IP
  country       TEXT,                      -- request.cf.country
  referrer_host TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  is_bot        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL);
CREATE INDEX idx_clicks_offer_time ON outbound_clicks (offer_id, created_at);
```

Offer `official`/`demo` của product được tạo từ `products.website_url` / `demo_url`. Có hai cách: (a) đồng bộ khi builder sửa product; (b) không lưu thành offer, `/go/` nhận id product kèm kind. Reviewer khuyên (b) cho Phase 1 để không nhân đôi dữ liệu catalog, và sẽ chốt trong plan.

**Phase 2 (`00NN_partners.sql`)**

```sql
CREATE TABLE merchants (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  website_url TEXT NOT NULL, allowed_hosts TEXT NOT NULL DEFAULT '[]', logo_key TEXT,
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK (status IN ('active','paused','archived')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE partner_programs (id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants (id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('affiliate','referral','revenue_share','direct')),
  network TEXT,                                  -- tên mạng, văn bản tự do
  provider TEXT NOT NULL CHECK (provider IN ('generic_template','manual')),
  commission_model TEXT CHECK (commission_model IS NULL OR commission_model IN ('percent','flat','tiered','custom')),
  commission_rate_bps INTEGER, commission_flat_minor INTEGER, currency TEXT,  -- NULL = chưa biết; không có mặc định
  cookie_days INTEGER, attribution_notes TEXT NOT NULL DEFAULT '',
  terms_url TEXT, terms_verified_at TEXT, webhook_secret_name TEXT,          -- tên secret trong wrangler, không phải giá trị
  status TEXT NOT NULL CHECK (status IN ('draft','active','paused','ended')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE conversions (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES partner_programs (id),
  click_id TEXT REFERENCES outbound_clicks (id), external_ref TEXT NOT NULL,
  order_amount_minor INTEGER, commission_minor INTEGER NOT NULL, currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','reversed','paid')),
  source TEXT NOT NULL CHECK (source IN ('manual','csv','postback')),
  reported_at TEXT NOT NULL, confirmed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (program_id, external_ref));             -- chống conversion trùng

CREATE TABLE revenue_entries (id TEXT PRIMARY KEY,   -- append-only; đảo chiều = dòng âm mới
  source_type TEXT NOT NULL CHECK (source_type IN ('affiliate','referral','ads','sponsored','lead')),
  source_id TEXT NOT NULL, merchant_id TEXT, product_id TEXT,
  gross_minor INTEGER NOT NULL, net_minor INTEGER NOT NULL, currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','received','reversed')),
  occurred_on TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL);
CREATE INDEX idx_revenue_source ON revenue_entries (source_type, occurred_on);
```

Khác với danh sách trong prompt:
- `AffiliateOffer`, `AffiliateLink`, `TrackingLink` gộp thành `offers`. Một offer là một đích đến; tracking code chính là `click_id` sinh mỗi lượt click.
- `Commission` gộp vào `conversions`.
- Tiền lưu dạng **minor unit + `currency`**. Spec quy định chưa quy đổi tiền tệ, nên báo cáo cộng riêng theo từng loại tiền.

**Phase 3 (`00NN_content.sql`):** `articles` (`id`, `type`, `slug`, `locale`, `title`, `summary`, `body`, `status`, `indexable`, `seo_title`, `seo_description`, `author_user_id`, `reviewed_by`, `ai_assisted`, `published_at`, …; unique `(locale, type, slug)`), `article_links`.

**Analytics:** thêm cột `outbound_clicks` vào `product_daily_stats` ngay khi tạo bảng ở M7 (bảng chưa tồn tại nên chưa cần migration sửa). Sự kiện SEARCH, CONTENT_VIEW… cộng vào bảng `daily_metrics` (`day`, `metric`, `dimension`, `value`; PK 3 cột). Không ghi log thô cho từng pageview vào D1. Workers Analytics Engine sẽ tốt hơn khi traffic lớn, nhưng đó là binding mới, phải sửa ADR-001.

## 13. Thay đổi API / route đề xuất

Dự án không có JSON API; mọi thứ là SSR + form POST. Route mới:

| Route | Phase | Ghi chú |
|---|---|---|
| `GET /go/:offerId` | 1 | Không có tiền tố locale; `noindex`, `no-store`; query chỉ nhận `p` (placement, enum) và `utm_*` (regex), không bao giờ nhận URL |
| `GET /disclosure` (×4 locale) | 1 | |
| `GET/POST /admin/flags` | 1 | |
| `/admin/merchants[/:id]`, `/admin/programs/:id`, `/admin/offers[/:id]` | 2 | CRUD, validate host |
| `/admin/conversions` (+ `POST …/import`) | 2 | Nhập tay / CSV |
| `/admin/revenue` | 2 | Theo nguồn, merchant, product, category, ngày, tiền tệ |
| `POST /webhooks/partners/:programId` | 2 (tùy partner) | HMAC, idempotent, không cần session, rate limit |
| `/tools/:merchantSlug` | 2 (nếu Q1-b) | |
| `/guides/:slug`, `/reviews/:slug`, `/compare/:slug`, `/alternatives/:productSlug`, `/best/:slug`, `/products/c/:category` | 3 | |
| `/admin/content…` | 3 | Hàng chờ nháp → duyệt → publish |
| `/hub/products/:id/stats` | sau M7 | Builder chỉ thấy số của product mình; không có doanh thu platform |
| `/hub/promotions` | 5 (nếu Q2-b) | |

## 14. Thay đổi frontend đề xuất

- `ProductPage.tsx`: link demo/website đi qua `/go/`; khối "Offers" (nếu có) và disclosure; link monetized dùng `rel="sponsored noopener"`, link builder giữ `nofollow ugc noopener`.
- `Layout.tsx`: tham số `alternates` (chỉ các bản dịch có thật), `og:type` = `article` cho bài, slot JSON-LD nhận mảng (BreadcrumbList + Article).
- `json-ld.ts`: thêm `breadcrumbJsonLd`, `articleJsonLd`. Không bao giờ thêm `aggregateRating` / `Review` khi chưa có review thật.
- Admin: thêm nhóm menu Monetization / Content / Revenue / Flags trong `AdminLayout.tsx`.
- Component mới: `OfferBlock`, `Disclosure`, `SponsoredSlot` (Phase 5), `ArticlePage`, `RelatedLinks`.
- i18n: key mới ở cả 4 file locale (test parity bắt buộc).
- Vẫn không thêm framework JS. Script nhỏ duy nhất là lazy-load quảng cáo (Phase 4).

## 15. Rủi ro bảo mật

| Rủi ro | Biện pháp |
|---|---|
| Open redirect qua `/go/` | Tra **theo id**, không bao giờ đọc URL từ query; đích phải `https:`, host khớp `allowed_host` / `merchants.allowed_hosts`, kiểm cả lúc ghi lẫn lúc redirect; template chỉ có placeholder trong whitelist, giá trị được `encodeURIComponent`; chặn CR/LF |
| Admin nhập URL độc hại | Validate bằng zod (`https`, không có userinfo, không IP literal, không `localhost`), ghi `audit_log` |
| Click fraud, bot làm phồng số | Lọc UA/bot, `visitor_hash` chống đếm trùng (1 lần mỗi offer trong một cửa sổ, Owner chốt độ dài); click không bao giờ thành tiền |
| Conversion giả hoặc trùng | Chỉ nhận từ admin hoặc postback có HMAC + timestamp; `UNIQUE(program_id, external_ref)`; trạng thái chỉ đi tới, đảo chiều bằng dòng mới |
| Lộ secret webhook | Secret ở `wrangler secret`, DB chỉ lưu tên secret |
| Lộ dữ liệu doanh thu cho builder | Route Hub chỉ truy vấn theo `builder_id` của session; test 403/404 chéo builder |
| PII trong click | Không lưu IP, không lưu email; `visitor_hash` dùng salt xoay theo ngày; cập nhật `/privacy` |
| CSRF ở admin/webhook | Admin giữ origin check; webhook là đường duy nhất được miễn origin check, bù bằng HMAC |
| Quảng cáo bên thứ ba (Phase 4) | CSP liệt kê origin, sandbox iframe, không render quảng cáo ở trang đăng nhập/Hub/admin |

## 16. Rủi ro SEO

- **Nội dung mỏng / doorway:** trang alternatives/compare/best tự sinh hàng loạt. Biện pháp: chỉ admin tạo, có ngưỡng `indexable` (Q9), sitemap chỉ chứa trang `indexable`.
- **Trùng nội dung giữa 4 locale:** đã có sẵn ở `/p/:slug`. Với bài viết, chỉ phát ở locale thật. Với product, cân nhắc canonical về locale `primary_lang` (đề xuất, cần quyết ở M4).
- **Link affiliate không gắn nhãn:** bắt buộc `rel="sponsored"`, chặn `/go/` trong `robots.txt` + `X-Robots-Tag: noindex`.
- **Schema sai:** không `aggregateRating`, không `Review` khi không có tác giả thật; `Product` chỉ khi có offer giá thật.
- **Quảng cáo làm chậm trang / tăng CLS:** ảnh hưởng Core Web Vitals; lazy-load và giữ chỗ cố định.
- **Category rỗng:** trang category dưới ngưỡng thì `noindex` và không vào sitemap.

## 17. Rủi ro hiệu năng

| Điểm | Rủi ro | Biện pháp |
|---|---|---|
| `/go/` | Thêm một vòng D1 trước khi redirect | Một truy vấn theo PK; cache offer trong isolate (TTL ngắn); ghi click bằng `executionCtx.waitUntil` sau khi đã có `click_id` |
| Trang product | Thêm truy vấn offer + link nội dung | Gộp vào `Promise.all` đang có; index `(subject_type, subject_id, status)` |
| Đếm event | Ghi D1 mỗi lượt xem | Cộng dồn theo ngày (UPSERT), chạy trong `waitUntil`; không lưu log thô theo pageview |
| Báo cáo doanh thu | Truy vấn tổng hợp lớn | Bảng tổng hợp do cron tính (giống `public_stats`) |
| Quảng cáo | Script ngoài chặn render | Chỉ ở trang nội dung, lazy, không trên đường render chính |
| Cờ tính năng | Mỗi request đọc D1 | Cache trong isolate khoảng 60 giây |

## 18. Các phase triển khai

Thứ tự đã khớp với Wave 1. Mỗi phase vẫn theo quy trình plan → duyệt → handoff → review.

| Phase | Nội dung | Phụ thuộc | Khi nào (theo khuyến nghị Q3-b) |
|---|---|---|---|
| **0. Quyết định** | ADR-007 Monetization & disclosure (gồm luật 7.2); ADR-008 Sponsored (nếu Q2-b, thay một phần ADR-004); phụ lục spec; cập nhật module map, domain catalog, charter, master backlog (EPIC mới) | Owner trả lời mục 0 | Ngay, trước M4 |
| **1. Nền** | `feature_flags` + `/admin/flags`; `/go/` + `outbound_clicks` cho link demo/website; `product_daily_stats.outbound_clicks`; `robots.txt` chặn `/go/`; trang `/disclosure` | M4 (robots), gộp vào M7 thay cho VNX-0701 `/p/:slug/demo` | M7 |
| **2. Affiliate / Partner** | merchants, programs, offers kiếm tiền, provider port, conversion nhập tay/CSV, ledger, báo cáo admin; webhook khi partner hỗ trợ; `/tools/:merchant` (Q1-b) | Phase 1; Q4 (pháp nhân) trước khi bật production | Sau cổng ra Wave 1, hoặc sớm hơn khi có hợp đồng partner thật |
| **3. Nội dung** | `articles`, editor admin, hàng chờ duyệt, các route loại bài, JSON-LD Article/Breadcrumb, đồ thị liên kết, trang category SEO | M4 (sitemap); trùng EPIC 13 (VNX-1301/1302) | Wave 2 |
| **4. Quảng cáo** | ADR trước; registry vị trí, `AdProvider`, lazy slot, CSP, banner đồng ý cookie nếu dùng AdSense | Có traffic thật; Q5, Q6 | Khi traffic đủ (Owner đặt ngưỡng) |
| **5. Featured / Sponsored** | Theo ADR-008: ô tách riêng, builder xin, admin duyệt, test thứ tự organic không đổi | ADR-008; thanh toán (EPIC 14) hoặc hợp đồng tay | Sau Wave 1 |
| **6. Lead** | Dùng lại M6; thêm `revenue_entries` loại `lead` chỉ khi có phí | M6, Q7 | Wave 3 nếu thu phí |
| **7. Tự động hóa AI** | AI nháp bài, gợi ý liên kết nội bộ, moderation | EPIC 9 (ADR-005/006 Accepted) | Wave 2 |

## 19. File cần thay đổi

**Tài liệu (Reviewer viết, Phase 0)**
- Mới: `docs/adr/ADR-007-monetization.md`, `docs/adr/ADR-008-sponsored-placement.md` (nếu Q2-b), phụ lục spec monetization trong `docs/superpowers/specs/`.
- Sửa: `docs/adr/README.md`, `docs/adr/ADR-004-neutral-ranking.md` (chỉ thêm dòng "bổ sung bởi ADR-008" nếu có, không sửa nội dung), `docs/blueprint/01-PRODUCT-CHARTER.md` (mục "Ngoài phạm vi"), `02-MODULE-MAP.md`, `03-DOMAIN-CATALOG.md`, `07-MASTER-BACKLOG.md`, `docs/architecture/ARCHITECTURE.md` (§2, §4, §6), `docs/roadmap/WAVE1-ROADMAP.md` (M7: VNX-0701 dùng `/go/`), `.ai/context/CURRENT-STATUS.md`.

**Code hiện có sẽ sửa (Implementer)**

| File | Phase | Thay đổi |
|---|---|---|
| `apps/web/src/app.ts` | 1–3 | Đăng ký route mới |
| `apps/web/src/env.ts` | 1–2 | Kiểu cho `executionCtx`, tên secret webhook |
| `apps/web/wrangler.jsonc` | 2 | Ghi chú secret partner |
| `apps/web/src/views/ProductPage.tsx` | 1–2 | Link qua `/go/`, khối offer, disclosure |
| `apps/web/src/routes/product-page.tsx` | 1–2 | Tải offer, đếm view (M7) |
| `apps/web/src/views/Layout.tsx` | 3 | Tham số alternates, `og:type`, JSON-LD dạng mảng |
| `apps/web/src/views/json-ld.ts` | 3 | Breadcrumb, Article |
| `apps/web/src/views/admin/AdminLayout.tsx` | 1–3 | Menu |
| `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` | 1–3 | Key mới |
| `apps/web/test/architecture.test.ts` | 1 | Bản đồ sở hữu bảng mới; luật "ranking không import monetization" |
| `apps/web/src/domain/builder-input.ts` | 1 | Thêm `go`, `tools`, `guides` vào danh sách handle dành riêng (phòng xa) |

**File mới (Implementer)**
- Phase 1: `migrations/00NN_monetization_foundation.sql`, `src/domain/offer.ts` (validate đích, template), `src/db/flags.ts`, `src/db/offers.ts`, `src/db/clicks.ts`, `src/monetization/flags.ts`, `src/routes/go.ts`, `src/routes/admin-flags.tsx`, `src/views/Disclosure.tsx`, `src/views/admin/FlagsPage.tsx`, test tương ứng (`test/monetization/go.test.ts` gồm các ca open redirect).
- Phase 2: `migrations/00NN_partners.sql`, `src/domain/partner.ts`, `src/domain/conversion.ts` (state machine), `src/db/merchants.ts`, `src/db/programs.ts`, `src/db/conversions.ts`, `src/db/revenue.ts`, `src/monetization/providers/{port,generic-template,manual}.ts`, `src/routes/admin-merchants.tsx`, `src/routes/admin-revenue.tsx`, `src/routes/partner-webhooks.ts`, `src/routes/tools.tsx`, view admin tương ứng, test.
- Phase 3: `migrations/00NN_content.sql`, `src/domain/article.ts`, `src/db/articles.ts`, `src/routes/content-pages.tsx`, `src/routes/admin-content.tsx`, `src/views/ArticlePage.tsx`, `src/views/RelatedLinks.tsx`, test.

## 20. Ước lượng độ phức tạp

Mỗi task ≤ 1 ngày theo quy ước roadmap.

| Phase | Độ phức tạp | Số task ước lượng | Rủi ro chính |
|---|---|---|---|
| 0. Quyết định (tài liệu) | S | 3–4 (Reviewer) | Owner chưa quyết Q1/Q2 |
| 1. Nền | M | 5–6 | Open redirect; gộp với M7 cần Owner duyệt sai khác roadmap |
| 2. Affiliate / Partner | L | 9–11 | Pháp nhân nhận tiền (Q4); định dạng báo cáo của từng partner |
| 3. Nội dung | L | 8–10 | Chất lượng nội dung; trùng locale; ai viết |
| 4. Quảng cáo | M | 4–6 | Đồng ý cookie, CSP, Core Web Vitals |
| 5. Featured / Sponsored | M (kỹ thuật) + XL (thanh toán) | 5–6 + EPIC 14 | Niềm tin client; ADR-004 |
| 6. Lead | S | 1–2 trên nền M6 | Mô hình phí |
| 7. AI | L–XL | theo EPIC 9–12 | ADR-005/006 chưa Accepted |

---

**Bước tiếp theo:** Owner trả lời Q1–Q9. Reviewer sẽ viết ADR-007 (và ADR-008 nếu chọn) cùng phụ lục spec, rồi plan Phase 1 theo `.ai/templates/PLAN-TEMPLATE.md`. Chưa sửa code production.
