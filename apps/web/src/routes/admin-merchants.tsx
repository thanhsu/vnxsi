import type { Context, Hono } from "hono";
import { requireAdmin } from "../auth/middleware.ts";
import { readFlags } from "../db/flags.ts";
import { createMerchant, findMerchantById, listMerchants, setDefaultOffer, setMerchantStatus, updateMerchant, type Merchant } from "../db/merchants.ts";
import { createOffer, findOfferById, listOffersByMerchant, updateOffer } from "../db/offers.ts";
import { createProgram, findProgramById, listProgramsByMerchant, updateProgram } from "../db/programs.ts";
import { hostsChanged, MERCHANT_STATUSES, merchantTransitionAllowed, parseMerchantForm, type MerchantFormValues } from "../domain/merchant.ts";
import {
  offerPreview,
  offersBrokenByHosts,
  offerTransitionAllowed,
  OFFER_STATUSES,
  parseOfferForm,
  parseProgramForm,
  PROGRAM_STATUSES,
  programTransitionAllowed,
  type OfferStatus,
  type ProgramFormValues,
  type ProgramStatus,
} from "../domain/offer.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { requestOrigin } from "../http/origin.ts";
import { localizedPath } from "../i18n/locales.ts";
import { MerchantDetailPage, type ProgramEdit } from "../views/admin/MerchantDetailPage.tsx";
import { MerchantsPage, NEW_MERCHANT_VALUES, type MerchantEdit, type MerchantErrors } from "../views/admin/MerchantsPage.tsx";
import type { OfferEdit } from "../views/admin/OfferSection.tsx";
import { errorResponse } from "../views/error-response.tsx";
import { page } from "../views/render.ts";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const iso = () => new Date().toISOString();

const merchantValues = (b: Record<string, unknown>): MerchantFormValues => ({
  name: str(b.name),
  slug: str(b.slug),
  websiteUrl: str(b.websiteUrl),
  allowedHosts: str(b.allowedHosts),
  description: str(b.description),
  indexable: b.indexable === "1",
});

const programValues = (b: Record<string, unknown>): ProgramFormValues => ({
  name: str(b.name),
  type: str(b.type),
  network: str(b.network),
  provider: str(b.provider),
  commissionModel: str(b.commissionModel),
  commissionRateBps: str(b.commissionRateBps),
  commissionFlatMinor: str(b.commissionFlatMinor),
  currency: str(b.currency),
  cookieDays: str(b.cookieDays),
  attributionNotes: str(b.attributionNotes),
  termsUrl: str(b.termsUrl),
  termsVerifiedAt: str(b.termsVerifiedAt),
  status: str(b.status),
});

const offerValues = (b: Record<string, unknown>): OfferEdit["values"] => ({
  programId: str(b.programId),
  kind: str(b.kind),
  label: str(b.label),
  destinationUrl: str(b.destinationUrl),
  trackingTemplate: str(b.trackingTemplate),
  startsAt: str(b.startsAt),
  endsAt: str(b.endsAt),
  status: str(b.status),
});

export type { Merchant };
export type DetailExtra = { merchantEdit?: MerchantEdit; programEdit?: ProgramEdit; offerEdit?: OfferEdit };
export type CreateEdit = { values: MerchantFormValues; errors: MerchantErrors; status: "active" | "paused" };

/**
 * Where a merchant action answers: /admin/merchants (AdminLayout, localized, site error pages) or /ops/monetization/merchants
 * (OpsLayout, English, sealed 404; VNX-2508a). The actions below hold the rules, the writes and the audit; the surface only
 * renders the outcome and says where a success goes.
 */
export type MerchantSurface = {
  list(c: Context<AppEnv>, create: CreateEdit, status: 200 | 400): Promise<Response>;
  detail(c: Context<AppEnv>, merchant: Merchant, extra: DetailExtra, status: 200 | 400): Promise<Response>;
  notFound(c: Context<AppEnv>): Response | Promise<Response>;
  /** A move the state machine refuses or a lost race: nothing was written. `merchant` is the row as the action read it. */
  conflict(c: Context<AppEnv>, merchant: Merchant): Response | Promise<Response>;
  badRequest(c: Context<AppEnv>, merchant: Merchant): Response | Promise<Response>;
  done(c: Context<AppEnv>, id: string): Response;
};

/** What the merchant page shows: the programs and offers of the merchant, and the final-URL preview of each offer. */
export async function loadMerchantDetail(c: Context<AppEnv>, merchant: Merchant) {
  const [programs, offers, flags] = await Promise.all([listProgramsByMerchant(c.env.DB, merchant.id), listOffersByMerchant(c.env.DB, merchant.id), readFlags(c.env.DB)]);
  const now = iso();
  const previews = Object.fromEntries(offers.map((offer) => [offer.id, offerPreview({ offer, program: programs.find((p) => p.id === offer.programId) ?? null, merchant, flags, now })]));
  return { programs, offers, previews };
}

