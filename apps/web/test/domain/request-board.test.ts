import { describe, expect, it } from "vitest";
import {
  BOARD_PAGE_SIZE,
  boardEnabled,
  canEditPublication,
  CLOSED_VISIBLE_DAYS,
  EXCERPT_LENGTH,
  INTEREST_DAILY_LIMIT,
  INTEREST_NOTE_MAX,
  INTEREST_PENDING_CAP,
  INTEREST_STATUSES,
  interestTransition,
  isBoardIndexable,
  isBoardLive,
  MIN_OPEN_FOR_INDEX,
  parseBoardGoLive,
  parseBoardQuery,
  parseInterestForm,
  parsePublicListing,
  parseReviewNote,
  PUBLIC_DESCRIPTION_MAX,
  PUBLIC_DESCRIPTION_MIN,
  PUBLIC_TITLE_MAX,
  PUBLICATION_STATUSES,
  publicationTransition,
  publicExcerpt,
  REVIEW_NOTE_MAX,
  requestVisibility,
  type PublicationAction,
  type PublicationStatus,
} from "../../src/domain/request-board.ts";
import { REQUEST_STATUSES, type RequestStatus } from "../../src/domain/request.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-12-10T12:00:00.000Z");
const ULID = "01M4JN4MCK5P5XXY8W84GP53YJ";

describe("constants (addendum §3, §9, Q10, Q13)", () => {
  it("have the approved values", () => {
    expect([PUBLIC_TITLE_MAX, PUBLIC_DESCRIPTION_MIN, PUBLIC_DESCRIPTION_MAX, REVIEW_NOTE_MAX, INTEREST_NOTE_MAX]).toEqual([120, 40, 4000, 1000, 500]);
    expect([CLOSED_VISIBLE_DAYS, INTEREST_DAILY_LIMIT, INTEREST_PENDING_CAP, MIN_OPEN_FOR_INDEX, BOARD_PAGE_SIZE, EXCERPT_LENGTH]).toEqual([30, 10, 30, 5, 24, 200]);
    expect([...PUBLICATION_STATUSES]).toEqual(["pending_review", "published", "rejected", "withdrawn", "unpublished"]);
    expect([...INTEREST_STATUSES]).toEqual(["pending", "invited", "dismissed", "withdrawn"]);
  });
});

describe("publicationTransition (§7.1)", () => {
  const open: RequestStatus[] = ["submitted", "matching"];
  const t = (s: PublicationStatus | null, a: PublicationAction, actor: "client" | "ops", r: RequestStatus) => publicationTransition(s, a, actor, r);

  it("opt-in: client only, from no publication, for a request that is pending verification, submitted or matching", () => {
    for (const r of ["pending_verification", "submitted", "matching"] as const) expect(t(null, "opt_in", "client", r)).toEqual({ ok: true, status: "pending_review" });
    for (const r of ["builder_selected", "rejected", "expired", "closed", "removed"] as const) expect(t(null, "opt_in", "client", r), r).toEqual({ ok: false, error: "invalid_transition" });
    expect(t(null, "opt_in", "ops", "submitted").ok).toBe(false);
    for (const s of PUBLICATION_STATUSES) expect(t(s, "opt_in", "client", "submitted").ok, s).toBe(false);
  });

  it("opt-in again: withdrawn only, open request only; rejected and unpublished never come back", () => {
    for (const r of open) expect(t("withdrawn", "re_opt_in", "client", r)).toEqual({ ok: true, status: "pending_review" });
    for (const r of REQUEST_STATUSES.filter((x) => !open.includes(x))) expect(t("withdrawn", "re_opt_in", "client", r).ok, r).toBe(false);
    for (const s of ["rejected", "unpublished", "pending_review", "published"] as const) expect(t(s, "re_opt_in", "client", "submitted").ok, s).toBe(false);
    expect(t(null, "re_opt_in", "client", "submitted").ok).toBe(false);
    expect(t("withdrawn", "re_opt_in", "ops", "submitted").ok).toBe(false);
  });

  it("publish: ops, pending_review, open request only", () => {
    for (const r of open) expect(t("pending_review", "publish", "ops", r)).toEqual({ ok: true, status: "published" });
    for (const r of ["pending_verification", "builder_selected", "rejected", "expired", "closed", "removed"] as const) expect(t("pending_review", "publish", "ops", r).ok, r).toBe(false);
    for (const s of ["published", "rejected", "withdrawn", "unpublished"] as const) expect(t(s, "publish", "ops", "submitted").ok, s).toBe(false);
    expect(t("pending_review", "publish", "client", "submitted").ok).toBe(false);
  });

  it("reject: ops, from pending_review, in any request status", () => {
    for (const r of REQUEST_STATUSES) expect(t("pending_review", "reject", "ops", r)).toEqual({ ok: true, status: "rejected" });
    for (const s of ["published", "rejected", "withdrawn", "unpublished"] as const) expect(t(s, "reject", "ops", "submitted").ok, s).toBe(false);
    expect(t("pending_review", "reject", "client", "submitted").ok).toBe(false);
  });

  it("unpublish: ops, from published only", () => {
    expect(t("published", "unpublish", "ops", "closed")).toEqual({ ok: true, status: "unpublished" });
    for (const s of ["pending_review", "rejected", "withdrawn", "unpublished"] as const) expect(t(s, "unpublish", "ops", "submitted").ok, s).toBe(false);
    expect(t("published", "unpublish", "client", "submitted").ok).toBe(false);
  });

  it("withdraw: client, from pending_review or published, in every request status", () => {
    for (const r of REQUEST_STATUSES) for (const s of ["pending_review", "published"] as const) expect(t(s, "withdraw", "client", r), `${s}/${r}`).toEqual({ ok: true, status: "withdrawn" });
    for (const s of ["rejected", "withdrawn", "unpublished"] as const) expect(t(s, "withdraw", "client", "submitted").ok, s).toBe(false);
    expect(t(null, "withdraw", "client", "submitted").ok).toBe(false);
    expect(t("published", "withdraw", "ops", "submitted").ok).toBe(false);
  });

  it("rejected and unpublished have no way out", () => {
    const actions: PublicationAction[] = ["opt_in", "re_opt_in", "publish", "reject", "unpublish", "withdraw"];
    for (const s of ["rejected", "unpublished"] as const) for (const a of actions) for (const actor of ["client", "ops"] as const) for (const r of REQUEST_STATUSES) expect(t(s, a, actor, r).ok, `${s}/${a}/${actor}/${r}`).toBe(false);
  });

  it("only a published listing can be edited", () => {
    for (const s of PUBLICATION_STATUSES) expect(canEditPublication(s), s).toBe(s === "published");
    expect(canEditPublication(null)).toBe(false);
  });
});

