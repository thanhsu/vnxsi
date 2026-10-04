import { describe, expect, it } from "vitest";
import {
  inquiryAdminAlertEmail,
  inquiryConfirmEmail,
  inquiryDeclinedEmail,
  inquiryMessageEmail,
  inquiryReminderEmail,
  newInquiryEmail,
} from "../../src/email/templates/inquiry.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { BUDGET_KEY, INQUIRY_TYPE_KEY } from "../../src/views/labels.ts";

describe("inquiry e-mail templates (spec §8.3)", () => {
  it("asks the client to confirm, in their locale", () => {
    const mail = inquiryConfirmEmail("vi", { builderName: "Lan", productName: "Spa Booking", link: "https://vnx.si/auth/verify?t=abc" });
    expect(mail.subject).toBe("Xác nhận yêu cầu của bạn trên VNX.SI");
    expect(mail.text).toContain("Lan");
    expect(mail.text).toContain("https://vnx.si/auth/verify?t=abc");
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc"');
  });

  it("renders the new-inquiry e-mail byte for byte (guards the move of the HTML helpers to email/parts.ts)", () => {
    const mail = newInquiryEmail("en", { clientName: "Minh", type: "customize", productName: "Spa Booking", budgetBand: "2k-10k", deadline: "2026-12-01", message: "Line one\nLine <two>", url: "https://vnx.si/hub/inquiries/01J" });
    expect(mail.html).toBe(
      '<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0D1526">' +
        "<p>Minh sent you an inquiry (Customize) about Spa Booking.</p><p>Budget: $2,000 – $10,000</p><p>Deadline: 2026-12-01</p>" +
        '<blockquote style="white-space:pre-line;border-left:3px solid #DCE0E6;margin:0;padding-left:12px">Line one\nLine &lt;two&gt;</blockquote>' +
        "<p>Reply on VNX.SI (replies by e-mail are not delivered):</p>" +
        '<p><a href="https://vnx.si/hub/inquiries/01J">https://vnx.si/hub/inquiries/01J</a></p></body></html>',
    );
  });

  it("tells the builder about a new inquiry with type, budget, deadline and the message", () => {
    const mail = newInquiryEmail("en", {
      clientName: "Minh",
      type: "customize",
      productName: "Spa Booking",
      budgetBand: "2k-10k",
      deadline: "2026-12-01",
      message: "Line one\nLine <two>",
      url: "https://vnx.si/hub/inquiries/01J",
    });
    expect(mail.subject).toBe("New inquiry: Customize from Minh");
    for (const text of ["Minh sent you an inquiry (Customize) about Spa Booking.", "Budget: $2,000 – $10,000", "Deadline: 2026-12-01", "Line <two>", "https://vnx.si/hub/inquiries/01J"]) {
      expect(mail.text, text).toContain(text);
    }
    expect(mail.html).toContain("Line &lt;two&gt;");
    expect(mail.html).not.toContain("<two>");
  });

  it("names the builder's services when there is no product, and omits an empty deadline", () => {
    const mail = newInquiryEmail("en", { clientName: "Minh", type: "hire", productName: null, budgetBand: "unsure", deadline: null, message: "Hello there, need help.", url: "https://vnx.si/x" });
    expect(mail.text).toContain("about your services.");
    expect(mail.text).not.toContain("Deadline");
  });

  it("escapes names and bodies in every template", () => {
    const evil = '<img src=x onerror="a()">';
    const mails = [
      inquiryMessageEmail("en", { fromName: evil, productName: evil, body: evil, url: "https://vnx.si/x" }),
      inquiryDeclinedEmail("en", { builderName: evil, productName: evil, reason: evil, url: "https://vnx.si/x" }),
      inquiryReminderEmail("en", { clientName: evil, productName: evil, url: "https://vnx.si/x" }),
      inquiryAdminAlertEmail([{ id: "01J", builderHandle: evil, productName: evil, openedAt: "2026-09-20T00:00:00.000Z" }], "https://vnx.si/admin/inquiries"),
    ];
    for (const mail of mails) {
      expect(mail.html).not.toContain("<img");
      expect(mail.html).toContain("&lt;img");
    }
  });

  it("leaves the reason out of a decline without one", () => {
    const mail = inquiryDeclinedEmail("zh-Hant", { builderName: "Lan", productName: "Spa", reason: "", url: "https://vnx.si/zh-hant/products" });
    expect(mail.subject).toBe("Lan 婉拒了你的詢問");
    expect(mail.text).not.toContain("對方的說明");
  });

  it("lists overdue inquiries for the admins in English", () => {
    const mail = inquiryAdminAlertEmail(
      [
        { id: "01A", builderHandle: "lan", productName: "Spa", openedAt: "2026-09-20T08:00:00.000Z" },
        { id: "01B", builderHandle: "binh", productName: null, openedAt: "2026-09-21T08:00:00.000Z" },
      ],
      "https://vnx.si/admin/inquiries?status=open",
    );
    expect(mail.subject).toBe("2 inquiries unanswered for 7 days");
    expect(mail.text).toContain("01A · @lan · Spa · opened 2026-09-20");
    expect(mail.text).toContain("01B · @binh · (builder profile) · opened 2026-09-21");
  });

  it("uses the same labels as the pages", () => {
    const mail = newInquiryEmail("en", { clientName: "A", type: "build_similar", productName: "P", budgetBand: ">10k", deadline: null, message: "x".repeat(20), url: "https://vnx.si/x" });
    expect(mail.text).toContain(en[INQUIRY_TYPE_KEY.build_similar]);
    expect(mail.text).toContain(en[BUDGET_KEY[">10k"]]);
  });
});
