import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
import { testEnv } from "../helpers.ts";

// The approved source text (VNX-0705a). Read from the files themselves, never from a copy.
const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const sourceOf = (name: string): string => {
  const entry = Object.entries(SOURCES).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  if (!entry) throw new Error(`docs/legal/${name}.md not found`);
  return entry[1].replace(/\r\n/g, "\n");
};

/** The `## EN` or `## VI` part of a source file, up to the next `---`. */
function partOf(md: string, lang: "EN" | "VI"): string {
  const start = md.indexOf(`\n## ${lang}\n`);
  if (start < 0) throw new Error(`missing ## ${lang}`);
  const body = md.slice(start + `\n## ${lang}\n`.length);
  const end = body.indexOf("\n---");
  return end < 0 ? body : body.slice(0, end);
}

const plain = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

/** Every title, heading, paragraph and list item of a part, in source order, as plain text. */
function expectedLines(part: string): string[] {
  return part
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.replace(/^### /, "").replace(/^- /, "").replace("{date}", LEGAL_UPDATED_AT))
    .map(plain);
}

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
/** Inline tags vanish without a gap; block tags become a space. */
const textOf = (html: string) =>
  decode(html.replace(/<\/?(?:strong|code|a|span)\b[^>]*>/g, "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const get = (path: string) => createApp().request(new Request(`https://vnx.si${path}`), undefined, testEnv);

const CASES = [
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "media-kit", path: "/media-kit" },
] as const;

describe("legal pages match docs/legal/*.md word for word (VNX-0705a AC2)", () => {
  it("reads the three approved source files", () => {
    for (const { name } of CASES) expect(sourceOf(name)).toContain("## EN");
  });

  for (const { name, path } of CASES) {
    for (const [lang, prefix] of [
      ["EN", ""],
      ["VI", "/vi"],
    ] as const) {
      it(`${name} ${lang}: every heading, paragraph and list item appears in order`, async () => {
        const lines = expectedLines(partOf(sourceOf(name), lang));
        expect(lines.length, name).toBeGreaterThan(10);
        const res = await get(prefix + path);
        expect(res.status).toBe(200);
        const text = textOf(mainOf(await res.text()));
        let from = 0;
        for (const line of lines) {
          const at = text.indexOf(line, from);
          expect(at, `${name} ${lang}: "${line}"`).toBeGreaterThanOrEqual(0);
          from = at + line.length;
        }
      });
    }
  }

  it("leaves out the notes for the Owner and the draft header", async () => {
    for (const { path } of CASES) {
      for (const prefix of ["", "/vi"]) {
        const text = textOf(mainOf(await (await get(prefix + path)).text()));
        expect(text, prefix + path).not.toContain("Ghi chú cho Owner");
        expect(text, prefix + path).not.toContain("bản nháp");
        expect(text, prefix + path).not.toContain("{date}");
        expect(text, prefix + path).not.toContain("**");
        expect(text, prefix + path).not.toContain("`");
      }
    }
  });
});
