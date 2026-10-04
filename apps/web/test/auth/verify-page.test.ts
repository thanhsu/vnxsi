import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { clearOutbox, outbox } from "../../src/email/fake.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

function linkFrom(text: string): string {
  const m = /https:\/\/vnx\.si\/auth\/verify\?[^\s"<]+/.exec(text);
  if (!m) throw new Error("no link in email");
  return m[0];
}

describe("/auth/verify confirmation page (VNX-0506)", () => {
  beforeEach(() => clearOutbox());

  it("shows a button on GET and never spends the token, however often a scanner opens it", async () => {
    const app = createApp();
    await app.request(formPost("/vi/login", { email: "scan@vnx.si", next: "/hub" }), undefined, testEnv);
    const url = new URL(linkFrom(outbox[0]!.text));
    for (let i = 0; i < 3; i++) {
      const res = await app.request(getReq(url.pathname + url.search), undefined, testEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("set-cookie")).toBeNull();
      const html = await res.text();
      expect(html).toContain("Hoàn tất đăng nhập");
      expect(html).toContain('<form method="post" action="/auth/verify">');
      expect(html).toContain(`name="t" value="${url.searchParams.get("t")}"`);
      expect(html).toContain('name="next" value="/hub"');
      expect(html).toContain('<meta name="robots" content="noindex"');
    }
    const post = await app.request(formPost("/auth/verify", { t: url.searchParams.get("t")!, next: "/hub" }), undefined, testEnv);
    expect(post.status).toBe(303);
    expect(post.headers.get("location")).toBe("/hub");
    expect(post.headers.get("set-cookie")).toMatch(/__Host-vnx_session=/);

    const again = await app.request(formPost("/auth/verify", { t: url.searchParams.get("t")! }), undefined, testEnv);
    expect(again.status).toBe(400);
    const reopened = await app.request(getReq(url.pathname + url.search), undefined, testEnv);
    expect(reopened.status).toBe(400);
  });

  it("refuses a POST without a same-origin Origin header", async () => {
    const app = createApp();
    await app.request(formPost("/login", { email: "csrf@vnx.si" }), undefined, testEnv);
    const t = new URL(linkFrom(outbox[0]!.text)).searchParams.get("t")!;
    const res = await app.request(formPost("/auth/verify", { t }, { origin: "https://evil.example" }), undefined, testEnv);
    expect(res.status).toBe(403);
    // The token is still good.
    expect((await app.request(formPost("/auth/verify", { t }), undefined, testEnv)).status).toBe(303);
  });

  it("explains an expired inquiry link in the link's own language, with the Send now hint", async () => {
    const app = createApp();
    const old = new Date(Date.now() - 16 * 60 * 1000);
    const t = await createLoginToken(testEnv.DB, { email: "expired@vnx.si", purpose: "inquiry_verify", locale: "vi" }, old);
    const got = await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv);
    expect(got.status).toBe(400);
    const html = await got.text();
    expect(html).toContain("Link đăng nhập này không còn dùng được");
    expect(html).toContain("Nếu bạn đang xác nhận một yêu cầu: hãy đăng nhập, mở Yêu cầu của tôi và bấm Gửi ngay.");
    expect(html).toContain('lang="vi"');
    const posted = await app.request(formPost("/auth/verify", { t }), undefined, testEnv);
    expect(posted.status).toBe(400);
    expect(await posted.text()).toContain("Gửi ngay");
    // A login link has no inquiry hint; an unknown token falls back to English.
    const login = await createLoginToken(testEnv.DB, { email: "expired2@vnx.si", purpose: "login", locale: "vi" }, old);
    const loginHtml = await (await app.request(getReq(`/auth/verify?t=${login}`), undefined, testEnv)).text();
    expect(loginHtml).toContain("Link đăng nhập này không còn dùng được");
    expect(loginHtml).not.toContain("Gửi ngay");
    const unknown = await (await app.request(getReq("/auth/verify?t=nope"), undefined, testEnv)).text();
    expect(unknown).toContain("This sign-in link no longer works");
    expect(unknown).not.toContain("Send now");
  });

  it("shows the invalid-link page for unknown tokens on GET and POST", async () => {
    const app = createApp();
    expect((await app.request(getReq("/auth/verify?t=nope"), undefined, testEnv)).status).toBe(400);
    expect((await app.request(formPost("/auth/verify", { t: "x".repeat(43) }), undefined, testEnv)).status).toBe(400);
  });
});
