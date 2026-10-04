import type { FC } from "hono/jsx";
import { GAP_STEP } from "../../domain/product-input.ts";
import type { EditLock, Product, ProductAction, ReadinessGap } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";

const GAP_KEY: Record<ReadinessGap, MessageKey> = {
  builder_not_approved: "editor.gap.builder_not_approved",
  name: "editor.gap.name",
  tagline: "editor.gap.tagline",
  problem: "editor.gap.problem",
  target_users: "editor.gap.target_users",
  description: "editor.gap.description",
  category: "editor.gap.category",
  delivery_model: "editor.gap.delivery_model",
  support_policy: "editor.gap.support_policy",
  features: "editor.gap.features",
  pricing: "editor.gap.pricing",
  media: "editor.gap.media",
  license: "editor.gap.license",
};

type OwnerAction = Extract<ProductAction, "submit" | "withdraw" | "unlist" | "relist" | "archive">;

const ACTION_KEY: Record<OwnerAction, MessageKey> = {
  submit: "editor.action.submit",
  withdraw: "editor.action.withdraw",
  unlist: "editor.action.unlist",
  relist: "editor.action.relist",
  archive: "editor.action.archive",
};

/** The owner actions spec §7.2 allows from each status (builder_suspended allows none). */
function actionsFor(product: Product, gaps: ReadinessGap[]): OwnerAction[] {
  switch (product.status) {
    case "draft":
    case "changes_requested":
      return gaps.length === 0 ? ["submit", "archive"] : ["archive"];
    case "in_review":
      return ["withdraw"];
    case "published":
      return ["unlist", "archive"];
    case "unlisted":
      return ["relist", "archive"];
    default:
      return [];
  }
}

type Props = { locale: Locale; product: Product; gaps: ReadinessGap[]; lock: EditLock | null };

export const ProductActions: FC<Props> = ({ locale, product, gaps, lock }) => {
  const tr = translator(locale);
  const editable = product.status === "draft" || product.status === "changes_requested";
  const actions = lock === "builder_suspended" ? [] : actionsFor(product, gaps);
  return (
    <aside class="notice product-actions">
      {editable ? (
        gaps.length === 0 ? (
          <p>{tr("editor.ready")}</p>
        ) : (
          <>
            <p>{tr("editor.gaps")}</p>
            <ul>
              {gaps.map((gap) => {
                const step = GAP_STEP[gap];
                return <li>{step ? <a href={localizedPath(locale, `/hub/products/${product.id}/edit/${step}`)}>{tr(GAP_KEY[gap])}</a> : tr(GAP_KEY[gap])}</li>;
              })}
            </ul>
          </>
        )
      ) : null}
      {actions.length > 0 ? (
        <div class="row-actions">
          {actions.map((action) => (
            <form method="post" action={localizedPath(locale, `/hub/products/${product.id}/${action}`)}>
              <button class={action === "submit" ? "btn" : "link"} type="submit">
                {tr(ACTION_KEY[action])}
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </aside>
  );
};
