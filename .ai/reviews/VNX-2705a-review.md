# VNX-2705a — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-12
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (header, Changelog delta, Quyết định của Owner, Quyết định thiết kế 6/7/8/11/12, Global Constraints, Review Focus 1/2/6, mục Task VNX-2705a và phạm vi 2705b/2706a, "Cần Owner/Reviewer lưu ý"); `.ai/context/CURRENT-STATUS.md` (mọi nghĩa vụ ghi cho VNX-2705a từ review 2702a/b, 2703a, 2704a, 2703b, 2702c, 2704b, và S-3 ở "Ghi nhận"); các review `.ai/reviews/VNX-2702a|2702b|2702c|2703a|2703b|2704a|2704b-review.md`; phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §3.3, §4.1, §4.2, §6, §7.3, §8, §9.6, §10, §11, §12.2–12.6; ADR-003, ADR-004; câu chữ đã duyệt `request.board.optIn.*`, `me.board.*`, `email.board*` (thuật ngữ); báo cáo `.ai/tasks/VNX-2705a-report.md`; toàn bộ diff `1d296aa..c6e1ba1` (27 file, +1263/−12; code `3247173`, báo cáo `c6e1ba1`). Theo quy ước EPIC 27, mục task của plan là handoff.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `c6e1ba1`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/public/request-board-list.test.ts test/public/request-board-detail.test.ts test/architecture.test.ts test/i18n/parity.test.ts test/lib/ulid.test.ts test/db/request-board.test.ts test/me/request-board.test.ts`: **7 file, 163 test xanh**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **200 file, 2556 passed + 2 skipped** (330 s; 2 skipped là kiểm tập cha Privacy/Terms chờ VNX-2707b). Khớp báo cáo. Không gặp OOM.
  - `npm run e2e` (một lần, `workers: 1`): **76 passed, 1.4 phút**, exit 0. Sau khi chạy không còn tiến trình `workerd`/`node` nào của worktree.
  - `npm run test:scripts`: 53 pass (ngưỡng `MIN` của homepage không đổi). `npm run e2e:typecheck`: sạch.

## Verdict

**APPROVE_AFTER_FIXES** (APPROVE WITH CHANGES).

Phần lõi đúng plan, phụ lục và các nghĩa vụ để lại. Không có phát hiện BLOCKER/HIGH/MEDIUM.

- **Không lộ danh tính.** Truy vấn công khai chỉ qua `LISTING_SELECT` (cột cho phép của `request_publications` JOIN `requests`; không `r.*`, không `client_name`, `client_user_id`, `locale`, `admin_note`, `title`/`description` gốc, `review_note`). Route chỉ gọi `findPublicListing`, `listOpenPublications`, `countOpenPublications` và (khi đã đăng nhập, listing đang mở) `findViewerRelation`. Test dùng chuỗi nhận diện `ZQX-*` cho tên, email, bản gốc, `admin_note` (cũng là `review_note` của dòng rejected), `request_id`, `client_user_id`, chạy cho 4 locale, cho người chưa đăng nhập, người lạ, builder, chủ request, trên cả HTML chi tiết và HTML danh sách; không có số lời mời, số người quan tâm, hay kết quả (`builder_selected`/`expired`). Trang đóng chỉ có "Closed". `request_id` chỉ xuất hiện trong link `/me/requests/:id` của chính chủ, do route dựng (view không bao giờ thấy id). E2E kiểm lại cùng điều trên dữ liệu seed (`CLIENT.name`, email, `E2E private original`, `E2E review note`, mọi `01E2ER…`).
- **Hiển thị theo §7.3.** Một hàm `requestVisibility` quyết định cả trang chi tiết lẫn danh sách (SQL lọc `open` trước, hàm có lời cuối). `pending_review`, `rejected`, `withdrawn`, `unpublished`, không có dòng, `pending_verification`, `removed` → 404; bốn trạng thái cuối + `published` → 200 "Closed" + `noindex`; biên `+30d − 1 phút` → 200, `+30d` → 404, `closed_at` null → 404 (biên chính xác tới ms đã có ở test domain 2702b). 404 của listing ẩn giống hệt listing không tồn tại (so độ dài HTML sau khi bỏ mã tham chiếu, 4 locale). Id sai dạng → 404 không truy vấn. `request_id` thật dùng làm `publicId` → 404. Cổng tắt (cờ DB tắt, ngày rỗng, ngày tương lai) → 404 cả hai route.
- **Rút đồng ý có hiệu lực ngay.** Test đi qua route `/me` thật: cùng URL 200 → 404, cả khi đã đăng nhập và chưa, câu chữ biến mất.
- **CTA §4.2.** Chưa đăng nhập → `/login?next=<đường dẫn localized>` (kiểm 4 locale; `safeNext` nhận); user thường → câu ngắn + `/for-builders`; builder `pending|rejected|suspended` → câu "Available once…", không nút; builder `approved` → để trống (chỗ cho 2706a); chủ request → link `/me/requests/:id` theo locale; listing đóng → chỉ câu đóng + Post a request cho mọi người (kể cả chủ và builder). `findViewerRelation` chạy đúng một lần khi đã đăng nhập và listing mở, không bao giờ cho người chưa đăng nhập (test bằng proxy đếm câu SQL), không chạy cho trang đóng. Builder state đến từ cùng một truy vấn (nghĩa vụ 2702a).
- **Cache/headers.** Đã đăng nhập: `no-store` (middleware). Chưa đăng nhập: không `public`/`max-age`. `Referrer-Policy` không phải `no-referrer`. Không `<script>`, `style=`, `on*=` trong `<main>`; không `dangerouslySetInnerHTML` (quét nguồn). XSS: mô tả có `<img onerror>`, `<script>` được escape ở cả thẻ lẫn chi tiết, xuống dòng giữ qua `PlainText`.
- **ADR-004.** Một thứ tự `published_at DESC, public_id DESC` (test cả hai khóa); bộ lọc category, budget band, ngôn ngữ chỉ thu hẹp (`?1 IS NULL OR …`), không đổi thứ tự; `sort=paid` và giá trị lạ bị bỏ; không có chữ `featured|boost|urgent|sponsored|promoted` trong HTML và nguồn; route và 4 view vào `RANKING_FILES`; view không import `db/`. Opt-in lại rồi publish giữ `published_at`.
- **Phân trang.** 24/trang; trang quá cuối → 404; trang 1 rỗng → trạng thái rỗng với Post a request + Browse products, không thẻ mẫu.
- **Hiệu năng.** ≤ 8 truy vấn D1 trên cả hai route, đã đăng nhập và chưa (`countD1Queries` dựng ngay trước request đo).
- **S-3: `public_id` ngẫu nhiên.** `publicId()` lấy 26 byte từ `crypto.getRandomValues`, mỗi byte `% 32` (256 chia hết cho 32 nên không lệch), cùng bảng chữ Crockford và độ dài ULID, nên `isPublicIdShape`/URL không đổi. Không còn thành phần thời gian (test: 10 ký tự đầu không trùng tiền tố thời gian của request, khác nhau giữa các lần gọi). Cả hai đường (`/request`, `/me`) dùng mặc định của `optInStatement`; không route nào truyền `publicId`. Va chạm: 130 bit ngẫu nhiên, xác suất không đáng kể; nếu xảy ra, `UNIQUE (public_id)` làm batch lỗi (request không được tạo, người dùng thấy 500 và gửi lại), không có dòng hỏng. Chấp nhận, không cần vòng thử lại. Migration `0018` không đổi.
- **Nghĩa vụ để lại cho 2705a: đạt.** `publicExcerpt` cho đoạn trích; `requestVisibility` với đúng bốn đối số; listing `withdrawn` còn giữ câu chữ → 404 và không có câu chữ; 404 thật cho request không có publication / id không tồn tại; ca Ops e2e kiểm trang công khai trong context không cookie (bản đã sửa, không bản gốc, không `CLIENT.name`/email/`request_id`), không khẳng định gì về `Q2008..2010` ở spec công khai; link công khai trong email publish → 200 khi chưa đăng nhập, cổng bật, hiện bản Ops đã sửa; seed không gán publication cho `R 12`. Nghĩa vụ "200 trước, 404 sau khi gỡ, đăng nhập và chưa" được làm trong `request-board-detail.test.ts` (qua route `/me` thật) thay vì sửa `test/me/request-board.test.ts`: đạt về nội dung (xem phán quyết 7).
- **E2E/axe.** Seed thêm `Q1..Q8` published và `R/Q 2001–2004, 2011` (cũ hơn 30 ngày theo `submitted_at`, không thêm `audit_log`); `test:scripts` và `home.spec.ts` xanh không đổi ngưỡng. Axe cho `/requests`, chi tiết mở, chi tiết đóng, `/vi/requests`, chi tiết mở ở 360 px; không thêm `KNOWN_A11Y`. Bộ lọc chạy khi tắt JS. Fixture `csp` tự kiểm mọi trang. Không thêm POST nào (ngân sách POST không đổi).
- **Chuỗi locale.** 31 khóa `board.*` đủ 4 locale (parity xanh), không có chữ số; `board.detail.identityNote` EN đúng nguyên văn plan/phụ lục §4.1; zh dùng 你, thuật ngữ 公开需求板 / 公開需求板.

Phải làm trước khi đóng task: câu chữ theo bảng cuối (L-1, Owner duyệt) và L-2 (một chỗ hiển thị nhỏ).

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| L-1 | LOW | `src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (`board.*`) | Câu chữ nhìn chung đúng sự thật và đúng thuật ngữ, nhưng vài chỗ chưa khớp văn bản đã duyệt. (a) `board.intro` hứa "the client's identity is never shown", rộng hơn điều Privacy §4 (Owner duyệt) cam kết ("never your name, email address or account"), trong khi chính mô tả opt-in đã duyệt cảnh báo quốc gia + ngân sách + ngách có thể nhận ra một doanh nghiệp. Câu `identityNote` "is not shown" là nguyên văn phụ lục §4.1 nên giữ; phần giới thiệu nên nói đúng như chính sách. (b) VI dùng "khách hàng" (trên site này là khách của builder) và "duyệt" (= approve) cho "review"; bản VI đã duyệt dùng "người đăng" (Privacy §3: "các nhu cầu mà người đăng đã chọn công khai"), "xem"/"xem xét" cho review, "hiện" cho show. (c) `cta.notBuilder` "say they are interested": văn bản đã duyệt dùng "tell us … interested", đúng sự thật hơn (interest chỉ tới đội ngũ, client không thấy, §3.3/Privacy §4). (d) VI `cta.pendingBuilder` "Có sau khi…" không rõ nghĩa; VI `closedNote` "Nó vẫn hiển thị…" gượng; VI `empty.body` "chưa có gì được đăng" lẫn với việc client đăng nhu cầu riêng tư. (e) `cta.pendingBuilder`, `cta.ownRequest`, `cta.closed` thiếu dấu chấm cuối câu trong khi các câu khác có. Không câu nào nói về số lượng hay kết quả. | Chép đúng bảng "Câu chữ cho Owner duyệt" ở cuối (EN + VI) sau khi Owner duyệt nguyên văn. zh-Hans/zh-Hant: AI dịch lại các khóa đã đổi từ EN đã duyệt (你, 公开需求板 / 公開需求板), VNX-0801 đọc lại. Test dùng `en[...]` nên tự theo; e2e `toContainText("This request is closed")` vẫn khớp khi thêm dấu chấm. | Owner duyệt, Implementer chép |
| L-2 | LOW | `src/views/requests/RequestCard.tsx:39-40` | Thẻ không có hạn chót hiện "Deadline: No deadline" (VI "Hạn chót: Không có hạn chót"), lặp ý. Cùng dòng, "Deadline" có dấu hai chấm còn "Posted" thì không ("Deadline: 2027-05-06 · Posted 2026-10-05"). | Khi `deadline` null chỉ hiện `board.deadline.none`; còn lại `Deadline: <ngày> · Posted: <ngày>` (cùng một kiểu). Test thẻ "no deadline" khẳng định không còn chuỗi `Deadline: No deadline`. | Implementer |
| S-1 | SUGGESTION | `src/routes/request-board.tsx:41` | Lệch 3: view nhận nguyên `PublicListing`, gồm cả `requestStatus` (chính là kết quả `builder_selected`/`expired`), `closedAt`, `publicationStatus`, `updatedAt`. Hiện không view nào render các trường đó, và test ghim khóa của đối tượng DB, nên không lộ gì. Nhưng kiểu `BoardItem` là cấu trúc nên TypeScript không chặn một lần sửa sau render `item.requestStatus`. | Khi 2706a sửa route này: map tường minh sang `BoardItem` (chỉ các khóa công khai) trước khi đưa vào view, cả ở danh sách lẫn chi tiết. Không cần vòng R1 riêng. | Implementer (2706a) |
| S-2 | SUGGESTION | `src/views/Pagination.tsx:2,10` | Lệch 2: `Pagination` chia theo `PAGE_SIZE` của catalogue, route lấy offset theo `BOARD_PAGE_SIZE`. Hai số đang cùng là 24; nếu một bên đổi, số trang và link "Next" sai mà không test nào đỏ. | Một dòng test `expect(BOARD_PAGE_SIZE).toBe(PAGE_SIZE)` hoặc prop `pageSize` tùy chọn cho `Pagination`. Có thể làm cùng L-2. | Implementer |
| S-3 | SUGGESTION | `test/public/request-board-list.test.ts:106` | Plan ghi kiểm trạng thái rỗng bằng render view với `items = []` (không phụ thuộc D1 dùng chung); test lại dựa vào việc không dòng nào khớp `ai_agents` + `unsure` + `zh`. Hiện đúng (chỉ file này tạo dòng), nhưng dễ vỡ nếu sau này có test tạo đúng tổ hợp đó. Báo cáo không khai sai khác này. | Thêm một ca render thẳng `BoardPage` với `items=[]`, `total=0`; giữ ca HTTP. | Implementer (cùng L-2) |

