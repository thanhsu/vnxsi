# EPIC27 plan delta (2026-10-10) — Review

- **Reviewer:** Claude (Opus), độc lập
- **Ngày:** 2026-10-10
- **Đã đọc:** delta `1362ab4..447fc6d` của `docs/superpowers/plans/2026-10-07-vnxsi-epic27-public-request-board.md` (toàn bộ), và toàn plan sau delta; đối chiếu với code trên nhánh `feat/epic27-request-board` (= `main` `1362ab4`; `origin/main` `225506b` chỉ thêm `.ai/context/CURRENT-STATUS.md`).
- **Đã đối chiếu trong code:** `apps/web/migrations/` (0001–0017), `src/domain/flags.ts` + 3 test cờ, `src/views/admin/FlagsPage.tsx`, `src/legal/content.ts`, `docs/legal/{privacy,privacy-m7,terms}.md`, `test/legal/content.test.ts`, `src/domain/privacy-notice.ts` và mọi nơi import nó, `src/routes/legal.tsx`, `src/views/FormErrorSummary.tsx`, `Layout`/`HubLayout`/`OpsLayout`, `views/RequestFormPage.tsx`, `views/me/RequestPage.tsx`, `views/ops/RequestsPages.tsx`, `src/auth/{ops,middleware}.ts`, `src/domain/{identity,ops}.ts`, `routes/{ops-marketplace,admin-requests}.tsx`, `test/ops/guard.test.ts` (`OAUTH_METHODS`), `test/fixtures.ts#signIn`, `apps/web/vitest.config.ts`, `apps/web/wrangler.jsonc`, `e2e/` (config, `serve.mjs`, seed, fixtures, `a11y.spec.ts`, README ngân sách POST), `scripts/smoke*.mjs`, `scripts/test/*`, `docs/runbooks/deploy.md`, root `package.json` scripts; sự tồn tại của mọi đường dẫn test/nguồn plan nêu.
- **Lệnh đã chạy lại:** không chạy bộ test (delta chỉ là tài liệu; không có mã mới). Chỉ đọc mã và `git`.

## Verdict

**APPROVE_AFTER_FIXES.** Mọi phát hiện dưới đây là lỗi sự thật/thứ tự trong văn bản plan; Reviewer đã sửa trực tiếp ở `ee7af8d` (mỗi chỗ đánh dấu "sửa Reviewer 2026-10-10"). Sau `ee7af8d` không còn sửa nào bắt buộc: plan delta được duyệt ở `ee7af8d`. Không quyết định nào Owner đã duyệt bị đổi (phụ lục §17, câu chữ §12.2–12.6, câu thông báo OP-2a, OP-1..5, VNX-2701): phần diff đụng tới các mục đó là không có; mục Open points và câu thông báo giữ nguyên từng chữ.

## Phát hiện

