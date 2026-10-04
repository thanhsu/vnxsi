# VNX.SI M5 — Inquiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (thực thi subagent-driven)
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M5 (VNX-0501 … VNX-0506; VNX-0503 tách 0503a / 0503b; thêm VNX-0507 là việc của Owner)
- **Nhánh:** `feat/m5-inquiry` (tách từ `main` @ `2d119b7`)

**Goal:** Client gửi Inquiry từ product hoặc builder profile (chưa đăng nhập thì xác nhận email qua trang trung gian chống trình quét link); builder trả lời / từ chối / đóng trong Hub; client xem và trả lời ở `/me`; admin đánh dấu spam; cron hằng ngày nhắc, báo admin, gửi lại thông báo lỗi và dọn dữ liệu hết hạn.

**Architecture:**
- Giữ khung M1–M4: `domain/inquiry.ts` thuần (state machine, đọc form), `db/inquiries.ts` chỉ truy vấn, `routes/` ghép, `views/` trình bày.
- Mỗi chuyển trạng thái là compare-and-set `UPDATE … WHERE status = <cũ> RETURNING *`; tin nhắn và audit đi cùng trong một `db.batch`, có điều kiện bảo vệ (mất compare-and-set thì không ghi gì).
- Tin nhắn đầu tiên của client cũng là một dòng `inquiry_messages`, nên mọi email thông báo (Inquiry mới, tin nhắn mới, bị từ chối) đi qua một hàm `notifyInquiryMessage` và một cơ chế gửi lại (`notified_at`, `notify_attempts`).
- Module mới `src/notify/` (đọc db, dựng template, gửi qua `Mailer`, ghi `notified_at`) dùng chung cho route và cron. Module `src/jobs/daily.ts` cho cron (ARCHITECTURE mục 5).
- `/auth/verify` thành trang trung gian: GET chỉ xem token (không tiêu), nút POST mới tiêu token. Cùng một endpoint phục vụ `login` và `inquiry_verify`.
- Turnstile qua `src/http/turnstile.ts`, có driver giả cho test; thiếu khóa thì form của người chưa đăng nhập báo "tạm không dùng được" (fail closed).

**Tech Stack:** như M1–M4. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md` mục 5.2 (4 nút, nút Hire), 5.3 (Hub Inquiries, tổng quan), 5.4 (`/me`), 5.5 (admin Inquiry), 5.6, 6.1 (`inquiries`, `inquiry_messages`), 7.3, 8.2, 8.3, 8.4, 8.6, 9. **ADR:** ADR-002 (magic link), ADR-003 (i18n).

## Quyết định của Owner (2026-10-04)

- **Turnstile:** Owner tạo widget cho `vnx.si` trên Cloudflare Dashboard (VNX-0507), đưa site key; secret qua `wrangler secret put TURNSTILE_SECRET`. Thiếu một trong hai → form của người chưa đăng nhập hiện "tạm không dùng được" và POST trả 503 (fail closed, giống Mailer).
- **Turnstile chỉ cho người chưa đăng nhập.** Người đã đăng nhập (đã chứng minh email bằng magic link) chỉ qua honeypot + rate limit.
- **Tài khoản ngầm chưa xác nhận:** cron hằng ngày xóa user tạo quá 48 giờ, chưa từng đăng nhập và không còn gì gắn vào (session, builder, Inquiry, audit với tư cách người làm, invite đã tạo).
- **Tên builder thấy:** tên gõ trên form, lưu ở `inquiries.client_name` (≤ 80). Người đã đăng nhập: điền sẵn từ `users.display_name`, sửa được. Lần xác nhận đầu tiên đặt `users.display_name` nếu đang trống. Không bao giờ đặt tên tài khoản từ một form chưa xác nhận.

## Quyết định thiết kế của Reviewer (trong plan này, Owner duyệt cùng plan)

- **Khác spec 6.1 (thêm cột):** `inquiries.client_name`, `inquiries.opened_at` (mốc tính 3 / 7 ngày; `last_activity_at` thay đổi theo tin nhắn nên không dùng được), `inquiry_messages.kind` (`message` | `decline`: từ chối là một sự kiện trong luồng, kèm lý do tùy chọn), `inquiry_messages.notify_attempts` (spec 8.3: tối đa 3 lần gửi lại).
- **Email "bị từ chối" gửi client** (spec 8.3 không liệt kê; người dùng hợp lý sẽ chờ được báo). Đi chung cơ chế gửi lại.
- **Builder bị khóa** không gửi trả lời / từ chối / đóng được (409), giống khóa sửa product.
- **Honeypot trúng:** trả về như thành công (trang "kiểm tra email" hoặc chuyển về `/me`), không tạo gì.
- **Email của user bị khóa** ở form chưa đăng nhập: trả trang "kiểm tra email" như bình thường, không tạo gì, không gửi gì (không lộ trạng thái tài khoản).
- **Gửi email xác nhận lỗi:** xóa Inquiry đang chờ vừa tạo, báo lỗi ngay trên form (spec 8.3).
- **Thư báo admin quá 7 ngày:** một email tóm tắt mỗi lần cron, gửi mọi địa chỉ trong `ADMIN_EMAILS`, tiếng Anh.
- **Header:** khi đã đăng nhập có link "Inquiries của tôi" (`/me`).

## Global Constraints

- Mọi ràng buộc của plan M0–M4 vẫn áp dụng (không thêm dependency, ranh giới module, Origin check, test sở hữu bảng, `RETURNING` thay `meta.changes` cho bảng có trigger, chuỗi giao diện qua `t()` đủ 4 locale, test nặng có timeout 30 s).
- Migration mới: `apps/web/migrations/0007_inquiries.sql`, chỉ thêm. Không chạy migration remote, không deploy.
- **State machine (spec 7.3):** `verify` (hệ thống, khi bấm xác nhận): `pending_verification` → `open`. `reply` của builder: `open` | `answered` → `answered`. `reply` của client: giữ nguyên `open` / `answered`. `decline` (builder): `open` → `declined`. `close` (client hoặc builder): `open` | `answered` → `closed`. `remove` (admin): mọi trạng thái trừ `removed` → `removed`. `declined`, `closed`, `removed` là cuối: không gửi tin được.
- **Loại:** product: `buy`, `customize` (chỉ khi `customizable`), `hire`, `build_similar`; builder profile: `hire` (`product_id` null). `request` để dành cho M6.
- **Giới hạn:** message đầu 20–2000 ký tự; trả lời ≤ 4000; lý do từ chối ≤ 1000 (tùy chọn); tên 1–80, không ký tự điều khiển; email như form đăng nhập (≤ 254, lowercase); budget `<500` | `500-2k` | `2k-10k` | `>10k` | `unsure`; deadline tùy chọn `YYYY-MM-DD`, từ hôm nay (UTC) tới tối đa 5 năm. Textarea chuẩn hóa CRLF → LF trước khi đếm.
- **Rate limit:** 10 lần gửi Inquiry / giờ / IP (khóa `inquiry:ip:<ip>`), áp cho mọi người.
- **Builder không thấy email client** ở bất kỳ trang, email hay HTML nào. Builder không gửi Inquiry cho chính mình (kiểm ở route và `CHECK (client_user_id != builder_id)`).
- **Công khai:** chỉ product công khai (M3) và builder công khai mới có form; còn lại 404.
- **Hiển thị:** builder không thấy Inquiry `pending_verification` và `removed`; client không thấy `removed`; mọi trang khác chủ → 404.
- **Magic link (VNX-0506):** GET `/auth/verify` không bao giờ tiêu token; chỉ nút POST mới tiêu. Token sai / hết hạn / đã dùng → trang "link không còn dùng được" 400.
- **Thông báo (spec 8.3):** gửi lỗi không hoàn tác thao tác; `notified_at` null → cron gửi lại, tối đa 3 lần tổng cộng, lần thứ 3 lỗi thì ghi audit `inquiry.notify_failed`. Email theo `users.locale` của người nhận; link tuyệt đối theo `APP_ORIGIN`.
- **Cron (spec 8.4) idempotent:** chạy hai lần liên tiếp không gửi trùng.
- **`Cache-Control: no-store`** cho `/hub*`, `/me*`, `/admin*` (mọi tiền tố locale) và trang `/auth/verify`.
- Test admin dùng `owner@vnx.si`. Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.

## Review Focus

1. **Lộ email client cho builder:** email của client không xuất hiện trong HTML `/hub/inquiries*`, trong email gửi builder (Inquiry mới, tin nhắn, nhắc), kể cả khi client dùng email làm tên. Test ở Task 2, 5, 6.
2. **Trình quét link tiêu token:** GET `/auth/verify` (kể cả lặp lại nhiều lần) không làm token mất hiệu lực; POST lần hai thất bại. Test ở Task 3.
3. **Truy cập Inquiry của người khác:** builder khác, client khác, người chưa đăng nhập, id không tồn tại → 404 hoặc chuyển đăng nhập; không trả lời / đóng được. Test ở Task 5, 6.
4. **Lách trạng thái và đua:** gửi tin khi `declined` / `closed` / `removed`, từ chối khi đã `answered`, xác nhận link hai lần, xác nhận sau khi admin đã `removed` → 409 hoặc bỏ qua đúng, không ghi tin, không gửi email. Test ở Task 1, 4, 5, 6.
5. **Form công khai bị lạm dụng:** honeypot, Turnstile sai / thiếu / dịch vụ lỗi, quá 10 lần / giờ, email của user bị khóa, email của chính builder → không tạo gì (hoặc báo lỗi đúng), không lộ trạng thái tài khoản. Test ở Task 4.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-0501 | Migration `0007_inquiries`, `domain/inquiry.ts`, `db/inquiries.ts`, audit có điều kiện cho Inquiry, fixture | — |
| 2 | VNX-0504 | Template email (5 loại, 4 locale), `notify/inquiry.ts`, ghi `notified_at` / `notify_attempts` | 1 |
| 3 | VNX-0506 | `/auth/verify`: GET trang xác nhận, POST tiêu token; helper test; sửa test cũ | — |
| 4 | VNX-0502 | Turnstile, form Inquiry (đã / chưa đăng nhập), nút trên `/p/:slug` và `/b/:handle`, nhánh `inquiry_verify` | 1, 2, 3 |
| 5 | VNX-0503a | Hộp thư Hub (danh sách, luồng, trả lời, từ chối, đóng), số Inquiry `open` ở tổng quan, `Cache-Control: no-store` | 1, 2 |
| 6 | VNX-0503b | `/me` cho client, admin `/admin/inquiries` + `removed`, link header; test cổng ra M5 | 4, 5 |
| 7 | VNX-0505 | Cron hằng ngày: nhắc 3 ngày, báo admin 7 ngày, gửi lại thông báo, dọn Inquiry chờ / user ngầm / token / session / rate limit | 1, 2 |
| — | VNX-0507 | Owner tạo widget Turnstile; Claude đặt site key, Owner đặt secret | không chặn code |

Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: VNX-0501 — Dữ liệu và domain Inquiry

**Files:**
- Create: `apps/web/migrations/0007_inquiries.sql`
- Create: `apps/web/src/domain/inquiry.ts`, `apps/web/src/db/inquiries.ts`
- Modify: `apps/web/src/db/audit.ts` (guard theo Inquiry), `apps/web/src/db/users.ts` (`setDisplayNameIfEmpty`), `apps/web/test/architecture.test.ts` (2 bảng mới trong `WRITERS`), `apps/web/test/fixtures.ts` (`makeInquiry`)
- Test: `apps/web/test/domain/inquiry.test.ts`, `apps/web/test/db/inquiries.test.ts`

**Interfaces:**
- Consumes: `ulid` (`lib/ulid.ts`), `normalizeNewlines` (`domain/product-input.ts`), `auditStatement` (`db/audit.ts`), fixtures `ensureUser`, `makeBuilder`, `makeLiveProduct`.
- Produces:
  - `domain/inquiry.ts` (kể cả type `AdminInquiry`): hằng `INQUIRY_STATUSES`, `INQUIRY_TYPES`, `PRODUCT_INQUIRY_TYPES`, `BUDGET_BANDS`, `MESSAGE_MIN = 20`, `MESSAGE_MAX = 2000`, `REPLY_MAX = 4000`, `NAME_MAX = 80`, `DECLINE_REASON_MAX = 1000`, `INQUIRY_HOURLY_LIMIT_PER_IP = 10`, `PENDING_TTL_MS`, `REMIND_AFTER_MS`, `ALERT_AFTER_MS`, `MAX_NOTIFY_ATTEMPTS = 3`; type `InquiryStatus`, `InquiryType`, `BudgetBand`, `MessageKind`, `Inquiry`, `InquiryMessage`, `InquirySummary`, `InquiryAction`, `InquiryActor`, `InquiryFormValues`, `InquiryInput`, `InquiryErrors`, `InquiryFieldError`; hàm `transition`, `canPostMessage`, `inquiryValuesFromBody`, `isHoneypotFilled`, `parseInquiryForm`, `parseMessageBody`, `parseDeclineReason`.
  - `db/inquiries.ts`: `InquiryGuard`, `NewInquiry`, `createInquiry`, `findInquiryById`, `findBuilderInquiry`, `findClientInquiry`, `listBuilderInquiries`, `listClientInquiries`, `listInquiriesForAdmin`, `countOpenInquiries`, `listMessages`, `setInquiryStatusStatement`, `returnedInquiry`, `setInquiryStatus`, `addMessageStatement`, `deletePendingInquiryStatements`, `deleteExpiredPendingInquiries`, `findMessageContext`, `markMessageNotified`, `recordNotifyFailure`, `listUnnotifiedMessages`, `listInquiriesToRemind`, `markReminded`, `listInquiriesToAlert`, `markAlerted`.
  - `db/audit.ts`: guard `AuditInquiryGuard = InquiryGuard` (nhánh `"inquiryId" in onlyIf`).
  - `db/users.ts`: `setDisplayNameIfEmpty(db, id, name, now)`.
  - fixture `makeInquiry(opts)` → `{ client, builder, product, inquiry, firstMessageId }`.

- [ ] **Step 1: Migration**

`apps/web/migrations/0007_inquiries.sql`:

```sql
-- Wave 1 inquiries (spec §5.6, §6.1, §7.3). Additive only.
-- Additions to spec §6.1 (plan M5): inquiries.client_name (the name the builder sees; never the e-mail),
-- inquiries.opened_at (start of the 3/7-day timers), inquiry_messages.kind ('decline' = the builder declined, body is
-- the optional reason), inquiry_messages.notify_attempts (spec §8.3: at most 3 sends).
CREATE TABLE inquiries (
  id                  TEXT PRIMARY KEY,
  client_user_id      TEXT NOT NULL REFERENCES users (id),
  client_name         TEXT NOT NULL,
  builder_id          TEXT NOT NULL REFERENCES builders (user_id),
  product_id          TEXT REFERENCES products (id),
  request_id          TEXT,
  type                TEXT NOT NULL CHECK (type IN ('buy', 'customize', 'hire', 'build_similar', 'request')),
  message             TEXT NOT NULL,
  budget_band         TEXT NOT NULL CHECK (budget_band IN ('<500', '500-2k', '2k-10k', '>10k', 'unsure')),
  deadline            TEXT,
  status              TEXT NOT NULL
                      CHECK (status IN ('pending_verification', 'open', 'answered', 'declined', 'closed', 'removed')),
  locale              TEXT NOT NULL DEFAULT 'en',
  opened_at           TEXT,
  last_activity_at    TEXT NOT NULL,
  builder_reminded_at TEXT,
  admin_alerted_at    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  -- Spec §5.6: a builder cannot send an inquiry to themself.
  CHECK (client_user_id != builder_id)
);
CREATE INDEX idx_inquiries_builder ON inquiries (builder_id, status);
CREATE INDEX idx_inquiries_client ON inquiries (client_user_id);
CREATE INDEX idx_inquiries_status_opened ON inquiries (status, opened_at);

CREATE TABLE inquiry_messages (
  id              TEXT PRIMARY KEY,
  inquiry_id      TEXT NOT NULL REFERENCES inquiries (id),
  sender_user_id  TEXT NOT NULL REFERENCES users (id),
  kind            TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'decline')),
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  notified_at     TEXT,
  notify_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_inquiry_messages_inquiry ON inquiry_messages (inquiry_id, created_at);
CREATE INDEX idx_inquiry_messages_unnotified ON inquiry_messages (created_at) WHERE notified_at IS NULL;
```

- [ ] **Step 2: Test domain (fail)**

`apps/web/test/domain/inquiry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canPostMessage,
  INQUIRY_STATUSES,
  inquiryValuesFromBody,
  isHoneypotFilled,
  parseDeclineReason,
  parseInquiryForm,
  parseMessageBody,
  PRODUCT_INQUIRY_TYPES,
  transition,
  type InquiryStatus,
} from "../../src/domain/inquiry.ts";

describe("inquiry state machine (spec §7.3)", () => {
  it("opens a pending inquiry only through the confirmation", () => {
    expect(transition("pending_verification", "verify", "system")).toEqual({ ok: true, status: "open" });
    expect(transition("pending_verification", "verify", "client").ok).toBe(false);
    expect(transition("open", "verify", "system").ok).toBe(false);
  });

  it("moves to answered on a builder reply and keeps the status on a client reply", () => {
    expect(transition("open", "reply", "builder")).toEqual({ ok: true, status: "answered" });
    expect(transition("answered", "reply", "builder")).toEqual({ ok: true, status: "answered" });
    expect(transition("open", "reply", "client")).toEqual({ ok: true, status: "open" });
    expect(transition("answered", "reply", "client")).toEqual({ ok: true, status: "answered" });
    expect(transition("open", "reply", "admin").ok).toBe(false);
  });

  it("lets only the builder decline, and only while open", () => {
    expect(transition("open", "decline", "builder")).toEqual({ ok: true, status: "declined" });
    expect(transition("answered", "decline", "builder").ok).toBe(false);
    expect(transition("open", "decline", "client").ok).toBe(false);
  });

  it("closes open or answered inquiries for either party", () => {
    for (const actor of ["client", "builder"] as const) {
      expect(transition("open", "close", actor)).toEqual({ ok: true, status: "closed" });
      expect(transition("answered", "close", actor)).toEqual({ ok: true, status: "closed" });
      expect(transition("declined", "close", actor).ok).toBe(false);
    }
    expect(transition("pending_verification", "close", "client").ok).toBe(false);
  });

  it("lets the admin remove from any status except removed", () => {
    for (const status of INQUIRY_STATUSES) {
      expect(transition(status, "remove", "admin").ok, status).toBe(status !== "removed");
    }
    expect(transition("open", "remove", "builder").ok).toBe(false);
  });

  it("allows messages only while open or answered", () => {
    const allowed = INQUIRY_STATUSES.filter((s: InquiryStatus) => canPostMessage(s));
    expect(allowed).toEqual(["open", "answered"]);
    for (const status of ["declined", "closed", "removed"] as const) {
      expect(transition(status, "reply", "builder").ok).toBe(false);
      expect(transition(status, "reply", "client").ok).toBe(false);
    }
  });
});

const TODAY = "2026-10-04";
const base = { type: "buy", message: "I need online booking for 3 salons.", budgetBand: "500-2k", deadline: "", name: " Minh Tran ", email: " Minh@Example.VN ", website: "" };
const opts = { allowedTypes: PRODUCT_INQUIRY_TYPES, needEmail: true, today: TODAY };

describe("parseInquiryForm (spec §5.6)", () => {
  it("accepts a valid signed-out form and normalizes name and e-mail", () => {
    expect(parseInquiryForm(base, opts)).toEqual({
      ok: true,
      input: { type: "buy", message: "I need online booking for 3 salons.", budgetBand: "500-2k", deadline: null, name: "Minh Tran", email: "minh@example.vn" },
    });
  });

  it("does not ask signed-in clients for an e-mail", () => {
    const parsed = parseInquiryForm({ ...base, email: "" }, { ...opts, needEmail: false });
    expect(parsed).toMatchObject({ ok: true, input: { email: null } });
  });

  it("rejects each invalid field with its own error", () => {
    const parsed = parseInquiryForm(
      { type: "request", message: "too short", budgetBand: "lots", deadline: "2026-10-03", name: "", email: "nope", website: "" },
      opts,
    );
    expect(parsed).toEqual({ ok: false, errors: { type: "choice", message: "too_short", budgetBand: "choice", deadline: "date", name: "required", email: "email" } });
  });

  it("checks lengths after CRLF normalization", () => {
    const exact = "a\r\n".repeat(1000); // 2000 characters once \r\n becomes \n
    const values = inquiryValuesFromBody({ ...base, message: exact });
    expect(parseInquiryForm(values, opts).ok).toBe(true);
    expect(parseInquiryForm({ ...values, message: values.message + "x" }, opts)).toMatchObject({ ok: false, errors: { message: "too_long" } });
    expect(parseInquiryForm({ ...base, name: "x".repeat(81) }, opts)).toMatchObject({ ok: false, errors: { name: "too_long" } });
    expect(parseInquiryForm({ ...base, name: "Minh\u0000" }, opts)).toMatchObject({ ok: false, errors: { name: "invalid" } });
  });

  it("accepts deadlines from today up to 5 years ahead, on real calendar days", () => {
    expect(parseInquiryForm({ ...base, deadline: TODAY }, opts)).toMatchObject({ ok: true, input: { deadline: TODAY } });
    expect(parseInquiryForm({ ...base, deadline: "2031-10-04" }, opts).ok).toBe(true);
    for (const bad of ["2031-10-05", "2026-02-30", "2026-13-01", "04/10/2026", "2026-10-4"]) {
      expect(parseInquiryForm({ ...base, deadline: bad }, opts), bad).toMatchObject({ ok: false, errors: { deadline: "date" } });
    }
  });

  it("only offers the types the target allows", () => {
    expect(parseInquiryForm({ ...base, type: "customize" }, { ...opts, allowedTypes: ["buy", "hire"] })).toMatchObject({ ok: false, errors: { type: "choice" } });
  });

  it("reads non-string body values as empty and spots the honeypot", () => {
    const values = inquiryValuesFromBody({ type: ["buy"], message: undefined, website: "http://spam" });
    expect(values.type).toBe("");
    expect(values.message).toBe("");
    expect(isHoneypotFilled(values)).toBe(true);
    expect(isHoneypotFilled(inquiryValuesFromBody({ website: "  " }))).toBe(false);
  });
});

describe("parseMessageBody / parseDeclineReason", () => {
  it("requires a reply of at most 4000 characters", () => {
    expect(parseMessageBody(" Thanks!\r\nSee you ")).toEqual({ ok: true, body: "Thanks!\nSee you" });
    expect(parseMessageBody("   ")).toEqual({ ok: false, error: "required" });
    expect(parseMessageBody("x".repeat(4001))).toEqual({ ok: false, error: "too_long" });
    expect(parseMessageBody(42)).toEqual({ ok: false, error: "required" });
  });

  it("makes the decline reason optional, at most 1000 characters", () => {
    expect(parseDeclineReason("")).toEqual({ ok: true, reason: "" });
    expect(parseDeclineReason(" Fully booked ")).toEqual({ ok: true, reason: "Fully booked" });
    expect(parseDeclineReason("x".repeat(1001))).toEqual({ ok: false, error: "too_long" });
  });
});
```

Run: `npm test -w apps/web -- test/domain/inquiry.test.ts` → FAIL (module chưa có).

- [ ] **Step 3: `domain/inquiry.ts`**

```ts
import { z } from "zod";
import { normalizeNewlines } from "./product-input.ts";

export const INQUIRY_STATUSES = ["pending_verification", "open", "answered", "declined", "closed", "removed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_TYPES = ["buy", "customize", "hire", "build_similar", "request"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];
/** The product buttons (spec §5.2). "hire" is also the builder-profile button; "request" comes from M6. */
export const PRODUCT_INQUIRY_TYPES = ["buy", "customize", "hire", "build_similar"] as const satisfies readonly InquiryType[];
export const BUDGET_BANDS = ["<500", "500-2k", "2k-10k", ">10k", "unsure"] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];
export type MessageKind = "message" | "decline";

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 2000;
export const REPLY_MAX = 4000;
export const NAME_MAX = 80;
export const DECLINE_REASON_MAX = 1000;
export const INQUIRY_HOURLY_LIMIT_PER_IP = 10;
export const PENDING_TTL_MS = 48 * 60 * 60 * 1000;
export const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const ALERT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Spec §8.3: a notification is tried at most this many times in all. */
export const MAX_NOTIFY_ATTEMPTS = 3;
const DEADLINE_MAX_YEARS = 5;

