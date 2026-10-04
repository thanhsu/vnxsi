import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  CONTACT_HOURLY_LIMIT_PER_IP,
  FEEDBACK_KINDS,
  FEEDBACK_ROLES,
  FEEDBACK_STATUSES,
  feedbackSource,
  feedbackTransition,
  feedbackValuesFromBody,
  isFeedbackHoneypotFilled,
  parseFeedbackForm,
  type FeedbackFormValues,
} from "../../src/domain/feedback.ts";

const MESSAGE = "How do I list a product that runs on my own server?";
const values = (overrides: Partial<FeedbackFormValues> = {}): FeedbackFormValues => ({
  role: "builder",
  kind: "question",
  name: "  Lan  ",
  email: "  Lan@Example.VN ",
  message: MESSAGE,
  consent: true,
  website: "",
  from: "contact",
  ...overrides,
});

describe("feedback constants (plan VNX-0710)", () => {
  it("has the roles, kinds, statuses, the contact address and the hourly limit", () => {
    expect(FEEDBACK_ROLES).toEqual(["builder", "client", "other"]);
    expect(FEEDBACK_KINDS).toEqual(["question", "suggestion", "partnership", "other"]);
    expect(FEEDBACK_STATUSES).toEqual(["new", "handled", "spam"]);
    expect(CONTACT_EMAIL).toBe("contact@vnx.si");
    expect(CONTACT_HOURLY_LIMIT_PER_IP).toBe(5);
  });
});

describe("feedbackValuesFromBody", () => {
  it("reads strings, normalises CRLF, turns the checkbox into a boolean and ignores other types", () => {
    const v = feedbackValuesFromBody({ role: "client", kind: "other", name: "A", email: "a@b.co", message: "line 1\r\nline 2", consent: "on", website: "", from: "landing" });
    expect(v).toEqual({ role: "client", kind: "other", name: "A", email: "a@b.co", message: "line 1\nline 2", consent: true, website: "", from: "landing" });
    const empty = feedbackValuesFromBody({ role: ["x"], message: 3 } as unknown as Record<string, unknown>);
    expect(empty).toEqual({ role: "", kind: "", name: "", email: "", message: "", consent: false, website: "", from: "" });
  });
});

describe("feedbackSource", () => {
  it("is landing only for 'landing'; anything else is contact", () => {
    expect(feedbackSource("landing")).toBe("landing");
    expect(feedbackSource("contact")).toBe("contact");
    expect(feedbackSource("/evil")).toBe("contact");
    expect(feedbackSource("")).toBe("contact");
  });
});

describe("isFeedbackHoneypotFilled", () => {
  it("is true when the hidden website field holds anything", () => {
    expect(isFeedbackHoneypotFilled(values())).toBe(false);
    expect(isFeedbackHoneypotFilled(values({ website: "  " }))).toBe(false);
    expect(isFeedbackHoneypotFilled(values({ website: "http://spam" }))).toBe(true);
  });
});

describe("parseFeedbackForm", () => {
  it("accepts a valid form: trims the name, lower-cases the e-mail, keeps the message", () => {
    const parsed = parseFeedbackForm(values({ message: `  ${MESSAGE}\n\nThanks  ` }));
    expect(parsed).toEqual({ ok: true, input: { role: "builder", kind: "question", name: "Lan", email: "lan@example.vn", message: `${MESSAGE}\n\nThanks` } });
  });

  it("stores an empty name as null", () => {
    const parsed = parseFeedbackForm(values({ name: "   " }));
    expect(parsed.ok && parsed.input.name).toBeNull();
  });

  it("accepts 20 and 2000 characters, refuses 19 and 2001", () => {
    expect(parseFeedbackForm(values({ message: "x".repeat(20) })).ok).toBe(true);
    expect(parseFeedbackForm(values({ message: "x".repeat(2000) })).ok).toBe(true);
    expect(parseFeedbackForm(values({ message: "x".repeat(19) }))).toEqual({ ok: false, errors: { message: "length" } });
    expect(parseFeedbackForm(values({ message: "x".repeat(2001) }))).toEqual({ ok: false, errors: { message: "length" } });
    expect(parseFeedbackForm(values({ message: "   " }))).toEqual({ ok: false, errors: { message: "length" } });
  });

  it("counts a CRLF line break as one character", () => {
    const text = feedbackValuesFromBody({ message: `${"x".repeat(1000)}\r\n${"y".repeat(999)}` }).message;
    expect(parseFeedbackForm(values({ message: text })).ok).toBe(true);
  });

  it("reports every bad field at once", () => {
    const parsed = parseFeedbackForm(values({ role: "admin", kind: "", email: "not-an-email", message: "short", consent: false, name: "n".repeat(101) }));
    expect(parsed).toEqual({ ok: false, errors: { role: "choice", kind: "choice", email: "email", message: "length", consent: "consent", name: "too_long" } });
  });

  it("uses the waitlist e-mail check and caps it at 254 characters", () => {
    expect(parseFeedbackForm(values({ email: "a@b.c" }))).toEqual({ ok: false, errors: { email: "email" } });
    expect(parseFeedbackForm(values({ email: "a b@c.de" }))).toEqual({ ok: false, errors: { email: "email" } });
    expect(parseFeedbackForm(values({ email: `${"a".repeat(247)}@test.vn` }))).toEqual({ ok: false, errors: { email: "email" } });
    expect(parseFeedbackForm(values({ email: `${"a".repeat(246)}@test.vn` })).ok).toBe(true);
  });

  it("refuses control characters in the name", () => {
    expect(parseFeedbackForm(values({ name: "Lan\u0007" }))).toEqual({ ok: false, errors: { name: "invalid" } });
  });
});

describe("feedbackTransition (plan VNX-0710)", () => {
  it("allows new → handled, new → spam, handled → new and spam → new", () => {
    expect(feedbackTransition("new", "handle")).toEqual({ ok: true, status: "handled" });
    expect(feedbackTransition("new", "spam")).toEqual({ ok: true, status: "spam" });
    expect(feedbackTransition("handled", "reopen")).toEqual({ ok: true, status: "new" });
    expect(feedbackTransition("spam", "reopen")).toEqual({ ok: true, status: "new" });
  });

  it("refuses every other move", () => {
    const fail = { ok: false, error: "invalid_transition" };
    expect(feedbackTransition("handled", "handle")).toEqual(fail);
    expect(feedbackTransition("handled", "spam")).toEqual(fail);
    expect(feedbackTransition("spam", "spam")).toEqual(fail);
    expect(feedbackTransition("spam", "handle")).toEqual(fail);
    expect(feedbackTransition("new", "reopen")).toEqual(fail);
  });
});
