import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { findMerchantById, setDefaultOffer } from "../../src/db/merchants.ts";
import { findOfferById, listOffersByMerchant } from "../../src/db/offers.ts";
import { makeMerchant, makeOffer, makeProgram, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const send = (req: Request) => createApp().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });
const ofields = (o: Record<string, string> = {}) => ({
  programId: "",
  kind: "official",
  label: "visit_site",
  destinationUrl: "https://example.com/",
  trackingTemplate: "",
  startsAt: "",
  endsAt: "",
  status: "active",
  expectedStatus: "active",
  ...o,
});
const auditActions = async (entityId: string) =>
  (await testEnv.DB.prepare("SELECT action FROM audit_log WHERE entity_id = ?1 ORDER BY created_at, id").bind(entityId).all<{ action: string }>()).results.map((r) => r.action);
const offerCount = async (merchantId: string) => (await listOffersByMerchant(testEnv.DB, merchantId)).length;

beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags").run();
  resetFlagCache();
});

describe("create and edit offers", () => {
  it("enters the partner-shaped data: untracked link, template, try_it label, set as default", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant({ websiteUrl: "https://elevenlabs.example/", allowedHosts: ["try.example.net", "elevenlabs.example"] });
    const p = await makeProgram(m);
    const res = await send(
      formPost(`/admin/merchants/${m.id}/offers`, ofields({ programId: p.id, kind: "affiliate", label: "try_it", destinationUrl: "https://elevenlabs.example/", trackingTemplate: "https://try.example.net/r/sample-code" }), { cookie }),
    );
    expect(res.status).toBe(303);
    const [offer] = await listOffersByMerchant(testEnv.DB, m.id);
    expect(offer).toMatchObject({ programId: p.id, label: "try_it", destinationUrl: "https://elevenlabs.example/", trackingTemplate: "https://try.example.net/r/sample-code", status: "active" });
    expect(await auditActions(offer!.id)).toEqual(["offer.create"]);

    const def = await send(formPost(`/admin/merchants/${m.id}/default-offer`, { offerId: offer!.id }, { cookie }));
    expect(def.status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(offer!.id);
    expect(await auditActions(m.id)).toEqual(["merchant.create", "merchant.update"]);
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("Untracked link");
    expect(html).toContain("{click_id}"); // the hint text keeps its literal placeholder
  });

  it("refuses a host outside allowed_hosts, an unknown placeholder, http:, a missing template, and a destination equal to the template; nothing is written", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    const cases: [Record<string, string>, string][] = [
      [{ destinationUrl: "https://evil.com/" }, "destinationUrl"],
      [{ destinationUrl: "http://example.com/" }, "destinationUrl"],
      [{ destinationUrl: "https://example.com@evil.com/" }, "destinationUrl"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "https://example.com/r?c={nope}" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "https://evil.com/r" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", trackingTemplate: "" }, "trackingTemplate"],
      [{ programId: p.id, kind: "affiliate", destinationUrl: "https://example.com/r", trackingTemplate: "https://example.com/r" }, "destinationUrl"],
      [{ label: "buy_now" }, "label"],
      [{ kind: "affiliate" }, "kind"],
      [{ kind: "sponsored" }, "kind"],
      [{ startsAt: "2026-10-05 09:30" }, "startsAt"],
      [{ startsAt: "2026-10-06T00:00", endsAt: "2026-10-05T00:00" }, "endsAt"],
      [{ programId: "01HZZZZZZZZZZZZZZZZZZZZZZZ" }, "programId"],
    ];
    for (const [override, field] of cases) {
      const res = await send(formPost(`/admin/merchants/${m.id}/offers`, ofields(override), { cookie }));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(await res.text(), JSON.stringify(override)).toContain(`id="offers-new-${field}-error"`);
    }
    expect(await offerCount(m.id)).toBe(0);
  });

  it("a program of another merchant is refused", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const foreign = await makeProgram(other);
    const res = await send(formPost(`/admin/merchants/${m.id}/offers`, ofields({ programId: foreign.id, kind: "affiliate", trackingTemplate: "https://example.com/r" }), { cookie }));
    expect(res.status).toBe(400);
    expect(await offerCount(m.id)).toBe(0);
  });

  it("dates: YYYY-MM-DDTHH:MM is stored as UTC, the form says UTC and shows the stored value back", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    await send(formPost(`/admin/merchants/${m.id}/offers`, ofields({ startsAt: "2026-10-05T09:30", endsAt: "2026-10-06T00:00:00.000Z" }), { cookie }));
    const [o] = await listOffersByMerchant(testEnv.DB, m.id);
    expect(o).toMatchObject({ startsAt: "2026-10-05T09:30:00.000Z", endsAt: "2026-10-06T00:00:00.000Z" });
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("UTC");
    expect(html).toContain('value="2026-10-05T09:30:00.000Z"');
  });

  it("an update audits offer.update or offer.status; a stale expectedStatus is a 409; archived is final; an offer of another merchant is a 404", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const o = await makeOffer(m, null);
    const foreign = await makeOffer(other, null);
    const url = `/admin/merchants/${m.id}/offers/${o.id}`;
    expect((await send(formPost(url, ofields({ label: "learn_more" }), { cookie }))).status).toBe(303);
    expect((await send(formPost(url, ofields({ status: "paused" }), { cookie }))).status).toBe(303);
    expect(await auditActions(o.id)).toEqual(["offer.create", "offer.update", "offer.status"]);
    expect((await send(formPost(url, ofields({ status: "active", expectedStatus: "active" }), { cookie }))).status).toBe(409); // it is paused now
    expect((await send(formPost(url, ofields({ status: "archived", expectedStatus: "paused" }), { cookie }))).status).toBe(303);
    expect((await send(formPost(url, ofields({ status: "active", expectedStatus: "archived" }), { cookie }))).status).toBe(409);
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("archived");
    expect((await send(formPost(url, ofields({ status: "archived", expectedStatus: "bogus" }), { cookie }))).status).toBe(400);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers/${foreign.id}`, ofields(), { cookie }))).status).toBe(404);
    expect((await findOfferById(testEnv.DB, foreign.id))?.label).toBe("visit_site");
  });

  it("shows the offer id in its heading so a broken-offer list can be matched", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    expect(await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text()).toContain(`<code>${o.id}</code>`);
  });
});

describe("default offer", () => {
  it("sets the merchant's own offer, can clear it, and a foreign, archived or unknown offer is a 404 that writes nothing", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const other = await makeMerchant();
    const mine = await makeOffer(m, null);
    const archived = await makeOffer(m, null, { status: "archived" });
    const foreign = await makeOffer(other, null);
    const url = `/admin/merchants/${m.id}/default-offer`;
    for (const id of [foreign.id, archived.id, "01HZZZZZZZZZZZZZZZZZZZZZZZ"]) expect((await send(formPost(url, { offerId: id }, { cookie }))).status, id).toBe(404);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect(await auditActions(m.id)).toEqual(["merchant.create"]);
    expect((await send(formPost(url, { offerId: mine.id }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(mine.id);
    expect((await send(formPost(url, { offerId: "" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
    expect((await send(formPost(`/admin/merchants/01HZZZZZZZZZZZZZZZZZZZZZZZ/default-offer`, { offerId: mine.id }, { cookie }))).status).toBe(404);
  });

  it("archiving the current default offer needs the confirm tick; then the merchant page says the default offer is archived", async () => {
    const { cookie, user } = await admin();
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    await setDefaultOffer(testEnv.DB, { merchantId: m.id, offerId: o.id, actorUserId: user.id, now: new Date().toISOString() });
    const url = `/admin/merchants/${m.id}/offers/${o.id}`;
    expect(await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text()).not.toContain('data-warning="default-archived"');
    const refused = await send(formPost(url, ofields({ status: "archived" }), { cookie }));
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain(`id="offers-${o.id}-confirmArchive-error"`);
    expect((await findOfferById(testEnv.DB, o.id))?.status).toBe("active");
    expect((await send(formPost(url, ofields({ status: "archived", confirmArchive: "1" }), { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBe(o.id); // not cleared: /go/ answers 404 for it
    const warned = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(warned).toMatch(/data-warning="default-archived"[\s\S]*?\/default-offer/); // with a clear-default button inside
    expect((await send(formPost(`/admin/merchants/${m.id}/default-offer`, { offerId: "" }, { cookie }))).status).toBe(303);
    expect((await findMerchantById(testEnv.DB, m.id))?.defaultOfferId).toBeNull();
  });

  it("archiving an offer that is not the default needs no confirmation", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers/${o.id}`, ofields({ status: "archived" }), { cookie }))).status).toBe(303);
  });
});

