# VNX-0711 — Chạy được khi chưa có R2 · Plan

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (chọn "Deploy hôm nay, tắt upload ảnh"; R2 bật ngày 2026-10-05)
- **Roadmap:** M7, task mới VNX-0711; liên quan VNX-0307 (bucket R2).
- **Spec:** 8.5 (ảnh R2), 7.2 (điều kiện submit cần ≥ 1 ảnh: **không đổi**).
- **Phụ thuộc:** VNX-0710 trên cùng nhánh `feat/vnx-0709-ui`.
- **Implementer / Reviewer:** subagent (cùng phiên VNX-0710) / Claude

## Vì sao làm bây giờ

Owner muốn deploy landing mới, trang pháp lý, contact, đăng nhập, đăng ký builder, Inquiry ngay hôm nay. Cloudflare từ chối deploy khi `wrangler.jsonc` có binding R2 tới bucket chưa tồn tại; R2 chỉ bật được ngày mai.

## Phạm vi

**Trong phạm vi**
1. `apps/web/wrangler.jsonc`: bỏ mục `r2_buckets` (giữ comment hướng dẫn thêm lại: `{ "binding": "MEDIA", "bucket_name": "vnxsi-media" }` sau khi `wrangler r2 bucket create vnxsi-media`).
2. `src/env.ts`: `MEDIA?: R2Bucket`.
3. Khi `MEDIA` không có:
   - `GET /media/*` → 404 (như key không tồn tại).
   - Upload ảnh product (`routes/hub-media.tsx`) → không gọi R2, không ghi D1; trả lại editor với thông báo "Image uploads open soon." / "Tải ảnh lên sẽ sớm mở." (status 503).
   - Xóa ảnh → 503 cùng thông báo (sẽ không có ảnh nào khi chưa có R2).
   - `views/hub/MediaSection.tsx`: thay form upload bằng thông báo trên (cần biết `mediaEnabled`; route truyền xuống).
   - Mọi chỗ khác dùng `MEDIA` (nếu có, kể cả portfolio): cùng nguyên tắc.
4. Điều kiện submit product **không đổi** (vẫn cần ≥ 1 ảnh): builder đăng ký, tạo nháp, điền đủ các bước được; submit chờ tới khi có R2.
5. Khi có `MEDIA` (test hiện tại, production từ ngày mai): hành vi y như cũ.

**Ngoài phạm vi:** đổi điều kiện submit; lưu ảnh nơi khác; banner công khai về R2.

## Tiêu chí chấp nhận → cách kiểm

| # | Tiêu chí | Kiểm bằng |
|---|---|---|
| AC1 | `wrangler.jsonc` không còn `r2_buckets`; có comment cách thêm lại | `grep -n r2_buckets apps/web/wrangler.jsonc` (chỉ trong comment) |
| AC2 | Env không có `MEDIA`: `GET /media/products/x.webp` → 404; upload → 503 + thông báo, không có dòng `product_media` mới; editor hiện thông báo thay form | `test/hub/media-disabled.test.ts` |
| AC3 | Env có `MEDIA`: mọi test media hiện có vẫn xanh | `npm test` |
| AC4 | Parity i18n (key thông báo ở 4 locale), typecheck | `npm test`, `npm run typecheck -w apps/web` |
| AC5 | `npx wrangler deploy --dry-run` trong `apps/web` chạy không lỗi binding | lệnh này (dry-run, không deploy) |

## Sau khi Owner bật R2 (ngày mai, việc của Reviewer + Owner, không phải task này)

`npx wrangler r2 bucket create vnxsi-media` → thêm lại `r2_buckets` vào `wrangler.jsonc` (một commit nhỏ, Implementer) → deploy.
