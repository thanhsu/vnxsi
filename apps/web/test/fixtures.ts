import { createSession } from "../src/auth/sessions.ts";
import { createBuilder,setBuilderStatus } from "../src/db/builders.ts";
import { createInquiry, setInquiryStatus } from "../src/db/inquiries.ts";
import { addMedia } from "../src/db/media.ts";
import { replaceTiers } from "../src/db/pricing.ts";
import { createRequest, inviteBuildersBatch, listRequestInvites } from "../src/db/requests.ts";
import { createProductDraft, findProductById, setProductStatus, updateProductFields } from "../src/db/products.ts";
import { grantBadge } from "../src/db/verifications.ts";
import { createUser, findUserByEmail, type UserRow } from "../src/db/users.ts";
import type { Builder, BuilderProfile, BuilderStatus, WorkLanguage } from "../src/domain/builder.ts";
import { parseBuilderProfile, type BuilderFormValues } from "../src/domain/builder-input.ts";
import type { TierInput } from "../src/domain/pricing-input.ts";
import type { ProductFields } from "../src/domain/product-input.ts";
import type { Inquiry, InquiryStatus, InquiryType } from "../src/domain/inquiry.ts";
import type { ClientRequest, RequestInvite, RequestStatus } from "../src/domain/request.ts";
import type { BadgeKind, Category, DeliveryModel, Product } from "../src/domain/product.ts";
import { testEnv } from "./helpers.ts";

export function profileValues(overrides: Partial<BuilderFormValues> = {}): BuilderFormValues {
  return {
    handle: "lan-dev",
    name: "Lan Nguyen",
    kind: "individual",
    headline: "I build booking apps with AI",
    bio: "Ten years of web work.\n\n- Booking\n- CRM",
    country: "VN",
    websiteUrl: "https://lan.dev",
    skills: "Next.js, Supabase",
    aiTools: "Claude Code",
    workLanguages: ["en", "vi"],
    availability: "open",
    hourlyRate: "45",
    ...overrides,
  };
}

