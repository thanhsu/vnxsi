# VNX-0508 — Privacy cho Inquiry và Turnstile · Handoff

- **Plan:** `.ai/plans/VNX-0508-plan.md` (APPROVED bởi Owner 2026-10-04)
- **Nhánh:** `feat/vnx-0508-privacy` (đã tạo, đang checkout)
- **Nguồn văn bản:** `docs/legal/privacy.md`, phần `## EN` và `## VI` (đã duyệt; KHÔNG sửa file này)

## Việc cần làm

1. Chạy `npm test -w apps/web -- test/legal/content.test.ts` và ghi lại kết quả fail (RED): trang `/privacy` và `/vi/privacy` chưa có phần bổ sung.
2. Sửa `apps/web/src/legal/content.ts` (`privacyEn`, `privacyVi`) để khớp nguyên văn và đúng thứ tự với phần `## EN` / `## VI` của `docs/legal/privacy.md`. Phần mới gồm: mục 2 hai gạch đầu dòng ("Inquiries", "Bot check" / "Yêu cầu (Inquiry)", "Kiểm tra chống bot"), mục 3 một gạch đầu dòng, mục 4 câu thêm sau "Builders do not see clients' email addresses." / "Builder không thấy email của client." và cụm Turnstile trong ngoặc của Cloudflare, mục 6 một gạch đầu dòng. Giữ định dạng `**đậm**` và `code` như các mục cũ trong file. Không đổi `LEGAL_UPDATED_AT`.
3. Không sửa gì khác (Terms, Media Kit, view, route, test).

## Kiểm bằng lệnh

- `npm test -w apps/web -- test/legal` → xanh (GREEN).
- `npm run typecheck -w apps/web` → exit 0.
- `npm test` → toàn bộ xanh.

## Báo cáo

`.ai/tasks/VNX-0508-report.md`: đã làm gì, file nào, RED/GREEN (lệnh + kết quả), typecheck và toàn bộ test, câu hỏi còn mở, "Ghi nhận". Commit `docs(web): privacy page covers inquiries and Turnstile (VNX-0508)` kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không push, không merge.
