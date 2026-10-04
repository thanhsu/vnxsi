# VNX-0709 — Thiết kế lại đợt A: nền chung, header, footer, logo, Landing v2 · Plan

- **Trạng thái:** Draft
- **Roadmap:** M7, task mới VNX-0709 (làm trước go-live; Owner duyệt hướng thiết kế 2026-10-04). Thay giao diện của VNX-0708; thay một phần VNX-0703/0704 (khung homepage, không có khối số liệu).
- **Nguồn thiết kế (đã duyệt):** canvas prototype `https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm`, artboard **"Landing v2, from prototype homepage (desktop)"** (`project/LandingV2.dc.html`) và **"Landing v2 (390 px)"**; logo **Option B · Connected nodes** (`project/Logo.dc.html`). Implementer đọc file artboard bằng Artifact tool (`action: read`, `path: project/LandingV2.dc.html`) hoặc bản sao Reviewer để ở `docs/design/mockups/` (mục "Tài liệu kèm").
- **Audit và design system:** `docs/design/2026-10-04-ui-audit-and-redesign.md` (mục 2: token, typography, spacing, radius, shadow, motion, component). Quyết định Owner Q1–Q5 ở mục 0 của file đó.
- **Spec:** Wave 1 mục 5.9 (khối homepage, animation, `prefers-reduced-motion`, chỉ CSS + ít JS), 8.6, 8.8. ADR-001, ADR-003, ADR-004.
- **Phụ thuộc:** `main` có VNX-0705a (`19115d3`).
- **Implementer / Reviewer:** subagent / Claude

## Vì sao làm bây giờ

Owner đánh giá giao diện hiện tại "chưa ấn tượng, trông như AI làm". Audit cho thấy nguyên nhân chính là bản code bỏ rơi design system của prototype (không nạp font, không motion, header/footer sơ sài). Owner muốn sửa trước go-live.

## Phạm vi

**Trong phạm vi**
1. Font tự host.
2. Token CSS và component dùng chung (giữ tên class cũ).
3. Logo B: file SVG + favicon.
4. Header mới (mọi trang), menu ngôn ngữ, menu di động.
5. Footer mới (mọi trang).
6. Landing `/` theo artboard Landing v2, câu chữ EN/VI ở mục "Nội dung".
7. Media Kit: cập nhật nội dung theo `docs/legal/media-kit.md` (mục Logo files).
8. Motion theo mục "Motion".

**Ngoài phạm vi**
- Khối số liệu (Live, Trending, Market pulse, Top builders, hàng số đếm), `public_stats`, cron hằng giờ (M7 VNX-0701/0702).
- Thiết kế lại `/products`, `/p/:slug`, `/builders`, `/b/:handle` (đợt B), Hub, Admin (đợt C). Các trang này chỉ nhận header/footer/font/token mới, không đổi bố cục.
- Đổi route, logic form, DB, API.
- Dark mode cho landing ở mức "đẹp": landing phải **đọc được** ở dark mode (token có sẵn), không cần tinh chỉnh từng khối.

## Thiết kế

### 1. Font

- File `woff2` trong `apps/web/public/assets/fonts/`, kèm `OFL.txt` của từng họ chữ:
  - Space Grotesk 500, 600, 700
  - Be Vietnam Pro 400, 500, 600, 700
  - JetBrains Mono 400, 500
  - Subset: `latin`, `latin-ext`, `vietnamese` (Space Grotesk không có subset vietnamese: dùng `latin` + `latin-ext` + `vietnamese` nếu có, nếu không thì dấu tiếng Việt rơi về Be Vietnam Pro qua `font-family` fallback).
