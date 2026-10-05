import type { FC } from "hono/jsx";
import { offerRel, showsDisclosure, type VisibleOffer } from "../domain/offer.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { DisclosureNote } from "./Disclosure.tsx";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

type Props = {
  locale: Locale;
  origin: string;
  merchant: { slug: string; name: string; description: string };
  offers: readonly VisibleOffer[];
  noindex: boolean;
  signedIn: boolean;
};

/** Default offer through the merchant's own /go/ address, every other offer by id. Never a partner URL; never a locale prefix. */
const goHref = (slug: string, o: VisibleOffer): string => (o.isDefault ? `/go/${slug}?src=tools` : `/go/o/${o.id}?src=tools`);

export const ToolPage: FC<Props> = ({ locale, origin, merchant, offers, noindex, signedIn }) => {
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
      </article>
    </Layout>
  );
};
