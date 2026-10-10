# VNX-2604b — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-08
- **Đã đọc:** plan Task 6 (sau review plan: H1 cô lập test, M1 nối đường dẫn thủ công, M2 spy console mọi nhánh lỗi, L1–L6, S1, S4; câu chữ Owner duyệt nguyên văn 2026-10-08), báo cáo `.ai/tasks/VNX-2604b-report.md`, diff `62bddc6..bed2bdf`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test` 145 file / 1597 test xanh; trailer đúng dòng Opus; worktree sạch, file mới lưu LF trong index.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1 và M2)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `src/routes/oauth.tsx:107` | Từ chối user bị khóa hoặc thiếu (403) là nhánh duy nhất của callback không ghi log | Thêm mã cố định `user_inactive`, giữ nguyên response 403. **Làm ở R1** |
| M2 | LOW | `test/auth/oauth-routes.test.ts:261` | Kiểm "không lộ email" trên trang `stranger` thay vì trang `lookalike` | Assert trên `lookalike.html`. **Làm ở R1** |
| M3 | SUGGESTION | `src/routes/oauth.tsx:112-115` | `markLogin` và audit ghi trước `createSession`, không nguyên tử | Giống `completeLogin` (F10). Ghi nhận, không sửa |
| M4 | SUGGESTION | `src/views/auth.tsx:102-130` | Hai trang mới gần trùng nhau (~15 dòng) | Chấp nhận (plan quy định; giữ input trang "chưa liên kết" tối thiểu) |
| M5 | SUGGESTION | báo cáo | Báo cáo nói file mới "chuẩn hóa CRLF" (thật ra LF trong git); không có lần chạy RED | Sửa báo cáo ở R1; ghi nhận quy trình. Implementer cũng đã chạy `git add -N .` và `git reset -q` một lần (chỉ chạm index, không mất gì) |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Identity chưa liên kết: không tạo user, identity, session; không so email provider với `users.email`; trang "chưa liên kết" giống từng byte | ✓ | `src/routes/oauth.tsx:104-105`; `views/auth.tsx:102`; `test/auth/oauth-routes.test.ts:242-266`; `test/architecture.test.ts:257` |
| Cookie `__Host-vnx_oauth` bị xóa và header no-store, `same-origin` trên mọi nhánh callback | ✓ | `oauth.tsx:78-79`; test 404/429/400/403/200/303 |
| `state` so sánh thời gian cố định; provider khớp (F5); phase `flow`; intent `link` bị từ chối trước `exchange`; phát lại không cookie → 400 | ✓ | `domain/oauth.ts:57-61, 205-240`; `oauth.tsx:60-64, 93`; `oauth-routes.test.ts:121, 185, 219, 304` |
| `redirectUri` từ `APP_ORIGIN` cho cả authorize và exchange; `code_challenge` S256 cho cả ba provider | ✓ | `oauth.tsx:72, 100`; `domain/oauth.ts:82-94`; `oauth-routes.test.ts:62` |
| Thành công: `markLogin` như `completeLogin`, audit `auth.login` với `{ method }`, session `oauth_<provider>`, chuyển hướng qua `safeNext` | ✓ | `oauth.tsx:112-116`; `oauth-routes.test.ts:136, 164` |
| Không tra lời mời Ops (F3), có đối chứng dương | ✓ | `architecture.test.ts:216-251`; `oauth-routes.test.ts:206` |
| Log chỉ `{requestId, event, provider, code}` với mã cố định; spy phủ mọi nhánh lỗi | ✓ | `oauth.tsx:45-48`; `expectOneLog` |
| Rate limit `oauth:ip:<ip>` 20/giờ sau kiểm cờ; cờ tắt hoặc thiếu credential → 404 | ✓ | `oauth.tsx:80-86`; `oauth-routes.test.ts:89-102, 342` |
| Câu chữ 5 khóa x 4 locale khớp bản Owner duyệt | ✓ | so từng byte với plan 3057-3061 |

## Nghĩa vụ để lại

- Task 7: nút đăng nhập ở `/login` là `<a>`, gửi `?lang=<Locale id>` (`zh-Hans`, `zh-Hant`) và `next`.
- Task 8: thay hai nhánh `link_unsupported` (start và callback) bằng luồng liên kết; zh-Hant dùng 連結.
- VNX-2608: giới hạn 20 callback/giờ/IP dùng chung sau NAT nhà mạng (phổ biến trên di động VN); theo dõi sau khi bật.
- Ghi nhận: trang 403 của callback luôn tiếng Anh dù cookie có `locale` (giống magic link).

## Re-review R1 (controller, 2026-10-08)

Commit `b2a806e`: mã cố định `user_inactive` ghi qua `logFailure()` dùng chung với `failed()`; response 403 giữ nguyên (cookie bị xóa, header đã harden); test user bị khóa dùng `expectOneLog("user_inactive", ...)`. Kiểm "không lộ email" chuyển sang `lookalike.html`. Báo cáo đã sửa câu về CRLF và ghi rõ không có lần chạy RED. Typecheck sạch; `npm test` 145 file / 1597 test xanh. **Verdict cuối: APPROVE.**
