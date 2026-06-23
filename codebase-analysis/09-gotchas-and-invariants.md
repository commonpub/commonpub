# 09 — Gotchas & Invariants

Hard-won knowledge. These are non-obvious from reading the code — they bit
someone in production. If you break one, something silent will go wrong later.

## Theme / CSS

### Corner radius is applied per-surface, with a structural reset (session 193)

`packages/ui/theme/base.css` sets `* { border-radius: var(--radius) }` so every
surface inherits the theme's radius, BUT a following rule resets structural,
media, and pseudo elements to 0 (`hr, svg, img, picture, video, canvas, iframe,
table internals, ::before/::after/::marker/::placeholder, .cpub-divider`). This
exists because the old `*, *::before, *::after { border-radius }` rounded line
breaks/dividers/icons/table cells on non-zero-radius themes (Stoa = 12px) — the
"rounded line breaks" bug. If you add an element that must stay sharp on a
rounded theme, add it to that reset list; a new element that should round is
covered by `*` automatically. Class-level radius (avatars' `--radius-full`)
outranks the reset. KNOWN-LATENT: inner `<div>` sections inside `overflow:hidden`
rounded containers still get wedge-gaps — the full per-component radius migration
is a follow-up. Guard: `packages/ui/src/__tests__/radius-model.test.ts`.

## Build & publish

### `pnpm publish`, never `npm publish`

pnpm resolves workspace dependencies correctly; npm does not. Publishing with
npm leaves `workspace:*` strings in the published package.json, which then fail
to install from the registry.

### Verify dist/ exports before publishing

After `pnpm build`, look inside `packages/<name>/dist/` and confirm the public
API you expect is present and typed. Past regression: a `tsconfig` change caused
`createCommonPubEditor` to vanish from `dist/index.d.ts` — all consumers broke
on install.

### `pnpm update` touches both package.json AND lockfile

If you run `pnpm update @commonpub/layer` in a consumer repo, the lockfile
changes too. Commit both. CI installs from lockfile, so dropping the lockfile
change means CI uses the OLD version while local works with the new.

### Caret semver on 0.x.y excludes minor bumps (session 156-157)

`^0.21.22` resolves to `>=0.21.22 <0.22.0` — caret on 0.x.y treats minor
bumps as breaking. **`pnpm update <pkg>` silently won't cross the 0.21 →
0.22 boundary.** Manually edit `package.json` to `^0.22.0` and re-run
`pnpm install`. Per-patch bumps (0.21.21 → 0.21.22) `pnpm update`
handles correctly; only the minor boundary trips. Caught twice in
session 156 when bumping the layer 0.21.22 → 0.22.0 on both deveco-io
and heatsynclabs-io. Memory: `feedback_caret_semver_0x_minor_bump.md`.

### vue-tsc strict mode catches what vitest+esbuild misses (sessions 156-157)

`pnpm test` in this repo runs vitest, which uses esbuild — permissive
about type-narrowing failures, generic factories, partial config
types, and DOM element narrowing. CI's `pnpm typecheck` runs
`vue-tsc --noEmit` (strict) and will fail what vitest passed.

Caught **3 times** before a pre-push hook was installed (session 157):
- `sections.test.ts` migration test cases with intermediate partial-type returns
- `mockConfig.ts` + `health.test.ts` literals missing a newly-added FeatureFlag field
- `AdminThemePreviewPane.test.ts` helpers typed `HTMLElement` but receiving `Element` from `querySelector`

**The hook** (session 157): `simple-git-hooks` installed as a devDep at
the root; `package.json` declares `"simple-git-hooks": { "pre-push":
"pnpm typecheck" }`; the root `prepare` script runs `simple-git-hooks
|| true` so `pnpm install` activates it on every dev machine. The hook
runs the root `pnpm typecheck` (turbo runs every package's typecheck
task in parallel, ~30s). **Bypass for emergencies**:
`SKIP_SIMPLE_GIT_HOOKS=1 git push`.

Memory: `feedback_vue_tsc_strict_vs_vitest.md`.

### pnpm 10.10.0 install can silently drop files from a published tarball (session 158)

A `pnpm install --frozen-lockfile` against a consumer repo's lockfile (deveco-io specifically) produced an INCOMPLETE install of `@commonpub/schema@0.17.0`: 76–77 of 80 dist files; the missing ones are `layout.{js,d.ts,js.map,d.ts.map}` AND the corresponding `export * from './layout.js'` line in `dist/index.js`. The published npm tarball IS complete (verified by fresh `npm pack` + integrity hash match) — the bug is on the install side.

**Symptom**: `SyntaxError: The requested module '@commonpub/schema' does not provide an export named 'layoutRows'` when any consumer code imports the layout tables. **Took deveco.io down during session 158.**

**Crucially**: heatsync-io was UNAFFECTED because its Dockerfile uses `npm install`, not `pnpm install`. commonpub.io unaffected because workspace mode bypasses install entirely. The bug is specific to the pnpm install path.

Reproduced cleanly in `node:22-alpine` containers across pnpm `10.10.0` AND `10.15.0`. Fresh `pnpm install` (no lockfile) → complete. `npm install` → complete. `pnpm install --frozen-lockfile` against deveco's old lockfile → incomplete.

**Workarounds, in order of preference**:
1. Bump the consumer's direct `@commonpub/schema` pin from `^0.16.0` to `^0.17.0` AND regenerate lockfile. The mixed-version state (top-level wanted 0.16.0, transitive deps wanted 0.17.0) seems to trigger pnpm's bug — pinning directly to 0.17.0 + fresh lockfile avoided it in our verify.
2. If that doesn't fix it: switch the consumer's Dockerfile from `pnpm install --frozen-lockfile` to `npm install` (heatsync's approach — known-good).
3. Long-term: file a pnpm bug with the reproducer; consider standardising consumer-site Dockerfiles on `npm install`.

**Pre-bump sanity check** — before pushing a deveco-style consumer-site pin bump, build the image and confirm the installed `@commonpub/schema` dist is COMPLETE. Don't hardcode a magic number — the count grows with the schema (it was ~80 at 0.17.0 / 18 src files; schema is now 0.45.0 / **24 src files**, so expect proportionally more). Compare against a fresh `npm pack` / non-frozen install of the SAME version, and verify `dist/index.js` actually `export *`s every domain module:
```sh
docker build -t verify .
docker run --rm --entrypoint sh verify -c 'ls /app/.output/server/node_modules/@commonpub/schema/dist | wc -l'
# Compare to: npm pack @commonpub/schema@<ver> && tar tzf *.tgz | grep dist/ | wc -l
# If the installed count is LOWER than the packed count, the install dropped files — DO NOT push the pin bump.
```

Memory: `feedback_pnpm_install_drops_files.md`.

### Copy dist to pnpm store after local server build

If you `pnpm build` in `packages/server/` and then run `pnpm typecheck` in a
consumer app that imports `@commonpub/server`, the consumer may still see the
old types. After building locally, copy to the pnpm store or run
`pnpm install --prefer-offline` in the consumer to refresh the symlink.

### Deploy workflow's health check warns instead of failing (session 158)

`deveco-io` + `heatsynclabs-io` deploy workflows have:
```sh
curl -sf http://localhost:3000/ || echo "::warning::Health check failed — app may not have started correctly"
```

`|| echo` swallows the curl failure — the SSH action returns 0 even when the container's crashing in a restart loop. `gh run list` reports the deploy as `success` with a yellow annotation. **NEVER trust `gh run list` deploy status — always `curl /api/health` after a push.** The fix on the workflow side is to change `|| echo` to `|| { echo "::error::..."; exit 1; }` so a bad container fails the run.

Memory: `feedback_deploy_health_check_warn_not_fail.md`.

## Database

### Drizzle migrator reads the journal — hand-writing the SQL alone is not enough (session 157)

Caught in deep audit: session 155 committed `0005_layout_engine.sql`
by hand (well-intentioned: align with the existing 0004-and-earlier
naming + structure pattern), but **didn't run `drizzle-kit generate`**
to update `migrations/meta/_journal.json` and `migrations/meta/0005_snapshot.json`.

`scripts/db-migrate.mjs` calls `drizzle-orm/node-postgres/migrator.migrate()`,
which **reads the journal** to know which migrations to apply. A SQL
file without a journal entry is invisible to it — the migration simply
won't run. The schema would "ship" but the tables would never get created.

**Always use `pnpm db:generate`** (drizzle-kit, hands-off) to create
new migrations. Don't hand-write SQL files. The drizzle-kit-generated
output is functionally identical for additive migrations AND keeps the
journal in sync.

If a hand-written file exists alongside a generated one (the session 155
→ 157 transition), DELETE the hand-written one and rely on the generated
file. Session 157's `127b86e` did exactly that. Memory: `project_session_157_hotfix_and_phase1_server`.

### Schema deploys via committed migrations, never `drizzle-kit push` (session 128)

Schema changes go through `pnpm --filter=@commonpub/schema db:generate` locally
and are committed as `packages/schema/migrations/000N_*.sql` files. On deploy,
`scripts/db-migrate.mjs` calls `drizzle-orm/node-postgres/migrator.migrate()`,
which applies any pending migrations and records state in
`drizzle.__drizzle_migrations`. No TTY prompts, no silent failures.

**Pre-session-128 history:** deploys ran `drizzle-kit push` via `scripts/db-push.mjs`.
This blocked in CI on populated-table constraint changes (the prompt checks
`process.stdin.isTTY`), and when it threw, ALL queued DDL got dropped. Multiple
weeks of silent drift accumulated — docs `sidebar_label`/`description` columns,
`api_keys`/`api_key_usage` tables, enum-type conversions on `instance_mirrors`,
and various FK/constraint renames. Fixed in session 128 along with a deep drift
audit on both prod DBs. See `docs/sessions/128-docs-and-learn-audit.md`.

**Do NOT** use `drizzle-kit push` in CI. Do NOT use `drizzle-kit migrate` either
(its `renderWithTask` spinner exits non-zero on success and swallows errors —
`scripts/db-migrate.mjs` uses the underlying `drizzle-orm` function instead).
`pnpm db:push` remains fine for local dev iteration against a dev DB.

### The baseline migration

`packages/schema/migrations/0000_session128_baseline.sql` is the captured
schema state as of 2026-04-17. It's been pre-recorded as applied on both
prod DBs in `drizzle.__drizzle_migrations`, so `migrate()` skips it on them
but will apply it cleanly to any fresh install.

### Postgres connection in containers

- commonpub.io postgres: `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- deveco.io (managed): `docker exec deveco-app-1 env | grep NUXT_DATABASE_URL`, then psql from host via `docker run --rm --network host postgres:16-alpine psql '<url>'`

## Scaling / multi-instance gotchas

### Rate limit store is ephemeral

`packages/infra/src/security.ts RateLimitStore` holds state in a `Map` in the
Nitro process. Consequences:

- Every deploy / restart resets all rate-limit counters.
- Multiple Nitro instances don't share counters — an attacker who splits
  requests across 2 instances effectively gets 2× the limit.

Before running a multi-instance web tier, swap in a Redis-backed store. See
[`12-scaling-and-infrastructure.md`](./12-scaling-and-infrastructure.md).

### SSE streams: event-driven via Redis when `NUXT_REDIS_URL` is set (since session 130)

`/api/realtime/stream` (notification + message counts) is event-driven
via `RealtimePubSub` (`packages/infra/src/realtime/`). Memory backend
(in-process EventEmitter) by default; Redis backend (`RedisRealtimePubSub`
with a dedicated subscriber client + auto-replay on reconnect) when
`NUXT_REDIS_URL` is set **AND `ioredis` is installed** (else it falls back
to memory). 30 s DB-poll retained as a safety net.

**Pre-session-130 (incorrect, but for historical context)**: the stream
only polled the DB — multi-instance deploys had a fanout gap (instance
A's notification wouldn't reach a user connected to instance B until
the 30 s poll). Session 130 fixed this.

### Federation delivery is setInterval-based

The delivery worker polls `activities` every `deliveryIntervalMs` (default
30s). Multi-instance workers are coordinated by **claim-based optimistic locking** on the `lockedAt` timestamp column (UPDATE-to-claim with a 5-min `LOCK_EXPIRY_MS` fallback — NOT a Postgres advisory lock),
so parallel workers are safe — but each one still runs its own SELECT. At
very high scale, prefer Postgres LISTEN/NOTIFY or BullMQ over blind polling.

### Redis: opt-in via `NUXT_REDIS_URL` (wired in session 130)

`docker-compose.yml` + `docker-compose.prod.yml` spin up a Redis
container. **Since session 130**, both `RateLimitStore` and
`RealtimePubSub` have Redis backends that activate when `NUXT_REDIS_URL`
is set — opt-in, so the env-var-unset default is byte-identical to
pre-130 single-process behavior. See `12-scaling-and-infrastructure.md`
for the flip procedure.

## Nuxt / Nitro

### New server imports can 404 in production

Nitro externalizes node_modules in prod builds. If you add a NEW import from
`@commonpub/server` to a Nitro API route and that export wasn't exercised
before, Nitro might not include it in the bundle. Symptom: route works locally
but returns 404 or "Cannot find module" on the deployed instance.

**Fix:** ensure the import is reachable through the root index; if it's from
a subpath, add it to `nitro.externals.inline` in nuxt.config.

### `server/routes/foo.ts` returning undefined sends 204 — not fall-through

When you want "AP response for AP Accept headers, Nuxt page for browsers" at
the SAME canonical URL, you MUST put the handler in `server/middleware/`, not
`server/routes/`. In h3/Nitro:

- Server ROUTES are terminal handlers. Returning `undefined` finalizes the
  response as HTTP 204 with an empty body. The Nuxt page renderer never runs.
- Server MIDDLEWARE runs before the route/page handlers. Returning `undefined`
  passes control to the next handler — including the Nuxt page renderer.

This caused the session 127 regression: `/hubs/:slug` and `/hubs/:slug/posts/:postId`
both had AP actor/note endpoints defined in `server/routes/` with conditional
content negotiation (`if (!isAPRequest) return;`). The return-undefined path
sent 204 for every browser request — every hub detail page looked broken on
refresh.

Fix: moved to `server/middleware/hub-ap.ts` and `server/middleware/hub-post-ap.ts`.
Since middleware runs for every request, they also need to match the path
pattern explicitly (the old server-route file was scoped to `/hubs/:slug` by its
filename — middleware needs a regex check on `getRequestURL(event).pathname`).

Look at `server/middleware/content-ap.ts` for the canonical pattern; its
docstring explicitly warns about this rule.

Applies to: any AP endpoint whose URL matches a Nuxt page. Sub-paths like
`/hubs/:slug/outbox`, `/hubs/:slug/followers` have no Nuxt page, so their
server/routes files are fine.

### `useState(key, initializer)` only runs the initializer once per request — multiple callers with the same key must agree

Nuxt's `useState(key, initializer)` only runs `initializer` the FIRST time a
given key is seen per request. Every later call with the same key returns
the already-created state, regardless of what initializer they pass.

Consequence: if two different call sites both do `useState('foo', ...)` with
DIFFERENT initializers, whichever runs first wins. The other's initializer
is silently ignored.

**This caused a long-running SSR 500 bug in session 126:**

`layers/base/middleware/feature-gate.global.ts` was calling:

```ts
const featureState = useState<FeatureFlags | null>('feature-flags', () => null);
```

This poisoned the shared `feature-flags` state to `null`. When the default
layout later called `useFeatures()` with its own
`() => ({...DEFAULT_FLAGS, ...buildFlags})` initializer, Nuxt returned the
existing null state — the proper initializer never ran. The layout then
evaluated `computed(() => flags.value.content)` → `null.content` → 500.

The bug only surfaced on routes in `ROUTE_FEATURE_MAP` (`/docs`, `/learn`,
`/videos`, `/explainer`) because only those triggered the feature-gate
middleware to run first and poison the state. `/hubs`, `/blog`, `/project`,
`/u/...` all worked because feature-gate never matched → useState never
called with the null initializer → useFeatures() initialized the state
correctly. `/admin` worked because its page-level auth middleware
redirected before the layout rendered.

**Fix pattern**: export ONE shared initializer function and use it from every
call site that touches the same useState key.

```ts
// composables/useFeatures.ts
export function getInitialFlags(): FeatureFlags {
  const config = useRuntimeConfig();
  return { ...DEFAULT_FLAGS, ...(config.public.features as Partial<FeatureFlags>) };
}
export function useFeatures() {
  const flags = useState<FeatureFlags>('feature-flags', getInitialFlags);
  if (flags.value == null) flags.value = getInitialFlags();  // defensive
  ...
}

// middleware/feature-gate.global.ts
import { getInitialFlags, type FeatureFlags } from '../composables/useFeatures';
// ...
const flags = useState<FeatureFlags>('feature-flags', getInitialFlags);
```

Now whichever runs first, the state is valid.

### Never use `prerender: true` on routes that fetch from `/api/*`

The Docker build stage in `Dockerfile` runs `pnpm build` with **no database
available** (DB is a separate service in docker-compose, not reachable
during image build). If a Nuxt `routeRules` entry sets `prerender: true`
on a data-fetching route, the prerenderer:

1. Spins up a temporary server
2. Calls the page's `useFetch('/api/...')`
3. The API queries the DB, which fails
4. Nitro saves the ERROR HTML as the prerendered output
5. **Production serves the pre-baked 500 for every request to that route**
6. Because `crawlLinks: true` is default, the failure propagates to every
   linked page reachable from the initial prerender target — so setting
   `/docs/**: prerender: true` silently breaks `/learn` and `/videos` too
   if their nav links are discovered during the crawl.

This was the root cause of the long-running commonpub.io 500-on-refresh
bug (session 126). Fix: removed the `/docs/**` rule entirely.

If you need caching, use `swr: 60` (stale-while-revalidate at runtime)
or `isr: true` — these render at runtime with real DB, then cache. NEVER
use `prerender: true` for a page that fetches content.

### `server/utils/config.ts` is the Nitro-side config resolver

Every CommonPub instance ships this file. It's NOT a trivial re-export — it
merges three layers (highest wins):

1. **DB overrides** — `instanceSettings.features.overrides` (runtime, admin-editable, cached 60s)
2. **Env vars** — `FEATURE_*` env bool parsing
3. **Build-time** — `commonpub.config.ts` defaults

Server handlers import from `~/server/utils/config` (not directly from
`~/commonpub.config`) so that env and DB overrides are respected. Removing it
breaks admin feature-flag overrides and env-based per-deploy flag flipping.
See `apps/reference/server/utils/config.ts` as the canonical example.

### useLazyFetch races with Suspense

Session 124 hit a race where `useFetch` inside a component wrapped in Suspense
fired on the server but the component rendered with stale data. Use
`useLazyFetch` for non-blocking client-side fetches inside Suspense boundaries.

## Federation

### No federation before two instances with real content

Standing rule. Don't enable `federation: true` on a dev instance if you have
nothing to federate. Federation delivery worker will poll forever with nothing
to do; logs get spammy.

### Schema-level changes = federation wire change

If you change `cpubType`, `cpubBlocks`, or how BlockTuple maps to AP objects,
you're changing the wire format. Instances on different versions may not
interop fully. Version the content mapper if you have to break wire compat.

### AP Actor SSO = Model B only

Shared auth DB = Model C. Operator opt-in only, strongly discouraged unless
you control every instance. Default path is Model B: WebFinger → OAuth2 token
exchange between instances.

### Signed backfill required for protected outboxes

Session 119 hardened backfill to use HTTP Signatures when fetching outbox
pages from instances that require it. If you're testing against a new
instance and backfill returns 401, check that your instance keypair is
registered.

## Content & schema

### The schema IS the work

Standing rule. Every feature starts by adding the right tables/columns. Then
validators, then server functions, then API routes, then UI. Don't build UI
against imaginary tables.

### No feature without a flag

Every new feature lives behind a flag in `commonpub.config.ts`. No exceptions.

### `federatedContent.mirrorId` FK — added in migration 0002

Migration `0002_session130_constraints` added an FK from `mirror_id` to
`instance_mirrors(id)` with `ON DELETE SET NULL`. The migration nulls any
orphan references first, then enforces. Before that the reference was
app-level only.

### Article type is legacy — use blog or project

`contentTypeEnum` still has `article` for backwards compat, but the system
normalizes to `blog`. New code should use `blog`, `project`, or `explainer`.

### Events attendees — UNIQUE(eventId, userId) — added in migration 0002

`event_attendees` gained a UNIQUE on `(event_id, user_id)` in migration
`0002_session130_constraints`. `rsvpEvent` uses `ON CONFLICT DO NOTHING`
so a racing duplicate falls through to the "already registered" response
path, not a 500. Before that, duplicates were possible on fast double-clicks.

## Security

### The actor outbox is a PROJECTION over published+public content — not the activities queue (session 183)

`/actor/outbox` (instance) and `/users/:u/outbox` are built from `content_items WHERE status='published' AND visibility='public'` (`outboxQueries.ts`), NOT from the `activities` delivery queue. Two invariants:

1. **Must gate `visibility='public'`.** The outbox is publicly crawlable, so members-only/private content must never appear. `federateContent`/`federateUpdate` apply the same gate (they previously gated only `status`, a latent outbound leak). If you add a new outbox/content-federation path, replicate `status='published' AND visibility='public'`.
2. **Don't "fix" the old empty-outbox bug by marking activities delivered early.** The delivery worker polls `status='pending'`; inserting Creates as `delivered` would starve it. The outbox draws from content, the queue stays the delivery ledger. (The pre-183 bug: outbox was `status='delivered'`-filtered, so anything published before a mirror followed was invisible forever → backfill got nothing. heatsync showed 2 of 8 posts.)

The projected Create uses a DETERMINISTIC id (`<object id>#create`) + the real `published` date (protocol `contentToCreateActivity`), shared with live delivery so backfill and delivery emit the same de-dupable activity, and so bounded backfill can paginate by date. Mirroring/backfill/refederate are all bounded by operator choice (forward-only default; `since`/`maxItems`/`limit`) — never auto-pull or re-blast an entire instance.

### Inbox: the activity `actor` MUST be bound to the HTTP-signature signer (session 187 audit)

`verifyInboxRequest` proves the SIGNER (keyId actor, with keyId-host == actor.id-host), but
`processInboxActivity` trusts the JSON `body.actor` — which is NOT the same thing. Without binding,
a validly-signed request from instance X can carry `actor: https://victim/actor` and be processed
as the victim: spoofed mirror requests/Accepts (Phase 3), federated content attributed to others,
like/boost tampering. The fix is `assertActorMatchesSigner(actorUri, body, label)` in `utils/inbox.ts`,
called in ALL THREE inbox routes (shared `routes/inbox.ts`, `routes/users/[username]/inbox.ts`,
`routes/hubs/[slug]/inbox.ts`) right after `verifyInboxRequest` — it 401s when `body.actor`'s host ≠
the signer's host. CommonPub/Mastodon sign with the actor's own key (no relays/LD-sig forwarding),
so host equality is the correct binding. **Any new inbox route MUST call it** — the handlers trust
`body.actor`, so the route is the only place the signer↔actor binding is enforced.

### Registry pings: signature proves identity, stats are PULLED not trusted (Phase 4, session 186)

`POST /api/registry/ping` is gated `actAsRegistry` and verified by `verifyInboxRequest` — the keyId domain must match the resolved actor, so a domain can **only register itself** (no impersonation). The registry derives the domain from the *verified* actor, NOT the request body. Stats (user/post counts, features, software) are **pulled from the pinger's public NodeInfo** (`fetchInstanceNodeInfo`) — never read from the ping body — and that pull is SSRF-guarded AND requires the 2.1 `href` to be on the same host (a registered instance can't point the registry's fetch at an arbitrary URL). Abuse: global IP rate-limit (middleware) handles pre-verification floods; a per-source-domain limit handles verified spam; admin `blocked` status is a no-op short-circuit that persists across re-pings. `recordRegistryPing`'s upsert does NOT reset `status`, so an admin `hidden` choice survives every re-ping (only a brand-new row starts `active` = the auto-list decision). `announceToRegistry` is a SEPARATE flag from `actAsRegistry` — turning on federation never phones home; the heartbeat worker also skips when the registry domain == our own.

### Well-known response headers are number-typed in h3 (consumer-strict typecheck)

`setResponseHeader(event, 'Retry-After', n)` — h3 types well-known headers like `Retry-After` as `number`, so passing `String(n)` red-CIs the reference app's `nuxt typecheck` (TS2345 string→number) even though custom `X-RateLimit-*` headers accept strings. The layer's own vitest doesn't catch it; the reference app does. Same class as `feedback_layer_source_consumer_typecheck` — always run the full `pnpm typecheck` (incl. reference) before declaring a layer route done.

### "Push" mirror = consent-based request, NOT a mirror row (Phase 3, session 185)

`createMirror` is **pull-only and throws on `direction:'push'`** — push is a *request* to be mirrored, not a subscription you operate. Use `requestMirror()`, which writes a `mirror_requests` row (NOT `instance_mirrors`) and sends an AP `Offer(Follow)` carrying a `cpub:mirrorRequest:true` marker. Invariants:

1. **One unified `mirror_requests` table, both directions.** `direction` = `incoming` (someone asked us) | `outgoing` (we asked them); `unique(direction, remote_domain)` so a re-request upserts. `instance_mirrors` stays pull-only — don't reintroduce push rows there (it overloads `mirrorStatusEnum` and collides with `unique(remote_domain)`).
2. **Only ONE new inbound dispatch branch.** `processInboxActivity` routes `Offer` → `onMirrorRequest` *only* when the cpub marker + inner `Follow` are present (else `Unsupported` → non-CommonPub instances ignore it). Approve replies `Accept(Offer)`, reject replies `Reject(Offer)`; `onAccept`/`onReject` are *extended* (not new callbacks) to flip the requester's outgoing request, correlated by the stored `offerActivityUri`. `Offer` routes like `Follow` in `delivery.ts` (to the target actor's inbox).
3. **Approve reuses the loop-guarded pull path.** `approveMirrorRequest` calls `createMirror(pull)` (idempotent — reuses an existing mirror for that domain) + optional bounded backfill; it does NOT auto-pull history unless a depth is chosen. Content then flows over the normal Create → `matchMirrorForContent` path. No reverse-Follow loop: the requester never follows the approver's content.

### Public API serializers are ALLOW-lists, never deny-lists

`/api/public/v1/*` responses go through `to*` helpers in
`packages/server/src/publicApi/serializers.ts` — `toPublicUser`,
`toPublicContentSummary`, `toPublicHub`, etc. These helpers construct the
output object field-by-field. Any column added to the underlying DB table is
EXCLUDED from the public API until someone edits the serializer.

This is the core "no private data leaks" guarantee. Do NOT "spread" the row
(`{ ...row }`) into the response — spread serializers leak every new column
until someone remembers to remove it. The integration tests under
`publicApi.test.ts` serialize the output to JSON and assert that known-private
field names (`email`, `passwordHash`, `role`, etc.) never appear.

If you add a new entity to the public API, write its serializer with explicit
per-field copy. The cost is a few extra lines per field; the safety property
is structural, not vigilance-dependent.

### Every v-html in @commonpub/explainer must go through sanitizeHtml()

Explainer modules are user-authored and federate. Each `v-html="..."` must
wrap with `sanitizeHtml(...)` from `packages/explainer/vue/utils/sanitize.ts`
at the render site, regardless of whether ingest also sanitizes. Session 127
found `modules/clickable-cards/Viewer.vue` (`card.detail`) and
`modules/toggle/Viewer.vue` (`descriptionA/B`) both rendering raw HTML — a
stored-XSS vector any registered user could exploit, and any remote instance
could push via federation. `SectionRenderer`, `ConclusionRenderer`,
`BlockRenderer`, and the per-block viewers are the canonical pattern to
follow.

**Audit rule**: `grep -rn 'v-html=' packages/explainer/` — every hit should
also have `sanitizeHtml(` somewhere visible in the same `<script setup>`.

### No hardcoded colors or fonts

Standing rule. Every color/font in `@commonpub/ui` and `@commonpub/docs`
components must be `var(--*)`. Session 096 did a 698-instance migration from
hardcoded `border: 2px solid` to `var(--border-width-default)`.

### Theme must re-apply in error.vue

Error pages render outside the normal layout tree on SSR, so the `data-theme`
attribute is missing. `error.vue` re-calls `useHead({ htmlAttrs })` using a
`useState<string>('cpub-theme', ...)` — don't remove it.

### Custom-theme inline style ships via SSR — must not be `@layer`-wrapped (session 154)

The theme editor stores custom theme tokens in `instance_settings.theme.custom`
as a JSON array. The SSR middleware reads that, merges in any `theme.token_overrides`,
serializes via `tokensToCss(':root', tokens)`, and the client plugin injects
the result as `<style id="cpub-theme-inline">` via `useHead({ style: [...] })`.

The injected style is intentionally NOT wrapped in `@layer commonpub` so it sits
at the highest cascade tier and beats the layer's CSS files without needing
`!important`. If a future refactor moves the injection inside a layer, custom
themes will silently stop overriding base.css. See `feedback_css_layer_specificity.md`.

### `CUSTOM_THEME_PREFIX` is duplicated in server + client (session 154)

`packages/server/src/theme.ts` and `layers/base/utils/themeIds.ts` both export
`CUSTOM_THEME_PREFIX = 'cpub-custom-'` + a matching `parseCustomThemeId`.
The duplication is necessary — the server module imports drizzle + schema and
isn't browser-safe. Both files note the contract; the round-trip is pinned by
`custom-themes.integration.test.ts`. If you change the prefix, change both.

### `tokensToCss` escaping is defense-in-depth — admins are still the only writers (session 154)

`packages/ui/src/theme.ts:tokensToCss` strips disallowed chars from token
keys, drops keys that sanitise to empty, removes CR/LF from values, and
escapes `</` so the injected `<style>` block can't be terminated early.
This is hardening, not the primary defence — only admins (who already have
arbitrary site control) can write tokens. Tests live in
`packages/ui/src/__tests__/tokens.test.ts` (`tokensToCss > escapes </`).

### `theme/` in `.gitignore` must be `/theme/`-anchored (session 154)

`layers/base/.gitignore` ignores `theme/` because the layer's publish step
copies bundled theme CSS into `./theme/`. **The pattern MUST be `/theme/`**
(leading slash) — without it, git also ignores `components/admin/theme/`,
`pages/admin/theme/`, and any future `theme/` subdirectory. This bit session
154 silently until `git status --untracked-files=all` was used to confirm
new files were tracked.

### Federated UI must reuse local components

When you're rendering federated content, use the SAME components as for local
content — not a parallel federation-only component tree. Session 122 found
several duplicated federation components that had drifted from their local
counterparts.

## CSS / Vue

### `display: flex` on a class used by both `<img>` and `<div>` drops `object-fit` silently (session 158)

If a CSS class is applied to both an `<img>` (replaced element) AND a `<div>` (e.g. `.cpub-av` used for avatar photo OR initials fallback), do NOT set `display: flex` (or its centering buddies `align-items`/`justify-content`) on the shared base class. On the `<img>` variant, Chromium silently drops the inline `object-fit: cover` when `display: flex` is also applied — so a portrait avatar (e.g. 816×1456) gets stretched into the box dimensions instead of center-cropped. User-visible squish on every author photo where the source isn't square. Reported on deveco.io blog pages.

**Fix pattern**:
```css
.avatar { width: 44px; height: 44px; border-radius: 50%; }
div.avatar { display: flex; align-items: center; justify-content: center; }
img.avatar { object-fit: cover; }
```

Applied to `ArticleView.vue` + `ProjectView.vue` in layer 0.23.2 (session 158).
Memory: `feedback_display_flex_on_img.md`.

### Universal radius + prose-style leaks into shared selectors

See memories `feedback_universal_radius_leak.md` + `feedback_prose_style_leak.md`. base.css universal `*,::before,::after{border-radius:var(--radius)}` rounds every inner section of every block component (invisible on `--radius:0` themes; visible wedge gaps on deveco's `--radius:6px`). Likewise `.cpub-prose` global rules on bare `pre`/`th`/`blockquote`/`hr` leak into scoped block components for any property the scoped CSS doesn't redeclare.

## Git / commits

### Never add Claude as co-author

No `Co-Authored-By`, `Signed-off-by`, or any AI attribution in any commit,
in any CommonPub-related repo.

## Testing

### PGlite can't do X (3 skipped tests)

Three integration tests are skipped because PGlite (the in-process Postgres)
doesn't support specific SQL they exercise: 2 in `hub.integration.test.ts`
(`ON CONFLICT … DO NOTHING … RETURNING`) and 1 in `messaging.integration.test.ts`
(`JSONB @> with jsonb_array_length`). Running against a real Postgres makes them
pass. Don't "fix" them by rewriting against the in-process engine.

### Stryker mutation runs are slow

`pnpm stryker` across all packages takes >30 min. Use the per-package targets
(`stryker:server`, `stryker:schema`, etc.) unless you're doing a full audit.

## Deployment

### commonpub.io auto-deploys from main

Push to main → GitHub Actions → DigitalOcean → image builds with `packages/schema/migrations/` baked into `/app/schema/migrations/` → `scripts/db-migrate.mjs` applies any pending migrations. Deploy fails hard on migration errors (exits 1, pipeline stops).

### deveco.io uses managed DO Postgres

Not Docker Postgres. `NUXT_DATABASE_URL` from the DO managed DB's connection
string. deveco is a thin consumer of the layer; all business logic flows from
`@commonpub/layer`.

## Session-related patterns

### Session logs are the source of truth for recent changes

`docs/sessions/NNN-*.md` contains the what/why for every session. When docs
contradict session logs, session logs are newer.

### Handoff prompts live in `docs/sessions/` too

E.g. `100-handoff-prompt.md`, `099-handoff-prompt.md`. These are a running
context-reset mechanism — if you're continuing work, read the most recent one.

## Session 150 — federation-hardening Stage 3 wrap invariants

### Federation outbound MUST go through the SSRF-safe path

Three primitives in `@commonpub/protocol` (re-exported from
`@commonpub/server`) — use these for any new federation outbound:

- **`safeFetchResponse(url, options)`** returns
  `{ ok, status, statusText, headers, body: Buffer, contentType, finalUrl }`.
  Does NOT throw on non-2xx (delivery's circuit-breaker logic needs the
  status). Default `followRedirects: false` (signed AP requests must
  not replay to redirect targets — the signature covers the original
  target). Streams the body under a 10 MB cap + deadline.
- **`safeFetchSigned(signedRequest)`** takes a pre-signed `Request`
  (output of `signRequest`), extracts its headers/body, forces
  `followRedirects: false`, forwards through `safeFetchResponse`.
- **`createSafeActorFetchFn()`** in
  `packages/server/src/federation/safeFetchFn.ts` is the
  `FetchFn`-shaped wrapper for `resolveActor`/
  `resolveActorViaWebFinger`. Passes the caller's `init?.signal`
  through via `AbortSignal.any` combination with the internal deadline.

**Do not add new raw `fetch(...)` in `packages/server/src/federation/`.**
The pinned dispatcher closes the DNS-rebind TOCTOU that the per-hop
`isPrivateUrl` string check cannot. Pre-session-150 federation
outbound (signed GETs in `backfill.ts`/`hubMirroring.ts`, signed POST
in `delivery.ts`, raw `fetch` passed to `resolveActor`) bypassed this
— live-exploitable on commonpub.io + deveco.io since federation
flipped ON. Session 150 migrated all 6 federation modules; the
`oauth.ts` token endpoint POST also went through `safeFetchResponse`
with `accept: 'application/json'`.

### `signRequest` signs exactly `(request-target) host date digest`

`packages/protocol/src/sign.ts:41`. NOT content-type. The strict
inbound coverage policy `verifyHttpSignature` (session 149's Item 7)
requires `(request-target)`, `host`, `date` unconditionally + `digest` whenever the body is non-empty (so all four for POST/PUT/PATCH deliveries, which always have a body); if our outbound signs
a different set, our own inbound verifier (and every other compliant
strict checker) rejects. Tests at
`packages/protocol/src/__tests__/security/verifyHttpSignature.test.ts`
lock the matrix.

### Trusted client-IP via `getClientIp(event, opts?)`

`packages/infra/src/clientIp.ts`, re-exported via
`@commonpub/infra/security` and `@commonpub/server/security`. Reads
the **rightmost** `X-Forwarded-For` token by default. Falls back to
`x-real-ip` then the socket's `remoteAddress` then `'unknown'`. Use
this anywhere an IP needs to be derived (rate-limit key, view dedup,
audit-log `ipAddress` column) — don't re-parse XFF inline.

Multi-proxy operators set `CPUB_TRUSTED_PROXY_DEPTH=N` to read index
`length - N`. Default 1.

**Scope note**: all 3 prod instances use Caddy with
`header_up X-Forwarded-For {remote_host}` (overwrite). XFF chain
length is always 1, so leftmost === rightmost on our deploys —
the pre-fix leftmost-token code was NOT live-exploitable in our
setup. The fix is forward-compatible hardening for nginx-append /
multi-proxy operators. `deploy/nginx.conf` uses
`$proxy_add_x_forwarded_for` (append) — depth=1 still works with
exactly one trusted proxy. Proxy contract documented in
`docs/deployment.md` "Reverse-proxy contract" subsection.

### Better Auth signed-cookie helper

`layers/base/server/utils/betterAuthCookie.ts` is the only correct
way to mint a Better Auth session cookie from a custom route (the
federated SSO callbacks). Six exports (`getBetterAuthSessionCookieName`,
`getBetterAuthSessionDataCookieName`, `signBetterAuthCookieValue`, plus
the three load-bearing ones):

- `setBetterAuthSessionCookie(event, token, expiresAt)`
- `clearBetterAuthSessionCookies(event)` — clears BOTH the session
  token and the `session_data` SSR cache cookies
- `shouldUseSecurePrefix()` — matches Better Auth's
  `NODE_ENV=production || baseURL.startsWith('https://')` logic for
  the `__Secure-` cookie name prefix

**Critical: `signBetterAuthCookieValue` returns the RAW
`${token}.${signature}` string with NO `encodeURIComponent`.** h3's
`setCookie` → cookie-es `serialize` always URL-encodes the value
exactly once. Pre-encoding here gave a double-encoded wire value;
Better Auth's `getSignedCookie` single-decodes and checks the
signature against `length === 44 && endsWith('=')` — fails on the
double-encoded value, returns null, session is anonymous.

**Caught only by deep audit** (session 150 post-implementation
sweep) — same exact failure shape as session 149's safeFetch P0:
unit tests verified the algorithm in isolation against a WebCrypto
verifier (matched), but the framework above (h3 setCookie) broke
the wire format. The integration regression test at
`betterAuthCookie.test.ts:140` simulates the cookie-es encode +
decode round-trip and asserts the post-decode signature is length-44
and ends with `=`. The negative regression test at
`betterAuthCookie.test.ts:182` proves the broken pre-encoded helper
would fail the same shape check.

### `getAuthSecret()` MUST stay in sync with `middleware/auth.ts:27-33`

Both `betterAuthCookie.ts` and `middleware/auth.ts` resolve the
auth-signing secret from `useRuntimeConfig().authSecret`. Same dev
fallback (`'dev-secret-change-me'`), same prod-throws-if-missing.
If they diverge, our helper signs cookies under a different key than
Better Auth's `getSession` verifies against — federated logins
silent-fail (session set in DB, cookie on wire, but next request
auths as anonymous). KEEP IN SYNC comment in the helper.

### `signedRequest.text()` consumes the Request — never re-use after

`safeFetchSigned` calls `signedRequest.text()` to extract the body.
After that, the Request body is consumed — calling `.text()` again
throws "Body already used". Don't pass the same `signedRequest` to
multiple helpers. The current call sites only pass once; mind the
contract if adding new ones.

### Algorithm tests pass, integration breaks — test the FULL output path

Both session 149 and session 150 shipped a P0 of this exact shape:
unit tests fed helper output to a verifier of the same algorithm
(matched), but the framework integration broke the wire format.
When adding a primitive that flows through h3/undici/Nuxt:

1. Algorithm test (unit) — verifies the helper does the right
   transform.
2. Integration test — exercises the framework layer above (h3
   setCookie + parse Set-Cookie, or simulate cookie-es / undici
   exactly) and asserts end-state matches what the downstream
   consumer expects.
3. Negative regression-guard — proves the broken version of the
   helper would fail the integration test.

Without #2 + #3, the broken-helper unit tests pass and prod ships
broken. This is the pattern memory `feedback_integration_test_full_output_path`
references.

### XFF in non-security sites also migrated

Five XFF callsites total in `layers/base/server/`:
- `middleware/security.ts:57` — rate-limit key (security-critical).
- `api/content/[id]/view.post.ts:22` + `api/federation/content/[id]/view.post.ts:18`
  — view-dedup key (publicly exploitable for count inflation when
  proxy passes XFF through; not exploitable on our Caddy deploys).
- `api/auth/federated/callback.get.ts:42` + `api/auth/mastodon/callback.get.ts:99`
  — session `ipAddress` audit-log column (logging only).

All migrated to `getClientIp(event)`. If you add a new IP-derived
key, use the helper — don't re-parse XFF inline.

## Sessions 155–169 — layout engine + deploy invariants

### dnd-kit composables throw without a `<DnDProvider>` ancestor — gate behind `editable`

`@vue-dnd-kit/core`'s `makeDraggable`/`makeDroppable` call
`inject('VueDnDKitProvider')` at setup and THROW `"DnD provider not found"`
when no provider is mounted above. `disabled: true` does NOT suppress the
inject. The public render path (homepage layout-engine canary + custom pages
render `<LayoutSlot editable=false>`) has NO provider, so `LayoutSection.vue`
(makeDraggable, ~166) and `LayoutRow.vue` (makeDroppable, ~529) call them ONLY
inside `if (props.editable)`, with inert `computed(() => undefined/false)`
fallbacks. `editable` is static per instance → the conditional composable call
is safe. This crashed commonpub.io's homepage (500) the moment the editor code
first deployed (session 169) — and every unit test `vi.mock`s the whole dnd
module, so the real inject path is NEVER exercised in tests. The guard is
locked by `not.toHaveBeenCalled()` assertions in
`LayoutSection.test.ts`/`LayoutRow.test.ts`. The editor
(`pages/admin/layouts/[id].vue`) wraps everything in `<DnDProvider>`, so
`editable=true` is always safe. See `docs/sessions/169-deploy-dnd-hotfix.md`.

### Layout sections reuse existing components via `propMap` — no parallel renderers

The 17-section registry (`layers/base/sections/`) sets `component:` to an
existing `Block*`/`Homepage*` component and adapts props via `propMap`. Stage E
deleted 16 duplicate `Section*.vue` files (~2200 wasted lines). Check
`components/blocks/` + `components/homepage/` before writing a section renderer.

### The app's port 3000 is container-internal — smoke MUST run in-container

caddy fronts 80/443 on the droplet; the app container does NOT publish 3000 to
the host. A droplet-host `curl http://localhost:3000/...` never reaches the app.
The OLD post-deploy health check (`curl -sf http://localhost:3000/ || echo
::warning`) was BOTH warn-only AND pointed at the unreachable host endpoint —
so it silently "passed" forever. Session 169 replaced it with `scripts/smoke.mjs`
run via `docker compose exec -T app node scripts/smoke.mjs` (in-container, where
localhost:3000 IS the app), checking `/` (not just `/api/health`) and
hard-failing on non-2xx. **Health 200 ≠ site works — always smoke `/`.**

### `layoutEngine` is default OFF but ON live on commonpub.io

Via a runtime override (env or DB `instance_settings.features.overrides`). The
homepage there renders through `<LayoutSlot>` (the canary). deveco.io +
heatsynclabs.io keep it OFF (legacy renderer). Verify with `curl /api/features`.

## Sessions 170–181 — pagination, cursor security, RBAC

### Crafted-cursor DoS — validate DOMAIN, not just SHAPE (server 2.72.0, LIVE-exploited)

`decodeCursor` originally shape-checked the base64url `{v,id}` payload but did
NOT domain-check it. A `v` that isn't a date, a numeric `v`, or a non-uuid `id`
flowed straight to the SQL bind in `keysetWhere` and threw an unhandled 500 —
an unauthenticated attacker could reliably 500 `GET /api/content/feed` with a
forged `?cursor=` (3 crafted cursors each 500'd commonpub.io live, session 180).
Fix: `decodeCursor` now enforces its output contract (string `v` must parse to a
finite Date) and the caller narrows via `asDateUuidCursor()` (`query.ts:241`) to
date-or-null `v` + uuid `id` so an invalid cursor falls back to page 1. **A
type-valid but domain-invalid decoded value reaching a SQL bind is a DoS.**
Verify the failure mode against the real sink; confirm no global handler masks it.

### Keyset pagination — three orderings must agree byte-for-byte (sessions 178–179)

`listContentKeyset` rests on three orderings being identical: the local SQL, the
federated SQL, and the JS merge comparator (`compareFeedOrder`), all
`published_at DESC NULLS LAST, id DESC`. Postgres `uuid DESC` must equal JS
string-desc because the cursor `id` is fed back into SQL `id < :id`. Migration
0012's two PARTIAL indexes spell `id DESC NULLS FIRST` to match the planner's
NULLS placement syntactically. Mutation-test any change; the killer test is a
local + federated row sharing a `published_at`. **`pushSchema` (PGlite test
harness) SKIPS partial indexes** — the keyset tests create that DDL themselves.

### Federated-leak fix (server 2.72.0)

Shipped in the same commit as the cursor-DoS hardening (session 180). Federated
content could leak into feeds it shouldn't; the fix tightened the
status/visibility gate that both the offset and keyset paths route through
(`resolveContentQuery`, layer server util).

### RBAC permission cache — don't bake the admin grant into the cached set (session 175, INV-1)

`resolveUserPermissions` caches role→permission grants for 30 s. The admin `*`
grant is deliberately NOT written into the cached set; admin access rides a
gate-time floor over the *fresh* `users.role`. If you cache the `*`, a demoted
admin keeps full access for the whole TTL — an authorization-lag break. Floor on
the fresh role; use `||` (not `??`) when `''` must fall back; test the full
context→gate path, not just the resolver.

## Contest `draft` status is an access gate, orthogonal to visibility (session 189)

`contests.status` and `contests.visibility` are independent axes. `visibility`
(public/unlisted/private) controls *who can see a launched contest*; `status`
controls *lifecycle*. The `draft` status means "not launched" and MUST be
owner/admin/stakeholder/judge-only **regardless of visibility** — a `public`
draft is still hidden. This is enforced in two places that must agree:
`canViewContest` (per-contest read gate, before the visibility check) and
`listContests` (a `status != 'draft' OR createdById = viewer` condition for
non-admins). Originally `canViewContest` only gated `private`, so a public draft
was world-readable and listed. When adding any new "unpublished" status, gate it
in BOTH functions, not just one. Tests: "drafts are owner-only regardless of
visibility" + "listContests hides drafts from non-owners".

Contest stage transitions are **bidirectional** (`VALID_TRANSITIONS` in
`server/src/contest/contest.ts`); the client mirror now lives in ONE place,
`layers/base/utils/contestTransitions.ts` (shared by ContestHero + edit.vue). If
you change the server map, change that util — a client-only or server-only edit
silently desyncs (the UI offers a button the API rejects, or hides a valid one).
Rank-calc on `completed` is idempotent so go-back→re-complete is safe.

## Extracted form components must own their control styles (session 189)

The `cpub-form-*` control family (`.cpub-form-input`, `.cpub-form-textarea`, `.cpub-form-field`,
`.cpub-form-row`) is defined **per page** in `<style scoped>` on the contest create/edit pages —
NOT globally (`theme/forms.css` only globalises `.cpub-form-label`/`-hint`/`-error` + the separate
`.cpub-input`/`-textarea`/`-select` family; an attempt to add `cpub-form-*` to forms.css was
reverted — leave it that way). Because **Vue scoped styles don't cross component boundaries**, the
extracted `ContestStagesEditor` rendered as raw browser inputs (cramped monospace datetime boxes,
`cpub-form-row` lost its grid so fields stacked) when it relied on the parent page's scoped styles.
This is [[feedback_css_scope_component_extraction]] in the wild. **Rule:** an extracted component
that uses `cpub-form-*` (or any page-scoped class) must carry its OWN scoped copy of those styles —
`ContestStagesEditor` now does, tokenised (`var(--space-*)`, `var(--text-sm)`, `var(--font-sans)`,
`var(--surface)`, `var(--accent)`, `var(--shadow-accent)`) per CLAUDE.md rule #3. Yes, that means the
control styles are duplicated across the two pages + the component; that's the accepted trade-off
here (globalising them was rejected). `.cpub-form-label` IS global, so it isn't duplicated.

## Contest stages: `status` is behaviour, `stages` is display (Phase B1, session 189)

`contests.stages` (jsonb) + `currentStageId` are an ordered DISPLAY timeline; the
coarse `status` enum stays the **behavioural source of truth** for gating
(submissions open ⟺ active, judging ⟺ judging, …). `stages = []` ⇒ the server
synthesizes the classic Submissions → Judging → Results from status + dates
(`normalizeStages`), so default contests render identically — the standard flow is
the zero-config default. Three pure helpers (`synthesizeStages`/`normalizeStages`/
`currentStage`) are mirrored in `layers/base/utils/contestStages.ts` (don't import
the server package into the browser bundle — it pulls DB drivers; mirror + keep in
sync, same contract as the transitions util). A `currentStageId` that no longer
references an existing stage is **tolerated** (display falls back to status
derivation) AND **dropped** server-side on create/update (consistency guard), so a
reset-to-standard never leaves a dangling pointer.

**Phase B2 cohorts (session 189):** `contest_entries.stage_state` (jsonb) records
per-entry advancement; an entry is **eliminated** if any row has status
`eliminated`. `advanceContestStage` is the only writer — it's **idempotent per
review stage** (replaces that stage's rows, never appends duplicates), so a
re-run re-computes the cut cleanly. The key invariant: **`calculateContestRanks`
MUST exclude eliminated entries** (it filters `NOT (stage_state @> '[{"status":"eliminated"}]'::jsonb)`
and nulls their rank) — otherwise a culled entry could out-rank a finalist. If you
add another ranking/results path, apply the same cohort filter. The Top-N tiebreak
is deterministic (score → rank → id) so re-running yields a stable cut.

**Multi-round judging (session 189):** each `review` stage may carry its own `criteria` (per-round
rubric on `ContestStage`); the judge page resolves the CURRENT review stage's criteria, falling back
to contest-level `judgingCriteria`. `judgeContestEntry` is **cohort-gated** (rejects `eliminated`)
and the judge page lists only survivors — so a later round scores only the finalists. **Community
voting is advisory** — it never drives ranks or the Top-N cut; only judge `score` does (don't wire
votes into `calculateContestRanks` or `advanceContestStage`). **Per-round score isolation (session 189,
gap closed):** each `JudgeScoreEntry` carries a `roundId` (the current review stage's id; classic
contests resolve to the synthesized `core-review`, so they stay one bucket). A judge has one score
per round (matched on judge + round), and the entry's live `score` aggregates ONLY the current
round's scores — so a later judging round neither overwrites nor blends with an earlier one; earlier
rounds remain in `judgeScores` tagged by round, as history. `judgeContestEntry` resolves the round
via `currentStage`; the judge page mirrors this (its `currentRoundId` uses `normalizeStages` exactly
like the server) to pre-fill only the current round's score. If you add another scoring surface,
tag + aggregate by `roundId` the same way.

**Score/rank denormalization chain (Phase 6):** `contest_entries.judgeScores` is the SOURCE OF
TRUTH (per-judge inputs). `score` is the mean of the CURRENT round's `judgeScores`, re-derived by
`judgeContestEntry` on every write; `rank` is RANK() over `score` DESC across the surviving cohort,
re-derived by `calculateContestRanks` on completion; `stageState[].{score,rank}` is the IMMUTABLE
per-round snapshot taken at each advancement cut (never recomputed). Flow: judgeScores → score →
rank → stageState. Asserted by the "keeps score in sync with judgeScores" integration test. Don't
write `score`/`rank` from anywhere but these two functions.

**Contest PII partition (Phase 4 — security invariant):** PII NEVER lives in the public
`contest_entries.stageSubmissions` jsonb. `validateSubmissionFields` splits each submission into
{ artifact, pii, agreements }; only the non-PII artifact reaches `stageSubmissions`. PII goes to
`contestEntryPrivateFields` (unique per entry), consent to `contestAgreementAcceptances`
(append-only, with `termsHash`/`termsSnapshot`/`ip`). The only readers of those two tables live in
`submissions.ts` (the upsert + the gated `getEntryPrivateData`). The `/entries` list + detail + judge
page + CSV export's non-PII columns read ONLY `stageSubmissions`. PII surfaces ONLY via the gated
`GET /entries/:entryId/private` (`contest.pii` OR own entry) and the export's PII columns
(`contest.pii`). If you add an entries reader, do NOT join the PII/agreement tables. Contests don't
federate, so there's no AP serialization leak path either.

**`contest.pii` is single-dot (Phase 4):** unlike most permissions, the contest PII grant is
`contest.pii` (not `contest.pii.read`) to satisfy the catalog test's `^[a-z]+\.[a-z]+$` shape.
Seeded to admin (`*`) + staff (migration 0030 + STAFF_PERMISSION_SET).

**CSV export is formula-injection-safe (Phase 5):** `contest/export.ts`'s `toCsv` prefixes any cell
starting with `= + - @` TAB or CR with a `'` before RFC-4180 quoting, so entrant-controlled text
(project title, proposal summary, author name) can't execute as a spreadsheet formula. Any new
user-controlled CSV MUST route through `toCsv`.

**Judge route slug-scoping (B5a, Phase 6):** `POST /contests/:slug/judge` resolves the contest by
`:slug` and threads its id into `judgeContestEntry`, which rejects an entry that doesn't belong to
that contest. Previously the route judged purely by entryId (a misleading contract, not an
escalation — the judge-auth gate is contest-scoped).

**Contest server is decomposed (Phase 4) — don't regrow the monolith:** the former 1666-line
`contest/contest.ts` is split into an acyclic module DAG under `packages/server/src/contest/`:
`types` ← `stages`/`validation` ← `read`/`entries`/`submissions` ← `judging`; `contest` (CRUD) ←
`read`+`entries`; `export` is a leaf. `contest/index.ts` is the public barrel. New contest server
logic goes in the right module.

**Advancement-cull tests must defeat the insertion-order coincidence (session 189):** a Top-N cut
test where the entries are scored in submission order can't tell a score-based cut from a buggy
`slice(0, N)` (insertion-order) cut — both pass. The contest advancement + e2e tests deliberately
submit the lowest scorer FIRST (and a mid one), so an insertion-order bug fails them; verified by
hand-mutating the sort. Same family as [[feedback_pagination_needs_unique_tiebreaker]] /
[[feedback_keyset_merge_invariants]] — order-dependent logic needs order-disagreeing fixtures.

**Edit-form dirty tracking (session 189):** `pages/contests/[slug]/edit.vue` tracks `formDirty` via a
deep `watch` over the field refs, suppressed during load by a `hydratingForm` flag re-armed in
`nextTick` (so it can't get stuck on after hydration). Save is gated on `formDirty` so a change
visibly enables it. The flag can't get stuck OFF (nextTick always fires), so Save can't be
permanently disabled. Reset `formDirty` on successful save.

## Public-API metrics: the privacy contract is SQL-enforced, not after-the-fact (session 190)

`/api/public/v1/metrics/*` (`publicApi/metrics.ts`) is the only public surface that aggregates across
ALL users' content, so its WHERE clauses ARE the privacy boundary. `publicContentWhere()` =
`status='published' AND visibility='public' AND deletedAt IS NULL` (`metrics.ts:52-56`); user counts
filter `status='active' AND deletedAt IS NULL` (and public-profile only); events use
`PUBLIC_EVENT_STATUSES = published/active/completed` (`metrics.ts:62-63` — draft/cancelled are never
exposed). No new PII is added — only counts. **Invariant: any new metric MUST go through
`publicContentWhere()` (or an equivalent published+public+non-deleted filter).** Separately, every
counter SUM casts `::float8` (`metrics.ts:106-108`): a cumulative `sum(view_count)` overflows int4 and
500s the endpoint otherwise (caught + regression-tested, session 190). Cross-instance federation
numbers are double-gated behind `features.publicApiMetricsFederation` (default OFF) + `read:federation`.

## Public-API CORS: `*` is safe ONLY because there are no ambient credentials (session 190)

`publicApi/cors.ts` reflects/wildcards request Origins for the public API. This is safe — and ONLY
safe — because the API authenticates with `Authorization: Bearer`, never cookies, and **never** sends
`Access-Control-Allow-Credentials: true` (`cors.ts:1-10`): a cross-origin page still can't obtain a
key it doesn't already have. Before reflecting an Origin, `isWellFormedOrigin` (a strict regex) gates
it against CRLF/header-injection — on BOTH the authenticated request AND the **unauthenticated
preflight echo** (the OPTIONS path has no Bearer yet, so it's the easier injection target). **If you
ever add cookie/session auth to the public API, the `*` wildcard becomes unsafe and must be removed.**

## Default-theme resolution chain — DB → config.defaultTheme → stoa (sessions 190 + 196)

Since session 196 (`layer 0.73`, `config 0.22`), `resolveThemeContext` resolves the default as a
validated chain: DB `instance_settings.theme.default` → **`config.defaultTheme`** (a thin app's
brand theme pinned in code) → `'stoa'`; each candidate must be a KNOWN id (built-in, DB custom, or
code-registered), else it falls through, with `'base'` as the terminal guard. Consequence of the
OLD behavior (no config rung): deveco rode the stoa fallback for months — its `data-theme` said
stoa, its Light/Dark toggle resolved `stoa-dark`, and its brand dark palette (scoped
`[data-theme="dark"]`) never matched, i.e. "dark mode doesn't enable". Registered themes also
light/dark-flip within their OWN family now (`resolveRegisteredVariant`: explicit `pairId` →
`family`+`isDark` → the **name convention `<id>` ↔ `<id>-dark`**, isDark inferred from the
suffix), riding the same `themePair` client flip custom pairs use. Bumping a consumer's layer pin
still flips branding if it has NEITHER a DB `theme.default` NOR a `config.defaultTheme` — but
pinning in config is now the recommended, repo-reviewable fix.

## Denormalized counters: drift has a repair path — `scripts/reconcile-counters.mjs`

Counters (`hubs.member_count`, `contests.entry_count`, `events.attendee_count`, `hub_posts.vote_score`,
content `like_count`/`comment_count`, etc.) are maintained inline alongside writes. The HOT writers
are transaction-wrapped — `joinHub`/`leaveHub` (`members.ts`), `submitContestEntry` (`contest.ts`),
`voteOnPost`, `rsvpEvent`, `toggleBuildMark` — which closed the two non-tx offenders the session-182
audit flagged. **But "all known writers are wrapped" is FALSE (session 203 re-audit):** hub `kick`
(`members.ts:359`), `ban` (`moderation.ts:73`), contest `withdraw` (`contest.ts:1144`),
`toggleFederatedHubPostLike` (`hubMirroring.ts:1317`, 4 non-tx writes + a like-branch double-count
race), and all comment/reply/post-count writers are NON-transactional. A crash mid-write, a manual DB
edit, or these non-tx paths can desync a counter.

The repair net is **`scripts/reconcile-counters.mjs`** (`--check` reports drift and exits 1, no-args
fixes in place; needs `NUXT_DATABASE_URL`/`DATABASE_URL`). It is idempotent BUT **NOT safe to run in
fix mode on a federating instance (session 203):** it recomputes `content_items.like_count` /
`hub_posts.like_count` purely from the `likes`/`hub_post_likes` tables (`reconcile:79,54`), while
inbound **federated likes increment the counter without inserting a source row**
(`inboxHandlers.ts:1137,1155`). Running fix mode on commonpub.io/deveco.io would delete every
fediverse like. Fix the recompute to add remote likes before using fix mode there.
Also: the script covers only 10 counters — `content_items.comment_count`, `hub_posts.reply_count`,
`hubs.post_count`, `learning_paths.{enrollment_count,completion_count}`, `content_items.boost_count`,
and `federatedHubs.{localPostCount,localReplyCount}` are NOT in the list and drift uncorrected.
If you add a new denormalized counter, add it to this script — and the codebase already violates that
rule for the six above.

## Search is mirror-aware ONLY on the listContent path (session 196)

`/api/search`'s content branch delegates to `listContent` (the merged local+federated stream)
when `seamlessFederation` is on AND no Meilisearch is configured AND the request uses only
filters listContent supports. Author/date-range/multi-tag queries and any future Meilisearch
deployment use the LOCAL-ONLY `searchContent` path — federated rows aren't indexed and lack
those fields. If you index federated content into Meilisearch later, revisit the branch order.
The regression this fixed: commonpub.io's feed is entirely `mirror-*` federated rows, so the
old local-only search returned 0 for every query the homepage could answer.

## backdrop-filter: `none` is the only no-op; popovers vs overflow (sessions 195–196)

Two rendering invariants from the glass + priority-nav work:
1. A treatment token default must be `none` — `blur(0)` still creates a stacking context and
   becomes the containing block for fixed/absolute descendants (would move dropdowns/modals on
   every theme).
2. Never put `overflow-x: auto`/`hidden` on a container whose descendants open
   absolutely-positioned panels (nav dropdowns) — the panel's containing block sits inside the
   scroll container and gets clipped. The priority-nav "More" menu exists precisely because
   scroll-the-nav was tried and reverted.

## One focus indicator: inputs inside ring-bearing wrappers must suppress box-shadow too

Stoa applies `box-shadow: var(--focus-ring)` to EVERY `:focus-visible` element. A search form
whose wrapper draws a `:focus-within` ring must suppress BOTH `outline` AND `box-shadow` on the
inner input, or themes double-ring it (the deveco "double tracing" bug; the base topbar search
carries the same guard).

## npm-installing a tarball into a pnpm repo contaminates it (session 195)

npm's flat layout writes real `node_modules/@vue/*` dirs that pnpm never prunes → TWO
`@vue/reactivity` module instances → the `RefUnwrapBailTypes` DOM bail misses the copy that
provides `ref` → `ref<HTMLElement>().value` deep-unwraps into a structural flatten and nothing
assigns to `Element`. Survives `git stash` + reinstall (invalidates counterfactuals). Verify
tarballs with `pnpm add <tarball>`; fix with `rm -rf node_modules && pnpm install`.

## Module-top-level `process.argv` crashes Vite dev clients (session 195)

`packages/schema/src/openapi.ts`'s CLI guard read `process.argv[1]` at module top level —
Vite's browser dev shim defines `process` WITHOUT `argv`, so importing `@commonpub/schema`
client-side threw during app init and EVERY dev/e2e page became the Nuxt 500 screen (months of
"flaky" e2e). Prod was immune only because `sideEffects: false` tree-shakes the never-imported
module. Guard with `process.argv?.[1]`; more generally, no top-level Node-API access in
packages a client may import.

## Priority-nav measurement must be exogenous — the spacer is deliberately inert (session 196)

NavRenderer's "More" overflow measures `containerEl.clientWidth`. That only works because the
topbar spacer is `flex: 0 0 0` and the nav is the ONLY flex-grow item in the row: its
allocation is `row − everything else`, independent of its own content. When the spacer also
had `flex: 1`, the nav's allocation was `content + slack/2` — a function of its OWN content —
so collapsing links shrank the container, which re-justified the collapse (a ratchet with a
stable under-collapsed equilibrium: links hidden beside a huge empty gap). If you re-introduce
a growing sibling in the bar's middle region (base layout OR a fork like deveco's), the
ratchet comes back. Web fonts are the other blind spot: they widen the items without resizing
the container, so NavRenderer re-measures on `document.fonts.ready` — keep that if you touch
the lifecycle.

## Large free-text fields: the bound is load-bearing, at BOTH ingest and render (session 197)

A user pasted a large HTML blob into a contest description; validation rejected it (the old 10k
cap), but the request still slowed/destabilized the server. Root cause is two synchronous,
event-loop-blocking steps that run *before or independent of* the Zod cap:

1. **Ingest.** Every JSON write route funnels through `parseBody` (`server/utils/validate.ts`),
   which `readBody`s (buffers) then `JSON.parse`s the whole body — both synchronous and memory-
   spiking — *before* `safeParse` ever checks `.max()`. A multi-MB body (or a burst of retries)
   stalls the loop / pressures memory regardless of the field cap. **Invariant:** `parseBody`
   enforces a `Content-Length` ceiling (`MAX_JSON_BODY_BYTES`, **10MB**) and throws **413 before
   `readBody`**. This is the single chokepoint for all JSON writes. The ceiling is deliberately
   GENEROUS, not tight: `content` is `z.unknown()` (unbounded) for articles/projects/docs, so a
   low cap would reject legitimately-large saves — don't drop it to 1MB. It only has to kill the
   *catastrophic* body; per-field Zod `.max()` is the semantic bound. Multipart uploads use
   `readMultipartFormData` (NOT `parseBody`) and are bounded separately by `validateUpload`.

2. **Render.** Contest description/rules render through `CpubMarkdown` → `markdownToBlockTuples`
   (`packages/editor/src/markdown/parser.ts`) inside a Vue `computed`, i.e. **synchronously on
   the SSR main thread for every page view**. The parser is `unified`/remark and was building a
   fresh `unified()` processor *per block node* — O(N) processor construction, the dominant cost
   on large inputs. **Invariants now:** the remark-rehype + rehype-stringify processors are built
   ONCE at module scope and reused (`mdastToHast`/`hastToHtml`, frozen); and inputs over
   `MAX_MARKDOWN_LENGTH` (100k, a backstop *above* the 50k schema cap for federated/imported/
   legacy rows) skip the parse entirely and emit one escaped plain-text block. If you add a new
   per-node HTML conversion, route it through the shared `treeToHtml`, don't `unified()` inline.

Consequence for caps: long-form contest fields (`description`/`rules`/`prizesDescription`) raised
10k → `CONTEST_RICH_TEXT_MAX` (50k) to allow genuinely large briefs — but **keep them bounded**.
"Remove the cap entirely" is the exact unbounded-input DoS the above guards exist to prevent; the
50k value sits safely inside both the 1MB ingest envelope and the 100k render backstop. Client
textareas carry `maxlength="50000"` so over-cap input is stopped before a round-trip.

## Contest long-text has two render paths, gated PER-FIELD (session 197)

Each long-form contest field has its OWN render mode: `descriptionFormat`, `rulesFormat`,
`prizesDescriptionFormat` (all `'markdown'` default | `'html'`, independent). `CpubMarkdown`
branches on its `format` prop: `markdown` runs `markdownToBlockTuples`; `html` renders ONE
`v-html` through `sanitizeRichHtml`. (The original single `content_format` column is kept as an
inert/deprecated column — splitting it into three would be a rename-ambiguous migration that
drizzle-kit can't resolve headlessly; migration 0023 just ADDs the three.) Two invariants:

- **Markdown mode can't render a styled HTML document.** CommonMark turns blank-line-separated,
  4-space-indented HTML into *indented code blocks*, and the strict `sanitizeBlockHtml` allowlist
  strips `div/section/svg` and ALL `style=`. That's why a pasted inline-styled doc showed as
  code blocks + unstyled text. The fix is the `html` mode, not loosening markdown mode — keep
  `sanitizeBlockHtml` strict (it's also the federated-content barrier).
- **`sanitizeRichHtml` (html mode) is permissive but DEFAULT-DENY and never allows script.**
  It renders layout/CSS/SVG verbatim (tag/attr name CASE preserved so `viewBox`/`linearGradient`
  survive) but: drops `<script>/<style>/<iframe>/<object>/<embed>` with their bodies, strips
  `on*` + `javascript:` URLs, and scrubs `url()/expression()/@import/behavior` from `style`.
  If you add a tag/attr to the allowlist, it renders to EVERY contest viewer — never add
  `<script>`, `<style>`, event handlers, or unsanitized URL/`style` sinks. Authoring is gated to
  staff/admin, but the sanitizer is the real barrier since pages render to untrusted visitors.

Detail page uses a blocking `useFetch` (not `useLazyFetch`) so the body is SSR-rendered — lazy
caused an empty-description flash while the client fetched + parsed a large body.

## A transient `/api/me` failure must NOT log the user out (session 197)

`useAuth().refreshSession()` runs in the default layout's `onMounted` on every full page load.
It previously `catch`-cleared `user`/`session` to null on **any** thrown error. But a *thrown*
`/api/me` (network blip, 5xx, a slow/overloaded server timing out) is not evidence the session is
gone — only a *successful* response saying `{ user: null }` is. The old behavior turned a
momentary server hiccup into a full client-side logout; combined with the draft-access gate above
(a logged-out owner's `draft` contest 404s), it looked like data loss. **Invariant:** a successful
`/api/me` is authoritative (mirror it exactly); a thrown error leaves the SSR-hydrated auth state
intact and waits for the next refresh. Don't reintroduce a blanket `catch { user.value = null }`.

## `useLazyFetch` renders the "not found" branch during client-nav loading (session 197)

`contests/[slug]/edit.vue` (and any lazy-fetched detail page) starts with `data === null`. On a
full page load SSR populates it, so typing the URL works. But on a **client-side** nav (clicking
"Edit Contest"), the lazy fetch is still pending while `data` is null — a template whose final
`v-else` is "Contest not found" will flash/stick on that branch, reading as a broken link. Gate on
the fetch `status`: treat `idle`/`pending` as a *loading* state distinct from a genuinely-null
"not found". This is why a page can "work when you type the URL but not when you click the button".

## Theme native controls: every dark theme MUST declare `color-scheme: dark` (session 211)

`:root` (base.css) sets `color-scheme: light`; each dark theme block overrides with `color-scheme: dark`
(`[data-theme="dark"]`, `[data-theme="agora-dark"]`, `[data-theme="stoa-dark"]`). Without the override a
dark theme renders native UI (the `datetime-local` calendar popup, scrollbars, `<select>` chrome) in the
LIGHT scheme → white popups on a dark page. stoa-dark was missing it (added session 211). **A new dark
theme — including a custom DB-stored one — must declare `color-scheme: dark`.** Custom dark themes built
via the theme editor do NOT yet set this (known follow-up; they were already light-control pre-211, so
no regression).

## datetime-local conversion: use `utils/datetime`, never `toISOString().slice(0,16)` (session 211)

A `datetime-local` control speaks LOCAL wall-clock with no zone. `new Date(iso).toISOString().slice(0,16)`
is UTC → the value shown is shifted by the local offset, so the time an organizer picks is not the time
stored. Use `toLocalInput(iso)` / `fromLocalInput(local)` (`layers/base/utils/datetime.ts`), which build
the input value from LOCAL date components and parse it back as local (round-trip-correct in every TZ).
The shared `CpubDateTimeField.vue` wraps this + `min`/`max` coupling + a11y; prefer it over a raw input.
edit.vue's contest-date LOAD (and `seedStandardStages` seeding via it) had this exact UTC bug — fixed 211.

## Contest rich-HTML is color-neutralized for dark-safety (session 211)

`CpubMarkdown` renders `format:'html'` via `sanitizeRichHtml(html, { neutralizeColors: true })`, which
DROPS inline hardcoded color/background literals (hex/rgb/hsl/named) so the themed `.cpub-md-html`
baseline (`packages/ui/theme/prose.css`) shows through in BOTH themes. Theme-adaptive values
(`var(...)`, `currentColor`, `inherit`, `transparent`) are KEPT. `neutralizeColors` defaults OFF
(general-purpose `sanitizeRichHtml` preserves colors — existing tests rely on that); only the contest
HTML path opts in. **Deploy note:** existing contests with intentional hardcoded HTML colors will show
the theme baseline instead after this ships — intended (dark-safety), not flagged/toggled.

## `?tab=` is the contest detail tab state — deep-linkable (session 211)

`pages/contests/[slug]/index.vue` syncs the active tab to `?tab=` (validated against the known keys,
`router.replace`, overview omits the param). SSR-initialized so a shared `/contests/x?tab=judges` lands
correctly; back/forward honored. Caveat: a deep link to a LAZY-data tab (judges/participants) for a
non-owner can reset to overview before that data loads.

## `layers/base/theme/` is a GENERATED COPY — edit `packages/ui/theme/` (session 211)

`layers/base/theme/*.css` is gitignored (`layers/base/.gitignore` `/theme/`); `nuxt.config.ts` uses it
when present (the npm-published bundle), else falls back to `packages/ui/theme`. It is regenerated from
`packages/ui/theme` by `layers/base/scripts/bundle-theme.mjs` at publish (`prepublishOnly`). **The tracked
source of truth is `packages/ui/theme/`** (base/dark/agora-dark/stoa-dark/prose/forms/...). Editing the
layer copy is silently uncommitted AND overwritten on the next bundle; in local dev run `node
layers/base/scripts/bundle-theme.mjs` after editing the source so the dev server reflects it. Same class
as the unanchored-gitignore-swallows-source landmine.

## Contest editor 3-panel shell invariants (session 218)

The contest editor (`ContestEditor.vue`) was rebuilt into the house project/blog 3-panel shell
(left `EditorBlocks` palette · center `ContestBodyCanvas` · right `EditorSection` rail). Invariants:

- **Palette block-type keys MUST be registered in `BlockContentRenderer`'s `componentMap`** (and via
  `BLOCK_COMPONENTS_KEY` for the edit component). The palette inserted `horizontal_rule` while the
  renderer mapped only `divider`/`horizontalRule`, and the renderer's fallback only catches blocks
  with a `.html` field — so dividers rendered *nothing* in Preview + on the public page yet looked
  fine in the write canvas. Fixed by aliasing `horizontal_rule → BlockDividerView`. Any new palette
  type needs the matching render key or it silently vanishes downstream.
- **A block-editor shell must NOT be wrapped in a `<form>`.** `EditorBlocks`/`EditorSection`/
  `BlockCanvas` buttons have no `type` ⇒ default `type=submit`; inside a form, a palette click or
  section toggle submits → save → refetch → re-hydrate wipes dirty state. Use `<div>` + explicit
  `@click` Save (as `ProjectEditor` does).
- **Hoisted-editor dirty tracking** watches `() => editor.blocks.value` (getter), not the bare
  `readonly(blocks)` ref — the bare ref's deep watch misses structural inserts (push/splice), so a
  content-less block wouldn't enable Save. Write-back also sets `formDirty` explicitly, guarded by a
  `syncingBodies` reseed flag.
- `@commonpub/editor/vue` exports (`EditorSection`/`EditorBlocks`/`BlockCanvas`/`useBlockEditor`) are
  NOT Nuxt auto-imports — import them explicitly (a missing `EditorSection` import renders the rail
  flat: slot content leaks, no collapsible headers).

Verified by a 26/26 full-lifecycle E2E (draft→completed, entries, judging, advancement, rankings,
public render incl. sanitized HTML block). See `docs/sessions/218-contest-editor-shell-build.md`.
