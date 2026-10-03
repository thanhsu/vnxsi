import type { Bindings } from "../env.ts";
import { ConsoleMailer } from "./console.ts";
import { FakeMailer } from "./fake.ts";
import type { Mailer } from "./mailer.ts";
import { ResendMailer } from "./resend.ts";

const DEFAULT_FROM = "VNX.SI <noreply@vnx.si>";

export function getMailer(env: Bindings): Mailer {
  if (env.MAIL_DRIVER === "fake") return new FakeMailer();
  if (env.RESEND_API_KEY) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM ?? DEFAULT_FROM);
  return new ConsoleMailer();
}
