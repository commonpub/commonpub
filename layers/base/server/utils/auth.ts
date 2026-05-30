// Auth helper — extracts authenticated user from event context
import type { H3Event } from 'h3';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export function requireAuth(event: H3Event): AuthUser {
  const auth = event.context.auth;
  if (!auth?.user) {
    const cookie = getRequestHeader(event, 'cookie') || '';
    const hasSessionCookie = cookie.includes('better-auth.session_token');
    throw createError({
      statusCode: 401,
      statusMessage: hasSessionCookie
        ? 'Session expired or invalid. Please log in again.'
        : 'Not logged in. Please log in to continue.',
    });
  }
  return auth.user as AuthUser;
}

/**
 * Admin gate — the linchpin reimplemented (session 175, RBAC Phase 0) as
 * `requirePermission(event, 'admin.access')`, routing all ~73 call sites through
 * the permission machinery without changing any of them. `admin.access` is
 * seeded ONLY to the admin role, and the resolver's admin-floor + flag-off
 * legacy mapping make this bit-identical to the old `user.role === 'admin'`
 * check (INV-1). The legacy 403 message is preserved verbatim.
 *
 * `requirePermission` is a Nitro auto-import (sibling util) — referenced without
 * a static import so there's no import cycle with requirePermission.ts.
 */
export function requireAdmin(event: H3Event): AuthUser {
  return requirePermission(event, 'admin.access', 'Admin access required');
}

export function getOptionalUser(event: H3Event): AuthUser | null {
  const auth = event.context.auth;
  return (auth?.user as AuthUser) ?? null;
}
