import { describe, expect, it } from "vitest";
import { parsePrivacyNoticeDate } from "../../src/domain/privacy-notice.ts";

const WRANGLER = import.meta.glob("../../wrangler.jsonc", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

// Comments sit on their own lines in wrangler.jsonc; a trailing `//` stripper would break "https://..." values.
const config = JSON.parse(
  Object.values(WRANGLER)[0]!
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1"),
) as { triggers: { crons: string[] }; vars: Record<string, string> };

describe("wrangler.jsonc guard (M7 deploy sequencing)", () => {
  it("registers exactly the two cron triggers (the shared account has a limited trigger count)", () => {
    expect(config.triggers.crons).toEqual(["0 1 * * *", "5 * * * *"]);
  });

  it("PRIVACY_NOTICE_GO_LIVE is empty or a valid YYYY-MM-DD date", () => {
    const value = config.vars.PRIVACY_NOTICE_GO_LIVE;
    expect(value).toBeDefined();
    expect(value === "" || parsePrivacyNoticeDate(value) !== null).toBe(true);
  });

  it("REQUEST_BOARD_GO_LIVE (EPIC 27) is in vars, empty or a valid date; when set it is not before PRIVACY_NOTICE_GO_LIVE, which must be set too", () => {
    const board = config.vars.REQUEST_BOARD_GO_LIVE;
    expect(board).toBeDefined();
    expect(board === "" || parsePrivacyNoticeDate(board) !== null).toBe(true);
    if (board !== "") {
      const privacy = parsePrivacyNoticeDate(config.vars.PRIVACY_NOTICE_GO_LIVE);
      expect(privacy, "PRIVACY_NOTICE_GO_LIVE must be set when the board date is").not.toBeNull();
      expect(parsePrivacyNoticeDate(board)!.getTime()).toBeGreaterThanOrEqual(privacy!.getTime());
    }
  });

  it("has no secret in vars", () => {
    for (const key of Object.keys(config.vars)) expect(key, key).not.toMatch(/SECRET|TOKEN|API_KEY|SALT|PASSWORD/);
  });

  it("ANALYTICS_SALT is a secret, never a var", () => {
    expect(Object.keys(config.vars)).not.toContain("ANALYTICS_SALT");
  });
});

// EPIC 27 (plan M7): the board versions of Privacy and Terms must contain every line of the versions they replace, OAuth wording of
// VNX-2607 included, except the lines listed here as replaced on purpose. Both checks wait for the board files (VNX-2707b); until then they are skipped, not red.
const LEGAL = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const legal = (name: string): string | null => {
  const hit = Object.entries(LEGAL).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  return hit ? hit[1].replace(/\r\n/g, "\n") : null;
};
const plainLine = (line: string) => line.replace(/^#+ /, "").replace(/^- /, "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
const linesOf = (md: string) => md.split("\n").map(plainLine).filter((l) => l !== "");
/** Lines that differ on purpose. VNX-2707b lists here the exact old lines the board text replaces (addendum §12.2 second bullet of section 4, §12.3). "Last updated" lines carry the date. */
const REPLACED_PRIVACY: string[] = [];
const REPLACED_TERMS: string[] = [];
const isDateLine = (l: string) => /last updated|cập nhật lần cuối|\{date\}/i.test(l);

const privacyBoard = legal("privacy-board");
const termsBoard = legal("terms-board");

describe("board legal texts are supersets (plan M7, review focus 8)", () => {
  it.skipIf(privacyBoard === null)("docs/legal/privacy-board.md contains every line of privacy-m7.md (with the OAuth wording) except listed replacements", () => {
    const board = new Set(linesOf(privacyBoard!));
    for (const line of linesOf(legal("privacy-m7")!)) {
      if (isDateLine(line) || REPLACED_PRIVACY.includes(line)) continue;
      expect(board.has(line), `missing from privacy-board.md: ${line}`).toBe(true);
    }
  });

  it.skipIf(termsBoard === null)("docs/legal/terms-board.md contains every line of terms.md (with the OAuth paragraph) except listed replacements", () => {
    const board = new Set(linesOf(termsBoard!));
    for (const line of linesOf(legal("terms")!)) {
      if (isDateLine(line) || REPLACED_TERMS.includes(line)) continue;
      expect(board.has(line), `missing from terms-board.md: ${line}`).toBe(true);
    }
  });

  it("the sources it compares exist, so a rename cannot turn the checks into no-ops", () => {
    expect(legal("privacy-m7")).not.toBeNull();
    expect(legal("terms")).not.toBeNull();
    expect(legal("terms")).toMatch(/Google, GitHub or LinkedIn/);
  });
});
