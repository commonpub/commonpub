# Rate Limiting

> Sliding-window rate limiter with six tiers and Nitro server middleware integration.

**Source**: `packages/server/src/rateLimit.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `RateLimitTier` | Interface | Rate limit configuration for a tier |
| `RateLimitStore` | Class | In-memory sliding window store |
| `DEFAULT_TIERS` | Constant | Six pre-configured rate limit tiers |
| `getTierForPath` | Function | Maps a URL pathname to its tier |
| `createRateLimitHook` | Function | Nitro server middleware factory |

---

## API Reference

### `RateLimitTier`

```ts
interface RateLimitTier {
  limit: number;     // max requests allowed in the window
  windowMs: number;  // window duration in milliseconds
}
```

---

### `RateLimitStore`

In-memory sliding window rate limit store.

#### `check(key: string, tier: RateLimitTier): { allowed: boolean; remaining: number; resetAt: number }`

Checks whether a request is allowed under the given tier.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique identifier (typically `ip:path`) |
| `tier` | `RateLimitTier` | Rate limit configuration to apply |

**Returns**: `{allowed, remaining, resetAt}` where `resetAt` is a Unix timestamp in milliseconds.

#### `destroy(): void`

Stops the background cleanup interval and clears all stored entries.

**Notes**: The store automatically cleans up expired entries every 60 seconds via `setInterval`.

---

### `DEFAULT_TIERS`

Six pre-configured rate limit tiers:

| Tier | Limit | Window | Use case |
|------|-------|--------|----------|
| `auth` | 5 | 60s | Authentication endpoints |
| `upload` | 10 | 60s | File upload endpoints |
| `social` | 30 | 60s | Social interactions |
| `federation` | 60 | 60s | ActivityPub federation |
| `api` | 60 | 60s | General API routes |
| `general` | 120 | 60s | All other requests |

---

### `getTierForPath(pathname: string): RateLimitTier`

Maps a URL pathname to its corresponding rate limit tier.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pathname` | `string` | URL pathname to classify |

**Routing rules** (evaluated in order):

| Pattern | Tier |
|---------|------|
| `/auth/` or `/api/auth/` | `auth` |
| `/api/files/upload` | `upload` |
| `/api/social/` | `social` |
| `/api/federation/`, `/inbox`, or `/users/` | `federation` |
| `/api/*` | `api` |
| Everything else | `general` |

**Returns**: The `RateLimitTier` for the matched route.

---

### `createRateLimitHook(store?): EventHandler`

Creates Nitro server middleware that enforces rate limiting.

| Parameter | Type | Description |
|-----------|------|-------------|
| `store` | `RateLimitStore` | Optional. Defaults to a new `RateLimitStore` instance |

**Returns**: A Nitro `EventHandler` function.

**Behavior**:

- **Static asset bypass**: Requests matching `/_app/`, `favicon`, `.css`, `.js`, `.png`, `.jpg`, `.svg`, or `.woff2` skip rate limiting entirely.
- **Key generation**: `${ip}:${first 3 path segments}` (e.g., `192.168.1.1:/api/social/like`).
- **On limit exceeded** (429 response):
  - `Retry-After` header (seconds until reset)
  - `X-RateLimit-Limit` header (tier limit)
  - `X-RateLimit-Remaining` header (`0`)
  - `X-RateLimit-Reset` header (Unix timestamp)
- **On allowed**: Request proceeds through the middleware chain. Rate limit headers are included in the response.
