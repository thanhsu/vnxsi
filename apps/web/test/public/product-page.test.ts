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
    const { product } = await makeReadyProduct(`pp-${status}@vnx.si`, `pp-${status.replace("_", "")}`, `Hidden ${status}`);
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
