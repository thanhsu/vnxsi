# CURRENT STATUS — VNX.SI

_Cập nhật lần cuối: 2026-10-06 bởi Reviewer (Claude), phiên trang tool + Ops Merchants (nhánh `feat/vnx-2105-2508a`)._

## Tóm tắt
- **Trang tool → marketplace, và Merchants trong Ops (2026-10-06):** Owner hỏi cách làm `/tools/elevenlabs` hiệu quả và dẫn người dùng về VNX.SI; Owner duyệt hướng đề xuất ("approve") và yêu cầu thêm tab Merchants vào Ops.
  - **VNX-2105** (khối "Products built with {name}" / "Builders who work with {name}" + hai thẻ CTA Post a request / Become a builder trên `/tools/:slug`) và **VNX-2508a** (`/ops/monetization/merchants`, chỉ Owner, dùng chung logic với `/admin/merchants`) **xong**.
  - Nhánh `feat/vnx-2105-2508a` cắt từ `main` `f155765`, worktree riêng `D:\DOCS\SUPHAM\GIT\vnxsi-merchants`.
  - Implementer là subagent Claude, vì Codex hết credit; Owner đồng ý 2026-10-06.
  - Review: `.ai/reviews/VNX-2105-review.md` và `.ai/reviews/VNX-2508a-review.md`, cả hai **APPROVE** sau một lượt sửa.
  - Typecheck sạch, **136 file / 1447 test xanh** ở `47d870f`. AC9 đã xem bằng `wrangler dev` local + Chrome headless.
  - **Chưa push, chưa merge, chưa deploy** (chờ Owner). Không có migration.
  - **Mô tả merchant ElevenLabs trên production chưa đổi:** Reviewer định sửa qua `wrangler d1 --remote` nhưng auto mode chặn. Owner tự dán bản mới ở `/admin/merchants` (văn bản ở "Nghĩa vụ để lại").
