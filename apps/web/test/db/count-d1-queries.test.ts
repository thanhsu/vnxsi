import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { isFlagEnabled } from "../../src/db/flags.ts";
import { countD1Queries, getReq, testEnv } from "../helpers.ts";

describe("countD1Queries (VNX-2702a)", () => {
  it("counts first, all, run and raw as one each, and a batch as its statement count", async () => {
    const { env, queries } = countD1Queries();
    expect(queries()).toBe(0);
    await env.DB.prepare("SELECT 1 AS x").first();
    await env.DB.prepare("SELECT ?1 AS x").bind(1).all();
    await env.DB.prepare("SELECT 3 AS x").run();
    await env.DB.prepare("SELECT 4 AS x").raw();
    expect(queries()).toBe(4);
    const results = await env.DB.batch([env.DB.prepare("SELECT 5 AS x"), env.DB.prepare("SELECT ?1 AS x").bind(6), env.DB.prepare("SELECT 7 AS x")]);
    expect(results.map((r) => (r.results[0] as { x: number }).x)).toEqual([5, 6, 7]);
    expect(queries()).toBe(7);
  });

  it("leaves testEnv alone and keeps every other binding", () => {
    const { env } = countD1Queries();
    expect(env).not.toBe(testEnv);
    expect(env.DB).not.toBe(testEnv.DB);
    expect(env.APP_ORIGIN).toBe(testEnv.APP_ORIGIN);
    expect(env.ADMIN_EMAILS).toBe(testEnv.ADMIN_EMAILS);
    expect(env.MEDIA).toBe(testEnv.MEDIA);
  });

  it("counts the flag read of a cold flag cache and none on the second read", async () => {
    const { env, queries } = countD1Queries();
    await isFlagEnabled(env.DB, "partner_referral");
    const first = queries();
    expect(first).toBe(1);
    await isFlagEnabled(env.DB, "partner_referral");
    expect(queries()).toBe(first);
  });

  it("works through createApp().request and sees the queries of a real request", async () => {
    const { env, queries } = countD1Queries();
    const res = await createApp().request(getReq("/"), undefined, env);
    expect(res.status).toBe(200);
    expect(queries()).toBeGreaterThan(0);
  });
});