/** The merchants for the list page. */
export const loadMerchants = (c: Context<AppEnv>) => listMerchants(c.env.DB);

/** The merchant behind `:id`, or null. */
export const merchantOfRequest = (c: Context<AppEnv>) => findMerchantById(c.env.DB, c.req.param("id") ?? "");

const adminSurface: MerchantSurface = {
  list: async (c, create, status) => page(c, <MerchantsPage locale={c.get("locale")} origin={requestOrigin(c)} merchants={await loadMerchants(c)} create={create} />, status),
  detail: async (c, merchant, extra, status) => {
    const data = await loadMerchantDetail(c, merchant);
    return page(c, <MerchantDetailPage locale={c.get("locale")} origin={requestOrigin(c)} merchant={merchant} {...data} done={c.req.query("done") === "1"} {...extra} />, status);
  },
  notFound: (c) => errorResponse(c, "notFound", 404),
  conflict: (c) => errorResponse(c, "conflict", 409),
  badRequest: (c) => c.text("Bad request", 400),
  done: (c, id) => c.redirect(localizedPath(c.get("locale"), `/admin/merchants/${id}?done=1`), 303),
};

/** Reads the form of an offer of `merchant` and runs the domain rules; the program is looked up, never trusted. */
async function offerInput(c: Context<AppEnv>, merchant: Merchant, body: Record<string, unknown>) {
  const values = offerValues(body);
  const program = values.programId === "" ? null : await findProgramById(c.env.DB, values.programId);
  const parsed =
    values.programId !== "" && !program
      ? ({ ok: false, errors: { programId: "program_merchant" } } as const)
      : parseOfferForm(values, { merchant: { id: merchant.id, allowedHosts: merchant.allowedHosts }, program: program ? { id: program.id, merchantId: program.merchantId } : null });
  return { values, parsed };
}

export const NEW_MERCHANT = { values: NEW_MERCHANT_VALUES, errors: {}, status: "paused" } as const satisfies CreateEdit;

// The actions of /admin/merchants/*, shared with /ops/monetization/merchants/*: each reads the form, runs the domain rules
// and the db writes (which audit), and hands the outcome to the surface.

export async function createMerchantAction(c: Context<AppEnv>, s: MerchantSurface) {
  const body = await c.req.parseBody();
  const values = merchantValues(body);
  const status = body.status === "active" ? "active" : "paused"; // the safe default; archived is not offered on creation
  const parsed = parseMerchantForm(values);
  if (!parsed.ok) return s.list(c, { values, errors: parsed.errors, status }, 400);
  const created = await createMerchant(c.env.DB, { merchant: parsed.merchant, status, actorUserId: c.get("user")!.id, now: iso() });
  if (!created.ok) return s.list(c, { values, errors: { slug: "taken" }, status }, 400);
  return s.done(c, created.merchant.id);
}

export async function updateMerchantAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  if (!merchant) return s.notFound(c);
  const values = { ...merchantValues(await c.req.parseBody()), slug: merchant.slug }; // the slug is never read from the request, also not to redraw the form
  const parsed = parseMerchantForm(values);
  if (!parsed.ok) return s.detail(c, merchant, { merchantEdit: { values, errors: parsed.errors, broken: [] } }, 400);
  const { slug: _slug, ...fields } = parsed.merchant;
  if (hostsChanged(merchant.allowedHosts, fields.allowedHosts) || merchant.websiteUrl !== fields.websiteUrl) {
    const offers = (await listOffersByMerchant(c.env.DB, merchant.id)).filter((o) => o.status !== "archived");
    const broken = offersBrokenByHosts(offers, fields.allowedHosts);
    if (broken.length > 0) return s.detail(c, merchant, { merchantEdit: { values, errors: {}, broken } }, 400);
  }
  const saved = await updateMerchant(c.env.DB, { id: merchant.id, merchant: fields, actorUserId: c.get("user")!.id, now: iso() });
  return saved ? s.done(c, merchant.id) : s.notFound(c);
}

export async function setMerchantStatusAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  if (!merchant) return s.notFound(c);
  const body = await c.req.parseBody();
  const to = (MERCHANT_STATUSES as readonly string[]).includes(str(body.to)) ? (str(body.to) as Merchant["status"]) : null;
  if (!to || (to === "archived" && body.confirm !== "1")) return s.badRequest(c, merchant);
  if (to === merchant.status || !merchantTransitionAllowed(merchant.status, to)) return s.conflict(c, merchant);
  const moved = await setMerchantStatus(c.env.DB, { id: merchant.id, from: merchant.status, to, actorUserId: c.get("user")!.id, now: iso() });
  return moved ? s.done(c, merchant.id) : s.conflict(c, merchant);
}

