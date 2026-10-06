import type { Context, Hono } from "hono";
import { opsNotFound, requireOps } from "../auth/ops.ts";
import type { AppEnv } from "../env.ts";
import type { IsRegistered } from "../ops/menu.ts";
import { MERCHANTS_PATH, MerchantDetailPage, MerchantsListPage, type MerchantNotice } from "../views/ops/MerchantsPages.tsx";
import { page } from "../views/render.ts";
import {
  createMerchantAction,
  createOfferAction,
  createProgramAction,
  loadMerchantDetail,
  loadMerchants,
  merchantOfRequest,
  NEW_MERCHANT,
  setDefaultOfferAction,
  setMerchantStatusAction,
  updateMerchantAction,
  updateOfferAction,
  updateProgramAction,
  type DetailExtra,
  type Merchant,
  type MerchantSurface,
} from "./admin-merchants.tsx";
import { opsShell, registeredPaths } from "./ops.tsx";
import { historyOf } from "./ops-marketplace.tsx";

/**
 * Ops Monetization › Merchants (VNX-2508a; spec Ops §2, §3, §7). Pages need monetization.view, every POST
 * monetization.act (the Owner's alone); anyone else gets the sealed 404 of requireOps. The actions are the /admin ones
 * (createMerchantAction and the rest of admin-merchants.tsx): same rules, writes, audit and compare-and-set. Only the
 * answers differ: OpsLayout in English, the sealed 404 for an unknown id, and a 409 that shows the current state.
 */

export function registerOpsMonetizationRoutes(app: Hono<AppEnv>) {
  const isRegistered: IsRegistered = registeredPaths(app);

  async function detail(c: Context<AppEnv>, merchant: Merchant, extra: DetailExtra, status: 200 | 400 | 409, notice: MerchantNotice) {
    const [shell, data, history] = await Promise.all([opsShell(c, isRegistered, MERCHANTS_PATH), loadMerchantDetail(c, merchant), historyOf(c, "merchant", merchant.id)]);
    return page(c, <MerchantDetailPage shell={shell} merchant={merchant} {...data} notice={notice} {...extra} history={history} />, status);
  }

  const surface: MerchantSurface = {
    list: async (c, create, status) => {
      const [shell, merchants] = await Promise.all([opsShell(c, isRegistered, MERCHANTS_PATH), loadMerchants(c)]);
      return page(c, <MerchantsListPage shell={shell} merchants={merchants} create={create} />, status);
    },
    detail: (c, merchant, extra, status) => detail(c, merchant, extra, status, null),
    notFound: opsNotFound,
    // Nothing was written. Show the row as it is now, as a 409.
    conflict: async (c) => {
      const current = await merchantOfRequest(c);
      return current ? detail(c, current, {}, 409, "conflict") : opsNotFound(c);
    },
    badRequest: (c, merchant) => detail(c, merchant, {}, 400, "bad_request"),
    done: (c, id) => c.redirect(`${MERCHANTS_PATH}/${id}?done=1`, 303),
  };

  app.get(MERCHANTS_PATH, requireOps("monetization.view"), (c) => surface.list(c, NEW_MERCHANT, 200));
  app.post(MERCHANTS_PATH, requireOps("monetization.act"), (c) => createMerchantAction(c, surface));
  app.get(`${MERCHANTS_PATH}/:id`, requireOps("monetization.view"), async (c) => {
    const merchant = await merchantOfRequest(c);
    return merchant ? detail(c, merchant, {}, 200, c.req.query("done") === "1" ? "done" : null) : opsNotFound(c);
  });
  app.post(`${MERCHANTS_PATH}/:id`, requireOps("monetization.act"), (c) => updateMerchantAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/status`, requireOps("monetization.act"), (c) => setMerchantStatusAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/programs`, requireOps("monetization.act"), (c) => createProgramAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/programs/:programId`, requireOps("monetization.act"), (c) => updateProgramAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/offers`, requireOps("monetization.act"), (c) => createOfferAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/offers/:offerId`, requireOps("monetization.act"), (c) => updateOfferAction(c, surface));
  app.post(`${MERCHANTS_PATH}/:id/default-offer`, requireOps("monetization.act"), (c) => setDefaultOfferAction(c, surface));
}
