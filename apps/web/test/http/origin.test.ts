import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/env.ts";
import { originCheck } from "../../src/http/origin.ts";
import { testEnv } from "../helpers.ts";

const app = new Hono<AppEnv>();
app.use("*", originCheck);
app.all("/x", (c) => c.text("ok"));

describe("originCheck", () => {
  it("allows safe methods without Origin", async () => {
    expect((await app.request("https://vnx.si/x", {}, testEnv)).status).toBe(200);
  });

  it("requires a same-origin Origin on POST", async () => {
    const post = (origin?: string) =>
      app.request("https://vnx.si/x", { method: "POST", headers: origin ? { origin } : {} }, testEnv);
    expect((await post()).status).toBe(403);
    expect((await post("https://evil.example")).status).toBe(403);
    expect((await post("https://vnx.si")).status).toBe(200);
  });

  it("also accepts APP_ORIGIN when the request URL host differs (wrangler dev routes)", async () => {
    const post = (origin: string) => app.request("http://vnx.si/x", { method: "POST", headers: { origin } }, testEnv);
    expect((await post("https://vnx.si")).status).toBe(200);
    expect((await post("https://evil.example")).status).toBe(403);
  });
});
