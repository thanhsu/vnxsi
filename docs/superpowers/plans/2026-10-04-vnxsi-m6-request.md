# VNX.SI M6 — Post a request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** Approved. Owner duyệt nguyên văn các quyết định thiết kế và câu chữ Privacy (2026-10-04). Task 2–7 được viết ngay trước khi làm, dựa trên code thật của task trước; Opus (Reviewer) duyệt từng phần theo ủy quyền của Owner cùng ngày.
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M6 (VNX-0601 … VNX-0606; VNX-0602 tách 0602a / 0602b)
- **Nhánh:** `feat/m6-request` (tách từ `main` @ `bf5eb3f`)

**Goal:** Client đăng request ở `/request` (chưa đăng nhập thì xác nhận email); admin xem gợi ý builder theo luật và mời tối đa 5; builder gửi đề xuất hoặc từ chối trong Hub; client xem đề xuất ở `/me`, chọn một và hệ thống mở Inquiry `type = request` với builder đó; cron hằng ngày nhắc, cho hết hạn lời mời và request, dọn request chưa xác nhận.

**Architecture:**
- Giữ khung M1–M5: `domain/request.ts` thuần (2 state machine, đọc form, chấm điểm gợi ý), `db/requests.ts` là module duy nhất ghi `requests` và `request_invites`, `routes/` ghép, `views/` trình bày, `notify/request.ts` gửi email (không bao giờ ném lỗi).
- Mỗi chuyển trạng thái là compare-and-set (`UPDATE … WHERE status = … RETURNING *`). Các câu đi kèm (lời mời, Inquiry, audit) nằm trong cùng `db.batch` và có điều kiện bảo vệ: mất compare-and-set thì không ghi gì.
- Mọi lần request vào trạng thái cuối đi qua một hàm `endRequestBatch` (spec 7.5: lời mời `invited` → `expired`, đề xuất `proposed` → `not_selected`). Chọn đề xuất dùng cùng hàm, chèn thêm câu tạo Inquiry và câu đánh dấu `selected`.
- Inquiry sinh từ request là Inquiry bình thường của M5 (`type = request`, `request_id`, `status = open`). Email "bạn được chọn" là email của tin nhắn đầu tiên, nên đi qua `notifyInquiryMessage` và được cron M5 gửi lại khi lỗi.
- `/auth/verify` nhận thêm mục đích `request_verify` (cùng trang trung gian VNX-0506).

