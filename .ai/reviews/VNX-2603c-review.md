# VNX-2603c — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-07
- **Đã đọc:** plan Task 4 (Owner duyệt trực tiếp; lượt review plan bị ngắt khi phiên khởi động lại, nên review này trả lời luôn các câu hỏi cấp plan), báo cáo `.ai/tasks/VNX-2603c-report.md`, diff `d0ce773..46abadf`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 143 file / 1550 test xanh; trailer đúng dòng Opus.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1–M3)

## Trả lời câu hỏi cấp plan

- **Regex `login`:** rộng hơn luật username mới của GitHub (cho qua tài khoản cũ có gạch nối liên tiếp hoặc ở cuối), nhưng từ chối login Enterprise Managed User có `_` (`IDP-USERNAME_SHORTCODE`, tối đa 39 ký tự). Sửa ở R1 thành `^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$` (vẫn an toàn cho đường dẫn `github.com/<login>`). Ghi chú cho Task 11: profile EMU không công khai, link huy hiệu có thể 404 với khách.
- **GitHub nhận `code_verifier`:** có, tài liệu "Authorizing OAuth apps" ghi PKCE cho web flow (chỉ `S256`); `code_verifier` bắt buộc khi đã gửi `code_challenge`. Việc gửi `code_challenge` ở bước authorize thuộc Task 2/Task 6.
- **Header:** `X-GitHub-Api-Version: 2022-11-28` hợp lệ (mặc định, hết hỗ trợ 2028-03-10); `Accept: application/vnd.github+json`, `User-Agent: vnx.si`, `Accept: application/json` ở bước token, `Authorization: Bearer` đều đúng.

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/oauth-github.test.ts:73-77` | Test workerd chưa ghim `new Request(...).redirect === "manual"` như OIDC | Thêm một dòng assert. **Làm ở R1** |
| M2 | LOW | `src/auth/oauth/github.ts:9` | Regex `login` từ chối login EMU có `_` | `^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$` + test. **Làm ở R1** |
| M3 | LOW | `src/auth/oauth/index.ts:32` | `oauthCredentials` đưa mọi provider không phải Google/GitHub sang credential LinkedIn (fail open về cấu trúc) | `switch` vét cạn với kiểm `never`. **Làm ở R1** |
| M4 | SUGGESTION | báo cáo | Không có lần chạy RED thật | Ghi nhận quy trình |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Hai fetch `redirect: "manual"`, 3xx thất bại, không gọi `/user` sau bước 1 lỗi | ✓ | `src/auth/oauth/github.ts:36, 47, 66, 70`; `test/auth/oauth-github.test.ts:79-88` |
| Access token chỉ ở biến cục bộ và header lần gọi thứ hai; không trả, không lưu, không log | ✓ | `github.ts:57, 67, 84`; `oauth-github.test.ts:70, 105, 186-199`; quét tĩnh `oauth-providers.test.ts:54-62` |
| `subject = String(id)` chỉ với số nguyên dương an toàn | ✓ | `github.ts:82`; `oauth-github.test.ts:115-125` |
| 200 kèm lỗi → `token_response`, không gọi `/user` | ✓ | `github.ts:55-56`; `oauth-github.test.ts:154-168` |
| Credential GitHub tùy chọn, ghim `""` trong vitest, thiếu thì provider null | ✓ | `env.ts:24-25`; `vitest.config.ts:28-29`; `index.ts:47`; `oauth-providers.test.ts:25, 103-115` |

## Nghĩa vụ để lại cho task sau

- Task 6: authorize URL của GitHub phải có `code_challenge` + `code_challenge_method=S256`; cùng `redirect_uri` cho authorize và exchange.
- Task 11: huy hiệu GitHub của tài khoản EMU có thể dẫn tới trang 404 với khách (profile EMU không công khai).
- Ghi nhận: xem lại `X-GitHub-Api-Version` trước 2028-03-10.

## Re-review R1 (controller, 2026-10-07)

Commit `381f500`: regex `login` thành `^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$` (test nhận `mona-cat_octo`, `a--b-`; từ chối `_octocat`, `octo%2Fcat`, `octo.cat`, 40 ký tự); `oauthCredentials` là `switch` vét cạn với kiểm `never`; test workerd ghim `.redirect === "manual"`. Typecheck sạch; `npm test` 143 file / 1551 test xanh. **Verdict cuối: APPROVE.**
