import type { FC } from "hono/jsx";
import { FLAG_KEYS, type FlagKey, type FlagState } from "../../domain/flags.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";

const DESC: Record<FlagKey, MessageKey> = {
  affiliate: "flags.desc.affiliate",
  partner_referral: "flags.desc.partner_referral",
  sponsored_listings: "flags.desc.sponsored_listings",
  ads: "flags.desc.ads",
  lead_generation: "flags.desc.lead_generation",
  ai_content: "flags.desc.ai_content",
  content_indexing: "flags.desc.content_indexing",
  oauth_google: "flags.desc.oauth_google",
  oauth_github: "flags.desc.oauth_github",
  oauth_linkedin: "flags.desc.oauth_linkedin",
};

export const FlagsPage: FC<{ locale: Locale; origin: string; flags: FlagState; done: boolean }> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("flags.title")} rest="/admin/flags" active="flags">
      <h1>{tr("flags.title")}</h1>
      <p>{tr("flags.intro")}</p>
      <p class="muted">{tr("flags.cacheNote")}</p>
      {p.done ? (
        <p class="notice good" role="status">
          {tr("flags.done")}
        </p>
      ) : null}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>{tr("flags.col.flag")}</th>
              <th>{tr("flags.col.state")}</th>
              <th>{tr("flags.col.what")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {FLAG_KEYS.map((key) => {
              const on = p.flags[key];
              return (
                <tr>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>{on ? tr("flags.on") : tr("flags.off")}</td>
                  <td>{tr(DESC[key])}</td>
                  <td>
                    <form method="post" action={localizedPath(p.locale, `/admin/flags/${key}`)}>
                      <input type="hidden" name="enabled" value={on ? "0" : "1"} />
                      <button class="btn" type="submit" data-state={on ? "on" : "off"}>
                        {on ? tr("flags.turnOff") : tr("flags.turnOn")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};
