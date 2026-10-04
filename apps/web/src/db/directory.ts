import { likePattern, PAGE_SIZE, searchTerms, type Paged } from "../domain/catalog.ts";
import type { DirectoryEntry, DirectoryQuery } from "../domain/directory.ts";
import { toBuilder, type BuilderRow } from "./builders.ts";
import { jsonListLike } from "./catalog.ts";

/** Spec §7.1, §8.2: approved builders on active accounts. Aliases: b, u. */
export const PUBLIC_BUILDER = "b.status = 'approved' AND u.status = 'active'";

// Builder and user are public, so every published product of theirs is public too.
const PUBLISHED_COUNT = "(SELECT COUNT(*) FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published')";

// D1 rejects LIKE patterns over 50 bytes ("pattern too complex"); keep headroom for the two % and escapes.
const MAX_LIKE_PATTERN_BYTES = 48;
const utf8 = new TextEncoder();

/** The LIKE pattern for `term`, with the term cut (on a character boundary) so the pattern fits D1's limit. */
function boundedLikePattern(term: string): string {
  let kept = "";
  for (const ch of term) {
    if (utf8.encode(likePattern(kept + ch)).length > MAX_LIKE_PATTERN_BYTES) break;
    kept += ch;
  }
  return likePattern(kept);
}

type EntryRow = BuilderRow & { published_count: number };

function toEntry(r: EntryRow): DirectoryEntry {
  const b = toBuilder(r);
  return {
    handle: b.handle,
    name: b.name,
    kind: b.kind,
    headline: b.headline,
    country: b.country,
    availability: b.availability,
    skills: b.skills,
    hourlyRateCents: b.hourlyRateCents,
    publishedCount: r.published_count,
  };
}

/**
 * Spec §5.2 directory: every term must match the name or a skill. Order: availability "open" first, then more
 * published products, then the newest approval. ADR-004: no other input reaches the order.
 */
export async function searchBuilders(db: D1Database, query: DirectoryQuery): Promise<Paged<DirectoryEntry>> {
  const params: (string | number)[] = [];
  const bind = (value: string | number) => {
    params.push(value);
    return `?${params.length}`;
  };
  const where = [PUBLIC_BUILDER];
  for (const term of searchTerms(query.q)) {
    const pattern = bind(boundedLikePattern(term));
    where.push(`(b.name LIKE ${pattern} ESCAPE '\\' OR ${jsonListLike("b.skills", pattern)})`);
  }
  if (query.category) where.push(`EXISTS (SELECT 1 FROM products p WHERE p.builder_id = b.user_id AND p.status = 'published' AND p.category = ${bind(query.category)})`);
  if (query.lang) {
    where.push(`EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(b.work_languages) THEN b.work_languages ELSE '[]' END) WHERE value = ${bind(query.lang)})`);
  }
  if (query.country) where.push(`b.country = ${bind(query.country)}`);
  if (query.availability) where.push(`b.availability = ${bind(query.availability)}`);
  const filter = where.join(" AND ");
  const from = "builders b JOIN users u ON u.id = b.user_id";
  // page is an integer 1–9999 from parsePage.
  const offset = (query.page - 1) * PAGE_SIZE;
  const list = db
    .prepare(
      `SELECT b.*, ${PUBLISHED_COUNT} AS published_count FROM ${from} WHERE ${filter}
       ORDER BY (b.availability = 'open') DESC, published_count DESC, b.approved_at DESC, b.user_id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    )
    .bind(...params);
  const count = db.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${filter}`).bind(...params);
  const [rows, total] = await db.batch([list, count]);
  return { items: ((rows?.results ?? []) as EntryRow[]).map(toEntry), total: (total?.results[0] as { n: number } | undefined)?.n ?? 0 };
}

/** Countries of public builders, for the country filter. */
export async function listDirectoryCountries(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT b.country AS country FROM builders b JOIN users u ON u.id = b.user_id WHERE ${PUBLIC_BUILDER} ORDER BY b.country`)
    .all<{ country: string }>();
  return results.map((r) => r.country);
}
