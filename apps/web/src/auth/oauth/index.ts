import { isFakeMail } from "../../email/index.ts";
import type { OAuthProvider } from "../../domain/identity.ts";
import type { Bindings } from "../../env.ts";
import { FakeOAuthProvider } from "./fake.ts";
import { GithubClient } from "./github.ts";
import { OidcClient } from "./oidc.ts";
import type { ProviderClient } from "./provider.ts";

type OAuthEnv = Pick<
  Bindings,
  "OAUTH_DRIVER" | "MAIL_DRIVER" | "RESEND_API_KEY" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "LINKEDIN_CLIENT_ID" | "LINKEDIN_CLIENT_SECRET"
>;

// A bare `fetch` kept in a field and called as a method of another object makes workerd throw "Illegal invocation".
const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

/**
 * The fake provider counts only next to the fake mailer, which itself only counts without a real mail key (VNX-0803 F6):
 * production always has RESEND_API_KEY, so a stray OAUTH_DRIVER cannot switch it on. The fake accepts any code it issued.
 */
export function isFakeOAuth(env: Pick<Bindings, "OAUTH_DRIVER" | "MAIL_DRIVER" | "RESEND_API_KEY">): boolean {
  return env.OAUTH_DRIVER === "fake" && isFakeMail(env);
}

/** The provider's client id and secret, or null when either is missing or blank (decision 6). */
export function oauthCredentials(env: OAuthEnv, provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  let id: string | undefined;
  let secret: string | undefined;
  switch (provider) {
    case "google":
      [id, secret] = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET];
      break;
    case "github":
      [id, secret] = [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET];
      break;
    case "linkedin":
      [id, secret] = [env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET];
      break;
    default: {
      // A new provider must be added above: it must never fall through to another provider's secrets.
      const unreachable: never = provider;
      return unreachable;
    }
  }
  const clientId = id?.trim();
  const clientSecret = secret?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** False means the provider is off whatever its feature flag says: no button, callback 404. */
export function isProviderConfigured(env: OAuthEnv, provider: OAuthProvider): boolean {
  return getOAuthProvider(env, provider) !== null;
}

/** The client for `provider`, or null when it is not configured. `fetchFn` is for tests of the real adapters. */
export function getOAuthProvider(env: OAuthEnv, provider: OAuthProvider, fetchFn: typeof fetch = defaultFetch): ProviderClient | null {
  if (isFakeOAuth(env)) return new FakeOAuthProvider(provider);
  const credentials = oauthCredentials(env, provider);
  if (!credentials) return null;
  if (provider === "github") return new GithubClient(credentials.clientId, credentials.clientSecret, fetchFn);
  return new OidcClient(provider, credentials.clientId, credentials.clientSecret, fetchFn);
}
