import { z } from "zod";
import { isHttpsUrl } from "./builder-input.ts";

export const MAX_PORTFOLIO_ITEMS = 12;

export interface PortfolioItem {
  id: string;
  builderId: string;
  title: string;
  url: string | null;
  description: string;
  imageKey: string | null;
  sort: number;
}

export type PortfolioFormValues = { title: string; url: string; description: string };
export type PortfolioField = keyof PortfolioFormValues;
export type PortfolioErrors = Partial<Record<PortfolioField, true>>;
export type PortfolioInput = Pick<PortfolioItem, "title" | "url" | "description">;

const Schema = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.string().trim().max(500).refine((v) => v === "" || isHttpsUrl(v)),
  description: z.string().trim().max(500),
});

/** Browsers submit textarea newlines as CRLF; store and count them as LF. */
const str = (value: unknown) => (typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "");

export function portfolioValuesFromBody(body: Record<string, unknown>): PortfolioFormValues {
  return { title: str(body.title), url: str(body.url), description: str(body.description) };
}

export function portfolioValuesFromItem(item: PortfolioItem): PortfolioFormValues {
  return { title: item.title, url: item.url ?? "", description: item.description };
}

export function parsePortfolioItem(values: PortfolioFormValues): { ok: true; item: PortfolioInput } | { ok: false; errors: PortfolioErrors } {
  const result = Schema.safeParse(values);
  if (!result.success) {
    const errors: PortfolioErrors = {};
    for (const issue of result.error.issues) errors[issue.path[0] as PortfolioField] = true;
    return { ok: false, errors };
  }
  return { ok: true, item: { title: result.data.title, url: result.data.url || null, description: result.data.description } };
}
