# VNX-2605b — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** plan Task 9 (sau review plan: MEDIUM-1/2, LOW-1..3, S1, S2, mã log `notify_failed`, mục chỉ-thông-báo thu hẹp; câu chữ và các quyết định Owner duyệt 2026-10-10), báo cáo `.ai/tasks/VNX-2605b-report.md`, diff `6c7d13e..a632c6a`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 1688/1689 xanh, 1 timeout 5 s ở `test/http/security-headers.test.ts` (test CSP trang Ops, ngoài diff này), chạy riêng file đó 7/7 xanh (do tải máy); trailer đúng dòng Opus.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1–M3, chỉ test)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/oauth-link.test.ts:304-312` | Test `already_linked` không assert kết quả lần callback thứ hai, nên không chứng minh email bị chặn đúng vì `already_linked` | `expectBack(res2, "/me?link=ok")` và số audit liên kết vẫn là 1. **Làm ở R1** |
| M2 | LOW | `test/me/identity-unlink.test.ts:173`; `test/auth/oauth-link.test.ts:338` | Assert dòng log chưa ghim đúng tập khóa | So `Object.keys` đã sắp xếp với 5 khóa. **Làm ở R1** |
| M3 | LOW | (không có test) | Chưa test URL `/me` theo locale cho chủ tài khoản không phải `en` | Test chủ `vi` nhận đúng `${APP_ORIGIN}/vi/me`. **Làm ở R1** |
| M4 | SUGGESTION | `src/routes/oauth.tsx:11`; `src/views/me/LinkedAccounts.tsx:36-58` | Thứ tự import, đoạn fragment không thụt lề lại | Không sửa |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Hủy liên kết: `requireUser` + Origin check, không gọi `enabledProvider`, provider lạ 404, chưa liên kết → `notLinked` không audit không email, không chạm hàng user khác, audit `{provider}` cùng batch, 303 cùng site | ✓ | `src/routes/me.tsx:97-105`; `src/db/identities.ts:93-105`; `test/me/identity-unlink.test.ts` |
| Email liên kết chỉ khi chèn mới thật sự (không gửi khi `already_linked` hay xung đột) | ✓ | `src/routes/oauth.tsx:96`; `src/db/identities.ts:59-87` |
| Email chỉ tới `users.email` của session, theo `users.locale`; URL duy nhất là `/me` từ `APP_ORIGIN`; không token, code, state; `label` được escape; bỏ dòng tài khoản khi `label` trùng tên provider | ✓ | `src/notify/identity.ts:25-34`; `src/email/templates/identity.ts:80`; `src/auth/sessions.ts:27-34`; `test/email/identity-templates.test.ts` |
| Gửi mail lỗi không hoàn tác thay đổi; log đúng `{requestId, event, kind, provider, code: "notify_failed"}` | ✓ | `src/notify/identity.ts:25-34`; `src/email/resend.ts` |
| `LINK_NOTICES` một nguồn; `unlinked`/`notLinked` là `role="status"`; mục chỉ-thông-báo chỉ cho hai giá trị đó | ✓ | `src/views/me/LinkedAccounts.tsx:7, 18, 27, 54` |
| Câu chữ 11 khóa khớp bản Owner duyệt (44/44), không có chú thích "BẢN NHÁP" | ✓ | so từng byte bằng script |
| `routes/oauth.tsx` không với tới `db/ops-members.ts`; `IDENTITY_ALLOWED` không đổi | ✓ | `test/architecture.test.ts:186, 211-243` |

## Nghĩa vụ để lại

- **VNX-2605c (bắt buộc trước VNX-2608, Owner 2026-10-10):** hủy liên kết chưa kết thúc các session `oauth_<provider>` đã tạo bằng provider đó.

## Re-review R1 (controller, 2026-10-10)

Commit `cf875ab` (chỉ test): test `already_linked` assert `expectBack(res2, "/me?link=ok")` và số audit liên kết vẫn là 1; hai test mailer lỗi ghim đúng tập khóa log; test mới cho chủ `vi` kiểm URL duy nhất trong email là `${APP_ORIGIN}/vi/me`. Typecheck sạch. Lần chạy đầu `npm test -- --maxWorkers=2` không khởi động được worker cho `test/http/rate-limit.test.ts` (`connect ENOBUFS`, do máy); chạy riêng file đó 3/3 xanh; chạy lại toàn bộ 151 file / 1690 test xanh. **Verdict cuối: APPROVE.**
