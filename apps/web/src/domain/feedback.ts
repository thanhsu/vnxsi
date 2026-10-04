import { z } from "zod";
import { normalizeNewlines } from "./product-input.ts";
import { WAITLIST_EMAIL_RE } from "./waitlist-input.ts";

/** Contact form and the `feedback` table (plan VNX-0710). Pure rules: no Hono, no D1. */

/** Where contact messages are delivered. The one place the address lives in code. */
export const CONTACT_EMAIL = "contact@vnx.si";

export const FEEDBACK_ROLES = ["builder", "client", "other"] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];
export const FEEDBACK_KINDS = ["question", "suggestion", "partnership", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_STATUSES = ["new", "handled", "spam"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
/** The page the form was sent from; it decides where the sender lands afterwards. */
export type FeedbackSource = "contact" | "landing";

export const FEEDBACK_MESSAGE_MIN = 20;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_NAME_MAX = 100;
export const FEEDBACK_EMAIL_MAX = 254;
/** Rate limit `contact:ip:<ip>`: this many messages per IP per hour. */
export const CONTACT_HOURLY_LIMIT_PER_IP = 5;
/** Rows per page on /admin/feedback. */
export const FEEDBACK_PAGE_SIZE = 50;

export interface Feedback {
  id: string;
  role: FeedbackRole;
  kind: FeedbackKind;
  name: string | null;
  email: string;
  message: string;
  locale: string;
  userId: string | null;
  status: FeedbackStatus;
  notifiedAt: string | null;
  handledAt: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackFormValues = { role: string; kind: string; name: string; email: string; message: string; consent: boolean; website: string; from: string };
export type FeedbackField = "role" | "kind" | "name" | "email" | "message" | "consent";
export type FeedbackFieldError = "choice" | "email" | "length" | "consent" | "too_long" | "invalid";
export type FeedbackErrors = Partial<Record<FeedbackField, FeedbackFieldError>>;
export interface FeedbackInput {
  role: FeedbackRole;
  kind: FeedbackKind;
  name: string | null;
  email: string;
  message: string;
}

const text = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");

export function feedbackValuesFromBody(body: Record<string, unknown>): FeedbackFormValues {
  return {
    role: text(body.role),
    kind: text(body.kind),
    name: text(body.name),
    email: text(body.email),
    message: text(body.message),
    consent: body.consent === "on",
    website: text(body.website),
    from: text(body.from),
  };
}

export function feedbackSource(value: string): FeedbackSource {
  return value === "landing" ? "landing" : "contact";
}

/** The honeypot field is hidden from people; anything typed into it means a bot. */
export function isFeedbackHoneypotFilled(values: FeedbackFormValues): boolean {
  return values.website.trim() !== "";
}

const CONTROL = /[\p{Cc}\p{Cf}]/u;

const Role = z.enum(FEEDBACK_ROLES);
const Kind = z.enum(FEEDBACK_KINDS);
/** Same check as the waitlist form, lower-cased, at most 254 characters. */
const Email = z.string().trim().toLowerCase().max(FEEDBACK_EMAIL_MAX).regex(WAITLIST_EMAIL_RE);
const Message = z.string().trim().min(FEEDBACK_MESSAGE_MIN).max(FEEDBACK_MESSAGE_MAX);

export function parseFeedbackForm(values: FeedbackFormValues): { ok: true; input: FeedbackInput } | { ok: false; errors: FeedbackErrors } {
  const errors: FeedbackErrors = {};
  const role = Role.safeParse(values.role);
  if (!role.success) errors.role = "choice";
  const kind = Kind.safeParse(values.kind);
  if (!kind.success) errors.kind = "choice";

  const name = values.name.trim();
  if (name.length > FEEDBACK_NAME_MAX) errors.name = "too_long";
  else if (CONTROL.test(name)) errors.name = "invalid";

  const email = Email.safeParse(values.email);
  if (!email.success) errors.email = "email";
  const message = Message.safeParse(values.message);
  if (!message.success) errors.message = "length";
  if (!values.consent) errors.consent = "consent";

  if (!role.success || !kind.success || !email.success || !message.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { role: role.data, kind: kind.data, name: name === "" ? null : name, email: email.data, message: message.data } };
}

export type FeedbackAction = "handle" | "spam" | "reopen";
export const FEEDBACK_ACTIONS: readonly FeedbackAction[] = ["handle", "spam", "reopen"];
export type FeedbackTransition = { ok: true; status: FeedbackStatus } | { ok: false; error: "invalid_transition" };

/** new → handled, new → spam, handled → new, spam → new (plan VNX-0710). */
export function feedbackTransition(status: FeedbackStatus, action: FeedbackAction): FeedbackTransition {
  if (action === "handle" && status === "new") return { ok: true, status: "handled" };
  if (action === "spam" && status === "new") return { ok: true, status: "spam" };
  if (action === "reopen" && status !== "new") return { ok: true, status: "new" };
  return { ok: false, error: "invalid_transition" };
}
