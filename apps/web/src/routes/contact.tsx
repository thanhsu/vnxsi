import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createFeedback, markFeedbackNotified } from "../db/feedback.ts";
import {
  CONTACT_EMAIL,
  CONTACT_HOURLY_LIMIT_PER_IP,
  feedbackSource,
  feedbackValuesFromBody,
  isFeedbackHoneypotFilled,
  parseFeedbackForm,
  type Feedback,
  type FeedbackErrors,
  type FeedbackFormValues,
  type FeedbackSource,
} from "../domain/feedback.ts";
import { getMailer } from "../email/index.ts";
import { feedbackNoticeEmail } from "../email/templates/feedback.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from "../http/turnstile.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { ContactPage } from "../views/ContactPage.tsx";
import { emptyFeedbackValues } from "../views/contact/ContactForm.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;

/** Where the sender lands after a successful (or honeypot) POST. */
function doneUrl(locale: Locale, from: FeedbackSource): string {
  return from === "landing" ? `${localizedPath(locale, "/")}?asked=1#ask` : `${localizedPath(locale, "/contact")}?sent=1`;
}

function contactPage(c: Context<AppEnv>, opts: { sent?: boolean; values: FeedbackFormValues; errors?: FeedbackErrors; formError?: string }, status: ContentfulStatusCode = 200) {
  return page(
    c,
    <ContactPage
      locale={c.get("locale")}
      origin={siteOrigin(c)}
      signedIn={c.get("user") !== null}
      sent={opts.sent === true}
      values={opts.values}
      errors={opts.errors ?? {}}
      siteKey={turnstileSiteKey(c.env)}
      formError={opts.formError}
    />,
    status,
  );
}

/** Mails contact@vnx.si. Never throws: the message is already stored, so the sender sees success either way. */
async function notifyTeam(c: Context<AppEnv>, item: Feedback): Promise<void> {
  try {
    const adminUrl = new URL(`/admin/feedback/${item.id}`, c.env.APP_ORIGIN).toString();
    const mail = feedbackNoticeEmail({ role: item.role, kind: item.kind, name: item.name, email: item.email, locale: item.locale, message: item.message, adminUrl });
    await getMailer(c.env).send({ to: CONTACT_EMAIL, replyTo: item.email, ...mail });
    await markFeedbackNotified(c.env.DB, item.id, new Date().toISOString());
  } catch (err) {
    // No e-mail address in the log; the admin list flags the row ("Email not sent yet").
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "contact.notify_failed", feedbackId: item.id, error: String(err) }));
  }
}

export function registerContactRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/contact", (c) => {
    const user = c.get("user");
    return contactPage(c, { sent: c.req.query("sent") === "1", values: emptyFeedbackValues("contact", user?.email ?? "") });
  });

  // Origin is checked by the app-wide middleware before this runs.
  onLocalized(app, "post", "/contact", async (c) => {
    const locale = c.get("locale");
    const tr = translator(locale);
    const user = c.get("user");
    const body = await c.req.parseBody();
    const values = feedbackValuesFromBody(body);
    const from = feedbackSource(values.from);

    // Honeypot: look like success, store and send nothing, count nothing.
    if (isFeedbackHoneypotFilled(values)) return c.redirect(doneUrl(locale, from), 303);

    // Errors come back on /contact, which then posts as the contact page.
    const again = { ...values, from: "contact" as const };
    const parsed = parseFeedbackForm(values);
    if (!parsed.ok) return contactPage(c, { values: again, errors: parsed.errors }, 400);

    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    if (!user) {
      const captcha = await verifyTurnstile(c.env, body[TURNSTILE_FIELD], ip === "unknown" ? null : ip);
      if (captcha === "unavailable") return contactPage(c, { values: again, formError: turnstileSiteKey(c.env) === null ? undefined : tr("contact.form.unavailable") }, 503);
      if (captcha === "fail") return contactPage(c, { values: again, formError: tr("contact.error.captcha") }, 400);
    }

    const now = new Date();
    const limit = await hitRateLimit(c.env.DB, `contact:ip:${ip}`, CONTACT_HOURLY_LIMIT_PER_IP, HOUR, now.getTime());
    if (!limit.allowed) return contactPage(c, { values: again, formError: tr("contact.error.rateLimited") }, 429);

    const item = await createFeedback(c.env.DB, { ...parsed.input, locale, userId: user?.id ?? null, now: now.toISOString() });
    await notifyTeam(c, item);
    return c.redirect(doneUrl(locale, from), 303);
  });
}
