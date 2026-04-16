# @commonpub/auth

> Better Auth wrapper with session management, route guards, role hierarchy, and AP actor SSO.

**npm**: `@commonpub/auth`
**Source**: `packages/auth/src/`
**Entry**: `packages/auth/src/index.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createAuth` | Function | Creates a Better Auth instance configured for CommonPub |
| `createAuthHook` | Function | Creates server middleware for session resolution |
| `authGuard` | Function | Requires authenticated user |
| `adminGuard` | Function | Requires admin/staff role |
| `roleGuard` | Function | Requires minimum role level |
| `createSSOProviderConfig` | Function | Creates OAuth provider config for federated SSO |
| `discoverOAuthEndpoint` | Function | Discovers OAuth endpoints via WebFinger |
| `isTrustedInstance` | Function | Checks if a domain is in the trusted instances list |
| `ROLE_HIERARCHY` | Constant | Ordered role levels |
| `getRoleLevel` | Function | Gets numeric level for a role |
| `AuthInstance` | Type | Return type of `createAuth` |
| `CreateAuthHookOptions` | Type | Options for `createAuthHook` |
| `CreateAuthOptions` | Type | Options for `createAuth` |
| `DrizzleDB` | Type | Drizzle database instance type |
| `AuthUser` | Type | Authenticated user shape |
| `AuthSession` | Type | Session shape |
| `SessionResult` | Type | Combined user + session |
| `UserRole` | Type | Role union type |
| `GuardEvent` | Type | Input for guard functions |
| `GuardResult` | Type | Output of guard functions |
| `OAuthEndpointDiscovery` | Type | Discovered OAuth endpoints |
| `SSOProviderConfig` | Type | SSO provider configuration |

---

## API Reference

### `createAuth(options: CreateAuthOptions): AuthInstance`

Creates and configures a Better Auth instance for CommonPub. Maps Better Auth's schema to the CommonPub `users`, `sessions`, and `accounts` tables.

```typescript
interface CreateAuthOptions {
  db: DrizzleDB;
  config: CommonPubConfig;
  secret: string;            // Auth secret for session signing
  baseUrl?: string;           // Base URL for auth endpoints
}

interface AuthInstance {
  handler: RequestHandler;     // Better Auth request handler
  api: BetterAuthAPI;         // Programmatic API
}
```

### `createAuthHook(options: CreateAuthHookOptions): EventHandler`

Creates server middleware that resolves sessions and populates `event.context`.

```typescript
interface CreateAuthHookOptions {
  auth: AuthInstance;
  db: DrizzleDB;
  config: CommonPubConfig;
}
```

**Sets on `event.context`**:
- `user: AuthUser | null`
- `session: AuthSession | null`
- `db: DrizzleDB`
- `config: CommonPubConfig`

---

### Guards

#### `authGuard(event: GuardEvent): GuardResult`

Requires an authenticated user. Throws 401 if no session.

```typescript
interface GuardEvent {
  locals: { user: AuthUser | null; session: AuthSession | null };
}

interface GuardResult {
  user: AuthUser;
  session: AuthSession;
}
```

#### `adminGuard(event: GuardEvent): GuardResult`

Requires `user.role` of `admin` or `staff`. Throws 401 if not authenticated, 403 if insufficient role.

#### `roleGuard(event: GuardEvent, minRole: UserRole): GuardResult`

Requires the user's role to be at or above `minRole` in the hierarchy.

---

### SSO

#### `createSSOProviderConfig(domain: string): SSOProviderConfig`

Creates an OAuth2 provider configuration for federated SSO with a remote CommonPub instance.

```typescript
interface SSOProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}
```

#### `discoverOAuthEndpoint(domain: string): Promise<OAuthEndpointDiscovery>`

Discovers OAuth endpoints from a remote instance via WebFinger or well-known URLs.

```typescript
interface OAuthEndpointDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
}
```

#### `isTrustedInstance(domain: string, trustedInstances: string[]): boolean`

Checks if a domain is in the trusted instances list from config.

---

### Role Hierarchy

```typescript
const ROLE_HIERARCHY: UserRole[] = ['member', 'pro', 'verified', 'staff', 'admin'];

function getRoleLevel(role: UserRole): number;
// 'member' → 0, 'pro' → 1, 'verified' → 2, 'staff' → 3, 'admin' → 4
```

---

## Types

### `AuthUser`

```typescript
interface AuthUser {
  id: string;              // UUID
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}
```

### `AuthSession`

```typescript
interface AuthSession {
  id: string;              // UUID
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### `SessionResult`

```typescript
interface SessionResult {
  user: AuthUser;
  session: AuthSession;
}
```

### `UserRole`

```typescript
type UserRole = 'member' | 'pro' | 'verified' | 'staff' | 'admin';
```

---

## Internal Architecture

```
packages/auth/src/
├── index.ts       → All exports
├── createAuth.ts  → createAuth() factory, Better Auth configuration
├── hooks.ts       → createAuthHook() for server middleware
├── guards.ts      → authGuard, adminGuard, roleGuard
├── sso.ts         → createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance
└── types.ts       → AuthUser, AuthSession, SessionResult, UserRole, ROLE_HIERARCHY, getRoleLevel
```
