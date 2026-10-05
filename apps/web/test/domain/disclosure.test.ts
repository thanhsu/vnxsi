import { describe, expect, it } from "vitest";
import { offerInWindow, offerRel, showsDisclosure, toolIndexable, visibleOffers, type ListedOffer } from "../../src/domain/offer.ts";

const NOW = "2026-10-05T12:00:00.000Z";
const merchant = { id: "m1", status: "active", websiteUrl: "https://example.com/", allowedHosts: ["example.com"], defaultOfferId: "o1" } as const;
const FLAGS_OFF = { affiliate: false, partner_referral: false };
const PROGRAM = { id: "p1", merchantId: "m1", type: "affiliate", status: "active" } as const;

const row = (id: string, over: Partial<ListedOffer["offer"]> = {}, prog: ListedOffer["program"] = null, label: ListedOffer["label"] = "visit_site"): ListedOffer => ({
  offer: {
    id,
    subjectType: "merchant",
    subjectId: "m1",
    programId: prog?.id ?? null,
    status: "active",
    destinationUrl: "https://example.com/",
    trackingTemplate: prog ? "https://example.com/r?c={click_id}" : null,
    startsAt: null,
    endsAt: null,
    ...over,
  },
  label,
  program: prog,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("offerInWindow", () => {
  it("starts inclusive, ends exclusive, open ends allowed, malformed instants outside", () => {
    expect(offerInWindow({ startsAt: null, endsAt: null }, NOW)).toBe(true);
    expect(offerInWindow({ startsAt: NOW, endsAt: null }, NOW)).toBe(true);
    expect(offerInWindow({ startsAt: null, endsAt: NOW }, NOW)).toBe(false);
    expect(offerInWindow({ startsAt: "2026-10-05T12:00:00.001Z", endsAt: null }, NOW)).toBe(false);
    expect(offerInWindow({ startsAt: "tomorrow", endsAt: null }, NOW)).toBe(false);
    expect(offerInWindow({ startsAt: null, endsAt: null }, "not a date")).toBe(false);
  });
});

describe("visibleOffers (what /tools/:slug lists)", () => {
  it("keeps active, in-window offers in input order and marks the default one", () => {
    const out = visibleOffers({ merchant, rows: [row("o1", {}, PROGRAM, "try_it"), row("o2", {}, null, "learn_more")], flags: FLAGS_OFF, now: NOW });
    expect(out).toEqual([
      { id: "o1", label: "try_it", isDefault: true, programId: "p1" },
      { id: "o2", label: "learn_more", isDefault: false, programId: null },
    ]);
  });

  it("drops paused, archived, not-started and ended offers", () => {
    const rows = [row("a", { status: "paused" }), row("b", { status: "archived" }), row("c", { startsAt: "2026-10-06T00:00:00.000Z" }), row("d", { endsAt: "2026-10-05T00:00:00.000Z" }), row("e")];
    expect(ids(visibleOffers({ merchant, rows, flags: FLAGS_OFF, now: NOW }))).toEqual(["e"]);
  });

  it("drops an offer /go/ would answer 404 (host no longer allowed, foreign subject), but keeps one that falls back", () => {
    const rows = [row("bad-host", { destinationUrl: "https://other.test/" }), row("foreign", { subjectId: "m2" }), row("fb", {}, PROGRAM)];
    // The program offer is kept with the flag off (fallback to website_url): launch state.
    expect(ids(visibleOffers({ merchant, rows, flags: FLAGS_OFF, now: NOW }))).toEqual(["fb"]);
    expect(ids(visibleOffers({ merchant, rows: [row("draft", {}, { ...PROGRAM, status: "draft" })], flags: { affiliate: true, partner_referral: true }, now: NOW }))).toEqual(["draft"]);
  });
});

describe("showsDisclosure and offerRel (Review Focus 4)", () => {
  it("is true as soon as one rendered offer has a program, whatever the flag or program status", () => {
    expect(showsDisclosure([])).toBe(false);
    expect(showsDisclosure([{ programId: null }, { programId: null }])).toBe(false);
    expect(showsDisclosure([{ programId: null }, { programId: "p1" }])).toBe(true);
  });

  it("marks program links sponsored, the rest noopener only", () => {
    expect(offerRel({ programId: "p1" })).toBe("sponsored noopener");
    expect(offerRel({ programId: null })).toBe("noopener");
  });
});

describe("toolIndexable (Owner 2026-10-05: noindex at launch)", () => {
  it("needs indexable = 1 AND the content_indexing flag", () => {
    expect(toolIndexable({ indexable: true }, true)).toBe(true);
    expect(toolIndexable({ indexable: true }, false)).toBe(false);
    expect(toolIndexable({ indexable: false }, true)).toBe(false);
    expect(toolIndexable({ indexable: false }, false)).toBe(false);
  });
});
