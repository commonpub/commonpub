import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { roles, rolePermissions, userRoles } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import { hasPermissionPure } from '@commonpub/auth';
import { createTestDB, closeTestDB, createTestUser } from '../../__tests__/helpers/testdb.js';
import { resolveUserPermissions } from '../resolver.js';
import { seedRbac, STAFF_PERMISSION_SET } from '../seed.js';
import {
  listRolesWithPermissions,
  createRole,
  updateRole,
  deleteRole,
  setUserCustomRoles,
  getUserRoleIds,
} from '../admin.js';
import type { DB } from '../../types.js';

describe('RBAC role administration (PGlite)', () => {
  let db: DB;
  let actorId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const actor = await createTestUser(db, { username: 'rbac-actor', role: 'admin' });
    actorId = actor.id;
    await seedRbac(db);
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  const permsOf = async (roleId: string): Promise<string[]> => {
    const rows = await db.select({ k: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.k).sort();
  };

  describe('createRole', () => {
    it('creates a custom role and persists its (catalog-valid) grants', async () => {
      const { id } = await createRole(db, { key: 'mod-1', name: 'Mod One', permissions: ['content.moderate', 'reports.review'] }, actorId);
      expect(await permsOf(id)).toEqual(['content.moderate', 'reports.review']);
    });

    it('STRIPS the `*` wildcard from a non-admin custom role (escalation guard)', async () => {
      const { id } = await createRole(db, { key: 'mod-2', name: 'Mod Two', permissions: ['*', 'content.moderate'] }, actorId);
      // `*` must NOT survive on a non-admin role — only content.moderate remains.
      expect(await permsOf(id)).toEqual(['content.moderate']);
    });

    it('STRIPS admin-bypass wildcards (admin.*, admin.access) — P0 escalation guard', async () => {
      // The dangerous case: admin.* / admin.access expand to the admin umbrella via
      // hasPermissionPure, so they must be stripped from a non-admin role exactly
      // like `*`. A user holding such a role must NOT resolve admin.access.
      const { id } = await createRole(
        db,
        { key: 'sneaky', name: 'Sneaky', permissions: ['admin.*', 'admin.access', 'content.read'] },
        actorId,
      );
      expect(await permsOf(id)).toEqual(['content.read']);

      const u = await createTestUser(db, { username: `sneaky-${Date.now()}`, role: 'member' });
      await db.insert(userRoles).values({ userId: u.id, roleId: id });
      const resolved = await resolveUserPermissions(db, u.id, { rbacEnabled: true });
      expect(hasPermissionPure(resolved.permissions, 'admin.access', resolved.primaryRole)).toBe(false);
      expect(hasPermissionPure(resolved.permissions, 'users.manage', resolved.primaryRole)).toBe(false);
      // The legitimate grant still resolves.
      expect(hasPermissionPure(resolved.permissions, 'content.read', resolved.primaryRole)).toBe(true);
    });

    it('rejects a reserved system key (cannot mint a second `admin`/`staff`)', async () => {
      await expect(createRole(db, { key: 'admin', name: 'Fake', permissions: ['*'] }, actorId)).rejects.toThrow('ROLE_KEY_RESERVED');
      await expect(createRole(db, { key: 'staff', name: 'Fake', permissions: [] }, actorId)).rejects.toThrow('ROLE_KEY_RESERVED');
    });

    it('rejects a duplicate custom key', async () => {
      await createRole(db, { key: 'dup-key', name: 'A', permissions: [] }, actorId);
      await expect(createRole(db, { key: 'dup-key', name: 'B', permissions: [] }, actorId)).rejects.toThrow('ROLE_KEY_TAKEN');
    });
  });

  describe('updateRole', () => {
    it('replaces the permission set on a custom role', async () => {
      const { id } = await createRole(db, { key: 'upd-1', name: 'Upd', permissions: ['content.read'] }, actorId);
      await updateRole(db, id, { permissions: ['users.read', 'audit.read'] }, actorId);
      expect(await permsOf(id)).toEqual(['audit.read', 'users.read']);
    });

    it('lets an operator tune the staff (system) role permission set', async () => {
      const [staff] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'staff')).limit(1);
      await updateRole(db, staff!.id, { permissions: ['content.moderate'] }, actorId);
      expect(await permsOf(staff!.id)).toEqual(['content.moderate']);
      // Restore the seed set so this mutation of the SHARED staff role can't leak
      // into any later test's expectations (test-isolation hygiene).
      await updateRole(db, staff!.id, { permissions: [...STAFF_PERMISSION_SET] }, actorId);
    });

    it('FORCE-RETAINS `*` on the admin role even if an edit omits it (lockout guard)', async () => {
      const [admin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'admin')).limit(1);
      // Try to wipe admin's grants entirely — `*` must be re-added.
      await updateRole(db, admin!.id, { permissions: [] }, actorId);
      expect(await permsOf(admin!.id)).toContain('*');
    });

    it('strips `*` when added to a non-admin role via update', async () => {
      const { id } = await createRole(db, { key: 'upd-2', name: 'Upd2', permissions: [] }, actorId);
      await updateRole(db, id, { permissions: ['*'] }, actorId);
      expect(await permsOf(id)).toEqual([]);
    });
  });

  describe('deleteRole', () => {
    it('deletes a custom role and cascades its grants + assignments', async () => {
      const { id } = await createRole(db, { key: 'del-1', name: 'Del', permissions: ['content.read'] }, actorId);
      const u = await createTestUser(db, { username: `del-member-${Date.now()}`, role: 'member' });
      await db.insert(userRoles).values({ userId: u.id, roleId: id });

      await deleteRole(db, id, actorId);

      expect((await db.select().from(roles).where(eq(roles.id, id))).length).toBe(0);
      expect((await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, id))).length).toBe(0);
      expect((await db.select().from(userRoles).where(eq(userRoles.roleId, id))).length).toBe(0);
    });

    it('refuses to delete a system role', async () => {
      const [staff] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'staff')).limit(1);
      await expect(deleteRole(db, staff!.id, actorId)).rejects.toThrow('ROLE_IS_SYSTEM');
    });
  });

  describe('setUserCustomRoles', () => {
    it('adds + removes custom memberships, leaves the system role intact, ignores system roleIds', async () => {
      const u = await createTestUser(db, { username: `assign-${Date.now()}`, role: 'member' });
      await seedRbac(db); // idempotent — backfills the just-created user's member row
      const { id: roleA } = await createRole(db, { key: `a-${Date.now()}`, name: 'A', permissions: [] }, actorId);
      const { id: roleB } = await createRole(db, { key: `b-${Date.now()}`, name: 'B', permissions: [] }, actorId);
      const [memberSystem] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'member')).limit(1);

      // Backfill gave them the member system role.
      expect(await getUserRoleIds(db, u.id)).toContain(memberSystem!.id);

      // Assign A + B (plus a system roleId that must be ignored).
      await setUserCustomRoles(db, u.id, [roleA, roleB, memberSystem!.id], actorId);
      let ids = await getUserRoleIds(db, u.id);
      expect(ids).toContain(roleA);
      expect(ids).toContain(roleB);
      expect(ids).toContain(memberSystem!.id); // system membership untouched

      // Now set just A: B is removed, member stays.
      await setUserCustomRoles(db, u.id, [roleA], actorId);
      ids = await getUserRoleIds(db, u.id);
      expect(ids).toContain(roleA);
      expect(ids).not.toContain(roleB);
      expect(ids).toContain(memberSystem!.id);

      // Empty set: all custom removed, member still intact.
      await setUserCustomRoles(db, u.id, [], actorId);
      ids = await getUserRoleIds(db, u.id);
      expect(ids).not.toContain(roleA);
      expect(ids).toContain(memberSystem!.id);
    });
  });

  describe('listRolesWithPermissions', () => {
    it('reports member counts and sorts system roles by priority', async () => {
      const list = await listRolesWithPermissions(db);
      const admin = list.find((r) => r.key === 'admin');
      expect(admin?.permissions).toContain('*');
      expect(admin?.isSystem).toBe(true);
      // memberCount must be a real count, not hardcoded: the `actor` admin was
      // backfilled into the admin role, so admin has >= 1 member. (Kills the
      // "return memberCount: 0" mutation.)
      expect(admin?.memberCount).toBeGreaterThanOrEqual(1);
      // Highest-priority system role (admin=50) sorts before member (10).
      const sysOrder = list.filter((r) => r.isSystem).map((r) => r.key);
      expect(sysOrder.indexOf('admin')).toBeLessThan(sysOrder.indexOf('member'));
    });
  });
});
