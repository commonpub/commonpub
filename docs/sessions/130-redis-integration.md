# Session 130 — Redis integration (Plan C from session 129)

Date: 2026-04-17

Shipped the Redis-backed scaling path planned in
`docs/plans/redis-integration.md`. Two single-process assumptions that
block horizontal scaling are now gone; Redis is opt-in via
`NUXT_REDIS_URL` so deploys are byte-identical until the env var is
flipped on.

## What shipped

### A. Rate-limit store abstraction

**Problem:** `packages/infra/src/security.ts` held counters in a
process-local `Map`. Two Nitro processes behind a load balancer each kept
their own counter — an attacker splitting requests effectively doubled
the limit. `packages/server/src/publicApi/rateLimit.ts` had the same
shape for per-API-key limits (session 127).

**Fix:**
- Introduced a `RateLimitStore` interface in `@commonpub/infra`. The
  existing class was renamed `MemoryRateLimitStore`; `RateLimitStore`
  stays as a const alias pointing to the memory implementation, so
  `new RateLimitStore()` still works at runtime.
- `RedisRateLimitStore` (new, in `packages/infra/src/redis/rateLimitStore.ts`)
  uses a pipelined `INCR` + `PEXPIRE NX` for atomic fixed-window counting.
  Keys are namespaced: `cpub:ratelimit:ip:<key>:<windowStart>` and
  `cpub:ratelimit:apikey:<keyId>:<windowStart>`.
- `createRateLimitStore({ redisUrl })` factory selects Memory vs Redis
  based on `NUXT_REDIS_URL`. Lazy initialization inside a wrapper keeps
  the factory synchronous (no top-level await leaking into callers).
- **Fail-open:** any error talking to Redis returns `{ allowed: true }`
  and fires the `onRedisError` hook so metrics/logs can count the
  fallback rate. Rate-limit must not become a liveness hazard.
- `checkRateLimit()` is now async. `RateLimitStore.check()` returns a
  Promise. The Nitro IP-middleware and public-API auth middleware now
  `await`.

### B. SSE pub/sub fanout

**Problem:** `/api/realtime/stream` polled the DB every 10 s in whichever
Nitro process owned the connection. A notification or message written in
process A would never wake a stream on process B until B's next poll
tick.

**Fix:**
- `RealtimePubSub` interface in `@commonpub/infra` with two impls:
  - `MemoryRealtimePubSub` — in-process `EventEmitter`, default when
    `NUXT_REDIS_URL` is unset. Same single-process behavior as before.
  - `RedisRealtimePubSub` — one publisher client (shared via factory
    cache) + one dedicated subscriber client per wrapper (ioredis
    `.duplicate()` so subscribe-mode restrictions don't block the
    publisher).
- `createRealtimePubSub({ redisUrl })` factory + lazy wrapper.
- `@commonpub/server` exposes `publishSseEvent(userId, payload)` and
  `subscribeSseEvents(userId, handler)`. Channel naming via
  `realtimeChannel.user(userId) = 'cpub:sse:user:<userId>'`.
- `createNotification` fires a publish after insert.
- `sendMessage` fires a publish to every participant of the conversation
  except the sender (who sees their own message in the API response).
- `/api/realtime/stream` subscribes once per connection and re-queries
  counts on every event. Polling is retained at **30 s** (was 10 s) as a
  safety net for missed publishes; the pub/sub path is now primary.

### C. Tests

- `packages/infra/src/__tests__/rateLimit.test.ts` — MemoryRateLimitStore
  semantics, factory selection, fail-open on unreachable Redis URL,
  back-compat alias. 7 tests.
- `packages/infra/src/__tests__/pubsub.test.ts` — MemoryRealtimePubSub
  fanout, channel isolation, unsubscribe. 5 tests.
- `packages/infra/src/__tests__/redis.integration.test.ts` — live-Redis
  integration exercising cross-instance rate-limit enforcement, window
  rollover, and pub/sub delivery. Skipped unless `REDIS_URL_TEST` is set
  (same pattern as pglite-skipped tests). 4 tests.
- Existing memory + server security tests updated to `await` the new
  async `check()` / `checkRateLimit()`.

**Result:** 257/257 infra tests pass locally, 912/912 server tests pass,
full monorepo typecheck green.

## Files touched

### New

