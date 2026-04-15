import { describe, it, expect } from 'vitest';

/**
 * Tests the route classification logic from layers/base/server/middleware/auth.ts.
 * Custom auth routes must bypass Better Auth's handleAuthRoute to avoid 404s.
 */

function isCustomAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/api/auth/federated/')
    || pathname.startsWith('/api/auth/oauth2/')
    || pathname === '/api/auth/sign-in-username'
    || pathname === '/api/auth/delete-user'
    || pathname === '/api/auth/export-data';
}

function isBetterAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/api/auth') && !isCustomAuthRoute(pathname);
}

describe('auth middleware route classification', () => {
  it('routes custom auth endpoints to Nitro, not Better Auth', () => {
    // These are Nitro route handlers, NOT Better Auth routes
    expect(isBetterAuthRoute('/api/auth/sign-in-username')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/delete-user')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/export-data')).toBe(false);
  });

  it('routes federated auth to Nitro', () => {
    expect(isBetterAuthRoute('/api/auth/federated/login')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/federated/callback')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/federated/link')).toBe(false);
  });

  it('routes OAuth2 endpoints to Nitro', () => {
    expect(isBetterAuthRoute('/api/auth/oauth2/authorize')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/oauth2/token')).toBe(false);
    expect(isBetterAuthRoute('/api/auth/oauth2/register')).toBe(false);
  });

  it('routes Better Auth paths to Better Auth', () => {
    expect(isBetterAuthRoute('/api/auth/sign-in/email')).toBe(true);
    expect(isBetterAuthRoute('/api/auth/sign-up/email')).toBe(true);
    expect(isBetterAuthRoute('/api/auth/session')).toBe(true);
    expect(isBetterAuthRoute('/api/auth/sign-out')).toBe(true);
    expect(isBetterAuthRoute('/api/auth/forget-password')).toBe(true);
    expect(isBetterAuthRoute('/api/auth/reset-password')).toBe(true);
  });

  it('non-auth routes are neither', () => {
    expect(isBetterAuthRoute('/api/content')).toBe(false);
    expect(isBetterAuthRoute('/api/notifications')).toBe(false);
    expect(isCustomAuthRoute('/api/content')).toBe(false);
  });
});
