import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Context } from "hono";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { findRequestById } from "../../src/db/requests.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { AppEnv } from "../../src/env.ts";
import { openPendingRequest } from "../../src/routes/request-confirm.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { ensureUser, makeRequest } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = createApp();
const tokenFor = (email: string, requestId: string | null, locale: "en" | "vi" = "en", at = new Date()) =>
  createLoginToken(testEnv.DB, { email, purpose: "request_verify", locale, requestId }, at);
const audits = (id: string) => testEnv.DB.prepare("SELECT action, actor_user_id, data FROM audit_log WHERE entity_id = ?1 AND action = 'request.verify'").bind(id).all<{ action: string; actor_user_id: string; data: string }>();

describe("request_verify at /auth/verify (VNX-0602a)", () => {
  beforeEach(() => clearOutbox());

  it("shows its own confirmation page on GET without spending the token", async () => {
    const { client, request } = await makeRequest({ tag: "rv-get", status: "pending_verification" });
    const t = await tokenFor(client.email, request.id, "vi");
    for (let i = 0; i < 2; i++) {
      const res = await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Xác nhận nhu cầu");
      expect(html).toContain('<form method="post" action="/auth/verify">');
    }
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(0);
  });

  it("submits the request, signs the client in, names the account, audits and alerts the admin", async () => {
    const { client, request } = await makeRequest({ tag: "rv-ok", status: "pending_verification", languages: ["vi", "zh"] });
    const t = await tokenFor(client.email, request.id, "vi");
    const res = await app.request(formPost("/auth/verify", { t }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/vi/me/requests/${request.id}`);
    expect(res.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);
    const after = (await findRequestById(testEnv.DB, request.id))!;
    expect(after.status).toBe("submitted");
    expect(after.submittedAt).not.toBeNull();
    const user = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    expect(user?.display_name).toBe("Minh Tran");
    const { results } = await audits(request.id);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ actor_user_id: client.id });
    expect(JSON.parse(results[0]!.data)).toMatchObject({ via: "link", category: "booking", languages: ["vi", "zh"] });
    expect(outbox.map((m) => m.to)).toEqual(["owner@vnx.si"]);
    expect(outbox[0]!.subject).toBe(`New request: ${request.title}`);
  });

  it("opens only the signed-in e-mail's own pending request", async () => {
    const mine = await makeRequest({ tag: "rv-own" });
    const other = await makeRequest({ tag: "rv-other", status: "pending_verification" });
    const stranger = await ensureUser("rv-stranger@vnx.si");
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(stranger.email, other.request.id) }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");
    expect((await findRequestById(testEnv.DB, other.request.id))?.status).toBe("pending_verification");
    // A token for a request that is already submitted, or without a request, changes nothing and tells nobody.
    const again = await app.request(formPost("/auth/verify", { t: await tokenFor(mine.client.email, mine.request.id) }), undefined, testEnv);
    expect(again.headers.get("location")).toBe("/me");
    const none = await app.request(formPost("/auth/verify", { t: await tokenFor(mine.client.email, null) }), undefined, testEnv);
    expect(none.headers.get("location")).toBe("/me");
    expect(outbox).toHaveLength(0);
    expect((await audits(other.request.id)).results).toHaveLength(0);
  });

  it("does not open a request the admin removed, and tells nobody", async () => {
    const { client, request } = await makeRequest({ tag: "rv-rm", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE requests SET status = 'removed' WHERE id = ?1").bind(request.id).run();
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(client.email, request.id) }), undefined, testEnv);
    expect(res.headers.get("location")).toBe("/me");
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("removed");
    expect(outbox).toHaveLength(0);
  });

  it("refuses a suspended account and leaves the request pending", async () => {
    const { client, request } = await makeRequest({ tag: "rv-sus", status: "pending_verification" });
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(client.id).run();
    const res = await app.request(formPost("/auth/verify", { t: await tokenFor(client.email, request.id) }), undefined, testEnv);
    expect(res.status).toBe(403);
    expect((await findRequestById(testEnv.DB, request.id))?.status).toBe("pending_verification");
    expect(outbox).toHaveLength(0);
  });

  it("does nothing when the compare-and-set loses: the request was already submitted", async () => {
    const { client, request: stale } = await makeRequest({ tag: "rv-lost", status: "pending_verification" });
    const t = await tokenFor(client.email, stale.id);
    expect((await app.request(formPost("/auth/verify", { t }), undefined, testEnv)).status).toBe(303); // submits it
    clearOutbox();
    const before = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Kept' WHERE id = ?1").bind(client.id).run();
    // `stale` was read while pending; call the function with it now.
    const ctx = { env: testEnv } as unknown as Context<AppEnv>;
    expect(await openPendingRequest(ctx, stale, client, new Date(), "me")).toBe(false);
    expect((await audits(stale.id)).results).toHaveLength(1); // only the first, winning, call
    expect(outbox).toHaveLength(0);
    const after = await testEnv.DB.prepare("SELECT display_name FROM users WHERE id = ?1").bind(client.id).first<{ display_name: string }>();
    expect(before?.display_name).toBe("Minh Tran");
    expect(after?.display_name).toBe("Kept");
  });

  it("explains an expired request link, with the Send now hint for requests only", async () => {
    const old = new Date(Date.now() - 16 * 60 * 1000);
    const t = await tokenFor("rv-old@vnx.si", null, "vi", old);
    const html = await (await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv)).text();
    expect(html).toContain(`Nếu bạn đang xác nhận một nhu cầu: hãy đăng nhập, mở ${vi["nav.me"]} và bấm ${vi["me.sendNow"]}.`);
    expect(html).not.toContain("Nếu bạn đang xác nhận một yêu cầu");
  });
});
