import { deleteExpiredSessions } from "../auth/sessions.ts";
import { deleteExpiredLoginTokens } from "../auth/tokens.ts";
import type { Bindings } from "../env.ts";
import { deleteOldRateLimitWindows } from "../http/rate-limit.ts";

/**
 * Daily job, cron `0 1 * * *` (spec §8.4). VNX-0705a: deletes expired data so the Privacy page stays true.
 * VNX-0505 (M5) adds its steps here instead of a second scheduled handler.
 */
export type DailyResult = { job: "daily"; step: string; deleted: number } | { job: "daily"; step: string; error: string };

type Step = { step: string; run: (env: Pick<Bindings, "DB">, now: Date) => Promise<number> };

const STEPS: Step[] = [
  { step: "rate_limits", run: (env, now) => deleteOldRateLimitWindows(env.DB, now.getTime()) },
  { step: "login_tokens", run: (env, now) => deleteExpiredLoginTokens(env.DB, now) },
  { step: "sessions", run: (env, now) => deleteExpiredSessions(env.DB, now) },
];

/** Runs every step in order; a failing step is logged and does not stop the next one. Running twice is harmless. */
export async function runDaily(env: Pick<Bindings, "DB">, now: Date): Promise<DailyResult[]> {
  const results: DailyResult[] = [];
  for (const { step, run } of STEPS) {
    try {
      const result: DailyResult = { job: "daily", step, deleted: await run(env, now) };
      console.log(JSON.stringify(result));
      results.push(result);
    } catch (err) {
      const result: DailyResult = { job: "daily", step, error: String(err) };
      console.error(JSON.stringify(result));
      results.push(result);
    }
  }
  return results;
}
