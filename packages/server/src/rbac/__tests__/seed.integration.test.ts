import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { roles, rolePermissions, userRoles } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import { hasPermissionPure } from '@commonpub/auth';
import { createTestDB, closeTestDB, createTestUser } from '../../__tests__/helpers/testdb.js';
import { resolveUserPermissions } from '../resolver.js';
import { seedRbac, STAFF_PERMISSION_SET } from '../seed.js';
import type { DB } from '../../types.js';

describe('seedRbac (PGlite)', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('seeds the five system roles + permission sets and backfills user_roles', async () => {
    const adminU = await createTestUser(db, { role: 'admin' });
    const staffU = await createTestUser(db, { role: 'staff' });
    const memberU = await createTestUser(db, { role: 'member' });

    await seedRbac(db);

    // All five system roles exist and are flagged isSystem.
    const roleRows = await db.select().from(roles);
    const keys = roleRows.map((r) => r.key).sort();
    expect(keys).toEqual(['admin', 'member', 'pro', 'staff', 'verified']);
    expect(roleRows.every((r) => r.isSystem)).toBe(true);

    // admin → ['*']; staff → the moderator set; member → none.
    const permsFor = async (key: string): Promise<string[]> => {
      const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
      const rows = await db.select({ k: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, r!.id));
      return rows.map((x) => x.k).sort();
    };
    expect(await permsFor('admin')).toEqual(['*']);
    expect(await permsFor('staff')).toEqual([...STAFF_PERMISSION_SET].sort());
    expect(await permsFor('member')).toEqual([]);

    // Backfill: every user got the user_roles row matching users.role.
    for (const u of [adminU, staffU, memberU]) {
      const rows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, u.id));
      expect(rows.length).toBe(1);
    }

    // Flag ON → staff now resolves the moderator set (the headline behavior).
    const staffResolved = await resolveUserPermissions(db, staffU.id, { rbacEnabled: true });
    expect(hasPermissionPure(staffResolved.permissions, 'content.moderate', staffResolved.primaryRole)).toBe(true);
    expect(hasPermissionPure(staffResolved.permissions, 'contest.manage', staffResolved.primaryRole)).toBe(true);
    // staff does NOT get admin.access (admin-only endpoints stay admin-only).
    expect(hasPermissionPure(staffResolved.permissions, 'admin.access', staffResolved.primaryRole)).toBe(false);
    expect(hasPermissionPure(staffResolved.permissions, 'settings.manage', staffResolved.primaryRole)).toBe(false);

    // member still resolves to nothing.
    const memberResolved = await resolveUserPermissions(db, memberU.id, { rbacEnabled: true });
    expect(memberResolved.permissions.size).toBe(0);
  });

  it('is idempotent — a second run adds no duplicate roles, grants, or user_roles', async () => {
    const beforePerms = await db.select().from(rolePermissions);
    const beforeUserRoles = await db.select().from(userRoles);
    const beforeRoles = await db.select().from(roles);
    await seedRbac(db);
    expect((await db.select().from(rolePermissions)).length).toBe(beforePerms.length);
    expect((await db.select().from(userRoles)).length).toBe(beforeUserRoles.length);
    expect((await db.select().from(roles)).length).toBe(beforeRoles.length);
  });

  it('the migration 0025 staff seed SQL stays in sync with STAFF_PERMISSION_SET', () => {
    // Drift guard: staff permissions are seeded twice — by seedRbac() (this file,
    // fresh-install/test path) AND by hand-written SQL in migration 0025 (the
    // deploy path). They MUST match or staff gets different powers on an existing
    // instance vs a fresh one. Parse the SQL's staff CROSS JOIN values list.
    const sqlPath = fileURLToPath(new URL('../../../../schema/migrations/0025_round_malice.sql', import.meta.url));
    const sql = readFileSync(sqlPath, 'utf8');
    // The staff grants are the only `CROSS JOIN (VALUES ...) AS p` block.
    const block = sql.match(/CROSS JOIN \(VALUES([\s\S]*?)\) AS p/);
    expect(block, 'staff CROSS JOIN block not found in migration 0025').toBeTruthy();
    const keysInSql = [...block![1].matchAll(/'([a-z][a-z.]+)'/g)].map((m) => m[1]).sort();
    expect(keysInSql).toEqual([...STAFF_PERMISSION_SET].sort());
  });
});
