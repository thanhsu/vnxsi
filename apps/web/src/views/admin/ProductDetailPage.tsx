import type { FC } from "hono/jsx";
import type { Badge, PricingTier, ProductAction, ProductMedia, ProductWithBuilder } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { formatUsd } from "../format.ts";
import { BILLING_KEY, CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY, PRODUCT_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { AdminLayout } from "./AdminLayout.tsx";
import type { AdminNotice } from "./BuilderDetailPage.tsx";

export const BADGE_KEY: Record<Badge["kind"], MessageKey> = {
  listed: "badge.listed",
  demo_verified: "badge.demo_verified",
  in_production: "badge.in_production",
};

type Props = {
  locale: Locale;
  origin: string;
  item: ProductWithBuilder;
  tiers: PricingTier[];
  media: ProductMedia[];
  badges: Badge[];
  notice: AdminNotice;
  noteError?: ProductAction;
};

export const ProductDetailPage: FC<Props> = ({ locale, origin, item, tiers, media, badges, notice, noteError }) => {
  const tr = translator(locale);
  const p = item.product;
  const action = (name: ProductAction) => localizedPath(locale, `/admin/products/${p.id}/${name}`);
  const noteForm = (name: ProductAction, required: boolean, label: MessageKey, submit: MessageKey) => (
    <form method="post" action={action(name)} class="card">
      <div class="field">
        <label for={`${name}-note`}>{tr(label)}</label>
        <textarea
          id={`${name}-note`}
          name="note"
          maxlength={1000}
          required={required}
          aria-invalid={noteError === name ? "true" : undefined}
          aria-describedby={noteError === name ? `${name}-note-error` : undefined}
        ></textarea>
        {noteError === name ? (
          <p id={`${name}-note-error`} class="error-msg">
            {tr("admin.products.error.note")}
          </p>
        ) : null}
      </div>
      <button class="btn" type="submit">
        {tr(submit)}
      </button>
    </form>
  );
  return (
    <AdminLayout locale={locale} origin={origin} title={p.name} rest={`/admin/products/${p.id}`} active="products">
      <h1>
        {p.name} <span class={`badge badge-${p.status}`}>{tr(PRODUCT_STATUS_KEY[p.status])}</span>
      </h1>
      {notice === "done" ? (
        <p class="notice good" role="status">
          {tr("admin.done")}
        </p>
      ) : null}
      {notice === "mail_failed" ? (
        <p class="notice" role="alert">
          {tr("admin.products.mailFailed")}
        </p>
      ) : null}
      <p class="lead">{p.tagline}</p>
      <dl class="facts">
        <dt>{tr("admin.col.handle")}</dt>
        <dd>
          <a href={localizedPath(locale, `/admin/builders/${p.builderId}`)}>{item.builderHandle}</a> ({item.builderEmail})
        </dd>
        <dt>{tr("product.field.slug")}</dt>
        <dd>/p/{p.slug}</dd>
        <dt>{tr("product.field.category")}</dt>
        <dd>{p.category ? tr(CATEGORY_KEY[p.category]) : "—"}</dd>
        <dt>{tr("product.field.deliveryModel")}</dt>
        <dd>{p.deliveryModel ? tr(DELIVERY_KEY[p.deliveryModel]) : "—"}</dd>
        <dt>{tr("product.field.license")}</dt>
        <dd>{p.license ? tr(LICENSE_KEY[p.license]) : "—"}</dd>
        <dt>{tr("product.field.demoUrl")}</dt>
        <dd>
          {p.demoUrl ? (
            <a href={p.demoUrl} rel="nofollow ugc noopener" target="_blank">
              {p.demoUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      {media.length > 0 ? (
        <ul class="media-grid">
          {media.map((m) => (
            <li>
              <img src={`/media/${m.r2Key}`} alt={m.alt || p.name} width={160} loading="lazy" />
            </li>
          ))}
        </ul>
      ) : null}
      <h2>{tr("product.field.problem")}</h2>
      <PlainText text={p.problem} />
      <h2>{tr("product.field.targetUsers")}</h2>
      <PlainText text={p.targetUsers} />
      <h2>{tr("product.field.description")}</h2>
      <PlainText text={p.description} />
      <h2>{tr("product.field.features")}</h2>
      <ul>
        {p.features.map((f) => (
          <li>{f}</li>
        ))}
      </ul>
      <h2>{tr("product.step.pricing")}</h2>
      <ul>
        {tiers.map((t) => (
          <li>
            {t.name}: {t.priceCents === null ? tr(BILLING_KEY.contact) : `${formatUsd(locale, t.priceCents)} · ${tr(BILLING_KEY[t.billing])}`}
          </li>
        ))}
      </ul>
      <h2>{tr("product.field.supportPolicy")}</h2>
      <PlainText text={p.supportPolicy} />
      <h2>{tr("admin.products.badges")}</h2>
      <ul>
        {badges.map((b) => (
          <li>
            {tr(BADGE_KEY[b.kind])} · {b.verifiedAt.slice(0, 10)}
            {b.evidence ? ` · ${b.evidence}` : ""}
          </li>
        ))}
      </ul>
      {p.reviewNote ? (
        <>
          <h2>{tr("hub.reviewNote")}</h2>
          <PlainText text={p.reviewNote} />
        </>
      ) : null}

      {p.status === "in_review" ? (
        <div class="row-actions">
          <form method="post" action={action("approve")}>
            <button class="btn" type="submit">
              {tr("admin.approve")}
            </button>
          </form>
          {noteForm("request_changes", true, "admin.products.note", "admin.products.requestChanges")}
        </div>
      ) : null}
      {p.status === "published" ? noteForm("suspend", false, "admin.reasonOptional", "admin.suspend") : null}
      {p.status === "suspended" ? (
        <form method="post" action={action("unsuspend")}>
          <button class="btn" type="submit">
            {tr("admin.unsuspend")}
          </button>
        </form>
      ) : null}
    </AdminLayout>
  );
};
