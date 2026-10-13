import type { FC } from "hono/jsx";
import type { BudgetBand } from "../../domain/inquiry.ts";
import type { WorkLanguage } from "../../domain/builder.ts";
import type { Category } from "../../domain/product.ts";
import { publicExcerpt } from "../../domain/request-board.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { countryName } from "../country.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";

/** What a card may know: the public text and the public fields. No request id, no client, no counts (addendum §7). Structural: the route passes a PublicListing. */
export type BoardItem = {
  publicId: string;
  publicTitle: string | null;
  publicDescription: string | null;
  publishedAt: string | null;
  category: Category;
  budgetBand: BudgetBand;
  country: string | null;
  deadline: string | null;
  languages: readonly WorkLanguage[];
};

/** One open listing in /requests. Plain text only: the title and the excerpt are escaped text. */
export const RequestCard: FC<{ locale: Locale; item: BoardItem }> = ({ locale, item }) => {
  const tr = translator(locale);
  return (
    <li>
      <h2>
        <a href={localizedPath(locale, `/requests/${item.publicId}`)}>{item.publicTitle}</a>
      </h2>
      <p>{publicExcerpt(item.publicDescription ?? "")}</p>
      <p class="muted">
        {tr(CATEGORY_KEY[item.category])} · {tr(BUDGET_KEY[item.budgetBand])}
        {item.country ? ` · ${countryName(locale, item.country)}` : null}
      </p>
      <p class="muted">{item.languages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</p>
      <p class="muted">
        {item.deadline ? `${tr("board.card.deadline")}: ${item.deadline}` : tr("board.deadline.none")}
        {item.publishedAt ? ` · ${tr("board.card.posted")}: ${item.publishedAt.slice(0, 10)}` : null}
      </p>
    </li>
  );
};
