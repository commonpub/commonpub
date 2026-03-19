// Singleton Drizzle DB instance for Nitro server
import { drizzle } from 'drizzle-orm/node-postgres';
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

  const pool = new pg.Pool({ connectionString: databaseUrl });
  db = drizzle(pool, { schema });

  return db;
}
