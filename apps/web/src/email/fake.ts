import type { EmailMessage, Mailer } from "./mailer.ts";

/** In-memory outbox shared by the test isolate (whole messages, replyTo included). Never used in production. */
export const outbox: EmailMessage[] = [];

export function clearOutbox() {
  outbox.length = 0;
}

export class FakeMailer implements Mailer {
  async send(message: EmailMessage) {
    outbox.push(message);
  }
}
