import type { FC } from "hono/jsx";
import { PRODUCT_STATUSES, type ProductStatus, type ProductWithBuilder } from "../../domain/product.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { CATEGORY_KEY, PRODUCT_STATUS_KEY } from "../labels.ts";
import { AdminLayout } from "./AdminLayout.tsx";

type Props = { locale: Locale; origin: string; view: "status" | "edited"; status: ProductStatus; items: ProductWithBuilder[] };

export const ProductsQueuePage: FC<Props> = (p) => {
  const tr = translator(p.locale);
  return (
    <AdminLayout locale={p.locale} origin={p.origin} title={tr("admin.nav.products")} rest="/admin/products" active="products">
      <h1>{tr("admin.nav.products")}</h1>
      <nav class="subnav" aria-label={tr("admin.builders.filter")}>
        {PRODUCT_STATUSES.map((s) => (
          <a href={localizedPath(p.locale, `/admin/products?status=${s}`)} aria-current={p.view === "status" && s === p.status ? "page" : undefined}>
            {tr(PRODUCT_STATUS_KEY[s])}
          </a>
        ))}
        <a href={localizedPath(p.locale, "/admin/products?view=edited")} aria-current={p.view === "edited" ? "page" : undefined}>
          {tr("admin.products.edited")}
        </a>
      </nav>
      {p.items.length === 0 ? (
        <p class="muted">{tr("admin.products.empty")}</p>
      ) : (
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{tr("product.field.name")}</th>
                <th>{tr("admin.col.handle")}</th>
                <th>{tr("product.field.category")}</th>
                <th>{tr(p.view === "edited" ? "admin.products.editedAt" : "admin.products.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr>
                  <td>
                    <a href={localizedPath(p.locale, `/admin/products/${item.product.id}`)}>{item.product.name}</a>
                  </td>
                  <td>{item.builderHandle}</td>
                  <td>{item.product.category ? tr(CATEGORY_KEY[item.product.category]) : "—"}</td>
                  <td>{(p.view === "edited" ? item.product.editedAfterPublishAt : item.product.updatedAt)?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};
