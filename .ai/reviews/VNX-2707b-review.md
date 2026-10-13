# VNX-2707b — Review

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-13
- **Đã đọc:** `CLAUDE.md`; plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md`, mục "Task VNX-2707b" (theo quy ước EPIC 27, mục task của plan là handoff); phụ lục `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` §12.1–12.6 và §13 "Pháp lý"; `.ai/reviews/VNX-2707a-review.md` (F1, F2, D3, mục "Cần Owner duyệt"); `.ai/context/CURRENT-STATUS.md` (nghĩa vụ 2707b); báo cáo `.ai/tasks/VNX-2707b-report.md`; toàn bộ diff `096bf08..ff3b838`: merge `8165f1d`, code và tài liệu pháp lý `fe69633` (8 file), báo cáo `ff3b838`. Mã liên quan để đối chiếu hành vi: `migrations/0018_request_board.sql`, `src/db/request-board.ts`, `src/domain/request-board.ts`, `src/domain/legal-versions.ts`, `src/legal/select.ts`, `src/routes/legal.tsx`, `src/routes/me-requests.tsx`, `src/routes/request-form.tsx`, `src/routes/ops-request-board.tsx`, `src/views/requests/RequestDetail.tsx`.
- **Lệnh đã chạy lại (worktree `D:/DOCS/SUPHAM/GIT/vnxsi-epic27`, HEAD `ff3b838`):**
  - `npm run typecheck -w apps/web`: exit 0. `npm run e2e:typecheck`: exit 0.
  - `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000 test/legal test/config/wrangler-guard.test.ts` (gồm `request-board-versions.test.ts`, `select.test.ts`, `content.test.ts`): **8 file, 108 passed, 0 skipped**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **210 file, 2725 passed, 0 skipped**, exit 0. Khớp báo cáo. Trước task là 2691 + 2 skipped; hai `skipIf` đã thành test thật.
  - `npm run e2e` (một lần, `workers: 1`): **85 passed (1,5 phút)**, exit 0. Sau khi chạy: đã xóa `e2e/.state`, `playwright-report`, `test-results`; không còn tiến trình `workerd`; `git status` sạch.
  - **Script độc lập của Reviewer** (trong scratchpad, không vào repo; kết quả ở mục "Kết quả script" bên dưới): (1) Python so từng byte câu chữ đã duyệt; (2) esbuild đóng gói `src/legal/content.ts`, script Node dựng lại từng hằng số thành dòng markdown và so từng byte với file md; (3) một test Vitest tạm thời `test/legal/zz-reviewer-2707b.test.ts` gọi HTTP thật (đã chạy, rồi **xóa** khỏi cây; `git status` sạch); (4) so từng byte câu zh của thông báo board với bản Owner duyệt.

## Verdict

**APPROVE.**

Câu chữ pháp lý được chép đúng từng byte, ở đúng vị trí phụ lục chỉ định, trong cả hai file md và bốn hằng số. Không có chữ nào bị viết lại. Phần còn lại giống hệt `privacy-m7.md` và `terms.md` hiện tại trên `main`, kể cả câu chữ OAuth của EPIC 26. Cơ chế phiên bản chạy đúng qua HTTP. Hai nghĩa vụ bắt buộc từ 2707a (F1, F2) đã làm. Hôm nay production không đổi gì. Không có BLOCKER, HIGH hay MEDIUM.

## Kết quả script

**Script 1+2 (`rv27b_verify.py` + `rv27b_dump.mjs`): 235 kiểm tra, 0 FAIL.** Đã thử đột biến: đổi "30 days" thành "31 days" và bỏ một dấu phẩy trong bản VI của hằng số, thì script ra 5 FAIL. Vậy script không xanh rỗng.

| Nhóm | Kết quả |
|---|---|
| NFC | 6 file (`privacy-board.md`, `terms-board.md`, `privacy-m7.md`, `terms.md`, `content.ts`, phụ lục) và 10 hằng số đã dựng lại: đều ở dạng NFC, không có khoảng trắng thừa. |
| Câu chữ duyệt lấy từ phụ lục | Lấy tự động: 24 dòng (§12.2: 7 chỉ dẫn; §12.3: 3; §12.6: 7 Privacy + 3 Terms). Không còn `{N}`; EN dùng "30 days after it closes", VI dùng "30 ngày sau khi đóng". |
| Có mặt nguyên văn, đúng một lần | 48/48. Đó là 24 dòng × 2 nguồn (md và hằng số); cộng EN và VI, Privacy và Terms là 96 lần khớp. Mỗi dòng xuất hiện đúng một lần, so nguyên dòng kể cả `**…**`. |
| Vị trí | Mục 2: gạch "Requests" thay đúng chỗ (sau "Inquiries"); "Public requests" và "Interest in public requests" ngay sau "Requests". Mục 3: gạch mới ngay sau "To match requests with builders…"; đoạn căn cứ sự đồng ý là đoạn cuối mục 3, ngay sau đoạn "We rely on…". Mục 4: gạch thay đúng chỗ (sau hai gạch OAuth), hai gạch mới ngay sau nó. Mục 6: ngay sau "Requests and proposals…". Bản VI giống hệt bản EN về vị trí. Terms: gạch mới nằm trong mục 5 và mục 7; đoạn "Public requests." / "Nhu cầu công khai." nằm trong mục 6, ngay sau đoạn cũ. Tất cả khớp ở cả md và hằng số. |
| Tập cha Privacy | Board trừ các dòng đã duyệt bằng `privacy-m7.md` trừ các dòng bị thay, cùng thứ tự (EN, VI). Số dòng: 74 = 67 − 2 + 9 (EN và VI). Reviewer tự tìm lại các dòng bị thay: đúng 4 dòng, trùng `REPLACED_PRIVACY`. |
| Mục 4 (sai khác 1) | Đúng 1 gạch cũ mất và 3 gạch mới (EN và VI). Gạch thay bằng đúng từng byte bản thay trong phụ lục, và gạch cũ là tiền tố của gạch mới (chỉ nối thêm câu đã duyệt). 8 dòng còn lại của mục 4, gồm 2 gạch OAuth, giữ nguyên và giữ thứ tự. |
| Cookie | `session < invite < oauth < vid` (EN, VI). |
| Tập cha Terms | Board trừ các dòng đã duyệt bằng `terms.md`, cùng thứ tự. 43 = 40 − 0 + 3. Mọi dòng của `terms.md` vẫn còn, nên `REPLACED_TERMS = []` là đúng. |
| F11 | Hai file board có đúng hai mục `## EN` và `## VI`. Không có "Ghi chú cho Owner" hay "Bổ sung ADR-012". |
| Bản cũ sạch | `privacy.md`, `privacy-m7.md`, `terms.md`, `media-kit.md`, `disclosure.md` và 6 hằng số cũ không chứa chữ board. |
| Hằng số = md | 10/10 cặp khớp từng dòng, từng byte (giữ `**` và dấu backtick). Renderer được kiểm trước trên 6 cặp có sẵn (`privacy`, `privacy-m7`, `terms`, EN/VI); cả 6 khớp, rồi mới áp vào 4 cặp board (74, 74, 43, 43 dòng). Tôi không dùng bộ phân tích của Implementer. |

