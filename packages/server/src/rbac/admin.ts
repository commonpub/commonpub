import { eq, and, inArray, sql } from 'drizzle-orm';
import { roles, rolePermissions, userRoles, isPermissionGrant, filterKnownPermissions } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createAuditEntry } from '../admin/admin.js';
import { SYSTEM_ROLE_SEEDS } from './seed.js';

/** System role keys are reserved — custom roles may not reuse them (a custom
 *  role keyed 'admin' would otherwise slip the `*` wildcard past sanitizeGrants). */
const RESERVED_ROLE_KEYS: ReadonlySet<string> = new Set(SYSTEM_ROLE_SEEDS.map((s) => s.key));

/**
 * RBAC role administration (Phase 3). Operator-facing CRUD over the `roles`
 * data tables + per-user custom-role assignment. PERMISSIONS remain a code
 * constant; grants are validated against the catalog (`isPermissionGrant`).
 * The caller (Nitro route) invalidates the permission cache after each write.
 */

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  priority: number | null;
  permissions: string[];
  memberCount: number;
}

export async function listRolesWithPermissions(db: DB): Promise<RoleWithPermissions[]> {
  const roleRows = await db.select().from(roles);
  const permRows = await db.select().from(rolePermissions);
  const counts = await db
    .select({ roleId: userRoles.roleId, n: sql<number>`count(*)::int` })
    .from(userRoles)
    .groupBy(userRoles.roleId);

  const permByRole = new Map<string, string[]>();
  for (const p of permRows) {
    const list = permByRole.get(p.roleId) ?? [];
    list.push(p.permissionKey);
    permByRole.set(p.roleId, list);
  }
  const countByRole = new Map(counts.map((c) => [c.roleId, c.n]));

  return roleRows
    .map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      priority: r.priority,
      permissions: (permByRole.get(r.id) ?? []).sort(),
      memberCount: countByRole.get(r.id) ?? 0,
    }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name));
}

/**
 * Grants that confer the admin bypass. `hasPermissionPure` expands the
 * `admin.*` segment wildcard to cover `admin.access`, so stripping only the
 * literal `*` is NOT enough — `admin.*` (and `admin.access` itself) must also be
 * denied on non-admin roles, or a custom role granted `admin.*` silently becomes
 * admin-equivalent (and can then self-promote via users.manage). Only the `admin`
 * system role may hold these.
 */
const ADMIN_BYPASS_GRANTS: ReadonlySet<string> = new Set(['*', 'admin.access', 'admin.*']);

/**
 * Validate + filter a grant list. Only the `admin` system role keeps the admin
 * bypass; every other role gets those grants stripped. `createRole` rejects the
 * reserved key `admin`, so the only role reaching the `roleKey === 'admin'`
 * branch is the seeded system admin.
 */
function sanitizeGrants(grants: readonly string[], roleKey: string | null): string[] {
  const known = filterKnownPermissions(grants.filter((g) => isPermissionGrant(g)));
  const deduped = [...new Set(known)];
  if (roleKey === 'admin') return deduped;
  return deduped.filter((g) => !ADMIN_BYPASS_GRANTS.has(g));
}

export interface CreateRoleInput {
  key: string;
  name: string;
  description?: string | null;
  permissions?: readonly string[];
}

export async function createRole(
  db: DB,
  input: CreateRoleInput,
  actorId: string,
): Promise<{ id: string }> {
  const key = input.key.trim().toLowerCase();
  // Reserved system keys can never be (re)created as custom roles — this also
  // closes the `*`-via-key='admin' escalation in sanitizeGrants.
  if (RESERVED_ROLE_KEYS.has(key)) throw new Error('ROLE_KEY_RESERVED');
  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
  if (existing) throw new Error('ROLE_KEY_TAKEN');

  const [role] = await db
    .insert(roles)
    .values({ key, name: input.name.trim(), description: input.description ?? null, isSystem: false, priority: null })
    .returning({ id: roles.id });

  const grants = sanitizeGrants(input.permissions ?? [], key);
  if (grants.length) {
    await db.insert(rolePermissions).values(grants.map((permissionKey) => ({ roleId: role!.id, permissionKey })));
  }

  await createAuditEntry(db, {
    userId: actorId,
    action: 'role.created',
    targetType: 'role',
    targetId: role!.id,
    metadata: { key, permissions: grants },
  });
  return { id: role!.id };
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: readonly string[];
}

export async function updateRole(
  db: DB,
  roleId: string,
  input: UpdateRoleInput,
  actorId: string,
): Promise<void> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new Error('ROLE_NOT_FOUND');

  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name.trim();
  if (input.description !== undefined) set.description = input.description;
  if (Object.keys(set).length) await db.update(roles).set(set).where(eq(roles.id, roleId));

  if (input.permissions !== undefined) {
    let grants = sanitizeGrants(input.permissions, role.key);
    // The admin role must always retain its full bypass — never let an edit
    // strip `*` and accidentally lock the instance out of admin capabilities.
    if (role.key === 'admin' && !grants.includes('*')) grants = ['*', ...grants];
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (grants.length) {
      await db.insert(rolePermissions).values(grants.map((permissionKey) => ({ roleId, permissionKey })));
    }
  }

  await createAuditEntry(db, {
    userId: actorId,
    action: 'role.updated',
    targetType: 'role',
    targetId: roleId,
    metadata: { key: role.key, ...(input.permissions !== undefined ? { permissions: sanitizeGrants(input.permissions, role.key) } : {}) },
  });
}

export async function deleteRole(db: DB, roleId: string, actorId: string): Promise<void> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new Error('ROLE_NOT_FOUND');
  if (role.isSystem) throw new Error('ROLE_IS_SYSTEM');

  // user_roles + role_permissions cascade on the FK (ON DELETE cascade).
  await db.delete(roles).where(eq(roles.id, roleId));

  await createAuditEntry(db, {
    userId: actorId,
    action: 'role.deleted',
    targetType: 'role',
    targetId: roleId,
    metadata: { key: role.key },
  });
}

/**
 * Replace a user's CUSTOM (non-system) role assignments with `roleIds`. The
 * user's system role (from `users.role`) is managed by `updateUserRole` and is
 * never touched here — system roleIds in the input are ignored.
 */
export async function setUserCustomRoles(
  db: DB,
  userId: string,
  roleIds: string[],
  grantedBy: string,
): Promise<void> {
  // Resolve which of the requested roles are custom (non-system).
  const requested = roleIds.length
    ? await db.select({ id: roles.id }).from(roles).where(and(inArray(roles.id, roleIds), eq(roles.isSystem, false)))
    : [];
  const customIds = new Set(requested.map((r) => r.id));

  // Current custom memberships.
  const current = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.isSystem, false)));
  const currentIds = new Set(current.map((r) => r.roleId));

  const toAdd = [...customIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !customIds.has(id));

  if (toRemove.length) {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, toRemove)));
  }
  if (toAdd.length) {
    await db.insert(userRoles).values(toAdd.map((roleId) => ({ userId, roleId, grantedBy }))).onConflictDoNothing();
  }

  await createAuditEntry(db, {
    userId: grantedBy,
    action: 'user.roles_changed',
    targetType: 'user',
    targetId: userId,
    metadata: { customRoleIds: [...customIds] },
  });
}

/** The role IDs (custom + system) a user currently holds — for the admin UI. */
export async function getUserRoleIds(db: DB, userId: string): Promise<string[]> {
  const rows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.roleId);
}
