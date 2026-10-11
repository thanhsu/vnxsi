# VNX-2703b — Báo cáo Implementer

- **Task:** `/me/requests/:id`, khối "Public listing" (opt-in sau, gỡ, opt-in lại, lý do). Nhánh `feat/epic27-request-board`, code `9bf22fa` (trên `932ebde`).
- **Handoff:** mục VNX-2703b của plan + Global Constraints + nghĩa vụ trong `CURRENT-STATUS.md` (không có handoff riêng, quy ước L-6).

## Đã làm

- `domain/request-board.ts`: `clientBoardActions(publicationStatus | null, requestStatus, gate)` là **một** quy tắc cho route và view (như `opsBoardActions`): `opt_in` chỉ khi cổng bật, request `submitted|matching`, chưa có publication; `re_opt_in` chỉ khi cổng bật, request mở, publication `withdrawn`; `withdraw` cho `pending_review|published` ở mọi trạng thái request và khi cổng tắt. `rejected`/`unpublished` không có hành động nào (Q6).
- `routes/me-requests.tsx`:
  - `POST /me/requests/:id/publication/opt-in`: cổng tắt → 404; `load(c)` (người khác/`removed`/không tồn tại → 404); hành động từ `clientBoardActions`; một batch `optInStatement` (hoặc `reOptInStatement` khi `withdrawn`, CAS trên `updated_at` đọc lúc này) + audit có guard `publicationAuditGuard` (`request_publication.opt_in` hoặc `.re_opt_in`, `data = { consentVersion }`); 0 dòng → 409, không audit; thành công → 303 về `/me/requests/:id` (có tiền tố locale, không fragment). `consent_version = REQUEST_BOARD_GO_LIVE`.
  - `POST /me/requests/:id/publication/withdraw`: không đọc cờ, không xét trạng thái request; batch `withdrawStatement` + audit `request_publication.withdraw` (`data = { from }`); 0 dòng/không có publication/đã `withdrawn|rejected|unpublished` → 409.
  - 409 (mẫu VNX-0807 + M-1): `requestPage(c, request, 409, true)` render **trạng thái hiện tại** (tải lại request và publication), `Layout invalid`, một `FormErrorSummary` với mục `href: ""`, không `role="alert"`, không có giá trị gõ để mang lại (form không có trường).
  - `requestPage` nạp publication, dựng một **projection** `ListingView` (không `request_id`, không `consent_version`, không reviewer; `publicId` chỉ khi cổng bật và `requestVisibility ≠ hidden`; câu chữ công khai chỉ khi `published`; `review_note` chỉ khi `rejected|unpublished`).
- `views/me/PublicListingBlock.tsx` (mới) + `RequestPage.tsx`: khối `#me-board` (`pending_review`, `published` kèm bản công khai đang hiện và link, `withdrawn`, `rejected`/`unpublished` kèm lý do và ghi chú cuối, nút opt-in dùng lại `request.board.optIn.label|hint`, nút gỡ). Không có trường country. Khối ẩn hẳn khi không có publication và không có nút opt-in (cổng tắt, request không mở).
- i18n: 13 khóa `me.board.*` × 4 locale (xem "Copy needing Owner approval").
- e2e: seed `R 2005..2007` (submitted, không publication, cũ 40 ngày), `SESSION_RAW_CLIENT` + dòng `sessions` cho `CLIENT`, fixture `clientPage` (cookie seed, không `POST /login`), một test mới ở `request-board-forms.spec.ts`, một quét axe `/me/requests/:id (signed in)` trong `a11y.spec.ts` (dùng `R 12`, request không bao giờ có publication), cập nhật `e2e/README.md` (bảng phạm vi, danh sách seed, ngân sách POST: 2 POST không có rate limit).

## Red trước (một dòng cho mỗi hành vi; lần chạy đầu, chưa có code)

