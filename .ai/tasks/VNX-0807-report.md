# VNX-0807 — Báo cáo của Implementer (T1–T5; T6 chưa làm)

Nhánh `feat/vnx-0807-a11y`, worktree `D:/DOCS/SUPHAM/GIT/vnxsi-0807`. Plan: `.ai/plans/VNX-0807-plan.md` (APPROVED, OQ-1 duyệt nguyên văn). Không push, không merge.

## Commit theo sub-task

| Sub-task | SHA | Nội dung |
|---|---|---|
| T1 | `48bf207` | R2(a) guard lỗi tải cùng origin (`support/network.ts`, fixture `page`), R2(b) quét axe `nojs` EN + VI, R3 count-up đòi chữ số, R5 `settle` chờ animation hữu hạn; mục `KNOWN_A11Y` cho R1 |
| T2 | `e9b50e1` | R1: `Deck.tsx` render `inert` + `aria-hidden="true"` cho thẻ slot >= 1 từ server; xóa mục KNOWN; test deck |
| T3 | `ad88b6c` | `FormErrorSummary.tsx`, `Layout invalid` (+ `HubLayout`), i18n x4, CSS `.error-summary`, `expectErrorSummary` trong `test/helpers.ts`, test component |
| T4a | `068f84d` | Inquiry |
| T4b | `d5a5f20` | Request + Contact + Waitlist (landing) |
| T4c | `0e3626a` | BuilderForm + Apply + Portfolio + Products + Pricing + Step + Media |
| T4d | `9633159` | InquiryThread + Invitations |
| T5 | `a055e3d` | E2E `form-errors.spec.ts` (+ sửa `inquiry.spec.ts`, `editor.spec.ts`) |
| fix | `0d60e9d` | `settle` dùng `waitForFunction` thay `waitForTimeout` (guard `test:scripts` chặn `waitForTimeout`) |
| báo cáo | commit chứa tệp này | |

## Kết quả R1 và leo thang

Tái hiện: lượt quét `nojs` khi bỏ mục KNOWN đỏ với `target-size (serious) .btn-sm.btn-primary[href$="market-product-03"]` (EN và VI) tại T1.
**Bước 1 của plan (`inert` + `aria-hidden` từ server) là đủ**: sau T2, quét `nojs` EN + VI xanh với `KNOWN_A11Y` rỗng. Không cần bước 2 (CSS `pointer-events`) hay bước 3 (`display:none` khi không JS). `landing.js` không đổi (ngân sách 2 KB giữ nguyên). Lưu ý: quét `nojs` chỉ phủ chế độ thẻ danh mục (seed E2E chưa có đủ 3 product công khai); chế độ thẻ product được test bằng Vitest (`expectBehind` trong `test/landing/deck.test.ts`).

## Cách làm

- Tóm tắt lỗi: `<section id="form-errors" class="error-summary" tabindex="-1" autofocus aria-labelledby="form-errors-title">` + `<h2>` + `<ul>`; không `role="alert"`. Mỗi mục là "Nhãn: lỗi" liên kết `#id` của control; lỗi cấp form (captcha, rate limit, self, 503) là mục không liên kết. Lỗi theo field giữ `aria-describedby`/`aria-invalid`, bỏ `role="alert"`.
- Nhóm field (checkbox/radio): liên kết trỏ vào control đầu tiên của nhóm (đã thêm `id`: `rq-languages`, `workLanguages`, `availability`, `pp-priceMode`; contact dùng `ct-role-builder` có sẵn).
- `builder.form.errorSummary` được giữ làm dòng dẫn (`lead`) dưới tiêu đề của form hub (BuilderForm, ProductStepForm, PricingForm), nên không xóa khỏi 4 locale (tránh xung đột EPIC 26).
- Landing: tóm tắt trong `#notify`; test xác nhận canonical vẫn phát, không có thẻ robots (SEO không đổi).

## Sai khác so với plan (cần Reviewer xem)

