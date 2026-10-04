import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findAdminRequest, findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { addLiveProduct, inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string | string[]> = {}, env: Bindings = testEnv) => app().request(formPost(path, fields, { cookie }), undefined, env);
const noMail = { ...testEnv, MAIL_DRIVER: undefined } as Bindings; // UnconfiguredMailer: every send fails
const invitesOf = async (requestId: string) => (await listRequestInvites(testEnv.DB, requestId)).map((x) => x.invite);
const activeOf = (invites: { status: string }[]) => invites.filter((i) => i.status === "invited" || i.status === "proposed");
const builders = (tag: string, n: number) => Promise.all(Array.from({ length: n }, (_, i) => makeBuilder(`${tag}-${i}@vnx.si`, `${tag}-${i}`, "approved")));

/** Handles offered in the invite form's suggestion table, in order. */
function suggestedHandles(html: string): string[] {
  const form = /<form method="post" action="[^"]*\/invite">([\s\S]*?)<\/form>/.exec(html)?.[1] ?? "";
  return [...form.matchAll(/>@([a-z0-9-]+)<\/a>/g)].map((m) => m[1]!);
}

describe("admin requests (spec §5.5, §5.7 step 2, §8.10)", () => {
  beforeEach(() => clearOutbox());

  it("is admin only, and an unknown request is 404", async () => {
    const { request } = await makeRequest({ tag: "ar-auth" });
    const { cookie } = await signIn("ar-nobody@vnx.si");
    expect((await get("/admin/requests", cookie)).status).toBe(403);
    expect((await get(`/admin/requests/${request.id}`, cookie)).status).toBe(403);
    for (const action of ["invite", "reject", "remove"]) expect((await post(`/admin/requests/${request.id}/${action}`, cookie, { note: "x" })).status, action).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    const root = await admin();
    const noOrigin = await app().request(new Request(`https://vnx.si/admin/requests/${request.id}/remove`, { method: "POST", headers: { cookie: root.cookie } }), undefined, testEnv);
    expect(noOrigin.status).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    expect((await get("/admin/requests", root.cookie)).headers.get("cache-control")).toContain("no-store");
    expect((await get("/admin/requests/01J0000000000000000000NONE", root.cookie)).status).toBe(404);
    expect((await post("/admin/requests/01J0000000000000000000NONE/remove", root.cookie)).status).toBe(404);
  });

  it("queues submitted requests; shows the client's name and e-mail to the admin; filters by status", async () => {
    const { request } = await makeRequest({ tag: "ar-queue" });
    const pending = await makeRequest({ tag: "ar-queue-p", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE requests SET client_name = 'Lan (lan@x.vn)' WHERE id = ?1").bind(request.id).run();
    const { cookie } = await admin();
    const html = await (await get("/admin/requests", cookie)).text();
    expect(html).toContain(`href="/admin/requests/${request.id}"`);
    expect(html).toContain("ar-queue-c@vnx.si");
    expect(html).toContain("Lan (lan@x.vn)"); // admin pages are not builder-facing: no builderFacingName mask
    expect(html).not.toContain(pending.request.id);
    expect(await (await get("/admin/requests?status=pending_verification", cookie)).text()).toContain(pending.request.id);
    expect(await (await get("/admin/requests?status=all", cookie)).text()).toContain(pending.request.id);
    expect((await get("/admin/requests?status=bogus", cookie)).status).toBe(200);
    expect(html).toContain('href="/admin/requests"');
    const detail = await (await get(`/admin/requests/${request.id}`, cookie)).text();
    expect(detail).toContain("ar-queue-c@vnx.si");
    const answered = await makeRequest({ tag: "ar-answered" });
    const [x, y, z] = await builders("ar-answered", 3);
    const [ix, iy] = await inviteBuilders(answered.request, [x!, y!, z!]);
    await proposeOn(ix!);
    await testEnv.DB.prepare("UPDATE request_invites SET status = 'declined' WHERE id = ?1").bind(iy!.id).run();
    const { activeInvites, totalInvites, proposals } = (await findAdminRequest(testEnv.DB, answered.request.id))!;
    expect({ activeInvites, totalInvites, proposals }).toEqual({ activeInvites: 2, totalInvites: 3, proposals: 2 }); // answered: proposed + declined
    const matching = await (await get("/admin/requests?status=matching", cookie)).text();
    expect(matching).toContain(answered.request.id);
    expect(detail).toContain("Lan (lan@x.vn)");
  });

  // D1 is shared with other test files (see "Quyết định kỹ thuật"). The title carries three tokens with no common
  // substrings, so (almost) no foreign builder matches a skill. Without an hr product a builder scores at most
  // 3 skills + language + open = 5 only if it matched three skills, i.e. never; with one it can reach 6 only if it also
  // matched skills. Own builders "top" (8) and "mid" (6) both carry an hr product plus own tokens. Only relative order
  // and absence of ineligible builders are asserted.
  it("suggests eligible builders by the rules, best first, with reasons; ineligible ones are absent", async () => {
    const { client, request } = await makeRequest({
      tag: "ar-sug",
      title: "Qzarone qzartwo qzarthree tool",
      description: "A small tool for twelve people to share their shifts.",
      category: "hr",
      languages: ["zh"],
    });
    const mid = await makeBuilder("ar-sug-mid@vnx.si", "ar-sug-mid", "approved", { availability: "limited", workLanguages: ["zh"], skills: "qzarone, qzartwo" });
    await addLiveProduct(mid, "ar-sug shifts", { fields: { category: "hr" } });
    const top = await makeBuilder("ar-sug-top@vnx.si", "ar-sug-top", "approved", { availability: "open", workLanguages: ["zh"], skills: "qzarone, qzartwo, qzarthree" });
    await addLiveProduct(top, "ar-sug rota", { fields: { category: "hr" } });
    await makeBuilder("ar-sug-closed@vnx.si", "ar-sug-closed", "approved", { availability: "closed", skills: "qzarone, qzartwo, qzarthree" });
    await makeBuilder("ar-sug-pending@vnx.si", "ar-sug-pending", "pending", { skills: "qzarone, qzartwo, qzarthree" });
    await makeBuilder(client.email, "ar-sug-self", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    const locked = await makeBuilder("ar-sug-locked@vnx.si", "ar-sug-locked", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    const invited = await makeBuilder("ar-sug-inv@vnx.si", "ar-sug-inv", "approved", { skills: "qzarone, qzartwo, qzarthree" });
    await inviteBuilders(request, [invited]);
    const { cookie } = await admin();
    const html = await (await get(`/admin/requests/${request.id}`, cookie)).text();
    const suggested = suggestedHandles(html);
    expect(suggested.filter((h) => h.startsWith("ar-sug-"))).toEqual(["ar-sug-top", "ar-sug-mid"]);
    expect(suggested.length).toBeLessThanOrEqual(10);
    expect(html).toContain("product in this category +3");
    expect(html).toContain("skill “qzarthree” +1");
    expect(html).toContain("shared language +1 · open +1");
    expect(html).toContain("4 of 5 invitation slots free.");
  });

  it("invites chosen builders and one by handle (even if closed), mails them without the client's e-mail, moves to matching", async () => {
    const { request } = await makeRequest({ tag: "ar-inv" });
    const a = await makeBuilder("ar-inv-a@vnx.si", "ar-inv-a", "approved");
    const b = await makeBuilder("ar-inv-b@vnx.si", "ar-inv-b", "approved");
    await makeBuilder("ar-inv-cl@vnx.si", "ar-inv-cl", "approved", { availability: "closed" });
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [a.userId, b.userId], handle: "ar-inv-cl" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=1`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
    expect((await listRequestInvites(testEnv.DB, request.id)).map((x) => x.builderHandle)).toEqual(["ar-inv-a", "ar-inv-b", "ar-inv-cl"]);
    expect(outbox.map((m) => m.to).sort()).toEqual(["ar-inv-a@vnx.si", "ar-inv-b@vnx.si", "ar-inv-cl@vnx.si"]);
    for (const m of outbox) expect(`${m.text}${m.html}`).not.toContain("ar-inv-c@vnx.si");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("keeps the invitations but says so when an e-mail could not be sent", async () => {
    const { request } = await makeRequest({ tag: "ar-mailfail" });
    const [a] = await builders("ar-mailfail-b", 1);
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: a!.userId }, noMail);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=mail_failed`);
    expect(await invitesOf(request.id)).toHaveLength(1);
    expect(await (await get(`/admin/requests/${request.id}?done=mail_failed`, cookie)).text()).toContain("Saved, but some emails couldn&#39;t be sent.");
  });

  it("refuses no choice, an unknown handle and more builders than free slots", async () => {
    const { request } = await makeRequest({ tag: "ar-bad" });
    const four = await builders("ar-bad", 4);
    await inviteBuilders(request, four);
    const x = await makeBuilder("ar-bad-x@vnx.si", "ar-bad-x", "approved");
    const y = await makeBuilder("ar-bad-y@vnx.si", "ar-bad-y", "approved");
    const { cookie } = await admin();
    const none = await post(`/admin/requests/${request.id}/invite`, cookie, {});
    expect(none.status).toBe(400);
    expect(await none.text()).toContain("Choose at least one builder.");
    expect((await post(`/admin/requests/${request.id}/invite`, cookie, { handle: "no-such-builder" })).status).toBe(400);
    const tooMany = await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [x.userId, y.userId] });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.text()).toContain("That is more builders than the free slots.");
    expect(await invitesOf(request.id)).toHaveLength(4);
    expect(outbox).toHaveLength(0);
  });

  describe("the invitation cap and eligibility cannot be bypassed (Review Focus 3)", () => {
    it("refuses a 6th invitation, by checkbox or by handle; the full request offers no invite form", async () => {
      const { request } = await makeRequest({ tag: "ar-six" });
      await inviteBuilders(request, await builders("ar-six", 5));
      const sixth = await makeBuilder("ar-six-x@vnx.si", "ar-six-x", "approved");
      const { cookie } = await admin();
      for (const fields of [{ builder: sixth.userId }, { handle: "ar-six-x" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(400);
      }
      expect(await invitesOf(request.id)).toHaveLength(5);
      expect(outbox).toHaveLength(0);
      const html = await (await get(`/admin/requests/${request.id}`, cookie)).text();
      expect(html).toContain("All 5 invitation slots are in use.");
      expect(html).not.toContain(`/admin/requests/${request.id}/invite"`);
    });

    it("never inserts a duplicate: alone it is a 409, with a new builder only the new one is invited", async () => {
      const { request } = await makeRequest({ tag: "ar-dup" });
      const [a, b] = await builders("ar-dup", 2);
      await inviteBuilders(request, [a!]);
      const { cookie } = await admin();
      for (const fields of [{ builder: a!.userId }, { handle: "ar-dup-0" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(409);
      }
      expect(await invitesOf(request.id)).toHaveLength(1);
      expect(outbox).toHaveLength(0);
      expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: [a!.userId, b!.userId] })).status).toBe(303);
      const rows = await invitesOf(request.id);
      expect(rows.map((i) => i.builderId).sort()).toEqual([a!.userId, b!.userId].sort());
      expect(outbox.map((m) => m.to)).toEqual(["ar-dup-1@vnx.si"]);
    });

    it("never invites the client themself (a builder account that posted a request)", async () => {
      const { client, request } = await makeRequest({ tag: "ar-self" });
      const self = await makeBuilder(client.email, "ar-self-b", "approved");
      const { cookie } = await admin();
      for (const fields of [{ builder: self.userId }, { handle: "ar-self-b" }] as Record<string, string>[]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, fields)).status).toBe(409);
      }
      expect(await invitesOf(request.id)).toHaveLength(0);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
      expect(outbox).toHaveLength(0);
    });

    it("never invites a builder who is suspended or whose account is suspended", async () => {
      const { request } = await makeRequest({ tag: "ar-susp" });
      const suspended = await makeBuilder("ar-susp-s@vnx.si", "ar-susp-s", "suspended");
      const locked = await makeBuilder("ar-susp-l@vnx.si", "ar-susp-l", "approved");
      await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
      const { cookie } = await admin();
      for (const b of [suspended, locked]) {
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: b.userId })).status, "forged checkbox").toBe(409);
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { handle: b.handle })).status, "typed handle").toBe(400);
      }
      expect(await invitesOf(request.id)).toHaveLength(0);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
      expect(outbox).toHaveLength(0);
    });

    it("never invites into a request that is no longer submitted or matching", async () => {
      const { cookie } = await admin();
      for (const [i, status] of (["closed", "removed", "rejected", "expired", "builder_selected", "pending_verification"] as const).entries()) {
        const { request } = await makeRequest({ tag: `ar-end${i}`, status: status === "pending_verification" ? status : "submitted" });
        if (status !== "pending_verification") await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(request.id, status).run();
        const b = await makeBuilder(`ar-end${i}-b@vnx.si`, `ar-end${i}-b`, "approved");
        expect((await post(`/admin/requests/${request.id}/invite`, cookie, { builder: b.userId })).status, status).toBe(409);
        expect(await invitesOf(request.id), status).toHaveLength(0);
        expect((await findRequestById(testEnv.DB, request.id))?.status).toBe(status);
      }
      expect(outbox).toHaveLength(0);
    });

    it("two concurrent invite POSTs never leave more than 5 active invitations, nor an invitation nobody asked for", async () => {
      const { request } = await makeRequest({ tag: "ar-race" });
      const seeded = await builders("ar-race-s", 2);
      await inviteBuilders(request, seeded);
      const left = await builders("ar-race-l", 3);
      const right = await builders("ar-race-r", 3);
      const { cookie } = await admin();
      const path = `/admin/requests/${request.id}/invite`;
      const [one, two] = await Promise.all([post(path, cookie, { builder: left.map((b) => b.userId) }), post(path, cookie, { builder: right.map((b) => b.userId) })]);
      const rows = await invitesOf(request.id);
      expect(rows).toHaveLength(5);
      expect(activeOf(rows)).toHaveLength(5);
      expect(new Set(rows.map((i) => i.builderId)).size).toBe(5);
      const asked = new Set([...seeded, ...left, ...right].map((b) => b.userId));
      expect(rows.every((i) => asked.has(i.builderId))).toBe(true);
      // 6 asked for, 3 slots: exactly one POST wins (the other lost the race: 409, or already saw the full request: 400).
      expect([one.status, two.status].filter((s) => s === 303)).toHaveLength(1);
      expect([one.status, two.status].filter((s) => s !== 303).every((s) => s === 409 || s === 400)).toBe(true);
      expect(outbox).toHaveLength(3);
      expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("matching");
      const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.invite' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
      expect(audit?.n).toBe(1);
    });
  });

  it("returns a submitted request with a required note and tells the client; 409 once matching", async () => {
    const { request } = await makeRequest({ tag: "ar-rej" });
    const { cookie } = await admin();
    for (const note of [" ", "x".repeat(1001)]) {
      const bad = await post(`/admin/requests/${request.id}/reject`, cookie, { note });
      expect(bad.status).toBe(400);
      expect(await bad.text()).toContain("Write a reason of 1–1000 characters.");
    }
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    const res = await post(`/admin/requests/${request.id}/reject`, cookie, { note: "Please try the catalogue first." });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=1`);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "rejected", adminNote: "Please try the catalogue first." });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "ar-rej-c@vnx.si" });
    expect(outbox[0]!.text).toContain("Please try the catalogue first.");
    expect((await post(`/admin/requests/${request.id}/reject`, cookie, { note: "again" })).status).toBe(409);

    const other = await makeRequest({ tag: "ar-rej2" });
    await inviteBuilders(other.request, [await makeBuilder("ar-rej2-b@vnx.si", "ar-rej2-b", "approved")]);
    expect((await post(`/admin/requests/${other.request.id}/reject`, cookie, { note: "x" })).status).toBe(409);
    expect((await findRequestById(testEnv.DB, other.request.id))?.status).toBe("matching");
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.reject' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });

  it("reports a failed e-mail to the client but keeps the return", async () => {
    const { request } = await makeRequest({ tag: "ar-rejfail" });
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/reject`, cookie, { note: "Not a fit." }, noMail);
    expect(res.headers.get("location")).toBe(`/admin/requests/${request.id}?done=mail_failed`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("rejected");
  });

  it("removes spam: proposals become not selected, open invitations expire, both builders are told, the client is not", async () => {
    const { client, request } = await makeRequest({ tag: "ar-spam" });
    const proposer = await makeBuilder("ar-spam-p@vnx.si", "ar-spam-p", "approved");
    const waiting = await makeBuilder("ar-spam-w@vnx.si", "ar-spam-w", "approved");
    const [first] = await inviteBuilders(request, [proposer, waiting]);
    await proposeOn(first!);
    const { cookie } = await admin();
    const res = await post(`/admin/requests/${request.id}/remove`, cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/requests");
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect((await invitesOf(request.id)).map((i) => i.status)).toEqual(["not_selected", "expired"]);
    expect(outbox.map((m) => m.to).sort()).toEqual(["ar-spam-p@vnx.si", "ar-spam-w@vnx.si"]);
    expect(outbox.map((m) => m.to)).not.toContain(client.email);
    const mine = await signIn(client.email);
    expect((await get(`/me/requests/${request.id}`, mine.cookie)).status).toBe(404);
    expect((await post(`/admin/requests/${request.id}/remove`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(2);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.remove' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });
});