**Script 3 (probe HTTP tạm thời): 10/10 passed.** Đã thử đột biến: đổi "30" thành "31" trong dòng kỳ vọng, thì 4 ca đỏ. Vậy probe không xanh rỗng.

- Giá trị đọc thẳng từ `wrangler.jsonc` (`PRIVACY_NOTICE_GO_LIVE = 2026-10-21`, `REQUEST_BOARD_GO_LIVE = ""`), chạy theo đồng hồ thật hôm nay. `/terms` ghi "Last updated: 2026-10-11", `/vi/terms` ghi "Cập nhật lần cuối: 2026-10-11". `/privacy` ghi "Last updated: 2026-10-21", `/vi/privacy` ghi "Cập nhật lần cuối: 2026-10-21". Không trang nào có chữ board.
- Từ `B − 14` (B = 2026-11-10, M7 = 2026-10-21): thân trang `/privacy`, `/vi/privacy`, `/zh-hans/privacy`, `/zh-hant/privacy`, `/terms`, `/vi/terms`, `/zh-hans/terms`, `/zh-hant/terms` khớp **liên tục, toàn văn** với dòng md (đã bỏ markup), từ tiêu đề tới dòng cuối. EN/VI có "Last updated: B" / "Cập nhật lần cuối: B". zh hiện bản EN kèm 以英文版本为准 / 以英文版本為準.
- Sớm hơn `B − 14` 1 ms: hiện bản cũ. B + 400 ngày: vẫn bản board, ngày B. Không bao giờ quay lại.

