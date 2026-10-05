# VNX-2503 — Báo cáo Implementer

- **Task:** khung Ops (`OpsLayout`, registry menu) và trang `/ops` Overview; F1 của review VNX-2502 (khóa `ops.*` chỉ ở EN).
- **Nhánh:** `feat/ops-o1` (worktree riêng), cắt từ `baae20a`. Không push, không merge, không deploy.
- **Handoff:** `.ai/tasks/VNX-2503-handoff.md`. **Plan:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md` (VNX-2503, "Overview (O1)").

## Commit

| SHA | Nội dung |
|---|---|
| `e7ac353` | `test:` test layout, overview, parity `ops.*`, CSP trên `/ops`; chỉnh kỳ vọng guard cho `GET /ops` (commit trước khi có code, đã xác nhận đỏ: 13 test hỏng, `layout.test.ts` không import được `src/ops/menu.ts`) |
| `114abab` | `feat(web):` khóa `ops.*` chỉ ở `en.ts`; kiểu catalogue không phải EN loại `ops.*`; `t()` đọc `ops.*` từ EN |
| `750b494` | `feat(web):` shell Ops, registry menu, `/ops` Overview (5 hàng chờ + hoạt động gần đây), CSS `.ops-*`, hàm đọc ở các module sở hữu bảng |
| `113637a` | `fix(web):` ô bảng không xuống dòng; bảng cuộn ngang trên màn hẹp (phát hiện khi chụp 390 px) |

## File

Mới: `src/ops/menu.ts`, `src/routes/ops.tsx`, `src/views/ops/OpsLayout.tsx`, `src/views/ops/OverviewPage.tsx`, `test/ops/layout.test.ts`, `test/ops/overview.test.ts`.

Sửa: `src/app.ts` (một dòng `registerOpsRoutes(app)` trước route bắt cuối `/ops`; thứ tự middleware không đổi), `src/i18n/messages/en.ts`, `src/i18n/t.ts`, `public/assets/app.css` (khối `.ops-*` ở cuối file), `src/db/{builders,products,feedback,requests,inquiries,audit}.ts` (chỉ thêm hàm đọc), `test/i18n/parity.test.ts`.

Ngoài danh sách (xem "Sai khác"): `test/ops/guard.test.ts`, `test/http/security-headers.test.ts`. Không đụng `vi.ts`, `zh-hans.ts`, `zh-hant.ts`: chúng đã dùng kiểu `Messages`, kiểu này giờ loại `ops.*` nên không cần sửa file.

## Triển khai

- **i18n (F1):** `OpsMessageKey = Extract<MessageKey, \`ops.${string}\`>`, `Messages = Record<Exclude<MessageKey, OpsMessageKey>, string>`, `isOpsKey()`. `t()` đọc `ops.*` từ `en` với mọi locale. Thêm khóa `ops.*` vào vi/zh là lỗi kiểu (excess property), có `@ts-expect-error` trong `parity.test.ts`.
- **Registry (`src/ops/menu.ts`, thuần):** `OPS_GROUPS` (thứ tự nhóm, nhóm `main` không heading), `OPS_MENU` chỉ có Overview (`/ops`, `overview.view`). `reachable(role, path, capability, isRegistered)` = route GET đã đăng ký **và** `can(role, capability)`. `visibleMenu()` bỏ nhóm rỗng cùng heading. `isRegistered` lấy từ `app.routes` (GET), đọc một lần ở request đầu, nên khi VNX-2504… đăng ký route thật thì mục menu và link hàng chờ tự hiện, không có link chết trước đó.
- **`OpsLayout`:** `<html lang="en">`, `meta robots noindex, nofollow`, title `"{page} · VNX.SI Ops"`, không canonical/hreflang, không header/footer công khai. Thanh bên 240 px (BrandMark của `Layout.tsx` + nhãn OPS), thanh trên: breadcrumb (`nav aria-label="Breadcrumb"`), nhãn môi trường, vai trò, email, form POST `/logout`. Dưới 1024 px: thanh bên ẩn, thay bằng `<details class="ops-menu">` (không JS) chứa cùng danh sách + vai trò/email/sign out; nút 44×44. Skip link tới `#ops-main`. Không preload font nào ngoài Be Vietnam Pro 400.
- **Nhãn môi trường:** `opsEnvironment()` trong `routes/ops.tsx`: `PRODUCTION` khi `new URL(APP_ORIGIN).hostname === "vnx.si"`, còn lại (kể cả giá trị không parse được) `LOCAL`.
- **Overview:** route `GET /ops`, `requireOps("overview.view")`. 5 truy vấn `COUNT(*)` + `MIN(...)`, mỗi truy vấn chạy riêng qua `Promise.allSettled` (không gom `db.batch`, vì một lỗi trong batch sẽ làm hỏng cả 5 hàng; handoff cho phép "nếu tiện"). Hàng lỗi → `data-state="error"`, chữ lỗi + icon, không có số, có log `ops.overview.queue_failed` (kèm requestId).
  - Builder: `status = 'pending'`, `MIN(created_at)` (cùng thứ tự hàng duyệt hiện có).
  - Product: `status = 'in_review'`, `MIN(updated_at)` (product `in_review` chỉ đọc, nên `updated_at` = lúc gửi duyệt; cùng thứ tự hàng duyệt hiện có).
  - Feedback: `status = 'new'`, `MIN(created_at)`, `SUM(notified_at IS NULL)` → "N e-mail(s) not sent yet".
  - Request: `status = 'submitted'`, `MIN(COALESCE(submitted_at, created_at))` (cùng thứ tự `listRequestsForAdmin`).
  - Inquiry quá hạn: `status = 'open'` (builder chưa trả lời) và `opened_at < now − REMIND_AFTER_MS` (hằng M5 dùng cho cron nhắc), `MIN(opened_at)`.
  - Số 0 → số 0 màu muted + "Nothing waiting" (`data-state="zero"`), không tuổi. Tuổi: "N days / hours / minutes", làm tròn xuống.
  - "Counts read at `<time>`HH:MM`</time>` UTC · refresh the page to update".
  - Content (`overview.detail` = false): route không truyền tuổi, dòng e-mail chưa gửi, link; không có mục Recent activity.
