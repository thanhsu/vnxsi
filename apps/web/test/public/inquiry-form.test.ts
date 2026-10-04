import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { listClientInquiries, listMessages } from "../../src/db/inquiries.ts";
import { findUserByEmail } from "../../src/db/users.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import type { Bindings } from "../../src/env.ts";
import { FAKE_TURNSTILE_PASS } from "../../src/http/turnstile.ts";
import { makeBuilder, makeLiveProduct, signIn } from "../fixtures.ts";
import { followMagicLink, formPost, getReq, testEnv } from "../helpers.ts";

const app = () => createApp();
const get = (path: string, cookie?: string) => app().request(getReq(path, cookie), undefined, testEnv);
const post = (path: string, fields: Record<string, string>, opts: { cookie?: string; ip?: string; env?: Bindings } = {}) =>
  app().request(formPost(path, fields, { ...(opts.cookie ? { cookie: opts.cookie } : {}), "cf-connecting-ip": opts.ip ?? `198.51.100.${Math.floor(Math.random() * 250)}` }), undefined, opts.env ?? testEnv);

const MESSAGE = "We run three salons and need online booking.";
const signedOut = (email: string) => ({ type: "buy", message: MESSAGE, budgetBand: "500-2k", deadline: "", name: "Minh Tran", email, website: "", "cf-turnstile-response": FAKE_TURNSTILE_PASS });
const linkFrom = (text: string) => /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text)![0];

describe("inquiry buttons (spec §5.2)", () => {
  it("shows Buy, Customize (only when customizable), Hire Builder and Build Similar on a product", async () => {
    const { product } = await makeLiveProduct("if-btn@vnx.si", "if-btn", "Btn Kit", { fields: { customizable: true, customizationNotes: "Colors" } });
    const html = await (await get(`/vi/p/${product.slug}`)).text();
    for (const type of ["buy", "customize", "hire", "build_similar"]) expect(html, type).toContain(`href="/vi/p/${product.slug}/inquiry/${type}"`);
    const { product: plain } = await makeLiveProduct("if-btn2@vnx.si", "if-btn2", "Plain Kit");
    expect(await (await get(`/p/${plain.slug}`)).text()).not.toContain("/inquiry/customize");
    expect((await get(`/p/${plain.slug}/inquiry/customize`)).status).toBe(404);
    expect((await get(`/p/${plain.slug}/inquiry/request`)).status).toBe(404);
  });

  it("shows Hire on a builder profile", async () => {
    await makeBuilder("if-hire@vnx.si", "if-hire", "approved");
    expect(await (await get("/b/if-hire")).text()).toContain('href="/b/if-hire/hire"');
    expect((await get("/b/if-hire/hire")).status).toBe(200);
  });

  it("404s for products and builders that are not public", async () => {
    await makeBuilder("if-pend@vnx.si", "if-pend", "pending");
    expect((await get("/b/if-pend/hire")).status).toBe(404);
    expect((await get("/p/no-such-product/inquiry/buy")).status).toBe(404);
  });
});

