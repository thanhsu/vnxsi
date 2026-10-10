import type { FC } from "hono/jsx";
import { OAUTH_PROVIDERS, type OAuthProvider, PROVIDER_NAME, type UserIdentity } from "../../domain/identity.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";

/** The closed set of `/me?link=` results: the one source for the callback, the route and this view. */
export const LINK_NOTICES = ["ok", "taken", "hasProvider", "failed", "unlinked", "notLinked", "needsEmailLink"] as const;
export type LinkNotice = (typeof LINK_NOTICES)[number];

const NOTICE_KEY = {
  ok: "me.identities.notice.ok",
  taken: "me.identities.notice.taken",
  hasProvider: "me.identities.notice.hasProvider",
  failed: "me.identities.notice.failed",
  unlinked: "me.identities.notice.unlinked",
  notLinked: "me.identities.notice.notLinked",
  needsEmailLink: "me.identities.notice.needsEmailLink",
} as const;
const STATUS: readonly LinkNotice[] = ["ok", "unlinked", "notLinked", "needsEmailLink"]; // told, not warned: only failed, taken, hasProvider are alerts

/**
 * The owner's own page (ADR-012 §4): the providers that are linked or linkable (Owner 2026-10-08), nothing at all when there are none.
 * `label` is shown here and nowhere else. `linkable` is the flag-and-credentials rule decided by the route; a linked row shows whatever the flag says. A linked row always offers Unlink, whatever the flag says; the section stays for `unlinked`/`notLinked` even with no rows left.
 */
export const LinkedAccounts: FC<{ locale: Locale; identities: readonly UserIdentity[]; linkable: readonly OAuthProvider[]; notice?: LinkNotice; canLink: boolean }> = ({ locale, identities, linkable, notice, canLink }) => {
  const tr = translator(locale);
  const rows = OAUTH_PROVIDERS.filter((p) => identities.some((i) => i.provider === p) || linkable.includes(p));
  if (rows.length === 0 && notice !== "unlinked" && notice !== "notLinked") return null;
  return (
    <section id="identities">
      <h2>{tr("me.identities.title")}</h2>
      {notice ? (
        <p class={notice === "ok" ? "notice good" : "notice"} role={STATUS.includes(notice) ? "status" : "alert"}>
          {tr(NOTICE_KEY[notice])}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <>
      <p class="muted">{tr("me.identities.intro")}</p>
      {!canLink && notice !== "needsEmailLink" && rows.some((p) => linkable.includes(p) && !identities.some((i) => i.provider === p)) ? <p class="muted">{tr("me.identities.emailToLink")}</p> : null}
      <div class="table-wrap">
        <table class="data">
          <tbody>
            {rows.map((provider) => {
              const name = PROVIDER_NAME[provider];
              const linked = identities.find((i) => i.provider === provider);
              return (
                <tr>
                  <td>{name}</td>
                  <td>
                    {linked ? tr("me.identities.linked") : tr("me.identities.notLinked")}
                    {linked && linked.label !== name ? <span class="muted"> · {linked.label}</span> : null}
                  </td>
                  <td>
                    {linked ? (
                      <form method="post" action={localizedPath(locale, `/me/identities/${provider}/unlink`)}>
                        <button class="btn btn-ghost" type="submit">
                          {tr("me.identities.unlink", { provider: name })}
                        </button>
                      </form>
                    ) : canLink && linkable.includes(provider) ? (
                      <form method="post" action={localizedPath(locale, `/me/identities/${provider}/link`)}>
                        <button class="btn btn-ghost" type="submit">
                          {tr("me.identities.link", { provider: name })}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      ) : null}
    </section>
  );
};
