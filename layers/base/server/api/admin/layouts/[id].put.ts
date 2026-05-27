/**
 * PUT /api/admin/layouts/[id]
 *
 * Update a layout — auto-save target for the editor. Sends the WHOLE
 * draft (zones → rows → sections); saveLayout diffs against current,
 * renumbers positions, rewrites children in a transaction.
 *
 * Scope CANNOT be changed via PUT (it's immutable per layout). A scope
 * change would mean a new layout — POST instead.
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { layoutCreateSchema } from '@commonpub/schema';
import { getLayoutById, saveLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id param' });
  }

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  const body = await parseBody(event, layoutCreateSchema);

  // Scope is immutable — reject if the client tries to change it. This
  // catches an "edit the wrong layout" bug at the API surface rather
  // than silently moving sections to a new route.
  if (
    body.scope.type !== existing.scope.type ||
    ('path' in body.scope ? body.scope.path : body.scope.key) !==
      ('path' in existing.scope ? existing.scope.path : existing.scope.key)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot change layout scope via PUT — POST a new layout instead',
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
    { id, userId: admin.id },
  );

  invalidateLayoutsByRouteCache();
  return saved;
});
