import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { roles, rolePermissions, userRoles } from '@commonpub/schema';
import { hasPermissionPure } from '@commonpub/auth';
import { createTestDB, closeTestDB, createTestUser } from '../../__tests__/helpers/testdb.js';
import { resolveUserPermissions } from '../resolver.js';
import type { DB } from '../../types.js';

describe('resolveUserPermissions (PGlite)', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('admin → ALL via `*`, regardless of flag, without touching RBAC tables', async () => {
    const admin = await createTestUser(db, { role: 'admin' });

    const off = await resolveUserPermissions(db, admin.id, { rbacEnabled: false });
    const on = await resolveUserPermissions(db, admin.id, { rbacEnabled: true });

    for (const r of [off, on]) {
      expect(r.primaryRole).toBe('admin');
      expect(r.permissions.has('*')).toBe(true);
      expect(hasPermissionPure(r.permissions, 'admin.access', r.primaryRole)).toBe(true);
      expect(hasPermissionPure(r.permissions, 'federation.manage', r.primaryRole)).toBe(true);
    }
  });

  it('flag OFF → non-admins resolve to an empty set (INV-1: legacy = admin-only)', async () => {
    const staff = await createTestUser(db, { role: 'staff' });
    const member = await createTestUser(db, { role: 'member' });

    for (const u of [staff, member]) {
      const r = await resolveUserPermissions(db, u.id, { rbacEnabled: false });
      expect(r.permissions.size).toBe(0);
      expect(hasPermissionPure(r.permissions, 'admin.access', r.primaryRole)).toBe(false);
      expect(hasPermissionPure(r.permissions, 'content.moderate', r.primaryRole)).toBe(false);
    }
  });

  it('flag ON → unions grants across the user_roles the user holds', async () => {
    const user = await createTestUser(db, { role: 'staff' });

    const [modRole] = await db
      .insert(roles)
      .values({ key: 'moderator-test', name: 'Moderator', isSystem: false, priority: 35 })
      .returning();
    await db.insert(rolePermissions).values([
      { roleId: modRole!.id, permissionKey: 'content.moderate' },
      { roleId: modRole!.id, permissionKey: 'reports.review' },
    ]);
    await db.insert(userRoles).values({ userId: user.id, roleId: modRole!.id });

    const r = await resolveUserPermissions(db, user.id, { rbacEnabled: true });

    expect(r.roleKeys).toContain('moderator-test');
    expect(r.permissions.has('content.moderate')).toBe(true);
    expect(r.permissions.has('reports.review')).toBe(true);
    expect(hasPermissionPure(r.permissions, 'content.moderate', r.primaryRole)).toBe(true);
    // Not granted → denied; and no admin floor for staff.
    expect(hasPermissionPure(r.permissions, 'admin.access', r.primaryRole)).toBe(false);
    expect(hasPermissionPure(r.permissions, 'settings.manage', r.primaryRole)).toBe(false);
  });

  it('flag ON → segment-wildcard grant resolves through hasPermissionPure', async () => {
    const user = await createTestUser(db, { role: 'pro' });
    const [role] = await db
      .insert(roles)
      .values({ key: 'content-czar', name: 'Content Czar', isSystem: false })
      .returning();
    await db.insert(rolePermissions).values({ roleId: role!.id, permissionKey: 'content.*' });
    await db.insert(userRoles).values({ userId: user.id, roleId: role!.id });

    const r = await resolveUserPermissions(db, user.id, { rbacEnabled: true });
    expect(r.permissions.has('content.*')).toBe(true);
    expect(hasPermissionPure(r.permissions, 'content.editorial', r.primaryRole)).toBe(true);
    expect(hasPermissionPure(r.permissions, 'content.read', r.primaryRole)).toBe(true);
    expect(hasPermissionPure(r.permissions, 'users.manage', r.primaryRole)).toBe(false);
  });

  it('flag ON but no user_roles rows → empty grants, primaryRole preserved (default-deny)', async () => {
    const user = await createTestUser(db, { role: 'verified' });
    const r = await resolveUserPermissions(db, user.id, { rbacEnabled: true });
    expect(r.permissions.size).toBe(0);
    expect(r.roleKeys).toEqual(['verified']);
    expect(hasPermissionPure(r.permissions, 'content.read', r.primaryRole)).toBe(false);
  });

  it('unknown user → empty set (INV-3 default-deny)', async () => {
    const r = await resolveUserPermissions(db, crypto.randomUUID(), { rbacEnabled: true });
    expect(r.primaryRole).toBe('');
    expect(r.permissions.size).toBe(0);
    expect(hasPermissionPure(r.permissions, 'content.read', r.primaryRole)).toBe(false);
  });
});
