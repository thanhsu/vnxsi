# VNX-2504a — Báo cáo Implementer

- **Task:** hàng đợi Ops Builders và Products dưới `/ops/marketplace/*` (handoff `.ai/tasks/VNX-2504a-handoff.md`).
- **Nhánh:** `feat/ops-o1` (worktree riêng), cắt từ `49da061`. Không push, không merge, không deploy.
- **Kết quả:** **chỉ làm phần Builders, dừng trước Products** theo luật dừng của handoff ("diff dự kiến > ~600 dòng thì dừng và báo để tách tiếp"). Riêng Builders cùng phần dùng chung đã là **+626 / −37** dòng (không tính test và locale). Products sẽ cộng thêm khoảng 300–350 dòng. Đề nghị tách: **2504a = Builders** (báo cáo này), **2504a2 = Products** (dùng lại `views/ops/parts.tsx`, `listEntityAudit`, menu có số đếm, CSS `.ops-*` đã có).

## Commit

| SHA | Nội dung |
|---|---|
| `d42a80d` | `test:` test Builders (`test/ops/marketplace-builders.test.ts`); cập nhật `layout.test.ts`, `overview.test.ts`, case CSP trong `security-headers.test.ts`. Commit trước code. Đã xác nhận đỏ trên mã nguồn ở HEAD: 19 test hỏng / 64 (5 file) |
| `e3c29ce` | `test:` sửa helper `actionForms` (đang gọi `mainOf` hai lần nên luôn trả `[]`, làm test Viewer "không có form" đạt sai); `guard.test.ts`: `GET /ops/marketplace/builders` đã đăng nhập giờ là trang 200 |
| `bb31d3b` | `feat(web):` hàng đợi Builders: danh sách, chi tiết, hành động, menu, link thẻ Overview |
| `330dd0b` | `fix(web):` cột Status đưa lên thứ hai để vẫn thấy ở 390 px; khoảng cách link quay lại; nhãn "Website" (phát hiện khi chụp ảnh) |

## File

Mới: `src/routes/ops-marketplace.tsx`, `src/views/ops/BuildersPages.tsx` (danh sách + chi tiết), `src/views/ops/parts.tsx` (tabs, ô tìm kiếm, pill trạng thái, thông báo, xác nhận `<details>`, ô lý do, History), `test/ops/marketplace-builders.test.ts`.

Sửa: `src/routes/admin.tsx` (chỉ tách `decideBuilder`), `src/app.ts` (một dòng đăng ký route, trước route bắt cuối `/ops`; thứ tự middleware không đổi), `src/ops/menu.ts`, `src/routes/ops.tsx`, `src/views/ops/OpsLayout.tsx`, `src/views/ops/OverviewPage.tsx` (chỉ `export` `ActorCell`, `AlertIcon`), `src/db/builders.ts`, `src/db/audit.ts` (chỉ thêm hàm đọc), `src/i18n/messages/en.ts`, `public/assets/app.css`.

Ngoài danh sách (xem "Sai khác"): `test/ops/guard.test.ts`, `test/ops/layout.test.ts`, `test/ops/overview.test.ts`, `test/http/security-headers.test.ts`. Không đụng `src/routes/admin-products.tsx`.

## Triển khai

