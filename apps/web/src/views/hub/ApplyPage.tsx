import type { FC } from "hono/jsx";
import type { BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { Layout } from "../Layout.tsx";
import { BuilderForm, builderErrorItems } from "./BuilderForm.tsx";

export type InviteNotice = "valid" | "invalid" | null;

export const ApplyPage: FC<{ locale: Locale; origin: string; values: BuilderFormValues; errors: FieldErrors; invite: InviteNotice }> = (p) => {
  const tr = translator(p.locale);
  return (
    <Layout locale={p.locale} title={tr("apply.title")} origin={p.origin} rest="/hub/apply" noindex signedIn invalid={builderErrorItems(p.errors, tr).length > 0}>
      <section class="card wide">
        <h1>{tr("apply.title")}</h1>
        <p>{tr("apply.intro")}</p>
        {p.invite === "valid" ? (
          <p class="notice good" role="status">
            {tr("apply.invite.valid")}
          </p>
        ) : null}
        {p.invite === "invalid" ? (
          <p class="notice" role="status">
            {tr("apply.invite.invalid")}
          </p>
        ) : null}
        <BuilderForm locale={p.locale} action={localizedPath(p.locale, "/hub/apply")} values={p.values} errors={p.errors} submitLabel={tr("apply.submit")} />
      </section>
    </Layout>
  );
};
