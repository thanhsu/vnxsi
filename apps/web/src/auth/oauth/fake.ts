import type { OAuthProvider } from "../../domain/identity.ts";
import type { ExchangeInput, ExchangeResult, ProviderClient, ProviderIdentity } from "./provider.ts";

/** The provider for tests (decision 5): no network, one-time codes the test issues. Only reachable through `getOAuthProvider` when `isFakeOAuth` holds. */
export const FAKE_CLIENT_ID = "fake-client-id";

/**
 * What the flow under test must present for the code to be accepted. All three are required (F3): a test that cannot say what
 * the core should send is not testing the core.
 */
export interface FakeExpect {
  verifier: string;
  nonce: string;
  redirectUri: string;
}

type Issued = { provider: OAuthProvider; identity: ProviderIdentity; expect: FakeExpect };

// One table per isolate, like the fake mailer's outbox: `getOAuthProvider` builds a new client on every request.
const issued = new Map<string, Issued>();

export function issueFakeCode(provider: OAuthProvider, identity: ProviderIdentity, expect: FakeExpect): string {
  const code = `fake-code-${crypto.randomUUID()}`;
  issued.set(code, { provider, identity: { ...identity }, expect });
  return code;
}

export function resetFakeOAuth(): void {
  issued.clear();
}

export class FakeOAuthProvider implements ProviderClient {
  readonly clientId = FAKE_CLIENT_ID;
  constructor(readonly provider: OAuthProvider) {}

  async exchange(input: ExchangeInput): Promise<ExchangeResult> {
    const entry = issued.get(input.code);
    // S2: a code works once, even when this attempt turns out wrong (a real provider burns it too).
    issued.delete(input.code);
    if (!entry || entry.provider !== this.provider) return { ok: false, reason: "token_request" };
    const { verifier, nonce, redirectUri } = entry.expect;
    if (verifier !== input.verifier || redirectUri !== input.redirectUri) return { ok: false, reason: "token_request" };
    if (nonce !== input.nonce) return { ok: false, reason: "id_token_nonce" };
    return { ok: true, identity: { ...entry.identity } };
  }
}
