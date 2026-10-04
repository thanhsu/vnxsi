import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Locale } from "../../src/i18n/locales.ts";
import { en, type MessageKey } from "../../src/i18n/messages/en.ts";
import { t } from "../../src/i18n/t.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const fetchAt = (url: string, cookie?: string) =>
  createApp().request(new Request(url, { headers: cookie ? { cookie } : {} }), undefined, testEnv);
const get = (path: string, cookie?: string) => fetchAt(`https://vnx.si${path}`, cookie);

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** <main> without the "Ask us" block (VNX-0710): its form states a length rule ("20 to 2000 characters"), not a statistic. */
const withoutAsk = (main: string) => (main.includes('<section id="ask"') ? main.slice(0, main.indexOf('<section id="ask"')) : main);
/** The #notify section only. */
const notifyOf = (main: string) => withoutAsk(main).slice(main.indexOf('<section id="notify"'));
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "null");

const PAGES: { path: string; locale: Locale; canonical: string }[] = [
  { path: "/", locale: "en", canonical: "https://vnx.si/" },
  { path: "/vi", locale: "vi", canonical: "https://vnx.si/vi/" },
  { path: "/vi/", locale: "vi", canonical: "https://vnx.si/vi/" },
  { path: "/zh-hans", locale: "zh-Hans", canonical: "https://vnx.si/zh-hans/" },
  { path: "/zh-hant", locale: "zh-Hant", canonical: "https://vnx.si/zh-hant/" },
];

