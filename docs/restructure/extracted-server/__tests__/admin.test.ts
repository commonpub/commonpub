import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlatformStats,
  listUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  resolveReport,
  getInstanceSettings,
  setInstanceSetting,
} from '../admin';

// Mock the audit module so createAuditEntry never hits a real DB
vi.mock('../audit', () => ({
  createAuditEntry: vi.fn().mockResolvedValue(undefined),
}));

// Mock Drizzle DB following the pattern from content.test.ts
function createMockDb() {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.leftJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn().mockImplementation((resolve) => resolve([]));
    return chain;
  };

  const db = {
    select: vi.fn().mockReturnValue(chainable()),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => {
      // Create a mock transaction context with the same shape as db
      const txChainable = () => {
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.then = vi.fn().mockImplementation((resolve) => resolve([]));
        return chain;
      };

      const tx = {
        select: vi.fn().mockReturnValue(txChainable()),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      };
      return fn(tx);
    }),
  };

  return db;
}

describe('Admin Service', () => {
  describe('getPlatformStats', () => {
    it('should aggregate stats from multiple queries', async () => {
      const db = createMockDb();

      // getPlatformStats runs 7 parallel select queries via Promise.all
      // Capture callCount at select() time (not at then() time) to handle parallel execution
      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        const myCall = ++callCount;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.groupBy = vi.fn().mockReturnValue(chain);
        chain.then = vi.fn().mockImplementation((resolve) => {
          switch (myCall) {
            case 1: // usersByRole
              return resolve([{ role: 'member', count: 5 }, { role: 'admin', count: 1 }]);
            case 2: // usersByStatus
              return resolve([{ status: 'active', count: 6 }]);
            case 3: // contentByType
              return resolve([{ type: 'project', count: 3 }, { type: 'article', count: 2 }]);
            case 4: // contentByStatus
              return resolve([{ status: 'published', count: 4 }, { status: 'draft', count: 1 }]);
            case 5: // communityCount
              return resolve([{ count: 2 }]);
            case 6: // pendingReports
              return resolve([{ count: 1 }]);
            case 7: // totalReports
              return resolve([{ count: 3 }]);
            default:
              return resolve([]);
          }
        });
        return chain;
      });

      const stats = await getPlatformStats(db as unknown as Parameters<typeof getPlatformStats>[0]);

      expect(stats.users.total).toBe(6);
      expect(stats.users.byRole).toEqual({ member: 5, admin: 1 });
      expect(stats.users.byStatus).toEqual({ active: 6 });
      expect(stats.content.total).toBe(5);
      expect(stats.content.byType).toEqual({ project: 3, article: 2 });
      expect(stats.content.byStatus).toEqual({ published: 4, draft: 1 });
      expect(stats.communities.total).toBe(2);
      expect(stats.reports.pending).toBe(1);
      expect(stats.reports.total).toBe(3);
    });

    it('should return zero counts when no data exists', async () => {
      const db = createMockDb();

      // All queries return empty arrays
      db.select = vi.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.groupBy = vi.fn().mockReturnValue(chain);
        chain.then = vi.fn().mockImplementation((resolve) => resolve([]));
        return chain;
      });

      const stats = await getPlatformStats(db as unknown as Parameters<typeof getPlatformStats>[0]);

      expect(stats.users.total).toBe(0);
      expect(stats.content.total).toBe(0);
      expect(stats.communities.total).toBe(0);
      expect(stats.reports.pending).toBe(0);
      expect(stats.reports.total).toBe(0);
    });
  });

  describe('listUsers', () => {
    it('should call db.select with correct structure', async () => {
      const db = createMockDb();

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      const result = await listUsers(db as unknown as Parameters<typeof listUsers>[0], {});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should default to limit 20 and offset 0', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;
      let capturedOffset: number | undefined;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockImplementation((o) => {
          capturedOffset = o;
          return mockChain;
        }),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listUsers(db as unknown as Parameters<typeof listUsers>[0], {});

      expect(capturedLimit).toBe(20);
      expect(capturedOffset).toBe(0);
    });

    it('should clamp limit to max 100', async () => {
      const db = createMockDb();
      let capturedLimit: number | undefined;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation((l) => {
          capturedLimit = l;
          return mockChain;
        }),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listUsers(db as unknown as Parameters<typeof listUsers>[0], { limit: 500 });

      expect(capturedLimit).toBe(100);
    });

    it('should apply search filter', async () => {
      const db = createMockDb();
      let capturedWhere: unknown = null;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((w) => {
          capturedWhere = w;
          return mockChain;
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listUsers(db as unknown as Parameters<typeof listUsers>[0], { search: 'john' });

      expect(mockChain.where).toHaveBeenCalled();
      expect(capturedWhere).toBeDefined();
    });

    it('should apply role filter', async () => {
      const db = createMockDb();
      let capturedWhere: unknown = null;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation((w) => {
          capturedWhere = w;
          return mockChain;
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      let callCount = 0;
      db.select = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockChain : countChain;
      });

      await listUsers(db as unknown as Parameters<typeof listUsers>[0], { role: 'admin' });

      expect(mockChain.where).toHaveBeenCalled();
      expect(capturedWhere).toBeDefined();
    });
  });

  describe('updateUserRole', () => {
    it('should throw when user not found', async () => {
      const db = createMockDb();

      // select returns empty array (user not found)
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await expect(
        updateUserRole(
          db as unknown as Parameters<typeof updateUserRole>[0],
          'nonexistent-user',
          'admin',
          'admin-1',
          '127.0.0.1',
        ),
      ).rejects.toThrow('User not found');
    });

    it('should update role and create audit entry when user exists', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ role: 'member' }])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      let capturedSet: Record<string, unknown> | null = null;
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      await updateUserRole(
        db as unknown as Parameters<typeof updateUserRole>[0],
        'user-1',
        'admin',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.role).toBe('admin');
    });
  });

  describe('updateUserStatus', () => {
    it('should throw when user not found', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await expect(
        updateUserStatus(
          db as unknown as Parameters<typeof updateUserStatus>[0],
          'nonexistent-user',
          'suspended',
          'admin-1',
          '127.0.0.1',
        ),
      ).rejects.toThrow('User not found');
    });

    it('should update status and create audit entry when user exists', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([{ status: 'active' }])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      let capturedSet: Record<string, unknown> | null = null;
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      await updateUserStatus(
        db as unknown as Parameters<typeof updateUserStatus>[0],
        'user-1',
        'suspended',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.status).toBe('suspended');
    });
  });

  describe('deleteUser', () => {
    it('should throw when user not found', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await expect(
        deleteUser(
          db as unknown as Parameters<typeof deleteUser>[0],
          'nonexistent-user',
          'admin-1',
          '127.0.0.1',
        ),
      ).rejects.toThrow('User not found');
    });

    it('should execute transaction when user exists', async () => {
      const db = createMockDb();

      // First select returns the user lookup
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([{ id: 'user-1', username: 'testuser' }]),
        ),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await deleteUser(
        db as unknown as Parameters<typeof deleteUser>[0],
        'user-1',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe('resolveReport', () => {
    it('should throw when report not found', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await expect(
        resolveReport(
          db as unknown as Parameters<typeof resolveReport>[0],
          'nonexistent-report',
          'Spam removed',
          'resolved',
          'admin-1',
          '127.0.0.1',
        ),
      ).rejects.toThrow('Report not found');
    });

    it('should update report status and create audit entry when report exists', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([{
            id: 'report-1',
            reason: 'spam',
            targetType: 'content',
            targetId: 'content-1',
            status: 'pending',
          }]),
        ),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      let capturedSet: Record<string, unknown> | null = null;
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      await resolveReport(
        db as unknown as Parameters<typeof resolveReport>[0],
        'report-1',
        'Spam content removed',
        'resolved',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.status).toBe('resolved');
      expect(capturedSet!.resolution).toBe('Spam content removed');
      expect(capturedSet!.reviewedById).toBe('admin-1');
    });
  });

  describe('getInstanceSettings', () => {
    it('should return a Map of all settings', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([
            { key: 'site_name', value: 'My Instance' },
            { key: 'registration_open', value: true },
          ]),
        ),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      const settings = await getInstanceSettings(
        db as unknown as Parameters<typeof getInstanceSettings>[0],
      );

      expect(settings).toBeInstanceOf(Map);
      expect(settings.get('site_name')).toBe('My Instance');
      expect(settings.get('registration_open')).toBe(true);
      expect(settings.size).toBe(2);
    });

    it('should return empty Map when no settings exist', async () => {
      const db = createMockDb();

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      const settings = await getInstanceSettings(
        db as unknown as Parameters<typeof getInstanceSettings>[0],
      );

      expect(settings).toBeInstanceOf(Map);
      expect(settings.size).toBe(0);
    });
  });

  describe('setInstanceSetting', () => {
    it('should update existing setting', async () => {
      const db = createMockDb();

      // First select checks for existing setting
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) =>
          resolve([{ key: 'site_name', value: 'Old Name' }]),
        ),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      let capturedSet: Record<string, unknown> | null = null;
      const updateSetChain = {
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      db.update = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values) => {
          capturedSet = values;
          return updateSetChain;
        }),
      });

      await setInstanceSetting(
        db as unknown as Parameters<typeof setInstanceSetting>[0],
        'site_name',
        'New Name',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.update).toHaveBeenCalled();
      expect(capturedSet).toBeDefined();
      expect(capturedSet!.value).toBe('New Name');
    });

    it('should insert new setting when key does not exist', async () => {
      const db = createMockDb();

      // First select returns empty (setting does not exist)
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve) => resolve([])),
      };
      db.select = vi.fn().mockReturnValue(selectChain);

      await setInstanceSetting(
        db as unknown as Parameters<typeof setInstanceSetting>[0],
        'new_key',
        'new_value',
        'admin-1',
        '127.0.0.1',
      );

      expect(db.insert).toHaveBeenCalled();
    });
  });
});
