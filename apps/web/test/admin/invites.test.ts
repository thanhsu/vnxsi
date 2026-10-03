import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { findBuilderByHandle } from "../../src/db/builders.ts";
import { createInvite, findInvite } from "../../src/db/invites.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { ensureUser, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });

async function createLink(cookie: string, fields: Record<string, string>) {
  const res = await app().request(formPost("/admin/invites", fields, { cookie }), undefined, testEnv);
  const html = await res.text();
  const code = /https:\/\/vnx\.si\/join\/([A-Za-z0-9_-]{22})/.exec(html)?.[1];
  return { res, html, code };
}

describe("admin invites (spec §5.5)", () => {
  beforeEach(() => clearOutbox());

  it("is for admins only", async () => {
    const { cookie } = await signIn("inv-nobody@vnx.si");
    expect((await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).status).toBe(403);
    expect((await app().request(formPost("/admin/invites", { maxUses: "1", days: "7", note: "" }, { cookie }), undefined, testEnv)).status).toBe(403);
  });

  it("shows a new link once and stores only its hash", async () => {
    const { cookie } = await admin();
    const before = Date.now();
    const { res, code } = await createLink(cookie, { maxUses: "3", days: "7", note: "Founding builders" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(code).toBeDefined();
    const hash = await sha256Hex(code!);
    const invite = await findInvite(testEnv.DB, hash);
    expect(invite).toMatchObject({ maxUses: 3, uses: 0, note: "Founding builders" });
    const expires = Date.parse(invite!.expiresAt);
    expect(expires - before).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(expires - before).toBeLessThanOrEqual(7 * 86_400_000 + 60_000);

    const audit = await testEnv.DB.prepare("SELECT data FROM audit_log WHERE action = 'invite.create' AND entity_id = ?1").bind(hash).first<{ data: string }>();
    expect(audit?.data).not.toContain(code!);

    const list = await (await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).text();
    expect(list).toContain("Founding builders");
    expect(list).not.toContain(code!);
  });

  it("validates the form (400)", async () => {
    const { cookie } = await admin();
    const { res, html } = await createLink(cookie, { maxUses: "0", days: "91", note: "n".repeat(201) });
    expect(res.status).toBe(400);
    expect(html).toContain("Enter a whole number from 1 to 1000.");
    expect(html).toContain("Enter a whole number from 1 to 90.");
    expect(html).toContain("Keep the note under 200 characters.");
  });

  it("labels used-up and expired links", async () => {
    const owner = await ensureUser("owner@vnx.si");
    const now = new Date().toISOString();
    await createInvite(testEnv.DB, { codeHash: await sha256Hex("inv-usedup"), createdBy: owner.id, maxUses: 1, expiresAt: "2999-01-01T00:00:00.000Z", note: "usedup-note", now });
    await testEnv.DB.prepare("UPDATE invites SET uses = 1 WHERE code_hash = ?1").bind(await sha256Hex("inv-usedup")).run();
    await createInvite(testEnv.DB, { codeHash: await sha256Hex("inv-expired"), createdBy: owner.id, maxUses: 1, expiresAt: "2000-01-01T00:00:00.000Z", note: "expired-note", now });
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/invites", cookie), undefined, testEnv)).text();
    expect(html).toContain("Used up");
    expect(html).toContain("Expired");
  });

  it("takes an invited builder from the link to a public profile (M2 exit gate)", async () => {
    const { cookie: adminCookie } = await admin();
    const { code } = await createLink(adminCookie, { maxUses: "1", days: "14", note: "" });

    const join = await app().request(getReq(`/join/${code}`), undefined, testEnv);
    const inviteHash = setCookieValue(join, "__Host-vnx_invite")!;
    await app().request(formPost("/login", { email: "gate@vnx.si", next: "/hub/apply" }, { cookie: `__Host-vnx_invite=${inviteHash}` }), undefined, testEnv);
    const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];

    // Opened on a second device that never saw /join.
    const verify = await app().request(getReq(`/auth/verify?t=${token}&next=%2Fhub%2Fapply`), undefined, testEnv);
    const cookies = `__Host-vnx_session=${setCookieValue(verify, "__Host-vnx_session")}; __Host-vnx_invite=${setCookieValue(verify, "__Host-vnx_invite")}`;
    const apply = await app().request(formPost("/hub/apply", profileValues({ handle: "gate-builder" }), { cookie: cookies }), undefined, testEnv);
    expect(apply.headers.get("location")).toBe("/hub");

    expect(await findBuilderByHandle(testEnv.DB, "gate-builder")).toMatchObject({ status: "approved" });
    expect((await findInvite(testEnv.DB, inviteHash))?.uses).toBe(1);
    expect((await app().request(getReq("/b/gate-builder"), undefined, testEnv)).status).toBe(200);
  });
});