- `clientBoardActions`: `test/domain/request-board-client-actions.test.ts` 3 failed (3), hàm chưa tồn tại.
- Opt-in sau: `AssertionError: expected '<p><a href="/me">Inquiries &amp; requ…' to contain 'Show this request on the public reque…'`; POST opt-in `expected 404 to be 303`.
- Opt-in `matching` / sai trạng thái → 409: `expected 404 to be 303` (matching), `expected 404 to be 409` (route chưa có).
- Opt-in lần hai / publication đã có: `AssertionError: expected 404 to be 409`.
- Phiên OAuth: `expected 404 to be 303`.
- Gỡ từ `pending_review`: `pending_review: expected 404 to be 303`; gỡ khi request đã chọn builder + cổng tắt: `expected '<p><a href="/me">Inquiries &amp; requ…' to contain '/me/requests/01M4MGNB…'` (không có nút gỡ).
- Gỡ hai lần / không có publication / `rejected`: `expected 404 to be 409`.
- Opt-in lại, giữ `published_at`: `expected '<p>…' to contain '/me/requests/01M4MGNBYP…'` (không có nút opt-in lại).
- Nút opt-in lại không có khi request đã đóng: `expected … to contain 'You removed this request from the boa…'`.
- `rejected`/`unpublished` hiện lý do: `rejected: expected … to contain 'REASON-rejected-f0eb1830'`.
- Khối `published` hiện bản công khai: `expected … to contain 'E2E board wording'`; `pending_review`: `expected … to contain 'Waiting for review'`.
- Khối ở 4 locale: `expected '' not to be ''` (không có `#me-board`).
- Mẫu lỗi 409: `expected 404 to be 409`.
- Mười bảy test đỏ ở lần chạy đầu của `test/me/request-board.test.ts`; sau code còn 1 đỏ do **test sai** (`findPublicListing` chỉ trả listing `published`, nên sau khi gỡ là `null`, không phải `hidden`): sửa test để đo `open` trước và `hidden` (null) sau, 21/21 xanh.

