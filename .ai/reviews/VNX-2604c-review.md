# VNX-2604c — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-08
- **Đã đọc:** plan Task 7 (sau review plan: helper `retry` cho 400/429/502, test 429, vị trí CSS, VNX-2604d là điều kiện trước VNX-2608; câu chữ Owner duyệt nguyên văn 2026-10-08), báo cáo `.ai/tasks/VNX-2604c-report.md`, diff `e20a00e..1dfc343`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 146 file / 1612 test xanh (lần chạy đầu với số worker mặc định bị workerd hết bộ nhớ do máy cạn bộ nhớ ảo, không phải lỗi code); trailer đúng dòng Opus.

## Verdict

APPROVE

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | SUGGESTION | `src/routes/auth.tsx:348` | Nhánh 502 (gửi mail lỗi) đi qua `retry` nhưng chưa có test riêng | Chấp nhận (dùng chung đường với 400 và 429 đã test) |
| M2 | SUGGESTION | `src/routes/auth.tsx:249` | Thứ tự import không theo bảng chữ cái | Không sửa (file vốn không sắp xếp import) |
| M3 | SUGGESTION | báo cáo | Báo cáo chỉ ghi số RED/GREEN, không kèm output | Ghi nhận quy trình |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Nút là `<a>`, không form nào trỏ tới `/auth/oauth/` | ✓ | `src/views/auth.tsx:418-427`; `test/auth/login-oauth-buttons.test.ts:518-528, 587` |
| Nút chỉ hiện khi cờ bật và provider đã cấu hình (cùng luật với `start`) | ✓ | `src/routes/auth.tsx:271-277`; `src/auth/oauth/index.ts:51-53`; test :501-516 |
| Cờ tắt thì `/login` giống hệt trước | ✓ | test :482-499 |
| `lang` là Locale id, `next` qua `safeNext`, đi tiếp vào `start` đúng cookie | ✓ | `src/views/auth.tsx:380-385`; test :530-554 |
| `retry` cho 400/429/502; trang đã gửi không có nút; nhánh thành công không đọc cờ | ✓ | `src/routes/auth.tsx:321-350`; test :556-579 |
| CSS 3 dòng sau `.field [aria-invalid="true"]`; không style/script nội tuyến, không `<img>`, `<svg>`, file brand | ✓ | `public/assets/app.css:61-64`; test :587 |
| Câu chữ khớp bản Owner duyệt, đủ 4 locale | ✓ | `en.ts:100-101`, `vi.ts:137-138`, `zh-hans.ts:174-175`, `zh-hant.ts:211-212` |
| Vùng bấm 44 px, focus thấy được, tên truy cập có tên provider | ✓ | `.btn` `app.css:184`; `:focus-visible` `:105`; test :586 |

## Nghĩa vụ để lại

- **VNX-2604d trước VNX-2608** (Owner 2026-10-08): logo chính thức theo brand guideline của từng provider phải có trước khi bật cờ nào trên production. Đã ghi trong `CURRENT-STATUS.md`, roadmap và master backlog.
