/** 3–60 characters, a-z0-9 and inner hyphens (spec §6.1 products.slug). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const MAX = 60;

/** ASCII slug from a product name: strips Vietnamese diacritics; names with too few Latin characters become "product". */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "product";
}

/** `base-suffix`, trimming the base so the result stays within 60 characters. */
export function slugWithSuffix(base: string, suffix: string): string {
  const room = MAX - suffix.length - 1;
  return `${base.slice(0, room).replace(/-+$/g, "")}-${suffix}`;
}
