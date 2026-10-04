import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { requireBuilder, sessionMiddleware } from "../../src/auth/middleware.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import type { AppEnv } from "../../src/env.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { ensureUser, makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

async function newInvite(code: string, o: { maxUses?: number; expiresAt?: string } = {}) {
  const admin = await ensureUser("apply-admin@vnx.si");
  const codeHash = await sha256Hex(code);
  await createInvite(testEnv.DB, { codeHash, createdBy: admin.id, maxUses: o.maxUses ?? 1, expiresAt: o.expiresAt ?? "2999-01-01T00:00:00.000Z", note: null, now: new Date().toISOString() });
  return codeHash;
}

const builderRow = (userId: string) =>
  testEnv.DB.prepare("SELECT status, skills, work_languages, hourly_rate_cents, invite_code_hash FROM builders WHERE user_id = ?1").bind(userId).first();

describe("/hub/apply (spec §5.3)", () => {
  it("asks anonymous visitors to sign in", async () => {
    const res = await createApp().request(getReq("/hub/apply"), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login?next=%2Fhub%2Fapply");
  });

  it("renders the form with localized labels and country names", async () => {
    const { cookie } = await signIn("apply-form@vnx.si");
    const res = await createApp().request(getReq("/vi/hub/apply", cookie), undefined, testEnv);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Trở thành builder");
    expect(html).toContain("Việt Nam");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("creates a pending builder without an invite", async () => {
    const { user, cookie } = await signIn("apply-plain@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-plain" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub");
    expect(await builderRow(user.id)).toEqual({ status: "pending", skills: '["Next.js","Supabase"]', work_languages: '["en","vi"]', hourly_rate_cents: 4500, invite_code_hash: null });
    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'builder.apply' AND entity_id = ?1").bind(user.id).first<{ data: string }>();
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ status: "pending", invited: false });
  });

  it("approves right away with a valid invite, spends it and clears the cookie", async () => {
    const hash = await newInvite("applyValidInvite000001");
    const { user, cookie } = await signIn("apply-invited@vnx.si");
    const both = `${cookie}; __Host-vnx_invite=${hash}`;
    const form = await createApp().request(getReq("/hub/apply", both), undefined, testEnv);
    expect(await form.text()).toContain("profile will be approved right away");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-invited" }), { cookie: both }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await builderRow(user.id)).toMatchObject({ status: "approved", invite_code_hash: hash });
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(1);
    expect(setCookieValue(res, "__Host-vnx_invite")).toBe("");
  });

  it("explains an expired invite and falls back to pending", async () => {
    const hash = await newInvite("applyExpiredInvite0001", { expiresAt: "2000-01-01T00:00:00.000Z" });
    const { user, cookie } = await signIn("apply-expired@vnx.si");
    const both = `${cookie}; __Host-vnx_invite=${hash}`;
    expect(await (await createApp().request(getReq("/hub/apply", both), undefined, testEnv)).text()).toContain("This invite link has expired or has no uses left");
    await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-expired" }), { cookie: both }), undefined, testEnv);
    expect(await builderRow(user.id)).toMatchObject({ status: "pending", invite_code_hash: null });
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(0);
  });

  it("re-renders field errors with escaped input (400)", async () => {
    const { cookie } = await signIn("apply-bad@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "admin", name: "<script>alert(1)</script>", websiteUrl: "http://x.dev" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("This handle is reserved");
    expect(html).toContain("Enter a full https:// address");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses a taken handle with 409 and leaves the invite unused", async () => {
    await makeBuilder("apply-first@vnx.si", "apply-taken");
    const hash = await newInvite("applyTakenInvite000001", { maxUses: 3 });
    const { cookie } = await signIn("apply-second@vnx.si");
    const res = await createApp().request(formPost("/hub/apply", profileValues({ handle: "apply-taken" }), { cookie: `${cookie}; __Host-vnx_invite=${hash}` }), undefined, testEnv);
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("This handle is already taken.");
    expect((await findInvite(testEnv.DB, hash))?.uses).toBe(0);
  });

  it("sends existing builders to the hub", async () => {
    await makeBuilder("apply-exists@vnx.si", "apply-exists");
    const { cookie } = await signIn("apply-exists@vnx.si");
    const app = createApp();
    expect((await app.request(getReq("/vi/hub/apply", cookie), undefined, testEnv)).headers.get("location")).toBe("/vi/hub");
    expect((await app.request(formPost("/hub/apply", profileValues({ handle: "apply-exists-2" }), { cookie }), undefined, testEnv)).headers.get("location")).toBe("/hub");
  });
});

describe("requireBuilder", () => {
  const mini = new Hono<AppEnv>();
  mini.use("*", localeMiddleware, sessionMiddleware);
  mini.get("/vi/hub/x", requireBuilder, (c) => c.text(c.get("builder").handle));

  it("redirects anonymous users, sends non-builders to apply and loads the builder", async () => {
    expect((await mini.request("https://vnx.si/vi/hub/x", {}, testEnv)).headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fhub%2Fx");
    const plain = await signIn("rb-plain@vnx.si");
    expect((await mini.request("https://vnx.si/vi/hub/x", { headers: { cookie: plain.cookie } }, testEnv)).headers.get("location")).toBe("/vi/hub/apply");
    await makeBuilder("rb-builder@vnx.si", "rb-builder");
    const builder = await signIn("rb-builder@vnx.si");
    expect(await (await mini.request("https://vnx.si/vi/hub/x", { headers: { cookie: builder.cookie } }, testEnv)).text()).toBe("rb-builder");
  });
});
