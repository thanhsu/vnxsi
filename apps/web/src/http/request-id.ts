import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") ?? crypto.randomUUID());
  await next();
};
