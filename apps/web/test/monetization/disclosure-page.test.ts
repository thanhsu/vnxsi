import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { LEGAL } from "../../src/legal/content.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { makeMerchant, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const getWith = (env: Bindings, path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, env);
const get = (path: string) => getWith(testEnv, path);
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
/** The dynamic block under section 3. */
const partnersOf = (html: string) => /<div data-partners="active">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? null;

/** A DB whose partner-list query answers with no rows, or throws; every other query reaches the real D1. */
const dbWith = (answer: "empty" | "throw"): Bindings => {
  const db = new Proxy(testEnv.DB, {
    get: (target, prop) => {
      if (prop !== "prepare") {
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === "function" ? v.bind(target) : v;
      }
      return (sql: string) => {
        if (!/partner_programs/.test(sql)) return target.prepare(sql);
        if (answer === "throw") throw new Error("d1 down");
        return { all: async () => ({ results: [] }) };
      };
    },
  });
  return { ...testEnv, DB: db } as Bindings;
};

describe("/disclosure partner list (VNX-2104b)", { timeout: 30_000 }, () => {
  it("shows exactly one 'none' line, in every locale, when the list is empty", async () => {
    const env = dbWith("empty");
    for (const locale of LOCALES) {
      const path = localizedPath(locale, "/disclosure");
      const res = await getWith(env, path);
      expect(res.status, path).toBe(200);
      const block = partnersOf(mainOf(await res.text()));
      expect(block, path).not.toBeNull();
      expect(block?.match(/<p[\s>]/g), path).toHaveLength(1);
      expect(block, path).toContain(`<p lang="${locale}">`);
      expect(textOf(block ?? ""), path).toBe(t(locale, "disclosure.noPartners"));
      expect(block, path).not.toContain("<a ");
    }
  });

  it("lists active merchants with an active program by name, linked to /tools/:slug, and nobody else", async () => {
    const listed = await makeMerchant({ name: "Listed Co" });
    await makeProgram(listed);
    const draft = await makeMerchant({ name: "Draft Co" });
    await makeProgram(draft, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const paused = await makeMerchant({ name: "Paused Co", status: "paused" });
    await makeProgram(paused);
    const bare = await makeMerchant({ name: "Bare Co" });

    for (const locale of LOCALES) {
      const path = localizedPath(locale, "/disclosure");
      const main = mainOf(await (await get(path)).text());
      const block = partnersOf(main) ?? "";
      expect(block, path).toContain(`<a href="${localizedPath(locale, `/tools/${listed.slug}`)}">Listed Co</a>`);
      expect(block, path).not.toContain(t(locale, "disclosure.noPartners"));
      for (const m of [draft, paused, bare]) {
        expect(main, `${path} ${m.slug}`).not.toContain(m.slug);
        expect(main, `${path} ${m.name}`).not.toContain(m.name);
      }
    }
  });

  it("puts the list after section 3 and before section 4", async () => {
    const own = await makeMerchant({ name: "Order Check Co" });
    await makeProgram(own);
    for (const [locale, doc] of [["en", LEGAL.disclosure.en], ["vi", LEGAL.disclosure.vi]] as const) {
      expect(doc.sections).toHaveLength(4);
      expect(doc.sections[2]?.heading.startsWith("3."), locale).toBe(true);
      expect(doc.sections[3]?.heading.startsWith("4."), locale).toBe(true);
      const text = textOf(mainOf(await (await get(localizedPath(locale, "/disclosure"))).text()));
      const at3 = text.indexOf(doc.sections[2]?.heading ?? "missing");
      const atList = text.indexOf("Order Check Co");
      const at4 = text.indexOf(doc.sections[3]?.heading ?? "missing");
      expect(at3, locale).toBeGreaterThan(-1);
      expect(atList, locale).toBeGreaterThan(at3);
      expect(at4, locale).toBeGreaterThan(atList);
    }
  });

  it("zh-Hans and zh-Hant show the English text with the English-only notice, and the 'none' line in their own language", async () => {
    const own = await makeMerchant({ name: "Zh Check Co" });
    await makeProgram(own);
    for (const locale of ["zh-Hans", "zh-Hant"] as const) {
      const main = mainOf(await (await get(localizedPath(locale, "/disclosure"))).text());
      expect(textOf(main), locale).toContain(t(locale, "legal.englishOnly"));
      expect(textOf(main), locale).toContain(LEGAL.disclosure.en.title);
      expect(textOf(main), locale).not.toContain(LEGAL.disclosure.vi.title);
      expect(partnersOf(main), locale).toContain(`<a href="${localizedPath(locale, `/tools/${own.slug}`)}">Zh Check Co</a>`);
      const empty = mainOf(await (await getWith(dbWith("empty"), localizedPath(locale, "/disclosure"))).text());
      expect(partnersOf(empty), locale).toContain(`<p lang="${locale}">${t(locale, "disclosure.noPartners")}</p>`);
    }
  });

  it("when D1 cannot answer the partner query, /disclosure is a 500 without a 'none' line, and /terms still works", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = dbWith("throw");
    for (const locale of LOCALES) {
      const bad = await getWith(env, localizedPath(locale, "/disclosure"));
      expect(bad.status, locale).toBe(500);
      expect(textOf(await bad.text()), locale).not.toContain(t(locale, "disclosure.noPartners"));
      expect((await getWith(env, localizedPath(locale, "/terms"))).status, locale).toBe(200);
    }
    spy.mockRestore();
  });
});
