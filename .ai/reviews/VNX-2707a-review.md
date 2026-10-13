# VNX-2707a — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-13
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (header, Changelog delta, Global Constraints, Review Focus 8/9, "Pháp lý: phiên bản và cổng ngày", mục Task VNX-2707a và VNX-2707b, VNX-2708, Open points OP-2a/OP-3, "Cần Owner/Reviewer lưu ý" mục 2 và 5); `.ai/context/CURRENT-STATUS.md` (luật M7: không bao giờ xóa ngày, mọi lần deploy phải từ cây có `eb45c10`; nghĩa vụ 2707a: giữ `withBoardOpen`; nghĩa vụ 2707a/b pháp lý); `.ai/reviews/M7-review.md` (tiền lệ zh của thông báo M7: Owner duyệt nguyên văn 2026-10-06); `src/domain/privacy-notice.ts`, `src/views/LegalPage.tsx`, `src/legal/content.ts`, `test/legal/privacy-version.test.ts`; phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §12.5; `wrangler.jsonc` (comment `REQUEST_BOARD_GO_LIVE`); báo cáo `.ai/tasks/VNX-2707a-report.md`; toàn bộ diff `0cfe21e..fc2e097` (18 file, +414/−26; code `9219eb8`, báo cáo `fc2e097`). Theo quy ước EPIC 27, mục task của plan là handoff.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `fc2e097`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/domain/legal-versions.test.ts test/domain/privacy-notice.test.ts test/legal test/design/privacy-notice.test.ts test/design/board-notice.test.ts test/design/layout.test.ts test/design/assets.test.ts test/config/wrangler-guard.test.ts test/public/for-builders.test.ts test/i18n`: **16 file, 212 passed + 2 skipped** (2 ca tập cha board `skipIf` chờ 2707b, đúng thiết kế).
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **209 file, 2691 passed + 2 skipped**, exit 0. Khớp báo cáo.
  - `npm run e2e` (một lần, `workers: 1`): **85 passed, 1,6 phút**, exit 0. Lần này không gặp lỗi socket (`ERR_NO_BUFFER_SPACE`) như lần chạy của Implementer. Sau khi chạy: đã xóa `e2e/.state`, `playwright-report`, `test-results`; không còn tiến trình `workerd`/`node` nào của worktree; cây làm việc sạch.
  - **Kiểm đột biến `select.test.ts`** (test này không viết red-first). Reviewer sửa tạm `src/legal/select.ts` (sao lưu rồi chép lại; `git status` sạch sau đó) với 4 đột biến, và `test/legal/select.test.ts` bắt được cả 4: (M1) bỏ nhánh lùi về m7, tức lùi về `current`: 2 test đỏ; (M2) ngày `updatedAt` của board lấy ngày M7: 1 đỏ; (M3) Terms bỏ kiểm "đã đăng ký câu chữ": 2 đỏ; (M4) Privacy coi `null` là đã đăng ký: 3 đỏ. Kết luận: test này có giá trị thật dù không red-first.
  - **Kiểm hành vi `privacy-notice.js`:** Reviewer chạy script trong `node:vm` với DOM giả (file trong scratchpad, không vào repo). Đóng thông báo board chỉ ghi `vnxsi:board-notice-dismissed:v1`. Tải lại thì M7 vẫn mở, board đóng. Đóng M7 ghi đúng khóa cũ `vnxsi:privacy-notice-dismissed:v1`. Phần tử không có `data-notice-id` (HTML cũ trong cache) vẫn đọc khóa M7.
  - **So từng byte câu OP-2a:** chuỗi EN và VI trong plan (dòng OP-2) so với `privacyNotice.boardMessage` ở `en.ts`/`vi.ts`: trùng từng byte (184 và 178 ký tự), VI ở dạng NFC.

## Verdict

**APPROVE.**

Task làm đúng mục VNX-2707a của plan. Hành vi M7 ở production hôm nay không đổi.

- **Chọn phiên bản đúng.** `privacyVersionOf({ m7, board }, now)` là `board` từ `B − 14 ngày` (bao gồm mốc) mãi về sau. Board thắng m7. Nếu không thì `m7` từ `M7 − 14 ngày`, còn lại là `current`. `reached()` dùng chung `parsePrivacyNoticeDate` của M7. Hàm fail closed: ngày rỗng, `undefined`, sai dạng (`2026-02-30`, `soon`, có giờ) hay `now` không hợp lệ đều không đưa vào phiên bản nào. Hàm không có đường quay lại, và test quét 400 ngày khẳng định thứ hạng không giảm. `termsVersionOf` theo cùng quy tắc.
- **`privacyVersion` cũ** giữ nguyên chữ ký và thân hàm (không có trong diff). Test hiện có không đổi và xanh; test mới khẳng định `privacyVersionOf({ m7 })` bằng `privacyVersion(m7)` trên bảng đầu vào cũ. `routes/legal.tsx` chuyển sang `selectLegal`, nên `privacyVersion` không còn người gọi ở production. Plan cho phép điều này ("giữ làm bọc tương thích"). Cổng đếm (`isCountingLive` ở `http/visitor.ts`, `routes/go.ts`), `shouldShowPrivacyNotice`, `formatPrivacyNoticeDate` và `parsePrivacyNoticeDate` không đổi.
- **Không đổi hành vi M7 ở production hôm nay** (`PRIVACY_NOTICE_GO_LIVE = "2026-10-21"` đã commit, `REQUEST_BOARD_GO_LIVE = ""`). Với board rỗng, `selectLegal("privacy")` trả `PRIVACY_M7` + `2026-10-21` từ 2026-10-07, giống hệt nhánh `m7` cũ. `selectLegal("terms")` trả `undefined`, nên `/terms` và `/disclosure` vẫn dùng `LEGAL_UPDATED_AT`. Nhánh này đang là `2026-10-05` vì cắt từ `1362ab4`; `origin/main` đã là `2026-10-11` (`b2d3c3c`, deploy 6), và dòng đó không bị diff này chạm nên sẽ vào khi gộp `origin/main`. Production hiện thị `/terms` ngày 2026-10-11 và `/privacy` ngày 2026-10-21, và cả hai giữ nguyên sau khi gộp. Thông báo M7 render y như trước, chỉ thêm thuộc tính `data-notice-id="m7"`; `test/design/privacy-notice.test.ts` và `layout.test.ts` không sửa và vẫn xanh.
- **"Last updated" = ngày go-live của phiên bản đang hiện**: board → `B`, m7 → `M7`, current → `LEGAL_UPDATED_AT`. Test HTTP khẳng định khi chưa có câu chữ board thì `/privacy` ghi `Last updated: 2026-10-21` và không chứa ngày `B`.
- **Thông báo thứ hai.** Mỗi thông báo có cửa sổ riêng `[goLive − 14, goLive + 31)` (dùng lại `shouldShowPrivacyNotice`), chỉ cho người đã đăng nhập. Thứ tự là M7 rồi board, một script cho cả hai (`Set`). Ngày rỗng hay sai dạng thì không có markup và không có script. Mỗi thông báo có khóa riêng, khóa M7 giữ nguyên. Script vẫn tĩnh, same-origin, không inline, 860 byte (≤ 2 KB theo test ngân sách của `assets.test.ts`). `render.ts` **giữ** `withBoardOpen(c.get("requestBoard") === true, …)` (nghĩa vụ L8 của 2705b); `footer.test.ts` và `for-builders.test.ts` xanh.
- **Guard `wrangler.jsonc`:** `REQUEST_BOARD_GO_LIVE` rỗng hoặc ≥ 2026-10-21 (test mới), cộng ≥ `PRIVACY_NOTICE_GO_LIVE` và đòi `PRIVACY_NOTICE_GO_LIVE` khác rỗng (test có từ 2702b). Vitest ghim cả hai ngày về rỗng, và có test khẳng định điều đó. Luật "B ≥ 14 ngày sau lần deploy đầu mang biến" ghi ở comment (a) của `wrangler.jsonc` và ở VNX-2708; test không kiểm được ngày deploy, nên giữ là luật quy trình.

## Phát hiện

Không có BLOCKER, HIGH hay MEDIUM. Không cần vòng sửa cho 2707a: hai phát hiện LOW chuyển thành nghĩa vụ bắt buộc của VNX-2707b (task này vốn sửa đúng các file đó).

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| F1 | LOW | `apps/web/src/legal/content.ts:965`, `apps/web/src/legal/select.ts:20-22`, `apps/web/test/config/wrangler-guard.test.ts` | Lựa chọn thiết kế 1: khi `BOARD_LEGAL` là `null` mà ngày board đã tới, trang lùi về phiên bản cũ. Lùi như vậy an toàn ở tầng trang (không bao giờ trang trống, không câu chữ board, không ngày board). Nhưng ở tầng sản phẩm đây **không phải trạng thái hợp lệ để deploy**: thông báo board vẫn hiện ("From {date} you can choose to show a request on a public request board…") và link tới `/privacy`, trong khi trang đó không nói gì về bảng; từ ngày `B`, cổng `isRequestBoardEnabled` có thể mở bảng (nếu cờ bật) khi Privacy/Terms chưa mô tả nó. Hiện chưa với tới được: ngày đang rỗng, và nhánh không merge trước 2709 (phụ thuộc 2707b). | **VNX-2707b (bắt buộc):** thêm vào `wrangler-guard.test.ts` một ca: `REQUEST_BOARD_GO_LIVE !== ""` ⇒ `BOARD_LEGAL.privacy` và `BOARD_LEGAL.terms` khác `null`. Có thể thêm cả: mỗi hằng số chứa chuỗi nhận diện board ("public request board" / "bảng nhu cầu công khai"). Như vậy một ngày board được commit mà thiếu câu chữ sẽ đỏ ở CI, không âm thầm phục vụ bản cũ. Tùy chọn: bỏ `\| null` khỏi kiểu `BOARD_LEGAL` khi đã đăng ký, chỉ giữ nhánh lùi cho bảng tiêm trong test. Giữ hành vi lùi hiện tại (đúng, không đổi). | Implementer (2707b) |
| F2 | LOW | `apps/web/wrangler.jsonc:35-38` | Từ task này, `REQUEST_BOARD_GO_LIVE` quyết định câu chữ `/privacy`, `/terms` (từ `B − 14`) và thông báo trước. Comment của biến (viết ở 2702b) chưa nói điều đó, và (c) thiếu luật mà `PRIVACY_NOTICE_GO_LIVE` có: "mọi lần deploy sau phải từ cây chứa commit ngày; nếu không thì `/privacy`, `/terms` quay về bản không có board trong khi publication đã tồn tại" (plan VNX-2708, "Cần lưu ý" mục 5). | **VNX-2707b:** bổ sung comment (a)/(c) của `REQUEST_BOARD_GO_LIVE` cho hai ý trên, cùng giọng với comment `PRIVACY_NOTICE_GO_LIVE`. Runbook mục 4 vẫn là việc của Reviewer ở VNX-2708. | Implementer (2707b) |
| F3 | SUGGESTION | `apps/web/test/design/assets.test.ts:242`, `apps/web/test/design/board-notice.test.ts:59-66` | Plan đòi "đóng một cái không đóng cái kia (khóa riêng)". Test chỉ kiểm tĩnh: hai `data-notice-id` khác nhau, và chuỗi hai khóa có trong script. Không có test chạy script, vì workerd chặn `eval`/`new Function`, e2e không đặt được ngày board, và M7 cũng không có tiền lệ. Reviewer đã kiểm hành vi bằng `node:vm` (xem trên): đúng. | Chấp nhận. Nếu 2709 muốn thêm, chỉ có thể làm bằng Playwright khi có cách đặt ngày board cho e2e; không bắt buộc. | — |
| F4 | SUGGESTION | `apps/web/src/views/privacy-notice.tsx:39`, `apps/web/src/views/Layout.tsx:142` | Khi hai thông báo cùng hiện, trang có hai `<summary>` "Dismiss" giống hệt nhau. Người dùng trình đọc màn hình phải đọc đoạn văn mới biết nút đóng thông báo nào. Hai thông báo chỉ cùng hiện khi `B − 14 < 2026-11-21`, tức `B < 2026-12-05`. | Không đổi trong epic này (đổi nhãn là câu chữ cần Owner duyệt). Ghi vào "Ghi nhận"; nếu Owner chọn `B < 2026-12-05` thì cân nhắc nhãn riêng ở 2707b. | Owner (khi chọn B) |

## Phán quyết các lựa chọn thiết kế và sai khác

| # | Lựa chọn / sai khác | Phán quyết |
|---|---|---|
| D1 | `BOARD_LEGAL` null → lùi một phiên bản (Privacy → m7 nếu đã tới ngày, nếu không → current; Terms → current), kèm ngày của phiên bản được hiện. | **Chấp nhận làm hành vi lúc chạy**: tốt hơn placeholder hay trang trống, và đã được kiểm bằng 4 đột biến. **Không chấp nhận làm trạng thái deploy được**: một ngày board khác rỗng đi cùng câu chữ thiếu phải đỏ ở thời điểm test (F1, bắt buộc ở 2707b). |
| D2 | Hai thông báo cùng hiện, M7 trước, board sau, khóa riêng. | **Đúng plan**: mục VNX-2707a ghi rõ "có thể hiện hai thông báo cùng lúc (xếp dọc); mỗi thông báo có khóa `localStorage` riêng". Thứ tự theo thời gian là hợp lý. Không đổi. |
| D3 | Câu thông báo board (`privacyNotice.boardMessage`) vào ngay 2707a, trong khi plan để câu chữ cho 2707b và đặt tên khóa `privacyNotice.board.message`. | **Chấp nhận.** EN/VI là câu OP-2a Owner duyệt nguyên văn 2026-10-07, trùng từng byte. Tên khóa phẳng nhất quán với `privacyNotice.message`. 2707b **không** thêm khóa trùng; câu "Read the changes." / "Dismiss" dùng lại khóa M7 như plan. |
| D4 | File mới `domain/legal-versions.ts` và `legal/select.ts` thay vì gộp vào `privacy-notice.ts`. | **Chấp nhận** (plan cho Implementer chọn). Ranh giới module đúng: `domain/` thuần, `legal/select.ts` chỉ import `domain/` + `content.ts`; test kiến trúc xanh. |
| D5 | Board có ngày, M7 rỗng: current → board, bỏ qua m7 (mục 4 của báo cáo). | **Chấp nhận.** Guard đòi `PRIVACY_NOTICE_GO_LIVE` khác rỗng khi board khác rỗng, nên ở cấu hình đã commit trạng thái này không xảy ra; chỉ là ca test/dev. |
| D6 | Thông báo board chỉ link `/privacy`, không link `/terms`. | **Chấp nhận**: đúng khuôn M7 và câu OP-2a không nhắc Terms. Từ `B − 14`, `/privacy` là phiên bản board. |

## Cần Owner duyệt (câu chữ: Owner, không phải vnxsi-72)

- **zh-Hans / zh-Hant của thông báo board** (`privacyNotice.boardMessage`, AI dịch, gọi người đọc là 你, thuật ngữ 公开需求板 / 公開需求板 khớp `request.board.optIn.label`):
  - zh-Hans: "自 {date} 起，你可以选择将一条需求显示在公开需求板上。除非你对每条需求逐一选择公开，否则需求仍保持私密；你已发布的需求不会有任何变化。"
  - zh-Hant: "自 {date} 起，你可以選擇將一則需求顯示在公開需求板上。除非你對每則需求逐一選擇公開，否則需求仍保持私密；你已發布的需求不會有任何變化。"

  OP-2a ghi "zh: AI dịch, Owner duyệt nguyên văn như M7", và câu zh của thông báo M7 đã được Owner duyệt nguyên văn ngày 2026-10-06. Vì vậy hai câu này cần **Owner duyệt nguyên văn trước verdict của VNX-2707b** (muộn nhất trước VNX-2708), không chỉ dựa vào lượt người bản xứ đọc lại của VNX-0801. Ghi chú cho VNX-0801: zh-Hant hiện dùng lẫn 發布 (9 chỗ, gồm câu này) và 發佈 (26 chỗ); người bản xứ chọn một.

## Đối chiếu tiêu chí chấp nhận (mục "Tests phải có" của VNX-2707a)

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Bảng biên `privacyVersionOf`: `B − 14 − 1ms` → m7, đúng `B − 14` → board | ✓ | `test/domain/legal-versions.test.ts` (6 ca biên) |
| Board rỗng / `2026-02-30` → như hiện nay | ✓ | ca `it.each` so với `privacyVersion(M7)` |
| Không bao giờ quay lại | ✓ | quét 400 ngày, thứ hạng không giảm |
| Board bật, m7 rỗng → không ném | ✓ | ca "a board date with an empty m7" |
| Board thắng m7 | ✓ | ca cùng ngày |
| `termsVersionOf` | ✓ | 3 ca biên + rỗng/sai dạng + `now` NaN |
| `privacyVersion` cũ cho cùng kết quả | ✓ | `test/domain/privacy-notice.test.ts`, `test/legal/privacy-version.test.ts` không đổi và xanh, cộng ca tương đương mới |
| Cửa sổ `[B − 14, B + 31)` | ✓ | `test/design/board-notice.test.ts` 4 mốc biên |
| Hai thông báo cùng lúc, khóa riêng | ✓ (tĩnh) + kiểm tay | `board-notice.test.ts` "two notices"; `assets.test.ts`; Reviewer chạy `node:vm` (F3) |
| Biến rỗng → không markup, không script | ✓ | ca `"", undefined, "2026-02-30", "soon"` |
| Chỉ người đã đăng nhập | ✓ | mỗi ca biên kiểm thêm khách chưa đăng nhập |
| `withBoardOpen` giữ trong `page()` | ✓ | `render.ts`; `footer.test.ts`, `for-builders.test.ts` xanh; ca Layout ngoài `page()` |
| Guard `wrangler.jsonc` | ✓ | `REQUEST_BOARD_GO_LIVE` rỗng hoặc ≥ 2026-10-21 và ≥ `PRIVACY_NOTICE_GO_LIVE`; Vitest ghim rỗng |
| CSP: không script/style inline, script ≤ 2 KB | ✓ | `assets.test.ts` (860 byte); e2e `watchCsp` xanh |
| typecheck, toàn bộ test, e2e | ✓ | xem "Lệnh đã chạy lại" |

## Nghĩa vụ để lại cho task sau

- **VNX-2707b (bắt buộc):**
  - F1: guard "ngày board khác rỗng ⇒ `BOARD_LEGAL.privacy` và `.terms` khác null" (và nên có chuỗi nhận diện board).
  - F2: comment `REQUEST_BOARD_GO_LIVE` trong `wrangler.jsonc` (câu chữ `/privacy`, `/terms` và thông báo từ `B − 14`; luật deploy từ cây chứa commit ngày).
  - Đăng ký `BOARD_LEGAL` bằng bốn hằng số `*Board`, bỏ `it.skipIf` của hai ca tập cha, điền `REPLACED_PRIVACY`/`REPLACED_TERMS` (nghĩa vụ có từ trước).
  - `select.test.ts`: sửa ca "BOARD_LEGAL is empty until VNX-2707b" thành ca khẳng định đã đăng ký. Thêm test HTTP với `BOARD_LEGAL` thật: EN, VI, zh (bản EN kèm câu "bản tiếng Anh có hiệu lực"), "Last updated: B" cho cả `/privacy` và `/terms`, không quay lại sau `B`, ca production-like (`PRIVACY_NOTICE_GO_LIVE = 2026-10-21`, `REQUEST_BOARD_GO_LIVE = D > 2026-10-21`).
  - Không thêm khóa thông báo trùng (D3). Review 2707b kiểm bộ đầy đủ còn 0 test skipped.
- **Owner:** duyệt nguyên văn câu zh-Hans/zh-Hant của thông báo board (mục trên) trước verdict 2707b.
- **Gộp `origin/main` (trước 2709):** `b2d3c3c` đổi `LEGAL_UPDATED_AT` sang `2026-10-11` và dòng `test/legal/privacy-version.test.ts:62`. Diff này không chạm hai dòng đó, nên gộp sẽ không xung đột. Sau khi gộp, `/terms` (phiên bản `current`) hiện `2026-10-11`, đúng production.
- **Ghi nhận:** F4 (hai nút "Dismiss" giống nhau khi `B < 2026-12-05`); `privacyVersion` không còn người gọi ở production (giữ cho tới task dọn Privacy sau 2026-11-21, xóa cùng `current`).
