import { canReadHub } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import type { H3Event } from 'h3';

// `createError` + `hasPermission` are Nitro/h3 auto-imports (like the rest of the
// layer's server utils), referenced without a static import.

/**
 * Gate a hub READ handler on hub privacy (P-2 — docs/plans/content-privacy-enforcement.md).
 *
 * `public`/`unlisted` hubs serve by design. A `private` hub's posts / roster / gallery /
 * resources / products require an active `hubMembers` row (reflected in `hub.currentUserRole`,
 * resolved by `getHubBySlug(db, slug, requesterId)`) OR platform-admin. Otherwise → 403.
 *
 * Call AFTER `getHubBySlug`, and pass the SAME `asPlatformAdmin` into `getHubBySlug` so an
 * admin resolves the real (un-redacted) hub id. Mirrors `requirePermission` (layer) wrapping
 * the pure `canReadHub` (server).
 */
export function requireHubReadAccess(
  event: H3Event,
  hub: Pick<HubDetail, 'privacy' | 'currentUserRole'>,
): void {
  if (canReadHub(hub, { asPlatformAdmin: hasPermission(event, 'admin.access') })) return;
  throw createError({ statusCode: 403, statusMessage: 'This hub is private' });
}
