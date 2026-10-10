import type { OAuthProvider } from "../domain/identity.ts";
import { getMailer } from "../email/index.ts";
import { identityLinkedEmail, identityUnlinkedEmail } from "../email/templates/identity.ts";
import type { Bindings } from "../env.ts";
import { isLocale, localizedPath } from "../i18n/locales.ts";
import type { NotifyOutcome } from "./request.ts";

export interface IdentityChange {
  kind: "linked" | "unlinked";
  /** `users.email` of the account owner: the only address these e-mails ever go to. */
  to: string;
  /** `users.locale`. */
  locale: string;
  provider: OAuthProvider;
  label: string;
  at: string;
  requestId?: string;
}

/**
 * Tells the owner that a sign-in account was linked or unlinked (ADR-012 §4, Owner 2026-10-07). Awaited by the caller, never throws:
 * the change is already committed, so a failed send is one log line with fixed words (no address, no label, no error text) and "failed".
 */
export async function notifyIdentityChange(env: Bindings, change: IdentityChange): Promise<NotifyOutcome> {
  try {
    const locale = isLocale(change.locale) ? change.locale : "en";
    const manageUrl = new URL(localizedPath(locale, "/me"), env.APP_ORIGIN).toString();
    const build = change.kind === "linked" ? identityLinkedEmail : identityUnlinkedEmail;
    await getMailer(env).send({ to: change.to, ...build(locale, { provider: change.provider, label: change.label, at: change.at, manageUrl }) });
    return "sent";
  } catch {
    console.error(JSON.stringify({ requestId: change.requestId, event: "identity.mail_failed", kind: change.kind, provider: change.provider, code: "notify_failed" }));
    return "failed";
  }
}
