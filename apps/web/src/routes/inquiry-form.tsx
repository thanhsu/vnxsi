import type { Context, Hono } from "hono";
import { sha256Hex } from "../auth/crypto.ts";
import { createLoginToken } from "../auth/tokens.ts";
import { writeAudit } from "../db/audit.ts";
import { findPublicBuilderByHandle } from "../db/builders.ts";
import { createInquiry, deletePendingInquiryStatements } from "../db/inquiries.ts";
import { findPublicProductBySlug } from "../db/products.ts";
import { createUser, findUserByEmail, findUserById } from "../db/users.ts";
import { HANDLE_RE } from "../domain/builder-input.ts";
import {
  INQUIRY_HOURLY_LIMIT_PER_IP,
  inquiryValuesFromBody,
  isHoneypotFilled,
  parseInquiryForm,
  PRODUCT_INQUIRY_TYPES,
  type InquiryErrors,
  type InquiryFormValues,
  type InquiryType,
} from "../domain/inquiry.ts";
import { SLUG_RE } from "../domain/slug.ts";
import { getMailer } from "../email/index.ts";
import { inquiryConfirmEmail } from "../email/templates/inquiry.ts";
import type { AppEnv } from "../env.ts";
import { localizedPath } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { TURNSTILE_FIELD, turnstileSiteKey, verifyTurnstile } from "../http/turnstile.ts";
import { notifyInquiryMessage } from "../notify/inquiry.ts";
import { errorResponse } from "../views/error-response.tsx";
import { InquiryFormPage, InquirySentPage, type InquiryTarget } from "../views/InquiryFormPage.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;

type Resolved = InquiryTarget & { builderId: string; productId: string | null; allowed: readonly InquiryType[] };

/** The public product or builder the form is for, with the types it offers (spec §5.2); null = 404. */
async function resolveTarget(c: Context<AppEnv>): Promise<Resolved | null> {
  const locale = c.get("locale");
  const slug = c.req.param("slug");
  if (slug !== undefined) {
    if (!SLUG_RE.test(slug)) return null;
    const item = await findPublicProductBySlug(c.env.DB, slug);
    if (!item) return null;
    const allowed = PRODUCT_INQUIRY_TYPES.filter((t) => t !== "customize" || item.product.customizable);
    const rest = `/p/${slug}/inquiry/${c.req.param("type") ?? ""}`;
    return { builderName: item.builderName, productName: item.product.name, action: localizedPath(locale, rest), rest, builderId: item.product.builderId, productId: item.product.id, allowed };
  }
  const handle = c.req.param("handle") ?? "";
  if (!HANDLE_RE.test(handle)) return null;
  const builder = await findPublicBuilderByHandle(c.env.DB, handle);
  if (!builder) return null;
  const rest = `/b/${handle}/hire`;
  return { builderName: builder.name, productName: null, action: localizedPath(locale, rest), rest, builderId: builder.userId, productId: null, allowed: ["hire"] };
}

function requestedType(c: Context<AppEnv>, target: Resolved): InquiryType | null {
  const type = (c.req.param("type") ?? "hire") as InquiryType;
  return target.allowed.includes(type) ? type : null;
}

function emptyValues(type: InquiryType, name: string): InquiryFormValues {
  return { type, message: "", budgetBand: "unsure", deadline: "", name, email: "", website: "" };
}

function formPage(c: Context<AppEnv>, target: Resolved, type: InquiryType, values: InquiryFormValues, errors: InquiryErrors, status: 200 | 400 | 429 | 502 | 503 = 200, formError?: string) {
  return page(
    c,
    <InquiryFormPage locale={c.get("locale")} origin={siteOrigin(c)} target={target} type={type} signedIn={c.get("user") !== null} values={values} errors={errors} siteKey={turnstileSiteKey(c.env)} formError={formError} />,
    status,
  );
}

async function showForm(c: Context<AppEnv>) {
  const target = await resolveTarget(c);
  const type = target ? requestedType(c, target) : null;
  if (!target || !type) return errorResponse(c, "notFound", 404);
  const user = c.get("user");
  const name = user ? ((await findUserById(c.env.DB, user.id))?.display_name ?? "") : "";
  return formPage(c, target, type, emptyValues(type, name), {});
}

