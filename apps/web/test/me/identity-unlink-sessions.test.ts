import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { SessionMethod } from "../../src/domain/identity.ts";
import { clearOutbox, FakeMailer, outbox } from "../../src/email/fake.ts";
import { signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";
import { linkedUser } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const emailOf = (who: string) => `${who}-${tag()}@example.com`;
const unlink = (provider: string, cookie: string, headers: Record<string, string> = {}) =>
  createApp().request(formPost(`/me/identities/${provider}/unlink`, {}, { cookie, ...headers }), undefined, testEnv);
const meRes = (cookie: string) => createApp().request(getReq("/me", cookie), undefined, testEnv);
const meStatus = async (cookie: string) => (await meRes(cookie)).status;
const sessionFor = (email: string, method: SessionMethod) => signIn(email, { method });
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;

beforeEach(() => {
  clearOutbox();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("unlinking ends the provider's sessions (VNX-2605c)", () => {
  it("from a magic-link session: every GitHub session of the user is signed out on its next request; the others carry on", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const caller = await sessionFor(email, "magic_link");
    const github1 = await sessionFor(email, "oauth_github");
    const github2 = await sessionFor(email, "oauth_github");
    const other = await sessionFor(email, "magic_link"); // another device, e-mail link
    const google = await sessionFor(email, "oauth_google");
    expect(await meStatus(github1.cookie)).toBe(200); // alive before
    const res = await unlink("github", caller.cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    for (const ended of [github1, github2]) {
      const after = await meRes(ended.cookie);
      expect(after.status).toBe(303); // requireUser: no session any more
      expect(after.headers.get("location")).toContain("/login");
    }
    for (const alive of [caller, other, google]) expect(await meStatus(alive.cookie)).toBe(200);
  });

  it("the caller's own session (Owner E1 = b1): a GitHub session that unlinks GitHub is signed out too, its row is gone, the cookie is cleared", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const mine = await sessionFor(email, "oauth_github");
    const elsewhere = await sessionFor(email, "oauth_github");
    const res = await unlink("github", mine.cookie);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session=") && /Max-Age=0/i.test(l))).toBe(true); // cookie cleared
    expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
    for (const ended of [mine, elsewhere]) {
      const next = await meRes(ended.cookie); // the next request to /me
      expect(next.status).toBe(303);
      expect(next.headers.get("location")).toContain("/login");
    }
  });

  it("a caller on an oauth_google session who unlinks GitHub stays signed in (and the GitHub sessions end)", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const google = await sessionFor(email, "oauth_google");
    const github = await sessionFor(email, "oauth_github");
    const res = await unlink("github", google.cookie);
    expect(res.headers.get("location")).toBe("/me?link=unlinked");
    expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false); // not cleared
    expect(await meStatus(google.cookie)).toBe(200);
    expect(await meStatus(github.cookie)).toBe(303);
  });

  it("another user's sessions (even their GitHub ones) are untouched", async () => {
    const a = emailOf("a");
    const b = emailOf("b");
    await linkedUser(a, "github", { subject: `s-${tag()}`, label: `a-${tag()}` });
    await linkedUser(b, "github", { subject: `s-${tag()}`, label: `b-${tag()}` });
    const aSession = await sessionFor(a, "magic_link");
    const bGithub = await sessionFor(b, "oauth_github");
    await unlink("github", aSession.cookie);
    expect(await meStatus(bGithub.cookie)).toBe(200);
  });

  it("an unlink that does not happen (notLinked) ends nothing", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "google", { subject: `s-${tag()}`, label: `g-${tag()}@gmail.example` });
    const caller = await sessionFor(email, "magic_link");
    const github = await sessionFor(email, "oauth_github"); // a session with no identity behind it
    const res = await unlink("github", caller.cookie);
    expect(res.headers.get("location")).toBe("/me?link=notLinked");
    expect(await meStatus(github.cookie)).toBe(200);
  });

  it("a refused request (foreign Origin, signed out) ends nothing", async () => {
    const email = emailOf("lan");
    await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const caller = await sessionFor(email, "magic_link");
    const github = await sessionFor(email, "oauth_github");
    expect((await unlink("github", caller.cookie, { origin: "https://evil.example" })).status).toBe(403);
    expect((await createApp().request(formPost("/me/identities/github/unlink", {}), undefined, testEnv)).status).toBe(303); // to /login
    expect(await meStatus(github.cookie)).toBe(200);
  });

  it("a failing mailer does not bring the sessions back; the sent e-mail carries the sessions sentence", async () => {
    const email = emailOf("lan");
    const { user } = await linkedUser(email, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    const caller = await sessionFor(email, "magic_link");
    await sessionFor(email, "oauth_github");
    const send = vi.spyOn(FakeMailer.prototype, "send").mockRejectedValue(new Error("boom"));
    await unlink("github", caller.cookie);
    send.mockRestore();
    expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
    const again = emailOf("lan2");
    await linkedUser(again, "github", { subject: `s-${tag()}`, label: `l-${tag()}` });
    await unlink("github", (await sessionFor(again, "magic_link")).cookie);
    const mails = outbox.filter((m) => m.to === again);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Every device that was signed in with it has been signed out.");
  });
});
