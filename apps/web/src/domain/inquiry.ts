import { z } from "zod";
import { normalizeNewlines } from "./product-input.ts";

export const INQUIRY_STATUSES = ["pending_verification", "open", "answered", "declined", "closed", "removed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_TYPES = ["buy", "customize", "hire", "build_similar", "request"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];
/** The product buttons (spec §5.2). "hire" is also the builder-profile button; "request" comes from M6. */
export const PRODUCT_INQUIRY_TYPES = ["buy", "customize", "hire", "build_similar"] as const satisfies readonly InquiryType[];
export const BUDGET_BANDS = ["<500", "500-2k", "2k-10k", ">10k", "unsure"] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];
export type MessageKind = "message" | "decline";

export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 2000;
export const REPLY_MAX = 4000;
export const NAME_MAX = 80;
export const DECLINE_REASON_MAX = 1000;
export const INQUIRY_HOURLY_LIMIT_PER_IP = 10;
export const PENDING_TTL_MS = 48 * 60 * 60 * 1000;
export const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const ALERT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Spec §8.3: a notification is tried at most this many times in all. */
export const MAX_NOTIFY_ATTEMPTS = 3;
const DEADLINE_MAX_YEARS = 5;

export interface Inquiry {
  id: string;
  clientUserId: string;
  clientName: string;
  builderId: string;
  productId: string | null;
  requestId: string | null;
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  status: InquiryStatus;
  locale: string;
  openedAt: string | null;
  lastActivityAt: string;
  builderRemindedAt: string | null;
  adminAlertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryMessage {
  id: string;
  inquiryId: string;
  senderUserId: string;
  kind: MessageKind;
  body: string;
  createdAt: string;
  notifiedAt: string | null;
  notifyAttempts: number;
}

/** What inquiry pages show: the inquiry with product and builder names. Never the client's e-mail (spec §5.6). */
export interface InquirySummary {
  inquiry: Inquiry;
  productName: string | null;
  productSlug: string | null;
  builderName: string;
  builderHandle: string;
}

/** Admin list row (spec §5.5): the admin may see the client's e-mail. */
export type AdminInquiry = InquirySummary & { clientEmail: string };

export type InquiryAction = "verify" | "reply" | "decline" | "close" | "remove";
export type InquiryActor = "system" | "client" | "builder" | "admin";
export type InquiryTransition = { ok: true; status: InquiryStatus } | { ok: false; error: "invalid_transition" };

const ACTIVE: readonly InquiryStatus[] = ["open", "answered"];

export function canPostMessage(status: InquiryStatus): boolean {
  return ACTIVE.includes(status);
}

/** Spec §7.3. A builder reply moves open to answered; a client reply keeps the status. */
export function transition(status: InquiryStatus, action: InquiryAction, actor: InquiryActor): InquiryTransition {
  const fail = { ok: false, error: "invalid_transition" } as const;
  switch (action) {
    case "verify":
      return actor === "system" && status === "pending_verification" ? { ok: true, status: "open" } : fail;
    case "reply":
      if (!canPostMessage(status)) return fail;
      if (actor === "builder") return { ok: true, status: "answered" };
      return actor === "client" ? { ok: true, status } : fail;
    case "decline":
      return actor === "builder" && status === "open" ? { ok: true, status: "declined" } : fail;
    case "close":
      return (actor === "client" || actor === "builder") && canPostMessage(status) ? { ok: true, status: "closed" } : fail;
    case "remove":
      return actor === "admin" && status !== "removed" ? { ok: true, status: "removed" } : fail;
  }
}

export type InquiryFormValues = { type: string; message: string; budgetBand: string; deadline: string; name: string; email: string; website: string };
export type InquiryField = "type" | "message" | "budgetBand" | "deadline" | "name" | "email";
export type InquiryFieldError = "required" | "too_short" | "too_long" | "choice" | "date" | "email" | "invalid";
export type InquiryErrors = Partial<Record<InquiryField, InquiryFieldError>>;
export interface InquiryInput {
  type: InquiryType;
  message: string;
  budgetBand: BudgetBand;
  deadline: string | null;
  name: string;
  email: string | null;
}

const text = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

export function inquiryValuesFromBody(body: Record<string, unknown>): InquiryFormValues {
  return {
    type: text(body.type),
    message: text(body.message),
    budgetBand: text(body.budgetBand),
    deadline: text(body.deadline).trim(),
    name: text(body.name),
    email: text(body.email),
    website: text(body.website),
  };
}

/** The honeypot field is hidden from people; anything typed into it means a bot. */
export function isHoneypotFilled(values: InquiryFormValues): boolean {
  return values.website.trim() !== "";
}

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const CONTROL = /[\p{Cc}\p{Cf}]/u;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Spec §5.6 form. `today` is the UTC date (YYYY-MM-DD); deadlines run from today to 5 years ahead. */
export function parseInquiryForm(
  values: InquiryFormValues,
  opts: { allowedTypes: readonly InquiryType[]; needEmail: boolean; today: string },
): { ok: true; input: InquiryInput } | { ok: false; errors: InquiryErrors } {
  const errors: InquiryErrors = {};
  const type = (opts.allowedTypes as readonly string[]).includes(values.type) ? (values.type as InquiryType) : null;
  if (!type) errors.type = "choice";

  const message = values.message.trim();
  if (!message) errors.message = "required";
  else if (message.length < MESSAGE_MIN) errors.message = "too_short";
  else if (message.length > MESSAGE_MAX) errors.message = "too_long";

  const budgetBand = (BUDGET_BANDS as readonly string[]).includes(values.budgetBand) ? (values.budgetBand as BudgetBand) : null;
  if (!budgetBand) errors.budgetBand = "choice";

  let deadline: string | null = null;
  if (values.deadline) {
    const latest = `${Number(opts.today.slice(0, 4)) + DEADLINE_MAX_YEARS}${opts.today.slice(4)}`;
    if (!isCalendarDate(values.deadline) || values.deadline < opts.today || values.deadline > latest) errors.deadline = "date";
    else deadline = values.deadline;
  }

  const name = values.name.trim();
  if (!name) errors.name = "required";
  else if (name.length > NAME_MAX) errors.name = "too_long";
  else if (CONTROL.test(name)) errors.name = "invalid";

  let email: string | null = null;
  if (opts.needEmail) {
    const parsed = Email.safeParse(values.email);
    if (parsed.success) email = parsed.data;
    else errors.email = "email";
  }

  if (Object.keys(errors).length > 0 || !type || !budgetBand) return { ok: false, errors };
  return { ok: true, input: { type, message, budgetBand, deadline, name, email } };
}

export function parseMessageBody(raw: unknown): { ok: true; body: string } | { ok: false; error: "required" | "too_long" } {
  const body = text(raw).trim();
  if (!body) return { ok: false, error: "required" };
  if (body.length > REPLY_MAX) return { ok: false, error: "too_long" };
  return { ok: true, body };
}

export function parseDeclineReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: "too_long" } {
  const reason = text(raw).trim();
  return reason.length > DECLINE_REASON_MAX ? { ok: false, error: "too_long" } : { ok: true, reason };
}
