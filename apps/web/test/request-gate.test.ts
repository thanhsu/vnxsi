import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { findInquiryById } from "../src/db/inquiries.ts";
import { findRequestById, listClientRequests, listRequestInvites } from "../src/db/requests.ts";
import { findUserByEmail } from "../src/db/users.ts";
import { clearOutbox, outbox } from "../src/email/fake.ts";
import { FAKE_TURNSTILE_PASS, TURNSTILE_FIELD } from "../src/http/turnstile.ts";
import { addLiveProduct, inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "./fixtures.ts";
import { followMagicLink, formPost, getReq, setCookieValue, testEnv } from "./helpers.ts";

const app = () => createApp();
const post = (path: string, fields: Record<string, string | string[]>, cookie?: string) => app().request(formPost(path, fields, { "cf-connecting-ip": "192.0.2.66", ...(cookie ? { cookie } : {}) }), undefined, testEnv);
const get = (path: string, cookie: string) => app().request(getReq(path, cookie), undefined, testEnv);
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];
const clientEmail = "gate6-client@request.example";

describe("M6 exit gate (spec §9, Request)", { timeout: 30_000 }, () => {
  beforeEach(() => clearOutbox());

  it("signed-out request -> confirm -> submitted -> admin invites 2 -> A proposes, B declines -> client picks A -> inquiry open for both; the builder never sees the client's e-mail", async () => {
    const a = await makeBuilder("gate6-a@vnx.si", "gate6-a", "approved", { name: "Gate A" });
    const b = await makeBuilder("gate6-b@vnx.si", "gate6-b", "approved", { name: "Gate B" });

    const posted = await post("/request", {
      title: "Booking app for three salons",
      description: "We need online booking with SMS reminders for three salons in Hanoi.",
      category: "booking",
      budgetBand: "2k-10k",
      deadline: "",
      languages: ["vi"],
      name: "Gate Client",
      email: clientEmail,
      [TURNSTILE_FIELD]: FAKE_TURNSTILE_PASS,
    });
    expect(posted.status).toBe(200);
    const confirmed = await followMagicLink(app(), linkFrom(outbox.find((m) => m.to === clientEmail)!.text));
    expect(confirmed.status).toBe(303);
    const clientCookie = `__Host-vnx_session=${setCookieValue(confirmed, "__Host-vnx_session")}`;
    const client = (await findUserByEmail(testEnv.DB, clientEmail))!;
    const [request] = await listClientRequests(testEnv.DB, client.id);
    expect(confirmed.headers.get("location")).toBe(`/me/requests/${request!.id}`);
    expect(request?.status).toBe("submitted");

    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request!.id}/invite`, { builder: [a.userId, b.userId] }, adminCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request!.id))?.status).toBe("matching");
    const invites = await listRequestInvites(testEnv.DB, request!.id);
    const ia = invites.find((x) => x.invite.builderId === a.userId)!.invite;
    const ib = invites.find((x) => x.invite.builderId === b.userId)!.invite;

    const aCookie = (await signIn("gate6-a@vnx.si")).cookie;
    const bCookie = (await signIn("gate6-b@vnx.si")).cookie;
    const seenByBuilders: string[] = [await (await get(`/hub/invitations/${ia.id}`, aCookie)).text(), await (await get("/hub/invitations", aCookie)).text()];
    expect((await post(`/hub/invitations/${ia.id}/propose`, { approach: "Next.js and SMS reminders.", priceMode: "fixed", price: "4500", timelineDays: "30" }, aCookie)).status).toBe(303);
    expect((await post(`/hub/invitations/${ib.id}/decline`, { reason: "Busy" }, bCookie)).status).toBe(303);

    const proposals = await (await get(`/me/requests/${request!.id}`, clientCookie)).text();
    expect(proposals).toContain("$4,500");
    expect(proposals).not.toContain(`value="${ib.id}"`); // B declined: nothing to choose
    expect((await post(`/me/requests/${request!.id}/select`, { invite: ia.id }, clientCookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request!.id))?.status).toBe("builder_selected");
    const settled = await listRequestInvites(testEnv.DB, request!.id);
    expect(settled.find((x) => x.invite.id === ia.id)?.invite.status).toBe("selected");
    expect(settled.find((x) => x.invite.id === ib.id)?.invite.status).toBe("declined");
    const inquiryId = settled.find((x) => x.invite.id === ia.id)!.invite.inquiryId!;
    expect(await findInquiryById(testEnv.DB, inquiryId)).toMatchObject({ type: "request", clientUserId: client.id, builderId: a.userId, requestId: request!.id, status: "open" });

    // Open for both sides: each opens the thread and replies; the other side reads it.
    const hub = await (await get(`/hub/inquiries/${inquiryId}`, aCookie)).text();
    expect(hub).toContain("Gate Client");
    expect(hub).toContain("Booking app for three salons");
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("Booking app for three salons");
    expect((await post(`/hub/inquiries/${inquiryId}/reply`, { body: "I can start Monday." }, aCookie)).status).toBe(303);
    expect(await (await get(`/me/inquiries/${inquiryId}`, clientCookie)).text()).toContain("I can start Monday.");
    expect((await post(`/me/inquiries/${inquiryId}/reply`, { body: "Great, see you Monday." }, clientCookie)).status).toBe(303);
    seenByBuilders.push(hub, await (await get("/hub/inquiries", aCookie)).text(), await (await get(`/hub/inquiries/${inquiryId}`, aCookie)).text());

    // Spec §5.7 step 3 / §5.6: the builders never see the client's e-mail, in pages or in e-mails.
    const toBuilders = outbox.filter((m) => m.to.startsWith("gate6-") && m.to.endsWith("@vnx.si"));
    expect(toBuilders.length).toBeGreaterThanOrEqual(3); // invitation, chosen, client's reply
    for (const seen of [...seenByBuilders, ...toBuilders.flatMap((m) => [m.subject, m.text, m.html])]) expect(seen).not.toContain(clientEmail);
  });

  it("the admin's suggestions rank a builder with a live product in the category above one without, and leave out closed builders", async () => {
    const { request } = await makeRequest({ tag: "gate6-sug", category: "booking" });
    const withProduct = await makeBuilder("gate6-sug-p@vnx.si", "gate6-sug-p", "approved", { name: "Sug With" });
    await addLiveProduct(withProduct, "gate6-sug product");
    await makeBuilder("gate6-sug-n@vnx.si", "gate6-sug-n", "approved", { name: "Sug Without" });
    await makeBuilder("gate6-sug-z@vnx.si", "gate6-sug-z", "approved", { name: "Sug Closed", availability: "closed" });
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    const html = await (await get(`/admin/requests/${request.id}`, adminCookie)).text();
    expect(html).toContain("gate6-sug-p");
    expect(html).toContain("gate6-sug-n");
    expect(html.indexOf("gate6-sug-p")).toBeLessThan(html.indexOf("gate6-sug-n"));
    expect(html).not.toContain("gate6-sug-z");
  });

  it("cannot invite a 6th builder while 5 are active", async () => {
    const { request } = await makeRequest({ tag: "gate6-cap" });
    const five = await Promise.all([0, 1, 2, 3, 4].map((i) => makeBuilder(`gate6-cap-${i}@vnx.si`, `gate6-cap-${i}`, "approved")));
    const invites = await inviteBuilders(request, five);
    await proposeOn(invites[0]!);
    await proposeOn(invites[1]!); // invited and proposed both count against the cap
    const sixth = await makeBuilder("gate6-cap-6@vnx.si", "gate6-cap-6", "approved");
    const adminCookie = (await signIn("owner@vnx.si", { admin: true })).cookie;
    expect((await post(`/admin/requests/${request.id}/invite`, { builder: [sixth.userId] }, adminCookie)).status).toBe(400);
    expect(await listRequestInvites(testEnv.DB, request.id)).toHaveLength(5);
  });

  it("a builder who was not invited cannot see the request (404)", async () => {
    const { request } = await makeRequest({ tag: "gate6-404" });
    const [invite] = await inviteBuilders(request, [await makeBuilder("gate6-404-a@vnx.si", "gate6-404-a", "approved")]);
    await makeBuilder("gate6-404-x@vnx.si", "gate6-404-x", "approved");
    const cookie = (await signIn("gate6-404-x@vnx.si")).cookie;
    expect((await get(`/hub/invitations/${invite!.id}`, cookie)).status).toBe(404);
  });
});
