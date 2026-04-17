# LLM Task Recipes — CommonPub

Step-by-step flows for the most common tasks. Follow these verbatim unless
you have a specific reason not to.

## Add a new feature end-to-end

1. Create a session log stub at `docs/sessions/NNN-description.md`. Highest existing NNN + 1.
2. **Schema** — add tables/columns/enums to `packages/schema/src/<domain>.ts`. Export from `index.ts`.
3. Add Zod validators in `packages/schema/src/validators.ts`.
4. Bump `@commonpub/schema` minor version.
5. Run `pnpm --filter=@commonpub/schema db:generate` → review and **commit** the generated `migrations/000N_*.sql` + updated `meta/_journal.json` + `meta/000N_snapshot.json` alongside the schema change.
6. Verify locally by applying to a dev DB: `pnpm --filter=@commonpub/schema db:migrate` (or `db:push` for rapid local iteration). Confirm with `psql \d+ <table>`.
7. **Feature flag** — add to `FeatureFlags` in `packages/config/src/types.ts`. Default OFF. Update `schema.ts` defaults. Bump `@commonpub/config`.
8. Enable the flag in `apps/reference/commonpub.config.ts` for dogfooding.
9. **Server module** — add `packages/server/src/<domain>/<domain>.ts` with functions taking `(db: DB, ...)`. Export via `<domain>/index.ts`. Re-export from root `index.ts`. Bump `@commonpub/server`.
10. Use transactions for atomic multi-step writes.
11. Emit lifecycle hooks where relevant.
12. **API routes** — add `layers/base/server/api/<path>/<file>.<method>.ts`. Check feature flag, validate input, call server module, return typed response.
13. **Pages** — add `layers/base/pages/<path>/<file>.vue`.
14. **Components** — add to `layers/base/components/<Name>.vue`.
15. Update `feature-gate.global.ts` if the feature has its own URL prefix.
16. Add a nav item to the default `instanceSettings.nav.items` config with `requiredFeature`.
17. **Tests** — Vitest unit + integration; Playwright E2E if UI-heavy.
18. **Docs** — reference doc under `docs/reference/server/<domain>.md`; guide under `docs/reference/guides/` if user-facing; update `docs/guides/users.md` and `developers.md`; update `docs/reference/guides/feature-flags.md` and `codebase-analysis/08-feature-flags-inventory.md`.
19. Update CHANGELOG.md.
20. Fill in the session log with what was done, decisions, open questions.
21. `pnpm publish:check` then `pnpm -r --filter './packages/*' publish --no-git-checks`.

## Add a column to an existing table

1. Edit `packages/schema/src/<domain>.ts`.
2. Bump `@commonpub/schema` minor.
3. Run `pnpm --filter=@commonpub/schema db:generate` → **commit** the generated `000N_*.sql` + journal/snapshot updates.
4. Apply to your local dev DB (`pnpm --filter=@commonpub/schema db:migrate`) and verify with `psql \d+ <table>`.
5. Update the relevant Zod validator in `validators.ts`.
6. Update server module functions to read/write the new column.
7. Update `codebase-analysis/02-schema-inventory.md` with the new column.
8. Test.
9. Publish.

## Add a new enum or enum value

1. Edit `packages/schema/src/enums.ts`.
2. Bump `@commonpub/schema` minor.
3. Run `pnpm --filter=@commonpub/schema db:generate`.
4. **Commit** the generated `000N_*.sql` alongside the enum change. The migration file will contain the `CREATE TYPE ...` (for a new enum) or `ALTER TYPE ... ADD VALUE 'new'` (for a new value). PG limitation: `ALTER TYPE ... ADD VALUE` runs outside transactions — drizzle-kit handles that correctly in generated migrations, but review the SQL.
5. Update validators + server modules.
6. Update `codebase-analysis/02-schema-inventory.md`.
7. Push. CI deploy runs `scripts/db-migrate.mjs` which applies the migration via `drizzle-orm/node-postgres/migrator.migrate()` — no prompts, no manual SQL.

## Add a new feature flag

1. Add field to `FeatureFlags` interface in `packages/config/src/types.ts`.
2. Add default in `packages/config/src/schema.ts`.
3. Bump `@commonpub/config`.
4. Update `apps/reference/commonpub.config.ts` and `apps/shell/commonpub.config.ts`.
5. Add to `runtimeConfig.public.features.<flag>` in `layers/base/nuxt.config.ts`.
6. Gate the feature:
   - Server: `if (!config.features.flag) throw createError({ statusCode: 404 })`
   - Route middleware: add path mapping to `feature-gate.global.ts` if it owns a path
   - Nav: `requiredFeature: 'flag'` on NavItem entries
   - Components: `<div v-if="features.flag">`
7. Update `docs/reference/guides/feature-flags.md`.
8. Update `codebase-analysis/08-feature-flags-inventory.md`.

## Add a component to the layer

