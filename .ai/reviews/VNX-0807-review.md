# VNX-0807 — Review (T1–T5)

- **Reviewer:** Claude (Opus, phiên review độc lập)
- **Ngày:** 2026-10-10
- **Đã đọc:** `CLAUDE.md`; plan `.ai/plans/VNX-0807-plan.md` (APPROVED, câu chữ OQ-1 Owner duyệt nguyên văn); báo cáo `.ai/tasks/VNX-0807-report.md` (7 sai khác, việc T6); toàn bộ diff `origin/main` `e78c1c5` .. `544d835` (nhánh `feat/vnx-0807-a11y`, 55 tệp: src, test, e2e); `git diff origin/main...feat/epic26-linked-accounts --name-only` (98 tệp) để đối chiếu xung đột.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-0807`, trên `544d835`):**
  - `npm run typecheck -w apps/web`: exit 0, 0 lỗi.
  - `npm test -w apps/web -- --maxWorkers=2`: 165 file, 1919 test, tất cả xanh (335 s).
  - `npm run e2e` lần 1: 57 passed (1,5 phút); lần 2: 57 passed (1,2 phút). Không retry, không flaky. Sau mỗi lần: không còn listener ở 8799/9329, không còn `workerd`.
  - `npm run e2e:typecheck`: sạch.
  - `npm run test:scripts`: 52/52.
  - `git merge-tree --write-tree HEAD feat/epic26-linked-accounts`: xung đột đúng bằng tập xung đột của `origin/main` với EPIC 26 (`auth/middleware.ts`, `env.ts`, `test/architecture.test.ts`, không tệp nào của VNX-0807); i18n x4 và `app.css` tự merge.
  - Thử nghiệm riêng (script Playwright trong scratchpad, không commit): `autofocus` trên `section[tabindex=-1]` khi URL tài liệu có fragment trỏ tới phần tử tồn tại (xem F1).

## Verdict

**APPROVE WITH CHANGES** (APPROVE_AFTER_FIXES): một phát hiện MEDIUM (F1) phải sửa trước khi ra mắt; còn lại LOW/SUGGESTION hoặc chuyển cho T6/Owner.

Tóm tắt: mẫu lỗi chung đúng thiết kế, áp đủ 13 form nhóm A, test thật (helper `expectErrorSummary` kiểm title, một `autofocus`, heading, liên kết khớp id có trong trang, số mục, không `undefined`, không `role="alert"`). R1 sửa bằng bậc 1 (không cần CSS/JS). E2E R2/R3/R5 có tác dụng thật. Không đụng tệp nào của EPIC 26 ngoài hai khối i18n/CSS đã lường trước.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| F1 | MEDIUM | `apps/web/src/views/LandingPage.tsx:272` (`action={…"/waitlist"}#notify`) | Form waitlist gửi tới `/waitlist#notify`; trang 400/429 trả về có URL mang fragment `#notify` và `#notify` tồn tại. Theo HTML (“flush autofocus candidates”: tài liệu có target element thì bỏ autofocus), Chromium **không** chuyển focus vào `#form-errors`. Đã kiểm thực nghiệm với Chromium của Playwright 1.64: `GET …/waitlist` → focus `form-errors`; `GET …/waitlist#notify` → `BODY`; POST form thật tới `…#notify` → `BODY`; `GET …#form-errors` → `form-errors`. Tiền tố title và khối tóm tắt vẫn có (trang cuộn tới `#notify`), nên 3.3.1 vẫn đạt, nhưng lời hứa “focus vào khối tóm tắt không cần JS” (AC8, thiết kế mục 2) không đúng cho form này, và Vitest không thể bắt được. | Đổi fragment của `action` để autofocus không bị bỏ: hoặc bỏ `#notify` (autofocus tự cuộn tới khối tóm tắt nằm trong `#notify`), hoặc trỏ `#form-errors` (điều hướng fragment tự focus phần tử `tabindex=-1`, cũng chạy được ở trình duyệt bỏ qua `autofocus`). Redirect thành công (`?joined=1#notify`) và redirect spam giữ nguyên. Thêm một test E2E waitlist (`/vi/` hoặc `/`, email sai, tắt validate trình duyệt): title `Lỗi:`/`Error:`, `#form-errors` có focus, liên kết `#waitlist-email` đưa focus vào ô. POST sai không bị đếm rate limit (route `landing.tsx` trả 400 trước bước đếm). Cập nhật bảng ngân sách POST của `e2e/README.md` nếu thêm (Reviewer). | Implementer |
| F2 | LOW | `apps/web/src/routes/me.tsx:28`; `views/hub/ProfilePage.tsx` | Sai khác 3 (và tương tự ở hồ sơ hub): trang thread phía client `/me/inquiries/:id` và `/hub/profile` đã có khối tóm tắt + focus + lỗi theo field, nhưng `<title>` chưa có tiền tố cho tới T6. Chấp nhận: 3.3.1/3.3.3 đạt bằng văn bản (tóm tắt + lỗi theo field), 2.4.2 không đòi tiền tố; tiền tố là tăng cường. Không sửa `me.tsx` lúc này là đúng plan (tệp của EPIC 26). EPIC 26 không đụng dòng `<Layout>` của `threadPage`, nên sửa ở T6 là một dòng, không xung đột. | Làm ở T6 (checklist dưới). | Implementer (T6) |
| F3 | LOW | `.ai/tasks/VNX-0807-report.md`, sai khác 1 | Báo cáo nói khối tóm tắt đặt trước `<form>` với “Inquiry/Request/Portfolio/Products/Contact”; thực tế Portfolio (`PortfolioPage.tsx:39`) và Products (`ProductsPage.tsx:45`) đặt **trong** form, như plan. Chỉ sai mô tả; hành vi đúng. Đánh giá sai khác 1 (Inquiry/Request/Contact/Waitlist/Invitations đặt ngay trước `<form>`): chấp nhận được, thậm chí tốt hơn (khối vẫn hiện khi form bị chặn, đúng mẫu GOV.UK đặt tóm tắt ở đầu nội dung; thứ tự focus 2.4.3 vẫn là tóm tắt → field). | Không cần sửa code; ghi nhận ở review này. | Không |
| F4 | LOW | `views/contact/ContactForm.tsx` (nhánh `!signedIn && siteKey === null`) + `routes/contact.tsx:92` | Contact 503 khi không có site key: câu `contact.form.unavailable` hiện hai lần (mục tóm tắt và `p.notice` ngay dưới). Trước đây nhánh bị chặn không hiện `formError`. Inquiry có trùng tương tự từ trước VNX-0807; request đã tránh bằng cách truyền `undefined` khi không có site key. Không sai WCAG, chỉ lặp. | Tùy chọn: căn theo request (route truyền `formError` `undefined` khi `turnstileSiteKey` null) hoặc giữ nguyên. Không chặn. | Owner quyết; Implementer nếu sửa |
| F5 | LOW | `apps/web/src/views/FormErrorSummary.tsx:7` | `hasFormErrors` được export nhưng không nơi nào trong `src` dùng (chỉ test). Plan có liệt kê, nhưng là mã chết. | Bỏ export + dòng test, hoặc dùng ở các chỗ `items.length > 0`. Không chặn. | Implementer (tùy chọn) |
| F6 | LOW | `docs/blueprint/07-MASTER-BACKLOG.md` (EPIC 8) | Trùng ID: backlog đã có `VNX-0807` = “Mời đủ ~100 builder theo đợt” (HUMAN, chưa bắt đầu, không được tham chiếu ở đâu khác trên `origin/main`, EPIC 26, M7). Plan dùng VNX-0807 cho a11y (đã có nhánh, commit, plan, báo cáo). Reviewer đã đổi task HUMAN sang `VNX-0808` (ghi rõ “trước đây VNX-0807, chờ Owner xác nhận”) trong commit docs. | Owner xác nhận hoặc chọn cách khác. | Owner |
| F7 | SUGGESTION | `views/Layout.tsx:146` + i18n `form.error.titlePrefix` zh | `Layout` ghép `${prefix} ${title}`, nên tiêu đề zh thành `错误： …` (dấu hai chấm toàn khổ rồi thêm dấu cách ASCII); văn bản Trung thường không có cách sau `：`. Câu chữ là bản Owner duyệt, zh do AI dịch. | Đưa vào danh sách người bản xứ đọc (VNX-0801); nếu cần, dấu cách thuộc về chuỗi locale thay vì `Layout`. | Owner / VNX-0801 |
| F8 | SUGGESTION | `e2e/support/a11y.ts` `finiteAnimationsDone` | Bộ lọc animation viết hai lần (một trong `pending`, một trong `waitForFunction`). | Gom một chỗ khi có dịp. | Implementer (tùy chọn) |
| F9 | SUGGESTION | `e2e/tests/a11y.spec.ts` (nojs) | Lượt `nojs` chỉ phủ chế độ thẻ danh mục; chế độ thẻ product chỉ có Vitest (`expectBehind`). Chấp nhận: cả hai chế độ dùng chung helper `behind()` nên thuộc tính giống hệt, và câu hỏi thực nghiệm “axe có bỏ `target-size` trên phần tử `inert` không” đã được trả lời trên chế độ danh mục. | Khi seed E2E có >= 3 product công khai, thêm lượt `nojs` cho chế độ product. Ghi vào nghĩa vụ. | Task sau |

