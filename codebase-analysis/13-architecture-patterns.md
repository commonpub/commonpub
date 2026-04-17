# 13 — Architecture Patterns

What IS the best pattern for a site like CommonPub, given how it's set up?

This is the opinionated companion to
[`12-scaling-and-infrastructure.md`](./12-scaling-and-infrastructure.md).
Read that first for current-state + horizontal-scaling decisions. This doc
is about per-route rendering patterns, caching, and how to think about
each page class.

## What kind of site is CommonPub?

The right pattern depends on the shape of the workload. CommonPub is:

- **Content-heavy** — long-form articles, projects, build logs, docs,
  learning paths. Most pages are public and SEO-sensitive.
- **Federated** — content flows in from other instances via ActivityPub.
  Local state mutates when remote activities arrive.
- **Social-adjacent** — comments, hub posts, polls, messages. Writes are
  bursty (someone publishes something → fanout).
- **Real-time adjacent** — notifications, unread counters. Not chat-level
  frequency; pull-based polling or simple SSE is fine.
- **Read-dominated** — 100:1 read-to-write is a reasonable default
  assumption for content sites.
- **Self-hosted, multi-tenant-like** — every instance is its own deploy.
  No shared infrastructure, so "scale" means "scale ONE instance".

Key implication: the architecture needs to stay **simple enough for a
$12 droplet** (commonpub.io today) while being **composable for App Platform
auto-scale** when an instance grows. No assumption of Kubernetes,
microservices, or a dedicated ops team.

## Rendering pattern per route class

This is the sharpest decision. Nuxt 3 supports SSR, SPA, SSG, ISR, and
SWR out of the box. Use them deliberately.

### The matrix

| Route class | Example | Pattern | Cache | Why |
|---|---|---|---|---|
| **Truly static** | `/about`, `/privacy`, `/terms`, `/cookies` | Prerender at build (`prerender: true`) | forever | No data fetch; ship as HTML |
| **Public content list** | `/`, `/[type]`, `/docs`, `/hubs`, `/learn`, `/contests`, `/events`, `/videos`, `/explore` | SSR + `swr: 60` | 60s stale | Fresh enough; big CPU savings |
| **Public content detail** | `/u/:user/:type/:slug`, `/hubs/:slug`, `/docs/:site/:page`, `/learn/:slug/:lesson` | SSR + `swr: 60` | 60s stale | Same — most hits are readers |
| **Search / trending** | `/search`, `/search/trending` | SSR (no cache) | none | Query-param-keyed, cache would bloat |
| **Feed (auth-dependent)** | `/feed` | SSR user-scoped | none | Personalized; cache key would need userId |
| **Dashboard, settings** | `/dashboard`, `/settings/**`, `/admin/**` | SSR + auth guard | none | Personalized, auth-gated |
| **Realtime** | `/messages`, `/messages/:id`, `/notifications` | SSR shell + SSE for updates | none | SSE stream for push, initial HTML SSRed |
| **Legal redirects** | `/article/*` → `/blog/*` | Server middleware 301 | indef | Already implemented |
| **AP federation** | `/users/:name/inbox`, `/.well-known/*` | Server route (JSON-LD) | per-spec | No page render; protocol |

### Key rules learned the hard way

1. **Never `prerender: true` on data-fetching routes.** Docker build has
   no DB. Prerender crashes silently → 500 HTML ships. Was the cause of
   the long-running `/docs` 500 bug fixed in session 126. Use `swr: N`
   instead — renders at runtime with real DB, caches result.

2. **Never mix user state into cached HTML.** If `/blog` SSRs with
   `isAuthenticated ? 'New post' : 'Sign in'`, caching bakes one user's
   view for everyone. Instead: SSR the public view, hydrate auth on
   client, overlay personalization (e.g. "Create" button) in the client
   render. CommonPub already does this in most places via `useAuth()`
   hydration — just don't break it by putting auth conditionals in the
   critical SSR path of cacheable pages.

