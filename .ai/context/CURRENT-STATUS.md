# CURRENT STATUS — VNX.SI

_Cập nhật lần cuối: 2026-10-04 bởi Reviewer (Claude)._

## Tóm tắt

- **Hướng sản phẩm:** marketplace cho sản phẩm được xây bằng AI và builder (pivot 2026-10-03). Blueprint: `docs/blueprint/README.md`.
- **Đợt hiện tại:** Wave 1 (Supply). Spec: `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`.
- **Milestone:** M0 và M1 **xong**, đã merge vào `main` qua PR #1 (merge commit `368cc1a`, 2026-10-03). M2 (Builder) **xong và đã merge** vào `main` (merge commit `3bde074`, đã push). M3 (Product): plan `docs/superpowers/plans/2026-10-04-vnxsi-m3-product.md` **đã duyệt 2026-10-04, đang thực thi**, nhánh `feat/m3-product`.
- **Production:** https://vnx.si vẫn chạy landing cũ + waitlist (bản deploy trước pivot). `main` đã có code M0–M1 nhưng **chưa deploy**; không có workflow nào tự deploy khi push.
- **Prototype giao diện:** https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm (riêng tư).

## Task

| Task | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| VNX-0001 Commit nền | ✅ | 9f0c7bd | trên `main` |
| VNX-0002 Toolchain | ✅ | 25b9d9f | Vitest 4.1 + pool 0.22; test dùng compatibilityDate 2026-08-01 |
| VNX-0003 Khung Hono | ✅ | f805507 | `run_worker_first: true` |
| VNX-0004 CI | ✅ | ac27cc1 | PR #1: `test` và `gitleaks` xanh; `dependency-review` lỗi do repo chưa bật Dependency graph |
| VNX-0005 Blueprint | ✅ | 48e3075 | |
| VNX-0101 ULID, văn bản thuần | ✅ | 314a2ff | |
| VNX-0102 i18n | ✅ | 2c3ad28, 1b303a2 | root `/` đăng ký cả `/vi` và `/vi/` |
| VNX-0103 Layout, trang lỗi | ✅ | 617fe3b | |
| VNX-0104 Danh tính, rate limit | ✅ | bc9e380, 8b2faed | email lowercase ở repo + CHECK |
| VNX-0105 Mailer | ✅ | 5d26b2b, f29ae6d | fail closed khi thiếu cấu hình |
| VNX-0106 Token, session, middleware | ✅ | 882c2e6, da51843 | token gắn purpose; lỗi D1 → ẩn danh |
| VNX-0107 Route đăng nhập | ✅ | a0a9e71, 4457c58, cdfd16f | `next` chặn open redirect |
| Sửa sau review toàn nhánh | ✅ | a1015ac | |
| Merge M0–M1 vào `main` | ✅ | 368cc1a | PR #1, merge commit (giữ SHA các task) |
| VNX-0201 Dữ liệu và domain builder | ✅ | 364b1d8 | migration `0004_builders`; test sở hữu bảng |
| VNX-0202a Invite qua magic link | ✅ | eb4df42 | cookie `__Host-vnx_invite` chứa hash; `requireUser` giữ query |
| VNX-0202b `/hub/apply` | ✅ | 8a1c561 | invite hợp lệ → approved, trừ lượt trong cùng D1 batch |
| VNX-0203a Hub, hồ sơ, gửi duyệt lại | ✅ | cc52e8b | handle khóa sau khi duyệt |
| VNX-0203b Portfolio | ✅ | 8465b4f | ≤ 12 mục, giới hạn kiểm trong cùng câu INSERT |
| VNX-0204 `/b/:handle` | ✅ | 1d6b4b8 | chỉ builder approved + tài khoản active; còn lại 404 |
| VNX-0205a Admin duyệt builder | ✅ | d595e2c | email theo locale; gửi lỗi không hoàn tác |
| VNX-0205b Admin invite | ✅ | 2dc5b78 | link hiện một lần; test cổng ra M2 |
| VNX-0205c Khóa builder/user; đồng bộ admin | ✅ | 98df068 | `ADMIN_EMAILS` cấp và thu quyền |
| Sửa sau review toàn nhánh M2 | ✅ | 6cc9974 | link Hub ở header, CRLF, khóa user nguyên tử, a11y portfolio |

## Điều kiện trước khi deploy `main`

Theo thứ tự (cũng ghi trong `apps/web/wrangler.jsonc`):
1. `npm run db:migrate:remote -w apps/web` (áp `0003_identity`, và `0004_builders` khi M2 đã merge).
2. Xác minh domain gửi mail trên Resend; `wrangler secret put RESEND_API_KEY`, `wrangler secret put ADMIN_EMAILS`.
3. `npm run deploy`.

Chưa làm đủ thì **không deploy `main` sau khi merge**, kể cả để sửa nhanh landing: `/login` sẽ lỗi.

## Quyết định phát sinh

- **Owner 2026-10-04 (M3):** product `in_review` bị khóa, có nút Rút lại (`withdraw` → draft); `primary_lang` gồm `en`, `vi`, `zh-Hans`, `zh-Hant`; Claude tạo bucket R2 sau khi Owner bật R2 (lần thử 2026-10-04 lỗi 10042: tài khoản chưa bật R2).

