# VNX.SI M4 — Catalogue và danh bạ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Đọc `AGENTS.md` trước khi bắt đầu.

- **Trạng thái:** APPROVED bởi Owner 2026-10-04 (thực thi subagent-driven)
- **Roadmap:** `docs/roadmap/WAVE1-ROADMAP.md` → M4 (VNX-0401 … VNX-0404; VNX-0404 tách thành 0404a / 0404b)
- **Nhánh:** `feat/m4-catalogue` (tách từ `main` @ `921cf99`)

**Goal:** Client tìm và lọc product ở `/products` (FTS5 trigram, xếp hạng trung lập theo ADR-004), tìm builder ở `/builders`; toàn site có canonical / hreflang trên `APP_ORIGIN`, `sitemap.xml` và `robots.txt`.

**Architecture:**
- Giữ khung M1–M3: `domain/` thuần (đọc tham số GET, kế hoạch tìm kiếm, bảng điểm huy hiệu), `db/` chỉ truy vấn, `routes/` ghép, `views/` chỉ trình bày.
- `products_fts` (FTS5, `tokenize = 'trigram'`) chỉ chứa product `published`, được **trigger trong migration** giữ đồng bộ, nên mọi đường ghi (duyệt, ẩn, hiện lại, khóa, lưu trữ, sửa khi đang publish) đều được phủ mà không phải sửa từng route. Điều kiện công khai còn lại (builder `approved`, user `active`) áp ở câu truy vấn.
- Xếp hạng chỉ từ 3 đầu vào của spec 8.7: `bm25`, điểm huy hiệu (`BADGE_SCORE`), `published_at`. Không có tham số nào khác đi vào truy vấn (ADR-004), có test.
- URL tuyệt đối công khai (canonical, hreflang, og:image, JSON-LD, sitemap) lấy từ `APP_ORIGIN` qua `siteOrigin(c)`. Trang `noindex` không phát canonical / hreflang.

**Tech Stack:** như M1–M3 (Hono JSX, D1, Vitest trong workerd). Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-vnxsi-marketplace-wave1-design.md` mục 5.1 (hreflang), 5.2 (`/products`, `/builders`, `/sitemap.xml`, `/robots.txt`), 6.1 (`products_fts`), 7.1, 7.2 (chỉ product công khai mới vào catalogue, sitemap), 8.7, 8.8, 9. **ADR:** ADR-004 (xếp hạng không bán), ADR-003 (i18n).

## Quyết định của Owner (2026-10-04)

- **Lọc giá:** hai ô "Giá khởi điểm từ – đến (USD)". Giá khởi điểm = tier rẻ nhất **có giá** (`price_cents IS NOT NULL`), không phân biệt `billing` ($19/tháng và $19 một lần đều là $19). Product chỉ có tier `contact` bị loại khi một trong hai ô có giá trị.
- **Nút "Post a request":** chưa render ở M4 (trang `/request` thuộc M6). Ghi nghĩa vụ M6: thêm nút ở `/builders` và ở trạng thái rỗng của `/products`.
- **Tìm tiếng Việt không dấu** ("dat lich" tìm ra "đặt lịch"): chấp nhận không hỗ trợ ở Wave 1 (đã thử: trigram của D1 không khớp, tùy chọn `remove_diacritics` không giúp). Ghi vào "Ghi nhận".
- **Đã có từ trước (sau review M3):** `published_at` chỉ đặt khi admin duyệt; `robots.txt` có `Allow: /media/products/`.

## Đã kiểm trước khi viết plan (Reviewer, 2026-10-04)

Chạy thử trong workerd (Vitest pool, D1 local), file thử đã xóa:
- `CREATE VIRTUAL TABLE … USING fts5(…, tokenize = 'trigram')` chạy được; `bm25()` chạy được.
- Tiếng Việt có dấu khớp (`"đặt lịch"`), viết hoa có dấu cũng khớp (`"ĐẶT LỊCH"`); tiếng Trung 4 ký tự khớp; tiếng Trung **2 ký tự không khớp** qua FTS → cần `LIKE`.
- Đưa thẳng chuỗi người dùng vào `MATCH` gây lỗi (`foo AND` → `fts5: syntax error`) → bắt buộc bọc từng từ thành chuỗi FTS5.
- `CREATE TRIGGER … BEGIN …; …; END` qua `readD1Migrations` được tách đúng thành một câu; trigger ghi vào bảng FTS chạy được trong `db.batch`.
- `json_each` chạy được. `sqlite_version()` bị D1 chặn (đừng dùng).
- D1 dùng chung dữ liệu giữa các `it` trong **cùng một file test** → test xếp hạng phải khoanh dữ liệu bằng từ khóa riêng hoặc tổ hợp bộ lọc riêng, không đếm toàn bảng.

## Global Constraints

- Mọi ràng buộc của plan M0–M1, M2, M3 vẫn áp dụng (phiên bản pin, không thêm dependency, ranh giới module, Origin check, test sở hữu bảng, chuỗi giao diện qua `t()` có đủ 4 locale).
- Migration mới: `apps/web/migrations/0006_catalog.sql`, chỉ thêm. Không chạy migration remote, không deploy.
- `products_fts` chỉ được ghi bởi trigger trong migration. Không module nào trong `src/` ghi bảng này (test kiến trúc hiện có sẽ báo "unknown table" nếu có).
- **Công khai** = product `published` **và** builder `approved` **và** user `active` (một hằng `PUBLIC_PRODUCT` duy nhất trong `db/products.ts`). Builder công khai = builder `approved` **và** user `active`.
- **Tìm kiếm (spec 8.7):** chuẩn hóa NFC, ký tự điều khiển → khoảng trắng, gộp khoảng trắng, tối đa 100 code point, tối đa 8 từ (bỏ trùng không phân biệt hoa thường). Từ ≥ 3 code point → FTS5 (mỗi từ là một chuỗi FTS5 trong `"…"`, `"` nhân đôi, các từ AND ngầm). Từ 1–2 code point → `LIKE '%từ%' ESCAPE '\'` trên `name`, `tagline`, `tags` (escape `\`, `%`, `_`). Không có từ ≥ 3 → chỉ `LIKE`.
- **Thứ tự product:** có FTS → `bm25` tăng dần, rồi điểm huy hiệu giảm dần, rồi `published_at` giảm dần, rồi `id` giảm dần. Không FTS → điểm huy hiệu, `published_at`, `id`. Điểm huy hiệu: `in_production` = 3, `demo_verified` = 2, `listed` = 1, lấy mức cao nhất đang hiệu lực, không có = 0. **Không trọng số cột cho `bm25`** (spec không có; ADR-004).
- **Thứ tự builder (spec 5.2):** availability `open` trước (các mức còn lại ngang nhau), rồi số product published giảm dần, rồi `approved_at` giảm dần, rồi `user_id` giảm dần.
- **Tham số GET** `/products`: `q`, `category`, `delivery`, `badge` (`demo_verified` | `in_production`), `lang` (`en` | `vi` | `zh-Hans` | `zh-Hant`), `min`, `max` (USD, tối đa 2 chữ số thập phân, 0 – 100000; `min > max` thì đổi chỗ), `page`. `/builders`: `q`, `category`, `lang` (`en` | `vi` | `zh`), `country` (ISO alpha-2), `availability`, `page`. Giá trị sai hoặc tham số lạ → **bỏ qua**, không lỗi.
- **Phân trang:** 24 mục/trang cho cả hai trang. `page` hợp lệ là số nguyên 1–9999; còn lại coi là 1. `page > 1` mà không còn mục nào → 404.
- **SEO:** trang có tìm kiếm hoặc bộ lọc → `noindex`, không canonical. Trang không lọc → canonical tự trỏ (`/products`, `/products?page=2`) và hreflang 4 locale + `x-default`. Trang `noindex` nào cũng không phát canonical, `og:url`, hreflang.
- **`robots.txt`:** chặn `/hub`, `/me`, `/admin`, `/auth` ở cả 4 tiền tố locale, chặn `/media`, `Allow: /media/products/`, dòng `Sitemap:`.
- **`sitemap.xml`:** `/` (chỉ `en`, chưa có alternate đến M7), `/products`, `/builders`, mọi product và builder công khai; mỗi trang có locale xuất hiện 4 lần, mỗi lần kèm đủ `xhtml:link` (4 locale + `x-default`). Giới hạn 10 000 product và 2 000 builder để dưới 50 000 URL. Chưa có `/request` (M6), `/for-builders`, `/terms`, `/privacy` (M7).
- Không render nút "Post a request" (quyết định Owner). Không có `sort`, `boost`, `sponsored` hay bất kỳ tham số nào đổi thứ tự.
- Test admin dùng `owner@vnx.si`. Lệnh test một file: `npm test -w apps/web -- <đường dẫn test>`.

## Review Focus

1. **Chuỗi tìm kiếm thù địch:** `"`, `foo AND`, `NEAR(a b)`, `name:x`, `*`, `^`, `%`, `_`, `\`, ký tự điều khiển, emoji, chuỗi 500 ký tự → trang trả 200, không 500; `%` và `_` không thành ký tự đại diện (`q=%` không trả về mọi product). Test ở Task 1 (db) và Task 3, 4 (HTTP).
2. **Product / builder không công khai lọt ra ngoài:** draft, in_review, unlisted, suspended, archived; builder bị khóa; user bị khóa; product vừa ẩn rồi hiện lại; product sửa tên khi đang publish (FTS phải theo tên mới, bỏ tên cũ) → đúng ở catalogue, danh bạ và sitemap. Test ở Task 1, 4, 5.
3. **`page` lạ:** `0`, `-1`, `abc`, `1e3`, `99999`, trang sau trang cuối → về trang 1 hoặc 404, không 500. Test ở Task 1 (domain), Task 3, 4.
4. **Host khác `APP_ORIGIN`** (preview `*.workers.dev`, `www.vnx.si`): canonical, hreflang, og:image, JSON-LD, sitemap, robots đều dùng `https://vnx.si`. Trang lọc là `noindex` không canonical. Test ở Task 2, 3, 5.
5. **Lọc giá ở biên:** product chỉ có tier `contact`, tier $0, `min > max`, số lẻ cent, $19/tháng so với $19 một lần → đúng quyết định Owner. Test ở Task 1.

## Thứ tự task

| # | ID | Nội dung | Phụ thuộc |
|---|---|---|---|
| 1 | VNX-0401 | Migration `0006_catalog` (FTS5 + trigger), `published_at` chỉ đặt khi duyệt, `domain/catalog`, `db/catalog.searchProducts`, test xếp hạng ADR-004 | — |
| 2 | VNX-0404a | `siteOrigin` (`APP_ORIGIN`), trang `noindex` không canonical / hreflang, `/p/:slug` và `/b/:handle` dùng `APP_ORIGIN` | — |
| 3 | VNX-0402 | Trang `/products`: bộ lọc, thẻ product, phân trang, link ở header; test cổng ra M4 | 1, 2 |
| 4 | VNX-0403 | Trang `/builders`: tìm, lọc, xếp hạng, phân trang, link ở header | 1, 2, 3 |
| 5 | VNX-0404b | `/sitemap.xml`, `/robots.txt` | 3, 4 |

Mỗi task kết thúc bằng `npm run typecheck -w apps/web` và `npm test` xanh rồi mới commit. Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: VNX-0401 — FTS5 và truy vấn xếp hạng

**Files:**
- Create: `apps/web/migrations/0006_catalog.sql`
- Create: `apps/web/src/domain/catalog.ts`, `apps/web/src/db/catalog.ts`
- Modify: `apps/web/src/db/products.ts` (`published_at` chỉ đặt khi duyệt; export `PUBLIC_PRODUCT`)
- Modify: `apps/web/test/fixtures.ts` (thêm `addLiveProduct`, `makeLiveProduct`)
- Modify: `apps/web/test/db/products.test.ts` (mở khóa không đổi `published_at`)
- Test: `apps/web/test/domain/catalog.test.ts`, `apps/web/test/catalog/search.test.ts`, `apps/web/test/catalog/ranking.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `DELIVERY_MODELS`, `PRODUCT_LANGS`, `Category`, `DeliveryModel`, `ProductLang`, `BadgeKind` (`domain/product.ts`); `TierInput` (`domain/pricing-input.ts`); fixtures `makeBuilder`; `createProductDraft`, `updateProductFields`, `setProductStatus`, `findProductById` (`db/products.ts`); `replaceTiers` (`db/pricing.ts`); `addMedia` (`db/media.ts`); `grantBadge` (`db/verifications.ts`).
- Produces:
  - `domain/catalog.ts`: hằng `PAGE_SIZE = 24`, `MAX_QUERY_CHARS = 100`, `MAX_TERMS = 8`, `MIN_FTS_CHARS = 3`, `MAX_PRICE_USD = 100000`, `BADGE_SCORE`, `FILTER_BADGES`; type `FilterBadge`, `SearchPlan`, `CatalogQuery`, `CatalogItem`, `Paged<T>`; hàm `normalizeQuery(raw: unknown): string`, `searchTerms(query: string): string[]`, `searchPlan(query: string): SearchPlan`, `ftsPhrase(term: string): string`, `likePattern(term: string): string`, `parseUsdCents(raw: unknown): number | null`, `parsePage(raw: unknown): number`, `oneOf<T>(list, value): T | null`, `parseCatalogQuery(params: Record<string, string | undefined>): CatalogQuery`, `isCatalogFiltered(q: CatalogQuery): boolean`, `catalogSearchParams(q: CatalogQuery, page: number): string`, `topBadge(score: number): BadgeKind | null`.
  - `db/catalog.ts`: `searchProducts(db: D1Database, query: CatalogQuery): Promise<Paged<CatalogItem>>`; `jsonListLike(column: string, pattern: string): string` (điều kiện SQL: một phần tử của cột JSON danh sách khớp `LIKE`; Task 4 dùng cho `skills`).
  - `db/products.ts`: `export const PUBLIC_PRODUCT` (chuỗi SQL, alias `p`, `b`, `u`).
  - fixtures: `addLiveProduct(builder: Builder, name: string, opts?: LiveOpts): Promise<Product>`, `makeLiveProduct(email: string, handle: string, name: string, opts?: LiveOpts & { builder?: Partial<BuilderFormValues> }): Promise<{ builder: Builder; product: Product }>`; `LiveOpts = { at?: string; fields?: Partial<ProductFields>; tiers?: TierInput[]; badges?: BadgeKind[] }`.

- [ ] **Step 1: Viết migration**

`apps/web/migrations/0006_catalog.sql`:

```sql
-- M4 catalogue search (spec §6.1 products_fts, §8.7). Additive only.
-- Holds published products only. The rest of the public rule (approved builder, active user) is applied by the query,
-- so suspending a builder needs no index change. Triggers keep it in sync on every write path; nothing in src/ writes it.
-- product_id is UNINDEXED, so deleting by it scans the index: fine at Wave 1 scale (hundreds of products).
CREATE VIRTUAL TABLE products_fts USING fts5(
  product_id UNINDEXED,
  name,
  tagline,
  description,
  tags,
  tokenize = 'trigram'
);

CREATE TRIGGER products_fts_after_insert AFTER INSERT ON products WHEN new.status = 'published' BEGIN
  INSERT INTO products_fts (product_id, name, tagline, description, tags)
  VALUES (
    new.id, new.name, new.tagline, new.description,
    CASE WHEN json_valid(new.tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(new.tags)) ELSE '' END
  );
END;

