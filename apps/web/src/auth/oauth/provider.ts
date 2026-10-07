import type { OAuthProvider } from "../../domain/identity.ts";
import type { IdTokenFailure } from "../../domain/oauth.ts";

/**
 * What the sign-in routes need from a provider (ADR-012 §1): trade the one-time `code` for the account's identity. Nothing
 * else leaves an adapter: no access token, no refresh token, no ID token, no profile name (Review Focus 9, F2). Named
 * ProviderClient because `OAuthProvider` is already the union of provider names (domain/identity.ts).
 */
export interface ProviderIdentity {
  /** The provider's immutable account id (`sub`, or GitHub's numeric id as text). */
  subject: string;
  /** The e-mail, or the fixed provider name when there is none (Google, LinkedIn); the login for GitHub. Always 1-254 characters. */
  label: string;
}

export interface ExchangeInput {
  code: string;
  verifier: string;
  nonce: string;
  redirectUri: string;
  /** Epoch milliseconds; the caller's clock, so tests control `exp`. */
  now: number;
}

/** Fixed codes for logs and branching; never an error message or a provider response. */
/** `profile_*` is GitHub's `GET /user` (plain OAuth 2.0 has no ID token). */
export type ExchangeFailure = "token_request" | "token_response" | "profile_request" | "profile_response" | `id_token_${IdTokenFailure}`;
export type ExchangeResult = { ok: true; identity: ProviderIdentity } | { ok: false; reason: ExchangeFailure };

export interface ProviderClient {
  readonly provider: OAuthProvider;
  readonly clientId: string;
  exchange(input: ExchangeInput): Promise<ExchangeResult>;
}
