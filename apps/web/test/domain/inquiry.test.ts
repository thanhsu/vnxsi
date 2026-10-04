import { describe, expect, it } from "vitest";
import {
  builderFacingName,
  canPostMessage,
  INQUIRY_STATUSES,
  inquiryValuesFromBody,
  isHoneypotFilled,
  parseDeclineReason,
  parseInquiryForm,
  parseMessageBody,
  PRODUCT_INQUIRY_TYPES,
  transition,
  type InquiryStatus,
} from "../../src/domain/inquiry.ts";

describe("inquiry state machine (spec §7.3)", () => {
  it("opens a pending inquiry only through the confirmation", () => {
    expect(transition("pending_verification", "verify", "system")).toEqual({ ok: true, status: "open" });
    expect(transition("pending_verification", "verify", "client").ok).toBe(false);
    expect(transition("open", "verify", "system").ok).toBe(false);
  });

  it("moves to answered on a builder reply and keeps the status on a client reply", () => {
    expect(transition("open", "reply", "builder")).toEqual({ ok: true, status: "answered" });
    expect(transition("answered", "reply", "builder")).toEqual({ ok: true, status: "answered" });
    expect(transition("open", "reply", "client")).toEqual({ ok: true, status: "open" });
    expect(transition("answered", "reply", "client")).toEqual({ ok: true, status: "answered" });
    expect(transition("open", "reply", "admin").ok).toBe(false);
  });

  it("lets only the builder decline, and only while open", () => {
    expect(transition("open", "decline", "builder")).toEqual({ ok: true, status: "declined" });
    expect(transition("answered", "decline", "builder").ok).toBe(false);
    expect(transition("open", "decline", "client").ok).toBe(false);
  });

  it("closes open or answered inquiries for either party", () => {
    for (const actor of ["client", "builder"] as const) {
      expect(transition("open", "close", actor)).toEqual({ ok: true, status: "closed" });
      expect(transition("answered", "close", actor)).toEqual({ ok: true, status: "closed" });
      expect(transition("declined", "close", actor).ok).toBe(false);
    }
    expect(transition("pending_verification", "close", "client").ok).toBe(false);
  });

  it("lets the admin remove from any status except removed", () => {
    for (const status of INQUIRY_STATUSES) {
      expect(transition(status, "remove", "admin").ok, status).toBe(status !== "removed");
    }
    expect(transition("open", "remove", "builder").ok).toBe(false);
  });

  it("allows messages only while open or answered", () => {
    const allowed = INQUIRY_STATUSES.filter((s: InquiryStatus) => canPostMessage(s));
    expect(allowed).toEqual(["open", "answered"]);
    for (const status of ["declined", "closed", "removed"] as const) {
      expect(transition(status, "reply", "builder").ok).toBe(false);
      expect(transition(status, "reply", "client").ok).toBe(false);
    }
  });
});

const TODAY = "2026-10-04";
const base = { type: "buy", message: "I need online booking for 3 salons.", budgetBand: "500-2k", deadline: "", name: " Minh Tran ", email: " Minh@Example.VN ", website: "" };
const opts = { allowedTypes: PRODUCT_INQUIRY_TYPES, needEmail: true, today: TODAY };