describe("inquiry form, signed in (spec §5.6 step 2)", () => {
  beforeEach(() => clearOutbox());

  it("opens the inquiry at once, notifies the builder and goes to /me", async () => {
    const { product } = await makeLiveProduct("if-in-b@vnx.si", "if-in", "Signed Kit");
    const { user, cookie } = await signIn("if-in-c@vnx.si");
    const form = await (await get(`/p/${product.slug}/inquiry/hire`, cookie)).text();
    expect(form).not.toContain('name="email"');
    expect(form).not.toContain("cf-turnstile");
    const res = await post(`/vi/p/${product.slug}/inquiry/hire`, { type: "hire", message: MESSAGE, budgetBand: "unsure", deadline: "", name: "Khanh", website: "" }, { cookie });
    expect(res.status).toBe(303);
    const [item] = await listClientInquiries(testEnv.DB, user.id);
    expect(item?.inquiry).toMatchObject({ status: "open", type: "hire", clientName: "Khanh", locale: "vi", productId: product.id });
    expect(res.headers.get("location")).toBe(`/vi/me/inquiries/${item!.inquiry.id}`);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe("if-in-b@vnx.si");
    expect(outbox[0]!.text).not.toContain("if-in-c@vnx.si");
  });

  it("prefills the account's display name", async () => {
    const { product } = await makeLiveProduct("if-pre-b@vnx.si", "if-pre", "Prefill Kit");
    const { user, cookie } = await signIn("if-pre-c@vnx.si");
    await testEnv.DB.prepare("UPDATE users SET display_name = 'Thu Ha' WHERE id = ?1").bind(user.id).run();
    expect(await (await get(`/p/${product.slug}/inquiry/buy`, cookie)).text()).toContain('value="Thu Ha"');
  });

  it("refuses an inquiry to yourself", async () => {
    const { product } = await makeLiveProduct("if-self@vnx.si", "if-self", "Self Kit");
    const { cookie } = await signIn("if-self@vnx.si");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { type: "buy", message: MESSAGE, budgetBand: "unsure", name: "Me", website: "" }, { cookie });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("You can&#39;t send an inquiry to yourself.");
  });

  it("re-renders with per-field errors and the typed values", async () => {
    const { product } = await makeLiveProduct("if-err-b@vnx.si", "if-err", "Err Kit");
    const { cookie } = await signIn("if-err-c@vnx.si");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { type: "buy", message: "short <b>", budgetBand: "lots", deadline: "2000-01-01", name: "", website: "" }, { cookie });
    expect(res.status).toBe(400);
    const html = await res.text();
    for (const text of ["Please write at least 20 characters.", "Choose one of the options.", "Pick a date from today up to 5 years ahead.", "This field is required.", "short &lt;b&gt;"]) expect(html, text).toContain(text);
  });
});

