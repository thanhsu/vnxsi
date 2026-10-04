import type { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { LEGAL, type LegalPageId } from "../legal/content.ts";
import { LegalPage } from "../views/LegalPage.tsx";
import { page } from "../views/render.ts";

/** /terms, /privacy and /media-kit in every locale (VNX-0705a). */
export function registerLegalRoutes(app: Hono<AppEnv>) {
  for (const id of Object.keys(LEGAL) as LegalPageId[]) {
    onLocalized(app, "get", LEGAL[id].rest, (c) =>
      page(c, <LegalPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} id={id} />),
    );
  }
}
