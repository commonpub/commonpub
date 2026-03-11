# @snaplify/test-utils

Shared test helpers and factories for the Snaplify test suite.

## Overview

Test factories for creating realistic test data across all Snaplify packages. Factories generate properly typed objects with auto-incrementing unique IDs, consistent timestamps, and sensible defaults.

## Installation

```bash
pnpm add -D @snaplify/test-utils
```

## Usage

### User Factory

```ts
import { createTestUser, resetFactoryCounter } from '@snaplify/test-utils';

const user = createTestUser();
// {
//   id: 'test-user-1',
//   email: 'user-1@test.com',
//   username: 'testuser1',
//   displayName: 'Test User 1',
//   role: 'member',
//   status: 'active',
//   ...
// }

const admin = createTestUser({ role: 'admin', email: 'admin@test.com' });

// Reset counter between test suites
resetFactoryCounter();
```

### Session Factory

```ts
import { createTestSession } from '@snaplify/test-utils';

const session = createTestSession({ userId: user.id });
// { id: 'test-session-1', userId: '...', token: '...', expiresAt: ... }
```

### Federated Account Factory

```ts
import { createTestFederatedAccount } from '@snaplify/test-utils';

const fedAccount = createTestFederatedAccount({
  userId: user.id,
  instanceDomain: 'deveco.io',
});
```

### OAuth Client Factory

```ts
import { createTestOAuthClient } from '@snaplify/test-utils';

const client = createTestOAuthClient({
  instanceDomain: 'hack.build',
});
```

### Test Config

```ts
import { createTestConfig } from '@snaplify/test-utils';

const config = createTestConfig();
// Returns a valid SnaplifyConfig with all features enabled

const minConfig = createTestConfig({
  features: { federation: false, admin: false },
});
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 14 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `@snaplify/schema`: Type definitions
- `@snaplify/config`: Config types
