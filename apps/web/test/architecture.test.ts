import { describe, expect, it } from "vitest";

const domain = import.meta.glob("../src/domain/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const views = import.meta.glob("../src/views/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("module boundaries (ARCHITECTURE.md §2)", () => {
  it("domain/ imports neither hono nor db and never touches D1", () => {
    for (const [file, src] of Object.entries(domain)) {
      expect(src, file).not.toMatch(/from\s+["']hono(\/[^"']*)?["']/);
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
      expect(src, file).not.toMatch(/D1Database/);
    }
  });

  it("views/ never import db", () => {
    for (const [file, src] of Object.entries(views)) {
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
    }
  });
});

const sources = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

// Each table is written (INSERT/UPDATE/DELETE) by exactly one module. Reads may join freely.
const WRITERS: Record<string, string> = {
  users: "../src/db/users.ts",
  sessions: "../src/auth/sessions.ts",
  login_tokens: "../src/auth/tokens.ts",
  rate_limits: "../src/http/rate-limit.ts",
  audit_log: "../src/db/audit.ts",
  waitlist: "../src/db/waitlist.ts",
  builders: "../src/db/builders.ts",
  invites: "../src/db/invites.ts",
  portfolio_items: "../src/db/portfolio.ts",
  products: "../src/db/products.ts",
  pricing_tiers: "../src/db/pricing.ts",
  product_media: "../src/db/media.ts",
  product_verifications: "../src/db/verifications.ts",
  inquiries: "../src/db/inquiries.ts",
  inquiry_messages: "../src/db/inquiries.ts",
  requests: "../src/db/requests.ts",
  request_invites: "../src/db/requests.ts",
  feedback: "../src/db/feedback.ts",
  feature_flags: "../src/db/flags.ts",
  merchants: "../src/db/merchants.ts",
  partner_programs: "../src/db/programs.ts",
  offers: "../src/db/offers.ts",
  outbound_clicks: "../src/db/clicks.ts",
  product_daily_stats: "../src/db/stats.ts",
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

// ADR-007 rule 2: ranking and suggestion code never reads money. Tables and modules of the monetization module.
const MONEY_TABLES = ["merchants", "partner_programs", "offers", "conversions", "revenue_entries", "outbound_clicks"];
const MONEY_DB = ["merchants", "programs", "offers", "conversions", "revenue", "clicks"];
// Every file that ranks, searches or suggests. Add a file here when it starts to order results.
const RANKING_FILES = [
  "../src/domain/catalog.ts",
  "../src/domain/directory.ts",
  "../src/domain/request.ts",
  "../src/db/catalog.ts",
  "../src/db/directory.ts",
  "../src/db/requests.ts",
  "../src/routes/catalog.tsx",
  "../src/routes/directory.tsx",
  "../src/views/CatalogPage.tsx",
  "../src/views/DirectoryPage.tsx",
  "../src/routes/admin-requests.tsx",
  "../src/views/admin/RequestDetailPage.tsx",
  // VNX-0702a (public statistics): Trending, Top builders/products, Live. The db file joins in 5b.
  "../src/domain/public-stats.ts",
];

// Allowlist: only these files may import a monetization db module or run SQL on a money table. Each task adds
// the files it creates (Task 2c: db/{merchants,programs}.ts, and db/audit.ts, which only reads `write_id` of those rows to guard audit rows; Task 2d: db/offers.ts (setDefaultOffer stays in db/merchants.ts, which owns `merchants`); Task 3: routes/admin-merchants.tsx only (views take structural prop types and may not import db); Task 4: db/clicks.ts,
// routes/go.ts, jobs/daily.ts; Task 5: routes/tools.tsx, routes/seo.ts; Task 6: routes/legal.tsx).
const MONEY_ALLOWED = new Set<string>(["../src/db/merchants.ts", "../src/db/programs.ts", "../src/db/offers.ts", "../src/db/audit.ts", "../src/routes/admin-merchants.tsx", "../src/db/clicks.ts", "../src/jobs/daily.ts", "../src/routes/go.ts", "../src/routes/tools.tsx", "../src/routes/seo.ts", "../src/routes/legal.tsx"]);

/** Resolves a relative import specifier against the importing file's key (both in the `../src/...` form of import.meta.glob). */
function resolveSpec(file: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const parts = file.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === ".." && parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
/**
 * True when `src` (the file `file`) imports the monetization db module `name` (ADR-007 rule 2): `import … from`, side-effect `import "x"`,
 * `export … from` and dynamic `import("x")`, with the path resolved relative to `file` so a sibling `./offers.ts` from a db file is caught.
 * Indirect imports (through db/products.ts, say) are not followed; see "Ghi nhận".
 */
function importsMoneyDb(file: string, src: string, name: string): boolean {
  const target = `../src/db/${name}.ts`;
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) if (resolveSpec(file, m[1] ?? "") === target) return true;
  return false;
}
/** True when `src` runs SQL on money table `table`. Case-insensitive: lower-case SQL must not slip past (review F6). */
const touchesMoneyTable = (src: string, table: string) => new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, "i").test(src);

describe("ranking never reads money (ADR-007 rule 2, ADR-004)", () => {
  it("lists only files that exist", () => {
    for (const file of RANKING_FILES) expect(sources[file], file).toBeDefined();
  });

  it("after Task 6 the allowlist is exactly the files of Tasks 2c-6", () => {
    expect([...MONEY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/clicks.ts", "../src/db/merchants.ts", "../src/db/offers.ts", "../src/db/programs.ts", "../src/jobs/daily.ts", "../src/routes/admin-merchants.tsx", "../src/routes/go.ts", "../src/routes/legal.tsx", "../src/routes/seo.ts", "../src/routes/tools.tsx"]);
  });

  it("the allowlist holds only files that exist, and no ranking file is on it", () => {
    for (const file of MONEY_ALLOWED) expect(sources[file], file).toBeDefined();
    for (const file of RANKING_FILES) expect(MONEY_ALLOWED.has(file), file).toBe(false);
  });

  it("ranking files import no monetization db module", () => {
    for (const file of RANKING_FILES) {
      for (const name of MONEY_DB) {
        expect(importsMoneyDb(file, sources[file]!, name), `${file} imports db/${name}`).toBe(false);
      }
    }
  });

  it("ranking files have no SQL on a money table", () => {
    for (const file of RANKING_FILES) {
      for (const table of MONEY_TABLES) {
        expect(touchesMoneyTable(sources[file]!, table), `${file} reads ${table}`).toBe(false);
      }
    }
  });

  it("only allowlisted files import a money db module or touch a money table", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (MONEY_ALLOWED.has(file)) continue;
      for (const name of MONEY_DB) expect(importsMoneyDb(file, src, name), `${file} imports db/${name}`).toBe(false);
      for (const table of MONEY_TABLES) expect(touchesMoneyTable(src, table), `${file} touches ${table}`).toBe(false);
    }
  });

  it("the detectors catch what they are meant to catch (positive control, review F6)", () => {
    expect(importsMoneyDb("../src/domain/x.ts", `import { listOffers } from "../db/offers.ts";`, "offers")).toBe(true);
    expect(importsMoneyDb("../src/db/x.ts", `import { y } from "./offers.ts";`, "offers")).toBe(true); // sibling import inside src/db
    expect(importsMoneyDb("../src/db/x.ts", `import "./offers.ts";`, "offers")).toBe(true); // side-effect import
    expect(importsMoneyDb("../src/db/x.ts", `export * from './clicks.ts'`, "clicks")).toBe(true);
    expect(importsMoneyDb("../src/db/x.ts", `export { y } from "./clicks.ts";`, "clicks")).toBe(true);
    expect(importsMoneyDb("../src/routes/x.ts", `const m = await import("../db/merchants.ts");`, "merchants")).toBe(true);
    expect(importsMoneyDb("../src/db/x.ts", `import { y } from "./stats.ts";`, "offers")).toBe(false);
    expect(importsMoneyDb("../src/db/x.ts", `import { y } from "../domain/offers.ts";`, "offers")).toBe(false);
    for (const sql of ["SELECT * FROM offers", "select * from offers", "select 1 join OUTBOUND_CLICKS c", "insert into Merchants (id) values (1)", "update partner_programs set x = 1"]) {
      expect(MONEY_TABLES.some((t) => touchesMoneyTable(sql, t)), sql).toBe(true);
    }
    expect(MONEY_TABLES.some((t) => touchesMoneyTable("SELECT * FROM product_daily_stats JOIN products", t))).toBe(false);
  });

  it("a ranking file that imports db/offers.ts would fail the ranking check (simulated)", () => {
    const fake = { ...sources, "../src/domain/public-stats.ts": `${sources["../src/domain/public-stats.ts"] ?? ""}\nimport { x } from "../db/offers.ts";` };
    expect(MONEY_DB.some((name) => importsMoneyDb("../src/domain/public-stats.ts", fake["../src/domain/public-stats.ts"]!, name))).toBe(true);
    expect(MONEY_DB.some((name) => importsMoneyDb("../src/domain/public-stats.ts", sources["../src/domain/public-stats.ts"] ?? "", name))).toBe(false);
  });

  it("the public statistics files are ranking files and mention no money (ADR-004, review L3)", () => {
    for (const file of ["../src/domain/public-stats.ts"]) {
      expect(RANKING_FILES, file).toContain(file);
      expect(sources[file] ?? "", file).not.toMatch(/sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|price|outbound_clicks/i);
    }
  });

  it("has no partner name in src (ADR-007 rule 4)", () => {
    for (const [file, src] of Object.entries(sources)) expect(src, file).not.toMatch(/elevenlabs|partnerstack/i);
  });
});
