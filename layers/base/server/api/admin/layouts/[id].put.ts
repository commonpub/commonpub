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
 * Optimistic concurrency (Phase 3a.6): if the request includes an
 * `If-Match` header, it must equal the layout's current `updatedAt`.
 * Mismatch → 412 Precondition Failed (or 409 if we want to match
 * the editor's existing handler — RFC 7232 says 412, but pragmatic
 * web editors use 409. We follow editor convention: 409 conflict).
 * Omit the header (or pass empty string) to force an unconditional
 * write (the "overwrite" path from the conflict modal).
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

  // Optimistic concurrency check — client sends If-Match: <updatedAt>;
  // mismatch means someone else saved in between. The client's auto-save
  // catches the 409 and pops a conflict modal (3a.6).
  const ifMatch = getHeader(event, 'if-match');
  if (ifMatch && ifMatch.trim() !== '' && ifMatch !== existing.updatedAt) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Layout was modified by another session',
      data: {
        code: 'LAYOUT_CONFLICT',
        clientUpdatedAt: ifMatch,
        serverUpdatedAt: existing.updatedAt,
      },
    });
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
