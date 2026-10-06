import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { searchProducts } from "../../src/db/catalog.ts";
import { searchBuilders } from "../../src/db/directory.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { parseDirectoryQuery } from "../../src/domain/directory.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { addLiveProduct, makeBuilder, makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const get = (path: string, cookie?: string) => createApp().request(new Request(`https://vnx.si${path}`, cookie ? { headers: { cookie } } : undefined), undefined, testEnv);
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const section = (html: string, cls: string) => new RegExp(`<section class="${cls}"[\\s\\S]*?</section>`).exec(mainOf(html))?.[0] ?? "";
const handlesIn = (html: string) => [...html.matchAll(/href="(?:\/[a-zA-Z-]+)?\/b\/([^"]+)"/g)].map((m) => m[1]!);
const slugsIn = (html: string) => [...html.matchAll(/href="(?:\/[a-zA-Z-]+)?\/p\/([^"]+)"/g)].map((m) => m[1]!);
const toolPath = (locale: Locale, slug: string) => localizedPath(locale, `/tools/${slug}`);
let seq = 0;
const tag = () => `br${Date.now().toString(36)}${seq++}`;

describe("/tools/:slug products block (AC1)", { timeout: 60_000 }, () => {
  it("lists public products whose tech_stack matches the merchant name exactly, case-insensitively, in 4 locales", async () => {
    const k = tag();
    const name = `Voxa ${k}`;
    const m = await makeMerchant({ name });
    const good = await makeBuilder(`${k}-g@vnx.si`, `${k}-g`, "approved");
    const hit = await addLiveProduct(good, `Hit ${k}`, { fields: { techStack: [name.toUpperCase(), "Other"] } });
    const lower = await addLiveProduct(good, `Lower ${k}`, { fields: { techStack: [name.toLowerCase()] } });
    const partial = await addLiveProduct(good, `Partial ${k}`, { fields: { techStack: [`${name} API`] } });
    const none = await addLiveProduct(good, `None ${k}`, { fields: { techStack: ["Other"] } });
    const notPublished = await addLiveProduct(good, `Unpub ${k}`, { fields: { techStack: [name] } });
    await testEnv.DB.prepare("UPDATE products SET status = 'draft' WHERE id = ?1").bind(notPublished.id).run();
    const gone = await makeBuilder(`${k}-x@vnx.si`, `${k}-x`, "approved");
    const goneProduct = await addLiveProduct(gone, `Gone ${k}`, { fields: { techStack: [name] } });
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(gone.userId).run();
    for (const locale of LOCALES) {
      const html = await (await get(toolPath(locale, m.slug))).text();
      const block = section(html, "tool-products");
      expect(block, locale).toContain(t(locale, "tools.products.title", { name }));
      const slugs = slugsIn(block);
      expect([...slugs].sort(), locale).toEqual([hit.slug, lower.slug].sort());
      for (const p of [partial, none, notPublished, goneProduct]) expect(slugs, `${locale} ${p.slug}`).not.toContain(p.slug);
    }
  });

  it("hides the whole block, title included, when no product matches", async () => {
    const m = await makeMerchant();
    const html = await (await get(toolPath("en", m.slug))).text();
    expect(section(html, "tool-products")).toBe("");
    expect(mainOf(html)).not.toContain(t("en", "tools.products.title", { name: m.name }));
  });
});

describe("/tools/:slug builders block (AC2)", { timeout: 60_000 }, () => {
  it("lists public builders whose ai_tools match the merchant name exactly, case-insensitively, in 4 locales", async () => {
    const k = tag();
    const name = `Lumo ${k}`;
    const m = await makeMerchant({ name });
    const a = await makeBuilder(`${k}-a@vnx.si`, `${k}-a`, "approved", { aiTools: `${name.toUpperCase()}, Claude Code` });
    const b = await makeBuilder(`${k}-b@vnx.si`, `${k}-b`, "approved", { aiTools: name.toLowerCase() });
    const partial = await makeBuilder(`${k}-p@vnx.si`, `${k}-p`, "approved", { aiTools: `${name} Pro` });
    const other = await makeBuilder(`${k}-o@vnx.si`, `${k}-o`, "approved", { aiTools: "Claude Code" });
    const pending = await makeBuilder(`${k}-q@vnx.si`, `${k}-q`, "pending", { aiTools: name });
    const off = await makeBuilder(`${k}-u@vnx.si`, `${k}-u`, "approved", { aiTools: name });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(off.userId).run();
    for (const locale of LOCALES) {
      const html = await (await get(toolPath(locale, m.slug))).text();
      const block = section(html, "tool-builders");
      expect(block, locale).toContain(t(locale, "tools.builders.title", { name }));
      const handles = handlesIn(block);
      expect([...handles].sort(), locale).toEqual([a.handle, b.handle].sort());
      for (const x of [partial, other, pending, off]) expect(handles, `${locale} ${x.handle}`).not.toContain(x.handle);
    }
  });

  it("hides the whole block when nobody matches", async () => {
    const m = await makeMerchant();
    const html = await (await get(toolPath("en", m.slug))).text();
    expect(section(html, "tool-builders")).toBe("");
    expect(mainOf(html)).not.toContain(t("en", "tools.builders.title", { name: m.name }));
  });
});

describe("/tools/:slug card headings (F7)", { timeout: 60_000 }, () => {
  it("renders card titles as h3 links inside both blocks", async () => {
    const k = tag();
    const m = await makeMerchant({ name: `Head ${k}` });
    const bld = await makeBuilder(`${k}-h@vnx.si`, `${k}-h`, "approved", { aiTools: m.name });
    await addLiveProduct(bld, `Head item ${k}`, { fields: { techStack: [m.name] } });
    const html = await (await get(toolPath("en", m.slug))).text();
    for (const cls of ["tool-products", "tool-builders"]) expect(section(html, cls), cls).toContain("<h3><a href=");
  });
});

describe("/tools/:slug ordering and limits (AC3)", { timeout: 60_000 }, () => {
  it("orders builders as /builders does and shows at most 6", async () => {
    const k = tag();
    const m = await makeMerchant({ name: `Orda ${k}` });
    const made: string[] = [];
    for (let i = 0; i < 8; i++) {
      const bld = await makeBuilder(`${k}-${i}@vnx.si`, `${k}-${i}`, "approved", { aiTools: `Orda ${k}`, availability: i % 3 === 0 ? "limited" : "open" });
      for (let j = 0; j < i % 3; j++) await addLiveProduct(bld, `Ord ${k} ${i} ${j}`);
      await testEnv.DB.prepare("UPDATE builders SET approved_at = ?2 WHERE user_id = ?1").bind(bld.userId, `2026-01-0${i + 1}T00:00:00.000Z`).run();
      made.push(bld.handle);
    }
    // The order /builders itself gives these builders, walking its pages.
    const expected: string[] = [];
    for (let page = 1; expected.length < made.length && page < 40; page++) {
      for (const e of (await searchBuilders(testEnv.DB, parseDirectoryQuery({ page: String(page) }))).items) if (made.includes(e.handle)) expected.push(e.handle);
    }
    expect(expected).toHaveLength(8);
    const html = await (await get(toolPath("en", m.slug))).text();
    expect(handlesIn(section(html, "tool-builders"))).toEqual(expected.slice(0, 6));
  });

  it("orders products as /products does and shows at most 6", async () => {
    const k = tag();
    const m = await makeMerchant({ name: `Prda ${k}` });
    const bld = await makeBuilder(`${k}-b@vnx.si`, `${k}-b`, "approved");
    const made: string[] = [];
    for (let i = 0; i < 8; i++) {
      const p = await addLiveProduct(bld, `Prd ${k} ${i}`, { at: `2026-02-0${i + 1}T00:00:00.000Z`, badges: i % 2 === 0 ? ["demo_verified"] : [], fields: { techStack: [`Prda ${k}`] } });
      made.push(p.slug);
    }
    const expected: string[] = [];
    for (let page = 1; expected.length < made.length && page < 60; page++) {
      for (const e of (await searchProducts(testEnv.DB, parseCatalogQuery({ page: String(page) }))).items) if (made.includes(e.slug)) expected.push(e.slug);
    }
    expect(expected).toHaveLength(8);
    const html = await (await get(toolPath("en", m.slug))).text();
    expect(slugsIn(section(html, "tool-products"))).toEqual(expected.slice(0, 6));
  });
});

describe("/tools/:slug call-to-action cards (AC4)", { timeout: 60_000 }, () => {
  it("always shows both cards, even for a merchant with no offers, with the right links per locale", async () => {
    const m = await makeMerchant({ name: `Cta ${tag()}` });
    for (const locale of LOCALES) {
      const html = await (await get(toolPath(locale, m.slug))).text();
      const block = section(html, "tool-cta");
      expect(block, locale).toContain(t(locale, "tools.request.title", { name: m.name }));
      expect(block, locale).toContain(t(locale, "tools.request.body"));
      expect(block, locale).toContain(t(locale, "tools.builder.title", { name: m.name }));
      expect(block, locale).toContain(t(locale, "tools.builder.body"));
      expect(block, locale).toContain(`href="${localizedPath(locale, "/request")}"`);
      expect(block, locale).toContain(t(locale, "request.cta"));
      expect(block, locale).toContain(t(locale, "landing.cta.builder"));
      const next = encodeURIComponent(localizedPath(locale, "/hub/apply"));
      expect(block, locale).toContain(`href="${localizedPath(locale, "/login")}?next=${next}"`);
    }
  });

  it("sends a signed-in visitor to the hub", async () => {
    const m = await makeMerchant();
    const { cookie } = await signIn(`${tag()}-si@vnx.si`);
    const block = section(await (await get(toolPath("vi", m.slug), cookie)).text(), "tool-cta");
    expect(block).toContain(`href="${localizedPath("vi", "/hub")}"`);
    expect(block).not.toContain("/login");
  });
});

describe("/tools/:slug bridge links stay clear of the money (AC5)", { timeout: 60_000 }, () => {
  it("has no sponsored rel or new-tab target in the new blocks, and none of them inside section.offers", async () => {
    const k = tag();
    const m = await makeMerchant({ name: `Clean ${k}` });
    const program = await makeProgram(m);
    await makeOffer(m, program, { label: "try_it" });
    const bld = await makeBuilder(`${k}-b@vnx.si`, `${k}-b`, "approved", { aiTools: `Clean ${k}` });
    await addLiveProduct(bld, `Clean item ${k}`, { fields: { techStack: [`Clean ${k}`] } });
    const html = await (await get(toolPath("en", m.slug))).text();
    const offers = section(html, "offers");
    expect(offers).toContain("sponsored");
    for (const cls of ["tool-products", "tool-builders", "tool-cta"]) {
      const block = section(html, cls);
      expect(block, cls).not.toBe("");
      expect(block, cls).not.toContain("sponsored");
      expect(block, cls).not.toContain("target=");
      expect(block, cls).not.toContain("/go/");
      expect(offers, cls).not.toContain(block);
    }
    expect(html).toContain('name="robots"');
    // CSP (VNX-0803): no inline style attribute, no inline script on the full page.
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });
});

describe("the tool filter is internal only (AC6)", { timeout: 60_000 }, () => {
  it("ignores ?tool= on /builders and /products", async () => {
    const k = tag();
    const bld = await makeBuilder(`${k}-b@vnx.si`, `${k}-b`, "approved", { name: `Ignore ${k}`, aiTools: "Claude Code" });
    await addLiveProduct(bld, `Ignore item ${k}`, { fields: { techStack: ["Other"] } });
    for (const path of ["/builders", "/products"]) {
      const plain = await (await get(path)).text();
      const withTool = await (await get(`${path}?tool=Claude%20Code`)).text();
      expect(withTool, path).toBe(plain);
    }
    expect((parseDirectoryQuery({ tool: "x" }) as { tool?: string }).tool).toBeUndefined();
    expect((parseCatalogQuery({ tool: "x" }) as { tool?: string }).tool).toBeUndefined();
  });

  it("ignores ?tool= for a builder and a product that do not use the tool (F1)", async () => {
    const k = tag();
    const bld = await makeBuilder(`${k}-o@vnx.si`, `${k}-o`, "approved", { name: `Other ${k}`, aiTools: "Cursor" });
    const prod = await addLiveProduct(bld, `Other item ${k}`, { fields: { techStack: ["Cursor"] } });
    const builders = await (await get(`/builders?q=${k}&tool=Claude%20Code`)).text();
    expect(handlesIn(builders)).toContain(`${k}-o`);
    expect(builders).toBe(await (await get(`/builders?q=${k}`)).text());
    const products = await (await get(`/products?q=${k}&tool=Claude%20Code`)).text();
    expect(slugsIn(products)).toContain(prod.slug);
  });

  it("a tool name of '' matches nothing (F2)", async () => {
    expect((await searchBuilders(testEnv.DB, { ...parseDirectoryQuery({}), tool: "" })).total).toBe(0);
    expect((await searchProducts(testEnv.DB, { ...parseCatalogQuery({}), tool: "" })).total).toBe(0);
  });

  it("binds the tool value: a hostile name matches nothing and breaks nothing", async () => {
    const hostile = "x') OR 1=1 --";
    expect((await searchBuilders(testEnv.DB, { ...parseDirectoryQuery({}), tool: hostile })).total).toBe(0);
    expect((await searchProducts(testEnv.DB, { ...parseCatalogQuery({}), tool: hostile })).total).toBe(0);
  });
});
