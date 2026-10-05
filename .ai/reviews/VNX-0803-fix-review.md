# VNX-0803-fix — Review

- **Reviewer:** Claude (Fable 5.1, phiên Reviewer VNX-0803)
- **Ngày:** 2026-10-05
- **Đã đọc:** plan `.ai/plans/VNX-0803-fix-plan.md`, handoff `.ai/tasks/VNX-0803-fix-handoff.md`, báo cáo `.ai/tasks/VNX-0803-fix-report.md`, toàn bộ diff `b60d8ed..9076ed8` (nhánh `fix/vnx-0803-security`, worktree `D:\DOCS\SUPHAM\GIT\vnxsi-fix-0803`, tách từ `main` `b60d8ed`).
- **Lệnh đã chạy lại (Reviewer, tại `f663d9f`):** `npm run typecheck -w apps/web` → sạch; `npm test` → `Test Files 105 passed (105)`, `Tests 815 passed (815)`. Tại `9076ed8` (sau lượt sửa) Implementer chạy lại: typecheck 0, `817 passed (817)`; reviewer cuối chạy 7 file test trọng tâm: 44/44.
- **Quy trình:** mỗi task một Implementer subagent (context mới) + một reviewer subagent độc lập; review toàn nhánh bằng model mạnh nhất; một lượt sửa + re-review có phạm vi. Sổ theo dõi: `.superpowers/sdd/VNX-0803-fix-plan/progress.md` (đã xóa sau khi xong; các quyết định chép lại ở mục "Quyết định của Reviewer" dưới).

## Verdict

**APPROVE** — đóng F2, F4, F6, F8, F9 của `.ai/reviews/VNX-0803-security-review.md`. Sẵn sàng để Owner merge vào `main` (Reviewer không merge, không push).

## Commit trên nhánh

| Commit | Nội dung |
|---|---|
| `f57a068` | F2: `http/security-headers.ts` (CSP allow-list, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS 1 năm không `includeSubDomains`), `/auth/verify` `no-referrer`, swatch media kit bỏ `style=` |
| `5a36f7a` | F4: `http/body-limit.ts` (64 KB form; `hono/body-limit`) |
| `325c5e2` | F6: `RESEND_API_KEY` thật luôn thắng `MAIL_DRIVER`; Turnstile giả theo `isFakeMail` |
| `480a6d8` | F8: `no-store` cho mọi response `text/html` khi đã đăng nhập |
| `f663d9f` | F9: `.gitignore` `.claude/worktrees/`; báo cáo Implementer |
| `9076ed8` | Sửa sau review toàn nhánh: upload có `Content-Length` để route tự xử (trang 400 bản địa hóa như trước, kể cả > 8 MB); upload không khai độ dài vẫn trần 8 MB; test env ghim `RESEND_API_KEY: ""`; comment `wrangler.jsonc`; báo cáo bổ sung |

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| F1 | MEDIUM (đã sửa ở `9076ed8`) | `apps/web/vitest.config.ts:19` | Sau khi khóa thật thắng `MAIL_DRIVER`, một `RESEND_API_KEY` trong `apps/web/.dev.vars` (pool test nạp file này) sẽ biến `npm test` thành gửi mail thật và tắt Turnstile giả. | Đã ghim `RESEND_API_KEY: ""` trong `miniflare.bindings`, thêm test khẳng định, sửa comment `wrangler.jsonc`. |
| F2 | MEDIUM (đã sửa ở `9076ed8`) | `apps/web/src/http/body-limit.ts` | Trần 8 MB trả 413 trần trụi cho ảnh > 8 MB có `Content-Length` (ảnh điện thoại 48–200 MP), thay vì trang 400 bản địa hóa mà route đã trả từ trước mà không đọc body. | Upload có `Content-Length` và không `Transfer-Encoding` → `next()`; upload không khai độ dài giữ trần 8 MB; test 9 MB khai báo → 400 "larger than 2 MB"; stream 8 MB + 1 → 413. |
| F3 | LOW (đã sửa) | `body-limit.ts:8` | Comment nói trường dài nhất 4000 ký tự; mô tả product cho 5000. | Đã sửa comment. |
| F4 | LOW | `.ai/tasks/VNX-0803-fix-report.md` | Danh sách commit ghi "(commit này)" thay vì `9076ed8` (không amend được). | Chấp nhận; SHA ghi ở bảng trên. |
| F5 | SUGGESTION | `http/security-headers.ts:37-40` | Mỗi `c.header()` trên response đã finalize tạo một bản sao (≤ 7 lần/request). Chi phí không đáng kể. | Để sau nếu cần: gom header một lần. |
| F6 | SUGGESTION | `http/no-store.ts` | `no-store` làm trang HTML của người đăng nhập không vào bfcache (Back tải lại trang). Đây là đánh đổi chủ ý của F8. | Ghi vào CURRENT-STATUS; không đổi. |
| F7 | SUGGESTION (plan) | `.ai/plans/VNX-0803-fix-plan.md` Task 5 Step 4 | Plan ghi kỳ vọng ≥ 1019 test: số lấy từ nhánh EPIC 21; nhánh này tách từ `main` (808 test). Thực tế đúng: 808 + 9 test mới = 817. | Đã ghi trong báo cáo Implementer; không sửa plan sau khi duyệt. |

