import { beforeEach, describe, expect, it } from "vitest";
import { addMessageStatement, listMessages, setInquiryStatusStatement } from "../../src/db/inquiries.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { notifyInquiryMessage } from "../../src/notify/inquiry.ts";
import { makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const NOW = new Date("2026-10-04T10:00:00.000Z");
const failingEnv = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;

async function reply(inquiryId: string, senderUserId: string, from: "open" | "answered", to: "open" | "answered" | "declined", body: string, kind: "message" | "decline" = "message") {
  const now = new Date(Date.now() + Math.floor(Math.random() * 1000)).toISOString();
  const [, inserted] = await testEnv.DB.batch([
    setInquiryStatusStatement(testEnv.DB, { id: inquiryId, from, to, now }),
    addMessageStatement(testEnv.DB, { inquiryId, senderUserId, kind, body, now }, { inquiryId, status: to, updatedAt: now }),
  ]);
  return (inserted?.results[0] as { id: string }).id;
}

describe("notifyInquiryMessage (spec §8.3)", () => {
  beforeEach(() => clearOutbox());

  it("sends the builder a new-inquiry e-mail in the builder's locale, without the client's address", async () => {
    const { firstMessageId, inquiry, client } = await makeInquiry({ tag: "nt-new", status: "open", builderLocale: "vi" });
    expect(await notifyInquiryMessage(testEnv, firstMessageId, NOW)).toBe("sent");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "nt-new-b@vnx.si", subject: "Yêu cầu mới: Mua từ Minh Tran" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/vi/hub/inquiries/${inquiry.id}`);
    expect(outbox[0]!.text).toContain(inquiry.message);
    expect(outbox[0]!.text + outbox[0]!.html).not.toContain(client.email);
    expect((await listMessages(testEnv.DB, inquiry.id))[0]?.notifiedAt).toBe(NOW.toISOString());
  });

  it("sends each later message to the other party, with a link to their side", async () => {
    const { inquiry, client, builder } = await makeInquiry({ tag: "nt-msg", status: "open" });
    const fromBuilder = await reply(inquiry.id, builder.userId, "open", "answered", "Happy to help.");
    expect(await notifyInquiryMessage(testEnv, fromBuilder, NOW)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "New message from nt-msg builder" });
    expect(outbox[0]!.text).toContain(`https://vnx.si/me/inquiries/${inquiry.id}`);

    const fromClient = await reply(inquiry.id, client.id, "answered", "answered", "Great, thanks!");
    expect(await notifyInquiryMessage(testEnv, fromClient, NOW)).toBe("sent");
    expect(outbox[1]).toMatchObject({ to: "nt-msg-b@vnx.si", subject: "New message from Minh Tran" });
    expect(outbox[1]!.text + outbox[1]!.html).not.toContain(client.email);
  });

  it("tells the client about a decline, with the optional reason", async () => {
    const { inquiry, builder, client } = await makeInquiry({ tag: "nt-dec", status: "open", clientLocale: "zh-Hans" });
    const id = await reply(inquiry.id, builder.userId, "open", "declined", "Fully booked this month.", "decline");
    expect(await notifyInquiryMessage(testEnv, id, NOW)).toBe("sent");
    expect(outbox[0]).toMatchObject({ to: client.email, subject: "nt-dec builder 婉拒了你的咨询" });
    expect(outbox[0]!.text).toContain("Fully booked this month.");
    expect(outbox[0]!.text).toContain("https://vnx.si/zh-hans/products");
  });

  it("does nothing for a message already sent, or on an unconfirmed or removed inquiry", async () => {
    const sent = await makeInquiry({ tag: "nt-skip1", status: "open" });
    await notifyInquiryMessage(testEnv, sent.firstMessageId, NOW);
    expect(await notifyInquiryMessage(testEnv, sent.firstMessageId, NOW)).toBe("skipped");
    const pending = await makeInquiry({ tag: "nt-skip2", status: "pending_verification" });
    expect(await notifyInquiryMessage(testEnv, pending.firstMessageId, NOW)).toBe("skipped");
    const removed = await makeInquiry({ tag: "nt-skip3", status: "removed" });
    expect(await notifyInquiryMessage(testEnv, removed.firstMessageId, NOW)).toBe("skipped");
    expect(await notifyInquiryMessage(testEnv, "01NOTAREALMESSAGEID0000000", NOW)).toBe("skipped");
    expect(outbox).toHaveLength(1);
  });

  it("counts failures and records an audit row on the third", async () => {
    const { firstMessageId, inquiry } = await makeInquiry({ tag: "nt-fail", status: "open" });
    for (let i = 0; i < 3; i++) expect(await notifyInquiryMessage(failingEnv, firstMessageId, NOW)).toBe("failed");
    const [message] = await listMessages(testEnv.DB, inquiry.id);
    expect(message).toMatchObject({ notifiedAt: null, notifyAttempts: 3 });
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'inquiry.notify_failed' AND entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect(await notifyInquiryMessage(failingEnv, firstMessageId, NOW)).toBe("skipped");
  });
});
