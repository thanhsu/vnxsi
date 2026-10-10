import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { setBuilderStatus } from "../../src/db/builders.ts";
import { searchProducts } from "../../src/db/catalog.ts";
import { searchBuilders } from "../../src/db/directory.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { linkIdentity, listPublicBadges, setShowOnProfile } from "../../src/db/identities.ts";
import type { BuilderStatus } from "../../src/domain/builder.ts";
import { parseCatalogQuery } from "../../src/domain/catalog.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import type { Bindings } from "../../src/env.ts";
import { addLiveProduct, ensureUser, makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
const ALL = ["github", "linkedin"] as const;
/** A provider flag on or off (Owner E1: a badge follows its provider's flag). The cache is reset so the change is seen at once. */
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
const get = (path: string, cookie?: string) => createApp().request(getReq(path, cookie), undefined, testEnv);
const pageOf = async (handle: string, path = "/b/") => decode(await (await get(`${path}${handle}`)).text());
const blockOf = (html: string) => html.match(/<ul class="verified-list"[^>]*>.*?<\/ul>/s)?.[0] ?? "";

/** An approved (default) builder; every test its own e-mail and handle. */
async function builderOf(status: BuilderStatus = "approved") {
  const t = tag();
  const builder = await makeBuilder(`bb-${t}@vnx.si`, `bb-${t}`, status);
  return { builder, handle: builder.handle, email: `bb-${t}@vnx.si` };
}
const link = async (userId: string, provider: OAuthProvider, label: string) => {
  const r = await linkIdentity(testEnv.DB, { userId, provider, subject: `s-${tag()}`, label, now: new Date().toISOString() });
  if (!r.ok) throw new Error(r.reason);
  return r.identity;
};
/** Straight into the row, the way a legacy or hostile row could look: bypasses every route and every type. */
const rawFlag = (userId: string, provider: string, value = 1) =>
  testEnv.DB.prepare("UPDATE user_identities SET show_on_profile = ?3 WHERE user_id = ?1 AND provider = ?2").bind(userId, provider, value).run();
const rawIdentity = (userId: string, provider: string, label: string) =>
  testEnv.DB.prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)")
    .bind(`id-${tag()}`, userId, provider, `s-${tag()}`, label, new Date().toISOString()).run();
const optIn = (userId: string, provider: "github" | "linkedin") => setShowOnProfile(testEnv.DB, { userId, provider, show: true, now: new Date().toISOString() });

