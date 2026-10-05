import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/messages/en.ts";
import { vi } from "../../src/i18n/messages/vi.ts";
import { zhHans } from "../../src/i18n/messages/zh-hans.ts";
import { zhHant } from "../../src/i18n/messages/zh-hant.ts";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** ADR-010 §1 (Owner 2026-10-05): the English-only Ops console keeps its `ops.*` keys in en.ts alone. */
const isOpsKey = (key: string) => key.startsWith("ops.");

/**
 * Every way one locale breaks parity with EN (ADR-003): a missing or extra key, an empty value, other placeholders.
 * `ops.*` keys are exempt from parity and must not appear outside EN at all, so they cannot drift.
 */
function parityProblems(base: Record<string, string>, messages: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(base).sort()) {
    if (!isOpsKey(key) && !(key in messages)) problems.push(`missing ${key}`);
  }
  for (const [key, value] of Object.entries(messages).sort(([a], [b]) => a.localeCompare(b))) {
    if (isOpsKey(key)) problems.push(`ops key outside EN ${key}`);
    else if (!(key in base)) problems.push(`extra ${key}`);
    else if (value.trim() === "") problems.push(`empty ${key}`);
    else if (placeholders(value).join(",") !== placeholders(base[key] ?? "").join(",")) problems.push(`placeholders ${key}`);
  }
  return problems;
}

describe("locale parity (ADR-003, ADR-010 §1)", () => {
  for (const [name, messages] of Object.entries({ vi, zhHans, zhHant })) {
    it(`${name} has exactly the EN keys outside ops.*, none empty, same placeholders, and no ops.* key`, () => {
      expect(parityProblems(en, messages)).toEqual([]);
    });
  }
});

describe("parity rule itself", () => {
  const base = { "nav.home": "Home", "greet.hello": "Hello {name}", "ops.nav.overview": "Overview" };

  it("accepts a locale without the ops.* keys", () => {
    expect(parityProblems(base, { "nav.home": "Trang chủ", "greet.hello": "Chào {name}" })).toEqual([]);
  });

  it("refuses an ops.* key outside EN, even one that matches EN", () => {
    expect(parityProblems(base, { "nav.home": "Trang chủ", "greet.hello": "Chào {name}", "ops.nav.overview": "Overview" })).toEqual(["ops key outside EN ops.nav.overview"]);
    expect(parityProblems(base, { "nav.home": "Trang chủ", "greet.hello": "Chào {name}", "ops.other": "x" })).toEqual(["ops key outside EN ops.other"]);
  });

  it("still refuses a missing, extra, empty or differently templated key outside ops.*", () => {
    expect(parityProblems(base, { "greet.hello": "Chào {name}" })).toEqual(["missing nav.home"]);
    expect(parityProblems(base, { "nav.home": "Trang chủ", "greet.hello": "Chào {name}", "nav.extra": "x" })).toEqual(["extra nav.extra"]);
    expect(parityProblems(base, { "nav.home": "  ", "greet.hello": "Chào {name}" })).toEqual(["empty nav.home"]);
    expect(parityProblems(base, { "nav.home": "Trang chủ", "greet.hello": "Chào {ten}" })).toEqual(["placeholders greet.hello"]);
  });
});
