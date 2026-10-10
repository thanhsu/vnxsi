import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import { formatUtc } from "../../src/email/templates/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { enableProvider, linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`; // per-test addresses: no global counts, D1 is shared
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const rowsOf = (userId: string, provider: string) => n("SELECT count(*) AS n FROM user_identities WHERE user_id = ?1 AND provider = ?2", userId, provider);
const audits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT data FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink' ORDER BY id").bind(userId).all<{ data: string }>()).results.map((r) => r.data);
const mailTo = (address: string) => outbox.filter((m) => m.to === address);
const unlink = (provider: string, cookie: string, path = `/me/identities/${provider}/unlink`, headers: Record<string, string> = {}, env: Bindings = testEnv) =>
  createApp().request(formPost(path, {}, { cookie, ...headers }), undefined, env);
const withoutCredentials = { ...testEnv, OAUTH_DRIVER: undefined } as Bindings;

const spies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(async () => {
  clearOutbox();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  spies.splice(0).forEach((s) => s.mockRestore());
  vi.restoreAllMocks();
});
const logged = () => spies.flatMap((s) => s.mock.calls).map((args) => args.map(String).join(" "));

describe("POST /me/identities/:provider/unlink (VNX-2605b)", () => {
  it("removes the row, audits {provider} only, mails the owner once, and 303s to /me with the notice", async () => {
    const email = emailOf("lan");
    const label = `l-${tag()}@gmail.example`; // e-mail-shaped, as Google and LinkedIn labels are
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    const res = await unlink("github", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await rowsOf(user.id, "github")).toBe(0);
    expect(await audits(user.id)).toEqual(['{"provider":"github"}']);
    const mails = mailTo(email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.to).toBe(email);
    expect(mails[0]?.subject).toBe("GitHub was unlinked from your VNX.SI account");
    expect(mails[0]?.text).toContain("GitHub");
    expect(mails[0]?.text).toContain(label);
    const audit = await testEnv.DB.prepare("SELECT created_at FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.identity.unlink'").bind(user.id).first<{ created_at: string }>();
    expect(mails[0]?.text).toContain(formatUtc(audit?.created_at ?? "")); // the audited instant, in UTC
    expect(mails[0]?.text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
    expect(mails[0]?.text).toContain("contact@vnx.si");
    expect(outbox).toHaveLength(1); // never to the label or anyone else
    expect(res.headers.get("location")).not.toContain(label);
  });

  it("the e-mail is in users.locale, not in the request locale; the redirect follows the request", async () => {
    const email = emailOf("lan");
    const { cookie } = await signIn(email, { locale: "vi" }); // first: `linkedUser` reuses this user, and `ensureUser` alone would make it "en"
    await linkedUser(email, "google", { subject: `sub-${tag()}`, label: `g-${tag()}@gmail.example` });
    const res = await unlink("google", cookie, "/zh-hant/me/identities/google/unlink");
    expect(res.headers.get("location")).toBe("/zh-hant/me?link=unlinked");
    expect(mailTo(email)).toHaveLength(1);
    expect(mailTo(email)[0]?.subject).toBe("Đã hủy liên kết Google khỏi tài khoản VNX.SI của bạn");
  });

  it("works whether the provider's flag is off, on, or its credentials are missing", async () => {
    for (const mode of ["off", "on", "unconfigured"] as const) {
      if (mode === "on") {
        await enableProvider("github");
        resetFlagCache();
      }
      const email = emailOf(`lan-${mode}`);
      const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
      const { cookie } = await signIn(email);
      const res = await unlink("github", cookie, undefined, {}, mode === "unconfigured" ? withoutCredentials : testEnv);
      expect(res.headers.get("location"), mode).toBe("/me?link=unlinked");
      expect(await rowsOf(user.id, "github"), mode).toBe(0);
      expect(mailTo(email), mode).toHaveLength(1);
    }
  });

  it("a provider the user has not linked: notLinked, nothing changes, no audit, no e-mail; the other provider stays", async () => {
    const lan = emailOf("lan");
    const { user } = await linkedUser(lan, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(lan);
    const res = await unlink("linkedin", cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await rowsOf(user.id, "github")).toBe(1);
    expect(await audits(user.id)).toEqual([]);
    expect(mailTo(lan)).toHaveLength(0);
  });

  it("never touches another user's row: B posting unlink for a provider only A holds changes nothing", async () => {
    const a = emailOf("a");
    const b = emailOf("b");
    const { user: userA } = await linkedUser(a, "github", { subject: `sub-${tag()}`, label: `a-${tag()}` });
    const { user: userB } = await linkedUser(b, "google", { subject: `sub-${tag()}`, label: `b-${tag()}@gmail.example` });
    const { cookie } = await signIn(b);
    const res = await unlink("github", cookie);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await rowsOf(userA.id, "github")).toBe(1);
    expect(await rowsOf(userB.id, "google")).toBe(1);
    expect(await audits(userA.id)).toEqual([]);
    expect(await audits(userB.id)).toEqual([]);
    expect(mailTo(a)).toHaveLength(0);
    expect(mailTo(b)).toHaveLength(0);
  });

  it("a second press is notLinked: one audit row, one e-mail", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    expect((await unlink("github", cookie)).headers.get("location")).toBe("/me?link=unlinked");
    expect((await unlink("github", cookie)).headers.get("location")).toBe("/me?link=notLinked");
    expect(await audits(user.id)).toHaveLength(1);
    expect(mailTo(email)).toHaveLength(1);
  });

  it("refuses a missing or foreign Origin (403) and changes nothing", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }]) expect((await unlink("github", cookie, undefined, headers)).status).toBe(403);
    const noOrigin = new Request("https://vnx.si/me/identities/github/unlink", { method: "POST", headers: { cookie } });
    expect((await createApp().request(noOrigin, undefined, testEnv)).status).toBe(403);
    expect(await rowsOf(user.id, "github")).toBe(1);
    expect(mailTo(email)).toHaveLength(0);
  });

  it("signed out goes to /login and changes nothing", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(await rowsOf(user.id, "github")).toBe(1);
  });

  it("an unknown provider is 404; the body limit is 64 KB; the redirect never leaves the site", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    expect((await unlink("facebook", cookie)).status).toBe(404);
    const big = new Request("https://vnx.si/me/identities/github/unlink", {
      method: "POST",
      headers: { origin: "https://vnx.si", cookie, "content-type": "application/x-www-form-urlencoded" },
      body: `x=${"a".repeat(70 * 1024)}`,
    });
    expect((await createApp().request(big, undefined, testEnv)).status).toBe(413);
    const res = await unlink("github", cookie, "/me/identities/github/unlink?next=https://evil.example&redirect=//evil.example");
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
  });

  it("a failing mailer keeps the unlink and logs one fixed code: no address, label, error text or secret", async () => {
    const email = emailOf("lan");
    const label = `secret-label-${tag()}`;
    const { user } = await linkedUser(email, "github", { subject: `sub-${tag()}`, label });
    const { cookie } = await signIn(email);
    vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error(`boom to ${email} ${label} token=SECRET`)); // restored by afterEach
    const res = await unlink("github", cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(await rowsOf(user.id, "github")).toBe(0);
    expect(await audits(user.id)).toHaveLength(1);
    const lines = logged();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ event: "identity.mail_failed", kind: "unlinked", provider: "github", code: "notify_failed" });
    for (const secret of [email, label, "boom", "SECRET"]) expect(lines[0]).not.toContain(secret);
  });

  it("the e-mail carries no session id, code or action link; its only URL is the plain /me", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "linkedin", { subject: `sub-${tag()}`, label: "LinkedIn" });
    const { cookie } = await signIn(email);
    await unlink("linkedin", cookie);
    const mail = mailTo(email)[0];
    const body = `${mail?.text}\n${mail?.html}`;
    expect(body).not.toContain(cookie.split("=")[1] ?? "x");
    expect(body).not.toMatch(/[?&]t=|token=|code=|state=|\/auth\//i);
    expect([...new Set(body.match(/https?:\/\/[^\s"<]+/g) ?? [])]).toEqual([`${testEnv.APP_ORIGIN}/me`]);
  });
});

describe("the Unlink button on /me (VNX-2605b)", () => {
  const meHtml = async (path: string, cookie: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
  const section = (html: string) => html.match(/<section id="identities">.*?<\/section>/s)?.[0] ?? "";

  it("a linked row has a post form to unlink in every locale, even with the flag off; an unlinked row has none", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    const cases: Array<[string, string, string]> = [
      ["/me", "/me/identities/github/unlink", "Unlink GitHub"],
      ["/vi/me", "/vi/me/identities/github/unlink", "Hủy liên kết GitHub"],
      ["/zh-hans/me", "/zh-hans/me/identities/github/unlink", "取消关联 GitHub 账号"],
      ["/zh-hant/me", "/zh-hant/me/identities/github/unlink", "取消連結 GitHub 帳號"],
    ];
    for (const [path, action, text] of cases) {
      const html = section(await meHtml(path, cookie));
      expect(html, path).toContain(`<form method="post" action="${action}">`);
      expect(html, path).toContain(text);
      expect(html, path).not.toContain('/link"'); // flags are off: nothing is linkable
    }
    await enableProvider("google");
    resetFlagCache();
    const rows = section(await meHtml("/me", cookie)).match(/<tr>.*?<\/tr>/gs) ?? [];
    const google = rows.find((r) => r.includes("Google")) ?? "";
    expect(google).toContain("/me/identities/google/link");
    expect(google).not.toContain("unlink");
  });

  it("with no rows and every flag off, ?link=ok and ?link=failed render no section at all", async () => {
    const { cookie } = await signIn(emailOf("lan"));
    for (const value of ["ok", "failed"]) expect(await meHtml(`/me?link=${value}`, cookie), value).not.toContain('id="identities"');
    const html = await meHtml("/me?link=notLinked", cookie);
    expect(section(html)).toContain("That account wasn't linked, so nothing changed.");
    expect(section(html)).toContain('role="status"');
  });

  it("after the last row is unlinked with every flag off, the notice is still shown (no rows, no form)", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `sub-${tag()}`, label: `l-${tag()}` });
    const { cookie } = await signIn(email);
    const res = await unlink("github", cookie);
    const html = section(await meHtml(res.headers.get("location") ?? "/me", cookie));
    expect(html).toContain("Account unlinked. You can still sign in with an email link.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<tr>");
    expect(await meHtml("/me", cookie)).not.toContain('id="identities"');
  });
});
