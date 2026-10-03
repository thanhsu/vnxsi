import { Hono } from "hono";
import type { AppEnv } from "./env.ts";
import { requestId } from "./http/request-id.ts";
import { handleWaitlist } from "./routes/waitlist.ts";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("/api/waitlist", (c) => handleWaitlist(c.req.raw, c.env));
  app.all("/api/*", (c) => c.json({ ok: false, error: "Not found" }, 404));

  app.onError((err, c) => {
    const id = c.get("requestId");
    console.error(JSON.stringify({ requestId: id, path: c.req.path, error: String(err) }));
    if (c.req.path.startsWith("/api/")) return c.json({ ok: false, error: "Internal error", requestId: id }, 500);
    return c.text(`Something went wrong. Reference: ${id}`, 500);
  });

  app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}
