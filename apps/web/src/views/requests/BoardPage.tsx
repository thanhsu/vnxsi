import type { FC } from "hono/jsx";
import { BUDGET_BANDS } from "../../domain/inquiry.ts";
import { WORK_LANGUAGES } from "../../domain/builder.ts";
import { CATEGORIES } from "../../domain/product.ts";
import { BOARD_PAGE_SIZE, type BoardQuery } from "../../domain/request-board.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";
import { Layout } from "../Layout.tsx";
import { Pagination } from "../Pagination.tsx";
import { SelectFilter } from "../SelectFilter.tsx";
import { RequestCard, type BoardItem } from "./RequestCard.tsx";

type Props = { locale: Locale; origin: string; query: BoardQuery; items: readonly BoardItem[]; total: number; signedIn: boolean };

/** The query string of a page: only the filters that are set, then the page number past the first. Never a sort. */
export function boardParams(query: BoardQuery, page: number): string {
  const p = new URLSearchParams();
  if (query.category) p.set("category", query.category);
  if (query.budget) p.set("budget", query.budget);
  if (query.lang) p.set("lang", query.lang);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * /requests (addendum §4.1): open listings, newest publication first, one order. The three filters are a GET form that works without script.
 * Indexing rules (the five-listing threshold, canonical, sitemap) are VNX-2705b's; until then the list stays out of the index.
 */
export const BoardPage: FC<Props> = ({ locale, origin, query, items, total, signedIn }) => {
  const tr = translator(locale);
  const filtered = query.category !== null || query.budget !== null || query.lang !== null;
  return (
    <Layout locale={locale} title={`${tr("board.title")} · VNX.SI`} description={tr("board.intro")} origin={origin} rest={`/requests${boardParams(query, query.page)}`} noindex signedIn={signedIn}>
      <h1>{tr("board.title")}</h1>
      <p>{tr("board.intro")}</p>
      <form class="filters" method="get" action={localizedPath(locale, "/requests")} role="search">
        <SelectFilter id="f-category" name="category" label={tr("board.filter.category")} any={tr("board.filter.any")} value={query.category} options={CATEGORIES.map((v) => ({ value: v, label: tr(CATEGORY_KEY[v]) }))} />
        <SelectFilter id="f-budget" name="budget" label={tr("board.filter.budget")} any={tr("board.filter.any")} value={query.budget} options={BUDGET_BANDS.map((v) => ({ value: v, label: tr(BUDGET_KEY[v]) }))} />
        <SelectFilter id="f-lang" name="lang" label={tr("board.filter.language")} any={tr("board.filter.any")} value={query.lang} options={WORK_LANGUAGES.map((v) => ({ value: v, label: tr(LANGUAGE_KEY[v]) }))} />
        <p class="row-actions">
          <button type="submit" class="btn">
            {tr("board.filter.apply")}
          </button>
          {filtered ? <a href={localizedPath(locale, "/requests")}>{tr("filter.clear")}</a> : null}
        </p>
      </form>
      {items.length > 0 ? (
        <ul class="cards">
          {items.map((item) => (
            <RequestCard locale={locale} item={item} />
          ))}
        </ul>
      ) : (
        <div class="notice">
          <p>
            <strong>{tr("board.empty.title")}</strong>
          </p>
          <p>{tr("board.empty.body")}</p>
          <p class="row-actions">
            <a class="btn" href={localizedPath(locale, "/request")}>
              {tr("board.cta.post")}
            </a>
            <a href={localizedPath(locale, "/products")}>{tr("board.cta.products")}</a>
          </p>
        </div>
      )}
      <Pagination locale={locale} path="/requests" page={query.page} total={total} pageSize={BOARD_PAGE_SIZE} href={(n) => boardParams(query, n)} />
    </Layout>
  );
};
