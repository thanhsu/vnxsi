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

type DetailExtra = { merchantEdit?: MerchantEdit; programEdit?: ProgramEdit; offerEdit?: OfferEdit };

async function detail(c: Context<AppEnv>, merchant: Merchant, extra: DetailExtra = {}, status: 200 | 400 = 200) {
  const [programs, offers, flags] = await Promise.all([listProgramsByMerchant(c.env.DB, merchant.id), listOffersByMerchant(c.env.DB, merchant.id), readFlags(c.env.DB)]);
  const now = iso();
  const previews = Object.fromEntries(offers.map((offer) => [offer.id, offerPreview({ offer, program: programs.find((p) => p.id === offer.programId) ?? null, merchant, flags, now })]));
  return page(
    c,
    <MerchantDetailPage locale={c.get("locale")} origin={requestOrigin(c)} merchant={merchant} programs={programs} offers={offers} previews={previews} done={c.req.query("done") === "1"} {...extra} />,
    status,
  );
}

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

async function listPage(c: Context<AppEnv>, create: { values: MerchantFormValues; errors: MerchantErrors; status: "active" | "paused" }, status: 200 | 400 = 200) {
  return page(c, <MerchantsPage locale={c.get("locale")} origin={requestOrigin(c)} merchants={await listMerchants(c.env.DB)} create={create} />, status);
}

const back = (c: Context<AppEnv>, id: string) => c.redirect(localizedPath(c.get("locale"), `/admin/merchants/${id}?done=1`), 303);