async function submitForm(c: Context<AppEnv>) {
  const target = await resolveTarget(c);
  const type = target ? requestedType(c, target) : null;
  if (!target || !type) return errorResponse(c, "notFound", 404);
  const locale = c.get("locale");
  const tr = translator(locale);
  const user = c.get("user");
  const body = await c.req.parseBody();
  const values = { ...inquiryValuesFromBody(body), type };
  const sentPage = (email: string) => page(c, <InquirySentPage locale={locale} origin={siteOrigin(c)} email={email} rest={target.rest} />);

  // Honeypot: look like success, create nothing.
  if (isHoneypotFilled(values)) return user ? c.redirect(localizedPath(locale, "/me"), 303) : sentPage(values.email.trim().toLowerCase());

  const now = new Date();
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const limit = await hitRateLimit(c.env.DB, `inquiry:ip:${ip}`, INQUIRY_HOURLY_LIMIT_PER_IP, HOUR, now.getTime());
  if (!limit.allowed) return formPage(c, target, type, values, {}, 429, tr("inquiry.error.rateLimited"));

  const parsed = parseInquiryForm(values, { allowedTypes: target.allowed, needEmail: user === null, today: now.toISOString().slice(0, 10) });
  if (!parsed.ok) return formPage(c, target, type, values, parsed.errors, 400);
  const input = parsed.input;
  const iso = now.toISOString();

  if (user) {
    if (user.id === target.builderId) return formPage(c, target, type, values, {}, 400, tr("inquiry.error.self"));
    const { inquiry, firstMessageId } = await createInquiry(c.env.DB, { clientUserId: user.id, clientName: input.name, builderId: target.builderId, productId: target.productId, type, message: input.message, budgetBand: input.budgetBand, deadline: input.deadline, status: "open", locale, now: iso });
    await writeAudit(c.env.DB, { actorUserId: user.id, action: "inquiry.create", entity: "inquiry", entityId: inquiry.id, data: { type, status: "open" }, now: iso });
    await notifyInquiryMessage(c.env, firstMessageId, now);
    return c.redirect(localizedPath(locale, `/me/inquiries/${inquiry.id}`), 303);
  }

  const captcha = await verifyTurnstile(c.env, body[TURNSTILE_FIELD], ip === "unknown" ? null : ip);
  if (captcha === "unavailable") return formPage(c, target, type, values, {}, 503, tr("inquiry.form.unavailable"));
  if (captcha === "fail") return formPage(c, target, type, values, {}, 400, tr("inquiry.error.captcha"));

  const email = input.email!;
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing?.id === target.builderId) return formPage(c, target, type, values, {}, 400, tr("inquiry.error.self"));
  // A suspended account gets the same answer as anyone else and nothing happens (no account status leak).
  if (existing && existing.status !== "active") return sentPage(email);
  // Spec §5.6: an implicit account; the daily job removes it if never confirmed (Owner 2026-10-04).
  const client = existing ?? (await createUser(c.env.DB, { email, locale, now: iso }));
  const { inquiry } = await createInquiry(c.env.DB, { clientUserId: client.id, clientName: input.name, builderId: target.builderId, productId: target.productId, type, message: input.message, budgetBand: input.budgetBand, deadline: input.deadline, status: "pending_verification", locale, now: iso });
  const token = await createLoginToken(c.env.DB, { email, purpose: "inquiry_verify", locale, inquiryId: inquiry.id }, now);
  const link = new URL("/auth/verify", c.env.APP_ORIGIN);
  link.searchParams.set("t", token);
  try {
    await getMailer(c.env).send({ to: email, ...inquiryConfirmEmail(locale, { builderName: target.builderName, productName: target.productName, link: link.toString() }) });
  } catch (err) {
    console.error(JSON.stringify({ requestId: c.get("requestId"), event: "inquiry.confirm_mail_failed", emailHash: await sha256Hex(email), error: String(err) }));
    await c.env.DB.batch(deletePendingInquiryStatements(c.env.DB, inquiry.id));
    return formPage(c, target, type, values, {}, 502, tr("inquiry.error.sendFailed"));
  }
  await writeAudit(c.env.DB, { actorUserId: null, action: "inquiry.create", entity: "inquiry", entityId: inquiry.id, data: { type, status: "pending_verification" }, now: iso });
  return sentPage(email);
}

export function registerInquiryFormRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/p/:slug/inquiry/:type", showForm);
  onLocalized(app, "post", "/p/:slug/inquiry/:type", submitForm);
  onLocalized(app, "get", "/b/:handle/hire", showForm);
  onLocalized(app, "post", "/b/:handle/hire", submitForm);
}
