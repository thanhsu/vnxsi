import { describe, expect, it } from "vitest";
import { productApprovedEmail, productChangesEmail } from "../../src/email/templates/product-decision.ts";

describe("product decision e-mails", () => {
  it("approval links the public page and the hub", () => {
    const mail = productApprovedEmail("vi", { name: "Spa Kit", productUrl: "https://vnx.si/vi/p/spa-kit", hubUrl: "https://vnx.si/vi/hub/products" });
    expect(mail.subject).toBe("Sản phẩm của bạn trên VNX.SI đã được duyệt");
    expect(mail.text).toContain("Spa Kit");
    expect(mail.text).toContain("https://vnx.si/vi/p/spa-kit");
  });

  it("change requests carry the admin note, escaped in HTML", () => {
    const mail = productChangesEmail("en", { name: "<b>Kit</b>", note: "Use <real> screenshots", editUrl: "https://vnx.si/hub/products/X/edit/demo" });
    expect(mail.text).toContain("Use <real> screenshots");
    expect(mail.html).toContain("Use &lt;real&gt; screenshots");
    expect(mail.html).not.toContain("<b>Kit</b>");
  });
});
