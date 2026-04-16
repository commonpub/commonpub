# LLM Contributor Guide

> Best practices for AI assistants (Claude, GPT, Copilot, etc.) editing the CommonPub codebase.

This guide supplements `CLAUDE.md` (the authoritative project rules) with practical patterns for changelogs, migrations, schema changes, publishing, and common workflows. **Read `CLAUDE.md` first** — it has the standing rules that override everything else.

---

## Before You Start Any Work

1. **Read `CLAUDE.md`** — 14 standing rules, code conventions, architecture overview
2. **Check `docs/sessions/`** — latest session log tells you where things left off
3. **Run the verification suite** before and after changes:
   ```bash
   pnpm build && pnpm typecheck && pnpm test && pnpm lint
   ```
4. **Check git status** — never commit on top of uncommitted user work

---

## Schema Changes

The schema is the foundation (`@commonpub/schema`). Changes here cascade everywhere.

### Adding a new table

1. Add the Drizzle table definition in the appropriate file under `packages/schema/src/` (e.g., `content.ts`, `social.ts`, `hub.ts`)
2. If the table needs a new enum, add it to `packages/schema/src/enums.ts`
3. Add Zod validators in `packages/schema/src/validators.ts`
4. Export from `packages/schema/src/index.ts`
5. Write tests in `packages/schema/src/__tests__/`
6. Run `pnpm build` to regenerate types — downstream packages will see the new types

### Modifying an existing table

- **Adding a column**: Add with a `default` value or mark as `.notNull()` only if you provide a migration default. Existing rows need to be valid.
- **Renaming a column**: This is a breaking change. Update all references in `@commonpub/server`, `@commonpub/auth`, and the reference app.
- **Removing a column**: Search for all usages first (`grep -r "columnName" packages/ apps/`). Remove from schema, validators, server functions, and tests.

### Migration workflow

CommonPub uses Drizzle Kit for migrations:

```bash
# After schema changes:
pnpm db:generate   # Creates SQL migration files
pnpm db:push       # Applies to local dev DB (destructive — dev only)
pnpm db:migrate    # Applies migration files (production-safe)
```

**Never use `db:push` in production.** Always use `db:generate` + `db:migrate` for production deployments.

---

## Server Module Changes

Business logic lives in `packages/server/src/<domain>/`. Each domain module exports functions that take `(db, ...)` as the first argument.

### Adding a new function

1. Add the function in the domain module (e.g., `packages/server/src/content/content.ts`)
2. Export from the domain's `index.ts`
3. If it's a new domain, add it to `packages/server/src/index.ts` and `package.json` exports
4. Write unit tests in `packages/server/src/__tests__/<domain>.test.ts`
5. Write integration tests using `createTestDB()` from `./helpers/testdb.ts`
6. Always `await closeTestDB(db)` in `afterAll` to prevent PGlite memory leaks

### Test database pattern

```ts
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';

describe('my feature', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // tests here
});
```

**Important**: The server vitest config has `hookTimeout: 30000` because PGlite schema push is slow under parallel CI load. If you add new integration test files, they inherit this.

---

## Changelog & Versioning

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(schema): add video categories table
fix(auth): session expiry check off-by-one
test(server): add messaging integration tests
docs(adr): document SSO decision
chore(deps): update drizzle-orm to 0.46
```

Scopes match package names: `schema`, `protocol`, `auth`, `ui`, `server`, `editor`, `docs`, `explainer`, `learning`, `infra`, `config`, `test-utils`, `reference`.

### When to update CHANGELOG.md

- After any user-facing change (features, fixes, breaking changes)
- Group changes under the version heading
- Use categories: Added, Changed, Fixed, Removed, Security
- Reference the session number if applicable

### Version bumping

All 12 `@commonpub/*` packages share the same version number. When bumping:

1. Update `"version"` in all 12 `packages/*/package.json` files
2. Update `CHANGELOG.md`
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z`
5. Publish: `pnpm publish:all`

### Publishing to npm

```bash
pnpm publish:check    # build + typecheck + test
pnpm publish:all      # publishes all 12 packages
git tag vX.Y.Z && git push --tags
```

pnpm automatically resolves `workspace:*` → `^X.Y.Z` when publishing. You don't need to rewrite dependencies manually.

---

## Session Logging

After each work session, create `docs/sessions/NNN-description.md` with:

- **What was done** — specific changes with file paths
- **Decisions made** — and why (this is the most valuable part)
- **Open questions** — for the next session
- **Next steps** — what to pick up

