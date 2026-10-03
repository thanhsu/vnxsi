import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { Layout } from "./Layout.tsx";

type Base = { locale: Locale; origin: string };

export const LoginPage: FC<Base & { email?: string; next?: string | null; error?: string }> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("login.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("login.title")}</h1>
        <p>{tr("login.intro")}</p>
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
              aria-invalid={props.error ? "true" : undefined}
              aria-describedby={props.error ? "email-error" : undefined}
            />
            {props.error ? (
              <p id="email-error" class="error-msg" role="alert">
                {props.error}
              </p>
            ) : null}
          </div>
          {props.next ? <input type="hidden" name="next" value={props.next} /> : null}
          <button class="btn" type="submit">
            {tr("login.submit")}
          </button>
        </form>
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

export const InvalidLinkPage: FC<Base> = (props) => {
  const tr = translator(props.locale);
  return (
    <Layout locale={props.locale} title={tr("auth.invalidLink.title")} origin={props.origin} rest="/login" noindex>
      <section class="card">
        <h1>{tr("auth.invalidLink.title")}</h1>
        <p>{tr("auth.invalidLink.body")}</p>
        <a class="btn" href={localizedPath(props.locale, "/login")}>
          {tr("auth.invalidLink.cta")}
        </a>
      </section>
    </Layout>
  );
};