describe("interestTransition (§7.2)", () => {
  it("moves pending to a final state by the right actor", () => {
    expect(interestTransition("pending", "invite", "ops")).toEqual({ ok: true, status: "invited" });
    expect(interestTransition("pending", "invite", "system")).toEqual({ ok: true, status: "invited" });
    expect(interestTransition("pending", "dismiss", "ops")).toEqual({ ok: true, status: "dismissed" });
    expect(interestTransition("pending", "withdraw", "builder")).toEqual({ ok: true, status: "withdrawn" });
  });

  it("refuses the wrong actor and every move out of a final state", () => {
    expect(interestTransition("pending", "invite", "builder").ok).toBe(false);
    expect(interestTransition("pending", "dismiss", "builder").ok).toBe(false);
    expect(interestTransition("pending", "dismiss", "system").ok).toBe(false);
    expect(interestTransition("pending", "withdraw", "ops").ok).toBe(false);
    for (const s of ["invited", "dismissed", "withdrawn"] as const) {
      for (const a of ["invite", "dismiss", "withdraw"] as const) for (const actor of ["system", "ops", "builder"] as const) expect(interestTransition(s, a, actor).ok, `${s}/${a}/${actor}`).toBe(false);
    }
  });
});

describe("requestVisibility: every cell of the §7.3 table", () => {
  const closedAt = "2026-12-01T00:00:00.000Z";
  const cell = (r: RequestStatus, p: PublicationStatus | null) => requestVisibility(r, p, closedAt, NOW);
  const OTHER_PUBLICATIONS: (PublicationStatus | null)[] = ["pending_review", "rejected", "withdrawn", "unpublished", null];

  it("covers all 8 request statuses", () => {
    expect(REQUEST_STATUSES).toHaveLength(8);
  });

  it("published listing: open for submitted and matching", () => {
    expect(cell("submitted", "published")).toBe("open");
    expect(cell("matching", "published")).toBe("open");
  });

  it("published listing: closed within 30 days for the four ended statuses, hidden at once for removed and pending_verification", () => {
    for (const r of ["builder_selected", "rejected", "expired", "closed"] as const) expect(cell(r, "published"), r).toBe("closed");
    expect(cell("removed", "published")).toBe("hidden");
    expect(cell("pending_verification", "published")).toBe("hidden");
  });

  it("no published listing: hidden for every request status", () => {
    for (const r of REQUEST_STATUSES) for (const p of OTHER_PUBLICATIONS) expect(cell(r, p), `${r}/${String(p)}`).toBe("hidden");
  });

  it("closed window edges: closedAt + 30 days - 1 ms is closed, exactly + 30 days is hidden", () => {
    const at = Date.parse(closedAt) + 30 * DAY;
    expect(requestVisibility("closed", "published", closedAt, new Date(at - 1))).toBe("closed");
    expect(requestVisibility("closed", "published", closedAt, new Date(at))).toBe("hidden");
    expect(requestVisibility("closed", "published", closedAt, new Date(at + 1))).toBe("hidden");
    expect(requestVisibility("closed", "published", closedAt, new Date(Date.parse(closedAt)))).toBe("closed");
  });

  it("an ended request with a missing or unreadable closedAt is hidden (fail closed); an open one does not need it", () => {
    for (const r of ["builder_selected", "rejected", "expired", "closed"] as const) {
      expect(requestVisibility(r, "published", null, NOW), r).toBe("hidden");
      expect(requestVisibility(r, "published", "not a date", NOW), r).toBe("hidden");
      expect(requestVisibility(r, "published", "", NOW), r).toBe("hidden");
    }
    expect(requestVisibility("submitted", "published", null, NOW)).toBe("open");
    expect(requestVisibility("closed", "published", closedAt, new Date(NaN))).toBe("hidden");
  });
});

