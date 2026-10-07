# VNX-0803-fix — Handoff cho Implementer

- **Plan đã duyệt:** `.ai/plans/VNX-0803-fix-plan.md` (APPROVED theo ủy quyền Owner 2026-10-05)
- **Review nguồn:** `.ai/reviews/VNX-0803-security-review.md` (F2, F4, F6, F8, F9)
- **Báo cáo phải nộp:** `.ai/tasks/VNX-0803-fix-report.md`
- **Nhánh / thư mục làm việc:** `fix/vnx-0803-security` tách từ `main` `b60d8ed`, trong worktree riêng (đường dẫn do người điều phối đưa). Không đụng thư mục repo chính (nhánh EPIC 21 đang được một phiên khác sửa).

## Mục tiêu

Đóng 5 phát hiện bảo mật F2, F4, F6, F8, F9 đúng theo 5 task trong plan, mỗi task một commit, test trước code.

## Phạm vi đã duyệt

- Task 1 (F2): middleware `securityHeaders` + CSP allow-list; `/auth/verify` `no-referrer`; swatch media kit bỏ `style=`.
- Task 2 (F4): middleware `requestBodyLimit` dùng `hono/body-limit`: 64 KB cho form, 8 MB cho `/hub/products/:id/media`.
- Task 3 (F6): `fake`/`console` chỉ khi không có `RESEND_API_KEY`; Turnstile giả theo cùng luật (`isFakeMail`).
- Task 4 (F8): `noStorePrivate` thêm `no-store` cho mọi response HTML khi `c.get("user") !== null`.
- Task 5 (F9): `.gitignore` thêm `.claude/worktrees/`; chạy toàn bộ; báo cáo.

## Ngoài phạm vi (không làm)

- F1 (xoay secret), F3 (Cloudflare Access / session admin), F5 (`workers_dev`), F7 (EXIF), F10–F13.
- Không đổi CSP sang nonce, không thêm `'unsafe-inline'`, không bật `includeSubDomains`/`preload` cho HSTS.
- Không sửa test hiện có ngoài hai chỗ plan nêu (`test/legal/pages.test.ts:166` markup swatch; thêm case mới vào `get-mailer`, `turnstile`, `no-store`).
- Không `git push`, không merge, không deploy.

## Đọc trước

- `.ai/plans/VNX-0803-fix-plan.md` (toàn bộ: code từng bước đã viết sẵn).
- `apps/web/src/app.ts` (thứ tự middleware), `apps/web/src/http/no-store.ts`, `apps/web/src/http/origin.ts` (khuôn middleware và test), `apps/web/test/helpers.ts`, `apps/web/test/fixtures.ts` (`signIn`).
- `node_modules/hono/dist/middleware/body-limit/index.js` (hành vi: Content-Length trước, thiếu thì đọc stream).
- `apps/web/test/architecture.test.ts` (luật import giữa các lớp; Task 3 có phương án dự phòng nếu `http/` không được import `email/`).

## File dự kiến bị ảnh hưởng

- Tạo: `apps/web/src/http/security-headers.ts`, `apps/web/src/http/body-limit.ts`, `apps/web/test/http/security-headers.test.ts`, `apps/web/test/http/body-limit.test.ts`, `.ai/tasks/VNX-0803-fix-report.md` (có thể: `apps/web/src/email/driver.ts`).
- Sửa: `apps/web/src/app.ts`, `apps/web/src/routes/auth.tsx`, `apps/web/src/views/LegalPage.tsx`, `apps/web/public/assets/app.css`, `apps/web/src/email/index.ts`, `apps/web/src/http/turnstile.ts`, `apps/web/src/http/no-store.ts`, `apps/web/test/legal/pages.test.ts`, `apps/web/test/email/get-mailer.test.ts`, `apps/web/test/http/turnstile.test.ts`, `apps/web/test/http/no-store.test.ts`, `.gitignore`.

## Ảnh hưởng DB / API / UI

- DB: không. API: thêm mã 413 cho body quá lớn. UI: không đổi gì thấy được; swatch media kit đổi cách tô màu (CSS thay vì inline).

## Quy tắc nghiệp vụ

- Header do route tự đặt thắng middleware (`/join`, `/auth/verify` giữ `no-referrer`).
- Upload 2–8 MB vẫn nhận trang 400 "larger than 2 MB" của route; chỉ > 8 MB mới 413.
- Khi có `RESEND_API_KEY` thì mail luôn qua Resend, bất kể `MAIL_DRIVER`.
- `no-store` cho người đăng nhập chỉ áp lên `text/html`; asset, `robots.txt`, `sitemap.xml`, `/media/*` giữ cache.

## Tiêu chí chấp nhận

Mỗi tiêu chí kiểm được bằng một lệnh (chạy trong `apps/web` trừ khi ghi khác).

- [ ] AC1: header bảo mật trên mọi response; `/auth/verify`, `/join/:code` giữ `no-referrer` — `npx vitest run test/http/security-headers.test.ts`
- [ ] AC2: không `style=`/`on*=`/script inline; swatch 3 màu — `npx vitest run test/http/security-headers.test.ts test/legal/pages.test.ts`
- [ ] AC3: 413 trên 64 KB (có/không Content-Length); upload 3 MB vẫn 400 thân thiện; > 8 MB → 413 — `npx vitest run test/http/body-limit.test.ts test/hub/media.test.ts`
- [ ] AC4: driver giả/console bị bỏ qua khi có khóa thật, cả mail lẫn Turnstile — `npx vitest run test/email/get-mailer.test.ts test/http/turnstile.test.ts`
- [ ] AC5: `no-store` mọi trang HTML khi đăng nhập, asset giữ cache — `npx vitest run test/http/no-store.test.ts`
- [ ] AC6: `.claude/worktrees/` bị ignore — (gốc repo) `git check-ignore -q .claude/worktrees/x/README.md; echo $?` → `0`
- [ ] AC7: toàn bộ xanh — (gốc repo) `npm run typecheck -w apps/web && npm test`

## Test bắt buộc

- Đúng các test trong plan (Task 1–4, Step 1). Viết test trước, chạy thấy đỏ, rồi mới sửa code.

## Lệnh kiểm tra

```bash
npm run typecheck -w apps/web
npm test
```

## Cấm

- Không sửa ngoài danh sách file trừ khi bắt buộc; nếu phải sửa, ghi lý do trong báo cáo.
- Không thêm dependency.
- Không đổi hành vi nghiệp vụ, không "tiện tay" sửa chỗ khác; thấy gì thì ghi vào mục "Ghi nhận" của báo cáo.
- Không `git push`, không merge, không `--no-verify`, không amend commit đã có.