## Phán quyết các sai khác

1. **`/requests` luôn `noindex` tới 2705b: CHẤP NHẬN.** Fail closed: trước khi có ngưỡng 5 listing (Q13), canonical, hreflang và sitemap, để danh sách ra khỏi index là an toàn hơn. Trang chi tiết `open` đã có canonical/hreflang mặc định của `Layout` (đúng trạng thái cuối mong muốn); trang `closed` có `noindex`, không canonical, không hreflang. Nghĩa vụ 2705b: thay cờ cứng bằng `isBoardIndexable(countOpenPublicationsAll)` (vẫn ≤ 8 truy vấn), và meta description 160 ký tự (hiện là `publicExcerpt` 200 ký tự).
2. **`Pagination` dùng `PAGE_SIZE` của catalogue: CHẤP NHẬN** (cùng 24). Xem S-2.
3. **View nhận nguyên `PublicListing`: CHẤP NHẬN.** Các khóa ngoài phần công khai (`requestStatus`, `closedAt`, `publicationStatus`, `updatedAt`) không xuất hiện trong HTML ở bất kỳ locale hay vai trò nào (đã kiểm bằng test và e2e); không có `request_id`/`client_user_id`. Xem S-1 để khóa ranh giới ở mức kiểu.
4. **`makeRequest` có `clientName` tùy chọn: CHẤP NHẬN.** Mặc định giữ "Minh Tran", không đổi test cũ.
5. **Khóa thêm (`board.detail.back`, `board.cta.label`) và dùng lại `filter.clear`: CHẤP NHẬN.** `board.filter.any|apply` trùng giá trị với `filter.any|apply` nhưng plan liệt kê riêng; giữ.
6. **`public_id` seed cố định `id("Q", n)`: CHẤP NHẬN.** Plan bắt buộc seed tất định; production dùng `publicId()` ngẫu nhiên. `Q` có cùng dạng 26 ký tự Crockford nên đi qua `isPublicIdShape`.
7. **(Không khai) nghĩa vụ "200 trước, 404 sau khi gỡ" nằm ở `request-board-detail.test.ts` thay vì `test/me/request-board.test.ts`: CHẤP NHẬN.** Test mới đi qua chính route `POST /me/requests/:id/publication/withdraw`, khẳng định 200 trước và 404 sau, đăng nhập và chưa, và câu chữ biến mất; assertion 404 sẵn có trong test `/me` nay cũng có thật vì route công khai đã tồn tại. Đủ ý nghĩa vụ.
8. **(Không khai) e2e đăng nhập.** Spec công khai chỉ dùng context không cookie và `request` fixture; không thêm `POST /login`. Đúng ràng buộc.

