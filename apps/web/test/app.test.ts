import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { testEnv } from "./helpers.ts";

describe("app skeleton", () => {
  it("serves /api/health", async () => {
    const res = await createApp().request("https://vnx.si/api/health", {}, testEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns JSON 404 for unknown /api routes", async () => {
    const res = await createApp().request("https://vnx.si/api/nope", {}, testEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Not found" });
  });

  it("keeps /api/waitlist validation behaviour", async () => {
    const res = await createApp().request(
      "https://vnx.si/api/waitlist",
      { method: "POST", headers: { "content-type": "application/json", origin: "https://vnx.si" }, body: "{oops" },
      testEnv,
    );
    expect(res.status).toBe(400);
  });

  it("falls back to static assets for unmatched paths", async () => {
    const res = await createApp().request("https://vnx.si/", {}, testEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<html");
  });

  it("renders a 500 with a reference id when a handler throws", async () => {
    const app = createApp();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    const res = await app.request("https://vnx.si/boom", { headers: { "cf-ray": "ray-123" } }, testEnv);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("ray-123");
  });
});
