import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFakeOAuth } from "../../src/auth/oauth/fake.ts";
import { resetFlagCache } from "../../src/db/flags.ts";
import { testEnv } from "../helpers.ts";
import { callbackReq, enableProvider, issueCodeFor, linkedUser, startOAuth } from "../oauth-flow.ts";

let counter = 0;
const tag = () => `${++counter}-${Math.random().toString(36).slice(2, 8)}`;
const n = async (sql: string, ...binds: unknown[]) => (await testEnv.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
const normalize = (html: string) => html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>");

// The same bytes as the page of a callback whose identity was never linked (Task 6), compared apart from request ids.
async function sameAsNotLinkedPage(res: Response): Promise<boolean> {
  const started = await startOAuth("github");
  const ref = await callbackReq("github", { code: issueCodeFor("github", started, { subject: `s-${tag()}`, label: `l-${tag()}` }), state: started.flow.state }, started.cookie);
  return normalize(await res.clone().text()) === normalize(await ref.text());
}

beforeEach(async () => {
  resetFakeOAuth();
  await testEnv.DB.prepare("DELETE FROM feature_flags WHERE key LIKE 'oauth_%'").run();
  resetFlagCache();
  for (const m of ["error", "warn", "log", "info", "debug"] as const) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("an unlink racing a sign-in (VNX-2605c, decision 10)", () => {
  const cases = [
    { name: "vnx_test_race_users", event: "AFTER UPDATE ON users", cond: (id: string) => `NEW.id = '${id}'` },
    { name: "vnx_test_race_sessions", event: "AFTER INSERT ON sessions", cond: (id: string) => `NEW.user_id = '${id}'` },
  ];
  for (const c of cases) {
    it(`unlinked mid sign-in (${c.name}): the not-linked page, no session cookie, no oauth_github session, no auth.login audit`, async () => {
      await enableProvider("github");
      const email = `lan-${tag()}@example.com`;
      const identity = { subject: `s-${tag()}`, label: `l-${tag()}` };
      const { user } = await linkedUser(email, "github", identity);
      const started = await startOAuth("github");
      const code = issueCodeFor("github", started, identity);
      await testEnv.DB.prepare(`CREATE TRIGGER ${c.name} ${c.event} WHEN ${c.cond(user.id)} BEGIN DELETE FROM user_identities WHERE user_id = '${user.id}'; END`).run();
      try {
        const res = await callbackReq("github", { code, state: started.flow.state }, started.cookie);
        expect(res.status).toBe(200); // the same page as for an unlinked account (Task 6)
        expect(await sameAsNotLinkedPage(res)).toBe(true);
        expect(res.headers.getSetCookie().some((l) => l.startsWith("__Host-vnx_session="))).toBe(false);
      } finally {
        await testEnv.DB.prepare(`DROP TRIGGER IF EXISTS ${c.name}`).run(); // always dropped
      }
      expect(await n("SELECT count(*) AS n FROM sessions WHERE user_id = ?1 AND method = 'oauth_github'", user.id)).toBe(0);
      expect(await n("SELECT count(*) AS n FROM audit_log WHERE entity = 'user' AND entity_id = ?1 AND action = 'auth.login'", user.id)).toBe(0);
    });
  }
});
