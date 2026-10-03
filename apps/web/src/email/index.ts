import type { Bindings } from "../env.ts";
import { ConsoleMailer } from "./console.ts";
import { FakeMailer } from "./fake.ts";
import type { Mailer } from "./mailer.ts";
import { ResendMailer } from "./resend.ts";
import { UnconfiguredMailer } from "./unconfigured.ts";

const DEFAULT_FROM = "VNX.SI <noreply@vnx.si>";

export function getMailer(env: Bindings): Mailer {
  if (env.MAIL_DRIVER === "fake") return new FakeMailer();
  if (env.MAIL_DRIVER === "console") return new ConsoleMailer();
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey) return new ResendMailer(apiKey, env.MAIL_FROM ?? DEFAULT_FROM);
  return new UnconfiguredMailer();
}
