import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { auditStatement } from "../../src/db/audit.ts";
import { declineInviteStatement, listRequestInvites, proposeStatement, returnedInvite } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { inviteBuilders, makeBuilder, makeInquiry, makeRequest, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const proposal = { approach: "Next.js with a booking calendar and SMS reminders.", priceMode: "range", price: "3000", priceMax: "5000", priceNote: "Hosting not included", timelineDays: "30" };
const inviteOf = async (requestId: string) => (await listRequestInvites(testEnv.DB, requestId))[0]!.invite;
const audits = async (inviteId: string) => (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'request_invite' AND entity_id = ?1").bind(inviteId).first<{ n: number }>())?.n ?? 0;

async function invitedPair(tag: string) {
  const { client, request } = await makeRequest({ tag });
  const builder = await makeBuilder(`${tag}-b@vnx.si`, `${tag}-b`, "approved");
  const [invite] = await inviteBuilders(request, [builder]);
  const { cookie } = await signIn(`${tag}-b@vnx.si`);
  return { client, request, builder, invite: invite!, cookie };
}

/** Nothing was written for this invitation: still `invited`, no audit row, no e-mail. */
async function expectUntouched(requestId: string, inviteId: string) {
  expect((await inviteOf(requestId)).status).toBe("invited");
  expect(await audits(inviteId)).toBe(0);
  expect(outbox).toEqual([]);
}

describe("Hub invitations (spec §5.3, §5.7 step 3)", () => {
  beforeEach(() => clearOutbox());

  it("lists the builder's own invitations, counts those waiting on the overview, links the tab", async () => {
    const { request, invite, cookie } = await invitedPair("hi-list");
    const other = await invitedPair("hi-list2");
    const res = await get("/hub/invitations", cookie);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain(`href="/hub/invitations/${invite.id}"`);
    expect(html).toContain(request.title);
    expect(html).not.toContain(other.invite.id);
    expect(html).toContain('href="/hub/invitations"');
    expect(await (await get("/hub", cookie)).text()).toContain("Invitations waiting for your reply: 1");
  });

  it("shows the request and the client's typed name with the reply-by date", async () => {
    const { invite, cookie } = await invitedPair("hi-page");
    const res = await get(`/hub/invitations/${invite.id}`, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("Request from Minh Tran");
    expect(html).toContain("We need online booking with SMS reminders");
    expect(html).toContain(`Reply by ${new Date(Date.parse(invite.invitedAt) + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)}.`);
  });

  // Review Focus 1: a client who types their e-mail as their name must not leak it, on any /hub/invitations* page.
  it("never shows the client's e-mail, even when the client typed it as their name", async () => {
    const { client, request, invite, cookie } = await invitedPair("hi-leak");
    await testEnv.DB.prepare("UPDATE requests SET client_name = ?2 WHERE id = ?1").bind(request.id, client.email).run();
    const bad = await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, approach: "" });
    expect(bad.status).toBe(400);
    const badDecline = await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "x".repeat(1001) });
    expect(badDecline.status).toBe(400);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(303);
    const pages = [await (await get("/hub/invitations", cookie)).text(), await (await get(`/hub/invitations/${invite.id}`, cookie)).text(), await bad.text(), await badDecline.text()];
    for (const html of pages) expect(html).not.toContain(client.email);
    expect(pages[1]).toContain("Request from •••");
    expect(pages[1]).toContain("Posted by");
  });

  // Review Focus 2.
  it("404s for another builder, a builder never invited and a removed request; nothing is written", async () => {
    const { request, invite } = await invitedPair("hi-404");
    await makeBuilder("hi-404-x@vnx.si", "hi-404-x", "approved");
    const { cookie: other } = await signIn("hi-404-x@vnx.si");
    expect((await get(`/hub/invitations/${invite.id}`, other)).status).toBe(404);
    expect(await (await get("/hub/invitations", other)).text()).not.toContain(invite.id);
    expect((await post(`/hub/invitations/${invite.id}/propose`, other, proposal)).status).toBe(404);
    expect((await post(`/hub/invitations/${invite.id}/decline`, other, { reason: "no" })).status).toBe(404);
    await expectUntouched(request.id, invite.id);

    const { cookie } = await signIn("hi-404-b@vnx.si");
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    expect((await get(`/hub/invitations/${invite.id}`, cookie)).status).toBe(404);
    expect(await (await get("/hub/invitations", cookie)).text()).not.toContain(invite.id);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(404);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(404);
    await expectUntouched(request.id, invite.id);
  });

  it("sends signed-out visitors to sign in and people without a builder profile to the application", async () => {
    const { invite } = await invitedPair("hi-gate");
    expect((await get(`/hub/invitations/${invite.id}`)).status).toBe(303);
    const { cookie } = await signIn("hi-gate-nobuilder@vnx.si");
    const res = await get(`/hub/invitations/${invite.id}`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub/apply");
  });

  it("sends a proposal once: saved, the client is told, audited; then 409 with nothing more", async () => {
    const { request, client, invite, cookie } = await invitedPair("hi-prop");
    const res = await post(`/vi/hub/invitations/${invite.id}/propose`, cookie, proposal);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/hub/invitations/${invite.id}`);
    expect(await inviteOf(request.id)).toMatchObject({ status: "proposed", priceCents: 300000, priceMaxCents: 500000, priceNote: "Hosting not included", timelineDays: 30 });
    expect((await inviteOf(request.id)).respondedAt).not.toBeNull();
    expect(outbox.map((m) => m.to)).toEqual([client.email]);
    expect(await audits(invite.id)).toBe(1);
    const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
    expect(html).toContain("Your proposal");
    expect(html).toContain("$3,000 – $5,000");
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(409);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(1);
    expect(await audits(invite.id)).toBe(1);
  });

  it("keeps the proposal when the client e-mail cannot be sent", async () => {
    const { request, invite, cookie } = await invitedPair("hi-nomail");
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal, noMail)).status).toBe(303);
    expect((await inviteOf(request.id)).status).toBe("proposed");
  });

  it("accepts a fixed price and 'to discuss' (no amount)", async () => {
    const fixed = await invitedPair("hi-fixed");
    await post(`/hub/invitations/${fixed.invite.id}/propose`, fixed.cookie, { ...proposal, priceMode: "fixed", priceMax: "" });
    expect(await inviteOf(fixed.request.id)).toMatchObject({ status: "proposed", priceCents: 300000, priceMaxCents: null });
    const discuss = await invitedPair("hi-disc");
    await post(`/hub/invitations/${discuss.invite.id}/propose`, discuss.cookie, { ...proposal, priceMode: "discuss", price: "", priceMax: "" });
    expect(await inviteOf(discuss.request.id)).toMatchObject({ status: "proposed", priceCents: null, priceMaxCents: null });
    expect(await (await get(`/hub/invitations/${discuss.invite.id}`, discuss.cookie)).text()).toContain("To discuss");
  });

  it("re-renders a broken proposal with errors and the typed values, writing nothing", async () => {
    const { request, invite, cookie } = await invitedPair("hi-bad");
    const res = await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, priceMax: "2000", timelineDays: "0" });
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("The upper bound must be higher than the lower bound.");
    expect(html).toContain("Enter a number of days from 1 to 365.");
    expect(html).toContain("Next.js with a booking calendar and SMS reminders.</textarea>");
    for (const bad of [{ approach: "  " }, { approach: "x".repeat(2001) }, { priceMode: "free" }, { price: "1000001" }, { priceNote: "n".repeat(201) }, { timelineDays: "366" }]) {
      expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, { ...proposal, priceMode: "fixed", priceMax: "", ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    await expectUntouched(request.id, invite.id);
  });

  it("declines with an optional reason: no e-mail to the client, the admin sees the reason", async () => {
    const { request, invite, cookie } = await invitedPair("hi-dec");
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "x".repeat(1001) })).status).toBe(400);
    await expectUntouched(request.id, invite.id);
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie, { reason: "Fully booked until March." })).status).toBe(303);
    expect(await inviteOf(request.id)).toMatchObject({ status: "declined", declineReason: "Fully booked until March." });
    expect(outbox).toEqual([]);
    expect(await audits(invite.id)).toBe(1);
    const admin = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect(await (await get(`/admin/requests/${request.id}`, admin)).text()).toContain("Fully booked until March.");
    expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status).toBe(409);
    expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status).toBe(409);
  });

  // Review Focus 4: only invited + matching + approved is accepted.
  it("409s a proposal or decline once the request closed, expired or was chosen, or the builder was suspended", async () => {
    for (const [ended, tag] of [["closed", "closed"], ["expired", "expired"], ["builder_selected", "sel"]]) { // tags: hyphens only (handle rule)
      const { request, invite, cookie } = await invitedPair(`hi-end-${tag}`);
      await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(request.id, ended).run();
      expect((await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal)).status, ended).toBe(409);
      expect((await post(`/hub/invitations/${invite.id}/decline`, cookie)).status, ended).toBe(409);
      await expectUntouched(request.id, invite.id);
      const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
      expect(html).toContain("This request has ended.");
      expect(html).not.toContain("/propose");
    }
    const susp = await invitedPair("hi-susp");
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(susp.builder.userId).run();
    expect((await post(`/hub/invitations/${susp.invite.id}/propose`, susp.cookie, proposal)).status).toBe(409);
    expect((await post(`/hub/invitations/${susp.invite.id}/decline`, susp.cookie)).status).toBe(409);
    const read = await get(`/hub/invitations/${susp.invite.id}`, susp.cookie);
    expect(read.status).toBe(200);
    const readHtml = await read.text();
    expect(readHtml).not.toContain("/propose");
    expect(readHtml).not.toContain("/decline");
    await expectUntouched(susp.request.id, susp.invite.id);
  });

  // The route's pre-check cannot catch a race, so every SQL guard of ANSWERABLE (and the guarded audit) is tested directly:
  // each case would write a row if its guard were missing.
  it("a lost compare-and-set writes neither the answer nor the audit row", async () => {
    type Lose = (ctx: { requestId: string; inviteId: string; builderId: string }) => Promise<string | void>; // returns the builderId to act as
    const run = (sql: string, ...args: string[]) => testEnv.DB.prepare(sql).bind(...args).run();
    const cases: [string, "propose" | "decline", Lose][] = [
      ["request closed", "propose", async ({ requestId }) => void (await run("UPDATE requests SET status = 'closed' WHERE id = ?1", requestId))],
      ["invite left invited", "propose", async ({ inviteId }) => void (await run("UPDATE request_invites SET status = 'expired' WHERE id = ?1", inviteId))],
      ["builder suspended", "propose", async ({ builderId }) => void (await run("UPDATE builders SET status = 'suspended' WHERE user_id = ?1", builderId))],
      ["user suspended", "propose", async ({ builderId }) => void (await run("UPDATE users SET status = 'suspended' WHERE id = ?1", builderId))],
      ["another builder", "propose", async () => (await makeBuilder("hi-cas-other@vnx.si", "hi-cas-other", "approved")).userId],
      ["decline, request closed", "decline", async ({ requestId }) => void (await run("UPDATE requests SET status = 'closed' WHERE id = ?1", requestId))],
      ["decline, invite left invited", "decline", async ({ inviteId }) => void (await run("UPDATE request_invites SET status = 'expired' WHERE id = ?1", inviteId))],
    ];
    for (const [i, [name, action, lose]] of cases.entries()) {
      const { request, builder, invite } = await invitedPair(`hi-cas-${i}`);
      const actAs = (await lose({ requestId: request.id, inviteId: invite.id, builderId: builder.userId })) ?? builder.userId;
      const now = new Date().toISOString();
      const statement =
        action === "propose"
          ? proposeStatement(testEnv.DB, { inviteId: invite.id, builderId: actAs, proposal: { approach: "x", priceCents: null, priceMaxCents: null, priceNote: "", timelineDays: 5 }, now })
          : declineInviteStatement(testEnv.DB, { inviteId: invite.id, builderId: actAs, reason: "no", now });
      const [moved] = await testEnv.DB.batch([
        statement,
        auditStatement(testEnv.DB, { actorUserId: actAs, action: `request_invite.${action}`, entity: "request_invite", entityId: invite.id, now }, { inviteId: invite.id, status: action === "propose" ? "proposed" : "declined", updatedAt: now }),
      ]);
      expect(returnedInvite(moved), name).toBeNull();
      const row = await inviteOf(request.id);
      expect(row.status, name).toBe(name.includes("left invited") ? "expired" : "invited");
      expect(row.approach, name).toBeNull();
      expect(row.declineReason, name).toBeNull();
      expect(await audits(invite.id), name).toBe(0);
      expect(outbox, name).toEqual([]);
    }
  });

  it("rejects a POST without a same-origin Origin header", async () => {
    const { request, invite, cookie } = await invitedPair("hi-origin");
    for (const headers of [{ cookie } as Record<string, string>, { cookie, origin: "https://evil.example" }]) {
      const res = await app().request(
        new Request(`https://vnx.si/hub/invitations/${invite.id}/propose`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(proposal) }),
        undefined,
        testEnv,
      );
      expect(res.status).toBe(403);
    }
    await expectUntouched(request.id, invite.id);
  });

  it("shows a chosen proposal as chosen, with a link to the inquiry", async () => {
    const { request, invite, cookie } = await invitedPair("hi-sel");
    // The inquiry belongs to another builder: this checks the markup only; Task 6's exit test covers the link end to end.
    const { inquiry } = await makeInquiry({ tag: "hi-sel-q", status: "open" });
    await post(`/hub/invitations/${invite.id}/propose`, cookie, proposal);
    await testEnv.DB.prepare("UPDATE request_invites SET status = 'selected', inquiry_id = ?2 WHERE id = ?1").bind(invite.id, inquiry.id).run();
    await testEnv.DB.prepare("UPDATE requests SET status = 'builder_selected' WHERE id = ?1").bind(request.id).run();
    const html = await (await get(`/hub/invitations/${invite.id}`, cookie)).text();
    expect(html).toContain("Chosen");
    expect(html).toContain(`href="/hub/inquiries/${inquiry.id}"`);
  });
});
