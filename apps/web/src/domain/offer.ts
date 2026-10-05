import { isHttpsUrl } from "./builder-input.ts";
import type { FlagState } from "./flags.ts";
import type { MerchantStatus } from "./merchant.ts";
import { appendUtm, fillAndValidate, parseTemplate, previewUrl, validateFinalUrl, type UrlError, type UrlResult } from "./offer-url.ts";
import { normalizeNewlines } from "./product-input.ts";

/** Programs and offers (addendum §3.2–3.3 with the 2026-10-05 amendments). Pure rules: no Hono, no D1. */

export const PROGRAM_TYPES = ["affiliate", "referral", "revenue_share", "direct"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];
export const PROGRAM_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export const PROGRAM_PROVIDERS = ["generic_template", "manual"] as const;
export type ProgramProvider = (typeof PROGRAM_PROVIDERS)[number];
export const COMMISSION_MODELS = ["percent", "flat", "tiered", "custom"] as const;
export type CommissionModel = (typeof COMMISSION_MODELS)[number];
export const OFFER_KINDS = ["official", "trial", "affiliate", "referral", "sponsored"] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];
/** i18n keys of the button text; `try_it` is "Try {name}" (Owner 2026-10-05). */
export const LABELS = ["learn_more", "get_started", "start_trial", "visit_site", "try_it"] as const;
export type OfferLabel = (typeof LABELS)[number];
export const OFFER_STATUSES = ["active", "paused", "archived"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

const oneOf = <T extends string>(list: readonly T[], raw: string): T | null => ((list as readonly string[]).includes(raw) ? (raw as T) : null);

/** `YYYY-MM-DD` (midnight UTC) or a full `…Z` instant: the ISO instant, null for empty, or not ok. */
function parseInstant(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z)?$/.test(s)) return { ok: false };
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(s.slice(0, 10))) return { ok: false };
  return { ok: true, value: d.toISOString() };
}

function optInt(raw: string, max: number): { ok: true; value: number | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  return /^\d{1,10}$/.test(s) && Number(s) <= max ? { ok: true, value: Number(s) } : { ok: false };
}

// ---- Programs ----

/** The conditions to move a program to `active` (ADR-007 rule 5, and the slice rule that `direct` has no flag). Also a CHECK in 0011. */
export function programActivationError(p: { type: ProgramType; termsUrl: string | null; termsVerifiedAt: string | null }): "direct_not_active" | "terms_missing" | null {
  if (p.type === "direct") return "direct_not_active";
  return p.termsUrl && p.termsVerifiedAt ? null : "terms_missing";
}

export type ProgramFormValues = {
  name: string;
  type: string;
  network: string;
  provider: string;
  commissionModel: string;
  commissionRateBps: string;
  commissionFlatMinor: string;
  currency: string;
  cookieDays: string;
  attributionNotes: string;
  termsUrl: string;
  termsVerifiedAt: string;
  status: string;
};
export type ProgramField = keyof ProgramFormValues;
export type ProgramFieldError = "required" | "too_long" | "choice" | "number" | "currency" | "url" | "date" | "terms_missing" | "direct_not_active";
export type ProgramInput = {
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
};

