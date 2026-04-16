# 12 — Scaling & Infrastructure

How CommonPub is deployed today, what breaks first under load, and
pragmatic scaling paths — especially on DigitalOcean.

## Current state (single-instance)

| Concern | Implementation |
|---|---|
| HTTP server | Single Nitro (`node-server` preset) |
| Database | PostgreSQL 16 (self-hosted on Droplet for commonpub.io, DO Managed for deveco.io) |
| Search | Meilisearch v1.12 single node (optional; falls back to Postgres FTS via `@commonpub/docs`) |
| Session store | Better Auth tables in Postgres |
| Rate limit store | **In-process Map** (`packages/infra/src/security.ts RateLimitStore`) — ephemeral |
| SSE streams | `/api/realtime/stream` + `/api/messages/:id/stream` — single-process polling |
| Federation delivery | `activities` table + setInterval poll every 30s, advisory-lock on `lockedAt`, exponential backoff (1m, 5m, 30m, 2h, 12h, 48h), dead-letter after 6 retries |
| Static assets | Served by Nitro (no CDN) |
| Image variants | On-demand via `@commonpub/infra` Sharp wrapper |
| Cache layer | None (relies on DB indexes + denormalized counters) |
| Log aggregation | stdout → Docker → journald on Droplet |

Redis IS provisioned in `docker-compose.yml` (and `docker-compose.prod.yml`) but **no code imports it** as of session 126. It's dead weight on the current setup and a pre-baked dependency for the scaling work below.

## What breaks first, in order

1. **Rate limits after a deploy/restart.** In-memory store resets. A malicious client that hit their limit gets a clean slate every release.
2. **Multi-instance deploys.** Because rate-limit state and SSE subscriber lists are in-process:
   - Rate limits are per-instance, not per-user-globally. An attacker splits load across instances and gets 2N/min through.
   - A user SSE-connected to instance A won't receive notifications triggered by a write that happened on instance B.
3. **Federation delivery polling overhead.** At ~30s interval with advisory locking, workable for hundreds of deliveries/hour. Becomes noisy (and Postgres contention grows) in the thousands.
4. **Publish-burst latency.** Publishing to a hub with N remote followers queues N activity rows. Delivery latency can be up to 30s on first attempt.
5. **Static asset throughput.** Nitro serves everything. At ~100 RPS of images the event loop gets squeezed.

## Fedify — do we migrate?

**No. Not recommended.**

`@commonpub/protocol` is a pure-TS implementation (WebFinger, NodeInfo, HTTP Signatures via `jose`, BlockTuple↔AP content mapper, OAuth2). It has been hardened across sessions 074–125 including:

- Signed outbox backfill (session 119)
- OAuth Actor SSO bug fixes (session 121)
- Content-mapping tests against real Mastodon / Lemmy / GoToSocial / Misskey / BookWyrm payloads

Fedify is a comprehensive framework, but adopting it now means:

