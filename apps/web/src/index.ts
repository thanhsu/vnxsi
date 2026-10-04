import { createApp } from "./app.ts";
import type { Bindings } from "./env.ts";
import { runDaily } from "./jobs/daily.ts";

const app = createApp();

export default {
  fetch: app.fetch,
  // Cron `0 1 * * *` in wrangler.jsonc (spec §8.4).
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runDaily(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Bindings>;
