# VNX.SI — UI/UX audit, design system và kế hoạch thiết kế lại

- **Ngày:** 2026-10-04
- **Người viết:** Claude (Reviewer)
- **Trạng thái:** Owner trả lời Q1–Q5 ngày 2026-10-04 (xem "Quyết định của Owner" ở mục 0). Chưa sửa code.
- **Căn cứ:** giao diện đang chạy (`main` `b4c49e9`, `npm run dev`), `apps/web/public/assets/app.css`, `apps/web/src/views/**`, prototype đã duyệt (`project/Main.dc.html` trong artifact prototype), `docs/blueprint/05-UI-SCOPE.md`, spec Wave 1 mục 5.9, ADR-001/003/004.
- **Yêu cầu của Owner:** "UI chưa thực sự ấn tượng; muốn animation sinh động và công nghệ hơn; cho thấy vì sao VNX.SI nổi trội; menu và footer chuyên nghiệp hơn", cộng prompt audit → design system → plan trang → triển khai → review lần hai.

---

## 0. Kết luận và câu hỏi cho Owner

Giao diện hiện tại trông "chung chung" không phải vì thiết kế sai hướng, mà vì **bản code đã bỏ rơi gần hết hệ thiết kế của prototype đã duyệt**:

| Prototype (đã duyệt) | Đang chạy |
|---|---|
| Space Grotesk (tiêu đề), Be Vietnam Pro (nội dung), JetBrains Mono (nhãn, số) | **Không nạp font nào**. Tên `Be Vietnam Pro` có trong CSS nhưng không có `@font-face` hay `<link>`, nên trình duyệt dùng font hệ thống (Segoe UI trên Windows) |
| Header: dấu "V" + tên, nav 4 mục, chọn ngôn ngữ, Sign in, nút CTA | Chữ "VNX.SI", 2 link gạch chân, 4 nút ngôn ngữ, Sign in; xuống 2 dòng trên điện thoại |
| Footer: brand + tagline, nav, pháp lý, email | Một dòng tagline + 3 link |
| Motion: fadeUp theo cuộn, vẽ đường (draw), dải chạy (belt), chấm sáng (ping), thẻ nhấc khi hover; tắt hết khi `prefers-reduced-motion` | Không có motion nào |
| Eyebrow kiểu mono, thẻ có hover, nút có trạng thái | Mọi thứ là hộp viền xám bo 12 px giống nhau |

Hướng đề xuất: **dựng lại đúng design system của prototype thành token và component dùng chung**, nâng cấp header/footer, thêm motion "công nghệ" có mục đích (giải thích cách VNX.SI kiểm chứng), và một khối "Vì sao VNX.SI" chỉ nói điều có thật.

| # | Câu hỏi | Lựa chọn | Reviewer khuyên |
|---|---|---|---|
| Q1 | Phạm vi đợt này | (a) Đợt A: nền chung (token, font, header, footer, component) + Landing + 3 trang pháp lý + Login, **trước go-live**; Catalogue/Product/Builder (đợt B) và Hub/Admin (đợt C) sau. (b) Làm hết một lần | **(a)**: go-live sớm với phần người ngoài thấy đầu tiên |
| Q2 | Font | (a) Tự host file `woff2` (Be Vietnam Pro, Space Grotesk, JetBrains Mono; giấy phép OFL) trong `public/assets/fonts/`; chữ Trung dùng font hệ thống. (b) Google Fonts | **(a)**: không gửi IP người xem cho Google (Q5 monetization: không tracker bên thứ ba; Privacy không phải sửa), nhanh hơn, không phụ thuộc bên ngoài |
| Q3 | Hình ở hero | (a) Sơ đồ động "quy trình kiểm chứng" (Listed → Demo verified → In production) + thẻ "Your product here" (là chỗ trống, không phải dữ liệu mẫu); khi có ≥ 3 product thật thì thay thẻ bằng chồng thẻ product thật tự xoay (spec 5.9). (b) Chỉ chữ | **(a)**: có cảm giác công nghệ mà không bịa dữ liệu |
| Q4 | Mức motion | (a) Có chủ đích: hiện dần khi cuộn, vẽ sơ đồ, chấm trạng thái nhấp nháy, hover nhấc nhẹ, header thu gọn khi cuộn. (b) Nhiều hơn: nền lưới chuyển động, parallax, hiệu ứng chữ | **(a)**: sinh động nhưng không làm chậm trang hay rối mắt; tất cả tắt khi `prefers-reduced-motion` |
| Q5 | Dấu thương hiệu | Prototype dùng ô vuông chữ "V" cạnh tên. (a) Dùng tạm làm dấu thương hiệu (vẽ bằng CSS/SVG, không phải logo chính thức). (b) Chỉ chữ "VNX.SI" cho tới khi có logo | **(a)**, ghi rõ là tạm; Media Kit vẫn ghi "logo sắp có" |

