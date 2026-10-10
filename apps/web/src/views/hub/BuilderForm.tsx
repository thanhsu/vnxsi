import type { FC } from "hono/jsx";
import { AVAILABILITIES, BUILDER_KINDS, WORK_LANGUAGES } from "../../domain/builder.ts";
import type { BuilderField, BuilderFormValues, FieldErrors } from "../../domain/builder-input.ts";
import type { Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { countryOptions } from "../country.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";
import { AVAILABILITY_KEY, KIND_KEY, LANGUAGE_KEY } from "../labels.ts";

const ERROR_KEY: Record<BuilderField, MessageKey> = {
  handle: "builder.error.handle",
  name: "builder.error.name",
  kind: "builder.error.kind",
  headline: "builder.error.headline",
  bio: "builder.error.bio",
  country: "builder.error.country",
  websiteUrl: "builder.error.websiteUrl",
  skills: "builder.error.skills",
  aiTools: "builder.error.aiTools",
  workLanguages: "builder.error.workLanguages",
  availability: "builder.error.availability",
  hourlyRate: "builder.error.hourlyRate",
};

function errorText(tr: Translate, field: BuilderField, errors: FieldErrors): string | null {
  const code = errors[field];
  if (!code) return null;
  if (code === "reserved") return tr("builder.error.handleReserved");
  if (code === "taken") return tr("builder.error.handleTaken");
  return tr(ERROR_KEY[field]);
}

/** Fields in page order, with the id of the control a summary link points at (the first checkbox / radio for the two groups). */
const FIELD_ORDER: BuilderField[] = ["handle", "name", "kind", "headline", "bio", "country", "websiteUrl", "skills", "aiTools", "workLanguages", "availability", "hourlyRate"];

/** Summary lines for the form (VNX-0807): "Label: error", linked to the control. Empty when there are no errors. */
export function builderErrorItems(errors: FieldErrors, tr: Translate): FormErrorItem[] {
  return FIELD_ORDER.filter((field) => errors[field]).map((field) => ({
    href: `#${field}`,
    message: `${tr(`builder.field.${field}`)}: ${errorText(tr, field, errors)}`,
  }));
}

export type BuilderFormProps = {
  locale: Locale;
  action: string;
  values: BuilderFormValues;
  errors: FieldErrors;
  submitLabel: string;
  handleLocked?: boolean;
};

export const BuilderForm: FC<BuilderFormProps> = ({ locale, action, values, errors, submitLabel, handleLocked }) => {
  const tr = translator(locale);
  const error = (field: BuilderField) => {
    const text = errorText(tr, field, errors);
    return text ? (
      <p id={`${field}-error`} class="error-msg">
        {text}
      </p>
    ) : null;
  };
  // Links a control to its hint and its error message, when present.
  const aria = (field: BuilderField, hint = false) => {
    const ids = [hint ? `${field}-hint` : "", errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ");
    return { "aria-invalid": errors[field] ? "true" : undefined, "aria-describedby": ids || undefined };
  };
  const hint = (field: BuilderField, key: MessageKey) => (
    <p id={`${field}-hint`} class="hint">
      {tr(key)}
    </p>
  );

  return (
    <form method="post" action={action}>
      <FormErrorSummary tr={tr} items={builderErrorItems(errors, tr)} lead={tr("builder.form.errorSummary")} />

      <div class="field">
        <label for="handle">{tr("builder.field.handle")}</label>
        {handleLocked ? (
          <input id="handle" value={values.handle} readonly aria-describedby="handle-hint" />
        ) : (
          <input id="handle" name="handle" value={values.handle} required maxlength={30} autocomplete="off" {...aria("handle", true)} />
        )}
        {hint("handle", handleLocked ? "profile.handleLocked" : "builder.hint.handle")}
        {error("handle")}
      </div>

      <div class="field">
        <label for="name">{tr("builder.field.name")}</label>
        <input id="name" name="name" value={values.name} required maxlength={80} autocomplete="name" {...aria("name")} />
        {error("name")}
      </div>

      <div class="field">
        <label for="kind">{tr("builder.field.kind")}</label>
        <select id="kind" name="kind" required {...aria("kind")}>
          <option value="">{tr("builder.form.choose")}</option>
          {BUILDER_KINDS.map((k) => (
            <option value={k} selected={values.kind === k}>
              {tr(KIND_KEY[k])}
            </option>
          ))}
        </select>
        {error("kind")}
      </div>

      <div class="field">
        <label for="headline">{tr("builder.field.headline")}</label>
        <input id="headline" name="headline" value={values.headline} required maxlength={120} {...aria("headline", true)} />
        {hint("headline", "builder.hint.headline")}
        {error("headline")}
      </div>

      <div class="field">
        <label for="bio">{tr("builder.field.bio")}</label>
        <textarea id="bio" name="bio" rows={8} required maxlength={2000} {...aria("bio", true)}>
          {values.bio}
        </textarea>
        {hint("bio", "builder.hint.bio")}
        {error("bio")}
      </div>

      <div class="field">
        <label for="country">{tr("builder.field.country")}</label>
        <select id="country" name="country" required {...aria("country")}>
          <option value="">{tr("builder.form.choose")}</option>
          {countryOptions(locale).map((o) => (
            <option value={o.code} selected={values.country.toUpperCase() === o.code}>
              {o.name}
            </option>
          ))}
        </select>
        {error("country")}
      </div>

      <div class="field">
        <label for="websiteUrl">{tr("builder.field.websiteUrl")}</label>
        <input id="websiteUrl" name="websiteUrl" type="url" value={values.websiteUrl} maxlength={500} placeholder="https://" {...aria("websiteUrl")} />
        {error("websiteUrl")}
      </div>

      <div class="field">
        <label for="skills">{tr("builder.field.skills")}</label>
        <input id="skills" name="skills" value={values.skills} required {...aria("skills", true)} />
        {hint("skills", "builder.hint.skills")}
        {error("skills")}
      </div>

      <div class="field">
        <label for="aiTools">{tr("builder.field.aiTools")}</label>
        <input id="aiTools" name="aiTools" value={values.aiTools} {...aria("aiTools", true)} />
        {hint("aiTools", "builder.hint.aiTools")}
        {error("aiTools")}
      </div>

      <fieldset class="field" aria-describedby={errors.workLanguages ? "workLanguages-error" : undefined}>
        <legend>{tr("builder.field.workLanguages")}</legend>
        {WORK_LANGUAGES.map((l, i) => (
          <label class="choice">
            <input type="checkbox" id={i === 0 ? "workLanguages" : undefined} name="workLanguages" value={l} checked={values.workLanguages.includes(l)} /> {tr(LANGUAGE_KEY[l])}
          </label>
        ))}
        {error("workLanguages")}
      </fieldset>

      <fieldset class="field" aria-describedby={errors.availability ? "availability-error" : undefined}>
        <legend>{tr("builder.field.availability")}</legend>
        {AVAILABILITIES.map((a, i) => (
          <label class="choice">
            <input type="radio" id={i === 0 ? "availability" : undefined} name="availability" value={a} checked={values.availability === a} required /> {tr(AVAILABILITY_KEY[a])}
          </label>
        ))}
        {error("availability")}
      </fieldset>

      <div class="field">
        <label for="hourlyRate">{tr("builder.field.hourlyRate")}</label>
        <input id="hourlyRate" name="hourlyRate" type="number" inputmode="numeric" min={1} max={10000} step={1} value={values.hourlyRate} {...aria("hourlyRate")} />
        {error("hourlyRate")}
      </div>

      <button class="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
};