- Rewriting `@commonpub/protocol` against a different abstraction
- Losing the battle-tested mapper + inbox handlers
- Adopting a different queue model (Fedify's built-in queue) that wouldn't fit `activities` table without shimming
- Zero protocol-level benefit: Fedify doesn't add capabilities we don't already have

Keep the pure-TS protocol. If protocol gaps emerge (new FEP support, performance), address them locally.

## Redis — yes, but targeted

Three concrete wins that all matter once you run 2+ Nitro instances behind a load balancer:

### A. Rate limiting — priority 1

**Problem:** `RateLimitStore` is a `Map<string, Entry>` kept in the Nitro process. Deploy restarts the counter. Two Nitro instances each have their own counter — an attacker gets 2× limit.

**Fix:** Swap the store for a Redis-backed implementation (e.g. `rate-limiter-flexible` with `RedisStore`, or a hand-rolled sliding window via `ZADD`/`ZREMRANGEBYSCORE`).

```ts
// packages/infra/src/security.ts — replace the class
export class RateLimitStore {
  constructor(private redis?: RedisClient) { /* falls back to Map if undefined */ }
  async check(key: string, tier: RateLimitTier): Promise<RateLimitResult> { /* ... */ }
}
```

Falls back cleanly to in-memory for dev / single-instance.

### B. SSE fanout — priority 1 for horizontal scaling

**Problem:** `/api/realtime/stream` sets up per-connection polling of `getUnreadCount()` and `getUnreadMessageCount()`. For a user connected to instance A, a notification write on instance B doesn't wake their stream.

**Fix:** Publish once on write → subscribe per-connection.

```
  write side (any module creating a notification)
    └── redis.publish(`user:${userId}:notifications`, '1')

  read side (stream.get.ts)
    sub = redis.duplicate()
    sub.subscribe(`user:${userId}:notifications`)
    sub.on('message', () => sendCounts())
```

Also halves DB load vs. polling.

### C. Federation delivery — priority 3 (nice-to-have)

**Problem:** setInterval poll every 30s is a fixed overhead that grows with the activities table. At 10k+ federated instances, polling is wasteful.

**Options:**

1. **Postgres LISTEN/NOTIFY.** No Redis needed. On insert into `activities`, `NOTIFY activities_new`. Worker `LISTEN`s and wakes on signal instead of polling. Retains the `activities` table as source of truth.
2. **BullMQ on Redis.** Move activities to a BullMQ queue. More machinery — new worker process, retries managed by BullMQ — but horizontally scales naturally.

Option 1 is ~50 lines of code and keeps all current semantics. Option 2 is a bigger refactor.

### What NOT to use Redis for

- **Session storage.** Better Auth's Postgres sessions table is fine and maintains durability. Redis would be non-durable sessions — regression.
- **Caching user profiles / content.** Denormalized counters + indexes are fast enough. Premature.

## DigitalOcean-specific scaling path

Ordered from least effort / most impact at the top.

### Phase 0 — Already done on deveco.io

- Move Postgres to DO Managed Database. Backups, failover, point-in-time recovery handled by DO. commonpub.io still uses self-hosted Postgres on the same droplet — consider moving.

### Phase 1 — Enable horizontal scaling (needs Redis)

1. **Add DO Managed Redis** (Basic plan ~$15/mo is sufficient).
2. **Wire rate limit store to Redis** (see A above). Set `REDIS_URL` env var; `RateLimitStore` detects and uses it.
3. **Wire SSE fanout via Redis pub/sub** (see B above).
4. **Test with two Nitro instances locally** (`docker compose up --scale app=2`).

After this, App Platform auto-scale or HAProxy-in-front-of-Droplets becomes safe.

### Phase 2 — App Platform migration (optional, higher cost)

commonpub.io lives on a single Droplet today. Moving to App Platform gives you:

- Auto-deploy on push (Droplet does this too via a workflow)
- Auto-scale by CPU/mem (Droplet doesn't)
- Zero-downtime rolling deploys
- Managed TLS (Droplet has it via Caddy)

Tradeoff: higher cost, less control, `drizzle-kit push` must run via an App Platform job or migration step.

Configure `deploy/app-spec.yaml`:

```yaml
services:
  - name: app
    instance_count: 2           # from 1
    instance_size_slug: basic-xs
    autoscale:
      min_instance_count: 2
      max_instance_count: 6
      metrics:
        cpu:
          percent: 70
```

### Phase 3 — Delivery worker as separate process

As instance count grows past ~dozens of remote instances, the in-Nitro delivery worker starts eating web request time. Options:

1. Run `federation-delivery.ts` as a standalone `node` process (not a Nitro plugin). Pros: isolates CPU/memory. Cons: new deploy target.
2. Use `tools/worker/` as a starting scaffold.

Mark `features.federation` on the web instances and dedicate a single worker instance. Web instances still create rows in `activities`; only the worker polls + delivers.

### Phase 4 — CDN + read replicas (hundreds of thousands of users)

- **DO Spaces + CDN** for uploaded files (already partial support: `@commonpub/infra` has `S3StorageAdapter`).
- **Read replicas** for browse/search endpoints. Drizzle supports multi-connection; route writes → primary, reads → replica. Not a trivial refactor.
- **Meilisearch cluster** if search volume demands.

## Practical ordering

Pragmatic advice for the next scaling decision:

| You have… | Do this next |
|---|---|
| 1 droplet, < 100 users | Nothing. Current stack is fine. |
| 1 droplet, > 500 users | Move Postgres to DO Managed (follow deveco.io pattern). |
| Want to survive a deploy without losing rate-limit counters | Add DO Managed Redis + wire the RateLimitStore. |
| About to launch a feature that uses SSE heavily | Same — Redis pub/sub for fanout. |
| First outgoing federated users | Nothing special; current delivery worker handles 1–10k deliveries/hour fine. |
| > 10k federated content deliveries/day | Consider Postgres LISTEN/NOTIFY (A-above) or split delivery worker (phase 3). |
| Planning multi-instance web tier | Do Redis (phases 1) FIRST. In-memory rate-limit + in-process SSE make multi-instance dangerous. |

## Code pointers for each change

| Change | Edit here |
|---|---|
| Redis RateLimitStore | `packages/infra/src/security.ts` — swap `RateLimitStore` class |
| Redis SSE fanout | `layers/base/server/api/realtime/stream.get.ts` + write sites that create notifications |
| Postgres LISTEN/NOTIFY | `packages/server/src/federation/delivery.ts` — wrap poll loop with LISTEN |
| Split delivery worker | Move `federation-delivery.ts` plugin to a standalone process; inspire from `tools/worker/` |
| DO Managed Postgres | Update `NUXT_DATABASE_URL` in prod env, apply schema via `drizzle-kit push` once |
| DO Managed Redis | Add `REDIS_URL` env var; gate code paths on `process.env.REDIS_URL` |

## Non-goals

- **Kubernetes.** Too heavy for this use case. App Platform covers 99% of scaling needs.
- **GraphQL / tRPC.** REST is fine, lets federated clients (non-CommonPub) consume it too.
- **Fedify migration.** Already covered above — not recommended.
- **Event-sourcing refactor.** `activities` is as event-sourced as this needs to be.
