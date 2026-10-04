# M6 (VNX-0601 … VNX-0606) — Review

- **Reviewer:** Claude (điều phối) + reviewer độc lập cho từng task (Opus) và review toàn nhánh (Opus)
- **Ngày:** 2026-10-04
- **Đã đọc:** `CLAUDE.md`; header plan `docs/superpowers/plans/2026-10-04-vnxsi-m6-request.md` (dòng 1–118: mục tiêu, kiến trúc, quyết định Owner và Reviewer, Global Constraints, Review Focus 1–5); spec Wave 1 §3, 5.2–5.5, 5.7, 6.1, 7.5, 7.6, 8.2–8.4, 8.8, 8.10, 9 (Request), 12; ADR-002/003/004; các ruling và minor để lại trong `.superpowers/sdd/2026-10-04-vnxsi-m6-request/final-review-inputs.md`; toàn bộ diff code `bf5eb3f..e70da19` (src, migration, wrangler, legal); diff test (đọc kỹ các test của Review Focus và `test/request-gate.test.ts`)
- **Lệnh đã chạy lại (review toàn nhánh, `e70da19`):**
  - `npm run typecheck -w apps/web` → exit 0
  - `npm test` → 93 file, 678/678 test xanh
  - `npm test -w apps/web -- test/request-gate.test.ts` → 1 file, 4/4 test xanh
- **Trạng thái nhánh:** `main` vẫn ở `bf5eb3f` (điểm tách nhánh), merge được dạng fast-forward, không cần gộp lại.

## Verdict

APPROVE WITH CHANGES.

Không có BLOCKER hay HIGH, và không có lỗi code nào phải sửa trước khi merge. Một MEDIUM, thuộc phần tài liệu và quy trình (F1: `CURRENT-STATUS.md` chưa phản ánh M6), Reviewer phải làm trước khi merge theo bước 11 của `CLAUDE.md`. Các phát hiện LOW (F2–F7) và SUGGESTION (F8) không chặn merge: Owner chọn sửa ngay hoặc ghi vào "Ghi nhận". F7 cần Owner quyết định về nghiệp vụ.

Nhìn chung, bảy task khớp nhau: mọi chuyển trạng thái của request và lời mời đều là compare-and-set có điều kiện bảo vệ; mọi đường vào trạng thái cuối đều đi qua `endRequestBatch`; cổng 5 lời mời nằm trong chính câu `INSERT`; builder không thấy email của client ở bất kỳ bề mặt nào; i18n đủ 4 locale; Privacy khớp với code.

