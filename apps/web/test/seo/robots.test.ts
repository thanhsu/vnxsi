import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

describe("/robots.txt (spec §8.8)", () => {
  it("blocks private areas in every locale, allows product images and names the sitemap on APP_ORIGIN", async () => {
    const res = await createApp().request(new Request("https://vnxsi-web.preview.workers.dev/robots.txt"), undefined, testEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const lines = (await res.text()).split("\n");
    expect(lines[0]).toBe("User-agent: *");
    for (const path of ["/hub", "/me", "/admin", "/auth", "/vi/hub", "/zh-hans/me", "/zh-hant/admin", "/vi/auth", "/media"]) {
      expect(lines, path).toContain(`Disallow: ${path}`);
    }
    expect(lines).toContain("Disallow: /go/");
    expect(lines).toContain("Allow: /media/products/");
    expect(lines).toContain("Sitemap: https://vnx.si/sitemap.xml");
    expect(lines.filter((l) => l.startsWith("Disallow: /products") || l.startsWith("Disallow: /builders") || l.startsWith("Disallow: /p/"))).toEqual([]);
  });
});