export interface Inquiry {
  id: string;
  clientUserId: string;
  clientName: string;
  builderId: string;
  productId: string | null;
  requestId: string | null;
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  status: InquiryStatus;
  locale: string;
  openedAt: string | null;
  lastActivityAt: string;
  builderRemindedAt: string | null;
  adminAlertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryMessage {
  id: string;
  inquiryId: string;
  senderUserId: string;
  kind: MessageKind;
  body: string;
  createdAt: string;
  notifiedAt: string | null;
  notifyAttempts: number;
}

/** What inquiry pages show: the inquiry with product and builder names. Never the client's e-mail (spec §5.6). */
export interface InquirySummary {
  inquiry: Inquiry;
  productName: string | null;
  productSlug: string | null;
  builderName: string;
  builderHandle: string;
}

/** Admin list row (spec §5.5): the admin may see the client's e-mail. */
export type AdminInquiry = InquirySummary & { clientEmail: string };

export type InquiryAction = "verify" | "reply" | "decline" | "close" | "remove";
export type InquiryActor = "system" | "client" | "builder" | "admin";
export type InquiryTransition = { ok: true; status: InquiryStatus } | { ok: false; error: "invalid_transition" };

const ACTIVE: readonly InquiryStatus[] = ["open", "answered"];

export function canPostMessage(status: InquiryStatus): boolean {
  return ACTIVE.includes(status);
}

/** Spec §7.3. A builder reply moves open to answered; a client reply keeps the status. */
export function transition(status: InquiryStatus, action: InquiryAction, actor: InquiryActor): InquiryTransition {
  const fail = { ok: false, error: "invalid_transition" } as const;
  switch (action) {
    case "verify":
      return actor === "system" && status === "pending_verification" ? { ok: true, status: "open" } : fail;
    case "reply":
      if (!canPostMessage(status)) return fail;
      if (actor === "builder") return { ok: true, status: "answered" };
      return actor === "client" ? { ok: true, status } : fail;
    case "decline":
      return actor === "builder" && status === "open" ? { ok: true, status: "declined" } : fail;
    case "close":
      return (actor === "client" || actor === "builder") && canPostMessage(status) ? { ok: true, status: "closed" } : fail;
    case "remove":
      return actor === "admin" && status !== "removed" ? { ok: true, status: "removed" } : fail;
  }
}

export type InquiryFormValues = { type: string; message: string; budgetBand: string; deadline: string; name: string; email: string; website: string };
export type InquiryField = "type" | "message" | "budgetBand" | "deadline" | "name" | "email";
export type InquiryFieldError = "required" | "too_short" | "too_long" | "choice" | "date" | "email" | "invalid";
export type InquiryErrors = Partial<Record<InquiryField, InquiryFieldError>>;
export interface InquiryInput {
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  name: string;
  email: string | null;
}

const text = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

export function inquiryValuesFromBody(body: Record<string, unknown>): InquiryFormValues {
  return {
    type: text(body.type),
    message: text(body.message),
    budgetBand: text(body.budgetBand),
    deadline: text(body.deadline).trim(),
    name: text(body.name),
    email: text(body.email),
    website: text(body.website),
  };
}

/** The honeypot field is hidden from people; anything typed into it means a bot. */
export function isHoneypotFilled(values: InquiryFormValues): boolean {
  return values.website.trim() !== "";
}

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const CONTROL = /[\p{Cc}\p{Cf}]/u;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Spec §5.6 form. `today` is the UTC date (YYYY-MM-DD); deadlines run from today to 5 years ahead. */
export function parseInquiryForm(
  values: InquiryFormValues,
  opts: { allowedTypes: readonly InquiryType[]; needEmail: boolean; today: string },
): { ok: true; input: InquiryInput } | { ok: false; errors: InquiryErrors } {
  const errors: InquiryErrors = {};
  const type = (opts.allowedTypes as readonly string[]).includes(values.type) ? (values.type as InquiryType) : null;
  if (!type) errors.type = "choice";

  const message = values.message.trim();
  if (!message) errors.message = "required";
  else if (message.length < MESSAGE_MIN) errors.message = "too_short";
  else if (message.length > MESSAGE_MAX) errors.message = "too_long";

  const budgetBand = (BUDGET_BANDS as readonly string[]).includes(values.budgetBand) ? (values.budgetBand as BudgetBand) : null;
  if (!budgetBand) errors.budgetBand = "choice";

  let deadline: string | null = null;
  if (values.deadline) {
    const latest = `${Number(opts.today.slice(0, 4)) + DEADLINE_MAX_YEARS}${opts.today.slice(4)}`;
    if (!isCalendarDate(values.deadline) || values.deadline < opts.today || values.deadline > latest) errors.deadline = "date";
    else deadline = values.deadline;
  }

  const name = values.name.trim();
  if (!name) errors.name = "required";
  else if (name.length > NAME_MAX) errors.name = "too_long";
  else if (CONTROL.test(name)) errors.name = "invalid";

  let email: string | null = null;
  if (opts.needEmail) {
    const parsed = Email.safeParse(values.email);
    if (parsed.success) email = parsed.data;
    else errors.email = "email";
  }

  if (Object.keys(errors).length > 0 || !type || !budgetBand) return { ok: false, errors };
  return { ok: true, input: { type, message, budgetBand, deadline, name, email } };
}

export function parseMessageBody(raw: unknown): { ok: true; body: string } | { ok: false; error: "required" | "too_long" } {
  const body = text(raw).trim();
  if (!body) return { ok: false, error: "required" };
  if (body.length > REPLY_MAX) return { ok: false, error: "too_long" };
  return { ok: true, body };
}

export function parseDeclineReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: "too_long" } {
  const reason = text(raw).trim();
  return reason.length > DECLINE_REASON_MAX ? { ok: false, error: "too_long" } : { ok: true, reason };
}
```

Run lại test domain → PASS.

- [ ] **Step 4: Audit có điều kiện theo Inquiry**

Trong `apps/web/src/db/audit.ts`:
- Thêm `import type { InquiryGuard } from "./inquiries.ts";`.
- Đổi kiểu tham số `onlyIf` của `auditStatement` thành `AuditUserGuard | AuditProductGuard | InquiryGuard`.
- Ngay sau nhánh `if ("userId" in onlyIf) { … }`, thêm:

```ts
  if ("inquiryId" in onlyIf) {
    return db
      .prepare(
        `INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?8 AND status = ?9 AND updated_at = ?10)`,
      )
      .bind(...values, onlyIf.inquiryId, onlyIf.status, onlyIf.updatedAt);
  }
```

và bổ sung câu trong comment của `auditStatement`: "`inquiryId` on the inquiry's".

- [ ] **Step 5: `db/users.ts` — tên hiển thị**

Thêm cuối `apps/web/src/db/users.ts`:

```ts
/** Sets the display name only when the account has none (first confirmed inquiry; Owner decision 2026-10-04). */
export async function setDisplayNameIfEmpty(db: D1Database, id: string, name: string, now: string): Promise<void> {
  await db
    .prepare("UPDATE users SET display_name = ?2, updated_at = ?3 WHERE id = ?1 AND (display_name IS NULL OR display_name = '')")
    .bind(id, name, now)
    .run();
}
```

- [ ] **Step 6: Test db (fail)**

`apps/web/test/db/inquiries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import {
  addMessageStatement,
  countOpenInquiries,
  createInquiry,
  deleteExpiredPendingInquiries,
  deletePendingInquiryStatements,
  findBuilderInquiry,
  findClientInquiry,
  findInquiryById,
  findMessageContext,
  listBuilderInquiries,
  listClientInquiries,
  listMessages,
  listUnnotifiedMessages,
  markMessageNotified,
  recordNotifyFailure,
  returnedInquiry,
  setInquiryStatus,
  setInquiryStatusStatement,
} from "../../src/db/inquiries.ts";
import { setDisplayNameIfEmpty } from "../../src/db/users.ts";
import { ensureUser, makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const NOW = "2026-10-04T10:00:00.000Z";
const LATER = "2026-10-05T10:00:00.000Z";

describe("db/inquiries", () => {
  it("creates an inquiry with its first message and opened_at only when open", async () => {
    const { inquiry, firstMessageId, product } = await makeInquiry({ tag: "dbi-create", status: "open", now: NOW });
    expect(inquiry).toMatchObject({ status: "open", openedAt: NOW, lastActivityAt: NOW, productId: product!.id, clientName: "Minh Tran", budgetBand: "500-2k" });
    const messages = await listMessages(db(), inquiry.id);
    expect(messages).toEqual([expect.objectContaining({ id: firstMessageId, kind: "message", body: inquiry.message, notifiedAt: null, notifyAttempts: 0 })]);
    const pending = await makeInquiry({ tag: "dbi-pending", status: "pending_verification", now: NOW });
    expect(pending.inquiry.openedAt).toBeNull();
  });

  it("refuses an inquiry from a builder to themself", async () => {
    const { builder } = await makeInquiry({ tag: "dbi-self", status: "open" });
    await expect(
      createInquiry(db(), { clientUserId: builder.userId, clientName: "Me", builderId: builder.userId, productId: null, type: "hire", message: "x".repeat(20), budgetBand: "unsure", deadline: null, status: "open", locale: "en", now: NOW }),
    ).rejects.toThrow();
  });

  it("shows builders neither pending nor removed inquiries, and clients everything but removed", async () => {
    const { builder, client, inquiry: pending } = await makeInquiry({ tag: "dbi-vis", status: "pending_verification" });
    expect(await findBuilderInquiry(db(), builder.userId, pending.id)).toBeNull();
    expect(await findClientInquiry(db(), client.id, pending.id)).not.toBeNull();
    await setInquiryStatus(db(), { id: pending.id, from: "pending_verification", to: "open", now: NOW });
    const found = await findBuilderInquiry(db(), builder.userId, pending.id);
    expect(found).toMatchObject({ inquiry: { status: "open", openedAt: NOW }, builderHandle: "dbi-vis-b", productName: "dbi-vis product" });
    expect(await listBuilderInquiries(db(), builder.userId)).toHaveLength(1);
    expect(await countOpenInquiries(db(), builder.userId)).toBe(1);

    await setInquiryStatus(db(), { id: pending.id, from: "open", to: "removed", now: LATER });
    expect(await findBuilderInquiry(db(), builder.userId, pending.id)).toBeNull();
    expect(await findClientInquiry(db(), client.id, pending.id)).toBeNull();
    expect(await listClientInquiries(db(), client.id)).toEqual([]);
    expect(await countOpenInquiries(db(), builder.userId)).toBe(0);
  });

  it("hides inquiries from other builders and other clients", async () => {
    const a = await makeInquiry({ tag: "dbi-a", status: "open" });
    const b = await makeInquiry({ tag: "dbi-b", status: "open" });
    expect(await findBuilderInquiry(db(), b.builder.userId, a.inquiry.id)).toBeNull();
    expect(await findClientInquiry(db(), b.client.id, a.inquiry.id)).toBeNull();
  });

  it("adds a message and audit row only when the compare-and-set wins", async () => {
    const { builder, inquiry } = await makeInquiry({ tag: "dbi-cas", status: "open", now: NOW });
    const guard = { inquiryId: inquiry.id, status: "answered" as const, updatedAt: LATER };
    const win = await db().batch([
      setInquiryStatusStatement(db(), { id: inquiry.id, from: "open", to: "answered", now: LATER }),
      addMessageStatement(db(), { inquiryId: inquiry.id, senderUserId: builder.userId, kind: "message", body: "Hello!", now: LATER }, guard),
      auditStatement(db(), { actorUserId: builder.userId, action: "inquiry.reply", entity: "inquiry", entityId: inquiry.id, now: LATER }, guard),
    ]);
    expect(returnedInquiry(win[0])).toMatchObject({ status: "answered", lastActivityAt: LATER, openedAt: NOW });
    expect(win[1]?.results).toHaveLength(1);

    // Same transition again: the status is no longer "open", so nothing is written.
    const lose = await db().batch([
      setInquiryStatusStatement(db(), { id: inquiry.id, from: "open", to: "answered", now: "2026-10-06T10:00:00.000Z" }),
      addMessageStatement(db(), { inquiryId: inquiry.id, senderUserId: builder.userId, kind: "message", body: "Again", now: "2026-10-06T10:00:00.000Z" }, { ...guard, updatedAt: "2026-10-06T10:00:00.000Z" }),
    ]);
    expect(returnedInquiry(lose[0])).toBeNull();
    expect(lose[1]?.results).toHaveLength(0);
    expect((await listMessages(db(), inquiry.id)).map((m) => m.body)).toEqual([inquiry.message, "Hello!"]);
    const audits = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audits?.n).toBe(1);
  });

  it("deletes a pending inquiry with its messages but never an open one", async () => {
    const pending = await makeInquiry({ tag: "dbi-del1", status: "pending_verification" });
    const open = await makeInquiry({ tag: "dbi-del2", status: "open" });
    await db().batch(deletePendingInquiryStatements(db(), pending.inquiry.id));
    await db().batch(deletePendingInquiryStatements(db(), open.inquiry.id));
    expect(await findInquiryById(db(), pending.inquiry.id)).toBeNull();
    expect(await listMessages(db(), pending.inquiry.id)).toEqual([]);
    expect(await findInquiryById(db(), open.inquiry.id)).not.toBeNull();
  });

  it("deletes pending inquiries older than the cutoff", async () => {
    const old = await makeInquiry({ tag: "dbi-old", status: "pending_verification", now: "2026-10-01T00:00:00.000Z" });
    const fresh = await makeInquiry({ tag: "dbi-fresh", status: "pending_verification", now: "2026-10-03T12:00:00.000Z" });
    expect(await deleteExpiredPendingInquiries(db(), "2026-10-02T00:00:00.000Z")).toBe(1);
    expect(await findInquiryById(db(), old.inquiry.id)).toBeNull();
    expect(await findInquiryById(db(), fresh.inquiry.id)).not.toBeNull();
  });

  it("tracks notification attempts and lists only messages still due", async () => {
    const { inquiry, firstMessageId } = await makeInquiry({ tag: "dbi-notify", status: "open" });
    const pending = await makeInquiry({ tag: "dbi-notify-p", status: "pending_verification" });
    const due = (await listUnnotifiedMessages(db(), 500)).map((m) => m.id);
    expect(due).toContain(firstMessageId);
    expect(due).not.toContain(pending.firstMessageId);

    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(1);
    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(2);
    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(3);
    expect((await listUnnotifiedMessages(db(), 500)).map((m) => m.id)).not.toContain(firstMessageId);

    const other = await makeInquiry({ tag: "dbi-notify2", status: "open" });
    await markMessageNotified(db(), other.firstMessageId, NOW);
    expect((await listUnnotifiedMessages(db(), 500)).map((m) => m.id)).not.toContain(other.firstMessageId);
    expect(inquiry.id).toBeTruthy();
  });

  it("loads the context a notification needs, with both parties' addresses", async () => {
    const { client, builder, inquiry, firstMessageId } = await makeInquiry({ tag: "dbi-ctx", status: "open" });
    const ctx = await findMessageContext(db(), firstMessageId);
    expect(ctx).toMatchObject({
      message: { id: firstMessageId, senderUserId: client.id },
      summary: { inquiry: { id: inquiry.id }, builderName: builder.name },
      isFirst: true,
      client: { email: client.email, locale: "en" },
      builder: { email: "dbi-ctx-b@vnx.si", locale: "en" },
    });
  });

  it("sets the display name only when empty", async () => {
    const user = await ensureUser("dbi-name@vnx.si");
    await setDisplayNameIfEmpty(db(), user.id, "First", NOW);
    await setDisplayNameIfEmpty(db(), user.id, "Second", NOW);
    const row = await db().prepare("SELECT display_name FROM users WHERE id = ?1").bind(user.id).first<{ display_name: string }>();
    expect(row?.display_name).toBe("First");
  });
});
```

Thêm vào `WRITERS` trong `apps/web/test/architecture.test.ts`:

```ts
  inquiries: "../src/db/inquiries.ts",
  inquiry_messages: "../src/db/inquiries.ts",
```

- [ ] **Step 7: Fixture `makeInquiry`**

Cuối `apps/web/test/fixtures.ts` (import `createInquiry` từ `../src/db/inquiries.ts`, type `Inquiry`, `InquiryStatus`, `InquiryType` từ `../src/domain/inquiry.ts`):

```ts
/**
 * A client, an approved builder (handle `<tag>-b`) with a live product "<tag> product" (unless `withProduct: false`),
 * and an inquiry from the client in `status`.
 */
export async function makeInquiry(opts: { tag: string; status: InquiryStatus; type?: InquiryType; withProduct?: boolean; now?: string; clientLocale?: string; builderLocale?: string }) {
  const now = opts.now ?? new Date().toISOString();
  const client = await ensureUser(`${opts.tag}-c@vnx.si`, opts.clientLocale);
  const builderUser = await ensureUser(`${opts.tag}-b@vnx.si`, opts.builderLocale);
  const builder = await makeBuilder(builderUser.email, `${opts.tag}-b`, "approved", { name: `${opts.tag} builder` });
  const product = opts.withProduct === false ? null : await addLiveProduct(builder, `${opts.tag} product`);
  const { inquiry, firstMessageId } = await createInquiry(testEnv.DB, {
    clientUserId: client.id,
    clientName: "Minh Tran",
    builderId: builder.userId,
    productId: product?.id ?? null,
    type: opts.type ?? (product ? "buy" : "hire"),
    message: "We need online booking for three salons, please.",
    budgetBand: "500-2k",
    deadline: null,
    status: opts.status === "pending_verification" ? "pending_verification" : "open",
    locale: "en",
    now,
  });
  let current: Inquiry = inquiry;
  if (opts.status !== "open" && opts.status !== "pending_verification") {
    const moved = await setInquiryStatus(testEnv.DB, { id: inquiry.id, from: "open", to: opts.status, now });
    if (!moved) throw new Error("status change failed");
    current = moved;
  }
  return { client, builder, product, inquiry: current, firstMessageId };
}
```

(Import `setInquiryStatus` cùng `createInquiry`. `makeBuilder` gọi `ensureUser` nên dùng lại user đã tạo ở trên với `builderLocale`.)

Run: `npm test -w apps/web -- test/db/inquiries.test.ts` → FAIL (module chưa có).

- [ ] **Step 8: `db/inquiries.ts`**

```ts
import { MAX_NOTIFY_ATTEMPTS, type AdminInquiry, type BudgetBand, type Inquiry, type InquiryMessage, type InquiryStatus, type InquirySummary, type InquiryType, type MessageKind } from "../domain/inquiry.ts";
import { ulid } from "../lib/ulid.ts";

