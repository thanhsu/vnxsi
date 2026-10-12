import { beforeEach, describe, expect, it } from "vitest";
import { findPublicListing } from "../../src/db/request-board.ts";
import { findClientRequest } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { CLOSED_VISIBLE_DAYS } from "../../src/domain/request-board.ts";
import type { Bindings } from "../../src/env.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { notifyPublicationPublished } from "../../src/notify/request-board.ts";
import { inviteBuilders, makeBuilder, makeRequest, signIn } from "../fixtures.ts";
import { countD1Queries, formPost, getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, get, listed, mainOf, tag, type Listed } from "./request-board-helpers.ts";

/** VNX-2705a: /requests/:publicId (addendum §4.1, §4.2, §7.3, §8). Identification strings (ZQX-*) must never reach a public page. */

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const path = (l: Listed, locale: Locale = "en") => localizedPath(locale, `/requests/${l.publicId}`);
const esc = (s: string) => s.replace(/'/g, "&#39;");

/** A builder with a session, in the given builders.status (set directly: the fixture only walks pending to approved or rejected). */
async function builderSession(status: string): Promise<string> {
  const email = `zqx-b-${tag()}@vnx.si`;
  const b = await makeBuilder(email, `zqxb${tag()}`, "pending");
  if (status !== "pending") await testEnv.DB.prepare("UPDATE builders SET status = ?2 WHERE user_id = ?1").bind(b.userId, status).run();
  return (await signIn(email)).cookie;
}

beforeEach(() => boardFlag(true));

describe("visibility over HTTP (addendum 7.3)", () => {
  it("open: submitted and matching with a published listing are 200 with Open and are indexable", async () => {
    for (const requestStatus of ["submitted", "matching"]) {
      const l = await listed({ requestStatus });
      const res = await get(path(l));
      expect(res.status, requestStatus).toBe(200);
      const html = await res.text();
      expect(mainOf(html)).toContain("Public title");
      expect(mainOf(html)).toContain(en["board.status.open"]);
      expect(html).not.toContain('content="noindex"');
    }
  });

  it("hidden: every publication state but published, and a request waiting for its e-mail, is 404 with its text absent", async () => {
    for (const pubStatus of ["pending_review", "rejected", "withdrawn", "unpublished"] as const) {
      const l = await listed({ pubStatus });
      const res = await get(path(l));
      expect(res.status, pubStatus).toBe(404);
      expect(await res.text(), pubStatus).not.toContain("Public title");
    }
    expect((await get(path(await listed({ requestStatus: "pending_verification", pubStatus: "pending_review" })))).status).toBe(404);
    expect((await get(path(await listed({ requestStatus: "pending_verification" })))).status).toBe(404);
    expect((await get(path(await listed({ requestStatus: "removed", closedAt: ago(DAY) })))).status).toBe(404);
  });

  it("no publication row at all is 404 (the request id is not a key), and made-up ids are 404", async () => {
    const made = await makeRequest({ tag: `nopub-${tag()}` });
    expect((await get(`/requests/${made.request.id}`)).status).toBe(404);
    expect((await get("/requests/NOT-A-REAL-ID")).status).toBe(404);
    expect((await get("/requests/01ARZ3NDEKTSV4RRFFQ69G5FAV")).status).toBe(404);
  });

  it("an ended request is Closed for 30 days (200, noindex, no outcome) and 404 from the day itself", async () => {
    for (const requestStatus of ["builder_selected", "rejected", "expired", "closed"]) {
      const l = await listed({ requestStatus, closedAt: ago(DAY) });
      const res = await get(path(l));
      expect(res.status, requestStatus).toBe(200);
      const html = await res.text();
      expect(mainOf(html), requestStatus).toContain(en["board.status.closed"]);
      expect(html, requestStatus).toContain('<meta name="robots" content="noindex"');
      expect(mainOf(html), requestStatus).not.toMatch(/builder_selected|expired|Builder selected|Expired/);
    }
    const lastMinute = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - CLOSED_VISIBLE_DAYS * DAY + 60_000).toISOString() });
    expect((await get(path(lastMinute))).status).toBe(200);
    const onTheDay = await listed({ requestStatus: "closed", closedAt: new Date(Date.now() - CLOSED_VISIBLE_DAYS * DAY).toISOString() });
    expect((await get(path(onTheDay))).status).toBe(404);
    expect((await get(path(await listed({ requestStatus: "closed", closedAt: null })))).status).toBe(404);
  });

  it("the gate: flag off, no go-live date or a future one makes every listing 404", async () => {
    const l = await listed();
    expect((await get(path(l))).status).toBe(200);
    expect((await get(path(l), undefined, { ...testEnv, REQUEST_BOARD_GO_LIVE: "" })).status).toBe(404);
    expect((await get(path(l), undefined, { ...testEnv, REQUEST_BOARD_GO_LIVE: "2999-01-01" })).status).toBe(404);
    await boardFlag(false);
    expect((await get(path(l))).status).toBe(404);
  });

  it("a client's withdrawal takes effect at once: the same URL goes 200 to 404, signed in and signed out, and the text is gone", async () => {
    const l = await listed({ publicTitle: `WITHDRAW-ME-${tag()}` });
    const { cookie } = await signIn(l.clientEmail);
    expect((await get(path(l))).status).toBe(200);
    expect((await get(path(l), cookie)).status).toBe(200);
    const res = await app().request(formPost(`/me/requests/${l.requestId}/publication/withdraw`, {}, { cookie }), undefined, boardEnv);
    expect(res.status).toBe(303);
    for (const c of [undefined, cookie]) {
      const after = await get(path(l), c);
      expect(after.status).toBe(404);
      expect(await after.text()).not.toContain("WITHDRAW-ME");
    }
  });

  it("the 404 is localized for every locale and a hidden listing is not told from a missing one", async () => {
    const hidden = await listed({ pubStatus: "withdrawn" });
    const strip = (html: string) => html.replace(/[0-9A-Z]{26}/g, "X").replace(/data-ref="[^"]*"|Reference[^<]*/g, "");
    for (const locale of LOCALES) {
      const a = await get(localizedPath(locale, `/requests/${hidden.publicId}`));
      const b = await get(localizedPath(locale, "/requests/ZZZZZZZZZZZZZZZZZZZZZZZZZZ"));
      expect([a.status, b.status]).toEqual([404, 404]);
      const html = await a.text();
      expect(html).toContain(`lang="${locale}"`);
      expect(strip(html).length).toBe(strip(await b.text()).length);
    }
  });
});

