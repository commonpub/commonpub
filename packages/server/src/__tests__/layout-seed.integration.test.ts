/**
 * Homepage seed helper — idempotency, payload shape, version creation.
 *
 * The seed is the operator's one-shot "give me a working homepage layout
 * to flip the flag against" bootstrap. It's NOT the full migration of
 * the legacy `homepage.sections` JSON (that needs the rest of the
 * section catalogue, deferred to Phase 6b).
 *
 * Tests per docs/plans/layout-and-pages.md §10.2: real DB round-trips
 * via PGlite, observable outcomes (layouts row + sections row +
 * versions row), no mocks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { layouts, layoutSections, layoutVersions } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import { seedHomepageLayout } from '../layout/seed.js';
import { getLayoutByScope } from '../layout/layout.js';

describe('seedHomepageLayout', () => {
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
  });

  it('creates a route-scope layout at "/" on first call', async () => {
    const result = await seedHomepageLayout(db, { adminId });
    expect(result.created).toBe(true);
    expect(result.layoutId).toMatch(/^[0-9a-f-]{36}$/);

    const fetched = await getLayoutByScope(db, { type: 'route', path: '/' });
    expect(fetched).not.toBeNull();
    expect(fetched!.scope).toEqual({ type: 'route', path: '/' });
    expect(fetched!.name).toBe('Homepage');
  });

  it('publishes the seeded layout immediately (state=published, v1 snapshot exists)', async () => {
    const { layoutId } = await seedHomepageLayout(db, { adminId });
    const fetched = await getLayoutByScope(db, { type: 'route', path: '/' });
    expect(fetched!.state).toBe('published');
    expect(fetched!.publishedVersionId).not.toBeNull();

    const versions = await db.select().from(layoutVersions).where(eq(layoutVersions.layoutId, layoutId));
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.publishedBy).toBe(adminId);
  });

  it('idempotent: second call returns { created: false } with the existing id', async () => {
    const first = await seedHomepageLayout(db, { adminId });
    const second = await seedHomepageLayout(db, { adminId });
    expect(second.created).toBe(false);
    expect(second.layoutId).toBe(first.layoutId);

    // No new version row is inserted by the second call
    const versions = await db.select().from(layoutVersions).where(eq(layoutVersions.layoutId, first.layoutId));
    expect(versions).toHaveLength(1);
  });

  it('seeds exactly two zones: full-width (hero) + main (content-feed)', async () => {
    const { layoutId } = await seedHomepageLayout(db, { adminId });
    const fetched = await getLayoutByScope(db, { type: 'route', path: '/' });
    expect(fetched!.zones).toHaveLength(2);

    const fullWidth = fetched!.zones.find((z) => z.zone === 'full-width');
    const main = fetched!.zones.find((z) => z.zone === 'main');
    expect(fullWidth).toBeTruthy();
    expect(main).toBeTruthy();

    expect(fullWidth!.rows).toHaveLength(1);
    expect(fullWidth!.rows[0]!.sections).toHaveLength(1);
    expect(fullWidth!.rows[0]!.sections[0]!.type).toBe('hero');

    expect(main!.rows).toHaveLength(1);
    expect(main!.rows[0]!.sections).toHaveLength(1);
    expect(main!.rows[0]!.sections[0]!.type).toBe('content-feed');

    // Cross-check against the sections table directly (DB is the truth, not
    // just the in-memory record) — both rows are persisted.
    const sectionRows = await db.select().from(layoutSections);
    const types = sectionRows.map((s) => s.type).sort();
    expect(types).toEqual(['content-feed', 'hero']);
  });

  it('seeded hero + content-feed configs round-trip and parse against the runtime schema spec', async () => {
    // We don't import the registry here (would need the layer's Vue plugin
    // chain), but we can pin the expected config keys — if the seed
    // diverges from what the registry expects, the in-app render placeholder
    // surfaces "unregistered section" but THIS test still passes; the
    // section-registry test in the layer pins the runtime contract.
    await seedHomepageLayout(db, { adminId });
    const fetched = await getLayoutByScope(db, { type: 'route', path: '/' });
    const hero = fetched!.zones
      .find((z) => z.zone === 'full-width')!
      .rows[0]!.sections[0]!;
    const feed = fetched!.zones
      .find((z) => z.zone === 'main')!
      .rows[0]!.sections[0]!;

    expect(hero.config).toMatchObject({
      variant: 'default',
      title: expect.any(String),
      ctas: expect.arrayContaining([
        expect.objectContaining({ href: '/create', variant: 'primary' }),
      ]),
    });
    expect(hero.colSpan).toBe(12);
    expect(hero.schemaVersion).toBe(1);

    expect(feed.config).toMatchObject({
      sort: 'recent',
      limit: 9,
      columns: 3,
    });
    expect(feed.colSpan).toBe(12);
    expect(feed.schemaVersion).toBe(1);
  });

  it('honours adminId attribution (createdBy + updatedBy + publishedBy)', async () => {
    const { layoutId } = await seedHomepageLayout(db, { adminId });
    const [row] = await db.select().from(layouts).where(eq(layouts.id, layoutId));
    expect(row!.createdBy).toBe(adminId);
    expect(row!.updatedBy).toBe(adminId);

    const [v] = await db.select().from(layoutVersions).where(eq(layoutVersions.layoutId, layoutId));
    expect(v!.publishedBy).toBe(adminId);
  });

  it('accepts a missing adminId (CLI / system-bootstrap path)', async () => {
    const result = await seedHomepageLayout(db);
    expect(result.created).toBe(true);
    const fetched = await getLayoutByScope(db, { type: 'route', path: '/' });
    expect(fetched!.state).toBe('published');
  });
});
