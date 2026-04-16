# CommonPub — Developers Guide

_For people spinning up a dev environment, building a customized instance,_
_or contributing upstream._

Assumes comfort with Node.js + TypeScript + SQL. If you're also new to
Nuxt 3 or Drizzle, skim their docs; this guide won't re-teach those.

**Contents**
- [What you're working with](#what-youre-working-with)
- [Local setup](#local-setup)
- [Architecture in one page](#architecture-in-one-page)
- [The thin-app pattern](#the-thin-app-pattern)
- [Theming](#theming)
- [Feature flags](#feature-flags)
- [Adding a feature end-to-end](#adding-a-feature-end-to-end)
- [Schema changes](#schema-changes)
- [Server module patterns](#server-module-patterns)
- [API routes](#api-routes)
- [Federation for developers](#federation-for-developers)
- [Testing](#testing)
- [Publishing packages](#publishing-packages)
- [Deployment](#deployment)
- [Contributing upstream](#contributing-upstream)
- [Common pitfalls](#common-pitfalls)

---

## What you're working with

- **pnpm workspace** with 12 packages + 1 shared Nuxt layer (@commonpub/layer, 85 pages, 106 components, 257 API routes) + 2 apps + 2 tools.
- **Turborepo** for task orchestration.
- **Nuxt 3** for the distribution unit (the layer) and both apps.
- **Drizzle ORM** over **PostgreSQL 16**.
- **Better Auth** + custom AP Actor SSO for identity.
- **Pure-TS ActivityPub** in `@commonpub/protocol` (jose for HTTP signatures + keypairs, Zod for AP object validation). No external AP framework.
- **TipTap** for the block editor, serialized to a compact BlockTuple[] format.
- **Meilisearch** for search, with Postgres FTS fallback.
- **Postgres-backed delivery queue** — the `activities` table with `status`/`attempts`/`lockedAt`/`deadLetteredAt` columns. A Nitro plugin polls on a configurable interval. (Redis runs in docker-compose as a provisioned service for future use but isn't currently integrated.)

For the exhaustive inventory (every table, route, component), see
[`codebase-analysis/`](../../codebase-analysis/). For decisions, see
[`adr/`](../adr/).

## Local setup

Prereqs: Node 22+, pnpm 10+, Docker. Postgres, Redis, Meilisearch run via
compose.

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub

pnpm install
pnpm build

# Infra (remapped ports: 5433, 6380, 7701 — avoids clashes with local tools)
docker compose up -d

cp .env.example .env
pnpm db:push
pnpm dev:app
```

Visit `http://localhost:3000`. First registered user is auto-promoted to
admin.

### Useful scripts

| | |
|---|---|
| `pnpm dev` | All packages + the reference app in dev mode (turbo) |
| `pnpm dev:app` | Reference app only |
| `pnpm test` | Vitest across every package |
| `pnpm test:e2e` | Playwright |
| `pnpm typecheck` / `lint` / `format` | All packages |
| `pnpm db:push` | Drizzle Kit push to local DB |
| `pnpm db:generate` | Generate SQL migration files |
| `pnpm publish:check` | build + typecheck + test |
| `pnpm stryker:<pkg>` | Per-package mutation testing |

## Architecture in one page

```
┌──────────────────────────────────────────────────┐
│  apps/reference  apps/shell                      │  thin shells
│          │                                       │
│          ▼                                       │
│    layers/base (@commonpub/layer)                │  distribution unit
│     pages / components / api routes / composables│
│     server middleware / plugins / theme          │
│          │                                       │
│  ┌───────┼───────┬───────────┐                   │
│  ▼       ▼       ▼           ▼                   │
│ server  auth   editor      infra                 │  business + utilities
│  │       │                                       │
│  └───┬───┘                                       │
│      ▼                                           │
│   config + schema                                │  foundation
└──────────────────────────────────────────────────┘

Support packages (not in the main chain):
  protocol  explainer  learning  docs  ui  test-utils
```

**Rule of thumb:** new business logic goes in `@commonpub/server`. The layer
exposes it as routes/pages. Consumer apps stay minimal.

See [`codebase-analysis/01-monorepo-topology.md`](../../codebase-analysis/01-monorepo-topology.md)
for the dependency graph.

## The thin-app pattern

A new CommonPub instance is ~4 files + `.env`:

```
my-site/
├── nuxt.config.ts               # extends: ['@commonpub/layer']
├── commonpub.config.ts          # defineCommonPubConfig({ features, auth, instance })
├── server/utils/config.ts       # Nitro-side config resolver (env + DB override layers)
└── components/SiteLogo.vue      # branded logo
```

Optionally `assets/theme.css` to override CSS tokens.

The fastest path: `cargo install create-commonpub && create-commonpub new mysite`.

`apps/shell/` is the starter template. `apps/reference/` is a full-featured
dogfood deployment that shows what everything looks like when it's all on.

`deveco.io` is a real production thin-app — about 25 branded/config files
over the layer.

### Why a layer, not separate packages?

The layer is the distribution unit because UI + CSS are tightly coupled to
the components. Publishing UI separately creates version compatibility pain.
You import ONE thing (`@commonpub/layer`), you get everything consistent.

See [ADR 026](../adr/026-ui-design-direction.md) for the full rationale.

## Theming

All visual style is CSS custom properties. No hardcoded colors or fonts
anywhere in the layer or `@commonpub/ui` — this is a standing rule.

Key tokens:

| Token | Default (base theme) | Example override (deveco) |
|---|---|---|
| `--border-width-default` | `2px` | `1px` |
| `--radius` | `0px` | `6px` |
| `--shadow-sm/md/lg` | offset shadow | blurred shadow |
| `--accent` | `#5b9cf6` | green |
| `--font-sans`, `--font-display` | Work Sans / Fraunces | brand fonts |

### Five built-in themes

Registered in `packages/ui/src/theme.ts` as `BUILT_IN_THEMES`:

- **base** — "Classic Light": sharp corners, offset shadows, blue accent
- **dark** — "Classic Dark": dark variant of base
- **generics** — "Generics": dark minimal with blue accent and soft glow
- **agora** — "Agora Light": warm parchment, green accent, serif display font
- **agora-dark** — "Agora Dark": grove-tinted darks with green accent

Switched via the `data-theme` attribute on `<html>`. The server middleware in
`layers/base/server/middleware/theme.ts` resolves the theme per-request
from the instance setting + the user's cookie. The client plugin reads
`event.context.resolvedTheme` and calls `useHead({ htmlAttrs: { 'data-theme': ... } })`
during SSR. Zero FOUC.

### Consumer overrides

Create `assets/theme.css` in your instance:

```css
:root {
  --accent: #ff6600;
  --radius: 8px;
  --font-display: 'MyBrandFont', serif;
}
```

Import it via `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ['@commonpub/layer'],
  css: ['~/assets/theme.css'],  // loads AFTER layer CSS
})
```

Consumer CSS loads after the layer's, so it wins.

### Error page theme

`error.vue` re-applies `data-theme` via `useHead` because error pages render
outside the normal layout tree. If you rewrite `error.vue`, don't remove that.

## Feature flags

15 flags in `packages/config/src/types.ts` → `FeatureFlags`. See
[`codebase-analysis/08-feature-flags-inventory.md`](../../codebase-analysis/08-feature-flags-inventory.md)
for every flag's default and consumer.

Rule: **no feature without a flag**. Every new feature gets one.

Flags are gated in four places:
1. Server module code (`if (!config.features.x) throw ...`)
2. Route middleware `feature-gate.global.ts` (throws 404)
3. Page/component markup (`<div v-if="features.x">`)
4. Nav item definitions (`requiredFeature: 'x'`)

Admin UI at `/admin/features` provides runtime overrides on top of the
build-time config.

## Adding a feature end-to-end

Here's the canonical flow. Pretend we're adding `workshops`.

### 1. Schema

```ts
// packages/schema/src/workshops.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './auth'

export const workshops = pgTable('workshops', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  startsAt: timestamp('starts_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

Export from `packages/schema/src/index.ts`. Add a Zod validator in
`validators.ts`. Bump `@commonpub/schema` minor.

Apply:

```bash
pnpm db:generate   # creates SQL migration
# Review the SQL. Commit it.
pnpm db:push       # applies locally
```

**WARNING:** If your change introduces a new enum, `drizzle-kit push` may hang
in CI without a TTY. Apply the enum SQL manually on deployed instances before
the push — see [gotchas](../../codebase-analysis/09-gotchas-and-invariants.md).

### 2. Server module

```ts
// packages/server/src/workshop/workshop.ts
import type { DB } from '../types'
import { workshops } from '@commonpub/schema'

export async function listWorkshops(db: DB, { limit = 20, offset = 0 } = {}) {
  return db.select().from(workshops).limit(limit).offset(offset)
}

export async function createWorkshop(db: DB, userId: string, input: NewWorkshop) {
  // validate via Zod, insert, emit hook if appropriate
}
```

Add `packages/server/src/workshop/index.ts` re-exporting the public functions.
Add to `packages/server/src/index.ts`. Bump `@commonpub/server` minor.

### 3. Feature flag

```ts
// packages/config/src/types.ts
export interface FeatureFlags {
  // ...
  workshops: boolean
}
```

Default OFF in `packages/config/src/schema.ts`. Set it in
`apps/reference/commonpub.config.ts` to true so you can dogfood. Bump
`@commonpub/config`.

### 4. API routes

```ts
// layers/base/server/api/workshops/index.get.ts
export default defineEventHandler(async (event) => {
  if (!event.context.features.workshops) throw createError({ statusCode: 404 })
  const db = useDb()
  return listWorkshops(db, getQuery(event))
})
```

Follow the existing route naming: `index.get.ts`, `index.post.ts`,
`[slug]/index.get.ts`, etc.

### 5. Pages

```vue
<!-- layers/base/pages/workshops/index.vue -->
<script setup lang="ts">
const { data: workshops } = await useFetch('/api/workshops')
</script>

<template>
  <main class="cpub-page">
    <!-- ... -->
  </main>
</template>
```

Update `feature-gate.global.ts` if the feature has its own URL path prefix.

### 6. Nav item

Add a seed NavItem in the default `instanceSettings.nav.items` config:

```ts
{ type: 'link', label: 'Workshops', href: '/workshops', requiredFeature: 'workshops' }
```

### 7. Tests

Write at least:
- Vitest unit tests for the server module
- Vitest integration tests for the API routes (against PGlite or test Postgres)
- Playwright E2E if there's significant UI

### 8. Docs

- Add to `docs/reference/server/workshops.md`
- Add a section to this guide's user doc
- Update `docs/reference/guides/feature-flags.md`
- Log the session in `docs/sessions/NNN-workshops.md`

### 9. Publish

```bash
pnpm publish:check
pnpm -r --filter './packages/*' publish --no-git-checks
```

## Schema changes

- Always edit `packages/schema/src/*.ts` — not raw SQL.
- Run `pnpm db:generate` to get a migration SQL file. Commit the SQL.
- Run `pnpm db:push` locally to apply. Verify with `psql` / `\d+ tablename`
  that new columns actually exist (push can silently skip).
- On deployed instances, CI runs `drizzle-kit push` during deploy. **New enums
  will fail** there because the push prompts for confirmation. Apply the enum
  SQL manually via `psql` on the deployed DB first.
- Update validators in `packages/schema/src/validators.ts`.
- Bump `@commonpub/schema` — minor for additive, major for anything removal.

## Server module patterns

`@commonpub/server` is pure TypeScript — no Nuxt, no framework coupling. Every
module takes a Drizzle DB handle as the first argument.

### Transactions when correctness requires it

Use `db.transaction(async tx => ...)` for:
- Voting (atomic vote + score update)
- RSVP (capacity check + status assignment)
- Cancel RSVP (delete + waitlist promotion)
- Hub join/leave (member row + memberCount update)
- Publish content (status + federation enqueue)

### Hooks for cross-cutting side effects

Emit lifecycle events from modules:

```ts
import { emitHook } from '../hooks'

await db.transaction(async tx => {
  // ... mutation ...
})
await emitHook('content:published', { contentId })
```

Subscribers (search indexing, email, federation delivery) register in
layer server plugins:

```ts
// layers/base/server/plugins/search-index.ts
onHook('content:published', async ({ contentId }) => {
  await indexInMeilisearch(contentId)
})
```

### Permission checks

```ts
import { hasPermission, canManageRole } from '../utils'

if (!hasPermission(actorRole, 'banUser')) throw forbidden()    // mod+
if (!hasPermission(actorRole, 'editHub')) throw forbidden()    // admin+
if (!canManageRole(actorRole, targetRole)) throw forbidden()
```

Role weights are strict: `owner(4) > admin(3) > moderator(2) > member(1)`.
`canManageRole` requires `>`, not `>=` (an admin can't demote another admin).

Available permission names are declared in `PERMISSION_MAP` in
`packages/server/src/utils.ts`. Unknown names return `Infinity` (always fail),
so add new names there before using them.

### Slug generation

```ts
import { generateSlug, ensureUniqueSlugFor } from '../query'

const base = generateSlug(title)
const slug = await ensureUniqueSlugFor(db, workshops, 'slug', 'id', base, 'workshop')
```

`ensureUniqueSlugFor` appends a timestamp on collision.

## API routes

Conventions:

- File naming: `index.<method>.ts` or `[param]/index.<method>.ts`
- Use `defineEventHandler`
- Grab DB via `useDb()` utility
- Grab session via `event.context.user`
- Check feature flag via `event.context.features.<flag>`
- Check role via `event.context.user?.role`
- Throw errors with `createError({ statusCode, statusMessage })`
- Validate input with the Zod validator from `@commonpub/schema`

Example patterns: see `layers/base/server/api/events/*` (session 124) for a
clean module.

### Response shapes

Use the types in `packages/server/src/types.ts`: `UserRef`, `ContentDetail`,
`ContentListItem`, `PaginatedResponse<T>`, etc.

### SSE / WebSockets

`layers/base/server/api/realtime/stream.get.ts` +
`messages/[id]/stream.get.ts` use Server-Sent Events. Not WebSocket — SSE
works through standard HTTP and proxies cleanly.

## Federation for developers

### Enable it carefully

Do NOT enable `federation: true` on a dev instance without a peer to federate
with. The delivery worker polls forever; logs get noisy. Standing rule: no
federation before two instances with real content.

### The lifecycle

Publishing a content item → insert row in `activities` (direction=outbound,
status=pending) → the delivery worker picks it up → signs with the user's AP
keypair → POSTs to remote inboxes → updates status.

Incoming activities land at `/users/:username/inbox`. The handler verifies the
HTTP Signature, resolves the actor (caching in `remoteActors`), and dispatches
by activity type (Create, Follow, Accept, Undo, Delete, Update, Announce, Like).

See [`codebase-analysis/07-state-diagrams.md`](../../codebase-analysis/07-state-diagrams.md)
for the inbound and outbound flow diagrams.

### Hub federation (session 083+)

Hubs can act as AP Group actors (FEP-1b12). Remote users follow the hub like
they'd follow a person; posts are Announced to all followers. Gated by the
`federateHubs` feature flag.

### Content mirroring (session 079+)

Admins can set up `instanceMirrors` to pull content from specific remote
instances. The backfill worker walks the remote outbox and ingests matching
items (filters by content type and tags).

### Circuit breaker

If an instance's inbox keeps failing, `instanceHealth.circuitOpenUntil` gets
set. The delivery worker skips that domain until the window closes. Prevents
cascading failures when one instance is down.

### AP Actor SSO (Model B)

Your instance's users can sign into another CommonPub instance via:
1. WebFinger lookup for the target instance's `oauth_endpoint` link
2. Redirect to `/oauth2/authorize` at the target
3. Target authenticates the user, redirects back with a code
4. Token exchange at `/oauth2/token`

Only works if the target instance has `federation: true` AND the initiating
instance has the target in `auth.trustedInstances`.

### Wire format caveats

BlockTuple[] content maps to AP `Article` with a `cpub:type` extension. Between
CommonPub instances, full fidelity. To Mastodon/Lemmy, falls back to standard
Article + HTML content. Changing the mapper is a wire-compat break — version it
if you must.

## Testing

| Layer | Tool | What |
|---|---|---|
| Unit / integration | Vitest | Server modules, schema validators, utilities |
| Component | @testing-library/vue + axe-core | WCAG 2.1 AA |
| E2E | Playwright | Full user flows |
| Mutation | Stryker | Per-package targets |
| Federation interop | Custom | Payloads from Mastodon, Lemmy, GoToSocial, Misskey |

Run:
```bash
pnpm test            # all unit/integration
pnpm test:e2e        # Playwright
pnpm stryker:server  # mutation for one package
```

### Test DB

Integration tests use PGlite (in-process Postgres) by default. Three tests
are skipped because PGlite doesn't support advisory locks / some extension
types. Running against a real Postgres resolves them. Don't "fix" them by
rewriting against PGlite.

### Test factories

Use `@commonpub/test-utils` to build entities quickly:

```ts
import { createUser, createContent, mockConfig } from '@commonpub/test-utils'
const user = await createUser(db)
const post = await createContent(db, { authorId: user.id, type: 'blog' })
```

## Publishing packages

Standing rules:

- Always `pnpm publish`, never `npm publish`.
- Always verify `dist/` contains what you expect before publishing.
- Always `pnpm publish:check` (build + typecheck + test) first.
- Never add Claude as co-author in commits.

Workflow:

```bash
pnpm build
pnpm typecheck
pnpm test

# Bump version in packages/<pkg>/package.json
# Update CHANGELOG

pnpm -r --filter './packages/*' publish --no-git-checks
```

Dependent packages automatically pick up the new version once republished.

## Deployment

### Docker Compose on VPS

Use `deploy/docker-compose.prod.yml`. Reverse proxy via Caddy (`deploy/Caddyfile`)
— it handles Let's Encrypt automatically. Multi-stage `Dockerfile` at repo
root.

### DigitalOcean App Platform

`deploy/app-spec.yaml` is ready. Managed Postgres (attach separately). Set
env vars for DATABASE_URL, AUTH_SECRET, feature flags.

### Schema on deploy

`pnpm db:push` runs during deploy. If your change introduces a new enum, this
will fail silently — apply the enum SQL manually via `psql` to the deployed
DB before pushing. Known CI issue; see gotchas.

### Scripts

`deploy/do-one-click.sh` provisions a DigitalOcean droplet from zero. Check
`deploy/README.md` for the full sequence.

## Contributing upstream

1. Read [`CONTRIBUTING.md`](../../CONTRIBUTING.md) at repo root.
2. Follow [`coding-standards.md`](../coding-standards.md):
   - TypeScript strict, no `any`
   - Composition API, `<script setup lang="ts">`, no Options API
   - CSS custom properties only — no hardcoded colors/fonts
   - WCAG 2.1 AA
   - Conventional commits: `feat(schema):`, `fix(auth):`, etc.
3. Write tests first where feasible.
4. Log the session in `docs/sessions/NNN-description.md` — this is the
   source of truth for recent changes.
5. Update reference docs (`docs/reference/…`) in the SAME PR as the feature.
6. For significant architectural decisions, write an ADR in `docs/adr/`.

## Common pitfalls

Full list: [`codebase-analysis/09-gotchas-and-invariants.md`](../../codebase-analysis/09-gotchas-and-invariants.md).

Highlights:

- **`drizzle-kit push` + new enums = CI fails.** Apply SQL manually first.
- **Nitro externalization** can hide new imports from API routes in prod.
  Ensure the import is reachable from a root index or whitelist in `nitro.externals.inline`.
- **`server/utils/config.ts` is the Nitro-side config resolver** (NOT a proxy
  re-export). It merges build-time defaults with `FEATURE_*` env vars and
  admin-editable DB overrides (`instanceSettings.features.overrides`, cached
  60s). Server handlers import from `~/server/utils/config`. Removing it
  breaks admin flag overrides.
- **pnpm store staleness** — after locally building `packages/server`,
  consumer typecheck may see old types. `pnpm install --prefer-offline` in
  the consumer refreshes.
- **useLazyFetch inside Suspense** — use this instead of `useFetch` to avoid
  render races.
- **`error.vue` data-theme** — don't delete the useHead call; SSR error pages
  render outside the layout.
- **Federated content uses local components** — when showing federated data,
  reuse the same components as for local data. Don't create parallel
  federation-only component trees.

---

See also:
- [Raw analysis](../../codebase-analysis/) — every table, every route, every component
- [Architecture decisions](../adr/)
- [Session logs](../sessions/) — source of truth for recent changes
- [Users guide](./users.md)
- [LLM context](../llm/README.md)