## Phát hiện của review toàn nhánh

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM (tài liệu, Reviewer làm) | `.ai/context/CURRENT-STATUS.md:9`, `:128`, `:137` | M6 vẫn ghi "đang làm". Chưa có SHA từng task, các ruling trong lúc thực thi (khoảng 20 dòng "Ruling" trong `final-review-inputs.md`), các quyết định Owner phát sinh (email thứ 9 "lời mời đã kết thúc", che tên giống email, điểm trừ chỉ tính lời mời hết hạn vì không trả lời, gỡ request `builder_selected` thì giữ Inquiry, không gửi email kết thúc cho builder bị khóa) và mục Ghi nhận. Hai nghĩa vụ cũ (`:128` nút "Post a request" và sitemap, `:137` `deleteGhostUsers` xét `requests`, `request_verify`) đã làm xong nhưng chưa đóng. Theo `CLAUDE.md`, task chưa xong khi `CURRENT-STATUS.md` chưa phản ánh nó. | Cập nhật trước khi merge: trạng thái và SHA 7 task (`f7222e8`/`f91f587`, `26cd57a`, `75d0bb3`/`a32f397`, `b217503`, `d484b16`, `69069c8`/`a5c7554`, `1d1ea62`), quyết định, sai khác roadmap (VNX-0602 tách a/b), nghĩa vụ ở mục cuối review này, các minor để lại vào Ghi nhận, và đóng hai nghĩa vụ cũ. |
| F2 | LOW | `apps/web/src/domain/request.ts:346` | Gợi ý builder (§8.10) so kỹ năng theo chuỗi con: "Go" khớp "good", "Google"; "AI" khớp "maintain", "email"; "R" hay "C" khớp gần như mọi mô tả. Builder có kỹ năng ngắn được cộng tới +3 điểm sai. Admin vẫn thấy lý do từng điểm nên không chọn nhầm, nhưng dữ liệu "lựa chọn của admin" dùng để huấn luyện ở Wave 2 sẽ lệch. Spec chỉ ghi "xuất hiện trong", nên đây là cách đọc theo chữ. | Khớp theo ranh giới từ cho kỹ năng chữ Latin, giữ khớp chuỗi con cho chữ CJK. Đây là một luật nhỏ: Owner duyệt trước khi sửa. Làm trước Wave 2 là đủ. |
| F3 | LOW | `apps/web/src/db/requests.ts:475`, `:489`; `apps/web/src/jobs/daily.ts:101`; `apps/web/src/routes/admin.tsx:86` | Spec §7 ghi "mỗi chuyển thành công ghi một dòng `audit_log`". Lời mời `invited → expired` do cron (sau 7 ngày) và do khóa builder hoặc user không có dòng audit nào. Các chuyển khác (`not_selected`, `expired` khi request kết thúc) có dòng audit ở mức request. Hiện không có số liệu nào cần dòng này (điểm trừ §8.10 đọc `updated_at - invited_at`). | Thêm `request_invite.expire` (actor null) cho mỗi lời mời hết hạn, hoặc ghi ngoại lệ này vào ARCHITECTURE. Làm sau được. |
| F4 | LOW | `apps/web/src/domain/request.ts:120`, `apps/web/src/db/requests.ts:535`, `apps/web/src/db/users.ts:88` | Admin gỡ được request `pending_verification`: luật `remove` nhận "mọi trạng thái" và nút gỡ có ở mọi trạng thái trừ `removed`. Sau đó cron chỉ xóa request đang `pending_verification`, còn `deleteGhostUsers` bỏ qua user có request. Kết quả: request chưa bao giờ được xác nhận và tài khoản ngầm của nó nằm lại mãi, trái với câu Privacy "Requests you never confirmed: deleted after 48 hours". Inquiry ở M5 có cùng khuôn này. | Từ chối gỡ khi đang `pending_verification` (cron sẽ xóa sau 48 giờ), áp cho cả request và Inquiry. Hoặc cho cron xóa luôn request `removed` có `submitted_at IS NULL`. Owner chọn một trong hai. |
| F5 | LOW | `apps/web/src/db/requests.ts:250` | Đề xuất `proposed` của builder đã bị khóa vẫn chiếm một trong 5 chỗ. Client không chọn được đề xuất đó (bị chặn ở route và trong SQL), còn admin không mời được người thay. Nếu nhiều builder bị khóa, request đứng yên tới khi hết hạn 30 ngày. Spec 7.6 chỉ cho lời mời `invited` hết hạn. | Chỉ đếm đề xuất của builder công khai vào giới hạn 5, hoặc ghi vào Ghi nhận (hiếm gặp ở quy mô Wave 1). |
| F6 | LOW (tài liệu, Reviewer làm) | `docs/legal/privacy.md:8` | Dòng "Đối chiếu code M6" chỉ để chỗ, không có SHA và không nêu dữ kiện code như dòng M5: bộ đếm `request:ip:*` (lưu IP thô) và `request:email:*` (lưu hash) ở `routes/request-form.tsx`; xóa sau 48 giờ ở `jobs/daily.ts` (`pending_requests`, `ghost_users`); builder chỉ thấy tên đã che qua `builderFacingName`. Câu "Proposals: … or that you declined" cũng chưa nhắc lý do từ chối, một ô chữ tự do chỉ admin thấy. | Viết lại dòng đối chiếu với SHA `e70da19` và các dữ kiện trên; chạy lại `test/legal`. Nếu muốn nhắc "kèm lý do nếu có" thì đó là đổi câu chữ, cần Owner duyệt (không bắt buộc). |
| F7 | LOW (cần Owner quyết) | `apps/web/src/notify/request.ts:57`, `:166`; `apps/web/src/db/requests.ts` (`inviteBuildersBatch`) | Theo ruling trong lúc thực thi, request của client đã bị khóa vẫn chạy: admin vẫn mời được, builder vẫn gửi đề xuất, email đề xuất và email hết hạn vẫn gửi tới tài khoản đã khóa (tài khoản này không đăng nhập vào `/me` được). Spec không có luật cho trường hợp này. | Hỏi Owner: giữ nguyên (admin tự gỡ spam), hay khi khóa user thì kết thúc các request đang mở của họ qua `endRequestBatch` (`removed`) trong cùng batch khóa. |
| F8 | SUGGESTION | `apps/web/src/routes/hub-invitations.tsx:63` | Builder bị khóa (`builders.status`, tài khoản vẫn `active`) vẫn mở được `/hub/invitations/:id` và đọc toàn bộ request kèm tên client đã che, kể cả sau khi lời mời đã hết hạn. Điều này khớp câu Privacy ("a builder invited to your request also sees the request"). | Có thể ẩn nội dung request với builder không còn `approved`. Không bắt buộc. |

