# VNX.SI Marketplace — Wave 1 (Supply) Design Spec

- **Ngày:** 2026-10-03
- **Trạng thái:** Draft, chờ review
- **Phạm vi:** `apps/web` (Worker `vnxsi-web`, D1 `vnxsi`), thay landing hiện tại
- **Thay thế:** [spec v0.1](2026-10-02-vnx-v0.1-design.md) và [plan review/cost](../../plan/2026-10-02-vnx-review-cost-rollout.md) (cả hai: Superseded)
- **Chiến lược gốc:** [Marketplace OS v1](../../strategy/2026-10-03-marketplace-os-v1.md)

---

## 1. Định vị

**The marketplace for AI-built products and the people who build them.**

- Client: *Have an idea? Find a product, customize one, or build your own.*
- Builder: *Build once. Sell many times. Get hired to customize.*

Ba bên: Client, Builder, Product (cộng Project ở Wave 3). Mỗi Product mở ra 4 giao dịch: **Buy, Customize, Hire Builder, Build Similar**.

Nguyên tắc giữ từ chiến lược:

- **Model-agnostic.** Builder dùng tool AI nào cũng được. VNX.SI chỉ quan tâm: có giao được product không.
- **Ranking không bán.** Không trả tiền để lên top. Nếu sau này có sponsored thì tách nhãn rõ ràng.
- **Trust minh bạch.** Huy hiệu nào hiển thị thì platform phải thực sự kiểm được.
- **Nội dung trung thực.** Không bịa số user, rating, testimonial, logo.

Quyết định pivot: vnx.si bỏ hướng "VNX — AI execution layer cho developer" (spec v0.1). Agent runtime chỉ quay lại sau khi marketplace có liquidity (chiến lược mục 23).

## 2. Phân rã dự án con

| # | Dự án con | Nội dung | Điều kiện sang bước sau |
|---|---|---|---|
| **1** | **Supply (Wave 1), spec này** | Landing mới, tài khoản, Builder Profile, Product, catalogue, danh bạ builder, Inquiry, Post a request (admin ghép thủ công), Admin duyệt | ~100 product published |
| 2 | Demand (Wave 2) | "Describe your idea" → AI phân tích yêu cầu → 3 phương án + ước giá; AI matching thay cho bước admin ghép thủ công (học từ dữ liệu request của Wave 1); SEO content | Có lead thật |
| 3 | Transaction (Wave 3) | Project, Proposal, Milestone, Order, thanh toán/escrow, doanh thu trong Builder Hub, review | Có giao dịch thật |
| 4 | Sau này | Maintenance, Request a Product, Product Opportunity, AI build agents | — |

Data model và state machine của Wave 3 được thiết kế ở đây (mục 6.2, 7.4) để dữ liệu Wave 1 nối thẳng sang mà không phải migrate lại. Chỉ code những gì dự án 1 cần.

## 3. Mục tiêu và thước đo dự án 1

Mục tiêu: có khoảng 100 product thật, đã kiểm duyệt, do builder được mời đưa lên, trước khi kéo client.

Thước đo (đọc trực tiếp từ D1, hiển thị trong `/admin`):

- Số builder `approved`
- Số product `published`, phân theo huy hiệu
- Số Inquiry `open` trở lên, phân theo loại; tỷ lệ builder trả lời trong 3 ngày
- Số request được gửi; tỷ lệ request có ≥1 đề xuất; tỷ lệ request chọn được builder

## 4. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Thị trường | Việt Nam và global. Supply ban đầu từ cộng đồng dev Việt, builder không giới hạn quốc tịch |
| Ngôn ngữ | `en` (mặc định), `vi`, `zh-Hans`, `zh-Hant`. Không làm tiếng Hindi; thị trường Ấn Độ dùng `en` |
| Tài khoản | Đăng nhập magic link qua email, cho cả builder và client. Builder tự tạo/sửa Profile và Product |
| Inquiry | Đi qua platform. Client chưa có tài khoản chỉ cần email, hệ thống tạo tài khoản ngầm |
| Kết nối client–builder | 3 đường: (1) client tự tìm product hoặc builder rồi gửi Inquiry; (2) danh bạ builder có bộ lọc; (3) client đăng request, admin chọn tối đa 5 builder để mời, builder gửi đề xuất, client chọn một. Request không public |
| Loại product | `delivery_model`: `saas` / `source` / `service`. Nhiều pricing tier, cho phép giá liên hệ. `source` bắt buộc chọn license từ danh sách cố định |
| Trust layer | 3 huy hiệu: `listed`, `demo_verified`, `in_production`. Lưu thành bảng riêng để thêm loại mới không phải migrate |
| Stack | Hono + JSX render phía server trên Worker hiện tại, D1, R2, Resend, CSS thuần |
| Tiền tệ | Lưu và hiển thị USD (số nguyên cent). Chưa quy đổi tiền địa phương |
| Thanh toán | Không có ở dự án 1 |

## 5. Trang và luồng

### 5.1 Locale và URL

| Locale | Tiền tố URL | Ghi chú |
|---|---|---|
| `en` | `/` | Bản chuẩn; key chưa dịch ở locale khác thì hiện bản EN |
| `vi` | `/vi/` | |
| `zh-Hans` | `/zh-hans/` | Giản thể |
| `zh-Hant` | `/zh-hant/` | Phồn thể, dịch riêng (không chuyển tự động từ giản thể) |

- Mọi trang public có `<link rel="alternate" hreflang>` trỏ sang 3 bản còn lại và `x-default` về `en`.
- Không tự redirect theo `Accept-Language` (để crawler đọc ổn định). Nếu ngôn ngữ trình duyệt khác locale đang xem thì hiện banner gợi ý, có thể tắt.
- Hub, `/me`, `/admin` dùng cùng sơ đồ tiền tố, gắn `noindex`.
- Bản `vi` do Claude viết. Bản `zh-Hans`, `zh-Hant` dịch bằng AI và **phải có người bản xứ đọc lại trước khi quảng bá ở thị trường đó**.

