import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { clearOutbox, outbox } from "../src/email/fake.ts";
import { FAKE_TURNSTILE_PASS } from "../src/http/turnstile.ts";
import { makeLiveProduct, signIn } from "./fixtures.ts";
import { followMagicLink, formPost, getReq, testEnv } from "./helpers.ts";

describe("M5 exit gate: a signed-out inquiry goes all the way round", () => {
  beforeEach(() => clearOutbox());

  it("confirm e-mail → builder replies → client sees it in /me; the builder never sees the client's e-mail", async () => {
    const app = createApp();
    const clientEmail = "gate5.client@example.com";
    const { product } = await makeLiveProduct("gate5-b@vnx.si", "gate5", "Gate Five Kit");

    const sent = await app.request(
      formPost(`/vi/p/${product.slug}/inquiry/buy`, { type: "buy", message: "Please set this up for my two spas.", budgetBand: "2k-10k", deadline: "", name: "Gate Client", email: clientEmail, website: "", "cf-turnstile-response": FAKE_TURNSTILE_PASS }),
      undefined,
      testEnv,
    );
    expect(sent.status).toBe(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(clientEmail);
    const link = /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(outbox[0]!.text)![0];

    const confirmed = await followMagicLink(app, link);
    expect(confirmed.status).toBe(303);
    const inquiryPath = confirmed.headers.get("location")!;
    expect(inquiryPath).toMatch(/^\/vi\/me\/inquiries\/[0-9A-Z]{26}$/);
    const clientCookie = `__Host-vnx_session=${/__Host-vnx_session=([^;]+)/.exec(confirmed.headers.get("set-cookie") ?? "")![1]}`;
    const id = inquiryPath.split("/").at(-1)!;
    // M7 (spec §8.11): the confirmation that opened the inquiry counted it once for its product.
    expect((await testEnv.DB.prepare("SELECT COALESCE(SUM(inquiries), 0) AS n FROM product_daily_stats WHERE product_id = ?1").bind(product.id).first<{ n: number }>())?.n).toBe(1);

    const toBuilder = outbox[1]!;
    expect(toBuilder.to).toBe("gate5-b@vnx.si");
    expect(toBuilder.text).toContain("Please set this up for my two spas.");
    expect(toBuilder.text).toContain("Gate Client");

    const builder = await signIn("gate5-b@vnx.si");
    const list = await (await app.request(getReq("/hub/inquiries", builder.cookie), undefined, testEnv)).text();
    const thread = await (await app.request(getReq(`/hub/inquiries/${id}`, builder.cookie), undefined, testEnv)).text();
    expect(thread).toContain("Please set this up for my two spas.");
    // Spec §5.6: the builder never sees the client's e-mail, in pages or e-mails.
    for (const seen of [list, thread, toBuilder.text, toBuilder.html, toBuilder.subject]) expect(seen).not.toContain(clientEmail);

    const replied = await app.request(formPost(`/hub/inquiries/${id}/reply`, { body: "Sure, I can start Monday." }, { cookie: builder.cookie }), undefined, testEnv);
    expect(replied.status).toBe(303);

    const mine = await (await app.request(getReq(inquiryPath, clientCookie), undefined, testEnv)).text();
    expect(mine).toContain("Sure, I can start Monday.");
    expect(mine).toContain("Đã trả lời");
    expect(outbox[2]?.to).toBe(clientEmail);
  }, 30_000);
});