**Script 4 (zh của thông báo board):** `privacyNotice.boardMessage` ở `zh-hans.ts` và `zh-hant.ts` trùng từng byte câu đưa Owner duyệt (mục "Cần Owner duyệt" của review 2707a; mỗi câu 71 ký tự). Diff `096bf08..ff3b838` không chạm `src/i18n`. Theo vnxsi-72, Owner đã duyệt nguyên văn hai câu này ngày 2026-10-13.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | LOW | `docs/legal/privacy-board.md` mục 3 (EN và VI), `apps/web/src/legal/content.ts` (`privacyEnBoard`/`privacyViBoard`, mục 3) | Chỉ dẫn của phụ lục là "Mục 3, **thêm vào** đoạn căn cứ". Implementer đặt câu "For public requests we rely on your consent…" / "Với nhu cầu công khai, căn cứ của chúng tôi là sự đồng ý của bạn…" thành **một đoạn riêng** ngay sau đoạn "We rely on…", chứ không nối vào cuối đoạn đó. Chữ giữ nguyên từng byte; chỉ khác cách xuống đoạn (trên trang là hai `<p>` liền nhau). Cách này giữ được kiểm tập cha theo từng dòng (đoạn cũ còn nguyên). Về nghĩa pháp lý, tôi không thấy khác biệt. | Không sửa trong task này. Chấp nhận là cách trình bày (D2 dưới đây). Khi người có chuyên môn đọc lại theo Q16 (trước VNX-2708), Owner xác nhận để hai đoạn liền nhau là được. Nếu Owner muốn gộp thành một đoạn thì đó là một task sửa riêng, đụng cả `REPLACED_PRIVACY`. |
| F2 | SUGGESTION | `apps/web/test/legal/content.test.ts` (`plain`, `linesOfDoc`, `fileLines`), `apps/web/test/config/wrangler-guard.test.ts` (`plainLine`) | Test của repo so hằng số với md **sau khi** bỏ `**`, dấu backtick và gộp khoảng trắng. Một lệch về markup (mất chữ đậm, mất `code`) hay về khoảng trắng giữa md và hằng số sẽ không đỏ. Ở lần review này, script byte-exact của Reviewer xác nhận không có lệch nào, nên đây không phải lỗi hiện tại. | Ghi vào "Ghi nhận". Ở task dọn phiên bản pháp lý (sau D(M7) + 31 ngày), cân nhắc so chuỗi thô của hằng số với dòng md đã bỏ tiền tố `- `/`### `, để test giữ được markup. |
| F3 | SUGGESTION | `apps/web/src/legal/content.ts:1-6` | Chú thích đầu file vẫn chỉ liệt kê `terms.md`, `privacy.md`, `media-kit.md`, `disclosure.md`. Chú thích ngay trên `privacyEnBoard` và trên `BOARD_LEGAL` đã nêu hai file board, nên không ai hiểu sai. | Ghi vào "Ghi nhận"; sửa khi có dịp đụng lại file này. |

## Phán quyết các lựa chọn thiết kế và sai khác

