# VNX.SI M3 — Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** APPROVED bởi Owner 2026-10-04
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M3 (VNX-0301 … VNX-0307, tách nhỏ thành 8 task code + 1 việc của Owner)
- **Nhánh:** `feat/m3-product` (tách từ `main` @ `3bde074`)

**Goal:** Builder tạo product qua editor 9 bước (kèm ảnh trên R2), gửi duyệt; admin duyệt / yêu cầu sửa / khóa và gắn huy hiệu; product đã duyệt hiện ở `/p/:slug` với JSON-LD và Open Graph.

**Architecture:**
- Giữ khung M1–M2: `domain/` thuần (state machine, zod, đặc tả field theo bước), `db/` chỉ truy vấn, `routes/` ghép, `views/` chỉ trình bày.
- Editor sinh form từ một bảng đặc tả field (`STEP_FIELDS`) dùng chung cho parse (domain), lưu (db, danh sách cột cố định) và render (view). Bước Pricing có form riêng.
- Ảnh lưu trên R2 (binding `MEDIA`), phục vụ qua `/media/*`; kiểm magic bytes, không tin `Content-Type`.
- Mọi chuyển trạng thái dùng compare-and-set `UPDATE … WHERE status = <cũ>`; sai trạng thái → 409; ghi `audit_log`.
- Huy hiệu là các dòng `product_verifications`; unique index một phần bảo đảm mỗi loại chỉ có một dòng đang hiệu lực.

**Tech Stack:** như M1–M2. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md` mục 5.2 (`/p/:slug`), 5.3 (editor 9 bước), 5.5 (admin product), 6.1 (`products`, `pricing_tiers`, `product_media`, `product_verifications`), 7.2, 8.3, 8.5, 8.6, 8.8, 9.

## Quyết định của Owner (2026-10-04)

- **Đang `in_review` thì khóa:** builder chỉ xem; có nút **Rút lại** (`withdraw`: `in_review` → `draft`) để sửa rồi gửi lại. Admin luôn duyệt đúng bản đã gửi.
- **`primary_lang`:** `en`, `vi`, `zh-Hans`, `zh-Hant`.
- **Bucket R2 `vnxsi-media`:** Owner giao Claude tạo bằng wrangler. Lần thử 2026-10-04 lỗi `code 10042` (tài khoản chưa bật R2) → **Owner bật R2 trên Cloudflare Dashboard**, sau đó Claude chạy `wrangler r2 bucket create vnxsi-media`. Test không phụ thuộc việc này (miniflare giả lập R2).

## Global Constraints

- Mọi ràng buộc của plan M0–M1 và M2 vẫn áp dụng (phiên bản pin, không thêm dependency, ranh giới module, Origin check, test sở hữu bảng).
- Migration mới: `apps/web/migrations/0005_products.sql`, chỉ thêm. Bảng FTS (`products_fts`) **chưa tạo**: thuộc M4 (VNX-0401). Không chạy migration remote, không deploy.
- **State machine product (spec 7.2):**
  - owner: `submit` (draft | changes_requested → in_review), `withdraw` (in_review → draft), `unlist` (published → unlisted), `relist` (unlisted → published), `archive` (draft | changes_requested | published | unlisted → archived).
  - admin: `approve` (in_review → published), `request_changes` (in_review → changes_requested, bắt buộc ghi chú), `suspend` (published → suspended), `unsuspend` (suspended → published).
  - `archived` là xóa mềm, không quay lại; slug vẫn bị giữ.
- **Sửa được** khi product ở `draft`, `changes_requested`, `published`, `unlisted` và builder không `suspended`. Mọi POST sửa ở trạng thái khác → 409.
- **Sửa khi đã từng publish** (`first_published_at` có giá trị): lên ngay, không duyệt lại; đặt `edited_after_publish_at`, ghi audit `product.edit`.
- **Slug:** 3–60 ký tự `a-z0-9-`, bắt đầu và kết thúc bằng chữ hoặc số; sinh từ name (bỏ dấu tiếng Việt, `đ` → `d`); không đủ 3 ký tự (ví dụ tên toàn chữ Hán) → `product`; trùng → thêm `-xxxx` ngẫu nhiên. Sửa được đến lần publish đầu, sau đó khóa.
- **Giới hạn trường:** name ≤ 80 (bắt buộc), tagline ≤ 120, description ≤ 5000, problem ≤ 2000, target_users ≤ 1000, tags ≤ 10 mục × ≤ 30, features ≤ 20 dòng × ≤ 120, tech_stack ≤ 20 mục × ≤ 40, customization_notes ≤ 2000, support_policy ≤ 2000, review note ≤ 1000, demo_url / website_url chỉ `https://` ≤ 500.
- **Category:** `booking`, `crm`, `ecommerce`, `finance`, `hr`, `education`, `internal_tools`, `ai_agents`, `other` (có bản dịch 4 ngôn ngữ). **delivery_model:** `saas`, `source`, `service`. **license:** `single_use`, `extended`, `open_source`; bắt buộc khi `source`, luôn `null` khi không phải `source`.
- **Pricing:** tối đa 5 tier; tên ≤ 40, mô tả ≤ 300; `billing` `one_time` | `monthly` | `yearly` | `contact`; giá nhập USD (tối đa 2 chữ số thập phân), 0 – 100000, lưu cent; `contact` thì không có giá (`price_cents` null).
- **Ảnh:** JPEG / PNG / WebP theo magic bytes; ≤ 2 MB; ≤ 8 ảnh mỗi product; alt ≤ 150. Key `products/{product_id}/{ulid}.{ext}`. `/media/*` trả `Cache-Control: public, max-age=31536000, immutable` và `X-Content-Type-Options: nosniff`.
- **Điều kiện submit (spec 7.2):** builder `approved`; có name, tagline, problem, target_users, description, category, delivery_model, support_policy; ≥ 1 feature; ≥ 1 tier; ≥ 1 ảnh; có license nếu `source`.
- **Khi duyệt:** tự gắn huy hiệu `listed` (`verified_by = null`); đặt `published_at` (và `first_published_at` nếu là lần đầu). Email cho builder khi duyệt / yêu cầu sửa, theo `users.locale`; gửi lỗi không hoàn tác.
- **Huy hiệu:** admin gắn `demo_verified` / `in_production` bắt buộc ghi evidence (≤ 500); thu hồi bắt buộc lý do (≤ 300). Đổi `demo_url` khi đang có `demo_verified` → hệ thống thu hồi với `revoke_reason = 'demo_url_changed'`.
- **Công khai** = product `published` **và** builder `approved` **và** user `active`; còn lại `/p/:slug` → 404.
- **Chưa render** 4 nút Buy / Customize / Hire Builder / Build Similar (đến M5 cùng form Inquiry), không có `/p/:slug/demo` đếm click (M7). Link demo trỏ thẳng `demo_url`.
- **JSON-LD** là ngoại lệ duy nhất cho chèn nội dung thô: qua helper `jsonLdScript` có escape `<`, `>`, `&`, U+2028, U+2029; có test.
- Chuỗi giao diện qua `t()`; key mới có đủ 4 file locale. Test admin dùng `owner@vnx.si`.

## Review Focus

1. **Truy cập product của người khác:** id product / media / tier của builder khác → 404, không sửa / xóa được. Test ở Task 2, 3, 4.
2. **File giả dạng ảnh:** file `.png` chứa HTML/SVG, GIF, file > 2 MB, ảnh thứ 9 → bị từ chối, R2 không còn object rác. Test ở Task 3.
3. **Lách trạng thái:** sửa khi `in_review` / `suspended` / `archived`, submit khi thiếu điều kiện, duyệt hai lần → 409 hoặc 400 đúng. Test ở Task 2, 5, 6.
4. **Nội dung người dùng trong JSON-LD và HTML:** tên product chứa `</script><script>` hoặc `<img onerror>` → không thoát khỏi thẻ script, được escape trong HTML. Test ở Task 8.
5. **Product không công khai truy cập trực tiếp:** draft / in_review / unlisted / suspended / archived, builder bị khóa, user bị khóa → `/p/:slug` 404. Test ở Task 8.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-0301 | Migration `0005_products`, state machine, slug, điều kiện submit, `db/products`, `db/verifications` | — |
| 2 | VNX-0303 | Danh sách product trong Hub, tạo nháp, khung editor, 8 bước văn bản (Product … Support trừ Pricing), tự thu hồi Demo verified | 1 |
| 3 | VNX-0302 | R2: upload / xóa ảnh trong bước Demo, `/media/*` | 2 |
| 4 | VNX-0304a | Bước Pricing (≤ 5 tier) | 2 |
| 5 | VNX-0304b | Checklist điều kiện, submit / rút lại / ẩn / hiện lại / lưu trữ; đếm product ở tổng quan Hub | 3, 4 |
| 6 | VNX-0305a | Admin: hàng chờ product, duyệt / yêu cầu sửa / khóa / mở khóa, huy hiệu `listed`, email | 5 |
| 7 | VNX-0305b | Admin: gắn / thu hồi huy hiệu, mục "Mới chỉnh sửa"; test cổng ra M3 | 6 |
| 8 | VNX-0306 | `/p/:slug`, Open Graph, JSON-LD; product trên `/b/:handle` | 7 |
| — | VNX-0307 | Owner bật R2; Claude tạo bucket `vnxsi-media` | không chặn code |

Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`. Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: VNX-0301 — Dữ liệu và domain product

**Files:**
- Create: `apps/web/migrations/0005_products.sql`
- Create: `apps/web/src/domain/product.ts`, `apps/web/src/domain/slug.ts`
- Create: `apps/web/src/db/products.ts`, `apps/web/src/db/verifications.ts`
- Modify: `apps/web/test/architecture.test.ts` (thêm 4 bảng vào `WRITERS`), `apps/web/test/fixtures.ts` (thêm `makeDraft`)
- Test: `apps/web/test/domain/product.test.ts`, `apps/web/test/db/products.test.ts`

**Interfaces:**
- Consumes: `ulid`, `BuilderStatus` (`domain/builder.ts`), fixtures `ensureUser`, `makeBuilder`.
- Produces:
  - `domain/product.ts`: hằng `PRODUCT_STATUSES`, `CATEGORIES`, `DELIVERY_MODELS`, `LICENSES`, `BILLINGS`, `PRODUCT_LANGS`, `BADGE_KINDS`, `MAX_TIERS = 5`, `MAX_MEDIA = 8`, `MAX_MEDIA_BYTES = 2 * 1024 * 1024`, `RECENTLY_EDITED_DAYS = 14`; type `ProductStatus`, `Category`, `DeliveryModel`, `License`, `Billing`, `ProductLang`, `BadgeKind`, `Product`, `PricingTier`, `ProductMedia`, `Badge`, `ProductAction`, `ProductActor`, `ReadinessGap`; hàm `transition`, `isProductStatus`, `canEditProduct`, `canChangeSlug`, `submitGaps`.
  - `domain/slug.ts`: `SLUG_RE`, `slugify(name)`, `slugWithSuffix(base, suffix)`.
  - `db/products.ts`: `ProductRow`, `toProduct`, `createProductDraft`, `findProductById`, `findOwnedProduct`, `listBuilderProducts`, `setProductStatus`.
  - `db/verifications.ts`: `listActiveBadges`, `grantBadge`, `revokeBadge`.
  - fixture `makeDraft(email, handle, name, builderStatus?)` → `{ builder, product }`.

- [ ] **Step 1: Viết migration**

`apps/web/migrations/0005_products.sql`:

```sql
-- Wave 1 products (spec §6.1, §7.2). Additive only. products_fts arrives with M4 (VNX-0401).
CREATE TABLE products (
  id                      TEXT PRIMARY KEY,
  builder_id              TEXT NOT NULL REFERENCES builders (user_id),
  slug                    TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'in_review', 'changes_requested', 'published', 'unlisted', 'suspended', 'archived')),
  primary_lang            TEXT NOT NULL DEFAULT 'en' CHECK (primary_lang IN ('en', 'vi', 'zh-Hans', 'zh-Hant')),
  name                    TEXT NOT NULL,
  tagline                 TEXT NOT NULL DEFAULT '',
  problem                 TEXT NOT NULL DEFAULT '',
  target_users            TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  category                TEXT CHECK (category IS NULL OR category IN ('booking', 'crm', 'ecommerce', 'finance', 'hr', 'education', 'internal_tools', 'ai_agents', 'other')),
  tags                    TEXT NOT NULL DEFAULT '[]',
  features                TEXT NOT NULL DEFAULT '[]',
  tech_stack              TEXT NOT NULL DEFAULT '[]',
  delivery_model          TEXT CHECK (delivery_model IS NULL OR delivery_model IN ('saas', 'source', 'service')),
  license                 TEXT CHECK (license IS NULL OR license IN ('single_use', 'extended', 'open_source')),
  demo_url                TEXT,
  website_url             TEXT,
  customizable            INTEGER NOT NULL DEFAULT 0 CHECK (customizable IN (0, 1)),
  customization_notes     TEXT NOT NULL DEFAULT '',
  support_policy          TEXT NOT NULL DEFAULT '',
  review_note             TEXT,
  first_published_at      TEXT,
  published_at            TEXT,
  edited_after_publish_at TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
CREATE INDEX idx_products_status_published ON products (status, published_at);
CREATE INDEX idx_products_builder ON products (builder_id);
CREATE INDEX idx_products_category_status ON products (category, status);

CREATE TABLE pricing_tiers (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products (id),
  name        TEXT NOT NULL,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  billing     TEXT NOT NULL CHECK (billing IN ('one_time', 'monthly', 'yearly', 'contact')),
  description TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  CHECK ((billing = 'contact') = (price_cents IS NULL))
);
CREATE INDEX idx_tiers_product ON pricing_tiers (product_id, sort);

CREATE TABLE product_media (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  r2_key     TEXT NOT NULL UNIQUE,
  alt        TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_media_product ON product_media (product_id, sort);

CREATE TABLE product_verifications (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products (id),
  kind          TEXT NOT NULL CHECK (kind IN ('listed', 'demo_verified', 'in_production')),
  verified_by   TEXT REFERENCES users (id),
  evidence      TEXT NOT NULL DEFAULT '',
  verified_at   TEXT NOT NULL,
  revoked_at    TEXT,
  revoke_reason TEXT
);
CREATE INDEX idx_verifications_product ON product_verifications (product_id);
-- At most one active badge of each kind per product.
CREATE UNIQUE INDEX uq_verifications_active ON product_verifications (product_id, kind) WHERE revoked_at IS NULL;
```

- [ ] **Step 2: Viết test (fail)**

`apps/web/test/domain/product.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canChangeSlug, canEditProduct, PRODUCT_STATUSES, submitGaps, transition, type Product, type ProductAction } from "../../src/domain/product.ts";
import { slugify, slugWithSuffix, SLUG_RE } from "../../src/domain/slug.ts";

const VALID: [string, ProductAction, "owner" | "admin", string][] = [
  ["draft", "submit", "owner", "in_review"],
  ["changes_requested", "submit", "owner", "in_review"],
  ["in_review", "withdraw", "owner", "draft"],
  ["in_review", "approve", "admin", "published"],
  ["in_review", "request_changes", "admin", "changes_requested"],
  ["published", "unlist", "owner", "unlisted"],
  ["unlisted", "relist", "owner", "published"],
  ["published", "suspend", "admin", "suspended"],
  ["suspended", "unsuspend", "admin", "published"],
  ["draft", "archive", "owner", "archived"],
  ["changes_requested", "archive", "owner", "archived"],
  ["published", "archive", "owner", "archived"],
  ["unlisted", "archive", "owner", "archived"],
];

describe("product state machine (spec §7.2)", () => {
  it.each(VALID)("%s --%s by %s--> %s", (from, action, actor, to) => {
    expect(transition(from as Product["status"], action, actor)).toEqual({ ok: true, status: to });
  });

  it("rejects every other combination", () => {
    const valid = new Set(VALID.map(([from, action, actor]) => `${from}:${action}:${actor}`));
    const actions: ProductAction[] = ["submit", "withdraw", "approve", "request_changes", "unlist", "relist", "suspend", "unsuspend", "archive"];
    for (const status of PRODUCT_STATUSES) {
      for (const action of actions) {
        for (const actor of ["owner", "admin"] as const) {
          if (valid.has(`${status}:${action}:${actor}`)) continue;
          expect(transition(status, action, actor), `${status}:${action}:${actor}`).toEqual({ ok: false, error: "invalid_transition" });
        }
      }
    }
  });

  it("allows editing only in draft, changes_requested, published and unlisted", () => {
    expect(PRODUCT_STATUSES.filter((s) => canEditProduct(s))).toEqual(["draft", "changes_requested", "published", "unlisted"]);
  });

  it("locks the slug after the first publish", () => {
    expect(canChangeSlug({ firstPublishedAt: null })).toBe(true);
    expect(canChangeSlug({ firstPublishedAt: "2026-10-04T00:00:00.000Z" })).toBe(false);
  });
});

const complete: Product = {
  id: "01J0000000000000000000000A",
  builderId: "u1",
  slug: "booking-app",
  status: "draft",
  primaryLang: "en",
  name: "Booking app",
  tagline: "Bookings for spas",
  problem: "Phone bookings get lost",
  targetUsers: "Spa owners",
  description: "Online booking.",
  category: "booking",
  tags: [],
  features: ["Calendar"],
  techStack: [],
  deliveryModel: "saas",
  license: null,
  demoUrl: null,
  websiteUrl: null,
  customizable: false,
  customizationNotes: "",
  supportPolicy: "Email, 48h",
  reviewNote: null,
  firstPublishedAt: null,
  publishedAt: null,
  editedAfterPublishAt: null,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};

describe("submit conditions (spec §7.2)", () => {
  it("passes a complete product", () => {
    expect(submitGaps({ product: complete, builderStatus: "approved", tierCount: 1, mediaCount: 1 })).toEqual([]);
  });

  it("lists every gap in a fixed order", () => {
    const empty: Product = { ...complete, tagline: "", problem: " ", targetUsers: "", description: "", category: null, deliveryModel: "source", license: null, supportPolicy: "", features: [] };
    expect(submitGaps({ product: empty, builderStatus: "pending", tierCount: 0, mediaCount: 0 })).toEqual([
      "builder_not_approved",
      "tagline",
      "problem",
      "target_users",
      "description",
      "category",
      "support_policy",
      "features",
      "pricing",
      "media",
      "license",
    ]);
    expect(submitGaps({ product: { ...complete, deliveryModel: null }, builderStatus: "approved", tierCount: 1, mediaCount: 1 })).toEqual(["delivery_model"]);
  });
});

describe("slugs", () => {
  it.each([
    ["Booking App", "booking-app"],
    ["  Đặt lịch Spa!! ", "dat-lich-spa"],
    ["CRM / Sales -- Pro", "crm-sales-pro"],
    ["预约系统", "product"],
    ["AB", "product"],
    ["x".repeat(80), "x".repeat(60)],
  ])("slugify(%j) = %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(SLUG_RE.test(slugify(name))).toBe(true);
  });

  it("appends a suffix within 60 characters", () => {
    expect(slugWithSuffix("booking-app", "a1b2")).toBe("booking-app-a1b2");
    const long = slugWithSuffix("x".repeat(60), "a1b2");
    expect(long).toHaveLength(60);
    expect(long.endsWith("-a1b2")).toBe(true);
    expect(SLUG_RE.test(long)).toBe(true);
  });

  it.each(["ab", "-abc", "abc-", "Abc", "a_bc", "a".repeat(61)])("rejects slug %j", (slug) => {
    expect(SLUG_RE.test(slug)).toBe(false);
  });
});
```

`apps/web/test/db/products.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProductDraft, findOwnedProduct, listBuilderProducts, setProductStatus } from "../../src/db/products.ts";
import { grantBadge, listActiveBadges, revokeBadge } from "../../src/db/verifications.ts";
import { ensureUser, makeBuilder, makeDraft } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-04T10:00:00.000Z";
const LATER = "2026-10-05T10:00:00.000Z";
const db = () => testEnv.DB;

describe("db/products", () => {
  it("creates a draft with a slug from the name and a suffix on collision", async () => {
    const b = await makeBuilder("pdb-slug@vnx.si", "pdb-slug");
    const first = await createProductDraft(db(), { builderId: b.userId, name: "Spa Booking Kit", now: NOW });
    expect(first).toMatchObject({ status: "draft", slug: "spa-booking-kit", name: "Spa Booking Kit", primaryLang: "en", tags: [], customizable: false, license: null });
    const second = await createProductDraft(db(), { builderId: b.userId, name: "Spa booking kit", now: NOW });
    expect(second.slug).toMatch(/^spa-booking-kit-[a-z0-9]{4}$/);
  });

  it("finds products only for their owner and lists them without archived ones", async () => {
    const { builder, product } = await makeDraft("pdb-own@vnx.si", "pdb-own", "Owned thing");
    const other = await makeBuilder("pdb-other@vnx.si", "pdb-other");
    expect(await findOwnedProduct(db(), builder.userId, product.id)).toMatchObject({ id: product.id });
    expect(await findOwnedProduct(db(), other.userId, product.id)).toBeNull();
    await setProductStatus(db(), { id: product.id, from: "draft", to: "archived", reviewNote: null, now: LATER });
    expect(await listBuilderProducts(db(), builder.userId)).toEqual([]);
  });

  it("changes status atomically and keeps the first publish time", async () => {
    const { product } = await makeDraft("pdb-status@vnx.si", "pdb-status", "Status thing");
    await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW });
    expect(await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW })).toBeNull();
    const published = await setProductStatus(db(), { id: product.id, from: "in_review", to: "published", reviewNote: null, now: NOW });
    expect(published).toMatchObject({ status: "published", publishedAt: NOW, firstPublishedAt: NOW });
    await setProductStatus(db(), { id: product.id, from: "published", to: "suspended", reviewNote: "spam", now: LATER });
    const again = await setProductStatus(db(), { id: product.id, from: "suspended", to: "published", reviewNote: null, now: LATER });
    expect(again).toMatchObject({ publishedAt: LATER, firstPublishedAt: NOW, reviewNote: null });
  });
});

describe("db/verifications", () => {
  it("keeps one active badge per kind and revokes it", async () => {
    const { product } = await makeDraft("pdb-badge@vnx.si", "pdb-badge", "Badge thing");
    const admin = await ensureUser("owner@vnx.si");
    expect(await grantBadge(db(), { productId: product.id, kind: "listed", verifiedBy: null, evidence: "", now: NOW })).toBe(true);
    expect(await grantBadge(db(), { productId: product.id, kind: "listed", verifiedBy: null, evidence: "", now: NOW })).toBe(false);
    expect(await grantBadge(db(), { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "Tried the demo", now: NOW })).toBe(true);
    expect((await listActiveBadges(db(), product.id)).map((b) => b.kind).sort()).toEqual(["demo_verified", "listed"]);

    expect(await revokeBadge(db(), { productId: product.id, kind: "demo_verified", reason: "demo_url_changed", now: LATER })).toBe(true);
    expect(await revokeBadge(db(), { productId: product.id, kind: "demo_verified", reason: "again", now: LATER })).toBe(false);
    expect((await listActiveBadges(db(), product.id)).map((b) => b.kind)).toEqual(["listed"]);
    // A revoked badge can be granted again.
    expect(await grantBadge(db(), { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "Re-checked", now: LATER })).toBe(true);
  });
});
```

Thêm vào cuối `apps/web/test/fixtures.ts` (thêm import `createProductDraft` từ `../src/db/products.ts` và type `Product` từ `../src/domain/product.ts`):

```ts
/** A builder (default approved) with one fresh draft product. */
export async function makeDraft(email: string, handle: string, name: string, builderStatus: BuilderStatus = "approved"): Promise<{ builder: Builder; product: Product }> {
  const builder = await makeBuilder(email, handle, builderStatus);
  const product = await createProductDraft(testEnv.DB, { builderId: builder.userId, name, now: new Date().toISOString() });
  return { builder, product };
}
```

Sửa `WRITERS` trong `apps/web/test/architecture.test.ts`, thêm:

```ts
  products: "../src/db/products.ts",
  pricing_tiers: "../src/db/pricing.ts",
  product_media: "../src/db/media.ts",
  product_verifications: "../src/db/verifications.ts",
```

Run: `npm test -w apps/web -- test/domain/product.test.ts test/db/products.test.ts`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Domain**

`apps/web/src/domain/slug.ts`:

```ts
/** 3–60 characters, a-z0-9 and inner hyphens (spec §6.1 products.slug). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const MAX = 60;

/** ASCII slug from a product name: strips Vietnamese diacritics; names with too few Latin characters become "product". */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "product";
}

/** `base-suffix`, trimming the base so the result stays within 60 characters. */
export function slugWithSuffix(base: string, suffix: string): string {
  const room = MAX - suffix.length - 1;
  return `${base.slice(0, room).replace(/-+$/g, "")}-${suffix}`;
}
```

`apps/web/src/domain/product.ts`:

```ts
import type { BuilderStatus } from "./builder.ts";

export const PRODUCT_STATUSES = ["draft", "in_review", "changes_requested", "published", "unlisted", "suspended", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const CATEGORIES = ["booking", "crm", "ecommerce", "finance", "hr", "education", "internal_tools", "ai_agents", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const DELIVERY_MODELS = ["saas", "source", "service"] as const;
export type DeliveryModel = (typeof DELIVERY_MODELS)[number];
export const LICENSES = ["single_use", "extended", "open_source"] as const;
export type License = (typeof LICENSES)[number];
export const BILLINGS = ["one_time", "monthly", "yearly", "contact"] as const;
export type Billing = (typeof BILLINGS)[number];
/** Owner decision 2026-10-04: Chinese content is split into Simplified and Traditional. */
export const PRODUCT_LANGS = ["en", "vi", "zh-Hans", "zh-Hant"] as const;
export type ProductLang = (typeof PRODUCT_LANGS)[number];
export const BADGE_KINDS = ["listed", "demo_verified", "in_production"] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

export const MAX_TIERS = 5;
export const MAX_MEDIA = 8;
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const RECENTLY_EDITED_DAYS = 14;

export interface Product {
  id: string;
  builderId: string;
  slug: string;
  status: ProductStatus;
  primaryLang: ProductLang;
  name: string;
  tagline: string;
  problem: string;
  targetUsers: string;
  description: string;
  category: Category | null;
  tags: string[];
  features: string[];
  techStack: string[];
  deliveryModel: DeliveryModel | null;
  license: License | null;
  demoUrl: string | null;
  websiteUrl: string | null;
  customizable: boolean;
  customizationNotes: string;
  supportPolicy: string;
  reviewNote: string | null;
  firstPublishedAt: string | null;
  publishedAt: string | null;
  editedAfterPublishAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingTier {
  id: string;
  productId: string;
  name: string;
  priceCents: number | null;
  billing: Billing;
  description: string;
  sort: number;
}

export interface ProductMedia {
  id: string;
  productId: string;
  r2Key: string;
  alt: string;
  sort: number;
}

export interface Badge {
  id: string;
  productId: string;
  kind: BadgeKind;
  verifiedBy: string | null;
  evidence: string;
  verifiedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export type ProductAction = "submit" | "withdraw" | "approve" | "request_changes" | "unlist" | "relist" | "suspend" | "unsuspend" | "archive";
export type ProductActor = "owner" | "admin";
export type ProductTransition = { ok: true; status: ProductStatus } | { ok: false; error: "invalid_transition" };

const RULES: Record<ProductAction, { from: readonly ProductStatus[]; to: ProductStatus; actor: ProductActor }> = {
  submit: { from: ["draft", "changes_requested"], to: "in_review", actor: "owner" },
  // Owner decision 2026-10-04: in_review is read-only; withdrawing returns it to draft for editing.
  withdraw: { from: ["in_review"], to: "draft", actor: "owner" },
  approve: { from: ["in_review"], to: "published", actor: "admin" },
  request_changes: { from: ["in_review"], to: "changes_requested", actor: "admin" },
  unlist: { from: ["published"], to: "unlisted", actor: "owner" },
  relist: { from: ["unlisted"], to: "published", actor: "owner" },
  suspend: { from: ["published"], to: "suspended", actor: "admin" },
  unsuspend: { from: ["suspended"], to: "published", actor: "admin" },
  archive: { from: ["draft", "changes_requested", "published", "unlisted"], to: "archived", actor: "owner" },
};

/** Spec §7.2. Submit conditions are checked separately with `submitGaps`. */
export function transition(status: ProductStatus, action: ProductAction, actor: ProductActor): ProductTransition {
  const rule = RULES[action];
  if (!rule.from.includes(status) || rule.actor !== actor) return { ok: false, error: "invalid_transition" };
  return { ok: true, status: rule.to };
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly unknown[]).includes(value);
}

export function canEditProduct(status: ProductStatus): boolean {
  return status === "draft" || status === "changes_requested" || status === "published" || status === "unlisted";
}

/** The slug is editable until the first publish, then locked (spec §6.1). */
export function canChangeSlug(product: Pick<Product, "firstPublishedAt">): boolean {
  return product.firstPublishedAt === null;
}

export type ReadinessGap =
  | "builder_not_approved"
  | "name"
  | "tagline"
  | "problem"
  | "target_users"
  | "description"
  | "category"
  | "delivery_model"
  | "support_policy"
  | "features"
  | "pricing"
  | "media"
  | "license";

/** Everything spec §7.2 requires before submit, in display order. Empty = ready. */
export function submitGaps(input: { product: Product; builderStatus: BuilderStatus; tierCount: number; mediaCount: number }): ReadinessGap[] {
  const p = input.product;
  const blank = (s: string) => s.trim() === "";
  const gaps: ReadinessGap[] = [];
  if (input.builderStatus !== "approved") gaps.push("builder_not_approved");
  if (blank(p.name)) gaps.push("name");
  if (blank(p.tagline)) gaps.push("tagline");
  if (blank(p.problem)) gaps.push("problem");
  if (blank(p.targetUsers)) gaps.push("target_users");
  if (blank(p.description)) gaps.push("description");
  if (!p.category) gaps.push("category");
  if (!p.deliveryModel) gaps.push("delivery_model");
  if (blank(p.supportPolicy)) gaps.push("support_policy");
  if (p.features.length === 0) gaps.push("features");
  if (input.tierCount === 0) gaps.push("pricing");
  if (input.mediaCount === 0) gaps.push("media");
  if (p.deliveryModel === "source" && !p.license) gaps.push("license");
  return gaps;
}
```

- [ ] **Step 4: DB**

`apps/web/src/db/products.ts`:

```ts
import type { Product, ProductStatus } from "../domain/product.ts";
import { slugify, slugWithSuffix } from "../domain/slug.ts";
import { ulid } from "../lib/ulid.ts";

export type ProductRow = {
  id: string;
  builder_id: string;
  slug: string;
  status: ProductStatus;
  primary_lang: Product["primaryLang"];
  name: string;
  tagline: string;
  problem: string;
  target_users: string;
  description: string;
  category: Product["category"];
  tags: string;
  features: string;
  tech_stack: string;
  delivery_model: Product["deliveryModel"];
  license: Product["license"];
  demo_url: string | null;
  website_url: string | null;
  customizable: number;
  customization_notes: string;
  support_policy: string;
  review_note: string | null;
  first_published_at: string | null;
  published_at: string | null;
  edited_after_publish_at: string | null;
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

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    builderId: r.builder_id,
    slug: r.slug,
    status: r.status,
    primaryLang: r.primary_lang,
    name: r.name,
    tagline: r.tagline,
    problem: r.problem,
    targetUsers: r.target_users,
    description: r.description,
    category: r.category,
    tags: jsonList(r.tags),
    features: jsonList(r.features),
    techStack: jsonList(r.tech_stack),
    deliveryModel: r.delivery_model,
    license: r.license,
    demoUrl: r.demo_url,
    websiteUrl: r.website_url,
    customizable: r.customizable === 1,
    customizationNotes: r.customization_notes,
    supportPolicy: r.support_policy,
    reviewNote: r.review_note,
    firstPublishedAt: r.first_published_at,
    publishedAt: r.published_at,
    editedAfterPublishAt: r.edited_after_publish_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function randomSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => alphabet[b % alphabet.length]).join("");
}

/** New draft; the slug comes from the name and gets a random suffix when taken. */
export async function createProductDraft(db: D1Database, input: { builderId: string; name: string; now: string }): Promise<Product> {
  const id = ulid(Date.parse(input.now));
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : slugWithSuffix(base, randomSuffix());
    try {
      await db
        .prepare("INSERT INTO products (id, builder_id, slug, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)")
        .bind(id, input.builderId, slug, input.name, input.now)
        .run();
      const product = await findProductById(db, id);
      if (!product) throw new Error("product insert failed");
      return product;
    } catch (err) {
      if (!String(err).includes("products.slug")) throw err;
    }
  }
  throw new Error("could not allocate a product slug");
}

export async function findProductById(db: D1Database, id: string): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ?1").bind(id).first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** The product only if `builderId` owns it; anything else reads as missing. */
export async function findOwnedProduct(db: D1Database, builderId: string, id: string): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ?1 AND builder_id = ?2").bind(id, builderId).first<ProductRow>();
  return row ? toProduct(row) : null;
}

