import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS } from "../../src/http/turnstile.ts";
import { t } from "../../src/i18n/t.ts";
import { signIn } from "../fixtures.ts";
import { expectErrorSummary, formPost, testEnv } from "../helpers.ts";

const app = () => createApp();
const randomIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
const post = (path: string, fields: Record<string, string>, opts: { cookie?: string; ip?: string; env?: Bindings; origin?: string | null } = {}) => {
  const req = formPost(path, fields, { ...(opts.cookie ? { cookie: opts.cookie } : {}), "cf-connecting-ip": opts.ip ?? randomIp() });
  if (opts.origin === null) req.headers.delete("origin");
  return app().request(req, undefined, opts.env ?? testEnv);
};

const MESSAGE = "Can a team of two list products under one builder profile?";
const form = (email: string, overrides: Record<string, string> = {}): Record<string, string> => ({
  role: "builder",
  kind: "question",
  name: "Minh Tran",
  email,
  message: MESSAGE,
  consent: "on",
  website: "",
  from: "contact",
  "cf-turnstile-response": FAKE_TURNSTILE_PASS,
  ...overrides,
});

type Row = { id: string; role: string; kind: string; name: string | null; email: string; message: string; locale: string; user_id: string | null; status: string; notified_at: string | null };
const rowsFor = async (email: string) => (await testEnv.DB.prepare("SELECT * FROM feedback WHERE email = ?1 ORDER BY created_at").bind(email).all<Row>()).results;
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

