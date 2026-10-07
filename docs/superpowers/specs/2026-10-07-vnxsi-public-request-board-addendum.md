# VNX.SI — Phụ lục spec: Bảng request công khai

- **Ngày:** 2026-10-07
- **Trạng thái:** **Thiết kế Approved** (Owner 2026-10-07: "approve all", duyệt phụ lục và toàn bộ khuyến nghị ở mục 17). **Câu chữ mục 12 (Privacy, Terms, giao diện) CHƯA DUYỆT.** Không sửa `docs/legal/*` hay `src/legal/content.ts`, và không bật cờ `request_board`, cho tới khi Owner duyệt nguyên văn mục 12.
- **Bổ sung cho:** [spec Wave 1](2026-10-03-vnxsi-marketplace-wave1-design.md). Sau khi được duyệt, phụ lục có cùng cấp với spec; chỗ nào phụ lục ghi "thay mục X" thì phụ lục thắng.
- **Căn cứ:**
  - [Review execution plan](../../../.ai/reviews/EXECUTION-PLAN-2026-10-06-review.md): C1, mục 4.1, mục 7 câu 4.
  - Quyết định Owner 2026-10-06: bảng request **công khai đầy đủ** (thay đề xuất "tóm tắt ẩn danh" của Reviewer). Điều kiện: phụ lục sửa spec §4, §8.8, §11; câu chữ Privacy và Terms mới do Owner duyệt, báo trước theo Privacy §10; opt-in từng request, không công khai hồi tố; trường quốc gia mới; quy tắc ngân sách; kiểm duyệt trước khi công khai.
  - Quyết định Owner 2026-10-07: (1) builder bấm "I'm interested", vào hàng chờ Ops, admin vẫn mời tối đa 5; (2) chỉ hiện `budget_band`; (3) mọi trường công khai sau khi Ops kiểm duyệt, danh tính client không bao giờ công khai; (4) request mở được index, rời trạng thái mở thì `noindex`, ra khỏi sitemap, trang ghi "closed".
  - `docs/VNXSI_EXECUTION_PLAN_APPROVED.md` §4 ("Open requests"), §22 (`/requests`), §23: chỉ là định hướng. Chỗ khác phụ lục (con số ngân sách "$800", builder gửi đề xuất / gắn product trực tiếp, `/requests/{slug}`) thì phụ lục thắng.
- **Backlog:** kéo VNX-1901 (Wave 4, "Request a Product công khai, ẩn danh, theo category") lên sớm và mở rộng thành bảng đầy đủ (mục 16).

Những chỗ ghi **(Q*n*)** dẫn tới câu trả lời ở mục 17. Owner đã chốt cả 19 câu theo khuyến nghị (2026-10-07).

---

## 1. Phạm vi

| Phần | Nội dung | Mục |
|---|---|---|
| A. Opt-in | Ô chọn công khai trên `/request`, trường `country`, quản lý ở `/me` | 3.1, 4.3 |
| B. Kiểm duyệt | Ops đọc, sửa bản công khai, duyệt / từ chối / gỡ | 3.2, 5 |
| C. Trang công khai | `/requests`, `/requests/:publicId`, luật hiển thị, SEO | 4.1, 7.3, 8 |
| D. Quan tâm | Nút "I'm interested", hàng chờ Ops, mời theo luồng cũ | 3.3, 5, 7.2 |
| E. Pháp lý | Privacy, Terms, câu chữ trên form, báo trước | 12 |

Không thay đổi: luồng ghép thủ công §5.7 bước 2–6, giới hạn 5 lời mời, state machine 7.5 và 7.6, công thức gợi ý §8.10, công thức số liệu §8.11.

## 2. Thay spec §4 (dòng "Kết nối client–builder")

| Chủ đề | Quyết định |
|---|---|
| Kết nối client–builder | 3 đường: (1) client tự tìm product hoặc builder rồi gửi Inquiry; (2) danh bạ builder có bộ lọc; (3) client đăng request, admin chọn tối đa 5 builder để mời, builder gửi đề xuất, client chọn một. **Request mặc định riêng tư.** Client có thể chọn công khai **từng** request trên bảng `/requests`; bản công khai chỉ lên sau khi Ops kiểm duyệt và không bao giờ có danh tính client. Builder đã duyệt thấy request công khai thì bấm "I'm interested"; admin vẫn là người mời. Builder không gửi đề xuất trực tiếp từ bảng |

## 3. Luồng (sửa spec §5.7)

### 3.1 Bước 1 — Client gửi request (sửa)

Thêm vào form `/request`:

- **`country`** (Q1): một mã trong `COUNTRY_CODES` (`domain/countries.ts`, cùng danh sách với `builders.country`), tên hiển thị lấy từ `Intl` theo locale. Không tự điền từ `cf.country`.
- **Ô "Show this request on the public request board"**: mặc định **không** chọn. Chỉ hiện khi cờ `request_board` bật (mục 9.4). Ngay dưới ô là câu cảnh báo (mục 12.4): không ghi tên người, tên công ty, liên hệ, thông tin mật; ghép quốc gia + ngân sách + ngách cụ thể đôi khi đủ nhận ra một doanh nghiệp.
- Chọn ô → tạo dòng `request_publications` (`pending_review`) trong cùng batch tạo request, ghi `consent_version`. Không chọn → không có dòng nào; request riêng tư như M6.
- Request chưa xác nhận email (`pending_verification`) không vào hàng chờ kiểm duyệt. Request bị cron xóa sau 48 giờ thì dòng công khai bị xóa cùng.

**Không công khai hồi tố.** Request gửi trước khi tính năng bật không có dòng `request_publications`. Client có thể tự opt-in sau từ `/me` cho request đang mở (Q2); không có thao tác hàng loạt, không có migration điền dữ liệu.

