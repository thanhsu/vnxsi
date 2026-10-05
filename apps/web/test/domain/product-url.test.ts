import { describe, expect, it } from "vitest";
import { validateFinalUrl } from "../../src/domain/offer-url.ts";
import { PRODUCT_LINK_KINDS, resolveProductLink, validatePublicUrl, type PublicUrlError } from "../../src/domain/product-url.ts";

const GOOD = ["https://demo.example", "https://www.example.com/app?x=1#top", "https://sub.example.co.uk/a/b/", "https://EXAMPLE.com/Path", "https://example.com:443/", "https://xn--bcher-kva.example/", "https://demo.example/%0d%0a"];
const BAD: [string, PublicUrlError][] = [
  ["", "chars"], ["http://demo.example", "scheme"], ["//evil.com", "scheme"], ["HTTPS://demo.example", "scheme"], ["https:evil.com", "scheme"], ["javascript:alert(1)", "scheme"], ["ftp://demo.example", "scheme"],
  ["https://127.0.0.1/", "host"], ["https://2130706433/", "host"], ["https://0x7f.1/", "host"], ["https://[::1]/", "host"], ["https://localhost/", "host"], ["https://a.localhost/", "host"], ["https://intranet/", "host"], ["https://demo.example./", "host"],
  ["https://u@evil.com/", "authority"], ["https://u:p@evil.com/", "authority"], ["https://demo.example:8443/", "port"], ["https://demo.example:80/", "port"],
  ["https://evil.com\\@demo.example/", "chars"], ["https://demo.example/\r\nSet-Cookie: a=b", "chars"], ["https://demo.example/a b", "chars"], ["https://demo.example/\u0000", "chars"], ["https://bücher.example/", "chars"], ["https://demo.example。evil.com/", "chars"],
  ["https://demo%2eexample/", "authority"], ["https://{x}.example/", "authority"], [`https://demo.example/${"a".repeat(2100)}`, "length"],
];

describe("validatePublicUrl (M4): https only, no userinfo, public host, empty port", () => {
  it.each(GOOD)("accepts %s and returns new URL(raw).href", (raw) => {
    expect(validatePublicUrl(raw)).toEqual({ ok: true, url: new URL(raw).href });
  });
  it.each(BAD)("rejects %j", (raw, error) => {
    expect(validatePublicUrl(raw)).toEqual({ ok: false, error });
  });
  it("is idempotent: the href validates to itself", () => {
    for (const raw of GOOD) {
      const first = validatePublicUrl(raw);
      expect(first.ok && validatePublicUrl(first.url)).toEqual(first);
    }
  });
  it("agrees with validateFinalUrl (EPIC 21) on every row once that host is allowed", () => {
    for (const raw of [...GOOD, ...BAD.map(([r]) => r)]) {
      let hosts: string[] = [];
      try { hosts = [new URL(raw).hostname]; } catch { hosts = []; }
      expect(validatePublicUrl(raw).ok, raw).toBe(validateFinalUrl(raw, hosts).ok);
    }
  });
});

describe("resolveProductLink", () => {
  const p = { status: "published", builderStatus: "approved", demoUrl: "https://demo.example/app", websiteUrl: "https://www.example.com/?ref=1" };
  it("lists exactly demo and site", () => expect(PRODUCT_LINK_KINDS).toEqual(["demo", "site"]));
  it("redirects to the normalized URL plus UTM", () => {
    expect(resolveProductLink(p, "demo")).toEqual({ kind: "redirect", url: "https://demo.example/app?utm_source=vnx.si&utm_medium=referral" });
    expect(resolveProductLink(p, "site")).toEqual({ kind: "redirect", url: "https://www.example.com/?ref=1&utm_source=vnx.si&utm_medium=referral" });
  });
  it("does not add UTM when any utm_* is already present", () => {
    expect(resolveProductLink({ ...p, demoUrl: "https://demo.example/?UTM_Campaign=x" }, "demo")).toEqual({ kind: "redirect", url: "https://demo.example/?UTM_Campaign=x" });
  });
  it("is not_found unless the product is published and its builder approved", () => {
    for (const status of ["draft", "in_review", "changes_requested", "unlisted", "suspended", "archived"]) expect(resolveProductLink({ ...p, status }, "demo")).toEqual({ kind: "not_found", reason: "not_public" });
    for (const builderStatus of ["pending", "rejected", "suspended"]) expect(resolveProductLink({ ...p, builderStatus }, "demo")).toEqual({ kind: "not_found", reason: "not_public" });
  });
  it("is missing_url for null or empty, invalid_url for a corrupt value", () => {
    expect(resolveProductLink({ ...p, demoUrl: null }, "demo")).toEqual({ kind: "not_found", reason: "missing_url" });
    expect(resolveProductLink({ ...p, websiteUrl: "" }, "site")).toEqual({ kind: "not_found", reason: "missing_url" });
    for (const bad of ["http://demo.example", "//evil.com", "https://127.0.0.1/", "https://u@evil.com/", "https://demo.example/\r\nX: y"]) {
      expect(resolveProductLink({ ...p, demoUrl: bad }, "demo")).toEqual({ kind: "not_found", reason: "invalid_url" });
    }
  });
  it("reads demo from demoUrl and site from websiteUrl, never the other", () => {
    expect(resolveProductLink({ ...p, demoUrl: null }, "site").kind).toBe("redirect");
    expect(resolveProductLink({ ...p, websiteUrl: null }, "demo").kind).toBe("redirect");
  });
});
