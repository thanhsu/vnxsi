import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findRequestById, listRequestInvites } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { runDaily } from "../../src/jobs/daily.ts";
import { inviteBuilders, makeBuilder, makeRequest, proposeOn, signIn } from "../fixtures.ts";
import { formPost, testEnv } from "../helpers.ts";

const subjectsTo = (to: string) => outbox.filter((m) => m.to === to).map((m) => m.subject);
const statusOf = async (requestId: string, inviteId: string) => (await listRequestInvites(testEnv.DB, requestId)).find((x) => x.invite.id === inviteId)!.invite.status;
const adminCookie = async () => (await signIn("owner@vnx.si", { admin: true })).cookie;

describe("suspending a user ends their open requests (M6 review F7)", () => {
  beforeEach(() => clearOutbox());

  it("removes a matching request in the same batch, settles its invitations, tells both builders and never the client", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { client, request } = await makeRequest({ tag: "sr-a", title: "sr-a matching" });
    const [a, b] = await Promise.all(["a", "b"].map((k) => makeBuilder(`sr-a-${k}@vnx.si`, `sr-a-${k}`, "approved")));
    const [ia, ib] = await inviteBuilders(request, [a!, b!]);
    await proposeOn(ib!);
    const keep = await makeRequest({ tag: "sr-a", title: "sr-a selected" }); // same client
    await testEnv.DB.prepare("UPDATE requests SET status = 'builder_selected' WHERE id = ?1").bind(keep.request.id).run();

    const res = await app.request(formPost(`/admin/users/${client.id}/suspend`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await findRequestById(testEnv.DB, request.id)).toMatchObject({ status: "removed" });
    expect(await statusOf(request.id, ia!.id)).toBe("expired");
    expect(await statusOf(request.id, ib!.id)).toBe("not_selected");
    expect(subjectsTo("sr-a-a@vnx.si")).toEqual(["Invitation ended: sr-a matching"]);
    expect(subjectsTo("sr-a-b@vnx.si")).toEqual(["Update on your proposal: sr-a matching"]);
    expect(outbox.filter((m) => m.to === client.email)).toEqual([]);
    expect((await findRequestById(testEnv.DB, keep.request.id))?.status).toBe("builder_selected");
    const audit = await testEnv.DB.prepare("SELECT actor_user_id FROM audit_log WHERE action = 'request.remove' AND entity_id = ?1").bind(request.id).all<{ actor_user_id: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]!.actor_user_id).not.toBeNull();
    const untouched = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'request.remove' AND entity_id = ?1").bind(keep.request.id).first<{ n: number }>();
    expect(untouched?.n).toBe(0);

    // The cron has nothing left to do for it: no error, no mail, no new audit row, the request stays removed.
    clearOutbox();
    const auditBefore = (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first<{ n: number }>())!.n;
    const results = await runDaily(testEnv, new Date(Date.now() + 100 * 24 * 3600 * 1000));
    expect(results.filter((r) => "error" in r)).toEqual([]);
    expect(outbox).toEqual([]);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first<{ n: number }>())!.n).toBe(auditBefore);
  });

  it("also ends a submitted request, and a lost suspend (409) ends nothing", async () => {
    const app = createApp();
    const cookie = await adminCookie();
    const { client, request } = await makeRequest({ tag: "sr-b" });
    expect((await app.request(formPost(`/admin/users/${client.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(303);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    const again = await makeRequest({ tag: "sr-b", title: "sr-b second" });
    expect((await app.request(formPost(`/admin/users/${client.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
    expect((await findRequestById(testEnv.DB, again.request.id))?.status).toBe("submitted");
  });
});
