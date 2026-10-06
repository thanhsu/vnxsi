import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findMerchantById } from "../../src/db/merchants.ts";
import { listOffersByMerchant } from "../../src/db/offers.ts";
import { listProgramsByMerchant } from "../../src/db/programs.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import type { Bindings } from "../../src/env.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2508a: Merchants under /ops/monetization/merchants (spec Ops §2, §3, §7; plan VNX-2508a). The same writes as
 * /admin/merchants (shared handlers, same audit rows), in OpsLayout, English, Owner only (monetization.view for the
 * pages, monetization.act for every POST). Anyone else gets the sealed 404 of requireOps.
 */

const tag = () => ulid().slice(-8).toLowerCase();
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const BASE = "/ops/monetization/merchants";

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-mon-${role}-${tag()}@vnx.si`, role);
}

function req(path: string, opts: { cookie?: string; form?: Record<string, string>; ray?: string } = {}) {
  const headers: Record<string, string> = { "cf-ray": opts.ray ?? `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.form) {
    headers.origin = "https://vnx.si";
    headers["content-type"] = "application/x-www-form-urlencoded";
    return new Request(`https://vnx.si${path}`, { method: "POST", headers, body: new URLSearchParams(opts.form) });
  }
  return new Request(`https://vnx.si${path}`, { headers });
}

const send = (path: string, opts: Parameters<typeof req>[1] = {}, bindings: Bindings = env) => createApp().request(req(path, opts), undefined, bindings);
const get = async (path: string, cookie: string, bindings: Bindings = env) => {
  const res = await send(path, { cookie }, bindings);
  return { res, html: await res.text() };
};
const post = (path: string, cookie: string, form: Record<string, string> = {}) => send(path, { cookie, form });
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";

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
const ofields = (o: Record<string, string> = {}) => ({
  programId: "",
  kind: "official",
  label: "visit_site",
  destinationUrl: "https://example.com/",
  trackingTemplate: "",
  startsAt: "",
  endsAt: "",
  status: "active",
  expectedStatus: "active",
  ...o,
});

const n = async (sql: string) => (await testEnv.DB.prepare(sql).first<{ n: number }>())?.n ?? -1;
const snapshot = async () => [
  await n("SELECT COUNT(*) AS n FROM merchants"),
  await n("SELECT COUNT(*) AS n FROM partner_programs"),
  await n("SELECT COUNT(*) AS n FROM offers"),
  await n("SELECT COUNT(*) AS n FROM audit_log"),
];
const auditActions = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((r) => r.action);
const auditRows = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action, entity, actor_user_id FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string; entity: string; actor_user_id: string }>()).results;
const idFromLocation = (res: Response) => /\/ops\/monetization\/merchants\/([^?]+)\?done=1$/.exec(res.headers.get("location") ?? "")?.[1] ?? "";

/** Every route of the task, with a form that would succeed for the Owner. */
async function routes() {
  const m = await makeMerchant();
  const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
  const o = await makeOffer(m, null);
  const gets = [BASE, `${BASE}/${m.id}`];
  const posts: [string, Record<string, string>][] = [
    [BASE, mfields()],
    [`${BASE}/${m.id}`, mfields({ name: "Hacked" })],
    [`${BASE}/${m.id}/status`, { to: "paused" }],
    [`${BASE}/${m.id}/programs`, pfields()],
    [`${BASE}/${m.id}/programs/${p.id}`, pfields({ name: "Hacked" })],
    [`${BASE}/${m.id}/offers`, ofields()],
    [`${BASE}/${m.id}/offers/${o.id}`, ofields({ label: "learn_more" })],
    [`${BASE}/${m.id}/default-offer`, { offerId: o.id }],
  ];
  return { m, p, o, gets, posts };
}

