import { ulid } from "../../src/lib/ulid.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { findPublicationByRequestId, findPublicListing, optInStatement, reOptInStatement, returnedPublication, type Publication } from "../../src/db/request-board.ts";
import { requestVisibility } from "../../src/domain/request-board.ts";
import type { Bindings } from "../../src/env.ts";
import { ensureUser, makeRequest, signIn } from "../fixtures.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { expectErrorSummary, formPost, getReq, testEnv } from "../helpers.ts";

/**
 * VNX-2703b: the "Public listing" block of /me/requests/:id (addendum 4.3, 7.1, Q2, Q5, Q6, 12.2): opt in later, withdraw
 * (always works: no flag, any request status), opt in again after a self-withdrawal. Every write is one batch with its guarded audit row.
 */

const GO_LIVE = "2026-01-01";
const boardEnv: Bindings = { ...testEnv, REQUEST_BOARD_GO_LIVE: GO_LIVE };
const tag = () => crypto.randomUUID().slice(0, 8);
const app = () => createApp();

async function boardFlag(enabled: boolean): Promise<void> {
  const admin = await ensureUser("mrb-admin@vnx.si");
  await setFlag(testEnv.DB, { key: "request_board", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}
const get = (path: string, cookie: string, bindings: Bindings = boardEnv) => app().request(getReq(path, cookie), undefined, bindings);
const post = (path: string, cookie: string, bindings: Bindings = boardEnv) => app().request(formPost(path, {}, { cookie }), undefined, bindings);
const htmlOf = async (res: Response) => res.text();
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const auditRows = (action: string, requestId: string) =>
  testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, requestId).all<{ actor_user_id: string; data: string }>().then((r) => r.results);
const rowOf = async (requestId: string): Promise<Publication> => (await findPublicationByRequestId(testEnv.DB, requestId))!;
/**
 * A race: `before` runs once, just before the route's batch, as "someone else" acting in the gap between the route's read and its write
 * (it uses the real DB, not the proxy). Everything else passes through.
 */
function racing(before: () => Promise<void>): Bindings {
  let fired = false;
  const db = new Proxy(testEnv.DB, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (prop === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          if (!fired) {
            fired = true;
            await before();
          }
          return target.batch(statements);
        };
      }
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { ...boardEnv, DB: db } as Bindings;
}
const OPT_PATH = (id: string) => `/me/requests/${id}/publication/opt-in`;
const OUT_PATH = (id: string) => `/me/requests/${id}/publication/withdraw`;

type Mine = { requestId: string; clientId: string; email: string; cookie: string };
async function mine(opts: { status?: "submitted" | "pending_verification"; opt?: boolean; method?: "magic_link" | "oauth_github" } = {}): Promise<Mine> {
  const t = tag();
  const made = await makeRequest({ tag: `mrb-${t}`, status: opts.status, title: `ZQX-ORIGINAL-TITLE ${t}`, description: `ZQX-ORIGINAL-DESCRIPTION ${t}, details only the client and Ops may read.` });
  const { cookie } = await signIn(made.client.email, { method: opts.method });
  if (opts.opt) {
    const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId: made.request.id, consentVersion: "2026-01-01", now: new Date().toISOString(), clientUserId: made.client.id })]);
    if (!returnedPublication(res)) throw new Error("opt-in failed");
  }
  return { requestId: made.request.id, clientId: made.client.id, email: made.client.email, cookie };
}

/** pending_review -> published with public wording, as Ops would have left it. */
async function publish(requestId: string, text: string) {
  const ops = await ensureUser(`mrb-ops-${tag()}@vnx.si`);
  const at = new Date(Date.now() + 5).toISOString();
  await testEnv.DB
    .prepare(
      `UPDATE request_publications SET status = 'published', public_title = ?2, public_description = ?3, published_at = ?4, reviewed_by = ?5, reviewed_at = ?4, updated_at = ?4
       WHERE request_id = ?1`,
    )
    .bind(requestId, `E2E board ${text}`, `PUBLIC-WORDING ${text}: a booking app for three small salons, with reminders by SMS.`, at, ops.id)
    .run();
}
async function endBy(requestId: string, status: "rejected" | "unpublished", note: string) {
  const ops = await ensureUser(`mrb-ops-${tag()}@vnx.si`);
  const at = new Date(Date.now() + 10).toISOString();
  await testEnv.DB.prepare("UPDATE request_publications SET status = ?2, review_note = ?3, reviewed_by = ?4, reviewed_at = ?5, ended_at = ?5, updated_at = ?5 WHERE request_id = ?1").bind(requestId, status, note, ops.id, at).run();
}
async function setRequest(requestId: string, status: string) {
  await testEnv.DB.prepare("UPDATE requests SET status = ?2, closed_at = CASE WHEN ?2 IN ('builder_selected','closed','expired','rejected') THEN ?3 ELSE closed_at END WHERE id = ?1").bind(requestId, status, new Date().toISOString()).run();
}

