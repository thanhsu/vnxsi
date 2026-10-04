import type { FC } from "hono/jsx";
import type { StepErrors, StepValues, TextStep } from "../../domain/product-input.ts";
import type { EditLock, Product } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { EditorLayout } from "./EditorLayout.tsx";
import { ProductStepForm } from "./ProductStepForm.tsx";

type Props = { locale: Locale; origin: string; product: Product; step: TextStep; values: StepValues; errors: StepErrors; lock: EditLock | null; saved: boolean };

export const EditorPage: FC<Props> = (p) => (
  <EditorLayout locale={p.locale} origin={p.origin} product={p.product} step={p.step} lock={p.lock} saved={p.saved}>
    {p.lock ? null : (
      <ProductStepForm
        locale={p.locale}
        action={localizedPath(p.locale, `/hub/products/${p.product.id}/edit/${p.step}`)}
        step={p.step}
        values={p.values}
        errors={p.errors}
        slugLocked={p.product.firstPublishedAt !== null}
        licenseApplies={p.product.deliveryModel === "source"}
      />
    )}
  </EditorLayout>
);