export async function createProgramAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  if (!merchant) return s.notFound(c);
  const values = programValues(await c.req.parseBody());
  const parsed = parseProgramForm(values);
  if (!parsed.ok) return s.detail(c, merchant, { programEdit: { id: "new", values, errors: parsed.errors } }, 400);
  const created = await createProgram(c.env.DB, { merchantId: merchant.id, program: parsed.program, actorUserId: c.get("user")!.id, now: iso() });
  return created ? s.done(c, merchant.id) : s.notFound(c);
}

export async function updateProgramAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  const program = merchant ? await findProgramById(c.env.DB, c.req.param("programId") ?? "") : null;
  if (!merchant || !program || program.merchantId !== merchant.id) return s.notFound(c);
  const body = await c.req.parseBody();
  const expected = str(body.expectedStatus);
  if (!(PROGRAM_STATUSES as readonly string[]).includes(expected)) return s.badRequest(c, merchant);
  const values = programValues(body);
  const parsed = parseProgramForm(values);
  if (!parsed.ok) return s.detail(c, merchant, { programEdit: { id: program.id, values, errors: parsed.errors } }, 400);
  if (!programTransitionAllowed(expected as ProgramStatus, parsed.program.status)) return s.conflict(c, merchant);
  const saved = await updateProgram(c.env.DB, { id: program.id, program: parsed.program, expectedStatus: expected as ProgramStatus, actorUserId: c.get("user")!.id, now: iso() });
  return saved ? s.done(c, merchant.id) : s.conflict(c, merchant); // the status moved while the form was open
}

export async function createOfferAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  if (!merchant) return s.notFound(c);
  const { values, parsed } = await offerInput(c, merchant, await c.req.parseBody());
  if (!parsed.ok) return s.detail(c, merchant, { offerEdit: { id: "new", values, errors: parsed.errors } }, 400);
  const created = await createOffer(c.env.DB, { offer: parsed.offer, actorUserId: c.get("user")!.id, now: iso() });
  return created ? s.done(c, merchant.id) : s.notFound(c); // null after the checks above: a race
}

export async function updateOfferAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  const offer = merchant ? await findOfferById(c.env.DB, c.req.param("offerId") ?? "") : null;
  if (!merchant || !offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id) return s.notFound(c);
  const body = await c.req.parseBody();
  const expected = str(body.expectedStatus);
  if (!(OFFER_STATUSES as readonly string[]).includes(expected)) return s.badRequest(c, merchant);
  const { values, parsed } = await offerInput(c, merchant, body);
  if (!parsed.ok) return s.detail(c, merchant, { offerEdit: { id: offer.id, values, errors: parsed.errors } }, 400);
  if (!offerTransitionAllowed(expected as OfferStatus, parsed.offer.status)) return s.conflict(c, merchant);
  if (parsed.offer.status === "archived" && expected !== "archived" && merchant.defaultOfferId === offer.id && body.confirmArchive !== "1") {
    return s.detail(c, merchant, { offerEdit: { id: offer.id, values, errors: { confirmArchive: "confirm_archive" } } }, 400);
  }
  const saved = await updateOffer(c.env.DB, { id: offer.id, offer: parsed.offer, expectedStatus: expected as OfferStatus, actorUserId: c.get("user")!.id, now: iso() });
  return saved ? s.done(c, merchant.id) : s.conflict(c, merchant); // changed meanwhile
}

export async function setDefaultOfferAction(c: Context<AppEnv>, s: MerchantSurface) {
  const merchant = await merchantOfRequest(c);
  if (!merchant) return s.notFound(c);
  const offerId = str((await c.req.parseBody()).offerId);
  if (offerId !== "") {
    const offer = await findOfferById(c.env.DB, offerId);
    if (!offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id || offer.status === "archived") return s.notFound(c);
  }
  const saved = await setDefaultOffer(c.env.DB, { merchantId: merchant.id, offerId: offerId === "" ? null : offerId, actorUserId: c.get("user")!.id, now: iso() });
  return saved ? s.done(c, merchant.id) : s.notFound(c); // null after the checks above: a race
}

export function registerAdminMerchantRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/merchants", requireAdmin, (c) => adminSurface.list(c, NEW_MERCHANT, 200));
  onLocalized(app, "post", "/admin/merchants", requireAdmin, (c) => createMerchantAction(c, adminSurface));
  onLocalized(app, "get", "/admin/merchants/:id", requireAdmin, async (c) => {
    const merchant = await merchantOfRequest(c);
    return merchant ? adminSurface.detail(c, merchant, {}, 200) : adminSurface.notFound(c);
  });
  onLocalized(app, "post", "/admin/merchants/:id", requireAdmin, (c) => updateMerchantAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/status", requireAdmin, (c) => setMerchantStatusAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/programs", requireAdmin, (c) => createProgramAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/programs/:programId", requireAdmin, (c) => updateProgramAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/offers", requireAdmin, (c) => createOfferAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/offers/:offerId", requireAdmin, (c) => updateOfferAction(c, adminSurface));
  onLocalized(app, "post", "/admin/merchants/:id/default-offer", requireAdmin, (c) => setDefaultOfferAction(c, adminSurface));
}
