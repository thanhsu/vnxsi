# VNX-2105 — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-2105-plan.md`. Plan là nguồn chi tiết. Handoff này chỉ chốt phạm vi và cách kiểm.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2105-report.md`
- **Worktree / nhánh:** `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`, nhánh `feat/vnx-2105-2508a` (cắt từ `main` `f155765`, đã `npm ci`). Không làm ở `D:\DOCS\SUPHAM\GIT\vnxsi`: checkout đó thuộc phiên khác. Không push, không merge.

## Phạm vi

Trên `/tools/:slug`, dưới khối offer: khối "Products built with {name}" (tối đa 6), khối "Builders who work with {name}" (tối đa 6), hai thẻ CTA (Post a request, Become a builder). Thiết kế, câu chữ 4 locale và thứ tự xem plan, mục "Thiết kế".

## Ngoài phạm vi

`og:image`, bộ lọc công khai `?tool=`, bí danh tên merchant, đo nguồn, trang `/tools`, index, EPIC 22, mọi thứ trong Ops.

## Đọc trước

- `CLAUDE.md`, plan VNX-2105, ADR-004, ADR-007.
- Code:
  - Route và view: `src/routes/tools.tsx`, `src/views/ToolPage.tsx`, `src/views/DirectoryPage.tsx`, `src/views/ProductCard.tsx`, `src/views/Layout.tsx` (`builderCtaHref`).
  - Truy vấn và domain: `src/db/directory.ts` (`searchBuilders`), `src/db/catalog.ts` (`searchProducts`, `jsonListLike`), `src/domain/directory.ts`, `src/domain/catalog.ts`.
- Test: `test/monetization/tools.test.ts` (mẫu), `test/fixtures.ts` (`makeMerchant`, `makeBuilder` với `{ aiTools }`, `addLiveProduct` với `techStack`), `test/architecture.test.ts` (`RANKING_FILES`, `MONEY_ALLOWED`, luật cấm tên partner), `test/catalog/*.test.ts`, `test/http/security-headers.test.ts`.

## Quy tắc

- Tên merchant luôn đọc từ DB. Không viết tên partner nào trong `src`.
- So khớp chính xác, không phân biệt hoa thường (`COLLATE NOCASE`), giá trị luôn bind.
- Không đổi ORDER BY, `PUBLIC_BUILDER`, `PUBLIC_PRODUCT`. Không đưa tiền, offer hay merchant vào truy vấn xếp hạng.
- `tool` không đọc từ URL ở `/builders`, `/products`.
- HTML `/builders` và `/products` giữ nguyên (prop `heading` mặc định `h2`).
- Câu chữ i18n đúng từng chữ như bảng trong plan. Cần câu khác thì dừng và hỏi.
- CSP VNX-0803: không có `style=` hay script inline. Link mới không có `rel="sponsored"`.

## Tiêu chí chấp nhận

AC1–AC9 ở plan, mỗi tiêu chí có lệnh kiểm. Mỗi AC có ít nhất một test, viết trước code (TDD: commit test trước, rồi commit code).

## Môi trường máy

Máy dùng chung, RAM và đĩa sát giới hạn.

- `npm test` một lượt có thể hết bộ nhớ. Khi đó chạy theo thư mục (`npx vitest run test/<dir>/ --maxWorkers=2` trong `apps/web`) và ghi kết quả từng nhóm.
- Gặp timeout 5 s ngẫu nhiên: chạy riêng file đó, ghi cả hai kết quả.
- Không mở `wrangler dev`.

## Lệnh kiểm tra

```bash
cd D:/DOCS/SUPHAM/GIT/vnxsi-merchants
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài phạm vi. Nếu bắt buộc phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency, không migration.
- Không commit `.dev.vars` hay bí mật.
- Commit theo Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ commit file của task này.
