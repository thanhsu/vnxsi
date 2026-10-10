import type { FC } from "hono/jsx";
import { type OAuthProvider, PROVIDER_NAME } from "../domain/identity.ts";
import { safeNext } from "../http/next.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "./FormErrorSummary.tsx";
import { Layout } from "./Layout.tsx";

type Base = { locale: Locale; origin: string };

/** Where a provider button goes. `lang` is the Locale id (case matters to `start`); `next` is re-checked and URL-encoded (VNX-2604c). */
export function oauthStartPath(provider: OAuthProvider, locale: Locale, next: string | null): string {
  const query = new URLSearchParams({ lang: locale });
  const safe = safeNext(next);
  if (safe) query.set("next", safe);
  return `/auth/oauth/${provider}/start?${query.toString()}`;
}

export const LoginPage: FC<Base & { email?: string; next?: string | null; error?: string; providers?: readonly OAuthProvider[] }> = (props) => {
  const tr = translator(props.locale);
  // The route passes one message for three outcomes. Only the bad-address message belongs to the field (linked, aria-invalid);
  // rate limit (429) and mail failure (502) are form-level: listed in the summary with no link and no mark on the field.
  // OAuth failures never come here: they have their own pages (OAuthNotLinkedPage, OAuthErrorPage), which carry no form.
  const fieldError = props.error !== undefined && props.error === tr("login.error.email");
  const summary: FormErrorItem[] = props.error ? [{ href: fieldError ? "#email" : "", message: props.error }] : [];
  return (
    <Layout locale={props.locale} title={tr("login.title")} origin={props.origin} rest="/login" noindex invalid={summary.length > 0}>
      <section class="card">
        <h1>{tr("login.title")}</h1>
        <p>{tr("login.intro")}</p>
        <FormErrorSummary tr={tr} items={summary} />
        <form method="post" action={localizedPath(props.locale, "/login")}>
          <div class="field">
            <label for="email">{tr("login.emailLabel")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              value={props.email ?? ""}
              aria-invalid={fieldError ? "true" : undefined}
              aria-describedby={fieldError ? "email-error" : undefined}
            />
            {fieldError ? (
              <p id="email-error" class="error-msg">
                {props.error}
              </p>
            ) : null}
          </div>
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <button class="btn" type="submit">
            {tr("login.submit")}
          </button>
        </form>
        {props.providers?.length ? (
          <div class="oauth">
            <p class="oauth-or">{tr("oauth.or")}</p>
            {props.providers.map((provider) => (
              <a class="btn btn-ghost" href={oauthStartPath(provider, props.locale, props.next ?? null)}>
                {tr("oauth.signInWith", { provider: PROVIDER_NAME[provider] })}
              </a>
            ))}
          </div>
        ) : null}
      </section>
    </Layout>
  );
};

export const LoginSentPage: FC<Base & { email: string }> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("login.sent.title")} origin={props.origin} rest="/login" noindex>
      <section class="card" role="status">
        <h1>{tr("login.sent.title")}</h1>
        <p>{tr("login.sent.body", { email: props.email })}</p>
      </section>
    </Layout>
  );
};

export const InvalidLinkPage: FC<Base & { hint?: "inquiry" | "request" }> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("auth.invalidLink.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("auth.invalidLink.title")}</h1>
        <p>{tr("auth.invalidLink.body")}</p>
        {props.hint === "inquiry" ? <p>{tr("auth.invalidLink.inquiryHint")}</p> : null}
        {props.hint === "request" ? <p>{tr("auth.invalidLink.requestHint", { place: tr("nav.me"), button: tr("me.sendNow") })}</p> : null}
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("auth.invalidLink.cta")}
        </a>
      </section>
    </Layout>
  );
};

const CONFIRM_KEYS = {
  login: { title: "auth.confirm.login.title", body: "auth.confirm.login.body", submit: "auth.confirm.login.submit" },
  inquiry: { title: "auth.confirm.inquiry.title", body: "auth.confirm.inquiry.body", submit: "auth.confirm.inquiry.submit" },
  request: { title: "auth.confirm.request.title", body: "auth.confirm.request.body", submit: "auth.confirm.request.submit" },
} as const;

/** VNX-0506: opening the e-mail link shows this page; only its button spends the token. */
export const ConfirmLinkPage: FC<Base & { token: string; next: string | null; purpose: "login" | "inquiry" | "request" }> = (props) => {
  const tr = translator(props.locale);
  const keys = CONFIRM_KEYS[props.purpose];
  return (
    <Layout locale={props.locale} title={tr(keys.title)} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr(keys.title)}</h1>
        <p>{tr(keys.body)}</p>
        <form method="post" action="/auth/verify">
          <input type="hidden" name="t" value={props.token} />
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <button class="btn" type="submit">
            {tr(keys.submit)}
          </button>
        </form>
      </section>
    </Layout>
  );
};

/** ADR-012 §3.2: the same bytes for every unlinked provider account. Takes no e-mail, label, id or request reference, so it cannot differ. */
export const OAuthNotLinkedPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("oauth.notLinked.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("oauth.notLinked.title")}</h1>
        <p>{tr("oauth.notLinked.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("oauth.cta.emailLink")}
        </a>
      </section>
    </Layout>
  );
};

/** One page for every other failure (bad state, denied, provider error, rate limit): it never says which. */
export const OAuthErrorPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("oauth.error.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("oauth.error.title")}</h1>
        <p>{tr("oauth.error.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("oauth.cta.emailLink")}
        </a>
      </section>
    </Layout>
  );
};

/** Decision 14 (R3): the one step between the "Link" button and the provider. One plain link, no script, no refresh; the only form is Layout's logout. */
export const OAuthLinkPage: FC<Base & { provider: OAuthProvider; authorizeUrl: string }> = (props) => {
  const tr = translator(props.locale);
  const provider = PROVIDER_NAME[props.provider];
  return (
    <Layout locale={props.locale} title={tr("me.identities.link", { provider })} origin={props.origin} rest="/me" noindex signedIn>
      <section class="card">
        <h1>{tr("me.identities.link", { provider })}</h1>
        <p>{tr("oauth.link.body", { provider })}</p>
        <a class="btn" href={props.authorizeUrl}>
          {tr("oauth.link.cta", { provider })}
        </a>
      </section>
    </Layout>
  );
};