## Đối chiếu tiêu chí chấp nhận

| Tiêu chí (plan VNX-2705a, nghĩa vụ) | Đạt? | Bằng chứng |
|---|---|---|
| Route `/requests`, `/requests/:publicId`, 4 locale, chỉ GET; cổng tắt → 404 | ✓ | `routes/request-board.tsx`; test "the gate" (list, detail) |
| Chỉ `findPublicListing`/list/count; `requestVisibility` một hàm; ẩn = 404 giống không tồn tại | ✓ | test visibility, test 404 localized |
| Bảng §7.3 qua HTTP, kể cả biên 30 ngày, `removed`, gỡ ngay | ✓ | `request-board-detail.test.ts` |
| Không lộ danh tính, bản gốc, `admin_note`/`review_note`, `request_id`, `client_user_id`, số đếm, kết quả; 4 locale; nhiều vai trò | ✓ | `expectClean`, test thẻ, e2e |
| CTA §4.2 từng hàng; `findViewerRelation` chỉ khi đăng nhập + mở | ✓ | describe "call to action", test H2 |
| Danh sách: chỉ open, thứ tự hai khóa, opt-in lại giữ vị trí, bộ lọc, giá trị lạ bị bỏ, trang quá cuối 404, trạng thái rỗng | ✓ (S-3) | `request-board-list.test.ts` |
| Header/cache, CSP, plain text/XSS, không `dangerouslySetInnerHTML` | ✓ | describe "headers…", "sources…" |
| ≤ 8 truy vấn D1, đăng nhập và chưa | ✓ | 2 test `countD1Queries` |
| `RANKING_FILES`, không import tiền, view không import `db/` | ✓ | `architecture.test.ts`, quét nguồn |
| S-3 `public_id` ngẫu nhiên, không thời gian, bảng chữ/độ dài tương thích | ✓ | `ulid.test.ts`, `db/request-board.test.ts` |
| E2E: spec công khai, ca Ops không cookie, axe 5 trang, seed không đổi homepage | ✓ | `npm run e2e` 76/76, `test:scripts` 53 |
| Câu chữ 4 locale, không chữ số, `identityNote` nguyên văn | ✓ (L-1) | parity; bảng cuối |

