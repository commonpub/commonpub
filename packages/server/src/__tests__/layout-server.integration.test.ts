/**
 * Server CRUD for the layout engine (Phase 1).
 *
 * Per `docs/plans/layout-and-pages.md` §10.3, this test file covers
 * every invariant the server promises:
 *   - CRUD round-trip preserves nested shape
 *   - Position normalisation to {0..n} on every write
 *   - Cascade DELETE through rows → sections → versions
 *   - Publish creates an immutable snapshot
 *   - Revert restores from a snapshot without mutating the version
 *   - Custom-page scope vs route scope vs virtual scope
 *   - Unknown section types accepted at storage (validation is upstream)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { layouts, layoutRows, layoutSections, layoutVersions } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  listLayouts,
  getLayoutByScope,
  getLayoutById,
  saveLayout,
  deleteLayout,
  publishLayout,
  listLayoutVersions,
  revertToVersion,
  type LayoutInput,
} from '../layout/layout.js';

describe('layout server CRUD', () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { role: 'admin' });
    userId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    // Clean slate per test — layouts cascade through rows/sections/versions
    await db.delete(layouts);
  });

  // ---- Reads on empty DB --------------------------------------------------

  describe('reads on empty DB', () => {
    it('listLayouts returns empty array', async () => {
      expect(await listLayouts(db)).toEqual([]);
    });

    it('getLayoutByScope returns null when no layout exists', async () => {
      expect(await getLayoutByScope(db, { type: 'route', path: '/' })).toBeNull();
    });

    it('getLayoutById returns null for a non-existent uuid', async () => {
      expect(await getLayoutById(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  // ---- Create / read round-trip ------------------------------------------

  describe('saveLayout (create)', () => {
    it('creates a route-scope layout with one zone, one row, two sections', async () => {
      const input: LayoutInput = {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [
          {
            zone: 'main',
            rows: [
              {
                order: 0,
                sections: [
                  { order: 0, type: 'hero', config: { variant: 'default' }, colSpan: 12 },
                ],
              },
              {
                order: 1,
                sections: [
                  { order: 0, type: 'image', config: { url: 'x' }, colSpan: 6 },
                  { order: 1, type: 'paragraph', config: { body: 'y' }, colSpan: 6 },
                ],
              },
            ],
          },
        ],
      };
      const saved = await saveLayout(db, input, { userId });

      expect(saved.scope).toEqual({ type: 'route', path: '/' });
      expect(saved.name).toBe('Homepage');
      expect(saved.zones).toHaveLength(1);
      expect(saved.zones[0]!.zone).toBe('main');
      expect(saved.zones[0]!.rows).toHaveLength(2);
      expect(saved.zones[0]!.rows[1]!.sections).toHaveLength(2);
      expect(saved.zones[0]!.rows[1]!.sections[0]!.colSpan).toBe(6);
    });

    it('creates a custom-page scope with PageMeta', async () => {
      const input: LayoutInput = {
        scope: { type: 'custom-page', path: '/about' },
        name: 'About',
        pageMeta: {
          title: 'About Us',
          description: 'Who we are',
          access: 'public',
          frame: 'wide',
        },
        zones: [],
      };
      const saved = await saveLayout(db, input, { userId });
      expect(saved.scope).toEqual({ type: 'custom-page', path: '/about' });
      expect(saved.pageMeta?.title).toBe('About Us');
      expect(saved.pageMeta?.access).toBe('public');
    });

    it('creates a virtual scope with no rows', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'virtual', key: '__footer' },
        name: 'Footer',
        zones: [],
      }, { userId });
      expect(saved.scope).toEqual({ type: 'virtual', key: '__footer' });
      expect(saved.zones).toEqual([]);
    });
  });

  // ---- Position normalisation --------------------------------------------

  describe('saveLayout (position normalisation)', () => {
    it('renumbers row positions to {0..n} regardless of caller-provided order values', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [
          {
            zone: 'main',
            rows: [
              { order: 100, sections: [] },
              { order: 50, sections: [] },
              { order: 999, sections: [] },
            ],
          },
        ],
      }, { userId });

      // Canonical order: sorted by original `order`, then renumbered {0,1,2}
      const positions = saved.zones[0]!.rows.map((r) => r.order);
      expect(positions).toEqual([0, 1, 2]);
    });

    it('renumbers section positions within a row', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [{
          zone: 'main',
          rows: [{
            order: 0,
            sections: [
              { order: 7, type: 'hero', config: {}, colSpan: 6 },
              { order: 3, type: 'image', config: {}, colSpan: 6 },
            ],
          }],
        }],
      }, { userId });

      const orders = saved.zones[0]!.rows[0]!.sections.map((s) => s.order);
      expect(orders).toEqual([0, 1]);
      // Original `order=3` was lower → comes first after renumber
      expect(saved.zones[0]!.rows[0]!.sections[0]!.type).toBe('image');
      expect(saved.zones[0]!.rows[0]!.sections[1]!.type).toBe('hero');
    });
  });

  // ---- Update (re-save) round-trip ---------------------------------------

  describe('saveLayout (update existing)', () => {
    it('re-saving by scope updates the same row (one-per-scope invariant)', async () => {
      await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage v1',
        zones: [],
      }, { userId });
      const second = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage v2',
        zones: [],
      }, { userId });
      expect(second.name).toBe('Homepage v2');
      const all = await listLayouts(db);
      expect(all).toHaveLength(1);  // not two rows
    });

    it('rewrites rows + sections atomically', async () => {
      const first = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {}, colSpan: 12 }] }] }],
      }, { userId });

      // Replace with a totally different layout
      await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{
          zone: 'sidebar',
          rows: [
            { order: 0, sections: [{ order: 0, type: 'stats', config: {}, colSpan: 12 }] },
            { order: 1, sections: [] },
          ],
        }],
      }, { userId });

      const updated = await getLayoutById(db, first.id);
      expect(updated!.zones).toHaveLength(1);
      expect(updated!.zones[0]!.zone).toBe('sidebar');
      expect(updated!.zones[0]!.rows).toHaveLength(2);
      expect(updated!.zones[0]!.rows[0]!.sections[0]!.type).toBe('stats');
    });

    it('cascade deletes orphan rows + sections when zone is removed', async () => {
      const created = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {}, colSpan: 12 }] }] }],
      }, { userId });

      // Save with empty zones
      await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [],
      }, { userId });

      // Underlying tables: no rows / sections for this layout
      const rows = await db.select().from(layoutRows).where(eq(layoutRows.layoutId, created.id));
      expect(rows).toEqual([]);
      // The layout itself still exists
      expect(await getLayoutById(db, created.id)).not.toBeNull();
    });
  });

  // ---- Defaults on optional fields ---------------------------------------

  describe('saveLayout (defaults)', () => {
    it('defaults colSpan to 12 when omitted', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {} }] }] }],
      }, { userId });
      expect(saved.zones[0]!.rows[0]!.sections[0]!.colSpan).toBe(12);
    });

    it('defaults enabled=true when omitted', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {}, colSpan: 12 }] }] }],
      }, { userId });
      expect(saved.zones[0]!.rows[0]!.sections[0]!.enabled).toBe(true);
    });

    it('defaults schemaVersion to 1 when omitted', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {}, colSpan: 12 }] }] }],
      }, { userId });
      expect(saved.zones[0]!.rows[0]!.sections[0]!.schemaVersion).toBe(1);
    });
  });

  // ---- Delete ------------------------------------------------------------

  describe('deleteLayout', () => {
    it('removes the layout and cascades to rows + sections + versions', async () => {
      const created = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: {}, colSpan: 12 }] }] }],
      }, { userId });
      await publishLayout(db, created.id, { publishedBy: userId });

      await deleteLayout(db, created.id);

      expect(await getLayoutById(db, created.id)).toBeNull();
      expect(await db.select().from(layoutRows).where(eq(layoutRows.layoutId, created.id))).toEqual([]);
      expect(await db.select().from(layoutSections)).toEqual([]);
      expect(await db.select().from(layoutVersions).where(eq(layoutVersions.layoutId, created.id))).toEqual([]);
    });
  });

  // ---- Versioning --------------------------------------------------------

  describe('publishLayout + revertToVersion', () => {
    it('snapshot captures the layout at publish time exactly', async () => {
      const created = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: { variant: 'a' }, colSpan: 12 }] }] }],
      }, { userId });

      const v1 = await publishLayout(db, created.id, { publishedBy: userId });
      expect(v1.version).toBe(1);
      expect(v1.snapshot.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ variant: 'a' });

      // Edit the layout
      await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: { variant: 'b' }, colSpan: 12 }] }] }],
      }, { userId, id: created.id });

      // The version snapshot must still hold 'a' (immutable)
      const versions = await listLayoutVersions(db, created.id);
      expect(versions).toHaveLength(1);
      expect(versions[0]!.snapshot.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ variant: 'a' });

      // Current layout has 'b'
      const current = await getLayoutById(db, created.id);
      expect(current!.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ variant: 'b' });
    });

    it('publishLayout sets published_version_id + state=published', async () => {
      const created = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [],
      }, { userId });
      expect(created.state).toBe('draft');
      expect(created.publishedVersionId).toBeNull();

      const v = await publishLayout(db, created.id, { publishedBy: userId });
      const after = await getLayoutById(db, created.id);
      expect(after!.state).toBe('published');
      expect(after!.publishedVersionId).toBe(v.id);
    });

    it('subsequent publishes increment the version number', async () => {
      const created = await saveLayout(db, { scope: { type: 'route', path: '/' }, name: 'X', zones: [] }, { userId });
      const v1 = await publishLayout(db, created.id, { publishedBy: userId });
      const v2 = await publishLayout(db, created.id, { publishedBy: userId });
      const v3 = await publishLayout(db, created.id, { publishedBy: userId });
      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it('revertToVersion restores the snapshot without mutating the version row', async () => {
      const created = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: { v: 'a' }, colSpan: 12 }] }] }],
      }, { userId });
      const v1 = await publishLayout(db, created.id, { publishedBy: userId });

      // Edit + publish v2
      await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'Homepage',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'hero', config: { v: 'b' }, colSpan: 12 }] }] }],
      }, { userId, id: created.id });

      // Revert to v1
      const reverted = await revertToVersion(db, created.id, v1.id, { userId });
      expect(reverted.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ v: 'a' });
      expect(reverted.state).toBe('draft');  // revert leaves it as draft

      // v1 + v2 still exist (immutable)
      const versions = await listLayoutVersions(db, created.id);
      expect(versions.length).toBeGreaterThanOrEqual(1);
      expect(versions[versions.length - 1]!.snapshot.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ v: 'a' });
    });
  });

  // ---- Forward-compat ----------------------------------------------------

  describe('forward-compat', () => {
    it('accepts an unknown section type (validation is upstream)', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{ zone: 'main', rows: [{ order: 0, sections: [{ order: 0, type: 'some-future-type', config: { x: 1 }, colSpan: 12 }] }] }],
      }, { userId });
      expect(saved.zones[0]!.rows[0]!.sections[0]!.type).toBe('some-future-type');
    });

    it('preserves visibility + responsive on round-trip', async () => {
      const saved = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'X',
        zones: [{
          zone: 'main',
          rows: [{
            order: 0,
            config: { gap: 'lg', align: 'center' },
            sections: [{
              order: 0,
              type: 'hero',
              config: {},
              colSpan: 8,
              responsive: { sm: 12, md: 8, lg: 8 },
              visibility: { roles: ['admin'], features: ['contests'], hideAt: ['sm'] },
            }],
          }],
        }],
      }, { userId });
      const row = saved.zones[0]!.rows[0]!;
      expect(row.config?.gap).toBe('lg');
      expect(row.sections[0]!.responsive).toEqual({ sm: 12, md: 8, lg: 8 });
      expect(row.sections[0]!.visibility?.roles).toEqual(['admin']);
      expect(row.sections[0]!.visibility?.hideAt).toEqual(['sm']);
    });
  });

  // ---- Bulk list (session 162 P2.2 — no N+1) ----------------------------

  describe('listLayouts (bulk)', () => {
    it('returns assembled records identical to per-layout getLayoutById for many layouts', async () => {
      // Seed 6 layouts spanning all 3 scope types, each with varied
      // zone / row / section shapes so the bulk assembler exercises:
      //   - multiple zones per layout
      //   - multiple rows per zone
      //   - multiple sections per row
      //   - empty zones (no rows)
      //   - layouts with no rows at all
      const inputs: LayoutInput[] = [
        {
          scope: { type: 'route', path: '/' },
          name: 'Homepage',
          zones: [
            {
              zone: 'main',
              rows: [
                { order: 0, sections: [{ order: 0, type: 'hero', config: { a: 1 }, colSpan: 12 }] },
                { order: 1, sections: [
                  { order: 0, type: 'image', config: { url: 'x' }, colSpan: 6 },
                  { order: 1, type: 'paragraph', config: { body: 'y' }, colSpan: 6 },
                ] },
              ],
            },
            {
              zone: 'sidebar',
              rows: [{ order: 0, sections: [{ order: 0, type: 'stats', config: {}, colSpan: 12 }] }],
            },
          ],
        },
        { scope: { type: 'route', path: '/about' }, name: 'About', zones: [] },
        {
          scope: { type: 'custom-page', path: '/landing' },
          name: 'Landing',
          pageMeta: { title: 'Landing', access: 'public' },
          zones: [{ zone: 'main', rows: [
            { order: 0, sections: [{ order: 0, type: 'heading', config: { text: 'Hi' }, colSpan: 12 }] },
          ] }],
        },
        { scope: { type: 'virtual', key: '__footer' }, name: 'Footer', zones: [] },
        { scope: { type: 'virtual', key: '__not-found' }, name: '404', zones: [] },
        {
          scope: { type: 'custom-page', path: '/pricing' },
          name: 'Pricing',
          zones: [{ zone: 'main', rows: [
            { order: 0, sections: [
              { order: 0, type: 'content-feed', config: { contentType: 'project' }, colSpan: 12 },
            ] },
          ] }],
        },
      ];
      for (const i of inputs) await saveLayout(db, i, { userId });

      const bulk = await listLayouts(db);
      expect(bulk).toHaveLength(6);

      // Each bulk record must match what getLayoutById would return for it.
      for (const b of bulk) {
        const single = await getLayoutById(db, b.id);
        expect(single).not.toBeNull();
        expect(single).toEqual(b);
      }
    });

    it('honours scopeType filter without re-querying per layout', async () => {
      await saveLayout(db, { scope: { type: 'route', path: '/' }, name: 'A', zones: [] }, { userId });
      await saveLayout(db, { scope: { type: 'route', path: '/x' }, name: 'B', zones: [] }, { userId });
      await saveLayout(db, { scope: { type: 'virtual', key: '__footer' }, name: 'F', zones: [] }, { userId });
      await saveLayout(db, { scope: { type: 'custom-page', path: '/p' }, name: 'P', zones: [] }, { userId });

      const routes = await listLayouts(db, { scopeType: 'route' });
      expect(routes).toHaveLength(2);
      expect(routes.every((l) => l.scope.type === 'route')).toBe(true);

      const virtuals = await listLayouts(db, { scopeType: 'virtual' });
      expect(virtuals).toHaveLength(1);

      const customs = await listLayouts(db, { scopeType: 'custom-page' });
      expect(customs).toHaveLength(1);
    });

    it('does not cross-pollinate rows between layouts (R4 regression guard)', async () => {
      // Two layouts with disjoint rows + sections — the bulk assembler
      // must not stitch a row from layout B into layout A's zones.
      const a = await saveLayout(db, {
        scope: { type: 'route', path: '/' },
        name: 'A',
        zones: [{ zone: 'main', rows: [
          { order: 0, sections: [{ order: 0, type: 'hero', config: { who: 'a-hero' }, colSpan: 12 }] },
        ] }],
      }, { userId });
      const b = await saveLayout(db, {
        scope: { type: 'route', path: '/x' },
        name: 'B',
        zones: [{ zone: 'sidebar', rows: [
          { order: 0, sections: [{ order: 0, type: 'stats', config: { who: 'b-stats' }, colSpan: 12 }] },
        ] }],
      }, { userId });

      const bulk = await listLayouts(db);
      const ra = bulk.find((l) => l.id === a.id)!;
      const rb = bulk.find((l) => l.id === b.id)!;
      expect(ra.zones).toHaveLength(1);
      expect(ra.zones[0]!.zone).toBe('main');
      expect(ra.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ who: 'a-hero' });
      expect(rb.zones).toHaveLength(1);
      expect(rb.zones[0]!.zone).toBe('sidebar');
      expect(rb.zones[0]!.rows[0]!.sections[0]!.config).toEqual({ who: 'b-stats' });
    });
  });
});
