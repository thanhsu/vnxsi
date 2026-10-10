# VNX.SI EPIC 27 — Bảng request công khai · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans để làm plan này từng task. Steps dùng checkbox (`- [ ]`). Đọc `CLAUDE.md` trước khi bắt đầu.

- **Trạng thái:** **APPROVED** (Owner 2026-10-07, VNX-2701; Reviewer Opus APPROVE_AFTER_FIXES, đã sửa ở `a6ac733`). Phụ lục thiết kế đã **Approved** (Owner 2026-10-07, đủ 19 câu ở §17); câu chữ EN §12.2–12.4 đã **APPROVED**; bản VI §12.6 và câu thông báo OP-2a **APPROVED** (Owner 2026-10-07). Code bắt đầu sau khi M7 được deploy; thứ tự so với M8 và EPIC 26 Owner chốt lúc cho bắt đầu.
- **Roadmap / Backlog:** EPIC 27 (ID đề xuất ở phụ lục §16; kéo VNX-1901 lên). Task: VNX-2701 … VNX-2709 (tách nhỏ từ bảng §16, xem "Thứ tự task"). Phụ lục thắng spec Wave 1 ở mọi chỗ ghi "thay mục X".
- **Spec nguồn:** `docs/superpowers/specs/2026-10-07-vnxsi-public-request-board-addendum.md` (gọi tắt "phụ lục"); spec Wave 1 §4, §5.2–5.7, §6.1, §7.5–7.6, §8.2–8.4, §8.8, §8.10–8.11, §11; spec Ops console §2; ADR-003 (i18n, tiền tố locale), ADR-004 (không vị trí trả tiền), ADR-010 (Ops: capability, 404 kín, audit atomic, projection an toàn).
- **Nhánh triển khai:** `feat/epic27-request-board`, cắt từ `main` lúc Owner cho bắt đầu, trong worktree riêng (cùng cách làm EPIC 26 và M7). Plan này nằm ở nhánh tài liệu `docs/public-request-board`. Ổ D: gần đầy (~160 MB trống lúc viết plan): Owner dọn chỗ hoặc chọn ổ khác cho worktree trước khi Implementer chạy `npm install`.
- **Implementer / Reviewer:** subagent Claude Sonnet (plan đã duyệt, code, test) / Opus review độc lập (cách làm M6+). Reviewer không sửa code của Implementer.

**Goal:** Client chọn công khai **từng** request (opt-in, mặc định riêng tư); Ops kiểm duyệt và sửa bản công khai; `/requests` và `/requests/:publicId` hiện bản đã duyệt, không bao giờ có danh tính client; builder `approved` bấm "I'm interested" vào hàng chờ Ops; Ops vẫn là bên mời (tối đa 5, luồng M6 không đổi); request rời trạng thái mở thì `noindex`, ra khỏi sitemap, ghi "Closed" 30 ngày rồi 404. Toàn bộ nằm sau cờ `request_board` và ngày hiệu lực `REQUEST_BOARD_GO_LIVE`; cờ không được bật trước khi Privacy/Terms mới hiện đủ 14 ngày và người có chuyên môn pháp lý đã đọc.

**Architecture:**
- **Module `matching`** (cùng `requests`, `request_invites`). Hai bảng mới `request_publications`, `request_interests` được ghi bởi **một** file duy nhất `src/db/request-board.ts` (thêm vào `WRITERS` của `test/architecture.test.ts`). `db/requests.ts` không ghi hai bảng này; xóa request dùng `ON DELETE CASCADE` (xem quyết định 3).
- **Domain thuần** `src/domain/request-board.ts` (không Hono, không D1): máy trạng thái 7.1 và 7.2, `requestVisibility`, parse đầu vào, hằng số (30 ngày, 10 interest/ngày, 30 pending, 5 request tối thiểu để index), cổng thời gian `REQUEST_BOARD_GO_LIVE`.
- **Route:** `src/routes/request-board.tsx` (`/requests`, `/requests/:publicId`, interest, rút), `src/routes/ops-request-board.tsx` (hành động Ops), sửa nhỏ `request-form.tsx`, `me-requests.tsx`, `hub-invitations.tsx`, `admin-requests.tsx` (mời → `invited`), `ops-marketplace.tsx`, `ops.tsx`, `seo.ts`. View mới ở `src/views/requests/`.
- **Mọi thao tác ghi** là một `db.batch`: thay đổi (compare-and-set trên `updated_at`) + `audit_log` có guard (ADR-010). Guard audit mới: `AuditPublicationGuard`, `AuditInterestGuard` trong `db/audit.ts`.
- **Hiển thị công khai** do **một** hàm `requestVisibility` quyết định; trang, danh sách, sitemap và nút interest đều dùng nó. `/requests*` không đặt `Cache-Control: public` (client gỡ phải có hiệu lực ngay); sitemap giữ cache 1 giờ như hiện nay.
- **Cổng bật** `requestBoardEnabled = cờ DB request_board bật AND hôm nay (UTC) ≥ REQUEST_BOARD_GO_LIVE`, fail closed (biến rỗng hoặc sai dạng, lỗi đọc D1 = tắt). Hai khóa độc lập: ngày commit trong repo chặn bật sớm hơn thời gian báo trước; cờ DB là công tắc khẩn cấp Owner.
- **Pháp lý theo phiên bản:** tổng quát hóa `privacyVersion` của M7 thành danh sách phiên bản có ngày hiện (phụ lục Q15), thêm cùng cơ chế cho Terms; thông báo trước 14 ngày dùng lại khung `PrivacyNotice` (xem VNX-2707a).

**Tech Stack:** như M0–M7, không thêm dependency. Migration mới: `00NN_request_board.sql`, **`NN` là số trống kế tiếp trên `main` lúc cắt nhánh, không hard-code** (EPIC 26 nhánh `feat/epic26-linked-accounts` đã dùng `0017_user_identities.sql`; ghi chú "O2 từ `0017`" trong CURRENT-STATUS đã cũ). Chỉ thêm. Không chạy migration remote, không deploy, không push, không merge.

## Trạng thái đối chiếu với code (2026-10-07, nhánh `docs/public-request-board`, đã gộp `origin/main`)

Những điều dưới đây quyết định cách tách task; mỗi mục đã đọc trong code.

- `main` có migration `0001`–`0016`. M7 đã nằm trong `main` (`public_stats`, cron hằng giờ, `PRIVACY_NOTICE_GO_LIVE`, `privacyVersion`, `PrivacyNotice`).
- `domain/flags.ts#FLAG_KEYS` có 7 key (`affiliate` … `content_indexing`). Có 3 test cứng danh sách: `test/domain/flags.test.ts` (so mảng đúng thứ tự), `test/db/flags.test.ts`, `test/admin/flags.test.ts` (đếm `data-state="off"`). Thêm key phải sửa cả ba. Nhãn từng cờ ở `views/admin/FlagsPage.tsx`.
- `domain/request.ts`: `ClientRequest` chưa có `country`; `requestTransition` (7.5) và `inviteTransition` (7.6) không đổi. `closed_at` được `setRequestStatusStatement` đặt cho **mọi** trạng thái cuối (kể cả `removed`, `rejected`).
- `db/requests.ts#createRequest` là **một** `INSERT … RETURNING`, không phải batch; audit `request.submit` (đã đăng nhập) và `request.create` (chưa đăng nhập, `createPendingRequestAndMail`) được ghi **sau**, bằng `writeAudit` rời. Phụ lục §3.1 đòi dòng `request_publications` nằm "trong cùng batch tạo request": cần tách `createRequestStatements` (id sinh trước, như `createInquiryStatements`) và giữ `createRequest` làm bọc mỏng (fixture `makeRequest` dùng nó).
- Xóa request: `deletePendingRequestStatement` (mail xác nhận lỗi) và `deleteExpiredPendingRequests` (cron 48 giờ, `submitted_at IS NULL`, `pending_verification` hoặc `removed`). **Không có đường "xóa tài khoản" nào** ngoài `deleteGhostUsers` (đã có `NOT EXISTS requests` và `NOT EXISTS builders`, nên không vướng hai bảng mới). Phụ lục §6 nói "sửa đường xóa tài khoản": thực tế không có gì để sửa ở đó.
- `inviteBuildersBatch` (`db/requests.ts`) + `inviteToRequest` (`routes/admin-requests.tsx`) là **một** đường mời duy nhất, dùng chung bởi `/admin/requests/:id/invite` và `/ops/marketplace/requests/:id/invite`. `read()` đọc kết quả theo vị trí, nên câu lệnh thêm phải nối **sau** `batch.statements` và **trước** câu audit.
- Ops: console tiếng Anh duy nhất, khóa `ops.*` chỉ ở `en.ts` (ADR-010; `test/i18n/parity.test.ts` cấm `ops.*` ngoài EN). `Viewer` có `marketplace.view` nên **đang xem được** chi tiết request kèm bản gốc; chỉ `owner` và `operator` có `marketplace.act` (`domain/ops.ts`). `OverviewPage` có `QUEUE_IDS` cố định 5 mục; `ops.tsx` có `QUEUE_TARGETS` và `reads`. Danh sách Requests đã có 9 tab; bộ lọc đọc từ URL qua `requestFilter` (chỉ giữ `status`, `q`).
- `routes/seo.ts` nằm trong `MONEY_ALLOWED` của test kiến trúc; file trong `RANKING_FILES` **không được** import file thuộc `MONEY_ALLOWED` (trừ `db/audit.ts`). Hệ quả: truy vấn sitemap của bảng request phải nằm ở `db/request-board.ts` (file xếp hạng), `seo.ts` chỉ gọi hàm đó, không ngược lại.
- `page()` (`views/render.ts`) là điểm render HTML duy nhất; `Layout` đọc `signedIn` và ngữ cảnh `hono/jsx` của thông báo Privacy. Footer chưa biết cờ nào.
- `http/rate-limit.ts#hitRateLimit(db, key, limit, windowSeconds, nowMs)` là bộ đếm cửa sổ cố định theo D1; không có giới hạn nào cho thao tác `/me/requests/*` (close, select), nên câu "dùng chung giới hạn của thao tác `/me` hiện có" (phụ lục §9.1) không có đối tượng thật; xem Open point OP-1.
- `domain/countries.ts#COUNTRY_CODES` / `isCountryCode`, `views/country.ts#countryName` (Intl) có sẵn; form `/request` chưa có country.
- `domain/privacy-notice.ts`: `privacyVersion(goLive, now)` trả `"current" | "m7"`; `routes/legal.tsx` chọn `PRIVACY_M7`; `legal/content.ts` có bốn hằng số Privacy (`privacyEn`, `privacyVi`, `privacyEnM7`, `privacyViM7`) và `LEGAL_UPDATED_AT`; `docs/legal/{privacy,privacy-m7,terms}.md` là nguồn, `test/legal/content.test.ts` so từng dòng. **Terms chỉ có một phiên bản, không cổng ngày.**
- `test/architecture.test.ts`: `WRITERS` (mỗi bảng một module ghi), `RANKING_FILES`, `MONEY_ALLOWED`, `BUILDER_FACING_FILES` (mọi `.clientName` trong file hướng builder phải qua `builderFacingName`).
- `wrangler.jsonc#vars` có `PRIVACY_NOTICE_GO_LIVE: ""` kèm 3 quy tắc comment (a)–(c); `test/config/wrangler-guard.test.ts` kiểm cron và dạng ngày.
- `test/helpers.ts` không có tiện ích đếm truy vấn D1. `test/fixtures.ts` có `makeRequest`, `makeBuilder`, `addLiveProduct`, `inviteBuilders`, `signIn`.

## Quyết định của Owner đã có (ràng buộc, không hỏi lại)

- **2026-10-06:** bảng công khai **đầy đủ** (thay đề xuất "tóm tắt ẩn danh"); opt-in từng request; không công khai hồi tố; trường quốc gia mới; quy tắc ngân sách; kiểm duyệt trước khi công khai.
- **2026-10-07:** builder bấm "I'm interested", vào hàng chờ Ops, admin vẫn mời tối đa 5; chỉ hiện `budget_band`; mọi trường công khai sau khi Ops kiểm duyệt, danh tính client không bao giờ công khai; request mở được index, rời trạng thái mở thì `noindex`, ra khỏi sitemap, trang ghi "closed".
- **2026-10-07 ("approve all"), 19 câu §17** (plan dùng đúng các giá trị này): Q1 country tùy chọn, danh sách `COUNTRY_CODES`, không điền theo IP; Q2 opt-in sau từ `/me` cho request đang mở (từng cái, qua kiểm duyệt); Q3 Ops sửa thì publish ngay, email ghi "đã sửa", client không duyệt lại; Q4 Ops không ẩn riêng trường có cấu trúc; Q5 client gỡ được mọi lúc, hiệu lực ngay; Q6 client tự gỡ thì opt-in lại được (request còn mở, kiểm duyệt lại, `published_at` giữ nguyên), Ops từ chối hoặc gỡ thì không; Q7 "Closed" 30 ngày sau `closed_at` rồi 404; Q8 bảng CTA 4.2; Q9 interest có ghi chú ≤ 500 và một product `published` của chính builder; Q10 10 interest/ngày/builder, tối đa 30 `pending`, không Turnstile; Q11 không hiện số builder quan tâm; Q12 không email builder khi dismiss/đóng; Q13 `/requests` luôn mở được, nhưng `noindex` và ngoài sitemap khi **dưới 5** request `open`, link từ `/for-builders` và footer, không link header; Q14 lọc category, budget band, ngôn ngữ; Q15 báo trước 14 ngày cho cả Privacy và Terms, không chờ task dọn Privacy M7, biến `REQUEST_BOARD_GO_LIVE` commit trong `wrangler.jsonc`; Q16 cần người có chuyên môn pháp lý đọc mục 12 trước khi bật; Q17 không slug, chỉ `/requests/:publicId`; Q18 Owner và Operator kiểm duyệt (capability `marketplace.act`); Q19 3 email cho client (publish, từ chối, gỡ).
- Chưa quyết (Owner chốt khi duyệt plan, phụ lục §16): **thứ tự EPIC 27 so với M8 và EPIC 26**. Plan chỉ phụ thuộc EPIC 26 ở bốn điểm phối hợp (migration, `FLAG_KEYS`, `privacy*.md`/`content.ts`, và thông báo Privacy), liệt kê ở "Điểm phối hợp".

## Quyết định thiết kế của Reviewer (cần Opus review)