describe("parseInquiryForm (spec §5.6)", () => {
  it("accepts a valid signed-out form and normalizes name and e-mail", () => {
    expect(parseInquiryForm(base, opts)).toEqual({
      ok: true,
      input: { type: "buy", message: "I need online booking for 3 salons.", budgetBand: "500-2k", deadline: null, name: "Minh Tran", email: "minh@example.vn" },
    });
  });

  it("does not ask signed-in clients for an e-mail", () => {
    const parsed = parseInquiryForm({ ...base, email: "" }, { ...opts, needEmail: false });
    expect(parsed).toMatchObject({ ok: true, input: { email: null } });
  });

  it("rejects each invalid field with its own error", () => {
    const parsed = parseInquiryForm(
      { type: "request", message: "too short", budgetBand: "lots", deadline: "2026-10-03", name: "", email: "nope", website: "" },
      opts,
    );
    expect(parsed).toEqual({ ok: false, errors: { type: "choice", message: "too_short", budgetBand: "choice", deadline: "date", name: "required", email: "email" } });
  });

  it("checks lengths after CRLF normalization", () => {
    const exact = "a\r\n".repeat(1000); // 2000 characters once \r\n becomes \n
    const values = inquiryValuesFromBody({ ...base, message: exact });
    expect(parseInquiryForm(values, opts).ok).toBe(true);
    expect(parseInquiryForm({ ...values, message: values.message + "x" }, opts)).toMatchObject({ ok: false, errors: { message: "too_long" } });
    expect(parseInquiryForm({ ...base, name: "x".repeat(81) }, opts)).toMatchObject({ ok: false, errors: { name: "too_long" } });
    expect(parseInquiryForm({ ...base, name: "Minh\u0000" }, opts)).toMatchObject({ ok: false, errors: { name: "invalid" } });
  });

  it("accepts deadlines from today up to 5 years ahead, on real calendar days", () => {
    expect(parseInquiryForm({ ...base, deadline: TODAY }, opts)).toMatchObject({ ok: true, input: { deadline: TODAY } });
    expect(parseInquiryForm({ ...base, deadline: "2031-10-04" }, opts).ok).toBe(true);
    for (const bad of ["2031-10-05", "2026-02-30", "2026-13-01", "04/10/2026", "2026-10-4"]) {
      expect(parseInquiryForm({ ...base, deadline: bad }, opts), bad).toMatchObject({ ok: false, errors: { deadline: "date" } });
    }
  });

  it("only offers the types the target allows", () => {
    expect(parseInquiryForm({ ...base, type: "customize" }, { ...opts, allowedTypes: ["buy", "hire"] })).toMatchObject({ ok: false, errors: { type: "choice" } });
  });

  it("reads non-string body values as empty and spots the honeypot", () => {
    const values = inquiryValuesFromBody({ type: ["buy"], message: undefined, website: "http://spam" });
    expect(values.type).toBe("");
    expect(values.message).toBe("");
    expect(isHoneypotFilled(values)).toBe(true);
    expect(isHoneypotFilled(inquiryValuesFromBody({ website: "  " }))).toBe(false);
  });
});

describe("parseMessageBody / parseDeclineReason", () => {
  it("requires a reply of at most 4000 characters", () => {
    expect(parseMessageBody(" Thanks!\r\nSee you ")).toEqual({ ok: true, body: "Thanks!\nSee you" });
    expect(parseMessageBody("   ")).toEqual({ ok: false, error: "required" });
    expect(parseMessageBody("x".repeat(4001))).toEqual({ ok: false, error: "too_long" });
    expect(parseMessageBody(42)).toEqual({ ok: false, error: "required" });
  });

  it("makes the decline reason optional, at most 1000 characters", () => {
    expect(parseDeclineReason("")).toEqual({ ok: true, reason: "" });
    expect(parseDeclineReason(" Fully booked ")).toEqual({ ok: true, reason: "Fully booked" });
    expect(parseDeclineReason("x".repeat(1001))).toEqual({ ok: false, error: "too_long" });
  });
});

describe("builderFacingName (Owner 2026-10-04)", () => {
  it("keeps ordinary names unchanged", () => {
    for (const name of ["Minh Tran", "Công ty ABC", "李雷", "Tom @ Acme", "a@b", "v1.2 team"]) expect(builderFacingName(name)).toBe(name);
  });
  it("masks every e-mail-like part and nothing else", () => {
    expect(builderFacingName("minh@client.example")).toBe("•••");
    expect(builderFacingName("Lan (lan@x.vn)")).toBe("Lan (•••)");
    expect(builderFacingName("a@b.co / c@d.io")).toBe("••• / •••");
    expect(builderFacingName("Minh.Tran+x@sub.client.example, CEO")).toBe("•••, CEO");
  });
});