CREATE TRIGGER products_fts_after_update AFTER UPDATE OF status, name, tagline, description, tags ON products
WHEN old.status = 'published' OR new.status = 'published' BEGIN
  DELETE FROM products_fts WHERE product_id = old.id;
  INSERT INTO products_fts (product_id, name, tagline, description, tags)
  SELECT
    new.id, new.name, new.tagline, new.description,
    CASE WHEN json_valid(new.tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(new.tags)) ELSE '' END
  WHERE new.status = 'published';
END;

CREATE TRIGGER products_fts_after_delete AFTER DELETE ON products WHEN old.status = 'published' BEGIN
  DELETE FROM products_fts WHERE product_id = old.id;
END;

-- Backfill products published before this migration.
INSERT INTO products_fts (product_id, name, tagline, description, tags)
SELECT
  id, name, tagline, description,
  CASE WHEN json_valid(tags) THEN (SELECT COALESCE(group_concat(value, ' '), '') FROM json_each(tags)) ELSE '' END
FROM products
WHERE status = 'published';
```

- [ ] **Step 2: Viết test domain (fail)**

`apps/web/test/domain/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BADGE_SCORE,
  catalogSearchParams,
  ftsPhrase,
  isCatalogFiltered,
  likePattern,
  normalizeQuery,
  parseCatalogQuery,
  parsePage,
  parseUsdCents,
  searchPlan,
  searchTerms,
  topBadge,
} from "../../src/domain/catalog.ts";

describe("normalizeQuery", () => {
  it("trims, collapses whitespace, drops control characters and composes to NFC", () => {
    expect(normalizeQuery("  đặt \t\n lịch  ")).toBe("đặt lịch");
    expect(normalizeQuery("a\u0000b​c")).toBe("a b c");
    // "e" + combining circumflex + combining dot below → "ệ"
    expect(normalizeQuery("lệ")).toBe("lệ");
  });

  it("caps the length at 100 code points without splitting a surrogate pair", () => {
    expect(Array.from(normalizeQuery("x".repeat(500)))).toHaveLength(100);
    const emoji = normalizeQuery("😀".repeat(150));
    expect(Array.from(emoji)).toHaveLength(100);
    expect(emoji).toBe("😀".repeat(100));
  });

  it("treats anything but a string as empty", () => {
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery(["a"])).toBe("");
  });
});

describe("searchTerms / searchPlan (spec §8.7)", () => {
  it("de-duplicates terms case-insensitively and keeps at most 8", () => {
    expect(searchTerms("CRM crm Spa")).toEqual(["CRM", "Spa"]);
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
    expect(searchTerms("")).toEqual([]);
  });

  it("browses without a query", () => {
    expect(searchPlan("")).toEqual({ mode: "browse" });
  });

  it("uses LIKE only when every term has 1–2 characters", () => {
    expect(searchPlan("预约")).toEqual({ mode: "like", likeTerms: ["预约"] });
    expect(searchPlan("AI hr")).toEqual({ mode: "like", likeTerms: ["AI", "hr"] });
  });

  it("sends terms of 3+ characters to FTS and keeps short ones as LIKE filters", () => {
    expect(searchPlan("đặt lịch")).toEqual({ mode: "fts", match: '"đặt" "lịch"', likeTerms: [] });
    expect(searchPlan("AI chatbot")).toEqual({ mode: "fts", match: '"chatbot"', likeTerms: ["AI"] });
    expect(searchPlan("预约系统")).toEqual({ mode: "fts", match: '"预约系统"', likeTerms: [] });
  });

  it("quotes every FTS term so user text never becomes an operator", () => {
    expect(ftsPhrase('say "hi"')).toBe('"say ""hi"""');
    expect(searchPlan("foo AND NEAR(x name:y")).toEqual({ mode: "fts", match: '"foo" "AND" "NEAR(x" "name:y"', likeTerms: [] });
  });

  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("parseUsdCents / parsePage", () => {
  it("reads whole dollars and up to 2 decimals, 0 – 100000", () => {
    expect(parseUsdCents("19")).toBe(1900);
    expect(parseUsdCents("19.5")).toBe(1950);
    expect(parseUsdCents(" 0.05 ")).toBe(5);
    expect(parseUsdCents("0")).toBe(0);
    expect(parseUsdCents("100000")).toBe(10_000_000);
    for (const bad of ["100000.01", "1.234", "-1", "1e3", "abc", "", " ", "1,5"]) expect(parseUsdCents(bad), bad).toBeNull();
    expect(parseUsdCents(undefined)).toBeNull();
  });

  it("accepts pages 1–9999 and reads anything else as 1", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("9999")).toBe(9999);
    for (const bad of ["0", "-1", "abc", "1e3", "01", "10000", "2.5", "", undefined]) expect(parsePage(bad), String(bad)).toBe(1);
  });
});

describe("parseCatalogQuery", () => {
  it("keeps valid filters and ignores invalid or unknown ones", () => {
    const q = parseCatalogQuery({ q: " spa ", category: "crm", delivery: "source", badge: "in_production", lang: "zh-Hant", min: "10", max: "99.99", page: "3", sort: "paid", boost: "1" });
    expect(q).toEqual({ q: "spa", category: "crm", delivery: "source", badge: "in_production", lang: "zh-Hant", minCents: 1000, maxCents: 9999, page: 3 });
    expect(parseCatalogQuery({ category: "nope", delivery: "", badge: "listed", lang: "zh", min: "x", page: "0" })).toEqual({
      q: "",
      category: null,
      delivery: null,
      badge: null,
      lang: null,
      minCents: null,
      maxCents: null,
      page: 1,
    });
  });

  it("swaps a minimum above the maximum", () => {
    expect(parseCatalogQuery({ min: "500", max: "19" })).toMatchObject({ minCents: 1900, maxCents: 50000 });
  });

  it("has exactly the spec's inputs, so nothing else can reach the ranking (ADR-004)", () => {
    expect(Object.keys(parseCatalogQuery({})).sort()).toEqual(["badge", "category", "delivery", "lang", "maxCents", "minCents", "page", "q"]);
  });

  it("reports whether anything narrows the list", () => {
    expect(isCatalogFiltered(parseCatalogQuery({ page: "2" }))).toBe(false);
    expect(isCatalogFiltered(parseCatalogQuery({ q: "x" }))).toBe(true);
    expect(isCatalogFiltered(parseCatalogQuery({ min: "0" }))).toBe(true);
  });

  it("writes the query back in a fixed order, without page 1 or empty values", () => {
    const q = parseCatalogQuery({ q: "đặt lịch", lang: "vi", min: "1.5", page: "4" });
    expect(catalogSearchParams(q, 1)).toBe("?q=%C4%91%E1%BA%B7t+l%E1%BB%8Bch&lang=vi&min=1.5");
    expect(catalogSearchParams(q, 2)).toBe("?q=%C4%91%E1%BA%B7t+l%E1%BB%8Bch&lang=vi&min=1.5&page=2");
    expect(catalogSearchParams(parseCatalogQuery({}), 1)).toBe("");
    expect(catalogSearchParams(parseCatalogQuery({}), 3)).toBe("?page=3");
  });
});

describe("badge score (spec §8.7)", () => {
  it("ranks in_production over demo_verified over listed", () => {
    expect(BADGE_SCORE).toEqual({ listed: 1, demo_verified: 2, in_production: 3 });
    expect(topBadge(3)).toBe("in_production");
    expect(topBadge(1)).toBe("listed");
    expect(topBadge(0)).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test, thấy fail**

Run: `npm test -w apps/web -- test/domain/catalog.test.ts`
Expected: FAIL, `Failed to load url ../../src/domain/catalog.ts`.

- [ ] **Step 4: Viết `domain/catalog.ts`**

`apps/web/src/domain/catalog.ts`:

```ts
import { CATEGORIES, DELIVERY_MODELS, PRODUCT_LANGS, type BadgeKind, type Category, type DeliveryModel, type ProductLang } from "./product.ts";

/** Spec §5.2: 24 products per page. The builder directory uses the same size. */
export const PAGE_SIZE = 24;
export const MAX_QUERY_CHARS = 100;
export const MAX_TERMS = 8;
/** Trigram FTS needs 3 characters; shorter terms (common in Chinese) fall back to LIKE (spec §8.7). */
export const MIN_FTS_CHARS = 3;
/** Same ceiling as a pricing tier. */
export const MAX_PRICE_USD = 100000;

/**
 * Spec §8.7: the highest active badge counts. With bm25 and published_at these are the only ranking inputs;
 * ADR-004 forbids adding any other.
 */
export const BADGE_SCORE: Readonly<Record<BadgeKind, number>> = { listed: 1, demo_verified: 2, in_production: 3 };

/** Every published product is "listed", so only the two checked badges are filters. */
export const FILTER_BADGES = ["demo_verified", "in_production"] as const;
export type FilterBadge = (typeof FILTER_BADGES)[number];

export interface CatalogQuery {
  q: string;
  category: Category | null;
  delivery: DeliveryModel | null;
  badge: FilterBadge | null;
  lang: ProductLang | null;
  /** Bounds on the cheapest priced tier (Owner decision 2026-10-04), in cents. */
  minCents: number | null;
  maxCents: number | null;
  page: number;
}

/** A product card in the catalogue. */
export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category | null;
  builderHandle: string;
  builderName: string;
  coverKey: string | null;
  /** Cheapest tier with a price, whatever its billing; null when every tier is "contact". */
  minPriceCents: number | null;
  badgeScore: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export type SearchPlan =
  | { mode: "browse" }
  /** `match` is a safe FTS5 expression (every term quoted, implicitly AND-ed); `likeTerms` must match too. */
  | { mode: "fts"; match: string; likeTerms: string[] }
  | { mode: "like"; likeTerms: string[] };

const codePoints = (s: string) => Array.from(s);

/** NFC, control and format characters to spaces, whitespace collapsed, at most MAX_QUERY_CHARS code points. */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const clean = raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  return codePoints(clean).slice(0, MAX_QUERY_CHARS).join("").trim();
}

/** Space-separated terms of a normalized query, de-duplicated ignoring case, at most MAX_TERMS. */
export function searchTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of query.split(" ")) {
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length === MAX_TERMS) break;
  }
  return out;
}

/** An FTS5 string: user text can never become an operator (AND, NEAR, *, column filters). */
export function ftsPhrase(term: string): string {
  return `"${term.replaceAll('"', '""')}"`;
}

/** A LIKE pattern matching `term` anywhere; use with ESCAPE '\'. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Spec §8.7: terms of 3+ characters use FTS5 trigram; 1–2 character terms use LIKE. */
export function searchPlan(query: string): SearchPlan {
  const terms = searchTerms(query);
  if (terms.length === 0) return { mode: "browse" };
  const long = terms.filter((t) => codePoints(t).length >= MIN_FTS_CHARS);
  const short = terms.filter((t) => codePoints(t).length < MIN_FTS_CHARS);
  if (long.length === 0) return { mode: "like", likeTerms: short };
  return { mode: "fts", match: long.map(ftsPhrase).join(" "), likeTerms: short };
}

/** USD with up to 2 decimals, 0 – MAX_PRICE_USD, as cents; anything else is null. */
export function parseUsdCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents <= MAX_PRICE_USD * 100 ? cents : null;
}

/** Pages 1–9999; anything else reads as 1. */
export function parsePage(raw: unknown): number {
  return typeof raw === "string" && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
}

export function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return (list as readonly unknown[]).includes(value) ? (value as T) : null;
}

/** The catalogue's GET parameters. Invalid values and unknown parameters are ignored, never an error. */
export function parseCatalogQuery(params: Record<string, string | undefined>): CatalogQuery {
  let minCents = parseUsdCents(params.min);
  let maxCents = parseUsdCents(params.max);
  if (minCents !== null && maxCents !== null && minCents > maxCents) [minCents, maxCents] = [maxCents, minCents];
  return {
    q: normalizeQuery(params.q),
    category: oneOf(CATEGORIES, params.category),
    delivery: oneOf(DELIVERY_MODELS, params.delivery),
    badge: oneOf(FILTER_BADGES, params.badge),
    lang: oneOf(PRODUCT_LANGS, params.lang),
    minCents,
    maxCents,
    page: parsePage(params.page),
  };
}

/** Search or any filter set: such pages are noindex. */
export function isCatalogFiltered(q: CatalogQuery): boolean {
  return q.q !== "" || q.category !== null || q.delivery !== null || q.badge !== null || q.lang !== null || q.minCents !== null || q.maxCents !== null;
}

const usd = (cents: number) => String(cents / 100);

/** "?…" for the same search on `page` ("" for page 1 with nothing set). Fixed order, empty values left out. */
export function catalogSearchParams(q: CatalogQuery, page: number): string {
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.category) params.set("category", q.category);
  if (q.delivery) params.set("delivery", q.delivery);
  if (q.badge) params.set("badge", q.badge);
  if (q.lang) params.set("lang", q.lang);
  if (q.minCents !== null) params.set("min", usd(q.minCents));
  if (q.maxCents !== null) params.set("max", usd(q.maxCents));
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The badge behind a score from BADGE_SCORE, or null for 0. */
export function topBadge(score: number): BadgeKind | null {
  for (const [kind, value] of Object.entries(BADGE_SCORE) as [BadgeKind, number][]) if (value === score) return kind;
  return null;
}
```

- [ ] **Step 5: Chạy test domain, thấy pass**

Run: `npm test -w apps/web -- test/domain/catalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Sửa `setProductStatusStatement` và export `PUBLIC_PRODUCT`**

Trong `apps/web/src/db/products.ts`:

1. Đổi comment và câu UPDATE của `setProductStatusStatement`:

```ts
/**
 * Compare-and-set on status, as a statement for db.batch. Only an approval (in_review → published) stamps published_at
 * (Owner decision 2026-10-04: relisting or unsuspending does not bump a product to "newest"); the first one also stamps
 * first_published_at.
 */
export function setProductStatusStatement(db: D1Database, input: { id: string; from: ProductStatus; to: ProductStatus; reviewNote: string | null; now: string }): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE products SET status = ?3, review_note = ?4, updated_at = ?5,
         published_at = CASE WHEN ?2 = 'in_review' AND ?3 = 'published' THEN ?5 ELSE published_at END,
         first_published_at = CASE WHEN ?2 = 'in_review' AND ?3 = 'published' THEN COALESCE(first_published_at, ?5) ELSE first_published_at END
       WHERE id = ?1 AND status = ?2
       RETURNING *`,
    )
    .bind(input.id, input.from, input.to, input.reviewNote, input.now);
}
```

và comment của `setProductStatus` thành `/** Compare-and-set on status. Only an approval stamps published_at (see setProductStatusStatement). */`.

2. Đổi `const PUBLIC = …` thành:

```ts
/** Spec §7.2: only published products of approved builders on active accounts are public. Aliases: p, b, u. */
export const PUBLIC_PRODUCT = "p.status = 'published' AND b.status = 'approved' AND u.status = 'active'";
```

và thay hai chỗ dùng `${PUBLIC}` trong `findPublicProductBySlug`, `listPublicProductsByBuilder` bằng `${PUBLIC_PRODUCT}`.

3. Trong `apps/web/test/db/products.test.ts`, test "changes status atomically and keeps the first publish time": đổi dòng cuối thành

```ts
    expect(again).toMatchObject({ publishedAt: NOW, firstPublishedAt: NOW, reviewNote: null });
```

và thêm test mới ngay sau nó:

```ts
  it("keeps published_at when a product is shown again (Owner decision 2026-10-04)", async () => {
    const { product } = await makeDraft("pdb-relist@vnx.si", "pdb-relist", "Relist thing");
    await setProductStatus(db(), { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: NOW });
    await setProductStatus(db(), { id: product.id, from: "in_review", to: "published", reviewNote: null, now: NOW });
    await setProductStatus(db(), { id: product.id, from: "published", to: "unlisted", reviewNote: null, now: LATER });
    expect(await setProductStatus(db(), { id: product.id, from: "unlisted", to: "published", reviewNote: null, now: LATER })).toMatchObject({ publishedAt: NOW, firstPublishedAt: NOW });
  });
