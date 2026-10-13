import { beforeEach, describe, expect, it } from "vitest";
import { countOpenPublicationsAll } from "../../src/db/request-board.ts";
import { MIN_OPEN_FOR_INDEX } from "../../src/domain/request-board.ts";
import { LOCALES, localizedPath } from "../../src/i18n/locales.ts";
import { testEnv } from "../helpers.ts";
import { app, boardEnv, boardFlag, listed, tag } from "../public/request-board-helpers.ts";
import { getReq } from "../helpers.ts";

// VNX-2705b (addendum §8, L7): the sitemap lists open listings only, behind the full gate (flag AND date).
const sitemap = async (env = boardEnv) => (await app().request(getReq("/sitemap.xml"), undefined, env)).text();
const old = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

beforeEach(() => boardFlag(true));

describe("/sitemap.xml request board entries", () => {
  it("lists an open listing in 4 locales with hreflang alternates and lastmod = the publication's updated_at; nothing private", async () => {
    const t = tag();
    const l = await listed({ tag: t, publicTitle: `Sitemap title ${t}` });
    await testEnv.DB.prepare("UPDATE request_publications SET updated_at = '2026-03-04T05:06:07.000Z' WHERE public_id = ?1").bind(l.publicId).run();
    const xml = await sitemap();
    const alts = [
      `<xhtml:link rel="alternate" hreflang="en" href="https://vnx.si/requests/${l.publicId}"/>`,
      `<xhtml:link rel="alternate" hreflang="vi" href="https://vnx.si/vi/requests/${l.publicId}"/>`,
      `<xhtml:link rel="alternate" hreflang="zh-Hans" href="https://vnx.si/zh-hans/requests/${l.publicId}"/>`,
      `<xhtml:link rel="alternate" hreflang="zh-Hant" href="https://vnx.si/zh-hant/requests/${l.publicId}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="https://vnx.si/requests/${l.publicId}"/>`,
    ].join("");
    for (const locale of LOCALES) {
      const loc = `https://vnx.si${localizedPath(locale, `/requests/${l.publicId}`)}`;
      expect(xml, locale).toContain(`<url><loc>${loc}</loc><lastmod>2026-03-04</lastmod>${alts}</url>`);
    }
    for (const secret of [l.requestId, l.clientId, l.clientEmail, `Sitemap title ${t}`, l.ids.client, l.ids.original, l.ids.adminNote]) expect(xml, secret).not.toContain(secret);
  });

  it("does not list closed, pending_review, rejected, withdrawn, unpublished, removed or expired listings", async () => {
    const hidden = [
      await listed({ requestStatus: "closed", closedAt: old(1) }),
      await listed({ pubStatus: "pending_review" }),
      await listed({ pubStatus: "rejected" }),
      await listed({ pubStatus: "withdrawn" }),
      await listed({ pubStatus: "unpublished" }),
      await listed({ requestStatus: "removed" }),
      await listed({ requestStatus: "closed", closedAt: old(40) }),
    ];
    const xml = await sitemap();
    for (const h of hidden) expect(xml, h.publicId).not.toContain(h.publicId);
  });

  it("lists /requests (the list) once per locale only when isBoardIndexable, consistent with the count", async () => {
    // Counted before adding anything: this file's earlier tests left some open listings, so assert on the rule, not on a number.
    let have = await countOpenPublicationsAll(testEnv.DB);
    const listsBoard = (xml: string) => xml.includes("<loc>https://vnx.si/requests</loc>");
    expect(listsBoard(await sitemap()), `count ${have}`).toBe(have >= MIN_OPEN_FOR_INDEX);
    while (have < MIN_OPEN_FOR_INDEX) {
      await listed();
      have = await countOpenPublicationsAll(testEnv.DB);
    }
    const xml = await sitemap();
    for (const locale of LOCALES) expect(xml, locale).toContain(`<loc>https://vnx.si${localizedPath(locale, "/requests")}</loc>`);
  });

  it("flag off, or the go-live date empty or in the future (L7): no /requests entry at all", async () => {
    const l = await listed();
    while ((await countOpenPublicationsAll(testEnv.DB)) < MIN_OPEN_FOR_INDEX) await listed();
    expect(await sitemap()).toContain(l.publicId);
    for (const date of ["", "2999-01-01"]) {
      const xml = await sitemap({ ...testEnv, REQUEST_BOARD_GO_LIVE: date });
      expect(xml, date).not.toMatch(/\/requests/);
      expect(xml, date).not.toContain(l.publicId);
    }
    await boardFlag(false);
    const off = await sitemap();
    expect(off).not.toMatch(/\/requests/);
    expect(off).not.toContain(l.publicId);
  });
});