describe("who may open Merchants (AC2)", () => {
  it("answers 200 to the Owner, list and detail, in OpsLayout with the no-store headers", async () => {
    const m = await makeMerchant();
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}/${m.id}`]) {
      const { res, html } = await get(path, cookie);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(html, path).toContain('<html lang="en">');
      expect(html, path).toMatch(/<aside class="ops-side">/);
    }
  });

  it("gives Operator, Content, Viewer, a role-less user and the anonymous the sealed 404 on every GET and POST, and writes nothing", async () => {
    const { gets, posts } = await routes();
    const sealed = async (path: string, opts: { cookie?: string; form?: Record<string, string> } = {}) => {
      const ray = `ray-${tag()}`;
      const res = await send(path, { ...opts, ray });
      return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
    };
    const reference = await sealed("/ops/khong-ton-tai");
    const before = await snapshot();
    const who: Record<string, string | undefined> = {
      operator: (await asRole("operator")).cookie,
      content: (await asRole("content")).cookie,
      viewer: (await asRole("viewer")).cookie,
      plain: (await signIn(`ops-mon-plain-${tag()}@vnx.si`)).cookie,
      anonymous: undefined,
    };
    for (const [name, cookie] of Object.entries(who)) {
      for (const path of gets) {
        const got = await sealed(path, { cookie });
        expect(got.status, `${name} GET ${path}`).toBe(404);
        expect(got.body, `${name} GET ${path}`).toBe(reference.body);
        expect(got.headers, `${name} GET ${path}`).toEqual(reference.headers);
      }
      for (const [path, form] of posts) {
        const got = await sealed(path, { cookie, form });
        expect(got.status, `${name} POST ${path}`).toBe(404);
        expect(got.body, `${name} POST ${path}`).toBe(reference.body);
      }
    }
    expect(await snapshot()).toEqual(before);
  });

  it("answers the sealed 404 to the Owner for an unknown merchant on every route", async () => {
    const { cookie } = await asRole("owner");
    const reference = await (await send("/ops/khong-ton-tai")).text();
    const strip = (html: string) => html.replace(/ray-[0-9a-f]{8}|[0-9a-f-]{36}/g, "");
    const ghost = "01ZZZZZZZZZZZZZZZZZZZZZZZZ";
    const before = await snapshot();
    const detail = await send(`${BASE}/${ghost}`, { cookie });
    expect(detail.status).toBe(404);
    expect(strip(await detail.text())).toBe(strip(reference));
    for (const [suffix, form] of [
      ["", mfields()],
      ["/status", { to: "paused" }],
      ["/programs", pfields()],
      [`/programs/${ghost}`, pfields()],
      ["/offers", ofields()],
      [`/offers/${ghost}`, ofields()],
      ["/default-offer", { offerId: "" }],
    ] as const) {
      const res = await post(`${BASE}/${ghost}${suffix}`, cookie, form);
      expect(res.status, suffix).toBe(404);
      expect(strip(await res.text()), suffix).toBe(strip(reference));
    }
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a cross-site POST and an oversize body", async () => {
    const { cookie } = await asRole("owner");
    const before = await snapshot();
    const evil = new Request(`https://vnx.si${BASE}`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(mfields()),
    });
    expect((await createApp().request(evil, undefined, env)).status).toBe(403);
    const big = await send(BASE, { cookie, form: mfields({ description: "x".repeat(70_000) }) });
    expect(big.status).toBe(413);
    expect(await snapshot()).toEqual(before);
  });
});

