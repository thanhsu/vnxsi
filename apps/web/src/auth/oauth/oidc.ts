import { PROVIDER_NAME } from "../../domain/identity.ts";
import { OAUTH_PROVIDER_SPECS, verifyIdToken } from "../../domain/oauth.ts";
import type { ExchangeFailure, ExchangeInput, ExchangeResult, ProviderClient } from "./provider.ts";

export type OidcProvider = "google" | "linkedin";

/** Constants, never built from input (decision 3 (b)). */
export const OIDC_TOKEN_URLS: Record<OidcProvider, string> = {
  google: "https://oauth2.googleapis.com/token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
};

const TIMEOUT_MS = 8000;

/**
 * Google and LinkedIn: OpenID Connect authorization-code exchange. The ID token is read only from the token endpoint's JSON
 * (decision 3 (a)); its claims are checked by `verifyIdToken` and its signature is not (approved deviation R1). The access
 * and refresh tokens in the same JSON are never read. No logging here: callers log the fixed failure code.
 */
export class OidcClient implements ProviderClient {
  constructor(
    readonly provider: OidcProvider,
    readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: typeof fetch,
  ) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const fail = (reason: ExchangeFailure): ExchangeResult => ({ ok: false, reason });
    let body: unknown;
    try {
      const fetchFn = this.fetchFn;
      const res = await fetchFn(OIDC_TOKEN_URLS[this.provider], {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: input.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code_verifier: input.verifier,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("token_request");
      try {
        body = await res.json();
      } catch {
        return fail("token_response");
      }
    } catch {
      return fail("token_request");
    }
    const idToken = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).id_token : undefined;
    if (typeof idToken !== "string" || idToken === "") return fail("token_response");

    const verified = verifyIdToken(idToken, { issuers: OAUTH_PROVIDER_SPECS[this.provider].issuers, audience: this.clientId, nonce: input.nonce, now: input.now });
    if (!verified.ok) return fail(`id_token_${verified.reason}`);
    // F2: the e-mail, else the fixed provider name; the `name` claim is never read.
    return { ok: true, identity: { subject: verified.claims.subject, label: verified.claims.email ?? PROVIDER_NAME[this.provider] } };
  }
}