### 3.2 Bước 1a — Ops kiểm duyệt bản công khai (mới)

Chạy song song và độc lập với bước 2 (ghép). Request có thể đang `submitted` hay `matching`.

1. Ops mở request trong `/ops/marketplace/requests/:id`, khối "Public listing": xem bản gốc của client; ô sửa `public_title` (≤ 120) và `public_description` (40–4000, văn bản thuần theo §8.6), điền sẵn từ bản gốc.
2. Ops chọn:
   - **Publish:** lưu bản đã sửa, chuyển `published`. Chỉ được khi request đang `submitted` hoặc `matching`.
   - **Reject publication:** bắt buộc lý do (≤ 1000), client thấy lý do. Request vẫn tiếp tục ghép riêng tư.
3. Các trường có cấu trúc (`category`, `budget_band`, `country`, `deadline`, `languages`) lấy trực tiếp từ `requests`, Ops không sửa ở đây (Q4).
4. Sau khi publish, Ops vẫn sửa được bản công khai (ghi audit) và có thể **Unpublish** (bắt buộc lý do).
5. Client nhận email khi được publish (ghi rõ nếu Ops đã sửa câu chữ), bị từ chối, hoặc bị gỡ (Q3, Q19).

**Danh mục kiểm duyệt cho Ops** (hiện ngay trong khối "Public listing"):
- Xóa tên người, tên công ty, email, số điện thoại, địa chỉ, link tới site của client, mã số, tên khách hàng của client.
- Xóa thông tin client ghi là mật hoặc nội bộ.
- Nếu ghép quốc gia + ngách + ngân sách vẫn đủ nhận ra doanh nghiệp: viết chung hơn, hoặc từ chối.
- Nội dung vi phạm Terms §7 (spam, trái luật, quảng cáo): từ chối; nếu là spam thì gỡ cả request (`removed`, luồng cũ).

### 3.3 Bước 1b — Builder bấm "I'm interested" (mới)

1. Builder `approved`, tài khoản `active`, mở `/requests/:publicId` đang **mở** (mục 7.3) → nút **I'm interested**.
2. Form nhỏ, POST cùng trang (Q9): ghi chú tùy chọn (≤ 500 ký tự, văn bản thuần) và một product tùy chọn trong số product `published` của chính builder.
3. Tạo dòng `request_interests` (`pending`). Builder thấy "You told us you're interested", có nút rút lại.
4. Không tạo được khi: builder là chính client của request; builder đã được mời cho request này; đã có dòng interest cho cặp (request, builder); request không còn mở; vượt rate limit (mục 9.1).
5. Interest **không** tạo lời mời, **không** gửi gì cho client, **không** đổi trạng thái request. Nó chỉ vào hàng chờ Ops.
6. Ops mời builder bằng luồng §5.7 bước 2 hiện có (cổng 5 lời mời trong câu `INSERT`). Builder nào có interest `pending` được mời (từ khối "Interested builders" hay từ danh sách gợi ý) → interest chuyển `invited` trong cùng batch mời.
7. Ops có thể **Dismiss** interest (không cần lý do; builder thấy "Not invited" trong Hub, không có email, Q12).

Từ bước 2 trở đi (§5.7 bước 2–6) giữ nguyên.

## 4. Trang và URL (sửa spec §5.2, §5.3, §5.4)

### 4.1 Trang public mới (thêm vào bảng §5.2)

| Route (không tính tiền tố locale) | Nội dung |
|---|---|
| `/requests` | Bảng request công khai. Chỉ request có hiển thị `open` (mục 7.3). Thẻ: `public_title`, category, budget band, country, ngôn ngữ, deadline, ngày đăng, 200 ký tự đầu của `public_description`. Lọc (Q14): category, budget band, ngôn ngữ. Thứ tự: `published_at` mới nhất, rồi `public_id` giảm dần. 24 thẻ/trang. Trạng thái rỗng: câu giải thích + CTA **Post a request**, **Browse products**; không có request mẫu |
| `/requests/:publicId` | Chi tiết: `public_title`, nhãn Open/Closed, category, budget band, country, deadline ("No deadline" khi null), ngôn ngữ, ngày đăng, `public_description` (render văn bản thuần §8.6), câu "The client's identity is not shown. The VNX.SI team invites up to five builders." và khối CTA (mục 4.2) |
| `POST /requests/:publicId/interest` | Tạo interest (mục 3.3). `POST /requests/:publicId/interest/withdraw` để rút. Không có GET |

- Tiền tố locale theo ADR-003: `/vi/requests`, `/zh-hans/requests/:publicId`… Giao diện dịch 4 locale; nội dung request giữ nguyên ngôn ngữ client viết, không dịch.
- Budget band hiện bằng nhãn i18n đã có của form request (gồm cả `unsure`). Không có trường số tiền chính xác (Owner 2026-10-07).
- `:publicId` là ULID riêng của `request_publications` (mục 6), **không** phải `requests.id` và **không có slug** (Q17). Lý do: tiêu đề có thể đã bị Ops sửa vì chứa dữ liệu riêng; slug lấy từ tiêu đề sẽ nằm lại trong URL, log và bộ đệm máy tìm kiếm.
- `/request` (form, số ít) giữ nguyên. Không trùng `/me/requests`, `/admin/requests`, `/ops/marketplace/requests` vì các route đó có tiền tố riêng.
- Request không hiển thị (mục 7.3 `hidden`) → 404 theo locale, không tiết lộ là tồn tại (giống §5.2 cho product, builder).
- **Trên trang không bao giờ có:** tên client (kể cả bản che `builderFacingName`), email, `client_user_id`, `locale`, `admin_note`, bản gốc của client, số lời mời, đề xuất, số builder quan tâm (Q11), kết quả (`builder_selected` hay `expired`; chỉ ghi "Closed").

