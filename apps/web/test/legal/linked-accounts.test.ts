import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { OAUTH_COOKIE } from "../../src/auth/oauth-cookie.ts";
import { SESSION_TTL_MS } from "../../src/auth/sessions.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { listPublicBadges } from "../../src/db/identities.ts";
import { LINK_INTENT_TTL_MS, OAUTH_FLOW_TTL_MS } from "../../src/domain/oauth.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { t } from "../../src/i18n/t.ts";
import { notifyIdentityChange } from "../../src/notify/identity.ts";
import { ensureUser, makeBuilder } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";
import { callbackReq, enableProvider, startOAuth } from "../oauth-flow.ts";

// The Owner-approved ADR-012 addendum (2026-10-07) at the foot of docs/legal/privacy.md and terms.md is the ONLY source of the wording and of
// where each line goes. Nothing it says is copied into this file (plan LOW-2): the live text must contain it, in the place it names.
const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const sourceOf = (name: string): string => {
  const entry = Object.entries(SOURCES).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  if (!entry) throw new Error(`docs/legal/${name}.md not found`);
  return entry[1].replace(/\r\n/g, "\n");
};
type Lang = "EN" | "VI";
type Version = "live" | "m7";
/** The `## EN` or `## VI` part, up to the next `---` (same rule as content.test.ts). */
function partOf(md: string, lang: Lang): string {
  const start = md.indexOf(`\n## ${lang}\n`);
  if (start < 0) throw new Error(`missing ## ${lang}`);
  const body = md.slice(start + `\n## ${lang}\n`.length);
  const end = body.indexOf("\n---");
  return end < 0 ? body : body.slice(0, end);
}
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
const textOf = (html: string) => decode(html.replace(/<\/?(?:strong|code|a|span)\b[^>]*>/g, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
const bullet = (line: string) => plain(line.replace(/^- /, ""));

type Kind = "after" | "replaceBullet" | "append" | "replaceBody";
interface Edit { section: number; kind: Kind; anchor: string | null; lines: string[] }

/** The edits of the addendum's `### EN` or `### VI` block, in file order. The instruction text decides the kind; the quoted words are the anchor. */
function addendumOf(md: string, lang: Lang): Edit[] {
  const from = md.indexOf("\n## Bổ sung ADR-012");
  if (from < 0) throw new Error("missing the ADR-012 addendum");
  const tail = md.slice(from);
  const start = tail.indexOf(`\n### ${lang}\n`);
  if (start < 0) throw new Error(`missing addendum ### ${lang}`);
  const block = tail.slice(start + `\n### ${lang}\n`.length).split("\n### ")[0] ?? "";
  const edits: Edit[] = [];
  for (const chunk of block.split(/\n(?=\*\*Mục )/)) {
    const [header = "", ...rest] = chunk.trim().split("\n");
    const m = /^\*\*Mục (\d+), (.+):\*\*$/.exec(header);
    if (!m) continue;
    const what = m[2] ?? "";
    const quoted = /"(.+)"/.exec(what)?.[1] ?? null;
    let kind: Kind;
    if (/^thêm sau gạch "/.test(what) || /^thêm (hai )?gạch sau "/.test(what)) kind = "after";
    else if (/^sửa gạch ".+" thành$/.test(what)) kind = "replaceBullet";
    else if (what === "thêm gạch") kind = "append";
    else if (/^thay .*bằng$/.test(what)) kind = "replaceBody";
    else throw new Error(`unknown addendum instruction: ${what}`);
    edits.push({ section: Number(m[1]), kind, anchor: kind === "after" || kind === "replaceBullet" ? quoted : null, lines: rest.map((l) => l.trim()).filter((l) => l !== "") });
  }
  return edits;
}
/** The body of section `n` (`**n. Title**` up to the next numbered heading), without the heading. */
function sectionOf(part: string, n: number): string[] {
  const lines = part.split("\n");
  const from = lines.findIndex((l) => l.startsWith(`**${n}. `));
  if (from < 0) throw new Error(`missing section ${n}`);
  const to = lines.findIndex((l, i) => i > from && /^\*\*\d+\. /.test(l));
  return lines.slice(from + 1, to < 0 ? lines.length : to);
}

// The one instruction without an anchor ("Mục 5, thêm gạch") goes right after `__Host-vnx_invite` (Owner). Each version has its own table:
// in privacy.md that bullet is the last of section 5; in privacy-m7.md `__Host-vnx_vid` still follows it.
const APPEND_AFTER: Record<Version, Record<Lang, { after: string; next: string | null }>> = {
  live: { EN: { after: "- `__Host-vnx_invite`:", next: null }, VI: { after: "- `__Host-vnx_invite`:", next: null } },
  m7: { EN: { after: "- `__Host-vnx_invite`:", next: "- `__Host-vnx_vid`:" }, VI: { after: "- `__Host-vnx_invite`:", next: "- `__Host-vnx_vid`:" } },
};
const SHAPE: Kind[] = ["after", "replaceBullet", "after", "after", "append", "after", "replaceBody"]; // Mục 2 (x2), 3, 4, 5, 6, 8
const M7_ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: "2026-10-20" } as Bindings; // pinned as in privacy-version.test.ts; the real clock is past 2026-10-06
const VERSIONS = [
  { version: "live", file: "privacy", env: testEnv },
  { version: "m7", file: "privacy-m7", env: M7_ENV },
] as const;
const LANGS = [["EN", ""], ["VI", "/vi"]] as const;

/**
 * Checks that `part` carries every edit where the addendum says, once, and returns, per edit, the text the live page must show
 * (the anchor line and what follows it, so adjacency is checked on the page too).
 */
function applied(part: string, edits: Edit[], version: Version, lang: Lang): string[] {
  const snippets: string[] = [];
  for (const edit of edits) {
    const body = sectionOf(part, edit.section);
    for (const line of edit.lines) expect(part.split(line).length - 1, `once: ${line.slice(0, 50)}`).toBe(1);
    if (edit.kind === "replaceBody") {
      expect(body.filter((l) => l.trim() !== ""), `section ${edit.section} is only the new text`).toEqual(edit.lines);
      snippets.push(plain(edit.lines.join(" ")));
      continue;
    }
    if (edit.kind === "replaceBullet") {
      const label = /^- \*\*[^*]+\*\*/.exec(edit.lines[0] ?? "")?.[0] ?? "";
      expect(label).not.toBe("");
      expect(body.filter((l) => l.startsWith(label)), `${label} replaced, not duplicated`).toEqual(edit.lines);
      snippets.push(bullet(edit.lines[0] ?? ""));
      continue;
    }
    let at: number;
    if (edit.kind === "append") {
      const place = APPEND_AFTER[version][lang];
      at = body.findIndex((l) => l.startsWith(place.after));
      expect(at, place.after).toBeGreaterThanOrEqual(0);
      const next = body[at + 1 + edit.lines.length];
      if (place.next === null) expect(next ?? "", "last bullet of the list").toBe("");
      else expect(next?.startsWith(place.next), `followed by ${place.next}`).toBe(true);
    } else {
      const stem = plain((edit.anchor ?? "").replace(/\s*…$/, ""));
      expect(stem).not.toBe("");
      at = body.findIndex((l) => l.startsWith("- ") && bullet(l).startsWith(stem));
      expect(at, `anchor "${stem}" in section ${edit.section}`).toBeGreaterThanOrEqual(0);
    }
    expect(body.slice(at + 1, at + 1 + edit.lines.length), `right after the anchor in section ${edit.section}`).toEqual(edit.lines);
    snippets.push([body[at] ?? "", ...edit.lines].map(bullet).join(" "));
  }
  return snippets;
}

const live = async (path: string, env: Bindings): Promise<string> => textOf(mainOf(await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, env)).text()));

