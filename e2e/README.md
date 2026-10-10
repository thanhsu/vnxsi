# E2E: Playwright + axe (VNX-0802)

Bộ test trình duyệt cho bốn luồng người dùng thấy đầu tiên (homepage, form Inquiry, editor product, đăng nhập) và cổng WCAG 2.2 AA bằng axe.
Plan: `.ai/plans/VNX-0802-plan.md`. Báo cáo của Implementer: `.ai/tasks/VNX-0802-report.md`.
VNX-0807 (`.ai/plans/VNX-0807-plan.md`) thêm: chặn quét trên trang nạp thiếu tài nguyên (`support/network.ts`), lượt quét homepage không JS (biến thể `nojs`), chờ animation hữu hạn trước lượt quét có chuyển động, và `form-errors.spec.ts` (mẫu lỗi chung của form render phía server).

**Chỉ chạy trên máy local.** Bộ test tự dựng một `wrangler dev` riêng với D1 riêng trong `e2e/.state/`, gửi form POST thật và gieo dữ liệu mẫu.
Nó không bao giờ nhắm `vnx.si` hay `*.workers.dev`. Kiểm production là việc của `npm run smoke` (VNX-0805, `docs/runbooks/deploy.md`).

## Cài lần đầu

Chạy từ gốc repo (hoặc gốc worktree), Git Bash hay PowerShell đều được:

```sh
npm ci                  # một lần cho mỗi checkout
npm run e2e:install     # một lần cho mỗi máy: Chromium của Playwright 1.64 (~120 MB + ~80 MB headless shell)
```

Trình duyệt nằm ở `%LOCALAPPDATA%\ms-playwright` (Linux: `~/.cache/ms-playwright`). Không cần `.dev.vars`, tài khoản Cloudflare hay internet.

## Chạy

| Việc | Lệnh |
|---|---|
| Toàn bộ (khoảng 1,5 phút, 57 test) | `npm run e2e` |
| Một spec | `npm run e2e -- tests/login.spec.ts` |
| Một test theo tên | `npm run e2e -- -g "count-up"` |
| Có cửa sổ trình duyệt | `npm run e2e:headed` |
| Kiểm kiểu TypeScript của `e2e/` | `npm run e2e:typecheck` |
| Test thuần Node (chặn mục tiêu lạ, seed tất định) | `npm run test:scripts` |
| Xem báo cáo HTML sau khi chạy | `npx playwright show-report playwright-report` |

Đường dẫn spec tính từ `e2e/` (thư mục `testDir`), nên viết `tests/login.spec.ts`, không phải `e2e/tests/...`.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `E2E_PORT` | `8799` | Cổng của `wrangler dev` dưới test. Không dùng 8787 (của `npm run dev` ở phiên khác). |
| `E2E_INSPECTOR_PORT` | `9329` | Cổng inspector của workerd (mặc định 9229 của wrangler hay bị chiếm). Phải khác `E2E_PORT`. |
| `E2E_RETRIES` | `0` ở máy local, `1` khi có `CI` | Số lần chạy lại test lỗi. Chỉ dùng làm biện pháp tạm khi máy rơi kết nối (mục "Sự cố"). Test nào phải retry mới xanh thì ghi vào báo cáo. Tối đa `2`: seed chỉ có token đăng nhập cho 3 lần thử (`ATTEMPTS` trong `seed/fixtures.mjs`), lần thử thứ 4 của một test login dừng với lỗi rõ ràng. |
| `E2E_CHANNEL` | trống (Chromium đi kèm) | `chrome` hoặc `msedge`: dùng trình duyệt đã cài sẵn thay cho bản tải về, khi đĩa chật. |
| `BASE_URL` | trống | Chỉ nhận `http(s)://localhost` hoặc `127.0.0.1` đúng cổng `E2E_PORT`; mọi host khác bị từ chối ngay khi nạp cấu hình. Thường không cần đặt. |
| `CI` | trống | Có giá trị thì `retries` = 1 và `test.only` bị cấm. |

Git Bash:

```sh
E2E_PORT=8811 E2E_INSPECTOR_PORT=9411 npm run e2e
E2E_CHANNEL=msedge npm run e2e -- tests/home.spec.ts
```

PowerShell (biến `$env:` tồn tại tới hết phiên shell, nên xóa sau khi dùng):

