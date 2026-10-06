# VNX-2105 — Review

- **Phạm vi review:** `dbfcb61..b69c6b3`. Gồm các commit `654cd71` (test), `bdfbdf7` (feat), `60bd5d0` và `d26f00e` (test CSP), `b69c6b3` (báo cáo). 16 file, +375 / −30.
- **Đối chiếu:** plan `.ai/plans/VNX-2105-plan.md`, handoff, báo cáo `.ai/tasks/VNX-2105-report.md`, ADR-004, ADR-007, `test/architecture.test.ts`.
- **Người review:** Claude (phiên chính) cùng một subagent review độc lập. Subagent đọc từ git object, không chạy code.
- **Lệnh Reviewer tự chạy lại:**
  - `npm run typecheck -w apps/web`: sạch.
  - `npx vitest run test/monetization test/catalog test/architecture.test.ts test/i18n test/http/security-headers.test.ts`: 11 file / 176 test xanh.
  - Implementer báo cả bộ: 135 file / 1421 test xanh.

## Verdict

**APPROVE WITH CHANGES.** Không có BLOCKER, HIGH hay MEDIUM. Các phát hiện dưới đây sửa trong một lượt ngắn trước khi merge.

## Đã kiểm, đúng

- **`tool` không đi vào được từ URL:** hai parser dựng object từ các trường liệt kê sẵn, không đọc `tool`. Nơi duy nhất truyền `tool` là `routes/tools.tsx`, với `merchant.name` lấy từ DB.
- **SQL:** giá trị luôn bind. `COLLATE NOCASE` áp vào phép so sánh. JSON hỏng hay NULL thì quy về `'[]'`. Câu đếm dùng cùng `filter` và tham số với câu lấy danh sách. ORDER BY, LIMIT, `PUBLIC_BUILDER`, `PUBLIC_PRODUCT` không đổi.
- **ADR-004 / ADR-007:**
  - `db/directory.ts` và `db/catalog.ts` không import module tiền nào.
  - `MONEY_ALLOWED` và `RANKING_FILES` không đổi.
  - `tools.tsx` chỉ cắt lấy 6 mục đầu, không sắp xếp lại.
  - `src` không có tên partner.
- **HTML `/builders` và `/products` giữ nguyên:**
  - `BuilderCard` khớp markup `<li>` cũ từng phần tử, từng thuộc tính.
  - `heading` mặc định là `h2`.
  - Test so `?tool=` cho ra HTML trùng từng byte.
- **ToolPage:**
  - Các khối mới nằm ngoài `section.offers`, link mới không có `rel` hay `target`.
  - `localizedPath(locale, "/request")` và `builderCtaHref` đúng cho cả hai trường hợp đăng nhập.
  - Thứ bậc tiêu đề h1 → h2 → h3.
  - Giữ `lang="en"` cho phần mô tả.
  - Khối rỗng ẩn cả tiêu đề.
- **i18n:** 6 khóa khớp bảng trong plan, đúng từng chữ, ở cả 4 locale.
- **Test AC1–AC5 không rỗng:** có ca khớp khác hoa thường, ca khớp một phần, ca chưa publish, ca builder hoặc user không công khai, ca thứ tự trộn nhiều tiêu chí, ca giới hạn 6. Regex CSP ở `d26f00e` đúng.

## Phát hiện

