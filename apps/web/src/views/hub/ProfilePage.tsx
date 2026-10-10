import type { FC } from "hono/jsx";
import { canChangeHandle, canEditProfile, type Builder } from "../../domain/builder.ts";
import type { BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import { PROVIDER_NAME, type UserIdentity } from "../../domain/identity.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { builderErrorItems, BuilderForm } from "./BuilderForm.tsx";
import { HubLayout } from "./HubLayout.tsx";

export const BADGE_NOTICES = ["shown", "hidden", "notLinked"] as const;
export type BadgeNotice = (typeof BADGE_NOTICES)[number];
type BadgeRow = Pick<UserIdentity, "provider" | "label" | "showOnProfile">;
const NOTICE_KEY = { shown: "hub.badges.notice.shown", hidden: "hub.badges.notice.hidden", notLinked: "hub.badges.notice.notLinked" } as const;

type Props = { locale: Locale; origin: string; builder: Builder; values: BuilderFormValues; errors: FieldErrors; saved: boolean; badges: BadgeRow[]; badgeNotice: BadgeNotice | null };

export const ProfilePage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("profile.title")} rest="/hub/profile" active="profile" invalid={builderErrorItems(p.errors, tr).length > 0}>
      <section class="card wide">
        <h1>{tr("profile.title")}</h1>
        {p.saved ? (
          <p class="notice good" role="status">
            {tr("profile.saved")}
          </p>
        ) : null}
        {canEditProfile(p.builder.status) ? (
          <BuilderForm
            locale={p.locale}
            action={localizedPath(p.locale, "/hub/profile")}
            values={p.values}
            errors={p.errors}
            submitLabel={tr("profile.save")}
            handleLocked={!canChangeHandle(p.builder.status)}
          />
        ) : (
          <p class="notice">{tr("hub.status.suspended.body")}</p>
        )}
      </section>
      {p.badges.length > 0 ? (
        <section class="card wide" id="badges">
          <h2>{tr("hub.badges.title")}</h2>
          <p>{tr("hub.badges.intro")}</p>
          {p.badgeNotice ? (
            <p class={p.badgeNotice === "notLinked" ? "notice" : "notice good"} role="status">
              {tr(NOTICE_KEY[p.badgeNotice])}
            </p>
          ) : null}
          {p.builder.status !== "approved" ? <p class="notice">{tr("hub.badges.notApproved")}</p> : null}
          <ul>
            {p.badges.map((b) => {
              const name = PROVIDER_NAME[b.provider];
              return (
                <li>
                  <strong>{name}</strong> · {tr(b.showOnProfile ? "hub.badges.on" : "hub.badges.off")}
                  <p class="muted">{b.provider === "github" ? tr("hub.badges.detail.github", { label: b.label }) : tr("hub.badges.detail.linkedin")}</p>
                  <form method="post" action={localizedPath(p.locale, `/hub/identities/${b.provider}/badge`)}>
                    <input type="hidden" name="show" value={b.showOnProfile ? "0" : "1"} />
                    <button type="submit" class="btn">
                      {tr(b.showOnProfile ? "hub.badges.hide" : "hub.badges.show", { provider: name })}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </HubLayout>
  );
};
