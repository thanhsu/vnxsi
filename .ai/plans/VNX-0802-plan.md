# VNX-0802 — Playwright + axe: homepage, form Inquiry, editor, login · Plan

- **Trạng thái:** **APPROVED** (Opus duyệt thay Owner theo ủy quyền M6+, Owner cho làm VNX-0802 ngày 2026-10-10). Câu hỏi mở theo mặc định của plan: OQ-1 không sửa app trong task này, lỗi axe có sẵn vào `a11y-known.ts` + báo cáo, Reviewer triage và đưa Owner danh sách; OQ-2 dự phòng seed `public_stats` trực tiếp; OQ-3 dự phòng `--local-protocol https` + `ignoreHTTPSErrors`; OQ-4 chỉ Chromium; OQ-5 CI chạy ở mọi PR và push, runbook thêm dòng chạy `npm run e2e` trước deploy.
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M8, VNX-0802 (AGENT)
- **Spec / NFR:** `docs/blueprint/02-NFR.md` mục Khả năng tiếp cận: WCAG 2.2 AA cho mọi trang công khai và form; vùng chạm >= 44 px; tương phản >= 4,5:1; focus nhìn thấy; `prefers-reduced-motion`; "kiểm tự động bằng axe trong Playwright (VNX-0802)". Spec Wave 1 §8.11 (ngưỡng homepage), §9 (homepage với reduced-motion không animation).
- **ADR:** ADR-001 (một Worker, Hono + assets), ADR-004 (không vị trí trả tiền: seed không tạo dữ liệu tiền), ADR-012 (số liệu, bảng `public_stats`). Không cần ADR mới.
- **Phụ thuộc:** `origin/main` `ffcc1a0` (M7 đã deploy, VNX-0805 xong). Không phụ thuộc VNX-0801/0803/0804.
- **Implementer / Reviewer:** Implementer (subagent Sonnet, context mới) viết mọi thứ chạy được (cấu hình, test, seed, script, CI); Reviewer (Claude) viết `e2e/README.md` sau khi xong và review.

## Vì sao làm bây giờ

M7 đã lên production và Owner đã kiểm tay checklist Task 8b (chart, count-up, dải Live, tooltip, reduced-motion, tắt JS). Đó là thứ Vitest-trong-workerd không thể kiểm (không có trình duyệt, không có CSS animation, không có axe). M8 là ra mắt: cần một lưới tự động chạy được lại trước mỗi deploy cho bốn luồng người dùng thấy đầu tiên (homepage, form Inquiry, editor product, đăng nhập), cộng cổng WCAG 2.2 AA mà NFR đã hứa.

## Phạm vi

**Trong phạm vi**

1. Thư mục gốc `e2e/` (không phải workspace) với `playwright.config.ts`, các spec, seed D1 tất định, script dựng server, helper axe và CSP.
2. Hai devDependency ở `package.json` gốc: `@playwright/test`, `@axe-core/playwright`, ghim phiên bản chính xác; `package-lock.json` đổi tương ứng.
3. Script npm gốc: `e2e`, `e2e:headed`, `e2e:typecheck`, `e2e:install`.
4. Job `e2e` mới trong `.github/workflows/web-ci.yml` (song song với job `test`), có cache trình duyệt.
5. `.gitignore`: `e2e/.state/`, `playwright-report/`, `test-results/`.
6. Test thuần Node cho phần không cần trình duyệt: `scripts/test/e2e-targets.test.mjs` (chặn mục tiêu không phải localhost) và `scripts/test/e2e-seed.test.mjs` (seed tất định), chạy bởi `npm run test:scripts` đã có trong CI.
7. Báo cáo `.ai/tasks/VNX-0802-report.md` liệt kê mọi vi phạm axe tìm thấy (kể cả cái đã vào danh sách tạm hoãn).

**Ngoài phạm vi**

- **Mọi lần chạy trên production.** E2E không bao giờ nhắm `vnx.si`/`workers.dev`: đó là việc của `npm run smoke` (VNX-0805). Cấu hình từ chối `baseURL` không phải `localhost`/`127.0.0.1` (AC6).
- Sửa mã ứng dụng (`apps/web/src`, `public`), migration, `wrangler.jsonc`, `vitest.config.ts`. Lỗi a11y/CSP tìm thấy là **phát hiện**, ghi vào báo cáo; sửa là task khác do Owner duyệt (luật "không cải tiến lân cận").
- Lighthouse CI / LCP (NFR dòng 12, "M8" nhưng không thuộc tên task này); đa trình duyệt (Firefox, WebKit); visual regression; thử tải.
- Route admin/ops, request board, trang tool, product page `/p/:slug` (trừ quét axe), upload ảnh R2, luồng duyệt/xuất bản product, view counting (`ANALYTICS_SALT` để trống nên không đếm).
- Gửi mail thật, Turnstile thật, Cloudflare dashboard, bất kỳ lệnh `wrangler ... --remote`, `deploy`, `secret`.
- Nội dung email (đã có test Vitest; outbox giả nằm trong bộ nhớ isolate, E2E không đọc được).

## Phân vai (CLAUDE.md: thứ chạy được do Implementer viết, thứ chỉ mô tả do Reviewer viết)

