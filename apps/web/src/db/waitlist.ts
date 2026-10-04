import type { ClientSignup } from "../domain/waitlist-input.ts";

export type ClientSignupRow = ClientSignup & { lang: string; country: string | null; referrer: string | null };

/**
 * Adds a client to the waitlist (VNX-0708). The only writer of `waitlist`.
 * A known email keeps its earlier personas (e.g. "developer" from the pre-pivot landing) and gains "client" once;
 * consent, language and updated_at are refreshed. Attribution (referrer, utm, country) stays from the first signup.
 */
export async function addClientSignup(db: D1Database, entry: ClientSignupRow, now: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO waitlist
         (email, personas, message, spend_band, consent_at, created_at, updated_at,
          referrer, utm_source, utm_medium, utm_campaign, country, lang)
       VALUES (?1, '["client"]', NULL, NULL, ?2, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(email) DO UPDATE SET
         personas = CASE
           -- Every writer stored a JSON array; anything else cannot hold personas, so start over (no 500 on bad data).
           WHEN json_valid(waitlist.personas) = 0 THEN '["client"]'
           WHEN json_type(waitlist.personas) != 'array' THEN '["client"]'
           WHEN EXISTS (SELECT 1 FROM json_each(waitlist.personas) WHERE value = 'client') THEN waitlist.personas
           ELSE json_insert(waitlist.personas, '$[#]', 'client')
         END,
         consent_at = excluded.consent_at,
         lang = excluded.lang,
         updated_at = excluded.updated_at`,
    )
    .bind(entry.email, now, entry.referrer, entry.utmSource, entry.utmMedium, entry.utmCampaign, entry.country, entry.lang)
    .run();
}