### 5.2 Trang public

| Route (không tính tiền tố locale) | Nội dung |
|---|---|
| `/` | Homepage động, các khối theo thứ tự ở mục 5.9: hero kèm chồng thẻ product tự xoay và các con số đếm lên, dải hoạt động trực tiếp, Trending, Market pulse (2 chart), Top builders, Top products theo category, "4 ways", 3 huy hiệu, khối builder, CTA cuối (**Post a request** / **Find a builder**). Mọi số liệu lấy từ dữ liệu thật theo định nghĩa ở mục 8.11; khối nào chưa đủ dữ liệu thì ẩn hoặc thay bằng nội dung thay thế |
| `/products` | Catalogue. Tìm kiếm (mục 8.7), lọc: category, `delivery_model`, khoảng giá (theo tier rẻ nhất), huy hiệu, ngôn ngữ product. Phân trang 24 product/trang |
| `/p/:slug` | Product detail: ảnh, demo URL, tagline, problem, target users, mô tả, tính năng, tech stack, các pricing tier, license, tùy chọn customize, support, huy hiệu (kèm ngày xác minh), thẻ builder. 4 nút **Buy / Customize / Hire Builder / Build Similar**. Nút Customize ẩn nếu `customizable = false` |
| `/b/:handle` | Builder profile: tên, loại, headline, bio, quốc gia, kỹ năng, tool AI đang dùng, availability, giá theo giờ (nếu có), portfolio, các product published, nút **Hire** |
| `/builders` | Danh bạ builder: tìm theo tên, kỹ năng; lọc theo category (có product published), ngôn ngữ làm việc, quốc gia, availability. Chỉ builder `approved`. Xếp theo: availability `open` trước, rồi số product published, rồi mới tham gia. Có nút **Post a request** cho ai chưa tìm được người |
| `/for-builders` | Trang kêu gọi builder + nút đăng ký (CTA "Become a builder" trỏ về đây) |
| `/request` | Form **Post a request** (mục 5.7) |
| `/login` | Nhập email → gửi magic link |
| `/terms`, `/privacy` | Điều khoản và quyền riêng tư cơ bản |
| `/sitemap.xml`, `/robots.txt` | SEO (mục 8.8) |

Product hoặc builder không ở trạng thái công khai → 404 (không tiết lộ là tồn tại).

### 5.3 Builder Hub (`/hub`, cần đăng nhập)

- **Đăng ký builder** (`/hub/apply`): user đã đăng nhập nhưng chưa có bản ghi `builders` sẽ được đưa vào đây. Trường bắt buộc: handle, name, kind, headline, bio, country, ≥1 skill, availability. Nếu có invite hợp lệ thì vào thẳng `approved`; nếu không thì `pending`.
- **Invite link** có dạng `/join/:code`. Mở link → lưu code vào cookie `vnx_invite` (1 giờ) → nếu chưa đăng nhập thì sang `/login`. Khi xin magic link, code được gắn vào `login_tokens.invite_code_hash`, nên mở email trên thiết bị khác vẫn giữ được invite. Code chỉ bị trừ lượt (`invites.uses`) khi bản ghi builder được tạo; code hết hạn hoặc hết lượt → đăng ký bình thường vào `pending`, kèm thông báo.
- **Tổng quan:** trạng thái builder, số product theo trạng thái, số Inquiry `open`, số lời mời request đang chờ trả lời. Ô doanh thu ẩn đến Wave 3.
- **Hồ sơ:** sửa Builder Profile và portfolio (tối đa 12 mục).
- **Products:** danh sách + editor theo 9 bước: Product, Problem, Target users, Features, Demo, Pricing, Customization, License, Support. Lưu nháp bất cứ lúc nào; nút **Submit for review** chỉ bật khi đủ điều kiện (mục 7.2).
- **Inquiries:** hộp thư. Xem chi tiết, trả lời, từ chối (kèm lý do tùy chọn), đóng.
- **Invitations:** các request mà admin mời builder tham gia. Xem request (không thấy email client), gửi đề xuất hoặc từ chối (mục 5.7).

### 5.4 Client (`/me`)

Danh sách Inquiry và request đã gửi. Với Inquiry: xem trao đổi, trả lời, đóng. Với request: xem trạng thái, các đề xuất builder gửi về, chọn một đề xuất hoặc đóng request. Mọi user đã đăng nhập đều có `/me`.

### 5.5 Admin (`/admin`, chỉ `is_admin`)

- Hàng chờ duyệt builder: duyệt / từ chối (kèm lý do).
- Hàng chờ duyệt product: duyệt / yêu cầu sửa (bắt buộc `review_note`) / khóa.
- Mục "Mới chỉnh sửa": product published được sửa trong 14 ngày gần nhất.
- Gắn / thu hồi huy hiệu `demo_verified`, `in_production` (bắt buộc ghi evidence).
- Danh sách Inquiry, đánh dấu `removed` khi spam.
- **Hàng chờ request:** đọc request, xem danh sách builder gợi ý (mục 8.10), chọn tối đa 5 để mời, hoặc trả request về cho client (`rejected`, bắt buộc ghi lý do) / đánh dấu spam. Theo dõi request đang `matching`: số lời mời đã trả lời, mời thêm khi builder từ chối.
- Khóa / mở khóa user và builder.
- Tạo invite link (số lượt dùng, ngày hết hạn) và xem số lượt đã dùng.
- Bảng thước đo (mục 3).

### 5.6 Luồng Inquiry

