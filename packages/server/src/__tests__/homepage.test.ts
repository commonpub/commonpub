/**
 * Server-side coverage for the homepage sections module.
 *
 * Zero tests before session 155 — see `docs/sessions/155-layout-foundation.md`.
 * Adds real CRUD round-trip + edge-case coverage so future layout-engine
 * work (which migrates the legacy homepage system) has a known-good baseline
 * to compare against.
 *
 * Per `docs/plans/layout-and-pages.md` §10.2: "real" means exercises the
 * actual function, asserts observable outcomes (DB row contents), covers
 * failure modes. No mocking the function under test.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getHomepageSections,
  setHomepageSections,
  resetHomepageSections,
  DEFAULT_SECTIONS,
  type HomepageSection,
} from '../homepage/homepage.js';

describe('homepage sections — server CRUD', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const admin = await createTestUser(db, { role: 'admin' });
    adminId = admin.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  describe('getHomepageSections', () => {
    it('returns DEFAULT_SECTIONS when no setting exists', async () => {
      const sections = await getHomepageSections(db);
      expect(sections).toEqual(DEFAULT_SECTIONS);
    });

    it('returns DEFAULT_SECTIONS when the setting is an empty array', async () => {
      // Empty-array semantics: same as missing. Treated as "use defaults"
      // rather than "render nothing" — important so admins can't accidentally
      // blank their homepage by clearing all sections in the editor.
      await setHomepageSections(db, [], adminId);
      const sections = await getHomepageSections(db);
      expect(sections).toEqual(DEFAULT_SECTIONS);
    });
  });

  describe('setHomepageSections', () => {
    it('persists and returns the saved sections', async () => {
      const custom: HomepageSection[] = [
        {
          id: 'just-hero',
          type: 'hero',
          title: 'My Hero',
          enabled: true,
          order: 0,
          config: { variant: 'centered' },
        },
      ];
      await setHomepageSections(db, custom, adminId);
      const got = await getHomepageSections(db);
      expect(got).toEqual(custom);
    });

    it('overwrites the previous value (last-writer-wins)', async () => {
      await setHomepageSections(db, [
        { id: 'a', type: 'hero', enabled: true, order: 0, config: {} },
      ], adminId);
      await setHomepageSections(db, [
        { id: 'b', type: 'stats', enabled: true, order: 0, config: {} },
      ], adminId);
      const got = await getHomepageSections(db);
      expect(got).toHaveLength(1);
      expect(got[0]?.id).toBe('b');
    });

    it('preserves enabled=false sections (admin disables but keeps the config)', async () => {
      const sections: HomepageSection[] = [
        { id: 'visible', type: 'hero', enabled: true, order: 0, config: { variant: 'default' } },
        { id: 'hidden', type: 'stats', enabled: false, order: 1, config: {} },
      ];
      await setHomepageSections(db, sections, adminId);
      const got = await getHomepageSections(db);
      expect(got).toHaveLength(2);
      expect(got.find((s) => s.id === 'hidden')?.enabled).toBe(false);
    });

    it('accepts an unknown section type (forward-compat for future layer versions)', async () => {
      // If a layer upgrade introduces a section type that an older instance
      // doesn't recognize, the storage layer accepts it — the renderer is the
      // one that decides what to do (renders nothing in the legacy renderer;
      // shows an error placeholder in the new layout engine).
      const sections = [
        {
          id: 'future',
          type: 'totally-new-type' as HomepageSection['type'],
          enabled: true,
          order: 0,
          config: { unknownField: 'value' as unknown as string },
        },
      ];
      await setHomepageSections(db, sections, adminId);
      const got = await getHomepageSections(db);
      expect(got[0]?.type).toBe('totally-new-type');
    });

    it('records an audit log entry with the admin id', async () => {
      await setHomepageSections(db, [
        { id: 'audited', type: 'hero', enabled: true, order: 0, config: {} },
      ], adminId);
      // setInstanceSetting (which setHomepageSections delegates to) writes
      // updated_by — that's our observable side effect.
      const [row] = await db
        .select()
        .from(instanceSettings)
        .where(eq(instanceSettings.key, 'homepage.sections'));
      expect(row?.updatedBy).toBe(adminId);
    });
  });

  describe('resetHomepageSections', () => {
    it('replaces saved sections with DEFAULT_SECTIONS', async () => {
      await setHomepageSections(db, [
        { id: 'custom', type: 'hero', enabled: true, order: 0, config: {} },
      ], adminId);
      await resetHomepageSections(db, adminId);
      const got = await getHomepageSections(db);
      expect(got).toEqual(DEFAULT_SECTIONS);
    });

    it('is idempotent when the value is already default', async () => {
      await resetHomepageSections(db, adminId);
      await resetHomepageSections(db, adminId);
      const got = await getHomepageSections(db);
      expect(got).toEqual(DEFAULT_SECTIONS);
    });
  });

  describe('DEFAULT_SECTIONS shape', () => {
    it('declares at least one hero, content-grid, and stats section', () => {
      const types = DEFAULT_SECTIONS.map((s) => s.type);
      expect(types).toContain('hero');
      expect(types).toContain('content-grid');
      expect(types).toContain('stats');
    });

    it('has unique ids', () => {
      const ids = DEFAULT_SECTIONS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has monotonically increasing order values', () => {
      const orders = DEFAULT_SECTIONS.map((s) => s.order);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
      }
    });

    it('gates contests + hubs sections behind their feature flags via config.featureGate', () => {
      const contests = DEFAULT_SECTIONS.find((s) => s.type === 'contests');
      const hubs = DEFAULT_SECTIONS.find((s) => s.type === 'hubs');
      expect(contests?.config.featureGate).toBe('contests');
      expect(hubs?.config.featureGate).toBe('hubs');
    });
  });

  describe('malformed storage row tolerance', () => {
    it('falls back to defaults when the stored value is not an array', async () => {
      // Direct DB poke — simulates a bad migration or hand-edit. The reader
      // should fall back rather than throw, so the page still renders.
      await db
        .delete(instanceSettings)
        .where(eq(instanceSettings.key, 'homepage.sections'));
      await db.insert(instanceSettings).values({
        key: 'homepage.sections',
        value: { not: 'an array' } as unknown as HomepageSection[],
        updatedBy: adminId,
        updatedAt: new Date(),
      });
      const got = await getHomepageSections(db);
      expect(got).toEqual(DEFAULT_SECTIONS);
    });
  });
});
