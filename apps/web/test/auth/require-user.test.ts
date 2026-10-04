import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireUser, sessionMiddleware } from "../../src/auth/middleware.ts";
import type { AppEnv } from "../../src/env.ts";
import { safeNext } from "../../src/http/next.ts";
import { localeMiddleware } from "../../src/i18n/middleware.ts";
import { testEnv } from "../helpers.ts";

const app = new Hono<AppEnv>();
app.use("*", localeMiddleware, sessionMiddleware);
app.get("/vi/hub/x", requireUser, (c) => c.text("ok"));

describe("requireUser", () => {
  it("keeps the query string in next, and safeNext accepts it", async () => {
    const res = await app.request("https://vnx.si/vi/hub/x?a=1&b=2", {}, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/login?next=%2Fvi%2Fhub%2Fx%3Fa%3D1%26b%3D2");
    expect(safeNext("/vi/hub/x?a=1&b=2")).toBe("/vi/hub/x?a=1&b=2");
  });
});
