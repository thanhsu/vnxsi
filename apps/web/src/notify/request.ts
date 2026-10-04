import { adminEmails } from "../auth/admin.ts";
import { builderFacingName } from "../domain/inquiry.ts";
import { findInviteContext, findRequestWithClient, type InviteContext } from "../db/requests.ts";
import { INVITE_TTL_MS, MATCHING_TTL_MS } from "../domain/request.ts";
import { getMailer } from "../email/index.ts";
import type { EmailMessage } from "../email/mailer.ts";
import {
  requestAdminNewEmail,
  requestExpiredEmail,
  requestInviteEmail,
  requestInviteExpiredEmail,
  requestNotSelectedEmail,
  requestProposalEmail,
  requestRejectedEmail,
  requestReminderEmail,
} from "../email/templates/request.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath, type Locale } from "../i18n/locales.ts";

export type NotifyOutcome = "sent" | "failed" | "skipped";
export type NotifyTally = { sent: number; failed: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const asLocale = (value: string): Locale => (isLocale(value) ? value : "en");
const absolute = (env: Pick<Bindings, "APP_ORIGIN">, path: string) => new URL(path, env.APP_ORIGIN).toString();

/** Builder side: the invitation page (the id is the invitation's, so one builder's link never opens another's). */
export const invitationUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, inviteId: string) => absolute(env, localizedPath(locale, `/hub/invitations/${inviteId}`));
export const invitationsUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale) => absolute(env, localizedPath(locale, "/hub/invitations"));
/** Client side. */
export const clientRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale, requestId: string) => absolute(env, localizedPath(locale, `/me/requests/${requestId}`));
export const newRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, locale: Locale) => absolute(env, localizedPath(locale, "/request"));
/** Admin pages are English only. */
export const adminRequestUrl = (env: Pick<Bindings, "APP_ORIGIN">, requestId: string) => absolute(env, `/admin/requests/${requestId}`);

// Never logs addresses: only the kind, the id and the error text. There is no retry column (plan M6): a failure is a log line.
function logFailure(kind: string, id: string, err: unknown): void {
  console.error(JSON.stringify({ event: "request.notify_failed", kind, id, error: String(err) }));
}

/** Runs one notification: any thrown error (D1, template, mailer) becomes "failed". */
async function attempt(kind: string, id: string, run: () => Promise<EmailMessage | null>, env: Bindings): Promise<NotifyOutcome> {
  try {
    const mail = await run();
    if (!mail) return "skipped";
    await getMailer(env).send(mail);
    return "sent";
  } catch (err) {
    logFailure(kind, id, err);
    return "failed";
  }
}

const tally = (outcomes: NotifyOutcome[]): NotifyTally => ({ sent: outcomes.filter((o) => o === "sent").length, failed: outcomes.filter((o) => o === "failed").length });

/** One e-mail about one invitation, to the builder or the client; `compose` returns null when the invitation no longer fits. */
function aboutInvite(
  env: Bindings,
  kind: string,
  inviteId: string,
  to: "builder" | "client",
  compose: (ctx: InviteContext, locale: Locale) => Omit<EmailMessage, "to"> | null, // the invitation's own status gates each notice; builder end-notices still go out after spam (plan header)
): Promise<NotifyOutcome> {
  return attempt(
    kind,
    inviteId,
    async () => {
      const ctx = await findInviteContext(env.DB, inviteId);
      if (!ctx) return null;
      const party = to === "builder" ? ctx.builder : ctx.client;
      const mail = compose(ctx, asLocale(party.locale));
      return mail ? { to: party.email, ...mail } : null;
    },
    env,
  );
}

/** Spec §8.3 / Owner 2026-10-04: a request that became `submitted` is announced to every ADMIN_EMAILS address, in English. */
export async function notifyRequestSubmitted(env: Bindings, requestId: string): Promise<NotifyTally> {
  try {
    return await announce(env, requestId);
  } catch (err) {
    logFailure("submitted", requestId, err);
    return { sent: 0, failed: 1 };
  }
}

