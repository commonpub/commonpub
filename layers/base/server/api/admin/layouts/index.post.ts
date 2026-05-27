/**
 * POST /api/admin/layouts
 *
 * Create a new layout for a scope. Body is the full layout payload
 * (validated against `layoutCreateSchema`) with client-generated UUIDs
 * for sections/rows. Returns the created LayoutRecord.
 *
 * Fails with 409 if a layout already exists at the given scope (the
 * editor should PUT to the existing one instead).
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { layoutCreateSchema } from '@commonpub/schema';
import { getLayoutByScope, saveLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const body = await parseBody(event, layoutCreateSchema);

  const existing = await getLayoutByScope(db, body.scope);
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `A layout already exists for scope ${JSON.stringify(body.scope)}; PUT to /api/admin/layouts/${existing.id} to update it`,
    });
  }

  const saved = await saveLayout(
    db,
    {
      scope: body.scope,
      name: body.name,
      pageMeta: body.pageMeta,
      zones: body.zones,
      state: body.state,
    },
    { userId: admin.id },
  );

  invalidateLayoutsByRouteCache();
  return saved;
});