describe("no identity, no private data, no counts (addendum 7, 8)", () => {
  function expectClean(html: string, l: Listed, label: string) {
    for (const secret of [l.ids.client, l.ids.original, l.ids.adminNote, l.clientEmail, "private.example", "ZQX-ORIGINAL-DESCRIPTION", l.clientId]) expect(html, `${label}: ${secret}`).not.toContain(secret);
    expect(html, label).not.toMatch(/\b\d+\s+(invited|invitations?|builders? (are )?interested|interested builders?)/i);
    expect(html, label).not.toMatch(/builder_selected|"outcome"/);
  }

  it("the detail page in every locale, for signed-out, a stranger and a builder, with an invite on the request, never carries them", async () => {
    const l = await listed({ country: "VN", deadline: "2027-03-01", publicTitle: "Public wording differs", clientLocale: "vi" });
    const request = (await findClientRequest(testEnv.DB, l.clientId, l.requestId))!;
    await inviteBuilders(request, [await makeBuilder(`zqx-inv-${tag()}@vnx.si`, `zqxi${tag()}`, "approved")]);
    const stranger = await signIn(`zqx-stranger-${tag()}@vnx.si`);
    const builder = await builderSession("approved");
    const owner = await signIn(l.clientEmail);
    for (const locale of LOCALES) {
      for (const [who, cookie] of [["signed out", undefined], ["stranger", stranger.cookie], ["builder", builder]] as const) {
        const res = await get(path(l, locale), cookie);
        expect(res.status, `${locale} ${who}`).toBe(200);
        const html = await res.text();
        expect(html, `${locale} ${who}`).toContain("Public wording differs");
        expectClean(html, l, `${locale} ${who}`);
        expect(html, `${locale} ${who}`).not.toContain(l.requestId);
      }
      expectClean(await (await get(path(l, locale), owner.cookie)).text(), l, `${locale} owner`);
    }
  });

  it("the listing as the public query returns it has no request id or client id", async () => {
    const l = await listed();
    const found = await findPublicListing(testEnv.DB, l.publicId);
    expect(found).not.toBeNull();
    expect(Object.keys(found!).sort()).toEqual(["budgetBand", "category", "closedAt", "country", "deadline", "languages", "publicDescription", "publicId", "publicTitle", "publicationStatus", "publishedAt", "requestStatus", "updatedAt"]);
    expect(JSON.stringify(found)).not.toContain(l.requestId);
    expect(JSON.stringify(found)).not.toContain(l.clientId);
  });

  it("the public text is plain text: HTML is escaped and paragraphs are kept", async () => {
    const l = await listed({ publicDescription: "First line <img src=x onerror=alert(1)> end.\n\nSecond paragraph with <script>alert(2)</script> text." });
    const html = await (await get(path(l))).text();
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(mainOf(html)).toMatch(/<p>First line[^<]*<\/p>\s*<p>Second paragraph/);
  });
});

