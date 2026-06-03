# 09 — Gotchas & Invariants

Hard-won knowledge. These are non-obvious from reading the code — they bit
someone in production. If you break one, something silent will go wrong later.

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

**Pre-bump sanity check** — before pushing a deveco-style consumer-site pin bump, build the image and confirm the installed `@commonpub/schema` dist is COMPLETE. Don't hardcode a magic number — the count grows with the schema (it was ~80 at 0.17.0 / 18 src files; schema is now 0.25.0 / **23 src files**, so expect proportionally more). Compare against a fresh `npm pack` / non-frozen install of the SAME version, and verify `dist/index.js` actually `export *`s every domain module:
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
