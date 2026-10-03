import { MESSAGES, parseWaitlist, type WaitlistEntry } from "./waitlist.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TURNSTILE_SECRET?: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function verifyTurnstile(secret: string, token: unknown, ip: string | null): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const outcome = (await res.json()) as { success?: boolean };
  return outcome.success === true;
}

export async function saveEntry(db: D1Database, entry: WaitlistEntry, country: string | null, now: string) {
  // Re-signing up merges personas and keeps the latest message instead of failing.
  await db
    .prepare(
      `INSERT INTO waitlist
         (email, personas, message, spend_band, consent_at, created_at, updated_at,
          referrer, utm_source, utm_medium, utm_campaign, country, lang)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT(email) DO UPDATE SET
         personas = excluded.personas,
         message = COALESCE(excluded.message, waitlist.message),
         spend_band = COALESCE(excluded.spend_band, waitlist.spend_band),
         consent_at = excluded.consent_at,
         lang = excluded.lang,
         updated_at = excluded.updated_at`,
    )
    .bind(
      entry.email,
      JSON.stringify(entry.personas),
      entry.message,
      entry.spendBand,
      now,
      entry.referrer,
      entry.utmSource,
      entry.utmMedium,
      entry.utmCampaign,
      country,
      entry.lang,
    )
    .run();
}

export async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: MESSAGES.en.invalid }, 400);
  }

  const parsed = parseWaitlist(body);
  if (!parsed.ok) {
    // Pretend success to bots so they don't retry.
    if (parsed.field === "website") return json({ ok: true });
    return json({ ok: false, error: parsed.error, field: parsed.field }, 400);
  }

  if (env.TURNSTILE_SECRET) {
    const token = (body as Record<string, unknown>).turnstileToken;
    const passed = await verifyTurnstile(env.TURNSTILE_SECRET, token, request.headers.get("cf-connecting-ip"));
    if (!passed) return json({ ok: false, error: MESSAGES[parsed.entry.lang].human }, 403);
  }

  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;
  await saveEntry(env.DB, parsed.entry, country, new Date().toISOString());
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/waitlist") return handleWaitlist(request, env);
    if (url.pathname === "/api/health") return json({ ok: true });
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