- Nguồn: gói `@fontsource/<họ chữ>` trên npm (OFL). Lấy file bằng `npm pack` vào thư mục tạm rồi chép đúng file cần; **không** thêm vào `package.json`.
- `@font-face` với `font-display: swap` và `unicode-range` theo subset; `<link rel="preload" as="font" type="font/woff2" crossorigin>` chỉ cho 2 file: Space Grotesk 700 latin, Be Vietnam Pro 400 latin.
- Tổng dung lượng các file font ≤ 400 KB (ghi số thật trong báo cáo).
- Chữ Trung: không tải font; stack `"PingFang SC","PingFang TC","Microsoft YaHei","Microsoft JhengHei","Noto Sans CJK SC","Noto Sans CJK TC",sans-serif` sau font Latin.

### 2. Token và component

- Viết lại `apps/web/public/assets/app.css` theo mục 2 của audit: token màu ngữ nghĩa (sáng + 2 khối tối giữ cơ chế `prefers-color-scheme` / `data-theme` hiện có), spacing, radius, shadow, motion, thang chữ.
- **Giữ mọi tên class đang dùng** trong `src/views/**` (`.container`, `.card`, `.field`, `.btn`, `.notice`, `.badge*`, `.subnav`, `.chips`, `.facts`, `.cards`, `.tiers`, `.legal`, …): chỉ đổi cách hiển thị. Thêm class mới bằng tên mới. Lý do: nhánh `feat/m5-inquiry` đang dùng các class này.
- Thêm biến thể nút: `.btn-primary` (mặc định của `.btn`), `.btn-secondary`/`.btn-ghost`, `.btn-light`, `.btn-lg` (52 px).
- `.eyebrow` (mono, `text-transform: uppercase` bằng CSS, không viết hoa trong chuỗi i18n).

### 3. Logo

- `apps/web/public/assets/brand/vnxsi-mark.svg`: Option B (nét `#0D1526`, nút trắng viền mực, nút đáy `#1D4ED8`), viewBox `0 0 64 64`, đúng hình trong artboard Logo.
- `vnxsi-mark-dark.svg`: nét `#E8EDF5`, nút nền `#0A0F1C`, nút đáy `#6B93FF`.
- `vnxsi-icon.svg`: ô `#0D1526` bo 15, hình B nét trắng, nút đáy `#6B93FF` (dùng làm favicon).
- `Layout.tsx`: `<link rel="icon" type="image/svg+xml" href="/assets/brand/vnxsi-icon.svg">`.
- Wordmark trong header/footer: chữ "VNX.SI" Space Grotesk 700, dấu chấm màu `--primary`; mark SVG nội tuyến (để đổi màu theo dark mode bằng `currentColor`/biến CSS) hoặc `<img>` hai bản sáng/tối với `<picture>` — Implementer chọn, ghi trong báo cáo.

### 4. Header (`Layout.tsx`, mọi trang)

Theo artboard v2:
- Sticky, nền trắng mờ (`backdrop-filter`), viền dưới, cao 68 px.
- Trái: logo (link về `/` theo locale).
- Giữa (≥ 900 px): Products (`/products`), Find builders (`/builders`), How it works (`/#how`), For builders (`/#builders`), tất cả theo locale.
- Phải (≥ 900 px):
  - Menu ngôn ngữ: `<details>` với `<summary>` (biểu tượng địa cầu + mã locale hiện tại); bên trong 4 link tới **cùng đường dẫn** ở locale khác (dùng `alternates`/`localizedPath` có sẵn).
  - Chưa đăng nhập: "Sign in" + nút **Become a builder** (`/login?next=/hub/apply` theo locale, như VNX-0708).
  - Đã đăng nhập: "Builder Hub" (`/hub`) + nút "Sign out" (form POST `/logout` như hiện tại).
- < 900 px: logo + nút menu `<details>` (biểu tượng 3 gạch, `aria-label`); mở ra một panel chứa nav, ngôn ngữ, Sign in/Hub, CTA. **Không JS.**
- Mọi vùng chạm ≥ 44 px; `aria-current="page"` cho mục nav đang xem.

### 5. Footer (`Layout.tsx`, mọi trang)

