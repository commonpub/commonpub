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
| Rate limit store | In-process `Map` via `MemoryRateLimitStore` by default; `NUXT_REDIS_URL` flips it to `RedisRateLimitStore` (session 130) |
| SSE streams | `/api/realtime/stream` + `/api/messages/:id/stream` — event-driven via `RealtimePubSub` (in-process EventEmitter by default; Redis pub/sub when `NUXT_REDIS_URL` is set) + 30 s polling safety net (session 130) |
| Federation delivery | `activities` table + setInterval poll every 30s, advisory-lock on `lockedAt`, exponential backoff (1m, 5m, 30m, 2h, 12h, 48h), dead-letter after 6 retries |
| Static assets | Served by Nitro (no CDN) |
| Image variants | On-demand via `@commonpub/infra` Sharp wrapper |
| Cache layer | None (relies on DB indexes + denormalized counters) |
| Log aggregation | stdout → Docker → journald on Droplet |

Redis IS provisioned in `docker-compose.yml` (and `docker-compose.prod.yml`). Session 130 wired it into the rate-limit and SSE paths; it is **opt-in via `NUXT_REDIS_URL`** — unset leaves the code on the original single-process path. See "Redis — wired in session 130" below for the flip procedure.

## What breaks first, in order

1. **Rate limits after a deploy/restart.** With `NUXT_REDIS_URL` unset, the in-memory store resets and a malicious client that hit their limit gets a clean slate every release. Setting `NUXT_REDIS_URL` fixes this.
2. **Multi-instance deploys** with `NUXT_REDIS_URL` unset. Rate-limit state and SSE subscriber lists are then per-process:
   - Rate limits are per-instance, not per-user-globally. An attacker splits load across instances and gets 2N/min through.
   - A user SSE-connected to instance A won't receive notifications triggered by a write that happened on instance B.
   Setting `NUXT_REDIS_URL` on every instance fixes both.
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

## Redis — wired in session 130, opt-in via `NUXT_REDIS_URL`

Three concrete wins matter once you run 2+ Nitro instances behind a load balancer. As of session 130 (2026-04-17), the code path for A and B is **shipped and deployed** on commonpub.io and deveco.io; Redis is opt-in via the `NUXT_REDIS_URL` env var. Default unset = byte-identical to pre-130 single-process behavior.

### A. Rate limiting — DONE (shipped session 130)

**Status:** `RateLimitStore` is now an interface (`packages/infra/src/security.ts`). `MemoryRateLimitStore` is the default in-process implementation. `RedisRateLimitStore` (`packages/infra/src/redis/rateLimitStore.ts`) uses atomic `INCR` + `PEXPIRE NX`.

`createRateLimitStore({ redisUrl })` picks memory vs Redis. Namespaced keys: `cpub:ratelimit:ip:*` and `cpub:ratelimit:apikey:*`. Fail-open on Redis errors via an `onRedisError` hook. ioredis client tuned fast-fail (`enableOfflineQueue: false`, `commandTimeout: 500`, `maxRetriesPerRequest: 1`).

### B. SSE fanout — DONE (shipped session 130)

**Status:** `RealtimePubSub` abstraction in `packages/infra/src/realtime/`. `MemoryRealtimePubSub` (EventEmitter, single-process) and `RedisRealtimePubSub` (dedicated subscriber client, auto-replay on reconnect).

`@commonpub/server` exposes `publishSseEvent(userId, payload)`/`subscribeSseEvents(userId, handler)` against a per-process singleton keyed by `NUXT_REDIS_URL`. `createNotification` and `sendMessage` fire-and-forget publish after the DB write. `/api/realtime/stream` subscribes once per connection and coalesces redundant triggers; polling retained at 30 s as a safety net.

### How to turn Redis ON

The Redis container is already running on both prod droplets (`deploy/docker-compose.prod.yml`). Turning it on is one env-var + an app restart:

```bash
# On the droplet, as root.
ssh root@commonpub.io
cd /opt/commonpub
set -a; source .env; set +a              # REDIS_PASSWORD is already in .env
grep -q '^NUXT_REDIS_URL=' .env || \
  echo "NUXT_REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" >> .env
docker compose up -d --force-recreate app
docker compose logs -f app | head -100   # Watch boot; look for [realtime] or fail-open warnings
```

Roll to deveco.io after ~24 h clean.

Verify it's doing its job:

