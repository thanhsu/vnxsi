import { describe, expect, it } from "vitest";
import { parsePrivacyNoticeDate } from "../../src/domain/privacy-notice.ts";
import { BOARD_LEGAL } from "../../src/legal/content.ts";
import { testEnv } from "../helpers.ts";

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

  it("REQUEST_BOARD_GO_LIVE, when set, is at least 2026-10-21 (EPIC 27: M7 date and the first possible 14-day notice)", () => {
    const board = config.vars.REQUEST_BOARD_GO_LIVE!;
    if (board !== "") expect(parsePrivacyNoticeDate(board)!.getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 9, 21));
  });

  it("the Vitest bindings pin both go-live dates to empty, so no test depends on the calendar", () => {
    expect(testEnv.REQUEST_BOARD_GO_LIVE).toBe("");
    expect(testEnv.PRIVACY_NOTICE_GO_LIVE).toBe("");
  });

  it("has no secret in vars", () => {
    for (const key of Object.keys(config.vars)) expect(key, key).not.toMatch(/SECRET|TOKEN|API_KEY|SALT|PASSWORD/);
  });

  it("ANALYTICS_SALT is a secret, never a var", () => {
    expect(Object.keys(config.vars)).not.toContain("ANALYTICS_SALT");
  });
});

// EPIC 27 (plan M7): the board versions of Privacy and Terms must contain every line of the versions they replace, OAuth wording of
// VNX-2607 included, except the lines listed here as replaced on purpose. The board files exist since VNX-2707b, so neither check is skipped.
const LEGAL = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const legal = (name: string): string | null => {
  const hit = Object.entries(LEGAL).find(([file]) => file.endsWith(`/docs/legal/${name}.md`));
  return hit ? hit[1].replace(/\r\n/g, "\n") : null;
};
const plainLine = (line: string) => line.replace(/^#+ /, "").replace(/^- /, "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
/** Only the `## EN` and `## VI` texts: the file header and the Owner notes after them are not part of what the page shows. */
const textsOf = (md: string) =>
  ["EN", "VI"]
    .map((lang) => {
      const body = md.slice(md.indexOf(`\n## ${lang}\n`) + `\n## ${lang}\n`.length);
      const end = body.indexOf("\n---");
      return end < 0 ? body : body.slice(0, end);
    })
    .join("\n");
const linesOf = (md: string) => textsOf(md).split("\n").map(plainLine).filter((l) => l !== "");
/** Lines that differ on purpose. VNX-2707b lists here the exact old lines the board text replaces (addendum §12.2 second bullet of section 4, §12.3). "Last updated" lines carry the date. */
// Exactly the privacy-m7.md lines that privacy-board.md replaces (addendum 12.2 and 12.6): the Requests bullet (country added) and the clients-email bullet of section 4 (the "second bullet" of the
// addendum, now after the OAuth bullets), each in EN and VI. Every other line of privacy-m7.md must still be in the board text.
const REPLACED_PRIVACY: string[] = [
  "Requests: when you post a request, the name you type, the title, the description, the category, your budget range, an optional deadline and the languages you want to work in. If you are not signed in, we also take your email address and create an account for it; nothing is reviewed until you confirm that email.",
  "Builders do not see clients' email addresses. A builder sees the name you typed, your messages, your budget range and deadline; a builder invited to your request also sees the request.",
  "Nhu cầu (request): khi bạn đăng nhu cầu, tên bạn gõ, tiêu đề, mô tả, danh mục, khoảng ngân sách, hạn chót (nếu có) và các ngôn ngữ bạn muốn làm việc. Nếu bạn chưa đăng nhập, chúng tôi lấy thêm email và tạo tài khoản cho email đó; nhu cầu chưa được xem xét cho tới khi bạn xác nhận email.",
  "Builder không thấy email của client. Builder thấy tên bạn gõ, các tin nhắn, khoảng ngân sách và hạn chót; builder được mời vào nhu cầu của bạn thấy thêm nhu cầu đó.",
];
// Terms 12.3 only adds a bullet and a paragraph in sections 5, 6 and 7: no line of terms.md is replaced, so the list stays empty.
const REPLACED_TERMS: string[] = [];
const isDateLine = (l: string) => /last updated|cập nhật lần cuối|\{date\}/i.test(l);

const privacyBoard = legal("privacy-board");
const termsBoard = legal("terms-board");

describe("board legal texts are supersets (plan M7, review focus 8)", () => {
  it("docs/legal/privacy-board.md contains every line of privacy-m7.md (with the OAuth wording) except listed replacements", () => {
    expect(privacyBoard, "docs/legal/privacy-board.md must exist").not.toBeNull();
    const board = new Set(linesOf(privacyBoard!));
    for (const line of linesOf(legal("privacy-m7")!)) {
      if (isDateLine(line) || REPLACED_PRIVACY.includes(line)) continue;
      expect(board.has(line), `missing from privacy-board.md: ${line}`).toBe(true);
    }
  });

  it("docs/legal/terms-board.md contains every line of terms.md (with the OAuth paragraph) except listed replacements", () => {
    expect(termsBoard, "docs/legal/terms-board.md must exist").not.toBeNull();
    const board = new Set(linesOf(termsBoard!));
    for (const line of linesOf(legal("terms")!)) {
      if (isDateLine(line) || REPLACED_TERMS.includes(line)) continue;
      expect(board.has(line), `missing from terms-board.md: ${line}`).toBe(true);
    }
  });

  it("every listed replacement is a real line of the old text and is gone from the board text (no stale entry)", () => {
    const m7 = new Set(linesOf(legal("privacy-m7")!));
    const board = new Set(linesOf(privacyBoard!));
    expect(REPLACED_PRIVACY.length).toBe(4);
    for (const line of REPLACED_PRIVACY) {
      expect(m7.has(line), `not in privacy-m7.md: ${line}`).toBe(true);
      expect(board.has(line), `still in privacy-board.md: ${line}`).toBe(false);
    }
    const terms = new Set(linesOf(legal("terms")!));
    for (const line of REPLACED_TERMS) expect(terms.has(line), line).toBe(true);
  });

  it("the sources it compares exist, so a rename cannot turn the checks into no-ops", () => {
    expect(legal("privacy-m7")).not.toBeNull();
    expect(legal("terms")).not.toBeNull();
    expect(legal("terms")).toMatch(/Google, GitHub or LinkedIn/);
  });
});

// 2707a F1: the board date switches /privacy and /terms by itself, so the board texts must be registered, in both languages, with board wording, whenever the date is set.
describe("REQUEST_BOARD_GO_LIVE requires the registered board texts (VNX-2707a F1)", () => {
  const wording = { en: /public request board/i, vi: /bảng nhu cầu công khai/i } as const;
  const registered = (docs: { en: unknown; vi: unknown } | null, label: string) => {
    expect(docs, `BOARD_LEGAL.${label} must not be null`).not.toBeNull();
    expect(JSON.stringify(docs!.en), `${label} EN`).toMatch(wording.en);
    expect(JSON.stringify(docs!.vi), `${label} VI`).toMatch(wording.vi);
  };

  it("a non-empty REQUEST_BOARD_GO_LIVE in wrangler.jsonc needs BOARD_LEGAL.privacy and .terms, non-null and with board wording", () => {
    if (config.vars.REQUEST_BOARD_GO_LIVE === "") return;
    registered(BOARD_LEGAL.privacy, "privacy");
    registered(BOARD_LEGAL.terms, "terms");
  });

  it("the texts are registered now, so setting the date never exposes a null text (VNX-2707b)", () => {
    registered(BOARD_LEGAL.privacy, "privacy");
    registered(BOARD_LEGAL.terms, "terms");
  });
});