Theo artboard v2: 4 cột (thương hiệu + tagline + "Rankings are never for sale." / Marketplace: Products, Find builders, How it works / Builders: Become a builder, Sign in / Company: Media kit, `contact@vnx.si` (mailto), Terms, Privacy) và hàng dưới: `© {năm hiện tại} VNX.SI` + 4 link ngôn ngữ. Giữ `aria-label` cho từng `nav`. Link Terms/Privacy/Media kit vẫn có (test VNX-0705a).

### 6. Landing `/`

Thứ tự khối và hành vi theo artboard v2:

| Khối | Ghi chú triển khai |
|---|---|
| Hero | Nền trắng + lưới 48 px + lớp mờ radial; pill có chấm `ping`; `h1` display; lead; nút **Become a builder** (`.btn-lg`, link như header) + **Get notified** (`#notify`); dòng mono "Rankings are never for sale." |
| Chồng thẻ (hero, bên phải) | **Nếu có < 3 product công khai:** 3 thẻ mời theo category `booking`, `crm`, `ai_agents` (tên category lấy từ nhãn category i18n có sẵn), "ảnh app" vẽ bằng CSS, tint theo bảng ở artboard, "Free to list", 3 chip huy hiệu có thể đạt, nút "List yours" (= link builder) và "Get notified" (`#notify`). **Nếu có ≥ 3:** 3 product công khai đầu tiên theo **thứ tự xếp hạng trung lập của catalogue M4** (dùng lại hàm/truy vấn có sẵn, không thêm tín hiệu nào), thẻ hiện category, ngôn ngữ chính, tên, giá thấp nhất (format có sẵn), tagline, huy hiệu đang hiệu lực, link tới `/p/:slug`. Không bao giờ trộn hai loại |
| Dải nguyên tắc | 4 mục, biểu tượng nét |
| How it works (`#how`) | 4 thẻ có ô biểu tượng màu; số thứ tự **bằng CSS counter** (không có chữ số trong text) |
| Trust layer | `ol` 3 mục, số bằng CSS counter, chip huy hiệu |
| For builders (`#builders`, nền tối) | perks + nút "Apply as a founding builder" (link builder) + 3 bước (số bằng CSS counter) + dải "Built with any tool" chạy ngang (bản nhân đôi có `aria-hidden`) |
| Final CTA + waitlist (`#notify`) | tiêu đề, đoạn, **form waitlist hiện có** (cùng `POST /waitlist`, cùng input ẩn `utm_*`, `ref`, honeypot, lỗi theo ô, giữ tick đồng ý, trạng thái `?joined=1` thay form bằng thông báo), checkbox đồng ý; 2 nút phụ: Find a builder (`/builders`), Become a builder |

- Thẻ category và product là component JSX riêng (`views/landing/DeckCard.tsx` hoặc tương đương).
- Không chữ số nào trong text của `<main>` khi chưa có product (giữ AC4 của VNX-0708). Khi có product thật, giá trên thẻ là dữ liệu thật nên được phép có số: test AC4 chỉ áp cho trường hợp < 3 product.

### 7. Motion

- CSS: `fadeUp` khi tải cho hero; `reveal` theo cuộn bằng `animation-timeline: view()` trong `@supports` (trình duyệt không hỗ trợ: hiện ngay, **không** ẩn nội dung); `ping`; `belt`; `lift` khi hover thẻ; nút nhấc 1 px.
- JS duy nhất: `apps/web/public/assets/landing.js` (`defer`, không thư viện, ≤ 2 KB chưa nén): xoay chồng thẻ mỗi 4 s, dừng khi hover/focus trong deck, nút chấm (`aria-pressed`); không tự xoay khi `prefers-reduced-motion: reduce`. Không có JS: thẻ đầu ở trước, các nút chấm ẩn (`hidden` cho tới khi script bật).
- `@media (prefers-reduced-motion: reduce)`: tắt mọi animation và transition kể trên.

### 8. Nội dung (i18n)

