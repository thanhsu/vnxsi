import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { addPortfolioItem, findPortfolioItem, listPortfolio } from "../../src/db/portfolio.ts";
import { MAX_PORTFOLIO_ITEMS } from "../../src/domain/portfolio.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const titles = async (builderId: string) => (await listPortfolio(testEnv.DB, builderId)).map((x) => x.title);

describe("Hub portfolio (spec §5.3)", () => {
  it("adds, reorders, edits and deletes items", async () => {
    const b = await makeBuilder("pf-flow@vnx.si", "pf-flow");
    const { cookie } = await signIn("pf-flow@vnx.si");
    const added = await app().request(formPost("/hub/portfolio", { title: "Booking app", url: "https://booking.example", description: "Spa booking" }, { cookie }), undefined, testEnv);
    expect(added.status).toBe(303);
    expect(added.headers.get("location")).toBe("/hub/portfolio");
    await app().request(formPost("/hub/portfolio", { title: "CRM", url: "", description: "" }, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["Booking app", "CRM"]);

    const [first, second] = await listPortfolio(testEnv.DB, b.userId);
    await app().request(formPost(`/hub/portfolio/${second!.id}/move`, { direction: "up" }, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["CRM", "Booking app"]);

    const edit = await app().request(getReq(`/hub/portfolio/${second!.id}`, cookie), undefined, testEnv);
    expect(await edit.text()).toContain('value="CRM"');
    await app().request(formPost(`/hub/portfolio/${second!.id}`, { title: "CRM v2", url: "https://crm.example", description: "" }, { cookie }), undefined, testEnv);
    await app().request(formPost(`/hub/portfolio/${first!.id}/delete`, {}, { cookie }), undefined, testEnv);
    expect(await titles(b.userId)).toEqual(["CRM v2"]);

    const html = await (await app().request(getReq("/hub/portfolio", cookie), undefined, testEnv)).text();
    expect(html).toContain("CRM v2");
    expect(html).toMatch(/<a href="https:\/\/crm\.example" rel="nofollow ugc noopener"/);
  });

  it("validates input (400)", async () => {
    await makeBuilder("pf-bad@vnx.si", "pf-bad");
    const { cookie } = await signIn("pf-bad@vnx.si");
    const res = await app().request(formPost("/hub/portfolio", { title: "", url: "http://insecure.example", description: "" }, { cookie }), undefined, testEnv);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Enter a title (up to 80 characters).");
    expect(html).toContain('value="http://insecure.example"');
  });

  it("refuses a 13th item (409) and hides the add form", async () => {
    const b = await makeBuilder("pf-full@vnx.si", "pf-full");
    for (let i = 0; i < MAX_PORTFOLIO_ITEMS; i++) await addPortfolioItem(testEnv.DB, { builderId: b.userId, item: { title: `P${i}`, url: null, description: "" }, now: new Date().toISOString() });
    const { cookie } = await signIn("pf-full@vnx.si");
    expect((await app().request(formPost("/hub/portfolio", { title: "One more", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(409);
    expect(await (await app().request(getReq("/hub/portfolio", cookie), undefined, testEnv)).text()).toContain("reached the limit of 12 projects");
  });

  it("404s on another builder's items and leaves them untouched", async () => {
    const owner = await makeBuilder("pf-owner@vnx.si", "pf-owner");
    const theirs = await addPortfolioItem(testEnv.DB, { builderId: owner.userId, item: { title: "Mine", url: null, description: "" }, now: new Date().toISOString() });
    await makeBuilder("pf-intruder@vnx.si", "pf-intruder");
    const { cookie } = await signIn("pf-intruder@vnx.si");
    const id = theirs!.id;
    expect((await app().request(getReq(`/hub/portfolio/${id}`, cookie), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/portfolio/${id}`, { title: "Hacked", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(404);
    expect((await app().request(formPost(`/hub/portfolio/${id}/delete`, {}, { cookie }), undefined, testEnv)).status).toBe(404);
    expect(await findPortfolioItem(testEnv.DB, owner.userId, id)).toMatchObject({ title: "Mine" });
  });

  it("blocks changes while suspended (409)", async () => {
    await makeBuilder("pf-susp@vnx.si", "pf-susp", "suspended");
    const { cookie } = await signIn("pf-susp@vnx.si");
    expect((await app().request(formPost("/hub/portfolio", { title: "X", url: "", description: "" }, { cookie }), undefined, testEnv)).status).toBe(409);
  });
});
