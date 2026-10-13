import type { FC } from "hono/jsx";
import { opsInterestActions, type InterestStatus } from "../../domain/request-board.ts";
import { translator } from "../../i18n/t.ts";
import { FormErrorSummary } from "../FormErrorSummary.tsx";
import { PlainText } from "../PlainText.tsx";
import { BUILDERS_PATH } from "./BuildersPages.tsx";
import { Pill, tr, type PillTone } from "./parts.tsx";

/**
 * The "Interested builders" block of an Ops request page (EPIC 27 VNX-2706b; addendum §3.3 steps 6-7, §5). Shown only to a role that may act
 * (marketplace.act); the route gives it only the interests of builders who are still public (L9). English only (ADR-010). The block is inside the
 * request page (RequestDetailPage), not a layout of its own. Invite posts to the existing invite action with `builder=<id>`; Dismiss posts to its own
 * action. The builder's note is plain text, escaped. No action carries a fragment. A refused action (409) comes back as the VNX-0807 summary, with
 * the interests as they are now.
 */

/** An interest as the block needs it (structural: views never import db). `score` is the §8.10 suggestion score, for reference only; null = not a candidate. */
export interface InterestRowView {
  id: string;
  builderId: string;
  builderName: string;
  builderHandle: string;
  status: InterestStatus;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  productName: string | null;
  /** Set only while the product is published. */
  productSlug: string | null;
  score: number | null;
}

/** A refused Dismiss: nothing was written; the page shows the current state. */
export interface InterestsFormState {
  conflict: boolean;
}

const TONE: Record<InterestStatus, PillTone> = { pending: "pending", invited: "ok", dismissed: "mute", withdrawn: "mute" };

type Props = {
  /** ".../requests/<id>": the form actions are built from it. */
  base: string;
  rows: InterestRowView[];
  /** The request can take another invitation now (open, under the 5-invite cap). */
  invitable: boolean;
  /** The list filter as a query string, added to every action so the filter survives the post (S-2). */
  query?: string;
  form?: InterestsFormState;
};

export const InterestedBuilders: FC<Props> = ({ base, rows, invitable, query = "", form }) => (
  <section id="ib-block" class="ops-card ops-sec" aria-labelledby="ib-h">
    <h2 id="ib-h">{tr("ops.interests.title")}</h2>
    <p class="ops-muted">{tr("ops.interests.lead")}</p>
    {form?.conflict ? <FormErrorSummary tr={translator("en")} items={[{ href: "", message: tr("ops.interests.error.conflict") }]} /> : null}
    {rows.length === 0 ? (
      <p class="ops-state">{tr("ops.interests.empty")}</p>
    ) : (
      <>
        {!invitable && rows.some((r) => r.status === "pending") ? <p class="ops-note">{tr("ops.interests.noInvite")}</p> : null}
        <div class="ops-table-wrap">
          <table class="ops-table">
            <thead>
              <tr>
                <th scope="col">{tr("ops.interests.col.builder")}</th>
                <th scope="col">{tr("ops.interests.col.sent")}</th>
                <th scope="col">{tr("ops.interests.col.status")}</th>
                <th scope="col">{tr("ops.interests.col.score")}</th>
                <th scope="col">{tr("ops.interests.col.details")}</th>
                <th scope="col">{tr("ops.interests.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actions = opsInterestActions({ status: r.status, builderPublic: true, invitable });
                return (
                  <tr data-interest={r.id} data-builder={r.builderId}>
                    <td>
                      <a class="ops-strong" href={`${BUILDERS_PATH}/${r.builderId}`}>
                        {r.builderName}
                      </a>{" "}
                      <span class="ops-muted ops-mono">@{r.builderHandle}</span>
                    </td>
                    <td class="ops-mono">{r.createdAt.slice(0, 10)}</td>
                    <td>
                      <Pill tone={TONE[r.status]} label={tr(`ops.interests.status.${r.status}`)} />
                    </td>
                    <td class="ops-mono" data-score={r.score === null ? "—" : String(r.score)}>
                      {r.score === null ? "—" : r.score}
                    </td>
                    <td>
                      {r.productName ? (
                        <p>{r.productSlug ? <a href={`/p/${r.productSlug}`}>{r.productName}</a> : r.productName}</p>
                      ) : null}
                      {r.note ? <PlainText text={r.note} /> : null}
                    </td>
                    <td>
                      <div class="ops-actions">
                        {actions.includes("invite") ? (
                          <form method="post" action={`${base}/invite${query}`}>
                            <input type="hidden" name="builder" value={r.builderId} />
                            <button class="ops-btn ops-btn-primary" type="submit" aria-label={tr("ops.interests.inviteLabel", { name: r.builderName })}>
                              {tr("ops.interests.invite")}
                            </button>
                          </form>
                        ) : null}
                        {actions.includes("dismiss") ? (
                          <form method="post" action={`${base}/interests/${r.id}/dismiss${query}`}>
                            <input type="hidden" name="updated_at" value={r.updatedAt} />
                            <button class="ops-btn" type="submit" aria-label={tr("ops.interests.dismissLabel", { name: r.builderName })}>
                              {tr("ops.interests.dismiss")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p class="ops-note">{tr("ops.interests.dismissHelp")}</p>
      </>
    )}
  </section>
);
