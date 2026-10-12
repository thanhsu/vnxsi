import { beforeEach, describe, expect, it } from "vitest";
import { publishStatement, reOptInStatement, returnedPublication, withdrawStatement, findPublicationByRequestId } from "../../src/db/request-board.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { countryName } from "../../src/views/country.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { countD1Queries, getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, get, listed, mainOf, tag } from "./request-board-helpers.ts";

/** VNX-2705a: /requests (addendum §4.1, §7.3). The database is shared by the tests of this file, so each test looks for its own listings by public id and wording. */

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const html = async (path: string, cookie?: string) => (await get(path, cookie)).text();

beforeEach(() => boardFlag(true));

describe("which listings are on the board", () => {
  it("only open ones; every ended or hidden state is absent (checked by the test's own public ids)", async () => {
    const open = await listed({ publicTitle: `LIST-OPEN-${tag()}` });
    const matching = await listed({ requestStatus: "matching", publicTitle: `LIST-MATCHING-${tag()}` });
    const hidden = [
      await listed({ requestStatus: "closed", closedAt: ago(DAY), publicTitle: `LIST-CLOSED-${tag()}` }),
      await listed({ requestStatus: "builder_selected", closedAt: ago(DAY), publicTitle: `LIST-SELECTED-${tag()}` }),
      await listed({ requestStatus: "expired", closedAt: ago(DAY), publicTitle: `LIST-EXPIRED-${tag()}` }),
      await listed({ pubStatus: "pending_review", publicTitle: `LIST-PENDING-${tag()}` }),
      await listed({ pubStatus: "rejected", publicTitle: `LIST-REJECTED-${tag()}` }),
      await listed({ pubStatus: "withdrawn", publicTitle: `LIST-WITHDRAWN-${tag()}` }),
      await listed({ pubStatus: "unpublished", publicTitle: `LIST-UNPUBLISHED-${tag()}` }),
      await listed({ requestStatus: "pending_verification", publicTitle: `LIST-UNVERIFIED-${tag()}` }),
      await listed({ requestStatus: "removed", closedAt: ago(DAY), publicTitle: `LIST-REMOVED-${tag()}` }),
    ];
    const body = await html("/requests");
    expect(body).toContain(open.publicId);
    expect(body).toContain(matching.publicId);
    for (const h of hidden) expect(body, h.publicId).not.toContain(h.publicId);
    expect(body).not.toMatch(/LIST-(CLOSED|SELECTED|EXPIRED|PENDING|REJECTED|WITHDRAWN|UNPUBLISHED|UNVERIFIED|REMOVED)-/);
  });

  it("the order is published_at descending, then public_id descending for the same instant; nothing else moves a listing", async () => {
    const t = new Date(Date.now() + 10 * DAY).toISOString(); // later than every other row of this file
    const newest = await listed({ publishedAt: new Date(Date.now() + 11 * DAY).toISOString(), publicIdValue: "0".repeat(25) + "1" });
    const sameLow = await listed({ publishedAt: t, publicIdValue: "0".repeat(25) + "2" });
    const sameHigh = await listed({ publishedAt: t, publicIdValue: "0".repeat(25) + "3" });
    const older = await listed({ publishedAt: new Date(Date.now() + 9 * DAY).toISOString(), publicIdValue: "Z".repeat(26) });
    const body = await html("/requests");
    const at = (l: { publicId: string }) => body.indexOf(`/requests/${l.publicId}"`);
    for (const l of [newest, sameLow, sameHigh, older]) expect(at(l), l.publicId).toBeGreaterThan(-1);
    expect(at(newest)).toBeLessThan(at(sameHigh));
    expect(at(sameHigh)).toBeLessThan(at(sameLow));
    expect(at(sameLow)).toBeLessThan(at(older));
  });

  it("withdrawing and opting in again, then publishing, keeps published_at: the listing keeps its place", async () => {
    const l = await listed();
    const ops = await ensureUser(`zqx-ops-${tag()}@vnx.si`);
    const before = (await findPublicationByRequestId(testEnv.DB, l.requestId))!;
    const client = l.clientId;
    const run = async (stmt: D1PreparedStatement) => returnedPublication((await testEnv.DB.batch([stmt]))[0]);
    const withdrawn = (await run(withdrawStatement(testEnv.DB, { requestId: l.requestId, expectedUpdatedAt: before.updatedAt, now: new Date(Date.now() + 1000).toISOString(), clientUserId: client, writeId: ulid() })))!;
    const again = (await run(reOptInStatement(testEnv.DB, { requestId: l.requestId, expectedUpdatedAt: withdrawn.updatedAt, consentVersion: "2026-01-01", now: new Date(Date.now() + 2000).toISOString(), clientUserId: client, writeId: ulid() })))!;
    const published = (await run(publishStatement(testEnv.DB, { requestId: l.requestId, expectedUpdatedAt: again.updatedAt, title: "Again", description: "Public wording again, long enough to pass the length rule.", reviewedBy: ops.id, now: new Date(Date.now() + 3000).toISOString(), writeId: ulid() })))!;
    expect(published.publishedAt).toBe(before.publishedAt);
  });
});

