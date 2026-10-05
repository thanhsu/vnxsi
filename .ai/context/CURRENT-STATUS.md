# CURRENT STATUS — VNX.SI

_Cập nhật lần cuối: 2026-10-05 bởi Reviewer (Claude)._

## Tóm tắt
- **Ops console (2026-10-05):** Owner yêu cầu trang Ops riêng gồm 4 nhóm (gộp admin, tổng quan + sức khỏe, nội dung & marketing, cài đặt), chia O1 (khung, vai trò, audit, chuyển `/admin`) → O2 → O3 → O4. Spec `docs/superpowers/specs/2026-10-05-vnxsi-ops-console-design.md` và ADR-010 **Accepted** (review `.ai/reviews/OPS-DESIGN-review.md`). Tiếp theo: Reviewer viết plan O1; cần mockup Ops trước khi code.
- **Production (2026-10-05, lần 2):** `main` `3c77ac5` (M6 + PR #6 bật lại R2) **đã deploy** (version `74b85569`, binding `MEDIA` = `vnxsi-media`, cron `0 1 * * *`). D1 production đã áp `0001`–`0009`. Smoke: 15 route OK (gồm `/request`), R2 đọc qua `/media` đã kiểm bằng object tạm (đã xóa). Upload ảnh và submit product giờ dùng được.
- **M6 (Request, 2026-10-05):** **xong** trên nhánh `feat/m6-request`: 7 task (VNX-0601, 0602a, 0602b, 0603, 0604, 0605 + 0605b, 0606) + lượt sửa sau review toàn nhánh (F2, F3, F4, F5, F7, phần còn lại của Task 7). Đã gộp `origin/main` (PR #4) ở `2865d7e`. 802/802 test, typecheck sạch. Review: `.ai/reviews/M6-review.md`. Đã merge vào `main` (`e9f53a2`, đã push).
- **Cách làm từ M6 (Owner, 2026-10-04):** phiên Opus điều phối các subagent Sonnet (viết plan và code); Opus review và duyệt thay Owner (plan, khắc phục); sau mỗi milestone được APPROVE thì merge và push.
- **Tiếp theo:** lát mỏng EPIC 21 (partner), plan `docs/superpowers/plans/2026-10-05-vnxsi-epic21-partner-slice.md` (đã duyệt, kể cả câu chữ khối A/B/C), nhánh `feat/epic21-partner-slice`. Migration EPIC 21 bắt đầu từ `0010` (`main` đã có `0009_feedback`).
- **Production (2026-10-05):** `main` `3169e6d` (PR #4: VNX-0709 thiết kế lại đợt A, VNX-0710 contact/feedback, VNX-0711 chạy khi chưa có R2, kèm M5 + VNX-0508) **đã deploy** lên https://vnx.si (version `b5d0f063`, cron `0 1 * * *`). D1 production đã áp `0003`–`0007`, `0009`. Smoke: 20 route trả mã đúng, magic link thật gửi qua Resend tới `thanhsu604@gmail.com`. Chưa có R2: `/media/*` 404, upload ảnh báo "sắp mở" (builder chưa submit product được). Việc còn lại: Owner bật R2 → `npx wrangler r2 bucket create vnxsi-media` → bỏ comment `r2_buckets` trong `wrangler.jsonc` → deploy.

- **Hướng sản phẩm:** marketplace cho sản phẩm được xây bằng AI và builder (pivot 2026-10-03). Blueprint: `docs/blueprint/README.md`.
- **Đợt hiện tại:** Wave 1 (Supply). Spec: `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md`.
- **Milestone:** M0 và M1 **xong**, đã merge vào `main` qua PR #1 (merge commit `368cc1a`, 2026-10-03). M2 (Builder) **xong và đã merge** vào `main` (merge commit `3bde074`, đã push). M3 (Product) **xong**: 8 task + lượt sửa sau review toàn nhánh, 323/323 test, typecheck sạch. Review: `.ai/reviews/M3-review.md`. Đã merge vào `main` (`fe87caa`, đã push). M4 (Catalogue và danh bạ) **xong** trên nhánh `feat/m4-catalogue`: 5 task + lượt sửa sau review toàn nhánh (`bcb76d6`), 391/391 test, typecheck sạch. Review: `.ai/reviews/M4-review.md`. Đã merge vào `main` (`d297c72`, đã push). M5 (Inquiry) **xong** trên nhánh `feat/m5-inquiry`: 7 task + lượt sửa sau review toàn nhánh (F1–F8), đã gộp `main` hai lần (VNX-0708 ở `1f5ddc7`; VNX-0705a ở `482ef50`, hợp nhất hai cron thành một), 534/534 test, typecheck sạch. Review: `.ai/reviews/M5-review.md`. Đã merge vào `main` (`815e06e`, đã push). VNX-0508 (Privacy cho Inquiry và Turnstile) **xong**, đã merge vào `main` (`bcf95c6`, đã push). M6 (Request) **xong** trên `feat/m6-request` (xem dòng đầu).
- **Deploy:** không có workflow nào tự deploy khi push; production chạy code PR #4 (xem dòng Production ở trên).
- **Monetization (2026-10-04):** audit + Owner trả lời Q1–Q9; ADR-007/008/009 **Accepted** và phụ lục spec **Approved** (Owner duyệt văn bản 2026-10-04). Code theo lịch: `/go/` ở M7 (VNX-0707), phần còn lại ở EPIC 21–24. **Partner đầu tiên:** ElevenLabs (PartnerStack), sổ ở `docs/partners/registry.md`; lát mỏng EPIC 21 (phụ lục mục 3.8) làm ngay sau VNX-0708.
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

## Điều kiện trước khi deploy `main`

Production chạy code PR #4 (`3169e6d`); D1 remote đã có `0001`–`0007` và `0009`, **chưa có `0008_requests`**. Lần deploy `main` tiếp theo (có M6), theo thứ tự (cũng ghi trong `apps/web/wrangler.jsonc`):
1. `npm run db:migrate:remote -w apps/web` (áp `0008_requests`). Code M6 cần bảng `requests`, `request_invites` (`/request`, `/me`, `/hub`, `/admin/requests`, cron hằng ngày).
2. `npm run deploy`, chạy liền sau bước 1.

Không có secret mới (`RESEND_API_KEY`, `ADMIN_EMAILS`, `TURNSTILE_SECRET` đã có). R2 không bắt buộc (VNX-0711): khi Owner bật R2 thì `npx wrangler r2 bucket create vnxsi-media`, bỏ comment `r2_buckets`, rồi mới deploy.

Chưa áp `0008_requests` thì **không deploy `main`**, kể cả để sửa nhanh landing.

## Quyết định phát sinh

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

## Nghĩa vụ để lại
- **Deploy M6:** `npm run db:migrate:remote -w apps/web` (`0008_requests`) rồi `npm run deploy` liền sau (mục "Điều kiện trước khi deploy `main`"). Cần `ADMIN_EMAILS` (đã có) để admin nhận email khi có request mới.
- **Reviewer (tài liệu M6, còn treo):** ARCHITECTURE §2 dòng `notify/` ghi thêm M6 (`notify/request.ts`, gửi một lần, không có cột gửi lại).
- **Mọi thông báo mới gửi builder khi lời mời / request kết thúc:** phải đi qua `publicBuilderOnly` (bỏ qua builder không công khai); không tự có.
- **EPIC 21:** migration bắt đầu từ `0010` (`0010_feature_flags`, `0011_partners`, `0012_outbound_clicks`; plan đã sửa); nếu `main` có số cao hơn lúc bắt đầu thì đánh số lại. Privacy (khối C) sửa trong cùng task VNX-2103.
- **M7 (số liệu, Live, test kiến trúc tiền):**
  - "Request 30 ngày" đếm theo `requests.submitted_at`; bảng thước đo §3 (request đã gửi, tỷ lệ có ≥ 1 đề xuất, tỷ lệ chọn được builder) đọc thẳng `requests`, `request_invites`.
  - Dải Live đọc audit `request.submit`, `request.verify` (chỉ `category`, `languages`), chịu được dòng trùng hiếm (cùng mili giây).
  - Không dùng `closed_at` làm mốc kết thúc của request bị gỡ sau khi đã kết thúc (bị ghi đè).
  - "Top builder: được chọn" đếm `request_invites.status = 'selected'`; "trả lời nhanh" lấy `invited_at → responded_at`.
  - Test kiến trúc "ranking không đọc tiền" (ADR-007) phải gồm `db/requests.ts` (`listCandidates`) và `domain/request.ts` (`suggestBuilders`).
- **Trước khi số builder `approved` vượt 1000:** `listCandidates` lấy 1000 builder đầu theo `user_id` rồi mới chấm điểm; khi đó lọc hoặc chấm điểm trong SQL.
- **Owner (bảo mật):** Resend API key đã dán vào hội thoại 2026-10-04 → sau go-live, thu hồi key trên Resend, tạo key mới, chạy lại `npx wrangler secret put RESEND_API_KEY` (trong `apps/web`). Tương tự Turnstile secret (cũng dán vào hội thoại): Rotate secret key ở widget `vnx.si`, rồi `npx wrangler secret put TURNSTILE_SECRET`.
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

## Ghi nhận (minor, chưa làm)

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
