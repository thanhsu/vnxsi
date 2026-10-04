export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Where a reply goes (VNX-0710: the contact form sender). Omitted = replies go to the From address. */
  replyTo?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export class MailError extends Error {
  override name = "MailError";
}
