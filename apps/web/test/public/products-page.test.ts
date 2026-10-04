import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findProductById } from "../../src/db/products.ts";
import { listActiveBadges } from "../../src/db/verifications.ts";
import { addLiveProduct, makeBuilder, makeLiveProduct, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);
const slugs = (html: string) => [...html.matchAll(/<h2><a href="(?:\/[a-z-]+)?\/p\/([a-z0-9-]+)"/g)].map((m) => m[1]);

describe("/products (spec §5.2)", () => {
  it("offers to post a request when nothing matches", async () => {
    const html = await (await get("/products?q=zzznomatchzzz")).text();
    expect(html).toContain("No products match yet.");
    expect(html).toContain('href="/request"');
  });

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
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);
});
