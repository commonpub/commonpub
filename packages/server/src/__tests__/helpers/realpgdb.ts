/**
 * Real-Postgres test harness — for things PGlite cannot prove.
 *
 * PGlite is a single in-process connection: every `db.transaction` is fully
 * serialized, so row-lock contention, `ON CONFLICT` claim races, and atomic
 * `UPDATE … RETURNING` claims are all no-ops there. This harness opens a real
 * `pg.Pool` (multiple concurrent connections) against a throwaway schema, so a
 * `Promise.all([fn(), fn()])` genuinely races at the database.
 *
 * The schema is populated by RUNNING THE COMMITTED MIGRATIONS (not pushSchema),
 * so creating the DB also proves the migration chain applies cleanly end-to-end.
 *
 * Hermeticity: each call creates a uniquely-named Postgres schema, applies the
 * migrations into it (tables + the migration-tracking table both live there),
 * and `cleanup()` drops it. Concurrent test files never collide.
 *
 * Gated: `realPgReachable()` returns false when no Postgres is reachable, so
 * suites `describe.skipIf(!(await realPgReachable()))(...)` and stay green in
 * environments without a database (PGlite-only CI). Locally + in any CI with a
 * Postgres service it runs for real. Override the target via TEST_DATABASE_URL.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as schema from '@commonpub/schema';
import type { DB } from '../../types.js';

const PG_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://commonpub:commonpub_dev@localhost:5433/commonpub';

/** packages/schema/migrations — the committed migration chain. */
const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../schema/migrations',
);

let cachedReachable: boolean | undefined;

/** True if a Postgres is reachable at the configured URL (cached). */
export async function realPgReachable(): Promise<boolean> {
  if (cachedReachable !== undefined) return cachedReachable;
  const pool = new Pool({ connectionString: PG_URL, max: 1, connectionTimeoutMillis: 2000 });
  try {
    await pool.query('SELECT 1');
    cachedReachable = true;
  } catch {
    cachedReachable = false;
  } finally {
    await pool.end().catch(() => {});
  }
  return cachedReachable;
}

export interface RealTestDb {
  /** Drizzle DB backed by a multi-connection pool against a throwaway database. */
  db: DB;
  /** The underlying pool (for raw concurrency probes). */
  pool: Pool;
  /** The throwaway database name. */
  dbName: string;
  /** Drop the database and close the pool. */
  cleanup: () => Promise<void>;
}

/** Swap the database name in a Postgres connection URL. */
function urlForDb(name: string): string {
  const u = new URL(PG_URL);
  u.pathname = `/${name}`;
  return u.toString();
}

/**
 * Create a real-Postgres test DB by CREATE DATABASE + applying the committed
 * migrations into it. A throwaway database (not a schema) is required because
 * drizzle's migrations hard-qualify enums to `"public"`, so isolation must be at
 * the database level. The returned pool has multiple connections so transactions
 * genuinely contend. Call `cleanup()` in afterAll. Applying the migration chain
 * end-to-end also proves it (every committed migration runs against a fresh DB).
 */
export async function createRealTestDB(): Promise<RealTestDb> {
  const dbName = `cc_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // CREATE DATABASE runs in autocommit (not inside a tx) on the configured DB.
  const admin = new Pool({ connectionString: PG_URL, max: 1 });
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: urlForDb(dbName), max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const cleanup = async (): Promise<void> => {
    await pool.end().catch(() => {});
    const dropper = new Pool({ connectionString: PG_URL, max: 1 });
    try {
      // FORCE terminates any lingering connections (PG 13+).
      await dropper.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    } finally {
      await dropper.end();
    }
  };

  return { db: db as unknown as DB, pool, dbName, cleanup };
}
