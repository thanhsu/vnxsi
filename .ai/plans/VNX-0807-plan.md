# VNX-0807 — a11y: homepage không JS (target-size) và mẫu lỗi chung cho form render phía server · Plan

- **Trạng thái:** **APPROVED** (Opus duyệt thay Owner theo ủy quyền M6+, 2026-10-10). OQ-1: Owner duyệt nguyên văn câu chữ (2026-10-10): tiền tố tiêu đề EN `Error:` / VI `Lỗi:` / zh-Hans `错误：` / zh-Hant `錯誤：`; tiêu đề khối tóm tắt EN `There is a problem` / VI `Có lỗi cần sửa` / zh-Hans `有问题需要修正` / zh-Hant `有問題需要修正` (zh do AI dịch). OQ-2..OQ-5 theo mặc định của plan (có form waitlist; chấp nhận thẻ sau inert khi không JS; bỏ `role="alert"` ở lỗi từng trường; T6 sau khi EPIC 26 merge, T1–T5 có thể ra mắt trước).
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M8, VNX-0807 (ID đề xuất; Reviewer thêm vào roadmap/backlog sau). Task theo dõi của `.ai/reviews/VNX-0802-review.md` (R1, F8, R2, R3, R5) và nghĩa vụ "Sau VNX-0802 (a11y…)" trong `.ai/context/CURRENT-STATUS.md`.
- **Spec / NFR:** `docs/blueprint/02-NFR.md` mục Khả năng tiếp cận (WCAG 2.2 AA cho mọi trang công khai và form; vùng chạm >= 44 px; focus nhìn thấy; form có label). WCAG 2.2: 2.5.8 Target Size (AA), 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA), 2.4.2 Page Titled (A), 4.1.3 Status Messages (AA).
- **ADR:** ADR-003 (i18n: 4 locale, parity key; `zh-*` do AI dịch, cần người bản xứ đọc trước khi quảng bá). Không cần ADR mới (không đổi kiến trúc; thêm một component view và một prop của `Layout`).
- **Phụ thuộc:** `origin/main` `e78c1c5` (VNX-0802 xong, có `e2e/`). Phối hợp với EPIC 26 (`feat/epic26-linked-accounts`, chưa merge), xem "Trình tự và xung đột".
- **Implementer / Reviewer:** Implementer (subagent Sonnet, context mới) viết mọi thứ chạy được (view, CSS, i18n, test, E2E); Reviewer (Claude) review, cập nhật `e2e/README.md` nếu cần, `CURRENT-STATUS.md`.

## Vì sao làm bây giờ

VNX-0802 lộ một vi phạm WCAG 2.2 AA có thật (R1: homepage không JS có nút bị che, `target-size`) và một khoảng trống lớp A11y mà axe không bắt được (F8: form 4xx render lại cả trang nhưng `<title>` không đổi, không có tóm tắt lỗi, focus không chuyển, `role="alert"` có sẵn lúc tải không được trình đọc màn hình đọc chắc chắn). Cả hai nên xong trước khi ra mắt M8; R2/R3/R5 làm bộ E2E đủ tin cậy để giữ kết quả.

## Phạm vi

**Trong phạm vi**

1. **R1:** thẻ sau của deck hero (`views/landing/Deck.tsx`) được render `inert` + `aria-hidden="true"` ngay từ server; `landing.js` vẫn là nơi bật/tắt khi xoay. Không đổi CSP, ngân sách `landing.js` <= 2 KB (hiện 1744 B), vẫn đọc được khi không JS.
2. **F8:** một mẫu lỗi chung cho mọi form render phía server trả 4xx kèm render lại trang (kiểm kê ở dưới): tiền tố `<title>`, khối tóm tắt lỗi ở đầu form có liên kết tới từng field, chuyển focus không cần JS, giữ lỗi theo field + `aria-describedby`/`aria-invalid`; khóa i18n x4 locale.
3. **R2, R3, R5** ở `e2e/` (mục Thiết kế 5).
4. Test: Vitest theo từng form (tiền tố title, markup tóm tắt, liên kết khớp id field); E2E cho tóm tắt + focus ở **Inquiry, request, contact, login** (login ở task cuối); test deck không JS.

