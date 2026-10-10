import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listTiers } from "../../src/db/pricing.ts";
import { findProductById, setProductStatus } from "../../src/db/products.ts";
import { makeBuilder, makeDraft, signIn } from "../fixtures.ts";
import { expectErrorSummary, formPost, getReq, testEnv } from "../helpers.ts";

const post = (id: string, cookie: string, body: Record<string, string>) =>
  createApp().request(formPost(`/hub/products/${id}/edit/pricing`, body, { cookie }), undefined, testEnv);

describe("pricing step (spec §5.3, §6.1)", () => {
  it("saves up to 5 tiers, replacing the previous set", async () => {
    const { product } = await makeDraft("pr-save@vnx.si", "pr-save", "Priced");
    const { cookie } = await signIn("pr-save@vnx.si");
    const res = await post(product.id, cookie, {
      "tiers[0].name": "Starter",
      "tiers[0].billing": "monthly",
      "tiers[0].price": "19",
      "tiers[1].name": "Enterprise",
      "tiers[1].billing": "contact",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/hub/products/${product.id}/edit/pricing?saved=1`);
    expect((await listTiers(testEnv.DB, product.id)).map((t) => [t.name, t.billing, t.priceCents, t.sort])).toEqual([
      ["Starter", "monthly", 1900, 1],
      ["Enterprise", "contact", null, 2],
    ]);
    await post(product.id, cookie, { "tiers[0].name": "Only", "tiers[0].billing": "one_time", "tiers[0].price": "99.5" });
    expect((await listTiers(testEnv.DB, product.id)).map((t) => [t.name, t.priceCents])).toEqual([["Only", 9950]]);

    const form = await (await createApp().request(getReq(`/hub/products/${product.id}/edit/pricing`, cookie), undefined, testEnv)).text();
    expect(form).toContain('value="Only"');
    expect(form).toContain('value="99.50"');
    expect(form).toContain('name="tiers[4].name"');
  });

  it("re-renders errors (400) and keeps the stored tiers", async () => {
    const { product } = await makeDraft("pr-bad@vnx.si", "pr-bad", "Bad Price");
    const { cookie } = await signIn("pr-bad@vnx.si");
    await post(product.id, cookie, { "tiers[0].name": "Keep", "tiers[0].billing": "one_time", "tiers[0].price": "5" });
    const res = await post(product.id, cookie, { "tiers[0].name": "Bad", "tiers[0].billing": "one_time", "tiers[0].price": "abc" });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Enter a price from 0 to 100000 USD");
    expect(html).toContain('value="abc"');
    expect(expectErrorSummary(html, ["tier-0-price"])).toContain("Tier 1 · ");
    expect(html).toContain('aria-describedby="tier-0-price-error"');
    expect((await listTiers(testEnv.DB, product.id)).map((t) => t.name)).toEqual(["Keep"]);
  });

  it("blocks other builders (404) and locked products (409)", async () => {
    const { product } = await makeDraft("pr-owner@vnx.si", "pr-owner", "Locked Price");
    await makeBuilder("pr-intruder@vnx.si", "pr-intruder");
    const intruder = await signIn("pr-intruder@vnx.si");
    expect((await post(product.id, intruder.cookie, { "tiers[0].name": "X", "tiers[0].billing": "contact" })).status).toBe(404);
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now: new Date().toISOString() });
    const owner = await signIn("pr-owner@vnx.si");
    expect((await post(product.id, owner.cookie, { "tiers[0].name": "X", "tiers[0].billing": "contact" })).status).toBe(409);
    expect(await listTiers(testEnv.DB, product.id)).toEqual([]);
  });

  it("flags a published product as edited", async () => {
    const { product } = await makeDraft("pr-live@vnx.si", "pr-live", "Live Price");
    const now = new Date().toISOString();
    await setProductStatus(testEnv.DB, { id: product.id, from: "draft", to: "in_review", reviewNote: null, now });
    await setProductStatus(testEnv.DB, { id: product.id, from: "in_review", to: "published", reviewNote: null, now });
    const { cookie } = await signIn("pr-live@vnx.si");
    await post(product.id, cookie, { "tiers[0].name": "New", "tiers[0].billing": "yearly", "tiers[0].price": "120" });
    expect((await findProductById(testEnv.DB, product.id))?.editedAfterPublishAt).not.toBeNull();
  });
});