Number sessions sequentially. Check the latest file in `docs/sessions/` for the current number.

---

## Adding a New Package

If you ever need to create a new `@commonpub/*` package:

1. Create directory: `packages/newpkg/`
2. Copy `package.json` template from an existing package (e.g., `packages/config/package.json`)
3. Update: name, description, keywords, repository.directory
4. Create `src/index.ts`, `tsconfig.json`, `vitest.config.ts`
5. Add to `vitest.workspace.ts` if it has tests
6. The package is auto-discovered by pnpm workspace (`packages/*` glob)

---

## Testing Best Practices

### Test structure

```
packages/<pkg>/src/__tests__/
  setup.test.ts           # Export verification
  <module>.test.ts         # Unit tests
  <module>.integration.test.ts  # Integration with DB
  helpers/
    testdb.ts             # PGlite factory (server only)
```

### What to test

- **Validators**: Positive + negative cases for every Zod schema
- **Server functions**: Happy path + error path + edge cases
- **UI components**: Props, slots, events, keyboard navigation, axe-core accessibility
- **Editor extensions**: Node creation via command, attribute defaults, HTML rendering
- **Protocol**: Real payload fixtures from Mastodon/Lemmy/GoToSocial/Misskey for interop

### Timeouts

Some packages have extended timeouts for CI stability:
- `@commonpub/server`: `hookTimeout: 30000`, `testTimeout: 15000` (PGlite)
- `@commonpub/protocol`: `testTimeout: 30000` (RSA key generation)
- `@commonpub/docs`: `testTimeout: 15000` (shiki init)

If you see timeout failures in CI, increase the timeout rather than adding retries.

### The 5 skipped learning tests

`packages/server/src/__tests__/learning.integration.test.ts` has 5 tests marked with `it.skip`. These fail with PGlite (no `rowCount` on UPDATE, `inArray` serialization bug) but pass with real Postgres. Don't try to fix them — they're a PGlite driver limitation.

---

## Reference App (`apps/reference/`)

The reference app is a **thin Nuxt 3 shell** that wires CommonPub packages together. It's not a library — it's an example app.

### Common patterns

- **Server routes**: `server/api/<domain>/<endpoint>.ts` — call `@commonpub/server` functions
- **Pages**: `pages/<route>.vue` — use `useFetch`/`useAsyncData` to call server routes
- **Composables**: `composables/` — shared Vue composition functions
- **Type assertions**: Many Vue template bindings use `as any` at the `useFetch` data boundary because Nuxt's `SerializeObject<T>` wrapper creates complex union types. This is intentional — runtime data is correct.

### When editing Vue templates

- `vue-tsc` checks template types. If you see `SerializeObject<T>` errors, cast at the data destructuring point, not in the template.
- `import.meta.server` / `import.meta.client` are Nuxt-specific. They require `nuxi prepare` to generate types.

---

## Common Mistakes to Avoid

1. **Don't add `as any` to production library code** — only in test files and reference app Vue bindings
2. **Don't use `db:push` patterns in migration docs** — always `db:generate` + `db:migrate` for production
3. **Don't hardcode colors or fonts** in `@commonpub/ui` — always `var(--*)`
4. **Don't store docs as TipTap JSON** — always raw markdown
5. **Don't enable federation features** without two instances running with real content (standing rule #10)
6. **Don't forget `afterAll(() => closeTestDB(db))`** in integration tests
7. **Don't create files unless necessary** — edit existing files when possible
8. **Don't amend commits after hook failures** — create new commits
9. **Don't publish without running `pnpm publish:check`** first
10. **Don't bump version in only some packages** — all 12 must stay in sync

---

## Quick Reference — File Locations

| What | Where |
|------|-------|
| Project rules | `CLAUDE.md` |
| Master plan | `docs/plan-v2.md` |
| Architecture | `docs/architecture.md` |
| Session logs | `docs/sessions/NNN-*.md` |
| ADRs | `docs/adr/NNN-*.md` |
| Package docs | `docs/reference/packages/` |
| Server module docs | `docs/reference/server/` |
| Feature guides | `docs/reference/guides/` |
| Schema tables | `packages/schema/src/*.ts` |
| Business logic | `packages/server/src/<domain>/` |
| UI components | `packages/ui/src/components/` |
| CSS theme tokens | `packages/ui/theme/` |
| Test helpers | `packages/server/src/__tests__/helpers/` |
| CI config | `.github/workflows/ci.yml` |
| Docker config | `docker-compose.yml` (dev), `deploy/docker-compose.prod.yml` (prod) |
