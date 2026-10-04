import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { addClientSignup } from "../db/waitlist.ts";
import { externalReferrerHost, parseWaitlistForm, utmFrom } from "../domain/waitlist-input.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { localizedPath } from "../i18n/locales.ts";
import { LandingPage, type LandingForm } from "../views/LandingPage.tsx";
import { page } from "../views/render.ts";

const HOUR = 3600;
/** Same level as an inquiry (spec §8.2): 10 per IP per hour. */
const WAITLIST_PER_IP = 10;

function renderLanding(c: Context<AppEnv>, opts: { joined: boolean; utm: ReturnType<typeof utmFrom>; form?: LandingForm }, status: ContentfulStatusCode = 200) {
  return page(
    c,
    <LandingPage locale={c.get("locale")} origin={siteOrigin(c)} signedIn={c.get("user") !== null} joined={opts.joined} utm={opts.utm} form={opts.form} />,
    status,
  );
}

export function registerLandingRoutes(app: Hono<AppEnv>) {
  onLocalized(app, "get", "/", (c) => renderLanding(c, { joined: c.req.query("joined") === "1", utm: utmFrom(c.req.query()) }));

  onLocalized(app, "post", "/waitlist", async (c) => {
    const locale = c.get("locale");
    const done = `${localizedPath(locale, "/")}?joined=1#notify`;
    const body = await c.req.parseBody();
    const parsed = parseWaitlistForm(body);
    // A bot gets the same answer as a person, so it has no reason to retry.
    if (!parsed.ok && parsed.spam) return c.redirect(done, 303);
    if (!parsed.ok) return renderLanding(c, { joined: false, utm: utmFrom(body), form: { email: parsed.email, errors: parsed.errors } }, 400);

    const { entry } = parsed;
    const now = new Date();
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const limit = await hitRateLimit(c.env.DB, `waitlist:ip:${ip}`, WAITLIST_PER_IP, HOUR, now.getTime());
    if (!limit.allowed) {
      return renderLanding(c, { joined: false, utm: utmFrom(body), form: { email: entry.email, rateLimited: true } }, 429);
    }

    const siteHosts = [new URL(c.req.url).hostname, new URL(siteOrigin(c)).hostname];
    const country = c.req.raw.cf?.country;
    await addClientSignup(
      c.env.DB,
      {
        ...entry,
        lang: locale,
        country: typeof country === "string" ? country : null,
        referrer: externalReferrerHost(c.req.header("referer"), siteHosts),
      },
      now.toISOString(),
    );
    // Known and new emails get the same redirect: the response never tells who already signed up.
    return c.redirect(done, 303);
  });
}