type Row = {
  id: string;
  client_user_id: string;
  client_name: string;
  builder_id: string;
  product_id: string | null;
  request_id: string | null;
  type: InquiryType;
  message: string;
  budget_band: BudgetBand;
  deadline: string | null;
  status: InquiryStatus;
  locale: string;
  opened_at: string | null;
  last_activity_at: string;
  builder_reminded_at: string | null;
  admin_alerted_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toInquiry(r: Row): Inquiry {
  return {
    id: r.id,
    clientUserId: r.client_user_id,
    clientName: r.client_name,
    builderId: r.builder_id,
    productId: r.product_id,
    requestId: r.request_id,
    type: r.type,
    message: r.message,
    budgetBand: r.budget_band,
    deadline: r.deadline,
    status: r.status,
    locale: r.locale,
    openedAt: r.opened_at,
    lastActivityAt: r.last_activity_at,
    builderRemindedAt: r.builder_reminded_at,
    adminAlertedAt: r.admin_alerted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type MessageRow = { id: string; inquiry_id: string; sender_user_id: string; kind: MessageKind; body: string; created_at: string; notified_at: string | null; notify_attempts: number };

const toMessage = (r: MessageRow): InquiryMessage => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  senderUserId: r.sender_user_id,
  kind: r.kind,
  body: r.body,
  createdAt: r.created_at,
  notifiedAt: r.notified_at,
  notifyAttempts: r.notify_attempts,
});

/** "This request's compare-and-set on the inquiry went through": statements batched after it check this. */
export type InquiryGuard = { inquiryId: string; status: InquiryStatus; updatedAt: string };

export type NewInquiry = {
  clientUserId: string;
  clientName: string;
  builderId: string;
  productId: string | null;
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  status: "open" | "pending_verification";
  locale: string;
  now: string;
};

/** The inquiry and its first message (the client's text; its notification tells the builder) in one transaction. */
export async function createInquiry(db: D1Database, input: NewInquiry): Promise<{ inquiry: Inquiry; firstMessageId: string }> {
  const at = Date.parse(input.now);
  const id = ulid(at);
  const firstMessageId = ulid(at);
  const [rows] = await db.batch([
    db
      .prepare(
        `INSERT INTO inquiries (id, client_user_id, client_name, builder_id, product_id, type, message, budget_band, deadline, status, locale,
           opened_at, last_activity_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CASE WHEN ?10 = 'open' THEN ?12 END, ?12, ?12, ?12)
         RETURNING *`,
      )
      .bind(id, input.clientUserId, input.clientName, input.builderId, input.productId, input.type, input.message, input.budgetBand, input.deadline, input.status, input.locale, input.now),
    db
      .prepare("INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at) VALUES (?1, ?2, ?3, 'message', ?4, ?5)")
      .bind(firstMessageId, id, input.clientUserId, input.message, input.now),
  ]);
  const row = rows?.results[0] as Row | undefined;
  if (!row) throw new Error("inquiry insert failed");
  return { inquiry: toInquiry(row), firstMessageId };
}

export async function findInquiryById(db: D1Database, id: string): Promise<Inquiry | null> {
  const row = await db.prepare("SELECT * FROM inquiries WHERE id = ?1").bind(id).first<Row>();
  return row ? toInquiry(row) : null;
}

type SummaryRow = Row & { product_name: string | null; product_slug: string | null; builder_name: string; builder_handle: string };

const SUMMARY = `SELECT i.*, p.name AS product_name, p.slug AS product_slug, b.name AS builder_name, b.handle AS builder_handle
  FROM inquiries i JOIN builders b ON b.user_id = i.builder_id LEFT JOIN products p ON p.id = i.product_id`;

const toSummary = (r: SummaryRow): InquirySummary => ({ inquiry: toInquiry(r), productName: r.product_name, productSlug: r.product_slug, builderName: r.builder_name, builderHandle: r.builder_handle });

// Spec §5.3/§5.4: builders never see unconfirmed or removed inquiries; clients never see removed ones.
const BUILDER_VISIBLE = "i.status NOT IN ('pending_verification', 'removed')";
const CLIENT_VISIBLE = "i.status != 'removed'";

export async function findBuilderInquiry(db: D1Database, builderId: string, id: string): Promise<InquirySummary | null> {
  const row = await db.prepare(`${SUMMARY} WHERE i.id = ?1 AND i.builder_id = ?2 AND ${BUILDER_VISIBLE}`).bind(id, builderId).first<SummaryRow>();
  return row ? toSummary(row) : null;
}

export async function findClientInquiry(db: D1Database, clientUserId: string, id: string): Promise<InquirySummary | null> {
  const row = await db.prepare(`${SUMMARY} WHERE i.id = ?1 AND i.client_user_id = ?2 AND ${CLIENT_VISIBLE}`).bind(id, clientUserId).first<SummaryRow>();
  return row ? toSummary(row) : null;
}

/** Most recent activity first. */
export async function listBuilderInquiries(db: D1Database, builderId: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.builder_id = ?1 AND ${BUILDER_VISIBLE} ORDER BY i.last_activity_at DESC, i.id DESC LIMIT ?2`)
    .bind(builderId, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function listClientInquiries(db: D1Database, clientUserId: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.client_user_id = ?1 AND ${CLIENT_VISIBLE} ORDER BY i.last_activity_at DESC, i.id DESC LIMIT ?2`)
    .bind(clientUserId, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

/** Admin list (spec §5.5), newest first; the admin may see the client's e-mail. */
export async function listInquiriesForAdmin(db: D1Database, status: InquiryStatus | null, limit = 200): Promise<AdminInquiry[]> {
  const { results } = await db
    .prepare(
      `SELECT i.*, p.name AS product_name, p.slug AS product_slug, b.name AS builder_name, b.handle AS builder_handle, u.email AS client_email
       FROM inquiries i JOIN builders b ON b.user_id = i.builder_id JOIN users u ON u.id = i.client_user_id LEFT JOIN products p ON p.id = i.product_id
       WHERE (?1 IS NULL OR i.status = ?1) ORDER BY i.created_at DESC, i.id DESC LIMIT ?2`,
    )
    .bind(status, limit)
    .all<SummaryRow & { client_email: string }>();
  return results.map((r) => ({ ...toSummary(r), clientEmail: r.client_email }));
}

export async function countOpenInquiries(db: D1Database, builderId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE builder_id = ?1 AND status = 'open'").bind(builderId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listMessages(db: D1Database, inquiryId: string): Promise<InquiryMessage[]> {
  const { results } = await db.prepare("SELECT * FROM inquiry_messages WHERE inquiry_id = ?1 ORDER BY created_at, id").bind(inquiryId).all<MessageRow>();
  return results.map(toMessage);
}

/**
 * Compare-and-set on status, as a statement for db.batch. Every change also counts as activity; the first move to
 * "open" stamps opened_at. Returns the row (RETURNING), or nothing when the status was no longer `from`.
 */
export function setInquiryStatusStatement(db: D1Database, input: { id: string; from: InquiryStatus; to: InquiryStatus; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE inquiries SET status = ?3, updated_at = ?4, last_activity_at = ?4,
         opened_at = CASE WHEN ?3 = 'open' THEN COALESCE(opened_at, ?4) ELSE opened_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.now);
}

/** The inquiry a batched setInquiryStatusStatement returned, or null when its compare-and-set lost. */
export function returnedInquiry(result: D1Result | undefined): Inquiry | null {
  const row = result?.results[0] as Row | undefined;
  return row ? toInquiry(row) : null;
}

export async function setInquiryStatus(db: D1Database, input: { id: string; from: InquiryStatus; to: InquiryStatus; now: string }): Promise<Inquiry | null> {
  const row = await setInquiryStatusStatement(db, input).first<Row>();
  return row ? toInquiry(row) : null;
}

/** A message, written only when the same batch's compare-and-set left the inquiry as `guard` says. */
export function addMessageStatement(
  db: D1Database,
  input: { inquiryId: string; senderUserId: string; kind: MessageKind; body: string; now: string },
  guard: InquiryGuard,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO inquiry_messages (id, inquiry_id, sender_user_id, kind, body, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?7 AND status = ?8 AND updated_at = ?9)
       RETURNING id`,
    )
    .bind(ulid(Date.parse(input.now)), input.inquiryId, input.senderUserId, input.kind, input.body, input.now, guard.inquiryId, guard.status, guard.updatedAt);
}

/** Removes an unconfirmed inquiry and its messages; never touches one that has been confirmed. */
export function deletePendingInquiryStatements(db: D1Database, id: string): D1PreparedStatement[] {
  return [
    db.prepare("DELETE FROM inquiry_messages WHERE inquiry_id = ?1 AND EXISTS (SELECT 1 FROM inquiries WHERE id = ?1 AND status = 'pending_verification')").bind(id),
    db.prepare("DELETE FROM inquiries WHERE id = ?1 AND status = 'pending_verification'").bind(id),
  ];
}

/** Spec §8.4: unconfirmed inquiries created before `cutoff` go away. Returns how many inquiries were deleted. */
export async function deleteExpiredPendingInquiries(db: D1Database, cutoff: string): Promise<number> {
  const [, inquiries] = await db.batch([
    db.prepare("DELETE FROM inquiry_messages WHERE inquiry_id IN (SELECT id FROM inquiries WHERE status = 'pending_verification' AND created_at < ?1)").bind(cutoff),
    db.prepare("DELETE FROM inquiries WHERE status = 'pending_verification' AND created_at < ?1").bind(cutoff),
  ]);
  return inquiries?.meta.changes ?? 0;
}

export type Party = { userId: string; email: string; locale: string };

export type MessageContext = {
  message: InquiryMessage;
  summary: InquirySummary;
  /** The client's first message, which opens the inquiry for the builder. */
  isFirst: boolean;
  client: Party;
  builder: Party;
};

type ContextRow = SummaryRow & {
  m_id: string;
  m_inquiry_id: string;
  m_sender_user_id: string;
  m_kind: MessageKind;
  m_body: string;
  m_created_at: string;
  m_notified_at: string | null;
  m_notify_attempts: number;
  client_email: string;
  client_locale: string;
  builder_email: string;
  builder_locale: string;
  first_id: string;
};

/** Everything a notification for this message needs. Both e-mails are loaded here and used only as recipients. */
export async function findMessageContext(db: D1Database, messageId: string): Promise<MessageContext | null> {
  const r = await db
    .prepare(
      `SELECT m.id AS m_id, m.inquiry_id AS m_inquiry_id, m.sender_user_id AS m_sender_user_id, m.kind AS m_kind, m.body AS m_body,
         m.created_at AS m_created_at, m.notified_at AS m_notified_at, m.notify_attempts AS m_notify_attempts,
         i.*, p.name AS product_name, p.slug AS product_slug, b.name AS builder_name, b.handle AS builder_handle,
         cu.email AS client_email, cu.locale AS client_locale, bu.email AS builder_email, bu.locale AS builder_locale,
         (SELECT f.id FROM inquiry_messages f WHERE f.inquiry_id = i.id ORDER BY f.created_at, f.id LIMIT 1) AS first_id
       FROM inquiry_messages m
       JOIN inquiries i ON i.id = m.inquiry_id
       JOIN builders b ON b.user_id = i.builder_id
       JOIN users cu ON cu.id = i.client_user_id
       JOIN users bu ON bu.id = i.builder_id
       LEFT JOIN products p ON p.id = i.product_id
       WHERE m.id = ?1`,
    )
    .bind(messageId)
    .first<ContextRow>();
  if (!r) return null;
  return {
    message: toMessage({ id: r.m_id, inquiry_id: r.m_inquiry_id, sender_user_id: r.m_sender_user_id, kind: r.m_kind, body: r.m_body, created_at: r.m_created_at, notified_at: r.m_notified_at, notify_attempts: r.m_notify_attempts }),
    summary: toSummary(r),
    isFirst: r.first_id === r.m_id,
    client: { userId: r.client_user_id, email: r.client_email, locale: r.client_locale },
    builder: { userId: r.builder_id, email: r.builder_email, locale: r.builder_locale },
  };
}

export async function markMessageNotified(db: D1Database, messageId: string, now: string): Promise<void> {
  await db.prepare("UPDATE inquiry_messages SET notified_at = ?2 WHERE id = ?1 AND notified_at IS NULL").bind(messageId, now).run();
}

/** Counts one failed send; returns the attempts so far. */
export async function recordNotifyFailure(db: D1Database, messageId: string): Promise<number> {
  const row = await db
    .prepare("UPDATE inquiry_messages SET notify_attempts = notify_attempts + 1 WHERE id = ?1 RETURNING notify_attempts")
    .bind(messageId)
    .first<{ notify_attempts: number }>();
  return row?.notify_attempts ?? 0;
}

/** Messages whose notification is still due (spec §8.3): unsent, under the attempt cap, on a confirmed, non-removed inquiry. */
export async function listUnnotifiedMessages(db: D1Database, limit = 100): Promise<InquiryMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM inquiry_messages m JOIN inquiries i ON i.id = m.inquiry_id
       WHERE m.notified_at IS NULL AND m.notify_attempts < ?1 AND i.status NOT IN ('pending_verification', 'removed')
       ORDER BY m.created_at, m.id LIMIT ?2`,
    )
    .bind(MAX_NOTIFY_ATTEMPTS, limit)
    .all<MessageRow>();
  return results.map(toMessage);
}

/** Spec §8.4: open (unanswered) inquiries opened before `openedBefore` whose builder has not been reminded. */
export async function listInquiriesToRemind(db: D1Database, openedBefore: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.status = 'open' AND i.opened_at < ?1 AND i.builder_reminded_at IS NULL ORDER BY i.opened_at, i.id LIMIT ?2`)
    .bind(openedBefore, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function markReminded(db: D1Database, id: string, now: string): Promise<void> {
  await db.prepare("UPDATE inquiries SET builder_reminded_at = ?2 WHERE id = ?1 AND builder_reminded_at IS NULL").bind(id, now).run();
}

/** Spec §8.4: open inquiries opened before `openedBefore` the admins have not been told about. */
export async function listInquiriesToAlert(db: D1Database, openedBefore: string, limit = 200): Promise<InquirySummary[]> {
  const { results } = await db
    .prepare(`${SUMMARY} WHERE i.status = 'open' AND i.opened_at < ?1 AND i.admin_alerted_at IS NULL ORDER BY i.opened_at, i.id LIMIT ?2`)
    .bind(openedBefore, limit)
    .all<SummaryRow>();
  return results.map(toSummary);
}

export async function markAlerted(db: D1Database, ids: string[], now: string): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(ids.map((id) => db.prepare("UPDATE inquiries SET admin_alerted_at = ?2 WHERE id = ?1 AND admin_alerted_at IS NULL").bind(id, now)));
}
```

- [ ] **Step 9: Chạy test, commit**

Run: `npm test -w apps/web -- test/domain/inquiry.test.ts test/db/inquiries.test.ts test/architecture.test.ts` → PASS.
Run: `npm run typecheck -w apps/web && npm test` → exit 0, mọi test xanh.

```bash
git add apps/web/migrations/0007_inquiries.sql apps/web/src/domain/inquiry.ts apps/web/src/db/inquiries.ts apps/web/src/db/audit.ts apps/web/src/db/users.ts apps/web/test/architecture.test.ts apps/web/test/fixtures.ts apps/web/test/domain/inquiry.test.ts apps/web/test/db/inquiries.test.ts
git commit -m "feat(web): inquiry data model, state machine and queries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: VNX-0504 — Email thông báo và gửi lại

**Files:**
- Create: `apps/web/src/email/templates/inquiry.ts`, `apps/web/src/notify/inquiry.ts`
- Modify: `apps/web/src/views/labels.ts` (`INQUIRY_TYPE_KEY`, `BUDGET_KEY`, `INQUIRY_STATUS_KEY`), 4 file i18n
- Test: `apps/web/test/email/inquiry-templates.test.ts`, `apps/web/test/notify/inquiry.test.ts`

**Interfaces:**
- Consumes: Task 1 (`findMessageContext`, `markMessageNotified`, `recordNotifyFailure`, `MAX_NOTIFY_ATTEMPTS`, `InquirySummary`, fixture `makeInquiry`), `getMailer`, `outbox` / `clearOutbox` (`email/fake.ts`), `writeAudit`, `localizedPath`, `isLocale`.
- Produces:
  - `email/templates/inquiry.ts`: `inquiryConfirmEmail(locale, { builderName, productName, link })`, `newInquiryEmail(locale, { clientName, type, productName, budgetBand, deadline, message, url })`, `inquiryMessageEmail(locale, { fromName, productName, body, url })`, `inquiryDeclinedEmail(locale, { builderName, productName, reason, url })`, `inquiryReminderEmail(locale, { clientName, productName, url })`, `inquiryAdminAlertEmail(items: { id, builderHandle, productName, openedAt }[], url)` (tiếng Anh). Mỗi hàm trả `{ subject, text, html }`.
  - `notify/inquiry.ts`: `notifyInquiryMessage(env: Bindings, messageId: string, now: Date): Promise<"sent" | "failed" | "skipped">`; `inquiryUrl(env, locale, inquiryId, side: "builder" | "client"): string`.
  - Nhãn: `INQUIRY_TYPE_KEY`, `BUDGET_KEY`, `INQUIRY_STATUS_KEY` (`views/labels.ts`).

- [ ] **Step 1: Key i18n**

Thêm vào cuối object của từng file locale, đúng thứ tự giữa 4 file.

`en.ts`:

```ts
  "inquiry.type.buy": "Buy",
  "inquiry.type.customize": "Customize",
  "inquiry.type.hire": "Hire",
  "inquiry.type.build_similar": "Build something similar",
  "inquiry.type.request": "Request",
  "inquiry.budget.lt500": "Under $500",
  "inquiry.budget.500-2k": "$500 – $2,000",
  "inquiry.budget.2k-10k": "$2,000 – $10,000",
  "inquiry.budget.gt10k": "Over $10,000",
  "inquiry.budget.unsure": "Not sure yet",
  "inquiry.status.pending_verification": "Waiting for e-mail confirmation",
  "inquiry.status.open": "Open",
  "inquiry.status.answered": "Answered",
  "inquiry.status.declined": "Declined",
  "inquiry.status.closed": "Closed",
  "inquiry.status.removed": "Removed",
  "email.inquiryConfirm.subject": "Confirm your inquiry on VNX.SI",
  "email.inquiryConfirm.body": "You asked {builder} about {product}. Click the link below to confirm your e-mail and send it. The link works once and expires in 15 minutes.",
  "email.inquiryConfirm.ignore": "If you didn't send this, ignore this e-mail and nothing will be sent.",
  "email.newInquiry.subject": "New inquiry: {type} from {client}",
  "email.newInquiry.intro": "{client} sent you an inquiry ({type}) about {product}.",
  "email.newInquiry.budget": "Budget: {budget}",
  "email.newInquiry.deadline": "Deadline: {deadline}",
  "email.newInquiry.cta": "Reply on VNX.SI (replies by e-mail are not delivered):",
  "email.inquiryMessage.subject": "New message from {from}",
  "email.inquiryMessage.intro": "{from} wrote about {product}:",
  "email.inquiryMessage.cta": "Read and reply on VNX.SI:",
  "email.inquiryDeclined.subject": "{builder} declined your inquiry",
  "email.inquiryDeclined.intro": "{builder} can't take on your inquiry about {product}.",
  "email.inquiryDeclined.reason": "Their note:",
  "email.inquiryDeclined.cta": "You can find other products and builders on VNX.SI:",
  "email.inquiryReminder.subject": "{client} is waiting for your reply",
  "email.inquiryReminder.body": "{client} sent you an inquiry about {product} three days ago and hasn't had a reply yet.",
  "email.inquiryReminder.cta": "Reply on VNX.SI:",
  "inquiry.profileTarget": "your services",
```

`vi.ts`:

```ts
  "inquiry.type.buy": "Mua",
  "inquiry.type.customize": "Tùy chỉnh",
  "inquiry.type.hire": "Thuê builder",
  "inquiry.type.build_similar": "Làm sản phẩm tương tự",
  "inquiry.type.request": "Yêu cầu",
  "inquiry.budget.lt500": "Dưới $500",
  "inquiry.budget.500-2k": "$500 – $2.000",
  "inquiry.budget.2k-10k": "$2.000 – $10.000",
  "inquiry.budget.gt10k": "Trên $10.000",
  "inquiry.budget.unsure": "Chưa rõ",
  "inquiry.status.pending_verification": "Chờ xác nhận email",
  "inquiry.status.open": "Đang mở",
  "inquiry.status.answered": "Đã trả lời",
  "inquiry.status.declined": "Bị từ chối",
  "inquiry.status.closed": "Đã đóng",
  "inquiry.status.removed": "Đã gỡ",
  "email.inquiryConfirm.subject": "Xác nhận yêu cầu của bạn trên VNX.SI",
  "email.inquiryConfirm.body": "Bạn đã gửi yêu cầu tới {builder} về {product}. Bấm link bên dưới để xác nhận email và gửi đi. Link dùng được một lần và hết hạn sau 15 phút.",
  "email.inquiryConfirm.ignore": "Nếu bạn không gửi yêu cầu này, hãy bỏ qua email; sẽ không có gì được gửi đi.",
  "email.newInquiry.subject": "Yêu cầu mới: {type} từ {client}",
  "email.newInquiry.intro": "{client} gửi bạn một yêu cầu ({type}) về {product}.",
  "email.newInquiry.budget": "Ngân sách: {budget}",
  "email.newInquiry.deadline": "Hạn chót: {deadline}",
  "email.newInquiry.cta": "Trả lời trên VNX.SI (trả lời bằng email sẽ không tới người gửi):",
  "email.inquiryMessage.subject": "Tin nhắn mới từ {from}",
  "email.inquiryMessage.intro": "{from} viết về {product}:",
  "email.inquiryMessage.cta": "Đọc và trả lời trên VNX.SI:",
  "email.inquiryDeclined.subject": "{builder} đã từ chối yêu cầu của bạn",
  "email.inquiryDeclined.intro": "{builder} không nhận được yêu cầu của bạn về {product}.",
  "email.inquiryDeclined.reason": "Ghi chú của họ:",
  "email.inquiryDeclined.cta": "Bạn có thể tìm sản phẩm và builder khác trên VNX.SI:",
  "email.inquiryReminder.subject": "{client} đang chờ bạn trả lời",
  "email.inquiryReminder.body": "{client} đã gửi bạn yêu cầu về {product} từ ba ngày trước và chưa nhận được trả lời.",
  "email.inquiryReminder.cta": "Trả lời trên VNX.SI:",
  "inquiry.profileTarget": "dịch vụ của bạn",
```

`zh-hans.ts`:

```ts
  "inquiry.type.buy": "购买",
  "inquiry.type.customize": "定制",
  "inquiry.type.hire": "雇用开发者",
  "inquiry.type.build_similar": "开发类似产品",
  "inquiry.type.request": "需求",
  "inquiry.budget.lt500": "500 美元以下",
  "inquiry.budget.500-2k": "500 – 2,000 美元",
  "inquiry.budget.2k-10k": "2,000 – 10,000 美元",
  "inquiry.budget.gt10k": "10,000 美元以上",
  "inquiry.budget.unsure": "尚未确定",
  "inquiry.status.pending_verification": "等待邮箱确认",
  "inquiry.status.open": "待回复",
  "inquiry.status.answered": "已回复",
  "inquiry.status.declined": "已婉拒",
  "inquiry.status.closed": "已关闭",
  "inquiry.status.removed": "已移除",
  "email.inquiryConfirm.subject": "请确认你在 VNX.SI 上的咨询",
  "email.inquiryConfirm.body": "你向 {builder} 咨询了 {product}。点击下方链接确认邮箱并发送。链接只能使用一次，15 分钟后失效。",
  "email.inquiryConfirm.ignore": "如果这不是你发送的，请忽略此邮件，咨询不会被发送。",
  "email.newInquiry.subject": "新咨询：{client} 的{type}",
  "email.newInquiry.intro": "{client} 就 {product} 向你发送了咨询（{type}）。",
  "email.newInquiry.budget": "预算：{budget}",
  "email.newInquiry.deadline": "截止日期：{deadline}",
  "email.newInquiry.cta": "请在 VNX.SI 上回复（通过邮件回复不会送达）：",
  "email.inquiryMessage.subject": "{from} 发来新消息",
  "email.inquiryMessage.intro": "{from} 就 {product} 写道：",
  "email.inquiryMessage.cta": "在 VNX.SI 上查看并回复：",
  "email.inquiryDeclined.subject": "{builder} 婉拒了你的咨询",
  "email.inquiryDeclined.intro": "{builder} 无法接受你关于 {product} 的咨询。",
  "email.inquiryDeclined.reason": "对方的说明：",
  "email.inquiryDeclined.cta": "你可以在 VNX.SI 上寻找其他产品和开发者：",
  "email.inquiryReminder.subject": "{client} 正在等待你的回复",
  "email.inquiryReminder.body": "{client} 三天前就 {product} 向你发送了咨询，目前还没有收到回复。",
  "email.inquiryReminder.cta": "在 VNX.SI 上回复：",
  "inquiry.profileTarget": "你的服务",
```

`zh-hant.ts`:

```ts
  "inquiry.type.buy": "購買",
  "inquiry.type.customize": "客製化",
  "inquiry.type.hire": "聘請開發者",
  "inquiry.type.build_similar": "開發類似產品",
  "inquiry.type.request": "需求",
  "inquiry.budget.lt500": "500 美元以下",
  "inquiry.budget.500-2k": "500 – 2,000 美元",
  "inquiry.budget.2k-10k": "2,000 – 10,000 美元",
  "inquiry.budget.gt10k": "10,000 美元以上",
  "inquiry.budget.unsure": "尚未確定",
  "inquiry.status.pending_verification": "等待電子郵件確認",
  "inquiry.status.open": "待回覆",
  "inquiry.status.answered": "已回覆",
  "inquiry.status.declined": "已婉拒",
  "inquiry.status.closed": "已關閉",
  "inquiry.status.removed": "已移除",
  "email.inquiryConfirm.subject": "請確認你在 VNX.SI 上的詢問",
  "email.inquiryConfirm.body": "你向 {builder} 詢問了 {product}。點擊下方連結確認電子郵件並送出。連結只能使用一次，15 分鐘後失效。",
  "email.inquiryConfirm.ignore": "如果這不是你送出的，請忽略此郵件，詢問不會被送出。",
  "email.newInquiry.subject": "新詢問：{client} 的{type}",
  "email.newInquiry.intro": "{client} 就 {product} 向你送出了詢問（{type}）。",
  "email.newInquiry.budget": "預算：{budget}",
  "email.newInquiry.deadline": "截止日期：{deadline}",
  "email.newInquiry.cta": "請在 VNX.SI 上回覆（透過郵件回覆不會送達）：",
  "email.inquiryMessage.subject": "{from} 傳來新訊息",
  "email.inquiryMessage.intro": "{from} 就 {product} 寫道：",
  "email.inquiryMessage.cta": "在 VNX.SI 上查看並回覆：",
  "email.inquiryDeclined.subject": "{builder} 婉拒了你的詢問",
  "email.inquiryDeclined.intro": "{builder} 無法接受你關於 {product} 的詢問。",
  "email.inquiryDeclined.reason": "對方的說明：",
  "email.inquiryDeclined.cta": "你可以在 VNX.SI 上尋找其他產品和開發者：",
  "email.inquiryReminder.subject": "{client} 正在等待你的回覆",
  "email.inquiryReminder.body": "{client} 三天前就 {product} 向你送出了詢問，目前還沒有收到回覆。",
  "email.inquiryReminder.cta": "在 VNX.SI 上回覆：",
  "inquiry.profileTarget": "你的服務",
```

- [ ] **Step 2: Nhãn**

Cuối `apps/web/src/views/labels.ts` (import type `BudgetBand`, `InquiryStatus`, `InquiryType` từ `../domain/inquiry.ts`):

```ts
export const INQUIRY_TYPE_KEY: Record<InquiryType, MessageKey> = {
  buy: "inquiry.type.buy",
  customize: "inquiry.type.customize",
  hire: "inquiry.type.hire",
  build_similar: "inquiry.type.build_similar",
  request: "inquiry.type.request",
};

export const BUDGET_KEY: Record<BudgetBand, MessageKey> = {
  "<500": "inquiry.budget.lt500",
  "500-2k": "inquiry.budget.500-2k",
  "2k-10k": "inquiry.budget.2k-10k",
  ">10k": "inquiry.budget.gt10k",
  unsure: "inquiry.budget.unsure",
};

export const INQUIRY_STATUS_KEY: Record<InquiryStatus, MessageKey> = {
  pending_verification: "inquiry.status.pending_verification",
  open: "inquiry.status.open",
  answered: "inquiry.status.answered",
  declined: "inquiry.status.declined",
  closed: "inquiry.status.closed",
  removed: "inquiry.status.removed",
};
```

Ghi chú: `email/` theo ARCHITECTURE chỉ import `i18n`. Template cần nhãn loại / ngân sách nên **không** import `views/labels.ts`; template tự giữ một bảng key nhỏ (xem Step 4). Hai bảng phải khớp; test ở Step 3 kiểm điều đó.

- [ ] **Step 3: Test template (fail)**

`apps/web/test/email/inquiry-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  inquiryAdminAlertEmail,
  inquiryConfirmEmail,
  inquiryDeclinedEmail,
  inquiryMessageEmail,
  inquiryReminderEmail,
  newInquiryEmail,
} from "../../src/email/templates/inquiry.ts";

describe("inquiry e-mail templates (spec §8.3)", () => {
  it("asks the client to confirm, in their locale", () => {
    const mail = inquiryConfirmEmail("vi", { builderName: "Lan", productName: "Spa Booking", link: "https://vnx.si/auth/verify?t=abc" });
    expect(mail.subject).toBe("Xác nhận yêu cầu của bạn trên VNX.SI");
    expect(mail.text).toContain("Lan");
    expect(mail.text).toContain("https://vnx.si/auth/verify?t=abc");
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc"');
  });

  it("tells the builder about a new inquiry with type, budget, deadline and the message", () => {
    const mail = newInquiryEmail("en", {
      clientName: "Minh",
      type: "customize",
      productName: "Spa Booking",
      budgetBand: "2k-10k",
      deadline: "2026-12-01",
      message: "Line one\nLine <two>",
      url: "https://vnx.si/hub/inquiries/01J",
    });
    expect(mail.subject).toBe("New inquiry: Customize from Minh");
    for (const text of ["Minh sent you an inquiry (Customize) about Spa Booking.", "Budget: $2,000 – $10,000", "Deadline: 2026-12-01", "Line <two>", "https://vnx.si/hub/inquiries/01J"]) {
      expect(mail.text, text).toContain(text);
    }
    expect(mail.html).toContain("Line &lt;two&gt;");
    expect(mail.html).not.toContain("<two>");
  });

  it("names the builder's services when there is no product, and omits an empty deadline", () => {
    const mail = newInquiryEmail("en", { clientName: "Minh", type: "hire", productName: null, budgetBand: "unsure", deadline: null, message: "Hello there, need help.", url: "https://vnx.si/x" });
    expect(mail.text).toContain("about your services.");
    expect(mail.text).not.toContain("Deadline");
  });

  it("escapes names and bodies in every template", () => {
    const evil = '<img src=x onerror="a()">';
    const mails = [
      inquiryMessageEmail("en", { fromName: evil, productName: evil, body: evil, url: "https://vnx.si/x" }),
      inquiryDeclinedEmail("en", { builderName: evil, productName: evil, reason: evil, url: "https://vnx.si/x" }),
      inquiryReminderEmail("en", { clientName: evil, productName: evil, url: "https://vnx.si/x" }),
      inquiryAdminAlertEmail([{ id: "01J", builderHandle: evil, productName: evil, openedAt: "2026-09-20T00:00:00.000Z" }], "https://vnx.si/admin/inquiries"),
    ];
    for (const mail of mails) {
      expect(mail.html).not.toContain("<img");
      expect(mail.html).toContain("&lt;img");
    }
  });

  it("leaves the reason out of a decline without one", () => {
    const mail = inquiryDeclinedEmail("zh-Hant", { builderName: "Lan", productName: "Spa", reason: "", url: "https://vnx.si/zh-hant/products" });
    expect(mail.subject).toBe("Lan 婉拒了你的詢問");
    expect(mail.text).not.toContain("對方的說明");
  });

  it("lists overdue inquiries for the admins in English", () => {
    const mail = inquiryAdminAlertEmail(
      [
        { id: "01A", builderHandle: "lan", productName: "Spa", openedAt: "2026-09-20T08:00:00.000Z" },
        { id: "01B", builderHandle: "binh", productName: null, openedAt: "2026-09-21T08:00:00.000Z" },
      ],
      "https://vnx.si/admin/inquiries?status=open",
    );
    expect(mail.subject).toBe("2 inquiries unanswered for 7 days");
    expect(mail.text).toContain("01A · @lan · Spa · opened 2026-09-20");
    expect(mail.text).toContain("01B · @binh · (builder profile) · opened 2026-09-21");
  });
});
```

Run → FAIL (module chưa có).

- [ ] **Step 4: `email/templates/inquiry.ts`**

```ts
import type { BudgetBand, InquiryType } from "../../domain/inquiry.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

// Same keys as views/labels.ts (email/ may only import i18n; see ARCHITECTURE §2).
const TYPE_KEY: Record<InquiryType, MessageKey> = {
  buy: "inquiry.type.buy",
  customize: "inquiry.type.customize",
  hire: "inquiry.type.hire",
  build_similar: "inquiry.type.build_similar",
  request: "inquiry.type.request",
};
const BUDGET_KEY: Record<BudgetBand, MessageKey> = {
  "<500": "inquiry.budget.lt500",
  "500-2k": "inquiry.budget.500-2k",
  "2k-10k": "inquiry.budget.2k-10k",
  ">10k": "inquiry.budget.gt10k",
  unsure: "inquiry.budget.unsure",
};

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
const wrap = (locale: string, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;

function target(locale: Locale, productName: string | null): string {
  return productName ?? translator(locale)("inquiry.profileTarget");
}

export function inquiryConfirmEmail(locale: Locale, input: { builderName: string; productName: string | null; link: string }): Email {
  const tr = translator(locale);
  const body = tr("email.inquiryConfirm.body", { builder: input.builderName, product: target(locale, input.productName) });
  const ignore = tr("email.inquiryConfirm.ignore");
  return { subject: tr("email.inquiryConfirm.subject"), text: `${body}\n\n${input.link}\n\n${ignore}`, html: wrap(locale, [p(body), link(input.link), p(ignore)]) };
}

export function newInquiryEmail(
  locale: Locale,
  input: { clientName: string; type: InquiryType; productName: string | null; budgetBand: BudgetBand; deadline: string | null; message: string; url: string },
): Email {
  const tr = translator(locale);
  const type = tr(TYPE_KEY[input.type]);
  const intro = tr("email.newInquiry.intro", { client: input.clientName, type, product: target(locale, input.productName) });
  const facts = [tr("email.newInquiry.budget", { budget: tr(BUDGET_KEY[input.budgetBand]) }), ...(input.deadline ? [tr("email.newInquiry.deadline", { deadline: input.deadline })] : [])];
  const cta = tr("email.newInquiry.cta");
  return {
    subject: tr("email.newInquiry.subject", { type, client: input.clientName }),
    text: `${intro}\n${facts.join("\n")}\n\n${input.message}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...facts.map(p), quote(input.message), p(cta), link(input.url)]),
  };
}

export function inquiryMessageEmail(locale: Locale, input: { fromName: string; productName: string | null; body: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.inquiryMessage.intro", { from: input.fromName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryMessage.cta");
  return {
    subject: tr("email.inquiryMessage.subject", { from: input.fromName }),
    text: `${intro}\n\n${input.body}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), quote(input.body), p(cta), link(input.url)]),
  };
}