EN là chuẩn; VI lấy từ prototype đã duyệt (Reviewer đã chỉnh chỗ không đúng sự thật); `zh-Hans`/`zh-Hant` Implementer dịch từ EN (người bản xứ đọc lại ở VNX-0801). Thay các key `landing.*` cũ không còn dùng (xóa ở cả 4 locale).

| Khối | EN | VI |
|---|---|---|
| Hero pill | Founding phase · free listing for builders | Giai đoạn sáng lập · builder đăng sản phẩm miễn phí |
| Hero h1 | Have an idea? Find a product, customize one, or build your own. | Có ý tưởng? Tìm sản phẩm có sẵn, tuỳ chỉnh, hoặc xây mới. |
| Hero lead | VNX.SI is the marketplace for AI-built software and the people who build it. Every listing shows exactly what has been verified. | VNX.SI là chợ phần mềm được xây bằng AI, và của chính những người xây nó. Mỗi sản phẩm ghi rõ điều gì đã được xác minh. |
| Hero nút | Become a builder / Get notified | Trở thành builder / Nhận thông báo |
| Hero note | Rankings are never for sale. | Thứ hạng không bao giờ được bán. |
| Thẻ category | `{category}` · Open for builders · Free to list · Be the first to list one here. · Badges to earn · List yours · Get notified | `{category}` · Đang mở cho builder · Đăng miễn phí · Hãy là người đầu tiên đăng ở đây. · Huy hiệu có thể đạt · Đăng sản phẩm · Nhận thông báo |
| Thẻ product | View product · From `{price}` · Contact for price | Xem sản phẩm · Từ `{price}` · Liên hệ báo giá |
| Nguyên tắc 1 | Verification you can read / Each badge says what we checked. | Xác minh đọc được / Mỗi huy hiệu nói rõ đã kiểm gì. |
| Nguyên tắc 2 | Rankings never for sale / Nobody pays to move up. | Thứ hạng không bán / Không ai trả tiền để lên trên. |
| Nguyên tắc 3 | Straight to the builder / Buy, customize or hire directly. | Làm thẳng với builder / Mua, tuỳ chỉnh hoặc thuê trực tiếp. |
| Nguyên tắc 4 | Four languages / EN · VI · 简体 · 繁體 | Bốn ngôn ngữ / EN · VI · 简体 · 繁體 |
| How eyebrow / h2 | How it works / One listing, four ways to get what you need | Cách hoạt động / Một sản phẩm, bốn cách để có thứ bạn cần |
| Buy | Use it as it is: a SaaS subscription, source code, or a fixed-price service package. | Dùng ngay như hiện có: thuê bao SaaS, mã nguồn, hoặc gói dịch vụ giá cố định. |
| Customize | Like it but need changes? Ask the builder for a quote on your version. | Ưng nhưng cần sửa? Gửi yêu cầu để builder báo giá phiên bản của bạn. |
| Hire the builder | Work with the person who built it on something new for your business. | Làm việc với chính người đã xây sản phẩm cho một dự án mới. |
| Build similar | Want the same idea for your industry? Start from a product that already works. | Muốn ý tưởng tương tự cho ngành của mình? Bắt đầu từ một sản phẩm đã chạy. |
| Trust eyebrow / h2 | Trust layer / Verification you can actually read | Lớp tin cậy / Xác minh mà bạn đọc hiểu được |
| Trust sub | We don’t show star ratings we can’t stand behind. Each badge says exactly what was checked, and when. | Chúng tôi không gắn sao khi không kiểm chứng được. Mỗi huy hiệu nói rõ đã kiểm tra điều gì, và khi nào. |
| Listed | Reviewed by the VNX.SI team: clear description, real pricing, working links. | Đội VNX.SI đã duyệt: mô tả rõ ràng, giá thật, link hoạt động. |
| Demo verified | We opened the demo ourselves and it works over HTTPS. | Chúng tôi tự mở demo và nó chạy được qua HTTPS. |
| In production | The builder showed real customers using it, and we checked the evidence. | Builder chứng minh có khách hàng thật đang dùng, và chúng tôi đã kiểm tra bằng chứng. |
| Builders eyebrow / h2 | For builders / Build once. Sell many times. Get hired to customize. | Dành cho builder / Xây một lần. Bán nhiều lần. Được thuê để tuỳ chỉnh. |
| Builders sub | AI made building faster. VNX.SI gives what you build a storefront, buyers, and follow-on work. | AI giúp xây phần mềm nhanh hơn. VNX.SI cho sản phẩm của bạn một gian hàng, người mua và những việc làm tiếp theo. |
| Perks | Free listing during the founding phase · Any AI tool. We only ask one thing: can you deliver? · Requests from clients who need what you build | Đăng sản phẩm miễn phí trong giai đoạn sáng lập · Dùng công cụ AI nào cũng được. Chúng tôi chỉ hỏi: bạn có giao được sản phẩm không? · Nhận yêu cầu từ khách đang cần đúng thứ bạn xây |
| Builders nút | Apply as a founding builder | Đăng ký builder sáng lập |
| Bước 1 | Apply / Tell us what you build. Invited builders are approved instantly. | Đăng ký / Cho chúng tôi biết bạn xây gì. Builder được mời sẽ được duyệt ngay. |
| Bước 2 | List your product / A product page in guided steps: problem, demo, pricing, license, support. | Đăng sản phẩm / Trang sản phẩm qua các bước có hướng dẫn: vấn đề, demo, giá, license, hỗ trợ. |
| Bước 3 | Get requests / Buy, customize and hire requests from clients who need what you build. | Nhận yêu cầu / Yêu cầu mua, tuỳ chỉnh và thuê từ khách đang cần đúng thứ bạn xây. |
| Dải công cụ | Built with any tool · Claude · Codex · Gemini · Cursor · Lovable · Replit · …or your own hands | Xây bằng công cụ nào cũng được · (tên công cụ giữ nguyên) · …hoặc chính đôi tay bạn |
| Final h2 / đoạn | Already have an idea? / The marketplace opens to clients once enough verified products are listed. Leave your email and we'll tell you when. | Đã có ý tưởng? / Chợ sẽ mở cho khách khi đã có đủ sản phẩm được kiểm duyệt. Để lại email, chúng tôi báo bạn khi mở. |
| Final nút phụ | Find a builder / Become a builder | Tìm builder / Trở thành builder |
| Form | giữ các key `landing.form.*` hiện có | giữ |
| Header | Products · Find builders · How it works · For builders · Sign in · Become a builder · Builder Hub · Sign out · Menu · Language | Sản phẩm · Tìm builder · Cách hoạt động · Dành cho builder · Đăng nhập · Trở thành builder · Builder Hub · Đăng xuất · Menu · Ngôn ngữ |
| Footer | Marketplace · Builders · Company · Media kit · Terms · Privacy · Rankings are never for sale. | Chợ · Builder · Công ty · Media kit · Điều khoản · Quyền riêng tư · Thứ hạng không bao giờ được bán. |

