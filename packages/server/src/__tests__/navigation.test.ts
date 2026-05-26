/**
 * Server-side coverage for the navigation items module.
 *
 * Same gap as homepage.ts — zero tests before session 155. Adds real CRUD
 * coverage plus nested-children round-trips (since nav items can have
 * children for dropdown menus, that's a real shape to preserve).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceSettings } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  getNavItems,
  setNavItems,
  resetNavItems,
  DEFAULT_NAV_ITEMS,
  type NavItem,
} from '../navigation/navigation.js';

describe('navigation items — server CRUD', () => {
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

  describe('getNavItems', () => {
    it('returns DEFAULT_NAV_ITEMS when no setting exists', async () => {
      const items = await getNavItems(db);
      expect(items).toEqual(DEFAULT_NAV_ITEMS);
    });

    it('returns defaults when stored value is an empty array', async () => {
      await setNavItems(db, [], adminId);
      const items = await getNavItems(db);
      expect(items).toEqual(DEFAULT_NAV_ITEMS);
    });
  });

  describe('setNavItems', () => {
    it('persists and returns the saved items', async () => {
      const custom: NavItem[] = [
        { id: 'home', type: 'link', label: 'Home', icon: 'fa-house', route: '/' },
      ];
      await setNavItems(db, custom, adminId);
      const got = await getNavItems(db);
      expect(got).toEqual(custom);
    });

    it('preserves nested children for dropdown menus', async () => {
      const items: NavItem[] = [
        {
          id: 'build',
          type: 'dropdown',
          label: 'Build',
          icon: 'fa-hammer',
          children: [
            { id: 'projects', type: 'link', label: 'Projects', route: '/project' },
            { id: 'contests', type: 'link', label: 'Contests', route: '/contests', featureGate: 'contests' },
          ],
        },
      ];
      await setNavItems(db, items, adminId);
      const got = await getNavItems(db);
      expect(got[0]?.type).toBe('dropdown');
      expect(got[0]?.children).toHaveLength(2);
      expect(got[0]?.children?.[1]?.featureGate).toBe('contests');
    });

    it('preserves visibleTo: admin role gating', async () => {
      await setNavItems(db, [
        { id: 'admin', type: 'link', label: 'Admin', route: '/admin', visibleTo: 'admin' },
      ], adminId);
      const got = await getNavItems(db);
      expect(got[0]?.visibleTo).toBe('admin');
    });

    it('preserves disabled state for upcoming features', async () => {
      // The default nav uses `disabled: true` for "coming soon" items
      // (livestreams, podcasts). The renderer treats those as visually
      // present but un-clickable. Round-trip MUST preserve this.
      await setNavItems(db, [
        { id: 'soon', type: 'link', label: 'Coming Soon', route: '/x', disabled: true },
      ], adminId);
      const got = await getNavItems(db);
      expect(got[0]?.disabled).toBe(true);
    });

    it('records updated_by audit field', async () => {
      await setNavItems(db, [{ id: 'x', type: 'link', label: 'X', route: '/x' }], adminId);
      const [row] = await db
        .select()
        .from(instanceSettings)
        .where(eq(instanceSettings.key, 'nav.items'));
      expect(row?.updatedBy).toBe(adminId);
    });

    it('last-writer-wins across two consecutive saves', async () => {
      await setNavItems(db, [{ id: 'a', type: 'link', label: 'A', route: '/a' }], adminId);
      await setNavItems(db, [{ id: 'b', type: 'link', label: 'B', route: '/b' }], adminId);
      const got = await getNavItems(db);
      expect(got).toHaveLength(1);
      expect(got[0]?.id).toBe('b');
    });
  });

  describe('resetNavItems', () => {
    it('replaces saved items with DEFAULT_NAV_ITEMS', async () => {
      await setNavItems(db, [{ id: 'just', type: 'link', label: 'Just one', route: '/' }], adminId);
      await resetNavItems(db, adminId);
      const got = await getNavItems(db);
      expect(got).toEqual(DEFAULT_NAV_ITEMS);
    });
  });

  describe('DEFAULT_NAV_ITEMS shape', () => {
    it('has unique top-level ids', () => {
      const ids = DEFAULT_NAV_ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every dropdown declares children', () => {
      for (const item of DEFAULT_NAV_ITEMS) {
        if (item.type === 'dropdown') {
          expect(item.children, `dropdown ${item.id} missing children`).toBeDefined();
          expect(item.children!.length).toBeGreaterThan(0);
        }
      }
    });

    it('every enabled link declares a route (disabled placeholders may omit)', () => {
      // The default nav includes placeholder items like `livestreams` and
      // `podcasts` that are flagged `disabled: true` and intentionally have
      // no route (they render as "coming soon" badges). Only the enabled
      // links need a route.
      function checkLinks(items: NavItem[]): void {
        for (const item of items) {
          if (item.type === 'link' && !item.disabled) {
            expect(item.route, `enabled link ${item.id} missing route`).toBeTruthy();
          }
          if (item.children) checkLinks(item.children);
        }
      }
      checkLinks(DEFAULT_NAV_ITEMS);
    });

    it('admin item is gated on the admin role + feature flag', () => {
      const admin = DEFAULT_NAV_ITEMS.find((i) => i.id === 'admin');
      expect(admin?.visibleTo).toBe('admin');
      expect(admin?.featureGate).toBe('admin');
    });

    it('gates fediverse on the federation feature', () => {
      const fed = DEFAULT_NAV_ITEMS.find((i) => i.id === 'fediverse');
      expect(fed?.featureGate).toBe('federation');
    });
  });

  describe('malformed storage row tolerance', () => {
    it('falls back to defaults when the stored value is not an array', async () => {
      await db
        .delete(instanceSettings)
        .where(eq(instanceSettings.key, 'nav.items'));
      await db.insert(instanceSettings).values({
        key: 'nav.items',
        value: 'not even close' as unknown as NavItem[],
        updatedBy: adminId,
        updatedAt: new Date(),
      });
      const got = await getNavItems(db);
      expect(got).toEqual(DEFAULT_NAV_ITEMS);
    });
  });
});
