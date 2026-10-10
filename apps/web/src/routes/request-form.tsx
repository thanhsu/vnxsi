import type { Context, Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { createLoginToken } from "../auth/tokens.ts";
import { auditStatement, writeAudit } from "../db/audit.ts";
import { optInStatement, publicationAuditGuard, returnedPublication } from "../db/request-board.ts";
import { createRequest, createRequestStatements, deletePendingRequestStatement, type NewRequest } from "../db/requests.ts";
import { createUser, findUserByEmail, findUserById, type UserRow } from "../db/users.ts";
import {
  isRequestHoneypotFilled,
  parseRequestForm,
  REQUEST_DAILY_LIMIT_PER_EMAIL,
  REQUEST_HOURLY_LIMIT_PER_IP,
  requestValuesFromBody,
  type RequestErrors,
  type RequestFormValues,
  type RequestInput,
} from "../domain/request.ts";
import { getMailer } from "../email/index.ts";
import type { Mailer } from "../email/mailer.ts";
import { requestConfirmEmail } from "../email/templates/request.ts";
import type { AppEnv, Bindings } from "../env.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from "../http/turnstile.ts";
import { notifyRequestSubmitted } from "../notify/request.ts";
import { page } from "../views/render.ts";
import { RequestFormPage, RequestSentPage } from "../views/RequestFormPage.tsx";

const HOUR = 3600;
const DAY = 86400;

const emailKey = async (email: string) => `request:email:${await sha256Hex(email)}`;

function emptyValues(name: string): RequestFormValues {
  return { title: "", description: "", category: "", budgetBand: "unsure", deadline: "", languages: [], name, email: "", website: "", country: "", publish: false };
}

function formPage(c: Context<AppEnv>, values: RequestFormValues, errors: RequestErrors, status: 200 | 400 | 429 | 502 | 503 = 200, formError?: string) {
  return page(c, <RequestFormPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} values={values} errors={errors} siteKey={turnstileSiteKey(c.env)} board={c.get("requestBoard")} formError={formError} />, status);
}

type Publish = { consentVersion: string };

/**
 * EPIC 27 opt-in: ONE db.batch holding the request INSERT, the publication INSERT (pending_review), the request's own audit row and
 * the `request_publication.opt_in` audit row. Both audit rows are guarded on their write, so a lost write leaves no audit row. The
 * data of the opt-in audit is the consent version only, never wording or anything about the client (L3). A publication that did not
 * insert (0 rows) is a broken invariant, not a user error: logged, then thrown (500), never silent.
 */
async function createRequestWithOptIn(db: D1Database, args: { request: NewRequest; auditAction: "request.submit" | "request.create"; auditActor: string | null; auditData: Record<string, unknown>; publish: Publish }): Promise<string> {
  const { request, publish } = args;
  const { id, statements } = createRequestStatements(db, request);
  const now = request.now;
  const results = await db.batch([
    ...statements,
    optInStatement(db, { requestId: id, consentVersion: publish.consentVersion, now, clientUserId: request.clientUserId }),
    auditStatement(db, { actorUserId: args.auditActor, action: args.auditAction, entity: "request", entityId: id, data: args.auditData, now }, { requestId: id, status: request.status, updatedAt: now }),
    auditStatement(db, { actorUserId: request.clientUserId, action: "request_publication.opt_in", entity: "request_publication", entityId: id, data: { consentVersion: publish.consentVersion }, now }, publicationAuditGuard({ requestId: id, status: "pending_review", updatedAt: now })),
  ]);
  if (!returnedPublication(results[1])) {
    console.error(JSON.stringify({ event: "request.opt_in_not_inserted", requestId: id }));
    throw new Error("request opt-in: the publication row was not inserted");
  }
  return id;
}

/**
 * Signed-out path after every check passed: the pending request, its confirmation link and e-mail. A failed e-mail
 * removes the request again (spec §8.3: the form says so). Exported for the mail-failure test.
 */
export async function createPendingRequestAndMail(
  env: Bindings,
  args: { client: UserRow; input: RequestInput; locale: Locale; now: Date; publish?: Publish },
  mailer: Mailer = getMailer(env),
): Promise<"sent" | "send_failed"> {
  const { client, input, locale, now, publish } = args;
  const iso = now.toISOString();
  const fields: NewRequest = { clientUserId: client.id, clientName: input.name, title: input.title, description: input.description, category: input.category, budgetBand: input.budgetBand, deadline: input.deadline, languages: input.languages, status: "pending_verification", locale, country: input.country, now: iso };
  // With the opt-in the request, its publication and the audit rows commit together BEFORE the e-mail (L3: a failed e-mail removes the
  // request and, by cascade, the publication; the audit rows stay, holding ids and the consent version only). Without it: unchanged.
  const request = publish
    ? { id: await createRequestWithOptIn(env.DB, { request: fields, auditAction: "request.create", auditActor: null, auditData: { status: "pending_verification" }, publish }), title: input.title }
    : await createRequest(env.DB, fields);
  const token = await createLoginToken(env.DB, { email: client.email, purpose: "request_verify", locale, requestId: request.id }, now);
  const link = new URL("/auth/verify", env.APP_ORIGIN);
  link.searchParams.set("t", token);
  try {
    await mailer.send({ to: client.email, ...requestConfirmEmail(locale, { title: request.title, link: link.toString() }) });
  } catch (err) {
    console.error(JSON.stringify({ event: "request.confirm_mail_failed", requestId: request.id, error: String(err) }));
    await deletePendingRequestStatement(env.DB, request.id).run();
    return "send_failed";
  }
  if (!publish) await writeAudit(env.DB, { actorUserId: null, action: "request.create", entity: "request", entityId: request.id, data: { status: "pending_verification" }, now: iso });
  return "sent";
}

