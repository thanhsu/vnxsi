import type { FC } from "hono/jsx";
import { MERCHANT_STATUSES, merchantTransitionAllowed, multiTenantHosts } from "../../domain/merchant.ts";
import {
  COMMISSION_MODELS,
  PROGRAM_PROVIDERS,
  PROGRAM_STATUSES,
  PROGRAM_TYPES,
  type CommissionModel,
  type ProgramField,
  type ProgramFieldError,
  type ProgramFormValues,
  type ProgramProvider,
  type ProgramStatus,
  type ProgramType,
} from "../../domain/offer.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { AdminLayout } from "./AdminLayout.tsx";
import { MerchantFields, merchantValuesOf, type MerchantEdit, type MerchantView } from "./MerchantsPage.tsx";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type ProgramView = {
  id: string;
  name: string;
  type: ProgramType;
  network: string | null;
  provider: ProgramProvider;
  commissionModel: CommissionModel | null;
  commissionRateBps: number | null;
  commissionFlatMinor: number | null;
  currency: string | null;
  cookieDays: number | null;
  attributionNotes: string | null;
  termsUrl: string | null;
  termsVerifiedAt: string | null;
  status: ProgramStatus;
};
/** `id` is the program's id, or "new" for the create form. */
export type ProgramEdit = { id: string; values: ProgramFormValues; errors: Partial<Record<ProgramField, ProgramFieldError>> };

const PROGRAM_ERROR_KEY: Record<ProgramFieldError, MessageKey> = {
  required: "programs.err.required",
  too_long: "programs.err.tooLong",
  choice: "programs.err.choice",
  number: "programs.err.number",
  currency: "programs.err.currency",
  url: "programs.err.url",
  date: "programs.err.date",
  terms_missing: "programs.err.termsMissing",
  direct_not_active: "programs.err.directNotActive",
};

const s = (v: string | number | null): string => (v === null ? "" : String(v));
export const programValuesOf = (p: ProgramView): ProgramFormValues => ({
  name: p.name,
  type: p.type,
  network: s(p.network),
  provider: p.provider,
  commissionModel: s(p.commissionModel),
  commissionRateBps: s(p.commissionRateBps),
  commissionFlatMinor: s(p.commissionFlatMinor),
  currency: s(p.currency),
  cookieDays: s(p.cookieDays),
  attributionNotes: s(p.attributionNotes),
  termsUrl: s(p.termsUrl),
  termsVerifiedAt: s(p.termsVerifiedAt),
  status: p.status,
});
/** Nothing is defaulted except the safe status (draft). */
export const NEW_PROGRAM_VALUES: ProgramFormValues = {
  name: "",
  type: "affiliate",
  network: "",
  provider: "generic_template",
  commissionModel: "",
  commissionRateBps: "",
  commissionFlatMinor: "",
  currency: "",
  cookieDays: "",
  attributionNotes: "",
  termsUrl: "",
  termsVerifiedAt: "",
  status: "draft",
};

const TEXT_FIELDS: { name: ProgramField; label: MessageKey; type?: "number" | "url" | "textarea" }[] = [
  { name: "name", label: "programs.f.name" },
  { name: "network", label: "programs.f.network" },
  { name: "commissionRateBps", label: "programs.f.commissionRateBps", type: "number" },
  { name: "commissionFlatMinor", label: "programs.f.commissionFlatMinor", type: "number" },
  { name: "currency", label: "programs.f.currency" },
  { name: "cookieDays", label: "programs.f.cookieDays", type: "number" },
  { name: "attributionNotes", label: "programs.f.attributionNotes", type: "textarea" },
  { name: "termsUrl", label: "programs.f.termsUrl", type: "url" },
  { name: "termsVerifiedAt", label: "programs.f.termsVerifiedAt" },
];

type ProgramFormProps = { locale: Locale; action: string; edit: ProgramEdit; current: ProgramStatus | null };