describe("parsePublicListing (L1: code points)", () => {
  const desc = (n: number) => "d".repeat(n);
  const parse = (title: string, description: string) => parsePublicListing({ title, description });

  it("title: 0 and spaces required, 1 and 120 ok, 121 too long", () => {
    expect(parse("", desc(40))).toEqual({ ok: false, errors: { title: "required" } });
    expect(parse("   ", desc(40))).toEqual({ ok: false, errors: { title: "required" } });
    expect(parse("t", desc(40)).ok).toBe(true);
    expect(parse("t".repeat(120), desc(40)).ok).toBe(true);
    expect(parse("t".repeat(121), desc(40))).toEqual({ ok: false, errors: { title: "too_long" } });
  });

  it("description: 39 too short, 40 and 4000 ok, 4001 too long, empty required", () => {
    expect(parse("t", "")).toEqual({ ok: false, errors: { description: "required" } });
    expect(parse("t", desc(39))).toEqual({ ok: false, errors: { description: "too_short" } });
    expect(parse("t", desc(40)).ok).toBe(true);
    expect(parse("t", desc(4000)).ok).toBe(true);
    expect(parse("t", desc(4001))).toEqual({ ok: false, errors: { description: "too_long" } });
  });

  it("L1: 20 emoji are 40 code units but 20 code points, so too_short; 40 emoji pass; 121 emoji in a title are too long, 120 pass", () => {
    const e = "😀";
    expect(e.length).toBe(2);
    expect(parse("t", e.repeat(20))).toEqual({ ok: false, errors: { description: "too_short" } });
    expect(parse("t", e.repeat(40)).ok).toBe(true);
    expect(parse(e.repeat(120), desc(40)).ok).toBe(true); // 240 code units
    expect(parse(e.repeat(121), desc(40))).toEqual({ ok: false, errors: { title: "too_long" } });
    expect(parse("t", e.repeat(4001))).toEqual({ ok: false, errors: { description: "too_long" } });
  });

  it("trims, normalises line breaks, keeps paragraphs", () => {
    const r = parse("  Booking app  ", `  Line one of the brief\r\n\r\nLine two of the brief with more words  `);
    expect(r).toEqual({ ok: true, input: { title: "Booking app", description: "Line one of the brief\n\nLine two of the brief with more words" } });
  });

  it("control and format characters are invalid: in a title any, in a description all but line breaks and tabs", () => {
    expect(parse("a\u0007b", desc(40))).toEqual({ ok: false, errors: { title: "invalid" } });
    expect(parse("a\u202eb", desc(40))).toEqual({ ok: false, errors: { title: "invalid" } });
    expect(parse("a\tb", desc(40))).toEqual({ ok: false, errors: { title: "invalid" } });
    expect(parse("t", `${desc(40)}\u0000`)).toEqual({ ok: false, errors: { description: "invalid" } });
    expect(parse("t", `${desc(40)}\u200b`).ok).toBe(true); // ZWSP is a format character, allowed in multi-line text (M-1)
    expect(parse("t", `${desc(20)}\n\t${desc(20)}`).ok).toBe(true);
  });

  it("M-1: description accepts ZWJ and flag emoji, soft hyphen, variation selectors, Vietnamese NFC and NFD, Chinese", () => {
    const text = (extra: string) => `${extra} ${"d".repeat(40)}`;
    for (const extra of ["👩‍💻", "👨‍👩‍👧", "🏳️‍🌈", "soft\u00adhyphen", "heart️", "zw\u200cnj", "Tiếng Việt có dấu: Hà Nội", "Tiếng Việt".normalize("NFD"), "我们需要一个在线预订系统，带短信提醒"]) {
      expect(parse("t", text(extra)).ok, extra).toBe(true);
    }
    expect(parse("t", text("Ví dụ".normalize("NFD"))).ok).toBe(true);
  });

  it("M-1: bidi overrides and isolates and other control characters are still refused in a description", () => {
    for (const bad of ["\u202e", "\u202a", "\u202d", "\u2066", "\u2069", "\u0085", "\u0000", "\u001b"]) {
      expect(parse("t", `${"d".repeat(40)}${bad}x`), JSON.stringify(bad)).toEqual({ ok: false, errors: { description: "invalid" } });
    }
  });

  it("M-1: a leading BOM is stripped; the title rule is unchanged (any format character refused)", () => {
    expect(parse("t", `\ufeff${"d".repeat(40)}`)).toEqual({ ok: true, input: { title: "t", description: "d".repeat(40) } });
    expect(parse("a‍b", "d".repeat(40))).toEqual({ ok: false, errors: { title: "invalid" } });
    expect(parse("a\u00adb", "d".repeat(40))).toEqual({ ok: false, errors: { title: "invalid" } });
  });

  it("M-1: code-point counts still agree with SQL length(): a ZWJ sequence counts every code point", () => {
    const family = "👨‍👩‍👧"; // 5 code points
    expect([...family]).toHaveLength(5);
    expect(parse("t", family.repeat(8)).ok).toBe(true); // 40 code points
    expect(parse("t", family.repeat(7))).toEqual({ ok: false, errors: { description: "too_short" } }); // 35
  });

  it("reports both errors together", () => {
    expect(parse("", "short")).toEqual({ ok: false, errors: { title: "required", description: "too_short" } });
  });
});

