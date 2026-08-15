import { z } from 'zod';
import { permissionKeySchema } from '../permissions.js';

// --- Admin validators ---

/**
 * Instance-setting namespaces the generic `PUT /api/admin/settings` route may
 * NOT write (audit B4).
 *
 * Both namespaces have a dedicated route that validates their document before
 * storing it: `persona.*` through `personaSectionsSchema`, `dataSharing.*`
 * through `dataRecipientSchema` and `dataSharingConfigSchema`. The generic
 * route takes `value: z.unknown()`, so a write through it bypasses that
 * validation entirely, and a malformed recipient is worse than a malformed
 * section: recipients feed both the consent scope digest and the disclosure
 * copy a user is shown before agreeing.
 *
 * The dedicated routes also invalidate the persona schema cache. A generic
 * write does not, so it would serve a stale schema for up to a minute on top of
 * storing an unvalidated one.
 *
 * Rejected here rather than in the route so every caller of the validator
 * inherits the refusal.
 */
export const RESERVED_SETTING_PREFIXES = ['persona.', 'dataSharing.'] as const;

export const adminSettingSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (key) => !RESERVED_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix)),
      {
        // Names only surfaces that EXIST. An earlier version sent operators to
        // /api/admin/data-sharing, which has never shipped, so somebody
        // following the message hit a 404 and concluded the feature was broken.
        // Data-sharing recipients and both k-anonymity floors are config-file
        // only in this release, validated at boot.
        message:
          'This setting has its own route. Use /api/admin/persona/schema for persona keys, ' +
          'and declare data-sharing recipients and thresholds in commonpub.config.ts, ' +
          'so the document is validated before it is stored.',
      },
    ),
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
