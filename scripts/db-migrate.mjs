/**
 * Non-interactive schema-migration wrapper for CI.
 *
 * Uses drizzle-orm's native `migrate()` function (node-postgres) rather than
 * `drizzle-kit migrate`, because the CLI's `renderWithTask` spinner exits
 * non-zero even on success and swallows error output.
 *
 * Reads committed SQL files from the migrations folder, tracks applied
 * migrations in `drizzle.__drizzle_migrations`, and is fully non-interactive.
 *
 * Workflow:
 *   1. Developer edits packages/schema/src/*.ts.
 *   2. Developer runs `pnpm --filter=@commonpub/schema db:generate` locally.
 *   3. Developer commits the generated .sql + snapshot + updated journal.
 *   4. PR review includes the migration SQL.
 *   5. CI deploy runs this script to apply any new migrations.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('❌ db:migrate requires NUXT_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER || '/app/schema/migrations';

const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log('✅ db:migrate succeeded');
} catch (err) {
  console.error('❌ db:migrate failed:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
} finally {
  await pool.end();
}