beforeEach(() => boardFlag(true));

describe("opt in later from /me (Q2)", () => {
  it("a request sent before the feature, with no publication row, gets the opt-in with the approved label and hint; POST creates pending_review, the request stays submitted", async () => {
    const m = await mine();
    const html = await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie));
    const main = mainOf(html);
    expect(main).toContain("Show this request on the public request board");
    expect(main).toContain("Our team reviews it first and may edit it to remove details that could identify you.");
    expect(main).toContain(`action="${OPT_PATH(m.requestId)}"`);
    expect(main).not.toContain('name="country"');
    expect(main).not.toContain(OUT_PATH(m.requestId));

    const res = await post(OPT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/me/requests/${m.requestId}`);
    const row = await rowOf(m.requestId);
    expect(row).toMatchObject({ status: "pending_review", consentVersion: GO_LIVE, publicTitle: null, publicDescription: null, publishedAt: null });
    const request = await testEnv.DB.prepare("SELECT status FROM requests WHERE id = ?1").bind(m.requestId).first<{ status: string }>();
    expect(request?.status).toBe("submitted");
    const audit = await auditRows("request_publication.opt_in", m.requestId);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actor_user_id).toBe(m.clientId);
    expect(JSON.parse(audit[0]!.data)).toEqual({ consentVersion: GO_LIVE });
    // Now it says so and offers the withdrawal.
    const after = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(after).toContain("Waiting for review");
    expect(after).toContain(OUT_PATH(m.requestId));
    expect(after).not.toContain(OPT_PATH(m.requestId));
  });

  it("a matching request can opt in; pending_verification and ended requests get no button and POST is 409 with nothing written", async () => {
    const matching = await mine();
    await setRequest(matching.requestId, "matching");
    expect((await post(OPT_PATH(matching.requestId), matching.cookie)).status).toBe(303);

    for (const status of ["closed", "builder_selected", "expired"]) {
      const m = await mine();
      await setRequest(m.requestId, status);
      expect(mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie))), status).not.toContain(OPT_PATH(m.requestId));
      expect((await post(OPT_PATH(m.requestId), m.cookie)).status, status).toBe(409);
      expect(await findPublicationByRequestId(testEnv.DB, m.requestId), status).toBeNull();
      expect(await auditRows("request_publication.opt_in", m.requestId), status).toHaveLength(0);
    }
    const pending = await mine({ status: "pending_verification" });
    expect(mainOf(await htmlOf(await get(`/me/requests/${pending.requestId}`, pending.cookie)))).not.toContain(OPT_PATH(pending.requestId));
    expect((await post(OPT_PATH(pending.requestId), pending.cookie)).status).toBe(409);
    expect(await findPublicationByRequestId(testEnv.DB, pending.requestId)).toBeNull();
    expect(await auditRows("request_publication.opt_in", pending.requestId)).toHaveLength(0);
  });

  it("someone else's request is 404 and nothing is written; a removed one is 404", async () => {
    const owner = await mine();
    const other = await mine();
    expect((await post(OPT_PATH(owner.requestId), other.cookie)).status).toBe(404);
    expect((await post(OUT_PATH(owner.requestId), other.cookie)).status).toBe(404);
    expect(await findPublicationByRequestId(testEnv.DB, owner.requestId)).toBeNull();
    await setRequest(owner.requestId, "removed");
    expect((await post(OPT_PATH(owner.requestId), owner.cookie)).status).toBe(404);
    expect(await findPublicationByRequestId(testEnv.DB, owner.requestId)).toBeNull();
  });

  it("gate off: no button, no block for a request without a publication, POST is 404 and writes nothing", async () => {
    await boardFlag(false);
    const m = await mine();
    const html = await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie));
    expect(mainOf(html)).not.toContain(OPT_PATH(m.requestId));
    expect(mainOf(html)).not.toContain("Public request board");
    expect((await post(OPT_PATH(m.requestId), m.cookie)).status).toBe(404);
    expect(await findPublicationByRequestId(testEnv.DB, m.requestId)).toBeNull();
    // The date half of the gate: flag on, date empty.
    await boardFlag(true);
    expect((await post(OPT_PATH(m.requestId), m.cookie, { ...testEnv, REQUEST_BOARD_GO_LIVE: "" })).status).toBe(404);
    expect(await findPublicationByRequestId(testEnv.DB, m.requestId)).toBeNull();
  });

  it("a second opt-in is refused at the pre-check (the publication is already there): 409, one row, no audit row", async () => {
    const m = await mine({ opt: true });
    const before = await rowOf(m.requestId);
    const res = await post(OPT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(409);
    expect(await rowOf(m.requestId)).toEqual(before);
    expect(await auditRows("request_publication.opt_in", m.requestId)).toHaveLength(0);
  });

  it("an OAuth session of the owner can opt in and withdraw (not a staff action, ADR-012)", async () => {
    const m = await mine({ method: "oauth_github" });
    expect((await post(OPT_PATH(m.requestId), m.cookie)).status).toBe(303);
    expect((await rowOf(m.requestId)).status).toBe("pending_review");
    expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(303);
    expect((await rowOf(m.requestId)).status).toBe("withdrawn");
  });
});

describe("withdraw (Q5): always works, takes effect at once", () => {
  it("from pending_review and from published; the public listing is hidden at once; one audit row each", async () => {
    for (const state of ["pending_review", "published"] as const) {
      const m = await mine({ opt: true });
      if (state === "published") await publish(m.requestId, m.requestId.slice(-6));
      const before = await rowOf(m.requestId);
      const visibleNow = async () => {
        const listing = await findPublicListing(testEnv.DB, before.publicId);
        return listing ? requestVisibility(listing.requestStatus, listing.publicationStatus, listing.closedAt, new Date()) : "hidden";
      };
      expect(await visibleNow(), state).toBe(state === "published" ? "open" : "hidden");
      const res = await post(OUT_PATH(m.requestId), m.cookie);
      expect(res.status, state).toBe(303);
      expect(res.headers.get("location")).toBe(`/me/requests/${m.requestId}`);
      const row = await rowOf(m.requestId);
      expect(row.status).toBe("withdrawn");
      expect(row.endedAt).not.toBeNull();
      expect(row.publicId).toBe(before.publicId);
      // The one visibility function says hidden in the same moment (no cache in between), and the public page is 404.
      expect(await visibleNow(), state).toBe("hidden");
      expect((await get(`/requests/${before.publicId}`, m.cookie)).status).toBe(404);
      const audit = await auditRows("request_publication.withdraw", m.requestId);
      expect(audit).toHaveLength(1);
      expect(JSON.parse(audit[0]!.data)).toEqual({ from: state });
    }
  });

  it("works on a request that is no longer open and with the gate off; the block still shows the status and the button when pending or published", async () => {
    const m = await mine({ opt: true });
    await publish(m.requestId, "selected");
    await setRequest(m.requestId, "builder_selected");
    await boardFlag(false);
    // Gate off: the existing state is shown read-only, with the withdrawal and without an opt-in.
    const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(main).toContain(OUT_PATH(m.requestId));
    expect(main).not.toContain(OPT_PATH(m.requestId));
    expect(main).not.toContain(`href="/requests/`);
    expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(303);
    expect((await rowOf(m.requestId)).status).toBe("withdrawn");
  });

  it("twice: the second is 409, nothing more is written", async () => {
    const m = await mine({ opt: true });
    expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(303);
    const before = await rowOf(m.requestId);
    const res = await post(OUT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(409);
    expect(await rowOf(m.requestId)).toEqual(before);
    expect(await auditRows("request_publication.withdraw", m.requestId)).toHaveLength(1);
  });

  it("no publication at all: 409, no audit row", async () => {
    const m = await mine();
    expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(409);
    expect(await auditRows("request_publication.withdraw", m.requestId)).toHaveLength(0);
  });

  it("rejected and unpublished cannot be withdrawn (already ended): 409", async () => {
    for (const end of ["rejected", "unpublished"] as const) {
      const m = await mine({ opt: true });
      if (end === "unpublished") await publish(m.requestId, "x");
      await endBy(m.requestId, end, "Contains a phone number.");
      expect((await post(OUT_PATH(m.requestId), m.cookie)).status, end).toBe(409);
      expect((await rowOf(m.requestId)).status).toBe(end);
      expect(await auditRows("request_publication.withdraw", m.requestId), end).toHaveLength(0);
    }
  });
});

