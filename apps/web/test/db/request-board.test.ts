import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import {
  countInterestQueue,
  countOpenPublications,
  countOpenPublicationsAll,
  countPublicationReviewQueue,
  createInterestStatement,
  dismissInterestStatement,
  editPublicStatement,
  findInterestFor,
  interestQueue,
  findPublicationByRequestId,
  findPublicListing,
  interestAuditGuard,
  publicationAuditGuard,
  findViewerRelation,
  listBuilderInterests,
  listInterestsForRequest,
  listOpenPublications,
  listPublicationsForOps,
  listSitemapRequests,
  markInterestsInvitedStatements,
  optInStatement,
  publishStatement,
  reOptInStatement,
  rejectStatement,
  returnedInterest,
  returnedPublication,
  unpublishStatement,
  withdrawInterestStatement,
  withdrawStatement,
  type Publication,
} from "../../src/db/request-board.ts";
import { createProductDraft } from "../../src/db/products.ts";
import { createRequestStatements, inviteBuildersBatch } from "../../src/db/requests.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { addLiveProduct, ensureUser, makeBuilder, makeRequest } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const T0 = "2026-12-01T10:00:00.000Z";
const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
const DESC = "We need online booking with SMS reminders for three salons in Hanoi.";
const CV = "2026-12-01";

async function ownerOf(requestId: string): Promise<string> {
  return (await db().prepare("SELECT client_user_id AS id FROM requests WHERE id = ?1").bind(requestId).first<{ id: string }>())!.id;
}

async function ops(tag: string) {
  return (await ensureUser(`${tag}-ops@vnx.si`)).id;
}

async function run1<T>(stmt: D1PreparedStatement, read: (r: D1Result | undefined) => T): Promise<T> {
  const [res] = await db().batch([stmt]);
  return read(res);
}

async function optIn(requestId: string, now = T0, extra: { publicId?: string; clientUserId?: string } = {}): Promise<Publication | null> {
  return run1(optInStatement(db(), { writeId: ulid(), requestId, consentVersion: CV, now, clientUserId: await ownerOf(requestId), ...extra }), returnedPublication);
}

/** A request with a published listing. Returns the pieces tests need. */
async function published(tag: string, opts: { now?: string; publicId?: string } = {}) {
  const made = await makeRequest({ tag });
  const now = opts.now ?? T0;
  const pub = await optIn(made.request.id, now, { publicId: opts.publicId });
  if (!pub) throw new Error("opt-in failed");
  const reviewer = await ops(tag);
  const done = await run1(publishStatement(db(), { writeId: ulid(), requestId: made.request.id, expectedUpdatedAt: pub.updatedAt, title: `${tag} public title`, description: `${tag} ${DESC}`, reviewedBy: reviewer, now }), returnedPublication);
  if (!done) throw new Error("publish failed");
  return { ...made, publication: done, reviewer };
}

async function approvedBuilder(tag: string) {
  return makeBuilder(`${tag}@vnx.si`, tag, "approved");
}

async function express(requestId: string, builderId: string, o: { note?: string | null; productId?: string | null; cap?: number; now?: string } = {}) {
  // S-2: the statement takes the public id; a request without a publication gets one that matches nothing.
  const publicId = (await db().prepare("SELECT public_id FROM request_publications WHERE request_id = ?1").bind(requestId).first<{ public_id: string }>())?.public_id ?? "NO-PUBLICATION";
  return run1(createInterestStatement(db(), { id: ulid(), writeId: ulid(), publicId, builderId, note: o.note ?? null, productId: o.productId ?? null, now: o.now ?? T0, pendingCap: o.cap ?? 30 }), returnedInterest);
}

