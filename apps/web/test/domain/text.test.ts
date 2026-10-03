import { describe, expect, it } from "vitest";
import { parsePlainText } from "../../src/domain/text.ts";

describe("parsePlainText", () => {
  it("splits paragraphs on blank lines", () => {
    expect(parsePlainText("One\nline two\n\nSecond")).toEqual([
      { kind: "p", text: "One\nline two" },
      { kind: "p", text: "Second" },
    ]);
  });

  it("turns '- ' lines into a list and keeps surrounding text", () => {
    expect(parsePlainText("Intro\n- a\n- b\nOutro")).toEqual([
      { kind: "p", text: "Intro" },
      { kind: "ul", items: ["a", "b"] },
      { kind: "p", text: "Outro" },
    ]);
  });

  it("normalizes CRLF and ignores empty input", () => {
    expect(parsePlainText("a\r\n\r\nb")).toEqual([
      { kind: "p", text: "a" },
      { kind: "p", text: "b" },
    ]);
    expect(parsePlainText("  \n\n ")).toEqual([]);
  });

  it("keeps HTML as literal text (escaping happens at render)", () => {
    expect(parsePlainText("<script>x</script>")).toEqual([{ kind: "p", text: "<script>x</script>" }]);
  });
});
