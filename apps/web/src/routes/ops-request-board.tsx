import type { Context, Hono } from "hono";
import { opsNotFound, requireOps } from "../auth/ops.ts";
import { auditStatement } from "../db/audit.ts";
import { findAdminRequest } from "../db/requests.ts";
import { editPublicStatement, findPublicationByRequestId, publicationAuditGuard, publishStatement, rejectStatement, returnedPublication, unpublishStatement } from "../db/request-board.ts";
import { opsBoardActions, parsePublicListing, parseReviewNote, type PublicationStatus } from "../domain/request-board.ts";
import type { AppEnv } from "../env.ts";
import type { BoardAction, BoardFormState } from "../views/ops/PublicListingBlock.tsx";
import { REQUESTS_PATH } from "../views/ops/RequestsPages.tsx";

/**
 * Ops moderation of the public request board (VNX-2704a; addendum §3.2, §5, §7.1): publish, edit, reject and unpublish a request's
 * public listing. Every route needs marketplace.act (Owner, Operator); anyone else, an OAuth session included, gets the sealed 404 of
 * requireOps, and there is no role or admin check here. Each write is ONE db.batch: the compare-and-set on status and updated_at
 * (db/request-board.ts) and its audit row, which is written only when that compare-and-set went through. The audit data holds the
 * request id and the two states, never the wording or the reason. Not an e-mail task: the client's e-mails come with VNX-2704b.
 */

export type RequestDetailRender = (
  c: Context<AppEnv>,
  item: NonNullable<Awaited<ReturnType<typeof findAdminRequest>>>,
  notice: null,
  status: 400 | 409,
  errors: { board: BoardFormState },
) => Promise<Response>;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Where each action goes: its target state. */
const TARGET: Record<BoardAction, PublicationStatus> = { publish: "published", edit: "published", reject: "rejected", unpublish: "unpublished" };

export function registerOpsRequestBoardRoutes(app: Hono<AppEnv>, render: RequestDetailRender) {
  /** The current page with a refused form on it. Nothing was written: the page is the state as it is now. */
  async function refused(c: Context<AppEnv>, id: string, status: 400 | 409, form: BoardFormState) {
    const current = await findAdminRequest(c.env.DB, id);
    return current ? render(c, current, null, status, { board: form }) : opsNotFound(c);
  }

  async function act(c: Context<AppEnv>, action: BoardAction) {
    const id = c.req.param("id") ?? "";
    const [item, publication] = await Promise.all([findAdminRequest(c.env.DB, id), findPublicationByRequestId(c.env.DB, id)]);
    if (!item || !publication) return opsNotFound(c);
    const body = await c.req.parseBody();
    const values = { title: text(body.public_title), description: text(body.public_description), note: text(body.review_note) };
    // A 409 shows the current state (fresh values, fresh token), never what was typed: typed text would invite overwriting the other change (M-1).
    const conflict: BoardFormState = { action, errors: {}, conflict: true, values: {} };
    // The move is not allowed in the state it is in now: 409, nothing written.
    if (!opsBoardActions(publication.status, item.request.status).includes(action)) return refused(c, id, 409, conflict);

    const user = c.get("user")!;
    const now = new Date().toISOString();
    const token = text(body.updated_at);
    const move = { requestId: id, expectedUpdatedAt: token, reviewedBy: user.id, now };
    let change: D1PreparedStatement;
    if (action === "publish" || action === "edit") {
      const parsed = parsePublicListing({ title: values.title, description: values.description });
      if (!parsed.ok) return refused(c, id, 400, { action, errors: { title: parsed.errors.title, description: parsed.errors.description }, values });
      const wording = { ...move, title: parsed.input.title, description: parsed.input.description };
      change = action === "publish" ? publishStatement(c.env.DB, wording) : editPublicStatement(c.env.DB, wording);
    } else {
      const parsed = parseReviewNote(values.note);
      if (!parsed.ok) return refused(c, id, 400, { action, errors: { note: parsed.error }, values });
      const reason = { ...move, reviewNote: parsed.note };
      change = action === "reject" ? rejectStatement(c.env.DB, reason) : unpublishStatement(c.env.DB, reason);
    }

    const to = TARGET[action];
    const results = await c.env.DB.batch([
      change,
      auditStatement(
        c.env.DB,
        { actorUserId: user.id, action: `request_publication.${action}`, entity: "request_publication", entityId: id, data: { requestId: id, from: publication.status, to }, now },
        publicationAuditGuard({ requestId: id, status: to, updatedAt: now }),
      ),
    ]);
    // The compare-and-set lost (an old form, or someone else acted first): nothing was written, not even the audit row.
    if (!returnedPublication(results[0])) return refused(c, id, 409, conflict);
    return c.redirect(`${REQUESTS_PATH}/${id}?done=1`, 303);
  }

  for (const action of ["publish", "edit", "reject", "unpublish"] as const) {
    app.post(`${REQUESTS_PATH}/:id/publication/${action}`, requireOps("marketplace.act"), (c) => act(c, action));
  }
}
