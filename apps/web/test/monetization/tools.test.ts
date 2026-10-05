import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { setDefaultOffer } from "../../src/db/merchants.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
/** The opening tag of the first <a> whose href starts with `prefix` (attributes as written by the view). */
const anchor = (html: string, prefix: string) => new RegExp(`<a\\b[^>]*href="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>`).exec(html)?.[0] ?? "";
const setIndexing = async (enabled: boolean) => {
  const admin = await ensureUser("tools-admin@vnx.si");
  await setFlag(testEnv.DB, { key: "content_indexing", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
};
const past = "2020-01-01T00:00:00.000Z";
const future = "2099-01-01T00:00:00.000Z";

beforeEach(() => resetFlagCache());

describe("/tools/:slug availability", () => {
  it("answers 404 in every locale for an unknown, paused or archived merchant, and for a malformed slug", async () => {
    const paused = await makeMerchant({ status: "paused" });
    const archived = await makeMerchant({ status: "archived" });
    for (const locale of LOCALES) {
      for (const slug of [paused.slug, archived.slug, "no-such-merchant", "bad_slug", "a"]) {
        const res = await get(localizedPath(locale, `/tools/${slug}`));
        expect(res.status, `${locale} ${slug}`).toBe(404);
      }
    }
  });

  it("redirects an upper-case slug to the lower-case one", async () => {
    const m = await makeMerchant();
    const res = await get(`/vi/tools/${m.slug.toUpperCase()}`);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/vi/tools/${m.slug}`);
  });
});

describe("/tools/:slug with offers (Review Focus 4)", () => {
  it("shows name, description, disclosure above the buttons, sponsored default link and plain other link, in 4 locales", async () => {
    const m = await makeMerchant({ name: "Acme Tool", description: "First line.\n\n- one\n- two" });
    const program = await makeProgram(m);
    const def = await makeOffer(m, program, { label: "try_it" });
    const other = await makeOffer(m, null, { label: "learn_more" });
    const admin = await ensureUser("tools-admin@vnx.si");
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: def.id, actorUserId: admin.id, now: "2026-10-05T00:00:00.000Z" });

    for (const locale of LOCALES) {
      const path = localizedPath(locale, `/tools/${m.slug}`);
      const res = await get(path);
      expect(res.status, path).toBe(200);
      const html = await res.text();
      const main = mainOf(html);
      expect(main, path).toMatch(/<h1[^>]*>Acme Tool<\/h1>/);
      const text = textOf(main);
      expect(text, path).toContain("First line.");
      expect(text, path).toContain(t(locale, "disclosure.note"));
      expect(anchor(main, localizedPath(locale, "/disclosure")), path).not.toBe("");
      expect(text, path).toContain(t(locale, "disclosure.learnMore"));

      const first = anchor(main, `/go/${m.slug}?src=tools`);
      expect(first, path).toContain('rel="sponsored noopener"');
      expect(first, path).toContain('target="_blank"');
      expect(main, path).toContain(`${t(locale, "offer.label.try_it", { name: "Acme Tool" })}</a>`);
      const second = anchor(main, `/go/o/${other.id}?src=tools`);
      expect(second, path).toContain('rel="noopener"');
      expect(second, path).not.toContain("sponsored");
      expect(main, path).toContain(`${t(locale, "offer.label.learn_more", { name: "Acme Tool" })}</a>`);

      // The note sits above the buttons; every outbound link goes through /go/.
      expect(main.indexOf("data-disclosure"), path).toBeGreaterThan(-1);
      expect(main.indexOf("data-disclosure"), path).toBeLessThan(main.indexOf("/go/"));
      expect(main, path).not.toContain("example.com");
      // Only the controls: block A itself says "or buy", so the whole <main> text must not be tested.
      const controls = [...main.matchAll(/<(?:a\b[^>]*class="btn[^"]*"[^>]*|button\b[^>]*)>([\s\S]*?)<\/(?:a|button)>/g)].map((x) => textOf(x[1] ?? "")).join(" ");
      expect(controls, path).toContain("Acme Tool");
      expect(controls, path).not.toMatch(/\b(buy|customize|hire)\b/i);
    }
  });

  it("wraps the English description in lang=en on vi, zh-Hans and zh-Hant, not on en", async () => {
    const m = await makeMerchant({ description: "Plain English text." });
    expect(mainOf(await (await get(`/tools/${m.slug}`)).text())).not.toContain('lang="en"');
    for (const locale of ["vi", "zh-Hans", "zh-Hant"] as const) {
      const main = mainOf(await (await get(localizedPath(locale, `/tools/${m.slug}`))).text());
      expect(main, locale).toContain('<div lang="en"><div class="prose"><p>Plain English text.</p></div></div>');
    }
  });

  it("shows no disclosure and no sponsored link when only the merchant's own link is shown, and no offer block with no offers", async () => {
    const own = await makeMerchant();
    await makeOffer(own, null);
    const html = mainOf(await (await get(`/tools/${own.slug}`)).text());
    expect(html).toContain("/go/o/");
    expect(html).not.toContain("data-disclosure");
    expect(html).not.toContain("sponsored");
    expect(html).not.toContain("/disclosure");

    const bare = await makeMerchant();
    const bareHtml = mainOf(await (await get(`/tools/${bare.slug}`)).text());
    expect(bareHtml).not.toContain("/go/");
    expect(bareHtml).not.toContain("data-disclosure");
    expect(bareHtml).not.toContain('class="row-actions"');
  });

  it("lists neither paused, archived, not-started nor ended offers, nor an offer /go/ would answer 404", async () => {
    const m = await makeMerchant();
    const shown = await makeOffer(m, null);
    const hidden = [
      await makeOffer(m, null, { status: "paused" }),
      await makeOffer(m, null, { status: "archived" }),
      await makeOffer(m, null, { startsAt: future }),
      await makeOffer(m, null, { endsAt: past }),
      await makeOffer(m, null, { destinationUrl: "https://not-allowed.test/" }),
    ];
    const main = mainOf(await (await get(`/tools/${m.slug}`)).text());
    expect(main).toContain(`/go/o/${shown.id}?src=tools`);
    for (const o of hidden) expect(main, o.id).not.toContain(o.id);
  });

  it("shows the disclosure and sponsored rel even with the flag off and a program that is not active (launch state)", async () => {
    const m = await makeMerchant();
    const draft = await makeProgram(m, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    await makeOffer(m, draft, { label: "try_it" });
    const main = mainOf(await (await get(`/tools/${m.slug}`)).text());
    expect(main).toContain("data-disclosure");
    expect(anchor(main, "/go/o/")).toContain('rel="sponsored noopener"');
  });

  it("escapes the merchant name and description", async () => {
    const m = await makeMerchant({ name: "<script>alert(1)</script>", description: "<img src=x onerror=alert(1)>" });
    const html = await (await get(`/tools/${m.slug}`)).text();
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("/tools/:slug indexing (Owner 2026-10-05)", () => {
  it("is noindex without canonical or hreflang unless indexable = 1 AND content_indexing is on", async () => {
    const indexable = await makeMerchant({ indexable: true });
    const notIndexable = await makeMerchant({ indexable: false });
    const cases = [
      { flag: false, m: indexable, open: false },
      { flag: false, m: notIndexable, open: false },
      { flag: true, m: notIndexable, open: false },
      { flag: true, m: indexable, open: true },
    ];
    for (const { flag, m, open } of cases) {
      await setIndexing(flag);
      for (const locale of LOCALES) {
        const path = localizedPath(locale, `/tools/${m.slug}`);
        const html = await (await get(path)).text();
        const label = `${path} flag=${flag} indexable=${m.indexable}`;
        expect(html.includes('<meta name="robots" content="noindex"'), label).toBe(!open);
        expect(html.includes('<link rel="canonical"'), label).toBe(open);
        expect(html.includes('hreflang="x-default"'), label).toBe(open);
        if (open) {
          expect(html, label).toContain(`<link rel="canonical" href="https://vnx.si${path}"`);
          for (const l of LOCALES) expect(html, label).toContain(`<link rel="alternate" hreflang="${l}" href="https://vnx.si${localizedPath(l, `/tools/${m.slug}`)}"`);
        }
      }
    }
    await setIndexing(false);
  });
});
