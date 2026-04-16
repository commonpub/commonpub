# Switching from drizzle-kit push to migrate

## Current State
- `scripts/db-push.mjs` — wraps `drizzle-kit push --force` for CI (silently skips constraint changes)
- `scripts/db-migrate.mjs` — NEW: wraps `drizzle-kit migrate` for CI (applies committed SQL files)
- One baseline migration: `0000_slippery_marvex.sql` (initial schema snapshot from session 96)

## Steps to Complete the Switch

### 1. Generate fresh baseline (requires TTY terminal)

```bash
cd packages/schema
docker compose up -d  # Start local Postgres
pnpm db:push          # Sync local DB to current schema

# Generate migration from current schema state
npx drizzle-kit generate
# Answer "no" to all rename prompts (they're not renames, they're additions)
# This creates a new .sql file in migrations/
```

### 2. Mark baseline as already applied on production

Both production instances already have all tables. Mark the migration as applied:

```bash
# On commonpub.io:
ssh root@commonpub.io "docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c \"
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  );
  INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('MIGRATION_HASH_HERE', EXTRACT(EPOCH FROM NOW())::bigint * 1000);
\""

# Same for deveco.io
```

### 3. Update deploy workflows

Replace `db-push.mjs` with `db-migrate.mjs` in:
- `.github/workflows/deploy.yml` (commonpub)
- `deveco-io/.github/workflows/deploy-prod.yml`

```yaml
# Before:
docker compose exec -T app node scripts/db-push.mjs

# After:
docker compose exec -T app node scripts/db-migrate.mjs
```

### 4. Update development workflow

When changing schema files:
1. Edit `packages/schema/src/*.ts`
2. Run `npx drizzle-kit generate` (requires local Postgres + TTY)
3. Review the generated `.sql` file
4. Commit both the `.ts` changes AND the `.sql` migration
5. PR review includes the SQL — no surprises on deploy

### Why This Matters
- `drizzle-kit push` silently skips constraint changes (caused 2 production incidents)
- `drizzle-kit migrate` applies reviewed SQL files — what you see in the PR is what runs on deploy
- Migration files provide an audit trail and rollback reference
