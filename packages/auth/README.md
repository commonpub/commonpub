# @snaplify/auth

Better Auth wrapper with route guards, hooks, and ActivityPub Actor SSO for Snaplify.

## Overview

Wraps [Better Auth](https://www.better-auth.com/) to handle authentication for Snaplify instances. Covers email/password auth, social OAuth providers (GitHub, Google), session management, route protection, and cross-instance SSO via ActivityPub.

Better Auth runs as a library, not a separate service.

## Installation

```bash
pnpm add @snaplify/auth
```

## Usage

### Creating an Auth Instance

```ts
import { createAuth } from '@snaplify/auth';
import { defineSnaplifyConfig } from '@snaplify/config';
import { drizzle } from 'drizzle-orm/node-postgres';

const { config } = defineSnaplifyConfig({ /* ... */ });
const db = drizzle(pool);

const auth = createAuth({
  config,
  db,
  secret: process.env.AUTH_SECRET!,
  baseURL: 'https://hack.build',
});
```

### Route Guards

Protect SvelteKit routes with guards in `+page.server.ts` or hooks:

```ts
import { authGuard, adminGuard, roleGuard } from '@snaplify/auth';

// Require authentication (redirects to /auth/sign-in)
const result = authGuard(event);
if (!result.authorized) throw redirect(result.status!, result.redirectTo!);

// Require admin role (returns 403)
const result = adminGuard(event);

// Require minimum role level
const modGuard = roleGuard('moderator');
const result = modGuard(event);
```

### SvelteKit Auth Hook

```ts
import { createAuthHook } from '@snaplify/auth';

const authHook = createAuthHook({ auth });

// In hooks.server.ts
export const handle = authHook;
```

### AP Actor SSO (Model B)

Cross-instance single sign-on via ActivityPub actor discovery:

```ts
import { createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance } from '@snaplify/auth';

// Check if an instance is in the trusted list
const trusted = isTrustedInstance('deveco.io', config.auth.trustedInstances);

// Discover OAuth endpoints via WebFinger
const endpoint = await discoverOAuthEndpoint('deveco.io');

// Build provider config for Better Auth
const ssoConfig = createSSOProviderConfig(endpoint);
```

## Role Hierarchy

Roles have numeric levels for comparison:

| Role        | Level | Description              |
| ----------- | ----- | ------------------------ |
| `member`    | 1     | Default role             |
| `moderator` | 2     | Content moderation       |
| `admin`     | 3     | Full instance management |

```ts
import { ROLE_HIERARCHY, getRoleLevel } from '@snaplify/auth';

getRoleLevel('admin');     // 3
getRoleLevel('moderator'); // 2
getRoleLevel('member');    // 1
```

## Auth Configuration

Auth behavior is driven by `@snaplify/config`. Social providers degrade gracefully: if credentials aren't set, the sign-in buttons don't appear.

## Exports

```ts
export { createAuth } from './createAuth';
export { createAuthHook } from './hooks';
export { authGuard, adminGuard, roleGuard } from './guards';
export { createSSOProviderConfig, discoverOAuthEndpoint, isTrustedInstance } from './sso';
export { ROLE_HIERARCHY, getRoleLevel } from './types';
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 42 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `better-auth`: Auth library
- `drizzle-orm`: Database adapter
- `@snaplify/schema`: Table definitions
- `@snaplify/config`: Feature flags and auth config
- `@snaplify/snaplify`: AP protocol types for SSO
