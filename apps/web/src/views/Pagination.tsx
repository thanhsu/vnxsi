import type { FC } from "hono/jsx";
import { PAGE_SIZE } from "../domain/catalog.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";

type Props = { locale: Locale; path: string; page: number; total: number; href: (page: number) => string };

/** Previous / next links; nothing when everything fits on one page. */
export const Pagination: FC<Props> = ({ locale, path, page, total, href }) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const tr = translator(locale);
  const url = (n: number) => localizedPath(locale, path) + href(n);
  return (
    <nav class="pager" aria-label={tr("pager.label")}>
      {page > 1 ? (
        <a href={url(page - 1)} rel="prev">
          {tr("pager.prev")}
        </a>
      ) : null}
      <span>{tr("pager.status", { page, pages })}</span>
      {page < pages ? (
        <a href={url(page + 1)} rel="next">
          {tr("pager.next")}
        </a>
      ) : null}
    </nav>
  );
};
