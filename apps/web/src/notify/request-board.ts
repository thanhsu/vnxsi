import { findPublicationByRequestId } from "../db/request-board.ts";
import { findRequestWithClient } from "../db/requests.ts";
import type { PublicationStatus } from "../domain/request-board.ts";
import { getMailer } from "../email/index.ts";
import type { EmailMessage } from "../email/mailer.ts";
import { requestBoardPublishedEmail, requestBoardRejectedEmail, requestBoardUnpublishedEmail } from "../email/templates/request-board.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath, type Locale } from "../i18n/locales.ts";
import { clientRequestUrl, type NotifyOutcome } from "./request.ts";

/**
 * The client's e-mails after Ops publishes, rejects or unpublishes a listing (EPIC 27 VNX-2704b). Called by the route after the
 * moderation batch has committed. Like notify/request.ts, none of these throws: a failure (D1, template, mailer) is one JSON log line
 * without the address and the outcome "failed", and the moderation stands. Each one checks that the listing is still in the state the
 * e-mail is about (a client who withdrew in the meantime gets nothing) and sends nothing for a request that was removed.
 */

const asLocale = (value: string): Locale => (isLocale(value) ? value : "en");

function logFailure(kind: string, id: string, err: unknown): void {
  console.error(JSON.stringify({ event: "request_board.notify_failed", kind, id, error: String(err) }));
}

type Listing = { title: string; locale: Locale; publicId: string; reviewNote: string | null; manageUrl: string };

async function aboutListing(env: Bindings, kind: string, requestId: string, state: PublicationStatus, compose: (listing: Listing) => Omit<EmailMessage, "to"> | null): Promise<NotifyOutcome> {
  try {
    const [found, publication] = await Promise.all([findRequestWithClient(env.DB, requestId), findPublicationByRequestId(env.DB, requestId)]);
    if (!found || !publication || found.request.status === "removed" || publication.status !== state) return "skipped";
    const locale = asLocale(found.client.locale);
    const mail = compose({ title: found.request.title, locale, publicId: publication.publicId, reviewNote: publication.reviewNote, manageUrl: clientRequestUrl(env, locale, requestId) });
    if (!mail) return "skipped";
    await getMailer(env).send({ to: found.client.email, ...mail });
    return "sent";
  } catch (err) {
    logFailure(kind, requestId, err);
    return "failed";
  }
}

/** `edited`: the public wording differs from the client's own (decided by the route at publish time). */
export function notifyPublicationPublished(env: Bindings, requestId: string, opts: { edited: boolean }): Promise<NotifyOutcome> {
  return aboutListing(env, "published", requestId, "published", ({ title, locale, publicId, manageUrl }) =>
    requestBoardPublishedEmail(locale, { title, edited: opts.edited, publicUrl: new URL(localizedPath(locale, `/requests/${publicId}`), env.APP_ORIGIN).toString(), manageUrl }),
  );
}

export function notifyPublicationRejected(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutListing(env, "rejected", requestId, "rejected", ({ title, locale, reviewNote, manageUrl }) => (reviewNote ? requestBoardRejectedEmail(locale, { title, reason: reviewNote, url: manageUrl }) : null));
}

export function notifyPublicationUnpublished(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutListing(env, "unpublished", requestId, "unpublished", ({ title, locale, reviewNote, manageUrl }) => (reviewNote ? requestBoardUnpublishedEmail(locale, { title, reason: reviewNote, url: manageUrl }) : null));
}