- **Production (2026-10-06, lần 3):** `main` `d447cf4` (PR #10: phần đầu Ops O1, kèm EPIC 21 và VNX-0803-fix đã có trên `main`) **đã deploy** (version `411e3c9f`, Owner chạy `npm run deploy`). D1 production đã áp `0010`–`0013` (Reviewer, `db:migrate:remote`, ngay trước deploy). Trước deploy: smoke local VNX-0803 F2 trên Chrome headless với khóa test Turnstile: `/contact`, `/request`, Inquiry (`/b/:handle/hire`) có widget + token, gửi được; magic link `/auth/verify` POST thành công, có cookie phiên, vào `/me`; không vi phạm CSP. Sau deploy (vnx.si): 22 route trả mã đúng (`/ops`, `/ops/*`, `/vi/ops` 404 kín có `no-store` + `X-Robots-Tag`; `/go/elevenlabs`, `/tools/elevenlabs` 404 vì EPIC 21 còn tắt; `/admin`, `/hub`, `/me` 303 về `/login`); CSP, HSTS và các header có mặt; `/contact` nạp Turnstile với site key thật, không có script Rocket Loader / Web Analytics / Bot Fight Mode trong HTML; `robots.txt` có `Disallow: /ops`. Chưa đặt `ANALYTICS_SALT` (công tắc của M7).
- **EPIC 21 lát mỏng partner (2026-10-05):** **xong** trên nhánh `feat/epic21-partner-slice`: 11 task (VNX-2101, 2102a-1…4, 2102b-1/2, 2103-1/2, 2104a/b), plan `docs/superpowers/plans/2026-10-05-vnxsi-epic21-partner-slice.md`. Đã gộp `main` hai lần (`e77c769`, `9760016`). 1194 test, typecheck sạch; chạy cả bộ dưới tải máy có vài test 5 s timeout ở file có sẵn từ trước, chạy riêng thì xanh. Review: `.ai/reviews/EPIC21-partner-slice-review.md`, APPROVE WITH CHANGES. Đã merge vào `main` (`7622105`, đã push); **đã deploy 2026-10-06** (version `411e3c9f`, xem dòng Production lần 3). ElevenLabs chưa bật (xem "Việc của Owner trước khi bật ElevenLabs").
- **Ops console (2026-10-05):** Owner yêu cầu trang Ops riêng gồm 4 nhóm (gộp admin, tổng quan + sức khỏe, nội dung & marketing, cài đặt), chia O1 (khung, vai trò, audit, chuyển `/admin`) → O2 → O3 → O4. Spec `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md` và ADR-010 **Accepted** (review `.ai/reviews/OPS-DESIGN-review.md`). Mockup O1 duyệt (canvas, `docs/design/mockups/ops/`); plan O1 `docs/superpowers/plans/2026-10-05-vnxsi-ops-o1.md` **APPROVED** (EPIC 25, VNX-2501…2509; lời mời Ops hết hạn 7 ngày). **Phần đầu O1 đã merge vào `main`** (Owner 2026-10-05: "push merge và deploy"): VNX-2501 (migration `0013_ops_members`, quyền), 2502 (`requireOps`, 404 kín, header Ops), 2503 (khung + Overview), 2504a Builders, 2504a2 Products, 2504b Requests; tất cả review APPROVE. Lúc này chỉ Owner gốc (`ADMIN_EMAILS`) vào được `/ops`; `/admin` giữ nguyên. Còn lại trên nhánh `feat/ops-o1`: 2504c (Inquiries + Invites, đang làm), 2505, 2506 (Team & roles), 2507 (Audit log), 2508 (chuyển `/admin`), 2509.
- **Production (2026-10-05, lần 2):** `main` `3c77ac5` (M6 + PR #6 bật lại R2) **đã deploy** (version `74b85569`, binding `MEDIA` = `vnxsi-media`, cron `0 1 * * *`). D1 production đã áp `0001`–`0009`. Smoke: 15 route OK (gồm `/request`), R2 đọc qua `/media` đã kiểm bằng object tạm (đã xóa). Upload ảnh và submit product giờ dùng được.
- **M6 (Request, 2026-10-05):** **xong** trên nhánh `feat/m6-request`: 7 task (VNX-0601, 0602a, 0602b, 0603, 0604, 0605 + 0605b, 0606) + lượt sửa sau review toàn nhánh (F2, F3, F4, F5, F7, phần còn lại của Task 7). Đã gộp `origin/main` (PR #4) ở `2865d7e`. 802/802 test, typecheck sạch. Review: `.ai/reviews/M6-review.md`. Đã merge vào `main` (`e9f53a2`, đã push).
- **Cách làm từ M6 (Owner, 2026-10-04):** phiên Opus điều phối các subagent Sonnet (viết plan và code); Opus review và duyệt thay Owner (plan, khắc phục); sau mỗi milestone được APPROVE thì merge và push.
- **Tiếp theo:** phần còn lại của M7 (nhánh `feat/m7-metrics`).
- **VNX-0803-fix đã merge vào `main` (`4034ce2`, đã push, 2026-10-05):** Owner yêu cầu review và merge; review độc lập `.ai/reviews/VNX-0803-fix-independent-review.md` tìm ra BLOCKER F1 (`Referrer-Policy: no-referrer` trên `/auth/verify` làm form POST gửi `Origin: null` → 403, hỏng đăng nhập magic link), đã sửa ở `0f51981` (`same-origin` + test hồi quy), verdict cuối APPROVE. **Đã deploy 2026-10-06** (version `411e3c9f`); smoke F2 local và kiểm zone đã làm (xem dòng Production lần 3).
- **Production (2026-10-05):** `main` `3169e6d` (PR #4: VNX-0709 thiết kế lại đợt A, VNX-0710 contact/feedback, VNX-0711 chạy khi chưa có R2, kèm M5 + VNX-0508) **đã deploy** lên https://vnx.si (version `b5d0f063`, cron `0 1 * * *`). D1 production đã áp `0003`–`0007`, `0009`. Smoke: 20 route trả mã đúng, magic link thật gửi qua Resend tới `thanhsu604@gmail.com`. Chưa có R2: `/media/*` 404, upload ảnh báo "sắp mở" (builder chưa submit product được). Việc còn lại: Owner bật R2 → `npx wrangler r2 bucket create vnxsi-media` → bỏ comment `r2_buckets` trong `wrangler.jsonc` → deploy.
- **Review bảo mật toàn nhánh VNX-0803 (2026-10-05, Reviewer Claude Fable):** `.ai/reviews/VNX-0803-security-review.md`, verdict **APPROVE WITH CHANGES** (tại `main` `b60d8ed` + nhánh EPIC 21 `488df8c`: 1019/1019 test, typecheck sạch, `npm audit` 0). Không BLOCKER. F1 HIGH: xoay `RESEND_API_KEY`, `TURNSTILE_SECRET` (Owner: "làm sau"). F2 headers, F4 body limit, F6 driver mail, F8 no-store, F9 `.gitignore` → task **VNX-0803-fix** (plan `.ai/plans/VNX-0803-fix-plan.md` APPROVED theo ủy quyền Owner 2026-10-05 "you start fix from F2"; handoff `.ai/tasks/VNX-0803-fix-handoff.md`), nhánh `fix/vnx-0803-security` tách từ `main` `b60d8ed` trong worktree riêng `D:\DOCS\SUPHAM\GIT\vnxsi-fix-0803` (phiên vnxsi-93 giữ cây chính cho EPIC 21, đã thống nhất). F3 (Cloudflare Access cho `/admin`), F5 (`workers_dev`), F7 (EXIF): chờ Owner quyết. F10–F13: LOW/SUGGESTION, chưa làm.
- **VNX-0803-fix (2026-10-05): xong, review `.ai/reviews/VNX-0803-fix-review.md` APPROVE.** Nhánh `fix/vnx-0803-security` (tách từ `main` `b60d8ed`): `f57a068` F2 header bảo mật + CSP allow-list (không inline; Turnstile qua `script-src`/`frame-src https://challenges.cloudflare.com`; HSTS 1 năm không `includeSubDomains`), `5a36f7a` F4 trần body 64 KB (`hono/body-limit`), `325c5e2` F6 khóa Resend thật thắng `MAIL_DRIVER` (cả Turnstile giả), `480a6d8` F8 `no-store` mọi trang HTML khi đăng nhập (đánh đổi: mất bfcache khi đăng nhập), `f663d9f` F9 `.gitignore`, `9076ed8` sửa sau review toàn nhánh (upload có `Content-Length` để route tự trả trang 400; test env ghim `RESEND_API_KEY: ""`). Typecheck sạch, 105 file / 817 test (main có 808 + 9 mới; con số ≥ 1019 trong plan lấy nhầm từ nhánh EPIC 21). **Chờ Owner merge + deploy**; sau deploy kiểm Turnstile thật dưới CSP (OQ-1 của plan; bước lùi: `'unsafe-inline'` cho `style-src`) và kiểm zone không bật Rocket Loader / Web Analytics tự chèn. Ràng buộc mới cho mọi task UI (EPIC 21, Ops console): không `style=`/script inline; POST ngoài upload ≤ 64 KB; handler POST không redirect ra ngoài site.

- **Hướng sản phẩm:** marketplace cho sản phẩm được xây bằng AI và builder (pivot 2026-10-03). Blueprint: `docs/blueprint/README.md`.
- **Đợt hiện tại:** Wave 1 (Supply). Spec: `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`.
- **Milestone:** M0 và M1 **xong**, đã merge vào `main` qua PR #1 (merge commit `368cc1a`, 2026-10-03). M2 (Builder) **xong và đã merge** vào `main` (merge commit `3bde074`, đã push). M3 (Product) **xong**: 8 task + lượt sửa sau review toàn nhánh, 323/323 test, typecheck sạch. Review: `.ai/reviews/M3-review.md`. Đã merge vào `main` (`fe87caa`, đã push). M4 (Catalogue và danh bạ) **xong** trên nhánh `feat/m4-catalogue`: 5 task + lượt sửa sau review toàn nhánh (`bcb76d6`), 391/391 test, typecheck sạch. Review: `.ai/reviews/M4-review.md`. Đã merge vào `main` (`d297c72`, đã push). M5 (Inquiry) **xong** trên nhánh `feat/m5-inquiry`: 7 task + lượt sửa sau review toàn nhánh (F1–F8), đã gộp `main` hai lần (VNX-0708 ở `1f5ddc7`; VNX-0705a ở `482ef50`, hợp nhất hai cron thành một), 534/534 test, typecheck sạch. Review: `.ai/reviews/M5-review.md`. Đã merge vào `main` (`815e06e`, đã push). VNX-0508 (Privacy cho Inquiry và Turnstile) **xong**, đã merge vào `main` (`bcf95c6`, đã push). M6 (Request) **xong** trên `feat/m6-request` (xem dòng M6). Lát mỏng EPIC 21 **xong** trên `feat/epic21-partner-slice` (xem dòng đầu).
- **Deploy:** không có workflow nào tự deploy khi push; production chạy `main` `d447cf4` (version `411e3c9f`, xem dòng Production lần 3).
- **Monetization (2026-10-04):** audit + Owner trả lời Q1–Q9; ADR-007/008/009 **Accepted** và phụ lục spec **Approved** (Owner duyệt văn bản 2026-10-04). Code theo lịch: `/go/` ở M7 (VNX-0707), phần còn lại ở EPIC 21–24. **Partner đầu tiên:** ElevenLabs (PartnerStack), sổ ở `docs/partners/registry.md`; lát mỏng EPIC 21 (phụ lục mục 3.8) làm ngay sau VNX-0708, xong 2026-10-05 (xem dòng đầu).
- **Landing định vị (VNX-0708):** **xong** trên nhánh `feat/vnx-0708-landing` (worktree `.claude/worktrees/agent-a26fce7bca484621a`): 405/405 test, typecheck sạch, review APPROVE sau lượt sửa F1–F3 (`.ai/reviews/VNX-0708-review.md`). **Đã merge** vào `main` (`e4a932d`) và lên GitHub qua PR #2 (`ade9f4f`). Go-live: điều kiện deploy `main` đầy đủ + OQ-1 (`/privacy`) còn mở.
- **Prototype giao diện:** https://claude.ai/artifact/SkuTz2YbCgoyX2aH5NgZSm (riêng tư).

## Task

| Task | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| VNX-0001 Commit nền | ✅ | 9f0c7bd | trên `main` |
| VNX-0002 Toolchain | ✅ | 25b9d9f | Vitest 4.1 + pool 0.22; test dùng compatibilityDate 2026-08-01 |
| VNX-0003 Khung Hono | ✅ | f805507 | `run_worker_first: true` |
| VNX-0004 CI | ✅ | ac27cc1 | PR #1: `test` và `gitleaks` xanh; `dependency-review` lỗi do repo chưa bật Dependency graph |
| VNX-0005 Blueprint | ✅ | 48e3075 | |
| VNX-0101 ULID, văn bản thuần | ✅ | 314a2ff | |
| VNX-0102 i18n | ✅ | 2c3ad28, 1b303a2 | root `/` đăng ký cả `/vi` và `/vi/` |
| VNX-0103 Layout, trang lỗi | ✅ | 617fe3b | |
| VNX-0104 Danh tính, rate limit | ✅ | bc9e380, 8b2faed | email lowercase ở repo + CHECK |
| VNX-0105 Mailer | ✅ | 5d26b2b, f29ae6d | fail closed khi thiếu cấu hình |
| VNX-0106 Token, session, middleware | ✅ | 882c2e6, da51843 | token gắn purpose; lỗi D1 → ẩn danh |
| VNX-0107 Route đăng nhập | ✅ | a0a9e71, 4457c58, cdfd16f | `next` chặn open redirect |
| Sửa sau review toàn nhánh | ✅ | a1015ac | |
| Merge M0–M1 vào `main` | ✅ | 368cc1a | PR #1, merge commit (giữ SHA các task) |
| VNX-0201 Dữ liệu và domain builder | ✅ | 364b1d8 | migration `0004_builders`; test sở hữu bảng |
| VNX-0202a Invite qua magic link | ✅ | eb4df42 | cookie `__Host-vnx_invite` chứa hash; `requireUser` giữ query |
| VNX-0202b `/hub/apply` | ✅ | 8a1c561 | invite hợp lệ → approved, trừ lượt trong cùng D1 batch |
| VNX-0203a Hub, hồ sơ, gửi duyệt lại | ✅ | cc52e8b | handle khóa sau khi duyệt |
| VNX-0203b Portfolio | ✅ | 8465b4f | ≤ 12 mục, giới hạn kiểm trong cùng câu INSERT |
| VNX-0204 `/b/:handle` | ✅ | 1d6b4b8 | chỉ builder approved + tài khoản active; còn lại 404 |
| VNX-0205a Admin duyệt builder | ✅ | d595e2c | email theo locale; gửi lỗi không hoàn tác |
| VNX-0205b Admin invite | ✅ | 2dc5b78 | link hiện một lần; test cổng ra M2 |
| VNX-0205c Khóa builder/user; đồng bộ admin | ✅ | 98df068 | `ADMIN_EMAILS` cấp và thu quyền |
| Sửa sau review toàn nhánh M2 | ✅ | 6cc9974 | link Hub ở header, CRLF, khóa user nguyên tử, a11y portfolio |
| Merge M2 vào `main` | ✅ | 3bde074 | merge commit, đã push |
| VNX-0301 Dữ liệu product | ✅ | 4268fd5 | migration `0005_products`; 1 huy hiệu hiệu lực mỗi loại (partial unique index) |
| VNX-0303 Editor 8 bước văn bản | ✅ | ec35b48 | form sinh từ `STEP_FIELDS`; slug khóa sau publish |
| VNX-0302 Ảnh R2, `/media/*` | ✅ | c287860 | magic bytes, ≤2 MB, ≤8 ảnh |
| VNX-0304a Pricing | ✅ | bef2f87 | ≤5 tier, cent USD |
| VNX-0304b Điều kiện submit, vòng đời | ✅ | 4f342e3 | submit / rút lại / ẩn / hiện / lưu trữ |
| VNX-0305a Admin duyệt product | ✅ | cd192e6 | huy hiệu `listed`, email |
| VNX-0305b Huy hiệu, mới chỉnh sửa | ✅ | 45089a1 | evidence / lý do bắt buộc |
| VNX-0306 `/p/:slug` | ✅ | 96511bc | Open Graph, JSON-LD đã escape |
| Sửa sau review toàn nhánh M3 | ✅ | 45b07a1 | thu hồi Demo verified và duyệt + `listed` chạy trong một `db.batch`; admin thấy mọi trường công khai |
| VNX-0307 Bucket R2 | ⏳ | — | chờ Owner bật R2 |
| Merge M3 vào `main` | ✅ | fe87caa | merge commit, đã push |
| VNX-0401 FTS5, xếp hạng | ✅ | fc63649 | migration `0006_catalog` (FTS5 trigram, trigger đồng bộ); `published_at` chỉ đặt khi duyệt; `RETURNING id` thay `meta.changes` |
| VNX-0404a Canonical, hreflang | ✅ | d4d17ef | `siteOrigin` (`APP_ORIGIN`); trang `noindex` không canonical / hreflang |
| VNX-0402 `/products` | ✅ | eb849d0 | bộ lọc, phân trang 24, test cổng ra M4 qua HTTP |
| VNX-0403 `/builders` | ✅ | b7d6963 | `open` trước, rồi số product, rồi mới duyệt |
| VNX-0404b `sitemap.xml`, `robots.txt` | ✅ | 93f6f08 | 4 locale + `x-default`; `Allow: /media/products/`, `Disallow: /go/` |
| Sửa sau review toàn nhánh M4 | ✅ | bcb76d6 | thứ tự deploy có `0006_catalog`; timeout test nặng; kiểm cột trả tiền cả `ALTER TABLE` |
| Merge M4 vào `main` | ✅ | d297c72 | merge commit, Owner duyệt 2026-10-04; đã push |
| VNX-0708 Landing định vị | ✅ | 2b78709, fb2ac44, 615ca6f, f5e7b56 | `/` SSR 4 locale, waitlist client (persona `client`), gỡ `/api/waitlist` JSON và `public/index.html`; sửa F1–F3 (referrer qua `ref`, `www.` nội bộ, giữ tick đồng ý) |
| Merge VNX-0708 vào `main` | ✅ | e4a932d, ade9f4f | merge commit; lên GitHub qua PR #2 (merge `ade9f4f`, CI `test` + `gitleaks` xanh, `dependency-review` đỏ do chưa bật Dependency graph) |
| VNX-0501 Dữ liệu, state machine Inquiry | ✅ | 1f44f3c, d0a1d82 | migration `0007_inquiries`; thêm `client_name`, `opened_at`, `kind`, `notify_attempts` ngoài spec 6.1 (plan duyệt) |
| VNX-0504 Email thông báo, gửi lại | ✅ | 24adf04, a7e0db8 | `notify/` không bao giờ ném lỗi; tối đa 3 lần, lần 3 ghi audit |
| VNX-0506 Trang xác nhận `/auth/verify` | ✅ | ed2edc6 | GET chỉ xem token, nút POST mới tiêu |
| VNX-0502 Form Inquiry | ✅ | 94ffd27, 12fc174 | Turnstile fail closed, honeypot, rate limit; không lộ email đăng nhập của builder |
| VNX-0503a Hộp thư Hub | ✅ | 2fc9e2c | trả lời / từ chối / đóng; `Cache-Control: no-store` cho `/hub`, `/me`, `/admin` |
| VNX-0503b `/me`, admin Inquiry | ✅ | 625436b | test cổng ra M5 qua HTTP |
| VNX-0505 Cron hằng ngày | ✅ | 3a698e4 | nhắc 3 ngày, báo admin 7 ngày, gửi lại, xóa Inquiry chờ và tài khoản ngầm |
| Sửa sau review toàn nhánh M5 | ✅ | 86653c1, 8f5293e, 2c2fef0, cd420a1, 2174baa | "Gửi ngay" ở `/me`, trang link hết hạn theo locale, 5/giờ mỗi email, fake Turnstile chỉ khi mailer giả |
| Gộp `main` vào M5 | ✅ | 1f5ddc7, 482ef50 | VNX-0708; VNX-0705a (một cron `0 1 * * *`: bước M5 thêm vào danh sách bước của VNX-0705a) |
| Merge M5 vào `main` | ✅ | 815e06e | merge commit, Owner duyệt 2026-10-04; đã push |
| VNX-0508 Privacy cho Inquiry, Turnstile | ✅ | 7602983, 5750640 | Owner duyệt câu chữ; review `.ai/reviews/VNX-0508-review.md` APPROVE; merge `bcf95c6`, đã push |
| VNX-0507 Widget Turnstile | ⏳ | — | Owner tạo widget cho `vnx.si`, đưa site key; `wrangler secret put TURNSTILE_SECRET` |
| VNX-0705a Terms, Privacy, Media Kit + cron dọn dữ liệu | ✅ | ab11c0e, 2430868, 79eca5f | review APPROVE (`.ai/reviews/VNX-0705a-review.md`); 432/432; nội dung từ `docs/legal/*.md` (Owner duyệt); cron `0 1 * * *` xóa `rate_limits` > 2 ngày, token/session hết hạn. Merge vào `main` qua PR #3 (`19115d3`) |
| VNX-0709 Thiết kế lại đợt A (font, token, header, footer, logo B, landing v2) | ✅ | 953b507…628e61e | review APPROVE (`.ai/reviews/VNX-0709-review.md`); 468/468; font 344 KB tự host; `landing.js` 1.7 KB; audit `docs/design/2026-10-04-ui-audit-and-redesign.md`. Merge vào `main` qua PR #4 (`3169e6d`) |
| VNX-0710 Form liên hệ, `/admin/feedback` | ✅ | df893a0…c6fcf8b | migration `0009_feedback`; Turnstile ở khối "Ask us" của landing (F1); Privacy thêm form liên hệ. Merge qua PR #4 (`3169e6d`) |
| VNX-0711 Chạy khi chưa có R2 | ✅ | c86130a, 4b726ba | không có binding `MEDIA`: `/media/*` 404, upload / xóa ảnh 503; `r2_buckets` comment trong `wrangler.jsonc`. Merge qua PR #4 (`3169e6d`) |
| VNX-0601 Dữ liệu, state machine, điểm gợi ý request | ✅ | f7222e8, f91f587 | migration `0008_requests`; kiểu `ClientRequest` (không phải `Request`); chọn đề xuất có điều kiện bảo vệ lời mời và builder |
| VNX-0602a Email request, thông báo, `request_verify` | ✅ | 26cd57a | 9 email (thêm "lời mời đã kết thúc"); `builderFacingName` che tên giống email; `notify/request.ts` không ném lỗi |
| VNX-0602b Form `/request`, `/me`, lối vào, sitemap, Privacy | ✅ | e381bcf, 75d0bb3, a32f397 | Turnstile fail closed, 3/ngày mỗi email, 10/giờ mỗi IP; nút "Post a request" ở `/builders`, `/products` rỗng, landing; `/request` trong sitemap; bỏ email kết thúc cho builder không công khai |
| VNX-0603 Hàng chờ admin, gợi ý, mời | ✅ | b217503 | cổng 5 lời mời nằm trong câu `INSERT`; gợi ý theo 5 luật §8.10; spam → `removed` |
| VNX-0604 Lời mời trong Hub, đề xuất, từ chối | ✅ | d484b16 | `ANSWERABLE` (lời mời `invited`, request `matching`, builder công khai) |
| VNX-0605 + 0605b Chọn đề xuất → Inquiry; che tên ở Inquiry | ✅ | 69069c8, a5c7554 | một batch: compare-and-set request, Inquiry `type = request`, tin nhắn đầu; test cổng ra M6 (`test/request-gate.test.ts`); 0605b che tên client ở mọi bề mặt Inquiry builder thấy (M5) |
| VNX-0606 Cron request | ✅ | 1d1ea62 | nhắc lời mời 3 ngày, hết hạn 7 / 30 ngày, xóa request chưa xác nhận 48 giờ; khóa builder / user → lời mời `expired` |
| Sửa sau review toàn nhánh M6 | ✅ | f9f895d, e08de3b, b66ce34, da2745f, 018f276, 9e83fd7, 6ecd24f, 53f8729 | F2 khớp kỹ năng Latin theo từ; F3 audit `request_invite.expire`; F4 cron xóa cả request / Inquiry đã gỡ mà chưa từng xác nhận; F5 giới hạn 5 chỉ đếm builder công khai (SQL + form admin); F7 khóa user → gỡ request đang mở; `deleteGhostUsers` xét `request_invites.invited_by`; email hết hạn gửi trước audit. 802/802 |
| Gộp `main` vào M6 | ✅ | 2865d7e | `origin/main` `d3d1f4f` (PR #4, #5); giữ cả hai phía ở `app.ts`, `db/audit.ts`, `AdminLayout`, landing, `privacy.md` / `content.ts` |
| Merge M6 vào `main` | ✅ | e9f53a2 | merge commit, Opus duyệt theo ủy quyền Owner; đã push. Deploy cần `db:migrate:remote` (`0008_requests`) trước |
| VNX-2101 Cờ tính năng, `/admin/flags`, test kiến trúc "ranking không đọc tiền" | ✅ | 116f840, 5524440, 55d80ef | `116f840` plan + sửa phụ lục 2026-10-05; migration `0010_feature_flags`; cache 60 s, đọc lỗi → tắt; audit có guard `write_id` |
| VNX-2102a-1 Luật URL, template, form merchant (thuần) | ✅ | c7d2478 | một cổng `validateFinalUrl` cho mọi URL đích, lúc lưu và lúc redirect |
| VNX-2102a-2 Luật chương trình, offer, `resolveOfferRedirect` | ✅ | 30a41d0, 2168d08 | `2168d08` sửa chung 2102a-1/2: kiểm lại template đã lưu khi redirect, template rỗng = thiếu |
| VNX-2102a-3 Schema partner, db merchant / chương trình | ✅ | bd49f20 | migration `0011_partners`; CHECK chương trình `active` cần terms và `type != 'direct'`; không DEFAULT điều khoản |
| VNX-2102a-4 db offer, đọc cho redirect | ✅ | 6a33015 | `setDefaultOffer` ở `db/merchants.ts` (module sở hữu bảng) |
| VNX-2102b-1 Admin merchant, chương trình | ✅ | 9a3c4fc | merchant mới mặc định `paused`; slug bất biến |
| VNX-2102b-2 Admin offer, xem trước URL, offer mặc định | ✅ | 488df8c | xem trước URL tracking và URL fallback cạnh nhau |
| VNX-2103-1 `outbound_clicks`, giữ 13 tháng, Privacy khối C | ✅ | 0d859c4, 4d8e251 | `0d859c4` câu chữ Privacy (Owner duyệt); migration `0012_outbound_clicks`; cron xóa sau 395 ngày |
| VNX-2103-2 `/go/:merchantSlug`, `/go/o/:offerId` | ✅ | 8a2013c, e4198cc | `e4198cc` sửa chung 2103-1/2: `referrer_host` null cho IP literal, assert header 405; GET ghi click, HEAD không |
| VNX-2104a `/tools/:slug`, câu disclosure, luật sitemap | ✅ | f59c4b8, d83bb72 | `noindex` tới khi `content_indexing` bật và `indexable = 1`; `d83bb72` ghim câu khối A, reset cờ |
| VNX-2104b `/disclosure` | ✅ | cd57462, 3fff6f5 | `cd57462` nguồn `docs/legal/disclosure.md` (khối B); danh sách merchant `active` có chương trình `active` |
| Gộp `main` vào EPIC 21 | ✅ | e77c769 | `origin/main` `b60d8ed` (PR #6 bật R2, PR #7 tài liệu deploy); giữ `r2_buckets` MEDIA |
| Gộp `main` vào EPIC 21 (lần 2) | ✅ | 9760016 | `origin/main` `2ed46f4` (PR #8 Ops console); lấy bản của `main` cho file Ops; nhánh vẫn có `703f5b3` (Owner giữ) |
| Merge EPIC 21 vào `main` | ✅ | 7622105 | merge commit, Opus duyệt theo ủy quyền Owner; đã push. Chưa deploy |
| VNX-2501 `ops_members`, `ops_member_invites`, domain quyền | ✅ | 14e1d2d, 3dd0c96 | migration `0013_ops_members`; review `.ai/reviews/VNX-2501-review.md` APPROVE (F1 lời mời hết hạn chưa quét → xử lý ở 2506) |
| VNX-2502 `requireOps`, 404 kín, header Ops, robots | ✅ | 001a733 | review `.ai/reviews/VNX-2502-review.md` APPROVE; F3 `/{locale}/ops*` → 2508 |
| VNX-2503 Khung Ops + Overview | ✅ | 114abab, 750b494, 113637a | `ops.*` chỉ ở `en.ts`; review `.ai/reviews/VNX-2503-review.md` APPROVE |
| VNX-2504a Ops Builders | ✅ | bb31d3b, 330dd0b | `decideBuilder` dùng chung với `/admin`; review `.ai/reviews/VNX-2504a-review.md` APPROVE (9e3f55d) |
| VNX-2504a2 Ops Products | ✅ | 3c5b05c, a6105bb, 8b3f806 | review `.ai/reviews/VNX-2504a2-review.md` APPROVE (c0cd765) |
| VNX-2504b Ops Requests | ✅ | 659ce10, a327a6c | review `.ai/reviews/VNX-2504b-review.md` APPROVE (d1a0289) |
| Merge phần đầu Ops O1 vào `main` | ✅ | d447cf4 | PR #10 (nhánh `release/ops-o1-a`, `0ce5f83`), Owner merge; 2504c ở lại `feat/ops-o1` |
| Deploy `main` (EPIC 21 + VNX-0803 + Ops O1 phần đầu) | ✅ | d447cf4 | `db:migrate:remote` `0010`–`0013` rồi deploy, version `411e3c9f`; smoke local + production |
| VNX-2105 Trang tool dẫn sang builder, product, request | ✅ | dbfcb61 (plan), 654cd71, bdfbdf7, 60bd5d0, d26f00e, d3611e9, d1d6c60 | lọc `tool` nội bộ (không đọc từ URL) trên `searchBuilders`/`searchProducts`, khớp chính xác `COLLATE NOCASE`, thứ tự organic giữ nguyên (ADR-004); tách `BuilderCard`; 6 khóa `tools.*` × 4 locale; review APPROVE (`.ai/reviews/VNX-2105-review.md`, F1–F7 đã sửa). Nhánh `feat/vnx-2105-2508a`, chưa merge |
| VNX-2508a Ops Merchants (`/ops/monetization/merchants`) | ✅ | cc0c089, 4d89c98, 39e1f96, 8bbf315 | phần Merchants của VNX-2508 làm trước (Owner); tách action và thân view dùng chung với `/admin/merchants` (HTML `/admin` không đổi); History; `MONEY_ALLOWED` thêm `routes/ops-monetization.tsx` + assertion chặn import vòng qua `admin-merchants.tsx`; review APPROVE (`.ai/reviews/VNX-2508a-review.md`). `/admin/merchants` giữ tới phần còn lại của 2508. Chưa merge |

## Việc của Owner trước khi bật ElevenLabs

Đã deploy EPIC 21 (2026-10-06, `411e3c9f`; D1 production có `0001`–`0013`). Lần deploy sau: migration mới nào thì `db:migrate:remote` trước rồi deploy ngay.

Owner, trước khi ElevenLabs chạy thật:
- Rule Rate limiting của Cloudflare cho `vnx.si/go/*` (Owner 2026-10-05, review F2); kiểm gói D1 của tài khoản.
- VNX-0803-fix nên vào trước khi `/go/` chạy thật; sau đó kiểm `/go/` vẫn trả `Referrer-Policy: origin`.
- Rotate secret theo VNX-0803 F1 (`RESEND_API_KEY`, `TURNSTILE_SECRET`; xem "Owner (bảo mật)" ở Nghĩa vụ).
- Trong admin: tạo merchant ElevenLabs (mặc định `paused`), mô tả tiếng Anh; chương trình nhập `terms_url` và `terms_verified_at` rồi chuyển `active`; offer `try_it` có `destination_url` = `https://elevenlabs.io`, template = link PartnerStack (`https://try.elevenlabs.io/7fnly5cv33k3`); đặt làm offer mặc định; chuyển merchant `active`.
- Bật cờ `affiliate`.
- Giữ cờ `content_indexing` tắt lúc ra mắt (`noindex`).

## Quyết định phát sinh

- **Owner (EPIC 21):**
  - 2026-10-05: duyệt nguyên văn câu chữ khối A (disclosure trên `/tools`), B (`/disclosure`), C (Privacy).
  - 2026-10-05: `/tools/elevenlabs` `noindex` và ngoài sitemap lúc ra mắt, tới khi bật cờ `content_indexing` **và** đặt `indexable = 1`. Thêm nhãn offer `try_it` ("Try {name}", lệch phụ lục 3.2).
  - 2026-10-05: offer không tracking được → fallback về `merchants.website_url` (vẫn qua luật URL và `allowed_hosts`, không thì 404; lệch phụ lục 3.3), và fallback vẫn ghi một dòng `outbound_clicks` (không có `click_id` gửi partner). Giữ `outbound_clicks` 13 tháng (chốt phụ lục §9).
  - 2026-10-05: Privacy §10: khối C không phải "thay đổi quan trọng" → chỉ đổi ngày, không gửi thông báo. `LEGAL_UPDATED_AT` giữ `2026-10-05`.
  - 2026-10-05: giữ commit `703f5b3` (tài liệu Ops console) và merge cùng EPIC 21.
  - 2026-10-05: review F2 (ghi D1 hàng loạt qua `/go/`) xử lý bằng rule Rate limiting Cloudflare cho `/go/*`, không đổi code; làm trước khi bật ElevenLabs.
  - 2026-10-05: hoa hồng khi builder tự gắn chương trình affiliate của chính họ (phụ lục §9) để tới VNX-2107+.
- **Reviewer (EPIC 21):**
  - Mô tả merchant một bản tiếng Anh cho cả 4 locale, bọc `lang="en"` trên trang không phải `en`.
  - Offer hoặc merchant `archived` → 404, không ghi click (chặt hơn phụ lục). Merchant `archived` và chương trình `ended` là trạng thái cuối.
  - Chương trình `type = direct` không `active` được trong lát mỏng (ADR-007 luật 9: chưa có cờ), ép ở domain và CHECK.
  - Slug merchant bất biến sau khi tạo (cùng tiền lệ handle builder, slug product). Merchant mới tạo qua admin mặc định `paused`.
  - Luật `kind` của offer: `affiliate` / `referral` cần chương trình; `official` / `trial` không cần chương trình; `sponsored` bị từ chối tới EPIC 23 (ADR-008).
  - Dữ liệu hỏng (chương trình thiếu / khác merchant, template thiếu, URL đã lưu không hợp lệ…) → 404 kèm log `go.corrupt_data` (không có IP / UA / referrer).
  - Audit của cờ và bảng partner có guard `write_id` (cột trong `0010`, `0011`), mutation và audit cùng `db.batch`.
  - `outbound_clicks` không có FK (log chỉ thêm; product xóa được, offer không bao giờ xóa).
  - `referrer_host` null cho IP literal, `localhost` (Privacy hứa "chỉ tên miền").
  - VNX-0803 (review và fix) bỏ khỏi phạm vi phiên này: phiên khác làm theo phân công của Owner.

- **Owner 2026-10-05 (Ops):** `/ops` trên cùng Worker, chỉ tiếng Anh (khóa `ops.*` chỉ ở `en.ts`); 4 vai trò Owner/Operator/Content/Viewer trong DB, `ADMIN_EMAILS` là Owner gốc không thể hạ/xóa; Operator không khóa Owner gốc; Monetization chỉ Owner; Owner gốc bị khóa thì mất Ops; Content chỉ thấy số đếm tổng hợp trên Overview; mọi lần từ chối do bảo vệ Owner gốc luôn ghi audit.

- **Owner (M6):**
  - 2026-10-04: Opus duyệt plan và khắc phục thay Owner; merge + push sau khi milestone được APPROVE.
  - 2026-10-04: thêm email thứ 9 "lời mời đã kết thúc" gửi builder. Tên client trông giống email bị che trên mọi bề mặt builder thấy. Không gửi email kết thúc khi lời mời hết hạn vì builder / user bị khóa (chỉ khi quá hạn hoặc request kết thúc).
  - 2026-10-04: điểm trừ −1 của §8.10 chỉ tính lời mời quá hạn không trả lời (7 ngày), không tính lời mời hết hạn vì request kết thúc sớm. Gỡ request `builder_selected` thì giữ Inquiry (cuộc trao đổi độc lập).
  - 2026-10-05 (sau review toàn nhánh): F7 khóa user → các request `submitted` / `matching` của họ thành `removed` trong cùng batch, builder nhận email kết thúc như luồng spam. F4 cron xóa request và Inquiry chưa từng xác nhận sau 48 giờ, kể cả khi đã bị gỡ. F2 kỹ năng chữ Latin khớp nguyên từ, chữ CJK giữ khớp chuỗi con.
- **Reviewer (M6):**
  - Plan Task 2–7 viết ngay trước mỗi task (từ code thật); planner được dùng lại làm implementer cho chính task đó. Trailer commit ghi đúng model đã viết commit.
  - Kiểu domain đổi `Request` → `ClientRequest` (tránh trùng `Request` của Fetch). Chọn đề xuất kiểm lời mời `proposed`, cùng request, builder công khai ngay trong SQL compare-and-set (sửa ở Task 1).
  - Che tên: một helper `builderFacingName` (kiểu `BuilderFacingName`), áp cho cả bề mặt Inquiry M5 builder thấy; chỉ che tên, không lọc nội dung tự do (tiêu đề, mô tả, tin nhắn).
  - Mọi email kết thúc gửi builder (`invite_expired`, `not_selected`) bỏ qua builder không công khai (`publicBuilderOnly`), mở rộng luật Owner sang `not_selected`.
  - Quá hạn (điểm trừ) = lời mời `expired` có `updated_at − invited_at ≥ 7` ngày; lời mời còn `invited` khi request kết thúc từ ngày 7 trở đi cũng tính.
  - Hạn 7 ngày (lời mời) và 30 ngày (ghép) là hạn mềm: vẫn nhận trả lời tới khi cron hằng ngày cho hết hạn (trễ ≤ 24 giờ).
  - Client mở request đã bị gỡ (kể cả `builder_selected`) → 404; Inquiry vẫn còn.
  - VNX-0602 tách 0602a / 0602b (roadmap đã ghi); thêm 0605b (che tên ở Inquiry), cùng implementer với 0605, review chung.
  - F3: mọi lời mời hết hạn do hệ thống (cron, khóa builder, khóa user) ghi audit `request_invite.expire` (`reason` `lapsed` / `builder_inactive`); email hết hạn gửi trước, audit lỗi không chặn email. F5: giới hạn 5 lời mời chỉ đếm lời mời của builder công khai (cả SQL lẫn form admin). F8 giữ nguyên: builder bị khóa vẫn đọc lời mời của mình. Ruling cũ "request của client bị khóa vẫn chạy" thay bằng quyết định F7 của Owner.

- **Owner 2026-10-04 (M5):** Turnstile do Owner tạo widget, thiếu khóa thì form chưa đăng nhập đóng (fail closed); chỉ người chưa đăng nhập qua Turnstile; tài khoản ngầm chưa xác nhận bị xóa sau 48 giờ; builder thấy tên client gõ trên form (`client_name`), không thấy email. Sau review toàn nhánh: nút "Gửi ngay" ở `/me` cho Inquiry chờ xác nhận (phiên đăng nhập đã chứng minh email); 5 lần/giờ mỗi email cho email xác nhận khi chưa đăng nhập.
- **Reviewer (M5):** form chưa đăng nhập trả cùng trang "kiểm tra email" cho email của builder, tài khoản bị khóa, honeypot và quá giới hạn email (không lộ trạng thái tài khoản); `notifyInquiryMessage` không bao giờ ném lỗi; driver Turnstile giả chỉ có hiệu lực khi `MAIL_DRIVER=fake`; builder bị khóa không trả lời / từ chối / đóng được; khi gộp VNX-0705a, giữ khung cron và hàm dọn dữ liệu của VNX-0705a (`deleteExpiredLoginTokens`, `RATE_LIMIT_KEEP_SECONDS` 2 ngày), thêm các bước M5 vào danh sách bước (khác gợi ý trong `.ai/reviews/VNX-0705a-review.md` mục "Xung đột", cùng hành vi; theo comment của chính `jobs/daily.ts` bên VNX-0705a).

- **Owner 2026-10-04 (landing + partner đầu tiên):** bỏ ý định làm homepage M7 sớm; làm landing định vị VNX-0708 (CTA builder qua `/login` + waitlist client giữ bảng `waitlist`, khác spec 5.8). ElevenLabs hiển thị ở `/tools/elevenlabs` (không phải `/p/`); `/go/:merchantSlug` trỏ tới offer mặc định, cùng tồn tại với `/go/o/:offerId`; slug merchant không được là `p`, `o`; lát mỏng EPIC 21 làm sau VNX-0708, conversion/doanh thu xem tạm trên dashboard PartnerStack.

- **Owner 2026-10-04 (M4):** lọc giá bằng 2 ô "giá khởi điểm từ – đến (USD)" trên tier rẻ nhất có giá, không phân biệt `billing`; product chỉ có tier `contact` bị loại khi lọc giá; thẻ giữ "From $19" không ghi chu kỳ. Nút "Post a request" chưa có đến M6. Tìm tiếng Việt không dấu không hỗ trợ ở Wave 1. Sửa F1–F4 sau review toàn nhánh; F5 (`instr` cho danh bạ) để sau.
- **Reviewer (M4):** D1 cộng cả dòng trigger vào `meta.changes` → câu UPDATE `products` dùng `RETURNING` và đếm dòng trả về. Lọc huy hiệu khớp đúng loại (`in_production` không kéo theo `demo_verified`). Test "không có cột trả tiền" chỉ xét các bảng mà truy vấn xếp hạng đọc (ADR-008 sẽ có bảng chiến dịch riêng). `robots.txt` có `Disallow: /go/` theo spec 8.8 đã sửa. D1 từ chối mẫu `LIKE` > 50 byte: danh bạ cắt từ khóa còn ≤ 48 byte. Test nặng có timeout 30 s.

- **Owner 2026-10-04 (monetization):** audit ở `docs/strategy/2026-10-04-monetization-audit.md`. (Q1) listing bên thứ ba ở khu `/tools/:merchant` riêng, `/products` chỉ có product của builder; (Q2) sponsored là ô tách riêng có nhãn, không cộng điểm xếp hạng, cần ADR-008 thay một phần ADR-004, làm sau cổng ra Wave 1; (Q3) chốt kiến trúc ngay (ADR-007 + phụ lục spec trước M4), gộp `/go/` + outbound click vào M7 thay `/p/:slug/demo`, affiliate làm khi có hợp đồng partner thật; (Q4) cá nhân Owner nhận hoa hồng partner; (Q5) chỉ analytics nội bộ; (Q6) quảng cáo chỉ viết ADR; (Q7) lead dùng lại M6, chưa thu phí; (Q8) nội dung biên tập là markdown giới hạn, chỉ admin viết; (Q9) ngưỡng index: category ≥5, best list ≥5, alternatives ≥3, so sánh ≥2.

- **Owner 2026-10-04 (sau review M3):** (1) product đang công khai được phép rơi xuống dưới điều kiện submit (giữ như hiện tại; admin theo dõi qua "Mới chỉnh sửa"); (2) `published_at` chỉ đặt khi duyệt, ẩn/hiện lại hay mở khóa không đẩy product lên "mới nhất"; (3) `robots.txt` cho phép `/media/products/` để og:image hiện khi chia sẻ link.

- **Owner 2026-10-04 (M3):** product `in_review` bị khóa, có nút Rút lại (`withdraw` → draft); `primary_lang` gồm `en`, `vi`, `zh-Hans`, `zh-Hant`; Claude tạo bucket R2 sau khi Owner bật R2 (lần thử 2026-10-04 lỗi 10042: tài khoản chưa bật R2).

- Rate limit bằng bảng D1 `rate_limits` (Workers Rate Limiting binding chỉ có chu kỳ 10/60 giây).
- `consumeLoginToken(db, raw, now, expectedPurpose)`: token của mục đích khác không được dùng và không bị tiêu.
- `getMailer`: `fake` / `console` chỉ khi đặt `MAIL_DRIVER`; có `RESEND_API_KEY` → Resend; còn lại → báo lỗi, không log link.
- `originCheck` chấp nhận origin của URL request hoặc `APP_ORIGIN`.
- `safeNext` trả giá trị gốc sau khi qua mọi kiểm tra; chặn ký tự điều khiển, non-ASCII, `//`, `\`, dot-segment.
- Sau đăng nhập không có `next` → về `/` cho mọi locale (chưa có trang chủ theo locale đến M7).
- Lỗi 500 ở `/api/*` không trả chuỗi `error` tiếng Anh.
- Migration danh tính tên `0003_identity.sql`; các bảng sau dùng `0004+`.
- **Owner 2026-10-03 (M2):** `ADMIN_EMAILS` là nguồn sự thật cho quyền admin (cấp và thu ở mỗi lần đăng nhập; `requireAdmin` kiểm danh sách ở mỗi request). Handle builder khóa sau khi approved. Builder approved sửa hồ sơ thì lên ngay, không duyệt lại.
- Cookie invite đặt tên `__Host-vnx_invite` (spec ghi `vnx_invite`); chứa SHA-256 của code, không chứa code.
- Roadmap M2 tách 0202, 0203, 0205 thành a/b(/c) cho vừa ≤ 1 ngày.
- Khóa user: đổi trạng thái, xóa session và ghi audit chạy trong một `db.batch` (statement builder nằm ở module sở hữu bảng).
- Văn bản từ textarea được chuẩn hóa CRLF → LF trước khi kiểm độ dài.
- Header hiện link Builder Hub khi đã đăng nhập (người chưa là builder được đưa sang `/hub/apply`).

- **Owner 2026-10-07 (ADR-012, tài khoản liên kết):** ADR-012 **Accepted**: liên kết Google, GitHub, LinkedIn từ `/me`; đăng nhập phụ chỉ cho tài khoản đã liên kết chủ động (không tự liên kết theo email, không tạo tài khoản mới); huy hiệu GitHub/LinkedIn builder tự bật trên `/b/:handle`, không vào xếp hạng; `/ops` chỉ nhận session `magic_link`. Thay một phần ADR-002, bổ sung ADR-010. Wave 1, **EPIC 26** (VNX-2601…2608), bật cả ba provider cùng lúc. Câu chữ bổ sung Privacy/Terms đã duyệt, nằm ở cuối `docs/legal/privacy.md` và `terms.md`, **chưa áp dụng** (VNX-2607 chép vào và phải merge trước khi bật flag). ADR-011 còn trống vì bản nháp `ADR-011-admin-access-layer.md` chưa commit ở `vnxsi-0803b`.

## Nghĩa vụ để lại
- **Owner (ElevenLabs, 2026-10-06):** sửa ô Description của merchant ElevenLabs ở `/admin/merchants` (hoặc `/ops/monetization/merchants` sau khi deploy nhánh này) thành bản dưới. Bản này bỏ đoạn disclosure 4 thứ tiếng, vì câu disclosure đã dịch sẵn nằm trên khối offer; giữ câu nhãn hiệu. Mục đích: `meta description` và phần xem trước khi chia sẻ link bắt đầu bằng nội dung thật.

  ```
  ElevenLabs is a voice AI platform for text to speech, voice cloning, dubbing and conversational voice agents, available as an app and through an API.

  - Narrate articles, courses and videos in many languages
  - Add a voice assistant to a support or sales flow
  - Build voice into your own product through the API

  ElevenLabs and the ElevenLabs logo are registered trademarks or trademarks of ElevenLabs, Inc. Used with permission. VNX.SI is not sponsored by, endorsed by, or affiliated with ElevenLabs except as an independent participant in the ElevenLabs Creator Affiliate Program.
  ```
- **Merge `feat/vnx-2105-2508a` (Owner quyết):** không migration. Thử `git merge-tree` với `feat/ops-o1` (`37969f7`) đã thấy xung đột ở `test/ops/layout.test.ts`, `test/http/security-headers.test.ts`; dòng union `OpsIcon` trong `src/ops/menu.ts`, `OPS_MENU`, `OpsLayout.tsx` (icon), `en.ts`, `app.css`, `app.ts` cũng bị cả hai nhánh sửa. Nhánh merge sau gộp, giữ cả hai phía (chỉ là thêm dòng).
- **Phần còn lại của VNX-2508:** chuyển hướng `/admin/merchants*` → `/ops/monetization/merchants*` (route Ops đã có), và `/admin/flags` → `/ops/settings/feature-flags` (chưa có).
- **Builder dùng ElevenLabs:** khối builder/product trên `/tools/:slug` chỉ khớp khi `ai_tools` / `tech_stack` ghi đúng tên merchant (không phân biệt hoa thường). "Eleven Labs" hay "ElevenLabs API" không khớp.
- ~~**Deploy M6:** `npm run db:migrate:remote -w apps/web` (`0008_requests`) rồi `npm run deploy`~~ Đã deploy 2026-10-05 (`3c77ac5`, xem Tóm tắt).
- ~~**Deploy EPIC 21**~~ Đã deploy 2026-10-06 (`d447cf4`, `411e3c9f`). Còn các bước Owner trước khi bật ElevenLabs (mục "Việc của Owner trước khi bật ElevenLabs").
- **Owner (zone vnx.si):** `robots.txt` đang là bản Cloudflare Managed (AI Crawl Control), chặn các crawler AI và cả Baiduspider, PetalBot (máy tìm kiếm Trung Quốc), trong khi site có `/zh-hans`, `/zh-hant`. `User-agent: *` vẫn `Allow: /`. Owner quyết giữ hay bỏ chặn hai bot tìm kiếm này.
- **Quyền phiên Claude:** auto mode chặn `npm run deploy` và việc đọc token GitHub để tạo PR; Owner tự push / merge / deploy, hoặc thêm quyền.
- **Reviewer (tài liệu M6, còn treo):** ARCHITECTURE §2 dòng `notify/` ghi thêm M6 (`notify/request.ts`, gửi một lần, không có cột gửi lại).
- **Mọi thông báo mới gửi builder khi lời mời / request kết thúc:** phải đi qua `publicBuilderOnly` (bỏ qua builder không công khai); không tự có.
- **M7 (sau EPIC 21, `.ai/reviews/EPIC21-partner-slice-review.md`):**
  - Route `/go/p/:slug/{demo,site}` đặt **trước** catch-all `app.get("/go/*")` trong `routes/go.ts`, nếu không catch-all che route mới; sửa test `go.test.ts` đang chờ `/go/p/…` trả 404. Dùng lại `outbound_clicks`, không migration mới cho bảng này.
  - Thêm `visitor_hash` (HMAC, `ANALYTICS_SALT`) thì sửa câu Privacy "for now we do not link it to any visitor identifier" (Owner duyệt câu chữ).
  - Thay `isBotRequest` (`domain/outbound.ts`) bằng luật bot chung của spec 8.11.
  - File Trending / Top mới vào `RANKING_FILES` của test kiến trúc (và `MONEY_ALLOWED` nếu cần); làm review F6 (đối chứng dương, regex SQL không phân biệt hoa thường) trước.
  - Migration mới bắt đầu sau `0012`: `0013` đã dùng cho Ops O1; `0014`–`0016` để dành cho M7; O2 bắt đầu từ `0017`.
- **VNX-2105+ (phần còn lại của EPIC 21):** HEAD trên offer có tracking trả `click_id` mà không có dòng `outbound_clicks`: khi ghép conversion coi `click_id` lạ là "không ghép được" hoặc ghi dòng cho HEAD (Owner chọn khi lập plan). `test/monetization/conversions.test.ts` theo ADR-007; `conversions`, `revenue_entries` vào `WRITERS`. Tham số sub-id PartnerStack cho `{click_id}`; offer của product, Hub "Quản lý offer", logo merchant.
- **ADR-010 (Ops O1):** chuyển `/admin/flags`, `/admin/merchants` vào `/ops/monetization/*`, chỉ Owner dùng.
- **Ops O1 (còn lại, nhánh `feat/ops-o1`):** 2504c Inquiries + Invites (tab Overdue dùng đúng luật của thẻ Overview; link mời chỉ hiện một lần); 2505 Users + Feedback (Operator không khóa được Owner gốc, luôn audit); 2506 Team & roles (lời mời 7 ngày, kích hoạt khi verify magic link; F1 của 2501: lời mời `pending` đã quá hạn được đánh dấu `expired` + audit + tạo lời mời mới trong một batch; guard audit cho bảng mới trong `db/audit.ts`); 2507 Audit log; 2508 chuyển hướng `/admin` (allowlist query, link email/cron sang `/ops`, `/{locale}/ops*` → 404 kín, `/admin/flags` → `/ops/settings/feature-flags`, `/admin/merchants` → `/ops/monetization/merchants` chỉ Owner); 2509 rà giao diện/a11y.
- **Hợp đồng `isStaff` với M7 (vnxsi-c9):** nhánh nào vào `main` sau thì đặt `isStaff = isAdminUser(user, env) || (await resolveOpsRole(env, user)) !== null`, thêm test thành viên Viewer không bị đếm, không nới `requireAdmin` qua `isStaff`.
- **EPIC 22 / 23 / VNX-0801:** quyền sở hữu bảng `content` trong test kiến trúc; mô tả merchant dạng markdown; ô sponsored và cờ `sponsored_listings` (ADR-008); bản dịch zh của `/disclosure` và Privacy.
- **Lần đầu bật `content_indexing`:** chờ 1 giờ hoặc purge cache `/sitemap.xml` trước khi gửi sitemap cho Search Console (review F7).
- **M7 (số liệu, Live, test kiến trúc tiền):**
  - "Request 30 ngày" đếm theo `requests.submitted_at`; bảng thước đo §3 (request đã gửi, tỷ lệ có ≥ 1 đề xuất, tỷ lệ chọn được builder) đọc thẳng `requests`, `request_invites`.
  - Dải Live đọc audit `request.submit`, `request.verify` (chỉ `category`, `languages`), chịu được dòng trùng hiếm (cùng mili giây).
  - Không dùng `closed_at` làm mốc kết thúc của request bị gỡ sau khi đã kết thúc (bị ghi đè).
  - "Top builder: được chọn" đếm `request_invites.status = 'selected'`; "trả lời nhanh" lấy `invited_at → responded_at`.
- **Trước khi số builder `approved` vượt 1000:** `listCandidates` lấy 1000 builder đầu theo `user_id` rồi mới chấm điểm; khi đó lọc hoặc chấm điểm trong SQL.
- **Owner (bảo mật, VNX-0803 F1 HIGH, Owner 2026-10-05: "làm sau"):** Resend API key đã dán vào hội thoại 2026-10-04 → thu hồi key trên Resend, tạo key mới, chạy lại `npx wrangler secret put RESEND_API_KEY` (trong `apps/web`). Tương tự Turnstile secret (cũng dán vào hội thoại): Rotate secret key ở widget `vnx.si`, rồi `npx wrangler secret put TURNSTILE_SECRET`. Làm trước khi bật ElevenLabs. Ghi ngày xoay vào đây khi xong.
- **M5 merge (thêm, VNX-0709):** `Layout.tsx`, `app.css`, 4 file i18n đã viết lại; class và biến CSS cũ còn (alias) nên view M5 không vỡ; gộp i18n theo key, footer test dùng `footer.company`.
- **Đợt B/C thiết kế:** catalogue, product, builder, Hub, Admin theo design system mới; thống nhất trọng lượng tiêu đề 600/700.
- **Go-live (Owner muốn sớm, 2026-10-04):** ✅ Email Routing `contact@vnx.si` → ✅ merge VNX-0705a (PR #3) → Owner bật R2 → `npx wrangler r2 bucket create vnxsi-media` → `npm run db:migrate:remote -w apps/web` → ✅ Resend domain `vnx.si` verified, ✅ secret `RESEND_API_KEY`, ✅ secret `ADMIN_EMAILS` = `thanhsu604@gmail.com` (2026-10-04) → Turnstile: ✅ widget `vnx.si` (site key `0x4AAAAAAFNhEcGnR8e56X8X`, vào `wrangler.jsonc` ở VNX-0710), ✅ secret `TURNSTILE_SECRET` (2026-10-04) → `npm run deploy` (đăng ký cron) → smoke `/`, `/vi`, `/terms`, `/privacy`, `/media-kit`, `/login`, `/robots.txt`, `/sitemap.xml`. OQ-1 của VNX-0708 đã đóng bằng VNX-0705a.
- ~~**M5 (merge sau VNX-0705a):** gộp cron theo `.ai/reviews/VNX-0705a-review.md` mục "Xung đột"~~ Đã gộp ở `482ef50` theo hướng ở mục Quyết định (Reviewer M5). Privacy cho Inquiry và Turnstile: xong ở VNX-0508. Ghi chú cũ: (lấy `jobs/daily.ts`, `index.ts` của M5; một hàm xóa token `deleteExpiredTokens`; giữ `rate_limits` 2 ngày trừ khi Owner chọn khác); cập nhật `docs/legal/privacy.md` + `src/legal/content.ts` cho Inquiry và Turnstile trước khi M5 lên production.
- **Mọi task thêm dữ liệu cá nhân/cookie (M5, M6, M7, EPIC 21):** sửa `docs/legal/privacy.md` và `src/legal/content.ts` trong cùng task.

- **M7 (VNX-0707):** secret mới `ANALYTICS_SALT`; thêm vào thứ tự deploy khi tới M7.
- **Owner (monetization Q4):** tự kiểm điều khoản từng chương trình partner (có cho cá nhân tham gia không, mẫu thuế, cách payout) trước khi bật trên production; khi lập pháp nhân (VNX-1401) thì chuyển hợp đồng.

- **Deploy sau khi merge M4:** áp `0006_catalog` cùng lúc với code M4 (ghi trong `wrangler.jsonc`). Trước lần `db:migrate:remote` đầu tiên: thử `0006_catalog` trên một D1 remote nháp (trigram, trigger, `json_each` trong trigger, `wrangler d1 export`).
- **M7:** `/`, `/for-builders`, `/terms`, `/privacy` vào sitemap kèm alternate; link header vào `<nav>`; nếu `/go/` có tiền tố locale thì `robots.txt` chặn cả các tiền tố.
- **M8 (runbook):** backup D1 khi có bảng ảo FTS5 (bỏ `products_fts` và trigger → export → tạo lại và backfill, hoặc dùng Time Travel).

- **Owner (VNX-0307):** bật R2 trên Cloudflare Dashboard (tài khoản `15385598…`); báo Claude để chạy `wrangler r2 bucket create vnxsi-media`. Cần trước lần deploy có M3.

- **Deploy sau khi merge M2:** `db:migrate:remote` phải áp cả `0004_builders` (đã ghi trong `wrangler.jsonc`).
- **Quyết định sau (ADR nhỏ):** hash invite đang vừa là khóa DB vừa là giá trị cookie, nên người đọc được D1/audit có thể tự duyệt builder; thiết kế lại (cookie ≠ khóa DB, hoặc HMAC) nếu cần.
- **VNX-0507 (Owner):** tạo widget Turnstile cho `vnx.si`, đưa site key để Claude đặt vào `wrangler.jsonc`; `wrangler secret put TURNSTILE_SECRET`. Thiếu thì form Inquiry khi chưa đăng nhập tự đóng.
- **M7:** đếm `inquiries` vào `product_daily_stats` khi Inquiry vào `open`; cron hằng giờ (`scheduled` hiện chỉ chạy job cho `0 1 * * *`).
- **M7:** độ tương phản `.error-msg` ở dark mode, vùng chạm 44 px cho brand/sign-in, skip link.
- **M8 (VNX-0804):** chuyển `www.vnx.si` → `vnx.si` (cookie `__Host-` gắn với host).
- **Owner:** bật Dependency graph tại https://github.com/thanhsu/vnxsi/settings/security_analysis để job `dependency-review` chạy được (token hiện tại không có quyền Administration). `gitleaks` đã xanh, không cần license.
- **Owner:** thu hồi / thay PAT GitHub đã dán vào hội thoại 2026-10-03, rồi cập nhật Git Credential Manager.
- Trước M8: người bản xứ đọc lại `zh-Hans`, `zh-Hant`.
- Trước Wave 3: nghiên cứu pháp nhân và cổng thanh toán.

- **EPIC 26 (ADR-012):** plan `docs/superpowers/plans/2026-10-07-vnxsi-epic26-linked-accounts.md` **Approved** 2026-10-07 (header + Task 1 VNX-2602; Opus review APPROVE_WITH_CHANGES, đã sửa F1–F10, S1, S2). Owner 2026-10-07: làm ngay, merge với cờ tắt, bật (VNX-2608) sau khi M8 ra mắt ổn định; email báo liên kết gồm provider + `label` + giờ UTC + contact@vnx.si. Lệch đã duyệt: (1) không kiểm JWKS cho ID token, kiểm `iss`/`aud`/`azp`/`exp`/`nonce` (lệch dòng roadmap VNX-2603); (2) liên kết: `start` trả trang trung gian 200 có link sang provider thay vì 302 (lệch chữ ADR-012 §4, vì CSP `form-action 'self'` chặn chuỗi redirect sau POST); (3) luật chỉ-magic-link áp cả `requireAdmin` (legacy `/admin`), không chỉ `/ops`. Câu chữ UI nguyên văn 4 locale chờ Owner duyệt theo từng task. **Tiến độ (nhánh `feat/epic26-linked-accounts`, worktree `D:\DOCS\SUPHAM\GITnxsi-epic26`):** VNX-2602 xong `635f9cc` (migration `0017_user_identities`, `db/identities`, `sessions.method`, 3 cờ `oauth_*`), review `.ai/reviews/VNX-2602-review.md` APPROVE. VNX-2603a xong `d481a3b` + sửa R1 `5f0efd2` (lõi OAuth thuần `domain/oauth.ts`, cookie `__Host-vnx_oauth`), review `.ai/reviews/VNX-2603a-review.md` APPROVE. VNX-2603b xong `7963d30` + sửa R1 `aed2ded` (port `ProviderClient`, adapter OIDC Google/LinkedIn, provider giả chỉ chạy khi `OAUTH_DRIVER=fake` và mail giả), review `.ai/reviews/VNX-2603b-review.md` APPROVE; 142 file / 1534 test xanh. Phát hiện quan trọng ở review plan: workerd không hỗ trợ `fetch(..., { redirect: "error" })`, đã đổi sang `"manual"` và từ chối mọi 3xx. VNX-2603c xong `46abadf` + sửa R1 `381f500` (adapter GitHub: `subject` là `id` số, `label` là `login` gồm cả login EMU có `_`, access token chỉ dùng cho một lần gọi `/user`), review `.ai/reviews/VNX-2603c-review.md` APPROVE (plan Task 4 do Owner duyệt trực tiếp vì lượt review plan bị ngắt khi phiên khởi động lại); 143 file / 1551 test xanh. VNX-2604a xong `c1aa5bf` + sửa R1 `d8bc5e1` (`requireOps` và `requireAdmin` chỉ nhận session `magic_link`; session `oauth_*` nhận 404 kín ở `/ops`, 403 ở `/admin`, vẫn dùng được `/me`, `/hub`), review `.ai/reviews/VNX-2604a-review.md` APPROVE; 144 file / 1561 test xanh. **Nghĩa vụ khi rebase lên M7:** xem mục "Nghĩa vụ để lại" của review VNX-2604a (kiểm `method` ở `requireAdmin`, không bao giờ ở `isAdminUser`; sửa ba đoạn chú thích trên nhánh M7; thêm test `isStaff` cho session `oauth_*`). **Owner 2026-10-08:** duyệt nguyên văn câu chữ Task 6 (VNX-2604b) ở 4 locale; zh-Hant dùng 連結 cho liên kết tài khoản (Task 8 `/me` dùng cùng từ); giữ "trang tài khoản" theo ADR-012, xem lại ở Task 8. VNX-2604b xong `bed2bdf` + sửa R1 `b2a806e` (route `GET /auth/oauth/:provider/start` và `/callback` cho intent `signin`, trang "chưa liên kết", trang lỗi; không tạo tài khoản, không tra lời mời Ops, cookie bị xóa ở mọi nhánh), review `.ai/reviews/VNX-2604b-review.md` APPROVE; 145 file / 1597 test xanh. Cờ `oauth_*` vẫn tắt, chưa có nút ở `/login` (Task 7). **Owner 2026-10-08:** nút đăng nhập ở `/login` tạm chỉ có chữ; logo chính thức (Owner cung cấp ở VNX-2601) vào bằng task mới **VNX-2604d**, là **điều kiện bắt buộc trước VNX-2608** (ADR-012 "Hệ quả": nút theo brand guideline của từng provider). Câu chữ nút duyệt nguyên văn: "Sign in with {provider}" / "Đăng nhập bằng {provider}" / "使用 {provider} 账号登录" / "使用 {provider} 帳號登入"; "or" / "hoặc" / "或". VNX-2604c xong `1dfc343` (nút chỉ chữ ở `/login`, là `<a>`, hiện theo cờ và cấu hình), review `.ai/reviews/VNX-2604c-review.md` APPROVE; 146 file / 1612 test xanh (chạy `npm test -- --maxWorkers=2` vì máy thiếu bộ nhớ ảo khi chạy song song mặc định). **Owner 2026-10-08 (Task 8):** duyệt nguyên văn câu chữ mục "Đăng nhập & tài khoản liên kết" ở `/me`, trang trung gian "Tiếp tục tới {provider}", bốn thông báo kết quả; thay câu `oauth.notLinked.body` của Task 6 để chỉ đúng mục trên trang "Yêu cầu và nhu cầu"; thông báo `taken` nói tài khoản đã liên kết với một tài khoản VNX.SI khác, kèm contact@vnx.si. **Lệch ADR-012 §4 (Owner duyệt):** mục ở `/me` chỉ hiện khi có ít nhất một provider dùng được hoặc user đã có tài khoản liên kết, không phải "cho mọi user"; hàng đã liên kết vẫn hiện khi cờ tắt để còn hủy liên kết. VNX-2605a-1 xong `6c63194` + sửa R1 `e410215` (mục "Đăng nhập & tài khoản liên kết" ở `/me`, `POST /me/identities/:provider/link`, trang trung gian "Tiếp tục tới {provider}"; callback chưa nhận liên kết), review `.ai/reviews/VNX-2605a-1-review.md` APPROVE; 148 file / 1639 test xanh. VNX-2608 phải kiểm tay trang trung gian, tải lại và Back trên Chrome, Firefox, Safari. VNX-2605a-2 xong `959c725` + sửa R1 `50263ed` (callback nhánh `link`: kiểm session trước `exchange`, không tạo hay đổi session, gọi `linkIdentity`, kết quả qua tập đóng `/me?link=`), review `.ai/reviews/VNX-2605a-2-review.md` APPROVE; 149 file / 1659 test xanh. Liên kết tài khoản chạy trọn vẹn sau cờ (đang tắt). **Owner 2026-10-10 (Task 9):** duyệt nguyên văn câu chữ nút hủy liên kết, hai thông báo, hai email báo liên kết và hủy liên kết (4 locale, kèm link thường tới `/me`); email hủy liên kết dùng "kiểm tra các tài khoản liên kết ở /me"; sau khi hủy liên kết cuối cùng khi mọi cờ tắt chỉ hiện xác nhận cho `unlinked`/`notLinked`. **Lỗ hổng mới, ngoài ADR-012:** hủy liên kết không kết thúc session đã tạo bằng provider đó (kẻ chiếm phiên giữ tới 30 ngày) → task mới **VNX-2605c**, **điều kiện bắt buộc trước VNX-2608**. VNX-2605b xong `a632c6a` + sửa R1 `cf875ab` (hủy liên kết ở `/me` luôn được phép kể cả khi cờ tắt; email báo liên kết và hủy liên kết chỉ tới `users.email` của chủ, theo `users.locale`, không token, chỉ link `/me` trơn; gửi lỗi không hoàn tác, log mã `notify_failed`), review `.ai/reviews/VNX-2605b-review.md` APPROVE; 151 file / 1690 test xanh. **Owner 2026-10-10 (Task 10–11, huy hiệu):** duyệt nguyên văn câu chữ công tắc ở `/hub` và huy hiệu công khai; tắt cờ provider thì ẩn luôn huy hiệu và công tắc của provider đó (không đổi `show_on_profile`); login GitHub EMU vẫn có link theo ADR-012 §5, xem lại khi thử thật ở VNX-2608. **Rebase lên `main` (đã có M7 `38bf414`):** giữ 7 file `RANKING_FILES` của M7 trong `architecture.test.ts`, mở rộng test huy hiệu tới Top builders (`topBuilders(loadBuilderTallies(...))`), cùng các nghĩa vụ rebase của VNX-2604a. VNX-2606a xong `bdc2860` (công tắc huy hiệu ở `/hub/profile`, `POST /hub/identities/:provider/badge`, audit `{provider}`), review `.ai/reviews/VNX-2606a-review.md` APPROVE; 152 file / 1711 test xanh. VNX-2606a R1 `8b38931` (chỉ test). VNX-2606b xong `0150237` (huy hiệu "đã xác minh qua GitHub/LinkedIn" trên `/b/:handle`), review `.ai/reviews/VNX-2606b-review.md` APPROVE; 154 file / 1752 test xanh (sau khi Owner cho dừng một `wrangler dev` cổng 8787 của phiên khác trong worktree `vnxsi-deploy`, chạy từ 2026-10-08 và giữ hơn 9.000 socket, làm Windows báo `ENOBUFS`). **Owner 2026-10-10 (VNX-2605c, VNX-2607):** hủy liên kết provider P kết thúc mọi session `oauth_<P>` của user, kể cả session đang thực hiện (về `/me?link=unlinked`, đăng nhập lại); thêm câu `email.identityUnlinked.sessions` (duyệt nguyên văn 4 locale); "đăng xuất các phiên khác" vào backlog sau VNX-2608 (rủi ro còn lại: bản sao session `magic_link` bị đánh cắp sống tới 30 ngày, có từ trước EPIC 26); phần bổ sung pháp lý không phải "thay đổi quan trọng". **VNX-2607 bị review plan từ chối, viết lại sau rebase:** `main` có `privacy-m7.md` và bốn hằng số, phải áp câu chữ vào cả hai phiên bản Privacy. VNX-2605c xong `94cf5d8` (hủy liên kết P kết thúc mọi session `oauth_<P>` trong cùng batch; đóng race ở callback đăng nhập), review `.ai/reviews/VNX-2605c-review.md` APPROVE; 157 file / 1769 test xanh. **Owner 2026-10-10, ADR-013 Accepted:** chỉ liên kết provider mới từ session `magic_link`, nhánh link kiểm lại session sau khi đổi code → task mới **VNX-2605d**, bắt buộc trước VNX-2608. VNX-2605d xong `6a8efe6` + R1 `430194b` (liên kết provider mới chỉ từ session `magic_link`; nhánh link kiểm lại session ngay trong câu INSERT), review `.ai/reviews/VNX-2605d-review.md` APPROVE; 158 file / 1787 test xanh. **Từ 2026-10-10 Owner ủy quyền cho phiên vnxsi-72** duyệt plan, lượt sửa, verdict và merge/push của EPIC 26; câu chữ, quy tắc nghiệp vụ, VNX-2601 và VNX-2608 vẫn hỏi Owner. Thứ tự: rebase lên `main` (`e78c1c5`, chạy thêm `npm run e2e`) → VNX-2607 → VNX-2604d → VNX-2608. Chưa push, chưa merge. Owner làm VNX-2601: tạo ứng dụng OAuth Google, GitHub, LinkedIn (LinkedIn cần Company Page), callback `/auth/oauth/:provider/callback` cho prod và local, 6 secret qua `wrangler secret`.

## Ghi nhận (minor, chưa làm)
- **EPIC 26:** lần soát pháp lý tới sửa Privacy §2 "Bảo mật" thành "bản ghi các thao tác liên quan bảo mật (thao tác admin, đăng nhập, liên kết và hủy liên kết tài khoản)". Khi xóa tài khoản theo yêu cầu phải xóa hàng `user_identities` trước (không có `ON DELETE CASCADE`). Hàm `availableProviders` nên chuyển sang `auth/oauth/index.ts` để route không phụ thuộc nhau.
- **EPIC 26:** nếu `linkIdentity` lỗi (D1) sau khi đã tiêu code, nhánh link rơi vào trang lỗi đăng nhập chung tiếng Anh thay vì `/me?link=failed` (đóng an toàn, không tạo session). Ngày 2026-10-09 `node_modules` gốc của worktree `vnxsi-epic26` bị xóa từ bên ngoài phiên (nguồn còn nguyên), đã tạo lại bằng `npm install`.
- **EPIC 26:** callback OAuth ghi `markLogin` và audit trước `createSession`, không nguyên tử (giống `completeLogin`). Trang 403 của callback luôn tiếng Anh dù cookie có `locale`.
- **EPIC 26:** header `X-GitHub-Api-Version: 2022-11-28` của adapter GitHub hết hỗ trợ ngày 2028-03-10; xem lại trước ngày đó.

- **Trang tool (VNX-2105):**
  - Site chưa có ảnh `og:image` raster (1200×630), nên link chia sẻ không có hình.
  - Chưa có bộ lọc công khai `?tool=` / link "See all" trên `/builders` và `/products`.
  - Chưa có bí danh tên merchant.
  - Chưa đo nguồn request/builder đến từ trang tool.
  - Chưa có trang chỉ mục `/tools`.
  - Mỗi lượt tìm lấy 24 dòng để dùng 6, kèm câu đếm bị bỏ đi (thêm chế độ limit / không đếm nếu cần).
  - `COLLATE NOCASE` chỉ gộp hoa thường ASCII.
- **Ops Merchants (VNX-2508a):**
  - History chỉ hiện audit `entity = 'merchant'`, không hiện sửa chương trình/offer.
  - Giao diện là form admin trong khung Ops (`.ops-legacy`); làm lại theo mockup ở VNX-2509.
  - `/admin` vẫn trả chữ "Bad request" trần cho 400 (Ops render trang).
  - Commit test đỏ `cc0c089` không qua typecheck (chấp nhận).
  - Test kiến trúc không bắt được import chỉ lấy side effect (không có `from`).
- **Feature flags trong Ops** (`/ops/settings/feature-flags`): chưa có. Owner chỉ yêu cầu Merchants.

- Ops O1: tìm kiếm không phân biệt hoa thường chỉ với ASCII (SQLite `lower()`); Overview/menu đọc mỗi bộ đếm hai lần mỗi request (thẻ + số trên menu).
- Ops O1: khối ảnh product hiện alt hai lần khi ảnh lỗi; thẻ Invitations của request có khoảng trống thừa khi chưa mời ai; 9 tab Requests cuộn ngang ở 390 px (xem ở 2509).
- Ops O1: invite không mời được ai (trùng, chính client, builder không đủ điều kiện) hiện 409 chung vì `inviteBuildersBatch` không trả lý do.
- Ops O1: nhãn cũ của admin "Reason (optional, admins only)" khi suspend product/builder là sai (Hub hiện ghi chú cho builder); Ops đã dùng nhãn đúng, `/admin` chưa sửa.
- Ops O1: nhãn môi trường là PRODUCTION ở máy local trừ khi `.dev.vars` đổi `APP_ORIGIN`.
- Máy dev Windows dùng chung: `npm test` một lượt có thể hết bộ nhớ (chạy theo thư mục `--maxWorkers=2`); dừng task nền không giết tiến trình con `wrangler dev`/`workerd` (dùng `taskkill /T`).

- EPIC 21: test dưới tải máy: test HTTP nặng có sẵn từ trước timeout 5 s khi chạy cả bộ (`test/legal/footer.test.ts`, `test/admin/feedback.test.ts`, `test/hub/invitations.test.ts`, `test/public/request-form.test.ts`), chạy riêng thì xanh; test race cờ dùng chờ cố định 20 ms; chú thích `vitest.config.ts` ("no R2 binding") đã cũ từ PR #6.
- EPIC 21: test kiến trúc còn điểm mù regex (join bằng dấu phẩy, SQL chữ thường, import side-effect / động; review F6); `audit.ts` trong `MONEY_ALLOWED`, file xếp hạng import được (đã chấp nhận).
- EPIC 21: domain: mã lỗi `userinfo` / `protocol` không tới được trong `check()`; terms chỉ có khoảng trắng qua được CHECK (domain đã trim); `toMerchant` được export; test chuyển trạng thái dùng oracle chép từ code.
- EPIC 21: admin: xem trước "Right now" của offer mặc định khi merchant `paused` hiện kết quả `/go/o/` trong khi `/go/:slug` 404; test route offer chỉ kiểm 403 cho user thường; lựa chọn `sponsored` trong dropdown luôn lỗi; `programId` lạ che lỗi trường khác; xác nhận archive dùng `expectedStatus` từ client (CAS đã bảo vệ); `aria-describedby` chưa trỏ tới hint.
- EPIC 21: click: `purgeOldClicks` có tham số `batch` chỉ cho test, cảnh báo sai khi đúng 50k dòng; referrer có `_` hoặc dấu chấm cuối lưu NULL (chỉ hụt số liệu).
- EPIC 21: legal: chú thích header `content.ts` (ngày duyệt) và `LEGAL_UPDATED_AT` đã cũ; kiểm thẻ khối partner, `lang` trên `ul/li` chưa ghim; spy console không trong `finally`; phạm vi `afterEach`, reset thừa.
- EPIC 21: `/sitemap.xml` cache 1 giờ, có thể lệch meta robots sau khi đổi `content_indexing` (review F7).

- M6: Windows: `test/hub/media-disabled.test.ts` (của `main`, AC1) lỗi khi working copy CRLF (`wrangler.jsonc` qua autocrlf; regex bỏ comment `//.*$` vướng `\r`); xanh trên LF / CI. Không phải lỗi merge.
- M6: có thể "gài" request chờ xác nhận vào tài khoản người khác (giảm bằng Turnstile, rate limit, xóa sau 48 giờ); đăng request khi đã đăng nhập là 2 lần ghi; `/request` khi đã đăng nhập điền sẵn tên mà không có no-store (cùng khuôn M5).
- M6: audit trùng khi hai thao tác cùng mili giây (xác nhận, gỡ, cron chạy đồng thời: nhắc / audit trùng); khuôn `status + updated_at` từ M5.
- M6: `mentions()` (F2) chưa xử lý biên dấu câu (`.NET`, `C++17`) và NFD; `changeUser` TOCTOU: request được xác nhận giữa lúc đọc và batch khóa thì vẫn mở; mở khóa builder có thể để > 5 lời mời đang mở; audit lời mời bị quét là batch thứ hai (crash giữa hai batch mất audit, guard chặn trùng); route khóa user có thể gộp audit vào một batch.
- M6: F8 giữ: builder bị khóa (tài khoản vẫn `active`) vẫn đọc `/hub/invitations/:id` của mình, kể cả lời mời đã hết hạn.
- M6: admin: danh sách rỗng dùng lại `me.requests.empty`; cột "Proposals" đếm cả lời từ chối (nên đổi nhãn "Answered"); chuỗi số chỗ ghi cứng 5; `listCandidates` đọc ≤ 1000 builder; gỡ request đã kết thúc ghi đè `closed_at`.
- M6: giao diện / a11y: ô lý do từ chối thiếu `aria-describedby`; bảng lời mời thiếu `<thead>`; từ chối một lần bấm, không hỏi lại; câu gợi ý chọn vẫn hiện khi không có gì để chọn; `requestTitle ?? ""` có thể ra tiêu đề rỗng.
- M6: code: `auth.tsx` mặc định mục đích lạ thành "request" (không chạy tới); `timelineDays ?? 0`; kiểu `Email` lặp, 3 vòng gửi giống nhau; test quét kiến trúc lách được bằng destructuring, `notify/request.ts` ngoài danh sách quét; cron giới hạn 200 dòng không chặn số email mỗi lần chạy; thứ tự import ở `daily.ts`.
- M6: test nhánh phụ còn thiếu (db: user bị khóa của builder `approved`, builder `pending`, id trùng trong batch, mời vào `pending_verification`, guard `inviteId`, user `suspended` sau khi đề xuất; route: request `removed` khi POST confirm / close, 502, GET khi Turnstile chưa cấu hình, `unavailable` → 503, chọn đồng thời hai đề xuất, `requestTitle` trong email admin, bộ lọc số lời mời ở tổng quan, cảnh báo `capped`; test spam không kiểm subject; test POST đồng thời có thể đi nhánh 400; fixture `inviteBuilders` báo lỗi khó hiểu; test cron không mock `console.log`). Đầy đủ: `.ai/reviews/M6-review.md`.

- M5: có thể "gài" Inquiry chờ xác nhận vào tài khoản người khác (giảm bằng Turnstile, rate limit, xóa sau 48 giờ); email xác nhận không có nội dung tin nhắn.
- M5: mở Inquiry ngay cả khi product / builder thôi công khai trong 15 phút chờ; thời gian phản hồi khác nhau giữa nhánh "không tạo gì" và nhánh tạo thật.
- M5: thư báo admin quá 7 ngày chỉ tiếng Anh, gửi lại cho admin đầu danh sách nếu mailer lỗi giữa chừng; người đã đăng nhập không qua Turnstile (quyết định Owner).
- M5: các minor còn lại (a11y, test nhánh phụ, regex tên): xem `.ai/reviews/M5-review.md`.

- M4: danh bạ tìm từ khóa > ~46 byte theo tiền tố (giới hạn `LIKE` 50 byte của D1); nên đổi sang `instr(lower(cột), lower(?))`.
- M4: `LIKE` cho từ 1–2 ký tự chỉ không phân biệt hoa thường với ASCII; nội dung product không chuẩn hóa NFC khi lưu.
- M4: FTS xóa theo `product_id` UNINDEXED (quét bảng); sau Wave 1 khóa theo `rowid`. Sitemap index khi vượt 10 000 product.
- M4: các minor còn lại và test nhánh phụ: xem `.ai/reviews/M4-review.md`.

- M3: các bước văn bản không phải Demo vẫn ghi sửa và audit bằng 2 lệnh riêng; Pricing đổi trạng thái và thay tier bằng 2 lệnh riêng (cửa sổ vài ms).
- M3: upload ảnh lỗi D1 sau khi đã ghi R2 để lại object mồ côi; thiếu `If-None-Match` ở `/media`.
- M3: các minor còn lại và test nhánh phụ: xem `.ai/reviews/M3-review.md`.

- M2: mã invite thô nằm trong path `/join/<code>`, nên log request của nền tảng (observability) có thể chứa mã chưa dùng. Chấp nhận ở Wave 1.
- M2: bảng chuyển trạng thái builder và ghi audit là 2 lệnh D1 riêng (trừ khóa user); cùng mẫu với M1.
- M2: admin duyệt không gắn với phiên bản hồ sơ đã xem (builder pending có thể đổi handle ngay trước khi duyệt).
- M2: thiếu một số test nhánh phụ (zh country names, rate null, suspended edit/move portfolio, label từng dòng invite); danh sách đầy đủ ở `.ai/reviews/M2-review.md`.

- `npm audit`: 5 lỗ hổng high nằm trong dev dependency của `@cloudflare/vitest-pool-workers`; không ảnh hưởng runtime.
- Verify chưa nguyên tử: hai token khác nhau cho cùng email mới bấm cùng lúc có thể gây 500 ở lần thứ hai.
- Bộ đếm IP `"unknown"` dùng chung trong test (login-flow dùng ~13/20).
- ResendMailer chưa có timeout.
- Trang "link hết hạn" luôn tiếng Anh.