**Ngoài phạm vi**

- Form của `/admin/*` và `/ops/*` (console tiếng Anh, nội bộ, ADR-010 §1; thông báo lỗi dùng `ops.*` chỉ có EN). Ghi vào "Ghi nhận" của `CURRENT-STATUS.md`, không sửa.
- Trang lỗi 4xx/5xx không phải form (`ErrorPage`, `InvalidLinkPage`, 404/409) và HTTP 429/502 của route không render form.
- Xác thực phía client (HTML5 `required`/`minlength` có sẵn giữ nguyên), nhóm field `fieldset`/`aria-live` động, đổi `Layout` toàn cục khác ngoài một prop `invalid`.
- Đổi trang `Deck` về hình thức/hoạt ảnh; thêm JS mới cho form (task này không thêm bất kỳ script nào).
- Firefox/WebKit trong E2E (OQ-5 của VNX-0802 vẫn: chỉ Chromium).
- Cải tiến lân cận: ghi vào `CURRENT-STATUS.md` mục "Ghi nhận".

## Kiểm kê form render phía server trả 4xx (từ code, `origin/main` e78c1c5)

| # | Form | Route -> view | Nguồn lỗi | Nhóm |
|---|---|---|---|---|
| 1 | Inquiry `/b/:handle/hire` và `/p/:slug/hire` (một view) | `routes/inquiry-form.tsx` -> `views/InquiryFormPage.tsx`; 400 (field), 429/502/503 (`formError`) | `InquiryErrors` + `formError` | A |
| 2 | Request mới `/request` | `routes/request-form.tsx` -> `views/RequestFormPage.tsx`; 400 | field + `formError` | A |
| 3 | Contact | `routes/contact.tsx` -> `views/ContactPage.tsx` + `contact/ContactForm.tsx`; 400 | field + `formError` (captcha) | A |
| 4 | Waitlist trên landing `/` | `routes/landing.tsx` -> `views/LandingPage.tsx`; 400 | field | A (title của landing + khối tóm tắt trong `#notify`; xem Rủi ro) |
| 5 | Builder apply `/hub/apply` | `routes/hub-apply.tsx` -> `views/hub/ApplyPage.tsx` + `hub/BuilderForm.tsx`; 400 | `FieldErrors` | A |
| 6 | Hồ sơ builder `/hub/profile` | `routes/hub.tsx` -> `views/hub/ProfilePage.tsx` + `BuilderForm.tsx`; 400 | `FieldErrors` | **C** (EPIC 26) |
| 7 | Portfolio tạo/sửa | `routes/hub-portfolio.tsx` -> `views/hub/PortfolioPage.tsx`; 400 | field | A |
| 8 | Tạo product (tên) | `routes/hub-products.tsx` -> `views/hub/ProductsPage.tsx`; 400 | một lỗi tên | A |
| 9 | Bước product | `hub-products.tsx` -> `hub/ProductStepForm.tsx` (đã có tóm tắt `role="alert"` nhưng chưa liên kết/focus) | `StepErrors` | A (mẫu gốc, F9) |
| 10 | Pricing | `hub-products.tsx` -> `hub/PricingForm.tsx`; 400 | field | A |
| 11 | Media demo | `routes/hub-media.tsx` -> `hub/MediaSection.tsx`; 400 | một lỗi (`media-error`) | A |
| 12 | Phản hồi/lý do trong thread (builder) | `routes/hub-inquiries.tsx` -> `views/InquiryThread.tsx`; 400 | `replyError`, `reasonError` | A |
| 13 | Thread phía client `/me/inquiries/:id` | `routes/me.tsx` -> **cùng** `InquiryThread.tsx` | như 12 | A cho view; route `me.tsx` **không phải sửa** (view tự suy ra lỗi) |
| 14 | Trả lời lời mời + lý do từ chối | `routes/hub-invitations.tsx` -> `hub/InvitationsPage.tsx`; 400 | `errors`, `reasonError` | A |
| 15 | Login | `routes/auth.tsx` -> `views/auth.tsx` `LoginPage`; 400/429/502 | một `error` | **C** (EPIC 26) |