## Đối chiếu Review Focus 1–5 (toàn nhánh)

| Focus | Đạt? | Bằng chứng |
|---|---|---|
| 1. Builder không thấy email client | ✓ | Mọi bề mặt builder thấy đều đọc tên qua `builderFacingName`: `RequestFacts showClient`, `InvitationsPage`, `InquiryThread`, `hub/InquiriesPage`, `routes/hub-inquiries.tsx`, `notify/inquiry.ts`, `jobs/daily.ts`. Email mời, nhắc và "được chọn" bắt buộc kiểu `BuilderFacingName` nên trình biên dịch kiểm. Tin nhắn đầu (`requestFirstMessage`) chỉ có tiêu đề, mô tả và đề xuất. Email báo admin không có email client. Test: `test/me/mask.test.ts` (client gõ email làm tên, từ lời mời tới nhắc), `request-gate.test.ts` (trang Hub và email gửi builder: subject, text, html), `hub/invitations.test.ts:61`, test kiến trúc "builder-facing client name". |
| 2. Truy cập chéo → 404 | ✓ | `findBuilderInvitation` lọc theo `builder_id` và ẩn request `removed`; `findClientRequest` lọc theo `client_user_id` và ẩn `removed`; route chọn đề xuất tìm `invite` trong danh sách lời mời của chính request đó; SQL `setRequestStatusStatement` yêu cầu `x.request_id = ?1`. Test: `hub/invitations.test.ts:76`, `me/select.test.ts:132`, `me/requests.test.ts:97,105`, `db/requests.test.ts:207`. |
| 3. Lách giới hạn mời | ✓ | `inviteBuildersBatch` kiểm cả 5 điều kiện trong chính `INSERT … SELECT … WHERE`: request đang `submitted` hoặc `matching`, không phải chính client, builder `approved` trên tài khoản `active`, chưa từng được mời, dưới 5 lời mời đang mở. Các câu trong một batch thấy lẫn nhau; các batch chạy tuần tự. Unique (`request_id`, `builder_id`). Request chỉ chuyển `matching` khi chính batch đó đã mời được ít nhất một người. Test: `admin/requests.test.ts:153–224` (mời người thứ 6, mời trùng, mời chính mình, builder bị khóa, request đã đóng, hai lần POST đồng thời), `db/requests.test.ts:45,72,232`. |
| 4. Trạng thái và đua | ✓ | Gửi và từ chối đề xuất dùng `ANSWERABLE` (lời mời `invited`, request `matching`, builder công khai) cùng audit có điều kiện. Chọn đề xuất là một batch: compare-and-set trên request (kèm kiểm lời mời `proposed` và builder công khai), Inquiry và tin nhắn đầu có điều kiện, `markInviteSelected`, dọn các lời mời còn lại, audit gắn với Inquiry. Đã đọc lại các trường hợp cùng mili giây: chọn cùng một đề xuất hai lần, hoặc hai đề xuất khác nhau, đều không tạo được Inquiry thứ hai. Test: `me/select.test.ts:101,114,124,143`, `db/requests.test.ts:143,192`, `hub/invitations.test.ts:168,193`. |
| 5. Form công khai bị lạm dụng | ✓ | Honeypot cho cả khi đã đăng nhập và chưa đăng nhập; Turnstile sai hoặc thiếu trả 400; Turnstile chưa cấu hình trả 503 và đóng form. Nhánh dịch vụ lỗi đi cùng đường `unavailable` nên chung một xử lý. Rate limit 3 lần/ngày mỗi email (người chưa đăng nhập nhận trang "kiểm tra email" như thành công, người đã đăng nhập nhận 429) và 10 lần/giờ mỗi IP. Chỉ đếm khi form hợp lệ. Email của user bị khóa nhận trang thành công mà không tạo gì. Gửi email xác nhận lỗi thì xóa request vừa tạo và báo 502. Test: `public/request-form.test.ts:93–172`. |

