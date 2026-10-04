import { adminEmails } from "../auth/admin.ts";
import { deleteExpiredSessions } from "../auth/sessions.ts";
import { deleteExpiredTokens } from "../auth/tokens.ts";
import { deleteExpiredPendingInquiries, listInquiriesToAlert, listInquiriesToRemind, listUnnotifiedMessages, markAlerted, markReminded } from "../db/inquiries.ts";
import { deleteGhostUsers, findUserById } from "../db/users.ts";
import { ALERT_AFTER_MS, PENDING_TTL_MS, REMIND_AFTER_MS } from "../domain/inquiry.ts";
import { getMailer } from "../email/index.ts";
import { inquiryAdminAlertEmail, inquiryReminderEmail } from "../email/templates/inquiry.ts";
import type { Bindings } from "../env.ts";
import { deleteOldRateLimitWindows } from "../http/rate-limit.ts";
import { isLocale } from "../i18n/locales.ts";
import { inquiryUrl, notifyInquiryMessage } from "../notify/inquiry.ts";

export type DailySummary = {
  reminded: number;
  alerted: number;
  resent: number;
  pendingDeleted: number;
  ghostsDeleted: number;
  tokensDeleted: number;
  sessionsDeleted: number;
  rateLimitRowsDeleted: number;
};

const before = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

/**
 * Spec §8.4, 01:00 UTC. Idempotent (ARCHITECTURE §5): every e-mail is marked sent right after it goes out, so a second
 * run the same day sends nothing again. Each step runs even if an earlier one failed.
 */
export async function runDaily(env: Bindings, now: Date): Promise<DailySummary> {
  const iso = now.toISOString();
  const summary: DailySummary = { reminded: 0, alerted: 0, resent: 0, pendingDeleted: 0, ghostsDeleted: 0, tokensDeleted: 0, sessionsDeleted: 0, rateLimitRowsDeleted: 0 };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      console.error(JSON.stringify({ event: "jobs.daily.step_failed", step: name, error: String(err) }));
    }
  };
  const mailer = getMailer(env);

  await step("remind", async () => {
    for (const item of await listInquiriesToRemind(env.DB, before(now, REMIND_AFTER_MS))) {
      const builder = await findUserById(env.DB, item.inquiry.builderId);
      if (!builder) continue;
      const locale = isLocale(builder.locale) ? builder.locale : "en";
      try {
        await mailer.send({ to: builder.email, ...inquiryReminderEmail(locale, { clientName: item.inquiry.clientName, productName: item.productName, url: inquiryUrl(env, locale, item.inquiry.id, "builder") }) });
        await markReminded(env.DB, item.inquiry.id, iso);
        summary.reminded++;
      } catch (err) {
        console.error(JSON.stringify({ event: "jobs.daily.remind_failed", inquiryId: item.inquiry.id, error: String(err) }));
      }
    }
  });

  await step("alert", async () => {
    const late = await listInquiriesToAlert(env.DB, before(now, ALERT_AFTER_MS));
    const admins = [...adminEmails(env)];
    if (late.length === 0 || admins.length === 0) return;
    const mail = inquiryAdminAlertEmail(
      late.map((i) => ({ id: i.inquiry.id, builderHandle: i.builderHandle, productName: i.productName, openedAt: i.inquiry.openedAt ?? i.inquiry.createdAt })),
      new URL("/admin/inquiries?status=open", env.APP_ORIGIN).toString(),
    );
    for (const to of admins) await mailer.send({ to, ...mail });
    await markAlerted(env.DB, late.map((i) => i.inquiry.id), iso);
    summary.alerted = late.length;
  });

  await step("resend", async () => {
    for (const message of await listUnnotifiedMessages(env.DB)) {
      if ((await notifyInquiryMessage(env, message.id, now)) === "sent") summary.resent++;
    }
  });

  await step("pending", async () => {
    summary.pendingDeleted = await deleteExpiredPendingInquiries(env.DB, before(now, PENDING_TTL_MS));
  });
  // After the pending inquiries are gone, their implicit accounts have nothing attached (Owner 2026-10-04).
  await step("ghosts", async () => {
    summary.ghostsDeleted = await deleteGhostUsers(env.DB, before(now, PENDING_TTL_MS));
  });
  await step("tokens", async () => {
    summary.tokensDeleted = await deleteExpiredTokens(env.DB, now);
  });
  await step("sessions", async () => {
    summary.sessionsDeleted = await deleteExpiredSessions(env.DB, now);
  });
  await step("rate_limits", async () => {
    summary.rateLimitRowsDeleted = await deleteOldRateLimitWindows(env.DB, now.getTime());
  });

  console.log(JSON.stringify({ event: "jobs.daily.done", ...summary }));
  return summary;
}
