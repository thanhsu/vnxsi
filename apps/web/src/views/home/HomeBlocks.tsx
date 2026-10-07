import type { FC } from "hono/jsx";
import type { CatalogItem } from "../../domain/catalog.ts";
import type { HomeView } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { HomeSection } from "./HomeSection.tsx";
import { Numbers } from "./Numbers.tsx";
import { Founding, Trending } from "./Trending.tsx";

export type HomeBlocksProps = { locale: Locale; view: HomeView<CatalogItem> };

/** The data blocks under the landing (Owner A2). Which blocks show was decided by `homeView`; with none, nothing prints. */
export const HomeBlocks: FC<HomeBlocksProps> = ({ locale, view }) => {
  const tr = translator(locale);
  const blocks = [
    view.numbers ? <HomeSection id="home-numbers" title={tr("home.numbers.title")}><Numbers locale={locale} tiles={view.numbers} /></HomeSection> : null,
    view.trending ? <HomeSection id="home-trending" title={tr("home.trending.title")}><Trending locale={locale} items={view.trending} /></HomeSection> : null,
    view.founding ? <HomeSection id="home-founding" title={tr("home.founding.title")}><Founding locale={locale} items={view.founding} /></HomeSection> : null,
  ].filter((b) => b !== null);
  return blocks.length ? <>{blocks}</> : null;
};