Quy tắc kiểm kê cho Implementer: sau khi xong, chạy `grep -rn "status\|, 400)\|, 422)\|, 429)" apps/web/src/routes --include=*.tsx` (trừ `admin*`, `ops*`) và xác nhận không còn route render-lại-4xx nào ngoài bảng; nếu thấy, thêm vào bảng và báo cáo.

## Thiết kế

### 1. R1: deck không JS (`views/landing/Deck.tsx`)

Hai thẻ sau (slot >= 1) nhận `inert` và `aria-hidden="true"` từ server (cả `CategoryCard` và `ProductDeckCard`: tham số `slot`). `landing.js` đã đặt đúng các thuộc tính này trong `show()` lúc nạp (`show(0)`) và khi xoay, nên **không đổi JS** (không đụng ngân sách 2 KB; Implementer vẫn chạy test AC11). Lý do chọn: không cần CSS/JS mới, không có khoảnh khắc "thẻ sau bấm được", đúng với lỗi gốc (thẻ sau chỉ bị vô hiệu hóa bởi JS).

Hono JSX phải render `inert=""` (kiểm bằng test: `inert` xuất hiện trong HTML dưới dạng thuộc tính boolean hợp lệ, không `inert="false"`).

**Có thể axe vẫn báo `target-size` trên phần tử `inert`** (chưa kiểm được ở bước lập plan; axe tính vùng chồng bằng hình học). Task phải kiểm thực nghiệm bằng lượt quét R2(b) và leo thang theo thứ tự, dừng ở bước đầu tiên hết vi phạm:

1. `inert` + `aria-hidden` từ server (mặc định).
2. Thêm CSS `.deck-card:not([data-slot="0"]) { pointer-events: none; }` (chỉ CSS).
3. Không xếp chồng khi không JS: `.deck:not([data-live]) .deck-card:not(:first-child) { display: none; }`; `landing.js` thêm `deck.setAttribute("data-live","")` (khoảng 30 B, vẫn <= 2 KB). Không JS thì chỉ thấy thẻ đầu, đọc được, không che gì.

Đánh đổi cần Owner biết (OQ-3): không JS, người dùng trình đọc màn hình không tới được thẻ sau trong hero (đã `aria-hidden`/ẩn). Chấp nhận được vì chúng chỉ là bản lặp của danh mục `/products` (liên kết ở nav và CTA hero) và có JS thì hành vi như cũ.

Test Vitest (`test/landing/deck.test.ts`, mở rộng): cả hai chế độ (thẻ danh mục và thẻ product); slot 0 không `inert`/`aria-hidden`; slot 1, 2 có `inert` và `aria-hidden="true"`; EN + VI. `test/design/assets.test.ts` AC10/AC11 giữ xanh.

### 2. F8: thành phần chung

**Chọn cách chuyển focus: `autofocus` lên khối tóm tắt (`tabindex="-1"`), không phải field lỗi đầu.** Lý do:

- Khối tóm tắt là mẫu chuẩn (GOV.UK Design System error summary; WCAG Technique G139/G83 "mô tả lỗi bằng văn bản", ARIA APG): người dùng trình đọc màn hình nghe được tiêu đề "có lỗi" và toàn bộ danh sách trước khi đi sửa; focus thẳng vào field đầu bỏ qua lỗi của các field khác và bỏ qua lỗi cấp form (captcha, rate limit, gửi mail thất bại) vốn không thuộc field nào.
- `role="alert"` hiện có chỉ báo khi *thay đổi*; trang vừa tải thì không chắc. Focus lên một phần tử có tên (heading) thì chắc chắn được đọc. Vì vậy khối tóm tắt là `<section tabindex="-1" autofocus aria-labelledby="form-errors-title">` chứa `<h2 id="form-errors-title">` và `<ul>` liên kết. **Không** dùng `role="alert"` cùng lúc (tránh đọc đôi).
- `autofocus` là thuộc tính HTML, không cần JS, CSP không liên quan. Chỉ có một khối tóm tắt trên mỗi trang nên chỉ một `autofocus`. Cuộn tới khối tóm tắt là hành vi mặc định của autofocus.
- Rủi ro: `autofocus` trên phần tử `tabindex=-1` chạy ở Chromium/Firefox; WebKit cũ có thể bỏ qua (khi đó người dùng thấy khối tóm tắt đầu form nhưng focus không chuyển; vẫn không mất thông tin vì có tiền tố title + khối ở đầu trang). Ghi vào Rủi ro. E2E chỉ Chromium.