Các điểm đã xét và **không** thành phát hiện:

- **WCAG của mẫu tóm tắt.** 3.3.1: lỗi được nêu bằng văn bản ở tóm tắt và ở từng field (`aria-describedby` + `aria-invalid` giữ nguyên; thêm `aria-describedby` còn thiếu ở `th-reason`, `pp-reason`, `media-file`/`media-alt`). 3.3.3: mỗi mục là “Nhãn: lỗi” với câu gợi ý có sẵn. 2.4.3: tóm tắt đứng trước field đầu, thứ tự liệt kê = thứ tự trang (kiểm bằng thứ tự id trong `expectErrorSummary`). 4.1.3: không áp dụng cho tải lại cả trang; thông báo đến từ tiền tố `<title>` (đọc khi tải) và focus vào vùng có tên. `autofocus` trên `section[tabindex=-1][aria-labelledby]`: focus lên vùng có tên làm trình đọc màn hình đọc tên “There is a problem”; các mục đọc tiếp khi người dùng đi tiếp, đúng chỗ. Bỏ `role="alert"` ở từng field: đúng OQ-4 (tránh đọc chồng; `role="alert"` có sẵn lúc tải vốn không chắc được đọc). `<section>` có tên thành landmark `region`: chính markup của plan, axe sạch trên trang 400 Inquiry.
- **`invalid` chỉ khi thật sự có lỗi.** Mọi view tính `invalid` từ chính danh sách mục tóm tắt; GET truyền lỗi rỗng; Contact có `!p.sent`, landing `!joined`, Invitations chỉ khi `answerable`, pricing `!lock`, Portfolio chỉ khi form thêm đang hiện, Media/Editor chỉ khi form tương ứng hiện. Test Inquiry kiểm trang GET sạch không có `form-errors`/`Error:`. Không có route nào render 200 kèm `formError` (đã grep). Re-render 409 (handle trùng, slug trùng) và 429/502/503 cũng có tiền tố: là lỗi, đúng ý.
- **Liên kết khớp id thật:** kiểm từng map field → id (`builderErrorItems` khớp `id` của `BuilderForm`, kể cả control đầu của nhóm `workLanguages`/`availability`; `tier-<i>-<name>`; `pf-<name>` (checkbox `customizable` không có lỗi nên không cần id); `ct-*`; `rq-*`; `pp-*`; `th-*`; `media-*`). Liên kết bị bỏ khi control không có trên trang (email khi đã đăng nhập, thread đã đóng, media không cho upload).
- **Câu chữ OQ-1 nguyên văn x4** (`Error:`/`Lỗi:`/`错误：`/`錯誤：`; `There is a problem`/`Có lỗi cần sửa`/`有问题需要修正`/`有問題需要修正`): đúng, có test khóa nguyên văn; khóa đặt cạnh `builder.form.errorSummary`, parity xanh, không chữ số.
- **CSP:** không thêm script/style inline; `autofocus` là thuộc tính HTML. Fixture CSP chạy ở mọi test E2E và xanh.
- **R1 / người dùng không JS:** thẻ sau `inert` + `aria-hidden` từ server; `landing.js` không đổi và đặt cùng trạng thái ở `show(0)`, nên không có khoảnh khắc khác nhau giữa có/không JS. Người không JS mất khả năng tới hai thẻ sau của hero; nội dung đó là bản lặp của `/products` (nav và CTA hero), đúng đánh đổi OQ-3 đã duyệt. Tính không rỗng của lượt `nojs`: ở T1 hai mục `KNOWN_A11Y` (EN, VI) có mặt và suite xanh, mà mục không khớp vi phạm nào sẽ làm đỏ, nên vi phạm đã được tái hiện thật; T2 xóa mục và vẫn xanh.
- **Guard lỗi tải (R2(a)) và ngoại lệ:** `net::ERR_ABORTED` là request trình duyệt tự hủy (điều hướng đi, request bị thay thế); `route.abort()` mặc định cho `net::ERR_FAILED` nên guard vẫn bắt (test meta chứng minh, khớp đúng `net::ERR_FAILED`). Ngoại lệ có tên chỉ theo path và theo từng trang. Lỗi HTTP 4xx/5xx của asset không phải `requestfailed`, nhưng bộ nghe CSP vẫn bắt qua `console.error` lúc kết thúc test, và `settle()` vẫn kiểm `app.css` có quy tắc. Không che lỗi thật.
- **R3, R5:** count-up đòi giá trị trung gian chứa chữ số; lượt motion chờ animation hữu hạn theo thời gian (bỏ vô hạn và gắn cuộn), có timeout và thông báo rõ.
- **Sai khác 2 (hai route):** `routes/hub-products.tsx` và `routes/hub-inquiries.tsx` không có trong 98 tệp của EPIC 26 (đã đối chiếu `--name-only`); sửa một dòng mỗi chỗ, cần vì `<title>` do `Layout` ở route render. Chấp nhận.
- **Sai khác 4–7:** sửa `editor.spec.ts` (giữ kiểm nội dung, đổi truy vấn vai trò), lọc console cho request đã khai báo, `npm ci` một lần: chấp nhận.
- **Không đụng tệp EPIC 26:** giao giữa hai tập tệp chỉ có `app.css` và 4 tệp i18n (đã lường trong plan), cả 5 tự merge.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `test/landing/deck.test.ts` (`expectBehind`, cả thẻ danh mục và thẻ product, EN + VI, `inert=""` không `inert="false"`); suite Vitest xanh |
| AC2 | ✓ | `landing.js` không đổi; `test/design/assets.test.ts`, `test/home/motion.test.ts` xanh |
| AC3 | ✓ | `a11y.spec.ts` “axe, no JS” EN + VI xanh, `KNOWN_A11Y` rỗng (2 lượt E2E) |
| AC4 | ✓ | `meta.spec.ts` “settle stops with E2E infrastructure …” xanh, khớp đúng thông điệp |
| AC5 | ✓ | `home.spec.ts` count-up + lượt “with motion” xanh |
| AC6 | ✓ | `test/i18n/parity.test.ts` + test nguyên văn trong `test/views/form-error-summary.test.tsx` |
| AC7 | ✓ | `test/views/form-error-summary.test.tsx` (4 locale, `og:title` không đổi, không prop thì không đổi); `test/design/layout.test.ts` xanh |
| AC8 | ✓ một phần | Markup đạt cho 13 form nhóm A (test theo form ở báo cáo). Ngoại lệ: focus không thật sự chuyển ở waitlist do fragment (F1); `/me` thread chưa có tiền tố title (F2, T6) |
| AC9 | ✓ | Kiểm kê trong báo cáo; Reviewer grep lại `formError`/status trong `routes/`: không có route render-lại-4xx ngoài bảng (trừ admin/ops, login/profile của T6) |
| AC10 | ✓ | `form-errors.spec.ts` (Inquiry EN + VI kèm axe trang 400, request, contact EN + VI) và `inquiry.spec.ts` xanh |
| AC11 | — | T6, chờ EPIC 26 merge |
| AC12 | ✓ | `npm run e2e` 57/57 hai lần, không retry, fixture CSP xanh, không script/style inline mới |
| AC13 | ✓ | Vitest 1919/1919, typecheck 0 lỗi, `e2e:typecheck` sạch, `test:scripts` 52/52 |
| AC14 | — | Chưa push (Owner chưa cho) |

