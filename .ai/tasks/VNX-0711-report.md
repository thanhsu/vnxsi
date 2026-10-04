# VNX-0711 — Báo cáo Implementer

- **Task:** VNX-0711 (chạy được khi chưa có R2)
- **Plan:** `.ai/plans/VNX-0711-plan.md` (APPROVED 2026-10-04). Plan được commit riêng ở `addf5ab`.
- **Nhánh:** `feat/vnx-0709-ui`, nối tiếp VNX-0710. Không push, không merge, không deploy. Chỉ chạy `wrangler deploy --dry-run`.
- **Implementer:** subagent Claude (cùng phiên VNX-0710)

## 1. Commit

| SHA | Nội dung |
|---|---|
| `addf5ab` | docs: VNX-0711 plan (run without R2), Owner approved |
| `c86130a` | test(web): media without an R2 binding (VNX-0711). Test viết trước và đã chạy đỏ: 5 hỏng, 1 đạt (AC3 vốn đúng từ trước). |
| `4b726ba` | feat(web): run without an R2 binding until R2 is enabled (VNX-0711) |
| (commit này) | docs: VNX-0711 implementer report |

## 2. Thay đổi

- `apps/web/wrangler.jsonc`: bỏ `r2_buckets`. Thay bằng comment giải thích lý do (binding tới bucket chưa tồn tại sẽ chặn deploy), mô tả hành vi khi thiếu `MEDIA`, và cách bật lại: `wrangler r2 bucket create vnxsi-media` rồi thêm lại `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "vnxsi-media" }]`.
- `src/env.ts`: `MEDIA?: R2Bucket`.
- `src/routes/media.ts`: không có `MEDIA` thì `GET /media/*` trả 404, giống key không tồn tại.
- `src/routes/hub-media.tsx`: upload và xóa ảnh, sau các bước kiểm quyền sở hữu và khóa sửa: không có `MEDIA` thì trả 503, render lại bước Demo với thông báo. Không gọi R2, không ghi D1, không đọc body upload.
- `src/routes/hub-products.tsx` (`stepPage`): truyền `mediaEnabled = c.env.MEDIA !== undefined` xuống editor; thêm 503 vào danh sách status.
- `src/views/hub/EditorPage.tsx`, `src/views/hub/MediaSection.tsx`: khi `enabled = false`, khối Screenshots hiện thông báo "Image uploads open soon." / "Tải ảnh lên sẽ sớm mở." thay cho form upload, và ẩn nút xóa. Thêm mã lỗi `unavailable`; khi có lỗi này thì thông báo mang `role="alert"` và không hiện thêm một dòng lỗi trùng.
- i18n: key `media.unavailable` ở 4 locale (EN, VI theo plan; zh-Hans "图片上传即将开放。", zh-Hant "圖片上傳即將開放。").
- Điều kiện submit product **không đổi**: vẫn cần ít nhất 1 ảnh, không sửa dòng nào trong `domain/product.ts`.
- Portfolio không dùng R2 (chỉ lưu URL), nên không cần đổi.

**File ngoài phạm vi plan (lý do):**
- `apps/web/vitest.config.ts`: thêm `r2Buckets: ["MEDIA"]` cho miniflare. Test lấy binding từ `wrangler.jsonc`; khi `r2_buckets` bị bỏ, test media hiện có sẽ mất bucket. Dòng này giữ cho AC3 ("có `MEDIA` thì như cũ") vẫn kiểm được.
- `apps/web/test/hub/media.test.ts`: `testEnv.MEDIA.list` đổi thành `testEnv.MEDIA!.list`, vì typecheck báo lỗi khi `MEDIA` là optional. Không đổi ý test.

## 3. Tiêu chí chấp nhận

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC1 | Đạt | `grep -n r2_buckets apps/web/wrangler.jsonc` chỉ in ra dòng comment: `23:  // "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "vnxsi-media" }],`. Test `AC1` trong `test/hub/media-disabled.test.ts` đọc file và kiểm phần code (đã bỏ comment) không còn `r2_buckets`, đồng thời comment có hướng dẫn thêm lại. |
| AC2 | Đạt | `test/hub/media-disabled.test.ts` dùng env `{ ...testEnv, MEDIA: undefined }`: `GET /media/products/<ULID>/<ULID>.webp` trả 404; upload (EN và VI) trả 503 kèm thông báo đúng locale, không có dòng `product_media` mới; xóa ảnh trả 503 và dòng vẫn còn; bước Demo (`/vi/…/edit/demo`) hiện thông báo, không có `enctype="multipart/form-data"`, không có `name="file"`, form văn bản của bước Demo vẫn còn. |
| AC3 | Đạt | Có `MEDIA` (testEnv): toàn bộ `test/hub/media.test.ts` vẫn xanh; editor vẫn có form upload và không có thông báo (test AC3 mới). |
| AC4 | Đạt | Parity i18n xanh; `npm run typecheck -w apps/web` exit 0. |
| AC5 | Đạt | `npx wrangler deploy --dry-run` trong `apps/web` chạy hết, không lỗi binding (output bên dưới). |

## 4. Kết quả lệnh

```
$ npm run typecheck -w apps/web
(tsc không in lỗi; exit 0)

$ npm test
 Test Files  88 passed (88)
      Tests  640 passed (640)

$ cd apps/web && npx wrangler deploy --dry-run
 ⛅️ wrangler 4.147.0
✨ Read 38 files from the assets directory …\apps\web\public
Total Upload: 1426.09 KiB / gzip: 267.78 KiB
Your Worker has access to the following bindings:
Binding                                                  Resource
env.DB (vnxsi)                                           D1 Database
env.ASSETS                                               Assets
env.APP_ORIGIN ("https://vnx.si")                        Environment Variable
env.TURNSTILE_SITE_KEY ("0x4AAAAAAFNhEcGnR8e56X8X")      Environment Variable
--dry-run: exiting now.

$ grep -n r2_buckets apps/web/wrangler.jsonc
23:  // "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "vnxsi-media" }],
```

Số test: 634 (sau VNX-0710) → 640 (thêm 6 test trong `test/hub/media-disabled.test.ts`).

## 5. Sai khác và ghi chú

- Không có sai khác về hành vi so với plan.
- Upload khi không có R2: kiểm `MEDIA` ngay sau khi kiểm sở hữu và khóa sửa, trước khi đọc body. Vì vậy file lớn hoặc sai định dạng cũng nhận 503 kèm thông báo chứ không nhận lỗi kích thước hay định dạng. Không có gì được ghi.
- Comment "Deploy order" trong `wrangler.jsonc` vẫn giữ bước `0. wrangler r2 bucket create vnxsi-media (once)`. Bước này vẫn đúng cho lúc bật R2, nên không sửa.
- Khi Owner bật R2: tạo bucket, bỏ dấu comment ở dòng `"r2_buckets"` (một commit nhỏ), rồi deploy. `vitest.config.ts` có thể giữ nguyên dòng `r2Buckets`.

## 6. Câu hỏi mở

Không có.
