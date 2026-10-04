import { z } from "zod";
import { AVAILABILITIES, BUILDER_KINDS, WORK_LANGUAGES, type BuilderProfile } from "./builder.ts";
import { isCountryCode } from "./countries.ts";

/** Handles that would collide with routes, locales or the brand. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "administrator", "api", "app", "assets", "auth", "b", "builder", "builders", "en", "for-builders", "help",
  "hub", "join", "login", "logout", "me", "media", "p", "privacy", "product", "products", "request", "requests",
  "robots", "root", "settings", "signin", "signup", "sitemap", "static", "support", "system", "terms", "vi", "vnx",
  "vnxsi", "www", "zh", "zh-hans", "zh-hant",
]);

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Raw form state, echoed back on validation errors. Lists are comma-separated text. */
export type BuilderFormValues = {
  handle: string;
  name: string;
  kind: string;
  headline: string;
  bio: string;
  country: string;
  websiteUrl: string;
  skills: string;
  aiTools: string;
  workLanguages: string[];
  availability: string;
  hourlyRate: string;
};
export type BuilderField = keyof BuilderFormValues;
export type FieldError = "invalid" | "reserved" | "taken";
export type FieldErrors = Partial<Record<BuilderField, FieldError>>;

/** Browsers submit textarea newlines as CRLF; store and count them as LF. */
const str = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "");

export function formValuesFromBody(body: Record<string, unknown>): BuilderFormValues {
  const langs = body.workLanguages;
  const list = Array.isArray(langs) ? langs : langs === undefined ? [] : [langs];
  return {
    handle: str(body.handle),
    name: str(body.name),
    kind: str(body.kind),
    headline: str(body.headline),
    bio: str(body.bio),
    country: str(body.country),
    websiteUrl: str(body.websiteUrl),
    skills: str(body.skills),
    aiTools: str(body.aiTools),
    workLanguages: list.filter((v): v is string => typeof v === "string"),
    availability: str(body.availability),
    hourlyRate: str(body.hourlyRate),
  };
}

export function formValuesFromProfile(p: BuilderProfile): BuilderFormValues {
  return {
    handle: p.handle,
    name: p.name,
    kind: p.kind,
    headline: p.headline,
    bio: p.bio,
    country: p.country,
    websiteUrl: p.websiteUrl ?? "",
    skills: p.skills.join(", "),
    aiTools: p.aiTools.join(", "),
    workLanguages: [...p.workLanguages],
    availability: p.availability,
    hourlyRate: p.hourlyRateCents === null ? "" : String(p.hourlyRateCents / 100),
  };
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Splits on commas, trims, drops empties and case-insensitive duplicates. */
export function splitCsv(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const item = part.trim();
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push(item);
    }
  }
  return out;
}

const textList = (min: number) => z.array(z.string().max(40)).min(min).max(15);

const Schema = z.object({
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(BUILDER_KINDS),
  headline: z.string().trim().min(1).max(120),
  bio: z.string().trim().min(1).max(2000),
  country: z.string().trim().toUpperCase().refine(isCountryCode),
  websiteUrl: z.string().trim().max(500).refine((v) => v === "" || isHttpsUrl(v)),
  skills: z.string().max(1000).transform(splitCsv).pipe(textList(1)),
  aiTools: z.string().max(1000).transform(splitCsv).pipe(textList(0)),
  workLanguages: z.array(z.enum(WORK_LANGUAGES)).max(3),
  availability: z.enum(AVAILABILITIES),
  hourlyRate: z.string().trim().regex(/^(|[1-9]\d{0,4})$/).refine((v) => v === "" || Number(v) <= 10000),
});

export function parseBuilderProfile(values: BuilderFormValues): { ok: true; profile: BuilderProfile } | { ok: false; errors: FieldErrors } {
  const result = Schema.safeParse(values);
  const errors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) errors[issue.path[0] as BuilderField] ??= "invalid";
  }
  if (!errors.handle && RESERVED_HANDLES.has(values.handle.trim().toLowerCase())) errors.handle = "reserved";
  if (!result.success || errors.handle) return { ok: false, errors };
  const d = result.data;
  return {
    ok: true,
    profile: {
      handle: d.handle,
      name: d.name,
      kind: d.kind,
      headline: d.headline,
      bio: d.bio,
      country: d.country,
      websiteUrl: d.websiteUrl || null,
      skills: d.skills,
      aiTools: d.aiTools,
      workLanguages: [...new Set(d.workLanguages)],
      availability: d.availability,
      hourlyRateCents: d.hourlyRate ? Number(d.hourlyRate) * 100 : null,
    },
  };
}
