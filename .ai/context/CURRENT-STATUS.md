# CURRENT STATUS — VNX.SI

_Cập nhật lần cuối: 2026-10-03 bởi Reviewer (Claude)._

## Tóm tắt

- **Hướng sản phẩm:** marketplace cho sản phẩm được xây bằng AI và builder (pivot 2026-10-03). Blueprint: `docs/blueprint/README.md`.
- **Đợt hiện tại:** Wave 1 (Supply). Spec: `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`.
- **Milestone:** M0 và M1 **xong** trên nhánh `feat/m0-m1-foundation` (chưa merge, chưa push). Review toàn nhánh: "With fixes" → đã sửa, re-review sạch. Tiếp theo: Owner quyết định merge, rồi viết plan M2.
- **Production:** https://vnx.si vẫn chạy landing cũ + waitlist từ `main` cũ. Nhánh mới **chưa deploy**.
- **Prototype giao diện:** https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm (riêng tư).

## Task

| Task | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| VNX-0001 Commit nền | ✅ | 9f0c7bd | trên `main` |
| VNX-0002 Toolchain | ✅ | 25b9d9f | Vitest 4.1 + pool 0.22; test dùng compatibilityDate 2026-08-01 |
| VNX-0003 Khung Hono | ✅ | f805507 | `run_worker_first: true` |
| VNX-0004 CI | ✅ | ac27cc1 | chưa chạy trên GitHub (chưa có remote) |
| VNX-0005 Blueprint | ✅ | 48e3075 | |
| VNX-0101 ULID, văn bản thuần | ✅ | 314a2ff | |
| VNX-0102 i18n | ✅ | 2c3ad28, 1b303a2 | root `/` đăng ký cả `/vi` và `/vi/` |
| VNX-0103 Layout, trang lỗi | ✅ | 617fe3b | |
| VNX-0104 Danh tính, rate limit | ✅ | bc9e380, 8b2faed | email lowercase ở repo + CHECK |
| VNX-0105 Mailer | ✅ | 5d26b2b, f29ae6d | fail closed khi thiếu cấu hình |
| VNX-0106 Token, session, middleware | ✅ | 882c2e6, da51843 | token gắn purpose; lỗi D1 → ẩn danh |
| VNX-0107 Route đăng nhập | ✅ | a0a9e71, 4457c58, cdfd16f | `next` chặn open redirect |
| Sửa sau review toàn nhánh | ✅ | a1015ac | |

## Điều kiện trước khi deploy nhánh này

Theo thứ tự (cũng ghi trong `apps/web/wrangler.jsonc`):
1. `npm run db:migrate:remote -w apps/web` (áp `0003_identity`).
2. Xác minh domain gửi mail trên Resend; `wrangler secret put RESEND_API_KEY`, `wrangler secret put ADMIN_EMAILS`.
3. `npm run deploy`.

Chưa làm đủ thì **không deploy `main` sau khi merge**, kể cả để sửa nhanh landing: `/login` sẽ lỗi.

## Quyết định phát sinh

- Rate limit bằng bảng D1 `rate_limits` (Workers Rate Limiting binding chỉ có chu kỳ 10/60 giây).
- `consumeLoginToken(db, raw, now, expectedPurpose)`: token của mục đích khác không được dùng và không bị tiêu.
- `getMailer`: `fake` / `console` chỉ khi đặt `MAIL_DRIVER`; có `RESEND_API_KEY` → Resend; còn lại → báo lỗi, không log link.
- `originCheck` chấp nhận origin của URL request hoặc `APP_ORIGIN`.
- `safeNext` trả giá trị gốc sau khi qua mọi kiểm tra; chặn ký tự điều khiển, non-ASCII, `//`, `\`, dot-segment.
- Sau đăng nhập không có `next` → về `/` cho mọi locale (chưa có trang chủ theo locale đến M7).
- Lỗi 500 ở `/api/*` không trả chuỗi `error` tiếng Anh.
- Migration danh tính tên `0003_identity.sql`; các bảng sau dùng `0004+`.

## Nghĩa vụ để lại

- **M2 (VNX-0205):** quyết định có hạ `is_admin` khi email bị gỡ khỏi `ADMIN_EMAILS` không (hiện chỉ nâng, không hạ).
- **M2:** `requireUser` làm mất query string trong `next`; sửa trước lần dùng đầu tiên.
- **M5 (VNX-0505):** cron dọn `sessions`, `login_tokens`, `rate_limits` hết hạn.
- **M5 (VNX-0506, mới):** trang trung gian ở `/auth/verify` với nút POST xác nhận, để trình quét link trong email doanh nghiệp không tiêu token.
- **M7:** độ tương phản `.error-msg` ở dark mode, vùng chạm 44 px cho brand/sign-in, skip link.
- **M8 (VNX-0804):** chuyển `www.vnx.si` → `vnx.si` (cookie `__Host-` gắn với host).
- **Lần push đầu lên GitHub:** kiểm security-ci; nếu repo thuộc organization thì cần secret `GITLEAKS_LICENSE`.
- Trước M8: người bản xứ đọc lại `zh-Hans`, `zh-Hant`.
- Trước Wave 3: nghiên cứu pháp nhân và cổng thanh toán.

## Ghi nhận (minor, chưa làm)

- `npm audit`: 5 lỗ hổng high nằm trong dev dependency của `@cloudflare/vitest-pool-workers`; không ảnh hưởng runtime.
- Verify chưa nguyên tử: hai token khác nhau cho cùng email mới bấm cùng lúc có thể gây 500 ở lần thứ hai.
- Bộ đếm IP `"unknown"` dùng chung trong test (login-flow dùng ~13/20).
- ResendMailer chưa có timeout.
- Trang "link hết hạn" luôn tiếng Anh.
