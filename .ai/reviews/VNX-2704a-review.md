# VNX-2704a — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-11
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (header, Changelog delta, Quyết định thiết kế, Global Constraints, Review Focus, mục Task VNX-2704a, ghi chú E2E của 2705a, Open points OP-4, "Cần Owner/Reviewer lưu ý" điểm 1 và 3); `.ai/context/CURRENT-STATUS.md` (nghĩa vụ EPIC 27 từ review 2702a/2702b/2703a); review `.ai/reviews/VNX-2702a-review.md`, `VNX-2702b-review.md`, `VNX-2703a-review.md`; phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §3.2, §5, §7.1, §7.3; ADR-010 (vai trò/capability Ops, 404 kín, chỉ tiếng Anh, audit); báo cáo `.ai/tasks/VNX-2704a-report.md`; toàn bộ diff `26aff0a..238dc33` (16 file, +1068/−16; code `ec28a7b`, báo cáo `238dc33`); các hàm dùng lại: `db/request-board.ts` (`publishStatement`, `editPublicStatement`, `rejectStatement`, `unpublishStatement`, `returnedPublication`, `publicationAuditGuard`), `db/audit.ts` (`AuditPublicationGuard`), `domain/request-board.ts` (`publicationTransition`, `canEditPublication`, `parsePublicListing`, `parseReviewNote`), `auth/ops.ts` (`requireOps`), `views/ops/parts.tsx` (`Confirm`, `ReasonField`, `History`). Theo quy ước EPIC 27 (L-6), mục task của plan là handoff.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `238dc33`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/ops/marketplace-request-board.test.ts test/ops/guard.test.ts test/ops/marketplace-requests.test.ts test/architecture.test.ts`: **4 file, 108 test xanh** (riêng `marketplace-request-board.test.ts`: 28/28).
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **194 file, 2438 passed + 2 skipped** (488 s; 2 skipped là kiểm tập cha Privacy/Terms chờ VNX-2707b). Khớp báo cáo.
  - `npm run test:scripts`: **52/52**. `npm run e2e:typecheck`: exit 0.
  - `npm run e2e` (một lần, `workers: 1`): **63 passed, 1.5 phút, không retry, không lỗi**. Lỗi lẻ `a11y.spec.ts` `vi /vi/login` (fixture `csp`) mà báo cáo ghi ở lần chạy đầu **không tái hiện**. Phân tích: commit này không thêm asset, script hay style nào ở trang công khai (chỉ view Ops, seed D1 và fixture `opsPage`); seed mới chỉ ghi `users`/`sessions`/`requests`/`request_publications`, không chạm `/vi/login`. Không có dấu hiệu vi phạm CSP thật; xếp là bất ổn định hạ tầng (đã gặp ở các lần chạy trước), không phải finding của task. Sau khi chạy: không còn tiến trình `wrangler`/`workerd` nào của worktree này (một `workerd` đang chạy thuộc repo khác, `D:\DOCS\SUPHAM\GIT\cnl\...`, không đụng tới).

## Verdict

**APPROVE_AFTER_FIXES** (APPROVE WITH CHANGES).

Phần lõi đúng plan, phụ lục và ADR-010:

- **Quyền.** Bốn POST đều qua `requireOps("marketplace.act")`; route không tự kiểm vai trò, `isAdmin` hay `method`. Content, Viewer, người chưa đăng nhập và Operator bị khóa nhận 404 kín, so từng byte với phản hồi của người chưa đăng nhập. Phiên `oauth_*` của Operator và của root Owner bị 404 ở cả GET chi tiết và bốn POST; cùng người đăng nhập bằng magic link thì thao tác được. `guard.test.ts` đã có thêm 4 đường. Khối và History của publication chỉ nạp khi `can(role, "marketplace.act")`, nên Viewer thấy trang như cũ (OP-4).
- **Ghi.** Mỗi lần ghi là **một** `db.batch([CAS, auditStatement(…, publicationAuditGuard({ status: to, updatedAt: now }))])`. Thua CAS thì guard `EXISTS` sai, nên không có dòng audit, route trả 409. Test race là thật: proxy `batch` đổi `updated_at` ngay trước batch. Bỏ guard thì test thấy dòng audit; bỏ kiểm `returnedPublication` thì nhận 303.
- **Máy trạng thái §7.1.** `publish` kiểm request mở ở cả route lẫn SQL. `edit` chỉ khi `published`. `rejected`/`unpublished` là trạng thái cuối. `published_at` giữ lần đầu. `review_note` bắt buộc, ≤ 1000. Request vẫn giữ trạng thái khi publication bị reject.
- **Parse.** Dùng `parsePublicListing`/`parseReviewNote` (nghĩa vụ 2702b).
- **Audit.** `data = { requestId, from, to }`. Không có câu chữ, lý do hay danh tính client.
- **`OpsLayout invalid`.** Tiền tố đọc bằng `t("en", …)`. Khi prop vắng, test so từng byte `<title>` của chi tiết, danh sách và Overview.
- **Mẫu VNX-0807.** Có `FormErrorSummary`, id `pl-*`, `aria-invalid`/`aria-describedby`, không `role="alert"`, `action` không có `#`, và 409 là mục `href: ""`. Đã kiểm ở cả Vitest và e2e.
- **History.** Gộp History đúng thứ tự (`at DESC, id DESC`, như `listEntityAudit`), một `id="ops-history-h"`, chỉ hiện `action` (không hiện `data`).
- **Hàm đăng ký.** `registerOpsMarketplaceRoutes` giờ trả `{ requestDetail }`, tương thích ngược: đây là nơi gọi duy nhất, trước đây giá trị trả về là `void`.
- **`RANKING_FILES`.** Có `routes/ops-request-board.tsx`.
- **E2E.** Seed tất định: `K 1003`, `R/Q 2008..2010` đều không trùng id nào. Request cũ hơn 30 ngày, `test:scripts` xanh. Ngân sách POST và README đã cập nhật.

