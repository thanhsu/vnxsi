import type { FC } from "hono/jsx";
import type { Utm, WaitlistErrors } from "../domain/waitlist-input.ts";
import { ContactForm, emptyFeedbackValues } from "./contact/ContactForm.tsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { Deck, type DeckProduct } from "./landing/Deck.tsx";
import { builderCtaHref, Layout } from "./Layout.tsx";

export { builderCtaHref };

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
  /** First public products in the neutral catalogue order; fewer than three shows the category cards. */
  deck: readonly DeckProduct[];
  /** The "Ask us" block (VNX-0710): ?asked=1 shows the thank-you notice; the form posts to /contact. */
  ask: { asked: boolean; siteKey: string | null; email: string };
};

/** schema.org Organization (plan VNX-0708): no logo, sameAs or ratings. */
export function organizationJsonLd(origin: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name: "VNX.SI", url: `${origin}/` };
}

/** Stroke icons, one set (audit §2.7). Decorative: the text next to them carries the meaning. */
const Icon: FC<{ d: readonly string[]; size?: number; width?: number; circles?: readonly (readonly [number, number, number])[]; rects?: readonly (readonly [number, number, number, number, number])[] }> = ({
  d,
  size = 22,
  width = 1.6,
  circles = [],
  rects = [],
}) => (
  <svg class="icon" viewBox="0 0 24 24" width={size} height={size} stroke-width={width} aria-hidden="true" focusable="false">
    {rects.map(([x, y, w, h, r]) => (
      <rect x={x} y={y} width={w} height={h} rx={r} />
    ))}
    {circles.map(([cx, cy, r]) => (
      <circle cx={cx} cy={cy} r={r} />
    ))}
    {d.map((path) => (
      <path d={path} />
    ))}
  </svg>
);

const CHECK = ["M5 12l5 5L20 7"];
const ARROW = ["M5 12h14M13 6l6 6-6 6"];

const PRINCIPLES = [
  { title: "landing.principles.verify.title", body: "landing.principles.verify.body", icon: { d: ["M12 3l7 3v6c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z", "M9 12l2 2 4-4"] } },
  { title: "landing.principles.ranking.title", body: "landing.principles.ranking.body", icon: { d: ["M4 20V10M10 20V4M16 20v-7M22 20H2"] } },
  { title: "landing.principles.direct.title", body: "landing.principles.direct.body", icon: { d: ["M10.5 9.5l4 4.5"], circles: [[8, 8, 3], [17, 16, 3]] } },
  { title: "landing.principles.languages.title", body: "landing.principles.languages.body", icon: { d: ["M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.5 5 7M11 5c-.7 3.4-3.2 6.4-6 8", "M12 21l4.5-10L21 21M13.5 18h6"] } },
] as const satisfies readonly { title: MessageKey; body: MessageKey; icon: unknown }[];

const WAYS = [
  { title: "landing.ways.buy.title", body: "landing.ways.buy.body", tone: "blue", icon: { d: ["M6 7h12l-1 13H7z", "M9 7a3 3 0 016 0"] } },
  {
    title: "landing.ways.customize.title",
    body: "landing.ways.customize.body",
    tone: "green",
    icon: { d: ["M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"], circles: [[16, 6, 2], [10, 12, 2], [18, 18, 2]] },
  },
  { title: "landing.ways.hire.title", body: "landing.ways.hire.body", tone: "orange", icon: { d: ["M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"], circles: [[12, 8, 4]] } },
  {
    title: "landing.ways.similar.title",
    body: "landing.ways.similar.body",
    tone: "ink",
    icon: { d: ["M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"], rects: [[8, 8, 12, 12, 2]] },
  },
] as const satisfies readonly { title: MessageKey; body: MessageKey; tone: string; icon: unknown }[];

// Badge colours follow 05-UI-SCOPE: Listed grey, Demo verified blue, In production green.
const TRUST = [
  { badge: "badge.listed", kind: "listed", body: "landing.trust.listed" },
  { badge: "badge.demo_verified", kind: "demo_verified", body: "landing.trust.demo" },
  { badge: "badge.in_production", kind: "in_production", body: "landing.trust.production" },
] as const satisfies readonly { badge: MessageKey; kind: string; body: MessageKey }[];

