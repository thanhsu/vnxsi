import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { setProductStatus } from "../../src/db/products.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { renderSitemap } from "../../src/views/seo.ts";
import { ensureUser, makeBuilder, makeDraft, makeLiveProduct, makeMerchant } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const fetchSitemap = async () => {
  const res = await createApp().request(new Request("https://vnxsi-web.preview.workers.dev/sitemap.xml"), undefined, testEnv);
  return { res, xml: await res.text() };
};

describe("/sitemap.xml (spec §8.8)", { timeout: 30_000 }, () => {
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
    for (const rest of ["/terms", "/privacy", "/media-kit", "/contact", "/disclosure"]) {
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

describe("/sitemap.xml tool pages (VNX-2104a, Owner 2026-10-05)", { timeout: 30_000 }, () => {
  const setIndexing = async (enabled: boolean) => {
    const admin = await ensureUser("sm-tools-admin@vnx.si");
    await setFlag(testEnv.DB, { key: "content_indexing", enabled, actorUserId: admin.id, now: new Date().toISOString() });
    resetFlagCache();
  };
  // Always leave the flag off, even when an assertion below failed.
  afterEach(() => setIndexing(false));
  const html = async (path: string) => (await createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv)).text();

  it("lists /tools/:slug only when the merchant is active AND indexable AND content_indexing is on, with 4 locales and hreflang", async () => {
    const live = await makeMerchant({ indexable: true });
    const notIndexable = await makeMerchant({ indexable: false });
    const paused = await makeMerchant({ indexable: true, status: "paused" });
    const archived = await makeMerchant({ indexable: true, status: "archived" });
    const all = [live, notIndexable, paused, archived];

    await setIndexing(false);
    let xml = (await fetchSitemap()).xml;
    for (const m of all) expect(xml, `flag off ${m.slug}`).not.toContain(`/tools/${m.slug}<`);

    await setIndexing(true);
    xml = (await fetchSitemap()).xml;
    for (const m of [notIndexable, paused, archived]) expect(xml, `flag on ${m.slug}`).not.toContain(`/tools/${m.slug}<`);
    const alternates = [
      ...LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="https://vnx.si${localizedPath(l, `/tools/${live.slug}`)}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="https://vnx.si/tools/${live.slug}"/>`,
    ].join("");
    for (const l of LOCALES) {
      const loc = `https://vnx.si${localizedPath(l, `/tools/${live.slug}`)}`;
      expect(xml, loc).toContain(`<url><loc>${loc}</loc>`);
      expect(xml.split(`<loc>${loc}</loc>`), loc).toHaveLength(2);
      expect(xml, loc).toContain(alternates);
    }

    // The page and the sitemap agree on the boundary: in the sitemap exactly when the page has no noindex.
    for (const m of all) {
      const page = await html(`/tools/${m.slug}`);
      const inSitemap = xml.includes(`/tools/${m.slug}<`);
      if (m.status === "active") expect(page.includes('name="robots" content="noindex"'), m.slug).toBe(!inSitemap);
    }
    await setIndexing(false);
  });
});