describe("parseReviewNote and parseInterestForm", () => {
  it("review note is required and at most 1000 code points", () => {
    expect(parseReviewNote("")).toEqual({ ok: false, error: "required" });
    expect(parseReviewNote("  \n ")).toEqual({ ok: false, error: "required" });
    expect(parseReviewNote("n".repeat(1000))).toEqual({ ok: true, note: "n".repeat(1000) });
    expect(parseReviewNote("n".repeat(1001))).toEqual({ ok: false, error: "too_long" });
    expect(parseReviewNote("😀".repeat(1000)).ok).toBe(true);
    expect(parseReviewNote("a\u0007")).toEqual({ ok: false, error: "invalid" });
  });

  it("interest note may be empty, 500 passes, 501 does not; product id empty or a ULID", () => {
    expect(parseInterestForm({ note: "", productId: "" })).toEqual({ ok: true, input: { note: null, productId: null } });
    expect(parseInterestForm({ note: " hi ", productId: ` ${ULID} ` })).toEqual({ ok: true, input: { note: "hi", productId: ULID } });
    expect(parseInterestForm({ note: "n".repeat(500), productId: "" }).ok).toBe(true);
    expect(parseInterestForm({ note: "n".repeat(501), productId: "" })).toEqual({ ok: false, errors: { note: "too_long" } });
    expect(parseInterestForm({ note: "😀".repeat(500), productId: "" }).ok).toBe(true);
    expect(parseInterestForm({ note: "😀".repeat(501), productId: "" }).ok).toBe(false);
    expect(parseInterestForm({ note: "", productId: "not-a-ulid" })).toEqual({ ok: false, errors: { productId: "invalid" } });
    expect(parseInterestForm({ note: "a\u0000", productId: "" })).toEqual({ ok: false, errors: { note: "invalid" } });
  });
});

