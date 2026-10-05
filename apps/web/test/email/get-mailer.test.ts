import { describe, expect, it } from "vitest";
import { getMailer } from "../../src/email/index.ts";
import { MailError } from "../../src/email/mailer.ts";
import { FakeMailer } from "../../src/email/fake.ts";
import { ConsoleMailer } from "../../src/email/console.ts";
import { ResendMailer } from "../../src/email/resend.ts";
import { testEnv } from "../helpers.ts";
import type { Bindings } from "../../src/env.ts";

describe("getMailer", () => {
  it("ignores the console and fake drivers once a real key exists (VNX-0803 F6)", () => {
    for (const driver of ["console", "fake"]) {
      const env = { ...testEnv, MAIL_DRIVER: driver, RESEND_API_KEY: "re_live_key" } as Bindings;
      expect(getMailer(env), driver).toBeInstanceOf(ResendMailer);
    }
  });

  it("returns FakeMailer when MAIL_DRIVER is 'fake'", () => {
    const env = { ...testEnv, MAIL_DRIVER: "fake", RESEND_API_KEY: undefined } as Bindings;
    const mailer = getMailer(env);
    expect(mailer).toBeInstanceOf(FakeMailer);
  });

  it("returns ConsoleMailer when MAIL_DRIVER is 'console'", () => {
    const env = { ...testEnv, MAIL_DRIVER: "console", RESEND_API_KEY: undefined } as Bindings;
    const mailer = getMailer(env);
    expect(mailer).toBeInstanceOf(ConsoleMailer);
  });

  it("returns ResendMailer when RESEND_API_KEY is set", () => {
    const env = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: "re_test_key" } as Bindings;
    const mailer = getMailer(env);
    expect(mailer).toBeInstanceOf(ResendMailer);
  });

  it("throws MailError when no driver is configured", async () => {
    const env = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
    const mailer = getMailer(env);
    const message = { to: "test@example.com", subject: "Hi", text: "t", html: "<p>h</p>" };
    await expect(mailer.send(message)).rejects.toBeInstanceOf(MailError);
    await expect(mailer.send(message)).rejects.toThrow("mail not configured");
  });

  it("throws MailError when RESEND_API_KEY is whitespace only", async () => {
    const env = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: "   " } as Bindings;
    const mailer = getMailer(env);
    const message = { to: "test@example.com", subject: "Hi", text: "t", html: "<p>h</p>" };
    await expect(mailer.send(message)).rejects.toBeInstanceOf(MailError);
    await expect(mailer.send(message)).rejects.toThrow("mail not configured");
  });
});
