import type { FC } from "hono/jsx";
import { canChangeHandle, canEditProfile, type Builder } from "../../domain/builder.ts";
import type { BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { BuilderForm } from "./BuilderForm.tsx";
import { HubLayout } from "./HubLayout.tsx";

type Props = { locale: Locale; origin: string; builder: Builder; values: BuilderFormValues; errors: FieldErrors; saved: boolean };

export const ProfilePage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("profile.title")} rest="/hub/profile" active="profile">
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
    </HubLayout>
  );
};