| # | Sai khác / lựa chọn | Phán quyết |
|---|---|---|
| D1 | Phụ lục §12.2/§12.6 ghi "Mục 4, thay **gạch thứ hai**". Sau EPIC 26, gạch đó đứng thứ tư (hai gạch OAuth chèn vào trước). Implementer thay gạch "Builders do not see clients' email addresses…" / "Builder không thấy email của client…". | **Chấp nhận.** Phụ lục được viết trước khi OAuth merge. Câu thay thế bắt đầu đúng bằng câu của gạch cũ, rồi nối thêm câu về bảng công khai, nên đích chỉ có thể là gạch này. Script xác nhận: câu thay bằng đúng từng byte bản đã duyệt; gạch cũ là tiền tố của nó; 8 dòng còn lại của mục 4 không đổi, không đổi thứ tự. |
| D2 | Đoạn căn cứ sự đồng ý (mục 3) và đoạn "Public requests." (Terms mục 6) là đoạn riêng, ngay sau đoạn cũ. | **Chấp nhận.** Terms §12.3 ghi "thêm **đoạn**", nên đúng chữ. Privacy mục 3: xem F1 (LOW, Owner xác nhận khi đọc Q16). |
| D3 | Kiểm tập cha trong `wrangler-guard.test.ts` chỉ so phần `## EN`/`## VI` (`textsOf`), không còn so cả file. | **Chấp nhận, và cần làm.** Phần đầu file board khác phần đầu file cũ (trạng thái, khi nào hiện). Nếu so cả file thì phần đầu mới làm test đỏ, còn phần đầu cũ lại phải bị coi như câu chữ trang. Phần trang hiện đúng là `## EN`/`## VI`. |
| D4 | Phần đầu hai file board tránh ghi nguyên tiêu đề hai mục bị loại, vì test cấm chuỗi đó trong file board. | **Chấp nhận.** Ý vẫn rõ ("Không chép hai mục ghi chú và phụ lục ADR-012…"). |
| D5 | Bỏ khối HTTP "before the board text exists" trong `select.test.ts`. | **Chấp nhận.** Từ task này route luôn nhận `BOARD_LEGAL` thật, nên trạng thái "ngày có, câu chữ chưa có" không còn đạt được qua HTTP. Nhánh lùi vẫn có test đơn vị với `board` rỗng truyền tường minh (`EMPTY`). Guard F1 làm trạng thái đó đỏ ở CI. |
| D6 | `BOARD_LEGAL` giữ kiểu `\| null` (tùy chọn F1 của 2707a chưa làm). | **Chấp nhận.** Giữ kiểu này để test đơn vị tiêm được bảng rỗng. Hai ca guard (một có điều kiện, một không) bảo đảm giá trị đã đăng ký khác `null`. |

## Đối chiếu tiêu chí chấp nhận (mục "Quy tắc" và "Tests phải có" của VNX-2707b, cộng nghĩa vụ 2707a)

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Chép nguyên văn §12.2, §12.3, §12.6, đúng vị trí | ✓ | Script 1: 48/48 có mặt nguyên văn, đúng một lần; vị trí đúng cho mọi dòng ở md và hằng số. |
| Nền là `privacy-m7.md`/`terms.md` hiện tại trên `main` (OAuth, `__Host-vnx_oauth`) | ✓ | `origin/main` (`04b3bc9`) là tổ tiên của HEAD; `git diff origin/main..HEAD -- docs/legal` chỉ thêm hai file board. Kiểm tập cha và thứ tự cookie đều PASS. |
| Không chép phụ lục ADR-012 và ghi chú Owner (F11) | ✓ | Script; `content.test.ts` ca "only the EN and VI texts". |
| Bốn hằng số Privacy cũ và `terms*` không sửa | ✓ | Diff `8165f1d..fe69633` của `content.ts` chỉ thêm, ngoài việc thay khai báo `BOARD_LEGAL`. Sáu cặp hằng số cũ vẫn khớp từng byte với md. |
| "Last updated" = `REQUEST_BOARD_GO_LIVE` | ✓ | `select.ts` (`updatedAt: goLive.board`); `request-board-versions.test.ts`; probe của Reviewer (EN, VI, zh). |
| zh: bản EN kèm câu "bản tiếng Anh có hiệu lực" | ✓ | `request-board-versions.test.ts` ca zh; probe: toàn văn EN trên cả 4 trang zh. |
| Test tập cha OAuth, chuỗi nhận diện, thứ tự cookie | ✓ | `content.test.ts` (3 describe mới), `wrangler-guard.test.ts` (2 ca hết `skipIf` và ca "no stale entry"). |
| `content.test.ts`: board md ↔ hằng số; bản cũ không có chữ board; mỗi câu board đúng một lần | ✓ | Có test; Reviewer kiểm lại độc lập từng byte (F2: test của repo bỏ markup trước khi so). |
| `request-board-versions.test.ts`: trước/sau `D − 14`, VI, zh, không quay lại, production-like, biến rỗng | ✓ | 8 ca, xanh. Ca production-like dùng `PRIVACY_NOTICE_GO_LIVE = 2026-10-21`, `B = 2026-11-10`. |
| Không thêm khóa thông báo trùng (D3 của 2707a) | ✓ | Diff không chạm `src/i18n`. |
| F1 của 2707a: guard ngày board ⇒ `BOARD_LEGAL` khác null, có chữ board | ✓ | `wrangler-guard.test.ts` có describe "REQUEST_BOARD_GO_LIVE requires the registered board texts": một ca có điều kiện, một ca không điều kiện; EN `/public request board/`, VI `/bảng nhu cầu công khai/`. |
| F2 của 2707a: comment `REQUEST_BOARD_GO_LIVE` | ✓ | `wrangler.jsonc` (d): từ B − 14, `/privacy`, `/terms` và thông báo chuyển chỉ theo ngày; B ≥ 14 ngày sau deploy mang nó; **mọi** deploy sau phải từ cây chứa commit ngày; không bao giờ xóa; câu chữ board bắt buộc có khi đặt B. Giá trị vẫn `""`. |
| 0 skipped trong bộ đầy đủ | ✓ | 210 file / 2725 passed / 0 skipped. |
| Câu zh của thông báo board được Owner duyệt nguyên văn | ✓ | Owner duyệt 2026-10-13 (theo vnxsi-72); script 4: chuỗi trong code trùng từng byte bản đưa duyệt. |