### 4.2 Khối CTA trên `/requests/:publicId` (Q8)

| Người xem | Hiện |
|---|---|
| Chưa đăng nhập | Nút "I'm a builder — I'm interested" → `/login?next=/requests/:publicId` (đúng locale) |
| Đã đăng nhập, chưa là builder | Câu ngắn + link `/for-builders` |
| Builder `pending` / `rejected` / `suspended` | Câu "Available once your builder profile is approved", không có nút |
| Builder `approved`, đủ điều kiện | Form "I'm interested" (mục 3.3) |
| Builder đã có interest | Trạng thái interest + nút rút (khi còn `pending`) |
| Builder đã được mời | Link tới lời mời trong `/hub/invitations/:id` |
| Chính client của request | Link tới `/me/requests/:id`, không có nút |
| Request `closed` (mục 7.3) | Chỉ nhãn "This request is closed" + CTA **Post a request** |

### 4.3 `/me` (thêm vào §5.4)

Trang `/me/requests/:id` có khối "Public listing":
- Chưa opt-in, request đang mở, cờ bật: nút opt-in (cùng câu chữ mục 12.4), tạo dòng `pending_review` (Q2).
- `pending_review`: "Waiting for review", nút **Remove from board**.
- `published`: link tới trang công khai, bản công khai đúng như đang hiện, nút **Remove from board** (Q5).
- `rejected` / `unpublished`: lý do của Ops.
- `withdrawn`: nút opt-in lại nếu Q6 cho phép.

### 4.4 Builder Hub (thêm vào §5.3)

`/hub/invitations` có thêm mục "Requests you're interested in": `public_title` (chỉ khi request còn hiển thị; nếu không thì "No longer public"), ngày bấm, trạng thái `pending` / `invited` / `not invited` (= `dismissed`, hoặc request đã đóng mà chưa được mời). Không có email kèm (Q12).

## 5. Ops (sửa spec §5.5 và spec Ops console §2)

- **Overview** (`/ops`): thêm hai thẻ hàng chờ: "Public requests to review" (publication `pending_review` của request đang mở), "Interests waiting" (interest `pending` của request đang mở, builder công khai).
- **`/ops/marketplace/requests`**: thêm bộ lọc `public=pending` (không thêm tab; Requests đã có 9 tab). Cột "Public" trong danh sách: `—` / `review` / `published` / `rejected` / `withdrawn` / `unpublished`.
- **Chi tiết request:** thêm khối "Public listing" (mục 3.2) và khối "Interested builders": tên, handle, ngày, ghi chú, product đính kèm, điểm gợi ý §8.10 (chỉ để tham khảo), nút **Invite** (gọi đúng hành động mời hiện có) và **Dismiss**. Builder không còn công khai bị ẩn (`publicBuilderOnly`).
- **Quyền:** capability Marketplace của ADR-010 (Owner, Operator) (Q18). Content và Viewer không thấy bản gốc, không thao tác.
- `/admin/requests` không có tính năng mới (đang chuyển sang `/ops` ở VNX-2508).
- Mọi thao tác ghi `audit_log` trong cùng `db.batch` với thay đổi: `request_publication.opt_in`, `.publish`, `.edit`, `.reject`, `.withdraw`, `.unpublish`; `request_interest.create`, `.withdraw`, `.dismiss`, `.invite`. `data` của audit không chứa câu chữ công khai hay ghi chú (projection Ops theo ADR-010 mục 5).

## 6. Data model (sửa spec §6.1)

Migration mới, chỉ thêm. **Số migration là điểm phối hợp, không đoán:** `origin/main` có `0001`–`0016`; nhánh EPIC 26 (`feat/epic26-linked-accounts`, chưa merge) đã dùng `0017_user_identities.sql`; ghi chú "O2 bắt đầu từ `0017`" trong CURRENT-STATUS đã cũ; Open Templates MVP không có migration. Plan của epic này lấy **số trống kế tiếp trên `main` lúc cắt nhánh**, và đổi tên file nếu lúc merge `main` đã dùng số đó (cùng luật (c) của plan EPIC 26). Bảng mới thuộc module `matching` (cùng `requests`); thêm vào `WRITERS` của test kiến trúc.

**`requests`**, thêm cột:

| Cột | Ghi chú |
|---|---|
| `country` | ISO 3166-1 alpha-2, nullable (dòng cũ = null). Có bắt buộc với request mới hay không: Q1. Kiểm theo `COUNTRY_CODES` ở domain; CHECK `country IS NULL OR length(country) = 2` |

**`request_publications`** (mới; mỗi request tối đa một dòng; lịch sử nằm ở `audit_log`):

| Cột | Ghi chú |
|---|---|
| `request_id` | PK, FK `requests` |
| `public_id` | ULID riêng, UNIQUE; dùng trong URL |
| `status` | `pending_review` / `published` / `rejected` / `withdrawn` / `unpublished` (mục 7.1) |
| `public_title` | null tới lần publish đầu; ≤ 120 |
| `public_description` | null tới lần publish đầu; 40–4000 |
| `opted_in_at` | lần opt-in gần nhất |
| `consent_version` | ngày phiên bản Privacy/Terms đang hiện khi client opt-in (bằng chứng đồng ý) |
| `reviewed_by`, `reviewed_at` | người Ops thao tác gần nhất |
| `review_note` | lý do reject / unpublish; client thấy; ≤ 1000 |
| `published_at` | chỉ đặt ở lần publish **đầu tiên**; opt-in lại hay sửa không đẩy request lên đầu bảng (cùng tiền lệ `products.published_at`, Owner 2026-10-04) |
| `ended_at` | thời điểm `withdrawn` / `unpublished` |
| `created_at`, `updated_at` | `updated_at` là mốc compare-and-set, như M6 |

