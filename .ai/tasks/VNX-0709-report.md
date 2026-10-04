# VNX-0709 — Báo cáo Implementer

- **Task:** VNX-0709, thiết kế lại đợt A: nền chung, header, footer, logo, Landing v2
- **Plan:** `.ai/plans/VNX-0709-plan.md` (APPROVED 2026-10-04) · **Handoff:** `.ai/tasks/VNX-0709-handoff.md`
- **Nhánh:** `feat/vnx-0709-ui` (worktree `.claude/worktrees/agent-a26fce7bca484621a`), gốc `c058923`. Chưa push, chưa merge, chưa deploy.
- **Implementer:** subagent Claude (context mới)

## Commit

| SHA | Nội dung |
|---|---|
| `953b507` | test: VNX-0709 failing tests for fonts, logo, header, footer, landing deck and copy |
| `eec8a70` | test: fix VNX-0709 test helpers (attribute match, @supports prelude) |
| `5d7c4d2` | feat(web): self-hosted fonts and VNX.SI logo files (VNX-0709) |
| `b1f5314` | feat(web): media kit lists the logo files (VNX-0709) |
| `830ef01` | feat(web): design system, header, footer and landing v2 (VNX-0709) |
| `628e61e` | fix(web): landing polish from the visual check (VNX-0709) |
| (commit này) | docs: VNX-0709 implementer report |

TDD: `953b507` commit trước code; chạy ngay sau đó cho 40 test đỏ (mọi test mới + `footer.test.ts` đổi selector + 2 test media kit vốn đã đỏ ở baseline). `eec8a70` sửa 2 lỗi trong chính helper test của tôi (regex tìm thẻ phải chấp nhận thuộc tính đứng trước; phần prelude của `@supports` cũng chứa chữ `animation-timeline`), không nới điều kiện kiểm.

## File

**Tạo mới**
- `apps/web/public/assets/fonts/`: 27 file `woff2` (Space Grotesk 500/600/700, Be Vietnam Pro 400/500/600/700, JetBrains Mono 400/500 × `latin`, `latin-ext`, `vietnamese`) và `OFL-SpaceGrotesk.txt`, `OFL-BeVietnamPro.txt`, `OFL-JetBrainsMono.txt` (file `LICENSE` của từng gói, SIL OFL 1.1). Nguồn: `npm pack @fontsource/space-grotesk @fontsource/be-vietnam-pro @fontsource/jetbrains-mono` (5.3.0) vào thư mục tạm ngoài repo. `package.json`/lockfile không đổi.
- `apps/web/public/assets/brand/vnxsi-mark.svg`, `vnxsi-mark-dark.svg`, `vnxsi-icon.svg`
- `apps/web/public/assets/landing.js`
- `apps/web/src/views/landing/Deck.tsx` (thẻ category, thẻ product, chồng thẻ, nút chấm)
- `apps/web/test/design/assets.test.ts`, `apps/web/test/design/layout.test.ts`, `apps/web/test/landing/deck.test.ts`