describe("publicExcerpt", () => {
  it("leaves a short text alone and cuts a long one at 200 code points with an ellipsis", () => {
    expect(publicExcerpt("short text")).toBe("short text");
    expect(publicExcerpt("a".repeat(200))).toBe("a".repeat(200));
    expect(publicExcerpt("a".repeat(201))).toBe(`${"a".repeat(200)}…`);
  });

  it("does not cut a surrogate pair in two (emoji)", () => {
    const out = publicExcerpt("😀".repeat(250));
    expect(out).toBe(`${"😀".repeat(200)}…`);
    expect([...out]).toHaveLength(201);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(publicExcerpt(`${"a".repeat(199)}😀😀`)).toBe(`${"a".repeat(199)}😀…`);
  });

  it("counts CJK characters as one each", () => {
    expect(publicExcerpt("需".repeat(200))).toBe("需".repeat(200));
    expect(publicExcerpt("需".repeat(201))).toBe(`${"需".repeat(200)}…`);
  });

  it("L-1: cuts between graphemes: no dangling ZWJ, no split flag, no letter parted from its combining mark", () => {
    const woman = "👩‍💻"; // 3 code points
    const cut = publicExcerpt(`${"a".repeat(198)}${woman}tail`);
    expect(cut).toBe(`${"a".repeat(198)}…`); // the 3-code-point cluster does not fit in the last 2: dropped whole
    expect(cut).not.toMatch(/‍…$/);
    const flag = "🏳️‍🌈"; // 4 code points
    expect(publicExcerpt(`${"a".repeat(197)}${flag}z`)).toBe(`${"a".repeat(197)}…`);
    const nfd = "ệ".normalize("NFD"); // e + dot below + circumflex: 3 code points
    expect([...nfd]).toHaveLength(3);
    expect(publicExcerpt(`${"a".repeat(199)}${nfd}b`)).toBe(`${"a".repeat(199)}…`);
    expect(publicExcerpt(`${"a".repeat(197)}${nfd}b`)).toBe(`${"a".repeat(197)}${nfd}…`);
    for (const text of [woman.repeat(100), nfd.repeat(100), "🇻🇳".repeat(100)]) expect([...publicExcerpt(text)].length).toBeLessThanOrEqual(201);
  });

  it("L-1: any whitespace run (tabs, spaces, no-break) becomes one space", () => {
    expect(publicExcerpt("a \t b\u00A0\u00A0c\n\nd")).toBe("a b c d");
  });

  it("turns line breaks into single spaces, before counting", () => {
    expect(publicExcerpt("one\ntwo\r\n\r\n three")).toBe("one two three");
    expect(publicExcerpt(`${"a".repeat(198)}\n\nbcd`)).toBe(`${"a".repeat(198)} b…`);
  });
});

describe("parseBoardQuery and isBoardIndexable", () => {
  it("keeps valid category, budget, language and page; drops anything else", () => {
    expect(parseBoardQuery({ category: "booking", budget: "2k-10k", lang: "vi", page: "3" })).toEqual({ category: "booking", budget: "2k-10k", lang: "vi", page: 3 });
    expect(parseBoardQuery({ category: "nope", budget: "free", lang: "xx", page: "0" })).toEqual({ category: null, budget: null, lang: null, page: 1 });
    expect(parseBoardQuery({})).toEqual({ category: null, budget: null, lang: null, page: 1 });
  });

  it("has no sort: sort=paid and other unknown parameters are ignored", () => {
    const q = parseBoardQuery({ sort: "paid", featured: "1", boost: "1", category: "crm" });
    expect(q).toEqual({ category: "crm", budget: null, lang: null, page: 1 });
    expect(Object.keys(q).sort()).toEqual(["budget", "category", "lang", "page"]);
  });

  it("is indexable from 5 open listings", () => {
    expect(isBoardIndexable(4)).toBe(false);
    expect(isBoardIndexable(5)).toBe(true);
    expect(isBoardIndexable(0)).toBe(false);
  });
});

describe("go-live gate", () => {
  const D = "2026-12-01";
  it("isBoardLive: from go-live 00:00:00 UTC on, never before", () => {
    expect(isBoardLive(D, new Date("2026-11-30T23:59:59.999Z"))).toBe(false);
    expect(isBoardLive(D, new Date("2026-12-01T00:00:00.000Z"))).toBe(true);
    expect(isBoardLive(D, new Date("2030-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("is off for empty, undefined, impossible and non-date values (fail closed)", () => {
    for (const bad of ["", undefined, "2026-02-30", "2026-10-20T00:00", "2026-1-1", "tomorrow", " 2026-12-01"]) expect(isBoardLive(bad, NOW), String(bad)).toBe(false);
    expect(isBoardLive(D, new Date(NaN))).toBe(false);
    expect(parseBoardGoLive("2026-12-01")?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(parseBoardGoLive("")).toBeNull();
  });

  it("boardEnabled needs both the flag and the date", () => {
    expect(boardEnabled({ flag: true, goLive: D, now: NOW })).toBe(true);
    expect(boardEnabled({ flag: false, goLive: D, now: NOW })).toBe(false);
    expect(boardEnabled({ flag: true, goLive: "2027-01-01", now: NOW })).toBe(false);
    expect(boardEnabled({ flag: true, goLive: "", now: NOW })).toBe(false);
  });
});
