import { describe, expect, it } from "vitest";

const domain = import.meta.glob("../src/domain/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const views = import.meta.glob("../src/views/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("module boundaries (ARCHITECTURE.md §2)", () => {
  it("domain/ imports neither hono nor db and never touches D1", () => {
    for (const [file, src] of Object.entries(domain)) {
      expect(src, file).not.toMatch(/from\s+["']hono(\/[^"']*)?["']/);
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
      expect(src, file).not.toMatch(/D1Database/);
    }
  });

  it("views/ never import db", () => {
    for (const [file, src] of Object.entries(views)) {
      expect(src, file).not.toMatch(/from\s+["'][^"']*\/db\/[^"']*["']/);
    }
  });
});