**Thành phần `views/FormErrorSummary.tsx` (mới, dùng chung):**

```ts
export type FormErrorItem = { href: string; message: string };   // href = "#<id của input>" hoặc "" cho lỗi cấp form (không liên kết)
export const FormErrorSummary: FC<{ tr: Translate; items: readonly FormErrorItem[] }>  // null khi items rỗng
export const hasFormErrors = (items: readonly unknown[]) => items.length > 0;
```

- Mỗi mục: `<li><a href="#iq-message">{message}</a></li>` hoặc `<li>{message}</li>` khi không có field. Thông điệp dùng đúng chuỗi lỗi theo field đang có (không thêm chuỗi trùng), kèm nhãn field khi cần để mục tự đủ nghĩa (ví dụ "Message: Too short"): tái dùng nhãn `tr(<field label key>)` đã có của từng form.
- Khối được đặt **trong form, ngay trước field đầu tiên** (hoặc ngay dưới `<h1>` cho form một field); không bọc trong landmark mới. Thứ tự liệt kê = thứ tự field trên trang.
- Giữ nguyên lỗi theo field: `<p id="<id>-error" class="error-msg">` + `aria-invalid="true"` + `aria-describedby`. **Bỏ `role="alert"` trên từng lỗi field** khi có tóm tắt (nhiều alert đọc chồng, đúng mẫu F9); `formError` cấp form chỉ nằm trong tóm tắt, không lặp thành `<p role="alert">`. (OQ-4 nếu Owner muốn giữ.)
- Helper theo form (hàm thuần trong cùng file view, ví dụ `inquiryErrorItems(errors, tr)`): chuyển `errors` của form thành `FormErrorItem[]`. Mỗi form tự biết map field -> id input.

**`Layout` thêm prop `invalid?: boolean`:** khi `true`, `<title>` = `${tr("form.error.titlePrefix")} ${title}` (chỉ `<title>`; `og:title` giữ nguyên vì trang `noindex`/không chia sẻ). `HubLayout` truyền `invalid` xuống. Các view gọi `invalid={items.length > 0}` từ chính `errors` của chúng, nên **route không phải đổi** (không phụ thuộc status 400) và route `me.tsx`/`hub.tsx` của EPIC 26 không bị đụng.

**i18n (x4, `form.error.*`):** `form.error.titlePrefix`, `form.error.summaryTitle`. Chuỗi hiện có `builder.form.errorSummary` ("Please fix the highlighted fields.") dùng làm dòng dẫn dưới tiêu đề cho hub; nếu sau task không còn nơi dùng thì xóa khỏi 4 locale (parity). Đề xuất (OQ-1):

| Key | EN | VI | zh-Hans (AI) | zh-Hant (AI) |
|---|---|---|---|---|
| `form.error.titlePrefix` | `Error:` | `Lỗi:` | `错误：` | `錯誤：` |
| `form.error.summaryTitle` | `There is a problem` | `Có lỗi cần sửa` | `有问题需要修正` | `有問題需要修正` |

Không có chữ số trong chuỗi mới (test `no digits` của landing/home đọc view, không đọc locale, nhưng giữ nguyên tắc). Parity: `npm test -w apps/web -- test/i18n`. Đặt khóa mới **cạnh `builder.form.errorSummary`** (khoảng dòng 74), không ở cuối file, để giảm xung đột với EPIC 26 (nó thêm 49 dòng ở các file này).

