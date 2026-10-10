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
  product_view_dedupe: "../src/db/stats.ts",
  public_stats: "../src/db/public-stats.ts",
  ops_members: "../src/db/ops-members.ts",
  ops_member_invites: "../src/db/ops-members.ts",
  user_identities: "../src/db/identities.ts",
};

/** Table names behind a write: INSERT, INSERT OR IGNORE/REPLACE, REPLACE INTO, UPDATE, DELETE (VNX-0701b). */
const WRITE_SQL = /\b(?:INSERT\s+(?:OR\s+[A-Z]+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_]+)/g;

describe("table ownership (VNX-0201)", () => {
  it("writes each table only from its owning module", () => {
    for (const [file, src] of Object.entries(sources)) {
      // SQL keywords are upper case and table names lower case by convention, so prose does not match.
      for (const match of src.matchAll(WRITE_SQL)) {
        const table = match[1] ?? "";
        expect(WRITERS[table], `${file} writes unknown table ${table}`).toBeDefined();
        expect(file, `${table} is written outside its module`).toBe(WRITERS[table]);
      }
    }
  });

  it("sees INSERT OR IGNORE/REPLACE and REPLACE INTO, so product_view_dedupe cannot be written from another file unnoticed", () => {
    for (const sql of ["INSERT OR IGNORE INTO product_view_dedupe (day) VALUES (1)", "INSERT OR REPLACE INTO product_view_dedupe (day) VALUES (1)", "REPLACE INTO product_view_dedupe (day) VALUES (1)"]) {
      expect([...sql.matchAll(WRITE_SQL)][0]?.[1], sql).toBe("product_view_dedupe");
    }
    expect(WRITERS.product_view_dedupe).toBe("../src/db/stats.ts");
  });

  it("positive control: an upsert (INSERT ... ON CONFLICT ... DO UPDATE SET) yields exactly its target table, also across line breaks", () => {
    const sql = "INSERT INTO x (a, b) VALUES (1, 2) ON CONFLICT (a) DO UPDATE SET b = excluded.b";
    expect([...sql.matchAll(WRITE_SQL)].map((m) => m[1])).toEqual(["x"]);
    expect([...sql.replace("INSERT INTO", "INSERT\n  INTO").matchAll(WRITE_SQL)].map((m) => m[1])).toEqual(["x"]);
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
  // VNX-0702a (public statistics): Trending, Top builders/products, Live.
  "../src/domain/public-stats.ts",
  "../src/db/public-stats.ts",
  // VNX-0702b: hourly public-stat snapshot.
  "../src/jobs/hourly.ts",
  // VNX-0703a: homepage data blocks (Trending, Founding products).
  "../src/routes/home.tsx",
  "../src/views/home/Trending.tsx",
  // VNX-0703b: Top builders and Top products.
  "../src/views/home/TopBuilders.tsx",
  "../src/views/home/TopProducts.tsx",
];

// Allowlist: only these files may import a monetization db module or run SQL on a money table. Each task adds
// the files it creates (Task 2c: db/{merchants,programs}.ts, and db/audit.ts, which only reads `write_id` of those rows to guard audit rows; Task 2d: db/offers.ts (setDefaultOffer stays in db/merchants.ts, which owns `merchants`); Task 3: routes/admin-merchants.tsx only (views take structural prop types and may not import db); Task 4: db/clicks.ts,
// routes/go.ts, jobs/daily.ts; Task 5: routes/tools.tsx, routes/seo.ts; Task 6: routes/legal.tsx).
const MONEY_ALLOWED = new Set<string>(["../src/db/merchants.ts", "../src/db/programs.ts", "../src/db/offers.ts", "../src/db/audit.ts", "../src/routes/admin-merchants.tsx", "../src/db/clicks.ts", "../src/jobs/daily.ts", "../src/routes/go.ts", "../src/routes/tools.tsx", "../src/routes/seo.ts", "../src/routes/legal.tsx", "../src/routes/ops-monetization.tsx"]);
// VNX-2508a: routes/ops-monetization.tsx is the Ops front of the same monetization module; it reuses the admin-merchants actions, so it is allowlisted for the same reason as admin-merchants.tsx.
// Only app.ts (route registration) and allowlisted files may import routes/admin-merchants.tsx.
const ADMIN_MERCHANTS_IMPORTERS = new Set<string>([...MONEY_ALLOWED, "../src/app.ts"]);

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
    expect([...MONEY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/clicks.ts", "../src/db/merchants.ts", "../src/db/offers.ts", "../src/db/programs.ts", "../src/jobs/daily.ts", "../src/routes/admin-merchants.tsx", "../src/routes/go.ts", "../src/routes/legal.tsx", "../src/routes/ops-monetization.tsx", "../src/routes/seo.ts", "../src/routes/tools.tsx"]);
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
    for (const file of ["../src/domain/public-stats.ts", "../src/db/public-stats.ts"]) {
      expect(RANKING_FILES, file).toContain(file);
      expect(sources[file] ?? "", file).not.toMatch(/sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|price|outbound_clicks/i);
    }
  });

  it("the homepage ranking files are listed and mention no money (VNX-0703)", () => {
    for (const file of ["../src/routes/home.tsx", "../src/views/home/Trending.tsx", "../src/views/home/TopBuilders.tsx", "../src/views/home/TopProducts.tsx"]) {
      expect(RANKING_FILES, file).toContain(file);
      expect(sources[file] ?? "", file).not.toMatch(/sponsor|paid|affiliate|commission|merchant|offer|revenue|conversion|outbound_clicks/i);
    }
  });

  it("the public statistics files read only allowed tables (no money table, no outbound_clicks)", () => {
    for (const file of ["../src/domain/public-stats.ts", "../src/db/public-stats.ts"]) {
      for (const table of MONEY_TABLES) expect(touchesMoneyTable(sources[file] ?? "", table), `${file} reads ${table}`).toBe(false);
      expect(MONEY_ALLOWED.has(file), file).toBe(false);
    }
  });

  it("has no partner name in src (ADR-007 rule 4)", () => {
    for (const [file, src] of Object.entries(sources)) expect(src, file).not.toMatch(/elevenlabs|partnerstack/i);
  });
});

// ADR-012 §5, ADR-004: linked identities are read and written only by their module. Ranking, public and builder-facing code
// never touch the table. Each task adds the files it creates (2604b: routes/oauth.tsx; 2605a: routes/me.tsx; 2606a: routes/hub.tsx (the builder's own switch); 2606b: routes/builder-profile.tsx, ...).
// db/audit.ts is on the list only because the identity audit guard reads `id` and `user_id` of the row; it reads nothing else.
const IDENTITY_ALLOWED = new Set<string>(["../src/db/identities.ts", "../src/db/audit.ts", "../src/routes/oauth.tsx", "../src/routes/me.tsx", "../src/routes/hub.tsx", "../src/routes/builder-profile.tsx"]);

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

// VNX-2606b (ADR-004, ADR-012 §5): the identity badge is never an input to ranking, and a client's linked accounts never reach builder-facing or public code.
const SHOW_FLAG_FILES = new Set(["../src/domain/identity.ts", "../src/db/identities.ts", "../src/views/hub/ProfilePage.tsx"]);
const IDENTITY_WORDS = /user_identities|show_on_profile|showOnProfile|listPublicBadges|PublicBadge|githubProfileUrl|domain\/identity|db\/identities/;

describe("unlinking ends the provider's sessions (VNX-2605c)", () => {
  it("db/ imports nothing from auth/ (ARCHITECTURE.md §2): the unlink batch receives its sessions statement", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (!file.startsWith("../src/db/")) continue;
      expect(src, `${file} imports auth/`).not.toMatch(/from\s+["']\.\.\/auth\//);
    }
  });

  it("the only caller of unlinkIdentity passes it endProviderSessionsStatement, and only auth/sessions.ts deletes sessions", () => {
    const callers = Object.entries(sources).filter(([file, src]) => /\bunlinkIdentity\(/.test(src) && file !== "../src/db/identities.ts");
    expect(callers.map(([file]) => file)).toEqual(["../src/routes/me.tsx"]);
    expect(callers[0]?.[1]).toContain("endProviderSessionsStatement(");
    for (const [file, src] of Object.entries(sources)) if (/DELETE FROM sessions/.test(src)) expect(file).toBe("../src/auth/sessions.ts");
  });
});

describe("the identity badge stays out of ranking and builder-facing code (ADR-004, ADR-012 §5)", () => {
  it("the identities allowlist is exactly the files that read or write the table", () => {
    expect([...IDENTITY_ALLOWED].sort()).toEqual(["../src/db/audit.ts", "../src/db/identities.ts", "../src/routes/builder-profile.tsx", "../src/routes/hub.tsx", "../src/routes/me.tsx", "../src/routes/oauth.tsx"]);
  });

  it("no ranking, catalogue, directory or suggestion file mentions identities, the badge flag or the badge query", () => {
    for (const file of RANKING_FILES) expect(sources[file], `${file} touches identities`).not.toMatch(IDENTITY_WORDS);
  });

  it("only the identity module and the builder's own switch view mention show_on_profile", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (SHOW_FLAG_FILES.has(file)) continue;
      expect(src, `${file} reads the badge flag`).not.toMatch(/show_on_profile|showOnProfile/);
    }
  });

  it("builder-facing client code (inbox, thread, invitations, notices) does not touch identities", () => {
    for (const file of [...BUILDER_FACING_FILES, "../src/routes/hub-invitations.tsx", "../src/views/ProposalView.tsx"]) {
      expect(sources[file], file).toBeDefined();
      expect(sources[file], `${file} touches identities`).not.toMatch(IDENTITY_WORDS);
    }
  });

  it("the public profile route reads identities only through listPublicBadges, and the hub only its own builder's rows", () => {
    const profile = sources["../src/routes/builder-profile.tsx"] ?? "";
    const calls = (src: string, name: string) => (src.match(new RegExp(`${name}\\(`, "g")) ?? []).length;
    const exact = (src: string, re: RegExp) => (src.match(re) ?? []).length;
    expect(calls(profile, "listPublicBadges")).toBeGreaterThan(0);
    expect(calls(profile, "listPublicBadges")).toBe(exact(profile, /listPublicBadges\(c\.env\.DB, builder\.userId, providers\)/g)); // every call is for the builder shown
    for (const name of ["listIdentitiesForUser", "findIdentityByProviderSubject", "linkIdentity", "unlinkIdentity", "setShowOnProfile"]) expect(profile, name).not.toContain(name);
    const hub = sources["../src/routes/hub.tsx"] ?? "";
    expect(calls(hub, "listIdentitiesForUser")).toBeGreaterThan(0);
    expect(calls(hub, "listIdentitiesForUser")).toBe(exact(hub, /listIdentitiesForUser\(c\.env\.DB, builder\.userId\)/g)); // every call is for the signed-in builder
    expect(calls(hub, "setShowOnProfile")).toBeGreaterThan(0);
    expect(calls(hub, "setShowOnProfile")).toBe(exact(hub, /setShowOnProfile\(c\.env\.DB, \{ userId: c\.get\("builder"\)\.userId,/g));
    for (const name of ["findIdentityByProviderSubject", "linkIdentity", "unlinkIdentity", "listPublicBadges"]) expect(hub, name).not.toContain(name);
  });

  it("views import no db module (the badge reaches the page as a plain prop)", () => {
    for (const file of ["../src/views/BuilderProfilePage.tsx", "../src/views/hub/ProfilePage.tsx", "../src/views/BuilderCard.tsx"]) {
      expect(sources[file], file).toBeDefined();
      expect(sources[file], `${file} imports db`).not.toMatch(/from\s+["'][^"']*\/db\//);
    }
  });
});

// ADR-012 §6, F3: the OAuth callback never looks up or accepts an Ops invitation (that stays a magic-link act, ADR-010 §3).
const OAUTH_ROUTE = "../src/routes/oauth.tsx";

/** Files reachable from `entry` through value imports (`import type` is erased, so it is not a dependency). */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = sources[file] ?? "";
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^"';]*?from\s+["'](\.[^"']+)["']/gm)) {
      const parts = file.slice(0, file.lastIndexOf("/")).split("/");
      for (const seg of (m[1] ?? "").split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      const target = parts.join("/");
      if (sources[target]) queue.push(target);
    }
  }
  return seen;
}

describe("OAuth callback never touches Ops invites (ADR-012 §6, F3)", () => {
  it("routes/oauth.tsx exists and reaches neither db/ops-members.ts nor auth/ops.ts", () => {
    expect(sources[OAUTH_ROUTE]).toBeDefined();
    const reached = reachableFrom(OAUTH_ROUTE);
    expect(reached.has("../src/db/identities.ts")).toBe(true); // the walk really follows imports
    // Positive control (L6): the same walk does find ops-members.ts from the Ops console route, so a `false` above means something.
    expect(reachableFrom("../src/routes/ops.tsx").has("../src/db/ops-members.ts")).toBe(true);
    expect(reached.has("../src/db/ops-members.ts")).toBe(false);
    expect(reached.has("../src/auth/ops.ts")).toBe(false);
  });

  it("routes/oauth.tsx never reads an e-mail to find a user, nor mentions Ops invites", () => {
    expect(sources[OAUTH_ROUTE] ?? "").not.toMatch(/findUserByEmail|createUser|ops_member|OpsInvite/);
  });
});

describe("linking needs a magic-link session (VNX-2605d, ADR-013)", () => {
  it("the only caller of linkIdentity passes requireSession, and linking code never uses the staff predicate", () => {
    const callers = Object.entries(sources).filter(([file, src]) => /\blinkIdentity\(/.test(src) && file !== "../src/db/identities.ts");
    expect(callers.map(([file]) => file)).toEqual(["../src/routes/oauth.tsx"]);
    expect(callers[0]?.[1]).toMatch(/requireSession: \{ idHash: await sha256Hex\(raw\)/);
    for (const file of ["../src/routes/oauth.tsx", "../src/routes/me.tsx", "../src/views/me/LinkedAccounts.tsx"]) expect(sources[file], file).not.toContain("isStaffSession");
  });
});
describe("single render choke point (VNX-0701c)", () => {
  it("positive control: render.ts itself calls c.html(", () => {
    expect(sources["../src/views/render.ts"]).toMatch(/\bc\.html\(/);
  });

  it("only views/render.ts calls .html( (a direct call would silently drop the privacy notice)", () => {
    for (const [file, src] of Object.entries(sources)) {
      if (file === "../src/views/render.ts") continue;
      expect(src, file).not.toMatch(/\.html\(/);
    }
  });
});
