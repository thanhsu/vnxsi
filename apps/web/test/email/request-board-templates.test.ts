import { describe, expect, it } from "vitest";
import { requestBoardPublishedEmail, requestBoardRejectedEmail, requestBoardUnpublishedEmail } from "../../src/email/templates/request-board.ts";
import { LOCALES } from "../../src/i18n/locales.ts";

/** VNX-2704b: the three client e-mails about the public request board (addendum §9.2, Q19). */

const publicUrl = "https://vnx.si/requests/01HPUBLICID";
const manageUrl = "https://vnx.si/me/requests/01HREQUESTID";
const TERM: Record<string, string> = { en: "public request board", vi: "bảng nhu cầu công khai", "zh-Hans": "公开需求板", "zh-Hant": "公開需求板" };

describe("request board e-mails", () => {
  it("has a subject and a body in every locale, in the approved terminology, linking the client's own pages", () => {
    for (const locale of LOCALES) {
      const published = requestBoardPublishedEmail(locale, { title: "Booking app", edited: false, publicUrl, manageUrl });
      const rejected = requestBoardRejectedEmail(locale, { title: "Booking app", reason: "Too vague.", url: manageUrl });
      const unpublished = requestBoardUnpublishedEmail(locale, { title: "Booking app", reason: "No longer fits.", url: manageUrl });
      for (const [name, mail] of Object.entries({ published, rejected, unpublished })) {
        expect(mail.subject, `${locale} ${name}`).toContain("Booking app");
        expect(mail.text, `${locale} ${name}`).toContain("Booking app");
        expect(mail.subject + mail.text, `${locale} ${name}`).toContain(TERM[locale]!);
        expect(mail.text, `${locale} ${name}`).toContain(manageUrl);
        expect(mail.html, `${locale} ${name}`).toContain(`<html lang="${locale}">`);
      }
      expect(published.text, locale).toContain(publicUrl);
      expect(rejected.text, locale).toContain("Too vague.");
      expect(unpublished.text, locale).toContain("No longer fits.");
      expect(new Set([published.subject, rejected.subject, unpublished.subject]).size, locale).toBe(3);
    }
  });

  it("says the wording was edited only when it was, in every locale", () => {
    for (const locale of LOCALES) {
      const plain = requestBoardPublishedEmail(locale, { title: "T", edited: false, publicUrl, manageUrl });
      const edited = requestBoardPublishedEmail(locale, { title: "T", edited: true, publicUrl, manageUrl });
      expect(edited.text.length, locale).toBeGreaterThan(plain.text.length);
      expect(edited.html, locale).not.toBe(plain.html);
    }
    const en = requestBoardPublishedEmail("en", { title: "T", edited: true, publicUrl, manageUrl });
    expect(en.text).toContain("edited the wording");
    expect(requestBoardPublishedEmail("en", { title: "T", edited: false, publicUrl, manageUrl }).text).not.toContain("edited");
  });

  it("says the request itself is not affected, and never promises a way back, in the rejected and unpublished mails", () => {
    for (const mail of [requestBoardRejectedEmail("en", { title: "T", reason: "r", url: manageUrl }), requestBoardUnpublishedEmail("en", { title: "T", reason: "r", url: manageUrl })]) {
      expect(mail.text).toContain("Your request itself is not affected.");
      expect(mail.text).toContain("cannot be shown on the board again");
    }
  });

  it("escapes the reason and the title in the HTML and keeps them verbatim in the text", () => {
    const reason = "<script>alert(1)</script> & more";
    for (const mail of [requestBoardRejectedEmail("en", { title: "<b>T</b>", reason, url: manageUrl }), requestBoardUnpublishedEmail("vi", { title: "<b>T</b>", reason, url: manageUrl })]) {
      expect(mail.html).not.toContain("<script>");
      expect(mail.html).not.toContain("<b>T</b>");
      expect(mail.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more");
      expect(mail.text).toContain(reason);
    }
  });
});