3. **`useLazyFetch` for below-the-fold data.** SSR-blocks only on what's
   visible in the first paint. Content lists below the hero can be
   lazy-fetched client-side.

4. **Disable `crawlLinks` during prerender** (done in session 126). If
   a single prerendered route fails, the crawler can cascade failures
   to linked routes. Explicit is safer than auto-discovered.

### Applying this to CommonPub today

Current state (session 126):
- Only truly static pages are not prerendered (they SSR on every hit).
- Content lists/details SSR on every hit with no caching.
- `/docs/**` was prerendered at build and broke — now also SSRs live.

Suggested next step (not yet applied): add `swr` to the hot public routes.

```ts
// layers/base/nuxt.config.ts
routeRules: {
  // Truly static — prerender at build
  '/about': { prerender: true },
  '/privacy': { prerender: true },
  '/terms': { prerender: true },
  '/cookies': { prerender: true },

  // Public content — stale-while-revalidate at runtime (with real DB)
  '/': { swr: 30 },
  '/[type]': { swr: 30 },
  '/docs': { swr: 60 },
  '/docs/**': { swr: 60 },  // NOT prerender — see gotcha above
  '/hubs': { swr: 30 },
  '/hubs/**': { swr: 30 },
  '/learn': { swr: 60 },
  '/learn/**': { swr: 60 },
  '/contests': { swr: 30 },
  '/events': { swr: 30 },
  '/videos': { swr: 30 },
  '/explore': { swr: 30 },
  '/u/**': { swr: 60 },

  // Search — no cache (query-param-keyed)
  '/search': { ssr: true },

  // Personalized / authed — no cache
  '/feed': { ssr: true },
  '/dashboard': { ssr: true },
  '/settings/**': { ssr: true },
  '/admin/**': { ssr: true },
  '/messages': { ssr: true },
  '/messages/**': { ssr: true },
  '/notifications': { ssr: true },
}
```

Caveat: CommonPub's current pages render auth-dependent markup (NuxtLink
"Create" buttons inside main SSR template). Applying `swr: 30` to /docs
today would cache the first user's view. Two options:

A. **Extract auth conditionals into client-only components.** For each
   cacheable page, wrap auth-gated elements in `<ClientOnly>` so SSR
   renders a single public version and the client hydrates the
   personalization.

B. **Cache-Vary on auth cookie.** More complex; most CDNs support it
   but Nitro's `swr` doesn't natively. Skip.

Recommended: go through the hot public pages and wrap auth-conditional
UI in `<ClientOnly>`. Then enable `swr`. Significant read-latency win.

## Queue / federation pattern

The right queue for CommonPub is NOT BullMQ, NOT Redis, NOT RabbitMQ.
It's **Postgres `activities` table + LISTEN/NOTIFY**. Here's why:

| Option | Setup cost | Runtime cost | Durability | Multi-worker safety | Fit |
|---|---|---|---|---|---|
| Current: setInterval poll | 0 | 1 SELECT/30s | ✓ (DB) | ✓ (advisory lock) | Works for <1k/day |
| Postgres LISTEN/NOTIFY | ~50 LOC | 1 LISTEN conn + NOTIFY on insert | ✓ | ✓ (advisory lock) | **Sweet spot** |
| BullMQ (Redis) | new package + worker process + ops | Redis roundtrip per job | ✗ (unless Redis persistence) | ✓ | Over-engineered for this |
| External queue (SQS) | vendor lock | network + cost | ✓ | ✓ | Over-engineered |

The Postgres table is already the source of truth (dead-letter, retry
count, lock timestamp). LISTEN/NOTIFY just turns the setInterval into an
event-driven wake-up. ~50 lines:

