import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(getReq(path), undefined, testEnv);
const handles = (html: string) => [...html.matchAll(/<h2><a href="(?:\/[a-z-]+)?\/b\/([a-z0-9-]+)"/g)].map((m) => m[1]);

describe("/builders (spec §5.2)", () => {
  it("renders cards with name, headline, kind, country, availability, rate, skills and product count", async () => {
    const b = await makeBuilder("bp-card@vnx.si", "bp-card", "approved", { name: "Cardbuilder Lan", headline: "Booking <b>apps</b>" });
    await addLiveProduct(b, "Cardbuilder product");
    const res = await get("/builders?q=cardbuilder");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const text of ["Cardbuilder Lan", "Booking &lt;b&gt;apps&lt;/b&gt;", "Individual", "Vietnam", "Open to new work", "$45/hour", "Next.js", "Published products: 1", "Results: 1"]) {
      expect(html, text).toContain(text);
    }
    expect(handles(html)).toEqual(["bp-card"]);
    expect(html).toContain("Nobody can pay to rank higher.");
    expect(html).toContain('href="/request"');
  }, 30_000);

  it("offers only countries of public builders and keeps the chosen filters", async () => {
    await makeBuilder("bp-c1@vnx.si", "bp-c1", "approved", { name: "Countrycheck", country: "TH" });
    const html = await (await get("/vi/builders?country=TH&lang=vi&availability=open&category=crm&q=countrycheck")).text();
    expect(html).toMatch(/<option value="TH" selected/);
    expect(html).toMatch(/<option value="vi" selected/);
    expect(html).toMatch(/<option value="open" selected/);
    expect(html).toMatch(/<option value="crm" selected/);
    expect(html).toContain('action="/vi/builders"');
    expect(html).toContain("Thái Lan");
  }, 30_000);

  it("returns 200 for hostile input and 404 past the last page", async () => {
    for (const p of ["q=%25", "q=%22", "q=" + "x".repeat(500), "page=abc", "page=0", "country=%3Cx%3E", "lang=zh-Hans"]) {
      expect((await get(`/builders?${p}`)).status, p).toBe(200);
    }
    expect((await get("/builders?q=nobody-at-all-here&page=2")).status).toBe(404);
  }, 30_000);

  it("is indexable only without search or filters", async () => {
    const plain = await (await get("/zh-hant/builders")).text();
    expect(plain).toContain('<link rel="canonical" href="https://vnx.si/zh-hant/builders"');
    expect(plain).toContain('<link rel="alternate" hreflang="vi" href="https://vnx.si/vi/builders"');
    const filtered = await (await get("/builders?availability=open")).text();
    expect(filtered).toContain('<meta name="robots" content="noindex"');
    expect(filtered).not.toContain('rel="canonical"');
  }, 30_000);

  it("ignores parameters outside the spec (ADR-004)", async () => {
    await makeBuilder("bp-a1@vnx.si", "bp-a1", "approved", { name: "Adrbuilder one", availability: "limited" });
    await makeBuilder("bp-a2@vnx.si", "bp-a2", "approved", { name: "Adrbuilder two" });
    const plain = handles(await (await get("/builders?q=adrbuilder")).text());
    const paid = handles(await (await get("/builders?q=adrbuilder&sort=rate&boost=bp-a1&sponsored=1&featured=1")).text());
    expect(plain).toEqual(["bp-a2", "bp-a1"]);
    expect(paid).toEqual(plain);
  }, 30_000);

  it("links to the directory from the header", async () => {
    const html = await (await get("/zh-hans/b/no-such-builder")).text();
    const header = /<header class="site-header">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(header).toContain('<a href="/zh-hans/builders">寻找开发者</a>');
  }, 30_000);
});