(Tiêu đề 4 cách (Buy, Customize, Hire the builder, Build similar) giữ các key `landing.ways.*.title` hiện có ở cả 4 locale.)

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Font: các file `woff2` + `OFL.txt` có trong `public/assets/fonts/`; `app.css` có `@font-face` cho đủ 9 mặt chữ; `Layout` có đúng 2 `preload`; tổng dung lượng ≤ 400 KB | `test/design/assets.test.ts` (đọc CSS + đếm file); `du -cb apps/web/public/assets/fonts/*.woff2 \| tail -1` |
| AC2 | Không có request nào tới host bên thứ ba trong HTML/CSS (không `fonts.googleapis.com`, không `http(s)://` ngoài `vnx.si`/`APP_ORIGIN` trong `<head>` và `app.css`) | `test/design/assets.test.ts` |
| AC3 | Logo: 3 file SVG trong `public/assets/brand/`; favicon link trong mọi trang; header và footer có logo | `test/design/layout.test.ts` |
| AC4 | Header ở 4 locale: nav 4 mục đúng link theo locale; menu ngôn ngữ `<details>` có 4 link tới cùng trang ở locale khác; chưa đăng nhập có "Sign in" + CTA builder; đã đăng nhập có "Builder Hub" + form sign out; panel di động có cùng các link | `test/design/layout.test.ts` |
| AC5 | Footer: 4 nhóm `nav` có `aria-label`, link Terms/Privacy/Media kit/mailto, `©` + năm hiện tại, 4 link ngôn ngữ | `test/design/layout.test.ts`; `test/legal/footer.test.ts` vẫn xanh |
| AC6 | Landing, 0–2 product công khai: hero, 3 thẻ category đúng thứ tự `booking`, `crm`, `ai_agents`, dải nguyên tắc, `#how`, trust, `#builders`, `#notify` có form; không chữ số trong text `<main>`; không link `/products` trong `<main>` | `test/landing/page.test.ts` (sửa theo thiết kế mới) |
| AC7 | Landing, ≥ 3 product công khai: thẻ là 3 product theo thứ tự catalogue trung lập, link `/p/:slug`, không còn thẻ category; product của builder không `approved` không xuất hiện | `test/landing/deck.test.ts` |
| AC8 | Form waitlist vẫn đủ hành vi VNX-0708 (lưu, honeypot, rate limit, origin, lỗi theo ô, giữ tick, `ref`, `utm_*`, `?joined=1`) | `test/landing/waitlist.test.ts` xanh (chỉ sửa selector nếu cần) |
| AC9 | Câu chữ EN/VI đúng bảng "Nội dung"; key `landing.*` cũ không dùng đã xóa; parity 4 locale | `test/landing/page.test.ts`, `test/i18n/parity.test.ts` |
| AC10 | Motion: `app.css` có khối `prefers-reduced-motion: reduce` tắt `fadeUp`, `reveal`, `ping`, `belt`, transition; `reveal` theo cuộn nằm trong `@supports (animation-timeline: view())`; `landing.js` kiểm `matchMedia('(prefers-reduced-motion: reduce)')` | `test/design/assets.test.ts` |
| AC11 | `landing.js` ≤ 2 KB, không import, nạp bằng `defer` chỉ trên landing | `test/design/assets.test.ts`; `wc -c apps/web/public/assets/landing.js` |
| AC12 | Các trang khác không vỡ: toàn bộ test hiện có xanh; class cũ còn style | `npm test` |
| AC13 | Typecheck sạch | `npm run typecheck -w apps/web` |
| AC14 | Media Kit hiển thị đúng mục Logo files mới | `test/legal/content.test.ts` (đối chiếu `docs/legal/media-kit.md`) |
| AC15 | Nhìn giống artboard v2 ở 1280 px và 390 px; dùng được ở 768 px; sáng và tối đọc được; reduced-motion không còn chuyển động | Reviewer xem bằng `npm run dev` + Chrome headless |

## Tài liệu kèm

- Reviewer chép `project/LandingV2.dc.html` và `project/Logo.dc.html` từ canvas vào `docs/design/mockups/` để Implementer đọc offline (chỉ tham khảo markup/giá trị; code thật viết bằng Hono JSX + `app.css`, không chép cú pháp `.dc.html`).

## Rủi ro

- **Xung đột với M5:** `Layout.tsx`, `app.css`, file i18n bị sửa ở cả hai nhánh. Giữ tên class; key i18n mới đặt tên mới; ghi danh sách file chạm vào trong báo cáo để phiên M5 gộp.
- **Hiệu năng:** font ≤ 400 KB, chỉ preload 2 file; không JS chặn render.
- **Dữ liệu thật:** thẻ product chỉ dùng dữ liệu công khai thật, đúng thứ tự trung lập (ADR-004).

## Câu hỏi mở

Không có.