describe("opt in again after a self-withdrawal (Q6, OP-1: no cap)", () => {
  it("withdrawn -> pending_review on an open request; published_at, public_id and the last wording stay; a new consent version and a cleared ended_at", async () => {
    const m = await mine({ opt: true });
    await publish(m.requestId, "again");
    const first = await rowOf(m.requestId);
    await post(OUT_PATH(m.requestId), m.cookie);
    expect(mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)))).toContain(OPT_PATH(m.requestId));
    const res = await post(OPT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(303);
    const row = await rowOf(m.requestId);
    expect(row).toMatchObject({ status: "pending_review", publicId: first.publicId, publishedAt: first.publishedAt, publicTitle: first.publicTitle, consentVersion: GO_LIVE, endedAt: null });
    const audit = await auditRows("request_publication.re_opt_in", m.requestId);
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0]!.data)).toEqual({ consentVersion: GO_LIVE });
    // No cap: withdraw and opt in a third and fourth time.
    for (let i = 0; i < 2; i++) {
      expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(303);
      expect((await post(OPT_PATH(m.requestId), m.cookie)).status).toBe(303);
    }
    expect((await rowOf(m.requestId)).status).toBe("pending_review");
  });

  it("a withdrawn publication of a request that has since ended gets no button, and POST is 409", async () => {
    const m = await mine({ opt: true });
    await post(OUT_PATH(m.requestId), m.cookie);
    await setRequest(m.requestId, "closed");
    const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(main).not.toContain(OPT_PATH(m.requestId));
    expect(main).toContain("You removed this request from the public request board");
    expect((await post(OPT_PATH(m.requestId), m.cookie)).status).toBe(409);
    expect((await rowOf(m.requestId)).status).toBe("withdrawn");
  });

  it("rejected and unpublished: the reason is shown, no opt-in button, POST is 409 and writes nothing", async () => {
    for (const end of ["rejected", "unpublished"] as const) {
      const m = await mine({ opt: true });
      if (end === "unpublished") await publish(m.requestId, "x");
      const reason = `REASON-${end}-${tag()}`;
      await endBy(m.requestId, end, reason);
      const before = await rowOf(m.requestId);
      const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
      expect(main, end).toContain(reason);
      expect(main, end).not.toContain(OPT_PATH(m.requestId));
      expect(main, end).not.toContain(OUT_PATH(m.requestId));
      expect((await post(OPT_PATH(m.requestId), m.cookie)).status, end).toBe(409);
      expect(await rowOf(m.requestId)).toEqual(before);
      expect(await auditRows("request_publication.re_opt_in", m.requestId)).toHaveLength(0);
    }
  });
});