/** The approved copy (plan VNX-0709 "Nội dung"): EN and VI, word for word. */
const COPY: [MessageKey, string, string][] = [
  ["landing.hero.pill", "Founding phase · free listing for builders", "Giai đoạn sáng lập · builder đăng sản phẩm miễn phí"],
  ["landing.hero.title", "Have an idea? Find a product, customize one, or build your own.", "Có ý tưởng? Tìm sản phẩm có sẵn, tuỳ chỉnh, hoặc xây mới."],
  [
    "landing.hero.lead",
    "VNX.SI is the marketplace for AI-built software and the people who build it. Every listing shows exactly what has been verified.",
    "VNX.SI là chợ phần mềm được xây bằng AI, và của chính những người xây nó. Mỗi sản phẩm ghi rõ điều gì đã được xác minh.",
  ],
  ["landing.cta.builder", "Become a builder", "Trở thành builder"],
  ["landing.cta.notify", "Get notified", "Nhận thông báo"],
  ["site.rankings", "Rankings are never for sale.", "Thứ hạng không bao giờ được bán."],
  ["landing.deck.open", "Open for builders", "Đang mở cho builder"],
  ["landing.deck.free", "Free to list", "Đăng miễn phí"],
  ["landing.deck.first", "Be the first to list one here.", "Hãy là người đầu tiên đăng ở đây."],
  ["landing.deck.badges", "Badges to earn", "Huy hiệu có thể đạt"],
  ["landing.deck.list", "List yours", "Đăng sản phẩm"],
  ["landing.deck.view", "View product", "Xem sản phẩm"],
  ["catalog.from", "From {amount}", "Từ {amount}"],
  ["pricing.billing.contact", "Contact for price", "Liên hệ báo giá"],
  ["landing.principles.verify.title", "Verification you can read", "Xác minh đọc được"],
  ["landing.principles.verify.body", "Each badge says what we checked.", "Mỗi huy hiệu nói rõ đã kiểm gì."],
  ["landing.principles.ranking.title", "Rankings never for sale", "Thứ hạng không bán"],
  ["landing.principles.ranking.body", "Nobody pays to move up.", "Không ai trả tiền để lên trên."],
  ["landing.principles.direct.title", "Straight to the builder", "Làm thẳng với builder"],
  ["landing.principles.direct.body", "Buy, customize or hire directly.", "Mua, tuỳ chỉnh hoặc thuê trực tiếp."],
  ["landing.principles.languages.title", "Four languages", "Bốn ngôn ngữ"],
  ["landing.principles.languages.body", "EN · VI · 简体 · 繁體", "EN · VI · 简体 · 繁體"],
  ["landing.how.eyebrow", "How it works", "Cách hoạt động"],
  ["landing.how.title", "One listing, four ways to get what you need", "Một sản phẩm, bốn cách để có thứ bạn cần"],
  ["landing.ways.buy.body", "Use it as it is: a SaaS subscription, source code, or a fixed-price service package.", "Dùng ngay như hiện có: thuê bao SaaS, mã nguồn, hoặc gói dịch vụ giá cố định."],
  ["landing.ways.customize.body", "Like it but need changes? Ask the builder for a quote on your version.", "Ưng nhưng cần sửa? Gửi yêu cầu để builder báo giá phiên bản của bạn."],
  ["landing.ways.hire.body", "Work with the person who built it on something new for your business.", "Làm việc với chính người đã xây sản phẩm cho một dự án mới."],
  ["landing.ways.similar.body", "Want the same idea for your industry? Start from a product that already works.", "Muốn ý tưởng tương tự cho ngành của mình? Bắt đầu từ một sản phẩm đã chạy."],
  ["landing.trust.eyebrow", "Trust layer", "Lớp tin cậy"],
  ["landing.trust.title", "Verification you can actually read", "Xác minh mà bạn đọc hiểu được"],
  [
    "landing.trust.sub",
    "We don’t show star ratings we can’t stand behind. Each badge says exactly what was checked, and when.",
    "Chúng tôi không gắn sao khi không kiểm chứng được. Mỗi huy hiệu nói rõ đã kiểm tra điều gì, và khi nào.",
  ],
  ["landing.trust.listed", "Reviewed by the VNX.SI team: clear description, real pricing, working links.", "Đội VNX.SI đã duyệt: mô tả rõ ràng, giá thật, link hoạt động."],
  ["landing.trust.demo", "We opened the demo ourselves and it works over HTTPS.", "Chúng tôi tự mở demo và nó chạy được qua HTTPS."],
  ["landing.trust.production", "The builder showed real customers using it, and we checked the evidence.", "Builder chứng minh có khách hàng thật đang dùng, và chúng tôi đã kiểm tra bằng chứng."],
  ["landing.builders.eyebrow", "For builders", "Dành cho builder"],
  ["landing.builders.title", "Build once. Sell many times. Get hired to customize.", "Xây một lần. Bán nhiều lần. Được thuê để tuỳ chỉnh."],
  [
    "landing.builders.sub",
    "AI made building faster. VNX.SI gives what you build a storefront, buyers, and follow-on work.",
    "AI giúp xây phần mềm nhanh hơn. VNX.SI cho sản phẩm của bạn một gian hàng, người mua và những việc làm tiếp theo.",
  ],
  ["landing.builders.perk.free", "Free listing during the founding phase", "Đăng sản phẩm miễn phí trong giai đoạn sáng lập"],
  ["landing.builders.perk.tools", "Any AI tool. We only ask one thing: can you deliver?", "Dùng công cụ AI nào cũng được. Chúng tôi chỉ hỏi: bạn có giao được sản phẩm không?"],
  ["landing.builders.perk.requests", "Requests from clients who need what you build", "Nhận yêu cầu từ khách đang cần đúng thứ bạn xây"],
  ["landing.builders.apply", "Apply as a founding builder", "Đăng ký builder sáng lập"],
  ["landing.builders.step.apply.title", "Apply", "Đăng ký"],
  ["landing.builders.step.apply.body", "Tell us what you build. Invited builders are approved instantly.", "Cho chúng tôi biết bạn xây gì. Builder được mời sẽ được duyệt ngay."],
  ["landing.builders.step.list.title", "List your product", "Đăng sản phẩm"],
  ["landing.builders.step.list.body", "A product page in guided steps: problem, demo, pricing, license, support.", "Trang sản phẩm qua các bước có hướng dẫn: vấn đề, demo, giá, license, hỗ trợ."],
  ["landing.builders.step.requests.title", "Get requests", "Nhận yêu cầu"],
  ["landing.builders.step.requests.body", "Buy, customize and hire requests from clients who need what you build.", "Yêu cầu mua, tuỳ chỉnh và thuê từ khách đang cần đúng thứ bạn xây."],
  ["landing.builders.belt", "Built with any tool", "Xây bằng công cụ nào cũng được"],
  ["landing.builders.beltOwn", "…or your own hands", "…hoặc chính đôi tay bạn"],
  ["landing.final.title", "Already have an idea?", "Đã có ý tưởng?"],
  [
    "landing.final.body",
    "The marketplace opens to clients once enough verified products are listed. Leave your email and we'll tell you when.",
    "Chợ sẽ mở cho khách khi đã có đủ sản phẩm được kiểm duyệt. Để lại email, chúng tôi báo bạn khi mở.",
  ],
  ["landing.final.findBuilder", "Find a builder", "Tìm builder"],
  ["nav.products", "Products", "Sản phẩm"],
  ["nav.findBuilders", "Find builders", "Tìm builder"],
  ["nav.howItWorks", "How it works", "Cách hoạt động"],
  ["nav.forBuilders", "For builders", "Dành cho builder"],
  ["nav.signIn", "Sign in", "Đăng nhập"],
  ["nav.becomeBuilder", "Become a builder", "Trở thành builder"],
  ["nav.hub", "Builder Hub", "Builder Hub"],
  ["nav.signOut", "Sign out", "Đăng xuất"],
  ["nav.menu", "Menu", "Menu"],
  ["nav.language", "Language", "Ngôn ngữ"],
  ["footer.marketplace", "Marketplace", "Chợ"],
  ["footer.builders", "Builders", "Builder"],
  ["footer.company", "Company", "Công ty"],
  ["footer.mediaKit", "Media kit", "Media kit"],
  ["footer.terms", "Terms", "Điều khoản"],
  ["footer.privacy", "Privacy", "Quyền riêng tư"],
  // VNX-0710: the "Ask us" block and the Contact nav item.
  ["landing.ask.eyebrow", "Ask us", "Hỏi chúng tôi"],
  ["landing.ask.title", "Have a question or a suggestion?", "Bạn có câu hỏi hay góp ý?"],
  [
    "landing.ask.lead",
    "Builders and clients alike: tell us what you need, what is missing, or what we should do better.",
    "Dù là builder hay client: hãy cho chúng tôi biết bạn cần gì, còn thiếu gì, hay chúng tôi nên làm tốt hơn ở đâu.",
  ],
  ["nav.contact", "Contact", "Liên hệ"],
];

