import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createFeedback, markFeedbackNotified } from "../../src/db/feedback.ts";
import { optInStatement, publicationReviewQueue, returnedPublication } from "../../src/db/request-board.ts";
import { setUserStatusStatement } from "../../src/db/users.ts";
import type { GrantableRole, OpsRole } from "../../src/domain/ops.ts";
import { REMIND_AFTER_MS } from "../../src/domain/inquiry.ts";
import type { Bindings } from "../../src/env.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { ensureUser, makeBuilder, makeDraft, makeInquiry, makeRequest, signIn } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

/**
 * VNX-2503 /ops Overview (spec §2.2, §7.3, §7.4; plan O1 "Overview (O1)"). Five queues read straight from their tables,
 * a "counts read at" line, and for roles with overview.detail the 10 latest audit rows in the safe projection.
 * Test storage is per file and the tests run in order, so `resetQueues()` gives each counting test a known start.
 */

const tag = () => crypto.randomUUID().slice(0, 8);
const ROOT = "owner@vnx.si";
const env = { ...testEnv, ADMIN_EMAILS: ROOT } as Bindings;
const QUEUES = ["builders", "products", "feedback", "requests", "publicRequests", "interests", "inquiries"] as const;
type Queue = (typeof QUEUES)[number];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function member(email: string, role: GrantableRole) {
  const owner = await ensureUser(ROOT);
  const { user, cookie } = await signIn(email);
  const now = new Date().toISOString();
  await testEnv.DB.prepare("INSERT INTO ops_members (user_id, role, granted_by, granted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)").bind(user.id, role, owner.id, now).run();
  return { user, cookie };
}

async function asRole(role: OpsRole) {
  if (role === "owner") return signIn(ROOT);
  return member(`ops-ov-${role}-${tag()}@vnx.si`, role);
}

function req(path: string, opts: { cookie?: string; method?: "GET" | "POST"; ray?: string } = {}) {
  const headers: Record<string, string> = { "cf-ray": opts.ray ?? `ray-${tag()}` };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.method === "POST") {
    headers.origin = "https://vnx.si";
    headers["content-type"] = "application/x-www-form-urlencoded";
    return new Request(`https://vnx.si${path}`, { method: "POST", headers, body: "x=1" });
  }
  return new Request(`https://vnx.si${path}`, { headers });
}

async function getOverview(cookie: string, bindings: Bindings = env) {
  const res = await createApp().request(req("/ops", { cookie }), undefined, bindings);
  return { res, html: await res.text() };
}

const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";

/** The HTML of one queue card. */
function card(html: string, queue: Queue): string {
  const start = html.indexOf(`data-queue="${queue}"`);
  expect(start, queue).toBeGreaterThan(-1);
  const rest = html.slice(start);
  const end = rest.indexOf("</div>");
  return rest.slice(0, end);
}

const numberOf = (html: string, queue: Queue) => /<span class="ops-queue-num">(\d+)<\/span>/.exec(card(html, queue))?.[1];

/** Moves every row out of the five queues, so a test starts from zero. Test storage belongs to this file only. */
async function resetQueues() {
  const db = testEnv.DB;
  await db.batch([
    db.prepare("UPDATE builders SET status = 'approved' WHERE status = 'pending'"),
    db.prepare("UPDATE products SET status = 'draft' WHERE status = 'in_review'"),
    db.prepare("UPDATE feedback SET status = 'handled' WHERE status = 'new'"),
    db.prepare("UPDATE requests SET status = 'closed' WHERE status = 'submitted'"),
    db.prepare("UPDATE inquiries SET status = 'closed' WHERE status = 'open'"),
    db.prepare("DELETE FROM request_publications WHERE status = 'pending_review'"),
    db.prepare("DELETE FROM request_interests WHERE status = 'pending'"),
  ]);
}

