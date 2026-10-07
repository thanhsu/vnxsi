# VNX-2603b — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-07
- **Đã đọc:** plan Task 3 (sau review plan: F1 `redirect: "manual"`, F2–F4, S1), báo cáo `.ai/tasks/VNX-2603b-report.md`, diff `4a936e5..7963d30`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 142 file / 1533 test xanh; trailer đúng dòng Opus; không còn `redirect: "error"` hay dòng fence markdown trong `src/auth/oauth/`.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1 và M2, chỉ test)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/oauth-providers.test.ts:36` | Quét import S1 bỏ sót `"../oauth/fake.ts"` trong `src/auth/oauth/` và `import()` động | Mở rộng mẫu cho mọi file trừ `auth/oauth/index.ts`, có test tự kiểm mẫu. **Làm ở R1** |
| M2 | LOW | `test/auth/oauth-oidc.test.ts:80-88` | Test workerd chỉ chứng minh option dựng được, chưa ghim `redirect` còn là `manual` | `expect(new Request(...).redirect).toBe("manual")`. **Làm ở R1** |
| M3 | SUGGESTION | commit `7963d30` | Báo cáo commit chung với code | Không làm (theo quy trình) |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Fake không với tới được ở production (`OAUTH_DRIVER` + `isFakeMail`; chỉ `index.ts` import `fake.ts`; wrangler không có driver hay credential) | ✓ | `src/auth/oauth/index.ts:20-22`; `test/auth/oauth-providers.test.ts:24-39, 63-69` |
| Chỉ đọc `id_token`; không token nào trong kết quả hay log | ✓ | `src/auth/oauth/oidc.ts:56, 62`; `test/auth/oauth-oidc.test.ts:92-100, 171-181`; quét tĩnh `oauth-providers.test.ts:41-49` |
| `redirect: "manual"`, 3xx → `token_request`, fetch một lần, timeout 8 s | ✓ | `oidc.ts:35, 45, 47`; `oauth-oidc.test.ts:51, 72-88` |
| `label` = email, không thì `PROVIDER_NAME`; không đọc `name`; CHECK 1–254 có test | ✓ | `oidc.ts:62`; `oauth-oidc.test.ts:102-120`; `test/db/identities.test.ts:114-127` |
| `issueFakeCode` bắt buộc `expect`; mã bị đốt trước mọi kiểm tra (S2) | ✓ | `src/auth/oauth/fake.ts:11-43`; `oauth-providers.test.ts:122-145` |
| Thiếu credential → provider null; vitest ghim credential `""` | ✓ | `index.ts:25-42`; `oauth-providers.test.ts:18-22, 79-87` |
| `client_secret_post` với `code_verifier`, `redirect_uri` | ✓ | `oidc.ts:37-44`; `oauth-oidc.test.ts:52-59` |

## Nghĩa vụ để lại cho task sau

- Task 4 (GitHub): `redirect: "manual"` cho cả hai fetch; ghim `GITHUB_CLIENT_ID`/`_SECRET` = `""` trong vitest và mở rộng test không-credential.
- Task 6: helper test đọc cookie flow và gọi `issueFakeCode` đủ ba trường; `oauthRedirectUri(env.APP_ORIGIN, provider)` dùng chung cho authorize và exchange; xóa cookie ở mọi nhánh callback; LOW-2 của Task 2.
- VNX-2601: thử thật LinkedIn với `code_verifier`, `nonce`, `scope=openid+profile+email`; lệch thì quay lại Reviewer và Owner.

## Re-review R1 (controller, 2026-10-07)

Commit `aed2ded` (chỉ test): quét import fake dùng `FAKE_SPECIFIER` cho mọi file `src/` trừ `auth/oauth/index.ts`, bắt cả import tĩnh và `import()` động, kèm `FAKE_SIBLING` trong `src/auth/oauth/`; test tự kiểm mẫu bắt đủ các chỗ hở và không bắt nhầm `email/fake.ts`. Test workerd ghim `new Request(url, init).redirect === "manual"`. Typecheck sạch; `npm test` 142 file / 1534 test xanh. **Verdict cuối: APPROVE.**