const PERKS = ["landing.builders.perk.free", "landing.builders.perk.tools", "landing.builders.perk.requests"] as const satisfies readonly MessageKey[];

const STEPS = [
  ["landing.builders.step.apply.title", "landing.builders.step.apply.body"],
  ["landing.builders.step.list.title", "landing.builders.step.list.body"],
  ["landing.builders.step.requests.title", "landing.builders.step.requests.body"],
] as const satisfies readonly (readonly [MessageKey, MessageKey])[];

/** Tool names stay as written in every locale (plan VNX-0709 §8). */
const TOOLS = ["Claude", "Codex", "Gemini", "Cursor", "Lovable", "Replit"];

export const LandingPage: FC<Props> = ({ locale, origin, signedIn, joined, utm, referrer, form, deck, ask }) => {
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
  const belt = (copy: boolean) => (
    <>
      <span class="eyebrow belt-label" aria-hidden={copy ? "true" : undefined}>
        {tr("landing.builders.belt")}
      </span>
      {TOOLS.map((tool) => (
        <span aria-hidden={copy ? "true" : undefined}>{tool}</span>
      ))}
      <span class="belt-own" aria-hidden={copy ? "true" : undefined}>
        {tr("landing.builders.beltOwn")}
      </span>
    </>
  );
  return (
    <Layout
      locale={locale}
      title={tr("landing.meta.title")}
      description={tr("landing.meta.description")}
      origin={origin}
      rest="/"
      signedIn={signedIn}
      jsonLd={organizationJsonLd(origin)}
      fullWidth
      scripts={["/assets/landing.js"]}
    >
      <section class="lp-hero" aria-labelledby="hero-title">
        <div class="lp-hero-grid" aria-hidden="true"></div>
        <div class="container lp-hero-inner">
          <div class="lp-hero-copy">
            <p class="pill reveal">
              <span class="pill-dot" aria-hidden="true">
                <span class="ping"></span>
              </span>
              {tr("landing.hero.pill")}
            </p>
            <h1 id="hero-title" class="display reveal d1">
              {tr("landing.hero.title")}
            </h1>
            <p class="lead reveal d2">{tr("landing.hero.lead")}</p>
            <p class="cta-row reveal d3">
              <a class="btn btn-primary btn-lg" href={builderHref}>
                {tr("landing.cta.builder")}
                <Icon d={ARROW} size={18} width={2} />
              </a>
              <a class="btn btn-ghost btn-lg" href="#notify">
                {tr("landing.cta.notify")}
              </a>
            </p>
            <p class="lp-hero-note reveal d4">{tr("site.rankings")}</p>
          </div>
          <div class="lp-hero-deck reveal d2">
            <Deck locale={locale} tr={tr} builderHref={builderHref} products={deck} />
          </div>
        </div>
      </section>

      <section class="lp-principles">
        <ul class="container lp-principles-list">
          {PRINCIPLES.map((p) => (
            <li class="lp-principle reveal-scroll">
              <Icon {...p.icon} />
              <span>
                <strong>{tr(p.title)}</strong>
                <span>{tr(p.body)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" class="lp-section lp-how" aria-labelledby="how-title">
        <div class="container">
          <div class="section-head reveal-scroll">
            <p class="eyebrow">{tr("landing.how.eyebrow")}</p>
            <h2 id="how-title">{tr("landing.how.title")}</h2>
          </div>
          <ul class="lp-ways">
            {WAYS.map((way) => (
              <li class={`lp-way reveal-scroll lift tone-${way.tone}`}>
                <span class="lp-way-top">
                  <span class="icon-tile">
                    <Icon {...way.icon} width={2} />
                  </span>
                  <span class="lp-num" aria-hidden="true"></span>
                </span>
                <h3>{tr(way.title)}</h3>
                <p>{tr(way.body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="trust" class="lp-section lp-trust" aria-labelledby="trust-title">
        <div class="container lp-split">
          <div class="section-head reveal-scroll">
            <p class="eyebrow eyebrow-green">{tr("landing.trust.eyebrow")}</p>
            <h2 id="trust-title">{tr("landing.trust.title")}</h2>
            <p class="section-sub">{tr("landing.trust.sub")}</p>
          </div>
          <ol class="lp-trust-list">
            {TRUST.map((item) => (
              <li class="lp-trust-item reveal-scroll">
                <span class="lp-num" aria-hidden="true"></span>
                <span class="lp-trust-body">
                  <span class={`chip chip-lg chip-${item.kind}`}>
                    <Icon d={CHECK} size={13} width={2.5} />
                    {tr(item.badge)}
                  </span>
                  <span>{tr(item.body)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="builders" class="lp-builders" aria-labelledby="builders-title">
        <div class="container lp-split lp-builders-inner">
          <div class="section-head reveal-scroll">
            <p class="eyebrow">{tr("landing.builders.eyebrow")}</p>
            <h2 id="builders-title">{tr("landing.builders.title")}</h2>
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
              <a class="btn btn-light btn-lg" href={builderHref}>
                {tr("landing.builders.apply")}
              </a>
            </p>
          </div>
          <ol class="lp-steps">
            {STEPS.map(([title, body]) => (
              <li class="lp-step reveal-scroll">
                <span class="lp-step-num" aria-hidden="true"></span>
                <span class="lp-step-body">
                  <strong>{tr(title)}</strong>
                  <span>{tr(body)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div class="belt">
          <div class="belt-track">
            {belt(false)}
            {belt(true)}
          </div>
        </div>
      </section>

      <section id="notify" class="lp-section lp-final" aria-labelledby="notify-title">
        <div class="container lp-final-inner reveal-scroll">
          <h2 id="notify-title">{tr("landing.final.title")}</h2>
          <p class="section-sub">{tr("landing.final.body")}</p>
          <p>
            {tr("landing.clients.request")} <a href={localizedPath(locale, "/request")}>{tr("request.cta")}</a>
          </p>
          {joined ? (
            <p class="notice good" role="status">
              {tr("landing.form.joined")}
            </p>
          ) : (
            <form method="post" action={`${localizedPath(locale, "/waitlist")}#notify`} class="waitlist-form">
              <div class="waitlist-row">
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
                    placeholder={tr("landing.form.email")}
                    aria-invalid={emailError ? "true" : undefined}
                    aria-describedby={emailError ? "waitlist-email-error" : undefined}
                  />
                  {emailError ? (
                    <p id="waitlist-email-error" class="error-msg" role="alert">
                      {emailError}
                    </p>
                  ) : null}
                </div>
                <button class="btn btn-primary btn-lg" type="submit">
                  {tr("landing.form.submit")}
                </button>
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
            </form>
          )}
          <p class="cta-row lp-final-links">
            <a class="btn btn-ghost" href={localizedPath(locale, "/builders")}>
              {tr("landing.final.findBuilder")}
            </a>
            <a class="btn btn-ghost" href={builderHref}>
              {tr("landing.cta.builder")}
            </a>
          </p>
        </div>
      </section>

      <section id="ask" class="lp-section lp-ask" aria-labelledby="ask-title">
        <div class="container lp-split">
          <div class="section-head reveal-scroll">
            <p class="eyebrow">{tr("landing.ask.eyebrow")}</p>
            <h2 id="ask-title">{tr("landing.ask.title")}</h2>
            <p class="section-sub">{tr("landing.ask.lead")}</p>
          </div>
          <div class="contact-card">
            {ask.asked ? (
              <p class="notice good" role="status">
                {tr("contact.sent")}
              </p>
            ) : (
              <ContactForm locale={locale} from="landing" values={emptyFeedbackValues("landing", ask.email)} errors={{}} signedIn={signedIn} siteKey={ask.siteKey} />
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};