1. **Vị trí khối tóm tắt:** đặt ngay trước `<form>` (trong card), không phải trong form, với Inquiry/Request/Portfolio/Products/Contact; để vẫn hiện khi form bị chặn (`blocked`, 503 không có siteKey): trường hợp đó không có form nhưng có `formError`.
2. **Route phải sửa 2 chỗ nhỏ** (plan nói không sửa route): `routes/hub-products.tsx` (`pricingPage` truyền `invalid` vào `EditorLayout`) và `routes/hub-inquiries.tsx` (`threadPage` truyền `invalid` vào `HubLayout`). Hai route này không nằm trong danh sách EPIC 26 chạm tới. Lý do: `<title>` do `Layout` render nên trang nào do route tự ghép Layout thì route phải báo `invalid`.
3. **`routes/me.tsx` KHÔNG sửa (theo lệnh)** nên trang thread phía client `/me/inquiries/:id` có khối tóm tắt + focus nhưng **chưa có tiền tố `<title>`**. Plan viết "route me.tsx không phải sửa" là chưa đúng cho phần title. T6 phải thêm `invalid={threadErrorItems({ summary, viewer: "client", ...extra }, tr).length > 0}` vào `<Layout>` trong `me.tsx` (hàm `threadErrorItems` đã export từ `views/InquiryThread.tsx`). Test `test/me/inquiries.test.ts` ("re-renders an empty client reply...") có ghi chú và cố ý không kiểm title.
4. **Sửa thêm E2E ngoài danh sách plan:** `editor.spec.ts:119` đòi `getByRole("alert")` "Please fix the highlighted fields." nên đổi sang `#form-errors` + title. `login.spec.ts` giữ nguyên (T6).
5. `support/csp.ts` sửa nhỏ: dòng console "Failed to load resource" của request đã được test khai báo `allowSameOriginFailure` không bị tính là lỗi (cần để quét `nojs` dùng `route.abort`).
6. R2(a) bỏ qua `net::ERR_ABORTED` (trình duyệt tự hủy request khi điều hướng); mọi lỗi khác trên cùng origin làm `settle()` ném `E2E infrastructure: <url> failed (<errorText>)`.
7. Worktree thiếu `node_modules` nên chạy `npm ci` một lần.

## Kiểm kê AC9

`grep -rn "status\|, 400)\|, 422)\|, 429)" apps/web/src/routes --include=*.tsx` (trừ `admin*`, `ops*`): mọi route render-lại-4xx đều nằm trong bảng kiểm kê của plan. Đã xét và không phải form có lỗi: `auth.tsx:77` (`InvalidLinkPage` 400, ngoài phạm vi), `me-requests.tsx` `requestPage(... 400)` (không có form/lỗi), `hub-products.tsx:232` (`stepPage` 400 với `errors = {}` khi gửi duyệt thiếu mục: dùng thông báo `gaps` có sẵn). Login 400/429 (`auth.tsx`) và profile (`hub.tsx`): T6.

## Lệnh và kết quả (trên `0d60e9d`)

- `npm run typecheck -w apps/web`: 0 lỗi.
- `npm test -w apps/web -- --maxWorkers=2`: 165 file, 1919 test, tất cả xanh (300 s).
- `npm run e2e` lần 1: 57 passed (1,3 phút). Lần 2: 57 passed. Không retry, không flaky.
- `npm run e2e:typecheck`: sạch.
- `npm run test:scripts`: 52/52 (lần đầu 51/52: guard `waitForTimeout` bắt `settle`, đã sửa ở `0d60e9d`).
- Không chạy `wrangler dev` ngoài webServer của E2E; sau khi chạy xong chỉ còn socket TIME_WAIT, không có listener ở 8799/9329.

Test theo AC (tên tệp):
- AC1/AC2: `test/landing/deck.test.ts`, `test/design/assets.test.ts`, `test/home/motion.test.ts`.
- AC3: `e2e/tests/a11y.spec.ts` ("axe, no JS"); AC4: `e2e/tests/meta.spec.ts` (settle ... E2E infrastructure); AC5: `home.spec.ts` + `a11y.spec.ts`.
- AC6: `test/i18n/parity.test.ts` (+ `test/views/form-error-summary.test.tsx` kiểm nguyên văn chuỗi đã duyệt).
- AC7: `test/views/form-error-summary.test.tsx`, `test/design/layout.test.ts`.
- AC8 theo form: Inquiry `test/public/inquiry-form.test.ts`; Request `test/public/request-form.test.ts`; Contact `test/contact/submit.test.ts`; Waitlist `test/landing/waitlist.test.ts`; Apply `test/hub/apply.test.ts`; Portfolio `test/hub/portfolio.test.ts`; Products + Step `test/hub/products.test.ts`; Pricing `test/hub/pricing.test.ts`; Media `test/hub/media.test.ts`; thread builder `test/hub/inquiries.test.ts`; thread client `test/me/inquiries.test.ts`; Invitations `test/hub/invitations.test.ts`. Helper dùng chung: `expectErrorSummary` trong `apps/web/test/helpers.ts`.
- AC10: `e2e/tests/form-errors.spec.ts` (Inquiry EN + VI kèm quét axe trang 400, Request, Contact EN + VI) và `inquiry.spec.ts`.
- AC12 (CSP, không script/style inline mới): E2E xanh với fixture `csp` tự động; không thêm script nào.
- AC14: chưa chạy (Owner chưa cho push).

## Việc còn mở / dành cho T6 (sau khi EPIC 26 merge vào `main`)

1. Rebase lên `main` đã có EPIC 26, rồi:
   - `views/auth.tsx` `LoginPage`: thêm `FormErrorSummary` đầu form, `invalid={!!error}` vào `<Layout>`, bỏ `role="alert"` ở `#email-error` (dòng 29). `login.error.email` (400) liên kết `#email`; `login.error.rateLimited` (429) là mục không liên kết. `error` hiện là một chuỗi chung nên cần phân biệt lỗi field và lỗi cấp form (không sửa `routes/auth.tsx` được nếu view tự suy ra; nếu không suy ra được thì báo Reviewer).
   - `views/hub/ProfilePage.tsx`: truyền `invalid={builderErrorItems(errors, tr).length > 0}` vào `HubLayout` (`BuilderForm` đã có tóm tắt từ T4c; hiện trang profile đã hiện tóm tắt + focus nhưng chưa có tiền tố title).
   - `routes/me.tsx`: thêm `invalid` vào `<Layout>` của `threadPage` như sai khác 3.
