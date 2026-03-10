import { describe, it, expect } from 'vitest';
import { authGuard, adminGuard, roleGuard } from '../guards';
import type { GuardEvent } from '../guards';

function createEvent(user: { id: string; role: string } | null): GuardEvent {
  return {
    locals: {
      user,
      session: user ? { id: 'session-1' } : null,
    },
  };
}

describe('authGuard', () => {
  it('should authorize authenticated users', () => {
    const result = authGuard(createEvent({ id: 'u1', role: 'member' }));
    expect(result.authorized).toBe(true);
  });

  it('should redirect unauthenticated users to sign-in', () => {
    const result = authGuard(createEvent(null));
    expect(result.authorized).toBe(false);
    expect(result.status).toBe(303);
    expect(result.redirectTo).toBe('/auth/sign-in');
  });
});

describe('adminGuard', () => {
  it('should authorize admin users', () => {
    const result = adminGuard(createEvent({ id: 'u1', role: 'admin' }));
    expect(result.authorized).toBe(true);
  });

  it('should reject non-admin users with 403', () => {
    const result = adminGuard(createEvent({ id: 'u1', role: 'member' }));
    expect(result.authorized).toBe(false);
    expect(result.status).toBe(403);
  });

  it('should redirect unauthenticated users', () => {
    const result = adminGuard(createEvent(null));
    expect(result.authorized).toBe(false);
    expect(result.status).toBe(303);
    expect(result.redirectTo).toBe('/auth/sign-in');
  });
});

describe('roleGuard', () => {
  it('should authorize users at or above minimum role', () => {
    const guard = roleGuard('verified');
    expect(guard(createEvent({ id: 'u1', role: 'verified' })).authorized).toBe(true);
    expect(guard(createEvent({ id: 'u1', role: 'staff' })).authorized).toBe(true);
    expect(guard(createEvent({ id: 'u1', role: 'admin' })).authorized).toBe(true);
  });

  it('should reject users below minimum role', () => {
    const guard = roleGuard('verified');
    const result = guard(createEvent({ id: 'u1', role: 'member' }));
    expect(result.authorized).toBe(false);
    expect(result.status).toBe(403);
  });

  it('should accept member role for member guard', () => {
    const guard = roleGuard('member');
    expect(guard(createEvent({ id: 'u1', role: 'member' })).authorized).toBe(true);
  });

  it('should redirect unauthenticated users', () => {
    const guard = roleGuard('pro');
    const result = guard(createEvent(null));
    expect(result.authorized).toBe(false);
    expect(result.redirectTo).toBe('/auth/sign-in');
  });

  it('should follow full role hierarchy: member < pro < verified < staff < admin', () => {
    const roles = ['member', 'pro', 'verified', 'staff', 'admin'] as const;
    for (let i = 0; i < roles.length; i++) {
      const guard = roleGuard(roles[i]);
      for (let j = 0; j < roles.length; j++) {
        const result = guard(createEvent({ id: 'u1', role: roles[j] }));
        if (j >= i) {
          expect(result.authorized).toBe(true);
        } else {
          expect(result.authorized).toBe(false);
        }
      }
    }
  });
});
