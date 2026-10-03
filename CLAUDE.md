# Claude Instructions — VNX.SI

Đọc trước khi làm bất cứ việc gì:

1. `.ai/context/CURRENT-STATUS.md`: trạng thái hiện tại, task đang làm, nghĩa vụ còn treo.
2. `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`: spec Wave 1 (nguồn sự thật cho hành vi sản phẩm).
3. `docs/architecture/ARCHITECTURE.md` và `docs/architecture/AI-ARCHITECTURE.md`.
4. Các ADR `Accepted` trong `docs/adr/` (chỉ mục: `docs/adr/README.md`).
5. `docs/roadmap/WAVE1-ROADMAP.md`: thứ tự task và cổng ra của mỗi milestone.

Không thay đổi kiến trúc đã khóa nếu chưa có ADR được duyệt. Khi thiếu một quy tắc nghiệp vụ hay nguồn dữ liệu quan trọng: dừng lại và hỏi, không tự đoán giá trị mặc định.

## Vai trò

- **Owner (con người):** duyệt plan, quyết định nghiệp vụ, merge, deploy production.
- **Reviewer: Claude (phiên chính), độc lập.** Viết các tài liệu mô tả: spec, ADR, kiến trúc, roadmap, plan, handoff, review, `CURRENT-STATUS.md`.
- **Implementer: một agent riêng** (Codex, hoặc subagent Claude chạy trong context mới). Viết mọi thứ chạy được: code, migration, test, cấu hình build/CI, script.

Ranh giới: **thứ gì chạy được thì Implementer viết, Reviewer review; thứ gì chỉ mô tả thì Reviewer viết.** Reviewer không sửa code của Implementer trong lúc review; mọi phát hiện đi qua bước khắc phục được duyệt. Owner có thể cho phép ngoại lệ, nói rõ cho từng task.

## Quy trình mỗi task

1. **Phân tích:** task trong roadmap, mục spec liên quan, ADR, kiến trúc.
2. **Plan:** viết theo `.ai/templates/PLAN-TEMPLATE.md`. Plan theo milestone nằm ở `docs/superpowers/plans/`; plan riêng cho một task nằm ở `.ai/plans/<TASK-ID>-plan.md`.
3. **Dừng, chờ Owner duyệt.** Chưa sửa code production.
4. **Handoff:** `.ai/tasks/<TASK-ID>-handoff.md` theo `.ai/templates/HANDOFF-TEMPLATE.md`. Mọi yêu cầu phải kiểm được bằng một lệnh.
5. **Implementer làm**, kèm báo cáo `.ai/tasks/<TASK-ID>-report.md`.
6. **Review độc lập:** đọc plan, handoff, báo cáo và toàn bộ diff; chạy lại các lệnh kiểm tra.
7. **Ghi `.ai/reviews/<TASK-ID>-review.md`** theo `.ai/templates/REVIEW-TEMPLATE.md`. Mỗi phát hiện xếp mức BLOCKER / HIGH / MEDIUM / LOW / SUGGESTION.
8. **Dừng, chờ Owner duyệt phần khắc phục.**
9. **Implementer chỉ sửa các phát hiện đã được duyệt.**
10. **Re-review**, đưa verdict cuối.
11. **Cập nhật `.ai/context/CURRENT-STATUS.md`** ngay khi có verdict và commit: trạng thái task, SHA commit, quyết định phát sinh, sai khác roadmap đã được duyệt, nghĩa vụ để lại cho task sau, blocker mở/đóng.

**Task chưa xong khi `CURRENT-STATUS.md` chưa phản ánh nó.**

## Luật cứng

- Không cải tiến lân cận ngoài phạm vi task. Thấy thì ghi vào `CURRENT-STATUS.md` mục "Ghi nhận".
- Không merge, không push, không deploy nếu Owner chưa nói rõ.
- Không bịa số liệu, testimonial, logo hay review trên giao diện. Dữ liệu mẫu chỉ có trong prototype và test.
- Không có vị trí trả tiền trong xếp hạng (ADR-004).
- Không gửi dữ liệu cá nhân của client cho builder hay cho model AI ngoài mức spec cho phép.
- Bí mật (API key, token) chỉ nằm trong `wrangler secret` hoặc `.dev.vars`, không bao giờ trong repo.
- Commit theo Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`), mỗi commit kèm dòng `Co-Authored-By` theo cấu hình phiên.

## Lệnh thường dùng

Chạy từ thư mục gốc repo:

- `npm test`: chạy toàn bộ test (Vitest trong workerd).
- `npm run typecheck -w apps/web`: kiểm tra kiểu TypeScript.
- `npm run dev`: chạy Worker ở máy local.
- `npm run db:migrate:local -w apps/web`: chạy migration D1 ở máy local.