```

Run: `npm test -w apps/web -- test/db/products.test.ts`
Expected: PASS (2 test cũ + 1 mới trong `describe("db/products")`).

- [ ] **Step 7: Thêm fixtures**

Trong `apps/web/test/fixtures.ts` thêm import `type ProductFields` từ `../src/domain/product-input.ts`, `type BadgeKind` (gộp vào import sẵn có từ `../src/domain/product.ts`), `type TierInput` từ `../src/domain/pricing-input.ts`, rồi thêm cuối file:

```ts
export type LiveOpts = { at?: string; fields?: Partial<ProductFields>; tiers?: TierInput[]; badges?: BadgeKind[] };

const LIVE_TIERS: TierInput[] = [
  { name: "Starter", billing: "monthly", priceCents: 1900, description: "" },
  { name: "Custom", billing: "contact", priceCents: null, description: "" },
];

/** A product of `builder` that meets every submit condition, approved at `opts.at` with "listed" plus `opts.badges`. */
export async function addLiveProduct(builder: Builder, name: string, opts: LiveOpts = {}): Promise<Product> {
  const at = opts.at ?? new Date().toISOString();
  const draft = await createProductDraft(testEnv.DB, { builderId: builder.userId, name, now: at });
  await updateProductFields(testEnv.DB, {
    productId: draft.id,
    builderId: builder.userId,
    expectedStatus: "draft",
    markEdited: false,
    now: at,
    fields: {
      tagline: `${name} in one line`,
      problem: "Bookings get lost",
      targetUsers: "Spa owners",
      description: "Online booking.",
      category: "booking",
      deliveryModel: "saas",
      supportPolicy: "Email within 48h",
      features: ["Calendar"],
      ...opts.fields,
    },
  });
  await replaceTiers(testEnv.DB, { productId: draft.id, tiers: opts.tiers ?? LIVE_TIERS, now: at });
  await addMedia(testEnv.DB, { productId: draft.id, r2Key: `products/${draft.id}/01J0000000000000000000000C.png`, alt: "Cover", now: at });
  await setProductStatus(testEnv.DB, { id: draft.id, from: "draft", to: "in_review", reviewNote: null, now: at });
  await setProductStatus(testEnv.DB, { id: draft.id, from: "in_review", to: "published", reviewNote: null, now: at });
  for (const kind of ["listed" as const, ...(opts.badges ?? [])]) {
    await grantBadge(testEnv.DB, { productId: draft.id, kind, verifiedBy: null, evidence: kind === "listed" ? "" : "test evidence", now: at });
  }
  return (await findProductById(testEnv.DB, draft.id))!;
}

/** A new approved builder with one live product (see addLiveProduct). */
export async function makeLiveProduct(
  email: string,
  handle: string,
  name: string,
  opts: LiveOpts & { builder?: Partial<BuilderFormValues> } = {},
): Promise<{ builder: Builder; product: Product }> {
  const builder = await makeBuilder(email, handle, "approved", opts.builder);
  return { builder, product: await addLiveProduct(builder, name, opts) };
}
```

- [ ] **Step 8: Viết test tìm kiếm (fail)**

`apps/web/test/catalog/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { createProductDraft, setProductStatus, updateProductFields } from "../../src/db/products.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { addLiveProduct, makeBuilder, makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const search = (params: Record<string, string>) => searchProducts(testEnv.DB, parseCatalogQuery(params));
const ids = async (params: Record<string, string>) => (await search(params)).items.map((i) => i.id);
const now = () => new Date().toISOString();

describe("searchProducts: matching (spec §8.7)", () => {
  it("finds Vietnamese with diacritics in any case, and Chinese with 2 and 4 characters", async () => {
    const { product: vi } = await makeLiveProduct("s-vi@vnx.si", "s-vi", "Phần mềm đặt lịch spa");
    const { product: zh } = await makeLiveProduct("s-zh@vnx.si", "s-zh", "美容院预约系统");
    expect(await ids({ q: "đặt lịch" })).toEqual([vi.id]);
    expect(await ids({ q: "ĐẶT LỊCH" })).toEqual([vi.id]);
    expect(await ids({ q: "预约" })).toEqual([zh.id]);
    expect(await ids({ q: "预约系统" })).toEqual([zh.id]);
  });

  it("searches tagline, description and tags, not other fields", async () => {
    const { product } = await makeLiveProduct("s-fields@vnx.si", "s-fields", "Fieldcheck", {
      fields: { tagline: "Tagzephyr helper", description: "Long text about quorvane flows.", tags: ["plinthwork"], problem: "problemonly-xyzzy" },
    });
    for (const q of ["tagzephyr", "quorvane", "plinthwork"]) expect(await ids({ q }), q).toEqual([product.id]);
    expect(await ids({ q: "problemonly-xyzzy" })).toEqual([]);
  });

  it("combines an FTS term with a short LIKE term", async () => {
    const { product: hit } = await makeLiveProduct("s-mix1@vnx.si", "s-mix1", "Mixcheck 客户", { fields: { tagline: "one" } });
    await makeLiveProduct("s-mix2@vnx.si", "s-mix2", "Mixcheck other", { fields: { tagline: "two" } });
    expect(await ids({ q: "mixcheck 客户" })).toEqual([hit.id]);
  });

  it("never treats user text as FTS syntax or LIKE wildcards", async () => {
    await makeLiveProduct("s-hostile@vnx.si", "s-hostile", "Hostilecheck");
    for (const q of ['"', 'foo"', "foo AND", "NEAR(a b)", "name:x", "*", "^x", "a OR b", "\\", "😀😀😀", "x".repeat(500), "a\u0000b"]) {
      await expect(search({ q }), q).resolves.toBeDefined();
    }
    expect((await search({ q: "%" })).total).toBe(0);
    expect((await search({ q: "_" })).total).toBe(0);
    expect((await search({ q: "%%%" })).total).toBe(0);
    // Tags are matched per element, not as raw JSON text, so a quote matches nothing.
    expect((await search({ q: '"' })).total).toBe(0);
  });
});

describe("searchProducts: only public products (spec §7.1, §7.2)", () => {
  it("follows unlist, relist, edit while published and archive", async () => {
    const { builder, product } = await makeLiveProduct("s-sync@vnx.si", "s-sync", "Syncwombat");
    expect(await ids({ q: "syncwombat" })).toEqual([product.id]);

    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "unlisted", reviewNote: null, now: now() });
    expect(await ids({ q: "syncwombat" })).toEqual([]);
    await setProductStatus(testEnv.DB, { id: product.id, from: "unlisted", to: "published", reviewNote: null, now: now() });
    expect(await ids({ q: "syncwombat" })).toEqual([product.id]);

    await updateProductFields(testEnv.DB, { productId: product.id, builderId: builder.userId, expectedStatus: "published", markEdited: true, now: now(), fields: { name: "Renamedotter" } });
    expect(await ids({ q: "syncwombat" })).toEqual([]);
    expect(await ids({ q: "renamedotter" })).toEqual([product.id]);

    await setProductStatus(testEnv.DB, { id: product.id, from: "published", to: "archived", reviewNote: null, now: now() });
    expect(await ids({ q: "renamedotter" })).toEqual([]);
  });

  it("hides suspended products and products of suspended builders or users", async () => {
    const a = await makeLiveProduct("s-hide1@vnx.si", "s-hide1", "Hidecheck one");
    const b = await makeLiveProduct("s-hide2@vnx.si", "s-hide2", "Hidecheck two");
    const c = await makeLiveProduct("s-hide3@vnx.si", "s-hide3", "Hidecheck three");
    expect((await ids({ q: "hidecheck" })).sort()).toEqual([a.product.id, b.product.id, c.product.id].sort());

    await setProductStatus(testEnv.DB, { id: a.product.id, from: "published", to: "suspended", reviewNote: "spam", now: now() });
    await setBuilderStatus(testEnv.DB, { userId: b.builder.userId, from: "approved", to: "suspended", reviewNote: null, now: now() });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(c.builder.userId).run();
    expect(await ids({ q: "hidecheck" })).toEqual([]);
    expect(await ids({ q: "hid" })).toEqual([]);
  });

  it("never lists drafts or products in review", async () => {
    const builder = await makeBuilder("s-draft@vnx.si", "s-draft", "approved");
    const live = await addLiveProduct(builder, "Draftcheck live");
    const draft = await createProductDraft(testEnv.DB, { builderId: builder.userId, name: "Draftcheck draft", now: now() });
    await setProductStatus(testEnv.DB, { id: draft.id, from: "draft", to: "in_review", reviewNote: null, now: now() });
    expect(await ids({ q: "draftcheck" })).toEqual([live.id]);
  });
});

describe("searchProducts: filters and pages", () => {
  it("filters by category, delivery model, language and badge", async () => {
    const builder = await makeBuilder("s-filter@vnx.si", "s-filter", "approved");
    const crm = await addLiveProduct(builder, "Filtercheck crm", { fields: { category: "crm" } });
    const src = await addLiveProduct(builder, "Filtercheck source", { fields: { deliveryModel: "source", license: "extended" } });
    const zh = await addLiveProduct(builder, "Filtercheck zh", { fields: { primaryLang: "zh-Hant" } });
    const prod = await addLiveProduct(builder, "Filtercheck prod", { badges: ["in_production"] });
    expect(await ids({ q: "filtercheck", category: "crm" })).toEqual([crm.id]);
    expect(await ids({ q: "filtercheck", delivery: "source" })).toEqual([src.id]);
    expect(await ids({ q: "filtercheck", lang: "zh-Hant" })).toEqual([zh.id]);
    expect(await ids({ q: "filtercheck", badge: "in_production" })).toEqual([prod.id]);
    expect(await ids({ q: "filtercheck", badge: "demo_verified" })).toEqual([]);
  });

  it("filters on the cheapest priced tier, whatever its billing (Owner decision 2026-10-04)", async () => {
    const builder = await makeBuilder("s-price@vnx.si", "s-price", "approved");
    const monthly = await addLiveProduct(builder, "Pricecheck monthly", { tiers: [{ name: "M", billing: "monthly", priceCents: 1900, description: "" }, { name: "C", billing: "contact", priceCents: null, description: "" }] });
    const oneTime = await addLiveProduct(builder, "Pricecheck onetime", { tiers: [{ name: "O", billing: "one_time", priceCents: 50000, description: "" }, { name: "Y", billing: "yearly", priceCents: 90000, description: "" }] });
    await addLiveProduct(builder, "Pricecheck contact", { tiers: [{ name: "C", billing: "contact", priceCents: null, description: "" }] });
    const free = await addLiveProduct(builder, "Pricecheck free", { tiers: [{ name: "F", billing: "one_time", priceCents: 0, description: "" }] });
    const sorted = async (params: Record<string, string>) => (await ids({ q: "pricecheck", ...params })).sort();

    expect(await sorted({ min: "0", max: "19" })).toEqual([monthly.id, free.id].sort());
    expect(await sorted({ min: "19.01" })).toEqual([oneTime.id]);
    expect(await sorted({ min: "0" })).toEqual([monthly.id, oneTime.id, free.id].sort());
    expect(await sorted({ max: "0" })).toEqual([free.id]);
    expect(await sorted({ min: "500", max: "19" })).toEqual([monthly.id, oneTime.id].sort());
    expect(await sorted({})).toHaveLength(4);
  });

  it("returns cover, starting price, builder and badge score on each item", async () => {
    const { builder, product } = await makeLiveProduct("s-item@vnx.si", "s-item", "Itemcheck", { badges: ["demo_verified"] });
    const [item] = (await search({ q: "itemcheck" })).items;
    expect(item).toEqual({
      id: product.id,
      slug: product.slug,
      name: "Itemcheck",
      tagline: "Itemcheck in one line",
      category: "booking",
      builderHandle: builder.handle,
      builderName: builder.name,
      coverKey: `products/${product.id}/01J0000000000000000000000C.png`,
      minPriceCents: 1900,
      badgeScore: 2,
    });
  });

  it("pages 24 at a time and counts every match", async () => {
    const builder = await makeBuilder("s-page@vnx.si", "s-page", "approved");
    for (let i = 0; i < 25; i++) await addLiveProduct(builder, `Pagecheck ${i}`);
    const first = await search({ q: "pagecheck" });
    const second = await search({ q: "pagecheck", page: "2" });
    expect(first.total).toBe(25);
    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(25);
    expect((await search({ q: "pagecheck", page: "3" })).items).toEqual([]);
  });
});
```

- [ ] **Step 9: Viết test xếp hạng ADR-004 (fail)**

`apps/web/test/catalog/ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { searchProducts } from "../../src/db/catalog.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const migrations = import.meta.glob("../../migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const order = async (params: Record<string, string>) => (await searchProducts(testEnv.DB, parseCatalogQuery(params))).items.map((i) => i.name);

