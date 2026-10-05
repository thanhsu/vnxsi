import { adminEmails } from "../auth/admin.ts";
import { auditStatement, inviteExpiryAuditStatements } from "../db/audit.ts";
import {
  CRON_LIST_CAP,
  deleteExpiredPendingRequests,
  endRequestBatch,
  expireInvitesOfInactiveBuilders,
  expireStaleInvites,
  listInvitesToRemind,
  listRequestsToExpire,
  markInviteReminded,
} from "../db/requests.ts";
import { INVITE_REMIND_AFTER_MS, INVITE_TTL_MS, MATCHING_TTL_MS } from "../domain/request.ts";
import { notifyInviteExpired, notifyInviteReminder, notifyNotSelected, notifyRequestExpired } from "../notify/request.ts";
import { deleteExpiredSessions } from "../auth/sessions.ts";
import { deleteExpiredLoginTokens } from "../auth/tokens.ts";
import { deleteExpiredPendingInquiries, listInquiriesToAlert, listInquiriesToRemind, listUnnotifiedMessages, markAlerted, markReminded } from "../db/inquiries.ts";
import { purgeOldClicks } from "../db/clicks.ts";
import { deleteGhostUsers, findUserById } from "../db/users.ts";
import { ALERT_AFTER_MS, builderFacingName, PENDING_TTL_MS, REMIND_AFTER_MS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryAdminAlertEmail, inquiryReminderEmail } from "../email/templates/inquiry.ts";
import type { Bindings } from "../env.ts";
import { deleteOldRateLimitWindows } from "../http/rate-limit.ts";
import { isLocale } from "../i18n/locales.ts";
import { inquiryUrl, notifyInquiryMessage } from "../notify/inquiry.ts";

/**
 * Daily job, cron `0 1 * * *` (spec §8.4, ARCHITECTURE §5). VNX-0505 (M5): reminders, the admin alert, notification
 * retries and the inquiry clean-up. VNX-0705a: deletes expired data so the Privacy page stays true.
 * VNX-0606 (M6): invitation reminders and expiry, request expiry, clean-up of unconfirmed requests.
 * VNX-2103 (EPIC 21): deletes outbound clicks older than 13 months (OUTBOUND_CLICK_RETENTION_DAYS).
 * Idempotent: every e-mail is marked sent right after it goes out, so a second run the same day sends nothing again.
 */
export type DailyResult =
  | { job: "daily"; step: string; sent: number }
  | { job: "daily"; step: string; deleted: number }
  | { job: "daily"; step: string; expired: number }
  | { job: "daily"; step: string; error: string };

/** `sent` steps count e-mails that went out; `deleted` rows removed; `expired` rows moved to an expired status. */
type Step = { step: string; counts: "sent" | "deleted" | "expired"; run: (env: Bindings, now: Date) => Promise<number> };

const before = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

/** Builders who opened an inquiry 3 days ago and have not replied. One failed e-mail does not stop the others. */
async function remind(env: Bindings, now: Date): Promise<number> {
  const mailer = getMailer(env);
  const iso = now.toISOString();
  let sent = 0;
  for (const item of await listInquiriesToRemind(env.DB, before(now, REMIND_AFTER_MS))) {
    const builder = await findUserById(env.DB, item.inquiry.builderId);
    if (!builder) continue;
    const locale = isLocale(builder.locale) ? builder.locale : "en";
    try {
      await mailer.send({ to: builder.email, ...inquiryReminderEmail(locale, { clientName: builderFacingName(item.inquiry.clientName), productName: item.productName ?? item.requestTitle, url: inquiryUrl(env, locale, item.inquiry.id, "builder") }) });
      await markReminded(env.DB, item.inquiry.id, iso);
      sent++;
    } catch (err) {
      console.error(JSON.stringify({ event: "jobs.daily.remind_failed", inquiryId: item.inquiry.id, error: String(err) }));
    }
  }
  return sent;
}

/** One digest to the admins about inquiries open for 7 days. Counts the inquiries reported. */
async function alert(env: Bindings, now: Date): Promise<number> {
  const late = await listInquiriesToAlert(env.DB, before(now, ALERT_AFTER_MS));
  const admins = [...adminEmails(env)];
  if (late.length === 0) return 0;
  if (admins.length === 0) {
    console.warn(JSON.stringify({ event: "jobs.daily.no_admins", overdue: late.length }));
    return 0;
  }
  const mailer = getMailer(env);
  const mail = inquiryAdminAlertEmail(
    late.map((i) => ({ id: i.inquiry.id, builderHandle: i.builderHandle, productName: i.productName ?? i.requestTitle, openedAt: i.inquiry.openedAt ?? i.inquiry.createdAt })),
    new URL("/admin/inquiries?status=open", env.APP_ORIGIN).toString(),
  );
  for (const to of admins) await mailer.send({ to, ...mail });
  await markAlerted(env.DB, late.map((i) => i.inquiry.id), now.toISOString());
  return late.length;
}

/** Retries message notifications that have not gone out yet (at most 3 attempts in all, spec §8.3). */
async function resend(env: Bindings, now: Date): Promise<number> {
  let sent = 0;
  for (const message of await listUnnotifiedMessages(env.DB)) {
    if ((await notifyInquiryMessage(env, message.id, now)) === "sent") sent++;
  }
  return sent;
}

/** The cap is a sanity bound, not a business limit: the rest waits for tomorrow, and the log says so. */
function warnIfCapped(step: string, ids: string[]): void {
  if (ids.length >= CRON_LIST_CAP) console.warn(JSON.stringify({ event: "jobs.daily.capped", step, cap: CRON_LIST_CAP }));
}

