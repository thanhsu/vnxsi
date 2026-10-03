import type { EmailMessage, Mailer } from "./mailer.ts";

/** Local development: prints the email instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage) {
    console.log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}