1. **Một file ghi hai bảng mới.** `db/request-board.ts` ghi `request_publications` và `request_interests`; mọi thao tác của route (opt-in, publish, edit, reject, unpublish, withdraw, tạo/rút/dismiss/mời interest) là hàm ở đây trả `D1PreparedStatement` để route gộp vào `db.batch` cùng audit. Lý do: một chủ ghi bảng (test `WRITERS`), và để `inviteToRequest` thêm câu "interest → invited" mà không để `db/requests.ts` ghi bảng của module con.
2. **Compare-and-set bằng `updated_at`.** Mọi `UPDATE` bảng mới có `WHERE request_id = ?1 AND status = ?2 AND updated_at = ?3` và `RETURNING *`; kết quả đọc bằng `RETURNING`, không dùng `meta.changes` (D1 dùng chung giữa các test; trigger có thể cộng `changes`). Form Ops mang `updatedAt` ẩn (token so khớp, như M6).
3. **Xóa bằng `ON DELETE CASCADE`.** `request_publications.request_id` và `request_interests.request_id` có `REFERENCES requests (id) ON DELETE CASCADE`. `deletePendingRequestStatement` và `deleteExpiredPendingRequests` giữ nguyên (không ghi bảng con ở file khác, `WRITERS` không vỡ); test chứng minh cascade chạy trong môi trường test (D1 bật khóa ngoại: `inquiries` đã phải xóa `inquiry_messages` trước, xem `db/inquiries.ts`). Nếu test cascade đỏ (khóa ngoại không bật), phương án dự phòng là hai câu `DELETE` ở `db/request-board.ts` được xuất ra và gọi trong cùng batch; Implementer báo lại, không tự đổi hướng.
4. **Cổng bật hai khóa** (xem Architecture). Hành động **gỡ của client không bao giờ bị cổng chặn** (rút đồng ý phải luôn được). Hành động Ops (reject, unpublish, edit, dismiss) cũng không bị cổng cờ chặn (công tắc khẩn cấp không được khóa chính người dọn dẹp). Opt-in (form, `/me`), trang công khai, interest, sitemap và link footer bị chặn khi cổng tắt.
5. **`consent_version` = `REQUEST_BOARD_GO_LIVE`** (chuỗi `YYYY-MM-DD`): ngày phiên bản Privacy/Terms có board đang hiện lúc opt-in; vì opt-in chỉ có khi cổng bật, giá trị luôn khác null và khớp đúng phiên bản đã báo trước.
6. **Truy vấn xếp hạng sạch tiền (ADR-004).** `db/request-board.ts`, `domain/request-board.ts`, `routes/request-board.tsx`, `routes/ops-request-board.tsx`, `views/requests/*.tsx` vào `RANKING_FILES`; không import `db/{merchants,programs,offers,conversions,revenue,clicks}.ts`, không đọc bảng tiền. Thứ tự duy nhất: `published_at DESC, public_id DESC`; không tham số `sort`, không cột ưu tiên.
7. **`public_id` là ULID sinh lúc tạo dòng publication** (`lib/ulid.ts`), không suy ra từ `request_id`, không từ tiêu đề. Chỉ dùng trong URL công khai; `request_id` không bao giờ lộ ra ngoài (kể cả trong HTML ẩn, `data-*`, JSON).
8. **Trang công khai không đọc bảng nào chứa danh tính.** Truy vấn công khai chỉ `SELECT` các cột cho phép từ `request_publications` JOIN `requests` (`category, budget_band, country, deadline, languages, status, closed_at`) và **không bao giờ** `SELECT r.*` hay `client_name`, `client_user_id`, `locale`, `admin_note`, `title`, `description` gốc. Test đối chứng bằng chuỗi nhận diện (VNX-2705a).
9. **Thông báo trước dùng lại khung M7** (VNX-2707a): hai cửa sổ thông báo độc lập (`PRIVACY_NOTICE_GO_LIVE`, `REQUEST_BOARD_GO_LIVE`), mỗi cửa sổ `[goLive − 14 ngày, goLive + 31 ngày)`, mỗi thông báo có khóa `localStorage` riêng.
10. **Ba phiên bản Privacy, hai phiên bản Terms** (VNX-2707a/b), theo quy tắc hai phiên bản của M7 nhưng mở rộng đúng tinh thần phụ lục Q15; giải thích và hệ quả ở "Pháp lý" bên dưới và Open point OP-3.
11. **Số truy vấn.** `/requests` và `/requests/:publicId` ≤ 8 truy vấn D1 (NFR), đo bằng tiện ích đếm truy vấn mới ở `test/helpers.ts` (VNX-2702a). Cờ đọc qua cache 60 giây của `isFlagEnabled`.
12. **HTML thuần cho mọi thao tác**: không `<script>`/`style=` inline, không JS riêng cho bảng; lọc là form GET; interest, opt-in, gỡ là form POST. Chi tiết nội dung do người dùng viết render qua `PlainText` (văn bản thuần §8.6), cấm `dangerouslySetInnerHTML`.

## Global Constraints

- Mọi ràng buộc của M0–M7 và EPIC 21 vẫn áp dụng: không thêm dependency; ranh giới module (`domain/` không import Hono/D1, `views/` không import `db/`); Origin check cho mọi POST; test sở hữu bảng (`WRITERS`); chuỗi giao diện qua `t()` đủ 4 locale (`ops.*` chỉ EN); test nặng timeout 30 giây; `Cache-Control: no-store` cho `/hub*`, `/me*`, `/admin*`, `/ops*` và mọi HTML khi đã đăng nhập (VNX-0803 F8).
- **CSP:** không `<script>` hay `style=` inline trong view mới; Turnstile không dùng ở bản này. Form interest, opt-in, gỡ, lọc chạy không cần JS.
- **Body POST ≤ 64 KB** (`http/body-limit.ts`). Form lớn nhất là ô sửa `public_description` ≤ 4000 ký tự (≤ ~16 KB UTF-8). Handler POST không redirect ra ngoài site (CSP `form-action 'self'`): đích chỉ là `localizedPath(...)`; tham số `next` ở `/login` đi qua bộ kiểm hiện có.
- **Referrer-Policy:** không bao giờ `no-referrer` cho trang có form POST sau Origin check (bài học VNX-0803 F1: `Origin: null` làm hỏng 403). Dùng mặc định của site (`strict-origin-when-cross-origin`); nếu cần chặt hơn thì `same-origin`.
- **`no-store` khi đã đăng nhập:** `noStorePrivate` đã phủ HTML của người đã đăng nhập; test khẳng định lại cho `/requests` và `/requests/:publicId`. Khi chưa đăng nhập: không `Cache-Control: public` (không `max-age`), vì "client gỡ → 404 ngay".
- **Không dữ liệu bịa trên giao diện:** không request mẫu, không số liệu, không testimonial; bảng rỗng hiện trạng thái rỗng. Dữ liệu mẫu chỉ có trong test (fixture có chuỗi nhận diện rõ).
- **Không vị trí trả tiền (ADR-004):** không `featured`, `boost`, `urgent`, `sponsored`, không cột tiền hay điểm ở hai bảng mới, không đường client trả tiền để lên đầu bảng. Thứ tự duy nhất: mới publish lần đầu trước.
- **Không gửi dữ liệu cá nhân của client cho builder hay model AI ngoài mức spec:** trang công khai và Hub không có `client_name`, bản che `builderFacingName`, email, `client_user_id`, `locale`, `admin_note`, bản gốc, số lời mời, đề xuất, số builder quan tâm, kết quả (`builder_selected`/`expired`; chỉ "Closed").
- **Test dùng D1 chung:** assert theo dòng của mình (tag/ULID riêng cho từng test), dùng `RETURNING` thay `meta.changes`, không assert tổng toàn bảng (đặc biệt `COUNT(*)` request `open`, số mục sitemap). Ngưỡng "dưới 5 request `open`" (Q13) kiểm bằng hàm thuần với số cho trước, và ở tầng HTTP bằng độ lệch so với số đếm đọc trước, không giả định 0.
- **Migration:** `00NN_request_board.sql`, `NN` = số trống kế tiếp trên `main` lúc cắt nhánh (Step 1 của VNX-2702a bắt buộc kiểm), đổi tên file nếu lúc merge `main` đã dùng số đó (luật (c) của plan EPIC 26). Chỉ thêm; không điền dữ liệu (không công khai hồi tố).
- **Hai phiên bản Privacy:** cho tới task dọn Privacy M7 (sau go-live M7 + 31 ngày), mọi thay đổi Privacy phải sửa **cả** `docs/legal/privacy.md` **và** `docs/legal/privacy-m7.md`, **và** cả bốn hằng số `privacyEn`, `privacyVi`, `privacyEnM7`, `privacyViM7` trong `src/legal/content.ts`. EPIC 27 thêm phiên bản thứ ba có ngày hiện (xem "Pháp lý"); EPIC 26 VNX-2607 cũng sửa các tệp này: **điểm phối hợp khi merge**, bên merge sau phải gộp cả hai thay đổi vào mọi phiên bản còn đạt tới được.
- **Cờ `request_board` tắt cho tới `REQUEST_BOARD_GO_LIVE`.** Biến commit trong `wrangler.jsonc` trên `main`, không bao giờ đặt bằng `--var` hay dashboard, không xóa sau khi đã hiện. Các task câu chữ pháp lý (VNX-2703a phần chuỗi VI, VNX-2707b) **bị chặn tới khi Owner duyệt bản VI §12.6**; cờ **không bật** trước khi người có chuyên môn pháp lý đọc lại (Q16).
- Bí mật chỉ ở `wrangler secret` / `.dev.vars`; không thêm secret mới ở epic này.
- Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`. Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Commit theo Conventional Commits, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` hoặc dòng theo cấu hình phiên của Implementer.
- Không merge, không push, không deploy khi Owner chưa nói rõ. Không cải tiến lân cận; thấy thì ghi vào "Ghi nhận" của `CURRENT-STATUS.md` (Reviewer).

## Review Focus

1. **Không lộ danh tính client:** mọi bề mặt công khai (HTML, sitemap, thẻ, OG, tiêu đề trang, email gửi builder, Hub) không có email, `client_name` (kể cả bản che), `client_user_id`, `request_id` gốc, bản gốc khi Ops đã sửa, `admin_note`. Test bằng fixture có chuỗi nhận diện ở VNX-2705a, 2705b, 2706b.
2. **Hiển thị theo trạng thái (phụ lục §7.3):** một hàm; mọi ô của bảng, kể cả biên `closed_at + 30 ngày`; client gỡ → 404 ngay; `removed` → 404; cờ tắt → 404 và ngoài sitemap.
3. **Quyền Ops:** Owner/Operator thao tác; Content, Viewer, người lạ → 404 kín (`requireOps`), không rò rỉ nội dung; audit cùng batch với thay đổi; `audit.data` không chứa câu chữ công khai hay ghi chú.
4. **Chặn trong câu SQL, không chỉ ở route:** cổng 5 lời mời giữ nguyên (lời mời thứ 6 không tạo được dù có interest); trần `pending` 30 và điều kiện interest nằm trong `INSERT … SELECT … WHERE`; thua race ghi 0 dòng.
5. **Rút đồng ý luôn chạy:** gỡ của client không phụ thuộc cờ, không phụ thuộc trạng thái request; hiệu lực ngay trên trang công khai.
6. **ADR-004:** thứ tự `published_at DESC, public_id DESC`; không tham số/cột trả tiền; file truy vấn trong `RANKING_FILES`.
7. **SEO:** `open` có canonical + hreflang + OG; `closed` và `/requests` dưới 5 request `noindex`, không canonical, không hreflang; sitemap chỉ `open`; `robots.txt` không đổi.
8. **Pháp lý khớp code:** câu chữ giao diện, Privacy, Terms chép nguyên văn bản đã duyệt; `test/legal/*` so từng dòng với `docs/legal/*.md`; `consent_version`; cửa sổ thông báo 14 ngày.
9. **Phối hợp EPIC 26:** số migration, `FLAG_KEYS`, các tệp Privacy, không giẫm lên nhau.

## Thứ tự task

Phụ lục §16 có 8 task; plan tách một số task để mỗi task độc lập review được (diff ≲ 600 dòng, không tính locale). ID mới chỉ là hậu tố `a`/`b`; **VNX-2709** là task mới (cổng ra).

| # | ID | Nội dung | Tag | Phụ thuộc | Chặn bởi |
|---|---|---|---|---|---|
| 1 | VNX-2701 | Owner duyệt phụ lục, plan này, câu chữ VI §12.6, trả lời Open points; chốt thứ tự so với M8 và EPIC 26 | HUMAN | — | — |
| 2 | VNX-2702a | Migration + `db/request-board.ts` (ghi/đọc) + guard audit + test sở hữu bảng + cascade + tiện ích đếm truy vấn | AGENT, FOUNDATION | 2701 (duyệt plan) | số migration |
| 3 | VNX-2702b | `domain/request-board.ts` (máy trạng thái 7.1/7.2, `requestVisibility`, parse), cờ `request_board` + `REQUEST_BOARD_GO_LIVE` + `requestBoardEnabled` | AGENT, FOUNDATION | 2702a | — |
| 4 | VNX-2703a | Form `/request`: `country` + ô opt-in (batch tạo request + publication + audit) | AGENT | 2702b | chuỗi VI §12.6 để merge |
| 5 | VNX-2704a | Ops: khối "Public listing" (sửa, publish, reject, unpublish), audit, quyền, bản gốc vs bản công khai | AGENT, HIGH-RISK | 2702b | — |
| 6 | VNX-2703b | `/me/requests/:id`: khối "Public listing" (opt-in sau, gỡ, opt-in lại, lý do) | AGENT | 2703a, 2704a | chuỗi VI |
| 7 | VNX-2704b | Ops: cột "Public", bộ lọc `public=pending`, thẻ Overview "Public requests to review", 3 email cho client | AGENT, HIGH-RISK | 2704a | email: chuỗi |
| 8 | VNX-2705a | `/requests`, `/requests/:publicId`, `requestVisibility`, khối CTA 4.2 (chưa form interest) | AGENT, HIGH-RISK | 2704a | — |
| 9 | VNX-2705b | SEO: sitemap, `noindex`, hreflang, OG, robots, link `/for-builders` và footer | AGENT, HIGH-RISK | 2705a | — |
| 10 | VNX-2706a | Interest: POST + rút, rate limit, trần pending, form trên trang, mục Hub | AGENT | 2705a | — |
| 11 | VNX-2706b | Ops: khối "Interested builders", Dismiss, mời → `invited` cùng batch, thẻ Overview "Interests waiting" | AGENT | 2706a, 2704b | — |
| 12 | VNX-2707a | Khung pháp lý theo phiên bản (Privacy 3, Terms 2), cổng ngày, thông báo trước thứ hai | AGENT | 2702b | — |
| 13 | VNX-2707b | Chép Privacy/Terms đã duyệt vào `docs/legal/*`, `content.ts` (4 hằng số + phiên bản mới); câu chữ thông báo | AGENT | 2707a | **bản VI §12.6 được duyệt**, copy thông báo |
| 14 | VNX-2709 | Test cổng ra EPIC 27 (một request đi hết vòng đời qua HTTP), rà soát, báo cáo | AGENT | 2703b, 2705b, 2706b, 2707b | — |
| 15 | VNX-2708 | Owner: rule Cloudflare `/requests*`, commit `REQUEST_BOARD_GO_LIVE`, deploy, bật cờ sau ngày đó, smoke production | HUMAN, HIGH-RISK | 2709 | Q16 (đọc lại pháp lý) |

Thứ tự thực thi: 2701 → 2702a → 2702b → 2703a → 2704a → 2703b → 2704b → 2705a → 2705b → 2706a → 2706b → 2707a → 2707b → 2709 → 2708. **L8:** 2707a **không** song song: làm sau 2705b (chạm `render.ts`, `Layout.tsx`, thông báo); 2707b là task cuối trước cổng ra.