```powershell
$env:E2E_PORT = "8811"; $env:E2E_INSPECTOR_PORT = "9411"; npm run e2e
Remove-Item Env:E2E_PORT, Env:E2E_INSPECTOR_PORT
```

Cổng bận thì Playwright báo lỗi và dừng; nó không tự đổi cổng và không bao giờ dùng lại server có sẵn (`reuseExistingServer: false`), để không gửi POST vào server của phiên khác.

## Một lần chạy làm gì

1. `e2e/scripts/serve.mjs` (là `webServer.command` của Playwright): xóa `e2e/.state/`, `wrangler d1 migrations apply vnxsi --local --persist-to e2e/.state`, sinh `e2e/.state/seed.sql` bằng `seed/build-seed.mjs` rồi `wrangler d1 execute --local --file`, sau đó `wrangler dev --test-scheduled` trên `apps/web/wrangler.jsonc` với các `--var` dưới đây. Chương trình từ chối chạy nếu thấy `--remote`.
2. `global-setup.ts` gọi `GET /__scheduled?cron=5+*+*+*+*` để chạy job hourly thật trên dữ liệu đã gieo, rồi chờ homepage có đủ khối số liệu (tối đa 30 giây).
3. Các spec chạy với **một worker** (một server, một DB dùng chung).
4. Khi xong, `serve.mjs` dừng cả cây tiến trình (`taskkill /T` trên Windows), kể cả `workerd`.

Mỗi lần chạy bắt đầu từ DB trống, nên token dùng một lần và bộ đếm rate limit không dồn giữa các lần chạy.

Biến `--var` (chỉ có hiệu lực trong tiến trình `wrangler dev` cục bộ này; không ghi vào `wrangler.jsonc`, không gửi lên Cloudflare):