### Quyết định của Owner (2026-10-04)

| # | Quyết định |
|---|---|
| Q1 | Đợt A trước go-live: nền chung + Landing + 3 trang pháp lý + Login. Đợt B, C sau go-live |
| Q2 | Tự host font `woff2` (Be Vietnam Pro, Space Grotesk, JetBrains Mono); chữ Trung dùng font hệ thống |
| Q3 | Hero: sơ đồ kiểm chứng động + thẻ "Your product here"; thay bằng chồng thẻ product thật khi có ≥ 3 |
| Q4 | Motion có chủ đích, tắt khi `prefers-reduced-motion` |
| Q5 | Owner yêu cầu **Reviewer thiết kế logo**. Reviewer vẽ phương án trên canvas prototype; Owner chọn; file SVG chính thức thêm vào `public/assets/brand/` trong đợt A, Media Kit cập nhật mục logo |

Sau khi Owner trả lời: Reviewer vẽ lại **artboard Landing + header + footer** trong canvas prototype để Owner duyệt bằng mắt, rồi mới viết plan/handoff cho Implementer.

---

## 1. UI/UX audit: 10 vấn đề lớn nhất

| # | Vấn đề | Vì sao quan trọng | Giải pháp |
|---|---|---|---|
| 1 | **Không nạp font**: mọi chữ là font hệ thống, tiêu đề và nội dung cùng một họ chữ | Đây là lý do số một trang trông "template". Typography quyết định cảm giác cao cấp nhiều hơn màu | Tự host 3 họ chữ của prototype, có thang cỡ chữ (mục 2.1) |
| 2 | **Header nghèo nàn**: không có dấu thương hiệu, link nav dạng gạch chân mặc định, 4 nút ngôn ngữ chiếm chỗ, không có CTA chính, xuống 2 dòng trên điện thoại, không có menu di động | Header là thứ thấy đầu tiên trên mọi trang; hiện trông như trang nội bộ | Header dính (sticky), dấu thương hiệu, nav 3–4 mục, ngôn ngữ gom vào một menu thả xuống, nút **Become a builder**; trên điện thoại dùng menu `<details>` không cần JS |
| 3 | **Footer một dòng** | Footer là nơi người xét duyệt (partner, báo chí) tìm thông tin công ty, pháp lý, liên hệ; footer sơ sài làm giảm niềm tin | Footer 4 cột: thương hiệu + câu định vị + "Rankings are never for sale"; Marketplace; Builders; Company (Media kit, contact@vnx.si) + Legal; hàng dưới: ngôn ngữ, © năm |
| 4 | **Không có motion** | Owner muốn sinh động, công nghệ; spec 5.9 đã định sẵn animation nhưng chưa làm | Hệ motion có token (mục 2.6), chỉ dùng cho việc dẫn mắt và giải thích |
| 5 | **Hero chỉ có chữ**: không có gì cho thấy sản phẩm trông ra sao | Người mới không hiểu "chợ" này bán gì trong 5 giây đầu | Hero 2 cột: trái là thông điệp + CTA; phải là sơ đồ kiểm chứng động + thẻ product (Q3) |
| 6 | **Mọi khối đều là hộp viền xám bo 12 px** (4 ways, huy hiệu, form); thẻ huy hiệu dùng viền trái dày (một kiểu "AI template") | Không có nhịp thị giác; người đọc không biết khối nào quan trọng | Mỗi khối một bố cục riêng: 4 ways thành 4 cột có số mono và đường nối; huy hiệu hiển thị như huy hiệu thật (biểu tượng + nhãn) nằm trên sơ đồ quy trình; form waitlist nằm trong một dải màu đối lập |
| 7 | **Không có thang spacing, radius, shadow**: giá trị rải rác (8/10/12 px bo góc; 16/20/24 px đệm) | Lệch vài px ở nhiều nơi làm trang trông "không được thiết kế" | Token spacing bội số 4, 3 mức bo góc, 2 mức bóng (mục 2.3–2.5) |
| 8 | **Màu chưa có ngữ nghĩa**: chỉ có `accent` và `good`; màu lỗi cứng `#b42318` không đổi theo dark mode; không có warning/info | Trạng thái (lỗi, thành công, đang chờ duyệt) không nhất quán giữa Hub, Admin và form công khai | Bộ token ngữ nghĩa đầy đủ cho sáng và tối (mục 2.2) |
| 9 | **Component không thống nhất**: link xanh gạch chân ở khắp nơi kể cả trong nav; nút chỉ có primary và một biến thể; không có hover/active/transition; badge chỉ là viền | Tương tác không cho phản hồi, trông thô | Bộ component (mục 2.7): Button (primary/secondary/ghost, 2 cỡ), Link, NavLink, Badge có biểu tượng, Input, Notice, Eyebrow, Section header |
| 10 | **Chưa nói vì sao VNX.SI khác**: câu nguyên tắc nằm cuối trang, nhỏ | Owner muốn người xem thấy ngay lý do chọn VNX.SI | Khối "Vì sao VNX.SI" 4 điểm, ngay sau hero (mục 3.2); mọi điểm là sự thật kiểm được, không có số |

