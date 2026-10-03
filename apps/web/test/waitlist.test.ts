import { test } from "node:test";
import assert from "node:assert/strict";
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

test("normalizes email and filters personas", () => {
  const r = parseWaitlist(valid);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.entry.email, "lan.nguyen@example.vn");
  assert.deepEqual(r.entry.personas, ["developer", "tech-lead"]);
  assert.equal(r.entry.spendBand, "20-100");
  assert.equal(r.entry.utmSource, "facebook");
  assert.equal(r.entry.lang, "vi");
});

test("unknown or missing lang falls back to en", () => {
  for (const lang of ["fr", undefined, 42]) {
    const r = parseWaitlist({ ...valid, lang });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.entry.lang, "en");
  }
});

test("rejects bad email and missing consent", () => {
  assert.equal(parseWaitlist({ ...valid, email: "not-an-email" }).ok, false);
  assert.deepEqual(
    (parseWaitlist({ ...valid, consent: false }) as { field?: string }).field,
    "consent",
  );
});

test("personas are optional (coming-soon form sends none)", () => {
  for (const personas of [undefined, [], ["hacker", "user"]]) {
    const r = parseWaitlist({ ...valid, personas });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.entry.personas, []);
  }
});

test("error messages follow lang", () => {
  const vi = parseWaitlist({ ...valid, email: "x" });
  const en = parseWaitlist({ ...valid, email: "x", lang: "en" });
  assert.ok(!vi.ok && !en.ok);
  if (vi.ok || en.ok) return;
  assert.equal(vi.error, "Email chưa đúng định dạng.");
  assert.equal(en.error, "That email address doesn't look right.");
});

test("ignores unknown or legacy spend band and truncates message", () => {
  const r = parseWaitlist({ ...valid, spendBand: "1-10m", message: "x".repeat(5000) });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.entry.spendBand, null);
  assert.equal(r.entry.message?.length, 1000);
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

test("stores a valid signup with lang", async () => {
  const { env, calls } = fakeEnv();
  const res = await handleWaitlist(post(valid), env);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "lan.nguyen@example.vn");
  assert.equal(calls[0][1], JSON.stringify(["developer", "tech-lead"]));
  assert.equal(calls[0][10], "vi");
});

test("validation error is returned in the requested lang", async () => {
  const { env } = fakeEnv();
  const res = await handleWaitlist(post({ ...valid, consent: false, lang: "en" }), env);
  assert.equal(res.status, 400);
  const data = (await res.json()) as { error: string; field: string };
  assert.equal(data.field, "consent");
  assert.equal(data.error, "Please agree so we can store your email.");
});

test("honeypot returns ok without storing", async () => {
  const { env, calls } = fakeEnv();
  const res = await handleWaitlist(post({ ...valid, website: "spam.example" }), env);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test("invalid JSON and wrong method", async () => {
  const { env } = fakeEnv();
  assert.equal((await handleWaitlist(post("{oops"), env)).status, 400);
  assert.equal((await handleWaitlist(new Request("https://vnx.si/api/waitlist"), env)).status, 405);
});
