import { describe, expect, it, vi } from "vitest";
import { MailError } from "../../src/email/mailer.ts";
import { ResendMailer } from "../../src/email/resend.ts";

const message = { to: "lan@example.vn", subject: "Hi", text: "t", html: "<p>h</p>" };

describe("ResendMailer", () => {
  it("posts the message to Resend with the API key", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    await new ResendMailer("re_test", "VNX.SI <noreply@vnx.si>", fetchFn).send(message);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "VNX.SI <noreply@vnx.si>",
      to: ["lan@example.vn"],
      subject: "Hi",
      text: "t",
      html: "<p>h</p>",
    });
  });

  it("throws MailError on a non-2xx response", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 422 }));
    await expect(new ResendMailer("k", "f", fetchFn).send(message)).rejects.toBeInstanceOf(MailError);
  });
});
