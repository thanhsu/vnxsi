import type { Hono } from "hono";
import { MEDIA_KEY_RE } from "../domain/image.ts";
import type { AppEnv } from "../env.ts";

export function registerMediaRoutes(app: Hono<AppEnv>) {
  // Keys are unguessable ULIDs, so images of unpublished products are readable by key only (spec §8.5).
  app.get("/media/*", async (c) => {
    const key = c.req.path.slice("/media/".length);
    if (!MEDIA_KEY_RE.test(key)) return c.text("Not found", 404);
    // No R2 binding yet (VNX-0711): there can be no image to serve.
    if (!c.env.MEDIA) return c.text("Not found", 404);
    const object = await c.env.MEDIA.get(key);
    if (!object) return c.text("Not found", 404);
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        etag: object.httpEtag,
      },
    });
  });
}