## Đối chiếu state machine (spec 7.5 / 7.6)

| Chuyển | Người làm, chặn ở đâu | Dọn lời mời khi request vào trạng thái cuối |
|---|---|---|
| `verify` pending → submitted | Hệ thống qua link (`auth.tsx` `confirmRequest`), hoặc client qua "Gửi ngay" (`me-requests.tsx`, chỉ chủ request); cả hai đều qua `openPendingRequest` có compare-and-set | không phải trạng thái cuối |
| `invite` submitted/matching → matching | `requireAdmin` + `inviteBuildersBatch` | không phải trạng thái cuối |
| `reject` submitted → rejected | `requireAdmin`, lý do bắt buộc | `endRequestBatch` (qua `end()`) |
| `select` matching → builder_selected | `requireUser` + chủ request | `endRequestBatch` với `between` |
| `close` submitted/matching → closed | `requireUser` + chủ request | `endRequestBatch` |
| `expire` matching → expired | cron (30 ngày tính từ `matched_at`) | `endRequestBatch` |
| `remove` mọi trạng thái → removed | `requireAdmin` | `endRequestBatch` (qua `end()`) |
| Lời mời `propose` / `decline` | `requireBuilder` + `builder_id` + `ANSWERABLE` | — |
| Lời mời `select` / `not_select` | trong batch chọn / `endRequestBatch` | — |
| Lời mời `expire` | cron sau 7 ngày (`expireStaleInvites`); khóa builder (`admin.tsx`, ngay sau đổi trạng thái); khóa user (`admin-users.tsx`, cùng batch); cron quét lại hằng ngày | — |

Cả 5 đường vào trạng thái cuối đều đi qua `endRequestBatch`, và mọi câu dọn lời mời đều kiểm compare-and-set của chính batch đó. Email kết thúc chỉ gửi sau khi commit, chỉ khi thắng compare-and-set, và bỏ qua builder không còn công khai (`publicBuilderOnly`).

## Đối chiếu ràng buộc chung

