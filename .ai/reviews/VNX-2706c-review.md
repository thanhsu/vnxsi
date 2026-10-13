# VNX-2706c — Review (sửa M-1 và S-1 của review VNX-2709)

- **Reviewer:** Claude (Opus subagent, review độc lập)
- **Ngày:** 2026-10-13
- **Đã đọc:** `.ai/reviews/VNX-2709-review.md` (M-1, S-1), `.ai/context/CURRENT-STATUS.md` (nghĩa vụ VNX-2706c), báo cáo `.ai/tasks/VNX-2706c-report.md`, toàn bộ diff `ba5c354..d519213` (`routes/hub-invitations.tsx`, `test/hub/interests.test.ts`, `test/public/request-board-gate.test.ts`).
- **Lệnh đã chạy lại (HEAD `d519213`):**
  - `npm run typecheck -w apps/web`: exit 0.
  - `npm test -w apps/web -- test/hub/interests.test.ts test/public/request-board-gate.test.ts --maxWorkers=2 --testTimeout=60000`: **2 file, 18 passed**.
  - Toàn bộ `npm test -w apps/web -- --maxWorkers=2 --testTimeout=60000`: **211 file, 2739 passed** (2737 + 2 test mới).
  - `npm run e2e`: **không chạy** (D: còn khoảng 18–57 MB trong lúc review, dưới ngưỡng 300 MB). Thay đổi chỉ ở việc truyền prop cho view; spec `request-board-interest.spec.ts` dùng Hub với cờ bật, nên đường đó không đổi.
  - **Probe (bản sao tạm `test/public/zz-probe-gate.test.ts`, đã xóa):** thu hẹp `allow` thành chỉ trang Hub của builder A **sau** khi A được mời → test vòng đời vẫn 12/12. Xem L-1.

## Verdict

**APPROVE.**

M-1 đã đóng đúng đề xuất: `interests={boardOn || rows.length > 0 ? rows : undefined}`, view vẫn dùng `interests ? <InterestsSection/> : null` nên cổng tắt và không có dòng thì không có mục, không có câu nhắc tới bảng; cổng tắt mà có dòng thì vẫn hiện trạng thái, tiêu đề không link (S-2 của 2706a, test hiện có xanh); cổng bật mà không có dòng thì hiện câu rỗng đã duyệt (test mới). Không đổi câu chữ, không đổi route khác. Test mới phủ cả cờ tắt và ngày rỗng, EN và VI, và đỏ trên mã cũ (probe HTTP của review 2709 là đúng ca này, đảo chiều). S-1 đã làm: mọi lần lấy Hub trong test vòng đời đi qua `pub()` nên vào bộ quét bước 12.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| L-1 | LOW | `apps/web/test/public/request-board-gate.test.ts:52` (`hubPage`) | Câu hỏi của controller: miễn trừ có phải chỉ một chuỗi, chỉ trên trang Hub, chỉ cho builder được mời? **Một chuỗi:** đúng (`[main.title]`, tiêu đề gốc client gõ; mọi chuỗi riêng tư khác, kể cả `main.requestId`, email, tên, mô tả gốc, ghi chú admin, vẫn bị quét). **Chỉ trang Hub:** đúng (`allow` chỉ gắn qua `hubPage`, tức `/hub/invitations`; trang `/requests/*` của mọi builder vẫn bị quét đủ). **Chỉ builder được mời:** **không**: `hubPage` gắn miễn trừ cho mọi cookie (B bị Dismiss, C) và cả trang Hub của A **trước** khi được mời (bước 6). Đó chính là các trường hợp mà tiêu đề gốc không được phép xuất hiện, nên bộ quét không bắt được nếu sau này Hub của builder chưa được mời lộ tiêu đề gốc. Probe chứng minh miễn trừ hẹp là đủ: chỉ A, chỉ sau khi có `invitedLinkId`, test vẫn 12/12. Sản phẩm hiện tại không lộ (danh sách lời mời M6 lọc theo `builderId`; mục interest dùng `public_title`). | Thu hẹp: `pub("/hub/invitations", cookie, boardEnv, cookie === A?.cookie && invitedLinkId !== "" ? [main.title] : undefined)`. Không chặn merge: bộ quét sau sửa vẫn mạnh hơn trước (trước đó trang Hub không bị quét). Làm ở task sau chạm vào file này, hoặc gộp vào lần sửa nhỏ kế tiếp. |

## Đối chiếu tiêu chí chấp nhận

| AC (nghĩa vụ VNX-2706c) | Đạt? | Bằng chứng |
|---|---|---|
| Chỉ render mục khi cổng bật hoặc có ít nhất một dòng | ✓ | `hub-invitations.tsx:83` |
| Giữ S-2 của 2706a | ✓ | Test "S-2: with the board switched off…" xanh; `link: boardOn` không đổi |
| Cổng tắt (ngày rỗng, cờ tắt), không dòng: không `id="interests"`, không tiêu đề/câu rỗng, EN và VI | ✓ | Test mới thứ nhất (2 env × 2 locale, thêm kiểm "public request board" / "bảng nhu cầu công khai") |
| Cổng bật, không dòng: câu rỗng đã duyệt | ✓ | Test mới thứ hai |
| Không đổi câu chữ | ✓ | Diff không chạm `i18n/messages` |
| S-1: Hub vào bộ quét | ✓ (L-1) | `hubPage()` ở 6 chỗ |

## Nghĩa vụ để lại cho task sau

- L-1 (thu hẹp `allow`): task sau chạm `request-board-gate.test.ts`.
- Khi có thể (D: > 300 MB, hoặc trên CI khi mở PR): `npm run e2e` toàn bộ trên `d519213`.