```ts
// packages/server/src/federation/delivery.ts
// After a batch, wait for next NOTIFY instead of setTimeout
await db.execute(sql`LISTEN activities_new`);
await new Promise<void>((resolve) => {
  const handler = () => { /* unlock */ resolve(); };
  client.on('notification', handler);
  setTimeout(() => { client.off('notification', handler); resolve(); }, MAX_WAIT_MS);
});

// And on any INSERT INTO activities: NOTIFY activities_new
```

Only go to BullMQ when:
- >10k deliveries/day making the polling noisy, OR
- Multi-instance web tier + you want centralized queue state, OR
- Queue management UI matters enough to pay the BullMQ tax.

## Caching pattern

### What to cache, where

| Layer | What | Lifetime |
|---|---|---|
| CDN (Caddy cache / Cloudflare) | Static JS, CSS, images, fonts | 1 year (immutable hash filenames) |
| CDN | Uploaded content from `public/uploads` or DO Spaces | 1 day |
| Nitro `swr` | Rendered HTML of public content routes | 30–60s |
| Nitro `cachedEventHandler` | Hot API responses (feeds, hub lists) | 30s, if contention matters |
| Better Auth session lookup | Nothing — Postgres is fast enough | — |
| User profile / settings | Nothing — Postgres is fast enough | — |
| Denormalized counters | Already in DB (viewCount, voteScore, etc.) | — |

### What NOT to cache (premature)

- User sessions in Redis. Better Auth's Postgres storage is durable and
  fast.
- Content in Redis. Postgres is already fast with indexes.
- Individual API responses in application memory. Cache invalidation is
  hard; skip.

### Asset serving

Images are the biggest outbound bandwidth. Today Nitro serves from
`public/uploads` — OK for the first few thousand users. Pattern for
scale:

1. **DO Spaces (S3-compatible)** for original uploads.
   `@commonpub/infra` already has `S3StorageAdapter`; wire it via
   `S3_*` env vars.
2. **Spaces CDN edge** serves variants. Image processing happens on
   first request, results stored in Spaces.
3. **Nitro serves HTML only**, never binary.

## Federation pattern

Already the right pattern:

- **Pure-TS protocol** (`@commonpub/protocol`) — hardened, no framework
  dependency, no dyn. loading overhead. Don't migrate to Fedify; see
  12-scaling-and-infrastructure.md.
- **`activities` Postgres table** as durable queue (above).
- **HTTP Signatures via `jose`** — standard crypto, no exotic deps.
- **`cpub:` namespace extensions** preserve CommonPub fidelity while
  falling back to AS2 standard for non-CommonPub instances.
- **Per-hub Group actors** (FEP-1b12) — correct for federated communities.
- **Signed backfill** — handles protected outboxes.

Future work already scoped in 12-scaling:
- Move delivery worker to separate process when it stops fitting in web
  instance CPU budget.
- Postgres LISTEN/NOTIFY to reduce polling.

## Horizontal scaling pattern

Single-instance Nitro works to meaningful scale. The migration to
multi-instance is:

1. **Add managed Postgres** (DO Managed DB) — commonpub.io still
   self-hosts; deveco.io already done.
2. **Add managed Redis** — ONLY for rate limits and SSE pub/sub. Not
   caching, not queue (yet). See scaling doc for code refactor.
3. **App Platform auto-scale** — min 2, max N by CPU. Requires the
   Redis step first or counters/streams break.
4. **Delivery worker process** — split out of web tier when CPU budget
   squeezed.
5. **CDN + Spaces** — offload images.

Phases 1–2 unblock web-tier horizontal scale. Phase 4 unblocks
federation throughput scale. These are orthogonal axes.

## Data mutation pattern

Things CommonPub gets right that you should keep:

- **Single SQL transaction per mutation with correctness needs.**
  `voteOnPost`, `rsvpEvent`, `cancelRsvp`, `joinHub` all use
  `db.transaction(async tx => ...)`. Don't break this.
- **Denormalized counters updated in-transaction** (voteScore,
  attendeeCount, memberCount, postCount). Reads are free.
