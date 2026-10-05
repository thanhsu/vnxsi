import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS, turnstileSiteKey, verifyTurnstile } from "../../src/http/turnstile.ts";
import { testEnv } from "../helpers.ts";

const real = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET: "secret" } as Bindings;

describe("Turnstile (spec §8.2; fail closed, Owner 2026-10-04)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the fake driver in tests", async () => {
    expect(turnstileSiteKey(testEnv)).toBe("fake-site-key");
    expect(await verifyTurnstile(testEnv, FAKE_TURNSTILE_PASS, null)).toBe("pass");
    expect(await verifyTurnstile(testEnv, "nope", null)).toBe("fail");
  });

  it("honours the fake driver only alongside the fake mailer", async () => {
    const prodLike = { ...testEnv, MAIL_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    expect(prodLike.TURNSTILE_DRIVER).toBe("fake");
    expect(turnstileSiteKey(prodLike)).toBeNull();
    expect(await verifyTurnstile(prodLike, FAKE_TURNSTILE_PASS, null)).toBe("unavailable");
  });

  it("drops the fake driver when a real mail key is set, even with MAIL_DRIVER=fake (VNX-0803 F6)", async () => {
    const misconfigured = { ...testEnv, RESEND_API_KEY: "re_live_key", TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    expect(misconfigured.MAIL_DRIVER).toBe("fake");
    expect(turnstileSiteKey(misconfigured)).toBeNull();
    expect(await verifyTurnstile(misconfigured, FAKE_TURNSTILE_PASS, null)).toBe("unavailable");
  });

  it("is unavailable without both keys", async () => {
    const noSecret = { ...real, TURNSTILE_SECRET: undefined } as Bindings;
    const noSite = { ...real, TURNSTILE_SITE_KEY: "" } as Bindings;
    expect(turnstileSiteKey(noSecret)).toBeNull();
    expect(turnstileSiteKey(noSite)).toBeNull();
    expect(await verifyTurnstile(noSecret, "tok", null)).toBe("unavailable");
    expect(await verifyTurnstile(noSite, "tok", null)).toBe("unavailable");
  });

  it("asks siteverify and reads success", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile(real, "tok", "203.0.113.9")).toBe("pass");
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("fails on a rejected or missing token and is unavailable when the service errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstile(real, "tok", null)).toBe("fail");
    expect(await verifyTurnstile(real, "", null)).toBe("fail");
    expect(await verifyTurnstile(real, ["a"], null)).toBe("fail");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
    expect(await verifyTurnstile(real, "tok", null)).toBe("unavailable");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await verifyTurnstile(real, "tok", null)).toBe("unavailable");
  });
});