## Đối chiếu tiêu chí chấp nhận (handoff)

| AC | Đạt? | Bằng chứng |
|---|---|---|
| AC1 header bảo mật trên mọi response; `/auth/verify`, `/join/:code` giữ `no-referrer` | ✓ | `test/http/security-headers.test.ts` 6/6; middleware sau `requestId`, `c.header()` sau `next()` nên phủ cả `ASSETS.fetch`, `/media/*`, 403/413/404/500 |
| AC2 không `style=`/`on*=`/script inline; swatch 3 màu | ✓ | test "CSP needs nothing inline" quét 12 trang; `test/legal/pages.test.ts` 11/11; reviewer cuối grep toàn `views/`: không inline, font/ảnh/favicon đều same-origin, không `data:` |
| AC3 413 trên 64 KB (có/không Content-Length); upload 3 MB và 9 MB khai báo vẫn 400 thân thiện; stream > 8 MB → 413 | ✓ | `test/http/body-limit.test.ts` 5/5, `test/hub/media.test.ts` 9/9 |
| AC4 driver giả/console bị bỏ qua khi có khóa thật, cả mail lẫn Turnstile; test env không có khóa | ✓ | `test/email/get-mailer.test.ts` 7/7, `test/http/turnstile.test.ts` 6/6; `test/architecture.test.ts` chấp nhận `http/` → `email/index.ts` |
| AC5 `no-store` mọi trang HTML khi đăng nhập; asset, `robots.txt` giữ cache | ✓ | `test/http/no-store.test.ts` 2/2 |
| AC6 `.claude/worktrees/` bị ignore | ✓ | `git check-ignore` exit 0 |
| AC7 toàn bộ xanh | ✓ | typecheck 0; 105 file, 817 test, 0 fail (Implementer tại `9076ed8`); Reviewer tự chạy tại `f663d9f`: 815/815 |

## Đối chiếu Review Focus của plan

1. Turnstile dưới CSP: `script-src`/`frame-src` có `https://challenges.cloudflare.com` (đúng tài liệu Cloudflare); OQ-1 (kiểm thật sau deploy) vẫn mở.
2. Response ngoài Hono: test `/raw` (`new Response`), `/assets/app.css`, `/media/nope` đều mang header; không lỗi immutable.
3. Upload 3 MB giữ trang 400 thân thiện: ✓, và sau lượt sửa cả 9 MB khai báo cũng vậy.
4. Asset của người đăng nhập không `no-store`: ✓.
5. `MAIL_DRIVER=fake` + khóa thật: mail qua Resend, Turnstile giả tắt: ✓.

## Quyết định của Reviewer trong quá trình (chép từ sổ theo dõi)

1. Task 5: "815 test < plan ≥ 1019" là lỗi số liệu của plan (lấy từ nhánh EPIC 21), không phải thiếu test; chấp nhận. Chi phí nếu sai: không ảnh hưởng code.
2. Task 5: `.gitignore` có thêm một dòng trống trước hai dòng bắt buộc: chấp nhận (cosmetic, AC6 đạt).
3. Review cuối #1 (.dev.vars → mail thật khi test) và #2 (413 cho upload > 8 MB khai báo): sửa trong một lượt (`9076ed8`), re-review sạch.
4. Review cuối #3, #4: gộp vào cùng lượt sửa. #5 (clone response), #6 (bfcache): để nguyên, ghi nhận.
5. Nhánh tách từ `main` thay vì từ `feat/epic21-partner-slice` để có thể deploy độc lập với EPIC 21; các file đụng tới chỉ khác 2 dòng import trong `app.ts` nên merge sau sẽ nhẹ.

## Nghĩa vụ để lại cho task sau

- **Owner:** quyết định merge `fix/vnx-0803-security` vào `main` và deploy; sau deploy làm OQ-1 của plan: mở `/`, `/login`, `/contact`, `/request` (chưa đăng nhập) và `/hub`, `/me` (đã đăng nhập) với DevTools, xác nhận không có CSP violation và widget Turnstile hiện; nếu widget không hiện, bước lùi là thêm `'unsafe-inline'` vào `style-src` ở `security-headers.ts`. Trước deploy kiểm zone Cloudflare không bật Rocket Loader / Web Analytics tự chèn / Bot Fight Mode JS (chúng chèn script ngoài CSP).
- **Owner:** F1 (xoay secret), F3 (Cloudflare Access cho `/admin`), F5 (`workers_dev`), F7 (EXIF) của review VNX-0803 vẫn mở.
- **EPIC 21 / Ops console (vnxsi-93, vnxsi-86 đã được báo):** mọi trang mới không được có `style=`/script inline; POST ngoài upload ảnh bị trần 64 KB; `/go/*` giữ GET (vì `form-action 'self'` áp cả redirect sau POST trên Chrome).
- Khi EPIC 21 gộp `main` sau nhánh này: `app.ts` sẽ xung đột nhẹ (2 dòng `app.use` mới cạnh 2 dòng `registerAdmin*` của EPIC 21): giữ cả hai.