describe("the Owner manages merchants through Ops (AC1)", () => {
  it("lists merchants and shows the create form with paused selected", async () => {
    const m = await makeMerchant({ name: "Listed Merchant" });
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(BASE, cookie)).html);
    expect(main).toContain("Listed Merchant");
    expect(main).toContain(`href="${BASE}/${m.id}"`);
    expect(main).toContain(`<code>${m.slug}</code>`);
    expect(main).toMatch(/<form method="post" action="\/ops\/monetization\/merchants"/);
    expect(main).toMatch(/<option value="paused" selected/);
  });

  it("creates paused by default, with one merchant.create audit row, and redirects to the Ops detail page", async () => {
    const { cookie, user } = await asRole("owner");
    const fields = mfields();
    delete (fields as Record<string, string | undefined>).status;
    const res = await post(BASE, cookie, fields);
    expect(res.status).toBe(303);
    const id = idFromLocation(res);
    expect(id).not.toBe("");
    const merchant = await findMerchantById(testEnv.DB, id);
    expect(merchant).toMatchObject({ slug: fields.slug, status: "paused", allowedHosts: ["example.com"] });
    expect(await auditRows(id)).toEqual([{ action: "merchant.create", entity: "merchant", actor_user_id: user.id }]);
    const detail = await get(`${BASE}/${id}?done=1`, cookie);
    expect(detail.html).toContain("Saved.");
  });

  it("writes the same audit trail as /admin for the same sequence of actions", async () => {
    const { cookie } = await signIn(ROOT, { admin: true });
    const adminFlow = async () => {
      const f = mfields();
      const created = await createApp().request(
        new Request("https://vnx.si/admin/merchants", { method: "POST", headers: { cookie, origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(f) }),
        undefined,
        env,
      );
      const id = /\/admin\/merchants\/([^?]+)\?done=1/.exec(created.headers.get("location") ?? "")?.[1] ?? "";
      return { id, f };
    };
    const opsFlow = async () => {
      const f = mfields();
      const id = idFromLocation(await post(BASE, cookie, f));
      return { id, f };
    };
    const steps = async (id: string, prefix: string) => {
      const p = (path: string, form: Record<string, string>) =>
        createApp().request(new Request(`https://vnx.si${path}`, { method: "POST", headers: { cookie, origin: "https://vnx.si", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) }), undefined, env);
      await p(`${prefix}/${id}`, mfields({ name: "Renamed" }));
      await p(`${prefix}/${id}/status`, { to: "active" });
      await p(`${prefix}/${id}/programs`, pfields());
      const [program] = await listProgramsByMerchant(testEnv.DB, id);
      await p(`${prefix}/${id}/programs/${program!.id}`, pfields({ name: "Prog 2" }));
      await p(`${prefix}/${id}/offers`, ofields());
      const [offer] = await listOffersByMerchant(testEnv.DB, id);
      await p(`${prefix}/${id}/offers/${offer!.id}`, ofields({ label: "learn_more" }));
      await p(`${prefix}/${id}/default-offer`, { offerId: offer!.id });
      const merchant = await findMerchantById(testEnv.DB, id);
      return {
        merchant: { name: merchant!.name, status: merchant!.status, hasDefault: merchant!.defaultOfferId === offer!.id },
        program: { name: program!.name },
        offer: { label: (await listOffersByMerchant(testEnv.DB, id))[0]!.label },
        merchantAudit: await auditActions(id),
        programAudit: await auditActions(program!.id),
        offerAudit: await auditActions(offer!.id),
      };
    };
    const viaAdmin = await adminFlow();
    const viaOps = await opsFlow();
    const a = await steps(viaAdmin.id, "/admin/merchants");
    const o = await steps(viaOps.id, BASE);
    expect(o).toEqual(a);
    expect(o.merchant).toEqual({ name: "Renamed", status: "active", hasDefault: true });
    expect(o.merchantAudit).toEqual(["merchant.create", "merchant.update", "merchant.status", "merchant.update"]);
  });

  it("edits the merchant without ever reading the slug from the request", async () => {
    const m = await makeMerchant();
    const { cookie } = await asRole("owner");
    const res = await post(`${BASE}/${m.id}`, cookie, mfields({ name: "New name", slug: "changed-slug" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/${m.id}?done=1`);
    expect(await findMerchantById(testEnv.DB, m.id)).toMatchObject({ name: "New name", slug: m.slug });
  });

  it("moves status, archives only with the confirm tick, and archived is final", async () => {
    const m = await makeMerchant({ status: "active" });
    const { cookie } = await asRole("owner");
    expect((await post(`${BASE}/${m.id}/status`, cookie, { to: "paused" })).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("paused");
    const noConfirm = await post(`${BASE}/${m.id}/status`, cookie, { to: "archived" });
    expect(noConfirm.status).toBe(400);
    expect((await findMerchantById(testEnv.DB, m.id))?.status).toBe("paused");
    expect((await post(`${BASE}/${m.id}/status`, cookie, { to: "archived", confirm: "1" })).status).toBe(303);
    const after = await auditActions(m.id);
    const res = await post(`${BASE}/${m.id}/status`, cookie, { to: "active" });
    expect(res.status).toBe(409);
    expect(await auditActions(m.id)).toEqual(after);
  });

  it("creates and updates programs and offers of the merchant and sets and clears the default offer", async () => {
    const m = await makeMerchant();
    const { cookie } = await asRole("owner");
    expect((await post(`${BASE}/${m.id}/programs`, cookie, pfields())).status).toBe(303);
    const [program] = await listProgramsByMerchant(testEnv.DB, m.id);
    expect(await auditActions(program!.id)).toEqual(["program.create"]);
    expect((await post(`${BASE}/${m.id}/programs/${program!.id}`, cookie, pfields({ name: "Renamed program" }))).status).toBe(303);
    expect((await listProgramsByMerchant(testEnv.DB, m.id))[0]?.name).toBe("Renamed program");

    expect((await post(`${BASE}/${m.id}/offers`, cookie, ofields())).status).toBe(303);
    const [offer] = await listOffersByMerchant(testEnv.DB, m.id);
    expect(await auditActions(offer!.id)).toEqual(["offer.create"]);
    expect((await post(`${BASE}/${m.id}/offers/${offer!.id}`, cookie, ofields({ label: "learn_more" }))).status).toBe(303);
    expect((await listOffersByMerchant(testEnv.DB, m.id))[0]?.label).toBe("learn_more");

    expect((await post(`${BASE}/${m.id}/default-offer`, cookie, { offerId: offer!.id })).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(offer!.id);
    expect((await post(`${BASE}/${m.id}/default-offer`, cookie, { offerId: "" })).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
  });

  it("points every form and link of the detail page at /ops/monetization/merchants, never at /admin", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p);
    const { cookie } = await asRole("owner");
    const main = mainOf((await get(`${BASE}/${m.id}`, cookie)).html);
    const actions = [...main.matchAll(/<form\b[^>]*\baction="([^"]*)"/g)].map((x) => x[1]);
    expect(actions.length).toBeGreaterThan(5);
    for (const a of actions) expect(a, a).toMatch(new RegExp(`^${BASE}/${m.id}(/|$)`));
    expect(main).not.toContain("/admin/");
    expect(main).toContain(`href="${BASE}"`);
    expect(main).toContain("data-preview");
  });
});

describe("errors render in OpsLayout (AC3)", () => {
  it("shows a field error with the typed values on create and writes nothing", async () => {
    const taken = await makeMerchant();
    const { cookie } = await asRole("owner");
    const before = await snapshot();
    for (const [over, errId] of [
      [{ slug: taken.slug }, "merchants-slug-error"],
      [{ slug: "Bad Slug" }, "merchants-slug-error"],
      [{ allowedHosts: "127.0.0.1" }, "merchants-allowedHosts-error"],
      [{ name: "" }, "merchants-name-error"],
    ] as const) {
      const fields = mfields({ name: "Typed Name", description: "Typed description", ...over });
      const res = await post(BASE, cookie, fields);
      const html = await res.text();
      expect(res.status, errId).toBe(400);
      expect(html, errId).toContain('<html lang="en">');
      expect(html, errId).toMatch(/<aside class="ops-side">/);
      expect(html, errId).toContain(`id="${errId}"`);
      expect(html, errId).toContain("Typed description");
    }
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a merchant edit that would break an offer (host change), listing the offer, and changes nothing", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const { cookie } = await asRole("owner");
    const before = await snapshot();
    const res = await post(`${BASE}/${m.id}`, cookie, mfields({ websiteUrl: "https://other.example/", allowedHosts: "other.example" }));
    const html = await res.text();
    expect(res.status).toBe(400);
    expect(html).toMatch(/<aside class="ops-side">/);
    expect(html).toContain("data-broken");
    expect(html).toContain(o.id);
    expect(await snapshot()).toEqual(before);
    expect((await findMerchantById(testEnv.DB, m.id))?.allowedHosts).toEqual(["example.com"]);
  });

  it("returns 400 with the form in OpsLayout for a bad program, a bad offer and the default-archived confirmation", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const o = await makeOffer(m, null);
    const { cookie } = await asRole("owner");
    const bad = await post(`${BASE}/${m.id}/programs`, cookie, pfields({ name: "" }));
    expect(bad.status).toBe(400);
    expect(await bad.text()).toMatch(/<aside class="ops-side">/);
    const badOffer = await post(`${BASE}/${m.id}/offers`, cookie, ofields({ destinationUrl: "https://evil.com/" }));
    const badOfferHtml = await badOffer.text();
    expect(badOffer.status).toBe(400);
    expect(badOfferHtml).toMatch(/<aside class="ops-side">/);
    expect(badOfferHtml).toContain("https://evil.com/");
    expect(await listOffersByMerchant(testEnv.DB, m.id)).toHaveLength(1);
    await post(`${BASE}/${m.id}/default-offer`, cookie, { offerId: o.id });
    const archive = await post(`${BASE}/${m.id}/offers/${o.id}`, cookie, ofields({ status: "archived" }));
    expect(archive.status).toBe(400);
    expect((await listOffersByMerchant(testEnv.DB, m.id))[0]?.status).toBe("active");
    expect(p.id).not.toBe("");
  });

  it("answers 409 in OpsLayout, with the current state, for a stale expectedStatus and writes nothing", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const o = await makeOffer(m, null);
    const { cookie } = await asRole("owner");
    const before = await snapshot();
    const stale = await post(`${BASE}/${m.id}/programs/${p.id}`, cookie, pfields({ status: "paused", expectedStatus: "active" }));
    expect(stale.status).toBe(409);
    expect(await stale.text()).toMatch(/<aside class="ops-side">/);
    const staleOffer = await post(`${BASE}/${m.id}/offers/${o.id}`, cookie, ofields({ expectedStatus: "paused" }));
    expect(staleOffer.status).toBe(409);
    const html = await staleOffer.text();
    expect(html).toMatch(/<aside class="ops-side">/);
    expect(html).toContain("nothing was saved");
    expect(await snapshot()).toEqual(before);
  });

  it("answers the sealed 404 for a program, an offer or a default offer of another merchant", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const otherProgram = await makeProgram(other);
    const otherOffer = await makeOffer(other, null);
    const { cookie } = await asRole("owner");
    const before = await snapshot();
    expect((await post(`${BASE}/${m.id}/programs/${otherProgram.id}`, cookie, pfields())).status).toBe(404);
    expect((await post(`${BASE}/${m.id}/offers/${otherOffer.id}`, cookie, ofields())).status).toBe(404);
    expect((await post(`${BASE}/${m.id}/default-offer`, cookie, { offerId: otherOffer.id })).status).toBe(404);
    expect((await post(`${BASE}/${m.id}/offers`, cookie, ofields({ kind: "affiliate", programId: otherProgram.id, trackingTemplate: "https://example.com/r?c={click_id}" }))).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
});

describe("history (AC4)", () => {
  it("lists this merchant's audit rows in the safe projection, never the data", async () => {
    const { cookie } = await asRole("owner");
    const id = idFromLocation(await post(BASE, cookie, mfields()));
    await post(`${BASE}/${id}/status`, cookie, { to: "active" });
    const outsider = await ensureUser(`ops-mon-outsider-${tag()}@vnx.si`);
    await testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, 'merchant.note', 'merchant', ?3, ?4, '2030-01-01T10:00:00.000Z')")
      .bind(`01MHIST${tag()}`, outsider.id, id, '{"secret":"private-data-xyz"}')
      .run();
    const main = mainOf((await get(`${BASE}/${id}`, cookie)).html);
    const history = /<section class="ops-card ops-history"[^>]*>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? "";
    expect(history).toContain("<h2");
    expect([...history.matchAll(/<li data-audit="([^"]+)"/g)]).toHaveLength(3);
    expect(history).toContain("merchant.create");
    expect(history).toContain("merchant.status");
    expect(history).toContain(ROOT);
    expect(history).toContain(outsider.id);
    expect(history).not.toContain("private-data-xyz");
    expect(main).not.toContain("private-data-xyz");
  });

  it("shows a read failure as an error state, not as an empty list", async () => {
    const m = await makeMerchant();
    const { cookie } = await asRole("owner");
    const failing = new Proxy(testEnv.DB, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (/FROM\s+audit_log/i.test(sql)) throw new Error("audit read failed");
            return target.prepare(sql);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const { res, html } = await get(`${BASE}/${m.id}`, cookie, { ...env, DB: failing } as Bindings);
    expect(res.status).toBe(200);
    const main = mainOf(html);
    expect(main).toContain("Could not read the history.");
    expect(main).not.toContain("No audit entries");
  });

  it("says so when the merchant has no history", async () => {
    const fresh = await makeMerchant();
    await testEnv.DB.prepare("DELETE FROM audit_log WHERE entity_id = ?1").bind(fresh.id).run();
    const { cookie } = await asRole("owner");
    expect(mainOf((await get(`${BASE}/${fresh.id}`, cookie)).html)).toContain("No audit entries for this merchant yet.");
  });
});

describe("headers and CSP on the new pages (AC7)", () => {
  it("has nothing inline and no no-referrer policy on pages with POST forms", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p);
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}/${m.id}`]) {
      const { res, html } = await get(path, cookie);
      expect(res.headers.get("referrer-policy"), path).not.toBe("no-referrer");
      expect(html, path).not.toMatch(/\sstyle="/);
      expect(html, path).not.toMatch(/<style\b/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      for (const s of html.matchAll(/<script\b[^>]*>/g)) expect(s[0], path).toMatch(/^<script src="\/assets\/[^"]+"/);
    }
  });
});

describe("menu (AC5)", () => {
  it("marks Merchants current under Monetization on both pages, for the Owner", async () => {
    const m = await makeMerchant();
    const { cookie } = await asRole("owner");
    for (const path of [BASE, `${BASE}/${m.id}`]) {
      const html = (await get(path, cookie)).html;
      expect(html, path).toMatch(new RegExp(`<a class="ops-nav-link" href="${BASE}" aria-current="page">[\\s\\S]*?Merchants</a>`));
      expect(html, path).toMatch(/<p class="ops-group-h" id="[^"]+">Monetization<\/p>/);
      expect(html, path).toMatch(/<nav class="ops-crumb" aria-label="Breadcrumb">[\s\S]*?Ops[\s\S]*?Monetization[\s\S]*?<span aria-current="page">/);
    }
  });
});
