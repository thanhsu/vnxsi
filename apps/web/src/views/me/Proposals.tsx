import type { FC } from "hono/jsx";
import type { ClientRequest, InviteWithBuilder } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { ProposalView } from "../ProposalView.tsx";

/** Spec §5.4 / §5.7 step 4: the proposals of a request; the client picks one while it is matching and its builder is still public. */
export const Proposals: FC<{ locale: Locale; request: ClientRequest; proposals: InviteWithBuilder[] }> = ({ locale, request, proposals }) => {
  const tr = translator(locale);
  const shown = proposals.filter(({ invite }) => invite.approach !== null && (invite.status === "proposed" || invite.status === "selected" || invite.status === "not_selected"));
  const matching = request.status === "matching";
  if (shown.length === 0 && !matching) return null;
  const action = localizedPath(locale, `/me/requests/${request.id}/select`);
  return (
    <section>
      <h2>{tr("me.proposals.title")}</h2>
      {shown.length === 0 ? <p class="muted">{tr("me.proposals.empty")}</p> : null}
      {shown.length > 0 && matching ? <p class="hint">{tr("me.proposals.chooseHint")}</p> : null}
      {shown.map(({ invite, builderName, builderHandle, builderPublic }) => (
        <section class="card wide">
          <h3>{builderPublic ? <a href={localizedPath(locale, `/b/${builderHandle}`)}>{tr("me.proposals.from", { name: builderName })}</a> : tr("me.proposals.from", { name: builderName })}</h3>
          <ProposalView locale={locale} invite={invite} />
          {invite.status === "selected" ? (
            <p class="notice good">
              {tr("me.proposals.chosen")} {invite.inquiryId ? <a href={localizedPath(locale, `/me/inquiries/${invite.inquiryId}`)}>{tr("me.proposals.inquiry")}</a> : null}
            </p>
          ) : null}
          {matching && invite.status === "proposed" ? (
            builderPublic ? (
              <form method="post" action={action}>
                <input type="hidden" name="invite" value={invite.id} />
                <button class="btn" type="submit">
                  {tr("me.proposals.choose")}
                </button>
              </form>
            ) : (
              <p class="muted">{tr("me.proposals.unavailable")}</p>
            )
          ) : null}
        </section>
      ))}
    </section>
  );
};