/** Empty means null: no commission, cookie or currency value is ever defaulted (ADR-007 rule 5). */
export function parseProgramForm(v: ProgramFormValues): { ok: true; program: ProgramInput } | { ok: false; errors: Partial<Record<ProgramField, ProgramFieldError>> } {
  const errors: Partial<Record<ProgramField, ProgramFieldError>> = {};
  const name = v.name.trim();
  if (name === "") errors.name = "required";
  else if (name.length > 80) errors.name = "too_long";
  const network = v.network.trim();
  if (network.length > 80) errors.network = "too_long";
  const notes = normalizeNewlines(v.attributionNotes).trim();
  if (notes.length > 1000) errors.attributionNotes = "too_long";

  const type = oneOf(PROGRAM_TYPES, v.type);
  if (!type) errors.type = "choice";
  const provider = oneOf(PROGRAM_PROVIDERS, v.provider);
  if (!provider) errors.provider = "choice";
  const status = oneOf(PROGRAM_STATUSES, v.status);
  if (!status) errors.status = "choice";
  const modelRaw = v.commissionModel.trim();
  const commissionModel = modelRaw === "" ? null : oneOf(COMMISSION_MODELS, modelRaw);
  if (modelRaw !== "" && !commissionModel) errors.commissionModel = "choice";

  const rate = optInt(v.commissionRateBps, 10_000);
  if (!rate.ok) errors.commissionRateBps = "number";
  const flat = optInt(v.commissionFlatMinor, 1_000_000_000);
  if (!flat.ok) errors.commissionFlatMinor = "number";
  const cookie = optInt(v.cookieDays, 3650);
  if (!cookie.ok) errors.cookieDays = "number";
  const currency = v.currency.trim().toUpperCase();
  if (currency !== "" && !/^[A-Z]{3}$/.test(currency)) errors.currency = "currency";

  const termsUrl = v.termsUrl.trim();
  if (termsUrl !== "" && (termsUrl.length > 500 || !isHttpsUrl(termsUrl))) errors.termsUrl = "url";
  const verified = v.termsVerifiedAt.trim();
  if (verified !== "" && !(verified.length === 10 && parseInstant(verified).ok)) errors.termsVerifiedAt = "date";

  if (type && status === "active" && !errors.termsUrl && !errors.termsVerifiedAt) {
    const why = programActivationError({ type, termsUrl: termsUrl || null, termsVerifiedAt: verified || null });
    if (why) errors.status = why;
  }

  if (Object.keys(errors).length > 0 || !type || !provider || !status || !rate.ok || !flat.ok || !cookie.ok) return { ok: false, errors };
  return {
    ok: true,
    program: {
      name,
      type,
      network: network || null,
      provider,
      commissionModel,
      commissionRateBps: rate.value,
      commissionFlatMinor: flat.value,
      currency: currency || null,
      cookieDays: cookie.value,
      attributionNotes: notes || null,
      termsUrl: termsUrl || null,
      termsVerifiedAt: verified || null,
      status,
    },
  };
}

/** The flag that must be on for a program of this type to track a click; `direct` has none, so it can never track. */
export function flagForProgram(type: ProgramType): "affiliate" | "partner_referral" | null {
  if (type === "affiliate") return "affiliate";
  return type === "direct" ? null : "partner_referral";
}

// ---- Offers ----

export type OfferFormValues = { kind: string; label: string; destinationUrl: string; trackingTemplate: string; startsAt: string; endsAt: string; status: string };
export type OfferField = "programId" | "kind" | "label" | "destinationUrl" | "trackingTemplate" | "startsAt" | "endsAt" | "status";
export type OfferFieldError =
  | "required"
  | "choice"
  | "date"
  | "date_order"
  | "program_merchant"
  | "template_required"
  | "template_without_program"
  | "same_as_template"
  | `url_${UrlError}`
  | `template_${"braces" | "placeholder" | "placeholder_position" | UrlError}`;
/** The merchant the offer belongs to (subject) and the program picked for it, if any. The caller loads both; the merchant match is checked here. */
export type OfferContext = { merchant: { id: string; allowedHosts: readonly string[] }; program: { id: string; merchantId: string } | null };
export type OfferInput = {
  programId: string | null;
  subjectType: "merchant";
  subjectId: string;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
};

