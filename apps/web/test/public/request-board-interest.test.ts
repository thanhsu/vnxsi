import { beforeEach, describe, expect, it } from "vitest";
import { createProductDraft } from "../../src/db/products.ts";
import { findClientRequest } from "../../src/db/requests.ts";
import { createInterestStatement, returnedInterest, withdrawStatement } from "../../src/db/request-board.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { INTEREST_DAILY_LIMIT, INTEREST_NOTE_MAX, INTEREST_PENDING_CAP } from "../../src/domain/request-board.ts";
import type { Bindings } from "../../src/env.ts";
import { localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { addLiveProduct, inviteBuilders, makeBuilder, signIn } from "../fixtures.ts";
import { countD1Queries, expectErrorSummary, formPost, getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, get, listed, mainOf, tag, type Listed } from "./request-board-helpers.ts";

/** VNX-2706a: "I'm interested" (addendum 3.3, 4.2, 4.4, 9.1). Identification strings (ZQX-*) never reach a builder-facing page. */

const esc = (s: string) => s.replace(/'/g, "&#39;");
const pagePath = (l: Listed, locale: Locale = "en") => localizedPath(locale, `/requests/${l.publicId}`);
const interestPath = (l: Listed, locale: Locale = "en") => `${pagePath(l, locale)}/interest`;
const withdrawPath = (l: Listed, locale: Locale = "en") => `${pagePath(l, locale)}/interest/withdraw`;
const post = (path: string, cookie: string | undefined, fields: Record<string, string> = {}, env: Bindings = boardEnv, headers: Record<string, string> = {}) =>
  app().request(formPost(path, fields, cookie ? { cookie, ...headers } : headers), undefined, env);

async function builderOf(status: "approved" | "pending" | "rejected" | "suspended" = "approved") {
  const email = `zqx-ib-${tag()}@vnx.si`;
  const b = await makeBuilder(email, `zqxib${tag()}`, status === "suspended" ? "approved" : status);
  if (status === "suspended") await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(b.userId).run();
  const { cookie } = await signIn(email);
  return { builder: b, cookie, email };
}

const rows = (l: Listed, builderId: string) =>
  testEnv.DB.prepare("SELECT * FROM request_interests WHERE request_id = ?1 AND builder_id = ?2")
    .bind(l.requestId, builderId)
    .all<{ id: string; status: string; note: string | null; product_id: string | null }>()
    .then((r) => r.results);
const audits = async (action: string, entityId: string) => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, entityId).first<{ n: number }>())?.n ?? 0;
const express = (publicId: string, builderId: string) =>
  testEnv.DB.batch([createInterestStatement(testEnv.DB, { id: ulid(), writeId: ulid(), publicId, builderId, note: null, productId: null, now: new Date().toISOString(), pendingCap: INTEREST_PENDING_CAP })]).then((r) => returnedInterest(r[0]));
const todayWindow = () => Math.floor(Date.now() / 1000 / 86400) * 86400;
const setUsed = (builderId: string, count: number) =>
  testEnv.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, ?3) ON CONFLICT (key, window_start) DO UPDATE SET count = ?3").bind(`interest:builder:${builderId}`, todayWindow(), count).run();
const used = async (builderId: string) => (await testEnv.DB.prepare("SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2").bind(`interest:builder:${builderId}`, todayWindow()).first<{ count: number }>())?.count ?? 0;
const clientRequestOf = async (l: Listed) => (await findClientRequest(testEnv.DB, l.clientId, l.requestId))!;
const titlePrefix = (locale: Locale, html: string) => (locale === "en" ? "Error:" : /<title>([^ ]+) /.exec(html)![1]!);

beforeEach(async () => {
  clearOutbox();
  await boardFlag(true);
});