/** A listing waiting for review on `requestId` (opted in at `optedInAt`, now by default). */
async function listingFor(requestId: string, optedInAt = new Date().toISOString()) {
  const owner = await testEnv.DB.prepare("SELECT client_user_id FROM requests WHERE id = ?1").bind(requestId).first<{ client_user_id: string }>();
  const [res] = await testEnv.DB.batch([optInStatement(testEnv.DB, { writeId: ulid(), requestId, consentVersion: "2026-01-01", now: optedInAt, clientUserId: owner!.client_user_id })]);
  return returnedPublication(res)!;
}

/** A pending interest of `builderId` on `requestId`, sent at `at`. */
async function interestOn(requestId: string, builderId: string, at = new Date().toISOString(), status = "pending") {
  const id = ulid();
  await testEnv.DB.prepare("INSERT INTO request_interests (id, request_id, builder_id, status, created_at, updated_at, write_id) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)").bind(id, requestId, builderId, status, at, ulid()).run();
  return id;
}

async function newFeedback(createdAt: string, notified: boolean) {
  const item = await createFeedback(testEnv.DB, {
    role: "client",
    kind: "question",
    name: null,
    email: `ops-ov-fb-${tag()}@example.vn`,
    message: "Do you list products that run on-premises?",
    locale: "en",
    userId: null,
    now: createdAt,
  });
  if (notified) await markFeedbackNotified(testEnv.DB, item.id, createdAt);
  return item;
}

