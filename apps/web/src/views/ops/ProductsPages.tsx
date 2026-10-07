import type { FC } from "hono/jsx";
import { PRODUCT_STATUSES, type Badge, type BadgeKind, type PricingTier, type ProductAction, type ProductMedia, type ProductStatus, type ProductWithBuilder } from "../../domain/product.ts";
import { formatUsd } from "../format.ts";
import { BADGE_KEY, BILLING_KEY, CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY, PRODUCT_LANG_KEY, PRODUCT_STATUS_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { BUILDERS_PATH } from "./BuildersPages.tsx";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";
import { Confirm, History, Notice, Pill, PostButton, qs, ReasonField, SearchForm, Tabs, tr, utc, type HistoryView, type OpsNotice, type PillTone } from "./parts.tsx";

/**
 * /ops/marketplace/products and its detail page (VNX-2504a2; spec §7.3; mockup OpsBuilders, same list and detail
 * layout as Builders). The detail shows what /admin/products showed. Actions only when `canAct`.
 */

export const PRODUCTS_PATH = "/ops/marketplace/products";

/** The list filter, from the URL (allowlisted by the route): a status or the "recently edited" view, and a search. */
export type ProductFilter = { status?: ProductStatus; view?: "edited"; q?: string };

const TONE: Record<ProductStatus, PillTone> = { draft: "mute", in_review: "pending", changes_requested: "info", published: "ok", unlisted: "mute", suspended: "bad", archived: "mute" };
const StatusPill: FC<{ status: ProductStatus }> = ({ status }) => <Pill tone={TONE[status]} label={tr(PRODUCT_STATUS_KEY[status])} />;
const GRANTABLE = ["demo_verified", "in_production"] as const;

type ListProps = {
  shell: OpsShell;
  /** The open tab: a status, or null for "Recently edited". */
  status: ProductStatus | null;
  q: string | null;
  counts: { byStatus: Partial<Record<ProductStatus, number>>; edited: number };
  items: ProductWithBuilder[];
};

export const ProductsListPage: FC<ListProps> = ({ shell, status, q, counts, items }) => {
  const tab: ProductFilter = status ? { status } : { view: "edited" };
  const filter = { ...tab, q: q ?? undefined };
  const total = status ? (counts.byStatus[status] ?? 0) : counts.edited;
  const tabs = [
    ...PRODUCT_STATUSES.map((s) => ({ href: PRODUCTS_PATH + qs({ status: s, q }), label: tr(PRODUCT_STATUS_KEY[s]), count: counts.byStatus[s] ?? 0, current: s === status })),
    { href: PRODUCTS_PATH + qs({ view: "edited", q }), label: tr("admin.products.edited"), count: counts.edited, current: status === null },
  ];
  return (
    <OpsLayout {...shell} page={tr("ops.nav.products")} trail={[tr("ops.group.marketplace")]}>
      <div class="ops-ph">
        <h1>{tr("ops.nav.products")}</h1>
        <p>{tr("ops.products.lead")}</p>
      </div>
      <section class="ops-card ops-queue-list" aria-label={tr("ops.products.queue")}>
        <Tabs tabs={tabs} />
        <SearchForm action={PRODUCTS_PATH} q={q} keep={tab as Record<string, string>} label={tr("ops.products.search")} placeholder={tr("ops.products.searchHint")} />
        {items.length === 0 ? (
          <p class="ops-state">{tr(q ? "ops.products.noMatch" : status ? "ops.products.empty" : "ops.products.noEdited")}</p>
        ) : (
          <>
            <div class="ops-table-wrap">
              <table class="ops-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("ops.products.col.product")}</th>
                    <th scope="col">{tr("ops.list.status")}</th>
                    <th scope="col">{tr("admin.col.handle")}</th>
                    <th scope="col">{tr("ops.products.field.slug")}</th>
                    <th scope="col">{tr("product.field.category")}</th>
                    <th scope="col">{tr(status ? "admin.products.updated" : "admin.products.editedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ product: p, builderHandle }) => (
                    <tr>
                      <td>
                        <a class="ops-strong" href={`${PRODUCTS_PATH}/${p.id}${qs(filter)}`}>
                          {p.name}
                        </a>
                      </td>
                      <td>
                        <StatusPill status={p.status} />
                      </td>
                      <td class="ops-mono">{builderHandle}</td>
                      <td class="ops-mono">{p.slug}</td>
                      <td>{p.category ? tr(CATEGORY_KEY[p.category]) : "—"}</td>
                      <td class="ops-mono">{(status ? p.updatedAt : p.editedAfterPublishAt)?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="ops-table-foot">{q ? tr("ops.list.shown", { n: items.length }) : tr("ops.list.count", { n: items.length, total })}</p>
          </>
        )}
      </section>
    </OpsLayout>
  );
};

type DetailProps = {
  shell: OpsShell;
  item: ProductWithBuilder;
  tiers: PricingTier[];
  media: ProductMedia[];
  badges: Badge[];
  filter: ProductFilter;
  canAct: boolean;
  notice: OpsNotice;
  noteError?: ProductAction;
  badgeError: "kind" | "evidence" | "reason" | null;
  /** The badge whose revoke form the error belongs to. */
  errorKind?: BadgeKind;
  history: HistoryView;
};

const Link: FC<{ url: string | null }> = ({ url }) =>
  url ? (
    <a href={url} rel="nofollow ugc noopener" target="_blank">
      {url}
    </a>
  ) : (
    <>—</>
  );

export const ProductDetailPage: FC<DetailProps> = (props) => {
  const { shell, item, tiers, media, badges, filter, canAct, notice, noteError, badgeError, errorKind, history } = props;
  const p = item.product;
  const action = (name: string) => `${PRODUCTS_PATH}/${p.id}/${name}${qs(filter)}`;
  const noteErr = (name: ProductAction) => (noteError === name ? tr("admin.products.error.note") : null);
  const grantable = GRANTABLE.filter((k) => !badges.some((b) => b.kind === k));
  return (
    <OpsLayout {...shell} page={p.name} trail={[tr("ops.group.marketplace"), tr("ops.nav.products")]}>
      <a class="ops-back" href={PRODUCTS_PATH + qs(filter)}>
        <span aria-hidden="true">←</span>
        {tr("ops.nav.products")}
      </a>
      <div class="ops-ph ops-ph-row">
        <h1>{p.name}</h1>
        <StatusPill status={p.status} />
      </div>
      <Notice notice={notice} />
      <div class="ops-split">
        <section class="ops-card ops-sec" aria-labelledby="ops-product-h">
          <h2 id="ops-product-h">{tr("ops.products.col.product")}</h2>
          <dl class="ops-dl">
            <dt>{tr("product.field.tagline")}</dt>
            <dd>{p.tagline || "—"}</dd>
            <dt>{tr("ops.products.field.builder")}</dt>
            <dd class="ops-break">
              <a href={`${BUILDERS_PATH}/${p.builderId}`}>{item.builderHandle}</a> ({item.builderEmail})
            </dd>
            <dt>{tr("ops.products.field.slug")}</dt>
            <dd class="ops-mono ops-break">/p/{p.slug}</dd>
            <dt>{tr("product.field.category")}</dt>
            <dd>{p.category ? tr(CATEGORY_KEY[p.category]) : "—"}</dd>
            <dt>{tr("ops.products.field.delivery")}</dt>
            <dd>{p.deliveryModel ? tr(DELIVERY_KEY[p.deliveryModel]) : "—"}</dd>
            <dt>{tr("product.field.license")}</dt>
            <dd>{p.license ? tr(LICENSE_KEY[p.license]) : "—"}</dd>
            <dt>{tr("ops.products.field.language")}</dt>
            <dd>{tr(PRODUCT_LANG_KEY[p.primaryLang])}</dd>
            <dt>{tr("product.field.tags")}</dt>
            <dd>{p.tags.join(", ") || "—"}</dd>
            <dt>{tr("ops.products.field.demo")}</dt>
            <dd class="ops-break">
              <Link url={p.demoUrl} />
            </dd>
            <dt>{tr("product.field.websiteUrl")}</dt>
            <dd class="ops-break">
              <Link url={p.websiteUrl} />
            </dd>
            <dt>{tr("product.field.techStack")}</dt>
            <dd>{p.techStack.join(", ") || "—"}</dd>
            <dt>{tr("admin.products.updated")}</dt>
            <dd class="ops-mono">{utc(p.updatedAt)}</dd>
          </dl>
          {media.length > 0 ? (
            <ul class="media-grid">
              {media.map((m) => (
                <li>
                  <figure>
                    <a href={`/media/${m.r2Key}`}>
                      <img src={`/media/${m.r2Key}`} alt={m.alt || p.name} width={160} loading="lazy" />
                    </a>
                    <figcaption>{m.alt || "—"}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ) : null}
          <h3>{tr("ops.products.field.problem")}</h3>
          <PlainText text={p.problem} />
          <h3>{tr("ops.products.field.targetUsers")}</h3>
          <PlainText text={p.targetUsers} />
          <h3>{tr("product.field.description")}</h3>
          <PlainText text={p.description} />
          <h3>{tr("product.field.features")}</h3>
          <ul class="ops-list">
            {p.features.map((f) => (
              <li>{f}</li>
            ))}
          </ul>
          <h3>{tr("product.step.pricing")}</h3>
          <ul class="ops-list">
            {tiers.map((t) => (
              <li>
                <span class="ops-strong">{t.name}</span>: {t.priceCents === null ? tr(BILLING_KEY.contact) : `${formatUsd("en", t.priceCents)} · ${tr(BILLING_KEY[t.billing])}`}
                {t.description ? <span class="ops-muted"> · {t.description}</span> : null}
              </li>
            ))}
          </ul>
          <h3>{tr("ops.products.field.customizable")}</h3>
          <p class="ops-p">{tr(p.customizable ? "admin.yes" : "admin.no")}</p>
          {p.customizable && p.customizationNotes ? <PlainText text={p.customizationNotes} /> : null}
          <h3>{tr("ops.products.field.support")}</h3>
          <PlainText text={p.supportPolicy} />
          {p.reviewNote ? (
            <>
              <h3>{tr("ops.detail.reviewNote")}</h3>
              <PlainText text={p.reviewNote} />
            </>
          ) : null}
        </section>
        <div class="ops-stack">
          <section class="ops-card ops-sec" aria-labelledby="ops-decision-h">
            <h2 id="ops-decision-h">{tr("ops.detail.decision")}</h2>
            {!canAct ? (
              <p class="ops-muted">{tr("ops.detail.viewOnly")}</p>
            ) : p.status === "in_review" ? (
              <>
                <div class="ops-actions">
                  <PostButton action={action("approve")} label={tr("admin.approve")} primary />
                  <Confirm summary={tr("ops.products.changesOpen")} open={noteError === "request_changes"}>
                    <form method="post" action={action("request_changes")}>
                      <ReasonField id="request_changes-note" name="note" label={tr("admin.products.note")} max={1000} required error={noteErr("request_changes")} />
                      <p class="ops-note">{tr("ops.products.changesHelp", { name: p.name })}</p>
                      <button class="ops-btn ops-btn-danger" type="submit">
                        {tr("admin.products.requestChanges")}
                      </button>
                    </form>
                  </Confirm>
                </div>
                <p class="ops-note">{tr("ops.products.approveHelp")}</p>
              </>
            ) : p.status === "published" ? (
              <Confirm summary={tr("ops.products.suspendOpen")} open={noteError === "suspend"}>
                <form method="post" action={action("suspend")}>
                  <ReasonField id="suspend-note" name="note" label={tr("ops.products.suspendNote")} max={1000} required={false} error={noteErr("suspend")} />
                  <p class="ops-note">{tr("ops.products.suspendHelp", { name: p.name })}</p>
                  <button class="ops-btn ops-btn-danger" type="submit">
                    {tr("ops.products.suspendConfirm")}
                  </button>
                </form>
              </Confirm>
            ) : p.status === "suspended" ? (
              <PostButton action={action("unsuspend")} label={tr("admin.unsuspend")} />
            ) : (
              <p class="ops-muted">{tr("ops.detail.noAction")}</p>
            )}
          </section>
          <section class="ops-card ops-sec ops-badge-sec" aria-labelledby="ops-badges-h">
            <h2 id="ops-badges-h">{tr("admin.products.badges")}</h2>
            {badges.length === 0 ? (
              <p class="ops-muted">{tr("ops.products.noBadges")}</p>
            ) : (
              <ul class="ops-badges">
                {badges.map((b) => (
                  <li>
                    <span>
                      <span class="ops-strong">{tr(BADGE_KEY[b.kind])}</span> · <span class="ops-mono">{b.verifiedAt.slice(0, 10)}</span>
                      {b.evidence ? <span class="ops-muted"> · {b.evidence}</span> : null}
                    </span>
                    {canAct && b.kind !== "listed" ? (
                      <Confirm summary={tr("ops.products.revokeOpen")} open={badgeError === "reason" && errorKind === b.kind}>
                        <form method="post" action={action(`badges/${b.kind}/revoke`)}>
                          <ReasonField
                            id={`revoke-${b.kind}`}
                            name="reason"
                            label={tr("admin.badges.reason")}
                            max={300}
                            required
                            error={badgeError === "reason" && errorKind === b.kind ? tr("admin.badges.error.reason") : null}
                          />
                          <p class="ops-note">{tr("ops.products.revokeHelp", { badge: tr(BADGE_KEY[b.kind]), name: p.name })}</p>
                          <button class="ops-btn ops-btn-danger" type="submit">
                            {tr("ops.products.revokeConfirm")}
                          </button>
                        </form>
                      </Confirm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canAct && p.status !== "archived" && grantable.length > 0 ? (
              <form method="post" action={action("badges")}>
                <div class="ops-field">
                  <label for="badge-kind">{tr("admin.badges.kind")}</label>
                  <select class="ops-in" id="badge-kind" name="kind" aria-invalid={badgeError === "kind" ? "true" : undefined} aria-describedby={badgeError === "kind" ? "badge-kind-error" : undefined}>
                    {grantable.map((k) => (
                      <option value={k}>{tr(BADGE_KEY[k])}</option>
                    ))}
                  </select>
                  {badgeError === "kind" ? (
                    <p id="badge-kind-error" class="ops-field-error">
                      {tr("admin.badges.error.kind")}
                    </p>
                  ) : null}
                </div>
                <ReasonField id="badge-evidence" name="evidence" label={tr("admin.badges.evidence")} max={500} required error={badgeError === "evidence" ? tr("admin.badges.error.evidence") : null} />
                <button class="ops-btn" type="submit">
                  {tr("admin.badges.grant")}
                </button>
              </form>
            ) : null}
          </section>
          <History history={history} empty={tr("ops.products.noHistory")} />
        </div>
      </div>
    </OpsLayout>
  );
};
