import { CATEGORIES, DELIVERY_MODELS, PRODUCT_LANGS, type BadgeKind, type Category, type DeliveryModel, type ProductLang } from "./product.ts";

/** Spec §5.2: 24 products per page. The builder directory uses the same size. */
export const PAGE_SIZE = 24;
export const MAX_QUERY_CHARS = 100;
export const MAX_TERMS = 8;
/** Trigram FTS needs 3 characters; shorter terms (common in Chinese) fall back to LIKE (spec §8.7). */
export const MIN_FTS_CHARS = 3;
/** Same ceiling as a pricing tier. */
export const MAX_PRICE_USD = 100000;

/**
 * Spec §8.7: the highest active badge counts. With bm25 and published_at these are the only ranking inputs;
 * ADR-004 forbids adding any other.
 */
export const BADGE_SCORE: Readonly<Record<BadgeKind, number>> = { listed: 1, demo_verified: 2, in_production: 3 };

/** Every published product is "listed", so only the two checked badges are filters. */
export const FILTER_BADGES = ["demo_verified", "in_production"] as const;
export type FilterBadge = (typeof FILTER_BADGES)[number];

export interface CatalogQuery {
  q: string;
  category: Category | null;
  delivery: DeliveryModel | null;
  badge: FilterBadge | null;
  lang: ProductLang | null;
  /** Bounds on the cheapest priced tier (Owner decision 2026-10-04), in cents. */
  minCents: number | null;
  maxCents: number | null;
  page: number;
}

/** A product card in the catalogue. */
export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category | null;
  builderHandle: string;
  builderName: string;
  coverKey: string | null;
  /** Cheapest tier with a price, whatever its billing; null when every tier is "contact". */
  minPriceCents: number | null;
  badgeScore: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export type SearchPlan =
  | { mode: "browse" }
  /** `match` is a safe FTS5 expression (every term quoted, implicitly AND-ed); `likeTerms` must match too. */
  | { mode: "fts"; match: string; likeTerms: string[] }
  | { mode: "like"; likeTerms: string[] };

const codePoints = (s: string) => Array.from(s);

/** NFC, control and format characters to spaces, whitespace collapsed, at most MAX_QUERY_CHARS code points. */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const clean = raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  return codePoints(clean).slice(0, MAX_QUERY_CHARS).join("").trim();
}

/** Space-separated terms of a normalized query, de-duplicated ignoring case, at most MAX_TERMS. */
export function searchTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of query.split(" ")) {
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length === MAX_TERMS) break;
  }
  return out;
}

/** An FTS5 string: user text can never become an operator (AND, NEAR, *, column filters). */
export function ftsPhrase(term: string): string {
  return `"${term.replaceAll('"', '""')}"`;
}

/** A LIKE pattern matching `term` anywhere; use with ESCAPE '\'. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Spec §8.7: terms of 3+ characters use FTS5 trigram; 1–2 character terms use LIKE. */
export function searchPlan(query: string): SearchPlan {
  const terms = searchTerms(query);
  if (terms.length === 0) return { mode: "browse" };
  const long = terms.filter((t) => codePoints(t).length >= MIN_FTS_CHARS);
  const short = terms.filter((t) => codePoints(t).length < MIN_FTS_CHARS);
  if (long.length === 0) return { mode: "like", likeTerms: short };
  return { mode: "fts", match: long.map(ftsPhrase).join(" "), likeTerms: short };
}

/** USD with up to 2 decimals, 0 – MAX_PRICE_USD, as cents; anything else is null. */
export function parseUsdCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents <= MAX_PRICE_USD * 100 ? cents : null;
}

/** Pages 1–9999; anything else reads as 1. */
export function parsePage(raw: unknown): number {
  return typeof raw === "string" && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
}

export function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return (list as readonly unknown[]).includes(value) ? (value as T) : null;
}

/** The catalogue's GET parameters. Invalid values and unknown parameters are ignored, never an error. */
export function parseCatalogQuery(params: Record<string, string | undefined>): CatalogQuery {
  let minCents = parseUsdCents(params.min);
  let maxCents = parseUsdCents(params.max);
  if (minCents !== null && maxCents !== null && minCents > maxCents) [minCents, maxCents] = [maxCents, minCents];
  return {
    q: normalizeQuery(params.q),
    category: oneOf(CATEGORIES, params.category),
    delivery: oneOf(DELIVERY_MODELS, params.delivery),
    badge: oneOf(FILTER_BADGES, params.badge),
    lang: oneOf(PRODUCT_LANGS, params.lang),
    minCents,
    maxCents,
    page: parsePage(params.page),
  };
}

/** Search or any filter set: such pages are noindex. */
export function isCatalogFiltered(q: CatalogQuery): boolean {
  return q.q !== "" || q.category !== null || q.delivery !== null || q.badge !== null || q.lang !== null || q.minCents !== null || q.maxCents !== null;
}

const usd = (cents: number) => String(cents / 100);

/** "?…" for the same search on `page` ("" for page 1 with nothing set). Fixed order, empty values left out. */
export function catalogSearchParams(q: CatalogQuery, page: number): string {
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.category) params.set("category", q.category);
  if (q.delivery) params.set("delivery", q.delivery);
  if (q.badge) params.set("badge", q.badge);
  if (q.lang) params.set("lang", q.lang);
  if (q.minCents !== null) params.set("min", usd(q.minCents));
  if (q.maxCents !== null) params.set("max", usd(q.maxCents));
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The badge behind a score from BADGE_SCORE, or null for 0. */
export function topBadge(score: number): BadgeKind | null {
  for (const [kind, value] of Object.entries(BADGE_SCORE) as [BadgeKind, number][]) if (value === score) return kind;
  return null;
}