describe("what the block shows", () => {
  it("published: the public wording as it stands, not the original, with the link to the public page", async () => {
    const m = await mine({ opt: true });
    await publish(m.requestId, "wording");
    const row = await rowOf(m.requestId);
    const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(main).toContain(row.publicTitle!);
    expect(main).toContain("PUBLIC-WORDING wording");
    expect(main).toContain(`href="/requests/${row.publicId}"`);
    expect(main).toContain(OUT_PATH(m.requestId));
    // The original is on the page (it is the client's own request) but outside the listing block.
    const block = /<section[^>]*id="me-board"[^>]*>([\s\S]*?)<\/section>/.exec(main)?.[1] ?? "";
    expect(block).toContain("PUBLIC-WORDING wording");
    expect(block).not.toContain("ZQX-ORIGINAL");
    // The locale prefix is kept in the link and the actions.
    const vi = mainOf(await htmlOf(await get(`/vi/me/requests/${m.requestId}`, m.cookie)));
    expect(vi).toContain(`href="/vi/requests/${row.publicId}"`);
    expect(vi).toContain(`action="/vi${OUT_PATH(m.requestId)}"`);
  });

  it("pending_review: the review line and no link; no public text", async () => {
    const m = await mine({ opt: true });
    const row = await rowOf(m.requestId);
    const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(main).toContain("Waiting for review");
    expect(main).not.toContain(row.publicId);
    expect(main).not.toContain(`href="/requests/`);
  });

  it("a withdrawn listing that kept its wording shows it nowhere", async () => {
    const m = await mine({ opt: true });
    await publish(m.requestId, "kept");
    await post(OUT_PATH(m.requestId), m.cookie);
    const main = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(main).not.toContain("PUBLIC-WORDING kept");
    expect(main).not.toContain(`href="/requests/`);
  });

  it("client A's page never carries client B's public id, wording or review note", async () => {
    const a = await mine({ opt: true });
    const b = await mine({ opt: true });
    await publish(b.requestId, "B-SECRET");
    const rowB = await rowOf(b.requestId);
    await testEnv.DB.prepare("UPDATE request_publications SET review_note = 'B-NOTE' WHERE request_id = ?1").bind(b.requestId).run();
    const html = await htmlOf(await get(`/me/requests/${a.requestId}`, a.cookie));
    for (const secret of [rowB.publicId, "B-SECRET", "B-NOTE", b.requestId, b.email]) expect(html).not.toContain(secret);
    expect((await get(`/me/requests/${b.requestId}`, a.cookie)).status).toBe(404);
  });

  it("has no inline script or style, and the block exists in every locale with no raw key", async () => {
    const m = await mine({ opt: true });
    for (const prefix of ["", "/vi", "/zh-hans", "/zh-hant"]) {
      const html = await htmlOf(await get(`${prefix}/me/requests/${m.requestId}`, m.cookie));
      const block = /<section[^>]*id="me-board"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
      expect(block, prefix).not.toBe("");
      expect(block, prefix).not.toMatch(/<script|style=/);
      expect(block, prefix).not.toMatch(/\bme\.board\./);
    }
  });
});

