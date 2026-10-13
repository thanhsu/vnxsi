# Runbook deploy — vnxsi-web (VNX-0805)

Một nguồn duy nhất cho thứ tự deploy, smoke, ghi sổ và khôi phục của Worker `vnxsi-web` và D1 `vnxsi`.
Plan: `.ai/plans/VNX-0805-plan.md`. Script smoke: `scripts/smoke.mjs`, bảng kiểm `scripts/smoke-checks.mjs`.

Quy ước: mọi lệnh chạy từ **gốc repo** trừ khi có dòng `cd apps/web` (các lệnh `npx wrangler` cần `apps/web/wrangler.jsonc`).
`<...>` là chỗ điền. Không dán giá trị secret vào tài liệu, hội thoại hay commit.

## 1. Trạng thái production

**Bản chụp ngày 2026-10-13.** Nguồn sự thật là dòng "Production lần N" mới nhất trong `.ai/context/CURRENT-STATUS.md`; cập nhật bảng này mỗi lần deploy (mục 8).

| Mục | Giá trị |
|---|---|
| Lần deploy gần nhất | Lần 6, 2026-10-11 |
| Commit đã deploy | `main` `b2d3c3c` (EPIC 26 với cờ `oauth_*` tắt, VNX-0807, `chore(web)`: `LEGAL_UPDATED_AT` = `2026-10-11`). Cây chứa `eb45c10` |
| Version Worker | `bb832ca1` (kiểm lại bằng `npx wrangler deployments status`: `wrangler secret put` cũng tạo version mới) |
| Migration cao nhất đã áp | `0017_user_identities` (áp ở lần 6). `0018_request_board` (EPIC 27) chưa áp |
| `PRIVACY_NOTICE_GO_LIVE` | `2026-10-21` (D). D−14 = 2026-10-07, D+31 = 2026-11-21 |
| `REQUEST_BOARD_GO_LIVE` | Chưa có trên production (EPIC 27 chưa deploy). EPIC 27 lên `main` với giá trị `""`: bảng request tắt ở mọi nơi (mục 4) |
| "Last updated" | `/terms` `2026-10-11`, `/privacy` (bản M7) `2026-10-21` |
| Secret đã đặt (chỉ tên) | `TURNSTILE_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `ANALYTICS_SALT` |
| Secret chưa đặt | 6 secret OAuth của EPIC 26 (VNX-2601). `MAIL_FROM` không đặt (mặc định `VNX.SI <noreply@vnx.si>`) |
| Secret chờ xoay | `RESEND_API_KEY`, `TURNSTILE_SECRET` (VNX-0803 F1, Owner "làm sau"; trước khi bật ElevenLabs) |
| Cron trigger | `0 1 * * *` (dọn hằng ngày), `5 * * * *` (snapshot `public_stats`) |
| Rule rate limit Cloudflare | 1 rule: `/p/*` (4 locale) + `/go/*`, theo IP, 20 request / 10 giây, Block 10 giây. Chưa phủ `/requests*` (phải có trước khi bật cờ `request_board`, mục 6) |
| R2 | `vnxsi-media` (binding `MEDIA`) |
| Domain | `vnx.si`, `www.vnx.si` (custom domain); `www` → apex chưa làm (VNX-0804); `workers_dev: true` |
| Cờ / partner | ElevenLabs chưa bật (xem "Việc của Owner trước khi bật ElevenLabs" ở `CURRENT-STATUS.md`) |
| Version có thể rollback về | Chỉ các version chứa `eb45c10`: `55e19e11` (lần 5). Mọi version trước `55e19e11` không chứa nó (mục 9) |

## 2. Trước deploy

**Ai được chạy:** Owner. Claude chỉ chạy migrate / deploy / `secret put` khi Owner đã yêu cầu **chính lần deploy đó** trong hội thoại, từ checkout sạch của `origin/main` (`CLAUDE.md`, mục "Luật cứng": không merge, không push, không deploy nếu Owner chưa nói rõ). Auto mode chặn Claude đọc dữ liệu dòng của production: câu `SELECT` trên dữ liệu thật và `d1 export` do Owner chạy.

1. Owner nói rõ "deploy". Ghi lại câu cho phép (dùng ở mục 8).
2. Tạo worktree sạch từ `origin/main`. Main checkout `D:\DOCS\SUPHAM\GIT\vnxsi` thuộc phiên khác: không deploy từ đó.
   ```sh
   git fetch origin
   git worktree add ../vnxsi-deploy origin/main --detach
   cd ../vnxsi-deploy
   git status --porcelain                                   # phải rỗng
   git merge-base --is-ancestor eb45c10 HEAD && echo OK-eb45c10   # phải in OK-eb45c10
   git log --oneline -1                                     # ghi SHA
   ```
3. Cài và kiểm:
   ```sh
   npm ci
   npm run typecheck -w apps/web
   npm test
   npm run test:scripts
   npm run e2e        # VNX-0802: Playwright + axe trên wrangler dev cục bộ (cổng 8799); lần đầu trên máy: npm run e2e:install. Xem e2e/README.md
   ```
   Máy thiếu bộ nhớ (workerd báo "JavaScript heap out of memory" ở heap rất nhỏ) là lỗi môi trường, không phải lỗi code: kiểm `workerd.exe` còn sót, rồi chạy `npm test -w apps/web -- --maxWorkers=2`. Không chạy hai bộ test cùng lúc trong một worktree.
4. Xem migration chưa áp trên production (lệnh này chỉ đọc danh sách, không đọc dữ liệu dòng):
   ```sh
   cd apps/web
   npx wrangler d1 migrations list vnxsi --remote
   ```
   Lệnh liệt kê file **chưa áp**. So với `apps/web/migrations/`. Với mỗi migration mới, trả lời: mã đang chạy có chịu được schema mới không (bảng/cột thêm: thường có; ngoại lệ đã biết ở mục 9)?
   Lần deploy đầu của EPIC 27: danh sách chỉ có `0018_request_board` (thêm cột `requests.country` cho phép NULL và hai bảng `request_publications`, `request_interests`, không `INSERT`). Mã đang chạy chịu được; mã EPIC 27 cần nó, nên migrate trước, deploy ngay sau (mục 3).
5. Lần deploy đầu có cron mới: kiểm còn slot cron trigger trên tài khoản Cloudflare dùng chung với vsnstock (mục 6).
6. Dọn worktree **sau** khi xong (kể cả smoke và ghi sổ):
   ```sh
   cd <gốc repo chính>
   git worktree remove ../vnxsi-deploy
   ```
   `git worktree remove` gỡ cả worktree là an toàn: link workspace `node_modules/@vnxsi/web` trỏ vào `apps/web` **của chính worktree đó**, vốn cũng bị xóa cùng. Nguy hiểm là **`rm -rf node_modules`** riêng lẻ trong một worktree còn dùng: `rm -rf` của Git Bash đi theo link và xóa mã nguồn `apps/web` (đã xảy ra 2026-10-07). Không bao giờ làm vậy.
   Nếu `git worktree remove` từ chối, đừng dùng `--force` khi chưa xem `git status`. Cần xóa thư mục thì chạy trong **PowerShell hoặc cmd**: `cmd /c rmdir /s /q <thư mục>` (không đi theo junction). Trong Git Bash, MSYS đổi `/c`, `/s`, `/q` thành đường dẫn; phải viết `cmd //c rmdir //s //q <thư mục>`.

## 3. Thứ tự deploy

Migration **trước**, deploy **ngay sau**. Mã mới có thể cần bảng mới (thiếu `0014` thì mọi lần mở Inquiry lỗi); khoảng giữa hai bước, mã cũ chạy trên schema mới, nên giữ khoảng này ngắn.

1. Ghi mốc Time Travel trước khi migrate (in bookmark hiện tại; lệnh luôn chạy trên D1 remote):
   ```sh
   cd apps/web
   npx wrangler d1 time-travel info vnxsi
   ```
   Ghi bookmark và giờ UTC vào sổ (mục 8).
2. Áp migration (bỏ qua nếu bước 2.4 không còn file nào):
   ```sh
   npm run db:migrate:remote -w apps/web
   ```
3. Deploy ngay:
   ```sh
   npm run deploy -w apps/web
   ```
   Nên gắn commit vào version để sau này biết version nào chứa `eb45c10` (cờ `--message` có trong `wrangler deploy --help`):
   ```sh
   npm run deploy -w apps/web -- --message "main <sha>"
   ```
   Ghi **Version ID** wrangler in ra. Kiểm lại: `npx wrangler deployments status` (trong `apps/web`).
4. Chạy smoke (mục 7) và ghi sổ (mục 8).

## 4. Luật ngày pháp lý: `PRIVACY_NOTICE_GO_LIVE` và `REQUEST_BOARD_GO_LIVE`

### `PRIVACY_NOTICE_GO_LIVE` (M7)

Nguồn: chú thích (a)–(c) trong `apps/web/wrangler.jsonc`, "Việc của Owner khi deploy M7" trong `CURRENT-STATUS.md`.

- Giá trị nằm trong `apps/web/wrangler.jsonc` `vars`, đặt bằng **một commit `chore:` trên `main`**. Không đặt bằng `--var`, không đặt trên dashboard, **không bao giờ xóa**.
- Ngày D phải cách lần deploy đầu mang nó **≥ 14 ngày** (gần hơn hay ngày đã qua làm mất thời gian báo trước và việc đếm bắt đầu ngay).
- **Mọi lần deploy sau 2026-10-07 phải từ cây chứa `eb45c10`** (`git merge-base --is-ancestor eb45c10 HEAD`). Cây thiếu commit này deploy lên thì `/privacy` quay về bản cũ trong khi hash lượt xem/click đã tồn tại: vi phạm.
- `apps/web/vitest.config.ts` ghim `PRIVACY_NOTICE_GO_LIVE: ""` để ngày thật không đổi bộ test; test nào cần ngày thì tự đặt. Bộ test xanh **không** chứng minh ngày production đúng: kiểm bằng smoke.
- Smoke in dòng `Privacy: Last updated <ngày>`. Từ 2026-10-07 giá trị đúng là `2026-10-21`, **cho tới B − 14** của bảng request (mục dưới); từ B − 14 giá trị đúng là B. Thấy ngày khác hoặc `not found` là sự cố (mục 11).
- Thông báo thay đổi Privacy chỉ hiện cho người **đã đăng nhập**; smoke không có cookie nên không thấy. Kiểm bằng trình duyệt nếu cần.
- Mốc đang chờ: D = 2026-10-21 (bắt đầu đếm lượt xem và hash click từ 00:00 UTC); D+31 = 2026-11-21 (thông báo tắt; sau đó task dọn phiên bản Privacy: bỏ bản `current`, giữ `m7` và `board`).

### `REQUEST_BOARD_GO_LIVE` (B, bảng request công khai, EPIC 27)

Nguồn: chú thích (a)–(d) của `REQUEST_BOARD_GO_LIVE` trong `apps/web/wrangler.jsonc`; plan EPIC 27 mục "Task VNX-2708"; `CURRENT-STATUS.md` (nghĩa vụ VNX-2708).

- Bảng chỉ mở khi **cả hai** đúng: hôm nay (UTC) ≥ B **và** cờ `request_board` bật ở `/admin/flags`. Rỗng hoặc sai định dạng = bảng tắt ở mọi nơi (`/requests*` 404, không ô opt-in ở `/request`, không link ở footer và `/for-builders`, sitemap không có `/requests`). EPIC 27 lên `main` với `""`; migration `0018` không bật cờ.
- Giá trị nằm trong `apps/web/wrangler.jsonc` `vars`, đặt bằng **một commit `chore:` trên `main`**. Không `--var`, không dashboard, **không bao giờ xóa**. `apps/web/vitest.config.ts` ghim biến này `""`; bộ test xanh không chứng minh ngày production đúng.
- **Chọn B:** B ≥ 14 ngày sau lần deploy đầu mang nó (thời gian báo trước cho Privacy và Terms mới) **và** B ≥ `PRIVACY_NOTICE_GO_LIVE` (`2026-10-21`). `test/config/wrangler-guard.test.ts` đỏ nếu B sai định dạng, nhỏ hơn `PRIVACY_NOTICE_GO_LIVE`, hoặc khi B có giá trị mà bản Privacy/Terms của bảng chưa có. Nếu B < 2026-12-05, thông báo M7 (tới 2026-11-21) và thông báo bảng hiện cùng lúc cho người đã đăng nhập (M7 trước): đã chấp nhận, không phải lỗi.
- **Trước khi commit B:** người có chuyên môn pháp lý đã đọc xong `docs/legal/privacy-board.md` và `docs/legal/terms-board.md` (Q16, VNX-2708), mọi chỉnh sửa đã đi lại quy trình VNX-2707b. Lý do: câu chữ của bảng lên `/privacy`, `/terms` từ B − 14 **chỉ theo ngày**, không chờ cờ.
- **Từ B − 14 (00:00 UTC):** `/privacy` và `/terms` (EN, VI; zh hiện bản EN) chuyển sang bản có bảng request, "Last updated" của **cả hai** = B; thông báo trước hiện cho người đã đăng nhập trong cửa sổ `[B − 14, B + 31)`. Smoke in `Privacy: Last updated B`; `/terms` kiểm tay (smoke không in Terms). Trước B − 14: Privacy `2026-10-21`, Terms `2026-10-11`.
- **Mọi lần deploy sau khi commit B lên `main`, từ bất kỳ phiên hay nhánh nào, phải từ cây chứa commit đó** (`git merge-base --is-ancestor <sha-commit-B> HEAD`, như luật `eb45c10` ở trên). Cây thiếu nó deploy lên thì `/privacy`, `/terms` quay về bản không có bảng trong khi publication đã tồn tại. Khi B được commit, Reviewer ghi SHA vào đây và vào mục 2 bước 2.
- **Thứ tự bật (VNX-2708, Owner):**
  1. Deploy EPIC 27 với `REQUEST_BOARD_GO_LIVE = ""` (migrate `0018` trước, deploy ngay sau; mục 2–3). `npm run smoke` (mặc định) xanh; kiểm tay `/requests` 404, footer không có link, `/request` không có ô opt-in.
  2. Đọc pháp lý Q16 xong (gạch trên).
  3. Commit B trên `main` (`chore:`) → deploy (mục 2–3, 7–8) → `npm run smoke` (mặc định: bảng vẫn tắt vì cờ tắt).
  4. Tới B − 14: kiểm `/privacy`, `/terms` có chữ bảng và "Last updated: B" (smoke in Privacy).
  5. Thêm phạm vi `/requests*` vào rule rate limit Cloudflare (mục 6). Phải xong **trước** bước 6.
  6. Từ ngày B: bật cờ `request_board` ở `/admin/flags` (phiên magic-link của admin; phiên OAuth không vào được `/admin`). Chờ tối đa 60 giây (cache cờ mỗi isolate), rồi `npm run smoke -- --board` (mục 7) và kiểm tay một request thật đi hết opt-in → publish → interest → mời → đóng → `noindex`.

## 5. Secret và biến

| Tên | Loại | Ghi chú |
|---|---|---|
| `TURNSTILE_SECRET` | secret | Thiếu thì form chưa đăng nhập (Inquiry, contact, request) đóng (fail closed) |
| `RESEND_API_KEY` | secret | Domain gửi `vnx.si` phải verified trên Resend |
| `ADMIN_EMAILS` | secret | Danh sách email admin |
| `ANALYTICS_SALT` | secret | Chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -hex 32`). Đặt lúc nào cũng được; đếm chỉ từ D 00:00 UTC. Chưa đặt: mỗi isolate log `visitor.no_salt` một lần (bình thường). Xoay chỉ làm khử trùng của ngày đó bắt đầu lại |
| `MAIL_FROM` | var tùy chọn | Mặc định `VNX.SI <noreply@vnx.si>` |
| `TURNSTILE_SITE_KEY`, `APP_ORIGIN`, `PRIVACY_NOTICE_GO_LIVE`, `REQUEST_BOARD_GO_LIVE` | var trong `wrangler.jsonc` | Công khai, đổi bằng commit (hai ngày pháp lý: mục 4) |
| 6 secret OAuth (EPIC 26) | secret | Chưa đặt |

```sh
cd apps/web
npx wrangler secret list            # chỉ in tên
npx wrangler secret put <TÊN>       # nhập giá trị ở prompt, không đưa vào lệnh
```

- Secret chỉ nằm trong `wrangler secret` (production) hoặc `apps/web/.dev.vars` (local, git-ignored). Không bao giờ trong repo, `vars`, hội thoại.
- `wrangler secret put` tạo và đưa lên một version Worker mới: ghi version mới vào sổ.
- Local: không có `RESEND_API_KEY` thì đặt `MAIL_DRIVER=console` trong `.dev.vars`. Có khóa thật thì mail thật luôn được gửi qua Resend, kể cả local.

## 6. Cloudflare ngoài repo (Owner)

Không có trong code, không có test bảo vệ. Kiểm trên dashboard khi nghi ngờ.

- **Rule rate limit:** một rule cho `/p/*` (4 locale) và `/go/*`, theo IP, 20 request / 10 giây, Block 10 giây (tạo 2026-10-07; đã thử: request thứ 21 trả 429, `/products` không bị ảnh hưởng). Smoke được thiết kế để ở dưới ngưỡng (mục 7).
- **Rule rate limit cho bảng request (EPIC 27, VNX-2708):** thêm `/requests` và `/requests/*` (4 locale: `/requests*`, `/vi/requests*`, `/zh-hans/requests*`, `/zh-hant/requests*`) vào rule trên hoặc một rule riêng cùng ngưỡng, **trước** khi bật cờ `request_board` (mục 4, thứ tự bật bước 5). Không đổi code. Smoke đã tính `/requests*` là đường bị phủ ở cả hai chế độ, nên dùng chung bộ đếm với `/p/*`, `/go/*` vẫn ở dưới ngưỡng (mục 7). Sau khi tạo: thử như rule cũ (request thứ 21 trong 10 giây trả 429, `/request` và `/products` không bị ảnh hưởng) và ghi vào mục 1.
- **Cron trigger:** `vnxsi-web` cần 2 (`0 1 * * *`, `5 * * * *`). Tài khoản dùng chung với vsnstock: kiểm còn slot **trước** lần deploy đầu thêm cron mới. Hết quota thì deploy không đăng ký được cron.
- **R2:** bucket `vnxsi-media`. Thiếu binding thì `/media/*` 404, upload ảnh trả 503.
- **Resend:** domain gửi `vnx.si` verified.
- **Turnstile:** widget của `vnx.si`; site key ở `wrangler.jsonc`.
- **Zone `vnx.si`:** Rocket Loader, Web Analytics (tự chèn), Bot Fight Mode phải **tắt**: chúng chèn script inline, CSP chặn.
- **D1 Time Travel:** cửa sổ lưu theo gói Workers của tài khoản: **Free 7 ngày, Paid 30 ngày**. Runbook không khẳng định gói hiện tại; xem trên dashboard Cloudflare (trang gói / billing của tài khoản, mục Workers Free hay Workers Paid) trước khi tính hạn phục hồi.

## 7. Smoke sau deploy

```sh
npm run smoke                                   # mặc định https://vnx.si, bảng request TẮT
npm run smoke -- --board                        # bảng request BẬT (sau go-live và mọi lần deploy sau đó)
npm run smoke -- --slug <product-slug>          # thêm 2 kiểm trên product thật (HEAD); dùng được cùng --board
npm run smoke -- --base http://localhost:8787   # local (sau npm run dev)
```

- **Chọn chế độ theo trạng thái thật của bảng request (EPIC 27).** `npm run smoke` (mặc định) giả định bảng **tắt**: `REQUEST_BOARD_GO_LIVE` rỗng hoặc hôm nay < B, hoặc cờ `request_board` tắt. Trên bảng đang bật, chế độ mặc định **FAIL** (`/requests` 200, sitemap có `/requests`, footer có link): đó là chọn sai chế độ, không phải sự cố. Từ lúc Owner bật cờ (ngày ≥ B, mục 4 bước 6) và **sau mọi lần deploy sau đó**, dùng `npm run smoke -- --board`. Sau công tắc khẩn cấp (mục 9) quay lại chế độ mặc định, chờ ít nhất 60 giây sau khi tắt cờ (cache cờ mỗi isolate).

- Chỉ `GET`/`HEAD`, `redirect: manual`, không cookie, không secret, `User-Agent: vnxsi-smoke/1`, timeout 10 giây. Chỉ đọc biến môi trường `BASE_URL` (hoặc `--base`).
- `--base` chỉ nhận `https://` hoặc `http://localhost` / `http://127.0.0.1`, và chỉ là origin.
- `--slug` mặc định tắt. Dùng `HEAD` cho `/p/<slug>` và `/go/p/<slug>/demo`: handler trả lời HEAD mà không ghi lượt xem hay click, nên không làm nhiễu thống kê. Kiểm 302, `Location` https, `Referrer-Policy: origin`, `X-Robots-Tag: noindex`.
- **Mã thoát:** `0` không FAIL; `1` có FAIL; `2` tham số sai (không gửi request nào).
- **Đầu ra:** bảng `STATUS | check | detail`, rồi dòng `N pass, M pass-after-retry, K fail` và `Privacy: Last updated <ngày>`. Base khác `vnx.si` thì HSTS và origin của dòng `Sitemap:` không được kiểm (script ghi rõ ở dòng đầu).
- **Kiểm gì (64 request trước EPIC 27; nay 69 ở chế độ mặc định, 66 với `--board`, cộng 2 với `--slug`):** 9 trang công khai × 4 locale (200, HTML); `/admin`, `/hub`, `/me` × 4 locale (303, `Location` = `<locale>/login?next=...`); `/ops`, `/ops/x` (404, `no-store`, `X-Robots-Tag: noindex`); `/vi/ops` (404; xem dòng "Đã biết" ngay dưới); `/p/<không có>` × 4 locale (404, noindex qua header hoặc `<meta name="robots">`); `/go/p/<không có>/demo`, `/go/<không có>` (404, noindex, `no-store`); `robots.txt`; `sitemap.xml` (không lộ `/ops`, `/go`, `/hub`, `/admin`, `/me`); header bảo mật trên `/` và trang 404 (CSP không `unsafe-inline`/`unsafe-eval`, `nosniff`, `X-Frame-Options: DENY`, HSTS 1 năm, `Referrer-Policy: strict-origin-when-cross-origin`); `/auth/verify` không token (400, `Referrer-Policy: same-origin`, `no-store`); `/privacy` (in "Last updated"); `/api/health` (`{"ok":true}`).
- **Bảng request, chế độ mặc định (bảng tắt):** `/`, `/vi/`, `/zh-hans/`, `/zh-hant/` và `/for-builders` × 4 locale không có `href` tới `/requests`; `/requests` × 4 locale 404 có noindex; `/requests/zz-smoke-no-such-thing` 404 có noindex; sitemap không có `<loc>` nào dưới `/requests`.
- **Bảng request, `--board` (bảng bật):** `/requests` 200, HTML, `Cache-Control` không có `public`/`max-age`/`s-maxage`, `Referrer-Policy` không phải `no-referrer` (trang có form POST, mục 11); `/requests/zz-smoke-no-such-thing` 404 có noindex; sitemap chỉ được có `/requests` và `/requests/<id 26 ký tự>` dưới bảng, mỗi id đúng 4 lần (một mỗi locale), không đường `/me`, `/ops`, `/hub`, `/admin`, không chữ `request_id`. Public id có cùng dạng với ULID nên smoke không phân biệt được public id với id request theo hình dạng: nó chỉ chứng minh cấu trúc (việc sitemap chỉ dùng public id do test Vitest khẳng định). Smoke không đọc request thật (production không có dữ liệu cố định, smoke không ghi), không kiểm link footer khi bảng bật.
- **Ngân sách request (vì rule rate limit):** `isRateCovered` tính `/p/*`, `/go/*` và (từ VNX-2709) `/requests`, `/requests/*` ở mọi locale là đường bị phủ, ở **cả hai** chế độ (bảo thủ: rule `/requests*` chỉ có từ VNX-2708, có thể chung bộ đếm với `/p/*`). Số request bị phủ: mặc định **11** (13 với `--slug`), `--board` **8** (10 với `--slug`); test `scripts/test/smoke-checks.test.mjs` khẳng định đúng các số này. Chạy tuần tự; ≥ 600 ms giữa hai request bị phủ; không quá 10 request bị phủ trong cửa sổ 10 giây, kể cả retry. Gặp 429: in cảnh báo, chờ 11 giây, thử lại một lần. Ở chế độ mặc định, request bị phủ thứ 11 phải chờ cửa sổ 10 giây của request đầu, nên smoke chậm hơn trước vài giây: bình thường. Chạy smoke vài lần liên tiếp vẫn dưới ngưỡng 20 / 10 giây; đừng chạy song song nhiều bản.
- **Thử lại:** check FAIL được thử lại đúng một lần sau 3 giây → `PASS (retry)` hoặc `FAIL`. Ngay sau deploy từng có một route có tiền tố locale trả 404 thoáng qua (lan truyền); retry che được. Vẫn FAIL: chờ khoảng một phút, chạy lại `npm run smoke` một lần, rồi mới tính rollback (mục 9). `PASS (retry)` nhiều là dấu hiệu lan truyền chậm: ghi vào sổ.
- **Đã biết, không phải lỗi:** `/vi/ops` trả 404 có `Cache-Control: no-store` và noindex bằng `<meta name="robots">`, nhưng **không** có `X-Robots-Tag` (khoảng hở là VNX-2502 F3, dời sang VNX-2508; khi VNX-2508 xong, smoke sẽ kiểm `/vi/ops` như `/ops`); `/p/<không có>` noindex bằng meta, không header; `/go/...` 404 mang `Referrer-Policy` mặc định (`origin` chỉ có ở 302); `robots.txt` production có khối Managed của Cloudflare đứng trước dòng của app.

**Kiểm tay còn lại (smoke không làm):**

1. Đăng nhập magic link thật (email tới, `POST /auth/verify` thành công, vào `/me`).
2. Form có Turnstile: `/contact`, `/request`, Inquiry `/b/:handle/hire` (widget hiện, không lỗi CSP trên console).
3. `www.vnx.si` (chưa kiểm; VNX-0804 sẽ chuyển về apex).
4. Sau D (từ 2026-10-21, M7 bước 6): `GET /p/:slug` có `Set-Cookie: __Host-vnx_vid` (`Max-Age` tới nửa đêm UTC; lần GET này tính một lượt xem thật); `/go/p/:slug/demo` 302 có UTM, `no-store`, `X-Robots-Tag`, `Referrer-Policy: origin`; có dòng `product_daily_stats` của hôm đó; log job giờ (Workers Logs trên dashboard) ghi `public_stats`. Câu đọc D1 do **Owner** chạy, ví dụ:
   ```sh
   cd apps/web
   npx wrangler d1 execute vnxsi --remote --command "SELECT day, COUNT(*) AS products, SUM(views) AS views, SUM(demo_clicks) AS demo_clicks FROM product_daily_stats WHERE day >= '2026-10-21' GROUP BY day ORDER BY day"
   ```
5. Thay đổi giao diện: kiểm trình duyệt theo checklist của task đó.
6. Bảng request (EPIC 27): khi bảng tắt, `/request` không có ô opt-in bảng công khai và không có ô quốc gia; khi bảng bật, sau go-live, một request thật đi hết vòng đời (mục 4 bước 6) và Search Console không index trang đã đóng.

## 8. Ghi sổ

Sau mỗi deploy, thêm một dòng vào đầu mục trạng thái của `.ai/context/CURRENT-STATUS.md` và cập nhật bảng ở mục 1. **Deploy chưa xong khi chưa ghi sổ.**

```text
- **Production (<YYYY-MM-DD>, lần <N>):** `main` `<sha>` (<nội dung chính>) **đã deploy** (version `<version-id>`, <ai chạy>, theo lệnh Owner "<câu cho phép>"). Bookmark Time Travel trước migrate: `<bookmark>` (<giờ UTC>). D1 production đã áp `<0017>`–`<00NN>` (hoặc: không có migration mới). Chứa `eb45c10`: có. Smoke: `<n> pass, <m> pass-after-retry, <k> fail`, Privacy "Last updated <ngày>". Kiểm tay: <đã làm / còn lại>. Sự cố: <không / mô tả>.
```

## 9. Rollback và khôi phục

### Mã Worker

```sh
cd apps/web
npx wrangler deployments list          # 10 lần deploy gần nhất, kèm version id
npx wrangler versions list             # 10 version gần nhất
npx wrangler rollback <version-id> --message "<lý do>"
```

- Rollback chỉ đổi mã và cấu hình đi theo version (`vars`, kể cả `PRIVACY_NOTICE_GO_LIVE`). **Không** đổi dữ liệu D1/R2, không hoàn migration.
- **Secret:** `wrangler rollback` liệt kê các secret đã đổi kể từ version đích và hỏi xác nhận. Xác nhận nghĩa là version đó chạy với **giá trị secret cũ**: khóa đã xoay quay về khóa cũ (có thể đã thu hồi), `ANALYTICS_SALT` đặt sau version đó thì mất. `npx wrangler secret list` chỉ in tên nên không phát hiện được điều này. Sau rollback: `npx wrangler secret put <TÊN>` lại **từng secret wrangler đã liệt kê** (mỗi lần tạo version mới; ghi version cuối vào sổ), rồi `npm run smoke`.
- **Chỉ rollback về version chứa `eb45c10`.** Đối chiếu version ↔ commit bằng sổ (mục 8) hoặc message đã gắn khi deploy. Hiện tại (2026-10-10) mọi version trước `55e19e11` (`8e1e141d`, `411e3c9f`, …) **không** chứa `eb45c10` → không rollback được; sửa bằng roll-forward.
- **Roll-forward:** sửa trên nhánh, merge vào `main` (Owner duyệt), deploy lại từ worktree sạch theo mục 2–3.
- **Bảng request (EPIC 27):** khi B đã được commit và deploy, chỉ rollback về version **chứa** commit B (như luật `eb45c10`); version thiếu nó đưa `/privacy`, `/terms` về bản không có bảng. Migration `0018` không hoàn (bảng thêm vô hại, mã cũ không đọc chúng). Muốn tắt bảng thì dùng công tắc dưới, không rollback.

### Công tắc khẩn cấp: bảng request

- Tắt cờ `request_board` ở `/admin/flags` (phiên magic-link của admin). Mỗi isolate thấy thay đổi trong tối đa **60 giây** (cache cờ); sau đó `/requests`, `/requests/:publicId` và POST interest trả 404, sitemap không còn `/requests`, footer và `/for-builders` hết link, `/request` hết ô opt-in.
- **Sitemap trễ tới 1 giờ:** `/sitemap.xml` gửi `Cache-Control: public, max-age=3600`, nên crawler hay cache phía client có thể còn giữ bản liệt kê URL của bảng tới 1 giờ sau khi tắt cờ. Các trang đó vẫn trả 404 ngay; không cần làm gì thêm.
- **Câu chữ pháp lý theo ngày, không theo cờ:** tắt cờ **không** đổi `/privacy`, `/terms`; từ B − 14 chúng vẫn là bản có bảng (đúng, vì publication đã tồn tại). Không xóa B để "tắt" bảng (mục 4).
- Khi cờ tắt: client vẫn gỡ được request của mình; Ops vẫn từ chối, gỡ, sửa và bỏ qua (dismiss) interest, nhưng không publish được (409). Builder vẫn thấy trạng thái interest ở Hub (tiêu đề không link).
- Smoke sau khi tắt: `npm run smoke` (mặc định), sau ít nhất 60 giây. Bật lại: cờ bật rồi `npm run smoke -- --board`.

| Tình huống | Làm gì |
|---|---|
| Smoke FAIL sau hai lần chạy, có version trước chứa `eb45c10` và chạy được trên schema hiện tại | Rollback về version đó, smoke, ghi sổ, rồi sửa và roll-forward |
| Smoke FAIL, không có version trước chứa `eb45c10` | Roll-forward. Không rollback |
| Deploy có migration mà mã cũ không chịu được schema mới | Roll-forward (mã cũ cũng hỏng) |
| Chỉ `PASS (retry)` | Không làm gì, ghi sổ |
| Mất `PRIVACY_NOTICE_GO_LIVE` (Privacy sai ngày) | Deploy lại ngay từ `origin/main` (chứa `eb45c10`) |
| Mất `REQUEST_BOARD_GO_LIVE` sau khi B đã commit (`/privacy`, `/terms` về bản không có bảng) | Deploy lại ngay từ `origin/main` (chứa commit B) |
| Sự cố trên bảng request (nội dung, tải, lỗi) | Công tắc khẩn cấp (mục "Công tắc khẩn cấp: bảng request" ở trên), không rollback |

### Migration và dữ liệu

- Migration **chỉ đi tới**, không có "down". Migration thêm bảng/cột lỗi mà vô hại: sửa bằng migration mới, **không** restore.
- Mã cũ trên schema mới thường chịu được bảng/cột thêm. Ngoại lệ đã biết: sau `0006_catalog`, mã trước M4 trả 409 khi sửa product đã publish (trigger FTS làm `meta.changes` khác 1).
- Hỏng dữ liệu thật: **D1 Time Travel** (Owner quyết, không làm thử trên production):
  ```sh
  cd apps/web
  npx wrangler d1 time-travel info vnxsi                                   # bookmark hiện tại
  npx wrangler d1 time-travel info vnxsi --timestamp=<RFC3339 hoặc Unix>   # bookmark tại một thời điểm
  npx wrangler d1 time-travel restore vnxsi --bookmark=<bookmark>
  npx wrangler d1 time-travel restore vnxsi --timestamp=<RFC3339 hoặc Unix>
  ```
  Restore **ghi đè** DB hiện tại: mọi ghi sau mốc bị mất (Inquiry, đăng ký, thống kê). Ghi lại bookmark mà lệnh trả về để có thể hoàn tác. Cửa sổ: Free 7 ngày, Paid 30 ngày (mục 6); help của wrangler ghi "within the last 30 days" là giới hạn tối đa, không phải gói của tài khoản. Sau restore: kiểm `npx wrangler d1 migrations list vnxsi --remote` (mốc trước migrate thì migration đó lại thành "chưa áp") và đảm bảo mã đang chạy khớp schema.

## 10. Sao lưu D1 khi có bảng ảo FTS5

`wrangler d1 export` không xuất được DB có bảng ảo; DB `vnxsi` có `products_fts` (FTS5, tạo ở `apps/web/migrations/0006_catalog.sql`).

**(a) Ưu tiên Time Travel** (mục 9): không cần export, không đụng schema. Ghi bookmark trước mỗi migrate là đủ cho phần lớn tình huống.

**(b) Export tay** (khi cần bản sao ngoài Cloudflare). Owner chạy, vì file chứa dữ liệu cá nhân. **Chưa ai chạy quy trình này:** trước lần đầu trên production, chạy **đúng các lệnh dưới đây** trên một D1 nháp (có `products` và `products_fts` dựng từ migration) và ghi kết quả vào runbook. Trong lúc làm, tìm kiếm catalog trả rỗng; sửa product trong lúc này không mất vì bước 3 backfill lại từ `products`. `d1 export` có thể chặn các truy vấn khác tới DB trong lúc chạy: làm vào giờ thấp điểm.

1. Bỏ trigger đồng bộ và bảng ảo (tên lấy từ `0006_catalog.sql`):
   ```sh
   cd apps/web
   npx wrangler d1 execute vnxsi --remote --command "DROP TRIGGER products_fts_after_insert; DROP TRIGGER products_fts_after_update; DROP TRIGGER products_fts_after_delete; DROP TABLE products_fts;"
   ```
2. Export (ra ngoài repo):
   ```sh
   npx wrangler d1 export vnxsi --remote --output <đường dẫn ngoài repo>/vnxsi-<YYYYMMDD>.sql
   ```
3. Tạo lại bảng ảo, trigger và backfill bằng **nội dung nguyên văn của file migration**, gửi qua `--command` (cùng đường query mà `migrations apply` đã dùng để tạo `products_fts` lần đầu):
   ```sh
   # Git Bash
   npx wrangler d1 execute vnxsi --remote --command "$(cat migrations/0006_catalog.sql)"
   ```
   ```powershell
   # PowerShell
   npx wrangler d1 execute vnxsi --remote --command (Get-Content -Raw migrations/0006_catalog.sql)
   ```
   **Không dùng `--file`** cho bước này: với `--remote`, `d1 execute --file` đi qua import API của D1 (DB tạm ngừng phục vụ truy vấn trong lúc chạy) và chưa được thử với `CREATE VIRTUAL TABLE … fts5` cùng trigger. `d1 execute` (cả hai cách) không ghi vào bảng theo dõi migration, nên `migrations list` không đổi.
4. Kiểm: tìm kiếm ở `/products` trả kết quả; `npm run smoke`.

- Khôi phục từ file export vào DB mới: import file, rồi chạy lại nội dung `migrations/0006_catalog.sql` như bước 3 (file export không có `products_fts`).
- File export chứa dữ liệu cá nhân: không vào repo, không gửi cho model AI, xóa khi hết hạn dùng.

## 11. Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Smoke in `Privacy: Last updated` khác giá trị đúng (`2026-10-21`; từ B − 14 là B, mục 4) hoặc `not found` | Deploy từ cây thiếu `eb45c10` hay commit B (hoặc ngày bị đặt qua `--var`/dashboard) | Deploy lại ngay từ `origin/main`; kiểm `git merge-base --is-ancestor eb45c10 HEAD` (và commit B) |
| Smoke mặc định FAIL ở `board-off .../requests` (200), sitemap có `/requests`, hoặc `/` có link `/requests` | Bảng đang bật: chọn sai chế độ | Chạy `npm run smoke -- --board` (mục 7) |
| `npm run smoke -- --board` FAIL ở `board /requests` (404) | Cờ `request_board` tắt, hôm nay < B, hoặc cache cờ (≤ 60 giây) | Kiểm `/admin/flags` và B; chờ 60 giây rồi chạy lại một lần |
| Mọi lần mở Inquiry đều lỗi | Deploy mã M7 khi chưa áp `0014` | `npm run db:migrate:remote -w apps/web` |
| Sửa product đã publish trả 409 | Mã trước M4 chạy trên schema có `0006` | Deploy mã hiện tại |
| Cron không chạy sau deploy | Hết quota cron trigger (tài khoản dùng chung vsnstock) | Owner giải phóng slot, deploy lại |
| Smoke có `warning: ... rate limited (429)` | Chạy smoke dày / song song, hoặc IP chung với lưu lượng khác | Chờ 10 giây, chạy lại một lần; không sửa rule |
| Một route có tiền tố locale 404 ngay sau deploy | Lan truyền | Retry của smoke che; vẫn FAIL thì chờ rồi chạy lại một lần |
| Form POST trả 403 (Origin) | Trang có form gửi `Referrer-Policy: no-referrer` → trình duyệt gửi `Origin: null` | Dùng `same-origin` hoặc `strict-origin-when-cross-origin`, không bao giờ `no-referrer` trên trang có form POST |
| Turnstile không hiện / lỗi CSP trên console | Zone bật Rocket Loader / Web Analytics / Bot Fight Mode | Tắt trên dashboard zone `vnx.si` |
| `npm test` crash "heap out of memory" ở heap nhỏ | Máy hết bộ nhớ commit, `workerd.exe` còn sót | Đóng tiến trình sót, `npm test -w apps/web -- --maxWorkers=2` |
| `apps/web` biến mất sau khi dọn worktree | `rm -rf node_modules` đi theo link workspace | Không dùng `rm -rf`; `git worktree remove` (mục 2.6) |

## 12. Bảo trì runbook và smoke

- Thêm route công khai, đổi CSP / header, đổi `robots.txt` hay sitemap: cập nhật bảng kiểm trong `scripts/smoke-checks.mjs` (và test `scripts/test/smoke-checks.test.mjs`) **trong cùng task**. Review của task đó kiểm việc này.
- Thêm migration hay cron: cập nhật chú thích thứ tự deploy trong `apps/web/wrangler.jsonc` và mục 1 / mục 6 ở đây.
- Thêm secret: thêm tên vào bảng mục 5 (không giá trị).
- Đổi rule rate limit: đổi `WINDOW_MAX` / khoảng nghỉ trong `scripts/smoke-checks.mjs` cho ở dưới một nửa ngưỡng, và mục 6.
- Nâng `wrangler`: chạy lại `npx wrangler <lệnh> --help` cho các lệnh ở mục 3, 5, 9, 10.
- Đổi văn bản Terms hoặc Privacy: "Last updated" theo phiên bản đang hiện (`apps/web/src/legal/select.ts`): bản `current` và Terms trước bảng dùng `LEGAL_UPDATED_AT` (`apps/web/src/legal/content.ts`), bản M7 dùng `PRIVACY_NOTICE_GO_LIVE`, bản có bảng dùng `REQUEST_BOARD_GO_LIVE`. Mọi thay đổi Privacy vào **mọi** phiên bản còn đạt tới được (ba file `docs/legal/privacy*.md`, sáu hằng số), Terms vào hai file và bốn hằng số. Task đó cập nhật ngày mong đợi ở mục 1, mục 4 và mục 11. Task dọn phiên bản Privacy (sau 2026-11-21) cũng vậy.
- Đổi bảng request (EPIC 27): bảng kiểm `--board` và chế độ mặc định ở `scripts/smoke-checks.mjs`; giữ `isRateCovered` khớp phạm vi rule mục 6.
- Mỗi deploy: cập nhật bảng mục 1.
