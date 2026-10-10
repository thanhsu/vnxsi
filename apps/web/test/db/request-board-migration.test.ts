import { describe, expect, it } from "vitest";
import { deleteExpiredPendingRequests, deletePendingRequestStatement } from "../../src/db/requests.ts";
import { parsePublicListing } from "../../src/domain/request-board.ts";
import { ulid } from "../../src/lib/ulid.ts";
import { makeBuilder, makeRequest } from "../fixtures.ts";
import { testEnv } from "../helpers.ts";

const files = import.meta.glob("../../migrations/0018_request_board.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const code = (Object.values(files)[0] ?? "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const NOW = "2026-10-05T00:00:00.000Z";
const db = () => testEnv.DB;

async function columns(table: string): Promise<string[]> {
  const { results } = await db().prepare("SELECT name FROM pragma_table_info(?1)").bind(table).all<{ name: string }>();
  return results.map((r) => r.name);
}

type Cols = Record<string, string | number | null>;
async function insertPublication(requestId: string, cols: Cols = {}): Promise<void> {
  const all: Cols = { request_id: requestId, public_id: ulid(), status: "pending_review", opted_in_at: NOW, consent_version: "2026-12-01", created_at: NOW, updated_at: NOW, ...cols };
  const keys = Object.keys(all);
  await db()
    .prepare(`INSERT INTO request_publications (${keys.join(", ")}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...keys.map((k) => all[k] ?? null))
    .run();
}
async function insertInterest(requestId: string, builderId: string, cols: Cols = {}): Promise<void> {
  const all: Cols = { id: ulid(), request_id: requestId, builder_id: builderId, status: "pending", created_at: NOW, updated_at: NOW, ...cols };
  const keys = Object.keys(all);
  await db()
    .prepare(`INSERT INTO request_interests (${keys.join(", ")}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...keys.map((k) => all[k] ?? null))
    .run();
}
const count = async (sql: string, ...binds: string[]) => (await db().prepare(sql).bind(...binds).first<{ n: number }>())!.n;

describe("0018_request_board (addendum §6)", () => {
  it("is additive: no DROP, no data statement, no money or priority column", () => {
    expect(code).not.toMatch(/\bDROP\b|\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/price|cents|score|boost|priority|featured|sponsor|rank/i);
  });

  it("creates the columns and indexes of the addendum", async () => {
    expect(await columns("requests")).toContain("country");
    expect(await columns("request_publications")).toEqual([
      "request_id", "public_id", "status", "public_title", "public_description", "opted_in_at", "consent_version", "reviewed_by", "reviewed_at", "review_note", "published_at", "ended_at", "created_at", "updated_at",
    ]);
    expect(await columns("request_interests")).toEqual(["id", "request_id", "builder_id", "note", "product_id", "status", "decided_by", "decided_at", "created_at", "updated_at"]);
    const { results } = await db().prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_request_%'").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(expect.arrayContaining(["idx_request_publications_status", "idx_request_interests_request", "idx_request_interests_builder"]));
  });

  it("makes no publication for requests that already exist (no retroactive publishing)", async () => {
    const { request } = await makeRequest({ tag: "rbm-old" });
    expect(await count("SELECT COUNT(*) AS n FROM request_publications WHERE request_id = ?1", request.id)).toBe(0);
    expect(request.country).toBeNull();
  });

  it("checks request_publications", async () => {
    const { request } = await makeRequest({ tag: "rbm-pub" });
    await expect(insertPublication(request.id, { status: "published", published_at: NOW })).rejects.toThrow(); // published without public text
    await expect(insertPublication(request.id, { status: "published", public_title: "T", public_description: "d".repeat(40) })).rejects.toThrow(); // no published_at
    await expect(insertPublication(request.id, { public_title: "t".repeat(121) })).rejects.toThrow();
    await expect(insertPublication(request.id, { public_description: "d".repeat(39) })).rejects.toThrow();
    await expect(insertPublication(request.id, { public_description: "d".repeat(4001) })).rejects.toThrow();
    await expect(insertPublication(request.id, { review_note: "n".repeat(1001) })).rejects.toThrow();
    await expect(insertPublication(request.id, { status: "open" })).rejects.toThrow();
    await insertPublication(request.id, { status: "published", public_title: "t".repeat(120), public_description: "d".repeat(4000), published_at: NOW, review_note: "n".repeat(1000) });
  });

  it("keeps public_id unique and one publication per request", async () => {
    const a = await makeRequest({ tag: "rbm-uq-a" });
    const b = await makeRequest({ tag: "rbm-uq-b" });
    const publicId = ulid();
    await insertPublication(a.request.id, { public_id: publicId });
    await expect(insertPublication(b.request.id, { public_id: publicId })).rejects.toThrow();
    await expect(insertPublication(a.request.id)).rejects.toThrow();
  });

  it("checks request_interests and keeps one interest per builder and request", async () => {
    const { request } = await makeRequest({ tag: "rbm-int" });
    const builder = await makeBuilder("rbm-int-b@vnx.si", "rbm-int-b", "approved");
    await expect(insertInterest(request.id, builder.userId, { note: "n".repeat(501) })).rejects.toThrow();
    await expect(insertInterest(request.id, builder.userId, { status: "open" })).rejects.toThrow();
    await insertInterest(request.id, builder.userId, { note: "n".repeat(500) });
    await expect(insertInterest(request.id, builder.userId)).rejects.toThrow();
  });

  it("checks requests.country: two letters or null", async () => {
    const { request } = await makeRequest({ tag: "rbm-cty" });
    const set = (v: string | null) => db().prepare("UPDATE requests SET country = ?2 WHERE id = ?1").bind(request.id, v).run();
    await expect(set("USA")).rejects.toThrow();
    await expect(set("V")).rejects.toThrow();
    await set("VN");
    await set(null);
  });

  it("cascades: deleting a pending request removes its publication and interests, and only those", async () => {
    const mine = await makeRequest({ tag: "rbm-casc", status: "pending_verification" });
    const other = await makeRequest({ tag: "rbm-casc-o", status: "pending_verification" });
    const builder = await makeBuilder("rbm-casc-b@vnx.si", "rbm-casc-b", "approved");
    for (const r of [mine.request, other.request]) {
      await insertPublication(r.id);
      await insertInterest(r.id, builder.userId);
    }
    await deletePendingRequestStatement(db(), mine.request.id).run();
    expect(await count("SELECT COUNT(*) AS n FROM request_publications WHERE request_id = ?1", mine.request.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM request_interests WHERE request_id = ?1", mine.request.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM request_publications WHERE request_id = ?1", other.request.id)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM request_interests WHERE request_id = ?1", other.request.id)).toBe(1);
  });

  it("cascades through the 48-hour cron sweep too", async () => {
    const old = await makeRequest({ tag: "rbm-sweep", status: "pending_verification", now: "2020-01-01T00:00:00.000Z" });
    const fresh = await makeRequest({ tag: "rbm-sweep-f", status: "pending_verification" });
    const builder = await makeBuilder("rbm-sweep-b@vnx.si", "rbm-sweep-b", "approved");
    for (const r of [old.request, fresh.request]) {
      await insertPublication(r.id);
      await insertInterest(r.id, builder.userId);
    }
    await deleteExpiredPendingRequests(db(), "2021-01-01T00:00:00.000Z");
    expect(await count("SELECT COUNT(*) AS n FROM request_publications WHERE request_id = ?1", old.request.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM request_interests WHERE request_id = ?1", old.request.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM request_publications WHERE request_id = ?1", fresh.request.id)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM request_interests WHERE request_id = ?1", fresh.request.id)).toBe(1);
  });

  it("S-1: the CHECK length() counts code points, and the domain parser counts the same way", async () => {
    const e = "😀"; // 2 UTF-16 code units, 1 code point
    const lengthOf = async (v: string) => (await db().prepare("SELECT length(?1) AS n").bind(v).first<{ n: number }>())!.n;
    expect(await lengthOf(e.repeat(20))).toBe(20);
    const { request } = await makeRequest({ tag: "rbm-cp" });
    // 120 emoji = 240 code units: the title CHECK (1..120) accepts it; 20 emoji = 40 code units but 20 code points: the description CHECK (40..4000) refuses it.
    await expect(insertPublication(request.id, { public_title: e.repeat(121) })).rejects.toThrow();
    await expect(insertPublication(request.id, { public_description: e.repeat(20) })).rejects.toThrow();
    await insertPublication(request.id, { public_title: e.repeat(120), public_description: e.repeat(40) });
    // The parser agrees on each of those four cases.
    const parse = (title: string, description: string) => parsePublicListing({ title, description });
    expect(parse(e.repeat(121), "d".repeat(40)).ok).toBe(false);
    expect(parse("t", e.repeat(20)).ok).toBe(false);
    expect(parse(e.repeat(120), e.repeat(40)).ok).toBe(true);
    expect(parse("t", e.repeat(4001)).ok).toBe(false);
  });
});