Hai điểm phải sửa trước khi đóng task: lúc render lại sau 409 (M-1) và danh mục kiểm duyệt chưa đủ theo §3.2 (M-2).

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| M-1 | MEDIUM | `src/routes/ops-request-board.tsx:61,63,92` (`conflict` mang `values`); `src/views/ops/PublicListingBlock.tsx:118-121,213-216` | Khi 409 (thua CAS, hoặc chuyển không hợp lệ), trang render lại với **câu chữ người dùng đã gõ** nhưng `updated_at` ẩn là token **mới**. Hệ quả: (1) Ops không thấy câu chữ công khai hiện tại, vì khối không hiện `public_title`/`public_description` ở đâu khác ngoài ô sửa, nên thông báo "Review its current state below" không làm được; (2) bấm "Save wording" lần nữa ghi đè đúng thay đổi mà CAS vừa chặn (lost update chỉ cách một cú bấm), và nếu người kia vừa xóa PII khỏi bản công khai thì PII quay lại; (3) Ops định **Reject**, nhưng người khác đã Publish trước: trang mở sẵn hộp **Unpublish** (`Confirm open`) với lý do reject đã điền. Điều này trái chính chú thích của `refused()` ("the page is the state as it is now") và mẫu 409 sẵn có của Ops (`requestAnswer`/`builderDetail`: "Show the current state", không mang giá trị). Quy tắc "giữ giá trị đã nhập" của VNX-0807 dành cho lỗi parse 400. Ở 409, khi trạng thái đã đổi, phải ưu tiên trạng thái hiện tại. Test 409 hiện chỉ kiểm khối tóm tắt, không kiểm nội dung form. | Khi `conflict`: không mang `values` (ô sửa lấy `p.publicTitle ?? r.title` của bản hiện tại) và không mở hay điền sẵn `Confirm` (`noteState` chỉ dùng khi không conflict). Giữ 400 như hiện nay. Test: (a) publish với token cũ sau khi bản đã được sửa thì 409, ô `pl-public-title` có câu chữ hiện tại, không có câu vừa gõ; (b) reject sau khi publication đã `published` thì 409, `<details>` không `open`, `pl-review-note` rỗng. | Implementer |
| M-2 | MEDIUM | `src/i18n/messages/en.ts:1215-1219` (`ops.board.checklist`, `ops.board.check.*`) | Plan yêu cầu "danh mục kiểm duyệt (§3.2) hiện ngay trong khối", nhưng danh mục trong code thiếu nội dung của §3.2: không có **địa chỉ**, **mã số** (mã số thuế, số đăng ký…), **tên khách hàng của client**, link tới site của client (chỉ có "links" chung). Thiếu hẳn mục thứ tư: **"Nội dung vi phạm Terms §7 (spam, trái luật, quảng cáo): từ chối; nếu là spam thì gỡ cả request (`removed`)"**. Đây là kiểm soát chính bảo vệ danh tính client trước khi công khai (Review Focus 1); danh mục thiếu thì Ops dễ bỏ sót địa chỉ hay mã số. Ngoài ra danh mục chỉ hiện khi có nút Publish/Save; với request đóng (chỉ có Reject) thì không hiện. Mục 4 liên quan tới quyết định reject nên chấp nhận được, nhưng xem đề xuất. | Viết lại theo đúng bốn gạch của §3.2 (EN, Ops chỉ EN; Reviewer duyệt câu), ví dụ: "names of people, companies or the client's customers; e-mail addresses, phone numbers, postal addresses, links to the client's site, handles, tax or registration numbers", "information the client marked confidential or internal", "a combination of country, niche and budget that still identifies the business: make it more general, or reject", "content against Terms §7 (spam, illegal, advertising): reject; if it is spam, remove the whole request". Hiện danh mục mỗi khi khối có nút thao tác. Test: HTML khối chứa đủ bốn mục (theo khóa). | Implementer (Reviewer duyệt câu khi re-review) |
| L-1 | LOW | `src/i18n/messages/en.ts:1195` (`ops.board.lead`) | "Name, e-mail and the client's original wording are never shown there." sai khi Ops publish mà không sửa: ô được điền sẵn từ bản gốc, nên câu chữ gốc **có thể** lên bảng nguyên văn. Câu này dễ làm Ops lơ là ("bản gốc không bao giờ công khai"). | Ví dụ: "The board shows only the public wording below, after you review it, never the client's name or e-mail. It starts as the client's own wording: edit it before you publish." | Implementer |
| L-2 | LOW | `src/routes/ops-request-board.tsx:42`; `src/views/ops/PublicListingBlock.tsx:115`; `src/db/request-board.ts:187-196` (`rejectStatement`, 2702a) | Lệch 2: không cho reject publication của request `pending_verification`. Lý do hợp lý: không ở hàng chờ; email từ chối ở 2704b sẽ gửi tới địa chỉ chưa xác nhận. Nhưng quy tắc này (a) chỉ nằm ở route, còn SQL `rejectStatement` không kiểm trạng thái request (Review Focus 4: "chặn trong câu SQL, không chỉ ở route"); (b) lặp lại ở hai nơi (route `allowed` và view `rejectable`), nên dễ lệch nhau. Mức thấp vì hiện **không có race**: `pending_verification → submitted` là một chiều, request đã đọc là `submitted` không thể quay lại, và route là nơi gọi duy nhất. Rủi ro chỉ đến từ một nơi gọi mới sau này. Domain `publicationTransition` cố ý cho reject ở mọi trạng thái (test 2702b đã duyệt), nên không nên đổi domain. | Thêm `AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.id = ?1 AND r.status = 'pending_verification')` vào `rejectStatement` (kèm test SQL theo mẫu 2702a), và gom điều kiện của route và view vào **một** hàm (ví dụ `opsBoardActions(publicationStatus, requestStatus)` trong `domain/request-board.ts`) để view và route không lệch. Làm trong R1, hoặc muộn nhất trước email reject của 2704b (Owner chọn). | Implementer |
| L-3 | LOW (quy trình) | `.ai/tasks/VNX-2704a-report.md` điểm 7 | Test viết cùng lúc với code, không có lần chạy đỏ (không TDD theo plan). Reviewer đã đánh giá bằng lập luận đột biến cho các assertion chính: bỏ guard audit, bỏ kiểm `returnedPublication`, đổi `requireOps` sang `marketplace.view`, bỏ chặn `pending_verification` ở route, nạp publication cho Viewer, bỏ gộp History, đổi mặc định `invalid`. Mỗi đột biến làm ít nhất một test đỏ, nên các test chính có phân biệt. Ngoại lệ ở L-4. | Ghi nhận quy trình. Ở các task sau, Implementer chạy test mới một lần trước khi viết code và dán kết quả đỏ vào báo cáo. | Implementer (quy trình) |
| L-4 | LOW | `test/ops/marketplace-request-board.test.ts` | Ba chỗ hở: (a) lệch 1 (409 trước 400) không có test ghim: ca `edit` trên `pending_review` dùng câu chữ hợp lệ, nên đảo thứ tự kiểm trong code vẫn xanh; (b) chỉ `publish` có `toEqual({ requestId, from, to })`; `reject` chỉ kiểm vắng `NOTE-IDENT`, email của **người Ops** (không phải email client) và tên client; `edit`/`unpublish` không kiểm `data`; (c) không ca nào kiểm thứ tự History khi đã gộp (dòng `request.*` xen với `request_publication.*`). | (a) `edit` với `public_description` 39 ký tự trên `pending_review` → 409 (không phải 400); (b) `toEqual` `data` cho cả bốn hành động, thêm vắng email của client (`f.clientId` → email); (c) một ca có audit `request.*` và `request_publication.*` xen kẽ, kiểm thứ tự `data-audit` giảm dần. | Implementer |
| S-1 | SUGGESTION | `src/routes/ops-marketplace.tsx:163-170` | History gộp có thể tới 2 × `HISTORY_LIMIT` (100) dòng. Khi một bên bị cắt ở 50 dòng, các dòng cũ của bên kia vẫn hiện xen vào, trông như History đầy đủ. Truy vấn History của publication chạy nối tiếp sau `Promise.all` (thêm một vòng D1). | Cắt danh sách đã gộp còn `HISTORY_LIMIT`. Có thể chạy `historyOf(…, "request_publication")` song song khi `canAct` (rỗng thì vô hại). | Implementer (tùy chọn) |
| S-2 | SUGGESTION | `src/views/ops/PublicListingBlock.tsx` (`action`), `src/routes/ops-request-board.tsx:93` | Lệch 5: `action` và redirect thành công bỏ bộ lọc danh sách. Các form Ops cũ mang `qs(filter)` nên quay lại vẫn giữ bộ lọc. Chấp nhận được ở 2704a (đúng chuỗi plan), nhưng sẽ phiền khi 2704b thêm bộ lọc `public=pending`: Ops duyệt từ hàng chờ rồi mất bộ lọc sau mỗi lần publish. | Giao cho 2704b: mang `qs(requestFilter)` trong `action` và redirect như các form cũ. | Implementer (2704b) |

