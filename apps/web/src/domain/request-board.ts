import { WORK_LANGUAGES, type WorkLanguage } from "./builder.ts";
import { oneOf, parsePage } from "./catalog.ts";
import { BUDGET_BANDS, type BudgetBand } from "./inquiry.ts";
import { parsePrivacyNoticeDate } from "./privacy-notice.ts";
import { CATEGORIES, type Category } from "./product.ts";
import { normalizeNewlines } from "./product-input.ts";
import type { RequestStatus } from "./request.ts";

// EPIC 27 (public request board, addendum §7, §8, §9). Pure: no Hono, no D1. Also a ranking file (ADR-004): no money, no priority.

export const PUBLICATION_STATUSES = ["pending_review", "published", "rejected", "withdrawn", "unpublished"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export const INTEREST_STATUSES = ["pending", "invited", "dismissed", "withdrawn"] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export const PUBLIC_TITLE_MAX = 120;
export const PUBLIC_DESCRIPTION_MIN = 40;
export const PUBLIC_DESCRIPTION_MAX = 4000;
export const REVIEW_NOTE_MAX = 1000;
export const INTEREST_NOTE_MAX = 500;
export const CLOSED_VISIBLE_DAYS = 30;
export const INTEREST_DAILY_LIMIT = 10;
export const INTEREST_PENDING_CAP = 30;
export const MIN_OPEN_FOR_INDEX = 5;
export const BOARD_PAGE_SIZE = 24;
export const EXCERPT_LENGTH = 200;

const DAY_MS = 24 * 60 * 60 * 1000;

/** L1: lengths count code points, like SQLite's length() on TEXT in the CHECK constraints (not UTF-16 code units). */
const cpLength = (s: string): number => [...s].length;

// ---------------------------------------------------------------- 7.1 publication, 7.2 interest

export type PublicationAction = "opt_in" | "re_opt_in" | "publish" | "reject" | "unpublish" | "withdraw";
export type PublicationActor = "client" | "ops";
export type PublicationTransition = { ok: true; status: PublicationStatus } | { ok: false; error: "invalid_transition" };

const NO: PublicationTransition = { ok: false, error: "invalid_transition" };
const OPEN_REQUEST: readonly RequestStatus[] = ["submitted", "matching"];
/** Opt-in at creation also covers a request still waiting for e-mail confirmation. */
const OPT_IN_REQUEST: readonly RequestStatus[] = ["pending_verification", "submitted", "matching"];

/**
 * Addendum §7.1. `status` is the publication's (null = none yet); `requestStatus` is the request's, which gates opt-in,
 * opt-in again and publish (open only). Withdraw works in every request status. rejected and unpublished are final.
 */
export function publicationTransition(status: PublicationStatus | null, action: PublicationAction, actor: PublicationActor, requestStatus: RequestStatus): PublicationTransition {
  const ok = (to: PublicationStatus): PublicationTransition => ({ ok: true, status: to });
  switch (action) {
    case "opt_in":
      return actor === "client" && status === null && OPT_IN_REQUEST.includes(requestStatus) ? ok("pending_review") : NO;
    case "re_opt_in":
      return actor === "client" && status === "withdrawn" && OPEN_REQUEST.includes(requestStatus) ? ok("pending_review") : NO;
    case "publish":
      return actor === "ops" && status === "pending_review" && OPEN_REQUEST.includes(requestStatus) ? ok("published") : NO;
    case "reject":
      return actor === "ops" && status === "pending_review" ? ok("rejected") : NO;
    case "unpublish":
      return actor === "ops" && status === "published" ? ok("unpublished") : NO;
    case "withdraw":
      return actor === "client" && (status === "pending_review" || status === "published") ? ok("withdrawn") : NO;
    default:
      return NO;
  }
}

export type OpsBoardAction = "publish" | "edit" | "reject" | "unpublish";

/**
 * The one rule for which moderation actions Ops has on a listing: the route refuses any other and the block shows only these.
 * Publish needs an open request (7.1); edit only a published listing; reject and unpublish follow 7.1, and a listing whose request still
 * waits for the client's e-mail confirmation cannot be rejected (it is not in the review queue, and no e-mail may go to an unconfirmed address).
 * Publish also needs the board gate (`boardOn`: the flag and REQUEST_BOARD_GO_LIVE): with the gate off the public page answers 404, so
 * publishing would make a listing that is not visible and e-mail the client that it is. Reject, edit and unpublish never depend on the gate.
 */
export function opsBoardActions(status: PublicationStatus | null, requestStatus: RequestStatus, boardOn: boolean): OpsBoardAction[] {
  const out: OpsBoardAction[] = [];
  if (boardOn && publicationTransition(status, "publish", "ops", requestStatus).ok) out.push("publish");
  if (canEditPublication(status)) out.push("edit");
  if (requestStatus !== "pending_verification" && publicationTransition(status, "reject", "ops", requestStatus).ok) out.push("reject");
  if (publicationTransition(status, "unpublish", "ops", requestStatus).ok) out.push("unpublish");
  return out;
}

export type ClientBoardAction = "opt_in" | "re_opt_in" | "withdraw";

/**
 * The one rule for what a client may do with the board on /me/requests/:id (addendum 4.3, Q2, Q5, Q6); the route refuses any other
 * and the block shows only these. Opt-in and opt-in again need the gate on and an open request (submitted or matching: a request
 * still waiting for its e-mail confirmation is not offered it here). Withdraw is the client's withdrawal of consent: it needs neither the gate nor an open request.
 */
export function clientBoardActions(status: PublicationStatus | null, requestStatus: RequestStatus, gate: boolean): ClientBoardAction[] {
  const out: ClientBoardAction[] = [];
  if (gate && OPEN_REQUEST.includes(requestStatus)) {
    if (publicationTransition(status, "opt_in", "client", requestStatus).ok) out.push("opt_in");
    if (publicationTransition(status, "re_opt_in", "client", requestStatus).ok) out.push("re_opt_in");
  }
  if (publicationTransition(status, "withdraw", "client", requestStatus).ok) out.push("withdraw");
  return out;
}

/** Ops edits the public wording of a published listing only (no state change). */
export function canEditPublication(status: PublicationStatus | null): boolean {
  return status === "published";
}

export type InterestAction = "invite" | "dismiss" | "withdraw";
export type InterestActor = "system" | "ops" | "builder";
export type InterestTransition = { ok: true; status: Exclude<InterestStatus, "pending"> } | { ok: false; error: "invalid_transition" };

/** Addendum §7.2: only a pending interest moves, and all three targets are final. */
export function interestTransition(status: InterestStatus, action: InterestAction, actor: InterestActor): InterestTransition {
  if (status !== "pending") return { ok: false, error: "invalid_transition" };
  if (action === "invite" && (actor === "system" || actor === "ops")) return { ok: true, status: "invited" };
  if (action === "dismiss" && actor === "ops") return { ok: true, status: "dismissed" };
  if (action === "withdraw" && actor === "builder") return { ok: true, status: "withdrawn" };
  return { ok: false, error: "invalid_transition" };
}

// ---------------------------------------------------------------- 7.3 visibility

export type Visibility = "open" | "closed" | "hidden";
const CLOSED_STATUSES: readonly RequestStatus[] = ["builder_selected", "rejected", "expired", "closed"];

/**
 * Addendum §7.3, the one function the page, the list, the sitemap and the interest button all use.
 * open: request submitted or matching and publication published. closed: request ended (not removed), publication
 * published, and now < closedAt + 30 days (UTC; the day itself is hidden). Everything else is hidden, including an
 * ended request whose closedAt is missing or unreadable (fail closed).
 */
export function requestVisibility(requestStatus: RequestStatus, publicationStatus: PublicationStatus | null, closedAt: string | null, now: Date): Visibility {
  if (publicationStatus !== "published") return "hidden";
  if (OPEN_REQUEST.includes(requestStatus)) return "open";
  if (!CLOSED_STATUSES.includes(requestStatus)) return "hidden";
  const closed = closedAt === null ? NaN : Date.parse(closedAt);
  const at = now.getTime();
  if (!Number.isFinite(closed) || !Number.isFinite(at)) return "hidden";
  return at < closed + CLOSED_VISIBLE_DAYS * DAY_MS ? "closed" : "hidden";
}

// ---------------------------------------------------------------- parsers

/** Control and format characters (zero-width, bidi overrides, ...). */
const CONTROL = /[\p{Cc}\p{Cf}]/u;

/**
 * Multi-line text (description, notes): control characters other than line break and tab are refused, and so are the bidi
 * overrides and isolates (U+202A-202E, U+2066-2069) that can reorder text. Other format characters stay allowed: ZWJ and
 * ZWNJ (emoji sequences, Indic and Persian scripts), soft hyphen, variation selectors. A leading BOM is stripped by cleanText.
 */
const BAD_IN_TEXT = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;
function hasControl(s: string): boolean {
  return BAD_IN_TEXT.test(s.replace(/[\n\t]/g, ""));
}

/** Line breaks normalised, a leading BOM dropped, trimmed. */
function cleanText(raw: string): string {
  return normalizeNewlines(raw).replace(/^\uFEFF/, "").trim();
}

export type TextError = "required" | "too_short" | "too_long" | "invalid";
export type PublicListingErrors = Partial<Record<"title" | "description", TextError>>;

/** Ops' public wording (addendum §3.2): title 1-120, description 40-4000, plain text, counted in code points. */
export function parsePublicListing(values: { title: string; description: string }): { ok: true; input: { title: string; description: string } } | { ok: false; errors: PublicListingErrors } {
  const errors: PublicListingErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = "required";
  else if (cpLength(title) > PUBLIC_TITLE_MAX) errors.title = "too_long";
  else if (CONTROL.test(title)) errors.title = "invalid";

  const description = cleanText(values.description);
  if (!description) errors.description = "required";
  else if (cpLength(description) < PUBLIC_DESCRIPTION_MIN) errors.description = "too_short";
  else if (cpLength(description) > PUBLIC_DESCRIPTION_MAX) errors.description = "too_long";
  else if (hasControl(description)) errors.description = "invalid";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input: { title, description } };
}

