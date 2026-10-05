# VNX-2504a2 — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-05
- **Đã đọc:** handoff `.ai/tasks/VNX-2504a2-handoff.md`, báo cáo `.ai/tasks/VNX-2504a2-report.md`, diff `3c4be0d..8b3f806` (`3c5b05c` test, `a6105bb` feat, `8b3f806` refactor comment). Diff `src` + `public`: 9 file, +558/−40 (không tính locale: +528/−40, dưới ngưỡng ~600).
- **Lệnh đã chạy lại (Reviewer):**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test -- test/ops test/admin test/http/security-headers.test.ts test/i18n test/architecture.test.ts` → 21 file, 214/217; 3 lỗi đều là timeout 5 s (≈7 s) do máy tải. Chạy riêng: `security-headers` 7/7, `admin/inquiries` 3/3, `admin/suspend-requests` 2/2.
  - `npm test` toàn bộ: không chạy được một lượt vì máy hết bộ nhớ ảo (Node `heap out of memory` lúc khởi động; RAM trống ~3,1 GB, ảo ~3,4 GB, C: gần đầy nên pagefile không nới). Chạy từng thư mục `test/*/` + các file gốc với `--maxWorkers=2`: **133 file, 1387/1387 xanh**, không timeout.
  - Chụp màn hình local (`wrangler dev` cổng 8795, dữ liệu mẫu `shot2504a2-seed.sql`, Owner local): danh sách 1280/390, chi tiết 1280/390, chi tiết với `<details>` Request changes mở, dark 1280.

## Verdict

**APPROVE.** Không có phát hiện cần khắc phục trước khi sang VNX-2504b.

## Đối chiếu

- **Quyền:** 2 GET qua `requireOps("marketplace.view")`; 6 POST (`approve`, `request_changes`, `suspend`, `unsuspend`, `badges`, `badges/:kind/revoke`) qua `requireOps("marketplace.act")`. Product không có / archived khi gắn huy hiệu / kind không thu hồi được → `opsNotFound`. Test: Viewer/Content × 6 POST → 404, không đổi trạng thái, huy hiệu, audit, outbox.
- **Tách logic:** `decideProduct`, `grantProductBadge`, `revokeProductBadge` trả kết quả có kiểu; thân hàm giữ nguyên (schema note, `transition(…, "admin")`, một batch trạng thái + `listed` + audit với guard compare-and-set, e-mail theo locale builder; badge evidence ≤500 / reason ≤300, audit `badge.grant`/`badge.revoke`). `/admin` ánh xạ kết quả về đúng response cũ (404 `errorResponse`, 400 trang admin, 409, 303 `?done=`). `test/admin` 105/105 không sửa test.
- **Ops:** 303 về chi tiết giữ bộ lọc + `done=1|mail_failed`; 400 render lại chi tiết với `<details>` đúng hành động mở sẵn; 409 đọc lại product và hiện trạng thái hiện tại.
- **Danh sách:** 7 tab trạng thái + "Recently edited" (bộ lọc có sẵn của admin, spec §5.5), mỗi tab có số; allowlist `status`/`view`; `q` 1–100 ký tự, `instr(lower(…))` nên `%`/`_` là chữ; thứ tự và giới hạn 200 như truy vấn admin. Hàm đọc mới nằm trong `db/products.ts` (module sở hữu bảng), `architecture.test.ts` xanh.
- **Chi tiết:** đủ trường admin cũ hiển thị, ảnh `/media/…`, tier giá, huy hiệu đang hiệu lực, History theo projection an toàn (không `data`). Link ngoài `rel="nofollow ugc noopener"` như admin cũ. Viewer không có form.
- **CSP:** không `style`/`<style>`/`<script>`; scan VNX-0803 mở rộng sang danh sách, `?view=edited`, chi tiết. Không `no-referrer`.
- **Giao diện (AC9):** cùng khối `.ops-*` với Builders; 390 px: bảng cuộn ngang trong khung, cột Status thứ hai nhìn thấy được, chi tiết về một cột, nút ≥ 44 px. Dark mode đọc được.

## Phát hiện

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| F1 | LOW | Báo cáo để chỗ trống `FULL2_RESULT` (lần chạy toàn bộ thứ hai bị ngắt cùng phiên Implementer) | Reviewer đã chạy lại và ghi kết quả ở trên; báo cáo commit nguyên trạng |
| F2 | SUGGESTION | Khối ảnh: khi ảnh lỗi, alt text hiện hai lần (alt của `<img>` + chú thích bên dưới). Ở production ảnh có thật nên chỉ thấy chú thích | Không sửa; xem lại ở VNX-2509 (visual/a11y) |
| F3 | Ghi nhận | Overview/menu đọc `countProductReviewQueue` hai lần mỗi request (giống F3 của 2504a với Builders) | Giữ; xem cùng lúc khi O2 làm số liệu |
| F4 | Ghi nhận | Tìm kiếm không phân biệt hoa thường chỉ với ASCII (SQLite `lower()`) | Đã ghi từ 2504a |
| F5 | Môi trường | Máy hết bộ nhớ ảo khi chạy `npm test` một lượt; `TaskStop` trên Windows không giết tiến trình con `wrangler dev`/`workerd` (giữ cổng) | Chạy test theo thư mục; dừng dev bằng `taskkill /T` |

Sai khác do Implementer báo (tab "Recently edited", nhãn trường `ops.products.field.*`, nhãn note khi suspend nói đúng là builder thấy trong editor, History hiện mã action, 409 huy hiệu dùng chung thông báo, không tự chụp ảnh): đã xem, chấp nhận. Ghi chú của Implementer về "batch nguyên tử thu hồi Demo verified" là đúng: handoff mô tả gộp; batch trong `admin-products.tsx` là trạng thái + `listed` + audit, việc thu hồi Demo verified ở luồng sửa demo URL của Hub, cả hai không đổi.
