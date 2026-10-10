import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { findBuilderByUserId } from "../../src/db/builders.ts";
import { makeBuilder, profileValues, signIn } from "../fixtures.ts";
import { expectErrorSummary, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();

async function asBuilder(email: string, handle: string, status: Parameters<typeof makeBuilder>[2] = "pending") {
  const builder = await makeBuilder(email, handle, status);
  const { cookie } = await signIn(email);
  return { builder, cookie };
}

describe("Builder Hub overview (spec §5.3)", () => {
  it("routes non-builders to apply and anonymous users to sign in", async () => {
    expect((await app().request(getReq("/hub"), undefined, testEnv)).headers.get("location")).toBe("/login?next=%2Fhub");
    const { cookie } = await signIn("hub-nobody@vnx.si");
    expect((await app().request(getReq("/hub", cookie), undefined, testEnv)).headers.get("location")).toBe("/hub/apply");
  });

  it("shows a pending builder their status, noindex", async () => {
    const { cookie } = await asBuilder("hub-pending@vnx.si", "hub-pending");
    const html = await (await app().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Pending review");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("links an approved builder to the public profile", async () => {
    const { cookie } = await asBuilder("hub-approved@vnx.si", "hub-approved", "approved");
    const html = await (await app().request(getReq("/vi/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain('href="/vi/b/hub-approved"');
  });

  it("shows the admin note to a rejected builder and resubmits once", async () => {
    const { builder, cookie } = await asBuilder("hub-rejected@vnx.si", "hub-rejected", "rejected");
    const html = await (await app().request(getReq("/hub", cookie), undefined, testEnv)).text();
    expect(html).toContain("Add a portfolio");
    const res = await app().request(formPost("/hub/resubmit", {}, { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub");
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ status: "pending", reviewNote: null });
    const audit = await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'builder.resubmit' AND entity_id = ?1").bind(builder.userId).first<{ n: number }>();
    expect(audit?.n).toBe(1);
    expect((await app().request(formPost("/hub/resubmit", {}, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});

describe("Hub link in the header", () => {
  it("shows the Builder Hub link to signed-in users only", async () => {
    await makeBuilder("nav-hub@vnx.si", "nav-hub", "approved");
    const { cookie } = await signIn("nav-hub@vnx.si");
    const profile = await (await app().request(getReq("/b/nav-hub", cookie), undefined, testEnv)).text();
    expect(profile).toContain('<a href="/hub">Builder Hub</a>');
    const vi = await (await app().request(getReq("/vi/hub", cookie), undefined, testEnv)).text();
    expect(vi).toContain('<a href="/vi/hub">Builder Hub</a>');
    const anon = await (await app().request(getReq("/b/nav-hub"), undefined, testEnv)).text();
    expect(anon).not.toContain('href="/hub"');
  });
});

describe("Builder Hub profile", () => {
  it("prefills the form and lets a pending builder change the handle", async () => {
    const { builder, cookie } = await asBuilder("prof-pending@vnx.si", "prof-pending");
    const form = await (await app().request(getReq("/hub/profile", cookie), undefined, testEnv)).text();
    expect(form).toContain('value="Next.js, Supabase"');
    const res = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-pending-2", name: "Lan N." }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/hub/profile?saved=1");
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ handle: "prof-pending-2", name: "Lan N." });
    expect(await (await app().request(getReq("/hub/profile?saved=1", cookie), undefined, testEnv)).text()).toContain("Changes saved.");
  });

  it("keeps the handle of an approved builder but saves other fields at once", async () => {
    const { builder, cookie } = await asBuilder("prof-approved@vnx.si", "prof-approved", "approved");
    expect(await (await app().request(getReq("/hub/profile", cookie), undefined, testEnv)).text()).toContain("readonly");
    await app().request(formPost("/hub/profile", profileValues({ handle: "something-else", headline: "New headline" }), { cookie }), undefined, testEnv);
    expect(await findBuilderByUserId(testEnv.DB, builder.userId)).toMatchObject({ handle: "prof-approved", headline: "New headline", status: "approved" });
    const audit = await testEnv.DB.prepare("SELECT entity_id FROM audit_log WHERE action = 'builder.profile_update'").all<{ entity_id: string }>();
    expect(audit.results.filter((r) => r.entity_id === builder.userId)).toHaveLength(1);
  });

  it("re-renders errors (400) and refuses a taken handle (409)", async () => {
    await makeBuilder("prof-other@vnx.si", "prof-other");
    const { cookie } = await asBuilder("prof-errors@vnx.si", "prof-errors");
    const bad = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-errors", name: "" }), { cookie }), undefined, testEnv);
    expect(bad.status).toBe(400);
    const html = await bad.text();
    expect(html).toContain("Enter a name (up to 80 characters).");
    expectErrorSummary(html, ["name"]);
    const taken = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-other" }), { cookie }), undefined, testEnv);
    expect(taken.status).toBe(409);
    expect(await taken.text()).toContain("This handle is already taken.");
  });

  it("refuses edits while suspended (409)", async () => {
    const { cookie } = await asBuilder("prof-suspended@vnx.si", "prof-suspended", "suspended");
    const res = await app().request(formPost("/hub/profile", profileValues({ handle: "prof-suspended" }), { cookie }), undefined, testEnv);
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("This action is no longer possible");
  });
});
