import type { HubDetail } from '../types.js';

/**
 * Nil-UUID sentinel returned as `hub.id` in the private-hub **non-member stub**
 * (P-2 security — docs/plans/content-privacy-enforcement.md). It matches no real
 * `hubs.id`, so any read helper keyed on `hubId` (listPosts / listMembers /
 * listHubGallery / listHubResources / listHubProducts) returns empty even if a
 * caller forgets the `requireHubReadAccess` gate — defense-in-depth behind the gate.
 */
export const REDACTED_HUB_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Read-access predicate for a hub (P-2). A hub's posts / roster / gallery /
 * resources / products are readable iff the hub is not `private`, OR the viewer is
 * an active member (`getHubBySlug` sets `currentUserRole` only for a `status='active'`
 * membership row), OR the viewer is a platform admin.
 *
 * `unlisted` and `public` hubs serve by design; only `private` hubs gate on
 * membership. This mirrors the `getHubBySlug` (hub.ts) membership resolution — pass
 * the `HubDetail` it returned so `currentUserRole` already reflects the requester.
 */
export function canReadHub(
  hub: Pick<HubDetail, 'privacy' | 'currentUserRole'>,
  opts?: { asPlatformAdmin?: boolean },
): boolean {
  if (hub.privacy !== 'private') return true;
  if (hub.currentUserRole !== null) return true;
  return opts?.asPlatformAdmin === true;
}
