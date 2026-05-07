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
 * Construct a FediClient for a linked identity. Phase 1a stub — actual
 * implementation lands in Phase 1b alongside the OAuth flow that
 * actually mints the access token.
 *
 * The implementation will:
 *   1. Read federated_accounts row for `identity.id`
 *   2. Decrypt access_token via `decryptToken` (@commonpub/infra)
 *   3. Construct megalodon client based on `identity.softwareKind`
 *   4. Wrap with 401-detection (mark revoked_at on auth failure),
 *      audit logging, and rate-limit handling
 */
export async function getFediClient(_identity: LinkedIdentity): Promise<FediClient> {
  throw new Error(
    'FediClient implementation lands in Phase 1b. ' +
    'See docs/sessions/136-cross-instance-identity-plan.md.',
  );
}
