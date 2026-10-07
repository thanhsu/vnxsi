import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { createLoginToken } from "../../src/auth/tokens.ts";
import { formPost, getReq, testEnv } from "../helpers.ts";

// VNX-0803 review F1: a page with referrer policy "no-referrer" makes browsers send "Origin: null" on a form POST,
// which originCheck (correctly) refuses. The test helper always sends a good Origin, so assert the header itself.
const POST_FORM = /<form\b[^>]*method="post"/i;

async function expectNoNoReferrerOnPostForm(res: Response, label: string) {
  const html = await res.text();
  if (POST_FORM.test(html)) {
    expect(res.headers.get("referrer-policy"), `${label} has a POST form`).not.toBe("no-referrer");
  }
  return html;
}

describe("Referrer-Policy on pages with POST forms (VNX-0803 F1)", () => {
  it("never uses no-referrer where the page holds a POST form", async () => {
    const app = createApp();
    for (const path of ["/", "/login", "/request", "/contact", "/vi/login", "/vi/request", "/zh-hans/contact", "/auth/verify?t=nope"]) {
      await expectNoNoReferrerOnPostForm(await app.request(getReq(path), undefined, testEnv), path);
    }
  });

  it("the form pages we rely on really contain a POST form", async () => {
    const app = createApp();
    for (const path of ["/login", "/request", "/contact"]) {
      const res = await app.request(getReq(path), undefined, testEnv);
      expect(POST_FORM.test(await res.text()), path).toBe(true);
      expect(res.headers.get("referrer-policy"), path).not.toBe("no-referrer");
    }
  });

  it("the confirm page of every verify purpose has a POST form and a same-origin policy", async () => {
    const app = createApp();
    for (const purpose of ["login", "inquiry_verify", "request_verify"] as const) {
      const t = await createLoginToken(testEnv.DB, { email: `ref-${purpose}@vnx.si`, purpose, locale: "en" }, new Date());
      const res = await app.request(getReq(`/auth/verify?t=${t}`), undefined, testEnv);
      expect(res.status, purpose).toBe(200);
      const html = await expectNoNoReferrerOnPostForm(res.clone(), purpose);
      expect(html, purpose).toMatch(POST_FORM);
      expect(res.headers.get("referrer-policy"), purpose).toBe("same-origin");
    }
  });

  it("documents that originCheck refuses Origin: null and leaves the token unspent", async () => {
    const app = createApp();
    const t = await createLoginToken(testEnv.DB, { email: "null-origin@vnx.si", purpose: "login", locale: "en" }, new Date());
    const res = await app.request(formPost("/auth/verify", { t }, { origin: "null" }), undefined, testEnv);
    expect(res.status).toBe(403);
    expect((await app.request(formPost("/auth/verify", { t }), undefined, testEnv)).status).toBe(303);
  });
});