## Việc Reviewer đã làm (docs)

- `e2e/README.md`: 57 test; `support/network.ts` (guard, ngoại lệ `ERR_ABORTED`, `allowSameOriginFailure`, phân biệt lỗi mạng và HTTP); biến thể `nojs` và chờ animation; `form-errors.spec.ts`; bảng ngân sách POST thêm `/request`, `/contact`; mục “Đọc kết quả”; danh sách form chỉ có Vitest.
- `docs/roadmap/WAVE1-ROADMAP.md` M8: thêm VNX-0807.
- `docs/blueprint/07-MASTER-BACKLOG.md` EPIC 8: thêm VNX-0807 (🔄, T6 chờ EPIC 26); task HUMAN cũ chuyển sang VNX-0808 (F6).

## Nghĩa vụ để lại cho task sau

**Vòng sửa (sau khi Owner duyệt):** F1 (bắt buộc); F4, F5, F8 tùy Owner.

**T6 (sau khi EPIC 26 merge vào `main`; rebase nhánh lên `main` đó, không rebase lên nhánh EPIC 26 chưa merge):**

1. `apps/web/src/views/auth.tsx` `LoginPage` (bản có prop `providers` của EPIC 26): thêm `<FormErrorSummary>` ở đầu khối form (trước `<form>` để nhất quán với Inquiry/Request); `invalid` vào `<Layout>` khi có lỗi; bỏ `role="alert"` ở `#email-error` (dòng 29 trên `origin/main`). Lỗi email sai (400) là mục liên kết `#email` và giữ `aria-invalid`/`aria-describedby`; rate limit (429) và lỗi gửi mail (502) là mục không liên kết, không gắn `aria-invalid` cho ô email. Nếu view không phân biệt được hai loại từ prop `error` hiện tại mà phải sửa `routes/auth.tsx`: dừng, báo Reviewer/Owner trước khi sửa.
2. `apps/web/src/views/hub/ProfilePage.tsx`: truyền `invalid={builderErrorItems(errors, tr).length > 0}` vào `HubLayout` (`BuilderForm` đã có tóm tắt); không trùng `autofocus` với khối huy hiệu của EPIC 26.
3. `apps/web/src/routes/me.tsx` `threadPage`: `invalid={threadErrorItems({ summary, viewer: "client", ...extra }, tr).length > 0}` trên `<Layout>`; trong `test/me/inquiries.test.ts` thay đoạn kiểm tay bằng `expectErrorSummary(html, ["th-body"])` (bỏ ghi chú “T6”).
4. Vitest: login (400 email sai: `expectErrorSummary(html, ["email"])`; 429: `formLevel: 1`; GET sạch), profile 400 (`expectErrorSummary` với id field, tiền tố title), một lượt VI cho login.
5. E2E: `e2e/tests/login.spec.ts:26` đổi `getByRole("alert")` sang title `Error:`, `#form-errors` có focus, liên kết `#email` đưa focus vào ô; có thể chuyển `expectErrorPattern` từ `form-errors.spec.ts` sang `e2e/support/` và thêm login vào `form-errors.spec.ts`. Kiểm ngân sách POST `/login` (bảng trong `e2e/README.md`, Reviewer cập nhật).
6. Kiểm lại: `grep -rn 'role="alert"' apps/web/src --include=*.tsx` (trừ admin/ops) không còn kết quả; `npm run typecheck -w apps/web`; `npm test -w apps/web -- --maxWorkers=2`; `npm run e2e` hai lần; `npm run e2e:typecheck`; `npm run test:scripts`.
7. Reviewer: re-review T6, cập nhật `e2e/README.md` (số test, mục login), backlog VNX-0807 → ✅, `CURRENT-STATUS.md`.

