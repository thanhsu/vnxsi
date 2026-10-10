import type { FC } from "hono/jsx";
import { STEP_FIELDS, type FieldErrorCode, type FieldSpec, type ProductField, type StepErrors, type StepValues, type TextStep } from "../../domain/product-input.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";
import { CATEGORY_KEY, DELIVERY_KEY, LICENSE_KEY, PRODUCT_LANG_KEY } from "../labels.ts";

export const PRODUCT_ERROR_KEY: Record<FieldErrorCode, MessageKey> = {
  required: "product.error.required",
  too_long: "product.error.too_long",
  list: "product.error.list",
  url: "product.error.url",
  choice: "product.error.choice",
  slug: "product.error.slug",
  slug_taken: "product.error.slug_taken",
};

const LABEL: Record<ProductField, MessageKey> = {
  name: "product.field.name",
  slug: "product.field.slug",
  tagline: "product.field.tagline",
  category: "product.field.category",
  deliveryModel: "product.field.deliveryModel",
  primaryLang: "product.field.primaryLang",
  tags: "product.field.tags",
  description: "product.field.description",
  problem: "product.field.problem",
  targetUsers: "product.field.targetUsers",
  features: "product.field.features",
  techStack: "product.field.techStack",
  demoUrl: "product.field.demoUrl",
  websiteUrl: "product.field.websiteUrl",
  customizable: "product.field.customizable",
  customizationNotes: "product.field.customizationNotes",
  license: "product.field.license",
  supportPolicy: "product.field.supportPolicy",
};

const HINT: Partial<Record<ProductField, MessageKey>> = {
  slug: "product.hint.slug",
  tags: "product.hint.tags",
  description: "product.hint.description",
  features: "product.hint.features",
  techStack: "product.hint.techStack",
  demoUrl: "product.hint.demoUrl",
};

const OPTION_KEY: Partial<Record<ProductField, Record<string, MessageKey>>> = {
  category: CATEGORY_KEY,
  deliveryModel: DELIVERY_KEY,
  primaryLang: PRODUCT_LANG_KEY,
  license: LICENSE_KEY,
};

function errorText(tr: Translate, spec: FieldSpec, code: FieldErrorCode): string {
  return tr(PRODUCT_ERROR_KEY[code], { max: spec.max, items: spec.maxItems ?? 0 });
}

/** Summary lines in field order (VNX-0807): "Label: error", linked to the control. Empty on a step that does not apply (license of a non-source product). */
export function stepErrorItems(step: TextStep, errors: StepErrors, tr: Translate): FormErrorItem[] {
  return STEP_FIELDS[step]
    .filter((spec) => errors[spec.name])
    .map((spec) => ({ href: `#pf-${spec.name}`, message: `${tr(LABEL[spec.name])}: ${errorText(tr, spec, errors[spec.name]!)}` }));
}

type Props = { locale: Locale; action: string; step: TextStep; values: StepValues; errors: StepErrors; slugLocked: boolean; licenseApplies: boolean };

/** Renders one text step from STEP_FIELDS. Values arrive as raw strings so a 400 re-render keeps the input. */
export const ProductStepForm: FC<Props> = (p) => {
  const tr = translator(p.locale);
  if (p.step === "license" && !p.licenseApplies) return <p class="notice">{tr("product.license.notSource")}</p>;

  const control = (spec: FieldSpec) => {
    const id = `pf-${spec.name}`;
    const value = p.values[spec.name] ?? "";
    const code = p.errors[spec.name];
    const hintKey = spec.name === "slug" && p.slugLocked ? "product.hint.slugLocked" : HINT[spec.name];
    const describedBy = [hintKey ? `${id}-hint` : "", code ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
    const aria = { "aria-invalid": code ? "true" : undefined, "aria-describedby": describedBy };
    let input: unknown;
    if (spec.kind === "checkbox") {
      return (
        <div class="field">
          <label class="choice">
            <input type="checkbox" name={spec.name} checked={value === "on"} /> {tr(LABEL[spec.name])}
          </label>
        </div>
      );
    } else if (spec.name === "slug" && p.slugLocked) {
      input = <input id={id} value={value} readonly aria-describedby={`${id}-hint`} />;
    } else if (spec.kind === "select") {
      const labels = OPTION_KEY[spec.name] ?? {};
      input = (
        <select id={id} name={spec.name} {...aria}>
          {spec.required ? null : <option value="">{tr("builder.form.choose")}</option>}
          {(spec.options ?? []).map((o) => (
            <option value={o} selected={value === o}>
              {labels[o] ? tr(labels[o]!) : o}
            </option>
          ))}
        </select>
      );
    } else if (spec.kind === "textarea" || spec.kind === "lines") {
      input = (
        <textarea id={id} name={spec.name} rows={spec.kind === "lines" ? 8 : 6} {...aria}>
          {value}
        </textarea>
      );
    } else {
      input = <input id={id} name={spec.name} type={spec.kind === "url" ? "url" : "text"} value={value} maxlength={spec.kind === "csv" ? undefined : spec.max} required={spec.required} {...aria} />;
    }
    return (
      <div class="field">
        <label for={id}>{tr(LABEL[spec.name])}</label>
        {input}
        {hintKey ? (
          <p id={`${id}-hint`} class="hint">
            {tr(hintKey)}
          </p>
        ) : null}
        {code ? (
          <p id={`${id}-error`} class="error-msg">
            {errorText(tr, spec, code)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form method="post" action={p.action}>
      <FormErrorSummary tr={tr} items={stepErrorItems(p.step, p.errors, tr)} lead={tr("builder.form.errorSummary")} />
      {STEP_FIELDS[p.step].map(control)}
      <button class="btn" type="submit">
        {tr("editor.save")}
      </button>
    </form>
  );
};
