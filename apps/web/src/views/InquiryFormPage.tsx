import type { FC } from "hono/jsx";
import { BUDGET_BANDS, type InquiryErrors, type InquiryFieldError, type InquiryFormValues, type InquiryType } from "../domain/inquiry.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator, type Translate } from "../i18n/t.ts";
import type { MessageKey } from "../i18n/messages/en.ts";
import { BUDGET_KEY, INQUIRY_TYPE_KEY } from "./labels.ts";
import { FormErrorSummary, type FormErrorItem } from "./FormErrorSummary.tsx";
import { Layout } from "./Layout.tsx";

export type InquiryTarget = { builderName: string; productName: string | null; action: string; rest: string };

const ERROR_KEY: Record<InquiryFieldError, MessageKey> = {
  required: "inquiry.error.required",
  too_short: "inquiry.error.too_short",
  too_long: "inquiry.error.too_long",
  choice: "inquiry.error.choice",
  date: "inquiry.error.date",
  email: "inquiry.error.email",
  invalid: "inquiry.error.invalid",
};

type Props = {
  locale: Locale;
  origin: string;
  target: InquiryTarget;
  type: InquiryType;
  signedIn: boolean;
  values: InquiryFormValues;
  errors: InquiryErrors;
  /** null when signed out and Turnstile is not configured: the form is not offered (fail closed). */
  siteKey: string | null;
  formError?: string;
};

/** Summary lines in page order (VNX-0807): the form-level error first, then each field error linked to its input. The `type` error has no input. */
export function inquiryErrorItems(p: Pick<Props, "errors" | "formError" | "signedIn">, tr: Translate): FormErrorItem[] {
  const items: FormErrorItem[] = p.formError ? [{ href: "", message: p.formError }] : [];
  const fields: [keyof InquiryErrors, string, MessageKey][] = [
    ["message", "iq-message", "inquiry.form.message"],
    ["budgetBand", "iq-budget", "inquiry.form.budget"],
    ["deadline", "iq-deadline", "inquiry.form.deadline"],
    ["name", "iq-name", "inquiry.form.name"],
    ["email", p.signedIn ? "" : "iq-email", "inquiry.form.email"],
  ];
  for (const [field, id, label] of fields) {
    const code = p.errors[field];
    if (code) items.push({ href: id ? `#${id}` : "", message: `${tr(label)}: ${tr(ERROR_KEY[code])}` });
  }
  if (p.errors.type) items.push({ href: "", message: tr(ERROR_KEY[p.errors.type]) });
  return items;
}

export const InquiryFormPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const summary = inquiryErrorItems(p, tr);
  const typeLabel = tr(INQUIRY_TYPE_KEY[p.type]);
  const title = tr("inquiry.form.title", { type: typeLabel, target: p.target.productName ?? p.target.builderName });
  const err = (field: keyof InquiryErrors) => {
    const code = p.errors[field];
    return code ? (
      <p id={`iq-${field}-error`} class="error-msg">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: keyof InquiryErrors) => (p.errors[field] ? { "aria-invalid": "true", "aria-describedby": `iq-${field}-error` } : {});
  const blocked = !p.signedIn && p.siteKey === null;
  return (
    <Layout locale={p.locale} title={`${title} · VNX.SI`} origin={p.origin} rest={p.target.rest} noindex signedIn={p.signedIn} invalid={summary.length > 0}>
      <section class="card wide">
        <h1>{title}</h1>
        <p>{tr("inquiry.form.intro", { builder: p.target.builderName })}</p>
        <FormErrorSummary tr={tr} items={summary} />
        {blocked ? (
          <p class="notice">
            {tr("inquiry.form.unavailable")} <a href={localizedPath(p.locale, `/login?next=${encodeURIComponent(localizedPath(p.locale, p.target.rest))}`)}>{tr("nav.signIn")}</a>
          </p>
        ) : (
          <form method="post" action={p.target.action}>
            <input type="hidden" name="type" value={p.type} />
            <div class="field">
              <label for="iq-message">{tr("inquiry.form.message")}</label>
              <textarea id="iq-message" name="message" required minlength={20} maxlength={2000} {...aria("message")}>
                {p.values.message}
              </textarea>
              <p class="hint">{tr("inquiry.form.messageHint")}</p>
              {err("message")}
            </div>
            <div class="field">
              <label for="iq-budget">{tr("inquiry.form.budget")}</label>
              <select id="iq-budget" name="budgetBand" required {...aria("budgetBand")}>
                {BUDGET_BANDS.map((b) => (
                  <option value={b} selected={b === p.values.budgetBand}>
                    {tr(BUDGET_KEY[b])}
                  </option>
                ))}
              </select>
              {err("budgetBand")}
            </div>
            <div class="field">
              <label for="iq-deadline">{tr("inquiry.form.deadline")}</label>
              <input id="iq-deadline" name="deadline" type="date" value={p.values.deadline} {...aria("deadline")} />
              {err("deadline")}
            </div>
            <div class="field">
              <label for="iq-name">{tr("inquiry.form.name")}</label>
              <input id="iq-name" name="name" required maxlength={80} autocomplete="name" value={p.values.name} {...aria("name")} />
              {err("name")}
            </div>
            {p.signedIn ? null : (
              <div class="field">
                <label for="iq-email">{tr("inquiry.form.email")}</label>
                <input id="iq-email" name="email" type="email" required autocomplete="email" value={p.values.email} {...aria("email")} />
                <p class="hint">{tr("inquiry.form.emailHint")}</p>
                {err("email")}
              </div>
            )}
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div class="hp" aria-hidden="true">
              <label for="iq-website">{tr("inquiry.form.website")}</label>
              <input id="iq-website" name="website" tabindex={-1} autocomplete="off" value="" />
            </div>
            {err("type")}
            {p.signedIn ? null : (
              <>
                {/* Turnstile's default response field is cf-turnstile-response; the route reads it. */}
                <div class="cf-turnstile" data-sitekey={p.siteKey ?? ""}></div>
                <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
              </>
            )}
            <button class="btn" type="submit">
              {tr("inquiry.form.submit")}
            </button>
          </form>
        )}
      </section>
    </Layout>
  );
};

export const InquirySentPage: FC<{ locale: Locale; origin: string; email: string; rest: string }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("inquiry.sent.title")} origin={p.origin} rest={p.rest} noindex>
      <section class="card" role="status">
        <h1>{tr("inquiry.sent.title")}</h1>
        <p>{tr("inquiry.sent.body", { email: p.email })}</p>
      </section>
    </Layout>
  );
};