1. Client bấm một trong 4 nút (hoặc **Hire** ở builder profile) → form: loại (chọn sẵn), message (20–2000 ký tự), budget band (`<500`, `500-2k`, `2k-10k`, `>10k`, `unsure`), deadline (tùy chọn). Nếu chưa đăng nhập: thêm name và email. Có Turnstile và honeypot.
2. Đã đăng nhập → Inquiry vào `open`, builder nhận email.
3. Chưa đăng nhập → tìm hoặc tạo user theo email (tài khoản ngầm), Inquiry vào `pending_verification`, gửi email xác nhận. Bấm link → đăng nhập client, Inquiry chuyển `open`, builder nhận email.
4. Hai bên trao đổi **trên web**. Email chỉ là thông báo (gồm nội dung tin nhắn và link), gửi từ `noreply@vnx.si`. Không xử lý reply bằng email.
5. Builder không thấy email của client. Client tự ghi liên hệ vào tin nhắn nếu muốn.
6. Builder không thể gửi Inquiry tới chính mình.

### 5.7 Luồng Post a request (ghép thủ công)

Dành cho client chưa tìm thấy product hay builder phù hợp. Vào từ `/request`, từ danh bạ builder, từ trạng thái rỗng của catalogue và từ landing.

1. **Client gửi request:** tiêu đề (≤120), mô tả (40–4000 ký tự), category, budget band (như Inquiry), deadline (tùy chọn), ngôn ngữ muốn làm việc (một hoặc nhiều trong `en`/`vi`/`zh`). Chưa đăng nhập → name + email, xác nhận email như Inquiry (`pending_verification` → `submitted`). Có Turnstile, honeypot, rate limit.
2. **Admin ghép:** request `submitted` vào hàng chờ admin. Admin xem gợi ý builder (mục 8.10), chọn tối đa 5 → hệ thống gửi email mời; request chuyển `matching`. Admin cũng có thể trả request về (`rejected` + lý do, client nhận email) hoặc đánh dấu `removed` khi spam.
3. **Builder trả lời lời mời** trong Builder Hub (hạn 7 ngày): gửi **đề xuất** gồm cách làm (≤2000 ký tự), giá ước tính (số tiền USD, hoặc khoảng, hoặc "cần trao đổi thêm"), thời gian dự kiến (ngày), hoặc **từ chối** (lý do tùy chọn). Builder chỉ thấy nội dung request và tên hiển thị của client.
4. **Client xem đề xuất** trong `/me` (nhận email mỗi khi có đề xuất mới) và **chọn một**. Hệ thống tạo một Inquiry `type = request` giữa client và builder đó, tin nhắn đầu tiên là nội dung request + đề xuất; request chuyển `builder_selected`; các đề xuất còn lại chuyển `not_selected` và builder được báo.
5. Từ đây hai bên trao đổi như một Inquiry bình thường (mục 5.6).
6. Lời mời quá 7 ngày không trả lời → `expired`; admin thấy và có thể mời builder khác, miễn số lời mời đang `invited`/`proposed` không quá 5.

### 5.8 Landing cũ

- `public/index.html` hiện tại bị thay hoàn toàn. `apps/web/drafts/` không dùng nữa.
- Gỡ route `/api/waitlist`, `src/waitlist.ts` và test của nó. Bảng `waitlist` và migration `0001`, `0002` giữ nguyên.

### 5.9 Homepage: các khối và animation

| # | Khối | Nội dung | Khi chưa đủ dữ liệu (ngưỡng ở mục 8.11) |
|---|---|---|---|
| 1 | Hero | Câu định vị, 2 CTA. Bên phải: chồng 3 thẻ product nổi bật, tự đổi thẻ trước mỗi ~4 giây | Dưới 3 product published → một thẻ minh họa "Your product here" dẫn tới `/for-builders` |
| 2 | Con số | 4 ô đếm lên khi tải trang: product published, builder approved, request 30 ngày, số quốc gia của builder. Ghi "cập nhật mỗi giờ" | Ô nào dưới ngưỡng thì ẩn ô đó; ẩn cả hàng nếu còn dưới 2 ô |
| 3 | Live | Dải chạy ngang các sự kiện công khai gần đây (mục 8.11) | Dưới 5 sự kiện trong 7 ngày → ẩn |
| 4 | Trending this week | 6 product có điểm trending cao nhất, mỗi thẻ có số thứ hạng, sparkline 14 ngày, % thay đổi so với tuần trước | Dưới 6 product đủ điểm → ẩn, thay bằng "Founding products" (product mới published) |
| 5 | Market pulse | Chart 1: request (30 ngày) và product đang listed theo category, cột nhóm nằm ngang, có tooltip, legend, nút xem dạng bảng, và một dòng chỉ ra category thiếu supply nhất. Chart 2: số product và builder cộng dồn theo tuần, 2 đường, có crosshair | Chart 1 cần ≥10 request trong 30 ngày; chart 2 cần ≥4 tuần dữ liệu. Thiếu thì ẩn chart đó |
| 6 | Top builders | Bảng xếp hạng 3 tab: được chọn nhiều nhất, trả lời nhanh nhất, nhiều product được xác minh nhất. Ghi rõ tiêu chí và "không ai trả tiền để có mặt ở đây" | Tab nào có dưới 3 builder đủ điều kiện thì ẩn tab đó; không còn tab nào thì ẩn khối |
| 7 | Top products theo category | Chip chọn category, hiện 3 product xếp theo huy hiệu rồi số Inquiry 30 ngày | Chỉ hiện chip của category có ≥1 product |
| 8–11 | 4 ways, huy hiệu, khối builder, CTA cuối | Như cũ | — |

**Animation:**
- Các khối hiện dần khi cuộn tới (CSS scroll-driven animation; trình duyệt không hỗ trợ thì hiện ngay, không animation).
- Cột chart mọc từ baseline, đường chart và sparkline vẽ dần, con số đếm lên, dải Live chạy ngang, thẻ nhấc lên khi hover.
- Chỉ dùng CSS và một ít JS phía client (đếm số, xoay thẻ, tooltip), không thêm thư viện.
- Tôn trọng `prefers-reduced-motion`: tắt toàn bộ animation, số hiện ngay giá trị cuối, thẻ không tự xoay.
- Dải Live và chồng thẻ dừng khi hover hoặc focus.