describe("POST /requests/:publicId/interest: who may (addendum 3.3)", () => {
  it("an approved builder on an active account: 303 back to the page and one pending row", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    const res = await post(interestPath(l), cookie, { note: "I built three booking apps.", productId: "" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(pagePath(l));
    const got = await rows(l, builder.userId);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ status: "pending", note: "I built three booking apps.", product_id: null });
    const html = await (await get(pagePath(l), cookie)).text();
    expect(mainOf(html)).toContain(esc(en["board.interest.sent"]));
    expect(mainOf(html)).toContain(en["board.interest.withdraw"]);
  });

  it("an OAuth session may do it (not a staff action)", async () => {
    const l = await listed();
    const email = `zqx-oa-${tag()}@vnx.si`;
    const b = await makeBuilder(email, `zqxoa${tag()}`, "approved");
    const { cookie } = await signIn(email, { method: "oauth_google" });
    expect((await post(interestPath(l), cookie, { note: "", productId: "" })).status).toBe(303);
    expect(await rows(l, b.userId)).toHaveLength(1);
  });

  it("not approved builders, non-builders and suspended users get no row", async () => {
    const l = await listed();
    for (const status of ["pending", "rejected", "suspended"] as const) {
      const { builder, cookie } = await builderOf(status);
      const res = await post(interestPath(l), cookie, { note: "", productId: "" });
      expect(res.status, status).toBe(409);
      expect(await rows(l, builder.userId), status).toHaveLength(0);
    }
    const plain = await signIn(`zqx-plain-${tag()}@vnx.si`);
    expect((await post(interestPath(l), plain.cookie, { note: "", productId: "" })).status).toBe(409);
    const { builder, cookie } = await builderOf();
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(builder.userId).run();
    const res = await post(interestPath(l), cookie, { note: "", productId: "" });
    expect([303, 409]).toContain(res.status);
    expect(await rows(l, builder.userId)).toHaveLength(0);
  });

  it("the request's own client, a builder already invited, and a second try: 409 and still at most one row", async () => {
    const l = await listed();
    const own = await makeBuilder(l.clientEmail, `zqxown${tag()}`, "approved");
    const ownCookie = (await signIn(l.clientEmail)).cookie;
    expect((await post(interestPath(l), ownCookie, { note: "", productId: "" })).status).toBe(409);
    expect(await rows(l, own.userId)).toHaveLength(0);

    const { builder: invited, cookie: invitedCookie } = await builderOf();
    await inviteBuilders(await clientRequestOf(l), [invited]);
    expect((await post(interestPath(l), invitedCookie, { note: "", productId: "" })).status).toBe(409);
    expect(await rows(l, invited.userId)).toHaveLength(0);

    const { builder, cookie } = await builderOf();
    expect((await post(interestPath(l), cookie, { note: "a", productId: "" })).status).toBe(303);
    expect((await post(interestPath(l), cookie, { note: "b", productId: "" })).status).toBe(409);
    const got = await rows(l, builder.userId);
    expect(got).toHaveLength(1);
    expect(got[0]?.note).toBe("a");
  });

  it("a closed request is 409; a hidden or unknown one and a closed gate are 404; signed out goes to /login with the localized next", async () => {
    const closed = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - 3600_000).toISOString() });
    const { builder, cookie } = await builderOf();
    expect((await post(interestPath(closed), cookie, { note: "", productId: "" })).status).toBe(409);
    expect(await rows(closed, builder.userId)).toHaveLength(0);
    for (const pubStatus of ["pending_review", "withdrawn", "unpublished", "rejected"] as const) {
      const hidden = await listed({ pubStatus });
      expect((await post(interestPath(hidden), cookie, { note: "", productId: "" })).status, pubStatus).toBe(404);
    }
    expect((await post("/requests/NOT-A-REAL-ID/interest", cookie, {})).status).toBe(404);

    const open = await listed();
    for (const locale of ["en", "vi"] as const) {
      const res = await post(interestPath(open, locale), undefined, { note: "", productId: "" });
      expect(res.status, locale).toBe(303);
      expect(res.headers.get("location")).toBe(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(pagePath(open, locale))}`);
    }
    expect((await post(interestPath(open), cookie, { note: "", productId: "" }, { ...boardEnv, REQUEST_BOARD_GO_LIVE: "" })).status).toBe(404);
    await boardFlag(false);
    expect((await post(interestPath(open), cookie, { note: "", productId: "" })).status).toBe(404);
  });

  it("origin: a missing or foreign Origin is 403 and writes nothing", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    const noOrigin = new Request(`https://vnx.si${interestPath(l)}`, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: "note=x&productId=" });
    expect((await app().request(noOrigin, undefined, boardEnv)).status).toBe(403);
    expect((await post(interestPath(l), cookie, { note: "x", productId: "" }, boardEnv, { origin: "https://evil.example" })).status).toBe(403);
    expect(await rows(l, builder.userId)).toHaveLength(0);
  });

  it("a POST above 64 KB is 413", async () => {
    const l = await listed();
    const { cookie } = await builderOf();
    expect((await post(interestPath(l), cookie, { note: "x".repeat(70 * 1024), productId: "" })).status).toBe(413);
  });

  it("has no side effect: the request keeps its status, no invitation, no e-mail", async () => {
    const l = await listed();
    const { cookie } = await builderOf();
    expect((await post(interestPath(l), cookie, { note: "hello", productId: "" })).status).toBe(303);
    expect(await testEnv.DB.prepare("SELECT status FROM requests WHERE id = ?1").bind(l.requestId).first()).toEqual({ status: "submitted" });
    expect(await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM request_invites WHERE request_id = ?1").bind(l.requestId).first()).toEqual({ n: 0 });
    expect(outbox).toEqual([]);
  });
});

