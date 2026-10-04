import type { FC } from "hono/jsx";
import type { StepErrors, StepValues, TextStep } from "../../domain/product-input.ts";
import type { EditLock, Product, ProductMedia, ReadinessGap } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { EditorLayout } from "./EditorLayout.tsx";
import { MediaSection, type MediaErrorCode } from "./MediaSection.tsx";
import { ProductStepForm } from "./ProductStepForm.tsx";

type Props = {
  locale: Locale;
  origin: string;
  product: Product;
  step: TextStep;
  values: StepValues;
  errors: StepErrors;
  lock: EditLock | null;
  gaps: ReadinessGap[];
  saved: boolean;
  media: ProductMedia[];
  mediaError: MediaErrorCode | null;
};

export const EditorPage: FC<Props> = (p) => (
  <EditorLayout locale={p.locale} origin={p.origin} product={p.product} step={p.step} lock={p.lock} gaps={p.gaps} saved={p.saved}>
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
    {p.step === "demo" ? (
      <MediaSection locale={p.locale} productId={p.product.id} productName={p.product.name} media={p.media} error={p.mediaError} editable={p.lock === null} />
    ) : null}
  </EditorLayout>
);
