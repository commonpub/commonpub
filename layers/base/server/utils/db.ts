// Singleton Drizzle DB instance for Nitro server
import { drizzle } from 'drizzle-orm/node-postgres';
// @ts-expect-error no types for pg
import pg from 'pg';
import * as schema from '@commonpub/schema';
import type { DB } from '@commonpub/server';

let db: DB | null = null;

export function useDB(): DB {
  if (db) return db;

  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl as string;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured. Set NUXT_DATABASE_URL environment variable.');
  }

  // Guard against default auth secret in production
  if (process.env.NODE_ENV === 'production' && config.authSecret === 'dev-secret-change-me') {
    throw new Error('NUXT_AUTH_SECRET must be set in production. Do not use the default dev secret.');
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // An 'error' event with NO listener is an uncaught exception in Node, and
  // `pg.Pool` raises one on behalf of an IDLE client whenever the backend closes
  // the connection underneath it — a Postgres restart, a failover, a
  // `pg_terminate_backend`, an idle-connection reaper, or a network blip. Without
  // this listener any of those takes the whole Nitro process down, mid-request,
  // for every visitor.
  //
  // Session 256 diagnosed exactly this mechanism when it turned a run of 2,138
  // PASSING server tests red, and fixed it in the four pools of the TEST helper
  // (`packages/server/src/__tests__/helpers/realpgdb.ts`). This pool — the only
  // one that serves production — was left without one. Logging rather than
  // swallowing: a pool error is real signal, and the pool recovers by discarding
  // the client and opening a new one on the next checkout.
  pool.on('error', (err: Error) => {
    console.error('[db] idle client error (connection discarded, pool continues)', err);
  });

  db = drizzle(pool, { schema });

  return db;
}
