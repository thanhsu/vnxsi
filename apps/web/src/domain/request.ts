import type { Availability, WorkLanguage } from "./builder.ts";
import { WORK_LANGUAGES } from "./builder.ts";
import { BUDGET_BANDS, parseClientEmail, parseClientName, parseDeadline, type BudgetBand } from "./inquiry.ts";
import { CATEGORIES, type Category } from "./product.ts";
import { normalizeNewlines } from "./product-input.ts";

export const REQUEST_STATUSES = ["pending_verification", "submitted", "matching", "builder_selected", "rejected", "expired", "closed", "removed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const TERMINAL_REQUEST_STATUSES = ["builder_selected", "rejected", "expired", "closed", "removed"] as const satisfies readonly RequestStatus[];
export type TerminalRequestStatus = (typeof TERMINAL_REQUEST_STATUSES)[number];
export const INVITE_STATUSES = ["invited", "proposed", "selected", "not_selected", "declined", "expired"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
/** Invitations that count against the cap of 5 (spec §7.6). */
export const ACTIVE_INVITE_STATUSES = ["invited", "proposed"] as const satisfies readonly InviteStatus[];
export const PRICE_MODES = ["fixed", "range", "discuss"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 40;
export const DESCRIPTION_MAX = 4000;
export const APPROACH_MAX = 2000;
export const PRICE_NOTE_MAX = 200;
export const PRICE_MAX_USD = 1_000_000;
export const TIMELINE_MAX_DAYS = 365;
export const ADMIN_NOTE_MAX = 1000;
export const MAX_ACTIVE_INVITES = 5;
export const SUGGESTION_LIMIT = 10;
export const SKILL_POINTS_MAX = 3;
export const REQUEST_DAILY_LIMIT_PER_EMAIL = 3;
export const REQUEST_HOURLY_LIMIT_PER_IP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_REMIND_AFTER_MS = 3 * DAY_MS;
export const INVITE_TTL_MS = 7 * DAY_MS;
export const MATCHING_TTL_MS = 30 * DAY_MS;
export const EXPIRED_PENALTY_WINDOW_MS = 60 * DAY_MS;

export interface ClientRequest {
  id: string;
  clientUserId: string;
  clientName: string;
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  status: RequestStatus;
  locale: string;
  adminNote: string | null;
  selectedInviteId: string | null;
  submittedAt: string | null;
  matchedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestInvite {
  id: string;
  requestId: string;
  builderId: string;
  invitedBy: string;
  status: InviteStatus;
  approach: string | null;
  priceCents: number | null;
  priceMaxCents: number | null;
  priceNote: string | null;
  timelineDays: number | null;
  declineReason: string | null;
  invitedAt: string;
  respondedAt: string | null;
  remindedAt: string | null;
  inquiryId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An invitation with the builder's public name (admin, /me). `builderPublic` = approved builder on an active account. */
export interface InviteWithBuilder {
  invite: RequestInvite;
  builderName: string;
  builderHandle: string;
  builderPublic: boolean;
}

/** Admin rows (spec §5.5): the admin may see the client's e-mail. */
export interface AdminRequest {
  request: ClientRequest;
  clientEmail: string;
  activeInvites: number;
  totalInvites: number;
  proposals: number;
}

/** A row of the builder's Invitations tab. */
export interface InvitationListItem {
  invite: RequestInvite;
  requestTitle: string;
  requestCategory: Category;
  requestStatus: RequestStatus;
}

/** What an invited builder sees (spec §5.7 step 3): the request with the client's typed name; there is no e-mail in it. */
export interface Invitation {
  invite: RequestInvite;
  request: ClientRequest;
}

export type RequestAction = "verify" | "invite" | "reject" | "select" | "close" | "expire" | "remove";
export type RequestActor = "system" | "client" | "admin";
export type RequestTransition = { ok: true; status: RequestStatus } | { ok: false; error: "invalid_transition" };

const REQUEST_RULES: Record<RequestAction, { from: readonly RequestStatus[] | "any"; to: RequestStatus; actor: RequestActor }> = {
  verify: { from: ["pending_verification"], to: "submitted", actor: "system" },
  invite: { from: ["submitted", "matching"], to: "matching", actor: "admin" },
  reject: { from: ["submitted"], to: "rejected", actor: "admin" },
  select: { from: ["matching"], to: "builder_selected", actor: "client" },
  close: { from: ["submitted", "matching"], to: "closed", actor: "client" },
  expire: { from: ["matching"], to: "expired", actor: "system" },
  remove: { from: "any", to: "removed", actor: "admin" },
};

/** Spec §7.5. */
export function requestTransition(status: RequestStatus, action: RequestAction, actor: RequestActor): RequestTransition {
  const rule = REQUEST_RULES[action];
  const allowed = rule.from === "any" ? status !== "removed" : rule.from.includes(status);
  return rule.actor === actor && allowed ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}

export function isTerminalRequest(status: RequestStatus): status is TerminalRequestStatus {
  return (TERMINAL_REQUEST_STATUSES as readonly string[]).includes(status);
}

export type InviteAction = "propose" | "decline" | "select" | "not_select" | "expire";
export type InviteActor = "builder" | "client" | "system";
export type InviteTransition = { ok: true; status: InviteStatus } | { ok: false; error: "invalid_transition" };

const INVITE_RULES: Record<InviteAction, { from: InviteStatus; to: InviteStatus; actor: InviteActor }> = {
  propose: { from: "invited", to: "proposed", actor: "builder" },
  decline: { from: "invited", to: "declined", actor: "builder" },
  select: { from: "proposed", to: "selected", actor: "client" },
  not_select: { from: "proposed", to: "not_selected", actor: "system" },
  expire: { from: "invited", to: "expired", actor: "system" },
};

/** Spec §7.6. */
export function inviteTransition(status: InviteStatus, action: InviteAction, actor: InviteActor): InviteTransition {
  const rule = INVITE_RULES[action];
  return rule.from === status && rule.actor === actor ? { ok: true, status: rule.to } : { ok: false, error: "invalid_transition" };
}

const text = (value: unknown) => (typeof value === "string" ? normalizeNewlines(value) : "");
const CONTROL = /[\p{Cc}\p{Cf}]/u;

export type RequestFormValues = {
  title: string;
  description: string;
  category: string;
  budgetBand: string;
  deadline: string;
  languages: string[];
  name: string;
  email: string;
  website: string;
};
export type RequestField = "title" | "description" | "category" | "budgetBand" | "deadline" | "languages" | "name" | "email";
export type RequestFieldError = "required" | "too_short" | "too_long" | "choice" | "date" | "email" | "invalid";
export type RequestErrors = Partial<Record<RequestField, RequestFieldError>>;
export interface RequestInput {
  title: string;
  description: string;
  category: Category;
  budgetBand: BudgetBand;
  deadline: string | null;
  languages: WorkLanguage[];
  name: string;
  email: string | null;
}

/** `body` from `c.req.parseBody({ all: true })`: a repeated field arrives as an array. */
export function requestValuesFromBody(body: Record<string, unknown>): RequestFormValues {
  const raw = body.languages;
  const languages = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).filter((v): v is string => typeof v === "string");
  const one = (value: unknown) => text(Array.isArray(value) ? value[0] : value);
  return {
    title: one(body.title),
    description: one(body.description),
    category: one(body.category),
    budgetBand: one(body.budgetBand),
    deadline: one(body.deadline).trim(),
    languages,
    name: one(body.name),
    email: one(body.email),
    website: one(body.website),
  };
}

export function isRequestHoneypotFilled(values: RequestFormValues): boolean {
  return values.website.trim() !== "";
}

/** Spec §5.7 step 1. `today` is the UTC date (YYYY-MM-DD). */
export function parseRequestForm(values: RequestFormValues, opts: { needEmail: boolean; today: string }): { ok: true; input: RequestInput } | { ok: false; errors: RequestErrors } {
  const errors: RequestErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = "required";
  else if (title.length > TITLE_MAX) errors.title = "too_long";
  else if (CONTROL.test(title)) errors.title = "invalid";

  const description = values.description.trim();
  if (!description) errors.description = "required";
  else if (description.length < DESCRIPTION_MIN) errors.description = "too_short";
  else if (description.length > DESCRIPTION_MAX) errors.description = "too_long";

  const category = (CATEGORIES as readonly string[]).includes(values.category) ? (values.category as Category) : null;
  if (!category) errors.category = "choice";

  const budgetBand = (BUDGET_BANDS as readonly string[]).includes(values.budgetBand) ? (values.budgetBand as BudgetBand) : null;
  if (!budgetBand) errors.budgetBand = "choice";

  const due = parseDeadline(values.deadline, opts.today);
  if (!due.ok) errors.deadline = "date";

  const known = values.languages.every((l) => (WORK_LANGUAGES as readonly string[]).includes(l));
  const languages = WORK_LANGUAGES.filter((l) => values.languages.includes(l));
  if (!known || languages.length === 0) errors.languages = "choice";

  const named = parseClientName(values.name);
  if (!named.ok) errors.name = named.error;

  let email: string | null = null;
  if (opts.needEmail) {
    email = parseClientEmail(values.email);
    if (!email) errors.email = "email";
  }

  if (Object.keys(errors).length > 0 || !category || !budgetBand || !due.ok || !named.ok) return { ok: false, errors };
  return { ok: true, input: { title, description, category, budgetBand, deadline: due.deadline, languages, name: named.name, email } };
}

export type ProposalFormValues = { approach: string; priceMode: string; price: string; priceMax: string; priceNote: string; timelineDays: string };
export type ProposalField = keyof ProposalFormValues;
export type ProposalFieldError = "required" | "too_long" | "choice" | "amount" | "range" | "days";
export type ProposalErrors = Partial<Record<ProposalField, ProposalFieldError>>;
export interface ProposalInput {
  approach: string;
  priceCents: number | null;
  priceMaxCents: number | null;
  priceNote: string;
  timelineDays: number;
}

export function proposalValuesFromBody(body: Record<string, unknown>): ProposalFormValues {
  return {
    approach: text(body.approach),
    priceMode: text(body.priceMode),
    price: text(body.price).trim(),
    priceMax: text(body.priceMax).trim(),
    priceNote: text(body.priceNote),
    timelineDays: text(body.timelineDays).trim(),
  };
}

/** Whole US dollars, 1 – PRICE_MAX_USD, as cents; anything else is null. */
function wholeUsdCents(raw: string): number | null {
  if (!/^\d{1,7}$/.test(raw)) return null;
  const usd = Number(raw);
  return usd >= 1 && usd <= PRICE_MAX_USD ? usd * 100 : null;
}

/** Spec §5.7 step 3: approach, a price (amount, range or "to discuss"), and a timeline in days. */
export function parseProposal(values: ProposalFormValues): { ok: true; input: ProposalInput } | { ok: false; errors: ProposalErrors } {
  const errors: ProposalErrors = {};
  const approach = values.approach.trim();
  if (!approach) errors.approach = "required";
  else if (approach.length > APPROACH_MAX) errors.approach = "too_long";

  let priceCents: number | null = null;
  let priceMaxCents: number | null = null;
  const mode = (PRICE_MODES as readonly string[]).includes(values.priceMode) ? (values.priceMode as PriceMode) : null;
  if (!mode) errors.priceMode = "choice";
  if (mode === "fixed" || mode === "range") {
    priceCents = wholeUsdCents(values.price);
    if (priceCents === null) errors.price = "amount";
  }
  if (mode === "range") {
    priceMaxCents = wholeUsdCents(values.priceMax);
    if (priceMaxCents === null) errors.priceMax = "amount";
    else if (priceCents !== null && priceMaxCents <= priceCents) errors.priceMax = "range";
  }

  const priceNote = values.priceNote.trim();
  if (priceNote.length > PRICE_NOTE_MAX) errors.priceNote = "too_long";

  const days = /^\d{1,3}$/.test(values.timelineDays) ? Number(values.timelineDays) : 0;
  if (days < 1 || days > TIMELINE_MAX_DAYS) errors.timelineDays = "days";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { approach, priceCents, priceMaxCents, priceNote, timelineDays: days } };
}

/** The reason given to the client when the admin returns a request (spec §5.5: required). */
export function parseAdminNote(raw: unknown): { ok: true; note: string } | { ok: false; error: "required" | "too_long" } {
  const note = text(raw).trim();
  if (!note) return { ok: false, error: "required" };
  return note.length > ADMIN_NOTE_MAX ? { ok: false, error: "too_long" } : { ok: true, note };
}

/** A builder the admin may invite (db/requests listCandidates already dropped the ineligible ones). */
export interface Candidate {
  userId: string;
  handle: string;
  name: string;
  availability: Availability;
  skills: string[];
  workLanguages: WorkLanguage[];
  /** Has a published product in the request's category. */
  hasCategoryProduct: boolean;
  /** Invitations that expired, invited in the last 60 days. */
  expiredInvites: number;
}

export type SuggestionReason = { kind: "category" } | { kind: "skill"; skill: string } | { kind: "language" } | { kind: "open" } | { kind: "expired"; count: number };
export interface Suggestion {
  candidate: Candidate;
  score: number;
  reasons: SuggestionReason[];
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * §8.10 "appears in": a Latin-script skill must stand as a whole word (not letter or digit on either side), so "Go" does not
 * match "Google" nor "AI" "maintain"; a skill with CJK characters has no word spaces and keeps substring matching. Both inputs lower-case.
 */
function mentions(haystack: string, needle: string): boolean {
  if (CJK.test(needle)) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack);
}

const POINTS = (r: SuggestionReason): number => (r.kind === "category" ? 3 : r.kind === "expired" ? -r.count : 1);

/**
 * Spec §8.10 rule-based suggestions. Only helps the admin; the admin decides. ADR-004: nothing paid reaches the order;
 * ties go by handle so the list is stable.
 */
export function suggestBuilders(request: Pick<ClientRequest, "title" | "description" | "languages">, candidates: readonly Candidate[], limit = SUGGESTION_LIMIT): Suggestion[] {
  const haystack = `${request.title}\n${request.description}`.toLowerCase();
  return candidates
    .map((candidate) => {
      const reasons: SuggestionReason[] = [];
      if (candidate.hasCategoryProduct) reasons.push({ kind: "category" });
      const matched = new Set<string>();
      for (const skill of candidate.skills) {
        const needle = skill.trim().toLowerCase();
        if (!needle || matched.has(needle) || matched.size >= SKILL_POINTS_MAX || !mentions(haystack, needle)) continue;
        matched.add(needle);
        reasons.push({ kind: "skill", skill: skill.trim() });
      }
      if (candidate.workLanguages.some((l) => request.languages.includes(l))) reasons.push({ kind: "language" });
      if (candidate.availability === "open") reasons.push({ kind: "open" });
      if (candidate.expiredInvites > 0) reasons.push({ kind: "expired", count: candidate.expiredInvites });
      return { candidate, score: reasons.reduce((sum, r) => sum + POINTS(r), 0), reasons };
    })
    .sort((a, b) => b.score - a.score || a.candidate.handle.localeCompare(b.candidate.handle))
    .slice(0, limit);
}
