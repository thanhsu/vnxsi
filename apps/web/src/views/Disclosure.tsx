import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";

/** Addendum §3.4: the sentence that must sit next to partner links, plus the link to /disclosure. Shared by every page that shows such links. */
export const DisclosureNote: FC<{ locale: Locale }> = ({ locale }) => {
  const tr = translator(locale);
  return (
    <p class="notice" data-disclosure="partner-links">
      {tr("disclosure.note")} <a href={localizedPath(locale, "/disclosure")}>{tr("disclosure.learnMore")}</a>
    </p>
  );
};

/** /disclosure §3: the companies with an active partner program, from the database. The `lang` on the "none" line keeps it in the page's language inside the English-only text of zh-*; merchant names carry no `lang`. */
export const ActivePartners: FC<{ locale: Locale; partners: readonly { slug: string; name: string }[] }> = ({ locale, partners }) => {
  const tr = translator(locale);
  return (
    <div data-partners="active">
      {partners.length === 0 ? (
        <p lang={locale}>{tr("disclosure.noPartners")}</p>
      ) : (
        <ul>
          {partners.map((p) => (
            <li>
              <a href={localizedPath(locale, `/tools/${p.slug}`)}>{p.name}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
