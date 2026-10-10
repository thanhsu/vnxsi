import { type OAuthProvider, PROVIDER_NAME } from "../../domain/identity.ts";
import type { Locale } from "../../i18n/locales.ts";
import { translator } from "../../i18n/t.ts";
import { link, p, wrap } from "../parts.ts";

export interface IdentityEmailInput {
  provider: OAuthProvider;
  /** E-mail or login of the provider account. Goes only to the account's owner. */
  label: string;
  /** ISO instant of the audited change. */
  at: string;
  /** Absolute, plain (no query): the owner's /me. */
  manageUrl: string;
}

/** `2026-10-09T07:05:33.123Z` → `2026-10-09 07:05 UTC`. */
export const formatUtc = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

const KEYS = {
  linked: { subject: "email.identityLinked.subject", body: "email.identityLinked.body", notYou: "email.identityLinked.notYou" },
  unlinked: { subject: "email.identityUnlinked.subject", body: "email.identityUnlinked.body", notYou: "email.identityUnlinked.notYou" },
} as const;

function compose(kind: keyof typeof KEYS, locale: Locale, input: IdentityEmailInput) {
  const tr = translator(locale);
  const k = KEYS[kind];
  const provider = PROVIDER_NAME[input.provider];
  const body = tr(k.body, { provider, time: formatUtc(input.at) });
  // The label repeats the provider name when the provider gave no e-mail (decision 12): then the line says nothing.
  const account = input.label === provider ? null : tr("email.identity.account", { label: input.label });
  const notYou = tr(k.notYou);
  const manage = tr("email.identity.manage");
  return {
    subject: tr(k.subject, { provider }),
    text: [body, ...(account ? [account] : []), "", notYou, "", manage, input.manageUrl].join("\n"),
    html: wrap(locale, [p(body), ...(account ? [p(account)] : []), p(notYou), p(manage), link(input.manageUrl)]),
  };
}

export const identityLinkedEmail = (locale: Locale, input: IdentityEmailInput) => compose("linked", locale, input);
export const identityUnlinkedEmail = (locale: Locale, input: IdentityEmailInput) => compose("unlinked", locale, input);