## Điểm phối hợp với EPIC 26 (và nhánh khác)

| Điểm | Quy tắc |
|---|---|
| Số migration | `00NN` = số trống kế tiếp trên `main` lúc cắt nhánh; lúc merge nếu trùng thì đổi tên file, không sửa nội dung. Cả hai epic ghi lại số cuối cùng vào comment thứ tự deploy trong `wrangler.jsonc` (migrate trước, deploy sau). |
| `FLAG_KEYS` | EPIC 26 cũng có thể thêm key. Cả hai thêm vào cuối mảng; ba test cứng ở `test/domain|db|admin/flags` phải được cập nhật bởi bên merge sau. |
| `privacy.md`, `privacy-m7.md`, `content.ts`, `terms.md` | EPIC 26 VNX-2607 sửa Privacy. **M5: nghĩa vụ của VNX-2607 = ba file Privacy (`privacy.md`, `privacy-m7.md`, `privacy-board.md`) và hai file Terms (`terms.md`, `terms-board.md`) cùng `termsEnBoard`/`termsViBoard`.** EPIC 26 sửa Privacy (tài khoản liên kết). Bên merge sau gộp thay đổi của bên kia vào **mọi** phiên bản Privacy đạt tới được (xem "Pháp lý"). `test/legal/content.test.ts` đỏ nếu quên. |
| Thông báo Privacy | Cửa sổ thông báo thứ hai (VNX-2707a) không được làm hỏng cửa sổ M7 hay cửa sổ EPIC 26 nếu có. |
| `app.ts`, `seo.ts`, `Layout.tsx` | Chỉ thêm đăng ký route/mục; gộp khi xung đột. |

## Pháp lý: phiên bản và cổng ngày (giải thích thiết kế VNX-2707)

Phụ lục §12.5 nói hai điều cần cùng đúng: (1) "sửa cả `privacy.md` và `privacy-m7.md`", (2) Q15 "tổng quát `privacyVersion` thành danh sách phiên bản có ngày hiện (`REQUEST_BOARD_GO_LIVE`)". Nếu chép câu chữ board vào **cả hai** phiên bản hiện có, Privacy và Terms sẽ nhắc tới bảng công khai ngay khi VNX-2707b lên production, trước ngày báo trước và trước khi tính năng tồn tại. Vì vậy plan chọn:

- Thêm phiên bản thứ ba `board` = M7 + các thay đổi board (+ gộp thay đổi EPIC 26 nếu đã merge), hiện từ `REQUEST_BOARD_GO_LIVE − 14 ngày` trở đi mãi mãi; `privacy.md` và `privacy-m7.md` **không** chứa câu chữ board.
- Terms (một phiên bản) thêm phiên bản `board` tương tự; `Last updated` của phiên bản mới = ngày go-live.
- Quy tắc hai phiên bản mở rộng thành "mọi phiên bản còn đạt tới được": bất kỳ thay đổi Privacy nào (EPIC 26 hay sau này) phải vào cả ba file và sáu hằng số cho tới task dọn. Test `test/legal/content.test.ts` so từng file với hằng số tương ứng; thêm test chặn "câu chữ board xuất hiện trong phiên bản cũ".
- Nếu lúc VNX-2707b bắt đầu mà `PRIVACY_NOTICE_GO_LIVE − 14` đã qua (phiên bản `current` không còn đạt tới được), Reviewer cho phép bỏ `current` khỏi danh sách theo task dọn riêng; không làm trong epic này.
- `REQUEST_BOARD_GO_LIVE` phải ≥ `PRIVACY_NOTICE_GO_LIVE` và `PRIVACY_NOTICE_GO_LIVE` phải khác rỗng khi biến board khác rỗng (phiên bản `board` chứa câu chữ cookie M7); `test/config/wrangler-guard.test.ts` kiểm cả hai.

Mọi chuỗi pháp lý chép nguyên văn từ phụ lục §12.2–12.4 (EN, đã duyệt) và §12.6 (VI, đã duyệt). Implementer **không dịch lại, không sửa chữ**; zh-Hans/zh-Hant chuỗi giao diện và email do AI dịch, người bản xứ đọc lại trước khi quảng bá (§5.1), trang Privacy/Terms zh hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" như hiện nay.

---

### Task VNX-2701: Owner duyệt (HUMAN)

Owner (không phải Implementer):

- [ ] Duyệt plan này (sau khi Reviewer Opus duyệt).
- [ ] Duyệt **bản VI §12.6** (Privacy mục 2, 3, 4, 6; Terms mục 5, 6, 7; nhãn và mô tả ô opt-in). Chưa có thì VNX-2707b không chạy và VNX-2703a/2703b không merge.
- [ ] Xác nhận các phán quyết ở **Open points** (OP-1 … OP-5, đã resolved) và **duyệt nguyên văn câu thông báo trước 14 ngày** (OP-2a).
- [ ] Chốt thứ tự EPIC 27 so với M8 và EPIC 26.
- [ ] Sắp xếp một người có chuyên môn pháp lý đọc phụ lục mục 12 (NĐ 13/2023, GDPR) trước VNX-2708 (Q16).
- [ ] Reviewer cập nhật tài liệu theo phụ lục §15 trong **commit tài liệu riêng** ngay khi Owner duyệt plan (không phải việc của Implementer): spec Wave 1 (dòng Phụ lục), `docs/blueprint/02-NFR.md`, `03-DOMAIN-CATALOG.md`, `05-UI-SCOPE.md`, `07-MASTER-BACKLOG.md` (VNX-1901 → EPIC 27), `docs/roadmap/WAVE1-ROADMAP.md` (mục EPIC 27 và cổng ra), spec Ops console §2, và `.ai/context/CURRENT-STATUS.md`.

---

### Task VNX-2702a: Migration, `db/request-board.ts`, guard audit, test sở hữu bảng

**Files:**
- Create: `apps/web/migrations/00NN_request_board.sql` (số: Step 1)
- Create: `apps/web/src/db/request-board.ts`
- Modify: `apps/web/src/db/audit.ts` (hai guard mới, hai nhánh `if` mới trong `auditStatement`)
- Modify: `apps/web/src/db/requests.ts` (`country` vào `Row`/`toRequest`/`NewRequest`; tách `createRequestStatements`, giữ `createRequest` làm bọc)
- Modify: `apps/web/src/domain/request.ts` (`ClientRequest.country: string | null`)
- Modify: `apps/web/test/architecture.test.ts` (`WRITERS`, `RANKING_FILES`)
- Modify: `apps/web/test/helpers.ts` (tiện ích `countD1Queries`)
- Modify: `apps/web/wrangler.jsonc` (chỉ comment thứ tự deploy: tên migration mới, migrate trước deploy sau)
- Test: `apps/web/test/db/request-board-migration.test.ts`, `apps/web/test/db/request-board.test.ts`, `apps/web/test/db/requests.test.ts` (thêm ca `country`), `apps/web/test/architecture.test.ts`

Ngoài phạm vi: domain thuần (2702b), mọi route và view.

**Dữ liệu (đúng phụ lục §6):**

```sql
-- EPIC 27 (addendum §6). Additive only.
ALTER TABLE requests ADD COLUMN country TEXT CHECK (country IS NULL OR length(country) = 2);

CREATE TABLE request_publications (
  request_id         TEXT PRIMARY KEY REFERENCES requests (id) ON DELETE CASCADE,
  public_id          TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL CHECK (status IN ('pending_review', 'published', 'rejected', 'withdrawn', 'unpublished')),
  public_title       TEXT CHECK (public_title IS NULL OR length(public_title) BETWEEN 1 AND 120),
  public_description  TEXT CHECK (public_description IS NULL OR length(public_description) BETWEEN 40 AND 4000),
  opted_in_at        TEXT NOT NULL,
  consent_version    TEXT NOT NULL,
  reviewed_by        TEXT REFERENCES users (id),
  reviewed_at        TEXT,
  review_note        TEXT CHECK (review_note IS NULL OR length(review_note) <= 1000),
  published_at       TEXT,
  ended_at           TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  CHECK (status <> 'published' OR (public_title IS NOT NULL AND public_description IS NOT NULL AND published_at IS NOT NULL))
);
CREATE INDEX idx_request_publications_status ON request_publications (status, published_at);

CREATE TABLE request_interests (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
  builder_id  TEXT NOT NULL REFERENCES builders (user_id),
  note        TEXT CHECK (note IS NULL OR length(note) <= 500),
  product_id  TEXT REFERENCES products (id),
  status      TEXT NOT NULL CHECK (status IN ('pending', 'invited', 'dismissed', 'withdrawn')),
  decided_by  TEXT REFERENCES users (id),
  decided_at  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (request_id, builder_id)
);
CREATE INDEX idx_request_interests_request ON request_interests (request_id, status);
CREATE INDEX idx_request_interests_builder ON request_interests (builder_id, created_at);
```

Không có cột tiền, điểm, ưu tiên, `boost`. Không `INSERT` dữ liệu trong migration (không công khai hồi tố). Ghi chú: `ALTER … ADD COLUMN` với `CHECK` hợp lệ trong SQLite khi mặc định NULL; nếu D1 từ chối, đưa CHECK ra thành kiểm ở domain và báo lại (không bỏ qua im lặng).

**Interfaces (`db/request-board.ts`; mọi hàm ghi trả `D1PreparedStatement`, route gộp vào `db.batch` cùng audit):**
- Kiểu: `Publication` (camelCase của mọi cột), `Interest`, `PublicationGuard = { requestId; status; updatedAt }`, `InterestGuard = { interestId; status; updatedAt }`.
- Ghi publication: `optInStatement(db, { requestId, publicId, consentVersion, now })` (INSERT … SELECT … WHERE request tồn tại, `status IN ('submitted','matching','pending_verification')` cho đường tạo; `reOptInStatement` cho `withdrawn → pending_review`, CAS, yêu cầu request đang `submitted|matching`: `SET status = 'pending_review', opted_in_at = ?now, consent_version = <hiện tại>, ended_at = NULL, updated_at = ?now`; **giữ** `public_id`, `published_at`, `public_title`, `public_description`; test khẳng định từng cột (M4)); `publishStatement` (CAS `pending_review → published`, đặt `public_title/description`, `published_at = COALESCE(published_at, ?now)`, `reviewed_by/at`, kèm `EXISTS requests.status IN ('submitted','matching')`); `editPublicStatement` (CAS, chỉ khi `published`, không đổi trạng thái); `rejectStatement` (`pending_review → rejected`, `review_note` bắt buộc); `unpublishStatement` (`published → unpublished`, `review_note`, `ended_at`); `withdrawStatement` (`pending_review|published → withdrawn`, `ended_at`, không điều kiện trạng thái request, không đọc cờ).
- Ghi interest: `createInterestStatement(db, { requestId, builderId, note, productId, now, pendingCap })` (một `INSERT … SELECT … WHERE` chứa **toàn bộ** cổng: request `submitted|matching` JOIN publication `published`; builder `approved` + user `active`; `r.client_user_id != builder`; `NOT EXISTS request_invites` cho cặp; `NOT EXISTS request_interests` cho cặp; `COUNT(pending của builder) < pendingCap`; nếu `productId` thì `EXISTS products p WHERE p.id = ? AND p.builder_id = ? AND p.status = 'published'`; `RETURNING *`); `withdrawInterestStatement` (CAS `pending → withdrawn`, theo `builder_id`); `dismissInterestStatement` (CAS `pending → dismissed`, `decided_by/at`); `markInterestsInvitedStatements(db, { requestId, builderIds, inviteIds, decidedBy, now })` (mỗi builder một `UPDATE … WHERE request_id AND builder_id AND status = 'pending' AND EXISTS (request_invites với id IN inviteIds và builder_id)`; trả mảng câu lệnh, `RETURNING id`). **H1:** trần `pending` (30) chỉ đếm interest `pending` của request **đang mở** (`r.status IN ('submitted','matching')` và publication `published`); interest `pending` của request đã đóng/ẩn không chiếm chỗ. **L9:** điều kiện builder ghi rõ trong SQL: `b.status = 'approved' AND u.status = 'active'` (ở `createInterestStatement`, `findViewerRelation` và mọi truy vấn hàng chờ Ops).
- Đọc: `findPublicationByRequestId`, `findPublicationByPublicId` (kèm các cột công khai của `requests`, **không** cột nhận dạng), `findPublicListing(db, publicId)` / `listOpenPublications(db, query, limit, offset)` / `countOpenPublications(db, query)` (chỉ cột công khai; điều kiện `p.status = 'published' AND r.status IN ('submitted','matching')`; sắp `published_at DESC, public_id DESC`), `listSitemapRequests(db, limit = 2000)`, `countOpenPublicationsAll(db)`, `listInterestsForRequest(db, requestId)` (kèm builder, `publicBuilderOnly`), `listBuilderInterests(db, builderId)`, `findInterestFor(db, requestId, builderId)`, `countPublicationReviewQueue(db)`, `countInterestQueue(db)`, `listPublicationsForOps` (cột `Public` ở danh sách).
- **H2 `findViewerRelation(db, publicId, userId)`:** MỘT truy vấn, chỉ gọi khi có người xem đã đăng nhập; trả `{ ownRequestId: string | null, inviteId: string | null, interest: { id, status } | null }`. `ownRequestId` chỉ khác null khi `r.client_user_id = userId` (đúng chủ request). View CTA chỉ nhận object này, **không bao giờ** nhận `request_id`/`client_user_id` của người khác. Đối tượng listing công khai (`findPublicListing`, `listOpenPublications`) **không** mang `request_id` hay `client_user_id` (test `Object.keys`). Tính vào ngân sách 8 truy vấn.
- `db/audit.ts`: `AuditPublicationGuard = { publicationRequestId; status; updatedAt }`, `AuditInterestGuard = { interestId; status; updatedAt }`, mỗi guard là một nhánh `INSERT … SELECT … WHERE EXISTS (…)` trong `auditStatement`, theo mẫu `inviteId`.
- `db/requests.ts`: `createRequestStatements(db, input & { id? })` trả `{ id, statements: [insert] }`; `createRequest` gọi nó rồi `.first()` như cũ. `country` là cột tùy chọn của `NewRequest` (mặc định `null`), không đổi hành vi mọi lời gọi cũ.

- [ ] **Step 1: Chọn số migration.** `git ls-tree --name-only origin/main apps/web/migrations/` và `git branch -a` (xem nhánh EPIC 26: `git ls-tree --name-only feat/epic26-linked-accounts apps/web/migrations/`); lấy số trống kế tiếp, ghi số vào báo cáo task. Đặt tên `00NN_request_board.sql`.
- [ ] **Step 2: Viết test trước** (đỏ) rồi migration, `db/request-board.ts`, guard, `createRequestStatements`.
- [ ] **Step 3:** thêm vào `WRITERS`: `request_publications` và `request_interests` → `../src/db/request-board.ts`. Thêm vào `RANKING_FILES`: `../src/db/request-board.ts`, `../src/domain/request-board.ts` (file có ở 2702b: thêm ở đó), `../src/routes/request-board.tsx`, `../src/routes/ops-request-board.tsx`, `../src/views/requests/*` (mỗi file thêm đúng lúc được tạo; test "lists only files that exist" bắt quên). `test/architecture.test.ts` phải xanh sau mỗi task.
- [ ] **Step 4:** tiện ích `countD1Queries(env, fn)` trong `test/helpers.ts`: tạo proxy `env` (không sửa `testEnv`), trả `{ env, queries() }` để truyền vào `createApp().request`; đếm mỗi lần chạy `first/all/run/raw` = 1, `batch(n)` = n; gọi `resetFlagCache()` trước khi đo (M3b); `batch([...n câu])` đếm là `n`; có test của chính nó (đếm đúng 3 lần `first`/`all`/`batch` giả định).

