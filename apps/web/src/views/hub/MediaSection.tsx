import type { FC } from "hono/jsx";
import { MAX_MEDIA, type ProductMedia } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import { localizedPath } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator, type Translate } from "../../i18n/t.ts";
import { FormErrorSummary, type FormErrorItem } from "../FormErrorSummary.tsx";

/** "unavailable": no R2 binding yet (VNX-0711). */
export type MediaErrorCode = "missing" | "type" | "size" | "full" | "alt" | "unavailable";

const ERROR_KEY: Record<MediaErrorCode, MessageKey> = {
  missing: "media.error.missing",
  type: "media.error.type",
  size: "media.error.size",
  full: "media.error.full",
  alt: "media.error.alt",
  unavailable: "media.unavailable",
};

type Props = {
  locale: Locale;
  productId: string;
  productName: string;
  media: ProductMedia[];
  error: MediaErrorCode | null;
  editable: boolean;
  /** False while there is no R2 binding (VNX-0711): a notice replaces the upload form and the delete buttons. */
  enabled: boolean;
};

/**
 * Summary line of the media upload (VNX-0807). Linked to the control only while the upload form is on the page;
 * "unavailable" (no R2 binding) is a state of the whole section, so it is an unlinked line.
 */
export function mediaErrorItems(p: Pick<Props, "error" | "media" | "editable" | "enabled">, tr: Translate): FormErrorItem[] {
  if (!p.error) return [];
  const formShown = p.editable && p.enabled && p.media.length < MAX_MEDIA;
  const href = !formShown || p.error === "unavailable" ? "" : p.error === "alt" ? "#media-alt" : "#media-file";
  return [{ href, message: tr(ERROR_KEY[p.error]) }];
}

export const MediaSection: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, `/hub/products/${p.productId}/media`);
  const items = mediaErrorItems(p, tr);
  return (
    <section class="media-section">
      <h3>{tr("media.title")}</h3>
      {p.media.length === 0 ? (
        <p class="muted">{tr("media.empty")}</p>
      ) : (
        <ul class="media-grid">
          {p.media.map((m) => (
            <li>
              <img src={`/media/${m.r2Key}`} alt={m.alt || p.productName} width={160} loading="lazy" />
              {p.editable && p.enabled ? (
                <form method="post" action={`${base}/${m.id}/delete`}>
                  <button class="link" type="submit" aria-label={tr("media.deleteItem", { alt: m.alt || p.productName })}>
                    {tr("media.delete")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {p.editable && !p.enabled ? (
        <p class="notice">
          {tr("media.unavailable")}
        </p>
      ) : null}
      <FormErrorSummary tr={tr} items={items} />
      {p.error && p.error !== "unavailable" ? (
        <p id="media-error" class="error-msg">
          {tr(ERROR_KEY[p.error])}
        </p>
      ) : null}
      {p.editable && p.enabled && p.media.length < MAX_MEDIA ? (
        <form method="post" action={base} enctype="multipart/form-data">
          <div class="field">
            <label for="media-file">{tr("media.file")}</label>
            <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby={p.error && p.error !== "alt" && p.error !== "unavailable" ? "media-hint media-error" : "media-hint"} {...(p.error && p.error !== "alt" && p.error !== "unavailable" ? { "aria-invalid": "true" } : {})} />
            <p id="media-hint" class="hint">
              {tr("media.hint")}
            </p>
          </div>
          <div class="field">
            <label for="media-alt">{tr("media.alt")}</label>
            <input id="media-alt" name="alt" maxlength={150} {...(p.error === "alt" ? { "aria-invalid": "true", "aria-describedby": "media-error" } : {})} />
          </div>
          <button class="btn" type="submit">
            {tr("media.upload")}
          </button>
        </form>
      ) : null}
    </section>
  );
};
