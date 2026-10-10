# VNX-2607 — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** plan Task 12 viết lại (áp vào cả `privacy.md` và `privacy-m7.md`; Owner 2026-10-10: sửa Terms §4 câu 2, giữ câu cookie, không đổi `LEGAL_UPDATED_AT`), báo cáo `.ai/tasks/VNX-2607-report.md`, diff `69992f9..1d19382`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 188 file / 2283 test xanh; `LEGAL_UPDATED_AT` vẫn "2026-10-05"; trailer đúng dòng Opus. Implementer: `npm run e2e` 59 passed.

## Verdict

APPROVE (không có phát hiện cần sửa; không có phát hiện câu chữ cần hỏi Owner)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| LOW-1 | LOW | `.ai/tasks/VNX-2607-report.md:27` | Bằng chứng RED một phần (markdown đã sửa trước lần chạy đầu) | Ghi nhận quy trình; các assert fail theo cấu tạo nếu thiếu dòng |
| LOW-2 | LOW | báo cáo | Lần chạy toàn bộ đầu có 6 timeout 5 s ở file không liên quan, chạy lại sạch | Đưa vào "Ghi nhận" của `CURRENT-STATUS.md` |
| S-1 | SUGGESTION | `src/legal/content.ts:4` | Chú thích ghi ngày duyệt 2026-10-07, Terms §4 câu 2 duyệt 2026-10-10 | Không sửa (chú thích nội bộ) |
| S-2 | SUGGESTION | `src/db/identities.ts` `listPublicBadges` | "Google không bao giờ hiện" chỉ dựa vào kiểu `BadgeProvider[]` | Task sau: thêm `AND i.provider IN ('github','linkedin')` trong SQL |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Mỗi câu đã duyệt áp đúng từng ký tự, đúng chỗ, ở `privacy.md` và `privacy-m7.md`, EN và VI; không thiếu, không thừa, không sót chữ cũ | ✓ | script độc lập áp lại phần bổ sung lên base: khớp chuỗi tuyệt đối 6/6 phần |
| `__Host-vnx_oauth` ngay sau `__Host-vnx_invite` (trước `__Host-vnx_vid` ở M7) | ✓ | `docs/legal/privacy.md:68, 150`; `docs/legal/privacy-m7.md:71, 157`; `src/legal/content.ts:320, 453, 586, 719` |
| Terms §4 câu 2 theo bản Owner sửa 2026-10-10, phần còn lại không đổi | ✓ | `docs/legal/terms.md:28, 88, 146, 151`; `src/legal/content.ts:51, 163` |
| Sáu hằng số khớp markdown theo thứ tự; `content.test.ts`, `privacy-version.test.ts` không đổi và xanh | ✓ | script so 38/38/61/61/65/65 dòng |
| `linked-accounts.test.ts` đọc câu chữ từ phần bổ sung, không vô nghĩa, có kiểm chéo với code | ✓ | `test/legal/linked-accounts.test.ts` |
| Không câu nào sai so với code đã gộp (đăng nhập OAuth không tạo tài khoản; chỉ session `magic_link` liên kết được; nhãn; danh sách cookie; "chỉ bạn thấy") | ✓ | `src/routes/oauth.tsx:78, 116, 158-159`; `src/domain/identity.ts:46-47`; `src/routes/me.tsx:80, 93` |