**Tests phải có:**
- `request-board-migration.test.ts`: bảng, cột, index tồn tại (`pragma_table_info`, `sqlite_master`); migration không tạo dòng nào (số dòng `request_publications` của request cũ = 0 sau áp migration: request tạo bằng `makeRequest` không có dòng); CHECK: `status='published'` với `public_title` null bị từ chối; `public_title` 121 ký tự bị từ chối; `public_description` 39 và 4001 bị từ chối; `request_interests.note` 501 bị từ chối; `country = 'USA'` bị từ chối, `'VN'` và `NULL` được; `UNIQUE (request_id, builder_id)`; `public_id` UNIQUE.
- **Cascade:** xóa request `pending_verification` (qua `deletePendingRequestStatement` và `deleteExpiredPendingRequests` với `created_at` cũ) kéo theo `request_publications` và `request_interests` của nó biến mất; request khác và dòng của request khác còn nguyên. Nếu đỏ vì khóa ngoại không bật: báo lại, xem quyết định 3.
- `request-board.test.ts` (đường ghi, từng hàm): `optInStatement` cho request `submitted` thành công; request `removed`/`builder_selected` không chèn dòng; tạo hai lần cho cùng request không chèn lần hai (PK); `publishStatement` CAS thua khi `updated_at` cũ → 0 dòng; `publish` chỉ `pending_review`; `published_at` đặt lần đầu và **không đổi** khi `reOptIn` rồi `publish` lần hai (opt-in lại không đẩy request lên đầu); `unpublish` cần `review_note`; `withdraw` chạy cho cả `pending_review` và `published`, kể cả khi request đã `closed`; `reOptIn` từ `rejected` và `unpublished` bị từ chối (0 dòng); interest: `createInterestStatement` chặn builder `pending`/`rejected`/`suspended`, user `suspended`, chính client, builder đã có `request_invites` của request đó, cặp trùng, request `closed`, request chưa `published` publication, trần pending (30 dòng pending của builder rồi dòng 31 → 0 dòng), product của builder khác, product chưa `published`; `markInterestsInvitedStatements` chỉ chuyển interest `pending` của builder vừa được mời; `dismiss` CAS.
- Đọc công khai: `listOpenPublications` chỉ trả `published` + request `submitted|matching`; **không có cột `client_name`, `client_user_id`, `title`, `description` gốc, `admin_note`, `locale`, `request_id` trong object trả về** (kiểm `Object.keys`); thứ tự `published_at DESC, public_id DESC` với hai dòng cùng `published_at`; `countOpenPublications` khớp `listOpenPublications` với bộ lọc; `listSitemapRequests` chỉ `open`.
- `requests.test.ts`: `createRequest` mặc định `country = null`; có thể ghi `'VN'`; `findRequestById` đọc lại.
- `architecture.test.ts`: `request_publications`, `request_interests` chỉ được ghi từ `db/request-board.ts`; các file mới trong `RANKING_FILES` không import `db/{merchants,programs,offers,conversions,revenue,clicks}.ts` và không chạm bảng tiền (đối chứng dương đã có từ M7).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/db/request-board-migration.test.ts test/db/request-board.test.ts test/db/requests.test.ts test/architecture.test.ts test/jobs/daily-requests.test.ts
npm test
```

---

### Task VNX-2702b: Domain thuần, cờ `request_board`, cổng `REQUEST_BOARD_GO_LIVE`

**Files:**
- Create: `apps/web/src/domain/request-board.ts`
- Modify: `apps/web/src/domain/flags.ts` (`FLAG_KEYS` thêm `"request_board"` ở cuối) **S1:** chỉ `test/domain/flags.test.ts` (so mảng cứng) cần sửa cho cờ mới; `test/db/flags.test.ts` và `test/admin/flags.test.ts` đọc `FLAG_KEYS` động.
- Modify: `apps/web/src/views/admin/FlagsPage.tsx` (nhãn/giải thích cờ mới nếu trang có bảng nhãn; câu nói rõ "bật sau `REQUEST_BOARD_GO_LIVE`")
- Modify: `apps/web/src/env.ts` (`Bindings.REQUEST_BOARD_GO_LIVE?: string`; `Variables.requestBoard: boolean`)
- Modify: `apps/web/src/app.ts` (**M1** middleware sau `sessionMiddleware`: `c.set("requestBoard", await isRequestBoardEnabled(c.env))`; `isRequestBoardEnabled` kiểm **ngày trước**, trả `false` ngay khi biến rỗng/chưa tới nên **không đọc D1** trước go-live; chỉ khi ngày đã tới mới đọc cờ qua `isFlagEnabled`)
- Modify: `apps/web/wrangler.jsonc` (`vars.REQUEST_BOARD_GO_LIVE: ""` + comment (a)–(c) như `PRIVACY_NOTICE_GO_LIVE`: ≥ 14 ngày sau lần deploy đầu mang nó; rỗng/sai dạng = tắt; commit trên `main` bằng `chore:`, không `--var`, không dashboard, không xóa)
- Create: `apps/web/src/http/request-board.ts` (`isRequestBoardEnabled(env, now)`: đọc `isFlagEnabled(db, "request_board")` rồi cổng ngày)
- Modify: `apps/web/test/domain/flags.test.ts` (danh sách key mới; hai test kia đọc `FLAG_KEYS` động, chỉ chạy lại)
- Modify: `apps/web/test/config/wrangler-guard.test.ts`
- Test: `apps/web/test/domain/request-board.test.ts`, `apps/web/test/http/request-board-gate.test.ts`

**`domain/request-board.ts` (thuần, không Hono/D1):**
- Hằng số: `PUBLICATION_STATUSES`, `INTEREST_STATUSES`, `PUBLIC_TITLE_MAX = 120`, `PUBLIC_DESCRIPTION_MIN = 40`, `PUBLIC_DESCRIPTION_MAX = 4000`, `REVIEW_NOTE_MAX = 1000`, `INTEREST_NOTE_MAX = 500`, `CLOSED_VISIBLE_DAYS = 30`, `INTEREST_DAILY_LIMIT = 10`, `INTEREST_PENDING_CAP = 30`, `MIN_OPEN_FOR_INDEX = 5`, `BOARD_PAGE_SIZE = 24`, `EXCERPT_LENGTH = 200`.
- `publicationTransition(status | null, action, actor)` → `{ ok, status } | { ok:false, error:"invalid_transition" }`; actions `opt_in` (client; từ `null`), `re_opt_in` (client; từ `withdrawn`), `publish` (ops; `pending_review`), `reject` (ops; `pending_review`), `unpublish` (ops; `published`), `withdraw` (client; `pending_review`, `published`). `edit` không phải chuyển trạng thái nhưng có `canEditPublication(status)` (chỉ `published`). `rejected`, `unpublished` là trạng thái cuối (không có chuyển nào đi ra). Quy tắc theo trạng thái **request** (publish chỉ `submitted|matching`; re-opt-in chỉ `submitted|matching`) đi qua tham số `requestStatus`.
- `interestTransition(status, action, actor)`: `invite` (system/ops; `pending → invited`), `dismiss` (ops; `pending → dismissed`), `withdraw` (builder; `pending → withdrawn`); cả ba đích là cuối.
- `requestVisibility(requestStatus, publicationStatus | null, closedAt | null, now): "open" | "closed" | "hidden"` đúng bảng §7.3: `submitted|matching` + `published` → `open`; trạng thái cuối `builder_selected|rejected|expired|closed` + `published` → `closed` khi `now < closedAt + 30 ngày` (UTC, nửa mở: `+30d − 1ms` là `closed`, đúng `+30d` là `hidden`), sau đó `hidden`; `removed`, `pending_verification`, publication khác `published` hoặc `null` → `hidden`; **trạng thái cuối mà `closedAt` null hoặc không đọc được → `hidden`** (fail closed).
- `parsePublicListing({ title, description })`: title 1–120 sau trim, không ký tự điều khiển; description 40–4000, `normalizeNewlines`, văn bản thuần; trả mã lỗi `required|too_short|too_long|invalid` như `parseRequestForm`. **L1:** độ dài đếm theo code point (`[...s].length`), khớp CHECK `length()` của SQLite; test: 20 emoji (40 code unit, 20 code point) → `too_short`, HTTP 400.
- `parseReviewNote(raw)` bắt buộc ≤ 1000 (dùng cho reject và unpublish); `parseInterestForm({ note, productId })`: note ≤ 500 (rỗng được), productId rỗng được.
- `publicExcerpt(description)`: 200 ký tự đầu theo code point (không cắt giữa surrogate), gộp xuống dòng thành khoảng trắng, thêm "…" khi bị cắt.
- `parseBoardQuery(query)`: `category` ∈ `CATEGORIES`, `budget` ∈ `BUDGET_BANDS`, `lang` ∈ `WORK_LANGUAGES`, `page` ≥ 1; giá trị lạ bị bỏ (như `parseCatalogQuery`); **không có tham số `sort`**.
- `isBoardIndexable(openCount)` = `openCount >= MIN_OPEN_FOR_INDEX`.
- Cổng ngày: `parseBoardGoLive(raw)` (dùng lại `parsePrivacyNoticeDate`), `isBoardLive(goLive, now)` (đúng `goLive 00:00:00Z` trở đi, không bao giờ tắt lại), `boardEnabled({ flag, goLive, now })` = `flag && isBoardLive`.

**`http/request-board.ts`:** `isRequestBoardEnabled(env, now = new Date())`: đọc cờ qua `isFlagEnabled` (đã fail closed khi D1 lỗi), rồi `isBoardLive(env.REQUEST_BOARD_GO_LIVE, now)`; hai nửa đều phải đúng.

**Tests phải có:**
- Domain: mọi chuyển hợp lệ và không hợp lệ của 7.1 (kể cả `rejected → pending_review` bị từ chối, `unpublished → pending_review` bị từ chối, `withdrawn → pending_review` hợp lệ với request mở, bị từ chối với request đã đóng; `publish` bị từ chối khi request `pending_verification`, `builder_selected`, `removed`); mọi chuyển của 7.2; `requestVisibility` cho **mọi ô** bảng §7.3 (8 trạng thái request × publication `published` / khác / `null`), cộng biên `closedAt + 30d − 1ms` (`closed`), `+ 30d` (`hidden`), `closedAt = null` ở trạng thái cuối (`hidden`), `closedAt` rác (`hidden`); `parsePublicListing` các biên 0/1/120/121 và 39/40/4000/4001, ký tự điều khiển; `parseInterestForm` 500/501; `publicExcerpt` với chuỗi CJK và emoji (không cắt giữa cặp surrogate), có và không có xuống dòng; `parseBoardQuery` bỏ tham số lạ, `sort=paid` bị bỏ qua; `isBoardIndexable(4)`/`(5)`; `isBoardLive` cho biên `goLive − 1ms`/`goLive`, rỗng, `2026-02-30`, `2026-10-20T00:00`.
- `FLAG_KEYS` kết thúc bằng `"request_board"`; ba test cứng được cập nhật; cờ mới tắt mặc định (không có dòng = tắt).
- `request-board-gate.test.ts`: cờ bật + ngày chưa tới → tắt; cờ tắt + ngày đã qua → tắt; cả hai → bật; biến rỗng/sai dạng → tắt; D1 đọc cờ lỗi → tắt (mock `readFlags` ném lỗi); đồng hồ dùng `vi.useFakeTimers({ toFake: ["Date"] })` như `privacy-version.test.ts`.
- **Mẫu test cờ (M2, áp cho mọi test dùng cổng bật):** cổng bật = `setFlag(…, "request_board", enabled: true)` **và** env riêng từng request `{ ...testEnv, REQUEST_BOARD_GO_LIVE: <ngày quá khứ> }` truyền vào `createApp().request(…, env)`; `afterEach` đặt cờ về tắt và gọi `resetFlagCache()`. Ca cổng tắt dùng **nửa ngày** (`""` hoặc ngày tương lai), không bao giờ giả định cờ DB đang tắt.
- **M3a fail-closed:** `resetFlagCache()`, rồi env có `DB` là proxy mà `prepare(…).all()` reject; `isRequestBoardEnabled` trả `false` (không spy lên `readFlags` cùng module).
- **M3b `countD1Queries` (task 2702a):** trả proxy `env` truyền vào `createApp().request`, **không** sửa `testEnv` dùng chung; đếm mỗi lần chạy `first/all/run/raw` = 1, `batch(n câu)` = n; gọi `resetFlagCache()` trước khi đo.
- `wrangler-guard.test.ts`: `REQUEST_BOARD_GO_LIVE` có trong `vars`, rỗng hoặc ngày hợp lệ; nếu khác rỗng thì `PRIVACY_NOTICE_GO_LIVE` khác rỗng và `REQUEST_BOARD_GO_LIVE ≥ PRIVACY_NOTICE_GO_LIVE`; không có secret trong `vars`. **M7:** thêm kiểm `docs/legal/privacy-board.md` là **tập cha** của `privacy-m7.md`: mọi dòng của M7 có mặt trong board, hoặc nằm trong danh sách dòng bị thay thế nêu tường minh trong test (§12.2 "thay gạch thứ hai" mục 4, "Last updated").
- Architecture: `domain/request-board.ts` không import Hono/db/D1 (test hiện có tự phủ); thêm file vào `RANKING_FILES`.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/domain/request-board.test.ts test/http/request-board-gate.test.ts test/domain/flags.test.ts test/db/flags.test.ts test/admin/flags.test.ts test/config/wrangler-guard.test.ts test/architecture.test.ts
npm test
```

---

### Task VNX-2703a: Form `/request` — `country` và ô opt-in

**Chặn bởi:** chuỗi VI §12.6 (nhãn và mô tả ô opt-in) để **merge**; viết code được ngay với đúng chuỗi trong phụ lục.

