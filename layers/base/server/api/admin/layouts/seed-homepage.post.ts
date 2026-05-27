/**
 * POST /api/admin/layouts/seed-homepage
 *
 * Operator's bootstrap call: seeds + publishes a default homepage
 * layout (hero + content-feed) at scope ('route', '/'). Idempotent —
 * safe to call repeatedly.
 *
 * Intended flow for enabling the layout engine on the homepage:
 *   1. Operator runs migration 0005 (if not already applied)
 *   2. Operator POSTs to this endpoint → layout exists, published v1
 *   3. Operator flips `features.layoutEngine` ON
 *   4. Homepage renders via `<LayoutSlot>` (v-if branch in pages/index.vue)
 *
 * NOT the full legacy `homepage.sections` migration — that needs the
 * remaining sections from Phase 6b. Doc'd at
 * `docs/reference/guides/layout-engine.md`.
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { seedHomepageLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requireAdmin(event);
  const db = useDB();

  const result = await seedHomepageLayout(db, { adminId: admin.id });
  if (result.created) {
    invalidateLayoutsByRouteCache();
  }
  return result;
});