| # | Mức | Vị trí (`b69c6b3`) | Vấn đề | Sửa |
|---|---|---|---|---|
| F1 | LOW | `test/monetization/tools-bridge.test.ts:178-187` | Nửa `/builders` của AC6 có thể pass mà không kiểm gì. Builder duy nhất trong test có `aiTools: "Claude Code"`, và test gọi đúng `?tool=Claude%20Code`. Nếu route lỡ đọc `?tool=` trực tiếp, builder đó vẫn khớp và hai trang vẫn giống nhau. | Thêm một builder `approved` không dùng "Claude Code", kiểm handle của builder đó có mặt ở cả hai response. |
| F2 | LOW | `src/db/directory.ts:64`, `src/db/catalog.ts:71` | `if (query.tool)` bỏ qua bộ lọc khi tên rỗng. Nếu `merchant.name` là `""` (cột chỉ có `NOT NULL`, không có CHECK), trang tool sẽ hiện 6 builder và product đầu của **toàn bộ** site. | Đổi thành `query.tool !== undefined`. Thêm test: `tool: ""` không khớp gì. |
| F3 | LOW | `src/views/ToolPage.tsx:73` | `aria-label="Post a request"` gắn cho cả vùng chứa luôn thẻ "Become a builder", nên trình đọc màn hình nghe sai tên vùng. | Bỏ `aria-label`: mỗi thẻ đã có h2 riêng. |
| F4 | LOW | `public/assets/app.css:267` | Tiêu đề thẻ trên trang tool dùng h3, mà h3 không nhận `font-family: var(--font-display)` và `letter-spacing` của h1/h2. Kết quả là cùng một thẻ nhưng khác font so với `/products` và `/builders`. | `.cards h3 { font-family: var(--font-display); letter-spacing: -0.015em; }`, giữ cỡ 18px như hiện tại. |
| F5 | SUGGESTION | `public/assets/app.css:269` | `.tool-cta .card` vẫn kế thừa `max-width: 480px` của `.card`, nên ở 1280 px thẻ không lấp đầy ô lưới. | Thêm `max-width: none` cho `.tool-cta .card`. |
| F6 | SUGGESTION | `src/routes/tools.tsx:37-38` | Hai lượt tìm chạy nối tiếp. Mỗi lượt lấy 24 dòng chỉ để dùng 6, kèm một câu đếm bị bỏ đi. Với dữ liệu Wave 1 thì chấp nhận được. | Chỉ đổi hai lượt tìm sang `Promise.all`. **Giữ nguyên** ba lần đọc cờ chạy nối tiếp: có chủ ý, để lần đọc đầu làm đầy cache 60 s. Chế độ "không đếm" để sau, đã ghi vào "Ghi nhận". |
| F7 | SUGGESTION | test | Chưa có assertion cho tiêu đề thẻ `h3` trên trang tool (plan, Thiết kế mục 3). | Thêm assertion `<h3><a href=` trong `section.tool-products` và `section.tool-builders`. |

## Khắc phục được duyệt

Duyệt **F1, F2, F3, F4, F5, F6 (chỉ phần `Promise.all`), F7**, theo ủy quyền điều phối của Owner.

- Implementer chỉ sửa đúng những mục này.
- Viết test trước cho F1, F2, F7.
- Gói trong một commit `fix(web)`, cộng commit test nếu cần.
- Bổ sung báo cáo vào `.ai/tasks/VNX-2105-report.md`, mục "Lượt sửa".

AC9 (xem giao diện ở 360 px và 1280 px, sáng và tối): Reviewer làm sau lượt sửa.

## Re-review

- **Lượt sửa:** `d3611e9` (test), `d1d6c60` (fix F2–F6), `96242f3` (báo cáo). Reviewer đã đọc toàn bộ diff `src` và `public`. Diff gọn, không có thay đổi ngoài các mục đã duyệt. Ba lần đọc cờ vẫn chạy nối tiếp.
- **F1–F7: đã sửa.**
  - F2: `tool: ""` trước khi sửa trả 18 kết quả, sau khi sửa trả 0, có test ở tầng `db`.
  - F1 và F7 là thay đổi làm chắc test: test pass ngay vì code vốn đúng, đúng như dự kiến.
- **Lệnh Reviewer chạy lại ở `47d870f`** (đầu nhánh, gồm cả lượt sửa của VNX-2508a):
  - `npm run typecheck -w apps/web`: sạch.
  - `npm test`: **136 file / 1447 test xanh**.
- **AC9 (Reviewer xem):** chạy `wrangler dev` cổng 8796 trên D1 local, dữ liệu mẫu chỉ nằm ở máy (2 product, 3 builder, trong đó 1 builder không khớp tên công cụ). Chụp bằng Chrome headless qua CDP:
  - `/tools/elevenlabs` 1280 px sáng: thẻ dùng font display như `/products`; hai thẻ CTA lấp đủ hai cột.
  - `/tools/elevenlabs` 360 px sáng: một cột.
  - `/vi/tools/elevenlabs` 1280 px tối: chữ tiếng Việt khớp plan, tương phản đọc được.
  - Cả ba ảnh: không cuộn ngang, builder không khớp không hiện.

## Verdict cuối

**APPROVE.**
