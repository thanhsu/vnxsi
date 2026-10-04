import type { Context } from "hono";
import { auditStatement } from "../db/audit.ts";
import { returnedRequest, setRequestStatusStatement } from "../db/requests.ts";
import { setDisplayNameIfEmpty } from "../db/users.ts";
import type { ClientRequest } from "../domain/request.ts";
import type { AppEnv } from "../env.ts";
import { notifyRequestSubmitted } from "../notify/request.ts";

/**
 * The one place a pending request becomes submitted (spec §5.7 step 1), for the e-mail link and for "Send now" in /me.
 * The compare-and-set pending_verification -> submitted is the state machine's "verify" rule (domain/request.ts); a
 * signed-in session proves the owner's e-mail just as the link does, so "me" applies the same rule on the owner's behalf.
 * The audit row (`request.verify`, with category and languages for the M7 Live strip) is written only if the
 * compare-and-set won. Returns false when it lost (already submitted, removed or deleted meanwhile): nothing else
 * happens then. Otherwise names the account the first time and tells the admins.
 */
export async function openPendingRequest(c: Context<AppEnv>, request: ClientRequest, user: { id: string }, now: Date, via: "link" | "me"): Promise<boolean> {
  const iso = now.toISOString();
  const guard = { requestId: request.id, status: "submitted" as const, updatedAt: iso };
  const [moved] = await c.env.DB.batch([
    setRequestStatusStatement(c.env.DB, { id: request.id, from: "pending_verification", to: "submitted", now: iso }),
    auditStatement(c.env.DB, { actorUserId: user.id, action: "request.verify", entity: "request", entityId: request.id, data: { via, category: request.category, languages: request.languages }, now: iso }, guard),
  ]);
  if (!returnedRequest(moved)) return false;
  await setDisplayNameIfEmpty(c.env.DB, user.id, request.clientName, iso);
  await notifyRequestSubmitted(c.env, request.id);
  return true;
}
