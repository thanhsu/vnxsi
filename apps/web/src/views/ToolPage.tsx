import type { FC } from "hono/jsx";
import type { CatalogItem } from "../domain/catalog.ts";
import type { DirectoryEntry } from "../domain/directory.ts";
import { offerRel, showsDisclosure, type VisibleOffer } from "../domain/offer.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { BuilderCard } from "./BuilderCard.tsx";
import { DisclosureNote } from "./Disclosure.tsx";
import { builderCtaHref, Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";
import { ProductCard } from "./ProductCard.tsx";

type Props = {
  locale: Locale;
  origin: string;
  merchant: { slug: string; name: string; description: string };
  offers: readonly VisibleOffer[];
  /** Public products and builders that name this tool, already in the catalogue's and the directory's own order. */
  products: readonly CatalogItem[];
  builders: readonly DirectoryEntry[];
  noindex: boolean;
  signedIn: boolean;
};

/** Default offer through the merchant's own /go/ address, every other offer by id. Never a partner URL; never a locale prefix. */
const goHref = (slug: string, o: VisibleOffer): string => (o.isDefault ? `/go/${slug}?src=tools` : `/go/o/${o.id}?src=tools`);

export const ToolPage: FC<Props> = ({ locale, origin, merchant, offers, products, builders, noindex, signedIn }) => {
  const tr = translator(locale);
  const description = merchant.description.replace(/\s+/g, " ").trim().slice(0, 160);
  return (
    <Layout locale={locale} title={`${merchant.name} · VNX.SI`} description={description || undefined} origin={origin} rest={`/tools/${merchant.slug}`} noindex={noindex} signedIn={signedIn}>
      <article class="tool">
        <h1>{merchant.name}</h1>
        {merchant.description !== "" ? (
          <div lang={locale === "en" ? undefined : "en"}>
            <PlainText text={merchant.description} />
          </div>
        ) : null}
        {offers.length > 0 ? (
          <section class="offers" aria-labelledby="tool-offers">
            <h2 id="tool-offers">{tr("tools.offers", { name: merchant.name })}</h2>
            {showsDisclosure(offers) ? <DisclosureNote locale={locale} /> : null}
            <p class="row-actions">
              {offers.map((o) => (
                <a class={o.isDefault ? "btn btn-primary" : "btn btn-secondary"} href={goHref(merchant.slug, o)} rel={offerRel(o)} target="_blank">
                  {tr(`offer.label.${o.label}`, { name: merchant.name })}
                </a>
              ))}
            </p>
          </section>
        ) : null}
        {products.length > 0 ? (
          <section class="tool-products" aria-labelledby="tool-products">
            <h2 id="tool-products">{tr("tools.products.title", { name: merchant.name })}</h2>
            <ul class="cards">
              {products.map((item) => (
                <ProductCard locale={locale} item={item} heading="h3" />
              ))}
            </ul>
          </section>
        ) : null}
        {builders.length > 0 ? (
          <section class="tool-builders" aria-labelledby="tool-builders">
            <h2 id="tool-builders">{tr("tools.builders.title", { name: merchant.name })}</h2>
            <ul class="cards">
              {builders.map((entry) => (
                <BuilderCard locale={locale} entry={entry} heading="h3" />
              ))}
            </ul>
          </section>
        ) : null}
        <section class="tool-cta">
          <div class="card">
            <h2>{tr("tools.request.title", { name: merchant.name })}</h2>
            <p>{tr("tools.request.body")}</p>
            <a class="btn btn-secondary" href={localizedPath(locale, "/request")}>
              {tr("request.cta")}
            </a>
          </div>
          <div class="card">
            <h2>{tr("tools.builder.title", { name: merchant.name })}</h2>
            <p>{tr("tools.builder.body")}</p>
            <a class="btn btn-primary" href={builderCtaHref(locale, signedIn)}>
              {tr("landing.cta.builder")}
            </a>
          </div>
        </section>
      </article>
    </Layout>
  );
};
