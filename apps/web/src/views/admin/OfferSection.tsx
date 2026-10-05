import type { FC } from "hono/jsx";
import {
  LABELS,
  OFFER_KINDS,
  OFFER_STATUSES,
  type OfferField,
  type OfferFieldError,
  type OfferFormValues,
  type OfferKind,
  type OfferLabel,
  type OfferPreview,
  type OfferStatus,
} from "../../domain/offer.ts";
import type { UrlError } from "../../domain/offer-url.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";
import { aria, Field, STATUS_KEY } from "./partner-fields.tsx";

export type OfferView = {
  id: string;
  programId: string | null;
  kind: OfferKind;
  label: OfferLabel;
  destinationUrl: string;
  trackingTemplate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: OfferStatus;
};
type ProgramOption = { id: string; name: string };
type Values = OfferFormValues & { programId: string };
type Errors = Partial<Record<OfferField | "confirmArchive", OfferFieldError | "confirm_archive">>;
/** `id` is the offer's id, or "new". */
export type OfferEdit = { id: string; values: Values; errors: Errors };

const ERROR_KEY: Record<Exclude<OfferFieldError, `url_${string}` | `template_${"braces" | "placeholder" | "placeholder_position" | UrlError}`> | "confirm_archive", MessageKey> = {
  required: "offers.err.required",
  choice: "offers.err.choice",
  date: "offers.err.date",
  date_order: "offers.err.dateOrder",
  program_merchant: "offers.err.programMerchant",
  program_required: "offers.err.programRequired",
  sponsored_unavailable: "offers.err.sponsored",
  template_required: "offers.err.templateRequired",
  template_without_program: "offers.err.templateWithoutProgram",
  same_as_template: "offers.err.sameAsTemplate",
  confirm_archive: "offers.err.confirmArchive",
};

export const NEW_OFFER_VALUES: Values = { programId: "", kind: "official", label: "visit_site", destinationUrl: "", trackingTemplate: "", startsAt: "", endsAt: "", status: "active" };
export const offerValuesOf = (o: OfferView): Values => ({
  programId: o.programId ?? "",
  kind: o.kind,
  label: o.label,
  destinationUrl: o.destinationUrl,
  trackingTemplate: o.trackingTemplate ?? "",
  startsAt: o.startsAt ?? "",
  endsAt: o.endsAt ?? "",
  status: o.status,
});

type FormProps = { locale: Locale; action: string; edit: OfferEdit; current: OfferStatus | null; programs: ProgramOption[]; isDefault: boolean };

