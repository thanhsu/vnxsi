import { describe, expect, it } from "vitest";
import { ulid } from "../../src/lib/ulid.ts";
import { testEnv } from "../helpers.ts";

const files = import.meta.glob("../../migrations/0011_partners.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const code = (Object.values(files)[0] ?? "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const NOW = "2026-10-05T00:00:00.000Z";

type Cols = Record<string, string | number | null>;
async function insert(table: string, cols: Cols): Promise<string> {
  const id = ulid();
  const all: Cols = { id, write_id: "w", created_at: NOW, updated_at: NOW, ...cols };
  const keys = Object.keys(all);
  await testEnv.DB.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...keys.map((k) => all[k] ?? null))
    .run();
  return id;
}
const merchant = (o: Cols = {}) =>
  insert("merchants", { indexable: 0, slug: `m-${ulid().slice(-10).toLowerCase()}`, name: "M", website_url: "https://example.com/", allowed_hosts: '["example.com"]', description: "", status: "active", ...o });
const program = (merchantId: string, o: Cols = {}) =>
  insert("partner_programs", { merchant_id: merchantId, name: "P", type: "affiliate", provider: "manual", status: "draft", ...o });
const offer = (merchantId: string, o: Cols = {}) =>
  insert("offers", { subject_type: "merchant", subject_id: merchantId, kind: "official", label: "visit_site", destination_url: "https://example.com/", status: "active", ...o });

describe("0011_partners (addendum §3.2, Review Focus 6)", () => {
  it("is additive, has no DEFAULT at all and no cascade", () => {
    expect(code).toMatch(/CREATE TABLE merchants/);
    expect(code).not.toMatch(/\b(DROP|ALTER)\b/i);
    expect(code).not.toMatch(/ON DELETE/i);
    expect(code).not.toMatch(/\bDEFAULT\b/i);
  });

  it("leaves commission, cookie and currency empty when nothing is given", async () => {
    const p = await program(await merchant());
    const row = await testEnv.DB.prepare("SELECT commission_model, commission_rate_bps, commission_flat_minor, currency, cookie_days FROM partner_programs WHERE id = ?1").bind(p).first();
    expect(row).toEqual({ commission_model: null, commission_rate_bps: null, commission_flat_minor: null, currency: null, cookie_days: null });
  });

  it("merchants: slug unique, status and JSON checked, indexable has no default", async () => {
    await merchant({ slug: "dup-slug-0011" });
    await expect(merchant({ slug: "dup-slug-0011" })).rejects.toThrow();
    await expect(merchant({ status: "deleted" })).rejects.toThrow();
    await expect(merchant({ allowed_hosts: "not json" })).rejects.toThrow();
    await expect(merchant({ indexable: 2 })).rejects.toThrow();
    await expect(
      testEnv.DB.prepare("INSERT INTO merchants (id, slug, name, website_url, allowed_hosts, description, status, write_id, created_at, updated_at) VALUES ('x', 'no-indexable', 'M', 'https://example.com/', '[]', '', 'active', 'w', ?1, ?1)").bind(NOW).run(),
    ).rejects.toThrow();
  });

  it("programs: active needs terms_url, terms_verified_at and a type other than direct", async () => {
    const m = await merchant();
    const terms = { terms_url: "https://example.com/terms", terms_verified_at: NOW };
    await expect(program(m, { status: "active" })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: terms.terms_url })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_verified_at: NOW })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: "", terms_verified_at: NOW })).rejects.toThrow();
    await expect(program(m, { status: "active", terms_url: terms.terms_url, terms_verified_at: "" })).rejects.toThrow();
    await expect(program(m, { status: "active", type: "direct", ...terms })).rejects.toThrow();
    await expect(program(m, { status: "active", ...terms })).resolves.toBeTypeOf("string");
    await expect(program(m, { status: "draft", type: "direct" })).resolves.toBeTypeOf("string");
    await expect(program(m, { status: "paused" })).resolves.toBeTypeOf("string");
    await expect(program(m, { type: "barter" })).rejects.toThrow();
    await expect(program(m, { commission_model: "magic" })).rejects.toThrow();
  });

  it("programs: merchant_id must exist and a merchant with programs cannot be deleted", async () => {
    await expect(program("no-such-merchant")).rejects.toThrow();
    const m = await merchant();
    await program(m);
    await expect(testEnv.DB.prepare("DELETE FROM merchants WHERE id = ?1").bind(m).run()).rejects.toThrow();
  });

  it("offers: a program needs a non-empty tracking template; label and subject_type are enums", async () => {
    const m = await merchant();
    const p = await program(m);
    await expect(offer(m, { program_id: p })).rejects.toThrow();
    await expect(offer(m, { program_id: p, tracking_template: "" })).rejects.toThrow();
    await expect(offer(m, { program_id: p, tracking_template: "https://example.com/c?x={click_id}" })).resolves.toBeTypeOf("string");
    await expect(offer(m)).resolves.toBeTypeOf("string");
    await expect(offer(m, { label: "try_it" })).resolves.toBeTypeOf("string");
    await expect(offer(m, { label: "buy_now" })).rejects.toThrow();
    await expect(offer(m, { subject_type: "person" })).rejects.toThrow();
    await expect(offer(m, { kind: "gift" })).rejects.toThrow();
    await expect(offer(m, { status: "deleted" })).rejects.toThrow();
    await expect(offer(m, { program_id: "no-such-program", tracking_template: "https://example.com/c" })).rejects.toThrow();
  });
});
