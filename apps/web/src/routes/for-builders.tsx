import type { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { ForBuildersPage } from "../views/ForBuildersPage.tsx";
import { page } from "../views/render.ts";

/** /for-builders (VNX-0705b): static copy, no database read. */
export function registerForBuildersRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/for-builders", (c) => page(c, <ForBuildersPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} />));
}