describe("/b/:handle verified badge (VNX-2606b)", () => {
  it("GitHub: @login linked to github.com, 'verified via GitHub', safe rel and target", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octocat");
    await optIn(builder.userId, "github");
    const html = await pageOf(handle);
    expect(html).toContain("Lan Nguyen"); // positive: the profile renders
    expect(blockOf(html)).toContain('<a href="https://github.com/octocat" rel="nofollow noopener noreferrer" target="_blank">@octocat</a>');
    expect(blockOf(html)).toContain("verified via GitHub");
    expect(blockOf(html)).toContain('aria-label="Verified accounts"');
  });

  it("an Enterprise Managed Users login (underscore) renders and links correctly", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "mona-cat_octo");
    await optIn(builder.userId, "github");
    expect(blockOf(await pageOf(handle))).toContain('<a href="https://github.com/mona-cat_octo" rel="nofollow noopener noreferrer" target="_blank">@mona-cat_octo</a>');
  });

  it("LinkedIn: only the label, no link, no e-mail, no name", async () => {
    const { builder, handle } = await builderOf();
    const email = `li-${tag()}@example.com`;
    await link(builder.userId, "linkedin", email);
    await optIn(builder.userId, "linkedin");
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("verified via LinkedIn");
    expect(blockOf(html)).not.toMatch(/<a |href=/);
    expect(html).not.toContain(email);
    expect(html).not.toContain("linkedin.com");
  });

  it("both badges: GitHub first, then LinkedIn", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await link(builder.userId, "github", "octo-both");
    await optIn(builder.userId, "linkedin");
    await optIn(builder.userId, "github");
    const block = blockOf(await pageOf(handle));
    expect(block.indexOf("GitHub")).toBeGreaterThan(-1);
    expect(block.indexOf("GitHub")).toBeLessThan(block.indexOf("LinkedIn"));
  });

  it("Google is never shown, even when its row somehow has show_on_profile = 1", async () => {
    const { builder, handle } = await builderOf();
    const email = `g-${tag()}@example.com`;
    await link(builder.userId, "google", email);
    await link(builder.userId, "github", "octo-plus-google");
    await optIn(builder.userId, "github"); // positive: a badge block exists
    await rawFlag(builder.userId, "google", 1);
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("verified via GitHub");
    expect(html).not.toContain("Google");
    expect(html).not.toContain(email);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([{ provider: "github", login: "octo-plus-google", url: "https://github.com/octo-plus-google" }]);
  });

  it("linked but not opted in: nothing is shown", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-quiet");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    const html = await pageOf(handle);
    expect(html).toContain("Lan Nguyen"); // positive
    expect(html).not.toContain("verified via");
    expect(html).not.toContain('class="verified-list"');
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
  });

  it("a provider whose flag is off (or not configured) shows no badge; the other is independent; the stored choice is kept and the badge returns with the flag (Owner E1)", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-flag");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await optIn(builder.userId, "github");
    await optIn(builder.userId, "linkedin");
    expect(blockOf(await pageOf(handle))).toContain("verified via GitHub"); // positive precondition: both flags on
    expect(blockOf(await pageOf(handle))).toContain("verified via LinkedIn");
    await setProvider("github", false);
    const off = await pageOf(handle);
    expect(off).not.toContain("octo-flag");
    expect(off).not.toContain("verified via GitHub");
    expect(blockOf(off)).toContain("verified via LinkedIn");
    const kept = await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1 AND provider = 'github'").bind(builder.userId).first<{ v: number }>();
    expect(kept?.v).toBe(1); // the flag never rewrites the stored choice
    await setProvider("linkedin", false);
    expect(await pageOf(handle)).not.toContain('class="verified-list"');
    expect(await listPublicBadges(testEnv.DB, builder.userId, [])).toEqual([]);
    await setProvider("github", true);
    expect(blockOf(await pageOf(handle))).toContain("verified via GitHub");
    const unconfigured = await createApp().request(getReq(`/b/${handle}`), undefined, { ...testEnv, OAUTH_DRIVER: undefined } as Bindings); // flag on, no credentials
    expect(await unconfigured.text()).not.toContain("verified via GitHub");
  });

  it("toggle on, off and unlink take effect on the very next anonymous load (no cache)", async () => {
    const { builder, handle, email } = await builderOf();
    await link(builder.userId, "github", "octo-live");
    const { cookie } = await signIn(email);
    const toggle = (show: "0" | "1") => createApp().request(formPost("/hub/identities/github/badge", { show }, { cookie }), undefined, testEnv);
    expect(await pageOf(handle)).not.toContain("verified via");
    await toggle("1");
    expect(await pageOf(handle)).toContain("verified via GitHub");
    await toggle("0");
    expect(await pageOf(handle)).not.toContain("verified via");
    await toggle("1");
    expect(await pageOf(handle)).toContain("verified via GitHub"); // positive precondition for the unlink step
    const unlinked = await createApp().request(formPost("/me/identities/github/unlink", {}, { cookie }), undefined, testEnv);
    expect(unlinked.status).toBe(303);
    expect(await pageOf(handle)).not.toContain("verified via");
    expect(await pageOf(handle)).not.toContain("octo-live");
  });

  it.each(["pending", "rejected", "suspended"] as const)("a %s builder: the page is 404, the query is empty, the row and flag stay; approved again, the badge returns", async (status) => {
    const { builder, handle } = await builderOf("approved");
    await link(builder.userId, "github", `octo-${status}`);
    await optIn(builder.userId, "github");
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toHaveLength(1); // positive precondition
    const now = new Date().toISOString();
    expect(await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "approved", to: status === "suspended" ? "suspended" : "pending", reviewNote: null, now })).not.toBeNull();
    if (status === "rejected") await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: "pending", to: "rejected", reviewNote: "x", now });
    expect((await get(`/b/${handle}`)).status).toBe(404);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
    const row = await testEnv.DB.prepare("SELECT show_on_profile AS v FROM user_identities WHERE user_id = ?1").bind(builder.userId).first<{ v: number }>();
    expect(row?.v).toBe(1); // kept (ADR-012 §5, decision (c))
    expect(await setBuilderStatus(testEnv.DB, { userId: builder.userId, from: status, to: "approved", reviewNote: null, now })).not.toBeNull();
    expect(await pageOf(handle)).toContain(`octo-${status}`);
  });

  it("a suspended account hides the badge too", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-acct");
    await optIn(builder.userId, "github");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(builder.userId).run();
    expect((await get(`/b/${handle}`)).status).toBe(404);
    expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
  });

  it("another builder's opt-in never shows on this profile", async () => {
    const a = await builderOf();
    const b = await builderOf();
    await link(a.builder.userId, "github", "octo-of-a");
    await optIn(a.builder.userId, "github");
    expect(await pageOf(a.handle)).toContain("octo-of-a"); // positive
    const html = await pageOf(b.handle);
    expect(html).not.toContain("octo-of-a");
    expect(html).not.toContain("verified via");
  });

  it.each(["<script>alert(1)</script>", "octo/cat", "octo%2Fcat", "octo cat", "octo.cat", "_octo", "-octo", "a".repeat(40), "octo?x=1", "octo#x"])(
    "a stored GitHub label that is not a plain login (%s) draws no badge and no link",
    async (label) => {
      const { builder, handle } = await builderOf();
      await rawIdentity(builder.userId, "github", label);
      const html = await pageOf(handle);
      expect(html).toContain("Lan Nguyen"); // positive: the page renders, the row is opted in
      expect(await testEnv.DB.prepare("SELECT 1 AS n FROM user_identities WHERE user_id = ?1 AND show_on_profile = 1").bind(builder.userId).first()).not.toBeNull();
      expect(html).not.toContain("verified via");
      expect(html).not.toContain("github.com/octo");
      expect(html).not.toContain("<script>alert(1)");
      expect(await listPublicBadges(testEnv.DB, builder.userId, ALL)).toEqual([]);
    },
  );

  it("the badge markup has no inline style, script or handler, and no external resource", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-csp");
    await link(builder.userId, "linkedin", `li-${tag()}@example.com`);
    await optIn(builder.userId, "github");
    await optIn(builder.userId, "linkedin");
    const block = blockOf(await pageOf(handle));
    expect(block).toContain("verified via LinkedIn"); // positive: both are drawn
    expect(block).not.toMatch(/style=|<script|\son\w+=|<img|<iframe|src=/i);
    expect((block.match(/href=/g) ?? []).length).toBe(1); // only the GitHub link
  });

  it("the badge is not in JSON-LD, the meta description or the sitemap", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-meta");
    await optIn(builder.userId, "github");
    const html = await pageOf(handle);
    expect(blockOf(html)).toContain("octo-meta"); // positive
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) expect(m[1]).not.toContain("github.com");
    expect(html.match(/<meta name="description" content="[^"]*"/)?.[0] ?? "").not.toContain("octo-meta");
    const sitemap = await (await get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("octo-meta");
  });

  it("renders its label in vi, zh-Hans and zh-Hant; the brand is not translated", async () => {
    const { builder, handle } = await builderOf();
    await link(builder.userId, "github", "octo-i18n");
    await optIn(builder.userId, "github");
    expect(blockOf(await pageOf(handle, "/vi/b/"))).toContain("đã xác minh qua GitHub");
    expect(blockOf(await pageOf(handle, "/zh-hans/b/"))).toContain("已通过 GitHub 验证");
    expect(blockOf(await pageOf(handle, "/zh-hant/b/"))).toContain("已透過 GitHub 驗證");
  });

  it("cache: an anonymous load sets no public caching header; a signed-in one is no-store", async () => {
    const { builder, handle, email } = await builderOf();
    await link(builder.userId, "github", "octo-cache");
    await optIn(builder.userId, "github");
    const anon = await get(`/b/${handle}`);
    expect(anon.status).toBe(200);
    expect(anon.headers.get("cache-control") ?? "").not.toMatch(/public|max-age|s-maxage|immutable/i);
    const { cookie } = await signIn(email);
    expect((await get(`/b/${handle}`, cookie)).headers.get("cache-control")).toBe("no-store");
  });
});

