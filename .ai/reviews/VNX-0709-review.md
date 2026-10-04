# VNX-0709 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `.ai/plans/VNX-0709-plan.md`, handoff, báo cáo `.ai/tasks/VNX-0709-report.md`, mockup `docs/design/mockups/LandingV2.dc.html` + `Logo.dc.html`, diff `c058923..c6f0bbe` (50 file trong `apps/web`, +2305/−300).
- **Lệnh đã chạy lại:**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test` → 69 file, **468/468** xanh. (Lúc bắt đầu có 2 test Media Kit đỏ vì Reviewer đã sửa `docs/legal/media-kit.md` trước khi code theo; đây là hành vi đúng của test đối chiếu.)
  - `du -cb apps/web/public/assets/fonts/*.woff2 | tail -1` → 344312 (≤ 400 KB).
  - `wc -c apps/web/public/assets/landing.js` → 1744 (≤ 2 KB).
  - `grep "googleapis\|https://" apps/web/public/assets/app.css` → không có.
  - `wrangler dev --port 8787` + Chrome headless: `/` 1440 px sáng; `/zh-hant` 1280 px tối; `/vi` 390 px (iframe), có và không có `--force-prefers-reduced-motion`.

## Verdict

**APPROVE.** Trang khớp sát artboard Landing v2 ở desktop và điện thoại; header, footer, logo B, font, token áp cho toàn site; không có dữ liệu giả; deck dùng lại truy vấn catalogue trung lập (ADR-004); motion tắt đúng khi giảm chuyển động; không request bên thứ ba.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | SUGGESTION | `src/routes/landing.tsx` (`renderLanding`) | Mỗi lượt xem landing chạy 2 truy vấn D1 cho deck (cả khi chưa có product) | Chấp nhận ở quy mô hiện tại; khi có cache trang/`public_stats` (M7) thì đọc deck từ đó |
| F2 | SUGGESTION | `public/assets/brand/vnxsi-icon.svg` | Icon app không có trong artboard; Implementer dựng theo mô tả của plan (B thu 75 %, nét dày hơn) | Owner xem favicon trên tab trình duyệt khi thử local; muốn đổi thì sửa ở task sau |
| F3 | SUGGESTION | — | Chưa xem bằng mắt: menu di động và menu ngôn ngữ khi mở, header khi đã đăng nhập, deck có ≥ 3 product thật (đều có test) | Owner thử trực tiếp ở `http://localhost:8787` (mục "Thử tay") |

### Sai khác do Implementer báo — đã xem, chấp nhận

1. Icon app dựng theo plan (xem F2).
2. Thẻ product thật hiện ảnh bìa thật; "ảnh app" CSS chỉ là phương án dự phòng.
3. Footer khi đã đăng nhập chỉ hiện "Builder Hub" ở nhóm Builders (Sign in / Become a builder không còn ý nghĩa).
4. Vùng chạm ≥ 44 px (artboard 32–40 px): đúng NFR.
5. Ô email dùng nhãn ẩn + placeholder "Email" (không thêm `you@company.com` chưa duyệt).
6. Một key `site.rankings` dùng cho hero và footer; xóa `footer.nav` không còn dùng.
7. Trọng lượng 700 cho tiêu đề landing theo artboard (audit mục 2.1 ghi tối đa 600; artboard đã duyệt được ưu tiên). Ghi nhận để đợt B thống nhất.
8. `main.container` thêm 24 px phía trên cho mọi trang.
9. Deck xếp bằng CSS grid thay chiều cao cố định; `.lift` dùng `translate`.
10. Không JS: thẻ phía sau vẫn tab tới được; có JS: thẻ phía sau `inert`.
11. `builderCtaHref` chuyển sang `Layout.tsx`, re-export ở `LandingPage.tsx`.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `test/design/assets.test.ts`; 27 woff2 + 3 OFL; 344312 byte |
| AC2 | ✓ | `assets.test.ts`; grep không có host ngoài |
| AC3 | ✓ | `test/design/layout.test.ts`; logo hiện trên ảnh, đổi bản tối đúng |
| AC4 | ✓ | `layout.test.ts` (nav, menu ngôn ngữ, đăng nhập/chưa, panel di động) |
| AC5 | ✓ | `layout.test.ts`, `test/legal/footer.test.ts`; ảnh footer 4 cột |
| AC6 | ✓ | `test/landing/page.test.ts`; ảnh: 3 thẻ category, không số trong `<main>` |
| AC7 | ✓ | `test/landing/deck.test.ts` (dùng `searchProducts(parseCatalogQuery({}))`, loại builder không approved) |
| AC8 | ✓ | `test/landing/waitlist.test.ts` không đổi, xanh |
| AC9 | ✓ | `page.test.ts`, `parity.test.ts`; EN/VI đúng bảng (đã đối chiếu trên ảnh `/vi`) |
| AC10 | ✓ | `assets.test.ts`; `app.css:485` khối reduced-motion; `landing.js` kiểm `matchMedia` |
| AC11 | ✓ | 1744 byte, `defer`, chỉ trên landing |
| AC12 | ✓ | 468/468 |
| AC13 | ✓ | typecheck exit 0 |
| AC14 | ✓ | `test/legal/content.test.ts` |
| AC15 | ✓ | Ảnh Reviewer 1440 sáng, 1280 tối (zh-Hant), 390 (vi) có/không reduced-motion: khớp artboard; xem F3 cho phần chưa xem |

## Nghĩa vụ để lại cho task sau

- **M5 merge:** xung đột dự kiến ở `Layout.tsx`, `app.css`, 4 file i18n, `test/legal/footer.test.ts`; class cũ và biến CSS cũ vẫn còn (alias), nên view M5 không vỡ; gộp i18n theo key.
- **Đợt B:** thống nhất trọng lượng tiêu đề (600 vs 700) cho các trang còn lại; `/products`, `/p/:slug`, `/builders`, `/b/:handle` theo design system mới.
- **VNX-0801:** người bản xứ đọc chuỗi zh của landing, header, footer.
- **M7:** khi có `public_stats`, hàng số liệu thay dải nguyên tắc theo ngưỡng; deck đọc từ dữ liệu đã tính.