**Chart:**
- Bảng màu chuỗi: xanh `#2a78d6` (request), cam `#eb6834` (product), đã qua validator, kể cả cho người mù màu.
- Chữ luôn dùng màu chữ, không dùng màu chuỗi.
- Có legend cho chart 2 chuỗi.
- Mọi chart có bảng dữ liệu tương đương (`<details>`).
- Bản dark mode chọn bước màu riêng và chạy validator lại khi làm.

## 6. Data model (D1)

Quy ước: ID là ULID (text). Tiền là số nguyên cent USD. Thời gian là ISO-8601 UTC (text). Danh sách đơn giản lưu JSON trong cột text. Mọi bảng có `created_at`, `updated_at` trừ khi ghi khác.

### 6.1 Làm ở dự án 1 (migration `0003_identity.sql` cho nhóm danh tính; các nhóm sau dùng `0004+`, mỗi milestone một migration)

**`users`**: `id`, `email` (unique, lowercase), `display_name`, `locale`, `is_admin` (0/1), `status` (`active`/`suspended`), `last_login_at`.
Client = user. Không có bảng client riêng.

**`login_tokens`**: `token_hash` (PK, SHA-256), `email`, `purpose` (`login`/`inquiry_verify`/`request_verify`), `locale` (locale lúc xin link, dùng cho email và redirect), `inquiry_id` (nullable), `request_id` (nullable), `invite_code_hash` (nullable), `expires_at`, `used_at`.

**`sessions`**: `id_hash` (PK), `user_id`, `expires_at`, `created_at`.

**`invites`**: `code_hash` (PK), `created_by`, `max_uses`, `uses`, `expires_at`, `note`.

**`builders`**: `user_id` (PK, FK users), `handle` (unique; 3–30 ký tự `a-z0-9-`, không trùng danh sách từ dành riêng như `admin`, `hub`, `api`), `name`, `kind` (`individual`/`team`/`company`), `headline`, `bio`, `country` (ISO-3166 alpha-2), `website_url`, `skills` (JSON), `ai_tools` (JSON), `work_languages` (JSON, trong `en`/`vi`/`zh`), `availability` (`open`/`limited`/`closed`), `hourly_rate_cents` (nullable), `status` (`pending`/`approved`/`rejected`/`suspended`), `review_note`, `invite_code_hash` (nullable), `approved_at`.

**`portfolio_items`**: `id`, `builder_id`, `title`, `url`, `description`, `image_key` (nullable), `sort`.

**`products`**: `id`, `builder_id`, `slug` (unique; tạo từ name, sửa được đến lần publish đầu, sau đó khóa), `status` (mục 7.2), `primary_lang`, `name`, `tagline` (≤120), `problem`, `target_users`, `description` (văn bản thuần, mục 8.6), `category`, `tags` (JSON, ≤10), `features` (JSON, ≤20), `tech_stack` (JSON), `delivery_model` (`saas`/`source`/`service`), `license` (`single_use`/`extended`/`open_source`, bắt buộc khi `source`, null cho loại khác), `demo_url`, `website_url`, `customizable` (0/1), `customization_notes`, `support_policy`, `review_note`, `first_published_at`, `published_at`, `edited_after_publish_at`.

**`pricing_tiers`**: `id`, `product_id`, `name`, `price_cents` (null khi `billing = contact`), `billing` (`one_time`/`monthly`/`yearly`/`contact`), `description`, `sort`. Tối đa 5 tier mỗi product.

**`product_media`**: `id`, `product_id`, `r2_key`, `alt`, `sort`. Tối đa 8 ảnh mỗi product.

**`product_verifications`**: `id`, `product_id`, `kind` (`listed`/`demo_verified`/`in_production`), `verified_by` (user_id, hoặc null khi hệ thống tự gắn), `evidence`, `verified_at`, `revoked_at`, `revoke_reason`. Huy hiệu đang hiệu lực = dòng có `revoked_at IS NULL`.

**`products_fts`**: bảng ảo FTS5, `tokenize = 'trigram'`, các cột `name`, `tagline`, `description`, `tags`; đồng bộ khi product chuyển vào/ra `published` và khi sửa product đang published.

**`inquiries`**: `id`, `client_user_id`, `builder_id`, `product_id` (nullable), `request_id` (nullable, khi sinh ra từ request), `type` (`buy`/`customize`/`hire`/`build_similar`/`request`), `message`, `budget_band`, `deadline` (nullable), `status` (mục 7.3), `locale`, `last_activity_at`, `builder_reminded_at`, `admin_alerted_at`.

**`inquiry_messages`**: `id`, `inquiry_id`, `sender_user_id`, `body` (≤4000), `created_at`, `notified_at` (null = chưa gửi được email thông báo).

**`requests`**: `id`, `client_user_id`, `title`, `description`, `category`, `budget_band`, `deadline` (nullable), `languages` (JSON), `status` (mục 7.5), `locale`, `admin_note` (lý do khi `rejected`), `selected_invite_id` (nullable), `submitted_at`, `matched_at`, `closed_at`.

**`request_invites`**: `id`, `request_id`, `builder_id`, `invited_by`, `status` (mục 7.6), `approach`, `price_cents` (nullable), `price_max_cents` (nullable, khi đưa khoảng giá), `price_note`, `timeline_days` (nullable), `decline_reason`, `invited_at`, `responded_at`, `reminded_at`, `inquiry_id` (nullable, khi được chọn). Unique (`request_id`, `builder_id`).

**`product_daily_stats`**, **`public_stats`**: mục 8.11.

**`rate_limits`**: `key` (ví dụ `login:email:<hash>`), `window_start`, `count`; PK (`key`, `window_start`). Cron xóa cửa sổ đã qua.

**`audit_log`**: `id`, `actor_user_id` (null = hệ thống), `action`, `entity`, `entity_id`, `data` (JSON), `created_at`.