export function registerAdminMerchantRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/admin/merchants", requireAdmin, (c) => listPage(c, { values: NEW_MERCHANT_VALUES, errors: {}, status: "paused" }));

  onLocalized(app, "post", "/admin/merchants", requireAdmin, async (c) => {
    const body = await c.req.parseBody();
    const values = merchantValues(body);
    const status = body.status === "active" ? "active" : "paused"; // the safe default; archived is not offered on creation
    const parsed = parseMerchantForm(values);
    if (!parsed.ok) return listPage(c, { values, errors: parsed.errors, status }, 400);
    const created = await createMerchant(c.env.DB, { merchant: parsed.merchant, status, actorUserId: c.get("user")!.id, now: iso() });
    if (!created.ok) return listPage(c, { values, errors: { slug: "taken" }, status }, 400);
    return back(c, created.merchant.id);
  });

  onLocalized(app, "get", "/admin/merchants/:id", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    return merchant ? detail(c, merchant) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const values = { ...merchantValues(await c.req.parseBody()), slug: merchant.slug }; // the slug is never read from the request, also not to redraw the form
    const parsed = parseMerchantForm(values);
    if (!parsed.ok) return detail(c, merchant, { merchantEdit: { values, errors: parsed.errors, broken: [] } }, 400);
    const { slug: _slug, ...fields } = parsed.merchant;
    if (hostsChanged(merchant.allowedHosts, fields.allowedHosts) || merchant.websiteUrl !== fields.websiteUrl) {
      const offers = (await listOffersByMerchant(c.env.DB, merchant.id)).filter((o) => o.status !== "archived");
      const broken = offersBrokenByHosts(offers, fields.allowedHosts);
      if (broken.length > 0) return detail(c, merchant, { merchantEdit: { values, errors: {}, broken } }, 400);
    }
    const saved = await updateMerchant(c.env.DB, { id: merchant.id, merchant: fields, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id/status", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const to = (MERCHANT_STATUSES as readonly string[]).includes(str(body.to)) ? (str(body.to) as Merchant["status"]) : null;
    if (!to || (to === "archived" && body.confirm !== "1")) return c.text("Bad request", 400);
    if (to === merchant.status || !merchantTransitionAllowed(merchant.status, to)) return errorResponse(c, "conflict", 409);
    const moved = await setMerchantStatus(c.env.DB, { id: merchant.id, from: merchant.status, to, actorUserId: c.get("user")!.id, now: iso() });
    return moved ? back(c, merchant.id) : errorResponse(c, "conflict", 409);
  });

  onLocalized(app, "post", "/admin/merchants/:id/programs", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const values = programValues(await c.req.parseBody());
    const parsed = parseProgramForm(values);
    if (!parsed.ok) return detail(c, merchant, { programEdit: { id: "new", values, errors: parsed.errors } }, 400);
    const created = await createProgram(c.env.DB, { merchantId: merchant.id, program: parsed.program, actorUserId: c.get("user")!.id, now: iso() });
    return created ? back(c, merchant.id) : errorResponse(c, "notFound", 404);
  });

  onLocalized(app, "post", "/admin/merchants/:id/programs/:programId", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    const program = merchant ? await findProgramById(c.env.DB, c.req.param("programId") ?? "") : null;
    if (!merchant || !program || program.merchantId !== merchant.id) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const expected = str(body.expectedStatus);
    if (!(PROGRAM_STATUSES as readonly string[]).includes(expected)) return c.text("Bad request", 400);
    const values = programValues(body);
    const parsed = parseProgramForm(values);
    if (!parsed.ok) return detail(c, merchant, { programEdit: { id: program.id, values, errors: parsed.errors } }, 400);
    if (!programTransitionAllowed(expected as ProgramStatus, parsed.program.status)) return errorResponse(c, "conflict", 409);
    const saved = await updateProgram(c.env.DB, { id: program.id, program: parsed.program, expectedStatus: expected as ProgramStatus, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "conflict", 409); // the status moved while the form was open
  });

  onLocalized(app, "post", "/admin/merchants/:id/offers", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const { values, parsed } = await offerInput(c, merchant, await c.req.parseBody());
    if (!parsed.ok) return detail(c, merchant, { offerEdit: { id: "new", values, errors: parsed.errors } }, 400);
    const created = await createOffer(c.env.DB, { offer: parsed.offer, actorUserId: c.get("user")!.id, now: iso() });
    return created ? back(c, merchant.id) : errorResponse(c, "notFound", 404); // null after the checks above: a race
  });

  onLocalized(app, "post", "/admin/merchants/:id/offers/:offerId", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    const offer = merchant ? await findOfferById(c.env.DB, c.req.param("offerId") ?? "") : null;
    if (!merchant || !offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id) return errorResponse(c, "notFound", 404);
    const body = await c.req.parseBody();
    const expected = str(body.expectedStatus);
    if (!(OFFER_STATUSES as readonly string[]).includes(expected)) return c.text("Bad request", 400);
    const { values, parsed } = await offerInput(c, merchant, body);
    if (!parsed.ok) return detail(c, merchant, { offerEdit: { id: offer.id, values, errors: parsed.errors } }, 400);
    if (!offerTransitionAllowed(expected as OfferStatus, parsed.offer.status)) return errorResponse(c, "conflict", 409);
    if (parsed.offer.status === "archived" && expected !== "archived" && merchant.defaultOfferId === offer.id && body.confirmArchive !== "1") {
      return detail(c, merchant, { offerEdit: { id: offer.id, values, errors: { confirmArchive: "confirm_archive" } } }, 400);
    }
    const saved = await updateOffer(c.env.DB, { id: offer.id, offer: parsed.offer, expectedStatus: expected as OfferStatus, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "conflict", 409); // changed meanwhile
  });

  onLocalized(app, "post", "/admin/merchants/:id/default-offer", requireAdmin, async (c) => {
    const merchant = await findMerchantById(c.env.DB, c.req.param("id") ?? "");
    if (!merchant) return errorResponse(c, "notFound", 404);
    const offerId = str((await c.req.parseBody()).offerId);
    if (offerId !== "") {
      const offer = await findOfferById(c.env.DB, offerId);
      if (!offer || offer.subjectType !== "merchant" || offer.subjectId !== merchant.id || offer.status === "archived") return errorResponse(c, "notFound", 404);
    }
    const saved = await setDefaultOffer(c.env.DB, { merchantId: merchant.id, offerId: offerId === "" ? null : offerId, actorUserId: c.get("user")!.id, now: iso() });
    return saved ? back(c, merchant.id) : errorResponse(c, "notFound", 404); // null after the checks above: a race
  });
}
