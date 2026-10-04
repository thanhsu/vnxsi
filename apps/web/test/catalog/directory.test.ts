import { describe, expect, it } from "vitest";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { listDirectoryCountries, searchBuilders } from "../../src/db/directory.ts";
import { createProductDraft, updateProductFields } from "../../src/db/products.ts";
import { parseDirectoryQuery } from "../../src/domain/directory.ts";
import { addLiveProduct, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const find = (params: Record<string, string>) => searchBuilders(testEnv.DB, parseDirectoryQuery(params));
const handles = async (params: Record<string, string>) => (await find(params)).items.map((e) => e.handle);
const approvedAt = (userId: string, at: string) => testEnv.DB.prepare("UPDATE builders SET approved_at = ?2 WHERE user_id = ?1").bind(userId, at).run();

describe("searchBuilders (spec §5.2)", () => {
  it("lists only approved builders on active accounts", async () => {
    await makeBuilder("d-ok@vnx.si", "d-ok", "approved", { name: "Pubcheck ok" });
    await makeBuilder("d-pend@vnx.si", "d-pend", "pending", { name: "Pubcheck pending" });
    await makeBuilder("d-rej@vnx.si", "d-rej", "rejected", { name: "Pubcheck rejected" });
    await makeBuilder("d-susp@vnx.si", "d-susp", "suspended", { name: "Pubcheck suspended" });
    const off = await makeBuilder("d-user@vnx.si", "d-user", "approved", { name: "Pubcheck user off" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(off.userId).run();
    expect(await handles({ q: "pubcheck" })).toEqual(["d-ok"]);
  }, 30_000);

  it("orders open first, then more published products, then newest approval", async () => {
    const limitedMany = await makeBuilder("d-o1@vnx.si", "d-o1", "approved", { name: "Ordcheck limited", availability: "limited" });
    const openOld = await makeBuilder("d-o2@vnx.si", "d-o2", "approved", { name: "Ordcheck open old" });
    const openNew = await makeBuilder("d-o3@vnx.si", "d-o3", "approved", { name: "Ordcheck open new" });
    const openOne = await makeBuilder("d-o4@vnx.si", "d-o4", "approved", { name: "Ordcheck open one" });
    for (let i = 0; i < 3; i++) await addLiveProduct(limitedMany, `Ordcheck item ${i}`);
    await addLiveProduct(openOne, "Ordcheck single");
    await approvedAt(openOld.userId, "2026-01-01T00:00:00.000Z");
    await approvedAt(openNew.userId, "2026-06-01T00:00:00.000Z");
    expect(await handles({ q: "ordcheck" })).toEqual(["d-o4", "d-o3", "d-o2", "d-o1"]);
    const many = (await find({ q: "ordcheck" })).items.find((e) => e.handle === "d-o1");
    expect(many?.publishedCount).toBe(3);
  }, 30_000);

  it("searches name and skills, case-insensitively, without LIKE wildcards", async () => {
    await makeBuilder("d-s1@vnx.si", "d-s1", "approved", { name: "Skillcheck Anh", skills: "Quokkaflow, Rust" });
    await makeBuilder("d-s2@vnx.si", "d-s2", "approved", { name: "Skillcheck Binh", skills: "Go" });
    expect(await handles({ q: "QUOKKA" })).toEqual(["d-s1"]);
    expect((await handles({ q: "skillcheck" })).sort()).toEqual(["d-s1", "d-s2"]);
    expect(await handles({ q: "skillcheck quokkaflow" })).toEqual(["d-s1"]);
    for (const q of ["%", "_", "\\", '"', "x".repeat(500)]) await expect(find({ q }), q).resolves.toBeDefined();
    expect((await find({ q: "%" })).total).toBe(0);
    expect((await find({ q: '"' })).total).toBe(0);
  }, 30_000);

  it("filters by category of published products, work language, country and availability", async () => {
    const crm = await makeBuilder("d-f1@vnx.si", "d-f1", "approved", { name: "Filtcheck crm", workLanguages: ["zh"], country: "SG", availability: "closed" });
    await addLiveProduct(crm, "Filtcheck crm product", { fields: { category: "crm" } });
    const draftOnly = await makeBuilder("d-f2@vnx.si", "d-f2", "approved", { name: "Filtcheck draft" });
    // A crm product that is only a draft does not put its builder in the crm filter.
    const draft = await createProductDraft(testEnv.DB, { builderId: draftOnly.userId, name: "Filtcheck draft product", now: new Date().toISOString() });
    await updateProductFields(testEnv.DB, { productId: draft.id, builderId: draftOnly.userId, expectedStatus: "draft", markEdited: false, now: new Date().toISOString(), fields: { category: "crm" } });
    await makeBuilder("d-f3@vnx.si", "d-f3", "approved", { name: "Filtcheck plain" });

    expect(await handles({ q: "filtcheck", category: "crm" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", lang: "zh" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", country: "sg" })).toEqual(["d-f1"]);
    expect(await handles({ q: "filtcheck", availability: "closed" })).toEqual(["d-f1"]);
    expect((await handles({ q: "filtcheck", lang: "vi" })).sort()).toEqual(["d-f2", "d-f3"]);
  }, 30_000);

  it("does not count products of other statuses or hide builders when a product is suspended", async () => {
    const b = await makeBuilder("d-c1@vnx.si", "d-c1", "approved", { name: "Countcheck" });
    const live = await addLiveProduct(b, "Countcheck live");
    await addLiveProduct(b, "Countcheck second");
    await testEnv.DB.prepare("UPDATE products SET status = 'suspended' WHERE id = ?1").bind(live.id).run();
    expect((await find({ q: "countcheck" })).items[0]?.publishedCount).toBe(1);
  }, 30_000);

  it("lists the countries of public builders only", async () => {
    await makeBuilder("d-k1@vnx.si", "d-k1", "approved", { country: "JP" });
    await makeBuilder("d-k2@vnx.si", "d-k2", "pending", { country: "KR" });
    const off = await makeBuilder("d-k3@vnx.si", "d-k3", "approved", { country: "FR" });
    await setBuilderStatus(testEnv.DB, { userId: off.userId, from: "approved", to: "suspended", reviewNote: null, now: new Date().toISOString() });
    const countries = await listDirectoryCountries(testEnv.DB);
    expect(countries).toContain("JP");
    expect(countries).not.toContain("KR");
    expect(countries).not.toContain("FR");
    expect([...countries].sort()).toEqual(countries);
  }, 30_000);
});
