# VNX-2606b — Review

- **Reviewer:** Claude (Opus subagent review, Opus orchestrator xác nhận)
- **Ngày:** 2026-10-10
- **Đã đọc:** plan Task 11 (sau review plan: H1 test thứ tự catalogue, M4, M5, L4–L6, S2, S3; Owner E1/E2), báo cáo `.ai/tasks/VNX-2606b-report.md`, diff `e2163f6..0150237` (gồm commit test `8b38931` cho VNX-2606a)
- **Lệnh đã chạy lại (controller):** `npm run typecheck -w apps/web` sạch; trailer đúng dòng Opus. **Chưa chạy được toàn bộ `npm test`:** hai lần đều dừng vì `listen ENOBUFS` (Windows hết buffer socket; một `wrangler dev` cổng 8787 của phiên khác trong worktree `vnxsi-deploy` giữ hơn 9.000 socket từ 2026-10-08). Implementer báo RED (29 lỗi) rồi GREEN trên tập tập trung 28 file / 309 test.

## Verdict

APPROVE

## Phát hiện

| # | Mức | File:dòng | Vấn đề | Đề xuất |
|---|---|---|---|---|
| M1 | LOW | `test/public/builder-badges.test.ts:1020-1021` | Trường hợp "chưa cấu hình" thiếu điều kiện tiên quyết dương | Assert status 200 và có tên builder |
| M2 | LOW | `test/hub/client-identity-privacy.test.ts:835, 871` | `/hub` tổng quan và `/builders` không lọc chỉ kiểm phủ định | Assert status hoặc nội dung đã biết trước |
| M3 | LOW | `.ai/tasks/VNX-2606b-report.md:66, 70` | Ghi chú "import chỉ để side-effect sẽ không bị bắt" sai với file ranking (`IDENTITY_WORDS` bắt được) | Sửa ghi chú |
| M4 | SUGGESTION | `src/routes/builder-profile.tsx:442` | Route công khai import từ route khác (`./oauth.tsx`) chỉ để lấy `availableProviders` | Sau này chuyển hàm sang `auth/oauth/index.ts` |
| M5 | SUGGESTION | `test/db/identities.test.ts:652` | Thứ tự import | Không sửa |

M1–M3 làm thành commit test riêng ở task kế tiếp.

## Đối chiếu tiêu chí chấp nhận

| AC | Đạt? | Bằng chứng |
|---|---|---|
| Huy hiệu chỉ cho builder `approved`, user `active`, `show_on_profile = 1`, provider đang dùng được (Owner E1); cờ không đổi giá trị lưu; Google không bao giờ hiện | ✓ | `src/db/identities.ts:205-224`; `src/routes/builder-profile.tsx:454`; `src/routes/oauth.tsx:48-54` |
| GitHub: `@login` link thẳng `https://github.com/<login>` chỉ khi qua `GITHUB_LOGIN_RE`, `rel="nofollow noopener noreferrer"`, không `/go/`; login EMU có link (Owner E2) | ✓ | `src/domain/identity.ts:250-255`; `src/views/BuilderProfilePage.tsx:482-512` |
| LinkedIn chỉ "đã xác minh qua LinkedIn", nhãn không ra khỏi lớp DB | ✓ | `src/db/identities.ts:209` |
| Không vào JSON-LD, meta, sitemap; không style/script nội tuyến | ✓ | test :1105-1115; `public/assets/app.css:91-92` |
| Không vào xếp hạng: kiểm mã nguồn `RANKING_FILES`, test thứ tự danh bạ và catalogue | ✓ | `test/architecture.test.ts:586-588`; test :1139-1182 |
| Identity của client không lọt vào trang builder hay trang công khai | ✓ | `test/hub/client-identity-privacy.test.ts`; `test/architecture.test.ts:553, 583, 598` |
| `/b/:handle` không có `public`/`max-age`/`s-maxage` | ✓ | test :1126-1135 |
| Câu chữ 2 khóa khớp bản Owner duyệt ở 4 locale | ✓ | `en.ts:295-296`, `vi.ts:332-333`, `zh-hans.ts:369-370`, `zh-hant.ts:406-407` |
| Commit `8b38931` (VNX-2606a R1, chỉ test) | ✓ | `test/hub/badge-toggle.test.ts:718, 728-730, 763-767` |

## Nghĩa vụ để lại (rebase lên `main`, đã có M7)

1. **Bắt buộc:** mở rộng test thứ tự tới Top builders: `loadBuilderTallies(db, now)` (async, `db/public-stats.ts:120`) và `topBuilders(tallies)` (`domain/public-stats.ts:209`).
2. **Bắt buộc:** khi giải xung đột `test/architecture.test.ts`, giữ 7 mục `RANKING_FILES` của M7 và xác nhận các test identity xanh trên danh sách đã gộp.
3. Xung đột văn bản dự kiến: `public/assets/app.css` (giữ `.verified-list`, `.verified`; kiểm `--success` ở cả ba theme), 4 file locale (giữ hai khóa sau `bprofile.website`, chạy parity).
4. Sau rebase chạy lại `test/public/builder-badges.test.ts`, `test/hub/client-identity-privacy.test.ts`, `test/hub/badge-toggle.test.ts`.
5. VNX-2608, kiểm tay với tài khoản thật: link GitHub đúng; login EMU (ghi lại link có 404 với khách không); tắt rồi bật cờ ẩn rồi hiện lại huy hiệu.

## Chạy lại toàn bộ test (controller, 2026-10-10)

Owner cho phép dừng `wrangler dev` cổng 8787 của phiên khác (worktree `vnxsi-deploy`, PID 22768 và workerd 13216) đang giữ hơn 9.000 socket. Sau khi dừng, số socket TCP giảm từ 10.148 xuống 930; `npm test -- --maxWorkers=2` 154 file / 1752 test xanh. **Verdict cuối: APPROVE.**
