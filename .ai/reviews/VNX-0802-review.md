# VNX-0802 — Review

- **Reviewer:** Claude (subagent review độc lập, Opus), 2026-10-10
- **Ngày:** 2026-10-10
- **Đã đọc:** `CLAUDE.md`; plan `.ai/plans/VNX-0802-plan.md` (APPROVED, AC1–AC14, OQ-1..5); báo cáo `.ai/tasks/VNX-0802-report.md`; toàn bộ diff `origin/main...HEAD` (`ffcc1a0..1ac0f02`: `e2e/**`, `scripts/test/e2e-*.test.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/web-ci.yml`); mã app mà các spec chạm tới: `public/assets/home.js`, `routes/inquiry-form.tsx`, `routes/auth.tsx` (rate limit, `/auth/verify`), `db/products.ts` (`createProductDraft`), `views/InquiryFormPage.tsx`, `views/hub/ProductStepForm.tsx`, `apps/web/wrangler.jsonc`; `.github/workflows/security-ci.yml`.
- **Không có handoff** `.ai/tasks/VNX-0802-handoff.md` (xem F4).
- **Lệnh đã chạy lại** (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-0802`, cây `1ac0f02`):
  - `npm run e2e`: **49 passed (56.9 s)**, không retry, không flaky; tổng thời gian lệnh 58 s. Trước khi chạy: không có listener ở 8799/9329/8811/9411, 114 socket `Bound` (máy khỏe).
  - `E2E_PORT=8811 E2E_INSPECTOR_PORT=9411 npm run e2e -- tests/meta.spec.ts`: 4 passed. Sau cả hai lần chạy: không listener nào ở 8799/9329/8811/9411, không còn `workerd.exe` (cây tiến trình được dừng sạch).
  - `BASE_URL=https://vnx.si npm run e2e -- tests/meta.spec.ts`: bị từ chối ngay khi nạp cấu hình (`loadConfig` ném lỗi), không request nào.
  - `npm run e2e:typecheck`: exit 0. `npm run typecheck -w apps/web`: exit 0.
  - `npm run test:scripts`: `# tests 51  # pass 51  # fail 0`.
  - `npm test -w apps/web -- --maxWorkers=2`: **164 file / 1913 test pass**, exit 0, 305 s, ngay lần chạy đầu. Lỗi một test ở lần chạy đầu của Implementer **không tái hiện** (máy lúc đó đang thiếu socket, xem báo cáo; `apps/` không đổi nên không thể do task này).
  - `git diff --stat origin/main -- apps/ scripts/smoke.mjs scripts/smoke-checks.mjs`: rỗng.
  - `git check-ignore e2e/.state playwright-report test-results`: in cả ba.
  - `npm ls @playwright/test @axe-core/playwright --depth=0`: `1.64.0`, `4.13.0`; `git diff origin/main -- package.json` không có `^`/`~`.
  - `grep -rnE "waitForTimeout|https://vnx\.si|RESEND_API_KEY=[^ \"]|TURNSTILE_SECRET" e2e`: không dòng nào (exit 1), kể cả sau khi thêm `e2e/README.md`.
  - `git ls-files --eol .github/workflows/web-ci.yml`: index `lf` (cảnh báo CRLF khi commit chỉ là bản làm việc trên Windows, không ảnh hưởng runner).

## Verdict

**APPROVE WITH CHANGES** (APPROVE_AFTER_FIXES). Không có BLOCKER hay HIGH. Không có cửa sau trong app, không có đường nào tới production, 49 test xanh ổn định, axe thật sự quét, bộ nghe CSP/console gắn ở mọi trang của mọi spec (trừ `meta`, có chủ ý), seed tất định và kiểm trên SQL thật. Một MEDIUM (F1: count-up và "reduced-motion không qua 0" chưa thật sự chứng minh hành vi mà test mang tên) nên sửa trước merge; F2 (test không an toàn khi retry) nên sửa cùng vòng. Các mục còn lại là quy trình, gợi ý, hoặc việc app để Owner quyết.

## Đã kiểm, đúng

- **Không cửa sau trong production.** `apps/` không đổi một byte. Đăng nhập trong E2E dựa vào dòng `sessions`/`login_tokens` gieo thẳng vào D1 cục bộ `e2e/.state` (chỉ lưu sha256, test node kiểm), đúng mục 4 của plan; bước xác minh vẫn đi qua `GET` rồi `POST /auth/verify` do Chromium gửi với `Origin` thật. Token thô trong `seed/fixtures.mjs` vô nghĩa với D1 production (không có hash khớp). Không route, cờ hay biến mới trong app.
- **Không chạm production.** `resolveTarget` chỉ nhận `localhost`/`127.0.0.1` đúng cổng E2E (19 test node, có `vnx.si`, `www`, `workers.dev`, `localhost.evil.com`, `[::1]`, `0.0.0.0`, IP LAN); cấu hình gọi nó khi nạp, nên `BASE_URL` lạ chết trước khi có request. Lớp thứ hai: fixture `context` chặn mọi request ngoài `localhost`/`127.0.0.1` trong mọi spec trừ `meta` (spec đó chỉ đi đường tương đối). `serve.mjs` luôn truyền `--local` cho D1, không bao giờ truyền `--remote` (test node đếm đúng 2 lần xuất hiện, đều trong câu từ chối), `wrangler dev` mặc định mô phỏng D1/R2 cục bộ.
- **`--var` không rò ra cấu hình production.** Các giá trị (`MAIL_DRIVER=fake`, `TURNSTILE_DRIVER=fake`, `RESEND_API_KEY` rỗng, `ANALYTICS_SALT` rỗng, `PRIVACY_NOTICE_GO_LIVE` rỗng, `ADMIN_EMAILS`, `APP_ORIGIN`) chỉ là đối số của tiến trình `wrangler dev` cục bộ; `wrangler.jsonc` không đổi, không có `deploy`/`secret`. `wrangler-guard.test.ts` vẫn bảo vệ bản thật. Phép thử `.dev.vars` (thứ tự ưu tiên `--var` > `.dev.vars`) được ghi trong báo cáo; bỏ hàng rào fail-closed là hợp lý vì đã chứng minh. Thêm `ANALYTICS_SALT=""` là chặt hơn plan, đúng hướng.
- **Test có thật.** `meta.spec`: axe trả `image-alt` trên trang tự dựng và `color-contrast` trên `/privacy` thật; `watchCsp` bắt script inline bị CSP chặn (và script không chạy) cùng `console.error`; cơ chế `KNOWN_A11Y` vừa che vừa làm đỏ mục thừa. `settle()` đòi `app.css` đã nạp, nên không có "xanh" hay "đỏ" giả trên trang trần. Dải Live: kiểm `animation-play-state` tính toán khi rê chuột, bỏ chuột, bấm nút (kèm `aria-pressed`, `is-paused`), `animation-name: none` khi focus và link nằm trong khung nhìn, bản sao `inert` + `tabindex=-1`. Tooltip: text bằng `data-tip`, `aria-hidden`, `Escape` đặt `hidden`. Reduced-motion: không có track, nút ẩn, `.chart-bar`/`.chart-line` `animation-name: none`. Tắt JS: khối còn, Live là `ul` dọc, không tooltip, bảng dữ liệu chart có. Header bảo mật. Inquiry: 400 kèm `aria-invalid`, `aria-describedby`, `role="alert"`, giữ dữ liệu; thiếu Turnstile; thành công có `Origin` thật. Login: `Cache-Control`, `Referrer-Policy: same-origin`, GET không tiêu token, cookie `HttpOnly`/`Secure`/`SameSite=Lax`, phát lại 400, `next` cục bộ/ngoài, hết hạn, đăng xuất, 303 `/login?next=`. Editor: tạo draft, đi qua 9 bước (8 bước có form, `license` chỉ có thông báo) tới khi chỉ còn thiếu ảnh, 400/409 theo field, 404 cho product của builder khác. Không có `waitForTimeout`; chờ bằng assertion web-first và `expect.poll`.
- **Bộ nghe CSP/console gắn ở mọi trang.** Fixture `csp` là `auto`, phụ thuộc `page`, và cuối mỗi test khẳng định không vi phạm CSP, không `console.error`, không `pageerror`. Ngoại lệ hẹp và có lý do: log của script Turnstile bị chặn có chủ ý (đúng host `challenges.cloudflare.com`) và dòng "Failed to load resource" của **chính tài liệu** test cố tình yêu cầu ra 4xx; sub-resource lỗi vẫn làm đỏ. `builderPage` dùng cùng `page`. Không spec nào mở trang qua `context.newPage()`.
- **Seed tất định** (cùng `now` cùng SQL), chỉ ghi bảng gốc, không ghi `public_stats`; cron hourly thật chạy qua `/__scheduled` (OQ-2 không cần dự phòng). Test node áp toàn bộ migration lên SQLite trong bộ nhớ với khóa ngoại bật và kiểm từng ngưỡng bằng SQL chép từ `db/public-stats.ts`. Không có dữ liệu tiền ảnh hưởng xếp hạng (ADR-004): một tier giá duy nhất, không công thức nào đọc.
- **Ngân sách rate limit.** Đối chiếu mã: inquiry chỉ đếm form hợp lệ (`inquiry-form.tsx:105`, sau `parseInquiryForm`), nên bộ test dùng 2/10 theo IP và 1/5 theo email (email đếm sau Turnstile); `/login` chỉ đếm email hợp lệ: 1/5 theo email, 1/20 theo IP; `POST /auth/verify` không có hạn mức (4 lần). Với `retries: 1` của CI, trường hợp xấu nhất vẫn dưới hạn mức. DB xóa mỗi lần chạy. Báo cáo ghi "inquiry 3 of 10", thực tế 2 lần đếm (form rỗng không đếm): sai lệch nhỏ theo hướng an toàn.
- **Phụ thuộc.** Hai gói ghim chính xác; lock thêm đúng 5 gói (`@playwright/test`, `playwright`, `playwright-core` 1.64.0, `@axe-core/playwright`, `axe-core` 4.13.0), không đổi gói có sẵn; `playwright` 1.64 không còn `fsevents` tùy chọn nên lock không thiếu nhánh nền tảng. Chỉ Chromium (OQ-4). `e2e/` không phải workspace; `npm test` gốc không thấy nó.
- **CI (đọc, chưa chạy được):** job `e2e` song song `test`, cùng trigger và `permissions: contents: read`; khóa cache `pw-${{ runner.os }}-<phiên bản Playwright>` đúng đường `~/.cache/ms-playwright`; cache trúng thì vẫn `install-deps` thư viện hệ thống; không secret, không token Cloudflare; `CI=true` cho `retries: 1` và `forbidOnly`; `timeout-minutes: 15` > `globalTimeout` 8 phút > `webServer.timeout` 2 phút; tải `playwright-report` + `test-results` khi lỗi. `serve.mjs` truyền `CI=1` và `WRANGLER_SEND_METRICS=false` cho wrangler (không hỏi tương tác khi `migrations apply`). Trên Linux dừng bằng `SIGTERM` (Playwright giết cả nhóm tiến trình). Phần diff của `web-ci.yml` chỉ thêm job này.
- **Cổng:** mặc định 8799/9329, cấu hình được, kiểm khoảng 1024–65535 và hai cổng khác nhau; `reuseExistingServer: false`.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai sửa |
|---|---|---|---|---|---|
| F1 | MEDIUM | `e2e/tests/home.spec.ts:24-36`, `:112-121` | Server in sẵn số cuối trong `[data-count]` (test tắt JS chứng minh), còn `home.js` chỉ đặt lại về 0 và chạy khi `IntersectionObserver` báo phần tử vào khung. Vì vậy `toHaveText(formatEn(target))` có thể khớp ngay với chữ của server **trước** khi animation bắt đầu. Test "count-up ends on the printed value" vẫn xanh khi count-up không chạy, hoặc khi nó dừng ở số sai mà lần poll đầu rơi vào trước animation (phần tử dưới màn hình: `scrollToCenter` rồi kiểm ngay, IO chưa kịp gọi). Tương tự, test reduced-motion không chứng minh "không đi qua 0" (plan mục 5, home 6): nếu JS bỏ qua `reduce` và đếm từ 0, lần kiểm đầu vẫn có thể thấy chữ của server. Đây đúng là mục Owner đã kiểm tay ở Task 8b. | Ghi lịch sử chữ của mọi `[data-count]` bằng `page.addInitScript` + `MutationObserver` (characterData/childList) trước `goto`. Count-up: sau khi cuộn tới từng ô, `expect.poll` tới khi lịch sử có ít nhất một giá trị khác số cuối (animation đã chạy) **và** giá trị cuối cùng bằng `formatEn(target)`. Reduced-motion: mọi giá trị trong lịch sử bằng `formatEn(target)` (không có `0` hay số giữa). Không cần chờ theo thời gian. | Implementer |
| F2 | LOW | `e2e/tests/editor.spec.ts:15-22`; `e2e/tests/login.spec.ts:36-96` | Test tiêu tài nguyên dùng một lần không chạy lại được. Ở CI (`retries: 1`) hoặc với `E2E_RETRIES`: (a) "create a draft" tạo slug `e2e-created-product`; lần retry `createProductDraft` gắn hậu tố ngẫu nhiên (`db/products.ts:86-95`), nên `toHaveValue("e2e-created-product")` chắc chắn đỏ; (b) các test login đã tiêu `OK_1`/`OK_2`/`OK_NEXT`/`OK_NEXT_EVIL` trước điểm lỗi thì lần retry nhận 400. Retry khi đó không cứu được lỗi tạm thời mà còn báo một lỗi khác lỗi gốc. Plan chỉ đòi "mỗi test dùng token/product riêng" (đạt), nhưng chính sách retry của plan giả định retry có nghĩa. | Editor: tên theo lần chạy, ví dụ `` `E2E Created Product ${test.info().retry}` `` (slug tương ứng). Login: gieo token theo lần chạy (ví dụ `OK_1`, `OK_1_R1`, chọn bằng `test.info().retry`), hoặc đặt `test.describe.configure({ retries: 0 })` cho file login kèm chú thích lý do. Cập nhật `e2e/README.md` nếu chọn cách thứ hai (Reviewer). | Implementer (+ Reviewer-writer nếu đổi README) |
| F3 | LOW (quy trình) | báo cáo, "Rule slips" | Implementer chạy `git checkout -- package.json` một lần để bỏ việc `npm install` định dạng lại tệp. Luật Implementer cấm lệnh kiểu checkout/reset làm mất thay đổi. Tác động thực tế bằng 0: worktree riêng, tệp chưa commit và chỉ chứa thay đổi của chính Implementer, đã tự khai. Mức LOW vì đây là đúng loại lệnh từng làm mất việc của phiên khác trên checkout dùng chung. | Không sửa mã. Ghi vào "Ghi nhận" của `CURRENT-STATUS.md`. Handoff sau ghi rõ: muốn hoàn tác định dạng thì sửa lại bằng tay hoặc `npm pkg`, không `git checkout`/`restore`/`reset`. | Reviewer-writer |
| F4 | LOW (quy trình) | `.ai/tasks/` | Không có `VNX-0802-handoff.md`, trong khi `CLAUDE.md` bước 4 và bảng phân vai của plan yêu cầu (lặp lại VNX-0805 F9). AC trong plan kiểm được bằng lệnh nên không ảnh hưởng chất lượng. | Lưu prompt giao việc thành handoff, hoặc ghi vào "Ghi nhận". | Reviewer-writer |
| F5 | SUGGESTION | `e2e/scripts/serve.mjs:17` | Kiểm `--remote` trên `Object.keys(process.env)` không có tác dụng (tên biến môi trường không chứa `--remote`); chỉ phần `argv` có nghĩa. Vô hại nhưng gây hiểu nhầm là env được kiểm. | Chỉ kiểm `process.argv`, hoặc nếu muốn kiểm env thì kiểm giá trị (`Object.values`). Giữ test đếm 2 lần xuất hiện. | Implementer |
| F6 | SUGGESTION | `scripts/test/e2e-seed.test.mjs:13` | Bảng `MIN` chép tay từ `apps/web/src/domain/public-stats.ts`. Ngưỡng ở app tăng thì test node vẫn xanh; chỉ `global-setup` báo lỗi lúc chạy E2E. | Đọc `MIN` từ mã nguồn TS bằng regex trên đối tượng `MIN`, hoặc thêm một test so từng khóa với tệp nguồn. README đã ghi cảnh báo. | Implementer |
| F7 | SUGGESTION | `e2e/tests/home.spec.ts:131-145` | Với `javaScriptEnabled: false`, init script của `watchCsp` không chạy, nên test tắt JS không nghe `securitypolicyviolation` (vẫn nghe console). Rủi ro thấp: không có script để vi phạm. | Ghi một dòng chú thích trong spec; không cần đổi logic. | Implementer |
| F8 | LOW (app, ngoài phạm vi) | `apps/web/src/views/InquiryFormPage.tsx:36-56` | Form Inquiry trả 400 bằng một lần tải trang đầy đủ. Lỗi theo field có `role="alert"`, `aria-describedby`, `aria-invalid`, nên WCAG 3.3.1 (A) đạt. Nhưng `role="alert"` có sẵn khi trang vừa tải không được trình đọc màn hình đọc chắc chắn (live region chỉ báo thay đổi), không có tóm tắt lỗi, `<title>` không đổi, focus không chuyển. Người dùng trình đọc màn hình có thể không biết form bị từ chối. Cùng mẫu đó có ở mọi form render phía server (login, các bước product, contact): khối tóm tắt `role="alert"` cũng chỉ có mặt lúc tải. axe không bắt được loại này. | Không sửa trong VNX-0802 (OQ-1). Đề xuất task theo dõi (xem "Nghĩa vụ để lại"). | Owner quyết, task mới |
| F9 | — (không phải lỗi) | `apps/web/src/views/hub/ProductStepForm.tsx:113-128` | Lỗi theo field của bước product là `<p class="error-msg">` không `role`, nhưng gắn vào input qua `aria-describedby` cùng `aria-invalid`, và khối tóm tắt `role="alert"` ở đầu form. Đây là mẫu đúng (tránh nhiều alert đọc chồng). | Chấp nhận, không tạo task. Phần "đọc khi tải trang" thuộc F8. | — |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `git diff --stat origin/main -- apps/ scripts/smoke.mjs scripts/smoke-checks.mjs` rỗng |
| AC2 | ✓ | `npm test -w apps/web -- --maxWorkers=2`: 164 file / 1913 test pass, exit 0 (lần chạy đầu của Reviewer); `apps/` không đổi |
| AC3 | ✓ | `npm run e2e`: 49 passed (56.9 s), không retry. DB dựng mới, cron thật chạy, đủ spec P1 |
| AC4 | ✓ | `npm run e2e:typecheck` exit 0 |
| AC5 | ✓ | `E2E_PORT=8811 E2E_INSPECTOR_PORT=9411 npm run e2e -- tests/meta.spec.ts`: 4 passed; mặc định 8799/9329; không cổng nào còn bị giữ sau khi chạy |
| AC6 | ✓ | `e2e-targets.test.mjs` (19 test) xanh; `BASE_URL=https://vnx.si` bị từ chối khi nạp cấu hình |
| AC7 | ✓ | `e2e-seed.test.mjs` (12 test) xanh: tất định, khóa ngoại trên migration thật, mọi ngưỡng `MIN`, chỉ hash |
| AC8 | ✓ | `git check-ignore` in `e2e/.state`, `playwright-report`, `test-results` |
| AC9 | ✓ | `1.64.0` / `4.13.0` chính xác; lock thêm đúng 5 gói, không đổi gói có sẵn |
| AC10 | ✓ (một phần, xem F1) | `meta.spec` 4 passed: axe `image-alt` + `color-contrast`, CSP inline + `console.error`, cơ chế deferral. Riêng count-up/reduced-motion ở `home.spec` chưa "không thể xanh rỗng" (F1) |
| AC11 | ✓ | 22 test axe (12 `en` công khai, 3 đã đăng nhập, 4 `vi`, 2 ở 360 px, 1 có chuyển động) xanh; `KNOWN_A11Y` rỗng; rule `target-size` hoạt động (báo cáo, và `settle` chặn trang trần) |
| AC12 | ✓ | grep AC12 trên `e2e/` không dòng nào; test node cùng luật xanh |
| AC13 | chưa kiểm được | Cần Owner cho push. Đọc thấy đúng cấu trúc; rủi ro còn lại ở "Nghĩa vụ để lại" |
| AC14 | ✓ | `npm run test:scripts`: 51/51 (20 test cũ không đổi) |

## Tài liệu Reviewer viết trong task này

- `e2e/README.md`: cách chạy trên Git Bash và PowerShell, biến `E2E_PORT`/`E2E_INSPECTOR_PORT`/`E2E_RETRIES`/`E2E_CHANNEL`/`BASE_URL`, phạm vi đang kiểm, đăng nhập không cửa sau, cách viết spec và ngân sách POST, đọc kết quả, sự cố socket `Bound` của `workerd` cũ, CI. README cố ý không viết nguyên tên hàm chờ cố định để lệnh grep AC12 vẫn sạch.
- `docs/runbooks/deploy.md` mục 2 bước 3: thêm dòng `npm run e2e` trước deploy (OQ-5).

## Nghĩa vụ để lại cho task sau

- **Vòng khắc phục (cần Owner duyệt):** F1 (MEDIUM), F2 (LOW), tùy chọn F5–F7. Sau khi sửa: chạy lại `npm run e2e` hai lần liên tiếp và `npm run e2e:typecheck`, `npm run test:scripts`.
- **AC13:** sau khi Owner cho push, xem job `e2e` của `web-ci` xanh, ghi thời gian job (mục tiêu ≤ 6 phút) và kết quả `dependency-review`/`gitleaks` của PR. Điểm có thể khác trên runner Linux: `wrangler dev` không đăng nhập (đã chạy được trên Windows không token); `localhost` trên runner có thể phân giải `::1` trước (Node 22 và Chromium thử cả hai họ địa chỉ, rủi ro thấp); `node:sqlite` của `test:scripts` cần Node ≥ 22.13 (`setup-node` 22 lấy bản mới nhất).
- **Task a11y theo dõi cho Owner (F8), đề xuất làm trước ra mắt M8:** một mẫu lỗi form thống nhất cho mọi form render phía server (Inquiry, login, request, contact, các bước product, hồ sơ builder): (1) `<title>` có tiền tố "Lỗi:"/"Error:" khi trả 4xx; (2) khối tóm tắt lỗi ở đầu form, liệt kê từng lỗi kèm liên kết tới field; (3) chuyển focus không cần JS bằng `autofocus` lên khối tóm tắt (`tabindex="-1"`) hoặc field lỗi đầu tiên; (4) thêm test E2E cho focus và tóm tắt. Không phải vi phạm WCAG 2.2 AA theo axe, nên Owner có thể dời sau ra mắt.
- **P2 của plan** vẫn mở: upload ảnh R2, gửi duyệt/xuất bản, inquiry khi đã đăng nhập, request board, tool, admin/ops, zh-Hans/zh-Hant, chế độ tối, trang 4xx, Firefox/WebKit, cảm ứng.
- **`CURRENT-STATUS.md`:** cập nhật khi có verdict cuối, kèm "Ghi nhận" F3 và F4, và ghi rằng báo cáo nói wrangler 4.147.0 (lock) chứ không phải 4.149.0 như plan.

## Re-review (vòng sửa 1, `4bc99de`)

- **Ngày:** 2026-10-10. **Đã đọc:** diff `58e2948..4bc99de` (`serve.mjs`, `seed/fixtures.mjs`, `editor.spec.ts`, `home.spec.ts`, `login.spec.ts`, `e2e-seed.test.mjs`, mục "Vòng sửa 1" của báo cáo); thêm `public/assets/landing.js`, `views/landing/Deck.tsx` và CSS `.deck-card` để chẩn đoán lần đỏ mà Implementer gặp.
- **Lệnh đã chạy lại:**
  - `npm run e2e` **hai lần liên tiếp**: **49 passed (1.1 m)** và **49 passed (1.1 m)**, không retry. Trước khi chạy: 103 socket `Bound` (máy khỏe), cổng 8799/9329 trống.
  - `npm run test:scripts`: `# tests 52  # pass 52  # fail 0`. `npm run e2e:typecheck`: exit 0.
  - `git diff --stat origin/main -- apps/`: rỗng.
  - `git reflog`: từ khi tạo worktree chỉ có các commit của task. Mục `reset: moving to HEAD` lúc 13:07:45 là do `git worktree add`, trước commit plan. Không thấy checkout hay reset trong vòng sửa. Báo cáo khai không dùng `checkout`/`restore`/`reset`; `restore` một file không để lại dấu trong reflog, nên bằng chứng ở đây là lời khai cộng với cây làm việc sạch.
  - **Thí nghiệm của Reviewer** (script tạm ngoài repo, server riêng `E2E_PORT=8821`, dừng cả cây tiến trình sau đó): chạy axe trên `/` khi chặn `landing.js` hoặc `home.js` bằng `route.abort`, với `reducedMotion` là `no-preference` và `reduce`, quét lúc vừa tải và sau khi transition xong.

    | Trạng thái | Lúc tải | Sau transition |
    |---|---|---|
    | bình thường, có chuyển động | `color-contrast` (8 node: nút hero, thẻ deck đang fade) | sạch |
    | bình thường, `reduce` | sạch | sạch |
    | **chặn `landing.js`**, có chuyển động | `color-contrast` (như trên) + **`target-size` `.btn-sm.btn-primary[href$="market-product-03"]`** | **`target-size`** (cùng node) |
    | **chặn `landing.js`**, `reduce` | **`target-size`** (cùng node) | **`target-size`** (cùng node) |
    | chặn `home.js` | như bình thường | sạch |

### Đánh giá các bản sửa

| # | Kết quả | Ghi chú |
|---|---|---|
| F1 | ✓ Đóng | `recordCounts` (init script + `MutationObserver`, gắn trước script đầu tiên) ghi lịch sử chữ của từng `[data-count]`. Test count-up đòi có một giá trị khác số cuối **và** giá trị cuối đúng bằng `formatEn(data-count)`. Test reduced-motion cuộn tới từng ô (lúc `IntersectionObserver` sẽ chạy nếu JS bỏ qua `reduce`) rồi đòi lịch sử đúng bằng `[final]`. Cả hai giờ đỏ nếu animation không chạy, dừng ở số sai, hoặc đi qua 0 khi `reduce`. Xem R3 (gợi ý nhỏ). |
| F2 | ✓ Đóng (theo đọc mã) | Mỗi token dùng một lần có 3 bản; `tokenFor(key, retry)` ném lỗi rõ khi vượt số lần thử. Editor đặt tên và slug theo `test.info().retry`. Chưa có retry thật để kích, nhưng test seed khẳng định mọi token khác nhau và đều được gieo. Ngân sách rate limit vẫn dư với 3 lần thử. README đã sửa theo (R4). |
| F5 | ✓ Đóng | Chỉ kiểm `process.argv`; test node vẫn đếm đúng 2 lần `--remote`. |
| F6 | ✓ Đóng | `MIN` đọc từ `public-stats.ts` bằng regex, kèm test "mọi ngưỡng là số nguyên dương", nên regex hỏng thì test đỏ chứ không im lặng. |
| F7 | ✓ Đóng | Có chú thích trong khối "JavaScript off". |

### Lần đỏ Implementer gặp (1 trong 4 lần chạy): lỗi máy hay lỗi thật?

**Nguyên nhân kích hoạt là lỗi máy, nhưng vi phạm axe là thật.** `net::ERR_NO_BUFFER_SPACE` là cạn bộ đệm socket cục bộ, cùng sự cố đã ghi trong báo cáo. Hai lần chạy liên tiếp của Reviewer trên máy khỏe đều xanh, nên đây không phải flake của test hay của bản sửa.

Tuy vậy, `target-size` mà axe báo khi `landing.js` không nạp **không phải vi phạm giả**. Thí nghiệm trên cho thấy nó lặp lại tất định mỗi khi `landing.js` không chạy (JavaScript tắt, script bị chặn, mạng lỗi), ở cả hai chế độ chuyển động. Lý do: `Deck.tsx` render sẵn ba thẻ chồng nhau theo `data-slot`, nhưng chỉ `landing.js` mới đặt `inert` + `aria-hidden` cho các thẻ phía sau. Thiếu script thì nút "xem product" của thẻ sau vẫn là một đích bấm, bị thẻ trước che gần hết, nên phần còn bấm được nhỏ hơn mức 24 px của WCAG 2.2 SC 2.5.8 (AA). Trang này được thiết kế để chạy cả khi không có JS (theo chú thích của `Deck.tsx` và `landing.js`), nên đây là lỗi của app ở một trạng thái được hỗ trợ.

### Phát hiện mới

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai sửa |
|---|---|---|---|---|---|
| R1 | MEDIUM (app, ngoài phạm vi) | `apps/web/src/views/landing/Deck.tsx:61,90`; `public/assets/landing.js:15-19` | Khi `landing.js` không chạy, homepage vi phạm WCAG 2.2 AA `target-size` (2.5.8) trên nút của thẻ deck phía sau (`.btn-sm.btn-primary[href$="market-product-03"]`). Lỗi tất định, đã tái hiện. Bộ E2E không bao giờ quét trạng thái này: mọi lượt quét đều có JS, và axe không chạy được trong context tắt JS. | Task sửa app do Owner duyệt. Ví dụ: render thẻ sau với `inert`/`aria-hidden` ngay từ server rồi để `landing.js` bật/tắt, hoặc chỉ xếp chồng khi có lớp do JS gắn. Không sửa trong VNX-0802 (OQ-1). | Owner quyết, task mới |
| R2 | LOW | `e2e/support/a11y.ts:11-17`; `e2e/tests/a11y.spec.ts` | `settle()` chỉ kiểm `app.css`. Khi một script cùng origin nạp lỗi, axe làm đỏ test trước, còn lỗi nạp chỉ hiện ở teardown của fixture CSP/console, nên khó phân biệt "máy lỗi" với "app lỗi". Ngoài ra trạng thái "không có `landing.js`" chưa được quét có chủ ý (R1). | (a) `settle()` ghi `requestfailed` của tài nguyên cùng origin và ném `E2E infrastructure: <url> failed (<errorText>)` trước khi quét. (b) Thêm một biến thể quét `/` với `route.abort` cho `/assets/landing.js` và `/assets/home.js` (giả lập không JS mà axe vẫn chạy được), kèm một mục `KNOWN_A11Y` trỏ tới mã phát hiện của R1 cho tới khi app được sửa. Làm cùng task R1. | Implementer (trong task R1) |
| R3 | SUGGESTION | `e2e/tests/home.spec.ts:56-62` | `moved` cũng đúng nếu lịch sử có một chuỗi rỗng, ghi lúc parser chèn phần tử trước phần text. Thực tế chưa xảy ra (lịch sử reduced-motion đúng bằng `[final]` ở mọi lần chạy), nhưng điều kiện có thể chặt hơn. | Đòi giá trị trung gian là một số (`/\d/`) khác số cuối. | Implementer, khi tiện |
| R4 | LOW (tài liệu, Reviewer đã sửa) | `e2e/README.md` | README khuyên `E2E_RETRIES=3`, nhưng seed chỉ có token cho 3 lần thử (retry 0..2), nên lần thử thứ 4 của test login sẽ ném lỗi. README cũng còn mô tả token và `MIN` theo bản cũ. | Đã sửa trong commit của re-review này: tối đa `E2E_RETRIES=2`, mô tả `tokenFor`/`ONE_USE`, `MIN` đọc từ nguồn, và ghi chú "script nạp lỗi thì axe có thể báo vi phạm thật của trạng thái không JS". | Reviewer-writer (xong) |
| R5 | SUGGESTION | `e2e/support/a11y.ts:11-17` | Khi có chuyển động, ngay lúc tải axe thấy `color-contrast` tạm thời (hero và deck đang fade). Lượt "en / with motion" hiện chờ count-up xong nên đã qua transition, nhưng đó là nhờ thời gian chứ không phải một điều kiện được kiểm. | Với biến thể `motion`, `settle()` chờ mọi animation hữu hạn (`document.getAnimations()`, bỏ qua animation lặp vô hạn) kết thúc rồi mới quét. | Implementer, khi tiện |

### Verdict cuối

**APPROVE.** Các bản sửa F1, F2, F5, F6, F7 đúng và đủ. Hai lần `npm run e2e` liên tiếp xanh 49/49 không retry; `test:scripts` 52/52; typecheck sạch; `apps/` không đổi. Lần đỏ Implementer gặp là do mạng của máy, không phải flake của bộ test. Tuy nhiên nó làm lộ một vi phạm **thật** của app (R1, MEDIUM), đúng loại việc OQ-1 để ngoài task này. Các mục còn mở không chặn merge VNX-0802:

- **Cho Owner:** duyệt một task a11y theo dõi gồm ba phần:
  - R1: deck homepage khi không có `landing.js`. MEDIUM, nên làm trước khi ra mắt M8 vì là vi phạm WCAG 2.2 AA thật.
  - F8: mẫu lỗi chung cho các form render phía server (tiêu đề, tóm tắt lỗi, focus).
  - R2: E2E báo rõ khi tài nguyên nạp lỗi, và quét trạng thái không có `landing.js` kèm một mục `KNOWN_A11Y`.
- **AC13** vẫn chờ push: xem job `e2e` của `web-ci`, thời gian job, `dependency-review` và `gitleaks`.
- R3 và R5 là gợi ý, làm khi tiện.
