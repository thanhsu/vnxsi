import type { FC } from "hono/jsx";
import type { Locale } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator } from "../i18n/t.ts";
import { builderCtaHref, Layout } from "./Layout.tsx";
import { CHECK, Icon } from "./landing/Icon.tsx";

// Owner D2 (2026-10-05): only the approved landing copy. Adding a sentence here is a business decision, not an edit.
const PERKS = ["landing.builders.perk.free", "landing.builders.perk.tools", "landing.builders.perk.requests"] as const satisfies readonly MessageKey[];
const STEPS = [
  ["landing.builders.step.apply.title", "landing.builders.step.apply.body"],
  ["landing.builders.step.list.title", "landing.builders.step.list.body"],
  ["landing.builders.step.requests.title", "landing.builders.step.requests.body"],
] as const satisfies readonly (readonly [MessageKey, MessageKey])[];

export const ForBuildersPage: FC<{ locale: Locale; origin: string; signedIn: boolean }> = ({ locale, origin, signedIn }) => {
  const tr = translator(locale);
  return (
    <Layout locale={locale} title={`${tr("nav.forBuilders")} · VNX.SI`} description={tr("landing.builders.sub")} origin={origin} rest="/for-builders" signedIn={signedIn} fullWidth>
      <section class="lp-builders" aria-labelledby="builders-title">
        <div class="container lp-split lp-builders-inner">
          <div class="section-head">
            <p class="eyebrow">{tr("landing.builders.eyebrow")}</p>
            <h1 id="builders-title">{tr("landing.builders.title")}</h1>
            <p class="section-sub">{tr("landing.builders.sub")}</p>
            <ul class="lp-perks">
              {PERKS.map((perk) => (
                <li>
                  <Icon d={CHECK} size={20} width={2.5} />
                  <span>{tr(perk)}</span>
                </li>
              ))}
            </ul>
            <p class="lp-builders-cta">
              <a class="btn btn-light btn-lg" href={builderCtaHref(locale, signedIn)}>
                {tr("landing.builders.apply")}
              </a>
            </p>
          </div>
          <ol class="lp-steps">
            {STEPS.map(([title, body]) => (
              <li class="lp-step">
                <span class="lp-step-num" aria-hidden="true"></span>
                <span class="lp-step-body">
                  <strong>{tr(title)}</strong>
                  <span>{tr(body)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Layout>
  );
};
