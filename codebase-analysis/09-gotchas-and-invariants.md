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

### Copy dist to pnpm store after local server build

If you `pnpm build` in `packages/server/` and then run `pnpm typecheck` in a
consumer app that imports `@commonpub/server`, the consumer may still see the
old types. After building locally, copy to the pnpm store or run
`pnpm install --prefer-offline` in the consumer to refresh the symlink.

## Database

### `drizzle-kit push` FAILS in CI for new enums

`drizzle-kit push` prompts interactively to confirm enum-value additions. CI
has no TTY → the push hangs, then fails. Session 124 hit this during deploy.

**Workaround:**
- Generate SQL with `pnpm db:generate` and commit it
- OR apply the enum SQL manually via `psql` on both instances before deploy
- OR add the enum-creation SQL to a pre-deploy migration script

Never rely on `drizzle-kit push` in CI for NEW enums. Adding columns to
existing tables is fine; adding an enum value is NOT.

### `drizzle-kit push` can silently skip changes

Schema changes that conflict with existing data sometimes get skipped without
a clear error. Always verify new columns actually exist with
`\d+ <table>` in `psql` after pushing.

### Postgres connection in containers

- commonpub.io postgres: `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- deveco.io postgres: `docker exec deveco-app-1 env` to get `NUXT_DATABASE_URL`, then `psql`

## Nuxt / Nitro

### New server imports can 404 in production

Nitro externalizes node_modules in prod builds. If you add a NEW import from
`@commonpub/server` to a Nitro API route and that export wasn't exercised
before, Nitro might not include it in the bundle. Symptom: route works locally
but returns 404 or "Cannot find module" on the deployed instance.

**Fix:** ensure the import is reachable through the root index; if it's from
a subpath, add it to `nitro.externals.inline` in nuxt.config.

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

### `federatedContent.mirrorId` has NO FK

Enforced in app code only. If you delete an `instanceMirror` row, orphan
`federatedContent` rows will remain. Clean up in the same transaction.

### Article type is legacy — use blog or project

`contentTypeEnum` still has `article` for backwards compat, but the system
normalizes to `blog`. New code should use `blog`, `project`, or `explainer`.

### Events table has NO unique(eventId, userId) on attendees

`eventAttendees` lacks a unique constraint, so duplicate RSVPs are possible
at the DB level. The server enforces dedupe via a pre-insert check, but a
race between two requests for the same user could create duplicates. Low
priority but known.

## UI / theming

### No hardcoded colors or fonts

Standing rule. Every color/font in `@commonpub/ui` and `@commonpub/docs`
components must be `var(--*)`. Session 096 did a 698-instance migration from
hardcoded `border: 2px solid` to `var(--border-width-default)`.

### Theme must re-apply in error.vue

Error pages render outside the normal layout tree on SSR, so the `data-theme`
attribute is missing. `error.vue` re-calls `useHead({ htmlAttrs })` using a
`useState<string>('cpub-theme', ...)` — don't remove it.

### Federated UI must reuse local components

When you're rendering federated content, use the SAME components as for local
content — not a parallel federation-only component tree. Session 122 found
several duplicated federation components that had drifted from their local
counterparts.

## Git / commits

### Never add Claude as co-author

No `Co-Authored-By`, `Signed-off-by`, or any AI attribution in any commit,
in any CommonPub-related repo.

## Testing

### PGlite can't do X (3 skipped tests)

Three integration tests are skipped because PGlite (the in-process Postgres)
doesn't support the features they exercise (advisory locks and certain extension
types). Running against a real Postgres makes them pass. Don't "fix" them by
rewriting against the in-process engine.

### Stryker mutation runs are slow

`pnpm stryker` across all packages takes >30 min. Use the per-package targets
(`stryker:server`, `stryker:schema`, etc.) unless you're doing a full audit.

## Deployment

### commonpub.io auto-deploys from main

Push to main → GitHub Actions → DigitalOcean → `drizzle-kit push` runs during
deploy. If push fails (see enum gotcha above), the DEPLOY fails — app stays on
the old code/schema.

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