**Category**: danh sách cố định trong code, có bản dịch 4 ngôn ngữ: `booking`, `crm`, `ecommerce`, `finance`, `hr`, `education`, `internal_tools`, `ai_agents`, `other`.

**Index**: `products(status, published_at)`, `products(builder_id)`, `products(category, status)`, `inquiries(builder_id, status)`, `inquiries(client_user_id)`, `inquiry_messages(inquiry_id)`, `product_verifications(product_id)`, `requests(status, submitted_at)`, `requests(client_user_id)`, `request_invites(builder_id, status)`, `request_invites(request_id)`.

### 6.2 Thiết kế sẵn cho Wave 3 (chưa tạo bảng)

- **`projects`**: `client_user_id`, `source_inquiry_id`, `base_product_id` (khi Customize / Build Similar), `type`, `requirement`, `prd`, `budget_cents`, `builder_id`, `status`.
- **`proposals`**: `project_id`, `builder_id`, `amount_cents`, `timeline_days`, `message`, `status`.
- **`milestones`**: `project_id`, `title`, `amount_cents`, `deliverable`, `status`.
- **`orders`**: mua product: `product_id`, `tier_id`, `client_user_id`, `amount_cents`, `status`.
- **`payments` / `payouts`**: sổ cái kiểu ledger, ghi rõ phí platform.
- **`reviews`**: gắn với order hoặc project đã hoàn tất.

Inquiry là mầm của Project: khi hai bên thỏa thuận, Inquiry được nâng thành Project qua `source_inquiry_id`. Request là mầm của Project kiểu "post project": ở Wave 3, `requests` trở thành nguồn cho `projects`, và đề xuất trong `request_invites` được chuyển thành `proposals` có giá ràng buộc và thanh toán.

## 7. State machine

Mọi chuyển trạng thái nằm trong `domain/` dưới dạng hàm thuần `(trạng thái hiện tại, hành động, người thực hiện) → trạng thái mới | lỗi`. Mỗi chuyển thành công ghi một dòng `audit_log`. Chuyển không hợp lệ → route trả 409.

### 7.1 Builder

```
(tự đăng ký) ──► pending ──admin duyệt──► approved ◄──admin mở khóa── suspended
                    │                         └──────admin khóa────────►┘
                    └──admin từ chối──► rejected ──sửa hồ sơ, gửi lại──► pending
(invite hợp lệ) ──────────────────────► approved
```

- Chỉ builder `approved` mới gửi product đi duyệt được và mới hiện profile public.
- Builder `suspended` → mọi product của họ ẩn khỏi trang public và catalogue (trạng thái product giữ nguyên, lọc theo trạng thái builder).

### 7.2 Product

```
draft ──submit──► in_review ──admin duyệt──► published ◄──► unlisted (builder tự ẩn)
  ▲                   │                          │
  └─ changes_requested ◄─admin yêu cầu sửa        ├──admin khóa──► suspended ──admin mở──► published
                                                 └──builder xóa──► archived
```

- `draft`, `changes_requested`, `unlisted` cũng có thể chuyển sang `archived`. `archived` là xóa mềm, không quay lại.
- **Điều kiện submit:** builder `approved`; có name, tagline, problem, target_users, description, category, delivery_model, support_policy; ≥1 tính năng; ≥1 pricing tier; ≥1 ảnh; có license nếu `source`.
- **Khi duyệt:** tự gắn huy hiệu `listed` (`verified_by = null`), đặt `published_at` (và `first_published_at` nếu là lần đầu), đồng bộ FTS.
- **Sửa khi đang published:** thay đổi lên trang ngay, không duyệt lại; đặt `edited_after_publish_at`, ghi `audit_log` và hiện trong mục "Mới chỉnh sửa" của admin.
- **Đổi `demo_url`** khi đang có `demo_verified` → hệ thống tự thu hồi huy hiệu này với `revoke_reason = 'demo_url_changed'`.
- Chỉ product `published` của builder `approved` mới xuất hiện ở trang public, catalogue, sitemap.

### 7.3 Inquiry

```
pending_verification ──client xác nhận email──► open ──builder trả lời──► answered
       │ (quá 48h → cron xóa)                    │                          │
                                         builder từ chối ──► declined        │
                         open / answered ──client hoặc builder đóng──► closed ◄┘
                         bất kỳ ──admin──► removed
```

- Client trả lời khi `answered` → giữ `answered`. Chỉ cập nhật `last_activity_at`.
- `declined`, `closed`, `removed` là trạng thái cuối: không gửi tin nhắn mới được.

### 7.4 Project và giao dịch (Wave 3, chỉ thiết kế)

```
draft ► posted ► proposals_open ► builder_selected ► in_progress ► delivered ► completed
bất kỳ trạng thái trước in_progress ► cancelled

Milestone: pending ► funded ► submitted ► approved ► released
           (nhánh phụ: submitted ► disputed ► resolved)
```

Client chỉ thấy bản rút gọn: Requirements approved → Builder selected → Development → Testing → Deployment. Cơ chế escrow và pháp nhân nhận tiền được quyết khi brainstorm Wave 3.

### 7.5 Request

```
pending_verification ──client xác nhận email──► submitted ──admin mời ≥1 builder──► matching ──client chọn đề xuất──► builder_selected
       │ (quá 48h → cron xóa)                      │                                   │
                                     admin trả về ─┴─► rejected                         ├──quá 30 ngày chưa chọn → expired
                          submitted / matching ──client đóng──► closed                  └──client đóng──► closed
                          bất kỳ ──admin──► removed (spam)
```

- `builder_selected`, `rejected`, `expired`, `closed`, `removed` là trạng thái cuối. Khi request vào trạng thái cuối, mọi lời mời `invited` chuyển `expired`, mọi đề xuất `proposed` chưa được chọn chuyển `not_selected`.
- Client chỉ chọn được khi request đang `matching` và đề xuất đang `proposed`.

### 7.6 Lời mời (request invite)

