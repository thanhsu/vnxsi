import type { FC } from "hono/jsx";
import { builderFacingName, DECLINE_REASON_MAX } from "../../domain/inquiry.ts";
import { APPROACH_MAX, INVITE_TTL_MS, isTerminalRequest, PRICE_MODES, PRICE_NOTE_MAX, type Invitation, type InvitationListItem, type PriceMode, type ProposalErrors, type ProposalFieldError, type ProposalFormValues } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, INVITE_STATUS_KEY } from "../labels.ts";
import { ProposalView } from "../ProposalView.tsx";
import { RequestFacts } from "../RequestFacts.tsx";
import { HubLayout } from "./HubLayout.tsx";

const MODE_KEY: Record<PriceMode, MessageKey> = {
  fixed: "proposal.form.mode.fixed",
  range: "proposal.form.mode.range",
  discuss: "proposal.form.mode.discuss",
};
const ERROR_KEY: Record<ProposalFieldError, MessageKey> = {
  required: "inquiry.error.required",
  too_long: "inquiry.error.too_long",
  choice: "inquiry.error.choice",
  amount: "proposal.error.amount",
  range: "proposal.error.range",
  days: "proposal.error.days",
};

export const InvitationListPage: FC<{ locale: Locale; origin: string; items: InvitationListItem[] }> = ({ locale, origin, items }) => {
  const tr = translator(locale);
  return (
    <HubLayout locale={locale} origin={origin} title={tr("hub.invitations.title")} rest="/hub/invitations" active="invitations">
      <h1>{tr("hub.invitations.title")}</h1>
      {items.length === 0 ? (
        <p class="muted">{tr("hub.invitations.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <tbody>
              {items.map(({ invite, requestTitle, requestCategory }) => (
                <tr>
                  <td>
                    <a href={localizedPath(locale, `/hub/invitations/${invite.id}`)}>{requestTitle}</a>
                  </td>
                  <td>{tr(CATEGORY_KEY[requestCategory])}</td>
                  <td>
                    <span class="badge">{tr(INVITE_STATUS_KEY[invite.status])}</span>
                  </td>
                  <td class="muted">{invite.invitedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HubLayout>
  );
};

type PageProps = {
  locale: Locale;
  origin: string;
  item: Invitation;
  /** The signed-in builder is still `approved`: a suspended builder reads but cannot answer. */
  approved: boolean;
  values?: ProposalFormValues;
  errors?: ProposalErrors;
  reason?: string;
  reasonError?: boolean;
};

const EMPTY: ProposalFormValues = { approach: "", priceMode: "fixed", price: "", priceMax: "", priceNote: "", timelineDays: "" };

/** Spec §5.7 step 3: the builder reads the request (the client's typed name only, e-mail-like parts masked) and proposes or declines. */
export const InvitationPage: FC<PageProps> = (p) => {
  const tr = translator(p.locale);
  const { invite, request } = p.item;
  const base = localizedPath(p.locale, `/hub/invitations/${invite.id}`);
  const v = p.values ?? EMPTY;
  const errors = p.errors ?? {};
  const err = (field: keyof ProposalFormValues) => {
    const code = errors[field];
    return code ? (
      <p id={`pp-${field}-error`} class="error-msg" role="alert">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: keyof ProposalFormValues) => (errors[field] ? { "aria-invalid": "true", "aria-describedby": `pp-${field}-error` } : {});
  const answerable = p.approved && invite.status === "invited" && request.status === "matching";
  const replyBy = new Date(Date.parse(invite.invitedAt) + INVITE_TTL_MS).toISOString().slice(0, 10);
  const title = tr("hub.invitations.from", { name: builderFacingName(request.clientName) });
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={title} rest={`/hub/invitations/${invite.id}`} active="invitations">
      <p>
        <a href={localizedPath(p.locale, "/hub/invitations")}>{tr("hub.invitations.title")}</a>
      </p>
      <h1>{request.title}</h1>
      <p>
        {title} · <span class="badge">{tr(INVITE_STATUS_KEY[invite.status])}</span>
      </p>
      {answerable ? <p class="notice">{tr("hub.invitations.replyBy", { date: replyBy })}</p> : null}
      {isTerminalRequest(request.status) ? <p class="notice">{tr("hub.invitations.ended")}</p> : null}
      <section class="card wide">
        <RequestFacts locale={p.locale} request={request} showClient />
      </section>

      {invite.approach !== null ? (
        <section class="card wide">
          <h2>{tr("proposal.yours")}</h2>
          <ProposalView locale={p.locale} invite={invite} />
          {invite.status === "selected" && invite.inquiryId ? (
            <p>
              <a class="btn" href={localizedPath(p.locale, `/hub/inquiries/${invite.inquiryId}`)}>
                {tr("hub.invitations.inquiry")}
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      {answerable ? (
        <>
          <form method="post" action={`${base}/propose`} class="card wide">
            <h2>{tr("proposal.form.title")}</h2>
            <div class="field">
              <label for="pp-approach">{tr("proposal.approach")}</label>
              <textarea id="pp-approach" name="approach" required maxlength={APPROACH_MAX} {...aria("approach")}>
                {v.approach}
              </textarea>
              <p class="hint">{tr("proposal.form.approachHint")}</p>
              {err("approach")}
            </div>
            <fieldset class="field" {...aria("priceMode")}>
              <legend>{tr("proposal.form.priceMode")}</legend>
              {PRICE_MODES.map((m) => (
                <label class="choice">
                  <input type="radio" name="priceMode" value={m} checked={v.priceMode === m} required /> {tr(MODE_KEY[m])}
                </label>
              ))}
              {err("priceMode")}
            </fieldset>
            <div class="field">
              <label for="pp-price">{tr("proposal.form.price")}</label>
              <input id="pp-price" name="price" inputmode="numeric" value={v.price} {...aria("price")} />
              {err("price")}
            </div>
            <div class="field">
              <label for="pp-priceMax">{tr("proposal.form.priceMax")}</label>
              <input id="pp-priceMax" name="priceMax" inputmode="numeric" value={v.priceMax} {...aria("priceMax")} />
              {err("priceMax")}
            </div>
            <div class="field">
              <label for="pp-priceNote">{tr("proposal.note")}</label>
              <input id="pp-priceNote" name="priceNote" maxlength={PRICE_NOTE_MAX} value={v.priceNote} {...aria("priceNote")} />
              {err("priceNote")}
            </div>
            <div class="field">
              <label for="pp-timelineDays">{tr("proposal.timeline")}</label>
              <input id="pp-timelineDays" name="timelineDays" type="number" min={1} max={365} required value={v.timelineDays} {...aria("timelineDays")} />
              <p class="hint">{tr("proposal.form.timelineHint")}</p>
              {err("timelineDays")}
            </div>
            <button class="btn" type="submit">
              {tr("proposal.form.submit")}
            </button>
          </form>
          <form method="post" action={`${base}/decline`} class="card wide">
            <div class="field">
              <label for="pp-reason">{tr("proposal.form.declineReason")}</label>
              <textarea id="pp-reason" name="reason" maxlength={DECLINE_REASON_MAX} aria-invalid={p.reasonError ? "true" : undefined}>
                {p.reason ?? ""}
              </textarea>
              {p.reasonError ? (
                <p class="error-msg" role="alert">
                  {tr("inquiry.error.too_long")}
                </p>
              ) : null}
            </div>
            <button class="btn btn-secondary" type="submit">
              {tr("proposal.form.decline")}
            </button>
          </form>
        </>
      ) : null}
    </HubLayout>
  );
};
