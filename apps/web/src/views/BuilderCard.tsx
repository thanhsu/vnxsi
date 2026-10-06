import type { FC } from "hono/jsx";
import type { DirectoryEntry } from "../domain/directory.ts";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { countryName } from "./country.ts";
import { formatUsd } from "./format.ts";
import { AVAILABILITY_KEY, KIND_KEY } from "./labels.ts";

const MAX_SKILLS = 6;

/** A directory card (spec §5.2). `heading` is h2 on the directory; a page that already has an h2 above uses h3. */
export const BuilderCard: FC<{ locale: Locale; entry: DirectoryEntry; heading?: "h2" | "h3" }> = ({ locale, entry: e, heading = "h2" }) => {
  const tr = translator(locale);
  const Heading = heading;
  return (
    <li>
      <Heading>
        <a href={localizedPath(locale, `/b/${e.handle}`)}>{e.name}</a>
      </Heading>
      <p>{e.headline}</p>
      <p class="muted">
        {tr(KIND_KEY[e.kind])} · {countryName(locale, e.country)}
      </p>
      <p>
        <span class={`badge badge-avail-${e.availability}`}>{tr(AVAILABILITY_KEY[e.availability])}</span>
        {e.hourlyRateCents !== null ? <span class="rate">{tr("bprofile.rate", { amount: formatUsd(locale, e.hourlyRateCents) })}</span> : null}
      </p>
      {e.skills.length > 0 ? (
        <ul class="chips">
          {e.skills.slice(0, MAX_SKILLS).map((s) => (
            <li>{s}</li>
          ))}
        </ul>
      ) : null}
      <p class="muted">{tr("directory.products", { n: e.publishedCount })}</p>
    </li>
  );
};
