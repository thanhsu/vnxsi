import type { FC } from "hono/jsx";
import { AlertIcon } from "./OverviewPage.tsx";
import { MerchantDetailBody, type ProgramEdit, type ProgramView } from "../admin/MerchantDetailPage.tsx";
import { MerchantsBody, type MerchantEdit, type MerchantErrors, type MerchantView } from "../admin/MerchantsPage.tsx";
import type { OfferEdit, OfferView } from "../admin/OfferSection.tsx";
import type { MerchantFormValues } from "../../domain/merchant.ts";
import type { OfferPreview } from "../../domain/offer.ts";
import { OpsLayout, type OpsShell } from "./OpsLayout.tsx";
import { History, tr, type HistoryView } from "./parts.tsx";

/**
 * /ops/monetization/merchants and its detail page (VNX-2508a; spec Ops §2, §3; plan VNX-2508a). The bodies are the ones
 * of /admin/merchants (forms, tables, URL preview, warnings), in OpsLayout, English; the detail adds the audit History.
 */

export const MERCHANTS_PATH = "/ops/monetization/merchants";

/** A link under the merchants root: "" is the list, "/<id>" a merchant, "/<id>/status" an action. */
const link = (sub: string) => MERCHANTS_PATH + sub;

type ListProps = {
  shell: OpsShell;
  merchants: MerchantView[];
  create: { values: MerchantFormValues; errors: MerchantErrors; status: "active" | "paused" };
};

export const MerchantsListPage: FC<ListProps> = ({ shell, merchants, create }) => (
  <OpsLayout {...shell} page={tr("ops.nav.merchants")} trail={[tr("ops.group.monetization")]}>
    <div class="ops-legacy">
      <MerchantsBody locale="en" link={link} merchants={merchants} create={create} />
    </div>
  </OpsLayout>
);

/** What the page says above the form besides the "Saved." of the body: a lost race, or a request that was not valid. */
export type MerchantNotice = "done" | "conflict" | "bad_request" | null;

type DetailProps = {
  shell: OpsShell;
  merchant: MerchantView;
  programs: ProgramView[];
  offers: OfferView[];
  previews: Record<string, OfferPreview>;
  notice: MerchantNotice;
  merchantEdit?: MerchantEdit;
  programEdit?: ProgramEdit;
  offerEdit?: OfferEdit;
  history: HistoryView;
};

export const MerchantDetailPage: FC<DetailProps> = ({ shell, notice, history, ...body }) => (
  <OpsLayout {...shell} page={body.merchant.name} trail={[tr("ops.group.monetization"), tr("ops.nav.merchants")]}>
    {notice === "conflict" || notice === "bad_request" ? (
      <p class="ops-notice ops-notice-warn" role="alert">
        <AlertIcon />
        {tr(notice === "conflict" ? "ops.notice.conflict" : "ops.merchants.badRequest")}
      </p>
    ) : null}
    <div class="ops-legacy">
      <MerchantDetailBody locale="en" link={link} done={notice === "done"} {...body} />
    </div>
    <div class="ops-legacy-after">
      <History history={history} empty={tr("ops.merchants.noHistory")} />
    </div>
  </OpsLayout>
);
