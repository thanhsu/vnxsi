import { describe, expect, it } from "vitest";
import { findMerchantBySlug, listActiveProgramMerchants, listSitemapMerchants, setDefaultOffer } from "../../src/db/merchants.ts";
import { listActiveMerchantOffers } from "../../src/db/offers.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

describe("findMerchantBySlug", () => {
  it("finds a merchant in any status, and nothing for an unknown slug", async () => {
    const paused = await makeMerchant({ status: "paused" });
    expect(await findMerchantBySlug(testEnv.DB, paused.slug)).toMatchObject({ id: paused.id, status: "paused", name: paused.name });
    expect(await findMerchantBySlug(testEnv.DB, "no-such-merchant")).toBeNull();
  });
});

describe("listActiveMerchantOffers", () => {
  it("returns this merchant's active offers only, default first, then oldest first, with label and program", async () => {
    const admin = await ensureUser("reads-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const program = await makeProgram(m);
    const plain = await makeOffer(m, null, { label: "learn_more" });
    const tracked = await makeOffer(m, program, { label: "try_it" });
    await makeOffer(m, null, { status: "paused" });
    await makeOffer(m, null, { status: "archived" });
    await makeOffer(other, null);

    expect((await listActiveMerchantOffers(testEnv.DB, m.id)).map((r) => r.offer.id)).toEqual([plain.id, tracked.id]);

    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: tracked.id, actorUserId: admin.id, now: "2026-10-05T00:00:00.000Z" });
    const rows = await listActiveMerchantOffers(testEnv.DB, m.id);
    expect(rows.map((r) => r.offer.id)).toEqual([tracked.id, plain.id]);
    expect(rows[0]).toMatchObject({ label: "try_it", program: { id: program.id, status: "active", type: "affiliate" }, offer: { programId: program.id } });
    expect(rows[1]).toMatchObject({ label: "learn_more", program: null });
    expect(await listActiveMerchantOffers(testEnv.DB, "01HZZZZZZZZZZZZZZZZZZZZZZZ")).toEqual([]);
  });
});

describe("listSitemapMerchants", () => {
  it("lists active and indexable merchants only", async () => {
    const live = await makeMerchant({ indexable: true });
    const hidden = await makeMerchant({ indexable: false });
    const paused = await makeMerchant({ indexable: true, status: "paused" });
    const slugs = (await listSitemapMerchants(testEnv.DB)).map((m) => m.slug);
    expect(slugs).toContain(live.slug);
    for (const m of [hidden, paused]) expect(slugs).not.toContain(m.slug);
  });
});

describe("listActiveProgramMerchants", () => {
  it("lists active merchants that have an active program, once each, by name; nobody else", async () => {
    const twice = await makeMerchant({ name: "Zeta Active Twice" });
    await makeProgram(twice);
    await makeProgram(twice);
    const first = await makeMerchant({ name: "alpha active once" });
    await makeProgram(first);
    const draft = await makeMerchant();
    await makeProgram(draft, { status: "draft", termsUrl: null, termsVerifiedAt: null });
    const ended = await makeMerchant();
    await makeProgram(ended, { status: "ended" });
    const pausedMerchant = await makeMerchant({ status: "paused" });
    await makeProgram(pausedMerchant);
    const archivedMerchant = await makeMerchant({ status: "archived" });
    await makeProgram(archivedMerchant);
    await makeMerchant(); // no program

    const rows = await listActiveProgramMerchants(testEnv.DB);
    const slugs = rows.map((r) => r.slug);
    expect(slugs.filter((s) => s === twice.slug)).toHaveLength(1);
    expect(slugs).toContain(first.slug);
    for (const m of [draft, ended, pausedMerchant, archivedMerchant]) expect(slugs, m.slug).not.toContain(m.slug);
    expect(rows.find((r) => r.slug === first.slug)).toEqual({ slug: first.slug, name: "alpha active once" });
    expect(slugs.indexOf(first.slug)).toBeLessThan(slugs.indexOf(twice.slug));
  });
});
