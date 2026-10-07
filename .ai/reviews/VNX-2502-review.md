# VNX-2502 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** handoff `.ai/tasks/VNX-2502-handoff.md`, báo cáo `.ai/tasks/VNX-2502-report.md`, diff `ddbc11c..001a733` (10 file, +505/−8): `src/auth/ops.ts`, `src/app.ts`, `src/db/ops-members.ts`, `src/http/no-store.ts`, `src/views/seo.ts`, test.
- **Lệnh đã chạy lại (Reviewer, sau khi ổ D: có chỗ):** `npm run typecheck -w apps/web` → exit 0; `npm test -- test/ops test/i18n/parity.test.ts test/seo test/db/ops-members.test.ts test/architecture.test.ts test/http` → 16 file, 97/97. Kết quả toàn bộ của Implementer: 1315/1319, 4 timeout ngẫu nhiên do máy tải, chạy riêng 36/36.

## Verdict

**APPROVE.**

## Đối chiếu

- `opsNotFound`: một response duy nhất, trang 404 EN render như ở `/`, không phản chiếu đường dẫn → 5 trường hợp từ chối giống byte (trừ request id).
- `resolveOpsRole`: đọc `users` + `ops_members` một truy vấn mỗi request; `ADMIN_EMAILS` → owner; không dùng `is_admin`.
- `requireOps(capability)`: từ chối → `opsNotFound`, không redirect/403; đặt `opsRole`.
- `opsHeaders` đăng ký ngay sau `securityHeaders` cho `/ops`, `/ops/*`: bao cả 403 Origin và 413 body; thứ tự middleware toàn site không đổi.
- Route bắt cuối `/ops`, `/ops/*` → `opsNotFound`; `robots.txt` có `Disallow: /ops`; `no-store` private thêm `ops`; parity miễn `ops.*` và cấm `ops.*` trong file không phải EN.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | MEDIUM | Kiểu `Messages = Record<MessageKey, string>` sẽ buộc vi/zh có khóa `ops.*` ngay khi `en.ts` có | Đưa vào phạm vi **VNX-2503**: kiểu cho file không phải EN loại `` `ops.${string}` ``; `t.ts` fallback EN cho `ops.*` |
| F2 | LOW | POST khác origin dưới `/ops/*` nhận 403 "Forbidden" của `originCheck` | Chấp nhận: hành vi toàn site, không lộ Ops, đã có `no-store`/`noindex`; spec §5 yêu cầu giữ Origin check |
| F3 | LOW | `/vi/ops`, `/zh-hans/ops`, `/zh-hant/ops` rơi vào 404 locale thường (không header Ops) | Đưa vào **VNX-2508**: mọi `/{locale}/ops*` → `opsNotFound` + header Ops (không tạo bản locale của Ops) |
| F4 | Môi trường | Ổ D: từng đầy (0 byte) do tiến trình khác, chặn commit và test tạm thời | Đã có chỗ lại; báo cáo và review đã commit, lệnh kiểm đã chạy lại |

Sai khác do Implementer báo (render `ErrorPage` trực tiếp thay `errorResponse` để không phản chiếu đường dẫn; vị trí `opsHeaders`; export thêm `resolveOpsRole`, `OpsAccess`, `findOpsAccess`; luật parity nằm trong file test; app test nhỏ sao chép chuỗi middleware nhưng kiểm chính bằng app thật): đã xem, chấp nhận.