## Đánh giá các điểm lệch Implementer nêu

1. **409 trước 400 (lệch 1): chấp nhận.** Giống `rejectRequest` của admin và đúng plan ("chuyển không hợp lệ → 409"; "pending_review thì edit → 409"). Thiếu test ghim thứ tự (L-4a).
2. **Không có Publish/Reject cho `pending_verification`, chặn reject ở route (lệch 2): chấp nhận về hành vi.** Vị trí chặn xếp LOW (L-2): không bỏ qua được trong code hiện tại vì không có race. Nên chuyển xuống SQL và gom vào một hàm trước khi 2704b gửi email.
3. **Nút theo trạng thái thay cho "bốn nút" (lệch 3): chấp nhận.** Chỉ hiện hành động mà máy trạng thái cho phép là đúng §7.1 và tránh nút vô hiệu. Câu "bốn nút" trong ghi chú E2E của plan coi như đã được thay; e2e kiểm đúng hành vi mới.
4. **R1-S1, hàng chờ thật theo id (lệch 4): đạt một phần, chấp nhận ở 2704a.** Test dùng `countPublicationReviewQueue` thật và so theo độ lệch. Danh sách, bộ lọc `public=pending` và thẻ Overview theo id vẫn là nghĩa vụ của 2704b (giữ trong CURRENT-STATUS).
5. **Redirect bỏ bộ lọc (lệch 5): chấp nhận cho 2704a** (S-2 cho 2704b).
6. **E2E:** chấp nhận việc chuyển bước kiểm "context không đăng nhập" sang 2705a (đúng delta) và việc không quét axe cho `/ops`. Lỗi lẻ của `a11y` không tái hiện (xem phần lệnh).
7. **TDD:** L-3.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Bốn POST `…/publication/{publish,edit,reject,unpublish}`, `requireOps("marketplace.act")`, không tự kiểm vai trò | ✓ | `ops-request-board.tsx:96-97`; test "who may act" |
| Content/Viewer/chưa đăng nhập/bị khóa → 404 kín, không ghi, không audit | ✓ | test so byte với phản hồi của người chưa đăng nhập, kiểm publication và `audit_log` theo id |
| Phiên `oauth_*` → 404 ở GET và POST; magic link → thao tác được | ✓ | test 3 method × (Operator, root Owner); `guard.test.ts` +4 đường |
| Viewer: 200, không khối, không `public_*`, không History publication (OP-4) | ✓ | test "hides the block … from a Viewer"; `requestDetail` chỉ nạp khi `canAct` |
| Khối: bản gốc, ô sửa điền sẵn, trường có cấu trúc chỉ đọc, trạng thái/ngày/`review_note` | ✓ | view và test "shows Owner and Operator …" |
| Danh mục kiểm duyệt §3.2 trong khối | ✗ | M-2 |
| Publish: chỉ request `submitted|matching` (route + SQL), lưu bản sửa, `published_at` lần đầu, `findPublicListing` thấy bản sửa, không thấy bản gốc | ✓ | test "publish" (gồm `builder_selected`, `removed`, `pending_verification`, publish lại sau opt-in lại) |
| Edit khi `published`: giữ trạng thái và `published_at`, một audit `.edit`; `pending_review` → 409 | ✓ | test "edit" |
| Reject: lý do bắt buộc ≤ 1000, request giữ trạng thái, `rejected` không publish được | ✓ | test "reject", "a rejected listing cannot be published" |
| Unpublish: lý do bắt buộc, `ended_at`, `findPublicListing` → null | ✓ | test "unpublish" |
| Một batch, CAS + audit có guard; thua CAS → 409, không audit | ✓ | `ops-request-board.tsx:83-92`; test race (proxy `batch`) và token cũ |
| Audit `request_publication.<hành động>`, `entity_id = request_id`, `data` chỉ `{requestId, from, to}` | ✓ (xem L-4b) | test "audit in the same batch" |
| History gộp, không câu chữ, một heading | ✓ (xem S-1, L-4c) | test "shows the block's History …" |
| Mẫu VNX-0807 cho 400 và 409; `OpsLayout invalid`; `<title>` không đổi khi vắng | ✓ (nội dung form khi 409: M-1) | test "the VNX-0807 error pattern"; e2e |
| Body: 4000 ký tự CJK OK; > 64 KB → 413; 4001/121 → 400 | ✓ | test "body" |
| Chỉ EN (`ops.board.*` chỉ ở `en.ts`) | ✓ | diff i18n; `parity.test.ts` xanh trong bộ đầy đủ |
| `RANKING_FILES` có `routes/ops-request-board.tsx`, không import module tiền | ✓ | `architecture.test.ts` |
| CSP: không `<script>`/`style=` inline mới | ✓ | view chỉ dùng class; bộ đầy đủ xanh |
| Không email, không `TODO`/hàm rỗng | ✓ | đọc diff |
| E2E: seed tất định, `opsPage` bằng cookie seed, không `POST /login`; README (phạm vi, ngân sách POST); số liệu homepage không đổi | ✓ | `npm run e2e` 63/63; `test:scripts` 52/52 |
| `npm run typecheck`, `npm test` toàn bộ xanh | ✓ | 194 file, 2438 + 2 skipped |