describe("POST interest: the product (Q9)", () => {
  it("accepts one of the builder's own published products; another builder's, a draft or a made-up one is 409 with no row", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    const other = await makeBuilder(`zqx-o-${tag()}@vnx.si`, `zqxo${tag()}`, "approved");
    const theirs = await addLiveProduct(other, `Other ${tag()}`);
    const mine = await addLiveProduct(builder, `Mine ${tag()}`);
    const draft = await createProductDraft(testEnv.DB, { builderId: builder.userId, name: `Draft ${tag()}`, now: new Date().toISOString() });
    for (const productId of [theirs.id, draft.id, ulid()]) {
      const res = await post(interestPath(l), cookie, { note: "", productId });
      expect(res.status, productId).toBe(409);
      expect(await rows(l, builder.userId)).toHaveLength(0);
      expectErrorSummary(await res.text(), ["ib-product"]);
    }
    expect((await post(interestPath(l), cookie, { note: "", productId: "not-a-ulid" })).status).toBe(400);
    expect((await post(interestPath(l), cookie, { note: "", productId: mine.id })).status).toBe(303);
    expect((await rows(l, builder.userId))[0]?.product_id).toBe(mine.id);
  });
});

describe("POST interest: limits (H1, 10 a day, 30 waiting)", () => {
  it("10 a day: the 11th is 429, nothing written for it", async () => {
    const { builder, cookie } = await builderOf();
    const all: Listed[] = [];
    for (let i = 0; i <= INTEREST_DAILY_LIMIT; i++) all.push(await listed());
    for (const l of all.slice(0, INTEREST_DAILY_LIMIT)) expect((await post(interestPath(l), cookie, { note: "", productId: "" })).status).toBe(303);
    const last = all[INTEREST_DAILY_LIMIT]!;
    const res = await post(interestPath(last), cookie, { note: "", productId: "" });
    expect(res.status).toBe(429);
    expect(await rows(last, builder.userId)).toHaveLength(0);
    expect(await res.text()).toContain(esc(en["board.interest.rateLimited"].replace("{n}", String(INTEREST_DAILY_LIMIT))));
  }, 60_000);

  it("an invalid form does not count against the day; a 500-character note is fine", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    expect((await post(interestPath(l), cookie, { note: "x".repeat(INTEREST_NOTE_MAX + 1), productId: "" })).status).toBe(400);
    expect(await used(builder.userId)).toBe(0);
    expect((await post(interestPath(l), cookie, { note: "y".repeat(INTEREST_NOTE_MAX), productId: "" })).status).toBe(303);
    expect(await used(builder.userId)).toBe(1);
  });

  it("30 waiting at most, counted on open requests only: a 31st is 409 in SQL, withdrawing frees a place, closed requests hold none (H1)", async () => {
    const { builder } = await builderOf();
    const open: Listed[] = [];
    for (let i = 0; i < INTEREST_PENDING_CAP; i++) {
      const l = await listed();
      open.push(l);
      expect(await express(l.publicId, builder.userId), `interest ${i}`).not.toBeNull();
    }
    const extra = await listed();
    expect(await express(extra.publicId, builder.userId), "the 31st").toBeNull();
    const first = (await rows(open[0]!, builder.userId))[0]!;
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'withdrawn' WHERE id = ?1").bind(first.id).run();
    expect(await express(extra.publicId, builder.userId)).not.toBeNull();
    for (const l of open.slice(1)) await testEnv.DB.prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(l.requestId, new Date().toISOString()).run();
    const fresh = await listed();
    expect(await express(fresh.publicId, builder.userId), "closed requests hold no place").not.toBeNull();
  }, 60_000);

  it("over HTTP the full cap is a 409 with the cap message", async () => {
    const { builder, cookie } = await builderOf();
    for (let i = 0; i < INTEREST_PENDING_CAP; i++) expect(await express((await listed()).publicId, builder.userId)).not.toBeNull();
    const extra = await listed();
    const res = await post(interestPath(extra), cookie, { note: "", productId: "" });
    expect(res.status).toBe(409);
    expect(await res.text()).toContain(esc(en["board.interest.capReached"].replace("{n}", String(INTEREST_PENDING_CAP))));
    expect(await rows(extra, builder.userId)).toHaveLength(0);
  }, 60_000);
});