- **Route** (`ops-marketplace.tsx`): `GET /ops/marketplace/builders` và `GET /ops/marketplace/builders/:userId` qua `requireOps("marketplace.view")`; `POST …/:userId/{approve,reject,suspend,unsuspend}` qua `requireOps("marketplace.act")`. Builder không tồn tại → `opsNotFound` (404 kín, cả GET lẫn POST).
- **Dùng lại logic:** `decideBuilder(c, action)` trong `admin.tsx` giữ nguyên toàn bộ phần kiểm tra lý do, `transition`, compare-and-set `setBuilderStatus`, `writeAudit` (`builder.<action>`, `{from,to,reason}`), hết hạn invite khi suspend, gửi e-mail approve/reject. Hàm trả về kết quả (`not_found` / `invalid_reason` / `conflict` / `done`); `decide` của `/admin` đổi kết quả đó ra đúng các response cũ (404, trang admin 400, 409, 303 `/admin/builders/:id?done=…`). Test `/admin` xanh không cần sửa.
- **Trả lời Ops:** thành công → 303 `/ops/marketplace/builders/:id?status=…&q=…&done=1|mail_failed` (bộ lọc đi theo form action). Lý do sai → render lại trang chi tiết Ops 400, `<details>` mở sẵn, lỗi gắn `aria-describedby`. Chuyển trạng thái không hợp lệ hoặc thua compare-and-set → đọc lại builder, render trang chi tiết Ops 409 với thông báo "The status changed before your action, so nothing was saved".
- **Danh sách:** tab 4 trạng thái có số (`countBuildersByStatus`, `GROUP BY status`), mặc định `pending`; `?status=` ngoài allowlist bị bỏ qua. Tìm kiếm `?q=` (trim, 1–100 ký tự, dài hơn thì bỏ qua) trên tên, handle, e-mail bằng `instr(lower(…), ?)`, nên `%`/`_` là chữ thường, không phải wildcard. Thứ tự và giới hạn 200 dòng như `listBuildersByStatus`. **Không phân trang** (truy vấn hiện có không hỗ trợ); chân bảng ghi "N of TOTAL", khi có tìm kiếm thì "N shown". Tab và link dòng giữ `q`.
- **Chi tiết:** mockup đặt danh sách và chi tiết cạnh nhau; ở đây chi tiết là trang riêng (handoff cho phép): link "← Builders" giữ bộ lọc, tiêu đề + pill trạng thái, hai cột ≥ 1024 px (Profile | Decision + History), xếp chồng dưới 1024 px. Approve và Unsuspend là nút POST trực tiếp; Reject (lý do bắt buộc) và Suspend (lý do tùy chọn) nằm trong `<details class="ops-confirm">`, không có JS. Viewer: khung Decision chỉ có dòng "Your role can view this page but not change it.", không form, không nút.
- **History:** `listEntityAudit(db, "builder", userId, 50)` dùng chung projection với `listRecentAudit` (đã tách `LISTING_SELECT`/`toListing`): thời điểm, action, actor; không chọn `data`. Actor theo luật của VNX-2503 (`actorOf`, nay được export): e-mail chỉ cho Owner gốc / thành viên Ops, người khác hiện ID, null → `system`. Đọc lỗi → trạng thái lỗi; rỗng → "No audit entries for this builder yet." Dùng index có sẵn `idx_audit_entity`.
- **Menu:** `OPS_MENU` có thêm Marketplace › Builders (`marketplace.view`, icon theo mockup, `count: "builders"`). `opsShell` giờ là async: đọc số chờ của mục hiển thị có số (dùng lại `countBuilderReviewQueue` của Overview) qua `Promise.allSettled`; đọc lỗi thì bỏ số, không hiện 0, có log `ops.menu.count_failed`. Số 0 không hiện. Có chữ ẩn "waiting:" cho trình đọc màn hình. Breadcrumb: `OpsLayout` nhận `trail` (Ops / Marketplace / Builders / tên). Thẻ Overview "Builders to review" tự có link "Open queue →" vì route đã đăng ký.
- **Nhãn trạng thái:** khóa riêng `ops.builders.status.*` (Pending, Approved, Rejected, Suspended); nhãn trong `labels.ts` là chữ cho builder ("Pending review", "Changes requested" cho rejected), không hợp cho Ops.
- **CSS:** khối `.ops-*` mới ở cuối `app.css` (tabs, ô tìm kiếm, pill, nút primary/danger, thông báo, split, danh sách mô tả, xác nhận, timeline), dùng token sáng/tối có sẵn (pill vàng/đỏ dùng `color-mix` với `--warning`/`--error`). Không thuộc tính `style`, không `<style>`/`<script>`.

## Tiêu chí chấp nhận

