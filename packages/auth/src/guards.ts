import { type UserRole, getRoleLevel } from './types.js';

export interface GuardEvent {
  locals: {
    user: { id: string; role: string } | null;
    session: { id: string } | null;
  };
}

export interface GuardResult {
  authorized: boolean;
  status?: number;
  redirectTo?: string;
}

export function authGuard(event: GuardEvent): GuardResult {
  if (!event.locals.session || !event.locals.user) {
    return { authorized: false, status: 303, redirectTo: '/auth/sign-in' };
  }
  return { authorized: true };
}

export function adminGuard(event: GuardEvent): GuardResult {
  const authResult = authGuard(event);
  if (!authResult.authorized) return authResult;

  if (event.locals.user!.role !== 'admin') {
    return { authorized: false, status: 403 };
  }
  return { authorized: true };
}

export function roleGuard(minRole: UserRole): (event: GuardEvent) => GuardResult {
  const minLevel = getRoleLevel(minRole);

  return (event: GuardEvent): GuardResult => {
    const authResult = authGuard(event);
    if (!authResult.authorized) return authResult;

    const userRole = event.locals.user!.role as UserRole;
    const userLevel = getRoleLevel(userRole);

    // Fail CLOSED on an unrecognized role: getRoleLevel returns -1 for any name
    // not in ROLE_HIERARCHY, so an unknown `minRole` (e.g. a typo like 'moderator')
    // or an unknown user role must DENY — not authorize every logged-in user, which
    // is what `userLevel < -1` (always false) previously did.
    if (minLevel < 0 || userLevel < 0 || userLevel < minLevel) {
      return { authorized: false, status: 403 };
    }
    return { authorized: true };
  };
}