- `packages/infra/src/redis/client.ts` — `createRedisClient()` + cache.
- `packages/infra/src/redis/rateLimitStore.ts` — `RedisRateLimitStore`.
- `packages/infra/src/redis/factory.ts` — `createRateLimitStore()`.
- `packages/infra/src/realtime/pubsub.ts` — `RealtimePubSub` interface
  + `MemoryRealtimePubSub`.
- `packages/infra/src/realtime/redisPubsub.ts` — `RedisRealtimePubSub`.
- `packages/infra/src/realtime/factory.ts` — `createRealtimePubSub()`.
- `packages/server/src/realtime/index.ts` — process-wide SSE singleton +
  `publishSseEvent` / `subscribeSseEvents` helpers.
- `packages/infra/src/__tests__/rateLimit.test.ts`,
  `pubsub.test.ts`, `redis.integration.test.ts`.

### Modified

- `packages/infra/src/security.ts` — interface refactor, async `check`.
- `packages/infra/src/index.ts` — new exports.
- `packages/infra/package.json` — ioredis optional peer, 0.6.0.
- `packages/server/src/security.ts` — re-export additions.
- `packages/server/src/publicApi/rateLimit.ts` — wraps shared store.
- `packages/server/src/index.ts` — re-export factory + SSE helpers.
- `packages/server/src/notification/notification.ts` — publish after insert.
- `packages/server/src/messaging/messaging.ts` — publish to each
  non-sender participant.
- `packages/server/package.json` — 2.47.0.
- `layers/base/server/middleware/security.ts` — uses factory + awaits.
- `layers/base/server/middleware/public-api-auth.ts` — awaits `check`.
- `layers/base/server/api/realtime/stream.get.ts` — subscribe + coalesce.

## Versions

| Package | Before | After |
|---|---|---|
| `@commonpub/infra` | 0.5.1 | **0.6.0** |
| `@commonpub/server` | 2.46.1 | **2.47.0** |

## Acceptance criteria (from the plan)

- ✅ With `NUXT_REDIS_URL` UNSET: behavior identical to today, all tests
  green, `createRateLimitStore` returns `MemoryRateLimitStore`,
  `createRealtimePubSub` returns in-process EventEmitter wrapper.
- ✅ With `NUXT_REDIS_URL` SET: rate limits enforced across Nitro
  processes sharing one Redis (covered by the integration test); SSE
  events published from one process reach subscribers on another.
- ✅ Redis down mid-request: `RedisRateLimitStore` fails OPEN with a
  configurable `onRedisError` hook; pub/sub swallows publish errors (SSE
  already polls as backup).
- ✅ No ephemeral cross-test state via Redis: unit tests use memory only;
  integration tests namespace a unique key prefix and flush on
  setup/teardown.

## Deployment plan

1. **Land this PR on `main`.** Auto-deploy triggers on commonpub.io and
   deveco.io. Both come up with `NUXT_REDIS_URL` still unset, so
   behavior is byte-identical.
2. **commonpub.io first.** Edit `/opt/commonpub/.env` on the droplet,
   set `NUXT_REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379`, then
   `docker compose up -d --force-recreate app`. Watch logs for
   `[realtime]` or `[publicApi]` warnings.
3. **Verify** that rate-limit works (hit `/auth/login` 6× fast, expect
   429 on the 6th) and SSE pushes through (reply-to a conversation,
   watch a second browser session's unread badge update within ~1s
   rather than ~10s).
4. **deveco.io** after 24 h clean on commonpub.io.
5. If anything goes sideways, unset `NUXT_REDIS_URL` and restart —
   falls back to the byte-identical memory path.

## Known gaps / follow-ups

1. **Better Auth session storage** — still Postgres. Works fine at
   current scale. Moving to Redis is a separate initiative and the
   compliance posture needs review.
2. **API-response caching** — out of scope this session; bigger design
   surface.
3. **Activity-delivery queue (setInterval + advisory locks → BullMQ)**
   — deferred per the plan.
4. **Metrics** — `onRedisError` fires into a no-op by default. Wire to
   structured logging / a counter once we have an observability surface.
5. **CI Redis integration test** — the test is ready but CI doesn't
   spin up Redis yet. Add a sidecar + export `REDIS_URL_TEST` in a
   follow-up.