## Nghĩa vụ để lại cho task sau

- **VNX-2705b:** bỏ `noindex` cứng của `/requests`, dùng `isBoardIndexable(countOpenPublicationsAll)` (giữ ≤ 8 truy vấn); meta description của trang `open` là 160 ký tự đầu của `public_description` (hiện là đoạn trích 200 ký tự); e2e khẳng định `/requests` không `noindex` khi đủ 5 open (seed `Q1..Q8`).
- **VNX-2706a:** điền nhánh `approved` của `InterestBlock` (form interest, trạng thái interest, nút rút, link lời mời từ `ViewerRelation.inviteId`); map listing sang `BoardItem` tường minh ở route (S-1). Câu chữ interest mới theo thuật ngữ đã duyệt ("tell us you're interested" / "báo với chúng tôi rằng bạn quan tâm").

## Câu chữ cho Owner duyệt (31 khóa `board.*`)

Căn cứ: phụ lục §4.1 (nguyên văn `identityNote`), §4.2 (nhãn CTA), Privacy §3/§4 (§12.2 EN / §12.6 VI, Owner duyệt 2026-10-07), thuật ngữ §12.6 ("request" = nhu cầu, "public request board" = bảng nhu cầu công khai), câu chữ `request.board.optIn.*`, `me.board.*`, `email.board*` đã duyệt. Không câu nào nói về số lượng hay kết quả. Cột "Đổi" ghi khóa nào Reviewer đề xuất khác bản của Implementer. zh-Hans/zh-Hant: AI dịch lại các khóa đã đổi từ EN đã duyệt, dùng 你.

