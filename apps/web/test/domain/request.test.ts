import { describe, expect, it } from "vitest";
import {
  INVITE_STATUSES,
  inviteTransition,
  isTerminalRequest,
  parseAdminNote,
  parseProposal,
  parseRequestForm,
  proposalValuesFromBody,
  REQUEST_STATUSES,
  requestTransition,
  requestValuesFromBody,
  suggestBuilders,
  type Candidate,
  type ProposalFormValues,
  type RequestFormValues,
} from "../../src/domain/request.ts";

describe("request state machine (spec §7.5)", () => {
  it("submits a pending request only through the confirmation", () => {
    expect(requestTransition("pending_verification", "verify", "system")).toEqual({ ok: true, status: "submitted" });
    expect(requestTransition("pending_verification", "verify", "client").ok).toBe(false);
    expect(requestTransition("submitted", "verify", "system").ok).toBe(false);
  });

  it("moves to matching on the admin's invitations, from submitted or matching", () => {
    expect(requestTransition("submitted", "invite", "admin")).toEqual({ ok: true, status: "matching" });
    expect(requestTransition("matching", "invite", "admin")).toEqual({ ok: true, status: "matching" });
    expect(requestTransition("closed", "invite", "admin").ok).toBe(false);
    expect(requestTransition("submitted", "invite", "client").ok).toBe(false);
  });

  it("lets the admin return only a submitted request", () => {
    expect(requestTransition("submitted", "reject", "admin")).toEqual({ ok: true, status: "rejected" });
    expect(requestTransition("matching", "reject", "admin").ok).toBe(false);
  });

  it("lets the client select only while matching, and close while submitted or matching", () => {
    expect(requestTransition("matching", "select", "client")).toEqual({ ok: true, status: "builder_selected" });
    expect(requestTransition("submitted", "select", "client").ok).toBe(false);
    expect(requestTransition("submitted", "close", "client")).toEqual({ ok: true, status: "closed" });
    expect(requestTransition("matching", "close", "client")).toEqual({ ok: true, status: "closed" });
    expect(requestTransition("builder_selected", "close", "client").ok).toBe(false);
    expect(requestTransition("pending_verification", "close", "client").ok).toBe(false);
  });

  it("expires only matching requests, by the system", () => {
    expect(requestTransition("matching", "expire", "system")).toEqual({ ok: true, status: "expired" });
    expect(requestTransition("submitted", "expire", "system").ok).toBe(false);
  });

  it("lets the admin remove from any status except removed", () => {
    for (const status of REQUEST_STATUSES) {
      expect(requestTransition(status, "remove", "admin").ok).toBe(status !== "removed");
    }
    expect(requestTransition("submitted", "remove", "client").ok).toBe(false);
  });

  it("names the terminal statuses", () => {
    expect(REQUEST_STATUSES.filter(isTerminalRequest)).toEqual(["builder_selected", "rejected", "expired", "closed", "removed"]);
  });
});

describe("invite state machine (spec §7.6)", () => {
  it("allows exactly the documented moves", () => {
    const moves: [string, string, string, string][] = [
      ["invited", "propose", "builder", "proposed"],
      ["invited", "decline", "builder", "declined"],
      ["proposed", "select", "client", "selected"],
      ["proposed", "not_select", "system", "not_selected"],
      ["invited", "expire", "system", "expired"],
    ];
    for (const status of INVITE_STATUSES) {
      for (const action of ["propose", "decline", "select", "not_select", "expire"] as const) {
        for (const actor of ["builder", "client", "system"] as const) {
          const hit = moves.find((m) => m[0] === status && m[1] === action && m[2] === actor);
          const result = inviteTransition(status, action, actor);
          expect(result, `${status} ${action} ${actor}`).toEqual(hit ? { ok: true, status: hit[3] } : { ok: false, error: "invalid_transition" });
        }
      }
    }
  });
});

const TODAY = "2026-10-04";
const form = (overrides: Partial<RequestFormValues> = {}): RequestFormValues => ({
  title: "Booking app for three salons",
  description: "We need online booking with reminders for three salons in Hanoi.",
  category: "booking",
  budgetBand: "2k-10k",
  deadline: "",
  languages: ["vi", "en"],
  name: "Minh Tran",
  email: "",
  website: "",
  ...overrides,
});