describe("error pattern (VNX-0807) on a refused POST", () => {
  it("409 renders the current state with one summary item that links to no field, the error title prefix, no role=alert and no fragment in any action", async () => {
    const m = await mine({ opt: true });
    await post(OUT_PATH(m.requestId), m.cookie);
    const res = await post(OUT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await htmlOf(res);
    const body = expectErrorSummary(html, [], { formLevel: 1 });
    expect(body).toContain("That did not go through: this request or its status on the public request board changed in the meantime. The page below shows the current status.");
    // It is the current state: withdrawn, with the opt-in again offered, not the withdrawal that just failed.
    const main = mainOf(html);
    expect(main).toContain(OPT_PATH(m.requestId));
    expect(main).not.toContain(OUT_PATH(m.requestId));
    for (const action of html.matchAll(/<form[^>]*\saction="([^"]*)"/g)) expect(action[1], action[1]).not.toContain("#");
  });

  it("opt-in 409 on an ended request; the 200 GET has no error summary and no error title", async () => {
    const m = await mine();
    await setRequest(m.requestId, "closed");
    const res = await post(OPT_PATH(m.requestId), m.cookie);
    expect(res.status).toBe(409);
    const html = await htmlOf(res);
    expectErrorSummary(html, [], { formLevel: 1 });
    // The new state: a closed request with no publication has no block at all, so no button of any kind.
    expect(mainOf(html)).not.toContain("me-board");
    expect(mainOf(html)).not.toContain("/publication/");
    const ok = await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie));
    expect(ok).not.toContain("form-errors");
    expect(ok).not.toMatch(/<title>Error:/);
  });
});

