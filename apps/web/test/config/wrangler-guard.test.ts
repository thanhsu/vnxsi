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

  it("ANALYTICS_SALT is a secret, never a var", () => {
    expect(Object.keys(config.vars)).not.toContain("ANALYTICS_SALT");
  });
});
