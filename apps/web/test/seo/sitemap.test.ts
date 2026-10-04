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
