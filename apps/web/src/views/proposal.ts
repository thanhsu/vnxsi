import type { ClientRequest, RequestInvite } from "../domain/request.ts";
import { isLocale, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";

/** Spec §5.7 step 3: an amount, a range, or "to discuss". */
export function proposalPrice(locale: Locale, invite: Pick<RequestInvite, "priceCents" | "priceMaxCents">): string {
  const tr = translator(locale);
  if (invite.priceCents === null) return tr("proposal.price.discuss");
  if (invite.priceMaxCents === null) return formatUsd(locale, invite.priceCents);
  return tr("proposal.price.range", { min: formatUsd(locale, invite.priceCents), max: formatUsd(locale, invite.priceMaxCents) });
}

/**
 * Spec §5.7 step 4: the first message of the inquiry made from a request: the request, then the chosen proposal,
 * labelled in the request's language. Only what the client typed; no e-mail.
 */
export function requestFirstMessage(
  request: Pick<ClientRequest, "title" | "description" | "locale">,
  invite: Pick<RequestInvite, "approach" | "priceCents" | "priceMaxCents" | "priceNote" | "timelineDays">,
): string {
  const locale = isLocale(request.locale) ? request.locale : "en";
  const tr = translator(locale);
  const note = invite.priceNote ? ` (${invite.priceNote})` : "";
  return [
    tr("request.inquiry.request", { title: request.title }),
    request.description,
    tr("request.inquiry.proposal"),
    invite.approach ?? "",
    `${tr("proposal.price")}: ${proposalPrice(locale, invite)}${note}`,
    `${tr("proposal.timeline")}: ${tr("proposal.days", { n: invite.timelineDays ?? 0 })}`,
  ].join("\n\n");
}
