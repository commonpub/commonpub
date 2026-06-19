import { z } from 'zod';
import { permissionKeySchema } from '../permissions.js';

// --- Admin validators ---

export const adminSettingSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.unknown(),
});
export type AdminSettingInput = z.infer<typeof adminSettingSchema>;

export const adminUpdateRoleSchema = z.object({
  role: z.enum(['member', 'pro', 'verified', 'staff', 'admin']),
});
export type AdminUpdateRoleInput = z.infer<typeof adminUpdateRoleSchema>;

// --- RBAC role administration (Phase 3) ---
// `permissionKeySchema` (catalog-gated) lives in permissions.ts.
const roleKeySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, 'Lowercase letters, digits and hyphens; must start with a letter');

export const createRoleSchema = z.object({
  key: roleKeySchema,
  name: z.string().min(1).max(128),
  description: z.string().max(2000).nullish(),
  permissions: z.array(permissionKeySchema).max(50).optional(),
});
export type CreateRoleSchemaInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).nullish(),
  permissions: z.array(permissionKeySchema).max(50).optional(),
});
export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

export const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(50),
});
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;

export const adminUpdateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deleted']),
});
export type AdminUpdateStatusInput = z.infer<typeof adminUpdateStatusSchema>;

export const resolveReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
  resolution: z.string().min(1).max(2000),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