```bash
# Real rate-limit keys show up in Redis once real traffic flows.
docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'cpub:ratelimit:*' | head
# Active pub/sub channels:
docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" pubsub channels 'cpub:sse:*'
```

### How to turn Redis OFF (rollback)

```bash
ssh root@<host>
cd /opt/<instance>
sed -i.bak '/^NUXT_REDIS_URL=/d' .env
docker compose up -d --force-recreate app
```

The memory path is the pre-session-130 behavior — known good.

### What fail-open means here

If Redis is unreachable mid-request, `RedisRateLimitStore.check()` returns `{ allowed: true, remaining: limit - 1 }` and fires `onRedisError`. Rate-limit MUST NOT become a liveness hazard — it's defense-in-depth, not the only defense. The fast-fail ioredis config caps the added latency at ~500 ms per request before we fall open.

SSE pub/sub swallows publish errors; the 30 s polling loop picks up missed events regardless.

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

### Phase 1 — Enable horizontal scaling

Code for rate-limit + SSE Redis paths is shipped (session 130). To go multi-instance:

1. **Confirm a Redis endpoint both app instances can reach.** On a single droplet the bundled `redis` service in `deploy/docker-compose.prod.yml` is fine. For two droplets, add DO Managed Redis (Basic ~$15/mo) and use its connection URL.
2. **Set `NUXT_REDIS_URL` on every app instance** — see "How to turn Redis ON" above.
3. **Scale the Nitro service.** `docker compose up -d --scale app=2` locally, or raise `instance_count` in `deploy/app-spec.yaml` on App Platform.
4. **Put a load balancer in front** (HAProxy on a droplet, or App Platform's built-in). With Redis wired, requests can hit any instance without losing rate-limit or notification delivery.

Session 130 acceptance criteria verify that two processes sharing one Redis enforce the same per-key limit and that SSE events published from one process reach subscribers on another.

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
| Want to survive a deploy without losing rate-limit counters | Set `NUXT_REDIS_URL` (see "How to turn Redis ON" above). Code path already shipped. |
| About to launch a feature that uses SSE heavily on a single instance | Nothing — in-process pub/sub already reacts instantly on same-process writes. Flip `NUXT_REDIS_URL` only if you go multi-instance. |
| First outgoing federated users | Nothing special; current delivery worker handles 1–10k deliveries/hour fine. |
| > 10k federated content deliveries/day | Consider Postgres LISTEN/NOTIFY (C-above) or split delivery worker (phase 3). |
| Planning multi-instance web tier | Set `NUXT_REDIS_URL`. Without it, two processes each keep their own rate-limit map and SSE cross-process events don't propagate. |

## Code pointers for each change

| Change | Edit here |
|---|---|
| Redis rate-limit (shipped) | `packages/infra/src/redis/rateLimitStore.ts`, `packages/infra/src/redis/factory.ts`; wired at `layers/base/server/middleware/security.ts` and `packages/server/src/publicApi/rateLimit.ts` |
| Redis SSE fanout (shipped) | `packages/infra/src/realtime/redisPubsub.ts`, `packages/server/src/realtime/index.ts`; publish sites in `packages/server/src/notification/notification.ts` and `packages/server/src/messaging/messaging.ts`; subscribe at `layers/base/server/api/realtime/stream.get.ts` |
| Turning Redis on/off | `NUXT_REDIS_URL` in `/opt/<instance>/.env`. Any non-empty value selects Redis; absent/empty = memory. No code change. |
| Postgres LISTEN/NOTIFY | `packages/server/src/federation/delivery.ts` — wrap poll loop with LISTEN |
| Split delivery worker | Move `federation-delivery.ts` plugin to a standalone process; inspire from `tools/worker/` |
| DO Managed Postgres | Update `NUXT_DATABASE_URL` in prod env, apply schema via `scripts/db-migrate.mjs` |
| DO Managed Redis | Point `NUXT_REDIS_URL` at the managed endpoint; drop the bundled `redis` service from `deploy/docker-compose.prod.yml` |

## Non-goals

- **Kubernetes.** Too heavy for this use case. App Platform covers 99% of scaling needs.
- **GraphQL / tRPC.** REST is fine, lets federated clients (non-CommonPub) consume it too.
- **Fedify migration.** Already covered above — not recommended.
- **Event-sourcing refactor.** `activities` is as event-sourced as this needs to be.