Thêm (không nằm trong top 10): trên điện thoại header xuống 2 dòng (đã ghi nhận ở review VNX-0708); tiêu đề `h1` của landing dài 2 dòng ở 1280 px vì không giới hạn độ rộng dòng; trang pháp lý ổn về bố cục nhưng hưởng lợi ngay khi có font.

---

## 2. Design system

Nguồn: prototype đã duyệt và `05-UI-SCOPE.md`. Tất cả là biến CSS trong `:root` (sáng) và khối dark mode như hiện có; **giữ tên class hiện có** khi có thể để không phá các view khác (kể cả nhánh M5 đang làm).

### 2.1 Typography

| Vai trò | Font | Cỡ / dòng (desktop → mobile) | Độ đậm |
|---|---|---|---|
| Display (h1 landing) | Space Grotesk | 56/60 → 36/40, `max-width: 18ch` | 600 |
| Page title (h1 trang khác) | Space Grotesk | 40/48 → 30/36 | 600 |
| Section title (h2) | Space Grotesk | 32/40 → 24/30 | 600 |
| Sub-section (h3) | Be Vietnam Pro | 18/26 | 600 |
| Body | Be Vietnam Pro | 16/26 | 400 |
| Lead | Be Vietnam Pro | 19/30 → 17/28 | 400 |
| Small / metadata | Be Vietnam Pro | 14/20 | 400–500 |
| Eyebrow, nhãn, số, mã | JetBrains Mono | 12–13/16, `letter-spacing: .02em` | 500 |

- Chỉ 3 độ đậm: 400, 500, 600. Không 700/800.
- Chữ Trung: font hệ thống (`PingFang SC/TC`, `Microsoft YaHei/JhengHei`, `Noto Sans CJK`), không tải font Trung (vài MB).
- Số liệu (sau này): `font-variant-numeric: tabular-nums`.

### 2.2 Màu (token ngữ nghĩa)

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg` | `#F4F5F7` | `#0A0F1C` | nền trang |
| `--surface` | `#FFFFFF` | `#111827` | thẻ, form, header |
| `--surface-2` | `#EEF1F5` | `#172033` | dải nhấn, hover nhẹ |
| `--border` | `#DCE0E6` | `#243049` | viền mặc định |
| `--border-strong` | `#C9CFD8` | `#33405E` | viền input, hover |
| `--text` | `#0D1526` | `#E8EDF5` | chữ chính |
| `--text-2` | `#3F4A5C` | `#C3CCDB` | chữ phụ |
| `--muted` | `#5B6475` | `#9AA5B8` | metadata |
| `--primary` | `#1D4ED8` | `#6B93FF` | hành động chính, link |
| `--primary-hover` | `#1E40AF` | `#8AABFF` | |
| `--on-primary` | `#FFFFFF` | `#0A0F1C` | chữ trên nút chính |
| `--success` | `#0B6B42` | `#5FD3A0` | In production, thành công |
| `--warning` | `#9A5B00` | `#F2B45A` | chờ duyệt |
| `--error` | `#B42318` | `#FF8A80` | lỗi |
| `--info` | `#1D4ED8` | `#6B93FF` | Demo verified, thông tin |

- Không gradient trên nền hay chữ. Một ngoại lệ có mục đích: vệt sáng chạy dọc đường nối trong sơ đồ kiểm chứng.
- Tương phản: chữ thường ≥ 4.5:1, chữ ≥ 24 px ≥ 3:1; kiểm bằng axe ở VNX-0802.

