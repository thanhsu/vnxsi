import { describe, expect, it } from "vitest";
import { safeNext } from "../../src/http/next.ts";

describe("safeNext", () => {
  it("accepts same-site absolute paths", () => {
    expect(safeNext("/hub")).toBe("/hub");
    expect(safeNext("/vi/me?tab=1")).toBe("/vi/me?tab=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", undefined, 42, "/%2F%2Fevil.com", "/\t/evil.com", "/\n/evil.com", "/\r\n/evil.com", "/%09/evil.com", "/%0d%0a/evil.com", "/%5Cevil.com", "/.//evil.com", "/%2e//evil.com", "/..//evil.com", "/a/..//evil.com"]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
});
