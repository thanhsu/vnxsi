import type { Context, Hono } from "hono";
import { adminEmails } from "../auth/admin.ts";
import { opsNotFound, requireOps } from "../auth/ops.ts";
import { listEntityAudit } from "../db/audit.ts";
import { countBuildersByStatus, findBuilderAccount, searchBuilders } from "../db/builders.ts";
import { isBuilderStatus, type BuilderAccount, type BuilderAction } from "../domain/builder.ts";
import { can } from "../domain/ops.ts";
import type { AppEnv } from "../env.ts";
import type { IsRegistered } from "../ops/menu.ts";
import { BUILDERS_PATH, BuilderDetailPage, BuildersListPage, type BuilderFilter } from "../views/ops/BuildersPages.tsx";
import { qs, type HistoryView, type OpsNotice } from "../views/ops/parts.tsx";
import { page } from "../views/render.ts";
import { decideBuilder } from "./admin.tsx";
import { actorOf, opsShell, registeredPaths } from "./ops.tsx";

/**
 * Ops Marketplace queues (VNX-2504a; spec §2.2, §3.1, §7.3). Pages need marketplace.view, every POST marketplace.act;
 * anyone else gets the sealed 404 of requireOps. The decisions are the /admin ones (decideBuilder): same state
 * machine, compare-and-set, audit and e-mail. Filters come from the URL and only allowlisted values are kept.
 */

const SEARCH_MAX = 100;
const HISTORY_LIMIT = 50;

/** A search of 1–100 characters after trimming; anything else is ignored. */
function searchOf(value: string | undefined): string | null {
  const q = (value ?? "").trim();
  return q && q.length <= SEARCH_MAX ? q : null;
}

function noticeOf(value: string | undefined): OpsNotice {
  return value === "1" ? "done" : value === "mail_failed" ? "mail_failed" : null;
}

/** The builder filter as given in the URL: a known status and a usable search, nothing else. */
function builderFilter(c: Context<AppEnv>): BuilderFilter {
  const status = c.req.query("status");
  const q = searchOf(c.req.query("q"));
  return { ...(isBuilderStatus(status) ? { status } : {}), ...(q ? { q } : {}) };
}

/** The object's History: audit rows in the safe projection; a failed read is an error state, never an empty list. */
async function historyOf(c: Context<AppEnv>, entity: string, entityId: string): Promise<HistoryView> {
  try {
    const owners = adminEmails(c.env);
    const rows = await listEntityAudit(c.env.DB, entity, entityId, HISTORY_LIMIT);
    return { state: "ok", rows: rows.map((r) => ({ id: r.id, at: r.createdAt, actor: actorOf(r, owners), action: r.action, entity: r.entity, entityId: r.entityId })) };
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "ops.history_failed", entity, error: String(err) }));
    return { state: "error" };
  }
}

export function registerOpsMarketplaceRoutes(app: Hono<AppEnv>) {
  const isRegistered: IsRegistered = registeredPaths(app);

  async function builderDetail(c: Context<AppEnv>, builder: BuilderAccount, notice: OpsNotice, status: 200 | 400 | 409 = 200, reasonError?: BuilderAction) {
    const [shell, history] = await Promise.all([opsShell(c, isRegistered, BUILDERS_PATH), historyOf(c, "builder", builder.userId)]);
    const canAct = can(c.get("opsRole"), "marketplace.act");
    return page(c, <BuilderDetailPage shell={shell} builder={builder} filter={builderFilter(c)} canAct={canAct} notice={notice} reasonError={reasonError} history={history} />, status);
  }

  app.get(BUILDERS_PATH, requireOps("marketplace.view"), async (c) => {
    const given = c.req.query("status");
    const status = isBuilderStatus(given) ? given : "pending";
    const q = searchOf(c.req.query("q"));
    const [shell, counts, builders] = await Promise.all([opsShell(c, isRegistered, BUILDERS_PATH), countBuildersByStatus(c.env.DB), searchBuilders(c.env.DB, status, q)]);
    return page(c, <BuildersListPage shell={shell} status={status} q={q} counts={counts} builders={builders} />);
  });

  app.get(`${BUILDERS_PATH}/:userId`, requireOps("marketplace.view"), async (c) => {
    const builder = await findBuilderAccount(c.env.DB, c.req.param("userId"));
    if (!builder) return opsNotFound(c);
    return builderDetail(c, builder, noticeOf(c.req.query("done")));
  });

  for (const action of ["approve", "reject", "suspend", "unsuspend"] as const) {
    app.post(`${BUILDERS_PATH}/:userId/${action}`, requireOps("marketplace.act"), async (c) => {
      const r = await decideBuilder(c, action);
      if (r.kind === "not_found") return opsNotFound(c);
      if (r.kind === "invalid_reason") return builderDetail(c, r.builder, null, 400, action);
      if (r.kind === "conflict") {
        // Nothing was written. Show the current state with the reason, as a 409.
        const current = await findBuilderAccount(c.env.DB, c.req.param("userId"));
        return current ? builderDetail(c, current, "conflict", 409) : opsNotFound(c);
      }
      return c.redirect(`${BUILDERS_PATH}/${r.userId}${qs({ ...builderFilter(c), done: r.mailed ? "1" : "mail_failed" })}`, 303);
    });
  }
}
