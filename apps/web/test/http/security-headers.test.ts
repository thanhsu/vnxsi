import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { AppEnv } from "../../src/env.ts";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "../../src/http/security-headers.ts";
import { getReq, testEnv } from "../helpers.ts";

describe("securityHeaders middleware (VNX-0803 F2)", () => {
  const app = new Hono<AppEnv>();
  app.use("*", securityHeaders);
  app.get("/raw", () => new Response("raw"));
  app.get("/own", (c) => {
    c.header("Referrer-Policy", "no-referrer");
    return c.text("own");
  });

  it("adds every header, also to a response built outside Hono", async () => {
    const res = await app.request("https://vnx.si/raw", {}, testEnv);
    expect(res.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("keeps a header the route set itself", async () => {
    const res = await app.request("https://vnx.si/own", {}, testEnv);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("names exactly the sources the pages use", () => {
    expect(CONTENT_SECURITY_POLICY.split("; ")).toEqual([
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]);
  });
});

describe("security headers on the real app (VNX-0803 F2)", () => {
  it("covers pages, assets, 404s, API and errors", async () => {
    const app = createApp();
    for (const path of ["/", "/login", "/vi/products", "/assets/app.css", "/zh-hant/nope", "/api/nope", "/robots.txt", "/media/nope"]) {
      const res = await app.request(getReq(path), undefined, testEnv);
      expect(res.headers.get("content-security-policy"), path).toBe(CONTENT_SECURITY_POLICY);
      expect(res.headers.get("x-frame-options"), path).toBe("DENY");
      expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(res.headers.get("referrer-policy"), path).not.toBeNull();
    }
  });

  it("sends no referrer from the magic-link and invite pages, the default elsewhere", async () => {
    const app = createApp();
    const get = (path: string) => app.request(getReq(path), undefined, testEnv);
    expect((await get("/auth/verify?t=nope")).headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get(`/join/${"a".repeat(22)}`)).headers.get("referrer-policy")).toBe("no-referrer");
    expect((await get("/login")).headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("CSP needs nothing inline: no page carries a style attribute, an event handler or an executable inline script", async () => {
    const app = createApp();
    // EPIC 21 public pages too: /disclosure, and /tools/:slug (404 page here, no active merchant in the test DB).
    for (const path of ["/", "/login", "/products", "/builders", "/request", "/contact", "/terms", "/privacy", "/media-kit", "/disclosure", "/tools/nope", "/vi", "/zh-hans/contact", "/auth/verify?t=nope"]) {
      const html = await (await app.request(getReq(path), undefined, testEnv)).text();
      expect(html, path).not.toMatch(/\sstyle="/);
      expect(html, path).not.toMatch(/\son[a-z]+="/);
      for (const m of html.matchAll(/<script\b[^>]*>/g)) {
        expect(m[0], `${path}: ${m[0]}`).toMatch(/^<script (src="\/assets\/[^"]+"|src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"|type="application\/ld\+json")/);
      }
    }
  });
});
