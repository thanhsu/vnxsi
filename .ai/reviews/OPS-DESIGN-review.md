# OPS-DESIGN (spec Ops console + ADR-010) — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** commit `703f5b3` (nhánh `feat/epic21-partner-slice`, Implementer Codex): `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md`, `docs/adr/ADR-010-ops-console.md`, `.ai/tasks/OPS-DESIGN-report.md`. Đối chiếu với quyết định Owner trong phiên Reviewer 2026-10-05: 4 nhóm chức năng, chia O1–O4, `/ops` cùng Worker, 4 vai trò trong DB, giao diện Ops chỉ tiếng Anh.
- **Lệnh:** chỉ tài liệu; báo cáo Implementer ghi typecheck exit 0, 1182/1182 test trên nhánh đó.

## Verdict

**APPROVE WITH CHANGES → APPROVE** sau khi Owner trả lời và các sửa dưới đây được áp (commit trên nhánh `docs/ops-console`).

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | HIGH (quy trình) | ADR-010 ghi Accepted và spec ghi "Reviewer đã duyệt" trước khi Owner duyệt thiết kế O1; tài liệu mô tả do Implementer soạn | Owner chọn phương án (a) 2026-10-05: duyệt nội dung; trạng thái ghi rõ Owner duyệt sau review này, bản nháp do Codex soạn |
| F2 | HIGH (xác nhận) | Các quyết định ghi "Owner xác nhận" chưa thấy trong phiên Reviewer: Operator không khóa Owner gốc; Monetization chỉ Owner; Owner gốc bị khóa mất Ops; Content chỉ thấy số đếm tổng hợp | Owner xác nhận cả bốn 2026-10-05 |
| F3 | MEDIUM | Mâu thuẫn: §3.4 "đều tạo audit" vs §4/ADR "tùy chọn" cho lần từ chối do bảo vệ Owner gốc | Owner chọn **luôn ghi audit**; đã sửa §4 spec và ADR §5, thêm vào "Được bảo đảm bởi" |
| F4 | LOW | Ops chỉ tiếng Anh nhưng bắt parity bốn locale | Owner chọn **miễn parity cho `ops.*`** (chỉ `en.ts`); đã sửa ADR §1, phạm vi thay ADR-003, phương án, hệ quả, spec §6/§9 |
| F5 | LOW | Chưa đăng nhập vào `/ops` → 404, không redirect login | Chấp nhận (không lộ Ops); Owner đăng nhập ở `/login` trước |
| F6 | LOW | Tài liệu Ops nằm trên nhánh EPIC 21; README ADR chưa có ADR-010; `CURRENT-STATUS.md` chưa ghi | Đưa lên `main` bằng PR riêng (cherry-pick + sửa); thêm dòng README; ghi trạng thái |

## Nghĩa vụ để lại

- Plan O1 (Reviewer viết): thời hạn lời mời thành viên Ops; mapping route admin cuối cùng; test parity bỏ qua `ops.`; audit cho lần từ chối do bảo vệ Owner gốc.
- Nhánh `feat/epic21-partner-slice` khi gộp `main`: lấy bản trên `main` cho 3 file Ops (spec, ADR-010, báo cáo); trang monetization đặt dưới `/ops/monetization/*`.
- O2 định nghĩa thước đo và freshness; O3 cần quyết định lưu câu chữ trong DB (ADR riêng).
