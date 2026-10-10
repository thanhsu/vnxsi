import type { Context } from "hono";
import type { AppEnv } from "../env.ts";

/** waitUntil when the runtime has an ExecutionContext (Hono throws when it has none: tests, local), else wait for the write. */
export async function defer(c: Context<AppEnv>, work: Promise<void>): Promise<void> {
  let ctx: { waitUntil(promise: Promise<unknown>): void } | null = null;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = null;
  }
  if (ctx) ctx.waitUntil(work);
  else await work;
}
