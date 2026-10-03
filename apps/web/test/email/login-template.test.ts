import { describe, expect, it } from "vitest";
import { loginEmail } from "../../src/email/templates/login.ts";

describe("loginEmail", () => {
  it("is localized and contains the link in text and html", () => {
    const link = "https://vnx.si/auth/verify?t=abc&next=%2Fhub";
    const mail = loginEmail("vi", link);
    expect(mail.subject).toBe("Link đăng nhập VNX.SI của bạn");
    expect(mail.text).toContain(link);
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc&amp;next=%2Fhub"');
    expect(mail.html).toContain('lang="vi"');
  });

  it("escapes HTML in the link", () => {
    const mail = loginEmail("en", 'https://vnx.si/"><script>x</script>');
    expect(mail.html).not.toContain("<script>");
  });
});