AC chỉ áp dụng cho phần Builders; mọi phần Products **chưa làm**.

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 Owner/Operator thao tác như admin cũ | Đạt (Builders) | `marketplace-builders.test.ts` "detail and actions": Owner approve (status, e-mail tiếng Việt cùng subject/link như test admin, dòng audit actor + `{from,to,reason}`), Operator reject (400 khi thiếu lý do, không ghi gì; có lý do → rejected + review note + e-mail), suspend/unsuspend (audit `builder.suspend`, `builder.unsuspend`, không e-mail), 409, e-mail lỗi → `done=mail_failed` và thông báo, POST khác Origin → 403 không đổi gì |
| AC2 Viewer xem được, không form; POST Viewer/Content → 404, không ghi gì | Đạt | "answers 200 to the Owner, an Operator and a Viewer"; "shows the profile and, for a Viewer, no form and no action button"; "refuses every POST from a Viewer or Content": 4 hành động × 2 vai trò → 404, trạng thái giữ, 0 dòng audit, 0 e-mail |
| AC3 Content 404 kín | Đạt | "gives Content, the anonymous and a role-less user the sealed 404": status, header, body giống `/ops/khong-ton-tai` (trừ request id) cho danh sách và chi tiết |
| AC4 lọc và tìm qua URL, giá trị lạ bỏ qua | Đạt | "list: status tabs and search in the URL": số trên tab bằng `COUNT(*)` của từng trạng thái, `?status=deleted` → Pending, tìm theo tên (không phân biệt hoa thường), handle, e-mail, `q` giữ trong tab và link dòng, `%` không khớp tất cả, `q` 101 ký tự bị bỏ qua |
| AC5 History theo projection an toàn | Đạt | "history": chỉ dòng của builder này, mới nhất trước, e-mail Owner gốc, ID cho người ngoài Ops (e-mail của họ không xuất hiện), không có `data` (chuỗi riêng không xuất hiện), lý do reject chỉ xuất hiện một lần (từ review note, không từ audit); trạng thái rỗng |
| AC6 `/admin` chạy như trước | Đạt | `npx vitest run test/admin …`: các file `test/admin/*` xanh, không sửa test admin |
| AC7 Menu cho Owner/Operator/Viewer, không Content; thẻ Overview có link | Đạt (Builders) | `layout.test.ts` (registry có Builders; trên `/ops` 3 vai trò thấy Overview + Builders cùng heading Marketplace, Content chỉ Overview, mọi `href` trỏ trang có thật); `overview.test.ts` (thẻ Builders có link cho Owner/Operator/Viewer, các thẻ khác chưa có; Content không link); `marketplace-builders.test.ts` "menu and breadcrumb" (mục Builders `aria-current` + số chờ trên danh sách và chi tiết) |
| AC8 không inline; typecheck + toàn bộ test xanh | Đạt | `security-headers.test.ts` quét CSP cho `/ops`, danh sách, chi tiết; `marketplace-builders.test.ts` kiểm không `style=`/`<style`/`on*=`/`<script` và Referrer-Policy khác `no-referrer`; kết quả lệnh ở dưới |
| AC9 giống mockup ở 1280 và 390 px | Chờ Reviewer | Ảnh ở dưới |

## Kết quả lệnh

Baseline (`49da061`): `npm run typecheck -w apps/web` exit 0. `npm test` lần đầu dừng giữa chừng với `npm error code 134` (tiến trình node abort, có stack native, không có test hỏng nào được in); chạy lại: 131 file, 1344/1344.

Cuối (`330dd0b`):

```
$ npm run typecheck -w apps/web
typecheck_exit=0
$ npm test
 Test Files  132 passed (132)
      Tests  1364 passed (1364)
   Duration  243.26s
```

Lần chạy đầy đủ trước đó (`bb31d3b`): 132 file, 1364/1364. Không có timeout ngẫu nhiên ở hai lần này. Sau `330dd0b` chạy riêng `test/ops test/http/security-headers.test.ts test/admin test/i18n`: 19 file, 183/183.

Kích thước diff `49da061..330dd0b`: không tính test và locale **+626 / −37**; `en.ts` +39; test +429 / −27.

## Ảnh (AC9)

