# VNX-2105 — Cầu nối trang tool sang marketplace · Plan

- **Trạng thái:** APPROVED. Owner duyệt hướng ngày 2026-10-06 (đề xuất "Bước 2" trong hội thoại, trả lời "approve"); Reviewer duyệt chi tiết theo ủy quyền điều phối.
- **Roadmap:** EPIC 21 (partner), sau lát mỏng VNX-2101…2104.
- **Spec:** phụ lục monetization `docs/superpowers/specs/2026-10-04-vnxsi-monetization-addendum.md` §3.4 (`/tools/:merchantSlug`); spec Wave 1 §5.2 (danh bạ), §8.7 (catalogue), §5.5 (request).
- **ADR:** ADR-004 (thứ tự organic, không đầu vào nào khác), ADR-007 (link kiếm tiền tách khỏi xếp hạng, disclosure).
- **Phụ thuộc:** `main` `f155765`.
- **Implementer / Reviewer:** subagent Claude (context mới) / Claude.

## Vì sao làm bây giờ

`/tools/elevenlabs` đã chạy thật nhưng là trang cụt: chỉ có mô tả và nút "Try ElevenLabs", không dẫn người đọc tới builder, product hay request trên VNX.SI. Trang này là nơi Owner chia sẻ link, nên nó phải đưa người đọc về phần marketplace.

## Phạm vi

**Trong phạm vi.** Trên `/tools/:slug` (4 locale), dưới khối offer, thêm theo thứ tự:

1. **"Products built with {name}"**: tối đa 6 product công khai có `tech_stack` chứa đúng tên merchant (không phân biệt hoa thường). Thứ tự giống `/products` khi không có từ khóa. Dùng lại `ProductCard`. Không có product nào thì ẩn cả khối, kể cả tiêu đề.
2. **"Builders who work with {name}"**: tối đa 6 builder công khai có `ai_tools` chứa đúng tên merchant (không phân biệt hoa thường). Thứ tự giống `/builders`. Dùng thẻ builder tách từ `DirectoryPage`. Không có ai thì ẩn cả khối.
3. **Hai thẻ CTA, luôn hiện:**
   - "Need something built with {name}?" → nút **Post a request** (`localizedPath(locale, "/request")`).
   - "Building with {name}?" → nút **Become a builder** (`builderCtaHref(locale, signedIn)`).

**Ngoài phạm vi** (Reviewer ghi vào "Ghi nhận"):

- Ảnh `og:image` mặc định của site: chưa có ảnh raster 1200×630, cần thiết kế riêng.
- Bộ lọc công khai `?tool=` trên `/builders` và `/products`, và link "See all".
- Bí danh cho tên merchant (ví dụ "Eleven Labs").
- Đo nguồn cho request hay builder đến từ trang tool.
- Trang chỉ mục `/tools`.
- Bật index.
- Bài viết EPIC 22.

## Thiết kế

1. **Lọc theo công cụ, chỉ dùng nội bộ:**
   - `DirectoryQuery` và `CatalogQuery` thêm trường tùy chọn `tool?: string`. Hai hàm `parseDirectoryQuery` và `parseCatalogQuery` **không** đọc trường này từ URL. Test phải chứng minh `?tool=` trên `/builders` và `/products` bị bỏ qua.
   - `searchBuilders` và `searchProducts`: khi có `tool`, thêm điều kiện `EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(<col>) THEN <col> ELSE '[]' END) WHERE value = ?n COLLATE NOCASE)`, với cột là `b.ai_tools` hoặc `p.tech_stack`, giá trị luôn bind.
   - ORDER BY, LIMIT, `PUBLIC_BUILDER` và `PUBLIC_PRODUCT` giữ nguyên. Nhờ đó thứ tự trên trang tool **chính là** thứ tự organic (ADR-004): tiền, offer hay merchant không đi vào truy vấn.
2. **Route (`src/routes/tools.tsx`):** sau khi có merchant `active`, gọi `searchBuilders(db, { …mặc định, tool: merchant.name, page: 1 })` và `searchProducts` tương tự, rồi lấy 6 kết quả đầu.
   - Tên merchant đọc từ DB. Test kiến trúc cấm viết tên partner trong `src`.
   - `tools.tsx` đã nằm trong `MONEY_ALLOWED` nên được import `db/directory`, `db/catalog`.
   - `db/directory.ts` và `db/catalog.ts` vẫn không import module tiền nào.
3. **View:**
   - `src/views/BuilderCard.tsx` (mới): tách đúng markup `<li>` của `DirectoryPage`. `DirectoryPage` dùng component này, HTML `/builders` giữ nguyên.
   - `BuilderCard` và `ProductCard` thêm prop tùy chọn `heading?: "h2" | "h3"`, mặc định `h2` để HTML cũ giữ nguyên. Trang tool dùng `h3` dưới tiêu đề khối `h2`.
   - `ToolPage.tsx` nhận thêm `builders`, `products`, `signedIn` (đã có).
   - Không khối mới nào nằm trong `section.offers`. Không link mới nào có `rel="sponsored"` hay `target="_blank"`.
   - Mô tả merchant vẫn bọc `lang="en"` trên các locale khác `en`, như hiện tại.
