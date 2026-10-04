import { describe, expect, it } from "vitest";
import { auditStatement } from "../../src/db/audit.ts";
import {
  addMessageStatement,
  countOpenInquiries,
  createInquiry,
  deleteExpiredPendingInquiries,
  deletePendingInquiryStatements,
  findBuilderInquiry,
  findClientInquiry,
  findInquiryById,
  findMessageContext,
  listBuilderInquiries,
  listClientInquiries,
  listMessages,
  listUnnotifiedMessages,
  markMessageNotified,
  recordNotifyFailure,
  returnedInquiry,
  setInquiryStatus,
  setInquiryStatusStatement,
} from "../../src/db/inquiries.ts";
import { setDisplayNameIfEmpty } from "../../src/db/users.ts";
import { ensureUser, makeInquiry } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const db = () => testEnv.DB;
const NOW = "2026-10-04T10:00:00.000Z";
const LATER = "2026-10-05T10:00:00.000Z";

describe("db/inquiries", () => {
  it("creates an inquiry with its first message and opened_at only when open", async () => {
    const { inquiry, firstMessageId, product } = await makeInquiry({ tag: "dbi-create", status: "open", now: NOW });
    expect(inquiry).toMatchObject({ status: "open", openedAt: NOW, lastActivityAt: NOW, productId: product!.id, clientName: "Minh Tran", budgetBand: "500-2k" });
    const messages = await listMessages(db(), inquiry.id);
    expect(messages).toEqual([expect.objectContaining({ id: firstMessageId, kind: "message", body: inquiry.message, notifiedAt: null, notifyAttempts: 0 })]);
    const pending = await makeInquiry({ tag: "dbi-pending", status: "pending_verification", now: NOW });
    expect(pending.inquiry.openedAt).toBeNull();
  });

  it("refuses an inquiry from a builder to themself", async () => {
    const { builder } = await makeInquiry({ tag: "dbi-self", status: "open" });
    await expect(
      createInquiry(db(), { clientUserId: builder.userId, clientName: "Me", builderId: builder.userId, productId: null, type: "hire", message: "x".repeat(20), budgetBand: "unsure", deadline: null, status: "open", locale: "en", now: NOW }),
    ).rejects.toThrow();
  });

  it("shows builders neither pending nor removed inquiries, and clients everything but removed", async () => {
    const { builder, client, inquiry: pending } = await makeInquiry({ tag: "dbi-vis", status: "pending_verification" });
    expect(await findBuilderInquiry(db(), builder.userId, pending.id)).toBeNull();
    expect(await findClientInquiry(db(), client.id, pending.id)).not.toBeNull();
    await setInquiryStatus(db(), { id: pending.id, from: "pending_verification", to: "open", now: NOW });
    const found = await findBuilderInquiry(db(), builder.userId, pending.id);
    expect(found).toMatchObject({ inquiry: { status: "open", openedAt: NOW }, builderHandle: "dbi-vis-b", productName: "dbi-vis product" });
    expect(await listBuilderInquiries(db(), builder.userId)).toHaveLength(1);
    expect(await countOpenInquiries(db(), builder.userId)).toBe(1);

    await setInquiryStatus(db(), { id: pending.id, from: "open", to: "removed", now: LATER });
    expect(await findBuilderInquiry(db(), builder.userId, pending.id)).toBeNull();
    expect(await findClientInquiry(db(), client.id, pending.id)).toBeNull();
    expect(await listClientInquiries(db(), client.id)).toEqual([]);
    expect(await countOpenInquiries(db(), builder.userId)).toBe(0);
  });

  it("hides inquiries from other builders and other clients", async () => {
    const a = await makeInquiry({ tag: "dbi-a", status: "open" });
    const b = await makeInquiry({ tag: "dbi-b", status: "open" });
    expect(await findBuilderInquiry(db(), b.builder.userId, a.inquiry.id)).toBeNull();
    expect(await findClientInquiry(db(), b.client.id, a.inquiry.id)).toBeNull();
  });

  it("adds a message and audit row only when the compare-and-set wins", async () => {
    const { builder, inquiry } = await makeInquiry({ tag: "dbi-cas", status: "open", now: NOW });
    const guard = { inquiryId: inquiry.id, status: "answered" as const, updatedAt: LATER };
    const win = await db().batch([
      setInquiryStatusStatement(db(), { id: inquiry.id, from: "open", to: "answered", now: LATER }),
      addMessageStatement(db(), { inquiryId: inquiry.id, senderUserId: builder.userId, kind: "message", body: "Hello!", now: LATER }, guard),
      auditStatement(db(), { actorUserId: builder.userId, action: "inquiry.reply", entity: "inquiry", entityId: inquiry.id, now: LATER }, guard),
    ]);
    expect(returnedInquiry(win[0])).toMatchObject({ status: "answered", lastActivityAt: LATER, openedAt: NOW });
    expect(win[1]?.results).toHaveLength(1);

    // Same transition again: the status is no longer "open", so nothing is written.
    const lose = await db().batch([
      setInquiryStatusStatement(db(), { id: inquiry.id, from: "open", to: "answered", now: "2026-10-06T10:00:00.000Z" }),
      addMessageStatement(db(), { inquiryId: inquiry.id, senderUserId: builder.userId, kind: "message", body: "Again", now: "2026-10-06T10:00:00.000Z" }, { ...guard, updatedAt: "2026-10-06T10:00:00.000Z" }),
    ]);
    expect(returnedInquiry(lose[0])).toBeNull();
    expect(lose[1]?.results).toHaveLength(0);
    expect((await listMessages(db(), inquiry.id)).map((m) => m.body)).toEqual([inquiry.message, "Hello!"]);
    const audits = await db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ?1").bind(inquiry.id).first<{ n: number }>();
    expect(audits?.n).toBe(1);
  });

  it("deletes a pending inquiry with its messages but never an open one", async () => {
    const pending = await makeInquiry({ tag: "dbi-del1", status: "pending_verification" });
    const open = await makeInquiry({ tag: "dbi-del2", status: "open" });
    await db().batch(deletePendingInquiryStatements(db(), pending.inquiry.id));
    await db().batch(deletePendingInquiryStatements(db(), open.inquiry.id));
    expect(await findInquiryById(db(), pending.inquiry.id)).toBeNull();
    expect(await listMessages(db(), pending.inquiry.id)).toEqual([]);
    expect(await findInquiryById(db(), open.inquiry.id)).not.toBeNull();
  });

  it("deletes pending inquiries older than the cutoff", async () => {
    const old = await makeInquiry({ tag: "dbi-old", status: "pending_verification", now: "2026-10-01T00:00:00.000Z" });
    const fresh = await makeInquiry({ tag: "dbi-fresh", status: "pending_verification", now: "2026-10-03T12:00:00.000Z" });
    expect(await deleteExpiredPendingInquiries(db(), "2026-10-02T00:00:00.000Z")).toBe(1);
    expect(await findInquiryById(db(), old.inquiry.id)).toBeNull();
    expect(await findInquiryById(db(), fresh.inquiry.id)).not.toBeNull();
  });

  it("tracks notification attempts and lists only messages still due", async () => {
    const { inquiry, firstMessageId } = await makeInquiry({ tag: "dbi-notify", status: "open" });
    const pending = await makeInquiry({ tag: "dbi-notify-p", status: "pending_verification" });
    const due = (await listUnnotifiedMessages(db(), 500)).map((m) => m.id);
    expect(due).toContain(firstMessageId);
    expect(due).not.toContain(pending.firstMessageId);

    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(1);
    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(2);
    expect(await recordNotifyFailure(db(), firstMessageId)).toBe(3);
    expect((await listUnnotifiedMessages(db(), 500)).map((m) => m.id)).not.toContain(firstMessageId);

    const other = await makeInquiry({ tag: "dbi-notify2", status: "open" });
    await markMessageNotified(db(), other.firstMessageId, NOW);
    expect((await listUnnotifiedMessages(db(), 500)).map((m) => m.id)).not.toContain(other.firstMessageId);
    expect(inquiry.id).toBeTruthy();
  });

  it("loads the context a notification needs, with both parties' addresses", async () => {
    const { client, builder, inquiry, firstMessageId } = await makeInquiry({ tag: "dbi-ctx", status: "open" });
    const ctx = await findMessageContext(db(), firstMessageId);
    expect(ctx).toMatchObject({
      message: { id: firstMessageId, senderUserId: client.id },
      summary: { inquiry: { id: inquiry.id }, builderName: builder.name },
      isFirst: true,
      client: { email: client.email, locale: "en" },
      builder: { email: "dbi-ctx-b@vnx.si", locale: "en" },
    });
  });

  it("sets the display name only when empty", async () => {
    const user = await ensureUser("dbi-name@vnx.si");
    await setDisplayNameIfEmpty(db(), user.id, "First", NOW);
    await setDisplayNameIfEmpty(db(), user.id, "Second", NOW);
    const row = await db().prepare("SELECT display_name FROM users WHERE id = ?1").bind(user.id).first<{ display_name: string }>();
    expect(row?.display_name).toBe("First");
  });
});
