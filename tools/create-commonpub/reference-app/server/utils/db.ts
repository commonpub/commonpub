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
  db = drizzle(pool, { schema });

  return db;
}