**Files:**
- Modify: `apps/web/src/domain/request.ts` (`RequestFormValues.country`, `RequestFormValues.publish`, `RequestField` thêm `"country"`, `RequestInput.country: string | null`; `parseRequestForm`; `requestValuesFromBody`)
- Modify: `apps/web/src/routes/request-form.tsx` (`submitForm`, `createPendingRequestAndMail`)
- Modify: `apps/web/src/views/RequestFormPage.tsx` (trường country, ô opt-in + mô tả, hiện ô chỉ khi cổng bật)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/domain/request.test.ts`, `apps/web/test/public/request-form.test.ts`, `apps/web/test/request-gate.test.ts`, `apps/web/test/i18n/parity.test.ts` (tự chạy)

**Hành vi (phụ lục §3.1):**
- Trường `country`: `<select>` tùy chọn (option rỗng "Not specified"), giá trị trong `COUNTRY_CODES`, tên theo `countryName(locale, code)`; **không** điền từ `cf.country` hay IP. Giá trị ngoài danh sách → lỗi `choice` cho trường, form 400 giữ giá trị khác. Rỗng → `null`.
- Ô "Show this request on the public request board": checkbox `name="publish" value="1"`, **mặc định không chọn**, chỉ render khi `isRequestBoardEnabled`; ngay dưới là mô tả (phụ lục §12.4: không ghi tên người, tên công ty, liên hệ, thông tin mật; quốc gia + ngân sách + ngách cụ thể có thể nhận ra doanh nghiệp). Khi cổng tắt, mọi giá trị `publish` gửi lên bị **bỏ qua** (request vẫn tạo, không có dòng publication, không lỗi).
- Chọn ô (và cổng bật): trong **cùng `db.batch`** (L2: **không chọn ô → đường hiện tại giữ nguyên**, không đổi số câu lệnh; **chọn ô → một batch** gồm insert request, insert publication, audit `request.submit` (hoặc `request.create` khi chưa đăng nhập) và audit `request_publication.opt_in`) tạo request: `createRequestStatements` + `optInStatement` (`consent_version = REQUEST_BOARD_GO_LIVE`, `public_id` mới) + audit `request_publication.opt_in` (guard theo publication; `actor` = client; `data: { consentVersion }`, không câu chữ). Đường đã đăng nhập: batch thay cho `createRequest` + `writeAudit` rời (audit `request.submit` của request đi vào cùng batch, guard theo `AuditRequestGuard`). Đường chưa đăng nhập: request `pending_verification` + publication `pending_review` + audit trong batch, **trước** khi gửi email; gửi mail lỗi → `deletePendingRequestStatement` → cascade xóa publication (không còn dòng mồ côi). **L3:** đường chưa đăng nhập, gửi mail lỗi → cascade xóa request và publication nhưng dòng audit `request_publication.opt_in` (và `request.create`) **còn lại, mồ côi**: chấp nhận; test khẳng định dòng đó không chứa PII (không email, tên, câu chữ; chỉ `consentVersion`).
- Không chọn ô: không có dòng nào (request riêng tư như M6); hành vi và số câu lệnh không đổi.
- Request `pending_verification` **không** vào hàng chờ kiểm duyệt (truy vấn hàng chờ lọc theo trạng thái request, VNX-2704b). Cron 48 giờ xóa request chưa xác nhận thì publication đi theo (cascade).
- Giữ nguyên: honeypot, Turnstile khi chưa đăng nhập, rate limit (IP/giờ, email/ngày), đường xác nhận email (`openPendingRequest` không đổi, publication giữ `pending_review` sang `submitted`).
- Sửa intro form (`request.form.intro`) chỉ khi cần: câu hiện tại nói builder thấy tên chứ không thấy email, vẫn đúng; **không** thêm lời hứa mới ngoài §12.

**i18n (×4 locale, parity):** `request.form.country`, `request.form.countryHint`, `request.form.countryAny`, `request.error.country`, `request.board.optIn.label`, `request.board.optIn.hint`. EN và VI **chép nguyên văn** nhãn/mô tả từ phụ lục §12.4 và §12.6; zh-Hans và zh-Hant dịch AI (đánh dấu cần người bản xứ đọc lại, như M5–M7). Test `request-form.test.ts` khẳng định chuỗi EN và VI bằng đúng chuỗi trong phụ lục.

**Tests phải có:**
- Domain: `country` hợp lệ (`VN`), rỗng (`null`), không hợp lệ (`XX`, `vn` chữ thường, `USA`, có khoảng trắng) → `choice`; `publish` chỉ nhận `"1"`; `parseRequestForm` không đổi hành vi cho dữ liệu cũ.
- HTTP: cổng tắt → HTML `/request` **không** chứa ô opt-in (không có `name="publish"`) và POST có `publish=1` tạo request **không** có dòng publication; cổng bật → có ô, **không** `checked`, có câu cảnh báo; đăng nhập + chọn → 303, một dòng `request_publications` `pending_review` đúng `consent_version`, `request.country` đúng, một audit `request_publication.opt_in` cùng `request_id`; chưa đăng nhập + chọn → `pending_verification`, publication `pending_review`, **không** vào hàng chờ Ops; chưa đăng nhập + mail lỗi (mailer giả ném lỗi) → request **và** publication không còn (kiểm đúng ID của test này); không chọn → không dòng publication; `country=XX` → 400 và không tạo gì; hàng chờ lỗi ghi: batch thua (giả lập `batch` ném) → không request, không publication, không audit.
- Không hồi tố: request tạo trước đó (fixture `makeRequest`) không có dòng publication, `/requests/<bất kỳ>` 404.
- Riêng tư: HTML form không có `client_name`/email của người khác; ô opt-in mô tả đúng §12.4.
- i18n parity 4 locale (`npm test -w apps/web -- test/i18n/parity.test.ts`); không `style=`/`<script` inline mới (test CSP hiện có phủ `views/`).
- Body: POST `/request` 70 KB → 413 (hành vi hiện có, thêm ca với trường `publish`).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/domain/request.test.ts test/public/request-form.test.ts test/request-gate.test.ts test/i18n/parity.test.ts test/jobs/daily-requests.test.ts
npm test
```

---

### Task VNX-2704a: Ops — khối "Public listing" (kiểm duyệt)

**Files:**
- Create: `apps/web/src/routes/ops-request-board.tsx` (`registerOpsRequestBoardRoutes`; hành động Ops)
- Create: `apps/web/src/views/ops/PublicListingBlock.tsx`
- Modify: `apps/web/src/views/ops/RequestsPages.tsx` (`RequestDetailPage` nhận `publication`; render khối)
- Modify: `apps/web/src/routes/ops-marketplace.tsx` (nạp publication vào `requestDetail`; cho phép route con dùng lại helper `requestDetail`)
- Modify: `apps/web/src/app.ts` (đăng ký route mới sau `registerOpsMarketplaceRoutes`, trước catch-all `/ops`)
- Modify: `apps/web/src/i18n/messages/en.ts` (`ops.board.*`, **chỉ EN**)
- Test: `apps/web/test/ops/marketplace-request-board.test.ts`, `apps/web/test/ops/guard.test.ts` (thêm route), `apps/web/test/architecture.test.ts`

**Route và hành vi (phụ lục §3.2, §5):** (đều dưới `REQUESTS_PATH = /ops/marketplace/requests`; GET chi tiết đã có, khối chỉ hiện khi có publication)
- `GET :id` hiện khối "Public listing" **chỉ khi** có dòng `request_publications` và vai trò có `marketplace.act`. Khối: bản gốc của client (title, description của request) và ô sửa `public_title` (≤ 120), `public_description` (40–4000), điền sẵn từ bản gốc nếu chưa có `public_*`; các trường có cấu trúc (`category`, `budget_band`, `country`, `deadline`, `languages`) hiện **chỉ đọc** (Q4, Ops không sửa); **danh mục kiểm duyệt** (§3.2) hiện ngay trong khối; trạng thái, `review_note`, ngày. Viewer thấy trang như cũ (đã có `marketplace.view`) nhưng **không** thấy khối này (Open point OP-4).
- `POST :id/publication/publish`, `/edit`, `/reject`, `/unpublish` — `requireOps("marketplace.act")` (Content, Viewer, người lạ → 404 kín).
  - `publish` (`pending_review → published`): `parsePublicListing`; CAS theo `updatedAt` ẩn trong form; chỉ khi request `submitted|matching`; lưu bản đã sửa; thành công → redirect `done=1`. Task này **không** gửi email (email publish/reject/unpublish thêm ở VNX-2704b); không để `TODO` hay hàm rỗng trong code.
  - `edit` (đang `published`): lưu `public_*`, không đổi trạng thái; audit `.edit`; **không** email (phụ lục chỉ email cho publish/từ chối/gỡ).
  - `reject` (`pending_review → rejected`): `review_note` bắt buộc ≤ 1000; client thấy lý do; request tiếp tục ghép riêng tư (không đổi `requests`).
  - `unpublish` (`published → unpublished`): `review_note` bắt buộc; `ended_at`.
  - Lỗi parse → 400 hiển thị lại trang với giá trị đã nhập và lỗi trường; chuyển không hợp lệ hoặc thua CAS → 409 "current state", **không ghi gì, không audit**.
- Mọi POST: `db.batch([ câu thay đổi, auditStatement(… guard = AuditPublicationGuard) ])`; action audit `request_publication.publish|edit|reject|unpublish`, `entity: "request_publication"`, `entityId = request_id`, `data` chỉ `{ requestId, from, to }` (không câu chữ, không `review_note`). `reviewed_by = ops user`.
- Lịch sử (History) của trang: thêm `historyOf(c, "request_publication", requestId)` bên cạnh History của request, qua projection an toàn hiện có.

**i18n:** `ops.board.*` chỉ trong `en.ts` (ADR-010, console tiếng Anh).

**Tests phải có** (`marketplace-request-board.test.ts`, fixture riêng mỗi test: client, request, publication qua hàm của `db/request-board.ts`):
- **Quyền:** Owner và Operator publish/edit/reject/unpublish được; Content, Viewer → mỗi POST trả 404 kín và **không** ghi (kiểm bảng và `audit_log` của request đó); người chưa đăng nhập → 404 kín, không redirect; user bị khóa → 404; GET chi tiết với Viewer → 200 nhưng HTML **không** có khối "Public listing" và không có bản `public_*`.
- **Publish:** `pending_review → published` lưu bản đã sửa, `published_at` đặt lần đầu; ngay sau đó `findPublicListing` thấy bản đã sửa, **không** thấy bản gốc; request `pending_verification`/`builder_selected`/`removed` → 409 và không đổi; CAS: form với `updatedAt` cũ → 409 và không audit; publish hai lần liên tiếp → lần hai 409.
- **Sửa khi `published`:** đổi `public_*`, trạng thái giữ `published`, `published_at` giữ; một audit `.edit`; `pending_review` thì `edit` → 409.
- **Reject:** thiếu `review_note` → 400 không ghi; có → `rejected`, request giữ nguyên trạng thái (`submitted`/`matching`); từ `rejected` không `publish` được (409); client không opt-in lại được (kiểm ở 2703b).
- **Unpublish:** thiếu lý do → 400; có → `unpublished`, trang công khai (khi có ở 2705a) 404.
- **Audit cùng batch:** giả lập `batch` thua CAS (hai request đồng thời hoặc `updatedAt` cũ) → **không** có dòng audit mới; thành công → đúng một dòng với `entity="request_publication"`, `data` **không** chứa chuỗi `public_title` đã nhập, `review_note`, email, tên client (assert vắng mặt bằng chuỗi nhận diện).
- **Không lộ ở History:** History của khối hiện `action` và `entity` nhưng không câu chữ.
- **Body:** `public_description` 4000 ký tự CJK (12 KB) → OK; POST > 64 KB → 413.
- **Thứ tự/ADR-004:** `routes/ops-request-board.tsx` và `views/requests/*` không import module tiền (test kiến trúc).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/ops/marketplace-request-board.test.ts test/ops/guard.test.ts test/ops/marketplace-requests.test.ts test/architecture.test.ts
npm test
```

---

### Task VNX-2703b: `/me/requests/:id` — khối "Public listing"

**Chặn bởi:** chuỗi VI §12.6 (để merge).

**Files:**
- Modify: `apps/web/src/routes/me-requests.tsx` (thêm `POST /me/requests/:id/publication/opt-in` và `/withdraw`; nạp publication vào `requestPage`)
- Modify: `apps/web/src/views/me/RequestPage.tsx` (khối "Public listing")
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/me/request-board.test.ts`, `apps/web/test/me/requests.test.ts` (không hỏng)

**Hành vi (phụ lục §4.3, §7.1):** `findClientRequest` đã giới hạn cho chủ sở hữu và ẩn `removed`; mọi route mới dùng `load(c)` đó (người khác, `removed`, không tồn tại → 404, không ghi gì).
- Chưa opt-in, request `submitted|matching`, **cổng bật**: nút opt-in (cùng nhãn và mô tả §12.4) → `optInStatement` (`pending_review`) + audit `request_publication.opt_in` cùng batch.
- `pending_review`: "Waiting for review" + nút **Remove from board**.
- `published`: link tới `/requests/:publicId` (nếu `requestVisibility` ≠ `hidden`), **bản công khai đúng như đang hiện** (`public_title`, `public_description`), nút **Remove from board**.
- `rejected` / `unpublished`: lý do (`review_note`) của Ops; **không** có nút opt-in lại (Q6).
- `withdrawn`: nút opt-in lại **chỉ** khi request `submitted|matching` và cổng bật (`reOptInStatement`, giữ `public_id`, `published_at`); trạng thái kết thúc khác → không nút. **M6/OP-1 (ruling): không giới hạn số lần opt-in lại** (đúng Q6); rủi ro Ops bị spam hàng chờ ghi vào "Ghi nhận" của `CURRENT-STATUS.md`.
- Gỡ (`withdraw`): `pending_review|published → withdrawn`, hiệu lực ngay, **bất kể** trạng thái request và **bất kể cổng**; audit `request_publication.withdraw` cùng batch; redirect `303` về `/me/requests/:id`. Thua CAS (đã gỡ, đã bị Ops đổi) → 409. **L5:** `findClientRequest` ẩn request `removed` nên không gỡ được trên request `removed` (đã `hidden` công khai): chấp nhận.
- Cổng tắt: không nút opt-in; trạng thái hiện có vẫn hiện (chỉ đọc) và nút gỡ vẫn có nếu đang `pending_review|published`.
- Giới hạn tần suất opt-in lại: **không có** (OP-1 resolved: đúng Q6, không trần).

**i18n (×4):** `me.board.title`, `me.board.optIn`, `me.board.reOptIn`, `me.board.pending`, `me.board.live`, `me.board.viewPublic`, `me.board.remove`, `me.board.removed`, `me.board.rejectedReason`, `me.board.unpublishedReason`, `me.board.finalNote`. Nhãn/mô tả opt-in dùng lại `request.board.optIn.*` (2703a).

**Tests phải có:**
- Opt-in sau từ `/me` cho request đã gửi trước khi tính năng bật (không có dòng publication): thành công, đúng `consent_version`, request vẫn `submitted`; request `pending_verification` hoặc đã đóng → không có nút, POST → 409 và không ghi; người khác → 404; cổng tắt → nút không có, POST → 404.
- Gỡ: từ `pending_review` và `published` → `withdrawn`; sau gỡ `GET /requests/:publicId` → 404 **ngay** (kiểm trong cùng test, không cache); gỡ khi request đã `builder_selected` thành công; gỡ khi cổng tắt thành công; gỡ hai lần → lần hai 409; audit cùng batch (một dòng mỗi lần thành công, không dòng khi 409).
- Opt-in lại sau gỡ (request mở) → `pending_review`, `published_at` cũ giữ nguyên (so với giá trị trước); `rejected`/`unpublished` → không nút, POST → 409.
- Khối `published` hiện đúng bản công khai (không phải bản gốc khi Ops đã sửa); khối không chứa `review_note` của request khác; `rejected` hiện lý do.
- Không lộ: trang `/me` của client A không bao giờ chứa `publicId` hay nội dung của client B.
- i18n parity; không `style=`/`<script` inline.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/me/request-board.test.ts test/me/requests.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2704b: Ops — cột "Public", bộ lọc, thẻ Overview, 3 email cho client