**CSS** (`public/assets/app.css`): `.error-summary` cạnh `.error-msg` (dòng 221): viền/nền dùng token `--error`, `:focus` có outline nhìn thấy (`outline: 3px solid var(--focus...)` theo token hiện có), tương phản >= 4,5:1 ở sáng/tối (test tương phản token có sẵn của VNX-0706 phải xanh). Thay đổi `app.css` nhỏ, một khối, để EPIC 26 (+5 dòng) merge sạch.

### 3. Trình tự và xung đột với EPIC 26

`git diff origin/main...feat/epic26-linked-accounts` (96 file) đụng: `routes/auth.tsx`, `routes/me.tsx`, `routes/hub.tsx`, `routes/builder-profile.tsx`, `views/auth.tsx` (`LoginPage`: prop `providers`, nút OAuth), `views/hub/ProfilePage.tsx` (khối huy hiệu), `views/BuilderProfilePage.tsx`, 4 file `i18n/messages/*.ts` (+49 dòng mỗi file), `app.css` (+5), `vitest.config.ts`, `wrangler.jsonc`. Không đụng `Layout.tsx`, `HubLayout.tsx`, `BuilderForm.tsx`, `InquiryThread.tsx`, `ContactForm.tsx`, các view còn lại, hay `e2e/`.

Quyết định: **làm hết phần không đụng EPIC 26 trước (T1-T5), phần chạm file của EPIC 26 để T6 sau khi EPIC 26 merge vào `main`.**

- Điểm merge của T6 (tối thiểu, chính xác): (a) `views/auth.tsx` `LoginPage`: thêm `FormErrorSummary` ở đầu form + `invalid={!!props.error}` vào `<Layout>`; (b) `views/hub/ProfilePage.tsx`: truyền `invalid` vào `HubLayout`, và nếu `BuilderForm` (đã đổi ở T4) nhận tóm tắt thì không đổi gì thêm. **Không sửa `routes/auth.tsx`, `routes/me.tsx`, `routes/hub.tsx`** (view tự suy ra lỗi). Vì `LoginPage` được EPIC 26 sửa (prop `providers`), T6 rebase lên `main` đã có EPIC 26 rồi sửa.
- `me.tsx` thread phía client dùng `InquiryThread.tsx` (T4) nên tự có mẫu mới mà không phải sửa route.
- i18n/`app.css`: nếu xung đột lúc merge, chỉ là hai khối cạnh nhau, giải quyết bằng giữ cả hai.
- Nếu EPIC 26 chưa merge khi T1-T5 xong: dừng, báo Owner (T6 chờ), không rebase lên nhánh EPIC 26 chưa merge. Phương án thay thế nếu Owner muốn ra mắt trước: ra mắt với T1-T5 (login/hub profile còn mẫu cũ), T6 là bản vá sau.

### 4. Sửa test hiện có bị ảnh hưởng

`e2e/tests/inquiry.spec.ts:41-56` đòi `role="alert"` trên lỗi field và `getByRole("alert")` cho lỗi Turnstile; `e2e/tests/login.spec.ts:26` đòi `getByRole("alert")`. Các test Vitest tìm `role="alert"` (grep `role=\\"alert\\"` trong `apps/web/test`) sẽ đổi sang kiểm khối tóm tắt/`aria-describedby`. Implementer liệt kê và cập nhật; không xóa kiểm tra nội dung lỗi, chỉ đổi vai trò truy vấn.

### 5. E2E (`e2e/`)

