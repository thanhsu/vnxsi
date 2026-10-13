import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { countOpenPublicationsAll, findInterestById, findPublicationByRequestId } from "../../src/db/request-board.ts";
import { findAdminRequest, findRequestById, listClientRequests, listRequestInvites } from "../../src/db/requests.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { MIN_OPEN_FOR_INDEX, CLOSED_VISIBLE_DAYS } from "../../src/domain/request-board.ts";
import { suggestBuilders, EXPIRED_PENALTY_WINDOW_MS } from "../../src/domain/request.ts";
import { listCandidates } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { requestBoardPublishedEmail, requestBoardRejectedEmail, requestBoardUnpublishedEmail } from "../../src/email/templates/request-board.ts";
import type { GrantableRole } from "../../src/domain/ops.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../../src/http/turnstile.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { requestMatching } from "../../src/routes/admin-requests.tsx";
import { addLiveProduct, ensureUser, makeBuilder, proposeOn, signIn } from "../fixtures.ts";
import { countD1Queries, followMagicLink, formPost, getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, get, listed, mainOf, tag, GO_LIVE } from "./request-board-helpers.ts";

/**
 * VNX-2709, the exit gate of EPIC 27: one request goes through its whole life over HTTP with the real routes (no route is bypassed except the
 * builder's proposal, which is the existing M6 fixture), then the withdraw path and the gate-off paths. The steps run in order and share state; the
 * isolated storage of this file is the whole world, so counts are exact. Every public page fetched on the way is kept and swept for private strings at the end.
 */

