import { jsx } from "hono/jsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";
import { Layout } from "../../src/views/Layout.tsx";
import { withPrivacyNoticeRequest } from "../../src/views/privacy-notice.tsx";
import { signIn } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

const app = createApp();
const M7 = "2026-10-21";
const BOARD = "2026-11-10"; // board window [2026-10-27, 2026-12-11)
const env = (over: Record<string, string | undefined>) => ({ ...testEnv, ...over }) as Bindings;
const page = async (path: string, cookie: string | undefined, e: Bindings) => (await app.request(getReq(path, cookie), undefined, e)).text();
const count = (h: string, n: string) => h.split(n).length - 1;
const NOTICE = 'data-privacy-notice="true"';
const BOARD_NOTICE = 'data-notice-id="board"';
const M7_NOTICE = 'data-notice-id="m7"';
const SCRIPT = '<script src="/assets/privacy-notice.js" defer=""></script>';
const freeze = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
const APPROVED_EN = "From October 27, 2026 you can choose to show a request on a public request board. Requests stay private unless you choose this for each one; nothing changes for requests you have already posted.";

afterEach(() => vi.useRealTimers());

describe("board notice window [REQUEST_BOARD_GO_LIVE - 14 days, + 31 days), signed-in only", () => {
  it.each([
    ["2026-10-26T23:59:59.999Z", false],
    ["2026-10-27T00:00:00.000Z", true],
    ["2026-12-10T23:59:59.999Z", true],
    ["2026-12-11T00:00:00.000Z", false],
  ] as const)("at %s: %s", async (iso, shown) => {
    freeze(iso);
    const { cookie } = await signIn(`board-notice-${iso.replace(/\D/g, "")}@vnx.si`);
    const e = env({ REQUEST_BOARD_GO_LIVE: BOARD });
    const html = await page("/products", cookie, e);
    expect(html.includes(BOARD_NOTICE)).toBe(shown);
    expect(html.includes(SCRIPT)).toBe(shown);
    expect(await page("/products", undefined, e)).not.toContain(NOTICE);
  });

  it("shows nothing for an empty, unset or malformed board date, and adds no script", async () => {
    freeze("2026-11-10T00:00:00Z");
    const { cookie } = await signIn("board-notice-bad@vnx.si");
    for (const value of ["", undefined, "2026-02-30", "soon"]) {
      const html = await page("/products", cookie, env({ REQUEST_BOARD_GO_LIVE: value }));
      expect(html, String(value)).not.toContain(NOTICE);
      expect(html, String(value)).not.toContain("privacy-notice.js");
    }
  });

  it("uses the Owner-approved sentence (OP-2a) verbatim in EN, links /privacy, and carries the board date", async () => {
    freeze("2026-11-10T00:00:00Z");
    const { cookie } = await signIn("board-notice-en@vnx.si");
    const html = await page("/products", cookie, env({ REQUEST_BOARD_GO_LIVE: BOARD }));
    const body = html.replace(/<[^>]*>/g, "").replace(/&#39;/g, "'").replace(/\s+/g, " ");
    expect(body).toContain(APPROVED_EN.replace("October 27, 2026", "November 10, 2026"));
  });
});

describe("two notices", () => {
  it("both show when both windows overlap, board second; one script; M7 key and board key are separate attributes", async () => {
    freeze("2026-11-01T00:00:00Z");
    const { cookie } = await signIn("board-notice-both@vnx.si");
    const html = await page("/products", cookie, env({ PRIVACY_NOTICE_GO_LIVE: M7, REQUEST_BOARD_GO_LIVE: BOARD }));
    expect(count(html, NOTICE)).toBe(2);
    expect(html.indexOf(M7_NOTICE)).toBeGreaterThan(-1);
    expect(html.indexOf(M7_NOTICE)).toBeLessThan(html.indexOf(BOARD_NOTICE));
    expect(count(html, SCRIPT)).toBe(1);
  });

  it("the M7 notice alone stays exactly as before (one notice, M7 id)", async () => {
    freeze("2026-10-20T00:00:00Z");
    const { cookie } = await signIn("board-notice-m7only@vnx.si");
    const html = await page("/products", cookie, env({ PRIVACY_NOTICE_GO_LIVE: M7 }));
    expect(count(html, NOTICE)).toBe(1);
    expect(html).toContain(M7_NOTICE);
    expect(html).not.toContain(BOARD_NOTICE);
  });

  it("M7 window over, board window on: only the board notice", async () => {
    freeze("2026-11-25T00:00:00Z");
    const { cookie } = await signIn("board-notice-boardonly@vnx.si");
    const html = await page("/products", cookie, env({ PRIVACY_NOTICE_GO_LIVE: M7, REQUEST_BOARD_GO_LIVE: BOARD }));
    expect(count(html, NOTICE)).toBe(1);
    expect(html).toContain(BOARD_NOTICE);
  });
});

describe("the outer Layout keeps the board gate while page() provides the notice context (2705b obligation)", () => {
  const props = { locale: "en", title: "t", origin: "https://vnx.si", rest: "/", signedIn: true, children: null } as const;
  it("the context carries the board date; without it no board notice", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    expect(String(withPrivacyNoticeRequest({ goLive: undefined, boardGoLive: BOARD, now }, jsx(Layout, props)))).toContain(BOARD_NOTICE);
    expect(String(withPrivacyNoticeRequest({ goLive: undefined, now }, jsx(Layout, props)))).not.toContain(BOARD_NOTICE);
  });
});

describe("localized board message", () => {
  it.each(LOCALES)("%s has the board message, a real date placeholder, and the approved EN / VI wording", (locale) => {
    const msg = t(locale, "privacyNotice.boardMessage", { date: "DATE" });
    expect(msg).toContain("DATE");
    if (locale === "vi") expect(msg).toBe("Từ DATE, bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai. Nhu cầu vẫn riêng tư trừ khi bạn chọn công khai cho từng nhu cầu; các nhu cầu bạn đã đăng không thay đổi.");
    if (locale === "en") expect(msg).toBe("From DATE you can choose to show a request on a public request board. Requests stay private unless you choose this for each one; nothing changes for requests you have already posted.");
  });
  it("links the localized privacy page", async () => {
    freeze("2026-11-10T00:00:00Z");
    const { cookie } = await signIn("board-notice-vi@vnx.si");
    const html = await page("/vi/products", cookie, env({ REQUEST_BOARD_GO_LIVE: BOARD }));
    expect(html).toContain(`href="${localizedPath("vi", "/privacy")}"`);
  });
});
