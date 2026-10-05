import { describe, expect, it } from "vitest";
import { MERCHANT_STATUSES } from "../../src/domain/merchant.ts";
import {
  COMMISSION_MODELS,
  flagForProgram,
  LABELS,
  OFFER_KINDS,
  OFFER_STATUSES,
  parseOfferForm,
  parseProgramForm,
  PROGRAM_PROVIDERS,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  programActivationError,
  programTransitionAllowed,
  resolveOfferRedirect,
  type OfferContext,
  type OfferFormValues,
  type ProgramFormValues,
  type RedirectInput,
  type RedirectMerchant,
  type RedirectOffer,
  type RedirectProgram,
} from "../../src/domain/offer.ts";

const HOSTS = ["try.elevenlabs.io", "elevenlabs.io"];

describe("enums", () => {
  it("match the addendum, with try_it in the labels", () => {
    expect([...LABELS]).toEqual(["learn_more", "get_started", "start_trial", "visit_site", "try_it"]);
    expect([...OFFER_KINDS]).toEqual(["official", "trial", "affiliate", "referral", "sponsored"]);
    expect([...OFFER_STATUSES]).toEqual(["active", "paused", "archived"]);
    expect([...PROGRAM_TYPES]).toEqual(["affiliate", "referral", "revenue_share", "direct"]);
    expect([...PROGRAM_STATUSES]).toEqual(["draft", "active", "paused", "ended"]);
    expect([...PROGRAM_PROVIDERS]).toEqual(["generic_template", "manual"]);
    expect([...COMMISSION_MODELS]).toEqual(["percent", "flat", "tiered", "custom"]);
  });

  it("flagForProgram: affiliate -> affiliate; referral and revenue_share -> partner_referral; direct has no flag", () => {
    expect(flagForProgram("affiliate")).toBe("affiliate");
    expect(flagForProgram("referral")).toBe("partner_referral");
    expect(flagForProgram("revenue_share")).toBe("partner_referral");
    expect(flagForProgram("direct")).toBeNull();
  });
});

const program = (o: Partial<ProgramFormValues> = {}): ProgramFormValues => ({
  name: "ElevenLabs affiliate",
  type: "affiliate",
  network: "PartnerStack",
  provider: "generic_template",
  commissionModel: "",
  commissionRateBps: "",
  commissionFlatMinor: "",
  currency: "",
  cookieDays: "",
  attributionNotes: "",
  termsUrl: "",
  termsVerifiedAt: "",
  status: "draft",
  ...o,
});
const TERMS = { termsUrl: "https://elevenlabs.io/affiliate-terms", termsVerifiedAt: "2026-10-05" };

