import { describe, expect, it } from "vitest";
import { directorySearchParams, isDirectoryFiltered, parseDirectoryQuery } from "../../src/domain/directory.ts";

describe("parseDirectoryQuery", () => {
  it("keeps valid filters and ignores invalid or unknown ones", () => {
    expect(parseDirectoryQuery({ q: " lan ", category: "crm", lang: "zh", country: "vn", availability: "limited", page: "2", sort: "paid" })).toEqual({
      q: "lan",
      category: "crm",
      lang: "zh",
      country: "VN",
      availability: "limited",
      page: 2,
    });
    expect(parseDirectoryQuery({ category: "x", lang: "zh-Hans", country: "XX", availability: "busy", page: "0" })).toEqual({
      q: "",
      category: null,
      lang: null,
      country: null,
      availability: null,
      page: 1,
    });
  });

  it("has exactly the spec's inputs (ADR-004)", () => {
    expect(Object.keys(parseDirectoryQuery({})).sort()).toEqual(["availability", "category", "country", "lang", "page", "q"]);
  });

  it("writes the query back and reports filters", () => {
    const q = parseDirectoryQuery({ q: "next js", country: "VN", page: "3" });
    expect(directorySearchParams(q, 1)).toBe("?q=next+js&country=VN");
    expect(directorySearchParams(q, 2)).toBe("?q=next+js&country=VN&page=2");
    expect(isDirectoryFiltered(q)).toBe(true);
    expect(isDirectoryFiltered(parseDirectoryQuery({ page: "2" }))).toBe(false);
  });
});
