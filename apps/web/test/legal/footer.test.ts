import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { boardFlag } from "../public/request-board-helpers.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const footerOf = (html: string) => /<footer[^>]*>([\s\S]*)<\/footer>/.exec(html)?.[1] ?? "";

describe("site footer (VNX-0705a AC6; Company group since VNX-0709)", { timeout: 30_000 }, () => {
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

describe("footer and header link to the request board only while the board gate is on (VNX-2705b, Q13)", { timeout: 30_000 }, () => {
  const on = { ...testEnv, REQUEST_BOARD_GO_LIVE: "2026-01-01" };
  const getWith = (path: string, env: typeof testEnv) => createApp().request(new Request(`https://vnx.si${path}`), undefined, env);
  const headerOf = (html: string) => /<header[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";

  it("gate on: the footer has the link in every locale on /, /products and /contact; the header never does", async () => {
    await boardFlag(true);
    for (const rest of ["/", "/products", "/contact"]) {
      for (const locale of LOCALES) {
        const path = localizedPath(locale, rest);
        const html = await (await getWith(path, on)).text();
        expect(footerOf(html), path).toContain(`<a href="${localizedPath(locale, "/requests")}">${t(locale, "board.title")}</a>`);
        expect(headerOf(html), path).not.toContain("/requests");
      }
    }
  });

  it("flag off, or the date empty or in the future: no link", async () => {
    await boardFlag(true);
    for (const date of ["", "2999-01-01"]) expect(footerOf(await (await getWith("/", { ...testEnv, REQUEST_BOARD_GO_LIVE: date })).text()), date).not.toContain("/requests");
    await boardFlag(false);
    expect(footerOf(await (await getWith("/", on)).text())).not.toContain("/requests");
  });
});
