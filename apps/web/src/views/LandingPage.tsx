import type { FC } from "hono/jsx";
import type { Utm, WaitlistErrors } from "../domain/waitlist-input.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { Layout } from "./Layout.tsx";

/** Echo of a rejected waitlist POST. */
export type LandingForm = { email: string; consent?: boolean; errors?: WaitlistErrors; rateLimited?: boolean };

type Props = {
  locale: Locale;
  origin: string;
  signedIn: boolean;
  joined: boolean;
  utm: Utm;
  /** External host the visitor came from, carried to the POST in the `ref` hidden input. */
  referrer: string | null;
  form?: LandingForm;
};

const WAYS = ["buy", "customize", "hire", "similar"] as const;
// Colours follow 05-UI-SCOPE: Listed grey, Demo verified blue, In production green.
const BADGES = [
  { key: "landing.badges.listed", tone: "listed" },
  { key: "landing.badges.demo", tone: "demo" },
  { key: "landing.badges.production", tone: "production" },
] as const satisfies readonly { key: MessageKey; tone: string }[];

/** schema.org Organization (plan VNX-0708): no logo, sameAs or ratings. */
export function organizationJsonLd(origin: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name: "VNX.SI", url: `${origin}/` };
}

/** Signed-out visitors sign in first and land on the builder application (spec §5.3). */
export function builderCtaHref(locale: Locale, signedIn: boolean): string {
  if (signedIn) return localizedPath(locale, "/hub");
  return `${localizedPath(locale, "/login")}?next=${encodeURIComponent(localizedPath(locale, "/hub/apply"))}`;
}

export const LandingPage: FC<Props> = ({ locale, origin, signedIn, joined, utm, referrer, form }) => {
  const tr = translator(locale);
  const builderHref = builderCtaHref(locale, signedIn);
  const emailError = form?.errors?.email ? tr("landing.form.error.email") : null;
  const consentError = form?.errors?.consent ? tr("landing.form.error.consent") : null;
  const hidden: [string, string | null][] = [
    ["utm_source", utm.utmSource],
    ["utm_medium", utm.utmMedium],
    ["utm_campaign", utm.utmCampaign],
    ["ref", referrer],
  ];
  return (
    <Layout
      locale={locale}
      title={tr("landing.meta.title")}
      description={tr("landing.meta.description")}
      origin={origin}
      rest="/"
      signedIn={signedIn}
      jsonLd={organizationJsonLd(origin)}
    >
      <div class="landing">
        <section class="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">{tr("landing.hero.title")}</h1>
          <p class="lead">{tr("landing.hero.client")}</p>
          <p class="lead">{tr("landing.hero.builder")}</p>
          <p class="cta-row">
            <a class="btn" href={builderHref}>
              {tr("landing.cta.builder")}
            </a>
            <a class="btn btn-secondary" href="#notify">
              {tr("landing.cta.notify")}
            </a>
          </p>
        </section>

        <section aria-labelledby="ways-title">
          <h2 id="ways-title">{tr("landing.ways.title")}</h2>
          <ul class="ways">
            {WAYS.map((way) => (
              <li>
                <h3>{tr(`landing.ways.${way}.title`)}</h3>
                <p>{tr(`landing.ways.${way}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="badges-title">
          <h2 id="badges-title">{tr("landing.badges.title")}</h2>
          <p>{tr("landing.badges.intro")}</p>
          <ul class="badge-list">
            {BADGES.map((b) => (
              <li class={`tone-${b.tone}`}>{tr(b.key)}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="builders-title">
          <h2 id="builders-title">{tr("landing.builders.title")}</h2>
          <p>{tr("landing.builders.body")}</p>
          <p class="cta-row">
            <a class="btn" href={builderHref}>
              {tr("landing.cta.builder")}
            </a>
          </p>
          <p class="muted">{tr("landing.builders.invite")}</p>
        </section>

        <section id="notify" aria-labelledby="notify-title">
          <h2 id="notify-title">{tr("landing.clients.title")}</h2>
          <p>{tr("landing.clients.body")}</p>
          <p>
            {tr("landing.clients.request")} <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
          {joined ? (
            <p class="notice good" role="status">
              {tr("landing.form.joined")}
            </p>
          ) : (
            <form method="post" action={`${localizedPath(locale, "/waitlist")}#notify`} class="waitlist-form">
              <div class="field">
                <label for="waitlist-email">{tr("landing.form.email")}</label>
                <input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  maxlength={254}
                  value={form?.email ?? ""}
                  aria-invalid={emailError ? "true" : undefined}
                  aria-describedby={emailError ? "waitlist-email-error" : undefined}
                />
                {emailError ? (
                  <p id="waitlist-email-error" class="error-msg" role="alert">
                    {emailError}
                  </p>
                ) : null}
              </div>
              <div class="field">
                <div class="choice">
                  <input
                    id="waitlist-consent"
                    name="consent"
                    type="checkbox"
                    required
                    checked={form?.consent === true}
                    aria-invalid={consentError ? "true" : undefined}
                    aria-describedby={consentError ? "waitlist-consent-error" : undefined}
                  />
                  <label for="waitlist-consent">{tr("landing.form.consent")}</label>
                </div>
                {consentError ? (
                  <p id="waitlist-consent-error" class="error-msg" role="alert">
                    {consentError}
                  </p>
                ) : null}
              </div>
              {/* Honeypot: off-screen, hidden from assistive tech and out of the tab order. */}
              <div class="hp" aria-hidden="true">
                <input name="website" type="text" tabindex={-1} autocomplete="off" />
              </div>
              {hidden.map(([name, value]) => (value ? <input type="hidden" name={name} value={value} /> : null))}
              {form?.rateLimited ? (
                <p class="error-msg" role="alert">
                  {tr("landing.form.error.rateLimited")}
                </p>
              ) : null}
              <button class="btn" type="submit">
                {tr("landing.form.submit")}
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="principle-title">
          <h2 id="principle-title">{tr("landing.principle.title")}</h2>
          <p>{tr("landing.principle.body")}</p>
        </section>
      </div>
    </Layout>
  );
};
