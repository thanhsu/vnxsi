import type { Context } from "hono";
import { auditStatement } from "../db/audit.ts";
import { listMessages, returnedInquiry, setInquiryStatusStatement } from "../db/inquiries.ts";
import { inquiryOpenedStatement } from "../db/stats.ts";
import { setDisplayNameIfEmpty } from "../db/users.ts";
import type { Inquiry } from "../domain/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";

/**
 * The one place a pending inquiry becomes open (spec §5.6 step 3), for the e-mail link and for "Send now" in /me.
 * The compare-and-set pending_verification -> open is the state machine's "verify" rule (domain/inquiry.ts); a signed-in
 * session proves the owner's e-mail just as the link does, so "me" applies the same rule on the owner's behalf.
 * Returns false when the compare-and-set lost (already opened, removed or deleted meanwhile): nothing else happens then.
 * Otherwise names the account the first time and tells the builder.
 */
export async function openPendingInquiry(c: Context<AppEnv>, inquiry: Inquiry, user: { id: string }, now: Date, via: "link" | "me"): Promise<boolean> {
  const iso = now.toISOString();
  const guard = { inquiryId: inquiry.id, status: "open" as const, updatedAt: iso };
  const [moved] = await c.env.DB.batch([
    setInquiryStatusStatement(c.env.DB, { id: inquiry.id, from: "pending_verification", to: "open", now: iso }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "inquiry.verify", entity: "inquiry", entityId: inquiry.id, data: { via }, now: iso }, guard),
    // M7 (spec §8.11): counts only when this batch is the one that opened the inquiry (opened_at = iso).
    inquiryOpenedStatement(c.env.DB, { inquiryId: inquiry.id, openedAt: iso }),
  ]);
  if (!returnedInquiry(moved)) return false;
  await setDisplayNameIfEmpty(c.env.DB, user.id, inquiry.clientName, iso);
  const [first] = await listMessages(c.env.DB, inquiry.id);
  if (first) await notifyInquiryMessage(c.env, first.id, now);
  return true;
}