const ROOT = "owner@vnx.si";
const DAY = 24 * 60 * 60 * 1000;
const OPS = "/ops/marketplace/requests";
const T = tag();
const esc = (s: string) => s.replace(/'/g, "&#39;");

// ---------------------------------------------------------------- helpers

let ipSeq = 0;
const freshIp = () => `203.0.113.${(ipSeq++ % 250) + 1}`;
const send = (path: string, fields: Record<string, string | string[]>, cookie?: string, env: Bindings = boardEnv) =>
  app().request(formPost(path, fields, { "cf-connecting-ip": freshIp(), "cf-ray": `ray-${tag()}`, ...(cookie ? { cookie } : {}) }), undefined, env);
const html = async (path: string, cookie?: string, env: Bindings = boardEnv) => {
  const res = await get(path, cookie, env);
  return { res, text: await res.text() };
};

/** Every public (signed-out or builder-facing) page fetched in the scenario: swept for private strings at the end. */
const seen: { label: string; text: string; allow?: string[] }[] = [];
async function pub(path: string, cookie?: string, env: Bindings = boardEnv, allow?: string[]) {
  const out = await html(path, cookie, env);
  seen.push({ label: `${cookie ? "signed-in" : "signed-out"} ${path} -> ${out.res.status}`, text: out.text, allow });
  return out;
}

/** The Hub invitations list is the builder's own M6 invitation: it names the request as the client typed it. Every other private string still fails the sweep. */
const hubPage = (cookie: string) => pub("/hub/invitations", cookie, boardEnv, [main.title]);

async function opsMember(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

const queueCard = (page: string, queue: string) => {
  const start = page.indexOf(`data-queue="${queue}"`);
  expect(start, queue).toBeGreaterThan(-1);
  const rest = page.slice(start);
  return rest.slice(0, rest.indexOf("</div>"));
};
const queueCount = (page: string, queue: string) => Number(/<span class="ops-queue-num">(\d+)<\/span>/.exec(queueCard(page, queue))?.[1] ?? "NaN");
const opsRow = (page: string, requestId: string) => new RegExp(`<tr>(?:(?!</tr>)[\\s\\S])*?href="${OPS}/${requestId}[?"](?:(?!</tr>)[\\s\\S])*?</tr>`).exec(page)?.[0] ?? "";
const interestsBlock = (page: string) => {
  const start = page.indexOf('<section id="ib-block"');
  if (start < 0) return "";
  const rest = page.slice(start);
  const end = rest.indexOf('<section class="ops-card', 20);
  return end < 0 ? rest : rest.slice(0, end);
};
const hubSection = (page: string) => /<section[^>]*id="interests"[^>]*>([\s\S]*?)<\/section>/.exec(page)?.[1] ?? "";
const sitemap = async () => (await app().request(getReq("/sitemap.xml"), undefined, boardEnv)).text();
const audits = (entityId: string) =>
  testEnv.DB.prepare("SELECT action, actor_user_id, data FROM audit_log WHERE entity_id = ?1 AND (action LIKE 'request_publication.%' OR action LIKE 'request_interest.%') ORDER BY id")
    .bind(entityId)
    .all<{ action: string; actor_user_id: string | null; data: string }>()
    .then((r) => r.results);
const actionsOf = async (entityId: string) => (await audits(entityId)).map((a) => a.action);
const pubRow = async (requestId: string) => (await findPublicationByRequestId(testEnv.DB, requestId))!;
const inviteRows = (requestId: string) => testEnv.DB.prepare("SELECT id, builder_id FROM request_invites WHERE request_id = ?1").bind(requestId).all<{ id: string; builder_id: string }>().then((r) => r.results);

const ORIGINAL_DESCRIPTION = "We need online booking with SMS reminders for three salons in Hanoi, with a calendar per stylist.";
const form = (o: Record<string, string | string[]> = {}) => ({ title: "Booking app for three salons", description: ORIGINAL_DESCRIPTION, category: "booking", budgetBand: "2k-10k", deadline: "", languages: ["vi", "en"], name: "Minh Tran", ...o });

type Client = { requestId: string; email: string; cookie: string; clientId: string; name: string; title: string; publicId: string; secrets: string[] };

/** A signed-in client posts /request with the opt-in box ticked and country VN; the listing waits for review. */
async function optedInClient(label: string, o: { title?: string; description?: string } = {}): Promise<Client> {
  const email = `rbg-${label}-${T}@vnx.si`;
  const name = `ZQX-CLIENT-NAME-${label}-${T}`;
  const title = o.title ?? `Booking app for three salons ${label} ${T}`;
  const { user, cookie } = await signIn(email);
  const res = await send("/request", form({ name, title, description: o.description ?? ORIGINAL_DESCRIPTION, publish: "1", country: "VN" }), cookie);
  expect(res.status, label).toBe(303);
  const [request] = await listClientRequests(testEnv.DB, user.id);
  const publication = await pubRow(request!.id);
  expect(publication.status).toBe("pending_review");
  return { requestId: request!.id, email, cookie, clientId: user.id, name, title, publicId: publication.publicId, secrets: [request!.id, user.id, email, name] };
}

/** Ops edits nothing and publishes the wording the client entered, or the given wording. Returns the response. */
async function opsPublish(cookie: string, c: Client, wording?: { title: string; description: string }, env: Bindings = boardEnv) {
  const pub = await pubRow(c.requestId);
  const item = (await findAdminRequest(testEnv.DB, c.requestId))!;
  return send(`${OPS}/${c.requestId}/publication/publish`, { updated_at: pub.updatedAt, public_title: wording?.title ?? item.request.title, public_description: wording?.description ?? item.request.description }, cookie, env);
}

async function approvedBuilder(label: string) {
  const email = `rbg-b-${label}-${T}@vnx.si`;
  const builder = await makeBuilder(email, `rbg${label}${T}`.slice(0, 30), "approved", { name: `Builder ${label} ${T}` });
  return { builder, cookie: (await signIn(email)).cookie, email };
}
const interestOf = async (requestId: string, builderId: string) => (await testEnv.DB.prepare("SELECT id FROM request_interests WHERE request_id = ?1 AND builder_id = ?2").bind(requestId, builderId).first<{ id: string }>())?.id ?? "";

// The scenario's state.
let ops: { user: { id: string }; cookie: string };
let main: Client; // signed out at the start; confirms by e-mail
let second: Client; // published unedited, then withdrawn
const fill: { publicId: string; requestId: string }[] = [];
const secretsOf: Client[] = []; // the clients of the gate-off step, for the final sweep
let A: Awaited<ReturnType<typeof approvedBuilder>>;
let B: Awaited<ReturnType<typeof approvedBuilder>>;
const EDITED = { title: `Online booking for hair salons ${T}`, description: `A booking app for three small salons, with a calendar per stylist and reminders by SMS. ${T}` };
const NOTE_A = `ZQX-NOTE-A-${T} I shipped two booking apps`;
let invitedLinkId = "";
let closedAt = "";

beforeAll(async () => {
  await boardFlag(true);
  ops = await opsMember(`rbg-ops-${T}@vnx.si`, "operator");
});
afterAll(() => boardFlag(false));

// ---------------------------------------------------------------- the lifecycle

describe("EPIC 27 exit gate: one request, whole life, over HTTP", { timeout: 60_000 }, () => {
  it("1. a signed-out client ticks the box on /request (country VN): hidden everywhere until the e-mail is confirmed, then waiting in the Ops queue", async () => {
    const page = await pub("/request");
    expect(page.text).toContain('name="publish"');
    expect(page.text).toContain('name="country"');
    const email = `rbg-main-${T}@request.example`;
    const name = `ZQX-CLIENT-NAME-main-${T}`;
    const title = `ZQX-ORIGINAL-TITLE-${T} booking app`;
    const description = `ZQX-ORIGINAL-DESCRIPTION-${T} ${ORIGINAL_DESCRIPTION}`;
    const res = await send("/request", { ...form({ name, title, description, email, publish: "1", country: "VN" }), [TURNSTILE_FIELD]: FAKE_TURNSTILE_PASS });
    expect(res.status).toBe(200);
    const user = (await findUserByEmail(testEnv.DB, email))!;
    const [pending] = await listClientRequests(testEnv.DB, user.id);
    expect(pending).toMatchObject({ status: "pending_verification", country: "VN" });
    const publication = await pubRow(pending!.id);
    expect(publication).toMatchObject({ status: "pending_review", consentVersion: GO_LIVE });
    main = { requestId: pending!.id, email, cookie: "", clientId: user.id, name, title, publicId: publication.publicId, secrets: [pending!.id, user.id, email, name, title, description] };
    // Not confirmed: nothing public, nothing for staff.
    expect((await pub(`/requests/${main.publicId}`)).res.status).toBe(404);
    expect(outbox.map((m) => m.to)).toEqual([email]);
    const link = /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(outbox[0]!.text)![0];
    const done = await followMagicLink(app(), link, boardEnv);
    expect(done.status).toBe(303);
    expect((await findRequestById(testEnv.DB, main.requestId))?.status).toBe("submitted");
    main.cookie = (await signIn(email)).cookie;
    // Still private: pending_review is not public.
    expect((await pub(`/requests/${main.publicId}`)).res.status).toBe(404);
    expect(mainOf((await pub("/requests")).text)).not.toContain(main.publicId);
    expect(await actionsOf(main.requestId)).toEqual(["request_publication.opt_in"]);
    await testEnv.DB.prepare("UPDATE requests SET admin_note = ?2 WHERE id = ?1").bind(main.requestId, `ZQX-ADMIN-NOTE-${T}`).run();
    main.secrets.push(`ZQX-ADMIN-NOTE-${T}`);
  });

  it("2. Ops sees it: the queue card, the ?public=pending filter, the request's Public listing block (and a second client's listing next to it)", async () => {
    second = await optedInClient("second");
    const overview = (await html("/ops", ops.cookie)).text;
    expect(queueCount(overview, "publicRequests")).toBe(2);
    expect(queueCard(overview, "publicRequests")).toContain("Public requests to review");
    const filtered = mainOf((await html(`${OPS}?public=pending`, ops.cookie)).text);
    expect(opsRow(filtered, main.requestId)).toContain("Review");
    expect(opsRow(filtered, second.requestId)).not.toBe("");
    const detail = mainOf((await html(`${OPS}/${main.requestId}`, ops.cookie)).text);
    expect(detail).toContain('id="pl-block"');
    expect(detail).toContain(en["ops.board.status.pending_review"]);
    expect(detail).toContain(`action="${OPS}/${main.requestId}/publication/publish"`);
  });

  it("3. Ops edits the wording and publishes: one audit row, the client's e-mail says it was edited, and the public link opens signed out", async () => {
    clearOutbox();
    const res = await opsPublish(ops.cookie, main, EDITED);
    expect(res.status).toBe(303);
    expect((await pubRow(main.requestId)).status).toBe("published");
    expect(await actionsOf(main.requestId)).toEqual(["request_publication.opt_in", "request_publication.publish"]);
    expect(outbox).toHaveLength(1);
    const expected = requestBoardPublishedEmail("en", { title: main.title, edited: true, publicUrl: `https://vnx.si/requests/${main.publicId}`, manageUrl: `https://vnx.si/me/requests/${main.requestId}` });
    expect(outbox[0]).toMatchObject({ to: main.email, subject: expected.subject, text: expected.text });
    expect(outbox[0]!.text).toContain("edited the title or description");
    // The link in the e-mail, opened signed out.
    const link = new URL(/https:\/\/vnx\.si\/requests\/[^\s]+/.exec(outbox[0]!.text)![0]);
    const opened = await pub(link.pathname);
    expect(opened.res.status).toBe(200);
    expect(mainOf(opened.text)).toContain(EDITED.title);
    expect(mainOf(opened.text)).toContain(en["board.status.open"]);
    // The queue is empty of it, and the second listing is published without an edit: the other e-mail, no mention of an edit.
    clearOutbox();
    expect((await opsPublish(ops.cookie, second)).status).toBe(303);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.text).not.toContain("edited the title or description");
    expect(outbox[0]!.subject).toBe(requestBoardPublishedEmail("en", { title: second.title, edited: false, publicUrl: "", manageUrl: "" }).subject);
    expect(await actionsOf(second.requestId)).toEqual(["request_publication.opt_in", "request_publication.publish"]);
    expect(queueCount((await html("/ops", ops.cookie)).text, "publicRequests")).toBe(0);
  });

  it("4. public list, detail and sitemap show the listing in four locales, with no identity; /requests is indexed only from 5 open listings", async () => {
    const list = await pub("/requests");
    expect(list.res.status).toBe(200);
    expect(mainOf(list.text)).toContain(`href="/requests/${main.publicId}"`);
    expect(mainOf(list.text)).toContain(EDITED.title);
    // Fewer than 5 open: noindex, no canonical (compared by difference: this file's DB holds only this scenario).
    expect(await countOpenPublicationsAll(testEnv.DB)).toBe(2);
    expect(list.text).toContain('<meta name="robots" content="noindex"');
    expect(list.text).not.toContain('rel="canonical"');
    let xml = await sitemap();
    expect(xml).not.toContain("<loc>https://vnx.si/requests</loc>");
    for (const locale of LOCALES) {
      expect(xml, locale).toContain(`<loc>https://vnx.si${localizedPath(locale, `/requests/${main.publicId}`)}</loc>`);
      const detail = await pub(localizedPath(locale, `/requests/${main.publicId}`));
      expect(detail.res.status, locale).toBe(200);
    }
    const detail = await pub(`/requests/${main.publicId}`);
    expect(detail.text).toContain(`<link rel="canonical" href="https://vnx.si/requests/${main.publicId}"`);
    expect(detail.text).toContain('<link rel="alternate" hreflang="vi"');
    expect(detail.text).not.toContain('content="noindex"');
    const counted = countD1Queries(boardEnv);
    expect((await app().request(getReq(`/requests/${main.publicId}`), undefined, counted.env)).status).toBe(200);
    expect(counted.queries()).toBeLessThanOrEqual(8);
    // Top up to the threshold with rows written straight to the DB, then the list is indexable and in the sitemap.
    while ((await countOpenPublicationsAll(testEnv.DB)) < MIN_OPEN_FOR_INDEX) fill.push(await listed({ tag: `fill${fill.length}${T}` }));
    expect(await countOpenPublicationsAll(testEnv.DB)).toBe(MIN_OPEN_FOR_INDEX);
    const indexed = await pub("/requests");
    expect(indexed.text).not.toContain('<meta name="robots" content="noindex"');
    expect(indexed.text).toContain('rel="canonical" href="https://vnx.si/requests"');
    xml = await sitemap();
    for (const locale of LOCALES) expect(xml, locale).toContain(`<loc>https://vnx.si${localizedPath(locale, "/requests")}</loc>`);
    for (const secret of main.secrets) expect(xml, secret).not.toContain(secret);
    expect((await pub("/robots.txt")).text).not.toMatch(/Disallow: \/requests/);
  });

  it("5. /privacy and /terms serve the real board text from B - 14 days (B = this scenario's go-live), in English and Vietnamese", async () => {
    const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const text = async (path: string) => {
      const out = await html(path);
      expect(out.res.status, path).toBe(200);
      return decode(mainOf(out.text)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    };
    const ANY_BOARD = /public request board|bảng nhu cầu công khai/;
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2025-12-17T23:59:59.999Z")); // one millisecond before B - 14 days
      expect(await text("/privacy")).not.toMatch(ANY_BOARD);
      expect(await text("/terms")).not.toMatch(ANY_BOARD);
      vi.setSystemTime(new Date("2025-12-18T00:00:00.000Z"));
      const privacy = await text("/privacy");
      expect(privacy).toContain("Public requests: if you choose to show a request on our public request board");
      expect(privacy).toContain("When a builder tells us they are interested in a public request, only our team sees it. The client does not see it unless we invite that builder.");
      expect(privacy).toContain(`Last updated: ${GO_LIVE}`);
      const terms = await text("/terms");
      expect(terms).toContain("Public requests. You can choose to show a request on our public request board.");
      expect(terms).toContain(`Last updated: ${GO_LIVE}`);
      expect(await text("/vi/privacy")).toContain("Nhu cầu công khai: nếu bạn chọn hiện một nhu cầu trên bảng nhu cầu công khai");
      expect(await text("/vi/terms")).toContain("Nhu cầu công khai. Bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai.");
    } finally {
      vi.useRealTimers();
    }
    // With the real clock (past B) the same text is live.
    expect(await text("/privacy")).toContain("public request board");
  });

  it("6. an approved builder tells us they are interested (note and product): pending; the client sees nothing and gets no e-mail; Ops sees the card, the filter and the block", async () => {
    A = await approvedBuilder("a");
    B = await approvedBuilder("b");
    const product = await addLiveProduct(A.builder, `Salon Booker ${T}`);
    // ADR-004 (before): the suggestions table and the score of the builder who is about to be interested.
    const suggestionsOf = (page: string) => /<section[^>]*aria-labelledby="ops-suggestions-h"[\s\S]*?<\/section>/.exec(page)?.[0] ?? "";
    const before = suggestionsOf((await html(`${OPS}/${main.requestId}?interests=pending`, ops.cookie)).text); // same query as after: the filter is carried in the links
    expect(before).not.toBe("");
    clearOutbox();
    const signedOutCta = await pub(`/requests/${main.publicId}`);
    expect(signedOutCta.text).toContain(esc(en["board.cta.signedOut"]));
    expect(signedOutCta.text).toContain(`/login?next=${encodeURIComponent(`/requests/${main.publicId}`)}`);
    const sent = await send(`/requests/${main.publicId}/interest`, { note: NOTE_A, productId: product.id }, A.cookie);
    expect(sent.status).toBe(303);
    expect((await send(`/requests/${main.publicId}/interest`, { note: "", productId: "" }, B.cookie)).status).toBe(303);
    const idA = await interestOf(main.requestId, A.builder.userId);
    const idB = await interestOf(main.requestId, B.builder.userId);
    expect(await findInterestById(testEnv.DB, idA)).toMatchObject({ status: "pending", note: NOTE_A, productId: product.id });
    expect(await actionsOf(idA)).toEqual(["request_interest.create"]);
    expect(outbox).toEqual([]); // no e-mail to the client, to Ops or to the builders
    // The builder's own view and Hub.
    expect(mainOf((await pub(`/requests/${main.publicId}`, A.cookie)).text)).toContain(esc(en["board.interest.sent"]));
    expect(hubSection((await hubPage(A.cookie)).text)).toContain(en["hub.interests.pending"]);
    // The client does not see it, neither on the page of the request nor in anything with a builder's name.
    const clientPage = (await html(`/me/requests/${main.requestId}`, main.cookie)).text;
    for (const hidden of [NOTE_A, A.builder.handle, "Builder a", `Builder b ${T}`, esc(en["ops.interests.title"])]) expect(clientPage, hidden).not.toContain(hidden);
    // Ops: the card, the filter, the block (note escaped by the view), and the suggestions are byte-identical (ADR-004).
    const overview = (await html("/ops", ops.cookie)).text;
    expect(queueCount(overview, "interests")).toBe(2);
    expect(queueCard(overview, "interests")).toContain("Interests waiting");
    const filtered = mainOf((await html(`${OPS}?interests=pending`, ops.cookie)).text);
    expect(opsRow(filtered, main.requestId)).not.toBe("");
    const detail = (await html(`${OPS}/${main.requestId}?interests=pending`, ops.cookie)).text;
    const block = interestsBlock(detail);
    expect(block).toContain(`Builder a ${T}`);
    expect(block).toContain(NOTE_A);
    expect(block).toContain(`href="/p/${product.slug}"`);
    expect(suggestionsOf(detail)).toBe(before);
    const item = (await findAdminRequest(testEnv.DB, main.requestId))!;
    const { suggestions, scores } = await requestMatching(testEnv.DB, item);
    const since = new Date(Date.now() - EXPIRED_PENALTY_WINDOW_MS).toISOString();
    const plain = suggestBuilders(item.request, await listCandidates(testEnv.DB, item.request, since));
    expect(suggestions!.map((x) => [x.candidate.userId, x.score])).toEqual(plain.map((x) => [x.candidate.userId, x.score]));
    expect(scores.get(A.builder.userId)).toBe(plain.find((x) => x.candidate.userId === A.builder.userId)?.score);
  });

  it("7. Ops invites builder A: the interest flips with one audit row, A's Hub says Invited with the link, the public page shows the invitation; Dismiss on B shows 'Not invited' and sends nothing", async () => {
    const idA = await interestOf(main.requestId, A.builder.userId);
    const idB = await interestOf(main.requestId, B.builder.userId);
    clearOutbox();
    const invited = await send(`${OPS}/${main.requestId}/invite`, { builder: A.builder.userId }, ops.cookie);
    expect(invited.status).toBe(303);
    expect(await findInterestById(testEnv.DB, idA)).toMatchObject({ status: "invited", decidedBy: ops.user.id });
    expect(await actionsOf(idA)).toEqual(["request_interest.create", "request_interest.invite"]);
    const invites = await inviteRows(main.requestId);
    expect(invites.map((i) => i.builder_id)).toEqual([A.builder.userId]);
    invitedLinkId = invites[0]!.id;
    expect(outbox.map((m) => m.to)).toEqual([A.email]); // the existing M6 invitation e-mail, and only that
    const hub = hubSection((await hubPage(A.cookie)).text);
    expect(hub).toContain(en["hub.interests.invited"]);
    expect(hub).toContain(`href="/hub/invitations/${invitedLinkId}"`);
    const page = await pub(`/requests/${main.publicId}`, A.cookie);
    expect(page.text).toContain(esc(en["board.interest.invited"]));
    expect(page.text).toContain(`href="/hub/invitations/${invitedLinkId}"`);
    // Dismiss B: one audit row, no e-mail, B sees Not invited on the Hub and on the page.
    clearOutbox();
    const dismissed = await send(`${OPS}/${main.requestId}/interests/${idB}/dismiss`, { updated_at: (await findInterestById(testEnv.DB, idB))!.updatedAt }, ops.cookie);
    expect(dismissed.status).toBe(303);
    expect(await findInterestById(testEnv.DB, idB)).toMatchObject({ status: "dismissed", decidedBy: ops.user.id });
    expect(await actionsOf(idB)).toEqual(["request_interest.create", "request_interest.dismiss"]);
    expect(outbox).toEqual([]);
    expect(hubSection((await hubPage(B.cookie)).text)).toContain(en["hub.interests.notInvited"]);
    expect(mainOf((await pub(`/requests/${main.publicId}`, B.cookie)).text)).toContain(esc(en["board.interest.notInvited"]));
    // The waiting count is back to zero, and the audit rows carry ids only, never the note or a name.
    expect(queueCount((await html("/ops", ops.cookie)).text, "interests")).toBe(0);
    for (const row of [...(await audits(idA)), ...(await audits(idB))]) {
      expect(row.data).not.toContain(NOTE_A);
      expect(row.data).not.toContain(`Builder a ${T}`);
    }
  });

  it("8. the builder proposes (M6) and the client selects: the request ends, the page turns Closed + noindex and leaves the list and the sitemap; the list drops below 5 and goes noindex", async () => {
    const [invite] = (await listRequestInvites(testEnv.DB, main.requestId)).map((x) => x.invite);
    await proposeOn(invite!);
    clearOutbox();
    const selected = await send(`/me/requests/${main.requestId}/select`, { invite: invite!.id }, main.cookie);
    expect(selected.status).toBe(303);
    const ended = (await findRequestById(testEnv.DB, main.requestId))!;
    expect(ended.status).toBe("builder_selected");
    closedAt = ended.closedAt!;
    expect(closedAt).toBeTruthy();
    const detail = await pub(`/requests/${main.publicId}`);
    expect(detail.res.status).toBe(200);
    expect(mainOf(detail.text)).toContain(en["board.status.closed"]);
    expect(mainOf(detail.text)).toContain(esc(en["board.cta.closed"]));
    expect(detail.text).toContain('<meta name="robots" content="noindex"');
    expect(detail.text).not.toContain('rel="canonical"');
    expect(detail.text).not.toContain('<link rel="alternate"');
    expect(mainOf(detail.text)).not.toContain(`/requests/${main.publicId}/interest`);
    expect(mainOf(detail.text)).not.toMatch(/builder_selected|Builder selected/i);
    expect(mainOf((await pub("/requests")).text)).not.toContain(main.publicId);
    // The invited builder's page no longer offers anything; B's Hub still says Not invited.
    expect(mainOf((await pub(`/requests/${main.publicId}`, A.cookie)).text)).not.toContain(`/requests/${main.publicId}/interest`);
    expect(hubSection((await hubPage(B.cookie)).text)).toContain(en["hub.interests.notInvited"]);
    // Indexability by difference: 5 open before, 4 now.
    expect(await countOpenPublicationsAll(testEnv.DB)).toBe(MIN_OPEN_FOR_INDEX - 1);
    const list = await pub("/requests");
    expect(list.text).toContain('<meta name="robots" content="noindex"');
    expect(list.text).not.toContain('rel="canonical"');
    const xml = await sitemap();
    expect(xml).not.toContain(main.publicId);
    expect(xml).not.toContain("<loc>https://vnx.si/requests</loc>");
  });

  it("9. a closed request is shown for 30 days and is a 404 from closed_at + 30 days (UTC), and stays out of the sitemap", async () => {
    const at = Date.parse(closedAt);
    expect(CLOSED_VISIBLE_DAYS).toBe(30);
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(at + 30 * DAY - 1));
      const last = await pub(`/requests/${main.publicId}`);
      expect(last.res.status).toBe(200);
      expect(mainOf(last.text)).toContain(en["board.status.closed"]);
      vi.setSystemTime(new Date(at + 30 * DAY));
      expect((await pub(`/requests/${main.publicId}`)).res.status).toBe(404);
      expect((await sitemap()).includes(main.publicId)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("10. the withdraw path: the client withdraws a published listing and it is a 404 at once, signed in and signed out, with one audit row and the list and sitemap cleared", async () => {
    expect((await pub(`/requests/${second.publicId}`)).res.status).toBe(200);
    expect(mainOf((await pub("/requests")).text)).toContain(second.publicId);
    expect(await sitemap()).toContain(second.publicId);
    const builderCookie = A.cookie;
    const res = await send(`/me/requests/${second.requestId}/publication/withdraw`, {}, second.cookie);
    expect(res.status).toBe(303);
    expect((await pubRow(second.requestId)).status).toBe("withdrawn");
    expect(await actionsOf(second.requestId)).toEqual(["request_publication.opt_in", "request_publication.publish", "request_publication.withdraw"]);
    for (const cookie of [undefined, second.cookie, builderCookie, ops.cookie]) expect((await pub(`/requests/${second.publicId}`, cookie)).res.status, String(cookie)).toBe(404);
    expect(mainOf((await pub("/requests")).text)).not.toContain(second.publicId);
    expect(await sitemap()).not.toContain(second.publicId);
    // Withdrawing again is refused and writes nothing.
    expect((await send(`/me/requests/${second.requestId}/publication/withdraw`, {}, second.cookie)).status).toBe(409);
    expect(await actionsOf(second.requestId)).toHaveLength(3);
  });

  it("11. the gate off (flag): every public surface is a 404 and out of the sitemap; Ops cannot publish (409, no e-mail, no audit row) but still rejects with a reason (e-mail sent); Dismiss and the client's withdraw still work", async () => {
    // Set up while the board is on: a listing with a pending interest, a listing waiting for review, a published listing to unpublish, one to withdraw.
    const hold = await optedInClient("hold");
    expect((await opsPublish(ops.cookie, hold)).status).toBe(303);
    const C = await approvedBuilder("c");
    expect((await send(`/requests/${hold.publicId}/interest`, { note: "", productId: "" }, C.cookie)).status).toBe(303);
    const idC = await interestOf(hold.requestId, C.builder.userId);
    const waiting = await optedInClient("waiting");
    const unpub = await optedInClient("unpub");
    expect((await opsPublish(ops.cookie, unpub)).status).toBe(303);
    const gone = await optedInClient("gone");
    expect((await opsPublish(ops.cookie, gone)).status).toBe(303);
    expect((await pub(`/requests/${hold.publicId}`)).res.status).toBe(200);

    await boardFlag(false);
    try {
      for (const path of ["/requests", `/requests/${hold.publicId}`, `/vi/requests/${hold.publicId}`]) expect((await pub(path)).res.status, path).toBe(404);
      expect((await send(`/requests/${hold.publicId}/interest`, { note: "", productId: "" }, A.cookie)).status).toBe(404);
      expect((await send(`/requests/${hold.publicId}/interest/withdraw`, {}, C.cookie)).status).toBe(404);
      const xml = await sitemap();
      expect(xml).not.toContain(hold.publicId);
      expect(xml).not.toMatch(/\/requests/);
      expect((await pub("/")).text).not.toContain('href="/requests"');
      expect((await pub("/request")).text).not.toContain('name="publish"');
      // The Hub still shows the state, with the title and no link.
      const hubC = hubSection((await hubPage(C.cookie)).text);
      expect(hubC).toContain(en["hub.interests.pending"]);
      expect(hubC).not.toContain(`/requests/${hold.publicId}`);

      // Publish is refused: the page would be a 404. Nothing written, no e-mail.
      clearOutbox();
      const before = await actionsOf(waiting.requestId);
      const refused = await opsPublish(ops.cookie, waiting);
      expect(refused.status).toBe(409);
      expect((await pubRow(waiting.requestId)).status).toBe("pending_review");
      expect(await actionsOf(waiting.requestId)).toEqual(before);
      expect(outbox).toEqual([]);
      expect(mainOf((await html(`${OPS}/${waiting.requestId}`, ops.cookie)).text)).not.toContain(`action="${OPS}/${waiting.requestId}/publication/publish"`);
      // Reject with a reason still works, and the client is told why.
      const rejected = await send(`${OPS}/${waiting.requestId}/publication/reject`, { updated_at: (await pubRow(waiting.requestId)).updatedAt, review_note: "Names a customer: please remove it." }, ops.cookie);
      expect(rejected.status).toBe(303);
      expect((await pubRow(waiting.requestId)).status).toBe("rejected");
      expect(outbox).toHaveLength(1);
      expect(outbox[0]!.text).toBe(requestBoardRejectedEmail("en", { title: waiting.title, reason: "Names a customer: please remove it.", url: `https://vnx.si/me/requests/${waiting.requestId}` }).text);
      expect(await actionsOf(waiting.requestId)).toEqual(["request_publication.opt_in", "request_publication.reject"]);
      // Unpublish with a reason still works too.
      clearOutbox();
      const unpublished = await send(`${OPS}/${unpub.requestId}/publication/unpublish`, { updated_at: (await pubRow(unpub.requestId)).updatedAt, review_note: "No longer fits the board." }, ops.cookie);
      expect(unpublished.status).toBe(303);
      expect((await pubRow(unpub.requestId)).status).toBe("unpublished");
      expect(outbox[0]!.text).toBe(requestBoardUnpublishedEmail("en", { title: unpub.title, reason: "No longer fits the board.", url: `https://vnx.si/me/requests/${unpub.requestId}` }).text);
      // Dismiss still works with the gate off; the builder's Hub says Not invited.
      clearOutbox();
      const dismissed = await send(`${OPS}/${hold.requestId}/interests/${idC}/dismiss`, { updated_at: (await findInterestById(testEnv.DB, idC))!.updatedAt }, ops.cookie);
      expect(dismissed.status).toBe(303);
      expect((await findInterestById(testEnv.DB, idC))!.status).toBe("dismissed");
      expect(await actionsOf(idC)).toEqual(["request_interest.create", "request_interest.dismiss"]);
      expect(outbox).toEqual([]);
      expect(hubSection((await hubPage(C.cookie)).text)).toContain(en["hub.interests.notInvited"]);
      // The client's withdraw never reads the flag.
      expect((await send(`/me/requests/${gone.requestId}/publication/withdraw`, {}, gone.cookie)).status).toBe(303);
      expect((await pubRow(gone.requestId)).status).toBe("withdrawn");
      expect(await actionsOf(gone.requestId)).toEqual(["request_publication.opt_in", "request_publication.publish", "request_publication.withdraw"]);
      // The date is a gate of its own: flag back on but no go-live date is still a 404.
      await boardFlag(true);
      expect((await pub(`/requests/${hold.publicId}`, undefined, { ...boardEnv, REQUEST_BOARD_GO_LIVE: "" })).res.status).toBe(404);
      expect((await pub(`/requests/${hold.publicId}`)).res.status).toBe(200);
    } finally {
      await boardFlag(true);
    }
    secretsOf.push(hold, waiting, unpub, gone);
  });

  it("12. nothing private on any public page of the scenario, and no audit row of the board carries wording, a note or a name", async () => {
    expect(seen.length).toBeGreaterThan(30);
    const everyone = [main, second, ...secretsOf];
    for (const page of seen) {
      for (const c of everyone) for (const secret of c.secrets) if (!page.allow?.includes(secret)) expect(page.text, `${page.label}: ${secret}`).not.toContain(secret);
      expect(page.text, page.label).not.toContain(`ZQX-NOTE-A-${T}`);
      expect(page.text, page.label).not.toContain(`ZQX-ADMIN-NOTE-${T}`);
    }
    const rows = await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE action LIKE 'request_publication.%' OR action LIKE 'request_interest.%'").all<{ action: string; data: string }>();
    expect(rows.results.length).toBeGreaterThan(15);
    for (const row of rows.results) {
      for (const word of [`ZQX-`, EDITED.title, EDITED.description, "Names a customer", "No longer fits", `Builder a ${T}`, ORIGINAL_DESCRIPTION]) expect(row.data, `${row.action}: ${word}`).not.toContain(word);
    }
  });
});
