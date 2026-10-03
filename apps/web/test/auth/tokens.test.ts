import { describe, expect, it } from "vitest";
import { consumeLoginToken, createLoginToken, LOGIN_TOKEN_TTL_MS } from "../../src/auth/tokens.ts";
import { testEnv } from "../helpers.ts";

const now = new Date("2026-10-03T09:00:00Z");

describe("login tokens", () => {
  it("creates a 43-char base64url token and consumes it once", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "lan@example.vn", purpose: "login", locale: "vi" }, now);
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const first = await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + 1000));
    expect(first).toEqual({
      ok: true,
      token: { email: "lan@example.vn", purpose: "login", locale: "vi", inquiryId: null, requestId: null, inviteCodeHash: null },
    });
    expect(await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + 2000))).toEqual({ ok: false, reason: "used" });
  });

  it("concurrent consumption succeeds exactly once", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "x@vnx.si", purpose: "login", locale: "en" }, now);
    const later = new Date(now.getTime() + 1000);
    const results = await Promise.all([consumeLoginToken(testEnv.DB, raw, later), consumeLoginToken(testEnv.DB, raw, later)]);
    expect(results.filter((r) => r.ok).length).toBe(1);
  });

  it("rejects expired and unknown tokens", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "e@vnx.si", purpose: "login", locale: "en" }, now);
    expect(await consumeLoginToken(testEnv.DB, raw, new Date(now.getTime() + LOGIN_TOKEN_TTL_MS + 1))).toEqual({ ok: false, reason: "expired" });
    expect(await consumeLoginToken(testEnv.DB, "A".repeat(43), now)).toEqual({ ok: false, reason: "invalid" });
    expect(await consumeLoginToken(testEnv.DB, "short", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("stores only the hash", async () => {
    const raw = await createLoginToken(testEnv.DB, { email: "h@vnx.si", purpose: "login", locale: "en" }, now);
    const row = await testEnv.DB.prepare("SELECT token_hash FROM login_tokens WHERE email = 'h@vnx.si'").first<{ token_hash: string }>();
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toBe(raw);
  });
});
