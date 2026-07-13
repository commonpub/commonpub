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
  type ActorGrants,
} from '../admin.js';
import type { DB } from '../../types.js';

/** The seeded `actor` is a platform admin — clears the RBAC-5 grant ceiling on
 *  everything (admin floor), so existing tests exercise the unrestricted path. */
const adminActor: ActorGrants = { permissions: new Set(['*']), primaryRole: 'admin' };

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
      const { id } = await createRole(db, { key: 'mod-1', name: 'Mod One', permissions: ['content.moderate', 'reports.review'] }, actorId, adminActor);
      expect(await permsOf(id)).toEqual(['content.moderate', 'reports.review']);
    });

    it('STRIPS the `*` wildcard from a non-admin custom role (escalation guard)', async () => {
      const { id } = await createRole(db, { key: 'mod-2', name: 'Mod Two', permissions: ['*', 'content.moderate'] }, actorId, adminActor);
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
        adminActor,
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
      await expect(createRole(db, { key: 'admin', name: 'Fake', permissions: ['*'] }, actorId, adminActor)).rejects.toThrow('ROLE_KEY_RESERVED');
      await expect(createRole(db, { key: 'staff', name: 'Fake', permissions: [] }, actorId, adminActor)).rejects.toThrow('ROLE_KEY_RESERVED');
    });

    it('rejects a duplicate custom key', async () => {
      await createRole(db, { key: 'dup-key', name: 'A', permissions: [] }, actorId, adminActor);
      await expect(createRole(db, { key: 'dup-key', name: 'B', permissions: [] }, actorId, adminActor)).rejects.toThrow('ROLE_KEY_TAKEN');
    });
  });

  describe('updateRole', () => {
    it('replaces the permission set on a custom role', async () => {
      const { id } = await createRole(db, { key: 'upd-1', name: 'Upd', permissions: ['content.read'] }, actorId, adminActor);
      await updateRole(db, id, { permissions: ['users.read', 'audit.read'] }, actorId, adminActor);
      expect(await permsOf(id)).toEqual(['audit.read', 'users.read']);
    });

    it('lets an operator tune the staff (system) role permission set', async () => {
      const [staff] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'staff')).limit(1);
      await updateRole(db, staff!.id, { permissions: ['content.moderate'] }, actorId, adminActor);
      expect(await permsOf(staff!.id)).toEqual(['content.moderate']);
      // Restore the seed set so this mutation of the SHARED staff role can't leak
      // into any later test's expectations (test-isolation hygiene).
      await updateRole(db, staff!.id, { permissions: [...STAFF_PERMISSION_SET] }, actorId, adminActor);
    });

    it('FORCE-RETAINS `*` on the admin role even if an edit omits it (lockout guard)', async () => {
      const [admin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'admin')).limit(1);
      // Try to wipe admin's grants entirely — `*` must be re-added.
      await updateRole(db, admin!.id, { permissions: [] }, actorId, adminActor);
      expect(await permsOf(admin!.id)).toContain('*');
    });

    it('strips `*` when added to a non-admin role via update', async () => {
      const { id } = await createRole(db, { key: 'upd-2', name: 'Upd2', permissions: [] }, actorId, adminActor);
      await updateRole(db, id, { permissions: ['*'] }, actorId, adminActor);
      expect(await permsOf(id)).toEqual([]);
    });
  });

  describe('deleteRole', () => {
    it('deletes a custom role and cascades its grants + assignments', async () => {
      const { id } = await createRole(db, { key: 'del-1', name: 'Del', permissions: ['content.read'] }, actorId, adminActor);
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
      const { id: roleA } = await createRole(db, { key: `a-${Date.now()}`, name: 'A', permissions: [] }, actorId, adminActor);
      const { id: roleB } = await createRole(db, { key: `b-${Date.now()}`, name: 'B', permissions: [] }, actorId, adminActor);
      const [memberSystem] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'member')).limit(1);

      // Backfill gave them the member system role.
      expect(await getUserRoleIds(db, u.id)).toContain(memberSystem!.id);

      // Assign A + B (plus a system roleId that must be ignored).
      await setUserCustomRoles(db, u.id, [roleA, roleB, memberSystem!.id], actorId, adminActor);
      let ids = await getUserRoleIds(db, u.id);
      expect(ids).toContain(roleA);
      expect(ids).toContain(roleB);
      expect(ids).toContain(memberSystem!.id); // system membership untouched

      // Now set just A: B is removed, member stays.
      await setUserCustomRoles(db, u.id, [roleA], actorId, adminActor);
      ids = await getUserRoleIds(db, u.id);
      expect(ids).toContain(roleA);
      expect(ids).not.toContain(roleB);
      expect(ids).toContain(memberSystem!.id);

      // Empty set: all custom removed, member still intact.
      await setUserCustomRoles(db, u.id, [], actorId, adminActor);
      ids = await getUserRoleIds(db, u.id);
      expect(ids).not.toContain(roleA);
      expect(ids).toContain(memberSystem!.id);
    });
  });

  describe('RBAC-5 privilege ceiling', () => {
    // A non-admin `roles.manage` holder — the self-escalation actor. Holds only
    // roles.manage + content.moderate; must not be able to confer anything above.
    const delegateActor: ActorGrants = {
      permissions: new Set(['roles.manage', 'content.moderate']),
      primaryRole: 'staff',
    };

    it('createRole: a non-admin CANNOT mint a role granting a permission above their own set', async () => {
      await expect(
        createRole(db, { key: `esc-${Date.now()}`, name: 'Esc', permissions: ['users.manage'] }, actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
      await expect(
        createRole(db, { key: `esc2-${Date.now()}`, name: 'Esc2', permissions: ['settings.manage'] }, actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
    });

    it('createRole: a non-admin CAN mint a role bounded to grants they themselves hold (legit delegation)', async () => {
      const { id } = await createRole(
        db,
        { key: `deleg-${Date.now()}`, name: 'Deleg', permissions: ['content.moderate'] },
        actorId,
        delegateActor,
      );
      expect(await permsOf(id)).toEqual(['content.moderate']);
    });

    it('createRole: an ADMIN actor CAN mint a role with any grant (floor clears the ceiling)', async () => {
      const { id } = await createRole(
        db,
        { key: `admgrant-${Date.now()}`, name: 'AdmGrant', permissions: ['users.manage', 'federation.manage', 'contest.pii'] },
        actorId,
        adminActor,
      );
      expect(await permsOf(id)).toEqual(['contest.pii', 'federation.manage', 'users.manage']);
    });

    it('createRole: contest.* actor CANNOT grant the protected leaf contest.pii, but CAN grant contest.manage (RBAC-5 ∘ RBAC-6)', async () => {
      const contestStarActor: ActorGrants = { permissions: new Set(['roles.manage', 'contest.*']), primaryRole: 'staff' };
      await expect(
        createRole(db, { key: `cpii-${Date.now()}`, name: 'CPii', permissions: ['contest.pii'] }, actorId, contestStarActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
      const { id } = await createRole(
        db,
        { key: `cmanage-${Date.now()}`, name: 'CManage', permissions: ['contest.manage'] },
        actorId,
        contestStarActor,
      );
      expect(await permsOf(id)).toEqual(['contest.manage']);
    });

    it('updateRole: a non-admin CANNOT raise a role above their own set', async () => {
      const { id } = await createRole(db, { key: `upd-esc-${Date.now()}`, name: 'UpdEsc', permissions: ['content.moderate'] }, actorId, delegateActor);
      await expect(
        updateRole(db, id, { permissions: ['content.moderate', 'users.manage'] }, actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
      // The rejected edit left the role's grants untouched.
      expect(await permsOf(id)).toEqual(['content.moderate']);
    });

    it('updateRole: a non-admin CANNOT edit the admin role (forced `*` exceeds their ceiling)', async () => {
      const [admin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'admin')).limit(1);
      await expect(
        updateRole(db, admin!.id, { permissions: [] }, actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
      expect(await permsOf(admin!.id)).toContain('*');
    });

    it('updateRole: a non-admin CANNOT metadata-only edit (rename) a role whose grants exceed theirs', async () => {
      // A `{ name }`-only PUT skips the permissions branch; the ceiling must still
      // block touching a role (the admin role, `*`) above the actor's own grants.
      const [admin] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, 'admin')).limit(1);
      await expect(
        updateRole(db, admin!.id, { name: 'Renamed Admin' }, actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
    });

    it('setUserCustomRoles: a non-admin CANNOT assign a pre-existing role granting a permission they lack', async () => {
      // Admin mints a high-privilege role; the delegate must not be able to assign it.
      const { id: highRole } = await createRole(db, { key: `high-${Date.now()}`, name: 'High', permissions: ['users.manage'] }, actorId, adminActor);
      const target = await createTestUser(db, { username: `ceil-target-${Date.now()}`, role: 'member' });
      await expect(
        setUserCustomRoles(db, target.id, [highRole], actorId, delegateActor),
      ).rejects.toThrow('GRANT_EXCEEDS_CEILING');
      // Nothing was assigned.
      expect(await getUserRoleIds(db, target.id)).not.toContain(highRole);
    });

    it('setUserCustomRoles: a non-admin CAN assign a role whose grants they themselves hold', async () => {
      const { id: okRole } = await createRole(db, { key: `okrole-${Date.now()}`, name: 'Ok', permissions: ['content.moderate'] }, actorId, adminActor);
      const target = await createTestUser(db, { username: `ceil-ok-${Date.now()}`, role: 'member' });
      await setUserCustomRoles(db, target.id, [okRole], actorId, delegateActor);
      expect(await getUserRoleIds(db, target.id)).toContain(okRole);
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
