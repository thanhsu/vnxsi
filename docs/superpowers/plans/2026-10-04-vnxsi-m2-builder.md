# VNX.SI M2 — Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** Draft — chờ Owner duyệt
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M2 (VNX-0201 … VNX-0205, tách nhỏ thành 9 task)
- **Nhánh:** `feat/m2-builder` (tách từ `main` @ `368cc1a`)

**Goal:** Builder đăng ký được (có hoặc không có invite), sửa hồ sơ và portfolio trong Builder Hub, có trang công khai `/b/:handle`; admin duyệt, từ chối, khóa builder và user, tạo invite link.

**Architecture:**
- Giữ nguyên khung M1: `domain/` thuần (state machine, zod), `db/` chỉ truy vấn, `routes/` ghép, `views/` chỉ trình bày.
- Invite tiêu lượt nguyên tử: `INSERT builders` và `UPDATE invites` chạy chung một `db.batch` (D1 batch là transaction; đã kiểm thực tế: lỗi UNIQUE làm rollback cả lô).
- Mọi chuyển trạng thái dùng `UPDATE … WHERE status = <cũ>`; sai trạng thái → 409; mỗi chuyển ghi `audit_log`.

**Tech Stack:** như M1 (Hono 4.13 JSX, Zod 4, D1, Vitest 4.1 + workers pool 0.22). Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md` mục 5.2 (`/b/:handle`), 5.3, 5.5, 6.1 (`builders`, `portfolio_items`, `invites`), 7.1, 8.2, 8.3, 8.6. ADR-002, ADR-003.

## Quyết định của Owner (2026-10-03)

- **Hạ quyền admin:** `ADMIN_EMAILS` là nguồn sự thật. `markLogin` đặt `is_admin` theo danh sách ở cả hai chiều; `requireAdmin` kiểm thêm danh sách ở mỗi request, nên gỡ email là mất quyền ngay.
- **Handle:** sửa được khi `pending` / `rejected`; khóa khi đã `approved` (và khi `suspended`).
- **Sửa hồ sơ khi đã approved:** lên ngay, không duyệt lại; ghi `audit_log`.

## Global Constraints

- Mọi ràng buộc của plan M0–M1 vẫn áp dụng (phiên bản pin, không thêm dependency, ranh giới module, Origin check).
- Migration mới: `apps/web/migrations/0004_builders.sql`, chỉ thêm. Không chạy migration remote, không deploy.
- **Handle:** 3–30 ký tự `a-z0-9-`, bắt đầu và kết thúc bằng chữ hoặc số; chuẩn hóa `trim` + lowercase; chặn danh sách `RESERVED_HANDLES` (Task 1).
- **Giới hạn trường hồ sơ:** name ≤ 80, headline ≤ 120, bio ≤ 2000 (văn bản thuần), skills 1–15 mục, ai_tools 0–15 mục, mỗi mục ≤ 40 ký tự; `work_languages` ⊂ {`en`,`vi`,`zh`}; giá theo giờ 1–10000 USD (lưu cent); country là mã ISO 3166-1 alpha-2 (249 mã).
- **URL do người dùng nhập:** chỉ `https://`, không có user/password; link ra ngoài có `rel="nofollow ugc noopener"`.
- **Portfolio:** tối đa 12 mục / builder (`MAX_PORTFOLIO_ITEMS`); title ≤ 80, description ≤ 500. Chưa có ảnh (R2 đến M3); `image_key` luôn null.
- **Invite:** code = `randomToken(16)` (22 ký tự base64url), DB chỉ lưu SHA-256. Cookie `__Host-vnx_invite` chứa **hash**, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 3600. Lượt chỉ bị trừ khi bản ghi builder được tạo. Link chỉ hiện một lần cho admin, không ghi vào log hay audit.
- **State machine builder (spec 7.1):** pending→approved (admin), pending→rejected (admin), approved→suspended (admin), suspended→approved (admin), rejected→pending (owner). Builder `suspended`: Hub chỉ đọc, mọi POST sửa → 409.
- **Builder công khai** = `builders.status = 'approved'` **và** `users.status = 'active'`; còn lại `/b/:handle` → 404.
- **Chưa render** ô đếm product / inquiry / lời mời trong Hub, danh sách product và nút Hire trên `/b/:handle`: các phần đó đến ở M3, M5, M6. Không để nút chết.
- Email quyết định builder (duyệt / từ chối) gửi theo `users.locale`; gửi lỗi không hoàn tác quyết định, admin thấy thông báo.
- Test admin luôn dùng `owner@vnx.si` (có trong `ADMIN_EMAILS` của `vitest.config.ts`).
- Chuỗi giao diện qua `t()`; key mới có đủ 4 file locale (test parity).

## Review Focus

1. **Invite bị dùng đồng thời hoặc handle trùng:** invite 1 lượt chỉ duyệt được 1 builder; khi INSERT lỗi (handle trùng), lượt invite không bị trừ. Test ở Task 1 và Task 3.
2. **Handle lạ:** `"  Lan-Dev "`, `lân`, `lan dev`, `-lan`, `lan-`, `admin`, 31 ký tự: chuẩn hóa hoặc bị từ chối đúng lỗi. Test ở Task 1.
3. **Văn bản và URL độc hại:** bio chứa `<script>`, website `javascript:…` hoặc `http://…`: escape khi render, URL bị từ chối; link ra ngoài có `nofollow ugc noopener`. Test ở Task 1 và Task 6.
4. **Đụng tài nguyên của người khác:** id portfolio của builder khác → 404 và không bị sửa/xóa. Test ở Task 5.
5. **Builder không công khai truy cập trực tiếp:** pending / rejected / suspended / user bị khóa → `/b/:handle` 404, không lộ là tồn tại. Test ở Task 6 và Task 9.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-0201 | Migration, state machine, input, `db/builders`, `db/invites`, test sở hữu bảng | — |
| 2 | VNX-0202a | `/join/:code`, invite đi kèm magic link, `requireUser` giữ query | 1 |
| 3 | VNX-0202b | `/hub/apply`, `requireBuilder`, form builder | 2 |
| 4 | VNX-0203a | Khung Hub, tổng quan, sửa hồ sơ, gửi duyệt lại | 3 |
| 5 | VNX-0203b | Portfolio (≤12) | 4 |
| 6 | VNX-0204 | Trang công khai `/b/:handle` | 5 |
| 7 | VNX-0205a | Admin: hàng chờ builder, duyệt/từ chối, email | 6 |
| 8 | VNX-0205b | Admin: invite link + test cổng ra M2 | 7 |
| 9 | VNX-0205c | Admin: khóa/mở khóa builder và user; đồng bộ quyền admin | 8 |

Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`. Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By` theo cấu hình phiên.

---

### Task 1: VNX-0201 — Dữ liệu và domain builder

**Files:**
- Create: `apps/web/migrations/0004_builders.sql`
- Create: `apps/web/src/domain/builder.ts`, `apps/web/src/domain/countries.ts`, `apps/web/src/domain/builder-input.ts`, `apps/web/src/domain/invite.ts`
- Create: `apps/web/src/db/builders.ts`, `apps/web/src/db/invites.ts`
- Create: `apps/web/test/fixtures.ts`
- Modify: `apps/web/test/architecture.test.ts`
- Test: `apps/web/test/domain/builder.test.ts`, `apps/web/test/domain/builder-input.test.ts`, `apps/web/test/db/builders.test.ts`

**Interfaces:**
- Consumes: `ulid` (`src/lib/ulid.ts`), `createUser`/`findUserByEmail`/`UserRow` (`src/db/users.ts`), `sha256Hex` (`src/auth/crypto.ts`, chỉ trong test).
- Produces:
  - `domain/builder.ts`: `BUILDER_KINDS`, `AVAILABILITIES`, `WORK_LANGUAGES`, `BUILDER_STATUSES`; type `BuilderKind`, `Availability`, `WorkLanguage`, `BuilderStatus`, `BuilderProfile`, `Builder`, `BuilderAccount`, `BuilderAction`, `BuilderActor`; `transition(status, action, actor)`, `isBuilderStatus(v)`, `canEditProfile(status)`, `canChangeHandle(status)`.
  - `domain/builder-input.ts`: `RESERVED_HANDLES`, `HANDLE_RE`, type `BuilderFormValues`, `BuilderField`, `FieldError`, `FieldErrors`; `formValuesFromBody(body)`, `formValuesFromProfile(profile)`, `parseBuilderProfile(values)`, `isHttpsUrl(v)`.
  - `domain/countries.ts`: `COUNTRY_CODES`, `isCountryCode(v)`.
  - `domain/invite.ts`: `INVITE_CODE_RE`, type `Invite`, `InviteState`; `inviteState(invite, now)`.
  - `db/builders.ts`: `findBuilderByUserId`, `findBuilderByHandle`, `createBuilder` → `CreateBuilderResult`, `updateBuilderProfile` → `"ok" | "handle_taken" | "stale"`, `setBuilderStatus` → `Builder | null`.
  - `db/invites.ts`: `createInvite`, `findInvite`, `listInvites`, `consumeInviteStatement`.
  - `test/fixtures.ts`: `ensureUser`, `profileValues`, `profileOf`, `makeBuilder`.

- [ ] **Step 1: Viết migration**

`apps/web/migrations/0004_builders.sql`:

```sql
-- Wave 1 builders (spec §6.1, §7.1). Additive only.
CREATE TABLE invites (
  code_hash  TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users (id),
  max_uses   INTEGER NOT NULL CHECK (max_uses BETWEEN 1 AND 1000),
  uses       INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE builders (
  user_id           TEXT PRIMARY KEY REFERENCES users (id),
  handle            TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('individual', 'team', 'company')),
  headline          TEXT NOT NULL,
  bio               TEXT NOT NULL,
  country           TEXT NOT NULL,
  website_url       TEXT,
  skills            TEXT NOT NULL DEFAULT '[]',
  ai_tools          TEXT NOT NULL DEFAULT '[]',
  work_languages    TEXT NOT NULL DEFAULT '[]',
  availability      TEXT NOT NULL CHECK (availability IN ('open', 'limited', 'closed')),
  hourly_rate_cents INTEGER CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  status            TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  review_note       TEXT,
  invite_code_hash  TEXT,
  approved_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_builders_status ON builders (status, created_at);

CREATE TABLE portfolio_items (
  id          TEXT PRIMARY KEY,
  builder_id  TEXT NOT NULL REFERENCES builders (user_id),
  title       TEXT NOT NULL,
  url         TEXT,
  description TEXT NOT NULL DEFAULT '',
  image_key   TEXT,
  sort        INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_portfolio_builder ON portfolio_items (builder_id, sort);
```

- [ ] **Step 2: Viết test domain (fail)**

`apps/web/test/domain/builder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BUILDER_STATUSES, canChangeHandle, canEditProfile, transition, type BuilderAction } from "../../src/domain/builder.ts";
import { inviteState } from "../../src/domain/invite.ts";

describe("builder state machine (spec §7.1)", () => {
  it.each([
    ["pending", "approve", "admin", "approved"],
    ["pending", "reject", "admin", "rejected"],
    ["approved", "suspend", "admin", "suspended"],
    ["suspended", "unsuspend", "admin", "approved"],
    ["rejected", "resubmit", "owner", "pending"],
  ] as const)("%s --%s by %s--> %s", (from, action, actor, to) => {
    expect(transition(from, action, actor)).toEqual({ ok: true, status: to });
  });

  it("rejects every other combination", () => {
    const valid = new Set(["pending:approve:admin", "pending:reject:admin", "approved:suspend:admin", "suspended:unsuspend:admin", "rejected:resubmit:owner"]);
    const actions: BuilderAction[] = ["approve", "reject", "suspend", "unsuspend", "resubmit"];
    for (const status of BUILDER_STATUSES) {
      for (const action of actions) {
        for (const actor of ["admin", "owner"] as const) {
          if (valid.has(`${status}:${action}:${actor}`)) continue;
          expect(transition(status, action, actor), `${status}:${action}:${actor}`).toEqual({ ok: false, error: "invalid_transition" });
        }
      }
    }
  });

  it("locks the handle after approval and all edits while suspended", () => {
    expect(BUILDER_STATUSES.filter((s) => canChangeHandle(s))).toEqual(["pending", "rejected"]);
    expect(BUILDER_STATUSES.filter((s) => canEditProfile(s))).toEqual(["pending", "approved", "rejected"]);
  });
});

describe("invite state", () => {
  const now = new Date("2026-10-03T10:00:00.000Z");
  it("is active, used up or expired", () => {
    expect(inviteState({ uses: 0, maxUses: 1, expiresAt: "2026-10-04T00:00:00.000Z" }, now)).toBe("active");
    expect(inviteState({ uses: 1, maxUses: 1, expiresAt: "2026-10-04T00:00:00.000Z" }, now)).toBe("used_up");
    expect(inviteState({ uses: 0, maxUses: 1, expiresAt: "2026-10-03T10:00:00.000Z" }, now)).toBe("expired");
  });
});
```

`apps/web/test/domain/builder-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formValuesFromBody, formValuesFromProfile, parseBuilderProfile } from "../../src/domain/builder-input.ts";
import { COUNTRY_CODES, isCountryCode } from "../../src/domain/countries.ts";
import { profileValues } from "../fixtures.ts";

const parse = (o: Parameters<typeof profileValues>[0] = {}) => parseBuilderProfile(profileValues(o));

describe("builder profile input", () => {
  it("normalizes a valid profile", () => {
    expect(parse({ handle: "  Lan-Dev ", skills: "Next.js, supabase , Next.js,,", websiteUrl: "", country: "vn", workLanguages: ["vi", "vi", "en"] })).toEqual({
      ok: true,
      profile: {
        handle: "lan-dev",
        name: "Lan Nguyen",
        kind: "individual",
        headline: "I build booking apps with AI",
        bio: "Ten years of web work.\n\n- Booking\n- CRM",
        country: "VN",
        websiteUrl: null,
        skills: ["Next.js", "supabase"],
        aiTools: ["Claude Code"],
        workLanguages: ["vi", "en"],
        availability: "open",
        hourlyRateCents: 4500,
      },
    });
  });

  it.each(["ab", "-lan", "lan-", "lan dev", "lân", "a".repeat(31), "lan_dev", "LAN!"])("rejects handle %j", (handle) => {
    expect(parse({ handle })).toEqual({ ok: false, errors: { handle: "invalid" } });
  });

  it.each(["admin", "hub", "api", "zh-hans"])("rejects reserved handle %s", (handle) => {
    expect(parse({ handle })).toEqual({ ok: false, errors: { handle: "reserved" } });
  });

  it("accepts only https website URLs", () => {
    for (const websiteUrl of ["http://lan.dev", "javascript:alert(1)", "lan.dev", "https://user:pw@lan.dev", "ftp://lan.dev"]) {
      expect(parse({ websiteUrl }), websiteUrl).toEqual({ ok: false, errors: { websiteUrl: "invalid" } });
    }
    expect(parse({ websiteUrl: "https://lan.dev/work" })).toMatchObject({ ok: true, profile: { websiteUrl: "https://lan.dev/work" } });
  });

  it("requires one skill and caps list sizes", () => {
    expect(parse({ skills: " , " })).toEqual({ ok: false, errors: { skills: "invalid" } });
    expect(parse({ skills: Array.from({ length: 16 }, (_, i) => `s${i}`).join(",") })).toEqual({ ok: false, errors: { skills: "invalid" } });
    expect(parse({ aiTools: "x".repeat(41) })).toEqual({ ok: false, errors: { aiTools: "invalid" } });
  });

  it("validates enums, country, rate and lengths together", () => {
    expect(
      parse({ kind: "agency", availability: "busy", country: "XX", hourlyRate: "0", name: "", headline: "h".repeat(121), bio: " ", workLanguages: ["fr"] }),
    ).toEqual({
      ok: false,
      errors: { kind: "invalid", availability: "invalid", country: "invalid", hourlyRate: "invalid", name: "invalid", headline: "invalid", bio: "invalid", workLanguages: "invalid" },
    });
    expect(parse({ hourlyRate: "10001" })).toEqual({ ok: false, errors: { hourlyRate: "invalid" } });
    expect(parse({ hourlyRate: "10000" })).toMatchObject({ ok: true, profile: { hourlyRateCents: 1_000_000 } });
    expect(parse({ hourlyRate: "" })).toMatchObject({ ok: true, profile: { hourlyRateCents: null } });
  });

  it("round-trips through form values", () => {
    const first = parse();
    if (!first.ok) throw new Error("fixture must be valid");
    expect(parseBuilderProfile(formValuesFromProfile(first.profile))).toEqual(first);
  });

  it("reads single checkboxes and missing fields from a form body", () => {
    expect(formValuesFromBody({ workLanguages: "vi" }).workLanguages).toEqual(["vi"]);
    expect(formValuesFromBody({})).toMatchObject({ handle: "", workLanguages: [], hourlyRate: "" });
  });

  it("knows the 249 ISO 3166-1 alpha-2 codes", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(isCountryCode("VN")).toBe(true);
    expect(isCountryCode("TW")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("vn")).toBe(false);
  });
});
```

`apps/web/test/fixtures.ts`:

```ts
import { createBuilder, setBuilderStatus } from "../src/db/builders.ts";
import { createUser, findUserByEmail, type UserRow } from "../src/db/users.ts";
import type { Builder, BuilderProfile, BuilderStatus } from "../src/domain/builder.ts";
import { parseBuilderProfile, type BuilderFormValues } from "../src/domain/builder-input.ts";
import { testEnv } from "./helpers.ts";

export function profileValues(overrides: Partial<BuilderFormValues> = {}): BuilderFormValues {
  return {
    handle: "lan-dev",
    name: "Lan Nguyen",
    kind: "individual",
    headline: "I build booking apps with AI",
    bio: "Ten years of web work.\n\n- Booking\n- CRM",
    country: "VN",
    websiteUrl: "https://lan.dev",
    skills: "Next.js, Supabase",
    aiTools: "Claude Code",
    workLanguages: ["en", "vi"],
    availability: "open",
    hourlyRate: "45",
    ...overrides,
  };
}

export function profileOf(overrides: Partial<BuilderFormValues> = {}): BuilderProfile {
  const result = parseBuilderProfile(profileValues(overrides));
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result.errors)}`);
  return result.profile;
}

export async function ensureUser(email: string, locale = "en"): Promise<UserRow> {
  return (await findUserByEmail(testEnv.DB, email)) ?? (await createUser(testEnv.DB, { email, locale, now: new Date().toISOString() }));
}

/** Creates a builder (no invite) and moves it to `status` directly in the DB. */
export async function makeBuilder(email: string, handle: string, status: BuilderStatus = "pending", overrides: Partial<BuilderFormValues> = {}): Promise<Builder> {
  const user = await ensureUser(email);
  const now = new Date().toISOString();
  const created = await createBuilder(testEnv.DB, { userId: user.id, profile: profileOf({ handle, ...overrides }), inviteCodeHash: null, now });
  if (!created.ok) throw new Error(created.reason);
  if (status === "pending") return created.builder;
  const moved = await setBuilderStatus(testEnv.DB, { userId: user.id, from: "pending", to: status, reviewNote: status === "rejected" ? "Add a portfolio" : null, now });
  if (!moved) throw new Error("status change failed");
  return moved;
}
```

Run: `npm test -w apps/web -- test/domain/builder.test.ts test/domain/builder-input.test.ts`
Expected: FAIL (module `src/domain/builder.ts` chưa có).

- [ ] **Step 3: Viết domain**

`apps/web/src/domain/builder.ts`:

```ts
export const BUILDER_KINDS = ["individual", "team", "company"] as const;
export type BuilderKind = (typeof BUILDER_KINDS)[number];
export const AVAILABILITIES = ["open", "limited", "closed"] as const;
export type Availability = (typeof AVAILABILITIES)[number];
export const WORK_LANGUAGES = ["en", "vi", "zh"] as const;
export type WorkLanguage = (typeof WORK_LANGUAGES)[number];
export const BUILDER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type BuilderStatus = (typeof BUILDER_STATUSES)[number];

/** The fields a builder edits (spec §5.3, §6.1). */
export interface BuilderProfile {
  handle: string;
  name: string;
  kind: BuilderKind;
  headline: string;
  bio: string;
  country: string;
  websiteUrl: string | null;
  skills: string[];
  aiTools: string[];
  workLanguages: WorkLanguage[];
  availability: Availability;
  hourlyRateCents: number | null;
}

export interface Builder extends BuilderProfile {
  userId: string;
  status: BuilderStatus;
  reviewNote: string | null;
  inviteCodeHash: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A builder joined with its account, for admin screens and e-mail. */
export interface BuilderAccount extends Builder {
  email: string;
  userLocale: string;
  userStatus: "active" | "suspended";
}

export type BuilderAction = "approve" | "reject" | "suspend" | "unsuspend" | "resubmit";
export type BuilderActor = "admin" | "owner";
export type BuilderTransition = { ok: true; status: BuilderStatus } | { ok: false; error: "invalid_transition" };

const RULES: Record<BuilderAction, { from: BuilderStatus; to: BuilderStatus; actor: BuilderActor }> = {
  approve: { from: "pending", to: "approved", actor: "admin" },
  reject: { from: "pending", to: "rejected", actor: "admin" },
  suspend: { from: "approved", to: "suspended", actor: "admin" },
  unsuspend: { from: "suspended", to: "approved", actor: "admin" },
  resubmit: { from: "rejected", to: "pending", actor: "owner" },
};

/** Spec §7.1. The invite path (straight to approved) happens at creation, in db/builders. */
export function transition(status: BuilderStatus, action: BuilderAction, actor: BuilderActor): BuilderTransition {
  const rule = RULES[action];
  if (rule.from !== status || rule.actor !== actor) return { ok: false, error: "invalid_transition" };
  return { ok: true, status: rule.to };
}

export function isBuilderStatus(value: unknown): value is BuilderStatus {
  return (BUILDER_STATUSES as readonly unknown[]).includes(value);
}

/** Suspended builders can read the Hub but not change anything. */
export function canEditProfile(status: BuilderStatus): boolean {
  return status !== "suspended";
}

/** Owner decision 2026-10-03: the handle locks once the profile is approved. */
export function canChangeHandle(status: BuilderStatus): boolean {
  return status === "pending" || status === "rejected";
}
```

`apps/web/src/domain/countries.ts`:

```ts
/** ISO 3166-1 alpha-2 codes (spec §6.1 builders.country). Display names come from Intl at render time. */
export const COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const CODES = new Set(COUNTRY_CODES);

export function isCountryCode(value: string): boolean {
  return CODES.has(value);
}
```

`apps/web/src/domain/builder-input.ts`:

```ts
import { z } from "zod";
import { AVAILABILITIES, BUILDER_KINDS, WORK_LANGUAGES, type BuilderProfile } from "./builder.ts";
import { isCountryCode } from "./countries.ts";

/** Handles that would collide with routes, locales or the brand. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "administrator", "api", "app", "assets", "auth", "b", "builder", "builders", "en", "for-builders", "help",
  "hub", "join", "login", "logout", "me", "media", "p", "privacy", "product", "products", "request", "requests",
  "robots", "root", "settings", "signin", "signup", "sitemap", "static", "support", "system", "terms", "vi", "vnx",
  "vnxsi", "www", "zh", "zh-hans", "zh-hant",
]);

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Raw form state, echoed back on validation errors. Lists are comma-separated text. */
export type BuilderFormValues = {
  handle: string;
  name: string;
  kind: string;
  headline: string;
  bio: string;
  country: string;
  websiteUrl: string;
  skills: string;
  aiTools: string;
  workLanguages: string[];
  availability: string;
  hourlyRate: string;
};
export type BuilderField = keyof BuilderFormValues;
export type FieldError = "invalid" | "reserved" | "taken";
export type FieldErrors = Partial<Record<BuilderField, FieldError>>;

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function formValuesFromBody(body: Record<string, unknown>): BuilderFormValues {
  const langs = body.workLanguages;
  const list = Array.isArray(langs) ? langs : langs === undefined ? [] : [langs];
  return {
    handle: str(body.handle),
    name: str(body.name),
    kind: str(body.kind),
    headline: str(body.headline),
    bio: str(body.bio),
    country: str(body.country),
    websiteUrl: str(body.websiteUrl),
    skills: str(body.skills),
    aiTools: str(body.aiTools),
    workLanguages: list.filter((v): v is string => typeof v === "string"),
    availability: str(body.availability),
    hourlyRate: str(body.hourlyRate),
  };
}

export function formValuesFromProfile(p: BuilderProfile): BuilderFormValues {
  return {
    handle: p.handle,
    name: p.name,
    kind: p.kind,
    headline: p.headline,
    bio: p.bio,
    country: p.country,
    websiteUrl: p.websiteUrl ?? "",
    skills: p.skills.join(", "),
    aiTools: p.aiTools.join(", "),
    workLanguages: [...p.workLanguages],
    availability: p.availability,
    hourlyRate: p.hourlyRateCents === null ? "" : String(p.hourlyRateCents / 100),
  };
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Splits on commas, trims, drops empties and case-insensitive duplicates. */
function csv(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const item = part.trim();
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push(item);
    }
  }
  return out;
}

