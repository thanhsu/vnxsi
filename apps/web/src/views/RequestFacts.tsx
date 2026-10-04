import type { FC } from "hono/jsx";
import type { ClientRequest } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { builderFacingName } from "../domain/inquiry.ts";
import { translator } from "../i18n/t.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "./labels.ts";
import { PlainText } from "./PlainText.tsx";

/** The request as the client, the invited builders and the admin read it. Never shows an e-mail; `showClient` names the client the way a builder may see it. */
export const RequestFacts: FC<{ locale: Locale; request: ClientRequest; showClient?: boolean }> = ({ locale, request, showClient }) => {
  const tr = translator(locale);
  return (
    <>
      <dl class="facts">
        {showClient ? (
          <>
            <dt>{tr("request.facts.client")}</dt>
            <dd>{builderFacingName(request.clientName)}</dd>
          </>
        ) : null}
        <dt>{tr("request.facts.category")}</dt>
        <dd>{tr(CATEGORY_KEY[request.category])}</dd>
        <dt>{tr("thread.budget")}</dt>
        <dd>{tr(BUDGET_KEY[request.budgetBand])}</dd>
        {request.deadline ? (
          <>
            <dt>{tr("thread.deadline")}</dt>
            <dd>{request.deadline}</dd>
          </>
        ) : null}
        <dt>{tr("request.facts.languages")}</dt>
        <dd>{request.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</dd>
        {request.submittedAt ? (
          <>
            <dt>{tr("request.facts.submitted")}</dt>
            <dd>{request.submittedAt.slice(0, 10)}</dd>
          </>
        ) : null}
      </dl>
      <PlainText text={request.description} />
    </>
  );
};
