import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

describe("localized error pages", () => {
  it("renders a Vietnamese 404 under /vi", async () => {
    const res = await createApp().request("https://vnx.si/vi/khong-co", {}, testEnv);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="vi"');
    expect(html).toContain("Không tìm thấy trang");
    expect(html).toContain('hreflang="zh-Hant"');
    expect(html).toContain('href="https://vnx.si/zh-hant/khong-co"');
  });

  it("does not emit protocol-relative links for //-prefixed paths", async () => {
    const res = await createApp().request("https://vnx.si/vi//evil.com", {}, testEnv);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('href="//');
  });

  it("renders a localized 500 with the reference id", async () => {
    const app = createApp();
    app.get("/zh-hans/boom", () => {
      throw new Error("x");
    });
    const res = await app.request("https://vnx.si/zh-hans/boom", { headers: { "cf-ray": "ray-9" } }, testEnv);
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("出错了");
    expect(html).toContain("ray-9");
  });
});
