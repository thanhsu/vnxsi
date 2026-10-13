import type { FC, PropsWithChildren } from "hono/jsx";
import type { ClientBoardAction } from "../../domain/request-board.ts";
import type { ClientRequest } from "../../domain/request.ts";
import { localizedPath, type Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { REQUEST_STATUS_KEY } from "../labels.ts";
import { Layout } from "../Layout.tsx";
import { PlainText } from "../PlainText.tsx";
import { FormErrorSummary } from "../FormErrorSummary.tsx";
import { RequestFacts } from "../RequestFacts.tsx";
import { PublicListingBlock, type ListingView } from "./PublicListingBlock.tsx";

/**
 * Spec §5.4: the client's request, its status and (Task 6) the proposals passed as children. VNX-2703b: the "Public listing" block; `conflict` is a refused
 * opt-in or withdrawal (409): the page then shows the current state under the shared error summary (VNX-0807), one item that belongs to no field.
 */
export const RequestPage: FC<PropsWithChildren<{ locale: Locale; origin: string; request: ClientRequest; sent: boolean; listing: ListingView | null; boardActions: readonly ClientBoardAction[]; conflict?: boolean }>> = ({ locale, origin, request, sent, listing, boardActions, conflict, children }) => {
  const tr = translator(locale);
  const base = localizedPath(locale, `/me/requests/${request.id}`);
  const open = request.status === "submitted" || request.status === "matching";
  return (
    <Layout locale={locale} title={`${request.title} · VNX.SI`} origin={origin} rest={`/me/requests/${request.id}`} noindex signedIn invalid={conflict}>
      <p>
        <a href={localizedPath(locale, "/me")}>{tr("me.title")}</a>
      </p>
      <FormErrorSummary tr={tr} items={conflict ? [{ href: "", message: tr("me.board.error.conflict") }] : []} />
      <h1>{request.title}</h1>
      <p>
        <span class={`badge badge-request-${request.status}`}>{tr(REQUEST_STATUS_KEY[request.status])}</span>
      </p>
      {request.status === "pending_verification" ? (
        <div class="notice">
          <p>{tr("request.page.pending")}</p>
          <form method="post" action={`${base}/confirm`}>
            <button class="btn" type="submit">
              {tr("me.sendNow")}
            </button>
          </form>
        </div>
      ) : null}
      {open ? (
        <p class={sent ? "notice good" : "notice"} role={sent ? "status" : undefined}>
          {tr("request.page.submitted")}
        </p>
      ) : null}
      {request.status === "rejected" ? (
        <div class="notice">
          <p>{tr("request.page.rejected")}</p>
          {request.adminNote ? <PlainText text={request.adminNote} /> : null}
        </div>
      ) : null}
      {request.status === "expired" ? <p class="notice">{tr("request.page.expired")}</p> : null}
      {request.status === "closed" ? <p class="notice">{tr("request.page.closed")}</p> : null}
      <section class="card wide">
        <RequestFacts locale={locale} request={request} />
      </section>
      <PublicListingBlock locale={locale} base={base} listing={listing} actions={boardActions} />
      {children}
      {open ? (
        <form method="post" action={`${base}/close`}>
          <p class="hint">{tr("request.page.closeHint")}</p>
          <button class="link" type="submit">
            {tr("request.page.close")}
          </button>
        </form>
      ) : null}
      {!open && request.status !== "pending_verification" ? (
        <p>
          <a href={localizedPath(locale, "/request")}>{tr("request.page.postAnother")}</a>
        </p>
      ) : null}
    </Layout>
  );
};