## Nghĩa vụ để lại cho task sau

- **VNX-2704b:**
  - Danh sách, bộ lọc `public=pending` và thẻ Overview "Public requests to review" chứng minh **theo id** rằng publication của request `pending_verification` không vào hàng chờ và vào sau khi client xác nhận email. Nghĩa vụ R1-S1 của 2703a, mới đạt phần đếm.
  - Form của khối mang `qs(requestFilter)` trong `action`/redirect (S-2).
  - Nếu L-2 chưa sửa ở R1: chặn reject cho `pending_verification` trong SQL trước khi gửi email reject.
- **VNX-2706b:** khối "Interested builders" dùng cùng mẫu đã sửa ở M-1: 409 hiện trạng thái hiện tại, không điền sẵn hay mở form của hành động khác.
- **VNX-2705a:** thêm bước kiểm "context không đăng nhập" vào ca Ops của `request-board-forms.spec.ts` (đã ghi trong plan); không khẳng định gì về `Q2008..2010`.
- **Ghi nhận (Reviewer, CURRENT-STATUS):** lỗi lẻ `a11y.spec.ts` `vi /vi/login` (fixture `csp`) xuất hiện một lần ở Implementer và không tái hiện ở Reviewer. Nếu lặp lại, cần điều tra riêng (không thuộc EPIC 27).

