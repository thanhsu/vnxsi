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
  ops_members: "../src/db/ops-members.ts",
  ops_member_invites: "../src/db/ops-members.ts",
  user_identities: "../src/db/identities.ts",
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

// Allowlist: only these files may import a monetization db module or run SQL on a money table. Each task adds
// the files it creates (Task 2c: db/{merchants,programs}.ts, and db/audit.ts, which only reads `write_id` of those rows to guard audit rows; Task 2d: db/offers.ts (setDefaultOffer stays in db/merchants.ts, which owns `merchants`); Task 3: routes/admin-merchants.tsx only (views take structural prop types and may not import db); Task 4: db/clicks.ts,
// routes/go.ts, jobs/daily.ts; Task 5: routes/tools.tsx, routes/seo.ts; Task 6: routes/legal.tsx).
const MONEY_ALLOWED = new Set<string>(["../src/db/merchants.ts", "../src/db/programs.ts", "../src/db/offers.ts", "../src/db/audit.ts", "../src/routes/admin-merchants.tsx", "../src/db/clicks.ts", "../src/jobs/daily.ts", "../src/routes/go.ts", "../src/routes/tools.tsx", "../src/routes/seo.ts", "../src/routes/legal.tsx", "../src/routes/ops-monetization.tsx"]);
// VNX-2508a: routes/ops-monetization.tsx is the Ops front of the same monetization module; it reuses the admin-merchants actions, so it is allowlisted for the same reason as admin-merchants.tsx.
// Only app.ts (route registration) and allowlisted files may import routes/admin-merchants.tsx.
const ADMIN_MERCHANTS_IMPORTERS = new Set<string>([...MONEY_ALLOWED, "../src/app.ts"]);

describe("ranking never reads money (ADR-007 rule 2, ADR-004)", () => {
  it("lists only files that exist", () => {
    for (const file of RANKING_FILES) expect(sources[file], file).toBeDefined();
  });

  it("after Task 6 the allowlist is exactly the files of Tasks 2c-6", () => {
    expect([...MONEY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/clicks.ts", "../src/db/merchants.ts", "../src/db/offers.ts", "../src/db/programs.ts", "../src/jobs/daily.ts", "../src/routes/admin-merchants.tsx", "../src/routes/go.ts", "../src/routes/legal.tsx", "../src/routes/ops-monetization.tsx", "../src/routes/seo.ts", "../src/routes/tools.tsx"]);
  });

  it("the allowlist holds only files that exist, and no ranking file is on it", () => {
    for (const file of MONEY_ALLOWED) expect(sources[file], file).toBeDefined();
    for (const file of RANKING_FILES) expect(MONEY_ALLOWED.has(file), file).toBe(false);
  });

  it("ranking files import no monetization db module", () => {
    for (const file of RANKING_FILES) {
      for (const name of MONEY_DB) {
        expect(sources[file], `${file} imports db/${name}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/db/${name}\\.ts["']`));
      }
    }
  });

  it("no ranking file imports any module on the money allowlist", () => {
    // db/audit.ts is the shared audit writer used by every admin route (it is allowlisted only because it reads the `write_id` of money rows to guard audit rows); it reads no money value.
    const SHARED = new Set(["../src/db/audit.ts"]);
    for (const file of RANKING_FILES) {
      for (const allowed of MONEY_ALLOWED) {
        if (SHARED.has(allowed)) continue;
        const base = allowed.replace("../src/", "").replace(/\.tsx?$/, "");
        const [dir = "", name = ""] = base.split("/");
        // A sibling route is imported as "./name.tsx", anything else as ".../dir/name.ts".
        const where = dir === "routes" ? `(?:\\./|/routes/)${name}` : `/${dir}/${name}`;
        expect(sources[file], `${file} imports ${base}`).not.toMatch(new RegExp(`from\\s+["'][^"']*${where}(?:\\.tsx?)?["']`));
      }
    }
  });

  it("only allowlisted files (and app.ts, which registers it) import routes/admin-merchants.tsx", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (ADMIN_MERCHANTS_IMPORTERS.has(file)) continue;
      expect(src, `${file} imports admin-merchants`).not.toMatch(/from\s+["'][^"']*admin-merchants(?:\.tsx)?["']/);
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

// ADR-012 §5, ADR-004: linked identities are read and written only by their module. Ranking, public and builder-facing code
// never touch the table. Each task adds the files it creates (2604b: routes/oauth.tsx; 2605a: routes/me.tsx; 2606b: routes/builder-profile.tsx, ...).
// db/audit.ts is on the list only because the identity audit guard reads `id` and `user_id` of the row; it reads nothing else.
const IDENTITY_ALLOWED = new Set<string>(["../src/db/identities.ts", "../src/db/audit.ts"]);

describe("linked identities stay in their module (ADR-012 §5, ADR-004)", () => {
  it("the allowlist holds only files that exist, and no ranking file is on it", () => {
    for (const file of IDENTITY_ALLOWED) expect(sources[file], file).toBeDefined();
    for (const file of RANKING_FILES) expect(IDENTITY_ALLOWED.has(file), file).toBe(false);
  });

  it("ranking files import no identities module and run no SQL on user_identities", () => {
    for (const file of RANKING_FILES) {
      expect(sources[file], `${file} imports db/identities`).not.toMatch(/from\s+["'][^"']*\/db\/identities\.ts["']/);
      expect(sources[file], `${file} reads user_identities`).not.toMatch(/\b(?:FROM|JOIN|INTO|UPDATE)\s+user_identities\b/);
    }
  });

  it("only allowlisted files import db/identities.ts or run SQL on user_identities", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (IDENTITY_ALLOWED.has(file)) continue;
      expect(src, `${file} imports db/identities`).not.toMatch(/from\s+["'][^"']*\/db\/identities\.ts["']/);
      expect(src, `${file} touches user_identities`).not.toMatch(/\b(?:FROM|JOIN|INTO|UPDATE)\s+user_identities\b/);
    }
  });
});
