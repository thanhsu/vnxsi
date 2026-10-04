import type { Bindings } from "../env.ts";

export const TURNSTILE_FIELD = "cf-turnstile-response";
/** Token the fake driver accepts (tests only). */
export const FAKE_TURNSTILE_PASS = "test-pass";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileEnv = Pick<Bindings, "TURNSTILE_DRIVER" | "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET" | "MAIL_DRIVER">;

// The fake driver counts only next to the fake mailer: production never runs that mailer, while the test env shares
// APP_ORIGIN with production, so the origin cannot be the signal.
const isFake = (env: TurnstileEnv) => env.TURNSTILE_DRIVER === "fake" && env.MAIL_DRIVER === "fake";

/** The site key to render, or null when Turnstile is not fully configured (the signed-out form then fails closed). */
export function turnstileSiteKey(env: TurnstileEnv): string | null {
  if (isFake(env)) return "fake-site-key";
  const site = env.TURNSTILE_SITE_KEY?.trim();
  return site && env.TURNSTILE_SECRET?.trim() ? site : null;
}

/** "unavailable" = not configured or the service could not answer; callers refuse the form (Owner 2026-10-04). */
export async function verifyTurnstile(env: TurnstileEnv, token: unknown, ip: string | null): Promise<"pass" | "fail" | "unavailable"> {
  if (isFake(env)) return token === FAKE_TURNSTILE_PASS ? "pass" : "fail";
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret || !env.TURNSTILE_SITE_KEY?.trim()) return "unavailable";
  if (typeof token !== "string" || token === "" || token.length > 2048) return "fail";
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? "pass" : "fail";
  } catch {
    return "unavailable";
  }
}
