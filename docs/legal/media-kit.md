# Media Kit — bản nháp

- **Trạng thái:** Draft, chờ Owner duyệt câu chữ.
- **Task:** VNX-0705a. Implementer chuyển mục EN và VI vào `src/content/legal/media-kit.ts`; `zh-Hans`, `zh-Hant` hiện bản EN (trang này không phải văn bản pháp lý, nhưng giữ cùng cách làm cho đơn giản; dịch khi VNX-0801).
- **Đối tượng (Owner 2026-10-04):** partner/affiliate xét duyệt và báo chí.
- **Luật:** không có con số, logo partner hay testimonial nào chưa có thật (ADR-004). Không liệt kê partner chưa `active`. Mục số liệu chỉ thêm khi có số thật vượt ngưỡng (spec 8.11).

---

## EN

### Media kit

**About VNX.SI**
VNX.SI is the marketplace for AI-built products and the people who build them. Builders list software they built with AI tools; people who need software can buy a product, have it customized, hire the builder, or ask for something similar.

**Who it is for**
- Small business owners, starting in Vietnam, who need software that works now, with clear prices.
- International and Chinese-speaking clients looking for niche software and builders they can trust.
- Independent builders and small studios who want a channel to sell what they build and to get custom work.

The site is available in English, Vietnamese, Simplified Chinese and Traditional Chinese.

**What we stand for**
- Rankings are never for sale.
- Badges say exactly what was checked: Listed, Demo verified, In production. No stars, no made-up scores.
- We only publish numbers that come from real data.

**Working with partners**
We feature tools that builders and clients actually use, on dedicated tool pages. Partner and affiliate links are clearly disclosed, and a commission never changes how products are ranked. To discuss a partnership, email contact@vnx.si.

**Brand**
- Name: write **VNX.SI** (capitals, with the dot). Do not write "VNX", "Vnx.si" or "VNXSI".
- Colours: ink `#0D1526`, accent blue `#1D4ED8`, background `#F4F5F7`.
- Fonts: Space Grotesk (headings), Be Vietnam Pro (text).
- Logo files: coming soon. Until then, use the name VNX.SI in text.

**Contact**
Press and partnerships: contact@vnx.si

---

## VI

### Media kit

**Về VNX.SI**
VNX.SI là chợ cho sản phẩm xây bằng AI và những người xây chúng. Builder đăng phần mềm họ xây bằng công cụ AI; người cần phần mềm có thể mua sản phẩm, nhờ tùy chỉnh, thuê builder, hoặc yêu cầu một sản phẩm tương tự.

**Dành cho ai**
- Chủ doanh nghiệp nhỏ, bắt đầu từ Việt Nam, cần phần mềm chạy được ngay, giá rõ ràng.
- Khách quốc tế và khách nói tiếng Hoa cần phần mềm ngách và builder đáng tin.
- Builder độc lập và studio nhỏ cần kênh bán sản phẩm mình xây và nhận việc tùy chỉnh.

Trang có tiếng Anh, tiếng Việt, tiếng Trung giản thể và phồn thể.

**Điều chúng tôi giữ**
- Thứ hạng không bao giờ được bán.
- Huy hiệu nói đúng những gì đã kiểm: Listed, Demo verified, In production. Không chấm sao, không điểm số bịa.
- Chúng tôi chỉ công bố con số lấy từ dữ liệu thật.

**Hợp tác với partner**
Chúng tôi giới thiệu những công cụ mà builder và client thật sự dùng, trên các trang công cụ riêng. Link partner và affiliate được ghi rõ, và hoa hồng không bao giờ thay đổi cách xếp hạng sản phẩm. Để trao đổi hợp tác, email contact@vnx.si.

**Thương hiệu**
- Tên: viết **VNX.SI** (chữ in hoa, có dấu chấm). Không viết "VNX", "Vnx.si" hay "VNXSI".
- Màu: chữ `#0D1526`, xanh nhấn `#1D4ED8`, nền `#F4F5F7`.
- Font: Space Grotesk (tiêu đề), Be Vietnam Pro (nội dung).
- File logo: sắp có. Trong lúc chờ, dùng tên VNX.SI dạng chữ.

**Liên hệ**
Báo chí và hợp tác: contact@vnx.si

---

## Ghi chú cho Owner

- Bảng màu và font lấy từ `docs/blueprint/05-UI-SCOPE.md`. Hiện `app.css` chỉ nạp Be Vietnam Pro (không nạp Space Grotesk); trang Media Kit chỉ **mô tả** font, không đổi CSS.
- Khi có số thật (product published, builder approved, quốc gia) vượt ngưỡng spec 8.11, thêm mục "Numbers" đọc từ `public_stats` (M7), không gõ tay.
- Khi có file logo: thêm vào `public/assets/brand/` và mục "Logo files".
