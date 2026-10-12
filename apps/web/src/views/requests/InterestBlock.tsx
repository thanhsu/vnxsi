import type { FC } from "hono/jsx";
import { INTEREST_NOTE_MAX } from "../../domain/request-board.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";

/** What went wrong with an interest POST, as the route decides it: a field (`note`, `product`) or the form as a whole (`null`). `n` fills {n}. */
export type InterestProblem = { field: "note" | "product" | null; key: MessageKey; n?: number };

export type InterestValues = { note: string; productId: string };

/**
 * The call to action of addendum §4.2, decided by the route from the one visibility function and the viewer relation.
 * `own` carries the link to the client's own request page (the route builds it; the view never sees a request id).
 * `approved` is the builder who may express interest (VNX-2706a): the form while there is no interest and no invitation, else the state they are in.
 * `invited` carries the link to their invitation (from the invite id the viewer relation gives; the route builds it).
 */
export type Cta =
  | { kind: "signed_out"; next: string }
  | { kind: "not_builder" }
  | { kind: "pending_builder" }
  | { kind: "own"; href: string }
  | { kind: "approved"; state: "form"; products: readonly { id: string; name: string }[]; values: InterestValues }
  | { kind: "approved"; state: "pending" | "dismissed" | "withdrawn" }
  | { kind: "approved"; state: "invited"; href: string }
  | { kind: "closed" };

type Props = { locale: Locale; publicId: string; cta: Cta; problems: readonly InterestProblem[] };

/** Summary lines (VNX-0807), in page order: a field's line links to its input, a form-level one links nowhere. */
export function interestSummary(problems: readonly InterestProblem[], tr: Translate): FormErrorItem[] {
  return problems.map((p) => ({ href: p.field === "note" ? "#ib-note" : p.field === "product" ? "#ib-product" : "", message: tr(p.key, p.n === undefined ? undefined : { n: p.n }) }));
}

export const InterestBlock: FC<Props> = ({ locale, publicId, cta, problems }) => {
  const tr = translator(locale);
  const base = localizedPath(locale, `/requests/${publicId}`);
  const fieldError = (field: "note" | "product") => problems.find((p) => p.field === field);
  const noteError = fieldError("note");
  const productError = fieldError("product");
  return (
    <section class="card wide" aria-label={tr("board.cta.label")}>
      <FormErrorSummary tr={tr} items={interestSummary(problems, tr)} />
      {cta.kind === "signed_out" ? (
        <a class="btn" href={`${localizedPath(locale, "/login")}?next=${encodeURIComponent(cta.next)}`}>
          {tr("board.cta.signedOut")}
        </a>
      ) : null}
      {cta.kind === "not_builder" ? (
        <p>
          {tr("board.cta.notBuilder")} <a href={localizedPath(locale, "/for-builders")}>{tr("nav.forBuilders")}</a>
        </p>
      ) : null}
      {cta.kind === "pending_builder" ? <p>{tr("board.cta.pendingBuilder")}</p> : null}
      {cta.kind === "own" ? (
        <p>
          <a href={cta.href}>{tr("board.cta.ownRequest")}</a>
        </p>
      ) : null}
      {cta.kind === "closed" ? (
        <>
          <p>{tr("board.cta.closed")}</p>
          <a class="btn" href={localizedPath(locale, "/request")}>
            {tr("board.cta.post")}
          </a>
        </>
      ) : null}
      {cta.kind === "approved" && cta.state === "form" ? (
        <form method="post" action={`${base}/interest`}>
          <h2>{tr("board.interest.cta")}</h2>
          <p class="muted">{tr("board.interest.intro")}</p>
          <div class="field">
            <label for="ib-note">{tr("board.interest.label.note")}</label>
            <textarea id="ib-note" name="note" maxlength={INTEREST_NOTE_MAX} aria-invalid={noteError ? "true" : undefined} aria-describedby={noteError ? "ib-note-hint ib-note-error" : "ib-note-hint"}>
              {cta.values.note}
            </textarea>
            <p class="hint" id="ib-note-hint">
              {tr("board.interest.noteHint")}
            </p>
            {noteError ? (
              <p class="error-msg" id="ib-note-error">
                {tr(noteError.key)}
              </p>
            ) : null}
          </div>
          <div class="field">
            <label for="ib-product">{tr("board.interest.label.product")}</label>
            <select id="ib-product" name="productId" aria-invalid={productError ? "true" : undefined} aria-describedby={productError ? "ib-product-hint ib-product-error" : "ib-product-hint"}>
              <option value="">{tr("board.interest.noProduct")}</option>
              {cta.products.map((p) => (
                <option value={p.id} selected={cta.values.productId === p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p class="hint" id="ib-product-hint">
              {tr("board.interest.productHint")}
            </p>
            {productError ? (
              <p class="error-msg" id="ib-product-error">
                {tr(productError.key)}
              </p>
            ) : null}
          </div>
          <button class="btn" type="submit">
            {tr("board.interest.submit")}
          </button>
        </form>
      ) : null}
      {cta.kind === "approved" && cta.state === "pending" ? (
        <>
          <p>
            <strong>{tr("board.interest.sent")}</strong>
          </p>
          <p class="muted">{tr("board.interest.waiting")}</p>
          <form method="post" action={`${base}/interest/withdraw`}>
            <button class="btn btn-secondary" type="submit">
              {tr("board.interest.withdraw")}
            </button>
          </form>
        </>
      ) : null}
      {cta.kind === "approved" && cta.state === "invited" ? (
        <>
          <p>{tr("board.interest.invited")}</p>
          <a class="btn" href={cta.href}>
            {tr("board.interest.invitedLink")}
          </a>
        </>
      ) : null}
      {cta.kind === "approved" && cta.state === "dismissed" ? <p>{tr("board.interest.notInvited")}</p> : null}
      {cta.kind === "approved" && cta.state === "withdrawn" ? <p>{tr("board.interest.withdrawn")}</p> : null}
    </section>
  );
};
