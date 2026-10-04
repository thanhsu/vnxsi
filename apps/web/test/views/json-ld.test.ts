import { describe, expect, it } from "vitest";
import { jsonLdScript } from "../../src/views/json-ld.ts";

describe("jsonLdScript", () => {
  it("cannot be closed early by user data and still parses back to the same value", () => {
    const data = { name: "</script><script>alert(1)</script>", note: "a & b > c \u2028 \u2029" };
    const html = String(jsonLdScript(data));
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.endsWith("</script>")).toBe(true);
    const inner = html.slice('<script type="application/ld+json">'.length, -"</script>".length);
    expect(inner).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(inner)).toEqual(data);
  });
});