**Sửa**
- `apps/web/public/assets/app.css` (viết lại)
- `apps/web/src/views/Layout.tsx`, `apps/web/src/views/LandingPage.tsx`
- `apps/web/src/routes/landing.tsx` (đọc product cho deck)
- `apps/web/src/db/catalog.ts` (thêm `firstPublicProducts`)
- `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- `apps/web/src/legal/content.ts` (dòng Logo files EN/VI)
- `apps/web/test/landing/page.test.ts` (theo thiết kế mới), `apps/web/test/legal/footer.test.ts` (chỉ selector `aria-label`: `footer.nav` → `footer.company`)

**Xóa:** không file nào. `test/landing/waitlist.test.ts` không phải sửa.

**File ngoài danh sách handoff:** không có.

## Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 Font | Đạt | `test/design/assets.test.ts` › fonts: đúng 27 file, 3 OFL, 27 `@font-face` (9 mặt chữ × 3 subset) có `font-display: swap` + `unicode-range` + `src` tới file có thật; đúng 2 `preload` (`space-grotesk-latin-700`, `be-vietnam-pro-latin-400`, `as="font" type="font/woff2" crossorigin`) trên `/`, `/products`, `/vi/terms`, `/login`; tổng ≤ 400 KB; CJK chỉ là font hệ thống. `du -cb …/*.woff2` = **344312** |
| AC2 Không request bên thứ ba | Đạt | `assets.test.ts` › no third-party: `app.css` không `@import`, không `url(http…)`/`//`; mọi URL tuyệt đối trong `<head>` (trừ JSON-LD là dữ liệu) có host `vnx.si`; mọi `script/img/iframe src` và `link stylesheet/preload/icon` là đường dẫn cùng origin, trên 6 trang gồm cả 404 |
| AC3 Logo | Đạt | `layout.test.ts` › logo files: 3 SVG phục vụ 200, `viewBox="0 0 64 64"`, hình B (`M14 16 L32 48 L50 16` + 3 `circle`), đúng màu; icon có `rect rx="15" fill="#0D1526"`; favicon link + mark trong header và footer trên 6 trang |
| AC4 Header | Đạt | `layout.test.ts` › header: 4 locale, nav 4 mục đúng link theo locale, `aria-current="page"` đúng 1 mục; `<details class="lang-menu">` với 4 link tới cùng trang; chưa đăng nhập có Sign in + CTA (`/login?next=…/hub/apply`); đã đăng nhập có Builder Hub + form `POST /logout`, không còn `/login`; panel di động `<details class="menu">` (`summary aria-label`) có cùng các link. Test cũ `builders-page`/`products-page` (`<a href="/vi/products">Sản phẩm</a>` trong header) vẫn xanh |
| AC5 Footer | Đạt | `layout.test.ts` › footer: 4 `nav` có `aria-label` (Marketplace, Builders, Company, Language), link Products/Find builders/How it works; Become a builder/Sign in; Media kit/`mailto:contact@vnx.si`/Terms/Privacy; `© <năm UTC hiện tại> VNX.SI`; 4 link ngôn ngữ; `test/legal/footer.test.ts` xanh |
| AC6 Landing 0–2 product | Đạt | `page.test.ts` › thứ tự khối hero → deck → nguyên tắc (4) → `#how` (4) → `#trust` (3) → `#builders` (3 bước, dải công cụ có bản `aria-hidden`) → `#notify`; không chữ số trong text `<main>` ở 5 đường dẫn × có/không `?joined=1`; không link `/products`; số thứ tự bằng `counter()` trong CSS. `deck.test.ts` › 3 thẻ `booking`, `crm`, `ai_agents` ở 4 locale; ca 2 product công khai + 1 product của builder `suspended` vẫn là thẻ category, không chữ số |
| AC7 Landing ≥ 3 product | Đạt | `deck.test.ts`: thẻ là 3 product đầu của `searchProducts(parseCatalogQuery({}))` (cùng truy vấn với `/products` trang 1), link `/p/:slug` theo locale, không còn thẻ category; product của builder `suspended` và product thứ 4 không xuất hiện; category, ngôn ngữ chính, giá thấp nhất (`catalog.from` + `formatUsd`), huy hiệu đang hiệu lực đúng; tier chỉ `contact` → "Contact for price" |
| AC8 Form waitlist | Đạt | `test/landing/waitlist.test.ts` xanh, không sửa dòng nào. Markup giữ `<form method="post" action="…/waitlist#notify">`, `<label for="waitlist-email">`, `<input id="waitlist-email" name="email" type="email"…`, checkbox, honeypot, input ẩn `utm_*`/`ref`, lỗi theo ô, `?joined=1` |
| AC9 Câu chữ | Đạt | `page.test.ts`: bảng 68 dòng key → EN/VI so khớp từng chữ với bảng "Nội dung"; mọi câu `landing.*` + hero note hiện trên trang ở 4 locale; 15 key cũ đã xóa (14 `landing.*` + `footer.nav`); mọi key `landing.*` còn lại được dùng trong `src`. `test/i18n/parity.test.ts` xanh |
| AC10 Motion | Đạt | `assets.test.ts` › motion: có `@keyframes fadeUp/ping/belt`; khối `prefers-reduced-motion: reduce` chứa `.reveal`, `.reveal-scroll`, `.ping`, `.belt-track`, `.deck-card`, `.lift`, `.btn`, `animation: none`, `transition: none`; `animation-timeline` chỉ nằm trong `@supports (animation-timeline: view())`; ngoài đó `.reveal-scroll` không có quy tắc ẩn; `landing.js` gọi `matchMedia("(prefers-reduced-motion: reduce)")` |
| AC11 landing.js | Đạt | 1744 byte; không `import`/`require`/`fetch`/URL; `<script src="/assets/landing.js" defer>` chỉ trên landing (4 locale + `?joined=1`), không có trên `/products`, `/builders`, `/vi/terms`, `/login` |
| AC12 Không vỡ trang khác | Đạt | `npm test`: 468/468. Mọi class cũ trong `src/views/**` vẫn có style (giữ cả khối class landing VNX-0708 và `.lang` cho nhánh khác) |
| AC13 Typecheck | Đạt | `npm run typecheck -w apps/web` exit 0 |
| AC14 Media Kit | Đạt | `test/legal/content.test.ts` (đỏ ở baseline vì `docs/legal/media-kit.md` đã có dòng Logo files mới) nay xanh cả EN và VI |
| AC15 Nhìn giống artboard | Đã tự kiểm, chờ Reviewer | Xem mục "Kiểm tra bằng mắt" |

## Kết quả lệnh

```
$ npm run typecheck -w apps/web
… wrangler types … && tsc --noEmit
typecheck exit=0

$ npm test
 Test Files  69 passed (69)
      Tests  468 passed (468)

$ du -cb apps/web/public/assets/fonts/*.woff2 | tail -1
344312	total

$ wc -c apps/web/public/assets/landing.js
1744 apps/web/public/assets/landing.js
```

- Số test: trước **432** (430 xanh, 2 đỏ: media kit EN/VI vì tài liệu nguồn đã đổi trước task) → sau **468** (468 xanh). Thêm 36 test mới; `page.test.ts` viết lại theo thiết kế mới.
- `app.css`: 46249 byte (trong đó ~16 KB là 27 khối `@font-face` có `unicode-range` đầy đủ).

## Kiểm tra bằng mắt (AC15)

Chạy `wrangler dev --port 8797` (đã tắt khi xong), chụp Chrome headless. Ảnh ở scratchpad phiên: `C:\Users\User\AppData\Local\Temp\claude\d--DOCS-SUPHAM-GIT-vnxsi\dd9ecbbc-7b18-4ee6-882b-eeabea10ab67\scratchpad\shots\`.

| Ảnh | Đã xem |
|---|---|
| `hero-1280-light.png`, `landing-1280-light.png` | 1280 px sáng, EN: so với artboard v2: header 68 px dính trên cùng, nav, nút ngôn ngữ, CTA; hero có lưới + lớp mờ, pill chấm xanh, h1 62 px, 2 nút 52 px, dòng mono; chồng thẻ 3 lớp xoay 3°/6°, "ảnh app" vẽ bằng CSS, chip huy hiệu, 2 nút; dải nguyên tắc 4 cột; 4 thẻ How it works có ô biểu tượng màu và số 01–04; Trust 2 cột với chip; khối tối có perks, nút sáng, 3 bước, dải công cụ; CTA cuối căn giữa với form; footer 4 cột + hàng dưới. Bố cục, màu, cỡ chữ khớp artboard |
| `landing-1280.png` | 1280 px **tối** (Chrome lấy theo hệ thống): mọi khối đọc được |
| `hero-1280-dark.png` | `/zh-hant/` tối: chữ Trung dùng font hệ thống, đọc được |
| `landing-768.png` | 768 px: menu 3 gạch, hero 1 cột, deck dưới, dùng được |
| `landing-390-vi-rm.png`, `landing-390-vi-rm2.png` (+ ảnh cắt `landing-390-vi-top/mid/bot.png`, `mobile-fixes.png`) | 390 px `/vi/` trong iframe 390 px, có `--force-prefers-reduced-motion`: không chuyển động, nút chấm hiện (JS bật) nhưng không tự xoay, dải công cụ đứng yên và xuống dòng |
| `pages.png` (`page-products.png`, `page-login.png`, `page-vi-media-kit.png`) | `/products`, `/login`, `/vi/media-kit`: chỉ đổi header/footer/font/token, bố cục giữ nguyên |

Sửa sau khi xem (`628e61e`): checkbox đồng ý bị lệch vì `.field input { min-height: 44px }` áp cả lên checkbox (lỗi có từ VNX-0708); nút trong thẻ deck xuống 2 dòng ở 390 px; dải nguyên tắc quá thưa trên điện thoại; dải công cụ bị cắt khi reduced-motion; `main.container` không có khoảng trên nên thẻ đăng nhập dính vào header.

**Chưa kiểm bằng mắt (Reviewer xem giúp):** deck khi có ≥ 3 product thật (DB local trống; hành vi có test); panel menu di động và menu ngôn ngữ khi mở (headless không bấm được); header khi đã đăng nhập. Ở 390 px, ảnh không bật reduced-motion cho phần hero trống, vì animation theo thời gian không chạy trong iframe của Chrome headless; ở trang chính 1280 px hero hiện bình thường.

## Sai khác so với plan/mockup (kèm lý do)

1. **Logo trong header/footer:** SVG nội tuyến (component `BrandMark`), màu lấy từ token `--logo-ink/--logo-node/--logo-dot` nên tự đổi ở dark mode. Plan để Implementer chọn.
2. **`vnxsi-icon.svg`:** artboard không có bản icon của Option B. Tôi dựng theo mô tả của plan (ô `#0D1526` bo 15, hình B nét trắng, nút đáy `#6B93FF`); hình B thu 75% vào giữa ô, nét dày hơn (6/5 thay 5/4) để còn đọc được ở 16 px, nút trên nền `#0D1526` viền trắng.
3. **Thẻ product dùng ảnh bìa thật** (ảnh media đầu tiên) ở vùng "ảnh app"; chỉ khi không có ảnh mới dùng hình vẽ CSS. Plan không liệt kê ảnh, nhưng hình vẽ giả đặt trên thẻ product thật có thể bị hiểu là ảnh chụp sản phẩm.
4. **Footer khi đã đăng nhập:** nhóm Builders chỉ có "Builder Hub" (`/hub`), thay vì Become a builder + Sign in (plan chỉ mô tả trạng thái chưa đăng nhập).
5. **Vùng chạm 44 px:** nút ngôn ngữ, nút trong thẻ deck và link footer cao ≥ 44 px (artboard 40 px / ~32 px), theo yêu cầu "mọi vùng chạm ≥ 44 px". Footer vì thế thưa hơn artboard một chút.
6. **Ô email:** nhãn "Email" ẩn bằng CSS (vẫn có `<label for>`), placeholder dùng lại chuỗi `landing.form.email`. Artboard dùng placeholder `you@company.com`, nhưng câu đó không có trong bảng nội dung nên tôi không thêm.
7. **Một key `site.rankings`** cho cả dòng ghi chú ở hero lẫn footer (cùng câu EN/VI).
8. **Xóa thêm key `footer.nav`** (không phải `landing.*`): nhóm Company dùng `footer.company`, nên `footer.nav` không còn chỗ dùng. Selector trong `footer.test.ts` đổi theo.
9. **Kiểu chữ dùng chung:** `h1`, `h2` toàn site chuyển sang Space Grotesk 600 (h1 30–40 px, h2 22–28 px); display/landing dùng 700 như artboard. Audit mục 2.1 nói "không 700", nhưng plan và artboard dùng 700 nên tôi theo plan.
10. **`main.container` có `padding-top: 24px`** (trước đây bằng 0 vì `.container` đè `main`): mọi trang khác có thêm 24 px dưới header dính.
11. **Deck xếp chồng bằng CSS grid** (các thẻ chung một ô) thay cho chiều cao cố định 480/440 px của artboard, để chiều cao theo nội dung ở mọi locale; nút chấm nằm dưới, cách 52 px.
12. **`.lift` dùng thuộc tính `translate`** thay vì `transform`, vì animation `reveal-scroll` giữ `transform` sau khi chạy, sẽ chặn hiệu ứng nhấc khi hover.
13. **Reduced motion:** ngoài việc tắt animation, dải công cụ hiện mỗi tên một lần và xuống dòng (bản nhân đôi ẩn).
14. **Không có JS:** thẻ sau có thể nhận focus bằng bàn phím và nổi lên trước nhờ `:focus-within`. Có JS thì thẻ sau mang `inert` + `aria-hidden` cho tới khi được xoay lên trước. Deck dừng xoay khi hover hoặc khi focus nằm trong deck (hai cờ riêng), và khi tab bị ẩn.
15. **Lớp mờ radial ở hero:** giữ theo artboard và plan, dù audit 2.2 nói "không gradient trên nền".
16. **`builderCtaHref`** chuyển sang `Layout.tsx` (header/footer cũng cần), và `LandingPage.tsx` export lại.
17. **CJK:** `:root:lang(zh-Hant)` đưa font phồn thể (PingFang TC, Microsoft JhengHei, Noto Sans CJK TC) lên trước.
18. **`firstPublicProducts`** bỏ qua product biến mất giữa hai lần đọc thay vì đoán ngôn ngữ mặc định.

## Danh sách file nhánh M5 (`feat/m5-inquiry`) có thể cũng chạm (để gộp)

- `apps/web/src/views/Layout.tsx`: viết lại gần hết (header, footer, head). Props mới tùy chọn: `fullWidth`, `scripts`; export mới `builderCtaHref`, `BrandMark`. Props cũ giữ nguyên.
- `apps/web/public/assets/app.css`: viết lại toàn bộ. Mọi class cũ còn style; biến CSS cũ (`--ground`, `--ink`, `--ink-2`, `--line`, `--accent`, `--accent-ink`, `--good`, `--radius`) giữ làm alias của token mới. Nếu M5 thêm CSS: gộp vào cuối file, ưu tiên token mới (`--bg`, `--surface`, `--text`, `--primary`, `--border`, `--r-md`…).
- `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`: thêm `nav.howItWorks`, `nav.forBuilders`, `nav.becomeBuilder`, `nav.menu`, `footer.marketplace`, `footer.builders`, `footer.company`, `site.rankings` và các key `landing.*` mới; xóa 14 key `landing.*` cũ và `footer.nav`.
- `apps/web/src/views/LandingPage.tsx`, `apps/web/src/routes/landing.tsx` (prop mới `deck`).
- `apps/web/src/db/catalog.ts` (thêm hàm ở cuối file, import thêm).
- `apps/web/src/legal/content.ts` (2 dòng Logo files; xem thêm nếu M5 sửa Privacy).
- `apps/web/test/landing/page.test.ts`, `apps/web/test/legal/footer.test.ts`.

## Câu hỏi mở

1. Footer khi đã đăng nhập: chỉ "Builder Hub" (cách tôi làm) hay giữ "Become a builder" + "Sign in" như artboard?
2. Hình icon B (sai khác 2) có cần Owner duyệt riêng không, vì artboard Logo không vẽ bản icon cho Option B?
3. Bản dịch `zh-Hans`/`zh-Hant` của các câu mới do tôi dịch từ EN; cần người bản xứ đọc lại ở VNX-0801 như plan đã ghi.
4. Placeholder ô email: giữ "Email" hay thêm câu mới (ví dụ `you@company.com` của artboard)? Câu mới cần Owner duyệt.

## Ghi nhận (ngoài phạm vi, không làm)

- Ngoài ô waitlist (đã sửa trong phạm vi landing), các form khác vẫn bị `.field input { min-height: 44px; padding: 0 14px }` áp lên checkbox/radio; nên xử lý khi làm đợt B/C.
- Header thu gọn khi cuộn (`animation-timeline: scroll()`, audit 2.6) chưa làm vì plan không yêu cầu.