describe("parseRequestForm (spec §5.7 step 1)", () => {
  it("accepts a complete form and orders the languages", () => {
    const result = parseRequestForm(form(), { needEmail: false, today: TODAY });
    expect(result).toEqual({
      ok: true,
      input: { title: "Booking app for three salons", description: "We need online booking with reminders for three salons in Hanoi.", category: "booking", budgetBand: "2k-10k", deadline: null, languages: ["en", "vi"], name: "Minh Tran", email: null },
    });
  });

  it("reads repeated language fields and CRLF descriptions from a form body", () => {
    const values = requestValuesFromBody({ title: " T ", description: "a\r\nb", languages: ["zh", "zh", "vi"], name: "N" });
    expect(values.description).toBe("a\nb");
    expect(values.languages).toEqual(["zh", "zh", "vi"]);
    expect(requestValuesFromBody({ languages: "en" }).languages).toEqual(["en"]);
    expect(requestValuesFromBody({}).languages).toEqual([]);
  });

  it("reports each broken field", () => {
    const result = parseRequestForm(
      form({ title: "x".repeat(121), description: "too short", category: "games", budgetBand: "lots", deadline: "2026-10-03", languages: ["fr"], name: "", email: "nope" }),
      { needEmail: true, today: TODAY },
    );
    expect(result).toEqual({ ok: false, errors: { title: "too_long", description: "too_short", category: "choice", budgetBand: "choice", deadline: "date", languages: "choice", name: "required", email: "email" } });
  });

  it("rejects an empty title, a title with a line break, no language, and a description over 4000", () => {
    expect(parseRequestForm(form({ title: "  " }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { title: "required" } });
    expect(parseRequestForm(form({ title: "a\nb" }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { title: "invalid" } });
    expect(parseRequestForm(form({ languages: [] }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { languages: "choice" } });
    expect(parseRequestForm(form({ description: "y".repeat(4001) }), { needEmail: false, today: TODAY })).toMatchObject({ ok: false, errors: { description: "too_long" } });
  });

  it("requires and lower-cases the e-mail when signed out", () => {
    const result = parseRequestForm(form({ email: " New@Client.Example " }), { needEmail: true, today: TODAY });
    expect(result.ok && result.input.email).toBe("new@client.example");
  });
});

const proposal = (overrides: Partial<ProposalFormValues> = {}): ProposalFormValues => ({
  approach: "Next.js with a booking calendar and SMS reminders.",
  priceMode: "fixed",
  price: "4500",
  priceMax: "",
  priceNote: "",
  timelineDays: "30",
  ...overrides,
});

describe("parseProposal (spec §5.7 step 3)", () => {
  it("accepts a fixed price, a range and 'to discuss'", () => {
    expect(parseProposal(proposal())).toEqual({ ok: true, input: { approach: "Next.js with a booking calendar and SMS reminders.", priceCents: 450000, priceMaxCents: null, priceNote: "", timelineDays: 30 } });
    expect(parseProposal(proposal({ priceMode: "range", price: "3000", priceMax: "5000" }))).toMatchObject({ ok: true, input: { priceCents: 300000, priceMaxCents: 500000 } });
    expect(parseProposal(proposal({ priceMode: "discuss", price: "999" }))).toMatchObject({ ok: true, input: { priceCents: null, priceMaxCents: null } });
  });

  it("ignores the upper bound for a fixed price", () => {
    expect(parseProposal(proposal({ priceMax: "9" }))).toMatchObject({ ok: true, input: { priceMaxCents: null } });
  });

  it("rejects bad amounts, inverted ranges, bad days and long text", () => {
    expect(parseProposal(proposal({ price: "0" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ price: "12.50" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ price: "1000001" }))).toMatchObject({ ok: false, errors: { price: "amount" } });
    expect(parseProposal(proposal({ priceMode: "range", price: "5000", priceMax: "5000" }))).toMatchObject({ ok: false, errors: { priceMax: "range" } });
    expect(parseProposal(proposal({ priceMode: "auction" }))).toMatchObject({ ok: false, errors: { priceMode: "choice" } });
    expect(parseProposal(proposal({ timelineDays: "0" }))).toMatchObject({ ok: false, errors: { timelineDays: "days" } });
    expect(parseProposal(proposal({ timelineDays: "366" }))).toMatchObject({ ok: false, errors: { timelineDays: "days" } });
    expect(parseProposal(proposal({ approach: " " }))).toMatchObject({ ok: false, errors: { approach: "required" } });
    expect(parseProposal(proposal({ approach: "a".repeat(2001), priceNote: "b".repeat(201) }))).toMatchObject({ ok: false, errors: { approach: "too_long", priceNote: "too_long" } });
  });

  it("reads a form body", () => {
    expect(proposalValuesFromBody({ approach: "a\r\nb", priceMode: "range", price: " 10 ", priceMax: "20", timelineDays: "7" })).toEqual({ approach: "a\nb", priceMode: "range", price: "10", priceMax: "20", priceNote: "", timelineDays: "7" });
  });
});

describe("parseAdminNote", () => {
  it("needs 1–1000 characters", () => {
    expect(parseAdminNote(" Try a product listing first. ")).toEqual({ ok: true, note: "Try a product listing first." });
    expect(parseAdminNote("")).toEqual({ ok: false, error: "required" });
    expect(parseAdminNote("x".repeat(1001))).toEqual({ ok: false, error: "too_long" });
  });
});

const candidate = (overrides: Partial<Candidate> & { handle: string }): Candidate => ({
  userId: `u-${overrides.handle}`,
  name: overrides.handle,
  availability: "limited",
  skills: [],
  workLanguages: [],
  hasCategoryProduct: false,
  expiredInvites: 0,
  ...overrides,
});

describe("suggestBuilders (spec §8.10)", () => {
  const request = { title: "Booking app with Next.js", description: "Supabase backend, SMS reminders, three salons.", languages: ["vi" as const] };

  it("scores category, skills (max 3), language, availability and expired invites, with reasons", () => {
    const [top] = suggestBuilders(request, [
      candidate({ handle: "full", hasCategoryProduct: true, skills: ["Next.js", "supabase", "SMS", "Booking", "next.js"], workLanguages: ["vi"], availability: "open", expiredInvites: 2 }),
    ]);
    expect(top?.score).toBe(3 + 3 + 1 + 1 - 2);
    expect(top?.reasons).toEqual([
      { kind: "category" },
      { kind: "skill", skill: "Next.js" },
      { kind: "skill", skill: "supabase" },
      { kind: "skill", skill: "SMS" },
      { kind: "language" },
      { kind: "open" },
      { kind: "expired", count: 2 },
    ]);
  });

  it("ranks a builder with a product in the category above one without, ties by handle, at most 10", () => {
    const list = suggestBuilders(request, [
      candidate({ handle: "zeta" }),
      candidate({ handle: "alpha" }),
      candidate({ handle: "cat", hasCategoryProduct: true }),
      ...Array.from({ length: 12 }, (_, i) => candidate({ handle: `n${String(i).padStart(2, "0")}` })),
    ]);
    expect(list).toHaveLength(10);
    expect(list[0]?.candidate.handle).toBe("cat");
    expect(list[1]?.candidate.handle).toBe("alpha");
  });

  it("ignores empty skills and skills that do not appear", () => {
    const [top] = suggestBuilders(request, [candidate({ handle: "x", skills: ["", "  ", "Flutter"] })]);
    expect(top?.score).toBe(0);
    expect(top?.reasons).toEqual([]);
  });

  describe("skill matching by whole word (M6 review F2)", () => {
    const match = (skill: string, text: string) => {
      const [top] = suggestBuilders({ title: text, description: "", languages: [] }, [candidate({ handle: "x", skills: [skill] })]);
      return top?.reasons.some((r) => r.kind === "skill") ?? false;
    };
    it("does not match inside a longer Latin word", () => {
      expect(match("Go", "Google Analytics dashboard")).toBe(false);
      expect(match("Go", "arsugone")).toBe(false);
      expect(match("AI", "we maintain the site")).toBe(false);
    });
    it("matches a whole word, case-insensitively, next to punctuation", () => {
      expect(match("AI", "AI agents")).toBe(true);
      expect(match("React", "react, node")).toBe(true);
      expect(match("Go", "Backend in (Go)")).toBe(true);
      expect(match("C++", "a C++ engine")).toBe(true);
    });
    it("keeps substring matching for CJK skills", () => {
      expect(match("预约", "我们需要一个预约系统")).toBe(true);
      expect(match("予約", "予約アプリを作りたい")).toBe(true);
    });
  });
});
