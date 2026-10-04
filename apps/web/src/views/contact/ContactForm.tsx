import type { FC } from "hono/jsx";
import {
  CONTACT_EMAIL,
  FEEDBACK_EMAIL_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_NAME_MAX,
  FEEDBACK_ROLES,
  type FeedbackErrors,
  type FeedbackField,
  type FeedbackFieldError,
  type FeedbackFormValues,
  type FeedbackKind,
  type FeedbackRole,
  type FeedbackSource,
} from "../../domain/feedback.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";

export const FEEDBACK_ROLE_KEY: Record<FeedbackRole, MessageKey> = {
  builder: "contact.role.builder",
  client: "contact.role.client",
  other: "contact.role.other",
};

export const FEEDBACK_KIND_KEY: Record<FeedbackKind, MessageKey> = {
  question: "contact.kind.question",
  suggestion: "contact.kind.suggestion",
  partnership: "contact.kind.partnership",
  other: "contact.kind.other",
};

const ERROR_KEY: Record<FeedbackFieldError, MessageKey> = {
  choice: "contact.error.choice",
  email: "contact.error.email",
  length: "contact.error.message",
  consent: "contact.error.consent",
  too_long: "inquiry.error.too_long",
  invalid: "inquiry.error.invalid",
};

export function emptyFeedbackValues(from: FeedbackSource, email = ""): FeedbackFormValues {
  return { role: "", kind: "question", name: "", email, message: "", consent: false, website: "", from };
}

type Props = {
  locale: Locale;
  /** Which page the form sits on; the POST sends the sender back there. */
  from: FeedbackSource;
  values: FeedbackFormValues;
  errors: FeedbackErrors;
  signedIn: boolean;
  /**
   * null when signed out and Turnstile is not configured: the form is not offered (fail closed, like the inquiry form).
   * Signed out with a key, the widget and its script are rendered on /contact and on the landing #ask block alike
   * (VNX-0710 F1: the Turnstile script is the one third-party request the site allows).
   */
  siteKey: string | null;
  formError?: string;
};

/** The contact form, shared by /contact and the landing "Ask us" block (plan VNX-0710). */
export const ContactForm: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const id = (field: string) => `ct-${field}`;
  const err = (field: FeedbackField) => {
    const code = p.errors[field];
    return code ? (
      <p id={id(`${field}-error`)} class="error-msg" role="alert">
        {tr(ERROR_KEY[code])}
      </p>
    ) : null;
  };
  const aria = (field: FeedbackField) => (p.errors[field] ? { "aria-invalid": "true", "aria-describedby": id(`${field}-error`) } : {});

  if (!p.signedIn && p.siteKey === null) {
    return (
      <p class="notice">
        {tr("contact.form.unavailable")} <a href={localizedPath(p.locale, `/login?next=${encodeURIComponent(localizedPath(p.locale, "/contact"))}`)}>{tr("nav.signIn")}</a>
        {" · "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    );
  }

  return (
    <form method="post" action={localizedPath(p.locale, "/contact")} class="contact-form">
      <input type="hidden" name="from" value={p.from} />
      <fieldset class="field contact-roles" {...(p.errors.role ? { "aria-describedby": id("role-error") } : {})}>
        <legend>{tr("contact.form.role")}</legend>
        <div class="choice-row">
          {FEEDBACK_ROLES.map((role) => (
            <span class="choice">
              <input type="radio" id={id(`role-${role}`)} name="role" value={role} required checked={p.values.role === role} />
              <label for={id(`role-${role}`)}>{tr(FEEDBACK_ROLE_KEY[role])}</label>
            </span>
          ))}
        </div>
        {err("role")}
      </fieldset>
      <div class="field">
        <label for={id("kind")}>{tr("contact.form.kind")}</label>
        <select id={id("kind")} name="kind" required {...aria("kind")}>
          {FEEDBACK_KINDS.map((kind) => (
            <option value={kind} selected={p.values.kind === kind}>
              {tr(FEEDBACK_KIND_KEY[kind])}
            </option>
          ))}
        </select>
        {err("kind")}
      </div>
      <div class="contact-pair">
        <div class="field">
          <label for={id("name")}>{tr("contact.form.name")}</label>
          <input id={id("name")} name="name" type="text" maxlength={FEEDBACK_NAME_MAX} autocomplete="name" value={p.values.name} {...aria("name")} />
          {err("name")}
        </div>
        <div class="field">
          <label for={id("email")}>{tr("contact.form.email")}</label>
          <input id={id("email")} name="email" type="email" required maxlength={FEEDBACK_EMAIL_MAX} autocomplete="email" value={p.values.email} {...aria("email")} />
          {err("email")}
        </div>
      </div>
      <div class="field">
        <label for={id("message")}>{tr("contact.form.message")}</label>
        <textarea
          id={id("message")}
          name="message"
          required
          minlength={FEEDBACK_MESSAGE_MIN}
          maxlength={FEEDBACK_MESSAGE_MAX}
          rows={6}
          {...(p.errors.message ? aria("message") : { "aria-describedby": id("message-hint") })}
        >
          {p.values.message}
        </textarea>
        <p id={id("message-hint")} class="hint">
          {tr("contact.form.messageHint")}
        </p>
        {err("message")}
      </div>
      <div class="field contact-consent">
        <div class="choice">
          <input id={id("consent")} name="consent" type="checkbox" required checked={p.values.consent} {...aria("consent")} />
          <label for={id("consent")}>{tr("contact.form.consent")}</label>
        </div>
        {err("consent")}
      </div>
      {/* Honeypot: off-screen, hidden from assistive tech and out of the tab order. */}
      <div class="hp" aria-hidden="true">
        <label for={id("website")}>{tr("inquiry.form.website")}</label>
        <input id={id("website")} name="website" type="text" tabindex={-1} autocomplete="off" value="" />
      </div>
      {p.signedIn ? null : (
        <>
          {/* Turnstile's default response field is cf-turnstile-response; the route reads it. */}
          <div class="cf-turnstile" data-sitekey={p.siteKey ?? ""}></div>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        </>
      )}
      {p.formError ? (
        <p class="error-msg" role="alert">
          {p.formError}
        </p>
      ) : null}
      <p class="contact-submit">
        <button class="btn btn-primary btn-lg" type="submit">
          {tr("contact.form.submit")}
        </button>
      </p>
    </form>
  );
};
