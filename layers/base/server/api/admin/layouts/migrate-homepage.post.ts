/**
 * POST /api/admin/layouts/migrate-homepage
 *
 * Converts the operator's legacy `instance_settings.homepage.sections`
 * JSON into a real `layouts` row at scope ('route', '/').
 *
 * Body (all optional):
 *   { force?: boolean }
 *
 * Default: skip when a layout already exists at the route (returns
 * `{migrated:false, reason:'layout-already-exists', layoutId}`). With
 * `force: true`, the existing layout + its rows / sections / versions
 * are deleted via FK cascade and replaced.
 *
 * Intended canary flow (replaces the older seed-homepage path for
 * instances that have customised their homepage):
 *   1. Operator runs migration 0005 (if not already applied)
 *   2. Operator POSTs here → layouts row matching the live homepage
 *      is created + published
 *   3. Operator flips `features.layoutEngine` ON
 *   4. Homepage SSR renders via LayoutSlot — visually identical, but
 *      now sourced from the layouts table instead of homepage.sections
 *   5. Once stable, the legacy `homepage.sections` setting can be
 *      removed (separate operator action — this endpoint doesn't
 *      delete legacy data)
 *
 * Admin + features.admin + features.layoutEngine. Invalidates the
 * layouts-by-route cache on a successful migration (or force-replace).
 */
import { z } from 'zod';
import { migrateHomepageSectionsToLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

const bodySchema = z.object({
  force: z.boolean().optional().default(false),
});

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);

  const body = await readBody(event).catch(() => ({}));
  const { force } = bodySchema.parse(body ?? {});

  const db = useDB();
  const result = await migrateHomepageSectionsToLayout(db, {
    adminId: admin.id,
    force,
  });

  if (result.migrated) {
    invalidateLayoutsByRouteCache();
  }
  return result;
});
