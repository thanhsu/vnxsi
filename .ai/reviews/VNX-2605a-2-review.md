# VNX-2605a-2 — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-08
- **Đã đọc:** phần chung Task 8 và plan 8a-2 (sau review plan: MEDIUM-3 `postPrefix`, MEDIUM-4 `meHtml` giải mã entity, LOW-2 `expectBack` và `loggedCodes` chính xác; M2 của review 8a-1), báo cáo `.ai/tasks/VNX-2605a-2-report.md`, diff `3624c2b..959c725`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 149 file / 1659 test xanh; trailer đúng dòng Opus; không còn `link_unsupported` hay `start_failed` trong src và test.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1–M4)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `src/routes/oauth.tsx:63`, `src/views/me/LinkedAccounts.tsx:6`, `src/routes/me.tsx:60` | Tập thông báo đóng viết ở ba chỗ, Task 9 sẽ mở rộng nên dễ lệch | Một nguồn duy nhất (`LinkNotice` + `LINK_NOTICES`). **Làm ở R1** |
| M2 | LOW | `test/auth/oauth-link.test.ts:174-194` | Test session hết hạn và hash của session khác chưa kiểm mã log và chưa chứng minh code chưa bị tiêu | Thêm `loggedCodes()` = `["session_mismatch"]` và kiểm code còn dùng được. **Làm ở R1** |
| M3 | LOW | `test/auth/oauth-link.test.ts:137` | Test `taken` chỉ so hai location với nhau | Assert `/me?link=taken`. **Làm ở R1** |
| M4 | LOW | `test/auth/oauth-link.test.ts:245-253` | Test giá trị lạ thiếu điều kiện tiên quyết dương | Assert mục `identities` có mặt trước. **Làm ở R1** |
| M5 | SUGGESTION | `src/routes/oauth.tsx:172-174` | `linkIdentity` lỗi (D1) sau khi đã tiêu code rơi vào `catch` chung: trang lỗi đăng nhập tiếng Anh thay vì `/me?link=failed` | Ghi nhận; đóng an toàn, không tạo session |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Kiểm session còn sống và hash khớp (thời gian cố định) trước `exchange`; lệch thì 400 `session_mismatch`, không gọi provider | ✓ | `src/routes/oauth.tsx:77, 88`; `src/domain/oauth.ts:243-244`; `test/auth/oauth-link.test.ts:152-172` |
| Nhánh link không bao giờ tạo hay đổi session | ✓ | `oauth.tsx:72-99, 172-174`; `oauth-link.test.ts:71-73, 84-91, 117` |
| `linkIdentity` gọi một lần với user của session; ánh xạ `ok`/`taken`/`hasProvider`/`failed`; audit cùng batch | ✓ | `oauth.tsx:94-98`; `src/db/identities.ts:64-86` |
| Tập `?link=` đóng, không phản chiếu; chuyển hướng 303 cùng site theo locale; `taken` không nêu ai | ✓ | `src/routes/me.tsx:60`; `src/views/me/LinkedAccounts.tsx:8-30`; `oauth.tsx:66`; `oauth-link.test.ts:141-145` |
| Cookie bị xóa, header đã harden ở mọi nhánh | ✓ | `oauth.tsx:130-132`; `expectBack` |
| Nhánh `signin` không đổi; dòng log giữ đúng dạng | ✓ | `oauth.tsx:54-56, 145` |
| Câu chữ 4 khóa thông báo khớp bản Owner duyệt (16 giá trị) | ✓ | so từng byte bằng script |

## Nghĩa vụ để lại

- Task 9 (VNX-2605b): email báo liên kết gắn ở điểm đánh dấu sau `linkIdentity` (chỉ khi `ok`); thêm thông báo hủy liên kết vào tập `LINK_NOTICES` dùng chung.
- Ghi nhận M5.

## Re-review R1 (controller, 2026-10-09)

Commit `50263ed`: `LINK_NOTICES` và `LinkNotice` chỉ còn ở `views/me/LinkedAccounts.tsx` (`oauth.tsx` import kiểu, `me.tsx` dùng `LINK_NOTICES.find`); hai test từ chối kiểm `loggedCodes()` = `["session_mismatch"]` và chứng minh code chưa bị tiêu; test `taken` assert `/me?link=taken`; test giá trị lạ có điều kiện tiên quyết dương. Lượt sửa bị ngắt một lần do giới hạn API, chạy lại sạch. `node_modules` gốc của worktree bị mất từ bên ngoài phiên trước lượt này; Implementer tạo lại bằng `npm install`, `package-lock.json` không đổi, mọi file được theo dõi nguyên vẹn. Typecheck sạch; `npm test -- --maxWorkers=2` 149 file / 1659 test xanh. **Verdict cuối: APPROVE.**
