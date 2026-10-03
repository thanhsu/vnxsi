import { describe, expect, it } from "vitest";
import { parseWaitlist } from "../src/waitlist.ts";
import { handleWaitlist, type Env } from "../src/worker.ts";

const valid = {
  email: "  Lan.Nguyen@Example.vn ",
  personas: ["developer", "tech-lead", "developer", "hacker"],
  consent: true,
  message: "Review merge requests and run the test suite before I look",
  spendBand: "20-100",
  utmSource: "facebook",
  lang: "vi",
};

describe("parseWaitlist", () => {
  it("normalizes email and filters personas", () => {
    const r = parseWaitlist(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.email).toBe("lan.nguyen@example.vn");
    expect(r.entry.personas).toEqual(["developer", "tech-lead"]);
    expect(r.entry.spendBand).toBe("20-100");
    expect(r.entry.utmSource).toBe("facebook");
    expect(r.entry.lang).toBe("vi");
  });

  it("unknown or missing lang falls back to en", () => {
    for (const lang of ["fr", undefined, 42]) {
      const r = parseWaitlist({ ...valid, lang });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entry.lang).toBe("en");
    }
  });

  it("rejects bad email and missing consent", () => {
    expect(parseWaitlist({ ...valid, email: "not-an-email" }).ok).toBe(false);
    expect((parseWaitlist({ ...valid, consent: false }) as { field?: string }).field).toBe("consent");
  });

  it("personas are optional (coming-soon form sends none)", () => {
    for (const personas of [undefined, [], ["hacker", "user"]]) {
      const r = parseWaitlist({ ...valid, personas });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.entry.personas).toEqual([]);
    }
  });

  it("error messages follow lang", () => {
    const vi = parseWaitlist({ ...valid, email: "x" });
    const en = parseWaitlist({ ...valid, email: "x", lang: "en" });
    expect(vi.ok || en.ok).toBe(false);
    if (vi.ok || en.ok) return;
    expect(vi.error).toBe("Email chưa đúng định dạng.");
    expect(en.error).toBe("That email address doesn't look right.");
  });

  it("ignores unknown or legacy spend band and truncates message", () => {
    const r = parseWaitlist({ ...valid, spendBand: "1-10m", message: "x".repeat(5000) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry.spendBand).toBeNull();
    expect(r.entry.message?.length).toBe(1000);
  });
});

function fakeEnv() {
  const calls: unknown[][] = [];
  const db = {
    prepare: () => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          calls.push(args);
          return { success: true };
        },
      }),
    }),
  };
  return { env: { DB: db } as unknown as Env, calls };
}

function post(body: unknown) {
  return new Request("https://vnx.si/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handleWaitlist", () => {
  it("stores a valid signup with lang", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleWaitlist(post(valid), env);
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
    expect(calls[0]?.[0]).toBe("lan.nguyen@example.vn");
    expect(calls[0]?.[1]).toBe(JSON.stringify(["developer", "tech-lead"]));
    expect(calls[0]?.[10]).toBe("vi");
  });

  it("validation error is returned in the requested lang", async () => {
    const { env } = fakeEnv();
    const res = await handleWaitlist(post({ ...valid, consent: false, lang: "en" }), env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string; field: string };
    expect(data.field).toBe("consent");
    expect(data.error).toBe("Please agree so we can store your email.");
  });

  it("honeypot returns ok without storing", async () => {
    const { env, calls } = fakeEnv();
    const res = await handleWaitlist(post({ ...valid, website: "spam.example" }), env);
    expect(res.status).toBe(200);
    expect(calls.length).toBe(0);
  });

  it("invalid JSON and wrong method", async () => {
    const { env } = fakeEnv();
    expect((await handleWaitlist(post("{oops"), env)).status).toBe(400);
    expect((await handleWaitlist(new Request("https://vnx.si/api/waitlist"), env)).status).toBe(405);
  });
});
