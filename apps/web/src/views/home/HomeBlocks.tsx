import type { FC } from "hono/jsx";
import type { CatalogItem } from "../../domain/catalog.ts";
import type { HomeView } from "../../domain/public-stats.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { HomeSection } from "./HomeSection.tsx";
import { Live } from "./Live.tsx";
import { MarketPulse } from "./MarketPulse.tsx";
import { Numbers } from "./Numbers.tsx";
import { TopBuildersBlock } from "./TopBuilders.tsx";
import { TopProductsBlock } from "./TopProducts.tsx";
import { Founding, Trending } from "./Trending.tsx";

export type HomeBlocksProps = { locale: Locale; view: HomeView<CatalogItem>; now: Date };

/** The data blocks under the landing (Owner A2). Which blocks show was decided by `homeView`; with none, nothing prints. */
export const HomeBlocks: FC<HomeBlocksProps> = ({ locale, view, now }) => {
  const tr = translator(locale);
  const blocks = [
    view.numbers ? <HomeSection id="home-numbers" title={tr("home.numbers.title")}><Numbers locale={locale} tiles={view.numbers} /></HomeSection> : null,
    view.live ? <HomeSection id="home-live" title={tr("home.live.title")}><Live locale={locale} events={view.live} now={now} /></HomeSection> : null,
    view.trending ? <HomeSection id="home-trending" title={tr("home.trending.title")}><Trending locale={locale} items={view.trending} /></HomeSection> : null,
    view.founding ? <HomeSection id="home-founding" title={tr("home.founding.title")}><Founding locale={locale} items={view.founding} /></HomeSection> : null,
    view.pulse ? <HomeSection id="home-pulse" title={tr("home.pulse.title")}><MarketPulse locale={locale} {...view.pulse} /></HomeSection> : null,
    view.builders ? <HomeSection id="home-builders" title={tr("home.builders.title")}><TopBuildersBlock locale={locale} data={view.builders} /></HomeSection> : null,
    view.products ? <HomeSection id="home-products" title={tr("home.products.title")}><TopProductsBlock locale={locale} data={view.products} /></HomeSection> : null,
  ].filter((b) => b !== null);
  return blocks.length ? <>{blocks}</> : null;
};
