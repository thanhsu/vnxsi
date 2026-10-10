import type { Context, Hono } from "hono";
import type { Child } from "hono/jsx";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { firstPublicProducts } from "../db/catalog.ts";
import { addClientSignup } from "../db/waitlist.ts";
import { externalReferrerHost, parseWaitlistForm, refHost, siteHosts, utmFrom, type Utm } from "../domain/waitlist-input.ts";
import type { AppEnv } from "../env.ts";
import { onLocalized } from "../http/localized.ts";
import { siteOrigin } from "../http/origin.ts";
import { hitRateLimit } from "../http/rate-limit.ts";
import { turnstileSiteKey } from "../http/turnstile.ts";
import { localizedPath } from "../i18n/locales.ts";
import { LandingPage, type LandingForm } from "../views/LandingPage.tsx";
import { DECK_SIZE } from "../views/landing/Deck.tsx";
import { page } from "../views/render.ts";
import { homeBlocks } from "./home.tsx";

const HOUR = 3600;
/** Same level as an inquiry (spec §8.2): 10 per IP per hour. */
const WAITLIST_PER_IP = 10;

type RenderOpts = { joined: boolean; utm: Utm; referrer: string | null; form?: LandingForm; asked?: boolean; below?: Promise<Child | null> };

async function renderLanding(c: Context<AppEnv>, opts: RenderOpts, status: ContentfulStatusCode = 200) {
  // Real products replace the category cards only once DECK_SIZE are public (plan VNX-0709 §6).
  const [deck, below] = await Promise.all([firstPublicProducts(c.env.DB, DECK_SIZE), opts.below ?? null]);
  return page(
    c,
    <LandingPage
      locale={c.get("locale")}
      origin={siteOrigin(c)}
      signedIn={c.get("user") !== null}
      joined={opts.joined}
      utm={opts.utm}
      referrer={opts.referrer}
      form={opts.form}
      deck={deck}
      below={below}
      ask={{ asked: opts.asked === true, siteKey: turnstileSiteKey(c.env), email: c.get("user")?.email ?? "" }}
    />,
    status,
  );
}

function hostsOf(c: Context<AppEnv>): string[] {
  return siteHosts(new URL(siteOrigin(c)).hostname, new URL(c.req.url).hostname);
}

export function registerLandingRoutes(app: Hono<AppEnv>) {
  // The visitor's source is only visible here: the POST always comes from this page, so the host travels in `ref`.
  onLocalized(app, "get", "/", (c) =>
    renderLanding(c, {
      joined: c.req.query("joined") === "1",
      asked: c.req.query("asked") === "1",
      utm: utmFrom(c.req.query()),
      referrer: externalReferrerHost(c.req.header("referer"), hostsOf(c)),
      below: homeBlocks(c),
    }),
  );

  onLocalized(app, "post", "/waitlist", async (c) => {
    const locale = c.get("locale");
    const done = `${localizedPath(locale, "/")}?joined=1#notify`;
    const body = await c.req.parseBody();
    const hosts = hostsOf(c);
    const parsed = parseWaitlistForm(body, hosts);
    // A bot gets the same answer as a person, so it has no reason to retry.
    if (!parsed.ok && parsed.spam) return c.redirect(done, 303);
    const carried = { utm: utmFrom(body), referrer: refHost(body.ref, hosts) };
    if (!parsed.ok) {
      return renderLanding(c, { joined: false, ...carried, form: { email: parsed.email, consent: parsed.consent, errors: parsed.errors } }, 400);
    }

    const { entry } = parsed;
    const now = new Date();
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const limit = await hitRateLimit(c.env.DB, `waitlist:ip:${ip}`, WAITLIST_PER_IP, HOUR, now.getTime());
    if (!limit.allowed) {
      return renderLanding(c, { joined: false, ...carried, form: { email: entry.email, consent: true, rateLimited: true } }, 429);
    }

    const country = c.req.raw.cf?.country;
    await addClientSignup(c.env.DB, { ...entry, lang: locale, country: typeof country === "string" ? country : null }, now.toISOString());
    // Known and new emails get the same redirect: the response never tells who already signed up.
    return c.redirect(done, 303);
  });
}