### 2.3 Spacing

Thang bội số 4: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48, `--s-8` 64, `--s-9` 96. Khoảng giữa các section landing: 96 desktop / 64 mobile. Độ rộng nội dung: `1200px` (khung), `72ch` (văn bản dài).

### 2.4 Bo góc

`--r-sm` 6 (badge, code), `--r-md` 10 (nút, input), `--r-lg` 14 (thẻ, khối). Pill (999) chỉ cho chip ngôn ngữ/tag.

### 2.5 Bóng

`--shadow-1`: `0 1px 2px rgb(13 21 38 / .06)` (thẻ tĩnh). `--shadow-2`: `0 18px 32px -18px rgb(13 21 38 / .35)` (thẻ khi hover, menu thả xuống). Dark mode: dùng viền sáng hơn thay vì bóng.

### 2.6 Motion

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | mọi chuyển động vào |
| `--dur-1` | 150 ms | hover, focus |
| `--dur-2` | 250 ms | thẻ nhấc, menu mở |
| `--dur-3` | 800 ms | hiện dần khi cuộn |
| `--dur-4` | 1800 ms | vẽ sơ đồ |

Các mẫu (đều có trong prototype): `reveal` (hiện dần khi cuộn, dùng `animation-timeline: view()`; trình duyệt không hỗ trợ thì hiện ngay), `draw` (vẽ đường SVG), `ping` (chấm trạng thái), `lift` (thẻ nhấc 2–4 px khi hover), header thu gọn và có viền khi cuộn (`animation-timeline: scroll()`). `prefers-reduced-motion: reduce` → tắt toàn bộ, hiện trạng thái cuối. Không thư viện JS. JS duy nhất (sau này): xoay chồng thẻ product, đếm số (chỉ khi có số thật, M7).

### 2.7 Component

| Component | Biến thể / trạng thái | Ghi chú |
|---|---|---|
| Button | primary, secondary (viền), ghost; cỡ md (44 px) và sm (36 px, chỉ desktop) | hover, active (nhấn xuống 1 px), focus-visible, disabled, loading (chữ + spinner CSS) |
| Link | inline (gạch chân khi hover), nav (không gạch chân, có trạng thái hiện tại) | |
| Header | sticky, brand mark, nav, menu ngôn ngữ `<details>`, Sign in, CTA; mobile: `<details>` menu toàn màn | không JS |
| Footer | 4 cột + hàng dưới | |
| Eyebrow | mono, chữ nhỏ, màu `--muted` hoặc `--primary` | trên mỗi section title |
| Section header | eyebrow + h2 + lead | dùng lại cho mọi section |
| Badge | listed / demo / production / trạng thái (pending, approved…) | biểu tượng SVG nét + nhãn; màu theo token ngữ nghĩa |
| Card | product, builder, feature | một kiểu thẻ, có `lift` khi là link |
| Input, Select, Textarea, Checkbox | mặc định, focus, lỗi, disabled | giữ class `.field` hiện có |
| Notice | info, success, warning, error | thay `.notice`, `.notice.good` |
| Empty state | biểu tượng nét + câu + hành động | catalogue rỗng, Hub rỗng |
| Brand mark | ô vuông "V" (Q5) | CSS/SVG |

Biểu tượng: SVG nét 1.5 px, một bộ duy nhất, nội tuyến; không emoji, không icon nhiều màu.

---

## 3. Kế hoạch theo trang

### 3.1 Nền chung (đợt A)

- **Hiện tại:** không font, header/footer đơn sơ, token thiếu.
- **Mới:** file font tự host + `@font-face` (`font-display: swap`, chỉ nạp các độ đậm dùng); token mục 2; Header và Footer mới trong `Layout.tsx`; component CSS dùng chung.
- **Tương tác:** header thu gọn khi cuộn; menu ngôn ngữ và menu di động mở/đóng có chuyển động 250 ms.

### 3.2 Landing `/`

