import type { FC } from "hono/jsx";
import { topBadge } from "../../domain/catalog.ts";
import { CATEGORIES } from "../../domain/product.ts";
import { REQUEST_DAYS, type TopProductsByCategory } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BADGE_KEY, CATEGORY_KEY } from "../labels.ts";

/** Per category, in the order the domain already fixed (badge, then recent inquiries, then newest); only categories with a product. */
export const TopProductsBlock: FC<{ locale: Locale; data: TopProductsByCategory }> = ({ locale, data }) => {
  const tr = translator(locale);
  const present = CATEGORIES.filter((c) => Boolean(data[c]?.length));
  return (
    <>
      <p class="home-note">{tr("home.products.order", { days: REQUEST_DAYS })}</p>
      <ul class="home-chips" aria-label={tr("home.products.title")}>
        {present.map((c) => (
          <li><a class="btn btn-ghost btn-sm" href={`#home-top-${c}`}>{tr(CATEGORY_KEY[c])}</a></li>
        ))}
      </ul>
      {present.map((c) => (
        <div class="home-group" id={`home-top-${c}`}>
          <h3>{tr(CATEGORY_KEY[c])}</h3>
          <ul class="home-tiles">
            {(data[c] ?? []).map((p) => {
              const badge = topBadge(p.badgeScore);
              return (
                <li class="home-tile lift">
                  <h4><a href={localizedPath(locale, `/p/${p.slug}`)}>{p.name}</a></h4>
                  <p class="muted">{tr("catalog.by", { name: p.builderName })}</p>
                  {badge ? <p><span class={`chip chip-${badge}`}>{tr(BADGE_KEY[badge])}</span></p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
};