async function submitForm(c: Context<AppEnv>) {
  const locale = c.get("locale");
  const tr = translator(locale);
  const user = c.get("user");
  const body = await c.req.parseBody({ all: true });
  const values = requestValuesFromBody(body);
  const sentPage = (email: string) => page(c, <RequestSentPage locale={locale} origin={siteOrigin(c)} email={email} />);

  // Honeypot: look like success, create nothing.
  if (isRequestHoneypotFilled(values)) return user ? c.redirect(localizedPath(locale, "/me"), 303) : sentPage(values.email.trim().toLowerCase());

  const now = new Date();
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const parsed = parseRequestForm(values, { needEmail: user === null, today: now.toISOString().slice(0, 10) });
  if (!parsed.ok) return formPage(c, values, parsed.errors, 400);
  // Only well-formed forms count (M5 F4).
  const byIp = await hitRateLimit(c.env.DB, `request:ip:${ip}`, REQUEST_HOURLY_LIMIT_PER_IP, HOUR, now.getTime());
  if (!byIp.allowed) return formPage(c, values, {}, 429, tr("request.error.rateLimited"));
  const input = parsed.input;
  const iso = now.toISOString();
  // The box counts only while the board gate is on; with it off the value is ignored (no row, no error).
  const publish: Publish | undefined = values.publish && c.get("requestBoard") ? { consentVersion: c.env.REQUEST_BOARD_GO_LIVE ?? "" } : undefined;

  if (user) {
    // Spec §8.2: 3 requests a day per e-mail, the account's e-mail when signed in.
    const byEmail = await hitRateLimit(c.env.DB, await emailKey(user.email), REQUEST_DAILY_LIMIT_PER_EMAIL, DAY, now.getTime());
    if (!byEmail.allowed) return formPage(c, values, {}, 429, tr("request.error.dailyLimit"));
    const fields: NewRequest = { clientUserId: user.id, clientName: input.name, title: input.title, description: input.description, category: input.category, budgetBand: input.budgetBand, deadline: input.deadline, languages: input.languages, status: "submitted", locale, country: input.country, now: iso };
    const auditData = { category: input.category, languages: input.languages };
    let requestId: string;
    if (publish) {
      requestId = await createRequestWithOptIn(c.env.DB, { request: fields, auditAction: "request.submit", auditActor: user.id, auditData, publish });
    } else {
      const request = await createRequest(c.env.DB, fields);
      await writeAudit(c.env.DB, { actorUserId: user.id, action: "request.submit", entity: "request", entityId: request.id, data: auditData, now: iso });
      requestId = request.id;
    }
    await notifyRequestSubmitted(c.env, requestId);
    return c.redirect(localizedPath(locale, `/me/requests/${requestId}?sent=1`), 303);
  }

  const captcha = await verifyTurnstile(c.env, body[TURNSTILE_FIELD], ip === "unknown" ? null : ip);
  // Not configured: the page already says so in place of the form, so no second message.
  if (captcha === "unavailable") return formPage(c, values, {}, 503, turnstileSiteKey(c.env) === null ? undefined : tr("request.form.unavailable"));
  if (captcha === "fail") return formPage(c, values, {}, 400, tr("inquiry.error.captcha"));

  const email = input.email!;
  // Over the daily limit, or a suspended account: the same answer as success, nothing happens (no account status leak).
  const byEmail = await hitRateLimit(c.env.DB, await emailKey(email), REQUEST_DAILY_LIMIT_PER_EMAIL, DAY, now.getTime());
  if (!byEmail.allowed) return sentPage(email);
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing && existing.status !== "active") return sentPage(email);
  // Spec §5.7: an implicit account like an inquiry's; the daily job removes it if never confirmed.
  const client = existing ?? (await createUser(c.env.DB, { email, locale, now: iso }));
  const outcome = await createPendingRequestAndMail(c.env, { client, input, locale, now, publish });
  if (outcome === "send_failed") return formPage(c, values, {}, 502, tr("inquiry.error.sendFailed"));
  return sentPage(email);
}

export function registerRequestFormRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/request", async (c) => {
    const user = c.get("user");
    const name = user ? ((await findUserById(c.env.DB, user.id))?.display_name ?? "") : "";
    return formPage(c, emptyValues(name), {});
  });
  onLocalized(app, "post", "/request", submitForm);
}
