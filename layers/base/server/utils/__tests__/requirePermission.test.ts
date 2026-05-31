/**
 * Gate-level tests for requirePermission / hasPermission.
 *
 * These exercise the FULL decision path (context → pure function), not just
 * `hasPermissionPure` in isolation — per feedback_integration_test_full_output_path:
 * an algorithm test that feeds the pure function directly masked a real INV-2
 * bug here (the gate read `resolved.primaryRole`, which is `''` after a
 * default-deny, and `?? user.role` never fired — locking out admins). The
 * "admin survives an empty/failed resolver" case below is that regression guard.
 *
 * `requireAuth` / `getOptionalUser` / `createError` are Nitro auto-imports the
 * gate references as globals; we install minimal stand-ins on globalThis (the
 * layer's vitest env resolves free identifiers from globalThis).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { H3Event } from 'h3';
import type { ResolvedPermissions } from '@commonpub/server';

interface FakeUser {
  id: string;
  username: string;
  role: string;
}

interface HttpError extends Error {
  statusCode: number;
  statusMessage: string;
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const err = new Error(opts.statusMessage) as HttpError;
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  };
  g.requireAuth = (event: H3Event): FakeUser => {
    const user = event.context.auth?.user as FakeUser | undefined;
    if (!user) throw (g.createError as (o: object) => HttpError)({ statusCode: 401, statusMessage: 'Not logged in' });
    return user;
  };
  g.getOptionalUser = (event: H3Event): FakeUser | null =>
    (event.context.auth?.user as FakeUser | undefined) ?? null;
});

// Imported AFTER globals are arranged in beforeAll-safe position (module body
// references no globals at load time — only inside the functions).
const { requirePermission, hasPermission, ownerOrPermission } = await import('../requirePermission');

function makeEvent(
  user: FakeUser | null,
  cpubPermissions?: ResolvedPermissions,
): H3Event {
  return {
    context: {
      auth: { user, session: user ? {} : null },
      ...(cpubPermissions ? { cpubPermissions } : {}),
    },
  } as unknown as H3Event;
}

const resolved = (primaryRole: string, perms: string[]): ResolvedPermissions => ({
  primaryRole,
  roleKeys: [primaryRole],
  permissions: new Set(perms),
});

const admin: FakeUser = { id: 'a1', username: 'admin', role: 'admin' };
const member: FakeUser = { id: 'm1', username: 'mem', role: 'member' };

describe('requirePermission', () => {
  it('anonymous → 401', () => {
    try {
      requirePermission(makeEvent(null), 'content.read');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as HttpError).statusCode).toBe(401);
    }
  });

  it('admin with a normal resolved set → allowed', () => {
    const e = makeEvent(admin, resolved('admin', ['*']));
    expect(requirePermission(e, 'federation.manage')).toBe(admin);
  });

  it('INV-2 regression: admin allowed even when the resolver DEFAULT-DENIED (empty set, primaryRole:"")', () => {
    // Simulates a resolver DB-error window: cpubPermissions is DEFINED but empty
    // with primaryRole ''. The floor must use the enriched user.role='admin'.
    const e = makeEvent(admin, resolved('', []));
    expect(requirePermission(e, 'admin.access')).toBe(admin);
    expect(requirePermission(e, 'settings.manage')).toBe(admin);
  });

  it('INV-2 regression: admin allowed even when cpubPermissions is entirely absent', () => {
    const e = makeEvent(admin); // no cpubPermissions attached at all
    expect(requirePermission(e, 'admin.access')).toBe(admin);
  });

  it('member with a granted key → allowed; missing key → 403', () => {
    const e = makeEvent(member, resolved('member', ['content.moderate']));
    expect(requirePermission(e, 'content.moderate')).toBe(member);
    try {
      requirePermission(e, 'settings.manage');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(403);
      expect((err as HttpError).statusMessage).toContain('settings.manage');
    }
  });

  it('INV-1 demotion lag: a STALE admin cache entry does NOT grant a now-demoted member', () => {
    // Resolver returns an EMPTY set for admins (access via floor), so a 30s-stale
    // entry for a just-demoted user carries no `*` to leak. The gate floors on
    // the FRESH user.role='member' → denied immediately, matching pre-RBAC.
    const staleAdminEntry = resolved('admin', []); // what the cache held pre-demotion
    const e = makeEvent(member, staleAdminEntry); // but enrichUser now says member
    try {
      requirePermission(e, 'admin.access');
      expect.unreachable('demoted member must be denied despite stale admin cache');
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(403);
    }
    expect(hasPermission(e, 'settings.manage')).toBe(false);
  });

  it('member with NO resolved set → default-deny 403 (INV-3)', () => {
    try {
      requirePermission(makeEvent(member), 'content.read');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(403);
    }
  });

  it('custom 403 message override is used (requireAdmin back-compat)', () => {
    try {
      requirePermission(makeEvent(member), 'admin.access', 'Admin access required');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as HttpError).statusMessage).toBe('Admin access required');
    }
  });
});

describe('hasPermission (non-throwing)', () => {
  it('anonymous → false', () => {
    expect(hasPermission(makeEvent(null), 'content.read')).toBe(false);
  });

  it('admin with empty resolved set → true (floor via user.role)', () => {
    expect(hasPermission(makeEvent(admin, resolved('', [])), 'content.moderate')).toBe(true);
  });

  it('member: granted true, ungranted false', () => {
    const e = makeEvent(member, resolved('member', ['content.editorial']));
    expect(hasPermission(e, 'content.editorial')).toBe(true);
    expect(hasPermission(e, 'users.manage')).toBe(false);
  });
});

describe('ownerOrPermission (owner-OR-permission gate)', () => {
  const owner: FakeUser = { id: 'owner1', username: 'owner', role: 'member' };

  it('anonymous → false', () => {
    expect(ownerOrPermission(makeEvent(null), 'owner1', 'contest.manage')).toBe(false);
  });

  it('the resource owner passes WITHOUT holding the permission', () => {
    // owner1 owns the resource; resolved set is empty + role member.
    const e = makeEvent(owner, resolved('member', []));
    expect(ownerOrPermission(e, 'owner1', 'contest.manage')).toBe(true);
  });

  it('a non-owner WITHOUT the permission → false', () => {
    const e = makeEvent(member, resolved('member', []));
    expect(ownerOrPermission(e, 'owner1', 'contest.manage')).toBe(false);
  });

  it('a non-owner WITH the permission → true (the flag-on broadening)', () => {
    const e = makeEvent(member, resolved('member', ['contest.manage']));
    expect(ownerOrPermission(e, 'owner1', 'contest.manage')).toBe(true);
  });

  it('INV-1/INV-2 flag-off parity: a non-owner admin passes via the floor (empty set)', () => {
    // Pre-RBAC `owner || role==='admin'` ≡ `ownerOrPermission` flag-off.
    const e = makeEvent(admin, resolved('', []));
    expect(ownerOrPermission(e, 'owner1', 'contest.manage')).toBe(true);
  });

  it('a null/undefined ownerId only ever passes via the permission', () => {
    const denied = makeEvent(member, resolved('member', []));
    expect(ownerOrPermission(denied, null, 'contest.manage')).toBe(false);
    expect(ownerOrPermission(denied, undefined, 'contest.manage')).toBe(false);
    const granted = makeEvent(member, resolved('member', ['contest.manage']));
    expect(ownerOrPermission(granted, null, 'contest.manage')).toBe(true);
  });
});
