# VNX-2504b — Báo cáo Implementer

- **Task:** hàng đợi Ops Requests dưới `/ops/marketplace/requests` (handoff `.ai/tasks/VNX-2504b-handoff.md`), theo đúng mẫu Builders/Products của VNX-2504a/2504a2.
- **Nhánh:** `feat/ops-o1` (worktree riêng), cắt từ `99fe2c2`. Không push, không merge, không deploy.
- **Kết quả:** xong toàn bộ phạm vi handoff. Diff `src` + `public` không tính locale **+541 / −47** (dưới ngưỡng ~600); tính cả `en.ts`: +576 / −47.

## Commit

| SHA | Nội dung |
|---|---|
| `659ce10` | `test:` `test/ops/marketplace-requests.test.ts` (23 test mới); cập nhật `layout.test.ts`, `overview.test.ts`, case CSP trong `security-headers.test.ts`. Commit trước code. Đỏ trên mã nguồn ở `99fe2c2`: **22 hỏng / 52** (4 file) |
| `a327a6c` | `feat(web):` hàng đợi Requests: danh sách, chi tiết, invite / return / remove, menu, link thẻ Overview; tách hàm dùng chung khỏi `admin-requests.tsx`. Kèm sửa kiểu ở helper form của file test mới (`readonly string[]`, để typecheck xanh; không đổi assertion) |
| (commit này) | `docs:` báo cáo này |

## File

Mới: `src/views/ops/RequestsPages.tsx` (danh sách + chi tiết), `test/ops/marketplace-requests.test.ts`.

Sửa: `src/routes/admin-requests.tsx` (chỉ tách hàm), `src/routes/ops-marketplace.tsx` (route Requests), `src/db/requests.ts` (thêm 2 hàm đọc + gom mệnh đề ORDER BY dùng chung), `src/ops/menu.ts`, `src/routes/ops.tsx` (số đếm menu `requests`), `src/views/ops/OpsLayout.tsx` (một icon), `src/views/ops/parts.tsx` (`ReasonField` thêm prop `value` tùy chọn), `src/i18n/messages/en.ts` (35 khóa `ops.*`), `public/assets/app.css` (4 dòng).

Test ngoài file mới (giống 2504a/2504a2, do handoff mục 6 và AC7/AC8): `test/ops/layout.test.ts`, `test/ops/overview.test.ts`, `test/http/security-headers.test.ts`. Không đụng `src/app.ts` (route đăng ký trong `registerOpsMarketplaceRoutes` có sẵn, vẫn trước route bắt cuối `/ops`; thứ tự middleware không đổi).

## Triển khai

- **Route** (`ops-marketplace.tsx`): `GET /ops/marketplace/requests` và `GET /ops/marketplace/requests/:id` qua `requireOps("marketplace.view")`; `POST …/:id/{invite,reject,remove}` qua `requireOps("marketplace.act")`. Request không tồn tại → `opsNotFound` (404 kín), giống chỗ `/admin` trả 404.
- **Tách hàm dùng chung** (`admin-requests.tsx`), theo mẫu `decideProduct`:
  - `inviteToRequest(c)`, `rejectRequest(c)`, `removeRequest(c)` trả `RequestDecision`: `not_found` / `conflict` / `invalid_invite{item, error, handle}` / `invalid_note{item, note}` / `done{requestId, mailed}`. Thân hàm giữ nguyên: thứ tự kiểm tra (tìm request → `requestTransition(…, "admin")` → đọc body), `HANDLE_RE` + `findPublicBuilderByHandle`, lỗi `none` / `handle` / `too_many` theo `MAX_ACTIVE_INVITES - activeInvites`, **một batch** `inviteBuildersBatch` + `auditStatement("request.invite", {from, requested})` với guard `{requestId, inviteIds}`; `end()` (không đổi) với `endRequestBatch` + audit `request.reject|remove` `{from}` với guard compare-and-set, rồi `notifyNotSelected` / `notifyInviteExpired`; `parseAdminNote`; `notifyRequestRejected` chỉ cho reject; remove không gửi gì cho client.
  - `requestMatching(db, item)`: danh sách invitation + gợi ý (`listCandidates` + `suggestBuilders`, `null` khi hết chỗ hoặc trạng thái không mời được), dùng cho cả hai trang chi tiết (trước nằm trong `detailPage` của admin).
  - `/admin` đổi kết quả ra đúng response cũ (`adminAnswer`): 404 / 409 `errorResponse`, 400 trang admin (giữ `handle`/`note` đã gõ), 303 `/admin/requests/:id?done=1|mail_failed` cho invite/reject, 303 `/admin/requests` (không notice, bỏ qua lỗi e-mail như trước) cho remove. Test `/admin` không sửa, xanh.
