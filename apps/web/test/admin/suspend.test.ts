import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { ensureUser, makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const admin = () => signIn("owner@vnx.si", { admin: true });
const status = async (path: string, cookie?: string) => (await app().request(getReq(path, cookie), undefined, testEnv)).status;

describe("suspending builders (spec §7.1)", () => {
  it("hides the profile, freezes the Hub and restores both on unsuspend", async () => {
    const b = await makeBuilder("sus-b@vnx.si", "sus-b", "approved");
    const { cookie: own } = await signIn("sus-b@vnx.si");
    const { cookie } = await admin();

    const res = await app().request(formPost(`/admin/builders/${b.userId}/suspend`, { reason: "Spam links" }, { cookie }), undefined, testEnv);
    expect(res.headers.get("location")).toBe(`/admin/builders/${b.userId}?done=1`);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "suspended", reviewNote: "Spam links" });
    expect(await status("/b/sus-b")).toBe(404);
    expect(await (await app().request(getReq("/hub", own), undefined, testEnv)).text()).toContain("Suspended");
    expect((await app().request(formPost("/hub/profile", profileValues({ handle: "sus-b" }), { cookie: own }), undefined, testEnv)).status).toBe(409);
    expect((await app().request(formPost(`/admin/builders/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);

    await app().request(formPost(`/admin/builders/${b.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, b.userId)).toMatchObject({ status: "approved", reviewNote: null, approvedAt: b.approvedAt });
    expect(await status("/b/sus-b")).toBe(200);
  });

  it("cannot suspend a pending builder (409)", async () => {
    const b = await makeBuilder("sus-pending@vnx.si", "sus-pending");
    const { cookie } = await admin();
    expect((await app().request(formPost(`/admin/builders/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("suspending users (spec §5.5, §8.2)", () => {
  beforeEach(() => clearOutbox());

  it("ends sessions, hides the builder profile and refuses sign-in until unsuspended", async () => {
    const b = await makeBuilder("sus-u@vnx.si", "sus-u", "approved");
    const { cookie: own } = await signIn("sus-u@vnx.si");
    const { cookie } = await admin();

    const res = await app().request(formPost(`/admin/users/${b.userId}/suspend`, {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/users?q=sus-u%40vnx.si");
    const sessions = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1").bind(b.userId).first<{ n: number }>();
    expect(sessions?.n).toBe(0);
    expect((await app().request(getReq("/hub", own), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fhub");
    expect(await status("/b/sus-u")).toBe(404);

    await app().request(formPost("/login", { email: "sus-u@vnx.si" }), undefined, testEnv);
    const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];
    expect((await app().request(getReq(`/auth/verify?t=${token}`), undefined, testEnv)).status).toBe(403);

    await app().request(formPost(`/admin/users/${b.userId}/unsuspend`, {}, { cookie }), undefined, testEnv);
    expect(await status("/b/sus-u")).toBe(200);
  });

  it("does not let an admin suspend themselves (409)", async () => {
    const { user, cookie } = await admin();
    expect((await app().request(formPost(`/admin/users/${user.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });

  it("searches by e-mail treating % and _ literally", async () => {
    await ensureUser("wild_card@vnx.si");
    await ensureUser("wildxcard@vnx.si");
    const { cookie } = await admin();
    const html = await (await app().request(getReq("/admin/users?q=wild_card", cookie), undefined, testEnv)).text();
    expect(html).toContain("wild_card@vnx.si");
    expect(html).not.toContain("wildxcard@vnx.si");
  });

  it("is for admins only", async () => {
    const { user, cookie } = await signIn("sus-nobody@vnx.si");
    expect(await status("/admin/users", cookie)).toBe(403);
    expect((await app().request(formPost(`/admin/users/${user.id}/suspend`, {}, { cookie }), undefined, testEnv)).status).toBe(403);
  });
});
