# VNX-2605a-1 — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-08
- **Đã đọc:** phần chung Task 8 và plan 8a-1 (sau review plan: MEDIUM-1 giữ `signedIn`, form chỉ tới `/logout`; MEDIUM-2 luồng link còn sống hiện lại trang trung gian; LOW-1; quy tắc hiển thị `/me` của Owner), báo cáo `.ai/tasks/VNX-2605a-1-report.md`, diff `e09eef0..6c63194`
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; `npm test -- --maxWorkers=2` 148 file / 1639 test xanh; trailer đúng dòng Opus.

## Verdict

APPROVE (kèm lượt sửa R1 cho M1 và M3, chỉ test)

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/auth/oauth-link-start.test.ts` (diff 931-947, 974-987) | Hai test phủ định thiếu điều kiện tiên quyết dương: có thể đạt 302 vì lý do sai nếu `linkViaStart` hỏng | Assert cookie intent khác rỗng và `flow.intent === "link"`. **Làm ở R1** |
| M2 | LOW | `src/routes/oauth.tsx:54, 58` | Biến thể event `"oauth.start_failed"` không còn chỗ gọi | Xử lý ở 8a-2 (dùng lại hoặc gỡ); không thì ghi "Ghi nhận" |
| M3 | LOW | `test/me/identities.test.ts` (diff 1253-1263) | Test 404 chỉ kiểm không có cookie ở một trường hợp | Kiểm ở mọi trường hợp 404. **Làm ở R1** |

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| `POST …/link`: cần user, Origin check, cờ + cấu hình, intent 120 s gắn session còn sống, 303 cùng site | ✓ | `src/routes/me.tsx` (diff 566-573); `test/me/identities.test.ts` |
| `start` với intent link hoặc luồng link còn sống của cùng session: luôn 200, đúng một `<a>` ra provider, `state` mới, no-store, `same-origin`; mọi form chỉ tới `/logout`; các trường hợp khác 302 | ✓ | `src/routes/oauth.tsx` (diff 676-692); `src/domain/oauth.ts:243-245`; `test/auth/oauth-link-start.test.ts` |
| Callback chưa đổi (vẫn `link_unsupported`); không tạo hay đổi session qua link | ✓ | `src/routes/oauth.tsx:108` |
| Hiển thị `/me` theo quyết định Owner; `label` chỉ chủ tài khoản thấy | ✓ | `src/views/me/LinkedAccounts.tsx`; `test/me/identities.test.ts` |
| `availableProviders` cùng luật với `start`; import thừa đã gỡ | ✓ | `src/routes/auth.tsx`; `src/auth/oauth/index.ts:51-53` |
| Câu chữ 7 khóa mới + `oauth.notLinked.body` thay thế khớp bản Owner duyệt (32 giá trị, kể cả ngoặc kép kiểu chữ) | ✓ | so từng byte bằng script |

## Nghĩa vụ để lại

- 8a-2: xử lý M2 (event `oauth.start_failed`).
- VNX-2608: kiểm tay trang trung gian, tải lại và nút Back trên Chrome, Firefox, Safari (Step 9 của 8a-1, agent không làm được); thêm các điểm LOW-3 của review plan Task 8.

## Re-review R1 (controller, 2026-10-08)

Commit `e410215` (chỉ test): thêm điều kiện tiên quyết dương cho hai test phủ định (cookie intent khác rỗng, `flow.intent === "link"`); test 404 kiểm không có cookie `__Host-vnx_oauth` ở cả bốn trường hợp. Typecheck sạch; `npm test -- --maxWorkers=2` 148 file / 1639 test xanh. **Verdict cuối: APPROVE.**
