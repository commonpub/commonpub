# OAuth Codes

> Database-backed authorization code store for OAuth flows with single-use consumption and automatic expiry cleanup.

**Source**: `packages/server/src/oauthCodes.ts`
**Table**: `oauth_codes` (defined in `@commonpub/schema`)

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `storeAuthCode` | Async Function | Stores an authorization code with TTL |
| `consumeAuthCode` | Async Function | Single-use code consumption with validation |
| `cleanupExpiredCodes` | Async Function | Removes expired entries from the database |

---

## API Reference

### `storeAuthCode(db, code, userId, clientId, redirectUri): Promise<void>`

Stores an OAuth authorization code with a 10-minute time-to-live.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DB` | Drizzle database instance |
| `code` | `string` | The authorization code |
| `userId` | `string` | User who authorized the code |
| `clientId` | `string` | OAuth client that requested authorization |
| `redirectUri` | `string` | Redirect URI bound to this code |

**Notes**: The code expires 10 minutes after storage. Stored in the `oauth_codes` database table.

---

### `consumeAuthCode(db, code, clientId, redirectUri): Promise<{ userId: string } | null>`

Consumes an authorization code, returning the associated user ID if valid.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DB` | Drizzle database instance |
| `code` | `string` | The authorization code to consume |
| `clientId` | `string` | Must match the client ID the code was issued to |
| `redirectUri` | `string` | Must match the redirect URI the code was bound to |

**Returns**: `{ userId }` on success, or `null` if the code is invalid, expired, or parameters do not match.

**Behavior**:

1. The code row is **always deleted** from the database, regardless of whether validation succeeds. This ensures single-use semantics via atomic DELETE...RETURNING.
2. Validates that the code has not expired (10-minute TTL).
3. Validates that `clientId` matches the stored client ID.
4. Validates that `redirectUri` matches the stored redirect URI.
5. Returns `{ userId }` only if all checks pass.

---

### `cleanupExpiredCodes(db): Promise<void>`

Removes all expired authorization codes from the database.

**Notes**: Should be called periodically (e.g., via a cron job or background task) to prevent unbounded row growth. Unlike the previous in-memory implementation, expired rows persist until explicitly cleaned up.

---

## Database Schema

```sql
CREATE TABLE oauth_codes (
  code VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(255) NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Implementation Notes

The store is backed by the `oauth_codes` database table. This is safe for multi-process production deployments — any server instance can issue or consume codes. The atomic DELETE...RETURNING ensures single-use semantics without race conditions.