const textList = (min: number) => z.array(z.string().max(40)).min(min).max(15);

const Schema = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(BUILDER_KINDS),
  headline: z.string().trim().min(1).max(120),
  bio: z.string().trim().min(1).max(2000),
  country: z.string().trim().toUpperCase().refine(isCountryCode),
  websiteUrl: z.string().trim().max(500).refine((v) => v === "" || isHttpsUrl(v)),
  skills: z.string().max(1000).transform(csv).pipe(textList(1)),
  aiTools: z.string().max(1000).transform(csv).pipe(textList(0)),
  workLanguages: z.array(z.enum(WORK_LANGUAGES)).max(3),
  availability: z.enum(AVAILABILITIES),
  hourlyRate: z.string().trim().regex(/^(|[1-9]\d{0,4})$/).refine((v) => v === "" || Number(v) <= 10000),
});

export function parseBuilderProfile(values: BuilderFormValues): { ok: true; profile: BuilderProfile } | { ok: false; errors: FieldErrors } {
  const result = Schema.safeParse(values);
  const errors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) errors[issue.path[0] as BuilderField] ??= "invalid";
  }
  if (!errors.handle && RESERVED_HANDLES.has(values.handle.trim().toLowerCase())) errors.handle = "reserved";
  if (!result.success || errors.handle) return { ok: false, errors };
  const d = result.data;
  return {
    ok: true,
    profile: {
      handle: d.handle,
      name: d.name,
      kind: d.kind,
      headline: d.headline,
      bio: d.bio,
      country: d.country,
      websiteUrl: d.websiteUrl || null,
      skills: d.skills,
      aiTools: d.aiTools,
      workLanguages: [...new Set(d.workLanguages)],
      availability: d.availability,
      hourlyRateCents: d.hourlyRate ? Number(d.hourlyRate) * 100 : null,
    },
  };
}
```

`apps/web/src/domain/invite.ts`:

```ts
/** randomToken(16) → 22 base64url characters. */
export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{22}$/;

export interface Invite {
  codeHash: string;
  createdBy: string;
  maxUses: number;
  uses: number;
  expiresAt: string;
  note: string | null;
  createdAt: string;
}

export type InviteState = "active" | "expired" | "used_up";

export function inviteState(invite: Pick<Invite, "uses" | "maxUses" | "expiresAt">, now: Date): InviteState {
  if (invite.uses >= invite.maxUses) return "used_up";
  if (invite.expiresAt <= now.toISOString()) return "expired";
  return "active";
}
```

Run: `npm test -w apps/web -- test/domain/builder.test.ts test/domain/builder-input.test.ts`
Expected: test domain PASS. (`fixtures.ts` import `db/builders.ts` chưa có → nếu Vitest báo lỗi import thì làm tiếp Step 4–5 rồi chạy lại.)

- [ ] **Step 4: Viết test DB và test sở hữu bảng (fail)**

`apps/web/test/db/builders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { createBuilder, findBuilderByHandle, findBuilderByUserId, setBuilderStatus, updateBuilderProfile } from "../../src/db/builders.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import { ensureUser, profileOf } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-03T10:00:00.000Z";
const LATER = "2026-10-04T10:00:00.000Z";
const db = () => testEnv.DB;

async function invite(code: string, o: { maxUses?: number; expiresAt?: string } = {}): Promise<string> {
  const admin = await ensureUser("db-inviter@vnx.si");
  const codeHash = await sha256Hex(code);
  await createInvite(db(), { codeHash, createdBy: admin.id, maxUses: o.maxUses ?? 1, expiresAt: o.expiresAt ?? LATER, note: null, now: NOW });
  return codeHash;
}

async function build(email: string, handle: string, inviteCodeHash: string | null = null) {
  const user = await ensureUser(email);
  return { user, result: await createBuilder(db(), { userId: user.id, profile: profileOf({ handle }), inviteCodeHash, now: NOW }) };
}

describe("db/builders", () => {
  it("creates a pending builder without an invite and stores lists as JSON", async () => {
    const { user, result } = await build("db-b1@vnx.si", "db-one");
    expect(result).toMatchObject({ ok: true, builder: { status: "pending", handle: "db-one", skills: ["Next.js", "Supabase"], workLanguages: ["en", "vi"], hourlyRateCents: 4500, inviteCodeHash: null, approvedAt: null } });
    expect(await findBuilderByHandle(db(), "db-one")).toMatchObject({ userId: user.id });
    const raw = await db().prepare("SELECT skills FROM builders WHERE user_id = ?1").bind(user.id).first<{ skills: string }>();
    expect(raw?.skills).toBe('["Next.js","Supabase"]');
  });

  it("approves right away with a usable invite and spends one use", async () => {
    const hash = await invite("db-code-ok");
    const { result } = await build("db-b2@vnx.si", "db-two", hash);
    expect(result).toMatchObject({ ok: true, builder: { status: "approved", inviteCodeHash: hash, approvedAt: NOW } });
    expect((await findInvite(db(), hash))?.uses).toBe(1);
  });

  it("falls back to pending with a used-up or expired invite and does not spend it", async () => {
    const used = await invite("db-code-used", { maxUses: 1 });
    await build("db-b3@vnx.si", "db-three", used);
    const { result } = await build("db-b4@vnx.si", "db-four", used);
    expect(result).toMatchObject({ ok: true, builder: { status: "pending", inviteCodeHash: null, approvedAt: null } });
    expect((await findInvite(db(), used))?.uses).toBe(1);

    const expired = await invite("db-code-expired", { expiresAt: NOW });
    const second = await build("db-b5@vnx.si", "db-five", expired);
    expect(second.result).toMatchObject({ ok: true, builder: { status: "pending" } });
    expect((await findInvite(db(), expired))?.uses).toBe(0);
  });

  it("reports a taken handle and rolls back the invite use", async () => {
    const hash = await invite("db-code-rollback", { maxUses: 5 });
    await build("db-b6@vnx.si", "db-same");
    const { user, result } = await build("db-b7@vnx.si", "db-same", hash);
    expect(result).toEqual({ ok: false, reason: "handle_taken" });
    expect((await findInvite(db(), hash))?.uses).toBe(0);
    expect(await findBuilderByUserId(db(), user.id)).toBeNull();
  });

  it("refuses a second builder for the same user", async () => {
    await build("db-b8@vnx.si", "db-eight");
    const { result } = await build("db-b8@vnx.si", "db-eight-2");
    expect(result).toEqual({ ok: false, reason: "already_builder" });
  });

  it("updates a profile only while the status is the expected one", async () => {
    const { user } = await build("db-b9@vnx.si", "db-nine");
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "pending", profile: profileOf({ handle: "db-nine-x", name: "New Name" }), now: LATER })).toBe("ok");
    expect(await findBuilderByUserId(db(), user.id)).toMatchObject({ handle: "db-nine-x", name: "New Name", updatedAt: LATER });
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "approved", profile: profileOf({ handle: "db-nine-x" }), now: LATER })).toBe("stale");
    await build("db-b10@vnx.si", "db-ten");
    expect(await updateBuilderProfile(db(), { userId: user.id, expectedStatus: "pending", profile: profileOf({ handle: "db-ten" }), now: LATER })).toBe("handle_taken");
  });

  it("changes status atomically and keeps the first approval time", async () => {
    const { user } = await build("db-b11@vnx.si", "db-eleven");
    expect(await setBuilderStatus(db(), { userId: user.id, from: "pending", to: "approved", reviewNote: null, now: NOW })).toMatchObject({ status: "approved", approvedAt: NOW });
    expect(await setBuilderStatus(db(), { userId: user.id, from: "pending", to: "rejected", reviewNote: "x", now: LATER })).toBeNull();
    expect(await setBuilderStatus(db(), { userId: user.id, from: "approved", to: "suspended", reviewNote: "spam", now: LATER })).toMatchObject({ status: "suspended", reviewNote: "spam" });
    expect(await setBuilderStatus(db(), { userId: user.id, from: "suspended", to: "approved", reviewNote: null, now: LATER })).toMatchObject({ approvedAt: NOW, reviewNote: null });
  });
});
```

Sửa `apps/web/test/architecture.test.ts`: thêm khối sau vào cuối file (giữ nguyên 2 test cũ):

```ts
const sources = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

// Each table is written (INSERT/UPDATE/DELETE) by exactly one module. Reads may join freely.
const WRITERS: Record<string, string> = {
  users: "../src/db/users.ts",
  sessions: "../src/auth/sessions.ts",
  login_tokens: "../src/auth/tokens.ts",
  rate_limits: "../src/http/rate-limit.ts",
  audit_log: "../src/db/audit.ts",
  waitlist: "../src/routes/waitlist.ts",
  builders: "../src/db/builders.ts",
  invites: "../src/db/invites.ts",
  portfolio_items: "../src/db/portfolio.ts",
};

describe("table ownership (VNX-0201)", () => {
  it("writes each table only from its owning module", () => {
    for (const [file, src] of Object.entries(sources)) {
      // SQL keywords are upper case and table names lower case by convention, so prose does not match.
      for (const match of src.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/g)) {
        const table = match[1] ?? "";
        expect(WRITERS[table], `${file} writes unknown table ${table}`).toBeDefined();
        expect(file, `${table} is written outside its module`).toBe(WRITERS[table]);
      }
    }
  });
});
```

Run: `npm test -w apps/web -- test/db/builders.test.ts test/architecture.test.ts`
Expected: FAIL (`src/db/builders.ts` chưa có).

- [ ] **Step 5: Viết `db/invites.ts` và `db/builders.ts`**

`apps/web/src/db/invites.ts`:

```ts
import type { Invite } from "../domain/invite.ts";

type Row = { code_hash: string; created_by: string; max_uses: number; uses: number; expires_at: string; note: string | null; created_at: string };

function toInvite(r: Row): Invite {
  return { codeHash: r.code_hash, createdBy: r.created_by, maxUses: r.max_uses, uses: r.uses, expiresAt: r.expires_at, note: r.note, createdAt: r.created_at };
}

export async function createInvite(
  db: D1Database,
  input: { codeHash: string; createdBy: string; maxUses: number; expiresAt: string; note: string | null; now: string },
): Promise<void> {
  await db
    .prepare("INSERT INTO invites (code_hash, created_by, max_uses, uses, expires_at, note, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?6)")
    .bind(input.codeHash, input.createdBy, input.maxUses, input.expiresAt, input.note, input.now)
    .run();
}

export async function findInvite(db: D1Database, codeHash: string): Promise<Invite | null> {
  const row = await db.prepare("SELECT * FROM invites WHERE code_hash = ?1").bind(codeHash).first<Row>();
  return row ? toInvite(row) : null;
}

export async function listInvites(db: D1Database, limit = 100): Promise<Invite[]> {
  const { results } = await db.prepare("SELECT * FROM invites ORDER BY created_at DESC LIMIT ?1").bind(limit).all<Row>();
  return results.map(toInvite);
}

/**
 * Spends one use, but only if the builder row written earlier in the same batch recorded this invite.
 * Used by createBuilder inside db.batch, so both statements commit or roll back together.
 */
export function consumeInviteStatement(db: D1Database, codeHash: string, userId: string, now: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE invites SET uses = uses + 1, updated_at = ?3
       WHERE code_hash = ?1 AND uses < max_uses AND expires_at > ?3
         AND EXISTS (SELECT 1 FROM builders WHERE user_id = ?2 AND invite_code_hash = ?1)`,
    )
    .bind(codeHash, userId, now);
}
```

`apps/web/src/db/builders.ts`:

```ts
import type { Builder, BuilderProfile, BuilderStatus } from "../domain/builder.ts";
import { consumeInviteStatement } from "./invites.ts";

export type BuilderRow = {
  user_id: string;
  handle: string;
  name: string;
  kind: Builder["kind"];
  headline: string;
  bio: string;
  country: string;
  website_url: string | null;
  skills: string;
  ai_tools: string;
  work_languages: string;
  availability: Builder["availability"];
  hourly_rate_cents: number | null;
  status: BuilderStatus;
  review_note: string | null;
  invite_code_hash: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

function jsonList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toBuilder(r: BuilderRow): Builder {
  return {
    userId: r.user_id,
    handle: r.handle,
    name: r.name,
    kind: r.kind,
    headline: r.headline,
    bio: r.bio,
    country: r.country,
    websiteUrl: r.website_url,
    skills: jsonList(r.skills),
    aiTools: jsonList(r.ai_tools),
    workLanguages: jsonList(r.work_languages) as Builder["workLanguages"],
    availability: r.availability,
    hourlyRateCents: r.hourly_rate_cents,
    status: r.status,
    reviewNote: r.review_note,
    inviteCodeHash: r.invite_code_hash,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function findBuilderByUserId(db: D1Database, userId: string): Promise<Builder | null> {
  const row = await db.prepare("SELECT * FROM builders WHERE user_id = ?1").bind(userId).first<BuilderRow>();
  return row ? toBuilder(row) : null;
}

export async function findBuilderByHandle(db: D1Database, handle: string): Promise<Builder | null> {
  const row = await db.prepare("SELECT * FROM builders WHERE handle = ?1").bind(handle).first<BuilderRow>();
  return row ? toBuilder(row) : null;
}

export type CreateBuilderResult = { ok: true; builder: Builder } | { ok: false; reason: "handle_taken" | "already_builder" };

/**
 * Inserts the builder and, in the same D1 transaction, spends one use of the invite.
 * A usable invite makes the builder approved; otherwise it starts pending (spec §5.3).
 */
export async function createBuilder(
  db: D1Database,
  input: { userId: string; profile: BuilderProfile; inviteCodeHash: string | null; now: string },
): Promise<CreateBuilderResult> {
  const p = input.profile;
  const insert = db
    .prepare(
      `INSERT INTO builders (user_id, handle, name, kind, headline, bio, country, website_url, skills, ai_tools, work_languages,
         availability, hourly_rate_cents, status, invite_code_hash, approved_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
         CASE WHEN v.ok THEN 'approved' ELSE 'pending' END,
         CASE WHEN v.ok THEN ?14 END,
         CASE WHEN v.ok THEN ?15 END,
         ?15, ?15
       FROM (SELECT EXISTS (SELECT 1 FROM invites WHERE code_hash = ?14 AND uses < max_uses AND expires_at > ?15) AS ok) AS v`,
    )
    .bind(
      input.userId,
      p.handle,
      p.name,
      p.kind,
      p.headline,
      p.bio,
      p.country,
      p.websiteUrl,
      JSON.stringify(p.skills),
      JSON.stringify(p.aiTools),
      JSON.stringify(p.workLanguages),
      p.availability,
      p.hourlyRateCents,
      input.inviteCodeHash,
      input.now,
    );
  try {
    if (input.inviteCodeHash) await db.batch([insert, consumeInviteStatement(db, input.inviteCodeHash, input.userId, input.now)]);
    else await insert.run();
  } catch (err) {
    const message = String(err);
    if (message.includes("builders.handle")) return { ok: false, reason: "handle_taken" };
    if (message.includes("builders.user_id")) return { ok: false, reason: "already_builder" };
    throw err;
  }
  const builder = await findBuilderByUserId(db, input.userId);
  if (!builder) throw new Error("builder insert failed");
  return { ok: true, builder };
}

export type UpdateProfileResult = "ok" | "handle_taken" | "stale";

/** Writes the profile only if the status is still `expectedStatus` (guards against a concurrent admin decision). */
export async function updateBuilderProfile(
  db: D1Database,
  input: { userId: string; expectedStatus: BuilderStatus; profile: BuilderProfile; now: string },
): Promise<UpdateProfileResult> {
  const p = input.profile;
  try {
    const res = await db
      .prepare(
        `UPDATE builders SET handle = ?3, name = ?4, kind = ?5, headline = ?6, bio = ?7, country = ?8, website_url = ?9,
           skills = ?10, ai_tools = ?11, work_languages = ?12, availability = ?13, hourly_rate_cents = ?14, updated_at = ?15
         WHERE user_id = ?1 AND status = ?2`,
      )
      .bind(
        input.userId,
        input.expectedStatus,
        p.handle,
        p.name,
        p.kind,
        p.headline,
        p.bio,
        p.country,
        p.websiteUrl,
        JSON.stringify(p.skills),
        JSON.stringify(p.aiTools),
        JSON.stringify(p.workLanguages),
        p.availability,
        p.hourlyRateCents,
        input.now,
      )
      .run();
    return res.meta.changes === 1 ? "ok" : "stale";
  } catch (err) {
    if (String(err).includes("builders.handle")) return "handle_taken";
    throw err;
  }
}

/** Compare-and-set on status. Returns null when the builder is no longer in `from`. */
export async function setBuilderStatus(
  db: D1Database,
  input: { userId: string; from: BuilderStatus; to: BuilderStatus; reviewNote: string | null; now: string },
): Promise<Builder | null> {
  const row = await db
    .prepare(
      `UPDATE builders SET status = ?3, review_note = ?4, updated_at = ?5,
         approved_at = CASE WHEN ?3 = 'approved' THEN COALESCE(approved_at, ?5) ELSE approved_at END
       WHERE user_id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.userId, input.from, input.to, input.reviewNote, input.now)
    .first<BuilderRow>();
  return row ? toBuilder(row) : null;
}
```

- [ ] **Step 6: Chạy toàn bộ**

Run: `npm run typecheck -w apps/web && npm test`
Expected: typecheck sạch; mọi test PASS (gồm 89 test M1).

- [ ] **Step 7: Commit**

```bash
git add apps/web/migrations/0004_builders.sql apps/web/src/domain apps/web/src/db/builders.ts apps/web/src/db/invites.ts apps/web/test
git commit -m "feat(web): builders, invites and portfolio tables with builder state machine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: VNX-0202a — Invite link đi qua magic link

**Files:**
- Create: `apps/web/src/auth/invite-cookie.ts`, `apps/web/src/routes/join.ts`
- Modify: `apps/web/src/routes/auth.tsx`, `apps/web/src/auth/middleware.ts`, `apps/web/src/app.ts`
- Modify: `apps/web/test/helpers.ts`, `apps/web/test/fixtures.ts`
- Test: `apps/web/test/auth/invite-flow.test.ts`, `apps/web/test/auth/require-user.test.ts`

**Interfaces:**
- Consumes: `INVITE_CODE_RE` (Task 1), `sha256Hex`, `createLoginToken({ …, inviteCodeHash })`, `ConsumedToken.inviteCodeHash` (M1), `onLocalized`, `localizedPath`, `errorResponse`.
- Produces:
  - `auth/invite-cookie.ts`: `INVITE_COOKIE = "__Host-vnx_invite"`, `readInviteCookie(c): string | null` (chỉ trả hash hex 64 ký tự), `writeInviteCookie(c, codeHash)`, `clearInviteCookie(c)`.
  - `routes/join.ts`: `registerJoinRoutes(app)`.
  - `requireUser` / `requireAdmin` đưa cả query string vào `next`.
  - Test helpers: `formPost` nhận giá trị `string | string[]`; `getReq(path, cookie?)`; `setCookieValue(res, name)`; fixture `signIn(email, { admin?, locale? })`.

- [ ] **Step 1: Mở rộng test helpers**

Thay `apps/web/test/helpers.ts` bằng:

```ts
import { env } from "cloudflare:workers";
import type { Bindings } from "../src/env.ts";

export const testEnv = env as unknown as Bindings;

export function formPost(path: string, fields: Record<string, string | string[]>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) body.append(key, v);
  }
  return new Request(`https://vnx.si${path}`, {
    method: "POST",
    headers: { origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

export function getReq(path: string, cookie?: string) {
  return new Request(`https://vnx.si${path}`, { headers: cookie ? { cookie } : {} });
}

/** Value of a cookie set by the response, or null. */
export function setCookieValue(res: Response, name: string): string | null {
  for (const line of res.headers.getSetCookie()) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1).split(";")[0] ?? "";
  }
  return null;
}
```

Thêm vào cuối `apps/web/test/fixtures.ts` (và thêm `import { createSession } from "../src/auth/sessions.ts";` ở đầu file):

```ts
/** Creates (or reuses) a user and a live session; returns the Cookie header value. */
export async function signIn(email: string, opts: { admin?: boolean; locale?: string } = {}): Promise<{ user: UserRow; cookie: string }> {
  const user = await ensureUser(email, opts.locale);
  if (opts.admin) await testEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?1").bind(user.id).run();
  return { user, cookie: `__Host-vnx_session=${await createSession(testEnv.DB, user.id, new Date())}` };
}
```

- [ ] **Step 2: Viết test (fail)**

`apps/web/test/auth/require-user.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireUser, sessionMiddleware } from "../../src/auth/middleware.ts";
import type { AppEnv } from "../../src/env.ts";
import { safeNext } from "../../src/http/next.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { testEnv } from "../helpers.ts";

const app = new Hono<AppEnv>();
app.use("*", localeMiddleware, sessionMiddleware);
app.get("/vi/hub/x", requireUser, (c) => c.text("ok"));

describe("requireUser", () => {
  it("keeps the query string in next, and safeNext accepts it", async () => {
    const res = await app.request("https://vnx.si/vi/hub/x?a=1&b=2", {}, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fhub%2Fx%3Fa%3D1%26b%3D2");
    expect(safeNext("/vi/hub/x?a=1&b=2")).toBe("/vi/hub/x?a=1&b=2");
  });
});
```

`apps/web/test/auth/invite-flow.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

const CODE = "abcdefghijklmnopqrstuv"; // 22 chars, the shape randomToken(16) produces

function tokenFrom(text: string): string {
  const m = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(text);
  if (!m?.[1]) throw new Error("no token in email");
  return m[1];
}

async function tokenInviteHash(email: string) {
  const row = await testEnv.DB.prepare("SELECT invite_code_hash FROM login_tokens WHERE email = ?1").bind(email).first<{ invite_code_hash: string | null }>();
  return row?.invite_code_hash;
}

describe("invite links (spec §5.3)", () => {
  beforeEach(() => clearOutbox());

  it("404s on a malformed code", async () => {
    expect((await createApp().request(getReq("/join/short"), undefined, testEnv)).status).toBe(404);
  });

  it("stores the invite hash in a cookie and sends anonymous visitors to sign in", async () => {
    const res = await createApp().request(getReq(`/join/${CODE}`), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login?next=%2Fhub%2Fapply");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(setCookieValue(res, "__Host-vnx_invite")).toBe(await sha256Hex(CODE));
    const line = res.headers.getSetCookie().find((l) => l.startsWith("__Host-vnx_invite=")) ?? "";
    expect(line).toMatch(/Max-Age=3600/);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/SameSite=Lax/i);
  });

  it("sends signed-in users straight to the application form in their locale", async () => {
    const { cookie } = await signIn("join-signed@vnx.si");
    const res = await createApp().request(getReq(`/vi/join/${CODE}`, cookie), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/hub/apply");
  });

  it("carries the invite through the magic link to another device", async () => {
    const app = createApp();
    const hash = await sha256Hex(CODE);
    await app.request(formPost("/login", { email: "carry@vnx.si", next: "/hub/apply" }, { cookie: `__Host-vnx_invite=${hash}` }), undefined, testEnv);
    expect(await tokenInviteHash("carry@vnx.si")).toBe(hash);
    // The e-mail is opened on a device without the invite cookie.
    const verify = await app.request(getReq(`/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2Fhub%2Fapply`), undefined, testEnv);
    expect(verify.status).toBe(303);
    expect(verify.headers.get("location")).toBe("/hub/apply");
    expect(setCookieValue(verify, "__Host-vnx_session")).not.toBeNull();
    expect(setCookieValue(verify, "__Host-vnx_invite")).toBe(hash);
  });

  it("ignores a tampered invite cookie", async () => {
    await createApp().request(formPost("/login", { email: "tamper@vnx.si" }, { cookie: "__Host-vnx_invite=not-a-hash" }), undefined, testEnv);
    expect(await tokenInviteHash("tamper@vnx.si")).toBeNull();
  });
});
```

Run: `npm test -w apps/web -- test/auth/invite-flow.test.ts test/auth/require-user.test.ts`
Expected: FAIL (`/join` chưa có; `next` thiếu query).

- [ ] **Step 3: Cookie invite và route `/join/:code`**

`apps/web/src/auth/invite-cookie.ts`:

```ts
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env.ts";

/** Holds the SHA-256 of an invite code for 1 hour (spec §5.3). Never the raw code. */
export const INVITE_COOKIE = "__Host-vnx_invite";
const HASH = /^[0-9a-f]{64}$/;

export function readInviteCookie(c: Context<AppEnv>): string | null {
  const value = getCookie(c, INVITE_COOKIE);
  return value && HASH.test(value) ? value : null;
}

export function writeInviteCookie(c: Context<AppEnv>, codeHash: string) {
  setCookie(c, INVITE_COOKIE, codeHash, { path: "/", secure: true, httpOnly: true, sameSite: "Lax", maxAge: 3600 });
}

export function clearInviteCookie(c: Context<AppEnv>) {
  deleteCookie(c, INVITE_COOKIE, { path: "/", secure: true });
}
```

`apps/web/src/routes/join.ts`:

```ts
import type { Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { writeInviteCookie } from "../auth/invite-cookie.ts";
import { INVITE_CODE_RE } from "../domain/invite.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { errorResponse } from "../views/error-response.tsx";

export function registerJoinRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/join/:code", async (c) => {
    const code = c.req.param("code") ?? "";
    if (!INVITE_CODE_RE.test(code)) return errorResponse(c, "notFound", 404);
    // Validity (uses, expiry) is checked when the builder row is created, not here.
    writeInviteCookie(c, await sha256Hex(code));
    c.header("Referrer-Policy", "no-referrer");
    const locale = c.get("locale");
    const apply = localizedPath(locale, "/hub/apply");
    if (c.get("user")) return c.redirect(apply, 303);
    return c.redirect(localizedPath(locale, `/login?next=${encodeURIComponent(apply)}`), 303);
  });
}
```

Trong `apps/web/src/app.ts`: import `registerJoinRoutes` từ `./routes/join.ts` và gọi `registerJoinRoutes(app);` ngay sau `registerAuthRoutes(app);`.

- [ ] **Step 4: Gắn invite vào magic link**

Trong `apps/web/src/routes/auth.tsx`:
- Thêm import: `import { readInviteCookie, writeInviteCookie } from "../auth/invite-cookie.ts";`
- Trong `POST /login`, đổi dòng tạo token thành:

```ts
    const token = await createLoginToken(c.env.DB, { email, purpose: "login", locale, inviteCodeHash: readInviteCookie(c) }, now);