describe("program rules (ADR-007 rules 5 and 9)", () => {
  it("a draft with no terms saves with every commission and cookie field null: no default is ever invented", () => {
    const r = parseProgramForm(program());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program).toMatchObject({ commissionModel: null, commissionRateBps: null, commissionFlatMinor: null, currency: null, cookieDays: null, termsUrl: null, termsVerifiedAt: null, status: "draft" });
    }
  });

  it("active needs terms_url and terms_verified_at", () => {
    expect(parseProgramForm(program({ status: "active" }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", termsUrl: TERMS.termsUrl }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", termsVerifiedAt: TERMS.termsVerifiedAt }))).toEqual({ ok: false, errors: { status: "terms_missing" } });
    expect(parseProgramForm(program({ status: "active", ...TERMS })).ok).toBe(true);
  });

  it("paused and ended need no terms", () => {
    for (const status of ["paused", "ended"]) expect(parseProgramForm(program({ status })).ok, status).toBe(true);
  });

  it("type direct can never be active in the slice, even with terms", () => {
    expect(parseProgramForm(program({ type: "direct", status: "active", ...TERMS }))).toEqual({ ok: false, errors: { status: "direct_not_active" } });
    expect(parseProgramForm(program({ type: "direct", status: "draft" })).ok).toBe(true);
    expect(programActivationError({ type: "direct", termsUrl: "https://a.io", termsVerifiedAt: "2026-10-05" })).toBe("direct_not_active");
    expect(programActivationError({ type: "affiliate", termsUrl: null, termsVerifiedAt: null })).toBe("terms_missing");
    expect(programActivationError({ type: "referral", termsUrl: "https://a.io", termsVerifiedAt: "2026-10-05" })).toBeNull();
  });

  it("checks enums, the terms URL and the terms date", () => {
    expect(parseProgramForm(program({ type: "x", provider: "y", status: "z", commissionModel: "w" }))).toEqual({
      ok: false,
      errors: { type: "choice", provider: "choice", status: "choice", commissionModel: "choice" },
    });
    expect(parseProgramForm(program({ termsUrl: "http://a.io/t" }))).toEqual({ ok: false, errors: { termsUrl: "url" } });
    for (const d of ["2026-02-31", "05/10/2026", "2026-10-05T00:00:00Z"]) expect(parseProgramForm(program({ termsVerifiedAt: d })), d).toEqual({ ok: false, errors: { termsVerifiedAt: "date" } });
    expect(parseProgramForm(program({ name: " " }))).toEqual({ ok: false, errors: { name: "required" } });
  });

  it("checks the numbers and the currency format only", () => {
    const ok = parseProgramForm(program({ commissionModel: "percent", commissionRateBps: "1500", commissionFlatMinor: "0", currency: "usd", cookieDays: "30" }));
    expect(ok.ok && ok.program).toMatchObject({ commissionModel: "percent", commissionRateBps: 1500, commissionFlatMinor: 0, currency: "USD", cookieDays: 30 });
    for (const bad of ["-1", "10001", "1.5", "abc", "1e3"]) expect(parseProgramForm(program({ commissionRateBps: bad })), bad).toEqual({ ok: false, errors: { commissionRateBps: "number" } });
    expect(parseProgramForm(program({ cookieDays: "3651" }))).toEqual({ ok: false, errors: { cookieDays: "number" } });
    expect(parseProgramForm(program({ currency: "US" }))).toEqual({ ok: false, errors: { currency: "currency" } });
  });
});

const offerValues = (o: Partial<OfferFormValues> = {}): OfferFormValues => ({
  kind: "affiliate",
  label: "try_it",
  destinationUrl: "https://elevenlabs.io",
  trackingTemplate: "https://try.elevenlabs.io/7fnly5cv33k3",
  startsAt: "",
  endsAt: "",
  status: "active",
  ...o,
});
const ctx = (o: Partial<OfferContext> = {}): OfferContext => ({ merchant: { id: "M1", allowedHosts: HOSTS }, program: { id: "P1", merchantId: "M1" }, ...o });

