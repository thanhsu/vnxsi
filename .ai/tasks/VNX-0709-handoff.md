# VNX-0709 — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-0709-plan.md` (APPROVED bởi Owner 2026-10-04). Plan là nguồn chi tiết: phạm vi, thiết kế, bảng nội dung EN/VI, AC1–AC15.
- **Thiết kế đã duyệt:** `docs/design/mockups/LandingV2.dc.html` (landing, header, footer), `docs/design/mockups/Logo.dc.html` (logo: **Option B · Connected nodes**). Đây là mockup `.dc.html`: đọc để lấy bố cục và giá trị (màu, cỡ, khoảng cách, bo góc, animation); code thật viết bằng Hono JSX + `public/assets/app.css`.
- **Design system:** `docs/design/2026-10-04-ui-audit-and-redesign.md` mục 2.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-0709-report.md`
- **Nhánh:** `feat/vnx-0709-ui` (đã có, gốc `main` `b4c49e9` + tài liệu). Không merge, không push.

## Mục tiêu

Áp design system của prototype cho toàn site (font, token, component, header, footer, logo) và dựng lại landing `/` đúng artboard Landing v2, không dữ liệu giả.

## Phạm vi đã duyệt

Mục "Phạm vi → Trong phạm vi" (1–8) và "Thiết kế" (1–8) của plan.

## Ngoài phạm vi (không làm)

Khối số liệu (Live, Trending, Market pulse, Top builders, hàng số đếm), `public_stats`, cron hằng giờ; bố cục mới cho `/products`, `/p/:slug`, `/builders`, `/b/:handle`, Hub, Admin; đổi route, logic form, DB, API; thêm dependency vào `package.json`; deploy.

## Đọc trước

- `CLAUDE.md`; plan; 2 mockup; audit mục 2; `docs/legal/media-kit.md`.
- Code: `src/views/Layout.tsx`, `src/views/LandingPage.tsx`, `src/routes/landing.tsx`, `src/domain/waitlist-input.ts`, `public/assets/app.css`, `src/i18n/locales.ts` (`alternates`, `localizedPath`), `src/i18n/messages/*.ts`, `src/legal/content.ts`, `src/views/LegalPage.tsx`, catalogue M4 (`src/db/catalog.ts`, `src/domain/catalog.ts`: thứ tự xếp hạng trung lập), `src/views/format.ts` (giá), các view dùng class cũ (`grep -rhoE 'class="[^"]*"' src/views`).
- Test liên quan: `test/landing/*.test.ts`, `test/legal/*.test.ts`, `test/i18n/parity.test.ts`, `test/architecture.test.ts`.

## File dự kiến bị ảnh hưởng

- Mới: `public/assets/fonts/*.woff2` + `OFL*.txt`, `public/assets/brand/vnxsi-mark.svg`, `vnxsi-mark-dark.svg`, `vnxsi-icon.svg`, `public/assets/landing.js`, `src/views/landing/*.tsx` (thẻ deck, các khối nếu tách), `test/design/assets.test.ts`, `test/design/layout.test.ts`, `test/landing/deck.test.ts`.
- Sửa: `public/assets/app.css`, `src/views/Layout.tsx`, `src/views/LandingPage.tsx`, `src/routes/landing.tsx` (lấy product cho deck), `src/db/catalog.ts` hoặc `src/db/products.ts` (chỉ khi cần một hàm đọc có giới hạn 3, dùng lại truy vấn xếp hạng có sẵn), `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`, `src/legal/content.ts`, `test/landing/page.test.ts`, `test/landing/waitlist.test.ts` (chỉ selector), `test/legal/footer.test.ts` (chỉ nếu cấu trúc footer đổi selector).

## Ảnh hưởng DB / API / UI

- DB: không migration; chỉ đọc product công khai cho deck.
- API: không đổi.
- UI: mọi trang có header/footer/font mới; landing mới.

## Quy tắc nghiệp vụ

- Câu chữ: đúng bảng "Nội dung" của plan; không thêm câu, số, tên product mẫu, testimonial, logo đối tác. Cần câu mới thì dừng và ghi vào báo cáo.
- Deck: < 3 product công khai → 3 thẻ category (`booking`, `crm`, `ai_agents`); ≥ 3 → 3 product đầu theo thứ tự catalogue trung lập, không trộn.
- Không chữ số trong text `<main>` của landing khi < 3 product (số thứ tự bằng CSS counter).
- Form waitlist: giữ nguyên route, field, input ẩn (`utm_*`, `ref`), honeypot, lỗi, `?joined=1`.
- Font: lấy từ gói `@fontsource/*` (OFL) bằng `npm pack` vào thư mục tạm, chép file cần; không sửa `package.json`/lockfile.
- Không request bên thứ ba nào trong HTML/CSS.
- Giữ mọi tên class đang dùng trong `src/views/**`.

## Tiêu chí chấp nhận

AC1–AC15 ở plan:

- [ ] AC1, AC2, AC10, AC11: `npm test -- test/design/assets.test.ts`; `du -cb apps/web/public/assets/fonts/*.woff2 | tail -1`; `wc -c apps/web/public/assets/landing.js`
- [ ] AC3, AC4, AC5: `npm test -- test/design/layout.test.ts test/legal/footer.test.ts`
- [ ] AC6, AC9: `npm test -- test/landing/page.test.ts test/i18n/parity.test.ts`
- [ ] AC7: `npm test -- test/landing/deck.test.ts`
- [ ] AC8: `npm test -- test/landing/waitlist.test.ts`
- [ ] AC12: `npm test`
- [ ] AC13: `npm run typecheck -w apps/web`
- [ ] AC14: `npm test -- test/legal/content.test.ts`
- [ ] AC15: Reviewer kiểm tay

## Test bắt buộc

TDD: commit test trước code. Mỗi AC ít nhất một test. Test deck dùng dữ liệu tạo trong test (builder approved + product published + tier), có ca builder không `approved`.

## Lệnh kiểm tra

```bash
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; ghi lý do trong báo cáo.
- Không thêm dependency, không migration, không sửa `docs/**`.
- Không `dangerouslySetInnerHTML` ngoài `jsonLdScript` có sẵn.
- Commit theo Conventional Commits, mỗi commit kèm dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
