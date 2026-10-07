import { appendUtm, validatePublicUrl } from "./offer-url.ts";

export { validatePublicUrl, type PublicUrlError, type PublicUrlResult } from "./offer-url.ts";

export const PRODUCT_LINK_KINDS = ["demo", "site"] as const;
export type ProductLinkKind = (typeof PRODUCT_LINK_KINDS)[number];
export type ProductLinkResult = { kind: "redirect"; url: string } | { kind: "not_found"; reason: "not_public" | "missing_url" | "invalid_url" };

/** Where /go/p/:slug/{demo,site} goes. The destination comes only from the stored URL, never from the request. Pure: no Hono, no D1. */
export function resolveProductLink(p: { status: string; builderStatus: string; demoUrl: string | null; websiteUrl: string | null }, kind: ProductLinkKind): ProductLinkResult {
  if (p.status !== "published" || p.builderStatus !== "approved") return { kind: "not_found", reason: "not_public" };
  const raw = kind === "demo" ? p.demoUrl : p.websiteUrl;
  if (raw === null || raw === "") return { kind: "not_found", reason: "missing_url" };
  const valid = validatePublicUrl(raw);
  return valid.ok ? { kind: "redirect", url: appendUtm(valid.url) } : { kind: "not_found", reason: "invalid_url" };
}