describe("call to action (addendum 4.2)", () => {
  async function main(l: Listed, cookie?: string, locale: Locale = "en") {
    return mainOf(await (await get(path(l, locale), cookie)).text());
  }

  it("signed out: the sign-in button, next is this page's own localized path", async () => {
    const l = await listed();
    for (const locale of LOCALES) {
      const html = await main(l, undefined, locale);
      const next = encodeURIComponent(localizedPath(locale, `/requests/${l.publicId}`));
      expect(html, locale).toContain(`href="${localizedPath(locale, "/login")}?next=${next}"`);
    }
    const html = await main(l);
    expect(html).toContain(esc(en["board.cta.signedOut"]));
    expect(html).toContain(`href="/login?next=%2Frequests%2F${l.publicId}"`);
  });

  it("signed in, not a builder: a short sentence and the /for-builders link, no sign-in button", async () => {
    const l = await listed();
    const html = await main(l, (await signIn(`zqx-plain-${tag()}@vnx.si`)).cookie);
    expect(html).toContain(en["board.cta.notBuilder"]);
    expect(html).toContain('href="/for-builders"');
    expect(html).not.toContain("/login?next=");
  });

  it("builder pending, rejected or suspended: the approval sentence and no button", async () => {
    const l = await listed();
    for (const status of ["pending", "rejected", "suspended"]) {
      const html = await main(l, await builderSession(status));
      expect(html, status).toContain(en["board.cta.pendingBuilder"]);
      expect(html, status).not.toContain("<button");
      expect(html, status).not.toContain("/login?next=");
    }
  });

  it("an approved builder gets the interest form (VNX-2706a) and neither wrong message", async () => {
    const l = await listed();
    const html = await main(l, await builderSession("approved"));
    expect(html).not.toContain(en["board.cta.pendingBuilder"]);
    expect(html).not.toContain(en["board.cta.notBuilder"]);
    expect(html).toContain('id="ib-note"');
  });

  it("the client of the request sees the link to their own request page, and nobody else gets the id", async () => {
    const l = await listed();
    const owner = await signIn(l.clientEmail);
    expect(await main(l, owner.cookie)).toContain(`href="/me/requests/${l.requestId}"`);
    expect(await main(l, owner.cookie, "vi")).toContain(`href="/vi/me/requests/${l.requestId}"`);
    const other = await signIn(`zqx-other-${tag()}@vnx.si`);
    expect(await main(l, other.cookie)).not.toContain(l.requestId);
  });

  it("closed: only the closed sentence and Post a request, for everybody", async () => {
    const l = await listed({ requestStatus: "closed", closedAt: ago(DAY) });
    const owner = await signIn(l.clientEmail);
    for (const cookie of [undefined, owner.cookie, await builderSession("approved")]) {
      const html = await main(l, cookie);
      expect(html).toContain(en["board.cta.closed"]);
      expect(html).toContain('href="/request"');
      expect(html).not.toContain("/login?next=");
      expect(html).not.toContain("/me/requests/");
      expect(html).not.toContain(en["board.cta.notBuilder"]);
    }
  });
});