```

- Trong `GET /auth/verify`, ngay sau `writeSessionCookie(c, await createSession(c.env.DB, user.id, now));` thêm:

```ts
    // The link may be opened on another device: restore the invite there (spec §5.3).
    if (result.token.inviteCodeHash) writeInviteCookie(c, result.token.inviteCodeHash);
```

- [ ] **Step 5: `requireUser` giữ query string**

Trong `apps/web/src/auth/middleware.ts`, thay hàm `toLogin` bằng:

```ts
function toLogin(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
  const url = new URL(c.req.url);
  const target = `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
  return c.redirect(localizedPath(c.get("locale"), target), 303);
}
```

- [ ] **Step 6: Chạy toàn bộ**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết, gồm `test/auth/login-flow.test.ts` của M1.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): invite links carried through magic-link sign-in" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: VNX-0202b — Đăng ký builder `/hub/apply`

**Files:**
- Create: `apps/web/src/routes/hub-apply.tsx`, `apps/web/src/views/hub/BuilderForm.tsx`, `apps/web/src/views/hub/ApplyPage.tsx`, `apps/web/src/views/country.ts`, `apps/web/src/views/labels.ts`
- Modify: `apps/web/src/auth/middleware.ts` (thêm `requireBuilder`), `apps/web/src/env.ts`, `apps/web/src/http/origin.ts` (thêm `requestOrigin`), `apps/web/src/app.ts`, 4 file `src/i18n/messages/*.ts`, `apps/web/public/assets/app.css`
- Test: `apps/web/test/hub/apply.test.ts`

**Interfaces:**
- Consumes: Task 1 (`createBuilder`, `findBuilderByUserId`, `findInvite`, `inviteState`, `parseBuilderProfile`, `formValuesFromBody`), Task 2 (`readInviteCookie`, `clearInviteCookie`, `signIn`, `formPost` với mảng).
- Produces:
  - `requireBuilder` middleware: không đăng nhập → `/login?next=…`; chưa có builder → 303 `/hub/apply` (theo locale); có → `c.set("builder", builder)`.
  - `AppEnv.Variables.builder: Builder`.
  - `requestOrigin(c): string` trong `http/origin.ts`.
  - `views/labels.ts`: `KIND_KEY`, `AVAILABILITY_KEY`, `LANGUAGE_KEY` (Record → `MessageKey`).
  - `views/country.ts`: `countryName(locale, code)`, `countryOptions(locale)`.
  - `BuilderForm` component: props `{ locale, action, values, errors, submitLabel, handleLocked? }`.
  - `registerApplyRoutes(app)`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/hub/apply.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { requireBuilder, sessionMiddleware } from "../../src/auth/middleware.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import type { AppEnv } from "../../src/env.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { ensureUser, makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

async function newInvite(code: string, o: { maxUses?: number; expiresAt?: string } = {}) {
  const admin = await ensureUser("apply-admin@vnx.si");
  const codeHash = await sha256Hex(code);
  await createInvite(testEnv.DB, { codeHash, createdBy: admin.id, maxUses: o.maxUses ?? 1, expiresAt: o.expiresAt ?? "2999-01-01T00:00:00.000Z", note: null, now: new Date().toISOString() });
  return codeHash;
}

const builderRow = (userId: string) =>
  testEnv.DB.prepare("SELECT status, skills, work_languages, hourly_rate_cents, invite_code_hash FROM builders WHERE user_id = ?1").bind(userId).first();

describe("/hub/apply (spec §5.3)", () => {
  it("asks anonymous visitors to sign in", async () => {
    const res = await createApp().request(getReq("/hub/apply"), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login?next=%2Fhub%2Fapply");
  });

  it("renders the form with localized labels and country names", async () => {
    const { cookie } = await signIn("apply-form@vnx.si");
    const res = await createApp().request(getReq("/vi/hub/apply", cookie), undefined, testEnv);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Trở thành builder");
    expect(html).toContain("Việt Nam");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("creates a pending builder without an invite", async () => {
    const { user, cookie } = await signIn("apply-plain@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-plain" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub");
    expect(await builderRow(user.id)).toEqual({ status: "pending", skills: '["Next.js","Supabase"]', work_languages: '["en","vi"]', hourly_rate_cents: 4500, invite_code_hash: null });
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'builder.apply' AND entity_id = ?1").bind(user.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ status: "pending", invited: false });
  });

  it("approves right away with a valid invite, spends it and clears the cookie", async () => {
    const hash = await newInvite("applyValidInvite000001");
    const { user, cookie } = await signIn("apply-invited@vnx.si");
    const both = `${cookie}; __Host-vnx_invite=${hash}`;
    const form = await createApp().request(getReq("/hub/apply", both), undefined, testEnv);
    expect(await form.text()).toContain("profile will be approved right away");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-invited" }), { cookie: both }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await builderRow(user.id)).toMatchObject({ status: "approved", invite_code_hash: hash });
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(1);
    expect(setCookieValue(res, "__Host-vnx_invite")).toBe("");
  });

  it("explains an expired invite and falls back to pending", async () => {
    const hash = await newInvite("applyExpiredInvite0001", { expiresAt: "2000-01-01T00:00:00.000Z" });
    const { user, cookie } = await signIn("apply-expired@vnx.si");
    const both = `${cookie}; __Host-vnx_invite=${hash}`;
    expect(await (await createApp().request(getReq("/hub/apply", both), undefined, testEnv)).text()).toContain("This invite link has expired or has no uses left");
    await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-expired" }), { cookie: both }), undefined, testEnv);
    expect(await builderRow(user.id)).toMatchObject({ status: "pending", invite_code_hash: null });
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(0);
  });

  it("re-renders field errors with escaped input (400)", async () => {
    const { cookie } = await signIn("apply-bad@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "admin", name: "<script>alert(1)</script>", websiteUrl: "http://x.dev" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("This handle is reserved");
    expect(html).toContain("Enter a full https:// address");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses a taken handle with 409 and leaves the invite unused", async () => {
    await makeBuilder("apply-first@vnx.si", "apply-taken");
    const hash = await newInvite("applyTakenInvite000001", { maxUses: 3 });
    const { cookie } = await signIn("apply-second@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-taken" }), { cookie: `${cookie}; __Host-vnx_invite=${hash}` }), undefined, testEnv);
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("This handle is already taken.");
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(0);
  });

  it("sends existing builders to the hub", async () => {
    await makeBuilder("apply-exists@vnx.si", "apply-exists");
    const { cookie } = await signIn("apply-exists@vnx.si");
    const app = createApp();
    expect((await app.request(getReq("/vi/hub/apply", cookie), undefined, testEnv)).headers.get("location")).toBe("/vi/hub");
    expect((await app.request(formPost("/hub/apply", profileValues({ handle: "apply-exists-2" }), { cookie }), undefined, testEnv)).headers.get("location")).toBe("/hub");
  });
});

describe("requireBuilder", () => {
  const mini = new Hono<AppEnv>();
  mini.use("*", localeMiddleware, sessionMiddleware);
  mini.get("/vi/hub/x", requireBuilder, (c) => c.text(c.get("builder").handle));

  it("redirects anonymous users, sends non-builders to apply and loads the builder", async () => {
    expect((await mini.request("https://vnx.si/vi/hub/x", {}, testEnv)).headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fhub%2Fx");
    const plain = await signIn("rb-plain@vnx.si");
    expect((await mini.request("https://vnx.si/vi/hub/x", { headers: { cookie: plain.cookie } }, testEnv)).headers.get("location")).toBe("/vi/hub/apply");
    await makeBuilder("rb-builder@vnx.si", "rb-builder");
    const builder = await signIn("rb-builder@vnx.si");
    expect(await (await mini.request("https://vnx.si/vi/hub/x", { headers: { cookie: builder.cookie } }, testEnv)).text()).toBe("rb-builder");
  });
});
```

Run: `npm test -w apps/web -- test/hub/apply.test.ts`
Expected: FAIL.

- [ ] **Step 2: `requireBuilder`, `AppEnv`, `requestOrigin`**

`apps/web/src/env.ts`: thêm `import type { Builder } from "./domain/builder.ts";` và thêm `builder: Builder;` vào `Variables` (chỉ có giá trị sau `requireBuilder`).

`apps/web/src/auth/middleware.ts`: thêm import `import { findBuilderByUserId } from "../db/builders.ts";` và hàm:

```ts
/** Loads the signed-in user's builder row; users without one go to the application form. */
export const requireBuilder: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  const builder = await findBuilderByUserId(c.env.DB, user.id);
  if (!builder) return c.redirect(localizedPath(c.get("locale"), "/hub/apply"), 303);
  c.set("builder", builder);
  await next();
};
```

`apps/web/src/http/origin.ts`: thêm `import type { Context } from "hono";` và:

```ts
export function requestOrigin(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}
```

- [ ] **Step 3: Nhãn, quốc gia, form builder**

`apps/web/src/views/labels.ts`:

```ts
import type { Availability, BuilderKind, WorkLanguage } from "../domain/builder.ts";
import type { MessageKey } from "../i18n/messages/en.ts";

export const KIND_KEY: Record<BuilderKind, MessageKey> = {
  individual: "builder.kind.individual",
  team: "builder.kind.team",
  company: "builder.kind.company",
};

export const AVAILABILITY_KEY: Record<Availability, MessageKey> = {
  open: "builder.availability.open",
  limited: "builder.availability.limited",
  closed: "builder.availability.closed",
};

export const LANGUAGE_KEY: Record<WorkLanguage, MessageKey> = {
  en: "builder.lang.en",
  vi: "builder.lang.vi",
  zh: "builder.lang.zh",
};
```

`apps/web/src/views/country.ts`:

```ts
import { COUNTRY_CODES } from "../domain/countries.ts";
import type { Locale } from "../i18n/locales.ts";

const namers = new Map<Locale, Intl.DisplayNames>();
const options = new Map<Locale, { code: string; name: string }[]>();

export function countryName(locale: Locale, code: string): string {
  let namer = namers.get(locale);
  if (!namer) {
    namer = new Intl.DisplayNames([locale], { type: "region" });
    namers.set(locale, namer);
  }
  return namer.of(code) ?? code;
}

/** All countries sorted by their name in `locale`. */
export function countryOptions(locale: Locale): { code: string; name: string }[] {
  let list = options.get(locale);
  if (!list) {
    list = COUNTRY_CODES.map((code) => ({ code, name: countryName(locale, code) })).sort((a, b) => a.name.localeCompare(b.name, locale));
    options.set(locale, list);
  }
  return list;
}
```

`apps/web/src/views/hub/BuilderForm.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { AVAILABILITIES, BUILDER_KINDS, WORK_LANGUAGES } from "../../domain/builder.ts";
import type { BuilderField, BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { countryOptions } from "../country.ts";
import { AVAILABILITY_KEY, KIND_KEY, LANGUAGE_KEY } from "../labels.ts";

const ERROR_KEY: Record<BuilderField, MessageKey> = {
  handle: "builder.error.handle",
  name: "builder.error.name",
  kind: "builder.error.kind",
  headline: "builder.error.headline",
  bio: "builder.error.bio",
  country: "builder.error.country",
  websiteUrl: "builder.error.websiteUrl",
  skills: "builder.error.skills",
  aiTools: "builder.error.aiTools",
  workLanguages: "builder.error.workLanguages",
  availability: "builder.error.availability",
  hourlyRate: "builder.error.hourlyRate",
};

function errorText(tr: Translate, field: BuilderField, errors: FieldErrors): string | null {
  const code = errors[field];
  if (!code) return null;
  if (code === "reserved") return tr("builder.error.handleReserved");
  if (code === "taken") return tr("builder.error.handleTaken");
  return tr(ERROR_KEY[field]);
}

export type BuilderFormProps = {
  locale: Locale;
  action: string;
  values: BuilderFormValues;
  errors: FieldErrors;
  submitLabel: string;
  handleLocked?: boolean;
};

export const BuilderForm: FC<BuilderFormProps> = ({ locale, action, values, errors, submitLabel, handleLocked }) => {
  const tr = translator(locale);
  const error = (field: BuilderField) => {
    const text = errorText(tr, field, errors);
    return text ? (
      <p id={`${field}-error`} class="error-msg">
        {text}
      </p>
    ) : null;
  };
  // Links a control to its hint and its error message, when present.
  const aria = (field: BuilderField, hint = false) => {
    const ids = [hint ? `${field}-hint` : "", errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ");
    return { "aria-invalid": errors[field] ? "true" : undefined, "aria-describedby": ids || undefined };
  };
  const hint = (field: BuilderField, key: MessageKey) => (
    <p id={`${field}-hint`} class="hint">
      {tr(key)}
    </p>
  );

  return (
    <form method="post" action={action}>
      {Object.keys(errors).length > 0 ? (
        <p class="error-msg" role="alert">
          {tr("builder.form.errorSummary")}
        </p>
      ) : null}

      <div class="field">
        <label for="handle">{tr("builder.field.handle")}</label>
        {handleLocked ? (
          <input id="handle" value={values.handle} readonly aria-describedby="handle-hint" />
        ) : (
          <input id="handle" name="handle" value={values.handle} required maxlength={30} autocomplete="off" {...aria("handle", true)} />
        )}
        {hint("handle", handleLocked ? "profile.handleLocked" : "builder.hint.handle")}
        {error("handle")}
      </div>

      <div class="field">
        <label for="name">{tr("builder.field.name")}</label>
        <input id="name" name="name" value={values.name} required maxlength={80} autocomplete="name" {...aria("name")} />
        {error("name")}
      </div>

      <div class="field">
        <label for="kind">{tr("builder.field.kind")}</label>
        <select id="kind" name="kind" required {...aria("kind")}>
          <option value="">{tr("builder.form.choose")}</option>
          {BUILDER_KINDS.map((k) => (
            <option value={k} selected={values.kind === k}>
              {tr(KIND_KEY[k])}
            </option>
          ))}
        </select>
        {error("kind")}
      </div>

      <div class="field">
        <label for="headline">{tr("builder.field.headline")}</label>
        <input id="headline" name="headline" value={values.headline} required maxlength={120} {...aria("headline", true)} />
        {hint("headline", "builder.hint.headline")}
        {error("headline")}
      </div>

      <div class="field">
        <label for="bio">{tr("builder.field.bio")}</label>
        <textarea id="bio" name="bio" rows={8} required maxlength={2000} {...aria("bio", true)}>
          {values.bio}
        </textarea>
        {hint("bio", "builder.hint.bio")}
        {error("bio")}
      </div>

      <div class="field">
        <label for="country">{tr("builder.field.country")}</label>
        <select id="country" name="country" required {...aria("country")}>
          <option value="">{tr("builder.form.choose")}</option>
          {countryOptions(locale).map((o) => (
            <option value={o.code} selected={values.country.toUpperCase() === o.code}>
              {o.name}
            </option>
          ))}
        </select>
        {error("country")}
      </div>

      <div class="field">
        <label for="websiteUrl">{tr("builder.field.websiteUrl")}</label>
        <input id="websiteUrl" name="websiteUrl" type="url" value={values.websiteUrl} maxlength={500} placeholder="https://" {...aria("websiteUrl")} />
        {error("websiteUrl")}
      </div>

      <div class="field">
        <label for="skills">{tr("builder.field.skills")}</label>
        <input id="skills" name="skills" value={values.skills} required {...aria("skills", true)} />
        {hint("skills", "builder.hint.skills")}
        {error("skills")}
      </div>

      <div class="field">
        <label for="aiTools">{tr("builder.field.aiTools")}</label>
        <input id="aiTools" name="aiTools" value={values.aiTools} {...aria("aiTools", true)} />
        {hint("aiTools", "builder.hint.aiTools")}
        {error("aiTools")}
      </div>

      <fieldset class="field" aria-describedby={errors.workLanguages ? "workLanguages-error" : undefined}>
        <legend>{tr("builder.field.workLanguages")}</legend>
        {WORK_LANGUAGES.map((l) => (
          <label class="choice">
            <input type="checkbox" name="workLanguages" value={l} checked={values.workLanguages.includes(l)} /> {tr(LANGUAGE_KEY[l])}
          </label>
        ))}
        {error("workLanguages")}
      </fieldset>

      <fieldset class="field" aria-describedby={errors.availability ? "availability-error" : undefined}>
        <legend>{tr("builder.field.availability")}</legend>
        {AVAILABILITIES.map((a) => (
          <label class="choice">
            <input type="radio" name="availability" value={a} checked={values.availability === a} required /> {tr(AVAILABILITY_KEY[a])}
          </label>
        ))}
        {error("availability")}
      </fieldset>

      <div class="field">
        <label for="hourlyRate">{tr("builder.field.hourlyRate")}</label>
        <input id="hourlyRate" name="hourlyRate" type="number" inputmode="numeric" min={1} max={10000} step={1} value={values.hourlyRate} {...aria("hourlyRate")} />
        {error("hourlyRate")}
      </div>

      <button class="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
};
```

`apps/web/src/views/hub/ApplyPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";
import { BuilderForm } from "./BuilderForm.tsx";

export type InviteNotice = "valid" | "invalid" | null;

export const ApplyPage: FC<{ locale: Locale; origin: string; values: BuilderFormValues; errors: FieldErrors; invite: InviteNotice }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("apply.title")} origin={p.origin} rest="/hub/apply" noindex signedIn>
      <section class="card wide">
        <h1>{tr("apply.title")}</h1>
        <p>{tr("apply.intro")}</p>
        {p.invite === "valid" ? (
          <p class="notice good" role="status">
            {tr("apply.invite.valid")}
          </p>
        ) : null}
        {p.invite === "invalid" ? (
          <p class="notice" role="status">
            {tr("apply.invite.invalid")}
          </p>
        ) : null}
        <BuilderForm locale={p.locale} action={localizedPath(p.locale, "/hub/apply")} values={p.values} errors={p.errors} submitLabel={tr("apply.submit")} />
      </section>
    </Layout>
  );
};
```

- [ ] **Step 4: Route `/hub/apply`**

`apps/web/src/routes/hub-apply.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { clearInviteCookie, readInviteCookie } from "../auth/invite-cookie.ts";
import { requireUser } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { createBuilder, findBuilderByUserId } from "../db/builders.ts";
import { findInvite } from "../db/invites.ts";
import { formValuesFromBody, parseBuilderProfile, type BuilderFormValues, type FieldErrors } from "../domain/builder-input.ts";
import { inviteState } from "../domain/invite.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { ApplyPage, type InviteNotice } from "../views/hub/ApplyPage.tsx";
import { page } from "../views/render.ts";

async function inviteNotice(c: Context<AppEnv>): Promise<InviteNotice> {
  const hash = readInviteCookie(c);
  if (!hash) return null;
  const invite = await findInvite(c.env.DB, hash);
  return invite && inviteState(invite, new Date()) === "active" ? "valid" : "invalid";
}

async function render(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200) {
  const invite = await inviteNotice(c);
  return page(c, <ApplyPage locale={c.get("locale")} origin={requestOrigin(c)} values={values} errors={errors} invite={invite} />, status);
}

export function registerApplyRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/apply", requireUser, async (c) => {
    if (await findBuilderByUserId(c.env.DB, c.get("user")!.id)) return c.redirect(localizedPath(c.get("locale"), "/hub"), 303);
    return render(c, formValuesFromBody({}), {});
  });

  onLocalized(app, "post", "/hub/apply", requireUser, async (c) => {
    const user = c.get("user")!;
    const hub = localizedPath(c.get("locale"), "/hub");
    if (await findBuilderByUserId(c.env.DB, user.id)) return c.redirect(hub, 303);

    const values = formValuesFromBody(await c.req.parseBody({ all: true }));
    const parsed = parseBuilderProfile(values);
    if (!parsed.ok) return render(c, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const result = await createBuilder(c.env.DB, { userId: user.id, profile: parsed.profile, inviteCodeHash: readInviteCookie(c), now });
    if (!result.ok) {
      if (result.reason === "already_builder") return c.redirect(hub, 303);
      return render(c, values, { handle: "taken" }, 409);
    }
    await writeAudit(c.env.DB, {
      actorUserId: user.id,
      action: "builder.apply",
      entity: "builder",
      entityId: user.id,
      data: { status: result.builder.status, invited: result.builder.inviteCodeHash !== null },
      now,
    });
    clearInviteCookie(c);
    return c.redirect(hub, 303);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerApplyRoutes(app);` sau `registerJoinRoutes(app);`.

- [ ] **Step 5: Thêm key i18n (đủ 4 locale)**

Thêm vào cuối object trong `en.ts` (trước `} as const;`):

```ts
  "builder.field.handle": "Handle",
  "builder.hint.handle": "3–30 lowercase letters, numbers or hyphens. It becomes your public link: vnx.si/b/your-handle.",
  "builder.field.name": "Name",
  "builder.field.kind": "Builder type",
  "builder.kind.individual": "Individual",
  "builder.kind.team": "Team",
  "builder.kind.company": "Company",
  "builder.field.headline": "Headline",
  "builder.hint.headline": "One line, up to 120 characters.",
  "builder.field.bio": "About you",
  "builder.hint.bio": "Plain text, up to 2000 characters. Leave a blank line between paragraphs; lines starting with \"- \" become a list.",
  "builder.field.country": "Country",
  "builder.field.websiteUrl": "Website (optional)",
  "builder.field.skills": "Skills",
  "builder.hint.skills": "Separate with commas, at least one. Example: Next.js, Supabase, n8n",
  "builder.field.aiTools": "AI tools you use (optional)",
  "builder.hint.aiTools": "Separate with commas. Example: Claude Code, Cursor",
  "builder.field.workLanguages": "Working languages",
  "builder.lang.en": "English",
  "builder.lang.vi": "Vietnamese",
  "builder.lang.zh": "Chinese",
  "builder.field.availability": "Availability",
  "builder.availability.open": "Open to new work",
  "builder.availability.limited": "Limited availability",
  "builder.availability.closed": "Not taking work",
  "builder.field.hourlyRate": "Hourly rate in USD (optional)",
  "builder.form.choose": "Choose…",
  "builder.form.errorSummary": "Please fix the highlighted fields.",
  "builder.error.handle": "Use 3–30 lowercase letters, numbers or hyphens, starting and ending with a letter or number.",
  "builder.error.handleReserved": "This handle is reserved. Choose another one.",
  "builder.error.handleTaken": "This handle is already taken.",
  "builder.error.name": "Enter a name (up to 80 characters).",
  "builder.error.kind": "Choose a builder type.",
  "builder.error.headline": "Enter a headline (up to 120 characters).",
  "builder.error.bio": "Write a short bio (up to 2000 characters).",
  "builder.error.country": "Choose a country.",
  "builder.error.websiteUrl": "Enter a full https:// address, or leave it empty.",
  "builder.error.skills": "Add 1 to 15 skills, each up to 40 characters.",
  "builder.error.aiTools": "Add up to 15 tools, each up to 40 characters.",
  "builder.error.workLanguages": "Choose from the listed languages.",
  "builder.error.availability": "Choose your availability.",
  "builder.error.hourlyRate": "Enter a whole number from 1 to 10000, or leave it empty.",
  "apply.title": "Become a builder",
  "apply.intro": "Tell clients who you are and what you build. An admin reviews new profiles before they go public.",
  "apply.invite.valid": "You're joining with an invite link, so your profile will be approved right away.",
  "apply.invite.invalid": "This invite link has expired or has no uses left. You can still apply; an admin will review your profile.",
  "apply.submit": "Submit profile",
  "profile.handleLocked": "Your handle can't be changed after your profile is approved.",
```

`vi.ts` (trước `};`):

```ts
  "builder.field.handle": "Handle",
  "builder.hint.handle": "3–30 ký tự gồm chữ thường, số hoặc dấu gạch ngang. Đây sẽ là link công khai của bạn: vnx.si/b/handle-cua-ban.",
  "builder.field.name": "Tên hiển thị",
  "builder.field.kind": "Loại builder",
  "builder.kind.individual": "Cá nhân",
  "builder.kind.team": "Nhóm",
  "builder.kind.company": "Công ty",
  "builder.field.headline": "Giới thiệu ngắn",
  "builder.hint.headline": "Một dòng, tối đa 120 ký tự.",
  "builder.field.bio": "Về bạn",
  "builder.hint.bio": "Văn bản thuần, tối đa 2000 ký tự. Để một dòng trống giữa các đoạn; dòng bắt đầu bằng \"- \" sẽ thành danh sách.",
  "builder.field.country": "Quốc gia",
  "builder.field.websiteUrl": "Website (không bắt buộc)",
  "builder.field.skills": "Kỹ năng",
  "builder.hint.skills": "Phân tách bằng dấu phẩy, ít nhất một. Ví dụ: Next.js, Supabase, n8n",
  "builder.field.aiTools": "Công cụ AI bạn dùng (không bắt buộc)",
  "builder.hint.aiTools": "Phân tách bằng dấu phẩy. Ví dụ: Claude Code, Cursor",
  "builder.field.workLanguages": "Ngôn ngữ làm việc",
  "builder.lang.en": "Tiếng Anh",
  "builder.lang.vi": "Tiếng Việt",
  "builder.lang.zh": "Tiếng Trung",
  "builder.field.availability": "Tình trạng nhận việc",
  "builder.availability.open": "Đang nhận việc",
  "builder.availability.limited": "Nhận việc hạn chế",
  "builder.availability.closed": "Tạm không nhận việc",
  "builder.field.hourlyRate": "Giá theo giờ, USD (không bắt buộc)",
  "builder.form.choose": "Chọn…",
  "builder.form.errorSummary": "Vui lòng sửa các ô được đánh dấu.",
  "builder.error.handle": "Dùng 3–30 ký tự chữ thường, số hoặc dấu gạch ngang; bắt đầu và kết thúc bằng chữ hoặc số.",
  "builder.error.handleReserved": "Handle này được giữ cho hệ thống. Hãy chọn handle khác.",
  "builder.error.handleTaken": "Handle này đã có người dùng.",
  "builder.error.name": "Nhập tên (tối đa 80 ký tự).",
  "builder.error.kind": "Chọn loại builder.",
  "builder.error.headline": "Nhập giới thiệu ngắn (tối đa 120 ký tự).",
  "builder.error.bio": "Viết vài dòng về bạn (tối đa 2000 ký tự).",
  "builder.error.country": "Chọn quốc gia.",
  "builder.error.websiteUrl": "Nhập địa chỉ đầy đủ bắt đầu bằng https://, hoặc để trống.",
  "builder.error.skills": "Thêm 1 đến 15 kỹ năng, mỗi kỹ năng tối đa 40 ký tự.",
  "builder.error.aiTools": "Tối đa 15 công cụ, mỗi công cụ tối đa 40 ký tự.",
  "builder.error.workLanguages": "Chọn trong các ngôn ngữ có sẵn.",
  "builder.error.availability": "Chọn tình trạng nhận việc.",
  "builder.error.hourlyRate": "Nhập số nguyên từ 1 đến 10000, hoặc để trống.",
  "apply.title": "Trở thành builder",
  "apply.intro": "Cho khách hàng biết bạn là ai và bạn xây gì. Admin sẽ duyệt hồ sơ mới trước khi công khai.",
  "apply.invite.valid": "Bạn tham gia bằng link mời nên hồ sơ sẽ được duyệt ngay.",
  "apply.invite.invalid": "Link mời này đã hết hạn hoặc hết lượt dùng. Bạn vẫn có thể đăng ký; admin sẽ duyệt hồ sơ của bạn.",
  "apply.submit": "Gửi hồ sơ",
  "profile.handleLocked": "Không đổi được handle sau khi hồ sơ đã được duyệt.",
```

`zh-hans.ts` (trước `};`):

```ts
  "builder.field.handle": "用户名",
  "builder.hint.handle": "3–30 个小写字母、数字或连字符。它将成为你的公开链接：vnx.si/b/your-handle。",
  "builder.field.name": "名称",
  "builder.field.kind": "类型",
  "builder.kind.individual": "个人",
  "builder.kind.team": "团队",
  "builder.kind.company": "公司",
  "builder.field.headline": "一句话介绍",
  "builder.hint.headline": "一行，最多 120 个字符。",
  "builder.field.bio": "关于你",
  "builder.hint.bio": "纯文本，最多 2000 个字符。段落之间空一行；以 \"- \" 开头的行会变成列表。",
  "builder.field.country": "国家/地区",
  "builder.field.websiteUrl": "网站（可选）",
  "builder.field.skills": "技能",
  "builder.hint.skills": "用逗号分隔，至少一项。例如：Next.js, Supabase, n8n",
  "builder.field.aiTools": "你使用的 AI 工具（可选）",
  "builder.hint.aiTools": "用逗号分隔。例如：Claude Code, Cursor",
  "builder.field.workLanguages": "工作语言",
  "builder.lang.en": "英语",
  "builder.lang.vi": "越南语",
  "builder.lang.zh": "中文",
  "builder.field.availability": "接单状态",
  "builder.availability.open": "可接新项目",
  "builder.availability.limited": "档期有限",
  "builder.availability.closed": "暂不接单",
  "builder.field.hourlyRate": "时薪（美元，可选）",
  "builder.form.choose": "请选择…",
  "builder.form.errorSummary": "请修正标出的字段。",
  "builder.error.handle": "请使用 3–30 个小写字母、数字或连字符，并以字母或数字开头和结尾。",
  "builder.error.handleReserved": "该用户名已被保留，请换一个。",
  "builder.error.handleTaken": "该用户名已被占用。",
  "builder.error.name": "请输入名称（最多 80 个字符）。",
  "builder.error.kind": "请选择类型。",
  "builder.error.headline": "请输入一句话介绍（最多 120 个字符）。",
  "builder.error.bio": "请填写简介（最多 2000 个字符）。",
  "builder.error.country": "请选择国家/地区。",
  "builder.error.websiteUrl": "请输入以 https:// 开头的完整地址，或留空。",
  "builder.error.skills": "请添加 1 到 15 项技能，每项最多 40 个字符。",
  "builder.error.aiTools": "最多 15 个工具，每个最多 40 个字符。",
  "builder.error.workLanguages": "请从列出的语言中选择。",
  "builder.error.availability": "请选择接单状态。",
  "builder.error.hourlyRate": "请输入 1 到 10000 的整数，或留空。",
  "apply.title": "成为 Builder",
  "apply.intro": "告诉客户你是谁、你做什么。新资料在公开前会由管理员审核。",
  "apply.invite.valid": "你通过邀请链接加入，资料将立即通过审核。",
  "apply.invite.invalid": "该邀请链接已过期或已用完。你仍可申请，管理员会审核你的资料。",
  "apply.submit": "提交资料",
  "profile.handleLocked": "资料通过审核后无法更改用户名。",
```

`zh-hant.ts` (trước `};`):

```ts
  "builder.field.handle": "使用者名稱",
  "builder.hint.handle": "3–30 個小寫字母、數字或連字號。它將成為你的公開連結：vnx.si/b/your-handle。",
  "builder.field.name": "名稱",
  "builder.field.kind": "類型",
  "builder.kind.individual": "個人",
  "builder.kind.team": "團隊",
  "builder.kind.company": "公司",
  "builder.field.headline": "一句話介紹",
  "builder.hint.headline": "一行，最多 120 個字元。",
  "builder.field.bio": "關於你",
  "builder.hint.bio": "純文字，最多 2000 個字元。段落之間空一行；以 \"- \" 開頭的行會變成清單。",
  "builder.field.country": "國家/地區",
  "builder.field.websiteUrl": "網站（選填）",
  "builder.field.skills": "技能",
  "builder.hint.skills": "用逗號分隔，至少一項。例如：Next.js, Supabase, n8n",
  "builder.field.aiTools": "你使用的 AI 工具（選填）",
  "builder.hint.aiTools": "用逗號分隔。例如：Claude Code, Cursor",
  "builder.field.workLanguages": "工作語言",
  "builder.lang.en": "英語",
  "builder.lang.vi": "越南語",
  "builder.lang.zh": "中文",
  "builder.field.availability": "接案狀態",
  "builder.availability.open": "可接新專案",
  "builder.availability.limited": "檔期有限",
  "builder.availability.closed": "暫不接案",
  "builder.field.hourlyRate": "時薪（美元，選填）",
  "builder.form.choose": "請選擇…",
  "builder.form.errorSummary": "請修正標示的欄位。",
  "builder.error.handle": "請使用 3–30 個小寫字母、數字或連字號，並以字母或數字開頭和結尾。",
  "builder.error.handleReserved": "此使用者名稱已被保留，請換一個。",
  "builder.error.handleTaken": "此使用者名稱已被使用。",
  "builder.error.name": "請輸入名稱（最多 80 個字元）。",
  "builder.error.kind": "請選擇類型。",
  "builder.error.headline": "請輸入一句話介紹（最多 120 個字元）。",
  "builder.error.bio": "請填寫簡介（最多 2000 個字元）。",
  "builder.error.country": "請選擇國家/地區。",
  "builder.error.websiteUrl": "請輸入以 https:// 開頭的完整網址，或留空。",
  "builder.error.skills": "請新增 1 到 15 項技能，每項最多 40 個字元。",
  "builder.error.aiTools": "最多 15 個工具，每個最多 40 個字元。",
  "builder.error.workLanguages": "請從列出的語言中選擇。",
  "builder.error.availability": "請選擇接案狀態。",
  "builder.error.hourlyRate": "請輸入 1 到 10000 的整數，或留空。",
  "apply.title": "成為 Builder",
  "apply.intro": "告訴客戶你是誰、你做什麼。新資料在公開前會由管理員審核。",
  "apply.invite.valid": "你透過邀請連結加入，資料將立即通過審核。",
  "apply.invite.invalid": "此邀請連結已過期或已用完。你仍可申請，管理員會審核你的資料。",
  "apply.submit": "提交資料",
  "profile.handleLocked": "資料通過審核後無法更改使用者名稱。",
