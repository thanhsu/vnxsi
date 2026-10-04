import { MailError, type EmailMessage, type Mailer } from "./mailer.ts";

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {}

  async send(message: EmailMessage) {
    const res = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new MailError(`Resend responded ${res.status}`);
  }
}
