# @commonpub/test-utils

> Shared test helpers: factories for test data and mock configuration.

**npm**: `@commonpub/test-utils`
**Source**: `packages/test-utils/src/`
**Entry**: `packages/test-utils/src/index.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createTestUser` | Function | Factory for test user objects |
| `createTestSession` | Function | Factory for test session objects |
| `createTestFederatedAccount` | Function | Factory for test federated account objects |
| `createTestOAuthClient` | Function | Factory for test OAuth client objects |
| `resetFactoryCounter` | Function | Reset auto-incrementing factory counters |
| `createTestConfig` | Function | Create a test CommonPubConfig with all features enabled |
| `TestUser` | Type | Shape returned by `createTestUser` |
| `TestSession` | Type | Shape returned by `createTestSession` |
| `TestFederatedAccount` | Type | Shape returned by `createTestFederatedAccount` |
| `TestOAuthClient` | Type | Shape returned by `createTestOAuthClient` |

---

## API Reference

### `createTestUser(overrides?: Partial<TestUser>): TestUser`

Creates a test user with auto-generated values. Each call produces unique `id`, `email`, and `username` via an auto-incrementing counter.

```typescript
interface TestUser {
  id: string;              // UUID
  email: string;           // test-N@example.com
  emailVerified: boolean;  // true
  username: string;        // testuser-N
  displayName: string;     // Test User N
  avatarUrl: string | null;
  role: UserRole;          // 'member'
  status: string;          // 'active'
  createdAt: Date;
  updatedAt: Date;
}
```

**Example**:

```typescript
const user = createTestUser({ role: 'admin' });
// { id: 'uuid-1', email: 'test-1@example.com', username: 'testuser-1', role: 'admin', ... }
```

### `createTestSession(overrides?: Partial<TestSession>): TestSession`

Creates a test session linked to a user.

```typescript
interface TestSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### `createTestFederatedAccount(overrides?: Partial<TestFederatedAccount>): TestFederatedAccount`

Creates a test federated account for AP SSO testing.

```typescript
interface TestFederatedAccount {
  id: string;
  userId: string;
  actorUri: string;
  instanceDomain: string;
  preferredUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}
```

### `createTestOAuthClient(overrides?: Partial<TestOAuthClient>): TestOAuthClient`

Creates a test OAuth client for federation testing.

```typescript
interface TestOAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  instanceDomain: string;
  createdAt: Date;
}
```

### `resetFactoryCounter(): void`

Resets the auto-incrementing counter used by factories. Call in `beforeEach` or `afterEach` to get predictable IDs in tests.

### `createTestConfig(overrides?: Partial<CommonPubConfig>): CommonPubConfig`

Creates a fully populated test configuration with all features enabled.

```typescript
// Default test config:
{
  instance: {
    domain: 'test.local',
    name: 'Test Instance',
    description: 'Test instance for unit tests',
    maxUploadSize: 10_485_760,
    contentTypes: ['project', 'article', 'blog', 'explainer'],
  },
  features: {
    content: true,
    social: true,
    hubs: true,
    docs: true,
    video: true,
    contests: true,
    learning: true,
    explainers: true,
    federation: true,
    admin: true,
  },
  auth: {
    emailPassword: true,
    magicLink: false,
    passkeys: false,
  },
}
```

---

## Usage Patterns

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestUser, createTestConfig, resetFactoryCounter } from '@commonpub/test-utils';

describe('myModule', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('handles admin users', () => {
    const admin = createTestUser({ role: 'admin' });
    const config = createTestConfig({ features: { admin: true } });
    // ... test logic
  });
});
```

---

## Internal Architecture

```
packages/test-utils/src/
├── index.ts        → All exports
├── factories.ts    → createTestUser, createTestSession, createTestFederatedAccount, createTestOAuthClient, resetFactoryCounter
└── mockConfig.ts   → createTestConfig
```
