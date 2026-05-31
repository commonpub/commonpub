import { setHomepageSections, migrateHomepageSectionsToLayout } from '@commonpub/server';
import { z } from 'zod';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';

const sectionConfigSchema = z.object({
  contentType: z.string().max(64).optional(),
  sort: z.enum(['popular', 'recent', 'featured', 'editorial']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  showEditorial: z.boolean().optional(),
  categorySlug: z.string().max(64).optional(),
  featureGate: z.string().max(64).optional(),
  variant: z.string().max(64).optional(),
  customTitle: z.string().max(255).optional(),
  customSubtitle: z.string().max(500).optional(),
  html: z.string().max(10000).optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['hero', 'editorial', 'content-grid', 'content-carousel', 'contests', 'hubs', 'learning', 'stats', 'custom-html']),
  title: z.string().max(255).optional(),
  enabled: z.boolean(),
  order: z.number().int().min(0),
  config: sectionConfigSchema,
});

const updateSectionsSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(20),
});

/**
 * PUT /api/admin/homepage/sections
 * Save homepage section configuration.
 */
export default defineEventHandler(async (event) => {
  const user = requirePermission(event, 'layout.manage');
  const db = useDB();
  const body = await parseBody(event, updateSectionsSchema);

  // Validate unique IDs
  const ids = new Set<string>();
  for (const section of body.sections) {
    if (ids.has(section.id)) {
      throw createError({ statusCode: 400, statusMessage: `Duplicate section ID: ${section.id}` });
    }
    ids.add(section.id);
  }

  await setHomepageSections(db, body.sections, user.id, getRequestIP(event) ?? undefined);

  // When the layout engine is on, the legacy `homepage.sections` JSON
  // is no longer what /pages/index.vue renders — the page reads from
  // the `layouts` table. Without this sync, admin edits made via the
  // existing homepage editor (which still writes homepage.sections,
  // because the Phase 3 layout editor isn't built yet) would have
  // ZERO visible effect on the live page.
  //
  // Fix: after the legacy save succeeds, if layoutEngine is on,
  // **R4 audit P0 data-loss fix (session 160)**: previously this called
  // migrateHomepageSectionsToLayout with force:true on every legacy save,
  // which DELETES the existing layout (cascade → rows, sections,
  // VERSIONS). If an admin had bespoke-edited the homepage via /admin/
  // layouts, those edits + the entire publish history were silently
  // destroyed the next time anyone touched /admin/homepage. Same data-
  // loss path also hit the audit log if two admins were editing in
  // parallel.
  //
  // New semantics: NON-DESTRUCTIVE auto-sync. If a layout doesn't yet
  // exist for ('route','/'), create it from the legacy data so the
  // first-time operator's legacy edits keep working. If a layout DOES
  // exist, leave it alone — the new editor is the source of truth from
  // that point forward. /admin/homepage now shows a deprecation banner
  // (see the page itself) directing operators to /admin/layouts.
  //
  // History: original auto-sync added session 159 (per the comment
  // above) to handle "I removed a section in /admin/homepage but it
  // still renders" — that scenario still works on first-time admins
  // since the layout gets created on first save. After the operator
  // adopts the layout editor, /admin/homepage becomes effectively
  // read-only with respect to the live homepage; the legacy data still
  // saves into instance_settings for backward-compat but is no longer
  // promoted.
  const config = useConfig();
  if (config.features.layoutEngine) {
    try {
      const result = await migrateHomepageSectionsToLayout(db, {
        adminId: user.id,
        force: false, // changed from true — see comment above
      });
      if (result.migrated) {
        invalidateLayoutsByRouteCache();
      }
    } catch (err) {
      // Don't fail the user's save just because the layout sync hit a
      // hiccup. Log + return — they can re-trigger the migration via
      // the dedicated /api/admin/layouts/migrate-homepage endpoint.
      console.error('[admin:homepage.sections] post-save layout sync failed:', err);
    }
  }

  return { sections: body.sections, message: 'Homepage updated' };
});