describe("catalogue ranking (spec §8.7, ADR-004)", () => {
  it("without a query: highest badge first, then newest approval", async () => {
    const b = await makeBuilder("r-browse@vnx.si", "r-browse", "approved");
    // A filter combination no other test in this file uses keeps the list to these four.
    const fields = { category: "hr", primaryLang: "zh-Hant", deliveryModel: "service" } as const;
    await addLiveProduct(b, "Old listed", { fields, at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "New listed", { fields, at: "2026-03-01T00:00:00.000Z" });
    await addLiveProduct(b, "Old prod", { fields, at: "2026-01-02T00:00:00.000Z", badges: ["demo_verified", "in_production"] });
    await addLiveProduct(b, "Mid demo", { fields, at: "2026-02-01T00:00:00.000Z", badges: ["demo_verified"] });
    expect(await order({ category: "hr", lang: "zh-Hant", delivery: "service" })).toEqual(["Old prod", "Mid demo", "New listed", "Old listed"]);
  });

  it("with a query: relevance first, then badge, then newest", async () => {
    const b = await makeBuilder("r-fts@vnx.si", "r-fts", "approved");
    // Strong match: the term in name, tagline and tags of a short document.
    await addLiveProduct(b, "Zorblax", { fields: { tagline: "Zorblax zorblax", tags: ["zorblax"], description: "Short." }, at: "2026-01-01T00:00:00.000Z" });
    // Weak match with the best badge: one mention deep in a long description.
    await addLiveProduct(b, "Weak match", {
      fields: { tagline: "Something else", description: `${"Lorem ipsum dolor sit amet. ".repeat(40)}zorblax.` },
      at: "2026-05-01T00:00:00.000Z",
      badges: ["in_production"],
    });
    expect(await order({ q: "zorblax" })).toEqual(["Zorblax", "Weak match"]);

    // Identical text ties on bm25, so the badge and then the approval date decide.
    const same = { tagline: "Quillbeam desk", description: "Quillbeam." };
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-02-01T00:00:00.000Z" });
    await addLiveProduct(b, "Quillbeam", { fields: same, at: "2026-01-15T00:00:00.000Z", badges: ["demo_verified"] });
    const items = (await searchProducts(testEnv.DB, parseCatalogQuery({ q: "quillbeam" }))).items;
    expect(items.map((i) => i.badgeScore)).toEqual([2, 1, 1]);
    const dates = await Promise.all(items.map(async (i) => (await testEnv.DB.prepare("SELECT published_at AS d FROM products WHERE id = ?1").bind(i.id).first<{ d: string }>())!.d));
    expect(dates).toEqual(["2026-01-15T00:00:00.000Z", "2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]);
  });

  it("ignores any parameter outside the spec's filters", async () => {
    const b = await makeBuilder("r-params@vnx.si", "r-params", "approved");
    await addLiveProduct(b, "Paramcheck a", { at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "Paramcheck b", { at: "2026-02-01T00:00:00.000Z", badges: ["demo_verified"] });
    const plain = await order({ q: "paramcheck" });
    const paid = await order({ q: "paramcheck", sort: "oldest", boost: "Paramcheck a", sponsored: "1", featured: "1", promoted: "1", priority: "9", paid: "1", order: "asc" });
    expect(paid).toEqual(plain);
  });

  it("has no paid, sponsored or boosted column anywhere in the schema", () => {
    const sql = Object.values(migrations).join("\n");
    expect(sql).not.toMatch(/\b\w*(sponsor|boost|promot|featured|paid|priority)\w*\b/i);
  });
});
```

- [ ] **Step 10: Chạy test, thấy fail**

Run: `npm test -w apps/web -- test/catalog`
Expected: FAIL, `Failed to load url ../../src/db/catalog.ts`.

- [ ] **Step 11: Viết `db/catalog.ts`**

`apps/web/src/db/catalog.ts`:

```ts
import { BADGE_SCORE, likePattern, PAGE_SIZE, searchPlan, type CatalogItem, type CatalogQuery, type Paged } from "../domain/catalog.ts";
import type { Category } from "../domain/product.ts";
import { PUBLIC_PRODUCT } from "./products.ts";

type ItemRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category | null;
  builder_handle: string;
  builder_name: string;
  cover_key: string | null;
  min_price_cents: number | null;
  badge_score: number;
};

const toItem = (r: ItemRow): CatalogItem => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  category: r.category,
  builderHandle: r.builder_handle,
  builderName: r.builder_name,
  coverKey: r.cover_key,
  minPriceCents: r.min_price_cents,
  badgeScore: r.badge_score,
});

// SQL is assembled only from these constants; user input is always bound.
const JOINS = "JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id";
const BADGE_SCORE_SQL = `COALESCE((SELECT MAX(CASE v.kind ${Object.entries(BADGE_SCORE)
  .map(([kind, score]) => `WHEN '${kind}' THEN ${score}`)
  .join(" ")} END) FROM product_verifications v WHERE v.product_id = p.id AND v.revoked_at IS NULL), 0)`;
const MIN_PRICE_SQL = "(SELECT MIN(t.price_cents) FROM pricing_tiers t WHERE t.product_id = p.id AND t.price_cents IS NOT NULL)";
const COVER_SQL = "(SELECT m.r2_key FROM product_media m WHERE m.product_id = p.id ORDER BY m.sort, m.id LIMIT 1)";

/** SQL condition: some element of the JSON list in `column` matches the bound LIKE `pattern` (never the raw JSON text). */
export function jsonListLike(column: string, pattern: string): string {
  return `EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(${column}) THEN ${column} ELSE '[]' END) WHERE value LIKE ${pattern} ESCAPE '\\')`;
}

/**
 * Spec §8.7 search over public products: FTS5 trigram (bm25) for terms of 3+ characters, LIKE for shorter ones,
 * then the highest active badge, then the newest approval. ADR-004: no other input reaches the order.
 */
export async function searchProducts(db: D1Database, query: CatalogQuery): Promise<Paged<CatalogItem>> {
  const plan = searchPlan(query.q);
  const params: (string | number)[] = [];
  const bind = (value: string | number) => {
    params.push(value);
    return `?${params.length}`;
  };

  const fts = plan.mode === "fts";
  const hits = fts ? `WITH hits AS (SELECT product_id, bm25(products_fts) AS rank FROM products_fts WHERE products_fts MATCH ${bind(plan.match)}) ` : "";
  const from = fts ? `hits JOIN products p ON p.id = hits.product_id ${JOINS}` : `products p ${JOINS}`;

  const where = [PUBLIC_PRODUCT];
  for (const term of plan.mode === "browse" ? [] : plan.likeTerms) {
    const pattern = bind(likePattern(term));
    where.push(`(p.name LIKE ${pattern} ESCAPE '\\' OR p.tagline LIKE ${pattern} ESCAPE '\\' OR ${jsonListLike("p.tags", pattern)})`);
  }
  if (query.category) where.push(`p.category = ${bind(query.category)}`);
  if (query.delivery) where.push(`p.delivery_model = ${bind(query.delivery)}`);
  if (query.lang) where.push(`p.primary_lang = ${bind(query.lang)}`);
  if (query.badge) where.push(`EXISTS (SELECT 1 FROM product_verifications v WHERE v.product_id = p.id AND v.kind = ${bind(query.badge)} AND v.revoked_at IS NULL)`);
  if (query.minCents !== null) where.push(`${MIN_PRICE_SQL} >= ${bind(query.minCents)}`);
  if (query.maxCents !== null) where.push(`${MIN_PRICE_SQL} <= ${bind(query.maxCents)}`);
  const filter = where.join(" AND ");

  const order = [...(fts ? ["hits.rank"] : []), "badge_score DESC", "p.published_at DESC", "p.id DESC"].join(", ");
  // page comes from parsePage (an integer 1–9999), so LIMIT/OFFSET are literals; binding them would give the
  // count statement more parameters than it uses.
  const offset = (query.page - 1) * PAGE_SIZE;
  const list = db
    .prepare(
      `${hits}SELECT p.id, p.slug, p.name, p.tagline, p.category, b.handle AS builder_handle, b.name AS builder_name,
         ${COVER_SQL} AS cover_key, ${MIN_PRICE_SQL} AS min_price_cents, ${BADGE_SCORE_SQL} AS badge_score
       FROM ${from} WHERE ${filter} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    )
    .bind(...params);
  const count = db.prepare(`${hits}SELECT COUNT(*) AS n FROM ${from} WHERE ${filter}`).bind(...params);
  const [rows, total] = await db.batch([list, count]);
  return { items: ((rows?.results ?? []) as ItemRow[]).map(toItem), total: (total?.results[0] as { n: number } | undefined)?.n ?? 0 };
}
```

- [ ] **Step 12: Chạy test, thấy pass**

Run: `npm test -w apps/web -- test/catalog test/domain/catalog.test.ts test/db/products.test.ts`
Expected: PASS.

Nếu test "with a query: relevance first" fail vì `bm25` xếp "Weak match" lên trước: **không** thêm trọng số cột (ADR-004). Báo Reviewer kèm điểm `bm25` của hai dòng; Reviewer sửa dữ liệu test.

- [ ] **Step 13: Chạy toàn bộ và commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: exit 0, mọi test xanh (test cũ của product page / admin vẫn xanh: chúng không phụ thuộc `published_at` khi mở khóa).

```bash
git add apps/web/migrations/0006_catalog.sql apps/web/src/domain/catalog.ts apps/web/src/db/catalog.ts apps/web/src/db/products.ts apps/web/test/fixtures.ts apps/web/test/db/products.test.ts apps/web/test/domain/catalog.test.ts apps/web/test/catalog
git commit -m "feat(web): FTS5 trigram catalogue search with neutral ranking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: VNX-0404a — Canonical và hreflang trên `APP_ORIGIN`

**Files:**
- Modify: `apps/web/src/http/origin.ts` (thêm `siteOrigin`)
- Modify: `apps/web/src/views/Layout.tsx` (trang `noindex` không canonical / `og:url` / hreflang)
- Modify: `apps/web/src/routes/product-page.tsx`, `apps/web/src/routes/builder-profile.tsx` (`requestOrigin` → `siteOrigin`)
- Modify: `apps/web/test/views/error-pages.test.ts` (404 không còn hreflang)
- Test: `apps/web/test/seo/canonical.test.ts`

**Interfaces:**
- Consumes: `Layout` (`views/Layout.tsx`), `alternates` (`i18n/locales.ts`), fixtures `makeReadyProduct`, `publishProduct`, `makeBuilder`.
- Produces: `siteOrigin(c: Context<AppEnv>): string` trong `http/origin.ts`. Task 3, 4, 5 dùng nó cho mọi trang công khai.

- [ ] **Step 1: Viết test (fail)**

`apps/web/test/seo/canonical.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { makeBuilder, makeReadyProduct, publishProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const PREVIEW = "https://vnxsi-web.preview.workers.dev";
const fetchAt = (url: string) => createApp().request(new Request(url), undefined, testEnv);
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "null");

describe("canonical URLs use APP_ORIGIN (spec §8.8)", () => {
  it("product page on a preview host points canonical, hreflang, og:image and JSON-LD at https://vnx.si", async () => {
    const { product } = await makeReadyProduct("seo-p@vnx.si", "seo-p", "Seo Product");
    const live = await publishProduct(product.id);
    const html = await (await fetchAt(`${PREVIEW}/vi/p/${live.slug}`)).text();
    expect(html).toContain(`<link rel="canonical" href="https://vnx.si/vi/p/${live.slug}"`);
    expect(html).toContain(`<meta property="og:url" content="https://vnx.si/vi/p/${live.slug}"`);
    expect(html).toContain(`<meta property="og:image" content="https://vnx.si/media/products/${product.id}/`);
    expect(jsonLd(html).url).toBe(`https://vnx.si/vi/p/${live.slug}`);
    expect(html).not.toContain(PREVIEW);
  });

  it("lists all four locales and x-default on a public page (spec §5.1)", async () => {
    await makeBuilder("seo-b@vnx.si", "seo-b", "approved");
    const html = await (await fetchAt(`${PREVIEW}/zh-hans/b/seo-b`)).text();
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/zh-hans/b/seo-b"');
    for (const [lang, href] of [
      ["en", "https://vnx.si/b/seo-b"],
      ["vi", "https://vnx.si/vi/b/seo-b"],
      ["zh-Hans", "https://vnx.si/zh-hans/b/seo-b"],
      ["zh-Hant", "https://vnx.si/zh-hant/b/seo-b"],
      ["x-default", "https://vnx.si/b/seo-b"],
    ]) {
      expect(html, lang).toContain(`<link rel="alternate" hreflang="${lang}" href="${href}"`);
    }
    expect(html).not.toContain(PREVIEW);
  });

  it("gives noindex pages no canonical, og:url or hreflang", async () => {
    for (const path of ["/login", "/vi/khong-co"]) {
      const html = await (await fetchAt(`https://vnx.si${path}`)).text();
      expect(html, path).toContain('<meta name="robots" content="noindex"');
      expect(html, path).not.toContain('rel="canonical"');
      expect(html, path).not.toContain('property="og:url"');
      expect(html, path).not.toContain('rel="alternate"');
    }
  });
});
```

Sửa `apps/web/test/views/error-pages.test.ts`, test "renders a Vietnamese 404 under /vi": thay hai dòng

```ts
    expect(html).toContain('hreflang="zh-Hant"');
    expect(html).toContain('href="https://vnx.si/zh-hant/khong-co"');
```

bằng

```ts
    // noindex pages carry no hreflang (VNX-0404); the language switcher still links every locale.
    expect(html).not.toContain('rel="alternate"');
    expect(html).toContain('href="/zh-hant/khong-co"');
```

- [ ] **Step 2: Chạy test, thấy fail**

Run: `npm test -w apps/web -- test/seo/canonical.test.ts test/views/error-pages.test.ts`
Expected: FAIL (canonical đang dùng host preview; trang noindex vẫn có canonical / hreflang).

- [ ] **Step 3: Thêm `siteOrigin`**

Cuối `apps/web/src/http/origin.ts`:

```ts
/**
 * Origin for absolute public URLs (canonical, hreflang, og:image, JSON-LD, sitemap): APP_ORIGIN, so a preview or
 * www host never becomes canonical. Falls back to the request's origin when APP_ORIGIN is missing or invalid.
 */
export function siteOrigin(c: Context<AppEnv>): string {
  return originOf(c.env.APP_ORIGIN) ?? requestOrigin(c);
}
```

- [ ] **Step 4: Sửa `Layout`**

Trong `apps/web/src/views/Layout.tsx`, thay khối từ `<link rel="canonical" …/>` tới hết vòng `alternates(…)` bằng:

```tsx
        {noindex ? null : <link rel="canonical" href={canonical} />}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {noindex ? null : <meta property="og:url" content={canonical} />}
        {description ? <meta property="og:description" content={description} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        {jsonLd ? jsonLdScript(jsonLd) : null}
        {/* A noindex page has no canonical form to point at (spec §5.1 hreflang is for public pages). */}
        {noindex
          ? null
          : alternates(origin, rest).map((alt) => <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />)}
```

và thêm ngay sau dòng `const tr = translator(locale);`:

```tsx
  const canonical = origin + localizedPath(locale, rest);
```

- [ ] **Step 5: Hai trang công khai dùng `siteOrigin`**

- `apps/web/src/routes/product-page.tsx`: import `siteOrigin` thay `requestOrigin`; `const origin = siteOrigin(c);`.
- `apps/web/src/routes/builder-profile.tsx`: import `siteOrigin` thay `requestOrigin`; `origin={siteOrigin(c)}`.

Các route Hub / admin / auth giữ `requestOrigin` (link invite trong admin phải trỏ đúng host đang chạy, kể cả local).

- [ ] **Step 6: Chạy test, thấy pass; commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: exit 0, mọi test xanh.

```bash
git add apps/web/src/http/origin.ts apps/web/src/views/Layout.tsx apps/web/src/routes/product-page.tsx apps/web/src/routes/builder-profile.tsx apps/web/test/seo/canonical.test.ts apps/web/test/views/error-pages.test.ts
git commit -m "feat(web): canonical and hreflang on APP_ORIGIN, none on noindex pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: VNX-0402 — Trang `/products`

**Files:**
- Create: `apps/web/src/routes/catalog.tsx`
- Create: `apps/web/src/views/CatalogPage.tsx`, `apps/web/src/views/ProductCard.tsx`, `apps/web/src/views/Pagination.tsx`, `apps/web/src/views/SelectFilter.tsx`
- Modify: `apps/web/src/app.ts` (đăng ký route), `apps/web/src/views/Layout.tsx` (link "Products" ở header), `apps/web/public/assets/app.css`
- Modify: 4 file `apps/web/src/i18n/messages/*.ts` (key mới)
- Test: `apps/web/test/public/products-page.test.ts`

**Interfaces:**
- Consumes: Task 1 (`parseCatalogQuery`, `isCatalogFiltered`, `catalogSearchParams`, `topBadge`, `FILTER_BADGES`, `MAX_QUERY_CHARS`, `PAGE_SIZE`, `CatalogItem`, `CatalogQuery`, `Paged`, `searchProducts`, fixtures `makeLiveProduct`, `addLiveProduct`), Task 2 (`siteOrigin`), `onLocalized`, `errorResponse`, `page`, `formatUsd`, nhãn ở `views/labels.ts`.
- Produces:
  - `views/Pagination.tsx`: `Pagination: FC<{ locale: Locale; path: string; page: number; total: number; href: (page: number) => string }>`; `href(n)` trả chuỗi query (`""` hoặc `"?…"`).
  - `views/SelectFilter.tsx`: `SelectFilter: FC<{ id: string; name: string; label: string; any: string; value: string | null; options: { value: string; label: string }[] }>`.
  - Key i18n `filter.any`, `filter.apply`, `filter.clear`, `filter.results`, `pager.*` (Task 4 dùng lại).
  - `registerCatalogRoutes(app)`.

- [ ] **Step 1: Thêm key i18n**

Thêm vào cuối object của từng file (giữ đúng thứ tự key giữa 4 file):

`en.ts`:

```ts
  "catalog.title": "Products",
  "catalog.description": "AI-built products from reviewed builders. Nobody can pay to rank higher.",
  "catalog.search": "Search",
  "catalog.filter.category": "Category",
  "catalog.filter.delivery": "Delivery",
  "catalog.filter.badge": "Verification",
  "catalog.filter.lang": "Product language",
  "catalog.filter.min": "Starting price from (USD)",
  "catalog.filter.max": "Starting price up to (USD)",
  "catalog.empty": "No products match yet. Try fewer words or clear the filters.",
  "catalog.from": "From {amount}",
  "catalog.by": "by {name}",
  "catalog.ranking": "Order: best match, then verification level, then newest. Nobody can pay to rank higher.",
  "filter.any": "Any",
  "filter.apply": "Apply",
  "filter.clear": "Clear filters",
  "filter.results": "Results: {n}",
  "pager.label": "Pages",
  "pager.prev": "Previous",
  "pager.next": "Next",
  "pager.status": "Page {page} of {pages}",
```

`vi.ts`:

```ts
  "catalog.title": "Sản phẩm",
  "catalog.description": "Sản phẩm xây bằng AI từ các builder đã được duyệt. Không ai trả tiền để được xếp cao hơn.",
  "catalog.search": "Tìm kiếm",
  "catalog.filter.category": "Danh mục",
  "catalog.filter.delivery": "Hình thức",
  "catalog.filter.badge": "Xác minh",
  "catalog.filter.lang": "Ngôn ngữ sản phẩm",
  "catalog.filter.min": "Giá khởi điểm từ (USD)",
  "catalog.filter.max": "Giá khởi điểm đến (USD)",
  "catalog.empty": "Chưa có sản phẩm phù hợp. Thử ít từ hơn hoặc xóa bộ lọc.",
  "catalog.from": "Từ {amount}",
  "catalog.by": "bởi {name}",
  "catalog.ranking": "Thứ tự: khớp nhất, rồi mức xác minh, rồi mới nhất. Không ai trả tiền để được xếp cao hơn.",
  "filter.any": "Tất cả",
  "filter.apply": "Áp dụng",
  "filter.clear": "Xóa bộ lọc",
  "filter.results": "Kết quả: {n}",
  "pager.label": "Phân trang",
  "pager.prev": "Trang trước",
  "pager.next": "Trang sau",
  "pager.status": "Trang {page}/{pages}",
```

`zh-hans.ts`:

```ts
  "catalog.title": "产品",
  "catalog.description": "经过审核的开发者用 AI 打造的产品。没有人能花钱提升排名。",
  "catalog.search": "搜索",
  "catalog.filter.category": "类别",
  "catalog.filter.delivery": "交付方式",
  "catalog.filter.badge": "验证",
  "catalog.filter.lang": "产品语言",
  "catalog.filter.min": "起价最低（美元）",
  "catalog.filter.max": "起价最高（美元）",
  "catalog.empty": "暂时没有符合条件的产品。请减少关键词或清除筛选。",
  "catalog.from": "{amount} 起",
  "catalog.by": "开发者：{name}",
  "catalog.ranking": "排序：最相关优先，其次是验证级别，再其次是最新发布。没有人能花钱提升排名。",
  "filter.any": "不限",
  "filter.apply": "应用",
  "filter.clear": "清除筛选",
  "filter.results": "结果：{n}",
  "pager.label": "分页",
  "pager.prev": "上一页",
  "pager.next": "下一页",
  "pager.status": "第 {page} 页，共 {pages} 页",
```

`zh-hant.ts`:

```ts
  "catalog.title": "產品",
  "catalog.description": "經過審核的開發者用 AI 打造的產品。沒有人能花錢提升排名。",
  "catalog.search": "搜尋",
  "catalog.filter.category": "類別",
  "catalog.filter.delivery": "交付方式",
  "catalog.filter.badge": "驗證",
  "catalog.filter.lang": "產品語言",
  "catalog.filter.min": "起價最低（美元）",
  "catalog.filter.max": "起價最高（美元）",
  "catalog.empty": "暫時沒有符合條件的產品。請減少關鍵字或清除篩選。",
  "catalog.from": "{amount} 起",
  "catalog.by": "開發者：{name}",
  "catalog.ranking": "排序：最相關優先，其次是驗證級別，再其次是最新發布。沒有人能花錢提升排名。",
  "filter.any": "不限",
  "filter.apply": "套用",
  "filter.clear": "清除篩選",
  "filter.results": "結果：{n}",
  "pager.label": "分頁",
  "pager.prev": "上一頁",
  "pager.next": "下一頁",
  "pager.status": "第 {page} 頁，共 {pages} 頁",
```

Run: `npm test -w apps/web -- test/i18n`
Expected: PASS.

- [ ] **Step 2: Viết test trang (fail)**

`apps/web/test/public/products-page.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById } from "../../src/db/products.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { addLiveProduct, makeBuilder, makeLiveProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);
const slugs = (html: string) => [...html.matchAll(/<h2><a href="(?:\/[a-z-]+)?\/p\/([a-z0-9-]+)"/g)].map((m) => m[1]);

describe("/products (spec §5.2)", () => {
  it("renders cards with name, tagline, category, builder, starting price, cover and checked badge", async () => {
    const { product } = await makeLiveProduct("pg-card@vnx.si", "pg-card", "Cardcheck Pro", { badges: ["demo_verified"] });
    const res = await get("/products?q=cardcheck");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Cardcheck Pro", "Cardcheck Pro in one line", "Booking", "by Lan Nguyen", "From $19", "Demo verified", "Results: 1"]) expect(html, text).toContain(text);
    expect(html).toContain(`href="/p/${product.slug}"`);
    expect(html).toContain(`src="/media/products/${product.id}/01J0000000000000000000000C.png"`);
    expect(html).toContain("Nobody can pay to rank higher.");
  });

  it("shows Contact for price when no tier has a price, and no badge for listed only", async () => {
    await makeLiveProduct("pg-contact@vnx.si", "pg-contact", "Contactcheck", { tiers: [{ name: "C", billing: "contact", priceCents: null, description: "" }] });
    const html = await (await get("/products?q=contactcheck")).text();
    expect(html).toContain("Contact for price");
    expect(html).not.toContain(">Listed<");
  });

  it("escapes hostile names and builder names", async () => {
    await makeLiveProduct("pg-xss@vnx.si", "pg-xss", "Xsscheck <img src=x onerror=alert(1)>", { builder: { name: "<script>alert(2)</script>" } });
    const html = await (await get("/products?q=xsscheck")).text();
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("keeps the filters in the form and translates labels", async () => {
    const html = await (await get("/vi/products?q=spa&category=crm&delivery=source&badge=in_production&lang=vi&min=10&max=99.5")).text();
    expect(html).toContain('value="spa"');
    expect(html).toMatch(/<option value="crm" selected/);
    expect(html).toMatch(/<option value="source" selected/);
    expect(html).toMatch(/<option value="in_production" selected/);
    expect(html).toMatch(/<option value="vi" selected/);
    expect(html).toContain('value="10"');
    expect(html).toContain('value="99.5"');
    expect(html).toContain("Giá khởi điểm từ (USD)");
    expect(html).toContain('action="/vi/products"');
  });

  it("returns 200 for hostile queries and odd parameters", async () => {
    for (const q of ['"', "foo AND", "NEAR(a b)", "%", "\\", "😀", "x".repeat(500)]) {
      expect((await get(`/products?q=${encodeURIComponent(q)}`)).status, q).toBe(200);
    }
    for (const p of ["page=0", "page=-1", "page=abc", "page=1e3", "min=-5", "category=%3Cscript%3E", "badge=listed"]) {
      expect((await get(`/products?${p}`)).status, p).toBe(200);
    }
  });

  it("pages 24 at a time with prev/next links that keep the search, and 404s past the last page", async () => {
    const b = await makeBuilder("pg-page@vnx.si", "pg-page", "approved");
    for (let i = 0; i < 25; i++) await addLiveProduct(b, `Pagerun ${i}`);
    const first = await (await get("/products?q=pagerun")).text();
    expect(slugs(first)).toHaveLength(24);
    expect(first).toContain("Page 1 of 2");
    expect(first).toContain('href="/products?q=pagerun&amp;page=2" rel="next"');
    const second = await (await get("/products?q=pagerun&page=2")).text();
    expect(slugs(second)).toHaveLength(1);
    expect(second).toContain('href="/products?q=pagerun" rel="prev"');
    expect((await get("/products?q=pagerun&page=3")).status).toBe(404);
  });

  it("is indexable only without search or filters (spec §8.8)", async () => {
    const plain = await (await get("/products")).text();
    expect(plain).toContain('<link rel="canonical" href="https://vnx.si/products"');
    expect(plain).toContain('<link rel="alternate" hreflang="zh-Hant" href="https://vnx.si/zh-hant/products"');
    expect(plain).not.toContain('name="robots"');
    for (const path of ["/products?q=spa", "/products?category=crm", "/products?min=0"]) {
      const html = await (await get(path)).text();
      expect(html, path).toContain('<meta name="robots" content="noindex"');
      expect(html, path).not.toContain('rel="canonical"');
    }
  });

  it("canonicalises page 2 to itself", async () => {
    const b = await makeBuilder("pg-canon@vnx.si", "pg-canon", "approved");
    for (let i = 0; i < 25; i++) await addLiveProduct(b, `Canonrun ${i}`);
    const html = await (await get("/vi/products?page=2")).text();
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/vi/products?page=2"');
  });

  it("ignores parameters outside the spec (ADR-004)", async () => {
    const b = await makeBuilder("pg-adr@vnx.si", "pg-adr", "approved");
    await addLiveProduct(b, "Adrcheck a", { at: "2026-01-01T00:00:00.000Z" });
    await addLiveProduct(b, "Adrcheck b", { at: "2026-02-01T00:00:00.000Z", badges: ["in_production"] });
    const plain = slugs(await (await get("/products?q=adrcheck")).text());
    const paid = slugs(await (await get("/products?q=adrcheck&sort=oldest&boost=1&sponsored=1&featured=1&order=asc")).text());
    expect(paid).toEqual(plain);
    expect(plain).toHaveLength(2);
  });

  it("links to the catalogue from the header", async () => {
    const html = await (await get("/vi/b/no-such-builder")).text();
    const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(header).toContain('<a href="/vi/products">Sản phẩm</a>');
  });
});

describe("M4 exit gate: search in Vietnamese with diacritics and in 2-character Chinese", () => {
  async function createAndApprove(email: string, handle: string, name: string, slug: string, lang: string) {
    await makeBuilder(email, handle, "approved");
    const { cookie } = await signIn(email);
    const app = createApp();
    const send = (path: string, body: Record<string, string>, c = cookie) => app.request(formPost(path, body, { cookie: c }), undefined, testEnv);
    const created = await send("/hub/products", { name });
    const id = /\/hub\/products\/([0-9A-Z]{26})\//.exec(created.headers.get("location") ?? "")![1]!;
    await send(`/hub/products/${id}/edit/product`, { name, slug, tagline: `${name} tagline`, category: "booking", deliveryModel: "saas", primaryLang: lang, tags: "", description: "Desc" });
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
    expect((await listActiveBadges(testEnv.DB, id)).map((b) => b.kind)).toEqual(["listed"]);
    return id;
  }

  it("finds products approved through HTTP", async () => {
    await createAndApprove("gate4-vi@vnx.si", "gate4-vi", "Phần mềm đặt lịch cho tiệm tóc", "dat-lich-toc", "vi");
    await createAndApprove("gate4-zh@vnx.si", "gate4-zh", "美发预约系统", "mei-fa-yu-yue", "zh-Hans");

    const vi = await (await get(`/vi/products?q=${encodeURIComponent("đặt lịch")}`)).text();
    expect(slugs(vi)).toEqual(["dat-lich-toc"]);
    const zh = await (await get(`/zh-hans/products?q=${encodeURIComponent("预约")}`)).text();
    expect(slugs(zh)).toEqual(["mei-fa-yu-yue"]);
  });
});
```

Ghi chú cho Implementer: nếu Hono render `selected` thành `selected=""`, regex `/<option value="crm" selected/` vẫn khớp. Nếu Hono đặt thuộc tính theo thứ tự khác (`selected` trước `value`), sửa `SelectFilter` để `value` đứng trước, **không** sửa test.

- [ ] **Step 3: Chạy test, thấy fail**

Run: `npm test -w apps/web -- test/public/products-page.test.ts`
Expected: FAIL (`/products` trả 404 qua ASSETS).

- [ ] **Step 4: Viết các component**

`apps/web/src/views/SelectFilter.tsx`:

```tsx
import type { FC } from "hono/jsx";

type Props = { id: string; name: string; label: string; any: string; value: string | null; options: { value: string; label: string }[] };

/** A GET filter: "any" (empty value) plus fixed options. */
export const SelectFilter: FC<Props> = ({ id, name, label, any, value, options }) => (
  <div class="field">
    <label for={id}>{label}</label>
    <select id={id} name={name}>
      <option value="" selected={value === null}>
        {any}
      </option>
      {options.map((o) => (
        <option value={o.value} selected={o.value === value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
```

`apps/web/src/views/Pagination.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { PAGE_SIZE } from "../domain/catalog.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";

type Props = { locale: Locale; path: string; page: number; total: number; href: (page: number) => string };

/** Previous / next links; nothing when everything fits on one page. */
export const Pagination: FC<Props> = ({ locale, path, page, total, href }) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const tr = translator(locale);
  const url = (n: number) => localizedPath(locale, path) + href(n);
  return (
    <nav class="pager" aria-label={tr("pager.label")}>
      {page > 1 ? (
        <a href={url(page - 1)} rel="prev">
          {tr("pager.prev")}
        </a>
      ) : null}
      <span>{tr("pager.status", { page, pages })}</span>
      {page < pages ? (
        <a href={url(page + 1)} rel="next">
          {tr("pager.next")}
        </a>
      ) : null}
    </nav>
  );
};
```

`apps/web/src/views/ProductCard.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { topBadge, type CatalogItem } from "../domain/catalog.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";
import { BADGE_KEY, CATEGORY_KEY } from "./labels.ts";

/** A catalogue card. "Listed" is on every published product, so only checked badges are shown. */
export const ProductCard: FC<{ locale: Locale; item: CatalogItem }> = ({ locale, item }) => {
  const tr = translator(locale);
  const badge = topBadge(item.badgeScore);
  return (
    <li>
      {item.coverKey ? <img src={`/media/${item.coverKey}`} alt="" loading="lazy" /> : null}
      <h2><a href={localizedPath(locale, `/p/${item.slug}`)}>{item.name}</a></h2>
      <p>{item.tagline}</p>
      <p class="muted">
        {item.category ? `${tr(CATEGORY_KEY[item.category])} · ` : null}
        {tr("catalog.by", { name: item.builderName })}
      </p>
      <p class="price">{item.minPriceCents !== null ? tr("catalog.from", { amount: formatUsd(locale, item.minPriceCents) }) : tr("pricing.billing.contact")}</p>
      {badge && badge !== "listed" ? (
        <p>
          <span class="badge badge-published">{tr(BADGE_KEY[badge])}</span>
        </p>
      ) : null}
    </li>
  );
};
```

(Giữ `<h2><a …>` trên một dòng: test lấy slug bằng regex `<h2><a href=…`.)

- [ ] **Step 5: Viết `CatalogPage`**

`apps/web/src/views/CatalogPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { catalogSearchParams, FILTER_BADGES, isCatalogFiltered, MAX_QUERY_CHARS, type CatalogItem, type CatalogQuery, type Paged } from "../domain/catalog.ts";
import { CATEGORIES, DELIVERY_MODELS, PRODUCT_LANGS } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BADGE_KEY, CATEGORY_KEY, DELIVERY_KEY, PRODUCT_LANG_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { Pagination } from "./Pagination.tsx";
import { ProductCard } from "./ProductCard.tsx";
import { SelectFilter } from "./SelectFilter.tsx";

type Props = { locale: Locale; origin: string; query: CatalogQuery; result: Paged<CatalogItem>; signedIn: boolean };

const usd = (cents: number | null) => (cents === null ? "" : String(cents / 100));

/** Spec §5.2 catalogue. No "Post a request" link until /request exists (Owner decision 2026-10-04, M6). */
export const CatalogPage: FC<Props> = ({ locale, origin, query, result, signedIn }) => {
  const tr = translator(locale);
  const filtered = isCatalogFiltered(query);
  return (
    <Layout
      locale={locale}
      title={`${tr("catalog.title")} · VNX.SI`}
      description={tr("catalog.description")}
      origin={origin}
      rest={`/products${catalogSearchParams(query, query.page)}`}
      noindex={filtered}
      signedIn={signedIn}
    >
      <h1>{tr("catalog.title")}</h1>
      <form class="filters" method="get" action={localizedPath(locale, "/products")} role="search">
        <div class="field">
          <label for="f-q">{tr("catalog.search")}</label>
          <input id="f-q" type="search" name="q" value={query.q} maxlength={MAX_QUERY_CHARS} />
        </div>
        <SelectFilter id="f-category" name="category" label={tr("catalog.filter.category")} any={tr("filter.any")} value={query.category} options={CATEGORIES.map((v) => ({ value: v, label: tr(CATEGORY_KEY[v]) }))} />
        <SelectFilter id="f-delivery" name="delivery" label={tr("catalog.filter.delivery")} any={tr("filter.any")} value={query.delivery} options={DELIVERY_MODELS.map((v) => ({ value: v, label: tr(DELIVERY_KEY[v]) }))} />
        <SelectFilter id="f-badge" name="badge" label={tr("catalog.filter.badge")} any={tr("filter.any")} value={query.badge} options={FILTER_BADGES.map((v) => ({ value: v, label: tr(BADGE_KEY[v]) }))} />
        <SelectFilter id="f-lang" name="lang" label={tr("catalog.filter.lang")} any={tr("filter.any")} value={query.lang} options={PRODUCT_LANGS.map((v) => ({ value: v, label: tr(PRODUCT_LANG_KEY[v]) }))} />
        <div class="field">
          <label for="f-min">{tr("catalog.filter.min")}</label>
          <input id="f-min" name="min" inputmode="decimal" value={usd(query.minCents)} />
        </div>
        <div class="field">
          <label for="f-max">{tr("catalog.filter.max")}</label>
          <input id="f-max" name="max" inputmode="decimal" value={usd(query.maxCents)} />
        </div>
        <p class="row-actions">
          <button type="submit" class="btn">
            {tr("filter.apply")}
          </button>
          {filtered ? <a href={localizedPath(locale, "/products")}>{tr("filter.clear")}</a> : null}
        </p>
      </form>
      <p class="muted">
        {tr("filter.results", { n: result.total })} · {tr("catalog.ranking")}
      </p>
      {result.items.length > 0 ? (
        <ul class="cards">
          {result.items.map((item) => (
            <ProductCard locale={locale} item={item} />
          ))}
        </ul>
      ) : (
        <p class="notice">{tr("catalog.empty")}</p>
      )}
      <Pagination locale={locale} path="/products" page={query.page} total={result.total} href={(n) => catalogSearchParams(query, n)} />
    </Layout>
  );
};
```

- [ ] **Step 6: Viết route và đăng ký**

`apps/web/src/routes/catalog.tsx`:

```tsx
import type { Hono } from "hono";
import { searchProducts } from "../db/catalog.ts";
import { parseCatalogQuery } from "../domain/catalog.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { CatalogPage } from "../views/CatalogPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerCatalogRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/products", async (c) => {
    const query = parseCatalogQuery(c.req.query());
    const result = await searchProducts(c.env.DB, query);
    // Pages past the end are not real pages (keeps crawlers out of an endless list).
    if (query.page > 1 && result.items.length === 0) return errorResponse(c, "notFound", 404);
    return page(c, <CatalogPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} result={result} signedIn={c.get("user") !== null} />);
  });
}
```

Trong `apps/web/src/app.ts`: `import { registerCatalogRoutes } from "./routes/catalog.tsx";` và gọi `registerCatalogRoutes(app);` ngay trước `registerProductPageRoutes(app);`.

- [ ] **Step 7: Link ở header**

Trong `apps/web/src/views/Layout.tsx`, ngay sau thẻ `<a class="brand" …>VNX.SI</a>`:

```tsx
            <a href={localizedPath(locale, "/products")}>{tr("nav.products")}</a>
```

(Key `nav.products` đã có ở 4 locale.)

- [ ] **Step 8: CSS**

Thêm cuối `apps/web/public/assets/app.css`:

```css
.filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 16px; align-items: end; margin-bottom: 8px; }
.filters .row-actions { margin: 0 0 16px; }
.cards { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.cards > li { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; background: var(--surface); }
.cards > li > * { margin: 0; }
.cards img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border: 1px solid var(--line); border-radius: 8px; }
.cards h2 { font-size: 18px; }
.pager { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-top: 24px; }
.pager a { display: inline-flex; align-items: center; min-height: 44px; }
```

- [ ] **Step 9: Chạy test, thấy pass; commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: exit 0, mọi test xanh.

```bash
git add apps/web/src/routes/catalog.tsx apps/web/src/views/CatalogPage.tsx apps/web/src/views/ProductCard.tsx apps/web/src/views/Pagination.tsx apps/web/src/views/SelectFilter.tsx apps/web/src/app.ts apps/web/src/views/Layout.tsx apps/web/public/assets/app.css apps/web/src/i18n/messages apps/web/test/public/products-page.test.ts
git commit -m "feat(web): /products catalogue with filters and pagination

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: VNX-0403 — Danh bạ `/builders`

**Files:**
- Create: `apps/web/src/domain/directory.ts`, `apps/web/src/db/directory.ts`
- Create: `apps/web/src/routes/directory.tsx`, `apps/web/src/views/DirectoryPage.tsx`
- Modify: `apps/web/src/app.ts`, `apps/web/src/views/Layout.tsx` (link "Find builders"), 4 file i18n
- Test: `apps/web/test/domain/directory.test.ts`, `apps/web/test/catalog/directory.test.ts`, `apps/web/test/public/builders-page.test.ts`

**Interfaces:**
- Consumes: Task 1 (`normalizeQuery`, `searchTerms`, `likePattern`, `parsePage`, `oneOf`, `PAGE_SIZE`, `Paged`, `jsonListLike`), Task 2 (`siteOrigin`), Task 3 (`Pagination`, `SelectFilter`, key `filter.*`, `pager.*`), `toBuilder`, `BuilderRow` (`db/builders.ts`), `isCountryCode` (`domain/countries.ts`), `countryName` (`views/country.ts`), `AVAILABILITIES`, `WORK_LANGUAGES`, `Builder` (`domain/builder.ts`), `CATEGORIES`.
- Produces:
  - `domain/directory.ts`: type `DirectoryQuery`, `DirectoryEntry`; `parseDirectoryQuery(params: Record<string, string | undefined>): DirectoryQuery`, `isDirectoryFiltered(q: DirectoryQuery): boolean`, `directorySearchParams(q: DirectoryQuery, page: number): string`.
  - `db/directory.ts`: `searchBuilders(db: D1Database, query: DirectoryQuery): Promise<Paged<DirectoryEntry>>`, `listDirectoryCountries(db: D1Database): Promise<string[]>`, hằng `PUBLIC_BUILDER`.
  - `registerDirectoryRoutes(app)`.

- [ ] **Step 1: Test domain (fail)**

`apps/web/test/domain/directory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { directorySearchParams, isDirectoryFiltered, parseDirectoryQuery } from "../../src/domain/directory.ts";

describe("parseDirectoryQuery", () => {
  it("keeps valid filters and ignores invalid or unknown ones", () => {
    expect(parseDirectoryQuery({ q: " lan ", category: "crm", lang: "zh", country: "vn", availability: "limited", page: "2", sort: "paid" })).toEqual({
      q: "lan",
      category: "crm",
      lang: "zh",
      country: "VN",
      availability: "limited",
      page: 2,
    });
    expect(parseDirectoryQuery({ category: "x", lang: "zh-Hans", country: "XX", availability: "busy", page: "0" })).toEqual({
      q: "",
      category: null,
      lang: null,
      country: null,
      availability: null,
      page: 1,
    });
  });

  it("has exactly the spec's inputs (ADR-004)", () => {
    expect(Object.keys(parseDirectoryQuery({})).sort()).toEqual(["availability", "category", "country", "lang", "page", "q"]);
  });

  it("writes the query back and reports filters", () => {
    const q = parseDirectoryQuery({ q: "next js", country: "VN", page: "3" });
    expect(directorySearchParams(q, 1)).toBe("?q=next+js&country=VN");
    expect(directorySearchParams(q, 2)).toBe("?q=next+js&country=VN&page=2");
    expect(isDirectoryFiltered(q)).toBe(true);
    expect(isDirectoryFiltered(parseDirectoryQuery({ page: "2" }))).toBe(false);
  });
});
```

Run: `npm test -w apps/web -- test/domain/directory.test.ts` → FAIL (module chưa có).

- [ ] **Step 2: Viết `domain/directory.ts`**

```ts
import { AVAILABILITIES, WORK_LANGUAGES, type Availability, type Builder, type WorkLanguage } from "./builder.ts";
import { normalizeQuery, oneOf, parsePage } from "./catalog.ts";
import { isCountryCode } from "./countries.ts";
import { CATEGORIES, type Category } from "./product.ts";

/** Spec §5.2 directory filters. */
export interface DirectoryQuery {
  q: string;
  /** Builders with at least one published product in this category. */
  category: Category | null;
  lang: WorkLanguage | null;
  country: string | null;
  availability: Availability | null;
  page: number;
}

export type DirectoryEntry = Pick<Builder, "handle" | "name" | "kind" | "headline" | "country" | "availability" | "skills" | "hourlyRateCents"> & {
  publishedCount: number;
};

export function parseDirectoryQuery(params: Record<string, string | undefined>): DirectoryQuery {
  const country = typeof params.country === "string" ? params.country.trim().toUpperCase() : "";
  return {
    q: normalizeQuery(params.q),
    category: oneOf(CATEGORIES, params.category),
    lang: oneOf(WORK_LANGUAGES, params.lang),
    country: isCountryCode(country) ? country : null,
    availability: oneOf(AVAILABILITIES, params.availability),
    page: parsePage(params.page),
  };
}

export function isDirectoryFiltered(q: DirectoryQuery): boolean {
  return q.q !== "" || q.category !== null || q.lang !== null || q.country !== null || q.availability !== null;
}

/** "?…" for the same search on `page`; fixed order, empty values left out. */
export function directorySearchParams(q: DirectoryQuery, page: number): string {
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.category) params.set("category", q.category);
  if (q.lang) params.set("lang", q.lang);
  if (q.country) params.set("country", q.country);
  if (q.availability) params.set("availability", q.availability);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
```

Run lại test domain → PASS.

- [ ] **Step 3: Test truy vấn (fail)**

`apps/web/test/catalog/directory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { listDirectoryCountries, searchBuilders } from "../../src/db/directory.ts";
import { createProductDraft, updateProductFields } from "../../src/db/products.ts";
import { parseDirectoryQuery } from "../../src/domain/directory.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const find = (params: Record<string, string>) => searchBuilders(testEnv.DB, parseDirectoryQuery(params));
const handles = async (params: Record<string, string>) => (await find(params)).items.map((e) => e.handle);
const approvedAt = (userId: string, at: string) => testEnv.DB.prepare("UPDATE builders SET approved_at = ?2 WHERE user_id = ?1").bind(userId, at).run();

describe("searchBuilders (spec §5.2)", () => {
  it("lists only approved builders on active accounts", async () => {
    await makeBuilder("d-ok@vnx.si", "d-ok", "approved", { name: "Pubcheck ok" });
    await makeBuilder("d-pend@vnx.si", "d-pend", "pending", { name: "Pubcheck pending" });
    await makeBuilder("d-rej@vnx.si", "d-rej", "rejected", { name: "Pubcheck rejected" });
    await makeBuilder("d-susp@vnx.si", "d-susp", "suspended", { name: "Pubcheck suspended" });
    const off = await makeBuilder("d-user@vnx.si", "d-user", "approved", { name: "Pubcheck user off" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(off.userId).run();
    expect(await handles({ q: "pubcheck" })).toEqual(["d-ok"]);
  });

  it("orders open first, then more published products, then newest approval", async () => {
    const limitedMany = await makeBuilder("d-o1@vnx.si", "d-o1", "approved", { name: "Ordcheck limited", availability: "limited" });
    const openOld = await makeBuilder("d-o2@vnx.si", "d-o2", "approved", { name: "Ordcheck open old" });
    const openNew = await makeBuilder("d-o3@vnx.si", "d-o3", "approved", { name: "Ordcheck open new" });
    const openOne = await makeBuilder("d-o4@vnx.si", "d-o4", "approved", { name: "Ordcheck open one" });
    for (let i = 0; i < 3; i++) await addLiveProduct(limitedMany, `Ordcheck item ${i}`);
    await addLiveProduct(openOne, "Ordcheck single");
    await approvedAt(openOld.userId, "2026-01-01T00:00:00.000Z");
    await approvedAt(openNew.userId, "2026-06-01T00:00:00.000Z");
    expect(await handles({ q: "ordcheck" })).toEqual(["d-o4", "d-o3", "d-o2", "d-o1"]);
    const many = (await find({ q: "ordcheck" })).items.find((e) => e.handle === "d-o1");
    expect(many?.publishedCount).toBe(3);
  });

  it("searches name and skills, case-insensitively, without LIKE wildcards", async () => {
    await makeBuilder("d-s1@vnx.si", "d-s1", "approved", { name: "Skillcheck Anh", skills: "Quokkaflow, Rust" });
    await makeBuilder("d-s2@vnx.si", "d-s2", "approved", { name: "Skillcheck Binh", skills: "Go" });
    expect(await handles({ q: "QUOKKA" })).toEqual(["d-s1"]);
    expect((await handles({ q: "skillcheck" })).sort()).toEqual(["d-s1", "d-s2"]);
    expect(await handles({ q: "skillcheck quokkaflow" })).toEqual(["d-s1"]);
    for (const q of ["%", "_", "\\", '"', "x".repeat(500)]) await expect(find({ q }), q).resolves.toBeDefined();
    expect((await find({ q: "%" })).total).toBe(0);
    expect((await find({ q: '"' })).total).toBe(0);
  });

  it("filters by category of published products, work language, country and availability", async () => {
    const crm = await makeBuilder("d-f1@vnx.si", "d-f1", "approved", { name: "Filtcheck crm", workLanguages: ["zh"], country: "SG", availability: "closed" });
    await addLiveProduct(crm, "Filtcheck crm product", { fields: { category: "crm" } });
    const draftOnly = await makeBuilder("d-f2@vnx.si", "d-f2", "approved", { name: "Filtcheck draft" });
    // A crm product that is only a draft does not put its builder in the crm filter.
    const draft = await createProductDraft(testEnv.DB, { builderId: draftOnly.userId, name: "Filtcheck draft product", now: new Date().toISOString() });
    await updateProductFields(testEnv.DB, { productId: draft.id, builderId: draftOnly.userId, expectedStatus: "draft", markEdited: false, now: new Date().toISOString(), fields: { category: "crm" } });
    await makeBuilder("d-f3@vnx.si", "d-f3", "approved", { name: "Filtcheck plain" });

    expect(await handles({ q: "filtcheck", category: "crm" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", lang: "zh" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", country: "sg" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", availability: "closed" })).toEqual(["d-f1"]);
    expect((await handles({ q: "filtcheck", lang: "vi" })).sort()).toEqual(["d-f2", "d-f3"]);
  });

  it("does not count products of other statuses or hide builders when a product is suspended", async () => {
    const b = await makeBuilder("d-c1@vnx.si", "d-c1", "approved", { name: "Countcheck" });
    const live = await addLiveProduct(b, "Countcheck live");
    await addLiveProduct(b, "Countcheck second");
    await testEnv.DB.prepare("UPDATE products SET status = 'suspended' WHERE id = ?1").bind(live.id).run();
    expect((await find({ q: "countcheck" })).items[0]?.publishedCount).toBe(1);
  });

  it("lists the countries of public builders only", async () => {
    await makeBuilder("d-k1@vnx.si", "d-k1", "approved", { country: "JP" });
    await makeBuilder("d-k2@vnx.si", "d-k2", "pending", { country: "KR" });
    const off = await makeBuilder("d-k3@vnx.si", "d-k3", "approved", { country: "FR" });
    await setBuilderStatus(testEnv.DB, { userId: off.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const countries = await listDirectoryCountries(testEnv.DB);
    expect(countries).toContain("JP");
    expect(countries).not.toContain("KR");
    expect(countries).not.toContain("FR");
    expect([...countries].sort()).toEqual(countries);
  });
});
```

Run: `npm test -w apps/web -- test/catalog/directory.test.ts` → FAIL (module chưa có).

- [ ] **Step 4: Viết `db/directory.ts`**

```ts
import { likePattern, PAGE_SIZE, searchTerms, type Paged } from "../domain/catalog.ts";
import type { DirectoryEntry, DirectoryQuery } from "../domain/directory.ts";
import { toBuilder, type BuilderRow } from "./builders.ts";
import { jsonListLike } from "./catalog.ts";

/** Spec §7.1, §8.2: approved builders on active accounts. Aliases: b, u. */
export const PUBLIC_BUILDER = "b.status = 'approved' AND u.status = 'active'";

// Builder and user are public, so every published product of theirs is public too.
const PUBLISHED_COUNT = "(SELECT COUNT(*) FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published')";

type EntryRow = BuilderRow & { published_count: number };

function toEntry(r: EntryRow): DirectoryEntry {
  const b = toBuilder(r);
  return {
    handle: b.handle,
    name: b.name,
    kind: b.kind,
    headline: b.headline,
    country: b.country,
    availability: b.availability,
    skills: b.skills,
    hourlyRateCents: b.hourlyRateCents,
    publishedCount: r.published_count,
  };
}

/**
 * Spec §5.2 directory: every term must match the name or a skill. Order: availability "open" first, then more
 * published products, then the newest approval. ADR-004: no other input reaches the order.
 */
export async function searchBuilders(db: D1Database, query: DirectoryQuery): Promise<Paged<DirectoryEntry>> {
  const params: (string | number)[] = [];
  const bind = (value: string | number) => {
    params.push(value);
    return `?${params.length}`;
  };
  const where = [PUBLIC_BUILDER];
  for (const term of searchTerms(query.q)) {
    const pattern = bind(likePattern(term));
    where.push(`(b.name LIKE ${pattern} ESCAPE '\\' OR ${jsonListLike("b.skills", pattern)})`);
  }
  if (query.category) where.push(`EXISTS (SELECT 1 FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published' AND p.category = ${bind(query.category)})`);
  if (query.lang) {
    where.push(`EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(b.work_languages) THEN b.work_languages ELSE '[]' END) WHERE value = ${bind(query.lang)})`);
  }
  if (query.country) where.push(`b.country = ${bind(query.country)}`);
  if (query.availability) where.push(`b.availability = ${bind(query.availability)}`);
  const filter = where.join(" AND ");
  const from = "builders b JOIN users u ON u.id = b.user_id";
  // page is an integer 1–9999 from parsePage.
  const offset = (query.page - 1) * PAGE_SIZE;
  const list = db
    .prepare(
      `SELECT b.*, ${PUBLISHED_COUNT} AS published_count FROM ${from} WHERE ${filter}
       ORDER BY (b.availability = 'open') DESC, published_count DESC, b.approved_at DESC, b.user_id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    )
    .bind(...params);
  const count = db.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${filter}`).bind(...params);
  const [rows, total] = await db.batch([list, count]);
  return { items: ((rows?.results ?? []) as EntryRow[]).map(toEntry), total: (total?.results[0] as { n: number } | undefined)?.n ?? 0 };
}

/** Countries of public builders, for the country filter. */
export async function listDirectoryCountries(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT b.country AS country FROM builders b JOIN users u ON u.id = b.user_id WHERE ${PUBLIC_BUILDER} ORDER BY b.country`)
    .all<{ country: string }>();
  return results.map((r) => r.country);
}
```

Run: `npm test -w apps/web -- test/catalog/directory.test.ts` → PASS.

- [ ] **Step 5: Key i18n**

Thêm vào cuối từng file locale (sau các key của Task 3):

`en.ts`:

```ts
  "directory.title": "Find builders",
  "directory.description": "Reviewed builders who ship AI-built products. Nobody can pay to rank higher.",
  "directory.search": "Name or skill",
  "directory.filter.category": "Has products in",
  "directory.filter.lang": "Works in",
  "directory.filter.country": "Country",
  "directory.filter.availability": "Availability",
  "directory.empty": "No builders match yet. Try fewer words or clear the filters.",
  "directory.products": "Published products: {n}",
  "directory.ranking": "Order: open to new work first, then most published products, then newest. Nobody can pay to rank higher.",
```

`vi.ts`:

```ts
  "directory.title": "Tìm builder",
  "directory.description": "Các builder đã được duyệt, làm sản phẩm bằng AI. Không ai trả tiền để được xếp cao hơn.",
  "directory.search": "Tên hoặc kỹ năng",
  "directory.filter.category": "Có sản phẩm thuộc",
  "directory.filter.lang": "Ngôn ngữ làm việc",
  "directory.filter.country": "Quốc gia",
  "directory.filter.availability": "Tình trạng nhận việc",
  "directory.empty": "Chưa có builder phù hợp. Thử ít từ hơn hoặc xóa bộ lọc.",
  "directory.products": "Sản phẩm đã đăng: {n}",
  "directory.ranking": "Thứ tự: đang nhận việc trước, rồi nhiều sản phẩm đã đăng hơn, rồi mới tham gia. Không ai trả tiền để được xếp cao hơn.",
```

`zh-hans.ts`:

```ts
  "directory.title": "寻找开发者",
  "directory.description": "经过审核、用 AI 交付产品的开发者。没有人能花钱提升排名。",
  "directory.search": "名称或技能",
  "directory.filter.category": "有以下类别的产品",
  "directory.filter.lang": "工作语言",
  "directory.filter.country": "国家/地区",
  "directory.filter.availability": "接单状态",
  "directory.empty": "暂时没有符合条件的开发者。请减少关键词或清除筛选。",
  "directory.products": "已发布产品：{n}",
  "directory.ranking": "排序：可接新项目的优先，其次是已发布产品较多的，再其次是最新加入的。没有人能花钱提升排名。",
```

`zh-hant.ts`:

```ts
  "directory.title": "尋找開發者",
  "directory.description": "經過審核、用 AI 交付產品的開發者。沒有人能花錢提升排名。",
  "directory.search": "名稱或技能",
  "directory.filter.category": "有以下類別的產品",
  "directory.filter.lang": "工作語言",
  "directory.filter.country": "國家/地區",
  "directory.filter.availability": "接案狀態",
  "directory.empty": "暫時沒有符合條件的開發者。請減少關鍵字或清除篩選。",
  "directory.products": "已發布產品：{n}",
  "directory.ranking": "排序：可接新專案的優先，其次是已發布產品較多的，再其次是最新加入的。沒有人能花錢提升排名。",
```

- [ ] **Step 6: Test trang (fail)**

`apps/web/test/public/builders-page.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);
const handles = (html: string) => [...html.matchAll(/<h2><a href="(?:\/[a-z-]+)?\/b\/([a-z0-9-]+)"/g)].map((m) => m[1]);

describe("/builders (spec §5.2)", () => {
  it("renders cards with name, headline, kind, country, availability, rate, skills and product count", async () => {
    const b = await makeBuilder("bp-card@vnx.si", "bp-card", "approved", { name: "Cardbuilder Lan", headline: "Booking <b>apps</b>" });
    await addLiveProduct(b, "Cardbuilder product");
    const res = await get("/builders?q=cardbuilder");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Cardbuilder Lan", "Booking &lt;b&gt;apps&lt;/b&gt;", "Individual", "Vietnam", "Open to new work", "$45/hour", "Next.js", "Published products: 1", "Results: 1"]) {
      expect(html, text).toContain(text);
    }
    expect(handles(html)).toEqual(["bp-card"]);
    expect(html).toContain("Nobody can pay to rank higher.");
    expect(html).not.toContain("/request");
  });

  it("offers only countries of public builders and keeps the chosen filters", async () => {
    await makeBuilder("bp-c1@vnx.si", "bp-c1", "approved", { name: "Countrycheck", country: "TH" });
    const html = await (await get("/vi/builders?country=TH&lang=vi&availability=open&category=crm&q=countrycheck")).text();
    expect(html).toMatch(/<option value="TH" selected/);
    expect(html).toMatch(/<option value="vi" selected/);
    expect(html).toMatch(/<option value="open" selected/);
    expect(html).toMatch(/<option value="crm" selected/);
    expect(html).toContain('action="/vi/builders"');
    expect(html).toContain("Thái Lan");
  });

  it("returns 200 for hostile input and 404 past the last page", async () => {
    for (const p of ["q=%25", "q=%22", "q=" + "x".repeat(500), "page=abc", "page=0", "country=%3Cx%3E", "lang=zh-Hans"]) {
      expect((await get(`/builders?${p}`)).status, p).toBe(200);
    }
    expect((await get("/builders?q=nobody-at-all-here&page=2")).status).toBe(404);
  });

  it("is indexable only without search or filters", async () => {
    const plain = await (await get("/zh-hant/builders")).text();
    expect(plain).toContain('<link rel="canonical" href="https://vnx.si/zh-hant/builders"');
    expect(plain).toContain('<link rel="alternate" hreflang="vi" href="https://vnx.si/vi/builders"');
    const filtered = await (await get("/builders?availability=open")).text();
    expect(filtered).toContain('<meta name="robots" content="noindex"');
    expect(filtered).not.toContain('rel="canonical"');
  });

  it("ignores parameters outside the spec (ADR-004)", async () => {
    await makeBuilder("bp-a1@vnx.si", "bp-a1", "approved", { name: "Adrbuilder one", availability: "limited" });
    await makeBuilder("bp-a2@vnx.si", "bp-a2", "approved", { name: "Adrbuilder two" });
    const plain = handles(await (await get("/builders?q=adrbuilder")).text());
    const paid = handles(await (await get("/builders?q=adrbuilder&sort=rate&boost=bp-a1&sponsored=1&featured=1")).text());
    expect(plain).toEqual(["bp-a2", "bp-a1"]);
    expect(paid).toEqual(plain);
  });

  it("links to the directory from the header", async () => {
    const html = await (await get("/zh-hans/b/no-such-builder")).text();
    const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(header).toContain('<a href="/zh-hans/builders">寻找开发者</a>');
  });
});
```

Run: `npm test -w apps/web -- test/public/builders-page.test.ts` → FAIL.

- [ ] **Step 7: Viết `DirectoryPage`**

`apps/web/src/views/DirectoryPage.tsx`:

```tsx
import type { FC } from "hono/jsx";
import { AVAILABILITIES, WORK_LANGUAGES } from "../domain/builder.ts";
import { MAX_QUERY_CHARS, type Paged } from "../domain/catalog.ts";
import { directorySearchParams, isDirectoryFiltered, type DirectoryEntry, type DirectoryQuery } from "../domain/directory.ts";
import { CATEGORIES } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { countryName } from "./country.ts";
import { formatUsd } from "./format.ts";
import { AVAILABILITY_KEY, CATEGORY_KEY, KIND_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { Pagination } from "./Pagination.tsx";
import { SelectFilter } from "./SelectFilter.tsx";

type Props = { locale: Locale; origin: string; query: DirectoryQuery; result: Paged<DirectoryEntry>; countries: string[]; signedIn: boolean };

const MAX_SKILLS = 6;

/** Spec §5.2 directory. No "Post a request" button until /request exists (Owner decision 2026-10-04, M6). */
export const DirectoryPage: FC<Props> = ({ locale, origin, query, result, countries, signedIn }) => {
  const tr = translator(locale);
  const filtered = isDirectoryFiltered(query);
  const countryOptions = countries.map((code) => ({ value: code, label: countryName(locale, code) })).sort((a, b) => a.label.localeCompare(b.label, locale));
  return (
    <Layout
      locale={locale}
      title={`${tr("directory.title")} · VNX.SI`}
      description={tr("directory.description")}
      origin={origin}
      rest={`/builders${directorySearchParams(query, query.page)}`}
      noindex={filtered}
      signedIn={signedIn}
    >
      <h1>{tr("directory.title")}</h1>
      <form class="filters" method="get" action={localizedPath(locale, "/builders")} role="search">
        <div class="field">
          <label for="d-q">{tr("directory.search")}</label>
          <input id="d-q" type="search" name="q" value={query.q} maxlength={MAX_QUERY_CHARS} />
        </div>
        <SelectFilter id="d-category" name="category" label={tr("directory.filter.category")} any={tr("filter.any")} value={query.category} options={CATEGORIES.map((v) => ({ value: v, label: tr(CATEGORY_KEY[v]) }))} />
        <SelectFilter id="d-lang" name="lang" label={tr("directory.filter.lang")} any={tr("filter.any")} value={query.lang} options={WORK_LANGUAGES.map((v) => ({ value: v, label: tr(LANGUAGE_KEY[v]) }))} />
        <SelectFilter id="d-country" name="country" label={tr("directory.filter.country")} any={tr("filter.any")} value={query.country} options={countryOptions} />
        <SelectFilter id="d-availability" name="availability" label={tr("directory.filter.availability")} any={tr("filter.any")} value={query.availability} options={AVAILABILITIES.map((v) => ({ value: v, label: tr(AVAILABILITY_KEY[v]) }))} />
        <p class="row-actions">
          <button type="submit" class="btn">
            {tr("filter.apply")}
          </button>
          {filtered ? <a href={localizedPath(locale, "/builders")}>{tr("filter.clear")}</a> : null}
        </p>
      </form>
      <p class="muted">
        {tr("filter.results", { n: result.total })} · {tr("directory.ranking")}
      </p>
      {result.items.length > 0 ? (
        <ul class="cards">
          {result.items.map((e) => (
            <li>
              <h2><a href={localizedPath(locale, `/b/${e.handle}`)}>{e.name}</a></h2>
              <p>{e.headline}</p>
              <p class="muted">
                {tr(KIND_KEY[e.kind])} · {countryName(locale, e.country)}
              </p>
              <p>
                <span class={`badge badge-avail-${e.availability}`}>{tr(AVAILABILITY_KEY[e.availability])}</span>
                {e.hourlyRateCents !== null ? <span class="rate">{tr("bprofile.rate", { amount: formatUsd(locale, e.hourlyRateCents) })}</span> : null}
              </p>
              {e.skills.length > 0 ? (
                <ul class="chips">
                  {e.skills.slice(0, MAX_SKILLS).map((s) => (
                    <li>{s}</li>
                  ))}
                </ul>
              ) : null}
              <p class="muted">{tr("directory.products", { n: e.publishedCount })}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p class="notice">{tr("directory.empty")}</p>
      )}
      <Pagination locale={locale} path="/builders" page={query.page} total={result.total} href={(n) => directorySearchParams(query, n)} />
    </Layout>
  );
};
```

- [ ] **Step 8: Route, đăng ký, link ở header**

`apps/web/src/routes/directory.tsx`:

```tsx
import type { Hono } from "hono";
import { listDirectoryCountries, searchBuilders } from "../db/directory.ts";
import { parseDirectoryQuery } from "../domain/directory.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { DirectoryPage } from "../views/DirectoryPage.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

export function registerDirectoryRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/builders", async (c) => {
    const query = parseDirectoryQuery(c.req.query());
    const [result, countries] = await Promise.all([searchBuilders(c.env.DB, query), listDirectoryCountries(c.env.DB)]);
    if (query.page > 1 && result.items.length === 0) return errorResponse(c, "notFound", 404);
    return page(
      c,
      <DirectoryPage locale={c.get("locale")} origin={siteOrigin(c)} query={query} result={result} countries={countries} signedIn={c.get("user") !== null} />,
    );
  });
}
```

`apps/web/src/app.ts`: import và gọi `registerDirectoryRoutes(app);` ngay sau `registerCatalogRoutes(app);`.

`apps/web/src/views/Layout.tsx`: ngay sau link `nav.products`:

```tsx
            <a href={localizedPath(locale, "/builders")}>{tr("nav.findBuilders")}</a>
```

- [ ] **Step 9: Chạy test, thấy pass; commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: exit 0, mọi test xanh.

```bash
git add apps/web/src/domain/directory.ts apps/web/src/db/directory.ts apps/web/src/routes/directory.tsx apps/web/src/views/DirectoryPage.tsx apps/web/src/app.ts apps/web/src/views/Layout.tsx apps/web/src/i18n/messages apps/web/test/domain/directory.test.ts apps/web/test/catalog/directory.test.ts apps/web/test/public/builders-page.test.ts
git commit -m "feat(web): /builders directory with search, filters and neutral order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: VNX-0404b — `sitemap.xml` và `robots.txt`

**Files:**
- Create: `apps/web/src/views/seo.ts`, `apps/web/src/routes/seo.ts`
- Modify: `apps/web/src/db/products.ts` (`listSitemapProducts`), `apps/web/src/db/builders.ts` (`listSitemapBuilders`), `apps/web/src/app.ts`
- Test: `apps/web/test/seo/sitemap.test.ts`, `apps/web/test/seo/robots.test.ts`

**Interfaces:**
- Consumes: `PUBLIC_PRODUCT` (Task 1), `siteOrigin` (Task 2), `alternates`, `LOCALES`, `localizedPath` (`i18n/locales.ts`).
- Produces: `renderSitemap(origin: string, entries: SitemapEntry[]): string`, `renderRobots(origin: string): string`, `type SitemapEntry = { rest: string; lastmod?: string; localized: boolean }` (`views/seo.ts`); `listSitemapProducts(db, limit?)`, `listSitemapBuilders(db, limit?)`; `registerSeoRoutes(app)`.

- [ ] **Step 1: Test (fail)**

`apps/web/test/seo/robots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

describe("/robots.txt (spec §8.8)", () => {
  it("blocks private areas in every locale, allows product images and names the sitemap on APP_ORIGIN", async () => {
    const res = await createApp().request(new Request("https://vnxsi-web.preview.workers.dev/robots.txt"), undefined, testEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const lines = (await res.text()).split("\n");
    expect(lines[0]).toBe("User-agent: *");
    for (const path of ["/hub", "/me", "/admin", "/auth", "/vi/hub", "/zh-hans/me", "/zh-hant/admin", "/vi/auth", "/media"]) {
      expect(lines, path).toContain(`Disallow: ${path}`);
    }
    expect(lines).toContain("Allow: /media/products/");
    expect(lines).toContain("Sitemap: https://vnx.si/sitemap.xml");
    expect(lines.filter((l) => l.startsWith("Disallow: /products") || l.startsWith("Disallow: /builders") || l.startsWith("Disallow: /p/"))).toEqual([]);
  });
});
```

`apps/web/test/seo/sitemap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { setProductStatus } from "../../src/db/products.ts";
import { renderSitemap } from "../../src/views/seo.ts";
import { makeBuilder, makeDraft, makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const fetchSitemap = async () => {
  const res = await createApp().request(new Request("https://vnxsi-web.preview.workers.dev/sitemap.xml"), undefined, testEnv);
  return { res, xml: await res.text() };
};

describe("/sitemap.xml (spec §8.8)", () => {
  it("lists public products and builders in 4 locales with hreflang alternates, on APP_ORIGIN", async () => {
    const { builder, product } = await makeLiveProduct("sm-live@vnx.si", "sm-live", "Sitemap Live", { at: "2026-09-30T08:00:00.000Z" });
    const { res, xml } = await fetchSitemap();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    for (const loc of [`https://vnx.si/p/${product.slug}`, `https://vnx.si/vi/p/${product.slug}`, `https://vnx.si/zh-hans/p/${product.slug}`, `https://vnx.si/zh-hant/p/${product.slug}`]) {
      expect(xml, loc).toContain(`<loc>${loc}</loc>`);
    }
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="https://vnx.si/p/${product.slug}"/>`);
    expect(xml).toContain(`<loc>https://vnx.si/zh-hant/b/${builder.handle}</loc>`);
    for (const loc of ["https://vnx.si/products", "https://vnx.si/vi/builders", "https://vnx.si/"]) expect(xml, loc).toContain(`<loc>${loc}</loc>`);
    expect(xml).not.toContain("<loc>https://vnx.si/vi/</loc>");
    expect(xml).not.toContain("preview.workers.dev");
    expect(xml).not.toContain("/request");
  });

  it("leaves out everything that is not public", async () => {
    const { product: draft } = await makeDraft("sm-draft@vnx.si", "sm-draft", "Sitemap Draft");
    const unlisted = await makeLiveProduct("sm-unl@vnx.si", "sm-unl", "Sitemap Unlisted");
    await setProductStatus(testEnv.DB, { id: unlisted.product.id, from: "published", to: "unlisted", reviewNote: null, now: new Date().toISOString() });
    const hidden = await makeLiveProduct("sm-hid@vnx.si", "sm-hid", "Sitemap Hidden");
    await setBuilderStatus(testEnv.DB, { userId: hidden.builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    await makeBuilder("sm-pend@vnx.si", "sm-pend", "pending");
    const { xml } = await fetchSitemap();
    for (const slug of [draft.slug, unlisted.product.slug, hidden.product.slug]) expect(xml, slug).not.toContain(`/p/${slug}<`);
    expect(xml).not.toContain("/b/sm-hid<");
    expect(xml).not.toContain("/b/sm-pend<");
  });

  it("escapes XML and writes lastmod as a date", () => {
    const xml = renderSitemap("https://vnx.si", [{ rest: "/p/a&b", lastmod: "2026-09-30T08:00:00.000Z", localized: true }]);
    expect(xml).toContain("<loc>https://vnx.si/p/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-09-30</lastmod>");
    expect(xml.match(/<url>/g)).toHaveLength(4);
    expect(xml.match(/<xhtml:link /g)).toHaveLength(20);
  });
});
```

Run: `npm test -w apps/web -- test/seo` → FAIL (route chưa có; `/robots.txt` rơi về ASSETS 404).

- [ ] **Step 2: `views/seo.ts`**

```ts
import { alternates, LOCALES, localizedPath } from "../i18n/locales.ts";

/** One page of the site. A localized page is listed once per locale, each with every alternate (spec §8.8). */
export type SitemapEntry = { rest: string; lastmod?: string; localized: boolean };

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function renderSitemap(origin: string, entries: SitemapEntry[]): string {
  const urls: string[] = [];
  for (const entry of entries) {
    const lastmod = entry.lastmod ? `<lastmod>${xml(entry.lastmod.slice(0, 10))}</lastmod>` : "";
    if (!entry.localized) {
      urls.push(`<url><loc>${xml(origin + entry.rest)}</loc>${lastmod}</url>`);
      continue;
    }
    const links = alternates(origin, entry.rest)
      .map((a) => `<xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`)
      .join("");
    for (const locale of LOCALES) urls.push(`<url><loc>${xml(origin + localizedPath(locale, entry.rest))}</loc>${lastmod}${links}</url>`);
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Spec §8.8: private areas are blocked in every locale; product images stay crawlable for og:image (Owner 2026-10-04). */
const PRIVATE = ["/hub", "/me", "/admin", "/auth"];

export function renderRobots(origin: string): string {
  const disallow = new Set<string>();
  for (const locale of LOCALES) for (const path of PRIVATE) disallow.add(localizedPath(locale, path));
  return ["User-agent: *", "Allow: /media/products/", "Disallow: /media", ...[...disallow].map((p) => `Disallow: ${p}`), "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
}
```

- [ ] **Step 3: Truy vấn sitemap**

Cuối `apps/web/src/db/products.ts`:

```ts
/** Public products for the sitemap, newest approval first. The cap keeps the sitemap under 50,000 URLs (× 4 locales). */
export async function listSitemapProducts(db: D1Database, limit = 10000): Promise<{ slug: string; updatedAt: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT p.slug, p.updated_at FROM products p JOIN builders b ON b.user_id = p.builder_id JOIN users u ON u.id = p.builder_id
       WHERE ${PUBLIC_PRODUCT} ORDER BY p.published_at DESC, p.id LIMIT ?1`,
    )
    .bind(limit)
    .all<{ slug: string; updated_at: string }>();
  return results.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}
```

Cuối `apps/web/src/db/builders.ts`:

```ts
/** Public builders for the sitemap. The cap keeps the sitemap under 50,000 URLs (× 4 locales). */
export async function listSitemapBuilders(db: D1Database, limit = 2000): Promise<{ handle: string; updatedAt: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT b.handle, b.updated_at FROM builders b JOIN users u ON u.id = b.user_id
       WHERE b.status = 'approved' AND u.status = 'active' ORDER BY b.approved_at DESC, b.user_id LIMIT ?1`,
    )
    .bind(limit)
    .all<{ handle: string; updated_at: string }>();
  return results.map((r) => ({ handle: r.handle, updatedAt: r.updated_at }));
}
```

(10 000 product + 2 000 builder + 2 trang danh sách, × 4 locale, + `/` = 48 009 URL.)

- [ ] **Step 4: Route và đăng ký**

`apps/web/src/routes/seo.ts`:

```ts
import type { Hono } from "hono";
import { listSitemapBuilders } from "../db/builders.ts";
import { listSitemapProducts } from "../db/products.ts";
import type { AppEnv } from "../env.ts";
import { siteOrigin } from "../http/origin.ts";
import { renderRobots, renderSitemap, type SitemapEntry } from "../views/seo.ts";

const CACHE = "public, max-age=3600";

export function registerSeoRoutes(app: Hono<AppEnv>) {
  app.get("/robots.txt", (c) => c.text(renderRobots(siteOrigin(c)), 200, { "cache-control": CACHE }));

  app.get("/sitemap.xml", async (c) => {
    const [products, builders] = await Promise.all([listSitemapProducts(c.env.DB), listSitemapBuilders(c.env.DB)]);
    const entries: SitemapEntry[] = [
      // The home page has no locale versions until the M7 cutover.
      { rest: "/", localized: false },
      { rest: "/products", localized: true },
      { rest: "/builders", localized: true },
      ...products.map((p) => ({ rest: `/p/${p.slug}`, lastmod: p.updatedAt, localized: true })),
      ...builders.map((b) => ({ rest: `/b/${b.handle}`, lastmod: b.updatedAt, localized: true })),
    ];
    return c.body(renderSitemap(siteOrigin(c), entries), 200, { "content-type": "application/xml; charset=utf-8", "cache-control": CACHE });
  });
}
```

`apps/web/src/app.ts`: import và gọi `registerSeoRoutes(app);` ngay sau `registerDirectoryRoutes(app);`.

- [ ] **Step 5: Chạy test, thấy pass; commit**

Run: `npm run typecheck -w apps/web && npm test`
Expected: exit 0, mọi test xanh.

```bash
git add apps/web/src/views/seo.ts apps/web/src/routes/seo.ts apps/web/src/db/products.ts apps/web/src/db/builders.ts apps/web/src/app.ts apps/web/test/seo/sitemap.test.ts apps/web/test/seo/robots.test.ts
git commit -m "feat(web): sitemap.xml with hreflang alternates and robots.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cổng ra M4 → test

| Tiêu chí | Test |
|---|---|
| Tìm được bằng tiếng Việt có dấu | `test/public/products-page.test.ts` "M4 exit gate" (qua HTTP: tạo → submit → duyệt → `/vi/products?q=đặt lịch`); `test/catalog/search.test.ts` |
| Tìm được bằng tiếng Trung 2 ký tự | cùng test cổng ra (`/zh-hans/products?q=预约`); `test/catalog/search.test.ts` |
| Không có tham số xếp hạng trả tiền | `test/catalog/ranking.test.ts` (schema, tham số lạ, thứ tự theo spec); `test/domain/catalog.test.ts` và `test/domain/directory.test.ts` (đúng tập khóa đầu vào); `test/public/products-page.test.ts`, `test/public/builders-page.test.ts` (tham số lạ qua HTTP) |

Spec mục 9 phủ thêm: "Danh bạ builder chỉ hiện builder `approved`, lọc đúng theo category và ngôn ngữ" (`test/catalog/directory.test.ts`); "Builder bị khóa → product biến mất khỏi catalogue" (`test/catalog/search.test.ts`); "Trang public trả đúng hreflang cho 4 locale" (`test/seo/canonical.test.ts`, các test trang).

## Nghĩa vụ để lại sau M4 (Reviewer ghi vào `CURRENT-STATUS.md` khi xong)

- **Deploy:** `db:migrate:remote` phải áp thêm `0006_catalog` (cập nhật comment thứ tự deploy trong `wrangler.jsonc` ở task cuối hoặc ở lượt sửa sau review).
- **M6:** nút "Post a request" ở `/builders` và ở trạng thái rỗng của `/products`; thêm `/request` vào sitemap.
- **M7:** `/`, `/for-builders`, `/terms`, `/privacy` vào sitemap với đủ alternate khi có bản locale.
- **M8 (runbook):** `wrangler d1 export` không xuất được bảng ảo FTS5; backup / khôi phục phải tạo lại `products_fts` (chạy lại khối backfill của `0006_catalog`).
- **Sau Wave 1:** sitemap index khi vượt 10 000 product.

## Ghi nhận (dự kiến)

- Tìm tiếng Việt không dấu không được hỗ trợ (quyết định Owner 2026-10-04).
- Nội dung product không được chuẩn hóa NFC khi lưu (từ M3); truy vấn có chuẩn hóa. Văn bản dán từ nguồn NFD có thể không khớp.
- `LIKE` của SQLite chỉ không phân biệt hoa thường với ASCII: từ khóa 1–2 ký tự có dấu viết hoa ("ĐẶ") không khớp chữ thường.