**Ghi vào `CURRENT-STATUS.md` (Reviewer/Orchestrator):** form `/admin/*`, `/ops/*` ngoài phạm vi (mẫu cũ); `form.error.*` zh do AI dịch vào danh sách người bản xứ đọc (VNX-0801, kèm F7); `autofocus` trên `tabindex=-1` chỉ kiểm ở Chromium (WebKit cũ có thể bỏ qua; vẫn còn tiền tố title và khối ở đầu); lượt `nojs` cho chế độ thẻ product khi seed E2E có >= 3 product công khai (F9); E2E cho form hub/thread/invitations hiện chỉ có Vitest; F6 chờ Owner xác nhận số VNX-0808.

## Re-review (vòng sửa 1, `0bfb515..dd73e0d`)

- **Ngày:** 2026-10-10. **Đã đọc:** toàn bộ diff `0bfb515..dd73e0d` (9 tệp) và mục "Vòng sửa 1" của báo cáo.
- **Lệnh đã chạy lại trên `dd73e0d`:** `npm run e2e`: 59 passed (1,4 phút), không retry, có 2 test waitlist mới (EN, VI) xanh; sau khi chạy không còn listener 8799/9329, không còn `workerd`. `npm run test:scripts`: 52/52. `npm run e2e:typecheck`: sạch. (Implementer báo typecheck 0 lỗi, Vitest 165/1919, e2e 59 hai lần; Reviewer không chạy lại Vitest vì vòng sửa chỉ đổi 2 dòng src có test đi kèm, và lượt E2E đã phủ cả hai.)

