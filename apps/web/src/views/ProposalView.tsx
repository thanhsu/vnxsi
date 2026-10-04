import type { FC } from "hono/jsx";
import type { RequestInvite } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { PlainText } from "./PlainText.tsx";
import { proposalPrice } from "./proposal.ts";

/** A builder's proposal (spec §5.7 step 3), for the builder (Hub) and the client (/me, Task 6). */
export const ProposalView: FC<{ locale: Locale; invite: RequestInvite }> = ({ locale, invite }) => {
  const tr = translator(locale);
  return (
    <>
      <dl class="facts">
        <dt>{tr("proposal.price")}</dt>
        <dd>{proposalPrice(locale, invite)}</dd>
        {invite.priceNote ? (
          <>
            <dt>{tr("proposal.note")}</dt>
            <dd>{invite.priceNote}</dd>
          </>
        ) : null}
        <dt>{tr("proposal.timeline")}</dt>
        <dd>{tr("proposal.days", { n: invite.timelineDays ?? 0 })}</dd>
      </dl>
      {invite.approach ? <PlainText text={invite.approach} /> : null}
    </>
  );
};