| # | Khóa | EN | VI | Đổi |
|---|---|---|---|---|
| 1 | `board.title` | Public request board | Bảng nhu cầu công khai | — |
| 2 | `board.intro` | Requests that clients chose to make public. Our team reviews each one before it is shown. The client's name, email address and account are never shown. | Các nhu cầu mà người đăng đã chọn công khai. Đội ngũ của chúng tôi xem xét từng nhu cầu trước khi hiện. Tên, email và tài khoản của người đăng không bao giờ được hiện. | EN + VI |
| 3 | `board.empty.title` | No open requests right now | Hiện chưa có nhu cầu nào đang mở | — |
| 4 | `board.empty.body` | Nothing is listed at the moment. You can post your own request, or browse products in the meantime. | Hiện chưa có nhu cầu nào trên bảng. Bạn có thể đăng nhu cầu của mình, hoặc xem các sản phẩm trong lúc chờ. | VI |
| 5 | `board.cta.post` | Post a request | Đăng nhu cầu | — |
| 6 | `board.cta.products` | Browse products | Xem sản phẩm | — |
| 7 | `board.filter.category` | Category | Danh mục | — |
| 8 | `board.filter.budget` | Budget | Ngân sách | — |
| 9 | `board.filter.language` | Language | Ngôn ngữ | — |
| 10 | `board.filter.any` | Any | Tất cả | — |
| 11 | `board.filter.apply` | Apply | Áp dụng | — |
| 12 | `board.card.posted` | Posted | Ngày đăng | — |
| 13 | `board.card.deadline` | Deadline | Hạn chót | — |
| 14 | `board.deadline.none` | No deadline | Không có hạn chót | — |
| 15 | `board.status.open` | Open | Đang mở | — |
| 16 | `board.status.closed` | Closed | Đã đóng | — |
| 17 | `board.detail.country` | Country | Quốc gia | — |
| 18 | `board.detail.languages` | Languages | Ngôn ngữ | — |
| 19 | `board.detail.budget` | Budget | Ngân sách | — |
| 20 | `board.detail.category` | Category | Danh mục | — |
| 21 | `board.detail.deadline` | Deadline | Hạn chót | — |
| 22 | `board.detail.posted` | Posted | Ngày đăng | — |
| 23 | `board.detail.identityNote` | The client's identity is not shown. The VNX.SI team invites up to five builders. | Danh tính của người đăng không được hiện. Đội ngũ VNX.SI mời tối đa năm builder. | VI |
| 24 | `board.detail.closedNote` | This request is no longer open. It stays visible here for a limited time. | Nhu cầu này không còn mở và chỉ còn hiện ở đây trong một thời gian có hạn. | VI |
| 25 | `board.detail.back` | All requests | Tất cả nhu cầu | — |
| 26 | `board.cta.label` | Next steps | Bước tiếp theo | — |
| 27 | `board.cta.signedOut` | I'm a builder — I'm interested | Tôi là builder — tôi quan tâm | — |
| 28 | `board.cta.notBuilder` | Only approved builders can tell us they are interested in a request. | Chỉ builder đã được duyệt mới có thể báo với chúng tôi rằng họ quan tâm tới một nhu cầu. | EN + VI |
| 29 | `board.cta.pendingBuilder` | Available once your builder profile is approved. | Chức năng này mở sau khi hồ sơ builder của bạn được duyệt. | EN (dấu chấm) + VI |
| 30 | `board.cta.ownRequest` | This is your request. Manage it in your account. | Đây là nhu cầu của bạn. Quản lý nhu cầu này trong tài khoản của bạn. | EN (dấu chấm) + VI |
| 31 | `board.cta.closed` | This request is closed. | Nhu cầu này đã đóng. | EN + VI (dấu chấm) |