## Re-review (vòng sửa 1)

- **Ngày:** 2026-10-11
- **Đã đọc:** diff `5fba240..5b4f845` (8 file, +202/−47) và phần "Vòng sửa 1" của báo cáo `.ai/tasks/VNX-2704a-report.md`.
- **Lệnh đã chạy lại (HEAD `be3056a` = `5b4f845` + sửa câu chữ của Reviewer):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/ops`: **8 file, 165 test xanh**.
  - Cùng lệnh với `test/ops test/architecture.test.ts test/domain/request-board.test.ts test/db`: **34 file, 490 test xanh**. `test/i18n`: 2 file, 14 test xanh.
  - `npm run e2e` (một lần): **63 passed, 1.5 phút, không retry**. Lỗi lẻ `vi /vi/login` không tái hiện. Sau khi chạy không còn tiến trình `wrangler`/`workerd` nào của worktree.
  - Bộ đầy đủ: không chạy lại. Lần sửa chỉ chạm Ops, domain/db của bảng (đã chạy lại `test/db` và `test/domain/request-board.test.ts`) và một chuỗi EN. Số của Implementer: 194 file, 2446 + 2 skipped.

| # | Trạng thái | Bằng chứng |
|---|---|---|
| M-1 | **Đã sửa** | `conflict` không còn mang `values` (`ops-request-board.tsx`). View chỉ dùng giá trị đã gõ khi `!form.conflict`: ô sửa lấy câu chữ hiện tại, `Confirm` không mở, ô lý do rỗng. 400 giữ giá trị như cũ. Hai test mới: edit thua CAS thì HTML có `CURRENT-*`, không có `TYPED-*`, token là `updated_at` mới; reject thua Publish thì không có `TYPED-NOTE`, không `<details open>`, ô lý do rỗng, form Unpublish hiện ra. |
| M-2 | **Đã sửa** (Reviewer sửa câu một mục) | Bốn khóa `ops.board.check.remove|confidential|combination|terms` khớp bốn gạch §3.2: tên người, tên công ty, tên khách hàng của client; email, điện thoại, địa chỉ; link tới site của client; handle; mã số; mật/nội bộ; tổ hợp quốc gia + ngách + ngân sách thì viết chung hơn hoặc từ chối; Terms §7 thì từ chối, spam thì gỡ cả request. Danh mục hiện khi khối có bất kỳ hành động nào (cả khi chỉ có Reject), ẩn khi không có hành động (`pending_verification`). Có test. **Câu chữ: duyệt**, trừ mục Terms: "(Remove as spam, the existing flow)" là thuật ngữ nội bộ của plan. Reviewer đổi thành "(Remove as spam)", tức tên nút có sẵn `ops.requests.removeOpen`, bằng một **commit riêng chỉ sửa chuỗi** `be3056a` (một dòng trong `en.ts`; test M-2 vẫn xanh vì kiểm "Terms §7" và "remove the whole request"). |
| L-1 | **Đã sửa** | Câu mở đầu mới nói đúng: bản công khai bắt đầu từ câu chữ của client và phải được sửa trước khi publish. Test kiểm không còn "never shown". |
| L-2 | **Đã sửa** | `rejectStatement` có `AND NOT EXISTS (… r.status = 'pending_verification')`, có test SQL trực tiếp (`pending_verification` → null, `submitted` → `rejected`). `opsBoardActions` trong `domain/request-board.ts` là quy tắc duy nhất cho route và view. `publicationTransition` không đổi (test 2702b giữ nguyên). Test ghim bảng hành động: `pending_verification` → `[]`, `submitted` → `[publish, reject]`, request đóng → `[reject]`, `published` + `removed` → `[edit, unpublish]`, `rejected` → `[]`. |
| L-3 | **Đã đạt** | Báo cáo dán lần chạy đỏ trước khi sửa: 6 failed / 30 passed, mỗi dòng đỏ tương ứng một phát hiện. L-4a/b xanh ngay vì hành vi vốn đúng, chỉ thiếu test ghim. |
| L-4 | **Đã sửa** | (a) sai trạng thái kèm nội dung sai thì 409 (edit trên `pending_review`, reject trên `published` với lý do rỗng); (b) `toEqual` `data` của edit, unpublish, reject, và vắng email **của client** (đọc từ `users`), tên client, câu chữ; (c) 60 dòng audit xen kẽ hai entity: History có đúng 50 dòng, giảm dần, hai dòng đầu xen kẽ. |
| S-1 | **Đã sửa** | Gộp rồi `slice(0, HISTORY_LIMIT)`. History của publication chạy trong cùng `Promise.all` khi `canAct`. |
| S-2 | Để lại 2704b | Như đã quyết. |

**Ghi chú nhỏ (không phải phát hiện):** (1) Với Owner/Operator, History của publication giờ được truy vấn cả khi request không có publication: thêm một lần đọc D1 song song, kết quả bị bỏ. Chấp nhận được vì đổi lại không có vòng nối tiếp. (2) `RequestDetailRender.item` đổi từ `AdminRequest` sang `NonNullable<Awaited<ReturnType<typeof findAdminRequest>>>`: cùng kiểu, chỉ khác cách viết.

### Verdict cuối

**APPROVE.** Mọi phát hiện được duyệt đã đóng; S-2 chuyển sang 2704b. Nghĩa vụ ở mục "Nghĩa vụ để lại cho task sau" vẫn giữ, trừ gạch L-2 của 2704b (đã sửa ở R1). Đã ghi vào `.ai/context/CURRENT-STATUS.md`.
