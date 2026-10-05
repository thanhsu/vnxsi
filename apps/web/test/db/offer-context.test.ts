import { describe, expect, it } from "vitest";
import { findMerchantById, setDefaultOffer } from "../../src/db/merchants.ts";
import { findDefaultOfferContext, findOfferWithContext, type RedirectRows } from "../../src/db/offers.ts";
import { resolveOfferRedirect } from "../../src/domain/offer.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeMerchant, makeOffer, makeProgram } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = "2026-10-05T00:00:00.000Z";
const at = (n: number) => new Date(Date.parse(NOW) + n * 1000).toISOString();
const actionsOf = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((a) => a.action);

describe("setDefaultOffer (ownership inside the UPDATE)", () => {
  it("accepts the merchant's own paused offer (only archived is refused)", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { status: "paused" });
    expect(await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: admin.id, now: at(2) })).toMatchObject({ defaultOfferId: o.id });
  });

  it("sets the merchant's own offer, audits merchant.update with the offer id, and can clear it", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const set = await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: admin.id, now: at(2) });
    expect(set).toMatchObject({ id: m.id, defaultOfferId: o.id, updatedAt: at(2) });
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity_id = ?1 AND action = 'merchant.update'").bind(m.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ defaultOfferId: o.id });
    expect((await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: null, actorUserId: admin.id, now: at(3) }))?.defaultOfferId).toBeNull();
    expect(await actionsOf(m.id)).toEqual(["merchant.create", "merchant.update", "merchant.update"]);
  });

  it("another merchant's offer, an archived offer, a non-merchant offer, an unknown offer or merchant: null, nothing written, nothing audited", async () => {
    const admin = await ensureUser("d-admin@vnx.si");
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeOffer(other, null);
    const archived = await makeOffer(m, null, { status: "archived" });
    const productOffer = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(productOffer.id).run();
    for (const offerId of [foreign.id, archived.id, productOffer.id, "missing"]) {
      expect(await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId, actorUserId: admin.id, now: at(2) }), offerId).toBeNull();
    }
    expect(await setDefaultOffer(testEnv.DB, { merchantId: "missing", offerId: null, actorUserId: admin.id, now: at(3) })).toBeNull();
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect(await actionsOf(m.id)).toEqual(["merchant.create"]);
    expect(await actionsOf("missing")).toEqual([]);
  });
});

const FLAGS_ON = { affiliate: true, partner_referral: false };
const resolve = (rows: RedirectRows, clickId = ulid()) =>
  resolveOfferRedirect({ ...rows, flags: FLAGS_ON, now: at(1), clickId, locale: "en", src: "tools" });

describe("findOfferWithContext (exactly what resolveOfferRedirect needs)", () => {
  it("returns offer, program and merchant, and the result feeds resolveOfferRedirect as is", async () => {
    const m = await makeMerchant({ allowedHosts: ["example.com", "app.example.com"] });
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.offer).toEqual({ id: o.id, subjectType: "merchant", subjectId: m.id, programId: p.id, status: "active", destinationUrl: "https://example.com/", trackingTemplate: "https://example.com/r?c={click_id}", startsAt: null, endsAt: null });
    expect(rows.program).toEqual({ id: p.id, merchantId: m.id, type: "affiliate", status: "active" });
    expect(rows.merchant).toEqual({ id: m.id, status: "active", websiteUrl: "https://example.com/", allowedHosts: ["example.com", "app.example.com"] });
    const clickId = ulid();
    expect(resolve(rows, clickId)).toEqual({ kind: "tracked", url: `https://example.com/r?c=${clickId}`, programId: p.id });
  });

  it("an offer without a program has a null program and still resolves", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null, { destinationUrl: "https://example.com/page" });
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.program).toBeNull();
    expect(rows.merchant?.id).toBe(m.id);
    expect(resolve(rows).kind).toBe("tracked");
  });

  it("an unknown offer gives three nulls (resolveOfferRedirect says offer_missing)", async () => {
    const rows = await findOfferWithContext(testEnv.DB, "missing");
    expect(rows).toEqual({ offer: null, program: null, merchant: null });
    expect(resolve(rows)).toEqual({ kind: "not_found", reason: "offer_missing" });
  });

  it("the merchant is loaded by subject_id, only for subject_type merchant", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET subject_type = 'product' WHERE id = ?1").bind(o.id).run();
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.offer?.subjectType).toBe("product");
    expect(rows.merchant).toBeNull();
  });

  it("a program of another merchant is returned as stored; the domain refuses it", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const o = await makeOffer(m, null);
    await testEnv.DB.prepare("UPDATE offers SET program_id = ?2, tracking_template = 'https://example.com/r' WHERE id = ?1").bind(o.id, foreign.id).run();
    const rows = await findOfferWithContext(testEnv.DB, o.id);
    expect(rows.program?.merchantId).toBe(other.id);
    expect(rows.merchant?.id).toBe(m.id);
    expect(resolve(rows)).toEqual({ kind: "not_found", reason: "program_merchant" });
  });

  it("damaged allowed_hosts read as an empty list and never throw", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    for (const bad of ['{"a":1}', '["127.0.0.1"]', '"example.com"']) {
      await testEnv.DB.prepare("UPDATE merchants SET allowed_hosts = ?2 WHERE id = ?1").bind(m.id, bad).run();
      expect((await findOfferWithContext(testEnv.DB, o.id)).merchant?.allowedHosts, bad).toEqual([]);
    }
  });
});

describe("findDefaultOfferContext", () => {
  const admin = () => ensureUser("d-admin@vnx.si");

  it("returns the merchant's default offer with its program and merchant, and it resolves", async () => {
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const o = await makeOffer(m, p);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: (await admin()).id, now: at(2) });
    const rows = await findDefaultOfferContext(testEnv.DB, m.slug);
    expect(rows?.offer.id).toBe(o.id);
    expect(rows?.program?.id).toBe(p.id);
    expect(rows?.merchant.id).toBe(m.id);
    expect(rows && resolve(rows).kind).toBe("tracked");
  });

  it("an unknown slug, or a merchant without a default offer, gives null", async () => {
    const m = await makeMerchant();
    await makeOffer(m, null);
    expect(await findDefaultOfferContext(testEnv.DB, "no-such-slug-0000")).toBeNull();
    expect(await findDefaultOfferContext(testEnv.DB, m.slug)).toBeNull();
  });

  it("a default offer that belongs to another merchant gives null, even when written straight into the row", async () => {
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeOffer(other, null);
    await testEnv.DB.prepare("UPDATE merchants SET default_offer_id = ?2 WHERE id = ?1").bind(m.id, foreign.id).run();
    expect(await findDefaultOfferContext(testEnv.DB, m.slug)).toBeNull();
    expect(await findDefaultOfferContext(testEnv.DB, other.slug)).toBeNull();
  });

  it("a paused merchant and an archived default offer are still returned (the route and the domain decide)", async () => {
    const m = await makeMerchant({ status: "paused" });
    const o = await makeOffer(m, null);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: (await admin()).id, now: at(2) });
    expect((await findDefaultOfferContext(testEnv.DB, m.slug))?.merchant.status).toBe("paused");
    await testEnv.DB.prepare("UPDATE offers SET status = 'archived' WHERE id = ?1").bind(o.id).run();
    const rows = await findDefaultOfferContext(testEnv.DB, m.slug);
    expect(rows && resolve(rows)).toEqual({ kind: "not_found", reason: "offer_archived" });
  });
});