Ghi chú cho Owner:
- `identityNote` EN giữ nguyên văn phụ lục §4.1. "Invites up to five builders" đúng sự thật: Ops mời qua luồng §5.7 có sẵn, cổng 5 lời mời nằm trong câu `INSERT` (§3.3 bước 6); interest không tạo lời mời.
- `cta.signedOut`, `cta.pendingBuilder`, `cta.closed` là nhãn của bảng §4.2; chỉ thêm dấu chấm cho đồng nhất. "Available once…" hiện cả cho builder `rejected`/`suspended` theo §4.2; nếu Owner muốn câu riêng cho hai trạng thái đó thì là quyết định mới, không thuộc task này.
- "Posted"/"Ngày đăng" là ngày listing lên bảng lần đầu (`published_at`), không phải ngày client gửi request; theo cách hiểu thông thường của một bảng tin, giữ nguyên.

## Re-review (vòng sửa 1, `c3b7d88`)

- **Ngày:** 2026-10-12. **Đã đọc:** diff `e59a510..c3b7d88` (9 file, +144/−32: 4 file locale, `Pagination.tsx`, `BoardPage.tsx`, `RequestCard.tsx`, test mới `test/views/request-board-copy.test.tsx`, mục "Vòng sửa 1" của báo cáo).
- **Lệnh đã chạy lại (HEAD `c3b7d88`):** `npm run typecheck -w apps/web`: exit 0. Bộ 2705a + test mới (`test/views/request-board-copy.test.tsx`, `test/public/request-board-list.test.ts`, `test/public/request-board-detail.test.ts`, `test/architecture.test.ts`, `test/i18n/parity.test.ts`, `test/lib/ulid.test.ts`, `test/db/request-board.test.ts`, `test/me/request-board.test.ts`): **8 file, 169 test xanh**. `npm run e2e` (một lần): **76 passed**, exit 0; không còn tiến trình `workerd`/`node` của worktree. Toàn bộ vitest không chạy lại (Implementer: 201 file, 2562 + 2 skipped); thay đổi code ngoài `views/requests/*` chỉ là prop tùy chọn của `Pagination` với mặc định cũ (hành vi các trang khác không đổi; typecheck sạch, bộ đầy đủ của Implementer xanh).

