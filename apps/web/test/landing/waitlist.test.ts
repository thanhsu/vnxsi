import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { t } from "../../src/i18n/t.ts";
import { formPost, testEnv } from "../helpers.ts";

type Row = {
  email: string;
  personas: string;
  message: string | null;
  spend_band: string | null;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  lang: string | null;
};

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Each test uses its own IP so rate-limit counters never leak between tests or files. */
const post = (path: string, fields: Record<string, string>, ip: string, headers: Record<string, string> = {}) =>
  createApp().request(formPost(path, fields, { "cf-connecting-ip": ip, ...headers }), undefined, testEnv);

const rowOf = (email: string) => testEnv.DB.prepare("SELECT * FROM waitlist WHERE email = ?1").bind(email).first<Row>();
const countOf = async (email: string) =>
  (await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE email = ?1").bind(email).first<{ n: number }>())?.n ?? 0;

describe("POST /waitlist (VNX-0708)", () => {
  it("AC5: stores a client signup and redirects back with joined=1", async () => {
    const res = await post("/vi/waitlist", { email: "  Lan.Client@Example.VN ", consent: "on" }, "198.51.100.1");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/?joined=1#notify");
    const row = await rowOf("lan.client@example.vn");
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.personas)).toEqual(["client"]);
    expect(row!.lang).toBe("vi");
    expect(row!.consent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row!.message).toBeNull();
    expect(row!.spend_band).toBeNull();
    expect(row!.referrer).toBeNull();
  });

  it("AC5: records the locale code and redirects to the locale's home in every locale", async () => {
    for (const [path, lang, location] of [
      ["/waitlist", "en", "/?joined=1#notify"],
      ["/zh-hans/waitlist", "zh-Hans", "/zh-hans/?joined=1#notify"],
      ["/zh-hant/waitlist", "zh-Hant", "/zh-hant/?joined=1#notify"],
    ] as const) {
      const email = `locale-${lang.toLowerCase()}@example.com`;
      const res = await post(path, { email, consent: "on" }, "198.51.100.2");
      expect(res.status, path).toBe(303);
      expect(res.headers.get("location"), path).toBe(location);
      expect((await rowOf(email))?.lang, path).toBe(lang);
    }
  });

  it("stores utm_* (capped at 200) and only an external referrer host", async () => {
    const res = await post(
      "/waitlist",
      { email: "utm@example.com", consent: "on", utm_source: "newsletter", utm_medium: "email", utm_campaign: "y".repeat(300) },
      "198.51.100.3",
      { referer: "https://News.Example.org/some/path?q=1" },
    );
    expect(res.status).toBe(303);
    const row = await rowOf("utm@example.com");
    expect(row).toMatchObject({ utm_source: "newsletter", utm_medium: "email", referrer: "news.example.org" });
    expect(row!.utm_campaign).toBe("y".repeat(200));

    await post("/waitlist", { email: "same-site@example.com", consent: "on" }, "198.51.100.3", { referer: "https://vnx.si/vi/?x=1" });
    expect((await rowOf("same-site@example.com"))?.referrer).toBeNull();
  });

  it("AC6: adds client to an existing entry, keeps old personas and never duplicates client", async () => {
    const old = "2026-01-01T00:00:00.000Z";
    await testEnv.DB.prepare(
      `INSERT INTO waitlist (email, personas, consent_at, created_at, updated_at, lang) VALUES (?1, '["developer"]', ?2, ?2, ?2, 'en')`,
    )
      .bind("dev@example.com", old)
      .run();

    const first = await post("/vi/waitlist", { email: "dev@example.com", consent: "on" }, "198.51.100.4");
    const fresh = await post("/vi/waitlist", { email: "brand-new@example.com", consent: "on" }, "198.51.100.4");
    // Same response for a known and an unknown email: nothing reveals who already signed up.
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe(fresh.headers.get("location"));
    expect(await first.text()).toBe(await fresh.text());

    const row = await rowOf("dev@example.com");
    expect(JSON.parse(row!.personas)).toEqual(["developer", "client"]);
    expect(row!.lang).toBe("vi");
    expect(row!.created_at).toBe(old);
    expect(row!.updated_at).not.toBe(old);
    expect(row!.consent_at).not.toBe(old);

    const again = await post("/zh-hans/waitlist", { email: "DEV@example.com", consent: "on" }, "198.51.100.4");
    expect(again.status).toBe(303);
    const after = await rowOf("dev@example.com");
    expect(JSON.parse(after!.personas)).toEqual(["developer", "client"]);
    expect(after!.lang).toBe("zh-Hans");
    expect(await countOf("dev@example.com")).toBe(1);
  });

  it("AC7: an invalid email re-renders the form with the typed value and a localized error, and stores nothing", async () => {
    const res = await post("/vi/waitlist", { email: "not-an-email", consent: "on" }, "198.51.100.5");
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain('value="not-an-email"');
    expect(html).toContain('aria-describedby="waitlist-email-error"');
    expect(html).toMatch(/<p id="waitlist-email-error" class="error-msg"[^>]*>Email chưa đúng định dạng\.<\/p>/);
    expect(await countOf("not-an-email")).toBe(0);
  });

  it("AC7: missing consent re-renders with the typed email and a consent error, and stores nothing", async () => {
    const res = await post("/waitlist", { email: "no-consent@example.com" }, "198.51.100.5");
    expect(res.status).toBe(400);
    const html = decode(await res.text());
    expect(html).toContain('value="no-consent@example.com"');
    expect(html).toContain('aria-describedby="waitlist-consent-error"');
    expect(html).toContain(t("en", "landing.form.error.consent"));
    expect(html).not.toContain(t("en", "landing.form.error.email"));
    expect(await countOf("no-consent@example.com")).toBe(0);

    const wrong = await post("/zh-hant/waitlist", { email: "consent-yes@example.com", consent: "yes" }, "198.51.100.5");
    expect(wrong.status).toBe(400);
    expect(decode(await wrong.text())).toContain(t("zh-Hant", "landing.form.error.consent"));
    expect(await countOf("consent-yes@example.com")).toBe(0);
  });

  it("AC8: a filled honeypot gets the same success redirect and stores nothing", async () => {
    const res = await post("/vi/waitlist", { email: "bot@example.com", consent: "on", website: "https://spam.example" }, "198.51.100.6");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/vi/?joined=1#notify");
    expect(await countOf("bot@example.com")).toBe(0);
  });

  it("AC9: the 11th POST from one IP within an hour gets 429 and is not stored", async () => {
    const ip = "198.51.100.7";
    for (let i = 1; i <= 10; i++) {
      const res = await post("/waitlist", { email: `rl-${i}@example.com`, consent: "on" }, ip);
      expect(res.status, `request ${i}`).toBe(303);
    }
    const blocked = await post("/vi/waitlist", { email: "rl-11@example.com", consent: "on" }, ip);
    expect(blocked.status).toBe(429);
    const html = await blocked.text();
    expect(html).toContain(t("vi", "landing.form.error.rateLimited"));
    expect(html).toContain('value="rl-11@example.com"');
    expect(await countOf("rl-11@example.com")).toBe(0);

    const other = await post("/waitlist", { email: "rl-other-ip@example.com", consent: "on" }, "198.51.100.8");
    expect(other.status).toBe(303);
    expect(await countOf("rl-other-ip@example.com")).toBe(1);
  });

  it("AC10: a POST without a same-origin Origin header is refused and stores nothing", async () => {
    const missing = new Request("https://vnx.si/waitlist", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": "198.51.100.9" },
      body: new URLSearchParams({ email: "no-origin@example.com", consent: "on" }),
    });
    expect((await createApp().request(missing, undefined, testEnv)).status).toBe(403);
    const foreign = await post("/vi/waitlist", { email: "evil-origin@example.com", consent: "on" }, "198.51.100.9", { origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(await countOf("no-origin@example.com")).toBe(0);
    expect(await countOf("evil-origin@example.com")).toBe(0);
  });
});