describe("filters (a GET form) and paging", () => {
  it("category, budget band and language narrow the list; unknown values and a sort parameter are ignored and the page is 200", async () => {
    const t = tag();
    const crm = await listed({ category: "crm", budget: ">10k", languages: ["zh"], publicTitle: `F-CRM-${t}` });
    const hr = await listed({ category: "hr", budget: "<500", languages: ["en"], publicTitle: `F-HR-${t}` });
    const byCategory = await html("/requests?category=crm");
    expect(byCategory).toContain(crm.publicId);
    expect(byCategory).not.toContain(hr.publicId);
    const byBudget = await html("/requests?budget=%3C500");
    expect(byBudget).toContain(hr.publicId);
    expect(byBudget).not.toContain(crm.publicId);
    const byLang = await html("/requests?lang=zh");
    expect(byLang).toContain(crm.publicId);
    expect(byLang).not.toContain(hr.publicId);
    const both = await html("/requests?category=hr&lang=zh");
    expect(both).not.toContain(hr.publicId);
    expect(both).not.toContain(crm.publicId);
    for (const q of ["category=%3Cscript%3E", "sort=paid", "budget=free&lang=xx&q=hello&page=abc"]) {
      const res = await get(`/requests?${q}`);
      expect(res.status, q).toBe(200);
      const body = await res.text();
      expect(body, q).toContain(crm.publicId);
      expect(body, q).not.toContain("<script>");
    }
  });

  it("the filters are a form with method get and the localized action, three selects and no sort or search field", async () => {
    for (const locale of LOCALES) {
      const main = mainOf(await html(localizedPath(locale, "/requests")));
      expect(main, locale).toMatch(new RegExp(`<form[^>]*method="get"[^>]*action="${localizedPath(locale, "/requests")}"`));
      expect([...main.matchAll(/<select /g)]).toHaveLength(3);
      expect(main, locale).not.toMatch(/name="(sort|q|country)"|type="search"/);
    }
  });

  it("a page past the end is 404; the empty state offers Post a request and Browse products and shows no sample card", async () => {
    await listed();
    expect((await get("/requests?page=9999")).status).toBe(404);
    const empty = await get("/requests?category=ai_agents&budget=unsure&lang=zh");
    expect(empty.status).toBe(200);
    const main = mainOf(await empty.text());
    expect(main).toContain(en["board.empty.title"]);
    expect(main).toContain('href="/request"');
    expect(main).toContain('href="/products"');
    expect(main).not.toContain('class="cards"');
  });
});