Chụp bằng Chrome headless qua DevTools protocol, viewport thật 1280 và 390 px (mobile), dữ liệu mẫu chỉ ở D1 local của worktree, `wrangler dev` cổng 8795. Thư mục: `C:\Users\User\AppData\Local\Temp\claude\d--DOCS-SUPHAM-GIT-vnxsi\dd9ecbbc-7b18-4ee6-882b-eeabea10ab67\scratchpad\`

- `b2504a-list-1280.png`, `b2504a-list-1280-dark.png`, `b2504a-list-390.png`
- `b2504a-detail-1280.png`, `b2504a-detail-1280-reject.png` (đã mở xác nhận Reject), `b2504a-detail-1280-dark.png`, `b2504a-detail-390.png`

Sau khi chụp: đã dừng `wrangler dev` của mình (node PID 7232) và workerd con (PID 20640) trên cổng 8795; cổng 8787 không đụng. Thư mục profile Chrome `chrome-profile-vnx2504a` đã bị xóa.

## Sai khác và lý do

1. **Chỉ Builders, không Products** (xem đầu báo cáo). Mục Products chưa có trong menu; thẻ Overview "Products in review" vẫn chưa có link. `admin-products.tsx` chưa tách hàm.
2. **Sửa 4 file test ngoài danh sách:** `guard.test.ts` (giống VNX-2503: `GET /ops/marketplace/builders` đã đăng nhập là 200, mọi trường hợp khác vẫn 404 + `no-store` + `noindex`); `layout.test.ts`, `overview.test.ts` (menu và link thẻ thay đổi theo đúng handoff mục 4); `security-headers.test.ts` (thêm 2 trang mới vào quét CSP).
3. **So với mockup:** chi tiết là trang riêng (đã được duyệt); cột Status đứng thứ hai, không phải cuối, để còn thấy ở 390 px (bảng vẫn cuộn ngang cho các cột sau); có thêm cột Email như danh sách admin cũ; không có ô lọc "All kinds" (không có truy vấn tương ứng); không có "View public preview" (admin cũ không có, profile chỉ công khai khi approved); không có dòng "SAMPLE DATA"; không phân trang (xem trên); History hiện mã action (`builder.reject`) và actor thay cho câu mô tả của mockup, vì projection an toàn chỉ có các trường đó; "Applied" ghi ngày (danh sách) và ngày giờ UTC (chi tiết) thay vì "2 d ago".
4. **409 trong OpsLayout:** khi không chuyển được trạng thái, Ops trả 409 bằng trang chi tiết hiện tại kèm thông báo, không dùng trang lỗi công khai như `/admin`.
5. **Dòng ghi chú dưới nút** ghi "Every action adds an audit entry", không ghi như mockup "Reject asks to confirm", vì bước xác nhận đã hiện ngay trên giao diện.
6. **Nhãn lý do suspend** dùng khóa Ops mới "Reason (optional; shown in the builder's hub, not e-mailed)" thay `admin.reasonOptional` ("admins only"): `views/hub/OverviewPage.tsx` hiện `builder.reviewNote` cho builder ở mọi trạng thái, nên lý do suspend không chỉ admin thấy.
7. Thuộc TDD: một phần code được viết trước khi chạy test đỏ. Thứ tự commit vẫn là test trước, và trạng thái đỏ đã được xác nhận bằng cách tạm đưa mã nguồn về HEAD (19/64 test hỏng), rồi khôi phục.

## Câu hỏi mở / ghi nhận

- Tách Products thành task riêng (đề xuất 2504a2), với cùng handoff phần Products.
- **Tìm kiếm không phân biệt hoa thường chỉ cho ASCII:** `lower()` của SQLite chỉ đổi A–Z, nên tìm "MÂY" không ra "Mây" (tìm "mây" thì ra). Không thêm hàm chuẩn hóa vì chưa có quy tắc.
- **Ghi nhận ngoài phạm vi:** nhãn `admin.reasonOptional` ("Reason (optional, admins only)") ở `/admin` không đúng với hub (builder thấy review note). Không sửa ở `/admin`.
- Overview giờ đọc số Builders hai lần mỗi request (một cho thẻ, một cho menu); là `COUNT(*)` trên index, chấp nhận để giữ `opsShell` đơn giản.
- D1 local của worktree có dữ liệu mẫu (builder "Lan Nguyen" và các builder khác, 2 dòng audit `01J9SHOT2504A…`, một session của owner mẫu), không nằm trong git.
