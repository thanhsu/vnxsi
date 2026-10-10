# VNX-2605c — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** plan Task 9c (sau review plan: HIGH-1, MEDIUM-1, LOW-1, LOW-3, S1; Owner E1 = b1, E3), báo cáo `.ai/tasks/VNX-2605c-report.md`, diff `b54a65c..94cf5d8`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 157 file / 1769 test xanh; trailer đúng dòng Opus; diff gọn, không đổi dòng kết thúc cả file.

## Verdict

APPROVE

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/oauth-unlink-race.test.ts:666-674` | Test race không chứng minh trigger đã chạy | Assert identity của user đã mất sau callback. Làm trong VNX-2605d |
| M2 | SUGGESTION | `src/routes/oauth.tsx:463` | `markLogin` chạy trước bước kiểm identity, nên lần đăng nhập bị từ chối vẫn ghi `last_login_at` | Chấp nhận (không ảnh hưởng bảo mật) |
| M3 | SUGGESTION | `test/architecture.test.ts:514` | Kiểm kiến trúc chỉ thấy tên hàm được gọi | Chấp nhận; test route đã phủ hành vi |
| M4 | SUGGESTION | `src/routes/me.tsx:393` | Câu chú thích khó đọc | Không sửa |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Một batch nguyên tử `[audit có guard, endSessions, DELETE identity … RETURNING]`; `endProviderSessionsStatement` ở `auth/sessions.ts`, không đọc `user_identities`; `db/` không import `auth/` | ✓ | `src/auth/sessions.ts:95-97`; `src/db/identities.ts:126-144`; `test/architecture.test.ts:503-517`; test rollback bằng trigger `test/auth/end-provider-sessions.test.ts:599-617` |
| Không session `oauth_<P>` nào của user còn sống sau khi hủy liên kết P, kể cả session đang thực hiện (Owner E1 = b1); session khác loại, provider khác, user khác không bị chạm; audit chỉ `{provider}` | ✓ | `src/routes/me.tsx:401-405`; `test/me/identity-unlink-sessions.test.ts`; `test/auth/end-provider-sessions.test.ts:567` |
| Callback đăng nhập: tạo session trước, `touchIdentityLogin` trả boolean; mất identity thì xóa session, trang "chưa liên kết", không cookie; audit `auth.login` sau khi kiểm | ✓ | `src/routes/oauth.tsx:463-476`; `test/auth/oauth-unlink-race.test.ts` |
| Câu `email.identityUnlinked.sessions` khớp bản Owner duyệt ở 4 locale, chỉ trong email hủy liên kết | ✓ | so từng byte bằng script; `src/email/templates/identity.ts:193-194` |

## Rủi ro còn lại (ngoài phạm vi task này)

1. **Nhảy sang provider thứ hai:** từ session `oauth_P`, kẻ gian liên kết P2 của họ rồi đăng nhập bằng P2; hủy liên kết P không chạm session `oauth_P2`.
2. **Khoảng hở thời gian ở `finishLink`:** session được kiểm trước khi đổi code với provider, không kiểm lại trước khi ghi liên kết.

**Owner 2026-10-10:** xử lý cả hai trong task mới **VNX-2605d** (bắt buộc trước VNX-2608), theo **ADR-013**: chỉ liên kết provider mới từ session `magic_link`, và kiểm lại session sau khi đổi code.
