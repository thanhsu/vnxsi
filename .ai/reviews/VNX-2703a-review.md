# VNX-2703a — Review

- **Reviewer:** Claude (Opus subagent review độc lập)
- **Ngày:** 2026-10-10
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (header, Global Constraints, Review Focus, Changelog delta, "Cần Owner/Reviewer lưu ý", mục Task VNX-2703a, ghi chú E2E); `.ai/context/CURRENT-STATUS.md` (nghĩa vụ EPIC 27); review `.ai/reviews/VNX-2702a-review.md`, `.ai/reviews/VNX-2702b-review.md`; phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §3.1, §6, §12.2, §12.4, §12.6, §17 Q1/Q2/Q4; báo cáo `.ai/tasks/VNX-2703a-report.md`; toàn bộ diff `f21eba8..ec99b6f` (14 file, +480/−24). Theo quy ước EPIC 27 (L-6), mục task của plan là handoff.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`):**
  - `npm run typecheck -w apps/web`: exit 0, không lỗi.
  - Bộ 2703a (`test/domain/request.test.ts test/public/request-form.test.ts test/request-gate.test.ts test/i18n/parity.test.ts test/jobs/daily-requests.test.ts`, `--maxWorkers=2 --testTimeout=60000`): **5 file, 81 test xanh**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **193 file, 2408 test xanh, 2 skipped** (553 s, không timeout; 2 skipped là kiểm tập cha Privacy/Terms chờ VNX-2707b).
  - `npm run test:scripts`: **52/52 xanh**. `npm run e2e:typecheck`: exit 0.
  - `npm run e2e` (một lần, `workers: 1`): **62 passed** (1.6 phút, không retry), gồm 3 test mới của `request-board-forms.spec.ts`; không còn tiến trình `wrangler`/`workerd` sau khi chạy.
  - So byte câu chữ đã duyệt (script Node đọc thẳng phụ lục §12.4/§12.6 và `en.ts`/`vi.ts`): nhãn EN 45 byte, mô tả EN 337 byte, nhãn VI 55 byte, mô tả VI 461 byte: **giống hệt**; VI ở dạng NFC cả hai phía.

## Verdict

**APPROVE_AFTER_FIXES** (APPROVE WITH CHANGES). Phần lõi đúng plan và phụ lục: L2 giữ nguyên đường không opt-in (cùng câu lệnh, cùng audit, chỉ thêm giá trị `country`), opt-in là **một** `db.batch` (request + publication + hai audit có guard), `consent_version = REQUEST_BOARD_GO_LIVE`, đường chưa đăng nhập ghi batch trước khi gửi mail và mail lỗi xóa request (cascade xóa publication, audit mồ côi không PII), 0 dòng → 500 có log, cổng tắt → `publish=1` bị bỏ qua, ô mặc định không chọn và chỉ hiện khi cổng bật, câu chữ EN/VI đã duyệt chép đúng từng byte, mẫu lỗi VNX-0807 đầy đủ. Phải sửa trước khi đóng task: câu gợi ý của trường `country` (H-1, câu chữ chưa được duyệt, sai khi cổng tắt) và Owner phải quyết khoảng hở Privacy của `country` (M-1) cùng nghĩa của nhãn (M-2).

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| H-1 | HIGH | `src/views/RequestFormPage.tsx:130-142`; `i18n/messages/*.ts` khóa `request.form.countryHint` | Câu gợi ý "Optional. If you publish this request, the country is shown on the public board." / "Không bắt buộc. Nếu bạn đăng nhu cầu này công khai, quốc gia sẽ hiện trên bảng công khai." (1) **hiện cả khi cổng tắt**: trường `country` luôn render, nên từ lúc nhánh vào `main` tới `REQUEST_BOARD_GO_LIVE` mọi người dùng thấy câu nói về một "public board" chưa tồn tại, không có ô nào để chọn, trước cả thông báo 14 ngày và trước khi Privacy/Terms nói tới bảng; (2) chưa nằm trong phụ lục, Implementer tự viết, mà nội dung là **công bố quyền riêng tư** (dữ liệu nào hiện công khai), nên cần Owner duyệt nguyên văn như §12.4; (3) "If you publish" sai tác nhân: client không publish, client chọn hiện và Ops kiểm duyệt rồi publish; (4) "public board" / "bảng công khai" lệch thuật ngữ đã duyệt "public request board" / "bảng nhu cầu công khai" (§12.6). Về nội dung: khi request được publish thì country **đúng là** hiện công khai (§12.2 mục 4, Q4 Ops không ẩn riêng trường có cấu trúc), nên ý chính đúng; chỉ cách nói và lúc hiện sai. | Chỉ render vế về bảng khi `p.board`; khi cổng tắt chỉ "Optional." / "Không bắt buộc." (hoặc không có gợi ý). Dùng câu Owner duyệt (đề xuất ở mục "Câu chữ cần Owner duyệt"). Test: cổng tắt → HTML không chứa "public" trong khối country; cổng bật → câu đã duyệt, so byte. | Owner (duyệt câu) → Implementer |
| M-1 | MEDIUM | `src/views/RequestFormPage.tsx:130-142`, `src/routes/request-form.tsx` (lưu `country` bất kể cổng); `docs/legal/privacy.md:31`, `privacy-m7.md:32` | Khoảng hở công bố: `country` được thu và lưu ngay khi code vào `main`, nhưng gạch "Requests" của **cả hai** phiên bản Privacy đang hiện chưa nhắc country; câu "and the country you choose" đã duyệt (§12.2/§12.6) chỉ vào phiên bản `board` (VNX-2707b), hiện từ `REQUEST_BOARD_GO_LIVE − 14`. Nếu `main` được deploy (M8, sửa lỗi…) với ngày board rỗng hoặc còn xa, site thu một trường mà Privacy không nêu. Plan không nói `country` có theo cổng hay không; Implementer làm đúng chữ plan (lỗ hổng ở plan, không phải lỗi Implementer). | Owner chọn một: (a) **khuyến nghị:** chỉ render và chỉ nhận `country` khi cổng bật (`board`), giá trị gửi lên khi cổng tắt bị bỏ qua như `publish`; vì cổng bật ⇒ hôm nay ≥ go-live ⇒ Privacy `board` đang hiện, khoảng hở đóng hẳn, và H-1 cũng tự hết vế "cổng tắt"; (b) giữ như hiện nay và Owner ghi nhận chấp nhận rủi ro (trường tùy chọn; trước go-live giá trị chỉ nằm trong DB, chưa hiện ở đâu); (c) thêm "country" vào gạch "Requests" của mọi phiên bản Privacy đang đạt tới được (cần Owner duyệt câu, sửa `privacy.md`, `privacy-m7.md`, 4 hằng số). | Owner quyết → Implementer |
| M-2 | MEDIUM | `i18n/messages/*.ts` `request.form.country` | Q1 (Owner duyệt) chốt **nghĩa** của trường là "Where is your business based?". Nhãn "Country" / "Quốc gia" không nói quốc gia của cái gì (nơi client ở, nơi làm dự án, thị trường đích). Vì giá trị này hiện công khai, nhập sai nghĩa vừa làm sai thông tin trên bảng vừa đổi mức nhận diện (phụ lục §12.4 cảnh báo đúng tổ hợp quốc gia + ngân sách + ngách). | Nhãn hoặc gợi ý nói rõ nghĩa Q1; câu do Owner duyệt (đề xuất bên dưới). | Owner (duyệt câu) → Implementer |
| L-1 | LOW | `i18n/messages/zh-hans.ts:600-609`, `zh-hant.ts` cùng khóa | zh dùng "您" trong khi các chuỗi `request.*` xung quanh dùng "你" (zh-hans có 126 dòng "你", 4 dòng "您"). Toàn bộ chuỗi zh mới (nhãn, mô tả opt-in, 4 chuỗi country) do AI dịch. | Đổi sang "你" cho khớp form; ghi vào danh sách người bản xứ đọc lại (VNX-0801). | Implementer (đại từ), Reviewer (Ghi nhận) |
| L-2 | LOW | `test/public/request-form.test.ts` ca "no retroactive publication" | Vế HTTP `GET /requests/${request.id}` → 404 **vô nghĩa cả sau 2705a**: URL công khai dùng `public_id`, không bao giờ dùng `request_id`, nên đường này luôn 404 dù có publication hay không. Báo cáo (điểm lệch 4) nói nó "sẽ thành kiểm thật ở 2705a": không đúng. Vế có giá trị là "không có dòng publication". Tương tự, "request `pending_verification` không vào hàng chờ" chỉ được khẳng định gián tiếp, trong khi `findPublicListing` + `requestVisibility` đã có từ 2702a/2702b. | Bỏ vế HTTP (hoặc đổi chú thích cho đúng); với ca chưa đăng nhập, thêm `requestVisibility(...)` của `findPublicListing(publicId)` là `hidden` và kiểm theo id rằng dòng không thuộc truy vấn hàng chờ (2702a có `countPublicationReviewQueue`; kiểm theo id, không theo tổng). Ca 404 thật của trang công khai để cho 2705a. | Implementer |
| L-3 | LOW | `test/public/request-form.test.ts` ca "gate off" | Plan mẫu test cờ M2: "Ca cổng tắt dùng **nửa ngày**, không bao giờ giả định cờ DB đang tắt". Ca POST `publish=1` khi cổng tắt dùng `boardEnv` (ngày đã tới) với cờ DB tắt; không có ca **cờ bật + ngày rỗng/tương lai** gửi `publish=1`. Ca GET dùng env rỗng nên đúng mẫu. | Thêm ca: cờ bật, `REQUEST_BOARD_GO_LIVE: ""` và một ngày tương lai → không có ô, POST `publish=1` tạo request không publication, không audit opt-in. | Implementer |
| L-4 | LOW | `test/public/request-form.test.ts` ca "the batch loses" | Khẳng định `COUNT(*)` toàn bảng `audit_log` không đổi, trái Global Constraints "không assert tổng toàn bảng" (D1 dùng chung). | Đếm theo `actor_user_id = user.id` (hoặc theo `entity_id` của request không tồn tại). | Implementer |
| S-1 | SUGGESTION | `src/routes/request-form.tsx:63`; test "0 rows" (`i === 1`) | Chỉ số `results[1]` gắn cứng với việc `createRequestStatements` trả đúng một câu. | `results[statements.length]` (test dùng cùng chỉ số). | Implementer |
| S-2 | SUGGESTION | `src/views/RequestFormPage.tsx:140` | Câu gợi ý country (có nội dung quyền riêng tư) không gắn `aria-describedby` vào `<select>` (cùng mẫu `emailHint` sẵn có). | Thêm `id="rq-country-hint"` và gộp vào `aria-describedby` (cùng id lỗi khi có lỗi). | Implementer (tùy chọn) |
| S-3 | SUGGESTION | `src/db/request-board.ts:143` (2702a), gọi từ `createRequestWithOptIn` | Ở đường tạo, `public_id` và `request.id` đều là `ulid(Date.parse(now))`: 10 ký tự đầu (dấu thời gian ms) trùng nhau, nên `public_id` công khai lộ thời điểm gửi request tới mili giây. Không suy ra được `request_id` (80 bit ngẫu nhiên khác nhau), nên quyết định thiết kế 7 vẫn đạt. | Ghi nhận cho 2705a/Owner; nếu muốn bỏ thì sinh `public_id` từ thời điểm khác hoặc ngẫu nhiên hoàn toàn (không đổi ở task này). | Reviewer (Ghi nhận) |

## Câu chữ cần Owner duyệt

Implementer tự viết (không có trong phụ lục), 4 locale. Câu đang có trong code:

| Khóa | EN | VI |
|---|---|---|
| `request.form.country` | Country | Quốc gia |
| `request.form.countryHint` | Optional. If you publish this request, the country is shown on the public board. | Không bắt buộc. Nếu bạn đăng nhu cầu này công khai, quốc gia sẽ hiện trên bảng công khai. |
| `request.form.countryAny` | Not specified | Không nêu |
| `request.error.country` | Choose a country from the list. | Hãy chọn một quốc gia trong danh sách. |

zh-Hans: 国家 / 可选。如果您公开此需求，国家将显示在公开需求板上。/ 未指定 / 请从列表中选择一个国家。 zh-Hant: 國家 / 選填。如果您公開此需求，國家將顯示在公開需求板上。/ 未指定 / 請從清單中選擇一個國家。 (AI dịch.)

Đề xuất thay (Reviewer, để Owner chọn hoặc sửa; theo H-1, M-2):

| Khóa | EN | VI |
|---|---|---|
| `request.form.country` | Where is your business based? | Doanh nghiệp của bạn ở quốc gia nào? |
| `request.form.countryHint` (khi cổng tắt, hoặc bỏ nếu chọn M-1 (a)) | Optional. | Không bắt buộc. |
| `request.form.countryHint` (khi cổng bật) | Optional. If you choose to show this request on the public request board, the country is shown there too. | Không bắt buộc. Nếu bạn chọn hiện nhu cầu này trên bảng nhu cầu công khai, quốc gia cũng được hiện ở đó. |
| `request.form.countryAny` | Not specified (giữ) | Không nêu (giữ) |
| `request.error.country` | Choose a country from the list. (giữ) | Hãy chọn một quốc gia trong danh sách. (giữ) |

Nhãn và mô tả ô opt-in (§12.4/§12.6) **đã duyệt**, chép đúng từng byte, không cần duyệt lại.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| `country` tùy chọn, `COUNTRY_CODES`, tên theo `Intl`, không điền từ IP | ✓ | `<select>` option rỗng đầu, `countryOptions(locale)`; test gửi `cf-ipcountry: VN` và không có option `selected` |
| Kiểm `country`: đúng mã hoặc rỗng; `XX`, `vn`, `USA`, khoảng trắng → `choice`; rỗng → `null` | ✓ | `parseRequestForm` (không trim, không đổi hoa thường); test domain 6 giá trị sai; CHECK `length(country) = 2` ở DB |
| `country=XX` → 400, không tạo gì, giữ giá trị khác và ô opt-in | ✓ | test "unknown country" (`expectErrorSummary(['rq-country'])`, `aria-describedby="rq-country-error"`, `checked`, `action="/request"`) |
| Ô opt-in: `name="publish" value="1"`, mặc định không chọn, chỉ khi cổng bật | ✓ | view `p.board ? … : null`; test HTML cổng tắt không có `name="publish"`, cổng bật không `checked`; e2e (1) |
| Cổng tắt: `publish=1` bị bỏ qua (request tạo, không publication, không lỗi) | ✓ (xem L-3) | `publish` chỉ khi `values.publish && c.get("requestBoard")`; test cờ tắt + ngày đã tới |
| L2: không chọn ô → đường cũ giữ nguyên | ✓ | Đọc code: không ô → `createRequest` (một `INSERT … RETURNING`, cùng SQL) + `writeAudit` rời sau đó, như `f21eba8`; chỉ khác giá trị bind `country`. Dữ liệu audit `request.submit` lấy từ `input` thay vì từ dòng trả về: cùng giá trị (`languages` đã lọc theo `WORK_LANGUAGES` rồi JSON khứ hồi). Đường chưa đăng nhập không ô: `request.create` vẫn ghi **sau** mail (test "without the box … unchanged") |
| Opt-in = một batch: request + publication `pending_review` + audit `request.submit`/`request.create` (guard `AuditRequestGuard`) + audit `request_publication.opt_in` (guard `AuditPublicationGuard`, data chỉ `consentVersion`) | ✓ | `createRequestWithOptIn`; test đã đăng nhập: 303, một dòng publication, `consent_version = 2026-01-01`, `public_title/description` null, audit opt-in actor = client, `{consentVersion}` |
| `consent_version = REQUEST_BOARD_GO_LIVE` | ✓ | cổng bật ⇒ biến là ngày hợp lệ, nên `?? ""` không bao giờ dùng tới |
| Chưa đăng nhập + ô: batch trước mail; mail lỗi → xóa request, cascade xóa publication; audit mồ côi không PII (L3) | ✓ | test L3: request và publication không còn (theo id), còn đúng `request.create` `{status}` và `request_publication.opt_in` `{consentVersion}`, không chứa email, tên, tiêu đề, câu chữ |
| Chưa đăng nhập + ô: `pending_verification`, publication `pending_review`; xác nhận email → `submitted`, publication giữ `pending_review`; không email staff trước xác nhận | ✓ (xem L-2) | test "signed out + box" theo luồng magic link thật |
| 0 dòng opt-in ở đường tạo → 500 + log, không im lặng (nghĩa vụ 2702a/2702b) | ✓ | `returnedPublication(results[1])` null → `console.error({"event":"request.opt_in_not_inserted"})` + throw; test proxy làm rỗng kết quả câu thứ 2 |
| Batch ném lỗi → không request, không publication, không audit | ✓ (xem L-4) | test proxy `batch` ném |
| Phiên `oauth_google` opt-in được (controller quyết 1) | ✓ | test "an OAuth session can opt in" |
| Không hồi tố | ✓ (xem L-2) | request cũ (`makeRequest`) không có dòng publication; không có migration điền dữ liệu |
| Mẫu lỗi VNX-0807: mục tóm tắt `#rq-country`, `<p id="rq-country-error" class="error-msg">`, `aria-invalid`/`aria-describedby`, không `role="alert"`, không `#fragment`, giữ ô và `country` khi 400 vì trường khác, `<title>` có tiền tố | ✓ | view (`fieldErrorKey`, thứ tự tóm tắt theo thứ tự trang: deadline → country → languages); test Vitest và e2e (EN + VI, focus `#form-errors`, URL không `#`) |
| Câu chữ EN/VI ô opt-in đúng nguyên văn §12.4/§12.6 | ✓ | so byte (ở trên) và test `request-form.test.ts` |
| i18n đủ 4 locale, parity | ✓ | `parity.test.ts` xanh; zh do AI dịch (L-1) |
| CSP: không `style=`/`<script` inline mới | ✓ | view chỉ dùng class sẵn có (`field`, `choice`, `hint`, `error-msg`); test CSP của `views/` xanh trong bộ đầy đủ |
| Body 70 KB có `publish` → 413 | ✓ | test "body limit" |
| Không lộ request ra Ops/công khai trước xác nhận | ✓ | `requestVisibility` → `hidden` cho `pending_verification`; `publishStatement` đòi request mở; `countPublicationReviewQueue` chỉ đếm `submitted|matching`; chưa có route công khai nào (2705a). Email staff chỉ ở đường đã đăng nhập, như trước |
| E2E: `REQUEST_BOARD_GO_LIVE: "2026-01-01"` ở `serve.mjs`, cờ bật trong seed, 3 test `/request`, README | ✓ | diff; spec chỉ gửi form sai (bị từ chối trước `hitRateLimit`, `request-form.tsx:115-117`), ngân sách POST thêm 0; dòng `feature_flags` không ảnh hưởng số homepage (`test:scripts` 52/52 giữ ngưỡng `MIN`); các spec khác thấy ô opt-in trên `/request` nhưng vẫn xanh |

### Ghi chú thêm

- Đường chưa đăng nhập có ô: nếu `createLoginToken` lỗi sau batch thì request + publication + hai audit nằm lại ở `pending_verification` cho tới cron 48 giờ (cascade). Cùng hành vi với request không ô trước đây (trừ hai dòng audit); chấp nhận.
- 0 dòng ở đường đã đăng nhập: request `submitted` đã commit, không có publication và không email staff, client thấy 500 và có thể gửi lại (trùng). Chỉ xảy ra khi bất biến hỏng (câu `optInStatement` chạy ngay sau INSERT của chính nó trong cùng batch), nên chấp nhận như nghĩa vụ 2702b yêu cầu.
- `publish` lặp (`["1","0"]`) lấy giá trị đầu, như mọi trường đơn khác của form.

## Nghĩa vụ để lại cho task sau

- **Vòng sửa 2703a:** H-1, L-1 (đại từ), L-2, L-3, L-4 (Implementer) sau khi Owner duyệt câu chữ (H-1, M-2) và chọn phương án M-1; S-1, S-2 tùy chọn.
- **VNX-2703b:** câu chữ nút opt-in ở `/me` dùng cùng khóa `request.board.optIn.label|hint` (đã duyệt); nếu M-1 chọn (a) thì `/me` không có trường country.
- **VNX-2704a / 2704b:** test theo id rằng publication của request `pending_verification` không vào danh sách hàng chờ và bộ lọc `public=pending` (phần plan 2703a để lại).
- **VNX-2705a:** ca 404 thật cho request không có publication (qua `public_id` hợp lệ của một publication khác trạng thái, hoặc `public_id` không tồn tại), thay vế HTTP vô nghĩa của L-2.
- **Reviewer (Ghi nhận / CURRENT-STATUS):** chuỗi zh của 2703a (nhãn, mô tả opt-in, 4 chuỗi country) vào danh sách người bản xứ đọc lại (VNX-0801); S-3 (dấu thời gian chung của `public_id` và `request.id`); quyết định M-1 của Owner.
