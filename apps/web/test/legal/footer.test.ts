import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const footerOf = (html: string) => /<footer[^>]*>([\s\S]*)<\/footer>/.exec(html)?.[1] ?? "";

describe("site footer (VNX-0705a AC6; Company group since VNX-0709)", () => {
  it("links Terms, Privacy and Media kit in the page's locale on /, /products and /p/:slug", async () => {
    const { product } = await makeLiveProduct("footer-live@vnx.si", "footer-live", "Footer Live");
    for (const rest of ["/", "/products", `/p/${product.slug}`]) {
      for (const locale of LOCALES) {
        const path = localizedPath(locale, rest);
        const res = await get(path);
        expect(res.status, path).toBe(200);
        const footer = footerOf(await res.text());
        expect(footer, path).toContain(`<nav class="footer-nav" aria-label="${t(locale, "footer.company")}">`);
        for (const [href, key] of [
          ["/terms", "footer.terms"],
          ["/privacy", "footer.privacy"],
          ["/media-kit", "footer.mediaKit"],
          ["/disclosure", "footer.disclosure"],
        ] as const) {
          expect(footer, `${path} ${href}`).toContain(`<a href="${localizedPath(locale, href)}">${t(locale, key)}</a>`);
        }
        expect(footer, path).toContain(t(locale, "site.tagline"));
      }
    }
  });

  it("shows the same links on a localized 404", async () => {
    const res = await get("/vi/no-such-page");
    expect(res.status).toBe(404);
    expect(footerOf(await res.text())).toContain(`<a href="/vi/media-kit">${t("vi", "footer.mediaKit")}</a>`);
  });
});