describe("the badge never changes the order of builders (ADR-004)", () => {
  it("the catalogue order (searchProducts) is identical before and after badges are opted in for the builders of live products", async () => {
    const t = tag();
    const word = `zq${t}`;
    const owners = [];
    for (const n of ["one", "two", "three"]) {
      const b = await makeBuilder(`oc-${n}-${t}@vnx.si`, `oc-${n}-${t}`, "approved");
      await addLiveProduct(b, `${word} ${n}`);
      owners.push(b);
    }
    const order = async () => (await searchProducts(testEnv.DB, parseCatalogQuery({ q: word }))).items.map((i) => i.name);
    const before = await order();
    expect(before).toHaveLength(3); // positive: a real order to protect
    for (const b of owners.slice(1)) { // the lower-ranked ones, to catch any lift
      await link(b.userId, "github", `oc-${b.handle}`);
      await optIn(b.userId, "github");
    }
    expect(await order()).toEqual(before);
    await link(owners[0]!.userId, "linkedin", `oc-${t}@example.com`);
    await optIn(owners[0]!.userId, "linkedin");
    expect(await order()).toEqual(before);
  });

  it("the directory order is identical with no badges, with badges on the others, and with all badges on", async () => {
    const t = tag();
    const word = `Zq${t}`;
    const a = await makeBuilder(`or-a-${t}@vnx.si`, `or-a-${t}`, "approved", { name: `${word} Alpha` });
    const b = await makeBuilder(`or-b-${t}@vnx.si`, `or-b-${t}`, "approved", { name: `${word} Beta` });
    const c = await makeBuilder(`or-c-${t}@vnx.si`, `or-c-${t}`, "approved", { name: `${word} Gamma` });
    await addLiveProduct(a, `or-product-${t}`); // a ranks first on published products: a non-trivial order
    const query = { q: word, category: null, lang: null, country: null, availability: null, page: 1 } as const;
    const order = async () => (await searchBuilders(testEnv.DB, query)).items.map((e) => e.handle);
    const before = await order();
    expect(before).toHaveLength(3);
    expect(before[0]).toBe(a.handle);
    for (const x of [b, c]) {
      await link(x.userId, "github", `or-${x.handle}`);
      await optIn(x.userId, "github");
    }
    expect(await order()).toEqual(before); // badges on the two lower ones: no lift
    await link(a.userId, "linkedin", `or-${t}@example.com`);
    await optIn(a.userId, "linkedin");
    expect(await order()).toEqual(before);
    expect(await (await get(`/builders?q=${word}`)).text()).not.toContain("verified via"); // not on the directory card either
  });
});
