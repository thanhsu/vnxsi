# VNX-2502 — Báo cáo Implementer

- **Task:** Guard Ops và hợp đồng HTTP (404 kín, `no-store` + `noindex`, robots, parity `ops.*`).
- **Handoff:** `.ai/tasks/VNX-2502-handoff.md`. **Plan:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md` (VNX-2502, "Hợp đồng 404 kín").
- **Nhánh:** `feat/ops-o1` (worktree `.claude/worktrees/agent-a26fce7bca484621a`), gốc `ddbc11c`. Không push, không merge, không deploy.
- **Ngày:** 2026-10-05

## Commit

| SHA | Nội dung |
|---|---|
| `ed1917b` | `test: Ops guard, sealed 404 and HTTP contract (VNX-2502)`: test viết trước, đỏ (`Cannot find module '../../src/auth/ops.ts'`, `findOpsAccess is not a function`, robots thiếu `Disallow: /ops`) |
| `fc31d65` | `feat(web): Ops guard with sealed 404, no-store and noindex (VNX-2502)` |
| `e51ddb0` | `test: no-store and noindex on Origin and body-size refusals under /ops (VNX-2502)`: test thêm, đỏ (`expected null to be 'no-store'`) |
| `001a733` | `fix(web): register opsHeaders before the Origin and body-size checks (VNX-2502)` |
| (commit báo cáo này) | `docs: VNX-2502 implementer report` |

## File

Đúng danh sách handoff, không file nào khác:

- Mới: `apps/web/src/auth/ops.ts`, `apps/web/test/ops/guard.test.ts`.
- Sửa: `apps/web/src/app.ts`, `apps/web/src/env.ts`, `apps/web/src/db/ops-members.ts`, `apps/web/src/http/no-store.ts`, `apps/web/src/views/seo.ts`, `apps/web/test/i18n/parity.test.ts`, `apps/web/test/seo/robots.test.ts`, `apps/web/test/db/ops-members.test.ts`.

`git diff --stat ddbc11c..001a733`: 10 file, +505 / −8 (code `src/` +86 / −1).

## Đã làm

1. **`db/ops-members.ts`:** `findOpsAccess(db, userId)` đọc `users.status`, `users.email`, `ops_members.role` trong **một** truy vấn (`users LEFT JOIN ops_members`), không cache; trả `null` khi không có user. Chỉ đọc. Kiểu `OpsAccess { userStatus, email, memberRole }` khớp đầu vào `resolveRole`.
2. **`auth/ops.ts`:**
   - `opsNotFound(c)`: hàm duy nhất tạo 404 cho mọi từ chối ở `/ops`: trang 404 tiếng Anh có sẵn (`ErrorPage`, `kind: "notFound"`, locale `en`), status 404.
   - `resolveOpsRole(env, user)`: `findOpsAccess` + `resolveRole` (VNX-2501) với `adminEmails(env)`. Không dùng `users.is_admin`.
   - `requireOps(capability)`: chưa đăng nhập, user không tồn tại / không `active`, không vai trò, thiếu capability → `opsNotFound(c)`. Không redirect, không 403. Đặt `opsRole` vào context.
   - `opsHeaders`: sau `next()` đặt `Cache-Control: no-store` và `X-Robots-Tag: noindex, nofollow` cho mọi response.
3. **`env.ts`:** thêm `opsRole: OpsRole` vào `AppEnv["Variables"]`.
4. **`app.ts`:** `opsHeaders` cho `/ops` và `/ops/*` (xem sai khác 2 về vị trí); `app.all("/ops")` và `app.all("/ops/*")` trả `opsNotFound`, đăng ký sau cùng trong nhóm route (sau route admin, trước `/api`). Thứ tự middleware hiện có giữ nguyên.
5. **`http/no-store.ts`:** `ops` vào nhóm private.
6. **`views/seo.ts`:** `Disallow: /ops` (không tiền tố locale; quy tắc tiền tố của robots phủ cả `/ops/`).
7. **`test/i18n/parity.test.ts`:** quy tắc parity viết thành hàm `parityProblems(base, messages)`: khóa `ops.*` không bắt buộc ngoài EN và **bị cấm** ngoài EN; khóa khác giữ nguyên (thiếu, thừa, rỗng, khác placeholder → lỗi). Thêm test cho chính quy tắc trên dữ liệu giả.
8. **`test/ops/guard.test.ts`:** app Hono nhỏ trong file test, chép chuỗi middleware thật, gắn `requireOps` vào route giả (`/ops/fake` GET `marketplace.view`, POST `marketplace.act`, `/ops/fake/team` `team.manage`, redirect 303, 409, ném lỗi 500), cùng catch-all `opsNotFound`; kèm kiểm trên app thật (`createApp()`) cho `/ops`, `/ops/`, đường dẫn không tồn tại, POST, header.

## Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1: 5 trường hợp cùng status 404, cùng body (bỏ request id) | Đạt | `guard.test.ts` "answers the five denials with the same status, headers and body": tham chiếu là app thật `/ops/khong-ton-tai` (ẩn danh); so **status, toàn bộ header và body** (request id truyền qua `cf-ray` rồi xóa khỏi body) với: ẩn danh; Owner gốc trong `ADMIN_EMAILS` bị `suspended` (session không còn hợp lệ); cùng user đó qua session "cũ" giả (guard tự đọc `status`); đăng nhập không vai trò; Content thiếu `marketplace.view`; Owner gốc trên `/ops/khong-ton-tai/con`. Thêm: POST giả mạo (viewer, không vai trò, ẩn danh, POST app thật) cùng 404; `opsNotFound` cho hai đường dẫn khác nhau ra cùng body. |
| AC2: vai trò đủ capability đi qua; Owner gốc; member; đọc lại mỗi request | Đạt | "lets the root Owner from ADMIN_EMAILS through…" (không member row, không `is_admin`; bỏ email khỏi `ADMIN_EMAILS` → 404 ngay request sau); "lets members through by the capability matrix" (Operator/Viewer/Content); "reads the role again on every request" (xóa member giữa hai request → 404; hạ Operator → Viewer → POST 404, GET 200); "suspension removes Ops at once and unsuspension restores it"; "ignores users.is_admin". DB: 3 test `findOpsAccess` trong `test/db/ops-members.test.ts`. |
| AC3: mọi response `/ops`, `/ops/*` có `no-store` + `noindex, nofollow` | Đạt | "marks 200, 303, 404, 409 and 500 from guarded routes"; "marks the real app's /ops, /ops/ and any path below, signed in or not" (GET/POST); "marks the refusals of the site-wide checks…: Origin (403) and body size (413)"; "noStorePrivate also counts /ops as private"; `/opsx` không bị gắn. Trang 404 có `<meta name="robots" content="noindex"/>`. |
| AC4: không redirect `/login`, không 403 ở `/ops` | Đạt (xem câu hỏi mở 2) | "never sends anyone to /login and never answers 403": app thật và app test, 4 đường dẫn × 5 kiểu request (ẩn danh, không vai trò, viewer GET/POST, POST ẩn danh): không 401/403, không header `Location`. |
| AC5: `robots.txt` có `Disallow: /ops` | Đạt | `test/seo/robots.test.ts`: có `Disallow: /ops`, không có dòng `/vi/ops`, `/zh-hans/ops`, `/zh-hant/ops`. |
| AC6: parity: `ops.*` chỉ ở `en.ts` | Đạt | `test/i18n/parity.test.ts`: ba locale thật không có lỗi; "refuses an ops.* key outside EN" (đỏ khi file khác có `ops.*`); "still refuses a missing, extra, empty or differently templated key outside ops.*". |
| AC7: typecheck + toàn bộ test | Đạt (kèm timeout ngẫu nhiên, xem dưới) | Xem "Kết quả kiểm tra". |

Không có style/script nội tuyến: test "is the English 404 page…" kiểm body 404 không có `style=` và không có `<script>` không `src`; test quét trang CSP hiện có vẫn xanh trong lần chạy toàn bộ.

Kiểm đột biến (thủ công, đã hoàn nguyên): cho `opsNotFound` dùng đường dẫn thật làm `rest`, và bỏ `X-Robots-Tag` cho 500 → 5 test của `guard.test.ts` đỏ.

## Kết quả kiểm tra

`npm run typecheck -w apps/web` → exit 0 (chỉ in nhắc `wrangler types`, không lỗi).

Các file của task, chạy riêng:

```
npx vitest run test/ops/guard.test.ts test/http   →  Test Files  10 passed (10) / Tests  55 passed (55)
npx vitest run test/ops/guard.test.ts test/i18n/parity.test.ts test/seo/robots.test.ts test/db/ops-members.test.ts
 Test Files  4 passed (4)
      Tests  36 passed (36)
```

(36 test trước khi thêm test 413/403.) Sau commit cuối, cùng các file của task + test kiến trúc + `test/http`:

```
npx vitest run --configLoader runner test/ops/guard.test.ts test/i18n/parity.test.ts test/seo/robots.test.ts test/db/ops-members.test.ts test/architecture.test.ts test/http
 Test Files  14 passed (14)
      Tests  88 passed (88)
```

`guard.test.ts` có 15 test.

`npm test` (toàn bộ, máy dùng chung, nhiều phiên chạy song song):

```
 Test Files  4 failed | 125 passed (129)
      Tests  4 failed | 1315 passed (1319)
(4 lỗi, cả 4 đều "Error: Test timed out in 5000ms.":)
 FAIL  test/admin/suspend-requests.test.ts > suspending a user ends their open requests (M6 review F7) > removes a matching request …
 FAIL  test/contact/submit.test.ts > POST /contact from the landing form, signed out (VNX-0710 F1) > the landing form carries the widget, …
 FAIL  test/hub/media-disabled.test.ts > running without R2 (VNX-0711) > AC3: with R2 bound, the Demo step keeps the upload form and no notice
 FAIL  test/hub/portfolio.test.ts > Hub portfolio (spec §5.3) > blocks changes while suspended (409)
```

Chạy lại riêng 4 file đó:

```
npx vitest run --configLoader runner test/admin/suspend-requests.test.ts test/contact/submit.test.ts test/hub/media-disabled.test.ts test/hub/portfolio.test.ts
 Test Files  4 passed (4)
      Tests  36 passed (36)
```

(`--configLoader runner` chỉ để Vite không ghi file config tạm xuống ổ `D:` đang đầy; lần chạy lại không có cờ này dừng ở `ENOSPC` trước khi chạy test nào.) Toàn bộ test của task (`guard.test.ts`, parity, robots, `db/ops-members`) xanh trong lần chạy toàn bộ.

Mốc trước khi làm (baseline `ddbc11c`, cùng máy): `Test Files 10 failed | 118 passed (128)`, `Tests 12 failed | 1286 passed (1298)`, toàn bộ là `Test timed out in 5000ms` ở file không liên quan.

## Sai khác so với handoff (kèm lý do)

1. **`opsNotFound` không gọi `errorResponse(c, "notFound", 404)` mà render thẳng cùng `ErrorPage` (locale `en`, `kind: "notFound"`) với `rest: "/"`.** `errorResponse` lấy `rest` từ URL, và `Layout` in liên kết ngôn ngữ theo `rest` (`/vi/ops/khong-ton-tai`, ...). Khi đó body khác nhau theo đường dẫn (vỡ AC1 cho trường hợp "đường dẫn không tồn tại") và body lộ chữ `/ops` (trái spec §5 "không nói trang Ops tồn tại"). Vẫn là trang 404 tiếng Anh có sẵn; không sửa `error-response.tsx` (ngoài danh sách). Gọi `ErrorPage({...})` như hàm thay vì JSX để giữ tên file `auth/ops.ts` như plan.
2. **`opsHeaders` đăng ký ngay sau `securityHeaders`** (trước `localeMiddleware`), không sau `noStorePrivate`. Lý do: `originCheck` (403) và `requestBodyLimit` (413) trả response trước mọi route; đặt sau thì các response này ở `/ops` thiếu `no-store`/`noindex` (spec §5: "mọi response của `/ops`"). Thứ tự các middleware toàn site không đổi; `opsHeaders` chỉ chạy cho `/ops`, `/ops/*`. Có test riêng (`e51ddb0` đỏ → `001a733` xanh).
3. **Thêm export ngoài mô tả:** `resolveOpsRole` (plan gọi tên hàm này; VNX-2503 cần vai trò cho layout), `OpsAccess`, `findOpsAccess` (tên do Implementer chọn).
4. **Parity:** quy tắc nằm trong file test (hàm `parityProblems`), nên test tự kiểm quy tắc xanh ngay từ đầu (không có giai đoạn đỏ như các test khác). Chưa có khóa `ops.*` thật nên AC6 "đỏ khi file khác có `ops.*`" được chứng minh trên dữ liệu giả.
5. **App test chép chuỗi middleware của `createApp()`** (không thêm route giả vào `src/` theo handoff). Rủi ro lệch nếu `app.ts` đổi thứ tự sau này; các kiểm quan trọng (404 tham chiếu, header, POST) đồng thời chạy trên app thật.

## Câu hỏi mở / nghĩa vụ cho task sau

1. **Kiểu `Messages` (VNX-2503):** `src/i18n/messages/en.ts` khai báo `Messages = Record<MessageKey, string>` và `vi.ts`, `zh-*.ts` có kiểu `Messages`. Khi `en.ts` thêm khóa `ops.*`, typecheck sẽ buộc ba file kia có cùng khóa, trái ADR-010 §1. VNX-2503 cần đổi kiểu (ví dụ `Record<Exclude<MessageKey, \`ops.${string}\`>, string>` cho locale khác EN, và `CATALOG` trong `t.ts` dùng fallback EN). Không sửa ở task này (file ngoài danh sách).
2. **POST khác origin tới `/ops/*` nhận 403 `Forbidden` của `originCheck`.** Đây là kiểm Origin toàn site, chạy trước guard, giống hệt cho mọi đường dẫn (test so `/ops/marketplace/builders` với `/khong-ton-tai`: cùng status, cùng body), nên không lộ `/ops`; nay có `no-store` + `noindex`. Spec §5 yêu cầu giữ Origin check. Đề nghị Reviewer/Owner xác nhận chấp nhận 403 này (AC4 hiểu là "guard Ops không trả 403").
3. **`/vi/ops`, `/zh-hans/ops`, `/zh-hant/ops`:** hiện đi vào 404 bản địa hóa chung (không qua `opsHeaders`, không bị chặn trong robots). Spec không tạo Ops có tiền tố locale; nếu muốn cùng hợp đồng (404 kín + header) cho các biến thể này thì cần quyết định (có thể gộp vào VNX-2508).
4. `getSessionUser` đã loại user không `active`, nên user bị khóa vốn mất session; kiểm `status` trong guard là lớp thứ hai (test bằng session "cũ" giả).
5. **Ghi nhận môi trường:** trong lúc làm, ổ `D:` đầy (`ENOSPC`, 0 byte trống) do tiến trình khác trên máy dùng chung; lần chạy lại riêng các file timeout đầu tiên không khởi động được vì lỗi này.
