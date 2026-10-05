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