```
invited ──builder gửi đề xuất──► proposed ──client chọn──► selected
   │                                  └──client chọn đề xuất khác / request kết thúc──► not_selected
   ├──builder từ chối──► declined
   └──quá 7 ngày──► expired
```

- Mỗi request có tối đa 5 lời mời ở trạng thái `invited` hoặc `proposed` cùng lúc. Không mời lại builder đã được mời cho cùng request.
- Builder không còn `approved` → các lời mời `invited` của họ chuyển `expired`.

## 8. Kỹ thuật

### 8.1 Cấu trúc code (`apps/web/`)

```
src/
  index.ts        Hono app, mount routes, onError/notFound, cron handler (scheduled)
  routes/         public.ts, auth.ts, hub.ts, me.ts, admin.ts, media.ts
  views/          layout.tsx, components/, pages/ (JSX của Hono)
  domain/         builder.ts, product.ts, inquiry.ts (state machine), validation.ts (zod schema), text.ts (render văn bản thuần)
  db/             users.ts, builders.ts, products.ts, inquiries.ts, verifications.ts, audit.ts
  auth/           tokens.ts, sessions.ts, middleware.ts (requireUser / requireBuilder / requireAdmin)
  email/          mailer.ts (interface), resend.ts, fake.ts, templates/
  i18n/           locales/en.ts, vi.ts, zh-hans.ts, zh-hant.ts; t(); middleware nhận locale từ tiền tố URL
  media/          r2.ts (upload, kiểm tra loại file, đọc)
public/           styles.css (biến màu, dark mode), app.js (JS nhỏ cho editor và form)
migrations/       0001, 0002 (giữ), 0003_marketplace.sql
test/
```

Mỗi file một trách nhiệm. `domain/` không phụ thuộc Hono hay D1. `db/` không chứa logic trạng thái.

**Dependency mới:** `hono`, `zod`. Dev: `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`. ULID tự viết (khoảng 20 dòng) thay vì thêm package.

### 8.2 Auth

- **Magic link:** token ngẫu nhiên 32 byte (base64url), DB chỉ lưu SHA-256. Hết hạn sau 15 phút, dùng một lần. Link: `/auth/verify?t=…`.
- Lần đầu đăng nhập bằng một email → tạo `users` (locale lấy từ URL lúc xin link).
- **Session:** cookie `__Host-vnx_session` (HttpOnly, Secure, SameSite=Lax, Path=/), sống 30 ngày, DB lưu hash. Đăng xuất xóa dòng session.
- **CSRF:** SameSite=Lax + mọi request không phải GET/HEAD phải có header `Origin` khớp host; sai → 403.
- **Giới hạn tần suất** (bảng D1 `rate_limits` đếm theo cửa sổ thời gian cố định; không dùng Workers Rate Limiting binding vì binding đó chỉ hỗ trợ chu kỳ 10 hoặc 60 giây): xin magic link 5 lần/giờ mỗi email và 20 lần/giờ mỗi IP; gửi Inquiry 10 lần/giờ mỗi IP; gửi request 3 lần/ngày mỗi email.
- **Admin:** biến `ADMIN_EMAILS` (danh sách phân tách bằng dấu phẩy). Email trong danh sách đăng nhập → đặt `is_admin = 1`.
- User `suspended` không đăng nhập được; session đang có bị vô hiệu. Nếu user đó là builder thì nội dung public bị ẩn như builder `suspended`.

### 8.3 Email (Resend)

- Gửi từ `noreply@vnx.si`. Xác minh domain trên Resend, thêm bản ghi DKIM/SPF vào DNS Cloudflare.
- Template cho 4 ngôn ngữ, chọn theo `users.locale` của người nhận: magic link, xác nhận Inquiry, xác nhận request, Inquiry mới (gửi builder), lời mời request (gửi builder), đề xuất mới (gửi client), được chọn / không được chọn (gửi builder), request bị trả về (gửi client), tin nhắn mới, builder được duyệt / bị từ chối, product được duyệt / yêu cầu sửa, nhắc builder trả lời.
- Gửi magic link hoặc email xác nhận thất bại → báo lỗi ngay trên form.
- Gửi thông báo thất bại → để `notified_at = null`; cron gửi lại (tối đa 3 lần, sau đó ghi `audit_log`).
- `Mailer` là interface; test dùng `fake.ts` lưu email vào bộ nhớ.

### 8.4 Cron (mỗi ngày, 01:00 UTC)

- Inquiry `open` quá 3 ngày chưa được trả lời và chưa nhắc → email nhắc builder.
- Quá 7 ngày → email báo admin.
- Xóa Inquiry `pending_verification` quá 48 giờ, `login_tokens` và `sessions` hết hạn.
- Xóa request `pending_verification` quá 48 giờ.
- **Mỗi giờ:** tính lại `public_stats` và điểm trending (mục 8.11).
- Lời mời `invited` quá 3 ngày → nhắc builder; quá 7 ngày → `expired`.
- Request `matching` quá 30 ngày chưa chọn → `expired`, báo client.
- Gửi lại thông báo có `notified_at = null`.

### 8.5 Ảnh (R2, bucket `vnxsi-media`)

- Nhận JPEG / PNG / WebP, kiểm tra cả các byte đầu file (không tin `Content-Type`). Mỗi ảnh ≤2MB.
- Key: `products/{product_id}/{ulid}.{ext}`, `portfolio/{builder_id}/{ulid}.{ext}`.
- Phục vụ qua `/media/*` với `Cache-Control: public, max-age=31536000, immutable`. Ảnh của product chưa published vẫn đọc được qua key (key không đoán được).
- Chưa resize; editor ghi khuyến nghị 1600px chiều ngang.

### 8.6 Nội dung do người dùng viết

- `description`, `bio`, tin nhắn: **văn bản thuần**. Render: escape toàn bộ, dòng trống tách đoạn, dòng bắt đầu bằng `- ` thành danh sách. Không có HTML hay markdown.
- Mọi URL do người dùng nhập phải là `https://`; link ra ngoài có `rel="nofollow ugc noopener"`.
- JSX của Hono tự escape; cấm dùng `dangerouslySetInnerHTML` với dữ liệu người dùng.

