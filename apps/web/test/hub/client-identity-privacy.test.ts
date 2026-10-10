import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { PROVIDER_FLAG, type OAuthProvider } from "../../src/domain/identity.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeInquiry, makeRequest, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

let counter = 0;
const tag = () => `${++counter}${Math.random().toString(36).slice(2, 6)}`;
/** Both badge providers ON, so a leak would show (the strictest setting). Same helper as builder-badges.test.ts. */
beforeEach(async () => {
  const admin = await ensureUser("oauth-flags@example.com");
  for (const provider of ["github", "linkedin"] as OAuthProvider[]) await setFlag(testEnv.DB, { key: PROVIDER_FLAG[provider], enabled: true, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
});
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const get = async (path: string, cookie?: string) => decode(await (await createApp().request(getReq(path, cookie), undefined, testEnv)).text());
/** A linked account of a CLIENT, straight into the table with show_on_profile = 1: the worst case the pages must still hide. */
const rawIdentity = (userId: string, provider: string, label: string) =>
  testEnv.DB.prepare("INSERT INTO user_identities (id, user_id, provider, provider_subject, label, show_on_profile, linked_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)")
    .bind(`id-${tag()}`, userId, provider, `s-${tag()}`, label, new Date().toISOString()).run();

/** Nothing of the client's linked accounts: no label, no 'verified via', no GitHub link, no linked-account section. */
function expectNoIdentity(html: string, labels: string[]) {
  for (const label of labels) expect(html, label).not.toContain(label);
  expect(html).not.toContain("verified via");
  expect(html).not.toContain("github.com/");
  expect(html).not.toContain('class="verified-list"');
  expect(html).not.toContain("/identities/");
}

describe("a client's linked accounts never reach a builder or the public (ADR-012 §5; VNX-2606b)", () => {
  it("builder-facing inquiry pages (overview, inbox, thread) show the client's name but none of their linked accounts", async () => {
    const t = tag();
    const { client, inquiry, builder } = await makeInquiry({ tag: `pv${t}`, status: "open" });
    const gh = `client-gh-${t}`;
    const li = `client-li-${t}@example.com`;
    await rawIdentity(client.id, "github", gh);
    await rawIdentity(client.id, "linkedin", li);
    await rawIdentity(client.id, "google", `client-g-${t}@example.com`);
    const { cookie } = await signIn(`pv${t}-b@vnx.si`);
    for (const path of ["/hub/inquiries", `/hub/inquiries/${inquiry.id}`]) {
      const html = await get(path, cookie);
      expect(html, path).toContain("Minh Tran"); // positive: the page shows the client
      expectNoIdentity(html, [gh, li, `client-g-${t}@example.com`]);
    }
    expectNoIdentity(await get("/hub", cookie), [gh, li]);
    expect(builder.handle).toBeTruthy();
  });

  it("builder-facing invitation pages (list, detail) show the request but none of the client's linked accounts", async () => {
    const t = tag();
    const { client, request } = await makeRequest({ tag: `pw${t}` });
    const builder = await makeBuilder(`pw${t}-b@vnx.si`, `pw${t}-b`, "approved");
    const [invite] = await inviteBuilders(request, [builder]);
    const gh = `client-gh-${t}`;
    await rawIdentity(client.id, "github", gh);
    await rawIdentity(client.id, "linkedin", `client-li-${t}@example.com`);
    const { cookie } = await signIn(`pw${t}-b@vnx.si`);
    for (const path of ["/hub/invitations", `/hub/invitations/${invite!.id}`]) {
      const html = await get(path, cookie);
      expect(html, path).toContain(`pw${t} booking app`); // positive: the request is shown
      expectNoIdentity(html, [gh, `client-li-${t}@example.com`]);
    }
  });

  it("the public pages of the builder who got the inquiry show nothing of the client's accounts", async () => {
    const t = tag();
    const { client, builder } = await makeInquiry({ tag: `px${t}`, status: "open" });
    await rawIdentity(client.id, "github", `client-gh-${t}`);
    for (const [path, shown] of [[`/b/${builder.handle}`, `px${t} builder`], [`/builders?q=px${t}`, `px${t} builder`]] as const) {
      const html = await get(path);
      expect(html, path).toContain(shown); // positive: the real builder name (makeInquiry names it "<tag> builder")
      expectNoIdentity(html, [`client-gh-${t}`]);
    }
  });

  it("a pending builder with an opted-in GitHub row: their /b/ page is 404 and the directory shows nothing of it", async () => {
    const t = tag();
    const b = await makeBuilder(`py${t}@vnx.si`, `py${t}`, "pending");
    await rawIdentity(b.userId, "github", `pending-gh-${t}`);
    expect((await createApp().request(getReq(`/b/py${t}`), undefined, testEnv)).status).toBe(404);
    expectNoIdentity(await get("/builders"), [`pending-gh-${t}`]);
  });
});
