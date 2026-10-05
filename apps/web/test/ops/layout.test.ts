import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import type { Bindings } from "../../src/env.ts";
import { OPS_MENU, reachable, visibleMenu, type OpsMenuItem } from "../../src/ops/menu.ts";
import { ensureUser, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2503 (spec §2, §7.2; ADR-010; plan O1 A3, A8). The Ops shell: a sidebar built only from routes that exist and
 * that the role may open, a top bar, English only, noindex, and nothing inline for the CSP of VNX-0803.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const env = { ...testEnv, ADMIN_EMAILS: "owner@vnx.si" } as Bindings;

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser("owner@vnx.si");
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn("owner@vnx.si");
  return member(`ops-layout-${role}-${tag()}@vnx.si`, role);
}

async function getOps(cookie: string, bindings: Bindings = env) {
  const res = await createApp().request(new Request("https://vnx.si/ops", { headers: { cookie } }), undefined, bindings);
  return { res, html: await res.text() };
}

const ROLES: OpsRole[] = ["owner", "operator", "content", "viewer"];
const bodyOf = (html: string) => /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
const headOf = (html: string) => /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";

describe("menu registry (spec §2.1, AC2)", () => {
  const all = () => true;
  const none = () => false;
  const items: OpsMenuItem[] = [
    { group: "main", labelKey: "ops.nav.overview", path: "/ops", capability: "overview.view", icon: "overview" },
    { group: "marketplace", labelKey: "ops.nav.overview", path: "/ops/marketplace/builders", capability: "marketplace.view", icon: "overview" },
    { group: "people", labelKey: "ops.nav.overview", path: "/ops/people/team", capability: "team.manage", icon: "overview" },
  ];

  it("holds Overview and, since VNX-2504a, Marketplace › Builders with its waiting count", () => {
    expect(OPS_MENU.map((i) => [i.group, i.path, i.capability])).toEqual([
      ["main", "/ops", "overview.view"],
      ["marketplace", "/ops/marketplace/builders", "marketplace.view"],
    ]);
    expect(OPS_MENU[1]?.count).toBe("builders");
  });

  it("shows an item only when its route is registered and the role holds its capability", () => {
    const registered = (path: string) => path !== "/ops/people/team";
    const paths = (role: OpsRole, isRegistered: (p: string) => boolean) => visibleMenu(role, isRegistered, "/ops", items).flatMap((g) => g.items.map((i) => i.path));
    expect(paths("owner", all)).toEqual(["/ops", "/ops/marketplace/builders", "/ops/people/team"]);
    // Registered but not allowed: Content has no marketplace.view, nobody but the Owner has team.manage.
    expect(paths("content", all)).toEqual(["/ops"]);
    expect(paths("operator", all)).toEqual(["/ops", "/ops/marketplace/builders"]);
    // Allowed but not registered.
    expect(paths("owner", registered)).toEqual(["/ops", "/ops/marketplace/builders"]);
    expect(paths("owner", none)).toEqual([]);
  });

  it("drops a group that has no item left, heading included, and marks the current page", () => {
    const groups = visibleMenu("viewer", all, "/ops", items);
    expect(groups.map((g) => g.group)).toEqual(["main", "marketplace"]);
    expect(groups[0]?.labelKey).toBeNull();
    expect(groups[1]?.labelKey).toBe("ops.group.marketplace");
    expect(groups[0]?.items[0]?.current).toBe(true);
    expect(groups[1]?.items[0]?.current).toBe(false);
  });

  it("reachable() is the same test for any link to an Ops page", () => {
    expect(reachable("owner", "/ops/marketplace/builders", "marketplace.view", all)).toBe(true);
    expect(reachable("owner", "/ops/marketplace/builders", "marketplace.view", none)).toBe(false);
    expect(reachable("content", "/ops/marketplace/builders", "marketplace.view", all)).toBe(false);
  });
});

