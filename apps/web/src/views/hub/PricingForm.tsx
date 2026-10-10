import type { FC } from "hono/jsx";
import type { TierErrors, TierFieldError, TierRowValues, TierValues } from "../../domain/pricing-input.ts";
import { BILLINGS } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";
import { BILLING_KEY } from "../labels.ts";

const ERROR_KEY: Record<TierFieldError, MessageKey> = {
  required: "product.error.required",
  too_long: "pricing.error.too_long",
  choice: "product.error.choice",
  price: "pricing.error.price",
  contact: "pricing.error.contact",
};

const FIELDS: [keyof TierRowValues, MessageKey][] = [
  ["name", "pricing.name"],
  ["billing", "pricing.billing"],
  ["price", "pricing.price"],
  ["description", "pricing.description"],
];

/** Summary lines in page order (VNX-0807): "Tier n · Label: error", linked to the control. */
export function pricingErrorItems(errors: TierErrors, tr: Translate): FormErrorItem[] {
  const items: FormErrorItem[] = [];
  for (const i of Object.keys(errors).map(Number).sort((a, b) => a - b)) {
    for (const [name, label] of FIELDS) {
      const code = errors[i]?.[name];
      if (code) items.push({ href: `#tier-${i}-${name}`, message: `${tr("pricing.tier", { n: i + 1 })} · ${tr(label)}: ${tr(ERROR_KEY[code])}` });
    }
  }
  return items;
}

type Props = { locale: Locale; action: string; values: TierValues; errors: TierErrors };

export const PricingForm: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const field = (i: number, name: keyof TierRowValues, label: MessageKey, control: (aria: Record<string, string | undefined>) => unknown) => {
    const id = `tier-${i}-${name}`;
    const code = p.errors[i]?.[name];
    return (
      <div class="field">
        <label for={id}>{tr(label)}</label>
        {control({ id, "aria-invalid": code ? "true" : undefined, "aria-describedby": code ? `${id}-error` : undefined })}
        {code ? (
          <p id={`${id}-error`} class="error-msg">
            {tr(ERROR_KEY[code])}
          </p>
        ) : null}
      </div>
    );
  };
  return (
    <form method="post" action={p.action}>
      <p class="hint">{tr("pricing.intro")}</p>
      <FormErrorSummary tr={tr} items={pricingErrorItems(p.errors, tr)} lead={tr("builder.form.errorSummary")} />
      {p.values.map((row, i) => (
        <fieldset class="field">
          <legend>{tr("pricing.tier", { n: i + 1 })}</legend>
          {field(i, "name", "pricing.name", (aria) => <input name={`tiers[${i}].name`} value={row.name} maxlength={40} {...aria} />)}
          {field(i, "billing", "pricing.billing", (aria) => (
            <select name={`tiers[${i}].billing`} {...aria}>
              {BILLINGS.map((b) => (
                <option value={b} selected={(row.billing || "one_time") === b}>
                  {tr(BILLING_KEY[b])}
                </option>
              ))}
            </select>
          ))}
          {field(i, "price", "pricing.price", (aria) => <input name={`tiers[${i}].price`} value={row.price} inputmode="decimal" {...aria} />)}
          {field(i, "description", "pricing.description", (aria) => <input name={`tiers[${i}].description`} value={row.description} maxlength={300} {...aria} />)}
        </fieldset>
      ))}
      <button class="btn" type="submit">
        {tr("editor.save")}
      </button>
    </form>
  );
};
