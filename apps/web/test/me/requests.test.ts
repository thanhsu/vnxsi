import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { inviteBuilders, makeBuilder, makeInquiry, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, cookie: string, fields: Record<string, string> = {}) => app().request(formPost(path, fields, { cookie }), undefined, testEnv);

describe("/me requests (spec §5.4)", () => {
  beforeEach(() => clearOutbox());

  it("lists requests and inquiries on /me", async () => {
    // Same tag: makeRequest and makeInquiry both use the client <tag>-c@vnx.si.
    const { client, request } = await makeRequest({ tag: "mr-list" });
    const inquiry = await makeInquiry({ tag: "mr-list", status: "open" });
    const { cookie } = await signIn(client.email);
    const html = await (await get("/me", cookie)).text();
    expect(html).toContain(`href="/me/requests/${request.id}"`);
    expect(html).toContain(request.title);
    expect(html).toContain(`href="/me/inquiries/${inquiry.inquiry.id}"`);
    expect(html).toContain('href="/request"');
  });

  it("shows the request with the 3-day note; 404 for someone else's or a removed one", async () => {
    const mine = await makeRequest({ tag: "mr-page" });
    const other = await makeRequest({ tag: "mr-page2" });
    const { cookie } = await signIn(mine.client.email);
    const res = await get(`/me/requests/${mine.request.id}?sent=1`, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("You usually get proposals within 3 business days.");
    expect(html).toContain("We need online booking with SMS reminders");
    expect((await get(`/me/requests/${other.request.id}`, cookie)).status).toBe(404);
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(mine.request.id).run();
    expect((await get(`/me/requests/${mine.request.id}`, cookie)).status).toBe(404);
  });

  it("sends a pending request now, once", async () => {
    const { client, request } = await makeRequest({ tag: "mr-now", status: "pending_verification" });
    const { cookie } = await signIn(client.email);
    expect(await (await get(`/me/requests/${request.id}`, cookie)).text()).toContain(`action="/me/requests/${request.id}/confirm"`);
    const res = await post(`/vi/me/requests/${request.id}/confirm`, cookie);
    expect(res.headers.get("location")).toBe(`/vi/me/requests/${request.id}`);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
    expect(outbox.filter((m) => m.to === "owner@vnx.si")).toHaveLength(1);
    expect((await post(`/me/requests/${request.id}/confirm`, cookie)).status).toBe(409);
    expect(outbox.filter((m) => m.to === "owner@vnx.si")).toHaveLength(1);
  });

  it("closes a matching request: invitations expire, proposals are not selected and their builders are told; once only", async () => {
    const { client, request } = await makeRequest({ tag: "mr-close" });
    const a = await makeBuilder("mr-close-a@vnx.si", "mr-close-a", "approved");
    const b = await makeBuilder("mr-close-b@vnx.si", "mr-close-b", "approved");
    const [ia] = await inviteBuilders(request, [a, b]);
    await proposeOn(ia!);
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("closed");
    const statuses = (await listRequestInvites(testEnv.DB, request.id)).map((x) => x.invite.status);
    expect(statuses).toEqual(["not_selected", "expired"]);
    // A's proposal was not selected, B's invitation lapsed: each builder gets one e-mail, and none shows the client's e-mail.
    expect(outbox.map((m) => m.to).sort()).toEqual(["mr-close-a@vnx.si", "mr-close-b@vnx.si"]);
    expect(outbox.every((m) => ![m.subject, m.text, m.html].some((part) => part.includes(client.email)))).toBe(true);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(409);
    expect(outbox).toHaveLength(2);
  });

  it("closing does not e-mail a suspended invitee; the other invitee still gets theirs", async () => {
    const { client, request } = await makeRequest({ tag: "mr-susp" });
    const a = await makeBuilder("mr-susp-a@vnx.si", "mr-susp-a", "approved");
    const b = await makeBuilder("mr-susp-b@vnx.si", "mr-susp-b", "approved");
    const [ia] = await inviteBuilders(request, [a, b]);
    await proposeOn(ia!);
    await testEnv.DB.prepare("UPDATE builders SET status = 'suspended' WHERE user_id = ?1").bind(a.userId).run();
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    expect((await listRequestInvites(testEnv.DB, request.id)).map((x) => x.invite.status)).toEqual(["not_selected", "expired"]);
    expect(outbox.map((m) => m.to)).toEqual(["mr-susp-b@vnx.si"]);
  });

  it("lets the owner close a submitted request: 303, nobody to e-mail; a pending one cannot be closed (409)", async () => {
    const { client, request } = await makeRequest({ tag: "mr-close-sub" });
    const { cookie } = await signIn(client.email);
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("closed");
    expect(outbox).toEqual([]);
    const pending = await makeRequest({ tag: "mr-close-pend", status: "pending_verification" });
    const other = await signIn(pending.client.email);
    expect((await post(`/me/requests/${pending.request.id}/close`, other.cookie)).status).toBe(409);
    expect((await findRequestById(testEnv.DB, pending.request.id))?.status).toBe("pending_verification");
  });

  it("does not let another client close a request", async () => {
    const { request } = await makeRequest({ tag: "mr-other" });
    const { cookie } = await signIn("mr-other-x@vnx.si");
    expect((await post(`/me/requests/${request.id}/close`, cookie)).status).toBe(404);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("submitted");
  });

  // Task 2 review: openPendingRequest does not check the owner, so "Send now" must (404, nothing written).
  it("does not let another user send someone else's pending request: 404, no e-mail, no audit row, still pending", async () => {
    const { request } = await makeRequest({ tag: "mr-own", status: "pending_verification" });
    const { cookie } = await signIn("mr-own-x@vnx.si");
    expect((await post(`/me/requests/${request.id}/confirm`, cookie)).status).toBe(404);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toEqual([]);
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'request' AND entity_id = ?1").bind(request.id).first<{ n: number }>();
    expect(audit?.n).toBe(0);
    expect((await post("/me/requests/does-not-exist/confirm", cookie)).status).toBe(404);
  });
});
