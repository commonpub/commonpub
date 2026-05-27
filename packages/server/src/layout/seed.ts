/**
 * Layout engine — homepage seed helper.
 *
 * One-shot bootstrap: if the layout for `('route', '/')` doesn't exist
 * yet, create + publish a minimal default using the Phase 1c starter
 * sections (hero + content-feed). Returns `{ created: false }` if a
 * layout already exists at that scope — operator can call this safely
 * before flipping `features.layoutEngine` ON.
 *
 * Why this exists (not a full legacy `homepage.sections` migration):
 *   - The legacy renderer dispatches to 9 section types (hero,
 *     editorial, content-grid, content-carousel, contests, hubs,
 *     learning, stats, custom-html). Phase 1c only ships 5 of those
 *     (hero + 4 content/data sections). A real migration must wait
 *     until Phase 6b adds the remaining 20 sections.
 *   - This seed lets the operator flip `features.layoutEngine` on and
 *     immediately see a non-empty homepage (hero + feed), which is
 *     enough to validate the LayoutSlot render path end-to-end.
 *   - Doc'd in `docs/reference/guides/layout-engine.md` as the
 *     "enabling layoutEngine on the homepage" procedure.
 */
import { saveLayout, publishLayout, getLayoutByScope } from './layout.js';
import type { LayoutInput, LayoutRecord } from './layout.js';
import type { DB } from '../types.js';

export interface SeedHomepageResult {
  /** True if a new layout was inserted; false if one already existed. */
  created: boolean;
  /** Layout id (the existing one or the newly created one). */
  layoutId: string;
}

/**
 * Idempotent: safe to call repeatedly. Concurrency: the unique
 * `(scope_type, scope_key)` constraint in migration 0005 prevents two
 * simultaneous calls from inserting twice — we catch the race
 * implicitly via the pre-check, but the constraint is the real
 * guarantee.
 */
export async function seedHomepageLayout(
  db: DB,
  opts: { adminId?: string } = {},
): Promise<SeedHomepageResult> {
  const existing = await getLayoutByScope(db, { type: 'route', path: '/' });
  if (existing) {
    return { created: false, layoutId: existing.id };
  }

  const input: LayoutInput = {
    scope: { type: 'route', path: '/' },
    name: 'Homepage',
    pageMeta: {
      title: 'Homepage',
      access: 'public',
    },
    state: 'draft',  // saveLayout creates as draft; publishLayout flips to published below
    zones: [
      {
        zone: 'full-width',
        rows: [
          {
            order: 0,
            config: { gap: 'none' },
            sections: [
              {
                order: 0,
                type: 'hero',
                config: {
                  variant: 'default',
                  eyebrow: 'Open Source',
                  title: 'Build. Document. Share.',
                  subtitle:
                    'CommonPub is an open platform for maker communities. Document your builds with rich editors, join hubs, learn with structured paths, and share with the world.',
                  ctas: [
                    { label: 'Start building', href: '/create', variant: 'primary' },
                    { label: 'Explore', href: '/explore', variant: 'secondary' },
                  ],
                },
                colSpan: 12,
                enabled: true,
                schemaVersion: 1,
              },
            ],
          },
        ],
      },
      {
        zone: 'main',
        rows: [
          {
            order: 0,
            sections: [
              {
                order: 0,
                type: 'content-feed',
                config: {
                  heading: 'Latest',
                  contentType: '',
                  sort: 'recent',
                  limit: 9,
                  columns: 3,
                  tag: '',
                  featured: false,
                },
                colSpan: 12,
                enabled: true,
                schemaVersion: 1,
              },
            ],
          },
        ],
      },
    ],
  };

  const saved: LayoutRecord = await saveLayout(db, input, { userId: opts.adminId });
  // Publish immediately so SSR's getLayoutByScope returns it (state filter
  // in the public endpoint surfaces published over draft).
  await publishLayout(db, saved.id, { publishedBy: opts.adminId });

  return { created: true, layoutId: saved.id };
}
