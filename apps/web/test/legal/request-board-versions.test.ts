import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Bindings } from "../../src/env.ts";
import { LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
import { testEnv } from "../helpers.ts";

// VNX-2707b: what /privacy and /terms serve with the real board text. The dates are env values per request (vitest.config.ts pins both go-live dates to empty).
const M7 = "2026-10-21"; // the production value of PRIVACY_NOTICE_GO_LIVE
const B = "2026-11-10"; // a board date at least 14 days after M7
const env = (m7: string | undefined, board: string | undefined) => ({ ...testEnv, PRIVACY_NOTICE_GO_LIVE: m7, REQUEST_BOARD_GO_LIVE: board }) as Bindings;
const PROD = env(M7, B);

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = async (path: string, e: Bindings): Promise<string> => {
  const res = await createApp().request(new Request(`https://vnx.si${path}`), undefined, e);
  expect(res.status, path).toBe(200);
  return decode(/<main[^>]*>([\s\S]*)<\/main>/.exec(await res.text())?.[1] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
};
const freeze = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
afterEach(() => vi.useRealTimers());

const BOARD_EN = [
  "Public requests: if you choose to show a request on our public request board",
  "Interest in public requests: if you are a builder",
  "For public requests we rely on your consent.",
  "When a builder tells us they are interested in a public request, only our team sees it. The client does not see it unless we invite that builder.",
];
const BOARD_VI = [
  "Nhu cầu công khai: nếu bạn chọn hiện một nhu cầu trên bảng nhu cầu công khai",
  "Quan tâm tới nhu cầu công khai: nếu bạn là builder",
  "Với nhu cầu công khai, căn cứ của chúng tôi là sự đồng ý của bạn.",
  "chỉ đội ngũ của chúng tôi thấy điều đó. Client không thấy, trừ khi chúng tôi mời builder đó.",
];
const TERMS_EN = ["Public requests. You can choose to show a request on our public request board.", "Try to identify the author of a public request"];
const TERMS_VI = ["Nhu cầu công khai. Bạn có thể chọn hiện một nhu cầu trên bảng nhu cầu công khai.", "Tìm cách nhận ra người đăng một nhu cầu công khai"];
const ANY_BOARD = /public request board|bảng nhu cầu công khai|Public requests|Nhu cầu công khai/;
const ENGLISH_APPLIES = "以英文版本为准";
const ENGLISH_APPLIES_HANT = "以英文版本為準";

describe("/privacy and /terms with the board text (VNX-2707b)", { timeout: 60_000 }, () => {
  it("before B - 14 days: no board wording on any page, Privacy is the M7 text dated M7, Terms the current text", async () => {
    freeze("2026-10-26T23:59:59.999Z");
    for (const path of ["/privacy", "/vi/privacy", "/zh-hans/privacy", "/zh-hant/privacy", "/terms", "/vi/terms", "/zh-hans/terms", "/zh-hant/terms"]) {
      expect(await text(path, PROD), path).not.toMatch(ANY_BOARD);
    }
    expect(await text("/privacy", PROD)).toContain(`Last updated: ${M7}`);
    expect(await text("/vi/privacy", PROD)).toContain(`Cập nhật lần cuối: ${M7}`);
    expect(await text("/terms", PROD)).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
  });

  it("from B - 14 days, EN: Privacy and Terms carry the board wording and Last updated: B", async () => {
    freeze("2026-10-27T00:00:00.000Z");
    const privacy = await text("/privacy", PROD);
    for (const s of BOARD_EN) expect(privacy, s).toContain(s);
    expect(privacy).toContain(`Last updated: ${B}`);
    expect(privacy).not.toContain(`Last updated: ${M7}`);
    expect(privacy).toContain("__Host-vnx_oauth");
    expect(privacy).toContain("Linked accounts:");
    const terms = await text("/terms", PROD);
    for (const s of TERMS_EN) expect(terms, s).toContain(s);
    expect(terms).toContain(`Last updated: ${B}`);
    expect(terms).toContain("link a Google, GitHub or LinkedIn account");
  });

  it("from B - 14 days, VI: the approved Vietnamese text and Cập nhật lần cuối: B", async () => {
    freeze("2026-10-27T00:00:00.000Z");
    const privacy = await text("/vi/privacy", PROD);
    for (const s of BOARD_VI) expect(privacy, s).toContain(s);
    expect(privacy).toContain(`Cập nhật lần cuối: ${B}`);
    expect(privacy).toContain("Tài khoản liên kết:");
    const terms = await text("/vi/terms", PROD);
    for (const s of TERMS_VI) expect(terms, s).toContain(s);
    expect(terms).toContain(`Cập nhật lần cuối: ${B}`);
  });

  it("zh-Hans and zh-Hant show the English board text and the English-applies sentence", async () => {
    freeze("2026-10-27T00:00:00.000Z");
    const hans = await text("/zh-hans/privacy", PROD);
    expect(hans).toContain(BOARD_EN[0]);
    expect(hans).toContain(ENGLISH_APPLIES);
    expect(hans).toContain(`最后更新：${B}`);
    const hant = await text("/zh-hant/terms", PROD);
    expect(hant).toContain(TERMS_EN[0]);
    expect(hant).toContain(ENGLISH_APPLIES_HANT);
    expect(hant).toContain(`最後更新：${B}`);
    expect(await text("/zh-hans/terms", PROD)).toContain(TERMS_EN[0]);
    expect(await text("/zh-hant/privacy", PROD)).toContain(BOARD_EN[0]);
  });

  it("never goes back after B: the board text and date stay, on the day of B and a year later", async () => {
    for (const iso of [`${B}T00:00:00.000Z`, "2026-12-31T00:00:00.000Z", "2027-11-10T00:00:00.000Z"]) {
      freeze(iso);
      for (const [path, wording, label] of [
        ["/privacy", BOARD_EN[0], `Last updated: ${B}`],
        ["/vi/privacy", BOARD_VI[0], `Cập nhật lần cuối: ${B}`],
        ["/terms", TERMS_EN[0], `Last updated: ${B}`],
        ["/vi/terms", TERMS_VI[0], `Cập nhật lần cuối: ${B}`],
      ] as const) {
        const out = await text(path, PROD);
        expect(out, `${iso} ${path}`).toContain(wording);
        expect(out, `${iso} ${path}`).toContain(label);
      }
    }
  });

  it("production-like: PRIVACY_NOTICE_GO_LIVE=2026-10-21 and a later board date show M7 first, then the board text, and Terms follow B alone", async () => {
    freeze("2026-10-10T00:00:00.000Z"); // M7 window open (from 2026-10-07), board window not yet
    const early = await text("/privacy", PROD);
    expect(early).toContain("Visit counting");
    expect(early).toContain(`Last updated: ${M7}`);
    expect(early).not.toMatch(ANY_BOARD);
    freeze("2026-10-26T23:59:59.999Z"); // after M7 - 14 days, before B - 14 days
    expect(await text("/privacy", PROD)).toContain(`Last updated: ${M7}`);
    expect(await text("/terms", PROD)).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
    freeze("2026-10-27T00:00:00.000Z"); // B - 14 days
    expect(await text("/privacy", PROD)).toContain(`Last updated: ${B}`);
    expect(await text("/terms", PROD)).toContain(`Last updated: ${B}`);
  });

  it("an empty or malformed REQUEST_BOARD_GO_LIVE keeps the previous texts, with no board wording", async () => {
    freeze("2030-01-01T00:00:00.000Z");
    for (const value of [undefined, "", "2026-02-30", "soon"]) {
      for (const path of ["/privacy", "/vi/privacy", "/terms", "/vi/terms"]) {
        expect(await text(path, env(M7, value)), `${String(value)} ${path}`).not.toMatch(ANY_BOARD);
      }
    }
    expect(await text("/privacy", env(M7, ""))).toContain(`Last updated: ${M7}`);
    expect(await text("/terms", env(M7, ""))).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
  });

  it("Disclosure and Media kit never change", async () => {
    freeze("2030-01-01T00:00:00.000Z");
    for (const path of ["/disclosure", "/media-kit"]) expect(await text(path, PROD), path).not.toMatch(ANY_BOARD);
  });
});