/**
 * Spec §7.6 / §8.4. First the invitations of builders who are no longer approved (silent, Owner 2026-10-04), then those
 * unanswered for 7 days (one "invitation ended" e-mail each). Deadlines are soft: until this runs, answers are accepted.
 */
async function expireInvites(env: Bindings, now: Date): Promise<number> {
  const iso = now.toISOString();
  const swept = await expireInvitesOfInactiveBuilders(env.DB, iso);
  const lapsed = await expireStaleInvites(env.DB, before(now, INVITE_TTL_MS), iso);
  // Spec §7: every transition leaves an audit row, guarded on the invitation being expired at `iso`, so a rerun adds none.
  const audits = [
    ...inviteExpiryAuditStatements(env.DB, swept, { actorUserId: null, reason: "builder_inactive", now: iso }),
    ...inviteExpiryAuditStatements(env.DB, lapsed, { actorUserId: null, reason: "lapsed", now: iso }),
  ];
  // The notices go first: a rerun finds nothing left to expire, so a failed audit must never cost the lapse e-mails.
  await notifyInviteExpired(env, lapsed.map((x) => x.id));
  if (audits.length > 0) {
    try {
      await env.DB.batch(audits);
    } catch (err) {
      console.error(JSON.stringify({ event: "jobs.daily.invite_expiry_audit_failed", invites: audits.length, error: String(err) }));
    }
  }
  return swept.length + lapsed.length;
}

/** Spec §8.4: one reminder per invitation, 3 days after it was sent. Marked only after the e-mail went out. */
async function remindInvites(env: Bindings, now: Date): Promise<number> {
  let sent = 0;
  const due = await listInvitesToRemind(env.DB, before(now, INVITE_REMIND_AFTER_MS));
  warnIfCapped("invite_remind", due);
  for (const id of due) {
    if ((await notifyInviteReminder(env, id)) !== "sent") continue;
    await markInviteReminded(env.DB, id, now.toISOString());
    sent++;
  }
  return sent;
}

/**
 * Spec §8.4: a request in `matching` for 30 days (from matched_at) expires through endRequestBatch, so its invitations
 * settle in the same transaction. A lost compare-and-set (the client just closed it) changes and sends nothing.
 */
async function expireRequests(env: Bindings, now: Date): Promise<number> {
  const iso = now.toISOString();
  let expired = 0;
  const due = await listRequestsToExpire(env.DB, before(now, MATCHING_TTL_MS));
  warnIfCapped("requests_expire", due);
  for (const id of due) {
    const end = endRequestBatch(env.DB, { id, from: "matching", to: "expired", now: iso });
    const results = await env.DB.batch([
      ...end.statements,
      auditStatement(env.DB, { actorUserId: null, action: "request.expire", entity: "request", entityId: id, data: { from: "matching" }, now: iso }, { requestId: id, status: "expired", updatedAt: iso }),
    ]);
    const outcome = end.read(results);
    if (!outcome.request) continue;
    expired++;
    await notifyRequestExpired(env, id);
    await notifyNotSelected(env, outcome.notSelected);
    await notifyInviteExpired(env, outcome.expired);
  }
  return expired;
}

const STEPS: Step[] = [
  { step: "remind", counts: "sent", run: remind },
  { step: "alert", counts: "sent", run: alert },
  { step: "resend", counts: "sent", run: resend },
  { step: "invites_expire", counts: "expired", run: expireInvites },
  { step: "requests_expire", counts: "expired", run: expireRequests },
  { step: "invite_remind", counts: "sent", run: remindInvites },
  { step: "pending_inquiries", counts: "deleted", run: (env, now) => deleteExpiredPendingInquiries(env.DB, before(now, PENDING_TTL_MS)) },
  { step: "pending_requests", counts: "deleted", run: (env, now) => deleteExpiredPendingRequests(env.DB, before(now, PENDING_TTL_MS)) },
  // After the pending inquiries and requests are gone, their implicit accounts have nothing attached (Owner 2026-10-04).
  { step: "ghost_users", counts: "deleted", run: (env, now) => deleteGhostUsers(env.DB, before(now, PENDING_TTL_MS)) },
  { step: "rate_limits", counts: "deleted", run: (env, now) => deleteOldRateLimitWindows(env.DB, now.getTime()) },
  { step: "login_tokens", counts: "deleted", run: (env, now) => deleteExpiredLoginTokens(env.DB, now) },
  { step: "sessions", counts: "deleted", run: (env, now) => deleteExpiredSessions(env.DB, now) },
  // Owner 2026-10-05: outbound clicks are kept 13 months (Privacy says so). Bounded per run, see purgeOldClicks.
  { step: "outbound_clicks", counts: "deleted", run: (env, now) => purgeOldClicks(env.DB, now) },
];

/** Runs every step in order; a failing step is logged and does not stop the next one. Running twice is harmless. */
export async function runDaily(env: Bindings, now: Date): Promise<DailyResult[]> {
  const results: DailyResult[] = [];
  for (const { step, counts, run } of STEPS) {
    try {
      const n = await run(env, now);
      const result: DailyResult = counts === "sent" ? { job: "daily", step, sent: n } : counts === "expired" ? { job: "daily", step, expired: n } : { job: "daily", step, deleted: n };
      console.log(JSON.stringify(result));
      results.push(result);
    } catch (err) {
      const result: DailyResult = { job: "daily", step, error: String(err) };
      console.error(JSON.stringify(result));
      results.push(result);
    }
  }
  return results;
}