export function parseOfferForm(v: OfferFormValues, ctx: OfferContext): { ok: true; offer: OfferInput } | { ok: false; errors: Partial<Record<OfferField, OfferFieldError>> } {
  const errors: Partial<Record<OfferField, OfferFieldError>> = {};
  const hosts = ctx.merchant.allowedHosts;
  const kind = oneOf(OFFER_KINDS, v.kind);
  if (!kind) errors.kind = "choice";
  const label = oneOf(LABELS, v.label);
  if (!label) errors.label = "choice";
  const status = oneOf(OFFER_STATUSES, v.status);
  if (!status) errors.status = "choice";
  if (ctx.program && ctx.program.merchantId !== ctx.merchant.id) errors.programId = "program_merchant";

  let destinationUrl = "";
  const destRaw = v.destinationUrl.trim();
  if (destRaw === "") {
    errors.destinationUrl = "required";
  } else {
    const d = validateFinalUrl(destRaw, hosts);
    if (d.ok) destinationUrl = d.url;
    else errors.destinationUrl = `url_${d.error}`;
  }

  let trackingTemplate: string | null = null;
  const tplRaw = v.trackingTemplate.trim();
  if (tplRaw !== "") {
    const t = parseTemplate(tplRaw, hosts);
    if (t.ok) trackingTemplate = t.template;
    else errors.trackingTemplate = `template_${t.error}`;
  } else if (ctx.program) {
    errors.trackingTemplate = "template_required";
  }
  if (tplRaw !== "" && !ctx.program) errors.trackingTemplate = "template_without_program";
  // destination_url is the untracked link: it must differ from the partner link once both are normalised (placeholders filled with the samples).
  if (destinationUrl && trackingTemplate) {
    const sample = previewUrl(trackingTemplate, hosts);
    if (sample.ok && sample.url === destinationUrl) errors.destinationUrl = "same_as_template";
  }

  const starts = parseInstant(v.startsAt);
  if (!starts.ok) errors.startsAt = "date";
  const ends = parseInstant(v.endsAt);
  if (!ends.ok) errors.endsAt = "date";
  if (starts.ok && ends.ok && starts.value && ends.value && ends.value <= starts.value) errors.endsAt = "date_order";

  if (Object.keys(errors).length > 0 || !kind || !label || !status || !starts.ok || !ends.ok) return { ok: false, errors };
  return {
    ok: true,
    offer: {
      programId: ctx.program?.id ?? null,
      subjectType: "merchant",
      subjectId: ctx.merchant.id,
      kind,
      label,
      destinationUrl,
      trackingTemplate,
      startsAt: starts.value,
      endsAt: ends.value,
      status,
    },
  };
}

// ---- Redirect resolution ----

export type RedirectOffer = {
  id: string;
  subjectType: "product" | "merchant" | "article";
  subjectId: string;
  programId: string | null;
  status: OfferStatus;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
};
export type RedirectProgram = { id: string; merchantId: string; type: ProgramType; status: ProgramStatus };
export type RedirectMerchant = { id: string; status: MerchantStatus; websiteUrl: string; allowedHosts: readonly string[] };
export type RedirectInput = {
  offer: RedirectOffer | null;
  program: RedirectProgram | null;
  merchant: RedirectMerchant | null;
  flags: Pick<FlagState, "affiliate" | "partner_referral">;
  /** ISO instant. */
  now: string;
  /** ULID the caller generated; it is the id of the click row and fills `{click_id}`. */
  clickId: string;
  locale: string;
  src: string;
};
export type FallbackReason = "merchant_paused" | "offer_paused" | "offer_not_started" | "offer_ended" | "program_not_active" | "program_direct" | "flag_off";
export type NotFoundReason =
  | "offer_missing"
  | "offer_archived"
  | "merchant_missing"
  | "merchant_archived"
  | "subject_merchant"
  | "program_missing"
  | "program_merchant"
  | "template_missing"
  | "window_invalid"
  | "invalid_url"
  | "website_invalid";
/**
 * `tracked` and `fallback` both redirect and the caller records a click (id = `clickId`); `fallback` carries no template, so no click id
 * reaches the partner. `not_found` records nothing. `url` is always a re-validated href: put it in `Location` and nowhere else.
 */
export type RedirectResult =
  | { kind: "tracked"; url: string; programId: string | null }
  | { kind: "fallback"; url: string; reason: FallbackReason }
  | { kind: "not_found"; reason: NotFoundReason };

