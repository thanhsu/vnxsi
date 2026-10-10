import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { linkIdentity, listIdentitiesForUser } from "../../src/db/identities.ts";
import type { BuilderStatus } from "../../src/domain/builder.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import { ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
/** A provider flag on or off (the badge switch follows the flag: Owner E1). The cache is reset so the change is seen at once. */
const setProvider = async (provider: OAuthProvider, enabled: boolean) => {
  const admin = await ensureUser("oauth-flags@example.com");
  await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
};
beforeEach(async () => {
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  await setProvider("github", true);
  await setProvider("linkedin", true);
});
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A builder with a session; each test its own e-mail and handle (no shared rows, no global counts). */
async function builderOf(status: BuilderStatus = "approved") {
  const t = tag();
  const email = `bt-${t}@vnx.si`;
  const builder = await makeBuilder(email, `bt-${t}`, status);
  const { cookie } = await signIn(email);
  return { builder, cookie, email };
}
const link = (userId: string, provider: OAuthProvider, label: string) =>
  linkIdentity(testEnv.DB, { userId, provider, subject: `s-${tag()}`, label, now: new Date().toISOString() });
const flagOf = async (userId: string, provider: string) =>
  (await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1 AND provider = ?2").bind(userId, provider).first<{ v: number }>())?.v;
const badgeAudits = async (userId: string) =>
  (await testEnv.DB.prepare("SELECT action, data FROM audit_log WHERE actor_user_id = ?1 AND action LIKE 'auth.identity.badge_%' ORDER BY action").bind(userId).all<{ action: string; data: string }>()).results;
const profileHtml = async (cookie: string, path = "/hub/profile") => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
const sectionOf = (html: string) => html.match(/<section class="card wide" id="badges">.*?<\/section>/s)?.[0] ?? "";
const post = (provider: string, fields: Record<string, string>, cookie: string, headers: Record<string, string> = {}, path = `/hub/identities/${provider}/badge`) =>
  createApp().request(formPost(path, fields, { cookie, ...headers }), undefined, testEnv);

describe("/hub/profile: public badge switch (VNX-2606a)", () => {
  it("shows a switch for each linked GitHub and LinkedIn account, off by default, and never one for Google", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "mona-cat_octo");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    const googleLabel = `g-${tag()}@example.com`;
    await link(builder.userId, "google", googleLabel);
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Verified accounts on your public profile");
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).toContain("Show LinkedIn on my public profile");
    expect(section).toContain("@mona-cat_octo");
    expect(section).toContain("</strong> · Off");
    expect(section).not.toContain("Show Google"); // the intro says "Google accounts are never shown": the word alone is allowed
    expect(section).not.toContain("Hide Google");
    expect(section).not.toContain(googleLabel);
    expect(section).not.toMatch(/@example\.com/); // the LinkedIn and Google labels (e-mails) are not printed here
    expect(section).toContain('action="/hub/identities/github/badge"');
    expect(section).not.toContain("/hub/identities/google/");
    expect(section).not.toMatch(/style=|<script/);
  });

  it("has no badge section when the builder has no GitHub or LinkedIn account (Google alone does not count)", async () => {
    const { builder, cookie } = await builderOf();
    expect(await profileHtml(cookie)).not.toContain('id="badges"');
    await link(builder.userId, "google", `g-${tag()}@example.com`);
    const html = await profileHtml(cookie);
    expect(html).toContain("Edit profile"); // positive: the page renders
    expect(html).not.toContain('id="badges"');
  });

  it("turns the badge on and off: 303 to /hub/profile with a notice, one audit row of {provider} each, flag flips", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octocat");
    expect(await flagOf(builder.userId, "github")).toBe(0);
    const on = await post("github", { show: "1" }, cookie);
    expect(on.status).toBe(303);
    expect(on.headers.get("location")).toBe("/hub/profile?badge=shown#badges");
    expect(await flagOf(builder.userId, "github")).toBe(1);
    const html = await profileHtml(cookie, "/hub/profile?badge=shown");
    expect(sectionOf(html)).toContain("</strong> · On");
    expect(sectionOf(html)).toContain("Hide GitHub from my public profile");
    expect(html).toContain("Badge turned on.");
    const off = await post("github", { show: "0" }, cookie, {}, "/vi/hub/identities/github/badge");
    expect(off.headers.get("location")).toBe("/vi/hub/profile?badge=hidden#badges"); // the redirect follows the request locale
    expect(await flagOf(builder.userId, "github")).toBe(0);
    expect(await badgeAudits(builder.userId)).toEqual([
      { action: "auth.identity.badge_hide", data: '{"provider":"github"}' }, // ORDER BY action: ULIDs of one millisecond have no reliable order
      { action: "auth.identity.badge_show", data: '{"provider":"github"}' },
    ]);
  });

  it("the same value twice writes one audit row; the second still answers 'shown'", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "linkedin", "x@example.com");
    await post("linkedin", { show: "1" }, cookie);
    const again = await post("linkedin", { show: "1" }, cookie);
    expect(again.headers.get("location")).toBe("/hub/profile?badge=shown#badges");
    expect(await badgeAudits(builder.userId)).toHaveLength(1);
  });

  it.each(["pending", "rejected", "suspended"] as const)("a %s builder sees and can use the switch; it has no public effect yet", async (status) => {
    const { builder, cookie } = await builderOf(status);
    await link(builder.userId, "github", "octo-pending");
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).toContain("Visitors see nothing while your profile is not public.");
    expect((await post("github", { show: "1" }, cookie)).status).toBe(303);
    expect(await flagOf(builder.userId, "github")).toBe(1);
    expect((await post("github", { show: "0" }, cookie)).status).toBe(303); // a consent setting, not a profile edit: both ways, even suspended
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("an approved builder does not get the 'until approved' line", async () => {
    const { builder, cookie } = await builderOf("approved");
    await link(builder.userId, "github", "octo-ok");
    const section = sectionOf(await profileHtml(cookie));
    expect(section).toContain("Show GitHub on my public profile");
    expect(section).not.toContain("while your profile is not public");
  });

  it("a provider whose flag is off has no switch; the other provider is unaffected; the stored value is kept and returns with the flag (Owner E1)", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-flag");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await post("github", { show: "1" }, cookie);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile"); // positive precondition: flag on
    await setProvider("github", false);
    const off = sectionOf(await profileHtml(cookie));
    expect(off).not.toMatch(/(Show|Hide) GitHub/); // the intro names GitHub, so check the row itself
    expect(off).not.toContain("@octo-flag");
    expect(off).not.toContain("<strong>GitHub</strong>");
    expect(off).not.toContain("/hub/identities/github/");
    expect(off).toContain("Show LinkedIn on my public profile"); // linkedin is independent
    expect(await flagOf(builder.userId, "github")).toBe(1); // the flag does not change the stored choice
    await setProvider("github", true);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile");
    await setProvider("github", false);
    await setProvider("linkedin", false);
    expect(await profileHtml(cookie)).not.toContain('id="badges"'); // both off: no section
    // The POST deliberately skips the flag check: with the flag off the builder can still switch the badge off (privacy-protective direction).
    expect(await flagOf(builder.userId, "github")).toBe(1);
    expect((await post("github", { show: "0" }, cookie)).status).toBe(303);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("google is 404 even when posted by hand (its flag stays 0); an unknown provider is 404", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "google", `g-${tag()}@example.com`);
    expect((await post("google", { show: "1" }, cookie)).status).toBe(404);
    expect((await post("myspace", { show: "1" }, cookie)).status).toBe(404);
    expect(await flagOf(builder.userId, "google")).toBe(0);
  });

  it("a provider the builder has not linked: notLinked, no audit, no row created", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "linkedin", "y@example.com"); // positive: has an identity, just not this one
    const res = await post("github", { show: "1" }, cookie);
    expect(res.headers.get("location")).toBe("/hub/profile?badge=notLinked#badges");
    expect(await flagOf(builder.userId, "github")).toBeUndefined();
    expect(await badgeAudits(builder.userId)).toEqual([]);
  });

  it("never reaches another builder's row: B posting for a provider only A has linked changes nothing of A's", async () => {
    const a = await builderOf();
    const b = await builderOf();
    await link(a.builder.userId, "github", "octo-a");
    await link(b.builder.userId, "linkedin", "b@example.com");
    const res = await post("github", { show: "1" }, b.cookie);
    expect(res.headers.get("location")).toBe("/hub/profile?badge=notLinked#badges");
    expect(await flagOf(a.builder.userId, "github")).toBe(0);
    expect((await listIdentitiesForUser(testEnv.DB, a.builder.userId))[0]?.showOnProfile).toBe(false);
    expect(await badgeAudits(a.builder.userId)).toEqual([]);
  });

  it("a body that is not exactly show=1 or show=0 is refused (409) and changes nothing", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-bad");
    for (const fields of [{}, { show: "" }, { show: "true" }, { show: "2" }] as Record<string, string>[]) expect((await post("github", fields, cookie)).status).toBe(409);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("refuses a missing or foreign Origin (403) and changes nothing", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-origin");
    expect((await post("github", { show: "1" }, cookie, { origin: "https://evil.example" })).status).toBe(403);
    const noOrigin = new Request("https://vnx.si/hub/identities/github/badge", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: "show=1" });
    expect((await createApp().request(noOrigin, undefined, testEnv)).status).toBe(403);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("signed out goes to /login, a signed-in non-builder goes to /hub/apply; neither writes", async () => {
    const out = await createApp().request(formPost("/hub/identities/github/badge", { show: "1" }), undefined, testEnv);
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toMatch(/^\/login/);
    const { cookie, user } = await signIn(`bt-nb-${tag()}@vnx.si`);
    const other = await linkedUser(`bt-nb2-${tag()}@vnx.si`, "github", { subject: `s-${tag()}`, label: "octo-nb" });
    const res = await post("github", { show: "1" }, cookie);
    expect(res.headers.get("location")).toBe("/hub/apply");
    expect(await flagOf(user.id, "github")).toBeUndefined();
    expect(await flagOf(other.user.id, "github")).toBe(0); // the other user's row is untouched
  });

  it("the body limit is 64 KB", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-big");
    expect((await post("github", { show: "1", pad: "x".repeat(70 * 1024) }, cookie)).status).toBe(413);
    expect(await flagOf(builder.userId, "github")).toBe(0);
  });

  it("unlinking removes the switch and the row (so no badge can remain)", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-gone");
    await post("github", { show: "1" }, cookie);
    expect(sectionOf(await profileHtml(cookie))).toContain("Hide GitHub from my public profile"); // positive precondition
    const res = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(await flagOf(builder.userId, "github")).toBeUndefined();
    expect(await profileHtml(cookie)).not.toContain('id="badges"');
  });

  it("renders in vi, zh-Hans and zh-Hant", async () => {
    const { builder, cookie } = await builderOf();
    await link(builder.userId, "github", "octo-i18n");
    expect(sectionOf(await profileHtml(cookie, "/vi/hub/profile"))).toContain("Hiện GitHub trên hồ sơ công khai của tôi");
    expect(sectionOf(await profileHtml(cookie, "/zh-hans/hub/profile"))).toContain("在我的公开资料中显示 GitHub");
    expect(sectionOf(await profileHtml(cookie, "/zh-hant/hub/profile"))).toContain("在我的公開資料中顯示 GitHub");
  });
});
