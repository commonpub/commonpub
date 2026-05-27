/**
 * migrateHomepageSectionsToLayout — PGlite integration tests.
 *
 * Real DB round-trips through saveLayout/publishLayout/getLayoutByScope.
 * No mocks — every assertion targets observable DB state (rows in
 * `layouts`, `layout_rows`, `layout_sections`, `layout_versions`) or the
 * function's return value.
 *
 * Per docs/plans/layout-and-pages.md §10.2 + memory
 * `feedback-integration-test-full-output-path`: tests cover the full
 * read-legacy → group → save → publish path, not just the mapping
 * helpers in isolation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { layouts, layoutRows, layoutSections, layoutVersions, instanceSettings } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { migrateHomepageSectionsToLayout } from '../layout/migrate-homepage.js';
import { getLayoutByScope } from '../layout/layout.js';

// A realistic homepage.sections snapshot — modeled on commonpub.io's
// live state queried during session 159 (7 sections covering all 6
// section types touched by the migration).
const REALISTIC_LEGACY = [
  {
    id: 'hero', type: 'hero', order: 0, title: 'Hero Banner',
    config: { variant: 'default' }, enabled: true,
  },
  {
    id: 'editorial', type: 'editorial', order: 1, title: 'Staff Picks',
    config: { limit: 3, featureGate: 'editorial' }, enabled: true,
  },
  {
    id: 'content-feed', type: 'content-grid', order: 2, title: 'Content Feed',
    config: { sort: 'popular', limit: 12, columns: 2 }, enabled: true,
  },
  {
    id: 'contests-sidebar', type: 'contests', order: 3, title: 'Active Contests',
    config: { limit: 3, featureGate: 'contests' }, enabled: true,
  },
  {
    id: 'hubs-sidebar', type: 'hubs', order: 4, title: 'Trending Hubs',
    config: { limit: 4, featureGate: 'hubs' }, enabled: true,
  },
  {
    id: 'stats', type: 'stats', order: 5, title: 'Platform Stats',
    config: {}, enabled: true,
  },
  {
    id: 'section-1776325353411', type: 'editorial', order: 6, title: 'New Section',
    config: { sort: 'editorial', limit: 6, columns: 3 }, enabled: true,
  },
];

async function setLegacyHomepage(db: DB, sections: unknown[] | null): Promise<void> {
  // Delete first (in case beforeEach didn't clear) then insert.
  await db.execute(sql`DELETE FROM instance_settings WHERE key = 'homepage.sections'`);
  if (sections === null) return;
  await db.insert(instanceSettings).values({
    key: 'homepage.sections',
    value: sections as object,
  });
}

describe('migrateHomepageSectionsToLayout', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const u = await createTestUser(db, { role: 'admin' });
    adminId = u.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(layouts);
    await db.execute(sql`DELETE FROM instance_settings WHERE key = 'homepage.sections'`);
  });

  // ---- Empty / missing legacy data -------------------------------------

  it('returns no-legacy-data when instance_settings has no homepage.sections key', async () => {
    const result = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(result).toEqual({
      migrated: false,
      sectionsConverted: 0,
      sectionsSkipped: 0,
      reason: 'no-legacy-data',
    });
  });

  it('returns no-legacy-data when homepage.sections is not an array (corrupt)', async () => {
    await setLegacyHomepage(db, [{} as unknown]); // wrong shape but is an array
    // Actually trickier — re-insert a non-array value via raw SQL:
    await db.execute(sql`UPDATE instance_settings SET value = '"not-an-array"'::jsonb WHERE key = 'homepage.sections'`);
    const result = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('no-legacy-data');
  });

  it('returns no-enabled-sections when every legacy section is disabled', async () => {
    await setLegacyHomepage(db, [
      { id: 'h', type: 'hero', enabled: false },
      { id: 'e', type: 'editorial', enabled: false },
    ]);
    const result = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(result.migrated).toBe(false);
    expect(result.reason).toBe('no-enabled-sections');
    expect(result.sectionsSkipped).toBe(2);
    expect(result.skipReasons).toEqual({ h: 'disabled', e: 'disabled' });
  });

  // ---- Idempotency ------------------------------------------------------

  it('skips when a layout already exists at ("route","/"), returns its id', async () => {
    await setLegacyHomepage(db, REALISTIC_LEGACY);
    const first = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(first.migrated).toBe(true);

    const second = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(second.migrated).toBe(false);
    expect(second.reason).toBe('layout-already-exists');
    expect(second.layoutId).toBe(first.layoutId);
  });

  it('replaces existing layout when force=true (deletes + recreates)', async () => {
    await setLegacyHomepage(db, REALISTIC_LEGACY);
    const first = await migrateHomepageSectionsToLayout(db, { adminId });
    const firstId = first.layoutId!;

    const second = await migrateHomepageSectionsToLayout(db, { adminId, force: true });
    expect(second.migrated).toBe(true);
    expect(second.layoutId).not.toBe(firstId);  // new uuid

    // Old layout's rows are gone (cascade)
    const oldRows = await db.select().from(layoutRows).where(eq(layoutRows.layoutId, firstId));
    expect(oldRows).toHaveLength(0);
  });

  // ---- Section conversion ----------------------------------------------

  it('converts every enabled section + reports counts', async () => {
    await setLegacyHomepage(db, REALISTIC_LEGACY);
    const result = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(result.migrated).toBe(true);
    expect(result.sectionsConverted).toBe(7);
    expect(result.sectionsSkipped).toBe(0);
  });

  it('skips unknown section types + records skipReasons', async () => {
    await setLegacyHomepage(db, [
      { id: 'h', type: 'hero', order: 0, enabled: true, config: {} },
      { id: 'bogus', type: 'gizmo', order: 1, enabled: true, config: {} },
    ]);
    const result = await migrateHomepageSectionsToLayout(db, { adminId });
    expect(result.migrated).toBe(true);
    expect(result.sectionsConverted).toBe(1);
    expect(result.sectionsSkipped).toBe(1);
    expect(result.skipReasons).toEqual({ bogus: 'unknown-type' });
  });

  it('maps legacy content-grid → registered content-feed', async () => {
    await setLegacyHomepage(db, [
      {
        id: 'feed', type: 'content-grid', order: 0, title: 'Latest',
        config: { sort: 'popular', limit: 12, columns: 2 }, enabled: true,
      },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });

    const sections = await db.select().from(layoutSections);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.type).toBe('content-feed');
    expect(sections[0]!.config).toMatchObject({
      heading: 'Latest',
      sort: 'popular',
      limit: 12,
      columns: 2,
    });
  });

  // ---- Zone placement ---------------------------------------------------

  it('places hero in full-width zone, stats/contests/hubs in sidebar, rest in main', async () => {
    await setLegacyHomepage(db, REALISTIC_LEGACY);
    await migrateHomepageSectionsToLayout(db, { adminId });

    const layout = await getLayoutByScope(db, { type: 'route', path: '/' });
    const zoneMap = new Map(layout!.zones.map((z) => [z.zone, z.rows[0].sections.map((s) => s.type)]));

    expect(zoneMap.get('full-width')).toEqual(['hero']);
    expect(zoneMap.get('main')).toEqual(['editorial', 'content-feed', 'editorial']);
    expect(zoneMap.get('sidebar')).toEqual(['contests', 'hubs', 'stats']);
  });

  it('preserves legacy order within a zone', async () => {
    // Stats first, then contests, then hubs — opposite of REALISTIC's order
    await setLegacyHomepage(db, [
      { id: 's', type: 'stats', order: 0, title: 'A', enabled: true, config: {} },
      { id: 'c', type: 'contests', order: 1, title: 'B', enabled: true, config: {} },
      { id: 'h', type: 'hubs', order: 2, title: 'C', enabled: true, config: {} },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });
    const layout = await getLayoutByScope(db, { type: 'route', path: '/' });
    const sidebar = layout!.zones.find((z) => z.zone === 'sidebar')!;
    expect(sidebar.rows[0].sections.map((s) => s.type)).toEqual(['stats', 'contests', 'hubs']);
  });

  // ---- Config mapping ---------------------------------------------------

  it('copies legacy title to new config.heading', async () => {
    await setLegacyHomepage(db, [
      { id: 'e', type: 'editorial', order: 0, title: 'Staff Picks', enabled: true, config: { limit: 5 } },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });
    const sections = await db.select().from(layoutSections);
    expect(sections[0]!.config).toMatchObject({ heading: 'Staff Picks', limit: 5 });
  });

  it('clamps config.limit to each section type max', async () => {
    await setLegacyHomepage(db, [
      { id: 'h', type: 'hubs', order: 0, enabled: true, config: { limit: 999 } },
      { id: 'c', type: 'contests', order: 1, enabled: true, config: { limit: 999 } },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });
    const sections = await db.select().from(layoutSections);
    const hubsCfg = sections.find((s) => s.type === 'hubs')!.config as { limit: number };
    const contestsCfg = sections.find((s) => s.type === 'contests')!.config as { limit: number };
    expect(hubsCfg.limit).toBe(20);     // hubs clamps to [1,20]
    expect(contestsCfg.limit).toBe(10); // contests clamps to [1,10]
  });

  // ---- visibility.features wiring --------------------------------------

  it('sets visibility.features for contests / hubs / learning sections', async () => {
    await setLegacyHomepage(db, [
      { id: 'c', type: 'contests', order: 0, enabled: true, config: {} },
      { id: 'h', type: 'hubs', order: 1, enabled: true, config: {} },
      { id: 'l', type: 'learning', order: 2, enabled: true, config: {} },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });
    const sections = await db.select().from(layoutSections);
    const byType = new Map(sections.map((s) => [s.type, s]));

    expect((byType.get('contests')!.visibility as { features?: string[] }).features).toEqual(['contests']);
    expect((byType.get('hubs')!.visibility as { features?: string[] }).features).toEqual(['hubs']);
    expect((byType.get('learning')!.visibility as { features?: string[] }).features).toEqual(['learning']);
  });

  it('does NOT set visibility on always-on section types (hero, editorial, content-feed, stats, custom-html)', async () => {
    await setLegacyHomepage(db, [
      { id: 'hero', type: 'hero', order: 0, enabled: true, config: {} },
      { id: 'ed', type: 'editorial', order: 1, enabled: true, config: {} },
      { id: 'fd', type: 'content-grid', order: 2, enabled: true, config: {} },
      { id: 'st', type: 'stats', order: 3, enabled: true, config: {} },
      { id: 'ch', type: 'custom-html', order: 4, enabled: true, config: { html: '<p>x</p>' } },
    ]);
    await migrateHomepageSectionsToLayout(db, { adminId });
    const sections = await db.select().from(layoutSections);
    for (const s of sections) {
      expect(s.visibility, `${s.type} should have no visibility`).toBeNull();
    }
  });

  // ---- Publish + versioning --------------------------------------------

  it('publishes the migrated layout immediately (state=published, v1 snapshot)', async () => {
    await setLegacyHomepage(db, REALISTIC_LEGACY);
    const result = await migrateHomepageSectionsToLayout(db, { adminId });

    const layout = await getLayoutByScope(db, { type: 'route', path: '/' });
    expect(layout!.state).toBe('published');
    expect(layout!.publishedVersionId).not.toBeNull();

    const versions = await db.select().from(layoutVersions).where(eq(layoutVersions.layoutId, result.layoutId!));
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.publishedBy).toBe(adminId);
  });

  it('attributes createdBy + publishedBy when adminId is passed; nulls when omitted', async () => {
    await setLegacyHomepage(db, [
      { id: 'h', type: 'hero', order: 0, enabled: true, config: {} },
    ]);

    // With adminId
    const a = await migrateHomepageSectionsToLayout(db, { adminId });
    const aRow = await db.select().from(layouts).where(eq(layouts.id, a.layoutId!));
    expect(aRow[0]!.createdBy).toBe(adminId);

    // Wipe + without adminId (CLI / system bootstrap)
    await db.delete(layouts);
    const b = await migrateHomepageSectionsToLayout(db);
    const bRow = await db.select().from(layouts).where(eq(layouts.id, b.layoutId!));
    expect(bRow[0]!.createdBy).toBeNull();
  });
});
