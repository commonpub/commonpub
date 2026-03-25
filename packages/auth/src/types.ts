import type { CommonPubConfig } from '@commonpub/config';

export interface CreateAuthOptions {
  config: CommonPubConfig;
  db: DrizzleDB;
  secret: string;
  baseURL?: string;
  trustedOrigins?: string[];
}

/** Minimal Drizzle DB interface — avoids importing full drizzle-orm types */
export interface DrizzleDB {
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface SessionResult {
  user: AuthUser;
  session: AuthSession;
}

export type UserRole = 'member' | 'pro' | 'verified' | 'staff' | 'admin';

export const ROLE_HIERARCHY: readonly UserRole[] = [
  'member',
  'pro',
  'verified',
  'staff',
  'admin',
] as const;

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}
