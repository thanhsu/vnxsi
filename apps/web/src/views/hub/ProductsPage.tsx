import type { FC } from "hono/jsx";
import type { FieldErrorCode } from "../../domain/product-input.ts";
import type { Product } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { FormErrorSummary } from "../FormErrorSummary.tsx";
import { PRODUCT_STATUS_KEY } from "../labels.ts";
import { HubLayout } from "./HubLayout.tsx";
import { PRODUCT_ERROR_KEY } from "./ProductStepForm.tsx";

type Props = { locale: Locale; origin: string; products: Product[]; name: string; error: FieldErrorCode | null; canCreate: boolean };

export const ProductsPage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const items = p.error && p.canCreate ? [{ href: "#new-name", message: `${tr("products.newName")}: ${tr(PRODUCT_ERROR_KEY[p.error], { max: 80, items: 0 })}` }] : [];
  return (
    <HubLayout locale={p.locale} origin={p.origin} title={tr("products.title")} rest="/hub/products" active="products" invalid={items.length > 0}>
      <h1>{tr("products.title")}</h1>
      {p.products.length === 0 ? (
        <p class="muted">{tr("products.empty")}</p>
      ) : (
        <ul class="portfolio-list">
          {p.products.map((product) => (
            <li>
              <h2>
                <a href={localizedPath(p.locale, `/hub/products/${product.id}/edit/product`)}>{product.name}</a>
              </h2>
              <p>
                <span class={`badge badge-${product.status}`}>{tr(PRODUCT_STATUS_KEY[product.status])}</span> <span class="muted">{product.updatedAt.slice(0, 10)}</span>
                {product.status === "published" ? (
                  <>
                    {" · "}
                    <a href={localizedPath(p.locale, `/p/${product.slug}`)}>{tr("products.viewPublic")}</a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
      {p.canCreate ? (
        <section class="card wide">
          <h2>{tr("products.create")}</h2>
          <form method="post" action={localizedPath(p.locale, "/hub/products")}>
            <FormErrorSummary tr={tr} items={items} />
            <div class="field">
              <label for="new-name">{tr("products.newName")}</label>
              <input
                id="new-name"
                name="name"
                value={p.name}
                required
                maxlength={80}
                aria-invalid={p.error ? "true" : undefined}
                aria-describedby={p.error ? "new-name-error" : undefined}
              />
              {p.error ? (
                <p id="new-name-error" class="error-msg">
                  {tr(PRODUCT_ERROR_KEY[p.error], { max: 80, items: 0 })}
                </p>
              ) : null}
            </div>
            <button class="btn" type="submit">
              {tr("products.create")}
            </button>
          </form>
        </section>
      ) : null}
    </HubLayout>
  );
};