| # | Mức | Chỗ trong plan | Vấn đề | Đã sửa (ee7af8d) |
|---|---|---|---|---|
| F1 | HIGH | 2704a, 2703b E2E; bảng seed ở 2705a | Spec e2e của 2704a (Ops, `R2008+retry`) và 2703b (`/me`, `R2005+retry`) dùng dòng seed "của VNX-2705a", nhưng thứ tự thực thi là 2703a → 2704a → 2703b → … → 2705a: lệnh kiểm của hai task đó không chạy được lúc làm task. | Dòng seed được thêm ở task đầu tiên cần chúng (2704a: `R/Q 2008..2010`; 2703b: `R 2005..2007`); 2705a thêm phần còn lại. |
| F2 | HIGH | 2704a E2E bước (3); 2703b E2E bước (3) | 2704a kiểm `/requests/<publicId>` 200 sau Publish, nhưng trang công khai chỉ có từ 2705a (chạy sau). 2703b kiểm `/requests/<publicId>` 404 sau gỡ, nhưng client không thấy `publicId` khi publication còn `pending_review` (và trang chưa tồn tại). | 2704a bước (3) chuyển sang 2705a (bước (8), sửa `request-board-forms.spec.ts`); 2703b bỏ kiểm đó (Vitest đã phủ "gỡ → 404 ngay"). |
| F3 | HIGH | 2705a E2E (1), 2705b sitemap E2E | `playwright.config.ts`: `workers: 1`, `fullyParallel: false`, file chạy theo tên: `request-board-forms.spec.ts` (Ops publish `Q2008+retry`) chạy **trước** `request-board-public.spec.ts`. Khẳng định "không có thẻ/`<loc>` cho `Q2001`–`Q2011`" và "thứ tự … `Q1` đầu" sẽ đỏ khi chạy `npm run e2e` toàn bộ (cổng ra 2709). | Chỉ khẳng định vắng `Q2001`–`Q2004`, `Q2011`; không khẳng định về `Q2008`–`Q2010`; thứ tự kiểm tương đối trong `Q1`–`Q8`. Thêm luật chung ở Global Constraints. |
| F4 | MEDIUM | 2705a E2E (1), (3), (4) | Khẳng định `noindex`/canonical/hreflang và link footer/`/for-builders` thuộc phạm vi 2705b (task sau), không chạy được ở 2705a. | Chuyển các khẳng định đó sang E2E của 2705b. |
| F5 | MEDIUM | Verification của 2703a, 2704a, 2703b, 2705b | Dòng "Test:" nêu lệnh e2e nhưng khối Verification không có (cổng chấp nhận của task thiếu lệnh). | Thêm `npm run test:scripts`/`e2e:typecheck`/`e2e -- <spec>` vào từng khối. |
| F6 | MEDIUM | 2709 Smoke; 2708 | Lập luận "`/requests*` chưa nằm trong rule Cloudflare nên không tính vào hạn mức" sai cho chế độ `--board`: `--board` chỉ chạy sau khi 2708 đã thêm rule (có thể chung bộ đếm với `/p/*`, `/go/*`). Ngoài ra cờ `--board` phải nằm ở `parseArgs` của `scripts/smoke-checks.mjs`; `scripts/smoke.mjs` là vỏ gọi `run()`. Chế độ mặc định đỏ sau khi bật cờ: chưa nói. | `isRateCovered` tính `/requests*` từ 2709 (bảo thủ, cả hai chế độ), test số request bị phủ ≤ `WINDOW_MAX`; Files ghi đúng `smoke-checks.mjs`; ghi "sau khi bật cờ luôn dùng `--board`"; 2708 ghi rule phải có trước khi bật cờ. |
| F7 | MEDIUM | 2708 bước deploy | "`migrations list --remote` chỉ còn `0018_request_board`": runbook mục 1 ghi production đang ở `0016`; EPIC 26 (`0017`) chưa deploy. | Danh sách là `0017` + `0018` nếu EPIC 26 chưa deploy trước; bước deploy EPIC 26 áp dụng cùng lần. |
| F8 | MEDIUM | 2704a Files (`OpsLayout`) | Plan viết điều kiện "nếu `OpsLayout` đã bọc `Layout`". Thực tế không: nó tự render `<title>{tr("ops.layout.title", { page })}</title>`, `tr` cục bộ chỉ nhận `OpsMessageKey`. | Mô tả đúng: tiền tố bằng `t("en", "form.error.titlePrefix")`, `FormErrorSummary` nhận `translator("en")`, `<title>` không đổi từng byte khi không `invalid` (có test). |
| F9 | LOW | 2702b Files (`FlagsPage`) | "nhãn … nếu trang có bảng nhãn": trang **có** `DESC: Record<FlagKey, MessageKey>`, nên thêm key là lỗi typecheck nếu thiếu `flags.desc.request_board`, cần 4 locale. | Ghi đúng; thêm `parity.test.ts` vào Verification. |
| F10 | LOW | 2702a Files, bảng phối hợp, Changelog mục 1 | "danh sách đang liệt kê tới `0017_user_identities`": danh sách bước 1 trong `wrangler.jsonc` dừng ở `0016`; `0017` có dòng riêng. | Thêm dòng riêng cùng mẫu cho `0018`. |
| F11 | LOW | 2707b Phối hợp EPIC 26 | `terms.md` có `## Ghi chú cho Owner` và `## Bổ sung ADR-012 …` sau `## VI` (lặp đoạn OAuth): plan chỉ cấm chép phụ lục của `privacy.md`. | `terms-board.md` cũng không chép hai mục đó. |
| F12 | LOW | Trạng thái đối chiếu (VNX-0807), 2706b, 2707a | (a) `ContactPage` không dùng `FormErrorSummary` (`contact/ContactForm` dùng). (b) 2706b nói `InterestedBuilders.tsx` "dùng `OpsLayout invalid`": nó là khối, trang là `RequestDetailPage`. (c) 2707a giải thích sai ai dùng hàm nào của `domain/privacy-notice.ts`; thiếu `test/domain/privacy-notice.test.ts` (nơi test `privacyVersion`) trong Verification. Bảng phối hợp còn câu "M5: nghĩa vụ của VNX-2607" mà không đánh dấu là lịch sử. | Sửa cả bốn. |
| F13 | SUGGESTION | 2702b (không thuộc delta) | Dòng Files `http/request-board.ts` ghi "đọc `isFlagEnabled` rồi cổng ngày", ngược với M1 ("kiểm ngày trước"). M1 rõ hơn và thắng; Implementer làm theo M1. | Không sửa (ngoài delta). |

## Đối chiếu yêu cầu kiểm của controller

