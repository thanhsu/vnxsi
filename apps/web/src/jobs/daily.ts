import { adminEmails } from "../auth/admin.ts";
import { deleteExpiredSessions } from "../auth/sessions.ts";
import { deleteExpiredLoginTokens } from "../auth/tokens.ts";
import { deleteExpiredPendingInquiries, listInquiriesToAlert, listInquiriesToRemind, listUnnotifiedMessages, markAlerted, markReminded } from "../db/inquiries.ts";
import { deleteGhostUsers, findUserById } from "../db/users.ts";
import { ALERT_AFTER_MS, PENDING_TTL_MS, REMIND_AFTER_MS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryAdminAlertEmail, inquiryReminderEmail } from "../email/templates/inquiry.ts";
import type { Bindings } from "../env.ts";
import { deleteOldRateLimitWindows } from "../http/rate-limit.ts";
import { isLocale } from "../i18n/locales.ts";
import { inquiryUrl, notifyInquiryMessage } from "../notify/inquiry.ts";

/**
 * Daily job, cron `0 1 * * *` (spec §8.4, ARCHITECTURE §5). VNX-0505 (M5): reminders, the admin alert, notification
 * retries and the inquiry clean-up. VNX-0705a: deletes expired data so the Privacy page stays true.
 * Idempotent: every e-mail is marked sent right after it goes out, so a second run the same day sends nothing again.
 */
export type DailyResult =
  | { job: "daily"; step: string; sent: number }
  | { job: "daily"; step: string; deleted: number }
  | { job: "daily"; step: string; error: string };

/** `sent` steps count e-mails that went out; `deleted` steps count rows removed. */
type Step = { step: string; counts: "sent" | "deleted"; run: (env: Bindings, now: Date) => Promise<number> };

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
      await mailer.send({ to: builder.email, ...inquiryReminderEmail(locale, { clientName: item.inquiry.clientName, productName: item.productName, url: inquiryUrl(env, locale, item.inquiry.id, "builder") }) });
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
    late.map((i) => ({ id: i.inquiry.id, builderHandle: i.builderHandle, productName: i.productName, openedAt: i.inquiry.openedAt ?? i.inquiry.createdAt })),
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

const STEPS: Step[] = [
  { step: "remind", counts: "sent", run: remind },
  { step: "alert", counts: "sent", run: alert },
  { step: "resend", counts: "sent", run: resend },
  { step: "pending_inquiries", counts: "deleted", run: (env, now) => deleteExpiredPendingInquiries(env.DB, before(now, PENDING_TTL_MS)) },
  // After the pending inquiries are gone, their implicit accounts have nothing attached (Owner 2026-10-04).
  { step: "ghost_users", counts: "deleted", run: (env, now) => deleteGhostUsers(env.DB, before(now, PENDING_TTL_MS)) },
  { step: "rate_limits", counts: "deleted", run: (env, now) => deleteOldRateLimitWindows(env.DB, now.getTime()) },
  { step: "login_tokens", counts: "deleted", run: (env, now) => deleteExpiredLoginTokens(env.DB, now) },
  { step: "sessions", counts: "deleted", run: (env, now) => deleteExpiredSessions(env.DB, now) },
];

/** Runs every step in order; a failing step is logged and does not stop the next one. Running twice is harmless. */
export async function runDaily(env: Bindings, now: Date): Promise<DailyResult[]> {
  const results: DailyResult[] = [];
  for (const { step, counts, run } of STEPS) {
    try {
      const n = await run(env, now);
      const result: DailyResult = counts === "sent" ? { job: "daily", step, sent: n } : { job: "daily", step, deleted: n };
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