describe("a lost race writes nothing: 0 rows from the batch are detected (409, no audit row, the new state shown)", () => {
  it("opt-in where the publication was inserted first", async () => {
    const m = await mine();
    const bindings = racing(async () => {
      const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId: m.requestId, consentVersion: "2026-01-01", now: new Date(Date.now() + 1000).toISOString(), clientUserId: m.clientId })]);
      if (!returnedPublication(res)) throw new Error("race setup failed");
    });
    const res = await post(OPT_PATH(m.requestId), m.cookie, bindings);
    expect(res.status).toBe(409);
    expect(await auditRows("request_publication.opt_in", m.requestId)).toHaveLength(0);
    const html = await htmlOf(res);
    expectErrorSummary(html, [], { formLevel: 1 });
    // The state as it now is: waiting for review, with the withdrawal and without an opt-in.
    expect(mainOf(html)).toContain("Waiting for review");
    expect(mainOf(html)).toContain(OUT_PATH(m.requestId));
    expect(mainOf(html)).not.toContain(OPT_PATH(m.requestId));
  });

  it("opt-in again where the compare-and-set loses (the publication changed after it was read)", async () => {
    const m = await mine({ opt: true });
    expect((await post(OUT_PATH(m.requestId), m.cookie)).status).toBe(303);
    const moved = new Date(Date.now() + 60_000).toISOString();
    const bindings = racing(async () => {
      await testEnv.DB.prepare("UPDATE request_publications SET updated_at = ?2 WHERE request_id = ?1").bind(m.requestId, moved).run();
    });
    const res = await post(OPT_PATH(m.requestId), m.cookie, bindings);
    expect(res.status).toBe(409);
    expect(await rowOf(m.requestId)).toMatchObject({ status: "withdrawn", updatedAt: moved });
    expect(await auditRows("request_publication.re_opt_in", m.requestId)).toHaveLength(0);
    expectErrorSummary(await htmlOf(res), [], { formLevel: 1 });
  });

  it("withdraw where Ops rejected or unpublished first: the reason is shown, no remove button, no opt-in button", async () => {
    for (const end of ["rejected", "unpublished"] as const) {
      const m = await mine({ opt: true });
      if (end === "unpublished") await publish(m.requestId, "race");
      const reason = `RACE-REASON-${end}-${tag()}`;
      const bindings = racing(() => endBy(m.requestId, end, reason));
      const res = await post(OUT_PATH(m.requestId), m.cookie, bindings);
      expect(res.status, end).toBe(409);
      expect((await rowOf(m.requestId)).status).toBe(end);
      expect(await auditRows("request_publication.withdraw", m.requestId), end).toHaveLength(0);
      const html = await htmlOf(res);
      expectErrorSummary(html, [], { formLevel: 1 });
      expect(mainOf(html), end).toContain(reason);
      expect(mainOf(html), end).not.toContain(OUT_PATH(m.requestId));
      expect(mainOf(html), end).not.toContain(OPT_PATH(m.requestId));
    }
  });

  it("the request was removed in the gap: 404, as everywhere else on /me, and nothing is written", async () => {
    const m = await mine();
    const bindings = racing(() => setRequest(m.requestId, "removed"));
    const res = await post(OPT_PATH(m.requestId), m.cookie, bindings);
    expect(res.status).toBe(404);
    expect(await findPublicationByRequestId(testEnv.DB, m.requestId)).toBeNull();
    expect(await auditRows("request_publication.opt_in", m.requestId)).toHaveLength(0);
  });
});

describe("pinned states (review L-3)", () => {
  it("pending_verification: no opt-in; an existing publication shows pending with the withdrawal, and it works", async () => {
    const none = await mine({ status: "pending_verification" });
    const noneMain = mainOf(await htmlOf(await get(`/me/requests/${none.requestId}`, none.cookie)));
    expect(noneMain).not.toContain("me-board");
    expect(noneMain).not.toContain("/publication/");
    const has = await mine({ status: "pending_verification", opt: true });
    const main = mainOf(await htmlOf(await get(`/me/requests/${has.requestId}`, has.cookie)));
    expect(main).toContain("Waiting for review");
    expect(main).toContain(OUT_PATH(has.requestId));
    expect(main).not.toContain(OPT_PATH(has.requestId));
    expect((await post(OUT_PATH(has.requestId), has.cookie)).status).toBe(303);
    expect((await rowOf(has.requestId)).status).toBe("withdrawn");
  });

  it("gate off: withdrawn, rejected and unpublished show their status read-only, with no button", async () => {
    const w = await mine({ opt: true });
    await post(OUT_PATH(w.requestId), w.cookie);
    const r = await mine({ opt: true });
    await endBy(r.requestId, "rejected", `GATE-OFF-REASON-${tag()}`);
    await boardFlag(false);
    const wMain = mainOf(await htmlOf(await get(`/me/requests/${w.requestId}`, w.cookie)));
    expect(wMain).toContain("You removed this request from the public request board");
    expect(wMain).not.toContain("/publication/");
    const rMain = mainOf(await htmlOf(await get(`/me/requests/${r.requestId}`, r.cookie)));
    expect(rMain).toContain("GATE-OFF-REASON-");
    expect(rMain).not.toContain("/publication/");
  });
});