export function inquiryDeclinedEmail(locale: Locale, input: { builderName: string; productName: string | null; reason: string; url: string }): Email {
  const tr = translator(locale);
  const intro = tr("email.inquiryDeclined.intro", { builder: input.builderName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryDeclined.cta");
  const reasonText = input.reason ? `\n\n${tr("email.inquiryDeclined.reason")}\n${input.reason}` : "";
  const reasonHtml = input.reason ? [p(tr("email.inquiryDeclined.reason")), quote(input.reason)] : [];
  return {
    subject: tr("email.inquiryDeclined.subject", { builder: input.builderName }),
    text: `${intro}${reasonText}\n\n${cta}\n${input.url}`,
    html: wrap(locale, [p(intro), ...reasonHtml, p(cta), link(input.url)]),
  };
}

export function inquiryReminderEmail(locale: Locale, input: { clientName: string; productName: string | null; url: string }): Email {
  const tr = translator(locale);
  const body = tr("email.inquiryReminder.body", { client: input.clientName, product: target(locale, input.productName) });
  const cta = tr("email.inquiryReminder.cta");
  return { subject: tr("email.inquiryReminder.subject", { client: input.clientName }), text: `${body}\n\n${cta}\n${input.url}`, html: wrap(locale, [p(body), p(cta), link(input.url)]) };
}

/** Internal digest for ADMIN_EMAILS (plan M5: English only). */
export function inquiryAdminAlertEmail(items: { id: string; builderHandle: string; productName: string | null; openedAt: string }[], url: string): Email {
  const lines = items.map((i) => `${i.id} · @${i.builderHandle} · ${i.productName ?? "(builder profile)"} · opened ${i.openedAt.slice(0, 10)}`);
  const intro = `These inquiries have had no reply for 7 days:`;
  return {
    subject: `${items.length} ${items.length === 1 ? "inquiry" : "inquiries"} unanswered for 7 days`,
    text: `${intro}\n\n${lines.join("\n")}\n\n${url}`,
    html: wrap("en", [p(intro), `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`, link(url)]),
  };
}
```

Thêm một test vào `apps/web/test/email/inquiry-templates.test.ts` để hai bảng nhãn không lệch nhau:

```ts
import { BUDGET_KEY, INQUIRY_TYPE_KEY } from "../../src/views/labels.ts";
import { en } from "../../src/i18n/messages/en.ts";

it("uses the same labels as the pages", () => {
  const mail = newInquiryEmail("en", { clientName: "A", type: "build_similar", productName: "P", budgetBand: ">10k", deadline: null, message: "x".repeat(20), url: "https://vnx.si/x" });
  expect(mail.text).toContain(en[INQUIRY_TYPE_KEY.build_similar]);
  expect(mail.text).toContain(en[BUDGET_KEY[">10k"]]);
});
```

(đặt trong `describe` ở trên; hai import đưa lên đầu file.)

- [ ] **Step 5: Test notify (fail)**

`apps/web/test/notify/inquiry.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { addMessageStatement, listMessages, setInquiryStatusStatement } from "../../src/db/inquiries.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { notifyInquiryMessage } from "../../src/notify/inquiry.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-04T10:00:00.000Z");
const failingEnv = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;

async function reply(inquiryId: string, senderUserId: string, from: "open" | "answered", to: "open" | "answered" | "declined", body: string, kind: "message" | "decline" = "message") {
  const now = new Date(Date.now() + Math.floor(Math.random() * 1000)).toISOString();
  const [, inserted] = await testEnv.DB.batch([
    setInquiryStatusStatement(testEnv.DB, { id: inquiryId, from, to, now }),
    addMessageStatement(testEnv.DB, { inquiryId, senderUserId, kind, body, now }, { inquiryId, status: to, updatedAt: now }),
  ]);
  return (inserted?.results[0] as { id: string }).id;
}

describe("notifyInquiryMessage (spec §8.3)", () => {
  beforeEach(() => clearOutbox());

  it("sends the builder a new-inquiry e-mail in the builder's locale, without the client's address", async () => {
    const { firstMessageId, inquiry, client } = await makeInquiry({ tag: "nt-new", status: "open", builderLocale: "vi" });
    expect(await notifyInquiryMessage(testEnv, firstMessageId, NOW)).toBe("sent");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "nt-new-b@vnx.si", subject: "Yêu cầu mới: Mua từ Minh Tran" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/hub/inquiries/${inquiry.id}`);
    expect(outbox[0]!.text).toContain(inquiry.message);
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
    expect((await listMessages(testEnv.DB, inquiry.id))[0]?.notifiedAt).toBe(NOW.toISOString());
  });

  it("sends each later message to the other party, with a link to their side", async () => {
    const { inquiry, client, builder } = await makeInquiry({ tag: "nt-msg", status: "open" });
    const fromBuilder = await reply(inquiry.id, builder.userId, "open", "answered", "Happy to help.");
    expect(await notifyInquiryMessage(testEnv, fromBuilder, NOW)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "New message from nt-msg builder" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/me/inquiries/${inquiry.id}`);

    const fromClient = await reply(inquiry.id, client.id, "answered", "answered", "Great, thanks!");
    expect(await notifyInquiryMessage(testEnv, fromClient, NOW)).toBe("sent");
    expect(outbox[1]).toMatchObject({ to: "nt-msg-b@vnx.si", subject: "New message from Minh Tran" });
    expect(outbox[1]!.text + outbox[1]!.html).not.toContain(client.email);
  });

  it("tells the client about a decline, with the optional reason", async () => {
    const { inquiry, builder, client } = await makeInquiry({ tag: "nt-dec", status: "open", clientLocale: "zh-Hans" });
    const id = await reply(inquiry.id, builder.userId, "open", "declined", "Fully booked this month.", "decline");
    expect(await notifyInquiryMessage(testEnv, id, NOW)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "nt-dec builder 婉拒了你的咨询" });
    expect(outbox[0]!.text).toContain("Fully booked this month.");
    expect(outbox[0]!.text).toContain("https://vnx.si/zh-hans/products");
  });

  it("does nothing for a message already sent, or on an unconfirmed or removed inquiry", async () => {
    const sent = await makeInquiry({ tag: "nt-skip1", status: "open" });
    await notifyInquiryMessage(testEnv, sent.firstMessageId, NOW);
    expect(await notifyInquiryMessage(testEnv, sent.firstMessageId, NOW)).toBe("skipped");
    const pending = await makeInquiry({ tag: "nt-skip2", status: "pending_verification" });
    expect(await notifyInquiryMessage(testEnv, pending.firstMessageId, NOW)).toBe("skipped");
    const removed = await makeInquiry({ tag: "nt-skip3", status: "removed" });
    expect(await notifyInquiryMessage(testEnv, removed.firstMessageId, NOW)).toBe("skipped");
    expect(await notifyInquiryMessage(testEnv, "01NOTAREALMESSAGEID0000000", NOW)).toBe("skipped");
    expect(outbox).toHaveLength(1);
  });

  it("counts failures and records an audit row on the third", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "nt-fail", status: "open" });
    for (let i = 0; i < 3; i++) expect(await notifyInquiryMessage(failingEnv, firstMessageId, NOW)).toBe("failed");
    const [message] = await listMessages(testEnv.DB, inquiry.id);
    expect(message).toMatchObject({ notifiedAt: null, notifyAttempts: 3 });
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'inquiry.notify_failed' AND entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect(await notifyInquiryMessage(failingEnv, firstMessageId, NOW)).toBe("skipped");
  });
});
```

Run → FAIL (module chưa có).

- [ ] **Step 6: `notify/inquiry.ts`**

```ts
import { writeAudit } from "../db/audit.ts";
import { findMessageContext, markMessageNotified, recordNotifyFailure, type MessageContext } from "../db/inquiries.ts";
import { MAX_NOTIFY_ATTEMPTS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryDeclinedEmail, inquiryMessageEmail, newInquiryEmail } from "../email/templates/inquiry.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath, type Locale } from "../i18n/locales.ts";

const asLocale = (value: string): Locale => (isLocale(value) ? value : "en");

/** Absolute link to the inquiry page on the recipient's side: the builder's Hub or the client's /me. */
export function inquiryUrl(env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, inquiryId: string, side: "builder" | "client"): string {
  const path = side === "builder" ? `/hub/inquiries/${inquiryId}` : `/me/inquiries/${inquiryId}`;
  return new URL(localizedPath(locale, path), env.APP_ORIGIN).toString();
}

function compose(env: Bindings, ctx: MessageContext): { to: string; subject: string; text: string; html: string } {
  const { message, summary } = ctx;
  const inquiry = summary.inquiry;
  const toBuilder = message.senderUserId === inquiry.clientUserId;
  if (toBuilder) {
    const locale = asLocale(ctx.builder.locale);
    const url = inquiryUrl(env, locale, inquiry.id, "builder");
    // The builder sees the client's typed name only, never the e-mail (spec §5.6).
    const mail = ctx.isFirst
      ? newInquiryEmail(locale, { clientName: inquiry.clientName, type: inquiry.type, productName: summary.productName, budgetBand: inquiry.budgetBand, deadline: inquiry.deadline, message: message.body, url })
      : inquiryMessageEmail(locale, { fromName: inquiry.clientName, productName: summary.productName, body: message.body, url });
    return { to: ctx.builder.email, ...mail };
  }
  const locale = asLocale(ctx.client.locale);
  if (message.kind === "decline") {
    const url = new URL(localizedPath(locale, "/products"), env.APP_ORIGIN).toString();
    return { to: ctx.client.email, ...inquiryDeclinedEmail(locale, { builderName: summary.builderName, productName: summary.productName, reason: message.body, url }) };
  }
  const url = inquiryUrl(env, locale, inquiry.id, "client");
  return { to: ctx.client.email, ...inquiryMessageEmail(locale, { fromName: summary.builderName, productName: summary.productName, body: message.body, url }) };
}

/**
 * Sends the e-mail for one inquiry message to the other party (spec §8.3). A failure is counted and left for the daily
 * job to retry; the third failure is written to audit_log. Never throws.
 */
export async function notifyInquiryMessage(env: Bindings, messageId: string, now: Date): Promise<"sent" | "failed" | "skipped"> {
  const ctx = await findMessageContext(env.DB, messageId);
  if (!ctx) return "skipped";
  const status = ctx.summary.inquiry.status;
  if (ctx.message.notifiedAt !== null || ctx.message.notifyAttempts >= MAX_NOTIFY_ATTEMPTS || status === "pending_verification" || status === "removed") return "skipped";
  try {
    await getMailer(env).send(compose(env, ctx));
  } catch (err) {
    const attempts = await recordNotifyFailure(env.DB, messageId);
    console.error(JSON.stringify({ event: "inquiry.notify_failed", messageId, attempts, error: String(err) }));
    if (attempts >= MAX_NOTIFY_ATTEMPTS) {
      await writeAudit(env.DB, { actorUserId: null, action: "inquiry.notify_failed", entity: "inquiry", entityId: ctx.summary.inquiry.id, data: { messageId }, now: now.toISOString() });
    }
    return "failed";
  }
  await markMessageNotified(env.DB, messageId, now.toISOString());
  return "sent";
}
```

- [ ] **Step 7: Chạy test, commit**

Run: `npm test -w apps/web -- test/email/inquiry-templates.test.ts test/notify/inquiry.test.ts test/i18n` → PASS.
Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/email/templates/inquiry.ts apps/web/src/notify/inquiry.ts apps/web/src/views/labels.ts apps/web/src/i18n/messages apps/web/test/email/inquiry-templates.test.ts apps/web/test/notify/inquiry.test.ts
git commit -m "feat(web): inquiry notification e-mails with retry bookkeeping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: VNX-0506 — Trang trung gian `/auth/verify`

**Files:**
- Modify: `apps/web/src/auth/tokens.ts` (`peekLoginToken`; `consumeLoginToken` nhận một hoặc nhiều mục đích)
- Modify: `apps/web/src/routes/auth.tsx` (GET hiển thị trang, POST tiêu token), `apps/web/src/views/auth.tsx` (`ConfirmLinkPage`), 4 file i18n
- Modify: `apps/web/test/helpers.ts` (`followMagicLink`), các test đang GET `/auth/verify`: `test/auth/login-flow.test.ts`, `test/auth/invite-flow.test.ts`, `test/auth/admin-sync.test.ts`, `test/admin/invites.test.ts`, `test/admin/suspend.test.ts`
- Test: `apps/web/test/auth/verify-page.test.ts`, `apps/web/test/auth/tokens.test.ts` (thêm)

**Interfaces:**
- Consumes: `createLoginToken`, `consumeLoginToken`, `safeNext`, `InvalidLinkPage`, `formPost`.
- Produces:
  - `auth/tokens.ts`: `peekLoginToken(db, raw, now, purposes: readonly TokenPurpose[]): Promise<{ ok: true; purpose: TokenPurpose; locale: Locale } | { ok: false; reason: "invalid" | "expired" | "used" }>`; `consumeLoginToken(db, raw, now, expected: TokenPurpose | readonly TokenPurpose[])` (giữ tương thích với chỗ gọi cũ).
  - `routes/auth.tsx`: hằng `VERIFY_PURPOSES: TokenPurpose[]` (Task 3: `["login"]`; Task 4 thêm `"inquiry_verify"`); hàm nội bộ `completeLogin(c, token, now)` để Task 4 dùng lại.
  - `test/helpers.ts`: `followMagicLink(app, link, env?): Promise<Response>` (GET trang rồi bấm nút POST).

- [ ] **Step 1: Key i18n**

Thêm cuối 4 file locale:

`en.ts`:

```ts
  "auth.confirm.login.title": "Finish signing in",
  "auth.confirm.login.body": "Press the button to sign in to VNX.SI on this device.",
  "auth.confirm.login.submit": "Sign in",
  "auth.confirm.inquiry.title": "Confirm your inquiry",
  "auth.confirm.inquiry.body": "Press the button to confirm your e-mail and send your inquiry to the builder.",
  "auth.confirm.inquiry.submit": "Confirm and send",
```

`vi.ts`:

```ts
  "auth.confirm.login.title": "Hoàn tất đăng nhập",
  "auth.confirm.login.body": "Bấm nút bên dưới để đăng nhập VNX.SI trên thiết bị này.",
  "auth.confirm.login.submit": "Đăng nhập",
  "auth.confirm.inquiry.title": "Xác nhận yêu cầu",
  "auth.confirm.inquiry.body": "Bấm nút bên dưới để xác nhận email và gửi yêu cầu tới builder.",
  "auth.confirm.inquiry.submit": "Xác nhận và gửi",
```

`zh-hans.ts`:

```ts
  "auth.confirm.login.title": "完成登录",
  "auth.confirm.login.body": "点击下方按钮，在此设备上登录 VNX.SI。",
  "auth.confirm.login.submit": "登录",
  "auth.confirm.inquiry.title": "确认你的咨询",
  "auth.confirm.inquiry.body": "点击下方按钮确认邮箱，并把咨询发送给开发者。",
  "auth.confirm.inquiry.submit": "确认并发送",
```

`zh-hant.ts`:

```ts
  "auth.confirm.login.title": "完成登入",
  "auth.confirm.login.body": "點擊下方按鈕，在此裝置上登入 VNX.SI。",
  "auth.confirm.login.submit": "登入",
  "auth.confirm.inquiry.title": "確認你的詢問",
  "auth.confirm.inquiry.body": "點擊下方按鈕確認電子郵件，並把詢問送給開發者。",
  "auth.confirm.inquiry.submit": "確認並送出",
```

- [ ] **Step 2: Test (fail)**

Thêm vào cuối `apps/web/test/auth/tokens.test.ts` (import `peekLoginToken`):

```ts
describe("peekLoginToken / consumeLoginToken with several purposes", () => {
  it("peeks without spending the token, then consumes any allowed purpose once", async () => {
    const now = new Date("2026-10-04T10:00:00.000Z");
    const raw = await createLoginToken(testEnv.DB, { email: "peek@vnx.si", purpose: "inquiry_verify", locale: "vi" }, now);
    for (let i = 0; i < 3; i++) expect(await peekLoginToken(testEnv.DB, raw, now, ["login", "inquiry_verify"])).toEqual({ ok: true, purpose: "inquiry_verify", locale: "vi" });
    expect(await peekLoginToken(testEnv.DB, raw, now, ["login"])).toEqual({ ok: false, reason: "invalid" });
    expect((await consumeLoginToken(testEnv.DB, raw, now, ["login", "inquiry_verify"])).ok).toBe(true);
    expect(await peekLoginToken(testEnv.DB, raw, now, ["login", "inquiry_verify"])).toEqual({ ok: false, reason: "used" });
    expect(await consumeLoginToken(testEnv.DB, raw, now, ["login", "inquiry_verify"])).toEqual({ ok: false, reason: "used" });
  });

  it("reports expired and malformed tokens", async () => {
    const then = new Date("2026-10-04T10:00:00.000Z");
    const raw = await createLoginToken(testEnv.DB, { email: "peek2@vnx.si", purpose: "login", locale: "en" }, then);
    expect(await peekLoginToken(testEnv.DB, raw, new Date(then.getTime() + 16 * 60 * 1000), ["login"])).toEqual({ ok: false, reason: "expired" });
    expect(await peekLoginToken(testEnv.DB, "short", then, ["login"])).toEqual({ ok: false, reason: "invalid" });
  });
});
```

(Nếu file chưa import `testEnv`, `createLoginToken`, `consumeLoginToken`, `describe`, `expect`, `it` thì thêm; đọc phần đầu file trước.)

`apps/web/test/auth/verify-page.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

function linkFrom(text: string): string {
  const m = /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text);
  if (!m) throw new Error("no link in email");
  return m[0];
}

describe("/auth/verify confirmation page (VNX-0506)", () => {
  beforeEach(() => clearOutbox());

  it("shows a button on GET and never spends the token, however often a scanner opens it", async () => {
    const app = createApp();
    await app.request(formPost("/vi/login", { email: "scan@vnx.si", next: "/hub" }), undefined, testEnv);
    const url = new URL(linkFrom(outbox[0]!.text));
    for (let i = 0; i < 3; i++) {
      const res = await app.request(getReq(url.pathname + url.search), undefined, testEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("set-cookie")).toBeNull();
      const html = await res.text();
      expect(html).toContain("Hoàn tất đăng nhập");
      expect(html).toContain('<form method="post" action="/auth/verify">');
      expect(html).toContain(`name="t" value="${url.searchParams.get("t")}"`);
      expect(html).toContain('name="next" value="/hub"');
      expect(html).toContain('<meta name="robots" content="noindex"');
    }
    const post = await app.request(formPost("/auth/verify", { t: url.searchParams.get("t")!, next: "/hub" }), undefined, testEnv);
    expect(post.status).toBe(303);
    expect(post.headers.get("location")).toBe("/hub");
    expect(post.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);

    const again = await app.request(formPost("/auth/verify", { t: url.searchParams.get("t")! }), undefined, testEnv);
    expect(again.status).toBe(400);
    const reopened = await app.request(getReq(url.pathname + url.search), undefined, testEnv);
    expect(reopened.status).toBe(400);
  });

  it("refuses a POST without a same-origin Origin header", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "csrf@vnx.si" }), undefined, testEnv);
    const t = new URL(linkFrom(outbox[0]!.text)).searchParams.get("t")!;
    const res = await app.request(formPost("/auth/verify", { t }, { origin: "https://evil.example" }), undefined, testEnv);
    expect(res.status).toBe(403);
    // The token is still good.
    expect((await app.request(formPost("/auth/verify", { t }), undefined, testEnv)).status).toBe(303);
  });

  it("shows the invalid-link page for unknown tokens on GET and POST", async () => {
    const app = createApp();
    expect((await app.request(getReq("/auth/verify?t=nope"), undefined, testEnv)).status).toBe(400);
    expect((await app.request(formPost("/auth/verify", { t: "x".repeat(43) }), undefined, testEnv)).status).toBe(400);
  });
});
```

Run: `npm test -w apps/web -- test/auth/verify-page.test.ts test/auth/tokens.test.ts` → FAIL.

- [ ] **Step 3: `auth/tokens.ts`**

Thay `consumeLoginToken` và thêm `peekLoginToken`:

```ts
const purposeList = (expected: TokenPurpose | readonly TokenPurpose[]) => JSON.stringify(typeof expected === "string" ? [expected] : expected);

/**
 * Spends the token if it is unused, unexpired and of one of the expected purposes. A token of another purpose is
 * neither used nor spent.
 */
export async function consumeLoginToken(db: D1Database, raw: string, now: Date, expected: TokenPurpose | readonly TokenPurpose[]): Promise<ConsumeResult> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const iso = now.toISOString();
  const purposes = purposeList(expected);
  // Single atomic statement: concurrent clicks cannot both succeed.
  const row = await db
    .prepare(
      `UPDATE login_tokens SET used_at = ?2
       WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND purpose IN (SELECT value FROM json_each(?3))
       RETURNING email, purpose, locale, inquiry_id, request_id, invite_code_hash`,
    )
    .bind(hash, iso, purposes)
    .first<Row>();
  if (row) {
    return {
      ok: true,
      token: {
        email: row.email,
        purpose: row.purpose,
        locale: isLocale(row.locale) ? row.locale : "en",
        inquiryId: row.inquiry_id,
        requestId: row.request_id,
        inviteCodeHash: row.invite_code_hash,
      },
    };
  }
  return { ok: false, reason: await failureReason(db, hash, purposes) };
}

async function failureReason(db: D1Database, hash: string, purposes: string): Promise<"invalid" | "used" | "expired"> {
  const existing = await db
    .prepare("SELECT used_at FROM login_tokens WHERE token_hash = ?1 AND purpose IN (SELECT value FROM json_each(?2))")
    .bind(hash, purposes)
    .first<{ used_at: string | null }>();
  if (!existing) return "invalid";
  return existing.used_at ? "used" : "expired";
}

/** Reads a token without spending it (the GET confirmation page, VNX-0506). */
export async function peekLoginToken(
  db: D1Database,
  raw: string,
  now: Date,
  purposes: readonly TokenPurpose[],
): Promise<{ ok: true; purpose: TokenPurpose; locale: Locale } | { ok: false; reason: "invalid" | "expired" | "used" }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return { ok: false, reason: "invalid" };
  const hash = await sha256Hex(raw);
  const list = JSON.stringify(purposes);
  const row = await db
    .prepare("SELECT purpose, locale FROM login_tokens WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND purpose IN (SELECT value FROM json_each(?3))")
    .bind(hash, now.toISOString(), list)
    .first<{ purpose: TokenPurpose; locale: string }>();
  if (row) return { ok: true, purpose: row.purpose, locale: isLocale(row.locale) ? row.locale : "en" };
  return { ok: false, reason: await failureReason(db, hash, list) };
}
```

- [ ] **Step 4: `ConfirmLinkPage`**

Thêm vào `apps/web/src/views/auth.tsx`:

```tsx
/** VNX-0506: opening the e-mail link shows this page; only its button spends the token. */
export const ConfirmLinkPage: FC<Base & { token: string; next: string | null; purpose: "login" | "inquiry" }> = (props) => {
  const tr = translator(props.locale);
  const key = props.purpose === "login" ? "login" : "inquiry";
  return (
    <Layout locale={props.locale} title={tr(`auth.confirm.${key}.title`)} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr(`auth.confirm.${key}.title`)}</h1>
        <p>{tr(`auth.confirm.${key}.body`)}</p>
        <form method="post" action="/auth/verify">
          <input type="hidden" name="t" value={props.token} />
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <button class="btn" type="submit">
            {tr(`auth.confirm.${key}.submit`)}
          </button>
        </form>
      </section>
    </Layout>
  );
};
```

(Nếu `tr` không nhận key ghép bằng template string, khai báo `const KEYS = { login: { title: "auth.confirm.login.title", … }, inquiry: { … } } as const` và dùng nó.)

- [ ] **Step 5: Route `/auth/verify`**

Trong `apps/web/src/routes/auth.tsx`: thay toàn bộ `app.get("/auth/verify", …)` bằng:

```tsx
/** Purposes the confirmation link accepts. Task 4 (VNX-0502) adds "inquiry_verify". */
export const VERIFY_PURPOSES: TokenPurpose[] = ["login"];

/** Signs the token's e-mail in (creating the account the first time) and sets the session cookie. Null when suspended. */
async function completeLogin(c: Context<AppEnv>, token: ConsumedToken, now: Date): Promise<UserRow | null> {
  const iso = now.toISOString();
  const user = (await findUserByEmail(c.env.DB, token.email)) ?? (await createUser(c.env.DB, { email: token.email, locale: token.locale, now: iso }));
  if (user.status !== "active") return null;
  await markLogin(c.env.DB, user.id, { now: iso, isAdmin: adminEmails(c.env).has(token.email) });
  await writeAudit(c.env.DB, { actorUserId: user.id, action: "auth.login", entity: "user", entityId: user.id, data: { purpose: token.purpose }, now: iso });
  writeSessionCookie(c, await createSession(c.env.DB, user.id, now));
  // The link may be opened on another device: restore the invite there (spec §5.3).
  if (token.inviteCodeHash) writeInviteCookie(c, token.inviteCodeHash);
  return user;
}
```

và trong `registerAuthRoutes`:

```tsx
  // VNX-0506: link scanners in corporate mail open links with GET; only the button (POST) spends the token.
  app.get("/auth/verify", async (c) => {
    c.header("Cache-Control", "no-store");
    const raw = c.req.query("t") ?? "";
    const peek = await peekLoginToken(c.env.DB, raw, new Date(), VERIFY_PURPOSES);
    if (!peek.ok) return page(c, <InvalidLinkPage locale="en" origin={origin(c)} />, 400);
    const purpose = peek.purpose === "login" ? "login" : "inquiry";
    return page(c, <ConfirmLinkPage locale={peek.locale} origin={origin(c)} token={raw} next={safeNext(c.req.query("next"))} purpose={purpose} />);
  });

  app.post("/auth/verify", async (c) => {
    c.header("Cache-Control", "no-store");
    const form = await c.req.parseBody();
    const now = new Date();
    const result = await consumeLoginToken(c.env.DB, typeof form.t === "string" ? form.t : "", now, VERIFY_PURPOSES);
    if (!result.ok) return page(c, <InvalidLinkPage locale="en" origin={origin(c)} />, 400);
    const user = await completeLogin(c, result.token, now);
    if (!user) return errorResponse(c, "forbidden", 403);
    return c.redirect(safeNext(form.next) ?? "/", 303);
  });
```

Import thêm `peekLoginToken`, `type ConsumedToken`, `type TokenPurpose` từ `../auth/tokens.ts`, `type UserRow` từ `../db/users.ts`, `ConfirmLinkPage` từ `../views/auth.tsx`. Email đăng nhập giữ nguyên link `/auth/verify?t=…&next=…` (`test/email/login-template.test.ts` không đổi).

- [ ] **Step 6: Helper test và sửa test cũ**

Cuối `apps/web/test/helpers.ts`:

```ts
type RequestApp = { request: (input: Request, init: undefined, env: unknown) => Response | Promise<Response> };