- **R2(a)** `support/a11y.ts` `settle()`: lắng nghe `requestfailed` của mọi tài nguyên cùng origin (gắn từ trước `goto`, nên thêm helper `watchSameOriginFailures(page)` dùng bởi fixture `page` trong `support/test.ts`); trước khi chạy axe, nếu có thất bại thì ném `E2E infrastructure: <url> failed (<errorText>)`. Danh sách ngoại lệ có tên cho request cố ý bị `route.abort` (xem (b)).
- **R2(b)** biến thể quét `/` với `/assets/landing.js` và `/assets/home.js` bị `route.abort` (giả lập không JS mà axe vẫn chạy). Dùng thêm trường `variant: "nojs"` trong `ScanKey` (và `KnownA11y`). Bước đầu (T1) thêm mục `KNOWN_A11Y` trỏ tới R1 để lượt quét xanh có kiểm soát, rồi **T2 xóa mục đó** (mục không còn khớp sẽ làm test đỏ: đúng cơ chế "không để danh sách lỗi thời" của VNX-0802). Quét cả EN và VI.
- **R3** `tests/home.spec.ts` count-up: `moved` đòi một lịch sử có giá trị trung gian là **chữ số** khác số cuối (`/\d/.test(t) && t !== final`), không phải chuỗi rỗng.
- **R5** `settle()` biến thể có chuyển động: chờ mọi animation hữu hạn kết thúc (`document.getAnimations()`, bỏ animation `iterations === Infinity`, có timeout 5 s và thông báo rõ ràng) trước axe.
- **Error summary E2E** (`tests/forms-errors.spec.ts` mới, hoặc mở rộng spec có sẵn): Inquiry (gửi rỗng): `<title>` bắt đầu bằng `Error:`, `document.activeElement` là khối tóm tắt (`#form-errors`), tóm tắt liệt kê đúng số lỗi, **bấm liên kết đầu tiên** đưa focus vào đúng field, giá trị đã nhập còn nguyên, trang không có `role="alert"` trùng. Lặp cho request và contact (trong T5); login (trong T6, dùng email sai: một mục, liên kết `#email`). Quét axe trang 400 của Inquiry (không để lại vi phạm). Vi (`/vi/...`): tiền tố `Lỗi:`.

### 6. Tệp

Sửa: `apps/web/src/views/landing/Deck.tsx`; `apps/web/src/views/Layout.tsx` (prop `invalid`); `views/hub/HubLayout.tsx`; `views/InquiryFormPage.tsx`, `RequestFormPage.tsx`, `ContactPage.tsx`, `contact/ContactForm.tsx`, `LandingPage.tsx`, `hub/ApplyPage.tsx`, `hub/BuilderForm.tsx`, `hub/PortfolioPage.tsx`, `hub/ProductsPage.tsx`, `hub/ProductStepForm.tsx`, `hub/PricingForm.tsx`, `hub/MediaSection.tsx`, `InquiryThread.tsx`, `hub/InvitationsPage.tsx`; (T6) `views/auth.tsx`, `views/hub/ProfilePage.tsx`; `i18n/messages/{en,vi,zh-hans,zh-hant}.ts`; `public/assets/app.css`; (nếu leo thang bước 3) `public/assets/landing.js`; tests liên quan; `e2e/support/a11y.ts`, `support/a11y-known.ts`, `support/test.ts`, `tests/a11y.spec.ts`, `tests/home.spec.ts`, `tests/inquiry.spec.ts`, `tests/login.spec.ts`, spec mới `tests/form-errors.spec.ts`.
Tạo: `apps/web/src/views/FormErrorSummary.tsx`, `apps/web/test/views/form-error-summary.test.tsx` (+ test theo form).
Không đụng: `routes/*` (trừ khi kiểm kê tìm thêm), migration, `wrangler.jsonc`, `vitest.config.ts`, `landing.js` (trừ bước leo thang 3).

## Sub-task theo thứ tự

