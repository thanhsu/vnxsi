import type { FC } from "hono/jsx";
import { PRODUCT_INQUIRY_TYPES } from "../domain/inquiry.ts";
import type { Badge, PricingTier, ProductMedia, ProductWithBuilder } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";
import { BADGE_KEY, BILLING_KEY, CATEGORY_KEY, DELIVERY_KEY, INQUIRY_TYPE_KEY, LICENSE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

const EXTERNAL = "nofollow ugc noopener";

type Props = {
  locale: Locale;
  origin: string;
  item: ProductWithBuilder;
  tiers: PricingTier[];
  media: ProductMedia[];
  badges: Badge[];
  jsonLd: unknown;
  signedIn: boolean;
};

/** Spec §5.2. */
export const ProductPage: FC<Props> = ({ locale, origin, item, tiers, media, badges, jsonLd, signedIn }) => {
  const tr = translator(locale);
  const p = item.product;
  const cover = media[0] ? `${origin}/media/${media[0].r2Key}` : undefined;
  return (
    <Layout locale={locale} title={`${p.name} · VNX.SI`} description={p.tagline} origin={origin} rest={`/p/${p.slug}`} signedIn={signedIn} ogImage={cover} jsonLd={jsonLd}>
      <article class="product">
        <header>
          <p class="muted">
            {p.category ? tr(CATEGORY_KEY[p.category]) : null}
            {p.deliveryModel ? ` · ${tr(DELIVERY_KEY[p.deliveryModel])}` : null}
          </p>
          <h1>{p.name}</h1>
          <p class="lead">{p.tagline}</p>
          {badges.length > 0 ? (
            <ul class="chips">
              {badges.map((b) => (
                <li>
                  {tr(BADGE_KEY[b.kind])} <span class="muted">{tr("productPage.verifiedOn", { date: b.verifiedAt.slice(0, 10) })}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p class="row-actions">
            {p.demoUrl ? (
              <a href={`/go/p/${p.slug}/demo?src=product_page`} rel={EXTERNAL} class="btn" target="_blank">
                {tr("productPage.demo")}
              </a>
            ) : null}
            {p.websiteUrl ? (
              <a href={`/go/p/${p.slug}/site?src=product_page`} rel={EXTERNAL} target="_blank">
                {tr("productPage.website")}
              </a>
            ) : null}
          </p>
        </header>

        {media.length > 0 ? (
          <ul class="gallery">
            {media.map((m) => (
              <li>
                <img src={`/media/${m.r2Key}`} alt={m.alt || p.name} loading="lazy" />
              </li>
            ))}
          </ul>
        ) : null}

        <section>
          <h2>{tr("productPage.description")}</h2>
          <PlainText text={p.description} />
        </section>

        <section>
          <h2>{tr("productPage.problem")}</h2>
          <PlainText text={p.problem} />
          <h2>{tr("productPage.audience")}</h2>
          <PlainText text={p.targetUsers} />
        </section>

        <section>
          <h2>{tr("productPage.features")}</h2>
          <ul>
            {p.features.map((f) => (
              <li>{f}</li>
            ))}
          </ul>
          {p.techStack.length > 0 ? (
            <>
              <h3>{tr("productPage.techStack")}</h3>
              <ul class="chips">
                {p.techStack.map((t) => (
                  <li>{t}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section>
          <h2>{tr("productPage.pricing")}</h2>
          <ul class="tiers">
            {tiers.map((t) => (
              <li>
                <h3>{t.name}</h3>
                <p class="price">{t.priceCents === null ? tr(BILLING_KEY.contact) : `${formatUsd(locale, t.priceCents)} · ${tr(BILLING_KEY[t.billing])}`}</p>
                {t.description ? <p>{t.description}</p> : null}
              </li>
            ))}
          </ul>
          {p.license ? (
            <p>
              {tr("productPage.license")}: {tr(LICENSE_KEY[p.license])}
            </p>
          ) : null}
        </section>

        {p.customizable ? (
          <section>
            <h2>{tr("productPage.customization")}</h2>
            <PlainText text={p.customizationNotes} />
          </section>
        ) : null}

        <section>
          <h2>{tr("productPage.support")}</h2>
          <PlainText text={p.supportPolicy} />
        </section>

        <section>
          <h2>{tr("productPage.ask")}</h2>
          <p class="ask">
            {PRODUCT_INQUIRY_TYPES.filter((t) => t !== "customize" || p.customizable).map((t, i) => (
              <a class={i === 0 ? "btn" : "btn btn-secondary"} href={localizedPath(locale, `/p/${p.slug}/inquiry/${t}`)}>
                {tr(INQUIRY_TYPE_KEY[t])}
              </a>
            ))}
          </p>
        </section>
        <aside class="card">
          <p class="muted">{tr("productPage.builder")}</p>
          <p>
            <a href={localizedPath(locale, `/b/${item.builderHandle}`)}>{item.builderName}</a>
          </p>
        </aside>
      </article>
    </Layout>
  );
};
