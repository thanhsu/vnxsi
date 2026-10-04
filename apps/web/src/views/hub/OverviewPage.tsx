import type { FC } from "hono/jsx";
import type { Builder } from "../../domain/builder.ts";
import { PRODUCT_STATUSES, type ProductStatus } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { PRODUCT_STATUS_KEY, STATUS_BODY_KEY, STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

export const OverviewPage: FC<{ locale: Locale; origin: string; builder: Builder; productCounts: Partial<Record<ProductStatus, number>> }> = ({ locale, origin, builder, productCounts }) => {
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
      <section class="card wide">
        <h2>{tr("hub.products.title")}</h2>
        {Object.keys(productCounts).length === 0 ? (
          <p class="muted">{tr("products.empty")}</p>
        ) : (
          <ul>
            {PRODUCT_STATUSES.filter((s) => productCounts[s]).map((s) => (
              <li>
                {tr(PRODUCT_STATUS_KEY[s])}: {productCounts[s]}
              </li>
            ))}
          </ul>
        )}
        <p>
          <a href={localizedPath(locale, "/hub/products")}>{tr("hub.products.manage")}</a>
        </p>
      </section>
    </HubLayout>
  );
};
