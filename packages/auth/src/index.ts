export { createAuth } from './createAuth.js';
export type { AuthInstance, AuthEmailSender } from './createAuth.js';
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

// Global RBAC — pure permission check (session 175). Decision core behind
// requirePermission / hasPermission / useCan. See docs/plans/rbac.md.
export { hasPermissionPure } from './permissions.js';

// Cross-instance identity types — Phase 1a foundation. The runtime
// resolver + action router live in @commonpub/server. See
// docs/sessions/136-cross-instance-identity-plan.md.
export {
  SCOPE_VALUES,
  SOFTWARE_KIND_VALUES,
  isScope,
  isSoftwareKind,
  makeHandle,
  parseHandle,
  hasAllScopes,
  coerceScopes,
  isUsableLinkedIdentity,
} from './identity.js';
export type {
  Scope,
  SoftwareKind,
  Identity,
  NativeIdentity,
  LinkedIdentity,
  IdentityContext,
} from './identity.js';