describe("POST /contact, signed out (plan VNX-0710 AC4)", () => {
  beforeEach(() => clearOutbox());

  it("stores one new row, mails contact@vnx.si with reply-to the sender, sets notified_at and redirects to ?sent=1", async () => {
    const res = await post("/vi/contact", form("  Sender@Example.VN ", { message: `${MESSAGE}\r\nSecond line <script>alert(1)</script>` }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/contact?sent=1");
    const [row, extra] = await rowsFor("sender@example.vn");
    expect(extra).toBeUndefined();
    expect(row).toMatchObject({ role: "builder", kind: "question", name: "Minh Tran", email: "sender@example.vn", locale: "vi", user_id: null, status: "new" });
    expect(row!.message).toBe(`${MESSAGE}\nSecond line <script>alert(1)</script>`);
    expect(row!.notified_at).not.toBeNull();

    expect(outbox).toHaveLength(1);
    const mail = outbox[0]!;
    expect(mail.to).toBe("contact@vnx.si");
    expect(mail.replyTo).toBe("sender@example.vn");
    expect(mail.subject).toBe("[VNX.SI contact] question from builder");
    for (const part of ["builder", "question", "Minh Tran", "sender@example.vn", "vi", `https://vnx.si/admin/feedback/${row!.id}`, "Second line <script>alert(1)</script>"]) {
      expect(mail.text, part).toContain(part);
    }
    expect(mail.html).toContain("Second line &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain(`https://vnx.si/admin/feedback/${row!.id}`);
  });

  it("stores an empty name as null and redirects to /contact?sent=1 in English", async () => {
    const res = await post("/contact", form("noname@example.vn", { name: "  ", role: "client", kind: "partnership" }));
    expect(res.headers.get("location")).toBe("/contact?sent=1");
    expect((await rowsFor("noname@example.vn"))[0]).toMatchObject({ name: null, role: "client", kind: "partnership", locale: "en" });
    expect(outbox[0]?.subject).toBe("[VNX.SI contact] partnership from client");
  });
});

describe("POST /contact from the landing form (plan VNX-0710 AC5)", () => {
  beforeEach(() => clearOutbox());

  it("redirects back to the landing #ask block in the same locale", async () => {
    const en = await post("/contact", form("landing-en@example.vn", { from: "landing" }));
    expect(en.status).toBe(303);
    expect(en.headers.get("location")).toBe("/?asked=1#ask");
    const zh = await post("/zh-hant/contact", form("landing-zh@example.vn", { from: "landing" }));
    expect(zh.headers.get("location")).toBe("/zh-hant/?asked=1#ask");
    expect(await rowsFor("landing-zh@example.vn")).toHaveLength(1);
  });

  it("treats an unknown `from` as the contact page", async () => {
    const res = await post("/contact", form("from-odd@example.vn", { from: "https://evil.example" }));
    expect(res.headers.get("location")).toBe("/contact?sent=1");
  });
});

describe("POST /contact field errors (plan VNX-0710 AC6)", () => {
  beforeEach(() => clearOutbox());

  const cases: [string, Record<string, string>, string, "contact.error.choice" | "contact.error.email" | "contact.error.message" | "contact.error.consent"][] = [
    ["role", { role: "admin" }, "role", "contact.error.choice"],
    ["kind", { kind: "praise" }, "kind", "contact.error.choice"],
    ["email", { email: "not-an-email" }, "email", "contact.error.email"],
    ["short message", { message: "Too short." }, "message", "contact.error.message"],
    ["long message", { message: "x".repeat(2001) }, "message", "contact.error.message"],
    ["consent", { consent: "" }, "consent", "contact.error.consent"],
  ];

  for (const [label, override, field, key] of cases) {
    it(`${label}: 400, the /contact page again with the typed values and the error on that field (vi)`, async () => {
      const email = `err-${field}-${label.length}@example.vn`;
      const fields = form(email, { ...override, from: "landing" });
      const res = await post("/vi/contact", fields);
      expect(res.status).toBe(400);
      const html = await res.text();
      const main = mainOf(html);
      expect(main).toContain('action="/vi/contact"');
      expect(main).toContain(`<p id="ct-${field}-error" class="error-msg">${t("vi", key)}</p>`);
      // VNX-0807: the shared pattern. The role group links to its first radio.
      expectErrorSummary(html, [field === "role" ? "ct-role-builder" : `ct-${field}`], { titlePrefix: "Lỗi:" });
      expect(html).toContain("Có lỗi cần sửa");
      expect(main).toContain('aria-describedby="ct-' + field + '-error"');
      expect(main.match(/class="error-msg"/g)).toHaveLength(1);
      // The typed values come back.
      if (field !== "message") expect(main).toContain(`>${override.message ?? MESSAGE}</textarea>`);
      expect(main).toContain('value="Minh Tran"');
      if (field !== "role") expect(main).toMatch(/value="builder"[^>]*checked=""|checked=""[^>]*value="builder"/);
      if (field !== "kind") expect(main).toMatch(/<option value="question" selected="">/);
      expect(await rowsFor(email.trim().toLowerCase())).toHaveLength(0);
      expect(outbox).toHaveLength(0);
    });
  }

  it("escapes what was typed when it comes back", async () => {
    const res = await post("/contact", form("esc@example.vn", { name: '"><script>x</script>', message: "<b>short</b>" }));
    expect(res.status).toBe(400);
    const main = mainOf(await res.text());
    expect(main).not.toContain("<script>x</script>");
    expect(main).toContain("&lt;b&gt;short&lt;/b&gt;</textarea>");
  });
});

describe("POST /contact protections (plan VNX-0710 AC7)", () => {
  beforeEach(() => clearOutbox());
  afterEach(() => vi.restoreAllMocks());

  it("honeypot: looks like success, stores and mails nothing", async () => {
    const res = await post("/contact", form("bot@example.vn", { website: "http://spam.example" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/contact?sent=1");
    const landing = await post("/vi/contact", form("bot2@example.vn", { website: "x", from: "landing" }));
    expect(landing.headers.get("location")).toBe("/vi/?asked=1#ask");
    expect(await rowsFor("bot@example.vn")).toHaveLength(0);
    expect(await rowsFor("bot2@example.vn")).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });

  it("refuses a POST without Origin (403)", async () => {
    const res = await post("/contact", form("no-origin@example.vn"), { origin: null });
    expect(res.status).toBe(403);
    expect(await rowsFor("no-origin@example.vn")).toHaveLength(0);
  });

  it("refuses a failed Turnstile check with 400 and the captcha message", async () => {
    const res = await post("/vi/contact", form("captcha@example.vn", { "cf-turnstile-response": "wrong" }));
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(textOf(mainOf(html))).toContain(t("vi", "contact.error.captcha"));
    // VNX-0807: a form-level error is an unlinked summary line, and the page has no role="alert".
    expect(expectErrorSummary(html, [], { formLevel: 1, titlePrefix: "Lỗi:" })).toContain(t("vi", "contact.error.captcha"));
    expect(await rowsFor("captcha@example.vn")).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });

  it("refuses with 503 when Turnstile is not configured (like the inquiry form)", async () => {
    const env = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    const res = await post("/contact", form("no-turnstile@example.vn"), { env });
    expect(res.status).toBe(503);
    expect(await rowsFor("no-turnstile@example.vn")).toHaveLength(0);
  });

  it("allows 5 messages per IP per hour; the 6th gets 429", async () => {
    const ip = "198.18.0.77";
    for (let i = 1; i <= 5; i++) {
      const res = await post("/contact", form(`rl-${i}@example.vn`), { ip });
      expect(res.status, `message ${i}`).toBe(303);
    }
    const sixth = await post("/vi/contact", form("rl-6@example.vn"), { ip });
    expect(sixth.status).toBe(429);
    expect(textOf(mainOf(await sixth.text()))).toContain(t("vi", "contact.error.rateLimited"));
    expect(await rowsFor("rl-6@example.vn")).toHaveLength(0);
    const key = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = ?1").bind(`contact:ip:${ip}`).first<{ n: number }>();
    expect(key?.n).toBe(1);
  });

  it("does not count honeypot hits or invalid forms against the limit", async () => {
    const ip = "198.18.0.78";
    for (let i = 0; i < 6; i++) await post("/contact", form(`rl-hp-${i}@example.vn`, { website: "spam" }), { ip });
    for (let i = 0; i < 6; i++) await post("/contact", form(`rl-bad-${i}@example.vn`, { message: "short" }), { ip });
    expect((await post("/contact", form("rl-hp-ok@example.vn"), { ip })).status).toBe(303);
  });
});

describe("POST /contact, signed in (plan VNX-0710 AC8)", () => {
  beforeEach(() => clearOutbox());

  it("needs no Turnstile and stores the account's user_id with the typed e-mail", async () => {
    const { user, cookie } = await signIn("ct-signed@vnx.si");
    const fields = form("ct-signed-reply@example.vn", { "cf-turnstile-response": "" });
    const res = await post("/zh-hans/contact", fields, { cookie });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/zh-hans/contact?sent=1");
    const [row] = await rowsFor("ct-signed-reply@example.vn");
    expect(row).toMatchObject({ user_id: user.id, locale: "zh-Hans", status: "new" });
    expect(outbox[0]?.replyTo).toBe("ct-signed-reply@example.vn");
  });
});

describe("POST /contact when the mail fails (plan VNX-0710 AC9)", () => {
  beforeEach(() => clearOutbox());
  afterEach(() => vi.restoreAllMocks());

  it("keeps the row with notified_at null, logs, and still shows success", async () => {
    vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error("resend down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("/contact", form("mailfail@example.vn"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/contact?sent=1");
    const [row] = await rowsFor("mailfail@example.vn");
    expect(row).toMatchObject({ status: "new", notified_at: null });
    expect(error).toHaveBeenCalled();
    const logged = String(error.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({ event: "contact.notify_failed", feedbackId: row!.id });
    expect(logged).not.toContain("mailfail@example.vn");
  });
});

describe("POST /contact from the landing form, signed out (VNX-0710 F1)", () => {
  beforeEach(() => clearOutbox());

  it("the landing form carries the widget, and a valid token gets 303 to the landing #ask on the first send, in each locale", async () => {
    for (const [prefix, home] of [
      ["", "/"],
      ["/vi", "/vi/"],
      ["/zh-hans", "/zh-hans/"],
      ["/zh-hant", "/zh-hant/"],
    ] as const) {
      // The form the visitor actually sees on the landing page has the widget.
      const landing = await (await app().request(new Request(`https://vnx.si${home}`), undefined, testEnv)).text();
      const ask = landing.slice(landing.indexOf('<section id="ask"'));
      expect(ask, home).toContain('<div class="cf-turnstile" data-sitekey="fake-site-key"></div>');

      const email = `landing-first${prefix.replace("/", "-")}@example.vn`;
      const res = await post(`${prefix}/contact`, form(email, { from: "landing" }));
      expect(res.status, prefix).toBe(303);
      expect(res.headers.get("location"), prefix).toBe(`${home}?asked=1#ask`);
      expect(await rowsFor(email), prefix).toHaveLength(1);
    }
    expect(outbox).toHaveLength(4);
  });

  it("without a Turnstile token: 400 on /contact with the values kept, the widget shown and nothing stored", async () => {
    const fields = form("landing-nocaptcha@example.vn", { from: "landing" });
    delete fields["cf-turnstile-response"];
    const res = await post("/vi/contact", fields);
    expect(res.status).toBe(400);
    const html = await res.text();
    const main = mainOf(html);
    expect(textOf(main)).toContain(t("vi", "contact.error.captcha"));
    expect(main).toContain('class="cf-turnstile" data-sitekey="fake-site-key"');
    expect(main).toContain('<input type="hidden" name="from" value="contact"');
    expect(main).toContain(`>${MESSAGE}</textarea>`);
    expect(main).toContain('value="landing-nocaptcha@example.vn"');
    expect(await rowsFor("landing-nocaptcha@example.vn")).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });
});