/** One program form. `current` is the saved status (null for a new program); `ended` replaces the status choice with a hidden value. */
const ProgramForm: FC<ProgramFormProps> = (p) => {
  const tr = translator(p.locale);
  const v = p.edit.values;
  const id = (f: string) => `programs-${p.edit.id}-${f}`;
  const err = (f: ProgramField) => (p.edit.errors[f] ? tr(PROGRAM_ERROR_KEY[p.edit.errors[f]!]) : null);
  const ended = p.current === "ended";
  const select = (name: "type" | "provider" | "commissionModel" | "status", options: readonly string[], blank: boolean) => (
    <select id={id(name)} name={name} {...aria(id(name), p.edit.errors[name])}>
      {blank ? <option value="">{tr("programs.f.none")}</option> : null}
      {options.map((o) => (
        <option value={o} selected={v[name] === o}>
          {name === "status" ? tr(STATUS_KEY[o as ProgramStatus]) : o}
        </option>
      ))}
    </select>
  );
  return (
    <form method="post" action={p.action} class="card">
      <input type="hidden" name="expectedStatus" value={p.current ?? "draft"} />
      {TEXT_FIELDS.slice(0, 2).map((f) => (
        <Field id={id(f.name)} label={tr(f.label)} error={err(f.name)}>
          <input id={id(f.name)} name={f.name} value={v[f.name]} {...aria(id(f.name), p.edit.errors[f.name])} />
        </Field>
      ))}
      <Field id={id("type")} label={tr("programs.f.type")} error={err("type")}>
        {select("type", PROGRAM_TYPES, false)}
      </Field>
      <Field id={id("provider")} label={tr("programs.f.provider")} error={err("provider")}>
        {select("provider", PROGRAM_PROVIDERS, false)}
      </Field>
      <Field id={id("commissionModel")} label={tr("programs.f.commissionModel")} error={err("commissionModel")}>
        {select("commissionModel", COMMISSION_MODELS, true)}
      </Field>
      {TEXT_FIELDS.slice(2).map((f) => (
        <Field id={id(f.name)} label={tr(f.label)} error={err(f.name)}>
          {f.type === "textarea" ? (
            <textarea id={id(f.name)} name={f.name} rows={3} maxlength={1000} {...aria(id(f.name), p.edit.errors[f.name])}>
              {v[f.name]}
            </textarea>
          ) : (
            <input
              id={id(f.name)}
              name={f.name}
              type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
              min={f.type === "number" ? 0 : undefined}
              value={v[f.name]}
              {...aria(id(f.name), p.edit.errors[f.name])}
            />
          )}
        </Field>
      ))}
      {ended ? (
        <>
          <input type="hidden" name="status" value="ended" />
          <p class="muted">{tr("programs.endedNote")}</p>
        </>
      ) : (
        <Field id={id("status")} label={tr("programs.f.status")} error={err("status")}>
          {select("status", PROGRAM_STATUSES, false)}
        </Field>
      )}
      <button class="btn" type="submit">
        {tr(p.current === null ? "programs.create" : "programs.save")}
      </button>
    </form>
  );
};

type Props = {
  locale: Locale;
  origin: string;
  merchant: MerchantView;
  programs: ProgramView[];
  done: boolean;
  merchantEdit?: MerchantEdit;
  programEdit?: ProgramEdit;
};

export const MerchantDetailPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const m = p.merchant;
  const base = `/admin/merchants/${m.id}`;
  const shared = multiTenantHosts(m.allowedHosts);
  const edit = p.merchantEdit ?? { values: merchantValuesOf(m), errors: {}, broken: [] };
  const targets = MERCHANT_STATUSES.filter((to) => to !== m.status && merchantTransitionAllowed(m.status, to));
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={m.name} rest={base} active="merchants">
      <p>
        <a href={localizedPath(p.locale, "/admin/merchants")}>{tr("merchants.back")}</a>
      </p>
      <h1>{m.name}</h1>
      <p>
        <code>{m.slug}</code> · {tr(STATUS_KEY[m.status])}
      </p>
      {p.done ? (
        <p class="notice good" role="status">
          {tr("partner.saved")}
        </p>
      ) : null}
      {shared.length > 0 ? (
        <p class="notice" role="note" data-warning="multi-tenant">
          {tr("merchants.hostsWarn", { hosts: shared.join(", "), name: m.name })}
        </p>
      ) : null}
      {edit.broken.length > 0 ? (
        <div class="notice" role="alert" data-broken>
          <p>{tr("merchants.brokenTitle")}</p>
          <ul>
            {edit.broken.map((b) => (
              <li>
                <code>{b.id}</code>: {tr(b.field === "destinationUrl" ? "partner.field.destinationUrl" : "partner.field.trackingTemplate")} ({b.error})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="post" action={localizedPath(p.locale, base)} class="card">
        <MerchantFields locale={p.locale} prefix="merchant" values={edit.values} errors={edit.errors} slugReadonly />
        <button class="btn" type="submit">
          {tr("merchants.save")}
        </button>
      </form>

      {m.status === "archived" ? (
        <p class="muted">{tr("merchants.archivedNote")}</p>
      ) : (
        <div class="row-actions">
          {targets.map((to) => (
            <form method="post" action={localizedPath(p.locale, `${base}/status`)}>
              <input type="hidden" name="to" value={to} />
              {to === "archived" ? (
                <label>
                  <input type="checkbox" name="confirm" value="1" required /> {tr("merchants.confirmArchive")}
                </label>
              ) : null}
              <button class="btn btn-ghost" type="submit">
                {tr("merchants.moveTo", { status: tr(STATUS_KEY[to]) })}
              </button>
            </form>
          ))}
        </div>
      )}

      <h2>{tr("programs.title")}</h2>
      <p>{tr("programs.intro")}</p>
      {p.programs.length === 0 ? <p class="muted">{tr("programs.empty")}</p> : null}
      {p.programs.map((program) => (
        <section aria-label={program.name}>
          <h3>
            {program.name} · {tr(STATUS_KEY[program.status])}
          </h3>
          <ProgramForm
            locale={p.locale}
            action={localizedPath(p.locale, `${base}/programs/${program.id}`)}
            edit={p.programEdit?.id === program.id ? p.programEdit : { id: program.id, values: programValuesOf(program), errors: {} }}
            current={program.status}
          />
        </section>
      ))}
      <h3>{tr("programs.new")}</h3>
      <ProgramForm
        locale={p.locale}
        action={localizedPath(p.locale, `${base}/programs`)}
        edit={p.programEdit?.id === "new" ? p.programEdit : { id: "new", values: NEW_PROGRAM_VALUES, errors: {} }}
        current={null}
      />
    </AdminLayout>
  );
};
