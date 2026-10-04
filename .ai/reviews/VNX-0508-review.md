# VNX-0508 — Privacy cho Inquiry và Turnstile · Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `.ai/plans/VNX-0508-plan.md`, handoff `.ai/tasks/VNX-0508-handoff.md`, báo cáo `.ai/tasks/VNX-0508-report.md`, diff `7602983..5750640`
- **Lệnh đã chạy lại:** `npm test -w apps/web -- test/legal` → 3 file, 21/21 xanh. Implementer báo `npm run typecheck -w apps/web` exit 0 và `npm test` 79 file, 534/534; RED trước khi sửa: 2 test (privacy EN, VI).

## Verdict

APPROVE.

## Phát hiện

Không có phát hiện. Diff chỉ đổi `privacyEn` và `privacyVi` trong `apps/web/src/legal/content.ts`; từng dòng khớp nguyên văn phần bổ sung đã duyệt trong `docs/legal/privacy.md` (test so từng dòng với file nguồn bảo đảm điều này). Không đổi Terms, Media Kit, view, route hay test; `LEGAL_UPDATED_AT` giữ `2026-10-04`.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 `/privacy`, `/vi/privacy` có đúng phần bổ sung | ✓ | `test/legal/content.test.ts` (RED 2 → GREEN) |
| AC2 Không đổi gì khác ở ba trang pháp lý | ✓ | `test/legal` 21/21; diff chỉ 2 hằng |
| AC3 Typecheck và toàn bộ test xanh | ✓ | báo cáo Implementer: exit 0; 534/534 |

## Nghĩa vụ để lại cho task sau

- Mỗi task thêm dữ liệu cá nhân (M6 request, M7 lượt xem và `/go/`, EPIC 21) sửa Privacy trong cùng task (quy tắc VNX-0705a).