## Merge `8165f1d` (origin/main `04b3bc9` vào nhánh)

Kiểm bằng script. Với từng file `main` đổi kể từ merge-base `1362ab4`, tôi xem bản merge có giữ thay đổi của main không:

- 12 file chỉ `main` đổi: `git diff 04b3bc9 8165f1d -- <file>` rỗng cho cả 12 (VNX-0807 T6: `auth.tsx`, `login-flow.test.ts`, `login.spec.ts`, `me.tsx`, `ProfilePage.tsx`, `profile.test.ts`, `inquiries.test.ts`, `privacy-version.test.ts`, backlog, roadmap, review/report VNX-0807).
- `apps/web/src/legal/content.ts`: thay đổi của main (`LEGAL_UPDATED_AT` = `2026-10-11`) có trong bản merge, và trùng đúng hunk của main.
- `.ai/context/CURRENT-STATUS.md`: mọi dòng main thêm đều còn (4/4), trừ dòng "Cập nhật lần cuối" ở đầu file; dòng này giữ bản 2026-10-13 của nhánh, đúng. Có bullet EPIC 26, bullet "Production lần 6", các dòng bảng EPIC 27, dòng VNX-0807 bản cuối của main (✅, không còn "T6 còn mở"; chuỗi "T6 còn mở" xuất hiện 0 lần), và dòng nghĩa vụ EPIC 26 bản của main.
- `e2e/README.md`: giữ các dòng request-board của nhánh; dòng `form-errors.spec.ts` và `login.spec.ts` là bản T6 của main, mỗi dòng một lần.

Không mất gì từ `main`.

## Đối chiếu Privacy board với hành vi đã cài

Tôi đọc mã và **không thấy câu nào bị mã làm sai**. Không có câu hỏi câu chữ nào cần chuyển Owner.