- **Recent activity** (`listRecentAudit` trong `db/audit.ts`): 10 dòng mới nhất (`created_at DESC, id DESC`), chỉ chọn `id, created_at, actor_user_id, action, entity, entity_id` + email actor + actor có trong `ops_members` hay không; không chọn `data`. Actor: null → `system`; email chỉ khi actor là thành viên Ops hoặc email trong `ADMIN_EMAILS`; người khác → user ID. ID dài rút gọn như mockup (`01J9…X2KQ`), giá trị đầy đủ ở `title`. Không link chi tiết, không link Audit log (route chưa có). Truy vấn lỗi → trạng thái lỗi; rỗng → "No activity recorded yet.".
- **CSS:** token VNX có sẵn (màu sáng/tối, `--r-*`, font tự host), hover + `focus-visible`, không animation. Không thuộc tính `style`, không `<style>`/`<script>` trong HTML.

## Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 `ops.*` chỉ ở EN; typecheck không đòi vi/zh | Đạt | `npm run typecheck -w apps/web` exit 0; `test/i18n/parity.test.ts` (parity cũ + 2 test mới: có khóa `ops.*` trong EN, `@ts-expect-error` khi thêm vào catalogue khác, `t(locale, "ops.*")` trả EN cho 4 locale) |
| AC2 thanh bên chỉ mục có route + quyền | Đạt | `test/ops/layout.test.ts`: test thuần `visibleMenu`/`reachable` (route chưa đăng ký bị ẩn, thiếu capability bị ẩn, nhóm rỗng không heading); trên app thật 4 vai trò chỉ thấy Overview, mọi `href` trong body chỉ là `/ops` hoặc `#ops-main` |
| AC3 4 vai trò 200; ẩn danh/không vai trò/bị khóa → 404 kín | Đạt | `test/ops/overview.test.ts` "who can open /ops": 200 + `no-store` + `noindex` cho 4 vai trò; ẩn danh, không vai trò, bị khóa, POST `/ops` của Owner → cùng status, header, body với `/ops/khong-ton-tai` (trừ request id) |
| AC4 đếm đúng; 0 → "Nothing waiting"; lỗi → trạng thái lỗi | Đạt | `overview.test.ts` "queues": dữ liệu có cả hàng không được tính (builder approved/rejected, product draft, feedback handled, request pending_verification, inquiry open mới và answered cũ); số, tuổi, dòng e-mail số ít/số nhiều; `failingDb(/FROM feedback/)` → hàng feedback lỗi, không số, hàng khác vẫn đếm |
| AC5 Content chỉ số và nhãn | Đạt | `overview.test.ts` "Content sees counts and labels only": không "Oldest waiting", không "not sent yet", không `href`, không bảng, không ID, không email |
| AC6 Recent activity an toàn | Đạt | `overview.test.ts` "recent activity": đúng 10 dòng mới nhất, header bảng, email cho Owner gốc và thành viên Ops, user ID cho người ngoài (email của họ không xuất hiện), `system` cho actor null, `data` (chuỗi bí mật, email riêng) không xuất hiện, không link; truy vấn lỗi → thông báo lỗi; rỗng → empty state |
| AC7 không inline, noindex, `lang="en"` | Đạt | `layout.test.ts` (4 vai trò: không `style=`, `<style`, `on*=`, `<script`; meta robots; `lang="en"`; Referrer-Policy không phải `no-referrer` trên trang có form POST); test CSP VNX-0803 trong `test/http/security-headers.test.ts` thêm một case `/ops` đăng nhập Owner |
| AC8 toàn bộ test + typecheck xanh | Đạt | Xem dưới |
| AC9 giống mockup 1280/1440/390 | Chờ Reviewer | Ảnh chụp headless Chrome (dữ liệu mẫu chỉ ở D1 local) đặt trong scratchpad của phiên: `ops-1280.png`, `ops-1440.png`, `ops-390.png`, `ops-390-menu.png`, `ops-1280-dark.png`, `ops-390-dark.png` (thư mục `C:\Users\User\AppData\Local\Temp\claude\d--DOCS-SUPHAM-GIT-vnxsi\dd9ecbbc-7b18-4ee6-882b-eeabea10ab67\scratchpad\`). Ảnh 390 px chụp bằng viewport mobile thật qua CDP, không dùng iframe (CSP `frame-ancestors 'none'` chặn iframe) |

## Kết quả lệnh

Baseline (trước khi sửa, `baae20a`): typecheck exit 0; `npm test` 129 file, 1319/1319 pass.

Sau khi làm (lần chạy đầy đủ thứ nhất, `750b494`): 131 file, 1341/1344; 3 test hết giờ 5 s do máy tải (`test/admin/requests.test.ts` "a suspended builder's stale proposal…", `test/ops/overview.test.ts` "answers 200 for the four roles", `test/public/inquiry-form.test.ts` "shows Buy, Customize…"). Chạy riêng 3 file: 3 file, 44/44 pass.

Cuối cùng (`113637a`):

```
$ npm run typecheck -w apps/web
typecheck exit=0
$ npm test
 Test Files  131 passed (131)
      Tests  1344 passed (1344)
   Duration  155.96s
```

## Sai khác và lý do

1. **`test/ops/guard.test.ts` (ngoài danh sách):** test VNX-2502 "marks the real app's /ops, /ops/ and any path below" kỳ vọng `GET /ops` của Owner là 404, vì lúc đó chưa có trang. Đổi thành 200 riêng cho `GET /ops` đã đăng nhập; mọi trường hợp khác giữ 404 và vẫn kiểm `no-store` + `noindex`. Không đổi gì khác.
2. **`test/http/security-headers.test.ts` (ngoài danh sách):** thêm một case để test quét CSP của VNX-0803 phủ `/ops` khi đã đăng nhập (trang `/ops` ẩn danh chỉ là 404). Các case cũ không đổi.
3. **Không gom 5 truy vấn bằng `db.batch`:** để mỗi hàng lỗi độc lập (yêu cầu "truy vấn lỗi → hàng đó hiện trạng thái lỗi").
4. **Cột "tuổi" theo từng bảng** (chi tiết ở trên), không phải `created_at` cho mọi bảng như câu tổng quát trong plan: `created_at` của product/request là lúc tạo nháp, không phải lúc bắt đầu chờ. Chọn cột trùng thứ tự hàng đợi admin hiện có.
5. **Inquiry quá hạn** dùng luật thời gian của cron nhắc (`open`, `opened_at < now − REMIND_AFTER_MS`) nhưng không lấy hai điều kiện chỉ dành cho việc gửi mail của `listInquiriesToRemind` (`builder_reminded_at IS NULL`, builder `approved`): một inquiry đã được nhắc mà vẫn chưa trả lời vẫn quá hạn.
6. **So với mockup:** không có dòng "SAMPLE DATA · PROTOTYPE" (không có dữ liệu giả trên giao diện); lead chỉ "What needs attention now." (bỏ "Counts link to the queue." vì chưa có link); không tô màu cảnh báo cho tuổi "2 days" (mockup có), vì không có mốc nghiệp vụ nào cho ngưỡng đó; số 0 dùng `--muted` (#5B6475) thay #9AA5B8 của mockup để đạt tương phản ≥ 3:1; nhãn môi trường giữ "PRODUCTION" cả trên mobile (mockup ghi "PROD"); chân bảng "Latest N entries" không có link "Open audit log →" (route chưa có); số đếm cạnh mục menu con của mockup không áp dụng (chưa có mục con). Thời gian trong bảng: HH:MM nếu cùng ngày UTC, ngược lại kèm ngày.
7. Radius thẻ dùng token `--r-lg` (14 px) thay 12 px của mockup; nền header bảng dùng `--bg`.

## Câu hỏi mở / ghi nhận

- `wrangler.jsonc` đặt `APP_ORIGIN = https://vnx.si` cho mọi môi trường, nên `wrangler dev` cũng hiện **PRODUCTION** trừ khi `.dev.vars` đặt `APP_ORIGIN` (ví dụ `http://localhost:8787`). Đúng luật handoff; Owner/Reviewer có thể muốn ghi chú điều này cho dev local.
- Màn hình hẹp hiển thị nhãn môi trường đầy đủ ("PRODUCTION"); nếu muốn đúng "PROD" như mockup thì cần thêm một khóa i18n rút gọn.
- Sau khi chụp ảnh: đã dừng `wrangler dev` (cổng 8795) và workerd con của nó, đã xóa thư mục profile Chrome tạo ra. Không đụng tiến trình nào trên cổng 8787. Dữ liệu mẫu chỉ nằm trong D1 local của worktree (`apps/web/.wrangler`, không theo dõi bởi git).