### 8.7 Tìm kiếm và xếp hạng (Wave 1)

- Chỉ tìm trong product `published` của builder `approved`.
- Có từ khóa ≥3 ký tự: FTS5 trigram, sắp theo `bm25` trước, rồi điểm huy hiệu, rồi `published_at` mới nhất.
- Từ khóa 1–2 ký tự (thường gặp ở tiếng Trung): `LIKE '%q%'` trên name, tagline, tags.
- Không có từ khóa: điểm huy hiệu (`in_production` = 3, `demo_verified` = 2, `listed` = 1, lấy mức cao nhất đang hiệu lực) giảm dần, rồi `published_at` mới nhất.
- Không có tham số nào cho phép trả tiền để thay đổi thứ tự.

### 8.8 SEO

- `sitemap.xml`: trang tĩnh, product và builder public × 4 locale, kèm `xhtml:link` hreflang.
- `robots.txt`: chặn `/hub`, `/me`, `/admin`, `/auth`, `/media`. Request không bao giờ có trang public.
- Sitemap gồm cả `/builders` và `/request`.
- Mỗi trang có title, meta description, canonical, Open Graph (ảnh đầu tiên của product).
- `/p/:slug` có JSON-LD `SoftwareApplication` (name, description, offers từ pricing tier có giá). Không đưa `aggregateRating` (chưa có review).

### 8.9 Xử lý lỗi

- Kiểm tra dữ liệu bằng zod ở đầu mỗi route nhận form. Sai → render lại form với giá trị đã nhập và lỗi ở từng ô, theo locale.
- 404 / 403 / 409 / 500 có trang riêng theo locale. Lỗi 500 được log kèm request id (`cf-ray`), trang lỗi hiện mã này.
- Lỗi upload R2 hoặc Resend không làm mất dữ liệu đã lưu trong D1; người dùng thấy thông báo và thử lại được.

### 8.10 Gợi ý builder cho request (Wave 1, theo luật)

Chỉ giúp admin chọn nhanh; admin vẫn là người quyết định. Ứng viên: builder `approved`, availability khác `closed`, chưa được mời cho request này. Điểm:

- +3 nếu có product `published` cùng category với request
- +1 cho mỗi skill của builder xuất hiện trong tiêu đề hoặc mô tả request (không phân biệt hoa thường), tối đa +3
- +1 nếu `work_languages` của builder có ít nhất một ngôn ngữ trong `requests.languages`
- +1 nếu availability `open`
- −1 cho mỗi lời mời `expired` trong 60 ngày gần nhất

Hiện 10 builder điểm cao nhất, kèm lý do từng điểm. Lựa chọn của admin và kết quả (đề xuất / được chọn) được lưu sẵn trong `request_invites` để Wave 2 dùng làm dữ liệu huấn luyện matching.

### 8.11 Số liệu công khai trên homepage

Tất cả được tính sẵn mỗi giờ bởi cron và lưu vào bảng `public_stats` (`key`, `value` JSON, `computed_at`). Homepage chỉ đọc bảng này, không truy vấn nặng lúc request.

**Ghi nhận lượt xem:** bảng `product_daily_stats` (`product_id`, `day`, `views`, `demo_clicks`, `inquiries`; PK `product_id` + `day`).
- `views` tăng khi render `/p/:slug`. Không đếm: bot (theo User-Agent và `cf.botManagement` nếu có), chính builder của product, admin. Mỗi trình duyệt chỉ đếm 1 lần mỗi product mỗi ngày, nhận diện bằng cookie ngẫu nhiên không gắn danh tính.
- `demo_clicks` đếm qua route chuyển hướng `/p/:slug/demo`.
- `inquiries` tăng khi Inquiry vào `open`.

**Định nghĩa:**

| Số liệu | Cách tính | Ngưỡng để hiện |
|---|---|---|
| Product published | đếm product `published` của builder `approved` | ≥ 10 |
| Builder approved | đếm builder `approved` | ≥ 10 |
| Request 30 ngày | đếm request đã qua `submitted` trong 30 ngày | ≥ 10 |
| Quốc gia builder | đếm `country` khác nhau của builder `approved` | ≥ 3 |
| Điểm trending | `inquiries_7d × 5 + demo_clicks_7d × 2 + views_7d`; % thay đổi so với 7 ngày trước đó; sparkline = điểm theo ngày trong 14 ngày | product cần điểm ≥ 20 |
| Request theo category | đếm request 30 ngày theo category; **category có dưới 3 request gộp vào "Other"** để không lộ ai đang cần gì | tổng ≥ 10 |
| Category thiếu supply | category có tỷ lệ request/product cao nhất, cần ≥ 3 request | — |
| Tăng trưởng | product published và builder approved cộng dồn, theo tuần ISO | ≥ 4 tuần |
| Top builder: được chọn | số đề xuất `selected` + Inquiry đã `answered` trong 90 ngày | builder cần ≥ 2 |
| Top builder: trả lời nhanh | trung vị thời gian từ Inquiry `open` / lời mời đến tin trả lời đầu tiên, 90 ngày | builder cần ≥ 5 lượt |
| Top builder: xác minh | số product có `demo_verified` hoặc `in_production` | builder cần ≥ 1 |
| Top product theo category | huy hiệu cao nhất, rồi `inquiries` 30 ngày, rồi `published_at` | — |

**Sự kiện Live:** chỉ dùng sự kiện công khai từ `audit_log`:
- product được published
- huy hiệu được gắn
- builder được duyệt (chỉ tên công khai)
- request mới (chỉ category và ngôn ngữ; không có tiêu đề, nội dung hay tên client)

Mỗi dòng ghi thời gian tương đối. Tối đa 20 dòng.