/** Opens a magic link the way a person does (VNX-0506): GET the confirmation page, then press its button. */
export async function followMagicLink(app: RequestApp, link: string, env: unknown = testEnv): Promise<Response> {
  const url = new URL(link, "https://vnx.si");
  const shown = await app.request(new Request(url.toString()), undefined, env);
  if (shown.status !== 200) return shown;
  const fields: Record<string, string> = { t: url.searchParams.get("t") ?? "" };
  const next = url.searchParams.get("next");
  if (next) fields.next = next;
  return app.request(formPost("/auth/verify", fields), undefined, env);
}
```

Ở 5 file test đang GET `/auth/verify` (`test/auth/login-flow.test.ts`, `test/auth/invite-flow.test.ts`, `test/auth/admin-sync.test.ts`, `test/admin/invites.test.ts`, `test/admin/suspend.test.ts`): thay mỗi `app.request(<url /auth/verify?t=…>, …, env)` bằng `followMagicLink(app, <cùng url>, env)` (với `app()` thì truyền `app()`). Giữ nguyên mọi `expect` về status, `location`, cookie. Riêng test "refuses a reused link" của login-flow: lần thứ hai `followMagicLink` trả trang GET 400 — assertion `again.status === 400` và chữ "This sign-in link no longer works" vẫn đúng. Riêng test "follows a safe next and ignores an unsafe one": `next` không an toàn bị `safeNext` bỏ ở GET nên không vào form; kết quả cuối vẫn là `location: "/"`.

Run: `npm test -w apps/web -- test/auth test/admin` → PASS.

- [ ] **Step 7: Chạy toàn bộ, commit**

Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/auth/tokens.ts apps/web/src/routes/auth.tsx apps/web/src/views/auth.tsx apps/web/src/i18n/messages apps/web/test/helpers.ts apps/web/test/auth apps/web/test/admin/invites.test.ts apps/web/test/admin/suspend.test.ts
git commit -m "feat(web): confirmation page for magic links so scanners cannot spend them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: VNX-0502 — Form Inquiry, Turnstile, xác nhận email

**Files:**
- Create: `apps/web/src/http/turnstile.ts`, `apps/web/src/routes/inquiry-form.tsx`, `apps/web/src/views/InquiryFormPage.tsx`
- Modify: `apps/web/src/env.ts` (`TURNSTILE_SITE_KEY?`, `TURNSTILE_DRIVER?`), `apps/web/vitest.config.ts` (`TURNSTILE_DRIVER: "fake"`), `apps/web/test/env.d.ts`, `apps/web/wrangler.jsonc` (var `TURNSTILE_SITE_KEY` + comment), `apps/web/src/routes/auth.tsx` (nhánh `inquiry_verify`), `apps/web/src/app.ts`, `apps/web/src/views/ProductPage.tsx` (4 nút), `apps/web/src/views/BuilderProfilePage.tsx` (nút Hire), `apps/web/public/assets/app.css`, 4 file i18n
- Test: `apps/web/test/http/turnstile.test.ts`, `apps/web/test/public/inquiry-form.test.ts`

**Interfaces:**
- Consumes: Task 1 (`parseInquiryForm`, `inquiryValuesFromBody`, `isHoneypotFilled`, `PRODUCT_INQUIRY_TYPES`, `INQUIRY_HOURLY_LIMIT_PER_IP`, `createInquiry`, `deletePendingInquiryStatements`, `findInquiryById`, `setInquiryStatusStatement`, `returnedInquiry`, `auditStatement` với `InquiryGuard`, `setDisplayNameIfEmpty`), Task 2 (`notifyInquiryMessage`, `inquiryConfirmEmail`, `INQUIRY_TYPE_KEY`, `BUDGET_KEY`), Task 3 (`VERIFY_PURPOSES`, `completeLogin`, `followMagicLink`), `findPublicProductBySlug`, `findPublicBuilderByHandle`, `hitRateLimit`, `createLoginToken`, `findUserByEmail`, `createUser`, `listMessages`.
- Produces: `verifyTurnstile(env, token, ip)`, `turnstileSiteKey(env)`, `TURNSTILE_FIELD`, `FAKE_TURNSTILE_PASS`; `registerInquiryFormRoutes(app)`; URL form: `/p/:slug/inquiry/:type`, `/b/:handle/hire`.

- [ ] **Step 1: Cấu hình**

- `apps/web/src/env.ts`, trong `Bindings`: thêm `TURNSTILE_SITE_KEY?: string;` và `TURNSTILE_DRIVER?: string;` (cạnh `TURNSTILE_SECRET?`).
- `apps/web/vitest.config.ts`, trong `miniflare.bindings`: thêm `TURNSTILE_DRIVER: "fake",`.
- `apps/web/test/env.d.ts`: thêm `TURNSTILE_DRIVER: string;`.
- `apps/web/wrangler.jsonc`, trong `vars`: thêm

```jsonc
    // Turnstile site key (public). Owner creates the widget for vnx.si (VNX-0507); empty = signed-out inquiries are
    // refused (fail closed). The secret goes in: wrangler secret put TURNSTILE_SECRET
    "TURNSTILE_SITE_KEY": ""
```

- [ ] **Step 2: Test Turnstile (fail)**

`apps/web/test/http/turnstile.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, turnstileSiteKey, verifyTurnstile } from "../../src/http/turnstile.ts";
import { testEnv } from "../helpers.ts";

const real = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET: "secret" } as Bindings;

describe("Turnstile (spec §8.2; fail closed, Owner 2026-10-04)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the fake driver in tests", async () => {
    expect(turnstileSiteKey(testEnv)).toBe("fake-site-key");
    expect(await verifyTurnstile(testEnv, FAKE_TURNSTILE_PASS, null)).toBe("pass");
    expect(await verifyTurnstile(testEnv, "nope", null)).toBe("fail");
  });

  it("is unavailable without both keys", async () => {
    const noSecret = { ...real, TURNSTILE_SECRET: undefined } as Bindings;
    const noSite = { ...real, TURNSTILE_SITE_KEY: "" } as Bindings;
    expect(turnstileSiteKey(noSecret)).toBeNull();
    expect(turnstileSiteKey(noSite)).toBeNull();
    expect(await verifyTurnstile(noSecret, "tok", null)).toBe("unavailable");
    expect(await verifyTurnstile(noSite, "tok", null)).toBe("unavailable");
  });

  it("asks siteverify and reads success", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile(real, "tok", "203.0.113.9")).toBe("pass");
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("fails on a rejected or missing token and is unavailable when the service errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstile(real, "tok", null)).toBe("fail");
    expect(await verifyTurnstile(real, "", null)).toBe("fail");
    expect(await verifyTurnstile(real, ["a"], null)).toBe("fail");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
    expect(await verifyTurnstile(real, "tok", null)).toBe("unavailable");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await verifyTurnstile(real, "tok", null)).toBe("unavailable");
  });
});
```

- [ ] **Step 3: `http/turnstile.ts`**

```ts
import type { Bindings } from "../env.ts";

export const TURNSTILE_FIELD = "cf-turnstile-response";
/** Token the fake driver accepts (tests only). */
export const FAKE_TURNSTILE_PASS = "test-pass";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileEnv = Pick<Bindings, "TURNSTILE_DRIVER" | "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET">;

/** The site key to render, or null when Turnstile is not fully configured (the signed-out form then fails closed). */
export function turnstileSiteKey(env: TurnstileEnv): string | null {
  if (env.TURNSTILE_DRIVER === "fake") return "fake-site-key";
  const site = env.TURNSTILE_SITE_KEY?.trim();
  return site && env.TURNSTILE_SECRET?.trim() ? site : null;
}

/** "unavailable" = not configured or the service could not answer; callers refuse the form (Owner 2026-10-04). */
export async function verifyTurnstile(env: TurnstileEnv, token: unknown, ip: string | null): Promise<"pass" | "fail" | "unavailable"> {
  if (env.TURNSTILE_DRIVER === "fake") return token === FAKE_TURNSTILE_PASS ? "pass" : "fail";
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret || !env.TURNSTILE_SITE_KEY?.trim()) return "unavailable";
  if (typeof token !== "string" || token === "" || token.length > 2048) return "fail";
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? "pass" : "fail";
  } catch {
    return "unavailable";
  }
}
```

Run: `npm test -w apps/web -- test/http/turnstile.test.ts` → PASS.

- [ ] **Step 4: Key i18n**

`en.ts`:

```ts
  "inquiry.form.title": "{type}: {target}",
  "inquiry.form.intro": "Your message goes to {builder} through VNX.SI. They see your name, never your e-mail.",
  "inquiry.form.message": "Message",
  "inquiry.form.messageHint": "20–2000 characters. Describe what you need; add contact details yourself if you want to share them.",
  "inquiry.form.budget": "Budget",
  "inquiry.form.deadline": "Deadline (optional)",
  "inquiry.form.name": "Your name",
  "inquiry.form.email": "Your e-mail",
  "inquiry.form.emailHint": "We send a confirmation link. Nothing is sent to the builder until you confirm.",
  "inquiry.form.website": "Leave this field empty",
  "inquiry.form.submit": "Send inquiry",
  "inquiry.form.unavailable": "Sending without an account is temporarily unavailable. Sign in to send your inquiry.",
  "inquiry.error.required": "This field is required.",
  "inquiry.error.too_short": "Please write at least 20 characters.",
  "inquiry.error.too_long": "This is too long.",
  "inquiry.error.choice": "Choose one of the options.",
  "inquiry.error.date": "Pick a date from today up to 5 years ahead.",
  "inquiry.error.email": "That e-mail address doesn't look right.",
  "inquiry.error.invalid": "This contains characters that aren't allowed.",
  "inquiry.error.captcha": "Please complete the check below and try again.",
  "inquiry.error.self": "You can't send an inquiry to yourself.",
  "inquiry.error.rateLimited": "Too many inquiries from your network. Please wait an hour and try again.",
  "inquiry.error.sendFailed": "We couldn't send the confirmation e-mail. Please try again in a few minutes.",
  "inquiry.sent.title": "Check your inbox",
  "inquiry.sent.body": "We sent a confirmation link to {email}. Your inquiry goes to the builder once you confirm. The link expires in 15 minutes.",
  "productPage.ask": "Talk to the builder",
  "bprofile.hire": "Hire {name}",
```

`vi.ts`:

```ts
  "inquiry.form.title": "{type}: {target}",
  "inquiry.form.intro": "Tin nhắn của bạn được gửi tới {builder} qua VNX.SI. Builder thấy tên bạn, không bao giờ thấy email.",
  "inquiry.form.message": "Nội dung",
  "inquiry.form.messageHint": "20–2000 ký tự. Mô tả điều bạn cần; nếu muốn chia sẻ thông tin liên hệ, hãy tự ghi vào.",
  "inquiry.form.budget": "Ngân sách",
  "inquiry.form.deadline": "Hạn chót (tùy chọn)",
  "inquiry.form.name": "Tên của bạn",
  "inquiry.form.email": "Email của bạn",
  "inquiry.form.emailHint": "Chúng tôi gửi link xác nhận. Builder chưa nhận được gì cho tới khi bạn xác nhận.",
  "inquiry.form.website": "Để trống ô này",
  "inquiry.form.submit": "Gửi yêu cầu",
  "inquiry.form.unavailable": "Tạm thời chưa gửi được khi chưa có tài khoản. Hãy đăng nhập để gửi yêu cầu.",
  "inquiry.error.required": "Ô này bắt buộc.",
  "inquiry.error.too_short": "Hãy viết ít nhất 20 ký tự.",
  "inquiry.error.too_long": "Nội dung quá dài.",
  "inquiry.error.choice": "Hãy chọn một mục.",
  "inquiry.error.date": "Chọn ngày từ hôm nay tới tối đa 5 năm sau.",
  "inquiry.error.email": "Địa chỉ email chưa đúng.",
  "inquiry.error.invalid": "Có ký tự không được phép.",
  "inquiry.error.captcha": "Hãy hoàn thành bước kiểm tra bên dưới rồi thử lại.",
  "inquiry.error.self": "Bạn không thể gửi yêu cầu cho chính mình.",
  "inquiry.error.rateLimited": "Mạng của bạn đã gửi quá nhiều yêu cầu. Hãy chờ một giờ rồi thử lại.",
  "inquiry.error.sendFailed": "Chưa gửi được email xác nhận. Hãy thử lại sau vài phút.",
  "inquiry.sent.title": "Kiểm tra hộp thư",
  "inquiry.sent.body": "Chúng tôi đã gửi link xác nhận tới {email}. Yêu cầu chỉ tới builder sau khi bạn xác nhận. Link hết hạn sau 15 phút.",
  "productPage.ask": "Liên hệ builder",
  "bprofile.hire": "Thuê {name}",
```

`zh-hans.ts`:

```ts
  "inquiry.form.title": "{type}：{target}",
  "inquiry.form.intro": "你的消息会通过 VNX.SI 发送给 {builder}。对方只能看到你的名字，看不到你的邮箱。",
  "inquiry.form.message": "内容",
  "inquiry.form.messageHint": "20–2000 个字符。说明你的需求；如需分享联系方式，请自行填写。",
  "inquiry.form.budget": "预算",
  "inquiry.form.deadline": "截止日期（可选）",
  "inquiry.form.name": "你的名字",
  "inquiry.form.email": "你的邮箱",
  "inquiry.form.emailHint": "我们会发送确认链接。在你确认之前，开发者不会收到任何内容。",
  "inquiry.form.website": "请勿填写此项",
  "inquiry.form.submit": "发送咨询",
  "inquiry.form.unavailable": "暂时无法在未登录状态下发送。请登录后发送咨询。",
  "inquiry.error.required": "此项为必填。",
  "inquiry.error.too_short": "请至少写 20 个字符。",
  "inquiry.error.too_long": "内容过长。",
  "inquiry.error.choice": "请选择一个选项。",
  "inquiry.error.date": "请选择从今天起 5 年内的日期。",
  "inquiry.error.email": "邮箱地址格式不正确。",
  "inquiry.error.invalid": "包含不允许的字符。",
  "inquiry.error.captcha": "请完成下方的验证后重试。",
  "inquiry.error.self": "你不能向自己发送咨询。",
  "inquiry.error.rateLimited": "你的网络发送的咨询过多，请一小时后再试。",
  "inquiry.error.sendFailed": "确认邮件发送失败，请几分钟后再试。",
  "inquiry.sent.title": "请查收邮件",
  "inquiry.sent.body": "我们已向 {email} 发送确认链接。确认后咨询才会送达开发者。链接 15 分钟后失效。",
  "productPage.ask": "联系开发者",
  "bprofile.hire": "雇用 {name}",
```

`zh-hant.ts`:

```ts
  "inquiry.form.title": "{type}：{target}",
  "inquiry.form.intro": "你的訊息會透過 VNX.SI 送給 {builder}。對方只看得到你的名字，看不到你的電子郵件。",
  "inquiry.form.message": "內容",
  "inquiry.form.messageHint": "20–2000 個字元。說明你的需求；如需分享聯絡方式，請自行填寫。",
  "inquiry.form.budget": "預算",
  "inquiry.form.deadline": "截止日期（選填）",
  "inquiry.form.name": "你的名字",
  "inquiry.form.email": "你的電子郵件",
  "inquiry.form.emailHint": "我們會寄出確認連結。在你確認之前，開發者不會收到任何內容。",
  "inquiry.form.website": "請勿填寫此欄",
  "inquiry.form.submit": "送出詢問",
  "inquiry.form.unavailable": "暫時無法在未登入狀態下送出。請登入後送出詢問。",
  "inquiry.error.required": "此欄為必填。",
  "inquiry.error.too_short": "請至少寫 20 個字元。",
  "inquiry.error.too_long": "內容過長。",
  "inquiry.error.choice": "請選擇一個選項。",
  "inquiry.error.date": "請選擇從今天起 5 年內的日期。",
  "inquiry.error.email": "電子郵件地址格式不正確。",
  "inquiry.error.invalid": "包含不允許的字元。",
  "inquiry.error.captcha": "請完成下方的驗證後重試。",
  "inquiry.error.self": "你不能向自己送出詢問。",
  "inquiry.error.rateLimited": "你的網路送出的詢問過多，請一小時後再試。",
  "inquiry.error.sendFailed": "確認郵件寄送失敗，請幾分鐘後再試。",
  "inquiry.sent.title": "請查收郵件",
  "inquiry.sent.body": "我們已向 {email} 寄出確認連結。確認後詢問才會送達開發者。連結 15 分鐘後失效。",
  "productPage.ask": "聯絡開發者",
  "bprofile.hire": "聘請 {name}",
```

- [ ] **Step 5: Test form (fail)**

`apps/web/test/public/inquiry-form.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listClientInquiries, listMessages } from "../../src/db/inquiries.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS } from "../../src/http/turnstile.ts";
import { makeBuilder, makeLiveProduct, signIn } from "../fixtures.ts";
import { followMagicLink, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, opts: { cookie?: string; ip?: string; env?: Bindings } = {}) =>
  app().request(formPost(path, fields, { ...(opts.cookie ? { cookie: opts.cookie } : {}), "cf-connecting-ip": opts.ip ?? `198.51.100.${Math.floor(Math.random() * 250)}` }), undefined, opts.env ?? testEnv);

const MESSAGE = "We run three salons and need online booking.";
const signedOut = (email: string) => ({ type: "buy", message: MESSAGE, budgetBand: "500-2k", deadline: "", name: "Minh Tran", email, website: "", "cf-turnstile-response": FAKE_TURNSTILE_PASS });
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];

describe("inquiry buttons (spec §5.2)", () => {
  it("shows Buy, Customize (only when customizable), Hire Builder and Build Similar on a product", async () => {
    const { product } = await makeLiveProduct("if-btn@vnx.si", "if-btn", "Btn Kit", { fields: { customizable: true, customizationNotes: "Colors" } });
    const html = await (await get(`/vi/p/${product.slug}`)).text();
    for (const type of ["buy", "customize", "hire", "build_similar"]) expect(html, type).toContain(`href="/vi/p/${product.slug}/inquiry/${type}"`);
    const { product: plain } = await makeLiveProduct("if-btn2@vnx.si", "if-btn2", "Plain Kit");
    expect(await (await get(`/p/${plain.slug}`)).text()).not.toContain("/inquiry/customize");
    expect((await get(`/p/${plain.slug}/inquiry/customize`)).status).toBe(404);
    expect((await get(`/p/${plain.slug}/inquiry/request`)).status).toBe(404);
  });

  it("shows Hire on a builder profile", async () => {
    await makeBuilder("if-hire@vnx.si", "if-hire", "approved");
    expect(await (await get("/b/if-hire")).text()).toContain('href="/b/if-hire/hire"');
    expect((await get("/b/if-hire/hire")).status).toBe(200);
  });

  it("404s for products and builders that are not public", async () => {
    await makeBuilder("if-pend@vnx.si", "if-pend", "pending");
    expect((await get("/b/if-pend/hire")).status).toBe(404);
    expect((await get("/p/no-such-product/inquiry/buy")).status).toBe(404);
  });
});

describe("inquiry form, signed in (spec §5.6 step 2)", () => {
  beforeEach(() => clearOutbox());

  it("opens the inquiry at once, notifies the builder and goes to /me", async () => {
    const { product } = await makeLiveProduct("if-in-b@vnx.si", "if-in", "Signed Kit");
    const { user, cookie } = await signIn("if-in-c@vnx.si");
    const form = await (await get(`/p/${product.slug}/inquiry/hire`, cookie)).text();
    expect(form).not.toContain('name="email"');
    expect(form).not.toContain("cf-turnstile");
    const res = await post(`/vi/p/${product.slug}/inquiry/hire`, { type: "hire", message: MESSAGE, budgetBand: "unsure", deadline: "", name: "Khanh", website: "" }, { cookie });
    expect(res.status).toBe(303);
    const [item] = await listClientInquiries(testEnv.DB, user.id);
    expect(item?.inquiry).toMatchObject({ status: "open", type: "hire", clientName: "Khanh", locale: "vi", productId: product.id });
    expect(res.headers.get("location")).toBe(`/vi/me/inquiries/${item!.inquiry.id}`);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe("if-in-b@vnx.si");
    expect(outbox[0]!.text).not.toContain("if-in-c@vnx.si");
  });

  it("prefills the account's display name", async () => {
    const { product } = await makeLiveProduct("if-pre-b@vnx.si", "if-pre", "Prefill Kit");
    const { user, cookie } = await signIn("if-pre-c@vnx.si");
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Thu Ha' WHERE id = ?1").bind(user.id).run();
    expect(await (await get(`/p/${product.slug}/inquiry/buy`, cookie)).text()).toContain('value="Thu Ha"');
  });

  it("refuses an inquiry to yourself", async () => {
    const { product } = await makeLiveProduct("if-self@vnx.si", "if-self", "Self Kit");
    const { cookie } = await signIn("if-self@vnx.si");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { type: "buy", message: MESSAGE, budgetBand: "unsure", name: "Me", website: "" }, { cookie });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("You can't send an inquiry to yourself.");
  });

  it("re-renders with per-field errors and the typed values", async () => {
    const { product } = await makeLiveProduct("if-err-b@vnx.si", "if-err", "Err Kit");
    const { cookie } = await signIn("if-err-c@vnx.si");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { type: "buy", message: "short <b>", budgetBand: "lots", deadline: "2000-01-01", name: "", website: "" }, { cookie });
    expect(res.status).toBe(400);
    const html = await res.text();
    for (const text of ["Please write at least 20 characters.", "Choose one of the options.", "Pick a date from today up to 5 years ahead.", "This field is required.", "short &lt;b&gt;"]) expect(html, text).toContain(text);
  });
});

describe("inquiry form, signed out (spec §5.6 step 3)", () => {
  beforeEach(() => clearOutbox());

  it("creates a pending inquiry, sends a confirmation, and opens it when the link is confirmed", async () => {
    const { product } = await makeLiveProduct("if-out-b@vnx.si", "if-out", "Out Kit");
    const form = await (await get(`/zh-hans/p/${product.slug}/inquiry/buy`)).text();
    expect(form).toContain('class="cf-turnstile" data-sitekey="fake-site-key"');
    expect(form).toContain('name="website"');

    const res = await post(`/zh-hans/p/${product.slug}/inquiry/buy`, signedOut(" New@Client.Example "));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("new@client.example");
    const user = (await findUserByEmail(testEnv.DB, "new@client.example"))!;
    expect(user).toMatchObject({ locale: "zh-Hans", last_login_at: null, display_name: null });
    const [pending] = await listClientInquiries(testEnv.DB, user.id);
    expect(pending?.inquiry.status).toBe("pending_verification");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "new@client.example", subject: "请确认你在 VNX.SI 上的咨询" });

    const done = await followMagicLink(app(), linkFrom(outbox[0]!.text));
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe(`/zh-hans/me/inquiries/${pending!.inquiry.id}`);
    expect(done.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);
    const [opened] = await listClientInquiries(testEnv.DB, user.id);
    expect(opened?.inquiry).toMatchObject({ status: "open" });
    expect(opened?.inquiry.openedAt).not.toBeNull();
    expect((await findUserByEmail(testEnv.DB, "new@client.example"))?.display_name).toBe("Minh Tran");
    expect(outbox).toHaveLength(2);
    expect(outbox[1]?.to).toBe("if-out-b@vnx.si");
    expect(outbox[1]!.text + outbox[1]!.html).not.toContain("new@client.example");
    const [first] = await listMessages(testEnv.DB, pending!.inquiry.id);
    expect(first?.notifiedAt).not.toBeNull();
  }, 30_000);

  it("shows the confirmation page with the inquiry wording", async () => {
    const { product } = await makeLiveProduct("if-page-b@vnx.si", "if-page", "Page Kit");
    await post(`/vi/p/${product.slug}/inquiry/buy`, signedOut("page@client.example"));
    const page = await app().request(new Request(linkFrom(outbox[0]!.text)), undefined, testEnv);
    expect(await page.text()).toContain("Xác nhận và gửi");
  });

  it("does not open an inquiry twice or one the admin removed meanwhile", async () => {
    const { product } = await makeLiveProduct("if-twice-b@vnx.si", "if-twice", "Twice Kit");
    await post(`/p/${product.slug}/inquiry/buy`, signedOut("twice@client.example"));
    const link = linkFrom(outbox[0]!.text);
    const user = (await findUserByEmail(testEnv.DB, "twice@client.example"))!;
    const [pending] = await listClientInquiries(testEnv.DB, user.id);
    await testEnv.DB.prepare("UPDATE inquiries SET status = 'removed' WHERE id = ?1").bind(pending!.inquiry.id).run();
    const done = await followMagicLink(app(), link);
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/me");
    expect(outbox).toHaveLength(1);
    expect((await followMagicLink(app(), link)).status).toBe(400);
  });

  it("rejects a missing or wrong Turnstile token and refuses when Turnstile is not configured", async () => {
    const { product } = await makeLiveProduct("if-cap-b@vnx.si", "if-cap", "Cap Kit");
    const wrong = await post(`/p/${product.slug}/inquiry/buy`, { ...signedOut("cap@client.example"), "cf-turnstile-response": "bad" });
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain("Please complete the check below and try again.");
    const unconfigured = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    const shown = await app().request(getReq(`/p/${product.slug}/inquiry/buy`), undefined, unconfigured);
    const html = await shown.text();
    expect(html).toContain("Sending without an account is temporarily unavailable.");
    expect(html).not.toContain('type="submit"');
    expect((await post(`/p/${product.slug}/inquiry/buy`, signedOut("cap@client.example"), { env: unconfigured })).status).toBe(503);
    expect(await findUserByEmail(testEnv.DB, "cap@client.example")).toBeNull();
    expect(outbox).toHaveLength(0);
  });

  it("silently drops a filled honeypot", async () => {
    const { product } = await makeLiveProduct("if-hp-b@vnx.si", "if-hp", "Hp Kit");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { ...signedOut("bot@client.example"), website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await findUserByEmail(testEnv.DB, "bot@client.example")).toBeNull();
    expect(outbox).toHaveLength(0);
  });

  it("answers a suspended account like any other and sends nothing", async () => {
    const { product } = await makeLiveProduct("if-susp-b@vnx.si", "if-susp", "Susp Kit");
    const { user } = await signIn("susp@client.example");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(user.id).run();
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("susp@client.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("susp@client.example");
    expect(await listClientInquiries(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toHaveLength(0);
  });

  it("refuses the builder's own e-mail", async () => {
    const { product } = await makeLiveProduct("if-own@vnx.si", "if-own", "Own Kit");
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("if-own@vnx.si"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("You can't send an inquiry to yourself.");
  });

  it("removes the pending inquiry when the confirmation cannot be sent", async () => {
    const { product } = await makeLiveProduct("if-mail-b@vnx.si", "if-mail", "Mail Kit");
    const noMail = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("mailfail@client.example"), { env: noMail });
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("We couldn't send the confirmation e-mail.");
    const user = (await findUserByEmail(testEnv.DB, "mailfail@client.example"))!;
    expect(await listClientInquiries(testEnv.DB, user.id)).toEqual([]);
  });

  it("allows 10 inquiries per hour per IP", async () => {
    const { product } = await makeLiveProduct("if-rl-b@vnx.si", "if-rl", "Rl Kit");
    const ip = "203.0.113.77";
    for (let i = 0; i < 10; i++) expect((await post(`/p/${product.slug}/inquiry/buy`, signedOut(`rl${i}@client.example`), { ip })).status, String(i)).toBe(200);
    const blocked = await post(`/p/${product.slug}/inquiry/buy`, signedOut("rl10@client.example"), { ip });
    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toContain("Too many inquiries from your network.");
  }, 30_000);
});
```

Run: `npm test -w apps/web -- test/public/inquiry-form.test.ts` → FAIL.

- [ ] **Step 6: `InquiryFormPage`**

`apps/web/src/views/InquiryFormPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { BUDGET_BANDS, type InquiryErrors, type InquiryFormValues, type InquiryType } from "../domain/inquiry.ts";
import { TURNSTILE_FIELD } from "../http/turnstile.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, INQUIRY_TYPE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";

export type InquiryTarget = { builderName: string; productName: string | null; action: string; rest: string };

type Props = {
  locale: Locale;
  origin: string;
  target: InquiryTarget;
  type: InquiryType;
  signedIn: boolean;
  values: InquiryFormValues;
  errors: InquiryErrors;
  /** null when signed out and Turnstile is not configured: the form is not offered (fail closed). */
  siteKey: string | null;
  formError?: string;
};

export const InquiryFormPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const typeLabel = tr(INQUIRY_TYPE_KEY[p.type]);
  const title = tr("inquiry.form.title", { type: typeLabel, target: p.target.productName ?? p.target.builderName });
  const err = (field: keyof InquiryErrors) =>
    p.errors[field] ? (
      <p id={`iq-${field}-error`} class="error-msg" role="alert">
        {tr(`inquiry.error.${p.errors[field]!}`)}
      </p>
    ) : null;
  const aria = (field: keyof InquiryErrors) => (p.errors[field] ? { "aria-invalid": "true", "aria-describedby": `iq-${field}-error` } : {});
  const blocked = !p.signedIn && p.siteKey === null;
  return (
    <Layout locale={p.locale} title={`${title} · VNX.SI`} origin={p.origin} rest={p.target.rest} noindex signedIn={p.signedIn}>
      <section class="card wide">
        <h1>{title}</h1>
        <p>{tr("inquiry.form.intro", { builder: p.target.builderName })}</p>
        {p.formError ? (
          <p class="error-msg" role="alert">
            {p.formError}
          </p>
        ) : null}
        {blocked ? (
          <p class="notice">
            {tr("inquiry.form.unavailable")} <a href={localizedPath(p.locale, `/login?next=${encodeURIComponent(localizedPath(p.locale, p.target.rest))}`)}>{tr("nav.signIn")}</a>
          </p>
        ) : (
          <form method="post" action={p.target.action}>
            <input type="hidden" name="type" value={p.type} />
            <div class="field">
              <label for="iq-message">{tr("inquiry.form.message")}</label>
              <textarea id="iq-message" name="message" required minlength={20} maxlength={2000} {...aria("message")}>
                {p.values.message}
              </textarea>
              <p class="hint">{tr("inquiry.form.messageHint")}</p>
              {err("message")}
            </div>
            <div class="field">
              <label for="iq-budget">{tr("inquiry.form.budget")}</label>
              <select id="iq-budget" name="budgetBand" required {...aria("budgetBand")}>
                {BUDGET_BANDS.map((b) => (
                  <option value={b} selected={b === p.values.budgetBand}>
                    {tr(BUDGET_KEY[b])}
                  </option>
                ))}
              </select>
              {err("budgetBand")}
            </div>
            <div class="field">
              <label for="iq-deadline">{tr("inquiry.form.deadline")}</label>
              <input id="iq-deadline" name="deadline" type="date" value={p.values.deadline} {...aria("deadline")} />
              {err("deadline")}
            </div>
            <div class="field">
              <label for="iq-name">{tr("inquiry.form.name")}</label>
              <input id="iq-name" name="name" required maxlength={80} autocomplete="name" value={p.values.name} {...aria("name")} />
              {err("name")}
            </div>
            {p.signedIn ? null : (
              <div class="field">
                <label for="iq-email">{tr("inquiry.form.email")}</label>
                <input id="iq-email" name="email" type="email" required autocomplete="email" value={p.values.email} {...aria("email")} />
                <p class="hint">{tr("inquiry.form.emailHint")}</p>
                {err("email")}
              </div>
            )}
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div class="hp" aria-hidden="true">
              <label for="iq-website">{tr("inquiry.form.website")}</label>
              <input id="iq-website" name="website" tabindex={-1} autocomplete="off" value="" />
            </div>
            {err("type")}
            {p.signedIn ? null : (
              <>
                <div class="cf-turnstile" data-sitekey={p.siteKey ?? ""} data-response-field-name={TURNSTILE_FIELD}></div>
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
              </>
            )}
            <button class="btn" type="submit">
              {tr("inquiry.form.submit")}
            </button>
          </form>
        )}
      </section>
    </Layout>
  );
};