/** Whether Ops changed the client's own wording: same comparison as the parser's (line breaks, BOM, surrounding space). Decides the "edited" line of the publish e-mail. */
export function wordingEdited(original: { title: string; description: string }, published: { title: string; description: string }): boolean {
  return original.title.trim() !== published.title.trim() || cleanText(original.description) !== cleanText(published.description);
}

/** The reason Ops gives on reject or unpublish: required, at most 1000. */
export function parseReviewNote(raw: string): { ok: true; note: string } | { ok: false; error: TextError } {
  const note = cleanText(raw);
  if (!note) return { ok: false, error: "required" };
  if (cpLength(note) > REVIEW_NOTE_MAX) return { ok: false, error: "too_long" };
  if (hasControl(note)) return { ok: false, error: "invalid" };
  return { ok: true, note };
}

export type InterestFormErrors = Partial<Record<"note" | "productId", "too_long" | "invalid">>;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The shape of a public id and of a ULID alike (26 Crockford base32 characters): anything else cannot be a listing, so the route answers 404 without a query. */
export function isPublicIdShape(value: string): boolean {
  return ULID_RE.test(value);
}

/** "I'm interested" form: an optional note up to 500 and an optional product id (a ULID; ownership is checked in SQL). */
export function parseInterestForm(values: { note: string; productId: string }): { ok: true; input: { note: string | null; productId: string | null } } | { ok: false; errors: InterestFormErrors } {
  const errors: InterestFormErrors = {};
  const note = cleanText(values.note);
  if (cpLength(note) > INTEREST_NOTE_MAX) errors.note = "too_long";
  else if (hasControl(note)) errors.note = "invalid";
  const productId = values.productId.trim();
  if (productId && !ULID_RE.test(productId)) errors.productId = "invalid";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { note: note || null, productId: productId || null } };
}

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The start of the public description on one line (all whitespace runs become one space), at most 200 code points,
 * cut between grapheme clusters (never inside a ZWJ emoji, a flag or a letter with its combining marks), with an ellipsis when cut.
 */