| # | Kết quả | Bằng chứng |
|---|---|---|
| F1 | Đóng | `LandingPage.tsx`: action `localizedPath(locale, "/waitlist")`, không fragment. E2E `form-errors.spec.ts` "landing waitlist: bad email" (EN + VI): 400, `page.url()` không có hash, title `Error:`/`Lỗi:`, `#form-errors` có focus, liên kết đưa focus vào `#waitlist-email`, giá trị giữ nguyên, không `role="alert"`. Luồng thành công không đổi: `routes/landing.tsx:63` vẫn redirect 303 tới `<locale>/?joined=1#notify` (Vitest `test/landing/waitlist.test.ts:37,50-52,192` khóa header `location`); redirect spam cũng vậy. Test `test/landing/page.test.ts` cập nhật đúng hai chỗ. |
| F4 | Đóng | `routes/contact.tsx:92`: 503 khi không có site key không truyền `formError`, giống route request; test đòi câu `contact.form.unavailable` xuất hiện đúng một lần. Hệ quả chấp nhận được: trang 503 đó không có tiền tố title/tóm tắt (không có form để sửa, chỉ còn thông báo kèm liên kết đăng nhập/email), như request. Khi có site key mà Turnstile không phản hồi, mục tóm tắt vẫn có. |
| F5 | Đóng | `hasFormErrors` và dòng test của nó đã xóa; không còn tham chiếu. |
| F8 | Đóng | `e2e/support/a11y.ts`: một định nghĩa `__unfinished` cài vào trang, dùng cho cả chờ và thông báo lỗi; lượt "with motion" xanh. |
| F2 | Chuyển T6 | Không đổi (như kế hoạch). |
| F3 | Đóng | Chỉ là mô tả, đã ghi nhận. |
| F6, F7 | Chờ Owner | Không đổi. |
| F9 | Nghĩa vụ | Không đổi. |

