export { createAuth } from './createAuth.js';
export type { AuthInstance } from './createAuth.js';
export { createAuthMiddleware, createAuthHook } from './hooks.js';
export type { CreateAuthMiddlewareOptions, AuthMiddleware, AuthLocals } from './hooks.js';
export { authGuard, adminGuard, roleGuard } from './guards.js';
export type { GuardEvent, GuardResult } from './guards.js';
export { createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance } from './sso.js';
export type { OAuthEndpointDiscovery, SSOProviderConfig } from './sso.js';
export type {
  CreateAuthOptions,
  DrizzleDB,
  AuthUser,
  AuthSession,
  SessionResult,
  UserRole,
} from './types.js';
export { ROLE_HIERARCHY, getRoleLevel } from './types.js';
