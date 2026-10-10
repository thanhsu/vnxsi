import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { externalReferrerHost, siteHosts } from "../../src/domain/waitlist-input.ts";
import { t } from "../../src/i18n/t.ts";
import { expectErrorSummary, formPost, testEnv } from "../helpers.ts";

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

  it("stores utm_* (capped at 200)", async () => {
    const res = await post(
      "/waitlist",
      { email: "utm@example.com", consent: "on", utm_source: "newsletter", utm_medium: "email", utm_campaign: "y".repeat(300) },
      "198.51.100.3",
    );
    expect(res.status).toBe(303);
    const row = await rowOf("utm@example.com");
    expect(row).toMatchObject({ utm_source: "newsletter", utm_medium: "email" });
    expect(row!.utm_campaign).toBe("y".repeat(200));
  });

  it("F1: stores the referrer host carried in ref, and ignores the POST's own Referer header", async () => {
    const res = await post("/waitlist", { email: "ref-hn@example.com", consent: "on", ref: "news.ycombinator.com" }, "198.51.100.10", {
      referer: "https://vnx.si/",
    });
    expect(res.status).toBe(303);
    expect((await rowOf("ref-hn@example.com"))?.referrer).toBe("news.ycombinator.com");

    await post("/waitlist", { email: "ref-header@example.com", consent: "on" }, "198.51.100.10", { referer: "https://news.example.org/a" });
    expect((await rowOf("ref-header@example.com"))?.referrer).toBeNull();
  });

  it("F1: a ref that is not a plain external hostname is stored as null", async () => {
    const odd = [
      "news.ycombinator.com/item",
      "https://news.ycombinator.com",
      "news ycombinator.com",
      "news.ycombinator.com?x=1",
      "<script>",
      "user@host.com",
      "a".repeat(201),
      "vnx.si",
      "www.vnx.si",
    ];
    for (const [i, ref] of odd.entries()) {
      const email = `ref-odd-${i}@example.com`;
      const res = await post("/waitlist", { email, consent: "on", ref }, "198.51.100.11");
      expect(res.status, ref).toBe(303);
      expect((await rowOf(email))?.referrer, ref).toBeNull();
    }
  });

  it("F3: treats APP_ORIGIN, www. + APP_ORIGIN and the request host as the site itself", () => {
    const hosts = siteHosts("vnx.si", "vnxsi-web.preview.workers.dev");
    expect(hosts).toEqual(expect.arrayContaining(["vnx.si", "www.vnx.si", "vnxsi-web.preview.workers.dev"]));
    expect(externalReferrerHost("https://www.vnx.si/x", hosts)).toBeNull();
    expect(externalReferrerHost("https://vnx.si/vi/", hosts)).toBeNull();
    expect(externalReferrerHost("https://vnxsi-web.preview.workers.dev/", hosts)).toBeNull();
    expect(externalReferrerHost("https://News.YCombinator.com/item?id=1", hosts)).toBe("news.ycombinator.com");
    expect(externalReferrerHost("ftp://files.example.com/", hosts)).toBeNull();
    expect(externalReferrerHost(undefined, hosts)).toBeNull();
  });

  it("F2: keeps the consent box ticked when the form comes back with an error", async () => {
    const ticked = await post("/vi/waitlist", { email: "bad-but-consented", consent: "on" }, "198.51.100.12");
    expect(ticked.status).toBe(400);
    expect(await ticked.text()).toMatch(/<input id="waitlist-consent"[^>]*\schecked[\s=>]/);

    const unticked = await post("/vi/waitlist", { email: "no-tick@example.com" }, "198.51.100.12");
    expect(unticked.status).toBe(400);
    expect(await unticked.text()).not.toMatch(/<input id="waitlist-consent"[^>]*\schecked[\s=>]/);
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
    // VNX-0807: title prefix, one focused summary inside #notify linking the field; the page is still the landing page (same canonical, no robots tag).
    const body = expectErrorSummary(html, ["waitlist-email"], { titlePrefix: "Lỗi:" });
    expect(body).toContain("Email chưa đúng định dạng.");
    expect(html.indexOf('id="form-errors"')).toBeGreaterThan(html.indexOf('id="notify"'));
    expect(html).toContain('<link rel="canonical" href="https://vnx.si/vi/"');
    expect(html).not.toContain('name="robots"');
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
    expectErrorSummary(html, [], { formLevel: 1, titlePrefix: "Lỗi:" }); // the rate-limit line is a form-level summary item
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
