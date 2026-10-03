import type { FC } from "hono/jsx";
import type { Builder } from "../domain/builder.ts";
import type { PortfolioItem } from "../domain/portfolio.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { countryName } from "./country.ts";
import { formatUsd } from "./format.ts";
import { AVAILABILITY_KEY, KIND_KEY, LANGUAGE_KEY } from "./labels.ts";
import { Layout } from "./Layout.tsx";
import { PlainText } from "./PlainText.tsx";

const EXTERNAL = "nofollow ugc noopener";

type Props = { locale: Locale; origin: string; builder: Builder; portfolio: PortfolioItem[]; signedIn: boolean };

/** Products and the Hire button arrive with M3 and M5; nothing is rendered for them yet. */
export const BuilderProfilePage: FC<Props> = ({ locale, origin, builder, portfolio, signedIn }) => {
  const tr = translator(locale);
  return (
    <Layout locale={locale} title={`${builder.name} · VNX.SI`} description={builder.headline} origin={origin} rest={`/b/${builder.handle}`} signedIn={signedIn}>
      <article class="profile">
        <header>
          <h1>{builder.name}</h1>
          <p class="muted">
            @{builder.handle} · {tr(KIND_KEY[builder.kind])} · {countryName(locale, builder.country)}
          </p>
          <p class="lead">{builder.headline}</p>
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