4. **i18n:** khóa mới ở cả 4 file locale, giữ đúng chữ trong bảng dưới. Nút dùng lại `request.cta` và `landing.cta.builder`.

   | Khóa | en | vi | zh-Hans | zh-Hant |
   |---|---|---|---|---|
   | `tools.products.title` | Products built with {name} | Sản phẩm xây bằng {name} | 使用 {name} 构建的产品 | 使用 {name} 建構的產品 |
   | `tools.builders.title` | Builders who work with {name} | Builder làm việc với {name} | 使用 {name} 的开发者 | 使用 {name} 的開發者 |
   | `tools.request.title` | Need something built with {name}? | Cần xây gì đó với {name}? | 需要用 {name} 构建什么吗？ | 需要用 {name} 建構什麼嗎？ |
   | `tools.request.body` | Describe what you need, and the VNX.SI team will invite up to five builders to send you a proposal. | Mô tả việc bạn cần, đội ngũ VNX.SI sẽ mời tối đa năm builder gửi đề xuất cho bạn. | 描述你的需求，VNX.SI 团队会邀请最多五位开发者向你提交方案。 | 描述你的需求，VNX.SI 團隊會邀請最多五位開發者向你提交方案。 |
   | `tools.builder.title` | Building with {name}? | Bạn đang xây sản phẩm với {name}? | 正在用 {name} 构建产品？ | 正在用 {name} 建構產品？ |
   | `tools.builder.body` | List your product so clients can find it and contact you on VNX.SI. | Đăng sản phẩm để client tìm thấy và liên hệ với bạn trên VNX.SI. | 发布你的产品，让客户找到你并在 VNX.SI 上联系你。 | 發佈你的產品，讓客戶找到你並在 VNX.SI 上聯絡你。 |

5. **CSS:** tái dùng `.cards`, `.card`, `.btn`. Hai thẻ CTA đặt cạnh nhau từ 768 px, xếp dọc dưới 768 px. Chỉ thêm class trong `public/assets/app.css`, không có `style=` inline (CSP).

## Tiêu chí chấp nhận → cách kiểm

Mọi lệnh chạy trong `apps/web` của worktree `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`. Test mới nằm ở `test/monetization/tools-bridge.test.ts`.

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Khối product hiện product công khai có `tech_stack` khớp tên merchant (thử cả `elevenlabs` viết thường ứng với merchant `ElevenLabs`). Không hiện product chưa publish, product của builder không công khai, product không khớp hay chỉ khớp một phần (`ElevenLabs API`). Không có product thì không có khối. Chạy cả 4 locale. | `npx vitest run test/monetization/tools-bridge.test.ts` |
| AC2 | Khối builder: giống AC1 nhưng với `ai_tools` và luật builder công khai (`approved` + user `active`). | cùng file |
| AC3 | Thứ tự hai khối trùng với thứ tự của `/builders` và `/products` trên cùng dữ liệu (availability, số product, badge, ngày duyệt). Mỗi khối tối đa 6. | cùng file |
| AC4 | Hai thẻ CTA luôn hiện, kể cả khi merchant không có offer nào. Link request đúng cho từng locale. Link builder đúng khi chưa đăng nhập (`/login?next=…/hub/apply`) và khi đã đăng nhập (`/hub`). | cùng file |
| AC5 | Link mới không có `rel="sponsored"`, không nằm trong `section.offers`. Disclosure, offer và `noindex` không đổi (test cũ xanh). | cùng file; `npx vitest run test/monetization/tools.test.ts` |
| AC6 | `?tool=` trên `/builders` và `/products` bị bỏ qua. HTML danh bạ và catalogue không đổi. | cùng file mới; `npx vitest run test/catalog` |
| AC7 | Test kiến trúc xanh: không có tên partner trong `src`, file xếp hạng không import module tiền, `MONEY_ALLOWED` không đổi. Parity i18n xanh. CSP scan xanh với `/tools/:slug`. | `npx vitest run test/architecture.test.ts test/i18n test/http/security-headers.test.ts` |
| AC8 | Typecheck sạch, toàn bộ test xanh. | `npm run typecheck -w apps/web`; `npm test` (hoặc theo thư mục) |
| AC9 | Giao diện ở 360 px và 1280 px, sáng và tối. | Reviewer xem |

## Câu hỏi mở

Không có. Câu chữ trong bảng i18n được duyệt cùng plan. Đổi câu chữ thì dừng và hỏi Reviewer.
