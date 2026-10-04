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
- **Tên kiểu:** bản ghi request trong code là `ClientRequest` (không phải `Request`), để không che kiểu `Request` toàn cục của Fetch API trong file nào import nó. Bảng, route, hàm vẫn dùng chữ `request`.

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
  - `domain/request.ts`: hằng `REQUEST_STATUSES`, `TERMINAL_REQUEST_STATUSES`, `INVITE_STATUSES`, `ACTIVE_INVITE_STATUSES`, `PRICE_MODES`, `TITLE_MAX = 120`, `DESCRIPTION_MIN = 40`, `DESCRIPTION_MAX = 4000`, `APPROACH_MAX = 2000`, `PRICE_NOTE_MAX = 200`, `PRICE_MAX_USD = 1_000_000`, `TIMELINE_MAX_DAYS = 365`, `ADMIN_NOTE_MAX = 1000`, `MAX_ACTIVE_INVITES = 5`, `SUGGESTION_LIMIT = 10`, `SKILL_POINTS_MAX = 3`, `REQUEST_DAILY_LIMIT_PER_EMAIL = 3`, `REQUEST_HOURLY_LIMIT_PER_IP = 10`, `INVITE_REMIND_AFTER_MS`, `INVITE_TTL_MS`, `MATCHING_TTL_MS`, `EXPIRED_PENALTY_WINDOW_MS`; type `RequestStatus`, `TerminalRequestStatus`, `InviteStatus`, `PriceMode`, `ClientRequest`, `RequestInvite`, `InviteWithBuilder`, `AdminRequest`, `InvitationListItem`, `Invitation`, `RequestAction`, `RequestActor`, `InviteAction`, `InviteActor`, `RequestFormValues`, `RequestInput`, `RequestErrors`, `RequestFieldError`, `ProposalFormValues`, `ProposalInput`, `ProposalErrors`, `ProposalFieldError`, `Candidate`, `SuggestionReason`, `Suggestion`; hàm `requestTransition`, `inviteTransition`, `isTerminalRequest`, `requestValuesFromBody`, `isRequestHoneypotFilled`, `parseRequestForm`, `proposalValuesFromBody`, `parseProposal`, `parseAdminNote`, `suggestBuilders`.
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

export interface ClientRequest {
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
  request: ClientRequest;
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
  request: ClientRequest;
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
export function suggestBuilders(request: Pick<ClientRequest, "title" | "description" | "languages">, candidates: readonly Candidate[], limit = SUGGESTION_LIMIT): Suggestion[] {
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

Thêm fixture vào `apps/web/test/fixtures.ts` (import `createRequest`, `inviteBuildersBatch`, `findRequestById`, `listRequestInvites` từ `../src/db/requests.ts`; `ClientRequest`, `RequestInvite`, `RequestStatus` từ `../src/domain/request.ts`; `Category` từ `../src/domain/product.ts`; `WorkLanguage` từ `../src/domain/builder.ts`):

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
}): Promise<{ client: UserRow; request: ClientRequest }> {
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
export async function inviteBuilders(request: ClientRequest, builders: Builder[], now = new Date().toISOString()): Promise<RequestInvite[]> {
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
  type ClientRequest,
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

export function toRequest(r: Row): ClientRequest {
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

export async function createRequest(db: D1Database, input: NewRequest): Promise<ClientRequest> {
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

export async function findRequestById(db: D1Database, id: string): Promise<ClientRequest | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1").bind(id).first<Row>();
  return row ? toRequest(row) : null;
}

// Spec §5.4: the client never sees a request the admin removed as spam.
export async function findClientRequest(db: D1Database, clientUserId: string, id: string): Promise<ClientRequest | null> {
  const row = await db.prepare("SELECT * FROM requests WHERE id = ?1 AND client_user_id = ?2 AND status != 'removed'").bind(id, clientUserId).first<Row>();
  return row ? toRequest(row) : null;
}

/** Most recently changed first. */
export async function listClientRequests(db: D1Database, clientUserId: string, limit = 200): Promise<ClientRequest[]> {
  const { results } = await db
    .prepare("SELECT * FROM requests WHERE client_user_id = ?1 AND status != 'removed' ORDER BY updated_at DESC, id DESC LIMIT ?2")
    .bind(clientUserId, limit)
    .all<Row>();
  return results.map(toRequest);
}

/** The request with its client's e-mail and locale, used only as a recipient (notifications) or on admin pages. */
export async function findRequestWithClient(db: D1Database, id: string): Promise<{ request: ClientRequest; client: { email: string; locale: string } } | null> {
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
export function returnedRequest(result: D1Result | undefined): ClientRequest | null {
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
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: ClientRequest | null; notSelected: string[] } } {
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
): { statements: D1PreparedStatement[]; read: (results: D1Result[]) => { request: ClientRequest | null; invited: { id: string; builderId: string }[] } } {
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

### Task 2: VNX-0602a — Email request, `notify/request.ts`, `request_verify`, `openPendingRequest`

**Quyết định kỹ thuật (Reviewer duyệt cùng section):**
- **Chín mẫu email:** xác nhận request (client), mời (builder), nhắc lời mời (builder), lời mời đã kết thúc (builder), đề xuất mới (client), không được chọn (builder), trả về (client), request hết hạn (client), báo admin (tiếng Anh). "Được chọn" không có mẫu riêng: là tin nhắn đầu của Inquiry nên đi qua `notifyInquiryMessage` (Task 6 gọi). Mẫu thứ chín (lời mời đã kết thúc, gửi builder khi lời mời chuyển `expired`) đã được Owner xác nhận (2026-10-04).
- **Che tên giống email (Owner 2026-10-04):** `builderFacingName(name)` (`domain/inquiry.ts`, thuần) thay mỗi đoạn giống email (không ăn dấu ngoặc, phẩy, chấm phẩy kề bên), khớp `/[^\s@()<>,;]+@[^\s@()<>,;]+\.[^\s@()<>,;]+/g` (có `@` và phần sau có dấu chấm), bằng `•••` (ba dấu chấm tròn, không phụ thuộc locale); tên không có đoạn như vậy giữ nguyên (ví dụ `Minh Tran` giữ, `a@b.co` thành `•••`, `Lan (lan@x.vn)` thành `Lan (•••)`). Hai mẫu gửi builder có tên client (`requestInviteEmail`, `requestReminderEmail`) nhận kiểu `BuilderFacingName` (thương hiệu), nên chỉ có thể nhận kết quả của helper; `notify/request.ts` gọi helper. Thư báo admin không che (admin được thấy email, spec 5.5). **Phạm vi:** Task 2 chỉ che email request; các bề mặt Inquiry của M5 (hộp thư Hub, `notifyInquiryMessage` gửi builder) chưa che. **Task 6 phải áp `builderFacingName` ở đó** (view Hub của Inquiry và email `newInquiryEmail`/`inquiryMessageEmail`/`inquiryReminderEmail` tới builder), vì từ Task 6 một request trở thành Inquiry và `inquiries.client_name` được chép từ `requests.client_name`; Task 3–5 cũng phải dùng helper ở mọi view Hub / Invitations hiển thị tên client.
- **Hàm `notify*` tự nạp dữ liệu từ id** (không nhận email / nội dung từ route): người gọi không có đường nào đưa email client vào thư của builder. Mỗi hàm kiểm trạng thái hiện tại rồi mới gửi (`skipped` nếu đã đổi), không bao giờ ném lỗi, lỗi chỉ ghi log `request.notify_failed` (không ghi địa chỉ). Không có cột đánh dấu đã gửi (plan header): người gọi chỉ gọi sau khi thắng compare-and-set.
- **Trả về:** hàm gửi một thư trả `"sent" | "failed" | "skipped"`; hàm gửi nhiều thư (mời, hết hạn, không được chọn, báo admin) trả `{ sent, failed }`. Admin Task 4 hiện `?done=mail_failed` khi `failed > 0`.
- **Locale:** thư tới client và builder theo `users.locale` của người nhận (spec 8.3), thư báo admin luôn tiếng Anh (như `inquiryAdminAlertEmail`). Link admin không có tiền tố locale.
- **Thư xác nhận không đi qua `notify/request.ts`:** như M5 (`inquiryConfirmEmail` do route gửi, vì lỗi phải hiện ra trên form). Task 3 gọi `requestConfirmEmail(locale, { title, link })` và tự tạo token `request_verify` với `requestId`.
- **Tách phần dựng HTML dùng chung** (`p`, `link`, `quote`, `wrap`) từ `email/templates/inquiry.ts` sang `email/parts.ts` để request không chép lại. Hành vi thư M5 không đổi (test M5 giữ nguyên là bằng chứng). `BUDGET_KEY` của `inquiry.ts` được `export` để dùng lại.
- **`openPendingRequest`** (cùng khuôn `openPendingInquiry`): compare-and-set `pending_verification → submitted` (luật `verify` của state machine, actor `system`) cùng audit `request.verify` có điều kiện trong một `db.batch`; mất compare-and-set thì không ghi, không gửi gì. Thắng thì đặt `display_name` nếu trống rồi `notifyRequestSubmitted` (báo admin). `via` là `"link"` (email) hoặc `"me"` (Task 3, nút "Gửi ngay").
- **`/auth/verify`:** `VERIFY_PURPOSES` thêm `request_verify`; trang trung gian có chữ riêng; xác nhận xong về `/me/requests/:id` (trang do Task 3 tạo), request không còn chờ / không thuộc user / đã `removed` thì về `/me`. Token chỉ có tác dụng với request của chính email trong token (`request.clientUserId === user.id`). Trang link hỏng có gợi ý riêng cho request (nhãn lấy từ `tr("nav.me")` và `tr("me.sendNow")` qua `{place}` / `{button}`, không chép chữ cứng). **Ghi nhận:** `inquiryHint` của M5 vẫn là chữ cứng, sẽ lạc hậu nếu Task 3 đổi tên `nav.me`.

**Files:**
- Create: `apps/web/src/email/parts.ts`, `apps/web/src/email/templates/request.ts`, `apps/web/src/notify/request.ts`, `apps/web/src/routes/request-confirm.ts`
- Modify: `apps/web/src/db/requests.ts` (`endRequestBatch` trả thêm `expired`), `apps/web/test/db/requests.test.ts` (3 assertion + 1 assertion mới), `apps/web/src/domain/inquiry.ts` (`builderFacingName`, `BuilderFacingName`), `apps/web/src/email/templates/inquiry.ts` (dùng `parts.ts`, `export BUDGET_KEY`), `apps/web/src/db/requests.ts` (`InviteContext`, `findInviteContext`), `apps/web/src/routes/auth.tsx`, `apps/web/src/views/auth.tsx`, 4 file `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/domain/inquiry.test.ts` (thêm), `apps/web/test/email/request-templates.test.ts`, `apps/web/test/notify/request.test.ts`, `apps/web/test/auth/request-verify.test.ts`

**Interfaces:**
- Consumes: `ClientRequest`, `RequestInvite`, `INVITE_TTL_MS`, `MATCHING_TTL_MS` (`domain/request.ts`); `findRequestWithClient`, `setRequestStatusStatement`, `returnedRequest`, `toInvite`, `toRequest`, `InviteRow`, `findRequestById` (`db/requests.ts`); `auditStatement` (`db/audit.ts`); `setDisplayNameIfEmpty` (`db/users.ts`); `createLoginToken`, `peekLoginToken`, `consumeLoginToken`, `describeToken`, `TokenPurpose` đã có `request_verify` (`auth/tokens.ts`); `adminEmails` (`auth/admin.ts`); `getMailer`; `localizedPath`, `isLocale`; `BUDGET_KEY`; fixtures `makeRequest`, `inviteBuilders`, `proposeOn`, `makeBuilder`, `ensureUser`, `signIn`, `formPost`, `getReq`.
- Produces:
  - `domain/inquiry.ts`: `type BuilderFacingName` (nhãn thương hiệu `string & { readonly __brand: "BuilderFacingName" }`), `builderFacingName(name: string): BuilderFacingName`. Mẫu nhận `clientName: BuilderFacingName` (`import type`, giữ ranh giới ARCHITECTURE §2: `email/` chỉ import kiểu của domain); `notify/request.ts` gọi helper. `notify/request.ts` import `auth/admin.ts` theo tiền lệ `jobs/daily.ts`.
  - `email/templates/request.ts`: `CATEGORY_KEY`, `requestConfirmEmail(locale, { title, link })`, `requestInviteEmail(locale, { clientName, title, category, budgetBand, deadline, days, url })`, `requestReminderEmail(locale, { clientName, title, days, url })`, `requestInviteExpiredEmail(locale, { title, url })`, `requestProposalEmail(locale, { builderName, title, priceCents, priceMaxCents, timelineDays, url })`, `requestNotSelectedEmail(locale, { title, url })`, `requestRejectedEmail(locale, { title, reason, url })`, `requestExpiredEmail(locale, { title, days, url })`, `requestAdminNewEmail({ title, category, budgetBand, languages, clientName }, url)`; mỗi hàm trả `{ subject, text, html }`.
  - `db/requests.ts`: `InviteContext = { invite: RequestInvite; request: ClientRequest; builder: { email; locale; name; handle }; client: { email; locale } }`, `findInviteContext(db, inviteId): Promise<InviteContext | null>`.
  - `notify/request.ts` (không hàm nào ném lỗi; không hàm nào ghi DB):
    - `type NotifyOutcome = "sent" | "failed" | "skipped"`, `type NotifyTally = { sent: number; failed: number }`
    - `notifyRequestSubmitted(env, requestId): Promise<NotifyTally>`: báo mọi `ADMIN_EMAILS`. Task 2 (`openPendingRequest`) và Task 3 (đăng khi đã đăng nhập) gọi.
    - `notifyInvited(env, inviteIds: string[]): Promise<NotifyTally>`: Task 4, id từ `outcome.invited`.
    - `notifyInviteReminder(env, inviteId): Promise<NotifyOutcome>`: Task 7 (cron tự đánh dấu `reminded_at`).
    - `notifyInviteExpired(env, inviteIds: string[]): Promise<NotifyTally>`: Task 3 (client đóng), Task 4 (spam), Task 6 (chọn / đóng), Task 7 (lời mời hết hạn, request hết hạn, khóa builder / user); id từ `endRequestBatch(...).read(...).expired` hoặc từ cron.
    - `notifyProposal(env, inviteId): Promise<NotifyOutcome>`: Task 5, sau khi `propose` thắng.
    - `notifyNotSelected(env, inviteIds: string[]): Promise<NotifyTally>`: Task 4 (trả về, spam), Task 6 (chọn / đóng), Task 7 (hết hạn), id từ `endRequestBatch(...).read(...).notSelected`.
    - `notifyRequestRejected(env, requestId): Promise<NotifyOutcome>`: Task 4. `notifyRequestExpired(env, requestId): Promise<NotifyOutcome>`: Task 7.
    - URL: `invitationUrl(env, locale, inviteId)` (`/hub/invitations/:id`), `invitationsUrl(env, locale)`, `clientRequestUrl(env, locale, requestId)` (`/me/requests/:id`), `newRequestUrl(env, locale)` (`/request`), `adminRequestUrl(env, requestId)` (`/admin/requests/:id`).
  - `routes/request-confirm.ts`: `openPendingRequest(c, request: ClientRequest, user: { id: string }, now: Date, via: "link" | "me"): Promise<boolean>`.
  - `views/auth.tsx`: `ConfirmLinkPage` nhận `purpose: "login" | "inquiry" | "request"`; `InvalidLinkPage` nhận `hint?: "inquiry" | "request"` (thay `inquiryHint?: boolean`).

**i18n: 34 key mới** (chèn khối `email.request*` ngay sau dòng `email.inquiryReminder.cta`, khối `auth.confirm.request.*` ngay sau `auth.confirm.inquiry.submit`, `auth.invalidLink.requestHint` ngay sau `auth.invalidLink.inquiryHint`). `{price}`, `{from}`, `{to}` đã được định dạng theo locale (số nguyên, en/zh dấu phẩy, vi dấu chấm); `{days}` là số ngày.

| Key | en | vi | zh-Hans | zh-Hant |
|---|---|---|---|---|
| `email.requestConfirm.subject` | Confirm your request on VNX.SI | Xác nhận nhu cầu của bạn trên VNX.SI | 请确认你在 VNX.SI 上的需求 | 請確認你在 VNX.SI 上的需求 |
| `email.requestConfirm.body` | You posted the request “{title}”. Click the link below to confirm your e-mail and send it to our team. The link works once and expires in 15 minutes. | Bạn đã đăng nhu cầu “{title}”. Bấm link bên dưới để xác nhận email và gửi cho đội ngũ của chúng tôi. Link dùng được một lần và hết hạn sau 15 phút. | 你发布了需求“{title}”。点击下方链接确认邮箱，并将其发送给我们的团队。链接只能使用一次，15 分钟后失效。 | 你發布了需求「{title}」。點擊下方連結確認電子郵件，並將其送給我們的團隊。連結只能使用一次，15 分鐘後失效。 |
| `email.requestConfirm.ignore` | If you didn't post this, ignore this e-mail and nothing will be sent. | Nếu bạn không đăng nhu cầu này, hãy bỏ qua email; sẽ không có gì được gửi đi. | 如果这不是你发布的，请忽略此邮件，需求不会被发送。 | 如果這不是你發布的，請忽略此郵件，需求不會被送出。 |
| `email.requestInvite.subject` | You're invited to a request: {title} | Bạn được mời vào một nhu cầu: {title} | 你被邀请参与需求：{title} | 你被邀請參與需求：{title} |
| `email.requestInvite.intro` | Our team invites you to respond to a request from {client}: “{title}”. | Đội ngũ của chúng tôi mời bạn phản hồi nhu cầu của {client}: “{title}”. | 我们的团队邀请你回应 {client} 的需求：“{title}”。 | 我們的團隊邀請你回應 {client} 的需求：「{title}」。 |
| `email.requestInvite.category` | Category: {category} | Danh mục: {category} | 类别：{category} | 類別：{category} |
| `email.requestInvite.cta` | Read the request, then send a proposal or decline. The invitation expires {days} days after it was sent: | Đọc nhu cầu, rồi gửi đề xuất hoặc từ chối. Lời mời hết hạn sau {days} ngày kể từ khi gửi: | 请先阅读需求，再发送方案或婉拒。邀请自发送起 {days} 天后失效： | 請先閱讀需求，再送出方案或婉拒。邀請自送出起 {days} 天後失效： |
| `email.requestReminder.subject` | Reminder: respond to “{title}” | Nhắc: hãy phản hồi “{title}” | 提醒：请回应“{title}” | 提醒：請回應「{title}」 |
| `email.requestReminder.body` | You were invited to {client}'s request “{title}” three days ago and haven't responded yet. The invitation expires {days} days after it was sent. | Bạn được mời vào nhu cầu “{title}” của {client} từ ba ngày trước và chưa phản hồi. Lời mời hết hạn sau {days} ngày kể từ khi gửi. | 三天前你被邀请参与 {client} 的需求“{title}”，目前还没有回应。邀请自发送起 {days} 天后失效。 | 三天前你被邀請參與 {client} 的需求「{title}」，目前還沒有回應。邀請自送出起 {days} 天後失效。 |
| `email.requestReminder.cta` | Respond on VNX.SI: | Phản hồi trên VNX.SI: | 在 VNX.SI 上回应： | 在 VNX.SI 上回應： |
| `email.requestInviteExpired.subject` | Invitation ended: {title} | Lời mời đã kết thúc: {title} | 邀请已结束：{title} | 邀請已結束：{title} |
| `email.requestInviteExpired.body` | Your invitation to the request “{title}” has ended, so you can no longer send a proposal for it. | Lời mời vào nhu cầu “{title}” của bạn đã kết thúc, nên bạn không thể gửi đề xuất cho nhu cầu này nữa. | 你对需求“{title}”的邀请已结束，无法再为其发送方案。 | 你對需求「{title}」的邀請已結束，無法再為其送出方案。 |
| `email.requestInviteExpired.cta` | See your invitations on VNX.SI: | Xem các lời mời của bạn trên VNX.SI: | 在 VNX.SI 上查看你的邀请： | 在 VNX.SI 上查看你的邀請： |
| `email.requestProposal.subject` | New proposal from {builder} | Đề xuất mới từ {builder} | {builder} 发来新方案 | {builder} 送來新方案 |
| `email.requestProposal.intro` | {builder} sent a proposal for your request “{title}”. | {builder} đã gửi đề xuất cho nhu cầu “{title}” của bạn. | {builder} 为你的需求“{title}”发送了方案。 | {builder} 為你的需求「{title}」送出了方案。 |
| `email.requestProposal.priceFixed` | Price: ${price} | Giá: ${price} | 价格：${price} | 價格：${price} |
| `email.requestProposal.priceRange` | Price: ${from} – ${to} | Giá: ${from} – ${to} | 价格：${from} – ${to} | 價格：${from} – ${to} |
| `email.requestProposal.priceDiscuss` | Price: to be discussed | Giá: cần trao đổi thêm | 价格：需进一步沟通 | 價格：需進一步溝通 |
| `email.requestProposal.timeline` | Estimated time: {days} days | Thời gian dự kiến: {days} ngày | 预计时间：{days} 天 | 預計時間：{days} 天 |
| `email.requestProposal.cta` | See the proposal and choose a builder on VNX.SI: | Xem đề xuất và chọn builder trên VNX.SI: | 在 VNX.SI 上查看方案并选择开发者： | 在 VNX.SI 上查看方案並選擇開發者： |
| `email.requestNotSelected.subject` | Update on your proposal: {title} | Cập nhật về đề xuất của bạn: {title} | 你的方案有新进展：{title} | 你的方案有新進展：{title} |
| `email.requestNotSelected.body` | Your proposal for the request “{title}” was not selected, and the request has ended. Thank you for taking the time to respond. | Đề xuất của bạn cho nhu cầu “{title}” không được chọn và nhu cầu đã kết thúc. Cảm ơn bạn đã dành thời gian phản hồi. | 你为需求“{title}”提交的方案未被选中，该需求已结束。感谢你抽出时间回应。 | 你為需求「{title}」提交的方案未被選中，該需求已結束。感謝你抽出時間回應。 |
| `email.requestNotSelected.cta` | See your invitations on VNX.SI: | Xem các lời mời của bạn trên VNX.SI: | 在 VNX.SI 上查看你的邀请： | 在 VNX.SI 上查看你的邀請： |
| `email.requestRejected.subject` | Your request was returned: {title} | Nhu cầu của bạn đã được trả về: {title} | 你的需求已被退回：{title} | 你的需求已被退回：{title} |
| `email.requestRejected.intro` | Our team returned your request “{title}” without inviting builders. | Đội ngũ của chúng tôi đã trả về nhu cầu “{title}” của bạn và chưa mời builder nào. | 我们的团队已退回你的需求“{title}”，尚未邀请任何开发者。 | 我們的團隊已退回你的需求「{title}」，尚未邀請任何開發者。 |
| `email.requestRejected.reason` | Note from our team: | Ghi chú từ đội ngũ: | 团队的说明： | 團隊的說明： |
| `email.requestRejected.cta` | You can post a new request: | Bạn có thể đăng một nhu cầu mới: | 你可以发布新的需求： | 你可以發布新的需求： |
| `email.requestExpired.subject` | Your request has expired: {title} | Nhu cầu của bạn đã hết hạn: {title} | 你的需求已过期：{title} | 你的需求已過期：{title} |
| `email.requestExpired.body` | Your request “{title}” stayed open for {days} days without a builder being selected, so it has ended. | Nhu cầu “{title}” của bạn đã mở {days} ngày mà chưa chọn được builder nào, nên đã kết thúc. | 你的需求“{title}”开放了 {days} 天，仍未选定开发者，因此已结束。 | 你的需求「{title}」開放了 {days} 天，仍未選定開發者，因此已結束。 |
| `email.requestExpired.cta` | You can post it again: | Bạn có thể đăng lại: | 你可以重新发布： | 你可以重新發布： |
| `auth.confirm.request.title` | Confirm your request | Xác nhận nhu cầu | 确认你的需求 | 確認你的需求 |
| `auth.confirm.request.body` | Press the button to confirm your e-mail and send your request to our team. | Bấm nút bên dưới để xác nhận email và gửi nhu cầu cho đội ngũ của chúng tôi. | 点击下方按钮确认邮箱，并把需求发送给我们的团队。 | 點擊下方按鈕確認電子郵件，並把需求送給我們的團隊。 |
| `auth.confirm.request.submit` | Confirm and send | Xác nhận và gửi | 确认并发送 | 確認並送出 |
| `auth.invalidLink.requestHint` | If you were confirming a request: sign in, open {place} and press {button}. | Nếu bạn đang xác nhận một nhu cầu: hãy đăng nhập, mở {place} và bấm {button}. | 如果你正在确认一条需求：请登录，打开“{place}”并点击“{button}”。 | 如果你正在確認一則需求：請登入，打開「{place}」並點擊「{button}」。 |

- [ ] **Step 1: Test helper che tên và mẫu email (fail)**

Thêm vào `apps/web/test/domain/inquiry.test.ts` (import thêm `builderFacingName` từ `../../src/domain/inquiry.ts`):

```ts
describe("builderFacingName (Owner 2026-10-04)", () => {
  it("keeps ordinary names unchanged", () => {
    for (const name of ["Minh Tran", "Công ty ABC", "李雷", "Tom @ Acme", "a@b", "v1.2 team"]) expect(builderFacingName(name)).toBe(name);
  });
  it("masks every e-mail-like part and nothing else", () => {
    expect(builderFacingName("minh@client.example")).toBe("•••");
    expect(builderFacingName("Lan (lan@x.vn)")).toBe("Lan (•••)");
    expect(builderFacingName("a@b.co / c@d.io")).toBe("••• / •••");
    expect(builderFacingName("Minh.Tran+x@sub.client.example, CEO")).toBe("•••, CEO");
  });
});
```


`apps/web/test/email/request-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CATEGORY_KEY,
  requestAdminNewEmail,
  requestConfirmEmail,
  requestExpiredEmail,
  requestInviteEmail,
  requestInviteExpiredEmail,
  requestNotSelectedEmail,
  requestProposalEmail,
  requestRejectedEmail,
  requestReminderEmail,
} from "../../src/email/templates/request.ts";
import { builderFacingName } from "../../src/domain/inquiry.ts";
import { CATEGORY_KEY as VIEW_CATEGORY_KEY } from "../../src/views/labels.ts";

const url = "https://vnx.si/x";

describe("request e-mail templates (spec §8.3)", () => {
  it("asks the client to confirm, in their locale", () => {
    const mail = requestConfirmEmail("vi", { title: "Booking app", link: "https://vnx.si/auth/verify?t=abc" });
    expect(mail.subject).toBe("Xác nhận nhu cầu của bạn trên VNX.SI");
    expect(mail.text).toContain("“Booking app”");
    expect(mail.text).toContain("https://vnx.si/auth/verify?t=abc");
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc"');
  });

  it("invites a builder with the typed client name, category, budget, deadline and expiry window", () => {
    const mail = requestInviteEmail("en", { clientName: builderFacingName("Minh Tran"), title: "Booking app", category: "booking", budgetBand: "2k-10k", deadline: "2026-12-01", days: 7, url });
    expect(mail.subject).toBe("You're invited to a request: Booking app");
    for (const text of ["from Minh Tran: “Booking app”", "Category: Booking", "Budget: $2,000 – $10,000", "Deadline: 2026-12-01", "7 days after it was sent", url]) {
      expect(mail.text, text).toContain(text);
    }
    expect(requestInviteEmail("en", { clientName: builderFacingName("M"), title: "T", category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }).text).not.toContain("Deadline");
  });

  it("never shows a client name that is an e-mail address to the builder", () => {
    const email = "minh.client@example.com";
    const mails = [
      requestInviteEmail("en", { clientName: builderFacingName(email), title: "T", category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }),
      requestReminderEmail("vi", { clientName: builderFacingName(`Minh (${email})`), title: "T", days: 7, url }),
    ];
    for (const mail of mails) {
      expect(mail.text + mail.html + mail.subject).not.toContain(email);
      expect(mail.text).toContain("•••");
    }
  });

  it("shows a fixed price, a range and 'to be discussed', with the timeline", () => {
    const base = { builderName: "Lan", title: "Booking app", timelineDays: 30, url };
    expect(requestProposalEmail("en", { ...base, priceCents: 450000, priceMaxCents: null }).text).toContain("Price: $4,500");
    expect(requestProposalEmail("en", { ...base, priceCents: 300000, priceMaxCents: 500000 }).text).toContain("Price: $3,000 – $5,000");
    expect(requestProposalEmail("en", { ...base, priceCents: null, priceMaxCents: null }).text).toContain("Price: to be discussed");
    const vi = requestProposalEmail("vi", { ...base, priceCents: 450000, priceMaxCents: null });
    expect(vi.subject).toBe("Đề xuất mới từ Lan");
    expect(vi.text).toContain("Giá: $4.500");
    expect(vi.text).toContain("Thời gian dự kiến: 30 ngày");
  });

  it("carries the admin's reason, the day counts and a neutral not-selected text", () => {
    expect(requestRejectedEmail("en", { title: "T", reason: "Too vague.", url }).text).toContain("Too vague.");
    expect(requestExpiredEmail("en", { title: "T", days: 30, url }).text).toContain("30 days");
    expect(requestReminderEmail("en", { clientName: builderFacingName("Minh"), title: "T", days: 7, url }).text).toContain("three days ago");
    expect(requestNotSelectedEmail("en", { title: "T", url }).text).toContain("was not selected, and the request has ended");
    expect(requestInviteExpiredEmail("en", { title: "T", url }).subject).toBe("Invitation ended: T");
  });

  it("tells the admins in English, without the description or any e-mail address", () => {
    const mail = requestAdminNewEmail({ title: "Booking app", category: "booking", budgetBand: "2k-10k", languages: ["en", "vi"], clientName: "Minh Tran" }, "https://vnx.si/admin/requests/01J");
    expect(mail.subject).toBe("New request: Booking app");
    for (const text of ["Minh Tran", "Booking", "$2,000 – $10,000", "en, vi", "https://vnx.si/admin/requests/01J"]) expect(mail.text, text).toContain(text);
  });

  it("escapes names, titles and reasons in every template", () => {
    const evil = '<img src=x onerror="a()">';
    const mails = [
      requestConfirmEmail("en", { title: evil, link: url }),
      requestInviteEmail("en", { clientName: builderFacingName(evil), title: evil, category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }),
      requestReminderEmail("en", { clientName: builderFacingName(evil), title: evil, days: 7, url }),
      requestInviteExpiredEmail("en", { title: evil, url }),
      requestProposalEmail("en", { builderName: evil, title: evil, priceCents: null, priceMaxCents: null, timelineDays: 3, url }),
      requestNotSelectedEmail("en", { title: evil, url }),
      requestRejectedEmail("en", { title: evil, reason: evil, url }),
      requestExpiredEmail("en", { title: evil, days: 30, url }),
      requestAdminNewEmail({ title: evil, category: "crm", budgetBand: "unsure", languages: ["en"], clientName: evil }, url),
    ];
    for (const mail of mails) {
      expect(mail.html).not.toContain("<img");
      expect(mail.html).toContain("&lt;img");
    }
  });

  it("uses the same category labels as the views", () => {
    expect(CATEGORY_KEY).toEqual(VIEW_CATEGORY_KEY);
  });
});
```

Chạy: `npm test -w apps/web -- test/domain/inquiry.test.ts test/email/request-templates.test.ts` → FAIL (helper và module chưa có).

- [ ] **Step 2: Chuẩn bị `email/parts.ts`, mẫu request, 34 key**

`apps/web/src/email/parts.ts` (chuyển nguyên bốn hàm từ `templates/inquiry.ts`):

```ts
import { escapeHtml } from "./escape.ts";

export const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
export const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
export const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
export const wrap = (locale: string, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;
```

Trong `apps/web/src/email/templates/inquiry.ts`: xóa bốn định nghĩa `p`, `link`, `quote`, `wrap` (và `type Email` giữ nguyên), thêm `import { link, p, quote, wrap } from "../parts.ts";`, đổi `const BUDGET_KEY` thành `export const BUDGET_KEY`. `escapeHtml` vẫn được import vì `inquiryAdminAlertEmail` dùng. **Trước khi chuyển hàm**, thêm vào `test/email/inquiry-templates.test.ts` một test chụp HTML nguyên văn của `newInquiryEmail("en", { clientName: "Minh", type: "customize", productName: "Spa Booking", budgetBand: "2k-10k", deadline: "2026-12-01", message: "Line one
Line <two>", url: "https://vnx.si/hub/inquiries/01J" }).html` bằng `toBe` (chạy trên mã cũ để lấy chuỗi), để việc tách chứng minh byte-identical. Chạy `npm test -w apps/web -- test/email/inquiry-templates.test.ts test/notify/inquiry.test.ts test/jobs/daily-inquiries.test.ts` → PASS (không đổi hành vi).

Thêm 34 key vào 4 file locale theo bảng trên, `en.ts` trước (các file khác phải có đúng tập key: `test/i18n/parity.test.ts`).

Thêm vào `apps/web/src/domain/inquiry.ts`, cạnh `parseClientName`:

```ts
const EMAIL_LIKE = /[^\s@()<>,;]+@[^\s@()<>,;]+\.[^\s@()<>,;]+/g;

/** The client's typed name as a builder may see it: any e-mail-like part becomes "•••" (Owner 2026-10-04), the rest is kept. */
export type BuilderFacingName = string & { readonly __brand: "BuilderFacingName" };

export function builderFacingName(name: string): BuilderFacingName {
  return name.replace(EMAIL_LIKE, "•••") as BuilderFacingName;
}
```

`apps/web/src/email/templates/request.ts`:

```ts
import type { BudgetBand, BuilderFacingName } from "../../domain/inquiry.ts";
import type { Category } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { link, p, quote, wrap } from "../parts.ts";
import { BUDGET_KEY } from "./inquiry.ts";

type Email = { subject: string; text: string; html: string };

// Same keys as views/labels.ts (email/ may only import i18n; see ARCHITECTURE §2); a test keeps them equal.
export const CATEGORY_KEY: Record<Category, MessageKey> = {
  booking: "product.category.booking",
  crm: "product.category.crm",
  ecommerce: "product.category.ecommerce",
  finance: "product.category.finance",
  hr: "product.category.hr",
  education: "product.category.education",
  internal_tools: "product.category.internal_tools",
  ai_agents: "product.category.ai_agents",
  other: "product.category.other",
};

/** Whole US dollars with the locale's digit grouping. */
const usd = (locale: Locale, cents: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(cents / 100);

/** The e-mail that asks the client to confirm (sent by the route, which shows an error on the form when it fails). */
export function requestConfirmEmail(locale: Locale, input: { title: string; link: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestConfirm.body", { title: input.title });
  const ignore = tr("email.requestConfirm.ignore");
  return { subject: tr("email.requestConfirm.subject"), text: `${body}\n\n${input.link}\n\n${ignore}`, html: wrap(locale, [p(body), link(input.link), p(ignore)]) };
}

/** To the invited builder: the client's typed name only, never the e-mail (spec §5.7 step 3). */
export function requestInviteEmail(
  locale: Locale,
  input: { clientName: BuilderFacingName; title: string; category: Category; budgetBand: BudgetBand; deadline: string | null; days: number; url: string },
): Email {
  const tr = translator(locale);
  const intro = tr("email.requestInvite.intro", { client: input.clientName, title: input.title });
  const facts = [
    tr("email.requestInvite.category", { category: tr(CATEGORY_KEY[input.category]) }),
    tr("email.newInquiry.budget", { budget: tr(BUDGET_KEY[input.budgetBand]) }),
    ...(input.deadline ? [tr("email.newInquiry.deadline", { deadline: input.deadline })] : []),
  ];
  const cta = tr("email.requestInvite.cta", { days: input.days });
  return {
    subject: tr("email.requestInvite.subject", { title: input.title }),
    text: `${intro}\n${facts.join("\n")}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), p(cta), link(input.url)]),
  };
}

export function requestReminderEmail(locale: Locale, input: { clientName: BuilderFacingName; title: string; days: number; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestReminder.body", { client: input.clientName, title: input.title, days: input.days });
  const cta = tr("email.requestReminder.cta");
  return { subject: tr("email.requestReminder.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

export function requestInviteExpiredEmail(locale: Locale, input: { title: string; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestInviteExpired.body", { title: input.title });
  const cta = tr("email.requestInviteExpired.cta");
  return { subject: tr("email.requestInviteExpired.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** To the client: who, the price and the time. The approach stays on /me. */
export function requestProposalEmail(
  locale: Locale,
  input: { builderName: string; title: string; priceCents: number | null; priceMaxCents: number | null; timelineDays: number; url: string },
): Email {
  const tr = translator(locale);
  const intro = tr("email.requestProposal.intro", { builder: input.builderName, title: input.title });
  const price =
    input.priceCents === null
      ? tr("email.requestProposal.priceDiscuss")
      : input.priceMaxCents === null
        ? tr("email.requestProposal.priceFixed", { price: usd(locale, input.priceCents) })
        : tr("email.requestProposal.priceRange", { from: usd(locale, input.priceCents), to: usd(locale, input.priceMaxCents) });
  const facts = [price, tr("email.requestProposal.timeline", { days: input.timelineDays })];
  const cta = tr("email.requestProposal.cta");
  return {
    subject: tr("email.requestProposal.subject", { builder: input.builderName }),
    text: `${intro}\n${facts.join("\n")}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), p(cta), link(input.url)]),
  };
}

export function requestNotSelectedEmail(locale: Locale, input: { title: string; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestNotSelected.body", { title: input.title });
  const cta = tr("email.requestNotSelected.cta");
  return { subject: tr("email.requestNotSelected.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

export function requestRejectedEmail(locale: Locale, input: { title: string; reason: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.requestRejected.intro", { title: input.title });
  const label = tr("email.requestRejected.reason");
  const cta = tr("email.requestRejected.cta");
  return {
    subject: tr("email.requestRejected.subject", { title: input.title }),
    text: `${intro}\n\n${label}\n${input.reason}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), p(label), quote(input.reason), p(cta), link(input.url)]),
  };
}

export function requestExpiredEmail(locale: Locale, input: { title: string; days: number; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.requestExpired.body", { title: input.title, days: input.days });
  const cta = tr("email.requestExpired.cta");
  return { subject: tr("email.requestExpired.subject", { title: input.title }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** Internal alert for ADMIN_EMAILS (English only, like inquiryAdminAlertEmail). The client's e-mail is on the admin page, not here. */
export function requestAdminNewEmail(
  input: { title: string; category: Category; budgetBand: BudgetBand; languages: readonly string[]; clientName: string },
  url: string,
): Email {
  const tr = translator("en");
  const lines = [`From: ${input.clientName}`, `Category: ${tr(CATEGORY_KEY[input.category])}`, `Budget: ${tr(BUDGET_KEY[input.budgetBand])}`, `Languages: ${input.languages.join(", ")}`];
  const intro = `A new request is waiting for your review: “${input.title}”.`;
  return { subject: `New request: ${input.title}`, text: `${intro}\n${lines.join("\n")}\n\n${url}`, html: wrap("en", [p(intro), ...lines.map(p), link(url)]) };
}
```

Chạy: `npm test -w apps/web -- test/domain/inquiry.test.ts test/email/request-templates.test.ts test/i18n/parity.test.ts` → PASS.

- [ ] **Step 3: Test notify (fail)**

`apps/web/test/notify/request.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import {
  notifyInvited,
  notifyInviteExpired,
  notifyInviteReminder,
  notifyNotSelected,
  notifyProposal,
  notifyRequestExpired,
  notifyRequestRejected,
  notifyRequestSubmitted,
} from "../../src/notify/request.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeRequest, proposeOn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const failingEnv = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
const setInvite = (id: string, status: string) => testEnv.DB.prepare("UPDATE request_invites SET status = ?2 WHERE id = ?1").bind(id, status).run();
const setRequest = (id: string, status: string, note: string | null = null) => testEnv.DB.prepare("UPDATE requests SET status = ?2, admin_note = ?3 WHERE id = ?1").bind(id, status, note).run();

/** A submitted request with `n` approved builders invited (matching), builder i has locale `locales[i]`. */
async function invited(tag: string, locales: string[] = ["en"], clientLocale = "en") {
  const { client, request } = await makeRequest({ tag, clientLocale });
  const builders = [];
  for (const [i, locale] of locales.entries()) {
    await ensureUser(`${tag}-b${i}@vnx.si`, locale);
    builders.push(await makeBuilder(`${tag}-b${i}@vnx.si`, `${tag}-b${i}`, "approved", { name: `${tag} builder ${i}` }));
  }
  const invites = await inviteBuilders(request, builders);
  return { client, request, builders, invites };
}

describe("request notifications (spec §8.3)", () => {
  beforeEach(() => clearOutbox());

  it("tells every admin in English, once per address, without the client's e-mail or description", async () => {
    const { client, request } = await makeRequest({ tag: "rn-admin", title: "Booking app" });
    const env = { ...testEnv, ADMIN_EMAILS: "a@vnx.si, B@vnx.si" } as Bindings;
    expect(await notifyRequestSubmitted(env, request.id)).toEqual({ sent: 2, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(["a@vnx.si", "b@vnx.si"]);
    expect(outbox[0]).toMatchObject({ subject: "New request: Booking app" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/admin/requests/${request.id}`);
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
    expect(outbox[0]!.text).not.toContain(request.description);
  });

  it("sends nothing for an unconfirmed or removed request, or when no admin is configured", async () => {
    const pending = await makeRequest({ tag: "rn-admin-p", status: "pending_verification" });
    expect(await notifyRequestSubmitted(testEnv, pending.request.id)).toEqual({ sent: 0, failed: 0 });
    const gone = await makeRequest({ tag: "rn-admin-r" });
    await setRequest(gone.request.id, "removed");
    expect(await notifyRequestSubmitted(testEnv, gone.request.id)).toEqual({ sent: 0, failed: 0 });
    const live = await makeRequest({ tag: "rn-admin-n" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await notifyRequestSubmitted({ ...testEnv, ADMIN_EMAILS: "" } as Bindings, live.request.id)).toEqual({ sent: 0, failed: 0 });
    warn.mockRestore();
    expect(outbox).toHaveLength(0);
  });

  it("invites each builder in their locale with a link to the invitation and never the client's e-mail", async () => {
    const { client, request, invites } = await invited("rn-inv", ["vi", "en"]);
    expect(await notifyInvited(testEnv, invites.map((i) => i.id))).toEqual({ sent: 2, failed: 0 });
    expect(outbox[0]).toMatchObject({ to: "rn-inv-b0@vnx.si", subject: `Bạn được mời vào một nhu cầu: ${request.title}` });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/hub/invitations/${invites[0]!.id}`);
    expect(outbox[1]).toMatchObject({ to: "rn-inv-b1@vnx.si" });
    for (const mail of outbox) {
      expect(mail.text).toContain("Minh Tran");
      expect(mail.text + mail.html).not.toContain(client.email);
    }
  });

  it("does not invite by e-mail an invitation that has already been answered", async () => {
    const { invites } = await invited("rn-inv2", ["en", "en"]);
    await setInvite(invites[0]!.id, "declined");
    expect(await notifyInvited(testEnv, [invites[0]!.id, invites[1]!.id, "01NOTAREALINVITE0000000000"])).toEqual({ sent: 1, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(["rn-inv2-b1@vnx.si"]);
  });

  it("reminds a builder who has not answered, and only then", async () => {
    const { invites } = await invited("rn-rem");
    expect(await notifyInviteReminder(testEnv, invites[0]!.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: "rn-rem-b0@vnx.si" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/hub/invitations/${invites[0]!.id}`);
    await proposeOn(invites[0]!);
    expect(await notifyInviteReminder(testEnv, invites[0]!.id)).toBe("skipped");
    expect(outbox).toHaveLength(1);
  });

  it("tells the client about a proposal in their locale, with price and time, linking to /me", async () => {
    const { client, request, invites } = await invited("rn-prop", ["en"], "zh-Hans");
    expect(await notifyProposal(testEnv, invites[0]!.id)).toBe("skipped");
    await proposeOn(invites[0]!);
    expect(await notifyProposal(testEnv, invites[0]!.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "rn-prop builder 0 发来新方案" });
    expect(outbox[0]!.text).toContain("价格：$4,500");
    expect(outbox[0]!.text).toContain("预计时间：30 天");
    expect(outbox[0]!.text).toContain(`https://vnx.si/zh-hans/me/requests/${request.id}`);
  });

  it("tells builders whose proposal was not selected, and those whose invitation lapsed", async () => {
    const { invites, request } = await invited("rn-end", ["en", "vi"]);
    await setInvite(invites[0]!.id, "not_selected");
    await setInvite(invites[1]!.id, "expired");
    expect(await notifyNotSelected(testEnv, [invites[0]!.id, invites[1]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[0]).toMatchObject({ to: "rn-end-b0@vnx.si", subject: `Update on your proposal: ${request.title}` });
    expect(await notifyInviteExpired(testEnv, [invites[0]!.id, invites[1]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[1]).toMatchObject({ to: "rn-end-b1@vnx.si", subject: `Lời mời đã kết thúc: ${request.title}` });
  });

  it("still tells builders their proposal was not selected after the request was removed as spam, without the client's e-mail", async () => {
    const { client, invites, request } = await invited("rn-spam");
    await setInvite(invites[0]!.id, "not_selected");
    await setRequest(request.id, "removed");
    expect(await notifyNotSelected(testEnv, [invites[0]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
  });

  it("returns a request to its client with the admin's reason, and tells them when it expired", async () => {
    const { client, request } = await makeRequest({ tag: "rn-rej", clientLocale: "vi" });
    expect(await notifyRequestRejected(testEnv, request.id)).toBe("skipped");
    await setRequest(request.id, "rejected", "Please add what the salons need.");
    expect(await notifyRequestRejected(testEnv, request.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email });
    expect(outbox[0]!.text).toContain("Please add what the salons need.");
    expect(outbox[0]!.text).toContain("https://vnx.si/vi/request");

    expect(await notifyRequestExpired(testEnv, request.id)).toBe("skipped");
    await setRequest(request.id, "expired");
    expect(await notifyRequestExpired(testEnv, request.id)).toBe("sent");
    expect(outbox[1]!.text).toContain("30");
  });

  it("counts a failed send and never throws, even when D1 is down", async () => {
    const { invites } = await invited("rn-fail");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyInvited(failingEnv, [invites[0]!.id])).toEqual({ sent: 0, failed: 1 });
    expect(await notifyInviteReminder(failingEnv, invites[0]!.id)).toBe("failed");
    const down = { ...testEnv, DB: new Proxy(testEnv.DB, { get: (t, prop) => (prop === "prepare" ? () => { throw new Error("d1 down"); } : (Reflect.get(t, prop) as unknown)) }) } as Bindings;
    await expect(notifyInvited(down, [invites[0]!.id])).resolves.toEqual({ sent: 0, failed: 1 });
    await expect(notifyRequestRejected(down, "01ANYREQUESTID000000000000")).resolves.toBe("failed");
    await expect(notifyRequestSubmitted(down, "01ANYREQUESTID000000000000")).resolves.toEqual({ sent: 0, failed: 1 });
    expect(spy.mock.calls.every(([line]) => !String(line).includes("@vnx.si"))).toBe(true);
    spy.mockRestore();
  });
});
```

Chạy: `npm test -w apps/web -- test/notify/request.test.ts` → FAIL (module chưa có).

- [ ] **Step 4: `endRequestBatch` trả thêm `expired`, và `findInviteContext` trong `db/requests.ts`**

`endRequestBatch`: thêm `RETURNING id` vào câu `invited → expired`, đổi kiểu `read` thành `{ request; notSelected: string[]; expired: string[] }` (`expiredAt = 1 + between.length`, `notSelectedAt = expiredAt + 1`). Trong `test/db/requests.test.ts` đổi ba assertion `toEqual({ request: null, notSelected: [] })` (dòng ~112, 164, 177) thành `{ request: null, notSelected: [], expired: [] }` và trong test "ends a request" thêm `expect(outcome.expired).toEqual([b!.id]);`. Chạy `npm test -w apps/web -- test/db/requests.test.ts`.


Thêm vào cuối `apps/web/src/db/requests.ts` (đã import `toRequest`, `toInvite`, `InviteRow`, `findRequestWithClient`):

```ts
/** An invitation with its request and both parties' contact details. Used only as recipients and for the e-mail text. */
export type InviteContext = {
  invite: RequestInvite;
  request: ClientRequest;
  builder: { email: string; locale: string; name: string; handle: string };
  client: { email: string; locale: string };
};

export async function findInviteContext(db: D1Database, inviteId: string): Promise<InviteContext | null> {
  const row = await db
    .prepare(
      `SELECT x.*, b.name AS builder_name, b.handle AS builder_handle, bu.email AS builder_email, bu.locale AS builder_locale
       FROM request_invites x JOIN builders b ON b.user_id = x.builder_id JOIN users bu ON bu.id = x.builder_id
       WHERE x.id = ?1`,
    )
    .bind(inviteId)
    .first<InviteRow & { builder_name: string; builder_handle: string; builder_email: string; builder_locale: string }>();
  if (!row) return null;
  const found = await findRequestWithClient(db, row.request_id);
  if (!found) return null;
  return {
    invite: toInvite(row),
    request: found.request,
    builder: { email: row.builder_email, locale: row.builder_locale, name: row.builder_name, handle: row.builder_handle },
    client: found.client,
  };
}
```

- [ ] **Step 5: `notify/request.ts`**

```ts
import { adminEmails } from "../auth/admin.ts";
import { builderFacingName } from "../domain/inquiry.ts";
import { findInviteContext, findRequestWithClient, type InviteContext } from "../db/requests.ts";
import { INVITE_TTL_MS, MATCHING_TTL_MS } from "../domain/request.ts";
import { getMailer } from "../email/index.ts";
import type { EmailMessage } from "../email/mailer.ts";
import {
  requestAdminNewEmail,
  requestExpiredEmail,
  requestInviteEmail,
  requestInviteExpiredEmail,
  requestNotSelectedEmail,
  requestProposalEmail,
  requestRejectedEmail,
  requestReminderEmail,
} from "../email/templates/request.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath, type Locale } from "../i18n/locales.ts";

export type NotifyOutcome = "sent" | "failed" | "skipped";
export type NotifyTally = { sent: number; failed: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const asLocale = (value: string): Locale => (isLocale(value) ? value : "en");
const absolute = (env: Pick<Bindings, "APP_ORIGIN">, path: string) => new URL(path, env.APP_ORIGIN).toString();

/** Builder side: the invitation page (the id is the invitation's, so one builder's link never opens another's). */
export const invitationUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, inviteId: string) => absolute(env, localizedPath(locale, `/hub/invitations/${inviteId}`));
export const invitationsUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale) => absolute(env, localizedPath(locale, "/hub/invitations"));
/** Client side. */
export const clientRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, requestId: string) => absolute(env, localizedPath(locale, `/me/requests/${requestId}`));
export const newRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale) => absolute(env, localizedPath(locale, "/request"));
/** Admin pages are English only. */
export const adminRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, requestId: string) => absolute(env, `/admin/requests/${requestId}`);

// Never logs addresses: only the kind, the id and the error text. There is no retry column (plan M6): a failure is a log line.
function logFailure(kind: string, id: string, err: unknown): void {
  console.error(JSON.stringify({ event: "request.notify_failed", kind, id, error: String(err) }));
}

/** Runs one notification: any thrown error (D1, template, mailer) becomes "failed". */
async function attempt(kind: string, id: string, run: () => Promise<EmailMessage | null>, env: Bindings): Promise<NotifyOutcome> {
  try {
    const mail = await run();
    if (!mail) return "skipped";
    await getMailer(env).send(mail);
    return "sent";
  } catch (err) {
    logFailure(kind, id, err);
    return "failed";
  }
}

const tally = (outcomes: NotifyOutcome[]): NotifyTally => ({ sent: outcomes.filter((o) => o === "sent").length, failed: outcomes.filter((o) => o === "failed").length });

/** One e-mail about one invitation, to the builder or the client; `compose` returns null when the invitation no longer fits. */
function aboutInvite(
  env: Bindings,
  kind: string,
  inviteId: string,
  to: "builder" | "client",
  compose: (ctx: InviteContext, locale: Locale) => Omit<EmailMessage, "to"> | null, // the invitation's own status gates each notice; builder end-notices still go out after spam (plan header)
): Promise<NotifyOutcome> {
  return attempt(
    kind,
    inviteId,
    async () => {
      const ctx = await findInviteContext(env.DB, inviteId);
      if (!ctx) return null;
      const party = to === "builder" ? ctx.builder : ctx.client;
      const mail = compose(ctx, asLocale(party.locale));
      return mail ? { to: party.email, ...mail } : null;
    },
    env,
  );
}

/** Spec §8.3 / Owner 2026-10-04: a request that became `submitted` is announced to every ADMIN_EMAILS address, in English. */
export async function notifyRequestSubmitted(env: Bindings, requestId: string): Promise<NotifyTally> {
  try {
    return await announce(env, requestId);
  } catch (err) {
    logFailure("submitted", requestId, err);
    return { sent: 0, failed: 1 };
  }
}

// Everything that can throw (D1, URL, template) runs inside notifyRequestSubmitted's try.
async function announce(env: Bindings, requestId: string): Promise<NotifyTally> {
  const loaded = await findRequestWithClient(env.DB, requestId);
  if (!loaded || loaded.request.status === "pending_verification" || loaded.request.status === "removed") return { sent: 0, failed: 0 };
  const admins = [...adminEmails(env)];
  if (admins.length === 0) {
    console.warn(JSON.stringify({ event: "request.no_admins", requestId }));
    return { sent: 0, failed: 0 };
  }
  const { request } = loaded;
  const mail = requestAdminNewEmail({ title: request.title, category: request.category, budgetBand: request.budgetBand, languages: request.languages, clientName: request.clientName }, adminRequestUrl(env, request.id));
  const outcomes: NotifyOutcome[] = [];
  for (const to of admins) outcomes.push(await attempt("submitted", requestId, async () => ({ to, ...mail }), env));
  return tally(outcomes);
}

/** Builders just invited (Task 4: ids from `inviteBuildersBatch(...).read(...).invited`). */
export async function notifyInvited(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "invited", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "invited"
          ? null
          : requestInviteEmail(locale, { clientName: builderFacingName(request.clientName), title: request.title, category: request.category, budgetBand: request.budgetBand, deadline: request.deadline, days: INVITE_TTL_MS / DAY_MS, url: invitationUrl(env, locale, invite.id) }),
      ),
    );
  }
  return tally(outcomes);
}

/** Task 7: a builder invited three days ago who has not answered. The cron marks `reminded_at` itself. */
export function notifyInviteReminder(env: Bindings, inviteId: string): Promise<NotifyOutcome> {
  return aboutInvite(env, "reminder", inviteId, "builder", ({ invite, request }, locale) =>
    invite.status !== "invited" || request.status !== "matching"
      ? null
      : requestReminderEmail(locale, { clientName: builderFacingName(request.clientName), title: request.title, days: INVITE_TTL_MS / DAY_MS, url: invitationUrl(env, locale, invite.id) }),
  );
}

/** Task 7 / lock: invitations that moved to `expired`. */
export async function notifyInviteExpired(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "invite_expired", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "expired" ? null : requestInviteExpiredEmail(locale, { title: request.title, url: invitationsUrl(env, locale) }),
      ),
    );
  }
  return tally(outcomes);
}

/** Task 5: a proposal the builder just sent. */
export function notifyProposal(env: Bindings, inviteId: string): Promise<NotifyOutcome> {
  return aboutInvite(env, "proposal", inviteId, "client", ({ invite, request, builder }, locale) =>
    invite.status !== "proposed" || request.status !== "matching"
      ? null
      : requestProposalEmail(locale, { builderName: builder.name, title: request.title, priceCents: invite.priceCents, priceMaxCents: invite.priceMaxCents, timelineDays: invite.timelineDays ?? 0, url: clientRequestUrl(env, locale, request.id) }),
  );
}

/** Builders whose proposal moved to `not_selected` (any way the request ended; neutral text, plan M6). */
export async function notifyNotSelected(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "not_selected", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "not_selected" ? null : requestNotSelectedEmail(locale, { title: request.title, url: invitationsUrl(env, locale) }),
      ),
    );
  }
  return tally(outcomes);
}

async function aboutRequest(
  env: Bindings,
  kind: string,
  requestId: string,
  compose: (found: NonNullable<Awaited<ReturnType<typeof findRequestWithClient>>>, locale: Locale) => Omit<EmailMessage, "to"> | null,
): Promise<NotifyOutcome> {
  return attempt(
    kind,
    requestId,
    async () => {
      const found = await findRequestWithClient(env.DB, requestId);
      if (!found || found.request.status === "removed") return null;
      const mail = compose(found, asLocale(found.client.locale));
      return mail ? { to: found.client.email, ...mail } : null;
    },
    env,
  );
}

/** Task 4: the admin returned the request; the client gets the reason. */
export function notifyRequestRejected(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutRequest(env, "rejected", requestId, ({ request }, locale) =>
    request.status !== "rejected" || !request.adminNote ? null : requestRejectedEmail(locale, { title: request.title, reason: request.adminNote, url: newRequestUrl(env, locale) }),
  );
}

/** Task 7: the request stayed in `matching` for 30 days. */
export function notifyRequestExpired(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutRequest(env, "expired", requestId, ({ request }, locale) =>
    request.status !== "expired" ? null : requestExpiredEmail(locale, { title: request.title, days: MATCHING_TTL_MS / DAY_MS, url: newRequestUrl(env, locale) }),
  );
}
```

Chạy: `npm test -w apps/web -- test/notify/request.test.ts` → PASS.

- [ ] **Step 6: Test `request_verify` (fail)**

`apps/web/test/auth/request-verify.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Context } from "hono";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { findRequestById } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { AppEnv } from "../../src/env.ts";
import { openPendingRequest } from "../../src/routes/request-confirm.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { ensureUser, makeRequest } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = createApp();
const tokenFor = (email: string, requestId: string | null, locale: "en" | "vi" = "en", at = new Date()) =>
  createLoginToken(testEnv.DB, { email, purpose: "request_verify", locale, requestId }, at);
const audits = (id: string) => testEnv.DB.prepare("SELECT action, actor_user_id, data FROM audit_log WHERE entity_id = ?1 AND action = 'request.verify'").bind(id).all<{ action: string; actor_user_id: string; data: string }>();

describe("request_verify at /auth/verify (VNX-0602a)", () => {
  beforeEach(() => clearOutbox());

  it("shows its own confirmation page on GET without spending the token", async () => {
    const { client, request } = await makeRequest({ tag: "rv-get", status: "pending_verification" });
    const t = await tokenFor(client.email, request.id, "vi");
    for (let i = 0; i < 2; i++) {
      const res = await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Xác nhận nhu cầu");
      expect(html).toContain('<form method="post" action="/auth/verify">');
    }
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(0);
  });

  it("submits the request, signs the client in, names the account, audits and alerts the admin", async () => {
    const { client, request } = await makeRequest({ tag: "rv-ok", status: "pending_verification", languages: ["vi", "zh"] });
    const t = await tokenFor(client.email, request.id, "vi");
    const res = await app.request(formPost("/auth/verify", { t }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/me/requests/${request.id}`);
    expect(res.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);
    const after = (await findRequestById(testEnv.DB, request.id))!;
    expect(after.status).toBe("submitted");
    expect(after.submittedAt).not.toBeNull();
    const user = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    expect(user?.display_name).toBe("Minh Tran");
    const { results } = await audits(request.id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ actor_user_id: client.id });
    expect(JSON.parse(results[0]!.data)).toMatchObject({ via: "link", category: "booking", languages: ["vi", "zh"] });
    expect(outbox.map((m) => m.to)).toEqual(["owner@vnx.si"]);
    expect(outbox[0]!.subject).toBe(`New request: ${request.title}`);
  });

  it("opens only the signed-in e-mail's own pending request", async () => {
    const mine = await makeRequest({ tag: "rv-own" });
    const other = await makeRequest({ tag: "rv-other", status: "pending_verification" });
    const stranger = await ensureUser("rv-stranger@vnx.si");
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(stranger.email, other.request.id) }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expect((await findRequestById(testEnv.DB, other.request.id))?.status).toBe("pending_verification");
    // A token for a request that is already submitted, or without a request, changes nothing and tells nobody.
    const again = await app.request(formPost("/auth/verify", { t: await tokenFor(mine.client.email, mine.request.id) }), undefined, testEnv);
    expect(again.headers.get("location")).toBe("/me");
    const none = await app.request(formPost("/auth/verify", { t: await tokenFor(mine.client.email, null) }), undefined, testEnv);
    expect(none.headers.get("location")).toBe("/me");
    expect(outbox).toHaveLength(0);
    expect((await audits(other.request.id)).results).toHaveLength(0);
  });

  it("does not open a request the admin removed, and tells nobody", async () => {
    const { client, request } = await makeRequest({ tag: "rv-rm", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(client.email, request.id) }), undefined, testEnv);
    expect(res.headers.get("location")).toBe("/me");
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect(outbox).toHaveLength(0);
  });

  it("refuses a suspended account and leaves the request pending", async () => {
    const { client, request } = await makeRequest({ tag: "rv-sus", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(client.id).run();
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(client.email, request.id) }), undefined, testEnv);
    expect(res.status).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(0);
  });

  it("does nothing when the compare-and-set loses: the request was already submitted", async () => {
    const { client, request: stale } = await makeRequest({ tag: "rv-lost", status: "pending_verification" });
    const t = await tokenFor(client.email, stale.id);
    expect((await app.request(formPost("/auth/verify", { t }), undefined, testEnv)).status).toBe(303); // submits it
    clearOutbox();
    const before = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Kept' WHERE id = ?1").bind(client.id).run();
    // `stale` was read while pending; call the function with it now.
    const ctx = { env: testEnv } as unknown as Context<AppEnv>;
    expect(await openPendingRequest(ctx, stale, client, new Date(), "me")).toBe(false);
    expect((await audits(stale.id)).results).toHaveLength(1); // only the first, winning, call
    expect(outbox).toHaveLength(0);
    const after = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    expect(before?.display_name).toBe("Minh Tran");
    expect(after?.display_name).toBe("Kept");
  });

  it("explains an expired request link, with the Send now hint for requests only", async () => {
    const old = new Date(Date.now() - 16 * 60 * 1000);
    const t = await tokenFor("rv-old@vnx.si", null, "vi", old);
    const html = await (await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv)).text();
    expect(html).toContain(`Nếu bạn đang xác nhận một nhu cầu: hãy đăng nhập, mở ${vi["nav.me"]} và bấm ${vi["me.sendNow"]}.`);
    expect(html).not.toContain("Nếu bạn đang xác nhận một yêu cầu");
  });
});
```

Chạy: `npm test -w apps/web -- test/auth/request-verify.test.ts` → FAIL (`request_verify` chưa nằm trong `VERIFY_PURPOSES`: 400).

- [ ] **Step 7: `openPendingRequest`, `/auth/verify`, view**

`apps/web/src/routes/request-confirm.ts`:

```ts
import type { Context } from "hono";
import { auditStatement } from "../db/audit.ts";
import { returnedRequest, setRequestStatusStatement } from "../db/requests.ts";
import { setDisplayNameIfEmpty } from "../db/users.ts";
import type { ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { notifyRequestSubmitted } from "../notify/request.ts";

/**
 * The one place a pending request becomes submitted (spec §5.7 step 1), for the e-mail link and for "Send now" in /me.
 * The compare-and-set pending_verification -> submitted is the state machine's "verify" rule (domain/request.ts); a
 * signed-in session proves the owner's e-mail just as the link does, so "me" applies the same rule on the owner's behalf.
 * The audit row (`request.verify`, with category and languages for the M7 Live strip) is written only if the
 * compare-and-set won. Returns false when it lost (already submitted, removed or deleted meanwhile): nothing else
 * happens then. Otherwise names the account the first time and tells the admins.
 */
export async function openPendingRequest(c: Context<AppEnv>, request: ClientRequest, user: { id: string }, now: Date, via: "link" | "me"): Promise<boolean> {
  const iso = now.toISOString();
  const guard = { requestId: request.id, status: "submitted" as const, updatedAt: iso };
  const [moved] = await c.env.DB.batch([
    setRequestStatusStatement(c.env.DB, { id: request.id, from: "pending_verification", to: "submitted", now: iso }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "request.verify", entity: "request", entityId: request.id, data: { via, category: request.category, languages: request.languages }, now: iso }, guard),
  ]);
  if (!returnedRequest(moved)) return false;
  await setDisplayNameIfEmpty(c.env.DB, user.id, request.clientName, iso);
  await notifyRequestSubmitted(c.env, request.id);
  return true;
}
```

`apps/web/src/routes/auth.tsx`:
- import: `import { findRequestById } from "../db/requests.ts";` và `import { openPendingRequest } from "./request-confirm.ts";`
- `export const VERIFY_PURPOSES: TokenPurpose[] = ["login", "inquiry_verify", "request_verify"];`
- sau `confirmInquiry`:

```ts
/**
 * Spec §5.7 step 1: confirming the e-mail submits the pending request, names the account the first time and tells the
 * admins. Returns where to go: the request, or /me when it is not this account's pending request any more.
 */
async function confirmRequest(c: Context<AppEnv>, token: ConsumedToken, user: UserRow, now: Date): Promise<string> {
  const request = token.requestId ? await findRequestById(c.env.DB, token.requestId) : null;
  if (!request || request.clientUserId !== user.id || request.status !== "pending_verification") return localizedPath(token.locale, "/me");
  if (!(await openPendingRequest(c, request, user, now, "link"))) return localizedPath(token.locale, "/me");
  return localizedPath(token.locale, `/me/requests/${request.id}`);
}
```

- `invalidLink` (hint `request` truyền `place`/`button` đã dịch từ `nav.me`, `me.sendNow` theo locale của link): `hint={known?.purpose === "inquiry_verify" ? "inquiry" : known?.purpose === "request_verify" ? "request" : undefined}` thay `inquiryHint=…`.
- GET `/auth/verify`: `const purpose = peek.purpose === "login" ? "login" : peek.purpose === "inquiry_verify" ? "inquiry" : "request";`
- POST `/auth/verify`: sau dòng `inquiry_verify` thêm `if (result.token.purpose === "request_verify") return c.redirect(await confirmRequest(c, result.token, user, now), 303);`

`apps/web/src/views/auth.tsx`:
- `InvalidLinkPage: FC<Base & { hint?: "inquiry" | "request" }>`; thay dòng `{props.inquiryHint ? … }` bằng `{props.hint ? <p>{tr(props.hint === "inquiry" ? "auth.invalidLink.inquiryHint" : "auth.invalidLink.requestHint")}</p> : null}`.
- `CONFIRM_KEYS` thêm `request: { title: "auth.confirm.request.title", body: "auth.confirm.request.body", submit: "auth.confirm.request.submit" },`; `purpose: "login" | "inquiry" | "request"`.

Chạy: `npm test -w apps/web -- test/auth test/notify test/email test/i18n test/architecture.test.ts` → PASS.

- [ ] **Step 8: Kiểm tra cuối, commit**

Tiêu chí (mỗi mục có lệnh):
- Che tên giống email trong thư gửi builder: `npm test -w apps/web -- test/domain/inquiry.test.ts test/email/request-templates.test.ts`.
- Chín mẫu, 4 locale đủ key, cùng placeholder: `npm test -w apps/web -- test/email test/i18n/parity.test.ts`.
- Mọi hàm `notify*` không ném lỗi, lỗi chỉ log, không có địa chỉ trong log, email client không có trong thư gửi builder: `npm test -w apps/web -- test/notify/request.test.ts`.
- `request_verify`: GET không tiêu token, POST mở đúng request của đúng user, không gửi thừa, user bị khóa 403: `npm test -w apps/web -- test/auth/request-verify.test.ts`.
- Không ghi bảng ngoài module chủ: `npm test -w apps/web -- test/architecture.test.ts` (`notify/` và `routes/request-confirm.ts` không chứa `INSERT/UPDATE/DELETE`).

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/email/parts.ts apps/web/src/email/templates/request.ts apps/web/src/email/templates/inquiry.ts apps/web/src/domain/inquiry.ts apps/web/test/domain/inquiry.test.ts apps/web/src/notify/request.ts apps/web/src/routes/request-confirm.ts apps/web/src/routes/auth.tsx apps/web/src/views/auth.tsx apps/web/src/db/requests.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/email/request-templates.test.ts apps/web/test/notify/request.test.ts apps/web/test/auth/request-verify.test.ts
git commit -m "feat(web): request e-mails, notifications and request_verify (VNX-0602a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: VNX-0602b — Form `/request`, `/me`, lối vào, sitemap, Privacy

**Điều kiện bắt đầu:** controller đã áp lại commit `953fa21` (văn bản Privacy M6 do Owner duyệt) vào `docs/legal/privacy.md` trên nhánh. Kiểm bằng Step 0; không đạt thì dừng, không tự sửa `privacy.md` (Reviewer viết tài liệu mô tả).

**Files:**
- Create: `apps/web/src/routes/request-form.tsx`, `apps/web/src/routes/me-requests.tsx`
- Create: `apps/web/src/views/RequestFormPage.tsx`, `apps/web/src/views/RequestFacts.tsx`, `apps/web/src/views/me/RequestPage.tsx`, `apps/web/src/views/me/RequestList.tsx` (thư mục `views/me/` là mới)
- Modify: `apps/web/src/app.ts` (đăng ký 2 nhóm route), `apps/web/src/routes/me.tsx` (danh sách có request), `apps/web/src/views/labels.ts` (`REQUEST_STATUS_KEY`)
- Modify: `apps/web/src/views/DirectoryPage.tsx`, `apps/web/src/views/CatalogPage.tsx`, `apps/web/src/views/LandingPage.tsx` (lối vào `/request`), `apps/web/src/routes/seo.ts` (sitemap có `/request`)
- Modify: `apps/web/src/legal/content.ts` (chép nguyên văn phần M6 của `docs/legal/privacy.md`, Step 7)
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: tạo `apps/web/test/public/request-form.test.ts`, `apps/web/test/me/requests.test.ts`; sửa `apps/web/test/seo/sitemap.test.ts`, `apps/web/test/public/builders-page.test.ts`, `apps/web/test/public/products-page.test.ts`, `apps/web/test/landing/page.test.ts`, `apps/web/test/auth/verify-page.test.ts` (câu gợi ý đổi tên mục), `apps/web/test/me/inquiries.test.ts` (dòng 100: nhãn `nav.me` zh-hant)

**Interfaces:**
- Consumes (tên thật trong code):
  - Task 1: `domain/request.ts` (`ClientRequest`, `RequestStatus`, `RequestInput`, `RequestFormValues`, `RequestErrors`, `RequestFieldError`, `requestValuesFromBody`, `isRequestHoneypotFilled`, `parseRequestForm`, `requestTransition`, `TITLE_MAX`, `DESCRIPTION_MIN`, `DESCRIPTION_MAX`, `REQUEST_DAILY_LIMIT_PER_EMAIL`, `REQUEST_HOURLY_LIMIT_PER_IP`); `db/requests.ts` (`createRequest`, `findClientRequest`, `listClientRequests`, `endRequestBatch` (`.read(results)` trả `{ request, notSelected, expired }`), `deletePendingRequestStatement`); `domain/inquiry.ts` (`builderFacingName`).
  - Task 2: `email/templates/request.ts` (`requestConfirmEmail`); `notify/request.ts` (`notifyRequestSubmitted`, `notifyNotSelected`, `notifyInviteExpired`); `routes/request-confirm.ts` (`openPendingRequest(c, request, user, now, via)`, **không kiểm chủ sở hữu**: route gọi nó phải kiểm trước); `auth/tokens.ts` (`createLoginToken` nhận `purpose: "request_verify"` và `requestId`).
  - M5: `hitRateLimit`, `verifyTurnstile`, `turnstileSiteKey`, `TURNSTILE_FIELD`, `createUser`, `findUserByEmail`, `findUserById`, `UserRow`, `sha256Hex`, `writeAudit`, `auditStatement`, `requireUser`, `getMailer`, `Mailer`, `InquiryList` (`views/hub/InquiriesPage.tsx`), `errorResponse`, `page`, `siteOrigin`, `requestOrigin`, `onLocalized`.
- Produces:
  - `views/RequestFacts.tsx`: `RequestFacts: FC<{ locale; request: ClientRequest; showClient?: boolean }>` (Task 4, 5 dùng lại). Khi `showClient`, tên hiện qua `builderFacingName(request.clientName)` (Owner 2026-10-04: mọi view hướng builder che phần giống email). Trang của client (Task 3) không bật `showClient`.
  - `views/labels.ts`: `REQUEST_STATUS_KEY: Record<RequestStatus, MessageKey>`.
  - `views/me/RequestPage.tsx`: `RequestPage: FC<{ locale; origin; request: ClientRequest; sent: boolean; children?: unknown }>` (Task 6 truyền khối đề xuất qua `children`).
  - `routes/request-form.tsx`: `registerRequestFormRoutes(app)`; `createPendingRequestAndMail(env, { client, input, locale, now }, mailer = getMailer(env)): Promise<"sent" | "send_failed">` (xuất ra để test lỗi gửi email).
  - `routes/me-requests.tsx`: `registerMeRequestRoutes(app)`, `requestPage(c, request, status?)` (Task 6 thay phần thân để thêm đề xuất).
  - Route: `GET|POST /request`, `GET /me/requests/:id`, `POST /me/requests/:id/confirm`, `POST /me/requests/:id/close` (mọi tiền tố locale).

**Quyết định kỹ thuật (Reviewer kiểm):**
- Client không thấy tên nào hướng builder trong task này (trang `/me*` của chính họ; tên họ gõ là của họ) nên không dùng `builderFacingName` ở route; chỉ `RequestFacts` áp nó khi `showClient` (Task 4, 5).
- "Send now" kiểm chủ sở hữu và trạng thái **trước** khi gọi `openPendingRequest` (hàm đó không kiểm; xem Task 2 review): request của người khác, đã `removed` hoặc không tồn tại → 404 và không ghi gì (kể cả audit); của chính mình nhưng không còn `pending_verification` → 409 (như M5, bấm hai lần).
- Gửi email xác nhận lỗi: `createPendingRequestAndMail` xóa request chờ rồi trả `send_failed`; route trả 502 với `inquiry.error.sendFailed` (dùng lại chuỗi M5, không thêm key). Turnstile giả chỉ hoạt động cùng `MAIL_DRIVER=fake` nên test lỗi gửi gọi hàm này với Mailer hỏng, không đổi env.
- Rate limit: IP đếm sau khi form hợp lệ (M5 F4) và trước Turnstile; email đếm sau Turnstile (người chưa đăng nhập) hoặc ngay sau IP (đã đăng nhập).
- `badge-request-<status>` dùng lớp `.badge` nền, không thêm CSS (không có màu riêng cho trạng thái request ở M6).
- Cỡ: code chạy được ≈ 560 dòng không tính locale, test ≈ 350 dòng. Nếu Reviewer muốn nhỏ hơn, tách tại ranh giới 3a (Step 0–5 phần `/request`, Step 7 lối vào + sitemap + Privacy) và 3b (`/me`, Step 5–6 phần `/me`); không bắt buộc.

- [ ] **Step 0: Kiểm điều kiện Privacy**

Chạy từ gốc repo:

```bash
grep -c "^- \*\*Requests:\*\*" docs/legal/privacy.md
git log --oneline -3 -- docs/legal/privacy.md
```

Kỳ vọng: `1`; `git log` có một commit sửa `docs/legal/privacy.md` sau `32d70e0` (commit áp lại văn bản Owner đã duyệt); và `docs/legal/privacy.md` có dòng "Bổ sung M6 (request): APPROVED". Thiếu một trong ba → dừng, báo controller.

- [ ] **Step 1: Chuỗi i18n**

Sửa giá trị 3 key đã có và thêm key mới. `en.ts`:

```ts
  // đổi giá trị
  "nav.me": "Inquiries & requests",
  "me.title": "Inquiries & requests",
  "auth.invalidLink.inquiryHint": "If you were confirming an inquiry: sign in, open Inquiries & requests and press Send now.",
  // thêm
  "me.inquiries.title": "Inquiries",
  "me.requests.title": "Requests",
  "me.requests.empty": "No requests yet.",
  "request.cta": "Post a request",
  "request.form.title": "Post a request",
  "request.form.intro": "Describe what you need. Our team reads every request and invites up to five builders to send you proposals. Builders see your name, never your e-mail.",
  "request.form.titleField": "Title",
  "request.form.titleHint": "Up to 120 characters, for example \"Booking app for three salons\".",
  "request.form.descriptionField": "What do you need?",
  "request.form.descriptionHint": "40–4000 characters. Who will use it, what it must do, what you already have.",
  "request.form.category": "Category",
  "request.form.choose": "Choose…",
  "request.form.languages": "Languages you want to work in",
  "request.form.emailHint": "We send a confirmation link. Nothing is posted until you confirm.",
  "request.form.submit": "Post request",
  "request.form.unavailable": "Posting without an account is temporarily unavailable. Sign in to post your request.",
  "request.error.too_short": "Please write at least 40 characters.",
  "request.error.rateLimited": "Too many requests from your network. Please wait an hour and try again.",
  "request.error.dailyLimit": "You can post up to 3 requests a day. Please try again tomorrow.",
  "request.sent.body": "We sent a confirmation link to {email}. Your request reaches our team once you confirm. The link expires in 15 minutes.",
  "request.status.pending_verification": "Waiting for email confirmation",
  "request.status.submitted": "Waiting for matching",
  "request.status.matching": "Builders invited",
  "request.status.builder_selected": "Builder chosen",
  "request.status.rejected": "Returned",
  "request.status.expired": "Expired",
  "request.status.closed": "Closed",
  "request.status.removed": "Removed",
  "request.page.submitted": "You usually get proposals within 3 business days.",
  "request.page.pending": "Not sent yet. Confirm your email to send it to our team. You're signed in, so you can send it now.",
  "request.page.rejected": "Our team returned this request:",
  "request.page.expired": "This request expired after 30 days without a chosen proposal.",
  "request.page.closed": "This request is closed.",
  "request.page.close": "Close request",
  "request.page.closeHint": "Closing tells the invited builders that the request has ended.",
  "request.page.postAnother": "Post another request",
  "request.facts.category": "Category",
  "request.facts.languages": "Languages",
  "request.facts.client": "Posted by",
  "request.facts.submitted": "Submitted",
  "directory.request": "Can't find the right builder? Post a request and our team will invite builders for you.",
  "catalog.request": "Nothing fits? Post a request and our team will invite builders for you.",
  "landing.clients.request": "Can't wait? Post a request and our team matches you with builders by hand.",
```

`vi.ts`:

```ts
  "nav.me": "Yêu cầu và nhu cầu",
  "me.title": "Yêu cầu và nhu cầu",
  "auth.invalidLink.inquiryHint": "Nếu bạn đang xác nhận một yêu cầu: hãy đăng nhập, mở Yêu cầu và nhu cầu và bấm Gửi ngay.",
  "me.inquiries.title": "Yêu cầu",
  "me.requests.title": "Nhu cầu",
  "me.requests.empty": "Chưa có nhu cầu nào.",
  "request.cta": "Đăng nhu cầu",
  "request.form.title": "Đăng nhu cầu",
  "request.form.intro": "Mô tả điều bạn cần. Đội ngũ VNX.SI đọc từng nhu cầu và mời tối đa năm builder gửi đề xuất cho bạn. Builder thấy tên bạn, không bao giờ thấy email.",
  "request.form.titleField": "Tiêu đề",
  "request.form.titleHint": "Tối đa 120 ký tự, ví dụ \"App đặt lịch cho ba salon\".",
  "request.form.descriptionField": "Bạn cần gì?",
  "request.form.descriptionHint": "40–4000 ký tự. Ai sẽ dùng, cần làm được gì, bạn đã có sẵn những gì.",
  "request.form.category": "Danh mục",
  "request.form.choose": "Chọn…",
  "request.form.languages": "Ngôn ngữ muốn làm việc",
  "request.form.emailHint": "Chúng tôi gửi link xác nhận. Nhu cầu chưa được gửi đi cho tới khi bạn xác nhận.",
  "request.form.submit": "Đăng nhu cầu",
  "request.form.unavailable": "Tạm thời chưa đăng được khi chưa có tài khoản. Hãy đăng nhập để đăng nhu cầu.",
  "request.error.too_short": "Vui lòng viết ít nhất 40 ký tự.",
  "request.error.rateLimited": "Mạng của bạn đã gửi quá nhiều nhu cầu. Vui lòng chờ một giờ rồi thử lại.",
  "request.error.dailyLimit": "Mỗi ngày bạn đăng được tối đa 3 nhu cầu. Vui lòng thử lại vào ngày mai.",
  "request.sent.body": "Chúng tôi đã gửi link xác nhận tới {email}. Nhu cầu tới đội ngũ VNX.SI sau khi bạn xác nhận. Link hết hạn sau 15 phút.",
  "request.status.pending_verification": "Chờ xác nhận email",
  "request.status.submitted": "Đang chờ ghép",
  "request.status.matching": "Đã mời builder",
  "request.status.builder_selected": "Đã chọn builder",
  "request.status.rejected": "Bị trả về",
  "request.status.expired": "Hết hạn",
  "request.status.closed": "Đã đóng",
  "request.status.removed": "Đã gỡ",
  "request.page.submitted": "Bạn thường nhận được đề xuất trong 3 ngày làm việc.",
  "request.page.pending": "Chưa gửi. Hãy xác nhận email để gửi tới đội ngũ VNX.SI. Bạn đang đăng nhập nên có thể gửi ngay.",
  "request.page.rejected": "Đội ngũ VNX.SI đã trả lại nhu cầu này:",
  "request.page.expired": "Nhu cầu này đã hết hạn sau 30 ngày mà chưa chọn đề xuất nào.",
  "request.page.closed": "Nhu cầu này đã đóng.",
  "request.page.close": "Đóng nhu cầu",
  "request.page.closeHint": "Khi đóng, các builder được mời sẽ biết nhu cầu đã kết thúc.",
  "request.page.postAnother": "Đăng nhu cầu khác",
  "request.facts.category": "Danh mục",
  "request.facts.languages": "Ngôn ngữ",
  "request.facts.client": "Người đăng",
  "request.facts.submitted": "Ngày gửi",
  "directory.request": "Chưa tìm được builder phù hợp? Đăng nhu cầu, đội ngũ VNX.SI sẽ mời builder cho bạn.",
  "catalog.request": "Chưa có gì phù hợp? Đăng nhu cầu, đội ngũ VNX.SI sẽ mời builder cho bạn.",
  "landing.clients.request": "Không muốn chờ? Đăng nhu cầu, đội ngũ VNX.SI sẽ tự tay ghép bạn với builder.",
```

`zh-hans.ts`:

```ts
  "nav.me": "咨询与需求",
  "me.title": "咨询与需求",
  "auth.invalidLink.inquiryHint": "如果你正在确认一条咨询：请登录，打开“咨询与需求”并点击“立即发送”。",
  "me.inquiries.title": "咨询",
  "me.requests.title": "需求",
  "me.requests.empty": "还没有需求。",
  "request.cta": "发布需求",
  "request.form.title": "发布需求",
  "request.form.intro": "描述你的需求。VNX.SI 团队会阅读每条需求，并邀请最多五位开发者向你提交方案。开发者能看到你的名字，但永远看不到你的邮箱。",
  "request.form.titleField": "标题",
  "request.form.titleHint": "最多 120 个字符，例如“为三家美容院开发预约应用”。",
  "request.form.descriptionField": "你需要什么？",
  "request.form.descriptionHint": "40–4000 个字符。谁会使用、必须实现什么、你已经有哪些东西。",
  "request.form.category": "类别",
  "request.form.choose": "请选择…",
  "request.form.languages": "希望使用的工作语言",
  "request.form.emailHint": "我们会发送确认链接。在你确认之前，需求不会被发送。",
  "request.form.submit": "发布需求",
  "request.form.unavailable": "暂时无法在未登录时发布。请登录后发布需求。",
  "request.error.too_short": "请至少写 40 个字符。",
  "request.error.rateLimited": "你的网络发送的需求过多。请等待一小时后再试。",
  "request.error.dailyLimit": "每天最多可以发布 3 条需求。请明天再试。",
  "request.sent.body": "我们已向 {email} 发送确认链接。你确认后，需求才会送达 VNX.SI 团队。链接 15 分钟后失效。",
  "request.status.pending_verification": "等待邮箱确认",
  "request.status.submitted": "等待匹配",
  "request.status.matching": "已邀请开发者",
  "request.status.builder_selected": "已选定开发者",
  "request.status.rejected": "已退回",
  "request.status.expired": "已过期",
  "request.status.closed": "已关闭",
  "request.status.removed": "已移除",
  "request.page.submitted": "你通常会在 3 个工作日内收到方案。",
  "request.page.pending": "尚未发送。请确认邮箱，把需求发送给 VNX.SI 团队。你已登录，可以立即发送。",
  "request.page.rejected": "VNX.SI 团队退回了这条需求：",
  "request.page.expired": "这条需求开放 30 天未选择方案，已过期。",
  "request.page.closed": "这条需求已关闭。",
  "request.page.close": "关闭需求",
  "request.page.closeHint": "关闭后，受邀的开发者会知道需求已结束。",
  "request.page.postAnother": "发布另一条需求",
  "request.facts.category": "类别",
  "request.facts.languages": "语言",
  "request.facts.client": "发布者",
  "request.facts.submitted": "提交时间",
  "directory.request": "找不到合适的开发者？发布需求，VNX.SI 团队会为你邀请开发者。",
  "catalog.request": "没有合适的？发布需求，VNX.SI 团队会为你邀请开发者。",
  "landing.clients.request": "不想等？发布需求，VNX.SI 团队会人工为你匹配开发者。",
```

`zh-hant.ts`:

```ts
  "nav.me": "詢問與需求",
  "me.title": "詢問與需求",
  "auth.invalidLink.inquiryHint": "如果你正在確認一則詢問：請登入，打開「詢問與需求」並點擊「立即送出」。",
  "me.inquiries.title": "詢問",
  "me.requests.title": "需求",
  "me.requests.empty": "還沒有需求。",
  "request.cta": "發佈需求",
  "request.form.title": "發佈需求",
  "request.form.intro": "描述你的需求。VNX.SI 團隊會閱讀每則需求，並邀請最多五位開發者向你提交方案。開發者能看到你的名字，但永遠看不到你的電子郵件。",
  "request.form.titleField": "標題",
  "request.form.titleHint": "最多 120 個字元，例如「為三家美容院開發預約應用」。",
  "request.form.descriptionField": "你需要什麼？",
  "request.form.descriptionHint": "40–4000 個字元。誰會使用、必須做到什麼、你已經有哪些東西。",
  "request.form.category": "類別",
  "request.form.choose": "請選擇…",
  "request.form.languages": "希望使用的工作語言",
  "request.form.emailHint": "我們會寄送確認連結。在你確認之前，需求不會被送出。",
  "request.form.submit": "發佈需求",
  "request.form.unavailable": "暫時無法在未登入時發佈。請登入後發佈需求。",
  "request.error.too_short": "請至少寫 40 個字元。",
  "request.error.rateLimited": "你的網路送出的需求過多。請等待一小時後再試。",
  "request.error.dailyLimit": "每天最多可以發佈 3 則需求。請明天再試。",
  "request.sent.body": "我們已向 {email} 寄送確認連結。你確認後，需求才會送達 VNX.SI 團隊。連結 15 分鐘後失效。",
  "request.status.pending_verification": "等待電子郵件確認",
  "request.status.submitted": "等待媒合",
  "request.status.matching": "已邀請開發者",
  "request.status.builder_selected": "已選定開發者",
  "request.status.rejected": "已退回",
  "request.status.expired": "已過期",
  "request.status.closed": "已關閉",
  "request.status.removed": "已移除",
  "request.page.submitted": "你通常會在 3 個工作天內收到方案。",
  "request.page.pending": "尚未送出。請確認電子郵件，把需求送給 VNX.SI 團隊。你已登入，可以立即送出。",
  "request.page.rejected": "VNX.SI 團隊退回了這則需求：",
  "request.page.expired": "這則需求開放 30 天未選擇方案，已過期。",
  "request.page.closed": "這則需求已關閉。",
  "request.page.close": "關閉需求",
  "request.page.closeHint": "關閉後，受邀的開發者會知道需求已結束。",
  "request.page.postAnother": "發佈另一則需求",
  "request.facts.category": "類別",
  "request.facts.languages": "語言",
  "request.facts.client": "發佈者",
  "request.facts.submitted": "提交時間",
  "directory.request": "找不到合適的開發者？發佈需求，VNX.SI 團隊會為你邀請開發者。",
  "catalog.request": "沒有合適的？發佈需求，VNX.SI 團隊會為你邀請開發者。",
  "landing.clients.request": "不想等？發佈需求，VNX.SI 團隊會人工為你媒合開發者。",
```

`auth.invalidLink.requestHint` (Task 2) ghép `tr("nav.me")` và `tr("me.sendNow")` nên tự theo tên mới. Chỉ `inquiryHint` của M5 là chữ cứng (đã ghi nhận ở Task 2): bước này đổi nó cho khớp `nav.me`, không làm gì thêm.

Sửa `apps/web/test/auth/verify-page.test.ts:61` thành `expect(html).toContain("Nếu bạn đang xác nhận một yêu cầu: hãy đăng nhập, mở Yêu cầu và nhu cầu và bấm Gửi ngay.");`. Sửa `apps/web/test/me/inquiries.test.ts:100` thành `expect(header).toContain(`<a href="/zh-hant/me">${zhHant["nav.me"]}</a>`);` với `import zhHant from "../../src/i18n/messages/zh-hant.ts";` (xem cách `test/auth/request-verify.test.ts` nạp `vi`; dùng đúng kiểu import đó), để lần đổi tên sau không vỡ test. `test/auth/request-verify.test.ts:111` đọc `vi["nav.me"]` nên không cần sửa. Kiểm không còn test nào so chuỗi cũ: `grep -rn "My inquiries\|Yêu cầu của tôi\|我的咨询\|我的詢問" apps/web/test` → không còn dòng nào.

- [ ] **Step 2: Test form `/request` (fail)**

`apps/web/test/public/request-form.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findClientRequest, listClientRequests } from "../../src/db/requests.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../../src/http/turnstile.ts";
import { createPendingRequestAndMail } from "../../src/routes/request-form.tsx";
import { ensureUser, signIn } from "../fixtures.ts";
import { followMagicLink, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
let ipSeq = 0;
/** A fresh client IP per call keeps the per-IP limit out of the way unless a test means to hit it. */
const freshIp = () => `198.51.100.${(ipSeq++ % 250) + 1}`;
const post = (path: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}, env: Bindings = testEnv) =>
  app().request(formPost(path, fields, { "cf-connecting-ip": freshIp(), ...headers }), undefined, env);
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);

const valid = (overrides: Record<string, string | string[]> = {}) => ({
  title: "Booking app for three salons",
  description: "We need online booking with SMS reminders for three salons in Hanoi.",
  category: "booking",
  budgetBand: "2k-10k",
  deadline: "",
  languages: ["vi", "en"],
  name: "Minh Tran",
  ...overrides,
});
const signedOut = (email: string, overrides: Record<string, string | string[]> = {}) => valid({ email, [TURNSTILE_FIELD]: FAKE_TURNSTILE_PASS, ...overrides });
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];

describe("/request form (spec §5.7 step 1)", () => {
  beforeEach(() => clearOutbox());

  it("renders the form in each locale with the language checkboxes and Turnstile when signed out", async () => {
    const res = await get("/vi/request");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Đăng nhu cầu");
    expect(html).toContain('name="languages" value="zh"');
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/vi/request"');
  });

  it("prefills the name and hides e-mail and Turnstile when signed in", async () => {
    const { user, cookie } = await signIn("rf-in@vnx.si");
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Lan' WHERE id = ?1").bind(user.id).run();
    const html = await (await get("/request", cookie)).text();
    expect(html).toContain('value="Lan"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain("cf-turnstile");
  });

  it("submits straight away when signed in, tells the admins and lands on the request", async () => {
    const { user, cookie } = await signIn("rf-sub@vnx.si");
    const res = await post("/request", valid(), { cookie });
    expect(res.status).toBe(303);
    const [request] = await listClientRequests(testEnv.DB, user.id);
    expect(res.headers.get("location")).toBe(`/me/requests/${request!.id}?sent=1`);
    expect(request).toMatchObject({ status: "submitted", languages: ["en", "vi"], category: "booking", clientName: "Minh Tran", locale: "en" });
    expect(outbox.map((m) => m.to)).toEqual(["owner@vnx.si"]);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'request.submit' AND entity_id = ?1").bind(request!.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ category: "booking", languages: ["en", "vi"] });
  });

  it("creates an implicit account and a pending request when signed out; the link submits it", async () => {
    const res = await post("/zh-hans/request", signedOut(" New@Request.Example "));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("new@request.example");
    const user = await findUserByEmail(testEnv.DB, "new@request.example");
    expect(user).toMatchObject({ locale: "zh-Hans", last_login_at: null, display_name: null });
    const [pending] = await listClientRequests(testEnv.DB, user!.id);
    expect(pending?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("new@request.example");
    const done = await followMagicLink(app(), linkFrom(outbox[0]!.text));
    expect(done.headers.get("location")).toBe(`/zh-hans/me/requests/${pending!.id}`);
    expect((await findClientRequest(testEnv.DB, user!.id, pending!.id))?.status).toBe("submitted");
  });

  it("re-renders with errors and keeps what was typed", async () => {
    const res = await post("/request", signedOut("x@request.example", { title: "", description: "short", languages: ["vi"] }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("This field is required.");
    expect(html).toContain("Please write at least 40 characters.");
    expect(html).toContain(">short</textarea>");
    expect(html).toMatch(/name="languages" value="vi"[^>]*checked/);
    expect(await findUserByEmail(testEnv.DB, "x@request.example")).toBeNull();
  });

  it("treats a filled honeypot as success and creates nothing", async () => {
    const res = await post("/request", signedOut("bot@request.example", { website: "http://spam" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to bot@request.example"); // same page as success
    expect(await findUserByEmail(testEnv.DB, "bot@request.example")).toBeNull();
    expect(outbox).toEqual([]);
  });

  it("signed-in honeypot: redirects to /me and creates nothing", async () => {
    const { user, cookie } = await signIn("rf-hp@vnx.si");
    const res = await post("/request", valid({ website: "http://spam" }), { cookie });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toEqual([]);
  });

  it("refuses a failed Turnstile, and fails closed when Turnstile is not configured", async () => {
    expect((await post("/request", signedOut("t1@request.example", { [TURNSTILE_FIELD]: "nope" }))).status).toBe(400);
    expect((await post("/request", valid({ email: "t3@request.example" }))).status).toBe(400); // no token at all
    const unconfigured = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET: undefined } as Bindings;
    const res = await post("/request", signedOut("t2@request.example"), {}, unconfigured);
    expect(res.status).toBe(503);
    expect(await findUserByEmail(testEnv.DB, "t1@request.example")).toBeNull();
    expect(await findUserByEmail(testEnv.DB, "t2@request.example")).toBeNull();
    expect(await findUserByEmail(testEnv.DB, "t3@request.example")).toBeNull();
  });

  it("allows 3 requests a day per e-mail: signed in gets 429, signed out gets the same page and nothing new", async () => {
    const { user, cookie } = await signIn("rf-day@vnx.si");
    for (let i = 0; i < 3; i++) expect((await post("/request", valid(), { cookie })).status).toBe(303);
    const fourth = await post("/request", valid(), { cookie });
    expect(fourth.status).toBe(429);
    expect(await fourth.text()).toContain("You can post up to 3 requests a day.");
    expect(await listClientRequests(testEnv.DB, user.id)).toHaveLength(3);

    for (let i = 0; i < 3; i++) await post("/request", signedOut("day@request.example"));
    clearOutbox();
    const res = await post("/request", signedOut("day@request.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to day@request.example");
    expect(outbox).toEqual([]);
    const owner = await findUserByEmail(testEnv.DB, "day@request.example");
    expect(await listClientRequests(testEnv.DB, owner!.id)).toHaveLength(3);
  });

  it("limits a network to 10 well-formed requests an hour", async () => {
    const { cookie } = await signIn("rf-ip@vnx.si");
    const ip = { "cf-connecting-ip": "203.0.113.77" };
    for (let i = 0; i < 10; i++) await post("/request", valid({ title: "" }), { cookie, ...ip }); // invalid forms do not count
    const accounts = await Promise.all([0, 1, 2, 3].map((i) => signIn(`rf-ip-${i}@vnx.si`)));
    let last!: Response;
    for (let i = 0; i < 11; i++) last = await post("/request", valid(), { cookie: accounts[i % 4]!.cookie, ...ip });
    expect(last.status).toBe(429);
    expect(await last.text()).toContain("Too many requests from your network");
  });

  it("answers a suspended account's e-mail like success, creating and sending nothing", async () => {
    const user = await ensureUser("susp@request.example");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(user.id).run();
    const res = await post("/request", signedOut("susp@request.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("We sent a confirmation link to susp@request.example");
    expect(await listClientRequests(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toEqual([]);
  });

  // Turnstile's fake driver only works next to the fake mailer (M5), so no env both passes Turnstile and fails mail.
  // The signed-out tail is a separate exported function that takes the Mailer; break that one.
  it("deletes the pending request when the confirmation e-mail fails", async () => {
    const broken = {
      send: async () => {
        throw new Error("down");
      },
    };
    const client = await ensureUser("fail@request.example");
    const input = { title: "T", description: "d".repeat(40), category: "booking" as const, budgetBand: "unsure" as const, deadline: null, languages: ["en" as const], name: "N", email: "fail@request.example" };
    const before = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(await createPendingRequestAndMail(testEnv, { client, input, locale: "en", now: new Date() }, broken)).toBe("send_failed");
    expect(await listClientRequests(testEnv.DB, client.id)).toEqual([]);
    const after = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.create'").first<{ n: number }>();
    expect(after?.n).toBe(before?.n); // the audit row is written only after the e-mail went out
  });
});
```

Chạy: `npm test -w apps/web -- test/public/request-form.test.ts` → FAIL (không tìm thấy `routes/request-form.tsx`).

- [ ] **Step 3: View form và facts**

`apps/web/src/views/labels.ts` thêm:

```ts
import type { RequestStatus } from "../domain/request.ts";

export const REQUEST_STATUS_KEY: Record<RequestStatus, MessageKey> = {
  pending_verification: "request.status.pending_verification",
  submitted: "request.status.submitted",
  matching: "request.status.matching",
  builder_selected: "request.status.builder_selected",
  rejected: "request.status.rejected",
  expired: "request.status.expired",
  closed: "request.status.closed",
  removed: "request.status.removed",
};
```

`apps/web/src/views/RequestFacts.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { ClientRequest } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { builderFacingName } from "../domain/inquiry.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "./labels.ts";
import { PlainText } from "./PlainText.tsx";

/** The request as the client, the invited builders and the admin read it. Never shows an e-mail; `showClient` names the client the way a builder may see it. */
export const RequestFacts: FC<{ locale: Locale; request: ClientRequest; showClient?: boolean }> = ({ locale, request, showClient }) => {
  const tr = translator(locale);
  return (
    <>
      <dl class="facts">
        {showClient ? (
          <>
            <dt>{tr("request.facts.client")}</dt>
            <dd>{builderFacingName(request.clientName)}</dd>
          </>
        ) : null}
        <dt>{tr("request.facts.category")}</dt>
        <dd>{tr(CATEGORY_KEY[request.category])}</dd>
        <dt>{tr("thread.budget")}</dt>
        <dd>{tr(BUDGET_KEY[request.budgetBand])}</dd>
        {request.deadline ? (
          <>
            <dt>{tr("thread.deadline")}</dt>
            <dd>{request.deadline}</dd>
          </>
        ) : null}
        <dt>{tr("request.facts.languages")}</dt>
        <dd>{request.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</dd>
        {request.submittedAt ? (
          <>
            <dt>{tr("request.facts.submitted")}</dt>
            <dd>{request.submittedAt.slice(0, 10)}</dd>
          </>
        ) : null}
      </dl>
      <PlainText text={request.description} />
    </>
  );
};
```

`apps/web/src/views/RequestFormPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { WORK_LANGUAGES } from "../domain/builder.ts";
import { BUDGET_BANDS } from "../domain/inquiry.ts";
import { CATEGORIES } from "../domain/product.ts";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, type RequestErrors, type RequestFieldError, type RequestFormValues } from "../domain/request.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";

const ERROR_KEY: Record<RequestFieldError, MessageKey> = {
  required: "inquiry.error.required",
  too_short: "request.error.too_short",
  too_long: "inquiry.error.too_long",
  choice: "inquiry.error.choice",
  date: "inquiry.error.date",
  email: "inquiry.error.email",
  invalid: "inquiry.error.invalid",
};

type Props = {
  locale: Locale;
  origin: string;
  signedIn: boolean;
  values: RequestFormValues;
  errors: RequestErrors;
  /** null when signed out and Turnstile is not configured: the form is not offered (fail closed). */
  siteKey: string | null;
  formError?: string;
};

/** Spec §5.7 step 1. A public page (in the sitemap); the request itself is never public. */
export const RequestFormPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const title = tr("request.form.title");
  const err = (field: keyof RequestErrors) => {
    const code = p.errors[field];
    return code ? (
      <p id={`rq-${field}-error`} class="error-msg" role="alert">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: keyof RequestErrors) => (p.errors[field] ? { "aria-invalid": "true", "aria-describedby": `rq-${field}-error` } : {});
  const blocked = !p.signedIn && p.siteKey === null;
  return (
    <Layout locale={p.locale} title={`${title} · VNX.SI`} description={tr("request.form.intro")} origin={p.origin} rest="/request" signedIn={p.signedIn}>
      <section class="card wide">
        <h1>{title}</h1>
        <p>{tr("request.form.intro")}</p>
        {p.formError ? (
          <p class="error-msg" role="alert">
            {p.formError}
          </p>
        ) : null}
        {blocked ? (
          <p class="notice">
            {tr("request.form.unavailable")} <a href={localizedPath(p.locale, `/login?next=${encodeURIComponent(localizedPath(p.locale, "/request"))}`)}>{tr("nav.signIn")}</a>
          </p>
        ) : (
          <form method="post" action={localizedPath(p.locale, "/request")}>
            <div class="field">
              <label for="rq-title">{tr("request.form.titleField")}</label>
              <input id="rq-title" name="title" required maxlength={TITLE_MAX} value={p.values.title} {...aria("title")} />
              <p class="hint">{tr("request.form.titleHint")}</p>
              {err("title")}
            </div>
            <div class="field">
              <label for="rq-description">{tr("request.form.descriptionField")}</label>
              <textarea id="rq-description" name="description" required minlength={DESCRIPTION_MIN} maxlength={DESCRIPTION_MAX} {...aria("description")}>
                {p.values.description}
              </textarea>
              <p class="hint">{tr("request.form.descriptionHint")}</p>
              {err("description")}
            </div>
            <div class="field">
              <label for="rq-category">{tr("request.form.category")}</label>
              <select id="rq-category" name="category" required {...aria("category")}>
                <option value="">{tr("request.form.choose")}</option>
                {CATEGORIES.map((v) => (
                  <option value={v} selected={v === p.values.category}>
                    {tr(CATEGORY_KEY[v])}
                  </option>
                ))}
              </select>
              {err("category")}
            </div>
            <div class="field">
              <label for="rq-budget">{tr("inquiry.form.budget")}</label>
              <select id="rq-budget" name="budgetBand" required {...aria("budgetBand")}>
                {BUDGET_BANDS.map((b) => (
                  <option value={b} selected={b === p.values.budgetBand}>
                    {tr(BUDGET_KEY[b])}
                  </option>
                ))}
              </select>
              {err("budgetBand")}
            </div>
            <div class="field">
              <label for="rq-deadline">{tr("inquiry.form.deadline")}</label>
              <input id="rq-deadline" name="deadline" type="date" value={p.values.deadline} {...aria("deadline")} />
              {err("deadline")}
            </div>
            <fieldset class="field" {...aria("languages")}>
              <legend>{tr("request.form.languages")}</legend>
              {WORK_LANGUAGES.map((l) => (
                <label class="choice">
                  <input type="checkbox" name="languages" value={l} checked={p.values.languages.includes(l)} /> {tr(LANGUAGE_KEY[l])}
                </label>
              ))}
              {err("languages")}
            </fieldset>
            <div class="field">
              <label for="rq-name">{tr("inquiry.form.name")}</label>
              <input id="rq-name" name="name" required maxlength={80} autocomplete="name" value={p.values.name} {...aria("name")} />
              {err("name")}
            </div>
            {p.signedIn ? null : (
              <div class="field">
                <label for="rq-email">{tr("inquiry.form.email")}</label>
                <input id="rq-email" name="email" type="email" required autocomplete="email" value={p.values.email} {...aria("email")} />
                <p class="hint">{tr("request.form.emailHint")}</p>
                {err("email")}
              </div>
            )}
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div class="hp" aria-hidden="true">
              <label for="rq-website">{tr("inquiry.form.website")}</label>
              <input id="rq-website" name="website" tabindex={-1} autocomplete="off" value="" />
            </div>
            {p.signedIn ? null : (
              <>
                <div class="cf-turnstile" data-sitekey={p.siteKey ?? ""}></div>
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
              </>
            )}
            <button class="btn" type="submit">
              {tr("request.form.submit")}
            </button>
          </form>
        )}
      </section>
    </Layout>
  );
};

export const RequestSentPage: FC<{ locale: Locale; origin: string; email: string }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("inquiry.sent.title")} origin={p.origin} rest="/request" noindex>
      <section class="card" role="status">
        <h1>{tr("inquiry.sent.title")}</h1>
        <p>{tr("request.sent.body", { email: p.email })}</p>
      </section>
    </Layout>
  );
};
```


- [ ] **Step 4: Route `/request`**

`apps/web/src/routes/request-form.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { createLoginToken } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { createRequest, deletePendingRequestStatement } from "../db/requests.ts";
import { createUser, findUserByEmail, findUserById, type UserRow } from "../db/users.ts";
import {
  isRequestHoneypotFilled,
  parseRequestForm,
  REQUEST_DAILY_LIMIT_PER_EMAIL,
  REQUEST_HOURLY_LIMIT_PER_IP,
  requestValuesFromBody,
  type RequestErrors,
  type RequestFormValues,
  type RequestInput,
} from "../domain/request.ts";
import { getMailer } from "../email/index.ts";
import type { Mailer } from "../email/mailer.ts";
import { requestConfirmEmail } from "../email/templates/request.ts";
import type { AppEnv, Bindings } from "../env.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from "../http/turnstile.ts";
import { notifyRequestSubmitted } from "../notify/request.ts";
import { page } from "../views/render.ts";
import { RequestFormPage, RequestSentPage } from "../views/RequestFormPage.tsx";

const HOUR = 3600;
const DAY = 86400;

const emailKey = async (email: string) => `request:email:${await sha256Hex(email)}`;

function emptyValues(name: string): RequestFormValues {
  return { title: "", description: "", category: "", budgetBand: "unsure", deadline: "", languages: [], name, email: "", website: "" };
}

function formPage(c: Context<AppEnv>, values: RequestFormValues, errors: RequestErrors, status: 200 | 400 | 429 | 502 | 503 = 200, formError?: string) {
  return page(c, <RequestFormPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} values={values} errors={errors} siteKey={turnstileSiteKey(c.env)} formError={formError} />, status);
}

/**
 * Signed-out path after every check passed: the pending request, its confirmation link and e-mail. A failed e-mail
 * removes the request again (spec §8.3: the form says so). Exported for the mail-failure test.
 */
export async function createPendingRequestAndMail(
  env: Bindings,
  args: { client: UserRow; input: RequestInput; locale: Locale; now: Date },
  mailer: Mailer = getMailer(env),
): Promise<"sent" | "send_failed"> {
  const { client, input, locale, now } = args;
  const iso = now.toISOString();
  const request = await createRequest(env.DB, { clientUserId: client.id, clientName: input.name, title: input.title, description: input.description, category: input.category, budgetBand: input.budgetBand, deadline: input.deadline, languages: input.languages, status: "pending_verification", locale, now: iso });
  const token = await createLoginToken(env.DB, { email: client.email, purpose: "request_verify", locale, requestId: request.id }, now);
  const link = new URL("/auth/verify", env.APP_ORIGIN);
  link.searchParams.set("t", token);
  try {
    await mailer.send({ to: client.email, ...requestConfirmEmail(locale, { title: request.title, link: link.toString() }) });
  } catch (err) {
    console.error(JSON.stringify({ event: "request.confirm_mail_failed", requestId: request.id, error: String(err) }));
    await deletePendingRequestStatement(env.DB, request.id).run();
    return "send_failed";
  }
  await writeAudit(env.DB, { actorUserId: null, action: "request.create", entity: "request", entityId: request.id, data: { status: "pending_verification" }, now: iso });
  return "sent";
}

async function submitForm(c: Context<AppEnv>) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const user = c.get("user");
  const body = await c.req.parseBody({ all: true });
  const values = requestValuesFromBody(body);
  const sentPage = (email: string) => page(c, <RequestSentPage locale={locale} origin={siteOrigin(c)} email={email} />);

  // Honeypot: look like success, create nothing.
  if (isRequestHoneypotFilled(values)) return user ? c.redirect(localizedPath(locale, "/me"), 303) : sentPage(values.email.trim().toLowerCase());

  const now = new Date();
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const parsed = parseRequestForm(values, { needEmail: user === null, today: now.toISOString().slice(0, 10) });
  if (!parsed.ok) return formPage(c, values, parsed.errors, 400);
  // Only well-formed forms count (M5 F4).
  const byIp = await hitRateLimit(c.env.DB, `request:ip:${ip}`, REQUEST_HOURLY_LIMIT_PER_IP, HOUR, now.getTime());
  if (!byIp.allowed) return formPage(c, values, {}, 429, tr("request.error.rateLimited"));
  const input = parsed.input;
  const iso = now.toISOString();

  if (user) {
    // Spec §8.2: 3 requests a day per e-mail, the account's e-mail when signed in.
    const byEmail = await hitRateLimit(c.env.DB, await emailKey(user.email), REQUEST_DAILY_LIMIT_PER_EMAIL, DAY, now.getTime());
    if (!byEmail.allowed) return formPage(c, values, {}, 429, tr("request.error.dailyLimit"));
    const request = await createRequest(c.env.DB, { clientUserId: user.id, clientName: input.name, title: input.title, description: input.description, category: input.category, budgetBand: input.budgetBand, deadline: input.deadline, languages: input.languages, status: "submitted", locale, now: iso });
    await writeAudit(c.env.DB, { actorUserId: user.id, action: "request.submit", entity: "request", entityId: request.id, data: { category: request.category, languages: request.languages }, now: iso });
    await notifyRequestSubmitted(c.env, request.id);
    return c.redirect(localizedPath(locale, `/me/requests/${request.id}?sent=1`), 303);
  }

  const captcha = await verifyTurnstile(c.env, body[TURNSTILE_FIELD], ip === "unknown" ? null : ip);
  if (captcha === "unavailable") return formPage(c, values, {}, 503, tr("request.form.unavailable"));
  if (captcha === "fail") return formPage(c, values, {}, 400, tr("inquiry.error.captcha"));

  const email = input.email!;
  // Over the daily limit, or a suspended account: the same answer as success, nothing happens (no account status leak).
  const byEmail = await hitRateLimit(c.env.DB, await emailKey(email), REQUEST_DAILY_LIMIT_PER_EMAIL, DAY, now.getTime());
  if (!byEmail.allowed) return sentPage(email);
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing && existing.status !== "active") return sentPage(email);
  // Spec §5.7: an implicit account like an inquiry's; the daily job removes it if never confirmed.
  const client = existing ?? (await createUser(c.env.DB, { email, locale, now: iso }));
  const outcome = await createPendingRequestAndMail(c.env, { client, input, locale, now });
  if (outcome === "send_failed") return formPage(c, values, {}, 502, tr("inquiry.error.sendFailed"));
  return sentPage(email);
}

export function registerRequestFormRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/request", async (c) => {
    const user = c.get("user");
    const name = user ? ((await findUserById(c.env.DB, user.id))?.display_name ?? "") : "";
    return formPage(c, emptyValues(name), {});
  });
  onLocalized(app, "post", "/request", submitForm);
}
```

(`parseBody({ all: true })` trả `string | File | (string | File)[]`; `requestValuesFromBody` đã lọc chuỗi. `body[TURNSTILE_FIELD]` có thể là mảng nếu bị gửi lặp: `verifyTurnstile` coi mọi giá trị không phải chuỗi là `fail`.)

- [ ] **Step 5: `/me` và trang request**

`apps/web/src/views/me/RequestList.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { ClientRequest } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { REQUEST_STATUS_KEY } from "../labels.ts";

export const RequestList: FC<{ locale: Locale; items: ClientRequest[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  if (items.length === 0) return <p class="muted">{tr("me.requests.empty")}</p>;
  return (
    <div class="table-wrap">
      <table class="data">
        <tbody>
          {items.map((r) => (
            <tr>
              <td>
                <a href={localizedPath(locale, `/me/requests/${r.id}`)}>{r.title}</a>
              </td>
              <td>
                <span class={`badge badge-request-${r.status}`}>{tr(REQUEST_STATUS_KEY[r.status])}</span>
              </td>
              <td class="muted">{r.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

`apps/web/src/views/me/RequestPage.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import type { ClientRequest } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { REQUEST_STATUS_KEY } from "../labels.ts";
import { Layout } from "../Layout.tsx";
import { PlainText } from "../PlainText.tsx";
import { RequestFacts } from "../RequestFacts.tsx";

/** Spec §5.4: the client's request, its status and (Task 6) the proposals passed as children. */
export const RequestPage: FC<PropsWithChildren<{ locale: Locale; origin: string; request: ClientRequest; sent: boolean }>> = ({ locale, origin, request, sent, children }) => {
  const tr = translator(locale);
  const base = localizedPath(locale, `/me/requests/${request.id}`);
  const open = request.status === "submitted" || request.status === "matching";
  return (
    <Layout locale={locale} title={`${request.title} · VNX.SI`} origin={origin} rest={`/me/requests/${request.id}`} noindex signedIn>
      <p>
        <a href={localizedPath(locale, "/me")}>{tr("me.title")}</a>
      </p>
      <h1>{request.title}</h1>
      <p>
        <span class={`badge badge-request-${request.status}`}>{tr(REQUEST_STATUS_KEY[request.status])}</span>
      </p>
      {request.status === "pending_verification" ? (
        <div class="notice">
          <p>{tr("request.page.pending")}</p>
          <form method="post" action={`${base}/confirm`}>
            <button class="btn" type="submit">
              {tr("me.sendNow")}
            </button>
          </form>
        </div>
      ) : null}
      {open ? (
        <p class={sent ? "notice good" : "notice"} role={sent ? "status" : undefined}>
          {tr("request.page.submitted")}
        </p>
      ) : null}
      {request.status === "rejected" ? (
        <div class="notice">
          <p>{tr("request.page.rejected")}</p>
          {request.adminNote ? <PlainText text={request.adminNote} /> : null}
        </div>
      ) : null}
      {request.status === "expired" ? <p class="notice">{tr("request.page.expired")}</p> : null}
      {request.status === "closed" ? <p class="notice">{tr("request.page.closed")}</p> : null}
      <section class="card wide">
        <RequestFacts locale={locale} request={request} />
      </section>
      {children}
      {open ? (
        <form method="post" action={`${base}/close`}>
          <p class="hint">{tr("request.page.closeHint")}</p>
          <button class="link" type="submit">
            {tr("request.page.close")}
          </button>
        </form>
      ) : null}
      {!open && request.status !== "pending_verification" ? (
        <p>
          <a href={localizedPath(locale, "/request")}>{tr("request.page.postAnother")}</a>
        </p>
      ) : null}
    </Layout>
  );
};
```

`apps/web/src/routes/me-requests.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { endRequestBatch, findClientRequest } from "../db/requests.ts";
import { requestTransition, type ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInviteExpired, notifyNotSelected } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { RequestPage } from "../views/me/RequestPage.tsx";
import { page } from "../views/render.ts";
import { openPendingRequest } from "./request-confirm.ts";

/** The client's request page. Task 6 adds the proposals. `findClientRequest` already limits it to the owner and hides `removed`. */
export async function requestPage(c: Context<AppEnv>, request: ClientRequest, status: 200 | 400 = 200) {
  return page(c, <RequestPage locale={c.get("locale")} origin={requestOrigin(c)} request={request} sent={c.req.query("sent") === "1"} />, status);
}

async function load(c: Context<AppEnv>): Promise<ClientRequest | null> {
  return findClientRequest(c.env.DB, c.get("user")!.id, c.req.param("id") ?? "");
}

export function registerMeRequestRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me/requests/:id", requireUser, async (c) => {
    const request = await load(c);
    return request ? requestPage(c, request) : errorResponse(c, "notFound", 404);
  });

  // "Send now": the session proves the e-mail, same rule as the link (domain "verify"). openPendingRequest does not check
  // who owns the request (Task 2 review), so it is checked here first: someone else's, removed or missing = 404, nothing written.
  onLocalized(app, "post", "/me/requests/:id/confirm", requireUser, async (c) => {
    const user = c.get("user")!;
    const request = await load(c);
    if (!request || request.clientUserId !== user.id) return errorResponse(c, "notFound", 404);
    if (request.status !== "pending_verification") return errorResponse(c, "conflict", 409);
    if (!(await openPendingRequest(c, request, user, new Date(), "me"))) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });

  // Spec §7.5: the client closes a submitted or matching request; invitations settle in the same batch.
  onLocalized(app, "post", "/me/requests/:id/close", requireUser, async (c) => {
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    if (!requestTransition(request.status, "close", "client").ok) return errorResponse(c, "conflict", 409);
    const iso = new Date().toISOString();
    const end = endRequestBatch(c.env.DB, { id: request.id, from: request.status, to: "closed", now: iso });
    const results = await c.env.DB.batch([
      ...end.statements,
      auditStatement(c.env.DB, { actorUserId: c.get("user")!.id, action: "request.close", entity: "request", entityId: request.id, data: { from: request.status }, now: iso }, { requestId: request.id, status: "closed", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) return errorResponse(c, "conflict", 409);
    // Proposals that were not selected and invitations that lapsed each get their own neutral e-mail.
    await notifyNotSelected(c.env, outcome.notSelected);
    await notifyInviteExpired(c.env, outcome.expired);
    return c.redirect(localizedPath(c.get("locale"), `/me/requests/${request.id}`), 303);
  });
}
```

Trong `apps/web/src/routes/me.tsx` (import thêm `listClientRequests` từ `../db/requests.ts`, `RequestList` từ `../views/me/RequestList.tsx`), GET `/me` nạp cả hai danh sách và hiện hai mục:

```tsx
    const user = c.get("user")!;
    const [inquiries, requests] = await Promise.all([listClientInquiries(c.env.DB, user.id), listClientRequests(c.env.DB, user.id)]);
    return page(
      c,
      <Layout locale={locale} title={`${tr("me.title")} · VNX.SI`} origin={requestOrigin(c)} rest="/me" noindex signedIn>
        <h1>{tr("me.title")}</h1>
        <section>
          <h2>{tr("me.requests.title")}</h2>
          <RequestList locale={locale} items={requests} />
          <p>
            <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
        </section>
        <section>
          <h2>{tr("me.inquiries.title")}</h2>
          <InquiryList locale={locale} items={inquiries} viewer="client" base="/me/inquiries" />
        </section>
      </Layout>,
    );
```

Trong `apps/web/src/app.ts`: `registerRequestFormRoutes(app)` (đặt cạnh `registerInquiryFormRoutes`) và `registerMeRequestRoutes(app)` (cạnh `registerMeRoutes`).

- [ ] **Step 6: Test `/me` (fail rồi pass)**

`apps/web/test/me/requests.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { inviteBuilders, makeBuilder, makeInquiry, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("/me requests (spec §5.4)", () => {
  beforeEach(() => clearOutbox());

  it("lists requests and inquiries on /me", async () => {
    // Same tag: makeRequest and makeInquiry both use the client <tag>-c@vnx.si.
    const { client, request } = await makeRequest({ tag: "mr-list" });
    const inquiry = await makeInquiry({ tag: "mr-list", status: "open" });
    const { cookie } = await signIn(client.email);
    const html = await (await get("/me", cookie)).text();
    expect(html).toContain(`href="/me/requests/${request.id}"`);
    expect(html).toContain(request.title);
    expect(html).toContain(`href="/me/inquiries/${inquiry.inquiry.id}"`);
    expect(html).toContain('href="/request"');
  });

  it("shows the request with the 3-day note; 404 for someone else's or a removed one", async () => {
    const mine = await makeRequest({ tag: "mr-page" });
    const other = await makeRequest({ tag: "mr-page2" });
    const { cookie } = await signIn(mine.client.email);
    const res = await get(`/me/requests/${mine.request.id}?sent=1`, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("You usually get proposals within 3 business days.");
    expect(html).toContain("We need online booking with SMS reminders");
    expect((await get(`/me/requests/${other.request.id}`, cookie)).status).toBe(404);
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(mine.request.id).run();
    expect((await get(`/me/requests/${mine.request.id}`, cookie)).status).toBe(404);
  });

  it("sends a pending request now, once", async () => {
    const { client, request } = await makeRequest({ tag: "mr-now", status: "pending_verification" });
    const { cookie } = await signIn(client.email);
    expect(await (await get(`/me/requests/${request.id}`, cookie)).text()).toContain(`action="/me/requests/${request.id}/confirm"`);
    const res = await post(`/vi/me/requests/${request.id}/confirm`, cookie);
    expect(res.headers.get("location")).toBe(`/vi/me/requests/${request.id}`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    expect(outbox.filter((m) => m.to === "owner@vnx.si")).toHaveLength(1);
    expect((await post(`/me/requests/${request.id}/confirm`, cookie)).status).toBe(409);
    expect(outbox.filter((m) => m.to === "owner@vnx.si")).toHaveLength(1);
  });

  it("closes a matching request: invitations expire, proposals are not selected and their builders are told; once only", async () => {
    const { client, request } = await makeRequest({ tag: "mr-close" });
    const a = await makeBuilder("mr-close-a@vnx.si", "mr-close-a", "approved");
    const b = await makeBuilder("mr-close-b@vnx.si", "mr-close-b", "approved");
    const [ia] = await inviteBuilders(request, [a, b]);
    await proposeOn(ia!);
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("closed");
    const statuses = (await listRequestInvites(testEnv.DB, request.id)).map((x) => x.invite.status);
    expect(statuses).toEqual(["not_selected", "expired"]);
    // A's proposal was not selected, B's invitation lapsed: each builder gets one e-mail, and none shows the client's e-mail.
    expect(outbox.map((m) => m.to).sort()).toEqual(["mr-close-a@vnx.si", "mr-close-b@vnx.si"]);
    expect(outbox.every((m) => !m.text.includes(client.email))).toBe(true);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(2);
  });

  it("lets the owner close a submitted request: 303, nobody to e-mail; a pending one cannot be closed (409)", async () => {
    const { client, request } = await makeRequest({ tag: "mr-close-sub" });
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("closed");
    expect(outbox).toEqual([]);
    const pending = await makeRequest({ tag: "mr-close-pend", status: "pending_verification" });
    const other = await signIn(pending.client.email);
    expect((await post(`/me/requests/${pending.request.id}/close`, other.cookie)).status).toBe(409);
    expect((await findRequestById(testEnv.DB, pending.request.id))?.status).toBe("pending_verification");
  });

  it("does not let another client close a request", async () => {
    const { request } = await makeRequest({ tag: "mr-other" });
    const { cookie } = await signIn("mr-other-x@vnx.si");
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(404);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
  });

  // Task 2 review: openPendingRequest does not check the owner, so "Send now" must (404, nothing written).
  it("does not let another user send someone else's pending request: 404, no e-mail, no audit row, still pending", async () => {
    const { request } = await makeRequest({ tag: "mr-own", status: "pending_verification" });
    const { cookie } = await signIn("mr-own-x@vnx.si");
    expect((await post(`/me/requests/${request.id}/confirm`, cookie)).status).toBe(404);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toEqual([]);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'request' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(0);
    expect((await post("/me/requests/does-not-exist/confirm", cookie)).status).toBe(404);
  });
});
```

Chạy: `npm test -w apps/web -- test/me/requests.test.ts` → FAIL trước khi có route (404 ở `/me/requests/...`); sau Step 4–5: `npm test -w apps/web -- test/public/request-form.test.ts test/me/requests.test.ts test/me/inquiries.test.ts` → PASS.

- [ ] **Step 7: Lối vào, sitemap, Privacy**

- `apps/web/src/views/DirectoryPage.tsx`: bỏ câu "No "Post a request" button until /request exists…" trong doc comment; ngay sau `<h1>` thêm:

```tsx
      <p class="cta-row">
        {tr("directory.request")}{" "}
        <a class="btn btn-secondary" href={localizedPath(locale, "/request")}>
          {tr("request.cta")}
        </a>
      </p>
```

- `apps/web/src/views/CatalogPage.tsx`: bỏ câu tương tự trong doc comment; trạng thái rỗng thành:

```tsx
        <div class="notice">
          <p>{tr("catalog.empty")}</p>
          <p>
            {tr("catalog.request")} <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
        </div>
```

- `apps/web/src/views/LandingPage.tsx`, khối `#notify`, ngay sau `<p>{tr("landing.clients.body")}</p>` (Owner 2026-10-04: link phụ, giữ waitlist):

```tsx
          <p>
            {tr("landing.clients.request")} <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
```

- `apps/web/src/routes/seo.ts`: thêm `{ rest: "/request", localized: true },` sau `/builders`.
- `apps/web/src/legal/content.ts`: xem "Privacy" bên dưới.

Sửa test cũ và thêm test (viết trước khi sửa code ở trên nếu chưa làm; chạy thấy FAIL rồi mới sửa):
- `test/seo/sitemap.test.ts` (dòng 29): thay `expect(xml).not.toContain("/request");` bằng `expect(xml).toContain("<loc>https://vnx.si/vi/request</loc>");` và thêm `expect(xml).not.toContain("/me/requests");` (request không bao giờ có trang công khai).
- `test/public/builders-page.test.ts` (dòng 21): thay `expect(html).not.toContain("/request");` bằng `expect(html).toContain('href="/request"');`.
- `test/public/products-page.test.ts`: chưa có test trạng thái rỗng; thêm trong `describe("/products …")`:

```ts
  it("offers to post a request when nothing matches", async () => {
    const html = await (await get("/products?q=zzznomatchzzz")).text();
    expect(html).toContain("No products match yet.");
    expect(html).toContain('href="/request"');
  });
```

- `test/landing/page.test.ts`: thêm (dùng `get`, `mainOf` đã có trong file):

```ts
  it("links to /request next to the waitlist form without replacing it (Owner 2026-10-04)", async () => {
    const main = mainOf(await (await get("/vi")).text());
    expect(main).toMatch(/<section id="notify"[\s\S]*href="\/vi\/request"[\s\S]*<form method="post" action="\/vi\/waitlist#notify"/);
  });
```

  Test AC4 cũ của file đó ("không có chữ số trong `<main>`", không link `/products|/builders`) vẫn phải xanh: `landing.clients.request` ở 4 locale không có chữ số và `/request` không khớp regex đó.

**Privacy.** `docs/legal/privacy.md` (đã áp ở Step 0) có phần EN và VI của M6; `test/legal/content.test.ts` so từng dòng của hai phần `## EN` và `## VI` với trang `/privacy` và `/vi/privacy`. Chạy trước: `npm test -w apps/web -- test/legal/content.test.ts` → FAIL ở `privacy EN` và `privacy VI` (thiếu dòng "Requests:" / "Nhu cầu (request):"). Sửa `apps/web/src/legal/content.ts` đúng như dưới đây, chép nguyên văn (đối chiếu `git show 953fa21 -- docs/legal/privacy.md` nếu nghi ngờ). Mỗi mục là một chuỗi trong mảng `ul` đã có; `**…**` giữ nguyên như các dòng quanh nó. `LEGAL_UPDATED_AT` không đổi (`953fa21` không đổi `{date}`). `zh-Hans`, `zh-Hant` dùng văn bản EN nên không cần sửa riêng.

`privacyEn`:
1. Mục 2, ngay sau dòng bắt đầu `"**Inquiries:** when you contact a builder`, thêm hai chuỗi:
   - `"**Requests:** when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email."`
   - `"**Proposals:** if you are a builder and we invite you to a request, the approach, price, timeline and notes you send, or that you declined."`
2. Mục 2, dòng `**Bot check:**` thành: `"**Bot check:** when you send an inquiry or a request without signing in, Cloudflare Turnstile checks that you are a person. Cloudflare receives your IP address and information from your browser for this check."`
3. Mục 3, ngay sau dòng `"To pass inquiries and replies between clients and builders…"`, thêm: `"To match requests with builders: our team reads each request and invites up to five builders, who see the request and send proposals; when you pick a proposal we start an inquiry between you and that builder with the request and the proposal as the first message."`
4. Mục 4, dòng `"Builders do not see clients' email addresses. …"` thành: `"Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request."`
5. Mục 6, ngay sau dòng `"Inquiries and their messages: …"`, thêm: `"Requests and proposals: while your account exists, under the same rule as your account below. Requests you never confirmed: deleted after 48 hours."`

`privacyVi`:
1. Mục 2, ngay sau dòng `"**Yêu cầu (Inquiry):** …"`, thêm:
   - `"**Nhu cầu (request):** khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email."`
   - `"**Đề xuất:** nếu bạn là builder và được mời vào một nhu cầu, cách làm, giá, thời gian và ghi chú bạn gửi, hoặc việc bạn từ chối."`
2. Dòng `**Kiểm tra chống bot:**` thành: `"**Kiểm tra chống bot:** khi bạn gửi yêu cầu hoặc nhu cầu mà chưa đăng nhập, Cloudflare Turnstile kiểm tra bạn là người thật. Cloudflare nhận địa chỉ IP và thông tin từ trình duyệt của bạn để kiểm tra."`
3. Mục 3, ngay sau dòng `"Chuyển yêu cầu và trả lời giữa client và builder, …"`, thêm: `"Ghép nhu cầu với builder: đội ngũ của chúng tôi đọc từng nhu cầu và mời tối đa năm builder; các builder đó xem nhu cầu và gửi đề xuất; khi bạn chọn một đề xuất, chúng tôi mở một yêu cầu giữa bạn và builder đó với nội dung nhu cầu và đề xuất làm tin nhắn đầu tiên."`
4. Mục 4, dòng `"Builder không thấy email của client. …"` thành: `"Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó."`
5. Mục 6, ngay sau dòng `"Yêu cầu và tin nhắn: …"`, thêm: `"Nhu cầu và đề xuất: trong thời gian tài khoản tồn tại, theo cùng quy tắc với tài khoản bên dưới. Nhu cầu bạn chưa xác nhận: xóa sau 48 giờ."`

Chạy: `npm test -w apps/web -- test/seo test/public test/landing test/legal` → PASS.

- [ ] **Step 8: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/routes/request-form.tsx apps/web/src/routes/me-requests.tsx apps/web/src/routes/me.tsx apps/web/src/routes/seo.ts apps/web/src/app.ts apps/web/src/views/RequestFormPage.tsx apps/web/src/views/RequestFacts.tsx apps/web/src/views/me/RequestPage.tsx apps/web/src/views/me/RequestList.tsx apps/web/src/views/labels.ts apps/web/src/views/DirectoryPage.tsx apps/web/src/views/CatalogPage.tsx apps/web/src/views/LandingPage.tsx apps/web/src/legal/content.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/public/request-form.test.ts apps/web/test/me/requests.test.ts apps/web/test/seo/sitemap.test.ts apps/web/test/public/builders-page.test.ts apps/web/test/public/products-page.test.ts apps/web/test/landing/page.test.ts apps/web/test/auth/verify-page.test.ts apps/web/test/me/inquiries.test.ts
git commit -m "feat(web): post a request form, client request pages and entry points (VNX-0602b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Kiểm cuối (mỗi dòng phải đúng):
- `git status --short` không còn file nào ngoài `.claude/`.
- `grep -rn "notifyAdminsOfRequest" apps/web` → không có dòng nào.
- `npm test -w apps/web -- test/architecture.test.ts test/i18n` xanh (ranh giới module, `requests` chỉ ghi từ `db/requests.ts`, 4 locale đủ key).
---

### Task 4: VNX-0603 — Admin: hàng chờ request, gợi ý builder, mời ≤ 5, trả về, spam

**Quyết định kỹ thuật (Reviewer kiểm):**
- **Admin thấy tên và email client** (spec 5.5; admin không phải bề mặt hướng builder): trang admin in `clientName` nguyên văn cùng `clientEmail`, và dùng `RequestFacts` **không** bật `showClient` (nếu bật, tên bị `builderFacingName` che). Task này không có view nào builder đọc được, nên không gọi `builderFacingName`; Task 5 dùng `RequestFacts showClient`.
- **Hàng chờ:** mặc định chỉ `submitted` (hàng chờ của spec 5.5); `?status=all` = mọi trạng thái; `?status=<trạng thái>` lọc; giá trị lạ về mặc định. Thứ tự: cũ nhất trước (`COALESCE(submitted_at, created_at)`).
- **Mời:** form gồm checkbox `builder` (từ 10 gợi ý) và một ô `handle` tùy chọn (handle công khai bất kỳ, kể cả builder `closed`: quyết định ở header plan). Route chỉ kiểm nhanh (trạng thái, form, "nhiều hơn số suất còn lại" → 400); **câu `INSERT` trong `inviteBuildersBatch` mới là chốt chặn thật** (trùng, chính client, builder không `approved` / user bị khóa, request không còn `submitted` | `matching`, đã đủ 5). Quy ước phản hồi: ≥ 1 lời mời được chèn → 303 `?done=1`; không chèn được dòng nào (trùng, chính client, không đủ điều kiện, request vừa đóng, thua đua về giới hạn) → 409 và không ghi gì (kể cả audit, vì `outcome.request` là null); lỗi form → 400. Chèn một phần (một số builder bị bỏ qua) vẫn 303, admin thấy kết quả thật ở bảng lời mời.
- **Sửa nhỏ Task 1 (Review Focus 3):** câu `move` của `inviteBuildersBatch` chỉ tính các id do chính batch sinh ra (thay vì "có lời mời nào `invited_at = now`"). Nếu không, hai POST rơi cùng một mili giây thì POST không chèn được dòng nào vẫn thấy lời mời của POST kia, nhận `request` khác null và trả 303 thay vì 409. Audit `request.invite` dùng guard riêng `{ requestId, inviteIds }` (xem `db/audit.ts`): chỉ ghi khi chính batch này đã chèn ít nhất một trong các id của nó, nên batch thua đua không ghi gì, kể cả khi cùng mili giây. `inviteBuildersBatch(...)` trả thêm `inviteIds` (các id sinh sẵn).
- **Handle không công khai** (builder bị khóa, user bị khóa, `pending`, không tồn tại) cho cùng một lỗi 400 `handle` (không lộ lý do). Checkbox giả mạo trỏ tới builder không đủ điều kiện được DB chặn (409, test bên dưới).
- **Email sau khi commit:** mời → `notifyInvited(env, outcome.invited.map(id))` trả `NotifyTally`; `failed > 0` → `?done=mail_failed`. Trả về / spam đi qua `endRequestBatch`; sau khi batch thắng: `notifyNotSelected(notSelected)` và `notifyInviteExpired(expired)` (Owner 2026-10-04: thư "không được chọn" vẫn gửi khi request kết thúc vì spam); trả về còn `notifyRequestRejected` (client nhận lý do). Spam không báo client. Lỗi email không bao giờ làm mất thay đổi trạng thái; trả về hiện `?done=mail_failed` nếu thư client không `"sent"` hoặc `failed > 0` ở hai tally; spam chỉ ghi log (nằm trong `notify/request.ts`).
- **`listCandidates`:** lọc đủ điều kiện ở SQL (spec 8.10: `approved`, user `active`, availability ≠ `closed`, không phải client, chưa được mời); **chấm điểm chỉ ở `suggestBuilders`** (thuần, hòa điểm theo handle: ADR-004, không tham số trả tiền). SQL lấy tối đa 1000 builder sắp theo `user_id` (quy mô Wave 1; nếu vượt thì phải đổi cách lấy, ghi vào "Ghi nhận").
- **Điểm trừ (Owner 2026-10-04):** chỉ đếm lời mời đã **lapsed** (không trả lời trong 7 ngày): `status = 'expired' AND julianday(updated_at) - julianday(invited_at) >= 7`, trong cửa sổ 60 ngày theo `invited_at`. Lời mời hết hạn sớm vì request kết thúc không bị đếm.
- **Gỡ request `builder_selected`** (Owner xác nhận 2026-10-04): Inquiry đã tạo vẫn giữ.
- **Thứ tự danh sách:** `submitted` và `matching` cũ nhất trước; mọi bộ lọc khác, kể cả `all`, `updated_at DESC, id DESC`.
- **Số "đã trả lời"** mỗi request (spec 5.5): đếm lời mời `proposed`, `selected`, `not_selected`, `declined` (`AdminRequest.proposals` giữ nguyên tên nhưng mang nghĩa này).
- **Ghi nhận:** giới hạn 1000 builder của `listCandidates` sắp theo `user_id` ASC nên bỏ builder MỚI nhất trước (ảnh hưởng cả test).
- **Cách ly dữ liệu giữa các file test:** `apps/web/vitest.config.ts` dùng `cloudflareTest` (pool-workers 0.22, vitest 4) với một D1 chung; `test/apply-migrations.ts` chỉ chạy migration, không xóa dữ liệu, và mọi test hiện có dùng tiền tố `tag` riêng, không test nào khẳng định số đếm toàn cục. Plan này coi D1 là **dùng chung giữa các file và giữa các test**: test gợi ý chọn từ khóa riêng chỉ builder của test mới khớp, chỉ khẳng định thứ tự tương đối giữa builder của chính nó và việc builder không đủ điều kiện vắng mặt (đúng dù D1 có được cách ly hay không).
- **Cỡ (kể cả bổ sung sau review, ≈ 850 dòng chấp nhận):** code chạy được ≈ 480 dòng không tính locale, test ≈ 340 dòng (giống Task 3). Nếu Reviewer muốn nhỏ hơn, tách tại ranh giới 4a (db, view, danh sách + chi tiết + gợi ý, Step 1–5) và 4b (ba route POST, Step 6, cùng test Review Focus 3); không bắt buộc.

**Files:**
- Create: `apps/web/src/routes/admin-requests.tsx`, `apps/web/src/views/admin/RequestsPage.tsx`, `apps/web/src/views/admin/RequestDetailPage.tsx`, `apps/web/src/views/proposal.ts`
- Modify: `apps/web/src/db/requests.ts` (`listRequestsForAdmin`, `findAdminRequest`, `listCandidates`; siết câu `move` của `inviteBuildersBatch`), `apps/web/src/views/admin/AdminLayout.tsx` (mục `requests`), `apps/web/src/views/labels.ts` (`INVITE_STATUS_KEY`), `apps/web/src/app.ts`, `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: tạo `apps/web/test/admin/requests.test.ts`, `apps/web/test/views/proposal.test.ts`; sửa `apps/web/test/db/requests.test.ts` (một test điểm trừ)

**Interfaces:**
- Consumes (tên thật trong code):
  - `domain/request.ts`: `AdminRequest`, `Candidate`, `Suggestion`, `SuggestionReason`, `InviteWithBuilder`, `RequestInvite`, `ClientRequest`, `RequestStatus`, `REQUEST_STATUSES`, `TerminalRequestStatus`, `InviteStatus`, `requestTransition`, `suggestBuilders` (mặc định `SUGGESTION_LIMIT` = 10), `parseAdminNote` (`{ ok: true, note } | { ok: false, error }`), `MAX_ACTIVE_INVITES`, `EXPIRED_PENALTY_WINDOW_MS`.
  - `db/requests.ts`: `inviteBuildersBatch(db, { requestId, builderIds, invitedBy, now })` → `{ statements, read(results) → { request, invited: { id, builderId }[] } }`; `endRequestBatch(db, { id, from, to, now, adminNote? })` → `{ statements, read(results) → { request, notSelected: string[], expired: string[] } }`; `listRequestInvites(db, requestId)` (thứ tự `invited_at, rowid`); `toRequest`, `Row` (cục bộ trong file); `db/builders.ts`: `jsonList`, `findPublicBuilderByHandle`; `db/audit.ts`: `auditStatement(db, input, { requestId, status, updatedAt })`.
  - `notify/request.ts`: `notifyInvited(env, ids): Promise<NotifyTally>`, `notifyNotSelected(env, ids)` và `notifyInviteExpired(env, ids)` (cùng trả `NotifyTally { sent, failed }`), `notifyRequestRejected(env, requestId): Promise<NotifyOutcome>` (`"sent" | "failed" | "skipped"`; chỉ gửi khi request đang `rejected` và có `adminNote`).
  - Task 3: `views/RequestFacts.tsx` (`RequestFacts: FC<{ locale; request; showClient? }>`), `views/labels.ts` (`REQUEST_STATUS_KEY`, `CATEGORY_KEY`); M2–M5: `requireAdmin`, `HANDLE_RE` (`domain/builder-input.ts`), `onLocalized`, `requestOrigin`, `page`, `errorResponse`, `PlainText`, `formatUsd`, `AdminLayout`.
  - Fixtures (`test/fixtures.ts`): `makeRequest({ tag, status?, category?, languages?, title?, description? })` (client `<tag>-c@vnx.si`, tên "Minh Tran"), `makeBuilder(email, handle, status, overrides)`, `addLiveProduct(builder, name, { fields })`, `inviteBuilders(request, builders)`, `proposeOn(invite)`, `ensureUser`, `signIn(email, { admin })`; helpers `formPost`, `getReq`, `testEnv`; `clearOutbox`, `outbox` (`email/fake.ts`).
- Produces:
  - `db/requests.ts`: `listRequestsForAdmin(db, status | null, limit?)` → `AdminRequest[]`, `findAdminRequest(db, id)` → `AdminRequest | null`, `listCandidates(db, request: Pick<ClientRequest, "id" | "clientUserId" | "category">, penaltySince: string, limit?)` → `Candidate[]`.
  - `views/proposal.ts`: `proposalPrice(locale, invite: Pick<RequestInvite, "priceCents" | "priceMaxCents">)` → `"$4,500"` | `"$3,000 – $5,000"` | `"To discuss"` (Task 5, 6 dùng lại).
  - `views/labels.ts`: `INVITE_STATUS_KEY: Record<InviteStatus, MessageKey>` (Task 5 dùng lại).
  - `routes/admin-requests.tsx`: `registerAdminRequestRoutes(app)`; route `GET /admin/requests`, `GET /admin/requests/:id`, `POST /admin/requests/:id/invite`, `POST /admin/requests/:id/reject`, `POST /admin/requests/:id/remove` (mọi tiền tố locale).
  - Key i18n dùng chung với Task 5, 6: `invite.status.*`, `proposal.approach|price|price.discuss|price.range|timeline|days|note`.

- [ ] **Step 1: Chuỗi i18n**

`en.ts`:

```ts
  "admin.nav.requests": "Requests",
  "admin.requests.title": "Title",
  "admin.requests.invites": "Invitations",
  "admin.requests.invitedAt": "Invited",
  "admin.requests.proposals": "Proposals",
  "admin.requests.count": "{active} active · {total} in all",
  "admin.requests.suggestions": "Suggested builders",
  "admin.requests.suggestionsHint": "Rules: +3 product in this category, +1 per matching skill (max 3), +1 shared language, +1 open, −1 per expired invitation in 60 days. Nobody pays to appear here.",
  "admin.requests.noCandidates": "No eligible builders.",
  "admin.requests.score": "Score",
  "admin.requests.reason.category": "product in this category +3",
  "admin.requests.reason.skill": "skill “{skill}” +1",
  "admin.requests.reason.language": "shared language +1",
  "admin.requests.reason.open": "open +1",
  "admin.requests.reason.expired": "{n} expired −{n}",
  "admin.requests.handle": "Or invite by handle",
  "admin.requests.invite": "Invite",
  "admin.requests.slots": "{n} of 5 invitation slots free.",
  "admin.requests.full": "All 5 invitation slots are in use.",
  "admin.requests.error.none": "Choose at least one builder.",
  "admin.requests.error.too_many": "That is more builders than the free slots.",
  "admin.requests.error.handle": "No public builder has that handle.",
  "admin.requests.reject": "Return to client",
  "admin.requests.note": "Reason (the client sees it)",
  "admin.requests.error.note": "Write a reason of 1–1000 characters.",
  "admin.requests.remove": "Mark as spam (remove)",
  "admin.requests.mailFailed": "Saved, but some emails couldn't be sent.",
  "invite.status.invited": "Invited",
  "invite.status.proposed": "Proposal sent",
  "invite.status.selected": "Chosen",
  "invite.status.not_selected": "Not chosen",
  "invite.status.declined": "Declined",
  "invite.status.expired": "Expired",
  "proposal.approach": "Approach",
  "proposal.price": "Price",
  "proposal.price.discuss": "To discuss",
  "proposal.price.range": "{min} – {max}",
  "proposal.timeline": "Timeline",
  "proposal.days": "{n} days",
  "proposal.note": "Price note",
```

`vi.ts`:

```ts
  "admin.nav.requests": "Nhu cầu",
  "admin.requests.title": "Tiêu đề",
  "admin.requests.invites": "Lời mời",
  "admin.requests.invitedAt": "Ngày mời",
  "admin.requests.proposals": "Đề xuất",
  "admin.requests.count": "{active} đang mở · tổng {total}",
  "admin.requests.suggestions": "Builder gợi ý",
  "admin.requests.suggestionsHint": "Luật: +3 có sản phẩm cùng danh mục, +1 mỗi kỹ năng khớp (tối đa 3), +1 chung ngôn ngữ, +1 đang nhận việc, −1 mỗi lời mời hết hạn trong 60 ngày. Không ai trả tiền để có mặt ở đây.",
  "admin.requests.noCandidates": "Không có builder nào đủ điều kiện.",
  "admin.requests.score": "Điểm",
  "admin.requests.reason.category": "có sản phẩm cùng danh mục +3",
  "admin.requests.reason.skill": "kỹ năng “{skill}” +1",
  "admin.requests.reason.language": "chung ngôn ngữ +1",
  "admin.requests.reason.open": "đang nhận việc +1",
  "admin.requests.reason.expired": "{n} lời mời hết hạn −{n}",
  "admin.requests.handle": "Hoặc mời theo handle",
  "admin.requests.invite": "Mời",
  "admin.requests.slots": "Còn {n}/5 suất mời.",
  "admin.requests.full": "Đã dùng hết 5 suất mời.",
  "admin.requests.error.none": "Hãy chọn ít nhất một builder.",
  "admin.requests.error.too_many": "Số builder vượt quá số suất còn lại.",
  "admin.requests.error.handle": "Không có builder công khai nào có handle này.",
  "admin.requests.reject": "Trả về cho client",
  "admin.requests.note": "Lý do (client sẽ thấy)",
  "admin.requests.error.note": "Hãy ghi lý do dài 1–1000 ký tự.",
  "admin.requests.remove": "Đánh dấu spam (gỡ)",
  "admin.requests.mailFailed": "Đã lưu, nhưng một số email chưa gửi được.",
  "invite.status.invited": "Đã mời",
  "invite.status.proposed": "Đã gửi đề xuất",
  "invite.status.selected": "Được chọn",
  "invite.status.not_selected": "Không được chọn",
  "invite.status.declined": "Đã từ chối",
  "invite.status.expired": "Hết hạn",
  "proposal.approach": "Cách làm",
  "proposal.price": "Giá",
  "proposal.price.discuss": "Cần trao đổi thêm",
  "proposal.price.range": "{min} – {max}",
  "proposal.timeline": "Thời gian",
  "proposal.days": "{n} ngày",
  "proposal.note": "Ghi chú về giá",
```

`zh-hans.ts`:

```ts
  "admin.nav.requests": "需求",
  "admin.requests.title": "标题",
  "admin.requests.invites": "邀请",
  "admin.requests.invitedAt": "邀请时间",
  "admin.requests.proposals": "方案",
  "admin.requests.count": "进行中 {active} · 共 {total}",
  "admin.requests.suggestions": "推荐的开发者",
  "admin.requests.suggestionsHint": "规则：同类别有产品 +3，每个匹配技能 +1（最多 3），共同语言 +1，可接单 +1，60 天内每个过期邀请 −1。没有人付费出现在这里。",
  "admin.requests.noCandidates": "没有符合条件的开发者。",
  "admin.requests.score": "分数",
  "admin.requests.reason.category": "同类别有产品 +3",
  "admin.requests.reason.skill": "技能“{skill}” +1",
  "admin.requests.reason.language": "共同语言 +1",
  "admin.requests.reason.open": "可接单 +1",
  "admin.requests.reason.expired": "{n} 个过期邀请 −{n}",
  "admin.requests.handle": "或按用户名邀请",
  "admin.requests.invite": "邀请",
  "admin.requests.slots": "还剩 {n}/5 个邀请名额。",
  "admin.requests.full": "5 个邀请名额已用完。",
  "admin.requests.error.none": "请至少选择一位开发者。",
  "admin.requests.error.too_many": "所选开发者超过剩余名额。",
  "admin.requests.error.handle": "没有使用该用户名的公开开发者。",
  "admin.requests.reject": "退回给客户",
  "admin.requests.note": "原因（客户可见）",
  "admin.requests.error.note": "请填写 1–1000 个字符的原因。",
  "admin.requests.remove": "标记为垃圾信息（移除）",
  "admin.requests.mailFailed": "已保存，但部分邮件未能发送。",
  "invite.status.invited": "已邀请",
  "invite.status.proposed": "已提交方案",
  "invite.status.selected": "已选中",
  "invite.status.not_selected": "未选中",
  "invite.status.declined": "已婉拒",
  "invite.status.expired": "已过期",
  "proposal.approach": "实施方式",
  "proposal.price": "价格",
  "proposal.price.discuss": "待商议",
  "proposal.price.range": "{min} – {max}",
  "proposal.timeline": "工期",
  "proposal.days": "{n} 天",
  "proposal.note": "价格说明",
```

`zh-hant.ts`:

```ts
  "admin.nav.requests": "需求",
  "admin.requests.title": "標題",
  "admin.requests.invites": "邀請",
  "admin.requests.invitedAt": "邀請時間",
  "admin.requests.proposals": "方案",
  "admin.requests.count": "進行中 {active} · 共 {total}",
  "admin.requests.suggestions": "推薦的開發者",
  "admin.requests.suggestionsHint": "規則：同類別有產品 +3，每個相符技能 +1（最多 3），共同語言 +1，可接案 +1，60 天內每個過期邀請 −1。沒有人付費出現在這裡。",
  "admin.requests.noCandidates": "沒有符合條件的開發者。",
  "admin.requests.score": "分數",
  "admin.requests.reason.category": "同類別有產品 +3",
  "admin.requests.reason.skill": "技能「{skill}」 +1",
  "admin.requests.reason.language": "共同語言 +1",
  "admin.requests.reason.open": "可接案 +1",
  "admin.requests.reason.expired": "{n} 個過期邀請 −{n}",
  "admin.requests.handle": "或依使用者名稱邀請",
  "admin.requests.invite": "邀請",
  "admin.requests.slots": "還剩 {n}/5 個邀請名額。",
  "admin.requests.full": "5 個邀請名額已用完。",
  "admin.requests.error.none": "請至少選擇一位開發者。",
  "admin.requests.error.too_many": "所選開發者超過剩餘名額。",
  "admin.requests.error.handle": "沒有使用該名稱的公開開發者。",
  "admin.requests.reject": "退回給客戶",
  "admin.requests.note": "原因（客戶可見）",
  "admin.requests.error.note": "請填寫 1–1000 個字元的原因。",
  "admin.requests.remove": "標記為垃圾訊息（移除）",
  "admin.requests.mailFailed": "已儲存，但部分郵件未能寄出。",
  "invite.status.invited": "已邀請",
  "invite.status.proposed": "已提交方案",
  "invite.status.selected": "已選中",
  "invite.status.not_selected": "未選中",
  "invite.status.declined": "已婉拒",
  "invite.status.expired": "已過期",
  "proposal.approach": "實作方式",
  "proposal.price": "價格",
  "proposal.price.discuss": "待商議",
  "proposal.price.range": "{min} – {max}",
  "proposal.timeline": "工期",
  "proposal.days": "{n} 天",
  "proposal.note": "價格說明",
```

- [ ] **Step 2: Test (fail)**

`apps/web/test/admin/requests.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findAdminRequest, findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { addLiveProduct, inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string | string[]> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const invitesOf = async (requestId: string) => (await listRequestInvites(testEnv.DB, requestId)).map((x) => x.invite);
const activeOf = (invites: { status: string }[]) => invites.filter((i) => i.status === "invited" || i.status === "proposed");
const builders = (tag: string, n: number) => Promise.all(Array.from({ length: n }, (_, i) => makeBuilder(`${tag}-${i}@vnx.si`, `${tag}-${i}`, "approved")));

/** Handles offered in the invite form's suggestion table, in order. */
function suggestedHandles(html: string): string[] {
  const form = /<form method="post" action="[^"]*\/invite">([\s\S]*?)<\/form>/.exec(html)?.[1] ?? "";
  return [...form.matchAll(/>@([a-z0-9-]+)<\/a>/g)].map((m) => m[1]!);
}

describe("admin requests (spec §5.5, §5.7 step 2, §8.10)", () => {
  beforeEach(() => clearOutbox());

  it("is admin only, and an unknown request is 404", async () => {
    const { request } = await makeRequest({ tag: "ar-auth" });
    const { cookie } = await signIn("ar-nobody@vnx.si");
    expect((await get("/admin/requests", cookie)).status).toBe(403);
    expect((await get(`/admin/requests/${request.id}`, cookie)).status).toBe(403);
    for (const action of ["invite", "reject", "remove"]) expect((await post(`/admin/requests/${request.id}/${action}`, cookie, { note: "x" })).status, action).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    const root = await admin();
    const noOrigin = await app().request(new Request(`https://vnx.si/admin/requests/${request.id}/remove`, { method: "POST", headers: { cookie: root.cookie } }), undefined, testEnv);
    expect(noOrigin.status).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    expect((await get("/admin/requests", root.cookie)).headers.get("cache-control")).toContain("no-store");
    expect((await get("/admin/requests/01J0000000000000000000NONE", root.cookie)).status).toBe(404);
    expect((await post("/admin/requests/01J0000000000000000000NONE/remove", root.cookie)).status).toBe(404);
  });

  it("queues submitted requests; shows the client's name and e-mail to the admin; filters by status", async () => {
    const { request } = await makeRequest({ tag: "ar-queue" });
    const pending = await makeRequest({ tag: "ar-queue-p", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE requests SET client_name = 'Lan (lan@x.vn)' WHERE id = ?1").bind(request.id).run();
    const { cookie } = await admin();
    const html = await (await get("/admin/requests", cookie)).text();
    expect(html).toContain(`href="/admin/requests/${request.id}"`);
    expect(html).toContain("ar-queue-c@vnx.si");
    expect(html).toContain("Lan (lan@x.vn)"); // admin pages are not builder-facing: no builderFacingName mask
    expect(html).not.toContain(pending.request.id);
    expect(await (await get("/admin/requests?status=pending_verification", cookie)).text()).toContain(pending.request.id);
    expect(await (await get("/admin/requests?status=all", cookie)).text()).toContain(pending.request.id);
    expect((await get("/admin/requests?status=bogus", cookie)).status).toBe(200);
    expect(html).toContain('href="/admin/requests"');
    const detail = await (await get(`/admin/requests/${request.id}`, cookie)).text();
    expect(detail).toContain("ar-queue-c@vnx.si");
    const answered = await makeRequest({ tag: "ar-answered" });
    const [x, y, z] = await builders("ar-answered", 3);
    const [ix, iy] = await inviteBuilders(answered.request, [x!, y!, z!]);
    await proposeOn(ix!);
    await testEnv.DB.prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(iy!.id).run();
    const { activeInvites, totalInvites, proposals } = (await findAdminRequest(testEnv.DB, answered.request.id))!;
    expect({ activeInvites, totalInvites, proposals }).toEqual({ activeInvites: 2, totalInvites: 3, proposals: 2 }); // answered: proposed + declined
    const matching = await (await get("/admin/requests?status=matching", cookie)).text();
    expect(matching).toContain(answered.request.id);
    expect(detail).toContain("Lan (lan@x.vn)");
  });

  // D1 is shared with other test files (see "Quyết định kỹ thuật"). The title carries three tokens with no common
  // substrings, so (almost) no foreign builder matches a skill. Without an hr product a builder scores at most
  // 3 skills + language + open = 5 only if it matched three skills, i.e. never; with one it can reach 6 only if it also
  // matched skills. Own builders "top" (8) and "mid" (6) both carry an hr product plus own tokens. Only relative order
  // and absence of ineligible builders are asserted.
  it("suggests eligible builders by the rules, best first, with reasons; ineligible ones are absent", async () => {
    const { client, request } = await makeRequest({
      tag: "ar-sug",
      title: "Qzarone qzartwo qzarthree tool",
      description: "A small tool for twelve people to share their shifts.",
      category: "hr",
      languages: ["zh"],
    });
    const mid = await makeBuilder("ar-sug-mid@vnx.si", "ar-sug-mid", "approved", { availability: "limited", workLanguages: ["zh"], skills: "qzarone, qzartwo" });
    await addLiveProduct(mid, "ar-sug shifts", { fields: { category: "hr" } });
    const top = await makeBuilder("ar-sug-top@vnx.si", "ar-sug-top", "approved", { availability: "open", workLanguages: ["zh"], skills: "qzarone, qzartwo, qzarthree" });
    await addLiveProduct(top, "ar-sug rota", { fields: { category: "hr" } });
    await makeBuilder("ar-sug-closed@vnx.si", "ar-sug-closed", "approved", { availability: "closed", skills: "qzarone, qzartwo, qzarthree" });
    await makeBuilder("ar-sug-pending@vnx.si", "ar-sug-pending", "pending", { skills: "qzarone, qzartwo, qzarthree" });
    await makeBuilder(client.email, "ar-sug-self", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    const locked = await makeBuilder("ar-sug-locked@vnx.si", "ar-sug-locked", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    const invited = await makeBuilder("ar-sug-inv@vnx.si", "ar-sug-inv", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    await inviteBuilders(request, [invited]);
    const { cookie } = await admin();
    const html = await (await get(`/admin/requests/${request.id}`, cookie)).text();
    const suggested = suggestedHandles(html);
    expect(suggested.filter((h) => h.startsWith("ar-sug-"))).toEqual(["ar-sug-top", "ar-sug-mid"]);
    expect(suggested.length).toBeLessThanOrEqual(10);
    expect(html).toContain("product in this category +3");
    expect(html).toContain("skill “qzarthree” +1");
    expect(html).toContain("shared language +1 · open +1");
    expect(html).toContain("4 of 5 invitation slots free.");
  });

  it("invites chosen builders and one by handle (even if closed), mails them without the client's e-mail, moves to matching", async () => {
    const { request } = await makeRequest({ tag: "ar-inv" });
    const a = await makeBuilder("ar-inv-a@vnx.si", "ar-inv-a", "approved");
    const b = await makeBuilder("ar-inv-b@vnx.si", "ar-inv-b", "approved");
    await makeBuilder("ar-inv-cl@vnx.si", "ar-inv-cl", "approved", { availability: "closed" });
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [a.userId, b.userId], handle: "ar-inv-cl" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=1`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
    expect((await listRequestInvites(testEnv.DB, request.id)).map((x) => x.builderHandle)).toEqual(["ar-inv-a", "ar-inv-b", "ar-inv-cl"]);
    expect(outbox.map((m) => m.to).sort()).toEqual(["ar-inv-a@vnx.si", "ar-inv-b@vnx.si", "ar-inv-cl@vnx.si"]);
    for (const m of outbox) expect(`${m.text}${m.html}`).not.toContain("ar-inv-c@vnx.si");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("keeps the invitations but says so when an e-mail could not be sent", async () => {
    const { request } = await makeRequest({ tag: "ar-mailfail" });
    const [a] = await builders("ar-mailfail-b", 1);
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: a!.userId }, noMail);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=mail_failed`);
    expect(await invitesOf(request.id)).toHaveLength(1);
    expect(await (await get(`/admin/requests/${request.id}?done=mail_failed`, cookie)).text()).toContain("Saved, but some emails couldn&#39;t be sent.");
  });

  it("refuses no choice, an unknown handle and more builders than free slots", async () => {
    const { request } = await makeRequest({ tag: "ar-bad" });
    const four = await builders("ar-bad", 4);
    await inviteBuilders(request, four);
    const x = await makeBuilder("ar-bad-x@vnx.si", "ar-bad-x", "approved");
    const y = await makeBuilder("ar-bad-y@vnx.si", "ar-bad-y", "approved");
    const { cookie } = await admin();
    const none = await post(`/admin/requests/${request.id}/invite`, cookie, {});
    expect(none.status).toBe(400);
    expect(await none.text()).toContain("Choose at least one builder.");
    expect((await post(`/admin/requests/${request.id}/invite`, cookie, { handle: "no-such-builder" })).status).toBe(400);
    const tooMany = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [x.userId, y.userId] });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.text()).toContain("That is more builders than the free slots.");
    expect(await invitesOf(request.id)).toHaveLength(4);
    expect(outbox).toHaveLength(0);
  });

  describe("the invitation cap and eligibility cannot be bypassed (Review Focus 3)", () => {
    it("refuses a 6th invitation, by checkbox or by handle; the full request offers no invite form", async () => {
      const { request } = await makeRequest({ tag: "ar-six" });
      await inviteBuilders(request, await builders("ar-six", 5));
      const sixth = await makeBuilder("ar-six-x@vnx.si", "ar-six-x", "approved");
      const { cookie } = await admin();
      for (const fields of [{ builder: sixth.userId }, { handle: "ar-six-x" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(400);
      }
      expect(await invitesOf(request.id)).toHaveLength(5);
      expect(outbox).toHaveLength(0);
      const html = await (await get(`/admin/requests/${request.id}`, cookie)).text();
      expect(html).toContain("All 5 invitation slots are in use.");
      expect(html).not.toContain(`/admin/requests/${request.id}/invite"`);
    });

    it("never inserts a duplicate: alone it is a 409, with a new builder only the new one is invited", async () => {
      const { request } = await makeRequest({ tag: "ar-dup" });
      const [a, b] = await builders("ar-dup", 2);
      await inviteBuilders(request, [a!]);
      const { cookie } = await admin();
      for (const fields of [{ builder: a!.userId }, { handle: "ar-dup-0" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(409);
      }
      expect(await invitesOf(request.id)).toHaveLength(1);
      expect(outbox).toHaveLength(0);
      expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [a!.userId, b!.userId] })).status).toBe(303);
      const rows = await invitesOf(request.id);
      expect(rows.map((i) => i.builderId).sort()).toEqual([a!.userId, b!.userId].sort());
      expect(outbox.map((m) => m.to)).toEqual(["ar-dup-1@vnx.si"]);
    });

    it("never invites the client themself (a builder account that posted a request)", async () => {
      const { client, request } = await makeRequest({ tag: "ar-self" });
      const self = await makeBuilder(client.email, "ar-self-b", "approved");
      const { cookie } = await admin();
      for (const fields of [{ builder: self.userId }, { handle: "ar-self-b" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(409);
      }
      expect(await invitesOf(request.id)).toHaveLength(0);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
      expect(outbox).toHaveLength(0);
    });

    it("never invites a builder who is suspended or whose account is suspended", async () => {
      const { request } = await makeRequest({ tag: "ar-susp" });
      const suspended = await makeBuilder("ar-susp-s@vnx.si", "ar-susp-s", "suspended");
      const locked = await makeBuilder("ar-susp-l@vnx.si", "ar-susp-l", "approved");
      await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
      const { cookie } = await admin();
      for (const b of [suspended, locked]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: b.userId })).status, "forged checkbox").toBe(409);
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { handle: b.handle })).status, "typed handle").toBe(400);
      }
      expect(await invitesOf(request.id)).toHaveLength(0);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
      expect(outbox).toHaveLength(0);
    });

    it("never invites into a request that is no longer submitted or matching", async () => {
      const { cookie } = await admin();
      for (const [i, status] of (["closed", "removed", "rejected", "expired", "builder_selected", "pending_verification"] as const).entries()) {
        const { request } = await makeRequest({ tag: `ar-end${i}`, status: status === "pending_verification" ? status : "submitted" });
        if (status !== "pending_verification") await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(request.id, status).run();
        const b = await makeBuilder(`ar-end${i}-b@vnx.si`, `ar-end${i}-b`, "approved");
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: b.userId })).status, status).toBe(409);
        expect(await invitesOf(request.id), status).toHaveLength(0);
        expect((await findRequestById(testEnv.DB, request.id))?.status).toBe(status);
      }
      expect(outbox).toHaveLength(0);
    });

    it("two concurrent invite POSTs never leave more than 5 active invitations, nor an invitation nobody asked for", async () => {
      const { request } = await makeRequest({ tag: "ar-race" });
      const seeded = await builders("ar-race-s", 2);
      await inviteBuilders(request, seeded);
      const left = await builders("ar-race-l", 3);
      const right = await builders("ar-race-r", 3);
      const { cookie } = await admin();
      const path = `/admin/requests/${request.id}/invite`;
      const [one, two] = await Promise.all([post(path, cookie, { builder: left.map((b) => b.userId) }), post(path, cookie, { builder: right.map((b) => b.userId) })]);
      const rows = await invitesOf(request.id);
      expect(rows).toHaveLength(5);
      expect(activeOf(rows)).toHaveLength(5);
      expect(new Set(rows.map((i) => i.builderId)).size).toBe(5);
      const asked = new Set([...seeded, ...left, ...right].map((b) => b.userId));
      expect(rows.every((i) => asked.has(i.builderId))).toBe(true);
      // 6 asked for, 3 slots: exactly one POST wins (the other lost the race: 409, or already saw the full request: 400).
      expect([one.status, two.status].filter((s) => s === 303)).toHaveLength(1);
      expect([one.status, two.status].filter((s) => s !== 303).every((s) => s === 409 || s === 400)).toBe(true);
      expect(outbox).toHaveLength(3);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
      const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
      expect(audit?.n).toBe(1);
    });
  });

  it("returns a submitted request with a required note and tells the client; 409 once matching", async () => {
    const { request } = await makeRequest({ tag: "ar-rej" });
    const { cookie } = await admin();
    for (const note of [" ", "x".repeat(1001)]) {
      const bad = await post(`/admin/requests/${request.id}/reject`, cookie, { note });
      expect(bad.status).toBe(400);
      expect(await bad.text()).toContain("Write a reason of 1–1000 characters.");
    }
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    const res = await post(`/admin/requests/${request.id}/reject`, cookie, { note: "Please try the catalogue first." });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=1`);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "rejected", adminNote: "Please try the catalogue first." });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "ar-rej-c@vnx.si" });
    expect(outbox[0]!.text).toContain("Please try the catalogue first.");
    expect((await post(`/admin/requests/${request.id}/reject`, cookie, { note: "again" })).status).toBe(409);

    const other = await makeRequest({ tag: "ar-rej2" });
    await inviteBuilders(other.request, [await makeBuilder("ar-rej2-b@vnx.si", "ar-rej2-b", "approved")]);
    expect((await post(`/admin/requests/${other.request.id}/reject`, cookie, { note: "x" })).status).toBe(409);
    expect((await findRequestById(testEnv.DB, other.request.id))?.status).toBe("matching");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.reject' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("reports a failed e-mail to the client but keeps the return", async () => {
    const { request } = await makeRequest({ tag: "ar-rejfail" });
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/reject`, cookie, { note: "Not a fit." }, noMail);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=mail_failed`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("rejected");
  });

  it("removes spam: proposals become not selected, open invitations expire, both builders are told, the client is not", async () => {
    const { client, request } = await makeRequest({ tag: "ar-spam" });
    const proposer = await makeBuilder("ar-spam-p@vnx.si", "ar-spam-p", "approved");
    const waiting = await makeBuilder("ar-spam-w@vnx.si", "ar-spam-w", "approved");
    const [first] = await inviteBuilders(request, [proposer, waiting]);
    await proposeOn(first!);
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/remove`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/requests");
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect((await invitesOf(request.id)).map((i) => i.status)).toEqual(["not_selected", "expired"]);
    expect(outbox.map((m) => m.to).sort()).toEqual(["ar-spam-p@vnx.si", "ar-spam-w@vnx.si"]);
    expect(outbox.map((m) => m.to)).not.toContain(client.email);
    const mine = await signIn(client.email);
    expect((await get(`/me/requests/${request.id}`, mine.cookie)).status).toBe(404);
    expect((await post(`/admin/requests/${request.id}/remove`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(2);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.remove' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });
});
```

`apps/web/test/views/proposal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { proposalPrice } from "../../src/views/proposal.ts";

describe("proposalPrice (spec §5.7 step 3)", () => {
  it("shows an amount, a range or 'to discuss'", () => {
    expect(proposalPrice("en", { priceCents: 450000, priceMaxCents: null })).toBe("$4,500");
    expect(proposalPrice("en", { priceCents: 300000, priceMaxCents: 500000 })).toBe("$3,000 – $5,000");
    expect(proposalPrice("en", { priceCents: null, priceMaxCents: null })).toBe("To discuss");
  });
});
```

Chạy: `npm test -w apps/web -- test/admin/requests.test.ts test/views/proposal.test.ts` → FAIL (không resolve được `views/proposal.ts`; các route `/admin/requests*` trả 404 thay vì 200 / 403 / 303).

- [ ] **Step 3: db cho admin**

Trong `apps/web/src/db/requests.ts`: sửa import đầu thành `import { WORK_LANGUAGES, type Availability, type WorkLanguage } from "../domain/builder.ts";` và thêm `type AdminRequest`, `type Candidate` vào khối import từ `../domain/request.ts`. Thêm cuối file:

```ts
const ADMIN_SELECT = `SELECT r.*, u.email AS client_email,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id AND x.status IN ('invited', 'proposed')) AS active_invites,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id) AS total_invites,
    (SELECT COUNT(*) FROM request_invites x WHERE x.request_id = r.id AND x.status IN ('proposed', 'selected', 'not_selected', 'declined')) AS proposals
  FROM requests r JOIN users u ON u.id = r.client_user_id`;
type AdminRow = Row & { client_email: string; active_invites: number; total_invites: number; proposals: number };
const toAdmin = (r: AdminRow): AdminRequest => ({ request: toRequest(r), clientEmail: r.client_email, activeInvites: r.active_invites, totalInvites: r.total_invites, proposals: r.proposals });

/**
 * Spec §5.5 queue: `submitted` and `matching` oldest first (first come, first served); any other filter, and `null`
 * (every status), most recently changed first. Admin only: carries the client's e-mail.
 */
export async function listRequestsForAdmin(db: D1Database, status: RequestStatus | null, limit = 200): Promise<AdminRequest[]> {
  const order = status === "submitted" || status === "matching" ? "ORDER BY COALESCE(r.submitted_at, r.created_at), r.id" : "ORDER BY r.updated_at DESC, r.id DESC";
  const { results } = await db
    .prepare(`${ADMIN_SELECT} WHERE (?1 IS NULL OR r.status = ?1) ${order} LIMIT ?2`)
    .bind(status, limit)
    .all<AdminRow>();
  return results.map(toAdmin);
}

export async function findAdminRequest(db: D1Database, id: string): Promise<AdminRequest | null> {
  const row = await db.prepare(`${ADMIN_SELECT} WHERE r.id = ?1`).bind(id).first<AdminRow>();
  return row ? toAdmin(row) : null;
}

type CandidateRow = { user_id: string; handle: string; name: string; availability: Availability; skills: string; work_languages: string; has_category_product: number; expired_invites: number };

/**
 * Spec §8.10 candidates: approved builders on active accounts, availability not closed, not the client, not yet
 * invited to this request. Scoring is domain/request.ts suggestBuilders (ties by handle, ADR-004: nothing paid).
 * `penaltySince`: expired invitations sent at or after this instant count against the builder. Capped at `limit`
 * builders, taken by user id (Wave 1 scale; revisit before approved builders pass `limit`).
 */
export async function listCandidates(db: D1Database, request: Pick<ClientRequest, "id" | "clientUserId" | "category">, penaltySince: string, limit = 1000): Promise<Candidate[]> {
  const { results } = await db
    .prepare(
      `SELECT b.user_id, b.handle, b.name, b.availability, b.skills, b.work_languages,
         EXISTS (SELECT 1 FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published' AND p.category = ?2) AS has_category_product,
         (SELECT COUNT(*) FROM request_invites e WHERE e.builder_id = b.user_id AND e.status = 'expired' AND e.invited_at >= ?3 AND julianday(e.updated_at) - julianday(e.invited_at) >= 7) AS expired_invites
       FROM builders b JOIN users u ON u.id = b.user_id
       WHERE b.status = 'approved' AND u.status = 'active' AND b.availability != 'closed' AND b.user_id != ?4
         AND NOT EXISTS (SELECT 1 FROM request_invites y WHERE y.request_id = ?1 AND y.builder_id = b.user_id)
       ORDER BY b.user_id LIMIT ?5`,
    )
    .bind(request.id, request.category, penaltySince, request.clientUserId, limit)
    .all<CandidateRow>();
  return results.map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    availability: r.availability,
    skills: jsonList(r.skills),
    workLanguages: jsonList(r.work_languages).filter((l): l is WorkLanguage => (WORK_LANGUAGES as readonly string[]).includes(l)),
    hasCategoryProduct: r.has_category_product === 1,
    expiredInvites: r.expired_invites,
  }));
}
```

Thêm vào `apps/web/test/db/requests.test.ts` (import thêm `listCandidates` từ `../../src/db/requests.ts`; dùng `builders`, `db`, `makeRequest`, `makeBuilder`, `inviteBuilders` đã có trong file):

```ts
  it("lists only eligible candidates; only lapsed expired invitations count against them (spec §8.10)", async () => {
    const { client, request } = await makeRequest({ tag: "rq-pen" });
    const [b, taken] = await builders("rq-pen-b", 2);
    const day = 24 * 3600 * 1000;
    const t0 = Date.now() - 20 * day;
    const lapsed = await makeRequest({ tag: "rq-pen-l" });
    const early = await makeRequest({ tag: "rq-pen-e" });
    const [lapsedInvite] = await inviteBuilders(lapsed.request, [b!], new Date(t0).toISOString());
    const [earlyInvite] = await inviteBuilders(early.request, [b!], new Date(t0).toISOString());
    const expire = (id: string, after: number) => db().prepare("UPDATE request_invites SET status = 'expired', updated_at = ?2 WHERE id = ?1").bind(id, new Date(t0 + after * day).toISOString()).run();
    await expire(lapsedInvite!.id, 8); // no answer in 7 days
    await expire(earlyInvite!.id, 1); // the request ended early
    await inviteBuilders(request, [taken!]);
    const self = await makeBuilder(client.email, "rq-pen-self", "approved");
    const closed = await makeBuilder("rq-pen-cl@vnx.si", "rq-pen-cl", "approved", { availability: "closed" });
    const pending = await makeBuilder("rq-pen-pe@vnx.si", "rq-pen-pe", "pending");
    const suspended = await makeBuilder("rq-pen-su@vnx.si", "rq-pen-su", "suspended");
    const locked = await makeBuilder("rq-pen-lo@vnx.si", "rq-pen-lo", "approved");
    await db().prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    const since = new Date(Date.now() - 60 * day).toISOString();
    const found = await listCandidates(db(), request, since);
    expect(found.find((x) => x.userId === b!.userId)?.expiredInvites).toBe(1);
    for (const gone of [taken!, self, closed, pending, suspended, locked]) expect(found.map((x) => x.userId)).not.toContain(gone.userId);
    const later = new Date(Date.now() + 1000).toISOString();
    expect((await listCandidates(db(), request, later)).find((x) => x.userId === b!.userId)?.expiredInvites).toBe(0);
  });
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts` → PASS (các test admin vẫn FAIL tới Step 6).

**Siết câu chuyển `matching` của `inviteBuildersBatch` (sửa Task 1, cần cho Review Focus 3).** Hiện câu `move` chỉ hỏi "có lời mời nào có `invited_at = now` không". Hai POST mời đồng thời rơi vào cùng một mili giây (cùng `now`) thì POST thua đua, dù không chèn được dòng nào, vẫn thấy lời mời của POST thắng, trả `request` khác null và route trả 303 thay vì 409. Sửa để `move` chỉ tính các id do chính batch này sinh ra. Trong `apps/web/src/db/requests.ts`, thay cả hàm (thêm `inviteIds` vào kết quả; `db/audit.ts` thêm `AuditInvitesGuard = { requestId, inviteIds }` với câu `WHERE EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?8 AND id IN (SELECT value FROM json_each(?9)))`, kiểm `"inviteIds" in onlyIf` trước nhánh `requestId`):

```ts
export function inviteBuildersBatch(
  db: D1Database,
  input: { requestId: string; builderIds: string[]; invitedBy: string; now: string },
): { statements: D1PreparedStatement[]; inviteIds: string[]; read: (results: D1Result[]) => { request: ClientRequest | null; invited: { id: string; builderId: string }[] } } {
  const at = Date.parse(input.now);
  const inviteIds = input.builderIds.map(() => ulid(at));
  const inserts = input.builderIds.map((builderId, i) =>
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
      .bind(inviteIds[i], input.requestId, builderId, input.invitedBy, input.now, MAX_ACTIVE_INVITES),
  );
  // Only this batch's own ids count, so a batch that inserted nothing cannot move the request because another batch invited at the same instant.
  const move = db
    .prepare(
      `UPDATE requests SET status = 'matching', matched_at = COALESCE(matched_at, ?2), updated_at = ?2
       WHERE id = ?1 AND status IN ('submitted', 'matching')
         AND EXISTS (SELECT 1 FROM request_invites WHERE request_id = ?1 AND id IN (SELECT value FROM json_each(?3)))
       RETURNING *`,
    )
    .bind(input.requestId, input.now, JSON.stringify(inviteIds));
  return {
    statements: [...inserts, move],
    inviteIds,
    read: (results) => ({
      request: returnedRequest(results[inserts.length]),
      invited: results.slice(0, inserts.length).flatMap((r) => ((r?.results ?? []) as { id: string; builder_id: string }[]).map((x) => ({ id: x.id, builderId: x.builder_id }))),
    }),
  };
}
```

Thêm vào `apps/web/test/db/requests.test.ts` một test cho đúng trường hợp đó:

```ts
  it("does not move the request, nor audit, when this batch invited nobody, even if another batch invited at the same instant", async () => {
    const { request } = await makeRequest({ tag: "rq-same" });
    const [a, b] = await builders("rq-same-b", 2);
    const admin = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    await inviteBuilders(request, [a!], now);
    const audits = async () => ((await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>())?.n ?? 0);
    const run = async (builderId: string) => {
      const batch = inviteBuildersBatch(db(), { requestId: request.id, builderIds: [builderId], invitedBy: admin.id, now });
      const results = await db().batch([...batch.statements, auditStatement(db(), { actorUserId: admin.id, action: "request.invite", entity: "request", entityId: request.id, now }, { requestId: request.id, inviteIds: batch.inviteIds })]);
      return batch.read(results);
    };
    expect(await run(a!.userId)).toEqual({ request: null, invited: [] }); // duplicate: inserts nothing
    expect(await audits()).toBe(0);
    expect((await run(b!.userId)).invited).toHaveLength(1);
    expect(await audits()).toBe(1);
  });

  it("lists only eligible candidates; only lapsed expired invitations count against them (spec §8.10)", async () => {
    const { client, request } = await makeRequest({ tag: "rq-pen" });
    const [b, taken] = await builders("rq-pen-b", 2);
    const day = 24 * 3600 * 1000;
    const t0 = Date.now() - 20 * day;
    const lapsed = await makeRequest({ tag: "rq-pen-l" });
    const early = await makeRequest({ tag: "rq-pen-e" });
    const [lapsedInvite] = await inviteBuilders(lapsed.request, [b!], new Date(t0).toISOString());
    const [earlyInvite] = await inviteBuilders(early.request, [b!], new Date(t0).toISOString());
    const expire = (id: string, after: number) => db().prepare("UPDATE request_invites SET status = 'expired', updated_at = ?2 WHERE id = ?1").bind(id, new Date(t0 + after * day).toISOString()).run();
    await expire(lapsedInvite!.id, 8); // no answer in 7 days
    await expire(earlyInvite!.id, 1); // the request ended early
    await inviteBuilders(request, [taken!]);
    const self = await makeBuilder(client.email, "rq-pen-self", "approved");
    const closed = await makeBuilder("rq-pen-cl@vnx.si", "rq-pen-cl", "approved", { availability: "closed" });
    const pending = await makeBuilder("rq-pen-pe@vnx.si", "rq-pen-pe", "pending");
    const suspended = await makeBuilder("rq-pen-su@vnx.si", "rq-pen-su", "suspended");
    const locked = await makeBuilder("rq-pen-lo@vnx.si", "rq-pen-lo", "approved");
    await db().prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    const since = new Date(Date.now() - 60 * day).toISOString();
    const found = await listCandidates(db(), request, since);
    expect(found.find((x) => x.userId === b!.userId)?.expiredInvites).toBe(1);
    for (const gone of [taken!, self, closed, pending, suspended, locked]) expect(found.map((x) => x.userId)).not.toContain(gone.userId);
    const later = new Date(Date.now() + 1000).toISOString();
    expect((await listCandidates(db(), request, later)).find((x) => x.userId === b!.userId)?.expiredInvites).toBe(0);
  });
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts` → PASS (test mới FAIL trước khi sửa `move`: `request` khác null).

- [ ] **Step 4: Nhãn, giá đề xuất, layout**

`apps/web/src/views/labels.ts`: sửa import kiểu request thành `import type { InviteStatus, RequestStatus } from "../domain/request.ts";` và thêm cuối file:

```ts
export const INVITE_STATUS_KEY: Record<InviteStatus, MessageKey> = {
  invited: "invite.status.invited",
  proposed: "invite.status.proposed",
  selected: "invite.status.selected",
  not_selected: "invite.status.not_selected",
  declined: "invite.status.declined",
  expired: "invite.status.expired",
};
```

`apps/web/src/views/proposal.ts`:

```ts
import type { RequestInvite } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";

/** Spec §5.7 step 3: an amount, a range, or "to discuss". */
export function proposalPrice(locale: Locale, invite: Pick<RequestInvite, "priceCents" | "priceMaxCents">): string {
  const tr = translator(locale);
  if (invite.priceCents === null) return tr("proposal.price.discuss");
  if (invite.priceMaxCents === null) return formatUsd(locale, invite.priceCents);
  return tr("proposal.price.range", { min: formatUsd(locale, invite.priceCents), max: formatUsd(locale, invite.priceMaxCents) });
}
```

`apps/web/src/views/admin/AdminLayout.tsx`: `AdminSection` thêm `"requests"`; `NAV` thêm `{ key: "requests", path: "/admin/requests", label: "admin.nav.requests" }` ngay sau `inquiries`.


- [ ] **Step 5: View admin**

`apps/web/src/views/admin/RequestsPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { REQUEST_STATUSES, type AdminRequest, type RequestStatus } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, REQUEST_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

/** Admin only: names the client with the typed name and the e-mail (spec §5.5). Never reuse for a builder. */
export const AdminRequestsPage: FC<{ locale: Locale; origin: string; status: RequestStatus | null; items: AdminRequest[] }> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/requests");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.requests")} rest="/admin/requests" active="requests">
      <h1>{tr("admin.nav.requests")}</h1>
      <nav class="subnav" aria-label={tr("admin.inquiries.filter")}>
        <a href={`${base}?status=all`} aria-current={p.status === null ? "page" : undefined}>
          {tr("filter.any")}
        </a>
        {REQUEST_STATUSES.map((s) => (
          <a href={`${base}?status=${s}`} aria-current={p.status === s ? "page" : undefined}>
            {tr(REQUEST_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("me.requests.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.requests.title")}</th>
                <th>{tr("admin.inquiries.client")}</th>
                <th>{tr("request.facts.category")}</th>
                <th>{tr("hub.status.label")}</th>
                <th>{tr("admin.requests.invites")}</th>
                <th>{tr("admin.requests.proposals")}</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map(({ request: r, clientEmail, activeInvites, totalInvites, proposals }) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/requests/${r.id}`)}>{r.title}</a>
                    <br />
                    <span class="muted">{(r.submittedAt ?? r.createdAt).slice(0, 10)}</span>
                  </td>
                  <td>
                    {r.clientName}
                    <br />
                    <span class="muted">{clientEmail}</span>
                  </td>
                  <td>{tr(CATEGORY_KEY[r.category])}</td>
                  <td>{tr(REQUEST_STATUS_KEY[r.status])}</td>
                  <td>{tr("admin.requests.count", { active: activeInvites, total: totalInvites })}</td>
                  <td>{proposals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
```

`apps/web/src/views/admin/RequestDetailPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { MAX_ACTIVE_INVITES, requestTransition, type AdminRequest, type InviteWithBuilder, type Suggestion, type SuggestionReason } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { INVITE_STATUS_KEY, REQUEST_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { proposalPrice } from "../proposal.ts";
import { RequestFacts } from "../RequestFacts.tsx";
import { AdminLayout } from "./AdminLayout.tsx";

export type InviteError = "none" | "too_many" | "handle";

type Props = {
  locale: Locale;
  origin: string;
  item: AdminRequest;
  invites: InviteWithBuilder[];
  /** null when the request cannot take more invitations (status or full). */
  suggestions: Suggestion[] | null;
  notice: "done" | "mail_failed" | null;
  inviteError?: InviteError;
  noteError?: boolean;
  values?: { note?: string; handle?: string };
};

const INVITE_ERROR_KEY: Record<InviteError, MessageKey> = {
  none: "admin.requests.error.none",
  too_many: "admin.requests.error.too_many",
  handle: "admin.requests.error.handle",
};

function reasonText(tr: Translate, r: SuggestionReason): string {
  switch (r.kind) {
    case "category":
      return tr("admin.requests.reason.category");
    case "skill":
      return tr("admin.requests.reason.skill", { skill: r.skill });
    case "language":
      return tr("admin.requests.reason.language");
    case "open":
      return tr("admin.requests.reason.open");
    case "expired":
      return tr("admin.requests.reason.expired", { n: r.count });
  }
}

/**
 * Spec §5.5 / §8.10: the admin reads the request, sees suggestions with reasons, invites, returns or removes.
 * Admin only: the client appears with the typed name and the e-mail, so RequestFacts is used without `showClient`
 * (that flag masks e-mail-like names for builders). Never reuse this page's client line for a builder.
 */
export const RequestDetailPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const r = p.item.request;
  const base = localizedPath(p.locale, `/admin/requests/${r.id}`);
  const free = MAX_ACTIVE_INVITES - p.item.activeInvites;
  const invitable = requestTransition(r.status, "invite", "admin").ok;
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={r.title} rest={`/admin/requests/${r.id}`} active="requests">
      <p>
        <a href={localizedPath(p.locale, "/admin/requests")}>{tr("admin.nav.requests")}</a>
      </p>
      <h1>{r.title}</h1>
      {p.notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {p.notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.requests.mailFailed")}
        </p>
      ) : null}
      <p>
        <span class={`badge badge-request-${r.status}`}>{tr(REQUEST_STATUS_KEY[r.status])}</span> · {r.clientName} · <span class="muted">{p.item.clientEmail}</span>
      </p>
      {r.adminNote ? (
        <div class="notice">
          <PlainText text={r.adminNote} />
        </div>
      ) : null}
      <section class="card wide">
        <RequestFacts locale={p.locale} request={r} />
      </section>

      <section>
        <h2>{tr("admin.requests.invites")}</h2>
        <p class="muted">{tr("admin.requests.count", { active: p.item.activeInvites, total: p.item.totalInvites })}</p>
        {p.invites.length > 0 ? (
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{tr("admin.inquiries.builder")}</th>
                  <th>{tr("hub.status.label")}</th>
                  <th>{tr("admin.requests.proposals")}</th>
                  <th>{tr("admin.requests.invitedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {p.invites.map(({ invite, builderName, builderHandle, builderPublic }) => (
                  <tr>
                    <td>
                      {builderPublic ? <a href={localizedPath(p.locale, `/b/${builderHandle}`)}>{builderName}</a> : builderName} <span class="muted">@{builderHandle}</span>
                    </td>
                    <td>{tr(INVITE_STATUS_KEY[invite.status])}</td>
                    <td>
                      {invite.approach !== null ? (
                        <>
                          {proposalPrice(p.locale, invite)} · {tr("proposal.days", { n: invite.timelineDays ?? 0 })}
                        </>
                      ) : null}
                      {invite.declineReason ? <PlainText text={invite.declineReason} /> : null}
                    </td>
                    <td class="muted">{invite.invitedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {p.suggestions !== null ? (
        <section class="card wide">
          <h2>{tr("admin.requests.suggestions")}</h2>
          <p class="hint">{tr("admin.requests.suggestionsHint")}</p>
          <p>{tr("admin.requests.slots", { n: free })}</p>
          {p.inviteError ? (
            <p class="error-msg" role="alert">
              {tr(INVITE_ERROR_KEY[p.inviteError])}
            </p>
          ) : null}
          <form method="post" action={`${base}/invite`}>
            {p.suggestions.length === 0 ? (
              <p class="muted">{tr("admin.requests.noCandidates")}</p>
            ) : (
              <div class="table-wrap">
                <table class="data">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{tr("admin.inquiries.builder")}</th>
                      <th>{tr("admin.requests.score")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.suggestions.map((s) => (
                      <tr>
                        <td>
                          <input type="checkbox" id={`sg-${s.candidate.userId}`} name="builder" value={s.candidate.userId} />
                        </td>
                        <td>
                          <label for={`sg-${s.candidate.userId}`}>{s.candidate.name}</label> <a href={localizedPath(p.locale, `/b/${s.candidate.handle}`)}>@{s.candidate.handle}</a>
                        </td>
                        <td>{s.score}</td>
                        <td class="muted">{s.reasons.map((reason) => reasonText(tr, reason)).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div class="field">
              <label for="ar-handle">{tr("admin.requests.handle")}</label>
              <input id="ar-handle" name="handle" value={p.values?.handle ?? ""} />
            </div>
            <button class="btn" type="submit">
              {tr("admin.requests.invite")}
            </button>
          </form>
        </section>
      ) : invitable ? (
        <p class="notice">{tr("admin.requests.full")}</p>
      ) : null}

      {r.status === "submitted" ? (
        <form method="post" action={`${base}/reject`} class="card wide">
          <div class="field">
            <label for="ar-note">{tr("admin.requests.note")}</label>
            <textarea id="ar-note" name="note" required maxlength={1000} aria-invalid={p.noteError ? "true" : undefined}>
              {p.values?.note ?? ""}
            </textarea>
            {p.noteError ? (
              <p class="error-msg" role="alert">
                {tr("admin.requests.error.note")}
              </p>
            ) : null}
          </div>
          <button class="btn btn-secondary" type="submit">
            {tr("admin.requests.reject")}
          </button>
        </form>
      ) : null}
      {r.status !== "removed" ? (
        <form method="post" action={`${base}/remove`}>
          <button class="link" type="submit">
            {tr("admin.requests.remove")}
          </button>
        </form>
      ) : null}
    </AdminLayout>
  );
};
```

- [ ] **Step 6: Route admin**

`apps/web/src/routes/admin-requests.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { endRequestBatch, findAdminRequest, inviteBuildersBatch, listCandidates, listRequestInvites, listRequestsForAdmin } from "../db/requests.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import {
  EXPIRED_PENALTY_WINDOW_MS,
  MAX_ACTIVE_INVITES,
  parseAdminNote,
  REQUEST_STATUSES,
  requestTransition,
  suggestBuilders,
  type AdminRequest,
  type ClientRequest,
  type RequestStatus,
  type TerminalRequestStatus,
} from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { notifyInvited, notifyInviteExpired, notifyNotSelected, notifyRequestRejected } from "../notify/request.ts";
import { RequestDetailPage, type InviteError } from "../views/admin/RequestDetailPage.tsx";
import { AdminRequestsPage } from "../views/admin/RequestsPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

type DetailExtra = { inviteError?: InviteError; noteError?: boolean; values?: { note?: string; handle?: string } };

async function detailPage(c: Context<AppEnv>, item: AdminRequest, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const invites = await listRequestInvites(c.env.DB, item.request.id);
  const canInvite = requestTransition(item.request.status, "invite", "admin").ok && item.activeInvites < MAX_ACTIVE_INVITES;
  const since = new Date(Date.now() - EXPIRED_PENALTY_WINDOW_MS).toISOString();
  const suggestions = canInvite ? suggestBuilders(item.request, await listCandidates(c.env.DB, item.request, since)) : null;
  const done = c.req.query("done");
  const notice = done === "1" ? "done" : done === "mail_failed" ? "mail_failed" : null;
  return page(c, <RequestDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} invites={invites} suggestions={suggestions} notice={notice} {...extra} />, status);
}

const listOf = (value: unknown): string[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]).filter((v): v is string => typeof v === "string" && v !== "");

/**
 * Spec §5.7 step 2: up to 5 active invitations. The checks here only give quick answers; the INSERT in
 * inviteBuildersBatch is the real guard (cap, duplicate, client, eligibility, request status), so a lost race or a forged
 * checkbox invites nobody and answers 409.
 */
async function invite(c: Context<AppEnv>) {
  const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);
  if (!requestTransition(item.request.status, "invite", "admin").ok) return errorResponse(c, "conflict", 409);
  const body = await c.req.parseBody({ all: true });
  const picked = new Set(listOf(body.builder));
  const handle = (typeof body.handle === "string" ? body.handle : "").trim().toLowerCase();
  let error: InviteError | null = null;
  if (handle) {
    const builder = HANDLE_RE.test(handle) ? await findPublicBuilderByHandle(c.env.DB, handle) : null;
    if (builder) picked.add(builder.userId);
    else error = "handle";
  }
  if (!error && picked.size === 0) error = "none";
  if (!error && picked.size > MAX_ACTIVE_INVITES - item.activeInvites) error = "too_many";
  if (error) return detailPage(c, item, { inviteError: error, values: { handle } }, 400);

  const admin = c.get("user")!;
  const now = new Date().toISOString();
  const batch = inviteBuildersBatch(c.env.DB, { requestId: item.request.id, builderIds: [...picked], invitedBy: admin.id, now });
  const results = await c.env.DB.batch([
    ...batch.statements,
    auditStatement(
      c.env.DB,
      { actorUserId: admin.id, action: "request.invite", entity: "request", entityId: item.request.id, data: { from: item.request.status, requested: [...picked] }, now },
      { requestId: item.request.id, inviteIds: batch.inviteIds },
    ),
  ]);
  const outcome = batch.read(results);
  if (!outcome.request) return errorResponse(c, "conflict", 409); // nobody was invited: nothing was written
  const mailed = await notifyInvited(c.env, outcome.invited.map((i) => i.id));
  return c.redirect(localizedPath(c.get("locale"), `/admin/requests/${item.request.id}?done=${mailed.failed > 0 ? "mail_failed" : "1"}`), 303);
}

/**
 * Ends the request as the admin (returned or spam): settles the invitations, audits, and after the commit tells the
 * builders whose invitation ended (not_selected / expired; Owner: also after spam). `null` = lost the compare-and-set.
 */
async function end(c: Context<AppEnv>, item: AdminRequest, to: Extract<TerminalRequestStatus, "rejected" | "removed">, adminNote: string | null): Promise<{ request: ClientRequest; mailFailed: boolean } | null> {
  const now = new Date().toISOString();
  const r = item.request;
  const batch = endRequestBatch(c.env.DB, { id: r.id, from: r.status, to, now, adminNote });
  const results = await c.env.DB.batch([
    ...batch.statements,
    auditStatement(
      c.env.DB,
      { actorUserId: c.get("user")!.id, action: to === "rejected" ? "request.reject" : "request.remove", entity: "request", entityId: r.id, data: { from: r.status }, now },
      { requestId: r.id, status: to, updatedAt: now },
    ),
  ]);
  const outcome = batch.read(results);
  if (!outcome.request) return null;
  const tallies = [await notifyNotSelected(c.env, outcome.notSelected), await notifyInviteExpired(c.env, outcome.expired)];
  return { request: outcome.request, mailFailed: tallies.some((t) => t.failed > 0) };
}

export function registerAdminRequestRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/requests", requireAdmin, async (c) => {
    const raw = c.req.query("status");
    const status = raw === "all" ? null : (REQUEST_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as RequestStatus) : "submitted";
    const items = await listRequestsForAdmin(c.env.DB, status);
    return page(c, <AdminRequestsPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} items={items} />);
  });

  onLocalized(app, "get", "/admin/requests/:id", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    return item ? detailPage(c, item) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/requests/:id/invite", requireAdmin, invite);

  // Spec §5.5: return to the client with a required reason, which the client receives by e-mail.
  onLocalized(app, "post", "/admin/requests/:id/reject", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    if (!requestTransition(item.request.status, "reject", "admin").ok) return errorResponse(c, "conflict", 409);
    const body = await c.req.parseBody();
    const note = parseAdminNote(body.note);
    if (!note.ok) return detailPage(c, item, { noteError: true, values: { note: typeof body.note === "string" ? body.note : "" } }, 400);
    const ended = await end(c, item, "rejected", note.note);
    if (!ended) return errorResponse(c, "conflict", 409);
    const mailed = await notifyRequestRejected(c.env, ended.request.id);
    const ok = mailed === "sent" && !ended.mailFailed;
    return c.redirect(localizedPath(c.get("locale"), `/admin/requests/${ended.request.id}?done=${ok ? "1" : "mail_failed"}`), 303);
  });

  // Spec §5.5: spam. The client is not told; builders with an open or answered invitation are (not_selected / expired).
  onLocalized(app, "post", "/admin/requests/:id/remove", requireAdmin, async (c) => {
    const item = await findAdminRequest(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    if (!requestTransition(item.request.status, "remove", "admin").ok) return errorResponse(c, "conflict", 409);
    if (!(await end(c, item, "removed", null))) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), "/admin/requests"), 303);
  });
}
```

`apps/web/src/app.ts`: thêm `import { registerAdminRequestRoutes } from "./routes/admin-requests.tsx";` (cạnh import `registerAdminInquiryRoutes`) và gọi `registerAdminRequestRoutes(app);` ngay sau `registerAdminInquiryRoutes(app);`.

Chạy: `npm test -w apps/web -- test/admin/requests.test.ts test/db/requests.test.ts test/views/proposal.test.ts test/admin` → PASS.

- [ ] **Step 7: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/routes/admin-requests.tsx apps/web/src/views/admin/RequestsPage.tsx apps/web/src/views/admin/RequestDetailPage.tsx apps/web/src/views/proposal.ts apps/web/src/views/labels.ts apps/web/src/views/admin/AdminLayout.tsx apps/web/src/db/requests.ts apps/web/src/app.ts apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/admin/requests.test.ts apps/web/test/views/proposal.test.ts apps/web/test/db/requests.test.ts
git commit -m "feat(web): admin request queue, rule-based builder suggestions and invitations (VNX-0603)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: VNX-0604 — Hub: Invitations, gửi đề xuất / từ chối

> **Đã đối chiếu với code thật (Task 1–4) ngày 2026-10-04.** Khác bản nháp: bỏ `notifyRequestEnded` (Task 5 chỉ gọi `notifyProposal`); tên client luôn qua `builderFacingName` (bản nháp in thẳng `request.clientName`, lộ email khi client gõ email làm tên); câu `UPDATE` kiểm cả builder `approved` + user `active` trong SQL (bản nháp chỉ kiểm ở route); guard audit là `InviteGuard` thật (`{ inviteId, status, updatedAt }`); số lời mời dùng nhãn không số nhiều; bỏ class CSS `badge-invite-*` (chưa có trong `app.css`); thêm test cho Review Focus 1, 2, 4 và Origin.

**Quyết định kỹ thuật:**
- `proposeStatement` / `declineInviteStatement` là compare-and-set với điều kiện `ANSWERABLE` ngay trong SQL: lời mời `invited` **và** request `matching` **và** builder `approved` trên user `active`. Route kiểm trước (404/409) để trả lỗi sớm, nhưng SQL mới là chốt chặn: thua đua thì `RETURNING` rỗng, audit có guard `{ inviteId, status, updatedAt }` nên cũng không ghi, route trả 409 và không gửi mail.
- Builder không còn `approved` (bị khóa) vẫn đọc được lời mời của mình nhưng không thấy form, và POST là 409.
- Lý do từ chối **không** vào `audit_log.data` (chỉ `requestId`); admin đọc lý do ở `request_invites.decline_reason` qua trang request (Task 4 đã hiển thị).
- Hạn 7 ngày / 30 ngày là **mềm** (Owner/controller): lời mời còn `invited` và request còn `matching` thì vẫn trả lời được cho tới khi cron hằng ngày cho hết hạn; `ANSWERABLE` không kiểm thời gian.
- `ProposalView` đặt ở `views/ProposalView.tsx` để Task 6 dùng lại ở `/me`.

**Files:**
- Create: `apps/web/src/routes/hub-invitations.tsx`, `apps/web/src/views/hub/InvitationsPage.tsx`, `apps/web/src/views/ProposalView.tsx`
- Modify: `apps/web/src/db/requests.ts` (`listBuilderInvitations`, `findBuilderInvitation`, `countPendingInvitations`, `proposeStatement`, `declineInviteStatement`, `returnedInvite`)
- Modify: `apps/web/src/views/hub/HubLayout.tsx` (mục `invitations`), `apps/web/src/routes/hub.tsx` + `apps/web/src/views/hub/OverviewPage.tsx` (số lời mời chờ trả lời, spec 5.3), `apps/web/src/app.ts`, `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/hub/invitations.test.ts`

**Interfaces:**
- Consumes (tên thật):
  - `domain/request.ts`: `inviteTransition`, `parseProposal`, `proposalValuesFromBody`, `PRICE_MODES`, `APPROACH_MAX`, `PRICE_NOTE_MAX`, `INVITE_TTL_MS`, `isTerminalRequest`, kiểu `ClientRequest`, `RequestInvite`, `Invitation`, `InvitationListItem`, `ProposalInput`, `ProposalFormValues`, `ProposalErrors`, `ProposalFieldError`, `PriceMode`.
  - `db/requests.ts`: `findRequestById`, `toInvite`, `InviteRow`, `listRequestInvites` (test).
  - `db/audit.ts`: `auditStatement` với guard `InviteGuard` `{ inviteId, status, updatedAt }`.
  - `domain/inquiry.ts`: `parseDeclineReason`, `DECLINE_REASON_MAX`, `builderFacingName`.
  - `notify/request.ts`: `notifyProposal(env, inviteId)` → `Promise<NotifyOutcome>` (không ném lỗi; gửi cho client).
  - `views/RequestFacts.tsx` (`showClient`), `views/proposal.ts` (`proposalPrice`), `views/labels.ts` (`INVITE_STATUS_KEY`, `CATEGORY_KEY`), `auth/middleware.ts` (`requireBuilder`: chưa đăng nhập → 303 `/login`, chưa có hồ sơ builder → 303 `/hub/apply`), `http/localized.ts` (`onLocalized`), `views/error-response.tsx` (`errorResponse`), `views/render.ts` (`page`).
  - Fixtures: `makeRequest`, `makeBuilder`, `inviteBuilders`, `signIn`, `makeInquiry`; helper `formPost`, `getReq`, `testEnv`.
  - Middleware toàn cục (không sửa): `originCheck` (POST không có Origin cùng gốc → 403), `noStorePrivate` (`/hub*` → `Cache-Control: no-store`).
- Produces:
  - `db/requests.ts`: `listBuilderInvitations(db, builderId, limit?)` → `InvitationListItem[]`; `findBuilderInvitation(db, builderId, inviteId)` → `Invitation | null`; `countPendingInvitations(db, builderId)` → `number`; `proposeStatement(db, { inviteId, builderId, proposal, now })` và `declineInviteStatement(db, { inviteId, builderId, reason, now })` → `D1PreparedStatement` (`RETURNING *`); `returnedInvite(result)` → `RequestInvite | null`.
  - `views/ProposalView.tsx`: `ProposalView: FC<{ locale; invite: RequestInvite }>`.
  - `views/hub/InvitationsPage.tsx`: `InvitationListPage`, `InvitationPage`.
  - Route: `GET /hub/invitations`, `GET /hub/invitations/:id`, `POST /hub/invitations/:id/propose`, `POST /hub/invitations/:id/decline`; `registerHubInvitationRoutes(app)`.

- [ ] **Step 1: Chuỗi i18n**

Thêm vào mỗi file `apps/web/src/i18n/messages/<locale>.ts`, ngay sau dòng `"proposal.note"`. Các khóa `invite.status.*`, `proposal.approach|price|timeline|days|note|price.*`, `request.facts.*`, `inquiry.error.*` đã có từ Task 3–4, không thêm lại.

`en.ts`:

```ts
  "hub.nav.invitations": "Invitations",
  "hub.invitations.title": "Invitations",
  "hub.invitations.empty": "No invitations yet. When our team matches a client's request with you, it appears here.",
  "hub.invitations.waiting": "Invitations waiting for your reply: {n}",
  "hub.invitations.from": "Request from {name}",
  "hub.invitations.replyBy": "Reply by {date}.",
  "hub.invitations.ended": "This request has ended.",
  "hub.invitations.inquiry": "Open the inquiry",
  "proposal.form.title": "Send a proposal",
  "proposal.form.approachHint": "Up to 2000 characters. How you would build it and what is included.",
  "proposal.form.priceMode": "Price",
  "proposal.form.mode.fixed": "Fixed price",
  "proposal.form.mode.range": "Price range",
  "proposal.form.mode.discuss": "To discuss",
  "proposal.form.price": "Price or lower bound (USD)",
  "proposal.form.priceMax": "Upper bound (USD, for a range)",
  "proposal.form.timelineHint": "Estimated working days, 1–365.",
  "proposal.form.submit": "Send proposal",
  "proposal.form.decline": "Decline invitation",
  "proposal.form.declineReason": "Reason (optional; our team sees it, the client does not)",
  "proposal.yours": "Your proposal",
  "proposal.error.amount": "Enter a whole number of US dollars from 1 to 1,000,000.",
  "proposal.error.range": "The upper bound must be higher than the lower bound.",
  "proposal.error.days": "Enter a number of days from 1 to 365.",
```

`vi.ts`:

```ts
  "hub.nav.invitations": "Lời mời",
  "hub.invitations.title": "Lời mời",
  "hub.invitations.empty": "Chưa có lời mời nào. Khi đội ngũ VNX.SI ghép nhu cầu của một client với bạn, lời mời sẽ hiện ở đây.",
  "hub.invitations.waiting": "Lời mời đang chờ bạn trả lời: {n}",
  "hub.invitations.from": "Nhu cầu của {name}",
  "hub.invitations.replyBy": "Trả lời trước {date}.",
  "hub.invitations.ended": "Nhu cầu này đã kết thúc.",
  "hub.invitations.inquiry": "Mở yêu cầu",
  "proposal.form.title": "Gửi đề xuất",
  "proposal.form.approachHint": "Tối đa 2000 ký tự. Bạn sẽ làm thế nào và gồm những gì.",
  "proposal.form.priceMode": "Giá",
  "proposal.form.mode.fixed": "Giá cố định",
  "proposal.form.mode.range": "Khoảng giá",
  "proposal.form.mode.discuss": "Cần trao đổi thêm",
  "proposal.form.price": "Giá hoặc mức thấp nhất (USD)",
  "proposal.form.priceMax": "Mức cao nhất (USD, khi chọn khoảng giá)",
  "proposal.form.timelineHint": "Số ngày làm việc dự kiến, 1–365.",
  "proposal.form.submit": "Gửi đề xuất",
  "proposal.form.decline": "Từ chối lời mời",
  "proposal.form.declineReason": "Lý do (tùy chọn; đội ngũ VNX.SI thấy, client không thấy)",
  "proposal.yours": "Đề xuất của bạn",
  "proposal.error.amount": "Nhập số đô la Mỹ nguyên từ 1 đến 1.000.000.",
  "proposal.error.range": "Mức cao nhất phải lớn hơn mức thấp nhất.",
  "proposal.error.days": "Nhập số ngày từ 1 đến 365.",
```

`zh-hans.ts`:

```ts
  "hub.nav.invitations": "邀请",
  "hub.invitations.title": "邀请",
  "hub.invitations.empty": "还没有邀请。当 VNX.SI 团队把客户的需求与你匹配时，邀请会显示在这里。",
  "hub.invitations.waiting": "等待你回复的邀请：{n}",
  "hub.invitations.from": "{name} 的需求",
  "hub.invitations.replyBy": "请在 {date} 前回复。",
  "hub.invitations.ended": "这条需求已结束。",
  "hub.invitations.inquiry": "打开咨询",
  "proposal.form.title": "提交方案",
  "proposal.form.approachHint": "最多 2000 个字符。你会如何实现、包含哪些内容。",
  "proposal.form.priceMode": "价格",
  "proposal.form.mode.fixed": "固定价格",
  "proposal.form.mode.range": "价格区间",
  "proposal.form.mode.discuss": "待商议",
  "proposal.form.price": "价格或下限（美元）",
  "proposal.form.priceMax": "上限（美元，选择区间时填写）",
  "proposal.form.timelineHint": "预计工作天数，1–365。",
  "proposal.form.submit": "提交方案",
  "proposal.form.decline": "婉拒邀请",
  "proposal.form.declineReason": "原因（可选；VNX.SI 团队可见，客户不可见）",
  "proposal.yours": "你的方案",
  "proposal.error.amount": "请输入 1 到 1,000,000 之间的整数美元。",
  "proposal.error.range": "上限必须高于下限。",
  "proposal.error.days": "请输入 1 到 365 之间的天数。",
```

`zh-hant.ts`:

```ts
  "hub.nav.invitations": "邀請",
  "hub.invitations.title": "邀請",
  "hub.invitations.empty": "還沒有邀請。當 VNX.SI 團隊把客戶的需求與你媒合時，邀請會顯示在這裡。",
  "hub.invitations.waiting": "等待你回覆的邀請：{n}",
  "hub.invitations.from": "{name} 的需求",
  "hub.invitations.replyBy": "請在 {date} 前回覆。",
  "hub.invitations.ended": "這則需求已結束。",
  "hub.invitations.inquiry": "打開詢問",
  "proposal.form.title": "提交方案",
  "proposal.form.approachHint": "最多 2000 個字元。你會如何實作、包含哪些內容。",
  "proposal.form.priceMode": "價格",
  "proposal.form.mode.fixed": "固定價格",
  "proposal.form.mode.range": "價格區間",
  "proposal.form.mode.discuss": "待商議",
  "proposal.form.price": "價格或下限（美元）",
  "proposal.form.priceMax": "上限（美元，選擇區間時填寫）",
  "proposal.form.timelineHint": "預計工作天數，1–365。",
  "proposal.form.submit": "提交方案",
  "proposal.form.decline": "婉拒邀請",
  "proposal.form.declineReason": "原因（選填；VNX.SI 團隊可見，客戶不可見）",
  "proposal.yours": "你的方案",
  "proposal.error.amount": "請輸入 1 到 1,000,000 之間的整數美元。",
  "proposal.error.range": "上限必須高於下限。",
  "proposal.error.days": "請輸入 1 到 365 之間的天數。",
```

- [ ] **Step 2: Test Hub (fail)**

`apps/web/test/hub/invitations.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { auditStatement } from "../../src/db/audit.ts";
import { declineInviteStatement, listRequestInvites, proposeStatement, returnedInvite } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { inviteBuilders, makeBuilder, makeInquiry, makeRequest, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const proposal = { approach: "Next.js with a booking calendar and SMS reminders.", priceMode: "range", price: "3000", priceMax: "5000", priceNote: "Hosting not included", timelineDays: "30" };
const inviteOf = async (requestId: string) => (await listRequestInvites(testEnv.DB, requestId))[0]!.invite;
const audits = async (inviteId: string) => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'request_invite' AND entity_id = ?1").bind(inviteId).first<{ n: number }>())?.n ?? 0;

async function invitedPair(tag: string) {
  const { client, request } = await makeRequest({ tag });
  const builder = await makeBuilder(`${tag}-b@vnx.si`, `${tag}-b`, "approved");
  const [invite] = await inviteBuilders(request, [builder]);
  const { cookie } = await signIn(`${tag}-b@vnx.si`);
  return { client, request, builder, invite: invite!, cookie };
}

/** Nothing was written for this invitation: still `invited`, no audit row, no e-mail. */
async function expectUntouched(requestId: string, inviteId: string) {
  expect((await inviteOf(requestId)).status).toBe("invited");
  expect(await audits(inviteId)).toBe(0);
  expect(outbox).toEqual([]);
}

describe("Hub invitations (spec §5.3, §5.7 step 3)", () => {
  beforeEach(() => clearOutbox());

  it("lists the builder's own invitations, counts those waiting on the overview, links the tab", async () => {
    const { request, invite, cookie } = await invitedPair("hi-list");
    const other = await invitedPair("hi-list2");
    const res = await get("/hub/invitations", cookie);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain(`href="/hub/invitations/${invite.id}"`);
    expect(html).toContain(request.title);
    expect(html).not.toContain(other.invite.id);
    expect(html).toContain('href="/hub/invitations"');
    expect(await (await get("/hub", cookie)).text()).toContain("Invitations waiting for your reply: 1");
  });

  it("shows the request and the client's typed name with the reply-by date", async () => {
    const { invite, cookie } = await invitedPair("hi-page");
    const res = await get(`/hub/invitations/${invite.id}`, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("Request from Minh Tran");
    expect(html).toContain("We need online booking with SMS reminders");
    expect(html).toContain(`Reply by ${new Date(Date.parse(invite.invitedAt) + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)}.`);
  });

  // Review Focus 1: a client who types their e-mail as their name must not leak it, on any /hub/invitations* page.
  it("never shows the client's e-mail, even when the client typed it as their name", async () => {
    const { client, request, invite, cookie } = await invitedPair("hi-leak");
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run();
    const bad = await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, approach: "" });
    expect(bad.status).toBe(400);
    const badDecline = await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "x".repeat(1001) });
    expect(badDecline.status).toBe(400);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(303);
    const pages = [await (await get("/hub/invitations", cookie)).text(), await (await get(`/hub/invitations/${invite.id}`, cookie)).text(), await bad.text(), await badDecline.text()];
    for (const html of pages) expect(html).not.toContain(client.email);
    expect(pages[1]).toContain("Request from •••");
    expect(pages[1]).toContain("Posted by");
  });

  // Review Focus 2.
  it("404s for another builder, a builder never invited and a removed request; nothing is written", async () => {
    const { request, invite } = await invitedPair("hi-404");
    await makeBuilder("hi-404-x@vnx.si", "hi-404-x", "approved");
    const { cookie: other } = await signIn("hi-404-x@vnx.si");
    expect((await get(`/hub/invitations/${invite.id}`, other)).status).toBe(404);
    expect(await (await get("/hub/invitations", other)).text()).not.toContain(invite.id);
    expect((await post(`/hub/invitations/${invite.id}/propose`, other, proposal)).status).toBe(404);
    expect((await post(`/hub/invitations/${invite.id}/decline`, other, { reason: "no" })).status).toBe(404);
    await expectUntouched(request.id, invite.id);

    const { cookie } = await signIn("hi-404-b@vnx.si");
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    expect((await get(`/hub/invitations/${invite.id}`, cookie)).status).toBe(404);
    expect(await (await get("/hub/invitations", cookie)).text()).not.toContain(invite.id);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(404);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(404);
    await expectUntouched(request.id, invite.id);
  });

  it("sends signed-out visitors to sign in and people without a builder profile to the application", async () => {
    const { invite } = await invitedPair("hi-gate");
    expect((await get(`/hub/invitations/${invite.id}`)).status).toBe(303);
    const { cookie } = await signIn("hi-gate-nobuilder@vnx.si");
    const res = await get(`/hub/invitations/${invite.id}`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub/apply");
  });

  it("sends a proposal once: saved, the client is told, audited; then 409 with nothing more", async () => {
    const { request, client, invite, cookie } = await invitedPair("hi-prop");
    const res = await post(`/vi/hub/invitations/${invite.id}/propose`, cookie, proposal);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/hub/invitations/${invite.id}`);
    expect(await inviteOf(request.id)).toMatchObject({ status: "proposed", priceCents: 300000, priceMaxCents: 500000, priceNote: "Hosting not included", timelineDays: 30 });
    expect((await inviteOf(request.id)).respondedAt).not.toBeNull();
    expect(outbox.map((m) => m.to)).toEqual([client.email]);
    expect(await audits(invite.id)).toBe(1);
    const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
    expect(html).toContain("Your proposal");
    expect(html).toContain("$3,000 – $5,000");
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(409);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(1);
    expect(await audits(invite.id)).toBe(1);
  });

  it("keeps the proposal when the client e-mail cannot be sent", async () => {
    const { request, invite, cookie } = await invitedPair("hi-nomail");
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal, noMail)).status).toBe(303);
    expect((await inviteOf(request.id)).status).toBe("proposed");
  });

  it("accepts a fixed price and 'to discuss' (no amount)", async () => {
    const fixed = await invitedPair("hi-fixed");
    await post(`/hub/invitations/${fixed.invite.id}/propose`, fixed.cookie, { ...proposal, priceMode: "fixed", priceMax: "" });
    expect(await inviteOf(fixed.request.id)).toMatchObject({ status: "proposed", priceCents: 300000, priceMaxCents: null });
    const discuss = await invitedPair("hi-disc");
    await post(`/hub/invitations/${discuss.invite.id}/propose`, discuss.cookie, { ...proposal, priceMode: "discuss", price: "", priceMax: "" });
    expect(await inviteOf(discuss.request.id)).toMatchObject({ status: "proposed", priceCents: null, priceMaxCents: null });
    expect(await (await get(`/hub/invitations/${discuss.invite.id}`, discuss.cookie)).text()).toContain("To discuss");
  });

  it("re-renders a broken proposal with errors and the typed values, writing nothing", async () => {
    const { request, invite, cookie } = await invitedPair("hi-bad");
    const res = await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, priceMax: "2000", timelineDays: "0" });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("The upper bound must be higher than the lower bound.");
    expect(html).toContain("Enter a number of days from 1 to 365.");
    expect(html).toContain("Next.js with a booking calendar and SMS reminders.</textarea>");
    for (const bad of [{ approach: "  " }, { approach: "x".repeat(2001) }, { priceMode: "free" }, { price: "1000001" }, { priceNote: "n".repeat(201) }, { timelineDays: "366" }]) {
      expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, priceMode: "fixed", priceMax: "", ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    await expectUntouched(request.id, invite.id);
  });

  it("declines with an optional reason: no e-mail to the client, the admin sees the reason", async () => {
    const { request, invite, cookie } = await invitedPair("hi-dec");
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "x".repeat(1001) })).status).toBe(400);
    await expectUntouched(request.id, invite.id);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "Fully booked until March." })).status).toBe(303);
    expect(await inviteOf(request.id)).toMatchObject({ status: "declined", declineReason: "Fully booked until March." });
    expect(outbox).toEqual([]);
    expect(await audits(invite.id)).toBe(1);
    const admin = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect(await (await get(`/admin/requests/${request.id}`, admin)).text()).toContain("Fully booked until March.");
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(409);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(409);
  });

  // Review Focus 4: only invited + matching + approved is accepted.
  it("409s a proposal or decline once the request closed, expired or was chosen, or the builder was suspended", async () => {
    for (const [ended, tag] of [["closed", "closed"], ["expired", "expired"], ["builder_selected", "sel"]]) { // tags: hyphens only (handle rule)
      const { request, invite, cookie } = await invitedPair(`hi-end-${tag}`);
      await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(request.id, ended).run();
      expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status, ended).toBe(409);
      expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status, ended).toBe(409);
      await expectUntouched(request.id, invite.id);
      const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
      expect(html).toContain("This request has ended.");
      expect(html).not.toContain("/propose");
    }
    const susp = await invitedPair("hi-susp");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(susp.builder.userId).run();
    expect((await post(`/hub/invitations/${susp.invite.id}/propose`, susp.cookie, proposal)).status).toBe(409);
    expect((await post(`/hub/invitations/${susp.invite.id}/decline`, susp.cookie)).status).toBe(409);
    const read = await get(`/hub/invitations/${susp.invite.id}`, susp.cookie);
    expect(read.status).toBe(200);
    const readHtml = await read.text();
    expect(readHtml).not.toContain("/propose");
    expect(readHtml).not.toContain("/decline");
    await expectUntouched(susp.request.id, susp.invite.id);
  });

  // The route's pre-check cannot catch a race, so every SQL guard of ANSWERABLE (and the guarded audit) is tested directly:
  // each case would write a row if its guard were missing.
  it("a lost compare-and-set writes neither the answer nor the audit row", async () => {
    type Lose = (ctx: { requestId: string; inviteId: string; builderId: string }) => Promise<string | void>; // returns the builderId to act as
    const run = (sql: string, ...args: string[]) => testEnv.DB.prepare(sql).bind(...args).run();
    const cases: [string, "propose" | "decline", Lose][] = [
      ["request closed", "propose", async ({ requestId }) => void (await run("UPDATE requests SET status = 'closed' WHERE id = ?1", requestId))],
      ["invite left invited", "propose", async ({ inviteId }) => void (await run("UPDATE request_invites SET status = 'expired' WHERE id = ?1", inviteId))],
      ["builder suspended", "propose", async ({ builderId }) => void (await run("UPDATE builders SET status = 'suspended' WHERE user_id = ?1", builderId))],
      ["user suspended", "propose", async ({ builderId }) => void (await run("UPDATE users SET status = 'suspended' WHERE id = ?1", builderId))],
      ["another builder", "propose", async () => (await makeBuilder("hi-cas-other@vnx.si", "hi-cas-other", "approved")).userId],
      ["decline, request closed", "decline", async ({ requestId }) => void (await run("UPDATE requests SET status = 'closed' WHERE id = ?1", requestId))],
      ["decline, invite left invited", "decline", async ({ inviteId }) => void (await run("UPDATE request_invites SET status = 'expired' WHERE id = ?1", inviteId))],
    ];
    for (const [i, [name, action, lose]] of cases.entries()) {
      const { request, builder, invite } = await invitedPair(`hi-cas-${i}`);
      const actAs = (await lose({ requestId: request.id, inviteId: invite.id, builderId: builder.userId })) ?? builder.userId;
      const now = new Date().toISOString();
      const statement =
        action === "propose"
          ? proposeStatement(testEnv.DB, { inviteId: invite.id, builderId: actAs, proposal: { approach: "x", priceCents: null, priceMaxCents: null, priceNote: "", timelineDays: 5 }, now })
          : declineInviteStatement(testEnv.DB, { inviteId: invite.id, builderId: actAs, reason: "no", now });
      const [moved] = await testEnv.DB.batch([
        statement,
        auditStatement(testEnv.DB, { actorUserId: actAs, action: `request_invite.${action}`, entity: "request_invite", entityId: invite.id, now }, { inviteId: invite.id, status: action === "propose" ? "proposed" : "declined", updatedAt: now }),
      ]);
      expect(returnedInvite(moved), name).toBeNull();
      const row = await inviteOf(request.id);
      expect(row.status, name).toBe(name.includes("left invited") ? "expired" : "invited");
      expect(row.approach, name).toBeNull();
      expect(row.declineReason, name).toBeNull();
      expect(await audits(invite.id), name).toBe(0);
      expect(outbox, name).toEqual([]);
    }
  });

  it("rejects a POST without a same-origin Origin header", async () => {
    const { request, invite, cookie } = await invitedPair("hi-origin");
    for (const headers of [{ cookie } as Record<string, string>, { cookie, origin: "https://evil.example" }]) {
      const res = await app().request(
        new Request(`https://vnx.si/hub/invitations/${invite.id}/propose`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(proposal) }),
        undefined,
        testEnv,
      );
      expect(res.status).toBe(403);
    }
    await expectUntouched(request.id, invite.id);
  });

  it("shows a chosen proposal as chosen, with a link to the inquiry", async () => {
    const { request, invite, cookie } = await invitedPair("hi-sel");
    // The inquiry belongs to another builder: this checks the markup only; Task 6's exit test covers the link end to end.
    const { inquiry } = await makeInquiry({ tag: "hi-sel-q", status: "open" });
    await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal);
    await testEnv.DB.prepare("UPDATE request_invites SET status = 'selected', inquiry_id = ?2 WHERE id = ?1").bind(invite.id, inquiry.id).run();
    await testEnv.DB.prepare("UPDATE requests SET status = 'builder_selected' WHERE id = ?1").bind(request.id).run();
    const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
    expect(html).toContain("Chosen");
    expect(html).toContain(`href="/hub/inquiries/${inquiry.id}"`);
  });
});
```

Chạy: `npm test -w apps/web -- test/hub/invitations.test.ts` → FAIL (route và hàm db chưa có).

- [ ] **Step 3: db cho Hub**

Thêm vào `apps/web/src/db/requests.ts`, và thêm `type Invitation`, `type InvitationListItem`, `type ProposalInput` vào import từ `../domain/request.ts`:

```ts
/** The builder's Invitations tab, newest first. Requests removed as spam disappear (spec §5.3). */
export async function listBuilderInvitations(db: D1Database, builderId: string, limit = 200): Promise<InvitationListItem[]> {
  const { results } = await db
    .prepare(
      `SELECT x.*, r.title AS request_title, r.category AS request_category, r.status AS request_status
       FROM request_invites x JOIN requests r ON r.id = x.request_id
       WHERE x.builder_id = ?1 AND r.status != 'removed'
       ORDER BY x.invited_at DESC, x.rowid DESC LIMIT ?2`,
    )
    .bind(builderId, limit)
    .all<InviteRow & { request_title: string; request_category: Category; request_status: RequestStatus }>();
  return results.map((r) => ({ invite: toInvite(r), requestTitle: r.request_title, requestCategory: r.request_category, requestStatus: r.request_status }));
}

/** Spec §9: a builder who was not invited cannot see the request; a removed request reads as missing too. */
export async function findBuilderInvitation(db: D1Database, builderId: string, inviteId: string): Promise<Invitation | null> {
  const row = await db.prepare("SELECT * FROM request_invites WHERE id = ?1 AND builder_id = ?2").bind(inviteId, builderId).first<InviteRow>();
  if (!row) return null;
  const request = await findRequestById(db, row.request_id);
  if (!request || request.status === "removed") return null;
  return { invite: toInvite(row), request };
}

/** Spec §5.3 overview: invitations still waiting for this builder's answer. */
export async function countPendingInvitations(db: D1Database, builderId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM request_invites x JOIN requests r ON r.id = x.request_id WHERE x.builder_id = ?1 AND x.status = 'invited' AND r.status = 'matching'")
    .bind(builderId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Spec §7.6: the invitation is still `invited`, the request is `matching` and the builder is still approved on an active
// account. Checked inside the statement itself (the architecture test reads upper-case SQL words in comments), so a request closed (or a builder suspended) after the route read it loses.
const ANSWERABLE = `request_invites.status = 'invited'
  AND EXISTS (SELECT 1 FROM requests r WHERE r.id = request_invites.request_id AND r.status = 'matching')
  AND EXISTS (SELECT 1 FROM builders b JOIN users u ON u.id = b.user_id WHERE b.user_id = request_invites.builder_id AND b.status = 'approved' AND u.status = 'active')`;

/** Spec §7.6 propose: invited -> proposed. RETURNING the row, or nothing when it lost. Batch it with a guarded audit row. */
export function proposeStatement(db: D1Database, input: { inviteId: string; builderId: string; proposal: ProposalInput; now: string }): D1PreparedStatement {
  const p = input.proposal;
  return db
    .prepare(
      `UPDATE request_invites SET status = 'proposed', approach = ?3, price_cents = ?4, price_max_cents = ?5, price_note = NULLIF(?6, ''),
         timeline_days = ?7, responded_at = ?8, updated_at = ?8
       WHERE id = ?1 AND builder_id = ?2 AND ${ANSWERABLE}
       RETURNING *`,
    )
    .bind(input.inviteId, input.builderId, p.approach, p.priceCents, p.priceMaxCents, p.priceNote, p.timelineDays, input.now);
}

/** Spec §7.6 decline: invited -> declined with an optional reason (the client never sees it). Same rules as propose. */
export function declineInviteStatement(db: D1Database, input: { inviteId: string; builderId: string; reason: string; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'declined', decline_reason = NULLIF(?3, ''), responded_at = ?4, updated_at = ?4
       WHERE id = ?1 AND builder_id = ?2 AND ${ANSWERABLE}
       RETURNING *`,
    )
    .bind(input.inviteId, input.builderId, input.reason, input.now);
}

export function returnedInvite(result: D1Result | undefined): RequestInvite | null {
  const row = result?.results[0] as InviteRow | undefined;
  return row ? toInvite(row) : null;
}
```

- [ ] **Step 4: Views**

`apps/web/src/views/ProposalView.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { RequestInvite } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { PlainText } from "./PlainText.tsx";
import { proposalPrice } from "./proposal.ts";

/** A builder's proposal (spec §5.7 step 3), for the builder (Hub) and the client (/me, Task 6). */
export const ProposalView: FC<{ locale: Locale; invite: RequestInvite }> = ({ locale, invite }) => {
  const tr = translator(locale);
  return (
    <>
      <dl class="facts">
        <dt>{tr("proposal.price")}</dt>
        <dd>{proposalPrice(locale, invite)}</dd>
        {invite.priceNote ? (
          <>
            <dt>{tr("proposal.note")}</dt>
            <dd>{invite.priceNote}</dd>
          </>
        ) : null}
        <dt>{tr("proposal.timeline")}</dt>
        <dd>{tr("proposal.days", { n: invite.timelineDays ?? 0 })}</dd>
      </dl>
      {invite.approach ? <PlainText text={invite.approach} /> : null}
    </>
  );
};
```

`apps/web/src/views/hub/InvitationsPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { builderFacingName, DECLINE_REASON_MAX } from "../../domain/inquiry.ts";
import { APPROACH_MAX, INVITE_TTL_MS, isTerminalRequest, PRICE_MODES, PRICE_NOTE_MAX, type Invitation, type InvitationListItem, type PriceMode, type ProposalErrors, type ProposalFieldError, type ProposalFormValues } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, INVITE_STATUS_KEY } from "../labels.ts";
import { ProposalView } from "../ProposalView.tsx";
import { RequestFacts } from "../RequestFacts.tsx";
import { HubLayout } from "./HubLayout.tsx";

const MODE_KEY: Record<PriceMode, MessageKey> = {
  fixed: "proposal.form.mode.fixed",
  range: "proposal.form.mode.range",
  discuss: "proposal.form.mode.discuss",
};
const ERROR_KEY: Record<ProposalFieldError, MessageKey> = {
  required: "inquiry.error.required",
  too_long: "inquiry.error.too_long",
  choice: "inquiry.error.choice",
  amount: "proposal.error.amount",
  range: "proposal.error.range",
  days: "proposal.error.days",
};

export const InvitationListPage: FC<{ locale: Locale; origin: string; items: InvitationListItem[] }> = ({ locale, origin, items }) => {
  const tr = translator(locale);
  return (
    <HubLayout locale={locale} origin={origin} title={tr("hub.invitations.title")} rest="/hub/invitations" active="invitations">
      <h1>{tr("hub.invitations.title")}</h1>
      {items.length === 0 ? (
        <p class="muted">{tr("hub.invitations.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <tbody>
              {items.map(({ invite, requestTitle, requestCategory }) => (
                <tr>
                  <td>
                    <a href={localizedPath(locale, `/hub/invitations/${invite.id}`)}>{requestTitle}</a>
                  </td>
                  <td>{tr(CATEGORY_KEY[requestCategory])}</td>
                  <td>
                    <span class="badge">{tr(INVITE_STATUS_KEY[invite.status])}</span>
                  </td>
                  <td class="muted">{invite.invitedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HubLayout>
  );
};

type PageProps = {
  locale: Locale;
  origin: string;
  item: Invitation;
  /** The signed-in builder is still `approved`: a suspended builder reads but cannot answer. */
  approved: boolean;
  values?: ProposalFormValues;
  errors?: ProposalErrors;
  reason?: string;
  reasonError?: boolean;
};

const EMPTY: ProposalFormValues = { approach: "", priceMode: "fixed", price: "", priceMax: "", priceNote: "", timelineDays: "" };

/** Spec §5.7 step 3: the builder reads the request (the client's typed name only, e-mail-like parts masked) and proposes or declines. */
export const InvitationPage: FC<PageProps> = (p) => {
  const tr = translator(p.locale);
  const { invite, request } = p.item;
  const base = localizedPath(p.locale, `/hub/invitations/${invite.id}`);
  const v = p.values ?? EMPTY;
  const errors = p.errors ?? {};
  const err = (field: keyof ProposalFormValues) => {
    const code = errors[field];
    return code ? (
      <p id={`pp-${field}-error`} class="error-msg" role="alert">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: keyof ProposalFormValues) => (errors[field] ? { "aria-invalid": "true", "aria-describedby": `pp-${field}-error` } : {});
  const answerable = p.approved && invite.status === "invited" && request.status === "matching";
  const replyBy = new Date(Date.parse(invite.invitedAt) + INVITE_TTL_MS).toISOString().slice(0, 10);
  const title = tr("hub.invitations.from", { name: builderFacingName(request.clientName) });
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={title} rest={`/hub/invitations/${invite.id}`} active="invitations">
      <p>
        <a href={localizedPath(p.locale, "/hub/invitations")}>{tr("hub.invitations.title")}</a>
      </p>
      <h1>{request.title}</h1>
      <p>
        {title} · <span class="badge">{tr(INVITE_STATUS_KEY[invite.status])}</span>
      </p>
      {answerable ? <p class="notice">{tr("hub.invitations.replyBy", { date: replyBy })}</p> : null}
      {isTerminalRequest(request.status) ? <p class="notice">{tr("hub.invitations.ended")}</p> : null}
      <section class="card wide">
        <RequestFacts locale={p.locale} request={request} showClient />
      </section>

      {invite.approach !== null ? (
        <section class="card wide">
          <h2>{tr("proposal.yours")}</h2>
          <ProposalView locale={p.locale} invite={invite} />
          {invite.status === "selected" && invite.inquiryId ? (
            <p>
              <a class="btn" href={localizedPath(p.locale, `/hub/inquiries/${invite.inquiryId}`)}>
                {tr("hub.invitations.inquiry")}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {answerable ? (
        <>
          <form method="post" action={`${base}/propose`} class="card wide">
            <h2>{tr("proposal.form.title")}</h2>
            <div class="field">
              <label for="pp-approach">{tr("proposal.approach")}</label>
              <textarea id="pp-approach" name="approach" required maxlength={APPROACH_MAX} {...aria("approach")}>
                {v.approach}
              </textarea>
              <p class="hint">{tr("proposal.form.approachHint")}</p>
              {err("approach")}
            </div>
            <fieldset class="field" {...aria("priceMode")}>
              <legend>{tr("proposal.form.priceMode")}</legend>
              {PRICE_MODES.map((m) => (
                <label class="choice">
                  <input type="radio" name="priceMode" value={m} checked={v.priceMode === m} required /> {tr(MODE_KEY[m])}
                </label>
              ))}
              {err("priceMode")}
            </fieldset>
            <div class="field">
              <label for="pp-price">{tr("proposal.form.price")}</label>
              <input id="pp-price" name="price" inputmode="numeric" value={v.price} {...aria("price")} />
              {err("price")}
            </div>
            <div class="field">
              <label for="pp-priceMax">{tr("proposal.form.priceMax")}</label>
              <input id="pp-priceMax" name="priceMax" inputmode="numeric" value={v.priceMax} {...aria("priceMax")} />
              {err("priceMax")}
            </div>
            <div class="field">
              <label for="pp-priceNote">{tr("proposal.note")}</label>
              <input id="pp-priceNote" name="priceNote" maxlength={PRICE_NOTE_MAX} value={v.priceNote} {...aria("priceNote")} />
              {err("priceNote")}
            </div>
            <div class="field">
              <label for="pp-timelineDays">{tr("proposal.timeline")}</label>
              <input id="pp-timelineDays" name="timelineDays" type="number" min={1} max={365} required value={v.timelineDays} {...aria("timelineDays")} />
              <p class="hint">{tr("proposal.form.timelineHint")}</p>
              {err("timelineDays")}
            </div>
            <button class="btn" type="submit">
              {tr("proposal.form.submit")}
            </button>
          </form>
          <form method="post" action={`${base}/decline`} class="card wide">
            <div class="field">
              <label for="pp-reason">{tr("proposal.form.declineReason")}</label>
              <textarea id="pp-reason" name="reason" maxlength={DECLINE_REASON_MAX} aria-invalid={p.reasonError ? "true" : undefined}>
                {p.reason ?? ""}
              </textarea>
              {p.reasonError ? (
                <p class="error-msg" role="alert">
                  {tr("inquiry.error.too_long")}
                </p>
              ) : null}
            </div>
            <button class="btn btn-secondary" type="submit">
              {tr("proposal.form.decline")}
            </button>
          </form>
        </>
      ) : null}
    </HubLayout>
  );
};
```

`apps/web/src/views/hub/HubLayout.tsx`: `HubSection` thêm `"invitations"`; `NAV` thêm `{ key: "invitations", path: "/hub/invitations", label: "hub.nav.invitations" }` sau `inquiries`.

`apps/web/src/views/hub/OverviewPage.tsx`: thêm prop `pendingInvitations: number` (vào kiểu và destructuring) và một `section` sau khối Inquiries:

```tsx
      <section class="card wide">
        <h2>{tr("hub.nav.invitations")}</h2>
        <p>{tr("hub.invitations.waiting", { n: pendingInvitations })}</p>
        <p>
          <a href={localizedPath(locale, "/hub/invitations")}>{tr("hub.invitations.title")}</a>
        </p>
      </section>
```

`apps/web/src/routes/hub.tsx`, GET `/hub`: nạp thêm `countPendingInvitations(c.env.DB, builder.userId)` (import từ `../db/requests.ts`) trong `Promise.all` và truyền `pendingInvitations`.

- [ ] **Step 5: Route**

`apps/web/src/routes/hub-invitations.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { declineInviteStatement, findBuilderInvitation, listBuilderInvitations, proposeStatement, returnedInvite } from "../db/requests.ts";
import { parseDeclineReason } from "../domain/inquiry.ts";
import { inviteTransition, parseProposal, proposalValuesFromBody, type Invitation } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyProposal } from "../notify/request.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InvitationListPage, InvitationPage } from "../views/hub/InvitationsPage.tsx";
import { page } from "../views/render.ts";

type Extra = Omit<Parameters<typeof InvitationPage>[0], "locale" | "origin" | "item" | "approved">;

function invitationPage(c: Context<AppEnv>, item: Invitation, extra: Extra = {}, status: 200 | 400 = 200) {
  return page(c, <InvitationPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} approved={c.get("builder").status === "approved"} {...extra} />, status);
}

/**
 * Spec §5.7 step 3 / §7.6: propose or decline. The route reads first (404 for anything that is not this builder's
 * invitation, 409 unless invited + matching + approved); the compare-and-set repeats those checks in SQL and the audit
 * row is guarded by it, in one batch: a lost race writes nothing, sends nothing and is a 409.
 */
async function respond(c: Context<AppEnv>, action: "propose" | "decline") {
  const builder = c.get("builder");
  const item = await findBuilderInvitation(c.env.DB, builder.userId, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);
  const next = inviteTransition(item.invite.status, action, "builder");
  if (builder.status !== "approved" || !next.ok || item.request.status !== "matching") return errorResponse(c, "conflict", 409);

  const body = await c.req.parseBody();
  const now = new Date().toISOString();
  let statement: D1PreparedStatement;
  if (action === "propose") {
    const values = proposalValuesFromBody(body);
    const parsed = parseProposal(values);
    if (!parsed.ok) return invitationPage(c, item, { values, errors: parsed.errors }, 400);
    statement = proposeStatement(c.env.DB, { inviteId: item.invite.id, builderId: builder.userId, proposal: parsed.input, now });
  } else {
    const reason = parseDeclineReason(body.reason);
    if (!reason.ok) return invitationPage(c, item, { reason: typeof body.reason === "string" ? body.reason : "", reasonError: true }, 400);
    statement = declineInviteStatement(c.env.DB, { inviteId: item.invite.id, builderId: builder.userId, reason: reason.reason, now });
  }
  const [moved] = await c.env.DB.batch([
    statement,
    auditStatement(c.env.DB, { actorUserId: builder.userId, action: `request_invite.${action}`, entity: "request_invite", entityId: item.invite.id, data: { requestId: item.request.id }, now }, { inviteId: item.invite.id, status: next.status, updatedAt: now }),
  ]);
  if (!returnedInvite(moved)) return errorResponse(c, "conflict", 409);
  // Declining sends nothing to the client (plan M6). A proposal tells the client; notifyProposal never throws.
  if (action === "propose") await notifyProposal(c.env, item.invite.id);
  return c.redirect(localizedPath(c.get("locale"), `/hub/invitations/${item.invite.id}`), 303);
}

export function registerHubInvitationRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/invitations", requireBuilder, async (c) => {
    const items = await listBuilderInvitations(c.env.DB, c.get("builder").userId);
    return page(c, <InvitationListPage locale={c.get("locale")} origin={requestOrigin(c)} items={items} />);
  });

  onLocalized(app, "get", "/hub/invitations/:id", requireBuilder, async (c) => {
    const item = await findBuilderInvitation(c.env.DB, c.get("builder").userId, c.req.param("id") ?? "");
    return item ? invitationPage(c, item) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/hub/invitations/:id/propose", requireBuilder, (c) => respond(c, "propose"));
  onLocalized(app, "post", "/hub/invitations/:id/decline", requireBuilder, (c) => respond(c, "decline"));
}
```

`apps/web/src/app.ts`: import `registerHubInvitationRoutes` từ `./routes/hub-invitations.tsx` và gọi `registerHubInvitationRoutes(app)` ngay sau `registerHubInquiryRoutes(app)`.

Chạy: `npm test -w apps/web -- test/hub/invitations.test.ts` → PASS; rồi `npm test -w apps/web -- test/hub test/architecture.test.ts test/i18n` → PASS (ranh giới module, bảng `request_invites` chỉ ghi ở `db/requests.ts`, đủ khóa 4 locale).

- [ ] **Step 6: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/routes/hub-invitations.tsx apps/web/src/routes/hub.tsx apps/web/src/app.ts apps/web/src/db/requests.ts apps/web/src/views/ProposalView.tsx apps/web/src/views/hub/InvitationsPage.tsx apps/web/src/views/hub/HubLayout.tsx apps/web/src/views/hub/OverviewPage.tsx apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/hub/invitations.test.ts
git commit -m "feat(web): builder invitations in the Hub, proposals and declines (VNX-0604)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: VNX-0605 — `/me`: xem đề xuất, chọn → Inquiry `type = request`; Inquiry hiện tiêu đề request; test cổng ra M6

> Đã đối chiếu với code thật sau Task 5 (2026-10-04). Task này tách thành **6** (đường chọn, `/me`, tiêu đề request trên Inquiry, cổng ra) và **6b** (che tên client ở các bề mặt M5, test lộ email đầu-cuối, test hồi quy admin gỡ request); 6b nằm cuối mục này và làm ngay sau 6, trước Task 7. Cổng ra M6 chỉ đóng khi cả hai xong.

**Files:**
- Create: `apps/web/src/views/me/Proposals.tsx`
- Modify: `apps/web/src/routes/me-requests.tsx` (`requestPage` kèm đề xuất, `POST /me/requests/:id/select`)
- Modify: `apps/web/src/db/requests.ts` (`markInviteSelectedStatement`)
- Modify: `apps/web/src/db/inquiries.ts` (`SUMMARY`, `listInquiriesForAdmin`, `findMessageContext` đọc `requests.title`; siết điều kiện `onlyIf` của `createInquiryStatements`)
- Modify: `apps/web/src/domain/inquiry.ts` (`InquirySummary.requestTitle`)
- Modify: `apps/web/src/views/proposal.ts` (`requestFirstMessage`)
- Modify: `apps/web/src/email/templates/request.ts` (`requestSelectedEmail`)
- Modify: `apps/web/src/notify/inquiry.ts` (tin nhắn đầu của Inquiry `request` → email "được chọn"; "về" = tên product hoặc tiêu đề request), `apps/web/src/jobs/daily.ts` (nhắc / báo admin dùng tiêu đề request khi không có product)
- Modify: `apps/web/src/views/InquiryThread.tsx`, `apps/web/src/views/hub/InquiriesPage.tsx`, `apps/web/src/views/admin/InquiriesPage.tsx`
- Modify: `apps/web/src/i18n/messages/{en,vi,zh-hans,zh-hant}.ts`
- Test: `apps/web/test/me/select.test.ts`, `apps/web/test/request-gate.test.ts`, thêm ca vào `apps/web/test/db/requests.test.ts` và `apps/web/test/email/request-templates.test.ts`

**Interfaces:**
- Consumes (code thật): `createInquiryStatements(db, input, onlyIf?: SelectedRequestGuard)` → `{ statements, id, firstMessageId }`; `endRequestBatch(db, { id, from, to, now, selectedInviteId }, between)` → `{ statements, read(results) → { request, notSelected, expired } }`; `setRequestStatusStatement` (đã kiểm invite `proposed` + builder `approved` + user `active` trong SQL); `listRequestInvites` → `InviteWithBuilder[]` (`builderPublic`); `requestTransition`, `inviteTransition`; `auditStatement` (guard `{ inquiryId, status, updatedAt }`); `notifyNotSelected`, `notifyInviteExpired` (bỏ qua builder không công khai); `notifyInquiryMessage(env, messageId, now)`; `ProposalView`, `proposalPrice` (`views/proposal.ts`); `requestPage`/`RequestPage` (Task 3); `builderFacingName`, `BuilderFacingName` (Task 2); fixtures `makeRequest`, `makeBuilder`, `inviteBuilders`, `proposeOn`, `signIn`.
- Produces:
  - `db/requests.ts`: `markInviteSelectedStatement(db, { inviteId, requestId, inquiryId, now }): D1PreparedStatement`.
  - `domain/inquiry.ts`: `InquirySummary.requestTitle: string | null`.
  - `views/proposal.ts`: `requestFirstMessage(request: Pick<ClientRequest, "title" | "description" | "locale">, invite: Pick<RequestInvite, "approach" | "priceCents" | "priceMaxCents" | "priceNote" | "timelineDays">): string`.
  - `email/templates/request.ts`: `requestSelectedEmail(locale, { clientName: BuilderFacingName; title: string; body: string; url: string }): Email`.
  - `views/me/Proposals.tsx`: `Proposals: FC<{ locale: Locale; request: ClientRequest; proposals: InviteWithBuilder[] }>`.
  - Route `POST /me/requests/:id/select` (trường `invite`).

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Một `db.batch` duy nhất**, theo thứ tự: `setRequestStatusStatement` (compare-and-set `matching` → `builder_selected`, kèm `selected_invite_id`) → câu `INSERT` Inquiry và tin nhắn đầu (có `onlyIf`) → `markInviteSelectedStatement` (hai câu cuối là `between` của `endRequestBatch`, nên đề xuất được chọn không bị quét thành `not_selected`) → quét `invited` → `expired`, `proposed` → `not_selected` → audit. Mất compare-and-set thì không câu nào ghi (mỗi câu tự kiểm).
2. **Siết `createInquiryStatements(onlyIf)`:** thêm `status = 'proposed'` vào `EXISTS` của lời mời. Lý do: guard cũ chỉ so `requests.updated_at = now`; hai lần bấm "Chọn" rơi vào cùng một mili giây thì lần thua vẫn qua guard (request đã `builder_selected` với đúng `updated_at` của lần thắng) và sẽ tạo Inquiry thứ hai. Khi lần thắng đã chạy, lời mời không còn `proposed`, nên lần thua không ghi gì. Test db ở Step 2.
3. **Audit guard theo Inquiry vừa tạo** (`{ inquiryId, status: "open", updatedAt: iso }`), không theo request: id Inquiry sinh mới cho mỗi lần thử nên chỉ lần thắng mới có audit (cùng lý do mili giây như trên).
4. **Email "được chọn" là email của tin nhắn đầu** và đi qua `notifyInquiryMessage` (M5 gửi lại khi lỗi, tối đa 3 lần). Thêm template `requestSelectedEmail` vì spec 8.3 liệt kê riêng "được chọn"; nó dùng `BuilderFacingName` ngay từ đầu để Task này không thêm chỗ lộ mới. Các email còn lại của Inquiry giữ `newInquiryEmail` / `inquiryMessageEmail` (mask ở Task 6b).
5. **Tin nhắn đầu** ghép bởi `requestFirstMessage` (`views/proposal.ts`, cạnh `proposalPrice`): tiêu đề, mô tả, đề xuất (cách làm, giá, ghi chú giá, thời gian), nhãn theo `requests.locale`. Không có email client trong đó (chỉ nội dung client đã gõ).
6. **Nút "Chọn"** chỉ hiện khi request `matching`, đề xuất `proposed` và builder còn công khai (`builderPublic`); builder hết công khai thì hiện câu giải thích. Route cũng chặn (409) và SQL của `setRequestStatusStatement` chặn lần nữa.
7. **Trang Inquiry không link về request** (request `removed` sẽ 404 với client); chỉ hiện tiêu đề dạng chữ. Từ trang request có link sang Inquiry (`me.proposals.inquiry`).
8. `/me/requests/:id/select` trả `404` cho request không phải của client hoặc `invite` không thuộc request này (kiểm bằng danh sách lời mời của chính request), `409` cho mọi trạng thái sai. Thành công `303` tới `/me/inquiries/:id`.

- [ ] **Step 1: Chuỗi i18n**

`en.ts`:

```ts
  "me.proposals.title": "Proposals",
  "me.proposals.empty": "No proposals yet. Invited builders have 7 days to reply.",
  "me.proposals.choose": "Choose this proposal",
  "me.proposals.chooseHint": "Choosing opens a conversation with that builder; the other proposals will not be chosen.",
  "me.proposals.from": "From {name}",
  "me.proposals.unavailable": "This builder is not available any more.",
  "me.proposals.chosen": "You chose this proposal.",
  "me.proposals.inquiry": "Open the conversation",
  "request.inquiry.request": "Request: {title}",
  "request.inquiry.proposal": "Proposal",
  "email.requestSelected.subject": "{client} chose your proposal",
  "email.requestSelected.intro": "{client} chose your proposal for “{title}”. A conversation with them is now open on VNX.SI; the request and your proposal are below.",
  "email.requestSelected.cta": "Continue the conversation on VNX.SI (replies by e-mail are not delivered):",
```

`vi.ts` (đổi giá trị `inquiry.type.request`, thêm các key):

```ts
  "inquiry.type.request": "Từ nhu cầu đã đăng",
  "me.proposals.title": "Đề xuất",
  "me.proposals.empty": "Chưa có đề xuất nào. Builder được mời có 7 ngày để trả lời.",
  "me.proposals.choose": "Chọn đề xuất này",
  "me.proposals.chooseHint": "Khi chọn, bạn mở trao đổi với builder này; các đề xuất còn lại sẽ không được chọn.",
  "me.proposals.from": "Từ {name}",
  "me.proposals.unavailable": "Builder này hiện không còn nhận việc trên VNX.SI.",
  "me.proposals.chosen": "Bạn đã chọn đề xuất này.",
  "me.proposals.inquiry": "Mở trao đổi",
  "request.inquiry.request": "Nhu cầu: {title}",
  "request.inquiry.proposal": "Đề xuất",
  "email.requestSelected.subject": "{client} đã chọn đề xuất của bạn",
  "email.requestSelected.intro": "{client} đã chọn đề xuất của bạn cho nhu cầu “{title}”. Trao đổi với họ đã mở trên VNX.SI; nhu cầu và đề xuất của bạn nằm bên dưới.",
  "email.requestSelected.cta": "Tiếp tục trao đổi trên VNX.SI (trả lời bằng email sẽ không tới người gửi):",
```

`zh-hans.ts`:

```ts
  "me.proposals.title": "方案",
  "me.proposals.empty": "还没有方案。受邀开发者有 7 天时间回复。",
  "me.proposals.choose": "选择这个方案",
  "me.proposals.chooseHint": "选择后会与该开发者开始对话；其他方案将不被选中。",
  "me.proposals.from": "来自 {name}",
  "me.proposals.unavailable": "该开发者目前无法接单。",
  "me.proposals.chosen": "你选择了这个方案。",
  "me.proposals.inquiry": "打开对话",
  "request.inquiry.request": "需求：{title}",
  "request.inquiry.proposal": "方案",
  "email.requestSelected.subject": "{client} 选择了你的方案",
  "email.requestSelected.intro": "{client} 选择了你为需求“{title}”提交的方案。与对方的对话已在 VNX.SI 上开启，需求和你的方案见下文。",
  "email.requestSelected.cta": "请在 VNX.SI 上继续对话（通过邮件回复不会送达）：",
```

`zh-hant.ts`:

```ts
  "me.proposals.title": "方案",
  "me.proposals.empty": "還沒有方案。受邀開發者有 7 天時間回覆。",
  "me.proposals.choose": "選擇這個方案",
  "me.proposals.chooseHint": "選擇後會與該開發者開始對話；其他方案將不被選中。",
  "me.proposals.from": "來自 {name}",
  "me.proposals.unavailable": "該開發者目前無法接案。",
  "me.proposals.chosen": "你選擇了這個方案。",
  "me.proposals.inquiry": "打開對話",
  "request.inquiry.request": "需求：{title}",
  "request.inquiry.proposal": "方案",
  "email.requestSelected.subject": "{client} 選擇了你的方案",
  "email.requestSelected.intro": "{client} 選擇了你為需求「{title}」提交的方案。與對方的對話已在 VNX.SI 上開啟，需求與你的方案見下文。",
  "email.requestSelected.cta": "請在 VNX.SI 上繼續對話（透過郵件回覆不會送達）：",
```

(zh-hans / zh-hant: `inquiry.type.request` giữ "需求".)

- [ ] **Step 2: Test db (fail): chặn Inquiry thứ hai và đánh dấu `selected`**

Thêm vào `apps/web/test/db/requests.test.ts`, trong `describe` hiện có (dùng lại `builders`, `db()`, `later`; thêm import `markInviteSelectedStatement`, `endRequestBatch`, `listRequestInvites`, `auditStatement` nếu thiếu):

```ts
  it("marks the chosen invitation selected and never writes a second inquiry, even at the same instant", async () => {
    const { client, request } = await makeRequest({ tag: "rq-sel2" });
    const [builder] = await builders("rq-sel2-b", 1);
    const [invite] = await inviteBuilders(request, [builder!]);
    await proposeOn(invite!);
    const now = later((await findRequestById(db(), request.id))!.updatedAt);
    const attempt = () => {
      const inquiry = createInquiryStatements(
        db(),
        { clientUserId: client.id, clientName: "Minh Tran", builderId: builder!.userId, productId: null, requestId: request.id, type: "request", message: "Request + proposal", budgetBand: "2k-10k", deadline: null, status: "open", locale: "en", now },
        { requestId: request.id, inviteId: invite!.id, updatedAt: now },
      );
      const end = endRequestBatch(db(), { id: request.id, from: "matching", to: "builder_selected", now, selectedInviteId: invite!.id }, [
        ...inquiry.statements,
        markInviteSelectedStatement(db(), { inviteId: invite!.id, requestId: request.id, inquiryId: inquiry.id, now }),
      ]);
      const audit = auditStatement(db(), { actorUserId: client.id, action: "request.select", entity: "request", entityId: request.id, data: { inviteId: invite!.id, inquiryId: inquiry.id }, now }, { inquiryId: inquiry.id, status: "open", updatedAt: now });
      return { inquiry, end, statements: [...end.statements, audit] };
    };
    const first = attempt();
    expect(first.end.read(await db().batch(first.statements)).request?.status).toBe("builder_selected");
    const second = attempt(); // same `now`: the request already carries that updated_at
    expect(second.end.read(await db().batch(second.statements)).request).toBeNull();
    expect(await findInquiryById(db(), second.inquiry.id)).toBeNull();
    const n = await db().prepare("SELECT COUNT(*) AS n FROM inquiries WHERE request_id = ?1").bind(request.id).first<{ n: number }>();
    expect(n?.n).toBe(1);
    const audits = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.select' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audits?.n).toBe(1);
    const [row] = await listRequestInvites(db(), request.id);
    expect(row?.invite).toMatchObject({ status: "selected", inquiryId: first.inquiry.id });
  });
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts` → FAIL (`markInviteSelectedStatement` chưa có).

- [ ] **Step 3: `markInviteSelectedStatement` và siết guard**

`apps/web/src/db/requests.ts`:

```ts
/**
 * Spec §7.6 select, `between` of endRequestBatch (after the request's compare-and-set and the inquiry INSERTs):
 * proposed -> selected, linked to the new inquiry, only when this batch won. RETURNING the row.
 */
export function markInviteSelectedStatement(db: D1Database, input: { inviteId: string; requestId: string; inquiryId: string; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'selected', inquiry_id = ?3, updated_at = ?4
       WHERE id = ?1 AND request_id = ?2 AND status = 'proposed'
         AND EXISTS (SELECT 1 FROM requests WHERE id = ?2 AND status = 'builder_selected' AND selected_invite_id = ?1 AND updated_at = ?4)
         AND EXISTS (SELECT 1 FROM inquiries WHERE id = ?3)
       RETURNING id`,
    )
    .bind(input.inviteId, input.requestId, input.inquiryId, input.now);
}
```

`apps/web/src/db/inquiries.ts`, trong `createInquiryStatements`, đổi `guard` (chỉ thêm `AND status = 'proposed'` ở `EXISTS` thứ hai) và cập nhật chú thích của `SelectedRequestGuard` ("... and that invitation is still `proposed`"):

```ts
  const guard = onlyIf
    ? "WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?14 AND status = 'builder_selected' AND selected_invite_id = ?15 AND updated_at = ?16) AND EXISTS (SELECT 1 FROM request_invites WHERE id = ?15 AND request_id = ?14 AND builder_id = ?4 AND status = 'proposed')"
    : "";
```

Chạy: `npm test -w apps/web -- test/db/requests.test.ts test/db/inquiries.test.ts` → PASS.

- [ ] **Step 4: Test chọn đề xuất (fail)**

`apps/web/test/me/select.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById, listMessages, listUnnotifiedMessages } from "../../src/db/inquiries.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const count = async (sql: string, ...args: string[]) => (await testEnv.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
const inquiries = (requestId: string) => count("SELECT COUNT(*) AS n FROM inquiries WHERE request_id = ?1", requestId);
const selectAudits = (requestId: string) => count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.select' AND entity_id = ?1", requestId);
const inviteOf = async (requestId: string, inviteId: string) => (await listRequestInvites(testEnv.DB, requestId)).find((x) => x.invite.id === inviteId)!.invite;

/** A matching request with three invitations: A and B proposed, C still invited. */
async function threeWay(tag: string, clientLocale?: string) {
  const { client, request } = await makeRequest({ tag, clientLocale });
  const [a, b, c] = await Promise.all(["a", "b", "x"].map((k) => makeBuilder(`${tag}-${k}@vnx.si`, `${tag}-${k}`, "approved", { name: `${tag} ${k.toUpperCase()}` })));
  const [ia, ib, ic] = await inviteBuilders(request, [a!, b!, c!]);
  await proposeOn(ia!);
  await proposeOn(ib!);
  const { cookie } = await signIn(client.email);
  return { client, request, a: a!, b: b!, c: c!, ia: ia!, ib: ib!, ic: ic!, cookie };
}

/** Nothing was written: request still matching, no inquiry, no select audit, no e-mail. */
async function expectUntouched(requestId: string) {
  expect((await findRequestById(testEnv.DB, requestId))?.status).toBe("matching");
  expect(await inquiries(requestId)).toBe(0);
  expect(await selectAudits(requestId)).toBe(0);
  expect((await listRequestInvites(testEnv.DB, requestId)).map((x) => x.invite.status).sort()).toEqual(["invited", "proposed", "proposed"]);
  expect(outbox).toEqual([]);
}

describe("choosing a proposal (spec §5.7 step 4)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("shows proposals with a Choose button only for proposed ones of public builders", async () => {
    const { request, ia, ib, ic, b, cookie } = await threeWay("ms-show");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(b.userId).run();
    const html = await (await get(`/me/requests/${request.id}`, cookie)).text();
    expect(html).toContain("From ms-show A");
    expect(html).toContain("$4,500");
    expect(html).toContain("Next.js with a booking calendar.");
    expect(html).toContain(`name="invite" value="${ia.id}"`);
    expect(html).not.toContain(`value="${ib.id}"`);
    expect(html).toContain("This builder is not available any more.");
    expect(html).not.toContain(`value="${ic.id}"`); // still invited: no proposal to show
  });

  it("selects A: request builder_selected, invitations settle, an inquiry opens with request + proposal, e-mails go out", async () => {
    const { client, request, a, ia, ib, ic, cookie } = await threeWay("ms-pick");
    const res = await post(`/vi/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    expect(res.status).toBe(303);
    const after = await findRequestById(testEnv.DB, request.id);
    expect(after).toMatchObject({ status: "builder_selected", selectedInviteId: ia.id });
    expect(after?.closedAt).not.toBeNull();
    const chosen = await inviteOf(request.id, ia.id);
    expect(chosen.status).toBe("selected");
    expect((await inviteOf(request.id, ib.id)).status).toBe("not_selected");
    expect((await inviteOf(request.id, ic.id)).status).toBe("expired");
    const inquiryId = chosen.inquiryId!;
    expect(res.headers.get("location")).toBe(`/vi/me/inquiries/${inquiryId}`);
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ type: "request", requestId: request.id, clientUserId: client.id, builderId: a.userId, status: "open", productId: null, clientName: "Minh Tran" });
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.body).toContain(`Request: ${request.title}`);
    expect(first?.body).toContain(request.description);
    expect(first?.body).toContain("Next.js with a booking calendar.");
    expect(first?.body).toContain("Price: $4,500");
    expect(first?.body).toContain("Timeline: 30 days");
    expect(first?.body).not.toContain(client.email);
    expect(first?.notifiedAt).not.toBeNull();
    const toA = outbox.filter((m) => m.to === "ms-pick-a@vnx.si");
    expect(toA).toHaveLength(1);
    expect(toA[0]?.subject).toBe("Minh Tran chose your proposal");
    expect(toA[0]?.text).toContain(`https://vnx.si/hub/inquiries/${inquiryId}`);
    expect(toA[0]?.text).toContain("Next.js with a booking calendar.");
    expect(outbox.find((m) => m.to === "ms-pick-b@vnx.si")?.subject).toBe(`Update on your proposal: ${request.title}`);
    expect(outbox.find((m) => m.to === "ms-pick-x@vnx.si")?.subject).toBe(`Invitation ended: ${request.title}`);
    expect(outbox.some((m) => m.to === client.email)).toBe(false);
    for (const m of outbox) expect(`${m.subject}${m.text}${m.html}`).not.toContain(client.email);
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'request.select' AND entity_id = ?1").bind(request.id).first<{ data: string }>();
    expect(JSON.parse(audit!.data)).toEqual({ inviteId: ia.id, inquiryId });
  });

  it("labels the first message in the request's language", async () => {
    const { request, ia, cookie } = await threeWay("ms-vi", "vi");
    await post(`/vi/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.body).toContain(`Nhu cầu: ${request.title}`);
    expect(first?.body).toContain("Đề xuất");
  });

  // Review Focus 4: bấm "Chọn" hai lần.
  it("is single-shot: a second choice is 409 with no second inquiry or e-mail; closing afterwards is 409 too", async () => {
    const { request, ia, ib, cookie } = await threeWay("ms-twice");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(303);
    clearOutbox();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ib.id })).status).toBe(409);
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(409);
    expect(await inquiries(request.id)).toBe(1);
    expect(await selectAudits(request.id)).toBe(1);
    expect(outbox).toEqual([]);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("builder_selected");
  });

  it("two simultaneous clicks make exactly one inquiry", async () => {
    const { request, ia, cookie } = await threeWay("ms-race");
    const results = await Promise.all([post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id }), post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })]);
    expect(results.map((r) => r.status).sort()).toEqual([303, 409]);
    expect(await inquiries(request.id)).toBe(1);
    expect(await selectAudits(request.id)).toBe(1);
    expect(outbox.filter((m) => m.to === "ms-race-a@vnx.si")).toHaveLength(1);
  });

  // Review Focus 4: builder bị khóa sau khi gửi đề xuất.
  it("409s a proposal of a builder suspended after proposing, and writes nothing", async () => {
    const { request, a, ia, cookie } = await threeWay("ms-susp");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(a.userId).run();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    await expectUntouched(request.id);
  });

  // Review Focus 2.
  it("404s another request's invitation and another client's request; nothing is written", async () => {
    const mine = await threeWay("ms-cross");
    const other = await threeWay("ms-cross2");
    clearOutbox();
    expect((await post(`/me/requests/${mine.request.id}/select`, mine.cookie, { invite: other.ia.id })).status).toBe(404);
    expect((await post(`/me/requests/${mine.request.id}/select`, mine.cookie, { invite: "no-such-invite" })).status).toBe(404);
    expect((await post(`/me/requests/${other.request.id}/select`, mine.cookie, { invite: other.ia.id })).status).toBe(404);
    await expectUntouched(mine.request.id);
    await expectUntouched(other.request.id);
  });

  it("409s an invitation that has no proposal yet, and a request that was closed", async () => {
    const { request, ic, ia, cookie } = await threeWay("ms-state");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ic.id })).status).toBe(409);
    await expectUntouched(request.id);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    clearOutbox();
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id })).status).toBe(409);
    expect(await inquiries(request.id)).toBe(0);
    expect(outbox).toEqual([]);
  });

  it("keeps the choice when the e-mail fails: the first message is unsent and the M5 retry delivers it", async () => {
    const { request, ia, cookie } = await threeWay("ms-retry");
    expect((await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id }, noMail)).status).toBe(303);
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const [first] = await listMessages(testEnv.DB, inquiryId);
    expect(first?.notifiedAt).toBeNull();
    expect((await listUnnotifiedMessages(testEnv.DB)).some((m) => m.id === first!.id)).toBe(true);
    await runDaily(testEnv, new Date()); // the M5 resend step
    expect((await listMessages(testEnv.DB, inquiryId))[0]?.notifiedAt).not.toBeNull();
    expect(outbox.find((m) => m.to === "ms-retry-a@vnx.si")?.subject).toBe("Minh Tran chose your proposal");
  });

  it("shows the request title wherever the inquiry names its subject, for both sides, the admin and the reminder", async () => {
    const { request, ia, cookie } = await threeWay("ms-thread");
    await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    const builderCookie = (await signIn("ms-thread-a@vnx.si")).cookie;
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    const about = `<dd>${request.title}</dd>`;
    for (const html of [await (await get(`/me/inquiries/${inquiryId}`, cookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, builderCookie)).text()]) {
      expect(html).toContain(about);
      expect(html).not.toMatch(/<dd>\s*<a href="\/b\/ms-thread-a"/); // the "About" cell no longer falls back to the builder
    }
    expect(await (await get("/hub/inquiries", builderCookie)).text()).toContain(` · ${request.title}`);
    expect(await (await get("/admin/inquiries", adminCookie)).text()).toContain(`@ms-thread-a · ${request.title}`);
    clearOutbox();
    await runDaily(testEnv, new Date(Date.now() + 4 * 24 * 3600 * 1000));
    const reminder = outbox.find((m) => m.to === "ms-thread-a@vnx.si" && m.subject.includes("waiting for your reply"));
    expect(reminder?.text).toContain(request.title);
  });

  // Nghĩa vụ 4: admin gỡ request đã chọn không làm mất Inquiry.
  it("keeps the inquiry when an admin removes the builder_selected request", async () => {
    const { client, request, ia, cookie } = await threeWay("ms-removed");
    await post(`/me/requests/${request.id}/select`, cookie, { invite: ia.id });
    const inquiryId = (await inviteOf(request.id, ia.id)).inquiryId!;
    clearOutbox();
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request.id}/remove`, adminCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ status: "open", requestId: request.id, clientUserId: client.id });
    expect(await listMessages(testEnv.DB, inquiryId)).toHaveLength(1);
    expect((await inviteOf(request.id, ia.id)).status).toBe("selected");
    expect((await get(`/me/requests/${request.id}`, cookie)).status).toBe(404);
    expect((await get(`/me/inquiries/${inquiryId}`, cookie)).status).toBe(200);
    const builderCookie = (await signIn("ms-removed-a@vnx.si")).cookie;
    const thread = await get(`/hub/inquiries/${inquiryId}`, builderCookie);
    expect(thread.status).toBe(200);
    expect(await thread.text()).toContain(request.title);
    expect(outbox).toEqual([]); // the chosen builder is told nothing more, the other invitations had settled already
  });
});
```

Chạy: `npm test -w apps/web -- test/me/select.test.ts` → FAIL (route chưa có).

- [ ] **Step 5: Inquiry đọc tiêu đề request**

`apps/web/src/domain/inquiry.ts`, `InquirySummary` thêm sau `productSlug`:

```ts
  /** Title of the request the inquiry came from (type "request", M6); null otherwise. */
  requestTitle: string | null;
```

`apps/web/src/db/inquiries.ts`:

```ts
type SummaryRow = Row & { product_name: string | null; product_slug: string | null; request_title: string | null; builder_name: string; builder_handle: string };

const SUMMARY = `SELECT i.*, p.name AS product_name, p.slug AS product_slug, rq.title AS request_title, b.name AS builder_name, b.handle AS builder_handle
  FROM inquiries i JOIN builders b ON b.user_id = i.builder_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN requests rq ON rq.id = i.request_id`;

const toSummary = (r: SummaryRow): InquirySummary => ({
  inquiry: toInquiry(r),
  productName: r.product_name,
  productSlug: r.product_slug,
  requestTitle: r.request_title ?? null,
  builderName: r.builder_name,
  builderHandle: r.builder_handle,
});
```

Trong `listInquiriesForAdmin` và `findMessageContext`: thêm `rq.title AS request_title` vào danh sách cột và `LEFT JOIN requests rq ON rq.id = i.request_id` sau `LEFT JOIN products p …`. Nếu typecheck báo chỗ dựng `InquirySummary` bằng tay trong test thì thêm `requestTitle: null`.

- [ ] **Step 6: Template, tin nhắn đầu, thông báo, cron, view**

`apps/web/src/email/templates/request.ts` (file đã import `quote`, `BuilderFacingName`):

```ts
/** To the chosen builder: the client's typed name only; the request and the proposal come as the inquiry's first message. */
export function requestSelectedEmail(locale: Locale, input: { clientName: BuilderFacingName; title: string; body: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.requestSelected.intro", { client: input.clientName, title: input.title });
  const cta = tr("email.requestSelected.cta");
  return {
    subject: tr("email.requestSelected.subject", { client: input.clientName }),
    text: `${intro}\n\n${input.body}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), quote(input.body), p(cta), link(input.url)]),
  };
}
```

Thêm vào `apps/web/test/email/request-templates.test.ts`:

```ts
  it("requestSelectedEmail names the client by the masked name, quotes the first message and escapes HTML", () => {
    const evil = "<script>x</script>";
    const mail = requestSelectedEmail("en", { clientName: builderFacingName("Minh Tran"), title: evil, body: `Request: ${evil}`, url: "https://vnx.si/hub/inquiries/01J" });
    expect(mail.subject).toBe("Minh Tran chose your proposal");
    expect(mail.text).toContain("https://vnx.si/hub/inquiries/01J");
    expect(mail.html).not.toContain("<script>");
    for (const locale of ["vi", "zh-Hans", "zh-Hant"] as const) expect(requestSelectedEmail(locale, { clientName: builderFacingName("Minh"), title: "T", body: "B", url: "https://vnx.si/x" }).subject).toContain("Minh");
  });
```

(`zh-Hans`/`zh-Hant`: dùng đúng giá trị `Locale` thật của repo; chép từ test cùng file.)

`apps/web/src/views/proposal.ts` (thêm import `isLocale`, `type ClientRequest`; `RequestInvite` đã import):

```ts
/**
 * Spec §5.7 step 4: the first message of the inquiry made from a request: the request, then the chosen proposal,
 * labelled in the request's language. Only what the client typed; no e-mail.
 */
export function requestFirstMessage(
  request: Pick<ClientRequest, "title" | "description" | "locale">,
  invite: Pick<RequestInvite, "approach" | "priceCents" | "priceMaxCents" | "priceNote" | "timelineDays">,
): string {
  const locale = isLocale(request.locale) ? request.locale : "en";
  const tr = translator(locale);
  const note = invite.priceNote ? ` (${invite.priceNote})` : "";
  return [
    tr("request.inquiry.request", { title: request.title }),
    request.description,
    tr("request.inquiry.proposal"),
    invite.approach ?? "",
    `${tr("proposal.price")}: ${proposalPrice(locale, invite)}${note}`,
    `${tr("proposal.timeline")}: ${tr("proposal.days", { n: invite.timelineDays ?? 0 })}`,
  ].join("\n\n");
}
```

`apps/web/src/notify/inquiry.ts`: import `builderFacingName` từ `../domain/inquiry.ts` và `requestSelectedEmail` từ `../email/templates/request.ts`; thay phần `compose` (chỉ nhánh `toBuilder` và biến `about` thay đổi; các nhánh khác dùng `about` thay `summary.productName`):

```ts
function compose(env: Bindings, ctx: MessageContext): { to: string; subject: string; text: string; html: string } {
  const { message, summary } = ctx;
  const inquiry = summary.inquiry;
  // What the inquiry is about: the product, or the request it came from (M6), or (null) the builder's services.
  const about = summary.productName ?? summary.requestTitle;
  const toBuilder = message.senderUserId === inquiry.clientUserId;
  if (toBuilder) {
    const locale = asLocale(ctx.builder.locale);
    const url = inquiryUrl(env, locale, inquiry.id, "builder");
    // The builder sees the client's typed name only, never the e-mail (spec §5.6).
    // Spec §5.7 step 4: the first message of a request inquiry is the "you were chosen" e-mail.
    const mail = !ctx.isFirst
      ? inquiryMessageEmail(locale, { fromName: inquiry.clientName, productName: about, body: message.body, url })
      : inquiry.type === "request"
        ? requestSelectedEmail(locale, { clientName: builderFacingName(inquiry.clientName), title: summary.requestTitle ?? "", body: message.body, url })
        : newInquiryEmail(locale, { clientName: inquiry.clientName, type: inquiry.type, productName: about, budgetBand: inquiry.budgetBand, deadline: inquiry.deadline, message: message.body, url });
    return { to: ctx.builder.email, ...mail };
  }
  const locale = asLocale(ctx.client.locale);
  if (message.kind === "decline") {
    const url = new URL(localizedPath(locale, "/products"), env.APP_ORIGIN).toString();
    return { to: ctx.client.email, ...inquiryDeclinedEmail(locale, { builderName: summary.builderName, productName: about, reason: message.body, url }) };
  }
  const url = inquiryUrl(env, locale, inquiry.id, "client");
  return { to: ctx.client.email, ...inquiryMessageEmail(locale, { fromName: summary.builderName, productName: about, body: message.body, url }) };
}
```

(`clientName` ở hai nhánh còn lại giữ nguyên tên thô cho đến Task 6b.)

`apps/web/src/jobs/daily.ts`: trong `remind`, `productName: item.productName ?? item.requestTitle`; trong `alert`, `productName: i.productName ?? i.requestTitle`.

`apps/web/src/views/InquiryThread.tsx`, ô "About":

```tsx
        <dd>
          {summary.productSlug && summary.productName ? (
            <a href={localizedPath(locale, `/p/${summary.productSlug}`)}>{summary.productName}</a>
          ) : summary.requestTitle ? (
            summary.requestTitle
          ) : (
            <a href={localizedPath(locale, `/b/${summary.builderHandle}`)}>{summary.builderName}</a>
          )}
        </dd>
```

`apps/web/src/views/hub/InquiriesPage.tsx`: destructure thêm `requestTitle`; `const about = productName ?? requestTitle;` (đặt trong hàm `map`, chuyển thành thân khối) và `{about ? ` · ${about}` : null}`.
`apps/web/src/views/admin/InquiriesPage.tsx`: cùng cách, `{(productName ?? requestTitle) ? ` · ${productName ?? requestTitle}` : null}`.

- [ ] **Step 7: View đề xuất và route chọn**

`apps/web/src/views/me/Proposals.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { ClientRequest, InviteWithBuilder } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { ProposalView } from "../ProposalView.tsx";

/** Spec §5.4 / §5.7 step 4: the proposals of a request; the client picks one while it is matching and its builder is still public. */
export const Proposals: FC<{ locale: Locale; request: ClientRequest; proposals: InviteWithBuilder[] }> = ({ locale, request, proposals }) => {
  const tr = translator(locale);
  const shown = proposals.filter(({ invite }) => invite.approach !== null && (invite.status === "proposed" || invite.status === "selected" || invite.status === "not_selected"));
  const matching = request.status === "matching";
  if (shown.length === 0 && !matching) return null;
  const action = localizedPath(locale, `/me/requests/${request.id}/select`);
  return (
    <section>
      <h2>{tr("me.proposals.title")}</h2>
      {shown.length === 0 ? <p class="muted">{tr("me.proposals.empty")}</p> : null}
      {shown.length > 0 && matching ? <p class="hint">{tr("me.proposals.chooseHint")}</p> : null}
      {shown.map(({ invite, builderName, builderHandle, builderPublic }) => (
        <section class="card wide">
          <h3>{builderPublic ? <a href={localizedPath(locale, `/b/${builderHandle}`)}>{tr("me.proposals.from", { name: builderName })}</a> : tr("me.proposals.from", { name: builderName })}</h3>
          <ProposalView locale={locale} invite={invite} />
          {invite.status === "selected" ? (
            <p class="notice good">
              {tr("me.proposals.chosen")} {invite.inquiryId ? <a href={localizedPath(locale, `/me/inquiries/${invite.inquiryId}`)}>{tr("me.proposals.inquiry")}</a> : null}
            </p>
          ) : null}
          {matching && invite.status === "proposed" ? (
            builderPublic ? (
              <form method="post" action={action}>
                <input type="hidden" name="invite" value={invite.id} />
                <button class="btn" type="submit">
                  {tr("me.proposals.choose")}
                </button>
              </form>
            ) : (
              <p class="muted">{tr("me.proposals.unavailable")}</p>
            )
          ) : null}
        </section>
      ))}
    </section>
  );
};
```

`apps/web/src/routes/me-requests.tsx` — thêm import (`createInquiryStatements` từ `../db/inquiries.ts`; `listRequestInvites`, `markInviteSelectedStatement` vào import `../db/requests.ts`; `inviteTransition` vào import `../domain/request.ts`; `notifyInquiryMessage` từ `../notify/inquiry.ts`; `Proposals` từ `../views/me/Proposals.tsx`; `requestFirstMessage` từ `../views/proposal.ts`), thay `requestPage` (bỏ câu chú thích "Task 6 adds the proposals"):

```tsx
/** The client's request page with its proposals. `findClientRequest` already limits it to the owner and hides `removed`. */
export async function requestPage(c: Context<AppEnv>, request: ClientRequest, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const proposals = await listRequestInvites(c.env.DB, request.id);
  return page(
    c,
    <RequestPage locale={locale} origin={requestOrigin(c)} request={request} sent={c.req.query("sent") === "1"}>
      <Proposals locale={locale} request={request} proposals={proposals} />
    </RequestPage>,
    status,
  );
}
```

và thêm route trong `registerMeRequestRoutes` (sau route `close`):

```tsx
  /**
   * Spec §5.7 step 4 / §7.5 / §7.6, ONE batch: request matching -> builder_selected (compare-and-set), the inquiry and its
   * first message (guarded on that), the chosen invitation -> selected, the rest settled, the audit row (guarded on the
   * inquiry this batch made). A lost race writes nothing. After the commit the builder's "chosen" e-mail goes out as the
   * inquiry's first notification (the M5 daily job retries it) and the other builders are told.
   */
  onLocalized(app, "post", "/me/requests/:id/select", requireUser, async (c) => {
    const request = await load(c);
    if (!request) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const inviteId = typeof body.invite === "string" ? body.invite : "";
    // Looked up among THIS request's invitations: another request's id reads as missing (Review Focus 2).
    const chosen = (await listRequestInvites(c.env.DB, request.id)).find((x) => x.invite.id === inviteId);
    if (!chosen) return errorResponse(c, "notFound", 404);
    if (!requestTransition(request.status, "select", "client").ok || !inviteTransition(chosen.invite.status, "select", "client").ok || !chosen.builderPublic) {
      return errorResponse(c, "conflict", 409);
    }
    const user = c.get("user")!;
    const now = new Date();
    const iso = now.toISOString();
    const inquiry = createInquiryStatements(
      c.env.DB,
      { clientUserId: user.id, clientName: request.clientName, builderId: chosen.invite.builderId, productId: null, requestId: request.id, type: "request", message: requestFirstMessage(request, chosen.invite), budgetBand: request.budgetBand, deadline: request.deadline, status: "open", locale: request.locale, now: iso },
      { requestId: request.id, inviteId: chosen.invite.id, updatedAt: iso },
    );
    const end = endRequestBatch(c.env.DB, { id: request.id, from: request.status, to: "builder_selected", now: iso, selectedInviteId: chosen.invite.id }, [
      ...inquiry.statements,
      markInviteSelectedStatement(c.env.DB, { inviteId: chosen.invite.id, requestId: request.id, inquiryId: inquiry.id, now: iso }),
    ]);
    const results = await c.env.DB.batch([
      ...end.statements,
      auditStatement(c.env.DB, { actorUserId: user.id, action: "request.select", entity: "request", entityId: request.id, data: { inviteId: chosen.invite.id, inquiryId: inquiry.id }, now: iso }, { inquiryId: inquiry.id, status: "open", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) return errorResponse(c, "conflict", 409);
    await notifyInquiryMessage(c.env, inquiry.firstMessageId, now);
    await notifyNotSelected(c.env, outcome.notSelected);
    await notifyInviteExpired(c.env, outcome.expired);
    return c.redirect(localizedPath(c.get("locale"), `/me/inquiries/${inquiry.id}`), 303);
  });
```

Chạy: `npm test -w apps/web -- test/me test/db test/notify test/jobs test/hub test/admin test/email test/i18n test/views` → PASS.

- [ ] **Step 8: Test cổng ra M6 (spec §9, phần Request)**

`apps/web/test/request-gate.test.ts` (cạnh `inquiry-gate.test.ts`):

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { findInquiryById } from "../src/db/inquiries.ts";
import { findRequestById, listClientRequests, listRequestInvites } from "../src/db/requests.ts";
import { findUserByEmail } from "../src/db/users.ts";
import { clearOutbox, outbox } from "../src/email/fake.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../src/http/turnstile.ts";
import { addLiveProduct, inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "./fixtures.ts";
import { followMagicLink, formPost, getReq, setCookieValue, testEnv } from "./helpers.ts";

const app = () => createApp();
const post = (path: string, fields: Record<string, string | string[]>, cookie?: string) => app().request(formPost(path, fields, { "cf-connecting-ip": "192.0.2.66", ...(cookie ? { cookie } : {}) }), undefined, testEnv);
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];
const clientEmail = "gate6-client@request.example";

describe("M6 exit gate (spec §9, Request)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("signed-out request -> confirm -> submitted -> admin invites 2 -> A proposes, B declines -> client picks A -> inquiry open for both; the builder never sees the client's e-mail", async () => {
    const a = await makeBuilder("gate6-a@vnx.si", "gate6-a", "approved", { name: "Gate A" });
    const b = await makeBuilder("gate6-b@vnx.si", "gate6-b", "approved", { name: "Gate B" });

    const posted = await post("/request", {
      title: "Booking app for three salons",
      description: "We need online booking with SMS reminders for three salons in Hanoi.",
      category: "booking",
      budgetBand: "2k-10k",
      deadline: "",
      languages: ["vi"],
      name: "Gate Client",
      email: clientEmail,
      [TURNSTILE_FIELD]: FAKE_TURNSTILE_PASS,
    });
    expect(posted.status).toBe(200);
    const confirmed = await followMagicLink(app(), linkFrom(outbox.find((m) => m.to === clientEmail)!.text));
    expect(confirmed.status).toBe(303);
    const clientCookie = `__Host-vnx_session=${setCookieValue(confirmed, "__Host-vnx_session")}`;
    const client = (await findUserByEmail(testEnv.DB, clientEmail))!;
    const [request] = await listClientRequests(testEnv.DB, client.id);
    expect(confirmed.headers.get("location")).toBe(`/me/requests/${request!.id}`);
    expect(request?.status).toBe("submitted");

    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request!.id}/invite`, { builder: [a.userId, b.userId] }, adminCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request!.id))?.status).toBe("matching");
    const invites = await listRequestInvites(testEnv.DB, request!.id);
    const ia = invites.find((x) => x.invite.builderId === a.userId)!.invite;
    const ib = invites.find((x) => x.invite.builderId === b.userId)!.invite;

    const aCookie = (await signIn("gate6-a@vnx.si")).cookie;
    const bCookie = (await signIn("gate6-b@vnx.si")).cookie;
    const seenByBuilders: string[] = [await (await get(`/hub/invitations/${ia.id}`, aCookie)).text(), await (await get("/hub/invitations", aCookie)).text()];
    expect((await post(`/hub/invitations/${ia.id}/propose`, { approach: "Next.js and SMS reminders.", priceMode: "fixed", price: "4500", timelineDays: "30" }, aCookie)).status).toBe(303);
    expect((await post(`/hub/invitations/${ib.id}/decline`, { reason: "Busy" }, bCookie)).status).toBe(303);

    const proposals = await (await get(`/me/requests/${request!.id}`, clientCookie)).text();
    expect(proposals).toContain("$4,500");
    expect(proposals).not.toContain(`value="${ib.id}"`); // B declined: nothing to choose
    expect((await post(`/me/requests/${request!.id}/select`, { invite: ia.id }, clientCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request!.id))?.status).toBe("builder_selected");
    const settled = await listRequestInvites(testEnv.DB, request!.id);
    expect(settled.find((x) => x.invite.id === ia.id)?.invite.status).toBe("selected");
    expect(settled.find((x) => x.invite.id === ib.id)?.invite.status).toBe("declined");
    const inquiryId = settled.find((x) => x.invite.id === ia.id)!.invite.inquiryId!;
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ type: "request", clientUserId: client.id, builderId: a.userId, requestId: request!.id, status: "open" });

    // Open for both sides: each opens the thread and replies; the other side reads it.
    const hub = await (await get(`/hub/inquiries/${inquiryId}`, aCookie)).text();
    expect(hub).toContain("Gate Client");
    expect(hub).toContain("Booking app for three salons");
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("Booking app for three salons");
    expect((await post(`/hub/inquiries/${inquiryId}/reply`, { body: "I can start Monday." }, aCookie)).status).toBe(303);
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("I can start Monday.");
    expect((await post(`/me/inquiries/${inquiryId}/reply`, { body: "Great, see you Monday." }, clientCookie)).status).toBe(303);
    seenByBuilders.push(hub, await (await get("/hub/inquiries", aCookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, aCookie)).text());

    // Spec §5.7 step 3 / §5.6: the builders never see the client's e-mail, in pages or in e-mails.
    const toBuilders = outbox.filter((m) => m.to.startsWith("gate6-") && m.to.endsWith("@vnx.si"));
    expect(toBuilders.length).toBeGreaterThanOrEqual(3); // invitation, chosen, client's reply
    for (const seen of [...seenByBuilders, ...toBuilders.flatMap((m) => [m.subject, m.text, m.html])]) expect(seen).not.toContain(clientEmail);
  });

  it("the admin's suggestions rank a builder with a live product in the category above one without, and leave out closed builders", async () => {
    const { request } = await makeRequest({ tag: "gate6-sug", category: "booking" });
    const withProduct = await makeBuilder("gate6-sug-p@vnx.si", "gate6-sug-p", "approved", { name: "Sug With" });
    await addLiveProduct(withProduct, "gate6-sug product");
    await makeBuilder("gate6-sug-n@vnx.si", "gate6-sug-n", "approved", { name: "Sug Without" });
    await makeBuilder("gate6-sug-c@vnx.si", "gate6-sug-c", "approved", { name: "Sug Closed", availability: "closed" });
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    const html = await (await get(`/admin/requests/${request.id}`, adminCookie)).text();
    expect(html).toContain("gate6-sug-p");
    expect(html).toContain("gate6-sug-n");
    expect(html.indexOf("gate6-sug-p")).toBeLessThan(html.indexOf("gate6-sug-n"));
    expect(html).not.toContain("gate6-sug-c");
  });

  it("cannot invite a 6th builder while 5 are active", async () => {
    const { request } = await makeRequest({ tag: "gate6-cap" });
    const five = await Promise.all([0, 1, 2, 3, 4].map((i) => makeBuilder(`gate6-cap-${i}@vnx.si`, `gate6-cap-${i}`, "approved")));
    const invites = await inviteBuilders(request, five);
    await proposeOn(invites[0]!);
    await proposeOn(invites[1]!); // invited and proposed both count against the cap
    const sixth = await makeBuilder("gate6-cap-6@vnx.si", "gate6-cap-6", "approved");
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request.id}/invite`, { builder: [sixth.userId] }, adminCookie)).status).toBe(400);
    expect(await listRequestInvites(testEnv.DB, request.id)).toHaveLength(5);
  });

  it("a builder who was not invited cannot see the request (404)", async () => {
    const { request } = await makeRequest({ tag: "gate6-404" });
    const [invite] = await inviteBuilders(request, [await makeBuilder("gate6-404-a@vnx.si", "gate6-404-a", "approved")]);
    await makeBuilder("gate6-404-x@vnx.si", "gate6-404-x", "approved");
    const cookie = (await signIn("gate6-404-x@vnx.si")).cookie;
    expect((await get(`/hub/invitations/${invite!.id}`, cookie)).status).toBe(404);
  });
});
```

Chạy: `npm test -w apps/web -- test/request-gate.test.ts` → PASS.

- [ ] **Step 9: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/views/me/Proposals.tsx apps/web/src/routes/me-requests.tsx apps/web/src/db/requests.ts apps/web/src/db/inquiries.ts apps/web/src/domain/inquiry.ts apps/web/src/views/proposal.ts apps/web/src/email/templates/request.ts apps/web/src/notify/inquiry.ts apps/web/src/jobs/daily.ts apps/web/src/views/InquiryThread.tsx apps/web/src/views/hub/InquiriesPage.tsx apps/web/src/views/admin/InquiriesPage.tsx apps/web/src/i18n/messages/en.ts apps/web/src/i18n/messages/vi.ts apps/web/src/i18n/messages/zh-hans.ts apps/web/src/i18n/messages/zh-hant.ts apps/web/test/me/select.test.ts apps/web/test/request-gate.test.ts apps/web/test/db/requests.test.ts apps/web/test/email/request-templates.test.ts
git commit -m "feat(web): choose a proposal and open a request inquiry; M6 exit gate (VNX-0605)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Thêm vào `git add` mọi test hiện có phải sửa vì `InquirySummary.requestTitle`, nếu có.)

#### Task 6b: VNX-0605b — Che tên client ở mọi bề mặt M5 mà builder thấy; test lộ email đầu-cuối

**Khi nào:** ngay sau Task 6, trước Task 7. Quyết định của Owner (2026-10-04): `builderFacingName` áp cho mọi bề mặt M5 mà builder thấy, kể cả tiêu đề email, và dùng kiểu có nhãn `BuilderFacingName` để không truyền nhầm tên thô. Lý do cần: Inquiry sinh từ request sao chép `requests.client_name` vào `inquiries.client_name`; client gõ email làm tên thì Inquiry M5 lộ nó cho builder.

**Files:**
- Modify: `apps/web/src/email/templates/inquiry.ts` (`newInquiryEmail`, `inquiryReminderEmail` nhận `clientName: BuilderFacingName`; thêm `inquiryMessageForBuilderEmail`)
- Modify: `apps/web/src/notify/inquiry.ts`, `apps/web/src/jobs/daily.ts`
- Modify: `apps/web/src/views/hub/InquiriesPage.tsx`, `apps/web/src/views/InquiryThread.tsx`, `apps/web/src/routes/hub-inquiries.tsx`
- Test: `apps/web/test/me/mask.test.ts` (mới), `apps/web/test/architecture.test.ts`, sửa `apps/web/test/email/inquiry-templates.test.ts` (và test khác nếu typecheck báo)

**Interfaces:**
- Consumes: `builderFacingName`, `BuilderFacingName` (`domain/inquiry.ts`), `notifyInvited`, `notifyInviteReminder`, `runDaily`, `requestSelectedEmail` (Task 6).
- Produces: `newInquiryEmail` / `inquiryReminderEmail` với `clientName: BuilderFacingName`; `inquiryMessageForBuilderEmail(locale, { fromName: BuilderFacingName; productName: string | null; body: string; url }): Email`. `inquiryMessageEmail` giữ nguyên chữ ký và chỉ còn cho hướng builder → client (`fromName` là tên công khai của builder).

**Quyết định kỹ thuật:**
1. Tách `inquiryMessageEmail` làm hai hàm mỏng gọi chung một hàm riêng `messageEmail`: kiểu có nhãn chỉ bắt buộc được ở hướng tới builder; hướng tới client mang tên builder (đã công khai) nên không cần nhãn.
2. Che ở lúc hiển thị / gửi, **không** sửa dữ liệu `inquiries.client_name` (admin vẫn thấy tên thật; M5 không đổi schema).
3. View không ép được bằng kiểu (chuỗi vào `tr()`), nên thêm test quét nguồn trong `architecture.test.ts`: ở bảy file hướng builder (gồm `InvitationsPage`, `RequestFacts`), sau khi bỏ các lời gọi `builderFacingName(…clientName)` không dòng nào còn `.clientName`; mỗi file phải tồn tại và có ít nhất một `builderFacingName(`.
4. Chỉ che **tên**; nội dung client gõ (tin nhắn, mô tả request) giữ nguyên, như spec 5.6 / 5.7 (chỉ cấm email của tài khoản, không quét văn bản tự do).

- [ ] **Step 1: Test lộ email đầu-cuối (fail)**

`apps/web/test/me/mask.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { notifyInvited, notifyInviteReminder } from "../../src/notify/request.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("a client who types their e-mail as their name (Owner 2026-10-04, Review Focus 1)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("never reaches the builder: not in subjects, texts, html, inbox or thread, from invitation to reminder", async () => {
    const { client, request } = await makeRequest({ tag: "mk" });
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run();
    const builder = await makeBuilder("mk-a@vnx.si", "mk-a", "approved", { name: "Mk A" });
    const [invite] = await inviteBuilders(request, [builder]);
    await notifyInvited(testEnv, [invite!.id]);
    await notifyInviteReminder(testEnv, invite!.id);
    await proposeOn(invite!);

    const clientCookie = (await signIn(client.email)).cookie;
    const builderCookie = (await signIn("mk-a@vnx.si")).cookie;
    expect((await post(`/me/requests/${request.id}/select`, clientCookie, { invite: invite!.id })).status).toBe(303);
    const inquiryId = (await listRequestInvites(testEnv.DB, request.id))[0]!.invite.inquiryId!;
    expect((await findInquiryById(testEnv.DB, inquiryId))?.clientName).toBe(client.email); // stored as typed: the mask is applied on the way out
    expect((await post(`/me/inquiries/${inquiryId}/reply`, clientCookie, { body: "Can you start Monday?" })).status).toBe(303);
    await runDaily(testEnv, new Date(Date.now() + 4 * 24 * 3600 * 1000)); // inquiry reminder for the unanswered thread

    const toBuilder = outbox.filter((m) => m.to === "mk-a@vnx.si");
    expect(toBuilder.length).toBeGreaterThanOrEqual(5); // invited, reminder, chosen, new message, inquiry reminder
    for (const m of toBuilder) for (const part of [m.subject, m.text, m.html]) expect(part, m.subject).not.toContain(client.email);
    expect(toBuilder.find((m) => m.subject.includes("chose your proposal"))?.subject).toBe("••• chose your proposal");
    const pages = [await (await get("/hub/inquiries", builderCookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, builderCookie)).text()];
    for (const html of pages) expect(html).not.toContain(client.email);
    expect(pages[0]).toContain("From •••");
    // The client still sees what was typed.
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("To Mk A");
  });
});
```

Thêm vào `apps/web/test/architecture.test.ts`:

```ts
// Owner 2026-10-04: a client's typed name may be their e-mail; builder-facing code reads it only through builderFacingName.
const BUILDER_FACING_FILES = [
  "../src/views/hub/InquiriesPage.tsx",
  "../src/views/hub/InvitationsPage.tsx",
  "../src/views/InquiryThread.tsx",
  "../src/views/RequestFacts.tsx",
  "../src/routes/hub-inquiries.tsx",
  "../src/notify/inquiry.ts",
  "../src/jobs/daily.ts",
];

describe("builder-facing client name", () => {
  it("every use of .clientName in builder-facing code is wrapped in builderFacingName", () => {
    for (const file of BUILDER_FACING_FILES) {
      const src = sources[file];
      expect(src, file).toBeDefined();
      expect(src, file).toContain("builderFacingName(");
      for (const line of (src ?? "").split("\n")) {
        expect(line.replace(/builderFacingName\([\w.]*clientName\)/g, ""), file).not.toMatch(/\.clientName\b/);
      }
    }
  });
});
```

Chạy: `npm test -w apps/web -- test/me/mask.test.ts test/architecture.test.ts` → FAIL.

- [ ] **Step 2: Template, thông báo, cron, view**

`apps/web/src/email/templates/inquiry.ts` (import `type BuilderFacingName` từ `../../domain/inquiry.ts`):

```ts
export function newInquiryEmail(
  locale: Locale,
  input: { clientName: BuilderFacingName; type: InquiryType; productName: string | null; budgetBand: BudgetBand; deadline: string | null; message: string; url: string },
): Email {
  /* thân hàm giữ nguyên */
}

function messageEmail(locale: Locale, input: { fromName: string; productName: string | null; body: string; url: string }): Email {
  /* thân của inquiryMessageEmail hiện tại */
}

/** To the client: `fromName` is the builder's public name. */
export const inquiryMessageEmail = messageEmail;

/** To the builder: the client's typed name only, masked (Owner 2026-10-04). */
export function inquiryMessageForBuilderEmail(locale: Locale, input: { fromName: BuilderFacingName; productName: string | null; body: string; url: string }): Email {
  return messageEmail(locale, input);
}

export function inquiryReminderEmail(locale: Locale, input: { clientName: BuilderFacingName; productName: string | null; url: string }): Email {
  /* thân hàm giữ nguyên */
}
```

`apps/web/src/notify/inquiry.ts`, nhánh `toBuilder` (import `inquiryMessageForBuilderEmail`):

```ts
    if (!ctx.isFirst) mail = inquiryMessageForBuilderEmail(locale, { fromName: builderFacingName(inquiry.clientName), productName: about, body: message.body, url });
    else if (inquiry.type === "request") mail = requestSelectedEmail(locale, { clientName: builderFacingName(inquiry.clientName), title: summary.requestTitle ?? "", body: message.body, url });
    else mail = newInquiryEmail(locale, { clientName: builderFacingName(inquiry.clientName), type: inquiry.type, productName: about, budgetBand: inquiry.budgetBand, deadline: inquiry.deadline, message: message.body, url });
```

(Test quét ở Step 1 yêu cầu mỗi dòng có `clientName` tự gọi `builderFacingName(`, nên không gom vào một biến riêng.)

`apps/web/src/jobs/daily.ts`, `remind`: `clientName: builderFacingName(item.inquiry.clientName)` (import từ `../domain/inquiry.ts`).

`apps/web/src/views/hub/InquiriesPage.tsx`: `tr("inbox.from", { name: builderFacingName(inquiry.clientName) })` (hàm này chỉ dùng `clientName` ở nhánh `viewer === "builder"`).
`apps/web/src/views/InquiryThread.tsx`: `return fromClient ? builderFacingName(inquiry.clientName) : summary.builderName;` (nhánh này chỉ chạy khi người xem là builder: với client, tin của họ hiện "Bạn").
`apps/web/src/routes/hub-inquiries.tsx`, `threadPage`: `const from = builderFacingName(summary.inquiry.clientName);` thành `tr("inbox.from", { name: builderFacingName(summary.inquiry.clientName) })` ở cả `title` và `<h1>` (mỗi dòng tự gọi hàm).

Sửa `apps/web/test/email/inquiry-templates.test.ts` và mọi test typecheck báo: bọc tên truyền vào `newInquiryEmail` / `inquiryReminderEmail` bằng `builderFacingName("Minh")`; ca XSS (`evil`) dùng `builderFacingName(evil)`; gọi `inquiryMessageEmail` hướng builder thì đổi sang `inquiryMessageForBuilderEmail`.

Chạy: `npm test -w apps/web -- test/me test/email test/notify test/jobs test/hub test/architecture.test.ts` → PASS.

- [ ] **Step 3: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/email/templates/inquiry.ts apps/web/src/notify/inquiry.ts apps/web/src/jobs/daily.ts apps/web/src/views/hub/InquiriesPage.tsx apps/web/src/views/InquiryThread.tsx apps/web/src/routes/hub-inquiries.tsx apps/web/test/me/mask.test.ts apps/web/test/architecture.test.ts apps/web/test/email/inquiry-templates.test.ts
git commit -m "fix(web): mask the client's typed name on every builder-facing inquiry surface (VNX-0605b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: VNX-0606 — Cron: lời mời và request hết hạn, nhắc, dọn request chờ; khóa builder / user

**Files:**
- Modify: `apps/web/src/db/requests.ts` (6 hàm mới, dưới)
- Modify: `apps/web/src/jobs/daily.ts` (4 bước mới, kiểu đếm `expired`)
- Modify: `apps/web/src/routes/admin.tsx` (`decide`: khóa builder), `apps/web/src/routes/admin-users.tsx` (`changeUser`: khóa user, cùng `db.batch` với trạng thái, phiên và audit)
- Modify: `apps/web/test/jobs/daily.test.ts` (danh sách bước "rỗng" có thêm 4 bước mới)
- Test: `apps/web/test/jobs/daily-requests.test.ts` (tạo mới)
- Không sửa `notify/request.ts`, `email/templates/request.ts`, locale: Task 2 đã có đủ `notifyInviteReminder`, `notifyInviteExpired`, `notifyRequestExpired`, `notifyNotSelected` và 4 locale. Không thêm key `t()` nào. Không sửa `index.ts` (`scheduled` đã gọi `runDaily` cho `0 1 * * *`) và `deleteGhostUsers` (đã xét `requests` từ Task 1).

**Interfaces:**
- Consumes (code thật):
  - `db/requests.ts`: `endRequestBatch(db, {id, from, to, now}) → {statements, read(results) → {request, notSelected, expired}}`, `proposeStatement`, `returnedInvite`, `listRequestInvites`, `listCandidates`.
  - `db/audit.ts`: `auditStatement(db, input, {requestId, status, updatedAt})`.
  - `notify/request.ts`: `notifyInviteReminder(env, id): NotifyOutcome`; `notifyInviteExpired(env, ids)`, `notifyNotSelected(env, ids)` (cả hai bỏ qua builder không còn công khai nhờ `publicBuilderOnly`); `notifyRequestExpired(env, requestId): NotifyOutcome`.
  - `domain/request.ts`: `INVITE_REMIND_AFTER_MS` (3 ngày), `INVITE_TTL_MS` (7 ngày), `MATCHING_TTL_MS` (30 ngày).
  - `domain/inquiry.ts`: `PENDING_TTL_MS` (48 giờ).
  - `db/users.ts`: `deleteGhostUsers`.
  - `jobs/daily.ts`: `runDaily`, helper `before`.
  - `auth/sessions.ts`: `deleteUserSessionsStatement`.
  - Fixture: `makeRequest`, `makeBuilder`, `inviteBuilders(request, builders, now)` (gọi lại được trên request đã `matching`, để mời thêm vào thời điểm khác), `proposeOn`, `signIn`.
- Produces:
  - `db/requests.ts`:
    - `expireStaleInvites(db, invitedBefore, now): Promise<string[]>` (id các lời mời vừa hết hạn);
    - `expireInvitesOfInactiveBuildersStatement(db, now, builderId?: string | null): D1PreparedStatement`;
    - `expireInvitesOfInactiveBuilders(db, now): Promise<number>`;
    - `listInvitesToRemind(db, invitedBefore, limit?): Promise<string[]>`;
    - `markInviteReminded(db, id, now): Promise<void>`;
    - `listRequestsToExpire(db, matchedBefore, limit?): Promise<string[]>`;
    - `deleteExpiredPendingRequests(db, cutoff): Promise<number>`.
  - `jobs/daily.ts`: bước `invites_expire`, `requests_expire`, `invite_remind`, `pending_requests`; hằng `CRON_LIST_CAP` (200); `DailyResult` thêm `{ job, step, expired }`.

**Quyết định kỹ thuật (Reviewer kiểm):**
1. **Khóa builder / user: không gửi email "lời mời đã kết thúc"** (Owner 2026-10-04). Chỉ hai đường gửi nó: lời mời quá 7 ngày (cron) và request kết thúc (`expired` của `endRequestBatch`). Hai chỗ đảm bảo: (a) đường khóa chỉ chạy câu `UPDATE`, không gọi `notify*`; (b) `notifyInviteExpired` đã bỏ qua builder không công khai (`publicBuilderOnly`), nên dù lời mời của builder bị khóa còn sót ở `invited` (đua, hoặc khóa trực tiếp trong DB) thì lúc client đóng request cũng không có email. Test hồi quy (từ review Task 3) khóa cả hai lớp.
2. **Tức thì và nguyên tử (spec 7.6).** Khóa user: câu hết hạn nằm trong cùng `db.batch` với đổi trạng thái, xóa phiên và audit (nguyên tử). Khóa builder: `decide` (M2) chạy `setBuilderStatus` rồi `writeAudit` thành hai lần gọi riêng, không có dạng câu lệnh để gộp; không đổi cấu trúc code M2 trong task này (ngoài phạm vi). Câu hết hạn của builder chạy ngay sau `setBuilderStatus`; khe hở giữa hai lần gọi vô hại vì `ANSWERABLE` (Task 5) đã chặn builder không còn `approved` gửi đề xuất hay từ chối, và cron quét lại hằng ngày. Câu hết hạn tự kiểm điều kiện (chỉ chạm lời mời của builder hiện không công khai), nên gọi lúc nào cũng không sai, và cron dùng chính nó (không truyền `builderId`).
3. **Điểm trừ §8.10 (chỉ đếm lapse: `julianday(updated_at) - julianday(invited_at) >= 7`).**
   - Cron: `expireStaleInvites` chỉ chạm lời mời có `invited_at < now - 7 ngày` và đặt `updated_at = now`, nên chênh lệch luôn > 7 ngày: đếm đúng.
   - Khóa builder / user: đặt `updated_at = now` của lúc khóa. Khóa trước ngày 7 thì chênh lệch < 7: không bị trừ (test). Khóa sau ngày 7 mà cron chưa chạy (trễ tối đa một ngày) thì có bị đếm, và đúng: lời mời đó đã bỏ trống hơn 7 ngày. Builder bị khóa không được gợi ý (`listCandidates` đòi `approved` + `active`), cửa sổ phạt 60 ngày chỉ bắt đầu có tác dụng khi mở khóa. Cùng lý lẽ cho client đóng request ở ngày 7–8 (Task 3). Không thêm cột hay cờ.
4. **Cron: thứ tự bước là một phần hành vi.** `invites_expire` (quét âm thầm các lời mời của builder không công khai, rồi lapse > 7 ngày và gửi email) chạy trước `requests_expire` (lúc request hết hạn, chỉ còn lời mời mới hơn 7 ngày trong danh sách `expired` của `endRequestBatch`; lời mời cũ hơn đã có email lapse riêng, không email lần hai) và `requests_expire` chạy trước `invite_remind` (lời mời vừa bị request hết hạn kéo theo không còn bị nhắc: `listInvitesToRemind` chỉ lấy request `matching`; nên không bao giờ có "nhắc" rồi "đã kết thúc" cho cùng builder trong một lần chạy). `pending_requests` chạy trước `ghost_users`.
5. **Hạn mềm (§9).** `proposeStatement` / `declineInviteStatement` (Task 5) không xem tuổi lời mời, nên đến khi cron chạy builder vẫn trả lời được. Cron chỉ chạm `status = 'invited'` bằng compare-and-set, nên đua với một câu trả lời thì thua mà không hỏng gì. Test khóa hành vi này.
6. **Nhắc một lần.** `listInvitesToRemind` lọc `reminded_at IS NULL`; cron gọi `notifyInviteReminder` và chỉ khi trả `"sent"` mới `markInviteReminded`. Gửi lỗi thì không đánh dấu và thử lại ở lần chạy sau (tối đa tới khi lời mời hết hạn; hợp quy tắc "email về request gửi một lần, lỗi chỉ ghi log" vì chưa có lần gửi thành công). Email nhắc đã che tên client (`builderFacingName` trong `notifyInviteReminder`); `daily.ts` không đọc `clientName` nên test kiến trúc "tên client" vẫn qua.
7. **Email hết hạn / không được chọn / lapse không có cột gửi lại** (quyết định plan): các id trả về từ `RETURNING` chỉ có đúng ở lần chạy chuyển trạng thái, lần chạy sau không thấy lại, nên không gửi trùng.
8. **Request hết hạn** đi qua `endRequestBatch` (`from: "matching"`, `to: "expired"`) cùng một câu audit `request.expire` có điều kiện; mất compare-and-set (client vừa đóng) thì `read(...).request` là `null`: không gửi gì. Thứ tự gửi: client (`notifyRequestExpired`), `notifyNotSelected(notSelected)`, `notifyInviteExpired(expired)`.
9. `listRequestsToExpire` / `listInvitesToRemind` có giới hạn `CRON_LIST_CAP = 200` mỗi lần chạy, coi là ngưỡng an toàn (không phải hạn mức nghiệp vụ); chạm ngưỡng thì cron `console.warn` (`jobs.daily.capped`), phần còn lại xử lý hôm sau.
10. `deleteExpiredPendingRequests` dùng `RETURNING id` (cùng khuôn với M5 / ARCHITECTURE: không dựa `meta.changes`). Request chờ xác nhận không có lời mời nên không cần xóa bảng con.

**Khác với bản nháp (đã đối chiếu code thật):** `notifyRequestEnded` và `remindInvite` không tồn tại: dùng `notifyRequestExpired` + `notifyNotSelected` + `notifyInviteExpired` và `notifyInviteReminder` (cron tự `markInviteReminded`). `expireStaleInvites` trả danh sách id (bản nháp trả số) để gửi email lapse. `endRequestBatch` nhận một đối tượng (`from`, `to`, `now`) và `read` trả thêm `expired`. Lời mời của builder bị khóa hết hạn không gửi email (bản nháp không nói; nay là quyết định của Owner). Bổ sung: test idempotent, test hạn mềm, test điểm trừ, test hồi quy khóa-rồi-đóng, và `decide` chỉ chạy khi `suspend`. `listRequestsToExpire` trả id.

- [ ] **Step 1: Test (fail)**

`apps/web/test/jobs/daily-requests.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listCandidates, listRequestInvites, findRequestById, proposeStatement, returnedInvite } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { runDaily, type DailyResult } from "../../src/jobs/daily.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-10T01:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3600 * 1000).toISOString();
const sentTo = (to: string) => outbox.filter((m) => m.to === to);
const subjectsTo = (to: string) => sentTo(to).map((m) => m.subject);
const inviteOf = async (requestId: string, inviteId: string) => (await listRequestInvites(testEnv.DB, requestId)).find((x) => x.invite.id === inviteId)!.invite;
const builders = (tag: string, keys: string[]) => Promise.all(keys.map((k) => makeBuilder(`${tag}-${k}@vnx.si`, `${tag}-${k}`, "approved")));
const adminCookie = async () => (await signIn("owner@vnx.si", { admin: true })).cookie;
function stepCount(results: DailyResult[], step: string, key: "sent" | "deleted" | "expired"): number {
  const result = results.find((r) => r.step === step);
  expect(result, step).toBeDefined();
  expect(result, step).toHaveProperty(key);
  return (result as unknown as Record<typeof key, number>)[key];
}

describe("daily job, request steps (spec §8.4, VNX-0606)", () => {
  beforeEach(() => clearOutbox());

  it("reminds a builder once after 3 days, in their language, without the client's e-mail", async () => {
    const { client, request } = await makeRequest({ tag: "dr-rem", now: daysAgo(4) });
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run(); // the client typed their e-mail as their name
    const [b] = await builders("dr-rem", ["b"]);
    await testEnv.DB.prepare("UPDATE users SET locale = 'vi' WHERE id = ?1").bind(b!.userId).run();
    const [invite] = await inviteBuilders(request, [b!], daysAgo(4));
    const fresh = await makeRequest({ tag: "dr-rem2", now: daysAgo(1) });
    await inviteBuilders(fresh.request, await builders("dr-rem2", ["b"]), daysAgo(1));

    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "invite_remind", "sent")).toBeGreaterThanOrEqual(1);
    expect(subjectsTo("dr-rem-b@vnx.si")).toEqual([`Nhắc: hãy phản hồi “${request.title}”`]);
    expect(sentTo("dr-rem-b@vnx.si").every((m) => ![m.subject, m.text, m.html].some((part) => part.includes(client.email)))).toBe(true);
    expect(sentTo("dr-rem2-b@vnx.si")).toEqual([]);
    expect((await inviteOf(request.id, invite!.id)).remindedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dr-rem-b@vnx.si")).toEqual([]);
  });

  it("lapses an invitation after 7 days with one 'ended' e-mail; a late answer before the cron still counts (soft deadline)", async () => {
    const { request } = await makeRequest({ tag: "dr-exp", now: daysAgo(8) });
    const [a, b, d] = await builders("dr-exp", ["a", "b", "d"]);
    const [ia, ib] = await inviteBuilders(request, [a!, b!], daysAgo(8));
    const [id] = await inviteBuilders(request, [d!], daysAgo(6));
    // Day 8, the cron has not run yet: b still answers, and it is accepted.
    const answered = await testEnv.DB.batch([
      proposeStatement(testEnv.DB, { inviteId: ib!.id, builderId: b!.userId, proposal: { approach: "Next.js", priceCents: 450000, priceMaxCents: null, priceNote: "", timelineDays: 30 }, now: NOW.toISOString() }),
    ]);
    expect(returnedInvite(answered[0])?.status).toBe("proposed");

    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "invites_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect((await inviteOf(request.id, ia!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, ib!.id)).status).toBe("proposed");
    expect((await inviteOf(request.id, id!.id)).status).toBe("invited");
    // a lapsed: the "ended" e-mail only (expired before the reminder step); d is 6 days old: reminded, not expired; b answered: nothing.
    expect(subjectsTo("dr-exp-a@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
    expect(subjectsTo("dr-exp-d@vnx.si")).toEqual([`Reminder: respond to “${request.title}”`]);
    expect(sentTo("dr-exp-b@vnx.si")).toEqual([]);
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(outbox).toEqual([]);
  });

  it("expires a matching request 30 days after matched_at: client told, proposals not selected and told, stale invitations told once", async () => {
    const { request } = await makeRequest({ tag: "dr-req", now: daysAgo(31) });
    const [a, b, d] = await builders("dr-req", ["a", "b", "d"]);
    const [ia, ib] = await inviteBuilders(request, [a!, b!], daysAgo(31));
    const [id] = await inviteBuilders(request, [d!], daysAgo(4)); // matched_at stays at the first invitation; 4 days old would be reminded, but the request ends first
    await proposeOn(ia!, daysAgo(30));

    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "requests_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "expired", closedAt: NOW.toISOString() });
    expect((await inviteOf(request.id, ia!.id)).status).toBe("not_selected");
    expect((await inviteOf(request.id, ib!.id)).status).toBe("expired"); // lapsed at 7 days
    expect((await inviteOf(request.id, id!.id)).status).toBe("expired"); // settled by the request ending
    expect(subjectsTo("dr-req-c@vnx.si")).toEqual([`Your request has expired: ${request.title}`]);
    expect(subjectsTo("dr-req-a@vnx.si")).toEqual([`Update on your proposal: ${request.title}`]);
    expect(subjectsTo("dr-req-b@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
    expect(subjectsTo("dr-req-d@vnx.si")).toEqual([`Invitation ended: ${request.title}`]); // exactly one: no reminder before it (step order)
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.expire' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(outbox).toEqual([]);
  });

  it("counts the 30 days from matched_at, not from creation; a submitted request never expires", async () => {
    const { request } = await makeRequest({ tag: "dr-keep", now: daysAgo(45) });
    await inviteBuilders(request, await builders("dr-keep", ["b"]), daysAgo(29));
    const idle = await makeRequest({ tag: "dr-keep2", now: daysAgo(40) }); // submitted, never invited
    await runDaily(testEnv, NOW);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
    expect((await findRequestById(testEnv.DB, idle.request.id))?.status).toBe("submitted");
  });

  it("deletes unconfirmed requests after 48 hours, then their implicit accounts", async () => {
    const old = await makeRequest({ tag: "dr-pend", status: "pending_verification", now: hoursAgo(49) });
    const young = await makeRequest({ tag: "dr-pend2", status: "pending_verification", now: hoursAgo(47) });
    const confirmed = await makeRequest({ tag: "dr-pend3", now: hoursAgo(49) }); // submitted: the clean-up never touches it
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(old.client.id, hoursAgo(49)).run();
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2 WHERE id = ?1").bind(young.client.id, hoursAgo(47)).run();
    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "pending_requests", "deleted")).toBeGreaterThanOrEqual(1);
    expect(await findRequestById(testEnv.DB, old.request.id)).toBeNull();
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(old.client.id).first()).toBeNull();
    expect((await findRequestById(testEnv.DB, young.request.id))?.status).toBe("pending_verification");
    expect((await findRequestById(testEnv.DB, confirmed.request.id))?.status).toBe("submitted");
    expect(await testEnv.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(young.client.id).first()).not.toBeNull();
  });

  it("is idempotent: a second run sends nothing and changes no row", async () => {
    const lapse = await makeRequest({ tag: "dr-idem1", now: daysAgo(8) });
    await inviteBuilders(lapse.request, await builders("dr-idem1", ["b"]), daysAgo(8));
    const remind = await makeRequest({ tag: "dr-idem2", now: daysAgo(4) });
    await inviteBuilders(remind.request, await builders("dr-idem2", ["b"]), daysAgo(4));
    const old = await makeRequest({ tag: "dr-idem3", now: daysAgo(31) });
    const [x, y] = await builders("dr-idem3", ["x", "y"]);
    const [ix] = await inviteBuilders(old.request, [x!, y!], daysAgo(31));
    await proposeOn(ix!, daysAgo(30));
    await makeRequest({ tag: "dr-idem4", status: "pending_verification", now: hoursAgo(49) });

    await runDaily(testEnv, NOW);
    expect(outbox.length).toBeGreaterThanOrEqual(5);
    const snapshot = async () =>
      JSON.stringify([
        (await testEnv.DB.prepare("SELECT id, status, updated_at, reminded_at FROM request_invites ORDER BY id").all()).results,
        (await testEnv.DB.prepare("SELECT id, status, updated_at, closed_at FROM requests ORDER BY id").all()).results,
        (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first()),
      ]);
    const before = await snapshot();
    clearOutbox();
    const second = await runDaily(testEnv, NOW);
    expect(outbox).toEqual([]);
    expect(await snapshot()).toBe(before);
    expect(second.filter((r) => "error" in r)).toEqual([]);
    expect(stepCount(second, "invites_expire", "expired")).toBe(0);
    expect(stepCount(second, "invite_remind", "sent")).toBe(0);
    expect(stepCount(second, "requests_expire", "expired")).toBe(0);
    expect(stepCount(second, "pending_requests", "deleted")).toBe(0);
  });
});

describe("suspension expires invitations at once and silently (spec §7.6, Owner 2026-10-04)", () => {
  beforeEach(() => clearOutbox());

  it("admin suspends the builder: expired now, no e-mail; the client closing the request later still tells nobody who was suspended", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { client, request } = await makeRequest({ tag: "ds-bld" });
    const [x, y] = await builders("ds-bld", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    expect((await app.request(formPost(`/admin/builders/${x!.userId}/suspend`, { reason: "" }, { cookie }), undefined, testEnv)).status).toBe(303);
    expect((await inviteOf(request.id, ix!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, iy!.id)).status).toBe("invited");
    expect(outbox).toEqual([]);

    const own = await signIn(client.email);
    expect((await app.request(formPost(`/me/requests/${request.id}/close`, {}, { cookie: own.cookie }), undefined, testEnv)).status).toBe(303);
    expect(sentTo("ds-bld-x@vnx.si")).toEqual([]);
    expect(subjectsTo("ds-bld-y@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
  });

  it("even when the suspended builder's invitation is still invited (suspended behind the route's back), closing sends them nothing", async () => {
    const app = createApp();
    const { client, request } = await makeRequest({ tag: "ds-raw" });
    const [x, y] = await builders("ds-raw", ["x", "y"]);
    await inviteBuilders(request, [x!, y!]);
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(x!.userId).run();
    const own = await signIn(client.email);
    expect((await app.request(formPost(`/me/requests/${request.id}/close`, {}, { cookie: own.cookie }), undefined, testEnv)).status).toBe(303);
    expect(sentTo("ds-raw-x@vnx.si")).toEqual([]);
    expect(subjectsTo("ds-raw-y@vnx.si")).toEqual([`Invitation ended: ${request.title}`]);
  });

  it("admin suspends the user: expired in the same transaction as the status and the audit row; unsuspending does not revive it", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { request } = await makeRequest({ tag: "ds-usr" });
    const [x, y] = await builders("ds-usr", ["x", "y"]);
    const [ix, iy] = await inviteBuilders(request, [x!, y!]);
    expect((await app.request(formPost(`/admin/users/${y!.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(303);
    expect((await inviteOf(request.id, iy!.id)).status).toBe("expired");
    expect((await inviteOf(request.id, ix!.id)).status).toBe("invited");
    expect(outbox).toEqual([]);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'user.suspend' AND entity_id = ?1").bind(y!.userId).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    await app.request(formPost(`/admin/users/${y!.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect((await inviteOf(request.id, iy!.id)).status).toBe("expired");
  });

  it("the daily job sweeps what the route missed, silently", async () => {
    const { request } = await makeRequest({ tag: "ds-cron", now: daysAgo(1) });
    const [x] = await builders("ds-cron", ["x"]);
    const [ix] = await inviteBuilders(request, [x!], daysAgo(1));
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(x!.userId).run();
    const results = await runDaily(testEnv, NOW);
    expect(stepCount(results, "invites_expire", "expired")).toBeGreaterThanOrEqual(1);
    expect((await inviteOf(request.id, ix!.id)).status).toBe("expired");
    expect(sentTo("ds-cron-x@vnx.si")).toEqual([]);
  });

  // Spec §8.10 counts only lapses (julianday(updated_at) - julianday(invited_at) >= 7).
  it("a suspension on day 0 is not a lapse for the §8.10 penalty; the cron's 7-day lapse is", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const early = await makeRequest({ tag: "ds-pen1" });
    const [p] = await builders("ds-pen1", ["p"]);
    await inviteBuilders(early.request, [p!]); // invited now
    await app.request(formPost(`/admin/builders/${p!.userId}/suspend`, { reason: "" }, { cookie }), undefined, testEnv);
    await app.request(formPost(`/admin/builders/${p!.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);

    const late = await makeRequest({ tag: "ds-pen2", now: daysAgo(8) });
    const [q] = await builders("ds-pen2", ["q"]);
    await inviteBuilders(late.request, [q!], daysAgo(8));
    await runDaily(testEnv, NOW);

    const other = await makeRequest({ tag: "ds-pen3" });
    const candidates = await listCandidates(testEnv.DB, other.request, daysAgo(60));
    expect(candidates.find((c) => c.userId === p!.userId)?.expiredInvites).toBe(0);
    expect(candidates.find((c) => c.userId === q!.userId)?.expiredInvites).toBe(1);
  });
});
```

(Khóa builder trong test không được là `c`: `makeRequest` đặt client của mỗi `tag` là `<tag>-c@vnx.si`, và không mời được chính client.)

Sửa `apps/web/test/jobs/daily.test.ts`: danh sách bước rỗng gồm cả 4 bước mới theo đúng thứ tự cron:

```ts
// The M5 inquiry steps and the VNX-0606 (M6) request steps run before the clean-up steps (test/jobs/daily-inquiries.test.ts,
// daily-requests.test.ts cover them). This file creates no inquiries, requests or ghost accounts, so they find nothing to do.
const IDLE_ACTIVITY_STEPS = [
  { job: "daily", step: "remind", sent: 0 },
  { job: "daily", step: "alert", sent: 0 },
  { job: "daily", step: "resend", sent: 0 },
  { job: "daily", step: "invites_expire", expired: 0 },
  { job: "daily", step: "requests_expire", expired: 0 },
  { job: "daily", step: "invite_remind", sent: 0 },
  { job: "daily", step: "pending_inquiries", deleted: 0 },
  { job: "daily", step: "pending_requests", deleted: 0 },
  { job: "daily", step: "ghost_users", deleted: 0 },
];
```

Chạy: `npm test -w apps/web -- test/jobs` → FAIL (thiếu bước `invites_expire` … và lời mời của builder bị khóa vẫn `invited`).

- [ ] **Step 2: db cho cron**

Thêm vào `apps/web/src/db/requests.ts`:

```ts
/** Sanity bound on rows one daily run takes from a list; the daily job warns when it is hit. */
export const CRON_LIST_CAP = 200;

/**
 * Spec §8.4: invitations sent before `invitedBefore` that are still unanswered lapse (invited -> expired). Returns their ids
 * for the "invitation ended" e-mail. `now >= invited_at + 7 days` holds for every row, so each one counts as a lapse in the
 * §8.10 penalty (julianday(updated_at) - julianday(invited_at) >= 7); the cron must not call this with a shorter window.
 */
export async function expireStaleInvites(db: D1Database, invitedBefore: string, now: string): Promise<string[]> {
  const { results } = await db
    .prepare("UPDATE request_invites SET status = 'expired', updated_at = ?2 WHERE status = 'invited' AND invited_at < ?1 RETURNING id")
    .bind(invitedBefore, now)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/**
 * Spec §7.6: a builder who is not approved on an active account loses their unanswered invitations (invited -> expired),
 * with no e-mail (Owner 2026-10-04). Checks the builder's CURRENT status itself, so it is safe to batch right after the
 * change that suspended them, or to run for everyone (no `builderId`) from the daily job. `updated_at = now` of the
 * suspension: a suspension before day 7 is not a lapse for the §8.10 penalty.
 */
export function expireInvitesOfInactiveBuildersStatement(db: D1Database, now: string, builderId: string | null = null): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE request_invites SET status = 'expired', updated_at = ?1
       WHERE status = 'invited' AND (?2 IS NULL OR builder_id = ?2)
         AND builder_id IN (SELECT b.user_id FROM builders b JOIN users u ON u.id = b.user_id WHERE b.status != 'approved' OR u.status != 'active')
       RETURNING id`,
    )
    .bind(now, builderId);
}

export async function expireInvitesOfInactiveBuilders(db: D1Database, now: string): Promise<number> {
  return (await expireInvitesOfInactiveBuildersStatement(db, now).all()).results.length;
}

/** Spec §8.4: unanswered invitations sent before `invitedBefore`, not yet reminded, on a matching request, to a public builder. */
export async function listInvitesToRemind(db: D1Database, invitedBefore: string, limit = CRON_LIST_CAP): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT x.id FROM request_invites x
       JOIN requests r ON r.id = x.request_id
       JOIN builders b ON b.user_id = x.builder_id JOIN users u ON u.id = b.user_id
       WHERE x.status = 'invited' AND x.reminded_at IS NULL AND x.invited_at < ?1 AND r.status = 'matching'
         AND b.status = 'approved' AND u.status = 'active'
       ORDER BY x.invited_at, x.id LIMIT ?2`,
    )
    .bind(invitedBefore, limit)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Set once, after the reminder went out (does not touch updated_at: only expiry stamps it). */
export async function markInviteReminded(db: D1Database, id: string, now: string): Promise<void> {
  await db.prepare("UPDATE request_invites SET reminded_at = ?2 WHERE id = ?1 AND reminded_at IS NULL").bind(id, now).run();
}

/** Spec §8.4: matching requests whose first invitation (matched_at) went out before `matchedBefore`. Oldest first. */
export async function listRequestsToExpire(db: D1Database, matchedBefore: string, limit = CRON_LIST_CAP): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM requests WHERE status = 'matching' AND matched_at < ?1 ORDER BY matched_at, id LIMIT ?2")
    .bind(matchedBefore, limit)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Spec §8.4: unconfirmed requests created before `cutoff` go away (they never have invitations). Returns how many. */
export async function deleteExpiredPendingRequests(db: D1Database, cutoff: string): Promise<number> {
  const { results } = await db.prepare("DELETE FROM requests WHERE status = 'pending_verification' AND created_at < ?1 RETURNING id").bind(cutoff).all();
  return results.length;
}
```

- [ ] **Step 3: Các bước cron**

`apps/web/src/jobs/daily.ts` (thêm import; sửa kiểu, `STEPS`, `runDaily`):

```ts
import { auditStatement } from "../db/audit.ts";
import {
  CRON_LIST_CAP,
  deleteExpiredPendingRequests,
  endRequestBatch,
  expireInvitesOfInactiveBuilders,
  expireStaleInvites,
  listInvitesToRemind,
  listRequestsToExpire,
  markInviteReminded,
} from "../db/requests.ts";
import { INVITE_REMIND_AFTER_MS, INVITE_TTL_MS, MATCHING_TTL_MS } from "../domain/request.ts";
import { notifyInviteExpired, notifyInviteReminder, notifyNotSelected, notifyRequestExpired } from "../notify/request.ts";

export type DailyResult =
  | { job: "daily"; step: string; sent: number }
  | { job: "daily"; step: string; deleted: number }
  | { job: "daily"; step: string; expired: number }
  | { job: "daily"; step: string; error: string };

/** `sent` steps count e-mails that went out; `deleted` rows removed; `expired` rows moved to an expired status. */
type Step = { step: string; counts: "sent" | "deleted" | "expired"; run: (env: Bindings, now: Date) => Promise<number> };

/** The cap is a sanity bound, not a business limit: the rest waits for tomorrow, and the log says so. */
function warnIfCapped(step: string, ids: string[]): void {
  if (ids.length >= CRON_LIST_CAP) console.warn(JSON.stringify({ event: "jobs.daily.capped", step, cap: CRON_LIST_CAP }));
}

/**
 * Spec §7.6 / §8.4. First the invitations of builders who are no longer approved (silent, Owner 2026-10-04), then those
 * unanswered for 7 days (one "invitation ended" e-mail each). Deadlines are soft: until this runs, answers are accepted.
 */
async function expireInvites(env: Bindings, now: Date): Promise<number> {
  const iso = now.toISOString();
  const swept = await expireInvitesOfInactiveBuilders(env.DB, iso);
  const lapsed = await expireStaleInvites(env.DB, before(now, INVITE_TTL_MS), iso);
  await notifyInviteExpired(env, lapsed);
  return swept + lapsed.length;
}

/** Spec §8.4: one reminder per invitation, 3 days after it was sent. Marked only after the e-mail went out. */
async function remindInvites(env: Bindings, now: Date): Promise<number> {
  let sent = 0;
  const due = await listInvitesToRemind(env.DB, before(now, INVITE_REMIND_AFTER_MS));
  warnIfCapped("invite_remind", due);
  for (const id of due) {
    if ((await notifyInviteReminder(env, id)) !== "sent") continue;
    await markInviteReminded(env.DB, id, now.toISOString());
    sent++;
  }
  return sent;
}

/**
 * Spec §8.4: a request in `matching` for 30 days (from matched_at) expires through endRequestBatch, so its invitations
 * settle in the same transaction. A lost compare-and-set (the client just closed it) changes and sends nothing.
 */
async function expireRequests(env: Bindings, now: Date): Promise<number> {
  const iso = now.toISOString();
  let expired = 0;
  const due = await listRequestsToExpire(env.DB, before(now, MATCHING_TTL_MS));
  warnIfCapped("requests_expire", due);
  for (const id of due) {
    const end = endRequestBatch(env.DB, { id, from: "matching", to: "expired", now: iso });
    const results = await env.DB.batch([
      ...end.statements,
      auditStatement(env.DB, { actorUserId: null, action: "request.expire", entity: "request", entityId: id, data: { from: "matching" }, now: iso }, { requestId: id, status: "expired", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) continue;
    expired++;
    await notifyRequestExpired(env, id);
    await notifyNotSelected(env, outcome.notSelected);
    await notifyInviteExpired(env, outcome.expired);
  }
  return expired;
}
```

`STEPS` (thứ tự là một phần hành vi, xem Quyết định kỹ thuật 4):

```ts
const STEPS: Step[] = [
  { step: "remind", counts: "sent", run: remind },
  { step: "alert", counts: "sent", run: alert },
  { step: "resend", counts: "sent", run: resend },
  { step: "invites_expire", counts: "expired", run: expireInvites },
  { step: "requests_expire", counts: "expired", run: expireRequests },
  { step: "invite_remind", counts: "sent", run: remindInvites },
  { step: "pending_inquiries", counts: "deleted", run: (env, now) => deleteExpiredPendingInquiries(env.DB, before(now, PENDING_TTL_MS)) },
  { step: "pending_requests", counts: "deleted", run: (env, now) => deleteExpiredPendingRequests(env.DB, before(now, PENDING_TTL_MS)) },
  // After the pending inquiries and requests are gone, their implicit accounts have nothing attached (Owner 2026-10-04).
  { step: "ghost_users", counts: "deleted", run: (env, now) => deleteGhostUsers(env.DB, before(now, PENDING_TTL_MS)) },
  { step: "rate_limits", counts: "deleted", run: (env, now) => deleteOldRateLimitWindows(env.DB, now.getTime()) },
  { step: "login_tokens", counts: "deleted", run: (env, now) => deleteExpiredLoginTokens(env.DB, now) },
  { step: "sessions", counts: "deleted", run: (env, now) => deleteExpiredSessions(env.DB, now) },
];
```

Trong `runDaily`, dựng kết quả theo `counts`:

```ts
const result: DailyResult = counts === "sent" ? { job: "daily", step, sent: n } : counts === "expired" ? { job: "daily", step, expired: n } : { job: "daily", step, deleted: n };
```

Cập nhật doc comment đầu file: thêm "VNX-0606 (M6): invitation reminders and expiry, request expiry, clean-up of unconfirmed requests."

- [ ] **Step 4: Khóa builder / user thì lời mời hết hạn ngay, không email**

`apps/web/src/routes/admin.tsx`, trong `decide`, ngay sau `await writeAudit(...)` (sau audit, để một lỗi ném ra không làm mất dòng audit của M2; cron quét lại):

```ts
  // Spec §7.6: a suspended builder's unanswered invitations expire at once, with no e-mail (Owner 2026-10-04); the daily job re-sweeps.
  if (action === "suspend") await expireInvitesOfInactiveBuildersStatement(c.env.DB, now, builder.userId).run();
```

`apps/web/src/routes/admin-users.tsx`, trong `changeUser`, mảng `statements` (cùng transaction với trạng thái, phiên và audit):

```ts
  const statements = [
    setUserStatusStatement(c.env.DB, { id: target.id, from: target.status, to: next.status, now }),
    ...(action === "suspend" ? [deleteUserSessionsStatement(c.env.DB, target.id), expireInvitesOfInactiveBuildersStatement(c.env.DB, now, target.id)] : []),
    auditStatement(c.env.DB, audit, { userId: target.id, status: next.status, updatedAt: now }),
  ];
```

(`results[0]` vẫn là câu đổi trạng thái; import `expireInvitesOfInactiveBuildersStatement` từ `../db/requests.ts` ở cả hai file. Hai route không import `notify/*` cho việc này.)

Chạy: `npm test -w apps/web -- test/jobs test/admin test/architecture.test.ts` → PASS.

- [ ] **Step 5: Toàn bộ test, typecheck, commit**

```bash
npm run typecheck -w apps/web
npm test
git add apps/web/src/db/requests.ts apps/web/src/jobs/daily.ts apps/web/src/routes/admin.tsx apps/web/src/routes/admin-users.tsx apps/web/test/jobs/daily.test.ts apps/web/test/jobs/daily-requests.test.ts
git commit -m "feat(web): daily request jobs and silent invitation expiry on suspension (VNX-0606)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Tiêu chí hoàn thành (mỗi mục kiểm bằng lệnh):**
- Nhắc một lần sau 3 ngày, đúng ngôn ngữ, không lộ email client: `npm test -w apps/web -- test/jobs/daily-requests.test.ts -t "reminds"`.
- Lapse sau 7 ngày, hạn mềm, thứ tự bước: `-t "lapses"`.
- Request hết hạn 30 ngày tính từ `matched_at`, ba loại email: `-t "expires a matching request"`; giữ request 29 ngày: `-t "keeps"`.
- Xóa request chờ 48 giờ và tài khoản ngầm: `-t "unconfirmed"`.
- Cron idempotent: `-t "idempotent"`.
- Khóa builder / user: hết hạn tức thì, không email, hồi quy khóa-rồi-đóng, điểm trừ: `-t "suspension"`.
- Danh sách bước cũ vẫn khớp: `npm test -w apps/web -- test/jobs/daily.test.ts`.

---

## Cổng ra M6 → test

| Tiêu chí (roadmap M6, spec 9 phần Request) | Kiểm bằng |
|---|---|
| Client chưa đăng nhập gửi → xác nhận email → `submitted` → admin mời 2 builder → `matching` → A đề xuất, B từ chối → client chọn A → `builder_selected`, có Inquiry `type = request` giữa client và A | `test/requests/m6-gate.test.ts` (test 1) |
| Không mời được builder thứ 6 khi đã có 5 lời mời `invited` / `proposed` | `test/requests/m6-gate.test.ts` (test 2), `test/db/requests.test.ts` |
| Builder không được mời thì không xem được request (404) | `test/requests/m6-gate.test.ts` (test 3), `test/hub/invitations.test.ts` |
| Gợi ý: builder có product cùng category xếp trên; builder `closed` không xuất hiện | `test/admin/requests.test.ts`, `test/domain/request.test.ts` |
| Mọi chuyển trạng thái hợp lệ / không hợp lệ của request và lời mời | `test/domain/request.test.ts` |
| `npm run typecheck -w apps/web` sạch, `npm test` xanh | lệnh |

## Nghĩa vụ để lại sau M6 (Reviewer ghi vào `CURRENT-STATUS.md` khi xong)

- **Deploy:** `0008_requests` áp cùng lúc với code M6 (migrate rồi deploy ngay; cron đọc bảng mới). Thêm vào mục "Điều kiện trước khi deploy `main`".
- **M7 (số liệu):** "Request 30 ngày" đếm theo `requests.submitted_at`; dải Live dùng audit `request.submit` / `request.verify` (chỉ `category`, `languages`); Top builder "được chọn" đếm `request_invites.status = 'selected'`; "trả lời nhanh" có thể dùng `invited_at` → `responded_at`.
- **M7:** bảng thước đo ở `/admin` (spec mục 3: số request gửi, tỷ lệ có ≥ 1 đề xuất, tỷ lệ chọn được builder) chưa có task trong roadmap; cần thêm.
- **Wave 2:** `request_invites` (ai được mời, ai đề xuất, ai được chọn) là dữ liệu huấn luyện matching (spec 8.10).

## Ghi nhận (dự kiến)

- Đăng request khi đã đăng nhập là hai lần ghi (`createRequest`, rồi audit `request.submit`), như Inquiry ở M5; mất kết nối giữa hai lần thì request có mà thiếu dòng audit.
- Email về request gửi một lần, không gửi lại (trừ email "được chọn" đi theo Inquiry).
- Gợi ý xét tối đa 1 000 builder; khớp kỹ năng là chuỗi con không phân biệt hoa thường (kỹ năng "Go" khớp "good").
- Audit `request.invite` ghi danh sách admin chọn (`requested`), không phải danh sách thực sự được mời; trang request hiện danh sách thật.
- Builder không sửa / rút đề xuất đã gửi; client không mở lại request đã đóng.
- Chọn đề xuất kiểm builder còn công khai ở route, không trong batch (cửa sổ vài ms).
- Hai lần chạy cron chồng nhau với cùng `now` có thể gửi nhắc hai lần và ghi trùng dòng audit `request.expire` (cùng khuôn với M5); các lần chạy liên tiếp thì idempotent.
- Request của client bị khóa vẫn tiếp tục trong Wave 1; admin gỡ thủ công như spam (Controller quyết định).