CHECK: `status = 'published'` ⇒ `public_title`, `public_description`, `published_at` khác null. Index: `(status, published_at)`.

**`request_interests`** (mới):

| Cột | Ghi chú |
|---|---|
| `id` | ULID |
| `request_id` | FK `requests` |
| `builder_id` | FK `builders(user_id)` |
| `note` | nullable, ≤ 500, văn bản thuần (Q9) |
| `product_id` | nullable, FK `products`; khi gửi phải là product `published` của chính builder (Q9) |
| `status` | `pending` / `invited` / `dismissed` / `withdrawn` (mục 7.2) |
| `decided_by`, `decided_at` | Ops (dismiss, invite) |
| `created_at`, `updated_at` | |

UNIQUE `(request_id, builder_id)`. Index: `(request_id, status)`, `(builder_id, created_at)`.

Không có cột tiền, điểm, ưu tiên hay "boost" ở cả hai bảng (ADR-004).

Xóa dữ liệu: request bị cron xóa (chưa xác nhận) hoặc tài khoản bị xóa → xóa dòng `request_publications` và `request_interests` của request đó. Plan phải sửa `deleteExpiredPendingRequests` và đường xóa tài khoản để không vướng FK.

## 7. State machine (bổ sung spec §7)

Hàm thuần trong `domain/`, chuyển không hợp lệ → 409, mỗi chuyển ghi audit (như §7).

### 7.1 Bản công khai (mới, §7.7)

```
(client opt-in) ──► pending_review ──Ops publish──► published ──Ops unpublish──► unpublished
                         │                              │
                         ├──Ops reject──► rejected       │
                         └──client gỡ──► withdrawn ◄─────┘ (client gỡ)
                                            └──client opt-in lại (Q6)──► pending_review
```

- `publish` chỉ khi request đang `submitted` hoặc `matching`.
- `withdraw` được ở mọi trạng thái request (Q5), có hiệu lực ngay.
- `rejected`, `unpublished` là trạng thái cuối (client không gửi lại được, Q6).
- Ops sửa câu chữ khi `published`: không đổi trạng thái, ghi audit `.edit`.

### 7.2 Interest (mới, §7.8)

```
pending ──Ops mời builder (mọi đường mời)──► invited
   ├──Ops dismiss──► dismissed
   └──builder rút──► withdrawn
```

- Cả ba trạng thái đích là cuối. Không tạo lại interest cho cùng cặp (request, builder).
- Request rời trạng thái mở: interest `pending` **không** đổi trạng thái; mọi truy vấn hàng chờ lọc theo trạng thái request, Hub hiện "not invited". Không cần cron.

### 7.3 Hiển thị công khai theo trạng thái request (bổ sung §7.5)

Một hàm thuần `requestVisibility(request.status, publication.status, closed_at, now)` → `open` / `closed` / `hidden`. Trang, danh sách, sitemap và nút interest đều dùng hàm này.

| `requests.status` | Bản công khai `published` | Bản công khai khác `published` hoặc không có |
|---|---|---|
| `pending_verification` | không thể xảy ra | `hidden` |
| `submitted`, `matching` | **`open`**: trang 200, indexable, trong `/requests` và sitemap, nút interest bật | `hidden` |
| `builder_selected`, `rejected`, `expired`, `closed` | **`closed`** tới `closed_at` + N ngày (Q7): trang 200 ghi "Closed", `noindex`, ngoài `/requests` và sitemap, nút interest tắt. Sau đó `hidden` | `hidden` |
| `removed` (spam, khóa user theo F7 của M6) | `hidden` ngay | `hidden` |

- `hidden` = 404.
- Builder bị khóa, user bị khóa: không ảnh hưởng trang request; interest của builder đó bị ẩn khỏi Ops (`publicBuilderOnly`).
- State machine 7.5 và 7.6 **không đổi**: không có chuyển trạng thái request hay lời mời mới; publication và interest không chặn chuyển nào của request.

## 8. SEO (thay spec §8.8 câu "Request không bao giờ có trang public.")

- **Sitemap:** thêm `/requests/:publicId` × 4 locale, kèm `xhtml:link` hreflang, khi hiển thị là `open`; `lastmod` = `request_publications.updated_at`. `/requests` (danh sách) vào sitemap theo Q13. Sitemap đang cache 1 giờ, nên request vừa đóng có thể còn trong sitemap tối đa 1 giờ; chấp nhận.
- **robots.txt:** không chặn `/requests`. Không thêm dòng nào.
- **Trang `closed`:** `<meta name="robots" content="noindex">`, không canonical, không hreflang (luật VNX-0404a cho trang `noindex`). HTTP 200.
- **Trang `open`:** title, meta description (160 ký tự đầu `public_description`), canonical, hreflang, Open Graph (`og:type = website`, không ảnh riêng).
- **JSON-LD:** không có ở bản đầu. **Không dùng `JobPosting`**: schema này cần `hiringOrganization` (lộ danh tính client) và có chính sách riêng của máy tìm kiếm. `BreadcrumbList` thêm khi task JSON-LD chung (review execution plan, giai đoạn 1 mục 4) làm.
- Request công khai, giống product, không có bản riêng cho từng locale: cả 4 URL locale có cùng nội dung request, khác giao diện.

## 9. Kỹ thuật khác