/** The builder's products except archived ones, most recently changed first. */
export async function listBuilderProducts(db: D1Database, builderId: string): Promise<Product[]> {
  const { results } = await db
    .prepare("SELECT * FROM products WHERE builder_id = ?1 AND status != 'archived' ORDER BY updated_at DESC, id DESC")
    .bind(builderId)
    .all<ProductRow>();
  return results.map(toProduct);
}

/** Compare-and-set on status. Publishing stamps published_at and, the first time, first_published_at. */
export async function setProductStatus(
  db: D1Database,
  input: { id: string; from: ProductStatus; to: ProductStatus; reviewNote: string | null; now: string },
): Promise<Product | null> {
  const row = await db
    .prepare(
      `UPDATE products SET status = ?3, review_note = ?4, updated_at = ?5,
         published_at = CASE WHEN ?3 = 'published' THEN ?5 ELSE published_at END,
         first_published_at = CASE WHEN ?3 = 'published' THEN COALESCE(first_published_at, ?5) ELSE first_published_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.reviewNote, input.now)
    .first<ProductRow>();
  return row ? toProduct(row) : null;
}
```

`apps/web/src/db/verifications.ts`:

```ts
import type { Badge, BadgeKind } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; kind: BadgeKind; verified_by: string | null; evidence: string; verified_at: string; revoked_at: string | null; revoke_reason: string | null };

function toBadge(r: Row): Badge {
  return { id: r.id, productId: r.product_id, kind: r.kind, verifiedBy: r.verified_by, evidence: r.evidence, verifiedAt: r.verified_at, revokedAt: r.revoked_at, revokeReason: r.revoke_reason };
}

export async function listActiveBadges(db: D1Database, productId: string): Promise<Badge[]> {
  const { results } = await db
    .prepare("SELECT * FROM product_verifications WHERE product_id = ?1 AND revoked_at IS NULL ORDER BY verified_at, id")
    .bind(productId)
    .all<Row>();
  return results.map(toBadge);
}

/** Adds an active badge; false when one of that kind is already active (unique partial index). */
export async function grantBadge(
  db: D1Database,
  input: { productId: string; kind: BadgeKind; verifiedBy: string | null; evidence: string; now: string },
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO product_verifications (id, product_id, kind, verified_by, evidence, verified_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE NOT EXISTS (SELECT 1 FROM product_verifications WHERE product_id = ?2 AND kind = ?3 AND revoked_at IS NULL)`,
    )
    .bind(ulid(Date.parse(input.now)), input.productId, input.kind, input.verifiedBy, input.evidence, input.now)
    .run();
  return res.meta.changes === 1;
}

/** Revokes the active badge of that kind; false when none is active. */
export async function revokeBadge(db: D1Database, input: { productId: string; kind: BadgeKind; reason: string; now: string }): Promise<boolean> {
  const res = await db
    .prepare("UPDATE product_verifications SET revoked_at = ?4, revoke_reason = ?3 WHERE product_id = ?1 AND kind = ?2 AND revoked_at IS NULL")
    .bind(input.productId, input.kind, input.reason, input.now)
    .run();
  return res.meta.changes === 1;
}
```

- [ ] **Step 5: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết (192 test cũ + test mới).

```bash
git add apps/web/migrations/0005_products.sql apps/web/src/domain apps/web/src/db/products.ts apps/web/src/db/verifications.ts apps/web/test
git commit -m "feat(web): products, pricing, media and badge tables with product state machine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: VNX-0303 — Product trong Hub và editor (8 bước văn bản)

**Files:**
- Create: `apps/web/src/domain/product-input.ts`
- Create: `apps/web/src/routes/hub-products.tsx`
- Create: `apps/web/src/views/hub/ProductsPage.tsx`, `apps/web/src/views/hub/EditorLayout.tsx`, `apps/web/src/views/hub/ProductStepForm.tsx`
- Modify: `apps/web/src/domain/builder-input.ts` (export `splitCsv`), `apps/web/src/db/products.ts` (thêm `updateProductFields`), `apps/web/src/views/labels.ts`, `apps/web/src/views/hub/HubLayout.tsx` (mục Products), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/domain/product-input.test.ts`, `apps/web/test/hub/products.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Product`, `canEditProduct`, `canChangeSlug`, `SLUG_RE`, `createProductDraft`, `findOwnedProduct`, `listBuilderProducts`, `revokeBadge`), `isHttpsUrl`, `requireBuilder`, `requestOrigin`, `HubLayout`, `writeAudit`.
- Produces:
  - `domain/product-input.ts`: `PRODUCT_STEPS` (9 bước, thứ tự hiển thị), `TEXT_STEPS` (8 bước trừ `pricing`), type `ProductStep`, `TextStep`, `ProductField`, `FieldKind`, `FieldSpec`, `ProductFields`, `StepValues`, `FieldErrorCode`, `StepErrors`; `STEP_FIELDS`, `isProductStep`, `isTextStep`, `stepValuesFromBody`, `stepValuesFromProduct`, `parseStep`, `parseProductName`, `normalizeNewlines`.
  - `db/products.ts`: `updateProductFields(db, { productId, builderId, expectedStatus, fields, now, markEdited })` → `"ok" | "stale" | "slug_taken"`.
  - `views/labels.ts`: `PRODUCT_STATUS_KEY`, `CATEGORY_KEY`, `DELIVERY_KEY`, `LICENSE_KEY`, `PRODUCT_LANG_KEY`, `STEP_KEY`.
  - `EditorLayout` props `{ locale, origin, product, step, locked, children }` (Task 3–5 dùng lại).
  - Route: `GET|POST /hub/products`, `GET /hub/products/:id/edit` (→ bước `product`), `GET|POST /hub/products/:id/edit/:step` cho `TEXT_STEPS`. Audit: `product.create`, `product.edit` (chỉ khi đã từng publish), `badge.revoke` (thu hồi tự động).

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/domain/product-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseProductName, parseStep, stepValuesFromBody, stepValuesFromProduct, STEP_FIELDS, TEXT_STEPS } from "../../src/domain/product-input.ts";
import type { Product } from "../../src/domain/product.ts";

describe("product step input", () => {
  it("parses the product step and normalizes values", () => {
    const r = parseStep("product", {
      name: "  Spa Booking ",
      slug: " Spa-Booking ",
      tagline: "Bookings for spas",
      category: "booking",
      deliveryModel: "saas",
      primaryLang: "vi",
      tags: "spa, booking, Spa",
      description: "Line one\r\n\r\n- point",
    });
    expect(r).toEqual({
      ok: true,
      fields: {
        name: "Spa Booking",
        slug: "spa-booking",
        tagline: "Bookings for spas",
        category: "booking",
        deliveryModel: "saas",
        primaryLang: "vi",
        tags: ["spa", "booking"],
        description: "Line one\n\n- point",
      },
    });
  });

  it("allows empty optional fields in a draft but not an empty name", () => {
    expect(parseStep("product", { name: "", slug: "abc", tagline: "", category: "", deliveryModel: "", primaryLang: "en", tags: "", description: "" })).toEqual({
      ok: false,
      errors: { name: "required" },
    });
    expect(parseStep("product", { name: "X", slug: "abc", tagline: "", category: "", deliveryModel: "", primaryLang: "en", tags: "", description: "" })).toMatchObject({
      ok: true,
      fields: { category: null, deliveryModel: null, tags: [] },
    });
  });

  it("reports one code per bad field", () => {
    expect(
      parseStep("product", { name: "x".repeat(81), slug: "Bad Slug", tagline: "t".repeat(121), category: "games", deliveryModel: "boxed", primaryLang: "fr", tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(","), description: "" }),
    ).toEqual({
      ok: false,
      errors: { name: "too_long", slug: "slug", tagline: "too_long", category: "choice", deliveryModel: "choice", primaryLang: "choice", tags: "list" },
    });
  });

  it("splits features by line and tech stack by comma", () => {
    expect(parseStep("features", { features: "Calendar\r\n\r\n  Reminders  \nPayments", techStack: "Next.js, Supabase" })).toEqual({
      ok: true,
      fields: { features: ["Calendar", "Reminders", "Payments"], techStack: ["Next.js", "Supabase"] },
    });
    expect(parseStep("features", { features: Array.from({ length: 21 }, (_, i) => `f${i}`).join("\n"), techStack: "" })).toEqual({ ok: false, errors: { features: "list" } });
    expect(parseStep("features", { features: "x".repeat(121), techStack: "" })).toEqual({ ok: false, errors: { features: "list" } });
  });

  it("accepts only https URLs and empty values", () => {
    expect(parseStep("demo", { demoUrl: "", websiteUrl: "https://spa.example" })).toEqual({ ok: true, fields: { demoUrl: null, websiteUrl: "https://spa.example" } });
    expect(parseStep("demo", { demoUrl: "http://spa.example", websiteUrl: "javascript:alert(1)" })).toEqual({ ok: false, errors: { demoUrl: "url", websiteUrl: "url" } });
  });

  it("reads checkboxes from the body", () => {
    expect(stepValuesFromBody("customization", { customizable: "on", customizationNotes: "a\r\nb" })).toEqual({ customizable: "on", customizationNotes: "a\nb" });
    expect(parseStep("customization", stepValuesFromBody("customization", { customizationNotes: "" }))).toEqual({ ok: true, fields: { customizable: false, customizationNotes: "" } });
  });

  it("round-trips every text step through form values", () => {
    const product = {
      name: "Spa Booking",
      slug: "spa-booking",
      tagline: "Bookings",
      category: "booking",
      deliveryModel: "source",
      primaryLang: "zh-Hant",
      tags: ["spa"],
      description: "Desc",
      problem: "Problem",
      targetUsers: "Owners",
      features: ["A", "B"],
      techStack: ["Hono"],
      demoUrl: "https://demo.example",
      websiteUrl: null,
      customizable: true,
      customizationNotes: "Notes",
      license: "extended",
      supportPolicy: "Email",
    } as unknown as Product;
    for (const step of TEXT_STEPS) {
      const parsed = parseStep(step, stepValuesFromProduct(step, product));
      expect(parsed.ok, step).toBe(true);
      if (parsed.ok) for (const spec of STEP_FIELDS[step]) expect(parsed.fields[spec.name], `${step}.${spec.name}`).toEqual(product[spec.name as keyof Product]);
    }
  });

  it("validates a new product name", () => {
    expect(parseProductName("  Kit ")).toEqual({ ok: true, name: "Kit" });
    expect(parseProductName(" ")).toEqual({ ok: false, error: "required" });
    expect(parseProductName("x".repeat(81))).toEqual({ ok: false, error: "too_long" });
  });
});
```