```

- [ ] **Step 6: CSS cho form**

Thêm vào cuối `apps/web/public/assets/app.css`:

```css
.card.wide { max-width: 760px; }
.field textarea, .field select { font: inherit; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); }
.field select { min-height: 44px; }
.field textarea { min-height: 140px; resize: vertical; }
fieldset.field { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.choice { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.hint, .muted { color: var(--muted); }
.hint { margin: 0; font-size: 14px; }
.notice { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--ground); }
.notice.good { border-color: var(--good); }
```

- [ ] **Step 7: Chạy toàn bộ**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết (gồm `test/i18n/parity.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): builder application form with invite fast-track" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: VNX-0203a — Builder Hub: tổng quan, sửa hồ sơ, gửi duyệt lại

**Files:**
- Create: `apps/web/src/routes/hub.tsx`, `apps/web/src/views/hub/HubLayout.tsx`, `apps/web/src/views/hub/OverviewPage.tsx`, `apps/web/src/views/hub/ProfilePage.tsx`
- Modify: `apps/web/src/views/ErrorPage.tsx` (thêm kind `conflict`), `apps/web/src/views/labels.ts` (thêm `STATUS_KEY`, `STATUS_BODY_KEY`), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/hub/profile.test.ts`

**Interfaces:**
- Consumes: `requireBuilder`, `BuilderForm`, `updateBuilderProfile`, `setBuilderStatus`, `transition`, `canEditProfile`, `canChangeHandle`, `formValuesFromProfile`, `PlainText`, `writeAudit`.
- Produces:
  - `ErrorKind` có thêm `"conflict"` → `errorResponse(c, "conflict", 409)`.
  - `HubLayout` props `{ locale, origin, title, rest, active: "overview" | "profile" }` (Task 5 thêm `"portfolio"`).
  - `STATUS_KEY`, `STATUS_BODY_KEY: Record<BuilderStatus, MessageKey>`.
  - `registerHubRoutes(app)`: `GET /hub`, `GET|POST /hub/profile`, `POST /hub/resubmit`.
  - Audit actions: `builder.profile_update`, `builder.resubmit`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/hub/profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();

async function asBuilder(email: string, handle: string, status: Parameters<typeof makeBuilder>[2] = "pending") {
  const builder = await makeBuilder(email, handle, status);
  const { cookie } = await signIn(email);
  return { builder, cookie };
}

describe("Builder Hub overview (spec §5.3)", () => {
  it("routes non-builders to apply and anonymous users to sign in", async () => {
    expect((await app().request(getReq("/hub"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fhub");
    const { cookie } = await signIn("hub-nobody@vnx.si");
    expect((await app().request(getReq("/hub", cookie), undefined, testEnv)).headers.get("location")).toBe("/hub/apply");
  });

  it("shows a pending builder their status, noindex", async () => {
    const { cookie } = await asBuilder("hub-pending@vnx.si", "hub-pending");
    const html = await (await app().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Pending review");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("links an approved builder to the public profile", async () => {
    const { cookie } = await asBuilder("hub-approved@vnx.si", "hub-approved", "approved");
    const html = await (await app().request(getReq("/vi/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain('href="/vi/b/hub-approved"');
  });

  it("shows the admin note to a rejected builder and resubmits once", async () => {
    const { builder, cookie } = await asBuilder("hub-rejected@vnx.si", "hub-rejected", "rejected");
    const html = await (await app().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Add a portfolio");
    const res = await app().request(formPost("/hub/resubmit", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub");
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ status: "pending", reviewNote: null });
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'builder.resubmit' AND entity_id = ?1").bind(builder.userId).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect((await app().request(formPost("/hub/resubmit", {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("Builder Hub profile", () => {
  it("prefills the form and lets a pending builder change the handle", async () => {
    const { builder, cookie } = await asBuilder("prof-pending@vnx.si", "prof-pending");
    const form = await (await app().request(getReq("/hub/profile", cookie), undefined, testEnv)).text();
    expect(form).toContain('value="Next.js, Supabase"');
    const res = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-pending-2", name: "Lan N." }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub/profile?saved=1");
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ handle: "prof-pending-2", name: "Lan N." });
    expect(await (await app().request(getReq("/hub/profile?saved=1", cookie), undefined, testEnv)).text()).toContain("Changes saved.");
  });

  it("keeps the handle of an approved builder but saves other fields at once", async () => {
    const { builder, cookie } = await asBuilder("prof-approved@vnx.si", "prof-approved", "approved");
    expect(await (await app().request(getReq("/hub/profile", cookie), undefined, testEnv)).text()).toContain("readonly");
    await app().request(formPost("/hub/profile", profileValues({ handle: "something-else", headline: "New headline" }), { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ handle: "prof-approved", headline: "New headline", status: "approved" });
  });

  it("re-renders errors (400) and refuses a taken handle (409)", async () => {
    await makeBuilder("prof-other@vnx.si", "prof-other");
    const { cookie } = await asBuilder("prof-errors@vnx.si", "prof-errors");
    const bad = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-errors", name: "" }), { cookie }), undefined, testEnv);
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain("Enter a name (up to 80 characters).");
    const taken = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-other" }), { cookie }), undefined, testEnv);
    expect(taken.status).toBe(409);
    expect(await taken.text()).toContain("This handle is already taken.");
  });

  it("refuses edits while suspended (409)", async () => {
    const { cookie } = await asBuilder("prof-suspended@vnx.si", "prof-suspended", "suspended");
    const res = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-suspended" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("This action is no longer possible");
  });
});
```

Run: `npm test -w apps/web -- test/hub/profile.test.ts`
Expected: FAIL.

- [ ] **Step 2: Trang lỗi 409 và nhãn trạng thái**

`apps/web/src/views/ErrorPage.tsx`: đổi `export type ErrorKind = "notFound" | "forbidden" | "server";` thành `export type ErrorKind = "notFound" | "forbidden" | "conflict" | "server";` (phần render dùng `error.${kind}.title/body` nên không cần sửa thêm).

Thêm vào `apps/web/src/views/labels.ts` (thêm `BuilderStatus` vào import type từ `../domain/builder.ts`):

```ts
export const STATUS_KEY: Record<BuilderStatus, MessageKey> = {
  pending: "hub.status.pending",
  approved: "hub.status.approved",
  rejected: "hub.status.rejected",
  suspended: "hub.status.suspended",
};

export const STATUS_BODY_KEY: Record<BuilderStatus, MessageKey> = {
  pending: "hub.status.pending.body",
  approved: "hub.status.approved.body",
  rejected: "hub.status.rejected.body",
  suspended: "hub.status.suspended.body",
};
```

- [ ] **Step 3: View của Hub**

`apps/web/src/views/hub/HubLayout.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";

export type HubSection = "overview" | "profile";

const NAV: { key: HubSection; path: string; label: MessageKey }[] = [
  { key: "overview", path: "/hub", label: "hub.nav.overview" },
  { key: "profile", path: "/hub/profile", label: "hub.nav.profile" },
];

export const HubLayout: FC<PropsWithChildren<{ locale: Locale; origin: string; title: string; rest: string; active: HubSection }>> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={`${p.title} · ${tr("hub.title")}`} origin={p.origin} rest={p.rest} noindex signedIn>
      <nav class="subnav" aria-label={tr("hub.nav.label")}>
        {NAV.map((item) => (
          <a href={localizedPath(p.locale, item.path)} aria-current={item.key === p.active ? "page" : undefined}>
            {tr(item.label)}
          </a>
        ))}
      </nav>
      {p.children}
    </Layout>
  );
};
```

`apps/web/src/views/hub/OverviewPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { Builder } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { STATUS_BODY_KEY, STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

export const OverviewPage: FC<{ locale: Locale; origin: string; builder: Builder }> = ({ locale, origin, builder }) => {
  const tr = translator(locale);
  return (
    <HubLayout locale={locale} origin={origin} title={tr("hub.nav.overview")} rest="/hub" active="overview">
      <section class="card wide">
        <h1>{tr("hub.title")}</h1>
        <p>
          {tr("hub.status.label")}: <span class={`badge badge-${builder.status}`}>{tr(STATUS_KEY[builder.status])}</span>
        </p>
        <p>{tr(STATUS_BODY_KEY[builder.status])}</p>
        {builder.status === "approved" ? (
          <p>
            <a href={localizedPath(locale, `/b/${builder.handle}`)}>{tr("hub.viewPublic")}</a>
          </p>
        ) : null}
        {builder.status === "rejected" ? (
          <>
            {builder.reviewNote ? (
              <div class="notice">
                <p>{tr("hub.reviewNote")}</p>
                <PlainText text={builder.reviewNote} />
              </div>
            ) : null}
            <p>
              <a href={localizedPath(locale, "/hub/profile")}>{tr("profile.title")}</a>
            </p>
            <form method="post" action={localizedPath(locale, "/hub/resubmit")}>
              <button class="btn" type="submit">
                {tr("hub.resubmit")}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </HubLayout>
  );
};
```

`apps/web/src/views/hub/ProfilePage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { canChangeHandle, canEditProfile, type Builder } from "../../domain/builder.ts";
import type { BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BuilderForm } from "./BuilderForm.tsx";
import { HubLayout } from "./HubLayout.tsx";

type Props = { locale: Locale; origin: string; builder: Builder; values: BuilderFormValues; errors: FieldErrors; saved: boolean };

export const ProfilePage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("profile.title")} rest="/hub/profile" active="profile">
      <section class="card wide">
        <h1>{tr("profile.title")}</h1>
        {p.saved ? (
          <p class="notice good" role="status">
            {tr("profile.saved")}
          </p>
        ) : null}
        {canEditProfile(p.builder.status) ? (
          <BuilderForm
            locale={p.locale}
            action={localizedPath(p.locale, "/hub/profile")}
            values={p.values}
            errors={p.errors}
            submitLabel={tr("profile.save")}
            handleLocked={!canChangeHandle(p.builder.status)}
          />
        ) : (
          <p class="notice">{tr("hub.status.suspended.body")}</p>
        )}
      </section>
    </HubLayout>
  );
};
```

- [ ] **Step 4: Route Hub**

`apps/web/src/routes/hub.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { setBuilderStatus, updateBuilderProfile } from "../db/builders.ts";
import { canChangeHandle, canEditProfile, transition } from "../domain/builder.ts";
import { formValuesFromBody, formValuesFromProfile, parseBuilderProfile, type BuilderFormValues, type FieldErrors } from "../domain/builder-input.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { OverviewPage } from "../views/hub/OverviewPage.tsx";
import { ProfilePage } from "../views/hub/ProfilePage.tsx";
import { page } from "../views/render.ts";

function profilePage(c: Context<AppEnv>, values: BuilderFormValues, errors: FieldErrors, status: 200 | 400 | 409 = 200, saved = false) {
  return page(c, <ProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={c.get("builder")} values={values} errors={errors} saved={saved} />, status);
}

export function registerHubRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub", requireBuilder, (c) =>
    page(c, <OverviewPage locale={c.get("locale")} origin={requestOrigin(c)} builder={c.get("builder")} />),
  );

  onLocalized(app, "get", "/hub/profile", requireBuilder, (c) =>
    profilePage(c, formValuesFromProfile(c.get("builder")), {}, 200, c.req.query("saved") === "1"),
  );

  onLocalized(app, "post", "/hub/profile", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const values = formValuesFromBody(await c.req.parseBody({ all: true }));
    // Owner decision 2026-10-03: the handle is locked once approved; ignore whatever was posted.
    if (!canChangeHandle(builder.status)) values.handle = builder.handle;
    const parsed = parseBuilderProfile(values);
    if (!parsed.ok) return profilePage(c, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const result = await updateBuilderProfile(c.env.DB, { userId: builder.userId, expectedStatus: builder.status, profile: parsed.profile, now });
    if (result === "handle_taken") return profilePage(c, values, { handle: "taken" }, 409);
    if (result === "stale") return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "builder.profile_update", entity: "builder", entityId: builder.userId, now });
    return c.redirect(localizedPath(c.get("locale"), "/hub/profile?saved=1"), 303);
  });

  onLocalized(app, "post", "/hub/resubmit", requireBuilder, async (c) => {
    const builder = c.get("builder");
    const next = transition(builder.status, "resubmit", "owner");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    const now = new Date().toISOString();
    const updated = await setBuilderStatus(c.env.DB, { userId: builder.userId, from: builder.status, to: next.status, reviewNote: null, now });
    if (!updated) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "builder.resubmit", entity: "builder", entityId: builder.userId, data: { from: builder.status, to: next.status }, now });
    return c.redirect(localizedPath(c.get("locale"), "/hub"), 303);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerHubRoutes(app);` sau `registerApplyRoutes(app);`.

- [ ] **Step 5: Key i18n**

`en.ts`:

```ts
  "error.conflict.title": "This action is no longer possible",
  "error.conflict.body": "Something changed in the meantime. Reload the page and try again.",
  "hub.title": "Builder Hub",
  "hub.nav.label": "Builder Hub sections",
  "hub.nav.overview": "Overview",
  "hub.nav.profile": "Profile",
  "hub.status.label": "Profile status",
  "hub.status.pending": "Pending review",
  "hub.status.pending.body": "An admin is reviewing your profile. It isn't public yet.",
  "hub.status.approved": "Approved",
  "hub.status.approved.body": "Your profile is public.",
  "hub.status.rejected": "Changes requested",
  "hub.status.rejected.body": "An admin asked for changes before your profile can go public. Edit your profile, then send it for review again.",
  "hub.status.suspended": "Suspended",
  "hub.status.suspended.body": "Your builder profile is hidden and can't be edited right now.",
  "hub.viewPublic": "View your public profile",
  "hub.reviewNote": "Note from the admin:",
  "hub.resubmit": "Send for review again",
  "profile.title": "Edit profile",
  "profile.save": "Save changes",
  "profile.saved": "Changes saved.",
```