| Biến | Giá trị | Lý do |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:<E2E_PORT>` | liên kết và canonical đúng origin test |
| `MAIL_DRIVER` | `fake` | không gửi mail; điều kiện để Turnstile giả có hiệu lực |
| `RESEND_API_KEY` | rỗng | khóa thật luôn thắng driver giả (VNX-0803 F6); `--var` thắng `.dev.vars` (đã kiểm bằng thực nghiệm, xem báo cáo) |
| `TURNSTILE_DRIVER` | `fake` | site key `fake-site-key`, token hợp lệ `test-pass` |
| `ADMIN_EMAILS` | `e2e-admin@example.test` | cố định |
| `PRIVACY_NOTICE_GO_LIVE` | rỗng | ngày go-live của production không được đổi hành vi test (giống `vitest.config.ts`). Luật "không đặt bằng `--var`" trong `wrangler.jsonc` nói về deploy; ở đây chỉ là server local. |
| `ANALYTICS_SALT` | rỗng | không đếm view, không cookie visitor, kể cả khi `.dev.vars` của dev có salt |

## Phạm vi đang kiểm

| Spec | Nội dung |
|---|---|
| `home.spec.ts` | Các khối homepage render đủ (Numbers, chart, Trending, Top, Live), count-up dừng đúng số in sẵn, dải Live chạy/dừng khi rê chuột, khi bấm nút và khi focus, bản sao `inert`, chart mọc khi cuộn tới, tooltip và `Escape`, `prefers-reduced-motion`, tắt JavaScript, header bảo mật. Mô phỏng checklist tay Task 8b của M7. |
| `inquiry.spec.ts` | Form `/b/e2e-builder/hire` khi chưa đăng nhập: label đủ, widget Turnstile, gửi rỗng (400, lỗi theo field có `aria-describedby` và không `role="alert"`, khối tóm tắt, giữ dữ liệu), thiếu token Turnstile (mục tóm tắt không liên kết, tiền tố `Error:` ở `<title>`), gửi thành công, hồi quy `Referrer-Policy: no-referrer` (POST mang `Origin` thật). |
| `form-errors.spec.ts` | Mẫu lỗi chung (VNX-0807) trên form Inquiry (EN + VI, kèm quét axe trang 400), request (EN) và contact (EN + VI): `<title>` bắt đầu bằng `Error:`/`Lỗi:`, `#form-errors` có heading đúng locale và nhận focus khi tải (thuộc tính `autofocus`, không JS), số liên kết bằng số lỗi theo field và mỗi liên kết trỏ tới một control có thật, không còn `role="alert"`, bấm liên kết đầu đưa focus vào đúng field, giá trị đã nhập còn nguyên. |
| `login.spec.ts` | `/login` (email sai và đúng), `/auth/verify` (GET không tiêu token, chỉ nút mới đăng nhập, cookie `__Host-vnx_session` có `HttpOnly`/`Secure`/`SameSite=Lax`, token dùng một lần), `next` cục bộ và `next` ra ngoài, link hết hạn, đăng xuất, `/hub` khi chưa đăng nhập. Lỗi email sai vẫn là mẫu cũ (`role="alert"`) cho tới VNX-0807 T6 (sau khi EPIC 26 merge). |
| `editor.spec.ts` | Danh sách product, tạo draft và điền từng bước tới khi chỉ còn thiếu ảnh, lỗi kiểm tra đầu vào (slug sai, slug trùng, URL demo không https; khối tóm tắt và tiền tố `Error:`), chưa đăng nhập, builder khác không mở được product. |
| `a11y.spec.ts` | axe với tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` trên 12 trang công khai `en`, 3 trang builder đã đăng nhập, 4 trang `vi`, `/` và form Inquiry ở 360 px, `/` có chuyển động sau khi count-up và mọi animation hữu hạn xong, và `/`, `/vi/` khi `landing.js` + `home.js` bị chặn (biến thể `nojs`, mục dưới). |
| `meta.spec.ts` | Chứng minh công cụ không "xanh rỗng": axe bắt `image-alt` và `color-contrast`, bộ nghe CSP bắt script inline bị chặn và `console.error`, cơ chế `KNOWN_A11Y` vừa che được vi phạm vừa làm đỏ mục thừa, `settle()` dừng với `E2E infrastructure` khi một asset cùng origin nạp lỗi và cho qua khi test đã khai báo request đó. |

Chưa kiểm (P2 của plan): upload ảnh R2, gửi duyệt và xuất bản product, inquiry khi đã đăng nhập và `/p/:slug/inquiry/*`, request board, trang tool, admin/ops, zh-Hans/zh-Hant, chế độ tối, trang lỗi 4xx, Firefox/WebKit, cảm ứng thật.
Từ VNX-0807, chỉ có Vitest (chưa có E2E): mẫu lỗi chung trên form waitlist của landing, các form hub (apply, portfolio, products, pricing, media, invitations), thread inquiry (`/hub/inquiries/:id`, `/me/inquiries/:id`); deck homepage ở chế độ thẻ product khi không JS (seed E2E chưa có đủ 3 product công khai, nên lượt `nojs` chỉ phủ chế độ thẻ danh mục).

### Biến thể `nojs` và chờ animation

- `nojs`: test chặn `/assets/landing.js` và `/assets/home.js` bằng `page.route(..., route => route.abort())` rồi quét. Không dùng `javaScriptEnabled: false` vì axe phải chạy script trong trang. Markup là đúng cái người dùng không JS nhận (thẻ sau của deck hero có `inert` + `aria-hidden="true"` từ server, VNX-0807 R1). Khóa quét: `{ page: "/", locale, variant: "nojs" }`; mục `KNOWN_A11Y` cũng nhận `variant: "nojs"`.
- Lượt "with motion" (`variant: "motion"`): `settle(page, { motion: true })` chờ mọi animation hữu hạn theo thời gian kết thúc (`document.getAnimations()`, bỏ animation vô hạn như dải Live và animation gắn cuộn), tối đa 5 giây, quá hạn thì `E2E infrastructure: finite animations still running after 5 s: <tên>`.

## Đăng nhập mà không có cửa sau

Mailer giả giữ outbox trong bộ nhớ của worker, Playwright không đọc được. Thay vào đó seed ghi thẳng vào D1 cục bộ:

- một dòng `sessions` cho builder chính (fixture `builderPage` đặt cookie `__Host-vnx_session` tương ứng);
- các dòng `login_tokens`: mỗi token dùng một lần (`OK_1`, `OK_2`, `OK_NEXT`, `OK_NEXT_EVIL`) có một bản cho mỗi lần thử (`OK_1`, `OK_1_R1`, `OK_1_R2`; chọn bằng `tokenFor(key, test.info().retry)`), cộng `OK_A11Y` (chỉ GET, không tiêu) và `EXPIRED`. Mỗi test tiêu token riêng, nên retry vẫn có token mới.

DB chỉ lưu sha256 của token và session, giống app. Token thô nằm trong `seed/fixtures.mjs` và chỉ có nghĩa với DB trong `e2e/.state/`; production không có dòng nào khớp. Không có route, cờ hay biến nào được thêm vào `apps/web`: bước xác minh vẫn đi qua `GET /auth/verify?t=` rồi `POST /auth/verify` do trình duyệt thật gửi, với `Origin` thật. Đây cũng là cách test Vitest đăng nhập (`signIn` trong `apps/web/test/fixtures.ts`).

## Viết thêm spec

- Import `test` và `expect` từ `../support/test`, **không** từ `@playwright/test` (chỉ `meta.spec.ts` được làm khác, vì nó cố tình gây lỗi). Fixture tự động ở đó chặn mọi request ra ngoài `localhost`/`127.0.0.1` và làm đỏ test khi có vi phạm CSP, `console.error` hay lỗi trang chưa bắt. Bộ nghe chỉ gắn vào fixture `page` (và `builderPage`, cùng một trang): trang mở bằng `context.newPage()` không được nghe.
- **Request cùng origin nạp lỗi** (`support/network.ts`, VNX-0807 R2(a)): fixture `page` gọi `watchSameOriginFailures` trước mọi `goto` và ghi lại mọi sự kiện `requestfailed` tới origin của app. `settle()` (chạy trước mỗi lượt axe) ném `E2E infrastructure: <url> failed (<errorText>)` nếu có, vì quét một trang thiếu CSS/font/script là đo một trang người dùng không nhận. Ngoại lệ: `net::ERR_ABORTED` (trình duyệt tự hủy request của nó, ví dụ khi điều hướng đi) và các path test đã khai báo bằng `allowSameOriginFailure(page, /regex/)` khi tự `route.abort()` (khai báo này cũng bỏ qua dòng console "Failed to load resource" của đúng URL đó trong bộ nghe CSP). Chỉ lỗi mức mạng là `requestfailed`; asset trả HTTP 4xx/5xx vẫn bị bộ nghe CSP bắt qua dòng `console.error` "Failed to load resource: the server responded with a status of ..." khi test kết thúc. Trang mở bằng `context.newPage()` phải tự gọi `watchSameOriginFailures(page, baseURL)` (xem `meta.spec.ts`).
- Không ngủ theo thời gian cố định (hàm wait-for-timeout của `page`). Dùng assertion web-first (`toHaveText`, `toBeVisible`) hoặc `expect.poll`. `npm run test:scripts` có test quét các file `.ts`/`.mjs`/`.json` trong `e2e/` để chặn hàm đó, URL production và chuỗi giống secret; lệnh grep của AC12 trong plan quét cả thư mục, nên README này cố ý không viết nguyên tên hàm.
- Mỗi test tự đủ, không phụ thuộc thứ tự và chạy lại được: tạo product riêng (tên và slug theo `test.info().retry`, vì app gắn hậu tố ngẫu nhiên khi slug đã có), dùng token riêng qua `tokenFor` (thêm token mới vào `ONE_USE` trong `seed/fixtures.mjs`).
- **Ngân sách POST** (hạn mức theo IP dùng chung khóa `unknown` vì `wrangler dev` không có `cf-connecting-ip`). Chỉ form hợp lệ mới bị đếm:

  | Route | Hạn mức trong app | Bộ test hiện dùng |
  |---|---|---|
  | `POST /b/:handle/hire` (chưa đăng nhập) | 10 / giờ / IP, 5 / giờ / email | 2 lần đếm theo IP, 1 theo email |
  | `POST /login` | 20 / giờ / IP, 5 / giờ / email | 1 |
  | `POST /auth/verify` | không có | 4 |
  | `POST /request`, `POST /contact` | có (theo IP) | 0: `form-errors.spec.ts` chỉ gửi form sai, bị từ chối trước bước đếm |

  Thêm spec có POST thì cập nhật bảng này. Với `E2E_RETRIES` lớn, một test lỗi nhiều lần có thể chạm hạn mức (429).
- Đổi seed: chạy `npm run test:scripts`. `scripts/test/e2e-seed.test.mjs` áp mọi migration lên SQLite trong bộ nhớ, kiểm khóa ngoại và các ngưỡng `MIN` của homepage. Test đọc bảng `MIN` thẳng từ `apps/web/src/domain/public-stats.ts` (regex trên văn bản), nên ngưỡng ở app tăng thì test này đỏ trước cả `global-setup`.
- Quét a11y: `await scanA11y(page, { page: "/duong-dan", locale: "en" })`. Vi phạm làm đỏ test. Vi phạm có sẵn mà task hiện tại không được sửa app thì thêm vào `support/a11y-known.ts` kèm mã phát hiện; mục không còn khớp vi phạm nào cũng làm đỏ test. Danh sách hiện rỗng.

## Đọc kết quả

- Reporter `list` in từng test ra terminal. Báo cáo HTML ở `playwright-report/`, ảnh chụp khi lỗi và trace (khi retry) ở `test-results/`. Cả hai và `e2e/.state/` đều bị git-ignore.
- Lỗi axe in `id (impact): help` và danh sách selector của từng node.
- `E2E setup: homepage snapshot not ready ...`: seed thấp hơn một ngưỡng `MIN` (thường do ai đó đổi ngưỡng ở app). Chạy `npm run test:scripts` để biết khối nào.
- `E2E infrastructure: /assets/app.css did not load`: trang không có CSS (lỗi mạng của máy, xem dưới), không phải lỗi a11y.
- `E2E infrastructure: http://localhost:8799/... failed (net::ERR_...)`: một tài nguyên cùng origin (script, CSS, font, ảnh) nạp lỗi ở mức mạng trước lượt quét (`support/network.ts`). Thường là lỗi mạng của máy (mục "Sự cố"), không phải lỗi a11y; trước VNX-0807 trường hợp này cho ra vi phạm giả, ví dụ `target-size` trên thẻ sau của deck khi `landing.js` không nạp (review VNX-0802). Trạng thái không JS thật của homepage được kiểm riêng bằng biến thể `nojs`.
- `E2E infrastructure: finite animations still running after 5 s`: lượt "with motion" còn animation hữu hạn chạy quá 5 giây; xem tên animation trong thông báo.

## Sự cố

- **`net::ERR_ADDRESS_IN_USE`, `net::ERR_NO_BUFFER_SPACE` hoặc `ENOBUFS` ở 20-40 % số test.** Gặp khi phát triển VNX-0802: một `workerd.exe` cũ của phiên khác giữ khoảng 9.000 socket TCP ở trạng thái `Bound`, làm Chromium hết cổng tạm. Kiểm trong PowerShell:

  ```powershell
  Get-NetTCPConnection -State Bound | Group-Object OwningProcess | Sort-Object Count -Descending | Select-Object -First 5 Count, Name
  Get-Process -Id <PID> | Select-Object Id, ProcessName, StartTime
  ```

  Máy khỏe có khoảng 100-200 socket `Bound`. Chỉ dừng tiến trình do chính mình khởi động. Không dừng được thì tạm chạy `E2E_RETRIES=2 npm run e2e` và ghi các test phải retry mới xanh vào báo cáo.
- **`workerd` mồ côi** (Playwright bị giết cứng, cổng 8799 vẫn bị giữ): tìm PID bằng `Get-NetTCPConnection -LocalPort 8799 -State Listen` rồi `taskkill /PID <pid> /T /F`. `taskkill /IM workerd.exe /F` chỉ khi chắc chắn không phiên nào khác đang chạy `wrangler dev` hay `npm test`.
- **Bộ nhớ:** không chạy `npm run e2e` cùng lúc với `npm test` toàn bộ trên máy dùng chung. workerd báo "JavaScript heap out of memory" ở heap rất nhỏ nghĩa là máy hết commit memory.
- **Không bao giờ `rm -rf node_modules`** trong worktree (link workspace trỏ vào `apps/web` và Git Bash xóa theo link). Cần cài lại thì `npm ci`.

## CI

Job `e2e` trong `.github/workflows/web-ci.yml` chạy ở mọi PR và push `main`, song song job `test`: `npm ci`, cài Chromium (cache theo phiên bản Playwright), `npm run e2e:typecheck`, `npm run e2e` với `CI=true`. Không secret, không đăng nhập Cloudflare, không `--remote`. Khi lỗi, `playwright-report/` và `test-results/` được tải lên thành artifact (giữ 7 ngày).

Nâng phiên bản `@playwright/test` hay `@axe-core/playwright` là task riêng: hai gói ghim chính xác, revision Chromium đi theo Playwright.
