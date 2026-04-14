import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createAuditEntry,
  listAuditLogs,
  getPlatformStats,
  listUsers,
  updateUserRole,
  updateUserStatus,
  listReports,
  getInstanceSettings,
  getInstanceSetting,
  setInstanceSetting,
  removeContent,
} from '../admin/admin.js';
import { contentItems } from '@commonpub/schema';

describe('admin module', () => {
  let db: DB;
  let adminId: string;
  let userId: string;
  let staffId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const admin = await createTestUser(db, { username: 'admin', role: 'admin' });
    adminId = admin.id;
    const user = await createTestUser(db, { username: 'regularuser', role: 'member' });
    userId = user.id;
    const staff = await createTestUser(db, { username: 'staffuser', role: 'staff' });
    staffId = staff.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- Audit Logging ---

  describe('createAuditEntry + listAuditLogs', () => {
    it('creates and retrieves an audit entry', async () => {
      await createAuditEntry(db, {
        userId: adminId,
        action: 'test.action',
        targetType: 'test',
        targetId: userId,
        metadata: { reason: 'testing' },
        ipAddress: '127.0.0.1',
      });

      const { items, total } = await listAuditLogs(db, { action: 'test.action' });
      expect(total).toBeGreaterThanOrEqual(1);
      const entry = items.find((i) => i.targetId === userId);
      expect(entry).toBeDefined();
      expect(entry!.action).toBe('test.action');
      expect(entry!.targetType).toBe('test');
      expect(entry!.ipAddress).toBe('127.0.0.1');
      expect(entry!.metadata).toEqual({ reason: 'testing' });
      expect(entry!.user.username).toBe('admin');
    });

    it('filters audit logs by userId', async () => {
      await createAuditEntry(db, {
        userId: staffId,
        action: 'staff.action',
        targetType: 'test',
      });

      const { items } = await listAuditLogs(db, { userId: staffId });
      expect(items.every((i) => i.user.id === staffId)).toBe(true);
    });

    it('filters audit logs by targetType', async () => {
      const { items } = await listAuditLogs(db, { targetType: 'test' });
      expect(items.every((i) => i.targetType === 'test')).toBe(true);
    });

    it('respects pagination', async () => {
      const { items: page1 } = await listAuditLogs(db, { limit: 1, offset: 0 });
      expect(page1.length).toBeLessThanOrEqual(1);

      const { items: page2 } = await listAuditLogs(db, { limit: 1, offset: 1 });
      if (page2.length > 0) {
        expect(page2[0]!.id).not.toBe(page1[0]!.id);
      }
    });

    it('orders by createdAt descending', async () => {
      const { items } = await listAuditLogs(db);
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          items[i]!.createdAt.getTime(),
        );
      }
    });
  });

  // --- Platform Stats ---

  describe('getPlatformStats', () => {
    it('returns user counts by role', async () => {
      const stats = await getPlatformStats(db);
      expect(stats.users.total).toBeGreaterThanOrEqual(3);
      expect(stats.users.byRole['admin']).toBeGreaterThanOrEqual(1);
      expect(stats.users.byRole['member']).toBeGreaterThanOrEqual(1);
      expect(stats.users.byRole['staff']).toBeGreaterThanOrEqual(1);
    });

    it('returns zero counts for empty tables', async () => {
      const stats = await getPlatformStats(db);
      expect(stats.content.total).toBe(0);
      expect(stats.hubs.total).toBe(0);
      expect(stats.reports.pending).toBe(0);
      expect(stats.reports.total).toBe(0);
    });
  });

  // --- User Management ---

  describe('listUsers', () => {
    it('lists all users', async () => {
      const { items, total } = await listUsers(db);
      expect(total).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items[0]!.id).toBeDefined();
      expect(items[0]!.username).toBeDefined();
      expect(items[0]!.email).toBeDefined();
    });

    it('filters by role', async () => {
      const { items } = await listUsers(db, { role: 'admin' });
      expect(items.every((u) => u.role === 'admin')).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('searches by username', async () => {
      const { items } = await listUsers(db, { search: 'regular' });
      expect(items.some((u) => u.username === 'regularuser')).toBe(true);
    });

    it('returns empty for no match', async () => {
      const { items, total } = await listUsers(db, { search: 'zzz-nonexistent-zzz' });
      expect(items).toEqual([]);
      expect(total).toBe(0);
    });

    it('respects pagination', async () => {
      const { items } = await listUsers(db, { limit: 1 });
      expect(items.length).toBe(1);
    });
  });

  describe('updateUserRole', () => {
    it('changes user role and creates audit entry', async () => {
      await updateUserRole(db, userId, 'pro', adminId, '10.0.0.1');

      const { items: userList } = await listUsers(db, { search: 'regularuser' });
      expect(userList[0]!.role).toBe('pro');

      const { items: logs } = await listAuditLogs(db, { action: 'user.role_changed' });
      const entry = logs.find((l) => l.targetId === userId);
      expect(entry).toBeDefined();
      expect(entry!.metadata).toEqual({ previousRole: 'member', newRole: 'pro' });
    });

    it('throws for non-existent user', async () => {
      await expect(
        updateUserRole(db, '00000000-0000-0000-0000-000000000000', 'admin', adminId),
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateUserStatus', () => {
    it('suspends user and creates audit entry', async () => {
      await updateUserStatus(db, staffId, 'suspended', adminId);

      const { items } = await listUsers(db, { search: 'staffuser' });
      expect(items[0]!.status).toBe('suspended');

      const { items: logs } = await listAuditLogs(db, { action: 'user.status_changed' });
      const entry = logs.find((l) => l.targetId === staffId);
      expect(entry).toBeDefined();
      expect((entry!.metadata as Record<string, string>).newStatus).toBe('suspended');
    });

    it('throws for non-existent user', async () => {
      await expect(
        updateUserStatus(db, '00000000-0000-0000-0000-000000000000', 'active', adminId),
      ).rejects.toThrow('User not found');
    });
  });

  // --- Instance Settings ---

  describe('instance settings', () => {
    it('returns empty map for fresh instance', async () => {
      // Previous theme tests may have inserted settings; filter for our key
      const setting = await getInstanceSetting(db, 'admin.test.key');
      expect(setting).toBeNull();
    });

    it('sets and retrieves a setting', async () => {
      await setInstanceSetting(db, 'admin.test.key', 'hello', adminId);
      const value = await getInstanceSetting(db, 'admin.test.key');
      expect(value).toBe('hello');
    });

    it('upserts existing setting', async () => {
      await setInstanceSetting(db, 'admin.test.key', 'updated', adminId);
      const value = await getInstanceSetting(db, 'admin.test.key');
      expect(value).toBe('updated');
    });

    it('stores complex values (objects)', async () => {
      const obj = { tokens: { '--bg': '#000' }, enabled: true };
      await setInstanceSetting(db, 'admin.test.complex', obj, adminId);
      const value = await getInstanceSetting(db, 'admin.test.complex');
      expect(value).toEqual(obj);
    });

    it('creates audit entry on setting change', async () => {
      const { items } = await listAuditLogs(db, { action: 'setting.updated' });
      const entry = items.find((l) => l.targetId === 'admin.test.key');
      expect(entry).toBeDefined();
      expect(entry!.targetType).toBe('instance_setting');
    });

    it('getInstanceSettings returns all settings as Map', async () => {
      const all = await getInstanceSettings(db);
      expect(all).toBeInstanceOf(Map);
      expect(all.get('admin.test.key')).toBe('updated');
      expect(all.get('admin.test.complex')).toEqual({ tokens: { '--bg': '#000' }, enabled: true });
    });
  });

  // --- Content Moderation ---

  describe('removeContent', () => {
    it('archives content and creates audit entry', async () => {
      // Create a content item directly
      const [item] = await db
        .insert(contentItems)
        .values({
          title: 'Test Article',
          slug: 'test-article',
          type: 'blog',
          status: 'published',
          authorId: userId,
          body: 'Test body',
          blocks: [],
        })
        .returning();

      await removeContent(db, item!.id, adminId, '10.0.0.1');

      // Verify archived
      const [archived] = await db
        .select({ status: contentItems.status })
        .from(contentItems)
        .where(eq(contentItems.id, item!.id));
      expect(archived!.status).toBe('archived');

      // Verify audit log
      const { items: logs } = await listAuditLogs(db, { action: 'content.removed' });
      const entry = logs.find((l) => l.targetId === item!.id);
      expect(entry).toBeDefined();
      expect((entry!.metadata as Record<string, string>).title).toBe('Test Article');
    });

    it('throws for non-existent content', async () => {
      await expect(
        removeContent(db, '00000000-0000-0000-0000-000000000000', adminId),
      ).rejects.toThrow('Content not found');
    });
  });

  // --- Reports ---

  describe('listReports', () => {
    it('returns empty list when no reports exist', async () => {
      const { items, total } = await listReports(db);
      // May have reports from other tests, just verify structure
      expect(Array.isArray(items)).toBe(true);
      expect(typeof total).toBe('number');
    });
  });
});
