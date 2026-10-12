import { describe, expect, it } from "vitest";
import { requestBoardPublishedEmail, requestBoardRejectedEmail, requestBoardUnpublishedEmail } from "../../src/email/templates/request-board.ts";
import { LOCALES } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";

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
    expect(en.text).toContain("edited the title or description");
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

/** The Owner-approved copy (2026-10-12), byte for byte. zh-Hans and zh-Hant are AI translations of the EN. */
const APPROVED: Record<string, { en: string; vi: string }> = {
  "email.boardPublished.subject": { en: "Your request is now on the public request board: {title}", vi: "Nhu cầu của bạn đã hiện trên bảng nhu cầu công khai: {title}" },
  "email.boardPublished.intro": {
    en: "Our team approved your request “{title}” for the public request board. Anyone, including search engines, can now see the published version, its category, budget range, country, deadline and languages, but never your name, email address or account.",
    vi: "Đội ngũ của chúng tôi đã duyệt nhu cầu “{title}” của bạn để hiện trên bảng nhu cầu công khai. Từ giờ, bất kỳ ai, kể cả công cụ tìm kiếm, đều thấy được bản chúng tôi đã công khai, cùng danh mục, khoảng ngân sách, quốc gia, hạn chót và ngôn ngữ, nhưng không bao giờ thấy tên, email hay tài khoản của bạn.",
  },
  "email.boardPublished.edited": {
    en: "Before publishing, our team edited the title or description, for example to remove details that could identify you or others. The public page shows the edited version.",
    vi: "Trước khi công khai, đội ngũ của chúng tôi đã sửa tiêu đề hoặc mô tả, ví dụ để bỏ những chi tiết có thể nhận ra bạn hoặc người khác. Trang công khai hiện bản đã sửa.",
  },
  "email.boardPublished.view": { en: "View the public page:", vi: "Xem trang công khai:" },
  "email.boardPublished.manage": {
    en: "You can remove it from the board at any time from your account; this takes effect straight away:",
    vi: "Bạn có thể gỡ nhu cầu khỏi bảng bất cứ lúc nào từ tài khoản của mình; việc gỡ có hiệu lực ngay:",
  },
  "email.boardRejected.subject": { en: "Your request will not be shown on the public request board: {title}", vi: "Nhu cầu của bạn sẽ không hiện trên bảng nhu cầu công khai: {title}" },
  "email.boardRejected.intro": { en: "Our team decided not to show “{title}” on the public request board.", vi: "Đội ngũ của chúng tôi quyết định không hiện nhu cầu “{title}” trên bảng nhu cầu công khai." },
  "email.boardUnpublished.subject": { en: "Your request was removed from the public request board: {title}", vi: "Nhu cầu của bạn đã bị gỡ khỏi bảng nhu cầu công khai: {title}" },
  "email.boardUnpublished.intro": { en: "Our team removed “{title}” from the public request board.", vi: "Đội ngũ của chúng tôi đã gỡ nhu cầu “{title}” khỏi bảng nhu cầu công khai." },
  "email.board.reason": { en: "Reason:", vi: "Lý do:" },
  "email.board.finalNote": { en: "This request cannot be shown on the board again. Your request itself is not affected.", vi: "Không thể hiện lại nhu cầu này trên bảng. Bản thân nhu cầu của bạn không bị ảnh hưởng." },
  "email.board.cta": { en: "View your request:", vi: "Xem nhu cầu của bạn:" },
};

describe("Owner-approved copy, byte for byte", () => {
  it("has the 12 approved keys in EN and VI exactly", () => {
    for (const [key, copy] of Object.entries(APPROVED)) {
      expect((en as Record<string, string>)[key], `en ${key}`).toBe(copy.en);
      expect((vi as Record<string, string>)[key], `vi ${key}`).toBe(copy.vi);
    }
    expect(Object.keys(APPROVED)).toHaveLength(12);
  });
});