describe("db/request-board: publication writes (VNX-2702a)", () => {
  it("opts a submitted request in as pending_review, with its own public id and consent version", async () => {
    const { request } = await makeRequest({ tag: "rb-optin" });
    const pub = await optIn(request.id);
    expect(pub).toMatchObject({ requestId: request.id, status: "pending_review", consentVersion: CV, optedInAt: T0, publicTitle: null, publishedAt: null, endedAt: null });
    expect(pub?.publicId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(pub?.publicId).not.toContain(request.id);
  });

  it("inserts nothing for a removed or finished request, and nothing twice for one request", async () => {
    for (const status of ["removed", "builder_selected", "closed", "rejected", "expired"]) {
      const { request } = await makeRequest({ tag: `rb-optin-${status}` });
      await db().prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(request.id, status).run();
      expect(await optIn(request.id), status).toBeNull();
      expect(await findPublicationByRequestId(db(), request.id)).toBeNull();
    }
    const { request } = await makeRequest({ tag: "rb-optin-twice" });
    const first = await optIn(request.id);
    expect(await optIn(request.id, at(1000))).toBeNull();
    expect((await findPublicationByRequestId(db(), request.id))?.publicId).toBe(first?.publicId);
  });

  it("takes a request that is still pending verification, in the same batch as the request insert", async () => {
    const client = await ensureUser("rb-optin-batch-c@vnx.si");
    const made = createRequestStatements(db(), { clientUserId: client.id, clientName: "Minh Tran", title: "t", description: DESC, category: "booking", budgetBand: "2k-10k", deadline: null, languages: ["en"], status: "pending_verification", locale: "en", country: "VN", now: T0 });
    const [reqRes, pubRes] = await db().batch([...made.statements, optInStatement(db(), { writeId: ulid(), requestId: made.id, consentVersion: CV, now: T0, clientUserId: client.id })]);
    expect((reqRes?.results[0] as { country: string }).country).toBe("VN");
    expect(returnedPublication(pubRes)?.requestId).toBe(made.id);
  });

  it("makes a public_id that carries no time: not the request id's timestamp prefix, random between calls (S-3)", async () => {
    const a = await makeRequest({ tag: "rb-pid-a" });
    const b = await makeRequest({ tag: "rb-pid-b" });
    const pa = (await optIn(a.request.id, a.request.createdAt))!;
    const pb = (await optIn(b.request.id, b.request.createdAt))!;
    for (const [made, pub] of [[a, pa], [b, pb]] as const) {
      expect(pub.publicId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(pub.publicId.slice(0, 10)).not.toBe(made.request.id.slice(0, 10));
      expect(pub.publicId.slice(0, 8)).not.toBe(made.request.id.slice(0, 8));
    }
    expect(pa.publicId).not.toBe(pb.publicId);
  });

  it("checks the owner when a client id is given", async () => {
    const { request } = await makeRequest({ tag: "rb-optin-own" });
    const stranger = await ensureUser("rb-optin-own-x@vnx.si");
    expect(await optIn(request.id, T0, { clientUserId: stranger.id })).toBeNull();
    expect(await optIn(request.id, T0, { clientUserId: request.clientUserId })).not.toBeNull();
  });

  it("publishes only pending_review, only on a matching updated_at, only for an open request", async () => {
    const { request } = await makeRequest({ tag: "rb-pub" });
    const pub = (await optIn(request.id))!;
    const reviewer = await ops("rb-pub");
    const input = { requestId: request.id, title: "Booking app", description: DESC, reviewedBy: reviewer, now: at(1000) };
    expect(await run1(publishStatement(db(), { writeId: ulid(), ...input, expectedUpdatedAt: at(-5) }), returnedPublication)).toBeNull(); // stale
    await db().prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    expect(await run1(publishStatement(db(), { writeId: ulid(), ...input, expectedUpdatedAt: pub.updatedAt }), returnedPublication)).toBeNull(); // request not open
    await db().prepare("UPDATE requests SET status = 'matching' WHERE id = ?1").bind(request.id).run();
    const done = await run1(publishStatement(db(), { writeId: ulid(), ...input, expectedUpdatedAt: pub.updatedAt }), returnedPublication);
    expect(done).toMatchObject({ status: "published", publicTitle: "Booking app", publicDescription: DESC, publishedAt: at(1000), reviewedBy: reviewer, reviewedAt: at(1000) });
    expect(await run1(publishStatement(db(), { writeId: ulid(), ...input, expectedUpdatedAt: done!.updatedAt }), returnedPublication)).toBeNull(); // not pending_review any more
  });

  it("edits a published listing without changing its status, and not a pending one", async () => {
    const { request } = await makeRequest({ tag: "rb-edit" });
    const pub = (await optIn(request.id))!;
    const reviewer = await ops("rb-edit");
    const edit = (updatedAt: string, now: string) => run1(editPublicStatement(db(), { writeId: ulid(), requestId: request.id, expectedUpdatedAt: updatedAt, title: "Edited", description: `${DESC} More.`, reviewedBy: reviewer, now }), returnedPublication);
    expect(await edit(pub.updatedAt, at(500))).toBeNull();
    const live = await run1(publishStatement(db(), { writeId: ulid(), requestId: request.id, expectedUpdatedAt: pub.updatedAt, title: "T", description: DESC, reviewedBy: reviewer, now: at(1000) }), returnedPublication);
    expect(await edit(at(7), at(1500))).toBeNull(); // stale
    expect(await edit(live!.updatedAt, at(1500))).toMatchObject({ status: "published", publicTitle: "Edited", publishedAt: at(1000), updatedAt: at(1500) });
  });

  it("rejects only from pending_review and needs a note; reject and unpublish are final", async () => {
    const { request } = await makeRequest({ tag: "rb-rej" });
    const pub = (await optIn(request.id))!;
    const reviewer = await ops("rb-rej");
    const reject = (updatedAt: string, note: string, now: string) => run1(rejectStatement(db(), { writeId: ulid(), requestId: request.id, expectedUpdatedAt: updatedAt, reviewNote: note, reviewedBy: reviewer, now }), returnedPublication);
    expect(await reject(pub.updatedAt, "", at(500))).toBeNull();
    expect(await reject(pub.updatedAt, "   ", at(500))).toBeNull();
    const rejected = await reject(pub.updatedAt, "Contains a phone number", at(1000));
    expect(rejected).toMatchObject({ status: "rejected", reviewNote: "Contains a phone number", reviewedBy: reviewer, endedAt: at(1000) });
    const back = await run1(reOptInStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(request.id), requestId: request.id, expectedUpdatedAt: rejected!.updatedAt, consentVersion: CV, now: at(2000) }), returnedPublication);
    expect(back).toBeNull();
  });

  it("unpublishes only a published listing and needs a note; opt-in again is refused", async () => {
    const live = await published("rb-unpub");
    const unpublish = (note: string, now: string, updatedAt = live.publication.updatedAt) => run1(unpublishStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: updatedAt, reviewNote: note, reviewedBy: live.reviewer, now }), returnedPublication);
    expect(await unpublish("", at(500))).toBeNull();
    const done = await unpublish("Not a real brief", at(1000));
    expect(done).toMatchObject({ status: "unpublished", reviewNote: "Not a real brief", endedAt: at(1000), publishedAt: T0 });
    expect(await unpublish("again", at(2000), done!.updatedAt)).toBeNull();
    expect(await run1(reOptInStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: done!.updatedAt, consentVersion: CV, now: at(3000) }), returnedPublication)).toBeNull();
    const pendingOne = await makeRequest({ tag: "rb-unpub-pending" });
    const pub = (await optIn(pendingOne.request.id))!;
    expect(await run1(unpublishStatement(db(), { writeId: ulid(), requestId: pendingOne.request.id, expectedUpdatedAt: pub.updatedAt, reviewNote: "x", reviewedBy: live.reviewer, now: at(1000) }), returnedPublication)).toBeNull();
  });

  it("lets the client withdraw from pending_review and from published, even when the request is closed", async () => {
    const pendingOne = await makeRequest({ tag: "rb-wd-p" });
    const pub = (await optIn(pendingOne.request.id))!;
    expect(await run1(withdrawStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(pendingOne.request.id), requestId: pendingOne.request.id, expectedUpdatedAt: pub.updatedAt, now: at(1000) }), returnedPublication)).toMatchObject({ status: "withdrawn", endedAt: at(1000) });

    const live = await published("rb-wd-live");
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(live.request.id, at(10)).run();
    const stranger = await ensureUser("rb-wd-x@vnx.si");
    expect(await run1(withdrawStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000), clientUserId: stranger.id }), returnedPublication)).toBeNull();
    expect(await run1(withdrawStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000), clientUserId: live.client.id }), returnedPublication)).toMatchObject({ status: "withdrawn" });
  });

  it("M4: opt-in again after a withdrawal resets exactly the consent columns and keeps the rest", async () => {
    const live = await published("rb-reopt");
    const wd = (await run1(withdrawStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000) }), returnedPublication))!;
    expect(await run1(reOptInStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: at(3), consentVersion: "2027-01-01", now: at(2000) }), returnedPublication)).toBeNull(); // stale
    const back = (await run1(reOptInStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: wd.updatedAt, consentVersion: "2027-01-01", now: at(2000) }), returnedPublication))!;
    expect(back).toEqual({
      ...live.publication, // public_id, public_title, public_description, published_at, reviewed_by, reviewed_at, review_note, created_at all kept
      status: "pending_review",
      optedInAt: at(2000),
      consentVersion: "2027-01-01",
      endedAt: null,
      updatedAt: at(2000),
    });
    expect(back.publishedAt).toBe(T0);
    // Publishing again does not move it to the top: published_at stays the first publication's.
    const again = await run1(publishStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: back.updatedAt, title: "T2", description: `${DESC} v2`, reviewedBy: live.reviewer, now: at(5000) }), returnedPublication);
    expect(again).toMatchObject({ status: "published", publishedAt: T0, publicTitle: "T2", reviewedAt: at(5000) });
  });

  it("opt-in again needs an open request and the right owner", async () => {
    const live = await published("rb-reopt-closed");
    const wd = (await run1(withdrawStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000) }), returnedPublication))!;
    const stranger = await ensureUser("rb-reopt-x@vnx.si");
    expect(await run1(reOptInStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: wd.updatedAt, consentVersion: CV, now: at(2000), clientUserId: stranger.id }), returnedPublication)).toBeNull();
    await db().prepare("UPDATE requests SET status = 'closed' WHERE id = ?1").bind(live.request.id).run();
    expect(await run1(reOptInStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(live.request.id), requestId: live.request.id, expectedUpdatedAt: wd.updatedAt, consentVersion: CV, now: at(2000) }), returnedPublication)).toBeNull();
  });

  it("guards audit rows on the publication compare-and-set (a lost compare-and-set writes none)", async () => {
    const { request } = await makeRequest({ tag: "rb-audit-pub" });
    const pub = (await optIn(request.id))!;
    const reviewer = await ops("rb-audit-pub");
    const batch = (expected: string, now: string, writeId = ulid()) =>
      db().batch([
        rejectStatement(db(), { writeId, requestId: request.id, expectedUpdatedAt: expected, reviewNote: "n", reviewedBy: reviewer, now }),
        auditStatement(db(), { actorUserId: reviewer, action: "request_publication.reject", entity: "request_publication", entityId: request.id, now }, publicationAuditGuard({ requestId: request.id, writeId })),
      ]);
    const lost = await batch(at(-9), at(1000));
    expect(lost[0]?.results).toHaveLength(0);
    expect(await auditCount("request_publication.reject", request.id)).toBe(0);
    const won = await batch(pub.updatedAt, at(2000));
    expect(won[0]?.results).toHaveLength(1);
    expect(await auditCount("request_publication.reject", request.id)).toBe(1);
  });
});