/** A D1 binding whose queries matching `fail` throw, as a broken or missing table would. */
function failingDb(fail: RegExp): D1Database {
  const db = testEnv.DB;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") {
        return (sql: string) => {
          if (fail.test(sql)) throw new Error("D1_ERROR: simulated");
          return target.prepare(sql);
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("who can open /ops (AC3)", () => {
  it("answers 200 for the four roles", async () => {
    for (const role of ["owner", "operator", "content", "viewer"] as const) {
      const { cookie } = await asRole(role);
      const { res, html } = await getOverview(cookie);
      expect(res.status, role).toBe(200);
      expect(res.headers.get("content-type"), role).toContain("text/html");
      expect(res.headers.get("cache-control"), role).toBe("no-store");
      expect(res.headers.get("x-robots-tag"), role).toBe("noindex, nofollow");
      expect(mainOf(html), role).toContain("<h1>Overview</h1>");
    }
  });

  it("gives the anonymous, the role-less and the suspended the same sealed 404 as an unknown /ops path", async () => {
    const app = createApp();
    const sealed = async (path: string, opts: { cookie?: string; method?: "GET" | "POST" } = {}) => {
      const ray = `ray-${tag()}`;
      const res = await app.request(req(path, { ...opts, ray }), undefined, env);
      return { status: res.status, headers: [...res.headers.entries()].sort(), body: (await res.text()).replaceAll(ray, "") };
    };
    const reference = await sealed("/ops/khong-ton-tai");
    expect(reference.status).toBe(404);

    const plain = await signIn(`ops-ov-plain-${tag()}@vnx.si`);
    const suspended = await member(`ops-ov-susp-${tag()}@vnx.si`, "operator");
    await setUserStatusStatement(testEnv.DB, { id: suspended.user.id, from: "active", to: "suspended", now: new Date().toISOString() }).run();
    const owner = await asRole("owner");
    const cases = {
      anonymous: await sealed("/ops"),
      noRole: await sealed("/ops", { cookie: plain.cookie }),
      suspended: await sealed("/ops", { cookie: suspended.cookie }),
      // There is no POST on /ops: the Owner gets the same 404 as for any unknown path.
      ownerPost: await sealed("/ops", { cookie: owner.cookie, method: "POST" }),
    };
    for (const [name, got] of Object.entries(cases)) {
      expect(got.status, name).toBe(404);
      expect(got.body, name).toBe(reference.body);
      expect(got.headers, name).toEqual(reference.headers);
    }
  });
});

describe("queues (AC4)", () => {
  it("counts each queue from its table, with the age of the oldest item", async () => {
    await resetQueues();
    const t = tag();
    // Builders: 2 pending (oldest 2 days 3 hours), 1 approved and 1 rejected that do not count.
    const b1 = await makeBuilder(`ops-ov-b1-${t}@vnx.si`, `ov-b1-${t}`, "pending");
    await makeBuilder(`ops-ov-b2-${t}@vnx.si`, `ov-b2-${t}`, "pending");
    await makeBuilder(`ops-ov-b3-${t}@vnx.si`, `ov-b3-${t}`, "approved");
    await makeBuilder(`ops-ov-b4-${t}@vnx.si`, `ov-b4-${t}`, "rejected");
    await testEnv.DB.prepare("UPDATE builders SET created_at = ?2 WHERE user_id = ?1").bind(b1.userId, ago(2 * DAY + 3 * HOUR)).run();
    // Products: 3 in review (oldest submitted 9 hours ago), 1 draft that does not count.
    for (const [i, age] of [9 * HOUR + 10 * 60 * 1000, 2 * HOUR, 30 * 60 * 1000].entries()) {
      const { product } = await makeDraft(`ops-ov-p${i}-${t}@vnx.si`, `ov-p${i}-${t}`, `Ov product ${i} ${t}`);
      await testEnv.DB.prepare("UPDATE products SET status = 'in_review', updated_at = ?2 WHERE id = ?1").bind(product.id, ago(age)).run();
    }
    await makeDraft(`ops-ov-pd-${t}@vnx.si`, `ov-pd-${t}`, `Ov draft ${t}`);
    // Feedback: 2 new (one e-mail not sent), 1 handled that does not count.
    await newFeedback(ago(5 * HOUR), true);
    await newFeedback(ago(1 * HOUR), false);
    const handled = await newFeedback(ago(30 * DAY), false);
    await testEnv.DB.prepare("UPDATE feedback SET status = 'handled' WHERE id = ?1").bind(handled.id).run();
    // Requests: 1 submitted 4 hours ago, 1 pending verification that does not count.
    const { request } = await makeRequest({ tag: `ov-r1-${t}` });
    await testEnv.DB.prepare("UPDATE requests SET submitted_at = ?2 WHERE id = ?1").bind(request.id, ago(4 * HOUR + 5 * 60 * 1000)).run();
    await makeRequest({ tag: `ov-r2-${t}`, status: "pending_verification" });
    // Public requests to review: the submitted request above (opted in 6 hours ago, so waiting since it was submitted), plus one unconfirmed request that does not count.
    await listingFor(request.id, ago(6 * HOUR));
    const unconfirmed = await makeRequest({ tag: `ov-r3-${t}`, status: "pending_verification" });
    await listingFor(unconfirmed.request.id);
    // Interests waiting: one pending interest of an approved builder (b3) on a published listing, sent 3 hours ago.
    const interestRequest = await makeRequest({ tag: `ov-r4-${t}` });
    await listingFor(interestRequest.request.id);
    await testEnv.DB.prepare("UPDATE request_publications SET status = 'published', public_title = 'Public title', public_description = 'Public description for a booking app, long enough to pass the check', published_at = created_at WHERE request_id = ?1").bind(interestRequest.request.id).run();
    await interestOn(interestRequest.request.id, (await ensureUser(`ops-ov-b3-${t}@vnx.si`)).id, ago(3 * HOUR));
    // Inquiries: open past REMIND_AFTER_MS counts; open but recent, or answered although old, do not.
    const overdue = await makeInquiry({ tag: `ov-i1-${t}`, status: "open" });
    await testEnv.DB.prepare("UPDATE inquiries SET opened_at = ?2 WHERE id = ?1").bind(overdue.inquiry.id, ago(REMIND_AFTER_MS + 2 * HOUR)).run();
    const recent = await makeInquiry({ tag: `ov-i2-${t}`, status: "open" });
    await testEnv.DB.prepare("UPDATE inquiries SET opened_at = ?2 WHERE id = ?1").bind(recent.inquiry.id, ago(REMIND_AFTER_MS - 2 * HOUR)).run();
    const answered = await makeInquiry({ tag: `ov-i3-${t}`, status: "answered" });
    await testEnv.DB.prepare("UPDATE inquiries SET opened_at = ?2 WHERE id = ?1").bind(answered.inquiry.id, ago(REMIND_AFTER_MS + 5 * DAY)).run();

    const { cookie } = await asRole("operator");
    const main = mainOf((await getOverview(cookie)).html);
    expect(numberOf(main, "builders")).toBe("2");
    expect(card(main, "builders")).toContain("Builders to review");
    expect(card(main, "builders")).toContain("Oldest waiting 2 days");
    expect(numberOf(main, "products")).toBe("3");
    expect(card(main, "products")).toContain("Products in review");
    expect(card(main, "products")).toContain("Oldest waiting 9 hours");
    expect(numberOf(main, "feedback")).toBe("2");
    expect(card(main, "feedback")).toContain("New feedback");
    expect(card(main, "feedback")).toContain("Oldest waiting 5 hours");
    expect(card(main, "feedback")).toContain("1 e-mail not sent yet");
    expect(numberOf(main, "requests")).toBe("2"); // the submitted request above, and the one that carries the interest below
    expect(card(main, "requests")).toContain("Requests to match");
    expect(card(main, "requests")).toContain("Oldest waiting 4 hours");
    expect(numberOf(main, "publicRequests")).toBe("1");
    expect(card(main, "publicRequests")).toContain("Public requests to review");
    expect(card(main, "publicRequests")).toContain("Oldest waiting 4 hours");
    expect(numberOf(main, "interests")).toBe("1");
    expect(card(main, "interests")).toContain("Interests waiting");
    expect(card(main, "interests")).toContain("Oldest waiting 3 hours");
    expect(numberOf(main, "inquiries")).toBe("1");
    expect(card(main, "inquiries")).toContain("Overdue inquiries");
    expect(card(main, "inquiries")).toContain("Oldest waiting 3 days");
    for (const q of QUEUES) expect(card(main, q), q).not.toContain("Nothing waiting");
    expect(main).toMatch(/Counts read at <time datetime="\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z">\d\d:\d\d<\/time> UTC/);
  });

  it("says how many feedback e-mails are not sent, in the plural too, and nothing when all went out", async () => {
    await resetQueues();
    await newFeedback(ago(HOUR), false);
    await newFeedback(ago(HOUR), false);
    const { cookie } = await asRole("owner");
    expect(card((await getOverview(cookie)).html, "feedback")).toContain("2 e-mails not sent yet");
    await testEnv.DB.prepare("UPDATE feedback SET notified_at = ?1 WHERE status = 'new'").bind(new Date().toISOString()).run();
    expect(card((await getOverview(cookie)).html, "feedback")).not.toContain("not sent yet");
  });

  it("shows 'Nothing waiting' for an empty queue, never a bare 0 and no age", async () => {
    await resetQueues();
    const { cookie } = await asRole("viewer");
    const main = mainOf((await getOverview(cookie)).html);
    for (const q of QUEUES) {
      expect(card(main, q), q).toContain("Nothing waiting");
      expect(card(main, q), q).toContain('data-state="zero"');
      expect(card(main, q), q).not.toContain("Oldest waiting");
    }
  });

  it("shows an error state, not 0, for a queue whose query fails, and still counts the others", async () => {
    await resetQueues();
    await newFeedback(ago(HOUR), true);
    await makeBuilder(`ops-ov-err-${tag()}@vnx.si`, `ov-err-${tag()}`, "pending");
    const { cookie } = await asRole("owner");
    const broken = { ...env, DB: failingDb(/FROM feedback\b/) } as Bindings;
    const { res, html } = await getOverview(cookie, broken);
    expect(res.status).toBe(200);
    const feedback = card(mainOf(html), "feedback");
    expect(feedback).toContain('data-state="error"');
    expect(feedback).toContain("Could not read this count");
    expect(feedback).not.toMatch(/<span class="ops-queue-num">\d+<\/span>/);
    expect(feedback).not.toContain("Nothing waiting");
    expect(numberOf(mainOf(html), "builders")).toBe("1");
  });

  it("links the Builders (VNX-2504a), Products (VNX-2504a2) and Requests (VNX-2504b) queues to their lists and no queue whose list page does not exist yet (no dead links)", async () => {
    for (const role of ["owner", "operator", "viewer"] as const) {
      const { cookie } = await asRole(role);
      const main = mainOf((await getOverview(cookie)).html);
      expect([...main.matchAll(/href="([^"]*)"/g)].map((m) => m[1]), role).toEqual(["/ops/marketplace/builders", "/ops/marketplace/products", "/ops/marketplace/requests", "/ops/marketplace/requests?public=pending", "/ops/marketplace/requests?interests=pending"]);
      expect(card(main, "interests"), role).toMatch(/<a class="ops-queue-link" href="\/ops\/marketplace\/requests\?interests=pending">Open queue/);
      expect(card(main, "publicRequests"), role).toMatch(/<a class="ops-queue-link" href="\/ops\/marketplace\/requests\?public=pending">Open queue/);
      expect(card(main, "builders"), role).toMatch(/<a class="ops-queue-link" href="\/ops\/marketplace\/builders">Open queue/);
      expect(card(main, "products"), role).toMatch(/<a class="ops-queue-link" href="\/ops\/marketplace\/products">Open queue/);
      expect(card(main, "requests"), role).toMatch(/<a class="ops-queue-link" href="\/ops\/marketplace\/requests">Open queue/);
    }
  });
});

describe("Content sees counts and labels only (AC5, spec §3.1)", () => {
  it("has no age, no unsent-mail line, no link and no recent activity", async () => {
    await resetQueues();
    await makeBuilder(`ops-ov-cb-${tag()}@vnx.si`, `ov-cb-${tag()}`, "pending");
    await newFeedback(ago(2 * HOUR), false);
    const owner = await ensureUser(ROOT);
    await testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, 'builder.approve', 'builder', ?3, '{}', ?4)")
      .bind(`01CONTENT${tag()}`, owner.id, `ENTITY-${tag()}`, new Date().toISOString())
      .run();
    const { cookie } = await asRole("content");
    const main = mainOf((await getOverview(cookie)).html);
    expect(numberOf(main, "builders")).toBe("1");
    expect(card(main, "builders")).toContain("Builders to review");
    expect(numberOf(main, "feedback")).toBe("1");
    expect(main).not.toContain("Oldest waiting");
    expect(main).not.toContain("not sent yet");
    expect(main).not.toMatch(/href=/);
    expect(main).not.toContain("Recent activity");
    expect(main).not.toContain("<table");
    expect(main).not.toContain("ENTITY-");
    expect(main).not.toContain(ROOT);
    // Empty queues still say so.
    expect(card(main, "requests")).toContain("Nothing waiting");
  });
});

describe("recent activity (AC6, spec §4)", () => {
  it("lists the 10 newest audit rows in the safe projection; e-mail only for the root Owner and Ops members", async () => {
    const t = tag();
    const owner = await ensureUser(ROOT);
    const operator = await member(`ops-ov-actor-op-${t}@vnx.si`, "operator");
    const outsider = await signIn(`ops-ov-actor-plain-${t}@vnx.si`);
    const base = Date.now() + HOUR;
    const at = (i: number) => new Date(base + i * 1000).toISOString();
    const insert = (id: string, actor: string | null, action: string, entityId: string | null, createdAt: string) =>
      testEnv.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, data, created_at) VALUES (?1, ?2, ?3, 'builder', ?4, ?5, ?6)")
        .bind(id, actor, action, entityId, JSON.stringify({ secret: `SECRET-DATA-${t}`, email: "private@example.vn" }), createdAt)
        .run();
    // Two old rows that fall outside the newest 10.
    await insert(`01OLD000000000000000000${t.slice(0, 3)}`, owner.id, "too.old", "ENT-OLD-1", at(0));
    await insert(`01OLD100000000000000000${t.slice(0, 3)}`, owner.id, "too.old", "ENT-OLD-2", at(1));
    await insert(`01A${t}OWNER000000000`, owner.id, "builder.approve", `ENT-OWNER-${t}`, at(10));
    await insert(`01A${t}MEMBER00000000`, operator.user.id, "product.approve", `ENT-MEMBER-${t}`, at(11));
    await insert(`01A${t}OUTSIDE0000000`, outsider.user.id, "inquiry.create", `ENT-OUTSIDE-${t}`, at(12));
    await insert(`01A${t}SYSTEM00000000`, null, "request_invite.expire", null, at(13));
    for (let i = 0; i < 6; i++) await insert(`01A${t}FILL${i}000000000`, owner.id, "feedback.handle", `ENT-FILL-${i}-${t}`, at(20 + i));

    const { cookie } = await asRole("viewer");
    const main = mainOf((await getOverview(cookie)).html);
    expect(main).toContain("Recent activity");
    const table = /<table[\s\S]*<\/table>/.exec(main)?.[0] ?? "";
    expect(table).toMatch(/<th scope="col">Time \(UTC\)<\/th><th scope="col">Actor<\/th><th scope="col">Action<\/th><th scope="col">Entity<\/th><th scope="col">ID<\/th>/);
    const rows = [...table.matchAll(/<tr data-audit="([^"]+)">([\s\S]*?)<\/tr>/g)];
    expect(rows).toHaveLength(10);
    // Newest first.
    expect(rows[0]?.[1]).toBe(`01A${t}FILL5000000000`);
    expect(main).not.toContain("ENT-OLD-");
    expect(main).not.toContain("too.old");

    const row = (id: string) => rows.find((r) => r[1] === id)?.[2] ?? "";
    expect(row(`01A${t}OWNER000000000`)).toContain(ROOT);
    expect(row(`01A${t}MEMBER00000000`)).toContain(operator.user.email);
    // Someone outside Ops is shown by user ID, never by e-mail.
    expect(main).not.toContain(outsider.user.email);
    expect(row(`01A${t}OUTSIDE0000000`)).toContain(outsider.user.id);
    expect(row(`01A${t}SYSTEM00000000`)).toContain("system");
    expect(row(`01A${t}OWNER000000000`)).toContain("builder.approve");
    expect(row(`01A${t}OWNER000000000`)).toContain(`ENT-OWNER-${t}`);
    expect(row(`01A${t}OWNER000000000`)).toMatch(/<time datetime="[^"]+">/);
    // audit_log.data is never rendered.
    expect(main).not.toContain("SECRET-DATA");
    expect(main).not.toContain("private@example.vn");
    // No link to a detail page in this task.
    expect(table).not.toMatch(/href=/);
  });

  it("shows an error state when the audit query fails, and an empty state when there is nothing", async () => {
    const { cookie } = await asRole("owner");
    const broken = { ...env, DB: failingDb(/FROM audit_log\b/) } as Bindings;
    const main = mainOf((await getOverview(cookie, broken)).html);
    expect(main).toContain("Could not read recent activity");
    expect(main).not.toContain("<table");
    // The queues still render.
    for (const q of QUEUES) expect(main, q).toContain(`data-queue="${q}"`);

    await testEnv.DB.prepare("DELETE FROM audit_log").run();
    const empty = mainOf((await getOverview(cookie)).html);
    expect(empty).toContain("No activity recorded yet.");
    expect(empty).not.toContain("<table");
  });
});

describe("VNX-2704b: the Public requests to review card (spec 7.4, R1-S1)", () => {
  it("counts by difference: a listing waiting on a confirmed open request adds exactly one; an unconfirmed or a closed request adds none until it is confirmed", async () => {
    const { cookie } = await asRole("owner");
    const base = Number(numberOf(mainOf((await getOverview(cookie)).html), "publicRequests") ?? "0");
    const open = await makeRequest({ tag: `ov-pr-open-${tag()}` });
    await listingFor(open.request.id);
    expect(numberOf(mainOf((await getOverview(cookie)).html), "publicRequests")).toBe(String(base + 1));
    const unconfirmed = await makeRequest({ tag: `ov-pr-unc-${tag()}`, status: "pending_verification" });
    await listingFor(unconfirmed.request.id);
    const closed = await makeRequest({ tag: `ov-pr-closed-${tag()}` });
    await testEnv.DB.prepare("UPDATE requests SET status = 'builder_selected' WHERE id = ?1").bind(closed.request.id).run();
    await listingFor(closed.request.id);
    expect(numberOf(mainOf((await getOverview(cookie)).html), "publicRequests")).toBe(String(base + 1));
    // The client confirms their e-mail: the listing enters the queue (by id, through the real count).
    await testEnv.DB.prepare("UPDATE requests SET status = 'submitted' WHERE id = ?1").bind(unconfirmed.request.id).run();
    expect(numberOf(mainOf((await getOverview(cookie)).html), "publicRequests")).toBe(String(base + 2));
    expect((await publicationReviewQueue(testEnv.DB)).count).toBe(base + 2);
  });

  it("shows an error state, not 0, when the count cannot be read, and the other queues still show", async () => {
    await resetQueues();
    await makeBuilder(`ops-ov-pr-${tag()}@vnx.si`, `ov-pr-${tag()}`, "pending");
    const { cookie } = await asRole("owner");
    const broken = { ...env, DB: failingDb(/FROM request_publications\b/) } as Bindings;
    const main = mainOf((await getOverview(cookie, broken)).html);
    const cardHtml = card(main, "publicRequests");
    expect(cardHtml).toContain('data-state="error"');
    expect(cardHtml).toContain("Could not read this count");
    expect(cardHtml).not.toMatch(/<span class="ops-queue-num">\d+<\/span>/);
    expect(cardHtml).not.toContain("Nothing waiting");
    expect(numberOf(main, "builders")).toBe("1");
  });

  it("shows Content the number and the label only, and gives the link to Viewer, Operator and Owner", async () => {
    await resetQueues();
    const open = await makeRequest({ tag: `ov-pr-role-${tag()}` });
    await listingFor(open.request.id);
    const content = await asRole("content");
    const contentCard = card(mainOf((await getOverview(content.cookie)).html), "publicRequests");
    expect(contentCard).toContain("Public requests to review");
    expect(contentCard).toContain('<span class="ops-queue-num">1</span>');
    expect(contentCard).not.toContain("href");
    expect(contentCard).not.toContain("Oldest waiting");
    for (const role of ["viewer", "operator", "owner"] as const) {
      const { cookie } = await asRole(role);
      expect(card(mainOf((await getOverview(cookie)).html), "publicRequests"), role).toContain('href="/ops/marketplace/requests?public=pending"');
    }
  });
});

describe("VNX-2706b: the Interests waiting card (addendum 5, plan 2704b card pattern)", () => {
  /** A published listing on an open request; `interestOn` adds an interest by an approved builder. */
  async function published(status = "submitted") {
    const made = await makeRequest({ tag: `ov-iw-${tag()}` });
    await listingFor(made.request.id);
    await testEnv.DB.prepare("UPDATE request_publications SET status = 'published', public_title = 'Public title', public_description = 'Public description for a booking app, long enough to pass the check', published_at = created_at WHERE request_id = ?1").bind(made.request.id).run();
    if (status !== "submitted") await testEnv.DB.prepare("UPDATE requests SET status = ?2 WHERE id = ?1").bind(made.request.id, status).run();
    return made.request.id;
  }
  const approved = () => makeBuilder(`ov-iw-b-${tag()}@vnx.si`, `oviw${tag()}`, "approved");
  const countNow = async (cookie: string) => Number(numberOf(mainOf((await getOverview(cookie)).html), "interests") ?? "NaN");

  it("counts by difference: adding an interest adds one; Dismiss and an invitation each take one away; a closed request or a locked builder adds none", async () => {
    const { cookie } = await asRole("owner");
    const base = await countNow(cookie);
    const request = await published();
    const a = await approved();
    const b = await approved();
    const ia = await interestOn(request, a.userId);
    const ib = await interestOn(request, b.userId);
    expect(await countNow(cookie)).toBe(base + 2);
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'dismissed' WHERE id = ?1").bind(ia).run();
    expect(await countNow(cookie)).toBe(base + 1);
    await testEnv.DB.prepare("UPDATE request_interests SET status = 'invited' WHERE id = ?1").bind(ib).run();
    expect(await countNow(cookie)).toBe(base);
    // Not counted: a closed request, a hidden listing, a suspended builder, a withdrawn interest.
    const closed = await published("builder_selected");
    await interestOn(closed, (await approved()).userId);
    const hidden = await published();
    await testEnv.DB.prepare("UPDATE request_publications SET status = 'unpublished' WHERE request_id = ?1").bind(hidden).run();
    await interestOn(hidden, (await approved()).userId);
    const locked = await approved();
    await interestOn(request, locked.userId);
    expect(await countNow(cookie)).toBe(base + 1);
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(locked.userId).run();
    expect(await countNow(cookie)).toBe(base);
    await interestOn(request, (await approved()).userId, undefined, "withdrawn");
    expect(await countNow(cookie)).toBe(base);
  });

  it("shows an error state, not 0, when the count cannot be read, and the other queues still show", async () => {
    await resetQueues();
    await makeBuilder(`ops-ov-iw-${tag()}@vnx.si`, `ov-iw-${tag()}`, "pending");
    const { cookie } = await asRole("owner");
    const broken = { ...env, DB: failingDb(/FROM request_interests\b/) } as Bindings;
    const main = mainOf((await getOverview(cookie, broken)).html);
    const cardHtml = card(main, "interests");
    expect(cardHtml).toContain('data-state="error"');
    expect(cardHtml).toContain("Could not read this count");
    expect(cardHtml).not.toMatch(/<span class="ops-queue-num">\d+<\/span>/);
    expect(cardHtml).not.toContain("Nothing waiting");
    expect(numberOf(main, "builders")).toBe("1");
    expect(card(main, "publicRequests")).not.toContain('data-state="error"');
  });

  it("shows Content the number and the label only, and gives the link to Viewer, Operator and Owner", async () => {
    await resetQueues();
    await interestOn(await published(), (await approved()).userId);
    const content = await asRole("content");
    const contentCard = card(mainOf((await getOverview(content.cookie)).html), "interests");
    expect(contentCard).toContain("Interests waiting");
    expect(contentCard).toContain('<span class="ops-queue-num">1</span>');
    expect(contentCard).not.toContain("href");
    expect(contentCard).not.toContain("Oldest waiting");
    for (const role of ["viewer", "operator", "owner"] as const) {
      const { cookie } = await asRole(role);
      expect(card(mainOf((await getOverview(cookie)).html), "interests"), role).toContain('href="/ops/marketplace/requests?interests=pending"');
    }
  });

  it("an empty queue says so", async () => {
    await resetQueues();
    const { cookie } = await asRole("owner");
    const html = card(mainOf((await getOverview(cookie)).html), "interests");
    expect(html).toContain('data-state="zero"');
    expect(html).toContain("Nothing waiting");
  });
});
