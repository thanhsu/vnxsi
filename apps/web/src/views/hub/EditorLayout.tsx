import type { FC, PropsWithChildren } from "hono/jsx";
import type { ProductStep } from "../../domain/product-input.ts";
import { PRODUCT_STEPS } from "../../domain/product-input.ts";
import type { EditLock, Product, ReadinessGap } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { PRODUCT_STATUS_KEY, STEP_KEY } from "../labels.ts";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";
import { ProductActions } from "./ProductActions.tsx";

const LOCK_KEY: Record<EditLock, MessageKey> = {
  in_review: "editor.locked.in_review",
  suspended: "editor.locked.suspended",
  builder_suspended: "editor.locked.builder_suspended",
};

type Props = { locale: Locale; origin: string; product: Product; step: ProductStep; lock: EditLock | null; gaps: ReadinessGap[]; saved: boolean; invalid?: boolean };

/** Shared frame of every editor step: title, status, step navigation, lock and review notes. */
export const EditorLayout: FC<PropsWithChildren<Props>> = (p) => {
  const tr = translator(p.locale);
  const base = `/hub/products/${p.product.id}/edit`;
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={`${tr(STEP_KEY[p.step])} · ${p.product.name}`} rest={`${base}/${p.step}`} active="products" invalid={p.invalid}>
      <h1>
        {p.product.name} <span class={`badge badge-${p.product.status}`}>{tr(PRODUCT_STATUS_KEY[p.product.status])}</span>
      </h1>
      {p.product.status === "published" ? (
        <p>
          <a href={localizedPath(p.locale, `/p/${p.product.slug}`)}>{tr("products.viewPublic")}</a>
        </p>
      ) : null}
      <nav class="subnav" aria-label={tr("editor.steps")}>
        {PRODUCT_STEPS.map((s, i) => (
          <a href={localizedPath(p.locale, `${base}/${s}`)} aria-current={s === p.step ? "step" : undefined}>
            {i + 1}. {tr(STEP_KEY[s])}
          </a>
        ))}
      </nav>
      <ProductActions locale={p.locale} product={p.product} gaps={p.gaps} lock={p.lock} />
      {p.saved ? (
        <p class="notice good" role="status">
          {tr("editor.saved")}
        </p>
      ) : null}
      {p.lock ? <p class="notice">{tr(LOCK_KEY[p.lock])}</p> : null}
      {!p.lock && p.product.status === "published" ? <p class="notice">{tr("editor.live")}</p> : null}
      {!p.lock && p.product.status === "unlisted" ? <p class="notice">{tr("editor.unlisted")}</p> : null}
      {(p.product.status === "changes_requested" || p.product.status === "suspended") && p.product.reviewNote ? (
        <div class="notice">
          <p>{tr("editor.reviewNote")}</p>
          <PlainText text={p.product.reviewNote} />
        </div>
      ) : null}
      <section class="card wide">
        <h2>{tr(STEP_KEY[p.step])}</h2>
        {p.children}
      </section>
    </HubLayout>
  );
};