describe("parseOfferForm", () => {
  it("accepts the first partner's default offer (label try_it, link with no placeholder)", () => {
    expect(parseOfferForm(offerValues(), ctx())).toEqual({
      ok: true,
      offer: {
        programId: "P1",
        subjectType: "merchant",
        subjectId: "M1",
        kind: "affiliate",
        label: "try_it",
        destinationUrl: "https://elevenlabs.io/",
        trackingTemplate: "https://try.elevenlabs.io/7fnly5cv33k3",
        startsAt: null,
        endsAt: null,
        status: "active",
      },
    });
  });

  it("accepts an offer with no program and no template", () => {
    const r = parseOfferForm(offerValues({ kind: "official", label: "visit_site", trackingTemplate: "" }), ctx({ program: null }));
    expect(r.ok && r.offer).toMatchObject({ programId: null, trackingTemplate: null, kind: "official" });
  });

  it("rejects a template on an offer with no program", () => {
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://try.elevenlabs.io/x" }), ctx({ program: null }))).toEqual({ ok: false, errors: { trackingTemplate: "template_without_program" } });
  });

  it("rejects a program of another merchant", () => {
    expect(parseOfferForm(offerValues(), ctx({ program: { id: "P9", merchantId: "M2" } }))).toEqual({ ok: false, errors: { programId: "program_merchant" } });
  });

  it("an offer with a program must have a tracking template", () => {
    expect(parseOfferForm(offerValues({ trackingTemplate: "" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_required" } });
  });

  it("destination_url must not equal the filled or the normalised template", () => {
    expect(parseOfferForm(offerValues({ destinationUrl: "https://try.elevenlabs.io/7fnly5cv33k3" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "same_as_template" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://elevenlabs.io/", trackingTemplate: "https://elevenlabs.io" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "same_as_template" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://try.elevenlabs.io/r?c=01HZZZZZZZZZZZZZZZZZZZZZZZ", trackingTemplate: "https://try.elevenlabs.io/r?c={click_id}" }), ctx())).toEqual({
      ok: false,
      errors: { destinationUrl: "same_as_template" },
    });
  });

  it("applies every URL rule to destination_url and to the template", () => {
    expect(parseOfferForm(offerValues({ destinationUrl: "" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "required" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "http://elevenlabs.io" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_scheme" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://evil.com" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_not_allowed" } });
    expect(parseOfferForm(offerValues({ destinationUrl: "https://elevenlabs.io@evil.com" }), ctx())).toEqual({ ok: false, errors: { destinationUrl: "url_authority" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://try.elevenlabs.io/{foo}" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_placeholder" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://evil.com/{click_id}" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_not_allowed" } });
    expect(parseOfferForm(offerValues({ trackingTemplate: "https://{src}.elevenlabs.io/" }), ctx())).toEqual({ ok: false, errors: { trackingTemplate: "template_placeholder_position" } });
  });

  it("checks kind, label (try_it is valid, buy_now is not) and status", () => {
    expect(parseOfferForm(offerValues({ label: "buy_now", kind: "x", status: "y" }), ctx())).toEqual({ ok: false, errors: { label: "choice", kind: "choice", status: "choice" } });
    for (const label of LABELS) expect(parseOfferForm(offerValues({ label }), ctx()).ok, label).toBe(true);
  });

  it("reads the window: empty is null, a date is midnight UTC, an impossible date or an inverted window is an error", () => {
    const r = parseOfferForm(offerValues({ startsAt: "2026-10-05", endsAt: "2026-11-01T10:00Z" }), ctx());
    expect(r.ok && [r.offer.startsAt, r.offer.endsAt]).toEqual(["2026-10-05T00:00:00.000Z", "2026-11-01T10:00:00.000Z"]);
    expect(parseOfferForm(offerValues({ startsAt: "2026-02-31" }), ctx())).toEqual({ ok: false, errors: { startsAt: "date" } });
    expect(parseOfferForm(offerValues({ startsAt: "yesterday" }), ctx())).toEqual({ ok: false, errors: { startsAt: "date" } });
    expect(parseOfferForm(offerValues({ startsAt: "2026-11-01", endsAt: "2026-10-05" }), ctx())).toEqual({ ok: false, errors: { endsAt: "date_order" } });
    expect(parseOfferForm(offerValues({ startsAt: "2026-10-05", endsAt: "2026-10-05" }), ctx())).toEqual({ ok: false, errors: { endsAt: "date_order" } });
  });
});

const NOW = "2026-10-05T12:00:00.000Z";
const CLICK = "01J00000000000000000000000";
const TEMPLATE = "https://try.elevenlabs.io/r/{click_id}?l={locale}&s={src}";
const TRACKED_URL = `https://try.elevenlabs.io/r/${CLICK}?l=vi&s=tools`;
const UTM = "utm_source=vnx.si&utm_medium=referral";
const FLAGS_OFF = { affiliate: false, partner_referral: false };

const merchant = (o: Partial<RedirectMerchant> = {}): RedirectMerchant => ({ id: "M1", status: "active", websiteUrl: "https://elevenlabs.io", allowedHosts: HOSTS, ...o });
const prog = (o: Partial<RedirectProgram> = {}): RedirectProgram => ({ id: "P1", merchantId: "M1", type: "affiliate", status: "active", ...o });
const offer = (o: Partial<RedirectOffer> = {}): RedirectOffer => ({
  id: "O1",
  subjectType: "merchant",
  subjectId: "M1",
  programId: "P1",
  status: "active",
  destinationUrl: "https://elevenlabs.io",
  trackingTemplate: TEMPLATE,
  startsAt: null,
  endsAt: null,
  ...o,
});
const plainOffer = (o: Partial<RedirectOffer> = {}) => offer({ programId: null, trackingTemplate: null, ...o });
const input = (o: Partial<RedirectInput> = {}): RedirectInput => ({
  offer: offer(),
  program: prog(),
  merchant: merchant(),
  flags: { affiliate: true, partner_referral: false },
  now: NOW,
  clickId: CLICK,
  locale: "vi",
  src: "tools",
  ...o,
});
const resolve = (o: Partial<RedirectInput> = {}) => resolveOfferRedirect(input(o));

describe("resolveOfferRedirect: tracked", () => {
  it("fills the template with the click id, locale and src and returns the validated href", () => {
    expect(resolve()).toEqual({ kind: "tracked", url: TRACKED_URL, programId: "P1" });
  });

  it("uses partner_referral for referral and revenue_share", () => {
    for (const type of ["referral", "revenue_share"] as const) {
      expect(resolve({ program: prog({ type }), flags: { affiliate: false, partner_referral: true } }).kind, type).toBe("tracked");
    }
  });

  it("hostile locale or src cannot change the host", () => {
    const r = resolve({ locale: "../../@evil.com", src: "https://evil.com" });
    expect(r.kind).toBe("tracked");
    if (r.kind === "tracked") {
      expect(new URL(r.url).hostname).toBe("try.elevenlabs.io");
      expect(r.url).not.toContain("@");
    }
  });

  it("an offer without a program needs no flag, goes to destination_url with utm, and keeps an existing utm", () => {
    expect(resolve({ program: null, offer: plainOffer(), flags: FLAGS_OFF })).toEqual({ kind: "tracked", url: `https://elevenlabs.io/?${UTM}`, programId: null });
    expect(resolve({ program: null, offer: plainOffer({ destinationUrl: "https://elevenlabs.io/?utm_source=x" }), flags: FLAGS_OFF })).toEqual({
      kind: "tracked",
      url: "https://elevenlabs.io/?utm_source=x",
      programId: null,
    });
  });

  it("a program offer gets no utm: the partner's own link is used as it is", () => {
    const r = resolve();
    expect(r.kind === "tracked" && r.url.includes("utm_")).toBe(false);
  });

  it("the start of the window is inclusive and the end is exclusive", () => {
    expect(resolve({ offer: offer({ startsAt: NOW }) }).kind).toBe("tracked");
    expect(resolve({ offer: offer({ endsAt: NOW }) })).toEqual({ kind: "fallback", url: `https://elevenlabs.io/?${UTM}`, reason: "offer_ended" });
  });
});

describe("resolveOfferRedirect: fallback to the merchant's website_url (the caller records a click)", () => {
  const fallback = (reason: string) => ({ kind: "fallback", url: `https://elevenlabs.io/?${UTM}`, reason });

  it("flag off for the program's type", () => {
    expect(resolve({ flags: { affiliate: false, partner_referral: true } })).toEqual(fallback("flag_off"));
    expect(resolve({ program: prog({ type: "referral" }), flags: { affiliate: true, partner_referral: false } })).toEqual(fallback("flag_off"));
  });

  it("program draft, paused or ended", () => {
    for (const status of ["draft", "paused", "ended"] as const) expect(resolve({ program: prog({ status }) }), status).toEqual(fallback("program_not_active"));
  });

  it("program type direct has no flag, so it never tracks", () => {
    expect(resolve({ program: prog({ type: "direct" }), flags: { affiliate: true, partner_referral: true } })).toEqual(fallback("program_direct"));
  });

  it("offer paused or outside its window", () => {
    expect(resolve({ offer: offer({ status: "paused" }) })).toEqual(fallback("offer_paused"));
    expect(resolve({ offer: offer({ startsAt: "2026-10-06T00:00:00.000Z" }) })).toEqual(fallback("offer_not_started"));
    expect(resolve({ offer: offer({ endsAt: "2026-10-04T00:00:00.000Z" }) })).toEqual(fallback("offer_ended"));
  });

  it("merchant paused", () => {
    expect(resolve({ merchant: merchant({ status: "paused" }) })).toEqual(fallback("merchant_paused"));
  });

  it("an offer without a program that is paused", () => {
    expect(resolve({ program: null, offer: plainOffer({ status: "paused" }) })).toEqual(fallback("offer_paused"));
  });

  it("reports the first failing condition: merchant, offer, window, program status, flag", () => {
    const all = { merchant: merchant({ status: "paused" }), offer: offer({ status: "paused", endsAt: "2026-10-04T00:00:00.000Z" }), program: prog({ status: "draft" }), flags: FLAGS_OFF };
    expect(resolve(all)).toMatchObject({ reason: "merchant_paused" });
    expect(resolve({ ...all, merchant: merchant() })).toMatchObject({ reason: "offer_paused" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer({ endsAt: "2026-10-04T00:00:00.000Z" }) })).toMatchObject({ reason: "offer_ended" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer() })).toMatchObject({ reason: "program_not_active" });
    expect(resolve({ ...all, merchant: merchant(), offer: offer(), program: prog() })).toMatchObject({ reason: "flag_off" });
  });

  it("has no template and no click id in it, and the href is the normalised website_url", () => {
    const r = resolve({ flags: FLAGS_OFF, merchant: merchant({ websiteUrl: "https://ELEVENLABS.IO" }) });
    expect(r).toEqual(fallback("flag_off"));
    expect(JSON.stringify(r)).not.toContain(CLICK);
  });
});

describe("resolveOfferRedirect: not_found", () => {
  const notFound = (reason: string) => ({ kind: "not_found", reason });

  it("missing offer or merchant", () => {
    expect(resolve({ offer: null })).toEqual(notFound("offer_missing"));
    expect(resolve({ merchant: null })).toEqual(notFound("merchant_missing"));
  });

  it("an archived offer or merchant is dead, even when everything else would fall back", () => {
    expect(resolve({ flags: FLAGS_OFF, offer: offer({ status: "archived" }) })).toEqual(notFound("offer_archived"));
    expect(resolve({ flags: FLAGS_OFF, merchant: merchant({ status: "archived" }) })).toEqual(notFound("merchant_archived"));
  });

  it("broken references: no program row, a program of another merchant, a program offer with no template", () => {
    expect(resolve({ program: null })).toEqual(notFound("program_missing"));
    expect(resolve({ program: prog({ id: "P2" }) })).toEqual(notFound("program_missing"));
    expect(resolve({ program: prog({ merchantId: "M2" }) })).toEqual(notFound("program_merchant"));
    expect(resolve({ offer: offer({ trackingTemplate: null }) })).toEqual(notFound("template_missing"));
    expect(resolve({ offer: offer({ trackingTemplate: null }), flags: FLAGS_OFF })).toEqual(notFound("template_missing"));
    expect(resolve({ offer: offer({ trackingTemplate: "" }) })).toEqual(notFound("template_missing"));
    expect(resolve({ offer: offer({ trackingTemplate: "" }), flags: FLAGS_OFF })).toEqual(notFound("template_missing"));
  });

  it("a stored template with a placeholder in the host never lets a request value choose the host", () => {
    expect(resolve({ offer: offer({ trackingTemplate: "https://{src}/x" }), src: "elevenlabs.io" })).toEqual(notFound("invalid_url"));
  });

  it("an offer whose subject is not this merchant (with or without a program)", () => {
    expect(resolve({ offer: offer({ subjectId: "M2" }) })).toEqual(notFound("subject_merchant"));
    expect(resolve({ program: null, offer: plainOffer({ subjectId: "M2" }) })).toEqual(notFound("subject_merchant"));
    expect(resolve({ program: null, offer: plainOffer({ subjectType: "product" }), flags: FLAGS_OFF })).toEqual(notFound("subject_merchant"));
  });

  it("a window the database cannot be read as", () => {
    expect(resolve({ offer: offer({ startsAt: "garbage" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ endsAt: "2026-13-45" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ startsAt: "Oct 5 2026" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ endsAt: "2026-02-31T00:00:00.000Z" }) })).toEqual(notFound("window_invalid"));
    expect(resolve({ offer: offer({ startsAt: "2026-10-05" }) })).toEqual(notFound("window_invalid"));
  });

  it("corrupt data in the tracked path never redirects: bad template host, bad destination_url", () => {
    expect(resolve({ offer: offer({ trackingTemplate: "https://evil.com/{click_id}" }) })).toEqual(notFound("invalid_url"));
    for (const destinationUrl of ["http://elevenlabs.io", "https://user@elevenlabs.io", "https://127.0.0.1", "https://evil.com", "https://[::1]/"]) {
      expect(resolve({ program: null, offer: plainOffer({ destinationUrl }) }), destinationUrl).toEqual(notFound("invalid_url"));
    }
  });

  it("a website_url that fails the URL rules or allowed_hosts is not_found when a fallback is needed", () => {
    for (const websiteUrl of ["http://elevenlabs.io", "https://evil.com", "https://elevenlabs.io@evil.com", "https://localhost", "https://elevenlabs.io:8443"]) {
      expect(resolve({ flags: FLAGS_OFF, merchant: merchant({ websiteUrl }) }), websiteUrl).toEqual(notFound("website_invalid"));
    }
  });
});

describe("resolveOfferRedirect: the full truth table", () => {
  const WINDOWS = {
    inside: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" },
    before: { startsAt: "2026-11-01T00:00:00.000Z", endsAt: null },
    after: { startsAt: null, endsAt: "2026-10-01T00:00:00.000Z" },
  } as const;

  it("with a program: 4 types x 4 flag states x 4 program statuses x 3 offer statuses x 3 windows x 3 merchant statuses", () => {
    const wrong: string[] = [];
    let count = 0;
    for (const type of PROGRAM_TYPES)
      for (const affiliate of [true, false])
        for (const partner_referral of [true, false])
          for (const pStatus of PROGRAM_STATUSES)
            for (const oStatus of OFFER_STATUSES)
              for (const [w, window] of Object.entries(WINDOWS))
                for (const mStatus of MERCHANT_STATUSES) {
                  const flagOn = type === "affiliate" ? affiliate : type === "direct" ? false : partner_referral;
                  const expected =
                    oStatus === "archived" || mStatus === "archived"
                      ? "not_found"
                      : oStatus === "active" && w === "inside" && mStatus === "active" && pStatus === "active" && flagOn
                        ? "tracked"
                        : "fallback";
                  const got = resolve({
                    offer: offer({ status: oStatus, ...window }),
                    program: prog({ type, status: pStatus }),
                    merchant: merchant({ status: mStatus }),
                    flags: { affiliate, partner_referral },
                  }).kind;
                  count++;
                  if (got !== expected) wrong.push(`${type}/aff=${affiliate}/ref=${partner_referral}/${pStatus}/${oStatus}/${w}/${mStatus}: ${got} != ${expected}`);
                }
    expect(count).toBe(1728);
    expect(wrong).toEqual([]);
  });

  it("without a program the flags never matter: 3 offer statuses x 3 windows x 3 merchant statuses x 4 flag states", () => {
    const wrong: string[] = [];
    let count = 0;
    for (const oStatus of OFFER_STATUSES)
      for (const [w, window] of Object.entries(WINDOWS))
        for (const mStatus of MERCHANT_STATUSES)
          for (const affiliate of [true, false])
            for (const partner_referral of [true, false]) {
              const expected = oStatus === "archived" || mStatus === "archived" ? "not_found" : oStatus === "active" && w === "inside" && mStatus === "active" ? "tracked" : "fallback";
              const got = resolve({ program: null, offer: plainOffer({ status: oStatus, ...window }), merchant: merchant({ status: mStatus }), flags: { affiliate, partner_referral } }).kind;
              count++;
              if (got !== expected) wrong.push(`${oStatus}/${w}/${mStatus}/${affiliate}/${partner_referral}: ${got} != ${expected}`);
            }
    expect(count).toBe(108);
    expect(wrong).toEqual([]);
  });
});

describe("programTransitionAllowed", () => {
  it("ended is terminal; everything else moves freely; no change is always fine", () => {
    for (const from of PROGRAM_STATUSES) {
      for (const to of PROGRAM_STATUSES) expect(programTransitionAllowed(from, to), `${from}->${to}`).toBe(from === to || from !== "ended");
    }
  });
});