| # | Việc | Phụ thuộc EPIC 26? |
|---|---|---|
| T1 | R2(a) (+ ngoại lệ có tên), R2(b) biến thể `nojs` kèm mục `KNOWN_A11Y` cho R1, R3, R5. Chạy `npm run e2e` xanh; ghi lại tái hiện R1 (đỏ khi gỡ mục KNOWN). | Không |
| T2 | R1: `Deck.tsx` render `inert`/`aria-hidden` cho slot >= 1; xóa mục KNOWN; test deck; nếu axe còn báo thì leo thang bước 2 -> 3. Chạy lượt quét `nojs` EN + VI xanh không có mục KNOWN. | Không |
| T3 | `FormErrorSummary.tsx`, prop `Layout.invalid` + `HubLayout`, CSS, i18n x4 (OQ-1 đã duyệt), test đơn vị component + title + parity. | Không (i18n/css: hai khối nhỏ cạnh nhau) |
| T4 | Áp mẫu cho form nhóm A (bảng kiểm kê 1-5, 7-14) theo từng commit nhỏ: (a) Inquiry; (b) Request + Contact + Waitlist; (c) `BuilderForm` + Apply + Portfolio + Products + Pricing + Step + Media; (d) `InquiryThread` + Invitations. Mỗi form: Vitest (tiền tố title, `autofocus`+`tabindex="-1"` trên tóm tắt, mỗi liên kết trỏ tới `id` tồn tại trong cùng trang, không chữ "undefined"). Cập nhật các test `role="alert"` cũ (mục 4). | Không |
| T5 | E2E error summary + focus: Inquiry, request, contact (EN + một lượt VI); quét axe trang 400 Inquiry; cập nhật `inquiry.spec.ts`. | Không |
| T6 | **Sau khi EPIC 26 merge vào `main`**: rebase, áp mẫu cho `LoginPage` + `ProfilePage`; test Vitest + E2E login (`login.spec.ts`: email sai -> title, summary, focus, liên kết `#email`). Cập nhật README `e2e/` nếu thêm lệnh (Reviewer). | **Có** |

Mỗi sub-task kết thúc bằng một commit (`fix(web)`, `test(e2e)`, `feat(web)` theo Conventional Commits) kèm `Co-Authored-By` theo cấu hình phiên. Không push, không merge, không deploy.

## Tiêu chí chấp nhận → cách kiểm

(Vitest: luôn thêm `--maxWorkers=2`; E2E chạy local, không `--remote`.)

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | Thẻ deck slot >= 1 có `inert` + `aria-hidden="true"` trong HTML server, cả hai chế độ, EN + VI | `npm test -w apps/web -- --maxWorkers=2 test/landing/deck.test.ts` |
| AC2 | `landing.js` <= 2 KB, không import/mạng; vẫn không `setInterval` ở `home.js` | `npm test -w apps/web -- --maxWorkers=2 test/design/assets.test.ts test/home/motion.test.ts` |
| AC3 | Quét axe `/` và `/vi/` khi `landing.js` + `home.js` bị abort: 0 vi phạm, `KNOWN_A11Y` rỗng | `npm run e2e -- tests/a11y.spec.ts -g "no JS"` |
| AC4 | Tài nguyên cùng origin tải lỗi (không thuộc danh sách abort có tên) làm test dừng với `E2E infrastructure: <url> failed` trước axe | `npm run e2e -- tests/meta.spec.ts` (test mới chặn một asset bằng `route.abort` và đòi đúng thông điệp lỗi) |
| AC5 | Count-up đòi giá trị trung gian là số; lượt "with motion" chờ animation hữu hạn | `npm run e2e -- tests/home.spec.ts tests/a11y.spec.ts` |
| AC6 | Parity i18n x4: `form.error.titlePrefix`, `form.error.summaryTitle` có ở cả 4 locale, không rỗng, cùng placeholder | `npm test -w apps/web -- --maxWorkers=2 test/i18n` |
| AC7 | `Layout invalid` thêm tiền tố vào `<title>` (4 locale) và không đụng `og:title`; không có prop thì không đổi | `npm test -w apps/web -- --maxWorkers=2 test/views/form-error-summary.test.tsx test/design/layout.test.ts` |
| AC8 | Mỗi form nhóm A trả 4xx có: tiền tố title, một `section[tabindex="-1"][autofocus]` có heading, liên kết `#id` khớp field (hoặc mục không liên kết cho lỗi cấp form), giữ `aria-describedby`/`aria-invalid`, không `role="alert"` trùng | `npm test -w apps/web -- --maxWorkers=2 test/inquiry test/request-gate.test.ts test/contact test/hub test/landing test/me` (Implementer ghi tên file test chính xác từng form vào báo cáo) |
| AC9 | Không có route 4xx render form nào ngoài bảng kiểm kê (trừ admin/ops) | lệnh grep của mục Kiểm kê, kết quả dán vào báo cáo |
| AC10 | E2E: Inquiry/request/contact 400: title `Error:`/`Lỗi:`, focus vào khối tóm tắt, bấm liên kết đưa focus vào field, giá trị giữ nguyên; axe trang 400 sạch | `npm run e2e -- tests/form-errors.spec.ts tests/inquiry.spec.ts` |
| AC11 | (T6) Login và hồ sơ hub: cùng mẫu; E2E login xanh | `npm run e2e -- tests/login.spec.ts` |
| AC12 | CSP không vi phạm, không script/style inline mới; toàn bộ E2E xanh không retry | `npm run e2e` |
| AC13 | Toàn bộ Vitest + typecheck + test script xanh | `npm test -w apps/web -- --maxWorkers=2` ; `npm run typecheck -w apps/web` ; `npm run e2e:typecheck` ; `npm run test:scripts` |
| AC14 | CI xanh cả job `test` và `e2e` trên nhánh (Owner push) | `gh run list --branch feat/vnx-0807-a11y --limit 1` (sau khi Owner cho push) |

