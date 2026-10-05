import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findMerchantById } from "../../src/db/merchants.ts";
import { findProgramById } from "../../src/db/programs.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeBuilder, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const send = (req: Request) => createApp().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });
const tag = () => ulid().slice(-8).toLowerCase();
const mfields = (o: Record<string, string> = {}) => ({ name: "Acme Tools", slug: `acme-${tag()}`, websiteUrl: "https://example.com/", allowedHosts: "example.com", description: "Plain.", status: "paused", ...o });
const pfields = (o: Record<string, string> = {}) => ({
  name: "Acme affiliate",
  type: "affiliate",
  network: "",
  provider: "generic_template",
  commissionModel: "",
  commissionRateBps: "",
  commissionFlatMinor: "",
  currency: "",
  cookieDays: "",
  attributionNotes: "",
  termsUrl: "",
  termsVerifiedAt: "",
  status: "draft",
  expectedStatus: "draft",
  ...o,
});
const n = async (sql: string, ...args: unknown[]) => (await testEnv.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? -1;
const auditActions = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((r) => r.action);
const merchantCount = () => n("SELECT COUNT(*) AS n FROM merchants");

describe("/admin/merchants access", { timeout: 30_000 }, () => {
  it("is for admins only; every page is no-store and noindex; a cross-site POST is refused", async () => {
    const m = await makeMerchant();
    const { cookie: userCookie } = await signIn("mer-user@vnx.si");
    await makeBuilder("mer-builder@vnx.si", "mer-builder", "approved");
    const b = await signIn("mer-builder@vnx.si");
    for (const path of ["/admin/merchants", `/admin/merchants/${m.id}`]) {
      expect((await send(getReq(path, userCookie))).status, path).toBe(403);
      expect((await send(getReq(path, b.cookie))).status, path).toBe(403);
      expect((await send(getReq(path))).status, path).toBe(303);
    }
    expect((await send(formPost("/admin/merchants", mfields(), { cookie: userCookie }))).status).toBe(403);
    const { cookie } = await admin();
    for (const path of ["/admin/merchants", `/admin/merchants/${m.id}`]) {
      const res = await send(getReq(path, cookie));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
      expect(await res.text(), path).toContain('<meta name="robots" content="noindex"');
    }
    const before = await merchantCount();
    expect((await send(formPost("/admin/merchants", mfields(), { cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect(await merchantCount()).toBe(before);
  });

  it("every POST route refuses a normal user and a builder with 403 and writes nothing", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const { cookie: userCookie } = await signIn("mer-user2@vnx.si");
    await makeBuilder("mer-builder2@vnx.si", "mer-builder2", "approved");
    const b = await signIn("mer-builder2@vnx.si");
    const snapshot = async () => [
      await merchantCount(),
      await n("SELECT COUNT(*) AS n FROM partner_programs"),
      await n("SELECT COUNT(*) AS n FROM audit_log"),
      JSON.stringify(await findMerchantById(testEnv.DB, m.id)),
      JSON.stringify(await findProgramById(testEnv.DB, p.id)),
    ];
    const before = await snapshot();
    const posts: [string, Record<string, string>][] = [
      [`/admin/merchants/${m.id}`, mfields({ name: "Hacked" })],
      [`/admin/merchants/${m.id}/status`, { to: "paused" }],
      [`/admin/merchants/${m.id}/programs`, pfields()],
      [`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ name: "Hacked", expectedStatus: "draft" })],
    ];
    for (const who of [userCookie, b.cookie]) {
      for (const [path, fields] of posts) expect((await send(formPost(path, fields, { cookie: who }))).status, path).toBe(403);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("has a nav entry and works under every locale prefix", async () => {
    const m = await makeMerchant();
    const { cookie } = await admin();
    expect(await (await send(getReq("/admin/merchants", cookie))).text()).toContain('href="/admin/merchants"');
    for (const prefix of ["/vi", "/zh-hans", "/zh-hant"]) {
      expect((await send(getReq(`${prefix}/admin/merchants`, cookie))).status, prefix).toBe(200);
      expect((await send(getReq(`${prefix}/admin/merchants/${m.id}`, cookie))).status, prefix).toBe(200);
    }
    expect((await send(getReq("/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ", cookie))).status).toBe(404);
  });
});

describe("create merchant", { timeout: 30_000 }, () => {
  it("shows the new-merchant form with status paused selected", async () => {
    const { cookie } = await admin();
    const html = await (await send(getReq("/admin/merchants", cookie))).text();
    expect(html).toMatch(/<option value="paused" selected/);
  });

  it("creates paused by default, one merchant.create audit row, and redirects to the detail page", async () => {
    const { cookie, user } = await admin();
    const fields = mfields();
    delete (fields as Record<string, string | undefined>).status; // not sent at all: the safe default applies
    const res = await send(formPost("/admin/merchants", fields, { cookie }));
    expect(res.status).toBe(303);
    const row = await testEnv.DB.prepare("SELECT id, status, allowed_hosts FROM merchants WHERE slug = ?1").bind(fields.slug).first<{ id: string; status: string; allowed_hosts: string }>();
    expect(res.headers.get("location")).toBe(`/admin/merchants/${row?.id}?done=1`);
    expect(row?.status).toBe("paused");
    expect(JSON.parse(row?.allowed_hosts ?? "[]")).toEqual(["example.com"]);
    expect(await auditActions(row?.id ?? "")).toEqual(["merchant.create"]);
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE entity_id = ?1").bind(row?.id).first<{ actor_user_id: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
  });

  it("only `active` is honoured as a chosen status; archived and junk fall back to paused", async () => {
    const { cookie } = await admin();
    for (const [status, expected] of [["active", "active"], ["archived", "paused"], ["x", "paused"]] as const) {
      const f = mfields({ status });
      await send(formPost("/admin/merchants", f, { cookie }));
      expect((await testEnv.DB.prepare("SELECT status FROM merchants WHERE slug = ?1").bind(f.slug).first<{ status: string }>())?.status, status).toBe(expected);
    }
  });

  it("refuses reserved, malformed and duplicate slugs and bad hosts with a field error and writes nothing", async () => {
    const { cookie } = await admin();
    const taken = await makeMerchant();
    const cases: [Record<string, string>, string][] = [
      [{ slug: "p" }, "merchants-slug-error"],
      [{ slug: "o" }, "merchants-slug-error"],
      [{ slug: "Bad Slug" }, "merchants-slug-error"],
      [{ slug: taken.slug }, "merchants-slug-error"],
      [{ allowedHosts: "127.0.0.1" }, "merchants-allowedHosts-error"],
      [{ allowedHosts: "https://example.com" }, "merchants-allowedHosts-error"],
      [{ websiteUrl: "http://example.com/" }, "merchants-websiteUrl-error"],
      [{ websiteUrl: "https://evil.com/" }, "merchants-websiteUrl-error"],
      [{ name: "" }, "merchants-name-error"],
    ];
    for (const [override, errorId] of cases) {
      const before = await merchantCount();
      const res = await send(formPost("/admin/merchants", mfields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain(`id="${errorId}"`);
      expect(await merchantCount(), JSON.stringify(override)).toBe(before);
    }
    expect(await n("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'merchant.create' AND json_extract(data, '$.slug') IN ('p','o')")).toBe(0);
  });
});

describe("edit merchant", { timeout: 30_000 }, () => {
  it("never changes the slug and does not render a slug input on the detail page", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).not.toContain('name="slug"');
    expect(html).toContain(m.slug);
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ slug: "hijacked", name: "Renamed" }), { cookie }));
    expect(res.status).toBe(303);
    const after = await findMerchantById(testEnv.DB, m.id);
    expect(after).toMatchObject({ slug: m.slug, name: "Renamed" });
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.update"]);
  });

  it("a refused edit never echoes a slug from the request: the read-only slug shown is the stored one", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ slug: "hijacked", name: "" }), { cookie }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).not.toContain("hijacked");
    expect(html).toContain(m.slug);
  });

  it("unknown merchant: 404, nothing written", async () => {
    const { cookie } = await admin();
    expect((await send(formPost("/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ", mfields(), { cookie }))).status).toBe(404);
  });

  it("warns (without blocking) about a shared-hosting suffix in the stored hosts", async () => {
    const { cookie } = await admin();
    const clean = await makeMerchant();
    expect(await (await send(getReq(`/admin/merchants/${clean.id}`, cookie))).text()).not.toContain('data-warning="multi-tenant"');
    const shared = await makeMerchant({ websiteUrl: "https://acme.github.io/", allowedHosts: ["acme.github.io", "example.com"] });
    const html = await (await send(getReq(`/admin/merchants/${shared.id}`, cookie))).text();
    expect(html).toContain('data-warning="multi-tenant"');
    expect(html).toContain("acme.github.io");
    const saved = await send(formPost(`/admin/merchants/${clean.id}`, mfields({ websiteUrl: "https://x.vercel.app/", allowedHosts: "x.vercel.app\nexample.com" }), { cookie }));
    expect(saved.status).toBe(303); // a warning, not a refusal
  });

  it("refuses to save new hosts that would break a non-archived offer, lists it, and writes nothing", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const program = await makeProgram(m);
    const live = await makeOffer(m, program);
    const gone = await makeOffer(m, null, { status: "archived", destinationUrl: "https://example.com/old" });
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ websiteUrl: "https://other.com/", allowedHosts: "other.com" }), { cookie }));
    expect(res.status).toBe(400);
    const html = await res.text();
    const block = html.match(/data-broken[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(block).toContain(live.id);
    expect(block).not.toContain(gone.id); // archived offers are not checked
    expect(await findMerchantById(testEnv.DB, m.id)).toMatchObject({ allowedHosts: ["example.com"], websiteUrl: "https://example.com/" });
    expect(await auditActions(m.id)).toEqual(["merchant.create"]);
  });

  it("saves new hosts when every non-archived offer still passes, and widening the hosts needs no check", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    await makeOffer(m, null);
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "example.com\nwww.example.org", websiteUrl: "https://example.com/" }), { cookie }));
    expect(res.status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual(["example.com", "www.example.org"]);
  });

  it("the offer check also runs when only website_url changes (and passes); dropping a host an offer uses is refused (website_url alone cannot break an offer, since parseMerchantForm already checks it against the hosts)", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ allowedHosts: ["example.com", "other.com"] });
    const broken = await makeOffer(m, null, { destinationUrl: "https://example.com/p" });
    // hosts unchanged, only the site moves: offers still pass, so it saves
    expect((await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "example.com\nother.com", websiteUrl: "https://other.com/" }), { cookie }))).status).toBe(303);
    // drop example.com while keeping the offer on it: refused, offer listed
    const res = await send(formPost(`/admin/merchants/${m.id}`, mfields({ allowedHosts: "other.com", websiteUrl: "https://other.com/" }), { cookie }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(broken.id);
  });
});

describe("merchant status", { timeout: 30_000 }, () => {
  it("moves between active and paused, audits merchant.status, and refuses a no-op or an unknown status", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ status: "paused" });
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "active" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("active");
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.status"]);
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "active" }, { cookie }))).status).toBe(409);
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "bogus" }, { cookie }))).status).toBe(400);
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.status"]);
  });

  it("archiving needs the confirm tick; archived is final: no way out, no buttons, fields still editable", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "archived" }, { cookie }))).status).toBe(400);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("active");
    expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to: "archived", confirm: "1" }, { cookie }))).status).toBe(303);
    for (const to of ["active", "paused"]) expect((await send(formPost(`/admin/merchants/${m.id}/status`, { to }, { cookie }))).status, to).toBe(409);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("archived");
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).not.toContain(`/admin/merchants/${m.id}/status`);
    expect(html).toContain(`action="/admin/merchants/${m.id}"`); // the edit form is still there
    expect((await send(formPost(`/admin/merchants/${m.id}`, mfields({ name: "Still editable" }), { cookie }))).status).toBe(303);
  });
});

describe("programs", { timeout: 30_000 }, () => {
  it("creates a draft with no defaulted terms (every optional field stays null) and audits program.create", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const res = await send(formPost(`/admin/merchants/${m.id}/programs`, pfields(), { cookie }));
    expect(res.status).toBe(303);
    const row = await testEnv.DB.prepare("SELECT * FROM partner_programs WHERE merchant_id = ?1").bind(m.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: "draft", commission_model: null, commission_rate_bps: null, commission_flat_minor: null, currency: null, cookie_days: null, terms_url: null, terms_verified_at: null });
    expect(await auditActions(String(row?.id))).toEqual(["program.create"]);
  });

  it("refuses active without terms_url or terms_verified_at, and a direct program as active, showing the error on the status field", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const cases: Record<string, string>[] = [
      { status: "active", expectedStatus: "draft" },
      { status: "active", termsUrl: "https://example.com/terms" },
      { status: "active", termsVerifiedAt: "2026-10-01" },
      { status: "active", type: "direct", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" },
    ];
    for (const override of cases) {
      const res = await send(formPost(`/admin/merchants/${m.id}/programs`, pfields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain('id="programs-new-status-error"');
    }
    expect(await n("SELECT COUNT(*) AS n FROM partner_programs WHERE merchant_id = ?1", m.id)).toBe(0);
  });

  it("an existing draft moves to active only once both terms fields are filled; a failed attempt leaves it untouched", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const url = `/admin/merchants/${m.id}/programs/${p.id}`;
    const bad = await send(formPost(url, pfields({ status: "active" }), { cookie }));
    expect(bad.status).toBe(400);
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("draft");
    const ok = await send(formPost(url, pfields({ status: "active", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" }), { cookie }));
    expect(ok.status).toBe(303);
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ status: "active", termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" });
    expect(await auditActions(p.id)).toEqual(["program.create", "program.status"]);
  });

  it("answers 409 when the status moved since the form was drawn, 404 for a program of another merchant, 404 for an unknown merchant", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const p = await makeProgram(m, { status: "paused" });
    expect((await send(formPost(`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ status: "draft", expectedStatus: "active" }), { cookie }))).status).toBe(409);
    expect((await send(formPost(`/admin/merchants/${m.id}/programs/${p.id}`, pfields({ status: "paused", expectedStatus: "bogus" }), { cookie }))).status).toBe(400);
    expect((await send(formPost(`/admin/merchants/${other.id}/programs/${p.id}`, pfields({ status: "paused", expectedStatus: "paused" }), { cookie }))).status).toBe(404);
    expect((await send(formPost(`/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ/programs`, pfields(), { cookie }))).status).toBe(404);
    expect((await findProgramById(testEnv.DB, p.id))?.status).toBe("paused");
  });

  it("ended is final: the form has no status choice, a move out is a 409, other fields stay editable", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "ended" });
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain('<input type="hidden" name="status" value="ended"');
    const url = `/admin/merchants/${m.id}/programs/${p.id}`;
    const terms = { termsUrl: "https://example.com/terms", termsVerifiedAt: "2026-10-01" };
    expect((await send(formPost(url, pfields({ status: "active", expectedStatus: "ended", ...terms }), { cookie }))).status).toBe(409);
    expect((await send(formPost(url, pfields({ status: "ended", expectedStatus: "ended", name: "Renamed", ...terms }), { cookie }))).status).toBe(303);
    expect(await findProgramById(testEnv.DB, p.id)).toMatchObject({ status: "ended", name: "Renamed" });
    expect(await auditActions(p.id)).toEqual(["program.create", "program.update"]);
  });
});
