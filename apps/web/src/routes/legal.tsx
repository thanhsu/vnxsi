import type { Hono } from "hono";
import { privacyVersion } from "../domain/privacy-notice.ts";
import { listActiveProgramMerchants } from "../db/merchants.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { DISCLOSURE_PARTNERS_SECTION, LEGAL, PRIVACY_M7, type LegalPageId } from "../legal/content.ts";
import { ActivePartners } from "../views/Disclosure.tsx";
import { LegalPage } from "../views/LegalPage.tsx";
import { page } from "../views/render.ts";

/** /terms, /privacy, /media-kit (VNX-0705a) and /disclosure (VNX-2104b) in every locale. Only /disclosure reads the database. */
export function registerLegalRoutes(app: Hono<AppEnv>) {
  for (const id of Object.keys(LEGAL) as LegalPageId[]) {
    onLocalized(app, "get", LEGAL[id].rest, async (c) => {
      const locale = c.get("locale");
      const extras =
        id === "disclosure"
          ? { [DISCLOSURE_PARTNERS_SECTION]: <ActivePartners locale={locale} partners={await listActiveProgramMerchants(c.env.DB)} /> }
          : undefined;
      const goLive = c.env.PRIVACY_NOTICE_GO_LIVE;
      const m7 = id === "privacy" && privacyVersion(goLive, new Date()) === "m7";
      return page(c, <LegalPage locale={locale} origin={siteOrigin(c)} signedIn={c.get("user") !== null} id={id} extras={extras} docs={m7 ? PRIVACY_M7 : undefined} updatedAt={m7 ? goLive : undefined} />);
    });
  }
}