- **Trả lời Ops:** invite/reject thành công → 303 `/ops/marketplace/requests/:id?{status}&q=…&done=1|mail_failed` (bộ lọc đi theo form action). Remove thành công → 303 về danh sách giữ bộ lọc, `&done=1|mail_failed`, danh sách hiện notice. Lỗi invite → trang chi tiết Ops 400, thông báo lỗi `role="alert"` trên form, giữ handle đã gõ. Note sai → 400, `<details>` "Return to client…" mở sẵn, lỗi gắn `aria-describedby`, giữ note đã gõ. 409 (trạng thái không cho phép, thua compare-and-set, không ai được mời vì trùng/không đủ điều kiện) → đọc lại request, trang chi tiết 409 với "The status changed before your action, so nothing was saved" và trạng thái hiện tại.
- **Danh sách:** 8 tab trạng thái (`REQUEST_STATUSES`) + tab "All" (`?status=all`), mỗi tab có số (`countRequestsByStatus`: `GROUP BY status`; All = tổng). Mặc định `submitted`; `?status=` ngoài allowlist (kể cả `ALL`, `SUBMITTED`, rỗng) bị bỏ qua. Tìm `?q=` (trim, 1–100 ký tự) trên tiêu đề bằng `instr(lower(r.title), ?)` (`%`, `_` là chữ) — `searchRequestsForAdmin`, cùng thứ tự (submitted/matching cũ nhất trước, còn lại mới đổi nhất trước) và giới hạn 200 như `listRequestsForAdmin`; không phân trang (giống Builders/Products). Cột: Request, Status (thứ hai, để thấy ở 390 px), Client (tên + e-mail), Category, Invitations (`active · total`), Proposals, Submitted. Chân bảng "N of TOTAL" hoặc "N shown".
- **Chi tiết:** link "← Requests" giữ bộ lọc, tiêu đề + pill trạng thái, hai cột ≥ 1024 px như Builders. Trái: thẻ Request (client name, client e-mail, category, budget, deadline nếu có, languages, submitted, created, last change, description, "Reason sent to the client" = `adminNote` nếu có); thẻ Invitations (dòng `active · total`; bảng builder có link sang `/ops/marketplace/builders/:id` + `@handle`, trạng thái invitation, đề xuất giá · số ngày, lý do từ chối, ngày mời); thẻ Suggested builders khi còn mời được (luật chấm điểm, số chỗ trống, bảng builder / điểm / lý do; với `canAct` là form invite với một checkbox mỗi builder + ô handle + nút Invite). Phải: Decision (khi đầy 5 chỗ: "All 5 invitation slots are in use."; Return to client trong `<details class="ops-confirm">` với note bắt buộc, chỉ khi `submitted`; Remove as spam trong `<details>` nói rõ "The client is not told", khi chưa `removed`; còn lại "No action applies in this status."), History (`listEntityAudit(db, "request", id, 50)`, projection an toàn của 2504a). Viewer: thấy mọi trường (gồm e-mail client, như admin; spec §3.1), invitation và gợi ý kèm lý do, nhưng không form, không checkbox, không input, không nút; Decision chỉ có "Your role can view this page but not change it.".
- **Menu:** `OPS_MENU` thêm Marketplace › Requests (`marketplace.view`, icon theo mockup, `count: "requests"` dùng `countRequestsToMatch` của thẻ Overview). Thẻ Overview "Requests to match" tự có link "Open queue" vì route đã đăng ký (`QUEUE_TARGETS` có sẵn).
- **CSS:** 4 dòng `.ops-*` mới (khung bảng trong thẻ, form invite, checkbox 20 px). Không `style`, không `<style>`/`<script>`.

## Tiêu chí chấp nhận

