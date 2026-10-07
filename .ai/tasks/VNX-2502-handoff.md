# VNX-2502 — Handoff cho Implementer

- **Plan đã duyệt:** `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md`, task VNX-2502 và mục "Hợp đồng 404 kín".
- **Spec / ADR:** spec Ops §3.2, §5; ADR-010 §2, §4.
- **Báo cáo phải nộp:** `.ai/tasks/VNX-2502-report.md`
- **Nhánh:** `feat/ops-o1` (đã có VNX-2501 và `main` `da460fb`: EPIC 21 + VNX-0803). Không push, không merge.

## Mục tiêu

Lớp bảo vệ dùng chung cho mọi route `/ops/*`: xác định vai trò ở mỗi request, kiểm capability, trả **404 kín giống hệt nhau** khi từ chối, gắn `no-store` + `noindex`, chặn trong `robots.txt`, và miễn parity i18n cho khóa `ops.*`. **Chưa có trang Ops thật** (VNX-2503 trở đi).

## Phạm vi đã duyệt

1. **Đọc vai trò:** hàm trong `src/db/ops-members.ts` đọc trong **một** truy vấn `users.status`, `users.email` và `ops_members.role` theo `user_id` (đọc join `users` được phép; không ghi). Dùng `resolveRole` của VNX-2501 với `adminEmails(env)`.
2. **`src/auth/ops.ts`** (mới):
   - `opsNotFound(c)`: **một** hàm duy nhất tạo response 404 cho mọi trường hợp từ chối ở `/ops/*`: dùng trang 404 tiếng Anh có sẵn (`errorResponse(c, "notFound", 404)` với locale `en`).
   - `requireOps(capability)`: middleware; chưa đăng nhập, user không `active`, không vai trò, thiếu capability → `opsNotFound(c)`. Không redirect `/login`, không 403. Đặt vai trò vào biến context (thêm `opsRole` vào `AppEnv["Variables"]` trong `src/env.ts`).
   - `opsHeaders`: middleware cho `/ops` và `/ops/*`: sau `next()`, đặt `Cache-Control: no-store` và `X-Robots-Tag: noindex, nofollow` cho **mọi** response (200, 3xx, 404, 409, 500).
3. **`src/app.ts`:** đăng ký `opsHeaders` cho `/ops` và `/ops/*`; thêm route bắt mọi đường dẫn còn lại `/ops` và `/ops/*` (đăng ký sau cùng trong nhóm ops) trả `opsNotFound(c)`, để đường dẫn không tồn tại và đường dẫn bị từ chối giống hệt nhau. Không đổi thứ tự middleware hiện có (`requestId` → `securityHeaders` → `localeMiddleware` → `originCheck` → `requestBodyLimit` → `sessionMiddleware` → `noStorePrivate`).
4. **`src/http/no-store.ts`:** thêm `ops` vào nhóm private (cho đủ, dù `opsHeaders` đã đặt).
5. **`robots.txt`** (`src/views/seo.ts`): thêm `Disallow: /ops` (không tiền tố locale).
6. **`test/i18n/parity.test.ts`:** các file locale không phải EN không bắt buộc có khóa bắt đầu bằng `ops.`, và **không được** có khóa `ops.*` (để tránh lệch); mọi khóa khác giữ nguyên quy tắc parity.
7. **Test** dùng một app Hono nhỏ trong file test, gắn `requireOps(...)` vào route giả, để kiểm guard (không thêm route giả vào `src/`).

## Ngoài phạm vi (không làm)

`OpsLayout`, Overview, trang Marketplace/People/Team/Audit, chuyển hướng `/admin`, i18n `ops.*` thật, sửa luồng đăng nhập.

## Ràng buộc từ VNX-0803 (bắt buộc)

- CSP toàn site: không style/script nội tuyến (test quét trang sẽ bắt).
- POST không phải upload bị giới hạn 64 KB.
- Không dùng `Referrer-Policy: no-referrer` trên trang có form POST (trình duyệt gửi `Origin: null`, `originCheck` trả 403).

## Đọc trước

`CLAUDE.md`; plan O1; spec §3.2, §5; ADR-010; `src/app.ts`, `src/auth/middleware.ts` (`requireAdmin` để thấy hành vi cũ), `src/auth/admin.ts`, `src/auth/sessions.ts`, `src/http/no-store.ts`, `src/http/security-headers.ts`, `src/views/error-response.tsx`, `src/views/seo.ts`, `src/env.ts`, `src/domain/ops.ts`, `src/db/ops-members.ts`, `test/i18n/parity.test.ts`, `test/seo/*.test.ts`.

## File dự kiến bị ảnh hưởng

Mới: `apps/web/src/auth/ops.ts`, `apps/web/test/ops/guard.test.ts`. Sửa: `apps/web/src/app.ts`, `apps/web/src/env.ts`, `apps/web/src/db/ops-members.ts`, `apps/web/src/http/no-store.ts`, `apps/web/src/views/seo.ts`, `apps/web/test/i18n/parity.test.ts`, test robots hiện có (`test/seo/*`), `apps/web/test/db/ops-members.test.ts` (hàm đọc mới).

## Tiêu chí chấp nhận

- [ ] AC1: 5 trường hợp (chưa đăng nhập; user `suspended` kể cả email trong `ADMIN_EMAILS`; đăng nhập không vai trò; vai trò thiếu capability; `/ops/khong-ton-tai`) trả **cùng status 404, cùng body** (bỏ qua request id) — `npm test -- test/ops/guard.test.ts`
- [ ] AC2: vai trò đủ capability đi qua; Owner gốc từ `ADMIN_EMAILS`; member theo bảng; quyền đọc lại ở **mỗi** request (xóa member giữa hai request → request sau 404) — `test/ops/guard.test.ts`
- [ ] AC3: mọi response `/ops` và `/ops/*` (200, 404) có `Cache-Control: no-store` và `X-Robots-Tag: noindex, nofollow` — `test/ops/guard.test.ts`
- [ ] AC4: không redirect tới `/login`, không 403 ở `/ops` — `test/ops/guard.test.ts`
- [ ] AC5: `robots.txt` có `Disallow: /ops` — test robots
- [ ] AC6: parity: khóa `ops.*` chỉ ở `en.ts`; file khác có `ops.*` → test đỏ; khóa khác thiếu → test đỏ như cũ — `npm test -- test/i18n/parity.test.ts`
- [ ] AC7: typecheck + toàn bộ test xanh (nếu có timeout ngẫu nhiên do máy tải, chạy riêng file lỗi và ghi kết quả) — `npm run typecheck -w apps/web`, `npm test`

## Cấm

Không sửa ngoài danh sách (ghi lý do nếu bắt buộc); không dependency mới; không route Ops thật; TDD (commit test trước); Conventional Commits, mỗi commit kèm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không push/merge/deploy.
