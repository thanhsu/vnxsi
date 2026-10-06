import { AVAILABILITIES, WORK_LANGUAGES, type Availability, type Builder, type WorkLanguage } from "./builder.ts";
import { normalizeQuery, oneOf, parsePage } from "./catalog.ts";
import { isCountryCode } from "./countries.ts";
import { CATEGORIES, type Category } from "./product.ts";

/** Spec §5.2 directory filters. */
export interface DirectoryQuery {
  q: string;
  /** Builders with at least one published product in this category. */
  category: Category | null;
  lang: WorkLanguage | null;
  country: string | null;
  availability: Availability | null;
  /** Internal only (the /tools/:slug bridge): builders whose ai_tools list this exact name. Never read from the URL. */
  tool?: string;
  page: number;
}

export type DirectoryEntry = Pick<Builder, "handle" | "name" | "kind" | "headline" | "country" | "availability" | "skills" | "hourlyRateCents"> & {
  publishedCount: number;
};

export function parseDirectoryQuery(params: Record<string, string | undefined>): DirectoryQuery {
  const country = typeof params.country === "string" ? params.country.trim().toUpperCase() : "";
  return {
    q: normalizeQuery(params.q),
    category: oneOf(CATEGORIES, params.category),
    lang: oneOf(WORK_LANGUAGES, params.lang),
    country: isCountryCode(country) ? country : null,
    availability: oneOf(AVAILABILITIES, params.availability),
    page: parsePage(params.page),
  };
}

export function isDirectoryFiltered(q: DirectoryQuery): boolean {
  return q.q !== "" || q.category !== null || q.lang !== null || q.country !== null || q.availability !== null;
}

/** "?…" for the same search on `page`; fixed order, empty values left out. */
export function directorySearchParams(q: DirectoryQuery, page: number): string {
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.category) params.set("category", q.category);
  if (q.lang) params.set("lang", q.lang);
  if (q.country) params.set("country", q.country);
  if (q.availability) params.set("availability", q.availability);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