| AC | Trạng thái | Lệnh / bằng chứng |
|---|---|---|
| AC1 Owner/Operator invite / reject / remove như admin cũ | Đạt | `npm test -- test/ops/marketplace-requests.test.ts` → 23/23. "detail and actions": invite checkbox + handle (kể cả builder `closed`), 303 giữ bộ lọc, `matching`, invitation `invitedBy` = actor, e-mail tới 3 builder không chứa e-mail client, đúng một audit `request.invite` `{from, requested}`; 400 cho none / handle lạ / quá chỗ (không ghi gì, giữ handle); 409 trùng và request đã `closed` (trang hiện trạng thái hiện tại); e-mail lỗi → `mail_failed`; đủ 5 chỗ → không form, POST thứ 6 → 400; reject 400 khi note rỗng / 1001 ký tự (`<details>` mở), thành công → `rejected` + `adminNote`, e-mail client có note, audit `{from: "submitted"}`, 409 lần hai; reject e-mail lỗi → `mail_failed`; remove: proposal → `not_selected`, invited → `expired`, e-mail 2 builder, client không, audit `{from: "matching"}`, 303 về danh sách giữ bộ lọc, 409 lần hai; POST khác Origin → 403 |
| AC2 Viewer chỉ xem; POST Viewer/Content → 404, không ghi | Đạt | cùng file: "refuses every POST from a Viewer or Content": 3 hành động × 2 vai trò → 404, trạng thái, `adminNote`, invitation, audit, outbox không đổi; "shows what the admin page showed…": Viewer không có `<form`, `<button`, `<input`, `<textarea` trong `<main>` |
| AC3 Content và người không vai trò 404 kín | Đạt | cùng file: danh sách, `?status=all`, chi tiết cho Content, ẩn danh, user không vai trò → status, header, body giống `/ops/khong-ton-tai` |
| AC4 Lọc + tìm qua URL, giá trị lạ bỏ qua, số trên tab | Đạt | cùng file "list": số trên mỗi tab = `COUNT(*)` từng trạng thái, tab All = tổng, `?status=deleted|SUBMITTED|ALL|` → Submitted, `?status=all` có cả `pending_verification`, tìm tiêu đề không phân biệt hoa thường, `q` giữ trong tab / ô tìm / input ẩn / link dòng, `%` không khớp tất cả, `q` 101 ký tự bị bỏ qua, đủ cột |
| AC5 History theo projection an toàn | Đạt | cùng file "history": chỉ dòng của request này, mới nhất trước, e-mail Owner gốc, ID cho người ngoài Ops, không `data`, note chỉ xuất hiện một lần (từ `adminNote`) |
| AC6 `/admin` chạy như trước | Đạt | `npm test -- test/admin` → 12 file, 105/105, không sửa test admin |
| AC7 Menu Requests (Owner/Operator/Viewer, không Content), thẻ Overview có link | Đạt | `npm test -- test/ops` → 6 file, 103/103 (`layout.test.ts`: registry + nav cho 4 vai trò; `overview.test.ts`: link thẻ Requests cho Owner/Operator/Viewer, Content không link; `marketplace-requests.test.ts` "menu and breadcrumb": Requests là trang hiện tại, số `submitted`) |
| AC8 CSP scan có trang mới; typecheck + toàn bộ test | Typecheck đạt; toàn bộ test: xem "Kết quả lệnh" | `security-headers.test.ts` quét `/ops/marketplace/requests`, `?status=all`, chi tiết; `marketplace-requests.test.ts` kiểm không inline, Referrer-Policy khác `no-referrer` |
| AC9 Giống mẫu Builders/Products ở 1280 và 390 px | Chờ Reviewer | Không chụp ảnh (handoff: Reviewer chụp; không mở `wrangler dev`) |

## Kết quả lệnh

```
$ npm run typecheck -w apps/web
typecheck_exit=0
$ npm test -- test/ops/marketplace-requests.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)
$ npm test -- test/admin
 Test Files  12 passed (12)
      Tests  105 passed (105)
$ npm test -- test/ops
 Test Files  6 passed (6)
      Tests  103 passed (103)
```