/** Keys of the VNX-0708 landing that the new design no longer uses. */
const REMOVED = [
  "landing.hero.client",
  "landing.hero.builder",
  "landing.ways.title",
  "landing.badges.title",
  "landing.badges.intro",
  "landing.badges.listed",
  "landing.badges.demo",
  "landing.badges.production",
  "landing.builders.body",
  "landing.builders.invite",
  "landing.clients.title",
  "landing.clients.body",
  "landing.principle.title",
  "landing.principle.body",
  "footer.nav",
];

const SOURCES = import.meta.glob("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("landing page GET / (VNX-0708, redesigned in VNX-0709)", () => {
  it("AC1: renders the server landing in every locale, with one h1", async () => {
    for (const { path, locale } of PAGES) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("text/html");
      const html = await res.text();
      expect(html, path).toContain(`<html lang="${locale}">`);
      expect(html.match(/<h1[\s>]/g), path).toHaveLength(1);
      expect(textOf(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "").trim(), path).toBe(t(locale, "landing.hero.title"));
      expect(html, path).not.toContain("Something new");
    }
  });

  it("AC2: has canonical on APP_ORIGIN, hreflang for 4 locales + x-default, Open Graph and Organization JSON-LD", async () => {
    for (const { path, locale, canonical } of PAGES) {
      // A preview host must never become canonical.
      const html = await (await fetchAt(`https://vnxsi-web.preview.workers.dev${path}`)).text();
      expect(html, path).toContain(`<title>${t(locale, "landing.meta.title")}</title>`);
      expect(html, path).toContain(`<link rel="canonical" href="${canonical}"`);
      for (const [lang, href] of [
        ["en", "https://vnx.si/"],
        ["vi", "https://vnx.si/vi/"],
        ["zh-Hans", "https://vnx.si/zh-hans/"],
        ["zh-Hant", "https://vnx.si/zh-hant/"],
        ["x-default", "https://vnx.si/"],
      ]) {
        expect(html, `${path} ${lang}`).toContain(`<link rel="alternate" hreflang="${lang}" href="${href}"`);
      }
      expect(decode(html), path).toContain(`<meta property="og:title" content="${t(locale, "landing.meta.title")}"`);
      expect(decode(html), path).toContain(`<meta property="og:description" content="${t(locale, "landing.meta.description")}"`);
      expect(decode(html), path).toContain(`<meta name="description" content="${t(locale, "landing.meta.description")}"`);
      expect(jsonLd(html), path).toEqual({ "@context": "https://schema.org", "@type": "Organization", name: "VNX.SI", url: "https://vnx.si/" });
      expect(html, path).not.toContain("preview.workers.dev");
      expect(html, path).not.toContain('name="robots"');
    }
  });

  it("AC6: has the hero, the deck, the principles strip, #how, the trust layer, #builders, #notify and #ask (VNX-0710), in that order", async () => {
    for (const { path } of PAGES) {
      const main = mainOf(await (await get(path)).text());
      const at = (needle: string) => {
        const i = main.indexOf(needle);
        expect(i, `${path} ${needle}`).toBeGreaterThanOrEqual(0);
        return i;
      };
      const order = [
        at('<section class="lp-hero"'),
        at('<div class="deck"'),
        at('<section class="lp-principles"'),
        at('<section id="how"'),
        at('<section id="trust"'),
        at('<section id="builders"'),
        at('<section id="notify"'),
        at('<section id="ask"'),
      ];
      expect([...order].sort((a, b) => a - b), path).toEqual(order);
      expect(main.match(/<li class="lp-principle/g), path).toHaveLength(4);
      expect(main.match(/<li class="lp-way/g), path).toHaveLength(4);
      expect(main.match(/<li class="lp-trust-item/g), path).toHaveLength(3);
      expect(main.match(/<li class="lp-step/g), path).toHaveLength(3);
      // The tool belt repeats once for the loop; the copy is hidden from assistive tech.
      expect(main).toMatch(/<div class="belt-track">[\s\S]*<span[^>]*aria-hidden="true"[^>]*>/);
    }
  });

  it("AC9: uses the approved EN and VI copy", () => {
    for (const [key, enText, viText] of COPY) {
      expect(t("en", key), key).toBe(enText);
      expect(t("vi", key), key).toBe(viText);
    }
  });

  it("AC9: shows that copy on the page, with the existing titles of the four ways", async () => {
    // "View product" only appears on product cards (deck.test.ts); the hero note shares the footer's key.
    const shown = COPY.filter(([key]) => (key.startsWith("landing.") && key !== "landing.deck.view") || key === "site.rankings").map(([key]) => key);
    for (const locale of ["en", "vi", "zh-Hans", "zh-Hant"] as const) {
      const text = textOf(mainOf(await (await get(locale === "en" ? "/" : `/${locale.toLowerCase()}/`)).text()));
      for (const key of shown) expect(text, `${locale} ${key}`).toContain(t(locale, key));
      for (const way of ["buy", "customize", "hire", "similar"] as const) expect(text, `${locale} ${way}`).toContain(t(locale, `landing.ways.${way}.title`));
      for (const tool of ["Claude", "Codex", "Gemini", "Cursor", "Lovable", "Replit"]) expect(text, tool).toContain(tool);
    }
  });

  it("AC9: drops the old landing keys and every remaining landing.* key is used", () => {
    for (const key of REMOVED) expect(Object.keys(en), key).not.toContain(key);
    const code = Object.entries(SOURCES)
      .filter(([file]) => !file.includes("/i18n/messages/"))
      .map(([, src]) => src)
      .join("\n");
    for (const key of Object.keys(en).filter((k) => k.startsWith("landing."))) expect(code, key).toContain(`"${key}"`);
  });

  it("AC3: builder buttons go to login with next=hub/apply when signed out", async () => {
    // Hero, three invitation cards, the builders section and the final CTA.
    const vi = mainOf(await (await get("/vi")).text());
    expect(vi.match(/href="\/vi\/login\?next=%2Fvi%2Fhub%2Fapply"/g)).toHaveLength(6);
    expect(textOf(vi)).toContain(t("vi", "landing.cta.builder"));
    const en = mainOf(await (await get("/")).text());
    expect(en.match(/href="\/login\?next=%2Fhub%2Fapply"/g)).toHaveLength(6);
    const zh = mainOf(await (await get("/zh-hant")).text());
    expect(zh.match(/href="\/zh-hant\/login\?next=%2Fzh-hant%2Fhub%2Fapply"/g)).toHaveLength(6);
  });

  it("AC3: builder buttons go to the hub when signed in", async () => {
    const { cookie } = await signIn("landing-signed-in@vnx.si");
    const vi = mainOf(await (await get("/vi", cookie)).text());
    expect(vi.match(/href="\/vi\/hub"/g)).toHaveLength(6);
    expect(vi).not.toContain("/login");
    const en = mainOf(await (await get("/", cookie)).text());
    expect(en.match(/href="\/hub"/g)).toHaveLength(6);
  });

  it("AC6: with no public product, shows no digits in <main> and no link to /products", async () => {
    for (const { path } of PAGES) {
      for (const suffix of ["", "?joined=1"]) {
        const main = mainOf(await (await get(path + suffix)).text());
        expect(main, path + suffix).not.toBe("");
        expect(textOf(withoutAsk(main)), path + suffix).not.toMatch(/\d/);
        expect(main, path + suffix).not.toMatch(/href="[^"]*\/products\b/);
      }
    }
  });

  it("links to /request next to the waitlist form without replacing it (Owner 2026-10-04)", async () => {
    const main = mainOf(await (await get("/vi")).text());
    expect(main).toMatch(/<section id="notify"[\s\S]*href="\/vi\/request"[\s\S]*<form method="post" action="\/vi\/waitlist#notify"/);
  });

  it("AC6: numbers the ways, the trust items and the steps with CSS counters", async () => {
    const css = await (await get("/assets/app.css")).text();
    expect(css).toMatch(/counter-reset:\s*[\w-]+/);
    expect(css).toMatch(/content:\s*counter\([\w-]+,\s*decimal-leading-zero\)/);
    expect(css).toMatch(/counter-increment:\s*[\w-]+/);
  });

  it("AC6: the final CTA links to the builder directory and the builder application", async () => {
    const main = mainOf(await (await get("/vi")).text());
    const notify = main.slice(main.indexOf('<section id="notify"'));
    expect(notify).toMatch(new RegExp(`<a[^>]*href="/vi/builders"[^>]*>${t("vi", "landing.final.findBuilder")}</a>`));
    expect(notify).toContain('href="/vi/login?next=%2Fvi%2Fhub%2Fapply"');
  });

  it("has the notify section with a labelled, accessible form and a hidden honeypot", async () => {
    const html = await (await get("/vi")).text();
    const main = mainOf(html);
    expect(main).toContain('href="#notify"');
    expect(main).toContain('id="notify"');
    expect(main).toContain('<form method="post" action="/vi/waitlist#notify"');
    expect(main).toMatch(/<label for="waitlist-email">/);
    expect(main).toMatch(/<input id="waitlist-email" name="email" type="email"/);
    expect(main).toMatch(/<input id="waitlist-consent" name="consent" type="checkbox"/);
    expect(main).toMatch(/<label for="waitlist-consent">/);
    expect(textOf(main)).toContain(t("vi", "landing.form.consent"));
    // The honeypot is hidden from people and from screen readers, and out of the tab order.
    expect(main).toMatch(/<div class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"/);
    expect(main).not.toContain('role="status"');
  });

  it("carries utm_* from the page query into hidden inputs, capped at 200 characters", async () => {
    const long = "x".repeat(250);
    const main = mainOf(await (await get(`/?utm_source=newsletter&utm_medium=email&utm_campaign=${long}`)).text());
    expect(main).toContain('<input type="hidden" name="utm_source" value="newsletter"');
    expect(main).toContain('<input type="hidden" name="utm_medium" value="email"');
    expect(main).toContain(`<input type="hidden" name="utm_campaign" value="${"x".repeat(200)}"`);
    const plain = mainOf(await (await get("/")).text());
    expect(plain).not.toContain('name="utm_source"');
  });

  it("F1: carries an external Referer host into a hidden ref input, never the site's own hosts", async () => {
    const withRef = (path: string, referer: string) =>
      createApp().request(new Request(`https://vnx.si${path}`, { headers: { referer } }), undefined, testEnv);
    const main = mainOf(await (await withRef("/vi", "https://news.ycombinator.com/item?id=1")).text());
    expect(main).toContain('<input type="hidden" name="ref" value="news.ycombinator.com"');
    expect(main).not.toContain("item?id");
    for (const internal of ["https://vnx.si/products", "https://www.vnx.si/x", "not a url"]) {
      const html = mainOf(await (await withRef("/", internal)).text());
      expect(html, internal).not.toContain('name="ref"');
    }
    expect(mainOf(await (await get("/")).text())).not.toContain('name="ref"');
  });

  it("AC11: ?joined=1 shows the success message instead of the form", async () => {
    for (const { path, locale } of PAGES) {
      const main = mainOf(await (await get(`${path}?joined=1`)).text());
      const notify = notifyOf(main);
      expect(notify, path).toContain('role="status"');
      expect(textOf(notify), path).toContain(t(locale, "landing.form.joined"));
      expect(notify, path).not.toContain("<form");
      expect(main, path).toContain('id="notify"');
    }
    const plain = textOf(mainOf(await (await get("/")).text()));
    expect(plain).not.toContain(t("en", "landing.form.joined"));
  });

  it("VNX-0710 AC5: the #ask block has the eyebrow, title, lead and the contact form posting to /contact with from=landing", async () => {
    for (const { path, locale } of PAGES) {
      const main = mainOf(await (await get(path)).text());
      const ask = main.slice(main.indexOf('<section id="ask"'));
      expect(ask, path).toMatch(/^<section id="ask" class="[^"]*" aria-labelledby="ask-title">/);
      const text = textOf(ask);
      for (const key of ["landing.ask.eyebrow", "landing.ask.title", "landing.ask.lead", "contact.form.submit"] as const) expect(text, `${path} ${key}`).toContain(t(locale, key));
      expect(ask).toMatch(/<h2 id="ask-title">/);
      const action = locale === "en" ? "/contact" : `/${locale.toLowerCase()}/contact`;
      expect(ask, path).toContain(`<form method="post" action="${action}"`);
      expect(ask, path).toContain('<input type="hidden" name="from" value="landing"');
      // VNX-0710 F1: signed out, the #ask form carries the Turnstile widget, like /contact.
      expect(ask, path).toContain('<div class="cf-turnstile" data-sitekey="fake-site-key"></div>');
      expect(ask, path).not.toContain('role="status"');
    }
  });

  it("VNX-0710 AC5: ?asked=1 shows the thank-you notice in the #ask block, and the waitlist form stays", async () => {
    for (const { path, locale } of PAGES) {
      const main = mainOf(await (await get(`${path}?asked=1`)).text());
      const ask = main.slice(main.indexOf('<section id="ask"'));
      expect(ask, path).toContain('role="status"');
      expect(textOf(ask), path).toContain(t(locale, "contact.sent"));
      expect(ask, path).not.toContain("<form");
      expect(notifyOf(main), path).toContain("<form");
    }
  });

  it("VNX-0710 AC8: signed in, the #ask form has the account e-mail, no widget and no Turnstile script", async () => {
    const { cookie } = await signIn("landing-ask@vnx.si");
    const html = await (await get("/vi", cookie)).text();
    const main = mainOf(html);
    const ask = main.slice(main.indexOf('<section id="ask"'));
    expect(ask).toMatch(/<input[^>]*name="email"[^>]*value="landing-ask@vnx.si"/);
    expect(ask).not.toContain("cf-turnstile");
    expect(html).not.toContain("challenges.cloudflare.com");
  });

  it("VNX-0710 F1: signed out, the landing loads the Turnstile script once, in <head>", async () => {
    for (const { path } of PAGES) {
      const html = await (await get(path)).text();
      const head = /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";
      expect(head, path).toContain('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async="" defer=""></script>');
      expect(html.match(/turnstile\/v0\/api\.js/g), path).toHaveLength(1);
    }
  });

  it("VNX-0710 F1: without Turnstile configured, #ask shows the unavailable notice like /contact: no form, no script", async () => {
    const env = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    for (const { path, locale } of PAGES) {
      const html = await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, env)).text();
      const main = mainOf(html);
      const ask = main.slice(main.indexOf('<section id="ask"'));
      expect(ask, path).not.toContain("<form");
      expect(textOf(ask), path).toContain(t(locale, "contact.form.unavailable"));
      expect(ask, path).toContain('href="mailto:contact@vnx.si"');
      expect(html, path).not.toContain("challenges.cloudflare.com");
      // The waitlist form does not depend on Turnstile.
      expect(notifyOf(main), path).toContain("<form");
    }
  });
});