`apps/web/test/hub/products.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { grantBadge, listActiveBadges } from "../../src/db/verifications.ts";
import { ensureUser, makeBuilder, makeDraft, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const productStep = (o: Record<string, string> = {}) => ({
  name: "Spa Booking",
  slug: "spa-booking-x",
  tagline: "Bookings for spas",
  category: "booking",
  deliveryModel: "saas",
  primaryLang: "en",
  tags: "spa",
  description: "Online booking.",
  ...o,
});
const audits = (action: string, id: string) =>
  testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, id).first<{ n: number }>().then((r) => r?.n ?? 0);

describe("Hub products list (spec §5.3)", () => {
  it("creates a draft and opens the editor", async () => {
    await makeBuilder("hp-create@vnx.si", "hp-create");
    const { cookie } = await signIn("hp-create@vnx.si");
    expect(await (await app().request(getReq("/hub/products", cookie), undefined, testEnv)).text()).toContain("No products yet.");
    const res = await app().request(formPost("/hub/products", { name: "Spa Booking Kit" }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    const id = /^\/hub\/products\/([0-9A-Z]{26})\/edit\/product$/.exec(location)?.[1];
    expect(id).toBeDefined();
    expect(await findProductById(testEnv.DB, id!)).toMatchObject({ status: "draft", slug: "spa-booking-kit" });
    expect(await audits("product.create", id!)).toBe(1);
    const list = await (await app().request(getReq("/hub/products", cookie), undefined, testEnv)).text();
    expect(list).toContain("Spa Booking Kit");
    expect(list).toContain("Draft");
  });

  it("rejects an empty name (400) and creation by a suspended builder (409)", async () => {
    await makeBuilder("hp-bad@vnx.si", "hp-bad");
    const { cookie } = await signIn("hp-bad@vnx.si");
    const res = await app().request(formPost("/hub/products", { name: " " }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("This field is required.");
    await makeBuilder("hp-susp@vnx.si", "hp-susp", "suspended");
    const susp = await signIn("hp-susp@vnx.si");
    expect((await app().request(formPost("/hub/products", { name: "X" }, { cookie: susp.cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("product editor text steps", () => {
  it("saves the product step, including a new slug, and shows localized steps", async () => {
    const { product } = await makeDraft("ed-prod@vnx.si", "ed-prod", "Kit");
    const { cookie } = await signIn("ed-prod@vnx.si");
    const res = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep(), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/product?saved=1`);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ name: "Spa Booking", slug: "spa-booking-x", category: "booking", deliveryModel: "saas", tags: ["spa"] });
    const vi = await (await app().request(getReq(`/vi/hub/products/${product.id}/edit/features`, cookie), undefined, testEnv)).text();
    expect(vi).toContain("Tính năng");
    expect(vi).toContain('name="robots" content="noindex"');
  });

  it("refuses a bad slug (400) and a taken slug (409)", async () => {
    await makeDraft("ed-taken-a@vnx.si", "ed-taken-a", "Taken Name");
    const { product } = await makeDraft("ed-taken-b@vnx.si", "ed-taken-b", "Other Name");
    const { cookie } = await signIn("ed-taken-b@vnx.si");
    const bad = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ slug: "Bad Slug" }), { cookie }), undefined, testEnv);
    expect(bad.status).toBe(400);
    const taken = await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ slug: "taken-name" }), { cookie }), undefined, testEnv);
    expect(taken.status).toBe(409);
    expect(await taken.text()).toContain("This address is already taken.");
  });

  it("saves features, demo, customization, license and support", async () => {
    const { product } = await makeDraft("ed-steps@vnx.si", "ed-steps", "Steps");
    const { cookie } = await signIn("ed-steps@vnx.si");
    const post = (step: string, body: Record<string, string>) => app().request(formPost(`/hub/products/${product.id}/edit/${step}`, body, { cookie }), undefined, testEnv);
    expect((await post("problem", { problem: "Lost bookings" })).status).toBe(303);
    expect((await post("audience", { targetUsers: "Spa owners" })).status).toBe(303);
    expect((await post("features", { features: "Calendar\nReminders", techStack: "Hono, D1" })).status).toBe(303);
    expect((await post("demo", { demoUrl: "http://insecure.example", websiteUrl: "" })).status).toBe(400);
    expect((await post("demo", { demoUrl: "https://demo.example", websiteUrl: "" })).status).toBe(303);
    expect((await post("customization", { customizable: "on", customizationNotes: "Branding" })).status).toBe(303);
    expect((await post("support", { supportPolicy: "Email within 48h" })).status).toBe(303);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({
      problem: "Lost bookings",
      targetUsers: "Spa owners",
      features: ["Calendar", "Reminders"],
      techStack: ["Hono", "D1"],
      demoUrl: "https://demo.example",
      customizable: true,
      customizationNotes: "Branding",
      supportPolicy: "Email within 48h",
    });
  });

  it("keeps license only for source products", async () => {
    const { product } = await makeDraft("ed-lic@vnx.si", "ed-lic", "License");
    const { cookie } = await signIn("ed-lic@vnx.si");
    const post = (step: string, body: Record<string, string>) => app().request(formPost(`/hub/products/${product.id}/edit/${step}`, body, { cookie }), undefined, testEnv);
    await post("product", productStep({ slug: "lic-one", deliveryModel: "source" }));
    await post("license", { license: "extended" });
    expect((await findProductById(testEnv.DB, product.id))?.license).toBe("extended");
    await post("product", productStep({ slug: "lic-one", deliveryModel: "saas" }));
    expect((await findProductById(testEnv.DB, product.id))?.license).toBeNull();
    await post("license", { license: "extended" });
    expect((await findProductById(testEnv.DB, product.id))?.license).toBeNull();
  });

  it("404s on another builder's product and on an unknown step", async () => {
    const { product } = await makeDraft("ed-owner@vnx.si", "ed-owner", "Mine");
    await makeBuilder("ed-intruder@vnx.si", "ed-intruder");
    const { cookie } = await signIn("ed-intruder@vnx.si");
    expect((await app().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/products/${product.id}/edit/problem`, { problem: "Hacked" }, { cookie }), undefined, testEnv)).status).toBe(404);
    const own = await signIn("ed-owner@vnx.si");
    expect((await app().request(getReq(`/hub/products/${product.id}/edit/nope`, own.cookie), undefined, testEnv)).status).toBe(404);
    expect((await findProductById(testEnv.DB, product.id))?.problem).toBe("");
  });

  it("locks the editor while in review and for suspended builders (409)", async () => {
    const { product } = await makeDraft("ed-review@vnx.si", "ed-review", "Review");
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    const { cookie } = await signIn("ed-review@vnx.si");
    const view = await (await app().request(getReq(`/hub/products/${product.id}/edit/problem`, cookie), undefined, testEnv)).text();
    expect(view).not.toContain(`action="/hub/products/${product.id}/edit/problem"`);
    expect((await app().request(formPost(`/hub/products/${product.id}/edit/problem`, { problem: "X" }, { cookie }), undefined, testEnv)).status).toBe(409);

    const s = await makeDraft("ed-susp@vnx.si", "ed-susp", "Susp", "suspended");
    const susp = await signIn("ed-susp@vnx.si");
    expect((await app().request(formPost(`/hub/products/${s.product.id}/edit/problem`, { problem: "X" }, { cookie: susp.cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("publishes edits live, locks the slug and records them once published", async () => {
    const { product } = await makeDraft("ed-live@vnx.si", "ed-live", "Live Kit");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("ed-live@vnx.si");
    await app().request(formPost(`/hub/products/${product.id}/edit/product`, productStep({ name: "Live Kit 2", slug: "changed-slug" }), { cookie }), undefined, testEnv);
    const after = await findProductById(testEnv.DB, product.id);
    expect(after).toMatchObject({ name: "Live Kit 2", slug: "live-kit", status: "published" });
    expect(after?.editedAfterPublishAt).not.toBeNull();
    expect(await audits("product.edit", product.id)).toBe(1);
  });

  it("revokes Demo verified when the demo URL changes", async () => {
    const { product } = await makeDraft("ed-demo@vnx.si", "ed-demo", "Demo Kit");
    const { cookie } = await signIn("ed-demo@vnx.si");
    const admin = await ensureUser("owner@vnx.si");
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://one.example", websiteUrl: "" }, { cookie }), undefined, testEnv);
    await grantBadge(testEnv.DB, { productId: product.id, kind: "demo_verified", verifiedBy: admin.id, evidence: "ok", now: new Date().toISOString() });
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://one.example", websiteUrl: "https://site.example" }, { cookie }), undefined, testEnv);
    expect((await listActiveBadges(testEnv.DB, product.id)).map((b) => b.kind)).toEqual(["demo_verified"]);
    await app().request(formPost(`/hub/products/${product.id}/edit/demo`, { demoUrl: "https://two.example", websiteUrl: "" }, { cookie }), undefined, testEnv);
    expect(await listActiveBadges(testEnv.DB, product.id)).toEqual([]);
    const row = await testEnv.DB.prepare("SELECT revoke_reason FROM product_verifications WHERE product_id = ?1").bind(product.id).first<{ revoke_reason: string }>();
    expect(row?.revoke_reason).toBe("demo_url_changed");
    expect(await audits("badge.revoke", product.id)).toBe(1);
  });
});
```

Run: `npm test -w apps/web -- test/domain/product-input.test.ts test/hub/products.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain nhập liệu**

Trong `apps/web/src/domain/builder-input.ts`: đổi tên hàm nội bộ `csv` thành `export function splitCsv` (giữ nguyên thân hàm) và cập nhật hai chỗ dùng trong `Schema`.

`apps/web/src/domain/product-input.ts`:

```ts
import { isHttpsUrl, splitCsv } from "./builder-input.ts";
import { CATEGORIES, DELIVERY_MODELS, LICENSES, PRODUCT_LANGS, type Product } from "./product.ts";
import { SLUG_RE } from "./slug.ts";

/** The 9 editor steps in display order (spec §5.3). */
export const PRODUCT_STEPS = ["product", "problem", "audience", "features", "demo", "pricing", "customization", "license", "support"] as const;
export type ProductStep = (typeof PRODUCT_STEPS)[number];
/** Steps whose form is generated from STEP_FIELDS (pricing has its own form). */
export const TEXT_STEPS = ["product", "problem", "audience", "features", "demo", "customization", "license", "support"] as const;
export type TextStep = (typeof TEXT_STEPS)[number];

export type ProductField =
  | "name"
  | "slug"
  | "tagline"
  | "category"
  | "deliveryModel"
  | "primaryLang"
  | "tags"
  | "description"
  | "problem"
  | "targetUsers"
  | "features"
  | "techStack"
  | "demoUrl"
  | "websiteUrl"
  | "customizable"
  | "customizationNotes"
  | "license"
  | "supportPolicy";
export type ProductFields = Pick<Product, ProductField>;

export type FieldKind = "text" | "slug" | "textarea" | "url" | "select" | "csv" | "lines" | "checkbox";
export interface FieldSpec {
  name: ProductField;
  kind: FieldKind;
  /** Max characters (per item for csv/lines). */
  max: number;
  maxItems?: number;
  options?: readonly string[];
  /** Must be non-empty even in a draft. */
  required?: boolean;
}

export const STEP_FIELDS: Record<TextStep, readonly FieldSpec[]> = {
  product: [
    { name: "name", kind: "text", max: 80, required: true },
    { name: "slug", kind: "slug", max: 60, required: true },
    { name: "tagline", kind: "text", max: 120 },
    { name: "category", kind: "select", max: 0, options: CATEGORIES },
    { name: "deliveryModel", kind: "select", max: 0, options: DELIVERY_MODELS },
    { name: "primaryLang", kind: "select", max: 0, options: PRODUCT_LANGS, required: true },
    { name: "tags", kind: "csv", max: 30, maxItems: 10 },
    { name: "description", kind: "textarea", max: 5000 },
  ],
  problem: [{ name: "problem", kind: "textarea", max: 2000 }],
  audience: [{ name: "targetUsers", kind: "textarea", max: 1000 }],
  features: [
    { name: "features", kind: "lines", max: 120, maxItems: 20 },
    { name: "techStack", kind: "csv", max: 40, maxItems: 20 },
  ],
  demo: [
    { name: "demoUrl", kind: "url", max: 500 },
    { name: "websiteUrl", kind: "url", max: 500 },
  ],
  customization: [
    { name: "customizable", kind: "checkbox", max: 0 },
    { name: "customizationNotes", kind: "textarea", max: 2000 },
  ],
  license: [{ name: "license", kind: "select", max: 0, options: LICENSES }],
  support: [{ name: "supportPolicy", kind: "textarea", max: 2000 }],
};

export type StepValues = Partial<Record<ProductField, string>>;
export type FieldErrorCode = "required" | "too_long" | "list" | "url" | "choice" | "slug" | "slug_taken";
export type StepErrors = Partial<Record<ProductField, FieldErrorCode>>;

export function isProductStep(value: unknown): value is ProductStep {
  return (PRODUCT_STEPS as readonly unknown[]).includes(value);
}

export function isTextStep(value: unknown): value is TextStep {
  return (TEXT_STEPS as readonly unknown[]).includes(value);
}

/** Browsers submit textarea newlines as CRLF; count and store LF only. */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

const str = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

export function stepValuesFromBody(step: TextStep, body: Record<string, unknown>): StepValues {
  const values: StepValues = {};
  for (const spec of STEP_FIELDS[step]) {
    values[spec.name] = spec.kind === "checkbox" ? (body[spec.name] === undefined ? "" : "on") : str(body[spec.name]);
  }
  return values;
}

export function stepValuesFromProduct(step: TextStep, product: Product): StepValues {
  const values: StepValues = {};
  for (const spec of STEP_FIELDS[step]) {
    const v = product[spec.name];
    if (spec.kind === "checkbox") values[spec.name] = v ? "on" : "";
    else if (Array.isArray(v)) values[spec.name] = v.join(spec.kind === "lines" ? "\n" : ", ");
    else values[spec.name] = v === null ? "" : String(v);
  }
  return values;
}

type FieldResult = { ok: true; value: unknown } | { ok: false; error: FieldErrorCode };

function parseField(spec: FieldSpec, raw: string): FieldResult {
  const v = raw.trim();
  switch (spec.kind) {
    case "checkbox":
      return { ok: true, value: v === "on" || v === "true" || v === "1" };
    case "slug": {
      const slug = v.toLowerCase();
      return SLUG_RE.test(slug) ? { ok: true, value: slug } : { ok: false, error: "slug" };
    }
    case "url":
      if (v === "") return { ok: true, value: null };
      if (v.length > spec.max) return { ok: false, error: "too_long" };
      return isHttpsUrl(v) ? { ok: true, value: v } : { ok: false, error: "url" };
    case "select":
      if (v === "") return spec.required ? { ok: false, error: "choice" } : { ok: true, value: null };
      return spec.options?.includes(v) ? { ok: true, value: v } : { ok: false, error: "choice" };
    case "csv":
    case "lines": {
      const items = spec.kind === "csv" ? splitCsv(v) : v.split("\n").map((line) => line.trim()).filter(Boolean);
      const bad = items.length > (spec.maxItems ?? Infinity) || items.some((item) => item.length > spec.max);
      return bad ? { ok: false, error: "list" } : { ok: true, value: items };
    }
    default:
      if (spec.required && v === "") return { ok: false, error: "required" };
      return v.length > spec.max ? { ok: false, error: "too_long" } : { ok: true, value: v };
  }
}

export function parseStep(step: TextStep, values: StepValues): { ok: true; fields: Partial<ProductFields> } | { ok: false; errors: StepErrors } {
  const fields: Record<string, unknown> = {};
  const errors: StepErrors = {};
  for (const spec of STEP_FIELDS[step]) {
    const result = parseField(spec, values[spec.name] ?? "");
    if (result.ok) fields[spec.name] = result.value;
    else errors[spec.name] = result.error;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, fields: fields as Partial<ProductFields> };
}

/** Name for a new draft (same rule as the product step's name field). */
export function parseProductName(raw: unknown): { ok: true; name: string } | { ok: false; error: FieldErrorCode } {
  const result = parseField(STEP_FIELDS.product[0]!, str(raw));
  return result.ok ? { ok: true, name: result.value as string } : { ok: false, error: result.error };
}
```

- [ ] **Step 3: Lưu theo bước**

Thêm vào `apps/web/src/db/products.ts` (thêm `import type { ProductField, ProductFields } from "../domain/product-input.ts";`):

```ts
/** Fixed column names; SQL is built only from these constants, never from input. */
const COLUMN: Record<ProductField, string> = {
  name: "name",
  slug: "slug",
  tagline: "tagline",
  category: "category",
  deliveryModel: "delivery_model",
  primaryLang: "primary_lang",
  tags: "tags",
  description: "description",
  problem: "problem",
  targetUsers: "target_users",
  features: "features",
  techStack: "tech_stack",
  demoUrl: "demo_url",
  websiteUrl: "website_url",
  customizable: "customizable",
  customizationNotes: "customization_notes",
  license: "license",
  supportPolicy: "support_policy",
};

function encode(value: unknown): string | number | null {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number | null;
}

export type UpdateFieldsResult = "ok" | "stale" | "slug_taken";

/**
 * Writes the given fields while the product is still owned by `builderId` and in `expectedStatus`.
 * `markEdited` stamps edited_after_publish_at (spec §7.2: edits after the first publish go live and are flagged).
 */
export async function updateProductFields(
  db: D1Database,
  input: { productId: string; builderId: string; expectedStatus: Product["status"]; fields: Partial<ProductFields>; now: string; markEdited: boolean },
): Promise<UpdateFieldsResult> {
  const entries = Object.entries(input.fields).filter(([key]) => key in COLUMN) as [ProductField, unknown][];
  const params: (string | number | null)[] = [input.productId, input.builderId, input.expectedStatus, input.now, input.markEdited ? 1 : 0];
  const sets = entries.map(([key, value]) => {
    params.push(encode(value));
    return `${COLUMN[key]} = ?${params.length}`;
  });
  const sql = `UPDATE products SET ${[...sets, "updated_at = ?4", "edited_after_publish_at = CASE WHEN ?5 = 1 THEN ?4 ELSE edited_after_publish_at END"].join(", ")}
    WHERE id = ?1 AND builder_id = ?2 AND status = ?3`;
  try {
    const res = await db.prepare(sql).bind(...params).run();
    return res.meta.changes === 1 ? "ok" : "stale";
  } catch (err) {
    if (String(err).includes("products.slug")) return "slug_taken";
    throw err;
  }
}
```

Thêm vào cuối `apps/web/src/domain/product.ts` (và test tương ứng vào `test/domain/product.test.ts`):

```ts
export type EditLock = "in_review" | "suspended" | "builder_suspended";

/** Why the editor is read-only, or null when the builder may edit (Owner decision 2026-10-04: in_review is locked). */
export function editLock(status: ProductStatus, builderStatus: BuilderStatus): EditLock | null {
  if (builderStatus === "suspended") return "builder_suspended";
  if (status === "in_review") return "in_review";
  if (status === "suspended") return "suspended";
  return null;
}
```

```ts
describe("editLock", () => {
  it("explains why the editor is read-only", () => {
    expect(editLock("draft", "approved")).toBeNull();
    expect(editLock("published", "pending")).toBeNull();
    expect(editLock("in_review", "approved")).toBe("in_review");
    expect(editLock("suspended", "approved")).toBe("suspended");
    expect(editLock("draft", "suspended")).toBe("builder_suspended");
  });
});
```

(`editLock` chỉ dùng cho product chưa `archived`: route trả 404 cho product đã lưu trữ.)

- [ ] **Step 4: Nhãn và view**

Thêm vào `apps/web/src/views/labels.ts` (thêm import type `Category`, `DeliveryModel`, `License`, `ProductLang`, `ProductStatus` từ `../domain/product.ts` và `ProductStep` từ `../domain/product-input.ts`):

```ts
export const PRODUCT_STATUS_KEY: Record<ProductStatus, MessageKey> = {
  draft: "product.status.draft",
  in_review: "product.status.in_review",
  changes_requested: "product.status.changes_requested",
  published: "product.status.published",
  unlisted: "product.status.unlisted",
  suspended: "product.status.suspended",
  archived: "product.status.archived",
};

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

export const DELIVERY_KEY: Record<DeliveryModel, MessageKey> = {
  saas: "product.delivery.saas",
  source: "product.delivery.source",
  service: "product.delivery.service",
};

export const LICENSE_KEY: Record<License, MessageKey> = {
  single_use: "product.license.single_use",
  extended: "product.license.extended",
  open_source: "product.license.open_source",
};

export const PRODUCT_LANG_KEY: Record<ProductLang, MessageKey> = {
  en: "product.lang.en",
  vi: "product.lang.vi",
  "zh-Hans": "product.lang.zh-Hans",
  "zh-Hant": "product.lang.zh-Hant",
};

export const STEP_KEY: Record<ProductStep, MessageKey> = {
  product: "product.step.product",
  problem: "product.step.problem",
  audience: "product.step.audience",
  features: "product.step.features",
  demo: "product.step.demo",
  pricing: "product.step.pricing",
  customization: "product.step.customization",
  license: "product.step.license",
  support: "product.step.support",
};
```

`apps/web/src/views/hub/HubLayout.tsx`: đổi `HubSection` thành `"overview" | "profile" | "portfolio" | "products"` và thêm vào cuối `NAV`: `{ key: "products", path: "/hub/products", label: "hub.nav.products" }`.

`apps/web/src/views/hub/ProductsPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { FieldErrorCode } from "../../domain/product-input.ts";
import type { Product } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { PRODUCT_STATUS_KEY } from "../labels.ts";
import { HubLayout } from "./HubLayout.tsx";
import { PRODUCT_ERROR_KEY } from "./ProductStepForm.tsx";

type Props = { locale: Locale; origin: string; products: Product[]; name: string; error: FieldErrorCode | null; canCreate: boolean };

export const ProductsPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("products.title")} rest="/hub/products" active="products">
      <h1>{tr("products.title")}</h1>
      {p.products.length === 0 ? (
        <p class="muted">{tr("products.empty")}</p>
      ) : (
        <ul class="portfolio-list">
          {p.products.map((product) => (
            <li>
              <h2>
                <a href={localizedPath(p.locale, `/hub/products/${product.id}/edit/product`)}>{product.name}</a>
              </h2>
              <p>
                <span class={`badge badge-${product.status}`}>{tr(PRODUCT_STATUS_KEY[product.status])}</span> <span class="muted">{product.updatedAt.slice(0, 10)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {p.canCreate ? (
        <section class="card wide">
          <h2>{tr("products.create")}</h2>
          <form method="post" action={localizedPath(p.locale, "/hub/products")}>
            <div class="field">
              <label for="new-name">{tr("products.newName")}</label>
              <input
                id="new-name"
                name="name"
                value={p.name}
                required
                maxlength={80}
                aria-invalid={p.error ? "true" : undefined}
                aria-describedby={p.error ? "new-name-error" : undefined}
              />
              {p.error ? (
                <p id="new-name-error" class="error-msg">
                  {tr(PRODUCT_ERROR_KEY[p.error], { max: 80, items: 0 })}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("products.create")}
            </button>
          </form>
        </section>
      ) : null}
    </HubLayout>
  );
};
```

`apps/web/src/views/hub/EditorLayout.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";
import type { ProductStep } from "../../domain/product-input.ts";
import { PRODUCT_STEPS } from "../../domain/product-input.ts";
import type { EditLock, Product } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { PRODUCT_STATUS_KEY, STEP_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

const LOCK_KEY: Record<EditLock, MessageKey> = {
  in_review: "editor.locked.in_review",
  suspended: "editor.locked.suspended",
  builder_suspended: "editor.locked.builder_suspended",
};

type Props = { locale: Locale; origin: string; product: Product; step: ProductStep; lock: EditLock | null; saved: boolean };

/** Shared frame of every editor step: title, status, step navigation, lock and review notes. */
export const EditorLayout: FC<PropsWithChildren<Props>> = (p) => {
  const tr = translator(p.locale);
  const base = `/hub/products/${p.product.id}/edit`;
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={`${tr(STEP_KEY[p.step])} · ${p.product.name}`} rest={`${base}/${p.step}`} active="products">
      <h1>
        {p.product.name} <span class={`badge badge-${p.product.status}`}>{tr(PRODUCT_STATUS_KEY[p.product.status])}</span>
      </h1>
      <nav class="subnav" aria-label={tr("editor.steps")}>
        {PRODUCT_STEPS.map((s, i) => (
          <a href={localizedPath(p.locale, `${base}/${s}`)} aria-current={s === p.step ? "step" : undefined}>
            {i + 1}. {tr(STEP_KEY[s])}
          </a>
        ))}
      </nav>
      {p.saved ? (
        <p class="notice good" role="status">
          {tr("editor.saved")}
        </p>
      ) : null}
      {p.lock ? <p class="notice">{tr(LOCK_KEY[p.lock])}</p> : null}
      {!p.lock && p.product.firstPublishedAt !== null ? <p class="notice">{tr("editor.live")}</p> : null}
      {p.product.status === "changes_requested" && p.product.reviewNote ? (
        <div class="notice">
          <p>{tr("editor.reviewNote")}</p>
          <PlainText text={p.product.reviewNote} />
        </div>
      ) : null}
      <section class="card wide">
        <h2>{tr(STEP_KEY[p.step])}</h2>
        {p.children}
      </section>
    </HubLayout>
  );
};
```

`apps/web/src/views/hub/ProductStepForm.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { STEP_FIELDS, type FieldErrorCode, type FieldSpec, type ProductField, type StepErrors, type StepValues, type TextStep } from "../../domain/product-input.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY, PRODUCT_LANG_KEY } from "../labels.ts";

export const PRODUCT_ERROR_KEY: Record<FieldErrorCode, MessageKey> = {
  required: "product.error.required",
  too_long: "product.error.too_long",
  list: "product.error.list",
  url: "product.error.url",
  choice: "product.error.choice",
  slug: "product.error.slug",
  slug_taken: "product.error.slug_taken",
};

const LABEL: Record<ProductField, MessageKey> = {
  name: "product.field.name",
  slug: "product.field.slug",
  tagline: "product.field.tagline",
  category: "product.field.category",
  deliveryModel: "product.field.deliveryModel",
  primaryLang: "product.field.primaryLang",
  tags: "product.field.tags",
  description: "product.field.description",
  problem: "product.field.problem",
  targetUsers: "product.field.targetUsers",
  features: "product.field.features",
  techStack: "product.field.techStack",
  demoUrl: "product.field.demoUrl",
  websiteUrl: "product.field.websiteUrl",
  customizable: "product.field.customizable",
  customizationNotes: "product.field.customizationNotes",
  license: "product.field.license",
  supportPolicy: "product.field.supportPolicy",
};

const HINT: Partial<Record<ProductField, MessageKey>> = {
  slug: "product.hint.slug",
  tags: "product.hint.tags",
  description: "product.hint.description",
  features: "product.hint.features",
  techStack: "product.hint.techStack",
  demoUrl: "product.hint.demoUrl",
};

const OPTION_KEY: Partial<Record<ProductField, Record<string, MessageKey>>> = {
  category: CATEGORY_KEY,
  deliveryModel: DELIVERY_KEY,
  primaryLang: PRODUCT_LANG_KEY,
  license: LICENSE_KEY,
};

function errorText(tr: Translate, spec: FieldSpec, code: FieldErrorCode): string {
  return tr(PRODUCT_ERROR_KEY[code], { max: spec.max, items: spec.maxItems ?? 0 });
}

type Props = { locale: Locale; action: string; step: TextStep; values: StepValues; errors: StepErrors; slugLocked: boolean; licenseApplies: boolean };

/** Renders one text step from STEP_FIELDS. Values arrive as raw strings so a 400 re-render keeps the input. */
export const ProductStepForm: FC<Props> = (p) => {
  const tr = translator(p.locale);
  if (p.step === "license" && !p.licenseApplies) return <p class="notice">{tr("product.license.notSource")}</p>;

  const control = (spec: FieldSpec) => {
    const id = `pf-${spec.name}`;
    const value = p.values[spec.name] ?? "";
    const code = p.errors[spec.name];
    const hintKey = spec.name === "slug" && p.slugLocked ? "product.hint.slugLocked" : HINT[spec.name];
    const describedBy = [hintKey ? `${id}-hint` : "", code ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
    const aria = { "aria-invalid": code ? "true" : undefined, "aria-describedby": describedBy };
    let input: unknown;
    if (spec.kind === "checkbox") {
      return (
        <div class="field">
          <label class="choice">
            <input type="checkbox" name={spec.name} checked={value === "on"} /> {tr(LABEL[spec.name])}
          </label>
        </div>
      );
    } else if (spec.name === "slug" && p.slugLocked) {
      input = <input id={id} value={value} readonly aria-describedby={`${id}-hint`} />;
    } else if (spec.kind === "select") {
      const labels = OPTION_KEY[spec.name] ?? {};
      input = (
        <select id={id} name={spec.name} {...aria}>
          {spec.required ? null : <option value="">{tr("builder.form.choose")}</option>}
          {(spec.options ?? []).map((o) => (
            <option value={o} selected={value === o}>
              {labels[o] ? tr(labels[o]!) : o}
            </option>
          ))}
        </select>
      );
    } else if (spec.kind === "textarea" || spec.kind === "lines") {
      input = (
        <textarea id={id} name={spec.name} rows={spec.kind === "lines" ? 8 : 6} {...aria}>
          {value}
        </textarea>
      );
    } else {
      input = <input id={id} name={spec.name} type={spec.kind === "url" ? "url" : "text"} value={value} maxlength={spec.kind === "csv" ? undefined : spec.max} required={spec.required} {...aria} />;
    }
    return (
      <div class="field">
        <label for={id}>{tr(LABEL[spec.name])}</label>
        {input}
        {hintKey ? (
          <p id={`${id}-hint`} class="hint">
            {tr(hintKey)}
          </p>
        ) : null}
        {code ? (
          <p id={`${id}-error`} class="error-msg">
            {errorText(tr, spec, code)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form method="post" action={p.action}>
      {Object.keys(p.errors).length > 0 ? (
        <p class="error-msg" role="alert">
          {tr("builder.form.errorSummary")}
        </p>
      ) : null}
      {STEP_FIELDS[p.step].map(control)}
      <button class="btn" type="submit">
        {tr("editor.save")}
      </button>
    </form>
  );
};
```

`apps/web/src/views/hub/EditorPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { StepErrors, StepValues, TextStep } from "../../domain/product-input.ts";
import type { EditLock, Product } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { EditorLayout } from "./EditorLayout.tsx";
import { ProductStepForm } from "./ProductStepForm.tsx";

type Props = { locale: Locale; origin: string; product: Product; step: TextStep; values: StepValues; errors: StepErrors; lock: EditLock | null; saved: boolean };

export const EditorPage: FC<Props> = (p) => (
  <EditorLayout locale={p.locale} origin={p.origin} product={p.product} step={p.step} lock={p.lock} saved={p.saved}>
    {p.lock ? null : (
      <ProductStepForm
        locale={p.locale}
        action={localizedPath(p.locale, `/hub/products/${p.product.id}/edit/${p.step}`)}
        step={p.step}
        values={p.values}
        errors={p.errors}
        slugLocked={p.product.firstPublishedAt !== null}
        licenseApplies={p.product.deliveryModel === "source"}
      />
    )}
  </EditorLayout>
);
```

(Thêm `apps/web/src/views/hub/EditorPage.tsx` vào danh sách file tạo mới của task này.)

- [ ] **Step 5: Route**

`apps/web/src/routes/hub-products.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { createProductDraft, findOwnedProduct, listBuilderProducts, updateProductFields } from "../db/products.ts";
import { revokeBadge } from "../db/verifications.ts";
import { canEditProfile } from "../domain/builder.ts";
import { isTextStep, parseProductName, parseStep, stepValuesFromBody, stepValuesFromProduct, type FieldErrorCode, type StepErrors, type StepValues, type TextStep } from "../domain/product-input.ts";
import { canChangeSlug, editLock, type Product } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { EditorPage } from "../views/hub/EditorPage.tsx";
import { ProductsPage } from "../views/hub/ProductsPage.tsx";
import { page } from "../views/render.ts";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The signed-in builder's product (archived reads as missing), or null. Exported for Tasks 3–5. */
export async function ownedProduct(c: Context<AppEnv>): Promise<Product | null> {
  const id = c.req.param("id") ?? "";
  if (!ULID.test(id)) return null;
  const product = await findOwnedProduct(c.env.DB, c.get("builder").userId, id);
  return product && product.status !== "archived" ? product : null;
}

export function editorPath(c: Context<AppEnv>, productId: string, step: string, query = ""): string {
  return localizedPath(c.get("locale"), `/hub/products/${productId}/edit/${step}${query}`);
}

async function listPage(c: Context<AppEnv>, name: string, error: FieldErrorCode | null, status: 200 | 400 = 200) {
  const builder = c.get("builder");
  const products = await listBuilderProducts(c.env.DB, builder.userId);
  return page(
    c,
    <ProductsPage locale={c.get("locale")} origin={requestOrigin(c)} products={products} name={name} error={error} canCreate={canEditProfile(builder.status)} />,
    status,
  );
}

function stepPage(c: Context<AppEnv>, product: Product, step: TextStep, values: StepValues, errors: StepErrors, status: 200 | 400 | 409 = 200) {
  const lock = editLock(product.status, c.get("builder").status);
  return page(
    c,
    <EditorPage locale={c.get("locale")} origin={requestOrigin(c)} product={product} step={step} values={values} errors={errors} lock={lock} saved={c.req.query("saved") === "1"} />,
    status,
  );
}

export function registerProductEditorRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/hub/products", requireBuilder, (c) => listPage(c, "", null));

  onLocalized(app, "post", "/hub/products", requireBuilder, async (c) => {
    const builder = c.get("builder");
    if (!canEditProfile(builder.status)) return errorResponse(c, "conflict", 409);
    const body = await c.req.parseBody();
    const parsed = parseProductName(body.name);
    if (!parsed.ok) return listPage(c, typeof body.name === "string" ? body.name : "", parsed.error, 400);
    const now = new Date().toISOString();
    const product = await createProductDraft(c.env.DB, { builderId: builder.userId, name: parsed.name, now });
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "product.create", entity: "product", entityId: product.id, now });
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });

  onLocalized(app, "get", "/hub/products/:id/edit", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });

  onLocalized(app, "get", "/hub/products/:id/edit/:step", requireBuilder, async (c) => {
    const step = c.req.param("step");
    const product = await ownedProduct(c);
    if (!product || !isTextStep(step)) return errorResponse(c, "notFound", 404);
    return stepPage(c, product, step, stepValuesFromProduct(step, product), {});
  });

  onLocalized(app, "post", "/hub/products/:id/edit/:step", requireBuilder, async (c) => {
    const step = c.req.param("step");
    const product = await ownedProduct(c);
    if (!product || !isTextStep(step)) return errorResponse(c, "notFound", 404);
    const builder = c.get("builder");
    if (editLock(product.status, builder.status)) return errorResponse(c, "conflict", 409);

    const values = stepValuesFromBody(step, await c.req.parseBody());
    // The slug locks after the first publish (spec §6.1): ignore whatever was posted.
    if (step === "product" && !canChangeSlug(product)) values.slug = product.slug;
    const parsed = parseStep(step, values);
    if (!parsed.ok) return stepPage(c, product, step, values, parsed.errors, 400);

    const fields = parsed.fields;
    // License only exists for source products (spec §6.1).
    if (step === "product" && fields.deliveryModel !== "source") fields.license = null;
    if (step === "license" && product.deliveryModel !== "source") fields.license = null;

    const now = new Date().toISOString();
    const markEdited = product.firstPublishedAt !== null;
    const result = await updateProductFields(c.env.DB, { productId: product.id, builderId: builder.userId, expectedStatus: product.status, fields, now, markEdited });
    if (result === "slug_taken") return stepPage(c, product, step, values, { slug: "slug_taken" }, 409);
    if (result === "stale") return errorResponse(c, "conflict", 409);

    // Spec §7.2: a new demo URL invalidates Demo verified.
    if (step === "demo" && fields.demoUrl !== product.demoUrl) {
      const revoked = await revokeBadge(c.env.DB, { productId: product.id, kind: "demo_verified", reason: "demo_url_changed", now });
      if (revoked) {
        await writeAudit(c.env.DB, { actorUserId: null, action: "badge.revoke", entity: "product", entityId: product.id, data: { kind: "demo_verified", reason: "demo_url_changed" }, now });
      }
    }
    if (markEdited) {
      await writeAudit(c.env.DB, { actorUserId: builder.userId, action: "product.edit", entity: "product", entityId: product.id, data: { step }, now });
    }
    return c.redirect(editorPath(c, product.id, step, "?saved=1"), 303);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerProductEditorRoutes(app);` sau `registerPortfolioRoutes(app);`.

- [ ] **Step 6: Key i18n (đủ 4 locale)**

`en.ts`:

```ts
  "hub.nav.products": "Products",
  "products.title": "Your products",
  "products.empty": "No products yet.",
  "products.create": "Create a draft",
  "products.newName": "Product name",
  "editor.steps": "Editor steps",
  "editor.save": "Save",
  "editor.saved": "Saved.",
  "editor.live": "This product is live: your changes appear right away.",
  "editor.reviewNote": "Changes requested by the admin:",
  "editor.locked.in_review": "This product is waiting for review and can't be edited. Withdraw it if you need to make changes.",
  "editor.locked.suspended": "An admin has suspended this product, so it can't be edited.",
  "editor.locked.builder_suspended": "Your builder profile is suspended, so products can't be edited.",
  "product.status.draft": "Draft",
  "product.status.in_review": "In review",
  "product.status.changes_requested": "Changes requested",
  "product.status.published": "Published",
  "product.status.unlisted": "Hidden",
  "product.status.suspended": "Suspended",
  "product.status.archived": "Archived",
  "product.category.booking": "Booking",
  "product.category.crm": "CRM",
  "product.category.ecommerce": "E-commerce",
  "product.category.finance": "Finance",
  "product.category.hr": "HR",
  "product.category.education": "Education",
  "product.category.internal_tools": "Internal tools",
  "product.category.ai_agents": "AI agents",
  "product.category.other": "Other",
  "product.delivery.saas": "Hosted app (SaaS)",
  "product.delivery.source": "Source code",
  "product.delivery.service": "Done-for-you service",
  "product.license.single_use": "Single use",
  "product.license.extended": "Extended",
  "product.license.open_source": "Open source",
  "product.license.notSource": "A license is only needed for products sold as source code.",
  "product.lang.en": "English",
  "product.lang.vi": "Vietnamese",
  "product.lang.zh-Hans": "Chinese (Simplified)",
  "product.lang.zh-Hant": "Chinese (Traditional)",
  "product.step.product": "Product",
  "product.step.problem": "Problem",
  "product.step.audience": "Target users",
  "product.step.features": "Features",
  "product.step.demo": "Demo",
  "product.step.pricing": "Pricing",
  "product.step.customization": "Customization",
  "product.step.license": "License",
  "product.step.support": "Support",
  "product.field.name": "Name",
  "product.field.slug": "Page address",
  "product.field.tagline": "Tagline",
  "product.field.category": "Category",
  "product.field.deliveryModel": "How you deliver it",
  "product.field.primaryLang": "Main language of the product",
  "product.field.tags": "Tags",
  "product.field.description": "Description",
  "product.field.problem": "What problem does it solve?",
  "product.field.targetUsers": "Who is it for?",
  "product.field.features": "Features",
  "product.field.techStack": "Tech stack",
  "product.field.demoUrl": "Demo link",
  "product.field.websiteUrl": "Website",
  "product.field.customizable": "I can customize this product for a client",
  "product.field.customizationNotes": "What can be customized",
  "product.field.license": "License",
  "product.field.supportPolicy": "Support you offer",
  "product.hint.slug": "Your product page will be vnx.si/p/your-address.",
  "product.hint.slugLocked": "The page address can't change after the first publish.",
  "product.hint.tags": "Separate with commas, up to 10.",
  "product.hint.description": "Plain text. Leave a blank line between paragraphs; lines starting with \"- \" become a list.",
  "product.hint.features": "One feature per line, up to 20.",
  "product.hint.techStack": "Separate with commas.",
  "product.hint.demoUrl": "A link people can try. Changing it removes the Demo verified badge.",
  "product.error.required": "This field is required.",
  "product.error.too_long": "Too long: up to {max} characters.",
  "product.error.list": "Up to {items} items, each up to {max} characters.",
  "product.error.url": "Enter a full https:// address, or leave it empty.",
  "product.error.choice": "Choose one of the options.",
  "product.error.slug": "Use 3–60 lowercase letters, numbers or hyphens, starting and ending with a letter or number.",
  "product.error.slug_taken": "This address is already taken.",
```

`vi.ts`:

```ts
  "hub.nav.products": "Sản phẩm",
  "products.title": "Sản phẩm của bạn",
  "products.empty": "Chưa có sản phẩm nào.",
  "products.create": "Tạo bản nháp",
  "products.newName": "Tên sản phẩm",
  "editor.steps": "Các bước soạn",
  "editor.save": "Lưu",
  "editor.saved": "Đã lưu.",
  "editor.live": "Sản phẩm đang công khai: thay đổi sẽ hiện ngay.",
  "editor.reviewNote": "Admin yêu cầu chỉnh sửa:",
  "editor.locked.in_review": "Sản phẩm đang chờ duyệt nên không sửa được. Hãy rút lại nếu cần chỉnh sửa.",
  "editor.locked.suspended": "Admin đã khóa sản phẩm này nên không sửa được.",
  "editor.locked.builder_suspended": "Hồ sơ builder của bạn đang bị khóa nên không sửa được sản phẩm.",
  "product.status.draft": "Bản nháp",
  "product.status.in_review": "Đang chờ duyệt",
  "product.status.changes_requested": "Cần chỉnh sửa",
  "product.status.published": "Đã công khai",
  "product.status.unlisted": "Đang ẩn",
  "product.status.suspended": "Đã bị khóa",
  "product.status.archived": "Đã lưu trữ",
  "product.category.booking": "Đặt lịch",
  "product.category.crm": "CRM",
  "product.category.ecommerce": "Thương mại điện tử",
  "product.category.finance": "Tài chính",
  "product.category.hr": "Nhân sự",
  "product.category.education": "Giáo dục",
  "product.category.internal_tools": "Công cụ nội bộ",
  "product.category.ai_agents": "AI agent",
  "product.category.other": "Khác",
  "product.delivery.saas": "Ứng dụng chạy sẵn (SaaS)",
  "product.delivery.source": "Mã nguồn",
  "product.delivery.service": "Dịch vụ làm trọn gói",
  "product.license.single_use": "Dùng một lần",
  "product.license.extended": "Mở rộng",
  "product.license.open_source": "Mã nguồn mở",
  "product.license.notSource": "Chỉ cần chọn license cho sản phẩm bán dưới dạng mã nguồn.",
  "product.lang.en": "Tiếng Anh",
  "product.lang.vi": "Tiếng Việt",
  "product.lang.zh-Hans": "Tiếng Trung (giản thể)",
  "product.lang.zh-Hant": "Tiếng Trung (phồn thể)",
  "product.step.product": "Sản phẩm",
  "product.step.problem": "Vấn đề",
  "product.step.audience": "Người dùng",
  "product.step.features": "Tính năng",
  "product.step.demo": "Demo",
  "product.step.pricing": "Giá",
  "product.step.customization": "Tùy chỉnh",
  "product.step.license": "License",
  "product.step.support": "Hỗ trợ",
  "product.field.name": "Tên",
  "product.field.slug": "Địa chỉ trang",
  "product.field.tagline": "Câu giới thiệu",
  "product.field.category": "Danh mục",
  "product.field.deliveryModel": "Cách bàn giao",
  "product.field.primaryLang": "Ngôn ngữ chính của sản phẩm",
  "product.field.tags": "Thẻ",
  "product.field.description": "Mô tả",
  "product.field.problem": "Sản phẩm giải quyết vấn đề gì?",
  "product.field.targetUsers": "Dành cho ai?",
  "product.field.features": "Tính năng",
  "product.field.techStack": "Công nghệ",
  "product.field.demoUrl": "Link demo",
  "product.field.websiteUrl": "Website",
  "product.field.customizable": "Tôi có thể tùy chỉnh sản phẩm này cho khách hàng",
  "product.field.customizationNotes": "Những gì tùy chỉnh được",
  "product.field.license": "License",
  "product.field.supportPolicy": "Hỗ trợ bạn cung cấp",
  "product.hint.slug": "Trang sản phẩm sẽ là vnx.si/p/dia-chi-cua-ban.",
  "product.hint.slugLocked": "Không đổi được địa chỉ trang sau lần công khai đầu tiên.",
  "product.hint.tags": "Phân tách bằng dấu phẩy, tối đa 10.",
  "product.hint.description": "Văn bản thuần. Để một dòng trống giữa các đoạn; dòng bắt đầu bằng \"- \" sẽ thành danh sách.",
  "product.hint.features": "Mỗi dòng một tính năng, tối đa 20.",
  "product.hint.techStack": "Phân tách bằng dấu phẩy.",
  "product.hint.demoUrl": "Link để mọi người dùng thử. Đổi link sẽ mất huy hiệu Demo verified.",
  "product.error.required": "Trường này bắt buộc.",
  "product.error.too_long": "Quá dài: tối đa {max} ký tự.",
  "product.error.list": "Tối đa {items} mục, mỗi mục tối đa {max} ký tự.",
  "product.error.url": "Nhập địa chỉ đầy đủ bắt đầu bằng https://, hoặc để trống.",
  "product.error.choice": "Chọn một trong các lựa chọn.",
  "product.error.slug": "Dùng 3–60 ký tự chữ thường, số hoặc dấu gạch ngang; bắt đầu và kết thúc bằng chữ hoặc số.",
  "product.error.slug_taken": "Địa chỉ này đã có sản phẩm khác dùng.",
```

`zh-hans.ts`:

```ts
  "hub.nav.products": "产品",
  "products.title": "你的产品",
  "products.empty": "还没有产品。",
  "products.create": "创建草稿",
  "products.newName": "产品名称",
  "editor.steps": "编辑步骤",
  "editor.save": "保存",
  "editor.saved": "已保存。",
  "editor.live": "产品已公开：修改会立即生效。",
  "editor.reviewNote": "管理员要求的修改：",
  "editor.locked.in_review": "产品正在审核中，无法编辑。如需修改，请先撤回。",
  "editor.locked.suspended": "管理员已停用此产品，无法编辑。",
  "editor.locked.builder_suspended": "你的 Builder 资料已停用，无法编辑产品。",
  "product.status.draft": "草稿",
  "product.status.in_review": "审核中",
  "product.status.changes_requested": "需要修改",
  "product.status.published": "已公开",
  "product.status.unlisted": "已隐藏",
  "product.status.suspended": "已停用",
  "product.status.archived": "已归档",
  "product.category.booking": "预约",
  "product.category.crm": "CRM",
  "product.category.ecommerce": "电子商务",
  "product.category.finance": "财务",
  "product.category.hr": "人力资源",
  "product.category.education": "教育",
  "product.category.internal_tools": "内部工具",
  "product.category.ai_agents": "AI 智能体",
  "product.category.other": "其他",
  "product.delivery.saas": "托管应用（SaaS）",
  "product.delivery.source": "源代码",
  "product.delivery.service": "代办服务",
  "product.license.single_use": "单次使用",
  "product.license.extended": "扩展授权",
  "product.license.open_source": "开源",
  "product.license.notSource": "只有以源代码形式出售的产品才需要选择授权。",
  "product.lang.en": "英语",
  "product.lang.vi": "越南语",
  "product.lang.zh-Hans": "简体中文",
  "product.lang.zh-Hant": "繁体中文",
  "product.step.product": "产品",
  "product.step.problem": "问题",
  "product.step.audience": "目标用户",
  "product.step.features": "功能",
  "product.step.demo": "演示",
  "product.step.pricing": "价格",
  "product.step.customization": "定制",
  "product.step.license": "授权",
  "product.step.support": "支持",
  "product.field.name": "名称",
  "product.field.slug": "页面地址",
  "product.field.tagline": "一句话介绍",
  "product.field.category": "类别",
  "product.field.deliveryModel": "交付方式",
  "product.field.primaryLang": "产品主要语言",
  "product.field.tags": "标签",
  "product.field.description": "描述",
  "product.field.problem": "它解决什么问题？",
  "product.field.targetUsers": "适合谁？",
  "product.field.features": "功能",
  "product.field.techStack": "技术栈",
  "product.field.demoUrl": "演示链接",
  "product.field.websiteUrl": "网站",
  "product.field.customizable": "我可以为客户定制此产品",
  "product.field.customizationNotes": "可定制的内容",
  "product.field.license": "授权",
  "product.field.supportPolicy": "你提供的支持",
  "product.hint.slug": "产品页面将是 vnx.si/p/your-address。",
  "product.hint.slugLocked": "首次公开后无法更改页面地址。",
  "product.hint.tags": "用逗号分隔，最多 10 个。",
  "product.hint.description": "纯文本。段落之间空一行；以 \"- \" 开头的行会变成列表。",
  "product.hint.features": "每行一个功能，最多 20 个。",
  "product.hint.techStack": "用逗号分隔。",
  "product.hint.demoUrl": "供大家试用的链接。更改后会失去 Demo verified 徽章。",
  "product.error.required": "此项为必填。",
  "product.error.too_long": "太长：最多 {max} 个字符。",
  "product.error.list": "最多 {items} 项，每项最多 {max} 个字符。",
  "product.error.url": "请输入以 https:// 开头的完整地址，或留空。",
  "product.error.choice": "请选择一个选项。",
  "product.error.slug": "请使用 3–60 个小写字母、数字或连字符，并以字母或数字开头和结尾。",
  "product.error.slug_taken": "该地址已被使用。",
```

`zh-hant.ts`:

```ts
  "hub.nav.products": "產品",
  "products.title": "你的產品",
  "products.empty": "還沒有產品。",
  "products.create": "建立草稿",
  "products.newName": "產品名稱",
  "editor.steps": "編輯步驟",
  "editor.save": "儲存",
  "editor.saved": "已儲存。",
  "editor.live": "產品已公開：修改會立即生效。",
  "editor.reviewNote": "管理員要求的修改：",
  "editor.locked.in_review": "產品正在審核中，無法編輯。如需修改，請先撤回。",
  "editor.locked.suspended": "管理員已停用此產品，無法編輯。",
  "editor.locked.builder_suspended": "你的 Builder 資料已停用，無法編輯產品。",
  "product.status.draft": "草稿",
  "product.status.in_review": "審核中",
  "product.status.changes_requested": "需要修改",
  "product.status.published": "已公開",
  "product.status.unlisted": "已隱藏",
  "product.status.suspended": "已停用",
  "product.status.archived": "已封存",
  "product.category.booking": "預約",
  "product.category.crm": "CRM",
  "product.category.ecommerce": "電子商務",
  "product.category.finance": "財務",
  "product.category.hr": "人力資源",
  "product.category.education": "教育",
  "product.category.internal_tools": "內部工具",
  "product.category.ai_agents": "AI 代理",
  "product.category.other": "其他",
  "product.delivery.saas": "託管應用（SaaS）",
  "product.delivery.source": "原始碼",
  "product.delivery.service": "代辦服務",
  "product.license.single_use": "單次使用",
  "product.license.extended": "擴充授權",
  "product.license.open_source": "開源",
  "product.license.notSource": "只有以原始碼形式出售的產品才需要選擇授權。",
  "product.lang.en": "英語",
  "product.lang.vi": "越南語",
  "product.lang.zh-Hans": "簡體中文",
  "product.lang.zh-Hant": "繁體中文",
  "product.step.product": "產品",
  "product.step.problem": "問題",
  "product.step.audience": "目標使用者",
  "product.step.features": "功能",
  "product.step.demo": "示範",
  "product.step.pricing": "價格",
  "product.step.customization": "客製化",
  "product.step.license": "授權",
  "product.step.support": "支援",
  "product.field.name": "名稱",
  "product.field.slug": "頁面網址",
  "product.field.tagline": "一句話介紹",
  "product.field.category": "類別",
  "product.field.deliveryModel": "交付方式",
  "product.field.primaryLang": "產品主要語言",
  "product.field.tags": "標籤",
  "product.field.description": "描述",
  "product.field.problem": "它解決什麼問題？",
  "product.field.targetUsers": "適合誰？",
  "product.field.features": "功能",
  "product.field.techStack": "技術棧",
  "product.field.demoUrl": "示範連結",
  "product.field.websiteUrl": "網站",
  "product.field.customizable": "我可以為客戶客製化此產品",
  "product.field.customizationNotes": "可客製化的內容",
  "product.field.license": "授權",
  "product.field.supportPolicy": "你提供的支援",
  "product.hint.slug": "產品頁面將是 vnx.si/p/your-address。",
  "product.hint.slugLocked": "首次公開後無法更改頁面網址。",
  "product.hint.tags": "用逗號分隔，最多 10 個。",
  "product.hint.description": "純文字。段落之間空一行；以 \"- \" 開頭的行會變成清單。",
  "product.hint.features": "每行一個功能，最多 20 個。",
  "product.hint.techStack": "用逗號分隔。",
  "product.hint.demoUrl": "供大家試用的連結。更改後會失去 Demo verified 徽章。",
  "product.error.required": "此欄位為必填。",
  "product.error.too_long": "太長：最多 {max} 個字元。",
  "product.error.list": "最多 {items} 項，每項最多 {max} 個字元。",
  "product.error.url": "請輸入以 https:// 開頭的完整網址，或留空。",
  "product.error.choice": "請選擇一個選項。",
  "product.error.slug": "請使用 3–60 個小寫字母、數字或連字號，並以字母或數字開頭和結尾。",
  "product.error.slug_taken": "此網址已被使用。",
```

- [ ] **Step 7: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.badge-published { border-color: var(--good); color: var(--good); }
.subnav a[aria-current="step"] { background: var(--ink); color: var(--surface); }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): product drafts and the step editor for text fields" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: VNX-0302 — Ảnh product trên R2 và `/media/*`

**Files:**
- Create: `apps/web/src/domain/image.ts`, `apps/web/src/media/r2.ts`, `apps/web/src/db/media.ts`, `apps/web/src/routes/media.ts`, `apps/web/src/routes/hub-media.tsx`, `apps/web/src/views/hub/MediaSection.tsx`
- Modify: `apps/web/wrangler.jsonc` (binding `MEDIA`), `apps/web/src/env.ts`, `apps/web/src/routes/hub-products.tsx` (`stepPage` nạp ảnh ở bước Demo), `apps/web/src/views/hub/EditorPage.tsx`, `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/domain/image.test.ts`, `apps/web/test/hub/media.test.ts`

**Interfaces:**
- Consumes: Task 1 (`MAX_MEDIA`, `MAX_MEDIA_BYTES`, `ProductMedia`, `editLock`), Task 2 (`ownedProduct`, `editorPath`, `updateProductFields`, `EditorPage`), `ulid`, `writeAudit`.
- Produces:
  - `domain/image.ts`: type `ImageExt = "jpg" | "png" | "webp"`, `sniffImage(bytes)`, `IMAGE_CONTENT_TYPE`, `MEDIA_KEY_RE`.
  - `media/r2.ts`: `productMediaKey(productId, ext, now)`, `putImage(bucket, key, bytes, ext)`, `deleteImage(bucket, key)`.
  - `db/media.ts`: `listMedia(db, productId)`, `findMedia(db, productId, id)`, `addMedia(db, { productId, r2Key, alt, now })` → `ProductMedia | null` (null khi đã đủ 8), `deleteMedia(db, productId, id)` → `boolean`.
  - `MediaError = "missing" | "type" | "size" | "full" | "alt"`; `stepPage(c, product, step, values, errors, status?, mediaError?)` trong `hub-products.tsx` (async, nạp ảnh khi `step === "demo"`).
  - Route: `GET /media/*` (không theo locale), `POST /hub/products/:id/media`, `POST /hub/products/:id/media/:mediaId/delete`.

- [ ] **Step 1: Binding R2**

Trong `apps/web/wrangler.jsonc`, thêm sau khối `d1_databases`:

```jsonc
  "r2_buckets": [
    // Product images (spec §8.5). Owner must enable R2 on the account; then: wrangler r2 bucket create vnxsi-media
    { "binding": "MEDIA", "bucket_name": "vnxsi-media" }
  ],
```

và sửa ghi chú thứ tự deploy thành: bước 0 `wrangler r2 bucket create vnxsi-media` (một lần), bước 1 `db:migrate:remote` áp `0003_identity`, `0004_builders`, `0005_products`.

`apps/web/src/env.ts`: thêm `MEDIA: R2Bucket;` vào `Bindings`.

- [ ] **Step 2: Viết test (fail)**

`apps/web/test/domain/image.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MEDIA_KEY_RE, sniffImage } from "../../src/domain/image.ts";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("image sniffing (spec §8.5)", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("jpg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0))).toBe("webp");
  });

  it("rejects everything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a...."))).toBeNull();
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull();
    expect(sniffImage(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImage(bytes())).toBeNull();
  });

  it("accepts only well-formed media keys", () => {
    expect(MEDIA_KEY_RE.test("products/01J0000000000000000000000A/01J0000000000000000000000B.png")).toBe(true);
    for (const key of ["products/../x.png", "products/01J0000000000000000000000A/01J0000000000000000000000B.gif", "other/01J0000000000000000000000A/01J0000000000000000000000B.png", "products/abc/def.png"]) {
      expect(MEDIA_KEY_RE.test(key), key).toBe(false);
    }
  });
});
```

`apps/web/test/hub/media.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addMedia, listMedia } from "../../src/db/media.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 7]);

function upload(productId: string, cookie: string, bytes: Uint8Array, type = "image/png", alt = "Screenshot") {
  const form = new FormData();
  form.append("file", new File([bytes], "shot", { type }));
  form.append("alt", alt);
  return createApp().request(new Request(`https://vnx.si/hub/products/${productId}/media`, { method: "POST", headers: { origin: "https://vnx.si", cookie }, body: form }), undefined, testEnv);
}

const objects = async (productId: string) => (await testEnv.MEDIA.list({ prefix: `products/${productId}/` })).objects.map((o) => o.key);

describe("product images (spec §8.5)", () => {
  it("uploads a PNG to R2, lists it on the Demo step and serves it immutably", async () => {
    const { product } = await makeDraft("md-png@vnx.si", "md-png", "Png Kit");
    const { cookie } = await signIn("md-png@vnx.si");
    const res = await upload(product.id, cookie, PNG);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/demo?saved=1`);
    const [media] = await listMedia(testEnv.DB, product.id);
    expect(media?.r2Key).toMatch(new RegExp(`^products/${product.id}/[0-9A-Z]{26}\\.png$`));
    expect(media?.alt).toBe("Screenshot");

    const served = await createApp().request(getReq(`/media/${media!.r2Key}`), undefined, testEnv);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    const demo = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/demo`, cookie), undefined, testEnv)).text();
    expect(demo).toContain(`src="/media/${media!.r2Key}"`);
    expect(demo).toContain('alt="Screenshot"');
  });

  it("accepts JPEG and WebP and names them by their real type", async () => {
    const { product } = await makeDraft("md-types@vnx.si", "md-types", "Types Kit");
    const { cookie } = await signIn("md-types@vnx.si");
    await upload(product.id, cookie, JPEG, "image/png");
    await upload(product.id, cookie, WEBP, "application/octet-stream");
    const keys = (await listMedia(testEnv.DB, product.id)).map((m) => m.r2Key.split(".").pop());
    expect(keys).toEqual(["jpg", "webp"]);
  });

  it("rejects files that are not JPEG, PNG or WebP, and files over 2 MB, leaving nothing in R2", async () => {
    const { product } = await makeDraft("md-bad@vnx.si", "md-bad", "Bad Kit");
    const { cookie } = await signIn("md-bad@vnx.si");
    const html = await upload(product.id, cookie, new TextEncoder().encode("<svg onload=alert(1)>"));
    expect(html.status).toBe(400);
    expect(await html.text()).toContain("Only JPEG, PNG or WebP images are accepted.");
    expect((await upload(product.id, cookie, new TextEncoder().encode("GIF89a...."), "image/gif")).status).toBe(400);
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    const tooBig = await upload(product.id, cookie, big);
    expect(tooBig.status).toBe(400);
    expect(await tooBig.text()).toContain("larger than 2 MB");
    expect(await listMedia(testEnv.DB, product.id)).toEqual([]);
    expect(await objects(product.id)).toEqual([]);
  });

  it("refuses a 9th image (409) without leaving an object behind", async () => {
    const { product } = await makeDraft("md-full@vnx.si", "md-full", "Full Kit");
    for (let i = 0; i < 8; i++) {
      await addMedia(testEnv.DB, { productId: product.id, r2Key: `products/${product.id}/FAKE${i}.png`, alt: "", now: new Date().toISOString() });
    }
    const { cookie } = await signIn("md-full@vnx.si");
    expect((await upload(product.id, cookie, PNG)).status).toBe(409);
    expect(await objects(product.id)).toEqual([]);
  });

  it("deletes an image from D1 and R2", async () => {
    const { product } = await makeDraft("md-del@vnx.si", "md-del", "Del Kit");
    const { cookie } = await signIn("md-del@vnx.si");
    await upload(product.id, cookie, PNG);
    const [media] = await listMedia(testEnv.DB, product.id);
    const res = await createApp().request(formPost(`/hub/products/${product.id}/media/${media!.id}/delete`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await listMedia(testEnv.DB, product.id)).toEqual([]);
    expect(await objects(product.id)).toEqual([]);
    expect((await createApp().request(getReq(`/media/${media!.r2Key}`), undefined, testEnv)).status).toBe(404);
  });

  it("keeps other builders out (404) and blocks changes while in review (409)", async () => {
    const { product } = await makeDraft("md-owner@vnx.si", "md-owner", "Owner Kit");
    const owner = await signIn("md-owner@vnx.si");
    await upload(product.id, owner.cookie, PNG);
    const [media] = await listMedia(testEnv.DB, product.id);
    await makeBuilder("md-intruder@vnx.si", "md-intruder");
    const intruder = await signIn("md-intruder@vnx.si");
    expect((await upload(product.id, intruder.cookie, PNG)).status).toBe(404);
    expect((await createApp().request(formPost(`/hub/products/${product.id}/media/${media!.id}/delete`, {}, { cookie: intruder.cookie }), undefined, testEnv)).status).toBe(404);
    expect(await listMedia(testEnv.DB, product.id)).toHaveLength(1);

    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    expect((await upload(product.id, owner.cookie, PNG)).status).toBe(409);
  });

  it("flags a published product as edited when its images change", async () => {
    const { product } = await makeDraft("md-live@vnx.si", "md-live", "Live Media");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("md-live@vnx.si");
    await upload(product.id, cookie, PNG);
    expect((await findProductById(testEnv.DB, product.id))?.editedAfterPublishAt).not.toBeNull();
  });

  it("404s on malformed media keys", async () => {
    for (const path of ["/media/products/../secret.png", "/media/products/x/y.png", "/media/products/01J0000000000000000000000A/01J0000000000000000000000B.png"]) {
      expect((await createApp().request(getReq(path), undefined, testEnv)).status, path).toBe(404);
    }
  });
});
```

Run: `npm test -w apps/web -- test/domain/image.test.ts test/hub/media.test.ts`
Expected: FAIL.

- [ ] **Step 3: Domain, R2, DB**

`apps/web/src/domain/image.ts`:

```ts
export type ImageExt = "jpg" | "png" | "webp";

export const IMAGE_CONTENT_TYPE: Record<ImageExt, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";
/** `products/{productId}/{ulid}.{ext}` — the only keys /media serves (spec §8.5). */
export const MEDIA_KEY_RE = new RegExp(`^products/${ULID}/${ULID}\\.(jpg|png|webp)$`);

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** Image type from the file's first bytes; never trusts the declared Content-Type. */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}
```

`apps/web/src/media/r2.ts`:

```ts
import { IMAGE_CONTENT_TYPE, type ImageExt } from "../domain/image.ts";
import { ulid } from "../lib/ulid.ts";

export function productMediaKey(productId: string, ext: ImageExt, now: string): string {
  return `products/${productId}/${ulid(Date.parse(now))}.${ext}`;
}

export async function putImage(bucket: R2Bucket, key: string, bytes: Uint8Array, ext: ImageExt): Promise<void> {
  await bucket.put(key, bytes, { httpMetadata: { contentType: IMAGE_CONTENT_TYPE[ext] } });
}

export async function deleteImage(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}
```

`apps/web/src/db/media.ts`:

```ts
import { MAX_MEDIA, type ProductMedia } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; r2_key: string; alt: string; sort: number };

const toMedia = (r: Row): ProductMedia => ({ id: r.id, productId: r.product_id, r2Key: r.r2_key, alt: r.alt, sort: r.sort });

export async function listMedia(db: D1Database, productId: string): Promise<ProductMedia[]> {
  const { results } = await db.prepare("SELECT * FROM product_media WHERE product_id = ?1 ORDER BY sort, id").bind(productId).all<Row>();
  return results.map(toMedia);
}

export async function findMedia(db: D1Database, productId: string, id: string): Promise<ProductMedia | null> {
  const row = await db.prepare("SELECT * FROM product_media WHERE id = ?1 AND product_id = ?2").bind(id, productId).first<Row>();
  return row ? toMedia(row) : null;
}

/** Appends an image row; null when the product already has MAX_MEDIA (checked in the same statement). */
export async function addMedia(db: D1Database, input: { productId: string; r2Key: string; alt: string; now: string }): Promise<ProductMedia | null> {
  const id = ulid(Date.parse(input.now));
  const res = await db
    .prepare(
      `INSERT INTO product_media (id, product_id, r2_key, alt, sort, created_at)
       SELECT ?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(sort), 0) + 1 FROM product_media WHERE product_id = ?2), ?5
       WHERE (SELECT COUNT(*) FROM product_media WHERE product_id = ?2) < ?6`,
    )
    .bind(id, input.productId, input.r2Key, input.alt, input.now, MAX_MEDIA)
    .run();
  return res.meta.changes === 1 ? findMedia(db, input.productId, id) : null;
}

export async function deleteMedia(db: D1Database, productId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM product_media WHERE id = ?1 AND product_id = ?2").bind(id, productId).run();
  return res.meta.changes === 1;
}
```

- [ ] **Step 4: Route `/media/*` và upload**

`apps/web/src/routes/media.ts`:

```ts
import type { Hono } from "hono";
import { MEDIA_KEY_RE } from "../domain/image.ts";
import type { AppEnv } from "../env.ts";

export function registerMediaRoutes(app: Hono<AppEnv>) {
  // Keys are unguessable ULIDs, so images of unpublished products are readable by key only (spec §8.5).
  app.get("/media/*", async (c) => {
    const key = c.req.path.slice("/media/".length);
    if (!MEDIA_KEY_RE.test(key)) return c.text("Not found", 404);
    const object = await c.env.MEDIA.get(key);
    if (!object) return c.text("Not found", 404);
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        etag: object.httpEtag,
      },
    });
  });
}
```

Trong `apps/web/src/routes/hub-products.tsx`:
- Thêm import `listMedia` từ `../db/media.ts`.
- Đổi `stepPage` thành async, nạp ảnh ở bước Demo và nhận lỗi ảnh (export để `hub-media.tsx` dùng):

```tsx
export type MediaError = "missing" | "type" | "size" | "full" | "alt";

export async function stepPage(
  c: Context<AppEnv>,
  product: Product,
  step: TextStep,
  values: StepValues,
  errors: StepErrors,
  status: 200 | 400 | 409 = 200,
  mediaError: MediaError | null = null,
) {
  const lock = editLock(product.status, c.get("builder").status);
  const media = step === "demo" ? await listMedia(c.env.DB, product.id) : [];
  return page(
    c,
    <EditorPage
      locale={c.get("locale")}
      origin={requestOrigin(c)}
      product={product}
      step={step}
      values={values}
      errors={errors}
      lock={lock}
      saved={c.req.query("saved") === "1"}
      media={media}
      mediaError={mediaError}
    />,
    status,
  );
}
```

`apps/web/src/routes/hub-media.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { requireBuilder } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { addMedia, deleteMedia, findMedia, listMedia } from "../db/media.ts";
import { updateProductFields } from "../db/products.ts";
import { sniffImage } from "../domain/image.ts";
import { normalizeNewlines, stepValuesFromProduct } from "../domain/product-input.ts";
import { editLock, MAX_MEDIA, MAX_MEDIA_BYTES, type Product } from "../domain/product.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { deleteImage, productMediaKey, putImage } from "../media/r2.ts";
import { errorResponse } from "../views/error-response.tsx";
import { editorPath, ownedProduct, stepPage, type MediaError } from "./hub-products.tsx";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function demoWithError(c: Context<AppEnv>, product: Product, error: MediaError, status: 400 | 409) {
  return stepPage(c, product, "demo", stepValuesFromProduct("demo", product), {}, status, error);
}

/** Images are part of the product: changing them after the first publish counts as an edit (spec §7.2). */
async function touchEdited(c: Context<AppEnv>, product: Product, now: string) {
  if (product.firstPublishedAt === null) return;
  await updateProductFields(c.env.DB, { productId: product.id, builderId: product.builderId, expectedStatus: product.status, fields: {}, now, markEdited: true });
  await writeAudit(c.env.DB, { actorUserId: product.builderId, action: "product.edit", entity: "product", entityId: product.id, data: { step: "media" }, now });
}

export function registerProductMediaRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "post", "/hub/products/:id/media", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || file.size === 0) return demoWithError(c, product, "missing", 400);
    if (file.size > MAX_MEDIA_BYTES) return demoWithError(c, product, "size", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_MEDIA_BYTES) return demoWithError(c, product, "size", 400);
    const ext = sniffImage(bytes);
    if (!ext) return demoWithError(c, product, "type", 400);
    const alt = normalizeNewlines(typeof body.alt === "string" ? body.alt : "").trim();
    if (alt.length > 150) return demoWithError(c, product, "alt", 400);
    if ((await listMedia(c.env.DB, product.id)).length >= MAX_MEDIA) return demoWithError(c, product, "full", 409);

    const now = new Date().toISOString();
    const key = productMediaKey(product.id, ext, now);
    await putImage(c.env.MEDIA, key, bytes, ext);
    const added = await addMedia(c.env.DB, { productId: product.id, r2Key: key, alt, now });
    if (!added) {
      // Lost the race for the last slot: don't leave an orphan object in R2.
      await deleteImage(c.env.MEDIA, key);
      return demoWithError(c, product, "full", 409);
    }
    await touchEdited(c, product, now);
    return c.redirect(editorPath(c, product.id, "demo", "?saved=1"), 303);
  });

  onLocalized(app, "post", "/hub/products/:id/media/:mediaId/delete", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    const mediaId = c.req.param("mediaId") ?? "";
    if (!product || !ULID.test(mediaId)) return errorResponse(c, "notFound", 404);
    const media = await findMedia(c.env.DB, product.id, mediaId);
    if (!media) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);

    await deleteMedia(c.env.DB, product.id, media.id);
    try {
      await deleteImage(c.env.MEDIA, media.r2Key);
    } catch (err) {
      // The row is gone, so the image is no longer shown; an orphan object only costs storage.
      console.error(JSON.stringify({ requestId: c.get("requestId"), event: "media.delete_failed", key: media.r2Key, error: String(err) }));
    }
    await touchEdited(c, product, new Date().toISOString());
    return c.redirect(editorPath(c, product.id, "demo", "?saved=1"), 303);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerMediaRoutes(app);` và `registerProductMediaRoutes(app);` sau `registerProductEditorRoutes(app);`.

- [ ] **Step 5: View ảnh ở bước Demo**

`apps/web/src/views/hub/MediaSection.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { MAX_MEDIA, type ProductMedia } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import { localizedPath } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";

export type MediaErrorCode = "missing" | "type" | "size" | "full" | "alt";

const ERROR_KEY: Record<MediaErrorCode, MessageKey> = {
  missing: "media.error.missing",
  type: "media.error.type",
  size: "media.error.size",
  full: "media.error.full",
  alt: "media.error.alt",
};

type Props = { locale: Locale; productId: string; productName: string; media: ProductMedia[]; error: MediaErrorCode | null; editable: boolean };

export const MediaSection: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, `/hub/products/${p.productId}/media`);
  return (
    <section class="media-section">
      <h3>{tr("media.title")}</h3>
      {p.media.length === 0 ? (
        <p class="muted">{tr("media.empty")}</p>
      ) : (
        <ul class="media-grid">
          {p.media.map((m) => (
            <li>
              <img src={`/media/${m.r2Key}`} alt={m.alt || p.productName} width={160} loading="lazy" />
              {p.editable ? (
                <form method="post" action={`${base}/${m.id}/delete`}>
                  <button class="link" type="submit" aria-label={tr("media.deleteItem", { alt: m.alt || p.productName })}>
                    {tr("media.delete")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {p.error ? (
        <p id="media-error" class="error-msg" role="alert">
          {tr(ERROR_KEY[p.error])}
        </p>
      ) : null}
      {p.editable && p.media.length < MAX_MEDIA ? (
        <form method="post" action={base} enctype="multipart/form-data">
          <div class="field">
            <label for="media-file">{tr("media.file")}</label>
            <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="media-hint" />
            <p id="media-hint" class="hint">
              {tr("media.hint")}
            </p>
          </div>
          <div class="field">
            <label for="media-alt">{tr("media.alt")}</label>
            <input id="media-alt" name="alt" maxlength={150} />
          </div>
          <button class="btn" type="submit">
            {tr("media.upload")}
          </button>
        </form>
      ) : null}
    </section>
  );
};
```

`apps/web/src/views/hub/EditorPage.tsx`: thêm props `media: ProductMedia[]` và `mediaError: MediaErrorCode | null`; sau `ProductStepForm` (và cả khi bị khóa), nếu `p.step === "demo"` thì render:

```tsx
{p.step === "demo" ? (
  <MediaSection locale={p.locale} productId={p.product.id} productName={p.product.name} media={p.media} error={p.mediaError} editable={p.lock === null} />
) : null}
```

(`MediaError` trong route và `MediaErrorCode` trong view là cùng một union; route import type từ view để tránh định nghĩa hai lần: `export type MediaError = MediaErrorCode`.)

- [ ] **Step 6: Key i18n**

`en.ts`:

```ts
  "media.title": "Screenshots",
  "media.empty": "No images yet.",
  "media.file": "Image file",
  "media.hint": "JPEG, PNG or WebP, up to 2 MB, about 1600 px wide. Up to 8 images; the first one is the cover.",
  "media.alt": "Short description of the image",
  "media.upload": "Upload image",
  "media.delete": "Delete",
  "media.deleteItem": "Delete image: {alt}",
  "media.error.missing": "Choose an image file.",
  "media.error.type": "Only JPEG, PNG or WebP images are accepted.",
  "media.error.size": "This image is larger than 2 MB.",
  "media.error.full": "You already have 8 images. Delete one to add another.",
  "media.error.alt": "Keep the description under 150 characters.",
```

`vi.ts`:

```ts
  "media.title": "Ảnh chụp màn hình",
  "media.empty": "Chưa có ảnh nào.",
  "media.file": "Tệp ảnh",
  "media.hint": "JPEG, PNG hoặc WebP, tối đa 2 MB, rộng khoảng 1600 px. Tối đa 8 ảnh; ảnh đầu tiên là ảnh bìa.",
  "media.alt": "Mô tả ngắn cho ảnh",
  "media.upload": "Tải ảnh lên",
  "media.delete": "Xóa",
  "media.deleteItem": "Xóa ảnh: {alt}",
  "media.error.missing": "Hãy chọn một tệp ảnh.",
  "media.error.type": "Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
  "media.error.size": "Ảnh này lớn hơn 2 MB.",
  "media.error.full": "Bạn đã có 8 ảnh. Xóa bớt một ảnh để thêm ảnh mới.",
  "media.error.alt": "Mô tả tối đa 150 ký tự.",
```

`zh-hans.ts`:

```ts
  "media.title": "截图",
  "media.empty": "还没有图片。",
  "media.file": "图片文件",
  "media.hint": "JPEG、PNG 或 WebP，最大 2 MB，宽约 1600 像素。最多 8 张；第一张为封面。",
  "media.alt": "图片的简短描述",
  "media.upload": "上传图片",
  "media.delete": "删除",
  "media.deleteItem": "删除图片：{alt}",
  "media.error.missing": "请选择图片文件。",
  "media.error.type": "只接受 JPEG、PNG 或 WebP 图片。",
  "media.error.size": "图片超过 2 MB。",
  "media.error.full": "已有 8 张图片。请先删除一张再添加。",
  "media.error.alt": "描述最多 150 个字符。",
```

`zh-hant.ts`:

```ts
  "media.title": "截圖",
  "media.empty": "還沒有圖片。",
  "media.file": "圖片檔案",
  "media.hint": "JPEG、PNG 或 WebP，最大 2 MB，寬約 1600 像素。最多 8 張；第一張為封面。",
  "media.alt": "圖片的簡短描述",
  "media.upload": "上傳圖片",
  "media.delete": "刪除",
  "media.deleteItem": "刪除圖片：{alt}",
  "media.error.missing": "請選擇圖片檔案。",
  "media.error.type": "只接受 JPEG、PNG 或 WebP 圖片。",
  "media.error.size": "圖片超過 2 MB。",
  "media.error.full": "已有 8 張圖片。請先刪除一張再新增。",
  "media.error.alt": "描述最多 150 個字元。",
```

- [ ] **Step 7: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.media-section { margin-top: 24px; }
.media-grid { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 12px; }
.media-grid img { display: block; width: 160px; height: auto; border: 1px solid var(--line); border-radius: 8px; }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/wrangler.jsonc apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): product images on R2 with magic-byte checks and /media serving" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: VNX-0304a — Bước Pricing (tối đa 5 tier)

**Files:**
- Create: `apps/web/src/domain/pricing-input.ts`, `apps/web/src/db/pricing.ts`, `apps/web/src/views/hub/PricingForm.tsx`
- Modify: `apps/web/src/routes/hub-products.tsx` (GET/POST bước `pricing`), `apps/web/src/views/labels.ts` (`BILLING_KEY`), 4 file locale
- Test: `apps/web/test/domain/pricing-input.test.ts`, `apps/web/test/hub/pricing.test.ts`

**Interfaces:**
- Consumes: Task 1 (`MAX_TIERS`, `BILLINGS`, `PricingTier`, `editLock`), Task 2 (`ownedProduct`, `editorPath`, `EditorLayout`, `updateProductFields`, `normalizeNewlines`), `formatUsd`.
- Produces:
  - `domain/pricing-input.ts`: type `TierInput`, `TierValues`, `TierErrors`; `tierValuesFromBody(body)`, `tierValuesFromTiers(tiers)`, `parseTiers(values)`, `parseUsdCents(raw)`, `centsToInput(cents)`.
  - `db/pricing.ts`: `listTiers(db, productId)`, `replaceTiers(db, { productId, tiers, now })`.
  - Form field names: `tiers[i].name`, `tiers[i].billing`, `tiers[i].price`, `tiers[i].description` với i = 0…4.
  - `BILLING_KEY` trong `views/labels.ts`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/domain/pricing-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { centsToInput, parseTiers, parseUsdCents, tierValuesFromBody, tierValuesFromTiers } from "../../src/domain/pricing-input.ts";

describe("pricing input", () => {
  it.each([
    ["49", 4900],
    ["49.5", 4950],
    ["49.99", 4999],
    [" 0 ", 0],
    ["100000", 10_000_000],
  ])("parseUsdCents(%j) = %j", (raw, cents) => {
    expect(parseUsdCents(raw)).toBe(cents);
  });

  it.each(["", "-1", "1.999", "100000.01", "1e3", "abc", "1,000"])("parseUsdCents(%j) is null", (raw) => {
    expect(parseUsdCents(raw)).toBeNull();
  });

  it("formats cents back for the form", () => {
    expect(centsToInput(4900)).toBe("49");
    expect(centsToInput(4950)).toBe("49.50");
    expect(centsToInput(null)).toBe("");
  });

  it("drops blank rows and keeps order", () => {
    const values = tierValuesFromBody({
      "tiers[0].name": "Starter",
      "tiers[0].billing": "monthly",
      "tiers[0].price": "19",
      "tiers[0].description": "One location\r\n",
      "tiers[2].name": "Enterprise",
      "tiers[2].billing": "contact",
      "tiers[2].price": "",
    });
    expect(parseTiers(values)).toEqual({
      ok: true,
      tiers: [
        { name: "Starter", billing: "monthly", priceCents: 1900, description: "One location" },
        { name: "Enterprise", billing: "contact", priceCents: null, description: "" },
      ],
    });
  });

  it("reports errors per row", () => {
    const values = tierValuesFromBody({
      "tiers[0].name": "",
      "tiers[0].price": "10",
      "tiers[1].name": "Pro",
      "tiers[1].billing": "weekly",
      "tiers[1].price": "x",
      "tiers[2].name": "Ask",
      "tiers[2].billing": "contact",
      "tiers[2].price": "5",
      "tiers[3].name": "n".repeat(41),
      "tiers[3].billing": "one_time",
      "tiers[3].price": "1",
      "tiers[3].description": "d".repeat(301),
    });
    expect(parseTiers(values)).toEqual({
      ok: false,
      errors: { 0: { name: "required" }, 1: { billing: "choice", price: "price" }, 2: { price: "contact" }, 3: { name: "too_long", description: "too_long" } },
    });
  });

  it("round-trips stored tiers", () => {
    const stored = [
      { id: "a", productId: "p", name: "Starter", billing: "one_time" as const, priceCents: 4950, description: "x", sort: 1 },
      { id: "b", productId: "p", name: "Ask", billing: "contact" as const, priceCents: null, description: "", sort: 2 },
    ];
    expect(parseTiers(tierValuesFromTiers(stored))).toEqual({
      ok: true,
      tiers: [
        { name: "Starter", billing: "one_time", priceCents: 4950, description: "x" },
        { name: "Ask", billing: "contact", priceCents: null, description: "" },
      ],
    });
  });
});
```

`apps/web/test/hub/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listTiers } from "../../src/db/pricing.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const post = (id: string, cookie: string, body: Record<string, string>) =>
  createApp().request(formPost(`/hub/products/${id}/edit/pricing`, body, { cookie }), undefined, testEnv);

describe("pricing step (spec §5.3, §6.1)", () => {
  it("saves up to 5 tiers, replacing the previous set", async () => {
    const { product } = await makeDraft("pr-save@vnx.si", "pr-save", "Priced");
    const { cookie } = await signIn("pr-save@vnx.si");
    const res = await post(product.id, cookie, {
      "tiers[0].name": "Starter",
      "tiers[0].billing": "monthly",
      "tiers[0].price": "19",
      "tiers[1].name": "Enterprise",
      "tiers[1].billing": "contact",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/pricing?saved=1`);
    expect((await listTiers(testEnv.DB, product.id)).map((t) => [t.name, t.billing, t.priceCents, t.sort])).toEqual([
      ["Starter", "monthly", 1900, 1],
      ["Enterprise", "contact", null, 2],
    ]);
    await post(product.id, cookie, { "tiers[0].name": "Only", "tiers[0].billing": "one_time", "tiers[0].price": "99.5" });
    expect((await listTiers(testEnv.DB, product.id)).map((t) => [t.name, t.priceCents])).toEqual([["Only", 9950]]);

    const form = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/pricing`, cookie), undefined, testEnv)).text();
    expect(form).toContain('value="Only"');
    expect(form).toContain('value="99.50"');
    expect(form).toContain('name="tiers[4].name"');
  });

  it("re-renders errors (400) and keeps the stored tiers", async () => {
    const { product } = await makeDraft("pr-bad@vnx.si", "pr-bad", "Bad Price");
    const { cookie } = await signIn("pr-bad@vnx.si");
    await post(product.id, cookie, { "tiers[0].name": "Keep", "tiers[0].billing": "one_time", "tiers[0].price": "5" });
    const res = await post(product.id, cookie, { "tiers[0].name": "Bad", "tiers[0].billing": "one_time", "tiers[0].price": "abc" });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Enter a price from 0 to 100000 USD");
    expect(html).toContain('value="abc"');
    expect((await listTiers(testEnv.DB, product.id)).map((t) => t.name)).toEqual(["Keep"]);
  });

  it("blocks other builders (404) and locked products (409)", async () => {
    const { product } = await makeDraft("pr-owner@vnx.si", "pr-owner", "Locked Price");
    await makeBuilder("pr-intruder@vnx.si", "pr-intruder");
    const intruder = await signIn("pr-intruder@vnx.si");
    expect((await post(product.id, intruder.cookie, { "tiers[0].name": "X", "tiers[0].billing": "contact" })).status).toBe(404);
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    const owner = await signIn("pr-owner@vnx.si");
    expect((await post(product.id, owner.cookie, { "tiers[0].name": "X", "tiers[0].billing": "contact" })).status).toBe(409);
    expect(await listTiers(testEnv.DB, product.id)).toEqual([]);
  });

  it("flags a published product as edited", async () => {
    const { product } = await makeDraft("pr-live@vnx.si", "pr-live", "Live Price");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("pr-live@vnx.si");
    await post(product.id, cookie, { "tiers[0].name": "New", "tiers[0].billing": "yearly", "tiers[0].price": "120" });
    expect((await findProductById(testEnv.DB, product.id))?.editedAfterPublishAt).not.toBeNull();
  });
});
```

Run: `npm test -w apps/web -- test/domain/pricing-input.test.ts test/hub/pricing.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain và DB**

`apps/web/src/domain/pricing-input.ts`:

```ts
import { normalizeNewlines } from "./product-input.ts";
import { BILLINGS, MAX_TIERS, type Billing, type PricingTier } from "./product.ts";

export type TierInput = { name: string; billing: Billing; priceCents: number | null; description: string };
export type TierRowValues = { name: string; billing: string; price: string; description: string };
export type TierValues = TierRowValues[];
export type TierFieldError = "required" | "too_long" | "choice" | "price" | "contact";
export type TierErrors = Record<number, Partial<Record<keyof TierRowValues, TierFieldError>>>;

const MAX_PRICE_CENTS = 100_000 * 100;
const str = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

/** "49", "49.5" or "49.99" USD → cents; null when not a price between 0 and 100000. */
export function parseUsdCents(raw: string): number | null {
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function tierValuesFromBody(body: Record<string, unknown>): TierValues {
  return Array.from({ length: MAX_TIERS }, (_, i) => ({
    name: str(body[`tiers[${i}].name`]),
    billing: str(body[`tiers[${i}].billing`]),
    price: str(body[`tiers[${i}].price`]),
    description: str(body[`tiers[${i}].description`]),
  }));
}

export function tierValuesFromTiers(tiers: PricingTier[]): TierValues {
  return Array.from({ length: MAX_TIERS }, (_, i) => {
    const t = tiers[i];
    return t ? { name: t.name, billing: t.billing, price: centsToInput(t.priceCents), description: t.description } : { name: "", billing: "", price: "", description: "" };
  });
}

/** Rows with every field blank are skipped; any other row must be a complete tier. */
export function parseTiers(values: TierValues): { ok: true; tiers: TierInput[] } | { ok: false; errors: TierErrors } {
  const tiers: TierInput[] = [];
  const errors: TierErrors = {};
  values.slice(0, MAX_TIERS).forEach((row, i) => {
    const name = row.name.trim();
    // The select always posts a value; a missing one means the form default.
    const billing = row.billing.trim() || "one_time";
    const price = row.price.trim();
    const description = row.description.trim();
    if (!name && !price && !description && billing === "one_time") return;
    const rowErrors: Partial<Record<keyof TierRowValues, TierFieldError>> = {};
    if (!name) rowErrors.name = "required";
    else if (name.length > 40) rowErrors.name = "too_long";
    if (description.length > 300) rowErrors.description = "too_long";
    const validBilling = (BILLINGS as readonly string[]).includes(billing);
    if (!validBilling) rowErrors.billing = "choice";
    let priceCents: number | null = null;
    if (billing === "contact") {
      if (price !== "") rowErrors.price = "contact";
    } else {
      priceCents = parseUsdCents(price);
      if (priceCents === null) rowErrors.price = "price";
    }
    if (Object.keys(rowErrors).length > 0) errors[i] = rowErrors;
    else tiers.push({ name, billing: billing as Billing, priceCents, description });
  });
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, tiers };
}
```

`apps/web/src/db/pricing.ts`:

```ts
import type { TierInput } from "../domain/pricing-input.ts";
import type { PricingTier } from "../domain/product.ts";
import { ulid } from "../lib/ulid.ts";

type Row = { id: string; product_id: string; name: string; price_cents: number | null; billing: PricingTier["billing"]; description: string; sort: number };

const toTier = (r: Row): PricingTier => ({ id: r.id, productId: r.product_id, name: r.name, priceCents: r.price_cents, billing: r.billing, description: r.description, sort: r.sort });

export async function listTiers(db: D1Database, productId: string): Promise<PricingTier[]> {
  const { results } = await db.prepare("SELECT * FROM pricing_tiers WHERE product_id = ?1 ORDER BY sort, id").bind(productId).all<Row>();
  return results.map(toTier);
}

/** Replaces the whole set in one transaction (the form always posts every tier). */
export async function replaceTiers(db: D1Database, input: { productId: string; tiers: TierInput[]; now: string }): Promise<void> {
  const base = Date.parse(input.now);
  const insert = db.prepare("INSERT INTO pricing_tiers (id, product_id, name, price_cents, billing, description, sort, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)");
  await db.batch([
    db.prepare("DELETE FROM pricing_tiers WHERE product_id = ?1").bind(input.productId),
    ...input.tiers.map((t, i) => insert.bind(ulid(base + i), input.productId, t.name, t.priceCents, t.billing, t.description, i + 1, input.now)),
  ]);
}
```

- [ ] **Step 3: View và route**

Thêm vào `apps/web/src/views/labels.ts` (thêm `Billing` vào import type):

```ts
export const BILLING_KEY: Record<Billing, MessageKey> = {
  one_time: "pricing.billing.one_time",
  monthly: "pricing.billing.monthly",
  yearly: "pricing.billing.yearly",
  contact: "pricing.billing.contact",
};
```

`apps/web/src/views/hub/PricingForm.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { TierErrors, TierFieldError, TierRowValues, TierValues } from "../../domain/pricing-input.ts";
import { BILLINGS } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { BILLING_KEY } from "../labels.ts";

const ERROR_KEY: Record<TierFieldError, MessageKey> = {
  required: "product.error.required",
  too_long: "pricing.error.too_long",
  choice: "product.error.choice",
  price: "pricing.error.price",
  contact: "pricing.error.contact",
};

type Props = { locale: Locale; action: string; values: TierValues; errors: TierErrors };

export const PricingForm: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const field = (i: number, name: keyof TierRowValues, label: MessageKey, control: (aria: Record<string, string | undefined>) => unknown) => {
    const id = `tier-${i}-${name}`;
    const code = p.errors[i]?.[name];
    return (
      <div class="field">
        <label for={id}>{tr(label)}</label>
        {control({ id, "aria-invalid": code ? "true" : undefined, "aria-describedby": code ? `${id}-error` : undefined })}
        {code ? (
          <p id={`${id}-error`} class="error-msg">
            {tr(ERROR_KEY[code])}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <form method="post" action={p.action}>
      <p class="hint">{tr("pricing.intro")}</p>
      {Object.keys(p.errors).length > 0 ? (
        <p class="error-msg" role="alert">
          {tr("builder.form.errorSummary")}
        </p>
      ) : null}
      {p.values.map((row, i) => (
        <fieldset class="field">
          <legend>{tr("pricing.tier", { n: i + 1 })}</legend>
          {field(i, "name", "pricing.name", (aria) => <input name={`tiers[${i}].name`} value={row.name} maxlength={40} {...aria} />)}
          {field(i, "billing", "pricing.billing", (aria) => (
            <select name={`tiers[${i}].billing`} {...aria}>
              {BILLINGS.map((b) => (
                <option value={b} selected={(row.billing || "one_time") === b}>
                  {tr(BILLING_KEY[b])}
                </option>
              ))}
            </select>
          ))}
          {field(i, "price", "pricing.price", (aria) => <input name={`tiers[${i}].price`} value={row.price} inputmode="decimal" {...aria} />)}
          {field(i, "description", "pricing.description", (aria) => <input name={`tiers[${i}].description`} value={row.description} maxlength={300} {...aria} />)}
        </fieldset>
      ))}
      <button class="btn" type="submit">
        {tr("editor.save")}
      </button>
    </form>
  );
};
```

Trong `apps/web/src/routes/hub-products.tsx`:
- Import `listTiers`, `replaceTiers` từ `../db/pricing.ts`; `parseTiers`, `tierValuesFromBody`, `tierValuesFromTiers`, `type TierErrors`, `type TierValues` từ `../domain/pricing-input.ts`; `EditorLayout` từ `../views/hub/EditorLayout.tsx`; `PricingForm` từ `../views/hub/PricingForm.tsx`.
- Thêm hàm và hai route, **đăng ký trước** hai route `/hub/products/:id/edit/:step` hiện có (Hono khớp theo thứ tự đăng ký):

```tsx
function pricingPage(c: Context<AppEnv>, product: Product, values: TierValues, errors: TierErrors, status: 200 | 400 = 200) {
  const lock = editLock(product.status, c.get("builder").status);
  return page(
    c,
    <EditorLayout locale={c.get("locale")} origin={requestOrigin(c)} product={product} step="pricing" lock={lock} saved={c.req.query("saved") === "1"}>
      {lock ? null : <PricingForm locale={c.get("locale")} action={editorPath(c, product.id, "pricing")} values={values} errors={errors} />}
    </EditorLayout>,
    status,
  );
}
```

```tsx
  onLocalized(app, "get", "/hub/products/:id/edit/pricing", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    return pricingPage(c, product, tierValuesFromTiers(await listTiers(c.env.DB, product.id)), {});
  });

  onLocalized(app, "post", "/hub/products/:id/edit/pricing", requireBuilder, async (c) => {
    const product = await ownedProduct(c);
    if (!product) return errorResponse(c, "notFound", 404);
    if (editLock(product.status, c.get("builder").status)) return errorResponse(c, "conflict", 409);
    const values = tierValuesFromBody(await c.req.parseBody());
    const parsed = parseTiers(values);
    if (!parsed.ok) return pricingPage(c, product, values, parsed.errors, 400);

    const now = new Date().toISOString();
    const markEdited = product.firstPublishedAt !== null;
    // Compare-and-set on status first, so a product that just went to review keeps the tiers it was submitted with.
    const touched = await updateProductFields(c.env.DB, { productId: product.id, builderId: product.builderId, expectedStatus: product.status, fields: {}, now, markEdited });
    if (touched !== "ok") return errorResponse(c, "conflict", 409);
    await replaceTiers(c.env.DB, { productId: product.id, tiers: parsed.tiers, now });
    if (markEdited) {
      await writeAudit(c.env.DB, { actorUserId: product.builderId, action: "product.edit", entity: "product", entityId: product.id, data: { step: "pricing" }, now });
    }
    return c.redirect(editorPath(c, product.id, "pricing", "?saved=1"), 303);
  });
```

- [ ] **Step 4: Key i18n**

`en.ts`:

```ts
  "pricing.intro": "Add up to 5 pricing tiers. Leave a tier empty to remove it. Prices are in USD.",
  "pricing.tier": "Tier {n}",
  "pricing.name": "Tier name",
  "pricing.billing": "Billing",
  "pricing.price": "Price (USD)",
  "pricing.description": "What's included",
  "pricing.billing.one_time": "One-time",
  "pricing.billing.monthly": "Monthly",
  "pricing.billing.yearly": "Yearly",
  "pricing.billing.contact": "Contact for price",
  "pricing.error.too_long": "This text is too long.",
  "pricing.error.price": "Enter a price from 0 to 100000 USD, with at most 2 decimals.",
  "pricing.error.contact": "Leave the price empty for \"Contact for price\".",
```

`vi.ts`:

```ts
  "pricing.intro": "Thêm tối đa 5 mức giá. Để trống một mức để xóa mức đó. Giá tính bằng USD.",
  "pricing.tier": "Mức {n}",
  "pricing.name": "Tên mức giá",
  "pricing.billing": "Cách tính",
  "pricing.price": "Giá (USD)",
  "pricing.description": "Bao gồm những gì",
  "pricing.billing.one_time": "Một lần",
  "pricing.billing.monthly": "Theo tháng",
  "pricing.billing.yearly": "Theo năm",
  "pricing.billing.contact": "Liên hệ báo giá",
  "pricing.error.too_long": "Nội dung quá dài.",
  "pricing.error.price": "Nhập giá từ 0 đến 100000 USD, tối đa 2 chữ số thập phân.",
  "pricing.error.contact": "Để trống giá khi chọn \"Liên hệ báo giá\".",
```

`zh-hans.ts`:

```ts
  "pricing.intro": "最多添加 5 个价格方案。留空即可删除该方案。价格以美元计。",
  "pricing.tier": "方案 {n}",
  "pricing.name": "方案名称",
  "pricing.billing": "计费方式",
  "pricing.price": "价格（美元）",
  "pricing.description": "包含内容",
  "pricing.billing.one_time": "一次性",
  "pricing.billing.monthly": "按月",
  "pricing.billing.yearly": "按年",
  "pricing.billing.contact": "联系报价",
  "pricing.error.too_long": "内容太长。",
  "pricing.error.price": "请输入 0 到 100000 美元的价格，最多 2 位小数。",
  "pricing.error.contact": "选择\"联系报价\"时请留空价格。",
```

`zh-hant.ts`:

```ts
  "pricing.intro": "最多新增 5 個價格方案。留空即可刪除該方案。價格以美元計。",
  "pricing.tier": "方案 {n}",
  "pricing.name": "方案名稱",
  "pricing.billing": "計費方式",
  "pricing.price": "價格（美元）",
  "pricing.description": "包含內容",
  "pricing.billing.one_time": "一次性",
  "pricing.billing.monthly": "按月",
  "pricing.billing.yearly": "按年",
  "pricing.billing.contact": "聯絡報價",
  "pricing.error.too_long": "內容太長。",
  "pricing.error.price": "請輸入 0 到 100000 美元的價格，最多 2 位小數。",
  "pricing.error.contact": "選擇「聯絡報價」時請留空價格。",
```

- [ ] **Step 5: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): pricing step with up to five tiers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: VNX-0304b — Điều kiện submit và vòng đời product trong Hub

**Files:**
- Create: `apps/web/src/views/hub/ProductActions.tsx`
- Modify: `apps/web/src/domain/product-input.ts` (`GAP_STEP`), `apps/web/src/db/products.ts` (`countBuilderProductsByStatus`), `apps/web/src/routes/hub-products.tsx` (ngữ cảnh editor + route hành động), `apps/web/src/views/hub/EditorLayout.tsx` (prop `gaps`), `apps/web/src/routes/hub.tsx` + `apps/web/src/views/hub/OverviewPage.tsx` (đếm product), `apps/web/test/fixtures.ts` (`makeReadyProduct`, `publishProduct`), 4 file locale
- Test: `apps/web/test/hub/lifecycle.test.ts`

**Interfaces:**
- Consumes: Task 1 (`submitGaps`, `transition`, `setProductStatus`, `ReadinessGap`), Task 2–4 (`stepPage`, `pricingPage`, `EditorLayout`, `ownedProduct`, `editorPath`, `listTiers`, `listMedia`, `replaceTiers`, `addMedia`, `updateProductFields`).
- Produces:
  - `GAP_STEP: Record<ReadinessGap, ProductStep | null>` trong `domain/product-input.ts`.
  - `countBuilderProductsByStatus(db, builderId): Promise<Partial<Record<ProductStatus, number>>>`.
  - `editorState(c, product): Promise<{ lock: EditLock | null; gaps: ReadinessGap[] }>` trong `hub-products.tsx`; `EditorLayout` nhận thêm prop `gaps`.
  - Route `POST /hub/products/:id/:action` với `action` ∈ `submit | withdraw | unlist | relist | archive`. Audit `product.<action>`.
  - Fixture `makeReadyProduct(email, handle, name, opts?)` (đủ điều kiện submit, 2 tier, 1 ảnh giả) và `publishProduct(productId)` (draft → in_review → published, gắn `listed`).

- [ ] **Step 1: Fixture và test (fail)**

Thêm vào cuối `apps/web/test/fixtures.ts` (import `updateProductFields`, `findProductById`, `setProductStatus` từ `../src/db/products.ts`; `replaceTiers` từ `../src/db/pricing.ts`; `addMedia` từ `../src/db/media.ts`; `grantBadge` từ `../src/db/verifications.ts`; type `DeliveryModel` từ `../src/domain/product.ts`):

```ts
/** A draft that meets every submit condition: all text fields, 2 tiers and 1 (fake) image. */
export async function makeReadyProduct(
  email: string,
  handle: string,
  name: string,
  opts: { builderStatus?: BuilderStatus; deliveryModel?: DeliveryModel } = {},
): Promise<{ builder: Builder; product: Product }> {
  const { builder, product } = await makeDraft(email, handle, name, opts.builderStatus ?? "approved");
  const now = new Date().toISOString();
  await updateProductFields(testEnv.DB, {
    productId: product.id,
    builderId: builder.userId,
    expectedStatus: "draft",
    markEdited: false,
    now,
    fields: {
      tagline: `${name} in one line`,
      problem: "Bookings get lost",
      targetUsers: "Spa owners",
      description: "Online booking.\n\n- Calendar",
      category: "booking",
      deliveryModel: opts.deliveryModel ?? "saas",
      supportPolicy: "Email within 48h",
      features: ["Calendar", "Reminders"],
      techStack: ["Hono"],
      demoUrl: "https://demo.example",
    },
  });
  await replaceTiers(testEnv.DB, {
    productId: product.id,
    tiers: [
      { name: "Starter", billing: "monthly", priceCents: 1900, description: "One location" },
      { name: "Custom", billing: "contact", priceCents: null, description: "" },
    ],
    now,
  });
  await addMedia(testEnv.DB, { productId: product.id, r2Key: `products/${product.id}/01J0000000000000000000000C.png`, alt: "Cover", now });
  return { builder, product: (await findProductById(testEnv.DB, product.id))! };
}

/** Moves a draft straight to published with the system `listed` badge, as an admin approval would. */
export async function publishProduct(productId: string): Promise<Product> {
  const now = new Date().toISOString();
  await setProductStatus(testEnv.DB, { id: productId, from: "draft", to: "in_review", reviewNote: null, now });
  const published = await setProductStatus(testEnv.DB, { id: productId, from: "in_review", to: "published", reviewNote: null, now });
  await grantBadge(testEnv.DB, { productId, kind: "listed", verifiedBy: null, evidence: "", now });
  return published!;
}
```

`apps/web/test/hub/lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const act = (id: string, action: string, cookie: string) => createApp().request(formPost(`/hub/products/${id}/${action}`, {}, { cookie }), undefined, testEnv);
const status = async (id: string) => (await findProductById(testEnv.DB, id))?.status;

describe("submit conditions in the editor (spec §7.2)", () => {
  it("lists what is missing, hides Submit and refuses it (400)", async () => {
    const { product } = await makeDraft("lc-gaps@vnx.si", "lc-gaps", "Gaps");
    const { cookie } = await signIn("lc-gaps@vnx.si");
    const html = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/support`, cookie), undefined, testEnv)).text();
    expect(html).toContain("Before you can submit:");
    expect(html).toContain("Upload at least one image");
    expect(html).toContain(`href="/hub/products/${product.id}/edit/pricing"`);
    expect(html).not.toContain(`action="/hub/products/${product.id}/submit"`);
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
    expect(await status(product.id)).toBe("draft");
  });

  it("requires an approved builder", async () => {
    const { product } = await makeReadyProduct("lc-pending@vnx.si", "lc-pending", "Pending Kit", { builderStatus: "pending" });
    const { cookie } = await signIn("lc-pending@vnx.si");
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
    expect(await status(product.id)).toBe("draft");
  });

  it("requires a license for source products", async () => {
    const { product } = await makeReadyProduct("lc-source@vnx.si", "lc-source", "Source Kit", { deliveryModel: "source" });
    const { cookie } = await signIn("lc-source@vnx.si");
    const html = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/license`, cookie), undefined, testEnv)).text();
    expect(html).toContain("Choose a license for source code");
    expect((await act(product.id, "submit", cookie)).status).toBe(400);
  });
});

describe("product lifecycle in the Hub", () => {
  it("submits, withdraws and submits again", async () => {
    const { product } = await makeReadyProduct("lc-submit@vnx.si", "lc-submit", "Ready Kit");
    const { cookie } = await signIn("lc-submit@vnx.si");
    const editor = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).text();
    expect(editor).toContain(`action="/hub/products/${product.id}/submit"`);
    const res = await act(product.id, "submit", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/product`);
    expect(await status(product.id)).toBe("in_review");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'product.submit' AND entity_id = ?1").bind(product.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect((await act(product.id, "submit", cookie)).status).toBe(409);
    await act(product.id, "withdraw", cookie);
    expect(await status(product.id)).toBe("draft");
    await act(product.id, "submit", cookie);
    expect(await status(product.id)).toBe("in_review");
  });

  it("lets a builder resubmit after changes were requested", async () => {
    const { product } = await makeReadyProduct("lc-changes@vnx.si", "lc-changes", "Changes Kit");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "changes_requested", reviewNote: "Add a real screenshot", now });
    const { cookie } = await signIn("lc-changes@vnx.si");
    expect(await (await createApp().request(getReq(`/hub/products/${product.id}/edit/demo`, cookie), undefined, testEnv)).text()).toContain("Add a real screenshot");
    await act(product.id, "submit", cookie);
    expect(await status(product.id)).toBe("in_review");
  });

  it("hides, shows again and archives a published product", async () => {
    const { product } = await makeReadyProduct("lc-live@vnx.si", "lc-live", "Live Kit");
    await publishProduct(product.id);
    const { cookie } = await signIn("lc-live@vnx.si");
    await act(product.id, "unlist", cookie);
    expect(await status(product.id)).toBe("unlisted");
    await act(product.id, "relist", cookie);
    expect(await status(product.id)).toBe("published");
    const archived = await act(product.id, "archive", cookie);
    expect(archived.headers.get("location")).toBe("/hub/products");
    expect(await status(product.id)).toBe("archived");
    expect(await (await createApp().request(getReq("/hub/products", cookie), undefined, testEnv)).text()).not.toContain("Live Kit");
    expect((await createApp().request(getReq(`/hub/products/${product.id}/edit/product`, cookie), undefined, testEnv)).status).toBe(404);
  });

  it("refuses invalid moves (409), other builders (404), suspended builders (409) and unknown actions (404)", async () => {
    const { product } = await makeReadyProduct("lc-guard@vnx.si", "lc-guard", "Guard Kit");
    const { cookie } = await signIn("lc-guard@vnx.si");
    expect((await act(product.id, "withdraw", cookie)).status).toBe(409);
    expect((await act(product.id, "relist", cookie)).status).toBe(409);
    expect((await act(product.id, "approve", cookie)).status).toBe(404);
    await makeBuilder("lc-intruder@vnx.si", "lc-intruder");
    const intruder = await signIn("lc-intruder@vnx.si");
    expect((await act(product.id, "archive", intruder.cookie)).status).toBe(404);
    const susp = await makeReadyProduct("lc-susp@vnx.si", "lc-susp", "Susp Kit", { builderStatus: "suspended" });
    const suspCookie = await signIn("lc-susp@vnx.si");
    expect((await act(susp.product.id, "archive", suspCookie.cookie)).status).toBe(409);
    expect(await status(product.id)).toBe("draft");
  });
});

describe("Hub overview product counts (spec §5.3)", () => {
  it("shows products by status", async () => {
    const { product } = await makeReadyProduct("lc-count@vnx.si", "lc-count", "Count A");
    await publishProduct(product.id);
    const { cookie } = await signIn("lc-count@vnx.si");
    const html = await (await createApp().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Published: 1");
    expect(html).toContain('href="/hub/products"');
  });
});
```

Run: `npm test -w apps/web -- test/hub/lifecycle.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain và DB**

Thêm vào `apps/web/src/domain/product-input.ts` (import type `ReadinessGap` từ `./product.ts`):

```ts
/** Where the builder fixes each gap; null when it is not an editor step. */
export const GAP_STEP: Record<ReadinessGap, ProductStep | null> = {
  builder_not_approved: null,
  name: "product",
  tagline: "product",
  description: "product",
  category: "product",
  delivery_model: "product",
  problem: "problem",
  target_users: "audience",
  features: "features",
  media: "demo",
  pricing: "pricing",
  license: "license",
  support_policy: "support",
};
```

Thêm vào `apps/web/src/db/products.ts`:

```ts
/** Product counts per status for the Hub overview (archived excluded). */
export async function countBuilderProductsByStatus(db: D1Database, builderId: string): Promise<Partial<Record<ProductStatus, number>>> {
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS n FROM products WHERE builder_id = ?1 AND status != 'archived' GROUP BY status")
    .bind(builderId)
    .all<{ status: ProductStatus; n: number }>();
  return Object.fromEntries(results.map((r) => [r.status, r.n]));
}
```

- [ ] **Step 3: Hành động trong editor**

`apps/web/src/views/hub/ProductActions.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { GAP_STEP } from "../../domain/product-input.ts";
import type { EditLock, Product, ProductAction, ReadinessGap } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";

const GAP_KEY: Record<ReadinessGap, MessageKey> = {
  builder_not_approved: "editor.gap.builder_not_approved",
  name: "editor.gap.name",
  tagline: "editor.gap.tagline",
  problem: "editor.gap.problem",
  target_users: "editor.gap.target_users",
  description: "editor.gap.description",
  category: "editor.gap.category",
  delivery_model: "editor.gap.delivery_model",
  support_policy: "editor.gap.support_policy",
  features: "editor.gap.features",
  pricing: "editor.gap.pricing",
  media: "editor.gap.media",
  license: "editor.gap.license",
};

type OwnerAction = Extract<ProductAction, "submit" | "withdraw" | "unlist" | "relist" | "archive">;

const ACTION_KEY: Record<OwnerAction, MessageKey> = {
  submit: "editor.action.submit",
  withdraw: "editor.action.withdraw",
  unlist: "editor.action.unlist",
  relist: "editor.action.relist",
  archive: "editor.action.archive",
};

/** The owner actions spec §7.2 allows from each status (builder_suspended allows none). */
function actionsFor(product: Product, gaps: ReadinessGap[]): OwnerAction[] {
  switch (product.status) {
    case "draft":
    case "changes_requested":
      return gaps.length === 0 ? ["submit", "archive"] : ["archive"];
    case "in_review":
      return ["withdraw"];
    case "published":
      return ["unlist", "archive"];
    case "unlisted":
      return ["relist", "archive"];
    default:
      return [];
  }
}

type Props = { locale: Locale; product: Product; gaps: ReadinessGap[]; lock: EditLock | null };

export const ProductActions: FC<Props> = ({ locale, product, gaps, lock }) => {
  const tr = translator(locale);
  const editable = product.status === "draft" || product.status === "changes_requested";
  const actions = lock === "builder_suspended" ? [] : actionsFor(product, gaps);
  return (
    <aside class="notice product-actions">
      {editable ? (
        gaps.length === 0 ? (
          <p>{tr("editor.ready")}</p>
        ) : (
          <>
            <p>{tr("editor.gaps")}</p>
            <ul>
              {gaps.map((gap) => {
                const step = GAP_STEP[gap];
                return <li>{step ? <a href={localizedPath(locale, `/hub/products/${product.id}/edit/${step}`)}>{tr(GAP_KEY[gap])}</a> : tr(GAP_KEY[gap])}</li>;
              })}
            </ul>
          </>
        )
      ) : null}
      {actions.length > 0 ? (
        <div class="row-actions">
          {actions.map((action) => (
            <form method="post" action={localizedPath(locale, `/hub/products/${product.id}/${action}`)}>
              <button class={action === "submit" ? "btn" : "link"} type="submit">
                {tr(ACTION_KEY[action])}
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </aside>
  );
};
```

`apps/web/src/views/hub/EditorLayout.tsx`: thêm prop `gaps: ReadinessGap[]` và render `<ProductActions locale={p.locale} product={p.product} gaps={p.gaps} lock={p.lock} />` ngay sau thẻ `nav.subnav`.

Trong `apps/web/src/routes/hub-products.tsx`:
- Import `listTiers` (đã có), `listMedia` (đã có), `setProductStatus`, `submitGaps`, `transition`, type `ProductAction`, `ReadinessGap`, `EditLock`.
- Thêm:

```tsx
/** Lock and submit gaps shown on every editor page. */
export async function editorState(c: Context<AppEnv>, product: Product): Promise<{ lock: EditLock | null; gaps: ReadinessGap[] }> {
  const builder = c.get("builder");
  const [tiers, media] = await Promise.all([listTiers(c.env.DB, product.id), listMedia(c.env.DB, product.id)]);
  return {
    lock: editLock(product.status, builder.status),
    gaps: submitGaps({ product, builderStatus: builder.status, tierCount: tiers.length, mediaCount: media.length }),
  };
}
```

- Trong `stepPage` và `pricingPage`: thay `const lock = editLock(...)` bằng `const { lock, gaps } = await editorState(c, product);` (biến `pricingPage` thành async) và truyền `gaps={gaps}` cho `EditorPage` / `EditorLayout` (`EditorPage` nhận thêm prop `gaps` và chuyển tiếp cho `EditorLayout`).
- Thêm route dưới đây ở **cuối** `registerProductEditorRoutes`. Hono chạy handler theo thứ tự đăng ký, nên route `:action` không được đứng trước `POST /hub/products/:id/media`: trong `apps/web/src/app.ts`, chuyển lời gọi `registerProductMediaRoutes(app);` lên **trước** `registerProductEditorRoutes(app);` (test media của Task 3 phải vẫn xanh):

```tsx
const OWNER_ACTIONS = new Set<ProductAction>(["submit", "withdraw", "unlist", "relist", "archive"]);

  onLocalized(app, "post", "/hub/products/:id/:action", requireBuilder, async (c) => {
    const action = c.req.param("action") as ProductAction;
    const product = await ownedProduct(c);
    if (!product || !OWNER_ACTIONS.has(action)) return errorResponse(c, "notFound", 404);
    const builder = c.get("builder");
    if (builder.status === "suspended") return errorResponse(c, "conflict", 409);
    const next = transition(product.status, action, "owner");
    if (!next.ok) return errorResponse(c, "conflict", 409);
    if (action === "submit") {
      const { gaps } = await editorState(c, product);
      if (gaps.length > 0) return stepPage(c, product, "product", stepValuesFromProduct("product", product), {}, 400);
    }
    const now = new Date().toISOString();
    const updated = await setProductStatus(c.env.DB, { id: product.id, from: product.status, to: next.status, reviewNote: product.reviewNote, now });
    if (!updated) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: builder.userId, action: `product.${action}`, entity: "product", entityId: product.id, data: { from: product.status, to: next.status }, now });
    if (action === "archive") return c.redirect(localizedPath(c.get("locale"), "/hub/products"), 303);
    return c.redirect(editorPath(c, product.id, "product"), 303);
  });
```

- [ ] **Step 4: Đếm product ở tổng quan Hub**

`apps/web/src/routes/hub.tsx`: route `GET /hub` nạp `countBuilderProductsByStatus(c.env.DB, builder.userId)` và truyền `productCounts` cho `OverviewPage`.

`apps/web/src/views/hub/OverviewPage.tsx`: thêm prop `productCounts: Partial<Record<ProductStatus, number>>` và, sau khối trạng thái hồ sơ, render:

```tsx
<section class="card wide">
  <h2>{tr("hub.products.title")}</h2>
  {Object.keys(productCounts).length === 0 ? (
    <p class="muted">{tr("products.empty")}</p>
  ) : (
    <ul>
      {PRODUCT_STATUSES.filter((s) => productCounts[s]).map((s) => (
        <li>
          {tr(PRODUCT_STATUS_KEY[s])}: {productCounts[s]}
        </li>
      ))}
    </ul>
  )}
  <p>
    <a href={localizedPath(locale, "/hub/products")}>{tr("hub.products.manage")}</a>
  </p>
</section>
```

- [ ] **Step 5: Key i18n**

`en.ts`:

```ts
  "editor.ready": "Ready to submit for review.",
  "editor.gaps": "Before you can submit:",
  "editor.gap.builder_not_approved": "Your builder profile must be approved first",
  "editor.gap.name": "Add a name",
  "editor.gap.tagline": "Add a tagline",
  "editor.gap.problem": "Describe the problem it solves",
  "editor.gap.target_users": "Describe who it is for",
  "editor.gap.description": "Add a description",
  "editor.gap.category": "Choose a category",
  "editor.gap.delivery_model": "Choose how you deliver it",
  "editor.gap.support_policy": "Describe the support you offer",
  "editor.gap.features": "Add at least one feature",
  "editor.gap.pricing": "Add at least one pricing tier",
  "editor.gap.media": "Upload at least one image",
  "editor.gap.license": "Choose a license for source code",
  "editor.action.submit": "Submit for review",
  "editor.action.withdraw": "Withdraw from review",
  "editor.action.unlist": "Hide from the marketplace",
  "editor.action.relist": "Show again",
  "editor.action.archive": "Archive",
  "hub.products.title": "Products",
  "hub.products.manage": "Manage products",
```

`vi.ts`:

```ts
  "editor.ready": "Đã sẵn sàng gửi duyệt.",
  "editor.gaps": "Cần hoàn thiện trước khi gửi duyệt:",
  "editor.gap.builder_not_approved": "Hồ sơ builder của bạn cần được duyệt trước",
  "editor.gap.name": "Thêm tên",
  "editor.gap.tagline": "Thêm câu giới thiệu",
  "editor.gap.problem": "Mô tả vấn đề sản phẩm giải quyết",
  "editor.gap.target_users": "Mô tả sản phẩm dành cho ai",
  "editor.gap.description": "Thêm mô tả",
  "editor.gap.category": "Chọn danh mục",
  "editor.gap.delivery_model": "Chọn cách bàn giao",
  "editor.gap.support_policy": "Mô tả hỗ trợ bạn cung cấp",
  "editor.gap.features": "Thêm ít nhất một tính năng",
  "editor.gap.pricing": "Thêm ít nhất một mức giá",
  "editor.gap.media": "Tải lên ít nhất một ảnh",
  "editor.gap.license": "Chọn license cho mã nguồn",
  "editor.action.submit": "Gửi duyệt",
  "editor.action.withdraw": "Rút lại",
  "editor.action.unlist": "Ẩn khỏi marketplace",
  "editor.action.relist": "Hiện lại",
  "editor.action.archive": "Lưu trữ",
  "hub.products.title": "Sản phẩm",
  "hub.products.manage": "Quản lý sản phẩm",
```

`zh-hans.ts`:

```ts
  "editor.ready": "可以提交审核了。",
  "editor.gaps": "提交前还需完成：",
  "editor.gap.builder_not_approved": "你的 Builder 资料需先通过审核",
  "editor.gap.name": "添加名称",
  "editor.gap.tagline": "添加一句话介绍",
  "editor.gap.problem": "描述它解决的问题",
  "editor.gap.target_users": "描述它适合谁",
  "editor.gap.description": "添加描述",
  "editor.gap.category": "选择类别",
  "editor.gap.delivery_model": "选择交付方式",
  "editor.gap.support_policy": "描述你提供的支持",
  "editor.gap.features": "至少添加一个功能",
  "editor.gap.pricing": "至少添加一个价格方案",
  "editor.gap.media": "至少上传一张图片",
  "editor.gap.license": "为源代码选择授权",
  "editor.action.submit": "提交审核",
  "editor.action.withdraw": "撤回审核",
  "editor.action.unlist": "从市场隐藏",
  "editor.action.relist": "重新显示",
  "editor.action.archive": "归档",
  "hub.products.title": "产品",
  "hub.products.manage": "管理产品",
```

`zh-hant.ts`:

```ts
  "editor.ready": "可以送審了。",
  "editor.gaps": "送審前還需完成：",
  "editor.gap.builder_not_approved": "你的 Builder 資料需先通過審核",
  "editor.gap.name": "新增名稱",
  "editor.gap.tagline": "新增一句話介紹",
  "editor.gap.problem": "描述它解決的問題",
  "editor.gap.target_users": "描述它適合誰",
  "editor.gap.description": "新增描述",
  "editor.gap.category": "選擇類別",
  "editor.gap.delivery_model": "選擇交付方式",
  "editor.gap.support_policy": "描述你提供的支援",
  "editor.gap.features": "至少新增一個功能",
  "editor.gap.pricing": "至少新增一個價格方案",
  "editor.gap.media": "至少上傳一張圖片",
  "editor.gap.license": "為原始碼選擇授權",
  "editor.action.submit": "送審",
  "editor.action.withdraw": "撤回送審",
  "editor.action.unlist": "從市集隱藏",
  "editor.action.relist": "重新顯示",
  "editor.action.archive": "封存",
  "hub.products.title": "產品",
  "hub.products.manage": "管理產品",
```

- [ ] **Step 6: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): submit checklist and product lifecycle actions in the hub" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: VNX-0305a — Admin duyệt product

**Files:**
- Create: `apps/web/src/routes/admin-products.tsx`, `apps/web/src/views/admin/ProductsQueuePage.tsx`, `apps/web/src/views/admin/ProductDetailPage.tsx`, `apps/web/src/email/templates/product-decision.ts`
- Modify: `apps/web/src/domain/product.ts` (type `ProductWithBuilder`), `apps/web/src/db/products.ts` (`listProductsByStatus`, `findProductWithBuilder`), `apps/web/src/views/admin/AdminLayout.tsx` (mục Products), `apps/web/src/app.ts`, 4 file locale
- Test: `apps/web/test/admin/products.test.ts`, `apps/web/test/email/product-decision.test.ts`

**Interfaces:**
- Consumes: Task 1 (`transition`, `setProductStatus`, `grantBadge`, `listActiveBadges`), Task 3–5 (`listMedia`, `listTiers`, fixtures `makeReadyProduct`, `publishProduct`), M2 (`requireAdmin`, `AdminLayout`, `getMailer`, `escapeHtml`, `isLocale`, `formatUsd`, `PlainText`).
- Produces:
  - `ProductWithBuilder { product: Product; builderHandle; builderName; builderEmail; builderLocale; builderStatus }` trong `domain/product.ts`.
  - `listProductsByStatus(db, status, limit = 200)` (cũ nhất trước theo `updated_at`), `findProductWithBuilder(db, id)`.
  - `productApprovedEmail(locale, { name, productUrl, hubUrl })`, `productChangesEmail(locale, { name, note, editUrl })`.
  - `registerAdminProductRoutes(app)`: `GET /admin/products?status=…` (mặc định `in_review`), `GET /admin/products/:id`, `POST /admin/products/:id/{approve|request_changes|suspend|unsuspend}`. Audit `product.<action>`. `AdminSection` thêm `"products"`.
  - `ProductDetailPage` props `{ locale, origin, item, tiers, media, badges, notice, noteError? }` (Task 7 thêm form huy hiệu).

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/email/product-decision.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { productApprovedEmail, productChangesEmail } from "../../src/email/templates/product-decision.ts";

describe("product decision e-mails", () => {
  it("approval links the public page and the hub", () => {
    const mail = productApprovedEmail("vi", { name: "Spa Kit", productUrl: "https://vnx.si/vi/p/spa-kit", hubUrl: "https://vnx.si/vi/hub/products" });
    expect(mail.subject).toBe("Sản phẩm của bạn trên VNX.SI đã được duyệt");
    expect(mail.text).toContain("Spa Kit");
    expect(mail.text).toContain("https://vnx.si/vi/p/spa-kit");
  });

  it("change requests carry the admin note, escaped in HTML", () => {
    const mail = productChangesEmail("en", { name: "<b>Kit</b>", note: "Use <real> screenshots", editUrl: "https://vnx.si/hub/products/X/edit/demo" });
    expect(mail.text).toContain("Use <real> screenshots");
    expect(mail.html).toContain("Use &lt;real&gt; screenshots");
    expect(mail.html).not.toContain("<b>Kit</b>");
  });
});
```

`apps/web/test/admin/products.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const admin = () => signIn("owner@vnx.si", { admin: true });
const submit = (id: string) => setProductStatus(testEnv.DB, { id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
const decide = (id: string, action: string, cookie: string, body: Record<string, string> = {}, env: Bindings = testEnv) =>
  createApp().request(formPost(`/admin/products/${id}/${action}`, body, { cookie }), undefined, env);

describe("admin product queue (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    expect((await createApp().request(getReq("/admin/products"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fadmin%2Fproducts");
    const { cookie } = await signIn("ap-nobody@vnx.si");
    expect((await createApp().request(getReq("/admin/products", cookie), undefined, testEnv)).status).toBe(403);
    expect((await decide("01ZZZZZZZZZZZZZZZZZZZZZZZZ", "approve", cookie)).status).toBe(403);
  });

  it("lists products waiting for review with their builder", async () => {
    const { product } = await makeReadyProduct("ap-list@vnx.si", "ap-list", "Queue Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const html = await (await createApp().request(getReq("/admin/products", cookie), undefined, testEnv)).text();
    expect(html).toContain("Queue Kit");
    expect(html).toContain("ap-list");
    const detail = await (await createApp().request(getReq(`/admin/products/${product.id}`, cookie), undefined, testEnv)).text();
    expect(detail).toContain("$19");
    expect(detail).toContain(`src="/media/products/${product.id}/`);
  });

  it("approves: publishes, adds the listed badge and e-mails the builder in their language", async () => {
    await ensureUser("ap-approve@vnx.si", "vi");
    const { product } = await makeReadyProduct("ap-approve@vnx.si", "ap-approve", "Approve Kit");
    await submit(product.id);
    const { user, cookie } = await admin();
    const res = await decide(product.id, "approve", cookie);
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=1`);
    const after = await findProductById(testEnv.DB, product.id);
    expect(after).toMatchObject({ status: "published", reviewNote: null });
    expect(after?.firstPublishedAt).not.toBeNull();
    const badges = await listActiveBadges(testEnv.DB, product.id);
    expect(badges.map((b) => [b.kind, b.verifiedBy])).toEqual([["listed", null]]);
    expect(outbox[0]).toMatchObject({ to: "ap-approve@vnx.si", subject: "Sản phẩm của bạn trên VNX.SI đã được duyệt" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/p/${after!.slug}`);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE action = 'product.approve' AND entity_id = ?1").bind(product.id).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect((await decide(product.id, "approve", cookie)).status).toBe(409);
  });

  it("requires a note to request changes and sends it to the builder", async () => {
    const { product } = await makeReadyProduct("ap-changes@vnx.si", "ap-changes", "Changes Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const missing = await decide(product.id, "request_changes", cookie, { note: " " });
    expect(missing.status).toBe(400);
    expect(await missing.text()).toContain("Enter a note (up to 1000 characters).");
    await decide(product.id, "request_changes", cookie, { note: "Add a real screenshot\r\nplease" });
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "changes_requested", reviewNote: "Add a real screenshot\nplease" });
    expect(outbox[0]!.text).toContain("Add a real screenshot");
  });

  it("suspends and restores a published product", async () => {
    const { product } = await makeReadyProduct("ap-susp@vnx.si", "ap-susp", "Susp Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    await decide(product.id, "suspend", cookie, { note: "Broken demo" });
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "suspended", reviewNote: "Broken demo" });
    expect((await decide(product.id, "suspend", cookie)).status).toBe(409);
    await decide(product.id, "unsuspend", cookie);
    expect(await findProductById(testEnv.DB, product.id)).toMatchObject({ status: "published", reviewNote: null });
    expect(outbox).toHaveLength(0);
  });

  it("keeps the approval when the e-mail fails", async () => {
    const { product } = await makeReadyProduct("ap-nomail@vnx.si", "ap-nomail", "No Mail Kit");
    await submit(product.id);
    const { cookie } = await admin();
    const res = await decide(product.id, "approve", cookie, {}, { ...testEnv, MAIL_DRIVER: undefined } as Bindings);
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=mail_failed`);
    expect((await findProductById(testEnv.DB, product.id))?.status).toBe("published");
  });

  it("404s on unknown products", async () => {
    const { cookie } = await admin();
    expect((await createApp().request(getReq("/admin/products/01ZZZZZZZZZZZZZZZZZZZZZZZZ", cookie), undefined, testEnv)).status).toBe(404);
    expect((await decide("01ZZZZZZZZZZZZZZZZZZZZZZZZ", "approve", cookie)).status).toBe(404);
  });
});
```

Run: `npm test -w apps/web -- test/admin/products.test.ts test/email/product-decision.test.ts`
Expected: FAIL.

- [ ] **Step 2: Domain và DB**

Thêm vào `apps/web/src/domain/product.ts`:

```ts
/** A product with the builder fields admin screens and e-mails need. */
export interface ProductWithBuilder {
  product: Product;
  builderHandle: string;
  builderName: string;
  builderEmail: string;
  builderLocale: string;
  builderStatus: BuilderStatus;
}
```

Thêm vào `apps/web/src/db/products.ts`:

```ts
type WithBuilderRow = ProductRow & { builder_handle: string; builder_name: string; builder_email: string; builder_locale: string; builder_status: BuilderStatus };

const WITH_BUILDER = `SELECT p.*, b.handle AS builder_handle, b.name AS builder_name, b.status AS builder_status, u.email AS builder_email, u.locale AS builder_locale
  FROM products p JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id`;

function toWithBuilder(r: WithBuilderRow): ProductWithBuilder {
  return { product: toProduct(r), builderHandle: r.builder_handle, builderName: r.builder_name, builderEmail: r.builder_email, builderLocale: r.builder_locale, builderStatus: r.builder_status };
}

export async function findProductWithBuilder(db: D1Database, id: string): Promise<ProductWithBuilder | null> {
  const row = await db.prepare(`${WITH_BUILDER} WHERE p.id = ?1`).bind(id).first<WithBuilderRow>();
  return row ? toWithBuilder(row) : null;
}

/** Oldest change first, so the review queue is first come, first served. */
export async function listProductsByStatus(db: D1Database, status: ProductStatus, limit = 200): Promise<ProductWithBuilder[]> {
  const { results } = await db.prepare(`${WITH_BUILDER} WHERE p.status = ?1 ORDER BY p.updated_at, p.id LIMIT ?2`).bind(status, limit).all<WithBuilderRow>();
  return results.map(toWithBuilder);
}
```

(import thêm type `BuilderStatus` từ `../domain/builder.ts` và `ProductWithBuilder` từ `../domain/product.ts`.)

- [ ] **Step 3: Email**

`apps/web/src/email/templates/product-decision.ts`:

```ts
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { escapeHtml } from "../escape.ts";

type Email = { subject: string; text: string; html: string };

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;
const link = (href: string) => `<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`;
const quote = (text: string) => `<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">${escapeHtml(text)}</blockquote>`;
const wrap = (locale: Locale, parts: string[]) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">${parts.join("")}</body></html>`;

export function productApprovedEmail(locale: Locale, input: { name: string; productUrl: string; hubUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.productApproved.body", { name: input.name });
  const cta = tr("email.productApproved.cta");
  return {
    subject: tr("email.productApproved.subject"),
    text: `${body}\n${input.productUrl}\n\n${cta}\n${input.hubUrl}`,
    html: wrap(locale, [p(body), link(input.productUrl), p(cta), link(input.hubUrl)]),
  };
}

export function productChangesEmail(locale: Locale, input: { name: string; note: string; editUrl: string }): Email {
  const tr = translator(locale);
  const body = tr("email.productChanges.body", { name: input.name });
  const cta = tr("email.productChanges.cta");
  return {
    subject: tr("email.productChanges.subject"),
    text: `${body}\n\n${input.note}\n\n${cta}\n${input.editUrl}`,
    html: wrap(locale, [p(body), quote(input.note), p(cta), link(input.editUrl)]),
  };
}
```

- [ ] **Step 4: View admin**

`apps/web/src/views/admin/AdminLayout.tsx`: đổi `AdminSection` thành `"builders" | "products" | "invites" | "users"` và chèn `{ key: "products", path: "/admin/products", label: "admin.nav.products" }` ngay sau mục `builders` trong `NAV`.

`apps/web/src/views/admin/ProductsQueuePage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { PRODUCT_STATUSES, type ProductStatus, type ProductWithBuilder } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, PRODUCT_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

type Props = { locale: Locale; origin: string; status: ProductStatus; items: ProductWithBuilder[] };

export const ProductsQueuePage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.products")} rest="/admin/products" active="products">
      <h1>{tr("admin.nav.products")}</h1>
      <nav class="subnav" aria-label={tr("admin.builders.filter")}>
        {PRODUCT_STATUSES.map((s) => (
          <a href={localizedPath(p.locale, `/admin/products?status=${s}`)} aria-current={s === p.status ? "page" : undefined}>
            {tr(PRODUCT_STATUS_KEY[s])}
          </a>
        ))}
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("admin.products.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("product.field.name")}</th>
                <th>{tr("admin.col.handle")}</th>
                <th>{tr("product.field.category")}</th>
                <th>{tr("admin.products.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/products/${item.product.id}`)}>{item.product.name}</a>
                  </td>
                  <td>{item.builderHandle}</td>
                  <td>{item.product.category ? tr(CATEGORY_KEY[item.product.category]) : "—"}</td>
                  <td>{item.product.updatedAt.slice(0, 10)}</td>
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

`apps/web/src/views/admin/ProductDetailPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { Badge, PricingTier, ProductAction, ProductMedia, ProductWithBuilder } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { formatUsd } from "../format.ts";
import { BILLING_KEY, CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY, PRODUCT_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { AdminLayout } from "./AdminLayout.tsx";
import type { AdminNotice } from "./BuilderDetailPage.tsx";

export const BADGE_KEY: Record<Badge["kind"], MessageKey> = {
  listed: "badge.listed",
  demo_verified: "badge.demo_verified",
  in_production: "badge.in_production",
};

type Props = {
  locale: Locale;
  origin: string;
  item: ProductWithBuilder;
  tiers: PricingTier[];
  media: ProductMedia[];
  badges: Badge[];
  notice: AdminNotice;
  noteError?: ProductAction;
};

export const ProductDetailPage: FC<Props> = ({ locale, origin, item, tiers, media, badges, notice, noteError }) => {
  const tr = translator(locale);
  const p = item.product;
  const action = (name: ProductAction) => localizedPath(locale, `/admin/products/${p.id}/${name}`);
  const noteForm = (name: ProductAction, required: boolean, label: MessageKey, submit: MessageKey) => (
    <form method="post" action={action(name)} class="card">
      <div class="field">
        <label for={`${name}-note`}>{tr(label)}</label>
        <textarea
          id={`${name}-note`}
          name="note"
          maxlength={1000}
          required={required}
          aria-invalid={noteError === name ? "true" : undefined}
          aria-describedby={noteError === name ? `${name}-note-error` : undefined}
        ></textarea>
        {noteError === name ? (
          <p id={`${name}-note-error`} class="error-msg">
            {tr("admin.products.error.note")}
          </p>
        ) : null}
      </div>
      <button class="btn" type="submit">
        {tr(submit)}
      </button>
    </form>
  );
  return (
    <AdminLayout locale={locale} origin={origin} title={p.name} rest={`/admin/products/${p.id}`} active="products">
      <h1>
        {p.name} <span class={`badge badge-${p.status}`}>{tr(PRODUCT_STATUS_KEY[p.status])}</span>
      </h1>
      {notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.products.mailFailed")}
        </p>
      ) : null}
      <p class="lead">{p.tagline}</p>
      <dl class="facts">
        <dt>{tr("admin.col.handle")}</dt>
        <dd>
          <a href={localizedPath(locale, `/admin/builders/${p.builderId}`)}>{item.builderHandle}</a> ({item.builderEmail})
        </dd>
        <dt>{tr("product.field.slug")}</dt>
        <dd>/p/{p.slug}</dd>
        <dt>{tr("product.field.category")}</dt>
        <dd>{p.category ? tr(CATEGORY_KEY[p.category]) : "—"}</dd>
        <dt>{tr("product.field.deliveryModel")}</dt>
        <dd>{p.deliveryModel ? tr(DELIVERY_KEY[p.deliveryModel]) : "—"}</dd>
        <dt>{tr("product.field.license")}</dt>
        <dd>{p.license ? tr(LICENSE_KEY[p.license]) : "—"}</dd>
        <dt>{tr("product.field.demoUrl")}</dt>
        <dd>
          {p.demoUrl ? (
            <a href={p.demoUrl} rel="nofollow ugc noopener" target="_blank">
              {p.demoUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      {media.length > 0 ? (
        <ul class="media-grid">
          {media.map((m) => (
            <li>
              <img src={`/media/${m.r2Key}`} alt={m.alt || p.name} width={160} loading="lazy" />
            </li>
          ))}
        </ul>
      ) : null}
      <h2>{tr("product.field.problem")}</h2>
      <PlainText text={p.problem} />
      <h2>{tr("product.field.targetUsers")}</h2>
      <PlainText text={p.targetUsers} />
      <h2>{tr("product.field.description")}</h2>
      <PlainText text={p.description} />
      <h2>{tr("product.field.features")}</h2>
      <ul>
        {p.features.map((f) => (
          <li>{f}</li>
        ))}
      </ul>
      <h2>{tr("product.step.pricing")}</h2>
      <ul>
        {tiers.map((t) => (
          <li>
            {t.name}: {t.priceCents === null ? tr(BILLING_KEY.contact) : `${formatUsd(locale, t.priceCents)} · ${tr(BILLING_KEY[t.billing])}`}
          </li>
        ))}
      </ul>
      <h2>{tr("product.field.supportPolicy")}</h2>
      <PlainText text={p.supportPolicy} />
      <h2>{tr("admin.products.badges")}</h2>
      <ul>
        {badges.map((b) => (
          <li>
            {tr(BADGE_KEY[b.kind])} · {b.verifiedAt.slice(0, 10)}
            {b.evidence ? ` · ${b.evidence}` : ""}
          </li>
        ))}
      </ul>
      {p.reviewNote ? (
        <>
          <h2>{tr("hub.reviewNote")}</h2>
          <PlainText text={p.reviewNote} />
        </>
      ) : null}

      {p.status === "in_review" ? (
        <div class="row-actions">
          <form method="post" action={action("approve")}>
            <button class="btn" type="submit">
              {tr("admin.approve")}
            </button>
          </form>
          {noteForm("request_changes", true, "admin.products.note", "admin.products.requestChanges")}
        </div>
      ) : null}
      {p.status === "published" ? noteForm("suspend", false, "admin.reasonOptional", "admin.suspend") : null}
      {p.status === "suspended" ? (
        <form method="post" action={action("unsuspend")}>
          <button class="btn" type="submit">
            {tr("admin.unsuspend")}
          </button>
        </form>
      ) : null}
    </AdminLayout>
  );
};
```

- [ ] **Step 5: Route admin product**

`apps/web/src/routes/admin-products.tsx`:

```tsx
import type { Context, Hono } from "hono";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.ts";
import { writeAudit } from "../db/audit.ts";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { findProductWithBuilder, listProductsByStatus, setProductStatus } from "../db/products.ts";
import { grantBadge, listActiveBadges } from "../db/verifications.ts";
import { normalizeNewlines } from "../domain/product-input.ts";
import { isProductStatus, transition, type ProductAction, type ProductWithBuilder } from "../domain/product.ts";
import { getMailer } from "../email/index.ts";
import { productApprovedEmail, productChangesEmail } from "../email/templates/product-decision.ts";
import type { AppEnv } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import type { AdminNotice } from "../views/admin/BuilderDetailPage.tsx";
import { ProductDetailPage } from "../views/admin/ProductDetailPage.tsx";
import { ProductsQueuePage } from "../views/admin/ProductsQueuePage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

type AdminProductAction = Extract<ProductAction, "approve" | "request_changes" | "suspend" | "unsuspend">;

/** request_changes must say why (spec §5.5: review_note bắt buộc). Stored in products.review_note. */
const NOTE: Record<AdminProductAction, "required" | "optional" | "none"> = { approve: "none", request_changes: "required", suspend: "optional", unsuspend: "none" };
const NoteSchema = { required: z.string().trim().min(1).max(1000), optional: z.string().trim().max(1000) };

function noticeFrom(value: string | undefined): AdminNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

/** Exported for Task 7 (badge forms re-render the same page). */
export async function productDetail(c: Context<AppEnv>, item: ProductWithBuilder, notice: AdminNotice, status: 200 | 400 | 409 = 200, noteError?: AdminProductAction) {
  const [tiers, media, badges] = await Promise.all([listTiers(c.env.DB, item.product.id), listMedia(c.env.DB, item.product.id), listActiveBadges(c.env.DB, item.product.id)]);
  return page(
    c,
    <ProductDetailPage locale={c.get("locale")} origin={requestOrigin(c)} item={item} tiers={tiers} media={media} badges={badges} notice={notice} noteError={noteError} />,
    status,
  );
}

async function notify(c: Context<AppEnv>, item: ProductWithBuilder, action: "approve" | "request_changes", note: string | null): Promise<boolean> {
  const locale = isLocale(item.builderLocale) ? item.builderLocale : "en";
  const url = (path: string) => new URL(localizedPath(locale, path), c.env.APP_ORIGIN).toString();
  const p = item.product;
  const message =
    action === "approve"
      ? productApprovedEmail(locale, { name: p.name, productUrl: url(`/p/${p.slug}`), hubUrl: url("/hub/products") })
      : productChangesEmail(locale, { name: p.name, note: note ?? "", editUrl: url(`/hub/products/${p.id}/edit/product`) });
  try {
    await getMailer(c.env).send({ to: item.builderEmail, ...message });
    return true;
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "product.mail_failed", action, error: String(err) }));
    return false;
  }
}

async function decideProduct(c: Context<AppEnv>, action: AdminProductAction) {
  const admin = c.get("user")!;
  const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
  if (!item) return errorResponse(c, "notFound", 404);

  let note: string | null = null;
  const policy = NOTE[action];
  if (policy !== "none") {
    const body = await c.req.parseBody();
    const parsed = NoteSchema[policy].safeParse(normalizeNewlines(typeof body.note === "string" ? body.note : ""));
    if (!parsed.success) return productDetail(c, item, null, 400, action);
    note = parsed.data || null;
  }

  const p = item.product;
  const next = transition(p.status, action, "admin");
  if (!next.ok) return errorResponse(c, "conflict", 409);
  const now = new Date().toISOString();
  const updated = await setProductStatus(c.env.DB, { id: p.id, from: p.status, to: next.status, reviewNote: note, now });
  if (!updated) return errorResponse(c, "conflict", 409);
  // Spec §7.2: approval adds the system "listed" badge (no-op when one is already active).
  if (action === "approve") await grantBadge(c.env.DB, { productId: p.id, kind: "listed", verifiedBy: null, evidence: "", now });
  await writeAudit(c.env.DB, { actorUserId: admin.id, action: `product.${action}`, entity: "product", entityId: p.id, data: { from: p.status, to: next.status, note }, now });

  const mailed = action === "approve" || action === "request_changes" ? await notify(c, { ...item, product: updated }, action, note) : true;
  return c.redirect(localizedPath(c.get("locale"), `/admin/products/${p.id}?done=${mailed ? "1" : "mail_failed"}`), 303);
}

export function registerAdminProductRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/products", requireAdmin, async (c) => {
    const q = c.req.query("status");
    const status = isProductStatus(q) ? q : "in_review";
    const items = await listProductsByStatus(c.env.DB, status);
    return page(c, <ProductsQueuePage locale={c.get("locale")} origin={requestOrigin(c)} status={status} items={items} />);
  });

  onLocalized(app, "get", "/admin/products/:id", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    if (!item) return errorResponse(c, "notFound", 404);
    return productDetail(c, item, noticeFrom(c.req.query("done")));
  });

  for (const action of ["approve", "request_changes", "suspend", "unsuspend"] as const) {
    onLocalized(app, "post", `/admin/products/:id/${action}`, requireAdmin, (c) => decideProduct(c, action));
  }
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerAdminProductRoutes(app);` sau `registerAdminRoutes(app);`.

- [ ] **Step 6: Key i18n**

`en.ts`:

```ts
  "admin.nav.products": "Products",
  "admin.products.empty": "No products with this status.",
  "admin.products.updated": "Last change",
  "admin.products.badges": "Badges",
  "admin.products.note": "Note for the builder (required)",
  "admin.products.requestChanges": "Request changes",
  "admin.products.error.note": "Enter a note (up to 1000 characters).",
  "admin.products.mailFailed": "Saved, but the email to the builder couldn't be sent.",
  "badge.listed": "Listed",
  "badge.demo_verified": "Demo verified",
  "badge.in_production": "In production",
  "email.productApproved.subject": "Your product on VNX.SI is approved",
  "email.productApproved.body": "Good news: {name} has been approved and is now public:",
  "email.productApproved.cta": "Manage your products in Builder Hub:",
  "email.productChanges.subject": "Changes needed on your VNX.SI product",
  "email.productChanges.body": "An admin reviewed {name} and asked for these changes:",
  "email.productChanges.cta": "Edit the product and submit it again:",
```

`vi.ts`:

```ts
  "admin.nav.products": "Sản phẩm",
  "admin.products.empty": "Không có sản phẩm nào ở trạng thái này.",
  "admin.products.updated": "Thay đổi gần nhất",
  "admin.products.badges": "Huy hiệu",
  "admin.products.note": "Ghi chú cho builder (bắt buộc)",
  "admin.products.requestChanges": "Yêu cầu chỉnh sửa",
  "admin.products.error.note": "Nhập ghi chú (tối đa 1000 ký tự).",
  "admin.products.mailFailed": "Đã lưu, nhưng chưa gửi được email cho builder.",
  "badge.listed": "Listed",
  "badge.demo_verified": "Demo verified",
  "badge.in_production": "In production",
  "email.productApproved.subject": "Sản phẩm của bạn trên VNX.SI đã được duyệt",
  "email.productApproved.body": "Tin vui: {name} đã được duyệt và đang công khai tại:",
  "email.productApproved.cta": "Quản lý sản phẩm trong Builder Hub:",
  "email.productChanges.subject": "Sản phẩm của bạn trên VNX.SI cần chỉnh sửa",
  "email.productChanges.body": "Admin đã xem {name} và yêu cầu chỉnh sửa như sau:",
  "email.productChanges.cta": "Sửa sản phẩm và gửi duyệt lại:",
```

`zh-hans.ts`:

```ts
  "admin.nav.products": "产品",
  "admin.products.empty": "没有此状态的产品。",
  "admin.products.updated": "最近修改",
  "admin.products.badges": "徽章",
  "admin.products.note": "给 Builder 的备注（必填）",
  "admin.products.requestChanges": "要求修改",
  "admin.products.error.note": "请输入备注（最多 1000 个字符）。",
  "admin.products.mailFailed": "已保存，但未能发送邮件给 Builder。",
  "badge.listed": "Listed",
  "badge.demo_verified": "Demo verified",
  "badge.in_production": "In production",
  "email.productApproved.subject": "你在 VNX.SI 的产品已通过审核",
  "email.productApproved.body": "好消息：{name} 已通过审核，现已公开：",
  "email.productApproved.cta": "在 Builder 中心管理你的产品：",
  "email.productChanges.subject": "你在 VNX.SI 的产品需要修改",
  "email.productChanges.body": "管理员审核了 {name}，并要求进行以下修改：",
  "email.productChanges.cta": "修改产品后重新提交：",
```

`zh-hant.ts`:

```ts
  "admin.nav.products": "產品",
  "admin.products.empty": "沒有此狀態的產品。",
  "admin.products.updated": "最近修改",
  "admin.products.badges": "徽章",
  "admin.products.note": "給 Builder 的備註（必填）",
  "admin.products.requestChanges": "要求修改",
  "admin.products.error.note": "請輸入備註（最多 1000 個字元）。",
  "admin.products.mailFailed": "已儲存，但未能寄送郵件給 Builder。",
  "badge.listed": "Listed",
  "badge.demo_verified": "Demo verified",
  "badge.in_production": "In production",
  "email.productApproved.subject": "你在 VNX.SI 的產品已通過審核",
  "email.productApproved.body": "好消息：{name} 已通過審核，現已公開：",
  "email.productApproved.cta": "在 Builder 中心管理你的產品：",
  "email.productChanges.subject": "你在 VNX.SI 的產品需要修改",
  "email.productChanges.body": "管理員審核了 {name}，並要求進行以下修改：",
  "email.productChanges.cta": "修改產品後重新送審：",
```

(Tên 3 huy hiệu giữ tiếng Anh ở mọi locale vì là tên thương hiệu của trust layer, giống prototype.)

- [ ] **Step 7: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): admin product review queue with listed badge and decision e-mails" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: VNX-0305b — Huy hiệu và mục "Mới chỉnh sửa"

**Files:**
- Modify: `apps/web/src/db/products.ts` (`listRecentlyEdited`), `apps/web/src/routes/admin-products.tsx` (route huy hiệu, `?view=edited`), `apps/web/src/views/admin/ProductsQueuePage.tsx` (tab mới sửa), `apps/web/src/views/admin/ProductDetailPage.tsx` (form huy hiệu), 4 file locale
- Test: `apps/web/test/admin/badges.test.ts`

**Interfaces:**
- Consumes: Task 1 (`grantBadge`, `revokeBadge`, `RECENTLY_EDITED_DAYS`), Task 6 (`productDetail`, `findProductWithBuilder`, `ProductDetailPage`, `ProductsQueuePage`, `BADGE_KEY`).
- Produces:
  - `listRecentlyEdited(db, since: string, limit = 200): Promise<ProductWithBuilder[]>`: product `published` có `edited_after_publish_at >= since`, mới nhất trước.
  - Route: `POST /admin/products/:id/badges` (field `kind` ∈ `demo_verified | in_production`, `evidence` 1–500), `POST /admin/products/:id/badges/:kind/revoke` (field `reason` 1–300); `GET /admin/products?view=edited`. Audit `badge.grant`, `badge.revoke`.
  - `productDetail(c, item, notice, status?, noteError?, badgeError?)` với `badgeError: "kind" | "evidence" | "reason" | null`.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/admin/badges.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const admin = () => signIn("owner@vnx.si", { admin: true });
const post = (path: string, cookie: string, body: Record<string, string> = {}) => createApp().request(formPost(path, body, { cookie }), undefined, testEnv);
const kinds = async (id: string) => (await listActiveBadges(testEnv.DB, id)).map((b) => b.kind).sort();

describe("admin badges (spec §5.5, §7.2)", () => {
  it("grants Demo verified with evidence, once", async () => {
    const { product } = await makeReadyProduct("bd-grant@vnx.si", "bd-grant", "Grant Kit");
    await publishProduct(product.id);
    const { user, cookie } = await admin();
    const res = await post(`/admin/products/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Booked a slot on the demo" });
    expect(res.headers.get("location")).toBe(`/admin/products/${product.id}?done=1`);
    const badges = await listActiveBadges(testEnv.DB, product.id);
    expect(badges.find((b) => b.kind === "demo_verified")).toMatchObject({ verifiedBy: user.id, evidence: "Booked a slot on the demo" });
    expect((await post(`/admin/products/${product.id}/badges`, cookie, { kind: "demo_verified", evidence: "Again" })).status).toBe(409);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'badge.grant' AND entity_id = ?1").bind(product.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("requires evidence and a grantable kind (400)", async () => {
    const { product } = await makeReadyProduct("bd-bad@vnx.si", "bd-bad", "Bad Badge Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    const noEvidence = await post(`/admin/products/${product.id}/badges`, cookie, { kind: "in_production", evidence: " " });
    expect(noEvidence.status).toBe(400);
    expect(await noEvidence.text()).toContain("Describe the evidence (up to 500 characters).");
    expect((await post(`/admin/products/${product.id}/badges`, cookie, { kind: "listed", evidence: "x" })).status).toBe(400);
    expect(await kinds(product.id)).toEqual(["listed"]);
  });

  it("revokes with a reason", async () => {
    const { product } = await makeReadyProduct("bd-revoke@vnx.si", "bd-revoke", "Revoke Kit");
    await publishProduct(product.id);
    const { cookie } = await admin();
    await post(`/admin/products/${product.id}/badges`, cookie, { kind: "in_production", evidence: "Live at a client" });
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "" })).status).toBe(400);
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "Client stopped using it" })).status).toBe(303);
    expect(await kinds(product.id)).toEqual(["listed"]);
    expect((await post(`/admin/products/${product.id}/badges/in_production/revoke`, cookie, { reason: "Again" })).status).toBe(409);
  });

  it("loses Demo verified when the builder changes the demo URL (M3 exit gate)", async () => {
    const { product } = await makeReadyProduct("bd-demo@vnx.si", "bd-demo", "Demo Gate Kit");
    await publishProduct(product.id);
    const { cookie: adminCookie } = await admin();
    await post(`/admin/products/${product.id}/badges`, adminCookie, { kind: "demo_verified", evidence: "Tried it" });
    const { cookie } = await signIn("bd-demo@vnx.si");
    await post(`/hub/products/${product.id}/edit/demo`, cookie, { demoUrl: "https://new-demo.example", websiteUrl: "" });
    expect(await kinds(product.id)).toEqual(["listed"]);
    const detail = await (await createApp().request(getReq(`/admin/products/${product.id}`, adminCookie), undefined, testEnv)).text();
    expect(detail).not.toContain("Demo verified ·");
  });
});

describe("recently edited products (spec §5.5)", () => {
  it("lists published products edited in the last 14 days", async () => {
    const fresh = await makeReadyProduct("bd-fresh@vnx.si", "bd-fresh", "Fresh Edit Kit");
    await publishProduct(fresh.product.id);
    const old = await makeReadyProduct("bd-old@vnx.si", "bd-old", "Old Edit Kit");
    await publishProduct(old.product.id);
    const draft = await makeReadyProduct("bd-draft@vnx.si", "bd-draft", "Draft Edit Kit");

    const builder = await signIn("bd-fresh@vnx.si");
    await post(`/hub/products/${fresh.product.id}/edit/problem`, builder.cookie, { problem: "Updated problem" });
    const longAgo = new Date(Date.now() - 15 * 86_400_000).toISOString();
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(old.product.id, longAgo).run();
    // A draft is never "recently edited", even with the flag set.
    await testEnv.DB.prepare("UPDATE products SET edited_after_publish_at = ?2 WHERE id = ?1").bind(draft.product.id, new Date().toISOString()).run();

    const { cookie } = await admin();
    const html = await (await createApp().request(getReq("/admin/products?view=edited", cookie), undefined, testEnv)).text();
    expect(html).toContain("Fresh Edit Kit");
    expect(html).not.toContain("Old Edit Kit");
    expect(html).not.toContain("Draft Edit Kit");
  });
});
```

Run: `npm test -w apps/web -- test/admin/badges.test.ts`
Expected: FAIL.

- [ ] **Step 2: DB**

Thêm vào `apps/web/src/db/products.ts`:

```ts
/** Spec §5.5 "Mới chỉnh sửa": published products edited since `since`, newest edit first. */
export async function listRecentlyEdited(db: D1Database, since: string, limit = 200): Promise<ProductWithBuilder[]> {
  const { results } = await db
    .prepare(`${WITH_BUILDER} WHERE p.status = 'published' AND p.edited_after_publish_at >= ?1 ORDER BY p.edited_after_publish_at DESC, p.id LIMIT ?2`)
    .bind(since, limit)
    .all<WithBuilderRow>();
  return results.map(toWithBuilder);
}
```

- [ ] **Step 3: Route**

Trong `apps/web/src/routes/admin-products.tsx`:
- Import `listRecentlyEdited`, `revokeBadge`, `RECENTLY_EDITED_DAYS`, type `BadgeKind`.
- Mở rộng `productDetail` thêm tham số cuối `badgeError: BadgeError | null = null` (`export type BadgeError = "kind" | "evidence" | "reason"`) và truyền xuống `ProductDetailPage`.
- Trong `GET /admin/products`: nếu `c.req.query("view") === "edited"` thì nạp `listRecentlyEdited(c.env.DB, new Date(Date.now() - RECENTLY_EDITED_DAYS * 86_400_000).toISOString())` và render `ProductsQueuePage` với `view="edited"` (prop mới); ngược lại như cũ với `view="status"`.
- Thêm route:

```tsx
const GRANTABLE = new Set<BadgeKind>(["demo_verified", "in_production"]);
const Evidence = z.string().trim().min(1).max(500);
const Reason = z.string().trim().min(1).max(300);

  onLocalized(app, "post", "/admin/products/:id/badges", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    if (!item || item.product.status === "archived") return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const kind = body.kind as BadgeKind;
    if (!GRANTABLE.has(kind)) return productDetail(c, item, null, 400, undefined, "kind");
    const evidence = Evidence.safeParse(normalizeNewlines(typeof body.evidence === "string" ? body.evidence : ""));
    if (!evidence.success) return productDetail(c, item, null, 400, undefined, "evidence");
    const now = new Date().toISOString();
    const admin = c.get("user")!;
    if (!(await grantBadge(c.env.DB, { productId: item.product.id, kind, verifiedBy: admin.id, evidence: evidence.data, now }))) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: admin.id, action: "badge.grant", entity: "product", entityId: item.product.id, data: { kind, evidence: evidence.data }, now });
    return c.redirect(localizedPath(c.get("locale"), `/admin/products/${item.product.id}?done=1`), 303);
  });

  onLocalized(app, "post", "/admin/products/:id/badges/:kind/revoke", requireAdmin, async (c) => {
    const item = await findProductWithBuilder(c.env.DB, c.req.param("id") ?? "");
    const kind = c.req.param("kind") as BadgeKind;
    if (!item || !GRANTABLE.has(kind)) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const reason = Reason.safeParse(normalizeNewlines(typeof body.reason === "string" ? body.reason : ""));
    if (!reason.success) return productDetail(c, item, null, 400, undefined, "reason");
    const now = new Date().toISOString();
    if (!(await revokeBadge(c.env.DB, { productId: item.product.id, kind, reason: reason.data, now }))) return errorResponse(c, "conflict", 409);
    await writeAudit(c.env.DB, { actorUserId: c.get("user")!.id, action: "badge.revoke", entity: "product", entityId: item.product.id, data: { kind, reason: reason.data }, now });
    return c.redirect(localizedPath(c.get("locale"), `/admin/products/${item.product.id}?done=1`), 303);
  });
```

- [ ] **Step 4: View**

`apps/web/src/views/admin/ProductsQueuePage.tsx`: thêm prop `view: "status" | "edited"`; trong `nav.subnav` thêm cuối một link `localizedPath(locale, "/admin/products?view=edited")` với nhãn `admin.products.edited` và `aria-current="page"` khi `view === "edited"` (khi đó không link trạng thái nào được đánh dấu). Khi `view === "edited"`, tiêu đề cột cuối là `admin.products.editedAt` và giá trị là `item.product.editedAfterPublishAt?.slice(0, 10)`.

`apps/web/src/views/admin/ProductDetailPage.tsx`: thêm prop `badgeError: "kind" | "evidence" | "reason" | null`; thay khối danh sách huy hiệu bằng:

```tsx
<h2>{tr("admin.products.badges")}</h2>
<ul>
  {badges.map((b) => (
    <li>
      {tr(BADGE_KEY[b.kind])} · {b.verifiedAt.slice(0, 10)}
      {b.evidence ? ` · ${b.evidence}` : ""}
      {b.kind !== "listed" ? (
        <form method="post" action={localizedPath(locale, `/admin/products/${p.id}/badges/${b.kind}/revoke`)} class="row-actions">
          <label for={`revoke-${b.kind}`}>{tr("admin.badges.reason")}</label>
          <input id={`revoke-${b.kind}`} name="reason" maxlength={300} required />
          <button class="link" type="submit">
            {tr("admin.badges.revoke")}
          </button>
        </form>
      ) : null}
    </li>
  ))}
</ul>
{badgeError === "reason" ? (
  <p class="error-msg" role="alert">
    {tr("admin.badges.error.reason")}
  </p>
) : null}
{p.status !== "archived" ? (
  <form method="post" action={localizedPath(locale, `/admin/products/${p.id}/badges`)} class="card">
    <div class="field">
      <label for="badge-kind">{tr("admin.badges.kind")}</label>
      <select id="badge-kind" name="kind" aria-invalid={badgeError === "kind" ? "true" : undefined}>
        {(["demo_verified", "in_production"] as const)
          .filter((k) => !badges.some((b) => b.kind === k))
          .map((k) => (
            <option value={k}>{tr(BADGE_KEY[k])}</option>
          ))}
      </select>
      {badgeError === "kind" ? <p class="error-msg">{tr("admin.badges.error.kind")}</p> : null}
    </div>
    <div class="field">
      <label for="badge-evidence">{tr("admin.badges.evidence")}</label>
      <textarea
        id="badge-evidence"
        name="evidence"
        maxlength={500}
        required
        aria-invalid={badgeError === "evidence" ? "true" : undefined}
        aria-describedby={badgeError === "evidence" ? "badge-evidence-error" : undefined}
      ></textarea>
      {badgeError === "evidence" ? (
        <p id="badge-evidence-error" class="error-msg">
          {tr("admin.badges.error.evidence")}
        </p>
      ) : null}
    </div>
    <button class="btn" type="submit">
      {tr("admin.badges.grant")}
    </button>
  </form>
) : null}
```

- [ ] **Step 5: Key i18n**

`en.ts`:

```ts
  "admin.products.edited": "Recently edited",
  "admin.products.editedAt": "Edited",
  "admin.badges.grant": "Add badge",
  "admin.badges.kind": "Badge",
  "admin.badges.evidence": "Evidence (what you checked)",
  "admin.badges.revoke": "Revoke",
  "admin.badges.reason": "Reason",
  "admin.badges.error.kind": "Choose a badge.",
  "admin.badges.error.evidence": "Describe the evidence (up to 500 characters).",
  "admin.badges.error.reason": "Enter a reason (up to 300 characters).",
```

`vi.ts`:

```ts
  "admin.products.edited": "Mới chỉnh sửa",
  "admin.products.editedAt": "Ngày sửa",
  "admin.badges.grant": "Gắn huy hiệu",
  "admin.badges.kind": "Huy hiệu",
  "admin.badges.evidence": "Bằng chứng (bạn đã kiểm tra gì)",
  "admin.badges.revoke": "Thu hồi",
  "admin.badges.reason": "Lý do",
  "admin.badges.error.kind": "Chọn một huy hiệu.",
  "admin.badges.error.evidence": "Mô tả bằng chứng (tối đa 500 ký tự).",
  "admin.badges.error.reason": "Nhập lý do (tối đa 300 ký tự).",
```

`zh-hans.ts`:

```ts
  "admin.products.edited": "最近修改",
  "admin.products.editedAt": "修改日期",
  "admin.badges.grant": "添加徽章",
  "admin.badges.kind": "徽章",
  "admin.badges.evidence": "证据（你检查了什么）",
  "admin.badges.revoke": "撤销",
  "admin.badges.reason": "原因",
  "admin.badges.error.kind": "请选择徽章。",
  "admin.badges.error.evidence": "请描述证据（最多 500 个字符）。",
  "admin.badges.error.reason": "请输入原因（最多 300 个字符）。",
```

`zh-hant.ts`:

```ts
  "admin.products.edited": "最近修改",
  "admin.products.editedAt": "修改日期",
  "admin.badges.grant": "新增徽章",
  "admin.badges.kind": "徽章",
  "admin.badges.evidence": "證據（你檢查了什麼）",
  "admin.badges.revoke": "撤銷",
  "admin.badges.reason": "原因",
  "admin.badges.error.kind": "請選擇徽章。",
  "admin.badges.error.evidence": "請描述證據（最多 500 個字元）。",
  "admin.badges.error.reason": "請輸入原因（最多 300 個字元）。",
```

- [ ] **Step 6: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test
git commit -m "feat(web): admin badges with evidence and the recently edited list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: VNX-0306 — Trang `/p/:slug`, Open Graph, JSON-LD

**Files:**
- Create: `apps/web/src/views/json-ld.ts`, `apps/web/src/views/ProductPage.tsx`, `apps/web/src/routes/product-page.tsx`
- Modify: `apps/web/src/db/products.ts` (`findPublicProductBySlug`, `listPublicProductsByBuilder`), `apps/web/src/views/Layout.tsx` (Open Graph, JSON-LD), `apps/web/src/routes/builder-profile.tsx` + `apps/web/src/views/BuilderProfilePage.tsx` (danh sách product), `apps/web/src/app.ts`, 4 file locale, `app.css`
- Test: `apps/web/test/views/json-ld.test.ts`, `apps/web/test/public/product-page.test.ts`

**Interfaces:**
- Consumes: Task 1–7 (`SLUG_RE`, `listTiers`, `listMedia`, `listActiveBadges`, `BADGE_KEY`, labels, fixtures `makeReadyProduct`, `publishProduct`), M2 (`formatUsd`, `PlainText`, `findPublicBuilderByHandle`).
- Produces:
  - `findPublicProductBySlug(db, slug): Promise<ProductWithBuilder | null>` (product `published`, builder `approved`, user `active`); `listPublicProductsByBuilder(db, builderId): Promise<Product[]>` (cùng điều kiện, mới publish nhất trước).
  - `jsonLdScript(data: unknown)`: thẻ `<script type="application/ld+json">` an toàn; `productJsonLd(...)` dựng object `SoftwareApplication`.
  - `Layout` nhận thêm `ogImage?: string`, `jsonLd?: unknown`; luôn render `og:title`, `og:type`, `og:url` (và `og:description` khi có `description`).
  - Route `GET /p/:slug` (4 locale).

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/views/json-ld.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { jsonLdScript } from "../../src/views/json-ld.ts";

describe("jsonLdScript", () => {
  it("cannot be closed early by user data and still parses back to the same value", () => {
    const data = { name: "</script><script>alert(1)</script>", note: "a & b > c    " };
    const html = String(jsonLdScript(data));
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.endsWith("</script>")).toBe(true);
    const inner = html.slice('<script type="application/ld+json">'.length, -"</script>".length);
    expect(inner).not.toMatch(/[<>&  ]/);
    expect(JSON.parse(inner)).toEqual(data);
  });
});
```

`apps/web/test/public/product-page.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { findProductById, setProductStatus, updateProductFields } from "../../src/db/products.ts";
import { makeBuilder, makeReadyProduct, publishProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "null");

describe("/p/:slug (spec §5.2, §8.8)", () => {
  it("renders a published product with pricing, badges, builder card, SEO tags and JSON-LD", async () => {
    const { product } = await makeReadyProduct("pp-full@vnx.si", "pp-full", "Spa Booking Pro");
    const live = await publishProduct(product.id);
    const res = await get(`/p/${live.slug}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Spa Booking Pro", "Spa Booking Pro in one line", "Bookings get lost", "Spa owners", "Calendar", "$19", "Monthly", "Contact for price", "Email within 48h", "Listed"]) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain('href="/b/pp-full"');
    expect(html).toMatch(/<a href="https:\/\/demo\.example" rel="nofollow ugc noopener"/);
    expect(html).toContain(`src="/media/products/${product.id}/01J0000000000000000000000C.png"`);
    expect(html).toContain(`<link rel="canonical" href="https://vnx.si/p/${live.slug}"`);
    expect(html).toContain(`hreflang="vi" href="https://vnx.si/vi/p/${live.slug}"`);
    expect(html).toContain(`<meta property="og:image" content="https://vnx.si/media/products/${product.id}/01J0000000000000000000000C.png"`);
    expect(html).toContain('<meta property="og:title" content="Spa Booking Pro');
    expect(html).not.toContain('name="robots"');
    expect(jsonLd(html)).toEqual({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Spa Booking Pro",
      description: "Spa Booking Pro in one line",
      url: `https://vnx.si/p/${live.slug}`,
      applicationCategory: "BusinessApplication",
      image: `https://vnx.si/media/products/${product.id}/01J0000000000000000000000C.png`,
      offers: [{ "@type": "Offer", name: "Starter", price: "19.00", priceCurrency: "USD" }],
    });
  });

  it("keeps hostile names inside the JSON-LD and escaped in HTML", async () => {
    const { builder, product } = await makeReadyProduct("pp-xss@vnx.si", "pp-xss", "Safe Kit");
    const evil = "</script><script>alert(1)</script>";
    await updateProductFields(testEnv.DB, { productId: product.id, builderId: builder.userId, expectedStatus: "draft", fields: { name: evil }, now: new Date().toISOString(), markEdited: false });
    const live = await publishProduct(product.id);
    const html = await (await get(`/p/${live.slug}`)).text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(jsonLd(html).name).toBe(evil);
  });

  it("shows license for source products and customization only when offered", async () => {
    const { builder, product } = await makeReadyProduct("pp-src@vnx.si", "pp-src", "Source Pro", { deliveryModel: "source" });
    await updateProductFields(testEnv.DB, { productId: product.id, builderId: builder.userId, expectedStatus: "draft", fields: { license: "extended", customizable: true, customizationNotes: "Branding and colors" }, now: new Date().toISOString(), markEdited: false });
    const live = await publishProduct(product.id);
    const html = await (await get(`/vi/p/${live.slug}`)).text();
    expect(html).toContain("Mở rộng");
    expect(html).toContain("Branding and colors");
    expect(html).toContain("Đặt lịch");

    const plain = await makeReadyProduct("pp-plain@vnx.si", "pp-plain", "Plain Pro");
    const plainLive = await publishProduct(plain.product.id);
    expect(await (await get(`/p/${plainLive.slug}`)).text()).not.toContain("Customization");
  });

  it.each(["draft", "in_review", "unlisted", "suspended", "archived"] as const)("404s for a %s product", async (status) => {
    const { product } = await makeReadyProduct(`pp-${status}@vnx.si`, `pp-${status}`, `Hidden ${status}`);
    const now = new Date().toISOString();
    if (status !== "draft") await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    if (status === "unlisted" || status === "suspended") {
      await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
      await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: status, reviewNote: null, now });
    }
    if (status === "archived") await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "archived", reviewNote: null, now });
    expect((await get(`/p/${product.slug}`)).status).toBe(404);
  });

  it("404s when the builder or the account is suspended", async () => {
    const a = await makeReadyProduct("pp-bsusp@vnx.si", "pp-bsusp", "Builder Susp");
    const aLive = await publishProduct(a.product.id);
    await setBuilderStatus(testEnv.DB, { userId: a.builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    expect((await get(`/p/${aLive.slug}`)).status).toBe(404);

    const b = await makeReadyProduct("pp-ususp@vnx.si", "pp-ususp", "User Susp");
    const bLive = await publishProduct(b.product.id);
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(b.builder.userId).run();
    expect((await get(`/p/${bLive.slug}`)).status).toBe(404);
  });

  it("redirects upper-case slugs and 404s on unknown ones", async () => {
    const { product } = await makeReadyProduct("pp-case@vnx.si", "pp-case", "Case Pro");
    const live = await publishProduct(product.id);
    const res = await get(`/vi/p/${live.slug.toUpperCase()}`);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/vi/p/${live.slug}`);
    expect((await get("/p/no-such-product")).status).toBe(404);
    expect((await get("/p/ab")).status).toBe(404);
  });

  it("lists published products on the builder profile", async () => {
    const { product } = await makeReadyProduct("pp-profile@vnx.si", "pp-profile", "Profile Pro");
    const live = await publishProduct(product.id);
    const html = await (await get("/b/pp-profile")).text();
    expect(html).toContain(`href="/p/${live.slug}"`);
    expect(html).toContain("Profile Pro in one line");
  });
});

describe("M3 exit gate: draft → in_review → published at /p/:slug", () => {
  it("goes all the way through HTTP", async () => {
    await makeBuilder("gate3@vnx.si", "gate3", "approved");
    const { cookie } = await signIn("gate3@vnx.si");
    const app = createApp();
    const send = (path: string, body: Record<string, string>, c = cookie) => app.request(formPost(path, body, { cookie: c }), undefined, testEnv);

    const created = await send("/hub/products", { name: "Gate Three Kit" });
    const id = /\/hub\/products\/([0-9A-Z]{26})\//.exec(created.headers.get("location") ?? "")![1]!;
    await send(`/hub/products/${id}/edit/product`, { name: "Gate Three Kit", slug: "gate-three-kit", tagline: "Gate tagline", category: "crm", deliveryModel: "saas", primaryLang: "en", tags: "", description: "Desc" });
    await send(`/hub/products/${id}/edit/problem`, { problem: "Problem" });
    await send(`/hub/products/${id}/edit/audience`, { targetUsers: "Teams" });
    await send(`/hub/products/${id}/edit/features`, { features: "One", techStack: "" });
    await send(`/hub/products/${id}/edit/support`, { supportPolicy: "Email" });
    await send(`/hub/products/${id}/edit/pricing`, { "tiers[0].name": "Basic", "tiers[0].billing": "one_time", "tiers[0].price": "49" });
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], "cover.png", { type: "image/png" }));
    form.append("alt", "Cover");
    await app.request(new Request(`https://vnx.si/hub/products/${id}/media`, { method: "POST", headers: { origin: "https://vnx.si", cookie }, body: form }), undefined, testEnv);
    expect((await send(`/hub/products/${id}/submit`, {})).status).toBe(303);

    const admin = await signIn("owner@vnx.si", { admin: true });
    expect((await send(`/admin/products/${id}/approve`, {}, admin.cookie)).status).toBe(303);
    expect((await findProductById(testEnv.DB, id))?.status).toBe("published");
    const page = await app.request(getReq("/p/gate-three-kit"), undefined, testEnv);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Gate tagline");
    expect(html).toContain("Listed");
  });
});
```

Run: `npm test -w apps/web -- test/views/json-ld.test.ts test/public/product-page.test.ts`
Expected: FAIL.

- [ ] **Step 2: DB**

Thêm vào `apps/web/src/db/products.ts`:

```ts
const PUBLIC = "p.status = 'published' AND b.status = 'approved' AND u.status = 'active'";

/** Spec §7.2: only published products of approved builders on active accounts are public. */
export async function findPublicProductBySlug(db: D1Database, slug: string): Promise<ProductWithBuilder | null> {
  const row = await db.prepare(`${WITH_BUILDER} WHERE p.slug = ?1 AND ${PUBLIC}`).bind(slug).first<WithBuilderRow>();
  return row ? toWithBuilder(row) : null;
}

export async function listPublicProductsByBuilder(db: D1Database, builderId: string): Promise<Product[]> {
  const { results } = await db.prepare(`${WITH_BUILDER} WHERE p.builder_id = ?1 AND ${PUBLIC} ORDER BY p.published_at DESC, p.id`).bind(builderId).all<WithBuilderRow>();
  return results.map(toProduct);
}
```

- [ ] **Step 3: JSON-LD và Layout**

`apps/web/src/views/json-ld.ts`:

```ts
import { raw } from "hono/html";
import type { PricingTier, Product } from "../domain/product.ts";

const UNSAFE: Record<string, string> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", " ": "\\u2028", " ": "\\u2029" };

/**
 * The only raw insertion of user content (plan M3 Global Constraints): JSON is escaped so that no character can
 * close the script element or break the line, and JSON.parse returns the original value.
 */
export function jsonLdScript(data: unknown) {
  const json = JSON.stringify(data).replace(/[<>&  ]/g, (ch) => UNSAFE[ch] ?? ch);
  return raw(`<script type="application/ld+json">${json}</script>`);
}

/** schema.org SoftwareApplication (spec §8.8): offers only for tiers with a price; no aggregateRating. */
export function productJsonLd(input: { product: Product; tiers: PricingTier[]; url: string; image: string | null }) {
  const offers = input.tiers
    .filter((t) => t.priceCents !== null)
    .map((t) => ({ "@type": "Offer", name: t.name, price: (t.priceCents! / 100).toFixed(2), priceCurrency: "USD" }));
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.product.name,
    description: input.product.tagline,
    url: input.url,
    applicationCategory: "BusinessApplication",
    ...(input.image ? { image: input.image } : {}),
    ...(offers.length > 0 ? { offers } : {}),
  };
}
```

`apps/web/src/views/Layout.tsx`:
- `LayoutProps` thêm `ogImage?: string; jsonLd?: unknown;`.
- Trong `<head>`, ngay sau thẻ `<link rel="canonical" …/>`:

```tsx
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:url" content={origin + localizedPath(locale, rest)} />
{description ? <meta property="og:description" content={description} /> : null}
{ogImage ? <meta property="og:image" content={ogImage} /> : null}
{jsonLd ? jsonLdScript(jsonLd) : null}
```

(import `jsonLdScript` từ `./json-ld.ts`.)

- [ ] **Step 4: Trang product**

`apps/web/src/views/ProductPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { Badge, PricingTier, ProductMedia, ProductWithBuilder } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BADGE_KEY } from "./admin/ProductDetailPage.tsx";
import { formatUsd } from "./format.ts";
import { BILLING_KEY, CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

const EXTERNAL = "nofollow ugc noopener";

type Props = {
  locale: Locale;
  origin: string;
  item: ProductWithBuilder;
  tiers: PricingTier[];
  media: ProductMedia[];
  badges: Badge[];
  jsonLd: unknown;
  signedIn: boolean;
};

/** Spec §5.2. The Buy / Customize / Hire / Build Similar buttons arrive with the Inquiry form in M5. */
export const ProductPage: FC<Props> = ({ locale, origin, item, tiers, media, badges, jsonLd, signedIn }) => {
  const tr = translator(locale);
  const p = item.product;
  const cover = media[0] ? `${origin}/media/${media[0].r2Key}` : undefined;
  return (
    <Layout locale={locale} title={`${p.name} · VNX.SI`} description={p.tagline} origin={origin} rest={`/p/${p.slug}`} signedIn={signedIn} ogImage={cover} jsonLd={jsonLd}>
      <article class="product">
        <header>
          <p class="muted">
            {p.category ? tr(CATEGORY_KEY[p.category]) : null}
            {p.deliveryModel ? ` · ${tr(DELIVERY_KEY[p.deliveryModel])}` : null}
          </p>
          <h1>{p.name}</h1>
          <p class="lead">{p.tagline}</p>
          {badges.length > 0 ? (
            <ul class="chips">
              {badges.map((b) => (
                <li>
                  {tr(BADGE_KEY[b.kind])} <span class="muted">{tr("productPage.verifiedOn", { date: b.verifiedAt.slice(0, 10) })}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p class="row-actions">
            {p.demoUrl ? (
              <a class="btn" href={p.demoUrl} rel={EXTERNAL} target="_blank">
                {tr("productPage.demo")}
              </a>
            ) : null}
            {p.websiteUrl ? (
              <a href={p.websiteUrl} rel={EXTERNAL} target="_blank">
                {tr("productPage.website")}
              </a>
            ) : null}
          </p>
        </header>

        {media.length > 0 ? (
          <ul class="gallery">
            {media.map((m) => (
              <li>
                <img src={`/media/${m.r2Key}`} alt={m.alt || p.name} loading="lazy" />
              </li>
            ))}
          </ul>
        ) : null}

        <section>
          <h2>{tr("productPage.problem")}</h2>
          <PlainText text={p.problem} />
          <h2>{tr("productPage.audience")}</h2>
          <PlainText text={p.targetUsers} />
          <PlainText text={p.description} />
        </section>

        <section>
          <h2>{tr("productPage.features")}</h2>
          <ul>
            {p.features.map((f) => (
              <li>{f}</li>
            ))}
          </ul>
          {p.techStack.length > 0 ? (
            <>
              <h3>{tr("productPage.techStack")}</h3>
              <ul class="chips">
                {p.techStack.map((t) => (
                  <li>{t}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section>
          <h2>{tr("productPage.pricing")}</h2>
          <ul class="tiers">
            {tiers.map((t) => (
              <li>
                <h3>{t.name}</h3>
                <p class="price">{t.priceCents === null ? tr(BILLING_KEY.contact) : `${formatUsd(locale, t.priceCents)} · ${tr(BILLING_KEY[t.billing])}`}</p>
                {t.description ? <p>{t.description}</p> : null}
              </li>
            ))}
          </ul>
          {p.license ? (
            <p>
              {tr("productPage.license")}: {tr(LICENSE_KEY[p.license])}
            </p>
          ) : null}
        </section>

        {p.customizable ? (
          <section>
            <h2>{tr("productPage.customization")}</h2>
            <PlainText text={p.customizationNotes} />
          </section>
        ) : null}

        <section>
          <h2>{tr("productPage.support")}</h2>
          <PlainText text={p.supportPolicy} />
        </section>

        <aside class="card">
          <p class="muted">{tr("productPage.builder")}</p>
          <p>
            <a href={localizedPath(locale, `/b/${item.builderHandle}`)}>{item.builderName}</a>
          </p>
        </aside>
      </article>
    </Layout>
  );
};
```

(`BADGE_KEY` đang nằm trong `views/admin/ProductDetailPage.tsx` từ Task 6; chuyển nó sang `views/labels.ts` và import từ đó ở cả hai trang.)

`apps/web/src/routes/product-page.tsx`:

```tsx
import type { Hono } from "hono";
import { listMedia } from "../db/media.ts";
import { listTiers } from "../db/pricing.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { listActiveBadges } from "../db/verifications.ts";
import { SLUG_RE } from "../domain/slug.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { errorResponse } from "../views/error-response.tsx";
import { productJsonLd } from "../views/json-ld.ts";
import { ProductPage } from "../views/ProductPage.tsx";
import { page } from "../views/render.ts";

export function registerProductPageRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/p/:slug", async (c) => {
    const raw = c.req.param("slug") ?? "";
    const slug = raw.toLowerCase();
    if (!SLUG_RE.test(slug)) return errorResponse(c, "notFound", 404);
    const locale = c.get("locale");
    if (raw !== slug) return c.redirect(localizedPath(locale, `/p/${slug}`), 301);
    const item = await findPublicProductBySlug(c.env.DB, slug);
    if (!item) return errorResponse(c, "notFound", 404);
    const [tiers, media, badges] = await Promise.all([listTiers(c.env.DB, item.product.id), listMedia(c.env.DB, item.product.id), listActiveBadges(c.env.DB, item.product.id)]);
    const origin = requestOrigin(c);
    const jsonLd = productJsonLd({ product: item.product, tiers, url: origin + localizedPath(locale, `/p/${slug}`), image: media[0] ? `${origin}/media/${media[0].r2Key}` : null });
    return page(c, <ProductPage locale={locale} origin={origin} item={item} tiers={tiers} media={media} badges={badges} jsonLd={jsonLd} signedIn={c.get("user") !== null} />);
  });
}
```

Trong `apps/web/src/app.ts`: import và gọi `registerProductPageRoutes(app);` sau `registerBuilderProfileRoutes(app);`.

- [ ] **Step 5: Product trên trang builder**

`apps/web/src/routes/builder-profile.tsx`: nạp thêm `listPublicProductsByBuilder(c.env.DB, builder.userId)` và truyền `products` cho `BuilderProfilePage`.

`apps/web/src/views/BuilderProfilePage.tsx`: thêm prop `products: Product[]`; sửa chú thích đầu component thành "The Hire button arrives with M5."; trước khối portfolio, render:

```tsx
{products.length > 0 ? (
  <section>
    <h2>{tr("bprofile.products")}</h2>
    <ul class="portfolio-list">
      {products.map((p) => (
        <li>
          <h3>
            <a href={localizedPath(locale, `/p/${p.slug}`)}>{p.name}</a>
          </h3>
          <p>{p.tagline}</p>
        </li>
      ))}
    </ul>
  </section>
) : null}
```

- [ ] **Step 6: Key i18n**

`en.ts`:

```ts
  "productPage.problem": "The problem",
  "productPage.audience": "Who it is for",
  "productPage.features": "Features",
  "productPage.techStack": "Built with",
  "productPage.pricing": "Pricing",
  "productPage.license": "License",
  "productPage.customization": "Customization",
  "productPage.support": "Support",
  "productPage.demo": "Try the demo",
  "productPage.website": "Website",
  "productPage.builder": "Built by",
  "productPage.verifiedOn": "since {date}",
  "bprofile.products": "Products",
```

`vi.ts`:

```ts
  "productPage.problem": "Vấn đề",
  "productPage.audience": "Dành cho ai",
  "productPage.features": "Tính năng",
  "productPage.techStack": "Xây bằng",
  "productPage.pricing": "Giá",
  "productPage.license": "License",
  "productPage.customization": "Tùy chỉnh",
  "productPage.support": "Hỗ trợ",
  "productPage.demo": "Dùng thử demo",
  "productPage.website": "Website",
  "productPage.builder": "Builder",
  "productPage.verifiedOn": "từ {date}",
  "bprofile.products": "Sản phẩm",
```

`zh-hans.ts`:

```ts
  "productPage.problem": "要解决的问题",
  "productPage.audience": "适合谁",
  "productPage.features": "功能",
  "productPage.techStack": "技术栈",
  "productPage.pricing": "价格",
  "productPage.license": "授权",
  "productPage.customization": "定制",
  "productPage.support": "支持",
  "productPage.demo": "试用演示",
  "productPage.website": "网站",
  "productPage.builder": "开发者",
  "productPage.verifiedOn": "自 {date}",
  "bprofile.products": "产品",
```

`zh-hant.ts`:

```ts
  "productPage.problem": "要解決的問題",
  "productPage.audience": "適合誰",
  "productPage.features": "功能",
  "productPage.techStack": "技術棧",
  "productPage.pricing": "價格",
  "productPage.license": "授權",
  "productPage.customization": "客製化",
  "productPage.support": "支援",
  "productPage.demo": "試用示範",
  "productPage.website": "網站",
  "productPage.builder": "開發者",
  "productPage.verifiedOn": "自 {date}",
  "bprofile.products": "產品",
```

- [ ] **Step 7: CSS, chạy toàn bộ, commit**

Thêm vào cuối `app.css`:

```css
.product { max-width: 960px; }
.gallery { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.gallery img { width: 100%; height: auto; border: 1px solid var(--line); border-radius: var(--radius); }
.tiers { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.tiers > li { border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; background: var(--surface); }
.tiers h3 { margin: 0 0 4px; }
.price { font-weight: 600; }
```

Run: `npm run typecheck -w apps/web && npm test`
Expected: PASS hết.

```bash
git add apps/web/src apps/web/test apps/web/public/assets/app.css
git commit -m "feat(web): public product page with Open Graph and JSON-LD" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Sau khi xong 8 task

- Review toàn nhánh (model mạnh nhất); xử lý phát hiện theo CLAUDE.md bước 8–10.
- Kiểm cổng ra M3 bằng lệnh:
  - Draft → in_review → published hiện ở `/p/:slug`: `npm test -w apps/web -- test/public/product-page.test.ts` (test "M3 exit gate").
  - Đổi demo URL thì mất Demo verified: `npm test -w apps/web -- test/admin/badges.test.ts` (test "M3 exit gate").
- Cập nhật `CURRENT-STATUS.md` (Reviewer): điều kiện deploy thêm bucket R2 và migration `0005_products`.
- VNX-0307: sau khi Owner bật R2, Claude chạy `npx wrangler r2 bucket create vnxsi-media` (trong `apps/web`).

## Ngoài phạm vi M3 (ghi lại để không làm lan)

- FTS5 và đồng bộ tìm kiếm, `/products`, sitemap (M4). Dù spec 7.2 ghi "đồng bộ FTS khi duyệt", bảng FTS chỉ tạo ở VNX-0401 cùng truy vấn tìm kiếm.
- 4 nút Buy / Customize / Hire / Build Similar và form Inquiry (M5); `/p/:slug/demo` đếm click, đếm lượt xem (M7).
- Sắp xếp lại ảnh, sửa alt sau khi upload, resize ảnh; ảnh portfolio (key `portfolio/…` có trong spec nhưng chưa dùng).
- Dịch nội dung product sang nhiều ngôn ngữ (spec mục 11).

