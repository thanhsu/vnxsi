import type { FC } from "hono/jsx";
import type { ClientBoardAction, PublicationStatus } from "../../domain/request-board.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { PlainText } from "../PlainText.tsx";

/**
 * What the block may know about the client's own listing. A projection, not the row: no request id, no consent version, no reviewer.
 * `publicId` is set only while the public page can be opened (the route decides with the one visibility function and the gate), and the
 * public wording only while the listing is published, so a withdrawn listing that kept its wording shows nothing of it here.
 */
export type ListingView = {
  status: PublicationStatus;
  publicId: string | null;
  publicTitle: string | null;
  publicDescription: string | null;
  reviewNote: string | null;
};

/**
 * VNX-2703b (addendum 4.3, 12.2): the "Public listing" block of /me/requests/:id. `actions` is `clientBoardActions(...)`, the same rule the
 * route enforces, so a button never shows that the POST would refuse. Plain forms, no script; the actions carry no fragment.
 */
export const PublicListingBlock: FC<{ locale: Locale; base: string; listing: ListingView | null; actions: readonly ClientBoardAction[] }> = ({ locale, base, listing, actions }) => {
  const tr = translator(locale);
  const canOptIn = actions.includes("opt_in") || actions.includes("re_opt_in");
  if (!listing && !canOptIn) return null;
  const ended = listing?.status === "rejected" || listing?.status === "unpublished";
  return (
    <section class="card wide" id="me-board" aria-labelledby="me-board-title">
      <h2 id="me-board-title">{tr("me.board.title")}</h2>
      {listing?.status === "pending_review" ? <p>{tr("me.board.pending")}</p> : null}
      {listing?.status === "published" ? (
        <>
          <p>{tr("me.board.live")}</p>
          <h3>{listing.publicTitle}</h3>
          {listing.publicDescription ? <PlainText text={listing.publicDescription} /> : null}
          {listing.publicId ? (
            <p>
              <a href={localizedPath(locale, `/requests/${listing.publicId}`)}>{tr("me.board.viewPublic")}</a>
            </p>
          ) : null}
        </>
      ) : null}
      {listing?.status === "withdrawn" ? <p>{tr("me.board.removed")}</p> : null}
      {ended ? (
        <>
          <p>{tr(listing?.status === "rejected" ? "me.board.rejectedReason" : "me.board.unpublishedReason")}</p>
          {listing?.reviewNote ? <PlainText text={listing.reviewNote} /> : null}
          <p class="hint">{tr("me.board.finalNote")}</p>
        </>
      ) : null}
      {canOptIn ? (
        <form method="post" action={`${base}/publication/opt-in`}>
          <p>
            <strong>{tr("request.board.optIn.label")}</strong>
          </p>
          <p class="hint">{tr("request.board.optIn.hint")}</p>
          <button class="btn btn-primary" type="submit">
            {tr(actions.includes("re_opt_in") ? "me.board.reOptIn" : "me.board.optIn")}
          </button>
        </form>
      ) : null}
      {actions.includes("withdraw") ? (
        <form method="post" action={`${base}/publication/withdraw`}>
          <p class="hint">{tr("me.board.removeHint")}</p>
          <button class="btn btn-ghost" type="submit">
            {tr("me.board.remove")}
          </button>
        </form>
      ) : null}
    </section>
  );
};