- **Hooks fire AFTER transaction commits.** `emitHook('content:published',
  ...)` runs after `await publishContent()` returns. Subscribers don't
  see uncommitted state, don't roll back writes either. Keep this
  boundary.
- **Soft delete via `deletedAt`** on users, content, hubs, federatedContent.
  Preserves foreign-key integrity; audit-friendly.
- **Polymorphic targets for likes/comments/bookmarks/reports** via
  `(targetType, targetId)`. Keeps the social module small.

Where you can improve:

- **Add `unique(eventId, userId)` to `eventAttendees`.** Server dedup
  is the only thing preventing duplicate RSVPs in a race.
- **Add the `federatedContent.mirrorId` FK.** Currently app-enforced.

## Realtime pattern

CommonPub's SSE is the right choice:

- One endpoint (`/api/realtime/stream`) streams notification + message
  counts. Don't fragment per-feature.
- Falls back cleanly if client disconnects.
- No WebSocket complexity.

Change needed for multi-instance:

- Current per-connection polling → Redis pub/sub fanout. See scaling
  doc. Single-instance today works.

Don't build anything more elaborate (e.g., Phoenix channels, Pusher,
Ably) unless the workload demands it. This is NOT a chat app.

## Publishing / plugin pattern

Already in good shape:

- **12 composable packages** — each has a clean surface, pnpm publish
  flow, peer dep boundaries.
- **Layer as distribution unit** — consumers extend via
  `extends: ['@commonpub/layer']`. Keep this. DO NOT publish UI and
  layer separately — version skew headache.
- **Feature flags gate every non-core feature** — keep it. Rule is
  enforced by CLAUDE.md #2.

Consider for v1.1:

- **Hooks bus emitted events should be documented** as a public API
  for consumer apps. Today only `search-index.ts` uses `onHook()` —
  make it easier for consumers to extend.
- **NavItem / Homepage section schemas exported from `@commonpub/config`**
  so consumer apps can configure via TS, not just DB.

## What to avoid

Concrete anti-patterns for this site class:

- **GraphQL** — REST + typed server functions work fine here, and
  federated clients (Mastodon, Lemmy) consume REST / AP.
- **Microservices** — a single Nitro process is fine to meaningful
  scale. Splits when you have a reason (e.g. delivery worker CPU
  pressure), not prophylactically.
- **Edge runtime (Cloudflare Workers)** — Nitro supports it but the
  Postgres roundtrip kills the edge benefit. Stay with node-server.
- **Event sourcing / CQRS** — the `activities` table is event-sourced
  enough for federation; content is mutable CRUD and shouldn't be
  force-fit.
- **Kubernetes** — too heavy. DO App Platform or plain Droplets +
  Caddy are enough.
- **Prerender at build for data-fetching routes** — already burned us.
  See gotcha in 09-gotchas-and-invariants.md.

## TL;DR recommended architecture

For a CommonPub instance anywhere on the size spectrum:

```
Routing:          SSR for auth/personalized pages; SWR for public content
Queue:            Postgres activities + LISTEN/NOTIFY
Cache layer:      CDN (Spaces / Cloudflare) for assets + Nitro SWR for HTML
DB:               Managed Postgres; read replica only at serious scale
Redis:            Add only for rate limits + SSE pub/sub when you go multi-instance
Search:           Meilisearch single node until search volume demands cluster
Federation:       Pure-TS protocol (don't migrate to Fedify)
Delivery:         setInterval+activities table now; LISTEN/NOTIFY at 10k/day;
                  separate worker process at CPU pressure
Realtime:         SSE only; Redis pub/sub for multi-instance fanout
Deployment:       Single Droplet → DO App Platform with Managed PG + Redis
Assets:           Nitro today; DO Spaces + CDN when bandwidth matters
```

Each step only unlocks when there's a measurable reason. Build the
complexity ladder, don't pre-climb it.