| Mục | Đạt? | Bằng chứng |
|---|---|---|
| Migration `0018` là số trống kế tiếp | ✓ | `apps/web/migrations/` có `0001`–`0017`; không nhánh nào khác cần kiểm ở đây (Step 1 của 2702a vẫn bắt kiểm lại). |
| `FLAG_KEYS` 10 key gồm `oauth_*`; chỉ `test/domain/flags.test.ts` cứng | ✓ | `domain/flags.ts`; `test/db/flags.test.ts` dùng `[...FLAG_KEYS]`, `test/admin/flags.test.ts` dùng `FLAG_KEYS.length`. (F9 bổ sung `FlagsPage`.) |
| `content.ts`/`privacyVersion` sau VNX-2607 | ✓ | 4 hằng số Privacy + `terms*`; `LEGAL_UPDATED_AT = "2026-10-05"`; `PRIVACY_M7`; `legal.tsx` chọn theo `privacyVersion`. Chuỗi nhận diện OAuth plan nêu có thật trong `content.ts` (dạng có `**`/backtick: "Linked accounts:", "`__Host-vnx_oauth`" là chuỗi con đúng). |
| Board Privacy ⊇ `privacy-m7` (gồm OAuth, `__Host-vnx_oauth` giữa `__Host-vnx_invite` và `__Host-vnx_vid`); board Terms ⊇ `terms.md` | ✓ | `privacy-m7.md` dòng 70–72 (EN), 156–158 (VI) đúng thứ tự; `terms.md` dòng 28/88. Test tập cha ở 2702b (markdown) và 2707b (hằng số) có danh sách dòng thay thế tường minh. |
| VNX-0807 trên mọi form mới/đổi; `OpsLayout invalid` | ✓ (sau F8) | `FormErrorSummary({ tr, items, lead? })`, `href: ""` cho lỗi cấp form; `Layout`/`HubLayout` có `invalid`; id lỗi `rq-${field}-error` khớp `aria()` của `RequestFormPage`; plan cấm `#` trong `action` và `role="alert"` cho cả 6 nhóm form. |
| E2E: seed, `serve.mjs` `REQUEST_BOARD_GO_LIVE`, fixture, spec mới, axe, ngân sách | ✓ (sau F1–F5) | `id(kind, n)` Crockford (`Q`, `R` hợp lệ); `ADMIN_EMAILS: e2e-admin@example.test` có sẵn trong `serve.mjs` (Ops root Owner theo email, `users.is_admin` không dùng); `sessions.method` mặc định `magic_link`. Interest 10/ngày/builder: tối đa 3 lần đếm (lần gửi 501 ký tự bị từ chối trước bước đếm). `/login`: không thêm POST (fixture cookie) — đã ghi tường minh. `/request`: chỉ gửi form sai, 0 lần đếm, khớp README. |
| Staff/Ops qua `requireOps`/`requireAdmin` (kiểm `method`), test `oauth_*` | ✓ | `auth/ops.ts:42`, `auth/middleware.ts:43`; `test/ops/guard.test.ts:342` có `OAUTH_METHODS`; `signIn(email, { method })` có trong `test/fixtures.ts`. |
| Deploy/smoke so với `docs/runbooks/deploy.md` | ✓ (sau F6, F7) | Mục 2–4, 6–9 tồn tại và đúng số; luật "≤ 10 request bị phủ / 10 giây" khớp `WINDOW_MAX`/`WINDOW_MS`. |
| Mọi đường dẫn/hàm plan nêu tồn tại | ✓ | 24 file test được liệt kê đều có; `requestDetail`, `inviteToRequest`, `inviteBuildersBatch`, `historyOf`, `REQUESTS_PATH`, `can`, `requestValuesFromBody`, `translator` có thật. |
| Thứ tự task và độc lập | ✓ (sau F1, F2, F4) | Không task nào còn dùng dữ liệu/trang của task sau. |
| Lệnh chấp nhận chạy được | ✓ (sau F5) | Script `test:scripts`, `e2e`, `e2e:typecheck`, `smoke` có trong `package.json` gốc; đường dẫn spec tính từ `e2e/` (`tests/<spec>`), đúng quy ước README. |

## Phán quyết controller đã ghi vào plan (vnxsi-72, 2026-10-10)

Phiên OAuth được opt-in/gỡ/interest; giữ 3 phiên bản Privacy, `current` đi vào task dọn Privacy sau 2026-11-21; khối Ops mới dùng mẫu VNX-0807 với `OpsLayout invalid` tối thiểu; duyệt smoke `--board`; Owner chọn `REQUEST_BOARD_GO_LIVE` ở 2708 (≥ 2026-10-21, ≥ 14 ngày sau deploy mang biến, mọi deploy sau phải chứa commit ngày). Ghi ở mục cuối plan "Cần Owner/Reviewer lưu ý".

## Nghĩa vụ để lại cho task sau

- Reviewer: khi 2709 xong, cập nhật `docs/runbooks/deploy.md` mục 7 (chế độ `--board`, `/requests*` tính là bị phủ, "sau khi bật cờ luôn dùng `--board`"); khi D được commit, mục 4 (luật `REQUEST_BOARD_GO_LIVE`, giá trị `Privacy: Last updated`) và mục 6 (rule `/requests*`).
- Implementer 2704a: test khẳng định `<title>` của trang Ops cũ không đổi khi không truyền `invalid`.
- Ghi nhận (CURRENT-STATUS): nếu bộ e2e đầy đủ tiến gần `globalTimeout` 8 phút, cần quyết riêng (plan cấm sửa `playwright.config.ts`).
