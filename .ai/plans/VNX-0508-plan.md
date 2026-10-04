# VNX-0508 — Privacy cho Inquiry và Turnstile · Plan

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (cả câu chữ trong `docs/legal/privacy.md`)
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M5 (nghĩa vụ sau merge M5; quy tắc VNX-0705a: task thêm dữ liệu cá nhân phải sửa Privacy)
- **Spec:** Wave 1 mục 5.6 (Inquiry), 8.2 (Turnstile, rate limit), 8.4 (cron); `docs/legal/privacy.md` (APPROVED 2026-10-04, bổ sung ở đây)
- **ADR:** ADR-003 (i18n)
- **Phụ thuộc:** M5 đã merge (`main` @ `89723e4`)
- **Implementer / Reviewer:** subagent / Claude

## Vì sao làm bây giờ

M5 thêm dữ liệu cá nhân (tên, tin nhắn, ngân sách, hạn chót, tài khoản ngầm) và gửi IP cho Cloudflare Turnstile. Trang Privacy hiện không nói tới những điều này; phải đúng trước khi M5 lên production.

## Phạm vi

- Trong phạm vi: phần bổ sung đánh dấu ở `docs/legal/privacy.md` (EN + VI: mục 2 "Inquiries" và "Bot check", mục 3 một dòng, mục 4 một câu + Turnstile trong Cloudflare, mục 6 một dòng; ghi chú đầu file đối chiếu code M5); chép nguyên văn vào `apps/web/src/legal/content.ts` (`privacyEn`, `privacyVi`); `LEGAL_UPDATED_AT` giữ `2026-10-04` (cùng ngày).
- Ngoài phạm vi: Terms, Media Kit; bản dịch zh của thân văn bản (VNX-0801); cookie mới (không có); thay đổi hành vi code.

## Thiết kế

- Chỉ sửa dữ liệu trong `content.ts`; thứ tự mục, đoạn, gạch đầu dòng giống hệt nguồn markdown.
- Test sẵn có `test/legal/content.test.ts` so từng dòng của trang `/privacy` (EN, VI) với phần `## EN` / `## VI` của `docs/legal/privacy.md`: sau khi sửa markdown, test fail (RED) cho tới khi `content.ts` khớp (GREEN). Không cần test mới.

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `/privacy` và `/vi/privacy` hiển thị đúng nguyên văn phần bổ sung | `npm test -w apps/web -- test/legal/content.test.ts` |
| AC2 | Không đổi gì khác trên ba trang pháp lý | `npm test -w apps/web -- test/legal` |
| AC3 | Toàn bộ test và typecheck xanh | `npm run typecheck -w apps/web && npm test` |

## Câu hỏi mở

- OQ-1 (Owner): duyệt câu chữ phần bổ sung (EN + VI) trong `docs/legal/privacy.md`. Như bản gốc: không phải tư vấn pháp lý.
