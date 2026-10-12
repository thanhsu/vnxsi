import type { FC } from "hono/jsx";
import type { ClientRequest } from "../../domain/request.ts";
import { opsBoardActions, type PublicationStatus, type TextError } from "../../domain/request-board.ts";
import { translator } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";
import { countryName } from "../country.ts";
import { PlainText } from "../PlainText.tsx";
import { Confirm, Pill, ReasonField, tr, utc, type PillTone } from "./parts.tsx";

/**
 * The "Public listing" block of an Ops request page (EPIC 27 VNX-2704a; addendum §3.2, §5). Shown only to a role that may act and
 * only when the request has a publication. English only (ADR-010). A form that comes back with an error uses the VNX-0807 pattern:
 * one FormErrorSummary before the forms, field ids pl-*, aria-invalid and aria-describedby, no role="alert", no fragment in any action.
 */

export type BoardAction = "publish" | "edit" | "reject" | "unpublish";

/** The publication as the block needs it (structural: views never import db). */
export interface PublicationView {
  status: PublicationStatus;
  publicTitle: string | null;
  publicDescription: string | null;
  optedInAt: string;
  reviewNote: string | null;
  publishedAt: string | null;
  endedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

/** What a refused form puts back on the page: which form it was, its field errors, a lost race, and what was typed. */
export interface BoardFormState {
  action: BoardAction;
  errors: { title?: TextError; description?: TextError; note?: TextError };
  conflict?: boolean;
  values: { title?: string; description?: string; note?: string };
}

const STATUS_TONE: Record<PublicationStatus, PillTone> = { pending_review: "pending", published: "ok", rejected: "bad", withdrawn: "mute", unpublished: "bad" };

const TITLE_ERROR = { required: "ops.board.error.title.required", too_long: "ops.board.error.title.too_long", too_short: "ops.board.error.title.required", invalid: "ops.board.error.title.invalid" } as const;
const DESCRIPTION_ERROR = {
  required: "ops.board.error.description.required",
  too_short: "ops.board.error.description.too_short",
  too_long: "ops.board.error.description.too_long",
  invalid: "ops.board.error.description.invalid",
} as const;
const NOTE_ERROR = { required: "ops.board.error.note.required", too_long: "ops.board.error.note.too_long", too_short: "ops.board.error.note.required", invalid: "ops.board.error.note.invalid" } as const;

/** The error summary items of a refused form, in field order (a conflict is one item with no link). */
export function boardErrorItems(state: BoardFormState): FormErrorItem[] {
  if (state.conflict) return [{ href: "", message: tr("ops.board.error.conflict") }];
  const items: FormErrorItem[] = [];
  if (state.errors.title) items.push({ href: "#pl-public-title", message: tr(TITLE_ERROR[state.errors.title]) });
  if (state.errors.description) items.push({ href: "#pl-public-description", message: tr(DESCRIPTION_ERROR[state.errors.description]) });
  if (state.errors.note) items.push({ href: "#pl-review-note", message: tr(NOTE_ERROR[state.errors.note]) });
  return items;
}

const Wording: FC<{ title: string; description: string; errors: BoardFormState["errors"] }> = ({ title, description, errors }) => (
  <>
    <div class="ops-field">
      <label for="pl-public-title">{tr("ops.board.publicTitle")}</label>
      <input
        class="ops-in"
        id="pl-public-title"
        name="public_title"
        value={title}
        maxlength={120}
        required
        aria-invalid={errors.title ? "true" : undefined}
        aria-describedby={errors.title ? "pl-public-title-error" : undefined}
      />
      {errors.title ? (
        <p id="pl-public-title-error" class="ops-field-error">
          {tr(TITLE_ERROR[errors.title])}
        </p>
      ) : null}
    </div>
    <div class="ops-field">
      <label for="pl-public-description">{tr("ops.board.publicDescription")}</label>
      <textarea
        class="ops-in"
        id="pl-public-description"
        name="public_description"
        rows={10}
        required
        aria-invalid={errors.description ? "true" : undefined}
        aria-describedby={errors.description ? "pl-public-description-error" : undefined}
      >
        {description}
      </textarea>
      {errors.description ? (
        <p id="pl-public-description-error" class="ops-field-error">
          {tr(DESCRIPTION_ERROR[errors.description])}
        </p>
      ) : null}
    </div>
    <p class="ops-note">{tr("ops.board.wordingHelp")}</p>
  </>
);

type Props = {
  request: ClientRequest;
  publication: PublicationView;
  /** The base of the form actions: ".../requests/<id>/publication". */
  actionBase: string;
  /** The list filter as a query string ("" or "?public=pending&q=..."), added to every action so the filter survives the post (S-2). */
  query?: string;
  /** The board gate. Off: no Publish (the public page would answer 404) and a line saying so. */
  boardOn: boolean;
  form?: BoardFormState;
};

export const PublicListingBlock: FC<Props> = ({ request: r, publication: p, actionBase, query = "", boardOn, form }) => {
  const actions = opsBoardActions(p.status, r.status, boardOn);
  const publishable = actions.includes("publish");
  const waiting = p.status === "pending_review" && r.status === "pending_verification";
  const rejectable = actions.includes("reject");
  const editable = actions.includes("edit");
  const unpublishable = actions.includes("unpublish");
  // A lost race (conflict) shows the current state: nothing typed comes back and no reason box is opened (M-1). Parse errors (400) keep what was typed.
  const typed = form && !form.conflict ? form : undefined;
  const wordingState = typed && (typed.action === "publish" || typed.action === "edit") ? typed : undefined;
  const noteState = typed && (typed.action === "reject" || typed.action === "unpublish") ? typed : undefined;
  const title = wordingState?.values.title ?? p.publicTitle ?? r.title;
  const description = wordingState?.values.description ?? p.publicDescription ?? r.description;
  const wordingErrors = wordingState?.errors ?? {};
  const token = <input type="hidden" name="updated_at" value={p.updatedAt} />;
  const tn = translator("en");
  return (
    <section id="pl-block" class="ops-card ops-sec" aria-labelledby="pl-h">
      <h2 id="pl-h">{tr("ops.board.title")}</h2>
      <p class="ops-muted">{tr("ops.board.lead")}</p>
      {form ? <FormErrorSummary tr={tn} items={boardErrorItems(form)} /> : null}
      <dl class="ops-dl">
        <dt>{tr("ops.board.status")}</dt>
        <dd>
          <Pill tone={STATUS_TONE[p.status]} label={tr(`ops.board.status.${p.status}`)} />
        </dd>
        <dt>{tr("ops.board.optedIn")}</dt>
        <dd class="ops-mono">{utc(p.optedInAt)}</dd>
        {p.publishedAt ? (
          <>
            <dt>{tr("ops.board.publishedAt")}</dt>
            <dd class="ops-mono">{utc(p.publishedAt)}</dd>
          </>
        ) : null}
        {p.reviewedAt ? (
          <>
            <dt>{tr("ops.board.reviewedAt")}</dt>
            <dd class="ops-mono">{utc(p.reviewedAt)}</dd>
          </>
        ) : null}
        {p.endedAt ? (
          <>
            <dt>{tr("ops.board.endedAt")}</dt>
            <dd class="ops-mono">{utc(p.endedAt)}</dd>
          </>
        ) : null}
        {p.reviewNote ? (
          <>
            <dt>{tr("ops.board.reviewNote")}</dt>
            <dd>
              <PlainText text={p.reviewNote} />
            </dd>
          </>
        ) : null}
      </dl>

      <h3>{tr("ops.board.original")}</h3>
      <dl class="ops-dl">
        <dt>{tr("ops.board.originalTitle")}</dt>
        <dd>{r.title}</dd>
        <dt>{tr("ops.board.originalDescription")}</dt>
        <dd>
          <PlainText text={r.description} />
        </dd>
      </dl>

      <h3>{tr("ops.board.fixed")}</h3>
      <dl class="ops-dl">
        <dt>{tr("request.facts.category")}</dt>
        <dd>{tr(CATEGORY_KEY[r.category])}</dd>
        <dt>{tr("thread.budget")}</dt>
        <dd>{tr(BUDGET_KEY[r.budgetBand])}</dd>
        <dt>{tr("ops.board.country")}</dt>
        <dd>{r.country ? countryName("en", r.country) : "—"}</dd>
        <dt>{tr("thread.deadline")}</dt>
        <dd class="ops-mono">{r.deadline ?? "—"}</dd>
        <dt>{tr("request.facts.languages")}</dt>
        <dd>{r.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ") || "—"}</dd>
      </dl>

      {waiting ? <p class="ops-note">{tr("ops.board.waitingConfirm")}</p> : null}
      {!boardOn && p.status === "pending_review" && r.status !== "pending_verification" && r.status !== "removed" ? <p class="ops-note">{tr("ops.board.gateOff")}</p> : null}

      {actions.length > 0 ? (
        <>
          <p class="ops-note">{tr("ops.board.checklist")}</p>
          <ul class="ops-note pl-checklist">
            <li>{tr("ops.board.check.remove")}</li>
            <li>{tr("ops.board.check.confidential")}</li>
            <li>{tr("ops.board.check.combination")}</li>
            <li>{tr("ops.board.check.terms")}</li>
          </ul>
        </>
      ) : null}

      {publishable || editable ? (
        <>
          <form method="post" action={`${actionBase}/${publishable ? "publish" : "edit"}${query}`}>
            {token}
            <Wording title={title} description={description} errors={wordingErrors} />
            {publishable ? <p class="ops-note">{tr("ops.board.publishHelp")}</p> : null}
            <button class="ops-btn ops-btn-primary" type="submit">
              {tr(publishable ? "ops.board.publish" : "ops.board.saveEdit")}
            </button>
          </form>
        </>
      ) : null}

      {rejectable || unpublishable ? (
        <div class="ops-actions">
          <Confirm summary={tr(rejectable ? "ops.board.rejectOpen" : "ops.board.unpublishOpen")} open={noteState !== undefined}>
            <form method="post" action={`${actionBase}/${rejectable ? "reject" : "unpublish"}${query}`}>
              {token}
              <ReasonField id="pl-review-note" name="review_note" label={tr("ops.board.reason")} max={1000} required error={noteState?.errors.note ? tr(NOTE_ERROR[noteState.errors.note]) : null} value={noteState?.values.note} />
              <p class="ops-note">{tr(rejectable ? "ops.board.rejectHelp" : "ops.board.unpublishHelp")}</p>
              <button class="ops-btn ops-btn-danger" type="submit">
                {tr(rejectable ? "ops.board.rejectConfirm" : "ops.board.unpublishConfirm")}
              </button>
            </form>
          </Confirm>
        </div>
      ) : null}
    </section>
  );
};