describe("POST /requests/:publicId/interest/withdraw", () => {
  it("withdraws the builder's pending interest: withdrawn, one audit row, no note in it", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    await post(interestPath(l), cookie, { note: "ZQX-NOTE-SECRET", productId: "" });
    const id = (await rows(l, builder.userId))[0]!.id;
    expect(await audits("request_interest.create", id)).toBe(1);
    const res = await post(withdrawPath(l), cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(pagePath(l));
    expect((await rows(l, builder.userId))[0]?.status).toBe("withdrawn");
    expect(await audits("request_interest.withdraw", id)).toBe(1);
    const data = (await testEnv.DB.prepare("SELECT group_concat(data) AS d FROM audit_log WHERE entity = 'request_interest' AND entity_id = ?1").bind(id).first<{ d: string }>())?.d ?? "";
    expect(data).not.toContain("ZQX-NOTE-SECRET");
    expect((await post(withdrawPath(l), cookie)).status, "twice").toBe(409);
    expect(await audits("request_interest.withdraw", id)).toBe(1);
    expect((await post(interestPath(l), cookie, { note: "", productId: "" })).status, "not again for this request").toBe(409);
  });

  it("another builder's interest is 404; an invited one is 409; nothing changes", async () => {
    const l = await listed();
    const a = await builderOf();
    const b = await builderOf();
    await post(interestPath(l), a.cookie, { note: "", productId: "" });
    expect((await post(withdrawPath(l), b.cookie)).status).toBe(404);
    expect((await rows(l, a.builder.userId))[0]?.status).toBe("pending");
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'invited' WHERE request_id = ?1 AND builder_id = ?2").bind(l.requestId, a.builder.userId).run();
    expect((await post(withdrawPath(l), a.cookie)).status).toBe(409);
    expect((await rows(l, a.builder.userId))[0]?.status).toBe("invited");
    expect((await post(withdrawPath(l), undefined)).status).toBe(303);
  });

  it("L4: allowed whatever the request's state: closed, or no longer public (back to the Hub)", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    await post(interestPath(l), cookie, { note: "", productId: "" });
    await testEnv.DB.prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(l.requestId, new Date().toISOString()).run();
    expect((await post(withdrawPath(l), cookie)).status).toBe(303);
    expect((await rows(l, builder.userId))[0]?.status).toBe("withdrawn");

    const h = await listed();
    await post(interestPath(h), cookie, { note: "", productId: "" });
    const pub = await testEnv.DB.prepare("SELECT updated_at FROM request_publications WHERE request_id = ?1").bind(h.requestId).first<{ updated_at: string }>();
    await testEnv.DB.batch([withdrawStatement(testEnv.DB, { writeId: ulid(), requestId: h.requestId, expectedUpdatedAt: pub!.updated_at, now: new Date().toISOString(), clientUserId: h.clientId })]);
    const res = await post(withdrawPath(h), cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub/invitations");
    expect((await rows(h, builder.userId))[0]?.status).toBe("withdrawn");
  });
});

