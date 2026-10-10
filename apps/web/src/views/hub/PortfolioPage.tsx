import type { FC } from "hono/jsx";
import { MAX_PORTFOLIO_ITEMS, type PortfolioErrors, type PortfolioField, type PortfolioFormValues, type PortfolioItem } from "../../domain/portfolio.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";
import { PlainText } from "../PlainText.tsx";
import { HubLayout } from "./HubLayout.tsx";

const EXTERNAL = "nofollow ugc noopener";
const ERROR_KEY: Record<PortfolioField, MessageKey> = {
  title: "portfolio.error.title",
  url: "portfolio.error.url",
  description: "portfolio.error.description",
};

const LABEL: Record<PortfolioField, MessageKey> = { title: "portfolio.field.title", url: "portfolio.field.url", description: "portfolio.field.description" };

/** Summary lines in field order (VNX-0807): "Label: error", linked to the control. */
function portfolioErrorItems(errors: PortfolioErrors, tr: Translate): FormErrorItem[] {
  return (["title", "url", "description"] as const).filter((f) => errors[f]).map((f) => ({ href: `#pf-${f}`, message: `${tr(LABEL[f])}: ${tr(ERROR_KEY[f])}` }));
}

const PortfolioForm: FC<{ locale: Locale; action: string; values: PortfolioFormValues; errors: PortfolioErrors; submitLabel: string }> = (p) => {
  const tr = translator(p.locale);
  const field = (name: PortfolioField, label: MessageKey, control: (aria: Record<string, string | undefined>) => unknown) => (
    <div class="field">
      <label for={`pf-${name}`}>{tr(label)}</label>
      {control({ "aria-invalid": p.errors[name] ? "true" : undefined, "aria-describedby": p.errors[name] ? `pf-${name}-error` : undefined })}
      {p.errors[name] ? (
        <p id={`pf-${name}-error`} class="error-msg">
          {tr(ERROR_KEY[name])}
        </p>
      ) : null}
    </div>
  );
  return (
    <form method="post" action={p.action}>
      <FormErrorSummary tr={tr} items={portfolioErrorItems(p.errors, tr)} />
      {field("title", "portfolio.field.title", (aria) => (
        <input id="pf-title" name="title" value={p.values.title} required maxlength={80} {...aria} />
      ))}
      {field("url", "portfolio.field.url", (aria) => (
        <input id="pf-url" name="url" type="url" value={p.values.url} maxlength={500} placeholder="https://" {...aria} />
      ))}
      {field("description", "portfolio.field.description", (aria) => (
        <textarea id="pf-description" name="description" rows={3} maxlength={500} {...aria}>
          {p.values.description}
        </textarea>
      ))}
      <button class="btn" type="submit">
        {p.submitLabel}
      </button>
    </form>
  );
};

type ListProps = { locale: Locale; origin: string; items: PortfolioItem[]; values: PortfolioFormValues; errors: PortfolioErrors; editable: boolean };

export const PortfolioPage: FC<ListProps> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/hub/portfolio");
  const move = (item: PortfolioItem, direction: "up" | "down", label: MessageKey, aria: MessageKey) => (
    <form method="post" action={`${base}/${item.id}/move`}>
      <input type="hidden" name="direction" value={direction} />
      <button class="link" type="submit" aria-label={tr(aria, { title: item.title })}>
        {tr(label)}
      </button>
    </form>
  );
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("portfolio.title")} rest="/hub/portfolio" active="portfolio" invalid={p.editable && p.items.length < MAX_PORTFOLIO_ITEMS && portfolioErrorItems(p.errors, tr).length > 0}>
      <h1>{tr("portfolio.title")}</h1>
      <p>{tr("portfolio.intro", { max: MAX_PORTFOLIO_ITEMS })}</p>
      {p.items.length === 0 ? (
        <p class="muted">{tr("portfolio.empty")}</p>
      ) : (
        <ol class="portfolio-list">
          {p.items.map((item, index) => (
            <li>
              <h2>{item.title}</h2>
              {item.url ? (
                <p>
                  <a href={item.url} rel={EXTERNAL} target="_blank">
                    {item.url}
                  </a>
                </p>
              ) : null}
              {item.description ? <PlainText text={item.description} /> : null}
              {p.editable ? (
                <div class="row-actions">
                  <a href={`${base}/${item.id}`} aria-label={tr("portfolio.editItem", { title: item.title })}>
                    {tr("portfolio.edit")}
                  </a>
                  {index > 0 ? move(item, "up", "portfolio.moveUp", "portfolio.moveUpItem") : null}
                  {index < p.items.length - 1 ? move(item, "down", "portfolio.moveDown", "portfolio.moveDownItem") : null}
                  <form method="post" action={`${base}/${item.id}/delete`}>
                    <button class="link" type="submit" aria-label={tr("portfolio.deleteItem", { title: item.title })}>
                      {tr("portfolio.delete")}
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {!p.editable ? null : p.items.length >= MAX_PORTFOLIO_ITEMS ? (
        <p class="notice">{tr("portfolio.full", { max: MAX_PORTFOLIO_ITEMS })}</p>
      ) : (
        <section class="card wide">
          <h2>{tr("portfolio.add")}</h2>
          <PortfolioForm locale={p.locale} action={base} values={p.values} errors={p.errors} submitLabel={tr("portfolio.add")} />
        </section>
      )}
    </HubLayout>
  );
};

type EditProps = { locale: Locale; origin: string; item: PortfolioItem; values: PortfolioFormValues; errors: PortfolioErrors };

export const PortfolioEditPage: FC<EditProps> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, "/hub/portfolio");
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("portfolio.editTitle")} rest={`/hub/portfolio/${p.item.id}`} active="portfolio" invalid={portfolioErrorItems(p.errors, tr).length > 0}>
      <section class="card wide">
        <h1>{tr("portfolio.editTitle")}</h1>
        <PortfolioForm locale={p.locale} action={`${base}/${p.item.id}`} values={p.values} errors={p.errors} submitLabel={tr("portfolio.save")} />
        <p>
          <a href={base}>{tr("portfolio.back")}</a>
        </p>
      </section>
    </HubLayout>
  );
};