### 9.1 Rate limit, chống spam (bổ sung §8.2)

- `POST …/interest`: chỉ builder `approved` trên tài khoản `active`; Origin check như mọi POST; không Turnstile (người đã đăng nhập, theo quyết định Owner M5).
- Giới hạn qua bảng `rate_limits` (Q10, số chưa chốt): khóa `interest:builder:<id>` theo ngày; và trần số interest `pending` cùng lúc của một builder, kiểm trong câu `INSERT` (như cổng 5 lời mời).
- Opt-in từ `/me`: dùng chung giới hạn của thao tác `/me` hiện có; một request chỉ có một dòng.
- Đọc `/requests*` hàng loạt: Owner thêm rule Rate limiting Cloudflare cho `/requests*` như đã làm cho `/p/*`, `/go/*` (việc Owner, không đổi code). Terms §7 đã cấm thu thập dữ liệu quy mô lớn.

### 9.2 Email (bổ sung §8.3)

Template mới, 4 locale, gửi client (Q19): bản công khai được publish (kèm link, ghi rõ nếu Ops đã sửa), bị từ chối (kèm lý do), bị gỡ (kèm lý do). Không email cho builder khi bấm, khi bị dismiss hay khi request đóng (Q12). Không email cho Ops theo từng interest (đã có thẻ Overview). Lỗi gửi không hoàn tác thay đổi (khuôn `notify/` M6).

### 9.3 Cron (§8.4)

Không có bước mới. Hiển thị được tính lúc render và lúc tạo sitemap (mục 7.3). Bước xóa request chưa xác nhận sửa theo mục 6.

### 9.4 Cờ tính năng

Key mới `request_board` trong `FLAG_KEYS` (EPIC 21; EPIC 26 cũng thêm key: điểm phối hợp khi merge). Cờ tắt: không ô opt-in, không nút opt-in ở `/me`, `/requests*` 404, không có trong sitemap; dữ liệu đã có giữ nguyên. Owner chỉ bật sau khi Privacy/Terms mới có hiệu lực (mục 12.5).

### 9.5 Gợi ý builder (§8.10)

Công thức **không đổi**. Interest hiện ở khối riêng, không cộng điểm. Đổi trọng số phải qua spec (ADR-004). Dữ liệu interest → mời → đề xuất → được chọn được giữ để Wave 2 dùng cho matching.

### 9.6 Số liệu (§8.11, §3)

- §8.11 không đổi. "Request 30 ngày", "Request theo category" (gộp nhóm dưới 3 vào "Other") vẫn đếm mọi request, công khai hay không. Dải Recent activity giữ nội dung cũ (chỉ category, ngôn ngữ), không link sang trang công khai.
- Không hiện công khai số builder quan tâm hay số request công khai ở bản này (Q11). Nếu sau này hiện số nào thì theo ngưỡng của ADR-004.
- Bảng thước đo §3 (Ops O2) thêm: tỷ lệ request opt-in; số bản `published`, `rejected`; số interest; tỷ lệ interest → mời → được chọn.

## 10. Hiệu năng

- Trang `/requests` và `/requests/:publicId`: ≤ 8 truy vấn D1 (NFR).
- Danh sách đọc qua index `(status, published_at)` của `request_publications` nối `requests`.

## 11. Ràng buộc cứng (nhắc lại)

- **ADR-004:** thứ tự bảng là organic (mới publish trước). Không tham số, cột, nhãn "featured", "boost" hay "urgent" trả tiền, kể cả client trả tiền để đẩy request. File truy vấn của bảng vào `RANKING_FILES` của test kiến trúc (không đọc bảng tiền).
- **Không dữ liệu cá nhân của client trên trang công khai** (mục 4.1). Builder chỉ thấy bản gốc khi được mời (như M6).
- **Không request mẫu bịa** trên giao diện. Dữ liệu mẫu chỉ có trong prototype và test. Bảng rỗng thì hiện trạng thái rỗng.
- **CSP:** không `<script>` hay `style=` inline. Form interest, opt-in, lọc là form HTML thuần, chạy không cần JS.
- **Body limit 64 KB** cho mọi POST (form lớn nhất là ô sửa `public_description` ≤ 4000 ký tự). Handler POST không redirect ra ngoài site.
- **Referrer-Policy:** trang có form POST sau Origin check không được dùng `no-referrer` (bài học VNX-0803 F1); giữ mặc định của site.
- HTML khi đã đăng nhập: `no-store` (VNX-0803 F8).
- Nội dung do client và Ops viết render văn bản thuần (§8.6); cấm `dangerouslySetInnerHTML`.

## 12. Privacy và Terms (đề xuất, **CHƯA DUYỆT**)

> **Trạng thái:** bản đề xuất của Reviewer. **Owner chưa duyệt.** Không chép vào `docs/legal/*` hay `src/legal/content.ts` trước khi Owner duyệt nguyên văn. Không phải tư vấn pháp lý; nên nhờ người có chuyên môn đọc lại (NĐ 13/2023, GDPR).

### 12.1 Thay đổi so với lời hứa hiện tại

Privacy §4 hiện hứa: "a builder invited to your request also sees the request" (chỉ builder được mời thấy). Bảng công khai đổi lời hứa này cho request **được opt-in**. Đây là thay đổi quan trọng theo Privacy §10 và Terms §12 → báo trước (mục 12.5). Căn cứ pháp lý cho việc công khai: **sự đồng ý** (opt-in từng request, rút lại được bất cứ lúc nào).

### 12.2 Privacy, bản EN đề xuất

**Mục 2, sửa gạch "Requests"** (thêm country):
- **Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline, the languages you want to work in and the country you choose. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.

*(Q1: country tùy chọn.)*