- **Sở hữu bảng:** chỉ `db/requests.ts` ghi `requests` và `request_invites`, test kiến trúc kiểm. `db/audit.ts`, `db/inquiries.ts`, `db/users.ts` chỉ đọc hai bảng này trong điều kiện bảo vệ. ✓
- **`RETURNING` thay `meta.changes`:** mọi compare-and-set mới đều dùng `RETURNING`. `admin-users.tsx` vẫn đọc `results[0].meta.changes` của bảng `users` (code M2; câu hết hạn lời mời thêm vào phía sau nên không ảnh hưởng). ✓
- **`Cache-Control: no-store`:** `noStorePrivate` áp cho `/hub*`, `/me*`, `/admin*` nên phủ cả `/me/requests/*`, `/hub/invitations/*`, `/admin/requests/*`; `/auth/verify` tự đặt. Riêng `/request` khi đã đăng nhập điền sẵn tên mà không có no-store (minor của Task 3, cùng cách với form Inquiry ở M5). ✓
- **Origin check:** `originCheck` toàn cục cho mọi method không an toàn; test `hub/invitations.test.ts:227`. ✓
- **i18n 4 locale:** test `i18n/parity` xanh. Tiếng Việt dùng đúng thuật ngữ: request là "nhu cầu" (`request.cta` "Đăng nhu cầu", `admin.nav.requests` "Nhu cầu"), Inquiry là "yêu cầu" (`hub.invitations.inquiry` "Mở yêu cầu", `me.inquiries.title` "Yêu cầu"); `inquiry.type.request` đổi thành "Từ nhu cầu đã đăng". Hai bản tiếng Trung dùng 需求 cho request và 咨询/詢問 cho Inquiry, nhất quán. ✓
- **ADR-004:** điểm gợi ý chỉ gồm 5 luật của §8.10; hòa điểm thì xếp theo handle; không có tham số trả tiền. Màn admin ghi rõ "Nobody pays to appear here". ✓ (F2 là chuyện độ chính xác, không phải ranking có trả tiền.)
- **ADR-002:** `request_verify` dùng cùng token 15 phút, dùng một lần, cùng trang xác nhận VNX-0506; user bị khóa nhận 403. ✓
- **Privacy:** `docs/legal/privacy.md` và `src/legal/content.ts` có đủ request (tên gõ, tiêu đề, mô tả, danh mục, ngân sách, hạn chót, ngôn ngữ, email và tài khoản ngầm), đề xuất (cách làm, giá, thời gian, ghi chú, việc từ chối), Turnstile, mục đích ghép, ai thấy gì, và thời hạn giữ. Câu chữ đúng nguyên văn Owner duyệt; test `legal/content` so từng dòng. Còn F4 và F6. ✓
- **Deploy:** comment trong `wrangler.jsonc` thêm `0008_requests` vào danh sách migration và ghi "migrate trước, deploy sau". Không có secret, binding hay cron mới; `ADMIN_EMAILS` đã có từ trước. Migration chỉ thêm, không có FK nào làm hỏng thao tác xóa ở `login_tokens.request_id` hay `inquiries.request_id`. ✓

## Đối chiếu cổng ra M6 (spec §9, phần Request)

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Client chưa đăng nhập gửi → xác nhận email → `submitted` → admin mời 2 builder → `matching` → A gửi đề xuất, B từ chối → client chọn A → `builder_selected`, có Inquiry `type = request` giữa client và A | ✓ | `request-gate.test.ts:20` (toàn bộ qua HTTP; kiểm thêm hai bên trả lời được trong Inquiry và builder không thấy email client ở trang lẫn email) |
| Không mời được builder thứ 6 khi đã có 5 lời mời `invited`/`proposed` | ✓ | `request-gate.test.ts:98` (route); chặn trong SQL ở `admin/requests.test.ts:153,224`, `db/requests.test.ts:45` |
| Builder không được mời thì không xem được request (404) | ✓ | `request-gate.test.ts:110`; `hub/invitations.test.ts:76` |
| Gợi ý: builder có product cùng category xếp trên builder không có; builder `closed` không xuất hiện | ✓ | `request-gate.test.ts:84`; `admin/requests.test.ts:76` |
| Unit: mọi chuyển hợp lệ và không hợp lệ của request và lời mời | ✓ | `test/domain/request.test.ts` |

Phần còn lại của spec: §5.2 (`/request`, nút ở `/builders`, trạng thái rỗng của `/products`, landing) ✓; §5.3 (Invitations, số lời mời trên trang tổng quan) ✓; §5.4 ✓; §5.5 (hàng chờ, gợi ý, mời, trả về, spam, theo dõi `matching`) ✓; §8.3 (đủ các email request trong danh sách) ✓; §8.4 (nhắc sau 3 ngày, hết hạn sau 7 và 30 ngày, xóa sau 48 giờ, chạy lại không gửi trùng) ✓; §8.8 (`/request` có trong sitemap) ✓; §12 (câu "thường có đề xuất trong 3 ngày làm việc"; có `submitted_at` và `matched_at` để đo) ✓. Bảng thước đo §3 và dải Live thuộc M7; dữ liệu đã có sẵn.

## Phân loại minor để lại

