import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { requireOps } from "../auth/ops.ts";
import { listRecentAudit } from "../db/audit.ts";
import { countBuilderReviewQueue } from "../db/builders.ts";
import { countNewFeedback } from "../db/feedback.ts";
import { countOverdueInquiries } from "../db/inquiries.ts";
import { countProductReviewQueue } from "../db/products.ts";
import { countRequestsToMatch } from "../db/requests.ts";
import { REMIND_AFTER_MS } from "../domain/inquiry.ts";
import { can, type OpsCapability, type OpsRole } from "../domain/ops.ts";
import type { AppEnv } from "../env.ts";
import { OPS_MENU, reachable, visibleMenu, type IsRegistered, type OpsMenuCount } from "../ops/menu.ts";
import type { OpsEnvironment, OpsShell } from "../views/ops/OpsLayout.tsx";
import { OverviewPage, type ActivityActor, type ActivityView, type QueueId, type QueueView } from "../views/ops/OverviewPage.tsx";
import { page } from "../views/render.ts";

/**
 * Ops console pages (VNX-2503; spec §2, §7; ADR-010). Every route here is guarded by requireOps(capability), which
 * answers the sealed 404 to anyone else. Registered before the /ops catch-all in app.ts.
 */

/** PRODUCTION only when APP_ORIGIN's host is exactly vnx.si; anything else, or an unreadable value, is LOCAL. */
export function opsEnvironment(appOrigin: string | undefined): OpsEnvironment {
  try {
    return new URL(appOrigin ?? "").hostname === "vnx.si" ? "production" : "local";
  } catch {
    return "local";
  }
}

/** GET paths registered in `app`, read once on first use (registration is over by the time a request arrives). */
export function registeredPaths(app: Hono<AppEnv>): IsRegistered {
  let paths: Set<string> | null = null;
  return (path) => {
    paths ??= new Set(app.routes.filter((r) => r.method === "GET").map((r) => r.path));
    return paths.has(path);
  };
}

const MENU_COUNTS: Record<OpsMenuCount, (db: D1Database) => Promise<{ count: number }>> = {
  builders: countBuilderReviewQueue,
  products: countProductReviewQueue,
  requests: countRequestsToMatch,
};

/**
 * What OpsLayout needs for the signed-in member on `currentPath`. Only after requireOps (opsRole and user are set).
 * Reads the waiting count of each visible menu item that has one; a count that fails to read is left out, never 0.
 */
export async function opsShell(c: Context<AppEnv>, isRegistered: IsRegistered, currentPath: string): Promise<OpsShell> {
  const role = c.get("opsRole");
  const wanted = OPS_MENU.filter((item) => item.count && reachable(role, item.path, item.capability, isRegistered)).map((item) => item.count!);
  const settled = await Promise.allSettled(wanted.map((key) => MENU_COUNTS[key](c.env.DB)));
  const counts: Partial<Record<OpsMenuCount, number>> = {};
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") counts[wanted[i]!] = result.value.count;
    else console.error(JSON.stringify({ requestId: c.get("requestId"), event: "ops.menu.count_failed", count: wanted[i], error: String(result.reason) }));
  });
  return { role, email: c.get("user")?.email ?? "", environment: opsEnvironment(c.env.APP_ORIGIN), menu: visibleMenu(role, isRegistered, currentPath, OPS_MENU, counts) };
}

/** Each queue, the list page it opens (once that route exists) and the capability that page will declare. */
const QUEUE_TARGETS: Record<QueueId, { path: string; capability: OpsCapability }> = {
  builders: { path: "/ops/marketplace/builders", capability: "marketplace.view" },
  products: { path: "/ops/marketplace/products", capability: "marketplace.view" },
  feedback: { path: "/ops/inbox/feedback", capability: "feedback.view" },
  requests: { path: "/ops/marketplace/requests", capability: "marketplace.view" },
  inquiries: { path: "/ops/marketplace/inquiries", capability: "marketplace.view" },
};

const RECENT_ACTIVITY_LIMIT = 10;

/**
 * Spec §4: e-mail only for an actor who is the root Owner (ADMIN_EMAILS) or an Ops member; anyone else by user ID;
 * no actor is the system.
 */
export function actorOf(row: { actorUserId: string | null; actorEmail: string | null; actorIsOpsMember: boolean }, owners: Set<string>): ActivityActor {
  if (!row.actorUserId) return { kind: "system" };
  const email = row.actorEmail?.toLowerCase() ?? null;
  if (email && (row.actorIsOpsMember || owners.has(email))) return { kind: "email", email: row.actorEmail! };
  return { kind: "id", id: row.actorUserId };
}

export function registerOpsRoutes(app: Hono<AppEnv>) {
  const isRegistered = registeredPaths(app);

  app.get("/ops", requireOps("overview.view"), async (c) => {
    const role: OpsRole = c.get("opsRole");
    const detail = can(role, "overview.detail");
    const now = new Date();
    const db = c.env.DB;
    const remindBefore = new Date(now.getTime() - REMIND_AFTER_MS).toISOString();

    // One query per queue, each on its own: a failed query marks only its own queue (spec §7.4: never a false 0).
    const reads: Record<QueueId, Promise<{ count: number; oldest: string | null; unsent?: number }>> = {
      builders: countBuilderReviewQueue(db),
      products: countProductReviewQueue(db),
      feedback: countNewFeedback(db),
      requests: countRequestsToMatch(db),
      inquiries: countOverdueInquiries(db, remindBefore),
    };
    const ids = Object.keys(reads) as QueueId[];
    const settled = await Promise.allSettled(ids.map((id) => reads[id]));
    const queues: QueueView[] = ids.map((id, i) => {
      const result = settled[i]!;
      if (result.status === "rejected") {
        console.error(JSON.stringify({ requestId: c.get("requestId"), event: "ops.overview.queue_failed", queue: id, error: String(result.reason) }));
        return { id, state: "error" };
      }
      const { count, oldest, unsent } = result.value;
      const target = QUEUE_TARGETS[id];
      // Content (no overview.detail) sees the count and label only: no age, no unsent line, no link (spec §3.1).
      return {
        id,
        state: "ok",
        count,
        oldestMs: detail && oldest ? Math.max(0, now.getTime() - Date.parse(oldest)) : null,
        unsent: detail && unsent !== undefined ? unsent : null,
        href: detail && reachable(role, target.path, target.capability, isRegistered) ? target.path : null,
      };
    });

    let activity: ActivityView = { state: "hidden" };
    if (detail) {
      try {
        const owners = adminEmails(c.env);
        const rows = await listRecentAudit(db, RECENT_ACTIVITY_LIMIT);
        activity = {
          state: "ok",
          rows: rows.map((r) => ({ id: r.id, at: r.createdAt, actor: actorOf(r, owners), action: r.action, entity: r.entity, entityId: r.entityId })),
        };
      } catch (err) {
        console.error(JSON.stringify({ requestId: c.get("requestId"), event: "ops.overview.activity_failed", error: String(err) }));
        activity = { state: "error" };
      }
    }

    return page(c, <OverviewPage shell={await opsShell(c, isRegistered, "/ops")} queues={queues} readAt={now.toISOString()} activity={activity} />);
  });
}
