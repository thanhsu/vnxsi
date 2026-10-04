# VNX-0705a — Review

- **Reviewer:** Claude
- **Ngày:** 2026-10-04
- **Đã đọc:** plan `.ai/plans/VNX-0705a-plan.md`, handoff `.ai/tasks/VNX-0705a-handoff.md`, báo cáo `.ai/tasks/VNX-0705a-report.md`, diff `fed147b..472087c` (22 file trong `apps/web`, +1307/−2); đối chiếu nhánh `feat/m5-inquiry` (`3a698e4`) cho phần cron.
- **Lệnh đã chạy lại:**
  - `npm run typecheck -w apps/web` → exit 0.
  - `npm test` → 66 file, **432/432** xanh (trước task 405).
  - `wrangler dev --port 8798`: `/terms`, `/vi/privacy`, `/zh-hans/media-kit`, `/zh-hant/terms`, `/media-kit` → 200.
  - Chrome headless: 360 px (iframe) `/zh-hant/terms`, `/vi/media-kit` sáng; 1280 px `/vi/privacy` tối.

## Verdict

**APPROVE.** Không có phát hiện chặn merge. Nội dung lấy từ `docs/legal/*.md` và được test đối chiếu thứ tự từng mục (AC2), nên không có câu tự thêm. Cron đúng thiết kế: mỗi bảng chỉ bị xóa từ module sở hữu, mỗi bước bọc lỗi riêng, idempotent.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | LOW | `docs/legal/{terms,privacy,media-kit}.md` dòng "Task" | Ghi đích là `src/content/legal/*.ts`, trong khi plan và code dùng `src/legal/content.ts`. Lỗi của Reviewer khi soạn | Reviewer sửa ngay trong lượt review (tài liệu mô tả), không cần Implementer |
| F2 | SUGGESTION | `src/i18n/messages/zh-*.ts` (`legal.*.title`, `footer.nav`) | Implementer tự dịch tiêu đề zh (服务条款 / 服務條款, 隐私政策 / 隱私權政策, 媒体资料 / 媒體資料) và nhãn `footer.nav` | Chấp nhận; người bản xứ đọc lại ở VNX-0801 |
| F3 | SUGGESTION | `docs/legal/terms.md` VI mục 3 | "để để lại email" đúng nhưng đọc vấp | Để Owner quyết khi đọc lại; không chặn go-live |

### Sai khác do Implementer báo — đã xem, chấp nhận

1. Key `legal.englishOnly` có ở `vi` để qua parity, không hiển thị (có test).
2. Tên key meta `legal.{id}.{title,description}`, `<title>` theo mẫu `X · VNX.SI`.
3. Swatch dùng `style` inline, giá trị bị giới hạn bởi regex `^#[0-9A-Fa-f]{6}$`. Ghi nhận: nếu sau này thêm CSP chặn inline style thì đổi sang class.
4. Tagline footer bọc trong `<p class="tagline">`.
5. `runDaily(env, now)` trả mảng kết quả từng bước; `RATE_LIMIT_KEEP_SECONDS` export.
6. Khối nội dung zh có `lang="en"`, dòng ngày cập nhật mang `lang` của trang.

## Xung đột với `feat/m5-inquiry`

Nhánh M5 đã có `3a698e4` (cron VNX-0505) sửa cùng `auth/sessions.ts`, `auth/tokens.ts`, `http/rate-limit.ts`, `index.ts`, `jobs/daily.ts`, `test/jobs/daily.test.ts`, `wrangler.jsonc`. Bản M5 là tập lớn hơn (nhắc builder, báo admin, gửi lại thông báo, xóa Inquiry chờ, cộng dọn dữ liệu). Hướng gộp khi merge M5 **sau** VNX-0705a:

- `jobs/daily.ts`, `index.ts`: lấy bản M5 (`DailySummary`, `scheduled` kiểm `controller.cron`).
- `auth/tokens.ts`: giữ **một** hàm xóa token; lấy tên của M5 (`deleteExpiredTokens`), bỏ `deleteExpiredLoginTokens`, sửa import/test tương ứng.
- `auth/sessions.ts`: hai bên cùng tên và SQL; giữ một.
- `http/rate-limit.ts`: giữ `RATE_LIMIT_KEEP_SECONDS = 2 ngày` (plan VNX-0705a đã duyệt) trừ khi Owner chọn 1 ngày của M5.
- `wrangler.jsonc`: một khối `triggers`.
- `test/jobs/daily.test.ts`: gộp ca của hai bên.
- Sau gộp: chạy lại `npm test`, typecheck; Reviewer xem lại phần gộp trong review M5.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 | ✓ | `test/legal/pages.test.ts`; thử tay 200 |
| AC2 | ✓ | `test/legal/content.test.ts` đọc `docs/legal/*.md` qua `import.meta.glob(?raw)`, so từng heading/đoạn/mục theo thứ tự |
| AC3 | ✓ | `pages.test.ts`; ảnh 360 px `/zh-hant/terms` có câu 英文版本 + thân EN |
| AC4 | ✓ | `pages.test.ts` + unit `parseInline`; `<code>`, `<strong>`, `mailto:` thấy trên ảnh |
| AC5 | ✓ | `pages.test.ts` |
| AC6 | ✓ | `test/legal/footer.test.ts`; ảnh có footer 3 link |
| AC7 | ✓ | `test/seo/sitemap.test.ts` |
| AC8 | ✓ | `test/jobs/daily.test.ts` (giữ/xóa đúng mốc, chạy lần hai xóa 0) |
| AC9 | ✓ | `daily.test.ts` kiểm export `scheduled`; `wrangler.jsonc:35` có `"0 1 * * *"` |
| AC10 | ✓ | 432/432, typecheck exit 0 |
| AC11 | ✓ | Ảnh Reviewer 360 px sáng, 1280 px tối; Implementer thêm 360 px tối, 1280 px sáng. Chưa đo tương phản (VNX-0802) |

## Nghĩa vụ để lại cho task sau

- **M5 merge:** gộp cron theo mục "Xung đột" ở trên; Privacy phải thêm Inquiry (tên, tin nhắn; builder không thấy email client) và Turnstile (Cloudflare) trước khi M5 lên production.
- **VNX-0801:** dịch thân 3 trang sang `zh-*`; người bản xứ đọc lại tiêu đề zh.
- **CSP (nếu thêm):** đổi swatch inline sang class.
- **Go-live:** theo "Điều kiện go-live" của plan.