// Everything that can throw (D1, URL, template) runs inside notifyRequestSubmitted's try.
async function announce(env: Bindings, requestId: string): Promise<NotifyTally> {
  const loaded = await findRequestWithClient(env.DB, requestId);
  if (!loaded || loaded.request.status === "pending_verification" || loaded.request.status === "removed") return { sent: 0, failed: 0 };
  const admins = [...adminEmails(env)];
  if (admins.length === 0) {
    console.warn(JSON.stringify({ event: "request.no_admins", requestId }));
    return { sent: 0, failed: 0 };
  }
  const { request } = loaded;
  const mail = requestAdminNewEmail({ title: request.title, category: request.category, budgetBand: request.budgetBand, languages: request.languages, clientName: request.clientName }, adminRequestUrl(env, request.id));
  const outcomes: NotifyOutcome[] = [];
  for (const to of admins) outcomes.push(await attempt("submitted", requestId, async () => ({ to, ...mail }), env));
  return tally(outcomes);
}

/** Builders just invited (Task 4: ids from `inviteBuildersBatch(...).read(...).invited`). */
export async function notifyInvited(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "invited", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "invited"
          ? null
          : requestInviteEmail(locale, { clientName: builderFacingName(request.clientName), title: request.title, category: request.category, budgetBand: request.budgetBand, deadline: request.deadline, days: INVITE_TTL_MS / DAY_MS, url: invitationUrl(env, locale, invite.id) }),
      ),
    );
  }
  return tally(outcomes);
}

/** Task 7: a builder invited three days ago who has not answered. The cron marks `reminded_at` itself. */
export function notifyInviteReminder(env: Bindings, inviteId: string): Promise<NotifyOutcome> {
  return aboutInvite(env, "reminder", inviteId, "builder", ({ invite, request }, locale) =>
    invite.status !== "invited" || request.status !== "matching"
      ? null
      : requestReminderEmail(locale, { clientName: builderFacingName(request.clientName), title: request.title, days: INVITE_TTL_MS / DAY_MS, url: invitationUrl(env, locale, invite.id) }),
  );
}

/** Task 7 / lock: invitations that moved to `expired`. */
export async function notifyInviteExpired(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "invite_expired", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "expired" ? null : requestInviteExpiredEmail(locale, { title: request.title, url: invitationsUrl(env, locale) }),
      ),
    );
  }
  return tally(outcomes);
}

/** Task 5: a proposal the builder just sent. */
export function notifyProposal(env: Bindings, inviteId: string): Promise<NotifyOutcome> {
  return aboutInvite(env, "proposal", inviteId, "client", ({ invite, request, builder }, locale) =>
    invite.status !== "proposed" || request.status !== "matching"
      ? null
      : requestProposalEmail(locale, { builderName: builder.name, title: request.title, priceCents: invite.priceCents, priceMaxCents: invite.priceMaxCents, timelineDays: invite.timelineDays ?? 0, url: clientRequestUrl(env, locale, request.id) }),
  );
}

/** Builders whose proposal moved to `not_selected` (any way the request ended; neutral text, plan M6). */
export async function notifyNotSelected(env: Bindings, inviteIds: string[]): Promise<NotifyTally> {
  const outcomes: NotifyOutcome[] = [];
  for (const id of inviteIds) {
    outcomes.push(
      await aboutInvite(env, "not_selected", id, "builder", ({ invite, request }, locale) =>
        invite.status !== "not_selected" ? null : requestNotSelectedEmail(locale, { title: request.title, url: invitationsUrl(env, locale) }),
      ),
    );
  }
  return tally(outcomes);
}

async function aboutRequest(
  env: Bindings,
  kind: string,
  requestId: string,
  compose: (found: NonNullable<Awaited<ReturnType<typeof findRequestWithClient>>>, locale: Locale) => Omit<EmailMessage, "to"> | null,
): Promise<NotifyOutcome> {
  return attempt(
    kind,
    requestId,
    async () => {
      const found = await findRequestWithClient(env.DB, requestId);
      if (!found || found.request.status === "removed") return null;
      const mail = compose(found, asLocale(found.client.locale));
      return mail ? { to: found.client.email, ...mail } : null;
    },
    env,
  );
}

/** Task 4: the admin returned the request; the client gets the reason. */
export function notifyRequestRejected(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutRequest(env, "rejected", requestId, ({ request }, locale) =>
    request.status !== "rejected" || !request.adminNote ? null : requestRejectedEmail(locale, { title: request.title, reason: request.adminNote, url: newRequestUrl(env, locale) }),
  );
}

/** Task 7: the request stayed in `matching` for 30 days. */
export function notifyRequestExpired(env: Bindings, requestId: string): Promise<NotifyOutcome> {
  return aboutRequest(env, "expired", requestId, ({ request }, locale) =>
    request.status !== "expired" ? null : requestExpiredEmail(locale, { title: request.title, days: MATCHING_TTL_MS / DAY_MS, url: newRequestUrl(env, locale) }),
  );
}
