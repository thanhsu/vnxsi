import { GITHUB_LOGIN_RE } from "../../domain/identity.ts";
import type { ExchangeFailure, ExchangeInput, ExchangeResult, ProviderClient } from "./provider.ts";

/** Constants, never built from input (decision 3 (b)). */
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";

const TIMEOUT_MS = 8000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * GitHub: OAuth 2.0 authorization code, then one `GET /user`. The account is the numeric `id` (never `login`, which can change);
 * the label is the `login`, refreshed at every sign-in (ADR-012 §1, §5). The access token lives in one local variable between the
 * two calls, goes only into the second call's Authorization header, and is never returned, stored or logged. Nothing else of
 * the profile (name, e-mail, avatar) is read. No logging here: callers log the fixed failure code.
 */
export class GithubClient implements ProviderClient {
  readonly provider = "github" as const;

  constructor(
    readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: typeof fetch,
  ) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const fail = (reason: ExchangeFailure): ExchangeResult => ({ ok: false, reason });
    const fetchFn = this.fetchFn;

    let accessToken: string;
    try {
      const res = await fetchFn(GITHUB_TOKEN_URL, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: input.code,
          redirect_uri: input.redirectUri,
          code_verifier: input.verifier,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("token_request");
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return fail("token_response");
      }
      // GitHub answers 200 with {"error": …} for a bad code: no access_token, so token_response.
      const token = isRecord(body) ? body.access_token : undefined;
      if (typeof token !== "string" || token === "") return fail("token_response");
      accessToken = token;
    } catch {
      return fail("token_request");
    }

    let profile: unknown;
    try {
      const res = await fetchFn(GITHUB_USER_URL, {
        method: "GET",
        redirect: "manual",
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json", "user-agent": "vnx.si", "x-github-api-version": "2022-11-28" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return fail("profile_request");
      try {
        profile = await res.json();
      } catch {
        return fail("profile_response");
      }
    } catch {
      return fail("profile_request");
    }

    if (!isRecord(profile)) return fail("profile_response");
    const { id, login } = profile;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return fail("profile_response");
    if (typeof login !== "string" || !GITHUB_LOGIN_RE.test(login)) return fail("profile_response");
    return { ok: true, identity: { subject: String(id), label: login } };
  }
}
