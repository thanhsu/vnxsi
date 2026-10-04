import type { FC } from "hono/jsx";
import type { BadgeKind, Category, ProductLang } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { Translate } from "../../i18n/t.ts";
import { formatUsd } from "../format.ts";
import { BADGE_KEY, CATEGORY_KEY, PRODUCT_LANG_KEY } from "../labels.ts";

/** The deck shows real products only once there are this many public ones (plan VNX-0709 §6); never a mix. */
export const DECK_SIZE = 3;

/** Invitation cards, in this order, while there are fewer than DECK_SIZE public products. */
export const DECK_CATEGORIES = ["booking", "crm", "ai_agents"] as const satisfies readonly Category[];

/** A public product on the deck: real data only, in the catalogue's neutral order. */
export type DeckProduct = {
  slug: string;
  name: string;
  tagline: string;
  category: Category | null;
  primaryLang: ProductLang;
  /** Cheapest priced tier; null when every tier is "contact". */
  minPriceCents: number | null;
  coverKey: string | null;
  /** Active badges, Listed first. */
  badges: BadgeKind[];
};

const ALL_BADGES: readonly BadgeKind[] = ["listed", "demo_verified", "in_production"];

/** Tints follow the artboard: blue, green, orange (by position, so three cards never share one). */
const TINTS = ["blue", "green", "orange"] as const;

const BadgeChips: FC<{ kinds: readonly BadgeKind[]; tr: Translate }> = ({ kinds, tr }) => (
  <>
    {kinds.map((kind) => (
      <span class={`chip chip-${kind}`}>{tr(BADGE_KEY[kind])}</span>
    ))}
  </>
);

/** A drawn "app screen": window dots, a sidebar and two text lines. Decorative only. */
const Shot: FC = () => (
  <div class="deck-shot" aria-hidden="true">
    <span class="deck-shot-dots">
      <i></i>
      <i></i>
      <i></i>
    </span>
    <span class="deck-shot-window">
      <span class="deck-shot-side"></span>
      <span class="deck-shot-lines">
        <i></i>
        <i></i>
        <i></i>
      </span>
    </span>
  </div>
);

const CategoryCard: FC<{ category: Category; slot: number; tr: Translate; builderHref: string }> = ({ category, slot, tr, builderHref }) => (
  <article class={`deck-card tint-${TINTS[slot]}`} data-kind="category" data-category={category} data-slot={String(slot)}>
    <div class="deck-card-top">
      <span>{tr(CATEGORY_KEY[category])}</span>
      <span>{tr("landing.deck.open")}</span>
    </div>
    <Shot />
    <div class="deck-card-body">
      <p class="deck-card-head">
        <span class="deck-card-title">{tr(CATEGORY_KEY[category])}</span>
        <span class="deck-card-meta">{tr("landing.deck.free")}</span>
      </p>
      <p class="deck-card-text">{tr("landing.deck.first")}</p>
      <p class="deck-badges">
        <span class="deck-badges-label">{tr("landing.deck.badges")}</span>
        <BadgeChips kinds={ALL_BADGES} tr={tr} />
      </p>
      <p class="deck-actions">
        <a class="btn btn-primary btn-sm" href={builderHref}>
          {tr("landing.deck.list")}
        </a>
        <a class="btn btn-ghost btn-sm" href="#notify">
          {tr("landing.cta.notify")}
        </a>
      </p>
    </div>
  </article>
);

const ProductDeckCard: FC<{ product: DeckProduct; slot: number; locale: Locale; tr: Translate }> = ({ product, slot, locale, tr }) => (
  <article class={`deck-card tint-${TINTS[slot]}`} data-kind="product" data-slot={String(slot)}>
    <div class="deck-card-top">
      <span>{product.category ? tr(CATEGORY_KEY[product.category]) : ""}</span>
      <span>{tr(PRODUCT_LANG_KEY[product.primaryLang])}</span>
    </div>
    {product.coverKey ? (
      <div class="deck-shot deck-cover">
        <img src={`/media/${product.coverKey}`} alt="" loading="lazy" />
      </div>
    ) : (
      <Shot />
    )}
    <div class="deck-card-body">
      <p class="deck-card-head">
        <span class="deck-card-title">{product.name}</span>
        <span class="deck-card-meta">
          {product.minPriceCents !== null ? tr("catalog.from", { amount: formatUsd(locale, product.minPriceCents) }) : tr("pricing.billing.contact")}
        </span>
      </p>
      <p class="deck-card-text">{product.tagline}</p>
      <p class="deck-badges">
        <BadgeChips kinds={ALL_BADGES.filter((kind) => product.badges.includes(kind))} tr={tr} />
      </p>
      <p class="deck-actions deck-actions-one">
        <a class="btn btn-primary btn-sm" href={localizedPath(locale, `/p/${product.slug}`)}>
          {tr("landing.deck.view")}
        </a>
      </p>
    </div>
  </article>
);

type DeckProps = { locale: Locale; tr: Translate; builderHref: string; products: readonly DeckProduct[] };

/**
 * Hero deck. Without JavaScript the first card is in front and the dot buttons stay hidden;
 * /assets/landing.js rotates the cards (data-slot) and reveals the dots.
 */
export const Deck: FC<DeckProps> = ({ locale, tr, builderHref, products }) => {
  const showProducts = products.length >= DECK_SIZE;
  const labels = showProducts ? products.slice(0, DECK_SIZE).map((p) => p.name) : DECK_CATEGORIES.map((c) => tr(CATEGORY_KEY[c]));
  return (
    <div class="deck" data-deck="">
      {showProducts
        ? products.slice(0, DECK_SIZE).map((product, slot) => <ProductDeckCard product={product} slot={slot} locale={locale} tr={tr} />)
        : DECK_CATEGORIES.map((category, slot) => <CategoryCard category={category} slot={slot} tr={tr} builderHref={builderHref} />)}
      <div class="deck-dots" hidden>
        {labels.map((label, i) => (
          <button type="button" aria-label={label} aria-pressed={i === 0 ? "true" : "false"}>
            <span></span>
          </button>
        ))}
      </div>
    </div>
  );
};
