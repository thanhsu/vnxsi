import type { FC } from "hono/jsx";
import type { MerchantField, MerchantFieldError, MerchantFormValues, MerchantStatus } from "../../domain/merchant.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type MerchantView = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  allowedHosts: readonly string[];
  description: string;
  indexable: boolean;
  status: MerchantStatus;
  defaultOfferId: string | null;
};
export type MerchantErrors = Partial<Record<MerchantField, MerchantFieldError | "taken">>;
export type MerchantEdit = { values: MerchantFormValues; errors: MerchantErrors; broken: { id: string; field: "destinationUrl" | "trackingTemplate"; error: string }[] };

const HOSTS_KEY: Record<string, MessageKey> = {
  empty: "merchants.err.hostsEmpty",
  too_many: "merchants.err.hostsTooMany",
  format: "merchants.err.hostsFormat",
  duplicate: "merchants.err.hostsDuplicate",
};

function errorText(tr: Translate, field: MerchantField, e: MerchantFieldError | "taken"): string {
  if (e.startsWith("url_")) return tr("merchants.err.url", { code: e.slice(4) });
  if (field === "slug") return tr(e === "reserved" ? "merchants.err.slugReserved" : e === "taken" ? "merchants.err.slugTaken" : "merchants.err.slugFormat");
  if (field === "allowedHosts") return tr(HOSTS_KEY[e] ?? "merchants.err.required");
  return tr(e === "too_long" ? "merchants.err.tooLong" : "merchants.err.required");
}

export const merchantValuesOf = (m: MerchantView): MerchantFormValues => ({
  name: m.name,
  slug: m.slug,
  websiteUrl: m.websiteUrl,
  allowedHosts: m.allowedHosts.join("\n"),
  description: m.description,
  indexable: m.indexable,
});

type FieldsProps = { locale: Locale; prefix: string; values: MerchantFormValues; errors: MerchantErrors; slugReadonly: boolean };

/** The merchant fields. With `slugReadonly` the slug is text, not an input: it cannot be sent, let alone changed. */
export const MerchantFields: FC<FieldsProps> = (p) => {
  const tr = translator(p.locale);
  const id = (f: string) => `${p.prefix}-${f}`;
  const err = (f: MerchantField) => (p.errors[f] ? errorText(tr, f, p.errors[f]!) : null);
  const v = p.values;
  return (
    <>
      <Field id={id("name")} label={tr("merchants.f.name")} error={err("name")}>
        <input id={id("name")} name="name" required maxlength={80} value={v.name} {...aria(id("name"), p.errors.name)} />
      </Field>
      {p.slugReadonly ? (
        <p>
          <strong>{tr("merchants.f.slug")}:</strong> <code>{v.slug}</code>
        </p>
      ) : (
        <Field id={id("slug")} label={tr("merchants.f.slug")} hint={tr("merchants.f.slugHint")} error={err("slug")}>
          <input id={id("slug")} name="slug" required maxlength={60} value={v.slug} {...aria(id("slug"), p.errors.slug)} />
        </Field>
      )}
      <Field id={id("websiteUrl")} label={tr("merchants.f.websiteUrl")} error={err("websiteUrl")}>
        <input id={id("websiteUrl")} name="websiteUrl" type="url" required maxlength={2048} value={v.websiteUrl} {...aria(id("websiteUrl"), p.errors.websiteUrl)} />
      </Field>
      <Field id={id("allowedHosts")} label={tr("merchants.f.hosts")} hint={tr("merchants.f.hostsHint")} error={err("allowedHosts")}>
        <textarea id={id("allowedHosts")} name="allowedHosts" rows={4} required {...aria(id("allowedHosts"), p.errors.allowedHosts)}>
          {v.allowedHosts}
        </textarea>
      </Field>
      <Field id={id("description")} label={tr("merchants.f.description")} error={err("description")}>
        <textarea id={id("description")} name="description" rows={6} maxlength={2000} {...aria(id("description"), p.errors.description)}>
          {v.description}
        </textarea>
      </Field>
      <p>
        <label>
          <input type="checkbox" name="indexable" value="1" checked={v.indexable} /> {tr("merchants.f.indexable")}
        </label>
      </p>
    </>
  );
};

type Props = { locale: Locale; origin: string; merchants: MerchantView[]; create: Pick<MerchantEdit, "values" | "errors"> & { status: "active" | "paused" } };

export const NEW_MERCHANT_VALUES: MerchantFormValues = { name: "", slug: "", websiteUrl: "", allowedHosts: "", description: "", indexable: false };

export const MerchantsPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("merchants.title")} rest="/admin/merchants" active="merchants">
      <h1>{tr("merchants.title")}</h1>
      <p>{tr("merchants.intro")}</p>
      {p.merchants.length === 0 ? (
        <p class="muted">{tr("merchants.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("merchants.f.name")}</th>
                <th>{tr("merchants.col.slug")}</th>
                <th>{tr("merchants.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {p.merchants.map((m) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/merchants/${m.id}`)}>{m.name}</a>
                  </td>
                  <td>
                    <code>{m.slug}</code>
                  </td>
                  <td>{tr(STATUS_KEY[m.status])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>{tr("merchants.new")}</h2>
      <form method="post" action={localizedPath(p.locale, "/admin/merchants")} class="card">
        <MerchantFields locale={p.locale} prefix="merchants" values={p.create.values} errors={p.create.errors} slugReadonly={false} />
        <div class="field">
          <label for="merchants-status">{tr("merchants.col.status")}</label>
          <select id="merchants-status" name="status">
            <option value="paused" selected={p.create.status === "paused"}>
              {tr("partner.status.paused")}
            </option>
            <option value="active" selected={p.create.status === "active"}>
              {tr("partner.status.active")}
            </option>
          </select>
          <p class="muted">{tr("merchants.newHint")}</p>
        </div>
        <button class="btn" type="submit">
          {tr("merchants.create")}
        </button>
      </form>
    </AdminLayout>
  );
};
