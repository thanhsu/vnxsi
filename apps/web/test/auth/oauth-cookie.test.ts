import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOAuthCookie, linkSessionHash, OAUTH_COOKIE, readOAuthCookie, writeOAuthCookie } from "../../src/auth/oauth-cookie.ts";
import { generateNonce, generateState, generateVerifier, newFlowCookie, newLinkIntent } from "../../src/domain/oauth.ts";
import type { AppEnv } from "../../src/env.ts";

const flow = () =>
  newFlowCookie({ provider: "github", intent: "signin", state: generateState(), verifier: generateVerifier(), nonce: generateNonce(), next: "/me", locale: "vi", sessionHash: null }, Date.now());

const app = new Hono<AppEnv>();
app.get("/write-flow", (c) => {
  writeOAuthCookie(c, flow());
  return c.text("ok");
});
app.get("/write-intent", async (c) => {
  writeOAuthCookie(c, newLinkIntent({ provider: "github", sessionHash: await linkSessionHash("raw-session") }, Date.now()));
  return c.text("ok");
});
app.get("/clear", (c) => {
  clearOAuthCookie(c);
  return c.text("ok");
});
app.get("/read/:provider", (c) => c.json(readOAuthCookie(c, c.req.param("provider") as "google" | "github" | "linkedin")));

const setCookieOf = (res: Response) => res.headers.getSetCookie().find((line) => line.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
const valueOf = (line: string) => line.slice(OAUTH_COOKIE.length + 1).split(";")[0] ?? "";
const maxAgeOf = (line: string) => Number(/Max-Age=(\d+)/.exec(line)?.[1]);

describe("__Host-vnx_oauth (ADR-012 §1)", () => {
  it("is host-only, HttpOnly, Secure, Lax, for 10 minutes", async () => {
    const line = setCookieOf(await app.request("/write-flow"));
    expect(OAUTH_COOKIE).toBe("__Host-vnx_oauth");
    expect(line).toContain("Path=/");
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Secure");
    expect(line).toContain("SameSite=Lax");
    expect(line).not.toMatch(/Domain=/i);
    expect(maxAgeOf(line)).toBeGreaterThanOrEqual(599);
    expect(maxAgeOf(line)).toBeLessThanOrEqual(600);
  });

  it("keeps a link intent for no more than 2 minutes", async () => {
    const line = setCookieOf(await app.request("/write-intent"));
    expect(maxAgeOf(line)).toBeGreaterThanOrEqual(119);
    expect(maxAgeOf(line)).toBeLessThanOrEqual(120);
  });

  it("reads back what it wrote, for the same provider only (F5)", async () => {
    const value = valueOf(setCookieOf(await app.request("/write-flow")));
    const same = await app.request("/read/github", { headers: { cookie: `${OAUTH_COOKIE}=${value}` } });
    expect(await same.json()).toMatchObject({ phase: "flow", provider: "github", intent: "signin", next: "/me", locale: "vi" });
    const other = await app.request("/read/google", { headers: { cookie: `${OAUTH_COOKIE}=${value}` } });
    expect(await other.json()).toBeNull();
  });

  it("reads null for a missing or tampered cookie", async () => {
    expect(await (await app.request("/read/github")).json()).toBeNull();
    expect(await (await app.request("/read/github", { headers: { cookie: `${OAUTH_COOKIE}=garbage` } })).json()).toBeNull();
  });

  it("is cleared with Max-Age=0 on the same path", async () => {
    const line = setCookieOf(await app.request("/clear"));
    expect(line).toContain("Max-Age=0");
    expect(line).toContain("Path=/");
    expect(line).toContain("Secure");
  });

  it("hashes the session for a link intent with a fixed prefix, never as the session's own id_hash (S1)", async () => {
    const hash = await linkSessionHash("raw-session");
    expect(hash).toBe(await sha256Hex("oauth-link:raw-session"));
    expect(hash).not.toBe(await sha256Hex("raw-session"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
