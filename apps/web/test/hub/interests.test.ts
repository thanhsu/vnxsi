import { beforeEach, describe, expect, it } from "vitest";
import { findClientRequest } from "../../src/db/requests.ts";
import { withdrawStatement } from "../../src/db/request-board.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { localizedPath } from "../../src/i18n/locales.ts";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { inviteBuilders, makeBuilder, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, listed, tag, type Listed } from "../public/request-board-helpers.ts";

/** VNX-2706a: the Hub section "Requests you're interested in" (addendum 4.4, Q12, L4). Pending / invited / not invited; never withdrawn, never a request id. */

const hub = (cookie: string, locale: "en" | "vi" = "en") => app().request(getReq(localizedPath(locale, "/hub/invitations"), cookie), undefined, boardEnv);
const esc = (s: string) => s.replace(/'/g, "&#39;");
const DAY = 24 * 60 * 60 * 1000;

async function builderOf() {
  const email = `zqx-hi-${tag()}@vnx.si`;
  const builder = await makeBuilder(email, `zqxhi${tag()}`, "approved");
  return { builder, cookie: (await signIn(email)).cookie };
}

async function interest(l: Listed, builderId: string, status = "pending"): Promise<string> {
  const id = ulid();
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO request_interests (id, request_id, builder_id, status, created_at, updated_at, write_id) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)").bind(id, l.requestId, builderId, status, now, ulid()).run();
  return id;
}

const sectionOf = (html: string) => /<section[^>]*id="interests"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";

beforeEach(async () => {
  clearOutbox();
  await boardFlag(true);
});

describe("Hub: Requests you're interested in", () => {
  it("shows pending, invited (with the invitation link) and not invited (dismissed, or closed without an invitation); never withdrawn", async () => {
    const { builder, cookie } = await builderOf();
    const pending = await listed({ publicTitle: `ZQX pending ${tag()}` });
    const invitedL = await listed({ publicTitle: `ZQX invited ${tag()}` });
    const dismissed = await listed({ publicTitle: `ZQX dismissed ${tag()}` });
    const closedL = await listed({ publicTitle: `ZQX closed ${tag()}`, requestStatus: "closed", closedAt: new Date(Date.now() - DAY).toISOString() });
    const withdrawn = await listed({ publicTitle: `ZQX withdrawn ${tag()}` });
    await interest(pending, builder.userId);
    await interest(invitedL, builder.userId);
    await interest(dismissed, builder.userId, "dismissed");
    await interest(closedL, builder.userId);
    await interest(withdrawn, builder.userId, "withdrawn");
    const [invite] = await inviteBuilders((await findClientRequest(testEnv.DB, invitedL.clientId, invitedL.requestId))!, [builder]);
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'invited' WHERE request_id = ?1 AND builder_id = ?2").bind(invitedL.requestId, builder.userId).run();

    const res = await hub(cookie);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    const section = sectionOf(html);
    expect(section).toContain(esc(en["hub.interests.title"]));
    const rowFor = (title: string) => new RegExp(`<tr>(?:(?!</tr>)[\\s\\S])*${title}(?:(?!</tr>)[\\s\\S])*</tr>`).exec(section)?.[0] ?? "";
    const find = async (l: Listed) => (await testEnv.DB.prepare("SELECT public_title AS t FROM request_publications WHERE request_id = ?1").bind(l.requestId).first<{ t: string }>())!.t;
    const p = rowFor(await find(pending));
    expect(p).toContain(en["hub.interests.pending"]);
    expect(p).toContain(`href="${localizedPath("en", `/requests/${pending.publicId}`)}"`);
    const i = rowFor(await find(invitedL));
    expect(i).toContain(en["hub.interests.invited"]);
    expect(i).toContain(`href="/hub/invitations/${invite!.id}"`);
    expect(rowFor(await find(dismissed))).toContain(en["hub.interests.notInvited"]);
    expect(rowFor(await find(closedL))).toContain(en["hub.interests.notInvited"]);
    expect(section).not.toContain(await find(withdrawn));
    expect(section).not.toContain("withdrawn");
    expect(outbox).toEqual([]);
  });

  it("a listing that is no longer public shows 'No longer public' and never its title; no request id, no client data", async () => {
    const { builder, cookie } = await builderOf();
    const l = await listed({ publicTitle: `ZQX hidden title ${tag()}` });
    const gone = await listed({ publicTitle: `ZQX gone title ${tag()}`, requestStatus: "closed", closedAt: new Date(Date.now() - 40 * DAY).toISOString() });
    await interest(l, builder.userId);
    await interest(gone, builder.userId);
    const pub = await testEnv.DB.prepare("SELECT updated_at, public_title FROM request_publications WHERE request_id = ?1").bind(l.requestId).first<{ updated_at: string; public_title: string }>();
    await testEnv.DB.batch([withdrawStatement(testEnv.DB, { writeId: ulid(), requestId: l.requestId, expectedUpdatedAt: pub!.updated_at, now: new Date().toISOString(), clientUserId: l.clientId })]);
    const html = await (await hub(cookie)).text();
    const section = sectionOf(html);
    expect(section).toContain(esc(en["hub.interests.noLongerPublic"]));
    expect(section).not.toContain(pub!.public_title);
    expect(section).not.toContain("ZQX gone title");
    for (const x of [l, gone]) {
      expect(html).not.toContain(x.requestId);
      for (const s of Object.values(x.ids)) expect(html).not.toContain(s);
    }
  });

  it("is empty with its own message, in VI too, and a builder never sees another builder's interests", async () => {
    const a = await builderOf();
    const b = await builderOf();
    const l = await listed({ publicTitle: `ZQX only-a ${tag()}` });
    await interest(l, a.builder.userId);
    const mine = await (await hub(a.cookie)).text();
    expect(sectionOf(mine)).toContain("ZQX only-a");
    const theirs = await (await hub(b.cookie)).text();
    expect(theirs).not.toContain("ZQX only-a");
    expect(sectionOf(theirs)).toContain(esc(en["hub.interests.empty"]));
    const viHtml = await (await hub(b.cookie, "vi")).text();
    expect(sectionOf(viHtml)).toContain(esc(vi["hub.interests.empty"]));
    expect(sectionOf(viHtml)).toContain(esc(vi["hub.interests.title"]));
  });

  it("S-2: with the board switched off the titles are plain text (no link to a 404), the status still shows", async () => {
    const { builder, cookie } = await builderOf();
    const l = await listed({ publicTitle: `ZQX switched-off ${tag()}` });
    await interest(l, builder.userId);
    await boardFlag(false);
    const html = await (await hub(cookie)).text();
    const section = sectionOf(html);
    expect(section).toContain("ZQX switched-off");
    expect(section).not.toContain(`/requests/${l.publicId}`);
    expect(section).toContain(en["hub.interests.pending"]);
    await boardFlag(true);
    expect(sectionOf(await (await hub(cookie)).text())).toContain(`/requests/${l.publicId}`);
  });
});
