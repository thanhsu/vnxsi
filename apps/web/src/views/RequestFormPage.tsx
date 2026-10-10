import type { FC } from "hono/jsx";
import { WORK_LANGUAGES } from "../domain/builder.ts";
import { BUDGET_BANDS } from "../domain/inquiry.ts";
import { CATEGORIES } from "../domain/product.ts";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, type RequestErrors, type RequestFieldError, type RequestFormValues } from "../domain/request.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { translator, type Translate } from "../i18n/t.ts";
import { BUDGET_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "./labels.ts";
import { FormErrorSummary, type FormErrorItem } from "./FormErrorSummary.tsx";
import { Layout } from "./Layout.tsx";

const ERROR_KEY: Record<RequestFieldError, MessageKey> = {
  required: "inquiry.error.required",
  too_short: "request.error.too_short",
  too_long: "inquiry.error.too_long",
  choice: "inquiry.error.choice",
  date: "inquiry.error.date",
  email: "inquiry.error.email",
  invalid: "inquiry.error.invalid",
};

type Props = {
  locale: Locale;
  origin: string;
  signedIn: boolean;
  values: RequestFormValues;
  errors: RequestErrors;
  /** null when signed out and Turnstile is not configured: the form is not offered (fail closed). */
  siteKey: string | null;
  formError?: string;
};

/** Summary lines in page order (VNX-0807): the form-level error first, then each field error linked to its input. */
export function requestErrorItems(p: Pick<Props, "errors" | "formError" | "signedIn">, tr: Translate): FormErrorItem[] {
  const items: FormErrorItem[] = p.formError ? [{ href: "", message: p.formError }] : [];
  const fields: [keyof RequestErrors, string, MessageKey][] = [
    ["title", "rq-title", "request.form.titleField"],
    ["description", "rq-description", "request.form.descriptionField"],
    ["category", "rq-category", "request.form.category"],
    ["budgetBand", "rq-budget", "inquiry.form.budget"],
    ["deadline", "rq-deadline", "inquiry.form.deadline"],
    ["languages", "rq-languages", "request.form.languages"],
    ["name", "rq-name", "inquiry.form.name"],
    ["email", p.signedIn ? "" : "rq-email", "inquiry.form.email"],
  ];
  for (const [field, id, label] of fields) {
    const code = p.errors[field];
    if (code) items.push({ href: id ? `#${id}` : "", message: `${tr(label)}: ${tr(ERROR_KEY[code])}` });
  }
  return items;
}

/** Spec §5.7 step 1. A public page (in the sitemap); the request itself is never public. */
export const RequestFormPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const title = tr("request.form.title");
  const summary = requestErrorItems(p, tr);
  const err = (field: keyof RequestErrors) => {
    const code = p.errors[field];
    return code ? (
      <p id={`rq-${field}-error`} class="error-msg">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: keyof RequestErrors) => (p.errors[field] ? { "aria-invalid": "true", "aria-describedby": `rq-${field}-error` } : {});
  const blocked = !p.signedIn && p.siteKey === null;
  return (
    <Layout locale={p.locale} title={`${title} · VNX.SI`} description={tr("request.form.intro")} origin={p.origin} rest="/request" signedIn={p.signedIn} invalid={summary.length > 0}>
      <section class="card wide">
        <h1>{title}</h1>
        <p>{tr("request.form.intro")}</p>
        <FormErrorSummary tr={tr} items={summary} />
        {blocked ? (
          <p class="notice">
            {tr("request.form.unavailable")} <a href={localizedPath(p.locale, `/login?next=${encodeURIComponent(localizedPath(p.locale, "/request"))}`)}>{tr("nav.signIn")}</a>
          </p>
        ) : (
          <form method="post" action={localizedPath(p.locale, "/request")}>
            <div class="field">
              <label for="rq-title">{tr("request.form.titleField")}</label>
              <input id="rq-title" name="title" required maxlength={TITLE_MAX} value={p.values.title} {...aria("title")} />
              <p class="hint">{tr("request.form.titleHint")}</p>
              {err("title")}
            </div>
            <div class="field">
              <label for="rq-description">{tr("request.form.descriptionField")}</label>
              <textarea id="rq-description" name="description" required minlength={DESCRIPTION_MIN} maxlength={DESCRIPTION_MAX} {...aria("description")}>
                {p.values.description}
              </textarea>
              <p class="hint">{tr("request.form.descriptionHint")}</p>
              {err("description")}
            </div>
            <div class="field">
              <label for="rq-category">{tr("request.form.category")}</label>
              <select id="rq-category" name="category" required {...aria("category")}>
                <option value="">{tr("request.form.choose")}</option>
                {CATEGORIES.map((v) => (
                  <option value={v} selected={v === p.values.category}>
                    {tr(CATEGORY_KEY[v])}
                  </option>
                ))}
              </select>
              {err("category")}
            </div>
            <div class="field">
              <label for="rq-budget">{tr("inquiry.form.budget")}</label>
              <select id="rq-budget" name="budgetBand" required {...aria("budgetBand")}>
                {BUDGET_BANDS.map((b) => (
                  <option value={b} selected={b === p.values.budgetBand}>
                    {tr(BUDGET_KEY[b])}
                  </option>
                ))}
              </select>
              {err("budgetBand")}
            </div>
            <div class="field">
              <label for="rq-deadline">{tr("inquiry.form.deadline")}</label>
              <input id="rq-deadline" name="deadline" type="date" value={p.values.deadline} {...aria("deadline")} />
              {err("deadline")}
            </div>
            <fieldset class="field" {...aria("languages")}>
              <legend>{tr("request.form.languages")}</legend>
              {WORK_LANGUAGES.map((l, i) => (
                <label class="choice">
                  <input type="checkbox" id={i === 0 ? "rq-languages" : undefined} name="languages" value={l} checked={p.values.languages.includes(l)} /> {tr(LANGUAGE_KEY[l])}
                </label>
              ))}
              {err("languages")}
            </fieldset>
            <div class="field">
              <label for="rq-name">{tr("inquiry.form.name")}</label>
              <input id="rq-name" name="name" required maxlength={80} autocomplete="name" value={p.values.name} {...aria("name")} />
              {err("name")}
            </div>
            {p.signedIn ? null : (
              <div class="field">
                <label for="rq-email">{tr("inquiry.form.email")}</label>
                <input id="rq-email" name="email" type="email" required autocomplete="email" value={p.values.email} {...aria("email")} />
                <p class="hint">{tr("request.form.emailHint")}</p>
                {err("email")}
              </div>
            )}
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div class="hp" aria-hidden="true">
              <label for="rq-website">{tr("inquiry.form.website")}</label>
              <input id="rq-website" name="website" tabindex={-1} autocomplete="off" value="" />
            </div>
            {p.signedIn ? null : (
              <>
                <div class="cf-turnstile" data-sitekey={p.siteKey ?? ""}></div>
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
              </>
            )}
            <button class="btn" type="submit">
              {tr("request.form.submit")}
            </button>
          </form>
        )}
      </section>
    </Layout>
  );
};

export const RequestSentPage: FC<{ locale: Locale; origin: string; email: string }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("inquiry.sent.title")} origin={p.origin} rest="/request" noindex>
      <section class="card" role="status">
        <h1>{tr("inquiry.sent.title")}</h1>
        <p>{tr("request.sent.body", { email: p.email })}</p>
      </section>
    </Layout>
  );
};
