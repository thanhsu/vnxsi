import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, setCookieValue, testEnv } from "../helpers.ts";

const CODE = "abcdefghijklmnopqrstuv"; // 22 chars, the shape randomToken(16) produces

function tokenFrom(text: string): string {
  const m = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(text);
  if (!m?.[1]) throw new Error("no token in email");
  return m[1];
}

async function tokenInviteHash(email: string) {
  const row = await testEnv.DB.prepare("SELECT invite_code_hash FROM login_tokens WHERE email = ?1").bind(email).first<{ invite_code_hash: string | null }>();
  return row?.invite_code_hash;
}

describe("invite links (spec §5.3)", () => {
  beforeEach(() => clearOutbox());

  it("404s on a malformed code", async () => {
    expect((await createApp().request(getReq("/join/short"), undefined, testEnv)).status).toBe(404);
  });

  it("stores the invite hash in a cookie and sends anonymous visitors to sign in", async () => {
    const res = await createApp().request(getReq(`/join/${CODE}`), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login?next=%2Fhub%2Fapply");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(setCookieValue(res, "__Host-vnx_invite")).toBe(await sha256Hex(CODE));
    const line = res.headers.getSetCookie().find((l) => l.startsWith("__Host-vnx_invite=")) ?? "";
    expect(line).toMatch(/Max-Age=3600/);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/SameSite=Lax/i);
  });

  it("sends signed-in users straight to the application form in their locale", async () => {
    const { cookie } = await signIn("join-signed@vnx.si");
    const res = await createApp().request(getReq(`/vi/join/${CODE}`, cookie), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/hub/apply");
  });

  it("carries the invite through the magic link to another device", async () => {
    const app = createApp();
    const hash = await sha256Hex(CODE);
    await app.request(formPost("/login", { email: "carry@vnx.si", next: "/hub/apply" }, { cookie: `__Host-vnx_invite=${hash}` }), undefined, testEnv);
    expect(await tokenInviteHash("carry@vnx.si")).toBe(hash);
    // The e-mail is opened on a device without the invite cookie.
    const verify = await app.request(getReq(`/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2Fhub%2Fapply`), undefined, testEnv);
    expect(verify.status).toBe(303);
    expect(verify.headers.get("location")).toBe("/hub/apply");
    expect(setCookieValue(verify, "__Host-vnx_session")).not.toBeNull();
    expect(setCookieValue(verify, "__Host-vnx_invite")).toBe(hash);
  });

  it("ignores a tampered invite cookie", async () => {
    await createApp().request(formPost("/login", { email: "tamper@vnx.si" }, { cookie: "__Host-vnx_invite=not-a-hash" }), undefined, testEnv);
    expect(await tokenInviteHash("tamper@vnx.si")).toBeNull();
  });
});
