import type { FC } from "hono/jsx";
import { topBadge, type CatalogItem } from "../../domain/catalog.ts";
import { SPARK_DAYS, type TrendingItem } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatChange, PATH_LENGTH, SPARK_VIEWBOX, sparkPoints } from "../format.ts";
import { BADGE_KEY, CATEGORY_KEY } from "../labels.ts";

type TileMeta = { slug: string; name: string; tagline: string; category: CatalogItem["category"]; builderName: string };

const Meta: FC<{ locale: Locale; item: TileMeta }> = ({ locale, item }) => {
  const tr = translator(locale);
  return (
    <>
      <h3><a href={localizedPath(locale, `/p/${item.slug}`)}>{item.name}</a></h3>
      <p>{item.tagline}</p>
      <p class="muted">
        {item.category ? `${tr(CATEGORY_KEY[item.category])} · ` : null}
        {tr("catalog.by", { name: item.builderName })}
      </p>
    </>
  );
};

/** Rank = CSS counter on the ordered list; the score itself is not shown, only its 14-day shape and the change on the week before. */
export const Trending: FC<{ locale: Locale; items: readonly TrendingItem[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  return (
    <ol class="home-tiles home-ranked">
      {items.map((item) => (
        <li class="home-tile lift">
          <Meta locale={locale} item={item} />
          <p class="home-trend">
            <svg class="home-spark" viewBox={SPARK_VIEWBOX} role="img" aria-label={tr("home.trending.spark", { days: SPARK_DAYS })}>
              <polyline points={sparkPoints(item.sparkline)} pathLength={PATH_LENGTH} />
            </svg>
            {item.changePct !== null ? (
              <span>
                <strong>{formatChange(locale, item.changePct)}</strong> <span class="muted">{tr("home.trending.vsPrevious")}</span>
              </span>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
};

/** Shown in place of Trending: the newest first publications, newest first. */
export const Founding: FC<{ locale: Locale; items: readonly CatalogItem[] }> = ({ locale, items }) => {
  const tr = translator(locale);
  return (
    <ul class="home-tiles">
      {items.map((item) => {
        const badge = topBadge(item.badgeScore);
        return (
          <li class="home-tile lift">
            <Meta locale={locale} item={item} />
            {badge ? <p><span class={`chip chip-${badge}`}>{tr(BADGE_KEY[badge])}</span></p> : null}
          </li>
        );
      })}
    </ul>
  );
};
