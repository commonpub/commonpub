/**
 * Mastodon-API-backed FediClient factory.
 *
 * Wires `setFediClientFactory(...)` for Phase 1b runtime: the factory
 * is registered once at app init by a Nitro plugin (which closes over
 * the request-scoped DB), and `run()` calls `getFediClient(identity)`
 * on the linked-identity path, which delegates here.
 *
 * Behaviour:
 *   1. Load the federated_account row's decrypted access token.
 *   2. Map `identity.softwareKind` → megalodon's recognized server kinds
 *      (akkoma → pleroma; cpub/unknown → mastodon).
 *   3. Construct a `MegalodonInterface` client.
 *   4. Wrap calls so a 401 response auto-marks the row revoked AND
 *      throws `LinkedIdentityRevoked` — UI then prompts re-link.
 *
 * The wrapped client implements only the `FediClient` surface
 * (`account.verifyCredentials` for now). Phase 4 expansion adds
 * statuses/favourites/follows.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */
import generator from 'megalodon';
import type { LinkedIdentity, SoftwareKind } from '@commonpub/auth';
import type { DB } from '../types.js';
import { LinkedIdentityRevoked } from './router.js';
import {
  getDecryptedAccessToken,
  revokeFederatedAccountGrant,
} from '../federation/oauth.js';
import type { FediClient, FediClientFactory, VerifiedAccount } from './fediClient.js';

/** megalodon's accepted SNS values, narrower than ours. */
type MegalodonSns = 'mastodon' | 'pleroma' | 'friendica' | 'firefish' | 'gotosocial' | 'pixelfed';

/**
 * Map our `SoftwareKind` to megalodon's. Akkoma is a Pleroma fork that
 * megalodon doesn't differentiate. CommonPub speaks the Mastodon API
 * surface, so `cpub` and `unknown` both fall back to 'mastodon'.
 */
function toMegalodonSns(kind: SoftwareKind): MegalodonSns {
  switch (kind) {
    case 'mastodon': return 'mastodon';
    case 'pleroma':  return 'pleroma';
    case 'akkoma':   return 'pleroma';
    case 'gotosocial': return 'gotosocial';
    case 'firefish': return 'firefish';
    case 'cpub':     return 'mastodon';
    case 'unknown':  return 'mastodon';
  }
}

/**
 * True iff the error looks like a 401 from megalodon's axios layer.
 * megalodon doesn't surface a typed error class for HTTP status, so we
 * sniff the shape that axios + megalodon's wrapper produce.
 */
function isUnauthorized(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { response?: { status?: number }; status?: number };
  return e.response?.status === 401 || e.status === 401;
}

/**
 * Construct a real Mastodon-API-backed FediClient for a linked identity.
 * On 401, soft-revokes the grant (sets `federated_accounts.revoked_at`)
 * and re-throws `LinkedIdentityRevoked` — UI surfaces the re-link
 * prompt.
 *
 * Other failures (5xx, network) propagate unchanged.
 */
async function buildFediClient(db: DB, identity: LinkedIdentity): Promise<FediClient> {
  const token = await getDecryptedAccessToken(db, identity.id);
  if (!token) {
    // No token stored OR row was revoked OR row missing. Either way, the
    // grant is unusable — surface it as revoked so callers prompt re-link.
    throw new LinkedIdentityRevoked(identity);
  }

  const sns = toMegalodonSns(identity.softwareKind);
  const baseUrl = `https://${identity.instance}`;
  const client = generator(sns, baseUrl, token, 'CommonPub/1.0 (+https://commonpub.io)');

  // Last-verified-at could be refreshed here; deferred to Phase 4 when
  // a periodic re-verify cron makes sense.
  return {
    account: {
      async verifyCredentials(): Promise<VerifiedAccount> {
        try {
          const resp = await client.verifyAccountCredentials();
          const a = resp.data;
          return {
            id: String(a.id),
            username: a.username,
            acct: a.acct,
            displayName: a.display_name ?? undefined,
            avatar: a.avatar ?? undefined,
            url: a.url ?? undefined,
          };
        } catch (err) {
          if (isUnauthorized(err)) {
            // Soft-revoke; do this before throwing so the UI's
            // re-link prompt sees the persisted state.
            await revokeFederatedAccountGrant(db, identity.id).catch(() => {
              // Best-effort: a failure here doesn't change the auth
              // outcome (we still want to surface the re-link prompt).
              // The next `getDecryptedAccessToken` for this row will
              // still succeed with the stale token until the next call
              // attempts and 401s again — eventually consistent.
            });
            throw new LinkedIdentityRevoked(identity);
          }
          throw err;
        }
      },
    },
  };
}

/**
 * Build a FediClientFactory closed over a DB handle. Call this once at
 * app init and pass the result to `setFediClientFactory`.
 *
 *   import { setFediClientFactory } from '@commonpub/server';
 *   import { createMastodonFediClientFactory } from '@commonpub/server';
 *   setFediClientFactory(createMastodonFediClientFactory(useDB()));
 */
export function createMastodonFediClientFactory(db: DB): FediClientFactory {
  return (identity: LinkedIdentity) => buildFediClient(db, identity);
}
