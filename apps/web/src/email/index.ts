import type { Bindings } from "../env.ts";
import { ConsoleMailer } from "./console.ts";
import { FakeMailer } from "./fake.ts";
import type { Mailer } from "./mailer.ts";
import { ResendMailer } from "./resend.ts";
import { UnconfiguredMailer } from "./unconfigured.ts";

const DEFAULT_FROM = "VNX.SI <noreply@vnx.si>";

const realKey = (env: Pick<Bindings, "RESEND_API_KEY">) => env.RESEND_API_KEY?.trim() || null;

/**
 * Review VNX-0803 F6: the fake and console drivers (tests, local dev) only count while no real key exists. A production
 * environment always has RESEND_API_KEY, so a stray MAIL_DRIVER can neither swallow mail nor print magic links to the logs.
 * The fake Turnstile driver is tied to this too (http/turnstile.ts).
 */
export function isFakeMail(env: Pick<Bindings, "MAIL_DRIVER" | "RESEND_API_KEY">): boolean {
  return env.MAIL_DRIVER === "fake" && realKey(env) === null;
}

export function getMailer(env: Bindings): Mailer {
  const apiKey = realKey(env);
  if (apiKey) return new ResendMailer(apiKey, env.MAIL_FROM ?? DEFAULT_FROM);
  if (env.MAIL_DRIVER === "fake") return new FakeMailer();
  if (env.MAIL_DRIVER === "console") return new ConsoleMailer();
  return new UnconfiguredMailer();
}
