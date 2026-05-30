import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth.js';

/**
 * Global RBAC tables (migration 0009, ADDITIVE only).
 *
 * ROLES are data (operator-authorable); PERMISSIONS are a code constant
 * (see permissions.ts). `users.role` (userRoleEnum) is KEPT as the
 * denormalized primary/display role read by enrichUser/roleGuard — these M2M
 * tables are the source of truth for *permissions*, never written back to
 * `users.role`. No `ALTER` on `users` (safe for heatsync `db:push --force` +
 * the drizzle populated-table DDL hazard).
 */

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    /** System roles (member/pro/verified/staff/admin) are seeded + undeletable. */
    isSystem: boolean('is_system').default(false).notNull(),
    /** Mirrors the roleGuard hierarchy (10/20/30/40/50) so it can later read priority. */
    priority: integer('priority'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  // No explicit index on `key` — the UNIQUE constraint already indexes it.
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    /** Validated against the PERMISSIONS catalog on write (permissionKeySchema). */
    permissionKey: varchar('permission_key', { length: 64 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionKey] }),
    index('idx_role_permissions_role_id').on(t.roleId),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    /** Who granted this role; nulled (not cascaded) if the granter is deleted. */
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index('idx_user_roles_user_id').on(t.userId),
    index('idx_user_roles_role_id').on(t.roleId),
  ],
);

// --- Relations ---

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  grantedByUser: one(users, { fields: [userRoles.grantedBy], references: [users.id] }),
}));

// --- Inferred Types ---
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermissionRow = typeof rolePermissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type NewUserRoleRow = typeof userRoles.$inferInsert;