| Khối | Hiện tại | Mới |
|---|---|---|
| Hero | chữ + 2 nút | Trái: eyebrow mono ("AI-built products · verified"), h1 display, lead, 2 CTA. Phải: **sơ đồ kiểm chứng động**: 3 nút trạng thái nối bằng đường được vẽ dần, chấm `ping` ở trạng thái hiện tại, thẻ "Your product here" trượt qua các nút (Q3). Nền: lưới chấm rất mờ, che dần ra rìa |
| Vì sao VNX.SI (mới) | không có | 4 điểm, mỗi điểm: biểu tượng nét + tiêu đề + 1 câu. (1) **Xác minh đọc được**: huy hiệu nói rõ đã kiểm gì. (2) **Thứ hạng không bán**: không ai trả tiền để lên trên. (3) **Làm việc thẳng với người xây**: mua, tùy chỉnh, thuê, xây tương tự. (4) **Bốn ngôn ngữ, khách toàn cầu**: EN, VI, 简体, 繁體. Câu chữ Reviewer viết trong plan, Owner duyệt |
| 4 cách hợp tác | 4 hộp giống nhau | 4 bước ngang có số mono 01–04 và đường nối; mobile thành danh sách dọc |
| Huy hiệu | 3 hộp viền trái | gộp vào sơ đồ hero hoặc thành 3 huy hiệu thật kèm giải thích; bỏ viền trái |
| Cho builder | đoạn + nút | khối 2 cột: danh sách lợi ích có dấu tích + CTA; dòng invite |
| Waitlist client | form trong hộp | dải nền `--surface-2` toàn chiều ngang, form một hàng (email + nút) trên desktop |
| Nguyên tắc | h2 cuối trang | chuyển thành dòng chốt trong footer và một điểm trong "Vì sao VNX.SI" |

Không thêm con số, logo, testimonial. Các khối số liệu của spec 5.9 (Trending, Market pulse…) để M7.

### 3.3 Trang pháp lý `/terms`, `/privacy`, `/media-kit`

- **Hiện tại:** đọc tốt nhưng font hệ thống, không mục lục.
- **Mới:** tiêu đề display; mục lục dính bên trái trên desktop (link tới từng `h2`), ẩn trên mobile; Media Kit: swatch lớn, mẫu chữ cho từng font.

### 3.4 Login `/login`

- **Mới:** khung giữa trang, brand mark, giải thích "link đăng nhập, không mật khẩu"; trạng thái "đã gửi" có biểu tượng thư và hướng dẫn kiểm hộp thư.

### 3.5 Đợt B (sau go-live): Catalogue, Product, Builders, Builder profile

- `/products`: thanh lọc gọn một hàng (desktop) / ngăn kéo `<details>` (mobile); thẻ product thống nhất (ảnh, tên, tagline, huy hiệu, giá từ…); empty state có CTA **Post a request** (khi có M6) hoặc Become a builder.
- `/p/:slug`: bố cục 2 cột: trái nội dung, phải cột dính chứa giá, huy hiệu, 4 nút hành động, thẻ builder; gallery có tỉ lệ cố định.
- `/builders`, `/b/:handle`: thẻ builder có avatar chữ cái, availability dạng chấm trạng thái, kỹ năng dạng tag.

### 3.6 Đợt C: Hub, Admin

- Ưu tiên chức năng: dùng lại token và component; Hub có thanh bên trên desktop; bảng Admin có hàng dính, trạng thái dạng badge. Không làm trước go-live.

---

## 4. Rủi ro và ràng buộc

- **Nhánh M5 đang mở** dùng các class hiện có (`.card`, `.field`, `.notice`, `.btn`…). Đợt A **giữ tên class** và chỉ đổi cách hiển thị, để M5 merge không vỡ. Thêm class mới thì đặt tên mới.
- **Hiệu năng:** font tự host ≤ ~150 KB tổng (3 họ, chỉ subset Latin + Vietnamese); không JS chặn render; NFR TTFB p95 ≤ 400 ms không đổi vì toàn bộ là CSS/SSR.
- **Accessibility:** vùng chạm ≥ 44 px, focus thấy rõ, motion tắt được, tương phản như mục 2.2.
- **Không dữ liệu giả** trên giao diện (CLAUDE.md, ADR-004). Thẻ "Your product here" là chỗ trống có nhãn rõ, dẫn tới đăng ký builder.

## 5. Quy trình tiếp theo

1. Owner trả lời Q1–Q5.
2. Reviewer vẽ artboard Landing (desktop + mobile), Header, Footer trong canvas prototype; Owner duyệt bằng mắt.
3. Reviewer viết plan + handoff đợt A (task mới, đề xuất `VNX-0709`), kèm câu chữ "Vì sao VNX.SI" EN/VI.
4. Implementer làm; Reviewer review lần một (code + ảnh 360/768/1280, sáng/tối, reduced-motion), sửa, review lần hai theo "quality bar" của Owner.
