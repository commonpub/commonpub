/**
 * GET /api/admin/layouts
 *
 * List all layouts. Optional `?scope=route|virtual|custom-page` to
 * filter by scope type. Returns the full LayoutRecord shape (nested
 * zones → rows → sections + version + state).
 *
 * Admin + features.admin + features.layoutEngine.
 */
import { listLayouts } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  requireAdmin(event);

  const db = useDB();
  const query = getQuery(event) as { scope?: string };
  const scopeFilter =
    query.scope === 'route' || query.scope === 'virtual' || query.scope === 'custom-page'
      ? query.scope
      : undefined;

  return listLayouts(db, scopeFilter ? { scopeType: scopeFilter } : undefined);
});