describe("the opt-in button says what is agreed to (review M-2) and the approved copy is byte-exact (review L-1)", () => {
  it("the button is the approved label, described by the hint; no separate bold copy of it", async () => {
    const m = await mine();
    const html = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    const form = /<form[^>]*opt-in[^>]*>([\s\S]*?)<\/form>/.exec(html)?.[1] ?? "";
    const button = /<button([^>]*)>([^<]*)<\/button>/.exec(form);
    expect(button?.[2]?.trim()).toBe(en["request.board.optIn.label"]);
    const describedBy = /aria-describedby="([^"]+)"/.exec(button?.[1] ?? "")?.[1] ?? "";
    expect(describedBy).not.toBe("");
    expect(form).toContain(`id="${describedBy}"`);
    expect(form.replace(/&#39;/g, "'")).toContain(en["request.board.optIn.hint"]);
    expect(form).not.toContain("<strong>");
    expect("me.board.optIn" in en).toBe(false);
  });

  it("opt in again: the button is the approved \"again\" sentence", async () => {
    const m = await mine({ opt: true });
    await post(OUT_PATH(m.requestId), m.cookie);
    const html = mainOf(await htmlOf(await get(`/me/requests/${m.requestId}`, m.cookie)));
    expect(/<button[^>]*>([^<]*)<\/button>/.exec(/<form[^>]*opt-in[^>]*>([\s\S]*?)<\/form>/.exec(html)?.[1] ?? "")?.[1]?.trim()).toBe("Show this request on the public request board again");
  });

  it("EN and VI are exactly the Owner-approved sentences", () => {
    const EN = {
      title: "Public request board",
      reOptIn: "Show this request on the public request board again",
      pending: "Waiting for review. It is shown publicly only after our team approves it.",
      live: "Published. This is the public version, which our team may have edited:",
      viewPublic: "View the public page",
      remove: "Remove from board",
      removeHint: "This takes effect straight away. Your request itself is not affected.",
      removed: "Not shown. You removed this request from the public request board.",
      rejectedReason: "Our team decided not to show this request on the public request board. Reason:",
      unpublishedReason: "Our team removed this request from the public request board. Reason:",
      finalNote: "It cannot be shown on the board again. Your request itself is not affected.",
      "error.conflict": "That did not go through: this request or its status on the public request board changed in the meantime. The page below shows the current status.",
    };
    const VI = {
      title: "Bảng nhu cầu công khai",
      reOptIn: "Hiện lại nhu cầu này trên bảng nhu cầu công khai",
      pending: "Đang chờ xem xét. Nhu cầu chỉ được hiện công khai sau khi đội ngũ của chúng tôi duyệt.",
      live: "Đã công khai. Đây là bản công khai, có thể đã được đội ngũ của chúng tôi chỉnh sửa:",
      viewPublic: "Xem trang công khai",
      remove: "Gỡ khỏi bảng",
      removeHint: "Việc gỡ có hiệu lực ngay. Bản thân nhu cầu của bạn không bị ảnh hưởng.",
      removed: "Không hiển thị. Bạn đã gỡ nhu cầu này khỏi bảng nhu cầu công khai.",
      rejectedReason: "Đội ngũ của chúng tôi quyết định không hiện nhu cầu này trên bảng nhu cầu công khai. Lý do:",
      unpublishedReason: "Đội ngũ của chúng tôi đã gỡ nhu cầu này khỏi bảng nhu cầu công khai. Lý do:",
      finalNote: "Không thể hiện lại nhu cầu này trên bảng. Bản thân nhu cầu của bạn không bị ảnh hưởng.",
      "error.conflict": "Thao tác không thực hiện được vì nhu cầu này hoặc trạng thái của nó trên bảng nhu cầu công khai vừa thay đổi. Trang dưới đây hiện trạng thái mới nhất.",
    };
    for (const [key, text] of Object.entries(EN)) expect((en as Record<string, string>)[`me.board.${key}`], key).toBe(text);
    for (const [key, text] of Object.entries(VI)) expect((vi as Record<string, string>)[`me.board.${key}`], key).toBe(text);
  });
});