`vi.ts`:

```ts
  "error.conflict.title": "Không thể thực hiện thao tác này nữa",
  "error.conflict.body": "Dữ liệu vừa thay đổi. Hãy tải lại trang và thử lại.",
  "hub.title": "Builder Hub",
  "hub.nav.label": "Các mục trong Builder Hub",
  "hub.nav.overview": "Tổng quan",
  "hub.nav.profile": "Hồ sơ",
  "hub.status.label": "Trạng thái hồ sơ",
  "hub.status.pending": "Đang chờ duyệt",
  "hub.status.pending.body": "Admin đang duyệt hồ sơ của bạn. Hồ sơ chưa công khai.",
  "hub.status.approved": "Đã duyệt",
  "hub.status.approved.body": "Hồ sơ của bạn đã công khai.",
  "hub.status.rejected": "Cần chỉnh sửa",
  "hub.status.rejected.body": "Admin yêu cầu chỉnh sửa trước khi hồ sơ được công khai. Hãy sửa hồ sơ rồi gửi duyệt lại.",
  "hub.status.suspended": "Đã bị khóa",
  "hub.status.suspended.body": "Hồ sơ builder của bạn đang bị ẩn và tạm thời không sửa được.",
  "hub.viewPublic": "Xem hồ sơ công khai",
  "hub.reviewNote": "Ghi chú của admin:",
  "hub.resubmit": "Gửi duyệt lại",
  "profile.title": "Sửa hồ sơ",
  "profile.save": "Lưu thay đổi",
  "profile.saved": "Đã lưu thay đổi.",
```

`zh-hans.ts`:

```ts
  "error.conflict.title": "此操作已无法执行",
  "error.conflict.body": "数据刚刚发生了变化。请刷新页面后重试。",
  "hub.title": "Builder 中心",
  "hub.nav.label": "Builder 中心导航",
  "hub.nav.overview": "概览",
  "hub.nav.profile": "资料",
  "hub.status.label": "资料状态",
  "hub.status.pending": "待审核",
  "hub.status.pending.body": "管理员正在审核你的资料，目前尚未公开。",
  "hub.status.approved": "已通过",
  "hub.status.approved.body": "你的资料已公开。",
  "hub.status.rejected": "需要修改",
  "hub.status.rejected.body": "管理员要求修改后才能公开。请修改资料后重新提交审核。",
  "hub.status.suspended": "已停用",
  "hub.status.suspended.body": "你的 Builder 资料已隐藏，目前无法编辑。",
  "hub.viewPublic": "查看公开资料",
  "hub.reviewNote": "管理员备注：",
  "hub.resubmit": "重新提交审核",
  "profile.title": "编辑资料",
  "profile.save": "保存更改",
  "profile.saved": "已保存。",
```

`zh-hant.ts`:

```ts
  "error.conflict.title": "此操作已無法執行",
  "error.conflict.body": "資料剛剛有所變更。請重新整理頁面後再試。",
  "hub.title": "Builder 中心",
  "hub.nav.label": "Builder 中心導覽",
  "hub.nav.overview": "總覽",
  "hub.nav.profile": "資料",
  "hub.status.label": "資料狀態",
  "hub.status.pending": "待審核",
  "hub.status.pending.body": "管理員正在審核你的資料，目前尚未公開。",
  "hub.status.approved": "已通過",
  "hub.status.approved.body": "你的資料已公開。",
  "hub.status.rejected": "需要修改",
  "hub.status.rejected.body": "管理員要求修改後才能公開。請修改資料後重新送審。",
  "hub.status.suspended": "已停用",
  "hub.status.suspended.body": "你的 Builder 資料已隱藏，目前無法編輯。",
  "hub.viewPublic": "查看公開資料",
  "hub.reviewNote": "管理員備註：",
  "hub.resubmit": "重新送審",
  "profile.title": "編輯資料",
  "profile.save": "儲存變更",
  "profile.saved": "已儲存。",
```

- [ ] **Step 6: CSS**

Thêm vào cuối `app.css`:

```css
.subnav { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 24px; }
.subnav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 8px; color: var(--ink-2); text-decoration: none; }
.subnav a[aria-current="page"] { background: var(--ink); color: var(--surface); }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); font-size: 14px; }
.badge-approved, .badge-avail-open { border-color: var(--good); color: var(--good); }
```

- [ ] **Step 7: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): builder hub overview, profile editing and resubmission" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: VNX-0203b — Portfolio (tối đa 12 mục)

**Files:**
- Create: `apps/web/src/domain/portfolio.ts`, `apps/web/src/db/portfolio.ts`, `apps/web/src/routes/hub-portfolio.tsx`, `apps/web/src/views/hub/PortfolioPage.tsx`
- Modify: `apps/web/src/views/hub/HubLayout.tsx` (thêm mục Portfolio), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/db/portfolio.test.ts`, `apps/web/test/hub/portfolio.test.ts`

**Interfaces:**
- Consumes: `isHttpsUrl` (Task 1), `requireBuilder`, `canEditProfile`, `HubLayout`, `PlainText`, `ulid`.
- Produces:
  - `domain/portfolio.ts`: `MAX_PORTFOLIO_ITEMS = 12`; type `PortfolioItem`, `PortfolioFormValues`, `PortfolioField`, `PortfolioErrors`, `PortfolioInput`; `portfolioValuesFromBody`, `portfolioValuesFromItem`, `parsePortfolioItem`.
  - `db/portfolio.ts`: `listPortfolio(db, builderId)`, `findPortfolioItem(db, builderId, id)`, `addPortfolioItem(db, { builderId, item, now })` → `PortfolioItem | null` (null khi đã đủ 12), `updatePortfolioItem`, `deletePortfolioItem`, `movePortfolioItem` → `boolean`.
  - Route: `GET|POST /hub/portfolio`, `GET|POST /hub/portfolio/:id`, `POST /hub/portfolio/:id/delete`, `POST /hub/portfolio/:id/move` (field `direction` = `up`|`down`).

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/db/portfolio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addPortfolioItem, deletePortfolioItem, listPortfolio, movePortfolioItem } from "../../src/db/portfolio.ts";
import { MAX_PORTFOLIO_ITEMS } from "../../src/domain/portfolio.ts";
import { makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const item = (title: string) => ({ title, url: null, description: "" });
const now = () => new Date().toISOString();

describe("db/portfolio", () => {
  it("appends in order and refuses the 13th item in the same statement", async () => {
    const b = await makeBuilder("pdb-cap@vnx.si", "pdb-cap");
    for (let i = 1; i <= MAX_PORTFOLIO_ITEMS; i++) expect(await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item(`P${i}`), now: now() })).not.toBeNull();
    expect(await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("P13"), now: now() })).toBeNull();
    const list = await listPortfolio(testEnv.DB, b.userId);
    expect(list.map((x) => x.title)).toEqual(Array.from({ length: 12 }, (_, i) => `P${i + 1}`));
    expect(list.map((x) => x.sort)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("moves within bounds and only touches the owner's items", async () => {
    const b = await makeBuilder("pdb-move@vnx.si", "pdb-move");
    const other = await makeBuilder("pdb-other@vnx.si", "pdb-other");
    const a = await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("A"), now: now() });
    await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: item("B"), now: now() });
    expect(await movePortfolioItem(testEnv.DB, { builderId: b.userId, id: a!.id, direction: "up", now: now() })).toBe(false);
    expect(await movePortfolioItem(testEnv.DB, { builderId: b.userId, id: a!.id, direction: "down", now: now() })).toBe(true);
    expect((await listPortfolio(testEnv.DB, b.userId)).map((x) => x.title)).toEqual(["B", "A"]);
    expect(await deletePortfolioItem(testEnv.DB, other.userId, a!.id)).toBe(false);
    expect(await deletePortfolioItem(testEnv.DB, b.userId, a!.id)).toBe(true);
  });
});
```

`apps/web/test/hub/portfolio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addPortfolioItem, findPortfolioItem, listPortfolio } from "../../src/db/portfolio.ts";
import { MAX_PORTFOLIO_ITEMS } from "../../src/domain/portfolio.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const titles = async (builderId: string) => (await listPortfolio(testEnv.DB, builderId)).map((x) => x.title);

describe("Hub portfolio (spec §5.3)", () => {
  it("adds, reorders, edits and deletes items", async () => {
    const b = await makeBuilder("pf-flow@vnx.si", "pf-flow");
    const { cookie } = await signIn("pf-flow@vnx.si");
    const added = await app().request(formPost("/hub/portfolio", { title: "Booking app", url: "https://booking.example", description: "Spa booking" }, { cookie }), undefined, testEnv);
    expect(added.status).toBe(303);
    expect(added.headers.get("location")).toBe("/hub/portfolio");
    await app().request(formPost("/hub/portfolio", { title: "CRM", url: "", description: "" }, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["Booking app", "CRM"]);

    const [first, second] = await listPortfolio(testEnv.DB, b.userId);
    await app().request(formPost(`/hub/portfolio/${second!.id}/move`, { direction: "up" }, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["CRM", "Booking app"]);

    const edit = await app().request(getReq(`/hub/portfolio/${second!.id}`, cookie), undefined, testEnv);
    expect(await edit.text()).toContain('value="CRM"');
    await app().request(formPost(`/hub/portfolio/${second!.id}`, { title: "CRM v2", url: "https://crm.example", description: "" }, { cookie }), undefined, testEnv);
    await app().request(formPost(`/hub/portfolio/${first!.id}/delete`, {}, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["CRM v2"]);

    const html = await (await app().request(getReq("/hub/portfolio", cookie), undefined, testEnv)).text();
    expect(html).toContain("CRM v2");
    expect(html).toMatch(/<a href="https:\/\/crm\.example" rel="nofollow ugc noopener"/);
  });

  it("validates input (400)", async () => {
    await makeBuilder("pf-bad@vnx.si", "pf-bad");
    const { cookie } = await signIn("pf-bad@vnx.si");
    const res = await app().request(formPost("/hub/portfolio", { title: "", url: "http://insecure.example", description: "" }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Enter a title (up to 80 characters).");
    expect(html).toContain('value="http://insecure.example"');
  });

  it("refuses a 13th item (409) and hides the add form", async () => {
    const b = await makeBuilder("pf-full@vnx.si", "pf-full");
    for (let i = 0; i < MAX_PORTFOLIO_ITEMS; i++) await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: { title: `P${i}`, url: null, description: "" }, now: new Date().toISOString() });
    const { cookie } = await signIn("pf-full@vnx.si");
    expect((await app().request(formPost("/hub/portfolio", { title: "One more", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(409);
    expect(await (await app().request(getReq("/hub/portfolio", cookie), undefined, testEnv)).text()).toContain("reached the limit of 12 projects");
  });

  it("404s on another builder's items and leaves them untouched", async () => {
    const owner = await makeBuilder("pf-owner@vnx.si", "pf-owner");
    const theirs = await addPortfolioItem(testEnv.DB, { builderId: owner.userId, item: { title: "Mine", url: null, description: "" }, now: new Date().toISOString() });
    await makeBuilder("pf-intruder@vnx.si", "pf-intruder");
    const { cookie } = await signIn("pf-intruder@vnx.si");
    const id = theirs!.id;
    expect((await app().request(getReq(`/hub/portfolio/${id}`, cookie), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/portfolio/${id}`, { title: "Hacked", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/portfolio/${id}/delete`, {}, { cookie }), undefined, testEnv)).status).toBe(404);
    expect(await findPortfolioItem(testEnv.DB, owner.userId, id)).toMatchObject({ title: "Mine" });
  });

  it("blocks changes while suspended (409)", async () => {
    await makeBuilder("pf-susp@vnx.si", "pf-susp", "suspended");
    const { cookie } = await signIn("pf-susp@vnx.si");
    expect((await app().request(formPost("/hub/portfolio", { title: "X", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});
```

Run: `npm test -w apps/web -- test/db/portfolio.test.ts test/hub/portfolio.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain và DB**

`apps/web/src/domain/portfolio.ts`:

```ts
import { z } from "zod";
import { isHttpsUrl } from "./builder-input.ts";

export const MAX_PORTFOLIO_ITEMS = 12;

export interface PortfolioItem {
  id: string;
  builderId: string;
  title: string;
  url: string | null;
  description: string;
  imageKey: string | null;
  sort: number;
}

export type PortfolioFormValues = { title: string; url: string; description: string };
export type PortfolioField = keyof PortfolioFormValues;
export type PortfolioErrors = Partial<Record<PortfolioField, true>>;
export type PortfolioInput = Pick<PortfolioItem, "title" | "url" | "description">;

const Schema = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.string().trim().max(500).refine((v) => v === "" || isHttpsUrl(v)),
  description: z.string().trim().max(500),
});

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function portfolioValuesFromBody(body: Record<string, unknown>): PortfolioFormValues {
  return { title: str(body.title), url: str(body.url), description: str(body.description) };
}

export function portfolioValuesFromItem(item: PortfolioItem): PortfolioFormValues {
  return { title: item.title, url: item.url ?? "", description: item.description };
}

export function parsePortfolioItem(values: PortfolioFormValues): { ok: true; item: PortfolioInput } | { ok: false; errors: PortfolioErrors } {
  const result = Schema.safeParse(values);
  if (!result.success) {
    const errors: PortfolioErrors = {};
    for (const issue of result.error.issues) errors[issue.path[0] as PortfolioField] = true;
    return { ok: false, errors };
  }
  return { ok: true, item: { title: result.data.title, url: result.data.url || null, description: result.data.description } };
}
```

`apps/web/src/db/portfolio.ts`:

```ts
import { MAX_PORTFOLIO_ITEMS, type PortfolioInput, type PortfolioItem } from "../domain/portfolio.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; builder_id: string; title: string; url: string | null; description: string; image_key: string | null; sort: number };

function toItem(r: Row): PortfolioItem {
  return { id: r.id, builderId: r.builder_id, title: r.title, url: r.url, description: r.description, imageKey: r.image_key, sort: r.sort };
}

export async function listPortfolio(db: D1Database, builderId: string): Promise<PortfolioItem[]> {
  const { results } = await db.prepare("SELECT * FROM portfolio_items WHERE builder_id = ?1 ORDER BY sort, id").bind(builderId).all<Row>();
  return results.map(toItem);
}

export async function findPortfolioItem(db: D1Database, builderId: string, id: string): Promise<PortfolioItem | null> {
  const row = await db.prepare("SELECT * FROM portfolio_items WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).first<Row>();
  return row ? toItem(row) : null;
}

/** Appends an item; returns null when the builder already has MAX_PORTFOLIO_ITEMS (checked in the same statement). */
export async function addPortfolioItem(db: D1Database, input: { builderId: string; item: PortfolioInput; now: string }): Promise<PortfolioItem | null> {
  const id = ulid(Date.parse(input.now));
  const res = await db
    .prepare(
      `INSERT INTO portfolio_items (id, builder_id, title, url, description, sort, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, (SELECT COALESCE(MAX(sort), 0) + 1 FROM portfolio_items WHERE builder_id = ?2), ?6, ?6
       WHERE (SELECT COUNT(*) FROM portfolio_items WHERE builder_id = ?2) < ?7`,
    )
    .bind(id, input.builderId, input.item.title, input.item.url, input.item.description, input.now, MAX_PORTFOLIO_ITEMS)
    .run();
  return res.meta.changes === 1 ? findPortfolioItem(db, input.builderId, id) : null;
}

export async function updatePortfolioItem(db: D1Database, input: { builderId: string; id: string; item: PortfolioInput; now: string }): Promise<boolean> {
  const res = await db
    .prepare("UPDATE portfolio_items SET title = ?3, url = ?4, description = ?5, updated_at = ?6 WHERE id = ?1 AND builder_id = ?2")
    .bind(input.id, input.builderId, input.item.title, input.item.url, input.item.description, input.now)
    .run();
  return res.meta.changes === 1;
}

export async function deletePortfolioItem(db: D1Database, builderId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM portfolio_items WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).run();
  return res.meta.changes === 1;
}

/** Swaps the item with its neighbour. False when it is already at that edge or not the builder's. */
export async function movePortfolioItem(db: D1Database, input: { builderId: string; id: string; direction: "up" | "down"; now: string }): Promise<boolean> {
  const items = await listPortfolio(db, input.builderId);
  const index = items.findIndex((x) => x.id === input.id);
  const current = items[index];
  const neighbour = items[input.direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !current || !neighbour) return false;
  const stmt = db.prepare("UPDATE portfolio_items SET sort = ?3, updated_at = ?4 WHERE id = ?1 AND builder_id = ?2");
  await db.batch([stmt.bind(current.id, input.builderId, neighbour.sort, input.now), stmt.bind(neighbour.id, input.builderId, current.sort, input.now)]);
  return true;
}
```

- [ ] **Step 3: View**

`apps/web/src/views/hub/HubLayout.tsx`: đổi `HubSection` thành `"overview" | "profile" | "portfolio"` và thêm vào cuối `NAV`: `{ key: "portfolio", path: "/hub/portfolio", label: "hub.nav.portfolio" }`.

`apps/web/src/views/hub/PortfolioPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { MAX_PORTFOLIO_ITEMS, type PortfolioErrors, type PortfolioField, type PortfolioFormValues, type PortfolioItem } from "../../domain/portfolio.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

const EXTERNAL = "nofollow ugc noopener";
const ERROR_KEY: Record<PortfolioField, MessageKey> = {
  title: "portfolio.error.title",
  url: "portfolio.error.url",
  description: "portfolio.error.description",
};

const PortfolioForm: FC<{ locale: Locale; action: string; values: PortfolioFormValues; errors: PortfolioErrors; submitLabel: string }> = (p) => {
  const tr = translator(p.locale);
  const field = (name: PortfolioField, label: MessageKey, control: (aria: Record<string, string | undefined>) => unknown) => (
    <div class="field">
      <label for={`pf-${name}`}>{tr(label)}</label>
      {control({ "aria-invalid": p.errors[name] ? "true" : undefined, "aria-describedby": p.errors[name] ? `pf-${name}-error` : undefined })}
      {p.errors[name] ? (
        <p id={`pf-${name}-error`} class="error-msg">
          {tr(ERROR_KEY[name])}
        </p>
      ) : null}
    </div>
  );
  return (
    <form method="post" action={p.action}>
      {field("title", "portfolio.field.title", (aria) => (
        <input id="pf-title" name="title" value={p.values.title} required maxlength={80} {...aria} />
      ))}
      {field("url", "portfolio.field.url", (aria) => (
        <input id="pf-url" name="url" type="url" value={p.values.url} maxlength={500} placeholder="https://" {...aria} />
      ))}
      {field("description", "portfolio.field.description", (aria) => (
        <textarea id="pf-description" name="description" rows={3} maxlength={500} {...aria}>
          {p.values.description}
        </textarea>
      ))}
      <button class="btn" type="submit">
        {p.submitLabel}
      </button>
    </form>
  );
};

type ListProps = { locale: Locale; origin: string; items: PortfolioItem[]; values: PortfolioFormValues; errors: PortfolioErrors; editable: boolean };

