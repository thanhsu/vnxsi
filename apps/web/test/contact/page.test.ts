import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { LOCALES, localizedPath, type Locale } from "../../src/i18n/locales.ts";
import type { MessageKey } from "../../src/i18n/messages/en.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const get = (path: string, cookie?: string, env: Bindings = testEnv) => createApp().request(getReq(path, cookie), undefined, env);

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** Links vanish without a gap (the e-mail address sits inside a sentence); other tags become a space. */
const textOf = (html: string) => decode(html.replace(/<\/?a\b[^>]*>/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

/** The approved copy (plan VNX-0710 "Nội dung"): EN and VI, word for word. */
export const CONTACT_COPY: [MessageKey, string, string][] = [
  ["nav.contact", "Contact", "Liên hệ"],
  ["contact.title", "Questions, suggestions, partnerships", "Câu hỏi, góp ý, hợp tác"],
  [
    "contact.lead",
    "Ask us anything about VNX.SI, tell us what to build next, or propose working together. We read every message.",
    "Hỏi bất cứ điều gì về VNX.SI, góp ý điều chúng tôi nên làm tiếp, hoặc đề nghị hợp tác. Chúng tôi đọc mọi tin nhắn.",
  ],
  ["contact.side.email", "Prefer email? Write to {email}.", "Thích email hơn? Gửi tới {email}."],
  ["contact.side.reply", "We usually reply within a few working days.", "Chúng tôi thường trả lời trong vài ngày làm việc."],
  ["landing.ask.eyebrow", "Ask us", "Hỏi chúng tôi"],
  ["landing.ask.title", "Have a question or a suggestion?", "Bạn có câu hỏi hay góp ý?"],
  [
    "landing.ask.lead",
    "Builders and clients alike: tell us what you need, what is missing, or what we should do better.",
    "Dù là builder hay client: hãy cho chúng tôi biết bạn cần gì, còn thiếu gì, hay chúng tôi nên làm tốt hơn ở đâu.",
  ],
  ["contact.form.role", "I am a…", "Tôi là…"],
  ["contact.role.builder", "Builder", "Builder"],
  ["contact.role.client", "Client", "Client"],
  ["contact.role.other", "Other", "Khác"],
  ["contact.form.kind", "About", "Về"],
  ["contact.kind.question", "Question", "Câu hỏi"],
  ["contact.kind.suggestion", "Suggestion", "Góp ý"],
  ["contact.kind.partnership", "Partnership or press", "Hợp tác hoặc báo chí"],
  ["contact.kind.other", "Other", "Khác"],
  ["contact.form.name", "Name (optional)", "Tên (không bắt buộc)"],
  ["contact.form.email", "Email (so we can reply)", "Email (để chúng tôi trả lời)"],
  ["contact.form.message", "Your message", "Nội dung"],
  ["contact.form.messageHint", "20 to 2000 characters", "20 đến 2000 ký tự"],
  ["contact.form.consent", "VNX.SI may store this message and my email to answer me.", "VNX.SI được lưu tin nhắn và email của tôi để trả lời."],
  ["contact.form.submit", "Send message", "Gửi tin nhắn"],
  ["contact.sent", "Thanks. We'll reply by email.", "Cảm ơn bạn. Chúng tôi sẽ trả lời qua email."],
  ["contact.error.choice", "Please choose one.", "Vui lòng chọn một mục."],
  ["contact.error.email", "That email address doesn't look right.", "Email chưa đúng định dạng."],
  ["contact.error.message", "Please write between 20 and 2000 characters.", "Vui lòng viết từ 20 đến 2000 ký tự."],
  ["contact.error.consent", "Please tick the box so we can store your message.", "Bạn cần đánh dấu ô đồng ý để chúng tôi lưu tin nhắn."],
  ["contact.error.captcha", "Please confirm you are a person.", "Vui lòng xác nhận bạn là người thật."],
  ["contact.error.rateLimited", "Too many messages. Please try again in an hour.", "Gửi quá nhiều tin. Vui lòng thử lại sau một giờ."],
];

describe("contact copy (plan VNX-0710)", () => {
  it("uses the approved EN and VI copy", () => {
    for (const [key, enText, viText] of CONTACT_COPY) {
      expect(t("en", key), key).toBe(enText);
      expect(t("vi", key), key).toBe(viText);
    }
  });

  it("has a Chinese translation for every contact key that is not the English text", () => {
    for (const [key, enText] of CONTACT_COPY) {
      for (const locale of ["zh-Hans", "zh-Hant"] as const) {
        if (["contact.role.builder"].includes(key)) continue;
        expect(t(locale, key), `${locale} ${key}`).not.toBe(enText);
      }
    }
  });
});

describe("GET /contact (plan VNX-0710 AC3)", () => {
  for (const locale of LOCALES) {
    it(`${locale}: 200 with the title, lead, side note and a complete form, canonical and hreflang`, async () => {
      const path = localizedPath(locale, "/contact");
      const res = await get(path);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<link rel="canonical" href="https://vnx.si${path}"`);
      for (const l of LOCALES) expect(html, l).toContain(`<link rel="alternate" hreflang="${l}" href="https://vnx.si${localizedPath(l, "/contact")}"`);
      expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://vnx.si/contact"');
      expect(html).not.toContain('name="robots"');
      expect(html).toContain(`<title>${t(locale, "contact.title")} · VNX.SI</title>`);

      const main = mainOf(html);
      expect(main.match(/<h1[\s>]/g)).toHaveLength(1);
      const text = textOf(main);
      for (const key of ["contact.title", "contact.lead", "contact.side.reply", "contact.form.submit", "contact.form.consent", "contact.form.messageHint"] as const) {
        expect(text, key).toContain(t(locale, key));
      }
      expect(text).toContain(t(locale, "contact.side.email", { email: "contact@vnx.si" }));
      expect(main).toContain('href="mailto:contact@vnx.si"');

      expect(main).toContain(`<form method="post" action="${path}"`);
      for (const role of ["builder", "client", "other"]) expect(main, role).toMatch(new RegExp(`<input[^>]*type="radio"[^>]*name="role"[^>]*value="${role}"`));
      expect(main.match(/<option value="(question|suggestion|partnership|other)"/g)).toHaveLength(4);
      expect(main).toMatch(/<input[^>]*name="name"[^>]*maxlength="100"/);
      expect(main).toMatch(/<input[^>]*name="email"[^>]*type="email"[^>]*required/);
      expect(main).toMatch(/<textarea[^>]*name="message"[^>]*minlength="20"[^>]*maxlength="2000"/);
      expect(main).toMatch(/<input[^>]*name="consent"[^>]*type="checkbox"[^>]*required/);
      expect(main).toContain('<input type="hidden" name="from" value="contact"');
      expect(main).toMatch(/<div class="hp" aria-hidden="true">[\s\S]*?<input[^>]*name="website"[^>]*tabindex="-1"/);
      expect(main).toContain('class="cf-turnstile" data-sitekey="fake-site-key"');
      // hono/jsx hoists an async script into <head> (as on the M5 inquiry form); it loads once.
      const head = /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";
      expect(head).toContain('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async="" defer=""></script>');
      expect(html.match(/turnstile\/v0\/api\.js/g)).toHaveLength(1);
      // Every visible control has a label.
      for (const id of ["ct-name", "ct-email", "ct-message", "ct-kind", "ct-consent", "ct-role-builder", "ct-role-client", "ct-role-other"]) {
        expect(main, id).toContain(`for="${id}"`);
        expect(main, id).toContain(`id="${id}"`);
      }
    });
  }

  it("?sent=1 shows the thank-you notice instead of the form", async () => {
    for (const locale of ["en", "vi"] as Locale[]) {
      const main = mainOf(await (await get(`${localizedPath(locale, "/contact")}?sent=1`)).text());
      expect(main).toContain('role="status"');
      expect(textOf(main)).toContain(t(locale, "contact.sent"));
      expect(main).not.toContain("<form");
    }
    expect(textOf(mainOf(await (await get("/contact")).text()))).not.toContain(t("en", "contact.sent"));
  });

  it("signed in: e-mail prefilled from the account (editable), no Turnstile", async () => {
    const { cookie } = await signIn("ct-page-in@vnx.si");
    const main = mainOf(await (await get("/vi/contact", cookie)).text());
    expect(main).toMatch(/<input[^>]*name="email"[^>]*value="ct-page-in@vnx.si"/);
    expect(main).not.toMatch(/<input[^>]*name="email"[^>]*readonly/);
    expect(main).not.toContain("cf-turnstile");
    expect(main).not.toContain("challenges.cloudflare.com");
  });

  it("signed out without Turnstile configured: no form, a notice and the e-mail address (fail closed, like the inquiry form)", async () => {
    const env = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    const main = mainOf(await (await get("/contact", undefined, env)).text());
    expect(main).not.toContain("<form");
    expect(textOf(main)).toContain(t("en", "contact.form.unavailable"));
    expect(main).toContain('href="mailto:contact@vnx.si"');
  });
});
