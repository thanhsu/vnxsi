# VNX-2603a — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-07
- **Đã đọc:** plan Task 2 (kèm "Kết quả review Task 2": LOW-1 trong phạm vi), báo cáo `.ai/tasks/VNX-2603a-report.md`, diff `5a56e6c..d481a3b`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 140 file / 1502 test xanh; trailer commit đúng dòng Opus.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1 và M3, Reviewer duyệt)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `src/domain/oauth.ts:174, :212` | Luật `next` chỉ ở `parseOAuthCookie`; `newFlowCookie` có thể ghi `next` mà parser từ chối, làm hỏng cả lượt đăng nhập (fail closed, không khai thác được) | Một helper chung cho cả hai chỗ; `newFlowCookie` đổi `next` không hợp lệ thành `null`. **Làm ở R1** |
| M2 | SUGGESTION | `src/domain/oauth.ts:128, :224, :233, :239` | Không test hành vi nào bắt được việc đổi `timingSafeEqualText` thành `===` | Không làm (giá trị thấp) |
| M3 | LOW | `test/domain/oauth.test.ts` | Biên `exp` đúng 60 s chưa có test | Test `exp = now − 60` → `expired`. **Làm ở R1** |
| M4 | SUGGESTION | commit `d481a3b` | Báo cáo commit chung với code | Không làm (theo quy trình CLAUDE.md) |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Domain thuần (không hono, D1, SQL) | ✓ | `src/domain/oauth.ts:1-2` |
| `verifyIdToken` đúng quyết định 3 (c)/(d), không trả `name` | ✓ | `src/domain/oauth.ts:107-132`; `test/domain/oauth.test.ts:115, 133, 148, 153` |
| So sánh hằng thời gian cho state, nonce, sessionHash | ✓ | `src/domain/oauth.ts:57-61, 128, 224, 233, 239` |
| Cookie `__Host-vnx_oauth`: HttpOnly, Secure, Lax, Path=/, 600/120 s, xóa được | ✓ | `src/auth/oauth-cookie.ts:12-25`; `test/auth/oauth-cookie.test.ts:31-67` |
| F5 (provider khớp), `exp` giới hạn theo phase, LOW-1 (`next`) | ✓ | `src/domain/oauth.ts:200-215`; `test/domain/oauth.test.ts:211-246` |
| PKCE S256 đúng vector RFC 7636 | ✓ | `test/domain/oauth.test.ts:33` |

## Nghĩa vụ để lại cho task sau

- Task 6: xóa cookie ở mọi nhánh callback, kể cả lỗi (Review Focus 1); LOW-2 (chỉ truyền `linkSessionHash` khi `c.get("user")` khác null).
- Task 3: test CHECK độ dài `label` (từ review VNX-2602).

## Re-review R1 (controller, 2026-10-07)

Commit `5f0efd2`: `isSafeCookieNext` (ASCII in được, bắt đầu `/`, không `//` hay `/\`, trong giới hạn độ dài) dùng ở cả `newFlowCookie` và `parseOAuthCookie`; `newFlowCookie` đổi `next` không hợp lệ thành `null` (test 6 giá trị xấu + một giá trị tốt). Test biên `exp = now − 60 s` → `expired`, `now − 59 s` → ok. Typecheck sạch; `npm test` 140 file / 1503 test xanh. **Verdict cuối: APPROVE.**