**Tech Stack:** như M1–M5. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md` mục 3 (thước đo request), 5.2 (`/request`, nút ở `/builders`), 5.3 (tổng quan, Invitations), 5.4, 5.5 (hàng chờ request), 5.7, 6.1 (`requests`, `request_invites`), 7.5, 7.6, 8.2 (rate limit request), 8.3, 8.4, 8.8 (sitemap có `/request`), 8.10, 9 (phần Request), 12 (câu "thường có đề xuất trong 3 ngày làm việc"). **ADR:** ADR-002 (magic link), ADR-003 (i18n), ADR-004 (gợi ý không có tham số trả tiền).

## Quyết định của Owner (2026-10-04)

- **Landing:** thêm một link phụ "Post a request" ở khối client của landing, cạnh form waitlist; waitlist giữ nguyên.
- **Báo admin:** mỗi request vào `submitted` thì gửi ngay một email tiếng Anh tới mọi địa chỉ trong `ADMIN_EMAILS` (gửi một lần, lỗi thì chỉ ghi log).

## Quyết định thiết kế của Reviewer (trong plan này, Owner duyệt cùng plan)

- **Khác spec 6.1 (thêm cột):** `requests.client_name` (tên client gõ trên form; builder chỉ thấy tên này, spec 5.7 bước 3; cùng cách làm với `inquiries.client_name` của M5), `requests.created_at` / `updated_at`, `request_invites.created_at` / `updated_at` (mốc compare-and-set).
- **Tên client:** người đã đăng nhập được điền sẵn `users.display_name`, sửa được; lần xác nhận đầu đặt `users.display_name` nếu đang trống (giống M5).
- **Rate limit:** spec 8.2 "3 request/ngày mỗi email" áp cho mọi người (đã đăng nhập thì theo email tài khoản). Thêm 10 lần/giờ mỗi IP (giống Inquiry). Chỉ form hợp lệ mới bị đếm (M5 F4). Người chưa đăng nhập vượt giới hạn email nhận cùng trang "kiểm tra email" như thành công (M5 F2); người đã đăng nhập nhận lỗi 429.
- **Email của user bị khóa** ở form chưa đăng nhập: trang "kiểm tra email" như bình thường, không tạo gì. Builder được phép đăng request như một client, nhưng không bao giờ được mời vào request của chính mình (kiểm ở truy vấn gợi ý và trong câu `INSERT`).
- **Gửi email xác nhận lỗi:** xóa request đang chờ vừa tạo, báo lỗi ngay trên form (spec 8.3).
- **Admin mời:** chọn từ 10 gợi ý (checkbox) và/hoặc gõ handle của một builder công khai bất kỳ (gợi ý chỉ là trợ giúp, spec 8.10 "admin vẫn là người quyết định"). Builder `closed` vẫn mời được khi admin gõ handle; gợi ý thì loại `closed`.
- **Trả về (`rejected`)** chỉ từ `submitted` (sơ đồ 7.5). Lý do bắt buộc, 1–1000 ký tự, client nhận email kèm lý do.
- **Đề xuất:** cách làm 1–2000 ký tự (bắt buộc); giá theo 3 kiểu `fixed` (một số USD nguyên 1–1 000 000), `range` (từ – đến, từ < đến), `discuss` (cần trao đổi thêm); ghi chú giá ≤ 200 (tùy chọn); thời gian dự kiến 1–365 ngày (bắt buộc). Chỉ gửi được khi lời mời `invited` và request `matching`; builder phải `approved`.
- **Từ chối lời mời** không gửi email cho client (spec 8.3 không liệt kê); admin thấy trong trang request.
- **Email `not_selected`:** gửi cho mọi builder có đề xuất chuyển `not_selected`, kể cả khi request kết thúc vì đóng / hết hạn / trả về / spam. Một câu chữ trung tính: "đề xuất của bạn không được chọn, request đã kết thúc".
- **Email về request (mời, đề xuất, không được chọn, trả về, hết hạn, nhắc, báo admin):** gửi một lần, lỗi chỉ ghi log, không có cột gửi lại (spec 6.1 không có `notified_at` cho request). Bù lại: builder thấy lời mời trong Hub và được nhắc sau 3 ngày; client thấy đề xuất ở `/me`. Riêng email "bạn được chọn" đi theo tin nhắn đầu của Inquiry nên có gửi lại (cơ chế M5). Admin thấy `?done=mail_failed` khi email mời lỗi.
- **Builder hết `approved` (spec 7.6):** lời mời `invited` của họ chuyển `expired` ngay khi admin khóa builder hoặc khóa user, và cron hằng ngày quét lại. Đề xuất `proposed` của builder không công khai không được chọn (409) và client thấy nút chọn bị ẩn.
- **Hạn 30 ngày** của request `matching` tính từ `matched_at` (lần mời đầu tiên). Hạn 7 ngày và mốc nhắc 3 ngày của lời mời tính từ `invited_at`.
- **Điểm trừ lời mời hết hạn** (spec 8.10): đếm lời mời `expired` có `invited_at` trong 60 ngày gần nhất. Hòa điểm thì xếp theo handle (ổn định, không có tham số nào khác, ADR-004).
- **Tin nhắn đầu của Inquiry sinh từ request:** ghép tiêu đề + mô tả request + đề xuất (cách làm, giá, thời gian, ghi chú), nhãn theo locale của request.
- **Audit cho số liệu M7:** mỗi lần request vào `submitted` ghi `request.submit` (đăng nhập sẵn) hoặc `request.verify` (xác nhận email), `data` có `category` và `languages` (dải Live của M7 chỉ dùng hai trường này).
- **Tiếng Việt:** "request" là **nhu cầu** ("Đăng nhu cầu"), vì "yêu cầu" đã dùng cho Inquiry. Sửa `inquiry.type.request` (vi) thành "Từ nhu cầu đã đăng".

## Bổ sung Privacy (cần Owner duyệt câu chữ cùng plan)

Reviewer sửa `docs/legal/privacy.md` theo đúng văn bản dưới đây **sau khi Owner duyệt**, trước khi Task 0602b bắt đầu; Task 0602b chép nguyên văn vào `src/legal/content.ts` (test `legal/content` so từng dòng). Thêm dòng "Bổ sung M6 (request): APPROVED bởi Owner <ngày>" ở đầu file và một dòng "Đối chiếu code M6".

EN, mục 2 (thêm sau gạch đầu dòng **Inquiries**):

> - **Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.
> - **Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined.

EN, mục 2, sửa câu **Bot check**: "when you send an inquiry or a request without signing in, …"

EN, mục 3 (thêm sau dòng "To pass inquiries…"):

> - To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message.

EN, mục 4, sửa dòng thứ hai: "Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request."

EN, mục 6 (thêm sau dòng **Inquiries and their messages**):

> - Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours.

VI, các vị trí tương ứng:

> - **Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.
> - **Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối.

> **Kiểm tra chống bot:** khi bạn gửi yêu cầu hoặc nhu cầu mà chưa đăng nhập, …

> - Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên.

> - Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó.

> - Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ.
## Global Constraints

- Mọi ràng buộc của plan M0–M5 vẫn áp dụng (không thêm dependency, ranh giới module, Origin check, test sở hữu bảng, `RETURNING` thay `meta.changes` cho bảng có trigger, chuỗi giao diện qua `t()` đủ 4 locale, test nặng có timeout 30 s, `Cache-Control: no-store` cho `/hub*`, `/me*`, `/admin*`).
- Migration mới: `apps/web/migrations/0008_requests.sql`, chỉ thêm. Không chạy migration remote, không deploy.
- **State machine request (spec 7.5):** `verify` (hệ thống) `pending_verification` → `submitted`; `invite` (admin) `submitted` | `matching` → `matching`; `reject` (admin) `submitted` → `rejected`; `select` (client) `matching` → `builder_selected`; `close` (client) `submitted` | `matching` → `closed`; `expire` (hệ thống) `matching` → `expired`; `remove` (admin) mọi trạng thái trừ `removed` → `removed`. Cuối: `builder_selected`, `rejected`, `expired`, `closed`, `removed`.
- **State machine lời mời (spec 7.6):** `propose` (builder) `invited` → `proposed`; `decline` (builder) `invited` → `declined`; `select` (client) `proposed` → `selected`; `not_select` (hệ thống) `proposed` → `not_selected`; `expire` (hệ thống) `invited` → `expired`.
- **Khi request vào trạng thái cuối:** mọi lời mời `invited` → `expired`, mọi đề xuất `proposed` (trừ cái được chọn) → `not_selected`, trong cùng `db.batch`.
- **Tối đa 5 lời mời `invited` | `proposed` mỗi request**, kiểm trong chính câu `INSERT` (không chỉ ở route). Unique (`request_id`, `builder_id`): không mời lại. Không mời chính client. Chỉ mời builder `approved` trên tài khoản `active`.
- **Giới hạn form:** tiêu đề 1–120 ký tự, không ký tự điều khiển; mô tả 40–4000; category trong `CATEGORIES`; budget như Inquiry; deadline như Inquiry (hôm nay tới 5 năm, UTC); ngôn ngữ ≥ 1 trong `en` | `vi` | `zh`; tên 1–80; email ≤ 254, lowercase. Textarea chuẩn hóa CRLF → LF trước khi đếm.
- **Rate limit:** `request:email:<sha256(email)>` 3 / ngày (cửa sổ 86 400 s); `request:ip:<ip>` 10 / giờ.
- **Builder không thấy email client** ở bất kỳ trang, email hay HTML nào: Invitations, email mời, email nhắc, email "được chọn", Inquiry sinh ra.
- **Hiển thị:** client không thấy request `removed`; builder chỉ thấy request mình được mời, không thấy request `removed`; mọi trang khác chủ → 404. Request không bao giờ có trang công khai.
- **Hạn:** `PENDING_TTL_MS` (48 giờ, của M5) cho request chờ xác nhận; nhắc lời mời sau 3 ngày; lời mời hết hạn sau 7 ngày; request `matching` hết hạn sau 30 ngày.
- **Cron idempotent:** chạy hai lần liên tiếp không gửi trùng, không đổi trạng thái hai lần.
- Test admin dùng `owner@vnx.si`. Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.

## Review Focus

1. **Lộ email client cho builder:** email client không có trong HTML `/hub/invitations*`, email mời / nhắc / "được chọn", Inquiry sinh ra, kể cả khi client dùng email làm tên. Test ở Task 4 (0604) và Task 5 (0605).
2. **Truy cập chéo:** builder không được mời mở `/hub/invitations/:id` của builder khác; client mở `/me/requests/:id` của người khác; client chọn đề xuất thuộc request khác (gửi `invite` của request khác) → 404, không ghi gì. Test ở Task 4, 5.
3. **Lách giới hạn mời:** lời mời thứ 6, mời trùng, mời chính client, mời builder bị khóa, mời khi request đã đóng, hai lần mời đồng thời → không vượt 5, không chèn dòng nào sai. Test ở Task 1 (db) và Task 3.
4. **Trạng thái và đua:** gửi đề xuất khi request đã đóng / hết hạn / đã chọn; bấm "Chọn" hai lần; chọn đề xuất của builder bị khóa sau khi gửi; đóng request sau khi đã chọn → 409, không có Inquiry thứ hai, không có email thừa. Test ở Task 4, 5.
5. **Form công khai bị lạm dụng:** honeypot, Turnstile sai / thiếu / dịch vụ lỗi, quá 3 lần / ngày mỗi email, email của user bị khóa → không tạo gì, không lộ trạng thái tài khoản. Test ở Task 3 (0602b).

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-0601 | Migration `0008_requests`, `domain/request.ts`, `db/requests.ts`, audit có điều kiện cho request / lời mời, `createInquiryStatements`, fixture, `deleteGhostUsers` xét `requests` | — |
| 2 | VNX-0602a | Template email request (9 loại, 4 locale), `notify/request.ts`, `request_verify` ở `/auth/verify`, `openPendingRequest` | 1 |
| 3 | VNX-0602b | Form `/request`, `/me` (danh sách + trang request: gửi ngay, đóng), lối vào ở `/builders`, `/products` rỗng, landing, sitemap, Privacy | 1, 2 |
| 4 | VNX-0603 | Admin: hàng chờ, chi tiết, gợi ý builder (spec 8.10), mời ≤ 5, trả về, spam | 1, 2 |
| 5 | VNX-0604 | Hub: Invitations, gửi đề xuất / từ chối, số lời mời ở tổng quan | 1, 2, 4 |
| 6 | VNX-0605 | `/me`: xem đề xuất, chọn → Inquiry `type = request`; Inquiry hiển thị tiêu đề request; test cổng ra M6 | 3, 5 |
| 7 | VNX-0606 | Cron: hết hạn / nhắc lời mời, hết hạn request, xóa request chờ; hết hạn lời mời khi khóa builder / user | 1, 2 |

Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: VNX-0601 — Dữ liệu, domain và db của request

**Files:**
- Create: `apps/web/migrations/0008_requests.sql`
- Create: `apps/web/src/domain/request.ts`, `apps/web/src/db/requests.ts`
- Modify: `apps/web/src/domain/inquiry.ts` (xuất `parseDeadline`, `parseClientName`, `parseClientEmail`, `parseInquiryForm` dùng lại chúng; hành vi không đổi)
- Modify: `apps/web/src/db/inquiries.ts` (`createInquiryStatements`, `NewInquiry.requestId`; `createInquiry` gọi lại hàm mới)
- Modify: `apps/web/src/db/audit.ts` (guard `requestId`, `inviteId`), `apps/web/src/db/users.ts` (`deleteGhostUsers` xét `requests`), `apps/web/src/db/builders.ts` (xuất `jsonList`)
- Modify: `apps/web/test/architecture.test.ts` (2 bảng mới trong `WRITERS`), `apps/web/test/fixtures.ts` (`makeRequest`, `inviteBuilders`, `proposeOn`), `apps/web/wrangler.jsonc` (ghi chú thứ tự deploy có `0008_requests`)
- Test: `apps/web/test/domain/request.test.ts`, `apps/web/test/db/requests.test.ts`

**Interfaces:**
- Consumes: `ulid` (`lib/ulid.ts`), `normalizeNewlines` (`domain/product-input.ts`), `CATEGORIES`, `Category` (`domain/product.ts`), `WORK_LANGUAGES`, `WorkLanguage`, `Availability` (`domain/builder.ts`), `BUDGET_BANDS`, `BudgetBand`, `DECLINE_REASON_MAX` (`domain/inquiry.ts`), `auditStatement` (`db/audit.ts`), fixtures `ensureUser`, `makeBuilder`, `addLiveProduct`.
- Produces:
  - `domain/inquiry.ts`: `parseDeadline(raw, today)`, `parseClientName(raw)`, `parseClientEmail(raw)`.
  - `domain/request.ts`: hằng `REQUEST_STATUSES`, `TERMINAL_REQUEST_STATUSES`, `INVITE_STATUSES`, `ACTIVE_INVITE_STATUSES`, `PRICE_MODES`, `TITLE_MAX = 120`, `DESCRIPTION_MIN = 40`, `DESCRIPTION_MAX = 4000`, `APPROACH_MAX = 2000`, `PRICE_NOTE_MAX = 200`, `PRICE_MAX_USD = 1_000_000`, `TIMELINE_MAX_DAYS = 365`, `ADMIN_NOTE_MAX = 1000`, `MAX_ACTIVE_INVITES = 5`, `SUGGESTION_LIMIT = 10`, `SKILL_POINTS_MAX = 3`, `REQUEST_DAILY_LIMIT_PER_EMAIL = 3`, `REQUEST_HOURLY_LIMIT_PER_IP = 10`, `INVITE_REMIND_AFTER_MS`, `INVITE_TTL_MS`, `MATCHING_TTL_MS`, `EXPIRED_PENALTY_WINDOW_MS`; type `RequestStatus`, `TerminalRequestStatus`, `InviteStatus`, `PriceMode`, `Request`, `RequestInvite`, `InviteWithBuilder`, `AdminRequest`, `InvitationListItem`, `Invitation`, `RequestAction`, `RequestActor`, `InviteAction`, `InviteActor`, `RequestFormValues`, `RequestInput`, `RequestErrors`, `RequestFieldError`, `ProposalFormValues`, `ProposalInput`, `ProposalErrors`, `ProposalFieldError`, `Candidate`, `SuggestionReason`, `Suggestion`; hàm `requestTransition`, `inviteTransition`, `isTerminalRequest`, `requestValuesFromBody`, `isRequestHoneypotFilled`, `parseRequestForm`, `proposalValuesFromBody`, `parseProposal`, `parseAdminNote`, `suggestBuilders`.
  - `db/requests.ts`: `RequestGuard`, `InviteGuard`, `NewRequest`, `toRequest`, `toInvite`, `createRequest`, `findRequestById`, `findClientRequest`, `listClientRequests`, `findRequestWithClient`, `setRequestStatusStatement`, `returnedRequest`, `endRequestBatch`, `inviteBuildersBatch`, `listRequestInvites`, `deletePendingRequestStatement`.
  - `db/inquiries.ts`: `SelectedRequestGuard`, `createInquiryStatements(db, input, onlyIf?)`; `NewInquiry.requestId?: string | null`.
  - `db/audit.ts`: `AuditRequestGuard = RequestGuard`, `AuditInviteGuard = InviteGuard`.
  - `db/builders.ts`: `jsonList(value)` (đã có, nay `export`).
  - fixtures: `makeRequest(opts)` → `{ client, request }`; `inviteBuilders(request, builders, now?)` → `RequestInvite[]`; `proposeOn(invite, now?)` → `RequestInvite`.

- [ ] **Step 1: Migration**

`apps/web/migrations/0008_requests.sql`:

```sql
-- Wave 1 requests (spec §5.7, §6.1, §7.5, §7.6). Additive only.
-- Additions to spec §6.1 (plan M6): requests.client_name (the name builders see; never the e-mail), created_at /
-- updated_at on both tables (compare-and-set markers).
CREATE TABLE requests (
  id                 TEXT PRIMARY KEY,
  client_user_id     TEXT NOT NULL REFERENCES users (id),
  client_name        TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  category           TEXT NOT NULL
                     CHECK (category IN ('booking', 'crm', 'ecommerce', 'finance', 'hr', 'education', 'internal_tools', 'ai_agents', 'other')),
  budget_band        TEXT NOT NULL CHECK (budget_band IN ('<500', '500-2k', '2k-10k', '>10k', 'unsure')),
  deadline           TEXT,
  languages          TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL
                     CHECK (status IN ('pending_verification', 'submitted', 'matching', 'builder_selected', 'rejected', 'expired', 'closed', 'removed')),
  locale             TEXT NOT NULL DEFAULT 'en',
  admin_note         TEXT,
  selected_invite_id TEXT,
  submitted_at       TEXT,
  matched_at         TEXT,
  closed_at          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_requests_status ON requests (status, submitted_at);
CREATE INDEX idx_requests_client ON requests (client_user_id);

CREATE TABLE request_invites (
  id              TEXT PRIMARY KEY,
  request_id      TEXT NOT NULL REFERENCES requests (id),
  builder_id      TEXT NOT NULL REFERENCES builders (user_id),
  invited_by      TEXT NOT NULL REFERENCES users (id),
  status          TEXT NOT NULL CHECK (status IN ('invited', 'proposed', 'selected', 'not_selected', 'declined', 'expired')),
  approach        TEXT,
  price_cents     INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  price_max_cents INTEGER CHECK (price_max_cents IS NULL OR (price_cents IS NOT NULL AND price_max_cents > price_cents)),
  price_note      TEXT,
  timeline_days   INTEGER CHECK (timeline_days IS NULL OR timeline_days BETWEEN 1 AND 365),
  decline_reason  TEXT,
  invited_at      TEXT NOT NULL,
  responded_at    TEXT,
  reminded_at     TEXT,
  inquiry_id      TEXT REFERENCES inquiries (id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (request_id, builder_id)
);
CREATE INDEX idx_request_invites_builder ON request_invites (builder_id, status);
CREATE INDEX idx_request_invites_request ON request_invites (request_id);
```

Sửa ghi chú thứ tự deploy trong `apps/web/wrangler.jsonc`: dòng `1. npm run db:migrate:remote …` thêm `0008_requests`, và thêm sau đoạn về `0007_inquiries`:

```jsonc
  // 0008_requests (M6) ships with the M6 code the same way: migrate first, then deploy (the daily cron reads 0008 too).
```

- [ ] **Step 2: Xuất helper của Inquiry (giữ hành vi)**

Trong `apps/web/src/domain/inquiry.ts`, thay phần kiểm deadline / tên / email bên trong `parseInquiryForm` bằng 3 hàm xuất ra (request dùng lại ở Task 3):

```ts
/** Spec §5.6/§5.7 deadline: empty, or a calendar date from `today` (UTC, YYYY-MM-DD) to 5 years ahead. */
export function parseDeadline(raw: string, today: string): { ok: true; deadline: string | null } | { ok: false } {
  if (!raw) return { ok: true, deadline: null };
  const latest = `${Number(today.slice(0, 4)) + DEADLINE_MAX_YEARS}${today.slice(4)}`;
  if (!isCalendarDate(raw) || raw < today || raw > latest) return { ok: false };
  return { ok: true, deadline: raw };
}

/** The name the other side sees: 1–80 characters, no control or format characters. */
export function parseClientName(raw: string): { ok: true; name: string } | { ok: false; error: "required" | "too_long" | "invalid" } {
  const name = raw.trim();
  if (!name) return { ok: false, error: "required" };
  if (name.length > NAME_MAX) return { ok: false, error: "too_long" };
  if (CONTROL.test(name)) return { ok: false, error: "invalid" };
  return { ok: true, name };
}

/** Lower-cased e-mail as on the sign-in form, or null when it is not one. */
export function parseClientEmail(raw: string): string | null {
  const parsed = Email.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
```

và trong `parseInquiryForm`:

```ts
  let deadline: string | null = null;
  const due = parseDeadline(values.deadline, opts.today);
  if (due.ok) deadline = due.deadline;
  else errors.deadline = "date";

  const named = parseClientName(values.name);
  const name = named.ok ? named.name : "";
  if (!named.ok) errors.name = named.error;

  let email: string | null = null;
  if (opts.needEmail) {
    email = parseClientEmail(values.email);
    if (!email) errors.email = "email";
  }
```

Chạy: `npm test -w apps/web -- test/domain/inquiry.test.ts test/public/inquiry-form.test.ts` → PASS (không đổi hành vi).

- [ ] **Step 3: Test domain (fail)**

`apps/web/test/domain/request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  INVITE_STATUSES,
  inviteTransition,
  isTerminalRequest,
  parseAdminNote,
  parseProposal,
  parseRequestForm,
  proposalValuesFromBody,
  REQUEST_STATUSES,
  requestTransition,
  requestValuesFromBody,
  suggestBuilders,
  type Candidate,
  type ProposalFormValues,
  type RequestFormValues,
} from "../../src/domain/request.ts";

describe("request state machine (spec §7.5)", () => {
  it("submits a pending request only through the confirmation", () => {
    expect(requestTransition("pending_verification", "verify", "system")).toEqual({ ok: true, status: "submitted" });
    expect(requestTransition("pending_verification", "verify", "client").ok).toBe(false);
    expect(requestTransition("submitted", "verify", "system").ok).toBe(false);
  });

  it("moves to matching on the admin's invitations, from submitted or matching", () => {
    expect(requestTransition("submitted", "invite", "admin")).toEqual({ ok: true, status: "matching" });
    expect(requestTransition("matching", "invite", "admin")).toEqual({ ok: true, status: "matching" });
    expect(requestTransition("closed", "invite", "admin").ok).toBe(false);
    expect(requestTransition("submitted", "invite", "client").ok).toBe(false);
  });

  it("lets the admin return only a submitted request", () => {
    expect(requestTransition("submitted", "reject", "admin")).toEqual({ ok: true, status: "rejected" });
    expect(requestTransition("matching", "reject", "admin").ok).toBe(false);
  });

  it("lets the client select only while matching, and close while submitted or matching", () => {
    expect(requestTransition("matching", "select", "client")).toEqual({ ok: true, status: "builder_selected" });
    expect(requestTransition("submitted", "select", "client").ok).toBe(false);
    expect(requestTransition("submitted", "close", "client")).toEqual({ ok: true, status: "closed" });
    expect(requestTransition("matching", "close", "client")).toEqual({ ok: true, status: "closed" });
    expect(requestTransition("builder_selected", "close", "client").ok).toBe(false);
    expect(requestTransition("pending_verification", "close", "client").ok).toBe(false);
  });

  it("expires only matching requests, by the system", () => {
    expect(requestTransition("matching", "expire", "system")).toEqual({ ok: true, status: "expired" });
    expect(requestTransition("submitted", "expire", "system").ok).toBe(false);
  });

  it("lets the admin remove from any status except removed", () => {
    for (const status of REQUEST_STATUSES) {
      expect(requestTransition(status, "remove", "admin").ok).toBe(status !== "removed");
    }
    expect(requestTransition("submitted", "remove", "client").ok).toBe(false);
  });

  it("names the terminal statuses", () => {
    expect(REQUEST_STATUSES.filter(isTerminalRequest)).toEqual(["builder_selected", "rejected", "expired", "closed", "removed"]);
  });
});

describe("invite state machine (spec §7.6)", () => {
  it("allows exactly the documented moves", () => {
    const moves: [string, string, string, string][] = [
      ["invited", "propose", "builder", "proposed"],
      ["invited", "decline", "builder", "declined"],
      ["proposed", "select", "client", "selected"],
      ["proposed", "not_select", "system", "not_selected"],
      ["invited", "expire", "system", "expired"],
    ];
    for (const status of INVITE_STATUSES) {
      for (const action of ["propose", "decline", "select", "not_select", "expire"] as const) {
        for (const actor of ["builder", "client", "system"] as const) {
          const hit = moves.find((m) => m[0] === status && m[1] === action && m[2] === actor);
          const result = inviteTransition(status, action, actor);
          expect(result, `${status} ${action} ${actor}`).toEqual(hit ? { ok: true, status: hit[3] } : { ok: false, error: "invalid_transition" });
        }
      }
    }
  });
});

const TODAY = "2026-10-04";
const form = (overrides: Partial<RequestFormValues> = {}): RequestFormValues => ({
  title: "Booking app for three salons",
  description: "We need online booking with reminders for three salons in Hanoi.",
  category: "booking",
  budgetBand: "2k-10k",
  deadline: "",
  languages: ["vi", "en"],
  name: "Minh Tran",
  email: "",
  website: "",
  ...overrides,
});

describe("parseRequestForm (spec §5.7 step 1)", () => {
  it("accepts a complete form and orders the languages", () => {
    const result = parseRequestForm(form(), { needEmail: false, today: TODAY });
    expect(result).toEqual({
      ok: true,
      input: { title: "Booking app for three salons", description: "We need online booking with reminders for three salons in Hanoi.", category: "booking", budgetBand: "2k-10k", deadline: null, languages: ["en", "vi"], name: "Minh Tran", email: null },
    });
  });

  it("reads repeated language fields and CRLF descriptions from a form body", () => {
    const values = requestValuesFromBody({ title: " T ", description: "a\r\nb", languages: ["zh", "zh", "vi"], name: "N" });
    expect(values.description).toBe("a\nb");
    expect(values.languages).toEqual(["zh", "zh", "vi"]);
    expect(requestValuesFromBody({ languages: "en" }).languages).toEqual(["en"]);
    expect(requestValuesFromBody({}).languages).toEqual([]);
  });

  it("reports each broken field", () => {
    const result = parseRequestForm(
      form({ title: "x".repeat(121), description: "too short", category: "games", budgetBand: "lots", deadline: "2026-10-03", languages: ["fr"], name: "", email: "nope" }),
      { needEmail: true, today: TODAY },
    );
    expect(result).toEqual({ ok: false, errors: { title: "too_long", description: "too_short", category: "choice", budgetBand: "choice", deadline: "date", languages: "choice", name: "required", email: "email" } });
  });

  it("rejects an empty title, a title with a line break, no language, and a description over 4000", () => {
    expect(parseRequestForm(form({ title: "  " }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { title: "required" } });
    expect(parseRequestForm(form({ title: "a\nb" }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { title: "invalid" } });
    expect(parseRequestForm(form({ languages: [] }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { languages: "choice" } });
    expect(parseRequestForm(form({ description: "y".repeat(4001) }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { description: "too_long" } });
  });

  it("requires and lower-cases the e-mail when signed out", () => {
    const result = parseRequestForm(form({ email: " New@Client.Example " }), { needEmail: true, today: TODAY });
    expect(result.ok && result.input.email).toBe("new@client.example");
  });
});

const proposal = (overrides: Partial<ProposalFormValues> = {}): ProposalFormValues => ({
  approach: "Next.js with a booking calendar and SMS reminders.",
  priceMode: "fixed",
  price: "4500",
  priceMax: "",
  priceNote: "",
  timelineDays: "30",
  ...overrides,
});

describe("parseProposal (spec §5.7 step 3)", () => {
  it("accepts a fixed price, a range and 'to discuss'", () => {
    expect(parseProposal(proposal())).toEqual({ ok: true, input: { approach: "Next.js with a booking calendar and SMS reminders.", priceCents: 450000, priceMaxCents: null, priceNote: "", timelineDays: 30 } });
    expect(parseProposal(proposal({ priceMode: "range", price: "3000", priceMax: "5000" }))).toMatchObject({ ok: true, input: { priceCents: 300000, priceMaxCents: 500000 } });
    expect(parseProposal(proposal({ priceMode: "discuss", price: "999" }))).toMatchObject({ ok: true, input: { priceCents: null, priceMaxCents: null } });
  });

  it("ignores the upper bound for a fixed price", () => {
    expect(parseProposal(proposal({ priceMax: "9" }))).toMatchObject({ ok: true, input: { priceMaxCents: null } });
  });

  it("rejects bad amounts, inverted ranges, bad days and long text", () => {
    expect(parseProposal(proposal({ price: "0" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ price: "12.50" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ price: "1000001" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ priceMode: "range", price: "5000", priceMax: "5000" }))).toMatchObject({ ok: false, errors: { priceMax: "range" } });
    expect(parseProposal(proposal({ priceMode: "auction" }))).toMatchObject({ ok: false, errors: { priceMode: "choice" } });
    expect(parseProposal(proposal({ timelineDays: "0" }))).toMatchObject({ ok: false, errors: { timelineDays: "days" } });
    expect(parseProposal(proposal({ timelineDays: "366" }))).toMatchObject({ ok: false, errors: { timelineDays: "days" } });
    expect(parseProposal(proposal({ approach: " " }))).toMatchObject({ ok: false, errors: { approach: "required" } });
    expect(parseProposal(proposal({ approach: "a".repeat(2001), priceNote: "b".repeat(201) }))).toMatchObject({ ok: false, errors: { approach: "too_long", priceNote: "too_long" } });
  });

  it("reads a form body", () => {
    expect(proposalValuesFromBody({ approach: "a\r\nb", priceMode: "range", price: " 10 ", priceMax: "20", timelineDays: "7" })).toEqual({ approach: "a\nb", priceMode: "range", price: "10", priceMax: "20", priceNote: "", timelineDays: "7" });
  });
});

describe("parseAdminNote", () => {
  it("needs 1–1000 characters", () => {
    expect(parseAdminNote(" Try a product listing first. ")).toEqual({ ok: true, note: "Try a product listing first." });
    expect(parseAdminNote("")).toEqual({ ok: false, error: "required" });
    expect(parseAdminNote("x".repeat(1001))).toEqual({ ok: false, error: "too_long" });
  });
});

const candidate = (overrides: Partial<Candidate> & { handle: string }): Candidate => ({
  userId: `u-${overrides.handle}`,
  name: overrides.handle,
  availability: "limited",
  skills: [],
  workLanguages: [],
  hasCategoryProduct: false,
  expiredInvites: 0,
  ...overrides,
});

describe("suggestBuilders (spec §8.10)", () => {
  const request = { title: "Booking app with Next.js", description: "Supabase backend, SMS reminders, three salons.", languages: ["vi" as const] };

  it("scores category, skills (max 3), language, availability and expired invites, with reasons", () => {
    const [top] = suggestBuilders(request, [
      candidate({ handle: "full", hasCategoryProduct: true, skills: ["Next.js", "supabase", "SMS", "Booking", "next.js"], workLanguages: ["vi"], availability: "open", expiredInvites: 2 }),
    ]);
    expect(top?.score).toBe(3 + 3 + 1 + 1 - 2);
    expect(top?.reasons).toEqual([
      { kind: "category" },
      { kind: "skill", skill: "Next.js" },
      { kind: "skill", skill: "supabase" },
      { kind: "skill", skill: "SMS" },
      { kind: "language" },
      { kind: "open" },
      { kind: "expired", count: 2 },
    ]);
  });

  it("ranks a builder with a product in the category above one without, ties by handle, at most 10", () => {
    const list = suggestBuilders(request, [
      candidate({ handle: "zeta" }),
      candidate({ handle: "alpha" }),
      candidate({ handle: "cat", hasCategoryProduct: true }),
      ...Array.from({ length: 12 }, (_, i) => candidate({ handle: `n${String(i).padStart(2, "0")}` })),
    ]);
    expect(list).toHaveLength(10);
    expect(list[0]?.candidate.handle).toBe("cat");
    expect(list[1]?.candidate.handle).toBe("alpha");
  });

  it("ignores empty skills and skills that do not appear", () => {
    const [top] = suggestBuilders(request, [candidate({ handle: "x", skills: ["", "  ", "Flutter"] })]);
    expect(top?.score).toBe(0);
    expect(top?.reasons).toEqual([]);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/request.test.ts` → FAIL (module chưa có).

- [ ] **Step 4: `domain/request.ts`**

`apps/web/src/domain/request.ts`:

```ts
import type { Availability, WorkLanguage } from "./builder.ts";
import { WORK_LANGUAGES } from "./builder.ts";
import { BUDGET_BANDS, parseClientEmail, parseClientName, parseDeadline, type BudgetBand } from "./inquiry.ts";
import { CATEGORIES, type Category } from "./product.ts";
import { normalizeNewlines } from "./product-input.ts";

export const REQUEST_STATUSES = ["pending_verification", "submitted", "matching", "builder_selected", "rejected", "expired", "closed", "removed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const TERMINAL_REQUEST_STATUSES = ["builder_selected", "rejected", "expired", "closed", "removed"] as const satisfies readonly RequestStatus[];
export type TerminalRequestStatus = (typeof TERMINAL_REQUEST_STATUSES)[number];
export const INVITE_STATUSES = ["invited", "proposed", "selected", "not_selected", "declined", "expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
/** Invitations that count against the cap of 5 (spec §7.6). */
export const ACTIVE_INVITE_STATUSES = ["invited", "proposed"] as const satisfies readonly InviteStatus[];
export const PRICE_MODES = ["fixed", "range", "discuss"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 40;
export const DESCRIPTION_MAX = 4000;
export const APPROACH_MAX = 2000;
export const PRICE_NOTE_MAX = 200;
export const PRICE_MAX_USD = 1_000_000;
export const TIMELINE_MAX_DAYS = 365;
export const ADMIN_NOTE_MAX = 1000;
export const MAX_ACTIVE_INVITES = 5;
export const SUGGESTION_LIMIT = 10;
export const SKILL_POINTS_MAX = 3;
export const REQUEST_DAILY_LIMIT_PER_EMAIL = 3;
export const REQUEST_HOURLY_LIMIT_PER_IP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_REMIND_AFTER_MS = 3 * DAY_MS;
export const INVITE_TTL_MS = 7 * DAY_MS;
export const MATCHING_TTL_MS = 30 * DAY_MS;
export const EXPIRED_PENALTY_WINDOW_MS = 60 * DAY_MS;

export interface Request {
  id: string;
  clientUserId: string;
  clientName: string;
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  status: RequestStatus;
  locale: string;
  adminNote: string | null;
  selectedInviteId: string | null;
  submittedAt: string | null;
  matchedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestInvite {
  id: string;
  requestId: string;
  builderId: string;
  invitedBy: string;
  status: InviteStatus;
  approach: string | null;
  priceCents: number | null;
  priceMaxCents: number | null;
  priceNote: string | null;
  timelineDays: number | null;
  declineReason: string | null;
  invitedAt: string;
  respondedAt: string | null;
  remindedAt: string | null;
  inquiryId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An invitation with the builder's public name (admin, /me). `builderPublic` = approved builder on an active account. */
export interface InviteWithBuilder {
  invite: RequestInvite;
  builderName: string;
  builderHandle: string;
  builderPublic: boolean;
}

/** Admin rows (spec §5.5): the admin may see the client's e-mail. */
export interface AdminRequest {
  request: Request;
  clientEmail: string;
  activeInvites: number;
  totalInvites: number;
  proposals: number;
}

/** A row of the builder's Invitations tab. */
export interface InvitationListItem {
  invite: RequestInvite;
  requestTitle: string;
  requestCategory: Category;
  requestStatus: RequestStatus;
}

/** What an invited builder sees (spec §5.7 step 3): the request with the client's typed name; there is no e-mail in it. */
export interface Invitation {
  invite: RequestInvite;
  request: Request;
}

export type RequestAction = "verify" | "invite" | "reject" | "select" | "close" | "expire" | "remove";
export type RequestActor = "system" | "client" | "admin";
export type RequestTransition = { ok: true; status: RequestStatus } | { ok: false; error: "invalid_transition" };

const REQUEST_RULES: Record<RequestAction, { from: readonly RequestStatus[] | "any"; to: RequestStatus; actor: RequestActor }> = {
  verify: { from: ["pending_verification"], to: "submitted", actor: "system" },
  invite: { from: ["submitted", "matching"], to: "matching", actor: "admin" },
  reject: { from: ["submitted"], to: "rejected", actor: "admin" },
  select: { from: ["matching"], to: "builder_selected", actor: "client" },
  close: { from: ["submitted", "matching"], to: "closed", actor: "client" },
  expire: { from: ["matching"], to: "expired", actor: "system" },
  remove: { from: "any", to: "removed", actor: "admin" },
};

/** Spec §7.5. */
export function requestTransition(status: RequestStatus, action: RequestAction, actor: RequestActor): RequestTransition {
  const rule = REQUEST_RULES[action];
  const allowed = rule.from === "any" ? status !== "removed" : rule.from.includes(status);
  return rule.actor === actor && allowed ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}

export function isTerminalRequest(status: RequestStatus): status is TerminalRequestStatus {
  return (TERMINAL_REQUEST_STATUSES as readonly string[]).includes(status);
}

export type InviteAction = "propose" | "decline" | "select" | "not_select" | "expire";
export type InviteActor = "builder" | "client" | "system";
export type InviteTransition = { ok: true; status: InviteStatus } | { ok: false; error: "invalid_transition" };

const INVITE_RULES: Record<InviteAction, { from: InviteStatus; to: InviteStatus; actor: InviteActor }> = {
  propose: { from: "invited", to: "proposed", actor: "builder" },
  decline: { from: "invited", to: "declined", actor: "builder" },
  select: { from: "proposed", to: "selected", actor: "client" },
  not_select: { from: "proposed", to: "not_selected", actor: "system" },
  expire: { from: "invited", to: "expired", actor: "system" },
};

/** Spec §7.6. */
export function inviteTransition(status: InviteStatus, action: InviteAction, actor: InviteActor): InviteTransition {
  const rule = INVITE_RULES[action];
  return rule.from === status && rule.actor === actor ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}

const text = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");
const CONTROL = /[\p{Cc}\p{Cf}]/u;

export type RequestFormValues = {
  title: string;
  description: string;
  category: string;
  budgetBand: string;
  deadline: string;
  languages: string[];
  name: string;
  email: string;
  website: string;
};
export type RequestField = "title" | "description" | "category" | "budgetBand" | "deadline" | "languages" | "name" | "email";
export type RequestFieldError = "required" | "too_short" | "too_long" | "choice" | "date" | "email" | "invalid";
export type RequestErrors = Partial<Record<RequestField, RequestFieldError>>;
export interface RequestInput {
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  name: string;
  email: string | null;
}

/** `body` from `c.req.parseBody({ all: true })`: a repeated field arrives as an array. */
export function requestValuesFromBody(body: Record<string, unknown>): RequestFormValues {
  const raw = body.languages;
  const languages = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).filter((v): v is string => typeof v === "string");
  const one = (value: unknown) => text(Array.isArray(value) ? value[0] : value);
  return {
    title: one(body.title),
    description: one(body.description),
    category: one(body.category),
    budgetBand: one(body.budgetBand),
    deadline: one(body.deadline).trim(),
    languages,
    name: one(body.name),
    email: one(body.email),
    website: one(body.website),
  };
}

export function isRequestHoneypotFilled(values: RequestFormValues): boolean {
  return values.website.trim() !== "";
}

/** Spec §5.7 step 1. `today` is the UTC date (YYYY-MM-DD). */
export function parseRequestForm(values: RequestFormValues, opts: { needEmail: boolean; today: string }): { ok: true; input: RequestInput } | { ok: false; errors: RequestErrors } {
  const errors: RequestErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = "required";
  else if (title.length > TITLE_MAX) errors.title = "too_long";
  else if (CONTROL.test(title)) errors.title = "invalid";

  const description = values.description.trim();
  if (!description) errors.description = "required";
  else if (description.length < DESCRIPTION_MIN) errors.description = "too_short";
  else if (description.length > DESCRIPTION_MAX) errors.description = "too_long";

  const category = (CATEGORIES as readonly string[]).includes(values.category) ? (values.category as Category) : null;
  if (!category) errors.category = "choice";

  const budgetBand = (BUDGET_BANDS as readonly string[]).includes(values.budgetBand) ? (values.budgetBand as BudgetBand) : null;
  if (!budgetBand) errors.budgetBand = "choice";

  const due = parseDeadline(values.deadline, opts.today);
  if (!due.ok) errors.deadline = "date";

  const known = values.languages.every((l) => (WORK_LANGUAGES as readonly string[]).includes(l));
  const languages = WORK_LANGUAGES.filter((l) => values.languages.includes(l));
  if (!known || languages.length === 0) errors.languages = "choice";

  const named = parseClientName(values.name);
  if (!named.ok) errors.name = named.error;

  let email: string | null = null;
  if (opts.needEmail) {
    email = parseClientEmail(values.email);
    if (!email) errors.email = "email";
  }

  if (Object.keys(errors).length > 0 || !category || !budgetBand || !due.ok || !named.ok) return { ok: false, errors };
  return { ok: true, input: { title, description, category, budgetBand, deadline: due.deadline, languages, name: named.name, email } };
}

export type ProposalFormValues = { approach: string; priceMode: string; price: string; priceMax: string; priceNote: string; timelineDays: string };
export type ProposalField = keyof ProposalFormValues;
export type ProposalFieldError = "required" | "too_long" | "choice" | "amount" | "range" | "days";
export type ProposalErrors = Partial<Record<ProposalField, ProposalFieldError>>;
export interface ProposalInput {
  approach: string;
  priceCents: number | null;
  priceMaxCents: number | null;
  priceNote: string;
  timelineDays: number;
}

export function proposalValuesFromBody(body: Record<string, unknown>): ProposalFormValues {
  return {
    approach: text(body.approach),
    priceMode: text(body.priceMode),
    price: text(body.price).trim(),
    priceMax: text(body.priceMax).trim(),
    priceNote: text(body.priceNote),
    timelineDays: text(body.timelineDays).trim(),
  };
}

/** Whole US dollars, 1 – PRICE_MAX_USD, as cents; anything else is null. */
function wholeUsdCents(raw: string): number | null {
  if (!/^\d{1,7}$/.test(raw)) return null;
  const usd = Number(raw);
  return usd >= 1 && usd <= PRICE_MAX_USD ? usd * 100 : null;
}

/** Spec §5.7 step 3: approach, a price (amount, range or "to discuss"), and a timeline in days. */
export function parseProposal(values: ProposalFormValues): { ok: true; input: ProposalInput } | { ok: false; errors: ProposalErrors } {
  const errors: ProposalErrors = {};
  const approach = values.approach.trim();
  if (!approach) errors.approach = "required";
  else if (approach.length > APPROACH_MAX) errors.approach = "too_long";

  let priceCents: number | null = null;
  let priceMaxCents: number | null = null;
  const mode = (PRICE_MODES as readonly string[]).includes(values.priceMode) ? (values.priceMode as PriceMode) : null;
  if (!mode) errors.priceMode = "choice";
  if (mode === "fixed" || mode === "range") {
    priceCents = wholeUsdCents(values.price);
    if (priceCents === null) errors.price = "amount";
  }
  if (mode === "range") {
    priceMaxCents = wholeUsdCents(values.priceMax);
    if (priceMaxCents === null) errors.priceMax = "amount";
    else if (priceCents !== null && priceMaxCents <= priceCents) errors.priceMax = "range";
  }

  const priceNote = values.priceNote.trim();
  if (priceNote.length > PRICE_NOTE_MAX) errors.priceNote = "too_long";

  const days = /^\d{1,3}$/.test(values.timelineDays) ? Number(values.timelineDays) : 0;
  if (days < 1 || days > TIMELINE_MAX_DAYS) errors.timelineDays = "days";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { approach, priceCents, priceMaxCents, priceNote, timelineDays: days } };
}

/** The reason given to the client when the admin returns a request (spec §5.5: required). */
export function parseAdminNote(raw: unknown): { ok: true; note: string } | { ok: false; error: "required" | "too_long" } {
  const note = text(raw).trim();
  if (!note) return { ok: false, error: "required" };
  return note.length > ADMIN_NOTE_MAX ? { ok: false, error: "too_long" } : { ok: true, note };
}

/** A builder the admin may invite (db/requests listCandidates already dropped the ineligible ones). */
export interface Candidate {
  userId: string;
  handle: string;
  name: string;
  availability: Availability;
  skills: string[];
  workLanguages: WorkLanguage[];
  /** Has a published product in the request's category. */
  hasCategoryProduct: boolean;
  /** Invitations that expired, invited in the last 60 days. */
  expiredInvites: number;
}

export type SuggestionReason = { kind: "category" } | { kind: "skill"; skill: string } | { kind: "language" } | { kind: "open" } | { kind: "expired"; count: number };
export interface Suggestion {
  candidate: Candidate;
  score: number;
  reasons: SuggestionReason[];
}

const POINTS = (r: SuggestionReason): number => (r.kind === "category" ? 3 : r.kind === "expired" ? -r.count : 1);

/**
 * Spec §8.10 rule-based suggestions. Only helps the admin; the admin decides. ADR-004: nothing paid reaches the order;
 * ties go by handle so the list is stable.
 */
export function suggestBuilders(request: Pick<Request, "title" | "description" | "languages">, candidates: readonly Candidate[], limit = SUGGESTION_LIMIT): Suggestion[] {
  const haystack = `${request.title}\n${request.description}`.toLowerCase();
  return candidates
    .map((candidate) => {
      const reasons: SuggestionReason[] = [];
      if (candidate.hasCategoryProduct) reasons.push({ kind: "category" });
      const matched = new Set<string>();
      for (const skill of candidate.skills) {
        const needle = skill.trim().toLowerCase();
        if (!needle || matched.has(needle) || matched.size >= SKILL_POINTS_MAX || !haystack.includes(needle)) continue;
        matched.add(needle);
        reasons.push({ kind: "skill", skill: skill.trim() });
      }
      if (candidate.workLanguages.some((l) => request.languages.includes(l))) reasons.push({ kind: "language" });
      if (candidate.availability === "open") reasons.push({ kind: "open" });
      if (candidate.expiredInvites > 0) reasons.push({ kind: "expired", count: candidate.expiredInvites });
      return { candidate, score: reasons.reduce((sum, r) => sum + POINTS(r), 0), reasons };
    })
    .sort((a, b) => b.score - a.score || a.candidate.handle.localeCompare(b.candidate.handle))
    .slice(0, limit);
}
```

Chạy: `npm test -w apps/web -- test/domain/request.test.ts` → PASS.

- [ ] **Step 5: `createInquiryStatements` trong `db/inquiries.ts`**

Thêm `requestId?: string | null` vào `NewInquiry`, thay thân `createInquiry` bằng hàm dựng câu lệnh (Task 6 chèn hai câu này vào batch chọn đề xuất):

```ts
/** Task 6 (M6): the inquiry is written only when the same batch just moved the request to builder_selected for this invite. */
export type SelectedRequestGuard = { requestId: string; inviteId: string; updatedAt: string };

/** The inquiry and its first message as statements; with a guard, nothing is written unless the guard holds. */
export function createInquiryStatements(db: D1Database, input: NewInquiry, onlyIf?: SelectedRequestGuard): { statements: D1PreparedStatement[]; id: string; firstMessageId: string } {
  const at = Date.parse(input.now);
  const id = ulid(at);
  const firstMessageId = ulid(at);
  const guard = onlyIf ? "WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?14 AND status = 'builder_selected' AND selected_invite_id = ?15 AND updated_at = ?16)" : "";
  const insert = db
    .prepare(
      `INSERT INTO inquiries (id, client_user_id, client_name, builder_id, product_id, request_id, type, message, budget_band, deadline, status, locale,
         opened_at, last_activity_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CASE WHEN ?11 = 'open' THEN ?13 END, ?13, ?13, ?13 ${guard}
       RETURNING *`,
    )
    .bind(
      id, input.clientUserId, input.clientName, input.builderId, input.productId, input.requestId ?? null, input.type, input.message, input.budgetBand, input.deadline, input.status, input.locale, input.now,
      ...(onlyIf ? [onlyIf.requestId, onlyIf.inviteId, onlyIf.updatedAt] : []),
    );
  const message = db
    .prepare(
      `INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at)
       SELECT ?1, ?2, ?3, 'message', ?4, ?5 WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?2)`,
    )
    .bind(firstMessageId, id, input.clientUserId, input.message, input.now);
  return { statements: [insert, message], id, firstMessageId };
}

/** The inquiry and its first message (the client's text; its notification tells the builder) in one transaction. */
export async function createInquiry(db: D1Database, input: NewInquiry): Promise<{ inquiry: Inquiry; firstMessageId: string }> {
  const { statements, firstMessageId } = createInquiryStatements(db, input);
  const [rows] = await db.batch(statements);
  const row = rows?.results[0] as Row | undefined;
  if (!row) throw new Error("inquiry insert failed");
  return { inquiry: toInquiry(row), firstMessageId };
}
```

(Giữ các dòng bind như trên mỗi tham số một dòng nếu formatter của repo yêu cầu; nội dung không đổi.)

- [ ] **Step 6: Guard audit cho request và lời mời**

Trong `apps/web/src/db/audit.ts`:

```ts
import type { InviteGuard, RequestGuard } from "./requests.ts";

/** Written only when the batch's request compare-and-set went through (see RequestGuard). */
export type AuditRequestGuard = RequestGuard;
/** Written only when the batch's invitation compare-and-set went through (see InviteGuard). */
export type AuditInviteGuard = InviteGuard;
```

đổi chữ ký thành `onlyIf?: AuditUserGuard | AuditProductGuard | AuditInquiryGuard | AuditRequestGuard | AuditInviteGuard`, cập nhật doc comment ("`requestId` on the request's, `inviteId` on the invitation's"), và thêm hai nhánh trước nhánh product:

```ts
  if ("requestId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.requestId, onlyIf.status, onlyIf.updatedAt);
  }
  if ("inviteId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM request_invites WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.inviteId, onlyIf.status, onlyIf.updatedAt);
  }
```

- [ ] **Step 7: Test db (fail)**

Thêm vào `apps/web/test/architecture.test.ts` trong `WRITERS`:

```ts
  requests: "../src/db/requests.ts",
  request_invites: "../src/db/requests.ts",
```

Thêm fixture vào `apps/web/test/fixtures.ts` (import `createRequest`, `inviteBuildersBatch`, `findRequestById`, `listRequestInvites` từ `../src/db/requests.ts`; `Request`, `RequestInvite`, `RequestStatus` từ `../src/domain/request.ts`; `Category` từ `../src/domain/product.ts`; `WorkLanguage` từ `../src/domain/builder.ts`):

```ts
/** A client `<tag>-c@vnx.si` and a request, submitted (default) or pending_verification. */
export async function makeRequest(opts: {
  tag: string;
  status?: Extract<RequestStatus, "submitted" | "pending_verification">;
  category?: Category;
  languages?: WorkLanguage[];
  title?: string;
  description?: string;
  now?: string;
  clientLocale?: string;
}): Promise<{ client: UserRow; request: Request }> {
  const client = await ensureUser(`${opts.tag}-c@vnx.si`, opts.clientLocale);
  const request = await createRequest(testEnv.DB, {
    clientUserId: client.id,
    clientName: "Minh Tran",
    title: opts.title ?? `${opts.tag} booking app`,
    description: opts.description ?? "We need online booking with SMS reminders for three salons in Hanoi.",
    category: opts.category ?? "booking",
    budgetBand: "2k-10k",
    deadline: null,
    languages: opts.languages ?? ["en", "vi"],
    status: opts.status ?? "submitted",
    locale: opts.clientLocale === "vi" ? "vi" : "en",
    now: opts.now ?? new Date().toISOString(),
  });
  return { client, request };
}

/** Invites `builders` as the test admin, moving the request to matching. Returns the new invitations in order. */
export async function inviteBuilders(request: Request, builders: Builder[], now = new Date().toISOString()): Promise<RequestInvite[]> {
  const admin = await ensureUser("owner@vnx.si");
  const batch = inviteBuildersBatch(testEnv.DB, { requestId: request.id, builderIds: builders.map((b) => b.userId), invitedBy: admin.id, now });
  const outcome = batch.read(await testEnv.DB.batch(batch.statements));
  if (!outcome.request) throw new Error("invite failed");
  const all = await listRequestInvites(testEnv.DB, request.id);
  return builders.map((b) => all.find((x) => x.invite.builderId === b.userId)!.invite);
}

/** The builder's proposal on `invite` (fixed $4,500, 30 days), written straight to the DB. */
export async function proposeOn(invite: RequestInvite, now = new Date().toISOString()): Promise<RequestInvite> {
  await testEnv.DB
    .prepare(
      `UPDATE request_invites SET status = 'proposed', approach = 'Next.js with a booking calendar.', price_cents = 450000, timeline_days = 30,
         responded_at = ?2, updated_at = ?2 WHERE id = ?1 AND status = 'invited'`,
    )
    .bind(invite.id, now)
    .run();
  return (await listRequestInvites(testEnv.DB, invite.requestId)).find((x) => x.invite.id === invite.id)!.invite;
}
```

(`proposeOn` ghi thẳng SQL trong `test/`: test sở hữu bảng chỉ quét `src/`.)

`apps/web/test/db/requests.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import { createInquiryStatements, findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import {
  endRequestBatch,
  findClientRequest,
  findRequestById,
  inviteBuildersBatch,
  listClientRequests,
  listRequestInvites,
  returnedRequest,
  setRequestStatusStatement,
} from "../../src/db/requests.ts";
import { deleteGhostUsers } from "../../src/db/users.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeRequest, proposeOn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const later = (iso: string, ms = 1000) => new Date(Date.parse(iso) + ms).toISOString();

async function builders(tag: string, n: number) {
  return Promise.all(Array.from({ length: n }, (_, i) => makeBuilder(`${tag}-${i}@vnx.si`, `${tag}-${i}`, "approved")));
}

describe("db/requests (VNX-0601)", () => {
  it("creates submitted and pending requests; submitted_at only for submitted", async () => {
    const { request } = await makeRequest({ tag: "rq-new", languages: ["vi", "zh"] });
    expect(request).toMatchObject({ status: "submitted", clientName: "Minh Tran", languages: ["vi", "zh"], submittedAt: request.createdAt, matchedAt: null });
    const pending = await makeRequest({ tag: "rq-pend", status: "pending_verification" });
    expect(pending.request.submittedAt).toBeNull();
  });

  it("hides removed requests from their client and other clients' requests entirely", async () => {
    const { client, request } = await makeRequest({ tag: "rq-vis" });
    const other = await makeRequest({ tag: "rq-vis2" });
    expect((await findClientRequest(db(), client.id, request.id))?.id).toBe(request.id);
    expect(await findClientRequest(db(), client.id, other.request.id)).toBeNull();
    await db().prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    expect(await findClientRequest(db(), client.id, request.id)).toBeNull();
    expect(await listClientRequests(db(), client.id)).toEqual([]);
  });

  it("invites up to 5 active builders and moves the request to matching once", async () => {
    const { request } = await makeRequest({ tag: "rq-cap" });
    const six = await builders("rq-cap-b", 6);
    const admin = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: six.map((b) => b.userId), invitedBy: admin.id, now });
    const outcome = batch.read(await db().batch(batch.statements));
    expect(outcome.request?.status).toBe("matching");
    expect(outcome.request?.matchedAt).toBe(now);
    expect(outcome.invited.map((i) => i.builderId)).toEqual(six.slice(0, 5).map((b) => b.userId));
    expect(await listRequestInvites(db(), request.id)).toHaveLength(5);
  });

  it("frees a slot when an invitation is declined, never re-invites, keeps matched_at", async () => {
    const { request } = await makeRequest({ tag: "rq-slot" });
    const bs = await builders("rq-slot-b", 6);
    const first = await inviteBuilders(request, bs.slice(0, 5));
    await db().prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(first[0]!.id).run();
    const admin = await ensureUser("owner@vnx.si");
    const now = later(new Date().toISOString());
    const again = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [bs[0]!.userId, bs[5]!.userId], invitedBy: admin.id, now });
    const outcome = again.read(await db().batch(again.statements));
    expect(outcome.invited.map((i) => i.builderId)).toEqual([bs[5]!.userId]);
    expect(outcome.request?.matchedAt).toBe((await findRequestById(db(), request.id))?.matchedAt);
    expect(outcome.request?.matchedAt).not.toBe(now);
  });

  it("never invites the client, a suspended builder, or into a closed request; then nothing changes", async () => {
    const { client, request } = await makeRequest({ tag: "rq-bad" });
    const self = await makeBuilder(client.email, "rq-bad-self", "approved");
    const suspended = await makeBuilder("rq-bad-s@vnx.si", "rq-bad-s", "suspended");
    const admin = await ensureUser("owner@vnx.si");
    const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [self.userId, suspended.userId], invitedBy: admin.id, now: new Date().toISOString() });
    const outcome = batch.read(await db().batch(batch.statements));
    expect(outcome).toEqual({ request: null, invited: [] });
    expect((await findRequestById(db(), request.id))?.status).toBe("submitted");

    const ok = await builders("rq-bad-ok", 1);
    await db().prepare("UPDATE requests SET status = 'closed' WHERE id = ?1").bind(request.id).run();
    const closed = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [ok[0]!.userId], invitedBy: admin.id, now: new Date().toISOString() });
    expect(closed.read(await db().batch(closed.statements))).toEqual({ request: null, invited: [] });
    expect(await listRequestInvites(db(), request.id)).toEqual([]);
  });

  it("ends a request: invited -> expired, proposed -> not_selected, with an audit row, all or nothing", async () => {
    const { request } = await makeRequest({ tag: "rq-end" });
    const bs = await builders("rq-end-b", 3);
    const [a, b, c] = await inviteBuilders(request, bs);
    await proposeOn(a!);
    await db().prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(c!.id).run();
    const current = (await findRequestById(db(), request.id))!;
    const now = later(current.updatedAt);
    const end = endRequestBatch(db(), { id: request.id, from: "matching", to: "closed", now });
    const results = await db().batch([...end.statements, auditStatement(db(), { actorUserId: null, action: "request.close", entity: "request", entityId: request.id, now }, { requestId: request.id, status: "closed", updatedAt: now })]);
    const outcome = end.read(results);
    expect(outcome.request).toMatchObject({ status: "closed", closedAt: now });
    expect(outcome.notSelected).toEqual([a!.id]);
    const invites = await listRequestInvites(db(), request.id);
    expect(invites.map((x) => [x.invite.id, x.invite.status])).toEqual([
      [a!.id, "not_selected"],
      [b!.id, "expired"],
      [c!.id, "declined"],
    ]);
    const audit = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.close' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);

    // Lost compare-and-set (already closed): nothing else is written.
    const again = endRequestBatch(db(), { id: request.id, from: "matching", to: "expired", now: later(now) });
    const second = again.read(await db().batch([...again.statements, auditStatement(db(), { actorUserId: null, action: "request.expire", entity: "request", entityId: request.id, now: later(now) }, { requestId: request.id, status: "expired", updatedAt: later(now) })]));
    expect(second).toEqual({ request: null, notSelected: [] });
    const expireAudit = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.expire' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(expireAudit?.n).toBe(0);
  });

  it("creates a guarded inquiry only when the batch selected that invitation", async () => {
    const { client, request } = await makeRequest({ tag: "rq-sel" });
    const [builder] = await builders("rq-sel-b", 1);
    const [invite] = await inviteBuilders(request, [builder!]);
    await proposeOn(invite!);
    const current = (await findRequestById(db(), request.id))!;
    const now = later(current.updatedAt);
    const inquiry = createInquiryStatements(
      db(),
      { clientUserId: client.id, clientName: "Minh Tran", builderId: builder!.userId, productId: null, requestId: request.id, type: "request", message: "Request + proposal", budgetBand: "2k-10k", deadline: null, status: "open", locale: "en", now },
      { requestId: request.id, inviteId: invite!.id, updatedAt: now },
    );
    // Wrong guard (no compare-and-set in this batch): nothing is written.
    await db().batch(inquiry.statements);
    expect(await findInquiryById(db(), inquiry.id)).toBeNull();

    const moved = await db().batch([setRequestStatusStatement(db(), { id: request.id, from: "matching", to: "builder_selected", now, selectedInviteId: invite!.id }), ...inquiry.statements]);
    expect(returnedRequest(moved[0])?.selectedInviteId).toBe(invite!.id);
    const created = await findInquiryById(db(), inquiry.id);
    expect(created).toMatchObject({ type: "request", requestId: request.id, status: "open", openedAt: now });
    expect((await listMessages(db(), inquiry.id)).map((m) => m.id)).toEqual([inquiry.firstMessageId]);
  });

  it("keeps an implicit account that has a request, and deletes one that has nothing", async () => {
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const { client } = await makeRequest({ tag: "rq-ghost", status: "pending_verification", now: old });
    await db().prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(client.id, old).run();
    const bare = await ensureUser("rq-ghost-bare@vnx.si");
    await db().prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(bare.id, old).run();
    await deleteGhostUsers(db(), new Date(Date.now() - 48 * 3600 * 1000).toISOString());
    expect(await db().prepare("SELECT id FROM users WHERE id = ?1").bind(client.id).first()).not.toBeNull();
    expect(await db().prepare("SELECT id FROM users WHERE id = ?1").bind(bare.id).first()).toBeNull();
  });
});
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts test/architecture.test.ts` → FAIL (`db/requests.ts` chưa có; `WRITERS` chưa có module).

- [ ] **Step 8: `db/requests.ts`**

Đổi `function jsonList` trong `apps/web/src/db/builders.ts` thành `export function jsonList`.

`apps/web/src/db/requests.ts`:

```ts
import { WORK_LANGUAGES, type WorkLanguage } from "../domain/builder.ts";
import type { BudgetBand } from "../domain/inquiry.ts";
import type { Category } from "../domain/product.ts";
import {
  MAX_ACTIVE_INVITES,
  type InviteStatus,
  type InviteWithBuilder,
  type Request,
  type RequestInvite,
  type RequestStatus,
  type TerminalRequestStatus,
} from "../domain/request.ts";
import { ulid } from "../lib/ulid.ts";
import { jsonList } from "./builders.ts";

type Row = {
  id: string;
  client_user_id: string;
  client_name: string;
  title: string;
  description: string;
  category: Category;
  budget_band: BudgetBand;
  deadline: string | null;
  languages: string;
  status: RequestStatus;
  locale: string;
  admin_note: string | null;
  selected_invite_id: string | null;
  submitted_at: string | null;
  matched_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toRequest(r: Row): Request {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    clientName: r.client_name,
    title: r.title,
    description: r.description,
    category: r.category,
    budgetBand: r.budget_band,
    deadline: r.deadline,
    languages: jsonList(r.languages).filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l)),
    status: r.status,
    locale: r.locale,
    adminNote: r.admin_note,
    selectedInviteId: r.selected_invite_id,
    submittedAt: r.submitted_at,
    matchedAt: r.matched_at,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type InviteRow = {
  id: string;
  request_id: string;
  builder_id: string;
  invited_by: string;
  status: InviteStatus;
  approach: string | null;
  price_cents: number | null;
  price_max_cents: number | null;
  price_note: string | null;
  timeline_days: number | null;
  decline_reason: string | null;
  invited_at: string;
  responded_at: string | null;
  reminded_at: string | null;
  inquiry_id: string | null;
  created_at: string;
  updated_at: string;
};

export function toInvite(r: InviteRow): RequestInvite {
  return {
    id: r.id,
    requestId: r.request_id,
    builderId: r.builder_id,
    invitedBy: r.invited_by,
    status: r.status,
    approach: r.approach,
    priceCents: r.price_cents,
    priceMaxCents: r.price_max_cents,
    priceNote: r.price_note,
    timelineDays: r.timeline_days,
    declineReason: r.decline_reason,
    invitedAt: r.invited_at,
    respondedAt: r.responded_at,
    remindedAt: r.reminded_at,
    inquiryId: r.inquiry_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** "This batch's compare-and-set on the request went through": statements batched after it check this. */
export type RequestGuard = { requestId: string; status: RequestStatus; updatedAt: string };
/** Same for an invitation. */
export type InviteGuard = { inviteId: string; status: InviteStatus; updatedAt: string };

export type NewRequest = {
  clientUserId: string;
  clientName: string;
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  status: "submitted" | "pending_verification";
  locale: string;
  now: string;
};

export async function createRequest(db: D1Database, input: NewRequest): Promise<Request> {
  const row = await db
    .prepare(
      `INSERT INTO requests (id, client_user_id, client_name, title, description, category, budget_band, deadline, languages, status, locale,
         submitted_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CASE WHEN ?10 = 'submitted' THEN ?12 END, ?12, ?12)
       RETURNING *`,
    )
    .bind(ulid(Date.parse(input.now)), input.clientUserId, input.clientName, input.title, input.description, input.category, input.budgetBand, input.deadline, JSON.stringify(input.languages), input.status, input.locale, input.now)
    .first<Row>();
  if (!row) throw new Error("request insert failed");
  return toRequest(row);
}

export async function findRequestById(db: D1Database, id: string): Promise<Request | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1").bind(id).first<Row>();
  return row ? toRequest(row) : null;
}

// Spec §5.4: the client never sees a request the admin removed as spam.
export async function findClientRequest(db: D1Database, clientUserId: string, id: string): Promise<Request | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1 AND client_user_id = ?2 AND status != 'removed'").bind(id, clientUserId).first<Row>();
  return row ? toRequest(row) : null;
}

/** Most recently changed first. */
export async function listClientRequests(db: D1Database, clientUserId: string, limit = 200): Promise<Request[]> {
  const { results } = await db
    .prepare("SELECT * FROM requests WHERE client_user_id = ?1 AND status != 'removed' ORDER BY updated_at DESC, id DESC LIMIT ?2")
    .bind(clientUserId, limit)
    .all<Row>();
  return results.map(toRequest);
}

/** The request with its client's e-mail and locale, used only as a recipient (notifications) or on admin pages. */
export async function findRequestWithClient(db: D1Database, id: string): Promise<{ request: Request; client: { email: string; locale: string } } | null> {
  const row = await db
    .prepare("SELECT r.*, u.email AS client_email, u.locale AS client_locale FROM requests r JOIN users u ON u.id = r.client_user_id WHERE r.id = ?1")
    .bind(id)
    .first<Row & { client_email: string; client_locale: string }>();
  return row ? { request: toRequest(row), client: { email: row.client_email, locale: row.client_locale } } : null;
}

const TERMINAL_SQL = "('builder_selected', 'rejected', 'expired', 'closed', 'removed')";

/**
 * Compare-and-set on status, as a statement for db.batch. Stamps submitted_at, matched_at (first time only) and
 * closed_at (terminal) from the new status. Returns the row, or nothing when the status was no longer `from`.
 */
export function setRequestStatusStatement(
  db: D1Database,
  input: { id: string; from: RequestStatus; to: RequestStatus; now: string; adminNote?: string | null; selectedInviteId?: string | null },
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE requests SET status = ?3, updated_at = ?4,
         submitted_at = CASE WHEN ?3 = 'submitted' THEN COALESCE(submitted_at, ?4) ELSE submitted_at END,
         matched_at = CASE WHEN ?3 = 'matching' THEN COALESCE(matched_at, ?4) ELSE matched_at END,
         closed_at = CASE WHEN ?3 IN ${TERMINAL_SQL} THEN ?4 ELSE closed_at END,
         admin_note = COALESCE(?5, admin_note),
         selected_invite_id = COALESCE(?6, selected_invite_id)
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.now, input.adminNote ?? null, input.selectedInviteId ?? null);
}

/** The request a batched compare-and-set returned, or null when it lost. */
export function returnedRequest(result: D1Result | undefined): Request | null {
  const row = result?.results[0] as Row | undefined;
  return row ? toRequest(row) : null;
}

/**
 * Spec §7.5: a request entering a terminal status settles its invitations in the same transaction: invited -> expired,
 * proposed -> not_selected. `between` runs right after the compare-and-set (selecting a proposal marks it selected
 * there, so it is not swept to not_selected). Every settling statement checks that this batch's compare-and-set won.
 * Callers append their audit statement after `statements`.
 */
export function endRequestBatch(
  db: D1Database,
  input: { id: string; from: RequestStatus; to: TerminalRequestStatus; now: string; adminNote?: string | null; selectedInviteId?: string | null },
  between: D1PreparedStatement[] = [],
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: Request | null; notSelected: string[] } } {
  const won = "EXISTS (SELECT 1 FROM requests WHERE id = ?1 AND status = ?2 AND updated_at = ?3)";
  const statements = [
    setRequestStatusStatement(db, input),
    ...between,
    db.prepare(`UPDATE request_invites SET status = 'expired', updated_at = ?3 WHERE request_id = ?1 AND status = 'invited' AND ${won}`).bind(input.id, input.to, input.now),
    db.prepare(`UPDATE request_invites SET status = 'not_selected', updated_at = ?3 WHERE request_id = ?1 AND status = 'proposed' AND ${won} RETURNING id`).bind(input.id, input.to, input.now),
  ];
  const notSelectedAt = 1 + between.length + 1;
  return {
    statements,
    read: (results) => ({
      request: returnedRequest(results[0]),
      notSelected: ((results[notSelectedAt]?.results ?? []) as { id: string }[]).map((r) => r.id),
    }),
  };
}

/**
 * Spec §5.7 step 2 / §7.6: invites each builder unless already invited, the builder is the client, the builder is not
 * approved on an active account, the request is not submitted/matching, or 5 invitations are already active. The cap
 * is checked inside each INSERT, so concurrent admins cannot pass it. Then the request moves to matching, only if this
 * batch invited someone (matched_at keeps the first invitation's time).
 */
export function inviteBuildersBatch(
  db: D1Database,
  input: { requestId: string; builderIds: string[]; invitedBy: string; now: string },
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: Request | null; invited: { id: string; builderId: string }[] } } {
  const at = Date.parse(input.now);
  const inserts = input.builderIds.map((builderId) =>
    db
      .prepare(
        `INSERT INTO request_invites (id, request_id, builder_id, invited_by, status, invited_at, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, 'invited', ?5, ?5, ?5
         WHERE EXISTS (SELECT 1 FROM requests r WHERE r.id = ?2 AND r.status IN ('submitted', 'matching') AND r.client_user_id != ?3)
           AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = ?3 AND b.status = 'approved' AND u.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM request_invites x WHERE x.request_id = ?2 AND x.builder_id = ?3)
           AND (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = ?2 AND x.status IN ('invited', 'proposed')) < ?6
         RETURNING id, builder_id`,
      )
      .bind(ulid(at), input.requestId, builderId, input.invitedBy, input.now, MAX_ACTIVE_INVITES),
  );
  const move = db
    .prepare(
      `UPDATE requests SET status = 'matching', matched_at = COALESCE(matched_at, ?2), updated_at = ?2
       WHERE id = ?1 AND status IN ('submitted', 'matching') AND EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?1 AND invited_at = ?2)
       RETURNING *`,
    )
    .bind(input.requestId, input.now);
  return {
    statements: [...inserts, move],
    read: (results) => ({
      request: returnedRequest(results[inserts.length]),
      invited: results.slice(0, inserts.length).flatMap((r) => ((r?.results ?? []) as { id: string; builder_id: string }[]).map((x) => ({ id: x.id, builderId: x.builder_id }))),
    }),
  };
}

type InviteBuilderRow = InviteRow & { builder_name: string; builder_handle: string; builder_public: number };

/** Every invitation of a request with the builder's public name, oldest first. */
export async function listRequestInvites(db: D1Database, requestId: string): Promise<InviteWithBuilder[]> {
  const { results } = await db
    .prepare(
      `SELECT x.*, b.name AS builder_name, b.handle AS builder_handle, (b.status = 'approved' AND u.status = 'active') AS builder_public
       FROM request_invites x JOIN builders b ON b.user_id = x.builder_id JOIN users u ON u.id = b.user_id
       WHERE x.request_id = ?1 ORDER BY x.invited_at, x.id`,
    )
    .bind(requestId)
    .all<InviteBuilderRow>();
  return results.map((r) => ({ invite: toInvite(r), builderName: r.builder_name, builderHandle: r.builder_handle, builderPublic: r.builder_public === 1 }));
}

/** Removes an unconfirmed request (its confirmation e-mail failed); never touches a confirmed one. */
export function deletePendingRequestStatement(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare("DELETE FROM requests WHERE id = ?1 AND status = 'pending_verification'").bind(id);
}
```

(Task 1 import `WORK_LANGUAGES, type WorkLanguage` từ `domain/builder.ts`; Task 4 thêm `type Availability` khi viết `listCandidates`.)

Trong `apps/web/src/db/users.ts`, `deleteGhostUsers`: sửa doc comment (bỏ "M6 must add `requests`…", ghi "and no request") và thêm một dòng:

```sql
         AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.client_user_id = users.id)
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts test/architecture.test.ts test/db/inquiries.test.ts` → PASS.

- [ ] **Step 9: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/migrations/0008_requests.sql apps/web/src/domain/request.ts apps/web/src/domain/inquiry.ts apps/web/src/db/requests.ts apps/web/src/db/inquiries.ts apps/web/src/db/audit.ts apps/web/src/db/users.ts apps/web/src/db/builders.ts apps/web/wrangler.jsonc apps/web/test/architecture.test.ts apps/web/test/fixtures.ts apps/web/test/domain/request.test.ts apps/web/test/db/requests.test.ts
git commit -m "feat(web): request data, state machines and suggestion scoring (VNX-0601)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
