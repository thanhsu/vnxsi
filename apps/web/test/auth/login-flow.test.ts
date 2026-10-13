import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { sha256Hex } from "../../src/auth/crypto.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { expectErrorSummary, followMagicLink, formPost, testEnv } from "../helpers.ts";

function tokenFrom(text: string): string {
  const m = /\/auth\/verify\?t=([A-Za-z0-9_-]{43})/.exec(text);
  if (!m?.[1]) throw new Error("no token in email");
  return m[1];
}

function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /__Host-vnx_session=([^;]+)/.exec(set);
  if (!m?.[1]) throw new Error("no session cookie");
  return m[1];
}

describe("magic link login", () => {
  beforeEach(() => clearOutbox());

  it("renders the login form in each locale", async () => {
    const app = createApp();
    const vi = await app.request("https://vnx.si/vi/login", {}, testEnv);
    expect(vi.status).toBe(200);
    expect(await vi.text()).toContain("Đăng nhập VNX.SI");
    const zh = await app.request("https://vnx.si/zh-hant/login", {}, testEnv);
    expect(await zh.text()).toContain("登入 VNX.SI");
  });

  it("logs in end to end and normalizes the email", async () => {
    const app = createApp();
    const sent = await app.request(formPost("/vi/login", { email: "  Lan@Example.VN " }), undefined, testEnv);
    expect(sent.status).toBe(200);
    expect(await sent.text()).toContain("lan@example.vn");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe("lan@example.vn");
    expect(outbox[0]?.subject).toBe("Link đăng nhập VNX.SI của bạn");

    const verify = await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, testEnv);
    expect(verify.status).toBe(303);
    expect(verify.headers.get("location")).toBe("/");
    const setCookie = verify.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/__Host-vnx_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const user = await testEnv.DB.prepare("SELECT locale, is_admin, last_login_at FROM users WHERE email = 'lan@example.vn'").first<{
      locale: string;
      is_admin: number;
      last_login_at: string | null;
    }>();
    expect(user).toMatchObject({ locale: "vi", is_admin: 0 });
    expect(user?.last_login_at).not.toBeNull();
  });

  it("refuses a reused link", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "reuse@vnx.si" }), undefined, testEnv);
    const url = `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`;
    expect((await followMagicLink(app, url, testEnv)).status).toBe(303);
    const again = await followMagicLink(app, url, testEnv);
    expect(again.status).toBe(400);
    expect(await again.text()).toContain("This sign-in link no longer works");
  });

  it("makes ADMIN_EMAILS users admins, case-insensitively", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "Owner@VNX.si" }), undefined, testEnv);
    await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, testEnv);
    const row = await testEnv.DB.prepare("SELECT is_admin FROM users WHERE email = 'owner@vnx.si'").first<{ is_admin: number }>();
    expect(row?.is_admin).toBe(1);
  });

  it("follows a safe next and ignores an unsafe one", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "n1@vnx.si", next: "/hub" }), undefined, testEnv);
    const ok = await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2Fhub`, testEnv);
    expect(ok.headers.get("location")).toBe("/hub");
    clearOutbox();
    await app.request(formPost("/login", { email: "n2@vnx.si" }), undefined, testEnv);
    const bad = await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2F%2Fevil.com`, testEnv);
    expect(bad.headers.get("location")).toBe("/");
  });

  it("rejects bad emails, missing Origin and too many attempts", async () => {
    const app = createApp();
    expect((await app.request(formPost("/login", { email: "nope" }), undefined, testEnv)).status).toBe(400);
    const noOrigin = new Request("https://vnx.si/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=a%40vnx.si",
    });
    expect((await app.request(noOrigin, undefined, testEnv)).status).toBe(403);

    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await app.request(formPost("/login", { email: "flood@vnx.si" }), undefined, testEnv)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("shows the shared error summary: a field error links to the e-mail box, a rate limit is form-level", async () => {
    const app = createApp();
    const bad = await app.request(formPost("/login", { email: "nope" }), undefined, testEnv);
    const html = await bad.text();
    expectErrorSummary(html, ["email"]);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');

    const clean = await (await app.request("https://vnx.si/login", {}, testEnv)).text();
    expect(clean).not.toContain("form-errors");
    expect(clean).not.toContain('aria-invalid');
    expect(clean).toMatch(/<title>[^<]*<\/title>/);
    expect(/<title>([^<]*)<\/title>/.exec(clean)?.[1]).not.toMatch(/^Error:/);

    let limited: Response | undefined;
    for (let i = 0; i < 6; i++) limited = await app.request(formPost("/login", { email: "summary-flood@vnx.si" }), undefined, testEnv);
    expect(limited!.status).toBe(429);
    const flood = await limited!.text();
    expectErrorSummary(flood, [], { formLevel: 1 });
    expect(flood).not.toContain('aria-invalid');
    expect(flood).not.toContain('id="email-error"');
  });

  it("uses the Vietnamese pattern on a bad e-mail", async () => {
    const res = await createApp().request(formPost("/vi/login", { email: "nope" }), undefined, testEnv);
    expect(res.status).toBe(400);
    expectErrorSummary(await res.text(), ["email"], { titlePrefix: "Lỗi:" });
  });

  it("escapes HTML in a rejected email value", async () => {
    const res = await createApp().request(formPost("/login", { email: "<script>x</script>" }), undefined, testEnv);
    expect(await res.text()).not.toContain("<script>x</script>");
  });

  it("logs out and invalidates the session", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "out@vnx.si" }), undefined, testEnv);
    const verify = await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}`, testEnv);
    const sid = cookieFrom(verify);
    const out = await app.request(formPost("/logout", {}, { cookie: `__Host-vnx_session=${sid}` }), undefined, testEnv);
    expect(out.status).toBe(303);
    expect(out.headers.get("set-cookie") ?? "").toMatch(/__Host-vnx_session=;/);
    const left = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1")
      .bind(await sha256Hex(sid))
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("ignores a next that smuggles a tab past safeNext", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "tab@vnx.si" }), undefined, testEnv);
    const res = await followMagicLink(app, `https://vnx.si/auth/verify?t=${tokenFrom(outbox[0]!.text)}&next=%2F%09%2Fevil.com`, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });
});