describe("what a card shows", () => {
  it("title, excerpt, category, budget, country by locale, languages, deadline, posted date; the public wording only", async () => {
    const long = `${"Wording ".repeat(60)}END-OF-LONG-TEXT`;
    const l = await listed({ publicTitle: `CARD-${tag()}`, publicDescription: long, country: "VN", deadline: "2027-05-06", category: "crm", budget: "500-2k", languages: ["en", "vi"] });
    const nodeFor = (body: string) => body.slice(body.indexOf(`/requests/${l.publicId}"`) - 40, body.indexOf(`/requests/${l.publicId}"`) + 900);
    const card = nodeFor(await html("/requests"));
    expect(card).toContain("Wording Wording");
    expect(card).toContain("…");
    expect(card).not.toContain("END-OF-LONG-TEXT");
    expect(card).toContain(countryName("en", "VN"));
    expect(card).toContain("2027-05-06");
    expect(card).toContain(en["board.card.posted"]);
    expect(nodeFor(await html("/vi/requests"))).toContain("Việt Nam");
    const none = await listed({ publicTitle: `NODL-${tag()}` });
    const noDeadline = (await html("/requests")).slice((await html("/requests")).indexOf(`/requests/${none.publicId}"`));
    expect(noDeadline.slice(0, 1200)).toContain(en["board.deadline.none"]);
  });

  it("no identity, private wording, status words or counts in any card, in every locale, signed in and out", async () => {
    const l = await listed({ country: "VN", clientLocale: "vi" });
    const user = await signIn(l.clientEmail);
    for (const locale of LOCALES) {
      for (const cookie of [undefined, user.cookie]) {
        const body = await html(localizedPath(locale, "/requests"), cookie);
        expect(body).toContain(l.publicId);
        for (const secret of [l.ids.client, l.ids.original, l.ids.adminNote, l.clientEmail, "private.example", "ZQX-ORIGINAL-DESCRIPTION", l.clientId, l.requestId]) expect(body, `${locale} ${secret}`).not.toContain(secret);
        expect(body).not.toMatch(/builder_selected|\b\d+\s+(invited|interested)/i);
      }
    }
  });

  it("plain text: a description with markup is escaped in the excerpt", async () => {
    const l = await listed({ publicDescription: "Needs <img src=x onerror=alert(1)> and a <script>alert(2)</script> badge, long enough for the length rule." });
    const body = await html("/requests");
    expect(body).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(body).not.toContain("<img src=x");
    expect(body).not.toContain("<script>alert(2)");
    expect(body).toContain(l.publicId);
  });
});

describe("gate, headers, cost, ranking words", () => {
  it("flag off, no date or a future date: /requests is 404 in every locale", async () => {
    for (const locale of LOCALES) expect((await get(localizedPath(locale, "/requests"))).status).toBe(200);
    expect((await get("/requests", undefined, { ...testEnv, REQUEST_BOARD_GO_LIVE: "" })).status).toBe(404);
    expect((await get("/requests", undefined, { ...testEnv, REQUEST_BOARD_GO_LIVE: "2999-01-01" })).status).toBe(404);
    await boardFlag(false);
    for (const locale of LOCALES) expect((await get(localizedPath(locale, "/requests"))).status, locale).toBe(404);
  });

  it("signed in: no-store; signed out: no public cache; Referrer-Policy is not no-referrer; indexing itself is covered by test/seo/request-board.test.ts", async () => {
    const user = await signIn(`zqx-lh-${tag()}@vnx.si`);
    expect((await get("/requests", user.cookie)).headers.get("cache-control")).toBe("no-store");
    const anon = await get("/requests");
    expect(anon.headers.get("cache-control") ?? "").not.toMatch(/public|max-age|s-maxage/);
    expect(anon.headers.get("referrer-policy")).not.toBe("no-referrer");
  });

  it("at most 8 D1 queries, signed in and signed out", async () => {
    await listed();
    const user = await signIn(`zqx-lc-${tag()}@vnx.si`);
    for (const cookie of [undefined, user.cookie]) {
      const counted = countD1Queries(boardEnv);
      const res = await app().request(getReq("/requests?category=booking", cookie), undefined, counted.env);
      expect(res.status).toBe(200);
      expect(counted.queries()).toBeLessThanOrEqual(8);
    }
  });

  it("no ranking or promotion wording on the page", async () => {
    await listed();
    for (const locale of LOCALES) expect(await html(localizedPath(locale, "/requests"))).not.toMatch(/featured|boost|urgent|sponsored|promoted/i);
  });
});

describe("sources of the public board", () => {
  const sources = import.meta.glob("../../src/views/requests/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const route = import.meta.glob("../../src/routes/request-board.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("views/requests/* and the route have no raw HTML insertion, no inline style, no promotion wording and no money or db import", () => {
    const all = { ...sources, ...route };
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(4);
    for (const [file, src] of Object.entries(all)) {
      expect(src, file).not.toMatch(/dangerouslySetInnerHTML/);
      expect(src, file).not.toMatch(/\sstyle=/);
      expect(src, file).not.toMatch(/featured|boost|urgent|sponsored|promoted/i);
    }
    for (const [file, src] of Object.entries(sources)) expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\//);
  });
});
