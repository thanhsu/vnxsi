import type { RequestInvite } from "../domain/request.ts";
import type { Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { formatUsd } from "./format.ts";

/** Spec §5.7 step 3: an amount, a range, or "to discuss". */
export function proposalPrice(locale: Locale, invite: Pick<RequestInvite, "priceCents" | "priceMaxCents">): string {
  const tr = translator(locale);
  if (invite.priceCents === null) return tr("proposal.price.discuss");
  if (invite.priceMaxCents === null) return formatUsd(locale, invite.priceCents);
  return tr("proposal.price.range", { min: formatUsd(locale, invite.priceCents), max: formatUsd(locale, invite.priceMaxCents) });
}