describe("the ADR-012 addendum is applied to the Privacy text, in both versions (VNX-2607)", () => {
  for (const { version, file } of VERSIONS) {
    for (const [lang] of LANGS) {
      it(`${file}.md ${lang}: every addendum line is in the named place, once`, () => {
        const edits = addendumOf(sourceOf("privacy"), lang);
        expect(edits.map((e) => e.kind)).toEqual(SHAPE);
        applied(partOf(sourceOf(file), lang), edits, version, lang);
      });
    }
  }

  it("the M7 version has both new and old neighbours: oauth sits between invite and vid, and the live version has no vid", () => {
    for (const lang of ["EN", "VI"] as const) {
      const m7 = sectionOf(partOf(sourceOf("privacy-m7"), lang), 5).filter((l) => l.startsWith("- `"));
      expect(m7.map((l) => /^- `([^`]+)`/.exec(l)?.[1])).toEqual(["__Host-vnx_session", "__Host-vnx_invite", "__Host-vnx_oauth", "__Host-vnx_vid"]);
      const current = sectionOf(partOf(sourceOf("privacy"), lang), 5).filter((l) => l.startsWith("- `"));
      expect(current.map((l) => /^- `([^`]+)`/.exec(l)?.[1])).toEqual(["__Host-vnx_session", "__Host-vnx_invite", "__Host-vnx_oauth"]);
    }
  });
});

describe("the ADR-012 addendum is applied to the Terms text (VNX-2607)", () => {
  for (const [lang] of LANGS) {
    it(`terms.md ${lang}: section 4 is the addendum paragraph`, () => {
      const edits = addendumOf(sourceOf("terms"), lang);
      expect(edits.map((e) => e.kind)).toEqual(["replaceBody"]);
      expect(edits[0]?.section).toBe(4);
      applied(partOf(sourceOf("terms"), lang), edits, "live", lang);
    });
  }
});

describe("the live pages show the text, word for word (VNX-2607)", { timeout: 30_000 }, () => {
  for (const { version, file, env } of VERSIONS) {
    for (const [lang, prefix] of LANGS) {
      it(`/privacy (${version}) ${lang}: every addendum line, each right after its anchor`, async () => {
        const text = await live(`${prefix}/privacy`, env);
        // Proves the right version was rendered: only the M7 text has the visit cookie.
        if (version === "m7") expect(text).toContain("__Host-vnx_vid");
        else expect(text).not.toContain("__Host-vnx_vid");
        for (const snippet of applied(partOf(sourceOf(file), lang), addendumOf(sourceOf("privacy"), lang), version, lang)) expect(text, snippet.slice(0, 60)).toContain(snippet);
      });
    }
  }

  for (const [lang, prefix] of LANGS) {
    it(`/terms ${lang}: section 4 is the addendum paragraph`, async () => {
      const text = await live(`${prefix}/terms`, testEnv);
      for (const snippet of applied(partOf(sourceOf("terms"), lang), addendumOf(sourceOf("terms"), lang), "live", lang)) expect(text, snippet.slice(0, 60)).toContain(snippet);
    });
  }

  it("zh-Hans and zh-Hant show the EN text, both Privacy versions and Terms, with the translated 'English version applies' line", async () => {
    for (const [locale, prefix] of [["zh-Hans", "/zh-hans"], ["zh-Hant", "/zh-hant"]] as const) {
      for (const { version, file, env } of VERSIONS) {
        const text = await live(`${prefix}/privacy`, env);
        expect(text, `${locale} ${version}`).toContain(t(locale, "legal.englishOnly"));
        for (const snippet of applied(partOf(sourceOf(file), "EN"), addendumOf(sourceOf("privacy"), "EN"), version, "EN")) expect(text, `${locale} ${version}`).toContain(snippet);
      }
      const terms = await live(`${prefix}/terms`, testEnv);
      expect(terms, locale).toContain(t(locale, "legal.englishOnly"));
      for (const snippet of applied(partOf(sourceOf("terms"), "EN"), addendumOf(sourceOf("terms"), "EN"), "live", "EN")) expect(terms, locale).toContain(snippet);
    }
  });

  it("the live pages do not show the addendum header, its instruction lines or raw markup", async () => {
    for (const env of [testEnv, M7_ENV]) {
      for (const path of ["/privacy", "/vi/privacy", "/terms", "/vi/terms"]) {
        const text = await live(path, env);
        for (const word of ["Bổ sung ADR-012", "ĐÃ ÁP DỤNG", "**Mục", "Mục 2,", "bản nháp"]) expect(text, `${path} ${word}`).not.toContain(word);
      }
    }
  });
});

describe("the sentences match the code (VNX-2607 cross-check)", () => {
  beforeEach(async () => {
    clearOutbox();
    await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
    resetFlagCache();
    for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("the cookie name, its 'up to N minutes' and the session 'up to N days' are the code's (both versions, EN and VI)", () => {
    expect(OAUTH_COOKIE).toBe("__Host-vnx_oauth");
    expect(LINK_INTENT_TTL_MS).toBeLessThanOrEqual(OAUTH_FLOW_TTL_MS);
    for (const file of ["privacy", "privacy-m7"]) {
      for (const [lang, minutes, days] of [["EN", /up to (\d+) minutes/, /up to (\d+) days/], ["VI", /tối đa (\d+) phút/, /tối đa (\d+) ngày/]] as const) {
        const cookies = sectionOf(partOf(sourceOf(file), lang), 5);
        const oauth = cookies.find((l) => l.startsWith(`- \`${OAUTH_COOKIE}\`:`)) ?? "";
        const session = cookies.find((l) => l.startsWith("- `__Host-vnx_session`:")) ?? "";
        expect(Number(minutes.exec(oauth)?.[1]) * 60_000, `${file} ${lang} oauth`).toBe(OAUTH_FLOW_TTL_MS);
        expect(Number(days.exec(session)?.[1]) * 24 * 60 * 60 * 1000, `${file} ${lang} session`).toBe(SESSION_TTL_MS);
        // S-1: section 6 "Sessions: up to N days" / "tối đa N ngày" is the same number.
        const kept = sectionOf(partOf(sourceOf(file), lang), 6).find((l) => l.includes(lang === "EN" ? "Sessions:" : "Phiên đăng nhập:")) ?? "";
        expect(Number(days.exec(kept)?.[1]) * 24 * 60 * 60 * 1000, `${file} ${lang} section 6 sessions`).toBe(SESSION_TTL_MS);
      }
    }
  });

  it("/start writes the cookie as the text says: HttpOnly, Secure, and not longer than the stated minutes", async () => {
    await enableProvider("github");
    const started = await startOAuth("github");
    const line = started.res.headers.getSetCookie().find((l) => l.startsWith(`${OAUTH_COOKIE}=`)) ?? "";
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(Number(/Max-Age=(\d+)/i.exec(line)?.[1])).toBeLessThanOrEqual(OAUTH_FLOW_TTL_MS / 1000);
  });

  it("user_identities holds exactly what Privacy section 2 lists, and no token", async () => {
    const { results } = await testEnv.DB.prepare("PRAGMA table_info(user_identities)").all<{ name: string }>();
    // The text names: the service (provider), its ID (provider_subject), a label, when linked, when last used; show_on_profile is the builder's choice
    // (sections 3 and 4) and updated_at a timestamp. A new column must be matched by a Privacy change in BOTH versions first: edit this list only with them.
    expect(results.map((r) => r.name)).toEqual(["id", "user_id", "provider", "provider_subject", "label", "show_on_profile", "linked_at", "last_used_at", "updated_at"]);
    for (const r of results) expect(r.name).not.toMatch(/token|secret|password|access|refresh|code|verifier/i);
  });

  it("a failed link or unlink e-mail never throws (best effort; the recipient is proved at route level by test/auth/oauth-link.test.ts:276-288 and test/me/identity-unlink.test.ts:19,59)", async () => {
    const user = await ensureUser(`la-${Math.random().toString(36).slice(2, 8)}@example.com`);
    const base = { to: user.email, locale: "en", provider: "github", label: "octocat", at: new Date().toISOString() } as const;
    expect(await notifyIdentityChange(testEnv, { ...base, kind: "linked" })).toBe("sent");
    expect(await notifyIdentityChange(testEnv, { ...base, kind: "unlinked" })).toBe("sent");
    expect(outbox).toHaveLength(2); // one e-mail per change
    vi.spyOn(FakeMailer.prototype, "send").mockRejectedValueOnce(new Error("down"));
    expect(await notifyIdentityChange(testEnv, { ...base, kind: "linked" })).toBe("failed");
  });

  it("the badge rules in sections 3 and 4: GitHub login and LinkedIn 'verified' for an approved builder who opted in; never Google; never a client; never a pending builder", async () => {
    const tag = Math.random().toString(36).slice(2, 8);
    const raw = (userId: string, provider: string, label: string) =>
      testEnv.DB.prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)")
        .bind(`id-${tag}-${provider}-${userId}`, userId, provider, `s-${tag}-${provider}-${userId}`, label, new Date().toISOString()).run();
    const approved = await makeBuilder(`la-ok-${tag}@vnx.si`, `la-ok-${tag}`, "approved");
    const pending = await makeBuilder(`la-pe-${tag}@vnx.si`, `la-pe-${tag}`, "pending");
    const client = await ensureUser(`la-cl-${tag}@example.com`);
    for (const userId of [approved.userId, pending.userId, client.id]) {
      await raw(userId, "github", `gh-${tag}`);
      await raw(userId, "linkedin", `li-${tag}@example.com`);
      await raw(userId, "google", `go-${tag}@example.com`);
    }
    expect(await listPublicBadges(testEnv.DB, approved.userId, ["github", "linkedin"])).toEqual([
      { provider: "github", login: `gh-${tag}`, url: `https://github.com/gh-${tag}` },
      { provider: "linkedin" }, // no label, no link, no e-mail
    ]);
    expect(await listPublicBadges(testEnv.DB, pending.userId, ["github", "linkedin"])).toEqual([]);
    expect(await listPublicBadges(testEnv.DB, client.id, ["github", "linkedin"])).toEqual([]);
  });

  it("the sign-in counter stores the raw IP under oauth:ip:* (Privacy section 2, Security; LOW-4)", async () => {
    await enableProvider("github");
    const ip = `203.0.113.${100 + Math.floor(Math.random() * 100)}`;
    await callbackReq("github", {}, undefined, { "cf-connecting-ip": ip });
    const row = await testEnv.DB.prepare("SELECT key FROM rate_limits WHERE key = ?1").bind(`oauth:ip:${ip}`).first<{ key: string }>();
    expect(row?.key).toBe(`oauth:ip:${ip}`); // the address itself, not a hash: the text says "your IP address"
  });
});