| Câu trong Privacy board | Mã |
|---|---|
| Ghi thời điểm chọn và phiên bản chính sách đã thấy | `request_publications.opted_in_at`, `consent_version` (NOT NULL). `consent_version = REQUEST_BOARD_GO_LIVE` (`request-form.tsx:126`, `me-requests.tsx:82`). Opt-in chỉ có khi cổng mở (B đã tới), lúc đó `/privacy` hiện bản board với "Last updated: B", nên giá trị này đúng là phiên bản người dùng đã thấy. |
| Đội ngũ xem trước, có thể rút gọn/sửa; giữ bản đã công khai cạnh bản gốc | `pending_review` → `publish` chỉ do Ops làm; `public_title`/`public_description` là cột riêng, bản gốc trong `requests` không đổi. |
| Interest: ghi điều đó, thời điểm, ghi chú hoặc product | `request_interests.note`, `product_id`, `created_at`. |
| Ai cũng thấy bản đã công khai, danh mục, ngân sách, quốc gia, hạn chót, ngôn ngữ; không bao giờ thấy tên, email, tài khoản | `LISTING_SELECT` chỉ đọc `public_*`, `category`, `budget_band`, `country`, `deadline`, `languages`, trạng thái và các ngày; không đọc cột danh tính nào. `RequestDetail.tsx` hiện đúng các trường đó, cộng ngày đăng (không phải dữ liệu nhận diện). |
| Chỉ đội ngũ thấy interest; client không thấy trừ khi builder được mời | `listInterestsForRequest` chỉ được gọi ở `ops-marketplace.tsx` và `ops-request-board.tsx`. `/me` không đọc interest. Builder chỉ thấy interest của chính mình ở Hub. |
| Rút lại bất cứ lúc nào từ trang tài khoản; rời bảng ngay | `clientBoardActions`: `withdraw` không cần cổng, không cần request còn mở. `findPublicListing` đòi `status = 'published'`, nên vừa rút xong là 404. |
| Hiện khi còn mở và 30 ngày sau khi đóng, trừ khi gỡ sớm | `CLOSED_VISIBLE_DAYS = 30`, `requestVisibility`; `withdrawn`/`unpublished` → ẩn. |
| Yêu cầu công cụ tìm kiếm không lập chỉ mục request đã đóng | `noindex={closed}`; trang đóng không có canonical và nằm ngoài sitemap (e2e `request-board-public.spec.ts`). |
| Bản đã công khai và lựa chọn được giữ cùng request; interest theo cùng quy tắc với request | `ON DELETE CASCADE` từ `requests` ở cả hai bảng; không job nào xóa publication hay interest riêng. |
| Dismiss không gửi email (danh sách 2706b) | `ops-request-board.tsx:28`: không có email cho builder; chỉ publish/reject/unpublish gửi email cho client. |

## Nghĩa vụ để lại cho task sau

- **VNX-2708 (Owner, bắt buộc trước khi commit ngày B):**
  - Q16: một người có chuyên môn pháp lý đọc lại `docs/legal/privacy-board.md` và `terms-board.md` (NĐ 13/2023, GDPR). Owner xác nhận F1 (đoạn căn cứ là đoạn riêng) trong lượt đọc này.
  - Chọn `B` **≥ 14 ngày sau lần deploy đầu tiên mang nó** (và ≥ `PRIVACY_NOTICE_GO_LIVE`). Chỉ commit B trên `main` bằng một commit `chore:`. Không dùng `--var`/dashboard, không bao giờ xóa.
  - **Mọi** lần deploy sau, từ bất kỳ phiên hay nhánh nào, phải từ cây chứa commit ngày B. Nếu không, `/privacy` và `/terms` quay về bản không có board trong khi publication đã tồn tại.
  - Nếu `B < 2026-12-05`, hai thông báo hiện cùng lúc (F4 của 2707a, nhãn "Dismiss" trùng).
- **Reviewer (tài liệu, ở VNX-2708):** cập nhật `docs/runbooks/deploy.md` cho B: điều kiện chọn B (≥ 14 ngày sau deploy mang nó, ≥ M7); luật "mọi deploy sau từ cây chứa commit ngày"; kiểm sau deploy: `/privacy` và `/terms` ghi "Last updated: B" và có chữ board từ `B − 14`; thứ tự "ngày rồi cờ". Mục 9 (công tắc khẩn cấp): tắt cờ không đổi câu chữ pháp lý, vì câu chữ theo ngày.
- **VNX-2709:** kịch bản vòng đời đi qua `/privacy` và `/terms` với câu chữ board thật (các nghĩa vụ 2709 khác giữ như đã ghi).
- **Task dọn phiên bản pháp lý (sau D(M7) + 31 ngày):** cho tới khi dọn, mọi thay đổi Privacy phải sửa cả ba file (`privacy.md`, `privacy-m7.md`, `privacy-board.md`) và cả sáu hằng số; mọi thay đổi Terms phải sửa hai file và bốn hằng số. Cân nhắc F2 (so cả markup).
- **Ghi nhận:** F2, F3.