2. `e2e/tests/login.spec.ts:26` đang đòi `getByRole("alert")`: đổi sang kiểm title `Error:`, `#form-errors` có focus, liên kết `#email` (có thể export `expectErrorPattern` từ `form-errors.spec.ts` ra `support/`). Thêm login vào `form-errors.spec.ts` theo ghi chú ở đầu tệp.
3. Vitest cho login + profile dùng `expectErrorSummary`.
4. Reviewer: thêm VNX-0807 vào roadmap/backlog, cập nhật `e2e/README.md` (số test 49 -> 57, `support/network.ts`, biến thể `nojs`), ghi `CURRENT-STATUS.md`; ghi vào "Ghi nhận": form `/admin/*`, `/ops/*` ngoài phạm vi; bản dịch `zh-*` của `form.error.*` (AI dịch) vào danh sách chờ người bản xứ.
5. `autofocus` trên `tabindex=-1` chỉ kiểm ở Chromium (rủi ro WebKit cũ đã nêu trong plan).

## Vòng sửa 1 (F1, F4, F5, F8)

- **F1:** `views/LandingPage.tsx`: action của form waitlist bỏ `#notify` (`localizedPath(locale, "/waitlist")`). Luồng thành công không đổi vì `routes/landing.tsx` đã tự redirect tới `/?joined=1#notify`. Test `test/landing/page.test.ts` (2 chỗ) cập nhật theo action không fragment. E2E mới trong `form-errors.spec.ts` (EN + VI): email sai -> 400, URL không có hash, title `Error:` / `Lỗi:`, `#form-errors` có focus, liên kết focus `#waitlist-email`, giá trị giữ nguyên.
- **F4:** `routes/contact.tsx`: 503 khi thiếu siteKey không truyền `formError` (giống route request), chỉ còn thông báo `contact.form.unavailable` của form; test `test/contact/submit.test.ts` đòi đúng một lần xuất hiện.
- **F5:** xóa `hasFormErrors` và dòng test dùng nó.
- **F8:** `e2e/support/a11y.ts`: một định nghĩa "unfinished" cài vào trang (`window.__unfinished`), dùng cho cả chờ và thông báo lỗi.
- Kết quả: typecheck 0 lỗi; Vitest 165 file / 1919 test xanh; `npm run e2e` hai lần: 59 passed mỗi lần; `e2e:typecheck` sạch; `test:scripts` 52/52.

## T6 (login, hub profile, client thread)

Base: origin/main 1362ab4 (EPIC 26 + T1-T5). Changes:

- `views/auth.tsx` `LoginPage`: `FormErrorSummary` before `<form>`; `invalid` on `<Layout>`. The view tells the 400 from 429/502 by comparing `props.error` with `tr("login.error.email")` (no change to `routes/auth.tsx`). 400: linked item `#email`, keeps `aria-invalid`/`aria-describedby`/`#email-error` (without `role="alert"`). 429/502: unlinked form-level item, no `aria-invalid`, no `#email-error`. EPIC 26 OAuth failures render on their own pages (`OAuthNotLinkedPage`, `OAuthErrorPage`, no form), not through `LoginPage`'s `error` prop, so they are outside the summary and unchanged.
- `views/hub/ProfilePage.tsx`: `invalid={builderErrorItems(errors, tr).length > 0}` on `HubLayout`. The EPIC 26 badge block has no `autofocus`; the 400 page has exactly one (checked by `expectErrorSummary`).
- `routes/me.tsx` `threadPage`: `invalid={threadErrorItems(...)}` on `<Layout>`.
- Tests: `login-flow.test.ts` (400 `["email"]`, 429 formLevel 1 with no aria-invalid, GET clean, VI pass `Lỗi:`), `profile.test.ts` (400 `["name"]`), `me/inquiries.test.ts` (`["th-body"]`, T6 note removed). E2E `login.spec.ts`: title `Error:`, `#form-errors` focused, heading, one link, no `[role=alert]`, link focuses `#email`. POST /login budget unchanged (2).
- Remaining `role="alert"` outside admin/ops: none (only a comment in `FormErrorSummary.tsx`).
- Verify: typecheck 0; Vitest 2285/2285 (188 files); `npm run e2e` 59/59 twice, no retry; `e2e:typecheck` clean; `test:scripts` 52/52.
- Note: on this loaded machine the default 5000 ms Vitest timeout fails first tests in cold files (4 unrelated timeouts in the first full run, 607 s); with `--testTimeout=60000` everything passes. Not a code issue.