const OfferForm: FC<FormProps> = (p) => {
  const tr = translator(p.locale);
  const v = p.edit.values;
  const id = (f: string) => `offers-${p.edit.id}-${f}`;
  const err = (f: OfferField | "confirmArchive"): string | null => {
    const e = p.edit.errors[f];
    if (!e) return null;
    if (e.startsWith("url_")) return tr("offers.err.url", { code: e.slice(4) });
    if (e.startsWith("template_") && e !== "template_required" && e !== "template_without_program") return tr("offers.err.template", { code: e.slice(9) });
    return tr(ERROR_KEY[e as keyof typeof ERROR_KEY]);
  };
  const select = (name: "kind" | "label" | "status", options: readonly string[]) => (
    <select id={id(name)} name={name} {...aria(id(name), p.edit.errors[name])}>
      {options.map((o) => (
        <option value={o} selected={v[name] === o}>
          {name === "status" ? tr(STATUS_KEY[o as OfferStatus]) : o}
        </option>
      ))}
    </select>
  );
  const archived = p.current === "archived";
  return (
    <form method="post" action={p.action} class="card">
      <input type="hidden" name="expectedStatus" value={p.current ?? "active"} />
      <Field id={id("programId")} label={tr("offers.f.program")} error={err("programId")}>
        <select id={id("programId")} name="programId" {...aria(id("programId"), p.edit.errors.programId)}>
          <option value="">{tr("offers.f.noProgram")}</option>
          {p.programs.map((pr) => (
            <option value={pr.id} selected={v.programId === pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={id("kind")} label={tr("offers.f.kind")} error={err("kind")}>
        {select("kind", OFFER_KINDS)}
      </Field>
      <Field id={id("label")} label={tr("offers.f.label")} error={err("label")}>
        {select("label", LABELS)}
      </Field>
      <Field id={id("destinationUrl")} label={tr("partner.field.destinationUrl")} hint={tr("offers.f.destinationHint")} error={err("destinationUrl")}>
        <input id={id("destinationUrl")} name="destinationUrl" type="url" required maxlength={2048} value={v.destinationUrl} {...aria(id("destinationUrl"), p.edit.errors.destinationUrl)} />
      </Field>
      <Field id={id("trackingTemplate")} label={tr("partner.field.trackingTemplate")} hint={tr("offers.f.templateHint")} error={err("trackingTemplate")}>
        <input id={id("trackingTemplate")} name="trackingTemplate" maxlength={2048} value={v.trackingTemplate} {...aria(id("trackingTemplate"), p.edit.errors.trackingTemplate)} />
      </Field>
      <Field id={id("startsAt")} label={tr("offers.f.startsAt")} hint={tr("offers.dateHint")} error={err("startsAt")}>
        <input id={id("startsAt")} name="startsAt" placeholder="YYYY-MM-DDTHH:MM" value={v.startsAt} {...aria(id("startsAt"), p.edit.errors.startsAt)} />
      </Field>
      <Field id={id("endsAt")} label={tr("offers.f.endsAt")} hint={tr("offers.dateHint")} error={err("endsAt")}>
        <input id={id("endsAt")} name="endsAt" placeholder="YYYY-MM-DDTHH:MM" value={v.endsAt} {...aria(id("endsAt"), p.edit.errors.endsAt)} />
      </Field>
      {archived ? (
        <>
          <input type="hidden" name="status" value="archived" />
          <p class="muted">{tr("offers.archivedNote")}</p>
        </>
      ) : (
        <Field id={id("status")} label={tr("offers.f.status")} error={err("status")}>
          {select("status", OFFER_STATUSES)}
        </Field>
      )}
      {p.isDefault && !archived ? (
        <Field id={id("confirmArchive")} label={tr("offers.f.confirmArchive")} error={err("confirmArchive")}>
          <input id={id("confirmArchive")} type="checkbox" name="confirmArchive" value="1" {...aria(id("confirmArchive"), p.edit.errors.confirmArchive)} />
        </Field>
      ) : null}
      <button class="btn" type="submit">
        {tr(p.current === null ? "offers.create" : "offers.save")}
      </button>
    </form>
  );
};

function Preview(p: { locale: Locale; preview: OfferPreview; hasProgram: boolean }) {
  const tr = translator(p.locale);
  const link = (r: OfferPreview["tracked"]) => (r.ok ? <code>{r.url}</code> : tr("offers.preview.invalid", { code: r.error }));
  const now = p.preview.now;
  return (
    <dl class="facts" data-preview>
      <dt>{tr(p.hasProgram ? "offers.preview.tracked" : "offers.preview.own")}</dt>
      <dd class="break">{link(p.preview.tracked)}</dd>
      <dt>{tr("offers.preview.fallback")}</dt>
      <dd class="break">{link(p.preview.fallback)}</dd>
      <dt>{tr("offers.preview.now")}</dt>
      <dd class="break" data-preview-now={now.kind}>
        {tr(now.kind === "tracked" ? "offers.preview.kind.tracked" : now.kind === "fallback" ? "offers.preview.kind.fallback" : "offers.preview.kind.notFound")}{" "}
        {now.kind === "tracked" ? <code>{now.url}</code> : <code>{now.reason}</code>}
        {now.kind === "fallback" ? (
          <>
            {" "}
            <code>{now.url}</code>
          </>
        ) : null}
      </dd>
    </dl>
  );
}

type Props = {
  locale: Locale;
  merchantId: string;
  defaultOfferId: string | null;
  offers: OfferView[];
  programs: ProgramOption[];
  previews: Record<string, OfferPreview>;
  edit?: OfferEdit;
};

export const OfferSection: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = `/admin/merchants/${p.merchantId}`;
  return (
    <>
      <h2>{tr("offers.title")}</h2>
      <p>{tr("offers.intro")}</p>
      {p.offers.length === 0 ? <p class="muted">{tr("offers.empty")}</p> : null}
      {p.offers.map((o) => {
        const isDefault = p.defaultOfferId === o.id;
        const preview = p.previews[o.id];
        return (
          <section aria-label={o.id}>
            <h3>
              <code>{o.id}</code> · <code>{o.label}</code> · {tr(STATUS_KEY[o.status])}
              {isDefault ? ` · ${tr("offers.isDefault")}` : ""}
            </h3>
            {preview ? (
              <>
                <h4>{tr("offers.preview.title")}</h4>
                <Preview locale={p.locale} preview={preview} hasProgram={o.programId !== null} />
              </>
            ) : null}
            {o.status !== "archived" ? (
              <form method="post" action={localizedPath(p.locale, `${base}/default-offer`)}>
                <input type="hidden" name="offerId" value={isDefault ? "" : o.id} />
                <button class="btn btn-ghost" type="submit">
                  {tr(isDefault ? "offers.clearDefault" : "offers.setDefault")}
                </button>
              </form>
            ) : null}
            <OfferForm
              locale={p.locale}
              action={localizedPath(p.locale, `${base}/offers/${o.id}`)}
              edit={p.edit?.id === o.id ? p.edit : { id: o.id, values: offerValuesOf(o), errors: {} }}
              current={o.status}
              programs={p.programs}
              isDefault={isDefault}
            />
          </section>
        );
      })}
      <h3>{tr("offers.new")}</h3>
      <OfferForm
        locale={p.locale}
        action={localizedPath(p.locale, `${base}/offers`)}
        edit={p.edit?.id === "new" ? p.edit : { id: "new", values: NEW_OFFER_VALUES, errors: {} }}
        current={null}
        programs={p.programs}
        isDefault={false}
      />
    </>
  );
};
