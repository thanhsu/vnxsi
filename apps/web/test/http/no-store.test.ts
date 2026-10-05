import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { makeBuilder, signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

describe("Cache-Control: no-store on private pages", () => {
  it("marks Hub, /me and admin pages in every locale, and leaves public pages alone", async () => {
    await makeBuilder("ns-b@vnx.si", "ns-b", "approved");
    const builder = await signIn("ns-b@vnx.si");
    const admin = await signIn("owner@vnx.si", { admin: true });
    const app = createApp();
    for (const [path, cookie] of [["/hub", builder.cookie], ["/vi/hub/inquiries", builder.cookie], ["/zh-hant/admin/builders", admin.cookie], ["/me", builder.cookie]] as const) {
      const res = await app.request(getReq(path, cookie), undefined, testEnv);
      expect(res.headers.get("cache-control"), path).toBe("no-store");
    }
    // Redirects to /login from private paths are marked too.
    expect((await app.request(getReq("/hub"), undefined, testEnv)).headers.get("cache-control")).toBe("no-store");
    expect((await app.request(getReq("/products"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
    expect((await app.request(getReq("/hubris"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
  });

  it("marks every HTML page for a signed-in person, but not their assets (VNX-0803 F8)", async () => {
    const user = await signIn("ns-u@vnx.si");
    const app = createApp();
    for (const path of ["/contact", "/request", "/vi", "/products", "/login"]) {
      expect((await app.request(getReq(path, user.cookie), undefined, testEnv)).headers.get("cache-control"), path).toBe("no-store");
    }
    expect((await app.request(getReq("/assets/app.css", user.cookie), undefined, testEnv)).headers.get("cache-control")).not.toBe("no-store");
    expect((await app.request(getReq("/robots.txt", user.cookie), undefined, testEnv)).headers.get("cache-control")).toBe("public, max-age=3600");
    expect((await app.request(getReq("/contact"), undefined, testEnv)).headers.get("cache-control")).toBeNull();
  });
});
