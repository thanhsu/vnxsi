import type { FC } from "hono/jsx";
import type { Builder } from "../../domain/builder.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { STATUS_BODY_KEY, STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

export const OverviewPage: FC<{ locale: Locale; origin: string; builder: Builder }> = ({ locale, origin, builder }) => {
  const tr = translator(locale);
  return (
    <HubLayout locale={locale} origin={origin} title={tr("hub.nav.overview")} rest="/hub" active="overview">
      <section class="card wide">
        <h1>{tr("hub.title")}</h1>
        <p>
          {tr("hub.status.label")}: <span class={`badge badge-${builder.status}`}>{tr(STATUS_KEY[builder.status])}</span>
        </p>
        <p>{tr(STATUS_BODY_KEY[builder.status])}</p>
        {builder.status === "approved" ? (
          <p>
            <a href={localizedPath(locale, `/b/${builder.handle}`)}>{tr("hub.viewPublic")}</a>
          </p>
        ) : null}
        {builder.status === "rejected" ? (
          <>
            {builder.reviewNote ? (
              <div class="notice">
                <p>{tr("hub.reviewNote")}</p>
                <PlainText text={builder.reviewNote} />
              </div>
            ) : null}
            <p>
              <a href={localizedPath(locale, "/hub/profile")}>{tr("profile.title")}</a>
            </p>
            <form method="post" action={localizedPath(locale, "/hub/resubmit")}>
              <button class="btn" type="submit">
                {tr("hub.resubmit")}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </HubLayout>
  );
};