**Mục 2, thêm gạch sau "Requests":**
- **Public requests:** if you choose to show a request on our public request board, we record when you chose it and which version of this policy you saw. Our team reviews the request first and may shorten or edit the title and description to remove details that could identify you or others. We keep the version we publish next to your original.
- **Interest in public requests:** if you are a builder and tell us you are interested in a public request, we record that, when, and the note or product you add.

**Mục 3, thêm gạch sau "To match requests with builders…":**
- To show the requests their authors chose to make public, so that builders can find them and tell us they are interested. Our team still decides which builders to invite.

**Mục 3, thêm vào đoạn căn cứ:**
For public requests we rely on your consent. You can withdraw it at any time from your account page; the request then leaves the public board straight away, and it does not change what happened before.

**Mục 4, thay gạch thứ hai bằng:**
- Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request. If you chose to make a request public, anyone, including search engines, can see the version we published, its category, budget range, country, deadline and languages, but never your name, email address or account.

**Mục 4, thêm gạch:**
- When a builder tells us they are interested in a public request, only our team sees it. The client does not see it unless we invite that builder.
- Search engines and other sites may keep copies of a public page for some time after we close or remove it. We ask search engines not to index closed requests, but we cannot delete copies that others hold.

**Mục 6, thêm gạch sau "Requests and proposals…":**
- Public requests: shown while the request is open and for 30 days after it closes, unless you or we remove it earlier. The published version and your choice are then kept with the request, under the rule above. Interest records: under the same rule as requests.

*(Q7: 30 ngày.)*

### 12.3 Terms, bản EN đề xuất

**Mục 6 (Clients), thêm đoạn:**
**Public requests.** You can choose to show a request on our public request board. If you do: do not include other people's personal data, contact details, or information you are not allowed to share; we review the request before it is shown and may edit it, refuse it or remove it at any time; you can remove it at any time from your account page. A builder telling us they are interested does not create any agreement, and we still choose which builders to invite.

**Mục 5 (Builders and listings), thêm gạch:**
- If you tell us you are interested in a public request, what you write must be true. Use the request board only to find work through VNX.SI.

**Mục 7 (What you must not do), thêm gạch:**
- Try to identify the author of a public request, contact them outside VNX.SI, or copy public requests to other sites.

### 12.4 Câu chữ trên giao diện (cần Owner duyệt, 4 locale)

Ô opt-in trên `/request` và nút ở `/me`:
- Nhãn: *"Show this request on the public request board"*
- Mô tả: *"Our team reviews it first and may edit it to remove details that could identify you. Your name and email are never shown. You can remove it at any time from your account. Don't include names, company names, contact details or confidential information. Country, budget and a very specific niche together can sometimes identify a business."*

### 12.5 Ngôn ngữ, phiên bản và báo trước

- **vi:** Reviewer viết bản VI sau khi Owner duyệt bản EN; Owner duyệt bản VI nguyên văn (như M5–M7).
- **zh-Hans, zh-Hant:** trang Privacy/Terms hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" (như hiện nay). Câu chữ giao diện (12.4) và email (9.2) dịch bằng AI, người bản xứ đọc lại trước khi quảng bá (§5.1).
- **Hai phiên bản Privacy:** cho tới task dọn sau D(M7) + 31 ngày, mọi thay đổi Privacy phải sửa **cả** `privacy.md` và `privacy-m7.md`, và cả bốn hằng số `privacyEn`, `privacyVi`, `privacyEnM7`, `privacyViM7`. EPIC 26 (VNX-2607) cũng sửa các tệp này: điểm phối hợp khi merge.
- **Báo trước (Privacy §10, Terms §12):** người đã đăng nhập thấy thông báo trước khi thay đổi có hiệu lực, theo khuôn VNX-0701c (Q15: số ngày và cơ chế). Cờ `request_board` chỉ bật từ ngày có hiệu lực.
- Ngày "Last updated" của Privacy và Terms đổi sang ngày có hiệu lực.

## 13. Test bắt buộc (bổ sung spec §9)

- **Domain:** mọi chuyển hợp lệ và không hợp lệ của 7.1, 7.2; `requestVisibility` cho mọi ô của bảng 7.3, kể cả đúng và ngay sau `closed_at + N`; `country` ngoài `COUNTRY_CODES` bị từ chối.
- **Không lộ dữ liệu:** HTML `/requests` và `/requests/:publicId` không chứa email, `client_name`, bản che tên, `admin_note`, bản gốc (khi Ops đã sửa), số lời mời, đề xuất. Fixture có giá trị dễ nhận ra để assert vắng mặt.
- **Không hồi tố:** request tạo không chọn ô → không có dòng `request_publications`, trang 404; migration không tạo dòng nào.
- **Kiểm duyệt:** `pending_review` → 404 công khai; publish khi request `pending_verification` hay đã đóng → 409; chỉ Owner/Operator thao tác được (Content, Viewer, người lạ → 404 kín theo ADR-010); audit cùng batch.
- **Hiển thị theo trạng thái:** open → 200, trong danh sách và sitemap; mỗi trạng thái cuối → 200 "Closed", `noindex`, không canonical, ngoài danh sách và sitemap, không có form interest; `removed` → 404; client gỡ → 404 ngay; cờ tắt → 404 và ngoài sitemap.
- **Interest:** chỉ builder `approved` + `active`; chính client, builder đã mời, interest trùng, request đóng → bị chặn; rate limit; thiếu `Origin` → 403; mời builder có interest `pending` → interest `invited` trong cùng batch, cổng 5 lời mời vẫn giữ (lời mời thứ 6 không tạo được dù có interest).
- **Thứ tự:** `published_at` giảm dần; opt-in lại không đổi `published_at`; file truy vấn bảng nằm trong `RANKING_FILES` và không đọc bảng tiền.
- **i18n:** parity key 4 locale; hreflang đúng trên trang `open`.
- **Hiệu năng:** ≤ 8 truy vấn D1 mỗi trang.
- **Pháp lý:** test nội dung Privacy so cả hai phiên bản với tệp md (khuôn `test/legal/content.test.ts`).

