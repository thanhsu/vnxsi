import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { isFlagEnabled, readFlags, resetFlagCache } from "../../src/db/flags.ts";
import { FLAG_KEYS } from "../../src/domain/flags.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const send = (req: Request) => app().request(req, undefined, testEnv);
const admin = () => signIn("owner@vnx.si", { admin: true });

describe("/admin/flags (addendum §3.6)", () => {
  beforeEach(async () => {
    await testEnv.DB.prepare("DELETE FROM feature_flags").run();
    resetFlagCache();
  });

  it("is for admins only", async () => {
    const { cookie } = await signIn("flags-user@vnx.si");
    expect((await send(getReq("/admin/flags", cookie))).status).toBe(403);
    expect((await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie }))).status).toBe(403);
    await makeBuilder("flags-builder@vnx.si", "flags-builder", "approved");
    const b = await signIn("flags-builder@vnx.si");
    expect((await send(getReq("/admin/flags", b.cookie))).status).toBe(403);
    expect((await send(getReq("/admin/flags"))).status).toBe(303);
  });

  it("lists the seven flags, all off, with no-store", async () => {
    const { cookie } = await admin();
    const res = await send(getReq("/admin/flags", cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    for (const key of FLAG_KEYS) expect(html, key).toContain(`/admin/flags/${key}`);
    expect(html.match(/data-state="off"/g)).toHaveLength(FLAG_KEYS.length);
    expect(html).not.toContain('data-state="on"');
    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  it("turns a flag on and off, audits each change, and rejects cross-site and bad input", async () => {
    const { cookie, user } = await admin();
    const on = await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie }));
    expect(on.status).toBe(303);
    expect(on.headers.get("location")).toBe("/admin/flags?done=1");
    expect((await readFlags(testEnv.DB)).affiliate).toBe(true);

    const audit = await testEnv.DB.prepare("SELECT actor_user_id, data FROM audit_log WHERE action = 'flag.set' AND entity_id = 'affiliate'").first<{ actor_user_id: string; data: string }>();
    expect(audit?.actor_user_id).toBe(user.id);
    expect(JSON.parse(audit?.data ?? "{}")).toEqual({ enabled: true });

    expect((await send(formPost("/admin/flags/affiliate", { enabled: "0" }, { cookie }))).status).toBe(303);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);

    expect((await send(formPost("/admin/flags/affiliate", { enabled: "yes" }, { cookie }))).status).toBe(400);
    expect((await send(formPost("/admin/flags/nope", { enabled: "1" }, { cookie }))).status).toBe(404);
    expect((await send(formPost("/admin/flags/affiliate", { enabled: "1" }, { cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect((await readFlags(testEnv.DB)).affiliate).toBe(false);
  });

  it("shows the flag state it read from D1, not the cache", async () => {
    const { cookie } = await admin();
    expect(await isFlagEnabled(testEnv.DB, "content_indexing")).toBe(false); // primes the cache with "off"
    await testEnv.DB.prepare("INSERT INTO feature_flags (key, enabled, updated_by, updated_at) VALUES ('content_indexing', 1, NULL, '2026-10-05T00:00:00.000Z')").run();
    expect(await isFlagEnabled(testEnv.DB, "content_indexing")).toBe(false); // still cached
    const html = await (await send(getReq("/admin/flags", cookie))).text();
    expect(html).toMatch(/content_indexing[\s\S]*?data-state="on"/);
  });

  it("works in every locale prefix", async () => {
    const { cookie } = await admin();
    for (const prefix of ["/vi", "/zh-hans", "/zh-hant"]) expect((await send(getReq(`${prefix}/admin/flags`, cookie))).status, prefix).toBe(200);
  });
});