| # | Kết quả | Bằng chứng |
|---|---|---|
| L-1 | **Đóng.** Owner duyệt nguyên văn bảng 31 khóa (2026-10-12). Reviewer so **từng byte** 31 chuỗi EN và 31 chuỗi VI trong `en.ts`/`vi.ts` với bảng ở trên bằng script riêng: 0 khác biệt; mỗi catalogue có đúng 31 khóa `board.*`. Test mới ghim cùng bảng và cấm khóa `board.*` thừa. zh-Hans/zh-Hant: AI dịch lại các khóa đổi (`intro`, `identityNote`, `cta.notBuilder`, dấu chấm của `cta.pendingBuilder|ownRequest|closed`), dùng 你, người đăng = 发布者 / 發佈者 (khớp `request.facts.client`), giữ 公开需求板 / 公開需求板; nghĩa khớp EN đã duyệt, không chữ số. Khóa chỉ đổi VI (`empty.body`, `closedNote`) giữ bản zh cũ, đúng vì EN không đổi. | script so byte; `request-board-copy.test.tsx` |
| L-2 | **Đóng.** Không có hạn chót → chỉ "No deadline"; có → `Deadline: <ngày>`; ngày đăng `Posted: <ngày>` cùng kiểu (VI `Ngày đăng: …`). | test "card dates (L-2)" |
| S-2 | **Đóng.** `Pagination` có prop `pageSize` (mặc định `PAGE_SIZE` của catalogue, nên `/products`, `/builders` không đổi); `BoardPage` truyền `BOARD_PAGE_SIZE`; test ghim hai cỡ bằng nhau và pager theo cỡ của bảng. | 2 test S-2 |
| S-3 | **Đóng.** Render thẳng `BoardPage` với `items=[]`: trạng thái rỗng, hai CTA, không thẻ, không pager. Ca HTTP giữ nguyên. | test S-3 |
| S-1 | **Chuyển 2706a** như đã thống nhất (map tường minh sang `BoardItem`). | — |

Không có thay đổi ngoài phạm vi các phát hiện đã duyệt. Không phát hiện mới.

### Verdict cuối

**APPROVE.**