## Kiểm tra (chạy lại ở `9bf22fa`)

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck -w apps/web` | sạch |
| `npm test -w apps/web -- test/me/request-board.test.ts test/me/requests.test.ts test/i18n/parity.test.ts test/domain/request-board-client-actions.test.ts --maxWorkers=2 --testTimeout=60000` | xanh (40 test) |
| `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000` (toàn bộ) | 196 file, 2470 passed, 2 skipped (2 skipped là `it.skipIf` có chủ ý của 2702b, đóng ở VNX-2707b) |
| `npm run test:scripts` | 52 / 52 |
| `npm run e2e:typecheck` | sạch |
| `npm run e2e` (workers=1) | 65 / 65, không retry (63 trước + 1 axe client + 1 spec `/me`) |

Không có tiến trình wrangler/workerd nào do tôi khởi (`workerd` còn thấy trên máy thuộc worktree `cnl`, không phải của task này).

## Sai khác / quyết định cần Reviewer xem

1. **Cổng tắt + POST opt-in → 404** (mục "Tests phải có": "cổng tắt → nút không có, POST → 404"). Đoạn "Mẫu lỗi VNX-0807" của plan nói cổng tắt khi opt-in cũng là 409 qua trang render lại. Hai đoạn mâu thuẫn nhau; tôi theo đoạn test (404, nhất quán với "cổng tắt = tính năng không tồn tại" và với route Ops/trang công khai). Nếu Owner muốn 409 thì đổi một dòng.
2. **Opt-in và gỡ không mang token `updated_at` trên form**, khác Ops: route đọc publication hiện tại rồi CAS trên giá trị vừa đọc. Lý do: ý định của client là "gỡ" dù Ops vừa publish (pending_review → published) vẫn nên gỡ được; CAS vẫn chặn race trong khoảng đọc-ghi. Opt-in lần đầu dựa vào `NOT EXISTS` của SQL.
3. **Audit opt-in lại** dùng action riêng `request_publication.re_opt_in` (plan chỉ nêu `.opt_in` và `.withdraw`): để Ops/audit phân biệt được; `data` giống `.opt_in` (`{ consentVersion }`), không có câu chữ hay ghi chú.
4. **"Gỡ → `GET /requests/:publicId` 404 ngay"**: route công khai chưa có (VNX-2705a), nên test HTTP 404 đó đúng nhưng chưa có sức nặng. Sức nặng thật nằm ở kiểm `findPublicListing` + `requestVisibility`: trước khi gỡ là `open`, sau khi gỡ là `hidden` (listing null), cùng test. 2705a phải thêm ca HTTP thật (đã có trong nghĩa vụ 2705a).
5. Request `pending_verification`: không có khối opt-in ở `/me` (`clientBoardActions` đòi `submitted|matching`) dù SQL `optInStatement` nhận; nếu đã có publication (đường tạo request có ô opt-in) thì khối hiện "Waiting for review" kèm nút gỡ, và gỡ được.
6. Dòng cuối file: các file `.ts/.tsx` đang CRLF trong working tree, tôi giữ CRLF (kể cả khi chèn); file mới LF (git chuẩn hóa).

## Copy needing Owner approval

Nhãn và mô tả opt-in dùng lại khóa đã duyệt `request.board.optIn.label|hint` (không đổi). Các khóa mới (zh do AI dịch, dùng 你; câu chữ giữ đúng sự thật và khớp phụ lục §12.2 "rời bảng ngay", không thêm tuyên bố pháp lý):

| Key | EN | VI | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `me.board.title` | Public listing | Hiển thị công khai | 公开展示 | 公開展示 |
| `me.board.optIn` | Submit for review | Gửi để xem xét | 提交审核 | 提交審核 |
| `me.board.reOptIn` | Submit for review again | Gửi xem xét lại | 重新提交审核 | 重新提交審核 |
| `me.board.pending` | Waiting for review. Nothing is shown publicly until our team has reviewed it. | Đang chờ xem xét. Chưa có gì được hiện công khai cho đến khi đội ngũ của chúng tôi xem xong. | 等待审核。在我们的团队审核之前，不会公开显示任何内容。 | 等待審核。在我們的團隊審核之前，不會公開顯示任何內容。 |
| `me.board.live` | Public. This is what is shown on the board: | Đang công khai. Đây là nội dung đang hiện trên bảng: | 已公开。以下是目前显示在公开需求板上的内容： | 已公開。以下是目前顯示在公開需求板上的內容： |
| `me.board.viewPublic` | View the public page | Xem trang công khai | 查看公开页面 | 檢視公開頁面 |
| `me.board.remove` | Remove from board | Gỡ khỏi bảng | 从公开需求板移除 | 從公開需求板移除 |
| `me.board.removeHint` | Removing takes effect straight away. | Việc gỡ có hiệu lực ngay. | 移除会立即生效。 | 移除會立即生效。 |
| `me.board.removed` | Not published. You removed this request from the board. | Chưa được đăng. Bạn đã gỡ nhu cầu này khỏi bảng. | 未公开。你已将这条需求从公开需求板移除。 | 未公開。你已將這則需求從公開需求板移除。 |
| `me.board.rejectedReason` | Our team did not publish this request on the board. Reason: | Đội ngũ của chúng tôi không đăng nhu cầu này lên bảng. Lý do: | 我们的团队没有把这条需求发布到公开需求板。原因： | 我們的團隊沒有把這則需求發佈到公開需求板。原因： |
| `me.board.unpublishedReason` | Our team removed this request from the board. Reason: | Đội ngũ của chúng tôi đã gỡ nhu cầu này khỏi bảng. Lý do: | 我们的团队已把这条需求从公开需求板移除。原因： | 我們的團隊已把這則需求從公開需求板移除。原因： |
| `me.board.finalNote` | It cannot be added to the board again. Your request itself is not affected. | Không thể đưa lại lên bảng. Bản thân nhu cầu của bạn không bị ảnh hưởng. | 无法再次加入公开需求板。你的需求本身不受影响。 | 無法再次加入公開需求板。你的需求本身不受影響。 |
| `me.board.error.conflict` | This request's public listing has changed. Review the status below. | Mục hiển thị công khai của nhu cầu này đã thay đổi. Hãy xem trạng thái bên dưới. | 这条需求的公开展示状态已发生变化。请查看下方的状态。 | 這則需求的公開展示狀態已有變動。請查看下方的狀態。 |

Ghi chú copy: `me.board.error.conflict` là câu plan đã nêu (EN). Không có bước xác nhận riêng trước khi gỡ (không JS, và gỡ là rút đồng ý nên luôn dễ làm): `removeHint` + dòng trạng thái "Not published…" sau khi gỡ đóng vai trò xác nhận. Nút opt-in dùng nhãn "Submit for review" (không lặp lại "Show…") vì nhãn/mô tả đã duyệt nằm ngay trên nút.

## Cho Reviewer

- Xem (1) trong "Sai khác" (404 so với 409 khi cổng tắt).
- Kiểm `PublicListingBlock` không nhận `request_id`/`consent_version`/reviewer, và `publicId` chỉ ra khi cổng bật + visibility ≠ hidden.
- Kiểm 409 render trạng thái hiện tại (test "twice" và "ended request" khẳng định nút/đường dẫn của trạng thái mới).
- Ghi nhận: opt-in lại không giới hạn (OP-1), đã ghi trong plan; chưa thêm gì vào `CURRENT-STATUS.md` (không sửa theo luật).
- 2705a: ca HTTP `GET /requests/:publicId` → 404 sau khi gỡ (xem Sai khác 4).
