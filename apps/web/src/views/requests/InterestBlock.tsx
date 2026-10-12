import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";

/**
 * The call to action of addendum §4.2, decided by the route from the one visibility function and the viewer relation.
 * `own` carries the link to the client's own request page (the route builds it; the view never sees a request id).
 * `approved` is the builder who may express interest: VNX-2706a puts the form here; until then it shows nothing.
 */
export type Cta = { kind: "signed_out"; next: string } | { kind: "not_builder" } | { kind: "pending_builder" } | { kind: "own"; href: string } | { kind: "approved" } | { kind: "closed" };

export const InterestBlock: FC<{ locale: Locale; cta: Cta }> = ({ locale, cta }) => {
  const tr = translator(locale);
  if (cta.kind === "approved") return null;
  return (
    <section class="card wide" aria-label={tr("board.cta.label")}>
      {cta.kind === "signed_out" ? (
        <a class="btn" href={`${localizedPath(locale, "/login")}?next=${encodeURIComponent(cta.next)}`}>
          {tr("board.cta.signedOut")}
        </a>
      ) : null}
      {cta.kind === "not_builder" ? (
        <p>
          {tr("board.cta.notBuilder")} <a href={localizedPath(locale, "/for-builders")}>{tr("nav.forBuilders")}</a>
        </p>
      ) : null}
      {cta.kind === "pending_builder" ? <p>{tr("board.cta.pendingBuilder")}</p> : null}
      {cta.kind === "own" ? (
        <p>
          <a href={cta.href}>{tr("board.cta.ownRequest")}</a>
        </p>
      ) : null}
      {cta.kind === "closed" ? (
        <>
          <p>{tr("board.cta.closed")}</p>
          <a class="btn" href={localizedPath(locale, "/request")}>
            {tr("board.cta.post")}
          </a>
        </>
      ) : null}
    </section>
  );
};
