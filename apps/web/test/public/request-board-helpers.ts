import { createApp } from "../../src/app.ts";
import { resetFlagCache, setFlag } from "../../src/db/flags.ts";
import { publicId } from "../../src/lib/ulid.ts";
import type { Bindings } from "../../src/env.ts";
import type { Category } from "../../src/domain/product.ts";
import type { WorkLanguage } from "../../src/domain/builder.ts";
import type { PublicationStatus } from "../../src/domain/request-board.ts";
import { ensureUser, makeRequest } from "../fixtures.ts";
import { getReq, testEnv } from "../helpers.ts";

/** VNX-2705a: shared setup of the public board tests. Rows are written straight to the DB, as Ops/clients would have left them. */

export const GO_LIVE = "2026-01-01";
export const boardEnv: Bindings = { ...testEnv, REQUEST_BOARD_GO_LIVE: GO_LIVE };
export const tag = () => crypto.randomUUID().slice(0, 8);
export const app = () => createApp();

export async function boardFlag(enabled: boolean): Promise<void> {
  const admin = await ensureUser("pub-board-admin@vnx.si");
  await setFlag(testEnv.DB, { key: "request_board", enabled, actorUserId: admin.id, now: new Date().toISOString() });
  resetFlagCache();
}

export const get = (path: string, cookie?: string, bindings: Bindings = boardEnv) => app().request(getReq(path, cookie), undefined, bindings);

export type Listed = {
  publicId: string;
  requestId: string;
  clientId: string;
  clientEmail: string;
  ids: { client: string; original: string; adminNote: string; email: string };
};

export type ListingOpts = {
  requestStatus?: string;
  closedAt?: string | null;
  pubStatus?: PublicationStatus;
  publishedAt?: string;
  publicTitle?: string;
  publicDescription?: string;
  category?: Category;
  languages?: WorkLanguage[];
  country?: string | null;
  deadline?: string | null;
  budget?: string;
  clientLocale?: string;
  publicIdValue?: string;
  tag?: string;
};

/**
 * A client, a request with recognisable private strings (never to appear on a public page) and a publication row. `pubStatus` defaults to
 * published; the public wording is set for every status so a hidden listing that keeps its wording proves the 404 hides it.
 */
export async function listed(o: ListingOpts = {}): Promise<Listed> {
  const t = o.tag ?? tag();
  const ids = { client: `ZQX-CLIENT-NAME-${t}`, original: `ZQX-ORIGINAL-TITLE-${t}`, adminNote: `ZQX-ADMIN-NOTE-${t}`, email: `zqx-${t}@private.example` };
  const made = await makeRequest({
    tag: `zqx${t}`,
    clientName: ids.client,
    title: ids.original,
    description: `ZQX-ORIGINAL-DESCRIPTION-${t} private details only the client and Ops may read.`,
    category: o.category,
    languages: o.languages,
    clientLocale: o.clientLocale,
  });
  const status = o.requestStatus ?? "submitted";
  await testEnv.DB
    .prepare("UPDATE requests SET status = ?2, closed_at = ?3, country = ?4, deadline = ?5, budget_band = ?6, admin_note = ?7 WHERE id = ?1")
    .bind(made.request.id, status, o.closedAt ?? null, o.country ?? null, o.deadline ?? null, o.budget ?? "2k-10k", ids.adminNote)
    .run();
  const pid = o.publicIdValue ?? publicId();
  const pubStatus = o.pubStatus ?? "published";
  const at = o.publishedAt ?? new Date().toISOString();
  const reviewer = await ensureUser(`zqx-ops-${t}@vnx.si`);
  await testEnv.DB
    .prepare(
      `INSERT INTO request_publications (request_id, public_id, status, public_title, public_description, opted_in_at, consent_version, reviewed_by, reviewed_at, review_note, published_at, created_at, updated_at, write_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?6, ?9, ?6, ?6, ?6, ?10)`,
    )
    .bind(made.request.id, pid, pubStatus, o.publicTitle ?? `Public title ${t}`, o.publicDescription ?? `Public wording ${t}: a booking app for three small salons, with reminders by SMS.`, at, GO_LIVE, reviewer.id, ids.adminNote, `W${t}`)
    .run();
  return { publicId: pid, requestId: made.request.id, clientId: made.client.id, clientEmail: made.client.email, ids };
}

export const mainOf = (html: string) => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
