import type { FC } from "hono/jsx";
import { MAX_MEDIA, type ProductMedia } from "../../domain/product.ts";
import type { Locale } from "../../i18n/locales.ts";
import { localizedPath } from "../../i18n/locales.ts";
import type { MessageKey } from "../../i18n/messages/en.ts";
import { translator } from "../../i18n/t.ts";

export type MediaErrorCode = "missing" | "type" | "size" | "full" | "alt";

const ERROR_KEY: Record<MediaErrorCode, MessageKey> = {
  missing: "media.error.missing",
  type: "media.error.type",
  size: "media.error.size",
  full: "media.error.full",
  alt: "media.error.alt",
};

type Props = { locale: Locale; productId: string; productName: string; media: ProductMedia[]; error: MediaErrorCode | null; editable: boolean };

export const MediaSection: FC<Props> = (p) => {
  const tr = translator(p.locale);
  const base = localizedPath(p.locale, `/hub/products/${p.productId}/media`);
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
              {p.editable ? (
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
      {p.error ? (
        <p id="media-error" class="error-msg" role="alert">
          {tr(ERROR_KEY[p.error])}
        </p>
      ) : null}
      {p.editable && p.media.length < MAX_MEDIA ? (
        <form method="post" action={base} enctype="multipart/form-data">
          <div class="field">
            <label for="media-file">{tr("media.file")}</label>
            <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="media-hint" />
            <p id="media-hint" class="hint">
              {tr("media.hint")}
            </p>
          </div>
          <div class="field">
            <label for="media-alt">{tr("media.alt")}</label>
            <input id="media-alt" name="alt" maxlength={150} />
          </div>
          <button class="btn" type="submit">
            {tr("media.upload")}
          </button>
        </form>
      ) : null}
    </section>
  );
};
