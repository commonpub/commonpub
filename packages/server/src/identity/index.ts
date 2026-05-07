/**
 * @commonpub/server / identity — cross-instance delegated authorization.
 *
 * Phase 1a foundation: types + action router + FediClient interface.
 * Phase 1b lands the OAuth flow + FediClient implementation.
 * Phase 3 lands resolveIdentityContext middleware.
 * Phase 4 lands ActionRoute declarations for publish/like/follow/comment.
 *
 * See docs/sessions/136-cross-instance-identity-plan.md.
 */

export type { ActionRoute } from './router.js';
export {
  run,
  ActionUnavailable,
  InsufficientScopes,
  LinkedIdentityRevoked,
} from './router.js';

export type { FediClient, VerifiedAccount, FediClientFactory } from './fediClient.js';
export { getFediClient, setFediClientFactory } from './fediClient.js';
