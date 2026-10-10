import type { FC } from "hono/jsx";
import { CONTACT_EMAIL, type FeedbackErrors, type FeedbackFormValues } from "../domain/feedback.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator, type Translate } from "../i18n/t.ts";
import { ContactForm, contactErrorItems } from "./contact/ContactForm.tsx";
import { Layout } from "./Layout.tsx";

type Props = {
  locale: Locale;
  origin: string;
  signedIn: boolean;
  /** ?sent=1: the thank-you notice replaces the form. */
  sent: boolean;
  values: FeedbackFormValues;
  errors: FeedbackErrors;
  siteKey: string | null;
  formError?: string;
};

/** "Prefer email? Write to {email}." with the address as a mailto link. */
export const EmailLine: FC<{ tr: Translate }> = ({ tr }) => {
  const [before = "", after = ""] = tr("contact.side.email").split("{email}");
  return (
    <p>
      {before}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      {after}
    </p>
  );
};

const MailIcon: FC = () => (
  <svg class="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

/** /contact (plan VNX-0710): questions, suggestions and partnership offers for the VNX.SI team. */
export const ContactPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const invalid = !p.sent && contactErrorItems(p, tr).length > 0;
  return (
    <Layout locale={p.locale} title={`${tr("contact.title")} · VNX.SI`} description={tr("contact.lead")} origin={p.origin} rest="/contact" signedIn={p.signedIn} invalid={invalid}>
      <div class="contact-page">
        <header class="section-head contact-head">
          <p class="eyebrow">{tr("nav.contact")}</p>
          <h1>{tr("contact.title")}</h1>
          <p class="section-sub">{tr("contact.lead")}</p>
        </header>
        <div class="contact-grid">
          <section class="contact-card" aria-label={tr("contact.form.submit")}>
            {p.sent ? (
              <p class="notice good" role="status">
                {tr("contact.sent")}
              </p>
            ) : (
              <ContactForm locale={p.locale} from="contact" values={p.values} errors={p.errors} signedIn={p.signedIn} siteKey={p.siteKey} formError={p.formError} />
            )}
          </section>
          <aside class="contact-aside">
            <MailIcon />
            <EmailLine tr={tr} />
            <p class="muted">{tr("contact.side.reply")}</p>
          </aside>
        </div>
      </div>
    </Layout>
  );
};