async function auditCount(action: string, entityId: string): Promise<number> {
  return (await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?1 AND entity_id = ?2").bind(action, entityId).first<{ n: number }>())!.n;
}

describe("db/request-board: interest writes (VNX-2702a)", () => {
  it("creates a pending interest with a note and the builder's own published product", async () => {
    const live = await published("rb-int");
    const builder = await approvedBuilder("rb-int-b");
    const product = await addLiveProduct(builder, "rb-int product");
    const interest = await express(live.request.id, builder.userId, { note: "I built this", productId: product.id });
    expect(interest).toMatchObject({ requestId: live.request.id, builderId: builder.userId, note: "I built this", productId: product.id, status: "pending", createdAt: T0 });
    expect((await findInterestFor(db(), live.request.id, builder.userId))?.id).toBe(interest?.id);
  });

  it("refuses builders that are not approved on an active account, and the client", async () => {
    const live = await published("rb-gate-b");
    for (const status of ["pending", "rejected", "suspended"] as const) {
      const b = await makeBuilder(`rb-gate-${status}@vnx.si`, `rb-gate-${status}`, status);
      expect(await express(live.request.id, b.userId), status).toBeNull();
    }
    const suspendedUser = await approvedBuilder("rb-gate-user");
    await db().prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(suspendedUser.userId).run();
    expect(await express(live.request.id, suspendedUser.userId)).toBeNull();
    const own = await makeBuilder(`${live.client.email}`, "rb-gate-own", "approved");
    expect(own.userId).toBe(live.client.id);
    expect(await express(live.request.id, live.client.id)).toBeNull();
  });

  it("refuses a request that is not open and published, and a duplicate pair", async () => {
    const builder = await approvedBuilder("rb-gate-r-b");
    const pendingReview = await makeRequest({ tag: "rb-gate-r-pend" });
    await optIn(pendingReview.request.id);
    expect(await express(pendingReview.request.id, builder.userId)).toBeNull();
    const plain = await makeRequest({ tag: "rb-gate-r-none" });
    expect(await express(plain.request.id, builder.userId)).toBeNull();
    const closed = await published("rb-gate-r-closed");
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(closed.request.id, T0).run();
    expect(await express(closed.request.id, builder.userId)).toBeNull();
    const live = await published("rb-gate-r-live");
    expect(await express(live.request.id, builder.userId)).not.toBeNull();
    expect(await express(live.request.id, builder.userId)).toBeNull();
  });

  it("refuses a builder who already has an invitation on the request", async () => {
    const live = await published("rb-gate-inv");
    const builder = await approvedBuilder("rb-gate-inv-b");
    const admin = await ensureUser("owner@vnx.si");
    const invite = inviteBuildersBatch(db(), { requestId: live.request.id, builderIds: [builder.userId], invitedBy: admin.id, now: T0 });
    await db().batch(invite.statements);
    expect(await express(live.request.id, builder.userId)).toBeNull();
  });

  it("refuses a product of another builder or one that is not published", async () => {
    const live = await published("rb-gate-prod");
    const builder = await approvedBuilder("rb-gate-prod-b");
    const other = await approvedBuilder("rb-gate-prod-o");
    const foreign = await addLiveProduct(other, "rb-gate-prod foreign");
    expect(await express(live.request.id, builder.userId, { productId: foreign.id })).toBeNull();
    const mine = await addLiveProduct(builder, "rb-gate-prod mine");
    await db().prepare("UPDATE products SET status = 'unlisted' WHERE id = ?1").bind(mine.id).run();
    expect(await express(live.request.id, builder.userId, { productId: mine.id })).toBeNull();
    expect(await express(live.request.id, builder.userId)).not.toBeNull();
  });

  it("caps pending interests at 30 inside the SQL, and (H1) only open requests count", async () => {
    const builder = await approvedBuilder("rb-cap-b");
    const client = await ensureUser("rb-cap-c@vnx.si");
    const reviewer = await ops("rb-cap");
    const ids: string[] = [];
    const statements: D1PreparedStatement[] = [];
    for (let i = 0; i < 31; i++) {
      const made = createRequestStatements(db(), { clientUserId: client.id, clientName: "Minh Tran", title: `cap ${i}`, description: DESC, category: "booking", budgetBand: "2k-10k", deadline: null, languages: ["en"], status: "submitted", locale: "en", now: T0 });
      ids.push(made.id);
      statements.push(...made.statements, optInStatement(db(), { writeId: ulid(), requestId: made.id, consentVersion: CV, now: T0, clientUserId: client.id }), publishStatement(db(), { writeId: ulid(), requestId: made.id, expectedUpdatedAt: T0, title: `cap ${i}`, description: DESC, reviewedBy: reviewer, now: T0 }));
    }
    await db().batch(statements);
    for (let i = 0; i < 30; i++) expect(await express(ids[i]!, builder.userId, { now: at(i) }), `interest ${i}`).not.toBeNull();
    expect(await express(ids[30]!, builder.userId, { now: at(100) })).toBeNull(); // the 31st: 0 rows
    // H1: requests that closed or were hidden free their places.
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(ids[0], at(200)).run();
    await db().prepare("UPDATE request_publications SET status = 'withdrawn' WHERE request_id = ?1").bind(ids[1]).run();
    expect(await express(ids[30]!, builder.userId, { now: at(300) })).not.toBeNull();
    const freed = await createRequestStatements(db(), { clientUserId: client.id, clientName: "M", title: "x", description: DESC, category: "booking", budgetBand: "2k-10k", deadline: null, languages: ["en"], status: "submitted", locale: "en", now: T0 });
    await db().batch([...freed.statements, optInStatement(db(), { writeId: ulid(), requestId: freed.id, consentVersion: CV, now: T0, clientUserId: client.id }), publishStatement(db(), { writeId: ulid(), requestId: freed.id, expectedUpdatedAt: T0, title: "x", description: DESC, reviewedBy: reviewer, now: T0 })]);
    expect(await express(freed.id, builder.userId, { now: at(400) })).not.toBeNull(); // 30 open again: 28 + 1 + 1
  });

  it("honours the cap it is given (fresh request, so only the cap decides)", async () => {
    const builder = await approvedBuilder("rb-cap2-b");
    const first = await published("rb-cap2-a");
    expect(await express(first.request.id, builder.userId)).not.toBeNull(); // 1 pending now
    const fresh = await published("rb-cap2-f");
    expect(await express(fresh.request.id, builder.userId, { cap: 1 })).toBeNull();
    expect(await express(fresh.request.id, builder.userId, { cap: 2 })).not.toBeNull();
  });

  it("withdraws only the builder's own pending interest, compare-and-set on updated_at", async () => {
    const live = await published("rb-wdi");
    const builder = await approvedBuilder("rb-wdi-b");
    const other = await approvedBuilder("rb-wdi-o");
    const interest = (await express(live.request.id, builder.userId))!;
    const withdraw = (by: string, expected: string, now: string) => run1(withdrawInterestStatement(db(), { writeId: ulid(), interestId: interest.id, builderId: by, expectedUpdatedAt: expected, now }), returnedInterest);
    expect(await withdraw(other.userId, interest.updatedAt, at(1000))).toBeNull();
    expect(await withdraw(builder.userId, at(7), at(1000))).toBeNull();
    expect(await withdraw(builder.userId, interest.updatedAt, at(1000))).toMatchObject({ status: "withdrawn", updatedAt: at(1000) });
    expect(await withdraw(builder.userId, at(1000), at(2000))).toBeNull();
  });

  it("dismisses a pending interest once, compare-and-set", async () => {
    const live = await published("rb-dis");
    const builder = await approvedBuilder("rb-dis-b");
    const interest = (await express(live.request.id, builder.userId))!;
    const dismiss = (expected: string, now: string) => run1(dismissInterestStatement(db(), { writeId: ulid(), interestId: interest.id, expectedUpdatedAt: expected, decidedBy: live.reviewer, now }), returnedInterest);
    expect(await dismiss(at(5), at(1000))).toBeNull();
    expect(await dismiss(interest.updatedAt, at(1000))).toMatchObject({ status: "dismissed", decidedBy: live.reviewer, decidedAt: at(1000) });
    expect(await dismiss(at(1000), at(2000))).toBeNull();
  });

  it("moves to invited only the pending interests of builders this batch invited", async () => {
    const live = await published("rb-invd");
    const [a, b, c] = await Promise.all(["rb-invd-x1", "rb-invd-x2", "rb-invd-x3"].map(approvedBuilder));
    for (const x of [a!, b!, c!]) await express(live.request.id, x.userId);
    const admin = await ensureUser("owner@vnx.si");
    await db().prepare("UPDATE request_interests SET status = 'dismissed' WHERE request_id = ?1 AND builder_id = ?2").bind(live.request.id, c!.userId).run();
    const invite = inviteBuildersBatch(db(), { requestId: live.request.id, builderIds: [a!.userId, c!.userId], invitedBy: admin.id, now: at(1000) });
    const mark = markInterestsInvitedStatements(db(), { requestId: live.request.id, builderIds: [a!.userId, c!.userId], inviteIds: invite.inviteIds, decidedBy: admin.id, now: at(1000), writeId: ulid() });
    const results = await db().batch([...invite.statements, ...mark]);
    const marked = results.slice(invite.statements.length).map((r) => r.results.length);
    expect(marked).toEqual([1, 0]); // a: pending -> invited; c: was dismissed, stays
    expect((await findInterestFor(db(), live.request.id, a!.userId))?.status).toBe("invited");
    expect((await findInterestFor(db(), live.request.id, b!.userId))?.status).toBe("pending"); // not invited in this batch
    expect((await findInterestFor(db(), live.request.id, c!.userId))?.status).toBe("dismissed");
  });

  it("leaves an interest pending when its invitation lost the cap", async () => {
    const live = await published("rb-invcap");
    const six = await Promise.all(Array.from({ length: 6 }, (_, i) => approvedBuilder(`rb-invcap-${i}`)));
    for (const x of six) await express(live.request.id, x.userId);
    const admin = await ensureUser("owner@vnx.si");
    const invite = inviteBuildersBatch(db(), { requestId: live.request.id, builderIds: six.map((x) => x.userId), invitedBy: admin.id, now: at(1000) });
    const mark = markInterestsInvitedStatements(db(), { requestId: live.request.id, builderIds: six.map((x) => x.userId), inviteIds: invite.inviteIds, decidedBy: admin.id, now: at(1000), writeId: ulid() });
    await db().batch([...invite.statements, ...mark]);
    expect((await findInterestFor(db(), live.request.id, six[5]!.userId))?.status).toBe("pending");
    expect((await findInterestFor(db(), live.request.id, six[0]!.userId))?.status).toBe("invited");
  });

  it("2706b: interestQueue gives the count and the oldest pending interest it counts (same rule as countInterestQueue)", async () => {
    const before = await interestQueue(db());
    expect(before.count).toBe(await countInterestQueue(db()));
    const live = await published("rb-iq");
    const old = await approvedBuilder("rb-iq-old");
    const hidden = await approvedBuilder("rb-iq-hid");
    await express(live.request.id, old.userId, { now: "2020-01-01T00:00:00.000Z" });
    await express(live.request.id, hidden.userId, { now: "2019-01-01T00:00:00.000Z" });
    await db().prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(hidden.userId).run();
    const after = await interestQueue(db());
    expect(after.count).toBe(before.count + 1);
    expect(after.oldest).toBe("2020-01-01T00:00:00.000Z"); // the suspended builder's older interest is not counted, so it is not the oldest
  });

  it("guards audit rows on the interest compare-and-set", async () => {
    const live = await published("rb-audit-int");
    const builder = await approvedBuilder("rb-audit-int-b");
    const interest = (await express(live.request.id, builder.userId))!;
    const batch = (expected: string, now: string, writeId = ulid()) =>
      db().batch([
        dismissInterestStatement(db(), { writeId, interestId: interest.id, expectedUpdatedAt: expected, decidedBy: live.reviewer, now }),
        auditStatement(db(), { actorUserId: live.reviewer, action: "request_interest.dismiss", entity: "request_interest", entityId: interest.id, now }, interestAuditGuard({ interestId: interest.id, writeId })),
      ]);
    await batch(at(-1), at(1000));
    expect(await auditCount("request_interest.dismiss", interest.id)).toBe(0);
    await batch(interest.updatedAt, at(2000));
    expect(await auditCount("request_interest.dismiss", interest.id)).toBe(1);
  });
});

const FORBIDDEN_KEYS = ["requestId", "request_id", "clientUserId", "client_user_id", "clientName", "client_name", "locale", "adminNote", "admin_note", "title", "description", "id"];

describe("db/request-board: public reads (VNX-2702a)", () => {
  it("lists only published listings of open requests, with no identifying key in the object", async () => {
    const live = await published("rb-read");
    await db().prepare("UPDATE requests SET country = 'VN', admin_note = 'SECRET-NOTE' WHERE id = ?1").bind(live.request.id).run();
    const pendingOne = await makeRequest({ tag: "rb-read-pend" });
    const pub = (await optIn(pendingOne.request.id))!;
    const closed = await published("rb-read-closed");
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(closed.request.id, T0).run();
    const wd = await published("rb-read-wd");
    await run1(withdrawStatement(db(), { writeId: ulid(), clientUserId: await ownerOf(wd.request.id), requestId: wd.request.id, expectedUpdatedAt: wd.publication.updatedAt, now: at(5) }), returnedPublication);
    const rows = await listOpenPublications(db(), {}, 500, 0);
    const ids = rows.map((r) => r.publicId);
    expect(ids).toContain(live.publication.publicId);
    expect(ids).not.toContain(pub.publicId);
    expect(ids).not.toContain(closed.publication.publicId);
    expect(ids).not.toContain(wd.publication.publicId);
    const mine = rows.find((r) => r.publicId === live.publication.publicId)!;
    expect(mine).toMatchObject({ publicTitle: "rb-read public title", country: "VN", category: "booking", budgetBand: "2k-10k", requestStatus: "submitted", publicationStatus: "published" });
    for (const row of [mine, (await findPublicListing(db(), live.publication.publicId))!]) {
      for (const key of FORBIDDEN_KEYS) expect(Object.keys(row), key).not.toContain(key);
      const text = JSON.stringify(row);
      expect(text).not.toContain(live.request.id);
      expect(text).not.toContain(live.client.id);
      expect(text).not.toContain("SECRET-NOTE");
      expect(text).not.toContain("Minh Tran");
      expect(text).not.toContain("rb-read booking app"); // the client's original title
    }
  });

  it("findPublicListing returns published listings of any request status, never other publication statuses", async () => {
    const closed = await published("rb-find-closed");
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(closed.request.id, T0).run();
    expect(await findPublicListing(db(), closed.publication.publicId)).toMatchObject({ requestStatus: "closed", closedAt: T0 });
    const pendingOne = await makeRequest({ tag: "rb-find-pend" });
    const pub = (await optIn(pendingOne.request.id))!;
    expect(await findPublicListing(db(), pub.publicId)).toBeNull();
    expect(await findPublicListing(db(), "01NOSUCHPUBLICID0000000000")).toBeNull();
  });

  it("orders by published_at DESC then public_id DESC, with no other order", async () => {
    const a = await published("rb-ord-a", { now: at(10_000), publicId: "01ORDTIE0000000000000000AA" });
    const b = await published("rb-ord-b", { now: at(10_000), publicId: "01ORDTIE0000000000000000BB" });
    const older = await published("rb-ord-c", { now: at(5_000), publicId: "01ORDTIE0000000000000000ZZ" });
    const ids = (await listOpenPublications(db(), {}, 500, 0)).map((r) => r.publicId);
    const pos = (x: { publication: Publication }) => ids.indexOf(x.publication.publicId);
    expect(pos(b)).toBeGreaterThanOrEqual(0);
    expect(pos(b)).toBeLessThan(pos(a));
    expect(pos(a)).toBeLessThan(pos(older));
    const sitemap = (await listSitemapRequests(db(), 2000)).map((r) => r.publicId);
    expect(sitemap.indexOf(b.publication.publicId)).toBeLessThan(sitemap.indexOf(a.publication.publicId));
  });

  it("filters by category, budget band and language, and counts the same rows", async () => {
    const live = await published("rb-flt");
    await db().prepare("UPDATE requests SET category = 'crm', budget_band = '>10k', languages = '[\"zh\"]' WHERE id = ?1").bind(live.request.id).run();
    const filter = { category: "crm", budget: ">10k", lang: "zh" } as const;
    const rows = await listOpenPublications(db(), filter, 500, 0);
    expect(rows.map((r) => r.publicId)).toContain(live.publication.publicId);
    expect(rows.every((r) => r.category === "crm" && r.budgetBand === ">10k" && r.languages.includes("zh"))).toBe(true);
    expect(await countOpenPublications(db(), filter)).toBe(rows.length);
    expect((await listOpenPublications(db(), { ...filter, lang: "vi" }, 500, 0)).map((r) => r.publicId)).not.toContain(live.publication.publicId);
    expect(await countOpenPublicationsAll(db())).toBe((await listOpenPublications(db(), {}, 5000, 0)).length);
    const page = await listOpenPublications(db(), filter, 1, 0);
    expect(page).toHaveLength(1);
  });

  it("lists in the sitemap only open listings, with the publication's updated_at as lastmod", async () => {
    const live = await published("rb-map");
    const closed = await published("rb-map-closed");
    await db().prepare("UPDATE requests SET status = 'expired', closed_at = ?2 WHERE id = ?1").bind(closed.request.id, T0).run();
    const rows = await listSitemapRequests(db(), 2000);
    expect(rows.find((r) => r.publicId === live.publication.publicId)).toEqual({ publicId: live.publication.publicId, lastmod: live.publication.updatedAt });
    expect(rows.map((r) => r.publicId)).not.toContain(closed.publication.publicId);
    expect((await listSitemapRequests(db(), 1)).length).toBe(1);
  });
});

describe("db/request-board: H2 findViewerRelation, one query, no foreign request id (VNX-2702a)", () => {
  it("tells the owner, an invited builder, an interested builder and a stranger apart", async () => {
    const live = await published("rb-rel");
    const interested = await approvedBuilder("rb-rel-i");
    const invited = await approvedBuilder("rb-rel-v");
    const stranger = await ensureUser("rb-rel-s@vnx.si");
    const interest = (await express(live.request.id, interested.userId))!;
    const admin = await ensureUser("owner@vnx.si");
    const invite = inviteBuildersBatch(db(), { requestId: live.request.id, builderIds: [invited.userId], invitedBy: admin.id, now: at(1000) });
    await db().batch(invite.statements);
    const pid = live.publication.publicId;
    expect(await findViewerRelation(db(), pid, live.client.id)).toEqual({ ownRequestId: live.request.id, inviteId: null, interest: null, products: [], builder: "none" });
    expect(await findViewerRelation(db(), pid, interested.userId)).toEqual({ ownRequestId: null, inviteId: null, interest: { id: interest.id, status: "pending" }, products: [], builder: "approved" });
    expect(await findViewerRelation(db(), pid, invited.userId)).toEqual({ ownRequestId: null, inviteId: invite.inviteIds[0], interest: null, products: [], builder: "approved" });
    expect(await findViewerRelation(db(), pid, stranger.id)).toEqual({ ownRequestId: null, inviteId: null, interest: null, products: [], builder: "none" });
    expect(JSON.stringify(await findViewerRelation(db(), pid, stranger.id))).not.toContain(live.request.id);
    expect(await findViewerRelation(db(), "01NOSUCHPUBLICID0000000000", live.client.id)).toEqual({ ownRequestId: null, inviteId: null, interest: null, products: [], builder: "none" });
  });

  it("gives three builder states: none, approved, not_approved (L9)", async () => {
    const live = await published("rb-rel-state");
    const pid = live.publication.publicId;
    const state = async (userId: string) => (await findViewerRelation(db(), pid, userId)).builder;
    expect(await state((await ensureUser("rb-rel-state-plain@vnx.si")).id)).toBe("none");
    expect(await state((await approvedBuilder("rb-rel-state-ok")).userId)).toBe("approved");
    for (const status of ["pending", "rejected", "suspended"] as const) {
      expect(await state((await makeBuilder(`rb-rel-state-${status}@vnx.si`, `rb-rel-state-${status}`, status)).userId), status).toBe("not_approved");
    }
    const userSuspended = await approvedBuilder("rb-rel-state-us");
    await db().prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(userSuspended.userId).run();
    expect(await state(userSuspended.userId)).toBe("not_approved");
  });

  it("VNX-2706a: lists the viewer's own published products for the interest form, in the same query (not a draft, not another builder's)", async () => {
    const live = await published("rb-rel-prod");
    const me = await approvedBuilder("rb-rel-prod-me");
    const other = await approvedBuilder("rb-rel-prod-other");
    const mine = await addLiveProduct(me, "rb-rel-prod B mine");
    const first = await addLiveProduct(me, "rb-rel-prod A mine");
    await addLiveProduct(other, "rb-rel-prod theirs");
    await createProductDraft(db(), { builderId: me.userId, name: "rb-rel-prod draft", now: T0 });
    const rel = await findViewerRelation(db(), live.publication.publicId, me.userId);
    expect(rel.products).toEqual([
      { id: first.id, name: "rb-rel-prod A mine" },
      { id: mine.id, name: "rb-rel-prod B mine" },
    ]);
    expect((await findViewerRelation(db(), live.publication.publicId, other.userId)).products.map((p) => p.name)).toEqual(["rb-rel-prod theirs"]);
  });

  it("VNX-2706a: the Hub list carries the invitation id of an invited interest, null otherwise", async () => {
    const live = await published("rb-hub-inv");
    const builder = await approvedBuilder("rb-hub-inv-b");
    await express(live.request.id, builder.userId);
    expect((await listBuilderInterests(db(), builder.userId))[0]?.inviteId).toBeNull();
    const admin = await ensureUser("owner@vnx.si");
    const invite = inviteBuildersBatch(db(), { requestId: live.request.id, builderIds: [builder.userId], invitedBy: admin.id, now: at(1000) });
    await db().batch(invite.statements);
    expect((await listBuilderInterests(db(), builder.userId))[0]?.inviteId).toBe(invite.inviteIds[0]);
  });

});

describe("db/request-board: Ops and Hub reads (VNX-2702a)", () => {
  it("lists a request's interests with the builder's public name and the L9 flag", async () => {
    const live = await published("rb-ops");
    const good = await approvedBuilder("rb-ops-g");
    const later = await approvedBuilder("rb-ops-l");
    const product = await addLiveProduct(good, "rb-ops product");
    await express(live.request.id, good.userId, { note: "hello", productId: product.id, now: at(1) });
    await express(live.request.id, later.userId, { now: at(2) });
    await db().prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(later.userId).run();
    const rows = await listInterestsForRequest(db(), live.request.id);
    expect(rows.map((r) => [r.builderHandle, r.builderPublic, r.productName])).toEqual([["rb-ops-g", true, "rb-ops product"], ["rb-ops-l", false, null]]);
    expect(rows[0]?.interest.note).toBe("hello");
  });

  it("counts the review queue and the interest queue against open requests and approved builders", async () => {
    const reviewBefore = await countPublicationReviewQueue(db());
    const queueBefore = await countInterestQueue(db());
    const waiting = await makeRequest({ tag: "rb-q-wait" });
    await optIn(waiting.request.id);
    const closedWaiting = await makeRequest({ tag: "rb-q-closed" });
    await optIn(closedWaiting.request.id);
    await db().prepare("UPDATE requests SET status = 'closed' WHERE id = ?1").bind(closedWaiting.request.id).run();
    expect(await countPublicationReviewQueue(db())).toBe(reviewBefore + 1);

    const live = await published("rb-q-int");
    const ok = await approvedBuilder("rb-q-ok");
    const gone = await approvedBuilder("rb-q-gone");
    await express(live.request.id, ok.userId);
    await express(live.request.id, gone.userId);
    expect(await countInterestQueue(db())).toBe(queueBefore + 2);
    await db().prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(gone.userId).run();
    expect(await countInterestQueue(db())).toBe(queueBefore + 1);
  });

  it("gives a builder their own interests with the public id, never the request id", async () => {
    const live = await published("rb-hub");
    const builder = await approvedBuilder("rb-hub-b");
    await express(live.request.id, builder.userId);
    const items = await listBuilderInterests(db(), builder.userId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ publicId: live.publication.publicId, publicTitle: "rb-hub public title", status: "pending", requestStatus: "submitted" });
    expect(JSON.stringify(items)).not.toContain(live.request.id);
    expect(items[0]?.closedAt).toBeNull();
  });

  it("M-2: gives closedAt, and the public title only while the listing is published and the request not removed", async () => {
    const live = await published("rb-hub2");
    const builder = await approvedBuilder("rb-hub2-b");
    await express(live.request.id, builder.userId);
    await db().prepare("UPDATE requests SET status = 'closed', closed_at = ?2 WHERE id = ?1").bind(live.request.id, at(50)).run();
    let item = (await listBuilderInterests(db(), builder.userId))[0]!;
    expect(item).toMatchObject({ closedAt: at(50), publicTitle: "rb-hub2 public title", requestStatus: "closed" });
    await run1(withdrawStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(100), clientUserId: live.client.id }), returnedPublication);
    item = (await listBuilderInterests(db(), builder.userId))[0]!;
    expect(item.publicTitle).toBeNull(); // the client withdrew: the wording never leaves the db layer
    expect(item.publicationStatus).toBe("withdrawn");
    const removed = await published("rb-hub3");
    await express(removed.request.id, builder.userId);
    await db().prepare("UPDATE requests SET status = 'removed', closed_at = ?2 WHERE id = ?1").bind(removed.request.id, at(60)).run();
    const row = (await listBuilderInterests(db(), builder.userId)).find((i) => i.publicId === removed.publication.publicId)!;
    expect(row.publicTitle).toBeNull();
  });

  it("reads publication statuses for a page of requests", async () => {
    const a = await published("rb-lops-a");
    const b = await makeRequest({ tag: "rb-lops-b" });
    const map = await listPublicationsForOps(db(), [a.request.id, b.request.id, ulid()]);
    expect([...map.keys()]).toEqual([a.request.id]);
    expect(map.get(a.request.id)).toEqual({ status: "published", updatedAt: a.publication.updatedAt });
    expect((await listPublicationsForOps(db(), [])).size).toBe(0);
  });
});