**Files:**
- Create: `apps/web/src/email/templates/request-board.ts` (3 template × 4 locale)
- Create: `apps/web/src/notify/request-board.ts` (`notifyPublicationPublished|Rejected|Unpublished`, không bao giờ ném lỗi, khuôn `notify/request.ts`)
- Modify: `apps/web/src/routes/ops-request-board.tsx` (gọi notify sau commit; `mail_failed` notice)
- Modify: `apps/web/src/routes/ops-marketplace.tsx` (`requestFilter` giữ `public=pending`; danh sách đọc cột Public)
- Modify: `apps/web/src/views/ops/RequestsPages.tsx` (cột "Public": `—` / `review` / `published` / `rejected` / `withdrawn` / `unpublished`; không thêm tab)
- Modify: `apps/web/src/routes/ops.tsx`, `apps/web/src/views/ops/OverviewPage.tsx` (`QUEUE_IDS`, `QUEUE_LABEL`, `QUEUE_LINK`, `QUEUE_TARGETS`, `reads`: thẻ "Public requests to review")
- Modify: `apps/web/src/db/request-board.ts` (`countPublicationReviewQueue`, cột Public cho `searchRequestsForAdmin` qua JOIN trong hàm mới ở file này, không sửa SQL của `db/requests.ts` nếu tránh được)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (khóa email) và `en.ts` (`ops.*`)
- Test: `apps/web/test/ops/marketplace-request-board.test.ts` (thêm), `apps/web/test/ops/overview.test.ts`, `apps/web/test/email/request-board-templates.test.ts`, `apps/web/test/notify/request-board.test.ts`, `apps/web/test/i18n/parity.test.ts`

**Hành vi:**
- Danh sách Requests: cột "Public"; bộ lọc `?public=pending` (allowlist: chỉ `pending`, mọi giá trị khác bị bỏ) giữ cùng `status`/`q`; không thêm tab (đã có 9). **L6:** `?public=pending` **ghi đè** `status` mặc định (`submitted`) và hiện cả `submitted` lẫn `matching` (mọi request mở có publication `pending_review`).
- Thẻ Overview "Public requests to review": đếm publication `pending_review` của request `submitted|matching` **hiện đang xác nhận** (loại `pending_verification`, loại request đã đóng); đủ hai trạng thái của spec §7.4 (không bao giờ hiện 0 giả khi truy vấn lỗi: `state:"error"`); link tới `?public=pending` chỉ khi vai trò có `marketplace.view` và route đã đăng ký (`reachable`). Content (không `overview.detail`) chỉ thấy số và nhãn như các thẻ khác.
- 3 email cho client (Q19), gửi **sau** commit, theo locale của request (`asLocale(request.locale)`): **published** (link tới `/requests/:publicId`, và nếu Ops đã sửa câu chữ so với bản gốc thì ghi rõ "đã sửa" kèm hướng dẫn gỡ ở `/me`), **rejected** (kèm `review_note`; request vẫn ghép riêng tư), **unpublished** (kèm `review_note`). Không email khi `edit`, khi client tự gỡ, khi interest. Lỗi gửi **không** hoàn tác thay đổi: ghi `console.error` JSON (không địa chỉ), Ops thấy notice `mail_failed`.
- "Đã sửa" xác định bằng so `public_title`/`public_description` với `title`/`description` gốc (so sánh sau chuẩn hóa xuống dòng), tại thời điểm publish.

**Tests phải có:**
- Cột/bộ lọc: request có publication `pending_review` hiện `review`; `?public=pending` chỉ liệt kê request đang `pending_review` + `submitted|matching`; giá trị `public=hacked` bị bỏ; không có tab thứ 10.
- Overview: thẻ đếm đúng độ lệch (thêm một publication `pending_review` → số tăng đúng 1, đo trước/sau, không giả định 0); request `pending_verification` không tính; request đã đóng không tính; truy vấn lỗi → `state:"error"` (mock) chứ không phải 0; Content thấy số, không link; Viewer thấy link.
- Email: mỗi template có tiêu đề + nội dung đủ 4 locale; **không** chứa email/tên client của người khác, không chứa `admin_note`; `published` chứa link `/requests/<publicId>` đúng locale và câu "đã sửa" **chỉ khi** có sửa; `rejected`/`unpublished` chứa lý do; không chứa `request_id`; HTML escape đúng với `review_note` có `<script>`.
- Notify: gửi lỗi (mailer giả ném) → thay đổi vẫn giữ, notice `mail_failed`, không ném; không email khi `edit`/`withdraw`.
- Parity 4 locale cho khóa email; `ops.*` chỉ ở `en.ts`.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/ops/marketplace-request-board.test.ts test/ops/overview.test.ts test/email/request-board-templates.test.ts test/notify/request-board.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2705a: Trang công khai `/requests` và `/requests/:publicId`