Không có phát hiện mới. Phạm vi vòng sửa đúng bốn mục đã duyệt, không cải tiến lân cận, không đụng tệp EPIC 26.

**Verdict cuối cho T1–T5: APPROVE.** AC8 nay đạt cho mọi form nhóm A trừ phần tiền tố title của `/me` thread và `/hub/profile` (F2, T6). T1–T5 có thể merge vào `main` theo OQ-5; T6 làm trên nhánh riêng sau khi EPIC 26 merge, theo checklist ở mục "Nghĩa vụ để lại cho task sau".

Reviewer cập nhật `e2e/README.md` (59 test, waitlist trong `form-errors.spec.ts`, ngân sách POST `/waitlist`).

**Mục cần ghi vào `CURRENT-STATUS.md`:**

- VNX-0807 T1–T5: APPROVE (review này), nhánh `feat/vnx-0807-a11y`, SHA đầu nhánh lúc merge; T6 mở, chờ EPIC 26 merge.
- Quyết định phát sinh: hai route sửa ngoài plan (`hub-products.tsx`, `hub-inquiries.tsx`) để báo `invalid`; khối tóm tắt đặt ngay trước `<form>` ở Inquiry/Request/Contact/Waitlist/Invitations; form waitlist không còn fragment `#notify` ở `action` (fragment làm trình duyệt bỏ `autofocus`; quy tắc chung: form dùng mẫu lỗi không đặt fragment ở `action`); contact 503 không có site key không hiện `formError`.
- Nghĩa vụ T6: login, hồ sơ hub, tiền tố title của `/me` thread, E2E login (checklist trong review).
- Chờ Owner: F6 (ID: task HUMAN "mời ~100 builder" chuyển VNX-0807 → VNX-0808), F7 (dấu cách sau `：` ở tiền tố zh).
- Ghi nhận: form `/admin/*`, `/ops/*` vẫn mẫu lỗi cũ (ngoài phạm vi); `form.error.*` zh do AI dịch vào danh sách người bản xứ đọc (VNX-0801); `autofocus` trên `tabindex=-1` chỉ kiểm ở Chromium; lượt `nojs` cho chế độ thẻ product khi seed E2E có >= 3 product công khai (F9); form hub/thread/invitations mới chỉ có Vitest cho mẫu lỗi; AC14 (CI xanh) sau khi Owner cho push.
