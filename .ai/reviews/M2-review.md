# M2 (VNX-0201 … VNX-0205c) — Review

- **Reviewer:** Claude (điều phối) + reviewer độc lập cho từng task (Sonnet) và review toàn nhánh (Opus)
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `docs/superpowers/plans/2026-10-04-vnxsi-m2-builder.md`, báo cáo của Implementer từng task, diff `8eb4b6b..6cc9974`
- **Lệnh đã chạy lại:** `npm run typecheck -w apps/web` → exit 0; `npm test` → 37 file, 192/192 test xanh

## Verdict

APPROVE. Review toàn nhánh trả "With fixes" (0 BLOCKER, 1 HIGH, 9 LOW). Lượt sửa F1–F9 ở `6cc9974` đã được re-review: cả 9 phát hiện đều đã xử lý.

## Phát hiện của review toàn nhánh

| # | Mức | File | Vấn đề | Xử lý |
|---|---|---|---|---|
| F1 | HIGH | `src/views/Layout.tsx` | Không có link nào tới Builder Hub; người quay lại không vào được Hub | Đã sửa: link Hub ở header khi đã đăng nhập |
| F2 | LOW | `src/routes/admin.tsx` | Email duyệt dùng handle đọc trước khi cập nhật | Đã sửa: dùng bản ghi `RETURNING` |
| F3 | LOW | `src/domain/builder-input.ts`, `portfolio.ts`, `admin.tsx` | Trình duyệt gửi CRLF nên bio gần 2000 ký tự bị báo quá dài | Đã sửa: chuẩn hóa CRLF → LF trước khi kiểm |
| F4 | LOW | `src/routes/admin-users.tsx` | Khóa user gồm 3 lệnh D1 rời; session có thể "sống lại" khi mở khóa | Đã sửa: một `db.batch`, statement nằm ở module sở hữu bảng |
| F5 | LOW | `src/views/admin/UsersPage.tsx` | Cột Admin đọc `is_admin` cũ thay vì `ADMIN_EMAILS` | Đã sửa |
| F6 | LOW | `src/routes/hub-portfolio.tsx` | Builder bị khóa vẫn mở được form sửa portfolio | Đã sửa: 409 |
| F7 | LOW | `src/views/hub/PortfolioPage.tsx` | Nút Sửa/Lên/Xuống/Xóa lặp lại không có tên riêng cho trình đọc màn hình | Đã sửa: `aria-label` kèm tên dự án |
| F8 | LOW | `test/hub/profile.test.ts` | Chưa test audit `builder.profile_update` (quyết định Owner) | Đã thêm test |
| F9 | LOW | `apps/web/wrangler.jsonc` | Ghi chú deploy chưa nhắc `0004_builders` | Đã sửa |
| G1 | LOW | thiết kế invite | Hash invite vừa là khóa DB vừa là giá trị cookie | Để lại, ghi trong `CURRENT-STATUS.md` (quyết định sau) |
| G2 | LOW | `src/routes/builder-profile.tsx` | Canonical lấy origin từ request | Để lại cho M4 (VNX-0404) |
| G3 | LOW | `/join/<code>` | Mã thô có thể nằm trong log request của nền tảng | Chấp nhận, ghi nhận |

Các minor từng task (không chặn merge, theo phân loại của review toàn nhánh) nằm trong mục "Ghi nhận" của `CURRENT-STATUS.md`.

## Đối chiếu cổng ra M2

| Tiêu chí | Đạt? | Bằng chứng |
|---|---|---|
| Builder có invite đăng ký và được duyệt ngay | ✓ | `test/admin/invites.test.ts` "takes an invited builder from the link to a public profile (M2 exit gate)" |
| Builder không có invite vào `pending`, admin duyệt được | ✓ | `test/hub/apply.test.ts` "creates a pending builder without an invite"; `test/admin/builders.test.ts` "approves, e-mails the builder…" |
| `/b/:handle` chỉ hiện builder `approved` | ✓ | `test/public/builder-profile.test.ts` (pending/rejected/suspended/tài khoản bị khóa → 404); `test/admin/suspend.test.ts` |

## Quyết định của Reviewer trong lúc thực thi

- Commit `1d6b4b8` mang trailer "Claude Sonnet 5.5" thay vì dòng Opus của plan: giữ nguyên, không viết lại lịch sử.
- Task 9 sửa test M1 `test/db/users.test.ts` (giả định cũ chỉ nâng quyền admin) cho khớp quyết định Owner đồng bộ hai chiều.
- Task 9 viết helper test dạng `async` vì cách viết trong plan lỗi TS7006.

## Nghĩa vụ để lại cho task sau

- Deploy sau khi merge: `db:migrate:remote` áp `0003_identity` và `0004_builders`.
- M4 (VNX-0404): canonical/hreflang dùng `APP_ORIGIN`.
- Trước M5: `Cache-Control: no-store` cho `/hub*`, `/admin*`, `/me*`.
- Quyết định thiết kế lại cookie invite (G1) trước khi phát nhiều invite ra ngoài.
