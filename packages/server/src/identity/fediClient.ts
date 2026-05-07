/**
 * FediClient — opaque, protocol-agnostic facade for calling a remote
 * Fediverse instance as a linked identity. Phase 1a defines the
 * interface; Phase 1b plumbs in the megalodon-backed implementation.
 *
 * Why opaque: callers (action handlers) should never see the bearer
 * token, never call `fetch` directly, never know whether the remote
 * is Mastodon vs Pleroma vs CommonPub. They write `client.statuses.create({ ... })`
 * and the wrapper handles authentication, software-specific quirks,
 * 401-detection-as-revocation, audit logging, and rate-limit backoff.
 *
 * The interface is intentionally narrow — only the actions we proxy.
 * Add methods as Phase 4 (delegated actions) opens specific surfaces.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */
import type { LinkedIdentity } from '@commonpub/auth';

/**
 * The minimal account shape returned by a verify-credentials call. All
 * Mastodon-API-compatible servers expose this at GET /api/v1/accounts/verify_credentials.
 * CommonPub instances expose the same shape via the OAuth token-exchange
 * response (per existing `processTokenExchange`).
 */
export interface VerifiedAccount {
  /** Stable id at the remote (string for Mastodon API compat). */
  id: string;
  /** Bare username, no @host. */
  username: string;
  /** Full handle: `user@host`. Mastodon-API field name. */
  acct: string;
  /** Display name (optional). */
  displayName?: string;
  /** Avatar URL (optional). */
  avatar?: string;
  /** Canonical AP actor URI when known. */
  url?: string;
}

export interface FediClient {
  /** Phase 1: only the verification call lands here. Phase 4 expands. */
  account: {
    verifyCredentials(): Promise<VerifiedAccount>;
  };
  // Phase 4 surface, sketched for reference:
  // statuses?: { create(opts: { status: string; visibility?: string }): Promise<{ id: string; url: string }>; ... };
  // favourites?: { add(statusId: string): Promise<void>; remove(statusId: string): Promise<void> };
  // follows?: { add(account: string): Promise<void>; remove(account: string): Promise<void> };
}

/**
 * A FediClient factory. Phase 1b will register a real implementation
 * via `setFediClientFactory` at app init; the factory closes over the
 * DB handle, decryption key, audit logger, and any other dependencies
 * a real client needs without forcing those onto `run()`'s call sites.
 *
 * Tests register mock factories per-case via `setFediClientFactory`
 * and clear with `setFediClientFactory(null)` in afterEach.
 */
export type FediClientFactory = (identity: LinkedIdentity) => Promise<FediClient>;

let registeredFactory: FediClientFactory | null = null;

/**
 * Register the FediClient factory. Called once at app init by Phase 1b's
 * Nitro plugin (something like `setFediClientFactory(makeMastodonFactory(useDB(), tokenKey))`).
 *
 * Pass `null` to clear (used in tests).
 *
 * Why factory-registration instead of explicit DI through `run()`:
 *   - keeps `run()`'s signature simple — no DB / audit-logger cruft
 *     leaking into every call site
 *   - keeps `@commonpub/server` framework-agnostic — no h3 / Nuxt
 *     specific globals
 *   - app init is the natural place to wire dependencies once
 */
export function setFediClientFactory(factory: FediClientFactory | null): void {
  registeredFactory = factory;
}

/**
 * Construct a FediClient for a linked identity. Delegates to the
 * registered factory; throws if no factory has been registered (i.e.,
 * Phase 1b plumbing isn't in place yet, or the test forgot to call
 * `setFediClientFactory`).
 *
 * The Phase 1b factory will:
 *   1. Read federated_accounts row for `identity.id`
 *   2. Decrypt access_token via `decryptToken` (@commonpub/infra)
 *   3. Construct megalodon client based on `identity.softwareKind`
 *   4. Wrap with 401-detection (mark revoked_at on auth failure),
 *      audit logging, and rate-limit handling
 */
export async function getFediClient(identity: LinkedIdentity): Promise<FediClient> {
  if (!registeredFactory) {
    throw new Error(
      `FediClient factory not registered. ` +
      `Phase 1b: call setFediClientFactory(...) at app init. ` +
      `Tests: register a mock via setFediClientFactory(async () => mockClient). ` +
      `See docs/sessions/136-cross-instance-identity-plan.md.`,
    );
  }
  return registeredFactory(identity);
}
