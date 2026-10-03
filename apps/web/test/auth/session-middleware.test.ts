import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { sessionMiddleware } from "../../src/auth/middleware.ts";
import { createSession } from "../../src/auth/sessions.ts";
import { createUser } from "../../src/db/users.ts";
import type { AppEnv, Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

const app = new Hono<AppEnv>();
app.use("*", sessionMiddleware);
app.get("/x", (c) => c.text(c.get("user") ? "user" : "anon"));

const get = (cookie: string, env: Bindings = testEnv) =>
  app.request("https://vnx.si/x", { headers: { cookie: `__Host-vnx_session=${cookie}` } }, env);

describe("sessionMiddleware", () => {
  it("treats a malformed cookie as anonymous without querying", async () => {
    const throwing = { ...testEnv, DB: { prepare() { throw new Error("must not query"); } } } as unknown as Bindings;
    const res = await get("not-a-token", throwing);
    expect(await res.text()).toBe("anon");
  });

  it("resolves a valid session", async () => {
    const now = new Date();
    const u = await createUser(testEnv.DB, { email: "mw@vnx.si", locale: "en", now: now.toISOString() });
    const sid = await createSession(testEnv.DB, u.id, now);
    expect(await (await get(sid)).text()).toBe("user");
  });

  it("fails open to anonymous when D1 errors", async () => {
    const down = { ...testEnv, DB: { prepare() { throw new Error("d1 down"); } } } as unknown as Bindings;
    const res = await get("A".repeat(43), down);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("anon");
  });
});