## 14. Ngoài phạm vi (thay dòng trong spec §11) và rủi ro (§12)

Trong §11, **bỏ** "request board công khai để builder tự tìm việc". **Thêm:** builder gửi đề xuất hay gắn product trực tiếp lên bảng mà không qua lời mời; hiện công khai số builder quan tâm; JSON-LD `JobPosting`; dịch nội dung request; công khai hồi tố hay hàng loạt; request công khai trong newsletter (review execution plan mục 3); khối "Open requests" trên homepage (làm cùng homepage 3 cột nếu Owner muốn, theo ADR-004).

**Rủi ro thêm vào §12:**

| Rủi ro | Ảnh hưởng | Xử lý |
|---|---|---|
| Nhận diện được client qua ghép quốc gia, ngân sách, ngách | Lộ thông tin kinh doanh, khiếu nại | Opt-in có cảnh báo, Ops kiểm duyệt theo danh mục 3.2, client gỡ được ngay |
| Builder liên hệ client ngoài platform | Mất lead, spam client | Không có danh tính trên trang; Terms §7 mới; Ops dismiss / khóa builder vi phạm |
| Builder bấm interest hàng loạt | Hàng chờ Ops quá tải | Rate limit + trần `pending` (Q10) |
| Ops không kịp duyệt | Request chờ lâu mới lên bảng | Thẻ Overview; đo thời gian opt-in → publish ở O2 |
| Bảng ít request trông trống | Builder mất hứng | Không bịa mẫu; `/requests` theo Q13 |
| Bản lưu của máy tìm kiếm sau khi gỡ | Lời hứa xóa không trọn | Privacy nói rõ (12.2); `noindex` khi đóng; Owner có thể dùng công cụ gỡ URL của Search Console khi client yêu cầu |

## 15. Tài liệu phải sửa khi phụ lục được duyệt

Reviewer làm, trong commit tài liệu riêng sau khi Owner duyệt:
- Spec Wave 1: dòng "Phụ lục" ở đầu trỏ tới phụ lục này.
- `docs/blueprint/02-NFR.md` mục Riêng tư ("Request không có trang công khai") và mục rate limit.
- `docs/blueprint/03-DOMAIN-CATALOG.md` (Request "không public"; thêm `request_publications`, `request_interests`).
- `docs/blueprint/05-UI-SCOPE.md` (thêm `/requests`, `/requests/:publicId`).
- `docs/blueprint/07-MASTER-BACKLOG.md`: VNX-1901 ghi "thay bằng EPIC 27"; thêm EPIC 27.
- `docs/roadmap/WAVE1-ROADMAP.md`: thêm mục EPIC 27 và cổng ra.
- Spec Ops console §2: thẻ Overview và khối chi tiết request.

Không cần ADR mới: không đổi kiến trúc đã khóa (cùng Worker, D1, module `matching`; ADR-004 giữ nguyên và được áp vào bề mặt mới).

## 16. Task và vị trí trong roadmap (đề xuất)

**EPIC 27 — Bảng request công khai** (ID **đề xuất**; EPIC 26 là số lớn nhất đang dùng; Open Templates chưa nhận số epic). Kéo từ Wave 4 (VNX-1901) lên. Đặt **sau M7**, khi M7 đã deploy và Owner đã chọn ngày D của M7. Độc lập với EPIC 26 về chức năng; phối hợp ở số migration, `FLAG_KEYS`, các tệp Privacy và `content.ts`. Thứ tự so với M8 và EPIC 26: Owner chốt khi duyệt plan.

| Task (đề xuất) | Nội dung | Tag |
|---|---|---|
| VNX-2701 | Owner duyệt phụ lục, câu chữ mục 12 (EN rồi VI), trả lời mục 17 | HUMAN |
| VNX-2702 | Migration (số kế tiếp trên `main`): `requests.country`, `request_publications`, `request_interests`; domain thuần 7.1, 7.2, 7.3; cờ `request_board`; test kiến trúc (`WRITERS`, `RANKING_FILES`); sửa đường xóa request / tài khoản | AGENT, FOUNDATION |
| VNX-2703 | Form `/request` (country, ô opt-in), khối "Public listing" ở `/me/requests/:id` (opt-in, gỡ) | AGENT |
| VNX-2704 | Ops: thẻ Overview, bộ lọc, khối "Public listing" (sửa, publish, reject, unpublish), audit, 3 email cho client | AGENT, HIGH-RISK |
| VNX-2705 | `/requests`, `/requests/:publicId`, hiển thị 7.3, khối CTA, SEO (sitemap, `noindex`, hreflang, OG) | AGENT, HIGH-RISK |
| VNX-2706 | Interest: POST + rút, rate limit, mục Hub, khối "Interested builders" ở Ops, mời → `invited` cùng batch | AGENT |
| VNX-2707 | Chép Privacy/Terms đã duyệt vào cả hai phiên bản Privacy, Terms, `content.ts`; thông báo trước (Q15) | AGENT |
| VNX-2708 | Owner: rule Rate limiting `/requests*`, đặt ngày hiệu lực, bật `request_board` sau ngày đó, smoke production | HUMAN, HIGH-RISK |

