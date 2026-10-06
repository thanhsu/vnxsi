import { createApp } from "./app.ts";
import type { Bindings } from "./env.ts";
import { runDaily } from "./jobs/daily.ts";
import { runHourly } from "./jobs/hourly.ts";

const app = createApp();

export default {
  fetch: app.fetch,
  // Cron triggers in wrangler.jsonc (spec §8.4 / ARCHITECTURE §5).
  scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    if (controller.cron === "0 1 * * *") ctx.waitUntil(runDaily(env, now));
    else if (controller.cron === "5 * * * *") ctx.waitUntil(runHourly(env, now));
    else console.warn(JSON.stringify({ job: "scheduler", event: "unknown_cron", cron: controller.cron }));
  },
} satisfies ExportedHandler<Bindings>;