describe("inquiry form, signed out (spec §5.6 step 3)", () => {
  beforeEach(() => clearOutbox());

  it("creates a pending inquiry, sends a confirmation, and opens it when the link is confirmed", async () => {
    const { product } = await makeLiveProduct("if-out-b@vnx.si", "if-out", "Out Kit");
    const form = await (await get(`/zh-hans/p/${product.slug}/inquiry/buy`)).text();
    expect(form).toContain('class="cf-turnstile" data-sitekey="fake-site-key"');
    expect(form).toContain('name="website"');

    const res = await post(`/zh-hans/p/${product.slug}/inquiry/buy`, signedOut(" New@Client.Example "));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("new@client.example");
    const user = (await findUserByEmail(testEnv.DB, "new@client.example"))!;
    expect(user).toMatchObject({ locale: "zh-Hans", last_login_at: null, display_name: null });
    const [pending] = await listClientInquiries(testEnv.DB, user.id);
    expect(pending?.inquiry.status).toBe("pending_verification");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "new@client.example", subject: "请确认你在 VNX.SI 上的咨询" });

    const done = await followMagicLink(app(), linkFrom(outbox[0]!.text));
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe(`/zh-hans/me/inquiries/${pending!.inquiry.id}`);
    expect(done.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);
    const [opened] = await listClientInquiries(testEnv.DB, user.id);
    expect(opened?.inquiry).toMatchObject({ status: "open" });
    expect(opened?.inquiry.openedAt).not.toBeNull();
    expect((await findUserByEmail(testEnv.DB, "new@client.example"))?.display_name).toBe("Minh Tran");
    expect(outbox).toHaveLength(2);
    expect(outbox[1]?.to).toBe("if-out-b@vnx.si");
    expect(outbox[1]!.text + outbox[1]!.html).not.toContain("new@client.example");
    const [first] = await listMessages(testEnv.DB, pending!.inquiry.id);
    expect(first?.notifiedAt).not.toBeNull();
  }, 30_000);

  it("shows the confirmation page with the inquiry wording", async () => {
    const { product } = await makeLiveProduct("if-page-b@vnx.si", "if-page", "Page Kit");
    await post(`/vi/p/${product.slug}/inquiry/buy`, signedOut("page@client.example"));
    const page = await app().request(new Request(linkFrom(outbox[0]!.text)), undefined, testEnv);
    expect(await page.text()).toContain("Xác nhận và gửi");
  });

  it("does not open an inquiry twice or one the admin removed meanwhile", async () => {
    const { product } = await makeLiveProduct("if-twice-b@vnx.si", "if-twice", "Twice Kit");
    await post(`/p/${product.slug}/inquiry/buy`, signedOut("twice@client.example"));
    const link = linkFrom(outbox[0]!.text);
    const user = (await findUserByEmail(testEnv.DB, "twice@client.example"))!;
    const [pending] = await listClientInquiries(testEnv.DB, user.id);
    await testEnv.DB.prepare("UPDATE inquiries SET status = 'removed' WHERE id = ?1").bind(pending!.inquiry.id).run();
    const done = await followMagicLink(app(), link);
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/me");
    expect(outbox).toHaveLength(1);
    expect((await followMagicLink(app(), link)).status).toBe(400);
  });

  it("rejects a missing or wrong Turnstile token and refuses when Turnstile is not configured", async () => {
    const { product } = await makeLiveProduct("if-cap-b@vnx.si", "if-cap", "Cap Kit");
    const wrong = await post(`/p/${product.slug}/inquiry/buy`, { ...signedOut("cap@client.example"), "cf-turnstile-response": "bad" });
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).toContain("Please complete the check below and try again.");
    const unconfigured = { ...testEnv, TURNSTILE_DRIVER: undefined, TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET: undefined } as Bindings;
    const shown = await app().request(getReq(`/p/${product.slug}/inquiry/buy`), undefined, unconfigured);
    const html = await shown.text();
    expect(html).toContain("Sending without an account is temporarily unavailable.");
    expect(html).not.toContain('type="submit"');
    expect((await post(`/p/${product.slug}/inquiry/buy`, signedOut("cap@client.example"), { env: unconfigured })).status).toBe(503);
    expect(await findUserByEmail(testEnv.DB, "cap@client.example")).toBeNull();
    expect(outbox).toHaveLength(0);
  });

  it("silently drops a filled honeypot", async () => {
    const { product } = await makeLiveProduct("if-hp-b@vnx.si", "if-hp", "Hp Kit");
    const res = await post(`/p/${product.slug}/inquiry/buy`, { ...signedOut("bot@client.example"), website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(await findUserByEmail(testEnv.DB, "bot@client.example")).toBeNull();
    expect(outbox).toHaveLength(0);
  });

  it("answers a suspended account like any other and sends nothing", async () => {
    const { product } = await makeLiveProduct("if-susp-b@vnx.si", "if-susp", "Susp Kit");
    const { user } = await signIn("susp@client.example");
    await testEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?1").bind(user.id).run();
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("susp@client.example"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("susp@client.example");
    expect(await listClientInquiries(testEnv.DB, user.id)).toEqual([]);
    expect(outbox).toHaveLength(0);
  });

  it("refuses the builder's own e-mail", async () => {
    const { product } = await makeLiveProduct("if-own@vnx.si", "if-own", "Own Kit");
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("if-own@vnx.si"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("You can&#39;t send an inquiry to yourself.");
  });

  it("removes the pending inquiry when the confirmation cannot be sent", async () => {
    const { product } = await makeLiveProduct("if-mail-b@vnx.si", "if-mail", "Mail Kit");
    const noMail = { ...testEnv, MAIL_DRIVER: undefined, RESEND_API_KEY: undefined } as Bindings;
    const res = await post(`/p/${product.slug}/inquiry/buy`, signedOut("mailfail@client.example"), { env: noMail });
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("We couldn&#39;t send the confirmation e-mail.");
    const user = (await findUserByEmail(testEnv.DB, "mailfail@client.example"))!;
    expect(await listClientInquiries(testEnv.DB, user.id)).toEqual([]);
  });

  it("allows 10 inquiries per hour per IP", async () => {
    const { product } = await makeLiveProduct("if-rl-b@vnx.si", "if-rl", "Rl Kit");
    const ip = "203.0.113.77";
    for (let i = 0; i < 10; i++) expect((await post(`/p/${product.slug}/inquiry/buy`, signedOut(`rl${i}@client.example`), { ip })).status, String(i)).toBe(200);
    const blocked = await post(`/p/${product.slug}/inquiry/buy`, signedOut("rl10@client.example"), { ip });
    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toContain("Too many inquiries from your network.");
  }, 30_000);
});