export const PortfolioPage: FC<ListProps> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/hub/portfolio");
  const move = (item: PortfolioItem, direction: "up" | "down", label: MessageKey) => (
    <form method="post" action={`${base}/${item.id}/move`}>
      <input type="hidden" name="direction" value={direction} />
      <button class="link" type="submit">
        {tr(label)}
      </button>
    </form>
  );
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("portfolio.title")} rest="/hub/portfolio" active="portfolio">
      <h1>{tr("portfolio.title")}</h1>
      <p>{tr("portfolio.intro", { max: MAX_PORTFOLIO_ITEMS })}</p>
      {p.items.length === 0 ? (
        <p class="muted">{tr("portfolio.empty")}</p>
      ) : (
        <ol class="portfolio-list">
          {p.items.map((item, index) => (
            <li>
              <h2>{item.title}</h2>
              {item.url ? (
                <p>
                  <a href={item.url} rel={EXTERNAL} target="_blank">
                    {item.url}
                  </a>
                </p>
              ) : null}
              {item.description ? <PlainText text={item.description} /> : null}
              {p.editable ? (
                <div class="row-actions">
                  <a href={`${base}/${item.id}`}>{tr("portfolio.edit")}</a>
                  {index > 0 ? move(item, "up", "portfolio.moveUp") : null}
                  {index < p.items.length - 1 ? move(item, "down", "portfolio.moveDown") : null}
                  <form method="post" action={`${base}/${item.id}/delete`}>
                    <button class="link" type="submit">
                      {tr("portfolio.delete")}
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {!p.editable ? null : p.items.length >= MAX_PORTFOLIO_ITEMS ? (
        <p class="notice">{tr("portfolio.full", { max: MAX_PORTFOLIO_ITEMS })}</p>
      ) : (
        <section class="card wide">
          <h2>{tr("portfolio.add")}</h2>
          <PortfolioForm locale={p.locale} action={base} values={p.values} errors={p.errors} submitLabel={tr("portfolio.add")} />
        </section>
      )}
    </HubLayout>
  );
};

type EditProps = { locale: Locale; origin: string; item: PortfolioItem; values: PortfolioFormValues; errors: PortfolioErrors };

export const PortfolioEditPage: FC<EditProps> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/hub/portfolio");
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("portfolio.editTitle")} rest={`/hub/portfolio/${p.item.id}`} active="portfolio">
      <section class="card wide">
        <h1>{tr("portfolio.editTitle")}</h1>
        <PortfolioForm locale={p.locale} action={`${base}/${p.item.id}`} values={p.values} errors={p.errors} submitLabel={tr("portfolio.save")} />
        <p>
          <a href={base}>{tr("portfolio.back")}</a>
        </p>
      </section>
    </HubLayout>
  );
};
```

- [ ] **Step 4: Route**

`apps/web/src/routes/hub-portfolio.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { addPortfolioItem, deletePortfolioItem, findPortfolioItem, listPortfolio, movePortfolioItem, updatePortfolioItem } from "../db/portfolio.ts";
import { canEditProfile } from "../domain/builder.ts";
import { parsePortfolioItem, portfolioValuesFromBody, portfolioValuesFromItem, type PortfolioErrors, type PortfolioFormValues } from "../domain/portfolio.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { PortfolioEditPage, PortfolioPage } from "../views/hub/PortfolioPage.tsx";
import { page } from "../views/render.ts";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EMPTY: PortfolioFormValues = { title: "", url: "", description: "" };

async function listPage(c: Context<AppEnv>, values: PortfolioFormValues, errors: PortfolioErrors, status: 200 | 400 = 200) {
  const builder = c.get("builder");
  const items = await listPortfolio(c.env.DB, builder.userId);
  return page(
    c,
    <PortfolioPage locale={c.get("locale")} origin={requestOrigin(c)} items={items} values={values} errors={errors} editable={canEditProfile(builder.status)} />,
    status,
  );
}

/** The item only if it belongs to the signed-in builder; anything else reads as missing. */
async function ownedItem(c: Context<AppEnv>) {
  const id = c.req.param("id") ?? "";
  return ULID.test(id) ? findPortfolioItem(c.env.DB, c.get("builder").userId, id) : null;
}

const back = (c: Context<AppEnv>) => c.redirect(localizedPath(c.get("locale"), "/hub/portfolio"), 303);

export function registerPortfolioRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/portfolio", requireBuilder, (c) => listPage(c, EMPTY, {}));

  onLocalized(app, "post", "/hub/portfolio", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const values = portfolioValuesFromBody(await c.req.parseBody());
    const parsed = parsePortfolioItem(values);
    if (!parsed.ok) return listPage(c, values, parsed.errors, 400);
    const added = await addPortfolioItem(c.env.DB, { builderId: builder.userId, item: parsed.item, now: new Date().toISOString() });
    if (!added) return errorResponse(c, "conflict", 409);
    return back(c);
  });

  onLocalized(app, "get", "/hub/portfolio/:id", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    return page(c, <PortfolioEditPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} values={portfolioValuesFromItem(item)} errors={{}} />);
  });

  onLocalized(app, "post", "/hub/portfolio/:id", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const values = portfolioValuesFromBody(await c.req.parseBody());
    const parsed = parsePortfolioItem(values);
    if (!parsed.ok) return page(c, <PortfolioEditPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} values={values} errors={parsed.errors} />, 400);
    await updatePortfolioItem(c.env.DB, { builderId: item.builderId, id: item.id, item: parsed.item, now: new Date().toISOString() });
    return back(c);
  });

  onLocalized(app, "post", "/hub/portfolio/:id/delete", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    await deletePortfolioItem(c.env.DB, item.builderId, item.id);
    return back(c);
  });

  onLocalized(app, "post", "/hub/portfolio/:id/move", requireBuilder, async (c) => {
    const item = await ownedItem(c);
    if (!item) return errorResponse(c, "notFound", 404);
    if (!canEditProfile(c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const direction = (await c.req.parseBody()).direction;
    // An unknown direction or a move past the edge is a no-op.
    if (direction === "up" || direction === "down") {
      await movePortfolioItem(c.env.DB, { builderId: item.builderId, id: item.id, direction, now: new Date().toISOString() });
    }
    return back(c);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerPortfolioRoutes(app);` sau `registerHubRoutes(app);`.

- [ ] **Step 5: Key i18n**

`en.ts`:

```ts
  "hub.nav.portfolio": "Portfolio",
  "portfolio.title": "Portfolio",
  "portfolio.intro": "Show up to {max} projects you have built.",
  "portfolio.empty": "No projects yet.",
  "portfolio.field.title": "Project title",
  "portfolio.field.url": "Link (optional)",
  "portfolio.field.description": "Short description (optional)",
  "portfolio.error.title": "Enter a title (up to 80 characters).",
  "portfolio.error.url": "Enter a full https:// address, or leave it empty.",
  "portfolio.error.description": "Keep the description under 500 characters.",
  "portfolio.add": "Add project",
  "portfolio.full": "You've reached the limit of {max} projects. Remove one to add another.",
  "portfolio.edit": "Edit",
  "portfolio.editTitle": "Edit project",
  "portfolio.save": "Save",
  "portfolio.delete": "Delete",
  "portfolio.moveUp": "Move up",
  "portfolio.moveDown": "Move down",
  "portfolio.back": "Back to portfolio",
```

`vi.ts`:

```ts
  "hub.nav.portfolio": "Portfolio",
  "portfolio.title": "Portfolio",
  "portfolio.intro": "Giới thiệu tối đa {max} dự án bạn đã làm.",
  "portfolio.empty": "Chưa có dự án nào.",
  "portfolio.field.title": "Tên dự án",
  "portfolio.field.url": "Link (không bắt buộc)",
  "portfolio.field.description": "Mô tả ngắn (không bắt buộc)",
  "portfolio.error.title": "Nhập tên dự án (tối đa 80 ký tự).",
  "portfolio.error.url": "Nhập địa chỉ đầy đủ bắt đầu bằng https://, hoặc để trống.",
  "portfolio.error.description": "Mô tả tối đa 500 ký tự.",
  "portfolio.add": "Thêm dự án",
  "portfolio.full": "Bạn đã đạt giới hạn {max} dự án. Xóa bớt một dự án để thêm mới.",
  "portfolio.edit": "Sửa",
  "portfolio.editTitle": "Sửa dự án",
  "portfolio.save": "Lưu",
  "portfolio.delete": "Xóa",
  "portfolio.moveUp": "Lên trên",
  "portfolio.moveDown": "Xuống dưới",
  "portfolio.back": "Quay lại portfolio",
```

`zh-hans.ts`:

```ts
  "hub.nav.portfolio": "作品集",
  "portfolio.title": "作品集",
  "portfolio.intro": "展示最多 {max} 个你做过的项目。",
  "portfolio.empty": "还没有项目。",
  "portfolio.field.title": "项目名称",
  "portfolio.field.url": "链接（可选）",
  "portfolio.field.description": "简短描述（可选）",
  "portfolio.error.title": "请输入项目名称（最多 80 个字符）。",
  "portfolio.error.url": "请输入以 https:// 开头的完整地址，或留空。",
  "portfolio.error.description": "描述最多 500 个字符。",
  "portfolio.add": "添加项目",
  "portfolio.full": "已达到 {max} 个项目的上限。请先删除一个再添加。",
  "portfolio.edit": "编辑",
  "portfolio.editTitle": "编辑项目",
  "portfolio.save": "保存",
  "portfolio.delete": "删除",
  "portfolio.moveUp": "上移",
  "portfolio.moveDown": "下移",
  "portfolio.back": "返回作品集",
```

`zh-hant.ts`:

```ts
  "hub.nav.portfolio": "作品集",
  "portfolio.title": "作品集",
  "portfolio.intro": "展示最多 {max} 個你做過的專案。",
  "portfolio.empty": "還沒有專案。",
  "portfolio.field.title": "專案名稱",
  "portfolio.field.url": "連結（選填）",
  "portfolio.field.description": "簡短描述（選填）",
  "portfolio.error.title": "請輸入專案名稱（最多 80 個字元）。",
  "portfolio.error.url": "請輸入以 https:// 開頭的完整網址，或留空。",
  "portfolio.error.description": "描述最多 500 個字元。",
  "portfolio.add": "新增專案",
  "portfolio.full": "已達到 {max} 個專案的上限。請先刪除一個再新增。",
  "portfolio.edit": "編輯",
  "portfolio.editTitle": "編輯專案",
  "portfolio.save": "儲存",
  "portfolio.delete": "刪除",
  "portfolio.moveUp": "上移",
  "portfolio.moveDown": "下移",
  "portfolio.back": "返回作品集",
```

- [ ] **Step 6: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.portfolio-list { list-style: none; padding: 0; display: grid; gap: 12px; }
.portfolio-list > li { border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; background: var(--surface); }
.portfolio-list h2, .portfolio-list h3 { margin: 0 0 4px; font-size: 18px; }
.row-actions { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.row-actions form { margin: 0; }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): builder portfolio with a 12-item cap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: VNX-0204 — Trang công khai `/b/:handle`

**Files:**
- Create: `apps/web/src/routes/builder-profile.tsx`, `apps/web/src/views/BuilderProfilePage.tsx`, `apps/web/src/views/format.ts`
- Modify: `apps/web/src/db/builders.ts` (thêm `findPublicBuilderByHandle`), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/public/builder-profile.test.ts`

**Interfaces:**
- Consumes: `HANDLE_RE`, `listPortfolio`, `countryName`, `KIND_KEY`, `AVAILABILITY_KEY`, `LANGUAGE_KEY`, `PlainText`, `Layout` (hreflang, canonical).
- Produces:
  - `findPublicBuilderByHandle(db, handle): Promise<Builder | null>`: chỉ builder `approved` có user `active`.
  - `formatUsd(locale, cents): string` (`Intl.NumberFormat`, không lẻ).
  - `registerBuilderProfileRoutes(app)`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/public/builder-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addPortfolioItem } from "../../src/db/portfolio.ts";
import { makeBuilder } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);

describe("/b/:handle (spec §5.2)", () => {
  it("renders an approved builder with escaped text, safe links and hreflang", async () => {
    const b = await makeBuilder("pub-one@vnx.si", "pub-one", "approved", { bio: "Hi <script>alert(1)</script>\n\n- Booking", websiteUrl: "https://pub.example" });
    await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: { title: "Spa booking", url: "https://spa.example", description: "" }, now: new Date().toISOString() });
    const res = await get("/b/pub-one");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Lan Nguyen", "I build booking apps with AI", "Vietnam", "$45/hour", "Open to new work", "Spa booking", "Next.js", "Claude Code"]) expect(html).toContain(text);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toMatch(/<a href="https:\/\/pub\.example" rel="nofollow ugc noopener"/);
    expect(html).toMatch(/<a href="https:\/\/spa\.example" rel="nofollow ugc noopener"/);
    expect(html).toContain('hreflang="vi" href="https://vnx.si/vi/b/pub-one"');
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/b/pub-one"');
    expect(html).not.toContain('name="robots"');
  });

  it("localizes labels, country and money", async () => {
    await makeBuilder("pub-vi@vnx.si", "pub-vi", "approved");
    const html = await (await get("/vi/b/pub-vi")).text();
    expect(html).toContain("Việt Nam");
    expect(html).toContain("Đang nhận việc");
    expect(html).toMatch(/45\sUS\$\/giờ/);
  });

  it.each(["pending", "rejected", "suspended"] as const)("404s for a %s builder", async (status) => {
    await makeBuilder(`pub-${status}@vnx.si`, `pub-${status}`, status);
    expect((await get(`/b/pub-${status}`)).status).toBe(404);
  });

  it("404s when the builder's account is suspended", async () => {
    const b = await makeBuilder("pub-locked@vnx.si", "pub-locked", "approved");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(b.userId).run();
    expect((await get("/b/pub-locked")).status).toBe(404);
  });

  it("redirects upper-case handles and 404s on unknown or malformed ones", async () => {
    await makeBuilder("pub-case@vnx.si", "pub-case", "approved");
    const res = await get("/vi/b/Pub-Case");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/vi/b/pub-case");
    expect((await get("/b/nobody-here")).status).toBe(404);
    expect((await get("/b/a")).status).toBe(404);
  });
});
```

Run: `npm test -w apps/web -- test/public/builder-profile.test.ts`
Expected: FAIL.

- [ ] **Step 2: Truy vấn công khai và định dạng tiền**

Thêm vào `apps/web/src/db/builders.ts`:

```ts
/** Public = approved builder on an active account (spec §7.1, §8.2). Anything else reads as missing. */
export async function findPublicBuilderByHandle(db: D1Database, handle: string): Promise<Builder | null> {
  const row = await db
    .prepare(
      `SELECT b.* FROM builders b JOIN users u ON u.id = b.user_id
       WHERE b.handle = ?1 AND b.status = 'approved' AND u.status = 'active'`,
    )
    .bind(handle)
    .first<BuilderRow>();
  return row ? toBuilder(row) : null;
}
```

`apps/web/src/views/format.ts`:

```ts
import type { Locale } from "../i18n/locales.ts";

