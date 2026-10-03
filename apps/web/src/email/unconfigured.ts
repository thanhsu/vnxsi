import { MailError, type EmailMessage, type Mailer } from "./mailer.ts";

/** Fails safely when no mail driver is configured. Logs nothing. */
export class UnconfiguredMailer implements Mailer {
  async send(_message: EmailMessage) {
    throw new MailError("mail not configured");
  }
}