// VNX-2702c: the audit guard matches the write's own id. Two writes in the same millisecond that reach the same target status
// (workerd's Date.now only advances after I/O, so this is realistic) must leave an audit row for the winner only.
describe("db/request-board: audit guards match a per-write id (VNX-2702c)", () => {
  type Racer = { actor: string; writeId: string };
  const racers = async (tag: string): Promise<{ winner: Racer; loser: Racer }> => ({
    winner: { actor: await ops(`${tag}-w`), writeId: ulid() },
    loser: { actor: await ops(`${tag}-l`), writeId: ulid() },
  });
  const auditedBy = async (actor: string, action: string) =>
    (await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE actor_user_id = ?1 AND action = ?2").bind(actor, action).first<{ n: number }>())!.n;

  /** Runs the winner's batch, then the loser's, both at the same `now`; the loser's write must lose (0 rows) and leave no audit row. */
  async function raceOnPublication(tag: string, action: string, entityId: string, now: string, write: (r: Racer) => D1PreparedStatement) {
    const { winner, loser } = await racers(tag);
    const batch = (r: Racer) =>
      db().batch([
        write(r),
        auditStatement(db(), { actorUserId: r.actor, action, entity: "request_publication", entityId, now }, publicationAuditGuard({ requestId: entityId, writeId: r.writeId })),
      ]);
    const won = await batch(winner);
    const lost = await batch(loser);
    expect(won[0]?.results, "the winner writes").toHaveLength(1);
    expect(lost[0]?.results, "the loser's write lost its compare-and-set").toHaveLength(0);
    expect(await auditedBy(winner.actor, action)).toBe(1);
    expect(await auditedBy(loser.actor, action), "no audit row for an action that did not happen").toBe(0);
    expect((await findPublicationByRequestId(db(), entityId))?.updatedAt).toBe(now);
  }

  it("opt-in", async () => {
    const { request } = await makeRequest({ tag: "wid-optin" });
    const clientUserId = await ownerOf(request.id);
    await raceOnPublication("wid-optin", "request_publication.opt_in", request.id, T0, (r) => optInStatement(db(), { requestId: request.id, consentVersion: CV, now: T0, clientUserId, writeId: r.writeId }));
  });

  it("re-opt-in", async () => {
    const live = await published("wid-reopt");
    const clientUserId = await ownerOf(live.request.id);
    const wd = (await run1(withdrawStatement(db(), { writeId: ulid(), requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000), clientUserId }), returnedPublication))!;
    await raceOnPublication("wid-reopt", "request_publication.re_opt_in", live.request.id, at(2000), (r) =>
      reOptInStatement(db(), { requestId: live.request.id, expectedUpdatedAt: wd.updatedAt, consentVersion: CV, now: at(2000), clientUserId, writeId: r.writeId }),
    );
  });

  it("withdraw", async () => {
    const live = await published("wid-wd");
    const clientUserId = await ownerOf(live.request.id);
    await raceOnPublication("wid-wd", "request_publication.withdraw", live.request.id, at(1000), (r) =>
      withdrawStatement(db(), { requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, now: at(1000), clientUserId, writeId: r.writeId }),
    );
  });

  it("publish", async () => {
    const made = await makeRequest({ tag: "wid-pub" });
    const pub = (await optIn(made.request.id))!;
    await raceOnPublication("wid-pub", "request_publication.publish", made.request.id, at(1000), (r) =>
      publishStatement(db(), { requestId: made.request.id, expectedUpdatedAt: pub.updatedAt, title: "T", description: DESC, reviewedBy: r.actor, now: at(1000), writeId: r.writeId }),
    );
  });

  it("edit (published stays published: the case status + updated_at could never tell apart)", async () => {
    const live = await published("wid-edit");
    await raceOnPublication("wid-edit", "request_publication.edit", live.request.id, at(1000), (r) =>
      editPublicStatement(db(), { requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, title: "E", description: `${DESC} More.`, reviewedBy: r.actor, now: at(1000), writeId: r.writeId }),
    );
  });

  it("reject", async () => {
    const made = await makeRequest({ tag: "wid-rej" });
    const pub = (await optIn(made.request.id))!;
    await raceOnPublication("wid-rej", "request_publication.reject", made.request.id, at(1000), (r) =>
      rejectStatement(db(), { requestId: made.request.id, expectedUpdatedAt: pub.updatedAt, reviewNote: "no", reviewedBy: r.actor, now: at(1000), writeId: r.writeId }),
    );
  });

  it("unpublish", async () => {
    const live = await published("wid-unpub");
    await raceOnPublication("wid-unpub", "request_publication.unpublish", live.request.id, at(1000), (r) =>
      unpublishStatement(db(), { requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, reviewNote: "no", reviewedBy: r.actor, now: at(1000), writeId: r.writeId }),
    );
  });

  async function raceOnInterest(tag: string, action: string, interestId: string, now: string, write: (r: Racer) => D1PreparedStatement) {
    const { winner, loser } = await racers(tag);
    const batch = (r: Racer) =>
      db().batch([
        write(r),
        auditStatement(db(), { actorUserId: r.actor, action, entity: "request_interest", entityId: interestId, now }, interestAuditGuard({ interestId, writeId: r.writeId })),
      ]);
    const won = await batch(winner);
    const lost = await batch(loser);
    expect(won[0]?.results, "the winner writes").toHaveLength(1);
    expect(lost[0]?.results, "the loser's write lost").toHaveLength(0);
    expect(await auditedBy(winner.actor, action)).toBe(1);
    expect(await auditedBy(loser.actor, action), "no audit row for an action that did not happen").toBe(0);
  }

  it("interest create (the same interest id written twice in one millisecond)", async () => {
    const live = await published("wid-icr");
    const builder = await approvedBuilder("wid-icr-b");
    const interestId = ulid();
    await raceOnInterest("wid-icr", "request_interest.create", interestId, at(1000), (r) =>
      createInterestStatement(db(), { id: interestId, writeId: r.writeId, publicId: live.publication.publicId, builderId: builder.userId, note: null, productId: null, now: at(1000), pendingCap: 30 }),
    );
  });

  it("interest withdraw", async () => {
    const live = await published("wid-iwd");
    const builder = await approvedBuilder("wid-iwd-b");
    const interest = (await express(live.request.id, builder.userId))!;
    await raceOnInterest("wid-iwd", "request_interest.withdraw", interest.id, at(1000), (r) =>
      withdrawInterestStatement(db(), { interestId: interest.id, builderId: builder.userId, expectedUpdatedAt: interest.updatedAt, now: at(1000), writeId: r.writeId }),
    );
  });

  it("interest dismiss", async () => {
    const live = await published("wid-idm");
    const builder = await approvedBuilder("wid-idm-b");
    const interest = (await express(live.request.id, builder.userId))!;
    await raceOnInterest("wid-idm", "request_interest.dismiss", interest.id, at(1000), (r) =>
      dismissInterestStatement(db(), { interestId: interest.id, expectedUpdatedAt: interest.updatedAt, decidedBy: r.actor, now: at(1000), writeId: r.writeId }),
    );
  });

  it("a write leaves its own write_id on the row, and a different one each time", async () => {
    const live = await published("wid-own");
    const read = async () => (await db().prepare("SELECT write_id FROM request_publications WHERE request_id = ?1").bind(live.request.id).first<{ write_id: string }>())!.write_id;
    const first = await read();
    const id = ulid();
    await run1(editPublicStatement(db(), { requestId: live.request.id, expectedUpdatedAt: live.publication.updatedAt, title: "E", description: `${DESC} More.`, reviewedBy: live.reviewer, now: at(1000), writeId: id }), returnedPublication);
    expect(await read()).toBe(id);
    expect(id).not.toBe(first);
  });
});
