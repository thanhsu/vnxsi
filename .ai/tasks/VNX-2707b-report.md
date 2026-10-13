# VNX-2707b: báo cáo Implementer

Nhánh `feat/epic27-request-board`. Code và tài liệu pháp lý: `fe69633`. Merge `origin/main` trước khi làm: `8165f1d`.

## Làm gì
- `docs/legal/privacy-board.md`: nội dung `## EN`/`## VI` của `privacy-m7.md` hiện tại (gồm OAuth VNX-2607, cookie `__Host-vnx_oauth` giữa `__Host-vnx_invite` và `__Host-vnx_vid`) cộng phụ lục §12.2 (EN) và §12.6 (VI) nguyên văn ({N} = 30). Header ghi trạng thái APPROVED (Owner 2026-10-07, EN và VI) và đối chiếu code (hằng số, test). Không chép phụ lục ADR-012.
- `docs/legal/terms-board.md`: `terms.md` hiện tại (gồm đoạn OAuth ở mục 4) cộng §12.3 và §12.6. Không chép hai mục sau `## VI`.
- `apps/web/src/legal/content.ts`: `privacyEnBoard`, `privacyViBoard`, `termsEnBoard`, `termsViBoard`, đăng ký trong `BOARD_LEGAL` (privacy và terms, EN/VI). Sinh bằng bộ phân tích đã kiểm: cùng bộ phân tích tái tạo đúng `PRIVACY_M7` và `termsEn/termsVi` hiện có. zh hiện bản EN kèm câu "English applies" (cơ chế có sẵn).
- Vị trí chèn: gạch mới đứng ngay sau gạch nêu trong phụ lục; đoạn căn cứ đồng ý (mục 3) và đoạn "Public requests." (Terms mục 6) là đoạn riêng ngay sau đoạn cũ, nên mọi dòng cũ còn nguyên (tập cha kiểm theo từng dòng).
- Thay thế đúng bốn dòng (EN+VI): gạch "Requests"/"Nhu cầu (request)" (thêm country) và gạch "Builders do not see clients' email addresses…"/"Builder không thấy email của client…". Terms không thay dòng nào.
- `wrangler-guard.test.ts`: bỏ hai `it.skipIf`, khẳng định hai file board tồn tại; `REPLACED_PRIVACY` = bốn dòng trên, `REPLACED_TERMS` rỗng (có chú thích); thêm kiểm "mục thay thế có thật trong bản cũ và không còn trong board"; so sánh chỉ phần `## EN`/`## VI` (trước đó so cả file kể cả header, sẽ đỏ khi file board có header khác); thêm guard 2707a F1 (`REQUEST_BOARD_GO_LIVE` khác rỗng thì `BOARD_LEGAL.privacy` và `.terms` khác null, có chữ "public request board" EN và "bảng nhu cầu công khai" VI; cộng một ca không điều kiện vì giá trị trong repo vẫn rỗng).
- `select.test.ts`: ca "empty until 2707b" thành "BOARD_LEGAL đã đăng ký"; các ca dự phòng dùng `board` rỗng truyền tường minh; bỏ khối HTTP "before the board text exists" (thay bằng file mới).
- `content.test.ts`: thêm `privacy-board` và `terms-board` vào so sánh trang theo từng dòng (EN, VI), hằng số so từng dòng với file, ba file/sáu hằng số cũ không chứa từ khóa board, tập cha, chuỗi nhận diện OAuth, thứ tự cookie, mỗi câu board đúng một lần.
- `request-board-versions.test.ts` (mới): HTTP với văn bản thật: EN, VI, zh-Hans/zh-Hant (EN + câu "bản tiếng Anh có hiệu lực"), "Last updated: B" từ B−14, không quay lại sau B (ngày B và một năm sau), ca production-like (`PRIVACY_NOTICE_GO_LIVE=2026-10-21`, B=2026-11-10; M7 trước B−14, board sau), biến rỗng/sai dạng, Disclosure/Media kit không đổi.
- `wrangler.jsonc`: mở rộng chú thích `REQUEST_BOARD_GO_LIVE` (d): từ B−14 chuyển /privacy, /terms và thông báo; ≥ 14 ngày sau deploy mang nó; mọi deploy sau phải chứa commit ngày; không bao giờ xóa. Giá trị vẫn `""`.
- Không thêm khóa thông báo trùng: `privacyNotice.boardMessage` đã có; câu zh-Hans/zh-Hant Owner duyệt nguyên văn 2026-10-13 (ghi nhận ở đây và ở header privacy-board.md).

## Đối chiếu hành vi VNX-2706b
Privacy board nói đúng với code và danh sách review 2706b: chỉ đội ngũ thấy interest, client không thấy trừ khi builder được mời, Dismiss không email, dữ liệu interest giữ theo quy tắc của nhu cầu, không có câu hứa điểm hay thứ hạng. Không mâu thuẫn, không cần dừng.

## Merge `origin/main` (8165f1d), xung đột
1. `.ai/context/CURRENT-STATUS.md` (hai chỗ): giữ cả hai phía: đầu file giữ dòng "cập nhật" và bullet EPIC 27 của nhánh, thêm bullet EPIC 26 của main; bảng: giữ các dòng EPIC 27 và dùng dòng VNX-0807 bản mới của main (bỏ dòng "T1–T5, T6 còn mở" của nhánh vì main đã hoàn tất).
2. `e2e/README.md`: giữ các dòng spec request-board của nhánh, dùng dòng `form-errors.spec.ts` và `login.spec.ts` bản main (T6 xong).
Suite sau merge, trước khi làm: 209 file, 2693 pass, 2 skipped (hai `skipIf` của task này).

## Kết quả kiểm
- `test/legal/*` và `test/config/wrangler-guard.test.ts`: 108/108, 0 skipped.
- `npm run typecheck -w apps/web`: sạch. `npm run e2e:typecheck`: sạch.
- Suite đầy đủ: 210 file, 2725 test, 0 skipped.
- `npm run e2e`: 85/85 (dọn `e2e/.state`, report, results sau khi chạy). `npm run test:scripts`: 53/53.

## Sai khác và điều cần Reviewer xem
- Plan nói "thay gạch thứ hai mục 4": sau OAuth đó không còn là gạch thứ hai; thay đúng gạch "Builders do not see clients' email addresses…" (và bản VI), như ý định §12.2.
- Header privacy-board.md/terms-board.md tránh viết nguyên tiêu đề hai mục bị loại (test cấm chuỗi đó trong file board).
- Test tập cha của 2707a trước đây so cả file (kể cả header và ghi chú); đổi sang so riêng phần EN/VI cho cả hai file (cần thiết, không đổi ý định).
- `REQUEST_BOARD_GO_LIVE` giữ `""` trong repo (Owner commit ngày ở VNX-2708). Q16: người có chuyên môn pháp lý đọc lại trước khi bật cờ.
- Cảnh báo CRLF của git trên file mới là hành vi cấu hình Windows có sẵn.
