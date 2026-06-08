# @commonpub/worker

ActivityPub queue worker monitoring and utilities.

## Overview

Activity delivery is handled by the pure-TS `federation-delivery` Nitro plugin in the layer, which polls the `activities` table and delivers via `@commonpub/protocol`'s SSRF-safe signed fetch (no Fedify, no external queue; circuit-breaker per remote domain). This package adds monitoring utilities, retry management, and admin dashboard support for tracking delivery status.

## Exports

### Types

- `ActivityDeliveryStatus`: Status of an outbound activity delivery (pending, delivered, failed)
- `DeliveryStats`: Aggregate counts of delivery statuses
- `ActivityLogEntry`: Log entry for inbound/outbound activities
- `ActivityLogFilters`: Filter options for querying activity logs

### Functions

```ts
import {
  calculateDeliveryStats,
  shouldRetry,
  getRetryDelay,
  formatActivityLog,
} from '@commonpub/worker';

// Aggregate delivery statistics
const stats = calculateDeliveryStats(activities);
// { pending: 3, delivered: 42, failed: 1, totalAttempts: 48 }

// Check if a failed delivery should be retried
shouldRetry('failed', 2, 3); // true (attempt 2 < max 3)

// Get exponential backoff delay
getRetryDelay(0); // 60000  (1 minute)
getRetryDelay(1); // 300000 (5 minutes)
getRetryDelay(2); // 1800000 (30 minutes)

// Format a log entry
formatActivityLog(entry);
// '[2026-03-10T...] -> Create https://hack.build/users/alice ... (delivered)'
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `@commonpub/schema`: Table definitions
- `@commonpub/config`: Configuration types
