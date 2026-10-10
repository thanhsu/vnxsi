import { describe, expect, it } from "vitest";
import type { Locale } from "../../src/i18n/locales.ts";
import { formatUtc, identityLinkedEmail, identityUnlinkedEmail } from "../../src/email/templates/identity.ts";

const AT = "2026-10-09T07:05:33.123Z";
const input = { provider: "github", label: "lan-nguyen", at: AT, manageUrl: "https://vnx.si/me" } as const;
const SUBJECTS: Record<Locale, [string, string]> = {
  en: ["GitHub was linked to your VNX.SI account", "GitHub was unlinked from your VNX.SI account"],
  vi: ["Đã liên kết GitHub với tài khoản VNX.SI của bạn", "Đã hủy liên kết GitHub khỏi tài khoản VNX.SI của bạn"],
  "zh-Hans": ["GitHub 已关联到你的 VNX.SI 账户", "GitHub 已从你的 VNX.SI 账户取消关联"],
  "zh-Hant": ["GitHub 已連結到你的 VNX.SI 帳戶", "GitHub 已從你的 VNX.SI 帳戶取消連結"],
};
const SESSIONS: Record<Locale, string> = {
  en: "Every device that was signed in with it has been signed out.",
  vi: "Mọi thiết bị đang đăng nhập bằng tài khoản đó đã được đăng xuất.",
  "zh-Hans": "所有用该账号登录的设备都已退出登录。",
  "zh-Hant": "所有用該帳號登入的裝置都已登出。",
};
const UNLINK_WORD: Record<Locale, string> = { en: "unlink", vi: "hủy liên kết", "zh-Hans": "取消关联", "zh-Hant": "取消連結" };

describe("formatUtc", () => {
  it("is the ISO instant to the minute, in UTC", () => {
    expect(formatUtc(AT)).toBe("2026-10-09 07:05 UTC");
  });
});

describe("identity e-mails (VNX-2605b)", () => {
  for (const [locale, [linked, unlinked]] of Object.entries(SUBJECTS) as Array<[Locale, [string, string]]>) {
    it(`${locale}: subject, provider, label, UTC time, the Not-you line and contact@vnx.si`, () => {
      const a = identityLinkedEmail(locale, input);
      const b = identityUnlinkedEmail(locale, input);
      expect(a.subject).toBe(linked);
      expect(b.subject).toBe(unlinked);
      for (const mail of [a, b]) {
        expect(mail.text).toContain("GitHub");
        expect(mail.text).toContain("lan-nguyen");
        expect(mail.text).toContain("2026-10-09 07:05 UTC");
        expect(mail.text).toContain("contact@vnx.si");
        expect(mail.text).toContain("/me");
        expect(mail.html).toContain(`lang="${locale}"`);
        expect(mail.html).toContain("contact@vnx.si");
      }
      expect(b.text).toContain(SESSIONS[locale]);
      expect(b.html).toContain(SESSIONS[locale]);
      expect(a.text).not.toContain(SESSIONS[locale]);
      expect(a.html).not.toContain(SESSIONS[locale]);
      expect(a.text.toLowerCase()).toContain(UNLINK_WORD[locale]); // the linked mail tells the owner how to undo it
    });
  }

  it("leaves out the Account line when the label is just the provider name", () => {
    const mail = identityLinkedEmail("en", { ...input, label: "GitHub" });
    expect(mail.text).not.toContain("Account:");
    expect(mail.html).not.toContain("Account:");
    expect(identityLinkedEmail("en", input).text).toContain("Account: lan-nguyen");
  });

  it("escapes the label in html and keeps it verbatim in text", () => {
    const mail = identityLinkedEmail("en", { ...input, label: '<script>x</script>"&' });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;x&lt;/script&gt;&quot;&amp;");
    expect(mail.text).toContain('<script>x</script>"&');
  });

  it("carries no action: the only URL is the plain /me link, with no query or fragment", () => {
    for (const mail of [identityLinkedEmail("vi", input), identityUnlinkedEmail("zh-Hant", input)]) {
      const urls = `${mail.text} ${mail.html}`.match(/https?:\/\/[^\s"<]+/g) ?? [];
      expect([...new Set(urls)]).toEqual(["https://vnx.si/me"]);
      expect(`${mail.text}${mail.html}`).not.toMatch(/[?&]t=|token|code=|state=|verify/i);
    }
  });
});