describe("headers, cache, markup, cost, H2", () => {
  it("signed in: no-store; signed out: no public cache; Referrer-Policy is not no-referrer", async () => {
    const l = await listed();
    const user = await signIn(`zqx-hdr-${tag()}@vnx.si`);
    expect((await get(path(l), user.cookie)).headers.get("cache-control")).toBe("no-store");
    const anon = await get(path(l));
    expect(anon.headers.get("cache-control") ?? "").not.toMatch(/public|max-age|s-maxage/);
    expect(anon.headers.get("referrer-policy")).not.toBe("no-referrer");
  });

  it("the page body has no inline style or script of its own", async () => {
    const l = await listed();
    expect(mainOf(await (await get(path(l))).text())).not.toMatch(/\sstyle=|<script|\son[a-z]+=/i);
  });

  it("at most 8 D1 queries, signed in and signed out", async () => {
    const l = await listed();
    const user = await signIn(`zqx-cost-${tag()}@vnx.si`);
    for (const cookie of [undefined, user.cookie]) {
      const counted = countD1Queries(boardEnv);
      const res = await app().request(getReq(path(l), cookie), undefined, counted.env);
      expect(res.status).toBe(200);
      expect(counted.queries()).toBeLessThanOrEqual(8);
    }
  });

  it("H2: the viewer relation (the only read of invites) runs once for a signed-in viewer and never for a signed-out one", async () => {
    const l = await listed();
    const sql: string[] = [];
    const spy = (env: Bindings): Bindings => {
      const db = new Proxy(env.DB, {
        get(target, prop) {
          const value = Reflect.get(target, prop, target) as unknown;
          if (prop === "prepare") return (q: string) => (sql.push(q), (value as (q: string) => unknown).call(target, q));
          return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      });
      return { ...env, DB: db } as Bindings;
    };
    await app().request(getReq(path(l)), undefined, spy(boardEnv));
    expect(sql.some((q) => q.includes("request_invites"))).toBe(false);
    const user = await signIn(`zqx-h2-${tag()}@vnx.si`);
    sql.length = 0;
    await app().request(getReq(path(l), user.cookie), undefined, spy(boardEnv));
    expect(sql.filter((q) => q.includes("request_invites"))).toHaveLength(1);
  });
});

describe("the published e-mail's public link", () => {
  it("returns 200 to a signed-out reader with the gate on and shows the wording Ops published, not the original", async () => {
    clearOutbox();
    const l = await listed({ publicTitle: "Edited by Ops for the board" });
    await testEnv.DB.prepare("UPDATE users SET locale = 'vi' WHERE id = ?1").bind(l.clientId).run();
    expect(await notifyPublicationPublished(testEnv, l.requestId, { edited: true })).toBe("sent");
    const link = /https:\/\/vnx\.si(\/vi\/requests\/[0-9A-Z]{26})/.exec(outbox[0]!.text);
    expect(link).not.toBeNull();
    const res = await get(link![1]!);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Edited by Ops for the board");
    expect(html).not.toContain(l.ids.original);
    expect(html).not.toContain(l.ids.client);
  });
});
