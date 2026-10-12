import type { FC } from "hono/jsx";
import { publicExcerpt } from "../../domain/request-board.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";
import { Layout } from "../Layout.tsx";
import { PlainText } from "../PlainText.tsx";
import { InterestBlock, type Cta } from "./InterestBlock.tsx";
import type { BoardItem } from "./RequestCard.tsx";

type Props = { locale: Locale; origin: string; item: BoardItem; closed: boolean; cta: Cta; signedIn: boolean };

/**
 * /requests/:publicId (addendum §4.1, §4.2, §7.3). The public wording only, as plain text; a closed listing says "Closed" and nothing about how it
 * ended (no outcome, no counts). The page never carries the client, the original wording or any request id. A closed page stays out of the index.
 */
export const RequestDetail: FC<Props> = ({ locale, origin, item, closed, cta, signedIn }) => {
  const tr = translator(locale);
  const title = item.publicTitle ?? "";
  const description = item.publicDescription ?? "";
  return (
    <Layout locale={locale} title={`${title} · VNX.SI`} description={publicExcerpt(description)} origin={origin} rest={`/requests/${item.publicId}`} noindex={closed} signedIn={signedIn}>
      <p>
        <a href={localizedPath(locale, "/requests")}>{tr("board.detail.back")}</a>
      </p>
      <h1>{title}</h1>
      <p>
        <span class={closed ? "badge" : "badge badge-published"}>{closed ? tr("board.status.closed") : tr("board.status.open")}</span>
      </p>
      {closed ? <p class="notice">{tr("board.detail.closedNote")}</p> : null}
      <section class="card wide">
        <dl class="facts">
          <dt>{tr("board.detail.category")}</dt>
          <dd>{tr(CATEGORY_KEY[item.category])}</dd>
          <dt>{tr("board.detail.budget")}</dt>
          <dd>{tr(BUDGET_KEY[item.budgetBand])}</dd>
          {item.country ? (
            <>
              <dt>{tr("board.detail.country")}</dt>
              <dd>{countryName(locale, item.country)}</dd>
            </>
          ) : null}
          <dt>{tr("board.detail.deadline")}</dt>
          <dd>{item.deadline ?? tr("board.deadline.none")}</dd>
          <dt>{tr("board.detail.languages")}</dt>
          <dd>{item.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</dd>
          {item.publishedAt ? (
            <>
              <dt>{tr("board.detail.posted")}</dt>
              <dd>{item.publishedAt.slice(0, 10)}</dd>
            </>
          ) : null}
        </dl>
        <PlainText text={description} />
        <p class="muted">{tr("board.detail.identityNote")}</p>
      </section>
      <InterestBlock locale={locale} cta={cta} />
    </Layout>
  );
};
