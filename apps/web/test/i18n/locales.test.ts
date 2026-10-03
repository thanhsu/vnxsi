import { describe, expect, it } from "vitest";
import { alternates, localeFromPath, localizedPath } from "../../src/i18n/locales.ts";
import { t } from "../../src/i18n/t.ts";

describe("locale paths", () => {
  it("detects locale prefixes exactly", () => {
    expect(localeFromPath("/")).toEqual({ locale: "en", rest: "/" });
    expect(localeFromPath("/login")).toEqual({ locale: "en", rest: "/login" });
    expect(localeFromPath("/vi")).toEqual({ locale: "vi", rest: "/" });
    expect(localeFromPath("/vi/")).toEqual({ locale: "vi", rest: "/" });
    expect(localeFromPath("/zh-hans/login")).toEqual({ locale: "zh-Hans", rest: "/login" });
    expect(localeFromPath("/zh-hant/p/x")).toEqual({ locale: "zh-Hant", rest: "/p/x" });
  });

  it("does not treat look-alike paths as locales", () => {
    expect(localeFromPath("/vietnam")).toEqual({ locale: "en", rest: "/vietnam" });
    expect(localeFromPath("/ZH-HANS/login")).toEqual({ locale: "en", rest: "/ZH-HANS/login" });
  });

  it("builds localized paths", () => {
    expect(localizedPath("en", "/login")).toBe("/login");
    expect(localizedPath("vi", "/login")).toBe("/vi/login");
    expect(localizedPath("vi", "/")).toBe("/vi/");
    expect(localizedPath("zh-Hant", "/")).toBe("/zh-hant/");
  });

  it("lists hreflang alternates including x-default", () => {
    const alts = alternates("https://vnx.si", "/login");
    expect(alts.map((a) => a.hreflang)).toEqual(["en", "vi", "zh-Hans", "zh-Hant", "x-default"]);
    expect(alts[1]).toEqual({ hreflang: "vi", href: "https://vnx.si/vi/login" });
    expect(alts[4]).toEqual({ hreflang: "x-default", href: "https://vnx.si/login" });
  });
});

describe("t()", () => {
  it("translates and interpolates", () => {
    expect(t("vi", "login.sent.body", { email: "a@b.vn" })).toContain("a@b.vn");
    expect(t("zh-Hans", "nav.signIn")).toBe("登录");
  });
});