export const InquirySentPage: FC<{ locale: Locale; origin: string; email: string; rest: string }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("inquiry.sent.title")} origin={p.origin} rest={p.rest} noindex>
      <section class="card" role="status">
        <h1>{tr("inquiry.sent.title")}</h1>
        <p>{tr("inquiry.sent.body", { email: p.email })}</p>
      </section>
    </Layout>
  );
};
```

(Nếu `tr` không nhận key ghép `inquiry.error.${…}`, dùng một bảng `ERROR_KEY: Record<InquiryFieldError, MessageKey>` trong file này.)

CSS, thêm cuối `apps/web/public/assets/app.css`:

```css
.hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.ask { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
```

- [ ] **Step 7: Route form**

`apps/web/src/routes/inquiry-form.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { createLoginToken } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { createInquiry, deletePendingInquiryStatements } from "../db/inquiries.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { createUser, findUserByEmail, findUserById } from "../db/users.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import {
  INQUIRY_HOURLY_LIMIT_PER_IP,
  inquiryValuesFromBody,
  isHoneypotFilled,
  parseInquiryForm,
  PRODUCT_INQUIRY_TYPES,
  type InquiryErrors,
  type InquiryFormValues,
  type InquiryType,
} from "../domain/inquiry.ts";
import { SLUG_RE } from "../domain/slug.ts";
import { getMailer } from "../email/index.ts";
import { inquiryConfirmEmail } from "../email/templates/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from "../http/turnstile.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryFormPage, InquirySentPage, type InquiryTarget } from "../views/InquiryFormPage.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;

type Resolved = InquiryTarget & { builderId: string; productId: string | null; allowed: readonly InquiryType[] };

/** The public product or builder the form is for, with the types it offers (spec §5.2); null = 404. */
async function resolveTarget(c: Context<AppEnv>): Promise<Resolved | null> {
  const locale = c.get("locale");
  const slug = c.req.param("slug");
  if (slug !== undefined) {
    if (!SLUG_RE.test(slug)) return null;
    const item = await findPublicProductBySlug(c.env.DB, slug);
    if (!item) return null;
    const allowed = PRODUCT_INQUIRY_TYPES.filter((t) => t !== "customize" || item.product.customizable);
    const rest = `/p/${slug}/inquiry/${c.req.param("type") ?? ""}`;
    return { builderName: item.builderName, productName: item.product.name, action: localizedPath(locale, rest), rest, builderId: item.product.builderId, productId: item.product.id, allowed };
  }
  const handle = c.req.param("handle") ?? "";
  if (!HANDLE_RE.test(handle)) return null;
  const builder = await findPublicBuilderByHandle(c.env.DB, handle);
  if (!builder) return null;
  const rest = `/b/${handle}/hire`;
  return { builderName: builder.name, productName: null, action: localizedPath(locale, rest), rest, builderId: builder.userId, productId: null, allowed: ["hire"] };
}

function requestedType(c: Context<AppEnv>, target: Resolved): InquiryType | null {
  const type = (c.req.param("type") ?? "hire") as InquiryType;
  return target.allowed.includes(type) ? type : null;
}

function emptyValues(type: InquiryType, name: string): InquiryFormValues {
  return { type, message: "", budgetBand: "unsure", deadline: "", name, email: "", website: "" };
}

function formPage(c: Context<AppEnv>, target: Resolved, type: InquiryType, values: InquiryFormValues, errors: InquiryErrors, status: 200 | 400 | 429 | 502 | 503 = 200, formError?: string) {
  return page(
    c,
    <InquiryFormPage locale={c.get("locale")} origin={siteOrigin(c)} target={target} type={type} signedIn={c.get("user") !== null} values={values} errors={errors} siteKey={turnstileSiteKey(c.env)} formError={formError} />,
    status,
  );
}

async function showForm(c: Context<AppEnv>) {
  const target = await resolveTarget(c);
  const type = target ? requestedType(c, target) : null;
  if (!target || !type) return errorResponse(c, "notFound", 404);
  const user = c.get("user");
  const name = user ? ((await findUserById(c.env.DB, user.id))?.display_name ?? "") : "";
  return formPage(c, target, type, emptyValues(type, name), {});
}

async function submitForm(c: Context<AppEnv>) {
  const target = await resolveTarget(c);
  const type = target ? requestedType(c, target) : null;
  if (!target || !type) return errorResponse(c, "notFound", 404);
  const locale = c.get("locale");
  const tr = translator(locale);
  const user = c.get("user");
  const body = await c.req.parseBody();
  const values = { ...inquiryValuesFromBody(body), type };
  const sentPage = (email: string) => page(c, <InquirySentPage locale={locale} origin={siteOrigin(c)} email={email} rest={target.rest} />);

  // Honeypot: look like success, create nothing.
  if (isHoneypotFilled(values)) return user ? c.redirect(localizedPath(locale, "/me"), 303) : sentPage(values.email.trim().toLowerCase());

  const now = new Date();
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const limit = await hitRateLimit(c.env.DB, `inquiry:ip:${ip}`, INQUIRY_HOURLY_LIMIT_PER_IP, HOUR, now.getTime());
  if (!limit.allowed) return formPage(c, target, type, values, {}, 429, tr("inquiry.error.rateLimited"));

  const parsed = parseInquiryForm(values, { allowedTypes: target.allowed, needEmail: user === null, today: now.toISOString().slice(0, 10) });
  if (!parsed.ok) return formPage(c, target, type, values, parsed.errors, 400);
  const input = parsed.input;
  const iso = now.toISOString();

  if (user) {
    if (user.id === target.builderId) return formPage(c, target, type, values, {}, 400, tr("inquiry.error.self"));
    const { inquiry, firstMessageId } = await createInquiry(c.env.DB, { clientUserId: user.id, clientName: input.name, builderId: target.builderId, productId: target.productId, type, message: input.message, budgetBand: input.budgetBand, deadline: input.deadline, status: "open", locale, now: iso });
    await writeAudit(c.env.DB, { actorUserId: user.id, action: "inquiry.create", entity: "inquiry", entityId: inquiry.id, data: { type, status: "open" }, now: iso });
    await notifyInquiryMessage(c.env, firstMessageId, now);
    return c.redirect(localizedPath(locale, `/me/inquiries/${inquiry.id}`), 303);
  }

  const captcha = await verifyTurnstile(c.env, body[TURNSTILE_FIELD], ip === "unknown" ? null : ip);
  if (captcha === "unavailable") return formPage(c, target, type, values, {}, 503, tr("inquiry.form.unavailable"));
  if (captcha === "fail") return formPage(c, target, type, values, {}, 400, tr("inquiry.error.captcha"));

  const email = input.email!;
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing?.id === target.builderId) return formPage(c, target, type, values, {}, 400, tr("inquiry.error.self"));
  // A suspended account gets the same answer as anyone else and nothing happens (no account status leak).
  if (existing && existing.status !== "active") return sentPage(email);
  // Spec §5.6: an implicit account; the daily job removes it if never confirmed (Owner 2026-10-04).
  const client = existing ?? (await createUser(c.env.DB, { email, locale, now: iso }));
  const { inquiry } = await createInquiry(c.env.DB, { clientUserId: client.id, clientName: input.name, builderId: target.builderId, productId: target.productId, type, message: input.message, budgetBand: input.budgetBand, deadline: input.deadline, status: "pending_verification", locale, now: iso });
  const token = await createLoginToken(c.env.DB, { email, purpose: "inquiry_verify", locale, inquiryId: inquiry.id }, now);
  const link = new URL("/auth/verify", c.env.APP_ORIGIN);
  link.searchParams.set("t", token);
  try {
    await getMailer(c.env).send({ to: email, ...inquiryConfirmEmail(locale, { builderName: target.builderName, productName: target.productName, link: link.toString() }) });
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "inquiry.confirm_mail_failed", emailHash: await sha256Hex(email), error: String(err) }));
    await c.env.DB.batch(deletePendingInquiryStatements(c.env.DB, inquiry.id));
    return formPage(c, target, type, values, {}, 502, tr("inquiry.error.sendFailed"));
  }
  await writeAudit(c.env.DB, { actorUserId: null, action: "inquiry.create", entity: "inquiry", entityId: inquiry.id, data: { type, status: "pending_verification" }, now: iso });
  return sentPage(email);
}

export function registerInquiryFormRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/p/:slug/inquiry/:type", showForm);
  onLocalized(app, "post", "/p/:slug/inquiry/:type", submitForm);
  onLocalized(app, "get", "/b/:handle/hire", showForm);
  onLocalized(app, "post", "/b/:handle/hire", submitForm);
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerInquiryFormRoutes(app);` ngay trước `registerProductPageRoutes(app);`.

Ghi chú: `findUserById` đã có ở `db/users.ts`. Log lỗi chỉ ghi hash email, không ghi email.

- [ ] **Step 8: Nhánh `inquiry_verify` ở `/auth/verify`**

Trong `apps/web/src/routes/auth.tsx`:
- `export const VERIFY_PURPOSES: TokenPurpose[] = ["login", "inquiry_verify"];`
- Trong `app.post("/auth/verify", …)`, ngay sau `if (!user) return errorResponse(c, "forbidden", 403);`:

```tsx
    if (result.token.purpose === "inquiry_verify") return c.redirect(await confirmInquiry(c, result.token, user, now), 303);
```

- Thêm hàm (cùng file, import `findInquiryById`, `setInquiryStatusStatement`, `returnedInquiry`, `listMessages` từ `../db/inquiries.ts`, `auditStatement` từ `../db/audit.ts`, `setDisplayNameIfEmpty` từ `../db/users.ts`, `notifyInquiryMessage` từ `../notify/inquiry.ts`, `localizedPath` từ `../i18n/locales.ts`):

```tsx
/**
 * Spec §5.6 step 3: confirming the e-mail opens the pending inquiry, names the account the first time and tells the
 * builder. Returns where to go: the inquiry, or /me when it is no longer pending (already opened, removed or expired).
 */
async function confirmInquiry(c: Context<AppEnv>, token: ConsumedToken, user: UserRow, now: Date): Promise<string> {
  const iso = now.toISOString();
  const inquiry = token.inquiryId ? await findInquiryById(c.env.DB, token.inquiryId) : null;
  if (!inquiry || inquiry.clientUserId !== user.id || inquiry.status !== "pending_verification") return localizedPath(token.locale, "/me");
  const guard = { inquiryId: inquiry.id, status: "open" as const, updatedAt: iso };
  const [moved] = await c.env.DB.batch([
    setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: "pending_verification", to: "open", now: iso }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "inquiry.verify", entity: "inquiry", entityId: inquiry.id, now: iso }, guard),
  ]);
  if (!returnedInquiry(moved)) return localizedPath(token.locale, "/me");
  await setDisplayNameIfEmpty(c.env.DB, user.id, inquiry.clientName, iso);
  const [first] = await listMessages(c.env.DB, inquiry.id);
  if (first) await notifyInquiryMessage(c.env, first.id, now);
  return localizedPath(token.locale, `/me/inquiries/${inquiry.id}`);
}
```

(Không cần gọi `transition` ở đây vì compare-and-set `pending_verification → open` chính là luật `verify` của hệ thống; thêm một dòng comment nói điều đó.)

- [ ] **Step 9: Nút trên trang product và builder**

`apps/web/src/views/ProductPage.tsx`: đổi comment đầu component thành `/** Spec §5.2. */`; ngay trước `<aside class="card">`, thêm (import `PRODUCT_INQUIRY_TYPES` từ `../domain/inquiry.ts`, `INQUIRY_TYPE_KEY` từ `./labels.ts`):

```tsx
        <section>
          <h2>{tr("productPage.ask")}</h2>
          <p class="ask">
            {PRODUCT_INQUIRY_TYPES.filter((t) => t !== "customize" || p.customizable).map((t, i) => (
              <a class={i === 0 ? "btn" : "btn secondary"} href={localizedPath(locale, `/p/${p.slug}/inquiry/${t}`)}>
                {tr(INQUIRY_TYPE_KEY[t])}
              </a>
            ))}
          </p>
        </section>
```

`apps/web/src/views/BuilderProfilePage.tsx`: đổi comment `/** The Hire button arrives with M5. */` thành `/** Spec §5.2 builder profile. */`; ngay sau `<p class="lead">{builder.headline}</p>`, thêm:

```tsx
          <p class="ask">
            <a class="btn" href={localizedPath(locale, `/b/${builder.handle}/hire`)}>
              {tr("bprofile.hire", { name: builder.name })}
            </a>
          </p>
```

CSS (cuối `app.css`): `.btn.secondary { background: var(--surface); color: var(--accent); border: 1px solid var(--accent); }`

- [ ] **Step 10: Chạy test, commit**

Run: `npm test -w apps/web -- test/public/inquiry-form.test.ts test/http/turnstile.test.ts test/public test/auth` → PASS.
Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/http/turnstile.ts apps/web/src/routes/inquiry-form.tsx apps/web/src/views/InquiryFormPage.tsx apps/web/src/env.ts apps/web/vitest.config.ts apps/web/test/env.d.ts apps/web/wrangler.jsonc apps/web/src/routes/auth.tsx apps/web/src/app.ts apps/web/src/views/ProductPage.tsx apps/web/src/views/BuilderProfilePage.tsx apps/web/public/assets/app.css apps/web/src/i18n/messages apps/web/test/http/turnstile.test.ts apps/web/test/public/inquiry-form.test.ts
git commit -m "feat(web): inquiry form with Turnstile, honeypot, rate limit and e-mail confirmation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: VNX-0503a — Hộp thư trong Hub

**Files:**
- Create: `apps/web/src/routes/hub-inquiries.tsx`, `apps/web/src/views/hub/InquiriesPage.tsx`, `apps/web/src/views/InquiryThread.tsx`, `apps/web/src/http/no-store.ts`
- Modify: `apps/web/src/views/hub/HubLayout.tsx` (mục "Inquiries"), `apps/web/src/views/hub/OverviewPage.tsx` + `apps/web/src/routes/hub.tsx` (số Inquiry `open`), `apps/web/src/app.ts`, `apps/web/public/assets/app.css`, 4 file i18n
- Test: `apps/web/test/hub/inquiries.test.ts`, `apps/web/test/http/no-store.test.ts`

**Interfaces:**
- Consumes: Task 1 (`listBuilderInquiries`, `findBuilderInquiry`, `listMessages`, `countOpenInquiries`, `setInquiryStatusStatement`, `addMessageStatement`, `returnedInquiry`, `transition`, `parseMessageBody`, `parseDeclineReason`, `REPLY_MAX`, `DECLINE_REASON_MAX`, `auditStatement`), Task 2 (`notifyInquiryMessage`, `INQUIRY_STATUS_KEY`, `INQUIRY_TYPE_KEY`, `BUDGET_KEY`), `requireBuilder`, `requestOrigin`, `PlainText`.
- Produces:
  - `views/InquiryThread.tsx`: `InquiryThread: FC<{ locale; summary: InquirySummary; messages: InquiryMessage[]; viewer: "builder" | "client"; base: string; replyError?: string; reasonError?: string; values?: { body?: string; reason?: string } }>` (dùng lại ở Task 6; `base` là đường dẫn đã có tiền tố locale của trang luồng, form POST tới `${base}/reply`, `${base}/decline`, `${base}/close`).
  - `routes/hub-inquiries.tsx`: `registerHubInquiryRoutes(app)`; hàm dùng chung `postInquiryAction(c, opts)` để Task 6 dùng lại cho `/me` (export).
  - `http/no-store.ts`: `noStorePrivate` middleware.

- [ ] **Step 1: Key i18n**

`en.ts`:

```ts
  "hub.nav.inquiries": "Inquiries",
  "hub.inquiries.open": "Open inquiries: {n}",
  "inbox.title": "Inquiries",
  "inbox.empty": "No inquiries yet.",
  "inbox.from": "From {name}",
  "inbox.to": "To {name}",
  "inbox.about": "About",
  "inbox.lastActivity": "Last activity",
  "thread.budget": "Budget",
  "thread.deadline": "Deadline",
  "thread.type": "Type",
  "thread.you": "You",
  "thread.declined": "{name} declined this inquiry.",
  "thread.reply": "Reply",
  "thread.replyHint": "Up to 4000 characters. The other side gets an e-mail with your message.",
  "thread.send": "Send",
  "thread.decline": "Decline",
  "thread.declineReason": "Reason (optional, the client sees it)",
  "thread.close": "Close inquiry",
  "thread.closed": "This inquiry is finished; no more messages can be sent.",
  "thread.error.required": "Write a message first.",
  "thread.error.too_long": "This is too long.",
```

`vi.ts`:

```ts
  "hub.nav.inquiries": "Yêu cầu",
  "hub.inquiries.open": "Yêu cầu đang mở: {n}",
  "inbox.title": "Yêu cầu",
  "inbox.empty": "Chưa có yêu cầu nào.",
  "inbox.from": "Từ {name}",
  "inbox.to": "Gửi {name}",
  "inbox.about": "Về",
  "inbox.lastActivity": "Hoạt động gần nhất",
  "thread.budget": "Ngân sách",
  "thread.deadline": "Hạn chót",
  "thread.type": "Loại",
  "thread.you": "Bạn",
  "thread.declined": "{name} đã từ chối yêu cầu này.",
  "thread.reply": "Trả lời",
  "thread.replyHint": "Tối đa 4000 ký tự. Bên kia nhận email kèm nội dung tin nhắn.",
  "thread.send": "Gửi",
  "thread.decline": "Từ chối",
  "thread.declineReason": "Lý do (tùy chọn, client sẽ thấy)",
  "thread.close": "Đóng yêu cầu",
  "thread.closed": "Yêu cầu này đã kết thúc; không gửi thêm tin được.",
  "thread.error.required": "Hãy viết nội dung trước.",
  "thread.error.too_long": "Nội dung quá dài.",
```

`zh-hans.ts`:

```ts
  "hub.nav.inquiries": "咨询",
  "hub.inquiries.open": "待回复咨询：{n}",
  "inbox.title": "咨询",
  "inbox.empty": "还没有咨询。",
  "inbox.from": "来自 {name}",
  "inbox.to": "发给 {name}",
  "inbox.about": "关于",
  "inbox.lastActivity": "最近活动",
  "thread.budget": "预算",
  "thread.deadline": "截止日期",
  "thread.type": "类型",
  "thread.you": "你",
  "thread.declined": "{name} 婉拒了此咨询。",
  "thread.reply": "回复",
  "thread.replyHint": "最多 4000 个字符。对方会收到包含你消息的邮件。",
  "thread.send": "发送",
  "thread.decline": "婉拒",
  "thread.declineReason": "原因（可选，客户可以看到）",
  "thread.close": "关闭咨询",
  "thread.closed": "此咨询已结束，无法再发送消息。",
  "thread.error.required": "请先填写内容。",
  "thread.error.too_long": "内容过长。",
```

`zh-hant.ts`:

```ts
  "hub.nav.inquiries": "詢問",
  "hub.inquiries.open": "待回覆詢問：{n}",
  "inbox.title": "詢問",
  "inbox.empty": "還沒有詢問。",
  "inbox.from": "來自 {name}",
  "inbox.to": "送給 {name}",
  "inbox.about": "關於",
  "inbox.lastActivity": "最近活動",
  "thread.budget": "預算",
  "thread.deadline": "截止日期",
  "thread.type": "類型",
  "thread.you": "你",
  "thread.declined": "{name} 婉拒了此詢問。",
  "thread.reply": "回覆",
  "thread.replyHint": "最多 4000 個字元。對方會收到包含你訊息的郵件。",
  "thread.send": "送出",
  "thread.decline": "婉拒",
  "thread.declineReason": "原因（選填，客戶看得到）",
  "thread.close": "關閉詢問",
  "thread.closed": "此詢問已結束，無法再傳送訊息。",
  "thread.error.required": "請先填寫內容。",
  "thread.error.too_long": "內容過長。",
```

- [ ] **Step 2: Test (fail)**

`apps/web/test/http/no-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

