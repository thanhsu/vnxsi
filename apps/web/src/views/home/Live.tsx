import type { FC } from "hono/jsx";
import type { PublicLiveEvent } from "../../domain/public-stats.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { relativeTime } from "../format.ts";
import { BADGE_KEY, CATEGORY_KEY, LANGUAGE_KEY } from "../labels.ts";

const LiveItem: FC<{ locale: Locale; e: PublicLiveEvent }> = ({ locale, e }) => {
  const tr = translator(locale);
  switch (e.kind) {
    case "product_published":
      return <><strong>{tr("home.live.productPublished")}</strong> <a href={localizedPath(locale, `/p/${e.slug}`)}>{e.productName}</a></>;
    case "badge_granted":
      return <><strong>{tr("home.live.badgeGranted")}</strong> <span class={`chip chip-${e.badge}`}>{tr(BADGE_KEY[e.badge])}</span> <a href={localizedPath(locale, `/p/${e.slug}`)}>{e.productName}</a></>;
    case "builder_approved":
      return <><strong>{tr("home.live.builderApproved")}</strong> <a href={localizedPath(locale, `/b/${e.handle}`)}>{e.builderName}</a></>;
    case "request_new":
      return <><strong>{tr("home.live.requestNew")}</strong> <span>{tr(CATEGORY_KEY[e.category])}</span> <span class="muted">{e.languages.map((l) => tr(LANGUAGE_KEY[l])).join(" · ")}</span></>;
  }
};

/** A static list that home.js upgrades into a strip. Only what the snapshot holds: no request title, no client, no e-mail. */
export const Live: FC<{ locale: Locale; events: readonly PublicLiveEvent[]; now: Date }> = ({ locale, events, now }) => {
  const tr = translator(locale);
  return (
    <div class="home-live-wrap">
      <button type="button" class="home-motion-toggle" data-motion-toggle hidden aria-pressed="false">{tr("home.motion.pause")}</button>
      <ul class="home-live" data-marquee>
        {events.map((e) => (
          <li class="home-live-item">
            <time datetime={e.at}>{relativeTime(locale, e.at, now)}</time>
            <LiveItem locale={locale} e={e} />
          </li>
        ))}
      </ul>
    </div>
  );
};