**Files:**
- Create: `apps/web/src/routes/request-board.tsx` (`registerRequestBoardRoutes`)
- Create: `apps/web/src/views/requests/BoardPage.tsx`, `apps/web/src/views/requests/RequestCard.tsx`, `apps/web/src/views/requests/RequestDetail.tsx`, `apps/web/src/views/requests/InterestBlock.tsx` (CTA 4.2; form interest ở 2706a)
- Modify: `apps/web/src/app.ts` (đăng ký; **trước** `registerProductPageRoutes` không bắt buộc, nhưng sau `registerRequestFormRoutes`: không trùng `/request`)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/public/request-board-list.test.ts`, `apps/web/test/public/request-board-detail.test.ts`, `apps/web/test/architecture.test.ts`

**Route (qua `onLocalized`, 4 locale; chỉ GET ở task này):**
- `GET /requests`: cổng tắt → 404 theo locale (`errorResponse`). Truy vấn `parseBoardQuery`; `listOpenPublications` + `countOpenPublications` (hai truy vấn, thêm session và cờ: ≤ 8 tổng). 24 thẻ/trang; thẻ: `public_title`, category, budget band (nhãn i18n hiện có, gồm `unsure`), country (tên theo locale, chỉ khi có), ngôn ngữ, deadline, ngày đăng (`published_at`), `publicExcerpt` 200 ký tự (văn bản thuần); thứ tự **chỉ** `published_at DESC, public_id DESC`. Bộ lọc là form GET: `SelectFilter` category, budget band, ngôn ngữ (Q14); không tìm kiếm chữ, không lọc quốc gia, không tham số sort. Trang > 1 rỗng → 404 (như `/products`). Trạng thái rỗng: câu giải thích + CTA **Post a request** (`/request`) và **Browse products** (`/products`); **không có thẻ mẫu**.
- `GET /requests/:publicId`: `findPublicListing(publicId)` rồi `requestVisibility(...)` **một** hàm: `hidden` → 404 theo locale (không phân biệt "không tồn tại" với "ẩn"); `open` → 200; `closed` → 200 với nhãn "Closed" và `noindex` (SEO chi tiết ở 2705b). Nội dung: `public_title`, nhãn Open/Closed, category, budget band, country (nếu có), deadline ("No deadline" khi null), ngôn ngữ, ngày đăng, `public_description` render qua `PlainText` (văn bản thuần), câu "The client's identity is not shown. The VNX.SI team invites up to five builders." và khối CTA.
- **Khối CTA (§4.2), chưa có form interest ở task này** (form do 2706a): chưa đăng nhập → nút "I'm a builder — I'm interested" tới `/login?next=<đường dẫn localized của trang>`; đã đăng nhập chưa là builder → câu ngắn + link `/for-builders`; builder `pending|rejected|suspended` → câu "Available once your builder profile is approved", không nút; chính client của request → link `/me/requests/:id`; `closed` → chỉ "This request is closed" + CTA **Post a request**. Để chỗ cho builder `approved` (2706a điền).
- **Trang không bao giờ có:** tên client (kể cả `builderFacingName`), email, `client_user_id`, `locale`, `admin_note`, bản gốc, số lời mời, đề xuất, số builder quan tâm, kết quả (`builder_selected`/`expired`; chỉ "Closed"), `request_id`.
- Đã đăng nhập: `no-store` (middleware hiện có); chưa đăng nhập: **không** `Cache-Control: public`/`max-age`.
- Tiền tố locale: `/vi/requests`, `/zh-hans/requests/:publicId`… Nội dung request giữ ngôn ngữ client, không dịch; giao diện dịch 4 locale.

**i18n (×4):** `board.title`, `board.intro`, `board.empty.title`, `board.empty.body`, `board.cta.post`, `board.cta.products`, `board.filter.category|budget|language|any|apply`, `board.card.posted`, `board.card.deadline`, `board.deadline.none`, `board.status.open`, `board.status.closed`, `board.detail.country|languages|budget|category|deadline|posted`, `board.detail.identityNote` (đúng chuỗi: "The client's identity is not shown. The VNX.SI team invites up to five builders."), `board.detail.closedNote`, `board.cta.signedOut`, `board.cta.notBuilder`, `board.cta.pendingBuilder`, `board.cta.ownRequest`, `board.cta.closed`.

**Tests phải có** (`request-board-detail.test.ts` / `request-board-list.test.ts`; mỗi test tự tạo client, request, builder, publication với chuỗi nhận diện duy nhất như `ZQX-CLIENT-NAME`, `zqx@private.example`, `ZQX-ORIGINAL-TITLE`, `ZQX-ADMIN-NOTE`):
- **Không lộ dữ liệu:** HTML chi tiết **và** HTML thẻ trong danh sách **không** chứa email, `client_name`, bản che tên (`builderFacingName` của tên đó), `admin_note`, **bản gốc** `title`/`description` khi Ops đã sửa (bản công khai khác bản gốc), `request_id`, `client_user_id`, `locale` của client, số lời mời (`3 invited` hay tương tự), đề xuất, số builder quan tâm, kết quả `builder_selected`/`expired`; chạy cho 4 locale.
- **Hiển thị (bảng §7.3) qua HTTP:** `submitted` và `matching` + `published` → 200, `Open`; `pending_review`, `rejected`, `withdrawn`, `unpublished` hoặc không có dòng → 404; `pending_verification` → 404; mỗi trạng thái cuối `builder_selected|rejected|expired|closed` + `published` → 200 "Closed" trong 30 ngày, **sau 30 ngày** (đặt `closed_at` cũ) → 404 (kiểm biên `+30d − 1 phút` và `+30d`); `removed` → 404 ngay; client gỡ (`withdrawn`) → 404 ngay trong cùng test; cờ tắt (cờ DB tắt, hoặc ngày chưa tới) → `/requests` và `/requests/:id` 404; `publicId` rác/`request_id` thật dùng làm `publicId` → 404 (không tra bằng `request_id`).
- **Danh sách:** chỉ `open`; mỗi trạng thái cuối/ẩn không xuất hiện (kiểm theo `publicId` của test, không đếm tổng); thứ tự `published_at` giảm dần, hai dòng cùng `published_at` theo `public_id` giảm dần; opt-in lại không đổi vị trí (kiểm `published_at`); lọc category/budget/ngôn ngữ đúng, giá trị lạ (`category=<script>`, `sort=paid`) bị bỏ qua và trang 200; trang 2 rỗng → 404; trạng thái rỗng hiện CTA (kiểm bằng render view với `items = []`, không phụ thuộc DB dùng chung); không có chuỗi `featured|boost|urgent|sponsored|promoted` trong HTML và trong mã nguồn view (quét `views/requests/*`).
- **CTA:** từng hàng của bảng §4.2 (chưa đăng nhập: `href` có `next` đúng và đúng locale; user thường: link `/for-builders`; builder `pending`, `rejected`, `suspended`: câu và không nút; chính client: link `/me/requests/:id`; `closed`: chỉ "closed" + Post a request).
- **Header/cache:** đã đăng nhập → `Cache-Control: no-store`; chưa đăng nhập → không có `max-age`/`public`; `Referrer-Policy` không phải `no-referrer`; HTML không có `<script>` hay `style=` (ngoại trừ script đã có của Layout).
- **XSS/văn bản thuần:** `public_description` chứa `<img src=x onerror=alert(1)>` render thành văn bản đã escape; xuống dòng giữ; không `dangerouslySetInnerHTML` trong `views/requests/*` (quét nguồn).
- **Hiệu năng:** `countD1Queries` quanh `GET /requests` và `GET /requests/:publicId` ≤ 8 (đăng nhập và không).
- **H2 (không lộ `request_id`):** HTML chi tiết cho người chưa đăng nhập, cho user khác chủ, và cho builder **không chứa** `request_id` thật; HTML của **chủ request** có link `/me/requests/<id>`; `findViewerRelation` chỉ chạy khi đã đăng nhập (người chưa đăng nhập không phát sinh truy vấn này); đối tượng listing không có khóa `request_id`/`client_user_id`.
- **Kiến trúc:** `routes/request-board.tsx`, `views/requests/*` trong `RANKING_FILES`, không import module tiền; `views/` không import `db/`.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/public/request-board-list.test.ts test/public/request-board-detail.test.ts test/architecture.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2705b: SEO, link lối vào, footer

**Files:**
- Modify: `apps/web/src/routes/request-board.tsx` (meta, `noindex`, canonical, hreflang, OG)
- Modify: `apps/web/src/routes/seo.ts` (sitemap), `apps/web/src/views/seo.ts` nếu cần (không đổi `renderRobots`)
- Modify: `apps/web/src/views/render.ts` (`page()` đọc `c.get("requestBoard")` (đã tính ở middleware `app.ts`) và đưa vào ngữ cảnh `hono/jsx` cùng ngữ cảnh thông báo; views và `Layout` **không** import `db/` hay `http/request-board.ts`)
- Modify: `apps/web/src/views/Layout.tsx` (link footer `/requests` khi `boardEnabled`)
- Modify: `apps/web/src/views/ForBuildersPage.tsx` (link tới `/requests` khi `boardEnabled`)
- Modify: `apps/web/src/routes/for-builders.tsx` (truyền cờ)
- Modify: `apps/web/src/i18n/messages/*` (`board.nav.footer`, `board.nav.forBuilders`)
- Test: `apps/web/test/seo/request-board.test.ts`, `apps/web/test/seo/sitemap.test.ts`, `apps/web/test/seo/robots.test.ts`, `apps/web/test/public/for-builders.test.ts`, `apps/web/test/legal/footer.test.ts`

**Hành vi (phụ lục §8, Q13):**
- **Sitemap:** thêm `/requests/:publicId` × 4 locale kèm `xhtml:link` hreflang, **chỉ** request `open` (hàm `listSitemapRequests` ở `db/request-board.ts`; `seo.ts` gọi, **không** để truy vấn nằm ở `seo.ts`); `lastmod` = `request_publications.updated_at`; cờ tắt → không có mục nào. Mục `/requests` (danh sách) thêm khi `isBoardIndexable(countOpen)` (≥ 5). Cache 1 giờ giữ nguyên (request vừa đóng còn trong sitemap tối đa 1 giờ: chấp nhận, đã ghi trong phụ lục).
- **robots.txt:** không đổi, không dòng nào cho `/requests`.
- **Trang `open`:** `<title>` chứa `public_title`; meta description 160 ký tự đầu của `public_description` (cắt theo code point, một dòng, đã escape); canonical; hreflang 4 locale + `x-default` (theo `alternates`); Open Graph `og:type = website`, không ảnh riêng; không JSON-LD (không `JobPosting`).
- **Trang `closed`:** `<meta name="robots" content="noindex">`, **không** canonical, **không** hreflang (luật VNX-0404a), HTTP 200.
- **`/requests` (danh sách):** `noindex` (không canonical/hreflang) khi < 5 request `open`; ≥ 5 thì index bình thường với canonical + hreflang.
- Link footer và `/for-builders` tới `/requests` **chỉ khi** `boardEnabled` (cờ + ngày); **không** link trên header (Q13, chờ homepage 3 cột). `boardEnabled` lấy từ `c.get("requestBoard")` (middleware M1: ngày kiểm trước nên trước go-live không có truy vấn D1 nào thêm; sau go-live cờ đi qua cache 60 giây của `isFlagEnabled`).

**Tests phải có:**
- Sitemap: request `open` có `<loc>` cho 4 locale kèm hreflang (kiểm theo `publicId` của test); `closed`, `pending_review`, `withdrawn`, `removed`, hết hạn 30 ngày **không** có mặt; cờ tắt → không có mục `/requests*`; `/requests` xuất hiện **khi** `isBoardIndexable` (kiểm bằng cách đọc số `open` hiện có rồi thêm đủ publication để vượt/chưa tới ngưỡng, assert theo độ lệch; nếu số đã ≥ 5 từ test khác thì ca "dưới 5" kiểm bằng hàm thuần ở 2702b); `lastmod` đúng `updated_at`; sitemap không chứa `request_id`, tiêu đề, email. **L7:** sitemap dùng **cổng đầy đủ** (cờ **và** ngày): thêm ca nửa ngày (cờ bật, `REQUEST_BOARD_GO_LIVE` rỗng hoặc tương lai → không mục `/requests*`).
- `robots.txt` không đổi (so với snapshot hiện có); không `Disallow: /requests`.
- Trang `open`: có `<link rel="canonical">`, 4 `hreflang` + `x-default`, `og:type`, meta description ≤ 160 ký tự và đúng bản **công khai** (không bản gốc); không `application/ld+json`.
- Trang `closed`: có `noindex`, **không** canonical, **không** hreflang; header 200.
- `/requests`: với ≥ 5 `open` (tự dựng tới ngưỡng bằng độ lệch) → không `noindex`, có canonical; dưới ngưỡng → `noindex`, không canonical. (Hai ca dùng hàm thuần ở 2702b cho phần số cứng; ca HTTP chỉ khẳng định tính nhất quán với `isBoardIndexable(countOpenPublicationsAll)`.)
- Footer và `/for-builders` có link `/requests` khi bật và **không** khi tắt; header không có link; 4 locale.
- Không có HTML nào của các trang này chứa chuỗi nhận diện (tên/email/bản gốc).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/seo/request-board.test.ts test/seo/sitemap.test.ts test/seo/robots.test.ts test/seo/canonical.test.ts test/public/for-builders.test.ts test/legal/footer.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2706a: Interest — POST, rút, giới hạn, Hub

**Files:**
- Modify: `apps/web/src/routes/request-board.tsx` (`POST /requests/:publicId/interest`, `POST /requests/:publicId/interest/withdraw`; không có GET)
- Modify: `apps/web/src/views/requests/InterestBlock.tsx` (form "I'm interested", trạng thái interest, nút rút, link lời mời)
- Modify: `apps/web/src/routes/hub-invitations.tsx`, `apps/web/src/views/hub/InvitationsPage.tsx` (mục "Requests you're interested in")
- Modify: `apps/web/src/domain/request-board.ts` (hằng số khóa `interest:builder:<id>` nếu cần)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/public/request-board-interest.test.ts`, `apps/web/test/hub/interests.test.ts`

**Hành vi (phụ lục §3.3, §4.2, §4.4, §9.1):** thứ tự kiểm trong route: (1) cổng tắt → 404; (2) `findPublicListing` + `requestVisibility`: `hidden` → 404, `closed` → 409; (3) chưa đăng nhập → 303 tới `/login?next=<trang localized>`; (4) builder `approved` + user `active` (nếu không → 409 "not eligible"); chính client của request → 409; (5) parse form (`parseInterestForm`: ghi chú ≤ 500, `productId` tùy chọn) lỗi → 400 trả lại trang với giá trị đã nhập; (6) `hitRateLimit(db, "interest:builder:<userId>", INTEREST_DAILY_LIMIT, 86400, now)` **sau** parse (chỉ form hợp lệ được tính) → vượt → 429 với thông báo; (7) `db.batch([createInterestStatement, auditStatement(request_interest.create, guard AuditInterestGuard)])`; không có dòng trả về (đã mời, đã có interest, đã đủ 30 pending, product sai, request vừa đóng) → 409, không audit. Thành công → 303 về trang, hiện "You told us you're interested" + nút rút.
- Origin check như mọi POST (thiếu/khác `Origin` → 403 hiện có); không Turnstile; handler không redirect ra ngoài site.
- Rút: `POST …/interest/withdraw`: CAS `pending → withdrawn` theo `builder_id` của session; audit `request_interest.withdraw` cùng batch; interest của builder khác → 404; đã `invited`/`dismissed` → 409. **L4:** rút interest `pending` được phép bất kể trạng thái request (đóng, ẩn).
- **Interest không** tạo lời mời, **không** gửi email, **không** đổi trạng thái request (khẳng định bằng test).
- CTA (bổ sung §4.2): builder `approved` đủ điều kiện → form (ghi chú + `<select>` product `published` của chính builder, có "No product"); đã có interest → trạng thái + nút rút khi `pending`; đã được mời → link `/hub/invitations/:id`.
- **Hub:** `/hub/invitations` thêm mục "Requests you're interested in": `public_title` chỉ khi `requestVisibility` ≠ `hidden`, nếu không "No longer public"; ngày bấm; trạng thái `pending` / `invited` (kèm link lời mời) / `not invited` (= `dismissed`, hoặc request đã đóng mà chưa được mời); `withdrawn` **không hiện** (L4: Hub chỉ có `pending` / `invited` / `not invited`); **không email**. Không bao giờ hiện `request_id`, client, bản gốc.

**i18n (×4):** `board.interest.cta|label.note|label.product|noProduct|submit|sent|withdraw|invitedLink|notEligible|rateLimited|error.noteTooLong|error.product|closed`, `hub.interests.title|empty|pending|invited|notInvited|noLongerPublic|clicked`.

**Tests phải có:**
- **Điều kiện:** builder `approved` + `active` → 303 + một dòng `pending`; builder `pending`/`rejected`/`suspended` → 409 và không dòng; user `suspended` → bị chặn (không phiên hợp lệ hoặc 409); user chưa là builder → 409; **chính client** (tạo builder cho client) → 409; builder **đã được mời** (`inviteBuilders`) → 409; interest trùng cặp → 409, đúng một dòng; request đã `closed` → 409; request đã `removed`/gỡ → 404; cổng tắt → 404; chưa đăng nhập → 303 `/login?next=` đúng locale.
- **Product:** product của builder khác, product `draft`/chưa `published` → **409** (L4), không dòng; product `published` của chính builder → lưu `product_id`.
- **Giới hạn:** 10 interest/ngày/builder thành công, lần 11 → 429 (dùng 11 request công khai riêng cho builder đó); trần `pending` 30: tạo 30 `pending` rồi lần 31 → 409 trong SQL (kiểm bằng cách gọi thẳng `createInterestStatement`, không đi qua rate limit); rút một interest giải phóng một chỗ; form sai (ghi chú 501) **không** tính vào giới hạn ngày (kiểm `rate_limits` của khóa đó); ghi chú 500 OK. **H1:** 30 interest `pending` trên 30 request mở; đóng các request đó (`closed`); interest mới trên một request mở **thành công** (trần không chặn); ca đối chứng: 30 pending trên request còn mở → lần 31 vẫn 409.
- **Origin:** thiếu `Origin` → 403; `Origin` khác → 403; không dòng.
- **Không tác dụng phụ:** sau interest, `requests.status` và `request_invites` không đổi; không email nào gửi (mailer giả); không `notify`.
- **Rút:** builder rút interest `pending` → `withdrawn`, audit đúng một dòng; không rút được interest của builder khác (404); không rút khi `invited`.
- **Audit:** `request_interest.create|withdraw` đúng một dòng khi thành công, **không** dòng khi 409; `data` không chứa `note`.
- **Hub:** mục hiện đúng ba trạng thái; request đã đóng mà chưa được mời → "not invited"; request ẩn (`removed`/gỡ) → "No longer public" và **không** lộ `public_title`; hiển thị không có `request_id` hay client; builder A không thấy interest của builder B.
- **Body:** POST > 64 KB → 413.
- i18n parity, CSP (không inline).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/public/request-board-interest.test.ts test/hub/interests.test.ts test/hub/invitations.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2706b: Ops — "Interested builders", Dismiss, mời → `invited`

**Files:**
- Modify: `apps/web/src/routes/admin-requests.tsx` (`inviteToRequest`: nối `markInterestsInvitedStatements` + audit `request_interest.invite`)
- Modify: `apps/web/src/routes/ops-request-board.tsx` (`POST :id/interests/:interestId/dismiss`)
- Modify: `apps/web/src/views/ops/RequestsPages.tsx`, tạo `apps/web/src/views/ops/InterestedBuilders.tsx` (khối "Interested builders")
- Modify: `apps/web/src/routes/ops.tsx`, `apps/web/src/views/ops/OverviewPage.tsx` (thẻ "Interests waiting")
- Modify: `apps/web/src/db/request-board.ts` (`countInterestQueue`)
- Modify: `apps/web/src/i18n/messages/en.ts` (`ops.board.*`)
- Test: `apps/web/test/ops/marketplace-request-board.test.ts`, `apps/web/test/ops/overview.test.ts`, `apps/web/test/admin/requests.test.ts` (đường mời của `/admin`), `apps/web/test/db/request-board.test.ts`

**Hành vi (phụ lục §3.3 bước 6–7, §5):**
- Khối "Interested builders" ở chi tiết request (cùng quyền như "Public listing": `marketplace.act`): tên, handle, ngày, ghi chú, product đính kèm (link `/p/:slug` công khai), **điểm gợi ý §8.10 chỉ để tham khảo** (tái dùng `suggestBuilders`; builder không có trong danh sách ứng viên, ví dụ availability `closed`, hiện "—"; công thức **không đổi**, interest **không cộng điểm**), nút **Invite** (gọi **đúng** hành động `POST :id/invite` hiện có với `builder=<id>`; **không** route mời mới) và **Dismiss**. Interest của builder không còn công khai (`publicBuilderOnly`: `approved` + `active`) bị **ẩn**.
- `inviteToRequest` (dùng chung `/admin` và `/ops`): trước batch, đọc interest `pending` của các builder được chọn; trong batch, sau `batch.statements`, thêm `markInterestsInvitedStatements(...)` (mỗi `UPDATE` có điều kiện `EXISTS` lời mời vừa chèn trong batch này) và với mỗi interest chuyển được thêm `auditStatement(request_interest.invite, guard AuditInterestGuard)`; câu audit hiện có (`request.invite`) giữ nguyên. Thứ tự câu lệnh được thêm **sau** các câu mời và **trước** audit hiện có, nên `batch.read(results)` không đổi. Cổng 5 lời mời giữ nguyên trong `INSERT` (không ai được mời quá 5 dù có interest).
- **Dismiss:** CAS `pending → dismissed`, `decided_by/at`; không lý do; audit `request_interest.dismiss`; builder thấy "Not invited" ở Hub; **không email** (Q12).
- Thẻ Overview "Interests waiting": đếm interest `pending` của request `submitted|matching` mà builder còn công khai; hai trạng thái ok/error như thẻ khác.

**Tests phải có:**
- **Mời → invited cùng batch:** builder có interest `pending`, Ops mời qua `/ops/marketplace/requests/:id/invite` → `request_invites` có dòng **và** interest `invited` và hai dòng audit (`request.invite`, `request_interest.invite`); chạy lại qua `/admin/requests/:id/invite` (cả hai đường mời) cho một builder khác; mời builder **không** có interest → không dòng interest, không audit `request_interest.*`; mời builder có interest `dismissed`/`withdrawn` → interest **không** đổi (chỉ `pending` chuyển).
- **Cổng 5 giữ nguyên:** request đã đủ 5 lời mời hoạt động; builder có interest `pending` được chọn là người thứ 6 → 409, **không** `request_invites` mới và interest **vẫn `pending`**, **không** audit `request_interest.invite`.
- **Thua batch:** nếu lời mời không chèn được (builder bị khóa giữa chừng), interest không chuyển (điều kiện `EXISTS` lời mời của batch).
- **Dismiss:** Owner/Operator → `dismissed`, audit một dòng; Content/Viewer/người lạ → 404 kín và không ghi; dismiss lần hai → 409; interest `invited` không dismiss được (409); **không email** (mailer giả không nhận gì); builder thấy "Not invited" ở Hub.
- **Hiển thị khối:** hiện đúng builder công khai và ẩn builder `suspended`/user `suspended` (`publicBuilderOnly`); điểm gợi ý hiện, không đổi khi thêm interest (so điểm trước/sau); khối không có trong HTML của Viewer; ghi chú được escape.
- **Overview:** thẻ tăng/giảm đúng độ lệch khi thêm/dismiss/mời; không đếm interest của request đã đóng hoặc builder bị khóa; lỗi truy vấn → `error`.
- **Không đổi hành vi M6:** toàn bộ `test/admin/requests.test.ts`, `test/ops/marketplace-requests.test.ts`, `test/me/select.test.ts` vẫn xanh (không sửa kỳ vọng).
- **Audit riêng tư:** `data` của các audit interest không chứa `note` hay tên.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/ops/marketplace-request-board.test.ts test/ops/overview.test.ts test/admin/requests.test.ts test/ops/marketplace-requests.test.ts test/db/request-board.test.ts test/me/select.test.ts
npm test
```

---

### Task VNX-2707a: Khung pháp lý theo phiên bản và thông báo trước

**Files:**
- Modify: `apps/web/src/domain/privacy-notice.ts` (thêm hàm tổng quát theo danh sách phiên bản; giữ `privacyVersion(goLive, now)` làm bọc tương thích)
- Create: `apps/web/src/domain/legal-versions.ts` (hoặc gộp vào `privacy-notice.ts` nếu gọn hơn; Implementer chọn, ghi lý do)
- Modify: `apps/web/src/routes/legal.tsx` (chọn Privacy theo ba phiên bản, Terms theo hai; `updatedAt` = ngày go-live của phiên bản đang hiện)
- Modify: `apps/web/src/views/privacy-notice.tsx`, `apps/web/src/views/render.ts`, `apps/web/src/views/Layout.tsx`, `apps/web/public/assets/privacy-notice.js` (khóa `localStorage` theo từng thông báo; thông báo thứ hai)
- Modify: `apps/web/src/legal/content.ts` (chỉ **khung** chọn phiên bản: kiểu và bảng phiên bản; **chưa** có câu chữ board, câu chữ là 2707b)
- Test: `apps/web/test/domain/legal-versions.test.ts`, `apps/web/test/legal/privacy-version.test.ts` (không hỏng), `apps/web/test/design/privacy-notice.test.ts`, `apps/web/test/config/wrangler-guard.test.ts`

**Thiết kế:**
- `privacyVersionOf({ m7, board }, now)`: `"board"` từ `parseDate(board) − 14 ngày` (nửa mở) về sau; ngược lại `"m7"` từ `parseDate(m7) − 14 ngày`; ngược lại `"current"`; biến rỗng/sai dạng = không bao giờ vào phiên bản đó; **không bao giờ quay lại** phiên bản cũ (không xóa biến sau go-live). `termsVersionOf(board, now)`: `"board" | "current"`. `privacyVersion(goLive, now)` cũ giữ nguyên chữ ký và kết quả cho test hiện có.
- Thông báo: mỗi thông báo `{ id, goLive, messageKey }`; hiển thị khi `[goLive − 14 ngày, goLive + 31 ngày)`; có thể hiện hai thông báo cùng lúc (xếp dọc); mỗi thông báo có khóa `localStorage` riêng (`vnxsi:privacy-notice-dismissed:v1` giữ cho thông báo M7; khóa mới cho board). Khung CSP không đổi (script tĩnh same-origin, không inline). Câu chữ thông báo board là 2707b.
- Giữ nguyên cổng `signedIn` của thông báo (chỉ người đã đăng nhập thấy), đúng Privacy §10.

**Tests phải có:** bảng biên cho `privacyVersionOf` (trước `board − 14 ngày − 1ms` → m7 hoặc current; đúng `board − 14 ngày` → board; board rỗng/`2026-02-30` → như hiện nay; không bao giờ quay lại sau go-live; board bật mà m7 rỗng → vẫn không ném; thứ tự `board` thắng `m7`); `termsVersionOf`; `privacyVersion` cũ cho cùng đầu vào cũ cho cùng kết quả như trước (chạy lại bộ test hiện có); cửa sổ thông báo `[goLive − 14, goLive + 31)` cho biến board; hai thông báo hiện cùng lúc, đóng một cái không đóng cái kia (khóa riêng); biến rỗng → không markup và không script thêm; chỉ người đã đăng nhập thấy; wrangler-guard (đã có ở 2702b).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/domain/legal-versions.test.ts test/legal/privacy-version.test.ts test/design/privacy-notice.test.ts test/design/layout.test.ts test/config/wrangler-guard.test.ts
npm test
```

---

### Task VNX-2707b: Chép Privacy/Terms đã duyệt; câu chữ thông báo

**CHẶN:** Owner duyệt **bản VI §12.6** và câu chữ thông báo (xem OP-2). Không bắt đầu trước đó. EN đã duyệt.

**Files:**
- Create: `docs/legal/privacy-board.md` (phiên bản thứ ba: nội dung `privacy-m7.md` + các thay đổi §12.2 và §12.6; cùng cấu trúc `## EN` / `## VI` và phần đầu mô tả "khi nào hiện", như `privacy-m7.md`)
- Create: `docs/legal/terms-board.md` (Terms + §12.3 và §12.6)
- Modify: `apps/web/src/legal/content.ts` (`privacyEnBoard`, `privacyViBoard`, `termsEnBoard`, `termsViBoard`; bảng phiên bản; **không sửa** bốn hằng số Privacy hiện có và `terms*` hiện có)
- Modify: `apps/web/src/routes/legal.tsx` (đã có khung ở 2707a)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts` (`privacyNotice.board.message`, `privacyNotice.board.readChanges` dùng lại `privacyNotice.readChanges`, `privacyNotice.dismiss`)
- Test: `apps/web/test/legal/content.test.ts`, `apps/web/test/legal/pages.test.ts`, `apps/web/test/legal/privacy-version.test.ts`, `apps/web/test/legal/request-board-versions.test.ts`

**Quy tắc:**
- Chép **nguyên văn** phụ lục §12.2 (Privacy EN), §12.3 (Terms EN), §12.4 (UI) và §12.6 (VI đã duyệt): không dịch lại, không sửa chữ. Mỗi dòng/mục theo đúng vị trí (Privacy mục 2, 3, 4, 6; Terms mục 5, 6, 7). Mục "Last updated" của hai phiên bản mới = `REQUEST_BOARD_GO_LIVE` (cơ chế `updatedAt` M7).
- zh-Hans, zh-Hant: trang Privacy/Terms hiện bản EN kèm câu "bản tiếng Anh có hiệu lực" (như hiện nay); chuỗi giao diện/thông báo dịch AI, người bản xứ đọc lại.
- **Phối hợp EPIC 26:** nếu VNX-2607 đã merge, `privacy-board.md` phải chứa cả thay đổi của nó; nếu chưa, ghi nghĩa vụ vào `CURRENT-STATUS.md` (Reviewer) để VNX-2607 chép vào **ba** file Privacy và **hai** file Terms (`terms.md`, `terms-board.md`, cùng `termsEnBoard`/`termsViBoard`) và sáu hằng số.
- **Câu thông báo: dùng đúng bản ở OP-2a (Owner duyệt nguyên văn 2026-10-07); bản dưới đây bị thay, KHÔNG dùng:** EN: "We are updating our Privacy Policy and Terms: from {date} you can choose to show a request on a public request board. Nothing changes for requests you have already posted." VI: "Chúng tôi cập nhật Chính sách quyền riêng tư và Điều khoản: từ {date}, bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai. Các nhu cầu bạn đã đăng không thay đổi." (VI dùng thuật ngữ "nhu cầu" theo §12.6.)

**Tests phải có:**
- `content.test.ts`: `privacy-board.md` và `terms-board.md` khớp từng dòng (tiêu đề, đoạn, gạch đầu dòng) với `privacyEnBoard|privacyViBoard|termsEnBoard|termsViBoard`; **`privacy.md`, `privacy-m7.md`, `terms.md` và bốn hằng số cũ không chứa** bất kỳ câu nào của board (chuỗi nhận diện: "public request board", "bảng nhu cầu công khai", "Public requests"); mỗi câu board của §12.2/§12.3/§12.6 xuất hiện đúng một lần trong phiên bản board.
- `request-board-versions.test.ts`: với `REQUEST_BOARD_GO_LIVE = D`: trước `D − 14 ngày` `/privacy` và `/terms` **không** chứa câu board (EN và VI); từ `D − 14 ngày` chứa, kèm "Last updated: D"; `/vi/privacy`, `/vi/terms` chứa bản VI; `/zh-hans/privacy` và `/zh-hant/terms` hiện bản EN và câu "bản tiếng Anh có hiệu lực"; sau `D` vẫn chứa (không quay lại); biến rỗng → chỉ phiên bản cũ.
- `pages.test.ts` hiện có không hỏng; `privacy-version.test.ts` hiện có (ngày go-live M7) không hỏng.
- Thông báo: người đã đăng nhập thấy thông báo board trong cửa sổ `[D − 14, D + 31)`, ngoài cửa sổ thì không; người chưa đăng nhập không thấy.
- Chuỗi giao diện: test khẳng định nhãn/mô tả opt-in EN và VI bằng **đúng chuỗi trong phụ lục** §12.4, §12.6.
- Parity 4 locale.

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/legal/content.test.ts test/legal/pages.test.ts test/legal/privacy-version.test.ts test/legal/request-board-versions.test.ts test/i18n/parity.test.ts
npm test
```

---

### Task VNX-2709: Cổng ra EPIC 27 (test tích hợp, rà soát)

**Files:**
- Create: `apps/web/test/public/request-board-gate.test.ts`
- Create: `.ai/tasks/VNX-2709-report.md` (Implementer; báo cáo task)

Một test đi hết vòng đời **qua HTTP** (cổng bật, cờ bật, `REQUEST_BOARD_GO_LIVE` ≤ hôm nay), mọi chuỗi nhận diện duy nhất:
1. Client đăng nhập gửi `/request` có chọn ô và `country=VN` → `pending_review`, không có trên `/requests` (404 trang chi tiết).
2. Ops (Operator) sửa bản công khai và **publish** → `/requests` và `/requests/:publicId` 200; HTML không chứa bản gốc/danh tính; có trong sitemap; email "đã sửa" gửi cho client.
3. Builder `approved` bấm "I'm interested" (có ghi chú và product) → interest `pending`; client **không** thấy, không email cho client; Ops thấy ở "Interested builders".
4. Ops mời builder (đường M6) → interest `invited`, lời mời xuất hiện ở `/hub/invitations`; builder gửi đề xuất; client chọn (`/me/requests/:id/select`) → request `builder_selected`.
5. Trang chi tiết → "Closed", `noindex`, không canonical/hreflang, ngoài danh sách và sitemap, form interest không còn; `closed_at + 30 ngày` → 404.
6. Client gỡ một request khác đang `published` → 404 ngay; cờ tắt → mọi bề mặt 404 và ngoài sitemap; gỡ vẫn chạy khi cờ tắt.
7. Audit: mọi hành động trên đều có đúng một dòng `request_publication.*` / `request_interest.*` cùng batch; không dòng nào chứa câu chữ.

**Rà soát cuối (checklist Implementer, không tự sửa phạm vi khác):** `grep` không có `featured|boost|urgent|sponsored` trong file mới; không `dangerouslySetInnerHTML`; không `style=`/`<script` inline mới; `RANKING_FILES` đủ file mới; số truy vấn ≤ 8; i18n parity; `docs/legal` khớp `content.ts`; `wrangler.jsonc` `REQUEST_BOARD_GO_LIVE` vẫn `""` trong nhánh (Owner commit ngày ở VNX-2708).

**Verification:**
```
npm run typecheck -w apps/web
npm test -w apps/web -- test/public/request-board-gate.test.ts
npm test
```

---

### Task VNX-2708: Owner bật tính năng (HUMAN, HIGH-RISK)

Owner (Reviewer chỉ nhắc, không làm thay):

- [ ] Người có chuyên môn pháp lý đã đọc phụ lục mục 12 và bản chép trong `docs/legal/*-board.md` (Q16); mọi chỉnh sửa quay lại Reviewer, qua đúng quy trình 2707b.
- [ ] Merge và deploy mã EPIC 27 **với** `REQUEST_BOARD_GO_LIVE = ""` và **sau** khi áp migration (migrate trước, deploy sau; số migration ghi ở `wrangler.jsonc`). Cờ `request_board` còn tắt: kiểm `/requests` 404, footer không có link, `/request` không có ô opt-in.
- [ ] Chọn ngày hiệu lực `D` **≥ 14 ngày sau lần deploy mang biến**; commit `REQUEST_BOARD_GO_LIVE = "D"` trên `main` bằng một commit `chore:` rồi deploy; không `--var`, không dashboard, không xóa sau đó. Từ `D − 14` `/privacy` và `/terms` hiện phiên bản board và thông báo trước hiện cho người đã đăng nhập.
- [ ] Thêm rule Cloudflare Rate limiting cho `/requests*` (như `/p/*`, `/go/*`); không đổi code.
- [ ] Từ ngày `D`, bật cờ `request_board` ở `/admin/flags`. Smoke production: một request thật đi hết opt-in → publish → interest → mời → đóng → `noindex` (cổng ra EPIC 27); kiểm Search Console không index trang đóng.
- [ ] Công tắc khẩn cấp: tắt cờ `request_board` ở `/admin/flags` (tối đa 60 giây mỗi isolate để thấy); người dùng vẫn gỡ được request của mình.

---

## Open points (khoảng trống phụ lục; đã có phán quyết của Reviewer/controller, Owner xác nhận ở 2701)

- **OP-1 — Opt-in lại: RESOLVED, không giới hạn.** Giữ đúng Q6 (không trần, không khoảng nghỉ). Rủi ro một client spam hàng chờ Ops bằng gỡ rồi opt-in lại: ghi vào "Ghi nhận" của `CURRENT-STATUS.md`; chỉ đề xuất trần nếu thực tế xảy ra.
- **OP-2 — Câu chữ: RESOLVED một phần.** (a) Câu thông báo trước 14 ngày: **Owner duyệt nguyên văn EN và VI 2026-10-07**. EN khuyến nghị: "From {date} you can choose to show a request on a public request board. Requests stay private unless you choose this for each one; nothing changes for requests you have already posted." VI (đã duyệt): "Từ {date}, bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai. Nhu cầu vẫn riêng tư trừ khi bạn chọn công khai cho từng nhu cầu; các nhu cầu bạn đã đăng không thay đổi." (zh-Hans/zh-Hant: AI dịch, Owner duyệt nguyên văn như M7.) (b) 3 email client do Reviewer duyệt trong khuôn phụ lục §9.2 và mẫu M6, rà ở VNX-2704b; không cần Owner duyệt từng câu.
- **OP-3 — RESOLVED: chấp nhận.** Ba phiên bản Privacy (`current`, `m7`, `board`) và một phiên bản Terms có ngày (`board`), theo Q15. Mọi thay đổi Privacy tới task dọn phải vào cả ba file; Terms vào hai file.
- **OP-4 — RESOLVED: như plan.** Hai khối mới ẩn với vai trò không có `marketplace.act`; **không** thu hẹp quyền xem của Viewer (đổi ADR-010 nằm ngoài epic). Ghi vào "Ghi nhận": Viewer vẫn thấy bản gốc request.
- **OP-5 — RESOLVED: theo §7.3.** Request `rejected` có publication `published` hiện "Closed" 30 ngày; **không** tự unpublish.

## Ngoài phạm vi (nhắc lại từ phụ lục §14)

Builder gửi đề xuất hay gắn product trực tiếp lên bảng mà không qua lời mời; hiện công khai số builder quan tâm hay số request công khai; JSON-LD `JobPosting` (và `BreadcrumbList`, làm cùng task JSON-LD chung); dịch nội dung request; công khai hồi tố hay hàng loạt; request công khai trong newsletter; khối "Open requests" trên homepage và link header (cùng đợt homepage 3 cột, theo ADR-004); lọc theo quốc gia và tìm kiếm chữ; hiện `country` trong trang lời mời của Hub (`RequestFacts`) và `/admin/requests` (không có tính năng mới).

## Nghĩa vụ để lại cho Reviewer (không phải việc của Implementer)

Khi Owner duyệt plan: commit tài liệu theo phụ lục §15 (xem VNX-2701). Mỗi task xong: `.ai/tasks/<ID>-handoff.md` (mọi yêu cầu kiểm được bằng một lệnh), review độc lập `.ai/reviews/<ID>-review.md`, và cập nhật `.ai/context/CURRENT-STATUS.md` (trạng thái task, SHA, quyết định phát sinh, sai khác roadmap đã duyệt, nghĩa vụ cho task sau, blocker mở/đóng). Ghi vào "Nghĩa vụ treo": VNX-2607 (EPIC 26) phải chép Privacy vào **ba** file; số migration cuối cùng; dòng thứ tự deploy trong `wrangler.jsonc`.
