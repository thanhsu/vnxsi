import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { makeBuilder, makeReadyProduct, publishProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const PREVIEW = "https://vnxsi-web.preview.workers.dev";
const fetchAt = (url: string) => createApp().request(new Request(url), undefined, testEnv);
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "null");

describe("canonical URLs use APP_ORIGIN (spec §8.8)", () => {
  it("product page on a preview host points canonical, hreflang, og:image and JSON-LD at https://vnx.si", async () => {
    const { product } = await makeReadyProduct("seo-p@vnx.si", "seo-p", "Seo Product");
    const live = await publishProduct(product.id);
    const html = await (await fetchAt(`${PREVIEW}/vi/p/${live.slug}`)).text();
    expect(html).toContain(`<link rel="canonical" href="https://vnx.si/vi/p/${live.slug}"`);
    expect(html).toContain(`<meta property="og:url" content="https://vnx.si/vi/p/${live.slug}"`);
    expect(html).toContain(`<meta property="og:image" content="https://vnx.si/media/products/${product.id}/`);
    expect(jsonLd(html).url).toBe(`https://vnx.si/vi/p/${live.slug}`);
    expect(html).not.toContain(PREVIEW);
  });

  it("lists all four locales and x-default on a public page (spec §5.1)", async () => {
    await makeBuilder("seo-b@vnx.si", "seo-b", "approved");
    const html = await (await fetchAt(`${PREVIEW}/zh-hans/b/seo-b`)).text();
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/zh-hans/b/seo-b"');
    for (const [lang, href] of [
      ["en", "https://vnx.si/b/seo-b"],
      ["vi", "https://vnx.si/vi/b/seo-b"],
      ["zh-Hans", "https://vnx.si/zh-hans/b/seo-b"],
      ["zh-Hant", "https://vnx.si/zh-hant/b/seo-b"],
      ["x-default", "https://vnx.si/b/seo-b"],
    ]) {
      expect(html, lang).toContain(`<link rel="alternate" hreflang="${lang}" href="${href}"`);
    }
    expect(html).not.toContain(PREVIEW);
  });

  it("gives noindex pages no canonical, og:url or hreflang", async () => {
    for (const path of ["/login", "/vi/khong-co"]) {
      const html = await (await fetchAt(`https://vnx.si${path}`)).text();
      expect(html, path).toContain('<meta name="robots" content="noindex"');
      expect(html, path).not.toContain('rel="canonical"');
      expect(html, path).not.toContain('property="og:url"');
      expect(html, path).not.toContain('rel="alternate"');
    }
  });
});