Không minor nào phải sửa trước khi merge.

| Task | Minor | Phân loại | Lý do |
|---|---|---|---|
| 1 | Cần comment cho `ORDER BY rowid` | Đã xong | Comment có ở `listRequestInvites` |
| 1 | Khớp kỹ năng theo chuỗi con | OK để sau | Thành F2, làm trước Wave 2 |
| 1 | Thiếu test db (user bị khóa của builder `approved`, builder `pending`, id trùng trong batch, mời vào request `pending_verification`, điều kiện audit `inviteId`) | OK để sau | Phần lớn đã phủ ở mức route trong `admin/requests.test.ts:196,211` và `hub/invitations.test.ts:193` |
| 1 | Fixture `inviteBuilders` báo lỗi khó hiểu khi bỏ qua builder | OK để sau | Chỉ ảnh hưởng test |
| 1 | Phần Task 1 của plan còn dùng tên kiểu `Request` | OK để sau | Việc tài liệu, nằm ở Nghĩa vụ |
| 1 | Thiếu test user `suspended` sau khi gửi đề xuất | OK để sau | SQL đã chặn; `me/select.test.ts:124` phủ trường hợp builder bị khóa |
| 2 | `auth.tsx` mặc định mục đích lạ thành "request" | OK để sau | `VERIFY_PURPOSES` chỉ nhận 3 giá trị, nhánh này không chạy tới được |
| 2 | `timelineDays ?? 0` có thể in "0 ngày" | OK để sau | Chỉ gửi khi `proposed`, mà lúc đó cột luôn có giá trị 1–365 (CHECK ràng buộc) |
| 2 | Hai lần xác nhận cùng mili giây có thể ghi audit trùng | OK để sau | Cùng khuôn với M5; khả năng xảy ra gần như bằng không. M7 cần biết (Nghĩa vụ) |
| 2 | Kiểu `Email` lặp lại; 3 vòng gửi giống nhau | OK để sau | Chất lượng code |
| 2 | Test mới không có lần chạy đỏ trước | OK để sau | Chuyện quy trình |
| 3 | Thiếu test: request `removed` khi POST confirm/close, 502 ở mức route, GET khi Turnstile chưa cấu hình, Turnstile `unavailable` → 503 | OK để sau | 503 đã có test qua nhánh chưa cấu hình (cùng đường code); 502 có test ở `createPendingRequestAndMail` |
| 3 | `/request` khi đã đăng nhập không có no-store; dòng trống thừa ở `me.tsx`; đăng request khi đã đăng nhập ghi hai lần | OK để sau | Cùng cách với M5; ghi vào Ghi nhận |
| 3 | Test spam chỉ kiểm text và html, không kiểm subject | OK để sau | Subject đã được kiểm ở `request-gate` và `mask.test.ts` |
| 4 | Test POST đồng thời có thể đi nhánh 400 | OK để sau | Test ở mức DB đã chứng minh điều kiện bảo vệ |
| 4 | Gỡ hai lần cùng mili giây ghi 2 audit | OK để sau | Cùng khuôn với M5 |
| 4 | Danh sách admin rỗng dùng lại `me.requests.empty`; cột "Proposals" đếm cả lời từ chối; chuỗi số chỗ ghi cứng số 5 | OK để sau | Nên đổi nhãn thành "Answered" (`db/requests.ts:328`, `en.ts:576`); ghi vào Ghi nhận |
| 4 | Gỡ một request đã kết thúc thì `closed_at` bị ghi đè | OK để sau | Chỉ quan trọng khi M7 đọc `closed_at` (Nghĩa vụ) |
| 5 | Bộ lọc số lời mời trên tổng quan chưa test; comment quy trình ở `db/requests.ts`; ô lý do từ chối thiếu `aria-describedby`; bảng thiếu `<thead>`; từ chối chỉ một lần bấm, không hỏi lại; audit trùng cùng mili giây | OK để sau | Giao diện và a11y; ghi vào Ghi nhận |
| 6 | Test quét kiến trúc lách được bằng destructuring; `notify/request.ts` nằm ngoài danh sách quét; `requestTitle ?? ""`; chưa test chọn đồng thời hai đề xuất khác nhau qua route; `requestTitle` trong email tổng hợp gửi admin chưa test; độ dễ đọc của `?? / ?:`; câu gợi ý chọn vẫn hiện khi không có gì để chọn | OK để sau | Kiểu `BuilderFacingName` đã chặn ở các template email; chọn đồng thời đã test ở mức DB (`db/requests.test.ts:143`) |
| 7 | Test "sweeps what the route missed" có lỗi FK của `ghost_users` trong output | OK để sau | Chỉ do fixture (admin của fixture chưa đăng nhập). Nên thêm khẳng định "không bước nào lỗi" như test idempotent |
| 7 | `deleteGhostUsers` thiếu `NOT EXISTS request_invites.invited_by` | OK để sau | Không xảy ra ở production: người mời luôn là admin đã đăng nhập (`last_login_at` khác null). Sửa chỉ một dòng nếu muốn chắc |
| 7 | Giới hạn 200 dòng không chặn được số email mỗi lần chạy; cảnh báo `capped` chưa test; thứ tự import; test không mock `console.log` | OK để sau | Quy mô Wave 1 |