Toàn bộ (`a327a6c`): không chạy `npm test` một lượt (máy đã hết bộ nhớ ảo ở lần review 2504a2); chạy từng nhóm trong `apps/web` bằng `npx vitest run <nhóm> --maxWorkers=2`, một lượt, **không timeout, không lỗi**:

| Nhóm | File | Test |
|---|---|---|
| `test/admin/` | 12 | 105/105 |
| `test/auth/` | 9 | 40/40 |
| `test/catalog/` | 3 | 22/22 |
| `test/contact/` | 2 | 30/30 |
| `test/db/` | 16 | 133/133 |
| `test/design/` | 2 | 30/30 |
| `test/domain/` | 20 | 400/400 |
| `test/email/` | 7 | 33/33 |
| `test/http/` | 9 | 41/41 |
| `test/hub/` | 10 | 89/89 |
| `test/i18n/` | 2 | 14/14 |
| `test/jobs/` | 3 | 35/35 |
| `test/landing/` | 3 | 38/38 |
| `test/legal/` | 3 | 29/29 |
| `test/lib/` | 1 | 3/3 |
| `test/me/` | 4 | 28/28 |
| `test/monetization/` | 3 | 111/111 |
| `test/notify/` | 2 | 19/19 |
| `test/ops/` | 6 | 103/103 |
| `test/public/` | 6 | 69/69 |
| `test/seo/` | 3 | 10/10 |
| `test/views/` | 4 | 6/6 |
| `test/*.test.ts` (gốc, gồm `architecture.test.ts`) | 4 | 22/22 |
| **Tổng** | **134** | **1410/1410** |

(1387 của lần review 2504a2 + 23 test mới.)

## Sai khác và lý do

1. **Nhãn trạng thái riêng cho Ops** (`ops.requests.status.*`: Unconfirmed, Submitted, Matching, Builder selected, Returned, Expired, Closed, Removed): nhãn `request.status.*` viết cho client ("Waiting for matching", "Builders invited"…), dài và khó đọc trên tab. Cùng cách Builders làm ở 2504a.
2. **Remove → danh sách có notice** (`&done=1|mail_failed`): `/admin` cũ về `/admin/requests` không notice và bỏ qua lỗi e-mail tới builder. Ở Ops, sau khi bấm Remove người dùng cần biết đã lưu, và nếu e-mail báo builder lỗi thì cần thấy. Nghiệp vụ và e-mail không đổi; `/admin` giữ nguyên.
3. **409 dùng chung thông báo** "The status changed before your action…" cho cả trường hợp invite không mời được ai (builder đã được mời, là client, không đủ điều kiện) — `inviteBuildersBatch` không cho biết lý do; trang hiện trạng thái và danh sách invitation hiện tại.
4. **`ReasonField` có prop `value` tùy chọn** để 400 giữ note đã gõ như `/admin` (Builders/Products không truyền nên không đổi gì).
5. **Builder trong bảng invitation và gợi ý link sang `/ops/marketplace/builders/:id`** (admin cũ link sang hồ sơ công khai `/b/:handle`, chỉ khi public): trong Ops, trang builder nội bộ luôn tồn tại và cho thấy trạng thái thật; giống cách Products link builder.
6. **Gợi ý builder nằm ở cột trái** (dưới Request và Invitations), cột phải là Decision + History: bảng gợi ý có 4 cột, cột phải (1fr) quá hẹp. Nút Invite nằm trong thẻ gợi ý.
7. **`db/requests.ts`**: gom mệnh đề `ORDER BY` của hàng đợi admin thành `adminOrder()` để `searchRequestsForAdmin` dùng chung đúng thứ tự; `listRequestsForAdmin` trả kết quả như cũ.

## Ghi nhận / câu hỏi mở

- Tìm kiếm không phân biệt hoa thường chỉ với ASCII (SQLite `lower()`), như F1 của 2504a/F4 của 2504a2.
- Trang Overview giờ đọc `countRequestsToMatch` hai lần mỗi request (thẻ + số trên menu), như F3 của 2504a/2504a2.
- Tab trạng thái có 9 tab; ở 390 px thanh tab cuộn ngang (`.ops-tabs` có `overflow-x: auto`), như Products (8 tab).
- Trang chi tiết không giới hạn số dòng invitation (tối đa vài chục theo luật 5 active), như admin cũ.