describe("Ops shell on /ops (AC2, AC7)", () => {
  it("renders Overview for every role and Marketplace › Builders for all but Content, and no link to a page that does not exist", async () => {
    for (const role of ROLES) {
      const { cookie } = await asRole(role);
      const { res, html } = await getOps(cookie);
      expect(res.status, role).toBe(200);
      const body = bodyOf(html);
      const navs = [...body.matchAll(/<nav class="ops-nav"[^>]*>([\s\S]*?)<\/nav>/g)].map((m) => m[1] ?? "");
      const marketplace = role !== "content";
      // Desktop sidebar and the narrow-screen menu carry the same list.
      expect(navs, role).toHaveLength(2);
      for (const nav of navs) {
        expect([...nav.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), role).toEqual(marketplace ? ["/ops", "/ops/marketplace/builders"] : ["/ops"]);
        expect(nav, role).toMatch(/<a class="ops-nav-link" href="\/ops" aria-current="page">[\s\S]*Overview<\/a>/);
        // A group heading only for a group that has an item left: Content has none in Marketplace.
        if (marketplace) expect(nav, role).toMatch(/<p class="ops-group-h" id="[^"]+">Marketplace<\/p>/);
        else expect(nav, role).not.toContain("ops-group-h");
      }
      // Every link in the page goes to a page that exists: /ops, the skip target and, for roles with marketplace.view, Builders.
      const hrefs = new Set([...body.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
      expect([...hrefs].sort(), role).toEqual(marketplace ? ["#ops-main", "/ops", "/ops/marketplace/builders"] : ["#ops-main", "/ops"]);
    }
  });

  it("is English, noindex, with a page title and no public header, footer, canonical or hreflang", async () => {
    const { cookie } = await asRole("owner");
    const { res, html } = await getOps(cookie);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    const head = headOf(html);
    expect(head).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(head).toContain("<title>Overview · VNX.SI Ops</title>");
    expect(head).toContain('<link rel="stylesheet" href="/assets/app.css"/>');
    expect(head).not.toContain('rel="canonical"');
    expect(head).not.toContain("hreflang");
    expect(html).not.toContain("site-header");
    expect(html).not.toContain("site-footer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("has a skip link to the main content and a no-JS menu control for narrow screens", async () => {
    const { cookie } = await asRole("operator");
    const body = bodyOf((await getOps(cookie)).html);
    expect(body).toMatch(/^\s*<a class="ops-skip" href="#ops-main">Skip to main content<\/a>/);
    expect(body).toMatch(/<main id="ops-main"[^>]*>/);
    expect(body).toMatch(/<details class="ops-menu"><summary aria-label="Menu">/);
    expect(body).toMatch(/<aside class="ops-side">/);
  });

  it("shows the breadcrumb, the environment, the role, the e-mail and a sign-out form in the top bar", async () => {
    const { user, cookie } = await asRole("viewer");
    const { res, html } = await getOps(cookie);
    const top = /<header class="ops-top">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
    expect(top).toMatch(/<nav class="ops-crumb" aria-label="Breadcrumb">[\s\S]*Ops[\s\S]*<span aria-current="page">Overview<\/span>/);
    expect(top).toMatch(/<span class="ops-env ops-env-production">[\s\S]*PRODUCTION<\/span>/);
    expect(top).toMatch(/<span class="ops-role">[\s\S]*Viewer<\/span>/);
    expect(top).toContain(user.email);
    expect(top).toMatch(/<form method="post" action="\/logout" class="ops-signout">[\s\S]*Sign out[\s\S]*<\/form>/);
    // VNX-0803 F1: a page with a POST form must not send "no-referrer" (browsers would send Origin: null).
    expect(res.headers.get("referrer-policy")).not.toBe("no-referrer");
  });

  it("labels the environment PRODUCTION only when APP_ORIGIN's host is vnx.si, LOCAL otherwise", async () => {
    const { cookie } = await asRole("owner");
    const label = async (origin: string) => {
      const html = (await getOps(cookie, { ...env, APP_ORIGIN: origin } as Bindings)).html;
      return /<span class="ops-env ops-env-(\w+)">/.exec(html)?.[1];
    };
    expect(await label("https://vnx.si")).toBe("production");
    expect(await label("http://localhost:8787")).toBe("local");
    expect(await label("https://staging.vnx.si")).toBe("local");
    expect(await label("https://vnx.si.example.com")).toBe("local");
    expect(await label("not a url")).toBe("local");
  });

  it("names the role of each member in the top bar", async () => {
    for (const [role, label] of [["owner", "Owner"], ["operator", "Operator"], ["content", "Content"], ["viewer", "Viewer"]] as const) {
      const { cookie } = await asRole(role);
      const html = (await getOps(cookie)).html;
      expect(html, role).toMatch(new RegExp(`<span class="ops-role">[\\s\\S]*?${label}</span>`));
    }
  });
});

describe("CSP: nothing inline under /ops (AC7, VNX-0803)", () => {
  it("has no style attribute, no <style>, no event handler and no script at all, for every role", async () => {
    for (const role of ROLES) {
      const { cookie } = await asRole(role);
      const { html } = await getOps(cookie);
      expect(html, role).not.toMatch(/\sstyle=/);
      expect(html, role).not.toMatch(/<style\b/);
      expect(html, role).not.toMatch(/\son[a-z]+="/);
      expect(html, role).not.toMatch(/<script\b/);
    }
  });

  it("styles the shell from app.css with ops-* classes (240 px sidebar, collapsed below 1024 px)", async () => {
    const res = await createApp().request(new Request("https://vnx.si/assets/app.css"), undefined, env);
    const css = await res.text();
    expect(css).toMatch(/\.ops-side\s*\{[^}]*width:\s*240px/);
    expect(css).toMatch(/@media \(max-width: 1023px\)/);
    expect(css).toMatch(/\.ops-nav-link:focus-visible/);
  });
});
