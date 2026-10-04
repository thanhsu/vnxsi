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
];

// Allowlist: only these files may import a monetization db module or run SQL on a money table. Starts empty; each task adds
// the files it creates (Task 2: db/{merchants,programs,offers}.ts; Task 3: routes/admin-merchants.tsx; Task 4: db/clicks.ts,
// routes/go.ts, jobs/daily.ts; Task 5: routes/tools.tsx, routes/seo.ts; Task 6: routes/legal.tsx).
const MONEY_ALLOWED = new Set<string>([]);

describe("ranking never reads money (ADR-007 rule 2, ADR-004)", () => {
  it("lists only files that exist", () => {
    for (const file of RANKING_FILES) expect(sources[file], file).toBeDefined();
  });

  it("ranking files import no monetization db module", () => {
    for (const file of RANKING_FILES) {
      for (const name of MONEY_DB) {
        expect(sources[file], `${file} imports db/${name}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/db/${name}\\.ts["']`));
      }
    }
  });

  it("ranking files have no SQL on a money table", () => {
    for (const file of RANKING_FILES) {
      for (const table of MONEY_TABLES) {
        expect(sources[file], `${file} reads ${table}`).not.toMatch(new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`));
      }
    }
  });

  it("only allowlisted files import a money db module or touch a money table", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (MONEY_ALLOWED.has(file)) continue;
      for (const name of MONEY_DB) expect(src, `${file} imports db/${name}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/db/${name}\\.ts["']`));
      for (const table of MONEY_TABLES) expect(src, `${file} touches ${table}`).not.toMatch(new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`));
    }
  });

  it("has no partner name in src (ADR-007 rule 4)", () => {
    for (const [file, src] of Object.entries(sources)) expect(src, file).not.toMatch(/elevenlabs|partnerstack/i);
  });
});