| Sản phẩm | Ai viết |
|---|---|
| `e2e/**`, `scripts/test/e2e-*.test.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `web-ci.yml` | Implementer. Handoff `.ai/tasks/VNX-0802-handoff.md`, mỗi yêu cầu kiểm bằng một lệnh. |
| `e2e/README.md` (cách chạy trên Windows, đọc báo cáo, thêm spec), dòng trạng thái trong `CURRENT-STATUS.md`, handoff, review | Reviewer, sau khi Implementer xong (để trích đúng tên script). |

## Thiết kế

### 1. Vị trí và phụ thuộc

- **`e2e/` ở gốc, không thêm workspace.** Lý do: (a) `package.json` gốc có `"workspaces": ["apps/*","packages/*"]` và `npm test` = `--workspaces --if-present`; thêm devDependency ở gốc không tạo workspace mới, `npm test` không đổi, Vitest-trong-workerd (`apps/web/vitest.config.ts`, `include: test/**`) không thấy `e2e/`; (b) Playwright chạy trong Node, cần `node:fs`/`child_process`, không hợp cây workerd; (c) ghi nhớ: link workspace trỏ vào `apps/web`, thêm workspace mới làm thay đổi cấu trúc `node_modules` và tăng rủi ro như sự cố `rm -rf node_modules` đã xảy ra. Tuyệt đối không `rm -rf node_modules`; nếu cần cài lại dùng `npm ci` ở worktree sạch.
- **Gói và phiên bản** (npm registry kiểm 2026-10-10; Implementer kiểm lại bằng `npm view <pkg> version` và ghi vào báo cáo): `@playwright/test` `1.64.0` và `@axe-core/playwright` `4.13.0`, **chính xác, không `^`** (`npm install -D -E ...`). Kéo theo `playwright`, `playwright-core`, `axe-core` (phụ thuộc bắc cầu; `package-lock.json` thêm khoảng 5 gói, không đổi gói hiện có; AC9). `dependency-review` trong `security-ci` (moderate) sẽ chạy trên PR.
- **Trình duyệt: chỉ Chromium** (`projects: [{ name: "chromium" }]`). Cài bằng `npx playwright install chromium` (CI: thêm `--with-deps`). Chi phí: khoảng 160-180 MB trên đĩa (chromium + headless shell) tại `%LOCALAPPDATA%\ms-playwright` (máy dev hiện có `chromium-1234/1243` của phiên bản khác; 1.64 cần revision riêng, tải thêm một lần). `e2e:install` bọc lệnh này. Để khỏi tải khi đĩa chật: biến `E2E_CHANNEL=chrome` (hoặc `msedge`) dùng trình duyệt đã cài; mặc định để trống = Chromium đi kèm. Mọi hành vi cần kiểm (view-timeline, `inert`, `securitypolicyviolation`) có trong Chromium; Firefox/WebKit để sau (OQ-4).
- **TypeScript:** `e2e/tsconfig.json` riêng (strict, `module: esnext`, `types: ["node"]`), `npm run e2e:typecheck` = `tsc -p e2e/tsconfig.json --noEmit` dùng `typescript` đã hoist từ `apps/web`. Playwright tự biên dịch TS khi chạy.

Cấu trúc:

```
e2e/
  playwright.config.ts
  tsconfig.json
  lib/targets.mjs          # thuần: resolveTarget(env) -> {port, origin}, từ chối host lạ (test bằng node --test)
  lib/ports.mjs            # đọc E2E_PORT / E2E_INSPECTOR_PORT
  scripts/serve.mjs        # dựng DB + seed + chạy wrangler dev (webServer.command)
  seed/fixtures.mjs        # hằng số: email, handle, token thô, id
  seed/build-seed.mjs      # (now) -> chuỗi SQL, tất định theo `now`
  support/a11y.ts          # scanA11y(page, name)
  support/csp.ts           # watchCsp(page) -> {violations}
  support/auth.ts          # fixture builderPage (cookie phiên đã seed)
  support/turnstile.ts     # fillFakeTurnstile(page), chặn script Cloudflare
  global-setup.ts          # chạy cron cục bộ, chờ snapshot
  tests/{home,inquiry,editor,login,a11y,meta}.spec.ts
  .state/                  # git-ignored: D1 cục bộ riêng của E2E
```

### 2. Server dưới test: `wrangler dev` cục bộ, không đụng cấu hình production

Đã kiểm với wrangler 4.149.0 (`npx wrangler dev --help`): hỗ trợ `--port`, `--inspector-port`, `--persist-to <dir>`, `--var KEY:VALUE` (lặp được), `--test-scheduled`, `-c/--config`, `--ip`, `--local-protocol`. `wrangler d1 execute` và `d1 migrations apply` đều nhận `--local --persist-to`.

- **Cơ chế biến môi trường: cờ `--var` trên chính `apps/web/wrangler.jsonc`**, không tạo `wrangler.e2e.jsonc` (một bản sao cấu hình có `database_id` thật và `routes` custom domain sẽ lệch dần với bản thật; `test/config/wrangler-guard.test.ts` bảo vệ bản thật, không đụng). Không dùng `.dev.vars` (git-ignored, tùy máy, có thể chứa `RESEND_API_KEY` thật của dev). Implementer **phải kiểm bằng thực nghiệm** thứ tự ưu tiên: đặt tạm `RESEND_API_KEY=x` trong `apps/web/.dev.vars`, chạy server, xác nhận `--var RESEND_API_KEY:` thắng; nếu không thắng, `serve.mjs` từ chối chạy khi thấy `.dev.vars` có `RESEND_API_KEY` không rỗng (fail closed).
- Biến `--var` (mọi giá trị là chuỗi; wrangler dev không ghi gì lên Cloudflare):

| Biến | Giá trị | Lý do |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:<port>` | liên kết, canonical, sitemap đúng origin test (originCheck chấp nhận cả `APP_ORIGIN` lẫn origin request) |
| `MAIL_DRIVER` | `fake` | không gửi gì; điều kiện để `TURNSTILE_DRIVER=fake` có hiệu lực (`isFake` trong `http/turnstile.ts`) |
| `RESEND_API_KEY` | rỗng | khóa thật luôn thắng driver giả (VNX-0803 F6) |
| `TURNSTILE_DRIVER` | `fake` | site key `fake-site-key`, token hợp lệ là `test-pass` |
| `ADMIN_EMAILS` | `e2e-admin@example.test` | cố định, không dùng ở test must-have |
| `PRIVACY_NOTICE_GO_LIVE` | rỗng | cùng lý do `vitest.config.ts`: ngày go-live production không được đổi hành vi test |
| `ANALYTICS_SALT` | không đặt | không đếm view, không cookie visitor (mặc định của app) |

  Không đổi `TURNSTILE_SITE_KEY`/`SECRET`. Không có route hay cờ mới nào ở app, nên không có gì "chạm được ở production".
- **Cổng:** `E2E_PORT` (mặc định **8799**, tránh 8787 của `npm run dev` phiên khác) và `E2E_INSPECTOR_PORT` (mặc định **9329**; mặc định 9229 của wrangler cũng dễ đụng). `webServer.reuseExistingServer: false` luôn, để không bao giờ chạy test (có POST) vào server của phiên khác. Nếu cổng bận, Playwright báo lỗi rõ; không tự đổi cổng.
- **`e2e/scripts/serve.mjs`** (là `webServer.command`, Playwright chờ `url: <origin>/api/health` trả 200):
  1. Xóa `e2e/.state/` (mỗi lần chạy bắt đầu từ DB trống, nên `rate_limits` và token dùng một lần không dồn giữa các lần chạy).
  2. `wrangler d1 migrations apply vnxsi --local --persist-to ../e2e/.state` (cwd `apps/web`; 16 migration).
  3. Sinh seed bằng `build-seed.mjs`, ghi `e2e/.state/seed.sql`, chạy `wrangler d1 execute vnxsi --local --persist-to ../e2e/.state --file ...`. Chương trình từ chối mọi đối số chứa `--remote`.
  4. Spawn `wrangler dev --port --inspector-port --persist-to --test-scheduled --var ... --show-interactive-dev-session=false --log-level warn`, chuyển tiếp stdout/stderr; khi nhận SIGTERM/SIGINT (và trên Windows) kết thúc cả cây tiến trình bằng `taskkill /pid <pid> /T /F` (ghi chú `CURRENT-STATUS.md`: dừng tiến trình cha không giết `workerd`).
- R2: `wrangler.jsonc` có binding `MEDIA`; `wrangler dev` mô phỏng cục bộ (không chạm bucket thật `vnxsi-media`), nên upload cục bộ chạy được; chỉ khi thiếu binding mới 503. Upload thuộc nhóm "sau" (mục 5).

### 3. Dữ liệu test: seed JS tất định

`seed/build-seed.mjs` xuất một chuỗi SQL `INSERT` thuần (dữ liệu mẫu, được phép trong test theo CLAUDE.md; cấm xuất hiện trên giao diện production: seed chỉ đi vào `e2e/.state`). Tất định: mọi id, handle, token là hằng trong `fixtures.mjs`; thời điểm sinh từ tham số `now` (mặc định `new Date()`, test đơn vị truyền `now` cố định). Dùng `node:crypto` sha256 hex (trùng `sha256Hex` của app, UTF-8). Không dùng Python.

Seed phải vượt ngưỡng `MIN` trong `apps/web/src/domain/public-stats.ts` khi cron chạy (bằng các bảng gốc để **cron thật được thực thi**, đúng ý bước "kích cron hourly cục bộ"):

| Khối homepage | Điều kiện (đối chiếu `db/public-stats.ts`) | Seed |
|---|---|---|
| Numbers (>= 2 ô) | products >= 10, builders >= 10, requests30d >= 10, countries >= 3 | 12 builder `approved` + user `active` ở 4 quốc gia; 12 product `published` (`PUBLIC_PRODUCT`); 12 request đã `submitted_at` trong 30 ngày, không `removed` |
| Market pulse / chart | `request_by_category`: tổng >= 10, mỗi nhóm >= 3 | request phân bổ vào 3 category (mỗi nhóm >= 3), product phân bổ để có nhóm khan hiếm |
| Growth chart | >= 4 tuần | `first_published_at` / `approved_at` rải đều 6 tuần trước `now` |
| Trending | >= 6 mục, điểm >= 20 | `product_daily_stats` 14 ngày + inquiry không `removed` để 6+ product vượt điểm (inquiries x5, demo clicks x2, views x1) |
| Top builders / Top products | theo `MIN.tabBuilders`, `selected`, `verified` | một số `product_verifications`, badge hợp lệ |
| Live (>= 5 sự kiện) | `audit_log` 7 ngày: `product.approve`, `badge.grant` (kèm `product_verifications` khớp `verified_at`), `builder.approve`, `request.submit` | >= 8 dòng audit khớp từng truy vấn của `loadLiveEvents` |

Phần tên bảng/cột lấy từ migration `0003`-`0016`; Implementer đọc từng migration, **không đoán cột**. Mọi dữ liệu tiền/giá dùng giá trị nhỏ vô hại; không tạo thứ gì ảnh hưởng xếp hạng ngoài các công thức công khai (ADR-004).

Dữ liệu cho luồng cần đăng nhập:

- User builder `e2e-builder@example.test`, builder `approved` handle `e2e-builder` (nhận inquiry `/b/e2e-builder/hire`), một product `published` slug `e2e-published-product` (nhận inquiry và quét axe `/p/...`) và một product `draft` có sẵn để editor mở.
- **Phiên đã seed** (không cần mail): một dòng `sessions` với `id_hash = sha256(E2E_SESSION_RAW)`, hết hạn sau 30 ngày. Fixture `builderPage` đặt cookie `__Host-vnx_session=<raw>` bằng `context.addCookies` (secure, httpOnly, path `/`, url = origin). Dùng cho editor và quét axe trang đăng nhập rồi.
- **Token đăng nhập đã seed** (dùng cho spec login): các dòng `login_tokens` purpose `login` với token thô cố định 43 ký tự `[A-Za-z0-9_-]` (đúng regex ở `consumeLoginToken`), lưu `token_hash = sha256(raw)`: `OK_1` (cho luồng chính), `OK_2` (logout), `OK_NEXT` (kiểm `next`), `EXPIRED` (`expires_at` quá khứ), cùng email builder. Token dùng một lần nên mỗi test dùng token riêng; DB bị xóa mỗi lần chạy nên chạy lại luôn sạch.
- Cron: `global-setup.ts` gọi `GET <origin>/__scheduled?cron=5+*+*+*+*` (đã bật `--test-scheduled`), rồi poll `GET /` tới khi thấy khối Numbers (tối đa 30 s) để chắc chắn `runHourly` xong (cron chạy `ctx.waitUntil`, không đồng bộ). Poll thất bại = lỗi setup rõ ràng ("snapshot chưa có: seed thiếu ngưỡng nào"), không phải test mờ. Implementer xác nhận bằng thực nghiệm rằng `/__scheduled` đi qua `run_worker_first: true` tới handler `scheduled` (nếu không, dùng `wrangler dev` handler dự phòng hoặc OQ-2).

### 4. Đăng nhập trong E2E mà không có cửa sau

Mailer giả (`email/fake.ts`) giữ outbox trong **bộ nhớ isolate của worker**, nên Playwright (tiến trình khác) không đọc được; và `ConsoleMailer` chỉ có khi `MAIL_DRIVER=console`, trong khi Turnstile giả đòi `MAIL_DRIVER=fake`. Đường sạch nhất: **gieo thẳng dòng `login_tokens`/`sessions` vào D1 cục bộ** (mục 3), với token thô biết trước. Đây là dữ liệu tương đương ghi thẳng DB trong test Vitest (`signIn` trong `test/fixtures.ts`), không thêm route/cờ/biến nào vào app. Hệ quả có chủ ý:

- Bước "yêu cầu liên kết" được test ở mức giao diện (POST `/login` trả trang "đã gửi", 400 khi email sai) nhưng **không** đọc nội dung mail (đã có test Vitest cho `loginEmail`).
- Bước "xác minh" được test bằng token đã seed, đi qua đúng `GET /auth/verify?t=` rồi `POST /auth/verify` do **trình duyệt thật** gửi, tức có `Origin` thật. Đó cũng chính là hồi quy cho `Referrer-Policy: no-referrer` (memory: làm trình duyệt gửi `Origin: null`, `originCheck` trả 403).

Rủi ro: cookie `__Host-vnx_session` có `Secure` trên `http://localhost`. Chromium coi `localhost` là origin an toàn và chấp nhận; Implementer xác nhận ngay ở bước đầu. Nếu không, phương án dự phòng: `wrangler dev --local-protocol https` + `ignoreHTTPSErrors: true` (OQ-3, đã chọn mặc định).

### 5. Danh sách test (must-have = `P1`, làm trong task này; `P2` = để sau, ghi trong báo cáo)

Quy ước chung: web-first assertion, không `waitForTimeout`; mọi test mở trang qua fixture `page` đã gắn `watchCsp`; **cuối mỗi test** khẳng định `csp.violations` rỗng và không có `console.error`/`pageerror` (ngoại lệ có tên cho Turnstile, xem dưới). Chặn mạng ra ngoài: `context.route(/^(?!http:\/\/localhost)/, abort)` để test không phụ thuộc internet và không gọi Cloudflare; nhờ vậy script `challenges.cloudflare.com` bị chặn trong mọi test (log "failed to load" cho đúng host này được loại khỏi kiểm console).

**P1: `home.spec.ts`** (mirror checklist Task 8b; trang `/`, snapshot đủ ngưỡng nhờ seed + cron)

1. Các khối render: Numbers (>= 2 ô), chart (có `svg.chart-svg[role=img]` kèm `aria-label`), Trending, Top, Live; mỗi khối có heading; không chữ "undefined"/"NaN"/"null".
2. Count-up kết thúc đúng giá trị in sẵn: với mọi `[data-count]` cuộn vào khung nhìn, `expect(el).toHaveText(new Intl.NumberFormat("en").format(Number(data-count)))` (poll, tối đa 3 s; animation dài 1200 ms). Khẳng định thêm: giá trị cuối khớp ô tương ứng trong trang tĩnh khi tắt JS (test 7).
3. Dải Live (`[data-marquee]`): sau khi `home.js` chạy có `.home-marquee-track` với `animation-name: belt`, `getComputedStyle(...).animationPlayState === "running"`; rê chuột (`hover`) -> `paused`; bỏ hover -> `running`; bấm `[data-motion-toggle]` -> `aria-pressed="true"`, lớp `is-paused`, `paused`; bấm lại -> chạy; `Tab` vào một liên kết trong dải (`focus-within`) -> `animation-name: none` và liên kết nằm trong khung nhìn; bản sao `aria-hidden` có `inert`, các `a/button` của bản sao có `tabindex=-1`.
4. Chart: `.chart-bar` có `animation-name: chart-grow` khi `CSS.supports("animation-timeline: view()")` (Chromium có); sau khi cuộn tới, mọi bar có `getBoundingClientRect().width > 0` (bar thật sự mọc, đúng mục (1) của Task 8b, điều Owner phải xác nhận bằng mắt).
5. Tooltip: rê chuột lên `.chart-group` -> `.chart-tip` hiển thị, text bằng đúng `data-tip` của nhóm, `aria-hidden="true"`; nhấn `Escape` -> `.chart-tip` có `hidden`.
6. `prefers-reduced-motion: reduce` (`page.emulateMedia({ reducedMotion: "reduce" })` trước `goto`): số hiện giá trị cuối ngay (không qua `0`), không có `.home-marquee-track` (JS thoát sớm), nút `[data-motion-toggle]` vẫn `hidden`, `.chart-bar`/`.chart-line` có `animation-name: none`.
7. Tắt JS (`test.use({ javaScriptEnabled: false })`): mọi khối vẫn có nội dung, `[data-count]` chứa số cuối, danh sách Live là `<ul>` dọc, nút motion `hidden`, không `.chart-tip`.
8. Header bảo mật trên `/`: CSP đúng chuỗi `CONTENT_SECURITY_POLICY` import từ `apps/web/src/http/security-headers.ts`? **Không** import mã app (cây workerd); chỉ khẳng định `default-src 'self'`, không `unsafe-inline`/`unsafe-eval` (smoke đã có bản prod; đây là bản E2E).

**P1: `inquiry.spec.ts`** (`/b/e2e-builder/hire`, đăng xuất)

1. Form có label cho mọi input (theo `getByLabel`), có `div.cf-turnstile[data-sitekey="fake-site-key"]`.
2. Gửi rỗng: lỗi hiển thị theo field, focus/summary truy cập được, HTTP 400, dữ liệu đã nhập giữ lại.
3. Gửi thiếu token Turnstile: bị từ chối, không tạo inquiry (chữ lỗi Turnstile; kiểm bằng nội dung trang, không đọc DB).
4. Thành công: điền hợp lệ, `fillFakeTurnstile` thêm input ẩn `cf-turnstile-response=test-pass` vào form (script Cloudflare bị chặn nên widget không tự điền), gửi, nhận trang "kiểm tra email" (status 200, không phải 4xx/5xx). Nội dung mail không kiểm (mục 4).
5. Hồi quy no-referrer: phản hồi GET của trang form không có `Referrer-Policy: no-referrer`; POST thành công ở mục 4 chính là bằng chứng Origin đúng (không 403).
6. Hạn mức: bước 2-4 dùng tổng <= 4 POST (hạn mức theo IP dùng chung `unknown` vì dev không có `cf-connecting-ip`; DB xóa mỗi lần chạy).

**P1: `login.spec.ts`**

1. `/login`: email sai -> 400 và thông báo lỗi; email hợp lệ -> trang "Check your email" (mailer giả). Tổng <= 3 POST `/login` (hạn mức email 5/giờ, IP 20/giờ).
2. Token `OK_1`: `GET /auth/verify?t=` -> 200, `Cache-Control: no-store`, `Referrer-Policy: same-origin`, có nút xác nhận; tải lại vẫn hợp lệ (GET không tiêu token, lý do VNX-0506); bấm nút -> 303 về `/`, cookie `__Host-vnx_session` có `httpOnly`, `secure`, `sameSite=Lax`, header trang kế có người dùng đã đăng nhập (liên kết `/hub` hoặc nút đăng xuất theo UI); phát lại cùng token -> trang "liên kết hỏng" 400.
3. `OK_NEXT` với `?next=/hub/products` -> đích `/hub/products`; `?next=https://evil.example` -> `/` (không redirect ra ngoài; `safeNext`).
4. `EXPIRED` -> trang liên kết hỏng, không đặt cookie.
5. `OK_2`: đăng nhập rồi `POST /logout` bằng nút -> cookie bị xóa, `/hub` chuyển về `/login`.
6. `/hub` và `/hub/products` khi chưa đăng nhập -> 303 `/login?next=...`.

**P1: `editor.spec.ts`** (fixture `builderPage`, builder `approved`)

1. `/hub/products` hiển thị danh sách có product draft đã seed.
2. Tạo product mới: nhập tên, gửi -> chuyển tới `/hub/products/:id/edit/...`, tên hiển thị trên trang.
3. Điền và lưu từng bước chữ (`product`, `demo`, ...: Implementer lấy danh sách bước từ `isTextStep` trong `domain/product-input.ts`, không đoán) và bước `pricing`; mỗi lần lưu có dấu hiệu "saved"; tải lại thì giá trị còn; trang liệt kê các điều kiện chưa đủ để gửi duyệt (gaps) tới khi đủ (không gửi duyệt: ngoài phạm vi).
4. Lỗi kiểm tra đầu vào (ví dụ URL demo sai, slug trùng/sai định dạng): lỗi hiển thị theo field, dữ liệu giữ lại.
5. Chưa đăng nhập -> `/hub/products/:id/edit/product` về `/login`; builder khác không mở được product của builder kia (404): dùng product thứ hai seed của builder thứ hai.

**P1: `a11y.spec.ts`** (axe)

- Helper `scanA11y(page, label)`: `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze()`; vi phạm làm test đỏ, in `id`, `impact`, `help`, danh sách selector. Không tắt rule toàn cục. Chờ trang ổn định trước khi quét (ảnh/font, `networkidle` không dùng; chờ landmark `main` và `document.fonts.ready`). Các nội dung chuyển động quét ở trạng thái `reducedMotion: "reduce"` để tránh màu giữa animation gây dương tính giả; riêng homepage quét thêm ở trạng thái mặc định sau khi count-up xong.
- Trang và locale. **`en`:** `/`, `/products`, `/builders`, `/b/e2e-builder`, `/b/e2e-builder/hire`, `/p/e2e-published-product`, `/request`, `/for-builders`, `/privacy`, `/contact`, `/login`, `/auth/verify?t=<OK_1>` (chỉ GET), và đã đăng nhập: `/hub`, `/hub/products`, một trang editor (`/edit/product`). **`vi`** (một locale khác, đủ để bắt lỗi `lang`, độ dài chữ và dấu): `/vi/`, `/vi/login`, `/vi/b/e2e-builder/hire`, `/vi/privacy`. Mỗi cặp (trang, locale) là một test con để lỗi chỉ ra đúng trang.
- Thêm một lượt ở viewport 360 x 740 cho `/` và form Inquiry (spec: responsive tới 360 px). Vùng chạm >= 44 px: axe `target-size` (rule WCAG 2.2) nằm trong `wcag22aa`; ngoài ra không viết kiểm tra tự chế.
- **Chính sách vi phạm đã có sẵn trong mã:** nếu axe tìm thấy vi phạm thật ở trang hiện có, Implementer **không sửa app** (ngoài phạm vi). `e2e/support/a11y-known.ts` là danh sách tạm hoãn tường minh `{ page, locale, ruleId, selector?, reason, finding: "VNX-xxxx" }`; mỗi mục phải khớp một phát hiện trong báo cáo; danh sách không khớp (mục thừa) làm test đỏ để nó không phình ra âm thầm. Reviewer quyết từng mục: tạo task sửa hay chấp nhận có lý do. Danh sách khởi đầu **rỗng**; con số cuối cùng và nội dung nằm trong báo cáo. (OQ-1)

**P1: `meta.spec.ts`** (chứng minh công cụ không "xanh rỗng")

1. `scanA11y` trên một trang `setContent` có `<img src="x">` thiếu `alt` -> **phải** trả vi phạm (`image-alt`).
2. `watchCsp` bắt được `securitypolicyviolation` khi chèn script inline vào trang thật của app (CSP của app cấm), và bắt được `console.error`.

**P2 (sau, ghi trong báo cáo, không làm ở đây):** upload ảnh product (R2 cục bộ) và xóa; gửi duyệt/xuất bản product + admin duyệt; inquiry khi đã đăng nhập và `/p/:slug/inquiry/:type`; request board và `/request`; trang tool; Firefox/WebKit; chế độ sáng/tối (`prefers-color-scheme`) và tương phản ở cả hai; view counting (đặt `ANALYTICS_SALT`, kiểm cookie `__Host-vnx_vid`); zh-hans/zh-hant (`lang`, font); kiểm `touch` thật (tooltip cảm ứng, mục Owner đã duyệt tay).

### 6. CI

Job `e2e` mới trong `.github/workflows/web-ci.yml` (cùng điều kiện `push main` + `pull_request`; song song job `test`; `permissions: contents: read` giữ nguyên):

```yaml
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Resolve Playwright version
        id: pw
        run: echo "v=$(node -p \"require('@playwright/test/package.json').version\")" >> "$GITHUB_OUTPUT"
      - uses: actions/cache@v4
        id: pwcache
        with: { path: ~/.cache/ms-playwright, key: "pw-${{ runner.os }}-${{ steps.pw.outputs.v }}" }
      - if: steps.pwcache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      - if: steps.pwcache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
      - run: npm run e2e:typecheck
      - run: npm run e2e
        env: { CI: "true" }
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: "playwright-report\ntest-results", retention-days: 7 }
```

- **Ngân sách thời gian:** mục tiêu <= 6 phút cho job (cài ~1,5, wrangler dev + seed ~0,5, test ~2-3); `timeout-minutes: 15`; trong config `globalTimeout` 8 phút, `timeout` mỗi test 30 s, `expect.timeout` 5 s.
- **Flake policy:** `retries: process.env.CI ? 1 : 0`; `workers: 1` (một server, một DB dùng chung, các spec có ghi; seed mỗi lần chạy nên không phụ thuộc thứ tự giữa các lần chạy nhưng spec không được phụ thuộc thứ tự lẫn nhau: mỗi test dùng token/product riêng); `trace: "on-first-retry"`, `screenshot: "only-on-failure"`. Test nào cần retry để xanh phải ghi vào báo cáo; hai lần retry-xanh liên tiếp của cùng một test là phát hiện MEDIUM (sửa test hoặc xóa, không tăng retries). Cấm `waitForTimeout`; Reviewer grep được (AC12).
- CI không có secret, không có `--remote`; `wrangler dev` không cần đăng nhập Cloudflare (D1/R2 mô phỏng; Implementer xác nhận bằng cách chạy với `CLOUDFLARE_API_TOKEN` rỗng/không có). Nếu `wrangler dev` đòi token ở runner sạch, đây là blocker cần báo.
- `security-ci` không đổi. Thay đổi `package-lock.json` đi qua `dependency-review`.

### 7. Script npm và chạy trên Windows

Root `package.json`:

```json
"e2e": "playwright test -c e2e/playwright.config.ts",
"e2e:headed": "playwright test -c e2e/playwright.config.ts --headed",
"e2e:typecheck": "tsc -p e2e/tsconfig.json --noEmit",
"e2e:install": "playwright install chromium"
```

Cách dev chạy (Git Bash hoặc PowerShell, từ thư mục gốc worktree): `npm ci` (một lần) -> `npm run e2e:install` (một lần, ~170 MB) -> `npm run e2e`. Cổng khác: Git Bash `E2E_PORT=8811 npm run e2e`; PowerShell `$env:E2E_PORT=8811; npm run e2e`. Chạy một spec: `npm run e2e -- tests/login.spec.ts`. Báo cáo: `npx playwright show-report`. Không cần `.dev.vars`, tài khoản Cloudflare hay internet (bị chặn có chủ ý). Nhớ về máy dùng chung: chỉ một worker Playwright, một `wrangler dev`; không chạy song song với `npm test` toàn bộ (bộ nhớ). `e2e/README.md` (Reviewer viết) lặp lại các bước này.

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng (một lệnh) |
|---|---|---|
| AC1 | Không đổi mã app/cấu hình production | `git diff --stat origin/main -- apps/web scripts/smoke.mjs scripts/smoke-checks.mjs` rỗng |
| AC2 | Vitest-trong-workerd không đổi và vẫn xanh | `npm test -w apps/web -- --maxWorkers=2` |
| AC3 | Toàn bộ E2E xanh trên máy sạch (DB dựng mới, cron chạy, mọi spec P1) | `npm run e2e` |
| AC4 | Kiểu TypeScript của `e2e/` sạch | `npm run e2e:typecheck` |
| AC5 | Cổng cấu hình được, mặc định không phải 8787 | `E2E_PORT=8811 E2E_INSPECTOR_PORT=9411 npm run e2e -- tests/meta.spec.ts` |
| AC6 | Từ chối mục tiêu không phải localhost (không bao giờ nhắm production) | `node --test scripts/test/e2e-targets.test.mjs` (kiểm `vnx.si`, `www.vnx.si`, `*.workers.dev`, `BASE_URL` lạ đều bị từ chối) |
| AC7 | Seed tất định và vượt ngưỡng `MIN` | `node --test scripts/test/e2e-seed.test.mjs` (cùng `now` cho cùng SQL; đếm dòng mỗi bảng >= ngưỡng; không có `--remote`) |
| AC8 | Tệp sinh ra không vào git | `git check-ignore e2e/.state playwright-report test-results` (in cả ba) |
| AC9 | Lock chỉ thêm đúng gói đã nêu, ghim chính xác | `npm ls @playwright/test @axe-core/playwright --depth=0` và `git diff -- package.json` (không có `^`/`~` ở hai gói) |
| AC10 | Công cụ không xanh rỗng (axe bắt `image-alt`, CSP listener bắt vi phạm) | `npm run e2e -- tests/meta.spec.ts` |
| AC11 | axe WCAG 2.2 AA: mọi trang ở mục 5 quét và hoặc sạch hoặc nằm trong `a11y-known.ts` có tham chiếu phát hiện; không mục thừa | `npm run e2e -- tests/a11y.spec.ts` (+ bảng vi phạm trong báo cáo) |
| AC12 | Không `waitForTimeout`, không bí mật, không URL production trong `e2e/` | `grep -rnE "waitForTimeout|https://vnx\.si|RESEND_API_KEY=[^ \"]|TURNSTILE_SECRET" e2e` (chỉ được trùng ở `serve.mjs` dòng `RESEND_API_KEY` rỗng và `targets.mjs` danh sách từ chối; Reviewer đọc từng dòng) |
| AC13 | Workflow hợp lệ và chạy xanh | Owner cho push rồi xem job `e2e` của `web-ci` xanh (không kiểm được cục bộ; trước đó `git diff origin/main -- .github/workflows/web-ci.yml` chỉ thêm job `e2e`) |
| AC14 | `npm test` gốc và `test:scripts` không bị ảnh hưởng | `npm run test:scripts` |

## Rủi ro

- **Flaky do animation/IntersectionObserver:** count-up cần phần tử vào khung nhìn; test cuộn tường minh và poll giá trị cuối thay vì chờ thời gian. Dải Live: hover/focus phụ thuộc vị trí; dùng `locator.hover()` và `focus()`, kiểm style tính toán thay vì chụp ảnh.
- **Cron không đồng bộ:** `runHourly` chạy trong `waitUntil`; `global-setup` poll tới khi khối hiện, lỗi setup rõ ràng nếu seed thiếu ngưỡng. Nếu `/__scheduled` không tới được handler vì `run_worker_first`, Implementer báo; phương án dự phòng (mặc định OQ-2) là gieo thêm dòng `public_stats` thẳng bằng SQL mà vẫn giữ bước cron như phép kiểm riêng.
- **Cookie `__Host-`/`Secure` trên `http://localhost`:** xem mục 4, có dự phòng HTTPS cục bộ.
- **Hạn mức dùng chung `unknown`:** `rate_limits` (login 20/giờ theo IP, 5/giờ theo email) và có thể của inquiry; ngân sách POST đã nêu, DB xóa mỗi lần chạy. Thêm spec POST phải cập nhật ngân sách.
- **Đĩa và tải về:** Chromium ~170 MB; có `E2E_CHANNEL`. `e2e/.state` nhỏ (vài MB).
- **Cổng bận / tiến trình mồ côi:** cổng cấu hình được, `reuseExistingServer: false`, `serve.mjs` giết cả cây (`taskkill /T`); nếu Playwright bị giết cứng, `workerd` có thể mồ côi (ghi trong `e2e/README.md`: `taskkill /IM workerd.exe /F` chỉ khi chắc không phiên nào khác dùng).
- **Áp lực bộ nhớ máy dùng chung:** một worker, một Chromium, một `wrangler dev`; không chạy cùng lúc `npm test` toàn bộ; nếu workerd OOM dấu hiệu là máy hết commit memory (memory ghi nhớ), dừng bớt tiến trình khác.
- **Phiên bản gói thay đổi:** ghim chính xác; nâng phiên bản là task riêng (revision Chromium đi theo Playwright, cache CI khóa theo phiên bản).
- **axe tìm ra nhiều vi phạm có sẵn:** có chủ ý không sửa ở đây; danh sách tạm hoãn tường minh + báo cáo; rủi ro là task phình ra, nên giới hạn ở "phát hiện", sửa theo task do Owner duyệt (một task sửa chung hoặc theo trang).
- **`--var` không thắng `.dev.vars`:** có phép thử bắt buộc và hàng rào fail closed (mục 2).
- **Chặn mạng ra ngoài làm lệch hành vi Turnstile:** ý đồ; widget thật không chạy trong E2E, chỉ driver giả. Việc Turnstile thật vẫn hoạt động ở production thuộc bước kiểm tay trong `docs/runbooks/deploy.md`.

## Câu hỏi mở

- **OQ-1 (a11y, chính sách khi có vi phạm thật):** mặc định: không sửa app trong task này; ghi danh sách tạm hoãn tường minh + báo cáo, Reviewer phân loại và Owner duyệt task sửa. Nếu Owner muốn cổng cứng "0 vi phạm mới trước ra mắt", đổi thành: task 0802 chỉ xong khi danh sách tạm hoãn rỗng, kèm một task sửa phụ do Owner duyệt.
- **OQ-2 (cron cục bộ):** mặc định: dùng bảng gốc + `/__scheduled` thật. Nếu `/__scheduled` không tới handler với `run_worker_first`, gieo `public_stats` trực tiếp (không đổi mã app) và ghi lại sai khác.
- **OQ-3 (Secure cookie):** mặc định HTTP `localhost`; nếu Chromium từ chối, chuyển sang `--local-protocol https` + `ignoreHTTPSErrors`.
- **OQ-4 (trình duyệt):** mặc định chỉ Chromium. Firefox/WebKit thêm khoảng 150-200 MB mỗi cái và thời gian CI; chỉ thêm nếu Owner muốn bảo hành đa trình duyệt cho ra mắt.
- **OQ-5 (khi nào chạy):** mặc định CI chạy cho mọi PR và push `main`, và runbook deploy thêm một dòng "chạy `npm run e2e` trước deploy" (Reviewer cập nhật `docs/runbooks/deploy.md`, không phải Implementer). Owner có thể muốn chỉ chạy theo nhãn/tay để tiết kiệm phút CI.
