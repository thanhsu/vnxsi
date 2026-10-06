import type { FC } from "hono/jsx";
import { topBadge, type CatalogItem } from "../domain/catalog.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";
import { BADGE_KEY, CATEGORY_KEY } from "./labels.ts";

/** A catalogue card. "Listed" is on every published product, so only checked badges are shown. */
export const ProductCard: FC<{ locale: Locale; item: CatalogItem; heading?: "h2" | "h3" }> = ({ locale, item, heading = "h2" }) => {
  const tr = translator(locale);
  const Heading = heading;
  const badge = topBadge(item.badgeScore);
  return (
    <li>
      {item.coverKey ? <img src={`/media/${item.coverKey}`} alt="" loading="lazy" /> : null}
      <Heading>
        <a href={localizedPath(locale, `/p/${item.slug}`)}>{item.name}</a>
      </Heading>
      <p>{item.tagline}</p>
      <p class="muted">
        {item.category ? `${tr(CATEGORY_KEY[item.category])} · ` : null}
        {tr("catalog.by", { name: item.builderName })}
      </p>
      <p class="price">{item.minPriceCents !== null ? tr("catalog.from", { amount: formatUsd(locale, item.minPriceCents) }) : tr("pricing.billing.contact")}</p>
      {badge && badge !== "listed" ? (
        <p>
          <span class="badge badge-published">{tr(BADGE_KEY[badge])}</span>
        </p>
      ) : null}
    </li>
  );
};
