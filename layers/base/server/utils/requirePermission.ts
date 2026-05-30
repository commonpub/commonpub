import { hasPermissionPure } from '@commonpub/auth';
import type { PermissionKey } from '@commonpub/schema';
import type { ResolvedPermissions } from '@commonpub/server';
import type { H3Event } from 'h3';
import type { AuthUser } from './auth';

// `requireAuth`, `getOptionalUser`, and `createError` are Nitro/h3 auto-imports
// (same as the rest of the layer's server utils) — referenced without a static
// import so there's no import cycle with auth.ts (which calls requirePermission
// to reimplement requireAdmin).

declare module 'h3' {
  interface H3EventContext {
    /**
     * Effective permissions for the request's user, attached by the auth
     * middleware via `resolvePermissions()`. Absent for anon / unenriched
     * requests — guards default-deny when missing (INV-3).
     */
    cpubPermissions?: ResolvedPermissions;
  }
}

/**
 * Server-side permission gate — the single choke-point all instance-wide
 * authorization routes through. Mirrors `requireScope.ts`: reads the resolved
 * set the middleware attached (`event.context.cpubPermissions`) and the primary
 * role (admin floor), then defers the decision to the pure `hasPermissionPure`.
 *
 * 401 if anon, 403 if the user lacks `needed`. NOT wrapped in
 * `requireFeature('rbac')` — the flag lives only in the resolver, so admin
 * endpoints keep working with the flag off (a flag-gated guard would 404 them).
 * With the flag off the resolver yields the legacy mapping ⇒ this is
 * byte-identical to the old `requireAdmin` for `admin.access` (INV-1).
 *
 * @param statusMessage Optional 403 message override (lets `requireAdmin`
 *   preserve its exact legacy "Admin access required" wording).
 */
export function requirePermission(
  event: H3Event,
  needed: PermissionKey,
  statusMessage?: string,
): AuthUser {
  const user = requireAuth(event);
  const resolved = event.context.cpubPermissions;
  const granted = resolved?.permissions ?? new Set<string>();
  // Fall back to the enriched user.role if the resolver didn't run — this
  // preserves the admin floor even if cpubPermissions is somehow absent (INV-2).
  const primaryRole = resolved?.primaryRole ?? user.role;

  if (!hasPermissionPure(granted, needed, primaryRole)) {
    throw createError({
      statusCode: 403,
      statusMessage: statusMessage ?? `Missing permission: ${needed}`,
    });
  }
  return user;
}

/**
 * Non-throwing permission check — for owner-OR-permission cases (the ad-hoc
 * `user.role === 'x'` sites migrated in Phase 1) and client-driving endpoints.
 * Returns false for anon. Reads the same attached context as requirePermission.
 */
export function hasPermission(event: H3Event, needed: PermissionKey): boolean {
  const user = getOptionalUser(event);
  if (!user) return false;
  const resolved = event.context.cpubPermissions;
  const granted = resolved?.permissions ?? new Set<string>();
  const primaryRole = resolved?.primaryRole ?? user.role;
  return hasPermissionPure(granted, needed, primaryRole);
}
