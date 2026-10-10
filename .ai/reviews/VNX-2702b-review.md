# VNX-2702b — Review

- **Reviewer:** Claude (Opus subagent review độc lập)
- **Ngày:** 2026-10-10
- **Đã đọc:** mục Task VNX-2702b của plan `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (cùng quyết định thiết kế 4, M1/M2/M3, mẫu test cờ); phụ lục §3.1, §7.1, §7.2, §7.3; báo cáo `.ai/tasks/VNX-2702b-report.md`; toàn bộ diff `ebc597b..6a8a11c` (19 file, +772/−2). Theo quy ước EPIC 27, mục task của plan là handoff.
- **Lệnh đã chạy lại:**
  - `npm run typecheck -w apps/web`: exit 0, không lỗi.
  - Bộ 2702b (`test/domain/request-board.test.ts test/http/request-board-gate.test.ts test/domain/flags.test.ts test/db/flags.test.ts test/admin/flags.test.ts test/config/wrangler-guard.test.ts test/architecture.test.ts test/i18n/parity.test.ts test/db/request-board-migration.test.ts`, `--maxWorkers=2 --testTimeout=60000`): **9 file, 122 test xanh, 2 skipped** (hai kiểm tập cha, đúng dự kiến).
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **193 file, 2384 test xanh, 2 skipped** (434 s, không timeout).
  - Thử độc lập biểu thức `/[\p{Cc}\p{Cf}]/u` bằng Node (xem M-1): tiếng Việt (NFC và NFD), tiếng Trung, tiếng Hàn, emoji có tông da: không khớp; emoji nối ZWJ (`👩‍💻`, `🏳️‍🌈`), BOM U+FEFF, soft hyphen U+00AD, U+202E: **khớp**.

## Verdict

**APPROVE_AFTER_FIXES** (APPROVE WITH CHANGES): máy trạng thái, `requestVisibility`, cổng hai khóa và cách gắn middleware đúng plan và phụ lục, test đầy đủ ô bảng và biên. Một phát hiện MEDIUM (kiểm ký tự định dạng trong văn bản nhiều dòng từ chối nhầm emoji ZWJ) nên sửa ở task này vì 2704a và 2706a sẽ dùng thẳng các parser.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất | Ai |
|---|---|---|---|---|---|
| M-1 | MEDIUM | `src/domain/request-board.ts:109-115, 132, 142, 154` (`CONTROL`, `hasControl`) | Điểm lệch 3 (phần ký tự): văn bản nhiều dòng (`public_description`, ghi chú review, ghi chú interest) từ chối **mọi** `\p{Cf}`. Nhóm này có U+200D ZWJ, nên mọi chuỗi emoji ghép (`👩‍💻`, `👨‍👩‍👧`, `🏳️‍🌈`) bị trả `invalid`; cả BOM U+FEFF và soft hyphen U+00AD (hay đi kèm khi dán từ Word hay trình duyệt) cũng vậy. Quy ước hiện có của repo chỉ kiểm `Cc`+`Cf` ở **tiêu đề và tên** (`domain/request.ts:211`, `inquiry.ts:156`, `feedback.ts:98`); mô tả request và tin nhắn không bị kiểm. Hệ quả: client gửi được mô tả có `👩‍💻` ở `/request`, nhưng Ops chép nguyên văn sang bản công khai thì publish bị từ chối mà không thấy lý do; builder viết "👩‍💻 I built this" vào ghi chú interest cũng bị 400. Tiếng Việt (kể cả dạng NFD) và tiếng Trung không bị ảnh hưởng. | Với văn bản nhiều dòng: từ chối `\p{Cc}` trừ `\n`, `\t`, và chỉ những `Cf` nguy hiểm, tức ký tự điều khiển hướng chữ U+202A–U+202E và U+2066–U+2069 (kiểu Trojan Source); cho phép U+200D, U+200C, U+00AD, U+FE0F, có thể bỏ U+FEFF ở đầu chuỗi. Tiêu đề giữ quy tắc hiện tại (khớp tiêu đề request). Test: mô tả/ghi chú có `👩‍💻`, `🏳️‍🌈`, có soft hyphen → hợp lệ; U+202E, U+2066 → `invalid`; một mô tả tiếng Việt và một mô tả tiếng Trung đủ 40 code point → hợp lệ. | Implementer (task này) |
| L-1 | LOW | `src/domain/request-board.ts:161-166` (`publicExcerpt`) | Cắt theo code point nên không cắt đôi cặp surrogate, nhưng có thể cắt giữa một cụm grapheme: để lại ZWJ treo cuối (`👩‍` + `…`), tách cờ, hoặc tách chữ khỏi dấu thanh khi văn bản tiếng Việt ở dạng NFD. Tab không được gộp thành khoảng trắng (chỉ xuống dòng). Chỉ là hiển thị. | Cắt theo grapheme bằng `Intl.Segmenter(undefined, { granularity: "grapheme" })` (có trong workerd), nhưng vẫn giữ trần 200 code point; gộp mọi khoảng trắng (`\s+`) thành một dấu cách. Test: chuỗi ZWJ ở biên 200. | Implementer (task này hoặc 2705a) |
| S-1 | SUGGESTION | `src/views/admin/FlagsPage` + `i18n/messages/{vi,zh-hans,zh-hant}.ts` (`flags.desc.request_board`) | Điểm lệch 6: câu mô tả cờ ở vi/zh do AI viết, chỉ hiện trong trang Admin. | Ghi vào "Ghi nhận" để VNX-0801 (người bản xứ đọc lại) phủ. | Reviewer |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Hằng số đúng giá trị đã duyệt | ✓ | `request-board.test.ts` "have the approved values" |
| §7.1: mọi chuyển hợp lệ/không hợp lệ; `rejected`, `unpublished` cuối; opt-in lại chỉ từ `withdrawn` khi request mở; publish chỉ khi request mở; withdraw ở mọi trạng thái request | ✓ | `publicationTransition`; test quét `REQUEST_STATUSES` × trạng thái × actor, có ca "no way out" vét toàn bộ tổ hợp |
| §7.2: ba đích cuối, đúng actor | ✓ | `interestTransition`; test vét `invited/dismissed/withdrawn` × hành động × actor |
| §7.3: mọi ô (8 trạng thái request × `published` / khác / `null`), biên `+30d − 1ms` closed, `+30d` hidden, `closedAt` null/rác/rỗng ở trạng thái cuối → hidden | ✓ | `requestVisibility` (`published` là điều kiện đầu; `removed`, `pending_verification` → hidden); test "every cell" và "closed window edges", kể cả `now` NaN |
| L1 code point, khớp `length()` SQLite (S-1 của 2702a) | ✓ | `cpLength`; test emoji ở domain và `request-board-migration.test.ts` "S-1" (CHECK nhận 120 emoji, từ chối 20 emoji mô tả; parser đồng ý cả bốn ca) |
| `parseBoardQuery` không có `sort`, bỏ giá trị lạ; `isBoardIndexable(4/5)` | ✓ | test `sort=paid`, `featured`, `boost` bị bỏ, `Object.keys` đúng 4 khóa |
| Cổng: ngày trước rồi cờ, fail closed (biến rỗng/sai dạng, D1 lỗi) | ✓ | `http/request-board.ts`; `request-board-gate.test.ts` ma trận cờ × ngày, giờ giả `toFake: ["Date"]` ở biên 00:00 UTC, M3a proxy D1 reject → `false` |
| 0 truy vấn D1 trước go-live; sau go-live không thêm lần đọc ngoài cache cờ | ✓ | test F13 (`queries() = 0` với `""` và ngày tương lai) và middleware qua `/api/health` (0 trước, 1 sau khi cache nguội). `isFlagEnabled` dùng **một snapshot chung cho mọi cờ** mỗi isolate, TTL 60 s (`db/flags.ts:6-7`), nên middleware chạy cho mọi route chỉ thêm tối đa một lần đọc mỗi 60 s mỗi isolate, dùng chung với các cờ khác. Khi D1 lỗi thì không cache và lần sau đọc lại (hành vi sẵn có của mọi cờ) |
| `FLAG_KEYS`: `request_board` thứ 11, 10 key đầu giữ nguyên thứ tự | ✓ | `flags.test.ts` (`toHaveLength(11)`, `slice(0, 10)`); `db/flags`, `admin/flags` xanh không sửa |
| Ghim `REQUEST_BOARD_GO_LIVE: ""` trong `vitest.config.ts`; `wrangler.jsonc` có biến rỗng + quy tắc (a)–(c) | ✓ | diff; `wrangler-guard.test.ts` (rỗng hoặc ngày hợp lệ, không trước `PRIVACY_NOTICE_GO_LIVE`, không secret trong `vars`) |
| `RANKING_FILES` có `domain/request-board.ts`; domain không import Hono/D1 | ✓ | `architecture.test.ts` xanh |
| `flags.desc.request_board` đủ 4 locale (parity) | ✓ | `i18n/parity.test.ts` xanh |
| Kiểm tập cha Privacy/Terms board chạy khi có file | ✓ (bỏ qua có kiểm soát) | `it.skipIf(... === null)` + ca thứ ba bắt buộc `privacy-m7.md`, `terms.md` (có câu OAuth) tồn tại, nên đổi tên nguồn không biến kiểm thành vô nghĩa |

### Đánh giá năm điểm lệch

1. **Opt-in khi request `pending_verification`: chấp nhận, nhất quán với phụ lục §3.1.** Phụ lục tạo dòng publication "trong cùng batch tạo request", tức cả với client chưa đăng nhập (request `pending_verification`), và nói rõ request chưa xác nhận email "không vào hàng chờ kiểm duyệt", bị cron xóa thì dòng công khai bị xóa cùng (cascade của 2702a). Trong code hiện tại một publication `pending_review` của request `pending_verification`: (a) `requestVisibility` → `hidden` bất kể trạng thái publication; (b) `publicationTransition("publish")` và `publishStatement` (SQL) đều từ chối khi request chưa mở; (c) `countPublicationReviewQueue` chỉ đếm request `submitted|matching`. Sau khi client xác nhận email, request thành `submitted` và publication tự vào hàng chờ, không cần thao tác. Nghĩa vụ cho 2704a/2704b: danh sách hàng chờ và bộ lọc `public=pending` phải lọc request `submitted|matching` giống `countPublicationReviewQueue`, khối "Public listing" không hiện nút Publish cho request `pending_verification` (domain từ chối, nhưng UI không nên mời bấm).
2. **`isBoardLive(goLive: string, now)`:** chấp nhận (cùng mẫu `isCountingLive`; `parseBoardGoLive` vẫn có).
3. **`productId` ULID hoặc rỗng:** chấp nhận (quyền sở hữu và trạng thái product kiểm trong SQL của `createInterestStatement`). **Phần ký tự điều khiển/định dạng: xem M-1.**
4. **Ghi chú review và interest đếm code point:** chấp nhận, khớp CHECK SQL.
5. **`skipIf` cho kiểm tập cha:** chấp nhận **chỉ vì** có ca kiểm sự tồn tại của nguồn. VNX-2707b **phải** bỏ `skipIf` (đổi thành khẳng định file board tồn tại) và điền `REPLACED_PRIVACY`/`REPLACED_TERMS` bằng đúng các dòng bị thay (nghĩa vụ bên dưới).
6. **Câu mô tả cờ vi/zh do AI viết:** xem S-1.

## Nghĩa vụ để lại cho task sau

- **VNX-2704a / VNX-2704b:** hàng chờ "Public requests to review", bộ lọc `public=pending` và khối "Public listing" lọc request `submitted|matching`; không hiện Publish cho request `pending_verification` (điểm lệch 1). Ô sửa bản công khai dùng `parsePublicListing` (sau M-1).
- **VNX-2705a:** đoạn trích dùng `publicExcerpt` (sau L-1 nếu chưa sửa ở task này).
- **VNX-2706a:** form interest dùng `parseInterestForm` (sau M-1).
- **VNX-2707b:** tạo `docs/legal/privacy-board.md`, `terms-board.md`; điền `REPLACED_PRIVACY`/`REPLACED_TERMS` trong `test/config/wrangler-guard.test.ts` bằng đúng các dòng bị thay (§12.2 gạch thứ hai mục 4, §12.3); **bỏ `it.skipIf`** và thêm khẳng định hai file board tồn tại, để hai kiểm không thể tiếp tục bị bỏ qua. Review 2707b kiểm số test skipped của bộ đầy đủ về 0.
- **VNX-0801 / Ghi nhận (Reviewer):** câu `flags.desc.request_board` vi, zh-hans, zh-hant do AI viết, cần người bản xứ đọc lại.

## Re-review (vòng sửa 1, `02384ed`)

- **Ngày:** 2026-10-10. **Đã đọc:** diff `789ddce..02384ed` (`src/domain/request-board.ts`, `test/domain/request-board.test.ts`, `test/db/request-board-migration.test.ts`, phần sửa của báo cáo).
- **Lệnh đã chạy lại:** `npm run typecheck -w apps/web`: exit 0; bộ 2702b (9 file như trên): **9 file, 129 test xanh, 2 skipped**. Không chạy lại toàn bộ: lượt sửa chỉ chạm một file domain thuần chưa có nơi gọi ngoài test; Implementer báo 193 file / 2391 xanh / 2 skipped.

| # | Kết quả | Bằng chứng |
|---|---|---|
| M-1 | ✓ Đóng | Văn bản nhiều dòng dùng `BAD_IN_TEXT = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u` (sau khi bỏ `\n`, `\t`); BOM đầu chuỗi bị bỏ (`cleanText`); tiêu đề giữ `Cc`+`Cf`. Test: mô tả có `👩‍💻`, `👨‍👩‍👧`, `🏳️‍🌈`, soft hyphen, variation selector, ZWNJ, tiếng Việt NFC và NFD, tiếng Trung → hợp lệ; U+202A, U+202D, U+202E, U+2066, U+2069, U+0085, U+0000, U+001B → `invalid`; tiêu đề có ZWJ hoặc soft hyphen vẫn `invalid`. Thêm ca SQL: chuỗi ZWJ đếm mọi code point ở cả CHECK lẫn parser (35 → từ chối, 40 → nhận). |
| M-1, ZWSP | ✓ Chấp nhận | U+200B (ZWSP) giờ được phép trong mô tả và ghi chú (test cũ từ chối ZWSP được đổi). Hợp lý: ZWSP không đảo thứ tự chữ (khác bidi override), có dùng thật (ngắt dòng tiếng Thái, Khmer; hay theo văn bản dán), mô tả request ở `/request` từ trước tới nay không kiểm ký tự nào, và mọi bản công khai đều qua Ops kiểm duyệt. Rủi ro còn lại chỉ là chữ vô hình chen giữa (ví dụ trong số điện thoại); ghi nhận: nếu sau này có bộ lọc tự động tìm liên hệ hay từ khóa, phải bỏ ZWSP, ZWJ, soft hyphen trước khi so. |
| L-1 | ✓ Đóng | `publicExcerpt` gộp mọi khoảng trắng (`\s+`), cắt giữa các cụm grapheme (`Intl.Segmenter`) trong trần 200 code point; chỉ khi cụm đầu tiên đã dài hơn 200 code point mới quay về cắt theo code point. Test: không ZWJ treo, không tách cờ, không tách chữ NFD khỏi dấu, tab và NBSP thành một dấu cách. |

Không có phát hiện mới.

### Verdict cuối

**APPROVE.** VNX-2702b xong ở `6a8a11c` + `02384ed` (review `789ddce`). Nghĩa vụ ở mục "Nghĩa vụ để lại cho task sau" phía trên vẫn giữ nguyên.
