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
    for (const loc of ["https://vnx.si/products", "https://vnx.si/vi/builders"]) expect(xml, loc).toContain(`<loc>${loc}</loc>`);
    expect(xml).not.toContain("preview.workers.dev");
    expect(xml).toContain("<loc>https://vnx.si/vi/request</loc>");
    expect(xml).not.toContain("/me/requests");
  });

  it("lists the home page once per locale with hreflang alternates (VNX-0708)", async () => {
    const { xml } = await fetchSitemap();
    const alternates = [
      '<xhtml:link rel="alternate" hreflang="en" href="https://vnx.si/"/>',
      '<xhtml:link rel="alternate" hreflang="vi" href="https://vnx.si/vi/"/>',
      '<xhtml:link rel="alternate" hreflang="zh-Hans" href="https://vnx.si/zh-hans/"/>',
      '<xhtml:link rel="alternate" hreflang="zh-Hant" href="https://vnx.si/zh-hant/"/>',
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://vnx.si/"/>',
    ].join("");
    for (const loc of ["https://vnx.si/", "https://vnx.si/vi/", "https://vnx.si/zh-hans/", "https://vnx.si/zh-hant/"]) {
      expect(xml, loc).toContain(`<url><loc>${loc}</loc>${alternates}</url>`);
    }
    expect(xml).not.toContain("<loc>https://vnx.si/vi</loc>");
  });

  it("lists /terms, /privacy, /media-kit and /contact once per locale with hreflang alternates (VNX-0705a AC7, VNX-0710 AC3)", async () => {
    const { xml } = await fetchSitemap();
    for (const rest of ["/terms", "/privacy", "/media-kit", "/contact"]) {
      const alternates = [
        `<xhtml:link rel="alternate" hreflang="en" href="https://vnx.si${rest}"/>`,
        `<xhtml:link rel="alternate" hreflang="vi" href="https://vnx.si/vi${rest}"/>`,
        `<xhtml:link rel="alternate" hreflang="zh-Hans" href="https://vnx.si/zh-hans${rest}"/>`,
        `<xhtml:link rel="alternate" hreflang="zh-Hant" href="https://vnx.si/zh-hant${rest}"/>`,
        `<xhtml:link rel="alternate" hreflang="x-default" href="https://vnx.si${rest}"/>`,
      ].join("");
      for (const prefix of ["", "/vi", "/zh-hans", "/zh-hant"]) {
        const loc = `https://vnx.si${prefix}${rest}`;
        expect(xml, loc).toContain(`<url><loc>${loc}</loc>${alternates}</url>`);
        expect(xml.split(`<loc>${loc}</loc>`), loc).toHaveLength(2);
      }
    }
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