const notFound = (reason: NotFoundReason): RedirectResult => ({ kind: "not_found", reason });

/** Validate, add utm, validate again: the string that is returned is the one that was checked. */
function withUtm(raw: string, allowed: readonly string[]): UrlResult {
  const first = validateFinalUrl(raw, allowed);
  return first.ok ? validateFinalUrl(appendUtm(first.url), allowed) : first;
}

/** Only the canonical `YYYY-MM-DDTHH:MM:SS.mmmZ` form (what the form saves), round-tripped; anything else reads as NaN. */
const instantMs = (s: string): number => {
  const t = Date.parse(s);
  return !Number.isNaN(t) && new Date(t).toISOString() === s ? t : NaN;
};

function windowState(offer: RedirectOffer, now: string): "inside" | "before" | "after" | "invalid" {
  const at = Date.parse(now);
  const starts = offer.startsAt === null ? -Infinity : instantMs(offer.startsAt);
  const ends = offer.endsAt === null ? Infinity : instantMs(offer.endsAt);
  if (Number.isNaN(at) || Number.isNaN(starts) || Number.isNaN(ends)) return "invalid";
  if (at < starts) return "before";
  return at >= ends ? "after" : "inside";
}

/**
 * Plan header, Reviewer decisions 8–10. Missing or archived offer or merchant, a broken reference, or a URL that fails the rules: not_found.
 * Otherwise, when every condition of addendum §3.3 holds: tracked. When one fails: fallback to the merchant's website_url (the first
 * failing condition is the reason), or not_found when that URL fails the rules. No I/O; the destination comes only from the rows passed in.
 */
export function resolveOfferRedirect(i: RedirectInput): RedirectResult {
  const { offer, merchant } = i;
  if (!offer) return notFound("offer_missing");
  if (offer.status === "archived") return notFound("offer_archived");
  if (!merchant) return notFound("merchant_missing");
  if (merchant.status === "archived") return notFound("merchant_archived");
  if (offer.subjectType !== "merchant" || offer.subjectId !== merchant.id) return notFound("subject_merchant");
  const program = offer.programId === null ? null : i.program;
  if (offer.programId !== null) {
    if (!program || program.id !== offer.programId) return notFound("program_missing");
    if (program.merchantId !== merchant.id) return notFound("program_merchant");
    if (offer.trackingTemplate === null || offer.trackingTemplate === "") return notFound("template_missing");
  }
  const window = windowState(offer, i.now);
  if (window === "invalid") return notFound("window_invalid");

  let reason: FallbackReason | null = null;
  if (merchant.status !== "active") reason = "merchant_paused";
  else if (offer.status !== "active") reason = "offer_paused";
  else if (window === "before") reason = "offer_not_started";
  else if (window === "after") reason = "offer_ended";
  else if (program) {
    const flag = flagForProgram(program.type);
    if (program.status !== "active") reason = "program_not_active";
    else if (flag === null) reason = "program_direct";
    else if (!i.flags[flag]) reason = "flag_off";
  }

  if (reason === null) {
    if (!program) {
      const url = withUtm(offer.destinationUrl, merchant.allowedHosts);
      return url.ok ? { kind: "tracked", url: url.url, programId: null } : notFound("invalid_url");
    }
    // Re-check the stored template itself: a corrupt row such as https://{src}/x must never let a request value pick the host.
    if (!parseTemplate(offer.trackingTemplate ?? "", merchant.allowedHosts).ok) return notFound("invalid_url");
    const url = fillAndValidate(offer.trackingTemplate ?? "", { click_id: i.clickId, locale: i.locale, src: i.src }, merchant.allowedHosts);
    return url.ok ? { kind: "tracked", url: url.url, programId: program.id } : notFound("invalid_url");
  }
  const site = withUtm(merchant.websiteUrl, merchant.allowedHosts);
  return site.ok ? { kind: "fallback", url: site.url, reason } : notFound("website_invalid");
}
