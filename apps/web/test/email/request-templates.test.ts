import { describe, expect, it } from "vitest";
import {
  CATEGORY_KEY,
  requestAdminNewEmail,
  requestConfirmEmail,
  requestExpiredEmail,
  requestInviteEmail,
  requestInviteExpiredEmail,
  requestNotSelectedEmail,
  requestProposalEmail,
  requestRejectedEmail,
  requestReminderEmail,
} from "../../src/email/templates/request.ts";
import { builderFacingName } from "../../src/domain/inquiry.ts";
import { CATEGORY_KEY as VIEW_CATEGORY_KEY } from "../../src/views/labels.ts";

const url = "https://vnx.si/x";

describe("request e-mail templates (spec §8.3)", () => {
  it("asks the client to confirm, in their locale", () => {
    const mail = requestConfirmEmail("vi", { title: "Booking app", link: "https://vnx.si/auth/verify?t=abc" });
    expect(mail.subject).toBe("Xác nhận nhu cầu của bạn trên VNX.SI");
    expect(mail.text).toContain("“Booking app”");
    expect(mail.text).toContain("https://vnx.si/auth/verify?t=abc");
    expect(mail.html).toContain('href="https://vnx.si/auth/verify?t=abc"');
  });

  it("invites a builder with the typed client name, category, budget, deadline and expiry window", () => {
    const mail = requestInviteEmail("en", { clientName: builderFacingName("Minh Tran"), title: "Booking app", category: "booking", budgetBand: "2k-10k", deadline: "2026-12-01", days: 7, url });
    expect(mail.subject).toBe("You're invited to a request: Booking app");
    for (const text of ["from Minh Tran: “Booking app”", "Category: Booking", "Budget: $2,000 – $10,000", "Deadline: 2026-12-01", "7 days after it was sent", url]) {
      expect(mail.text, text).toContain(text);
    }
    expect(requestInviteEmail("en", { clientName: builderFacingName("M"), title: "T", category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }).text).not.toContain("Deadline");
  });

  it("never shows a client name that is an e-mail address to the builder", () => {
    const email = "minh.client@example.com";
    const mails = [
      requestInviteEmail("en", { clientName: builderFacingName(email), title: "T", category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }),
      requestReminderEmail("vi", { clientName: builderFacingName(`Minh (${email})`), title: "T", days: 7, url }),
    ];
    for (const mail of mails) {
      expect(mail.text + mail.html + mail.subject).not.toContain(email);
      expect(mail.text).toContain("•••");
    }
  });

  it("shows a fixed price, a range and 'to be discussed', with the timeline", () => {
    const base = { builderName: "Lan", title: "Booking app", timelineDays: 30, url };
    expect(requestProposalEmail("en", { ...base, priceCents: 450000, priceMaxCents: null }).text).toContain("Price: $4,500");
    expect(requestProposalEmail("en", { ...base, priceCents: 300000, priceMaxCents: 500000 }).text).toContain("Price: $3,000 – $5,000");
    expect(requestProposalEmail("en", { ...base, priceCents: null, priceMaxCents: null }).text).toContain("Price: to be discussed");
    const vi = requestProposalEmail("vi", { ...base, priceCents: 450000, priceMaxCents: null });
    expect(vi.subject).toBe("Đề xuất mới từ Lan");
    expect(vi.text).toContain("Giá: $4.500");
    expect(vi.text).toContain("Thời gian dự kiến: 30 ngày");
  });

  it("carries the admin's reason, the day counts and a neutral not-selected text", () => {
    expect(requestRejectedEmail("en", { title: "T", reason: "Too vague.", url }).text).toContain("Too vague.");
    expect(requestExpiredEmail("en", { title: "T", days: 30, url }).text).toContain("30 days");
    expect(requestReminderEmail("en", { clientName: builderFacingName("Minh"), title: "T", days: 7, url }).text).toContain("three days ago");
    expect(requestNotSelectedEmail("en", { title: "T", url }).text).toContain("was not selected, and the request has ended");
    expect(requestInviteExpiredEmail("en", { title: "T", url }).subject).toBe("Invitation ended: T");
  });

  it("tells the admins in English, without the description or any e-mail address", () => {
    const mail = requestAdminNewEmail({ title: "Booking app", category: "booking", budgetBand: "2k-10k", languages: ["en", "vi"], clientName: "Minh Tran" }, "https://vnx.si/admin/requests/01J");
    expect(mail.subject).toBe("New request: Booking app");
    for (const text of ["Minh Tran", "Booking", "$2,000 – $10,000", "en, vi", "https://vnx.si/admin/requests/01J"]) expect(mail.text, text).toContain(text);
  });

  it("escapes names, titles and reasons in every template", () => {
    const evil = '<img src=x onerror="a()">';
    const mails = [
      requestConfirmEmail("en", { title: evil, link: url }),
      requestInviteEmail("en", { clientName: builderFacingName(evil), title: evil, category: "crm", budgetBand: "unsure", deadline: null, days: 7, url }),
      requestReminderEmail("en", { clientName: builderFacingName(evil), title: evil, days: 7, url }),
      requestInviteExpiredEmail("en", { title: evil, url }),
      requestProposalEmail("en", { builderName: evil, title: evil, priceCents: null, priceMaxCents: null, timelineDays: 3, url }),
      requestNotSelectedEmail("en", { title: evil, url }),
      requestRejectedEmail("en", { title: evil, reason: evil, url }),
      requestExpiredEmail("en", { title: evil, days: 30, url }),
      requestAdminNewEmail({ title: evil, category: "crm", budgetBand: "unsure", languages: ["en"], clientName: evil }, url),
    ];
    for (const mail of mails) {
      expect(mail.html).not.toContain("<img");
      expect(mail.html).toContain("&lt;img");
    }
  });

  it("uses the same category labels as the views", () => {
    expect(CATEGORY_KEY).toEqual(VIEW_CATEGORY_KEY);
  });
});
