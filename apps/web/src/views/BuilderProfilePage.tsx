import type { FC } from "hono/jsx";
import type { Builder } from "../domain/builder.ts";
import { PROVIDER_NAME, type PublicBadge } from "../domain/identity.ts";
import type { PortfolioItem } from "../domain/portfolio.ts";
import type { Product } from "../domain/product.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { countryName } from "./country.ts";
import { formatUsd } from "./format.ts";
import { AVAILABILITY_KEY, KIND_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

const EXTERNAL = "nofollow ugc noopener";
const BADGE_REL = "nofollow noopener noreferrer";

type Props = { locale: Locale; origin: string; builder: Builder; portfolio: PortfolioItem[]; products: Product[]; badges: PublicBadge[]; signedIn: boolean };

/** Spec §5.2 builder profile. */
export const BuilderProfilePage: FC<Props> = ({ locale, origin, builder, portfolio, products, badges, signedIn }) => {
  const tr = translator(locale);
  return (
    <Layout locale={locale} title={`${builder.name} · VNX.SI`} description={builder.headline} origin={origin} rest={`/b/${builder.handle}`} signedIn={signedIn}>
      <article class="profile">
        <header>
          <h1>{builder.name}</h1>
          <p class="muted">
            @{builder.handle} · {tr(KIND_KEY[builder.kind])} · {countryName(locale, builder.country)}
          </p>
          {badges.length > 0 ? (
            <ul class="verified-list" aria-label={tr("bprofile.verified.heading")}>
              {badges.map((b) =>
                b.provider === "github" ? (
                  <li class="verified">
                    <a href={b.url} rel={BADGE_REL} target="_blank">
                      @{b.login}
                    </a>{" "}
                    <span>{tr("bprofile.verifiedVia", { provider: PROVIDER_NAME.github })}</span>
                  </li>
                ) : (
                  <li class="verified">
                    <span>{tr("bprofile.verifiedVia", { provider: PROVIDER_NAME.linkedin })}</span>
                  </li>
                ),
              )}
            </ul>
          ) : null}
          <p class="lead">{builder.headline}</p>
          <p class="ask">
            <a class="btn" href={localizedPath(locale, `/b/${builder.handle}/hire`)}>
              {tr("bprofile.hire", { name: builder.name })}
            </a>
          </p>
          <p>
            <span class={`badge badge-avail-${builder.availability}`}>{tr(AVAILABILITY_KEY[builder.availability])}</span>
            {builder.hourlyRateCents !== null ? <span class="rate">{tr("bprofile.rate", { amount: formatUsd(locale, builder.hourlyRateCents) })}</span> : null}
          </p>
          {builder.websiteUrl ? (
            <p>
              <a href={builder.websiteUrl} rel={EXTERNAL} target="_blank">
                {tr("bprofile.website")}
              </a>
            </p>
          ) : null}
        </header>

        <PlainText text={builder.bio} />

        <dl class="facts">
          <dt>{tr("bprofile.skills")}</dt>
          <dd>
            <ul class="chips">
              {builder.skills.map((s) => (
                <li>{s}</li>
              ))}
            </ul>
          </dd>
          {builder.aiTools.length > 0 ? (
            <>
              <dt>{tr("bprofile.aiTools")}</dt>
              <dd>
                <ul class="chips">
                  {builder.aiTools.map((s) => (
                    <li>{s}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {builder.workLanguages.length > 0 ? (
            <>
              <dt>{tr("bprofile.languages")}</dt>
              <dd>{builder.workLanguages.map((l) => tr(LANGUAGE_KEY[l])).join(", ")}</dd>
            </>
          ) : null}
        </dl>

        {products.length > 0 ? (
          <section>
            <h2>{tr("bprofile.products")}</h2>
            <ul class="portfolio-list">
              {products.map((p) => (
                <li>
                  <h3>
                    <a href={localizedPath(locale, `/p/${p.slug}`)}>{p.name}</a>
                  </h3>
                  <p>{p.tagline}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {portfolio.length > 0 ? (
          <section>
            <h2>{tr("bprofile.portfolio")}</h2>
            <ul class="portfolio-list">
              {portfolio.map((item) => (
                <li>
                  <h3>
                    {item.url ? (
                      <a href={item.url} rel={EXTERNAL} target="_blank">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  {item.description ? <PlainText text={item.description} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </Layout>
  );
};