describe("final URL preview", () => {
  it("shows the tracked link and the fallback link side by side, with the flag on and with it off", async () => {
    const { cookie, user } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p, { trackingTemplate: "https://example.com/r?c={click_id}&s={src}" });
    const tracked = "https://example.com/r?c=01HZZZZZZZZZZZZZZZZZZZZZZZ&amp;s=tools";
    const fallback = "https://example.com/?utm_source=vnx.si&amp;utm_medium=referral";

    const off = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(off).toContain(tracked);
    expect(off).toContain(fallback);
    expect(off).toContain("flag_off");
    expect(off).toContain('data-preview-now="fallback"');

    await setFlag(testEnv.DB, { key: "affiliate", enabled: true, actorUserId: user.id, now: new Date().toISOString() });
    const on = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(on).toContain(tracked);
    expect(on).toContain(fallback);
    expect(on).toContain('data-preview-now="tracked"');
  });

  it("an offer without a program labels the first line as the merchant link, not as a tracked link", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    await makeOffer(m, null);
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("Merchant link (no tracking)");
    expect(html).not.toContain("Tracked link");
  });

  it("a broken stored template shows its error instead of a link", async () => {
    const { cookie } = await admin();
    const m = await makeMerchant();
    const p = await makeProgram(m);
    await makeOffer(m, p, { trackingTemplate: "https://evil.com/r?c={click_id}" }); // the db does not check hosts: corrupt data
    const html = await (await send(getReq(`/admin/merchants/${m.id}`, cookie))).text();
    expect(html).toContain("not_allowed");
    expect(html).not.toContain("<code>https://evil.com"); // no link is shown for it
  });
});

describe("offer section access", () => {
  it("offer routes are admin only and refuse a cross-site POST", async () => {
    const m = await makeMerchant();
    const o = await makeOffer(m, null);
    const { cookie } = await signIn("offer-user@vnx.si");
    for (const path of [`/admin/merchants/${m.id}/offers`, `/admin/merchants/${m.id}/offers/${o.id}`, `/admin/merchants/${m.id}/default-offer`]) {
      expect((await send(formPost(path, ofields({ offerId: o.id }), { cookie }))).status, path).toBe(403);
    }
    const admin2 = await admin();
    const before = await offerCount(m.id);
    expect((await send(formPost(`/admin/merchants/${m.id}/offers`, ofields(), { cookie: admin2.cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect(await offerCount(m.id)).toBe(before);
  });
});
