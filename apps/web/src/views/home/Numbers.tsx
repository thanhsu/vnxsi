import type { FC } from "hono/jsx";
import { REQUEST_DAYS, type NumberTile } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { formatCount } from "../format.ts";
import { NUMBER_LABEL } from "../labels.ts";

export const Numbers: FC<{ locale: Locale; tiles: readonly NumberTile[] }> = ({ locale, tiles }) => {
  const tr = translator(locale);
  return (
    <>
      <p class="home-note">{tr("home.updatedHourly")}</p>
      <ul class="home-numbers">
        {tiles.map((tile) => (
          <li data-stat={tile.key}>
            <strong>
              <span class="visually-hidden">{formatCount(locale, tile.value)}</span>
              <span aria-hidden="true" data-count={tile.value}>{formatCount(locale, tile.value)}</span>
            </strong>
            <span>{tr(NUMBER_LABEL[tile.key], { days: REQUEST_DAYS })}</span>
          </li>
        ))}
      </ul>
    </>
  );
};