describe("Cache-Control: no-store on private pages", () => {
  it("marks Hub, /me and admin pages in every locale, and leaves public pages alone", async () => {
    await makeBuilder("ns-b@vnx.si", "ns-b", "approved");
    const builder = await signIn("ns-b@vnx.si");
    const admin = await signIn("owner@vnx.si", { admin: true });
    const app = createApp();
    for (const [path, cookie] of [["/hub", builder.cookie], ["/vi/hub/inquiries", builder.cookie], ["/zh-hant/admin/builders", admin.cookie], ["/me", builder.cookie]] as const) {
      const res = await app.request(getReq(path, cookie), undefined, testEnv);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
    }
    // Redirects to /login from private paths are marked too.
    expect((await app.request(getReq("/hub"), undefined, testEnv)).headers.get("cache-control")).toBe("no-store");
    expect((await app.request(getReq("/products"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
    expect((await app.request(getReq("/hubris"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
  });
});
```

(`/me` chưa có tới Task 6; ở Task 5 nó trả 404 qua `app.notFound`. Middleware vẫn phải đặt header cho đường dẫn đó; test kiểm header, không kiểm status.)

`apps/web/test/hub/inquiries.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, cookie: string) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("Hub inbox (spec §5.3)", () => {
  beforeEach(() => clearOutbox());

  it("lists the builder's inquiries with the client's name but never their e-mail", async () => {
    const { builder, client, inquiry } = await makeInquiry({ tag: "hi-list", status: "open" });
    const { cookie } = await signIn(`hi-list-b@vnx.si`);
    const list = await (await get("/hub/inquiries", cookie)).text();
    expect(list).toContain("From Minh Tran");
    expect(list).toContain("hi-list product");
    expect(list).toContain(`href="/hub/inquiries/${inquiry.id}"`);
    expect(list).toContain("Open");
    const thread = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    for (const text of ["Minh Tran", inquiry.message, "$500 – $2,000", "Buy"]) expect(thread, text).toContain(text);
    expect(list + thread).not.toContain(client.email);
    expect(builder.userId).toBeTruthy();
  });

  it("shows the open count on the overview and an Inquiries tab", async () => {
    await makeInquiry({ tag: "hi-count", status: "open" });
    const { cookie } = await signIn("hi-count-b@vnx.si");
    const html = await (await get("/hub", cookie)).text();
    expect(html).toContain("Open inquiries: 1");
    expect(html).toContain('href="/hub/inquiries"');
  });

  it("hides pending, removed and other builders' inquiries", async () => {
    const pending = await makeInquiry({ tag: "hi-hide1", status: "pending_verification" });
    const removed = await makeInquiry({ tag: "hi-hide2", status: "removed" });
    const other = await makeInquiry({ tag: "hi-hide3", status: "open" });
    const { cookie } = await signIn("hi-hide1-b@vnx.si");
    expect((await get(`/hub/inquiries/${pending.inquiry.id}`, cookie)).status).toBe(404);
    expect((await get(`/hub/inquiries/${other.inquiry.id}`, cookie)).status).toBe(404);
    expect((await post(`/hub/inquiries/${other.inquiry.id}/reply`, { body: "Hi" }, cookie)).status).toBe(404);
    const removedCookie = (await signIn("hi-hide2-b@vnx.si")).cookie;
    expect((await get(`/hub/inquiries/${removed.inquiry.id}`, removedCookie)).status).toBe(404);
    expect(await (await get("/hub/inquiries", cookie)).text()).toContain("No inquiries yet.");
  });

  it("replies: open becomes answered, the client gets an e-mail", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "hi-reply", status: "open" });
    const { cookie } = await signIn("hi-reply-b@vnx.si");
    const res = await post(`/vi/hub/inquiries/${inquiry.id}/reply`, { body: "Yes, we can do it.\r\nNext week?" }, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/hub/inquiries/${inquiry.id}`);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("answered");
    expect((await listMessages(testEnv.DB, inquiry.id)).at(-1)?.body).toBe("Yes, we can do it.\nNext week?");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(client.email);
  });

  it("re-renders an empty or too long reply with an error", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-rerr", status: "open" });
    const { cookie } = await signIn("hi-rerr-b@vnx.si");
    const empty = await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "  " }, cookie);
    expect(empty.status).toBe(400);
    expect(await empty.text()).toContain("Write a message first.");
    const long = await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "x".repeat(4001) }, cookie);
    expect(long.status).toBe(400);
    expect(outbox).toHaveLength(0);
  });

  it("declines with an optional reason the client sees, and only while open", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-dec", status: "open" });
    const { cookie } = await signIn("hi-dec-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/decline`, { reason: "Fully booked" }, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("declined");
    const last = (await listMessages(testEnv.DB, inquiry.id)).at(-1);
    expect(last).toMatchObject({ kind: "decline", body: "Fully booked" });
    expect(outbox).toHaveLength(1);
    const thread = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    expect(thread).toContain("This inquiry is finished");
    expect(thread).not.toContain('name="body"');
    expect((await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "Wait" }, cookie)).status).toBe(409);

    const answered = await makeInquiry({ tag: "hi-dec2", status: "answered" });
    const c2 = (await signIn("hi-dec2-b@vnx.si")).cookie;
    expect((await post(`/hub/inquiries/${answered.inquiry.id}/decline`, {}, c2)).status).toBe(409);
  });

  it("closes an inquiry and then refuses messages", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-close", status: "answered" });
    const { cookie } = await signIn("hi-close-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("closed");
    expect((await post(`/hub/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(0);
  });

  it("blocks replies from a suspended builder", async () => {
    const { inquiry, builder } = await makeInquiry({ tag: "hi-susp", status: "open" });
    await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const { cookie } = await signIn("hi-susp-b@vnx.si");
    expect((await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "Hello" }, cookie)).status).toBe(409);
  });

  it("escapes message text", async () => {
    const { inquiry } = await makeInquiry({ tag: "hi-xss", status: "open" });
    const { cookie } = await signIn("hi-xss-b@vnx.si");
    await post(`/hub/inquiries/${inquiry.id}/reply`, { body: "<script>alert(1)</script>" }, cookie);
    const html = await (await get(`/hub/inquiries/${inquiry.id}`, cookie)).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

Run → FAIL.

- [ ] **Step 3: Middleware `no-store`**

`apps/web/src/http/no-store.ts`:

```ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { localeFromPath } from "../i18n/locales.ts";

const PRIVATE = /^\/(hub|me|admin)(\/|$)/;

/** Pages with personal data must never be stored by browsers or shared caches. */
export const noStorePrivate: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (PRIVATE.test(localeFromPath(c.req.path).rest)) c.header("Cache-Control", "no-store");
};
```

Trong `apps/web/src/app.ts`, ngay sau `app.use("*", sessionMiddleware);`: `app.use("*", noStorePrivate);`.

- [ ] **Step 4: `InquiryThread`**

`apps/web/src/views/InquiryThread.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { canPostMessage, DECLINE_REASON_MAX, REPLY_MAX, type InquiryMessage, type InquirySummary } from "../domain/inquiry.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "./labels.ts";
import { PlainText } from "./PlainText.tsx";

type Props = {
  locale: Locale;
  summary: InquirySummary;
  messages: InquiryMessage[];
  viewer: "builder" | "client";
  /** Locale-prefixed path of this thread page; actions post to `${base}/reply` etc. */
  base: string;
  replyError?: string;
  reasonError?: string;
  values?: { body?: string; reason?: string };
};

const when = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export const InquiryThread: FC<Props> = ({ locale, summary, messages, viewer, base, replyError, reasonError, values }) => {
  const tr = translator(locale);
  const inquiry = summary.inquiry;
  const nameOf = (m: InquiryMessage) => {
    const fromClient = m.senderUserId === inquiry.clientUserId;
    if ((viewer === "client") === fromClient) return tr("thread.you");
    return fromClient ? inquiry.clientName : summary.builderName;
  };
  const active = canPostMessage(inquiry.status);
  return (
    <article class="thread">
      <dl class="facts">
        <dt>{tr("thread.type")}</dt>
        <dd>{tr(INQUIRY_TYPE_KEY[inquiry.type])}</dd>
        <dt>{tr("inbox.about")}</dt>
        <dd>
          {summary.productSlug && summary.productName ? <a href={localizedPath(locale, `/p/${summary.productSlug}`)}>{summary.productName}</a> : <a href={localizedPath(locale, `/b/${summary.builderHandle}`)}>{summary.builderName}</a>}
        </dd>
        <dt>{tr("thread.budget")}</dt>
        <dd>{tr(BUDGET_KEY[inquiry.budgetBand])}</dd>
        {inquiry.deadline ? (
          <>
            <dt>{tr("thread.deadline")}</dt>
            <dd>{inquiry.deadline}</dd>
          </>
        ) : null}
        <dt>{tr("hub.status.label")}</dt>
        <dd>
          <span class={`badge badge-inquiry-${inquiry.status}`}>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</span>
        </dd>
      </dl>

      <ol class="messages">
        {messages.map((m) => (
          <li class={m.senderUserId === inquiry.clientUserId ? "from-client" : "from-builder"}>
            <p class="muted">
              <strong>{nameOf(m)}</strong> · {when(m.createdAt)}
            </p>
            {m.kind === "decline" ? <p>{tr("thread.declined", { name: summary.builderName })}</p> : null}
            {m.body ? <PlainText text={m.body} /> : null}
          </li>
        ))}
      </ol>

      {active ? (
        <>
          <form method="post" action={`${base}/reply`} class="card wide">
            <div class="field">
              <label for="th-body">{tr("thread.reply")}</label>
              <textarea id="th-body" name="body" required maxlength={REPLY_MAX} aria-invalid={replyError ? "true" : undefined} aria-describedby={replyError ? "th-body-error" : undefined}>
                {values?.body ?? ""}
              </textarea>
              <p class="hint">{tr("thread.replyHint")}</p>
              {replyError ? (
                <p id="th-body-error" class="error-msg" role="alert">
                  {replyError}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("thread.send")}
            </button>
          </form>
          <div class="row-actions">
            {viewer === "builder" && inquiry.status === "open" ? (
              <form method="post" action={`${base}/decline`} class="card wide">
                <div class="field">
                  <label for="th-reason">{tr("thread.declineReason")}</label>
                  <textarea id="th-reason" name="reason" maxlength={DECLINE_REASON_MAX} aria-invalid={reasonError ? "true" : undefined}>
                    {values?.reason ?? ""}
                  </textarea>
                  {reasonError ? (
                    <p class="error-msg" role="alert">
                      {reasonError}
                    </p>
                  ) : null}
                </div>
                <button class="btn secondary" type="submit">
                  {tr("thread.decline")}
                </button>
              </form>
            ) : null}
            <form method="post" action={`${base}/close`}>
              <button class="link" type="submit">
                {tr("thread.close")}
              </button>
            </form>
          </div>
        </>
      ) : (
        <p class="notice">{tr("thread.closed")}</p>
      )}
    </article>
  );
};
```

- [ ] **Step 5: `InquiriesPage` (danh sách, dùng cho Hub; Task 6 dùng lại cho `/me`)**

`apps/web/src/views/hub/InquiriesPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { InquirySummary } from "../../domain/inquiry.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "../labels.ts";

/** The inbox table: the builder sees "From <client name>", the client sees "To <builder name>". */
export const InquiryList: FC<{ locale: Locale; items: InquirySummary[]; viewer: "builder" | "client"; base: string }> = ({ locale, items, viewer, base }) => {
  const tr = translator(locale);
  if (items.length === 0) return <p class="muted">{tr("inbox.empty")}</p>;
  return (
    <div class="table-wrap">
      <table class="data">
        <tbody>
          {items.map(({ inquiry, productName, builderName }) => (
            <tr>
              <td>
                <a href={localizedPath(locale, `${base}/${inquiry.id}`)}>{viewer === "builder" ? tr("inbox.from", { name: inquiry.clientName }) : tr("inbox.to", { name: builderName })}</a>
              </td>
              <td>
                {tr(INQUIRY_TYPE_KEY[inquiry.type])}
                {productName ? ` · ${productName}` : null}
              </td>
              <td>
                <span class={`badge badge-inquiry-${inquiry.status}`}>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</span>
              </td>
              <td class="muted">{inquiry.lastActivityAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

- [ ] **Step 6: Route Hub**

`apps/web/src/routes/hub-inquiries.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { addMessageStatement, findBuilderInquiry, findClientInquiry, listBuilderInquiries, listMessages, returnedInquiry, setInquiryStatusStatement } from "../db/inquiries.ts";
import { parseDeclineReason, parseMessageBody, transition, type InquiryAction, type InquirySummary } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { errorResponse } from "../views/error-response.tsx";
import { HubLayout } from "../views/hub/HubLayout.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { page } from "../views/render.ts";

export type Side = "builder" | "client";

/** Loads the inquiry for whoever is acting; anything they may not see reads as missing. */
export async function loadForSide(c: Context<AppEnv>, side: Side, id: string): Promise<InquirySummary | null> {
  const user = c.get("user")!;
  return side === "builder" ? findBuilderInquiry(c.env.DB, user.id, id) : findClientInquiry(c.env.DB, user.id, id);
}

type Rerender = (c: Context<AppEnv>, summary: InquirySummary, extra: { replyError?: string; reasonError?: string; values?: { body?: string; reason?: string } }, status: 400) => Promise<Response>;

/**
 * One inquiry action (reply, decline, close) for the builder or the client: compare-and-set the status, add the
 * message (if any) and the audit row in one batch, then notify. Spec §7.3; a lost race or a wrong status is 409.
 */
export async function postInquiryAction(c: Context<AppEnv>, side: Side, action: Extract<InquiryAction, "reply" | "decline" | "close">, rerender: Rerender, threadPath: string) {
  const id = c.req.param("id") ?? "";
  const summary = await loadForSide(c, side, id);
  if (!summary) return errorResponse(c, "notFound", 404);
  // A suspended builder may not contact clients (plan M5).
  if (side === "builder" && c.get("builder")?.status === "suspended") return errorResponse(c, "conflict", 409);
  const inquiry = summary.inquiry;
  const next = transition(inquiry.status, action, side);
  if (!next.ok) return errorResponse(c, "conflict", 409);

  const tr = translator(c.get("locale"));
  const form = await c.req.parseBody();
  let message: { kind: "message" | "decline"; body: string } | null = null;
  if (action === "reply") {
    const body = parseMessageBody(form.body);
    if (!body.ok) return rerender(c, summary, { replyError: tr(`thread.error.${body.error}`), values: { body: typeof form.body === "string" ? form.body : "" } }, 400);
    message = { kind: "message", body: body.body };
  } else if (action === "decline") {
    const reason = parseDeclineReason(form.reason);
    if (!reason.ok) return rerender(c, summary, { reasonError: tr("thread.error.too_long"), values: { reason: typeof form.reason === "string" ? form.reason : "" } }, 400);
    message = { kind: "decline", body: reason.reason };
  }

  const user = c.get("user")!;
  const now = new Date();
  const iso = now.toISOString();
  const guard = { inquiryId: inquiry.id, status: next.status, updatedAt: iso };
  const statements = [setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: inquiry.status, to: next.status, now: iso })];
  if (message) statements.push(addMessageStatement(c.env.DB, { inquiryId: inquiry.id, senderUserId: user.id, kind: message.kind, body: message.body, now: iso }, guard));
  statements.push(auditStatement(c.env.DB, { actorUserId: user.id, action: `inquiry.${action}`, entity: "inquiry", entityId: inquiry.id, data: { by: side, from: inquiry.status, to: next.status }, now: iso }, guard));
  const results = await c.env.DB.batch(statements);
  if (!returnedInquiry(results[0])) return errorResponse(c, "conflict", 409);
  const messageId = message ? (results[1]?.results[0] as { id: string } | undefined)?.id : undefined;
  if (messageId) await notifyInquiryMessage(c.env, messageId, now);
  return c.redirect(localizedPath(c.get("locale"), `${threadPath}/${inquiry.id}`), 303);
}

async function threadPage(c: Context<AppEnv>, summary: InquirySummary, extra: { replyError?: string; reasonError?: string; values?: { body?: string; reason?: string } } = {}, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const messages = await listMessages(c.env.DB, summary.inquiry.id);
  const rest = `/hub/inquiries/${summary.inquiry.id}`;
  return page(
    c,
    <HubLayout locale={locale} origin={requestOrigin(c)} title={tr("inbox.from", { name: summary.inquiry.clientName })} rest={rest} active="inquiries">
      <h1>{tr("inbox.from", { name: summary.inquiry.clientName })}</h1>
      <InquiryThread locale={locale} summary={summary} messages={messages} viewer="builder" base={localizedPath(locale, rest)} {...extra} />
    </HubLayout>,
    status,
  );
}

export function registerHubInquiryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/inquiries", requireBuilder, async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const items = await listBuilderInquiries(c.env.DB, c.get("builder").userId);
    return page(
      c,
      <HubLayout locale={locale} origin={requestOrigin(c)} title={tr("inbox.title")} rest="/hub/inquiries" active="inquiries">
        <h1>{tr("inbox.title")}</h1>
        <InquiryList locale={locale} items={items} viewer="builder" base="/hub/inquiries" />
      </HubLayout>,
    );
  });

  onLocalized(app, "get", "/hub/inquiries/:id", requireBuilder, async (c) => {
    const summary = await loadForSide(c, "builder", c.req.param("id") ?? "");
    return summary ? threadPage(c, summary) : errorResponse(c, "notFound", 404);
  });

  for (const action of ["reply", "decline", "close"] as const) {
    onLocalized(app, "post", `/hub/inquiries/:id/${action}`, requireBuilder, (c) => postInquiryAction(c, "builder", action, (cc, s, extra, status) => threadPage(cc, s, extra, status), "/hub/inquiries"));
  }
}
```

(`thread.error.${…}` dùng một bảng key nếu `tr` không nhận key ghép.) Trong `apps/web/src/app.ts`: import và gọi `registerHubInquiryRoutes(app);` ngay sau `registerHubRoutes(app);`.

- [ ] **Step 7: Hub layout và tổng quan**

- `apps/web/src/views/hub/HubLayout.tsx`: `HubSection` thêm `"inquiries"`; `NAV` thêm `{ key: "inquiries", path: "/hub/inquiries", label: "hub.nav.inquiries" }` sau `products`.
- `apps/web/src/routes/hub.tsx`: GET `/hub` gọi thêm `countOpenInquiries(c.env.DB, builder.userId)` (chạy cùng `Promise.all` với `countBuilderProductsByStatus`) và truyền `openInquiries` vào `OverviewPage`.
- `apps/web/src/views/hub/OverviewPage.tsx`: thêm prop `openInquiries: number`; sau section product, thêm:

```tsx
      <section class="card wide">
        <h2>{tr("hub.nav.inquiries")}</h2>
        <p>{tr("hub.inquiries.open", { n: openInquiries })}</p>
        <p>
          <a href={localizedPath(locale, "/hub/inquiries")}>{tr("inbox.title")}</a>
        </p>
      </section>
```

CSS, cuối `app.css`:

```css
.messages { list-style: none; padding: 0; display: grid; gap: 12px; margin: 24px 0; }
.messages > li { border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 16px; background: var(--surface); }
.messages > li.from-builder { border-left: 4px solid var(--accent); }
.badge-inquiry-open { border-color: var(--accent); color: var(--accent); }
.badge-inquiry-answered { border-color: var(--good); color: var(--good); }
```

- [ ] **Step 8: Chạy test, commit**

Run: `npm test -w apps/web -- test/hub test/http/no-store.test.ts` → PASS.
Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/routes/hub-inquiries.tsx apps/web/src/views/hub/InquiriesPage.tsx apps/web/src/views/InquiryThread.tsx apps/web/src/http/no-store.ts apps/web/src/views/hub/HubLayout.tsx apps/web/src/views/hub/OverviewPage.tsx apps/web/src/routes/hub.tsx apps/web/src/app.ts apps/web/public/assets/app.css apps/web/src/i18n/messages apps/web/test/hub/inquiries.test.ts apps/web/test/http/no-store.test.ts
git commit -m "feat(web): Hub inquiry inbox with reply, decline and close

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: VNX-0503b — `/me`, admin Inquiry, test cổng ra M5

**Files:**
- Create: `apps/web/src/routes/me.tsx`, `apps/web/src/routes/admin-inquiries.tsx`, `apps/web/src/views/admin/InquiriesPage.tsx`
- Modify: `apps/web/src/views/admin/AdminLayout.tsx` (mục "Inquiries"), `apps/web/src/views/Layout.tsx` (link `/me` khi đã đăng nhập), `apps/web/src/app.ts`, 4 file i18n
- Test: `apps/web/test/me/inquiries.test.ts`, `apps/web/test/admin/inquiries.test.ts`, `apps/web/test/inquiry-gate.test.ts`

**Interfaces:**
- Consumes: Task 5 (`postInquiryAction`, `loadForSide`, `InquiryThread`, `InquiryList`), Task 1 (`listClientInquiries`, `listInquiriesForAdmin`, `findInquiryById`, `setInquiryStatusStatement`, `returnedInquiry`, `transition`, `INQUIRY_STATUSES`), Task 4 (form, `FAKE_TURNSTILE_PASS`), Task 3 (`followMagicLink`), `requireUser`, `requireAdmin`.
- Produces: `registerMeRoutes(app)`, `registerAdminInquiryRoutes(app)`.

- [ ] **Step 1: Key i18n**

`en.ts`:

```ts
  "nav.me": "My inquiries",
  "me.title": "My inquiries",
  "me.pending": "Waiting for you to confirm your e-mail. Check your inbox for the link.",
  "admin.nav.inquiries": "Inquiries",
  "admin.inquiries.filter": "Status",
  "admin.inquiries.client": "Client",
  "admin.inquiries.builder": "Builder",
  "admin.inquiries.message": "Message",
  "admin.inquiries.remove": "Mark as spam (remove)",
```

`vi.ts`:

```ts
  "nav.me": "Yêu cầu của tôi",
  "me.title": "Yêu cầu của tôi",
  "me.pending": "Đang chờ bạn xác nhận email. Hãy tìm link trong hộp thư.",
  "admin.nav.inquiries": "Yêu cầu",
  "admin.inquiries.filter": "Trạng thái",
  "admin.inquiries.client": "Client",
  "admin.inquiries.builder": "Builder",
  "admin.inquiries.message": "Nội dung",
  "admin.inquiries.remove": "Đánh dấu spam (gỡ)",
```

`zh-hans.ts`:

```ts
  "nav.me": "我的咨询",
  "me.title": "我的咨询",
  "me.pending": "等待你确认邮箱。请在收件箱中查找链接。",
  "admin.nav.inquiries": "咨询",
  "admin.inquiries.filter": "状态",
  "admin.inquiries.client": "客户",
  "admin.inquiries.builder": "开发者",
  "admin.inquiries.message": "内容",
  "admin.inquiries.remove": "标记为垃圾（移除）",
```

`zh-hant.ts`:

```ts
  "nav.me": "我的詢問",
  "me.title": "我的詢問",
  "me.pending": "等待你確認電子郵件。請在收件匣中尋找連結。",
  "admin.nav.inquiries": "詢問",
  "admin.inquiries.filter": "狀態",
  "admin.inquiries.client": "客戶",
  "admin.inquiries.builder": "開發者",
  "admin.inquiries.message": "內容",
  "admin.inquiries.remove": "標記為垃圾（移除）",
```

- [ ] **Step 2: Test (fail)**

`apps/web/test/me/inquiries.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, cookie: string) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("/me (spec §5.4)", () => {
  beforeEach(() => clearOutbox());

  it("requires sign-in", async () => {
    const res = await get("/vi/me");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fme");
  });

  it("lists the client's inquiries, including one waiting for e-mail confirmation", async () => {
    const open = await makeInquiry({ tag: "me-list", status: "open" });
    const { cookie } = await signIn(open.client.email);
    const html = await (await get("/me", cookie)).text();
    expect(html).toContain("To me-list builder");
    expect(html).toContain(`href="/me/inquiries/${open.inquiry.id}"`);
    const pending = await makeInquiry({ tag: "me-pend", status: "pending_verification" });
    const pc = (await signIn(pending.client.email)).cookie;
    expect(await (await get(`/me/inquiries/${pending.inquiry.id}`, pc)).text()).toContain("Waiting for you to confirm your e-mail.");
  });

  it("lets the client reply (status kept) and close; the builder is notified of the reply", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "me-reply", status: "answered" });
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/inquiries/${inquiry.id}/reply`, { body: "Thanks, sounds good." }, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("answered");
    expect(outbox[0]?.to).toBe("me-reply-b@vnx.si");
    expect((await post(`/me/inquiries/${inquiry.id}/close`, {}, cookie)).status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("closed");
  });

  it("does not let the client decline, nor post on a pending inquiry", async () => {
    const open = await makeInquiry({ tag: "me-dec", status: "open" });
    const { cookie } = await signIn(open.client.email);
    expect((await post(`/me/inquiries/${open.inquiry.id}/decline`, {}, cookie)).status).toBe(404);
    const pending = await makeInquiry({ tag: "me-pend2", status: "pending_verification" });
    const pc = (await signIn(pending.client.email)).cookie;
    expect((await post(`/me/inquiries/${pending.inquiry.id}/reply`, { body: "Hello?" }, pc)).status).toBe(409);
  });

  it("hides other clients' and removed inquiries", async () => {
    const a = await makeInquiry({ tag: "me-a", status: "open" });
    const b = await makeInquiry({ tag: "me-b", status: "removed" });
    const { cookie } = await signIn(a.client.email);
    expect((await get(`/me/inquiries/${b.inquiry.id}`, cookie)).status).toBe(404);
    const bc = (await signIn(b.client.email)).cookie;
    expect((await get(`/me/inquiries/${b.inquiry.id}`, bc)).status).toBe(404);
    expect(await (await get("/me", bc)).text()).toContain("No inquiries yet.");
  });

  it("links to /me from the header when signed in", async () => {
    const { cookie } = await signIn("me-nav@vnx.si");
    const html = await (await get("/zh-hant/products", cookie)).text();
    const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(header).toContain('<a href="/zh-hant/me">我的詢問</a>');
  });
});
```

`apps/web/test/admin/inquiries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findInquiryById } from "../../src/db/inquiries.ts";
import { makeInquiry, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();

describe("admin inquiries (spec §5.5)", () => {
  it("lists inquiries with the client's e-mail for the admin and filters by status", async () => {
    const { inquiry, client } = await makeInquiry({ tag: "ai-list", status: "open" });
    await makeInquiry({ tag: "ai-list2", status: "closed" });
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    const html = await (await app().request(getReq("/admin/inquiries?status=open", cookie), undefined, testEnv)).text();
    expect(html).toContain(client.email);
    expect(html).toContain(inquiry.id);
    expect(html).not.toContain("ai-list2-c@vnx.si");
    expect((await app().request(getReq("/admin/inquiries?status=bogus", cookie), undefined, testEnv)).status).toBe(200);
  });

  it("removes an inquiry as spam, once, with an audit row", async () => {
    const { inquiry } = await makeInquiry({ tag: "ai-rm", status: "answered" });
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    const res = await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect((await findInquiryById(testEnv.DB, inquiry.id))?.status).toBe("removed");
    expect((await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'inquiry.remove' AND entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("is admin-only", async () => {
    const { inquiry } = await makeInquiry({ tag: "ai-auth", status: "open" });
    const { cookie } = await signIn("ai-auth-b@vnx.si");
    expect((await app().request(getReq("/admin/inquiries", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost(`/admin/inquiries/${inquiry.id}/remove`, {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });
});
```

`apps/web/test/inquiry-gate.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { clearOutbox, outbox } from "../src/email/fake.ts";
import { FAKE_TURNSTILE_PASS } from "../src/http/turnstile.ts";
import { makeLiveProduct, signIn } from "./fixtures.ts";
import { followMagicLink, formPost, getReq, testEnv } from "./helpers.ts";

describe("M5 exit gate: a signed-out inquiry goes all the way round", () => {
  beforeEach(() => clearOutbox());

  it("confirm e-mail → builder replies → client sees it in /me; the builder never sees the client's e-mail", async () => {
    const app = createApp();
    const clientEmail = "gate5.client@example.com";
    const { product } = await makeLiveProduct("gate5-b@vnx.si", "gate5", "Gate Five Kit");

    const sent = await app.request(
      formPost(`/vi/p/${product.slug}/inquiry/buy`, { type: "buy", message: "Please set this up for my two spas.", budgetBand: "2k-10k", deadline: "", name: "Gate Client", email: clientEmail, website: "", "cf-turnstile-response": FAKE_TURNSTILE_PASS }),
      undefined,
      testEnv,
    );
    expect(sent.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(clientEmail);
    const link = /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(outbox[0]!.text)![0];

    const confirmed = await followMagicLink(app, link);
    expect(confirmed.status).toBe(303);
    const inquiryPath = confirmed.headers.get("location")!;
    expect(inquiryPath).toMatch(/^\/vi\/me\/inquiries\/[0-9A-Z]{26}$/);
    const clientCookie = `__Host-vnx_session=${/__Host-vnx_session=([^;]+)/.exec(confirmed.headers.get("set-cookie") ?? "")![1]}`;
    const id = inquiryPath.split("/").at(-1)!;

    const toBuilder = outbox[1]!;
    expect(toBuilder.to).toBe("gate5-b@vnx.si");
    expect(toBuilder.text).toContain("Please set this up for my two spas.");
    expect(toBuilder.text).toContain("Gate Client");

    const builder = await signIn("gate5-b@vnx.si");
    const list = await (await app.request(getReq("/hub/inquiries", builder.cookie), undefined, testEnv)).text();
    const thread = await (await app.request(getReq(`/hub/inquiries/${id}`, builder.cookie), undefined, testEnv)).text();
    expect(thread).toContain("Please set this up for my two spas.");
    // Spec §5.6: the builder never sees the client's e-mail, in pages or e-mails.
    for (const seen of [list, thread, toBuilder.text, toBuilder.html, toBuilder.subject]) expect(seen).not.toContain(clientEmail);

    const replied = await app.request(formPost(`/hub/inquiries/${id}/reply`, { body: "Sure, I can start Monday." }, { cookie: builder.cookie }), undefined, testEnv);
    expect(replied.status).toBe(303);

    const mine = await (await app.request(getReq(inquiryPath, clientCookie), undefined, testEnv)).text();
    expect(mine).toContain("Sure, I can start Monday.");
    expect(mine).toContain("Đã trả lời");
    expect(outbox[2]?.to).toBe(clientEmail);
  }, 30_000);
});
```

Run → FAIL.

- [ ] **Step 3: Route `/me`**

`apps/web/src/routes/me.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireUser } from "../auth/middleware.ts";
import { listClientInquiries, listMessages } from "../db/inquiries.ts";
import type { InquirySummary } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryList } from "../views/hub/InquiriesPage.tsx";
import { InquiryThread } from "../views/InquiryThread.tsx";
import { Layout } from "../views/Layout.tsx";
import { page } from "../views/render.ts";
import { loadForSide, postInquiryAction } from "./hub-inquiries.tsx";

async function threadPage(c: Context<AppEnv>, summary: InquirySummary, extra: { replyError?: string; values?: { body?: string } } = {}, status: 200 | 400 = 200) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const messages = await listMessages(c.env.DB, summary.inquiry.id);
  const rest = `/me/inquiries/${summary.inquiry.id}`;
  const title = tr("inbox.to", { name: summary.builderName });
  return page(
    c,
    <Layout locale={locale} title={`${title} · VNX.SI`} origin={requestOrigin(c)} rest={rest} noindex signedIn>
      <p>
        <a href={localizedPath(locale, "/me")}>{tr("me.title")}</a>
      </p>
      <h1>{title}</h1>
      {summary.inquiry.status === "pending_verification" ? <p class="notice">{tr("me.pending")}</p> : null}
      <InquiryThread locale={locale} summary={summary} messages={messages} viewer="client" base={localizedPath(locale, rest)} {...extra} />
    </Layout>,
    status,
  );
}

export function registerMeRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/me", requireUser, async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const items = await listClientInquiries(c.env.DB, c.get("user")!.id);
    return page(
      c,
      <Layout locale={locale} title={`${tr("me.title")} · VNX.SI`} origin={requestOrigin(c)} rest="/me" noindex signedIn>
        <h1>{tr("me.title")}</h1>
        <InquiryList locale={locale} items={items} viewer="client" base="/me/inquiries" />
      </Layout>,
    );
  });

  onLocalized(app, "get", "/me/inquiries/:id", requireUser, async (c) => {
    const summary = await loadForSide(c, "client", c.req.param("id") ?? "");
    return summary ? threadPage(c, summary) : errorResponse(c, "notFound", 404);
  });

  // Clients reply and close; declining is the builder's (spec §7.3), so /decline does not exist here (404).
  for (const action of ["reply", "close"] as const) {
    onLocalized(app, "post", `/me/inquiries/:id/${action}`, requireUser, (c) => postInquiryAction(c, "client", action, (cc, s, extra, status) => threadPage(cc, s, extra, status), "/me/inquiries"));
  }
}
```

`InquiryThread` với `viewer="client"` không hiện form từ chối. `pending_verification` không phải trạng thái "active" nên không có form trả lời (POST trả 409 qua `transition`).

- [ ] **Step 4: Route admin**

`apps/web/src/views/admin/InquiriesPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { INQUIRY_STATUSES, type AdminInquiry, type InquiryStatus } from "../../domain/inquiry.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { INQUIRY_STATUS_KEY, INQUIRY_TYPE_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export const AdminInquiriesPage: FC<{ locale: Locale; origin: string; status: InquiryStatus | null; items: AdminInquiry[] }> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/inquiries");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.inquiries")} rest="/admin/inquiries" active="inquiries">
      <h1>{tr("admin.nav.inquiries")}</h1>
      <nav class="subnav" aria-label={tr("admin.inquiries.filter")}>
        <a href={base} aria-current={p.status === null ? "page" : undefined}>
          {tr("filter.any")}
        </a>
        {INQUIRY_STATUSES.map((s) => (
          <a href={`${base}?status=${s}`} aria-current={p.status === s ? "page" : undefined}>
            {tr(INQUIRY_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("inbox.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>{tr("admin.inquiries.client")}</th>
                <th>{tr("admin.inquiries.builder")}</th>
                <th>{tr("admin.inquiries.message")}</th>
                <th>{tr("hub.status.label")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.items.map(({ inquiry, clientEmail, builderHandle, productName }) => (
                <tr>
                  <td>
                    <code>{inquiry.id}</code>
                    <br />
                    <span class="muted">{inquiry.createdAt.slice(0, 10)}</span>
                  </td>
                  <td>
                    {inquiry.clientName}
                    <br />
                    <span class="muted">{clientEmail}</span>
                  </td>
                  <td>
                    @{builderHandle}
                    {productName ? ` · ${productName}` : null}
                    <br />
                    <span class="muted">{tr(INQUIRY_TYPE_KEY[inquiry.type])}</span>
                  </td>
                  <td>{inquiry.message.length > 200 ? `${inquiry.message.slice(0, 200)}…` : inquiry.message}</td>
                  <td>{tr(INQUIRY_STATUS_KEY[inquiry.status])}</td>
                  <td>
                    {inquiry.status !== "removed" ? (
                      <form method="post" action={localizedPath(p.locale, `/admin/inquiries/${inquiry.id}/remove`)}>
                        <button class="link" type="submit">
                          {tr("admin.inquiries.remove")}
                        </button>
                      </form>
                    ) : null}
                  </td>
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

`apps/web/src/routes/admin-inquiries.tsx`:

```tsx
import type { Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { auditStatement } from "../db/audit.ts";
import { findInquiryById, listInquiriesForAdmin, returnedInquiry, setInquiryStatusStatement } from "../db/inquiries.ts";
import { INQUIRY_STATUSES, transition, type InquiryStatus } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { AdminInquiriesPage } from "../views/admin/InquiriesPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerAdminInquiryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/inquiries", requireAdmin, async (c) => {
    const raw = c.req.query("status");
    const status = (INQUIRY_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as InquiryStatus) : null;
    const items = await listInquiriesForAdmin(c.env.DB, status);
    return page(c, <AdminInquiriesPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} items={items} />);
  });

  onLocalized(app, "post", "/admin/inquiries/:id/remove", requireAdmin, async (c) => {
    const inquiry = await findInquiryById(c.env.DB, c.req.param("id") ?? "");
    if (!inquiry) return errorResponse(c, "notFound", 404);
    const next = transition(inquiry.status, "remove", "admin");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    const iso = new Date().toISOString();
    const guard = { inquiryId: inquiry.id, status: next.status, updatedAt: iso };
    const [moved] = await c.env.DB.batch([
      setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: inquiry.status, to: next.status, now: iso }),
      auditStatement(c.env.DB, { actorUserId: c.get("user")!.id, action: "inquiry.remove", entity: "inquiry", entityId: inquiry.id, data: { from: inquiry.status }, now: iso }, guard),
    ]);
    if (!returnedInquiry(moved)) return errorResponse(c, "conflict", 409);
    return c.redirect(localizedPath(c.get("locale"), "/admin/inquiries"), 303);
  });
}
```

- `apps/web/src/views/admin/AdminLayout.tsx`: `AdminSection` thêm `"inquiries"`; `NAV` thêm `{ key: "inquiries", path: "/admin/inquiries", label: "admin.nav.inquiries" }` sau `products`.
- `apps/web/src/app.ts`: import và gọi `registerMeRoutes(app);` sau `registerHubInquiryRoutes(app);`, `registerAdminInquiryRoutes(app);` sau `registerAdminProductRoutes(app);`.
- `apps/web/src/views/Layout.tsx`: trong nhánh `signedIn`, trước link Hub: `<a href={localizedPath(locale, "/me")}>{tr("nav.me")}</a>`.

- [ ] **Step 5: Chạy test, commit**

Run: `npm test -w apps/web -- test/me test/admin/inquiries.test.ts test/inquiry-gate.test.ts` → PASS.
Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/routes/me.tsx apps/web/src/routes/admin-inquiries.tsx apps/web/src/views/admin/InquiriesPage.tsx apps/web/src/views/admin/AdminLayout.tsx apps/web/src/views/Layout.tsx apps/web/src/app.ts apps/web/src/i18n/messages apps/web/test/me apps/web/test/admin/inquiries.test.ts apps/web/test/inquiry-gate.test.ts
git commit -m "feat(web): client inquiries at /me, admin spam removal and M5 exit gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: VNX-0505 — Cron hằng ngày

**Files:**
- Create: `apps/web/src/jobs/daily.ts`
- Modify: `apps/web/src/index.ts` (`scheduled`), `apps/web/wrangler.jsonc` (`triggers.crons`), `apps/web/src/auth/tokens.ts` (`deleteExpiredTokens`), `apps/web/src/auth/sessions.ts` (`deleteExpiredSessions`), `apps/web/src/http/rate-limit.ts` (`deleteOldRateLimitWindows`), `apps/web/src/db/users.ts` (`deleteGhostUsers`)
- Test: `apps/web/test/jobs/daily.test.ts`

**Interfaces:**
- Consumes: Task 1 (`listInquiriesToRemind`, `markReminded`, `listInquiriesToAlert`, `markAlerted`, `deleteExpiredPendingInquiries`, `listUnnotifiedMessages`, `PENDING_TTL_MS`, `REMIND_AFTER_MS`, `ALERT_AFTER_MS`), Task 2 (`notifyInquiryMessage`, `inquiryReminderEmail`, `inquiryAdminAlertEmail`, `inquiryUrl`), `adminEmails`, `getMailer`, `findUserById`.
- Produces: `runDaily(env: Bindings, now: Date): Promise<DailySummary>` với `DailySummary = { reminded: number; alerted: number; resent: number; pendingDeleted: number; ghostsDeleted: number; tokensDeleted: number; sessionsDeleted: number; rateLimitRowsDeleted: number }`.

- [ ] **Step 1: Test (fail)**

`apps/web/test/jobs/daily.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../../src/auth/sessions.ts";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { findInquiryById, listMessages } from "../../src/db/inquiries.ts";
import { createUser, findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { hitRateLimit } from "../../src/http/rate-limit.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-10T01:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const sentTo = (to: string) => outbox.filter((m) => m.to === to);

describe("daily job (spec §8.4)", () => {
  beforeEach(() => clearOutbox());

  it("reminds the builder once after 3 days without a reply", async () => {
    const due = await makeInquiry({ tag: "dj-rem", status: "open", now: daysAgo(4), builderLocale: "vi" });
    const fresh = await makeInquiry({ tag: "dj-rem2", status: "open", now: daysAgo(1) });
    const answered = await makeInquiry({ tag: "dj-rem3", status: "answered", now: daysAgo(5) });
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-rem-b@vnx.si").map((m) => m.subject)).toContain("Minh Tran đang chờ bạn trả lời");
    expect(sentTo("dj-rem2-b@vnx.si").filter((m) => m.subject.includes("waiting"))).toEqual([]);
    expect(sentTo("dj-rem3-b@vnx.si").filter((m) => m.subject.includes("waiting"))).toEqual([]);
    expect((await findInquiryById(testEnv.DB, due.inquiry.id))?.builderRemindedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-rem-b@vnx.si").filter((m) => m.subject.includes("chờ"))).toEqual([]);
    expect(fresh.inquiry.id && answered.inquiry.id).toBeTruthy();
  });

  it("tells the admins once about inquiries open for 7 days", async () => {
    const late = await makeInquiry({ tag: "dj-alert", status: "open", now: daysAgo(8) });
    await runDaily(testEnv, NOW);
    const alert = sentTo("owner@vnx.si").find((m) => m.subject.includes("unanswered for 7 days"));
    expect(alert?.text).toContain(late.inquiry.id);
    expect((await findInquiryById(testEnv.DB, late.inquiry.id))?.adminAlertedAt).toBe(NOW.toISOString());
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("owner@vnx.si").filter((m) => m.text.includes(late.inquiry.id))).toEqual([]);
  });

  it("resends due notifications once, and skips them after a success", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "dj-resend", status: "open", now: daysAgo(0) });
    const summary = await runDaily(testEnv, NOW);
    expect(summary.resent).toBeGreaterThanOrEqual(1);
    expect(sentTo("dj-resend-b@vnx.si")).toHaveLength(1);
    expect((await listMessages(testEnv.DB, inquiry.id))[0]?.id).toBe(firstMessageId);
    clearOutbox();
    await runDaily(testEnv, NOW);
    expect(sentTo("dj-resend-b@vnx.si")).toHaveLength(0);
  });

  it("stops after three failed attempts in all", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "dj-fail", status: "open", now: daysAgo(0) });
    const noMail = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
    for (let i = 0; i < 4; i++) await runDaily(noMail, NOW);
    const [message] = await listMessages(testEnv.DB, inquiry.id);
    expect(message).toMatchObject({ id: firstMessageId, notifyAttempts: 3, notifiedAt: null });
  });

  it("deletes unconfirmed inquiries after 48 hours and the ghost accounts behind them", async () => {
    const old = await makeInquiry({ tag: "dj-ghost", status: "pending_verification", now: daysAgo(3) });
    // Make the client a never-signed-in implicit account created 3 days ago.
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(old.client.id, daysAgo(3)).run();
    const recent = await makeInquiry({ tag: "dj-ghost2", status: "pending_verification", now: daysAgo(1) });
    const summary = await runDaily(testEnv, NOW);
    expect(summary.pendingDeleted).toBeGreaterThanOrEqual(1);
    expect(await findInquiryById(testEnv.DB, old.inquiry.id)).toBeNull();
    expect(await findInquiryById(testEnv.DB, recent.inquiry.id)).not.toBeNull();
    expect(await findUserByEmail(testEnv.DB, old.client.email)).toBeNull();
  });

  it("keeps accounts that signed in, have a session, a builder row, an inquiry or are recent", async () => {
    const iso = daysAgo(5);
    const signedIn = await createUser(testEnv.DB, { email: "dj-keep1@vnx.si", locale: "en", now: iso });
    await testEnv.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(signedIn.id, iso).run();
    const withSession = await createUser(testEnv.DB, { email: "dj-keep2@vnx.si", locale: "en", now: iso });
    await createSession(testEnv.DB, withSession.id, NOW);
    const withInquiry = await makeInquiry({ tag: "dj-keep3", status: "open", now: iso });
    await testEnv.DB.prepare("UPDATE users SET created_at = ?2, last_login_at = NULL WHERE id = ?1").bind(withInquiry.client.id, iso).run();
    const recent = await createUser(testEnv.DB, { email: "dj-keep4@vnx.si", locale: "en", now: daysAgo(1) });
    const ghost = await createUser(testEnv.DB, { email: "dj-ghost3@vnx.si", locale: "en", now: iso });
    await runDaily(testEnv, NOW);
    for (const email of ["dj-keep1@vnx.si", "dj-keep2@vnx.si", withInquiry.client.email, "dj-keep4@vnx.si"]) expect(await findUserByEmail(testEnv.DB, email), email).not.toBeNull();
    expect(await findUserByEmail(testEnv.DB, "dj-ghost3@vnx.si")).toBeNull();
    expect(recent.id && ghost.id).toBeTruthy();
  });

  it("cleans expired tokens, sessions and old rate-limit windows", async () => {
    await createLoginToken(testEnv.DB, { email: "dj-tok@vnx.si", purpose: "login", locale: "en" }, new Date(daysAgo(3)));
    const user = await createUser(testEnv.DB, { email: "dj-sess@vnx.si", locale: "en", now: daysAgo(40) });
    await testEnv.DB.prepare("UPDATE users SET last_login_at = ?2 WHERE id = ?1").bind(user.id, daysAgo(40)).run();
    await createSession(testEnv.DB, user.id, new Date(daysAgo(40)));
    await hitRateLimit(testEnv.DB, "dj:test", 5, 3600, NOW.getTime() - 3 * 24 * 3600 * 1000);
    const summary = await runDaily(testEnv, NOW);
    expect(summary.tokensDeleted).toBeGreaterThanOrEqual(1);
    expect(summary.sessionsDeleted).toBeGreaterThanOrEqual(1);
    expect(summary.rateLimitRowsDeleted).toBeGreaterThanOrEqual(1);
    const left = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = 'dj:test'").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Hàm dọn dẹp ở module sở hữu bảng**

`apps/web/src/auth/tokens.ts`:

```ts
/** Spec §8.4: tokens past their expiry are useless. Returns rows deleted. */
export async function deleteExpiredTokens(db: D1Database, now: Date): Promise<number> {
  const res = await db.prepare("DELETE FROM login_tokens WHERE expires_at < ?1").bind(now.toISOString()).run();
  return res.meta.changes;
}
```

`apps/web/src/auth/sessions.ts`:

```ts
export async function deleteExpiredSessions(db: D1Database, now: Date): Promise<number> {
  const res = await db.prepare("DELETE FROM sessions WHERE expires_at < ?1").bind(now.toISOString()).run();
  return res.meta.changes;
}
```

`apps/web/src/http/rate-limit.ts`:

```ts
/** The longest window in use is one day (request: 3/day/e-mail); older windows can go. */
const LONGEST_WINDOW_SECONDS = 24 * 3600;

export async function deleteOldRateLimitWindows(db: D1Database, nowMs: number): Promise<number> {
  const res = await db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(Math.floor(nowMs / 1000) - LONGEST_WINDOW_SECONDS).run();
  return res.meta.changes;
}
```

`apps/web/src/db/users.ts`:

```ts
/**
 * Owner decision 2026-10-04: implicit accounts created before `cutoff` that never signed in and have nothing attached are
 * removed. M6 must add `requests` to this list when that table arrives.
 */
export async function deleteGhostUsers(db: D1Database, cutoff: string): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM users
       WHERE created_at < ?1 AND last_login_at IS NULL AND is_admin = 0
         AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM builders b WHERE b.user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM inquiries i WHERE i.client_user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM inquiry_messages m WHERE m.sender_user_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM invites v WHERE v.created_by = users.id)
         AND NOT EXISTS (SELECT 1 FROM product_verifications pv WHERE pv.verified_by = users.id)
         AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_user_id = users.id)`,
    )
    .bind(cutoff)
    .run();
  return res.meta.changes;
}
```

- [ ] **Step 3: `jobs/daily.ts`**

```ts
import { adminEmails } from "../auth/admin.ts";
import { deleteExpiredSessions } from "../auth/sessions.ts";
import { deleteExpiredTokens } from "../auth/tokens.ts";
import { deleteExpiredPendingInquiries, listInquiriesToAlert, listInquiriesToRemind, listUnnotifiedMessages, markAlerted, markReminded } from "../db/inquiries.ts";
import { deleteGhostUsers, findUserById } from "../db/users.ts";
import { ALERT_AFTER_MS, PENDING_TTL_MS, REMIND_AFTER_MS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryAdminAlertEmail, inquiryReminderEmail } from "../email/templates/inquiry.ts";
import type { Bindings } from "../env.ts";
import { deleteOldRateLimitWindows } from "../http/rate-limit.ts";
import { isLocale } from "../i18n/locales.ts";
import { inquiryUrl, notifyInquiryMessage } from "../notify/inquiry.ts";

export type DailySummary = {
  reminded: number;
  alerted: number;
  resent: number;
  pendingDeleted: number;
  ghostsDeleted: number;
  tokensDeleted: number;
  sessionsDeleted: number;
  rateLimitRowsDeleted: number;
};

const before = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

/**
 * Spec §8.4, 01:00 UTC. Idempotent (ARCHITECTURE §5): every e-mail is marked sent right after it goes out, so a second
 * run the same day sends nothing again. Each step runs even if an earlier one failed.
 */
export async function runDaily(env: Bindings, now: Date): Promise<DailySummary> {
  const iso = now.toISOString();
  const summary: DailySummary = { reminded: 0, alerted: 0, resent: 0, pendingDeleted: 0, ghostsDeleted: 0, tokensDeleted: 0, sessionsDeleted: 0, rateLimitRowsDeleted: 0 };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      console.error(JSON.stringify({ event: "jobs.daily.step_failed", step: name, error: String(err) }));
    }
  };
  const mailer = getMailer(env);

  await step("remind", async () => {
    for (const item of await listInquiriesToRemind(env.DB, before(now, REMIND_AFTER_MS))) {
      const builder = await findUserById(env.DB, item.inquiry.builderId);
      if (!builder) continue;
      const locale = isLocale(builder.locale) ? builder.locale : "en";
      try {
        await mailer.send({ to: builder.email, ...inquiryReminderEmail(locale, { clientName: item.inquiry.clientName, productName: item.productName, url: inquiryUrl(env, locale, item.inquiry.id, "builder") }) });
        await markReminded(env.DB, item.inquiry.id, iso);
        summary.reminded++;
      } catch (err) {
        console.error(JSON.stringify({ event: "jobs.daily.remind_failed", inquiryId: item.inquiry.id, error: String(err) }));
      }
    }
  });

  await step("alert", async () => {
    const late = await listInquiriesToAlert(env.DB, before(now, ALERT_AFTER_MS));
    const admins = [...adminEmails(env)];
    if (late.length === 0 || admins.length === 0) return;
    const mail = inquiryAdminAlertEmail(
      late.map((i) => ({ id: i.inquiry.id, builderHandle: i.builderHandle, productName: i.productName, openedAt: i.inquiry.openedAt ?? i.inquiry.createdAt })),
      new URL("/admin/inquiries?status=open", env.APP_ORIGIN).toString(),
    );
    for (const to of admins) await mailer.send({ to, ...mail });
    await markAlerted(env.DB, late.map((i) => i.inquiry.id), iso);
    summary.alerted = late.length;
  });

  await step("resend", async () => {
    for (const message of await listUnnotifiedMessages(env.DB)) {
      if ((await notifyInquiryMessage(env, message.id, now)) === "sent") summary.resent++;
    }
  });

  await step("pending", async () => {
    summary.pendingDeleted = await deleteExpiredPendingInquiries(env.DB, before(now, PENDING_TTL_MS));
  });
  // After the pending inquiries are gone, their implicit accounts have nothing attached (Owner 2026-10-04).
  await step("ghosts", async () => {
    summary.ghostsDeleted = await deleteGhostUsers(env.DB, before(now, PENDING_TTL_MS));
  });
  await step("tokens", async () => {
    summary.tokensDeleted = await deleteExpiredTokens(env.DB, now);
  });
  await step("sessions", async () => {
    summary.sessionsDeleted = await deleteExpiredSessions(env.DB, now);
  });
  await step("rate_limits", async () => {
    summary.rateLimitRowsDeleted = await deleteOldRateLimitWindows(env.DB, now.getTime());
  });

  console.log(JSON.stringify({ event: "jobs.daily.done", ...summary }));
  return summary;
}
```

Ghi chú: bước "ghosts" chạy sau "sessions"? Không: chạy trước "sessions" là cố ý. User ngầm chưa từng đăng nhập nên không có session; user có session hết hạn mà chưa xóa vẫn được giữ tới lần chạy sau (an toàn hơn).

Ghi chú: `console.log` của job không chứa email hay dữ liệu cá nhân.

- [ ] **Step 4: `scheduled` và cron trigger**

`apps/web/src/index.ts`:

```ts
import { createApp } from "./app.ts";
import type { Bindings } from "./env.ts";
import { runDaily } from "./jobs/daily.ts";

const app = createApp();

export default {
  fetch: app.fetch,
  // Spec §8.4 / ARCHITECTURE §5. The hourly "5 * * * *" job arrives with M7.
  scheduled(controller, env, ctx) {
    if (controller.cron === "0 1 * * *") ctx.waitUntil(runDaily(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Bindings>;
```

`apps/web/wrangler.jsonc`: thêm ở cấp gốc (sau `"observability"`):

```jsonc
  // Spec §8.4: daily job at 01:00 UTC (reminders, admin alert, notification retries, clean-up). M7 adds "5 * * * *".
  "triggers": { "crons": ["0 1 * * *"] },
```

(Cẩn thận dấu phẩy JSONC.)

- [ ] **Step 5: Chạy test, commit**

Run: `npm test -w apps/web -- test/jobs/daily.test.ts` → PASS (thêm `30_000` cho test nào tạo nhiều fixture nếu chạm timeout).
Run: `npm run typecheck -w apps/web && npm test` → exit 0.

```bash
git add apps/web/src/jobs/daily.ts apps/web/src/index.ts apps/web/wrangler.jsonc apps/web/src/auth/tokens.ts apps/web/src/auth/sessions.ts apps/web/src/http/rate-limit.ts apps/web/src/db/users.ts apps/web/test/jobs/daily.test.ts
git commit -m "feat(web): daily cron for reminders, admin alerts, retries and clean-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cổng ra M5 → test

| Tiêu chí | Test |
|---|---|
| Inquiry từ client chưa đăng nhập đi hết vòng: xác nhận email → builder trả lời → client thấy trong `/me` | `test/inquiry-gate.test.ts` (toàn bộ qua HTTP, có trang xác nhận và nút POST) |
| Builder không thấy email của client | `test/notify/inquiry.test.ts`, `test/public/inquiry-form.test.ts`, `test/hub/inquiries.test.ts` (HTML Hub và email gửi builder không chứa email client) |

Spec mục 9 phủ thêm: "Inquiry khi chưa đăng nhập … builder nhận email" (Task 4); "Phân quyền: non-admin vào `/admin` → 403" (Task 6); "POST thiếu `Origin` → 403" (Task 3).

## Nghĩa vụ để lại sau M5 (Reviewer ghi vào `CURRENT-STATUS.md` khi xong)

- **VNX-0507 (Owner):** tạo widget Turnstile cho `vnx.si`; đưa site key cho Claude đặt vào `wrangler.jsonc`; `wrangler secret put TURNSTILE_SECRET`. Thiếu thì form chưa đăng nhập tự đóng.
- **Deploy:** `db:migrate:remote` áp `0007_inquiries`; cron trigger mới có hiệu lực sau `npm run deploy`.
- **M6:** `deleteGhostUsers` phải xét thêm bảng `requests`; email `request_verify` dùng lại trang xác nhận (`VERIFY_PURPOSES`); nút "Post a request" (từ M4).
- **M7:** đếm `inquiries` vào `product_daily_stats` khi Inquiry vào `open`; hourly cron.
- **ARCHITECTURE:** thêm module `notify/` vào bảng mục 2 (Reviewer làm cùng commit plan).

## Ghi nhận (dự kiến)

- Thư báo admin quá 7 ngày chỉ tiếng Anh.
- `findMessageContext` tìm tin nhắn đầu bằng truy vấn con mỗi lần gửi; đủ cho Wave 1.
- Người đã đăng nhập không qua Turnstile (quyết định Owner); rate limit theo IP là lớp chặn còn lại.