export function profileOf(overrides: Partial<BuilderFormValues> = {}): BuilderProfile {
  const result = parseBuilderProfile(profileValues(overrides));
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result.errors)}`);
  return result.profile;
}

export async function ensureUser(email: string, locale = "en"): Promise<UserRow> {
  return (await findUserByEmail(testEnv.DB, email)) ?? (await createUser(testEnv.DB, { email, locale, now: new Date().toISOString() }));
}

/** Creates a builder (no invite) and moves it to `status` directly in the DB. */
export async function makeBuilder(email: string, handle: string, status: BuilderStatus = "pending", overrides: Partial<BuilderFormValues> = {}): Promise<Builder> {
  const user = await ensureUser(email);
  const now = new Date().toISOString();
  const created = await createBuilder(testEnv.DB, { userId: user.id, profile: profileOf({ handle, ...overrides }), inviteCodeHash: null, now });
  if (!created.ok) throw new Error(created.reason);
  if (status === "pending") return created.builder;
  const moved = await setBuilderStatus(testEnv.DB, { userId: user.id, from: "pending", to: status, reviewNote: status === "rejected" ? "Add a portfolio" : null, now });
  if (!moved) throw new Error("status change failed");
  return moved;
}

/** Creates (or reuses) a user and a live session; returns the Cookie header value. */
export async function signIn(email: string, opts: { admin?: boolean; locale?: string } = {}): Promise<{ user: UserRow; cookie: string }> {
  const user = await ensureUser(email, opts.locale);
  if (opts.admin) await testEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?1").bind(user.id).run();
  return { user, cookie: `__Host-vnx_session=${await createSession(testEnv.DB, user.id, new Date())}` };
}

/** A builder (default approved) with one fresh draft product. */
export async function makeDraft(email: string, handle: string, name: string, builderStatus: BuilderStatus = "approved"): Promise<{ builder: Builder; product: Product }> {
  const builder = await makeBuilder(email, handle, builderStatus);
  const product = await createProductDraft(testEnv.DB, { builderId: builder.userId, name, now: new Date().toISOString() });
  return { builder, product };
}

/** A draft that meets every submit condition: all text fields, 2 tiers and 1 (fake) image. */
export async function makeReadyProduct(
  email: string,
  handle: string,
  name: string,
  opts: { builderStatus?: BuilderStatus; deliveryModel?: DeliveryModel } = {},
): Promise<{ builder: Builder; product: Product }> {
  const { builder, product } = await makeDraft(email, handle, name, opts.builderStatus ?? "approved");
  const now = new Date().toISOString();
  await updateProductFields(testEnv.DB, {
    productId: product.id,
    builderId: builder.userId,
    expectedStatus: "draft",
    markEdited: false,
    now,
    fields: {
      tagline: `${name} in one line`,
      problem: "Bookings get lost",
      targetUsers: "Spa owners",
      description: "Online booking.\n\n- Calendar",
      category: "booking",
      deliveryModel: opts.deliveryModel ?? "saas",
      supportPolicy: "Email within 48h",
      features: ["Calendar", "Reminders"],
      techStack: ["Hono"],
      demoUrl: "https://demo.example",
    },
  });
  await replaceTiers(testEnv.DB, {
    productId: product.id,
    tiers: [
      { name: "Starter", billing: "monthly", priceCents: 1900, description: "One location" },
      { name: "Custom", billing: "contact", priceCents: null, description: "" },
    ],
    now,
  });
  await addMedia(testEnv.DB, { productId: product.id, r2Key: `products/${product.id}/01J0000000000000000000000C.png`, alt: "Cover", now });
  return { builder, product: (await findProductById(testEnv.DB, product.id))! };
}

/** Moves a draft straight to published with the system `listed` badge, as an admin approval would. */
export async function publishProduct(productId: string): Promise<Product> {
  const now = new Date().toISOString();
  await setProductStatus(testEnv.DB, { id: productId, from: "draft", to: "in_review", reviewNote: null, now });
  const published = await setProductStatus(testEnv.DB, { id: productId, from: "in_review", to: "published", reviewNote: null, now });
  await grantBadge(testEnv.DB, { productId, kind: "listed", verifiedBy: null, evidence: "", now });
  return published!;
}

export type LiveOpts = { at?: string; fields?: Partial<ProductFields>; tiers?: TierInput[]; badges?: BadgeKind[] };

const LIVE_TIERS: TierInput[] = [
  { name: "Starter", billing: "monthly", priceCents: 1900, description: "" },
  { name: "Custom", billing: "contact", priceCents: null, description: "" },
];

/** A product of `builder` that meets every submit condition, approved at `opts.at` with "listed" plus `opts.badges`. */
export async function addLiveProduct(builder: Builder, name: string, opts: LiveOpts = {}): Promise<Product> {
  const at = opts.at ?? new Date().toISOString();
  const draft = await createProductDraft(testEnv.DB, { builderId: builder.userId, name, now: at });
  await updateProductFields(testEnv.DB, {
    productId: draft.id,
    builderId: builder.userId,
    expectedStatus: "draft",
    markEdited: false,
    now: at,
    fields: {
      tagline: `${name} in one line`,
      problem: "Bookings get lost",
      targetUsers: "Spa owners",
      description: "Online booking.",
      category: "booking",
      deliveryModel: "saas",
      supportPolicy: "Email within 48h",
      features: ["Calendar"],
      ...opts.fields,
    },
  });
  await replaceTiers(testEnv.DB, { productId: draft.id, tiers: opts.tiers ?? LIVE_TIERS, now: at });
  await addMedia(testEnv.DB, { productId: draft.id, r2Key: `products/${draft.id}/01J0000000000000000000000C.png`, alt: "Cover", now: at });
  await setProductStatus(testEnv.DB, { id: draft.id, from: "draft", to: "in_review", reviewNote: null, now: at });
  await setProductStatus(testEnv.DB, { id: draft.id, from: "in_review", to: "published", reviewNote: null, now: at });
  for (const kind of ["listed" as const, ...(opts.badges ?? [])]) {
    await grantBadge(testEnv.DB, { productId: draft.id, kind, verifiedBy: null, evidence: kind === "listed" ? "" : "test evidence", now: at });
  }
  return (await findProductById(testEnv.DB, draft.id))!;
}

/** A new approved builder with one live product (see addLiveProduct). */
export async function makeLiveProduct(
  email: string,
  handle: string,
  name: string,
  opts: LiveOpts & { builder?: Partial<BuilderFormValues> } = {},
): Promise<{ builder: Builder; product: Product }> {
  const builder = await makeBuilder(email, handle, "approved", opts.builder);
  return { builder, product: await addLiveProduct(builder, name, opts) };
}

/**
 * A client, an approved builder (handle `<tag>-b`) with a live product "<tag> product" (unless `withProduct: false`),
 * and an inquiry from the client in `status`.
 */
export async function makeInquiry(opts: { tag: string; status: InquiryStatus; type?: InquiryType; withProduct?: boolean; now?: string; clientLocale?: string; builderLocale?: string }) {
  const now = opts.now ?? new Date().toISOString();
  const client = await ensureUser(`${opts.tag}-c@vnx.si`, opts.clientLocale);
  const builderUser = await ensureUser(`${opts.tag}-b@vnx.si`, opts.builderLocale);
  const builder = await makeBuilder(builderUser.email, `${opts.tag}-b`, "approved", { name: `${opts.tag} builder` });
  const product = opts.withProduct === false ? null : await addLiveProduct(builder, `${opts.tag} product`);
  const { inquiry, firstMessageId } = await createInquiry(testEnv.DB, {
    clientUserId: client.id,
    clientName: "Minh Tran",
    builderId: builder.userId,
    productId: product?.id ?? null,
    type: opts.type ?? (product ? "buy" : "hire"),
    message: "We need online booking for three salons, please.",
    budgetBand: "500-2k",
    deadline: null,
    status: opts.status === "pending_verification" ? "pending_verification" : "open",
    locale: "en",
    now,
  });
  let current: Inquiry = inquiry;
  if (opts.status !== "open" && opts.status !== "pending_verification") {
    const moved = await setInquiryStatus(testEnv.DB, { id: inquiry.id, from: "open", to: opts.status, now });
    if (!moved) throw new Error("status change failed");
    current = moved;
  }
  return { client, builder, product, inquiry: current, firstMessageId };
}

/** A client `<tag>-c@vnx.si` and a request, submitted (default) or pending_verification. */
export async function makeRequest(opts: {
  tag: string;
  status?: Extract<RequestStatus, "submitted" | "pending_verification">;
  category?: Category;
  languages?: WorkLanguage[];
  title?: string;
  description?: string;
  now?: string;
  clientLocale?: string;
}): Promise<{ client: UserRow; request: ClientRequest }> {
  const client = await ensureUser(`${opts.tag}-c@vnx.si`, opts.clientLocale);
  const request = await createRequest(testEnv.DB, {
    clientUserId: client.id,
    clientName: "Minh Tran",
    title: opts.title ?? `${opts.tag} booking app`,
    description: opts.description ?? "We need online booking with SMS reminders for three salons in Hanoi.",
    category: opts.category ?? "booking",
    budgetBand: "2k-10k",
    deadline: null,
    languages: opts.languages ?? ["en", "vi"],
    status: opts.status ?? "submitted",
    locale: opts.clientLocale === "vi" ? "vi" : "en",
    now: opts.now ?? new Date().toISOString(),
  });
  return { client, request };
}

/** Invites `builders` as the test admin, moving the request to matching. Returns the new invitations in order. */
export async function inviteBuilders(request: ClientRequest, builders: Builder[], now = new Date().toISOString()): Promise<RequestInvite[]> {
  const admin = await ensureUser("owner@vnx.si");
  const batch = inviteBuildersBatch(testEnv.DB, { requestId: request.id, builderIds: builders.map((b) => b.userId), invitedBy: admin.id, now });
  const outcome = batch.read(await testEnv.DB.batch(batch.statements));
  if (!outcome.request) throw new Error("invite failed");
  const all = await listRequestInvites(testEnv.DB, request.id);
  return builders.map((b) => all.find((x) => x.invite.builderId === b.userId)!.invite);
}

/** The builder's proposal on `invite` (fixed $4,500, 30 days), written straight to the DB. */
export async function proposeOn(invite: RequestInvite, now = new Date().toISOString()): Promise<RequestInvite> {
  await testEnv.DB
    .prepare(
      `UPDATE request_invites SET status = 'proposed', approach = 'Next.js with a booking calendar.', price_cents = 450000, timeline_days = 30,
         responded_at = ?2, updated_at = ?2 WHERE id = ?1 AND status = 'invited'`,
    )
    .bind(invite.id, now)
    .run();
  return (await listRequestInvites(testEnv.DB, invite.requestId)).find((x) => x.invite.id === invite.id)!.invite;
}