## Rủi ro

- **axe vẫn báo `target-size` trên thẻ `inert`** (chưa kiểm): có bậc leo thang 2 -> 3 ở mục 1; lượt quét `nojs` (T1) là bằng chứng quyết định.
- **`autofocus` + `tabindex="-1"`** không đảm bảo ở mọi trình duyệt (WebKit cũ). Mất mát có giới hạn (khối tóm tắt vẫn ở đầu form, title đã có tiền tố). Test tự động chỉ ở Chromium.
- **Waitlist trên landing**: trang landing dài; autofocus cuộn tới khối trong `#notify`, và `<title>` của landing có tiền tố lỗi. Nếu Owner thấy khó chịu thì loại form #4 khỏi phạm vi (OQ-2). Ảnh hưởng hồ sơ SEO: không (trang trả 400, `noindex` mặc định cho phản hồi lỗi? Implementer xác nhận bằng test rằng landing 400 không phát canonical/robots sai so với hiện tại).
- **Đổi `role="alert"`**: các test cũ và E2E 0802 phải sửa (mục 4); không để rơi kiểm tra nội dung lỗi.
- **Xung đột i18n/`app.css`/`views/auth.tsx` với EPIC 26**: giảm bằng trình tự (T6 sau merge) và đặt khóa i18n/CSS cạnh khối có sẵn, không ở cuối file.
- **Cỡ task**: 14 form. Giảm bằng component + helper map field -> id, commit theo nhóm, test mẫu dùng chung (một hàm `expectErrorSummary(html, ids)` trong `test/helpers.ts`).
- **Bộ nhớ khi chạy Vitest** (ghi nhớ của dự án): luôn `--maxWorkers=2`; không `rm -rf node_modules`.
- **Bản dịch `zh-*` do AI**: chưa người bản xứ đọc (ADR-003), nằm trong danh sách đọc trước khi quảng bá `zh`.

## Câu hỏi mở

- **OQ-1 (UI copy, cần Owner duyệt nguyên văn):** tiền tố title `Error:` / `Lỗi:` và tiêu đề tóm tắt `There is a problem` / `Có lỗi cần sửa` (đề xuất ở mục i18n; zh do AI dịch, chờ người bản xứ). Mặc định nếu Owner im lặng: dùng đúng đề xuất. Plan **chưa APPROVED** cho tới khi Owner duyệt chuỗi.
- **OQ-2:** có đưa form waitlist trên landing (#4) vào phạm vi không? Mặc định: có (T4b), loại bỏ nếu Owner muốn giữ landing nguyên.
- **OQ-3:** chấp nhận đánh đổi R1 (không JS, thẻ sau của hero `aria-hidden`/inert, trình đọc màn hình không tới được; nếu phải leo thang bước 3 thì thẻ sau ẩn hẳn)? Mặc định: chấp nhận.
- **OQ-4:** bỏ `role="alert"` trên từng lỗi field khi đã có khối tóm tắt (theo mẫu F9, tránh đọc chồng)? Mặc định: bỏ.
- **OQ-5:** nếu EPIC 26 chưa merge trước ngày ra mắt M8, ra mắt với T1-T5 và để T6 làm sau? Mặc định: có.
