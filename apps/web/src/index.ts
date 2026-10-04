import { createApp } from "./app.ts";
import type { Bindings } from "./env.ts";
import { runDaily } from "./jobs/daily.ts";

const app = createApp();

export default {
  fetch: app.fetch,
  // Cron `0 1 * * *` in wrangler.jsonc (spec §8.4 / ARCHITECTURE §5). The hourly "5 * * * *" job arrives with M7.
  scheduled(controller, env, ctx) {
    if (controller.cron === "0 1 * * *") ctx.waitUntil(runDaily(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Bindings>;