describe("the call to action for an approved builder", () => {
  it("shows the form with a note, a product select of the builder's own published products and no client data", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    const other = await makeBuilder(`zqx-o2-${tag()}@vnx.si`, `zqxo2${tag()}`, "approved");
    await addLiveProduct(other, "ZQX Other Product");
    await addLiveProduct(builder, "ZQX Mine Product");
    await createProductDraft(testEnv.DB, { builderId: builder.userId, name: "ZQX Draft Product", now: new Date().toISOString() });
    const html = await (await get(pagePath(l), cookie)).text();
    const main = mainOf(html);
    expect(main).toContain('id="ib-note"');
    expect(main).toContain('id="ib-product"');
    expect(main).toContain("ZQX Mine Product");
    expect(main).not.toContain("ZQX Other Product");
    expect(main).not.toContain("ZQX Draft Product");
    expect(main).toContain(esc(en["board.interest.noProduct"]));
    expect(main).toContain(`action="${interestPath(l)}"`);
    expect(html).not.toMatch(/action="[^"]*#/);
    for (const s of Object.values(l.ids)) expect(html).not.toContain(s);
    expect(html).not.toContain(l.requestId);
    expect(html).not.toMatch(/<script[^>]*>[^<]/);
  });

  it("an invited builder gets the invitation link (from the invite id); a closed page has no form", async () => {
    const l = await listed();
    const { builder, cookie } = await builderOf();
    const [invite] = await inviteBuilders(await clientRequestOf(l), [builder]);
    const html = await (await get(pagePath(l), cookie)).text();
    expect(mainOf(html)).toContain(`href="/hub/invitations/${invite!.id}"`);
    expect(mainOf(html)).not.toContain('id="ib-note"');
    const c = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - 3600_000).toISOString() });
    const closedHtml = await (await get(pagePath(c), cookie)).text();
    expect(mainOf(closedHtml)).not.toContain('id="ib-note"');
  });
});

describe("error pattern (VNX-0807) and the page keeps its SEO", () => {
  for (const locale of ["en", "vi"] as const) {
    it(`${locale}: a 501-character note is 400 with one summary linking #ib-note, the values kept, no fragment in any action`, async () => {
      const l = await listed();
      const { builder, cookie } = await builderOf();
      const mine = await addLiveProduct(builder, `ZQX Mine ${tag()}`);
      const note = "n".repeat(INTEREST_NOTE_MAX + 1);
      const res = await post(interestPath(l, locale), cookie, { note, productId: mine.id });
      expect(res.status).toBe(400);
      const html = await res.text();
      expectErrorSummary(html, ["ib-note"], { titlePrefix: titlePrefix(locale, html) });
      expect(html).toContain('id="ib-note-error"');
      expect(html).toMatch(/aria-describedby="[^"]*ib-note-error"/);
      expect(html).toContain(note);
      expect(html).toMatch(new RegExp(`<option[^>]*value="${mine.id}"[^>]*selected`));
      expect(html).not.toMatch(/action="[^"]*#/);
      expect(html).toContain(`action="${interestPath(l, locale)}"`);
      expect(html).not.toContain("application/ld+json");
      expect(html).toContain('rel="canonical"');
      expect(await rows(l, builder.userId)).toHaveLength(0);
    });

    it(`${locale}: 409 and 429 are one summary item without a link`, async () => {
      const l = await listed();
      const { builder, cookie } = await builderOf();
      await post(interestPath(l, locale), cookie, { note: "", productId: "" });
      const dup = await post(interestPath(l, locale), cookie, { note: "again", productId: "" });
      expect(dup.status).toBe(409);
      const dupHtml = await dup.text();
      expectErrorSummary(dupHtml, [], { formLevel: 1, titlePrefix: titlePrefix(locale, dupHtml) });

      const l2 = await listed();
      await setUsed(builder.userId, INTEREST_DAILY_LIMIT);
      const limited = await post(interestPath(l2, locale), cookie, { note: "kept-note", productId: "" });
      expect(limited.status).toBe(429);
      const limitedHtml = await limited.text();
      expectErrorSummary(limitedHtml, [], { formLevel: 1, titlePrefix: titlePrefix(locale, limitedHtml) });
      expect(limitedHtml).toContain("kept-note");
    });
  }

  it("a 4xx re-render of a closed listing stays noindex without a canonical; every page costs at most 8 queries", async () => {
    const c = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - 3600_000).toISOString() });
    const { cookie } = await builderOf();
    const counted = countD1Queries(boardEnv);
    const res = await app().request(formPost(interestPath(c), { note: "", productId: "" }, { cookie }), undefined, counted.env);
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("application/ld+json");
    expect(counted.queries()).toBeLessThanOrEqual(8);

    const o = await listed();
    const b = await builderOf();
    const counted2 = countD1Queries(boardEnv);
    const res2 = await app().request(formPost(interestPath(o), { note: "z".repeat(INTEREST_NOTE_MAX + 1), productId: "" }, { cookie: b.cookie }), undefined, counted2.env);
    expect(res2.status).toBe(400);
    expect(counted2.queries()).toBeLessThanOrEqual(8);
    const shown = countD1Queries(boardEnv);
    const ok = await app().request(getReq(pagePath(o), b.cookie), undefined, shown.env);
    expect(ok.status).toBe(200);
    expect(shown.queries()).toBeLessThanOrEqual(8);
  });
});
