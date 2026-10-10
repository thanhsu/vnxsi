import { describe, expect, it } from "vitest";
import { LOCALES } from "../../src/i18n/locales.ts";
import { t, translator } from "../../src/i18n/t.ts";
import { FormErrorSummary } from "../../src/views/FormErrorSummary.tsx";
import { Layout } from "../../src/views/Layout.tsx";
import { expectErrorSummary } from "../helpers.ts";

// VNX-0807 AC6/AC7/AC8: the shared error pattern of server-rendered forms.
const page = async (locale: (typeof LOCALES)[number], invalid: boolean | undefined) =>
  String(
    await (
      <Layout locale={locale} title="Hire Ann · VNX.SI" origin="https://vnx.si" rest="/x" noindex invalid={invalid}>
        <input id="a" aria-invalid="true" />
        <input id="b" />
        <FormErrorSummary
          tr={translator(locale)}
          items={[
            { href: "#a", message: "A: bad" },
            { href: "", message: "Captcha failed" },
            { href: "#b", message: "B: <script>" },
          ]}
        />
      </Layout>
    ),
  );

describe("Layout invalid", () => {
  it("prefixes <title> in every locale, leaves og:title alone, and is unchanged without the prop", async () => {
    for (const locale of LOCALES) {
      const html = await page(locale, true);
      expect(html, locale).toContain(`<title>${t(locale, "form.error.titlePrefix")} Hire Ann · VNX.SI</title>`);
      expect(html, locale).toContain('<meta property="og:title" content="Hire Ann · VNX.SI"');
      const plain = await page(locale, undefined);
      expect(plain, locale).toContain("<title>Hire Ann · VNX.SI</title>");
    }
  });

  it("has the approved copy", () => {
    expect([t("en", "form.error.titlePrefix"), t("vi", "form.error.titlePrefix"), t("zh-Hans", "form.error.titlePrefix"), t("zh-Hant", "form.error.titlePrefix")]).toEqual(["Error:", "Lỗi:", "错误：", "錯誤："]);
    expect([t("en", "form.error.summaryTitle"), t("vi", "form.error.summaryTitle"), t("zh-Hans", "form.error.summaryTitle"), t("zh-Hant", "form.error.summaryTitle")]).toEqual([
      "There is a problem",
      "Có lỗi cần sửa",
      "有问题需要修正",
      "有問題需要修正",
    ]);
  });
});

describe("FormErrorSummary", () => {
  it("renders one focusable section with a heading, links to fields, an unlinked form-level item, and escapes text", async () => {
    const html = await page("en", true);
    const body = expectErrorSummary(html, ["a", "b"], { formLevel: 1 });
    expect(body).toContain("There is a problem");
    expect(body).toContain("<li>Captcha failed</li>");
    expect(body).toContain("B: &lt;script&gt;");
    expect(html).toContain('<html lang="en">');
  });

  it("uses the locale's heading and prefix", async () => {
    expectErrorSummary(await page("vi", true), ["a", "b"], { formLevel: 1, titlePrefix: "Lỗi:" });
    expect(await page("zh-Hant", true)).toContain("有問題需要修正");
  });

  it("renders nothing without items", async () => {
    expect(String(await (<FormErrorSummary tr={translator("en")} items={[]} />))).toBe("");
  });
});
