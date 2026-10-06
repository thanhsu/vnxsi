# VNX-2105 — Báo cáo Implementer

- **Nhánh:** `feat/vnx-2105-2508a`, worktree `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`
- **Commit:** `654cd71` test (đỏ trước), `bdfbdf7` feat, `60bd5d0` test (CSP) + commit chỉnh regex CSP, và commit báo cáo này.

## Đã đổi

- `src/domain/directory.ts`, `src/domain/catalog.ts`: thêm `tool?: string` vào `DirectoryQuery`, `CatalogQuery`. `parseDirectoryQuery`, `parseCatalogQuery` không đọc trường này.
- `src/db/directory.ts` (`searchBuilders`, cột `b.ai_tools`), `src/db/catalog.ts` (`searchProducts`, cột `p.tech_stack`): thêm điều kiện `EXISTS (... json_each(CASE WHEN json_valid(col) ...) WHERE value = ?n COLLATE NOCASE)`, giá trị bind. ORDER BY, LIMIT, `PUBLIC_BUILDER`, `PUBLIC_PRODUCT` giữ nguyên.
- `src/routes/tools.tsx`: gọi hai truy vấn với `tool: merchant.name` (đọc từ DB), lấy 6 kết quả đầu.
- `src/views/BuilderCard.tsx` (mới): markup `<li>` tách từ `DirectoryPage`, prop `heading` mặc định `h2`. `DirectoryPage.tsx` dùng component này.
- `src/views/ProductCard.tsx`: thêm prop `heading` (mặc định `h2`).
- `src/views/ToolPage.tsx`: khối `section.tool-products`, `section.tool-builders` (ẩn khi rỗng), `section.tool-cta` (luôn hiện, hai thẻ). Nút dùng `request.cta`, `landing.cta.builder`, `builderCtaHref`.
- `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`: 6 khóa `tools.*` đúng chữ trong bảng plan.
- `public/assets/app.css`: `.cards h3` cùng cỡ với `h2`; `.tool-cta` (1 cột, 2 cột từ 768 px). Không `style=` inline.
- `test/monetization/tools-bridge.test.ts` (mới, 11 test).

## Tiêu chí chấp nhận

| AC | Lệnh | Kết quả |
|---|---|---|
| AC1 | `npx vitest run test/monetization/tools-bridge.test.ts` | pass (2 test: khớp không phân biệt hoa thường, loại partial `X API`, draft, builder suspended, ẩn khối khi rỗng; 4 locale) |
| AC2 | cùng file | pass (2 test: `ai_tools`, builder pending, user suspended) |
| AC3 | cùng file | pass (2 test: 8 dữ liệu, so với thứ tự duyệt các trang `/builders`, `/products`; tối đa 6) |
| AC4 | cùng file | pass (2 test: 4 locale, merchant không offer; chưa đăng nhập và đã đăng nhập) |
| AC5 | cùng file; `npx vitest run test/monetization/tools.test.ts` | pass (11 + 12 test); thêm kiểm CSP trên trang đầy đủ |
| AC6 | cùng file; `npx vitest run test/catalog` | pass; `?tool=` bị bỏ qua (HTML bằng nhau), giá trị độc hại bind không khớp gì |
| AC7 | `npx vitest run test/architecture.test.ts test/i18n test/http/security-headers.test.ts test/catalog` | 7 file, 54 test pass |
| AC8 | `npm run typecheck -w apps/web`; `npm test` | typecheck exit 0; `npm test` 135 file, 1421 test pass (một lượt, không hết bộ nhớ, không timeout) |
| AC9 | Reviewer xem | chưa làm, không chạy `wrangler dev` theo handoff |

## Sai khác và ghi chú

- Không có sai khác so với plan. Tên partner không xuất hiện trong `src` (grep sạch).
- Test CSP của `security-headers.test.ts` chỉ quét `/tools/nope` (404); tôi thêm kiểm `style=`/script inline trên trang tool đầy đủ trong test mới.
- Commit CSP đầu tiên vô tình dùng regex sai (`sstyle`); đã sửa ngay trong commit kế (test vẫn xanh).
- Ngoài phạm vi, không làm: `og:image`, `?tool=` công khai, bí danh merchant, đo nguồn, `/tools`, index.