1. Create `layers/base/components/<Name>.vue`.
2. Use `<script setup lang="ts">`.
3. Every interactive element has keyboard support + ARIA labels.
4. No hardcoded colors or fonts — always `var(--*)`.
5. Accept `class` prop via `$attrs` or explicit.
6. If the component relies on a feature, check `useFeatures()`.
7. If it fetches server data, use `useLazyFetch` (avoids Suspense races).
8. Test with `@testing-library/vue` + axe-core.

## Add an API route

1. Create `layers/base/server/api/<path>/<file>.<method>.ts`.
2. Use `defineEventHandler`.
3. Check feature flag FIRST: `if (!event.context.features.x) throw createError({ statusCode: 404 })`.
4. Check auth if needed: `if (!event.context.user) throw createError({ statusCode: 401 })`.
5. Check role if needed: `if (!hasPermission(event.context.user.role, 'x')) throw createError({ statusCode: 403 })`.
6. Validate input with Zod: `const input = createThingSchema.parse(await readBody(event))`.
7. Call server module.
8. Return typed response from `packages/server/src/types.ts`.

## Fix a flaky federation test

1. Check whether it's a PGlite-skipped test (see `codebase-analysis/09-gotchas-and-invariants.md`). If so, don't "fix" it.
2. Run against a real Postgres: `TEST_DATABASE_URL=postgres://... pnpm test`.
3. Check for time-sensitive assertions (activity delivery has exponential backoff; tests sometimes race the worker).
4. Check for circuit-breaker state leaking between tests: ensure `instanceHealth` is reset in `beforeEach`.

## Rename / change an AP wire field

1. DON'T change the AP JSON field names `cpub:type`, `cpub:metadata`, `cpub:blocks`, `cpub:postType` unless you version the mapper. (Local DB columns `cpubType`, `cpubMetadata`, `cpubBlocks` can be renamed freely — they don't leave the instance.)
2. For new fields: add under the `cpub:` namespace; older CommonPub versions ignore them gracefully.
3. For changes: bump `@commonpub/protocol` major; note in CHANGELOG; coordinate deploy across instances.

## Add a theme family

1. Create `layers/base/theme/<name>.css` with `[data-theme="<name>"] { ... }` selector.
2. Add optional `<name>-dark.css`.
3. Register in `layers/base/nuxt.config.ts` `css:` array.
4. Add to theme family options in `/admin/theme` UI.
5. Test FOUC-free loading — verify server middleware sets `resolvedTheme` correctly.

## Deploy a schema change (any kind — columns, tables, enums, constraints)

There's no special case anymore. Everything goes through committed migrations.

1. Make the change in `packages/schema/src/*.ts`.
2. Run `pnpm --filter=@commonpub/schema db:generate` locally (needs a TTY).
3. Commit the `.ts` change + the generated `migrations/000N_*.sql` + `meta/_journal.json` + `meta/000N_snapshot.json` in the same commit.
4. Bump `@commonpub/schema` version.
5. If consumers pin the package (deveco, other downstream repos): `pnpm publish` the schema package, then bump the consumer's pin.
6. Push to `main`. CI rebuilds the image (Dockerfile ships `migrations/` into the runtime) and runs `scripts/db-migrate.mjs` on deploy, which applies any pending migrations via `drizzle-orm/node-postgres/migrator.migrate()` and records state in `drizzle.__drizzle_migrations`.

No prompts, no manual SQL, no silent failures. Deploy fails hard if the migration errors out.

## Debug a 404 in production for a route that works locally

Almost always one of:
- Nitro didn't bundle a newly imported function. Check `nitro.externals.inline` in `layers/base/nuxt.config.ts`.
- The route's feature flag is OFF in production (check `/admin/features` or env vars).
- The feature flag middleware mapping is missing. Check `layers/base/middleware/feature-gate.global.ts`.
- The route file is named wrong (e.g., `index.ts` instead of `index.get.ts`).

## Add a hook subscriber

1. In a new file `layers/base/server/plugins/<name>.ts`:
   ```ts
   import { onHook } from '@commonpub/server'

   export default defineNitroPlugin(() => {
     onHook('content:published', async ({ contentId }) => {
       // do the thing
     })
   })
   ```
2. Server plugins run at Nitro boot. The hook handler runs synchronously after the originating transaction commits.
3. Handler errors are logged but don't crash the server. If you need transactional guarantees, use a DB transaction that the originating call participates in (not a hook).

## Triage a federation delivery failure

1. Check `/admin/federation/pending` — pending activities should drain.
2. Check `instanceHealth` for the target domain. If `circuitOpenUntil` is in the future, the circuit is open; wait or manually clear.
3. Check `activities.error` for the latest failure message.
4. Check the target inbox is reachable: `curl https://target.example/users/name/inbox`.
5. Verify your actor keypair is valid: check `/users/<username>` on your instance and ensure `publicKey.publicKeyPem` is present.
6. Check retry count — if `attempts >= maxDeliveryRetries`, the activity is dead-lettered (`deadLetteredAt` set). Manual retry via `/admin/federation/retry`.
