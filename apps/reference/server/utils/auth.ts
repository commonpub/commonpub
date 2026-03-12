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
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  }
  return auth.user as AuthUser;
}

export function requireAdmin(event: H3Event): AuthUser {
  const user = requireAuth(event);
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }
  return user;
}

export function getOptionalUser(event: H3Event): AuthUser | null {
  const auth = event.context.auth;
  return (auth?.user as AuthUser) ?? null;
}
