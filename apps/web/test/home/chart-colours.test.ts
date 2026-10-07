import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { testEnv } from "../helpers.ts";

const css = await (await createApp().request(new Request("https://vnx.si/assets/app.css"), undefined, testEnv)).text();
const light = /:root\s*\{([^}]*)\}/.exec(css)![1]!;
const darkMedia = /prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css)![1]!;
const darkAttr = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)![1]!;
const tok = (block: string, name: string): string => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(block)![1]!.toLowerCase();

const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p); return (hi! + 0.05) / (lo! + 0.05); };
const SIM = {
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
} as const;
// Machado et al. define the matrices on LINEAR light, so the product is taken on linear values and compared there (scaled to 0-255,
// not gamma-encoded). Absolute values differ from what a screen shows; the 100 threshold is calibrated for this linear scale.
const simulate = (hex: string, m: readonly (readonly number[])[]) => {
  const l = rgb(hex).map(lin);
  return m.map((row) => Math.min(255, Math.max(0, 255 * (row[0]! * l[0]! + row[1]! * l[1]! + row[2]! * l[2]!))));
};
const distance = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe("chart series colours (VNX-0704a validator)", () => {
  it("light keeps the approved #2a78d6 request and #eb6834 product", () => {
    expect(tok(light, "--chart-blue")).toBe("#2a78d6");
    expect(tok(light, "--chart-orange")).toBe("#eb6834");
  });
  it("dark has its own steps, identical in the media query and the data-theme block, different from light", () => {
    for (const name of ["--chart-blue", "--chart-orange"]) {
      expect(tok(darkMedia, name), name).toBe(tok(darkAttr, name));
      expect(tok(darkAttr, name), name).not.toBe(tok(light, name));
    }
  });
  it("every series colour is at least 3:1 against --surface in all three token blocks (WCAG 1.4.11)", () => {
    for (const [name, block] of [["light", light], ["dark-media", darkMedia], ["dark-attr", darkAttr]] as const) {
      for (const series of ["--chart-blue", "--chart-orange"]) expect(ratio(tok(block, series), tok(block, "--surface")), `${name} ${series}`).toBeGreaterThanOrEqual(3);
    }
  });
  it("the two series stay apart under deuteranopia and protanopia", () => {
    for (const [name, block] of [["light", light], ["dark", darkAttr]] as const) {
      for (const [kind, m] of Object.entries(SIM)) {
        expect(distance(simulate(tok(block, "--chart-blue"), m), simulate(tok(block, "--chart-orange"), m)), `${name} ${kind}`).toBeGreaterThanOrEqual(100);
      }
    }
  });
  it("chart text uses the text colour, never a series colour, and the chart sits on --surface", () => {
    expect(css).toMatch(/\.chart-label[^{]*\{[^}]*fill:\s*var\(--text\)/);
    expect(css).toMatch(/\.chart-value[^{]*\{[^}]*fill:\s*var\(--text\)/);
    expect(css).toMatch(/\.chart\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(css).not.toMatch(/\.chart-(label|value|axis-label)[^{]*\{[^}]*fill:\s*var\(--chart-/);
  });
});
