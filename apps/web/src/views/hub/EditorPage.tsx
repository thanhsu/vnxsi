import type { FC } from "hono/jsx";
import type { StepErrors, StepValues, TextStep } from "../../domain/product-input.ts";
import type { EditLock, Product, ProductMedia, ReadinessGap } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { EditorLayout } from "./EditorLayout.tsx";
import { MediaSection, mediaErrorItems, type MediaErrorCode } from "./MediaSection.tsx";
import { ProductStepForm, stepErrorItems } from "./ProductStepForm.tsx";

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
  /** False while there is no R2 binding (VNX-0711): the upload form gives way to a notice. */
  mediaEnabled: boolean;
};

export const EditorPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  // VNX-0807: the title carries the error prefix when either form on this step shows a summary.
  const stepSummary = p.lock === null ? stepErrorItems(p.step, p.errors, tr).length : 0;
  const mediaSummary = p.step === "demo" ? mediaErrorItems({ error: p.mediaError, media: p.media, editable: p.lock === null, enabled: p.mediaEnabled }, tr).length : 0;
  return (
    <EditorLayout locale={p.locale} origin={p.origin} product={p.product} step={p.step} lock={p.lock} gaps={p.gaps} saved={p.saved} invalid={stepSummary + mediaSummary > 0}>
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
        <MediaSection locale={p.locale} productId={p.product.id} productName={p.product.name} media={p.media} error={p.mediaError} editable={p.lock === null} enabled={p.mediaEnabled} />
      ) : null}
    </EditorLayout>
  );
};