export function publicExcerpt(description: string): string {
  const flat = description.replace(/\s+/g, " ").trim();
  if (cpLength(flat) <= EXCERPT_LENGTH) return flat;
  let out = "";
  let used = 0;
  for (const { segment } of GRAPHEMES.segment(flat)) {
    const n = cpLength(segment);
    if (used + n > EXCERPT_LENGTH) break;
    out += segment;
    used += n;
  }
  if (out === "") out = [...flat].slice(0, EXCERPT_LENGTH).join("");
  return `${out}…`;
}

export interface BoardQuery {
  category: Category | null;
  budget: BudgetBand | null;
  lang: WorkLanguage | null;
  page: number;
}

/** /requests GET parameters. Unknown values and unknown parameters (there is no `sort`) are ignored, never an error. */
export function parseBoardQuery(params: Record<string, string | undefined>): BoardQuery {
  return {
    category: oneOf(CATEGORIES, params.category),
    budget: oneOf(BUDGET_BANDS, params.budget),
    lang: oneOf(WORK_LANGUAGES, params.lang),
    page: parsePage(params.page),
  };
}

/** Addendum Q13: the list page is indexable only with at least 5 open listings. */
export function isBoardIndexable(openCount: number): boolean {
  return openCount >= MIN_OPEN_FOR_INDEX;
}

// ---------------------------------------------------------------- go-live gate

/** REQUEST_BOARD_GO_LIVE as a UTC date, or null when empty or malformed. */
export function parseBoardGoLive(raw: string | undefined): Date | null {
  return parsePrivacyNoticeDate(raw);
}

/** From go-live 00:00:00 UTC on, and never off again. False for an empty or malformed value (fail closed). */
export function isBoardLive(goLive: string | undefined, now: Date): boolean {
  const date = parseBoardGoLive(goLive);
  const at = now.getTime();
  return date !== null && Number.isFinite(at) && at >= date.getTime();
}

/** Both locks: the database flag and the date committed in wrangler.jsonc. */
export function boardEnabled(input: { flag: boolean; goLive: string | undefined; now: Date }): boolean {
  return input.flag && isBoardLive(input.goLive, input.now);
}
