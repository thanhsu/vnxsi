import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

async function login(email: string, env: Bindings) {
  clearOutbox();
  const app = createApp();
  await app.request(formPost("/login", { email }), undefined, env);
  const token = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(outbox[0]!.text)![1];
  await app.request(getReq(`/auth/verify?t=${token}`), undefined, env);
}

const isAdmin = async (email: string) =>
  (await testEnv.DB.prepare("SELECT is_admin FROM users WHERE email = ?1").bind(email).first<{ is_admin: number }>())?.is_admin;

describe("ADMIN_EMAILS is the source of truth (Owner decision 2026-10-03)", () => {
  beforeEach(() => clearOutbox());

  it("revokes admin pages on the next request once the e-mail leaves the list", async () => {
    const { cookie } = await signIn("owner@vnx.si", { admin: true });
    expect((await createApp().request(getReq("/admin/builders", cookie), undefined, testEnv)).status).toBe(200);
    const removed = { ...testEnv, ADMIN_EMAILS: "" } as Bindings;
    expect((await createApp().request(getReq("/admin/builders", cookie), undefined, removed)).status).toBe(403);
  });

  it("syncs is_admin both ways at sign-in", async () => {
    await login("boss@vnx.si", { ...testEnv, ADMIN_EMAILS: "boss@vnx.si" } as Bindings);
    expect(await isAdmin("boss@vnx.si")).toBe(1);
    await login("boss@vnx.si", { ...testEnv, ADMIN_EMAILS: "" } as Bindings);
    expect(await isAdmin("boss@vnx.si")).toBe(0);
  });
});
