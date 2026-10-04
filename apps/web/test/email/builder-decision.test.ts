import { describe, expect, it } from "vitest";
import { builderApprovedEmail, builderRejectedEmail } from "../../src/email/templates/builder-decision.ts";

describe("builder decision e-mails", () => {
  it("approval links the profile and the hub in the builder's language", () => {
    const mail = builderApprovedEmail("vi", { name: "Lan", profileUrl: "https://vnx.si/vi/b/lan", hubUrl: "https://vnx.si/vi/hub" });
    expect(mail.subject).toBe("Hồ sơ builder của bạn trên VNX.SI đã được duyệt");
    expect(mail.text).toContain("Chào Lan");
    expect(mail.text).toContain("https://vnx.si/vi/b/lan");
    expect(mail.html).toContain('<a href="https://vnx.si/vi/hub">');
  });

  it("rejection carries the reason, escaped in HTML", () => {
    const mail = builderRejectedEmail("en", { name: "<b>Lan</b>", reason: "Add <i>real</i> projects", profileUrl: "https://vnx.si/hub/profile" });
    expect(mail.text).toContain("Add <i>real</i> projects");
    expect(mail.html).toContain("Add &lt;i&gt;real&lt;/i&gt; projects");
    expect(mail.html).toContain("&lt;b&gt;Lan&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Lan</b>");
  });
});
