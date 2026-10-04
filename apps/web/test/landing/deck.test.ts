import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { searchProducts } from "../../src/db/catalog.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { t } from "../../src/i18n/t.ts";
import { addLiveProduct, makeBuilder, makeLiveProduct } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

// VNX-0709 AC6/AC7: the hero deck. Tests in this file share one database and run in order.
const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);
const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** From the deck's opening tag to the end of its dot buttons. */
const deckOf = (html: string) => /<div class="deck"[^>]*>([\s\S]*?<div class="deck-dots"[\s\S]*?<\/div>)/.exec(html)?.[1] ?? "";
const cardsOf = (deck: string) => [...deck.matchAll(/<article class="deck-card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g)].map((m) => ({ attrs: m[1]!, body: m[2]! }));
const attr = (attrs: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;

const neutralOrder = async () => (await searchProducts(testEnv.DB, parseCatalogQuery({}))).items;

describe("landing deck (VNX-0709)", () => {
  it("AC6: with no public product, shows the booking, crm and ai_agents invitation cards in that order", async () => {
    for (const [path, locale] of [
      ["/", "en"],
      ["/vi/", "vi"],
      ["/zh-hans/", "zh-Hans"],
      ["/zh-hant/", "zh-Hant"],
    ] as const) {
      const deck = deckOf(await (await get(path)).text());
      const cards = cardsOf(deck);
      expect(cards.map((c) => attr(c.attrs, "data-category")), path).toEqual(["booking", "crm", "ai_agents"]);
      expect(cards.map((c) => attr(c.attrs, "data-kind")), path).toEqual(["category", "category", "category"]);
      for (const [i, key] of (["product.category.booking", "product.category.crm", "product.category.ai_agents"] as const).entries()) {
        const text = textOf(cards[i]!.body);
        expect(text, `${path} ${key}`).toContain(t(locale, key));
        for (const k of ["landing.deck.open", "landing.deck.free", "landing.deck.first", "landing.deck.badges", "landing.deck.list", "landing.cta.notify"] as const) {
          expect(text, `${path} ${key} ${k}`).toContain(t(locale, k));
        }
        for (const badge of ["badge.listed", "badge.demo_verified", "badge.in_production"] as const) expect(text).toContain(t(locale, badge));
        expect(cards[i]!.body).toContain('href="#notify"');
        expect(cards[i]!.body).not.toContain("/p/");
      }
      // Without JavaScript the first card is in front and the dot buttons stay hidden.
      expect(cards.map((c) => attr(c.attrs, "data-slot")), path).toEqual(["0", "1", "2"]);
      expect(deck, path).toMatch(/<div class="deck-dots" hidden(="")?>/);
      expect(deck.match(/<button type="button"[^>]*aria-pressed=/g), path).toHaveLength(3);
    }
  });

  it("AC6/AC7: with two public products (and one from a suspended builder), still shows the category cards and no digits", async () => {
    await makeLiveProduct("deck-a@vnx.si", "deck-a", "Deckalpha", { at: "2026-01-01T00:00:00.000Z" });
    await makeLiveProduct("deck-b@vnx.si", "deck-b", "Deckbravo", { at: "2026-02-01T00:00:00.000Z" });
    const hidden = await makeLiveProduct("deck-x@vnx.si", "deck-x", "Deckhidden", { at: "2026-03-01T00:00:00.000Z", badges: ["in_production"] });
    const moved = await setBuilderStatus(testEnv.DB, { userId: hidden.builder.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    expect(moved?.status).toBe("suspended");
    expect((await searchProducts(testEnv.DB, parseCatalogQuery({}))).total).toBe(2);

    for (const path of ["/", "/vi/", "/zh-hans/", "/zh-hant/"]) {
      const html = await (await get(path)).text();
      const cards = cardsOf(deckOf(html));
      expect(cards.map((c) => attr(c.attrs, "data-kind")), path).toEqual(["category", "category", "category"]);
      const main = mainOf(html);
      expect(main, path).not.toContain("Deckalpha");
      expect(main, path).not.toContain("Deckhidden");
      // The "Ask us" form (VNX-0710) states a length rule ("20 to 2000 characters"), not a statistic.
      expect(textOf(main.slice(0, main.indexOf('<section id="ask"'))), path).not.toMatch(/\d/);
    }
  });

  it("AC7: with three or more public products, shows the first three in the neutral catalogue order and no category card", async () => {
    const third = await makeBuilder("deck-c@vnx.si", "deck-c", "approved");
    await addLiveProduct(third, "Deckcharlie", {
      at: "2026-01-15T00:00:00.000Z",
      badges: ["demo_verified"],
      fields: { category: "crm", primaryLang: "vi" },
      tiers: [
        { name: "Pro", billing: "monthly", priceCents: 4900, description: "" },
        { name: "Lite", billing: "monthly", priceCents: 2900, description: "" },
      ],
    });
    await addLiveProduct(third, "Deckdelta", { at: "2025-12-01T00:00:00.000Z", tiers: [{ name: "Custom", billing: "contact", priceCents: null, description: "" }] });

    const expected = (await neutralOrder()).slice(0, 3);
    expect(expected.map((i) => i.name)).toEqual(["Deckcharlie", "Deckbravo", "Deckalpha"]);

    for (const [path, locale] of [
      ["/", "en"],
      ["/vi/", "vi"],
      ["/zh-hant/", "zh-Hant"],
    ] as const) {
      const html = await (await get(path)).text();
      const deck = deckOf(html);
      const cards = cardsOf(deck);
      expect(cards.map((c) => attr(c.attrs, "data-kind")), path).toEqual(["product", "product", "product"]);
      expect(deck, path).not.toContain('data-kind="category"');
      expect(textOf(deck), path).not.toContain(t(locale, "landing.deck.open"));
      for (const [i, item] of expected.entries()) {
        const card = cards[i]!;
        expect(textOf(card.body), `${path} ${item.name}`).toContain(item.name);
        expect(textOf(card.body)).toContain(item.tagline);
        expect(card.body).toContain(`href="${path === "/" ? "" : path.slice(0, -1)}/p/${item.slug}"`);
        expect(textOf(card.body)).toContain(t(locale, "landing.deck.view"));
      }
      expect(textOf(mainOf(html))).not.toContain("Deckhidden");
      expect(textOf(mainOf(html))).not.toContain("Deckdelta");
    }

    // Category, primary language, cheapest price and active badges come from the real product.
    const en = cardsOf(deckOf(await (await get("/")).text()));
    const charlie = textOf(en[0]!.body);
    expect(charlie).toContain(t("en", "product.category.crm"));
    expect(charlie).toContain(t("en", "product.lang.vi"));
    expect(charlie).toContain(t("en", "catalog.from", { amount: "$29" }));
    expect(charlie).toContain(t("en", "badge.listed"));
    expect(charlie).toContain(t("en", "badge.demo_verified"));
    expect(charlie).not.toContain(t("en", "badge.in_production"));
    const alpha = textOf(en[2]!.body);
    expect(alpha).toContain(t("en", "product.category.booking"));
    expect(alpha).toContain(t("en", "product.lang.en"));
    expect(alpha).toContain(t("en", "catalog.from", { amount: "$19" }));
  });

  it("AC7: a product whose only tier is 'contact' shows Contact for price", async () => {
    const b = await makeBuilder("deck-e@vnx.si", "deck-e", "approved");
    await addLiveProduct(b, "Deckecho", { at: "2026-06-01T00:00:00.000Z", badges: ["in_production"], tiers: [{ name: "Custom", billing: "contact", priceCents: null, description: "" }] });
    const first = cardsOf(deckOf(await (await get("/vi/")).text()))[0]!;
    expect(textOf(first.body)).toContain("Deckecho");
    expect(textOf(first.body)).toContain(t("vi", "pricing.billing.contact"));
  });
});
