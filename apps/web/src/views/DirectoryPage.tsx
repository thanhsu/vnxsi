import type { FC } from "hono/jsx";
import { AVAILABILITIES, WORK_LANGUAGES } from "../domain/builder.ts";
import { MAX_QUERY_CHARS, type Paged } from "../domain/catalog.ts";
import { directorySearchParams, isDirectoryFiltered, type DirectoryEntry, type DirectoryQuery } from "../domain/directory.ts";
import { CATEGORIES } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BuilderCard } from "./BuilderCard.tsx";
import { countryName } from "./country.ts";
import { AVAILABILITY_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { Pagination } from "./Pagination.tsx";
import { SelectFilter } from "./SelectFilter.tsx";

type Props = { locale: Locale; origin: string; query: DirectoryQuery; result: Paged<DirectoryEntry>; countries: string[]; signedIn: boolean };

/** Spec §5.2 directory, with the "Post a request" entry point (Owner decision 2026-10-04, M6). */
export const DirectoryPage: FC<Props> = ({ locale, origin, query, result, countries, signedIn }) => {
  const tr = translator(locale);
  const filtered = isDirectoryFiltered(query);
  const countryOptions = countries.map((code) => ({ value: code, label: countryName(locale, code) })).sort((a, b) => a.label.localeCompare(b.label, locale));
  return (
    <Layout
      locale={locale}
      title={`${tr("directory.title")} · VNX.SI`}
      description={tr("directory.description")}
      origin={origin}
      rest={`/builders${directorySearchParams(query, query.page)}`}
      noindex={filtered}
      signedIn={signedIn}
    >
      <h1>{tr("directory.title")}</h1>
      <p class="cta-row">
        {tr("directory.request")}{" "}
        <a class="btn btn-secondary" href={localizedPath(locale, "/request")}>
          {tr("request.cta")}
        </a>
      </p>
      <form class="filters" method="get" action={localizedPath(locale, "/builders")} role="search">
        <div class="field">
          <label for="d-q">{tr("directory.search")}</label>
          <input id="d-q" type="search" name="q" value={query.q} maxlength={MAX_QUERY_CHARS} />
        </div>
        <SelectFilter id="d-category" name="category" label={tr("directory.filter.category")} any={tr("filter.any")} value={query.category} options={CATEGORIES.map((v) => ({ value: v, label: tr(CATEGORY_KEY[v]) }))} />
        <SelectFilter id="d-lang" name="lang" label={tr("directory.filter.lang")} any={tr("filter.any")} value={query.lang} options={WORK_LANGUAGES.map((v) => ({ value: v, label: tr(LANGUAGE_KEY[v]) }))} />
        <SelectFilter id="d-country" name="country" label={tr("directory.filter.country")} any={tr("filter.any")} value={query.country} options={countryOptions} />
        <SelectFilter id="d-availability" name="availability" label={tr("directory.filter.availability")} any={tr("filter.any")} value={query.availability} options={AVAILABILITIES.map((v) => ({ value: v, label: tr(AVAILABILITY_KEY[v]) }))} />
        <p class="row-actions">
          <button type="submit" class="btn">
            {tr("filter.apply")}
          </button>
          {filtered ? <a href={localizedPath(locale, "/builders")}>{tr("filter.clear")}</a> : null}
        </p>
      </form>
      <p class="muted">
        {tr("filter.results", { n: result.total })} · {tr("directory.ranking")}
      </p>
      {result.items.length > 0 ? (
        <ul class="cards">
          {result.items.map((e) => (
            <BuilderCard locale={locale} entry={e} />
          ))}
        </ul>
      ) : (
        <p class="notice">{tr("directory.empty")}</p>
      )}
      <Pagination locale={locale} path="/builders" page={query.page} total={result.total} href={(n) => directorySearchParams(query, n)} />
    </Layout>
  );
};