/** Whole US dollars in the viewer's locale (spec §4: USD only, stored as cents). */
export function formatUsd(locale: Locale, cents: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
```

- [ ] **Step 3: View và route**

`apps/web/src/views/BuilderProfilePage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { Builder } from "../domain/builder.ts";
import type { PortfolioItem } from "../domain/portfolio.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { countryName } from "./country.ts";
import { formatUsd } from "./format.ts";
import { AVAILABILITY_KEY, KIND_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

const EXTERNAL = "nofollow ugc noopener";

type Props = { locale: Locale; origin: string; builder: Builder; portfolio: PortfolioItem[]; signedIn: boolean };

/** Products and the Hire button arrive with M3 and M5; nothing is rendered for them yet. */
export const BuilderProfilePage: FC<Props> = ({ locale, origin, builder, portfolio, signedIn }) => {
  const tr = translator(locale);
  return (
    <Layout locale={locale} title={`${builder.name} · VNX.SI`} description={builder.headline} origin={origin} rest={`/b/${builder.handle}`} signedIn={signedIn}>
      <article class="profile">
        <header>
          <h1>{builder.name}</h1>
          <p class="muted">
            @{builder.handle} · {tr(KIND_KEY[builder.kind])} · {countryName(locale, builder.country)}
          </p>
          <p class="lead">{builder.headline}</p>
          <p>
            <span class={`badge badge-avail-${builder.availability}`}>{tr(AVAILABILITY_KEY[builder.availability])}</span>
            {builder.hourlyRateCents !== null ? <span class="rate">{tr("bprofile.rate", { amount: formatUsd(locale, builder.hourlyRateCents) })}</span> : null}
          </p>
          {builder.websiteUrl ? (
            <p>
              <a href={builder.websiteUrl} rel={EXTERNAL} target="_blank">
                {tr("bprofile.website")}
              </a>
            </p>
          ) : null}
        </header>

        <PlainText text={builder.bio} />

        <dl class="facts">
          <dt>{tr("bprofile.skills")}</dt>
          <dd>
            <ul class="chips">
              {builder.skills.map((s) => (
                <li>{s}</li>
              ))}
            </ul>
          </dd>
          {builder.aiTools.length > 0 ? (
            <>
              <dt>{tr("bprofile.aiTools")}</dt>
              <dd>
                <ul class="chips">
                  {builder.aiTools.map((s) => (
                    <li>{s}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {builder.workLanguages.length > 0 ? (
            <>
              <dt>{tr("bprofile.languages")}</dt>
              <dd>{builder.workLanguages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</dd>
            </>
          ) : null}
        </dl>

        {portfolio.length > 0 ? (
          <section>
            <h2>{tr("bprofile.portfolio")}</h2>
            <ul class="portfolio-list">
              {portfolio.map((item) => (
                <li>
                  <h3>
                    {item.url ? (
                      <a href={item.url} rel={EXTERNAL} target="_blank">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  {item.description ? <PlainText text={item.description} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </Layout>
  );
};
```

`apps/web/src/routes/builder-profile.tsx`:

```tsx
import type { Hono } from "hono";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { listPortfolio } from "../db/portfolio.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { BuilderProfilePage } from "../views/BuilderProfilePage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerBuilderProfileRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/b/:handle", async (c) => {
    const raw = c.req.param("handle") ?? "";
    const handle = raw.toLowerCase();
    if (!HANDLE_RE.test(handle)) return errorResponse(c, "notFound", 404);
    if (raw !== handle) return c.redirect(localizedPath(c.get("locale"), `/b/${handle}`), 301);
    const builder = await findPublicBuilderByHandle(c.env.DB, handle);
    if (!builder) return errorResponse(c, "notFound", 404);
    const portfolio = await listPortfolio(c.env.DB, builder.userId);
    return page(c, <BuilderProfilePage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} portfolio={portfolio} signedIn={c.get("user") !== null} />);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerBuilderProfileRoutes(app);` sau `registerPortfolioRoutes(app);`.

- [ ] **Step 4: Key i18n**

`en.ts`:

```ts
  "bprofile.skills": "Skills",
  "bprofile.aiTools": "AI tools",
  "bprofile.languages": "Works in",
  "bprofile.rate": "{amount}/hour",
  "bprofile.website": "Website",
  "bprofile.portfolio": "Portfolio",
```

`vi.ts`:

```ts
  "bprofile.skills": "Kỹ năng",
  "bprofile.aiTools": "Công cụ AI",
  "bprofile.languages": "Ngôn ngữ làm việc",
  "bprofile.rate": "{amount}/giờ",
  "bprofile.website": "Website",
  "bprofile.portfolio": "Portfolio",
```

`zh-hans.ts`:

```ts
  "bprofile.skills": "技能",
  "bprofile.aiTools": "AI 工具",
  "bprofile.languages": "工作语言",
  "bprofile.rate": "{amount}/小时",
  "bprofile.website": "网站",
  "bprofile.portfolio": "作品集",
```

`zh-hant.ts`:

```ts
  "bprofile.skills": "技能",
  "bprofile.aiTools": "AI 工具",
  "bprofile.languages": "工作語言",
  "bprofile.rate": "{amount}/小時",
  "bprofile.website": "網站",
  "bprofile.portfolio": "作品集",
```

- [ ] **Step 5: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.profile { max-width: 860px; }
.profile .lead { font-size: 18px; color: var(--ink-2); }
.rate { margin-left: 8px; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 0; }
.chips li { padding: 2px 10px; border: 1px solid var(--line); border-radius: 999px; font-size: 14px; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; }
.facts dd { margin: 0; }
@media (max-width: 560px) { .facts { grid-template-columns: 1fr; } }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): public builder profile page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: VNX-0205a — Admin: hàng chờ builder, duyệt / từ chối, email

**Files:**
- Create: `apps/web/src/routes/admin.tsx`, `apps/web/src/views/admin/AdminLayout.tsx`, `apps/web/src/views/admin/BuildersPage.tsx`, `apps/web/src/views/admin/BuilderDetailPage.tsx`, `apps/web/src/email/templates/builder-decision.ts`
- Modify: `apps/web/src/db/builders.ts` (thêm `findBuilderAccount`, `listBuildersByStatus`), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/admin/builders.test.ts`, `apps/web/test/email/builder-decision.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `transition`, `setBuilderStatus`, `isBuilderStatus`, `STATUS_KEY`, `KIND_KEY`, `countryName`, `getMailer`, `escapeHtml`, `isLocale`.
- Produces:
  - `db/builders.ts`: `findBuilderAccount(db, userId): Promise<BuilderAccount | null>`, `listBuildersByStatus(db, status, limit = 200): Promise<BuilderAccount[]>` (cũ nhất trước).
  - `email/templates/builder-decision.ts`: `builderApprovedEmail(locale, { name, profileUrl, hubUrl })`, `builderRejectedEmail(locale, { name, reason, profileUrl })`.
  - `AdminLayout` props `{ locale, origin, title, rest, active: "builders" }` (Task 8, 9 thêm mục).
  - `routes/admin.tsx`: `registerAdminRoutes(app)`; hàm `decide(c, action)` dùng chung cho mọi hành động admin trên builder; bảng `REASON` quy định lý do bắt buộc / tùy chọn / không có.
  - Audit actions: `builder.approve`, `builder.reject`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/email/builder-decision.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { builderApprovedEmail, builderRejectedEmail } from "../../src/email/templates/builder-decision.ts";

describe("builder decision e-mails", () => {
  it("approval links the profile and the hub in the builder's language", () => {
    const mail = builderApprovedEmail("vi", { name: "Lan", profileUrl: "https://vnx.si/vi/b/lan", hubUrl: "https://vnx.si/vi/hub" });
    expect(mail.subject).toBe("Hồ sơ builder của bạn trên VNX.SI đã được duyệt");
    expect(mail.text).toContain("Chào Lan");
    expect(mail.text).toContain("https://vnx.si/vi/b/lan");
    expect(mail.html).toContain('<a href="https://vnx.si/vi/hub">');
  });

  it("rejection carries the reason, escaped in HTML", () => {
    const mail = builderRejectedEmail("en", { name: "<b>Lan</b>", reason: "Add <i>real</i> projects", profileUrl: "https://vnx.si/hub/profile" });
    expect(mail.text).toContain("Add <i>real</i> projects");
    expect(mail.html).toContain("Add &lt;i&gt;real&lt;/i&gt; projects");
    expect(mail.html).toContain("&lt;b&gt;Lan&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Lan</b>");
  });
});
```

`apps/web/test/admin/builders.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });

describe("admin builder queue (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    expect((await app().request(getReq("/admin/builders"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fadmin%2Fbuilders");
    const { cookie } = await signIn("adm-nobody@vnx.si");
    expect((await app().request(getReq("/admin/builders", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost("/admin/builders/x/approve", {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });

  it("lists builders by status with their e-mail", async () => {
    await makeBuilder("adm-list@vnx.si", "adm-list");
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/builders", cookie), undefined, testEnv)).text();
    expect(html).toContain("adm-list");
    expect(html).toContain("adm-list@vnx.si");
    const approved = await (await app().request(getReq("/admin/builders?status=approved", cookie), undefined, testEnv)).text();
    expect(approved).not.toContain("adm-list@vnx.si");
  });

  it("approves, e-mails the builder in their language and makes the profile public", async () => {
    await ensureUser("adm-approve@vnx.si", "vi");
    const b = await makeBuilder("adm-approve@vnx.si", "adm-approve");
    const { user, cookie } = await admin();
    expect((await app().request(getReq("/b/adm-approve"), undefined, testEnv)).status).toBe(404);

    const res = await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "adm-approve@vnx.si", subject: "Hồ sơ builder của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain("https://vnx.si/vi/b/adm-approve");
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE action = 'builder.approve' AND entity_id = ?1").bind(b.userId).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect((await app().request(getReq("/b/adm-approve"), undefined, testEnv)).status).toBe(200);
    expect(await (await app().request(getReq(`/admin/builders/${b.userId}?done=1`, cookie), undefined, testEnv)).text()).toContain("Saved.");
  });

  it("requires a reason to reject and sends it to the builder", async () => {
    const b = await makeBuilder("adm-reject@vnx.si", "adm-reject");
    const { cookie } = await admin();
    const missing = await app().request(formPost(`/admin/builders/${b.userId}/reject`, { reason: "  " }, { cookie }), undefined, testEnv);
    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain("Enter a reason (up to 500 characters).");
    expect(outbox).toHaveLength(0);

    await app().request(formPost(`/admin/builders/${b.userId}/reject`, { reason: "Add real projects" }, { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "rejected", reviewNote: "Add real projects" });
    expect(outbox[0]!.text).toContain("Add real projects");
  });

  it("returns 409 for a decision on a builder that is no longer pending", async () => {
    const b = await makeBuilder("adm-twice@vnx.si", "adm-twice", "approved");
    const { cookie } = await admin();
    expect((await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("keeps the decision and tells the admin when the e-mail fails", async () => {
    const b = await makeBuilder("adm-nomail@vnx.si", "adm-nomail");
    const { cookie } = await admin();
    const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings;
    const res = await app().request(formPost(`/admin/builders/${b.userId}/approve`, {}, { cookie }), undefined, noMail);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=mail_failed`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved" });
  });

  it("404s on an unknown builder", async () => {
    const { cookie } = await admin();
    expect((await app().request(getReq("/admin/builders/01ZZZZZZZZZZZZZZZZZZZZZZZZ", cookie), undefined, testEnv)).status).toBe(404);
  });
});
```

Run: `npm test -w apps/web -- test/admin/builders.test.ts test/email/builder-decision.test.ts`
Expected: FAIL.

- [ ] **Step 2: Truy vấn admin**

Thêm vào `apps/web/src/db/builders.ts` (thêm `BuilderAccount` vào import type từ `../domain/builder.ts`):

```ts
type AccountRow = BuilderRow & { email: string; user_locale: string; user_status: "active" | "suspended" };

const ACCOUNT_SELECT = "SELECT b.*, u.email, u.locale AS user_locale, u.status AS user_status FROM builders b JOIN users u ON u.id = b.user_id";

function toAccount(r: AccountRow): BuilderAccount {
  return { ...toBuilder(r), email: r.email, userLocale: r.user_locale, userStatus: r.user_status };
}

export async function findBuilderAccount(db: D1Database, userId: string): Promise<BuilderAccount | null> {
  const row = await db.prepare(`${ACCOUNT_SELECT} WHERE b.user_id = ?1`).bind(userId).first<AccountRow>();
  return row ? toAccount(row) : null;
}

/** Oldest first, so the review queue is first come, first served. */
export async function listBuildersByStatus(db: D1Database, status: BuilderStatus, limit = 200): Promise<BuilderAccount[]> {
  const { results } = await db.prepare(`${ACCOUNT_SELECT} WHERE b.status = ?1 ORDER BY b.created_at, b.user_id LIMIT ?2`).bind(status, limit).all<AccountRow>();
  return results.map(toAccount);
}
```

- [ ] **Step 3: Email**

`apps/web/src/email/templates/builder-decision.ts`:

```ts
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;

function wrap(locale: Locale, parts: string[]): string {
  return `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;
}

export function builderApprovedEmail(locale: Locale, input: { name: string; profileUrl: string; hubUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.builderApproved.body", { name: input.name });
  const cta = tr("email.builderApproved.cta");
  return {
    subject: tr("email.builderApproved.subject"),
    text: `${body}\n${input.profileUrl}\n\n${cta}\n${input.hubUrl}`,
    html: wrap(locale, [p(body), link(input.profileUrl), p(cta), link(input.hubUrl)]),
  };
}

export function builderRejectedEmail(locale: Locale, input: { name: string; reason: string; profileUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.builderRejected.body", { name: input.name });
  const cta = tr("email.builderRejected.cta");
  return {
    subject: tr("email.builderRejected.subject"),
    text: `${body}\n\n${input.reason}\n\n${cta}\n${input.profileUrl}`,
    html: wrap(locale, [p(body), quote(input.reason), p(cta), link(input.profileUrl)]),
  };
}
```

- [ ] **Step 4: View admin**

`apps/web/src/views/admin/AdminLayout.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";

export type AdminSection = "builders";

const NAV: { key: AdminSection; path: string; label: MessageKey }[] = [{ key: "builders", path: "/admin/builders", label: "admin.nav.builders" }];

export const AdminLayout: FC<PropsWithChildren<{ locale: Locale; origin: string; title: string; rest: string; active: AdminSection }>> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={`${p.title} · ${tr("admin.title")}`} origin={p.origin} rest={p.rest} noindex signedIn>
      <nav class="subnav" aria-label={tr("admin.nav.label")}>
        {NAV.map((item) => (
          <a href={localizedPath(p.locale, item.path)} aria-current={item.key === p.active ? "page" : undefined}>
            {tr(item.label)}
          </a>
        ))}
      </nav>
      {p.children}
    </Layout>
  );
};
```

`apps/web/src/views/admin/BuildersPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { BUILDER_STATUSES, type BuilderAccount, type BuilderStatus } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export const BuildersPage: FC<{ locale: Locale; origin: string; status: BuilderStatus; builders: BuilderAccount[] }> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.builders")} rest="/admin/builders" active="builders">
      <h1>{tr("admin.nav.builders")}</h1>
      <nav class="subnav" aria-label={tr("admin.builders.filter")}>
        {BUILDER_STATUSES.map((s) => (
          <a href={localizedPath(p.locale, `/admin/builders?status=${s}`)} aria-current={s === p.status ? "page" : undefined}>
            {tr(STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.builders.length === 0 ? (
        <p class="muted">{tr("admin.builders.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.col.handle")}</th>
                <th>{tr("admin.col.name")}</th>
                <th>{tr("admin.col.email")}</th>
                <th>{tr("admin.col.country")}</th>
                <th>{tr("admin.col.created")}</th>
                <th>{tr("admin.col.invite")}</th>
              </tr>
            </thead>
            <tbody>
              {p.builders.map((b) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/builders/${b.userId}`)}>{b.handle}</a>
                  </td>
                  <td>{b.name}</td>
                  <td>{b.email}</td>
                  <td>{countryName(p.locale, b.country)}</td>
                  <td>{b.createdAt.slice(0, 10)}</td>
                  <td>{tr(b.inviteCodeHash ? "admin.yes" : "admin.no")}</td>
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

`apps/web/src/views/admin/BuilderDetailPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { BuilderAccount, BuilderAction } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { KIND_KEY, STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { AdminLayout } from "./AdminLayout.tsx";

export type AdminNotice = "done" | "mail_failed" | null;

type Props = { locale: Locale; origin: string; builder: BuilderAccount; notice: AdminNotice; reasonError?: BuilderAction };

export const BuilderDetailPage: FC<Props> = ({ locale, origin, builder: b, notice, reasonError }) => {
  const tr = translator(locale);
  const action = (name: BuilderAction) => localizedPath(locale, `/admin/builders/${b.userId}/${name}`);
  return (
    <AdminLayout locale={locale} origin={origin} title={b.name} rest={`/admin/builders/${b.userId}`} active="builders">
      <h1>
        {b.name} <span class={`badge badge-${b.status}`}>{tr(STATUS_KEY[b.status])}</span>
      </h1>
      {notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.mailFailed")}
        </p>
      ) : null}

      <dl class="facts">
        <dt>{tr("admin.col.handle")}</dt>
        <dd>{b.handle}</dd>
        <dt>{tr("admin.col.email")}</dt>
        <dd>{b.email}</dd>
        <dt>{tr("builder.field.kind")}</dt>
        <dd>{tr(KIND_KEY[b.kind])}</dd>
        <dt>{tr("builder.field.headline")}</dt>
        <dd>{b.headline}</dd>
        <dt>{tr("admin.col.country")}</dt>
        <dd>{countryName(locale, b.country)}</dd>
        <dt>{tr("builder.field.websiteUrl")}</dt>
        <dd>
          {b.websiteUrl ? (
            <a href={b.websiteUrl} rel="nofollow ugc noopener" target="_blank">
              {b.websiteUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>{tr("builder.field.skills")}</dt>
        <dd>{b.skills.join(", ")}</dd>
        <dt>{tr("admin.col.created")}</dt>
        <dd>{b.createdAt.slice(0, 10)}</dd>
      </dl>

      <h2>{tr("builder.field.bio")}</h2>
      <PlainText text={b.bio} />
      {b.reviewNote ? (
        <>
          <h2>{tr("hub.reviewNote")}</h2>
          <PlainText text={b.reviewNote} />
        </>
      ) : null}

      {b.status === "pending" ? (
        <div class="row-actions">
          <form method="post" action={action("approve")}>
            <button class="btn" type="submit">
              {tr("admin.approve")}
            </button>
          </form>
          <form method="post" action={action("reject")} class="card">
            <div class="field">
              <label for="reject-reason">{tr("admin.reason")}</label>
              <textarea
                id="reject-reason"
                name="reason"
                required
                maxlength={500}
                aria-invalid={reasonError === "reject" ? "true" : undefined}
                aria-describedby={reasonError === "reject" ? "reject-reason-error" : undefined}
              ></textarea>
              {reasonError === "reject" ? (
                <p id="reject-reason-error" class="error-msg">
                  {tr("admin.error.reason")}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("admin.reject")}
            </button>
          </form>
        </div>
      ) : null}
    </AdminLayout>
  );
};
```

- [ ] **Step 5: Route admin**

`apps/web/src/routes/admin.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { findBuilderAccount, listBuildersByStatus, setBuilderStatus } from "../db/builders.ts";
import { isBuilderStatus, transition, type BuilderAccount, type BuilderAction } from "../domain/builder.ts";
import { getMailer } from "../email/index.ts";
import { builderApprovedEmail, builderRejectedEmail } from "../email/templates/builder-decision.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { BuilderDetailPage, type AdminNotice } from "../views/admin/BuilderDetailPage.tsx";
import { BuildersPage } from "../views/admin/BuildersPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

/** Which admin actions take a reason (spec §5.5: rejecting needs one). Stored in builders.review_note. */
const REASON: Record<BuilderAction, "required" | "optional" | "none"> = {
  approve: "none",
  reject: "required",
  suspend: "optional",
  unsuspend: "none",
  resubmit: "none",
};
const ReasonSchema = { required: z.string().trim().min(1).max(500), optional: z.string().trim().max(500) };

function noticeFrom(value: string | undefined): AdminNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

export function registerAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin", requireAdmin, (c) => c.redirect(localizedPath(c.get("locale"), "/admin/builders"), 303));

  onLocalized(app, "get", "/admin/builders", requireAdmin, async (c) => {
    const q = c.req.query("status");
    const status = isBuilderStatus(q) ? q : "pending";
    const builders = await listBuildersByStatus(c.env.DB, status);
    return page(c, <BuildersPage locale={c.get("locale")} origin={requestOrigin(c)} status={status} builders={builders} />);
  });

  onLocalized(app, "get", "/admin/builders/:userId", requireAdmin, async (c) => {
    const builder = await findBuilderAccount(c.env.DB, c.req.param("userId") ?? "");
    if (!builder) return errorResponse(c, "notFound", 404);
    return page(c, <BuilderDetailPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} notice={noticeFrom(c.req.query("done"))} />);
  });

  onLocalized(app, "post", "/admin/builders/:userId/approve", requireAdmin, (c) => decide(c, "approve"));
  onLocalized(app, "post", "/admin/builders/:userId/reject", requireAdmin, (c) => decide(c, "reject"));
}

/** Shared by every admin action on a builder: validate, compare-and-set, audit, notify. */
export async function decide(c: Context<AppEnv>, action: BuilderAction) {
  const admin = c.get("user")!;
  const builder = await findBuilderAccount(c.env.DB, c.req.param("userId") ?? "");
  if (!builder) return errorResponse(c, "notFound", 404);

  let reason: string | null = null;
  const policy = REASON[action];
  if (policy !== "none") {
    const body = await c.req.parseBody();
    const parsed = ReasonSchema[policy].safeParse(typeof body.reason === "string" ? body.reason : "");
    if (!parsed.success) {
      return page(c, <BuilderDetailPage locale={c.get("locale")} origin={requestOrigin(c)} builder={builder} notice={null} reasonError={action} />, 400);
    }
    reason = parsed.data || null;
  }

  const next = transition(builder.status, action, "admin");
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  const updated = await setBuilderStatus(c.env.DB, { userId: builder.userId, from: builder.status, to: next.status, reviewNote: reason, now });
  if (!updated) return errorResponse(c, "conflict", 409);
  await writeAudit(c.env.DB, {
    actorUserId: admin.id,
    action: `builder.${action}`,
    entity: "builder",
    entityId: builder.userId,
    data: { from: builder.status, to: next.status, reason },
    now,
  });

  const mailed = action === "approve" || action === "reject" ? await notify(c, builder, action, reason) : true;
  return c.redirect(localizedPath(c.get("locale"), `/admin/builders/${builder.userId}?done=${mailed ? "1" : "mail_failed"}`), 303);
}

/** Spec §8.3: tell the builder in their own language. A failed send never undoes the decision. */
async function notify(c: Context<AppEnv>, builder: BuilderAccount, action: "approve" | "reject", reason: string | null): Promise<boolean> {
  const locale = isLocale(builder.userLocale) ? builder.userLocale : "en";
  const url = (path: string) => new URL(localizedPath(locale, path), c.env.APP_ORIGIN).toString();
  const message =
    action === "approve"
      ? builderApprovedEmail(locale, { name: builder.name, profileUrl: url(`/b/${builder.handle}`), hubUrl: url("/hub") })
      : builderRejectedEmail(locale, { name: builder.name, reason: reason ?? "", profileUrl: url("/hub/profile") });
  try {
    await getMailer(c.env).send({ to: builder.email, ...message });
    return true;
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "builder.mail_failed", action, error: String(err) }));
    return false;
  }
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerAdminRoutes(app);` sau `registerBuilderProfileRoutes(app);`.

- [ ] **Step 6: Key i18n**

`en.ts`:

```ts
  "admin.title": "Admin",
  "admin.nav.label": "Admin sections",
  "admin.nav.builders": "Builders",
  "admin.builders.filter": "Filter by status",
  "admin.builders.empty": "No builders with this status.",
  "admin.col.handle": "Handle",
  "admin.col.name": "Name",
  "admin.col.email": "Email",
  "admin.col.country": "Country",
  "admin.col.created": "Applied",
  "admin.col.invite": "Invite",
  "admin.yes": "Yes",
  "admin.no": "No",
  "admin.approve": "Approve",
  "admin.reject": "Reject",
  "admin.reason": "Reason (sent to the builder)",
  "admin.error.reason": "Enter a reason (up to 500 characters).",
  "admin.done": "Saved.",
  "admin.mailFailed": "Saved, but the email to the builder couldn't be sent.",
  "email.builderApproved.subject": "Your VNX.SI builder profile is live",
  "email.builderApproved.body": "Hi {name}, your builder profile has been approved and is now public:",
  "email.builderApproved.cta": "Manage it in Builder Hub:",
  "email.builderRejected.subject": "Changes needed on your VNX.SI builder profile",
  "email.builderRejected.body": "Hi {name}, an admin reviewed your builder profile and asked for these changes:",
  "email.builderRejected.cta": "Edit your profile and send it for review again:",
```

`vi.ts`:

```ts
  "admin.title": "Quản trị",
  "admin.nav.label": "Các mục quản trị",
  "admin.nav.builders": "Builder",
  "admin.builders.filter": "Lọc theo trạng thái",
  "admin.builders.empty": "Không có builder nào ở trạng thái này.",
  "admin.col.handle": "Handle",
  "admin.col.name": "Tên",
  "admin.col.email": "Email",
  "admin.col.country": "Quốc gia",
  "admin.col.created": "Ngày đăng ký",
  "admin.col.invite": "Có invite",
  "admin.yes": "Có",
  "admin.no": "Không",
  "admin.approve": "Duyệt",
  "admin.reject": "Từ chối",
  "admin.reason": "Lý do (gửi cho builder)",
  "admin.error.reason": "Nhập lý do (tối đa 500 ký tự).",
  "admin.done": "Đã lưu.",
  "admin.mailFailed": "Đã lưu, nhưng chưa gửi được email cho builder.",
  "email.builderApproved.subject": "Hồ sơ builder của bạn trên VNX.SI đã được duyệt",
  "email.builderApproved.body": "Chào {name}, hồ sơ builder của bạn đã được duyệt và đang công khai tại:",
  "email.builderApproved.cta": "Quản lý trong Builder Hub:",
  "email.builderRejected.subject": "Hồ sơ builder của bạn trên VNX.SI cần chỉnh sửa",
  "email.builderRejected.body": "Chào {name}, admin đã xem hồ sơ builder của bạn và yêu cầu chỉnh sửa như sau:",
  "email.builderRejected.cta": "Sửa hồ sơ và gửi duyệt lại:",
```

`zh-hans.ts`:

```ts
  "admin.title": "管理后台",
  "admin.nav.label": "管理导航",
  "admin.nav.builders": "Builder",
  "admin.builders.filter": "按状态筛选",
  "admin.builders.empty": "没有此状态的 Builder。",
  "admin.col.handle": "用户名",
  "admin.col.name": "名称",
  "admin.col.email": "邮箱",
  "admin.col.country": "国家/地区",
  "admin.col.created": "申请时间",
  "admin.col.invite": "邀请",
  "admin.yes": "是",
  "admin.no": "否",
  "admin.approve": "通过",
  "admin.reject": "拒绝",
  "admin.reason": "原因（将发送给 Builder）",
  "admin.error.reason": "请输入原因（最多 500 个字符）。",
  "admin.done": "已保存。",
  "admin.mailFailed": "已保存，但未能发送邮件给 Builder。",
  "email.builderApproved.subject": "你在 VNX.SI 的 Builder 资料已通过审核",
  "email.builderApproved.body": "{name} 你好，你的 Builder 资料已通过审核，现已公开：",
  "email.builderApproved.cta": "在 Builder 中心管理：",
  "email.builderRejected.subject": "你在 VNX.SI 的 Builder 资料需要修改",
  "email.builderRejected.body": "{name} 你好，管理员审核了你的 Builder 资料，并要求进行以下修改：",
  "email.builderRejected.cta": "修改资料并重新提交审核：",
```

`zh-hant.ts`:

```ts
  "admin.title": "管理後台",
  "admin.nav.label": "管理導覽",
  "admin.nav.builders": "Builder",
  "admin.builders.filter": "依狀態篩選",
  "admin.builders.empty": "沒有此狀態的 Builder。",
  "admin.col.handle": "使用者名稱",
  "admin.col.name": "名稱",
  "admin.col.email": "電子郵件",
  "admin.col.country": "國家/地區",
  "admin.col.created": "申請時間",
  "admin.col.invite": "邀請",
  "admin.yes": "是",
  "admin.no": "否",
  "admin.approve": "通過",
  "admin.reject": "拒絕",
  "admin.reason": "原因（將寄送給 Builder）",
  "admin.error.reason": "請輸入原因（最多 500 個字元）。",
  "admin.done": "已儲存。",
  "admin.mailFailed": "已儲存，但未能寄送郵件給 Builder。",
  "email.builderApproved.subject": "你在 VNX.SI 的 Builder 資料已通過審核",
  "email.builderApproved.body": "{name} 你好，你的 Builder 資料已通過審核，現已公開：",
  "email.builderApproved.cta": "在 Builder 中心管理：",
  "email.builderRejected.subject": "你在 VNX.SI 的 Builder 資料需要修改",
  "email.builderRejected.body": "{name} 你好，管理員審核了你的 Builder 資料，並要求進行以下修改：",
  "email.builderRejected.cta": "修改資料並重新送審：",
```

- [ ] **Step 7: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.table-wrap { overflow-x: auto; }
table.data { border-collapse: collapse; width: 100%; background: var(--surface); }
table.data th, table.data td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): admin builder review queue with approval e-mails" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: VNX-0205b — Admin: invite link và test cổng ra M2

**Files:**
- Create: `apps/web/src/routes/admin-invites.tsx`, `apps/web/src/views/admin/InvitesPage.tsx`
- Modify: `apps/web/src/views/admin/AdminLayout.tsx` (thêm mục Invites), `apps/web/src/app.ts`, 4 file locale
- Test: `apps/web/test/admin/invites.test.ts`

**Interfaces:**
- Consumes: `randomToken`, `sha256Hex` (`auth/crypto.ts`), `createInvite`, `listInvites`, `inviteState`, `requireAdmin`, `writeAudit`.
- Produces: `registerInviteAdminRoutes(app)`: `GET|POST /admin/invites`. Audit action `invite.create` (entity_id = hash, data `{ maxUses, expiresAt }`; không chứa code).

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/admin/invites.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { findBuilderByHandle } from "../../src/db/builders.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { ensureUser, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });

async function createLink(cookie: string, fields: Record<string, string>) {
  const res = await app().request(formPost("/admin/invites", fields, { cookie }), undefined, testEnv);
  const html = await res.text();
  const code = /https:\/\/vnx\.si\/join\/([A-Za-z0-9_-]{22})/.exec(html)?.[1];
  return { res, html, code };
}

describe("admin invites (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    const { cookie } = await signIn("inv-nobody@vnx.si");
    expect((await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost("/admin/invites", { maxUses: "1", days: "7", note: "" }, { cookie }), undefined, testEnv)).status).toBe(403);
  });

  it("shows a new link once and stores only its hash", async () => {
    const { cookie } = await admin();
    const before = Date.now();
    const { res, code } = await createLink(cookie, { maxUses: "3", days: "7", note: "Founding builders" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(code).toBeDefined();
    const hash = await sha256Hex(code!);
    const invite = await findInvite(testEnv.DB, hash);
    expect(invite).toMatchObject({ maxUses: 3, uses: 0, note: "Founding builders" });
    const expires = Date.parse(invite!.expiresAt);
    expect(expires - before).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(expires - before).toBeLessThanOrEqual(7 * 86_400_000 + 60_000);

    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'invite.create' AND entity_id = ?1").bind(hash).first<{ data: string }>();
    expect(audit?.data).not.toContain(code!);

    const list = await (await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).text();
    expect(list).toContain("Founding builders");
    expect(list).not.toContain(code!);
  });

  it("validates the form (400)", async () => {
    const { cookie } = await admin();
    const { res, html } = await createLink(cookie, { maxUses: "0", days: "91", note: "n".repeat(201) });
    expect(res.status).toBe(400);
    expect(html).toContain("Enter a whole number from 1 to 1000.");
    expect(html).toContain("Enter a whole number from 1 to 90.");
    expect(html).toContain("Keep the note under 200 characters.");
  });

  it("labels used-up and expired links", async () => {
    const owner = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    await createInvite(testEnv.DB, { codeHash: await sha256Hex("inv-usedup"), createdBy: owner.id, maxUses: 1, expiresAt: "2999-01-01T00:00:00.000Z", note: "usedup-note", now });
    await testEnv.DB.prepare("UPDATE invites SET uses = 1 WHERE code_hash = ?1").bind(await sha256Hex("inv-usedup")).run();
    await createInvite(testEnv.DB, { codeHash: await sha256Hex("inv-expired"), createdBy: owner.id, maxUses: 1, expiresAt: "2000-01-01T00:00:00.000Z", note: "expired-note", now });
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).text();
    expect(html).toContain("Used up");
    expect(html).toContain("Expired");
  });

  it("takes an invited builder from the link to a public profile (M2 exit gate)", async () => {
    const { cookie: adminCookie } = await admin();
    const { code } = await createLink(adminCookie, { maxUses: "1", days: "14", note: "" });

    const join = await app().request(getReq(`/join/${code}`), undefined, testEnv);
    const inviteHash = setCookieValue(join, "__Host-vnx_invite")!;
    await app().request(formPost("/login", { email: "gate@vnx.si", next: "/hub/apply" }, { cookie: `__Host-vnx_invite=${inviteHash}` }), undefined, testEnv);
    const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];

    // Opened on a second device that never saw /join.
    const verify = await app().request(getReq(`/auth/verify?t=${token}&next=%2Fhub%2Fapply`), undefined, testEnv);
    const cookies = `__Host-vnx_session=${setCookieValue(verify, "__Host-vnx_session")}; __Host-vnx_invite=${setCookieValue(verify, "__Host-vnx_invite")}`;
    const apply = await app().request(formPost("/hub/apply", profileValues({ handle: "gate-builder" }), { cookie: cookies }), undefined, testEnv);
    expect(apply.headers.get("location")).toBe("/hub");

    expect(await findBuilderByHandle(testEnv.DB, "gate-builder")).toMatchObject({ status: "approved" });
    expect((await findInvite(testEnv.DB, inviteHash))?.uses).toBe(1);
    expect((await app().request(getReq("/b/gate-builder"), undefined, testEnv)).status).toBe(200);
  });
});
```

Run: `npm test -w apps/web -- test/admin/invites.test.ts`
Expected: FAIL.

- [ ] **Step 2: View**

`apps/web/src/views/admin/AdminLayout.tsx`: đổi `AdminSection` thành `"builders" | "invites"` và thêm vào cuối `NAV`: `{ key: "invites", path: "/admin/invites", label: "admin.nav.invites" }`.

`apps/web/src/views/admin/InvitesPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { inviteState, type Invite, type InviteState } from "../../domain/invite.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";

export type InviteFormValues = { maxUses: string; days: string; note: string };
export type InviteField = keyof InviteFormValues;
export type InviteErrors = Partial<Record<InviteField, true>>;

const STATE_KEY: Record<InviteState, MessageKey> = { active: "invites.status.active", expired: "invites.status.expired", used_up: "invites.status.usedUp" };
const ERROR_KEY: Record<InviteField, MessageKey> = { maxUses: "invites.error.maxUses", days: "invites.error.days", note: "invites.error.note" };

type Props = { locale: Locale; origin: string; invites: Invite[]; now: Date; values: InviteFormValues; errors: InviteErrors; createdLink: string | null };

export const InvitesPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const error = (field: InviteField) =>
    p.errors[field] ? (
      <p id={`inv-${field}-error`} class="error-msg">
        {tr(ERROR_KEY[field])}
      </p>
    ) : null;
  const aria = (field: InviteField) => ({ "aria-invalid": p.errors[field] ? "true" : undefined, "aria-describedby": p.errors[field] ? `inv-${field}-error` : undefined });
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("invites.title")} rest="/admin/invites" active="invites">
      <h1>{tr("invites.title")}</h1>
      <p>{tr("invites.intro")}</p>
      {p.createdLink ? (
        <div class="notice good field" role="status">
          <label for="new-invite">{tr("invites.created")}</label>
          <input id="new-invite" readonly value={p.createdLink} />
        </div>
      ) : null}

      <form method="post" action={localizedPath(p.locale, "/admin/invites")} class="card">
        <div class="field">
          <label for="inv-maxUses">{tr("invites.maxUses")}</label>
          <input id="inv-maxUses" name="maxUses" type="number" min={1} max={1000} step={1} required value={p.values.maxUses} {...aria("maxUses")} />
          {error("maxUses")}
        </div>
        <div class="field">
          <label for="inv-days">{tr("invites.days")}</label>
          <input id="inv-days" name="days" type="number" min={1} max={90} step={1} required value={p.values.days} {...aria("days")} />
          {error("days")}
        </div>
        <div class="field">
          <label for="inv-note">{tr("invites.note")}</label>
          <input id="inv-note" name="note" maxlength={200} value={p.values.note} {...aria("note")} />
          {error("note")}
        </div>
        <button class="btn" type="submit">
          {tr("invites.create")}
        </button>
      </form>

      {p.invites.length === 0 ? (
        <p class="muted">{tr("invites.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("invites.col.note")}</th>
                <th>{tr("invites.col.uses")}</th>
                <th>{tr("invites.col.expires")}</th>
                <th>{tr("invites.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {p.invites.map((invite) => (
                <tr>
                  <td>{invite.note ?? "—"}</td>
                  <td>
                    {invite.uses}/{invite.maxUses}
                  </td>
                  <td>{invite.expiresAt.slice(0, 10)}</td>
                  <td>{tr(STATE_KEY[inviteState(invite, p.now)])}</td>
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

- [ ] **Step 3: Route**

`apps/web/src/routes/admin-invites.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { z } from "zod";
import { randomToken, sha256Hex } from "../auth/crypto.ts";
import { requireAdmin } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { createInvite, listInvites } from "../db/invites.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { InvitesPage, type InviteErrors, type InviteField, type InviteFormValues } from "../views/admin/InvitesPage.tsx";
import { page } from "../views/render.ts";

const DAY_MS = 86_400_000;
const DEFAULTS: InviteFormValues = { maxUses: "1", days: "14", note: "" };
const InviteForm = z.object({
  maxUses: z.coerce.number().int().min(1).max(1000),
  days: z.coerce.number().int().min(1).max(90),
  note: z.string().trim().max(200),
});

const str = (value: unknown) => (typeof value === "string" ? value : "");

async function render(c: Context<AppEnv>, values: InviteFormValues, errors: InviteErrors, createdLink: string | null, status: 200 | 400 = 200) {
  const invites = await listInvites(c.env.DB);
  return page(c, <InvitesPage locale={c.get("locale")} origin={requestOrigin(c)} invites={invites} now={new Date()} values={values} errors={errors} createdLink={createdLink} />, status);
}

export function registerInviteAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/invites", requireAdmin, (c) => render(c, DEFAULTS, {}, null));

  onLocalized(app, "post", "/admin/invites", requireAdmin, async (c) => {
    const body = await c.req.parseBody();
    const values: InviteFormValues = { maxUses: str(body.maxUses), days: str(body.days), note: str(body.note) };
    const parsed = InviteForm.safeParse(values);
    if (!parsed.success) {
      const errors: InviteErrors = {};
      for (const issue of parsed.error.issues) errors[issue.path[0] as InviteField] = true;
      return render(c, values, errors, null, 400);
    }

    const now = new Date();
    const code = randomToken(16);
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(now.getTime() + parsed.data.days * DAY_MS).toISOString();
    const admin = c.get("user")!;
    await createInvite(c.env.DB, { codeHash, createdBy: admin.id, maxUses: parsed.data.maxUses, expiresAt, note: parsed.data.note || null, now: now.toISOString() });
    // The raw code is shown once on this response and never stored or logged.
    await writeAudit(c.env.DB, { actorUserId: admin.id, action: "invite.create", entity: "invite", entityId: codeHash, data: { maxUses: parsed.data.maxUses, expiresAt }, now: now.toISOString() });
    c.header("Cache-Control", "no-store");
    return render(c, DEFAULTS, {}, new URL(`/join/${code}`, c.env.APP_ORIGIN).toString());
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerInviteAdminRoutes(app);` sau `registerAdminRoutes(app);`.

- [ ] **Step 4: Key i18n**

`en.ts`:

```ts
  "admin.nav.invites": "Invites",
  "invites.title": "Invite links",
  "invites.intro": "People who sign up through an invite link are approved as builders right away.",
  "invites.maxUses": "Number of uses",
  "invites.days": "Valid for (days)",
  "invites.note": "Note (admins only)",
  "invites.create": "Create link",
  "invites.created": "New invite link. Copy it now: it won't be shown again.",
  "invites.empty": "No invite links yet.",
  "invites.col.note": "Note",
  "invites.col.uses": "Used",
  "invites.col.expires": "Expires",
  "invites.col.status": "Status",
  "invites.status.active": "Active",
  "invites.status.expired": "Expired",
  "invites.status.usedUp": "Used up",
  "invites.error.maxUses": "Enter a whole number from 1 to 1000.",
  "invites.error.days": "Enter a whole number from 1 to 90.",
  "invites.error.note": "Keep the note under 200 characters.",
```

`vi.ts`:

```ts
  "admin.nav.invites": "Link mời",
  "invites.title": "Link mời",
  "invites.intro": "Người đăng ký qua link mời được duyệt làm builder ngay.",
  "invites.maxUses": "Số lượt dùng",
  "invites.days": "Hiệu lực (ngày)",
  "invites.note": "Ghi chú (chỉ admin thấy)",
  "invites.create": "Tạo link",
  "invites.created": "Link mời mới. Hãy sao chép ngay: link sẽ không hiện lại.",
  "invites.empty": "Chưa có link mời nào.",
  "invites.col.note": "Ghi chú",
  "invites.col.uses": "Đã dùng",
  "invites.col.expires": "Hết hạn",
  "invites.col.status": "Trạng thái",
  "invites.status.active": "Còn hiệu lực",
  "invites.status.expired": "Hết hạn",
  "invites.status.usedUp": "Hết lượt",
  "invites.error.maxUses": "Nhập số nguyên từ 1 đến 1000.",
  "invites.error.days": "Nhập số nguyên từ 1 đến 90.",
  "invites.error.note": "Ghi chú tối đa 200 ký tự.",
```

`zh-hans.ts`:

```ts
  "admin.nav.invites": "邀请链接",
  "invites.title": "邀请链接",
  "invites.intro": "通过邀请链接注册的人会立即成为已通过审核的 Builder。",
  "invites.maxUses": "可用次数",
  "invites.days": "有效期（天）",
  "invites.note": "备注（仅管理员可见）",
  "invites.create": "创建链接",
  "invites.created": "新的邀请链接。请立即复制：之后不会再显示。",
  "invites.empty": "还没有邀请链接。",
  "invites.col.note": "备注",
  "invites.col.uses": "已使用",
  "invites.col.expires": "到期",
  "invites.col.status": "状态",
  "invites.status.active": "有效",
  "invites.status.expired": "已过期",
  "invites.status.usedUp": "已用完",
  "invites.error.maxUses": "请输入 1 到 1000 的整数。",
  "invites.error.days": "请输入 1 到 90 的整数。",
  "invites.error.note": "备注最多 200 个字符。",
```

`zh-hant.ts`:

```ts
  "admin.nav.invites": "邀請連結",
  "invites.title": "邀請連結",
  "invites.intro": "透過邀請連結註冊的人會立即成為已通過審核的 Builder。",
  "invites.maxUses": "可用次數",
  "invites.days": "有效期（天）",
  "invites.note": "備註（僅管理員可見）",
  "invites.create": "建立連結",
  "invites.created": "新的邀請連結。請立即複製：之後不會再顯示。",
  "invites.empty": "還沒有邀請連結。",
  "invites.col.note": "備註",
  "invites.col.uses": "已使用",
  "invites.col.expires": "到期",
  "invites.col.status": "狀態",
  "invites.status.active": "有效",
  "invites.status.expired": "已過期",
  "invites.status.usedUp": "已用完",
  "invites.error.maxUses": "請輸入 1 到 1000 的整數。",
  "invites.error.days": "請輸入 1 到 90 的整數。",
  "invites.error.note": "備註最多 200 個字元。",
```

- [ ] **Step 5: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): admin invite links shown once and stored as hashes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: VNX-0205c — Khóa / mở khóa builder và user; đồng bộ quyền admin

**Files:**
- Create: `apps/web/src/domain/user.ts`, `apps/web/src/routes/admin-users.tsx`, `apps/web/src/views/admin/UsersPage.tsx`
- Modify: `apps/web/src/db/users.ts` (`markLogin` hai chiều, thêm `setUserStatus`, `searchUsers`), `apps/web/src/auth/sessions.ts` (thêm `deleteUserSessions`), `apps/web/src/auth/middleware.ts` (`requireAdmin`), `apps/web/src/routes/admin.tsx` (route suspend/unsuspend), `apps/web/src/views/admin/BuilderDetailPage.tsx`, `apps/web/src/views/admin/AdminLayout.tsx`, `apps/web/src/views/labels.ts`, `apps/web/src/app.ts`, 4 file locale
- Test: `apps/web/test/admin/suspend.test.ts`, `apps/web/test/auth/admin-sync.test.ts`

**Interfaces:**
- Consumes: `decide` và bảng `REASON` (Task 7: `suspend` lý do tùy chọn, `unsuspend` không có), `transition`, `findUserById`, `adminEmails`.
- Produces:
  - `domain/user.ts`: `USER_STATUSES`, type `UserStatus`, `UserAction`, `UserSummary`; `userTransition(status, action)`.
  - `db/users.ts`: `setUserStatus(db, { id, from, to, now }): Promise<boolean>`, `searchUsers(db, query, limit = 50): Promise<UserSummary[]>` (LIKE có escape `%`, `_`, `\`); `markLogin` đặt `is_admin = 0|1` theo `ADMIN_EMAILS`.
  - `auth/sessions.ts`: `deleteUserSessions(db, userId)`.
  - `requireAdmin`: cần `user.isAdmin` **và** email có trong `ADMIN_EMAILS` hiện tại.
  - `USER_STATUS_KEY` trong `views/labels.ts`.
  - Route: `POST /admin/builders/:userId/suspend|unsuspend`; `GET /admin/users?q=`; `POST /admin/users/:id/suspend|unsuspend`. Audit: `builder.suspend`, `builder.unsuspend`, `user.suspend`, `user.unsuspend`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/auth/admin-sync.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

async function login(email: string, env: Bindings) {
  clearOutbox();
  const app = createApp();
  await app.request(formPost("/login", { email }), undefined, env);
  const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];
  await app.request(getReq(`/auth/verify?t=${token}`), undefined, env);
}

const isAdmin = async (email: string) =>
  (await testEnv.DB.prepare("SELECT is_admin FROM users WHERE email = ?1").bind(email).first<{ is_admin: number }>())?.is_admin;

describe("ADMIN_EMAILS is the source of truth (Owner decision 2026-10-03)", () => {
  beforeEach(() => clearOutbox());

  it("revokes admin pages on the next request once the e-mail leaves the list", async () => {
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    expect((await createApp().request(getReq("/admin/builders", cookie), undefined, testEnv)).status).toBe(200);
    const removed = { ...testEnv, ADMIN_EMAILS: "" } as Bindings;
    expect((await createApp().request(getReq("/admin/builders", cookie), undefined, removed)).status).toBe(403);
  });

  it("syncs is_admin both ways at sign-in", async () => {
    await login("boss@vnx.si", { ...testEnv, ADMIN_EMAILS: "boss@vnx.si" } as Bindings);
    expect(await isAdmin("boss@vnx.si")).toBe(1);
    await login("boss@vnx.si", { ...testEnv, ADMIN_EMAILS: "" } as Bindings);
    expect(await isAdmin("boss@vnx.si")).toBe(0);
  });
});
```

`apps/web/test/admin/suspend.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { ensureUser, makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });
const status = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv).then((r) => r.status);

describe("suspending builders (spec §7.1)", () => {
  it("hides the profile, freezes the Hub and restores both on unsuspend", async () => {
    const b = await makeBuilder("sus-b@vnx.si", "sus-b", "approved");
    const { cookie: own } = await signIn("sus-b@vnx.si");
    const { cookie } = await admin();

    const res = await app().request(formPost(`/admin/builders/${b.userId}/suspend`, { reason: "Spam links" }, { cookie }), undefined, testEnv);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "suspended", reviewNote: "Spam links" });
    expect(await status("/b/sus-b")).toBe(404);
    expect(await (await app().request(getReq("/hub", own), undefined, testEnv)).text()).toContain("Suspended");
    expect((await app().request(formPost("/hub/profile", profileValues({ handle: "sus-b" }), { cookie: own }), undefined, testEnv)).status).toBe(409);
    expect((await app().request(formPost(`/admin/builders/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);

    await app().request(formPost(`/admin/builders/${b.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved", reviewNote: null, approvedAt: b.approvedAt });
    expect(await status("/b/sus-b")).toBe(200);
  });

  it("cannot suspend a pending builder (409)", async () => {
    const b = await makeBuilder("sus-pending@vnx.si", "sus-pending");
    const { cookie } = await admin();
    expect((await app().request(formPost(`/admin/builders/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("suspending users (spec §5.5, §8.2)", () => {
  beforeEach(() => clearOutbox());

  it("ends sessions, hides the builder profile and refuses sign-in until unsuspended", async () => {
    const b = await makeBuilder("sus-u@vnx.si", "sus-u", "approved");
    const { cookie: own } = await signIn("sus-u@vnx.si");
    const { cookie } = await admin();

    const res = await app().request(formPost(`/admin/users/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/users?q=sus-u%40vnx.si");
    const sessions = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1").bind(b.userId).first<{ n: number }>();
    expect(sessions?.n).toBe(0);
    expect((await app().request(getReq("/hub", own), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fhub");
    expect(await status("/b/sus-u")).toBe(404);

    await app().request(formPost("/login", { email: "sus-u@vnx.si" }), undefined, testEnv);
    const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];
    expect((await app().request(getReq(`/auth/verify?t=${token}`), undefined, testEnv)).status).toBe(403);

    await app().request(formPost(`/admin/users/${b.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect(await status("/b/sus-u")).toBe(200);
  });

  it("does not let an admin suspend themselves (409)", async () => {
    const { user, cookie } = await admin();
    expect((await app().request(formPost(`/admin/users/${user.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("searches by e-mail treating % and _ literally", async () => {
    await ensureUser("wild_card@vnx.si");
    await ensureUser("wildxcard@vnx.si");
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/users?q=wild_card", cookie), undefined, testEnv)).text();
    expect(html).toContain("wild_card@vnx.si");
    expect(html).not.toContain("wildxcard@vnx.si");
  });

  it("is for admins only", async () => {
    const { user, cookie } = await signIn("sus-nobody@vnx.si");
    expect(await status("/admin/users", cookie)).toBe(403);
    expect((await app().request(formPost(`/admin/users/${user.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });
});
```

Run: `npm test -w apps/web -- test/admin/suspend.test.ts test/auth/admin-sync.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain, DB, auth**

`apps/web/src/domain/user.ts`:

```ts
import type { BuilderStatus } from "./builder.ts";

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserAction = "suspend" | "unsuspend";

/** One row of the admin user search. */
export interface UserSummary {
  id: string;
  email: string;
  status: UserStatus;
  isAdmin: boolean;
  builderHandle: string | null;
  builderStatus: BuilderStatus | null;
}

const RULES: Record<UserAction, { from: UserStatus; to: UserStatus }> = {
  suspend: { from: "active", to: "suspended" },
  unsuspend: { from: "suspended", to: "active" },
};

export function userTransition(status: UserStatus, action: UserAction): { ok: true; status: UserStatus } | { ok: false; error: "invalid_transition" } {
  const rule = RULES[action];
  return rule.from === status ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}
```

`apps/web/src/db/users.ts`:
- Thêm import: `import type { UserStatus, UserSummary } from "../domain/user.ts";` và `import type { BuilderStatus } from "../domain/builder.ts";`.
- Thay thân `markLogin` bằng (đồng bộ hai chiều):

```ts
export async function markLogin(db: D1Database, id: string, input: { now: string; isAdmin: boolean }): Promise<void> {
  // ADMIN_EMAILS is the source of truth (Owner decision 2026-10-03): grant and revoke.
  await db
    .prepare("UPDATE users SET last_login_at = ?2, updated_at = ?2, is_admin = ?3 WHERE id = ?1")
    .bind(id, input.now, input.isAdmin ? 1 : 0)
    .run();
}
```

- Thêm:

```ts
export async function setUserStatus(db: D1Database, input: { id: string; from: UserStatus; to: UserStatus; now: string }): Promise<boolean> {
  const res = await db.prepare("UPDATE users SET status = ?3, updated_at = ?4 WHERE id = ?1 AND status = ?2").bind(input.id, input.from, input.to, input.now).run();
  return res.meta.changes === 1;
}

/** Substring match on e-mail; % and _ in the query are literal. Newest accounts first. */
export async function searchUsers(db: D1Database, query: string, limit = 50): Promise<UserSummary[]> {
  const pattern = `%${normalizeEmail(query).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.status, u.is_admin, b.handle AS builder_handle, b.status AS builder_status
       FROM users u LEFT JOIN builders b ON b.user_id = u.id
       WHERE u.email LIKE ?1 ESCAPE '\\'
       ORDER BY u.created_at DESC LIMIT ?2`,
    )
    .bind(pattern, limit)
    .all<{ id: string; email: string; status: UserStatus; is_admin: number; builder_handle: string | null; builder_status: BuilderStatus | null }>();
  return results.map((r) => ({ id: r.id, email: r.email, status: r.status, isAdmin: r.is_admin === 1, builderHandle: r.builder_handle, builderStatus: r.builder_status }));
}
```

`apps/web/src/auth/sessions.ts`: thêm

```ts
export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId).run();
}
```

`apps/web/src/auth/middleware.ts`: thêm `import { adminEmails } from "./admin.ts";` và thay `requireAdmin` bằng:

```ts
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) return toLogin(c);
  // ADMIN_EMAILS is the source of truth: removing an e-mail revokes access on the next request.
  if (!user.isAdmin || !adminEmails(c.env).has(user.email)) return errorResponse(c, "forbidden", 403);
  await next();
};
```

- [ ] **Step 3: Route khóa builder**

Trong `apps/web/src/routes/admin.tsx`, trong `registerAdminRoutes` thêm sau route `reject`:

```tsx
  onLocalized(app, "post", "/admin/builders/:userId/suspend", requireAdmin, (c) => decide(c, "suspend"));
  onLocalized(app, "post", "/admin/builders/:userId/unsuspend", requireAdmin, (c) => decide(c, "unsuspend"));
```

(`decide` đã xử lý lý do tùy chọn cho `suspend`, 409 khi sai trạng thái, audit; không gửi email.)

- [ ] **Step 4: View**

`apps/web/src/views/labels.ts`: thêm `import type { UserStatus } from "../domain/user.ts";` và

```ts
export const USER_STATUS_KEY: Record<UserStatus, MessageKey> = {
  active: "users.status.active",
  suspended: "users.status.suspended",
};
```

`apps/web/src/views/admin/AdminLayout.tsx`: đổi `AdminSection` thành `"builders" | "invites" | "users"` và thêm vào cuối `NAV`: `{ key: "users", path: "/admin/users", label: "admin.nav.users" }`.

`apps/web/src/views/admin/BuilderDetailPage.tsx`:
- Thêm `USER_STATUS_KEY` vào import từ `../labels.ts`.
- Trong `<dl class="facts">`, sau cặp `admin.col.email` thêm:

```tsx
        <dt>{tr("admin.col.account")}</dt>
        <dd>{tr(USER_STATUS_KEY[b.userStatus])}</dd>
```

- Ngay sau khối `{b.status === "pending" ? (…) : null}` thêm:

```tsx
      {b.status === "approved" ? (
        <form method="post" action={action("suspend")} class="card">
          <div class="field">
            <label for="suspend-reason">{tr("admin.reasonOptional")}</label>
            <textarea
              id="suspend-reason"
              name="reason"
              maxlength={500}
              aria-invalid={reasonError === "suspend" ? "true" : undefined}
              aria-describedby={reasonError === "suspend" ? "suspend-reason-error" : undefined}
            ></textarea>
            {reasonError === "suspend" ? (
              <p id="suspend-reason-error" class="error-msg">
                {tr("admin.error.reason")}
              </p>
            ) : null}
          </div>
          <button class="btn" type="submit">
            {tr("admin.suspend")}
          </button>
        </form>
      ) : null}
      {b.status === "suspended" ? (
        <form method="post" action={action("unsuspend")}>
          <button class="btn" type="submit">
            {tr("admin.unsuspend")}
          </button>
        </form>
      ) : null}
```

`apps/web/src/views/admin/UsersPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { UserSummary } from "../../domain/user.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { STATUS_KEY, USER_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

type Props = { locale: Locale; origin: string; query: string; users: UserSummary[]; currentUserId: string };

export const UsersPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/admin/users");
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("users.title")} rest="/admin/users" active="users">
      <h1>{tr("users.title")}</h1>
      <form method="get" action={base} class="row-actions">
        <label for="user-q">{tr("users.search")}</label>
        <input id="user-q" name="q" type="search" value={p.query} maxlength={254} />
        <button class="btn" type="submit">
          {tr("users.searchSubmit")}
        </button>
      </form>
      {p.users.length === 0 ? (
        <p class="muted">{tr("users.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("admin.col.email")}</th>
                <th>{tr("users.col.status")}</th>
                <th>{tr("users.col.admin")}</th>
                <th>{tr("users.col.builder")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.users.map((u) => (
                <tr>
                  <td>{u.email}</td>
                  <td>{tr(USER_STATUS_KEY[u.status])}</td>
                  <td>{tr(u.isAdmin ? "admin.yes" : "admin.no")}</td>
                  <td>
                    {u.builderHandle && u.builderStatus ? (
                      <a href={localizedPath(p.locale, `/admin/builders/${u.id}`)}>
                        {u.builderHandle} ({tr(STATUS_KEY[u.builderStatus])})
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {u.id === p.currentUserId ? null : (
                      <form method="post" action={`${base}/${u.id}/${u.status === "active" ? "suspend" : "unsuspend"}`}>
                        <button class="link" type="submit">
                          {tr(u.status === "active" ? "admin.suspend" : "admin.unsuspend")}
                        </button>
                      </form>
                    )}
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

- [ ] **Step 5: Route quản lý user**

`apps/web/src/routes/admin-users.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { deleteUserSessions } from "../auth/sessions.ts";
import { writeAudit } from "../db/audit.ts";
import { findUserById, searchUsers, setUserStatus } from "../db/users.ts";
import { userTransition, type UserAction } from "../domain/user.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { UsersPage } from "../views/admin/UsersPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerUserAdminRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/users", requireAdmin, async (c) => {
    const query = (c.req.query("q") ?? "").slice(0, 254);
    const users = await searchUsers(c.env.DB, query);
    return page(c, <UsersPage locale={c.get("locale")} origin={requestOrigin(c)} query={query} users={users} currentUserId={c.get("user")!.id} />);
  });
  onLocalized(app, "post", "/admin/users/:id/suspend", requireAdmin, (c) => changeUser(c, "suspend"));
  onLocalized(app, "post", "/admin/users/:id/unsuspend", requireAdmin, (c) => changeUser(c, "unsuspend"));
}

/** Spec §8.2: a suspended user can't sign in and loses every session; their builder profile hides. */
async function changeUser(c: Context<AppEnv>, action: UserAction) {
  const admin = c.get("user")!;
  const target = await findUserById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return errorResponse(c, "notFound", 404);
  if (target.id === admin.id) return errorResponse(c, "conflict", 409);
  const next = userTransition(target.status, action);
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  if (!(await setUserStatus(c.env.DB, { id: target.id, from: target.status, to: next.status, now }))) return errorResponse(c, "conflict", 409);
  if (action === "suspend") await deleteUserSessions(c.env.DB, target.id);
  await writeAudit(c.env.DB, { actorUserId: admin.id, action: `user.${action}`, entity: "user", entityId: target.id, data: { from: target.status, to: next.status }, now });
  return c.redirect(localizedPath(c.get("locale"), `/admin/users?q=${encodeURIComponent(target.email)}`), 303);
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerUserAdminRoutes(app);` sau `registerInviteAdminRoutes(app);`.

- [ ] **Step 6: Key i18n**

`en.ts`:

```ts
  "admin.nav.users": "Users",
  "admin.col.account": "Account",
  "admin.suspend": "Suspend",
  "admin.unsuspend": "Unsuspend",
  "admin.reasonOptional": "Reason (optional, admins only)",
  "users.title": "Users",
  "users.search": "Search by email",
  "users.searchSubmit": "Search",
  "users.empty": "No users found.",
  "users.col.status": "Status",
  "users.col.admin": "Admin",
  "users.col.builder": "Builder",
  "users.status.active": "Active",
  "users.status.suspended": "Suspended",
```

`vi.ts`:

```ts
  "admin.nav.users": "Người dùng",
  "admin.col.account": "Tài khoản",
  "admin.suspend": "Khóa",
  "admin.unsuspend": "Mở khóa",
  "admin.reasonOptional": "Lý do (không bắt buộc, chỉ admin thấy)",
  "users.title": "Người dùng",
  "users.search": "Tìm theo email",
  "users.searchSubmit": "Tìm",
  "users.empty": "Không tìm thấy người dùng.",
  "users.col.status": "Trạng thái",
  "users.col.admin": "Admin",
  "users.col.builder": "Builder",
  "users.status.active": "Đang hoạt động",
  "users.status.suspended": "Đã khóa",
```

`zh-hans.ts`:

```ts
  "admin.nav.users": "用户",
  "admin.col.account": "账户",
  "admin.suspend": "停用",
  "admin.unsuspend": "恢复",
  "admin.reasonOptional": "原因（可选，仅管理员可见）",
  "users.title": "用户",
  "users.search": "按邮箱搜索",
  "users.searchSubmit": "搜索",
  "users.empty": "未找到用户。",
  "users.col.status": "状态",
  "users.col.admin": "管理员",
  "users.col.builder": "Builder",
  "users.status.active": "正常",
  "users.status.suspended": "已停用",
```

`zh-hant.ts`:

```ts
  "admin.nav.users": "使用者",
  "admin.col.account": "帳戶",
  "admin.suspend": "停用",
  "admin.unsuspend": "恢復",
  "admin.reasonOptional": "原因（選填，僅管理員可見）",
  "users.title": "使用者",
  "users.search": "依電子郵件搜尋",
  "users.searchSubmit": "搜尋",
  "users.empty": "找不到使用者。",
  "users.col.status": "狀態",
  "users.col.admin": "管理員",
  "users.col.builder": "Builder",
  "users.status.active": "正常",
  "users.status.suspended": "已停用",
```

- [ ] **Step 7: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết, gồm `test/auth/login-flow.test.ts` ("makes ADMIN_EMAILS users admins").

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): suspend builders and users; ADMIN_EMAILS grants and revokes admin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Sau khi xong 9 task

- Review toàn nhánh (model mạnh nhất) theo `.ai/templates/REVIEW-TEMPLATE.md`; xử lý phát hiện theo quy trình CLAUDE.md bước 8–10.
- Kiểm cổng ra M2 bằng lệnh:
  - Invite → approved ngay: `npm test -w apps/web -- test/admin/invites.test.ts` (test "M2 exit gate").
  - Không invite → pending → admin duyệt: `npm test -w apps/web -- test/admin/builders.test.ts`.
  - `/b/:handle` chỉ hiện builder approved: `npm test -w apps/web -- test/public/builder-profile.test.ts test/admin/suspend.test.ts`.
- Cập nhật `CURRENT-STATUS.md` (Reviewer), gồm điều kiện deploy mới: thêm migration `0004_builders` vào bước `db:migrate:remote`.

## Ngoài phạm vi M2 (ghi lại để không làm lan)

- Ô đếm product / inquiry / lời mời trong Hub (M3, M5, M6); danh sách product và nút Hire trên `/b/:handle` (M3, M5).
- Ảnh portfolio (R2, M3); Open Graph / JSON-LD cho builder (M4 cùng SEO toàn site); `/builders` (M4).
- Thu hồi invite trước hạn; sửa handle sau khi approved (Owner đã quyết định khóa).
- Gửi lại email quyết định khi lỗi (cơ chế `notified_at` chỉ có cho tin nhắn ở M5).

