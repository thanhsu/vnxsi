import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import {
  notifyInvited,
  notifyInviteExpired,
  notifyInviteReminder,
  notifyNotSelected,
  notifyProposal,
  notifyRequestExpired,
  notifyRequestRejected,
  notifyRequestSubmitted,
} from "../../src/notify/request.ts";
import { ensureUser, inviteBuilders, makeBuilder, makeRequest, proposeOn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const failingEnv = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
const setInvite = (id: string, status: string) => testEnv.DB.prepare("UPDATE request_invites SET status = ?2 WHERE id = ?1").bind(id, status).run();
const setRequest = (id: string, status: string, note: string | null = null) => testEnv.DB.prepare("UPDATE requests SET status = ?2, admin_note = ?3 WHERE id = ?1").bind(id, status, note).run();

/** A submitted request with `n` approved builders invited (matching), builder i has locale `locales[i]`. */
async function invited(tag: string, locales: string[] = ["en"], clientLocale = "en") {
  const { client, request } = await makeRequest({ tag, clientLocale });
  const builders = [];
  for (const [i, locale] of locales.entries()) {
    await ensureUser(`${tag}-b${i}@vnx.si`, locale);
    builders.push(await makeBuilder(`${tag}-b${i}@vnx.si`, `${tag}-b${i}`, "approved", { name: `${tag} builder ${i}` }));
  }
  const invites = await inviteBuilders(request, builders);
  return { client, request, builders, invites };
}

describe("request notifications (spec §8.3)", () => {
  beforeEach(() => clearOutbox());

  it("tells every admin in English, once per address, without the client's e-mail or description", async () => {
    const { client, request } = await makeRequest({ tag: "rn-admin", title: "Booking app" });
    const env = { ...testEnv, ADMIN_EMAILS: "a@vnx.si, B@vnx.si" } as Bindings;
    expect(await notifyRequestSubmitted(env, request.id)).toEqual({ sent: 2, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(["a@vnx.si", "b@vnx.si"]);
    expect(outbox[0]).toMatchObject({ subject: "New request: Booking app" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/admin/requests/${request.id}`);
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
    expect(outbox[0]!.text).not.toContain(request.description);
  });

  it("sends nothing for an unconfirmed or removed request, or when no admin is configured", async () => {
    const pending = await makeRequest({ tag: "rn-admin-p", status: "pending_verification" });
    expect(await notifyRequestSubmitted(testEnv, pending.request.id)).toEqual({ sent: 0, failed: 0 });
    const gone = await makeRequest({ tag: "rn-admin-r" });
    await setRequest(gone.request.id, "removed");
    expect(await notifyRequestSubmitted(testEnv, gone.request.id)).toEqual({ sent: 0, failed: 0 });
    const live = await makeRequest({ tag: "rn-admin-n" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await notifyRequestSubmitted({ ...testEnv, ADMIN_EMAILS: "" } as Bindings, live.request.id)).toEqual({ sent: 0, failed: 0 });
    warn.mockRestore();
    expect(outbox).toHaveLength(0);
  });

  it("invites each builder in their locale with a link to the invitation and never the client's e-mail", async () => {
    const { client, request, invites } = await invited("rn-inv", ["vi", "en"]);
    expect(await notifyInvited(testEnv, invites.map((i) => i.id))).toEqual({ sent: 2, failed: 0 });
    expect(outbox[0]).toMatchObject({ to: "rn-inv-b0@vnx.si", subject: `Bạn được mời vào một nhu cầu: ${request.title}` });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/hub/invitations/${invites[0]!.id}`);
    expect(outbox[1]).toMatchObject({ to: "rn-inv-b1@vnx.si" });
    for (const mail of outbox) {
      expect(mail.text).toContain("Minh Tran");
      expect(mail.text + mail.html).not.toContain(client.email);
    }
  });

  it("does not invite by e-mail an invitation that has already been answered", async () => {
    const { invites } = await invited("rn-inv2", ["en", "en"]);
    await setInvite(invites[0]!.id, "declined");
    expect(await notifyInvited(testEnv, [invites[0]!.id, invites[1]!.id, "01NOTAREALINVITE0000000000"])).toEqual({ sent: 1, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(["rn-inv2-b1@vnx.si"]);
  });

  it("reminds a builder who has not answered, and only then", async () => {
    const { invites } = await invited("rn-rem");
    expect(await notifyInviteReminder(testEnv, invites[0]!.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: "rn-rem-b0@vnx.si" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/hub/invitations/${invites[0]!.id}`);
    await proposeOn(invites[0]!);
    expect(await notifyInviteReminder(testEnv, invites[0]!.id)).toBe("skipped");
    expect(outbox).toHaveLength(1);
  });

  it("tells the client about a proposal in their locale, with price and time, linking to /me", async () => {
    const { client, request, invites } = await invited("rn-prop", ["en"], "zh-Hans");
    expect(await notifyProposal(testEnv, invites[0]!.id)).toBe("skipped");
    await proposeOn(invites[0]!);
    expect(await notifyProposal(testEnv, invites[0]!.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "rn-prop builder 0 发来新方案" });
    expect(outbox[0]!.text).toContain("价格：$4,500");
    expect(outbox[0]!.text).toContain("预计时间：30 天");
    expect(outbox[0]!.text).toContain(`https://vnx.si/zh-hans/me/requests/${request.id}`);
  });

  it("tells builders whose proposal was not selected, and those whose invitation lapsed", async () => {
    const { invites, request } = await invited("rn-end", ["en", "vi"]);
    await setInvite(invites[0]!.id, "not_selected");
    await setInvite(invites[1]!.id, "expired");
    expect(await notifyNotSelected(testEnv, [invites[0]!.id, invites[1]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[0]).toMatchObject({ to: "rn-end-b0@vnx.si", subject: `Update on your proposal: ${request.title}` });
    expect(await notifyInviteExpired(testEnv, [invites[0]!.id, invites[1]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[1]).toMatchObject({ to: "rn-end-b1@vnx.si", subject: `Lời mời đã kết thúc: ${request.title}` });
  });

  it("still tells builders their proposal was not selected after the request was removed as spam, without the client's e-mail", async () => {
    const { client, invites, request } = await invited("rn-spam");
    await setInvite(invites[0]!.id, "not_selected");
    await setRequest(request.id, "removed");
    expect(await notifyNotSelected(testEnv, [invites[0]!.id])).toEqual({ sent: 1, failed: 0 });
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
  });

  it("returns a request to its client with the admin's reason, and tells them when it expired", async () => {
    const { client, request } = await makeRequest({ tag: "rn-rej", clientLocale: "vi" });
    expect(await notifyRequestRejected(testEnv, request.id)).toBe("skipped");
    await setRequest(request.id, "rejected", "Please add what the salons need.");
    expect(await notifyRequestRejected(testEnv, request.id)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email });
    expect(outbox[0]!.text).toContain("Please add what the salons need.");
    expect(outbox[0]!.text).toContain("https://vnx.si/vi/request");

    expect(await notifyRequestExpired(testEnv, request.id)).toBe("skipped");
    await setRequest(request.id, "expired");
    expect(await notifyRequestExpired(testEnv, request.id)).toBe("sent");
    expect(outbox[1]!.text).toContain("30");
  });

  it("counts a failed send and never throws, even when D1 is down", async () => {
    const { invites } = await invited("rn-fail");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyInvited(failingEnv, [invites[0]!.id])).toEqual({ sent: 0, failed: 1 });
    expect(await notifyInviteReminder(failingEnv, invites[0]!.id)).toBe("failed");
    const down = { ...testEnv, DB: new Proxy(testEnv.DB, { get: (t, prop) => (prop === "prepare" ? () => { throw new Error("d1 down"); } : (Reflect.get(t, prop) as unknown)) }) } as Bindings;
    await expect(notifyInvited(down, [invites[0]!.id])).resolves.toEqual({ sent: 0, failed: 1 });
    await expect(notifyRequestRejected(down, "01ANYREQUESTID000000000000")).resolves.toBe("failed");
    await expect(notifyRequestSubmitted(down, "01ANYREQUESTID000000000000")).resolves.toEqual({ sent: 0, failed: 1 });
    expect(spy.mock.calls.every(([line]) => !String(line).includes("@vnx.si"))).toBe(true);
    spy.mockRestore();
  });
});
