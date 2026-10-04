import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
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

  it("shows the invalid-link page for unknown tokens on GET and POST", async () => {
    const app = createApp();
    expect((await app.request(getReq("/auth/verify?t=nope"), undefined, testEnv)).status).toBe(400);
    expect((await app.request(formPost("/auth/verify", { t: "x".repeat(43) }), undefined, testEnv)).status).toBe(400);
  });
});