- Rate limit bằng bảng D1 `rate_limits` (Workers Rate Limiting binding chỉ có chu kỳ 10/60 giây).
- `consumeLoginToken(db, raw, now, expectedPurpose)`: token của mục đích khác không được dùng và không bị tiêu.
- `getMailer`: `fake` / `console` chỉ khi đặt `MAIL_DRIVER`; có `RESEND_API_KEY` → Resend; còn lại → báo lỗi, không log link.
- `originCheck` chấp nhận origin của URL request hoặc `APP_ORIGIN`.
- `safeNext` trả giá trị gốc sau khi qua mọi kiểm tra; chặn ký tự điều khiển, non-ASCII, `//`, `\`, dot-segment.
- Sau đăng nhập không có `next` → về `/` cho mọi locale (chưa có trang chủ theo locale đến M7).
- Lỗi 500 ở `/api/*` không trả chuỗi `error` tiếng Anh.
- Migration danh tính tên `0003_identity.sql`; các bảng sau dùng `0004+`.
- **Owner 2026-10-03 (M2):** `ADMIN_EMAILS` là nguồn sự thật cho quyền admin (cấp và thu ở mỗi lần đăng nhập; `requireAdmin` kiểm danh sách ở mỗi request). Handle builder khóa sau khi approved. Builder approved sửa hồ sơ thì lên ngay, không duyệt lại.
- Cookie invite đặt tên `__Host-vnx_invite` (spec ghi `vnx_invite`); chứa SHA-256 của code, không chứa code.
- Roadmap M2 tách 0202, 0203, 0205 thành a/b(/c) cho vừa ≤ 1 ngày.
- Khóa user: đổi trạng thái, xóa session và ghi audit chạy trong một `db.batch` (statement builder nằm ở module sở hữu bảng).
- Văn bản từ textarea được chuẩn hóa CRLF → LF trước khi kiểm độ dài.
- Header hiện link Builder Hub khi đã đăng nhập (người chưa là builder được đưa sang `/hub/apply`).

## Nghĩa vụ để lại

- **Owner (VNX-0307):** bật R2 trên Cloudflare Dashboard (tài khoản `15385598…`); báo Claude để chạy `wrangler r2 bucket create vnxsi-media`. Cần trước lần deploy có M3.

- **Deploy sau khi merge M2:** `db:migrate:remote` phải áp cả `0004_builders` (đã ghi trong `wrangler.jsonc`).
- **M4 (VNX-0404):** canonical/hreflang của `/b/:handle` lấy origin từ request; chuyển sang `APP_ORIGIN` cùng SEO toàn site.
- **Trước M5:** thêm `Cache-Control: no-store` cho `/hub*`, `/admin*`, `/me*` (trang có dữ liệu cá nhân).
- **Quyết định sau (ADR nhỏ):** hash invite đang vừa là khóa DB vừa là giá trị cookie, nên người đọc được D1/audit có thể tự duyệt builder; thiết kế lại (cookie ≠ khóa DB, hoặc HMAC) nếu cần.
- **M5 (VNX-0505):** cron dọn `sessions`, `login_tokens`, `rate_limits` hết hạn.
- **M5 (VNX-0506, mới):** trang trung gian ở `/auth/verify` với nút POST xác nhận, để trình quét link trong email doanh nghiệp không tiêu token.
- **M7:** độ tương phản `.error-msg` ở dark mode, vùng chạm 44 px cho brand/sign-in, skip link.
- **M8 (VNX-0804):** chuyển `www.vnx.si` → `vnx.si` (cookie `__Host-` gắn với host).
- **Owner:** bật Dependency graph tại https://github.com/thanhsu/vnxsi/settings/security_analysis để job `dependency-review` chạy được (token hiện tại không có quyền Administration). `gitleaks` đã xanh, không cần license.
- **Owner:** thu hồi / thay PAT GitHub đã dán vào hội thoại 2026-10-03, rồi cập nhật Git Credential Manager.
- Trước M8: người bản xứ đọc lại `zh-Hans`, `zh-Hant`.
- Trước Wave 3: nghiên cứu pháp nhân và cổng thanh toán.

## Ghi nhận (minor, chưa làm)

- M2: mã invite thô nằm trong path `/join/<code>`, nên log request của nền tảng (observability) có thể chứa mã chưa dùng. Chấp nhận ở Wave 1.
- M2: bảng chuyển trạng thái builder và ghi audit là 2 lệnh D1 riêng (trừ khóa user); cùng mẫu với M1.
- M2: admin duyệt không gắn với phiên bản hồ sơ đã xem (builder pending có thể đổi handle ngay trước khi duyệt).
- M2: thiếu một số test nhánh phụ (zh country names, rate null, suspended edit/move portfolio, label từng dòng invite); danh sách đầy đủ ở `.ai/reviews/M2-review.md`.

- `npm audit`: 5 lỗ hổng high nằm trong dev dependency của `@cloudflare/vitest-pool-workers`; không ảnh hưởng runtime.
- Verify chưa nguyên tử: hai token khác nhau cho cùng email mới bấm cùng lúc có thể gây 500 ở lần thứ hai.
- Bộ đếm IP `"unknown"` dùng chung trong test (login-flow dùng ~13/20).
- ResendMailer chưa có timeout.
- Trang "link hết hạn" luôn tiếng Anh.
