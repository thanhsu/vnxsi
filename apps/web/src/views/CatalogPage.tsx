import type { FC } from "hono/jsx";
import { catalogSearchParams, FILTER_BADGES, isCatalogFiltered, MAX_QUERY_CHARS, type CatalogItem, type CatalogQuery, type Paged } from "../domain/catalog.ts";
import { CATEGORIES, DELIVERY_MODELS, PRODUCT_LANGS } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BADGE_KEY, CATEGORY_KEY, DELIVERY_KEY, PRODUCT_LANG_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { Pagination } from "./Pagination.tsx";
import { ProductCard } from "./ProductCard.tsx";
import { SelectFilter } from "./SelectFilter.tsx";

type Props = { locale: Locale; origin: string; query: CatalogQuery; result: Paged<CatalogItem>; signedIn: boolean };

const usd = (cents: number | null) => (cents === null ? "" : String(cents / 100));

/** Spec §5.2 catalogue; an empty result offers "Post a request" (Owner decision 2026-10-04, M6). */
export const CatalogPage: FC<Props> = ({ locale, origin, query, result, signedIn }) => {
  const tr = translator(locale);
  const filtered = isCatalogFiltered(query);
  return (
    <Layout
      locale={locale}
      title={`${tr("catalog.title")} · VNX.SI`}
      description={tr("catalog.description")}
      origin={origin}
      rest={`/products${catalogSearchParams(query, query.page)}`}
      noindex={filtered}
      signedIn={signedIn}
    >
      <h1>{tr("catalog.title")}</h1>
      <form class="filters" method="get" action={localizedPath(locale, "/products")} role="search">
        <div class="field">
          <label for="f-q">{tr("catalog.search")}</label>
          <input id="f-q" type="search" name="q" value={query.q} maxlength={MAX_QUERY_CHARS} />
        </div>
        <SelectFilter id="f-category" name="category" label={tr("catalog.filter.category")} any={tr("filter.any")} value={query.category} options={CATEGORIES.map((v) => ({ value: v, label: tr(CATEGORY_KEY[v]) }))} />
        <SelectFilter id="f-delivery" name="delivery" label={tr("catalog.filter.delivery")} any={tr("filter.any")} value={query.delivery} options={DELIVERY_MODELS.map((v) => ({ value: v, label: tr(DELIVERY_KEY[v]) }))} />
        <SelectFilter id="f-badge" name="badge" label={tr("catalog.filter.badge")} any={tr("filter.any")} value={query.badge} options={FILTER_BADGES.map((v) => ({ value: v, label: tr(BADGE_KEY[v]) }))} />
        <SelectFilter id="f-lang" name="lang" label={tr("catalog.filter.lang")} any={tr("filter.any")} value={query.lang} options={PRODUCT_LANGS.map((v) => ({ value: v, label: tr(PRODUCT_LANG_KEY[v]) }))} />
        <div class="field">
          <label for="f-min">{tr("catalog.filter.min")}</label>
          <input id="f-min" name="min" inputmode="decimal" value={usd(query.minCents)} />
        </div>
        <div class="field">
          <label for="f-max">{tr("catalog.filter.max")}</label>
          <input id="f-max" name="max" inputmode="decimal" value={usd(query.maxCents)} />
        </div>
        <p class="row-actions">
          <button type="submit" class="btn">
            {tr("filter.apply")}
          </button>
          {filtered ? <a href={localizedPath(locale, "/products")}>{tr("filter.clear")}</a> : null}
        </p>
      </form>
      <p class="muted">
        {tr("filter.results", { n: result.total })} · {tr("catalog.ranking")}
      </p>
      {result.items.length > 0 ? (
        <ul class="cards">
          {result.items.map((item) => (
            <ProductCard locale={locale} item={item} />
          ))}
        </ul>
      ) : (
        <div class="notice">
          <p>{tr("catalog.empty")}</p>
          <p>
            {tr("catalog.request")} <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
        </div>
      )}
      <Pagination locale={locale} path="/products" page={query.page} total={result.total} href={(n) => catalogSearchParams(query, n)} />
    </Layout>
  );
};
