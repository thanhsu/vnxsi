import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { makeLiveProduct } from "./fixtures.ts";
import { testEnv } from "./helpers.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const anchors = (html: string) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);

describe("ProductPage outbound links (VNX-0707b)", () => {
  it("Demo and Website point at /go/p/<slug>/…?src=product_page with rel nofollow ugc noopener and target _blank, in every locale, and never at the stored URL", async () => {
    const { product } = await makeLiveProduct("ppl-a@vnx.si", "ppl-a", "Ppl A", { fields: { demoUrl: "https://demo.example/app", websiteUrl: "https://www.example.com/" } });
    for (const prefix of ["", "/vi", "/zh-hans", "/zh-hant"]) {
      const html = await (await get(`${prefix}/p/${product.slug}`)).text();
      const tags = anchors(html);
      for (const kind of ["demo", "site"]) {
        const tag = tags.find((t) => t.includes(`href="/go/p/${product.slug}/${kind}?src=product_page"`));
        expect(tag, `${prefix} ${kind}`).toBeDefined();
        expect(tag).toContain('rel="nofollow ugc noopener"');
        expect(tag).toContain('target="_blank"');
      }
      expect(html).not.toContain("https://demo.example/app");
      expect(html).not.toContain('href="https://www.example.com/"');
    }
  });
  it("renders no link for a URL the product does not have", async () => {
    const { product } = await makeLiveProduct("ppl-b@vnx.si", "ppl-b", "Ppl B", { fields: { demoUrl: null, websiteUrl: null } });
    const html = await (await get(`/p/${product.slug}`)).text();
    expect(html).not.toContain(`/go/p/${product.slug}/demo`);
    expect(html).not.toContain(`/go/p/${product.slug}/site`);
  });
});
