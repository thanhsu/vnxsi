import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { LEGAL_UPDATED_AT } from "../../src/legal/content.ts";
import type { Bindings } from "../../src/env.ts";
import { testEnv } from "../helpers.ts";

const GO_LIVE = "2026-10-20";
const ENV = { ...testEnv, PRIVACY_NOTICE_GO_LIVE: GO_LIVE } as Bindings;
const SOURCES = import.meta.glob("../../../../docs/legal/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = async (path: string, env: Bindings = ENV) =>
  decode(/<main[^>]*>([\s\S]*)<\/main>/.exec(await (await createApp().request(new Request(`https://vnx.si${path}`), undefined, env)).text())?.[1] ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
const freeze = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};
const OLD_EN = "for now we do not link it to any visitor identifier";
const OLD_VI = "hiện chưa gắn nó với bất kỳ mã nhận diện người xem nào";

afterEach(() => vi.useRealTimers());

describe("/privacy version (Owner 2026-10-06 (i); Review Focus 8)", { timeout: 30_000 }, () => {
  it("before the notice window: the old text and the old date", async () => {
    freeze("2026-10-05T23:59:59.999Z");
    const en = await text("/privacy");
    expect(en).toContain(OLD_EN);
    expect(en).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
    expect(en).not.toContain("Visit counting");
    expect(en).not.toContain("__Host-vnx_vid");
    expect(await text("/vi/privacy")).toContain(OLD_VI);
  });

  it("from the first instant of the window: the new text with the go-live date, in EN, VI and the EN-only locales", async () => {
    freeze("2026-10-06T00:00:00.000Z");
    const en = await text("/privacy");
    for (const must of ["Visit counting", "__Host-vnx_vid", "Daily de-duplication records: deleted after 2 days.", "the random code described in section 5 (Cookies)", `Last updated: ${GO_LIVE}`]) expect(en, must).toContain(must);
    for (const gone of [OLD_EN, "the random code above", "We use only cookies that the site needs to work:"]) expect(en, gone).not.toContain(gone);
    const vi_ = await text("/vi/privacy");
    for (const must of ["Đếm lượt truy cập", "__Host-vnx_vid", "Bản ghi chống đếm trùng theo ngày: xóa sau 2 ngày.", "mã ngẫu nhiên nêu ở mục 5 (Cookie)", GO_LIVE]) expect(vi_, must).toContain(must);
    expect(vi_).not.toContain(OLD_VI);
    for (const path of ["/zh-hans/privacy", "/zh-hant/privacy"]) expect(await text(path), path).toContain("Visit counting");
  });

  it("stays on the new text long after go-live (the value is never cleared)", async () => {
    freeze("2027-06-01T00:00:00.000Z");
    expect(await text("/privacy")).toContain("Visit counting");
  });

  it("an unset, empty or malformed PRIVACY_NOTICE_GO_LIVE (and testEnv) keeps the old text", async () => {
    freeze("2026-10-20T00:00:00.000Z");
    for (const value of [undefined, "", "2026-02-30", "soon"]) {
      const out = await text("/privacy", { ...testEnv, PRIVACY_NOTICE_GO_LIVE: value } as Bindings);
      expect(out, String(value)).toContain(OLD_EN);
      expect(out, String(value)).toContain(`Last updated: ${LEGAL_UPDATED_AT}`);
    }
    expect(await text("/privacy", testEnv)).toContain(OLD_EN);
  });

  it("Terms and Disclosure keep LEGAL_UPDATED_AT while the new Privacy shows", async () => {
    freeze("2026-10-20T00:00:00.000Z");
    for (const path of ["/terms", "/disclosure", "/vi/terms"]) expect(await text(path), path).toContain(LEGAL_UPDATED_AT);
    expect(LEGAL_UPDATED_AT).toBe("2026-10-05");
  });

  it("docs/legal/privacy.md is the live text and still has the old sentence; privacy-m7.md has the new one and not the old", () => {
    const file = (name: string) => Object.entries(SOURCES).find(([f]) => f.endsWith(`/docs/legal/${name}.md`))?.[1] ?? "";
    expect(file("privacy")).toContain(OLD_EN);
    expect(file("privacy")).not.toContain("Visit counting");
    expect(file("privacy-m7")).toContain("Visit counting");
    expect(file("privacy-m7")).not.toContain(OLD_EN);
    expect(file("privacy-m7")).not.toContain(OLD_VI);
  });
});