## Câu hỏi cho Owner

1. F7: client bị khóa thì các request đang mở của họ xử lý thế nào?
2. F4: cấm gỡ khi đang chờ xác nhận, hay cho cron xóa luôn request đã gỡ mà chưa từng xác nhận (áp cho cả Inquiry)?
3. F2: đổi sang khớp kỹ năng theo ranh giới từ cho chữ Latin (một luật nhỏ của §8.10)?

## Nghĩa vụ để lại

- **Trước khi merge (Reviewer):** F1 (cập nhật `CURRENT-STATUS.md`) và F6 (dòng đối chiếu code M6 trong `privacy.md`, rồi chạy `npm test -w apps/web -- test/legal`). Sửa phần Task 1 của plan dùng `ClientRequest` thay `Request`. ARCHITECTURE §2: dòng `notify/` ghi thêm M6 (`notify/request.ts`, gửi một lần, không có cột gửi lại).
- **Deploy (Owner):** `npm run db:migrate:remote -w apps/web` (có `0008_requests`) rồi `npm run deploy` liền sau. Không có secret mới. Cần `ADMIN_EMAILS` (đã có) để admin nhận email khi có request mới.
- **M7 (số liệu, Live, test kiến trúc tiền):**
  - "Request 30 ngày" đếm theo `requests.submitted_at`.
  - Dải Live đọc audit `request.submit` và `request.verify` (chỉ `category`, `languages`), và chịu được dòng trùng hiếm gặp (cùng mili giây).
  - Không dùng `closed_at` làm mốc kết thúc của request bị gỡ sau khi đã kết thúc (nó bị ghi đè).
  - "Top builder: được chọn" đếm `request_invites.status = 'selected'`; "trả lời nhanh" lấy `invited_at → responded_at`.
  - Test kiến trúc "ranking không đọc tiền" (ADR-007) phải gồm `db/requests.ts` (`listCandidates`) và `domain/request.ts` (`suggestBuilders`).
  - Bảng thước đo §3 (số request đã gửi, tỷ lệ có ít nhất một đề xuất, tỷ lệ chọn được builder) đọc thẳng `requests` và `request_invites`.
- **Trước khi số builder `approved` vượt 1000:** `listCandidates` đang lấy 1000 builder đầu tiên theo `user_id` trước khi chấm điểm (`db/requests.ts:368`). Lúc đó phải lọc hoặc chấm điểm trong SQL.
- **Trước Wave 2 (dữ liệu huấn luyện matching):** F2.
- **Ghi nhận (thêm vào `CURRENT-STATUS.md`):** F3, F5, F8; các minor "OK để sau" ở bảng trên; hai khuôn đã biết từ M5: có thể "gài" request chờ xác nhận vào tài khoản người khác (giảm thiểu bằng Turnstile, rate limit và xóa sau 48 giờ), và đăng request khi đã đăng nhập là hai lần ghi.
