# Development Conventions

## Cấu trúc và đặt tên

- Code trong `apps/web/src/` theo bản đồ module ở `docs/architecture/ARCHITECTURE.md` mục 2.
- File: `kebab-case.ts`; component JSX: `PascalCase.tsx`; test: `test/<module>/<chủ đề>.test.ts(x)`.
- Hàm DB: động từ + danh từ (`findUserByEmail`, `createSession`, `markLogin`).
- State machine: `src/domain/<entity>.ts` export `transition(state, action, actor)` trả trạng thái mới hoặc lỗi có kiểu.

## SQL và D1

- Migration `NNNN_<tên>.sql`, chỉ thêm; không sửa migration đã chạy production.
- Tham số đánh số (`?1`, `?2`); không nối chuỗi vào SQL.
- Chuyển trạng thái dùng `UPDATE … WHERE <trạng thái cũ> RETURNING …` để chống ghi đè đồng thời.
- Tiền: số nguyên cent USD. Thời gian: ISO-8601 UTC. ID: ULID.
- Mỗi chuyển trạng thái ghi `audit_log` trong cùng request.

## HTTP và view

- Form POST → redirect 303 khi thành công; lỗi thì render lại form với giá trị đã nhập, status 400/409/429.
- Kiểm input bằng zod ở đầu route.
- View chỉ nhận props đã chuẩn bị; không gọi DB.
- Mọi chuỗi giao diện qua `t()`; thêm key vào đủ 4 file locale.
- Không `dangerouslySetInnerHTML` với dữ liệu người dùng; văn bản người dùng render qua `PlainText`.

## Test

- TDD: test fail trước, rồi code.
- Test tích hợp gọi `createApp().request(...)` với `testEnv`; email kiểm qua `outbox` của `FakeMailer`.
- Mỗi state machine: test mọi chuyển hợp lệ và một số chuyển không hợp lệ.
- Không `skip`, không hạ ngưỡng để cho qua.

## Commit và nhánh

- Conventional Commits: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`; scope là app hoặc module (`feat(web): …`).
- Mỗi milestone một nhánh `feat/<milestone>`; merge vào `main` sau review toàn nhánh và Owner duyệt.
- Không push, merge, deploy khi Owner chưa nói rõ.

## Bí mật

| Bí mật | Nơi lưu | Ai đặt |
|---|---|---|
| `RESEND_API_KEY` | `wrangler secret put` | Owner |
| `TURNSTILE_SECRET` | `wrangler secret put` | Owner |
| `ADMIN_EMAILS` | `wrangler secret put` (dữ liệu cá nhân) | Owner |
| `ANTHROPIC_API_KEY` (Wave 2) | `wrangler secret put` | Owner |
| Giá trị local | `apps/web/.dev.vars` (gitignore) | dev |

Không dán bí mật vào tài liệu, issue, log hay prompt. Lộ bí mật → thu hồi ngay, ghi vào `CURRENT-STATUS.md` mục Blocker.
