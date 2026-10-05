# VNX-2503 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** handoff, báo cáo `.ai/tasks/VNX-2503-report.md`, diff `baae20a..8055306`; ảnh của Implementer (`ops-1280.png`, `ops-1280-dark.png`, `ops-390-menu.png` và các ảnh 1440/390) so với mockup `docs/design/mockups/ops/OpsOverview*.dc.html`.
- **Lệnh đã chạy lại:** `npm run typecheck -w apps/web` → exit 0; `npm test -- test/ops test/i18n test/http/security-headers.test.ts test/architecture.test.ts` → 7 file, 69/69; `grep style= src/views/ops/*.tsx` → 0. Kết quả toàn bộ của Implementer: 131 file, 1344/1344.

## Verdict

**APPROVE.**

## Đối chiếu

- Shell khớp mockup: thanh bên 240 px (logo B + OPS), thanh trên (đường dẫn, PRODUCTION, vai trò, email, Sign out), menu `<details>` ở màn hẹp; sáng và tối đọc được.
- Menu chỉ render mục có route GET thật + capability (hiện chỉ Overview); thẻ hàng chờ chưa có link vì route đích chưa có (không link chết).
- 5 hàng chờ đếm riêng (`Promise.allSettled`): lỗi một hàng → trạng thái lỗi, không 0; 0 → "Nothing waiting"; Content chỉ thấy số và nhãn.
- Recent activity: 10 dòng, không `data`; email chỉ cho Owner gốc / thành viên Ops; còn lại ID; null → `system`.
- `ops.*` chỉ ở `en.ts`; kiểu catalog không phải EN loại `ops.*` (có `@ts-expect-error` kiểm); CSP scan có trường hợp `/ops` đã đăng nhập; không `style`/`<script>`/`on*`.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | LOW | Nhãn môi trường lấy từ `APP_ORIGIN`; `wrangler.jsonc` đặt `https://vnx.si` cho mọi môi trường nên `wrangler dev` cũng hiện PRODUCTION nếu không ghi đè | Chấp nhận; khi chạy local đặt `APP_ORIGIN=http://localhost:8787` trong `.dev.vars` (ghi vào runbook/README sau) |
| F2 | SUGGESTION | Mobile hiện "PRODUCTION" thay "PROD" của mockup | Giữ; không thêm khóa mới |

Sai khác do Implementer báo (mốc tuổi theo bảng: products `updated_at`, requests `COALESCE(submitted_at, created_at)`, inquiries `opened_at`; Inquiry quá hạn = `open` và `opened_at < now − REMIND_AFTER_MS`, không lọc theo đã nhắc; không nhãn SAMPLE DATA; câu dẫn rút gọn vì chưa có link; tuổi không tô cảnh báo vì không có ngưỡng nghiệp vụ; sửa 2 file test ngoài danh sách: guard GET `/ops` đăng nhập → 200, CSP scan thêm `/ops`): đã xem, chấp nhận.