**Nguyên tắc:** không hiển thị con số nào không tính được từ dữ liệu thật; không làm tròn lên; không có vị trí trả tiền trong Trending hay Top. Số liệu trong prototype là dữ liệu mẫu.

## 9. Test

Chuyển từ `node --test` sang **Vitest + `@cloudflare/vitest-pool-workers`**: test chạy trong workerd với D1 thật (local) đã chạy migration, R2 local và `Mailer` giả.

**Unit:**

- Mọi chuyển trạng thái hợp lệ và không hợp lệ của builder, product, inquiry, request, request invite.
- Điều kiện submit product (thiếu từng trường → lỗi đúng).
- Zod schema: handle, slug, URL chỉ `https`, giới hạn độ dài.
- 4 file locale có cùng tập key.
- Render văn bản thuần: chuỗi chứa `<script>`, `"`, `&` được escape; danh sách và đoạn đúng.
- ULID tăng dần và đúng định dạng.

**Integration (gọi `app.request` / `SELF.fetch`):**

- Đăng nhập: xin link → Mailer giả nhận token → verify → có cookie session; dùng lại token → thất bại; token hết hạn → thất bại.
- Đăng ký builder không invite → `pending`; với invite → `approved`, `invites.uses` tăng.
- Builder tạo product → submit → admin duyệt → hiện ở `/products`, tìm được bằng từ khóa (cả tiếng Việt có dấu và tiếng Trung 2 ký tự) → có huy hiệu `listed`.
- Đổi `demo_url` của product có `demo_verified` → huy hiệu bị thu hồi.
- Inquiry khi chưa đăng nhập: `pending_verification` → bấm link → `open`, builder nhận email → builder trả lời → client thấy trong `/me`.
- Phân quyền: builder sửa product của người khác → 403; non-admin vào `/admin` → 403; POST thiếu `Origin` → 403.
- Request: client chưa đăng nhập gửi → xác nhận email → `submitted` → admin mời 2 builder → `matching` → builder A gửi đề xuất, builder B từ chối → client chọn đề xuất A → request `builder_selected`, có Inquiry `type = request` giữa client và A.
- Không mời được builder thứ 6 khi đã có 5 lời mời `invited`/`proposed`; builder không được mời thì không xem được request (404).
- Gợi ý builder: builder có product cùng category xếp trên builder không có; builder `closed` không xuất hiện.
- Danh bạ builder chỉ hiện builder `approved`, lọc đúng theo category và ngôn ngữ.
- `public_stats`: với dữ liệu dưới ngưỡng, homepage không render khối tương ứng; request theo category gộp nhóm dưới 3 vào "Other"; lượt xem của chính builder và của bot không được đếm; điểm trending đúng công thức.
- Homepage với `prefers-reduced-motion` không có animation (kiểm tra CSS media query có mặt).
- Builder bị khóa → product biến mất khỏi catalogue và `/p/:slug` trả 404.
- Trang public trả đúng `hreflang` cho 4 locale.

## 10. Triển khai

- Vẫn Worker `vnxsi-web`, D1 `vnxsi`. Thêm vào `wrangler.jsonc`: binding R2 `MEDIA` (bucket `vnxsi-media`), `triggers.crons = ["0 1 * * *", "5 * * * *"]`.
- Secret: `RESEND_API_KEY`, `TURNSTILE_SECRET`. Biến: `ADMIN_EMAILS`, `APP_ORIGIN` (`https://vnx.si`).
- Thứ tự: tạo bucket R2 → xác minh domain Resend (DNS) → `db:migrate:remote` (0003) → deploy.
- Đánh dấu spec v0.1 và plan 2026-10-02 là **Superseded** (không xóa).

## 11. Ngoài phạm vi dự án 1

AI Discovery và ước giá; AI matching (Wave 1 chỉ có gợi ý theo luật cho admin); request board công khai để builder tự tìm việc; thanh toán, escrow, order, payout; Project, Proposal có ràng buộc, Milestone; doanh thu trong Builder Hub; review và rating; Maintenance; Product Opportunity; sponsored listing; bản dịch nội dung product sang nhiều ngôn ngữ; quy đổi tiền tệ; resize ảnh; reply bằng email; app di động.

## 12. Rủi ro và câu hỏi để mở

| Rủi ro / câu hỏi | Ảnh hưởng | Xử lý |
|---|---|---|
| Thanh toán và escrow ở Việt Nam (Stripe Connect không hỗ trợ pháp nhân VN; giữ tiền hộ có thể cần giấy phép trung gian thanh toán) | Quyết định mô hình doanh thu Wave 3 | Nghiên cứu trước khi brainstorm Wave 3: pháp nhân nước ngoài, Paddle/Lemon Squeezy, hoặc chỉ thu phí giới thiệu |
| License và quyền sở hữu khi Customize product `source` | Tranh chấp giữa client và builder | Wave 1 chỉ hiển thị license chuẩn; điều khoản Customize viết ở Wave 3 |
| Chất lượng bản dịch `zh-Hans`, `zh-Hant` | Mất uy tín ở thị trường Trung | Người bản xứ đọc lại trước khi quảng bá |
| Client và builder trao đổi trực tiếp ngoài platform | Mất doanh thu sau này | Wave 1 chấp nhận; ẩn email client để giảm |
| Spam qua form Inquiry | Builder bỏ đi | Xác nhận email, Turnstile, honeypot, rate limit, admin `removed` |
| Không đủ 100 builder | Không sang được Wave 2 | Đo hằng tuần trong `/admin`; điều chỉnh lời mời |
| Admin ghép thủ công không kịp khi request tăng | Client chờ lâu, mất niềm tin | Hiển thị cho client "thường có đề xuất trong 3 ngày làm việc"; đo thời gian từ `submitted` đến lời mời đầu tiên; vượt sức thì đẩy sớm AI matching của Wave 2 |
| Request không có builder phù hợp | Client thất vọng | Admin trả về (`rejected`) kèm lý do và gợi ý thay thế; ghi lại category thiếu supply để mời builder |