**Cổng ra EPIC 27:** test mục 13 xanh; Privacy và Terms mới đang hiện trên production và đã qua thời gian báo trước trước khi bật cờ; một request thật đi hết opt-in → publish → interest → mời → đóng → `noindex` trên production.

## 17. Câu hỏi cho Owner (đã chốt)

**Owner 2026-10-07: duyệt toàn bộ khuyến nghị dưới đây.** Plan EPIC 27 dùng đúng các giá trị này. Câu 15 chọn phương án chính: không chờ task dọn Privacy M7.

1. **Country: bắt buộc hay tùy chọn, nghĩa là gì, danh sách nào?** Khuyến nghị: **tùy chọn**, nghĩa "Where is your business based?", danh sách `COUNTRY_CODES` (ISO 3166-1, giống builder), không tự điền từ IP; trang công khai chỉ hiện khi có. Tùy chọn giảm rủi ro nhận diện và không làm form dài thêm.
2. **Client có được opt-in sau từ `/me` cho request đang mở, kể cả request gửi trước khi tính năng bật?** Khuyến nghị: **có**, từng request một, phải qua kiểm duyệt; không bao giờ tự động hay hàng loạt. Đây vẫn là đồng ý rõ ràng theo chính sách mới, không phải công khai hồi tố.
3. **Ops sửa câu chữ thì client có phải duyệt lại trước khi lên bảng?** Khuyến nghị: **không**; publish ngay, email cho client ghi rõ "đã sửa" kèm link và nút gỡ; `/me` hiện đúng bản công khai.
4. **Ops có được ẩn riêng một trường có cấu trúc (country, deadline)?** Khuyến nghị: **không** ở bản đầu; nếu trường đó gây nhận diện thì viết chung phần mô tả hoặc từ chối. Ít trạng thái hơn.
5. **Client có gỡ được sau `builder_selected` (và mọi trạng thái)?** Khuyến nghị: **có, luôn luôn, có hiệu lực ngay**, vì căn cứ là sự đồng ý và đồng ý phải rút được bất cứ lúc nào.
6. **Opt-in lại sau khi gỡ? Gửi lại sau khi Ops từ chối hoặc gỡ?** Khuyến nghị: sau khi **client tự gỡ**: được, khi request còn mở, qua kiểm duyệt lại, không đổi `published_at`. Sau khi **Ops từ chối hoặc gỡ**: không.
7. **Request đã đóng hiện "Closed" bao lâu?** Khuyến nghị: **30 ngày** sau `closed_at`, rồi 404. Đủ cho link đã chia sẻ, giữ dữ liệu công khai ở mức tối thiểu.
8. **Người chưa đăng nhập có thấy CTA "I'm interested"?** Khuyến nghị: **có**, dẫn tới `/login?next=…`; người đã đăng nhập chưa là builder thấy link `/for-builders`; builder chưa duyệt thấy câu "available once approved" (bảng 4.2).
9. **Interest có ghi chú và gắn product không?** Khuyến nghị: **có, cả hai tùy chọn**: ghi chú ≤ 500 ký tự, một product `published` của chính builder. Đáp ứng ý "attach an existing product" của execution plan §22 mà builder vẫn không gửi đề xuất trực tiếp.
10. **Giới hạn interest?** Khuyến nghị: **10 lần/ngày mỗi builder**, tối đa **30** interest `pending` cùng lúc; không Turnstile.
11. **Hiện công khai số builder quan tâm?** Khuyến nghị: **không** ở bản đầu (dễ bị thổi phồng, làm client nhận diện được, đụng ngưỡng ADR-004).
12. **Báo builder khi bị dismiss hoặc request đóng mà không được mời?** Khuyến nghị: **không email**; trạng thái hiện trong Hub.
13. **Trang danh sách `/requests` khi còn ít request; lối vào ở đâu?** Khuyến nghị: luôn mở được, nhưng `noindex` và ngoài sitemap khi có **dưới 5** request `open` (tránh trang mỏng); link từ `/for-builders` và footer; header để cùng đợt homepage 3 cột.
14. **Bộ lọc và tìm kiếm trên bảng?** Khuyến nghị: lọc category, budget band, ngôn ngữ; chưa có tìm kiếm chữ và lọc quốc gia ở bản đầu.
15. **Báo trước: bao nhiêu ngày, cơ chế nào, có chờ task dọn Privacy M7 không?** Khuyến nghị: **14 ngày** như M7, áp cho cả Privacy và Terms. Không chờ task dọn: VNX-2707 tổng quát `privacyVersion` thành danh sách phiên bản có ngày hiện (biến `REQUEST_BOARD_GO_LIVE` commit trong `wrangler.jsonc` như `PRIVACY_NOTICE_GO_LIVE`, không đặt bằng `--var`). Nếu Owner muốn đơn giản hơn thì đặt EPIC 27 sau task dọn (sau D(M7) + 31 ngày).
16. **Có cần người có chuyên môn pháp lý đọc mục 12 trước khi bật?** Khuyến nghị: **có**, ít nhất một lượt cho NĐ 13/2023 (công khai dữ liệu có thể gắn với doanh nghiệp, cá nhân kinh doanh) trước VNX-2708.
17. **URL có slug từ tiêu đề không?** Khuyến nghị: **không**, chỉ `/requests/:publicId` (lý do ở mục 4.1). Mất một ít lợi ích SEO, đổi lại không lộ câu chữ đã bị sửa.
18. **Vai trò Ops nào kiểm duyệt?** Khuyến nghị: Owner và **Operator** (capability Marketplace của ADR-010); Content và Viewer không.
19. **Gửi email cho client khi publish, từ chối, gỡ?** Khuyến nghị: **có**, 3 template mới × 4 locale (mục 9.2).
